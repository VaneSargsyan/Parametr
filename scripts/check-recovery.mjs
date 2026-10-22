import assert from 'node:assert/strict';
import { createRecoveryController, parseRecoveryLink, recoveryDestination, validateRecoveryPassword } from '../src/features/admin/recovery.js';
const token = exp => `test.${Buffer.from(JSON.stringify({exp})).toString('base64url')}.signature`;
const access = token(Math.floor(Date.now()/1000)+300);
const url = new URL(`http://localhost:5173/admin/reset-password#type=recovery&access_token=${access}&refresh_token=TEST_ONLY`);
const link = parseRecoveryLink(url);
assert(link);
assert.equal(parseRecoveryLink(new URL('http://localhost:5173/admin/reset-password')),null);
for (const fragment of ['error=access_denied&type=recovery','type=signup&access_token=x&refresh_token=y',`type=recovery&access_token=${token(1)}&refresh_token=x`,`type=recovery&access_token=${access}&access_token=duplicate&refresh_token=x`]) assert.equal(parseRecoveryLink(new URL('http://localhost:5173/#'+fragment)),null);
assert(recoveryDestination(new URL('http://localhost:5173/#type=recovery&access_token=test')).startsWith('/admin/reset-password#'));
assert.equal(recoveryDestination(new URL('http://localhost:5173/#services')),null);
assert.equal(validateRecoveryPassword('short','short'),'recovery.passwordRule');
assert.equal(validateRecoveryPassword('a'.repeat(12),'different'),'recovery.mismatch');
assert.equal(validateRecoveryPassword('ա'.repeat(40),'ա'.repeat(40)),'recovery.passwordRule');
assert.equal(validateRecoveryPassword('a'.repeat(12),'a'.repeat(12)),null);
let sessions=0, updates=0, signouts=0;
const client={auth:{
 setSession:async () => {sessions++;return {data:{session:{user:{id:'verified'}}},error:null};},
 getUser:async () => ({data:{user:{id:'verified'}},error:null}),
 updateUser:async () => {updates++; return {data:{user:{id:'verified'}},error:null};},
 signOut:async () => {signouts++;return {error:null};},
}};
const controller=createRecoveryController(client);
assert.equal(await controller.update('a'.repeat(12),'a'.repeat(12)),'recovery.invalid');
assert.equal(await controller.verify(null),'recovery.invalid');assert.equal(sessions,0);
// Provider rejects /verify BEFORE the application receives tokens. Error callbacks
// must never call setSession/updateUser, even when paired with plausible credentials.
for (const callback of [
    'http://localhost:5173/#error=access_denied&error_code=otp_expired&error_description=One-time+token+not+found',
    'http://localhost:5173/admin/reset-password#error=access_denied&error_code=otp_expired',
    'http://localhost:5173/?error=access_denied&error_code=otp_expired',
    `http://localhost:5173/admin/reset-password?error=access_denied#type=recovery&access_token=${access}&refresh_token=TEST_ONLY`,
]) {
    const callbackUrl = new URL(callback);
    assert.equal(parseRecoveryLink(callbackUrl), null);
    if (callbackUrl.pathname !== '/admin/reset-password') assert(recoveryDestination(callbackUrl).startsWith('/admin/reset-password'));
    assert.equal(await controller.verify(parseRecoveryLink(callbackUrl)), 'recovery.invalid');
    assert.equal(await controller.update('a'.repeat(12),'a'.repeat(12)), 'recovery.invalid');
    assert.equal(sessions, 0, 'Rejected provider callback must not establish a recovery session');
    assert.equal(updates, 0, 'Rejected provider callback must not update a password');
}
assert.equal(await controller.verify(link),null);
assert.equal(await controller.update('a'.repeat(12),'b'.repeat(12)),'recovery.mismatch');assert.equal(updates,0);
assert.equal(await controller.update('a'.repeat(12),'a'.repeat(12)),null);assert.equal(updates,1);assert.equal(signouts,1);
assert.equal(await controller.update('a'.repeat(12),'a'.repeat(12)),'recovery.invalid');
client.auth.setSession=async()=>({data:null,error:{status:401}});
assert.equal(await controller.verify(link),'recovery.invalid');
assert.equal(await controller.update('a'.repeat(12),'a'.repeat(12)),'recovery.invalid');
assert.equal(await createRecoveryController(null).verify(link),'admin.errors.configuration');
client.auth.setSession=async()=>({data:{session:{user:{id:'verified'}}},error:null});
assert.equal(await controller.verify(link),null);
client.auth.getUser=async()=>({data:{user:{id:'other'}},error:null});
assert.equal(await controller.update('a'.repeat(12),'a'.repeat(12)),'recovery.invalid');assert.equal(updates,1);
console.log('PASS: recovery parsing/expiry/errors/duplicate tokens; root callback routing; password validation; no update without verified recovery; identity mismatch; single-use update; isolated sign-out. SDK doubles only; no real credentials or network.');

// Localized render checks with credentials disabled; effects/network never run in SSR.
const { createServer } = await import('vite');
const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { createMemoryRouter, RouterProvider } = await import('react-router-dom');
globalThis.window = { matchMedia:()=>({matches:true}), location:{href:'http://localhost:5173/admin/reset-password'} };
const server = await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_ANON_KEY':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'}});
try {
 const {default:i18n}=await server.ssrLoadModule('/src/i18n/index.js');
 const {default:Recovery}=await server.ssrLoadModule('/src/features/admin/AdminRecovery.jsx');
 for(const lang of ['hy','en','ru']) {
  await i18n.changeLanguage(lang);
  for(const reset of [false,true]) {
   const router=createMemoryRouter([{path:'*',element:React.createElement(Recovery,{reset})}],{initialEntries:[reset?'/admin/reset-password':'/admin/forgot-password']});
   try {
    const html=renderToStaticMarkup(React.createElement(RouterProvider,{router}));
    assert(html.includes(i18n.t(reset?'recovery.resetTitle':'recovery.requestTitle')));
    assert(html.includes('/admin/login'));
    if(!reset)assert(html.includes('type="email"'));
   } finally {router.dispose();}
  }
 }
 console.log('PASS: six HY/EN/RU recovery-page renders, existing admin frame/switcher, login navigation; browser effects require manual verification.');
} finally {await server.close();delete globalThis.window;}
