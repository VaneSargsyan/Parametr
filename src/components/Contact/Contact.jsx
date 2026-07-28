import styles from './Contact.module.css'
import ContactIcon from '../../assets/Icons/Contact.svg?react'
import LocationIcon from '../../assets/Icons/Location.svg?react'
import PhoneIcon from '../../assets/Icons/Phone.svg?react'
import MailIcon from '../../assets/Icons/Mail.svg?react'
export const Contact = () => {
    return (
        <section id='contact' className={styles['contact-section']}>
            <div className={styles["contact"]}>

                <div className={styles["left-side"]}>
                    <div className={styles['subtitle-div']}>
                        <h2 className={styles['sub-title']}>Կապ մեզ հետ</h2>
                        <ContactIcon className={styles["contact-icon"]} />
                    </div>

                    <h3 className={styles.title}>
                        Պատրա՞ստ եք սկսել <span>ձեր նախագիծը</span>
                    </h3>

                    <p className={styles.desc}>
                        Պատմեք մեզ ձեր գաղափարի կամ նախագծի մասին։
                        Մեր մասնագետները մեկ աշխատանքային օրվա ընթացքում
                        կկապվեն ձեզ հետ և կառաջարկեն լավագույն լուծումը։
                    </p>


                    <div className={styles.info}>
                        <div className={styles['infoItem']}>
                            <LocationIcon />
                            <span>
                                Կոտայքի մարզ, գյուղ Քանաքեռավան,
                                Անանիա Շիրակացի 33
                            </span>
                        </div>

                        <div className={styles['infoItem']}>
                            <PhoneIcon />
                            <a href="tel:+37455106070">
                                055 10 60 70
                            </a>
                        </div>

                        <div className={styles['infoItem']}>
                            <MailIcon />
                            <a href="mailto:parametr.sp@gmail.com">
                                parametr.sp@gmail.com
                            </a>
                        </div>
                    </div>

                </div>


                <div className={styles["right-side"]}>
                    <h2>Ուղարկեք հարցում</h2>

                    <form>
                        <input
                            type="text"
                            placeholder="Անուն"
                            required
                        />

                        <input
                            type="tel"
                            placeholder="Հեռախոս"
                            pattern="[0-9]{9}"
                            required
                        />

                        <input
                            type="email"
                            placeholder="Email"
                            required
                        />

                        <textarea
                            placeholder="Ձեր հաղորդագրությունը">
                        </textarea>

                        <button type="submit">
                            Ստանալ խորհրդատվություն
                        </button>
                    </form>
                </div>

            </div>
        </section>
    )
}