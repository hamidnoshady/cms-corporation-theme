# Delivery status and verification

Recorded **2026-10-25** for [issue #1](https://github.com/hamidnoshady/cms-corporation-theme/issues/1).
This is a repository implementation and local verification record, **not a production launch certificate**.
Do not close the issue solely because these tests pass.

## Four-stage delivery

| Stage | Implemented in this repository | Remaining acceptance outside the sandbox |
| --- | --- | --- |
| 1 — Foundation | Original adapted DESIGN/AGENTS guidance, manifest, local fonts/tokens, Persian/English shell, theme controls, mobile navigation, CMS/runtime/security foundation | Owner design approval; real tenant adoption and settings review |
| 2 — Page system | Home, features, restaurant/café, pricing explainer, demo and privacy routes; CMS business blocks; published pages/posts; ID bindings and Unicode canonicals; both locales/themes | Approved tenant copy/privacy, current product captures, real editorial bindings/translations |
| 3 — Commercial | Existing Biza Miz lead-intake adapter, validation/consent/attribution/challenges/retries/idempotency; approved-catalogue renderer; owner-destination links; opt-in event transport and signed conversion adapter | Real CRM receipt; authorized public pricing export; owner URL; metrics collector/emitter verification |
| 4 — Hardening | Unit/contract/browser/axe/visual/performance checks; SEO; draft/host isolation; standalone build and Docker/CI/GHCR registration tooling; launch and rollback runbook | CI container result for the release commit; Eshobe preview; same-digest promotion, production smoke and rollback; real-device/field performance evidence |

## Follow-up after the first deploy — 2026-10-31 (after #7)

The first deployment of #7 still rendered the fallback and logged
`Error [CmsError]: CMS request failed (503) [config_invalid]`: the new taxonomy
worked, but the rule that rejected `ESHOBE_CMS_URL` was not visible in the
framework log, and the accepted plain-HTTP shapes were narrower than real Eshobe
topologies. Both are addressed:

| Check | Result |
| --- | --- |
| Accepted internal shapes | Docker/Compose service names, reserved internal names (`*.internal`, `*.local`, `*.svc`, `*.svc.cluster.local`, `*.docker`, `*.lan`, `*.home.arpa`) and private IP literals (10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, fc00::/7, fe80::/10) now work over plain HTTP without extra configuration |
| Still rejected | public HTTP hosts and public IPs, loopback (unless the local test flag or an exact entry), URL credentials/queries/fragments/paths, and **the theme's own public origin** (new `cms_url_self_origin`) |
| Rule visibility | `cms_url_*` reason code in the error message (`[config_invalid:cms_url_self_origin]`), `detail` on the error object, `configIssue` from public `/api/health` (code only), `reason` from authenticated `/api/ready`, and a boot line `[cms] {"event":"cms_startup",…}` printed before the first request |
| `pnpm typecheck` / `lint` / `format:check` | PASS |
| `pnpm test` | PASS — **35 unit tests** (7 origin/policy, 5 failure-class, dedupe, readiness) |
| `pnpm build` | PASS — the boot diagnostic runs in the standalone server (verified with both a rejected and an accepted origin) |
| `pnpm test:e2e` | PASS — **38 tests** |
| Live `bizamiz.eshobe.com` re-check | **Not executed here** — redeploy, then read `configIssue` from `/api/health` (or the boot line) and `/api/ready` |

## Deployment hardening for issue #6 — 2026-10-31

The deployed theme rejected the CMS's operator-provisioned internal plain-HTTP
origin (`http://eshobe-cms-web:3000`), threw a bare `CmsError(503)` before any
request and rendered the global fallback. The theme-side fix and its local
evidence:

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | PASS |
| `pnpm test` | PASS — **34 unit tests** (13 new: origin policy, failure classes, dedupe, readiness) |
| `pnpm build` | PASS — `/api/ready` and `/api/health` both dynamic routes |
| `pnpm test:e2e` | PASS — **38 tests**, including `deployment` (internal HTTP origin allowlisted as `127.0.0.1:3301`, no `APEX_ALLOW_LOCAL_UPSTREAM`; redirect not followed, bounded timeout, outage) and `failsafe` (public HTTP origin rejected, localized fallback, liveness 200) |
| Internal-origin topology | PASS — both locales render published CMS content through the plain-HTTP origin; bearer key and no cookies on every page read |
| Readiness / liveness separation | PASS — `/api/ready` 200 with `checks` all `ok`, 401 unauthenticated, 503 with `cms: unavailable` during a CMS outage, `cms: redirect` for an upstream 302 (never followed) and `cms: timeout` past the 2.5 s bound, while `/api/health` stays 200 `mode: cms` |
| Fail-closed misconfiguration | PASS — untrusted public HTTP origin: liveness 200 `mode: invalid`, readiness 503 `config: invalid` with an `APEX_CMS_HTTP_ORIGINS` hint, pages 500 with the bilingual fallback and a digest reference, never demo content |
| Docker container smoke, Eshobe preview/promotion, live `bizamiz.eshobe.com` | **Not executed here** — requires the operator environment. The production incident is not verified as resolved until the theme is redeployed with the fixed artifact and `/api/ready` returns 200 on the deployed domain. |

## Executed local verification

Environment: Node 22, pnpm 9.15.9, Next **16.4.3**, React 19.2.6,
Tailwind 4.3.3, bundled Chromium 153. No real integration credentials were used.

| Check | Result |
| --- | --- |
| `pnpm verify` | PASS — route generation, strict TypeScript, ESLint, **21 unit tests**, production build |
| `pnpm format:check` | PASS |
| `pnpm audit:runtime` | PASS — **no known production dependency vulnerabilities** reported at verification time; vulnerable older Next/PostCSS/sharp tree replaced |
| `pnpm test:e2e` | PASS — **33 tests**, normal comparison mode (not snapshot-update mode) |
| Visual regression | PASS — **8 committed baselines**, fa/en × light/dark × 360/1440; reviewed full-page captures and hero detail |
| Responsive checks | PASS — all **16** locale/theme/width combinations at 360/768/1024/1440, no horizontal overflow or browser page errors |
| Automated accessibility | PASS — **24 route/locale/theme audits** across six routes; no axe WCAG 2 A/AA or 2.1 AA violations in tested states |
| Keyboard/motion | PASS — modal focus trap/restoration, Escape, locale/theme persistence, native FAQ, reduced-motion mesh |
| CMS contracts | PASS — published edits after signed revalidation, bearer/host isolation, local health during outage, membership-protected draft handoff including Persian slugs/default-locale prefixes, strict HTTP 404s, renamed bindings, Persian slugs, media credential/query stripping |
| Lead/analytics contracts | PASS — synthetic CRM receipt, retry/replay creates one fixture record, malformed success preserves inputs, consent, server-only nonduplicate lead event, signed settlement callback and replay protection |
| Eshobe manifest parser | PASS — accepted as `registry_image` by the upstream parser at `cfe663a50e2e6b1ec21128e4ab1ae3db19bbfa27` (scratch copy with import-path adaptation only) |
| Local standalone preview smoke | PASS — health, both locale homepages, four priority routes, robots and sitemap (9 probes) |
| `node scripts/readiness.mjs` | **BLOCKED as expected** — no operator CMS/CRM/pricing/public-origin/signing configuration in this sandbox |
| Docker execution in this sandbox | Not run — Docker CLI/daemon unavailable. CI builds the image and runs container smoke; check the release commit's GitHub checks. |

The production dependency audit does not cover container OS packages or guarantee
future advisory-free releases. ESLint remains on 9.39.5 to match the current Next
plugin peer ranges; it is a deprecated **development-only** tool. Revisit it when
those plugins declare ESLint 10 support. It is not part of the standalone runtime.

### Local performance sample (not field Core Web Vitals)

A successful browser suite attached `lab-performance.json` with:

- LCP: **116 ms** on local unthrottled Chromium.
- CLS: **0.00985** (budget < 0.1).
- Longest observed FAQ interaction: **16 ms** (lab budget < 200 ms).
- Encoded subresource bodies: **253,329 bytes** (budget < 1,500,000; excludes the initial document).

The Event Timing observer can omit interactions below 16 ms; a missing entry is
not proof of zero latency. This is a single synthetic interaction, **not field INP**.
LCP is recorded rather than used as a flaky shared-CPU gate. Before launch,
measure representative Iranian mobile/network conditions and monitor p75
LCP/INP/CLS after real traffic is available. No field CWV claim is made here.

Reports/traces/JSON are generated under `playwright-report/` and `test-results/`
and intentionally ignored. CI uploads them for review. The eight reviewed PNG
baselines are source-controlled; regenerate only after reviewing intentional UI changes.

## Launch gates still open

1. **Content approval:** replace historical sample captures with approved current
   media; publish both translations, real privacy/consent text, fees/terms and
   verified capability copy. No invented testimonials or business metrics.
2. **Tenant configuration:** deploy server-held site key, correct host/origin,
   CMS ID, signing secrets and scoped encrypted integration values through Eshobe.
   Keep demo/local-upstream exceptions off. Confirm tenant settings survive upgrades.
3. **Sales handoff:** create an authorized Biza Miz website credential; submit a
   consented test lead and verify one actual CRM record, retry and failure handling.
4. **Pricing:** obtain an approved published catalogue/export. The existing private
   billing APIs are not public marketing sources. The adapter schema is documented
   in [INTEGRATIONS.md](INTEGRATIONS.md); this repository does not create that export.
5. **Funnel:** approve the owner onboarding destination; verify the collector really
   records opted-in traffic. Provision and verify any demo/activation/settlement
   emitter. Do not equate an HTTP acknowledgement or in-memory dedupe with a durable
   sales/payment ledger.
6. **Artifact/deployment:** configure GHCR pull access and the Eshobe artifact callback;
   require green CI including container smoke, register an immutable digest, deploy
   Eshobe preview, then promote that same reviewed artifact. Record production smoke
   and a rollback rehearsal to a retained prior digest without resetting tenant data.

Follow [OPERATIONS.md](OPERATIONS.md) for the exact preview → production → rollback
sequence. The local sample preview is neither an Eshobe-managed preview nor a
production deployment. No live lead, approved price feed, GHCR publication,
production promotion or rollback is claimed in this record.
