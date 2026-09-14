import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projects } from '../../data/projects';
import styles from './ProjectDetails.module.css';

const BackLink = () => (
    <Link className={styles.back} to="/#projects">← Վերադառնալ նախագծերին</Link>
);

export default function ProjectDetails() {
    const { slug } = useParams();
    const project = projects.find((item) => item.slug === slug);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        const previousTitle = document.title;
        document.title = `${project?.title ?? 'Նախագիծը չի գտնվել'} | Պարամետր`;
        return () => { document.title = previousTitle; };
    }, [project]);

    if (!project) {
        return (
            <main lang="hy" className={`${styles.page} ${styles.empty}`}>
                <p className={styles.eyebrow}>Պարամետր · Նախագծեր</p>
                <h1>Նախագիծը չի գտնվել</h1>
                <p>Այս հասցեով նախագիծ չկա։ Ծանոթացեք մեր մյուս նախագծերին։</p>
                <BackLink />
            </main>
        );
    }

    return (
        <main lang="hy" className={styles.page}>
            <header className={styles.hero}>
                <nav className={styles.navigation} aria-label="Նախագծի նավարկում">
                    <Link className={styles.brand} to="/">Պարամետր</Link>
                    <BackLink />
                </nav>
                <div className={styles.intro}>
                    <p className={styles.eyebrow}>{project.category}</p>
                    <h1>{project.title}</h1>
                    <p className={styles.description}>{project.description}</p>
                </div>
                <img className={styles.heroImage} src={project.image} alt={project.title} fetchPriority="high" />
            </header>

            <div className={styles.content}>
                <section className={styles.about} aria-labelledby="about-project">
                    <div>
                        <p className={styles.eyebrow}>Մոտեցում և գաղափար</p>
                        <h2 id="about-project">Նախագծի մասին</h2>
                    </div>
                    <p>{project.longDescription}</p>
                </section>

                <section className={styles.section} aria-labelledby="project-features">
                    <p className={styles.eyebrow}>Մանրամասներ</p>
                    <h2 id="project-features">Հիմնական առանձնահատկությունները</h2>
                    <ul className={styles.features}>
                        {project.features.map((feature, index) => (
                            <li className={styles.feature} key={feature}>
                                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                                <h3>{feature}</h3>
                            </li>
                        ))}
                    </ul>
                </section>

                {project.gallery?.length > 0 && (
                    <section className={styles.section} aria-labelledby="project-gallery">
                        <p className={styles.eyebrow}>Պատկերներ</p>
                        <h2 id="project-gallery">Նախագծի պատկերասրահ</h2>
                        <div className={styles.gallery}>
                            {project.gallery.map((image, index) => (
                                <figure key={`${image}-${index}`}>
                                    <a href={image} target="_blank" rel="noopener noreferrer" aria-label={`${project.title}․ բացել պատկերը նոր ներդիրում՝ ${index + 1}`}>
                                        <img src={image} alt={`${project.title}․ պատկեր ${index + 1}`} loading="lazy" decoding="async" />
                                    </a>
                                    <figcaption>{project.category} <span>{String(index + 1).padStart(2, '0')}</span></figcaption>
                                </figure>
                            ))}
                        </div>
                    </section>
                )}
                <footer className={styles.footer}><BackLink /></footer>
            </div>
        </main>
    );
}
