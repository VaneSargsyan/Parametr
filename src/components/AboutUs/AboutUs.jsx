import { useTranslation } from 'react-i18next';
import styles from './AboutUs.module.css'
export const AboutUs = () => {
    const { t } = useTranslation();
    return (

        <section id="about" className={styles.about}>
            <div className={styles.container}>
                <div className={styles.textSide}>
                    <span className={styles.tag}>{t('nav.about')}</span>

                    <h2 className={styles.title}>
                        {t('about.title')}
                    </h2>


                    <p className={styles.desc}>
                        {t('about.description')}
                    </p>
                    <a
                        href="#contact"
                        className={styles.btn}
                    >
                        {t('actions.contact')}
                    </a>
                </div>

                <div className={styles.imageSide}>
                    <div className={styles.imageBox}>
                        <img
                            src="/Images/Naxagic.jpeg"
                            loading="lazy" decoding="async"
                            alt={t('about.imageAlt')}
                        />
                    </div>
                </div>

            </div>
        </section>
    );

}