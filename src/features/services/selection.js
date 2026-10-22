import { serviceKeys } from './model.js';
export function preselectService(serviceKey,target=window){
    if(serviceKeys.includes(serviceKey))target.dispatchEvent(new CustomEvent('parametr-service',{detail:serviceKey}));
}
export function subscribeServiceSelection(select,target=window){
    const listener=event=>{if(serviceKeys.includes(event.detail))select(event.detail);};
    target.addEventListener('parametr-service',listener);
    return()=>target.removeEventListener('parametr-service',listener);
}
