import { useTranslation } from 'react-i18next';
import { validateContact } from './validation';
import { useState } from 'react'
import styles from './Contact.module.css'
import ContactIcon from '../../assets/Icons/Contact.svg?react'
import LocationIcon from '../../assets/Icons/Location.svg?react'
import PhoneIcon from '../../assets/Icons/Phone.svg?react'
import MailIcon from '../../assets/Icons/Mail.svg?react'
export const Contact = () => {
    const { t } = useTranslation();
    const [attempted, setAttempted] = useState(false);
    const [errors, setErrors] = useState({});
    return (
        <section id='contact' className={styles['contact-section']}>
            <div className={styles["contact"]}>

                <div className={styles["left-side"]}>
                    <div className={styles['subtitle-div']}>
                        <h2 className={styles['sub-title']}>{t('nav.contact')}</h2>
                        <ContactIcon className={styles["contact-icon"]} />
                    </div>

                    <h3 className={styles.title}>
                        {t('contact.title')} <span>{t('contact.titleAccent')}</span>
                    </h3>

                    <p className={styles.desc}>{t('contact.description')}</p>


                    <div className={styles.info}>
                        <div className={styles['infoItem']}>
                            <LocationIcon />
                            <span>{t('contact.addressRegion')} {t('contact.addressStreet')}</span>
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
                    <h2>{t('actions.request')}</h2>
                    <p className={styles.notice} id="form-notice">{t('contact.notice')}</p>

                    <form noValidate aria-describedby="form-notice" onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const nextErrors = validateContact(Object.fromEntries(new FormData(form)));
                        if (form.elements.namedItem('email').validity.typeMismatch) nextErrors.email = 'form.invalidEmail';
                        setErrors(nextErrors);
                        setAttempted(false);
                        const firstInvalid = Object.keys(nextErrors)[0];
                        if (firstInvalid) form.elements.namedItem(firstInvalid)?.focus();
                        else setAttempted(true);
                    }}>
                        <label htmlFor="contact-name">{t('form.name')}</label>
                        <input
                            id="contact-name" name="fullName"
                            aria-invalid={Boolean(errors.fullName)}
                            aria-describedby={errors.fullName ? 'contact-name-error' : undefined} autoComplete="name"
                            type="text"
                            placeholder={t('form.name')}
                            required
                        />
                        {errors.fullName && <p className={styles.fieldError} id="contact-name-error" role="alert">{t(errors.fullName)}</p>}

                        <label htmlFor="contact-phone">{t('form.phone')}</label>
                        <input
                            id="contact-phone" name="phone"
                            aria-invalid={Boolean(errors.phone)}
                            aria-describedby={errors.phone ? 'contact-phone-error' : undefined} autoComplete="tel"
                            type="tel"
                            placeholder={t('form.phone')}
                            required
                        />
                        {errors.phone && <p className={styles.fieldError} id="contact-phone-error" role="alert">{t(errors.phone)}</p>}

                        <label htmlFor="contact-email">{t('form.email')}</label>
                        <input
                            id="contact-email" name="email"
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? 'contact-email-error' : undefined} autoComplete="email"
                            type="email"
                            placeholder={t('form.email')}
                        />
                        {errors.email && <p className={styles.fieldError} id="contact-email-error" role="alert">{t(errors.email)}</p>}

                        <label htmlFor="contact-message">{t('form.message')}</label>
                        <textarea
                            id="contact-message" name="message"
                            placeholder={t('form.message')}>
                        </textarea>

                        <button type="submit">
                            {t('actions.request')} <span aria-hidden="true">↗</span>
                        </button>
                        <p role="status" hidden={!attempted}>{attempted && t('contact.unsent')}</p>
                    </form>
                </div>

            </div>
        </section>
    )
}