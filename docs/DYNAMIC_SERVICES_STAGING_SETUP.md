# Phase 6.1 — Dynamic Services, staging only

LOCAL IMPLEMENTATION. Nothing in this guide authorizes hosted execution. Target `uewihgsxrcjieghtkhjs` only. Never access production `avchaxgdgiwtubyncxzc`.

## Approval boundary

The new forward migration is `supabase/migrations/202610220001_dynamic_services.sql`. Do not rerun Phase 3–6 migrations or `supabase/import/services.sql` on staging.

This forward migration deliberately publishes existing core drafts in the same transaction that protects them. Applying it therefore requires explicit approval to publish the remaining five core services, after reviewing all HY/EN/RU text. They have NOT been published by local implementation. Do not run the migration while that approval is withheld.

## Prerequisites

1. Confirm the Dashboard project reference is exactly staging and use SQL Editor as the trusted owner, normally postgres. Do not rely on an implicit CLI link.
2. Verify Phase 3–6 actual schema, RPC ownership and definitions, empty function search paths, effective table/column grants, inherited and SET ROLE membership paths, schema CREATE, and custom table/event triggers. The migration rejects drift in both Services SELECT policies and the exact active-admin-only customer-request SELECT policy. Canonical expression formatting differences fail closed and require review.
3. Verify all six original keys and UUIDs are present, with complete, reviewed publication-ready HY/EN/RU titles and descriptions. Preserve any staging edits. The migration does not overwrite text, icon, order, inquiry eligibility, original attribution or existing UUIDs.
4. Verify the singleton `private.service_inquiry_config` row exists and is false. Retain `VITE_SERVICES_SOURCE=supabase` and `VITE_SERVICE_INQUIRIES_ENABLED=false`. Do not modify Edge readiness flags, CAPTCHA/HMAC secrets, deployed functions or the Contact contract.
5. Take a fresh ACL-preserving staging backup now that Phase 6 and CMS edits exist; the older pre-Phase-6 checkpoint lacks those edits. Verify recovery of current Services, request counts/data, grants and functions in isolation. Retain the separately backed-up Storage image. Record current service rows/statuses/revisions and aggregate customer-request counts privately.
6. Run Node >=22.12, all tests below, and review this migration. It is create-once; existing `is_core`, conflicting index/trigger names, missing prerequisites or unsafe privileges abort it.

## Reviewed database behavior

- Six exact legacy keys derive `is_core` in PostgreSQL. Additional keys use 1–80 lowercase ASCII letters/digits separated by single hyphens, starting with a letter. A unique lower(key) index prevents case collisions with legacy camel-case identities.
- UUIDs and service keys cannot be updated. Core rows cannot be deleted, unpublished or archived. TRUNCATE is rejected by a statement trigger. Neither trigger is executable/attachable by application roles. Owners who can disable triggers or change schema remain trusted.
- Core drafts become published with incremented revisions and updated timestamps. There is no fabricated updating user. Existing published rows retain revisions; all core text/settings remain unchanged.
- Active admins alone create additional services. Inserts through save_service always create drafts, with server-assigned actor fields. Active editors may edit draft text, but cannot create, publish, archive, change identity or protected settings. Core published content is admin-editable and saves immediately publicly.
- Publication still validates all six language fields, Unicode visibility and PostgreSQL code-point limits. Icons remain approved local identifiers, independent of service keys. Additional-service inquiry eligibility defaults false; changing it does not activate inquiries.
- No direct client writes, DELETE or TRUNCATE grants are added. Public reads keep the existing published-only RLS and explicit safe column grants. `is_core`, actor UUIDs, revisions and timestamps are not granted to anon. The separate anonymous public client remains in use.
- Phase 5 request tables/constraints/policies and both submission function definitions/ACLs remain unchanged. Dynamic catalog inquiry submissions are intentionally unsupported and disabled. Legacy five-service inquiries, consent, quotas, idempotency and snapshots remain intact. No email, attachments, Storage or Auth changes.

## After separate approval, staging sequence

1. In staging SQL Editor as the trusted owner, execute the entire NEW migration once during a quiet period. It uses BEGIN/COMMIT and a 3-second lock timeout; it takes a Services table lock. On any error issue ROLLBACK and investigate. Never remove fail-closed assertions to force it through.
2. Inspect the six preserved core UUIDs/keys/content and six published statuses; compare request counts/integrity and disabled catalog flag against the pre-migration record. Confirm RPC/trigger ownership, RLS, safe anonymous columns and effective grants after commit. Confirm PostgREST sees the new schema; schema refresh, if needed, is a separately approved operational action.
3. Use the updated local frontend. Verify six core cards with no static merge, Create visible only for admins, a unique additional draft, draft privacy, publication/archival of that additional service, and rejection of all core hiding/removal actions through direct RPCs.
4. Verify HY/EN/RU, desktop/mobile, keyboard focus, filtering/pagination, errors and stale revisions. Review general Contact navigation without catalog preselection. Any staging test that creates/changes data requires separate approval; do not include real customer data.
5. No import, Edge deployment, catalog activation, secret change or production operation is needed.

## Local validation

Run `pnpm test:services`, `pnpm test:services:locking`, `pnpm test:inquiries`, `pnpm test:database`, `pnpm test:projects`, `pnpm test:admin`, `pnpm test:recovery`, `pnpm lint`, `pnpm build`, and `git diff --check` under Node >=22.12. For the static-route localization fixture run `VITE_SERVICES_SOURCE=local VITE_INQUIRIES_ENABLED=false pnpm test:i18n`; those process-only flags do not edit environment files. Services tests separately render enabled CMS/contact states in HY/EN/RU.

Services tests include Phase 6 baseline security regressions plus Phase 6.1 migration rollback, generated classification, core protections even as owner, roles/metadata boundaries, dynamic-key uniqueness, publication completeness, archived visibility, exact inquiry RPC/ACL/history preservation, row-cap pagination and page reconciliation. Native tests use private Unix sockets with TCP disabled, synthetic schemas only, observed backend blocking and cleanup; a reported SKIP is not a concurrency pass. Local stand-ins do not certify hosted role memberships, triggers, Data API or real browser behavior.

## Rollback

An error before COMMIT rolls back schema, core publication and RPC changes together. After COMMIT prefer a reviewed forward correction; keep all Services, immutable keys and historical requests. Do not restore a whole database over newer inquiries or drop additional rows to reinstate the old six-key constraint. Core protections must remain in place when rolling back frontend code. Older UI may display unsupported actions which PostgreSQL rejects, and cannot create dynamic services. No automatic destructive down migration is provided. A full restore requires a separate recovery decision and preservation of post-checkpoint requests.
