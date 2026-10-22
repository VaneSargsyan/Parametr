import { useTranslation } from 'react-i18next';
import { validateContact } from './validation';
import { useEffect, useRef, useState } from 'react'
import styles from './Contact.module.css'
import { inquiryConfiguration, submitInquiry } from '../../features/requests/service';
import { inquiryErrors, normalizeInquiry } from '../../../supabase/functions/_shared/inquiryValidation';
import Turnstile from '../../features/requests/Turnstile';
import { categories } from '../../data/categories';
import { usePublicServices } from '../../features/services/usePublicServices';
import { subscribeServiceSelection } from '../../features/services/selection';
import { catalogInquiriesEnabled } from '../../features/services/service';
import { catalogInquiryServices } from '../../../supabase/functions/_shared/inquiryValidation';
import { localized } from '../../i18n/content';
import ContactIcon from '../../assets/Icons/Contact.svg?react'
import LocationIcon from '../../assets/Icons/Location.svg?react'
import PhoneIcon from '../../assets/Icons/Phone.svg?react'
import MailIcon from '../../assets/Icons/Mail.svg?react'
export const Contact = () => {
    const { t, i18n } = useTranslation();
    const config=inquiryConfiguration();
    const catalog=catalogInquiriesEnabled();
    const publicCatalog=usePublicServices();
    const [selectedService,setSelectedService]=useState('');
    const options=catalog?publicCatalog.services.filter(service=>service.acceptsInquiries):categories;
    useEffect(()=>catalog?subscribeServiceSelection(setSelectedService):undefined,[catalog]);
    const [busy,setBusy]=useState(false);
    const [failure,setFailure]=useState(null);
    const [captchaToken,setCaptchaToken]=useState('');
    const [captchaVersion,setCaptchaVersion]=useState(0);
    const submission=useRef(null);
    const submitting=useRef(false);
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
                    <p className={styles.notice} id="form-notice">{t(config?'inquiry.notice':'contact.notice')}</p>

                    <form noValidate aria-describedby="form-notice" onSubmit={async(event) => {
                        event.preventDefault();
                        if(submitting.current)return;
                        const form=event.currentTarget;
                        const values=Object.fromEntries(new FormData(form));
                        const payload=normalizeInquiry({...values,description:values.message,privacyConsent:values.privacyConsent==='on',language:i18n.resolvedLanguage});
                        const nextErrors=config?inquiryErrors(payload,catalog?catalogInquiryServices:undefined):validateContact(values);
                        setErrors(nextErrors);setAttempted(false);setFailure(null);
                        const firstInvalid=Object.keys(nextErrors)[0];
                        if(firstInvalid){form.elements.namedItem(firstInvalid==='description'?'message':firstInvalid)?.focus();return;}
                        if(!config){setAttempted(true);return;}
                        if(!captchaToken){setFailure('inquiry.captchaError');return;}
                        const signature=JSON.stringify({...payload,catalog});
                        if(!submission.current || submission.current.signature!==signature)submission.current={signature,key:crypto.randomUUID()};
                        submitting.current=true;setBusy(true);
                        try {
                            await submitInquiry(config,{...payload,submissionKey:submission.current.key,captchaToken,...(catalog?{catalogVersion:2}:{}),website:values.website||''});
                            form.reset();setSelectedService('');submission.current=null;setAttempted(true);
                        }catch(error){setFailure(error.message?.startsWith('inquiry.')?error.message:'inquiry.unavailable');}
                        finally{submitting.current=false;setBusy(false);setCaptchaToken('');setCaptchaVersion(v=>v+1);}
                    }}>
                        <label htmlFor="contact-name">{t('form.name')}</label>
                        <input
                            id="contact-name" name="fullName" maxLength={240}
                            aria-invalid={Boolean(errors.fullName)}
                            aria-describedby={errors.fullName ? 'contact-name-error' : undefined} autoComplete="name"
                            type="text"
                            placeholder={t('form.name')}
                            required disabled={busy}
                        />
                        {errors.fullName && <p className={styles.fieldError} id="contact-name-error" role="alert">{t(errors.fullName)}</p>}

                        <label htmlFor="contact-phone">{t('form.phone')}</label>
                        <input
                            id="contact-phone" name="phone" maxLength={30}
                            aria-invalid={Boolean(errors.phone)}
                            aria-describedby={errors.phone ? 'contact-phone-error' : undefined} autoComplete="tel"
                            type="tel"
                            placeholder={t('form.phone')}
                            required disabled={busy}
                        />
                        {errors.phone && <p className={styles.fieldError} id="contact-phone-error" role="alert">{t(errors.phone)}</p>}

                        <label htmlFor="contact-email">{t('form.email')}</label>
                        <input
                            id="contact-email" name="email" maxLength={508} disabled={busy}
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? 'contact-email-error' : undefined} autoComplete="email"
                            type="email"
                            placeholder={t('form.email')}
                        />
                        {errors.email && <p className={styles.fieldError} id="contact-email-error" role="alert">{t(errors.email)}</p>}

                        {config && <>
                            <label htmlFor="contact-service">{t('inquiry.service')}</label>
                            <select id="contact-service" name="service" value={options.some(service=>service.id===selectedService)?selectedService:''} onChange={e=>setSelectedService(e.target.value)} required disabled={busy || (catalog && (publicCatalog.loading || publicCatalog.error))} aria-invalid={Boolean(errors.service)} aria-describedby={errors.service?'contact-service-error':undefined}>
                                <option value="">{t('inquiry.selectService')}</option>
                                {options.map(service=><option key={service.id} value={service.id}>{localized(service.title,i18n.resolvedLanguage)}</option>)}
                            </select>
                            {catalog && publicCatalog.loading && <p role="status">{t('sm.loading')}</p>}
                            {catalog && publicCatalog.error && <p role="alert">{t('sm.unavailable')} <button type="button" onClick={publicCatalog.retry}>{t('admin.retry')}</button></p>}
                            {catalog && !publicCatalog.loading && !publicCatalog.error && !options.length && <p role="status">{t('sm.empty')}</p>}
                            {errors.service && <p id="contact-service-error" className={styles.fieldError} role="alert">{t(errors.service)}</p>}
                            <label htmlFor="contact-location">{t('inquiry.location')}</label>
                            <input id="contact-location" name="location" maxLength={600} required disabled={busy} aria-invalid={Boolean(errors.location)} aria-describedby={errors.location?'contact-location-error':undefined} />
                            {errors.location && <p id="contact-location-error" className={styles.fieldError} role="alert">{t(errors.location)}</p>}
                        </>}
                        <label htmlFor="contact-message">{t('form.message')}</label>
                        <textarea
                            id="contact-message" name="message" maxLength={10000} required={Boolean(config)} disabled={busy} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description?'contact-description-error':undefined}
                            placeholder={t('form.message')}>
                        </textarea>

                        {errors.description && <p id="contact-description-error" className={styles.fieldError} role="alert">{t(errors.description)}</p>}
                        {config && <>
                            <label className={styles.consent}><input type="checkbox" name="privacyConsent" required disabled={busy} aria-invalid={Boolean(errors.privacyConsent)} aria-describedby={errors.privacyConsent?'contact-consent-error':undefined} />{t('inquiry.consent')}</label>
                            {errors.privacyConsent && <p id="contact-consent-error" className={styles.fieldError} role="alert">{t(errors.privacyConsent)}</p>}
                            <div hidden aria-hidden="true"><label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></div>
                            <Turnstile siteKey={config.siteKey} onToken={setCaptchaToken} resetKey={captchaVersion} />
                        </>}
                        {failure && <p role="alert" className={styles.fieldError}>{t(failure)}</p>}
                        <button type="submit" disabled={busy || (catalog && (publicCatalog.loading || publicCatalog.error || !options.length))} aria-busy={busy}>
                            {t(busy?'inquiry.sending':'actions.request')} <span aria-hidden="true">↗</span>
                        </button>
                        <p role="status" hidden={!attempted}>{attempted && t(config?'inquiry.saved':'contact.unsent')}</p>
                    </form>
                </div>

            </div>
        </section>
    )
}