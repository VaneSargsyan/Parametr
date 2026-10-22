import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { transformWithOxc,createServer } from 'vite';
import vm from 'node:vm';
import {normalizeInquiry,inquiryErrors} from '../supabase/functions/_shared/inquiryValidation.js';
const read=path=>fs.readFileSync(path,'utf8');
await import('./check-inquiry-hardening.mjs');
await import('./check-request-races.mjs');
const valid=normalizeInquiry({fullName:'Test Customer',phone:'+374 (55) 123-456',email:'',service:'construction',location:'Test staging location',description:'Synthetic project description',language:'hy',privacyConsent:true});
assert.deepEqual(inquiryErrors(valid),{});
for(const patch of [{fullName:''},{phone:'bad'},{email:'bad'},{service:'other'},{location:''},{description:'short'},{language:'de'},{privacyConsent:false},{description:'a'.repeat(5001)},{fullName:'Test\u0000Name'}])assert(Object.keys(inquiryErrors({...valid,...patch})).length);
assert.equal(normalizeInquiry({...valid,privacyConsent:'true'}).privacyConsent,false);
const db=new PGlite();
try{
 await db.exec(read('scripts/sql/supabase-test-schema.sql'));await db.exec(read('supabase/migrations/202610120001_admin_auth.sql'));
 // Hostile global grants must not expose privileged inquiry helpers/RPCs.
 await db.exec('alter default privileges grant execute on functions to anon,authenticated,service_role');
 await db.exec(read('supabase/migrations/202610160001_customer_requests.sql'));
 // Compare application boundaries directly with real PostgreSQL code-point length.
 for(const [field,min,max] of [['fullName',2,120],['location',2,300],['description',10,5000]]){
  for(const unit of ['a','ա','Ж','😀','e\u0301','👩‍💻']){
   for(const target of [min-1,min,max,max+1]){
    const text=Array.from(unit.repeat(target)).slice(0,target).join('');
    const pgLength=(await db.query('select length($1::text) as n',[text])).rows[0].n;
    assert.equal(Boolean(inquiryErrors({...valid,[field]:text})[field]),pgLength<min || pgLength>max,`${field}: Unicode length ${pgLength}`);
   }
  }
 }
 assert(inquiryErrors({...valid,description:'😀'.repeat(5)}).description,'Five emoji are five characters, not ten');
 assert(!inquiryErrors({...valid,description:'😀'.repeat(10)}).description);
 assert(inquiryErrors({...valid,fullName:'bad\ud800'}).fullName,'Unpaired surrogate is not valid PostgreSQL UTF-8');
 await db.exec('begin');
 await db.query('select public.submit_customer_request($1,$2,$3,$4::jsonb)',[crypto.randomUUID(),'a'.repeat(64),'d'.repeat(64),JSON.stringify({...valid,description:'😀'.repeat(10)})]);
 assert.equal((await db.query('select length(description) as n from public.customer_requests')).rows[0].n,10);
 await db.exec('rollback');
 console.log('PASS: 72 text-length boundaries match real PostgreSQL for Latin/Armenian/Russian/astral/combining/ZWJ text; valid emoji persistence; invalid surrogate rejection.');

 const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004'];
 for(const id of ids)await db.query('insert into auth.users(id,email)values($1,$2)',[id,`${id}@example.invalid`]);
 await db.query("insert into public.admin_users(user_id,role,active)values($1,'admin',true),($2,'editor',true),($3,'admin',false)",[ids[0],ids[1],ids[3]]);
 const key='20000000-0000-4000-8000-000000000001';const hash='a'.repeat(64);const contact='b'.repeat(64);
 const submit=(id=key,digest=hash,payload=valid,phoneHash=contact)=>db.query('select public.submit_customer_request($1,$2,$3,$4::jsonb) as saved',[id,digest,phoneHash,JSON.stringify(payload)]);
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await assert.rejects(()=>submit(),e=>e.code==='42501');
  await assert.rejects(()=>db.exec('select public.inquiry_attempt()'),e=>e.code==='42501');
  await assert.rejects(()=>db.exec("select private.inquiry_quota('bypass',1,1000)"),e=>e.code==='42501');
  await assert.rejects(()=>db.exec("insert into public.customer_requests(full_name)values('forged')"),e=>e.code==='42501');
  await assert.rejects(()=>db.exec("update public.customer_requests set status='completed'"),e=>e.code==='42501');
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 assert.equal((await submit()).rows[0].saved,true);assert.equal((await submit()).rows[0].saved,true);
 await assert.rejects(()=>submit(key,'c'.repeat(64)),e=>e.code==='23505');
 assert.equal((await db.query('select count(*)::int as count from public.customer_requests')).rows[0].count,1);
 await assert.rejects(()=>submit(crypto.randomUUID(),hash,{...valid,privacyConsent:false}),e=>e.code==='23514');
 for(let i=0;i<2;i++)assert.equal((await submit(crypto.randomUUID())).rows[0].saved,true);
 assert.equal((await submit(crypto.randomUUID())).rows[0].saved,false,'Fourth contact submission rejected durably');
 const row=(await db.query('select * from public.customer_requests where submission_key=$1',[key])).rows[0];
 await db.exec('reset role');
 await db.exec('set role anon');await assert.rejects(()=>db.exec('select * from public.customer_requests'),e=>e.code==='42501');await db.exec('reset role');
 for(const id of [ids[1],ids[2],ids[3]]){
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  assert.equal((await db.query('select * from public.customer_requests')).rows.length,0);
  await assert.rejects(()=>db.query("select public.set_customer_request_status($1,0,'completed')",[row.id]),e=>e.code==='42501');await db.exec('reset role');
 }
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[0]]);
 assert.equal((await db.query('select * from public.customer_requests')).rows.length,3);
 const changed=await db.query("select public.set_customer_request_status($1,0,'in_progress') as result",[row.id]);
 assert.equal(changed.rows[0].result.status,'in_progress');assert.equal(changed.rows[0].result.revision,1);
 await assert.rejects(()=>db.query("select public.set_customer_request_status($1,0,'completed')",[row.id]),e=>e.code==='40001');
 await assert.rejects(()=>db.query("select public.set_customer_request_status($1,1,'forged')",[row.id]),e=>e.code==='23514');
 await db.query("select public.set_customer_request_status($1,1,'completed')",[row.id]);
 const races=await Promise.allSettled([db.query("select public.set_customer_request_status($1,2,'rejected')",[row.id]),db.query("select public.set_customer_request_status($1,2,'new')",[row.id])]);
 assert.equal(races.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(races.find(result=>result.status==='rejected').reason.code,'40001');
 await db.exec('reset role');await db.query('update public.admin_users set active=false where user_id=$1',[ids[0]]);
 await db.exec('set role authenticated');assert.equal((await db.query('select * from public.customer_requests')).rows.length,0);
 await assert.rejects(()=>db.query("select public.set_customer_request_status($1,2,'rejected')",[row.id]),e=>e.code==='42501');
 await db.exec('reset role');await db.exec('set role service_role');
 for(let i=0;i<120;i++)assert.equal((await db.query('select public.inquiry_attempt() as allowed')).rows[0].allowed,true);
 assert.equal((await db.query('select public.inquiry_attempt() as allowed')).rows[0].allowed,false);
 console.log('PASS: real embedded PostgreSQL migration, hostile default ACLs, public/editor/nonstaff/inactive/revoked denial, admin status updates, stale revisions, idempotency/conflicts, contact/global durable quotas.');
}finally{await db.close();}
for(const unsafe of ['alter role authenticated bypassrls','grant insert on public.admin_users to authenticated']) {
 const unsafeDb=new PGlite();
 try{
  await unsafeDb.exec(read('scripts/sql/supabase-test-schema.sql'));await unsafeDb.exec(read('supabase/migrations/202610120001_admin_auth.sql'));await unsafeDb.exec(unsafe);
  await assert.rejects(()=>unsafeDb.exec(read('supabase/migrations/202610160001_customer_requests.sql')),/Unsafe membership/);
  await unsafeDb.exec('rollback');assert.equal((await unsafeDb.query("select to_regclass('public.customer_requests') as relation")).rows[0].relation,null);
 }finally{await unsafeDb.close();}
}
console.log('PASS: unsafe membership privileges/BYPASSRLS rejected before schema creation.');
// Exercise actual transpiled Edge handler with only test doubles; no network.
let handler;const calls=[];
const env={SUPABASE_URL:'https://uewihgsxrcjieghtkhjs.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'TEST_ONLY',INQUIRY_ALLOWED_ORIGINS:'http://localhost:5173',INQUIRY_TURNSTILE_SECRET:'TEST_ONLY',INQUIRY_HMAC_SECRET:'TEST_ONLY'.repeat(5),INQUIRY_CAPTCHA_HOSTNAMES:'localhost'};
let proof={success:true,action:'customer_inquiry',hostname:'localhost'};let saved=true;let saveError=null;let quota=true;
const code=await transformWithOxc(read('supabase/functions/submit-inquiry/index.ts').replace(/^import .*;\n/gm,''),'inquiry.ts');
vm.runInNewContext(code.code,{Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},Response,Request,Uint8Array,TextDecoder,TextEncoder,AbortSignal,setTimeout,clearTimeout,crypto,normalizeInquiry,inquiryErrors,inquiryUuid:/^[0-9a-f-]{36}$/i,fetch:async()=>new Response(JSON.stringify(proof)),createClient:()=>({rpc:async name=>{calls.push(name);return name==='inquiry_attempt'?{data:quota,error:null}:{data:saved,error:saveError};}})});
const body={...valid,submissionKey:crypto.randomUUID(),captchaToken:'TEST_ONLY'};
const request=(payload=body,origin='http://localhost:5173')=>new Request('http://test.invalid',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
assert.equal((await handler(new Request('http://test.invalid',{method:'OPTIONS',headers:{Origin:'http://localhost:5173'}}))).status,204);assert.equal(calls.length,0);
assert.equal((await handler(request(body,'https://untrusted.invalid'))).status,403);
assert.equal((await handler(request({...body,description:'x'}))).status,400);assert.equal(calls.length,0);
assert.equal((await handler(request({...body,description:'a'.repeat(33000)}))).status,413);
proof={...proof,success:false};assert.equal((await handler(request())).status,400);assert(!calls.includes('submit_customer_request'));
proof={success:true,action:'wrong',hostname:'localhost'};assert.equal((await handler(request())).status,400);
proof={success:true,action:'customer_inquiry',hostname:'evil.invalid'};assert.equal((await handler(request())).status,400);
proof={success:true,action:'customer_inquiry',hostname:'localhost'};saved=false;assert.equal((await handler(request())).status,429);
saved=true;saveError={code:'23505'};assert.equal((await handler(request())).status,409);
saveError={code:'timeout'};assert.equal((await handler(request())).status,503);
saveError=null;assert.equal((await (await handler(request())).json()).code,'inquiry.saved');
quota=false;assert.equal((await handler(request())).status,429);
env.SUPABASE_URL='https://production.invalid';assert.equal((await handler(request())).status,503);
console.log('PASS: Edge staging guard, CORS, validation, CAPTCHA success/action/hostname, quota denial, no success on failed persistence. No outbound calls.');
// Transports and localization/render checks with credentials disabled.
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_ANON_KEY':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""','import.meta.env.VITE_INQUIRIES_ENABLED':'"false"'}});
try{
 const {listRequests,changeRequestStatus}=await server.ssrLoadModule('/src/features/requests/service.js');
 let range;let selection;let filter;
 const query={select:()=>query,order:()=>query,eq:()=>query,or:value=>{filter=value;return query;},range:(a,b)=>{range=[a,b];return {data:[],count:0,error:null};}};
 await listRequests({page:2,status:'new',search:'test),status.eq.new%*'},{from:()=>query});assert.deepEqual(range,[40,59]);assert(!/[()%]/.test(filter));
 await changeRequestStatus({id:'id',revision:3},'completed',{rpc:async(name,args)=>{selection={name,args};return{data:{status:'completed'}};}});assert.equal(selection.args.p_revision,3);
 await assert.rejects(()=>changeRequestStatus({id:'id',revision:3},'completed',{rpc:async()=>({error:{code:'40001'}})}),/inquiry.conflict/);
 const {default:i18n}=await server.ssrLoadModule('/src/i18n/index.js');
 const {default:Admin}=await server.ssrLoadModule('/src/features/requests/RequestsAdmin.jsx');
 const {renderToStaticMarkup}=await import('react-dom/server');const React=await import('react');
 for(const language of ['hy','en','ru']){await i18n.changeLanguage(language);assert(renderToStaticMarkup(React.createElement(Admin)).includes(i18n.t('inquiry.search')));}
 console.log('PASS: bounded pagination/search filter grammar, revision transport/conflicts, HY/EN/RU admin renders.');
}finally{await server.close();}

const publicServer=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',define:{
 'import.meta.env.VITE_SUPABASE_URL':'"https://uewihgsxrcjieghtkhjs.supabase.co"',
 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'"sb_publishable_TEST_ONLY_NOT_REAL_VALUE"',
 'import.meta.env.VITE_INQUIRIES_ENABLED':'"true"','import.meta.env.VITE_TURNSTILE_SITE_KEY':'"TEST_ONLY_NOT_REAL_KEY"',
}});
try{
 const {default:i18n}=await publicServer.ssrLoadModule('/src/i18n/index.js');
 const {Contact}=await publicServer.ssrLoadModule('/src/components/Contact/Contact.jsx');
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 for(const language of ['hy','en','ru']){
  await i18n.changeLanguage(language);const html=renderToStaticMarkup(React.createElement(Contact));
  for(const field of ['service','location','privacyConsent','message'])assert(html.includes(`name="${field}"`));
  assert(html.includes(i18n.t('inquiry.consent')) && html.includes(i18n.t('inquiry.notice')));
  assert(!html.includes(i18n.t('contact.notice')));
 }
 console.log('PASS: enabled staging Contact form in all three languages, required service/location/consent and existing design markup; CAPTCHA effects not run in SSR.');
}finally{await publicServer.close();}
