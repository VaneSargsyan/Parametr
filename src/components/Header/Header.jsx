import { Link } from 'react-router-dom';
import styles from './Header.module.css';
export const Header = () => (
    <Link to="/" className={styles.brand} aria-label="Պարամետր · Գլխավոր">
        <svg className={styles.mark} viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M4 35V5h24v22H15V16h24M4 35h11V16" stroke="currentColor" strokeWidth="2" />
            <path d="M31 5h5M35 4v5" stroke="currentColor" />
        </svg>
        <span>ՊԱՐԱՄԵՏՐ<span className={styles.caption}>Գաղափարից մինչև իրականացում</span></span>
    </Link>
);
