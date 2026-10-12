import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Header } from '../Header';
import styles from './Footer.module.css';
export const Footer = () => {
    const { t } = useTranslation();
    return (
    <footer className={styles.footer}>
        <div className={styles.inner}>
            <div className={styles.brand}><Header /><p>{t('footer.description')}</p></div>
            <nav aria-label={t('footer.navigation')}><h2>{t('footer.explore')}</h2>
                <Link to="/#services">{t('nav.services')}</Link><Link to="/#projects">{t('nav.projects')}</Link><Link to="/#about">{t('nav.about')}</Link>
            </nav>
            <div className={styles.contact}><h2>{t('nav.contact')}</h2><a href="tel:+37455106070">055 10 60 70</a><a href="mailto:parametr.sp@gmail.com">parametr.sp@gmail.com</a><p>{t('contact.addressRegion')}<br />{t('contact.addressStreet')}</p></div>
            <div className={styles.bottom}><span>© {new Date().getFullYear()} {t('brand.name')}</span><Link to="/#main">{t('footer.top')} <span aria-hidden="true">↑</span></Link></div>
        </div>
    </footer>
);
};
