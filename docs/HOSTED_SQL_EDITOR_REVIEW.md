# Hosted SQL Editor safety review — 2026-10-13

Recommendation: CONDITIONAL GO for the entire `supabase/tests/projects_security_hosted.sql`
file on isolated, disposable staging after the prerequisites below. NO-GO on
production, staging with valuable data/active workers, unknown external trigger
behavior, fragment execution, or an execution tool that changes connections or
commits between statements. This is a static review, not proof of hosted success.
No SQL, including embedded/local PostgreSQL tests, was executed during this review.
Earlier database passes apply to the previous revision, not this revision.

## Execution and transactions

Public upstream Studio source submits SQL as a query string in one HTTP request;
the inspected browser execution path does not independently dispatch each SQL
statement. It can choose selected text and apply execution parameters/impersonation.
Public postgres-meta code sends the SQL string to node-postgres, may prefix
session timeouts, and selects the last nonempty result set. This supports whole-file
execution but is not an attestation of the exact hosted release or its routing.
Do not use a user impersonation wrapper, read replica, EXPLAIN, or statement runner.

The first explicit BEGIN contains all fixture DML, role/claim changes, application
trigger disabling/re-enabling, and function GRANT/REVOKE. There is no COMMIT or
prepared transaction. PostgreSQL transactional DDL/ACL changes roll back with the
data. Expected 42501, 23514, and FK/restrict failures are caught only in assertion
subtransactions; sentinel P0001 assertion failures propagate. An unexpected SQL
error aborts the transaction and stops a normal simple-query batch before the
trailing ROLLBACK. It does not commit its transactional modifications. A disconnected
backend rolls back its unfinished transaction; a browser timeout/closed tab alone
is not evidence of backend disconnection or cancellation.

After the fixture ROLLBACK a second explicit READ ONLY transaction performs
catalog/fixture checks, returns an explicit PASS result, and also ROLLBACKs.
Failure here cannot commit the earlier fixtures. The fixed-UUID absence checks
are safe because preflight rejects collisions; they require no concurrent fixture
runner. The checks are not a full dump comparison of arbitrary custom-trigger
changes; local snapshot tests previously supplied that additional verification.

Supabase documents a one-minute Dashboard SQL Editor limit. The suite now sets
20s statement_timeout and 3s lock_timeout for the fixture transaction, and 10s/3s
for verification. Those are per-statement limits; many statements can still exceed
the HTTP limit. Role switching does not apply each role's login-time configuration.
Do not disable Dashboard timeouts, automatically retry, or split the file to work
around an error. SET LOCAL values revert at rollback, including after abort.

A subsequent SQL Editor ROLLBACK request may hit a different pooled backend.
It is not a guarantee that the original transaction was closed. If an error or
transport timeout occurs, stop. Use the same backend for ROLLBACK when available;
otherwise have a trusted owner inspect active SQL Editor backends/locks and resolve
the original session before rerunning. Do not blindly terminate unrelated sessions,
and never COMMIT an uncertain test transaction.

## Hosted privileges and concurrency

`postgres` must own or have appropriate owner privileges on application objects,
be able to SET ROLE anon/authenticated/service_role, create a temporary table and
transfer it to authenticated, and GRANT/REVOKE the cleanup function. Hosted
postgres is not assumed to be a superuser. Hardened role membership, schema ACLs,
or temporary-table rules may reject these operations; do not weaken authorization
to make the test pass. Such unexpected errors must fail the suite.

The temporary trigger grant is uncommitted and is explicitly revoked before the
transaction rolls back. Trigger disabling locks the real projects table until
transaction end; uncommitted DDL/privileges are not an intentional externally
visible grant window. Locks still block traffic; concurrent DDL/role edits can
cause timeouts, deadlocks or different observations. Stop workers and avoid other
editors during the test. MVCC prevents ordinary other-session cleanup workers from
seeing uncommitted fixture queue rows, but custom triggers can cause external effects.

Minimal Auth rows are policy fixtures, not usable login accounts. They follow
Supabase's documented SQL fixture pattern but custom NOT NULL requirements,
profile triggers or Auth schema changes can reject them. Review INSERT and DELETE
triggers on auth.users, triggers on all application fixture tables, and DDL event
triggers. Transactional changes roll back; external network calls, some sequence
increments, external audit logs and similar nontransactional effects may survive.
Do not disable those triggers or managed Storage protection to obtain a pass.

Storage is only read: no object/bucket DML, policy edits, Storage HTTP or files.
Catalog checks prove expected restrictive policy presence/type/command, not their
complete predicates or real file access. JWT settings test RLS context, not token
signatures/expiry. Storage HTTP, actual platform grants, concurrency and custom
trigger behavior remain staging checks. Already-issued signed URLs/static assets
are not affected by this test.

## Exact manual instructions

1. Confirm the disposable STAGING project reference and primary database. Apply
   the audited Phase 3 and Phase 4 migrations beforehand, once only.
2. Review triggers/event triggers and privileges above. Pause staging workers and
   concurrent use. Use a fresh SQL Editor query with no prior open transaction.
3. Choose postgres, disable user impersonation, and paste the complete current
   `supabase/tests/projects_security_hosted.sql`, including both rollback blocks.
   Clear any selection so Run executes all text. Do not change transaction controls.
4. Run once. Expect `security_test_result` containing
   `PASS: hosted security assertions completed and fixture/DDL rollback verified`.
   A set_config result, empty output, timeout or missing marker is not a pass.
5. On failure/timeout follow same-backend/owner inspection guidance above. Do not
   retry until the backend state is understood. No production execution is approved.

## Verification for this review

`node scripts/check-hosted-sql-static.mjs` checks the outer statement structure,
two rollback-only transactions, read-only verification block, explicit PASS row,
trigger/ACL restoration ordering, local role settings and absent Storage mutations.
This is a small static lexer, not a PostgreSQL parser or runtime test. ESLint,
production build and git diff --check are non-SQL checks. The database harness was
not run because this request prohibits ALL SQL execution.

Sources: [Studio query submission](https://github.com/supabase/supabase/blob/master/apps/studio/data/sql/execute-sql-mutation.ts),
[postgres-meta database adapter](https://github.com/supabase/postgres-meta/blob/master/src/lib/db.ts),
[Dashboard timeout](https://supabase.com/docs/guides/troubleshooting/avoiding-timeouts-in-long-running-queries-6nmbdN),
[PostgreSQL simple-query error/transaction handling](https://www.postgresql.org/docs/current/protocol-flow.html),
[Supabase SQL fixtures](https://supabase.com/docs/guides/local-development/testing/overview).
