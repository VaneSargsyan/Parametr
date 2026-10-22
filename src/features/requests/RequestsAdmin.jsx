import { useEffect,useState,useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { listRequests,changeRequestStatus } from './service';
import { createRequestsController } from './requestsController';
import { inquiryStatuses } from '../../../supabase/functions/_shared/inquiryValidation';
import { services } from '../../data/services';
import { categories } from '../../data/categories';
import { localized } from '../../i18n/content';
import styles from './RequestsAdmin.module.css';
export default function RequestsAdmin() {
    const {t,i18n}=useTranslation();
    const [controller]=useState(()=>createRequestsController({list:listRequests,change:changeRequestStatus}));
    const {filter,data,loading,error,selected,busy}=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
    const [search,setSearch]=useState('');
    useEffect(()=>controller.start(),[controller]);
    const updateFilter=next=>controller.updateFilter(next);
    return <div>
        <form className={styles.filters} onSubmit={e=>{e.preventDefault();updateFilter({...filter,page:0,search});}}>
            <label>{t('inquiry.search')}<input value={search} maxLength={120} onChange={e=>setSearch(e.target.value)} /></label>
            <label>{t('inquiry.status')}<select value={filter.status} onChange={e=>updateFilter({...filter,page:0,status:e.target.value})}>
                <option value="">{t('inquiry.allStatuses')}</option>{inquiryStatuses.map(status=><option key={status} value={status}>{t(`inquiry.statuses.${status}`)}</option>)}
            </select></label><button type="submit">{t('inquiry.search')}</button><button type="button" onClick={()=>controller.reload()}>{t('admin.retry')}</button>
        </form>
        {error && <p role="alert">{t(error)}</p>}
        {loading?<p role="status">{t('pm.loading')}</p>:<>
            {!data.rows.length && <p role="status">{t('inquiry.empty')}</p>}
            <div className={styles.table}><table><caption>{t('admin.requests')}</caption><thead><tr>{['name','phone','status','created','details'].map(key=><th key={key} scope="col">{t(`inquiry.${key}`)}</th>)}</tr></thead>
                <tbody>{data.rows.map(row=><tr key={row.id}><td>{row.full_name}</td><td>{row.phone}</td><td>{t(`inquiry.statuses.${row.status}`)}</td><td>{new Date(row.created_at).toLocaleString(i18n.resolvedLanguage)}</td><td><button type="button" onClick={()=>controller.select(row)}>{t('inquiry.details')}</button></td></tr>)}</tbody></table></div>
            <div className={styles.filters}><button type="button" disabled={filter.page===0} onClick={()=>updateFilter({...filter,page:filter.page-1})}>{t('inquiry.previous')}</button><span>{filter.page+1}</span><button type="button" disabled={(filter.page+1)*20>=data.count} onClick={()=>updateFilter({...filter,page:filter.page+1})}>{t('inquiry.next')}</button></div>
        </>}
        {selected && <section className={styles.details} aria-label={t('inquiry.details')}>
            <h2>{selected.full_name}</h2>
            <dl>{[['phone',selected.phone],['email',selected.email||'—'],['service',localized(selected.service_title_snapshot||categories.find(c=>c.id===selected.requested_service)?.title||services.find(c=>c.id===selected.requested_service)?.title,i18n.resolvedLanguage)||selected.requested_service],['location',selected.location],['description',selected.description],['language',selected.language],['consentRecorded',`${new Date(selected.privacy_consent_at).toLocaleString(i18n.resolvedLanguage)} (${selected.privacy_version})`]].map(([key,value])=><div key={key}><dt>{t(`inquiry.${key}`)}</dt><dd>{value}</dd></div>)}</dl>
            <label>{t('inquiry.status')}<select value={selected.status} disabled={busy} onChange={e=>{void controller.updateStatus(e.target.value);}}>{inquiryStatuses.map(status=><option key={status} value={status}>{t(`inquiry.statuses.${status}`)}</option>)}</select></label>
            <button type="button" onClick={()=>controller.close()}>{t('inquiry.close')}</button>
        </section>}
    </div>;
}
