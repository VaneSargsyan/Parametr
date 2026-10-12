import { Link } from 'react-router-dom';
import { Header } from '../Header';
import styles from './Footer.module.css';
export const Footer = () => (
    <footer className={styles.footer}>
        <div className={styles.inner}>
            <div className={styles.brand}><Header /><p>Գեոդեզիա, նախագծում, կառուցապատում և համալիր շինարարական լուծումներ։</p></div>
            <nav aria-label="Ստորին նավարկում"><h2>Բացահայտել</h2>
                <Link to="/#services">Ծառայություններ</Link><Link to="/#projects">Նախագծեր</Link><Link to="/#about">Մեր մասին</Link>
            </nav>
            <div className={styles.contact}><h2>Կապ մեզ հետ</h2><a href="tel:+37455106070">055 10 60 70</a><a href="mailto:parametr.sp@gmail.com">parametr.sp@gmail.com</a><p>Կոտայքի մարզ, գյուղ Քանաքեռավան,<br />Անանիա Շիրակացի 33</p></div>
            <div className={styles.bottom}><span>© {new Date().getFullYear()} Պարամետր</span><Link to="/#main">Վերադառնալ սկիզբ <span aria-hidden="true">↑</span></Link></div>
        </div>
    </footer>
);
