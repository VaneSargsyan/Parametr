import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
import { readSupabaseConfig, isUnsafeBrowserKey } from '../src/lib/supabaseConfig.js';
import { accessDecision, authErrorKey, createAuthController, verifyStaff } from '../src/features/admin/authController.js';

// All SDK doubles stay in this test process. No runtime mocks or live credentials.
const token = role => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
assert.equal(readSupabaseConfig({}), null);
assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://your-project-ref.supabase.co', VITE_SUPABASE_ANON_KEY: 'placeholder' }), null);
for (const key of [token('service_role'), 'sb_secret_TEST_ONLY', token('authenticated'), 'bad-key']) {
    assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: key }), null);
}
assert(isUnsafeBrowserKey('sb_secret_TEST_ONLY'));
assert(isUnsafeBrowserKey(token('service_role')));
assert(!isUnsafeBrowserKey(token('anon')));
assert(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: token('anon') }));
assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://remote.invalid', VITE_SUPABASE_ANON_KEY: token('anon') }), null);
assert(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_TEST_ONLY_VALUE' }));

const session = { access_token: 'TEST_ONLY_NOT_A_REAL_TOKEN', user: { id: 'forged-cache', user_metadata: { role: 'admin' } } };
const user = { id: 'verified-user', email: 'staff@example.invalid' };
function sdk(initialSession = session) {
    let currentSession = initialSession;
    let callback;
    const client = {
        rpcResult: { data: { user_id: user.id, role: 'editor' }, error: null },
        userResult: { data: { user }, error: null },
        logoutError: null,
        signinError: null,
        unsubscribed: false,
        auth: {
            getSession: async () => ({ data: { session: currentSession }, error: null }),
            getUser: async accessToken => { assert.equal(accessToken, session.access_token); return client.userResult; },
            onAuthStateChange: handler => {
                callback = handler;
                return { data: { subscription: { unsubscribe() { callback = null; client.unsubscribed = true; } } } };
            },
            signInWithPassword: async credentials => {
                assert.equal(credentials.email, 'staff@example.invalid');
                if (client.signinError) return { error: client.signinError };
                currentSession = session;
                callback?.('SIGNED_IN', session);
                return { error: null };
            },
            signOut: async options => {
                assert.equal(options.scope, 'local');
                if (client.logoutError) return { error: client.logoutError };
                currentSession = null;
                callback?.('SIGNED_OUT', null);
                return { error: null };
            },
        },
        rpc: async name => { assert.equal(name, 'get_admin_context'); return client.rpcResult; },
        emit(event, nextSession) { currentSession = nextSession; callback?.(event, nextSession); },
    };
    return client;
}
assert.deepEqual(await verifyStaff(sdk(), null), { status: 'anonymous' });
const client = sdk();
assert.equal((await verifyStaff(client, session)).role, 'editor', 'Cached admin claim must not override verified database role');
client.rpcResult = { data: null, error: { code: '42501' } };
assert.equal((await verifyStaff(client, session)).status, 'denied');
client.rpcResult = { data: { user_id: user.id, role: 'owner' }, error: null };
assert.equal((await verifyStaff(client, session)).status, 'denied');
client.rpcResult = { data: { user_id: 'another-user', role: 'admin' }, error: null };
assert.equal((await verifyStaff(client, session)).status, 'denied');
client.userResult = { data: null, error: { status: 401 } };
assert.equal((await verifyStaff(client, session)).status, 'anonymous');
client.auth.getUser = async () => { throw new TypeError('Offline'); };
assert.equal((await verifyStaff(client, session)).errorKey, 'admin.errors.network');
assert.equal(authErrorKey({ code: 'invalid_credentials' }), 'admin.errors.credentials');
assert.equal(authErrorKey({ status: 429 }), 'admin.errors.rateLimit');
assert.equal(authErrorKey({ code: 'timeout' }), 'admin.errors.network');

for (const status of ['anonymous', 'loading', 'unconfigured', 'error', 'denied']) assert.notEqual(accessDecision({ status }), 'allowed');
assert.equal(accessDecision({ status: 'authorized', role: 'editor' }), 'allowed');
assert.equal(accessDecision({ status: 'authorized', role: 'editor' }, ['admin']), 'denied');
assert.equal(accessDecision({ status: 'authorized', role: 'admin' }, ['admin']), 'allowed');
assert.equal(createAuthController(null).getSnapshot().status, 'unconfigured');

async function settle(controller) {
    for (let i = 0; i < 100; i++) {
        if (controller.getSnapshot().status !== 'loading') return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Controller did not settle');
}
const restoring = sdk();
const controller = createAuthController(restoring);
const stop = controller.start();
try {
    await settle(controller);
    assert.equal(controller.getSnapshot().status, 'authorized');
    assert.equal(controller.getSnapshot().user.id, user.id);
    const background = controller.reload();
    assert.equal(controller.getSnapshot().status,'authorized','Background verification must preserve the editor while checking');
    await background;
    restoring.rpcResult = { data: null, error: { code: '42501' } };
    await controller.reload();
    assert.equal(controller.getSnapshot().status, 'denied', 'Revoked membership must close access');
    restoring.rpcResult = { data: { user_id: user.id, role: 'editor' }, error: null };
    restoring.logoutError = { status: 500 };
    await controller.signOut();
    assert.equal(controller.getSnapshot().status, 'error');
    assert.equal(controller.getSnapshot().errorKey, 'admin.errors.logout');
    restoring.logoutError = null;
    await controller.signOut();
    assert.equal(controller.getSnapshot().status, 'anonymous');
    restoring.signinError = { code: 'invalid_credentials' };
    assert.equal(await controller.signIn('staff@example.invalid', 'TEST_ONLY_PASSWORD'), 'admin.errors.credentials');
    assert.equal(controller.getSnapshot().status, 'anonymous');
    restoring.signinError = null;
    assert.equal(await controller.signIn(' staff@example.invalid ', 'TEST_ONLY_PASSWORD'), null);
    await settle(controller);
    assert.equal(controller.getSnapshot().status, 'authorized');
} finally { stop(); }
assert(restoring.unsubscribed);
const racing = sdk();
let resolveIdentity;
racing.auth.getUser = () => new Promise(resolve => { resolveIdentity = resolve; });
const raceController = createAuthController(racing);
const stopRace = raceController.start();
try {
    await new Promise(resolve => setTimeout(resolve, 5));
    racing.emit('SIGNED_OUT', null);
    await settle(raceController);
    assert.equal(raceController.getSnapshot().status, 'anonymous');
    resolveIdentity({ data: { user }, error: null });
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(raceController.getSnapshot().status, 'anonymous', 'Late identity result must not resurrect access');
} finally { stopRace(); }

globalThis.window = { matchMedia: () => ({ matches: true }) };
const server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
    define: { 'import.meta.env.VITE_PROJECTS_SOURCE': '"local"', 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""' },
});
try {
    const { default: i18n } = await server.ssrLoadModule('/src/i18n/index.js');
    const { AuthContext } = await server.ssrLoadModule('/src/features/admin/AuthContext.js');
    const { default: RequireAdmin } = await server.ssrLoadModule('/src/features/admin/RequireAdmin.jsx');
    const { default: AdminLogin } = await server.ssrLoadModule('/src/features/admin/AdminLogin.jsx');
    const { default: AdminDashboard } = await server.ssrLoadModule('/src/features/admin/AdminDashboard.jsx');
    const { routes } = await server.ssrLoadModule('/src/router/routes.jsx');
    const initialize = async router => {
        if (router.state.initialized) return;
        await new Promise(resolve => { const unsubscribe = router.subscribe(state => { if (state.initialized) { unsubscribe(); resolve(); } }); });
    };
    const actions = { reload() {}, signOut() {}, signIn() {} };
    let renders = 0;
    for (const language of ['hy', 'en', 'ru']) {
        await i18n.changeLanguage(language);
        for (const path of ['/', '/projects/private-house-construction', '/admin', '/admin/login', '/admin/projects', '/admin/settings']) {
            const router = createMemoryRouter(routes, { initialEntries: [path] });
            try {
                await initialize(router);
                const html = renderToStaticMarkup(React.createElement(RouterProvider, { router }));
                if (path.startsWith('/admin')) assert(html.includes(i18n.t('admin.unconfigured')));
                else {
                    assert(!html.includes(i18n.t('admin.unconfigured')));
                    assert(html.includes(i18n.t(path === '/' ? 'hero.title' : 'project.gallery')));
                }
                renders++;
            } finally { router.dispose(); }
        }
        for (const state of [{ status: 'anonymous' }, { status: 'denied' }, { status: 'error', errorKey: 'admin.errors.network' }, { status: 'authorized', role: 'editor', user }]) {
            const router = createMemoryRouter([{
                element: React.createElement(AuthContext.Provider, { value: { state, controller: actions } }, React.createElement(Outlet)),
                children: [{ element: React.createElement(RequireAdmin), children: [{ path: '/admin', element: React.createElement(AdminDashboard) }] }],
            }], { initialEntries: ['/admin'] });
            try {
                const html = renderToStaticMarkup(React.createElement(RouterProvider, { router }));
                assert.equal(html.includes(user.email), state.status === 'authorized');
                if (state.status === 'authorized') assert(html.includes(i18n.t('admin.roles.editor')));
                renders++;
            } finally { router.dispose(); }
        }
        for (const role of ['editor', 'admin']) {
            const state = { status: 'authorized', role, user };
            const restricted = createMemoryRouter([{
                element: React.createElement(AuthContext.Provider, { value: { state, controller: actions } }, React.createElement(Outlet)),
                children: [{ element: React.createElement(RequireAdmin, { roles: ['admin'] }), children: [{ path: '/admin/settings', element: React.createElement(AdminDashboard) }] }],
            }], { initialEntries: ['/admin/settings'] });
            try {
                const html = renderToStaticMarkup(React.createElement(RouterProvider, { router: restricted }));
                assert.equal(html.includes(user.email), role === 'admin');
                assert(html.includes(i18n.t(role === 'admin' ? 'admin.placeholder' : 'admin.deniedDescription')));
                renders++;
            } finally { restricted.dispose(); }
        }
        const router = createMemoryRouter([{ path: '/admin/login', element: React.createElement(AuthContext.Provider, { value: { state: { status: 'anonymous' }, controller: actions } }, React.createElement(AdminLogin)) }], { initialEntries: ['/admin/login'] });
        try {
            const html = renderToStaticMarkup(React.createElement(RouterProvider, { router }));
            assert(html.includes('type="password"') && html.includes(i18n.t('admin.loginTitle')));
            renders++;
        } finally { router.dispose(); }
    }
    console.log(`PASS: config/key safety, verified identity and database membership, role gates, restoration, revocation, login/logout errors, stale-session race, cleanup; ${renders} admin/public localized renders with credentials disabled.`);
    console.log('SDK doubles and server renders do not verify live Supabase Auth, SQL/RLS execution, browser redirects or refresh.');
} finally { await server.close(); delete globalThis.window; }
assert(fs.existsSync('supabase/tests/admin_auth.sql'));
