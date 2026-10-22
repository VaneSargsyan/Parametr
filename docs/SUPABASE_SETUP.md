# Supabase staff authentication foundation

## Configuration

Use Node.js 22.12+ for supported development/build tooling.

1. Create/select the company-owned Supabase project. Use a separate staging project.
2. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (legacy anon JWT or `sb_publishable_...` key).
   `VITE_SUPABASE_PUBLISHABLE_KEY` is also supported and takes precedence.
3. Restart Vite after environment changes. These values are PUBLIC and enter the
   browser bundle. Never put `service_role` JWTs, `sb_secret_...`, database passwords,
   or email keys in any `VITE_` variable. Vite rejects recognized privileged Supabase
   keys before startup/build, but this is not a replacement for secret management.
   Rotate any privileged key that has previously reached a browser or repository.
4. Missing/invalid configuration disables admin authentication with a localized
   message. Public pages continue to use local content without contacting Supabase.

`.env.local` and other `.env.*` files are ignored. Only sanitized examples belong
in Git. No service-role key is needed by this frontend.

## Required Auth settings (manual)

In Supabase Authentication configuration:

- Enable Email/password authentication.
- Disable **Allow new users to sign up**, anonymous sign-ins, and unused providers.
  Hiding registration in React does not disable the public signup API.
- Keep email verification enabled for any workflow that sends verification links.
- Configure the production Site URL, restrictive redirect allowlist, password
  policy, auth rate limits, and appropriate session/refresh-token settings.
- Use HTTPS in production. MFA enforcement is not
  implemented; configure these in a subsequent security milestone.

No signup, invite acceptance or general magic-link handler is implemented.
Password recovery now has dedicated routes described below. Automatic session
detection from URLs remains disabled intentionally. Provision
employees through the trusted project Dashboard or a separately secured backend.
Do not send invitations to this app until an invitation handler is implemented.

## Migration

Review `supabase/migrations/202610120001_admin_auth.sql` and apply it to staging
using the Supabase SQL Editor, or link a Supabase CLI project and use `supabase db
push` after reviewing the migration diff. CLI setup is optional and not installed
by this repository. Apply each migration once, then repeat in production after
staging checks. No remote changes were applied during implementation.

The migration creates:

- `public.admin_users`: user UUID, constrained admin/editor role, active flag.
- Own-active-membership SELECT RLS policy; no browser INSERT/UPDATE/DELETE grants.
- `public.get_admin_context()`: authenticated SECURITY INVOKER function; RLS rejects
  non-staff/inactive users with SQLSTATE 42501.
- `private.has_staff_role(text[])`: fixed-search-path SECURITY DEFINER helper for
  future policies, based on current database membership, not editable JWT metadata.

Keep `private` OUT of exposed Data API schemas. No projects, customer requests,
images, or other business tables are introduced in this phase. When those tables
are added, every administrative query/mutation must enforce the appropriate
membership role via RLS/server authorization. React gates alone never protect data.

## Secure first-admin setup

A trusted Supabase project owner must perform both steps:

1. Verify the employee's identity. In Authentication > Users > Add user > Create
   user, create an email/password account with a strong unique password. Verify
   ownership of the email before marking it confirmed. Deliver initial credentials
   through an approved private channel, never source code, Git, SQL files, or chat.
2. Copy that user's UUID and use the SQL Editor as the project owner:

```sql
-- Replace both placeholders after verifying the intended Auth user.
insert into public.admin_users (user_id, role, active)
select id, 'admin', true from auth.users
where id = 'REPLACE_WITH_VERIFIED_AUTH_UUID'::uuid
  and email = 'REPLACE_WITH_VERIFIED_EMPLOYEE_EMAIL';
```

Verify exactly one row was inserted. Open `/admin/login` and sign in. An Auth user
without an active allowlist row must be denied. Add subsequent staff with role
`editor` or `admin` using the same trusted SQL process. No client, including an
admin, can enroll staff or change roles. Passwords never appear in this table.

Disable access with a trusted SQL operation:

```sql
update public.admin_users set active = false
where user_id = 'REPLACE_WITH_AUTH_UUID'::uuid;
```

RLS/RPC authorization checks current membership immediately on each protected data
operation. The shell rechecks on focus, auth events and every 60 seconds. Revoke
Auth sessions separately when an employee leaves. Editors can use overview,
projects and services placeholders. Requests and settings are admin-only;
future database policies must mirror that distinction when operations are added.

## Sessions and failure behavior

Supabase restores/refreshes its browser session. The app validates identity with
`getUser()` and then asks the database for current membership. A cached session or
metadata role never authorizes access. Failed/malformed/expired/network responses
hide the dashboard. Concurrent auth changes cannot restore an older authorization
result. Logout uses local scope (this browser); SDK errors are shown and access
remains blocked until retried. Other devices are not signed out by this action. Already-issued access JWTs can
remain valid until expiration; deactivating membership is the immediate database
access revocation mechanism.

Tokens use the SDK's browser storage. Protect the application from XSS, avoid
untrusted HTML, and use trusted devices for staff. No privileged key is stored by
the app. Missing database migrations or unavailable Auth services fail closed.

## Validation

- `pnpm lint`, `pnpm build`, `pnpm test:i18n`, `pnpm test:admin`.
- `test:admin` injects test-only SDK doubles to test the actual authorization
  controller, failures, restoration, races and React gate markup. These are NOT
  runtime mock authentication or evidence that a live database policy was applied.
- In a disposable Supabase database AFTER migration, run
  `supabase/tests/admin_auth.sql` with `psql -v ON_ERROR_STOP=1` or the SQL Editor as
  an owner. The test uses temporary synthetic Auth users inside a transaction and
  rolls back. It checks anon/non-staff/inactive access, role escalation, and
  admin/editor permissions. If a test aborts, roll back the transaction before
  continuing. Hosted verification requires an actual Supabase database; embedded PostgreSQL also runs the suite locally.
- Manually test real admin/editor/non-staff accounts, invalid credentials,
  refresh, session expiry, role revocation, logout, offline behavior, and languages
  on desktop/mobile. Test raw Data API/RPC access without relying on the UI.
- Check direct navigation/refresh for `/admin/login` and `/admin/*`. Vercel rewrites
  are supplied; other hosts must serve `index.html` for these paths.

No database credentials are needed for local unit/render tests. They do not prove
live Auth settings, email delivery, database execution or browser behavior.

## Projects management (Phase 4)

See [Projects setup](PROJECTS_SETUP.md) for the next migration, private Storage,
server upload function, safe legacy import, publication switch, and RLS tests.
Projects is implemented; services/settings remain placeholders. Customer Requests
Phase 1 is staging-only: see [inquiry setup](INQUIRIES_STAGING_SETUP.md).

## Hosted SQL Editor test compatibility

Run the complete `supabase/tests/admin_auth.sql` file in one execution with the
SQL Editor role set to `postgres`, after Phase 3. No Phase 4 dependency exists.
Do not use the SQL Editor's user impersonation mode or run a selected fragment.
The suite checks its starting role, refuses fixture UUID/email collisions, switches
with `SET LOCAL ROLE`, and sets matching transaction-local legacy subject and JSON
claims (including `sub`). It asserts `auth.uid()` and also tests JSON-only claims.
These settings simulate database request context; they do not verify JWT signatures,
expiration, Auth login or PostgREST's role selection.

The minimal `auth.users(id,email)` insert pattern is used in Supabase's official
SQL test examples. These rows deliberately are not login-capable Auth accounts:
no passwords, `auth.identities`, sessions, confirmation or provider tokens are
created. No Auth Admin API calls are used because those would commit outside the
rollback transaction. Do not expand fixtures into an Auth seeding workflow.

Inspect custom triggers on `auth.users` before running this on disposable staging.
Additional constraints, profile triggers expecting metadata, platform schema drift,
or different privileges can reject the minimal fixtures. Do not disable triggers
or weaken security to make the test pass. External calls and nontransactional
trigger effects cannot necessarily be undone by ROLLBACK. Local tests do not model
those hosted customizations. A final successful ROLLBACK removes transactional
fixtures and restores local settings/roles; after any error, explicitly execute
ROLLBACK and verify the transaction is closed before continuing. Never add COMMIT.

Local `pnpm test:database` now additionally runs this suite after Phase 3 alone,
checks fixture removal/role restoration, and proves a collision fails without
altering the existing identity. Hosted execution remains a manual staging check.

References: [Supabase SQL testing examples](https://supabase.com/docs/guides/local-development/testing/overview)
and [RLS role testing](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Password recovery (local application implementation)

Request page: `http://localhost:5173/admin/forgot-password`.
Recovery/update callback: **`http://localhost:5173/admin/reset-password`**.
The existing staging Site URL `http://localhost:5173` and redirect allowlist
`http://localhost:5173/**` cover that callback. No remote settings were changed.
The request uses `resetPasswordForEmail` with an exact same-origin callback;
the default implicit Supabase email template/ConfirmationURL returns token
fragments with `type=recovery`. Dashboard-generated links that default to `/`
are routed to the callback before the admin provider/public layout mounts.
Provider error callbacks at the root also receive a helpful localized error.

The recovery client has a separate storage key, persistSession=false,
autoRefreshToken=false and detectSessionInUrl=false. It never stores tokens in
localStorage or signs the normal admin client in. The callback removes query/hash
credentials with history.replaceState before verification. Missing/malformed,
expired or provider-rejected links cannot enable the password form; access-token
expiry is checked before setSession could refresh it. Supabase getUser verifies
the user remotely. A copied/forged local JWT expiry is never trusted as proof of
identity. A verified recovery session is necessarily an Auth credential, but stays
in this client's memory and is not a staff membership/admin authorization grant.
Existing normal sessions are not replaced or signed out by invalid recovery links.

Password/confirmation require at least 12 Unicode characters, at most 72 UTF-8
bytes, and equality. Supabase's configured password rules are still enforced by
updateUser; its weak/same-password responses are localized. Identity and expiry
are rechecked before updating. Success clears the form's capability and attempts
local-scope sign-out; the user is directed to normal login. A sign-out network
failure cannot turn an already successful password change into a reported failure;
no persistent recovery session exists. No service/admin key or staff provisioning
operation is used. Nonstaff can recover their own Auth password but remain denied
admin access by the existing membership/RLS system.

The public request acknowledgment does not reveal whether the account exists.
Supabase rate limits/provider failures are shown without rendering raw errors.
Configure email delivery/rate limits/password policy through a separate approved
staging setup; the app does not supply SMTP or change Auth configuration.

### Manual staging verification

1. Run Vite on exactly localhost:5173 with ignored staging public URL/key values.
   Use a verified test employee Auth account and a working staging mail provider.
2. Open /admin/login, choose Forgot password, and request a recovery email.
   Check the generic acknowledgment in HY/EN/RU and the email's callback target.
3. Follow the email link. Confirm the URL becomes /admin/reset-password without
   secrets and the password form appears only after server verification.
4. Test short/oversized passwords, Unicode byte limits, mismatched confirmation,
   and configured server password policies. Save a valid new password; sign in
   normally with it and verify the unchanged admin/editor membership rules.
5. Open the callback without tokens, with malformed/expired tokens, and follow an
   expired/consumed email link. Expect a localized error and a new-link action,
   never a password form or automatic dashboard access. Also test offline behavior.
6. Test a Dashboard-generated reset email that redirects to Site URL `/` and a
   denied nonstaff account. Verify recovery does not replace another existing
   normal admin session. Test desktop/mobile keyboard navigation and languages.

Refreshing/navigating away after URL scrubbing intentionally loses the in-memory
recovery session; request a fresh link. PKCE code-only and custom token_hash email
templates are not implemented; retain the current default implicit flow/template.
One-use email verification is enforced by Supabase. Already-issued bearer token
fragments have their own validity/revocation semantics; client UI cannot promise
server-wide single use or revoke every existing session. Never share those URLs.
The 12-character/72-byte application policy may be stricter than staging's minimum.

`pnpm test:recovery` tests parsing, invalid/expired links, callback routing,
validation, authorization gating, identity changes and six localized renders with
SDK doubles/credentials disabled. Other local auth/project/localization tests,
lint and build also run. Email delivery, real token/session revocation and browser
interaction require the manual checks above; no remote Auth calls were performed.

For a `/recover` 200 followed by `/verify` 403 / “One-time token not found”, see
[recovery failure investigation](RECOVERY_FAILURE_INVESTIGATION.md). This failure
occurs before callback session handling; prefetch is only one hypothesis. Follow
the controlled default-template test before changing Auth templates or SMTP.
