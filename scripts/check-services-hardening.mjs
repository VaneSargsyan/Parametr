import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { serviceBlankRanges,serviceTextNonempty } from '../src/features/services/text.js';
import { validateService,servicePayload } from '../src/features/services/model.js';
const read=path=>fs.readFileSync(path,'utf8');
const services=read('supabase/migrations/202610210001_services.sql');
async function bootstrap(){
    const db=new PGlite();
    for(const file of ['scripts/sql/supabase-test-schema.sql','supabase/migrations/202610120001_admin_auth.sql','supabase/migrations/202610160001_customer_requests.sql'])await db.exec(read(file));
    return db;
}
const admin='40000000-0000-4000-8000-000000000001';
const outsider='40000000-0000-4000-8000-000000000002';
const editor='40000000-0000-4000-8000-000000000003';
const payload={fullName:'Synthetic policy audit',phone:'+37455123456',email:'',service:'construction',location:'Synthetic location',description:'Synthetic privacy test description',language:'hy',privacyConsent:true};
async function fixtures(db){
    for(const [id,email] of [[admin,'audit-admin@example.invalid'],[outsider,'audit-outsider@example.invalid'],[editor,'audit-editor@example.invalid']])await db.query('insert into auth.users(id,email)values($1,$2)',[id,email]);
    await db.query("insert into public.admin_users(user_id,role)values($1,'admin'),($2,'editor')",[admin,editor]);
    await db.query('select public.submit_customer_request($1,$2,$3,$4)',[crypto.randomUUID(),'a'.repeat(64),'b'.repeat(64),payload]);
}
async function identity(db,role,id=''){
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.exec(`set role ${role}`);
}
async function snapshot(db){
    return [
        (await db.query("select polname,polcmd,polpermissive,polroles,pg_get_expr(polqual,polrelid) expression from pg_policy where polrelid='public.customer_requests'::regclass order by polname")).rows,
        (await db.query('select * from public.customer_requests order by id')).rows,
        (await db.query("select relowner,relrowsecurity,relforcerowsecurity from pg_class where oid='public.customer_requests'::regclass")).rows,
        (await db.query('select * from pg_default_acl order by oid')).rows,
        (await db.query('select * from pg_auth_members order by roleid,member')).rows,
        (await db.query("select pg_get_functiondef('public.submit_customer_request(uuid,text,text,jsonb)'::regprocedure) definition")).rows,
    ];
}
const policyCases=[
    ['additional authenticated permissive read','create policy audit_extra_read on public.customer_requests for select to authenticated using(true)',true],
    ['weakened original expression','alter policy "active admins read requests" on public.customer_requests using(true)',true],
    ['PUBLIC policy role','alter policy "active admins read requests" on public.customer_requests to public using(true)',true],
    ['inherited policy role','create role audit_reader; grant audit_reader to authenticated; create policy audit_inherited_read on public.customer_requests for select to audit_reader using(true)',true],
    ['SET ROLE policy path','create role audit_reader; alter role authenticated noinherit; grant audit_reader to authenticated; grant select on public.customer_requests to audit_reader; create policy audit_inherited_read on public.customer_requests for select to audit_reader using(true)',true,'audit_reader'],
    ['editor included in original policy',"alter policy \"active admins read requests\" on public.customer_requests using((select private.has_staff_role(array['admin','editor'])))",true,'authenticated',editor],
    ['missing policy','drop policy "active admins read requests" on public.customer_requests',false],
    ['additional restrictive policy','create policy audit_extra_read on public.customer_requests as restrictive for select to authenticated using(true)',false],
    ['changed policy kind','drop policy "active admins read requests" on public.customer_requests; create policy "active admins read requests" on public.customer_requests as restrictive for select to authenticated using((select private.has_staff_role(array[\'admin\'])))',false],
    ['ALL-command policy','drop policy "active admins read requests" on public.customer_requests; create policy "active admins read requests" on public.customer_requests for all to authenticated using((select private.has_staff_role(array[\'admin\'])))',false],
];
for(const [name,setup,leaks,role='authenticated',subject=outsider] of policyCases){
    const db=await bootstrap();
    try{
        await fixtures(db);await db.exec(setup);
        if(leaks){
            await identity(db,role,subject);
            assert.equal((await db.query('select full_name,phone,description from public.customer_requests')).rows[0].full_name,payload.fullName,`${name}: reproduce PII exposure`);
            await db.exec('reset role');
        }
        const before=await snapshot(db);
        await assert.rejects(()=>db.exec(services),/Unsafe Phase 5 customer request policy contract/,name);
        await db.exec('rollback');
        assert.equal((await db.query("select to_regclass('public.services') relation")).rows[0].relation,null);
        assert.deepEqual(await snapshot(db),before,`${name}: fail without changing external data/policies/ACLs/RPC`);
    }finally{await db.close();}
}
console.log(`PASS: ${policyCases.length} exact Phase 5 policy regressions; nonstaff/editor PII leak reproductions; PUBLIC/inherited/SET ROLE paths; rollback preserves requests and prior configuration.`);
const metadataCases=[
    ['inherited anonymous SELECT','create role audit_reader; grant audit_reader to anon; alter default privileges in schema public grant select on tables to audit_reader'],
    ['non-inherited anonymous SELECT','create role audit_reader; alter role anon noinherit; grant audit_reader to anon; alter default privileges in schema public grant select on tables to audit_reader'],
    ['column-level attribution SELECT',"create function public.audit_metadata_grant() returns event_trigger language plpgsql as $$ begin if tg_tag='CREATE TABLE' and to_regclass('public.services') is not null then execute 'grant select(created_by) on public.services to anon'; end if; end $$; create event trigger audit_metadata_grant on ddl_command_end execute function public.audit_metadata_grant()"],
    ['post-preflight policy alteration',"create function public.audit_policy_drift() returns event_trigger language plpgsql as $$ begin if tg_tag='CREATE TABLE' and to_regclass('public.services') is not null then execute 'alter policy \"active admins read requests\" on public.customer_requests using(true)'; end if; end $$; create event trigger audit_policy_drift on ddl_command_end execute function public.audit_policy_drift()"],
    ['post-preflight RLS disable',"create function public.audit_rls_drift() returns event_trigger language plpgsql as $$ begin if tg_tag='CREATE TABLE' and to_regclass('public.services') is not null then execute 'alter table public.customer_requests disable row level security'; end if; end $$; create event trigger audit_rls_drift on ddl_command_end execute function public.audit_rls_drift()"],
];
for(const [name,setup] of metadataCases){
    const db=await bootstrap();
    try{
        await fixtures(db);await db.exec(setup);const before=await snapshot(db);
        await assert.rejects(()=>db.exec(services),/Unsafe anonymous service metadata|Unsafe Phase 5 customer request policy contract/,name);
        await db.exec('rollback');assert.equal((await db.query("select to_regclass('public.services') relation")).rows[0].relation,null);
        assert.deepEqual(await snapshot(db),before,name);
    }finally{await db.close();}
}
console.log('PASS: inherited/SET ROLE anonymous metadata grants, surviving column SELECT grants and policy drift during DDL fail before commit with rollback.');
const db=await bootstrap();
try{
    await fixtures(db);await db.exec(services);await db.exec(read('supabase/import/services.sql'));
    await identity(db,'authenticated',admin);
    const original=(await db.query("select * from public.services where service_key='construction'")).rows[0];
    const fields=['hy','en','ru'].flatMap(language=>[`title_${language}`,`description_${language}`]);
    const blanks=['',' ','\t\n\r','\u0085','\u00a0','\u2003','\ufeff','\u200b','\u200c\u200d','\u2060','\u034f','\u115f','\ufe0f','\u{e0100}','\u{1d173}','\u{e0061}',' \u00a0\ufeff\u2003\u200d'];
    const save=row=>db.query('select public.save_service($1,$2,$3) row',[row.id,row.revision,servicePayload(row)]);
    await db.exec('begin');
    for(const field of fields)for(const blank of blanks){
        assert.equal(serviceTextNonempty(blank),false);
        const row={...original,[field]:blank};
        assert.equal(validateService(row,true),'sm.invalid',`${field}: publication rejects invisible text`);
        await db.exec('savepoint audit_case');
        try{
            if(field==='title_hy')await assert.rejects(()=>save(row),error=>error.code==='23514');
            else{
                try{
                    const saved=(await save(row)).rows[0].row;
                    await assert.rejects(()=>db.query("select public.set_service_status($1,$2,'published')",[saved.id,saved.revision]),error=>error.code==='23514');
                }catch(error){if(error.code!=='23514')throw error;}
            }
        }finally{await db.exec('rollback to savepoint audit_case;release savepoint audit_case');}
    }
    await db.exec('rollback');
    await db.exec('reset role');
    const characters=new Set(['A','ա','Ж','😀','e\u0301','\u200dա','ա\u200d']);
    for(const [first,last] of serviceBlankRanges){
        for(let point=first;point<=last;point++)characters.add(String.fromCodePoint(point));
        for(const point of [first-1,last+1])if(point>0 && point<=0x10ffff && !(point>=0xd800 && point<=0xdfff))characters.add(String.fromCodePoint(point));
    }
    const text=[...characters];
    const comparisons=(await db.query('select value,private.service_text_nonempty(value) nonempty from unnest($1::text[]) value',[text])).rows;
    for(const row of comparisons)assert.equal(row.nonempty,serviceTextNonempty(row.value));
    await identity(db,'authenticated',admin);
    for(const field of fields)for(const unit of ['ա','Ж','😀','e\u0301','👩‍💻'])for(const extra of [0,1]){
        const maximum=field.startsWith('title_')?200:2000;
        const value=Array.from(unit.repeat(maximum+extra)).slice(0,maximum+extra).join('');
        const row={...original,[field]:value};
        assert.equal(Boolean(validateService(row,true)),Boolean(extra));
        await db.exec('begin');
        try{
            if(extra)await assert.rejects(()=>save(row),error=>error.code==='23514');
            else{
                const saved=(await save(row)).rows[0].row;
                assert.equal((await db.query('select length($1::text) n',[value])).rows[0].n,maximum);
                await db.query("select public.set_service_status($1,$2,'published')",[saved.id,saved.revision]);
            }
        }finally{await db.exec('rollback');}
    }
    await identity(db,'authenticated',admin);
    const published=(await db.query("select public.set_service_status($1,$2,'published') row",[original.id,original.revision])).rows[0].row;
    assert.equal(published.updated_by,admin);
    await identity(db,'anon');
    assert.equal((await db.query('select service_key,title_hy,sort_order,status,accepts_inquiries from public.services')).rows.length,1);
    for(const column of ['id','revision','created_at','updated_at','created_by','updated_by']){
        await assert.rejects(()=>db.query(`select ${column} from public.services`),error=>error.code==='42501');
        assert.equal((await db.query("select has_column_privilege('anon','public.services',$1,'SELECT') allowed",[column])).rows[0].allowed,false);
    }
    for(const query of ['select * from public.services','select to_jsonb(s) from public.services s',`select title_hy from public.services where updated_by='${admin}'`])await assert.rejects(()=>db.exec(query),error=>error.code==='42501');
    await identity(db,'authenticated',outsider);
    assert.equal((await db.query('select * from public.services')).rows.length,0);
    for(const subject of [admin,editor]){
        await identity(db,'authenticated',subject);
        const staff=(await db.query('select * from public.services')).rows;
        assert.equal(staff.length,6);assert(staff.some(row=>row.updated_by===admin));
    }
    await db.exec('reset role');
    await db.exec('update private.service_inquiry_config set enabled=true');
    const definition=(await db.query("select pg_get_functiondef('public.submit_customer_request_v2(uuid,text,text,jsonb)'::regprocedure) definition")).rows[0].definition;
    const key=crypto.randomUUID(),contact='e'.repeat(64);
    const measure=async()=>Number((await db.query('select coalesce(sum(hits),0)::int hits from private.inquiry_limits where bucket=$1',['contact:'+contact])).rows[0].hits);
    const submit=async()=>{
        await identity(db,'service_role');
        try{await db.query('select public.submit_customer_request_v2($1,$2,$3,$4)',[key,'f'.repeat(64),contact,payload]);}
        finally{await db.exec('reset role');}
    };
    const before=await measure();await submit();assert.equal(await measure(),before+1);await submit();assert.equal(await measure(),before+1);
    const quotaInvariant=async()=>{const start=await measure();await submit();assert.equal(await measure(),start,'duplicate retry charged contact quota');};
    await quotaInvariant();
    const mutant=definition.replace('if found then\n',"if found then\n perform private.inquiry_quota('contact:'||p_contact_hash,3600,3);\n");
    assert.notEqual(mutant,definition);await db.exec(mutant);
    await assert.rejects(quotaInvariant,/duplicate retry charged contact quota/);
    await db.exec(definition);await quotaInvariant();
    console.log(`PASS: ${fields.length*blanks.length} blank-publication field cases; ${comparisons.length} PostgreSQL/JS invisible-set comparisons; 60 Unicode max/max+1 boundaries; anonymous metadata/whole-row/filter denial; active admin/editor full reads; trusted quota measurements detect a retry-charge mutation.`);
}finally{await db.close();}
