# Parametr

Existing Armenian construction and engineering website built with React, Vite,
React Router and CSS Modules. Preserve approved company copy and imagery.

## Local development

Use a Node.js version supported by Vite 8 (Node 20.19+ or 22.12+) and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Checks and production build

```sh
pnpm lint
pnpm build
pnpm preview
```

The build writes `dist/`. Preview serves the build locally, not as a production server.
There is currently no automated test suite or test script.

## Existing functionality

- Armenian homepage with services, workflow, projects, company and contact sections.
- Project category filtering and `/projects/:slug` detail pages with galleries.
- Telephone and email contact links.

The contact form is not connected to a backend. Submitting it does not send or
store data; it displays a message directing customers to the existing contact links.
Supabase, staff authentication, multilingual support and transactional email are
planned and are not implemented.

## Environment and deployment

No environment variables are currently required. Local `.env` files are ignored;
only sanitized example files may be committed. Vite exposes `VITE_` variables in
the browser bundle: never place private keys or customer data in them.

Vercel routing is configured in `vercel.json` for existing project detail URLs.
Other hosts must serve `index.html` for those routes on direct navigation/refresh.
Verify homepage anchors, mobile keyboard navigation, all category filters, project
pages, gallery links and unknown project slugs before deploying.

## Phase 1 baseline

The clean starting checkpoint is `00e324a` (`Add project detail pages`). Phase 1
preserves content and styling while improving lifecycle cleanup, accessibility,
form semantics and local configuration. Business claims and project authenticity
still require company review before production launch.
