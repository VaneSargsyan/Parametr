# Projects management — manual setup and verification

No live database changes, function deployment, uploads, Git commits or hosting
changes are performed by the implementation or local tests.

## 1. Apply migrations in staging

Apply `202610120001_admin_auth.sql` if not already applied, then
`supabase/migrations/202610130001_projects.sql` once through SQL Editor or a reviewed
CLI migration. Never rerun the first migration against an existing installation.
Use a dedicated staging project and a trusted project owner. Keep `private` out
of the exposed Data API schemas.

The migration preflight requires the same trusted object owner as Phase 3 and
rejects unsafe helper/schema/role drift. See [security audit](PROJECTS_SECURITY_AUDIT.md).

The new migration creates `projects`, `project_images`, and
`project_storage_cleanup`, plus the internal FK-backed `project_gallery_links`
mirror, with RLS on all four. Published content is readable by
visitors; only active database allowlist members can create/edit projects; only
admins can delete projects. Editors cannot bypass these rules by changing JWT
metadata. The browser cannot create or rewrite image registry rows, enqueue
arbitrary cleanup paths, or upload/delete directly from Storage.

Project UUIDs are database identifiers; original numeric IDs are preserved in
`legacy_id`. Slugs are immutable after creation to preserve detail URLs. Long
descriptions and multilingual features retain existing detail-page content.
Locations are optional: unknown company/project facts are never filled in.

## 2. Private Storage and server function

The migration creates private `project-images`, restricted to JPEG/PNG/WebP and
5 MiB per file. Do not change the bucket to public or weaken its restrictive
policies. Public reads/signing require an attached image belonging to a published
project. Staff may preview drafts. Unreferenced uploads are not public even when
the project itself is published.

Review and manually deploy `supabase/functions/project-media/index.ts` to staging
using Supabase CLI, for example `supabase functions deploy project-media` after
linking the correct project. `supabase/config.toml` disables legacy gateway JWT
verification for this function; the handler instead REQUIRES a bearer token,
verifies it with Auth, and checks current database membership before every
operation. Disabling gateway verification is not disabling the handler's auth.

Set the server-only `ALLOWED_ORIGINS` secret to exact comma-separated origins,
including the intended local/staging origin (for example `http://localhost:5173`).
Do not include paths or use a wildcard. Configure production origins only when
reviewing the production release. Hosted Supabase supplies `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to its function runtime. For
self-hosting configure equivalent server-only values there. NEVER put the
service-role key into Vite, `.env.example`, the repository, or frontend code.

Uploads are streamed with a body cap, checked for MIME/header/trailer consistency
and raster dimensions (maximum 8192 per side and 24 megapixels), and written to
random UUID paths with overwrite disabled. Registration rechecks the employee's
active database membership. This validates format structure, not a complete image
decode, transcoding pipeline, EXIF stripping, or malware scan. Staff should upload
trusted company images; add server-side decode/re-encoding/scanning if untrusted
external uploads are introduced. No public/customer upload endpoint exists.

## 3. Preserve and import the existing portfolio

Leave `VITE_PROJECTS_SOURCE=local` (default) until ALL migration/import, publication
and Storage checks pass. The existing hardcoded projects remain untouched.

`pnpm projects:import-sql` generates `supabase/import/legacy_projects.sql` offline.
It copies all five projects, their Armenian/English/Russian text, features,
categories, IDs and existing image paths. It invents no locations or dates.
Review the generated SQL and run it manually in staging. Imports are DRAFTS by
default. Conflicting IDs/slugs are skipped with notices and existing records are
never overwritten. The SQL transaction rolls back on an unexpected error.
An optional `node scripts/generate-project-import.mjs --publish` generates
published import SQL instead. It is not required; prefer the admin publish
workflow and always review generated SQL before executing it.

Imported legacy images retain their original `/Images/...` references (including
existing AVIF) to preserve the current portfolio exactly. Those assets are
ALREADY public static files and cannot become private through a database policy.
Do not treat their draft/unpublished status as making the old static files secret.
To remove that legacy exception, upload approved JPEG/PNG/WebP replacements into
the private bucket, set each cover/gallery, save, verify every project, then remove
unneeded public originals in a SEPARATE explicitly reviewed change. This phase
does not delete existing assets. New uploads always use the private pipeline.

After reviewing imported records in `/admin/projects`, publish the intended
projects, verify all existing slugs/categories/galleries, and set:

```
VITE_PROJECTS_SOURCE=supabase
```

Restart/rebuild locally. Supabase mode uses ONLY database published projects,
never merges with or falls back to static data. An empty database remains empty;
network/configuration errors show an error rather than resurfacing unpublished
legacy content. Switching back to local intentionally restores the old public
portfolio, including records subsequently unpublished/deleted in Supabase, so it
is an operational rollback decision, not an automatic failure strategy.

## 4. Employee workflow

1. Sign in and open Projects. Search or filter by category/publication state.
2. New project: enter the permanent URL slug, category and Armenian title. Save
   the draft to create its UUID before uploading images.
3. Use the content-language selector to edit titles, short/full descriptions,
   optional locations and feature lists. No automatic translation is performed.
4. Upload images; previews appear in the editor. Select a cover and add desired
   images to the gallery. Reorder using the accessible up/down controls. Save.
5. Publish requires titles and both descriptions in all three languages plus a
   cover. Feature lists must have matching counts. Save as draft also unpublishes.
6. Removing an image from the gallery only detaches it after saving. Once no longer
   used as cover/gallery, choose Delete unused image to physically remove it.
7. Only admins see project deletion, with confirmation. RLS also blocks editors
   and unauthorized API clients from deleting projects.

Concurrent saves use `updated_at` to prevent silent overwrite. On conflict,
reopen the latest record and reconcile edits. Unsaved changes prompt on navigation
or reload; a forced session expiry/authorization loss can still discard unsaved
form state. Background successful auth refresh no longer unmounts the editor.

## 5. Image delivery and cleanup tradeoffs

Private images use five-minute signed URLs. Public queries use a SEPARATE anonymous
client with no employee session and explicitly request published rows only.
Public pages renew image URLs every four minutes/on focus. Staff can refresh
previews without resetting the editor.

A signed URL already issued can remain valid until its five-minute expiry after
unpublishing. Browser/CDN caches and downloaded copies cannot be recalled.
If immediate revocation is mandatory, replace signed delivery with an authorized
no-store streaming proxy. Original static assets have the separate legacy
limitation described above.

Deleting image metadata or a project queues Storage paths transactionally. The
UI asks the authenticated cleanup endpoint to remove those objects and clears
successful jobs. Failed jobs persist; retry via the UI while available. For
maintenance, a trusted admin can invoke `project-media` with its own access token
and `{ "action": "cleanup", "projectId": "<UUID>" }` for project IDs from the
owner-only cleanup table. Repeat for batches exceeding 100. Never delete rows from
`storage.objects` manually: use the Storage API. A scheduled cleanup worker is
not installed automatically.

Abandoned uploads remain as private image registry entries. Reopen the project,
review unused previews and explicitly delete them. Do not bulk-delete pending
uploads while another employee is editing. A hard infrastructure failure between
Storage write and database registration can require owner reconciliation; the
handler attempts removal and durably queues cleanup when possible. Project uploads
are limited to 40 registered images in the UI/server precheck (not a strict
concurrency quota). Gallery size is database-constrained to 30.

## 6. Tests and release checklist

Local, credential-free checks:

```
pnpm lint
pnpm test:i18n
pnpm test:admin
pnpm test:projects
pnpm test:database
pnpm build
```

Tests force empty Supabase credentials and local public source, or use isolated
transport doubles. They do not contact the real project, even if `.env.local` has
production values. They cover translation parity/routes, controller role checks,
project input/publication validation, image type/size/dimensions, public query
filtering, CRUD requests, stale-save conflicts, gallery ordering and localized
admin markup. Edge TypeScript is syntax-transformed; this is not Deno type/runtime
verification.

Run the complete `supabase/tests/admin_auth.sql`, `supabase/tests/projects.sql`,
and `supabase/tests/projects_security_hosted.sql` files separately in disposable hosted staging SQL Editor as `postgres`, after the
required migrations. No fragments, impersonation mode or COMMIT. All roll back;
after any error explicitly ROLLBACK before continuing. Review custom Auth and
application triggers before execution: external/nontransactional effects may not
roll back. The project suite refuses UUID/email/slug/image/path/cleanup collisions,
sets consistent JWT contexts, scopes mutations to fixtures, checks exact exception
classes (42501 permission/RLS denial, 23514 application validation), and verifies
cascade/reference cleanup. RLS UPDATE/DELETE denial can legitimately affect zero
rows; the suite checks row counts where that is the expected contract.

`projects.sql` no longer inserts into `storage.objects` or mutates Storage at all.
It reads bucket/RLS/policy catalogs; those presence checks alone do not verify
policy expressions or HTTP authorization. The extended `projects_security.sql`
suite writes metadata and tests direct SQL deletion, so it is LOCAL-only against
our stand-ins unless separately adapted/reviewed for a disposable full stack.
Do not run it unchanged in hosted SQL Editor or disable managed Storage guards.
Storage upload/sign/download/remove authorization needs separate real API tests.

Before release, verify the actual Edge runtime, CORS, private signing, expired
sessions, direct API attempts, create/edit/publish/unpublish/delete, failed uploads,
cleanup retries, concurrent saves, gallery order, all public routes/languages and
mobile/keyboard use in staging. Use Node 22.12+ for supported tooling.

Review Vercel environment/source values and existing SPA rewrites, then rebuild
and deploy ONLY through a separately approved release. No automatic deployment,
remote migration, real-credential test, commit or push is part of this phase.

The embedded PostgreSQL harness executes these SQL suites locally with minimal
platform stand-ins. It does not replace real Supabase API or concurrent-connection
staging tests. See the audit report for confirmed findings and remaining checks.

## 7. Exact staging execution sequence (manual only)

1. Use Node 22.12+ and a disposable company-owned staging project. Record its
   project reference. Inventory existing roles, owners, default grants and Storage
   policies; verify `private` is not a Data API exposed schema. Do not broaden
   privileges to work around a preflight rejection.
2. In staging SQL Editor as the trusted owner (normally `postgres`), execute
   `supabase/migrations/202610120001_admin_auth.sql` ONLY if Phase 3 is absent.
   Then execute `supabase/migrations/202610130001_projects.sql` once. If Phase 4
   already exists, stop and prepare a separate upgrade migration.
3. Run `supabase/tests/admin_auth.sql`, `supabase/tests/projects.sql`, and
   `supabase/tests/projects_security_hosted.sql` separately in that staging SQL
   Editor. Keep `projects_security.sql` local-only.
   Each must reach its final ROLLBACK. If one aborts, explicitly ROLLBACK before
   continuing and investigate; do not run these fixtures in production.
4. Configure Email/password Auth, disable public signup/anonymous sign-in, and
   provision verified employee accounts. Follow the exact first-admin SQL and
   identity checks in [authentication setup](SUPABASE_SETUP.md#secure-first-admin-setup).
   Prepare admin, editor, nonstaff and inactive staff test accounts.
5. Outside the repository, create a private secrets file containing only
   `ALLOWED_ORIGINS=https://your-staging-origin.example,http://localhost:5173`,
   replacing the staging origin with its exact real value. With Supabase CLI
   installed and authenticated, run these commands manually, replacing placeholders:

   ```sh
   supabase secrets set --env-file /absolute/private/path/project-media.env --project-ref YOUR_STAGING_REF
   supabase functions deploy project-media --project-ref YOUR_STAGING_REF
   ```

   Supabase supplies server runtime credentials. Never copy privileged keys into
   Vite variables. Confirm the deployed function requires a verified employee
   bearer token even though the legacy gateway JWT check is disabled.
6. Set the public URL/publishable key in ignored `.env.local` and keep
   `VITE_PROJECTS_SOURCE=local`. Restart Vite. Verify login and create a disposable
   draft. Test upload, cover/gallery save, publish/unpublish, unused-image discard,
   parent deletion and cleanup. Attempt raw unauthorized RPC/Storage requests;
   verify revocation with an existing session. Exercise timeouts and competing
   edits using separate clients; inspect registry, objects and cleanup jobs.
7. Run `pnpm projects:import-sql`, review `supabase/import/legacy_projects.sql`,
   then execute that file in staging SQL Editor. Review all five drafts and
   publish only approved records. After all checks pass, switch the staging
   frontend to `VITE_PROJECTS_SOURCE=supabase` and restart/rebuild. Verify public
   slugs, filters, galleries and all languages, including logged-out clients.
8. Record results and obtain separate production release approval. No production
   migration, deployment or source switch is authorized by this local audit.

Hosted-safety review also adds local snapshot comparisons around every SQL suite,
six independent collision/preservation cases (Auth UUID/email, project slug, image
UUID, Storage path, cleanup job), and deliberate policy regressions to confirm
negative assertions fail. Minimal Auth inserts follow Supabase SQL fixture examples;
custom schema constraints/triggers may still require a reviewed adaptation.

References: [Storage schema is read-only through SQL](https://supabase.com/docs/guides/storage/schema/design)
and [managed SQL deletion protection](https://supabase.com/blog/supabase-storage-performance-security-reliability-updates).

## Hosted extended security suite

Execute **`supabase/tests/projects_security_hosted.sql`**, not the local-only
`projects_security.sql`, as one complete SQL Editor submission with role `postgres`.
Prerequisites: audited Phase 3 and Phase 4 already applied, private project-images
bucket, original validation trigger enabled, trusted owner able to SET ROLE
anon/authenticated/service_role and manage application-owned triggers/function ACLs.
Use isolated disposable staging without concurrent editors or cleanup workers.
Review custom Auth/application triggers for external effects before running. Do
not weaken permissions, disable managed Storage guards, or change fixtures to real
employee IDs to bypass failures. Fixed synthetic UUIDs/emails/slugs fail closed on
collisions rather than overwriting data; additional image IDs and all Storage paths
under the two synthetic project prefixes are reserved by preflight.

The suite retains feature/gallery validation, independent cross-project cover and
gallery FK tests, service-role writes and immutable metadata, image MIME/path and
queued-path rejection, internal ACL checks, role revocation/nonstaff/inactive
checks, privileged-trigger attachment denial and forged-trigger context binding,
Auth deletion/SET NULL behavior, gallery order, parent cascades and cleanup counts.
It tests only application image registry records, not actual stored bytes.

The independent FK check briefly disables the application `validate_project`
trigger; the forged-trigger check briefly grants cleanup trigger EXECUTE. Both
changes occur only in the rollback transaction, never commit, and do not alter
Storage policies. The forged table is created by the owner in pg_temp, then owned
by authenticated; this avoids assuming clients have TEMP privilege. Locks can
block other traffic. A 3-second lock timeout and 20-second per-statement timeout
fail instead of waiting indefinitely; they are not whole-suite time limits.
After any error, request ROLLBACK on the same backend if available, then investigate.
A new pooled SQL Editor request may use another backend; it does not prove cleanup
of the original session. See [SQL Editor safety review](HOSTED_SQL_EDITOR_REVIEW.md). The successful
file rolls back, starts a separate READ ONLY transaction, and performs checks for fixture removal, temporary-table
removal, ACL restoration and validation-trigger restoration, ending with an explicit `security_test_result` PASS row and a second ROLLBACK.
Require that result, not merely an absence of visible errors or a set_config row.
The local harness additionally snapshots existing rows.

Storage is read-only throughout this file: private bucket, RLS, restrictive policy
presence/type/command checks replace metadata mutation tests. These structural
checks do NOT prove policy predicates, interaction with arbitrary additional
policies, signing or file authorization. Broad permissive/restrictive interaction,
other-bucket behavior and direct writes/upserts remain covered by the unchanged
local suite and require separately reviewed HTTP/API tests against hosted Storage.
No HTTP calls, files, secrets, real logins, JWT signature tests or concurrency tests
are performed by the hosted SQL suite. Rollback cannot necessarily undo external
trigger calls, sequence increments or other nontransactional effects.

Local harness validation includes both default-grant configurations, full data
snapshots before/after rollback (including unrelated existing rows), collision
preservation cases against both hosted-safe suites, and deliberately weakened ACL
and image triggers to ensure the extended suite fails on regressions. PGlite uses
PostgreSQL 18 with minimal Auth/Storage stand-ins; hosted platform permissions,
customizations and runtime remain manual verification.
