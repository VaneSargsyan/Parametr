import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from './supabaseConfig';
let client;
export function getPublicSupabaseClient() {
    const config = readSupabaseConfig(import.meta.env);
    if (!config) return null;
    // Never use the persisted employee session for public portfolio requests.
    if (!client) client = createClient(config.url,config.key,{ auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'parametr-public' } });
    return client;
}
