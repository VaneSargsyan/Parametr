import { readSupabaseConfig } from '../../lib/supabaseConfig';
import { servicePayload,validateService,publicService } from './model';
export const servicesEnabled=()=>import.meta.env.VITE_SERVICES_SOURCE==='supabase';
export const catalogInquiriesEnabled=()=>servicesEnabled() && import.meta.env.VITE_SERVICE_INQUIRIES_ENABLED==='true';
export async function servicesClient(){
    if(!servicesEnabled() || readSupabaseConfig(import.meta.env)?.url!=='https://uewihgsxrcjieghtkhjs.supabase.co')throw new Error('sm.unavailable');
    const {getSupabaseClient}=await import('../../lib/supabase');
    const client=getSupabaseClient();if(!client)throw new Error('sm.unavailable');return client;
}
async function checked(query){
    const response=await query;
    if(response.error)throw new Error(response.error.code==='40001'?'sm.conflict':response.error.code==='42501'?'sm.denied':response.error.code==='23505'?'sm.duplicate':['23514','23502','22P02'].includes(response.error.code)?'sm.invalid':'sm.unavailable');
    return response;
}
export async function listServices({page,status,search},client){
    if(!client)client=await servicesClient();
    let query=client.from('services').select('*',{count:'exact'}).order('sort_order').order('service_key');
    if(status)query=query.eq('status',status);
    const safe=search.trim().slice(0,120).replace(/[^\p{L}\p{N} .-]/gu,'');
    if(safe)query=query.or(['title_hy','title_en','title_ru'].map(f=>`${f}.ilike.*${safe}*`).join(','));
    const response=await checked(query.range(page*10,page*10+9));return {rows:response.data,count:response.count||0};
}
export async function changeService(row,action,client){
    if(!client)client=await servicesClient();
    const save=action.type==='save';
    if(!save && action.status==='published'){const error=validateService(row,true);if(error)throw new Error(error);}
    if(save){const error=validateService(action.row);if(error)throw new Error(error);}
    const response=await checked(client.rpc(save?'save_service':'set_service_status',save?{p_id:row.id||null,p_revision:row.revision??null,p_payload:servicePayload(action.row)}:{p_id:row.id,p_revision:row.revision,p_status:action.status}));
    return response.data;
}
export async function publishedServices(client){
    const rows=new Map();
    let offset=0;
    for(;;){
        const response=await checked(client.from('services').select('service_key,icon_key,title_hy,title_en,title_ru,description_hy,description_en,description_ru,accepts_inquiries,sort_order').eq('status','published').order('sort_order').order('service_key').range(offset,offset+99));
        if(!response.data.length)break;
        const before=rows.size;
        for(const row of response.data)rows.set(row.service_key,publicService(row));
        if(rows.size===before)throw new Error('sm.unavailable');
        offset+=response.data.length;
    }
    return [...rows.values()];
}
