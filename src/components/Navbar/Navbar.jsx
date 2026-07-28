
import { Link } from 'react-scroll'
import styles from './Navbar.module.css'
import { useState } from 'react';


export const Navbar = () => {
    const [open, setOpen] = useState(false);

    const closeMenu = () => setOpen(false);
    return (
        <>
            <nav className={styles["nav"]}>
                <div className={styles["navbar"]}>
                  
                    <div className={styles.burger} onClick={() => setOpen(!open)}>
                        {open ? "✕" : "☰"}
                    </div>
                 
                    <ul className={`${styles["nav-el"]} ${open ? styles.open : ""}`}>
                       
                        <li className={styles['nav-list']}>
                            <Link to="main" spy={true}
                                smooth={true}
                                duration={1200}
                                spy={true}
                                offset={-80}
                                onClick={closeMenu}
                            >Գլխավոր</Link>
                        </li>

                        <li className={styles['nav-list']}>
                            <Link to="services" spy={true}
                                smooth={true}
                                duration={1200}
                                spy={true}
                                offset={-80}
                                onClick={closeMenu}
                            >Ծառայություններ</Link>
                        </li>

                        <li className={styles['nav-list']}>
                            <Link to="projects" spy={true}
                                smooth={true}
                                duration={1200}
                                spy={true}
                                offset={-80}
                                onClick={closeMenu}
                            >Նախագծեր</Link>
                        </li>

                        <li className={styles['nav-list']}>
                            <Link to="about" spy={true}
                                smooth={true}
                                duration={1200}
                                spy={true}
                                offset={-80}
                                onClick={closeMenu}
                            >Մեր մասին</Link>
                        </li>

                        <li className={styles['nav-list']}>
                            <Link to="contact" spy={true}
                                smooth={true}
                                duration={1200}
                                spy={true}
                                offset={-80}
                                onClick={closeMenu}
                            >Կոնտակտ</Link>
                        </li>
                    </ul>
                </div>
            </nav>
        </>
    )
}