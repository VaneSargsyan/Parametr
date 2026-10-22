import { MainLayout } from '../Layouts/MainLayout';
import ProjectDetails from '../pages/ProjectDetails/ProjectDetails';
import ErrorPage from '../pages/ErrorPage/ErrorPage';

const adminRoutes = {
    path: '/admin',
    lazy: async () => ({ Component: (await import('../features/admin/AuthProvider')).default }),
    errorElement: <ErrorPage />,
    children: [
        { path: 'login', lazy: async () => ({ Component: (await import('../features/admin/AdminLogin')).default }) },
        {
            lazy: async () => ({ Component: (await import('../features/admin/RequireAdmin')).default }),
            children: [
                { index: true, lazy: async () => ({ Component: (await import('../features/admin/AdminDashboard')).default }) },
                { path: 'projects', lazy: async () => ({ Component: (await import('../features/admin/AdminDashboard')).default }) },
                { path: 'services', lazy: async () => ({ Component: (await import('../features/admin/AdminDashboard')).default }) },
                {
                    lazy: async () => ({ Component: (await import('../features/admin/RequireAdminRole')).default }),
                    children: [
                        { path: 'requests', lazy: async () => ({ Component: (await import('../features/admin/AdminDashboard')).default }) },
                        { path: 'settings', lazy: async () => ({ Component: (await import('../features/admin/AdminDashboard')).default }) },
                    ],
                },
            ],
        },
    ],
};

export const routes = [
    { path: '/', element: <MainLayout />, errorElement: <ErrorPage /> },
    { path: '/projects/:slug', element: <ProjectDetails />, errorElement: <ErrorPage /> },
    { path: '/admin/forgot-password', lazy: async () => ({ Component: (await import('../features/admin/AdminRecovery')).default }) },
    { path: '/admin/reset-password', lazy: async () => {
        const { default: Recovery } = await import('../features/admin/AdminRecovery');
        return { Component: () => <Recovery reset /> };
    } },
    adminRoutes,
    { path: '*', element: <ErrorPage /> },
];
