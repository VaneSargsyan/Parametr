import { readSupabaseConfig } from '../../lib/supabaseConfig';
export function inquiryConfiguration(env=import.meta.env) {
    const config=readSupabaseConfig(env);
    return env.VITE_INQUIRIES_ENABLED==='true' && config?.url==='https://uewihgsxrcjieghtkhjs.supabase.co' && env.VITE_TURNSTILE_SITE_KEY ? {...config,siteKey:env.VITE_TURNSTILE_SITE_KEY} : null;
}
export async function submitInquiry(config,payload) {
    const response=await fetch(`${config.url}/functions/v1/submit-inquiry`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
    const result=await response.json();
    if(!response.ok || result.code!=='inquiry.saved')throw new Error(['inquiry.rateLimited','inquiry.captchaError','inquiry.invalid','inquiry.conflict'].includes(result.code)?result.code:'inquiry.unavailable');
}
async function adminClient() {
    const config=readSupabaseConfig(import.meta.env);
    if(config?.url!=='https://uewihgsxrcjieghtkhjs.supabase.co')return null;
    return (await import('../../lib/supabase')).getSupabaseClient();
}
const baseFields='id,full_name,phone,email,requested_service,location,description,language,privacy_consent_at,privacy_version,status,revision,created_at,updated_at,updated_by';
export async function listRequests({page,status,search},client) {
    if(client===undefined)client=await adminClient();
    if(!client)throw new Error('inquiry.unavailable');
    const fields=import.meta.env.VITE_SERVICE_INQUIRIES_ENABLED==='true'?baseFields+',service_id,service_title_snapshot':baseFields;
    let query=client.from('customer_requests').select(fields,{count:'exact'}).order('created_at',{ascending:false}).order('id');
    if(status)query=query.eq('status',status);
    // A fixed character allowlist prevents PostgREST filter-grammar injection.
    const safe=search.trim().slice(0,120).replace(/[^\p{L}\p{N} @+.-]/gu,'');
    if(safe)query=query.or(['full_name','phone','email'].map(field=>`${field}.ilike.*${safe}*`).join(','));
    const response=await query.range(page*20,page*20+19);
    if(response.error)throw new Error('inquiry.unavailable');
    return {rows:response.data,count:response.count||0};
}
export async function changeRequestStatus(row,status,client) {
    if(client===undefined)client=await adminClient();
    if(!client)throw new Error('inquiry.unavailable');
    const response=await client.rpc('set_customer_request_status',{p_id:row.id,p_revision:row.revision,p_status:status});
    if(response.error)throw new Error(response.error.code==='40001'?'inquiry.conflict':'inquiry.unavailable');
    return response.data;
}
