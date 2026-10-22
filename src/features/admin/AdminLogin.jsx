import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { useAdminAuth } from './AuthContext';
import AdminFrame from './AdminFrame';
import AuthStatus from './AuthStatus';
import styles from './Admin.module.css';

export default function AdminLogin() {
    const { t } = useTranslation();
    const { state, controller } = useAdminAuth();
    const [busy, setBusy] = useState(false);
    const [errorKey, setErrorKey] = useState(null);
    if (state.status === 'authorized') return <Navigate to="/admin" replace />;
    if (state.status !== 'anonymous') return <AdminFrame login><AuthStatus /></AdminFrame>;
    return <AdminFrame login><section className={styles.card}>
        <h1>{t('admin.loginTitle')}</h1><p>{t('admin.loginDescription')}</p>
        <form className={styles.form} noValidate onSubmit={async event => {
            event.preventDefault();
            if (busy) return;
            const form = event.currentTarget;
            const values = new FormData(form);
            const email = values.get('email').trim();
            const password = values.get('password');
            if (!email || !password) { setErrorKey('admin.errors.required'); return; }
            if (form.elements.namedItem('email').validity.typeMismatch) { setErrorKey('admin.errors.email'); return; }
            setBusy(true); setErrorKey(null);
            try { setErrorKey(await controller.signIn(email, password)); }
            finally { setBusy(false); }
        }}>
            <label htmlFor="admin-email">{t('admin.email')}</label>
            <input id="admin-email" name="email" type="email" autoComplete="username" required disabled={busy} />
            <label htmlFor="admin-password">{t('admin.password')}</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required disabled={busy} />
            {(errorKey || state.errorKey) && <p className={styles.error} role="alert">{t(errorKey || state.errorKey)}</p>}
            <button className={styles.button} type="submit" disabled={busy}>{t(busy ? 'admin.signingIn' : 'admin.signIn')}</button>
        </form>
        <Link className={styles.link} to="/admin/forgot-password">{t('recovery.forgot')}</Link>
    </section></AdminFrame>;
}
