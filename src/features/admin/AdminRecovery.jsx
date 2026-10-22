import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminFrame from './AdminFrame';
import styles from './Admin.module.css';
import { createRecoveryClient } from '../../lib/recoverySupabase';
import { createRecoveryController, parseRecoveryLink, recoveryError, recoveryPath } from './recovery';

export default function AdminRecovery({ reset = false }) {
    const { t } = useTranslation();
    const [client] = useState(createRecoveryClient);
    const [controller] = useState(() => createRecoveryController(client));
    const [link] = useState(() => reset && typeof window !== 'undefined' ? parseRecoveryLink(new URL(window.location.href)) : null);
    const verification = useRef(null);
    const [status, setStatus] = useState(reset ? 'checking' : 'request');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!reset) return;
        // Scrub all credentials/provider errors before any SDK network call; never render raw errors.
        window.history.replaceState(window.history.state, '', recoveryPath);
        let active = true;
        verification.current ||= controller.verify(link);
        void verification.current.then(errorKey => {
            if (active) { setError(errorKey); setStatus(errorKey ? 'invalid' : 'ready'); }
        });
        return () => { active = false; };
    }, [reset, controller, link]);
    return <AdminFrame login><section className={styles.card}>
        <h1>{t(reset ? 'recovery.resetTitle' : 'recovery.requestTitle')}</h1>
        <p>{t(reset ? 'recovery.resetDescription' : 'recovery.requestDescription')}</p>
        {status === 'checking' && <p role="status">{t('recovery.checking')}</p>}
        {status === 'sent' && <p role="status">{t('recovery.sent')}</p>}
        {status === 'done' && <p role="status">{t('recovery.done')}</p>}
        {error && <p className={styles.error} role="alert">{t(error)}</p>}
        {(status === 'request' || status === 'ready') && <form className={styles.form} noValidate onSubmit={async event => {
            event.preventDefault(); if (busy) return;
            const form = event.currentTarget;
            const values = new FormData(form);
            if (!client) { setError('admin.errors.configuration'); return; }
            if (!reset && (!values.get('email')?.trim() || form.elements.namedItem('email').validity.typeMismatch)) { setError('admin.errors.email'); return; }
            setBusy(true); setError(null);
            try {
                if (reset) {
                    const key = await controller.update(values.get('password'), values.get('confirmation'));
                    if (key) { setError(key); if (key === 'recovery.invalid') setStatus('invalid'); }
                    else { form.reset(); setStatus('done'); }
                } else {
                    const result = await client.auth.resetPasswordForEmail(values.get('email').trim(), { redirectTo: window.location.origin + recoveryPath });
                    if (result.error) {
                        // Do not reveal whether an email belongs to an account.
                        if (['user_not_found','email_not_found'].includes(result.error.code)) { form.reset(); setStatus('sent'); }
                        else setError(result.error.status === 429 ? 'admin.errors.rateLimit' : 'admin.errors.unavailable');
                    } else { form.reset(); setStatus('sent'); }
                }
            } catch (failure) { setError(recoveryError(failure)); }
            finally { setBusy(false); }
        }}>
            {!reset ? <><label htmlFor="recovery-email">{t('admin.email')}</label><input id="recovery-email" name="email" type="email" autoComplete="email" required disabled={busy} /></> : <>
                <label htmlFor="recovery-password">{t('recovery.newPassword')}</label><input id="recovery-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required disabled={busy} aria-describedby="recovery-rule" />
                <p id="recovery-rule">{t('recovery.passwordRule')}</p>
                <label htmlFor="recovery-confirmation">{t('recovery.confirmPassword')}</label><input id="recovery-confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={busy} />
            </>}
            <button className={styles.button} disabled={busy} type="submit">{t(busy ? 'recovery.busy' : reset ? 'recovery.update' : 'recovery.send')}</button>
        </form>}
        {status === 'invalid' && <p><Link className={styles.link} to="/admin/forgot-password">{t('recovery.requestTitle')}</Link></p>}
        <p><Link className={styles.link} to="/admin/login">{t('recovery.back')}</Link></p>
    </section></AdminFrame>;
}
