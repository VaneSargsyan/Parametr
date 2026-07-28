
import { useState } from 'react';
import styles from './Projects.module.css'

const categories = [
    "Բոլորը",
    "Կառուցապատում",
    "Գեոդեզիա",
    "Նախագծում",
    "Կահույք",
    "Դռներ և պատուհաններ",
];

const projects = [
    {
        id: 1,
        title: "Առանձնատան կառուցապատում",
        category: "Կառուցապատում",
        image: "/public/Images/Construction.avif"
    },
    {
        id: 2,
        title: "Հողամասի չափագրում",
        category: "Գեոդեզիա",
        image: "/public/Images/Geodesy.jpeg",
    },
    {
        id: 3,
        title: "Ժամանակակից խոհանոց",
        category: "Կահույք",
        image: "/public/Images/Furniture.jpeg",
    },
    {
        id: 4,
        title: "Բնակելի տան նախագիծ",
        category: "Նախագծում",
        image: "/public/Images/Naxagic.jpeg",
    },
    {
        id: 5,
        title: "PVC դռներ և պատուհաններ",
        category: "Դռներ և պատուհաններ",
        image: "/public/Images/DoorWindow.jpeg",
    },
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
          <div
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
          </div>
        ))}
      </div>

        </section>
    )
}