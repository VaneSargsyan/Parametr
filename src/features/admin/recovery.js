export const recoveryPath = '/admin/reset-password';

export function recoveryDestination(location) {
    if (location.pathname === recoveryPath) return null;
    const hash = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    if (hash.get('type') === 'recovery' || hash.has('error') || query.has('error')) {
        return recoveryPath + location.search + location.hash;
    }
    return null;
}

export function parseRecoveryLink(url, now = Date.now()) {
    const hash = new URLSearchParams(url.hash.slice(1));
    const query = url.searchParams;
    if (hash.has('error') || query.has('error')) return null;
    if (hash.get('type') !== 'recovery' || !hash.get('access_token') || !hash.get('refresh_token')) return null;
    if (hash.getAll('access_token').length !== 1 || hash.getAll('refresh_token').length !== 1) return null;
    try {
        const token = hash.get('access_token');
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        // Reject expired links BEFORE setSession could refresh them. This is not signature verification.
        if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= now) return null;
        return { access_token: token, refresh_token: hash.get('refresh_token'), expiresAt: payload.exp * 1000 };
    } catch { return null; }
}

export function validateRecoveryPassword(password, confirmation) {
    if (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 72) return 'recovery.passwordRule';
    if (password !== confirmation) return 'recovery.mismatch';
    return null;
}

export function recoveryError(error) {
    if (error?.status === 429) return 'admin.errors.rateLimit';
    if (error?.code === 'weak_password' || error?.code === 'same_password') return 'recovery.passwordRejected';
    if (error instanceof TypeError || error?.name === 'AuthRetryableFetchError') return 'admin.errors.network';
    return 'recovery.invalid';
}

// Only an isolated, non-persistent SDK client may be supplied here.
export function createRecoveryController(client) {
    let verified = null;
    return {
        async verify(link) {
            verified = null;
            if (!client) return 'admin.errors.configuration';
            if (!link || link.expiresAt <= Date.now()) return 'recovery.invalid';
            try {
                const result = await client.auth.setSession({ access_token: link.access_token, refresh_token: link.refresh_token });
                if (result.error || !result.data?.session) throw result.error || new Error();
                const identity = await client.auth.getUser(link.access_token);
                if (identity.error || !identity.data?.user || identity.data.user.id !== result.data.session.user.id) throw identity.error || new Error();
                if (link.expiresAt <= Date.now()) return 'recovery.invalid';
                verified = { id: identity.data.user.id, expiresAt: link.expiresAt };
                return null;
            } catch (error) { return recoveryError(error); }
        },
        async update(password, confirmation) {
            const invalid = validateRecoveryPassword(password, confirmation);
            if (invalid) return invalid;
            if (!verified || verified.expiresAt <= Date.now()) { verified = null; return 'recovery.invalid'; }
            try {
                const identity = await client.auth.getUser();
                if (identity.error || identity.data?.user?.id !== verified.id || verified.expiresAt <= Date.now()) { verified = null; return 'recovery.invalid'; }
                const result = await client.auth.updateUser({ password });
                if (result.error) return recoveryError(result.error);
                if (result.data?.user?.id !== verified.id) { verified = null; return 'recovery.invalid'; }
                verified = null;
                // No persistent/shared admin session is created. Invalidate this browser's recovery session.
                await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
                return null;
            } catch (error) { return recoveryError(error); }
        },
    };
}
