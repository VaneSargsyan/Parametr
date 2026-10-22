// Real local PostgreSQL only. No credentials, network, or hosted database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const read=path=>fs.readFileSync(path,'utf8');
const schema=read('scripts/sql/supabase-test-schema.sql');
const phase3=read('supabase/migrations/202610120001_admin_auth.sql');
const phase4=read('supabase/migrations/202610130001_projects.sql');
const inquiry=read('supabase/migrations/202610160001_customer_requests.sql');
async function snapshot(db){
 const result=[];
 for(const query of [
  'select * from public.admin_users order by user_id',
  'select * from pg_catalog.pg_default_acl order by oid',
  'select * from pg_catalog.pg_auth_members order by roleid,member',
  "select attname,attacl from pg_catalog.pg_attribute where attrelid='public.admin_users'::regclass order by attnum",
  "select polname,polcmd,polroles,pg_get_expr(polqual,polrelid) as using_expr,pg_get_expr(polwithcheck,polrelid) as check_expr from pg_catalog.pg_policy where polrelid='public.admin_users'::regclass order by polname",
 ])result.push((await db.query(query)).rows);
 return result;
}
const group='create role hardening_grantee; grant hardening_grantee to authenticated;';
const writePolicy="create policy hardening_bad_membership on public.admin_users for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());";
const cases=[
 ['direct membership column UPDATE + write policy',`grant update(role) on public.admin_users to authenticated;${writePolicy}`,/Unsafe membership privileges/],
 ['anonymous column INSERT','grant insert(user_id,role) on public.admin_users to anon;',/Unsafe membership privileges/],
 ['inherited membership column UPDATE',`${group}grant update(role) on public.admin_users to hardening_grantee;${writePolicy}`,/Unsafe membership privileges/],
 ['membership write-policy drift',writePolicy,/Unsafe membership write policy/],
 ['PUBLIC membership write-policy drift',"create policy hardening_public_write on public.admin_users for update to public using(false) with check(false);",/Unsafe membership write policy/],
 ['inherited global EXECUTE',`${group}alter default privileges grant execute on functions to hardening_grantee;`,/Unsafe inquiry function privileges/],
 ['inherited public-schema EXECUTE',`${group}alter default privileges in schema public grant execute on functions to hardening_grantee;`,/Unsafe inquiry function privileges/],
 ['inherited table ALL including TRUNCATE',`${group}alter default privileges grant all on tables to hardening_grantee;`,/Unsafe inquiry table privileges/],
 ['inherited quota SELECT',`${group}alter default privileges in schema private grant select on tables to hardening_grantee;`,/Unsafe inquiry table privileges/],
 ['anonymous inherited request SELECT','create role hardening_grantee;grant hardening_grantee to anon;alter default privileges in schema public grant select on tables to hardening_grantee;',/Unsafe anonymous inquiry read privileges/],
 ['SET ROLE reachable non-inherited EXECUTE','create role hardening_grantee;alter role authenticated noinherit;grant hardening_grantee to authenticated;alter default privileges grant execute on functions to hardening_grantee;',/Unsafe inquiry function privileges/],
];
for(const [name,setup,expected] of cases){
 const db=new PGlite();
 try{
  await db.exec(schema);await db.exec(phase3);await db.exec(setup);
  const before=await snapshot(db);
  await assert.rejects(()=>db.exec(inquiry),expected,name);
  await db.exec('rollback');
  for(const relation of ['public.customer_requests','private.inquiry_limits'])assert.equal((await db.query('select to_regclass($1) as object',[relation])).rows[0].object,null,name);
  for(const signature of ['public.inquiry_attempt()','public.submit_customer_request(uuid,text,text,jsonb)','public.set_customer_request_status(uuid,integer,text)','private.inquiry_quota(text,integer,integer)'])assert.equal((await db.query('select to_regprocedure($1) as object',[signature])).rows[0].object,null,name);
  assert.deepEqual(await snapshot(db),before,`${name}: failed migration must preserve unrelated ACLs/memberships/policies/data`);
 }finally{await db.close();}
}
for(const withPhase4 of [false,true]){
 const db=new PGlite();
 try{
  await db.exec(schema);await db.exec(phase3);if(withPhase4)await db.exec(phase4);
  await db.exec('alter default privileges grant execute on functions to anon,authenticated,service_role');
  await db.exec(inquiry);
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.exec('truncate public.customer_requests'),error=>error.code==='42501');
  await assert.rejects(()=>db.exec('select public.inquiry_attempt()'),error=>error.code==='42501');
  await assert.rejects(()=>db.query('select public.submit_customer_request($1,$2,$3,$4::jsonb)',[crypto.randomUUID(),'a'.repeat(64),'b'.repeat(64),'{}']),error=>error.code==='42501');
  await db.exec('reset role');
  // Stock application behavior: service writes, active admin reads/updates; covered in detail in check-inquiries.
  await db.exec('set role service_role');assert.equal((await db.query('select public.inquiry_attempt() as allowed')).rows[0].allowed,true);await db.exec('reset role');
  const columns=(await db.query("select attname from pg_catalog.pg_attribute where attrelid='public.customer_requests'::regclass and attnum>0 and not attisdropped order by attnum")).rows;
  await assert.rejects(()=>db.exec(inquiry),error=>error.code==='42P07');await db.exec('rollback');
  assert.deepEqual((await db.query("select attname from pg_catalog.pg_attribute where attrelid='public.customer_requests'::regclass and attnum>0 and not attisdropped order by attnum")).rows,columns);
 }finally{await db.close();}
}
console.log(`PASS: ${cases.length} fail-closed ACL/column/policy regressions with atomic rollback and unchanged external grants; Phase 3-only and Phase 3+4 compatibility, denied direct RPC/TRUNCATE, required service rights, apply-once rerun behavior.`);
