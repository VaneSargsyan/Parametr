import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { registrationRecovery } from '../supabase/functions/_shared/registrationRecovery.js';

const read = path => fs.readFileSync(path,'utf8');
const setup = read('scripts/sql/supabase-test-schema.sql');
const auth = read('supabase/migrations/202610120001_admin_auth.sql');
const projects = read('supabase/migrations/202610130001_projects.sql');
const hostedSql = read('supabase/tests/projects_security_hosted.sql');
assert(!/(?:insert\s+into|update|delete\s+from|alter\s+table|truncate(?:\s+table)?)\s+storage\./i.test(hostedSql), 'Hosted suite must not mutate Storage');
const expected={id:'image',projectId:'project',path:'project/image.jpg'};
const row={id:'image',project_id:'project',storage_path:'project/image.jpg'};
for (const code of ['23502','23503','23505','23514','42501']) {
    assert.equal(registrationRecovery({code},{data:null,error:null},expected),'remove');
    assert.equal(registrationRecovery({code},{data:row,error:null},expected),'recover');
    assert.equal(registrationRecovery({code},{data:row,error:{code:'network'}},expected),'preserve');
}
assert.equal(registrationRecovery({code:''},{data:null,error:null},expected),'preserve');
assert.equal(registrationRecovery({code:'timeout'},{data:null,error:null},expected),'preserve');
assert.equal(registrationRecovery({code:'23514'},{data:null,error:{code:'network'}},expected),'preserve');
assert.equal(registrationRecovery({code:''},{data:row,error:null},expected),'recover');
assert.equal(registrationRecovery({code:'23505'},{data:{...row,storage_path:'different/path'},error:null},expected),'preserve');

// Independently verify Phase 3-only SQL Editor compatibility and rollback isolation.
{
    const db = new PGlite();
    try {
        await db.exec(setup);
        await db.exec(auth);
        await db.exec(read('supabase/tests/admin_auth.sql'));
        assert.equal((await db.query('select count(*)::integer as count from auth.users')).rows[0].count, 0);
        assert.equal((await db.query('select count(*)::integer as count from public.admin_users')).rows[0].count, 0);
        assert.equal((await db.query('select current_user as role')).rows[0].role, 'postgres');
        await db.exec("insert into auth.users(id,email)values('10000000-0000-4000-8000-000000000001','existing@example.invalid')");
        await assert.rejects(() => db.exec(read('supabase/tests/admin_auth.sql')), /fixture collision/);
        await db.exec('rollback');
        assert.equal((await db.query('select email from auth.users')).rows[0].email, 'existing@example.invalid');
        console.log('PASS: Phase 3-only admin suite; fixture/role rollback; collision rejects without changing existing identity.');
    } finally { await db.close(); }
}

const fixtureTables = ['auth.users','public.admin_users','public.projects','public.project_images','public.project_gallery_links','public.project_storage_cleanup','storage.objects'];
async function snapshot(db) {
    const rows = [];
    for (const table of fixtureTables) rows.push((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as data from ${table} t`)).rows[0].data);
    return rows;
}
let suites=0;
for(const broadDefaults of [false,true]) {
    const db=new PGlite();
    try {
        await db.exec(setup);
        if(broadDefaults) await db.exec('alter default privileges grant execute on functions to anon,authenticated,service_role;');
        await db.exec(auth);
        // Test a pre-existing direct CREATE grant: migration must revoke it.
        await db.exec('grant create on schema private to authenticated;');
        await db.exec(projects);
        // Exercise service-role invoker trigger rights BEFORE owner fixtures warm plans.
        await db.exec("begin;set local role service_role;insert into public.projects(slug,category,title_hy)values('audit-cold-service','construction','Cold service trigger');rollback;");
        await db.exec("insert into auth.users(id,email)values('90000000-0000-4000-8000-000000000099','unrelated@example.invalid');insert into public.projects(slug,category,title_hy)values('unrelated-existing-draft','design','Preserve existing content')");
        for(const path of ['supabase/tests/admin_auth.sql','supabase/tests/projects.sql','supabase/tests/projects_security.sql','supabase/tests/projects_security_hosted.sql']) {
            try {
                const before = await snapshot(db);
                await db.exec(read(path)); suites++;
                assert.deepEqual(await snapshot(db), before, `${path}: rollback changed existing rows`);
                assert.equal((await db.query('select current_user as role')).rows[0].role, 'postgres');
            }
            catch(error) { await db.exec('rollback'); throw new Error(`${path} (${broadDefaults?'global':'schema'} defaults): ${error.code}: ${error.message}`,{cause:error}); }
        }
        await db.exec("delete from public.projects where slug='unrelated-existing-draft';delete from auth.users where id='90000000-0000-4000-8000-000000000099'");
        // Import is actually executed twice, proving skips and no overwrites.
        const importSql=read('supabase/import/legacy_projects.sql');
        await db.exec(importSql);
        const first=await db.query('select id,legacy_id,slug,status,title_hy,gallery_image_ids from public.projects order by legacy_id');
        assert.equal(first.rows.length,5);
        assert(first.rows.every(row=>row.status==='draft'));
        await db.exec(importSql);
        assert.deepEqual((await db.query('select id,legacy_id,slug,status,title_hy,gallery_image_ids from public.projects order by legacy_id')).rows,first.rows);
        console.log(`PASS: Phase 3 + Phase 4 migrations, four SQL security suites, repeat-safe draft import (${broadDefaults?'hostile global':'Supabase-style public-schema'} default grants).`);
    } finally {await db.close();}
}
// Hosted-safe project suite must reject each collision without touching existing data.
const collisions = [
    ['Auth UUID', "insert into auth.users(id,email)values('60000000-0000-4000-8000-000000000001','preserve@example.invalid')"],
    ['Auth email', "insert into auth.users(id,email)values(gen_random_uuid(),'project-editor@example.invalid')"],
    ['Project slug', "insert into public.projects(slug,category,title_hy)values('editor-created-test','design','Preserve')"],
    ['Image UUID', "insert into public.projects(id,slug,category,title_hy)values('90000000-0000-4000-8000-000000000001','collision-parent','design','Preserve');insert into public.project_images(id,project_id,legacy_path)values('80000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','/Images/Furniture.jpeg')"],
    ['Storage path', "insert into storage.objects(bucket_id,name)values('project-images','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000001.jpg')"],
    ['Cleanup job', "insert into public.project_storage_cleanup(project_id,storage_path)values('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000003.jpg')"],
];
for (const [name, sql] of collisions) {
    const db = new PGlite();
    try {
        await db.exec(setup); await db.exec(auth); await db.exec(projects);
        await db.exec(sql); // Stand-in schemas only; never hosted Storage writes.
        const before = await snapshot(db);
        for (const path of ['supabase/tests/projects.sql','supabase/tests/projects_security_hosted.sql']) {
            await assert.rejects(() => db.exec(read(path)), /fixture collision/, `${path}: ${name}`);
            await db.exec('rollback');
            assert.deepEqual(await snapshot(db), before, `${path}: ${name}: collision changed existing data`);
        }
    } finally { await db.close(); }
}
// Ensure negative authorization assertions detect deliberate policy regressions.
for (const [sql, message] of [
    ["create policy audit_bad_editor_delete on public.projects for delete to authenticated using(private.has_staff_role(array['editor']))", /Editor delete allowed/],
    ['drop policy "admin project delete" on public.projects', /Admin delete failed/],
]) {
    const db = new PGlite();
    try {
        await db.exec(setup); await db.exec(auth); await db.exec(projects); await db.exec(sql);
        await assert.rejects(() => db.exec(read('supabase/tests/projects.sql')), message);
        await db.exec('rollback');
    } finally { await db.close(); }
}
// Hosted extended assertions must detect both ACL exposure and weakened image invariants.
for (const [sql, message] of [
    ['grant execute on function private.queue_project_file() to authenticated', /Unexpected trigger EXECUTE/],
    ['alter table public.project_images disable trigger immutable_project_image', /Registry can be rewritten/],
]) {
    const db = new PGlite();
    try {
        await db.exec(setup); await db.exec(auth); await db.exec(projects); await db.exec(sql);
        await assert.rejects(() => db.exec(read('supabase/tests/projects_security_hosted.sql')), message);
        await db.exec('rollback');
    } finally { await db.close(); }
}
console.log('PASS: all suite rollback snapshots; six collision cases against both hosted-safe suites; deliberate authorization/ACL/image regressions detected.');
const unsafe=[
    {name:'missing Phase 3',sql:null},
    {name:'wrong helper owner',sql:'alter function private.has_staff_role(text[]) owner to authenticated;'},
    {name:'unsafe helper search path',sql:"alter function private.has_staff_role(text[]) set search_path='public';"},
    {name:'invoker helper',sql:'alter function private.has_staff_role(text[]) security invoker;'},
    {name:'disabled membership RLS',sql:'alter table public.admin_users disable row level security;'},
    {name:'inherited private CREATE',sql:'create role audit_writer;grant create on schema private to audit_writer;grant audit_writer to authenticated;'},
    {name:'privileged role inheritance',sql:'grant service_role to authenticated;'},
];
for(const scenario of unsafe) {
    const db=new PGlite();
    try {
        await db.exec(setup);
        if(scenario.sql) {await db.exec(auth);await db.exec(scenario.sql);}
        await assert.rejects(()=>db.exec(projects),undefined,scenario.name);
        await db.exec('rollback');
        assert.equal((await db.query("select to_regclass('public.projects') as relation")).rows[0].relation,null,'Preflight failure must leave no partial projects schema');
    } finally {await db.close();}
}
console.log(`PASS: ${suites} real PostgreSQL SQL suites; seven fail-closed preflight scenarios; upload-registration recovery decisions.`);
console.log('Engine: embedded PostgreSQL 18 (PGlite); auth/storage schemas are minimal stand-ins. Hosted Supabase/PostgREST/Storage HTTP and multi-connection concurrency remain staging checks. No credentials or network databases used.');
