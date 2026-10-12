import './MainLayout.css';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Footer } from '../components/Footer/Footer';
import { Navbar } from '../components/Navbar/Navbar';
import { TitleSection } from '../components/TitleSection';
import { Services } from '../components/Services/Services';
import { Steps } from '../components/Steps';
import { Projects } from '../components/Projects';
import { AboutUs } from '../components/AboutUs/AboutUs';
import { Contact } from '../components/Contact';

export const MainLayout = () => {
    usePageMetadata();
    const { hash, key } = useLocation();
    useEffect(() => {
        if (!hash) return;
        const frame = requestAnimationFrame(() => {
            document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
        });
        return () => cancelAnimationFrame(frame);
    }, [hash, key]);

    return (
        <div className="wrapper main-wrapper">
            <Navbar />
            <main>
                <div className="main"><TitleSection /></div>
                <Services />
                <Projects />
                <Steps />
                <AboutUs />
                <Contact />
            </main>
            <Footer />
        </div>
    );
};
