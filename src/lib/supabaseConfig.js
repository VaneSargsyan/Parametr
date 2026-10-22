export function readSupabaseConfig(env = {}) {
    const url = env.VITE_SUPABASE_URL?.trim();
    const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim();
    if (!url || !key || /your-|placeholder/i.test(`${url} ${key}`)) return null;
    try {
        const parsed = new URL(url);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
        if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return null;
        if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null;
        if (key.startsWith('sb_publishable_') && key.length > 20) return { url: parsed.origin, key };
        // Legacy frontend keys must explicitly be anon JWTs. Secret/service keys fail closed.
        const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (key.split('.').length !== 3 || payload.role !== 'anon') return null;
        return { url: parsed.origin, key };
    } catch { return null; }
}

export function isUnsafeBrowserKey(value) {
    if (typeof value !== 'string') return false;
    if (value.includes('sb_secret_')) return true;
    try {
        const payload = JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload.role === 'service_role';
    } catch { return false; }
}
