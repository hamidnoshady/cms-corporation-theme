# Apex — corporate/SaaS theme for Eshobe CMS

An independently deployable, Persian-first marketing theme inspired by the
[DesignMD Vercel reference](https://www.designmd.co/d/vercel). Biza Miz is the
sample tenant, not a hardcoded dependency of the page renderer.

**Implementation:** stages 1–4 of [issue #1](https://github.com/hamidnoshady/cms-corporation-theme/issues/1),
with live launch gates still required. See [status and verification](docs/STATUS.md).
A local mock test is not evidence that a production lead was delivered or a
production deployment/rollback completed.

## Local development

Node 22; pnpm 9.15.9.

```sh
pnpm install --frozen-lockfile
pnpm dev --hostname 0.0.0.0
# or production sample preview:
pnpm build
APEX_DEMO_MODE=true pnpm start --hostname 0.0.0.0
```

`/` is Persian RTL, `/en` English LTR. All priority pages have corresponding locale
URLs. A language switch makes a full navigation so the document language, fonts,
direction and server-rendered chrome change together. The default-locale prefix
redirects to one canonical URL. Theme preference uses the `apex-theme` cookie.

Local development without CMS credentials uses the sample snapshot. Production
without credentials **fails closed**, unless `APEX_DEMO_MODE=true` is explicitly
set. Partial CMS configuration never falls back to Biza Miz content. Demo and
Eshobe preview origins are noindex.

`ESHOBE_CMS_URL` must be an origin the container can reach directly: HTTPS, or an
internal plain-HTTP Docker/Coolify service name such as
`http://eshobe-cms-web:3000` (Eshobe copies its `DEPLOY_CMS_URL` here). Other
internal names or IP addresses over HTTP need an exact
`APEX_CMS_HTTP_ORIGINS=host:port` entry; public HTTP origins, credentials,
query strings, fragments and paths are rejected. `GET /api/health` is local
liveness only; `GET /api/ready` (bearer `APEX_READY_TOKEN` or
`ESHOBE_REVALIDATE_SECRET`) performs one bounded CMS `/api/site` read and reports
the failure class without exposing secrets. See
[CMS origin, liveness and CMS readiness](docs/OPERATIONS.md#cms-origin-liveness-and-cms-readiness).

## What is implemented

- Next 16 / React 19 / Tailwind 4 / strict TypeScript; standalone non-root Docker image.
- Original token-based design, self-hosted Inter + Vazirmatn, dark/light/system,
  focus-trapped mobile navigation, reduced motion, locale-specific canonicals.
- CMS page slots for home, features, restaurants/cafés, pricing, demo and privacy;
  uploaded product-media slot; tenant header/footer menus, identity and SEO.
- Typed renderers for the business page-builder blocks: content, media, CTA,
  features, pricing, testimonials, FAQ, contact, forms, galleries, team, logos and
  post archives. Unknown/unavailable blocks are omitted, never fabricated.
- Authenticated server-only CMS access with a CMS-specific origin policy (internal
  plain-HTTP service names allowed, public HTTP/credentials/fragments/paths
  rejected), typed and deduplicated failure classes, bounded stale descriptor
  cache, published content checks, ID-based bindings, signed revalidation, local
  liveness plus authenticated CMS readiness, media-only proxy and host isolation.
  Native CMS editor handoff with membership verification.
- Actual Biza Miz website-lead adapter with consent, Persian phone normalization,
  server validation, bounded bodies, signed timed challenges, honeypot, rate
  limits and upstream idempotency. Unconfigured forms cannot claim success.
- Authorized published-catalogue adapter with explicit currency/minor units,
  expiry and tax disclosure. CMS price examples are always labelled illustrative.
- Opt-in first-party analytics transport; signed server conversion callback for
  real downstream milestones, never browser claims of payment settlement.
- Sitemap, robots, per-page social metadata and safe WebSite/WebPage JSON-LD.
- Unit tests, Playwright/axe, eight visual baselines, CMS/CRM contract tests,
  lab performance budget, CI container smoke and GHCR digest registration workflow.

## Verification

```sh
pnpm audit:runtime      # current production dependency advisories
pnpm format:check       # source/test/workflow formatting
pnpm verify             # type generation, strict typecheck, lint, unit tests, production build
pnpm test:e2e           # real Chromium; starts/stops isolated production test servers
pnpm test:a11y          # both locales/themes, all priority pages
pnpm test:visual        # compare committed screenshots (do not update blindly)
pnpm smoke             # read-only probe of SMOKE_ORIGIN, default localhost:3000
                       # SMOKE_READY_TOKEN=… also asserts CMS readiness
node scripts/readiness.mjs  # read-only live launch gate using operator environment
```

Chromium and its small Linux support-library bundle come from npm because the
sandbox cannot reach the browser download CDN. No global browser install is
needed on Linux. Test services use **synthetic** credentials and local fixtures;
they never contact real customers. Reports and traces are ignored; the reviewed
visual baselines are intentionally committed.

`@eshobe/site-runtime` currently returns 404 on public npm. The exact upstream
0.1.0 runtime at a recorded commit is vendored as a file dependency; see
[vendor notice](vendor/site-runtime/NOTICE.md). Date/number/currency helpers are
used directly (Jalali + Persian digits for `fa`).

## Deployment and integration

- [CMS editing and bindings](docs/CONTENT.md)
- [Lead, pricing and analytics contracts](docs/INTEGRATIONS.md)
- [Preview → production → rollback runbook](docs/OPERATIONS.md)
- [Asset provenance and approval gates](docs/ASSETS.md)
- [Design specification](DESIGN.md) and [agent guidance](AGENTS.md)
- Mirrored [Eshobe Theme API](docs/THEME_API.md), [deployments](docs/theme-deployments.md),
  and [immutable artifacts](docs/theme-artifacts.md)

All credentials go through Eshobe's encrypted Theme Settings or GitHub Actions
secrets. Never commit them or put them in `NEXT_PUBLIC_*` variables. No signup,
wallet, checkout, payment verification or payment ledger is implemented here:
Biza Miz remains the sole identity/billing authority.
