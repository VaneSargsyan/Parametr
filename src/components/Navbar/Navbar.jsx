import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { LanguageSwitcher } from '../LanguageSwitcher/LanguageSwitcher';
import { Header } from '../Header';
import styles from './Navbar.module.css';
const links = ['main', 'services', 'projects', 'about', 'contact'];
export const Navbar = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const toggleRef = useRef(null);
    return (
        <header className={styles.header}>
            <a className="skip-link" href="#main">{t('nav.skip')}</a>
            <div className={styles.inner}>
                <Header />
                <nav aria-label={t('nav.main')} onKeyDown={(event) => {
                    if (event.key === 'Escape' && open) {
                        setOpen(false);
                        toggleRef.current?.focus();
                    }
                }}>
                    <button ref={toggleRef} className={styles.burger} type="button"
                        aria-label={t(open ? 'nav.close' : 'nav.open')}
                        aria-expanded={open} aria-controls="primary-navigation"
                        onClick={() => setOpen(value => !value)}>{open ? '✕' : '☰'}</button>
                    <ul id="primary-navigation" className={`${styles.links} ${open ? styles.open : ''}`}>
                        {links.map(id => <li key={id}><a href={`#${id}`} onClick={() => setOpen(false)}>{t(`nav.${id}`)}</a></li>)}
                    </ul>
                </nav>
                <LanguageSwitcher />
                <a className={styles.cta} href="#contact">{t('actions.request')} <span aria-hidden="true">↗</span></a>
            </div>
        </header>
    );
};
