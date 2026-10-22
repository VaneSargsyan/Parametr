import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from './supabaseConfig';

export function createRecoveryClient() {
    const config = readSupabaseConfig(import.meta.env);
    return config ? createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'parametr-recovery-isolated' },
    }) : null;
}
