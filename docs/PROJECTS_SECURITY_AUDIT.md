# Projects migration security audit — 2026-10-13

Scope: the UNAPPLIED `202610130001_projects.sql`, the existing Phase 3 schema,
Storage policies and upload/cleanup handler. No hosted database, credentials,
deployment, commit or push was used. The Phase 3 migration was not rewritten.
The changes are locally verified, not a replacement for staging verification.

## Findings and fixes

### High, conditional: default EXECUTE grants can expose privileged trigger behavior

With additional GLOBAL default EXECUTE grants to authenticated, the original
`private.queue_project_file()` retained that explicit grant after revoking PUBLIC
and anon. A SQL role with TEMP and schema USAGE could attach the definer trigger
to its own temporary table and enqueue forged paths/project IDs. This was actually
reproduced in embedded PostgreSQL. The ordinary Supabase-style public-schema-only
default configuration did NOT expose this private function. No claim is made that
the hosted project has the unsafe global defaults or exposes arbitrary SQL.

The migration now revokes all explicit client/server-role EXECUTE grants on every
internal trigger function, then grants only the necessary invoker validation
helper rights. Definer triggers also verify TG_RELID, operation, level and timing,
so a later accidental EXECUTE grant still cannot attach privileged behavior to
an attacker-controlled relation. An executable boolean role helper remains
intentional; it returns current membership only and changes no state.

### Medium: gallery arrays lacked referential integrity

Deleting a gallery-only image registry row left its ID in a project's array.
The original discard RPC protected normal UI usage but a trusted backend error
or different deletion path could bypass that check. This was reproduced locally.

A private-to-clients, RLS-enabled `project_gallery_links` mirror now enforces
composite foreign keys `(project_id, image_id)`, ordering and uniqueness. Bound
SECURITY DEFINER triggers synchronize it with the existing array API. The cover
also uses a composite FK, so cross-project covers are forbidden independently of
the validation trigger. Before project deletion, links are removed before image
cascades, avoiding dependence on FK trigger ordering. Backend roles cannot mutate
the mirror directly. Parent deletion and cleanup job counts were executed/tested.
Multi-session linking/discard/deletion races still need staging concurrency tests.

### Medium: uncertain registration results could delete a committed upload

The upload handler previously removed a file whenever its insert response carried
an error. A timeout/lost response is not evidence that PostgreSQL rolled back;
the row could already exist or still be committing. The handler now looks up the
exact image identity/path, recovers a confirmed record, and only permits removal
after a known SQL rejection plus a successful absence check. An uncertain outcome
preserves the private object for reconciliation. Pure decision tests cover known
rejection, timeout, failed lookup, recovered commit and mismatched identity. Actual
network fault injection against the Edge/Storage/PostgREST stack remains untested.
This prioritizes avoiding data loss over eliminating every possible orphan.

### Medium, compatibility: cold backend trigger execution lacked helper rights

On a fresh connection, a service_role project INSERT failed with `42501 permission
denied for schema private`. Owner-seeded tests had warmed trigger plans and did
not reveal it. The migration now explicitly grants trusted service_role schema
USAGE and EXECUTE on the non-definer `valid_features` helper only. A service insert
is tested before any owner fixture exercises the triggers. Server roles still
cannot execute internal trigger functions or mutate the gallery mirror.

### Validation and configuration hardening

- Multidimensional text arrays passed the original feature validator; array shape
  and lower bounds are now checked. Gallery arrays reject invalid shape early.
- Image storage paths must match both project UUID and image UUID/format exactly.
  Registry identity/path/type/size/timestamps cannot be repointed by ordinary
  backend updates; Auth-user deletion may still clear attribution.
- Cleanup paths must have their declared project's prefix and expected format;
  a pending cleanup path cannot be registered as a new image.
- A preflight checks Phase 3 existence, helper signature/security/search_path,
  matching trusted ownership, membership RLS and privileged role inheritance.
  It revokes direct client CREATE on private and rejects inherited CREATE rights
  that cannot be removed safely. Unsafe environments fail before project DDL.
- No unknown helper body is silently replaced, and no ownership is reassigned.
  Run as the same trusted owner that created Phase 3 (normally postgres).

## RLS and Storage assessment

Projects retain published-only public SELECT, active admin/editor INSERT/UPDATE,
and active-admin DELETE. Content-column grants exclude identity/authorship/system
timestamps. RLS does not protect TRUNCATE, so client TRUNCATE is explicitly absent.
Image registry writes remain server-only; public metadata SELECT requires a
published project referencing that image. Cleanup/mirror tables have no client
access. The role helper reads database membership, not user/app metadata claims.

The existing restrictive Storage design was correct and retained. PostgreSQL
ORs applicable permissive policies and ANDs restrictive policies. At least one
permissive read policy is supplied; false restrictive INSERT/UPDATE/DELETE checks
block direct bucket writes even if a different permissive policy says true.
Regression tests add a broad permissive policy and prove draft/pending reads and
all direct project writes/upserts remain blocked. Active staff direct writes,
inactive/revoked staff reads/discards, queued-path registration and mismatched
MIME/path rejection are also covered. The other bucket's policy still
works. Existing additional RESTRICTIVE policies can block legitimate access and
must be inventoried; this migration must not silently remove them. Owners and
BYPASSRLS server roles remain a trusted boundary, not restricted by these policies.

Private signed links can survive unpublication for five minutes. Legacy static
images remain public by design until explicitly replaced/removed. No SQL policy
can revoke an already downloaded image or make a public static URL private.

## Ownership, execution order and Phase 3 compatibility

1. Apply Phase 3 once as a trusted owner; its helper is SECURITY DEFINER with empty
   search_path and owns/reads the membership table without recursive own-row RLS.
2. Phase 4 preflight verifies that exact ownership/permission contract and fails
   closed on drift. Verify private is not exposed in PostgREST settings manually.
3. Create projects, registry and FK mirror; set RLS/grants before normal traffic.
4. Create bound validation/synchronization/cleanup functions and triggers. New
   functions inherit the checked migration owner. Explicit EXECUTE revocations
   occur within the same transaction, avoiding an exposed creation/grant window.
5. Create the private bucket and restrictive/permissive policies; commit atomically.
   A table/bucket/policy name collision fails instead of overwriting existing data.

SQL object references are schema-qualified and function search_path is empty.
Unqualified built-ins resolve in implicit pg_catalog; no dynamic SQL exists in
application functions. The migration uses no untrusted search-path schema.
Auth deletion/SET NULL, inactive/nonstaff denial, editor restrictions, published
reads, service-role writes and admin deletion are covered by executable SQL tests.

## Executed tests and limits

`pnpm test:database` runs real PostgreSQL 18.6 in PGlite with minimal auth/storage
stand-ins, not a JavaScript implementation of RLS. It executes BOTH migrations,
four rolled-back SQL suites under two default-grant configurations (eight suites),
a cold service insert, the import twice, seven unsafe-preflight cases, and upload
recovery tests. No credentials or network database connection are required.
PGlite is development-only and is not shipped in the website bundle.

Also run lint, existing project/auth/localization tests and production build.
Node 22.12+ is required for supported tooling; this workspace currently runs
Node 20.20 and emits an engine warning even though the checks pass.

Before ANY production execution, use an isolated real Supabase staging project to:

- Verify its actual PostgreSQL version, object owners/default ACLs, role membership,
  private schema permissions and Data API exposed schemas.
- Run the complete `admin_auth.sql`, `projects.sql`, and
  `projects_security_hosted.sql` suites as postgres on
  disposable staging data. The latter now leaves Storage entirely read-only.
  Keep `projects_security.sql` local-only: its Storage metadata mutations/direct
  SQL deletes are not compatible with all managed hosted Storage protections.
  It temporarily grants EXECUTE transactionally to test defense in depth.
  Never run fixtures against valuable production data.
- Inventory existing Storage policies, bucket configuration, grants and managed
  Storage triggers. The local model does not include those platform components.
- Exercise real PostgREST inserts/updates/select-returning/schema-cache behavior,
  Supabase Auth token verification/expiry/revocation, and Storage signing/upload/
  download/remove calls as anon, nonstaff, inactive staff, editor and admin.
- Test competing saves/discards/deletions with multiple connections and isolation
  levels, plus role revocation while operations are in flight.
- Inject upload/registration/cleanup timeouts and verify committed data is preserved,
  unknown outcomes are reconciled, and queued removals are retried safely.

If Phase 4 was already applied anywhere, do NOT rerun this edited CREATE migration:
prepare a separate reviewed upgrade migration for that installation instead.

References: PostgreSQL [function security](https://www.postgresql.org/docs/16/sql-createfunction.html),
[policy combination](https://www.postgresql.org/docs/current/ddl-rowsecurity.html),
Supabase [default function privileges](https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
PGlite [engine description](https://pglite.dev/docs/about).
