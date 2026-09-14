// import { Outlet } from "react-router-dom"
import './MainLayout.css'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from "../components/Header"
import { Navbar } from "../components/Navbar/Navbar"
import { TitleSection } from "../components/TitleSection"
import { Services } from '../components/Services/Services'
import { Steps } from '../components/Steps'
import { Projects } from '../components/Projects'
import { AboutUs } from '../components/AboutUs/AboutUs'
import { Contact } from '../components/Contact'
// import { AboutUs } from '../components/AboutUs'
export const MainLayout = ( ) =>{
    const { hash, key } = useLocation();
    useEffect(() => {
        if (hash === '#projects') {
            const frame = requestAnimationFrame(() => {
                document.getElementById('projects')?.scrollIntoView({ behavior: 'instant' });
            });
            return () => cancelAnimationFrame(frame);
        }
    }, [hash, key]);
    return(
        <>
            <div className="wrapper main-wrapper">
                <main className="main">
                    <div className="header-section">
                    <Header />
                    <Navbar />
                   </div>
                   <TitleSection />

                </main>
                <Services /> 
                <Steps />
                <Projects />    
                <AboutUs />
                <Contact />
            </div>
        </>
    )
}
