import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from './AuthContext';
import { accessDecision } from './authController';
import AdminFrame from './AdminFrame';
import AuthStatus from './AuthStatus';

export default function RequireAdmin({ roles }) {
    const { state } = useAdminAuth();
    const decision = accessDecision(state, roles);
    if (decision === 'anonymous') return <Navigate to="/admin/login" replace />;
    if (decision === 'allowed') return <Outlet />;
    return <AdminFrame><AuthStatus denied={decision === 'denied'} /></AdminFrame>;
}
