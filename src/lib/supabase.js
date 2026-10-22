import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from './supabaseConfig';

let client;
export function getSupabaseClient() {
    const config = readSupabaseConfig(import.meta.env);
    if (!config) return null;
    if (!client) client = createClient(config.url, config.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    return client;
}
