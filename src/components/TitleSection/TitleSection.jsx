import styles from './TitleSection.module.css';
export const TitleSection = () => (
    <section id="main" className={styles.hero} aria-labelledby="hero-title" tabIndex={-1}>
        <div className={styles.copy}>
            <p className={styles.eyebrow}><span aria-hidden="true" /> Գեոդեզիա · Նախագծում · Կառուցապատում</p>
            <h1 id="hero-title">Գաղափարից մինչև <span>իրականացում</span></h1>
            <p className={styles.description}>Գեոդեզիա, նախագծում, կառուցապատում, վերանորոգում, կահույք և համալիր շինարարական լուծումներ՝ մեկ թիմի կողմից</p>
            <div className={styles.actions}>
                <a className={styles.primary} href="#projects">Դիտել մեր աշխատանքները <span aria-hidden="true">↗</span></a>
                <a className={styles.secondary} href="#contact">Ներկայացնել հայտ <span aria-hidden="true">→</span></a>
            </div>
            <div className={styles.note}><span aria-hidden="true">01 /</span> Մասնագիտական մոտեցում յուրաքանչյուր նախագծում</div>
        </div>
        <figure className={styles.visual}>
            <img src="/Images/Construction.avif" alt="Շինարարական աշխատանքներ" fetchPriority="high" width="900" height="1100" />
            <figcaption><span>Ճշգրտություն՝ յուրաքանչյուր փուլում</span><span aria-hidden="true">↗</span></figcaption>
            <span className={styles.corner} aria-hidden="true" />
        </figure>
        <div className={styles.values}>
            <div><span aria-hidden="true">01</span><h2>Փորձ</h2><p>Մասնագիտական մոտեցում յուրաքանչյուր նախագծում</p></div>
            <div><span aria-hidden="true">02</span><h2>Ճշգրտություն</h2><p>Ժամանակակից չափագրման և նախագծման լուծումներ</p></div>
            <div><span aria-hidden="true">03</span><h2>Նորարարություն</h2><p>Առաջադեմ տեխնոլոգիաների կիրառում</p></div>
            <div><span aria-hidden="true">04</span><h2>Վստահելիություն</h2><p>Պատասխանատվություն յուրաքանչյուր փուլում</p></div>
        </div>
    </section>
);
