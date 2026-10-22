import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router-dom';
import { useAdminAuth } from '../admin/AuthContext';
import { getSupabaseClient } from '../../lib/supabase';
import { categories } from '../../data/categories';
import { localized } from '../../i18n/content';
import { emptyProject, languages, moveImage } from './model';
import { cleanupProject, deleteProject, discardImage, imageUrls, listProjects, projectError, readImages, saveProject, uploadProjectImage } from './service';
import { validateImage } from '../../../supabase/functions/_shared/imageValidation';
import styles from './ProjectsAdmin.module.css';

export default function ProjectsAdmin() {
    const { t, i18n } = useTranslation();
    const { state, controller } = useAdminAuth();
    const client = getSupabaseClient();
    const [rows,setRows] = useState([]);
    const [loading,setLoading] = useState(Boolean(client));
    const [error,setError] = useState(client ? null : 'admin.errors.configuration');
    const [notice,setNotice] = useState(null);
    const [busy,setBusy] = useState(false);
    const [draft,setDraft] = useState(null);
    const [images,setImages] = useState(new Map());
    const [dirty,setDirty] = useState(false);
    const [language,setLanguage] = useState('hy');
    const [search,setSearch] = useState('');
    const [category,setCategory] = useState('all');
    const [status,setStatus] = useState('all');
    const [confirmation,setConfirmation] = useState(null);
    const [cleanupId,setCleanupId] = useState(null);
    const imageGeneration = useRef(0);
    const blocker = useBlocker(dirty);
    useEffect(() => () => { imageGeneration.current++; }, []);
    const failure = useCallback(cause => {
        const key = projectError(cause); setError(key);
        if (['pm.expired','pm.denied'].includes(key)) void controller.reload();
    },[controller]);
    const reload = useCallback(async () => {
        if (!client) return;
        setLoading(true);
        try { setRows(await listProjects(client)); } catch (cause) { failure(cause); }
        finally { setLoading(false); }
    },[client,failure]);
    useEffect(() => {
        if (!client) return;
        let active = true;
        listProjects(client).then(data => { if (active) setRows(data); })
            .catch(cause => { if (active) failure(cause); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    },[client,failure]);
    useEffect(() => {
        const handler = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload',handler);
        return () => { window.removeEventListener('beforeunload',handler); };
    },[dirty]);
    const loadImages = async row => {
        const generation = ++imageGeneration.current;
        const records = await readImages(client,row.id);
        const next = await imageUrls(client,records);
        if (generation === imageGeneration.current) setImages(next);
    };
    const edit = async row => {
        if (dirty) { setConfirmation({ type:'switch',row }); return; }
        setError(null); setNotice(null); setBusy(true); setImages(new Map());
        try { if (row.id) await loadImages(row); setDraft(structuredClone(row)); setDirty(false); }
        catch (cause) { failure(cause); }
        finally { setBusy(false); }
    };
    const change = (field,value) => { setDraft(current => ({ ...current,[field]:value })); setDirty(true); setNotice(null); };
    const performSave = async nextStatus => {
        if (!draft || busy) return;
        setBusy(true); setError(null); setNotice(null);
        try {
            const saved = await saveProject(client,{ ...draft,status:nextStatus });
            setDraft(saved); setDirty(false); setRows(current => [saved,...current.filter(row => row.id !== saved.id)]); setNotice('pm.saved');
        } catch (cause) { failure(cause); }
        finally { setBusy(false); }
    };
    const runCleanup = async id => {
        try { await cleanupProject(client,id); setCleanupId(null); }
        catch { setCleanupId(id); setNotice('pm.cleanupPending'); }
    };
    const confirm = async () => {
        const action = confirmation; setConfirmation(null);
        if (action.type === 'switch') { setDirty(false); setError(null); setBusy(true); try { setImages(new Map()); if (action.row.id) await loadImages(action.row); setDraft(structuredClone(action.row)); } catch (cause) { failure(cause); } finally { setBusy(false); } return; }
        setBusy(true); setError(null);
        try {
            if (action.type === 'delete') {
                await deleteProject(client,action.row);
                setRows(current => current.filter(row => row.id !== action.row.id));
                if (draft?.id === action.row.id) { setDraft(null); setDirty(false); setImages(new Map()); }
                setNotice('pm.deleted'); await runCleanup(action.row.id);
            } else if (action.type === 'discard') {
                await discardImage(client,action.id); setImages(current => { const next=new Map(current); next.delete(action.id); return next; });
                await runCleanup(draft.id);
            }
        } catch (cause) { failure(cause); }
        finally { setBusy(false); }
    };
    const upload = async event => {
        const files = [...event.target.files]; event.target.value = '';
        if (!draft?.id || !files.length || busy) return;
        if (files.length > 30 || images.size + files.length > 40) { setError('pm.imageLimit'); return; }
        setBusy(true); setError(null);
        try {
            // Validate the whole selection before uploading any file.
            for (const file of files) await validateImage(file);
            for (const file of files) {
                const record = await uploadProjectImage(client,draft.id,file);
                const signed = await imageUrls(client,[record]);
                setImages(current => new Map([...current,...signed]));
            }
            setNotice('pm.uploaded');
        } catch (cause) { failure(cause); }
        finally { setBusy(false); }
    };
    const visible = rows.filter(row => (category === 'all' || row.category === category) && (status === 'all' || row.status === status) && languages.some(lang => `${row[`title_${lang}`]} ${row.slug}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
    const used = draft ? new Set([draft.cover_image_id,...draft.gallery_image_ids]) : new Set();
    return <>
        <div className={styles.notice}>{t('pm.transition')}</div>
        <div className={styles.toolbar}>
            <label>{t('pm.search')}<input value={search} onChange={event => setSearch(event.target.value)} /></label>
            <label>{t('pm.category')}<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">{t('projects.all')}</option>{categories.map(item => <option key={item.id} value={item.id}>{localized(item.title,i18n.resolvedLanguage)}</option>)}</select></label>
            <label>{t('pm.status')}<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">{t('projects.all')}</option>{['draft','published'].map(value => <option key={value} value={value}>{t(`pm.${value}`)}</option>)}</select></label>
            <button className={styles.button} type="button" disabled={busy} onClick={() => edit(emptyProject())}>{t('pm.create')}</button>
        </div>
        {loading && <p role="status">{t('pm.loading')}</p>}
        {error && <p className={styles.error} role="alert">{t(error)} <button type="button" disabled={busy} onClick={() => { setError(null); void reload(); }}>{t('admin.retry')}</button></p>}
        {notice && <p className={styles.status} role="status">{t(notice)}</p>}
        {cleanupId && <button className={styles.button} type="button" onClick={() => runCleanup(cleanupId)}>{t('pm.cleanup')}</button>}
        {!loading && !error && !visible.length && <p>{t('pm.empty')}</p>}
        <div className={styles.list}>{visible.map(row => <article className={styles.row} key={row.id}>
            <div><h2>{row[`title_${i18n.resolvedLanguage}`] || row.title_hy}</h2><p>{t(`pm.${row.status}`)} · {localized(categories.find(item => item.id===row.category)?.title,i18n.resolvedLanguage)}</p></div>
            <div className={styles.actions}><button className={styles.button} type="button" disabled={busy} onClick={() => edit(row)}>{t('pm.edit')}</button>
                {state.role === 'admin' && <button className={`${styles.button} ${styles.danger}`} type="button" disabled={busy} onClick={() => setConfirmation({type:'delete',row})}>{t('pm.delete')}</button>}
            </div>
        </article>)}</div>
        {blocker.state === 'blocked' && <section className={styles.dialog} role="alertdialog" aria-labelledby="leave-project">
            <h2 id="leave-project">{t('pm.unsaved')}</h2><button className={styles.button} type="button" onClick={()=>blocker.proceed()}>{t('pm.confirm')}</button><button className={styles.button} type="button" onClick={()=>blocker.reset()}>{t('pm.cancel')}</button>
        </section>}
        {confirmation && <section className={styles.dialog} role="alertdialog" aria-modal="false" aria-labelledby="project-confirmation" tabIndex={-1} ref={element => element?.focus()}>
            <h2 id="project-confirmation">{t(confirmation.type==='delete' ? 'pm.confirmDelete' : confirmation.type==='switch' ? 'pm.unsaved' : 'pm.confirmDiscard')}</h2>
            <div className={styles.actions}><button className={styles.button} type="button" onClick={confirm}>{t('pm.confirm')}</button><button className={styles.button} type="button" onClick={() => setConfirmation(null)}>{t('pm.cancel')}</button></div>
        </section>}
        {draft && <form noValidate className={styles.form} onSubmit={event => { event.preventDefault(); void performSave(draft.status); }}>
            <h2>{t(draft.id ? 'pm.edit' : 'pm.create')}</h2><p className={styles.help}>{t('pm.requirements')}</p>
            <fieldset disabled={busy}>
                <legend>{t('pm.basics')}</legend><div className={styles.grid}>
                    <label>{t('pm.slug')}<input value={draft.slug} readOnly={Boolean(draft.id)} maxLength={120} required pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={event=>change('slug',event.target.value)} /></label>
                    <label>{t('pm.category')}<select value={draft.category} onChange={event=>change('category',event.target.value)}>{categories.map(item=><option key={item.id} value={item.id}>{localized(item.title,i18n.resolvedLanguage)}</option>)}</select></label>
                </div>
                <label>{t('pm.contentLanguage')}<select value={language} onChange={event=>setLanguage(event.target.value)}>{languages.map(lang=><option key={lang} value={lang}>{lang.toUpperCase()}</option>)}</select></label>
                {['title','description','long_description','location'].map(field=><label key={`${field}_${language}`}>{t(`pm.fields.${field}`)} ({language.toUpperCase()}){field === 'title' && language === 'hy' ? ' *' : ''}
                    {field==='title' || field==='location' ? <input lang={language} value={draft[`${field}_${language}`]} maxLength={field==='title'?200:300} onChange={event=>change(`${field}_${language}`,event.target.value)} /> : <textarea lang={language} value={draft[`${field}_${language}`]} maxLength={field==='description'?2000:15000} onChange={event=>change(`${field}_${language}`,event.target.value)} />}
                </label>)}
                <label>{t('pm.features')} ({language.toUpperCase()})<textarea lang={language} value={draft[`features_${language}`].join('\n')} onChange={event=>change(`features_${language}`,event.target.value.split('\n'))} /></label>
            </fieldset>
            <fieldset disabled={busy}><legend>{t('pm.images')}</legend>
                <p className={styles.help}>{t(draft.id ? 'pm.imageRules' : 'pm.saveFirst')}</p>
                <label>{t('pm.upload')}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!draft.id || busy} onChange={upload} /></label>
                <div className={styles.images}>{[...images.values()].map(image=><figure className={styles.image} key={image.id}>
                    <img src={image.url} alt={draft[`title_${language}`] || t('pm.preview')} onError={() => setError('pm.imageExpired')} />
                    <figcaption>{draft.cover_image_id===image.id && <span>{t('pm.cover')} · </span>}
                        <button type="button" onClick={()=>change('cover_image_id',image.id)}>{t('pm.setCover')}</button>
                        {!draft.gallery_image_ids.includes(image.id) && <button type="button" onClick={()=>change('gallery_image_ids',[...draft.gallery_image_ids,image.id])}>{t('pm.addGallery')}</button>}
                        {!used.has(image.id) && <button type="button" onClick={()=>setConfirmation({type:'discard',id:image.id})}>{t('pm.discard')}</button>}
                    </figcaption>
                </figure>)}</div>
                <h3>{t('pm.galleryOrder')}</h3>
                <ol>{draft.gallery_image_ids.map((id,index)=><li key={id} className={styles.row}>
                    <span>{index+1}</span>{images.get(id)?.url && <img src={images.get(id).url} alt={t('pm.preview')} width="80" />}
                    <div><button type="button" disabled={index===0} aria-label={t('pm.moveUp')} onClick={()=>change('gallery_image_ids',moveImage(draft.gallery_image_ids,index,-1))}>↑</button>
                    <button type="button" disabled={index===draft.gallery_image_ids.length-1} aria-label={t('pm.moveDown')} onClick={()=>change('gallery_image_ids',moveImage(draft.gallery_image_ids,index,1))}>↓</button>
                    <button type="button" onClick={()=>change('gallery_image_ids',draft.gallery_image_ids.filter(value=>value!==id))}>{t('pm.removeGallery')}</button></div>
                </li>)}</ol>
                <button className={styles.button} type="button" disabled={!draft.id} onClick={()=>loadImages(draft).catch(failure)}>{t('pm.refreshImages')}</button>
            </fieldset>
            <div className={styles.actions}>
                <button className={styles.button} disabled={busy} type="submit">{t('pm.save')}</button>
                <button className={styles.button} disabled={busy} type="button" onClick={()=>performSave('draft')}>{t('pm.saveDraft')}</button>
                <button className={styles.button} disabled={busy} type="button" onClick={()=>performSave('published')}>{t('pm.publish')}</button>
            </div>
        </form>}
    </>;
}
