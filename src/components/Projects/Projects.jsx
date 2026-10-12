
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { projects } from '../../data/projects';
import styles from './Projects.module.css'

const categories = [
    "Բոլորը",
    "Կառուցապատում",
    "Գեոդեզիա",
    "Նախագծում",
    "Կահույք",
    "Դռներ և պատուհաններ",
];

export const Projects = () => {
    const [active, setActive] = useState("Բոլորը");
    const filtered =
        active === "Բոլորը"
            ? projects
            : projects.filter((item) => item.category === active);
    return (
        <section id='projects' className={styles['projects-section']}>
            <div className={styles["projects-header"]}>
                <h2 className={styles['projects-title']}>Մեր նախագծերը</h2>
                <p className={styles['projects-desc']}>Յուրաքանչյուր նախագիծ արտացոլում է մեր փորձը, ճշգրտությունն ու պատասխանատվությունը։</p>
            </div>

        <div className={styles.filters}>
        {categories.map((item) => (
          <button
            type="button"
            aria-pressed={active === item}
            key={item}
            className={`${styles.filterBtn} ${
              active === item ? styles.active : ""
            }`}
            onClick={() => setActive(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className={styles.grid} key={active}>
        {filtered.map((project, index) => (
          <Link
            viewTransition={!window.matchMedia('(prefers-reduced-motion: reduce)').matches}
            to={`/projects/${project.slug}`}
            className={styles.card}
            key={project.id}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className={styles.media}><img loading="lazy" decoding="async" src={project.image} alt={project.title} /></div>

            <div className={styles.overlay}>
              <span>{project.category}</span>
              <h3>{project.title}</h3>
            </div>
          </Link>
        ))}
      </div>

        </section>
    )
}