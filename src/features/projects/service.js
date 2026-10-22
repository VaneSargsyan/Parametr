import { projectPayload, toPublicProject, validateProject } from './model';
import { validateImage } from '../../../supabase/functions/_shared/imageValidation';
const bucket = 'project-images';
export function projectError(error) {
    if (error?.message?.startsWith('pm.')) return error.message;
    if (error?.status === 401 || error?.code === 'PGRST301') return 'pm.expired';
    if (error?.code === '42501' || error?.status === 403) return 'pm.denied';
    if (error?.code === '23505') return 'pm.slugExists';
    if (error?.code === '23514') return 'pm.invalid';
    return 'pm.error';
}
async function result(query) {
    let timer;
    let response;
    try { response = await Promise.race([query,new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error('pm.error')),20000); })]); }
    finally { clearTimeout(timer); }
    if (response.error) throw response.error;
    return response.data;
}
export async function listProjects(client, publishedOnly = false) {
    let query = client.from('projects').select('*').order('created_at', { ascending: false }).order('id');
    if (publishedOnly) query = query.eq('status','published');
    // Explicit ranges avoid silently truncating at the Supabase default page limit.
    const rows = [];
    for (let start = 0; ; start += 200) {
        const page = await result(query.range(start,start + 199)); rows.push(...page);
        if (page.length < 200) return rows;
    }
}
export async function imageUrls(client, records) {
    const paths = records.filter(image => image.storage_path).map(image => image.storage_path);
    const urls = new Map();
    for (let index = 0; index < paths.length; index += 100) {
        const signed = await result(client.storage.from(bucket).createSignedUrls(paths.slice(index,index+100),300));
        for (const item of signed) { if (item.error || !item.signedUrl) throw new Error('pm.error'); urls.set(item.path,item.signedUrl); }
    }
    return new Map(records.map(image => [image.id,{ ...image, url: image.legacy_path || urls.get(image.storage_path) }]));
}
export async function readImages(client, projectId) {
    return await result(client.from('project_images').select('*').eq('project_id',projectId).order('created_at'));
}
export async function publicProjects(client) {
    const rows = await listProjects(client,true);
    const ids = [...new Set(rows.flatMap(row => [row.cover_image_id,...row.gallery_image_ids]).filter(Boolean))];
    const records = [];
    for (let index = 0; index < ids.length; index += 100) records.push(...await result(client.from('project_images').select('*').in('id',ids.slice(index,index+100))));
    const images = await imageUrls(client,records);
    return rows.map(row => toPublicProject(row,images));
}
export async function saveProject(client, row) {
    row = { ...row, ...Object.fromEntries(['hy','en','ru'].map(language=>[`features_${language}`,row[`features_${language}`].map(value=>value.trim()).filter(Boolean)])) };
    const error = validateProject(row); if (error) throw new Error(error);
    const payload = projectPayload(row);
    const query = row.id ? client.from('projects').update(payload).eq('id',row.id).eq('updated_at',row.updated_at) : client.from('projects').insert(payload);
    const saved = await result(query.select('*').maybeSingle());
    if (!saved) throw new Error('pm.conflict');
    return saved;
}
export async function deleteProject(client, row) {
    const deleted = await result(client.from('projects').delete().eq('id',row.id).eq('updated_at',row.updated_at).select('id').maybeSingle());
    if (!deleted) throw new Error('pm.conflict');
}
async function invokeMedia(client, body) {
    const response = await client.functions.invoke('project-media',{ body });
    if (response.error) {
        try { const detail = await response.error.context.json(); if (['pm.expired','pm.denied','pm.invalidImage','pm.cleanupPending','pm.imageLimit'].includes(detail.error)) throw new Error(detail.error); }
        catch (error) { if (error.message?.startsWith('pm.')) throw error; }
        throw response.error;
    }
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
}
export async function uploadProjectImage(client, projectId, file) {
    await validateImage(file);
    const body = new FormData(); body.set('projectId',projectId); body.set('file',file);
    return (await invokeMedia(client,body)).image;
}
export async function discardImage(client, id) { await result(client.rpc('discard_project_image',{ image_id: id })); }
export async function cleanupProject(client, id) { await invokeMedia(client,{ action:'cleanup',projectId:id }); }
