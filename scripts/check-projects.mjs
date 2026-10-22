import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createServer, transformWithOxc } from 'vite';
import { emptyProject, validateProject, projectPayload, moveImage, toPublicProject } from '../src/features/projects/model.js';
import { validateImage, maxImageBytes } from '../supabase/functions/_shared/imageValidation.js';
const file = (type,bytes) => ({ type,size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=','base64');
const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64');
assert.equal((await validateImage(file('image/png',png))).extension,'png');
assert.equal((await validateImage(file('image/webp',webp))).extension,'webp');
assert.equal((await validateImage(file('image/jpeg',fs.readFileSync('public/Images/Furniture.jpeg')))).extension,'jpg');
await assert.rejects(()=>validateImage(file('image/jpeg',png)));
await assert.rejects(()=>validateImage(file('image/svg+xml',png)));
await assert.rejects(()=>validateImage({ type:'image/png',size:maxImageBytes+1 }));
await assert.rejects(()=>validateImage(file('image/png',png.subarray(0,30))));
const bomb = Buffer.from(png); bomb.writeUInt32BE(100000,16);
await assert.rejects(()=>validateImage(file('image/png',bomb)));
const draft = { ...emptyProject(),slug:'test-project',title_hy:'Փորձնական նախագիծ' };
assert.equal(validateProject(draft),null);
assert.equal(validateProject({ ...draft,status:'published' }),'pm.translationsRequired');
assert.equal(validateProject({ ...draft,slug:'../invalid' }),'pm.invalid');
assert.equal(validateProject({ ...draft,category:'unknown' }),'pm.invalid');
const complete = { ...draft,cover_image_id:'cover',gallery_image_ids:['cover'],status:'published' };
for (const language of ['hy','en','ru']) for (const field of ['title','description','long_description']) complete[`${field}_${language}`]='Test';
assert.equal(validateProject(complete),null);
assert.equal(validateProject({ ...complete,cover_image_id:null }),'pm.publishRequired');
assert.equal(validateProject({ ...complete,gallery_image_ids:['cover','cover'] }),'pm.invalid');
assert(!('created_by' in projectPayload({ ...draft,created_by:'forged-user' })));
assert.deepEqual(moveImage(['a','b'],0,1),['b','a']);
assert.deepEqual(moveImage(['a','b'],0,-1),['a','b']);
const adapted = toPublicProject({ ...complete,id:'project',legacy_id:1 },new Map([['cover',{url:'https://example.invalid/signed-image'}]]));
assert.equal(adapted.title.hy,'Test'); assert.equal(adapted.legacyId,1); assert.equal(adapted.gallery.length,1);
await transformWithOxc(fs.readFileSync('supabase/functions/project-media/index.ts','utf8'),'project-media.ts');

// A fake transport tests the actual query/mutation code. It does not emulate RLS.
function transport(initialProjects) {
    const store = { projects:structuredClone(initialProjects),project_images:[{ id:'cover',project_id:'project',storage_path:'project/cover.jpg' },{ id:'draft-image',project_id:'draft',storage_path:'draft/private.jpg' }] };
    const signedPaths = [];
    const calls = [];
    const client = { store,calls,signedPaths,
        from(table) {
            let operation='read',payload,filters=[],start=0,end=Infinity,single=false;
            const query={
                select(){return query;},order(){return query;},range(a,b){start=a;end=b;return query;},
                eq(key,value){filters.push(row=>row[key]===value);return query;},
                in(key,values){filters.push(row=>values.includes(row[key]));return query;},
                insert(value){operation='insert';payload=value;return query;},
                update(value){operation='update';payload=value;return query;},
                delete(){operation='delete';return query;},
                maybeSingle(){single=true;return query;},
                then(resolve,reject){
                    calls.push({table,operation});
                    let rows=store[table].filter(row=>filters.every(filter=>filter(row)));
                    if(operation==='insert') { const row={...payload,id:'created',updated_at:'new-version'}; store[table].push(row); rows=[row]; }
                    if(operation==='update') rows.forEach(row=>Object.assign(row,payload,{updated_at:'new-version'}));
                    if(operation==='delete') store[table]=store[table].filter(row=>!rows.includes(row));
                    rows=rows.slice(start,end+1);
                    return Promise.resolve({data:single?(rows[0]||null):structuredClone(rows),error:null}).then(resolve,reject);
                },
            };return query;
        },
        storage:{from(){return {createSignedUrls:async paths=>{signedPaths.push(...paths);return {data:paths.map(path=>({path,signedUrl:`https://example.invalid/${path}`})),error:null};}};}},
    };return client;
}
const server=await createServer({ server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',define:{'import.meta.env.VITE_PROJECTS_SOURCE':'"local"','import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_ANON_KEY':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'} });
try {
    const service=await server.ssrLoadModule('/src/features/projects/service.js');
    const client=transport([{...complete,id:'project',updated_at:'original',created_at:'date'},{...draft,id:'draft',cover_image_id:'draft-image',updated_at:'draft-version',created_at:'date'}]);
    const publicRows=await service.publicProjects(client);
    assert.equal(publicRows.length,1);assert.equal(publicRows[0].id,'project');
    assert(!client.signedPaths.includes('draft/private.jpg'));
    const created=await service.saveProject(client,draft);assert.equal(created.id,'created');
    const updated=await service.saveProject(client,{...created,title_hy:'Updated'});assert.equal(updated.title_hy,'Updated');
    await assert.rejects(()=>service.saveProject(client,{...updated,updated_at:'stale',title_hy:'Do not overwrite'}),/pm.conflict/);
    assert.equal(client.store.projects.find(row=>row.id==='created').title_hy,'Updated');
    await service.deleteProject(client,updated);assert(!client.store.projects.some(row=>row.id==='created'));
    await assert.rejects(()=>service.saveProject(client,{...draft,status:'published'}),/pm.translationsRequired/);
    const {default:i18n}=await server.ssrLoadModule('/src/i18n/index.js');
    const {AuthContext}=await server.ssrLoadModule('/src/features/admin/AuthContext.js');
    const {default:ProjectsAdmin}=await server.ssrLoadModule('/src/features/projects/ProjectsAdmin.jsx');
    const actions={reload(){},signOut(){}};
    for(const language of ['hy','en','ru']) {
        await i18n.changeLanguage(language);
        for(const role of ['admin','editor']) {
            const router=createMemoryRouter([{path:'/admin/projects',element:React.createElement(AuthContext.Provider,{value:{state:{status:'authorized',role,user:{email:'test@example.invalid'}},controller:actions}},React.createElement(ProjectsAdmin))}],{initialEntries:['/admin/projects']});
            try { const html=renderToStaticMarkup(React.createElement(RouterProvider,{router}));assert(html.includes(i18n.t('pm.create')));assert(html.includes(i18n.t('pm.transition')));assert(!html.includes('[object Object]')); }
            finally {router.dispose();}
        }
    }
    console.log('PASS: image signatures/size/dimensions, multilingual project validation, publication requirements, gallery reordering, public published-only queries, CRUD transport, conflict protection, six admin-language renders, Edge TypeScript syntax.');
    console.log('RLS, Storage authorization, Edge runtime and real browser interactions require a staging Supabase project. No production credentials were used.');
} finally {await server.close();}
