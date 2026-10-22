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
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'parametr-dynamic-locks-'));
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
    const requestCount=key=>Number(psql(`select count(*) from public.customer_requests where submission_key='${key}'`));
    const hits=contact=>Number(psql(`select coalesce(sum(hits),0) from private.inquiry_limits where bucket='contact:${contact}'`));

    let started=false;
    const service=key=>psql(`select id from public.services where service_key=${quote(key)}`);
    const content=key=>({service_key:key,icon_key:'design',sort_order:6,accepts_inquiries:false,title_hy:'Տեղային ծառայություն',title_en:'Local service',title_ru:'Локальная услуга',description_hy:'Տեղային ծառայության նկարագրություն։',description_en:'Local service description.',description_ru:'Описание локальной услуги.'});
    const create=key=>`select public.save_service(null,null,${quote(JSON.stringify(content(key)))}::jsonb)`;
    try{
        execFileSync(path.join(bin,'initdb'),['-D',data,'-A','trust','-U','postgres','--no-locale','--encoding=UTF8'],{env,stdio:['ignore','pipe','pipe']});
        execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(directory,'server.log'),'-o',`-k ${directory} -p 55486 -c listen_addresses=''`,'-w','start'],{env,stdio:['ignore','pipe','pipe']});
        started=true;
        for(const file of ['scripts/sql/supabase-test-schema.sql','supabase/migrations/202610120001_admin_auth.sql','supabase/migrations/202610130001_projects.sql','supabase/migrations/202610160001_customer_requests.sql','supabase/migrations/202610210001_services.sql','supabase/import/services.sql','supabase/migrations/202610220001_dynamic_services.sql'])psql(fs.readFileSync(file,'utf8'));
        psql(`insert into auth.users(id,email)values('${admin}','native-admin@example.invalid');insert into public.admin_users(user_id,role)values('${admin}','admin')`);
        psql(fs.readFileSync('scripts/sql/dynamic-services-targeted-security.sql','utf8'));
        console.log('PASS: native combined-schema reserved-core and six-language publication security regressions, valid/invalid Unicode boundaries, role denial and rollback.');
        {
            const a=connect(),b=connect();const aPid=await identity(a,'authenticated'),bPid=await identity(b,'authenticated');
            await a.query(`begin;${create('concurrent-service')}`);
            const duplicate=b.query(create('concurrent-service'));const rejection=assert.rejects(duplicate,/23505/);
            await waitBlocked(bPid,aPid);await a.query('commit');await rejection;
            assert.equal(psql("select count(*) from public.services where service_key='concurrent-service'"),'1');a.close();b.close();
        }
        {
            const a=connect(),b=connect();const aPid=await identity(a,'authenticated'),bPid=await identity(b,'authenticated');
            const id=service('concurrent-service');
            await a.query(`begin;select public.save_service('${id}',0,${quote(JSON.stringify({...content('concurrent-service'),title_en:'Winning edit'}))}::jsonb)`);
            const loser=b.query(`select public.set_service_status('${id}',0,'published')`);const rejection=assert.rejects(loser,/40001/);
            await waitBlocked(bPid,aPid);await a.query('commit');await rejection;
            assert.equal(psql(`select revision from public.services where id='${id}'`),'1');a.close();b.close();
        }
        {
            const a=connect(),b=connect();const aPid=await identity(a,'authenticated'),bPid=await identity(b,'authenticated');
            const id=service('concurrent-service');
            await a.query(`begin;select public.set_service_status('${id}',1,'published')`);
            const loser=b.query(`select public.set_service_status('${id}',1,'archived')`);const rejection=assert.rejects(loser,/40001/);
            await waitBlocked(bPid,aPid);await a.query('commit');await rejection;
            assert.equal(psql(`select status from public.services where id='${id}'`),'published');a.close();b.close();
        }
        {
            const a=connect(),b=connect();const aPid=await identity(a,'authenticated'),bPid=await identity(b,'authenticated');
            const row=JSON.parse(psql("select row_to_json(s) from public.services s where service_key='construction'"));
            const payload={...content('construction'),...Object.fromEntries(Object.keys(content('construction')).map(key=>[key,row[key]])),title_en:'Safe core edit'};
            await a.query(`begin;select public.save_service('${row.id}',${row.revision},${quote(JSON.stringify(payload))}::jsonb)`);
            const loser=b.query(`select public.set_service_status('${row.id}',${row.revision},'archived')`);const rejection=assert.rejects(loser,/40001/);
            await waitBlocked(bPid,aPid);await a.query('commit');await rejection;
            assert.throws(()=>psql(`set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false);select public.set_service_status('${row.id}',${row.revision+1},'archived')`),error=>error.stderr.toString().includes('23514'));
            assert.equal(psql('select count(*) from public.services where is_core and status=\'published\''),'6');a.close();b.close();
        }
        {
            const a=connect(),b=connect();const aPid=await identity(a,'service_role'),bPid=await identity(b,'service_role');
            const key=crypto.randomUUID(),contact='a'.repeat(64);
            await a.query(`begin;${submit(key,contact,true)}`);
            const retry=b.query(submit(key,contact,true));
            await waitBlocked(bPid,aPid);await a.query('commit');await retry;
            assert.equal(requestCount(key),1);assert.equal(hits(contact),1);a.close();b.close();
        }
        assert.equal(psql('select enabled from private.service_inquiry_config'),'f');
        console.log('PASS: Phase 6.1 native simultaneous duplicate creation, save/publication, publication/archive, core edit/archive protection and legacy retry locking; actual waits observed, six core rows remain public and catalog mode stays disabled.');
    }finally{
        sessions.forEach(session=>session.close());
        if(started || fs.existsSync(path.join(data,'postmaster.pid')))execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,stdio:['ignore','pipe','pipe']});
        fs.rmSync(directory,{recursive:true,force:true});
    }
}
