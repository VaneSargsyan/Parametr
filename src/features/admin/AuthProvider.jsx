import { useEffect, useState, useSyncExternalStore } from 'react';
import { Outlet } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabase';
import { createAuthController } from './authController';
import { AuthContext } from './AuthContext';

export default function AuthProvider() {
    const [controller] = useState(() => createAuthController(getSupabaseClient()));
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    useEffect(() => controller.start(), [controller]);
    return <AuthContext.Provider value={{ state, controller }}><Outlet /></AuthContext.Provider>;
}
