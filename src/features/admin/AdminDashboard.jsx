import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { useAdminAuth } from './AuthContext';
import AdminFrame from './AdminFrame';
import RequestsAdmin from '../requests/RequestsAdmin';
import ServicesAdmin from '../services/ServicesAdmin';
import ProjectsAdmin from '../projects/ProjectsAdmin';
import styles from './Admin.module.css';

const sections = [
    { id: 'overview', path: '/admin' },
    { id: 'projects', path: '/admin/projects' },
    { id: 'services', path: '/admin/services' },
    { id: 'requests', path: '/admin/requests', adminOnly: true },
    { id: 'settings', path: '/admin/settings', adminOnly: true },
];
export default function AdminDashboard() {
    const { t } = useTranslation();
    const { state, controller } = useAdminAuth();
    const { pathname } = useLocation();
    const section = sections.find(item => item.path === pathname)?.id || 'overview';
    return <AdminFrame>
        <div className={styles.identity}>
            <div><p>{t('admin.account')}: {state.user.email}</p><p>{t('admin.role')}: {t(`admin.roles.${state.role}`)}</p></div>
            <button className={styles.button} type="button" onClick={() => controller.signOut()}>{t('admin.logout')}</button>
        </div>
        <div className={styles.layout}>
            <nav className={styles.sidebar} aria-label={t('admin.navigation')}>
                {sections.map(item => (!item.adminOnly || state.role === 'admin') && <NavLink key={item.id} to={item.path} end>{t(`admin.${item.id}`)}</NavLink>)}
            </nav>
            <section className={styles.panel}><h1>{t(`admin.${section}`)}</h1>
                {section === 'requests' ? <RequestsAdmin /> : section === 'services' ? <ServicesAdmin /> : section === 'projects' ? <ProjectsAdmin /> : section === 'overview' ? <><p>{t('admin.ready')}</p><p>{t('admin.foundation')}</p></> : <p role="status">{t('admin.placeholder')}</p>}
            </section>
        </div>
    </AdminFrame>;
}
