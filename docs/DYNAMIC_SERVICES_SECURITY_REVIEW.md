# Phase 6.1 local security review

Scope: new forward migration, Services model/transport/controller/admin UI, and compatibility with existing Phase 3–6 security and Phase 5 submissions. No hosted connection or operation was performed. Existing migration/import hashes were compared before and after implementation and are unchanged.

## Findings addressed

- Core visibility was previously a mutable admin action. Six database-derived core identities now require published status; a trigger rejects identity changes and core deletion, and a statement trigger rejects truncation. Clients cannot supply or update classification. Public queries continue to filter published rows; no draft visibility exception or static merge was introduced.
- The fixed six-key constraint and creation UI prevented extensions. Additional bounded immutable keys have database uniqueness including case-fold collisions with legacy camel-case identities. Only an active admin can create, and the RPC inserts a draft without trusting payload status/actor fields. The same-key concurrent insertion has one winner and SQLSTATE 23505 for the other.
- Editor settings/publication controls are enforced in the RPC, not just hidden in React. Active editors can update additional draft text, but cannot create, change settings or publish/archive. Inactive/revoked/nonstaff identities fail server-side checks.
- Existing Services policy drift could undermine draft privacy. The forward migration requires exactly the two expected policies, roles and canonical predicates before DDL and again before commit. A DDL-event-trigger mutation regression proves late policy weakening aborts and rolls back core publication/schema changes.
- The singleton mode row is locked during the migration, and an enabled catalog causes rejection. Phase 5 submission functions, constraints, policies and request rows are not rewritten. Tests compare submission/status/quota RPC bodies and ACLs and historical rows before/after, exercise legacy submission/retry/quota, and prove v2 remains disabled.
- Catalog growth required correct pagination: public reads page through server caps using only safe columns; admin mutations reconcile server pages when needed without replacing a newer editor/filter result. No anonymous internal-field grants were added.

## Authorization and ownership

Existing fail-closed membership, schema CREATE, owner, RLS, inherited-role and SET ROLE checks remain in the new migration. Forbidden customer-request table/column grants, internal quota access, anonymous status execution and browser submission execution are checked alongside positive required grants. Hostile default EXECUTE grants for the new trigger function fail before commit. Trigger functions use empty search paths, are not SECURITY DEFINER, verify the source table and have no client/server EXECUTE grants. save_service/set_service_status retain trusted owner, SECURITY DEFINER and empty search paths; runtime authorization reads current staff membership rather than JWT role metadata. Existing anonymous safe-column grants remain unchanged; is_core is not publicly granted.

Native PostgreSQL 18 tests observed actual backend blocking for five Phase 6.1 scenarios: concurrent duplicate creation, save versus publication, publication versus archival, core save versus archival, and concurrent legacy idempotent retries. Existing Phase 6 native tests also passed. Servers used private Unix sockets with TCP disabled and were stopped/removed in finally blocks.

## Remaining limits and staging decision

No unresolved bypass was reproduced within the tested local model. This is readiness for separately approved staging preflight, not certification of current hosted roles, policies or triggers. PGlite/native tests use minimal Supabase Auth/Storage stand-ins. Hosted PostgreSQL policy deparsing, PostgREST cache/column grants, custom table/event triggers, external effects, platform timeouts, browser focus/layout and real CAPTCHA remain staging checks. Owners able to disable triggers or alter policies and privileged service environments remain trusted boundaries.

Published core edits are immediate; there is no unpublished revision history or automatic undo. Public pagination across separate API calls is not a transaction snapshot; concurrent catalog changes may require refresh. The API detects a nonadvancing page and returns a localized error rather than looping indefinitely.

The forward migration publishes remaining core drafts. Do not execute it before explicit publication approval, content review, a fresh ACL-preserving current-state backup, disabled-mode verification and the prerequisites in DYNAMIC_SERVICES_STAGING_SETUP.md. Do not rerun old migrations/imports, activate catalog inquiries, deploy Edge Functions or access production. After commit use a forward correction rather than destructive rollback over later customer inquiries.

## Targeted native combined-schema review

Both suspected gaps are already prevented without RPC changes. The native runner now executes scripts/sql/dynamic-services-targeted-security.sql after applying the full Phase 3–6.1 chain and importing synthetic local core fixtures.

All six save_service reserved-key draft attempts fail specifically on services_core_published (23514), before uniqueness checks. is_core is GENERATED ALWAYS from the exact key, so this rejection does not rely on an existing duplicate. Existing core rows are preserved/protected; independent owner-run published duplicate inserts fail uniqueness (23505), and lowercase aliases of the two camel-case keys also fail case-fold uniqueness. Additional keys successfully create noncore drafts.

set_service_status does not repeat publication validation in its body because Phase 6 table constraints still apply to its UPDATE, including SECURITY DEFINER calls. All six text columns are NOT NULL; service_text_valid rejects forbidden markup/control text and overlength values, the Armenian draft-title CHECK rejects invisible-only titles, and the status-dependent publication CHECK requires service_text_nonempty in all HY/EN/RU titles/descriptions. The new migration replaces only the service-key constraint and adds core rules; it does not drop those text/publication constraints. A failing update rolls back its revision/status/attribution changes.

Native regressions cover 48 blank-field cases (empty, ASCII whitespace, NBSP, em-space, BOM, zero-width space, soft hyphen), 18 markup/control/overlength cases, 12 missing/null fields, six valid Unicode maximum-length publications, complete multilingual publication, anonymous visibility, editor/anonymous denial and rolled-back fixture cleanup. Invalid text that cannot exist even in a draft is rejected at save; valid draft omissions cannot be published. Neither migration nor application authorization needed modification for these two findings. These tests use disposable native PostgreSQL, not hosted Supabase.
