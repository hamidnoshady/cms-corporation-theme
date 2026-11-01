# Conformance audit — Apex against the Eshobe CMS Theme API

**Question:** is this theme actually built for the CMS API described in
[`hamidnoshady/eshobe-cms/docs/THEME_API.md`](https://github.com/hamidnoshady/eshobe-cms/blob/main/docs/THEME_API.md)?

**Answer: yes.** The theme targets deployed-theme contract **v1** end to end: it
bootstraps from `GET /api/site`, reads published content with the site key, renders
the business block set, resolves content bindings by stable id, verifies the v1
revalidation signature, serves the manifest's health path locally, and ships the
`proxiesApi` surface its manifest promises. Three deviations and four gaps are
listed below with what was fixed in this pass and what is deliberately left out.

| | |
|---|---|
| Spec | [`docs/THEME_API.md`](./THEME_API.md), synced from `eshobe-cms@0b7eb5a` (docs last changed 2026-10-27), `contractVersion = 1` |
| Manifest | validated with the CMS's own parser (`src/lib/deploy/manifest.ts`) — `ok: true`, `deployment.strategy = registry_image`, `build.buildPack = dockerfile`, no rejected fields |
| Runtime helpers | `vendor/site-runtime` is **byte-identical** to `packages/site-runtime/dist` at that commit (`index/format/money/theme/blocks/slug/locale/digits`) |
| Local evidence | `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ 45/45 · `pnpm build` ✅ · `pnpm test:e2e` ✅ 38/38 |

---

## 1. Conformance matrix

Legend: **✅** conformant · **◑** conformant in substance, documented deviation ·
**—** not applicable to this theme · **✗** gap (see §3).

| Spec section | What it requires | Apex | Where |
|---|---|---|---|
| §1 steps 1–10, 12–14 | App, runtime helpers, manifest, keyed CMS client, `/api/site` before paint, blocks, media, health, signed revalidate, Docker, GitHub, registration | ✅ | `src/lib/cms/*`, `src/app/api/health`, `src/app/api/revalidate`, `Dockerfile` |
| §1 step 11 | `proxiesApi: true` → CMS-owned `/api/*` answered on this origin | ✅ *(fixed)* | `src/lib/cms/proxy.ts` |
| §2 tenancy | Tenant from `Host` or site key; never `?site=` / body | ✅ | `src/lib/cms/client.ts` (Bearer only), `src/proxy.ts` (host allowlist) |
| §2 lifecycle | `suspended`/`archived` serve no content | ◑ 404 instead of a 200 holding page | `src/lib/cms/source.ts` `getSite()` |
| §2 Persian-first / money | Runtime formatters only, no raw `Intl`, no hardcoded unit | ✅ | `grep` finds no `toLocaleDateString`/`toFixed`/`تومان`; prices only via `formatPrice` (catalogue) and `formatNumber` + `plan.unit` (pricing block) |
| §3 base URL & auth | Keyed server reads against `ESHOBE_CMS_URL`, never rewriting `Host` | ✅ | `client.ts` sends `Authorization`; `origin.ts` additionally rejects a self-origin loop |
| §3 query language | Envelope, `locale`, `fallbackLocale=false`, `depth`, `where`, `sort`, pagination, `draft` only when authenticated | ✅ | `source.ts` (`published` const, `hasNextPage` paging), `hydrateBlock`, `getPageBySlug` |
| §4 `/api/site` | `contractVersion` enforced; `availableLocales`, `blocks`, `theme`, `branding`, `themeRuntime`, `media` consumed | ✅ | `source.ts`, `layout.tsx`, `Blocks.tsx` (`site.blocks` allowlist) |
| §4 caching | Cache the descriptor in memory, drop it on revalidation | ✅ | `StaleCache` 30 s TTL / 300 s stale, `invalidateCmsCache()` in `/api/revalidate` |
| §4 `media.origin` | Build media URLs from `media.origin` + `basePath` | ◑ relative `/api/media/file/*`, resolved through own proxy | `src/lib/cms/urls.ts` `mediaSrc` |
| §5 locale rules | Unserved locale → 404, not a silent fallback | ✅ | `loadSnapshot()` → `notFound()` |
| §6 collections | `pages`, `posts`, `media`, `forms`, `theme`, `header`/`footer` globals | ✅ | `/api/globals/header`, `/api/globals/footer`, `/api/forms/{id}`, `/api/media/{id}` |
| §6 `search` | Searchable posts index | ✗ no `/search` route | — |
| §6 `redirects` | Per-site redirects are the theme's to honour | ✗ unused | — |
| §6 `form-submissions` | Optional CMS-native form intake | — theme posts to its own hardened lead endpoint (`/api/leads`), documented in `docs/INTEGRATIONS.md` | `src/app/api/leads` |
| §7 ecommerce | Product grid, checkout, receipts | — manifest declares `siteTypes: ["business"]`, `capabilities.commerce: false` | `eshobe.theme.json` |
| §8 blocks | Every allowed block for the site type renders; unknown block warns and renders nothing | ✅ 13/13 business blocks (`productGrid` is store-only) | `src/components/blocks/Blocks.tsx` |
| §8 `mediaBlock.size/aspect` | Size the frame from presentation intent; missing = default | ✗ ignored (fixed `max-w-5xl`) | `Blocks.tsx` |
| §8 rich text | Per-node `dir` from `data.root.direction`, lexical block nodes | ✅ incl. `mediaBlock`/`mediaGrid` nodes | `RichText.tsx` |
| §9 theming | Emit tenant tokens as CSS, editor save = no rebuild | ◑ tokens via `--tenant-*` + `data-radius` instead of `themeCss()`; radius scale is the design system's px steps, not `0/.25rem/.625rem/1rem` | `layout.tsx`, `globals.css` |
| §9 logical utilities | No `ml-*`/`pl-*`/`text-left` | ✅ none in `src/` | `grep` |
| §10 i18n | `formatDate`, `formatNumber`, `formatPrice`, `toLocaleDigits`; Persian-safe slugs | ✅ | throughout |
| §11 routing | Default locale unprefixed (+ strip), other locales prefixed, canonical by binding id, redirect bound pages to their section route | ✅ | `src/proxy.ts`, `src/lib/cms/urls.ts` `pagePath`, `[[...path]]/page.tsx` |
| §11 reserved routes | `/posts`, `/posts/<slug>`, `/search`, `/checkout/<id>`, `/products/<slug>` | ◑ `/posts/<slug>` ✅, others ✗/— | `page.tsx` |
| §12 media | Private bucket streamed through the CMS, `sizes` for grids | ✅ streaming proxy; ◑ full-size images (`sizes` unused, `unoptimized`) | `proxy.ts`, `MediaFigure.tsx` |
| §13 SEO | Canonical, hreflang + `x-default`, sitemap with alternates, robots, JSON-LD, noindex on preview | ✅ | `src/lib/seo.ts`, `sitemap.ts`, `robots.ts` |
| §13 OG image | Per-site `/og?slug=` | ◑ uses `branding.socialImage`; the CMS `/og` route is not reachable on a `direct` customer domain | `seo.ts` |
| §14 security | No draft leakage, no tenant override, fail closed, key never logged | ✅ drafts filtered client-side as the spec asks; `jsonError`/diagnostics log rule codes only | `source.ts`, `diagnostics.ts` |
| §15/§16 checklist | Router, blocks, theme, formatting, media, SEO, revalidation | ✅ items 1–8 and 10 (item 9 checkout n/a) | — |
| §17 revalidation | HMAC-SHA256 over **raw body only**, timestamp unsigned, answer fast, 2xx | ✅ + `siteId` mismatch → `200 {purged:false}` | `src/app/api/revalidate/route.ts`, `security/signatures.ts` |
| §17b manifest | Fields, allowlists, `settings`, `contentSlots`, `env`, `build`, `deployment` | ✅ parses clean; 17 settings, 8 slots, 11 tenant env vars, no protected key claimed as tenant | `eshobe.theme.json` |
| §17b preview | `/next/preview?path=&previewSecret=&token=` honours the editor handoff | ✅ superset: secret **and** CMS-verified editor membership, short-lived HMAC cookie | `src/app/next/preview/route.ts`, `security/preview.ts` |
| §17b performance | Cached descriptor, timer expiry, stale on outage, cheap local health, 200 promotion probe, immutable image | ✅ | `cache.ts`, `health/route.ts`, `Dockerfile` (`HOSTNAME=0.0.0.0`, loopback health check) |

---

## 2. Deviations that are deliberate

1. **Descriptor shape.** `GET /api/site` on the theme origin answers the theme's own
   filtered descriptor (`contractVersion`, locales, blocks, theme, branding,
   `themeRuntime`, store) instead of piping the CMS body. It keeps `id` and
   `domainVerified` out of the browser; the app's own server code reads the CMS
   directly. Same contract, narrower surface.
2. **Theme tokens.** `themeCss()` is not used; the theme maps validated hex values to
   `--tenant-*` and lets `globals.css` rebind `--primary/--accent/--background/
   --foreground`. Equivalent behaviour (hex validation, WCAG foreground, clamped
   line-height, radius switch), because the Apex design system owns the palette.
3. **Writes stay local.** `/api/leads`, `/api/events`, `/api/conversions` are the
   theme's own hardened endpoints; no CMS write is proxied, so the public proxy is
   read-only by construction.

---

## 3. Gaps and what changed

**Fixed in this pass**

| Gap | Change |
|---|---|
| `proxiesApi: true` promised CMS-owned `/api/*` but only `/api/media/file/*` was proxied — in `direct` mode (`docs/theme-deployments.md` §4) every other CMS path 404'd on the customer domain | `src/lib/cms/proxy.ts` now proxies the documented public reads: `/api/pages[/id]`, `/api/posts[/id]`, `/api/products[/id]`, `/api/media[/id]`, `/api/search`, `/api/forms/id`, `/api/globals/header|footer`, `/api/payments/methods` — reads only, no cookies, `draft`/`overrideAccess`/`site` stripped, `_status=published` forced on draft-enabled collections. 8 new tests (`tests/proxy.test.ts`) and the e2e CMS spec updated |
| Manifest predates the spec's `settings.<key>.group` field (added 2026-10-27), so colour-mode and locale-switcher controls would sit on the general settings page | `defaultTheme` and `showFooterLocaleSwitcher` declare `group: "design"` |
| Vendored spec copy was one row behind upstream | `docs/THEME_API.md` re-synced to `eshobe-cms@0b7eb5a` |

**Open, recommended next (not changed here — feature work, not conformance bugs)**

| Priority | Gap | Why it matters |
|---|---|---|
| High | No `/posts` index or `/search` route (`resolveSiteRoute` kinds `posts`/`search`) | The spec's router checklist expects both; today a published post is reachable only by URL and the `archive` block is the only listing |
| Medium | `redirects` collection is ignored | Renamed pages lose their old URL on a themed `direct` deployment unless the CMS still sits in front |
| Medium | `mediaBlock.size`/`aspect` ignored; `sizes.*` unused | A portrait photo is rendered in a wide fixed frame at full resolution; the spec asks renderers to honour the frame intent and prefer `sizes.medium` for grids |
| Low | Suspended/archived sites answer 404 instead of a 200 `noindex` holding page | Matches §2 more literally, and it is what the built-in renderer does |
| Low | `depth=2` on every slot page | Correct output; `depth=1` plus a second fetch for the deepest relation is cheaper on list-shaped pages |

---

## 4. Re-verifying

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # 45 unit tests
pnpm test:e2e                                            # 38 browser/contract tests
```

Manifest check, using the CMS's own parser (no Payload import needed):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/hamidnoshady/eshobe-cms.git
cd eshobe && git sparse-checkout set src packages
node -e "…parseThemeManifestText(readFileSync('…/eshobe.theme.json','utf8'), 1)"
```
