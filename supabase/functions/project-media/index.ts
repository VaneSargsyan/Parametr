import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { registrationRecovery } from '../_shared/registrationRecovery.js';
import { validateImage, maxImageBytes } from '../_shared/imageValidation.js';

const bucket = 'project-images';
async function limitedBody(request: Request, limit: number) {
    const reader = request.body?.getReader(); if (!reader) throw new Error('pm.invalid');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > limit) { await reader.cancel(); throw new Error('pm.invalid'); } chunks.push(next.value); }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk,offset); offset += chunk.length; }
    return result;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async request => {
    const origins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
    const origin = request.headers.get('origin');
    const cors = { 'Access-Control-Allow-Origin': origin && origins.includes(origin) ? origin : '', 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    const respond = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (origin && !origins.includes(origin)) return respond({ error: 'pm.error' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return respond({ error: 'pm.error' }, 405);
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'pm.expired' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_ANON_KEY')!;
    const user = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    try {
        const identity = await user.auth.getUser(authorization.slice(7));
        if (identity.error || !identity.data.user) return respond({ error: 'pm.expired' }, 401);
        const access = await user.rpc('get_admin_context');
        if (access.error && access.error.code !== '42501') return respond({ error: 'pm.error' }, 503);
        if (access.error || !['admin','editor'].includes(access.data?.role)) return respond({ error: 'pm.denied' }, 403);
        // Service key exists ONLY in this server runtime, after verified identity/membership.
        const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
        const contentType = request.headers.get('content-type') || '';
        if (contentType.startsWith('multipart/form-data')) {
            // Stream with an absolute cap before parsing multipart; don't trust Content-Length.
            const reader = request.body?.getReader();
            if (!reader) return respond({ error: 'pm.invalidImage' }, 400);
            const chunks: Uint8Array[] = []; let size = 0;
            while (true) {
                const next = await reader.read(); if (next.done) break;
                size += next.value.length;
                if (size > maxImageBytes + 65536) { await reader.cancel(); return respond({ error: 'pm.invalidImage' }, 413); }
                chunks.push(next.value);
            }
            const bytes = new Uint8Array(size); let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
            const form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
            const projectId = String(form.get('projectId') || '');
            if (!uuid.test(projectId)) return respond({ error: 'pm.invalid' }, 400);
            const project = await user.from('projects').select('id').eq('id', projectId).single();
            if (project.error) return respond({ error: 'pm.denied' }, 403);
            const count = await service.from('project_images').select('id',{ count: 'exact', head: true }).eq('project_id',projectId);
            if (count.error) return respond({ error: 'pm.error' }, 503);
            if ((count.count || 0) >= 40) return respond({ error: 'pm.imageLimit' }, 400);
            const file = form.get('file');
            if (!(file instanceof File)) return respond({ error: 'pm.invalidImage' }, 400);
            const validated = await validateImage(file);
            const id = crypto.randomUUID(); const path = `${projectId}/${id}.${validated.extension}`;
            const upload = await service.storage.from(bucket).upload(path, validated.bytes, { contentType: validated.contentType, cacheControl: '300', upsert: false });
            if (upload.error) return respond({ error: 'pm.error' }, 503);
            const registration = await service.from('project_images').insert({ id, project_id: projectId, storage_path: path, mime_type: validated.contentType, byte_size: file.size, created_by: identity.data.user.id }).select().single();
            if (registration.error) {
                const lookup = await service.from('project_images').select('*').eq('id',id).maybeSingle();
                const recovery = registrationRecovery(registration.error,lookup,{ id, projectId, path });
                if (recovery === 'recover') return respond({ image: lookup.data });
                if (recovery === 'preserve') return respond({ error: 'pm.cleanupPending' }, 503);
                const removal = await service.storage.from(bucket).remove([path]);
                if (removal.error) await service.from('project_storage_cleanup').upsert({ storage_path: path, project_id: projectId });
                return respond({ error: 'pm.error' }, 503);
            }
            return respond({ image: registration.data });
        }
        // Cleanup processes only durable jobs whose images were detached/deleted in SQL.
        if (Number(request.headers.get('content-length') || 0) > 1024) return respond({ error: 'pm.invalid' }, 413);
        const text = new TextDecoder().decode(await limitedBody(request,1024));
        const input = JSON.parse(text);
        if (input.action !== 'cleanup' || !uuid.test(input.projectId)) return respond({ error: 'pm.invalid' }, 400);
        const project = await user.from('projects').select('id').eq('id', input.projectId).maybeSingle();
        if (!project.data && access.data.role !== 'admin') return respond({ error: 'pm.denied' }, 403);
        const jobs = await service.from('project_storage_cleanup').select('storage_path').eq('project_id', input.projectId).limit(100);
        if (jobs.error) return respond({ error: 'pm.error' }, 503);
        for (const job of jobs.data) {
            const registered = await service.from('project_images').select('id').eq('storage_path',job.storage_path).maybeSingle();
            if (registered.error || registered.data) return respond({ error: 'pm.cleanupPending' }, 503);
            const removal = await service.storage.from(bucket).remove([job.storage_path]);
            if (removal.error) return respond({ error: 'pm.cleanupPending' }, 503);
            const cleared = await service.from('project_storage_cleanup').delete().eq('storage_path', job.storage_path);
            if (cleared.error) return respond({ error: 'pm.cleanupPending' }, 503);
        }
        return respond({ ok: true });
    } catch (error) {
        return respond({ error: error instanceof Error && error.message === 'pm.invalidImage' ? 'pm.invalidImage' : 'pm.error' }, 400);
    }
});
