import { useEffect,useRef,useState } from 'react';
import { useTranslation } from 'react-i18next';
let scriptPromise;
function loadTurnstile() {
    if(window.turnstile)return Promise.resolve(window.turnstile);
    if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
        script.onload=()=>resolve(window.turnstile);script.onerror=()=>{scriptPromise=null;script.remove();reject(new Error('CAPTCHA unavailable'));};document.head.appendChild(script);
    });
    return scriptPromise;
}
export default function Turnstile({siteKey,onToken,resetKey}) {
    const ref=useRef(null);const [failed,setFailed]=useState(false);const {t,i18n}=useTranslation();
    useEffect(()=>{
        let cancelled=false;let widget;let api;
        void loadTurnstile().then(loaded=>{
            if(cancelled)return;
            api=loaded;
            widget=api.render(ref.current,{sitekey:siteKey,action:'customer_inquiry',language:i18n.resolvedLanguage==='hy'?'auto':i18n.resolvedLanguage,
                callback:token=>{setFailed(false);onToken(token);},'expired-callback':()=>onToken(''),'error-callback':()=>{setFailed(true);onToken('');}});
        }).catch(()=>{if(!cancelled){setFailed(true);onToken('');}});
        return ()=>{cancelled=true;if(api && widget!==undefined)api.remove(widget);};
    },[siteKey,onToken,resetKey,i18n.resolvedLanguage]);
    return <div><div ref={ref} aria-label={t('inquiry.captchaLabel')} />{failed && <p role="alert">{t('inquiry.captchaError')}</p>}</div>;
}
