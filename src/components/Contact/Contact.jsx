import { useState } from 'react'
import styles from './Contact.module.css'
import ContactIcon from '../../assets/Icons/Contact.svg?react'
import LocationIcon from '../../assets/Icons/Location.svg?react'
import PhoneIcon from '../../assets/Icons/Phone.svg?react'
import MailIcon from '../../assets/Icons/Mail.svg?react'
export const Contact = () => {
    const [attempted, setAttempted] = useState(false);
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
                    <h2>Ներկայացնել հայտ</h2>
                    <p className={styles.notice} id="form-notice">Առցանց հայտերի ընդունումը դեռ հասանելի չէ։ Կապ հաստատելու համար զանգահարեք կամ գրեք մեզ։</p>

                    <form aria-describedby="form-notice" onSubmit={(event) => {
                        event.preventDefault();
                        setAttempted(true);
                    }}>
                        <label htmlFor="contact-name">Անուն</label>
                        <input
                            id="contact-name" name="fullName" autoComplete="name"
                            type="text"
                            placeholder="Անուն"
                            required
                        />

                        <label htmlFor="contact-phone">Հեռախոս</label>
                        <input
                            id="contact-phone" name="phone" autoComplete="tel"
                            type="tel"
                            placeholder="Հեռախոս"
                            required
                        />

                        <label htmlFor="contact-email">Էլեկտրոնային փոստ (ոչ պարտադիր)</label>
                        <input
                            id="contact-email" name="email" autoComplete="email"
                            type="email"
                            placeholder=""
                        />

                        <label htmlFor="contact-message">Ձեր հաղորդագրությունը</label>
                        <textarea
                            id="contact-message" name="message"
                            placeholder="Ձեր հաղորդագրությունը">
                        </textarea>

                        <button type="submit">
                            Ներկայացնել հայտ <span aria-hidden="true">↗</span>
                        </button>
                        <p role="status" hidden={!attempted}>{attempted && 'Հարցումը չի ուղարկվել։ Խնդրում ենք կապ հաստատել նշված հեռախոսահամարով կամ էլեկտրոնային փոստով։'}</p>
                    </form>
                </div>

            </div>
        </section>
    )
}