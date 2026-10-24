# Eshobe Corporation Theme — Design Specification

- **Date**: 2026-10-24
- **Status**: Approved for planning
- **Issue**: [hamidnoshady/cms-corporation-theme#1](https://github.com/hamidnoshady/cms-corporation-theme/issues/1)
- **Theme key / name**: `eshobe-corporation` / "Eshobe Corporation" / «پوستهٔ شرکتی اشوبه»
- **References**: [Eshobe Theme API](https://github.com/hamidnoshady/eshobe-cms/blob/main/docs/THEME_API.md), [theme deployments](https://github.com/hamidnoshady/eshobe-cms/blob/main/docs/theme-deployments.md), [DesignMD Vercel reference](https://www.designmd.co/d/vercel)

## 1. Purpose and scope

Build a production-grade, reusable, Eshobe-native corporate/SaaS theme with a Vercel-inspired visual language, demonstrated first with Biza Miz restaurant/café marketing content.

**In scope (this pass): Stage 1 + Stage 2 of the issue**

- Committed `DESIGN.md` translated from the DesignMD reference, plus `AGENTS.md` that mandates reading it and the Theme API before UI edits.
- Eshobe theme manifest, design tokens, typography, layout shell, theme switch, responsive RTL navigation.
- CMS-driven page system: homepage, restaurant/café landing, pricing explainer, features page, demo/contact form, light/dark, fa/en.
- Fixture-backed local development, content pack for Biza Miz, test and verification harness.

**Out of scope (Stages 3–4)**: live lead handoff/CRM and attribution, funnel analytics, live Biza Miz price sourcing, wallet/signup destinations, sitemap/robots, production preview→health→release→rollback, GHCR artifact workflow, full visual-regression baselines.

Nothing in this pass may claim a deployed integration or fabricate testimonials, metrics, prices, or product capabilities.

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Composition model B: contract block vocabulary with theme-owned designed variants | Keeps CMS authoring authority while reaching reference-level art direction; no invented block types |
| D2 | Theme key `eshobe-corporation` | Owner decision; matches repo identity in the CMS picker |
| D3 | Product showcase imagery is AI-generated, stored under `public/demo/`, fixture-only, labelled illustrative | Owner decision; contained so no fabricated imagery reaches production theme code |
| D4 | Stack mirrors `cms-arch2-theme`: Next 16, React 19, Tailwind v4, standalone Docker | Contract-proven sibling implementation |
| D5 | Vendor `@eshobe/site-runtime` as a workspace package instead of an ad-hoc alias shim | npm package is unpublished and missing documented exports (`resolveSiteRoute`, `siteOrigin`, `localeCodes`) |
| D6 | Announcement banner deferred | No localized announcement field exists in `header`, page blocks, or manifest settings; shipping a Persian-only banner would break fa/en parity |
| D7 | Blog/archive deferred | Issue schedules learning/blog for a later phase; `archive` block warns and renders nothing |

## 3. Design system

`DESIGN.md` is a first-class deliverable with machine-readable frontmatter (colors, typography, rounded, spacing, components) and human sections (overview, layout, elevation, do/don't, Persian adaptations, accessibility, motion). It records attribution to the DesignMD reference and every deliberate deviation.

### 3.1 Reference translation

| Reference trait | Adaptation |
|---|---|
| Ink `#171717` primary CTA, near-white canvas, 1px hairlines | Kept as neutral core, tokenised |
| Four-step surface ladder (white / 98% / 95% / polarity-flipped ink) | Kept; inverted pair is semantic and self-flips in dark mode |
| Multi-stop mesh gradient, hero scale only | Original CSS multi-radial composition with our stops and geometry; never a copy of Vercel's SVG |
| Geist / Geist Mono | Vazirmatn (Persian, Eshobe standard) + Inter Variable (Latin) + JetBrains Mono (technical labels), all openly licensed, self-hosted. No Vercel font binaries, marks, copy, or screenshots |
| Aggressive negative display tracking | Latin only; Persian exempt (no negative tracking on connected script), 1.8 body leading, ~1.25 display leading |
| 4px spacing, 1400px container, 600/960/1200/1400 breakpoints | Kept; section rhythm 96–128px desktop, 56–64px mobile |
| Stacked shadows L1–L5 + inset hairline | Kept; dark mode ring becomes `inset 0 0 0 1px rgb(255 255 255 / 8%)` |
| Radius 4/6/8/12/16 + 64/100 pills | Theme owns scale; CMS `radius` maps to control/card radius only. Marketing CTAs stay pill; nav CTAs 6px |

### 3.2 Tokens

- **Colors (light)**: `ink #171717`, `body #4d4d4d`, `mute #888888`, `hairline #ebebeb`, `hairline-strong #a1a1a1`, `canvas #ffffff`, `canvas-soft #fafafa`, `canvas-soft-2 #f5f5f5`, `link #0070f3`, semantic success/warning/error with soft/deep variants.
- **Colors (dark)**: `canvas #0a0a0a`, `canvas-soft #111111`, `canvas-soft-2 #171717`, `ink #ededed`, `body #a1a1a1`, `mute #737373`, `hairline #262626`, `hairline-strong #525252`.
- **CMS-editable only**: `primary`, `accent`, `background`, `foreground`, `radius (none|sm|md|lg)`, `lineHeight (1.4–2.4)`, emitted on `body` scope via `themeCss(site.theme)` in a `#site-theme` style element. Every other token lives in theme CSS. The platform maps radius to `0 / 4 / 10 / 16px`; the default `md` is the nearest step to the reference's 8px card radius and is recorded as a deliberate deviation. When a tenant overrides it, cards and controls follow the tenant value; pill CTAs keep their brand shape.
- **Type scale**: display-xl 48/48/−2.4, display-lg 32/40/−1.28, display-md 24/32/−0.96, display-sm 20/28/−0.6, body-lg 18/28, body-md 16/24, body-sm 14/20/−0.28, caption 12/16, mono 12–13. Persian overrides tracking to 0 and leading to 1.8 body / ~1.25 display.
- **Radii**: 4/6/8/12/16 + 64/100/full. **Spacing**: 4px base; 4, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128, 192.
- **Elevation**: L1 inset hairline; L2 soft drop; L3 soft stack; L4 float stack; L5 modal. Stacked offsets only, always with inset ring.
- **Token parity**: CSS variables and a TS mirror are asserted by a unit test.

### 3.3 Components

Nav (sticky 64px, mobile overlay, locale/theme switches), buttons (primary pill, secondary, ghost; sm/md/lg; full state matrix), badge + mono eyebrow, marketing/soft cards, product mockup chrome, section header, feature grid, sticky-stack band, pricing card + featured, testimonial card, FAQ accordion, logo strip, announcement primitive (deferred in pages), inputs/select/textarea with helper and error text, submit states (idle/pending/sent/error), contact card, CTA band, footer.

### 3.4 Motion, accessibility, performance

- Motion: 150–250ms state transitions; scroll reveals ≤80ms stagger; transform/opacity only; no parallax, infinite loops, or layout-shift animation. `prefers-reduced-motion` removes all of it.
- Accessibility: 4.5:1 body / 3:1 large text, visible focus ring, 44px touch targets, skip link, `aria-expanded/controls`, labelled fields with `aria-describedby`, `aria-live` status, no keyboard traps, logical properties only (`ms/ps/text-start`; `ml/pl/text-left` banned by lint).
- Performance: server components by default; client islands limited to nav/mobile menu, theme toggle, accordion, form, reveal observer; no animation library; self-hosted subset woff2 with `font-display: swap` and preload; `next/image` with explicit `sizes`; CSS hero mesh. Budgets: CLS < 0.1, LCP < 2.5s, INP < 200ms; sections usable without JS except the islands.

## 4. Architecture

### 4.1 Repository layout

```text
eshobe-corporation-theme/
├── eshobe.theme.json
├── DESIGN.md
├── AGENTS.md
├── README.md
├── Dockerfile
├── package.json / pnpm-workspace.yaml
├── demo-packs/biza-miz/           # page JSON, form schema, nav links, import script
├── packages/site-runtime/         # vendored @eshobe/site-runtime workspace package
├── public/
│   ├── demo/                      # fixture-only generated mockups, labelled illustrative
│   └── fonts/                     # Vazirmatn, Inter, JetBrains Mono + licenses
├── src/
│   ├── app/[[...path]]/           # resolve → dispatch → RouteShell
│   ├── app/api/health/
│   ├── app/api/revalidate/
│   ├── app/api/[...segments]/     # allowlisted CMS proxy
│   ├── app/api/exit-preview/
│   ├── cms/                       # client, site descriptor, typed queries, draft policy, cache tags
│   ├── sections/                  # hero, showcase, feature-grid, sticky-stack, pricing, logos, testimonial, faq, cta, form, media, editorial, gallery, team, contact
│   ├── blocks/                    # blockType → section + variant resolver
│   ├── components/                # ui primitives, nav, footer, mockup chrome
│   ├── lib/{i18n,routing,theme,seo,media}
│   └── styles/                    # globals.css @theme tokens, fonts.css
└── tests/{unit,browser,fixtures}
```

### 4.2 Routes and bindings

- `fa` is unprefixed; `en` is prefixed (`/en/...`). A locale absent from `availableLocales` is a 404. `dir` derives per request.
- Theme-owned routes: `/`, `/restaurants`, `/pricing`, `/features`, `/demo`, plus `/<cms-page-slug>`.
- Each route resolves `themeRuntime.bindings[slot]` by page ID first, then the matching theme setting slug (`restaurantsSlug`, `pricingSlug`, `featuresSlug`, `demoSlug`). A missing binding is a 404; no bundled fallback copy.
- Page content is fetched by ID/slug with `depth=2` (single doc), media resolved via `site.media.origin`, and header/footer globals fetched in parallel.
- Nav comes from the `header` global. Footer columns use `footer.navItems`, followed by brand and legal line; no contact or social fields are invented, and no CMS fields beyond `navItems` are assumed.

### 4.3 Block → section resolution

| Contract block | Section | Variant rule |
|---|---|---|
| `cta` | hero / cta-band / inline | First `cta` on a landing route → hero (mesh backdrop unless `heroTreatment=plain`; link 1 primary pill, link 2 secondary). Last → inverted CTA band. Else inline |
| `mediaBlock` | showcase / editorial figure | Immediately after hero → 16:10 mockup chrome unless `showcaseTreatment=editorial`; else framed by `size`/`aspect`, `auto` derived from orientation with viewport cap |
| `features` | feature grid / sticky-stack | `columns` 2–4; sticky-stack when `featureTreatment=sticky`, disabled under reduced motion |
| `pricing` | pricing grid | `featured` plan polarity-flipped in both themes; price via `formatNumber` + `unit` |
| `testimonials` | quote cards | CMS items only; empty → section omitted |
| `faq` | accordion | Radix single-collapsible, keyboard complete |
| `logos` | logo strip | Monochrome via `logosMonochrome`, colour on hover |
| `content` | editorial columns | Lexical `direction` per field, `unicode-bidi: plaintext` |
| `gallery` | image grid | Columns from block |
| `team` | team grid | CMS members only |
| `contact` | contact card | Phones via `toLocaleDigits` |
| `formBlock` | CMS form | Renders `forms.fields[]` verbatim plus hidden honeypot |
| `archive` | deferred | Dev warning, null in production |

- Section surfaces alternate `canvas` → `canvas-soft` deterministically; inverted bands reserved for hero-adjacent showcase and final CTA.
- Unknown `blockType`: log and render nothing. Never invent a block type.

### 4.4 Manifest

- `contractVersion: 1`, `key: "eshobe-corporation"`, `name: "Eshobe Corporation"`, `nameFa: "پوستهٔ شرکتی اشوبه"`, `siteTypes: ["business"]`, `locales: ["fa","en"]`.
- `capabilities`: `rtlFirst`, `multiLocale`, `pageBuilderBlocks`, `forms`.
- `design` defaults: `primary "#171717"`, `accent "#0070f3"`, `background "#fafafa"`, `foreground "#171717"`, `radius "md"`, `lineHeight 1.8`.
- `build`: `dockerfile`, port 3000, `healthCheckPath: "/api/health"`, `isStatic: false`; no `deployment` block (Coolify build strategy).
- `env: []` (all `ESHOBE_*` variables are platform-injected).
- `settings`: `heroTreatment` (select mesh|plain, default mesh), `featureTreatment` (select cards|sticky, default cards), `showcaseTreatment` (select mockup|editorial, default mockup), `logosMonochrome` (boolean, default true), `restaurantsSlug` (text, default "restaurants"), `pricingSlug` (text, default "pricing"), `featuresSlug` (text, default "features"), `demoSlug` (text, default "demo").
- `contentSlots`: `home` (type `page`, required), `restaurants` (type `page`), `pricing` (type `page`), `features` (type `page`), `demo` (type `page`).

## 5. Data flow, caching, preview, security

- **Bootstrap**: one cached `GET /api/site` per request (key-authenticated) validates `contractVersion`, media origin, locales, settings, bindings.
- **Tenancy**: every CMS call uses `ESHOBE_CMS_URL` + `Authorization: Bearer $ESHOBE_API_KEY`; never a rewritten `Host` (loops back into the theme container). No `?site=` anywhere. The key never reaches the browser.
- **Draft policy**: centralized. A site key can read drafts, so public rendering always sends `draft=false` and `where[_status][equals]=published` for pages, posts, products and form submissions. Globals (`header`, `footer`, theme, store), `categories` and `search` do not carry a publish status, so they are read with the publish filter disabled but still tenant-scoped. Preview requires Next `draftMode()` **and** a non-canonical host, then uses `no-store`, `draft=true`, `noindex`.
- **Cache**: `force-cache`, site 30s / content 60s, tags `cms:all` and `tnt:<site>:<locale>:<resource>`.
- **Revalidation**: `POST /api/revalidate` verifies raw-body HMAC-SHA256 (`x-eshobe-signature`), a timestamp tolerance of ±5 minutes, a 64KB cap, purges payload tags/paths, at-most-once, 3s.
- **Proxy**: `/api/[...segments]` allowlists CMS heads (`site, pages, posts, products, categories, header, footer, forms, form-submissions, search, media, theme, store, checkout, payments, redirects, globals`), drops visitor cookies/auth, refuses recursion, and forwards to the CMS with its own host.
- **Media**: URLs resolved against `site.media.origin`; SVGs via `<img>`, never inline; remote patterns restricted to the CMS origin.

## 6. Forms

The demo/contact form is a CMS `formBlock` submitted to `/api/form-submissions`:

```json
{ "form": "<formId>", "submissionData": [{ "field": "name", "value": "…" }] }
```

- Tenant is derived server-side from the form document; the client cannot choose it.
- Required consent is a **checkbox field in the CMS form schema** shipped with the content pack; the renderer never injects fields beyond the hidden honeypot.
- Inline validation with `aria-invalid` + `aria-describedby`; Persian-digit normalisation via `toAsciiDigits`; values preserved on failure; disabled submit while pending; success/error announced via `aria-live`; retry control.
- Hidden honeypot; spam rate-limiting is deferred to Stage 3.
- CRM handoff, attribution and analytics are **not** implemented in this pass.

## 7. Failure states

| Condition | Behaviour |
|---|---|
| Unknown route | Themed 404, `noindex` |
| Missing binding | 404, no bundled copy |
| CMS unreachable | Cached content when available; else themed 503 with retry; health endpoint stays local |
| Site suspended/archived | Contract holding page, HTTP 200, `noindex` |
| Contract version mismatch | Loud developer-facing error page; no silent render |
| Empty collection block | Section omitted |
| Premium/featured content | No placeholder testimonials, logos, metrics, or prices |

## 8. Biza Miz content

- Theme code stays tenant-neutral; Biza Miz copy, page structures, nav links and form schema ship in `demo-packs/biza-miz/`.
- The content pack mirrors the issue's homepage rhythm: hero → dashboard showcase → benefits → feature/industry grid → pricing explanation → proof/FAQ → final CTA. Priority pages: restaurants/cafés, demo request, pricing, features.
- Product messaging follows the proven POS workflow **menu → table/order → payment/receipt → shift/sales report**; Accounting, CRM, Growth and Website capabilities are only described at their actual release readiness.
- The pack carries **no invented prices**. Pricing renders CMS `pricing` plans; when a plan is not sourced from the Biza Miz catalogue it must be marked illustrative in the content, never presented as a live licence fee.
- Account signup, activation, wallet and payment stay Biza Miz's; the theme links out to tenant-supplied destinations and implements no checkout, wallet or identity.
- An idempotent import script uses only capabilities a site key has (pages, posts, forms, header/footer). Media must be uploaded by an editor because a site key cannot create media.
- The fixture provider mirrors the content pack and serves generated mockups from `public/demo/`, visibly labelled illustrative. Production renders CMS media only.
- Demo form is the only lead path in this pass; Stage 3 owns the sales-process handoff.

## 9. Verification

- `pnpm verify` = typecheck → lint → vitest → production build.
- Unit (vitest): route/locale resolution, binding resolution, variant resolver, band rhythm, draft policy, cache tags, HMAC revalidation, form validation, token parity, manifest validation mirroring the CMS parser.
- Browser (Playwright, fixture CMS): five routes × three breakpoints × fa/en × light/dark; keyboard navigation; mobile menu; theme persistence; locale switch; form success/failure; reduced motion; axe; RTL overflow (`scrollWidth <= clientWidth`); visual snapshots.
- Manual/recorded: retry of the DesignMD live reference and a written deviation list in `DESIGN.md`.
- No claim of deployment, live CMS integration, or production performance until those are actually run.

## 10. Risks and open items

1. **Live DesignMD reference** returned HTTP 429 during design. Reconciliation is deferred to implementation; every deviation must be recorded, not assumed.
2. **AI-generated showcase imagery** conflicts with the issue's "authentic product demonstration visuals" and "no fabricated claims". Mitigation: fixture-only, labelled, no invented metrics; real screenshots can replace them via CMS media at any time.
3. **Unpublished runtime package**: vendored workspace package; parity tested against the CMS source.
4. **No live tenant in this pass**: content pack + fixtures replace a claimed deployment.
5. **Spam protection** is honeypot-only until Stage 3.
6. **Font licensing**: only OFL-licensed families; licenses committed with the binaries.

## 11. Acceptance mapping (Stage 1 + 2)

| Issue criterion | Covered by |
|---|---|
| `DESIGN.md` committed, attributed, original, agent guidance refers to it | DESIGN.md + AGENTS.md deliverables |
| Reusable components, responsive homepage, visual review at 3 widths | Component set, Playwright snapshots |
| RTL Persian first-class; English LTR; dark/light; reduced motion; keyboard | i18n/RTL + a11y sections and tests |
| CMS edits publish without theme changes; no cross-tenant exposure | Block/variant architecture, key-only server access, cache/tag tests |
| Demo CTA and form work end-to-end | CMS form + submission route, verified against fixtures and a tenant where credentials exist |
| Preview/health/release/rollback tested through Eshobe | `/api/health` implemented; preview→release→rollback **deferred to Stage 4** |
| No fabricated testimonials, metrics, prices, claims | Omit-empty policy, fixture labelling, no hardcoded content |

## 12. Implementation outline

1. **Foundation**: scaffold, manifest, vendored runtime, tokens, fonts, layout shell, nav/footer, theme switch, health/proxy/revalidate routes, fixtures, unit harness.
2. **Design contract**: write `DESIGN.md` + `AGENTS.md`; retry the live reference; record deviations.
3. **Sections**: primitives and all business-block sections with variant resolution.
4. **Routes**: home, restaurants, pricing, features, demo, generic CMS pages; metadata and locale switching.
5. **Forms and states**: CMS form island, error/empty/holding pages.
6. **Content pack**: Biza Miz page JSON, form schema, import script, generated mockups.
7. **Verification**: Playwright suite, axe, RTL overflow, snapshots; run `pnpm verify`.
