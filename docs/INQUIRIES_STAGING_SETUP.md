# Customer inquiries Phase 1 — staging only

Target: `uewihgsxrcjieghtkhjs`. Implemented locally; no remote migration, secret
change, deployment, email, attachment, commit or push was performed. Keep the
frontend flag OFF until all manual setup/verification below succeeds. No email
provider, Auth email hook, outbound customer/company email or Storage bucket is
used. The public phone/email contact links remain unchanged.

## Implemented architecture and security

- `customer_requests` stores normalized name, phone, optional email, one existing
  service/category ID, location, description, language, server-recorded consent
  time/version, status, revision and timestamps. Consent version is `inquiry-v1`.
  Status values are `new`, `in_progress`, `completed`, `rejected`.
- RLS plus explicit grants deny anonymous direct reads/writes and all direct
  browser inserts/updates/deletes/TRUNCATE. Only active admins can SELECT. Editors,
  inactive staff, and nonstaff cannot read personal data or change statuses.
- `set_customer_request_status` is a fixed-search-path, privileged RPC that checks
  current database admin membership, accepts only four statuses, matches revision,
  increments it atomically and records the acting user. A stale revision raises
  40001; refresh/review before retrying. No frontend role or editable JWT metadata
  grants access. There is no request deletion or bulk export UI in this phase.
- Only service_role may execute the attempt/submission RPCs. Internal quotas have
  RLS and no direct client access; internal helper EXECUTE is explicitly revoked.
  The migration requires the trusted Phase 3 table/helper owner and rejects unsafe
  membership-table permissions/RLS and privileged role inheritance.
- Anonymous `submit-inquiry` accepts only allowlisted Origins and JSON, caps body
  bytes at 32 KiB with a 10s read budget, validates all fields, rejects honeypots,
  verifies Turnstile server-side with exact action `customer_inquiry` and an
  allowlisted hostname, and returns fixed error codes without personal data.
  CAPTCHA verification times out after 10s; DB HTTP calls after 15s. The function
  refuses to run unless SUPABASE_URL is the exact staging URL.
- Durable atomic database counters cap valid-shaped attempts globally at 120 per
  fixed 10-minute window and 1000 per UTC epoch-aligned day BEFORE CAPTCHA work.
  Accepted new submissions are capped at 3 per normalized phone/HMAC per fixed
  hour. These are database counters, not per-isolate memory. No spoofable forwarded
  IP header is trusted. Origin/CORS and honeypot checks are defense in depth, not
  identity or bot authentication. Attackers can still exhaust the global quota;
  it is a deliberate staging ceiling and may cause temporary unavailability.
  Distributed/rotating identities still need operational monitoring/gateway limits
  before production. Fixed windows permit boundary bursts.
- Contact identifiers and canonical payloads use server HMAC-SHA256. Only hashes,
  not raw network addresses or CAPTCHA tokens, enter quota/idempotency metadata.
  Quota rows older than two days are removed on the next attempt. Request data
  itself is retained until an owner-approved retention process is introduced.
- An unpredictable browser submission UUID is retained for unchanged form data
  during retries. A per-key advisory transaction lock and unique constraint stop
  concurrent duplicate inserts. Matching payload hash returns success for an
  already committed record, without returning its private content. Reusing a key
  with changed content is rejected. Every retry still requires a fresh CAPTCHA;
  verification tokens are single-use. CAPTCHA action/hostname is never skipped.
- Success is shown only after a successful committed RPC. On timeout/uncertain
  outcome the form/key remain and the widget resets for a fresh challenge. Reload,
  tab closure or changed form/language creates a new key and can create another
  request; this is not cross-device business deduplication. Rotating the HMAC secret
  changes hashes and can invalidate retries; plan rotation rather than doing it
  while submissions are pending.
- Admin list pages hold 20 rows, newest first. Search is limited to name/phone/email
  with fixed filter fields and a character allowlist. Details render text through
  React escaping, not HTML. Pagination/filter/list reload clears selected details;
  status writes require a current revision. Existing admin-only routing is retained.

## Exact manual staging setup (do not execute against production)

1. Use Node 22.12+ and the Supabase CLI. In the Dashboard verify the selected project
   reference is `uewihgsxrcjieghtkhjs`. Review the UNAPPLIED migration
   `supabase/migrations/202610160001_customer_requests.sql`. Apply it ONCE using
   staging SQL Editor as the same trusted owner used for Phase 3 (normally postgres).
   Phase 3 must already be installed. Phase 4 is compatible but not a dependency.
   Never rerun CREATE migrations or use a generic db push against an unknown link.
   SQL itself cannot reliably discover a hosted project reference; target selection
   is the operator's responsibility. The Edge and frontend have explicit staging guards.
2. Review/approve the visible consent text in all three languages and the version
   `inquiry-v1` before collecting real personal data. It authorizes processing to
   answer the inquiry; it is not an invented comprehensive privacy policy. The
   company must choose retention, deletion, staff-access and any legal notice
   requirements before real use. Use synthetic customer data for initial staging.
3. Create a SEPARATE Cloudflare Turnstile Managed widget for staging, permitting
   hostname `localhost` (add a staging web hostname only if actually used). Obtain
   its public site key and private secret. Do not put the secret in Vite. No fake
   credentials or CAPTCHA bypass are supplied. Cloudflare test keys may have a
   synthetic hostname; this handler intentionally requires configured hostnames.
4. Outside Git, create a restricted-permission secrets file containing:

   ```dotenv
   INQUIRY_ALLOWED_ORIGINS=http://localhost:5173
   INQUIRY_CAPTCHA_HOSTNAMES=localhost
   INQUIRY_TURNSTILE_SECRET=REPLACE_WITH_STAGING_WIDGET_SECRET
   INQUIRY_HMAC_SECRET=REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
   ```

   Generate the HMAC value with a cryptographic tool/password manager, e.g.
   `openssl rand -hex 32`, and save it privately. Do not paste secrets into chat or
   commit them. Hosted functions supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
5. After separate approval to make staging changes, execute from this repository:

   ```sh
   supabase login
   supabase secrets set --env-file /absolute/private/path/inquiry-staging.env --project-ref uewihgsxrcjieghtkhjs
   supabase functions deploy submit-inquiry --project-ref uewihgsxrcjieghtkhjs --no-verify-jwt
   ```

   Deploy ONLY this function. The legacy JWT gateway check is disabled because
   customers do not log in; the handler's CAPTCHA/quotas and database permissions
   are the security boundary. Do not copy project-media's staff-auth requirement
   into this public endpoint. Do not deploy other functions or configure Resend.
6. In ignored local `.env.local`, keep the existing STAGING public URL/key and add:

   ```dotenv
   VITE_INQUIRIES_ENABLED=true
   VITE_TURNSTILE_SITE_KEY=REPLACE_WITH_STAGING_PUBLIC_SITE_KEY
   ```

   Restart Vite. The UI additionally requires the configured Supabase URL to be
   exactly https://uewihgsxrcjieghtkhjs.supabase.co. Production settings are untouched.
   With the flag off/missing configuration, the original disconnected form notice
   remains and no CAPTCHA or inquiry submission is attempted. These frontend flags
   do not disable an already deployed server endpoint; remove/restrict its staging
   configuration separately if you need to stop anonymous submissions.
7. Open http://localhost:5173/#contact, complete all fields, consent and CAPTCHA,
   submit synthetic data, then inspect /admin/requests as an active admin. Test HY,
   EN and RU, optional email, keyboard/mobile interaction, status filters, details,
   pagination, concurrent edits and error/retry behavior. Turnstile's vendor widget
   does not offer Armenian UI; the app's labels/errors are localized and the widget
   uses auto language for Armenian (EN/RU requested for those selections).
8. Verify raw anonymous/direct table access and protected RPC calls are denied;
   editors/nonstaff/inactive/revoked admins cannot read requests or change status.
   Revoke membership while keeping the same JWT to verify server enforcement.
   Test invalid/expired/reused CAPTCHA, wrong action/hostname, oversized body,
   repeated submissions, same-key retries with fresh CAPTCHA, 429s, stale revisions,
   unavailable DB/provider and failed response after a commit. Check no email arrives:
   none should be sent. Never include private customer fields or tokens in logs/HARs.

## Local verification and limitations

`pnpm test:inquiries` runs the real new migration under embedded PostgreSQL 18,
with hostile global EXECUTE defaults and minimal Auth stand-ins. It tests database
privileges/RLS, inactive/nonstaff/editor/revoked admin denial, status/revision
checks, duplicate/conflicting UUIDs, durable quotas, actual transpiled Edge handler
with SDK/CAPTCHA doubles, search/pagination transports and localized admin renders.
The existing database/project/auth/recovery/localization tests, ESLint and build
are separate checks. No local test contacts hosted Supabase or Cloudflare.

PGlite is not hosted Supabase; Deno type checking/runtime, actual gateway Origin
and CORS behavior, Turnstile/browser accessibility, platform grants/timeouts and
multi-connection locking require manual staging verification. Advisory locks and
unique constraints implement concurrency in PostgreSQL, but the single-connection
local harness cannot emulate every race. There is no scheduled purge, monitoring,
email worker, notification outbox, attachment upload, or production enablement.
Before production, separately review privacy/retention, abuse limits, deployment,
CAPTCHA network failures and operational recovery. Do not weaken checks to get a pass.

References: [Turnstile server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[explicit widget lifecycle](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).

## Security hardening review — 2026-10-21

The previous NO-GO findings are addressed in the unapplied migration. Before DDL,
it checks effective membership-table INSERT/UPDATE/REFERENCES at both table and
column level for anon/authenticated and every role reachable through membership,
including SET ROLE targets that are not currently inherited. It rejects relevant
membership write policies, privileged role attributes and private schema CREATE.
It does not silently repair an unknown Phase 3 configuration.

Before COMMIT, a second DO block checks effective privileges on both new tables
and all inquiry functions, including inherited defaults. Client-reachable roles
must have no direct mutation/TRUNCATE/TRIGGER/REFERENCES, quota-table access, or
EXECUTE on internal/service-only functions. Anonymous-reachable roles must have
no request SELECT or status-function EXECUTE. Positive checks retain required
admin-client and service-role rights. Broad custom defaults therefore cause an
atomic migration failure instead of leaving exposed objects. The migration changes
no unrelated role memberships or default ACLs. Existing direct revocations remain.

`pnpm test:inquiries` now also runs `scripts/check-inquiry-hardening.mjs`:
11 negative scenarios cover both original reproductions, global/schema-specific
inherited EXECUTE, table ALL/TRUNCATE, quota SELECT, anonymous SELECT, column
INSERT/UPDATE, write-policy drift and non-inherited SET ROLE targets. Each failure
must roll back tables/functions and preserve original memberships, default ACLs,
column grants, policies and membership data. Positive runs cover Phase 3 alone
and Phase 3+4, normal/direct broad defaults, RPC denial, service execution and
apply-once rerun behavior. Existing status/idempotency/quota/CAPTCHA tests remain.

Recommendation: CONDITIONAL GO for applying the revised migration once to isolated
disposable staging after the owner/environment checks below. This is not hosted
execution verification or production approval.

1. Keep inquiries disabled. Select staging `uewihgsxrcjieghtkhjs`, primary DB,
   and postgres (the trusted Phase 3 owner) in SQL Editor. Verify the migration
   has not already been applied. If it exists anywhere, do not rerun this edited
   CREATE migration; prepare a separately reviewed upgrade migration.
2. Confirm private is not exposed in the Data API. Review actual role memberships,
   default ACLs and Phase 3 policies/ownership. Do not change grants just to bypass
   a rejection. Correct pre-existing unsafe configuration only after owner review.
3. Execute the COMPLETE revised `202610160001_customer_requests.sql` once, including
   BEGIN, both validation blocks and COMMIT, without user impersonation or selection.
   SQL cannot reliably attest the hosted project ref: verify the Dashboard target.
4. On any error, stop and resolve the transaction state (ROLLBACK on the same
   backend when available); a new pooled SQL Editor request may use another backend.
   Never force COMMIT or rerun fragments to skip the failing guard. A failed full
   transaction must leave no newly created inquiry objects. Verify this manually
   before retrying a reviewed correction.
5. Before endpoint deployment/flag enablement, verify effective ACLs and raw API
   denial with anon/nonstaff/editor/inactive/revoked accounts, then active admin
   reads/status updates. Keep synthetic fixture data isolated and follow the setup
   steps above for separately authorized staging function deployment/CAPTCHA tests.

Remaining limits: local execution uses embedded PostgreSQL 18 and schema stand-ins;
actual hosted version/ACLs, Deno/PostgREST/CAPTCHA behavior, SQL Editor routing and
multi-connection races still require staging checks. Guards check privileges at
migration time; future grants/memberships/policy changes can reintroduce access
and require review. Owners/service-role credentials remain trusted boundaries.

## Unicode validation and asynchronous view updates

Shared client/Edge validation counts Unicode code points for request text/email
lengths, matching PostgreSQL UTF-8 length(text), rather than JavaScript UTF-16
units. Combining marks and ZWJ sequences count as multiple code points, as they do
in PostgreSQL. Text is not normalized or rewritten. Lone surrogates in bounded text
fields are rejected as invalid UTF-8 input. HTML field maxlength limits allow up
to twice the code-point bound in UTF-16 units; shared validation still enforces
the original database limits. No database constraint or payload limit was relaxed.

Admin Requests uses a controller with independently versioned list loads and
status mutations. Refresh, filter/page changes, selection changes, close and
unmount invalidate old status completions, errors and busy-state callbacks. Old
list responses cannot replace newer results. A current revision conflict remains
visible without optimistic changes to the row. This prevents stale UI restoration;
it does not cancel a server write already in flight. Refresh/review the server's
latest record after a conflict. The database still enforces membership and revision.

`pnpm test:inquiries` includes 72 length boundaries compared to actual embedded
PostgreSQL (Latin, Armenian, Russian, emoji, combining marks and ZWJ text), emoji
persistence and invalid-surrogate checks. `scripts/check-request-races.mjs` tests
the actual controller with deferred operations: 18 stale success/error cases,
old completion versus a newer busy operation, newest-list wins, current conflicts,
duplicate-action suppression and effect stop/restart. These tests contact no
hosted database or CAPTCHA provider; browser interaction still needs manual QA.
