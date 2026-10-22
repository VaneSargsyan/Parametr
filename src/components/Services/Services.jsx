import { useTranslation } from 'react-i18next';
import { serviceIcons } from '../../data/services';
import { localized } from '../../i18n/content';
import { usePublicServices } from '../../features/services/usePublicServices';
import { preselectService } from '../../features/services/selection';
import { catalogInquiriesEnabled } from '../../features/services/service';
import styles from './Services.module.css';

export const Services = () => {
    const { t, i18n } = useTranslation();
    const { services,loading,error,retry }=usePublicServices();
    return (
        <section id="services" className={styles.services}>
            <div className={styles['service-header']}>
                <span className={styles.tag}>{t('services.eyebrow')}</span>
                <h2 className={styles.title}>{t('services.title')}</h2>
                <div className={styles.features}>
                    {['individual', 'quality', 'team', 'partner'].map(key => <span key={key}>✓ {t(`services.${key}`)}</span>)}
                </div>
            </div>
            {loading && <p role="status">{t('sm.loading')}</p>}
            {error && <div role="alert">{t('sm.unavailable')} <button type="button" onClick={retry}>{t('admin.retry')}</button></div>}
            {!loading && !error && !services.length && <p role="status">{t('sm.empty')}</p>}
            <div className={styles.cards}>
                {services.map(service => (
                    <article className={styles.card} key={service.id}>
                        <svg className={styles.serviceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={serviceIcons[service.iconKey||service.id]} /></svg>
                        <h3>{localized(service.title, i18n.resolvedLanguage)}</h3>
                        <p>{localized(service.description, i18n.resolvedLanguage)}</p>
                        <a href="#contact" onClick={()=>{if(catalogInquiriesEnabled() && service.acceptsInquiries)preselectService(service.id);}}>{t('services.more')} <span aria-hidden="true">↗</span></a>
                    </article>
                ))}
            </div>
        </section>
    );
};
