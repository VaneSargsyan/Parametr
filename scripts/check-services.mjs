import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createServer,transformWithOxc } from 'vite';
import vm from 'node:vm';
import { createServicesController } from '../src/features/services/servicesController.js';
import { inquiryErrors,normalizeInquiry,catalogInquiryServices,inquiryUuid } from '../supabase/functions/_shared/inquiryValidation.js';
import { validateService,newService } from '../src/features/services/model.js';
const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/202610210001_services.sql');
await import('./check-services-hardening.mjs');
await import('./check-service-editor.mjs');
const bootstrap=async(db,phase4=true)=>{
 await db.exec(read('scripts/sql/supabase-test-schema.sql'));
 await db.exec(read('supabase/migrations/202610120001_admin_auth.sql'));
 if(phase4)await db.exec(read('supabase/migrations/202610130001_projects.sql'));
 await db.exec(read('supabase/migrations/202610160001_customer_requests.sql'));
};
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004'];
const db=new PGlite();
const input=normalizeInquiry({fullName:'Test person',phone:'+37455123456',email:'',service:'realEstate',location:'Test location',description:'Synthetic inquiry description',language:'hy',privacyConsent:true});
assert(inquiryErrors(input).service);assert.deepEqual(inquiryErrors(input,catalogInquiryServices),{});
try{
 await bootstrap(db);
 await db.query('select public.submit_customer_request($1,$2,$3,$4)',[crypto.randomUUID(),'a'.repeat(64),'b'.repeat(64),{...input,service:'construction'}]);
 await db.exec(migration);
 assert.equal((await db.query('select service_id,service_title_snapshot from public.customer_requests')).rows[0].service_id,null);
 await db.exec(read('supabase/import/services.sql'));
 const seeded=(await db.query('select * from public.services order by sort_order')).rows;
 assert.equal(seeded.length,6);
 for(const [i,row] of seeded.entries()){
  assert.equal(row.status,'draft');assert.equal(row.sort_order,i);assert.equal(row.service_key,row.icon_key);
  for(const l of ['hy','en','ru'])for(const field of ['title','description'])assert.equal(row[`${field}_${l}`],JSON.parse(read(`src/i18n/locales/${l}.json`)).content.services[row.service_key][field]);
 }
 await assert.rejects(()=>db.exec(read('supabase/import/services.sql')),/empty/);await db.exec('rollback');
 await assert.rejects(()=>db.exec(migration));await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from public.services')).rows[0].n,6);
 for(const [i,id] of ids.entries())await db.query('insert into auth.users values($1,$2)',[id,`service-${i}@example.invalid`]);
 await db.query("insert into public.admin_users(user_id,role,active)values($1,'admin',true),($2,'editor',true),($3,'admin',false)",[ids[0],ids[1],ids[3]]);
 const identity=async(role,id='')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);};
 const save=(row,revision=row.revision)=>db.query('select public.save_service($1,$2,$3) row',[row.id,revision,Object.fromEntries(['service_key','icon_key','sort_order','accepts_inquiries','title_hy','title_en','title_ru','description_hy','description_en','description_ru'].map(k=>[k,row[k]]))]);
 const status=(row,value)=>db.query('select public.set_service_status($1,$2,$3) row',[row.id,row.revision,value]);
 for(const [role,id] of [['anon',''],['authenticated',ids[2]],['authenticated',ids[3]]]){
  await identity(role,id);assert.equal((await db.query('select service_key from public.services')).rows.length,0);
  await assert.rejects(()=>save(seeded[0]),e=>e.code==='42501');await assert.rejects(()=>status(seeded[0],'published'),e=>e.code==='42501');
  await assert.rejects(()=>db.exec('delete from public.services'),e=>e.code==='42501');
  await assert.rejects(()=>db.exec('update public.services set revision=99'),e=>e.code==='42501');
  await assert.rejects(()=>db.exec('truncate public.services'),e=>e.code==='42501');
  await assert.rejects(()=>db.exec('select * from private.service_inquiry_config'),e=>e.code==='42501');
  await assert.rejects(()=>db.query('select public.submit_customer_request_v2($1,$2,$3,$4)',[crypto.randomUUID(),'a'.repeat(64),'b'.repeat(64),input]),e=>e.code==='42501');
 }
 await db.exec('reset role');
 await db.query('delete from public.services where id=$1',[seeded[3].id]);
 await identity('authenticated',ids[1]);
 const created=(await save({...seeded[3],id:null,revision:null})).rows[0].row;
 assert.equal(created.status,'draft');assert.equal(created.created_by,ids[1]);
 assert.equal((await db.query('select * from public.services')).rows.length,6);
 let edited=(await save({...seeded[0],title_hy:'Խմբագրված ծառայություն'})).rows[0].row;assert.equal(edited.revision,1);
 for(const patch of [{sort_order:7},{icon_key:'design'},{accepts_inquiries:false}])await assert.rejects(()=>save({...edited,...patch}),e=>e.code==='42501');
 await assert.rejects(()=>status(edited,'published'),e=>e.code==='42501');
 await assert.rejects(()=>save(seeded[0]),e=>e.code==='40001');
 await identity('authenticated',ids[0]);
 const parallel=await Promise.allSettled([save({...seeded[1],title_hy:'First edit'}),save({...seeded[1],title_hy:'Second edit'})]);
 assert.equal(parallel.filter(r=>r.status==='fulfilled').length,1);assert.equal(parallel.find(r=>r.status==='rejected').reason.code,'40001');
 await assert.rejects(()=>save({...edited,title_en:'<script>x</script>'}),e=>e.code==='23514');
 edited=(await save({...edited,title_en:''})).rows[0].row;
 await assert.rejects(()=>status(edited,'published'),e=>e.code==='23514');
 edited=(await save({...edited,title_en:'😀'.repeat(200)})).rows[0].row;
 await assert.rejects(()=>save({...edited,title_en:'😀'.repeat(201)}),e=>e.code==='23514');
 assert.equal(validateService({...edited,title_en:'😀'.repeat(200)}),null);assert.equal(validateService({...edited,title_en:'😀'.repeat(201)}),'sm.invalid');
 edited=(await status(edited,'published')).rows[0].row;
 await identity('authenticated',ids[1]);await assert.rejects(()=>save(edited),e=>e.code==='42501');
 await identity('anon');assert.equal((await db.query('select service_key from public.services')).rows.length,1);
 await identity('authenticated',ids[0]);
 let realEstate=(await status(seeded[5],'published')).rows[0].row;
 await db.exec('reset role');await db.exec('update private.service_inquiry_config set enabled=true');
 const submit=(key,hash='d'.repeat(64),payload=input)=>db.query('select public.submit_customer_request_v2($1,$2,$3,$4) saved',[key,hash,'c'.repeat(64),payload]);
 await identity('service_role');
 await assert.rejects(()=>db.query('select public.submit_customer_request($1,$2,$3,$4)',[crypto.randomUUID(),'a'.repeat(64),'b'.repeat(64),{...input,service:'construction'}]),e=>e.code==='55000');
 await db.exec('reset role');
 const quotaHits=async()=>Number((await db.query("select coalesce(sum(hits),0)::int hits from private.inquiry_limits where bucket=$1",['contact:'+'c'.repeat(64)])).rows[0].hits);
 const before=await quotaHits();
 await identity('service_role');
 const key=crypto.randomUUID();assert.equal((await submit(key)).rows[0].saved,true);
 await db.exec('reset role');assert.equal(await quotaHits(),before+1);
 await identity('service_role');await submit(key);
 await db.exec('reset role');assert.equal(await quotaHits(),before+1);
 await identity('service_role');
 await assert.rejects(()=>submit(crypto.randomUUID(),'d'.repeat(64),{...input,service:'design'}),e=>e.code==='23514');
 const saved=(await db.query('select * from public.customer_requests where submission_key=$1',[key])).rows[0];
 assert.equal(saved.service_id,realEstate.id);assert.equal(saved.service_title_snapshot.hy,realEstate.title_hy);
 await identity('authenticated',ids[0]);
 realEstate=(await status(realEstate,'archived')).rows[0].row;
 await identity('service_role');assert.equal((await submit(key)).rows[0].saved,true);
 await assert.rejects(()=>submit(key,'e'.repeat(64)),e=>e.code==='23505');
 await assert.rejects(()=>submit(crypto.randomUUID()),e=>e.code==='23514');
 await db.exec('reset role');
 assert.equal((await db.query("select hits from private.inquiry_limits where bucket=$1",['contact:'+'c'.repeat(64)])).rows[0].hits,1);
 await identity('authenticated',ids[0]);
 realEstate=(await status(realEstate,'published')).rows[0].row;
 realEstate=(await save({...realEstate,accepts_inquiries:false})).rows[0].row;
 await identity('service_role');await assert.rejects(()=>submit(crypto.randomUUID()),e=>e.code==='23514');
 await db.exec('reset role');await db.query('update public.admin_users set active=false where user_id=$1',[ids[0]]);
 await identity('authenticated',ids[0]);await assert.rejects(()=>status(realEstate,'published'),e=>e.code==='42501');
 assert.equal((await db.query("select * from public.services where status='draft'")).rows.length,0);
 await db.exec('reset role');
 assert.equal((await db.query('select service_title_snapshot from public.customer_requests where submission_key=$1',[key])).rows[0].service_title_snapshot.hy,saved.service_title_snapshot.hy);
 const lockRows=(await db.query("select pg_get_functiondef('public.submit_customer_request_v2(uuid,text,text,jsonb)'::regprocedure) def")).rows[0].def;
 assert(lockRows.includes('for share'));assert(lockRows.indexOf('if found then')<lockRows.indexOf('from public.services'));assert.equal((lockRows.match(/for share/g)||[]).length,2);
 console.log('PASS: exact six-service draft import; create-once collision rollback; roles/RLS/direct writes; editor settings/publication denial; admin publish completeness; Unicode/HTML rejection; stale revision; revoked access; real estate persistence/snapshot; legacy preservation; archived retry idempotency/conflict; availability gate; row-lock contract.');
}finally{await db.close();}
for(const unsafe of [
 'create role inherited_service; grant inherited_service to authenticated; alter default privileges in schema public grant all on tables to inherited_service',
 'create role inherited_service; grant inherited_service to anon; alter default privileges in schema public grant execute on functions to inherited_service',
 "grant update(role) on public.admin_users to authenticated; create policy escalation on public.admin_users for update to authenticated using(true) with check(true)",
 'grant create on schema private to authenticated'
]){
 const d=new PGlite();try{await bootstrap(d,false);await d.exec(unsafe);await assert.rejects(()=>d.exec(migration));await d.exec('rollback');assert.equal((await d.query("select to_regclass('public.services') n")).rows[0].n,null);}finally{await d.close();}
}
console.log('PASS: inherited table/function grants, column membership escalation and schema CREATE abort migration atomically.');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
for(const fails of [false,true]){
 const pending=deferred();const row={id:'a',revision:0,status:'draft'};
 const c=createServicesController({list:async()=>({rows:[row],count:1}),change:()=>pending.promise});
 const stop=c.start();await new Promise(r=>setTimeout(r,0));c.select(row);const mutation=c.updateStatus({type:'save',row});c.close();c.create(newService());
 if(fails)pending.reject(new Error('sm.conflict'));else pending.resolve({...row,revision:1});await mutation;
 assert.equal(c.getSnapshot().selected.id,undefined);assert.equal(c.getSnapshot().error,null);assert.equal(c.getSnapshot().busy,false);stop();
}
console.log('PASS: obsolete save success/error cannot replace a newly opened draft or restore stale busy/error state.');
let handler;const calls=[];
const env={SUPABASE_URL:'https://uewihgsxrcjieghtkhjs.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'TEST_ONLY',INQUIRY_ALLOWED_ORIGINS:'http://localhost:5173',INQUIRY_TURNSTILE_SECRET:'TEST_ONLY',INQUIRY_HMAC_SECRET:'TEST_ONLY'.repeat(5),INQUIRY_CAPTCHA_HOSTNAMES:'localhost',INQUIRY_SERVICE_CATALOG_READY:'true'};
const code=await transformWithOxc(read('supabase/functions/submit-inquiry/index.ts').replace(/^import .*;\n/gm,''),'inquiry.ts');
vm.runInNewContext(code.code,{Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn;}},Response,Request,Uint8Array,TextDecoder,TextEncoder,AbortSignal,setTimeout,clearTimeout,crypto,normalizeInquiry,inquiryErrors,catalogInquiryServices,inquiryUuid,fetch:async()=>new Response(JSON.stringify({success:true,action:'customer_inquiry',hostname:'localhost'})),createClient:()=>({rpc:async(name)=>{calls.push(name);return{data:true,error:null};}})});
const request=payload=>new Request('http://test.invalid',{method:'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify(payload)});
const body={...input,submissionKey:crypto.randomUUID(),captchaToken:'TEST_ONLY',catalogVersion:2};
assert.equal((await handler(request(body))).status,200);assert(calls.includes('submit_customer_request_v2'));assert(!calls.includes('submit_customer_request'));
assert.equal((await handler(request({...body,catalogVersion:undefined}))).status,200);
env.INQUIRY_SERVICE_CATALOG_READY='false';assert.equal((await handler(request({...body,service:'construction'}))).status,503);
console.log('PASS: actual Edge handler real estate catalog routing and fail-closed version mismatch with synthetic local doubles.');
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',define:{'import.meta.env.VITE_SERVICES_SOURCE':'"local"','import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_INQUIRIES_ENABLED':'"false"'}});
try{
 const {default:i18n}=await server.ssrLoadModule('/src/i18n/index.js');const {Services}=await server.ssrLoadModule('/src/components/Services/Services.jsx');
 const {renderToStaticMarkup}=await import('react-dom/server');const React=await import('react');
 for(const language of ['hy','en','ru']){await i18n.changeLanguage(language);const html=renderToStaticMarkup(React.createElement(Services));assert.equal((html.match(/<article /g)||[]).length,6);assert(html.includes(i18n.t('content.services.realEstate.title')));}
 console.log('PASS: static-off-by-default homepage six-service HY/EN/RU rendering.');
}finally{await server.close();}
const {preselectService,subscribeServiceSelection}=await import('../src/features/services/selection.js');
const target=new EventTarget();const selections=[];const unsubscribe=subscribeServiceSelection(key=>selections.push(key),target);
preselectService('realEstate',target);preselectService('unknown',target);unsubscribe();preselectService('design',target);assert.deepEqual(selections,['realEstate']);
console.log('PASS: real estate CTA selection, unknown service rejection and listener cleanup.');
const remoteServer=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',define:{'import.meta.env.VITE_SERVICES_SOURCE':'"supabase"','import.meta.env.VITE_SERVICE_INQUIRIES_ENABLED':'"true"','import.meta.env.VITE_SUPABASE_URL':'"https://uewihgsxrcjieghtkhjs.supabase.co"','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'"sb_publishable_TEST_ONLY"','import.meta.env.VITE_INQUIRIES_ENABLED':'"true"','import.meta.env.VITE_TURNSTILE_SITE_KEY':'"TEST_ONLY"'}});
try{
 const {default:i18n}=await remoteServer.ssrLoadModule('/src/i18n/index.js');
 const {AuthContext}=await remoteServer.ssrLoadModule('/src/features/admin/AuthContext.js');
 const {default:Admin}=await remoteServer.ssrLoadModule('/src/features/services/ServicesAdmin.jsx');
 const {Contact}=await remoteServer.ssrLoadModule('/src/components/Contact/Contact.jsx');
 const {Services}=await remoteServer.ssrLoadModule('/src/components/Services/Services.jsx');
 const {renderToStaticMarkup}=await import('react-dom/server');const React=await import('react');
 for(const language of ['hy','en','ru']){
  await i18n.changeLanguage(language);
  for(const role of ['admin','editor']){
   const html=renderToStaticMarkup(React.createElement(AuthContext.Provider,{value:{state:{role},controller:{}}},React.createElement(Admin)));
   assert(html.includes(i18n.t('sm.loading')));assert.equal(html.includes(i18n.t('sm.create')),role==='admin');
  }
  const html=renderToStaticMarkup(React.createElement(Contact));assert(html.includes(i18n.t('sm.loading')));assert(html.includes('name="service"'));
  const publicHtml=renderToStaticMarkup(React.createElement(Services));assert(publicHtml.includes(i18n.t('sm.loading')));assert(!publicHtml.includes('<article '));
 }
 const {publishedServices,listServices,changeService}=await remoteServer.ssrLoadModule('/src/features/services/service.js');
 const events=[];const query={select:(...x)=>{events.push(['select',...x]);return query;},order:(x)=>{events.push(['order',x]);return query;},eq:(...x)=>{events.push(['eq',...x]);return query;},or:(x)=>{events.push(['or',x]);return query;},range:(...x)=>{events.push(['range',...x]);return query;},then:(resolve)=>resolve({data:[],count:0,error:null})};
 await publishedServices({from:()=>query});assert(events.some(x=>x[0]==='eq' && x[1]==='status' && x[2]==='published'));assert(events.some(x=>x[0]==='order' && x[1]==='sort_order'));
 await listServices({page:2,status:'draft',search:'x),status.eq.published%*'},{from:()=>query});assert(events.some(x=>x[0]==='range' && x[1]===20 && x[2]===29));assert(!/[()%*]/.test(events.find(x=>x[0]==='or')[1].replace(/\*/g,'')));
 await assert.rejects(()=>changeService({id:'test',revision:1},{type:'status',status:'draft'},{rpc:async()=>({error:{code:'40001'}})}),/sm.conflict/);
 query.then=resolve=>resolve({error:{code:'network'}});
 await assert.rejects(()=>publishedServices({from:()=>query}),/sm.unavailable/);
 console.log('PASS: nine enabled HY/EN/RU CMS/contact renders; no static fallback; published/order filters; pagination/search transport; localized stale revision and public failure. No effects/network executed.');
}finally{await remoteServer.close();}
{
 const first=deferred();const second=deferred();let n=0;
 const controller=createServicesController({list:()=>++n===1?first.promise:second.promise,change:async()=>({})});
 const stop=controller.start();const refresh=controller.reload();
 second.resolve({rows:[{id:'new',service_key:'design',sort_order:0}],count:1});await refresh;
 first.resolve({rows:[{id:'old',service_key:'construction',sort_order:1}],count:1});await Promise.resolve();await Promise.resolve();
 assert.equal(controller.getSnapshot().data.rows[0].id,'new');stop();
 const pending=deferred();const row={id:'same',service_key:'design',status:'draft',sort_order:0};
 const c=createServicesController({list:async()=>({rows:[row],count:1}),change:()=>pending.promise});
 const cleanup=c.start();await new Promise(r=>setTimeout(r,0));c.select(row);const action=c.updateStatus({type:'save',row});cleanup();const before=c.getSnapshot();pending.resolve({...row,revision:2});await action;assert.equal(c.getSnapshot(),before);
}
console.log('PASS: newest Services list wins and pending saves cannot update an unmounted controller.');
{
 const row={id:'published',service_key:'design',sort_order:0,status:'published',title_hy:'Test'};
 const controller=createServicesController({list:async()=>({rows:[row],count:1}),change:async(item,action)=>({...item,id:item.id||'new',status:action.status})});
 const stop=controller.start();await new Promise(r=>setTimeout(r,0));await controller.updateFilter({page:0,status:'published',search:''});
 controller.select(row);await controller.updateStatus({status:'draft'});assert.equal(controller.getSnapshot().data.count,0);
 await controller.updateStatus({status:'published'});assert.equal(controller.getSnapshot().data.count,1);assert.equal(controller.getSnapshot().data.rows.length,1);
 controller.create(newService());await controller.updateStatus({status:'draft'});assert.equal(controller.getSnapshot().data.count,1);stop();
}
console.log('PASS: status-filter totals remain correct on unpublish, republish and draft creation.');

await import('./check-dynamic-services.mjs');

await import('./check-services-pagination.mjs');
