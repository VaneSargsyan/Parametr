import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';
import { validateService,newService,servicePayload,serviceKeys,isCoreService } from '../src/features/services/model.js';
import { createServicesController } from '../src/features/services/servicesController.js';
const read=path=>fs.readFileSync(path,'utf8');
const migration=read('supabase/migrations/202610220001_dynamic_services.sql');
const files=['scripts/sql/supabase-test-schema.sql','supabase/migrations/202610120001_admin_auth.sql','supabase/migrations/202610130001_projects.sql','supabase/migrations/202610160001_customer_requests.sql','supabase/migrations/202610210001_services.sql','supabase/import/services.sql'];
async function bootstrap(){const db=new PGlite();for(const file of files)await db.exec(read(file));return db;}
const admin='90000000-0000-4000-8000-000000000001',editor='90000000-0000-4000-8000-000000000002',outsider='90000000-0000-4000-8000-000000000003';
const content=key=>({...newService(key),title_hy:'Նոր ծառայություն',title_en:'Additional service',title_ru:'Дополнительная услуга',description_hy:'Ծառայության նկարագրություն։',description_en:'Additional service description.',description_ru:'Описание дополнительной услуги.'});
const inquiry={fullName:'Synthetic inquiry',phone:'+15555550199',email:'',service:'construction',location:'Disposable local test',description:'Synthetic legacy request description',language:'hy',privacyConsent:true};
const identity=async(db,role,id='')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);};
const save=(db,row)=>db.query('select public.save_service($1,$2,$3) row',[row.id||null,row.revision??null,servicePayload(row)]).then(r=>r.rows[0].row);
const status=(db,row,value)=>db.query('select public.set_service_status($1,$2,$3) row',[row.id,row.revision,value]).then(r=>r.rows[0].row);
const deny=(fn,code='42501')=>assert.rejects(fn,error=>error.code===code);
const db=await bootstrap();
try{
 for(const [i,id] of [admin,editor,outsider].entries())await db.query('insert into auth.users values($1,$2)',[id,`dynamic-${i}@example.invalid`]);
 await db.query("insert into public.admin_users(user_id,role)values($1,'admin'),($2,'editor')",[admin,editor]);
 const historical=crypto.randomUUID();
 await db.query('select public.submit_customer_request($1,$2,$3,$4)',[historical,'a'.repeat(64),'b'.repeat(64),inquiry]);
 const previous=(await db.query('select * from public.customer_requests order by id')).rows;
 const functionsBefore=(await db.query("select proname,prosrc,proacl from pg_proc where oid in ('public.submit_customer_request(uuid,text,text,jsonb)'::regprocedure,'public.submit_customer_request_v2(uuid,text,text,jsonb)'::regprocedure,'public.inquiry_attempt()'::regprocedure,'public.set_customer_request_status(uuid,integer,text)'::regprocedure) order by proname")).rows;
 const before=(await db.query('select * from public.services order by service_key')).rows;
 await db.exec(migration);
 assert.deepEqual((await db.query('select * from public.customer_requests order by id')).rows,previous);
 assert.deepEqual((await db.query("select proname,prosrc,proacl from pg_proc where oid in ('public.submit_customer_request(uuid,text,text,jsonb)'::regprocedure,'public.submit_customer_request_v2(uuid,text,text,jsonb)'::regprocedure,'public.inquiry_attempt()'::regprocedure,'public.set_customer_request_status(uuid,integer,text)'::regprocedure) order by proname")).rows,functionsBefore);
 assert.equal((await db.query('select enabled from private.service_inquiry_config')).rows[0].enabled,false);
 const core=(await db.query('select * from public.services order by service_key')).rows;
 for(const [i,row] of core.entries()){
  assert.equal(row.id,before[i].id);assert.equal(row.service_key,before[i].service_key);assert.equal(row.status,'published');assert.equal(row.is_core,true);
  for(const key of ['title_hy','title_en','title_ru','description_hy','description_en','description_ru','icon_key','sort_order','accepts_inquiries','created_at','created_by'])assert.deepEqual(row[key],before[i][key]);
 }
 await identity(db,'anon');assert.equal((await db.query('select service_key from public.services')).rows.length,6);
 for(const query of ['select * from public.services','select created_by,updated_by from public.services','select is_core from public.services'])await deny(()=>db.exec(query));
 await deny(()=>save(db,content('engineering')));await deny(()=>status(db,core[0],'archived'));
 await identity(db,'authenticated',outsider);assert.equal((await db.query('select * from public.services')).rows.length,0);assert.equal((await db.query('select * from public.customer_requests')).rows.length,0);
 await deny(()=>save(db,content('engineering')));
 await identity(db,'authenticated',editor);await deny(()=>save(db,content('engineering')));
 await identity(db,'authenticated',admin);
 for(const row of core){
  for(const value of ['draft','archived'])await deny(()=>status(db,row,value),'23514');
  await deny(()=>save(db,{...row,service_key:'renamed-core'}),'23514');
 }
 let extra=await save(db,content('engineering'));
 assert.equal(extra.status,'draft');assert.equal(extra.is_core,false);assert.equal(extra.created_by,admin);assert.equal(extra.accepts_inquiries,false);
 await deny(()=>save(db,content('engineering')),'23505');
 for(const key of ['Engineering','doorSWindows','realestate','bad key','bad--key','a'.repeat(81)])await deny(()=>save(db,content(key)),key==='realestate'?'23505':'23514');
 await deny(()=>save(db,{...extra,service_key:'renamed-extra'}),'23514');
 const forged={...servicePayload(extra),is_core:true};await deny(()=>db.query('select public.save_service($1,$2,$3)',[extra.id,extra.revision,forged]),'23514');
 await identity(db,'authenticated',editor);
 extra=await save(db,{...extra,title_en:'Editor draft'});
 for(const patch of [{sort_order:99},{icon_key:'design'},{accepts_inquiries:true}])await deny(()=>save(db,{...extra,...patch}));
 await deny(()=>status(db,extra,'published'));await deny(()=>status(db,extra,'archived'));await deny(()=>save(db,core[0]));
 await identity(db,'anon');assert.equal((await db.query('select service_key from public.services')).rows.length,6);
 await identity(db,'authenticated',admin);
 for(const language of ['hy','en','ru'])for(const field of ['title','description']){
  const blank=await save(db,{...extra,[`${field}_${language}`]:'\u00a0\u2003\ufeff'}).catch(error=>{assert.equal(field==='title' && language==='hy',true);assert.equal(error.code,'23514');return null;});
  if(blank){await deny(()=>status(db,blank,'published'),'23514');extra=await save(db,{...blank,[`${field}_${language}`]:extra[`${field}_${language}`]});}
 }
 const stale=extra;
 extra=await status(db,extra,'published');await deny(()=>status(db,stale,'archived'),'40001');
 await identity(db,'anon');assert.equal((await db.query('select service_key from public.services')).rows.length,7);
 await identity(db,'authenticated',admin);extra=await status(db,extra,'archived');
 await identity(db,'anon');assert.equal((await db.query('select service_key from public.services')).rows.length,6);
 await identity(db,'authenticated',admin);extra=await status(db,extra,'draft');
 for(const query of ['update public.services set status=\'archived\'','delete from public.services','truncate public.services','update public.admin_users set role=\'admin\''])await deny(()=>db.exec(query));
 await db.exec('reset role');
 for(const row of core){await deny(()=>db.query('delete from public.services where id=$1',[row.id]),'23514');await deny(()=>db.query('update public.services set service_key=$1 where id=$2',['renamed',row.id]),'23514');}
 await deny(()=>db.exec('truncate public.services cascade'),'23514');
 await deny(()=>db.query('update public.services set id=$1 where id=$2',[crypto.randomUUID(),core[0].id]),'23514');
 await deny(()=>db.exec('update public.services set is_core=false'),'428C9');
 await db.query('update public.admin_users set active=false where user_id=$1',[admin]);await identity(db,'authenticated',admin);
 await deny(()=>save(db,content('revoked')));await deny(()=>status(db,extra,'published'));assert.equal((await db.query('select * from public.services')).rows.length,0);
 await db.exec('reset role');await db.query('update public.admin_users set active=true where user_id=$1',[admin]);
 await identity(db,'service_role');
 assert.equal((await db.query('select public.submit_customer_request($1,$2,$3,$4) ok',[historical,'a'.repeat(64),'b'.repeat(64),inquiry])).rows[0].ok,true);
 await db.query('select public.submit_customer_request($1,$2,$3,$4)',[crypto.randomUUID(),'c'.repeat(64),'d'.repeat(64),inquiry]);
 await deny(()=>db.query('select public.submit_customer_request_v2($1,$2,$3,$4)',[crypto.randomUUID(),'e'.repeat(64),'f'.repeat(64),{...inquiry,service:'engineering'}]),'55000');
 await deny(()=>db.query('select public.submit_customer_request($1,$2,$3,$4)',[crypto.randomUUID(),'e'.repeat(64),'f'.repeat(64),{...inquiry,service:'engineering'}]),'23514');
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.customer_requests')).rows[0].n,2);
 assert.equal((await db.query("select hits from private.inquiry_limits where bucket=$1",['contact:'+'b'.repeat(64)])).rows[0].hits,1);
 await deny(()=>db.exec(migration),'42701');await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from public.services')).rows[0].n,7);
 console.log('PASS: Phase 6.1 core identity/content preservation and visibility; dynamic creation; admin/editor/nonstaff/revocation; Unicode publication; immutable/unique keys; deletion/truncation; stale revisions; exact legacy RPC/ACL preservation, quotas/history and disabled catalog.');
}finally{await db.close();}
for(const unsafe of [
 'create role dynamic_writer; grant dynamic_writer to authenticated; grant update(title_hy) on public.services to dynamic_writer',
 'create role dynamic_reader; alter role anon noinherit; grant dynamic_reader to anon; grant select(is_core) on public.services to dynamic_reader',
 'alter policy "published services" on public.services using(true)',
 `create function public.audit_dynamic_ddl() returns event_trigger language plpgsql as $$ begin alter policy "published services" on public.services using(true); end $$; create event trigger audit_dynamic_policy on ddl_command_end when tag in ('CREATE TRIGGER') execute function public.audit_dynamic_ddl()`,
 'create policy leaked_requests on public.customer_requests for select to authenticated using(true)',
 "grant update(role) on public.admin_users to authenticated",
 'create role dynamic_executor; grant dynamic_executor to authenticated; alter default privileges in schema private grant execute on functions to dynamic_executor',
 "update private.service_inquiry_config set enabled=true",
 "update public.services set title_en='' where service_key='construction'",
 "delete from public.services where service_key='construction'"
]){
 const db=await bootstrap();try{
  await db.exec(unsafe.replace('grant select(is_core)','grant select(created_by)'));
  const before=(await db.query('select * from public.services order by service_key')).rows;
  await assert.rejects(()=>db.exec(migration));await db.exec('rollback');
  assert.deepEqual((await db.query('select * from public.services order by service_key')).rows,before);
  assert.equal((await db.query("select count(*)::int n from pg_attribute where attrelid='public.services'::regclass and attname='is_core' and not attisdropped")).rows[0].n,0);
 }finally{await db.close();}
}
for(const key of ['engineering','engineering-2',...serviceKeys])assert.equal(validateService(content(key)),null);
for(const key of ['Engineering','bad key','bad--key','a'.repeat(81),''])assert.equal(validateService(content(key)),'sm.invalid');
assert.equal(isCoreService('construction'),true);assert.equal(isCoreService('engineering'),false);
assert.equal(newService().service_key,'');assert.equal(newService().accepts_inquiries,false);
console.log('PASS: unsafe inherited/SET ROLE/column privileges, PII policy drift, membership grants, trigger EXECUTE defaults, active catalog and incomplete/missing cores abort atomically; dynamic-key JavaScript validation.');
{
 const rows=Array.from({length:11},(_,i)=>({...content(`extra-${i}`),id:`id-${i}`,revision:0,sort_order:i}));
 let requests=0;
 const controller=createServicesController({list:async filter=>{requests++;return {rows:rows.slice(filter.page*10,filter.page*10+10),count:rows.length};},change:async()=>{rows.unshift({...content('first'),id:'first',revision:0,sort_order:0});return rows[0];}});
 const stop=controller.start();await new Promise(resolve=>setTimeout(resolve,0));controller.create(content('first'));await controller.updateStatus({type:'save',row:content('first')});
 assert.equal(controller.getSnapshot().data.rows.length,10);assert.equal(controller.getSnapshot().data.count,12);assert.equal(controller.getSnapshot().selected.id,'first');assert.equal(requests,2);stop();
}
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',define:{'import.meta.env.VITE_SERVICES_SOURCE':'"supabase"','import.meta.env.VITE_SUPABASE_URL':'""'}});
try{
 const {publishedServices,changeService}=await server.ssrLoadModule('/src/features/services/service.js');
 await assert.rejects(()=>changeService(content('engineering'),{type:'save',row:content('engineering')},{rpc:async()=>({error:{code:'23505'}})}),/sm.duplicate/);
 const pages=[[content('construction'),content('engineering')],[content('more-engineering')],[]];let page=0;
 const client={from:()=>{const query={select:()=>query,eq:()=>query,order:()=>query,range:(start)=>{assert.equal(start,page===0?0:page===1?2:3);return Promise.resolve({data:pages[page++],error:null});}};return query;}};
 const rows=await publishedServices(client);assert.deepEqual(rows.map(row=>row.id),['construction','engineering','more-engineering']);
}finally{await server.close();}
console.log('PASS: page reconciliation preserves editor and totals; public pagination handles server row caps without static merging or duplicates.');
