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
Run `pnpm test:i18n` for translation coverage, route rendering, language persistence,
metadata and form-validation checks. Desktop/mobile interaction and visual checks
still require a browser.

## Existing functionality

- Armenian (default), English and Russian public pages, including services, workflow,
  projects, company and contact sections.
- Project category filtering and `/projects/:slug` detail pages with galleries.
- Telephone and email contact links.

The contact form is not connected to a backend. Submitting it does not send or
store data; it displays a message directing customers to the existing contact links.
Supabase, staff authentication and transactional email are planned and are not implemented.

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

## Localization

`src/i18n/locales/{hy,en,ru}.json` contains matching semantic UI keys and a
`content` section for editable entities. `src/data/projects.js`, `services.js` and
`categories.js` expose stable IDs and multilingual fields such as `title.hy`.
Use `localized(field, i18n.resolvedLanguage)` for content and `useTranslation()`
for UI. Add every key to all three locale files; `pnpm test:i18n` checks parity,
interpolation variables, source keys and rendered routes.

First-time visitors receive Armenian regardless of browser language. HY/EN/RU
buttons save the selection under `parametr.language` in localStorage. Blocked or
invalid storage falls back to Armenian. Routes stay `/` and `/projects/:slug`;
there are no language URL prefixes. Route metadata and HTML language update on
selection. Metadata is client-rendered; separate indexable language URLs and
prerendering remain future SEO work.

The contact form uses localized inline validation and does not send or save data.
Language changes preserve the selected project filter and entered form values.
