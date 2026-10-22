import { useTranslation } from 'react-i18next';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { categories } from '../../data/categories';
import { localized } from '../../i18n/content';
import { usePublicProjects } from '../../features/projects/usePublicProjects';
import styles from './Projects.module.css'

export const Projects = () => {
    const { t, i18n } = useTranslation();
    const { projects, loading, error, retry } = usePublicProjects();
    const [active, setActive] = useState('all');
    const filtered =
        active === 'all'
            ? projects
            : projects.filter((item) => item.categoryId === active);
    return (
        <section id='projects' className={styles['projects-section']}>
            <div className={styles["projects-header"]}>
                <h2 className={styles['projects-title']}>{t('projects.title')}</h2>
                <p className={styles['projects-desc']}>{t('projects.description')}</p>
            </div>

        <div className={styles.filters}>
        {[{ id: 'all' }, ...categories].map((item) => (
          <button
            type="button"
            aria-pressed={active === item.id}
            key={item.id}
            className={`${styles.filterBtn} ${
              active === item.id ? styles.active : ""
            }`}
            onClick={() => setActive(item.id)}
          >
            {item.id === 'all' ? t('projects.all') : localized(item.title, i18n.resolvedLanguage)}
          </button>
        ))}
      </div>

      <div className={styles.grid} key={active}>
        {loading && <p role="status">{t('pm.loading')}</p>}
        {error && <div role="alert"><p>{t('pm.publicError')}</p><button type="button" onClick={retry}>{t('admin.retry')}</button></div>}
        {!loading && !error && filtered.length === 0 && <p role="status">{t('projects.empty')}</p>}
        {filtered.map((project, index) => (
          <Link
            viewTransition={!window.matchMedia('(prefers-reduced-motion: reduce)').matches}
            to={`/projects/${project.slug}`}
            className={styles.card}
            key={project.id}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className={styles.media}><img loading="lazy" decoding="async" src={project.image} alt={localized(project.title, i18n.resolvedLanguage)} /></div>

            <div className={styles.overlay}>
              <span>{localized(categories.find(category => category.id === project.categoryId)?.title, i18n.resolvedLanguage)}</span>
              <h3>{localized(project.title, i18n.resolvedLanguage)}</h3>
            </div>
          </Link>
        ))}
      </div>

        </section>
    )
}