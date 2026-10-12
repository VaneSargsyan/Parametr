import { useTranslation } from 'react-i18next';
import { Link, useRouteError } from 'react-router-dom';
import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import { usePageMetadata } from '../../hooks/usePageMetadata';
import styles from '../ProjectDetails/ProjectDetails.module.css';

export default function ErrorPage() {
    const { t } = useTranslation();
    const error = useRouteError();
    const message = t(error && error.status !== 404 ? 'errors.unexpected' : 'errors.description');
    usePageMetadata(`${t(error && error.status !== 404 ? 'errors.unexpected' : 'errors.title')} | ${t('brand.name')}`, message);
    return <main className={`${styles.page} ${styles.empty}`}>
        <LanguageSwitcher tone="light" />
        <h1>{t(error && error.status !== 404 ? 'errors.unexpected' : 'errors.title')}</h1>
        <p>{message}</p>
        <Link to="/">{t('nav.main')}</Link>
    </main>;
}
