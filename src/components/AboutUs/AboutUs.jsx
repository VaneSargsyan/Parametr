import styles from './AboutUs.module.css'
export const AboutUs = () => {
    return (

        <section id="about" className={styles.about}>
            <div className={styles.container}>
                <div className={styles.textSide}>
                    <span className={styles.tag}>Մեր մասին</span>

                    <h2 className={styles.title}>
                        Ձեր գաղափարը՝ մեր մասնագիտական առաքելությունն է։
                    </h2>


                    <p className={styles.desc}>
                        Գեոդեզիա, նախագծում, կառուցապատում և համալիր շինարարական լուծումներ՝ ճշգրտությամբ, պատասխանատվությամբ և ժամանակակից մոտեցմամբ։
                    </p>
                    <a
                        href="#contact"
                        className={styles.btn}
                    >
                        Կապ հաստատել
                    </a>
                </div>

                <div className={styles.imageSide}>
                    <div className={styles.imageBox}>
                        <img
                            src="/Images/Naxagic.jpeg"
                            loading="lazy" decoding="async"
                            alt="Ճարտարապետական նախագծում"
                        />
                    </div>
                </div>

            </div>
        </section>
    );

}