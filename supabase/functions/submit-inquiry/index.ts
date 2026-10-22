import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { catalogInquiryServices, inquiryErrors, inquiryUuid, normalizeInquiry } from '../_shared/inquiryValidation.js';
const stagingUrl='https://uewihgsxrcjieghtkhjs.supabase.co';
Deno.serve(async request => {
 const origins=(Deno.env.get('INQUIRY_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 const origin=request.headers.get('origin');
 const headers={'Access-Control-Allow-Origin':origin && origins.includes(origin)?origin:'','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,traceparent,tracestate,baggage','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
 const respond=(code:string,status:number)=>new Response(JSON.stringify({code}),{status,headers});
 if (!origin || !origins.includes(origin)) return respond('inquiry.unavailable',403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return respond('inquiry.unavailable',405);
 // Hard staging guard: no accidental production enablement through shared frontend config.
 const secret=Deno.env.get('INQUIRY_TURNSTILE_SECRET');
 const hmacSecret=Deno.env.get('INQUIRY_HMAC_SECRET');
 const hosts=(Deno.env.get('INQUIRY_CAPTCHA_HOSTNAMES')||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(Deno.env.get('SUPABASE_URL')!==stagingUrl || !secret || !hmacSecret || hmacSecret.length<32 || !hosts.length || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))return respond('inquiry.unavailable',503);
 try {
  if(!request.headers.get('content-type')?.startsWith('application/json'))return respond('inquiry.invalid',400);
  const reader=request.body?.getReader();if(!reader)return respond('inquiry.invalid',400);
  let size=0;const chunks:Uint8Array[]=[];
  const bodyTimer=setTimeout(()=>{void reader.cancel();},10000);
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>32768){await reader.cancel();return respond('inquiry.invalid',413);}chunks.push(part.value);}}finally{clearTimeout(bodyTimer);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return respond('inquiry.invalid',400);}
  const ready=Deno.env.get('INQUIRY_SERVICE_CATALOG_READY')==='true';
  const payload=normalizeInquiry(input);
  if(Object.keys(inquiryErrors(payload,ready?catalogInquiryServices:undefined)).length || !inquiryUuid.test(input?.submissionKey) || typeof input?.captchaToken!=='string' || !input.captchaToken || input.captchaToken.length>2048 || input.website)return respond('inquiry.invalid',400);
  const client=createClient(stagingUrl,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})}});
  const quota=await client.rpc('inquiry_attempt');if(quota.error)return respond('inquiry.unavailable',503);if(quota.data!==true)return respond('inquiry.rateLimited',429);
  let catalog=false;
  if(ready){
   const mode=await client.rpc('inquiry_service_catalog_enabled');
   if(mode.error || typeof mode.data!=='boolean')return respond('inquiry.unavailable',503);
   catalog=mode.data;
  }
  if(input?.catalogVersion!==undefined && (input.catalogVersion!==2 || !catalog))return respond('inquiry.unavailable',503);
  if(!catalog && Object.keys(inquiryErrors(payload)).length)return respond('inquiry.invalid',400);
  const checked=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:input.captchaToken}),signal:AbortSignal.timeout(10000)});
  if(!checked.ok)return respond('inquiry.unavailable',503);
  const proof=await checked.json();
  if(proof.success!==true || proof.action!=='customer_inquiry' || !hosts.includes(proof.hostname))return respond('inquiry.captchaError',400);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(hmacSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const saved=await client.rpc(catalog?'submit_customer_request_v2':'submit_customer_request',{p_key:input.submissionKey,p_hash:await hash(JSON.stringify(payload)),p_contact_hash:await hash(payload.phone),p_payload:payload});
  if(saved.error)return respond(saved.error.code==='23505'?'inquiry.conflict':'inquiry.unavailable',saved.error.code==='23505'?409:503);
  if(saved.data!==true)return respond('inquiry.rateLimited',429);
  return respond('inquiry.saved',200); // Only AFTER committed RPC; no customer data/UUID returned.
 }catch{return respond('inquiry.unavailable',503);}
});
