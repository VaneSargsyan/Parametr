
import { Link } from 'react-scroll'
import styles from './TitleSection.module.css'

export const TitleSection = () => {
    return (
        <div id='main' className={styles['main-section']}>
            <div className={styles["title-section"]}>
                <h2 className={styles['title']}>Գաղափարից մինչև <span>իրականացում</span></h2>
                <p className={styles['main-desc']}>Գեոդեզիա, նախագծում, կառուցապատում, վերանորոգում, կահույք և համալիր շինարարական լուծումներ՝ մեկ թիմի կողմից</p>
            </div>
            <div className={styles["main-buttons"]}>
                <Link to="contact" smooth={true} duration={500} className={styles['advice-button']} >
                    <span className={styles['contact-icon']}>☏</span>
                    <span>Ստանալ խորհրդատվություն</span>
                </Link>
                <Link to="projects" smooth={true} duration={500} className={styles['projects-button']} >
                    <span>Տեսնել նախագծերը</span>
                    <span>→</span>
                </Link>
            </div>
            <div className="main-subtexts">
                <div className={styles.values}>
                    <div className={styles.valueCard}>
                        <h3>Փորձ</h3>
                        <p>Մասնագիտական մոտեցում յուրաքանչյուր նախագծում</p>
                    </div>

                    <div className={styles.valueCard}>
                        <h3>Ճշգրտություն</h3>
                        <p>Ժամանակակից չափագրման և նախագծման լուծումներ</p>
                    </div>

                    <div className={styles.valueCard}>
                        <h3>Նորարարություն</h3>
                        <p>Առաջադեմ տեխնոլոգիաների կիրառում</p>
                    </div>

                    <div className={styles.valueCard}>
                        <h3>Վստահելիություն</h3>
                        <p>Պատասխանատվություն յուրաքանչյուր փուլում</p>
                    </div>
                </div>
            </div>
        </div>
    )
}