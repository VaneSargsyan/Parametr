import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '../Layouts/MainLayout';
import ProjectDetails from '../pages/ProjectDetails/ProjectDetails';
import ErrorPage from '../pages/ErrorPage/ErrorPage';

export const router = createBrowserRouter([
    { path: '/', element: <MainLayout />, errorElement: <ErrorPage /> },
    { path: '/projects/:slug', element: <ProjectDetails />, errorElement: <ErrorPage /> },
    { path: '*', element: <ErrorPage /> },
]);
