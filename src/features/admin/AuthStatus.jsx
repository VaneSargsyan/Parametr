import { useTranslation } from 'react-i18next';
import { useAdminAuth } from './AuthContext';
import styles from './Admin.module.css';

export default function AuthStatus({ denied = false }) {
    const { t } = useTranslation();
    const { state, controller } = useAdminAuth();
    if (state.status === 'loading') return <p role="status">{t('admin.loading')}</p>;
    if (state.status === 'unconfigured') return <p role="status">{t('admin.unconfigured')}</p>;
    return <section className={styles.card}>
        <h1>{t(denied || state.status === 'denied' ? 'admin.denied' : 'admin.title')}</h1>
        <p role="alert">{t(denied || state.status === 'denied' ? 'admin.deniedDescription' : state.errorKey || 'admin.errors.unavailable')}</p>
        <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={() => controller.reload()}>{t('admin.retry')}</button>
            <button type="button" className={styles.button} onClick={() => controller.signOut()}>{t('admin.logout')}</button>
        </div>
    </section>;
}
