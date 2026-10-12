import { useTranslation } from 'react-i18next';
import { localized } from '../../i18n/content';
import { categories } from '../../data/categories';
import { usePageMetadata } from '../../hooks/usePageMetadata';
import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projects } from '../../data/projects';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer/Footer';
import styles from './ProjectDetails.module.css';

const BackLink = () => {
    const { t } = useTranslation();
    return (
    <Link className={styles.back} to="/#projects">← {t('project.back')}</Link>
);
};

export default function ProjectDetails() {
    const { t, i18n } = useTranslation();
    const { slug } = useParams();
    const project = projects.find((item) => item.slug === slug);

    const title = project ? localized(project.title, i18n.resolvedLanguage) : t('project.notFound');
    const description = project ? localized(project.description, i18n.resolvedLanguage) : t('project.notFoundDescription');
    const category = localized(categories.find(item => item.id === project?.categoryId)?.title, i18n.resolvedLanguage);
    usePageMetadata(`${title} | ${t('brand.name')}`, description);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [slug]);

    if (!project) {
        return (
            <main lang={i18n.resolvedLanguage} className={`${styles.page} ${styles.empty}`}>
                <LanguageSwitcher tone="light" />
                <p className={styles.eyebrow}>{t('project.eyebrow')}</p>
                <h1>{t('project.notFound')}</h1>
                <p>{t('project.notFoundDescription')}</p>
                <BackLink />
            </main>
        );
    }

    return (
        <>
        <main lang={i18n.resolvedLanguage} className={styles.page}>
            <header className={styles.hero}>
                <nav className={styles.navigation} aria-label={t('project.navigation')}>
                    <Header />
                    <LanguageSwitcher />
                    <BackLink />
                </nav>
                <div className={styles.intro}>
                    <p className={styles.eyebrow}>{category}</p>
                    <h1>{title}</h1>
                    <p className={styles.description}>{description}</p>
                </div>
                <img className={styles.heroImage} src={project.image} alt={title} fetchPriority="high" />
            </header>

            <div className={styles.content}>
                <section className={styles.about} aria-labelledby="about-project">
                    <div>
                        <p className={styles.eyebrow}>{t('project.approach')}</p>
                        <h2 id="about-project">{t('project.about')}</h2>
                    </div>
                    <p>{localized(project.longDescription, i18n.resolvedLanguage)}</p>
                </section>

                <section className={styles.section} aria-labelledby="project-features">
                    <p className={styles.eyebrow}>{t('project.details')}</p>
                    <h2 id="project-features">{t('project.features')}</h2>
                    <ul className={styles.features}>
                        {localized(project.features, i18n.resolvedLanguage).map((feature, index) => (
                            <li className={styles.feature} key={feature}>
                                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                                <h3>{feature}</h3>
                            </li>
                        ))}
                    </ul>
                </section>

                {project.gallery?.length > 0 && (
                    <section className={styles.section} aria-labelledby="project-gallery">
                        <p className={styles.eyebrow}>{t('project.images')}</p>
                        <h2 id="project-gallery">{t('project.gallery')}</h2>
                        <div className={styles.gallery}>
                            {project.gallery.map((image, index) => (
                                <figure key={`${image}-${index}`}>
                                    <a href={image} target="_blank" rel="noopener noreferrer" aria-label={t('project.openImage', { title, number: index + 1 })}>
                                        <img src={image} alt={t('project.imageAlt', { title, number: index + 1 })} loading="lazy" decoding="async" />
                                    </a>
                                    <figcaption>{category} <span>{String(index + 1).padStart(2, '0')}</span></figcaption>
                                </figure>
                            ))}
                        </div>
                    </section>
                )}
                <div className={styles.footer}>
                    <div><p className={styles.eyebrow}>{t('project.next')}</p><h2>{t('project.discuss')}</h2></div>
                    <Link className={styles.requestLink} to="/#contact">{t('actions.request')} <span aria-hidden="true">↗</span></Link>
                    <BackLink />
                </div>
            </div>
        </main>
        <Footer />
        </>
    );
}
