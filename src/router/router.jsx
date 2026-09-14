import { createBrowserRouter } from "react-router-dom";
import { MainLayout } from "../Layouts/MainLayout";
import ProjectDetails from '../pages/ProjectDetails/ProjectDetails';


export const router = createBrowserRouter([
    {
    path:'/',
    element:<MainLayout />
    },
    {
        path: '/projects/:slug',
        element: <ProjectDetails />,
    }
])
