# AGENTS.md — AI & developer guidance for the Apex corporate theme

This file is for Claude Code, Cursor, Windsurf, Copilot or any other agent (human
or mechanical) editing this repository. Read it **and** `DESIGN.md` end-to-end
before you touch any UI file.

## 0. What this repository is

`hamidnoshady/cms-corporation-theme` is the **Apex** theme: a Vercel-inspired,
production-grade corporate / SaaS marketing theme for
[Eshobe CMS](https://github.com/hamidnoshady/eshobe-cms). Its first tenant is
[Biza Miz](https://github.com/hamidnoshady/biza-miz), a Persian-first restaurant
& café POS. The theme must work for other corporate customers too — Biza-Miz
specific copy, links, and imagery live in CMS content bindings, not in hardcoded
theme code.

The API contract this theme implements lives in
[`docs/THEME_API.md`](docs/THEME_API.md) (mirror of
`eshobe-cms/docs/THEME_API.md`, cfe663a50e2e6b1ec21128e4ab1ae3db19bbfa27 recorded for offline use) and
[`docs/theme-deployments.md`](docs/theme-deployments.md). If those docs and this
file disagree, the upstream `eshobe-cms` docs win — refresh the local copies and
update this file.

## 1. Before you write UI code

1. Read `DESIGN.md`. If your change introduces a new color, shadow, radius,
   type size, motion curve, or surface, edit `DESIGN.md` first and add the token
   to `src/app/globals.css` in the same PR. No drive-by hex values in JSX.
2. Read §4 (Site Descriptor) and §17b (Deployable Themes) of THEME_API. The
   `/api/site` payload and `themeRuntime.settings`/`bindings` shape is how the
   theme receives tenant config — invent no parallel config files.
3. Know which stage of the project you're working on:
   - **Stage 1 (Foundation):** `eshobe.theme.json`, design tokens,
     typography, layout shell, header/mobile-nav with light/dark + fa/en
     switching, health + revalidate endpoints, CMS client, Dockerfile.
   - **Stage 2:** Home, restaurants, pricing, demo/contact pages, all CMS blocks.
   - **Stage 3:** Lead handoff to Biza Miz, pricing catalogue, analytics.
   - **Stage 4:** Accessibility/visual regression tests, SEO/sitemap,
     secure multi-tenancy, preview, production smoke.
   The owner has authorized stages 2–4 on this branch. Keep live verification gates explicit; a mocked test is not proof of production delivery.

## 2. Deterministic visual rules (not "make it Vercel-like")

When an agent is asked to build a new component, these rules replace any vague
"premium / Vercel vibe" language:

- Palette: only the tokens in `DESIGN.md §1`. The hero mesh gradient is the only
  decorative color on the page.
- Type: only the `t-*` utility classes defined in `globals.css`. Do not introduce
  a new font-size that isn't in the scale.
- Surfaces: 1px `var(--border)`; rounded `var(--radius-md)` unless the component
  is explicitly a pill or a no-radius element. No drop shadows on cards.
- Spacing: 4px scale; gaps between sections are at least `--space-12` (48px) on
  desktop, `--space-8` (32px) on mobile.
- Motion: 200 ms standard ease; 320 ms entry ease; `prefers-reduced-motion`
  disables decorative animation entirely.
- Hover states on interactive elements must be reflected in all three of:
  color/border change, 200 ms transition, visible focus ring (accent 2px) for
  keyboard users.
- Icons: `lucide-react`. Import only the icons you use; no blanket wildcard
  imports. Size consistently (14–24px controls, 28/32px section/status icons) and `stroke-width={1.5}`.

If a PR cannot pass the checklist below, it is not ready:

- [ ] `pnpm typecheck` and `pnpm lint` are clean.
- [ ] `pnpm build` succeeds.
- [ ] The page renders without horizontal overflow at 360 / 768 / 1024 / 1440 px.
- [ ] Both `dir="rtl" lang="fa"` and `dir="ltr" lang="en"` look correct.
- [ ] Light and dark themes both look correct (toggle in header).
- [ ] Keyboard Tab order makes sense; every button/link has a visible focus ring.
- [ ] No hardcoded prices, phone numbers, brand names, or testimonials in JSX
      — those come from CMS settings or `contentSlots`.

## 3. Architecture rules

- **Framework:** Next.js 16 App Router + React 19 + TypeScript (strict) + Tailwind
  v4. We follow the same structure as the reference Meridian theme
  (`cms-portfolio2-theme`), stripped down to the corporate use case.
- **Rendering:** default RSC. Client components get the `"use client"` directive
  *only* when they need state, effects, or event handlers (theme toggle, mobile
  menu, form state). Avoid client components for static presentation.
- **Data:**
  - In CMS mode (`ESHOBE_CMS_URL` + `ESHOBE_API_KEY` present), `src/lib/cms/client.ts`
    fetches with bearer auth from the CMS through the CMS-specific origin policy in
    `src/lib/cms/origin.ts` (HTTPS, or a single-label internal service name over
    HTTP, or an exact `APEX_CMS_HTTP_ORIGINS` entry). Never relax the shared
    `serverUrl()` in `src/lib/security/http.ts` to make a CMS origin work.
  - In local dev without credentials, `src/lib/cms/source.ts` falls back to a
    small static demo snapshot in `src/lib/demo/content.ts` so pages render.
  - Never accept `?site=`, `?tenant=`, or a body `siteId` as tenant identity.
    Tenant comes from `Host` / `Authorization` only (THEME_API §3, §14).
- **Security:**
  - `ESHOBE_API_KEY`, `ESHOBE_REVALIDATE_SECRET`, and any tenant secret env var
    are server-only. Never prefix them with `NEXT_PUBLIC_`.
  - `POST /api/revalidate` must verify HMAC-SHA256 over raw body with timing-safe
    equal (see `src/app/api/revalidate/route.ts`).
  - `/api/health` is local liveness only and stays the manifest
    `build.healthCheckPath`; CMS readiness belongs to the authenticated
    `/api/ready` probe. Failure classes are logged once per class/window through
    `src/lib/cms/diagnostics.ts` — never log the bearer key, env values, headers
    or upstream bodies.
  - When `proxiesApi: true`, only proxy the whitelisted CMS-owned paths (see
    `src/lib/cms/proxy.ts`); never forward visitor cookies or arbitrary
    authorization headers to the CMS.
- **i18n & l10n:**
  - All user-visible strings in theme code (button labels like "Get started",
    "View demo", nav "Features"/"Pricing") must be available in both `fa` and
    `en`. Use `src/lib/i18n/dict.ts` as the small dictionary.
  - Every date, number, price, and percent must go through `@eshobe/site-runtime`
    helpers via the pinned file dependency in `vendor/site-runtime`
    (npm publication is pending). Never concatenate number symbols manually.
  - Use logical CSS properties everywhere (`ps-*`, `ms-*`, `text-start`,
    `rounded-s-*`). No `left:`/`right:` or `pl-*` for directionality.
- **Styling:** Tailwind utility-first; tiny custom CSS in `globals.css` only for
  design tokens + reusable `t-*` typography classes + `page-shell`/`hairline`/
  `btn-*` component primitives. Avoid bespoke `.module.css` files unless a
  component genuinely needs them.
- **Files to keep in sync:**
  - `eshobe.theme.json` — bump the `design` block if DESIGN.md defaults change.
  - `src/lib/cms/types.ts` — mirrors the shape of `/api/site` we actually use.

## 4. Content ethics

Biza Miz's first-10-customer launch is real. Do **not**:

- Fabricate testimonials, star ratings, case studies, logos, or metrics.
- Show a fake "۱٬۰۰۰٬۰۰۰ تومان" price as if it were a license fee; pricing is
  either live from Biza Miz or clearly marked as illustrative.
- Build a signup / wallet / checkout flow inside this theme — that is Biza
  Miz's responsibility (see linked biza-miz#1041). CTAs lead to demo-request or
  to Biza Miz proper.
- Copy copy, screenshots, or logos from vercel.com. The design system is the
  reference; words and media must be original or supplied by the tenant.

Use placeholder/skeleton states where content isn't ready, and annotate them
with `TODO(content): …` so the CMS team knows what to bind.

## 5. Commits & branches

- Work on the session branch named in the task
  (`arena/<session-id>-cms-corporation-theme`). Push only to that branch. Never
  force-push to `main`.
- Write commits in the Conventional-ish style used across the Eshobe org:
  `feat(nav): mobile sheet with escape-to-close`, `fix(rtl): icon flip in
  secondary button`, `docs(design): add dark token table`, `chore(deps): …`.
- Before opening a PR, run `pnpm verify` (typecheck + lint + unit tests + build) and `pnpm test:e2e`.

## 6. Useful references at your fingertips

- DESIGN.md — this repo: visual system.
- docs/THEME_API.md — render contract, `/api/site` shape, revalidation,
  deployment manifest.
- docs/theme-deployments.md — preview → health → production flow.
- Reference working theme (offline, cloned under `/tmp/cms-portfolio2-theme`
  during development) — Meridian/portfolio. Read it for Eshobe wiring patterns
  but don't copy its editorial/portfolio visual style.
- Biza Miz launch: https://github.com/hamidnoshady/biza-miz/issues/1119
- Billing/activation epic: https://github.com/hamidnoshady/biza-miz/issues/1041
