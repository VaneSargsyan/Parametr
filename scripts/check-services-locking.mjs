import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn,execFileSync } from 'node:child_process';
const directories=['/Library/PostgreSQL/18/bin','/opt/homebrew/opt/postgresql@18/bin','/opt/homebrew/opt/postgresql@17/bin','/usr/local/opt/postgresql@18/bin','/usr/local/opt/postgresql@17/bin',...process.env.PATH.split(path.delimiter)];
const bin=directories.find(directory=>['postgres','initdb','pg_ctl','psql'].every(name=>fs.existsSync(path.join(directory,name))));
if(!bin){
    console.log('SKIP: native PostgreSQL locking tests; no suitable postgres/initdb/pg_ctl/psql installation. PGlite tests are not multi-connection locking proofs.');
}else{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'parametr-services-locks-'));
    fs.chmodSync(directory,0o700);
    const data=path.join(directory,'data');
    const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith('PG')));
    env.PGPASSFILE=path.join(directory,'empty-pgpass');
    fs.writeFileSync(env.PGPASSFILE,'',{mode:0o600});
    const psqlArgs=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-h',directory,'-p','55486','-U','postgres','-d','postgres'];
    const psql=sql=>execFileSync(path.join(bin,'psql'),psqlArgs,{input:sql,env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
    const sessions=[];
    function connect(){
        const child=spawn(path.join(bin,'psql'),psqlArgs,{env,stdio:['pipe','pipe','pipe']});
        let pending=null,buffer='',stderr='',closed=false,serial=0,chain=Promise.resolve();
        child.stdout.on('data',chunk=>{
            buffer+=chunk.toString();
            while(buffer.includes('\n')){
                const end=buffer.indexOf('\n'),line=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);
                if(pending){
                    if(line===pending.marker){const current=pending;pending=null;clearTimeout(current.timer);current.resolve(current.rows);}
                    else pending.rows.push(line);
                }
            }
        });
        child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
        const fail=error=>{closed=true;if(pending){clearTimeout(pending.timer);pending.reject(error);pending=null;}};
        child.on('error',fail);child.on('exit',code=>fail(new Error(`Local psql exit ${code}: ${stderr}`)));
        const session={
            query(sql){
                const result=chain.then(()=>new Promise((resolve,reject)=>{
                    if(closed){reject(new Error(stderr||'Local psql closed'));return;}
                    const marker=`parametr_done_${++serial}`;
                    const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error(`Local SQL timeout: ${sql}`));},15000);
                    pending={resolve,reject,marker,rows:[],timer};
                    child.stdin.write(`${sql};\nselect '${marker}';\n`);
                }));
                chain=result.catch(()=>{});return result;
            },
            close(){child.stdin.end();if(!closed)child.kill('SIGTERM');},
        };
        sessions.push(session);return session;
    }
    const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
    const waitBlocked=async(blocked,blocker)=>{
        const deadline=Date.now()+5000;
        while(Date.now()<deadline){
            if(psql(`select ${blocker}=any(pg_catalog.pg_blocking_pids(${blocked}))`) === 't')return;
            await pause(20);
        }
        throw new Error(`Expected native PostgreSQL backend ${blocked} to wait on ${blocker}`);
    };
    const admin='50000000-0000-4000-8000-000000000001';
    const identity=async(session,role)=>{
        await session.query(`set role ${role};select set_config('request.jwt.claim.sub','${role==='authenticated'?admin:''}',false)`);
        return Number((await session.query('select pg_backend_pid()'))[0]);
    };
    const payload={fullName:'Native synthetic request',phone:'+37455123456',email:'',service:'construction',location:'Native disposable database',description:'Synthetic multi-connection locking inquiry',language:'hy',privacyConsent:true};
    const hash='a'.repeat(64);
    const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
    const submit=(key,contact,legacy=false)=>`select public.${legacy?'submit_customer_request':'submit_customer_request_v2'}('${key}','${hash}','${contact}',${quote(JSON.stringify(payload))}::jsonb)`;
    const revision=()=>Number(psql("select revision from public.services where service_key='construction'"));
    const projectId=()=>psql("select id from public.services where service_key='construction'");
    const publish=()=>psql("update public.services set status='published',revision=revision+1 where service_key='construction'");
    const status=(value,rev=revision())=>`select public.set_service_status('${projectId()}',${rev},'${value}')`;
    const requestCount=key=>Number(psql(`select count(*) from public.customer_requests where submission_key='${key}'`));
    const hits=contact=>Number(psql(`select coalesce(sum(hits),0) from private.inquiry_limits where bucket='contact:${contact}'`));
    let started=false;
    try{
        execFileSync(path.join(bin,'initdb'),['-D',data,'-A','trust','-U','postgres','--no-locale','--encoding=UTF8'],{env,stdio:['ignore','pipe','pipe']});
        execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(directory,'server.log'),'-o',`-k ${directory} -p 55486 -c listen_addresses=''`,'-w','start'],{env,stdio:['ignore','pipe','pipe']});
        started=true;
        for(const file of ['scripts/sql/supabase-test-schema.sql','supabase/migrations/202610120001_admin_auth.sql','supabase/migrations/202610130001_projects.sql','supabase/migrations/202610160001_customer_requests.sql','supabase/migrations/202610210001_services.sql','supabase/import/services.sql'])psql(fs.readFileSync(file,'utf8'));
        psql(`insert into auth.users(id,email)values('${admin}','native-admin@example.invalid');insert into public.admin_users(user_id,role)values('${admin}','admin');update public.services set status='published';update private.service_inquiry_config set enabled=true`);
        assert.equal(psql('set role anon;select count(service_key) from public.services'),'6');
        for(const query of ['select created_by,updated_by from public.services','select to_jsonb(s) from public.services s'])assert.throws(()=>psql(`set role anon;${query}`),error=>error.stderr.toString().includes('42501'));
        assert.equal(psql('set role authenticated;select count(*) from public.services'),'0');
        {
            const a=connect(),b=connect();const aPid=await identity(a,'authenticated'),bPid=await identity(b,'authenticated');
            const row=JSON.parse(psql("select row_to_json(s) from public.services s where service_key='construction'"));
            const content=Object.fromEntries(['service_key','icon_key','sort_order','accepts_inquiries','title_hy','title_en','title_ru','description_hy','description_en','description_ru'].map(key=>[key,row[key]]));
            content.title_en='Native first writer';
            await a.query(`begin;select public.save_service('${row.id}',${row.revision},${quote(JSON.stringify(content))}::jsonb)`);
            const loser=b.query(status('archived',row.revision));const rejection=assert.rejects(loser,/40001/);
            await waitBlocked(bPid,aPid);await a.query('commit');await rejection;
            assert.equal(revision(),row.revision+1);assert.equal(psql("select status from public.services where service_key='construction'"),'published');a.close();b.close();
        }
        {
            const a=connect(),b=connect();const aPid=await identity(a,'service_role'),bPid=await identity(b,'authenticated');
            const key=crypto.randomUUID(),contact='b'.repeat(64);
            await a.query(`begin;${submit(key,contact)}`);
            const archival=b.query(status('archived'));
            await waitBlocked(bPid,aPid);await a.query('commit');await archival;
            assert.equal(requestCount(key),1);assert.equal(hits(contact),1);
            assert.equal(psql(`select service_id is not null and service_title_snapshot is not null from public.customer_requests where submission_key='${key}'`),'t');
            await a.query(submit(key,contact));assert.equal(requestCount(key),1);assert.equal(hits(contact),1);a.close();b.close();
        }
        {
            publish();const a=connect(),b=connect();const aPid=await identity(a,'service_role'),bPid=await identity(b,'authenticated');
            const key=crypto.randomUUID(),contact='c'.repeat(64);
            await b.query(`begin;${status('archived')}`);
            const blocked=a.query(submit(key,contact));const rejection=assert.rejects(blocked,/23514/);
            await waitBlocked(aPid,bPid);await b.query('commit');await rejection;
            assert.equal(requestCount(key),0);assert.equal(hits(contact),0);a.close();b.close();
        }
        {
            publish();const a=connect(),b=connect();const aPid=await identity(a,'service_role'),bPid=await identity(b,'service_role');
            const key=crypto.randomUUID(),contact='d'.repeat(64);
            await a.query(`begin;${submit(key,contact)}`);
            const duplicate=b.query(submit(key,contact));
            await waitBlocked(bPid,aPid);await a.query('commit');await duplicate;
            assert.equal(requestCount(key),1);assert.equal(hits(contact),1);a.close();b.close();
        }
        {
            psql('update private.service_inquiry_config set enabled=false');
            const a=connect(),b=connect();const aPid=await identity(a,'postgres'),bPid=await identity(b,'service_role');
            const key=crypto.randomUUID(),contact='e'.repeat(64);
            await a.query('begin;update private.service_inquiry_config set enabled=true');
            const blocked=b.query(submit(key,contact,true));const rejection=assert.rejects(blocked,/55000/);
            await waitBlocked(bPid,aPid);await a.query('commit');await rejection;
            assert.equal(requestCount(key),0);assert.equal(hits(contact),0);a.close();b.close();
        }
        {
            psql('update private.service_inquiry_config set enabled=false');
            const a=connect(),b=connect();const aPid=await identity(a,'service_role'),bPid=await identity(b,'postgres');
            const key=crypto.randomUUID(),contact='f'.repeat(64);
            await a.query(`begin;${submit(key,contact,true)}`);
            const activation=b.query('update private.service_inquiry_config set enabled=true');
            await waitBlocked(bPid,aPid);await a.query('commit');await activation;
            assert.equal(requestCount(key),1);assert.equal(hits(contact),1);
            assert.equal(psql(`select service_id is null and service_title_snapshot is null from public.customer_requests where submission_key='${key}'`),'t');a.close();b.close();
        }
        console.log('PASS: isolated native PostgreSQL simultaneous save/status revisions, both archival/submission orders, advisory-lock duplicate submission, both activation/legacy-submission orders; actual backend blocking observed; quota/snapshot/atomicity assertions.');
    }finally{
        sessions.forEach(session=>session.close());
        if(started || fs.existsSync(path.join(data,'postmaster.pid')))execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,stdio:['ignore','pipe','pipe']});
        fs.rmSync(directory,{recursive:true,force:true});
    }
}
