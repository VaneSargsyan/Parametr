import { createContext, useContext } from 'react';
export const AuthContext = createContext(null);
export function useAdminAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('Admin auth provider is required');
    return context;
}
