import { useEffect,useRef,useState,useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '../admin/AuthContext';
import { createServicesController } from './servicesController';
import { listServices,changeService,servicesEnabled } from './service';
import { newService,serviceIconKeys,serviceStatuses,isCoreService } from './model';
import styles from './ServicesAdmin.module.css';
function Editor({row,admin,busy,onSave,onStatus}){
    const {t}=useTranslation();
    const [draft,setDraft]=useState(row);
    const formRef=useRef(null);
    useEffect(()=>{
        formRef.current?.focus({preventScroll:true});
        formRef.current?.scrollIntoView({block:'start'});
    },[]);
    const edit=(key,value)=>setDraft(old=>({...old,[key]:value}));
    const readOnly=!admin && row.status!=='draft';
    const dirty=JSON.stringify(draft)!==JSON.stringify(row);
    return <form ref={formRef} tabIndex={-1} aria-label={t('sm.edit')} className={styles.editor} onSubmit={e=>{e.preventDefault();onSave(draft);}}>
        <fieldset disabled={busy || readOnly}>
            <legend>{t('sm.edit')}</legend>
            <label>{t('sm.key')}<input value={draft.service_key} required maxLength={80} pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" disabled={Boolean(row.id)} onChange={e=>edit('service_key',e.target.value)} /></label>
            {!row.id && <p>{t('sm.keyHint')}</p>}
            {isCoreService(row.service_key) && <p>{t('sm.coreProtected')}</p>}
            <p>{t('sm.inquiriesInactive')}</p>
            {['hy','en','ru'].map(language=><fieldset key={language}><legend>{language.toUpperCase()}</legend><label>{t('sm.title')}<input value={draft[`title_${language}`]} maxLength={400} required={language==='hy'} onChange={e=>edit(`title_${language}`,e.target.value)} /></label><label>{t('sm.description')}<textarea value={draft[`description_${language}`]} maxLength={4000} onChange={e=>edit(`description_${language}`,e.target.value)} /></label></fieldset>)}
            <label>{t('sm.icon')}<select value={draft.icon_key} disabled={!admin} onChange={e=>edit('icon_key',e.target.value)}>{serviceIconKeys.map(key=><option key={key}>{key}</option>)}</select></label>
            <label>{t('sm.order')}<input type="number" min="0" max="999" value={draft.sort_order} disabled={!admin} onChange={e=>edit('sort_order',Number(e.target.value))} /></label>
            <label><input type="checkbox" checked={draft.accepts_inquiries} disabled={!admin} onChange={e=>edit('accepts_inquiries',e.target.checked)} />{t('sm.accepts')}</label>
            <button type="submit" disabled={busy}>{t('sm.save')}</button>
        </fieldset>
        {admin && row.id && dirty && <p role="status">{t('sm.saveFirst')}</p>}
        {admin && row.id && !isCoreService(row.service_key) && <div>{serviceStatuses.filter(status=>status!==row.status).map(status=><button key={status} type="button" disabled={busy || dirty} onClick={()=>onStatus(status)}>{t(`sm.actions.${status}`)}</button>)}</div>}
    </form>;
}
export default function ServicesAdmin(){
    const {t,i18n}=useTranslation();const {state}=useAdminAuth();
    const [controller]=useState(()=>createServicesController({list:listServices,change:changeService}));
    const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
    const {filter,data,loading,error,selected,busy,success}=snapshot;
    const [search,setSearch]=useState('');
    useEffect(()=>servicesEnabled()?controller.start():undefined,[controller]);
    if(!servicesEnabled())return <p role="status">{t('sm.disabled')}</p>;
    return <div>
        <form className={styles.filters} onSubmit={e=>{e.preventDefault();void controller.updateFilter({...filter,page:0,search});}}>
            <label>{t('sm.search')}<input value={search} maxLength={120} onChange={e=>setSearch(e.target.value)} /></label>
            <label>{t('inquiry.status')}<select value={filter.status} onChange={e=>controller.updateFilter({...filter,page:0,status:e.target.value})}><option value="">{t('inquiry.allStatuses')}</option>{serviceStatuses.map(s=><option key={s} value={s}>{t(`sm.statuses.${s}`)}</option>)}</select></label>
            <button type="submit">{t('sm.search')}</button><button type="button" onClick={()=>controller.reload()}>{t('admin.retry')}</button>{state.role==='admin' && <button type="button" onClick={()=>controller.create(newService())}>{t('sm.create')}</button>}
        </form>
        {error && <p role="alert">{t(error)}</p>}{success && <p role="status">{t('sm.saved')}</p>}
        {selected && <section><Editor key={`${selected.id||'new'}:${selected.revision??0}`} row={selected} admin={state.role==='admin'} busy={busy} onSave={row=>controller.updateStatus({type:'save',row})} onStatus={status=>controller.updateStatus({type:'status',status})} /><button type="button" onClick={()=>controller.close()}>{t('inquiry.close')}</button></section>}
        {loading?<p role="status">{t('sm.loading')}</p>:<>
            {!data.rows.length && <p role="status">{t('sm.empty')}</p>}
            <div className={styles.table}><table><caption>{t('admin.services')}</caption><thead><tr>{['title','order','status','edit'].map(k=><th key={k} scope="col">{t(k==='status'?'inquiry.status':`sm.${k}`)}</th>)}</tr></thead><tbody>{data.rows.map(row=><tr key={row.id}><td>{row[`title_${i18n.resolvedLanguage}`]||row.title_hy}{isCoreService(row.service_key) && <small> · {t('sm.core')}</small>}</td><td>{row.sort_order}</td><td>{t(`sm.statuses.${row.status}`)}</td><td><button type="button" onClick={()=>controller.select(row)}>{t('sm.edit')}</button></td></tr>)}</tbody></table></div>
            <div className={styles.filters}><button type="button" disabled={!filter.page} onClick={()=>controller.updateFilter({...filter,page:filter.page-1})}>{t('inquiry.previous')}</button><span>{filter.page+1}</span><button type="button" disabled={(filter.page+1)*10>=data.count} onClick={()=>controller.updateFilter({...filter,page:filter.page+1})}>{t('inquiry.next')}</button></div>
        </>}
    </div>;
}
