
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
                <h1 className={styles['projects-title']}>Մեր նախագծերը</h1>
                <h4 className={styles['projects-desc']}>Յուրաքանչյուր նախագիծ արտացոլում է մեր փորձը, ճշգրտությունն ու պատասխանատվությունը։</h4>
            </div>

        <div className={styles.filters}>
        {categories.map((item) => (
          <button
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

      <div className={styles.grid}>
        {filtered.map((project, index) => (
          <Link
            to={`/projects/${project.slug}`}
            className={styles.card}
            key={project.id}
            style={{
              animationDelay: `${index * 120}ms`,
            }}
          >
            <img src={project.image} alt={project.title} />

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