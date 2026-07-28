import styles from './AboutUs.module.css'
import { Link } from 'react-scroll'
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
                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <h3>50+</h3>
                            <p>Ավարտված նախագծեր</p>
                        </div>

                        <div className={styles.stat}>
                            <h3>5+</h3>
                            <p>Տարվա փորձ</p>
                        </div>

                        <div className={styles.stat}>
                            <h3>100%</h3>
                            <p>Ճշգրտություն</p>
                        </div>
                    </div>

                    <Link
                        to="contact"
                        smooth={true}
                        duration={1200}
                        className={styles.btn}
                    >
                        Կապ հաստատել
                    </Link>
                </div>

                <div className={styles.imageSide}>
                    <div className={styles.imageBox}>
                        <img
                            src="https://images.unsplash.com/photo-1503387762-592deb58ef4e"
                            alt="construction"
                        />
                    </div>
                </div>

            </div>
        </section>
    );

}