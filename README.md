# Parametr

Existing Armenian construction and engineering website built with React 19, Vite,
React Router and CSS Modules. Preserve approved company copy, imagery and visual identity.

## Local development

Use Node.js 22.12+ and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Copy `.env.example` to the ignored `.env.local` and configure only the features
needed locally. Static public pages work without Supabase credentials. Backend
features require their migrations, configuration and staging verification.

## Implementation status

This describes repository functionality, not proof that a particular hosted
migration, function or feature flag has been activated. Hosted changes require
separate approval; no development or build command applies hosted migrations or deploys functions.

Implemented:

- Armenian by default, English and Russian public/admin interfaces, language
  persistence, localized client-rendered metadata and dynamic HTML language.
- Public company, services, process, contact and portfolio sections; project
  category filters and `/projects/:slug` galleries.
- Supabase staff sign-in, session restoration, logout and password recovery.
  Active database membership and server-side authorization govern access;
  authentication alone does not grant staff privileges.
- Projects CMS with multilingual editing, publication, cover/gallery management,
  private server-validated image uploads and admin-only deletion.
- Services CMS with HY/EN/RU text, approved icons, ordering, publication, archival
  and inquiry eligibility settings. The Phase 6.1 forward migration adds admin-only
  dynamic service creation as drafts and protects the six core identities from
  renaming, deletion, unpublication and archival. Editors may edit permitted draft
  text but cannot create services, publish/archive or change protected settings.
- Staging customer inquiries: anonymous Contact submission with required service,
  location and privacy consent, optional email, client/server validation, Turnstile,
  durable quotas, idempotency and committed Supabase persistence before success.
- Admin-only customer request list/details, search, pagination, status filters and
  revision-protected updates: New, In Progress, Completed and Rejected. Editors and
  nonstaff cannot access private requests.

Pending or deliberately inactive:

- Automatic company email notifications, Resend integration and delivery retries
  are **not implemented**. Saving an inquiry does not send a company notification.
  Supabase Auth recovery emails are a separate authentication feature.
- Inquiry attachments are not implemented. Settings remains a dashboard placeholder.
- Catalog-based inquiry activation is a separate phase. Keep
  `VITE_SERVICE_INQUIRIES_ENABLED=false` and the database catalog switch disabled.
  Additional published services do not automatically enter the legacy Contact
  selector or submission contract; inquiry eligibility settings do not activate it.
- Production rollout, real browser/platform acceptance, independent language URLs
  and prerendered multilingual SEO remain separate work.

## Environment and feature modes

`.env.example` contains sanitized public placeholders. Never put service-role,
Supabase secret, CAPTCHA secret, HMAC secret, or future email-provider keys in a
`VITE_` variable; Vite exposes those values to browsers. Private environment files
and `supabase/.temp/` CLI metadata are ignored by Git.

| Setting | Behavior |
| --- | --- |
| `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` | Public connection configuration; authorization still requires database policies and RPC checks |
| `VITE_PROJECTS_SOURCE=local` / `supabase` | Static portfolio or published database projects |
| `VITE_SERVICES_SOURCE=local` / `supabase` | Static catalog or published database services |
| `VITE_INQUIRIES_ENABLED=true` with Supabase/Turnstile configuration | Enables the staging submission workflow after setup |
| `VITE_SERVICE_INQUIRIES_ENABLED=false` | Retains the legacy inquiry contract; does not disable public CMS service cards |

In Supabase mode, public Projects and Services use the database as the sole source;
there is no merge or silent fallback to static cards. Public reads use a separate
anonymous client rather than the persisted employee session. Current backend
integrations include staging guards; production activation requires separate review.
If inquiry submission is unconfigured, Contact retains its localized notice and
existing phone/email links rather than claiming a persisted submission.

## Admin and backend setup

Visit `/admin/login`, `/admin/projects`, `/admin/services` and `/admin/requests`.
Request management is restricted to active admins. Published Services edits by an
admin take effect immediately; there is no separate unpublished revision history.
New services use unique immutable keys and approved local icons. Existing core
keys, UUIDs and approved multilingual content must be preserved.

Read the relevant setup documentation before any hosted action:

- [Supabase setup and first-admin provisioning](docs/SUPABASE_SETUP.md)
- [Password recovery investigation and limitations](docs/RECOVERY_FAILURE_INVESTIGATION.md)
- [Projects setup](docs/PROJECTS_SETUP.md) and [security audit](docs/PROJECTS_SECURITY_AUDIT.md)
- [Customer inquiry setup](docs/INQUIRIES_STAGING_SETUP.md)
- [Phase 6 Services baseline setup](docs/SERVICES_STAGING_SETUP.md)
- [Phase 6.1 Dynamic Services staging setup](docs/DYNAMIC_SERVICES_STAGING_SETUP.md)
  and [security review](docs/DYNAMIC_SERVICES_SECURITY_REVIEW.md)
- [Hosted SQL Editor test review](docs/HOSTED_SQL_EDITOR_REVIEW.md)

Phase 6.1 is a new create-once forward migration. Applying it publishes existing
core drafts and enables their protections; it therefore requires explicit
publication approval and a fresh verified ACL-preserving backup. Do not rerun
previously applied migrations or the six-service import. Preserve later customer
requests when considering recovery; prefer a reviewed forward correction.

`pnpm projects:import-sql` generates reviewable draft-import SQL locally; it does
not connect to Supabase. Existing static image paths remain public until separately
replaced; new project uploads use private Storage and expiring signed links.

## Localization

`src/i18n/locales/{hy,en,ru}.json` contains matching UI keys and static content.
Static data modules expose stable IDs and multilingual fields such as `title.hy`.
CMS records store HY/EN/RU fields in Supabase, mapped to multilingual public data;
new service content can be managed without adding translation-file entries.
Use `localized(field, i18n.resolvedLanguage)` for entity content and
`useTranslation()` for UI messages. Add each UI key to all three locale files.

First visits use Armenian regardless of browser language. HY/EN/RU buttons persist
`parametr.language` in localStorage; blocked or invalid storage falls back to
Armenian. Routes have no language prefixes. Language changes preserve the project
filter and entered Contact values.

## Checks and production build

```sh
pnpm test:admin
pnpm test:recovery
pnpm test:projects
pnpm test:database
pnpm test:inquiries
pnpm test:services
pnpm test:services:locking
VITE_SERVICES_SOURCE=local VITE_INQUIRIES_ENABLED=false pnpm test:i18n
pnpm lint
pnpm build
git diff --check
```

The localization suite expects static public fixtures; these process-only flags
prevent local CMS settings from changing that fixture. Services tests separately
cover enabled CMS/contact rendering in HY/EN/RU. Native locking tests require local
PostgreSQL tools, use disposable clusters with private Unix sockets and TCP disabled,
and clean up afterward. A SKIP is not a concurrency pass. Database tests use local
stand-ins; SDK/server-render tests do not verify live Auth, Storage, PostgREST,
CAPTCHA, redirects or desktop/mobile layout. No test requires production access.

The build writes ignored `dist/` output. `pnpm preview` serves it for local checking.
Vercel rewrites support project detail URLs and `/admin/*`; other hosts must serve
`index.html` on direct navigation. A successful build is not deployment approval.

## Baseline and Git hygiene

The starting checkpoint is `00e324a` (`Add project detail pages`). Earlier baseline
work preserved content/design while improving lifecycle cleanup, accessibility,
form semantics and configuration. Company claims still require company review.

Keep credentials, database dumps, customer exports and local CLI metadata out of
commits. Review untracked files and shared-file hunks before staging; the current
working changes may span multiple phases. Never use a broad add operation without
reviewing the proposed index. No commit or push is automatic.
