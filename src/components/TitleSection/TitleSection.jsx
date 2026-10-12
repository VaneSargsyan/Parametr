import { useTranslation } from 'react-i18next';
import styles from './TitleSection.module.css';
export const TitleSection = () => {
    const { t } = useTranslation();
    return (
    <section id="main" className={styles.hero} aria-labelledby="hero-title" tabIndex={-1}>
        <div className={styles.copy}>
            <p className={styles.eyebrow}><span aria-hidden="true" /> {t('hero.eyebrow')}</p>
            <h1 id="hero-title">{t('hero.title')} <span>{t('hero.titleAccent')}</span></h1>
            <p className={styles.description}>{t('hero.description')}</p>
            <div className={styles.actions}>
                <a className={styles.primary} href="#projects">{t('actions.work')} <span aria-hidden="true">↗</span></a>
                <a className={styles.secondary} href="#contact">{t('actions.request')} <span aria-hidden="true">→</span></a>
            </div>
            <div className={styles.note}><span aria-hidden="true">01 /</span> {t('values.experience.description')}</div>
        </div>
        <figure className={styles.visual}>
            <img src="/Images/Construction.avif" alt={t('hero.imageAlt')} fetchPriority="high" width="900" height="1100" />
            <figcaption><span>{t('hero.caption')}</span><span aria-hidden="true">↗</span></figcaption>
            <span className={styles.corner} aria-hidden="true" />
        </figure>
        <div className={styles.values}>
            <div><span aria-hidden="true">01</span><h2>{t('values.experience.title')}</h2><p>{t('values.experience.description')}</p></div>
            <div><span aria-hidden="true">02</span><h2>{t('values.precision.title')}</h2><p>{t('values.precision.description')}</p></div>
            <div><span aria-hidden="true">03</span><h2>{t('values.innovation.title')}</h2><p>{t('values.innovation.description')}</p></div>
            <div><span aria-hidden="true">04</span><h2>{t('values.reliability.title')}</h2><p>{t('values.reliability.description')}</p></div>
        </div>
    </section>
);
};
