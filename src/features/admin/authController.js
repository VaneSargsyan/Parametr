export const staffRoles = ['admin', 'editor'];

export function accessDecision(state, roles = staffRoles) {
    if (state.status !== 'authorized') return state.status;
    return roles.includes(state.role) ? 'allowed' : 'denied';
}

export function authErrorKey(error) {
    if (error?.code === 'invalid_credentials') return 'admin.errors.credentials';
    if (error?.code === 'email_not_confirmed') return 'admin.errors.unconfirmed';
    if (error?.status === 429 || error?.code === 'over_request_rate_limit') return 'admin.errors.rateLimit';
    if (error?.name === 'AuthRetryableFetchError' || error instanceof TypeError || error?.code === 'timeout') return 'admin.errors.network';
    if (error?.status === 401 || error?.code === 'refresh_token_not_found' || error?.code === 'refresh_token_already_used' || error?.name === 'AuthSessionMissingError') return 'admin.errors.expired';
    return 'admin.errors.unavailable';
}

async function bounded(operation) {
    let timer;
    try {
        return await Promise.race([operation, new Promise((_, reject) => {
            timer = setTimeout(() => reject({ code: 'timeout' }), 15000);
        })]);
    } finally { clearTimeout(timer); }
}

// A cached session is only a restoration hint, never the authorization decision.
export async function verifyStaff(client, session) {
    if (!session?.access_token) return { status: 'anonymous' };
    try {
        const { data, error } = await bounded(client.auth.getUser(session.access_token));
        if (error) throw error;
        if (!data?.user) return { status: 'anonymous', errorKey: 'admin.errors.expired' };
        const { data: staff, error: staffError } = await bounded(client.rpc('get_admin_context'));
        if (staffError?.code === '42501') return { status: 'denied', user: data.user };
        if (staffError) throw staffError;
        if (!staff || staff.user_id !== data.user.id || !staffRoles.includes(staff.role)) return { status: 'denied', user: data.user };
        return { status: 'authorized', user: data.user, role: staff.role };
    } catch (error) {
        const errorKey = authErrorKey(error);
        return { status: errorKey === 'admin.errors.expired' ? 'anonymous' : 'error', errorKey };
    }
}

export function createAuthController(client) {
    let state = { status: client ? 'loading' : 'unconfigured' };
    let generation = 0;
    let started = false;
    const listeners = new Set();
    const timers = new Set();
    const publish = next => { state = next; listeners.forEach(listener => listener()); };
    const apply = async (session, ticket) => {
        const next = await verifyStaff(client, session);
        if (started && ticket === generation) publish(next);
    };
    const reload = async () => {
        if (!client || !started) return;
        const ticket = ++generation;
        publish(state.status === 'authorized' ? { ...state, checking: true } : { status: 'loading' });
        try {
            const { data, error } = await bounded(client.auth.getSession());
            if (error) throw error;
            if (ticket === generation && started) await apply(data.session, ticket);
        } catch (error) {
            if (ticket === generation && started) publish({ status: 'error', errorKey: authErrorKey(error) });
        }
    };
    return {
        getSnapshot: () => state,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        reload,
        start() {
            if (!client) return () => {};
            started = true;
            const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
                if (event === 'INITIAL_SESSION') return; // Explicit restoration below.
                const ticket = ++generation;
                publish(event === 'TOKEN_REFRESHED' && state.status === 'authorized' ? { ...state, checking: true } : { status: 'loading' });
                // SDK calls run outside the synchronous Auth callback to avoid its lock.
                const timer = setTimeout(() => { timers.delete(timer); if (ticket === generation && started) void apply(session, ticket); }, 0);
                timers.add(timer);
            });
            void reload();
            const onFocus = () => {
                if (['authorized', 'denied'].includes(state.status)) void reload();
            };
            if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);
            const interval = setInterval(onFocus, 60000);
            return () => {
                started = false;
                generation++;
                subscription.unsubscribe();
                clearInterval(interval);
                timers.forEach(clearTimeout);
                timers.clear();
                if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
            };
        },
        async signIn(email, password) {
            if (!client) return 'admin.errors.configuration';
            try {
                const { error } = await bounded(client.auth.signInWithPassword({ email: email.trim(), password }));
                if (error) return authErrorKey(error);
                await reload();
                return null;
            } catch (error) { return authErrorKey(error); }
        },
        async signOut() {
            if (!client) return;
            generation++;
            publish({ status: 'loading' });
            try {
                const { error } = await bounded(client.auth.signOut({ scope: 'local' }));
                if (error) throw error;
                generation++;
                publish({ status: 'anonymous' });
            } catch {
                generation++;
                publish({ status: 'error', errorKey: 'admin.errors.logout' });
            }
        },
    };
}
