# Services CMS: disposable staging review

This guide describes the Phase 6 baseline. For the additive Phase 6.1 upgrade, use [Dynamic Services staging setup](DYNAMIC_SERVICES_STAGING_SETUP.md); do not rerun this baseline migration or import on an existing catalog.

Target only `uewihgsxrcjieghtkhjs`. Nothing in this guide has been executed remotely. Do not run these steps on production. Preserve existing uncommitted work. No email, attachments, Storage changes, or additional service pages are included.

## Prerequisites and review

Use Node >=22.12 and the existing package manager. Run `pnpm test:services`, `pnpm test:services:locking`, `pnpm test:inquiries`, `pnpm test:database`, `pnpm test:projects`, `pnpm test:admin`, `pnpm test:recovery`, `pnpm test:i18n`, `pnpm lint`, `pnpm build`, and `git diff --check` locally.

Confirm the Dashboard project reference is exactly the staging reference above. Phase 3, Phase 4 and the audited Phase 5 migrations must already be applied. Check their migration history and actual schema, including customer-request constraints and RPCs. Back up staging data and review custom database triggers before any writes. Owners/service credentials are trusted boundaries; SQL tests do not certify arbitrary custom functions.

The new migration is create-once, not rerunnable. It intentionally aborts on existing Services objects, unsafe membership permissions, client-reachable inherited grants, column-level escalation, unsafe schema CREATE, or untrusted Phase 3/5 ownership. Do not remove these assertions to force installation. Investigate the reported privileges first.

## Hardened contracts before staging approval

The migration verifies the exact Phase 5 customer-request policy twice: before Services DDL and immediately before COMMIT. There must be exactly one policy, named `active admins read requests`, a permissive SELECT policy for `authenticated` only, with no WITH CHECK expression, using precisely the scalar subquery that calls `private.has_staff_role(array['admin'])`. Extra policies (including restrictive or otherwise seemingly harmless policies), PUBLIC/custom-role policies, widened editor access, changed expressions, and missing policies abort the transaction. Unknown policies are never automatically repaired or removed.

Expression verification uses PostgreSQL's canonical `pg_get_expr(..., false)` output under an empty transaction-local search path. A different PostgreSQL version may format the same expression differently and cause a safe rejection. Inspect that difference and extend the reviewed verifier/tests if necessary; do not bypass the check or silently change hosted policies to force installation. Owners remain trusted; changing policies after migration requires a new security review.

Anonymous Services reads use explicit column SELECT grants for the public catalog fields only. Anonymous `SELECT *`, whole-row JSON, filters on attribution columns, and direct reads of IDs/revisions/timestamps/actor UUIDs are denied. Active admins/editors retain full management reads. Authenticated nonstaff have no Services rows through the staff-only authenticated RLS policy; public pages deliberately use the separate anonymous SDK client. Inherited and non-inherited SET ROLE paths to table-wide or hidden-column SELECT privileges cause migration failure, including column ACLs that survive a table-level REVOKE.

The fixed Unicode nonempty contract is shared by `src/features/services/text.js` and the SQL `private.service_text_nonempty` helper. The explicit ranges cover Unicode 16.0 White_Space, Format, and Default_Ignorable_Code_Point characters, including NBSP, em-space, BOM, joiners, variation selectors and tag characters. Blank-only Armenian draft titles and all six required publication fields are rejected; mixed visible text is preserved without normalization or character removal. Character limits remain 200 code points per title and 2,000 per description, matching PostgreSQL UTF-8 length. Draft translations other than the Armenian title can remain empty until publication.

`pnpm test:services` now imports permanent hardening regressions. They reproduce nonstaff PII exposure before a bad-policy migration is rejected, check transaction rollback, mutate policy/column grants through local DDL triggers, compare every invisible-range character plus boundaries between PostgreSQL and JavaScript, test all six publication fields, and measure contact quotas as the trusted owner. A deliberately mutated local RPC that charges duplicate retries must fail the quota invariant. All such mutation tests use disposable local engines only.

## Apply the new migration manually

After separate approval, open staging SQL Editor as the same trusted owner that owns `admin_users`, the helper, and Phase 5 objects (normally `postgres`). Execute the entire file:

`supabase/migrations/202610210001_services.sql`

The file uses BEGIN/COMMIT. On any error issue `ROLLBACK;` before continuing. Do not run fragments. No old migration should be reapplied. This adds Services, management RPCs, nullable request reference/snapshot columns, and a disabled database catalog switch. Existing requests retain their values; no historical snapshots are fabricated. Existing Projects tables and Storage policies are untouched.

The old submission RPC remains available only to service_role while the database catalog switch is off. The new v2 RPC refuses submissions until that switch is on. The same transaction retains all existing Phase 5 effective-privilege assertions.

## Import the exact current catalog

Review `supabase/import/services.sql` against `src/data/services.js` and all three translation JSON files, then execute the whole seed in staging SQL Editor as the trusted owner. It requires an empty Services catalog and inserts all six entries as drafts, in current order, including real estate. A nonempty catalog aborts rather than skipping or replacing content. On error issue ROLLBACK.

Icons remain the original local SVG paths; the database contains only allowlisted icon identifiers. Do not add arbitrary SVG/HTML or image URLs.

## Enable the editor and review publication

In the ignored local environment file, retain the existing staging public URL/key and set:

```dotenv
VITE_SERVICES_SOURCE=supabase
VITE_SERVICE_INQUIRIES_ENABLED=false
```

Restart Vite. This also makes the public section read only published database services, with no static fallback; until publication it displays the localized empty state. Keep this initial review local.

Sign in at `http://localhost:5173/admin/services` with an explicitly provisioned active admin. Review HY/EN/RU fields, icons, ordering and inquiry availability, then publish all approved services, including real estate. Incomplete translations fail publication. Editors can create missing catalog drafts and edit draft text; they cannot change icon/order/inquiry settings or edit published/archived services. All publication, unpublication and archival require active admin membership in PostgreSQL. There is no hard-delete operation.

Only six immutable service keys are allowed in this release. After seeding, Create draft will conflict for an already-existing key. To revise an archived service, an admin returns it to draft. Published content edits save immediately; there is no separate unpublished revision of a published service. Save form edits before using a publication action; status actions operate on the saved database revision.

## Prepare the updated Edge Function before activation

Keep the existing Turnstile secret, HMAC secret, hostname/origin restrictions and hosted Supabase credentials unchanged. In a private, ignored staging secrets file add:

```dotenv
INQUIRY_SERVICE_CATALOG_READY=true
```

This readiness flag means the new schema is installed; it does not activate catalog submission. The updated handler reads the actual mode from the service-only `inquiry_service_catalog_enabled()` RPC after durable attempt limiting. The database switch is still false, so it continues to use the old submission contract.

Only after explicit deployment approval, use commands scoped to staging:

```sh
supabase login
supabase secrets set --env-file /absolute/private/path/services-staging.env --project-ref uewihgsxrcjieghtkhjs
supabase functions deploy submit-inquiry --project-ref uewihgsxrcjieghtkhjs --no-verify-jwt
```

Do not deploy all functions, use an implicit linked project, change production, rotate the HMAC secret, or add email providers. Public/anonymous requests intentionally use the existing CAPTCHA and quota protection rather than Auth registration or a gateway JWT requirement.

Before activation, verify synthetic legacy requests still persist through the updated handler, and that the mode RPC returns false through a trusted service-only test. Neither anon nor authenticated may execute it. A readiness flag without the migration fails closed. Old Edge instances remain compatible with the new schema while the database switch is false.

## Activate atomically, then enable the Contact catalog

After confirming all function instances use the updated handler and the six reviewed services are published, execute this explicit owner-only activation in staging SQL Editor:

```sql
begin;
set local lock_timeout='3s';
do $$ begin
 if (select count(*) from public.services where status='published' and accepts_inquiries)<>6 then
  raise exception 'Review and publish all six inquiry services first';
 end if;
end $$;
update private.service_inquiry_config set enabled=true where singleton;
commit;
```

The updated function automatically chooses v2 from the database flag. No independently timed Edge mode setting is needed. Both persistence RPCs hold a shared row lock on the flag until commit, so a request racing activation can fail with a generic retryable error but cannot persist through the wrong contract. Old browser clients without catalogVersion continue to receive server-side catalog validation and snapshots. Catalog-aware clients send version 2; these are rejected while the database mode is off.

Now set the public flags locally:

```dotenv
VITE_SERVICES_SOURCE=supabase
VITE_SERVICE_INQUIRIES_ENABLED=true
VITE_INQUIRIES_ENABLED=true
VITE_TURNSTILE_SITE_KEY=YOUR_EXISTING_STAGING_PUBLIC_SITE_KEY
```

Retain the existing staging URL/key; never add service-role or CAPTCHA secrets to VITE variables. Restart Vite. Visit `http://localhost:5173/#services` and `http://localhost:5173/#contact`. This changes neither project categories nor portfolio filters.

## Acceptance checks

- Test HY, EN and RU, mobile widths, keyboard navigation, labels, focus, loading/error/retry, empty lists and persisted language.
- Confirm exactly the reviewed cards/order/icons; click each CTA and verify Contact preselection, including real estate. Project categories remain unchanged.
- Confirm unpublished and archived services disappear from the public catalog, and inquiry-disabled services disappear from the selector. Stale browser options must be rejected by server-side persistence, not silently saved.
- Submit synthetic requests using real staging CAPTCHA. Check service_id and all-language title snapshot, consent, language and one persisted row before success. Historical requests remain readable without new fields. Changing a service title must not rewrite a snapshot.
- Repeat a successful submission key after archival: it succeeds idempotently without a new row or contact-quota increment. A different payload with the same key conflicts. A new request for an archived/disabled service fails.
- Test anon, nonstaff, editor, inactive and revoked membership through actual Data API/RPC calls, including fabricated role metadata. Deny all direct INSERT/UPDATE/DELETE/TRUNCATE, anonymous management RPCs, and anonymous request reads. Editors may not change publication/settings; admins may not provision roles from the client.
- Use two browser sessions to save the same revision: one succeeds, the other reports a localized conflict. Close/change selections or filters during delayed saves; no obsolete result should restore the old editor or notification.
- On disposable staging, verify separate-connection archival versus v2 submission in both lock orders. Submission holds FOR SHARE on the service until commit; management writes conflict with that lock. An inquiry serialized before archival may commit; one serialized after must fail. Test actual PostgREST/platform timeouts and deadlock/retry behavior without real customer data.
- Confirm CAPTCHA denial, durable quotas, duplicate suppression, optional email, consent, admin request statuses, Projects galleries/filtering, authentication and recovery still work.

## Recovery and limitations

To stop new submissions safely, disable the public inquiry flag and revoke/restrict the staging endpoint operationally as needed; frontend flags alone do not stop old tabs or direct calls. Do not drop Services or request snapshot columns, delete historical requests, or reverse schema changes blindly.

To return to the legacy five-service contract deliberately, first disable catalog Contact locally, then as trusted owner set the database switch false in a transaction. The current Edge handler automatically returns to the legacy path; catalogVersion 2 clients fail closed until refreshed. Real estate is unavailable in that old contract. In-flight mode changes can return a generic failure and require retry. Only after the database switch is false may the readiness flag be disabled or the old function restored. Request snapshots and service records should remain for history.

Local tests use actual embedded PostgreSQL with minimal Auth/Storage stand-ins and synthetic Edge/SDK responses. The embedded tests cover sequential before/after archival cases and stale revisions; the separate native tests described below exercise simultaneous locking. Neither certifies hosted ACL defaults, PostgREST schema reload, Deno runtime, real CAPTCHA, or mobile browser behavior. Flags remain off in the example; no credentials were changed or hosted operations performed. GO for disposable staging review after approval, not production deployment.

A PostgreSQL 18 installation was found outside PATH at `/Library/PostgreSQL/18/bin`. `pnpm test:services:locking` creates its own temporary cluster with a private Unix socket and TCP listening disabled. It clears inherited PG connection variables, uses no existing database or credentials, creates only synthetic fixtures, and stops that cluster in a finally block. System sandbox permission may be required for shared memory and Unix sockets. No hosted connection is made. If no native toolchain exists the command explicitly reports SKIP; that is not a concurrency pass.

Six native multi-connection scenarios passed with actual backend blocking verified through pg_blocking_pids: save versus stale status update, both archival/submission orders, concurrent same-key submission, and both activation/legacy-submission orders. They assert row counts, snapshots, SQLSTATE errors and owner-side quota totals. PGlite Promise.all requests alone remain queued single-connection checks; structural FOR SHARE checks are not locking proofs. Native tests still use minimal Auth/Storage schemas. Hosted policy deparsing, Data API column grants, actual Edge/CAPTCHA behavior, custom triggers, platform timeouts and browser/mobile interaction require staging acceptance before activation.
