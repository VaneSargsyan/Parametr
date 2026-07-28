
import { Link } from 'react-router-dom'
import styles from './Header.module.css'

export const Header = () => {
    return (
        <header className={styles['header']}>
            <div className={styles["header-top"]}>
                <Link to={'/'} className={styles["header-title"]}>
                    <h3>Parameter</h3>
                </Link>
            </div>
        </header>
    )
}