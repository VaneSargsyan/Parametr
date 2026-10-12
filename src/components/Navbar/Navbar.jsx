import { useRef, useState } from 'react';
import { Header } from '../Header';
import styles from './Navbar.module.css';
const links = [['main', 'Գլխավոր'], ['services', 'Ծառայություններ'], ['projects', 'Նախագծեր'], ['about', 'Մեր մասին'], ['contact', 'Կապ մեզ հետ']];
export const Navbar = () => {
    const [open, setOpen] = useState(false);
    const toggleRef = useRef(null);
    return (
        <header className={styles.header}>
            <a className="skip-link" href="#main">Անցնել բովանդակությանը</a>
            <div className={styles.inner}>
                <Header />
                <nav aria-label="Գլխավոր" onKeyDown={(event) => {
                    if (event.key === 'Escape' && open) {
                        setOpen(false);
                        toggleRef.current?.focus();
                    }
                }}>
                    <button ref={toggleRef} className={styles.burger} type="button"
                        aria-label={open ? 'Փակել ընտրացանկը' : 'Բացել ընտրացանկը'}
                        aria-expanded={open} aria-controls="primary-navigation"
                        onClick={() => setOpen(value => !value)}>{open ? '✕' : '☰'}</button>
                    <ul id="primary-navigation" className={`${styles.links} ${open ? styles.open : ''}`}>
                        {links.map(([id, label]) => <li key={id}><a href={`#${id}`} onClick={() => setOpen(false)}>{label}</a></li>)}
                    </ul>
                </nav>
                <a className={styles.cta} href="#contact">Ներկայացնել հայտ <span aria-hidden="true">↗</span></a>
            </div>
        </header>
    );
};
