import { serviceTextNonempty } from './text.js';
export const serviceKeys=['surveying','construction','design','furniture','doorsWindows','realEstate'];
export const serviceIconKeys=[...serviceKeys];
export const isCoreService=key=>serviceKeys.includes(key);
export const validServiceKey=key=>typeof key==='string' && (isCoreService(key) || (key.length<=80 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(key)));
export const serviceStatuses=['draft','published','archived'];
export function servicePayload(row) {
    return Object.fromEntries(['service_key','icon_key','sort_order','accepts_inquiries',...['hy','en','ru'].flatMap(l=>[`title_${l}`,`description_${l}`])].map(key=>[key,row[key]]));
}
export function validateService(row,publishing=row.status==='published') {
    if(!validServiceKey(row.service_key) || !serviceIconKeys.includes(row.icon_key) || !Number.isInteger(row.sort_order) || row.sort_order<0 || row.sort_order>999 || typeof row.accepts_inquiries!=='boolean')return 'sm.invalid';
    for(const language of ['hy','en','ru'])for(const field of ['title','description']){
        const value=row[`${field}_${language}`];
        if(typeof value!=='string' || Array.from(value).length>(field==='title'?200:2000) || /[<>]/u.test(value) || Array.from(value).some(c=>{const n=c.codePointAt(0);return (n>=0xd800 && n<=0xdfff) || n===127 || (n<32 && ![9,10,13].includes(n));}) || (((field==='title' && language==='hy') || publishing) && !serviceTextNonempty(value)))return 'sm.invalid';
    }
    return null;
}
export function publicService(row) {
    return {id:row.service_key,...Object.fromEntries(['title','description'].map(field=>[field,Object.fromEntries(['hy','en','ru'].map(l=>[l,row[`${field}_${l}`]]))])),iconKey:row.icon_key,acceptsInquiries:row.accepts_inquiries};
}
export function newService(key='') {
    return {service_key:key,icon_key:isCoreService(key)?key:serviceIconKeys[0],sort_order:isCoreService(key)?serviceKeys.indexOf(key):serviceKeys.length,accepts_inquiries:false,status:'draft',...Object.fromEntries(['hy','en','ru'].flatMap(l=>[[`title_${l}`, ''],[`description_${l}`, '']]))};
}
