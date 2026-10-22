import RequireAdmin from './RequireAdmin';
export default function RequireAdminRole() {
    return <RequireAdmin roles={['admin']} />;
}
