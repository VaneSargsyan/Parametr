import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Header } from '../../components/Header';
import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import { usePageMetadata } from '../../hooks/usePageMetadata';
import styles from './Admin.module.css';

export default function AdminFrame({ children, login = false }) {
    const { t } = useTranslation();
    usePageMetadata(`${t(login ? 'admin.loginTitle' : 'admin.title')} | ${t('brand.name')}`, t('admin.loginDescription'));
    useEffect(() => {
        const meta = document.createElement('meta');
        meta.name = 'robots'; meta.content = 'noindex, nofollow';
        document.head.appendChild(meta);
        return () => meta.remove();
    }, []);
    return <div className={styles.page}>
        <header className={styles.header}><Header /><LanguageSwitcher /></header>
        <main className={styles.content}>{children}<Link className={styles.link} to="/">{t('admin.publicSite')}</Link></main>
    </div>;
}
