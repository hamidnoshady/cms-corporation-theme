# Eshobe Corporation Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Stage 1 + Stage 2 Eshobe Corporation theme — an RTL-first, CMS-native corporate/SaaS theme rendered from Eshobe's block vocabulary, demonstrated with Biza Miz fixtures.

**Architecture:** Standalone Next 16 App Router application with a vendored `@eshobe/site-runtime`, a centralized CMS client (site-key tenancy, draft policy, cache tags), one locale-aware route resolver feeding a single `[[...path]]` page, and a pure block→section planner that assigns theme-owned variants without inventing block types.

**Tech Stack:** Next 16.3.8, React 19.3.0, TypeScript 5.9.3, Tailwind CSS 4.3.3, pnpm 11.2.2, Vitest 5.0.3, Playwright 1.63.0, Radix Accordion/Dialog/Slot, CVA, Vazirmatn + Inter + JetBrains Mono (all OFL, self-hosted).

**Spec:** `docs/superpowers/specs/2026-10-24-eshobe-corporation-theme-design.md`

## Global Constraints

- **Theme identity**: `key: "eshobe-corporation"`, `name: "Eshobe Corporation"`, `nameFa: "پوستهٔ شرکتی اشوبه"`. Do not rename.
- **Scope**: Stage 1 + Stage 2 only. Do not implement Stage 3 (live lead handoff, CRM, funnel analytics, live price sourcing, wallet/signup) or Stage 4 (sitemap/robots automation, visual baselines in CI, GHCR workflow, preview→release→rollback).
- **No fabricated content**: never hardcode testimonials, customer logos, success metrics, prices, licence fees, or product capabilities in theme code. Only CMS blocks may render those, and empty collections are omitted.
- **No tenant leakage**: every CMS read uses `ESHOBE_CMS_URL` + `Authorization: Bearer $ESHOBE_API_KEY`. Never rewrite `Host` to select a tenant. Never send the site key, draft content, or CMS session cookies to the browser.
- **Drafts**: public rendering always sends `draft=false` + `where[_status][equals]=published` for pages/posts/products. Globals, categories and search read with `publishFilter:false`. Preview requires Next `draftMode()` **and** a non-canonical host, then `no-store`, `draft=true`, `noindex`.
- **RTL-first**: logical utilities only (`ms/me/ps/pe/start/end/text-start`); `ml/mr/pl/pr/text-left/text-right/left-*/right-*` fail lint. Persian never gets negative letter-spacing. All dates/numbers/prices go through `@eshobe/site-runtime`.
- **No copied Vercel assets**: no Vercel marks, screenshots, proprietary graphics, font binaries, or page copy. The DesignMD page is a design reference only; its live content may be re-fetched during implementation (Task 3).
- **Visual constraints**: CMS `radius` maps to `0 / 4 / 10 / 16px` for cards and controls; pill marketing CTAs ignore it. CMS `lineHeight` is clamped to 1.4–2.4. No arbitrary hardcoded brand colors in components.
- **Licensing**: only OFL fonts, with LICENSE + PROVENANCE files committed next to the binaries. Demo mockups are AI-generated, fixture-only, and visibly labelled illustrative.
- **Verification**: every task runs `pnpm typecheck && pnpm test`; final gate is `pnpm verify` (typecheck → lint → vitest → production build).
- **Known App Router limit**: a page cannot set HTTP 503. The CMS-outage surface renders from the error boundary with `noindex`; exact 503 requires platform support and is documented in `README.md`, not faked.

---

## File Structure

```text
cms-corporation-theme/
├── eshobe.theme.json               manifest validated by the CMS parser
├── DESIGN.md                       design contract + deviations
├── AGENTS.md                       agent rules (read DESIGN.md + Theme API first)
├── README.md                       setup, env, fixture mode, limitations
├── Dockerfile
├── next.config.ts / tsconfig.json / eslint.config.mjs / vitest.config.ts
├── pnpm-workspace.yaml
├── demo-packs/biza-miz/            CMS-importable page/form JSON + import script
├── packages/site-runtime/          vendored @eshobe/site-runtime (MIT)
├── public/
│   ├── demo/                       AI-generated fixtures, labelled illustrative
│   └── fonts/                      woff2 + LICENSE + PROVENANCE
├── src/
│   ├── app/
│   │   ├── layout.tsx              html lang/dir, theme CSS, fonts, no-flash script
│   │   ├── page.tsx                not used (delete after catch-all exists)
│   │   ├── [[...path]]/page.tsx    single locale-aware page
│   │   ├── error.tsx / not-found.tsx / loading.tsx
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── revalidate/route.ts
│   │       ├── [...segments]/route.ts   allowlisted CMS proxy
│   │       ├── form-submissions/route.ts
│   │       ├── preview/route.ts
│   │       └── exit-preview/route.ts
│   ├── blocks/                     normalize.ts, plan.ts, section-registry.ts
│   ├── cms/                        types, env, client, fixture, site, queries, verify, tags, preview
│   ├── components/                 nav, footer, theme-toggle, locale-switch, ui primitives
│   ├── lib/                        i18n, routing, seo, media, fonts, settings
│   ├── sections/                   one component per block variant
│   └── styles/                     globals.css, fonts.css, tokens.ts
├── middleware.ts                   locale hint header for the root layout
├── tests/{unit,browser,fixtures}
└── tools/eslint-plugin-direction/
```

---

### Task 1: Scaffold, manifest, and health endpoint

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `postcss.config.mjs`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`
- Create: `eshobe.theme.json`, `.gitignore`, `Dockerfile`
- Create: `tools/eslint-plugin-direction/index.mjs`
- Create: `src/app/layout.tsx`, `src/app/[[...path]]/page.tsx`, `src/app/api/health/route.ts`
- Test: `tests/unit/manifest.test.ts`, `tests/unit/health.test.ts`

**Interfaces:**
- Produces: `healthPayload(env: NodeJS.ProcessEnv): { ok: true; theme: string; contractVersion: 1; cms: boolean; uptime: number }`
- Produces: a buildable Next app and a CMS-valid manifest that Tasks 2–17 extend.

- [ ] **Step 1: Create the workspace and toolchain files**

`package.json`:

```json
{
  "name": "eshobe-corporation-theme",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.2.2",
  "engines": { "node": ">=20.9.0" },
  "scripts": {
    "dev": "next dev",
    "dev:fixture": "ESHOBE_FIXTURE=1 next dev --port 3100",
    "dev:test": "ESHOBE_FIXTURE=1 next dev --port 3210",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:browser": "playwright test",
    "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm build"
  },
  "dependencies": {
    "@fontsource-variable/jetbrains-mono": "^5.3.0",
    "@radix-ui/react-accordion": "^1.2.13",
    "@radix-ui/react-dialog": "^1.1.23",
    "@radix-ui/react-slot": "^1.2.4",
    "@eshobe/site-runtime": "workspace:*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.50.0",
    "next": "16.3.8",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "server-only": "^0.0.1",
    "tailwind-merge": "^3.7.0"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.10.2",
    "@playwright/test": "^1.63.0",
    "@tailwindcss/postcss": "^4.3.3",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.4",
    "eslint": "^9.39.1",
    "eslint-config-next": "16.3.8",
    "tailwindcss": "^4.3.3",
    "typescript": "5.9.3",
    "vitest": "^5.0.3"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
```

`postcss.config.mjs`:

```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // The container serves one tenant per Host; an intermediary cache must never
          // reuse HTML across Hosts.
          { key: 'Vary', value: 'Host' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "types": ["node"],
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@eshobe/site-runtime": ["./packages/site-runtime/src/index.ts"],
      "@eshobe/site-runtime/*": ["./packages/site-runtime/src/*.ts"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules", ".next", "tests/browser"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    globals: true,
    restoreMocks: true,
    setupFiles: [r('./tests/setup.ts')],
  },
  resolve: {
    alias: [
      { find: '@', replacement: r('./src') },
      { find: /^@eshobe\/site-runtime$/, replacement: r('./packages/site-runtime/src/index.ts') },
      { find: /^@eshobe\/site-runtime\/(.+)$/, replacement: r('./packages/site-runtime/src/$1.ts') },
      { find: /^server-only$/, replacement: r('./tests/stubs/server-only.ts') },
    ],
  },
})
```

`.gitignore`:

```gitignore
node_modules
.next
out
.env
.env.local
test-results
playwright-report
next-env.d.ts
*.tsbuildinfo
.DS_Store
```

`src/app/layout.tsx` (minimum shell; Task 8 replaces it):

```tsx
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
```

`src/app/[[...path]]/page.tsx` (placeholder; Task 14 replaces it):

```tsx
export default function Page() {
  return <main>eshobe-corporation</main>
}
```

`Dockerfile`:

```dockerfile
# Eshobe Corporation — standalone theme image. All ESHOBE_* values are injected by the platform;
# no credential is copied into a layer.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/site-runtime/package.json ./packages/site-runtime/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/site-runtime/node_modules ./packages/site-runtime/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
```

`tools/eslint-plugin-direction/index.mjs`:

```js
const RULES = [
  { pattern: /(^|\s)ml-/, hint: 'use ms-* (margin-inline-start)' },
  { pattern: /(^|\s)mr-/, hint: 'use me-* (margin-inline-end)' },
  { pattern: /(^|\s)pl-/, hint: 'use ps-* (padding-inline-start)' },
  { pattern: /(^|\s)pr-/, hint: 'use pe-* (padding-inline-end)' },
  { pattern: /(^|\s)text-left(\s|$)/, hint: 'use text-start' },
  { pattern: /(^|\s)text-right(\s|$)/, hint: 'use text-end' },
  { pattern: /(^|\s)float-left(\s|$)/, hint: 'use float-start' },
  { pattern: /(^|\s)float-right(\s|$)/, hint: 'use float-end' },
  { pattern: /(^|\s)left-/, hint: 'use start-* / inset-inline-start' },
  { pattern: /(^|\s)right-/, hint: 'use end-* / inset-inline-end' },
  { pattern: /(^|\s)border-l(\s|$|-\[|-)/, hint: 'use border-s' },
  { pattern: /(^|\s)border-r(\s|$|-\[|-)/, hint: 'use border-e' },
]

export default {
  meta: { name: 'eslint-plugin-direction', version: '0.1.0' },
  rules: {
    'logical-properties': {
      meta: {
        type: 'problem',
        docs: { description: 'RTL-first: ban physical direction utilities' },
        schema: [],
        messages: { forbidden: 'Physical direction utility in "{{value}}" — {{hint}}' },
      },
      create(context) {
        const check = (node, value) => {
          for (const rule of RULES) {
            if (rule.pattern.test(value)) {
              context.report({ node, messageId: 'forbidden', data: { value, hint: rule.hint } })
              return
            }
          }
        }
        return {
          Literal(node) {
            if (typeof node.value === 'string') check(node, node.value)
          },
          TemplateLiteral(node) {
            for (const quasi of node.quasis) check(node, quasi.value.raw)
          },
        }
      },
    },
  },
}
```

`eslint.config.mjs`:

```js
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import direction from './tools/eslint-plugin-direction/index.mjs'

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'tools/**',
      'tests/browser/**',
      'test-results/**',
      'playwright-report/**',
      'packages/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { direction },
    rules: {
      // SVG customer marks and fixture media are rendered as <img> on purpose.
      '@next/next/no-img-element': 'off',
      'direction/logical-properties': 'error',
    },
  },
]
```

- [ ] **Step 2: Write the manifest test (failing first)**

`tests/unit/manifest.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'eshobe.theme.json'), 'utf8')) as Record<string, any>

describe('theme manifest', () => {
  it('declares the approved identity and contract', () => {
    expect(manifest.contractVersion).toBe(1)
    expect(manifest.key).toBe('eshobe-corporation')
    expect(manifest.name).toBe('Eshobe Corporation')
    expect(manifest.nameFa).toBe('پوستهٔ شرکتی اشوبه')
    expect(manifest.locales).toEqual(['fa', 'en'])
    expect(manifest.siteTypes).toEqual(['business'])
  })

  it('declares only capabilities the theme implements', () => {
    expect(manifest.capabilities).toEqual({
      rtlFirst: true,
      multiLocale: true,
      pageBuilderBlocks: true,
      forms: true,
    })
    expect(manifest.proxiesApi).toBe(true)
  })

  it('builds with the platform health check and no deployment block', () => {
    expect(manifest.build).toMatchObject({
      buildPack: 'dockerfile',
      dockerfileLocation: 'Dockerfile',
      port: 3000,
      healthCheckPath: '/api/health',
      isStatic: false,
    })
    expect(manifest.deployment).toBeUndefined()
    expect(manifest.env).toEqual([])
  })

  it('uses the approved design defaults', () => {
    expect(manifest.design).toEqual({
      primary: '#171717',
      accent: '#0070f3',
      background: '#fafafa',
      foreground: '#171717',
      radius: 'md',
      lineHeight: 1.8,
    })
  })

  it('declares the closed settings schema and content slots', () => {
    expect(Object.keys(manifest.settings).sort()).toEqual([
      'demoSlug',
      'featureTreatment',
      'featuresSlug',
      'heroTreatment',
      'logosMonochrome',
      'pricingSlug',
      'restaurantsSlug',
      'showcaseTreatment',
    ])
    expect(manifest.settings.heroTreatment.default).toBe('mesh')
    expect(manifest.settings.featureTreatment.default).toBe('cards')
    expect(manifest.settings.showcaseTreatment.default).toBe('mockup')
    expect(manifest.settings.logosMonochrome.default).toBe(true)
    expect(manifest.contentSlots.map((slot: { key: string }) => slot.key)).toEqual([
      'home',
      'restaurants',
      'pricing',
      'features',
      'demo',
    ])
    expect(manifest.contentSlots.filter((slot: { required: boolean }) => slot.required).map((slot: { key: string }) => slot.key)).toEqual(['home'])
  })
})
```

- [ ] **Step 3: Run the manifest test and confirm it fails**

Run: `pnpm install && pnpm vitest run tests/unit/manifest.test.ts`
Expected: FAIL with `ENOENT ... eshobe.theme.json`.

- [ ] **Step 4: Create `eshobe.theme.json`**

```json
{
  "contractVersion": 1,
  "key": "eshobe-corporation",
  "name": "Eshobe Corporation",
  "nameFa": "پوستهٔ شرکتی اشوبه",
  "siteTypes": ["business"],
  "locales": ["fa", "en"],
  "proxiesApi": true,
  "capabilities": {
    "rtlFirst": true,
    "multiLocale": true,
    "pageBuilderBlocks": true,
    "forms": true
  },
  "design": {
    "primary": "#171717",
    "accent": "#0070f3",
    "background": "#fafafa",
    "foreground": "#171717",
    "radius": "md",
    "lineHeight": 1.8
  },
  "build": {
    "buildPack": "dockerfile",
    "baseDirectory": "/",
    "dockerfileLocation": "Dockerfile",
    "installCommand": null,
    "buildCommand": null,
    "startCommand": null,
    "publishDirectory": null,
    "port": 3000,
    "healthCheckPath": "/api/health",
    "isStatic": false
  },
  "env": [],
  "settings": {
    "heroTreatment": {
      "type": "select",
      "default": "mesh",
      "labelFa": "پرداخت هیرو",
      "labelEn": "Hero treatment",
      "options": [
        { "value": "mesh", "labelFa": "گرادیان مش", "labelEn": "Mesh gradient" },
        { "value": "plain", "labelFa": "ساده", "labelEn": "Plain" }
      ]
    },
    "featureTreatment": {
      "type": "select",
      "default": "cards",
      "labelFa": "چیدمان ویژگی‌ها",
      "labelEn": "Feature treatment",
      "options": [
        { "value": "cards", "labelFa": "کارت‌ها", "labelEn": "Cards" },
        { "value": "sticky", "labelFa": "بخش چسبان", "labelEn": "Sticky stack" }
      ]
    },
    "showcaseTreatment": {
      "type": "select",
      "default": "mockup",
      "labelFa": "نمایش تصویر محصول",
      "labelEn": "Showcase treatment",
      "options": [
        { "value": "mockup", "labelFa": "قاب مرورگر", "labelEn": "Mockup chrome" },
        { "value": "editorial", "labelFa": "تصویر تحریریه", "labelEn": "Editorial figure" }
      ]
    },
    "logosMonochrome": {
      "type": "boolean",
      "default": true,
      "labelFa": "نشان‌ها سیاه‌وسفید",
      "labelEn": "Monochrome logos"
    },
    "restaurantsSlug": {
      "type": "text",
      "default": "restaurants",
      "labelFa": "اسلاگ صفحهٔ رستوران‌ها",
      "labelEn": "Restaurants page slug"
    },
    "pricingSlug": {
      "type": "text",
      "default": "pricing",
      "labelFa": "اسلاگ صفحهٔ تعرفه",
      "labelEn": "Pricing page slug"
    },
    "featuresSlug": {
      "type": "text",
      "default": "features",
      "labelFa": "اسلاگ صفحهٔ ویژگی‌ها",
      "labelEn": "Features page slug"
    },
    "demoSlug": {
      "type": "text",
      "default": "demo",
      "labelFa": "اسلاگ صفحهٔ درخواست دمو",
      "labelEn": "Demo page slug"
    }
  },
  "contentSlots": [
    {
      "key": "home",
      "type": "page",
      "required": true,
      "labelFa": "صفحهٔ اصلی",
      "labelEn": "Home page"
    },
    {
      "key": "restaurants",
      "type": "page",
      "required": false,
      "labelFa": "صفحهٔ رستوران‌ها و کافه‌ها",
      "labelEn": "Restaurants page"
    },
    {
      "key": "pricing",
      "type": "page",
      "required": false,
      "labelFa": "صفحهٔ تعرفه",
      "labelEn": "Pricing page"
    },
    {
      "key": "features",
      "type": "page",
      "required": false,
      "labelFa": "صفحهٔ ویژگی‌ها",
      "labelEn": "Features page"
    },
    {
      "key": "demo",
      "type": "page",
      "required": false,
      "labelFa": "صفحهٔ درخواست دمو",
      "labelEn": "Demo page"
    }
  ]
}
```

- [ ] **Step 5: Create the health route and its test**

`src/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server'

export type HealthPayload = {
  ok: true
  theme: string
  contractVersion: 1
  cms: boolean
  uptime: number
}

/** Local liveness only: a CMS outage must not make the platform kill a healthy container. */
export function healthPayload(env: NodeJS.ProcessEnv = process.env): HealthPayload {
  return {
    ok: true,
    theme: 'eshobe-corporation',
    contractVersion: 1,
    cms: typeof env.ESHOBE_CMS_URL === 'string' && env.ESHOBE_CMS_URL.trim() !== '',
    uptime: Math.round(process.uptime()),
  }
}

export function GET(): Response {
  return NextResponse.json(healthPayload(), { headers: { 'cache-control': 'no-store' } })
}
```

`tests/unit/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { healthPayload } from '@/app/api/health/route'

describe('health payload', () => {
  it('reports the theme contract and never fails because the CMS is unreachable', () => {
    expect(healthPayload({})).toMatchObject({
      ok: true,
      theme: 'eshobe-corporation',
      contractVersion: 1,
      cms: false,
    })
  })

  it('reports cms configuration without exposing the value', () => {
    const payload = healthPayload({ ESHOBE_CMS_URL: 'https://cms.example.test' })
    expect(payload.cms).toBe(true)
    expect(JSON.stringify(payload)).not.toContain('cms.example.test')
  })
})
```

`tests/setup.ts`:

```ts
export {}
```

`tests/stubs/server-only.ts`:

```ts
export {}
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm vitest run tests/unit/manifest.test.ts tests/unit/health.test.ts && pnpm typecheck`
Expected: PASS. (`next-env.d.ts` is generated by the first `next build`/`dev`; if typecheck complains, run `pnpm build` once.)

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml postcss.config.mjs next.config.ts tsconfig.json eslint.config.mjs vitest.config.ts .gitignore Dockerfile eshobe.theme.json tools src tests
git commit -m "chore: scaffold theme with manifest and local health endpoint"
```

---

### Task 2: Vendor `@eshobe/site-runtime`

**Files:**
- Create: `packages/site-runtime/package.json`
- Create: `packages/site-runtime/src/{index,blocks,digits,format,money,slug,locale,theme,site}.ts`
- Modify: `packages/site-runtime/src/locale.ts`, `packages/site-runtime/src/slug.ts`, `packages/site-runtime/src/index.ts`
- Test: `tests/unit/runtime.test.ts`

**Interfaces:**
- Produces: `localeCodes: readonly ['fa','en']`, `type Locale`, `defaultLocale`, `isLocale(value): value is Locale`, `dirFor(locale)`, `localeHref(path, locale, siteDefault)`.
- Produces: `slugify`, `HOME_SLUG`, `pagePath`, `postPath`, `productPath`, `RESERVED_PAGE_SLUGS`.
- Produces: `resolveSiteRoute(path: string[]): SiteRoute`.
- Produces: `siteOrigin(origin: string, path: string): string`.
- Produces: `themeCss`, `isHexColor`, `formatDate`, `formatNumber`, `formatPrice`, `toAsciiDigits`, `toLocaleDigits`, `blockKey`, `partitionBlocks`, `reportBlockDiagnostics`, `contractVersion`.

- [ ] **Step 1: Copy the proven package from the restaurant theme**

Run from the repo root:

```bash
mkdir -p packages/site-runtime/src
cp D:/Development/cms-resturant-theme/packages/site-runtime/package.json packages/site-runtime/package.json
cp D:/Development/cms-resturant-theme/packages/site-runtime/src/*.ts packages/site-runtime/src/
cp D:/Development/cms-resturant-theme/packages/site-runtime/README.md packages/site-runtime/README.md 2>/dev/null || true
```

The copy provides `blocks.ts`, `digits.ts`, `format.ts`, `index.ts`, `locale.ts`, `money.ts`, `slug.ts`, `theme.ts`. Do not modify `format.ts`, `money.ts`, `digits.ts`, `theme.ts`, or `blocks.ts` in this task — they are the parity-tested implementations from the platform's own renderer.

- [ ] **Step 2: Write the runtime tests (failing first)**

`tests/unit/runtime.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  HOME_SLUG,
  defaultLocale,
  dirFor,
  formatDate,
  formatNumber,
  isLocale,
  localeCodes,
  localeHref,
  resolveSiteRoute,
  siteOrigin,
  slugify,
  themeCss,
} from '@eshobe/site-runtime'

describe('locale helpers', () => {
  it('supports exactly the manifest locales', () => {
    expect(localeCodes).toEqual(['fa', 'en'])
    expect(defaultLocale).toBe('fa')
    expect(isLocale('fa')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(dirFor('fa')).toBe('rtl')
    expect(dirFor('en')).toBe('ltr')
  })

  it('prefixes only non-default locales', () => {
    expect(localeHref('/', 'fa', 'fa')).toBe('/')
    expect(localeHref('/', 'en', 'fa')).toBe('/en')
    expect(localeHref('/pricing', 'en', 'fa')).toBe('/en/pricing')
    expect(localeHref('/pricing', 'fa', 'fa')).toBe('/pricing')
  })
})

describe('site route resolution', () => {
  it('treats the empty path as the home page', () => {
    expect(resolveSiteRoute([])).toEqual({ kind: 'page', slug: HOME_SLUG })
    expect(resolveSiteRoute(['en'])).toEqual({ kind: 'page', slug: HOME_SLUG })
  })

  it('strips the locale and resolves reserved routes', () => {
    expect(resolveSiteRoute(['en', 'restaurants'])).toEqual({ kind: 'page', slug: 'restaurants' })
    expect(resolveSiteRoute(['en', 'posts', 'hello'])).toEqual({ kind: 'post', slug: 'hello' })
    expect(resolveSiteRoute(['posts'])).toEqual({ kind: 'posts' })
    expect(resolveSiteRoute(['search'])).toEqual({ kind: 'search' })
    expect(resolveSiteRoute(['checkout', 'order-1'])).toEqual({ kind: 'checkout', order: 'order-1' })
    expect(resolveSiteRoute(['products', 'chair'])).toEqual({ kind: 'product', slug: 'chair' })
  })

  it('joins nested slugs for CMS page lookup', () => {
    expect(resolveSiteRoute(['en', 'legal', 'terms'])).toEqual({ kind: 'page', slug: 'legal/terms' })
  })
})

describe('Persian slugs and formatting', () => {
  it('slugifies Persian instead of stripping it', () => {
    expect(slugify('دربارهٔ ما')).toBe('دربارهٔ-ما')
    expect(slugify('  کافه  بیزا  ')).toBe('کافه-بیزا')
  })

  it('formats Persian dates and numbers in Persian digits', () => {
    expect(formatNumber(1200, 'fa')).toMatch(/[۰-۹]/)
    expect(formatDate('2026-03-21T12:00:00Z', 'fa')).toContain('۱۴۰۵')
  })

  it('rejects hostile theme tokens and keeps valid ones', () => {
    expect(themeCss({ primary: 'red;}body{display:none' })).not.toContain('display')
    expect(themeCss({ primary: '#171717', radius: 'md', lineHeight: 1.8 })).toContain('--primary:#171717')
  })
})

describe('siteOrigin', () => {
  it('joins paths without dropping a base path', () => {
    expect(siteOrigin('https://cms.example.test', '/media/a.jpg')).toBe('https://cms.example.test/media/a.jpg')
    expect(siteOrigin('https://cms.example.test/base', '/media/a.jpg')).toBe('https://cms.example.test/base/media/a.jpg')
  })
})
```

- [ ] **Step 3: Run the test and confirm the additions are missing**

Run: `pnpm vitest run tests/unit/runtime.test.ts`
Expected: FAIL — `localeCodes`, `resolveSiteRoute`, `siteOrigin` are not exported.

- [ ] **Step 4: Extend `locale.ts`**

Replace `packages/site-runtime/src/locale.ts` with:

```ts
export const localeCodes = ['fa', 'en'] as const
export type Locale = (typeof localeCodes)[number]
export const defaultLocale: Locale = 'fa'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (localeCodes as readonly string[]).includes(value)

/** Direction and URL helpers shared by built-in and external renderers. */
export const dirFor = (locale: string): 'ltr' | 'rtl' => (locale === 'fa' ? 'rtl' : 'ltr')

/** Prefix an internal path when the active locale is not the site's default locale. */
export const localeHref = (path: string, locale: string, siteDefault: string): string =>
  path.startsWith('/') && locale !== siteDefault ? `/${locale}${path === '/' ? '' : path}` : path
```

- [ ] **Step 5: Append `resolveSiteRoute` to `slug.ts`**

Add the import at the top and the resolver at the bottom:

```ts
import { isLocale } from './locale'

export type SiteRoute =
  | { kind: 'checkout'; order: null | string }
  | { kind: 'page'; slug: string }
  | { kind: 'post'; slug: string }
  | { kind: 'posts' }
  | { kind: 'product'; slug: string }
  | { kind: 'search' }

/**
 * What a URL under a domain is, after stripping an optional locale.
 * The theme applies its own route table first; this keeps the platform's reserved
 * segments (posts/search/products/checkout) from being mistaken for CMS pages.
 */
export const resolveSiteRoute = (path: string[] = []): SiteRoute => {
  const segments = (isLocale(path[0]) ? path.slice(1) : path).map((segment) =>
    decodeURIComponent(segment),
  )
  const [first, second] = segments

  if (!first) return { kind: 'page', slug: HOME_SLUG }
  if (first === POSTS_SEGMENT) return second ? { kind: 'post', slug: second } : { kind: 'posts' }
  if (first === SEARCH_SEGMENT && segments.length === 1) return { kind: 'search' }
  if (first === PRODUCTS_SEGMENT) {
    return second ? { kind: 'product', slug: second } : { kind: 'page', slug: 'products' }
  }
  if (first === CHECKOUT_SEGMENT && segments.length <= 2) {
    return { kind: 'checkout', order: second ?? null }
  }
  return { kind: 'page', slug: segments.join('/') }
}
```

- [ ] **Step 6: Create `site.ts` and export the new modules**

`packages/site-runtime/src/site.ts`:

```ts
/**
 * Absolute URL under a site origin. A CMS that reports a path prefix (a shared
 * media origin) keeps it: `new URL('/x', base)` would silently drop `/base`.
 */
export const siteOrigin = (origin: string, path: string): string => {
  const base = origin.endsWith('/') ? origin : `${origin}/`
  return new URL(path.replace(/^\/+/, ''), base).toString()
}
```

Update `packages/site-runtime/src/index.ts`:

```ts
export * from './digits'
export * from './money'
export * from './format'
export * from './theme'
export * from './blocks'
export * from './slug'
export * from './locale'
export * from './site'

export const contractVersion = 1 as const
```

Update `packages/site-runtime/package.json` exports:

```json
{
  "name": "@eshobe/site-runtime",
  "version": "0.1.0",
  "description": "Vendored Eshobe site runtime — Persian-first format, money, theme, routing and slug helpers (MIT)",
  "type": "module",
  "license": "MIT",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./format": "./src/format.ts",
    "./money": "./src/money.ts",
    "./theme": "./src/theme.ts",
    "./blocks": "./src/blocks.ts",
    "./slug": "./src/slug.ts",
    "./locale": "./src/locale.ts",
    "./site": "./src/site.ts"
  }
}
```

- [ ] **Step 7: Run the runtime tests and typecheck**

Run: `pnpm install && pnpm vitest run tests/unit/runtime.test.ts && pnpm typecheck`
Expected: PASS. If `siteOrigin('https://cms.example.test/base', '/media/a.jpg')` fails, the slash handling is wrong — fix `site.ts`, not the test.

- [ ] **Step 8: Commit**

```bash
git add packages tests/unit/runtime.test.ts pnpm-lock.yaml
git commit -m "feat: vendor site runtime with locale, reserved-route and origin helpers"
```

---

### Task 3: `DESIGN.md` and `AGENTS.md`

**Files:**
- Create: `DESIGN.md`
- Create: `AGENTS.md`
- Test: `tests/unit/design-docs.test.ts`

**Interfaces:**
- Produces: the design contract every later UI task cites. No runtime exports.

- [ ] **Step 1: Retry the live DesignMD reference**

Run:

```bash
curl -sSL --max-time 25 -o /tmp/designmd-vercel.html -w "%{http_code}\n" https://www.designmd.co/d/vercel
```

- `200`: record the fetched date and the concrete differences you find in `DESIGN.md` under **Reference reconciliation**.
- `429`/timeout/other: record the status and date, and state that the checked-in snapshot (attached during design) is the reference of record. Do not claim a live reconciliation that did not happen.

- [ ] **Step 2: Write the docs test (failing first)**

`tests/unit/design-docs.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('design contract', () => {
  const design = read('DESIGN.md')

  it('is machine-readable and attributed', () => {
    expect(design.startsWith('---\n')).toBe(true)
    expect(design).toContain('https://www.designmd.co/d/vercel')
    expect(design).toContain('colors:')
    expect(design).toContain('typography:')
    expect(design).toContain('rounded:')
    expect(design).toContain('spacing:')
    expect(design).toContain('components:')
  })

  it('documents the required human sections', () => {
    for (const heading of ['## Overview', '## Layout', '## Elevation', '## Do / Don\'t', '## Persian adaptations', '## Accessibility', '## Motion', '## Reference reconciliation']) {
      expect(design).toContain(heading)
    }
  })

  it('records the deliberate deviations instead of hiding them', () => {
    expect(design).toContain('Vazirmatn')
    expect(design).toContain('Inter')
    expect(design).toContain('JetBrains Mono')
    expect(design).toContain('10px')
    expect(design).toContain('original')
  })
})

describe('agent guidance', () => {
  const agents = read('AGENTS.md')

  it('mandates the design and API references before UI work', () => {
    expect(agents).toContain('DESIGN.md')
    expect(agents).toContain('THEME_API.md')
    expect(agents).toContain('pnpm verify')
  })

  it('states the non-negotiable content and tenancy rules', () => {
    expect(agents).toContain('No fabricated')
    expect(agents).toContain('site key')
    expect(agents).toContain('logical properties')
    expect(agents).toContain('block types')
  })
})
```

- [ ] **Step 3: Run and confirm it fails**

Run: `pnpm vitest run tests/unit/design-docs.test.ts`
Expected: FAIL — `DESIGN.md` missing.

- [ ] **Step 4: Write `DESIGN.md`**

Use this exact frontmatter and section structure, filling the reconciliation section with the result of Step 1:

```markdown
---
design:
  name: Eshobe Corporation
  reference: https://www.designmd.co/d/vercel
  reference_snapshot: 2026-10-24 (DesignMD attachment; live fetch result recorded below)
  colors:
    light:
      ink: '#171717'
      body: '#4d4d4d'
      mute: '#888888'
      hairline: '#ebebeb'
      hairlineStrong: '#a1a1a1'
      canvas: '#ffffff'
      canvasSoft: '#fafafa'
      canvasSoft2: '#f5f5f5'
      link: '#0070f3'
      success: '#0f7b3e'
      warning: '#b45309'
      danger: '#b42318'
    dark:
      ink: '#ededed'
      body: '#a1a1a1'
      mute: '#737373'
      hairline: '#262626'
      hairlineStrong: '#525252'
      canvas: '#0a0a0a'
      canvasSoft: '#111111'
      canvasSoft2: '#171717'
      link: '#52a8ff'
  typography:
    display-xl: { size: '48px', lineHeight: '48px', tracking: '-2.4px' }
    display-lg: { size: '32px', lineHeight: '40px', tracking: '-1.28px' }
    display-md: { size: '24px', lineHeight: '32px', tracking: '-0.96px' }
    display-sm: { size: '20px', lineHeight: '28px', tracking: '-0.6px' }
    body-lg: { size: '18px', lineHeight: '28px', tracking: '0' }
    body-md: { size: '16px', lineHeight: '24px', tracking: '0' }
    body-sm: { size: '14px', lineHeight: '20px', tracking: '-0.28px' }
    caption: { size: '12px', lineHeight: '16px', tracking: '0' }
    mono: { size: '12-13px', lineHeight: '16px', tracking: '0' }
  rounded: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', pill: '64px', full: '100px' }
  spacing: [4, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128, 192]
  components:
    - nav
    - button
    - badge
    - card
    - product-mockup
    - section-header
    - feature-grid
    - sticky-stack
    - pricing-card
    - testimonial-card
    - faq-accordion
    - logo-strip
    - field
    - submit-state
    - contact-card
    - cta-band
    - footer
---

# Eshobe Corporation Design System

## Overview

A Vercel-inspired corporate/SaaS language translated into an original system: near-white
canvas, ink CTAs, 1px hairlines, a four-step surface ladder, a restrained multi-radial hero
mesh, and tightly tracked Latin display type. The system is Persian-first: Vazirmatn sets the
Persian voice, Latin display tracking is disabled for Persian, and body leading stays at 1.8.
The reference is a design direction, not a source of assets or copy.

## Layout

- Container 1400px; gutters 16 / 24 / 32 / 40px by breakpoint.
- Breakpoints 600 / 960 / 1200 / 1400.
- Section rhythm 96–128px desktop, 56–64px mobile; 4px spacing base.
- Surfaces alternate canvas → soft deterministically; inverted bands only for the
  hero-adjacent showcase and the final CTA.
- RTL uses logical properties everywhere; the start edge is the right edge in Persian.

## Elevation

Five stacked-shadow levels (L1–L5), each with an inset hairline. Stacked offsets only — no
single blurred blob. In dark mode the ring becomes `inset 0 0 0 1px rgb(255 255 255 / 8%)`.

## Do / Don't

- Do use `--primary` for action surfaces and `--accent` for links/focus.
- Do let one strong element own a section; don't compete with the hero.
- Don't invent metrics, quotes, logos, prices or product claims to fill a layout.
- Don't use physical direction utilities (`ml-*`, `text-left`, `left-*`).
- Don't add a block type the CMS contract does not define.
- Don't copy Vercel marks, screenshots, fonts or page copy.

## Persian adaptations

- Vazirmatn for Persian; Inter for Latin; JetBrains Mono for technical labels only.
- No negative tracking on Persian; display leading ~1.25, body leading 1.8.
- Persian digits and Jalali dates via `@eshobe/site-runtime`.
- Phone numbers keep leading zeros via `toLocaleDigits`, not `formatNumber`.
- Mixed-direction strings use `unicode-bidi: plaintext`.

## Accessibility

- 4.5:1 body / 3:1 large-text contrast; focus ring visible on every interactive element.
- 44px minimum touch targets; skip link; labelled fields with `aria-describedby`.
- Accordion and mobile menu expose `aria-expanded` / `aria-controls`; no keyboard traps.
- `prefers-reduced-motion` removes reveals and smooth scrolling.
- Form status is announced through `aria-live`; errors are inline and preserved.

## Motion

150–250ms state transitions; reveal stagger ≤80ms; transform/opacity only. No parallax,
infinite loops, or layout-shift animation. Reduced motion removes all of it.

## Reference reconciliation

- Live reference: **[fill in: HTTP 200 + date, or HTTP 429/timeout + date]**.
- Snapshot of record: the DesignMD attachment supplied on 2026-10-24.
- Deliberate deviations: Vazirmatn/Inter/JetBrains Mono replace Geist; the hero mesh is an
  original CSS composition; CMS radius `md` maps to 10px (the nearest platform step to the
  reference's 8px card radius); pill CTA shape is theme-owned and unaffected by CMS radius;
  blog/archive and announcement surfaces are deferred.
```

- [ ] **Step 5: Write `AGENTS.md`**

```markdown
# Agent guidance — Eshobe Corporation theme

Read these before touching UI or data code:

1. `DESIGN.md` — the committed design contract. Every visual decision cites it or records a deviation.
2. Eshobe Theme API v1 (`docs/THEME_API.md` in `hamidnoshady/eshobe-cms`) — the only block,
   descriptor and endpoint vocabulary this theme may use.
3. `docs/superpowers/specs/2026-10-24-eshobe-corporation-theme-design.md` — scope and decisions.

## Non-negotiables

- **No fabricated** testimonials, customer logos, metrics, prices, licence fees or product
  claims. Render CMS content or omit the section.
- **Tenancy**: every server read uses the platform-injected site key. The key never reaches the
  browser. Never proxy a visitor `Host` as a tenant selector.
- **Drafts**: public rendering sends `draft=false` and the published status filter. Preview
  requires draft mode and a non-canonical host.
- **RTL**: logical properties only. The lint rule rejects physical direction utilities.
- **Blocks**: never invent block types. Unknown or disallowed blocks render nothing and log in dev.
- **Types**: do not widen the CMS types to `any`; normalize unknown fields with the readers in
  `src/blocks/normalize.ts`.
- **Verification**: run `pnpm verify` before claiming completion. Browser checks use
  `pnpm test:browser` with the fixture CMS.
```

- [ ] **Step 6: Run the docs tests**

Run: `pnpm vitest run tests/unit/design-docs.test.ts`
Expected: PASS. Verify the reconciliation line contains an actual status and date, not a placeholder.

- [ ] **Step 7: Commit**

```bash
git add DESIGN.md AGENTS.md tests/unit/design-docs.test.ts
git commit -m "docs: commit design contract and agent guidance"
```

---

### Task 4: Tokens, fonts, and global stylesheet

**Files:**
- Create: `public/fonts/vazirmatn-arabic.woff2`, `public/fonts/vazirmatn-latin.woff2`, `public/fonts/inter-latin.woff2`, licenses and `PROVENANCE.txt`
- Create: `src/styles/tokens.ts`, `src/styles/globals.css`, `src/styles/fonts.css`
- Modify: `src/app/layout.tsx`
- Test: `tests/unit/tokens.test.ts`

**Interfaces:**
- Produces: `TOKENS` (TS mirror), CSS custom properties in `globals.css`, utility classes (`container-page`, `section-y`, `hairline`, `card-surface`, `btn` layers), and `fontFaceCss(): string`.
- Produces: `fontPreloadHrefs: readonly string[]`.
- Consumes: `themeCss` from Task 2 (wired in Task 8).

- [ ] **Step 1: Copy the licensed fonts and licenses**

```bash
mkdir -p public/fonts
cp D:/Development/cms-arch3-theme/public/fonts/vazirmatn-arabic.woff2 public/fonts/
cp D:/Development/cms-arch3-theme/public/fonts/vazirmatn-latin.woff2 public/fonts/
cp D:/Development/cms-arch3-theme/public/fonts/inter-latin.woff2 public/fonts/
cp D:/Development/cms-arch3-theme/public/fonts/LICENSE-Vazirmatn.txt public/fonts/
cp D:/Development/cms-arch3-theme/public/fonts/LICENSE-Inter.txt public/fonts/
cp D:/Development/cms-arch3-theme/public/fonts/PROVENANCE.txt public/fonts/
cp node_modules/@fontsource-variable/jetbrains-mono/LICENSE public/fonts/LICENSE-JetBrainsMono.txt
```

Run `pnpm install` first if `node_modules` is absent. Confirm each `.woff2` is a real file, not a GitHub LFS pointer:

```bash
ls -l public/fonts
file public/fonts/*.woff2
```

Expected: three Web Open Font Format files (roughly 34–48 KB each). Append one line to `public/fonts/PROVENANCE.txt`:

```text
JetBrains Mono Variable — @fontsource-variable/jetbrains-mono 5.3.0, SIL Open Font License 1.1.
```

- [ ] **Step 2: Write the token parity test (failing first)**

`tests/unit/tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOKENS } from '@/styles/tokens'

const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
const has = (property: string, value: string) =>
  new RegExp(`${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(css)

describe('token parity', () => {
  it('declares every light token in CSS and TS', () => {
    for (const [name, value] of Object.entries(TOKENS.colors.light)) {
      expect(has(`--${name}`, value), `--${name}`).toBe(true)
    }
  })

  it('declares every dark override', () => {
    for (const [name, value] of Object.entries(TOKENS.colors.dark)) {
      expect(has(`--${name}`, value), `--${name}`).toBe(true)
    }
  })

  it('declares the approved type scale and radius', () => {
    expect(TOKENS.type.displayXl).toEqual({ size: '48px', leading: '48px', tracking: '-2.4px' })
    expect(TOKENS.radius).toEqual({ xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', pill: '64px', full: '100px' })
    expect(css).toContain('--radius-control')
  })
})
```

- [ ] **Step 3: Run and confirm it fails**

Run: `pnpm vitest run tests/unit/tokens.test.ts`
Expected: FAIL — `src/styles/tokens.ts` missing.

- [ ] **Step 4: Write `src/styles/tokens.ts`**

```ts
export const TOKENS = {
  colors: {
    light: {
      ink: '#171717',
      body: '#4d4d4d',
      mute: '#888888',
      hairline: '#ebebeb',
      'hairline-strong': '#a1a1a1',
      canvas: '#ffffff',
      'canvas-soft': '#fafafa',
      'canvas-soft-2': '#f5f5f5',
      link: '#0070f3',
      success: '#0f7b3e',
      warning: '#b45309',
      danger: '#b42318',
    },
    dark: {
      ink: '#ededed',
      body: '#a1a1a1',
      mute: '#737373',
      hairline: '#262626',
      'hairline-strong': '#525252',
      canvas: '#0a0a0a',
      'canvas-soft': '#111111',
      'canvas-soft-2': '#171717',
      link: '#52a8ff',
    },
  },
  type: {
    displayXl: { size: '48px', leading: '48px', tracking: '-2.4px' },
    displayLg: { size: '32px', leading: '40px', tracking: '-1.28px' },
    displayMd: { size: '24px', leading: '32px', tracking: '-0.96px' },
    displaySm: { size: '20px', leading: '28px', tracking: '-0.6px' },
    bodyLg: { size: '18px', leading: '28px', tracking: '0' },
    bodyMd: { size: '16px', leading: '24px', tracking: '0' },
    bodySm: { size: '14px', leading: '20px', tracking: '-0.28px' },
    caption: { size: '12px', leading: '16px', tracking: '0' },
  },
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', pill: '64px', full: '100px' },
  spacing: [4, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128, 192],
} as const
```

- [ ] **Step 5: Write `src/styles/fonts.css`**

```css
/* Self-hosted, OFL-licensed faces. Licenses sit beside the binaries in public/fonts. */
@font-face {
  font-family: 'Vazirmatn Variable';
  src: url('/fonts/vazirmatn-arabic.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF,
    U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC;
}
@font-face {
  font-family: 'Vazirmatn Variable';
  src: url('/fonts/vazirmatn-latin.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
    U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Inter Variable';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
    U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* Fontsource ships JetBrains Mono as a self-hosted variable woff2; only labels use it. */
```

- [ ] **Step 6: Write `src/styles/globals.css`**

```css
@import 'tailwindcss';
@import './fonts.css';

@theme inline {
  --color-canvas: var(--canvas);
  --color-canvas-soft: var(--canvas-soft);
  --color-canvas-soft-2: var(--canvas-soft-2);
  --color-ink: var(--ink);
  --color-body: var(--body);
  --color-mute: var(--mute);
  --color-hairline: var(--hairline);
  --color-hairline-strong: var(--hairline-strong);
  --color-link: var(--link);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --font-sans: var(--font-latin);
  --font-fa: var(--font-persian);
  --font-mono: var(--font-mono);
  --radius-theme: var(--radius-control);
  --ease-theme: cubic-bezier(0.2, 0, 0, 1);
  --shadow-l1: var(--elevation-l1);
  --shadow-l2: var(--elevation-l2);
  --shadow-l3: var(--elevation-l3);
  --shadow-l4: var(--elevation-l4);
  --shadow-l5: var(--elevation-l5);
}

:root {
  --ink: #171717;
  --body: #4d4d4d;
  --mute: #888888;
  --hairline: #ebebeb;
  --hairline-strong: #a1a1a1;
  --canvas: #ffffff;
  --canvas-soft: #fafafa;
  --canvas-soft-2: #f5f5f5;
  --link: #0070f3;
  --success: #0f7b3e;
  --warning: #b45309;
  --danger: #b42318;

  /* CMS-owned values. themeCss(site.theme) redeclares these on body. */
  --primary: #171717;
  --primary-foreground: #ffffff;
  --accent: #0070f3;
  --accent-foreground: #ffffff;
  --radius-control: 10px;
  --line-height: 1.8;

  --font-persian: 'Vazirmatn Variable', 'Segoe UI', Tahoma, system-ui, sans-serif;
  --font-latin: 'Inter Variable', 'Helvetica Neue', Arial, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace;

  --container-max: 1400px;
  --gutter: 16px;
  --section-y: 56px;
  --hairline-width: 1px;

  --elevation-l1: 0 1px 2px rgb(0 0 0 / 4%), inset 0 0 0 1px var(--hairline);
  --elevation-l2: 0 2px 4px rgb(0 0 0 / 4%), 0 8px 16px -8px rgb(0 0 0 / 8%), inset 0 0 0 1px var(--hairline);
  --elevation-l3: 0 4px 8px rgb(0 0 0 / 4%), 0 16px 32px -12px rgb(0 0 0 / 10%), inset 0 0 0 1px var(--hairline);
  --elevation-l4: 0 8px 16px rgb(0 0 0 / 5%), 0 32px 64px -24px rgb(0 0 0 / 14%), inset 0 0 0 1px var(--hairline);
  --elevation-l5: 0 16px 32px rgb(0 0 0 / 6%), 0 48px 96px -32px rgb(0 0 0 / 18%), inset 0 0 0 1px var(--hairline);

  color-scheme: light;
}

[data-theme='dark'] {
  --ink: #ededed;
  --body: #a1a1a1;
  --mute: #737373;
  --hairline: #262626;
  --hairline-strong: #525252;
  --canvas: #0a0a0a;
  --canvas-soft: #111111;
  --canvas-soft-2: #171717;
  --link: #52a8ff;

  --elevation-l1: 0 1px 2px rgb(0 0 0 / 40%), inset 0 0 0 1px rgb(255 255 255 / 8%);
  --elevation-l2: 0 2px 4px rgb(0 0 0 / 40%), 0 8px 16px -8px rgb(0 0 0 / 50%), inset 0 0 0 1px rgb(255 255 255 / 8%);
  --elevation-l3: 0 4px 8px rgb(0 0 0 / 40%), 0 16px 32px -12px rgb(0 0 0 / 55%), inset 0 0 0 1px rgb(255 255 255 / 8%);
  --elevation-l4: 0 8px 16px rgb(0 0 0 / 45%), 0 32px 64px -24px rgb(0 0 0 / 60%), inset 0 0 0 1px rgb(255 255 255 / 8%);
  --elevation-l5: 0 16px 32px rgb(0 0 0 / 50%), 0 48px 96px -32px rgb(0 0 0 / 65%), inset 0 0 0 1px rgb(255 255 255 / 8%);

  color-scheme: dark;
}

@media (min-width: 600px) {
  :root { --gutter: 24px; --section-y: 72px; }
}
@media (min-width: 960px) {
  :root { --gutter: 32px; --section-y: 96px; }
}
@media (min-width: 1200px) {
  :root { --gutter: 40px; --section-y: 112px; }
}

@layer base {
  * { min-width: 0; }
  html { -webkit-text-size-adjust: 100%; background-color: var(--canvas); }
  body {
    background-color: var(--canvas);
    color: var(--ink);
    font-family: var(--font-persian);
    font-size: 16px;
    line-height: var(--line-height, 1.8);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    overflow-x: clip;
  }
  [dir='ltr'] body { font-family: var(--font-latin); line-height: 1.6; }
  [dir='ltr'] h1, [dir='ltr'] h2, [dir='ltr'] h3 { letter-spacing: -0.02em; }
  h1, h2, h3, h4 { font-weight: 600; line-height: 1.25; text-wrap: balance; }
  p { text-wrap: pretty; }
  img, svg, video { display: block; max-width: 100%; }
  img { height: auto; }
  a { color: inherit; text-decoration: none; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  ::selection { background: var(--ink); color: var(--canvas); }
  .bidi-plaintext { unicode-bidi: plaintext; }
  .mono { font-family: var(--font-mono); }
}

@layer components {
  .container-page {
    width: 100%;
    max-width: var(--container-max);
    margin-inline: auto;
    padding-inline: var(--gutter);
  }
  .section-y { padding-block: var(--section-y); }
  .hairline { border-block-start: var(--hairline-width) solid var(--hairline); }
  .card-surface {
    background: var(--canvas);
    border: var(--hairline-width) solid var(--hairline);
    border-radius: var(--radius-control);
    box-shadow: var(--elevation-l1);
  }
  .btn-primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border-radius: 64px;
  }
  [data-theme='dark'] .btn-primary {
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 16%);
  }
  .btn-nav { border-radius: 6px; }
  .hero-mesh {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(60% 80% at 15% 20%, color-mix(in oklab, var(--accent) 24%, transparent), transparent 70%),
      radial-gradient(45% 60% at 85% 10%, rgb(255 77 128 / 18%), transparent 70%),
      radial-gradient(55% 70% at 60% 100%, rgb(121 40 202 / 14%), transparent 72%),
      linear-gradient(to bottom, var(--canvas), var(--canvas-soft));
    opacity: 0.85;
  }
  [data-theme='dark'] .hero-mesh { opacity: 0.5; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 7: Wire fonts into the layout and add `fontFaceCss`/preloads**

`src/lib/fonts.ts`:

```ts
export const fontPreloadHrefs = [
  '/fonts/vazirmatn-arabic.woff2',
  '/fonts/inter-latin.woff2',
] as const

export const fontFaceCss = (): string => ''
```

The empty `fontFaceCss` is intentional: the faces live in `fonts.css` so the browser can parse
them with the main stylesheet; the helper exists only for the layout's preload list. Task 8
imports `fontPreloadHrefs`.

Update `src/app/layout.tsx`:

```tsx
import '@fontsource-variable/jetbrains-mono'
import '@/styles/globals.css'

import type { ReactNode } from 'react'
import { fontPreloadHrefs } from '@/lib/fonts'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {fontPreloadHrefs.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Run token tests, typecheck, and a production build**

Run: `pnpm vitest run tests/unit/tokens.test.ts && pnpm typecheck && pnpm build`
Expected: PASS and a successful standalone build. Confirm the build output includes the fonts (they are in `public/`).

- [ ] **Step 9: Commit**

```bash
git add public/fonts src/styles src/lib/fonts.ts src/app/layout.tsx tests/unit/tokens.test.ts
git commit -m "feat: add design tokens, self-hosted fonts and global stylesheet"
```

---

### Task 5: CMS types, env, cache tags, client and revalidation verifier

**Files:**
- Create: `src/cms/types.ts`, `src/cms/env.ts`, `src/cms/tags.ts`, `src/cms/client.ts`, `src/cms/verify.ts`, `src/cms/fixture.ts` (temporary stub)
- Test: `tests/unit/cms-contract.test.ts`

**Interfaces:**
- Produces: `SiteDescriptor`, `ThemeRuntime`, `BoundContent`, `Block`, `Page`, `Media`, `Form`, `FormField`, `HeaderGlobal`, `FooterGlobal`, `CmsLink`, `RichText`, `LexicalNode`, `Paginated`.
- Produces: `readCmsEnv(env?): CmsEnv`, `CmsConfigError`, `isFixtureMode(env?)`.
- Produces: `CMS_ALL_TAG`, `cacheTags(tenant, resource, locale?)`, `mapWebhookResource(resource)`.
- Produces: `cmsFetchJson<T>(path, options)`, `cmsFetchOptional<T>(path, options)`, `applyDraftPolicy`, `CmsUnavailableError`, `UnknownHostError`, `SITE_REVALIDATE_SECONDS`, `CONTENT_REVALIDATE_SECONDS`.
- Produces: `verifyRawBodySignature(rawBody, header, secret)`, `isFreshTimestamp(raw, now?, toleranceMs?)`, `readRevalidateNotice(value)`, `revalidationTags(resources, tenantKey)`.
- Produces: `fixtureResponse(path, query): { status: number; data: unknown }` (Task 6 replaces the stub).

- [ ] **Step 1: Write the contract tests (failing first)**

`tests/unit/cms-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readCmsEnv, isFixtureMode, CmsConfigError } from '@/cms/env'
import { applyDraftPolicy } from '@/cms/client'
import { CMS_ALL_TAG, cacheTags, mapWebhookResource } from '@/cms/tags'
import {
  isFreshTimestamp,
  readRevalidateNotice,
  revalidationTags,
  verifyRawBodySignature,
} from '@/cms/verify'
import { createHmac } from 'node:crypto'

describe('CMS environment', () => {
  it('requires a URL and key in production', () => {
    const env = readCmsEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)
    expect(env.cmsUrl).toBeNull()
    expect(env.apiKey).toBeNull()
    expect(isFixtureMode({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false)
  })

  it('trims trailing slashes and reads the fixture flag', () => {
    const env = readCmsEnv({
      ESHOBE_CMS_URL: 'https://cms.example.test///',
      ESHOBE_API_KEY: 'site-key',
      ESHOBE_SITE_ID: '42',
      ESHOBE_FIXTURE: '1',
    } as NodeJS.ProcessEnv)
    expect(env.cmsUrl).toBe('https://cms.example.test')
    expect(env.siteId).toBe('42')
    expect(isFixtureMode({ ESHOBE_FIXTURE: '1' } as NodeJS.ProcessEnv)).toBe(true)
  })

  it('exposes a typed config error', () => {
    const error = new CmsConfigError('missing')
    expect(error.name).toBe('CmsConfigError')
  })
})

describe('draft policy', () => {
  it('public reads force drafts off and published status', () => {
    expect(applyDraftPolicy({ locale: 'fa' }, false, true)).toEqual({
      locale: 'fa',
      draft: 'false',
      'where[_status][equals]': 'published',
    })
  })

  it('preview reads force drafts on and never add a status filter', () => {
    expect(applyDraftPolicy({ locale: 'fa' }, true, true)).toEqual({ locale: 'fa', draft: 'true' })
  })

  it('globals are left untouched', () => {
    expect(applyDraftPolicy({ locale: 'fa' }, false, false)).toEqual({ locale: 'fa' })
  })
})

describe('cache tags', () => {
  it('scopes tags to tenant, locale and resource', () => {
    expect(cacheTags('42', 'page', 'fa')).toEqual([CMS_ALL_TAG, 'tnt:42:fa:page'])
    expect(cacheTags('42', 'navigation')).toEqual([CMS_ALL_TAG, 'tnt:42:navigation'])
  })

  it('maps only known webhook resources', () => {
    expect(mapWebhookResource('pages')).toBe('page')
    expect(mapWebhookResource('header')).toBe('navigation')
    expect(mapWebhookResource('mystery')).toBeNull()
    expect(revalidationTags(['pages', 'header'], '42')).toEqual([
      CMS_ALL_TAG,
      'tnt:42:page',
      'tnt:42:navigation',
    ])
  })
})

describe('revalidation verification', () => {
  const secret = 'test-secret'
  const body = JSON.stringify({ resources: ['pages'], paths: ['/fa/about'] })
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

  it('accepts only the exact signed body', () => {
    expect(verifyRawBodySignature(body, signature, secret)).toBe(true)
    expect(verifyRawBodySignature(`${body} `, signature, secret)).toBe(false)
    expect(verifyRawBodySignature(body, signature, 'other')).toBe(false)
    expect(verifyRawBodySignature(body, null, secret)).toBe(false)
  })

  it('enforces a five minute timestamp window', () => {
    const now = Date.parse('2026-10-24T12:00:00Z')
    expect(isFreshTimestamp('2026-10-24T12:04:00Z', now)).toBe(true)
    expect(isFreshTimestamp('2026-10-24T12:06:00Z', now)).toBe(false)
    expect(isFreshTimestamp(String(Math.floor(now / 1000)), now)).toBe(true)
    expect(isFreshTimestamp(null, now)).toBe(false)
  })

  it('reads only documented notice fields', () => {
    expect(readRevalidateNotice({ paths: ['/'], resources: ['pages', 4], tags: 'x' })).toEqual({
      paths: ['/'],
      resources: ['pages'],
      tags: [],
    })
    expect(readRevalidateNotice(null)).toEqual({ paths: [], resources: [], tags: [] })
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `pnpm vitest run tests/unit/cms-contract.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `src/cms/types.ts`**

```ts
import { contractVersion } from '@eshobe/site-runtime'

/** Contract §4: the runtime owns the number, so the theme and CMS cannot drift. */
export const CONTRACT_VERSION = contractVersion

export type SiteStatus = 'active' | 'suspended' | 'archived'
export type SiteType = 'business' | 'portfolio' | 'store'

export type MediaSize = {
  url?: string | null
  width?: number | null
  height?: number | null
  mimeType?: string | null
  filesize?: number | null
  filename?: string | null
}

export type Media = {
  id: string | number
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
  mimeType?: string | null
  filename?: string | null
  filesize?: number | null
  sizes?: Record<string, MediaSize | undefined> | null
  updatedAt?: string | null
}

export type BoundContent = {
  id?: string | null
  type?: string | null
  slug?: string | null
  title?: string | null
}

export type ThemeRuntime = {
  theme?: { key?: string | null } | null
  package?: { key?: string | null } | null
  settings?: unknown
  bindings?: Record<string, BoundContent | null> | null
  branding?: unknown
}

export type ThemeTokens = {
  primary?: string | null
  accent?: string | null
  background?: string | null
  foreground?: string | null
  radius?: 'none' | 'sm' | 'md' | 'lg' | null
  lineHeight?: number | null
}

export type SiteDescriptor = {
  availableLocales: string[]
  blocks: string[]
  contractVersion: number
  defaultLocale: string
  domain: string
  media: { basePath?: string | null; origin: string }
  name: string
  slug?: string | null
  status: SiteStatus
  store?: { currency?: string | null; paymentProvider?: string | null } | null
  theme?: ThemeTokens | null
  themeRuntime?: ThemeRuntime | null
  type: SiteType
  id?: string | null
  domainVerified?: boolean | null
}

export type LexicalTextNode = {
  type: 'text'
  text?: string
  format?: number
  style?: string
  detail?: number
  mode?: string
  direction?: string | null
}

export type LexicalElementNode = {
  type: string
  children?: LexicalNode[]
  tag?: string
  listType?: string
  url?: string
  newTab?: boolean
  fields?: Record<string, unknown>
  value?: unknown
  relationTo?: string
  format?: string | number
  direction?: string | null
  [key: string]: unknown
}

export type LexicalNode = LexicalTextNode | LexicalElementNode

export type RichText = {
  root?: {
    type?: string
    direction?: string | null
    format?: string
    indent?: number
    version?: number
    children?: LexicalNode[]
  } | null
} | null

export type Meta = {
  title?: string | null
  description?: string | null
  image?: Media | string | number | null
}

export type Block = {
  id?: string | null
  blockType: string
  blockName?: string | null
  [key: string]: unknown
}

export type Page = {
  id: string | number
  title?: string | null
  slug?: string | null
  hero?: {
    type?: string | null
    richText?: RichText
    links?: unknown
    media?: Media | string | number | null
  } | null
  layout?: Block[] | null
  meta?: Meta | null
  publishedAt?: string | null
  updatedAt?: string | null
  _status?: string | null
  path?: string | null
}

export type HeaderGlobal = {
  navItems?: { link?: unknown; id?: string | null }[] | null
}

export type FooterGlobal = {
  navItems?: { link?: unknown; id?: string | null }[] | null
}

export type FormField = {
  name?: string | null
  label?: string | null
  blockType?: string | null
  required?: boolean | null
  width?: number | null
  options?: { label?: string | null; value?: string | null }[] | null
  defaultValue?: string | null
}

export type Form = {
  id: string | number
  title?: string | null
  fields?: FormField[] | null
  submitButtonLabel?: string | null
  confirmationType?: string | null
  confirmationMessage?: RichText
  redirect?: { url?: string | null } | null
}

export type Paginated<T> = {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}

export type CmsLinkReference = {
  relationTo?: string | null
  value?: Page | string | number | null
}

export type CmsLink = {
  type?: 'reference' | 'custom' | null
  reference?: CmsLinkReference | null
  url?: string | null
  label?: string | null
  newTab?: boolean | null
  appearance?: 'default' | 'outline' | null
}
```

- [ ] **Step 4: Write `src/cms/env.ts` and `src/cms/tags.ts`**

`src/cms/env.ts`:

```ts
export type CmsEnv = {
  cmsUrl: string | null
  apiKey: string | null
  siteId: string | null
  siteDomain: string | null
  publicOrigin: string | null
  revalidateSecret: string | null
  previewSecret: string | null
}

export class CmsConfigError extends Error {
  readonly kind = 'cms-config'
  constructor(message: string) {
    super(message)
    this.name = 'CmsConfigError'
  }
}

const clean = (value: string | undefined, stripTrailingSlash = false): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  return stripTrailingSlash ? trimmed.replace(/\/+$/, '') : trimmed
}

export function readCmsEnv(source: NodeJS.ProcessEnv = process.env): CmsEnv {
  return {
    cmsUrl: clean(source.ESHOBE_CMS_URL, true),
    apiKey: clean(source.ESHOBE_API_KEY),
    siteId: clean(source.ESHOBE_SITE_ID),
    siteDomain: clean(source.ESHOBE_SITE_DOMAIN),
    publicOrigin: clean(source.ESHOBE_PUBLIC_ORIGIN, true),
    revalidateSecret: clean(source.ESHOBE_REVALIDATE_SECRET),
    previewSecret: clean(source.ESHOBE_PREVIEW_SECRET),
  }
}

/** Fixtures are opt-in, never a silent production fallback. */
export const isFixtureMode = (source: NodeJS.ProcessEnv = process.env): boolean =>
  source.ESHOBE_FIXTURE === '1'

export function assertUsableOrigin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new CmsConfigError(`Invalid origin: ${value}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CmsConfigError(`Unsupported origin protocol: ${url.protocol}`)
  }
  return url.origin
}
```

`src/cms/tags.ts`:

```ts
export const CMS_ALL_TAG = 'cms:all'

const RESOURCE_MAP: Record<string, string> = {
  pages: 'page',
  page: 'page',
  posts: 'post',
  post: 'post',
  products: 'product',
  product: 'product',
  forms: 'form',
  form: 'form',
  header: 'navigation',
  footer: 'navigation',
  navigation: 'navigation',
  site: 'site',
  media: 'media',
  categories: 'category',
  search: 'search',
}

export const mapWebhookResource = (resource: string): string | null =>
  RESOURCE_MAP[resource.trim().toLowerCase()] ?? null

/** CMS_ALL_TAG is the coarse escape hatch; the tenant tag is the precise one. */
export function cacheTags(tenantKey: string, resource: string, locale?: string): string[] {
  const suffix = locale && locale !== '' ? `:${locale}:${resource}` : `:${resource}`
  return [CMS_ALL_TAG, `tnt:${tenantKey}${suffix}`]
}
```

- [ ] **Step 5: Write `src/cms/client.ts` and the fixture stub**

`src/cms/client.ts`:

```ts
import 'server-only'

import { cache } from 'react'

import { fixtureResponse } from './fixture'
import { CmsConfigError, isFixtureMode, readCmsEnv, type CmsEnv } from './env'
import { cacheTags } from './tags'

export const SITE_REVALIDATE_SECONDS = 30
export const CONTENT_REVALIDATE_SECONDS = 60
const FETCH_TIMEOUT_MS = 10_000

export type QueryValue = string | number | boolean | null | undefined
export type CmsQuery = Record<string, QueryValue>

export type CmsMode = 'cms' | 'fixture'

export type CmsContext = {
  env: CmsEnv
  mode: CmsMode
  tenantKey: string
}

export class UnknownHostError extends Error {
  readonly kind = 'unknown-host'
  constructor() {
    super('The CMS does not know this site')
    this.name = 'UnknownHostError'
  }
}

export class CmsUnavailableError extends Error {
  readonly kind = 'cms-unavailable'
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'CmsUnavailableError'
  }
}

/** One context per request. Fixture mode is explicit; production never guesses a tenant. */
export const getCmsContext = cache(async (): Promise<CmsContext> => {
  const env = readCmsEnv()
  if (isFixtureMode()) {
    return { env, mode: 'fixture', tenantKey: env.siteId ?? 'fixture' }
  }
  if (!env.cmsUrl || !env.apiKey) {
    throw new CmsConfigError(
      'ESHOBE_CMS_URL and ESHOBE_API_KEY are required unless ESHOBE_FIXTURE=1',
    )
  }
  return { env, mode: 'cms', tenantKey: env.siteId ?? 'site' }
})

/**
 * A collection's draft policy lives in one place. A site key can read drafts, so a
 * public read must say both things: no drafts and a published filter. Preview reads
 * ask for drafts and must not carry the status filter (Payload rejects the pair).
 */
export function applyDraftPolicy(query: CmsQuery, drafts: boolean, publishFilter: boolean): CmsQuery {
  if (!publishFilter) return query
  if (drafts) {
    query.draft = 'true'
    return query
  }
  query.draft = 'false'
  if (query['where[_status][equals]'] === undefined) {
    query['where[_status][equals]'] = 'published'
  }
  return query
}

export type CmsFetchOptions = {
  query?: CmsQuery
  resource: string
  locale?: string
  revalidate?: number
  /** `false` for globals, categories and search — they carry no publish status. */
  publishFilter?: boolean
  /** `true` only after preview mode and a non-canonical host are both verified. */
  drafts?: boolean
}

export type CmsResult<T> = { status: number; data: T | null }

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

export async function cmsFetchJson<T>(
  path: string,
  options: CmsFetchOptions,
): Promise<CmsResult<T>> {
  const context = await getCmsContext()
  const query = applyDraftPolicy(
    { ...(options.query ?? {}) },
    options.drafts === true,
    options.publishFilter !== false,
  )

  if (context.mode === 'fixture') {
    const result = fixtureResponse(path, query)
    return { status: result.status, data: result.data as T | null }
  }

  const env = context.env
  if (!env.cmsUrl || !env.apiKey) throw new CmsConfigError('CMS credentials are missing')

  const url = new URL(path, env.cmsUrl)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }

  const revalidate = options.revalidate ?? CONTENT_REVALIDATE_SECONDS
  const init: RequestInit & { next?: { revalidate: number; tags: string[] } } = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${env.apiKey}`,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }
  if (options.drafts === true) {
    init.cache = 'no-store'
  } else {
    init.next = {
      revalidate,
      tags: cacheTags(context.tenantKey, options.resource, options.locale),
    }
  }

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    throw new CmsUnavailableError(
      `CMS request failed: ${error instanceof Error ? error.message : 'network error'}`,
    )
  }

  if (response.status === 404) return { status: 404, data: null }
  if (!response.ok) {
    if (RETRYABLE_STATUS.has(response.status)) {
      throw new CmsUnavailableError(`CMS returned ${response.status}`, response.status)
    }
    throw new CmsUnavailableError(`CMS returned ${response.status}`, response.status)
  }

  try {
    return { status: response.status, data: (await response.json()) as T }
  } catch {
    throw new CmsUnavailableError('CMS returned malformed JSON', response.status)
  }
}

/** A 404 is a legitimate "no such document"; every other failure is loud. */
export async function cmsFetchOptional<T>(
  path: string,
  options: CmsFetchOptions,
): Promise<T | null> {
  const result = await cmsFetchJson<T>(path, options)
  return result.status === 404 ? null : result.data
}
```

`src/cms/fixture.ts` (temporary stub, replaced in Task 6):

```ts
export type FixtureResult = { status: number; data: unknown }

/** Replaced by the pack-backed provider in Task 6. */
export function fixtureResponse(_path: string, _query: Record<string, unknown>): FixtureResult {
  return { status: 404, data: null }
}
```

- [ ] **Step 6: Write `src/cms/verify.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

import { CMS_ALL_TAG, mapWebhookResource } from './tags'

/**
 * Contract v1: the CMS signs the exact raw body bytes.
 * `x-eshobe-signature: sha256=<hex>`; `x-eshobe-timestamp` is sent but not signed.
 */
export function verifyRawBodySignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!signatureHeader || !secret) return false
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
  const provided = Buffer.from(signatureHeader, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (provided.length !== expectedBuffer.length) return false
  return timingSafeEqual(provided, expectedBuffer)
}

/** ISO-8601 or epoch seconds/milliseconds, within ±5 minutes by default. */
export function isFreshTimestamp(
  raw: string | null | undefined,
  now: number = Date.now(),
  toleranceMs = 5 * 60 * 1000,
): boolean {
  if (!raw) return false
  const numeric = Number(raw)
  const parsed =
    Number.isFinite(numeric) && numeric > 0
      ? numeric > 1e12
        ? numeric
        : numeric * 1000
      : Date.parse(raw)
  return Number.isFinite(parsed) && Math.abs(now - parsed) <= toleranceMs
}

export type RevalidateNotice = {
  paths: string[]
  resources: string[]
  tags: string[]
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    : []

export function readRevalidateNotice(value: unknown): RevalidateNotice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { paths: [], resources: [], tags: [] }
  }
  const record = value as Record<string, unknown>
  return {
    paths: stringArray(record.paths),
    resources: stringArray(record.resources),
    tags: stringArray(record.tags),
  }
}

/** CMS paths are `/<domain>/<locale>/<path>`; strip the domain segment when present. */
export function mapRevalidationPath(rawPath: string, domain: string | null): string | null {
  if (typeof rawPath !== 'string' || !rawPath.startsWith('/')) return null
  const segments = rawPath.split('/').filter((segment) => segment !== '')
  const host = (domain ?? '').split(':')[0] ?? ''
  if (host !== '' && segments[0] === host) segments.shift()
  const path = `/${segments.join('/')}`
  return path === '/' ? '/' : path.replace(/\/+$/, '')
}

/** Never trust CMS tags as cache tags; derive tenant-scoped tags locally. */
export function revalidationTags(resources: string[], tenantKey: string | null): string[] {
  const tags = new Set<string>([CMS_ALL_TAG])
  if (tenantKey) {
    for (const resource of resources) {
      const mapped = mapWebhookResource(resource)
      if (mapped) tags.add(`tnt:${tenantKey}:${mapped}`)
    }
  }
  return [...tags]
}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm vitest run tests/unit/cms-contract.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/cms tests/unit/cms-contract.test.ts
git commit -m "feat: add CMS contract types, key-only client, draft policy and cache tags"
```

---

### Task 6: Fixture CMS, theme settings, site context and typed queries

**Files:**
- Create: `src/lib/theme/settings.ts`, `src/cms/site.ts`, `src/cms/queries.ts`, `src/cms/preview.ts`
- Replace: `src/cms/fixture.ts`
- Create: `demo-packs/biza-miz/site.json`, `header.fa.json`, `header.en.json`, `footer.fa.json`, `footer.en.json`
- Create: `demo-packs/biza-miz/pages/{home,restaurants,pricing,features,demo}.{fa,en}.json`
- Create: `demo-packs/biza-miz/forms/demo.{fa,en}.json`
- Test: `tests/unit/site-settings.test.ts`, `tests/unit/fixture.test.ts`, `tests/unit/preview.test.ts`

**Interfaces:**
- Produces: `ThemeSettings`, `DEFAULT_SETTINGS`, `readThemeSettings(raw): { settings; diagnostics }`.
- Produces: `getSiteDescriptor()`, `getSiteContext()`, `SiteContext`, `readSiteView`, `ContractMismatchError`, `requestOrigin()`, `isPreviewHost`, `isPreviewActive`.
- Produces: `getPageBySlug`, `getPageById`, `getHeader`, `getFooter`, `getFormById`; `ReadOptions = { locale: string; drafts?: boolean }`.
- Produces: fixture data served through the real client for `ESHOBE_FIXTURE=1`.

- [ ] **Step 1: Write settings and preview tests (failing first)**

`tests/unit/site-settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, readThemeSettings } from '@/lib/theme/settings'

describe('theme settings', () => {
  it('uses approved defaults when the CMS sends nothing', () => {
    const { settings, diagnostics } = readThemeSettings(undefined)
    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(diagnostics).toEqual([])
  })

  it('accepts valid values', () => {
    const { settings } = readThemeSettings({
      heroTreatment: 'plain',
      featureTreatment: 'sticky',
      showcaseTreatment: 'editorial',
      logosMonochrome: false,
      restaurantsSlug: 'restaurant',
      pricingSlug: 'plan',
      featuresSlug: 'feature',
      demoSlug: 'trial',
    })
    expect(settings.heroTreatment).toBe('plain')
    expect(settings.featureTreatment).toBe('sticky')
    expect(settings.showcaseTreatment).toBe('editorial')
    expect(settings.logosMonochrome).toBe(false)
    expect(settings.demoSlug).toBe('trial')
  })

  it('falls back per key and reports a diagnostic', () => {
    const { settings, diagnostics } = readThemeSettings({
      heroTreatment: 'sparkles',
      restaurantsSlug: '../admin',
      pricingSlug: '',
    })
    expect(settings.heroTreatment).toBe('mesh')
    expect(settings.restaurantsSlug).toBe('restaurants')
    expect(settings.pricingSlug).toBe('pricing')
    expect(diagnostics.map((d) => d.key).sort()).toEqual(['heroTreatment', 'pricingSlug', 'restaurantsSlug'])
  })

  it('never lets two theme routes share a slug silently', () => {
    const { settings, diagnostics } = readThemeSettings({ pricingSlug: 'features' })
    expect(settings.featuresSlug).toBe('features')
    expect(settings.pricingSlug).toBe('pricing')
    expect(diagnostics.some((d) => d.key === 'pricingSlug' && d.reason === 'conflict')).toBe(true)
  })
})
```

`tests/unit/preview.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isPreviewHost } from '@/cms/preview'

describe('preview host policy', () => {
  it('refuses the canonical host even when draft mode is on', () => {
    expect(isPreviewHost('biza.example', 'biza.example')).toBe(false)
    expect(isPreviewHost('biza.example:443', 'biza.example')).toBe(false)
    expect(isPreviewHost('www.biza.example', 'biza.example')).toBe(false)
  })

  it('allows a non-canonical preview host, including localhost', () => {
    expect(isPreviewHost('preview-abc.vercel.app', 'biza.example')).toBe(true)
    expect(isPreviewHost('localhost:3000', 'biza.example')).toBe(true)
    expect(isPreviewHost('127.0.0.1:3210', 'biza.example')).toBe(true)
  })

  it('fails closed with no host or domain', () => {
    expect(isPreviewHost('', 'biza.example')).toBe(false)
    expect(isPreviewHost('preview.example', '')).toBe(false)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run tests/unit/site-settings.test.ts tests/unit/preview.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `src/lib/theme/settings.ts`**

```ts
export type HeroTreatment = 'mesh' | 'plain'
export type FeatureTreatment = 'cards' | 'sticky'
export type ShowcaseTreatment = 'mockup' | 'editorial'

export type ThemeSettings = {
  heroTreatment: HeroTreatment
  featureTreatment: FeatureTreatment
  showcaseTreatment: ShowcaseTreatment
  logosMonochrome: boolean
  restaurantsSlug: string
  pricingSlug: string
  featuresSlug: string
  demoSlug: string
}

export type SettingDiagnostic = { key: string; reason: 'invalid' | 'conflict'; fallback: string }

export const DEFAULT_SETTINGS: ThemeSettings = {
  heroTreatment: 'mesh',
  featureTreatment: 'cards',
  showcaseTreatment: 'mockup',
  logosMonochrome: true,
  restaurantsSlug: 'restaurants',
  pricingSlug: 'pricing',
  featuresSlug: 'features',
  demoSlug: 'demo',
}

// Declared precedence: when two slots resolve to the same slug, the earlier slot keeps it.
const SLUG_SETTING_KEYS = ['restaurantsSlug', 'featuresSlug', 'pricingSlug', 'demoSlug'] as const
const SLUG_PATTERN = /^[\p{L}\p{M}\p{N}-]+$/u

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const readSlug = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (trimmed === '' || !SLUG_PATTERN.test(trimmed) || trimmed.normalize('NFC') !== trimmed) {
    return fallback
  }
  return trimmed
}

/**
 * The manifest settings are a closed schema; the descriptor is untrusted input.
 * Invalid values fall back per key rather than failing the render.
 */
export function readThemeSettings(raw: unknown): {
  settings: ThemeSettings
  diagnostics: SettingDiagnostic[]
} {
  const source = isRecord(raw) ? raw : {}
  const diagnostics: SettingDiagnostic[] = []
  const settings: ThemeSettings = { ...DEFAULT_SETTINGS }

  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const value = source[key]
    if (value === undefined) return fallback
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T
    diagnostics.push({ key, reason: 'invalid', fallback })
    return fallback
  }

  settings.heroTreatment = pick('heroTreatment', ['mesh', 'plain'] as const, DEFAULT_SETTINGS.heroTreatment)
  settings.featureTreatment = pick('featureTreatment', ['cards', 'sticky'] as const, DEFAULT_SETTINGS.featureTreatment)
  settings.showcaseTreatment = pick('showcaseTreatment', ['mockup', 'editorial'] as const, DEFAULT_SETTINGS.showcaseTreatment)

  if (source.logosMonochrome !== undefined) {
    if (typeof source.logosMonochrome === 'boolean') settings.logosMonochrome = source.logosMonochrome
    else diagnostics.push({ key: 'logosMonochrome', reason: 'invalid', fallback: String(DEFAULT_SETTINGS.logosMonochrome) })
  }

  for (const key of SLUG_SETTING_KEYS) {
    const fallback = DEFAULT_SETTINGS[key]
    const value = readSlug(source[key], fallback)
    if (source[key] !== undefined && value === fallback && source[key] !== fallback) {
      diagnostics.push({ key, reason: 'invalid', fallback })
    }
    settings[key] = value
  }

  // A duplicate slug would make one theme route unreachable; first configured slot wins.
  const seen = new Set<string>()
  for (const key of SLUG_SETTING_KEYS) {
    const slug = settings[key]
    if (seen.has(slug)) {
      diagnostics.push({ key, reason: 'conflict', fallback: DEFAULT_SETTINGS[key] })
      settings[key] = DEFAULT_SETTINGS[key]
    }
    seen.add(settings[key])
  }

  return { settings, diagnostics }
}
```

- [ ] **Step 4: Write `src/cms/preview.ts`**

```ts
import 'server-only'

import { draftMode, headers } from 'next/headers'

/** Canonical hosts must never serve an unauthenticated draft, whatever cookie is present. */
export function isPreviewHost(host: string, domain: string): boolean {
  const incoming = host.split(',')[0]?.trim().toLowerCase().split(':')[0] ?? ''
  const canonical = domain.trim().toLowerCase().split(':')[0] ?? ''
  if (incoming === '' || canonical === '') return false
  if (incoming === canonical || incoming === `www.${canonical}`) return false
  return true
}

function incomingHost(value: string | null, forwarded: string | null): string {
  return (forwarded ?? value ?? '').split(',')[0]?.trim() ?? ''
}

export async function isPreviewActive(domain: string): Promise<boolean> {
  const draft = await draftMode()
  if (!draft.isEnabled) return false
  const incoming = await headers()
  const host = incomingHost(incoming.get('host'), incoming.get('x-forwarded-host'))
  const allowed = isPreviewHost(host, domain)
  if (!allowed && process.env.NODE_ENV !== 'production') {
    console.warn('[eshobe-corporation] draft mode is on for a canonical host — drafts disabled')
  }
  return allowed
}
```

- [ ] **Step 5: Write the fixture content pack (minimal but real)**

`demo-packs/biza-miz/site.json`:

```json
{
  "name": "Biza Miz",
  "slug": "biza-miz",
  "domain": "localhost",
  "type": "business",
  "status": "active",
  "availableLocales": ["fa", "en"],
  "defaultLocale": "fa",
  "media": { "origin": "" },
  "theme": { "primary": "#171717", "accent": "#0070f3", "background": "#ffffff", "foreground": "#171717", "radius": "md", "lineHeight": 1.8 },
  "settings": {
    "heroTreatment": "mesh",
    "featureTreatment": "cards",
    "showcaseTreatment": "mockup",
    "logosMonochrome": true,
    "restaurantsSlug": "restaurants",
    "pricingSlug": "pricing",
    "featuresSlug": "features",
    "demoSlug": "demo"
  },
  "bindings": {
    "home": { "id": "home", "type": "page", "slug": "home", "title": "خانه" },
    "restaurants": { "id": "restaurants", "type": "page", "slug": "restaurants", "title": "رستوران‌ها" },
    "pricing": { "id": "pricing", "type": "page", "slug": "pricing", "title": "تعرفه" },
    "features": { "id": "features", "type": "page", "slug": "features", "title": "ویژگی‌ها" },
    "demo": { "id": "demo", "type": "page", "slug": "demo", "title": "دمو" }
  }
}
```

`demo-packs/biza-miz/header.fa.json`:

```json
{
  "navItems": [
    { "id": "nav-restaurants", "link": { "type": "custom", "url": "/restaurants", "label": "رستوران‌ها و کافه‌ها" } },
    { "id": "nav-features", "link": { "type": "custom", "url": "/features", "label": "ویژگی‌ها" } },
    { "id": "nav-pricing", "link": { "type": "custom", "url": "/pricing", "label": "تعرفه" } }
  ]
}
```

`demo-packs/biza-miz/header.en.json`:

```json
{
  "navItems": [
    { "id": "nav-restaurants", "link": { "type": "custom", "url": "/restaurants", "label": "Restaurants" } },
    { "id": "nav-features", "link": { "type": "custom", "url": "/features", "label": "Features" } },
    { "id": "nav-pricing", "link": { "type": "custom", "url": "/pricing", "label": "Pricing" } }
  ]
}
```

`demo-packs/biza-miz/footer.fa.json`:

```json
{
  "navItems": [
    { "id": "foot-features", "link": { "type": "custom", "url": "/features", "label": "ویژگی‌ها" } },
    { "id": "foot-pricing", "link": { "type": "custom", "url": "/pricing", "label": "تعرفه" } },
    { "id": "foot-demo", "link": { "type": "custom", "url": "/demo", "label": "درخواست دمو" } }
  ]
}
```

`demo-packs/biza-miz/footer.en.json`:

```json
{
  "navItems": [
    { "id": "foot-features", "link": { "type": "custom", "url": "/features", "label": "Features" } },
    { "id": "foot-pricing", "link": { "type": "custom", "url": "/pricing", "label": "Pricing" } },
    { "id": "foot-demo", "link": { "type": "custom", "url": "/demo", "label": "Request a demo" } }
  ]
}
```

Each page file uses this shape. `home.fa.json`:

```json
{
  "id": "home",
  "title": "بیزا میز",
  "slug": "home",
  "_status": "published",
  "meta": { "title": "بیزا میز — مدیریت رستوران و کافه", "description": "نرم‌افزار یکپارچهٔ فروش، میز و گزارش شیفت برای رستوران‌ها و کافه‌ها." },
  "layout": [
    {
      "id": "home-hero",
      "blockType": "cta",
      "richText": { "root": { "type": "root", "children": [
        { "type": "heading", "tag": "h1", "children": [{ "type": "text", "text": "هر سفارش، از میز تا گزارش شیفت" }] },
        { "type": "paragraph", "children": [{ "type": "text", "text": "بیزا میز جریان کار رستوران را از منو و سفارش تا پرداخت و گزارش فروش یکجا نگه می‌دارد." }] }
      ] } },
      "links": [
        { "link": { "type": "custom", "url": "/demo", "label": "درخواست دمو", "appearance": "default" } },
        { "link": { "type": "custom", "url": "/features", "label": "دیدن ویژگی‌ها", "appearance": "outline" } }
      ]
    },
    {
      "id": "home-showcase",
      "blockType": "mediaBlock",
      "media": { "id": "demo-dashboard", "url": "/demo/dashboard.png", "width": 1600, "height": 1000, "alt": "نمای نمونهٔ داشبورد سفارش‌ها", "mimeType": "image/png" },
      "caption": "نمونهٔ تصویری — تصویر محصول واقعی نیست",
      "size": "wide",
      "aspect": "16/9"
    },
    {
      "id": "home-features",
      "blockType": "features",
      "heading": "از منو تا گزارش، بدون جابه‌جایی بین ابزارها",
      "intro": "چهار گام اصلی کار روزانه، در یک جریان.",
      "columns": "4",
      "items": [
        { "id": "f-menu", "title": "منو", "description": "دسته‌بندی و قیمت‌گذاری منو در یک جا." },
        { "id": "f-table", "title": "میز و سفارش", "description": "سفارش روی میز ثبت می‌شود و به آشپزخانه می‌رسد." },
        { "id": "f-pay", "title": "پرداخت و رسید", "description": "پرداخت و رسید در همان جریان سفارش." },
        { "id": "f-report", "title": "گزارش شیفت", "description": "فروش و عملکرد شیفت برای پایان روز." }
      ]
    },
    {
      "id": "home-cta",
      "blockType": "cta",
      "richText": { "root": { "type": "root", "children": [
        { "type": "heading", "tag": "h2", "children": [{ "type": "text", "text": "جریان کاری خود را یک‌بار ببینید" }] }
      ] } },
      "links": [{ "link": { "type": "custom", "url": "/demo", "label": "درخواست دمو", "appearance": "default" } }]
    }
  ]
}
```

`home.en.json` mirrors it in English with `"slug": "home"` and LTR copy. Create all four secondary pages with two or three blocks each:

- `restaurants.{fa,en}.json`: hero CTA, features (workflow), CTA band.
- `pricing.{fa,en}.json`: hero CTA, content block with two columns (pricing explained, no numbers), faq, CTA band.
- `features.{fa,en}.json`: hero CTA, features grid, content (POS flow), CTA band.
- `demo.{fa,en}.json`: hero CTA, content (what the demo covers), formBlock referencing `demo-form`, contact block.

The exact JSON for these pages is part of Task 15's content pack; in this task create them with the same top-level shape and at least one valid block per page so fixtures resolve. Task 15 replaces filler copy with final Biza Miz messaging.

`demo-packs/biza-miz/forms/demo.fa.json`:

```json
{
  "id": "demo-form",
  "title": "درخواست دمو",
  "submitButtonLabel": "ارسال درخواست",
  "confirmationType": "message",
  "fields": [
    { "name": "name", "label": "نام و نام خانوادگی", "blockType": "text", "required": true, "width": 50 },
    { "name": "restaurant", "label": "نام رستوران یا کافه", "blockType": "text", "required": true, "width": 50 },
    { "name": "phone", "label": "شماره تماس", "blockType": "text", "required": true, "width": 50 },
    { "name": "email", "label": "رایانامه", "blockType": "email", "required": false, "width": 50 },
    { "name": "message", "label": "چیزی که می‌خواهید ببینید", "blockType": "textarea", "required": false, "width": 100 },
    { "name": "consent", "label": "با تماس تیم بیزا میز برای هماهنگی دمو موافقم.", "blockType": "checkbox", "required": true, "width": 100 }
  ],
  "confirmationMessage": { "root": { "type": "root", "children": [
    { "type": "paragraph", "children": [{ "type": "text", "text": "درخواست شما ثبت شد. برای هماهنگی تماس می‌گیریم." }] }
  ] } }
}
```

`demo.en.json`: same fields with English labels and confirmation.

- [ ] **Step 6: Write `src/cms/fixture.ts`**

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Page } from './types'

export type FixtureResult = { status: number; data: unknown }

const PACK = join(process.cwd(), 'demo-packs', 'biza-miz')
const cache = new Map<string, unknown>()

const readJson = (file: string): unknown => {
  const cached = cache.get(file)
  if (cached !== undefined) return cached
  const value = JSON.parse(readFileSync(file, 'utf8'))
  cache.set(file, value)
  return value
}

const exists = (file: string): boolean => existsSync(file)

const localeOf = (query: Record<string, unknown>): string =>
  typeof query.locale === 'string' && query.locale !== '' ? query.locale : 'fa'

const pageFiles = (): string[] => {
  const dir = join(PACK, 'pages')
  if (!exists(dir)) return []
  return readdirSync(dir).filter((name) => name.endsWith('.json'))
}

const pageFor = (file: string): Page => readJson(file) as Page

const docs = (items: unknown[]): unknown => ({
  docs: items,
  totalDocs: items.length,
  limit: items.length,
  totalPages: 1,
  page: 1,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
})

const pages = (query: Record<string, unknown>): FixtureResult => {
  const locale = localeOf(query)
  const slug = query['where[slug][equals]']
  const id = query['where[id][equals]']
  const matches = pageFiles()
    .filter((file) => file.endsWith(`.${locale}.json`))
    .map((file) => pageFor(join(PACK, 'pages', file)))
    .filter((page) => {
      if (typeof id === 'string') return String(page.id) === id
      if (typeof slug === 'string') return page.slug === slug
      return true
    })
  return { status: 200, data: docs(matches) }
}

const site = (): FixtureResult => {
  const raw = readJson(join(PACK, 'site.json')) as Record<string, unknown>
  return {
    status: 200,
    data: {
      ...raw,
      contractVersion: 1,
      blocks: [
        'content', 'mediaBlock', 'cta', 'features', 'testimonials', 'faq', 'contact',
        'formBlock', 'gallery', 'team', 'pricing', 'logos', 'archive',
      ],
      media: { origin: '' },
      themeRuntime: {
        theme: { key: 'eshobe-corporation' },
        settings: raw.settings ?? {},
        bindings: raw.bindings ?? {},
      },
    },
  }
}

const singleton = (name: 'header' | 'footer', query: Record<string, unknown>): FixtureResult => {
  const locale = localeOf(query)
  const file = join(PACK, `${name}.${locale}.json`)
  return exists(file) ? { status: 200, data: docs([readJson(file)]) } : { status: 404, data: null }
}

const form = (query: Record<string, unknown>): FixtureResult => {
  const locale = localeOf(query)
  const id = query['where[id][equals]']
  const file = join(PACK, 'forms', `demo.${locale}.json`)
  if (!exists(file)) return { status: 404, data: null }
  const value = readJson(file) as { id?: unknown }
  if (typeof id === 'string' && String(value.id) !== id) {
    return { status: 200, data: docs([]) }
  }
  return { status: 200, data: docs([value]) }
}

/**
 * In-memory CMS for `ESHOBE_FIXTURE=1`. It implements the exact endpoints and
 * paginated envelopes the real client uses, so no query code changes in tests.
 */
export function fixtureResponse(path: string, query: Record<string, unknown>): FixtureResult {
  if (path === '/api/site') return site()
  if (path === '/api/pages') return pages(query)
  if (path === '/api/header') return singleton('header', query)
  if (path === '/api/footer') return singleton('footer', query)
  if (path === '/api/forms') return form(query)
  return { status: 404, data: null }
}
```

- [ ] **Step 7: Write `src/cms/site.ts`**

```ts
import 'server-only'

import { headers } from 'next/headers'
import { cache } from 'react'

import { isLocale, type Locale } from '@eshobe/site-runtime'

import { assertUsableOrigin, CmsConfigError } from './env'
import {
  cmsFetchJson,
  getCmsContext,
  SITE_REVALIDATE_SECONDS,
  UnknownHostError,
} from './client'
import { isPreviewActive } from './preview'
import type { BoundContent, SiteDescriptor, SiteStatus } from './types'
import { CONTRACT_VERSION } from './types'
import { readThemeSettings, type SettingDiagnostic, type ThemeSettings } from '@/lib/theme/settings'

export class ContractMismatchError extends Error {
  readonly kind = 'contract-mismatch'
  constructor(message: string) {
    super(message)
    this.name = 'ContractMismatchError'
  }
}

const SUPPORTED_STATUS: readonly SiteStatus[] = ['active', 'suspended', 'archived']

function pickStatus(value: unknown): SiteStatus {
  return typeof value === 'string' && (SUPPORTED_STATUS as readonly string[]).includes(value)
    ? (value as SiteStatus)
    : 'suspended'
}

export type SiteView = {
  descriptor: SiteDescriptor
  status: SiteStatus
  locales: Locale[]
  defaultLocale: Locale
  mediaOrigin: string
}

function firstHeader(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim()
  return first ? first : null
}

export async function requestOrigin(): Promise<string> {
  const incoming = await headers()
  const host = firstHeader(incoming.get('x-forwarded-host')) ?? firstHeader(incoming.get('host'))
  const proto = firstHeader(incoming.get('x-forwarded-proto')) === 'https' ? 'https' : 'http'
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

/** Validate the descriptor once; throw loudly rather than render a half-known tenant. */
export function readSiteView(descriptor: SiteDescriptor, fixture: boolean): SiteView {
  if (typeof descriptor.name !== 'string' || descriptor.name.trim() === '') {
    throw new CmsConfigError('GET /api/site returned no site name; identity must come from the CMS')
  }
  const locales = Array.isArray(descriptor.availableLocales)
    ? descriptor.availableLocales.filter(isLocale)
    : []
  if (locales.length === 0) {
    throw new CmsConfigError('GET /api/site advertises no locale this theme supports (fa, en)')
  }
  const declared = typeof descriptor.defaultLocale === 'string' ? descriptor.defaultLocale : ''
  const siteDefault = locales.includes(declared as Locale)
    ? (declared as Locale)
    : (locales[0] as Locale)

  const rawOrigin =
    typeof descriptor.media?.origin === 'string' ? descriptor.media.origin.trim().replace(/\/+$/, '') : ''
  if (rawOrigin === '') {
    if (!fixture) throw new CmsConfigError('site descriptor is missing media.origin')
  } else {
    assertUsableOrigin(rawOrigin)
  }

  return {
    descriptor,
    status: pickStatus(descriptor.status),
    locales,
    defaultLocale: siteDefault,
    mediaOrigin: rawOrigin,
  }
}

export const getSiteDescriptor = cache(async (): Promise<SiteDescriptor> => {
  const result = await cmsFetchJson<SiteDescriptor>('/api/site', {
    resource: 'site',
    revalidate: SITE_REVALIDATE_SECONDS,
    publishFilter: false,
  })
  if (result.status === 404 || !result.data) throw new UnknownHostError()
  const site = result.data
  const version = site.contractVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ContractMismatchError(`GET /api/site returned contractVersion ${String(version)}`)
  }
  if (version > CONTRACT_VERSION) {
    throw new ContractMismatchError(
      `CMS contractVersion ${version} is newer than this theme implements (${CONTRACT_VERSION})`,
    )
  }
  return site
})

export function readBindings(raw: unknown): Record<string, BoundContent | null> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, BoundContent | null> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      out[key] = null
      continue
    }
    const record = value as Record<string, unknown>
    out[key] = {
      id: typeof record.id === 'string' || typeof record.id === 'number' ? String(record.id) : null,
      type: typeof record.type === 'string' ? record.type : null,
      slug: typeof record.slug === 'string' ? record.slug : null,
      title: typeof record.title === 'string' ? record.title : null,
    }
  }
  return out
}

export type SiteContext = SiteView & {
  site: SiteDescriptor
  settings: ThemeSettings
  settingsDiagnostics: SettingDiagnostic[]
  bindings: Record<string, BoundContent | null>
  themeKey: string | null
  origin: string
  preview: boolean
}

async function resolveSiteOrigin(
  view: SiteView,
  options: { publicOrigin: string | null; fixture: boolean },
): Promise<string> {
  if (options.publicOrigin) {
    assertUsableOrigin(options.publicOrigin)
    return options.publicOrigin.replace(/\/+$/, '')
  }
  if (options.fixture) return requestOrigin()
  const domain = typeof view.descriptor.domain === 'string' ? view.descriptor.domain.trim() : ''
  return domain === '' ? requestOrigin() : `https://${domain.replace(/\/+$/, '')}`
}

export const getSiteContext = cache(async (): Promise<SiteContext> => {
  const cms = await getCmsContext()
  const descriptor = await getSiteDescriptor()
  const view = readSiteView(descriptor, cms.mode === 'fixture')
  const { settings, diagnostics } = readThemeSettings(descriptor.themeRuntime?.settings)
  const themeKey = descriptor.themeRuntime?.theme?.key ?? descriptor.themeRuntime?.package?.key ?? null

  if (process.env.NODE_ENV !== 'production' && themeKey && themeKey !== 'eshobe-corporation') {
    console.warn(
      `[eshobe-corporation] descriptor reports theme "${themeKey}" but this build is "eshobe-corporation"`,
    )
  }

  const [origin, preview] = await Promise.all([
    resolveSiteOrigin(view, {
      publicOrigin: cms.env.publicOrigin,
      fixture: cms.mode === 'fixture',
    }),
    isPreviewActive(descriptor.domain),
  ])

  return {
    ...view,
    site: descriptor,
    settings,
    settingsDiagnostics: diagnostics,
    bindings: readBindings(descriptor.themeRuntime?.bindings),
    themeKey,
    origin,
    preview,
  }
})
```

- [ ] **Step 8: Write `src/cms/queries.ts`**

```ts
import 'server-only'

import { cmsFetchOptional } from './client'
import type { FooterGlobal, Form, HeaderGlobal, Page, Paginated } from './types'

export type ReadOptions = { locale: string; drafts?: boolean }

const single = <T>(result: Paginated<T> | null): T | null => result?.docs?.[0] ?? null

export async function getPageBySlug(slug: string, options: ReadOptions): Promise<Page | null> {
  const result = await cmsFetchOptional<Paginated<Page>>('/api/pages', {
    query: {
      locale: options.locale,
      fallbackLocale: 'false',
      depth: 2,
      'where[slug][equals]': slug,
      limit: 1,
    },
    locale: options.locale,
    resource: 'page',
    drafts: options.drafts,
  })
  return single(result)
}

export async function getPageById(id: string, options: ReadOptions): Promise<Page | null> {
  const result = await cmsFetchOptional<Paginated<Page>>('/api/pages', {
    query: {
      locale: options.locale,
      fallbackLocale: 'false',
      depth: 2,
      'where[id][equals]': id,
      limit: 1,
    },
    locale: options.locale,
    resource: 'page',
    drafts: options.drafts,
  })
  return single(result)
}

/** Globals are collections with `isGlobal`; the response is still a paginated envelope. */
export async function getHeader(locale: string): Promise<HeaderGlobal | null> {
  const result = await cmsFetchOptional<Paginated<HeaderGlobal>>('/api/header', {
    query: { locale, depth: 1 },
    locale,
    resource: 'navigation',
    publishFilter: false,
  })
  return single(result)
}

export async function getFooter(locale: string): Promise<FooterGlobal | null> {
  const result = await cmsFetchOptional<Paginated<FooterGlobal>>('/api/footer', {
    query: { locale, depth: 1 },
    locale,
    resource: 'navigation',
    publishFilter: false,
  })
  return single(result)
}

/** Forms carry no publish status; a 404 is a form the editor did not publish. */
export async function getFormById(id: string, options: ReadOptions): Promise<Form | null> {
  const result = await cmsFetchOptional<Paginated<Form>>('/api/forms', {
    query: { locale: options.locale, depth: 1, 'where[id][equals]': id, limit: 1 },
    locale: options.locale,
    resource: 'form',
    publishFilter: false,
  })
  return single(result)
}
```

- [ ] **Step 9: Write the fixture test**

`tests/unit/fixture.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fixtureResponse } from '@/cms/fixture'
import { readSiteView, readBindings } from '@/cms/site'
import type { SiteDescriptor } from '@/cms/types'

const siteResult = fixtureResponse('/api/site', {})
const descriptor = siteResult.data as SiteDescriptor

describe('fixture provider', () => {
  it('serves a valid descriptor bound to the demo theme', () => {
    expect(siteResult.status).toBe(200)
    expect(descriptor.contractVersion).toBe(1)
    expect(descriptor.themeRuntime?.theme?.key).toBe('eshobe-corporation')
    expect(descriptor.availableLocales).toEqual(['fa', 'en'])
  })

  it('resolves pages by slug and locale only', () => {
    const fa = fixtureResponse('/api/pages', { locale: 'fa', 'where[slug][equals]': 'home' }).data as {
      docs: { id: string; title: string }[]
    }
    const en = fixtureResponse('/api/pages', { locale: 'en', 'where[slug][equals]': 'home' }).data as {
      docs: { id: string; title: string }[]
    }
    expect(fa.docs).toHaveLength(1)
    expect(en.docs).toHaveLength(1)
    expect(fa.docs[0]?.id).toBe('home')
    expect(en.docs[0]?.title).not.toBe(fa.docs[0]?.title)
    expect(
      (fixtureResponse('/api/pages', { locale: 'en', 'where[slug][equals]': 'missing' }).data as { docs: unknown[] }).docs,
    ).toHaveLength(0)
  })

  it('serves localized navigation singletons and the demo form', () => {
    const header = fixtureResponse('/api/header', { locale: 'fa' }).data as { docs: { navItems: unknown[] }[] }
    expect(header.docs[0]?.navItems).toHaveLength(3)
    const form = fixtureResponse('/api/forms', { locale: 'fa', 'where[id][equals]': 'demo-form' }).data as {
      docs: { fields: { name: string }[] }[]
    }
    expect(form.docs[0]?.fields.some((field) => field.name === 'consent')).toBe(true)
  })

  it('validates the fixture descriptor like a real one', () => {
    const view = readSiteView(descriptor, true)
    expect(view.status).toBe('active')
    expect(view.defaultLocale).toBe('fa')
    expect(view.locales).toEqual(['fa', 'en'])
    expect(view.mediaOrigin).toBe('')
  })

  it('keeps only known binding fields', () => {
    expect(readBindings({ home: { id: 7, slug: 'home', hostile: '<script>' } })).toEqual({
      home: { id: '7', type: null, slug: 'home', title: null },
    })
    expect(readBindings(null)).toEqual({})
  })
})
```

- [ ] **Step 10: Run tests and typecheck**

Run: `pnpm vitest run tests/unit/site-settings.test.ts tests/unit/preview.test.ts tests/unit/fixture.test.ts && pnpm typecheck`
Expected: PASS. Confirm all eight page JSON files exist and are valid JSON (`node -e "..."` or the test's pageFiles read).

- [ ] **Step 11: Commit**

```bash
git add src/lib/theme/settings.ts src/cms/site.ts src/cms/queries.ts src/cms/preview.ts src/cms/fixture.ts demo-packs tests/unit/site-settings.test.ts tests/unit/preview.test.ts tests/unit/fixture.test.ts
git commit -m "feat: add fixture CMS, theme settings and tenant-aware queries"
```

---

### Task 7: Locale-aware route resolution and navigation links

**Files:**
- Create: `src/lib/routing.ts`, `src/lib/nav.ts`
- Test: `tests/unit/routing.test.ts`, `tests/unit/nav.test.ts`

**Interfaces:**
- Produces: `ThemeSlot`, `RoutePlan`, `resolveRoute({ path, site, settings })`, `routeLocalePath(plan, locale, siteDefault)`.
- Produces: `normalizeNav(headerOrFooter, locale, siteDefault): NavLink[]`, `linkHref(rawLink, locale, siteDefault): string | null`.
- Consumes: `resolveSiteRoute`, `HOME_SLUG`, `isLocale`, `localeHref` (Task 2); `ThemeSettings` (Task 6).

- [ ] **Step 1: Write the route tests (failing first)**

`tests/unit/routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolveRoute } from '@/lib/routing'
import { DEFAULT_SETTINGS } from '@/lib/theme/settings'
import type { ThemeRuntime } from '@/cms/types'

const site = (overrides: Partial<{ availableLocales: string[]; defaultLocale: string; themeRuntime: ThemeRuntime | null }> = {}) => ({
  availableLocales: ['fa', 'en'],
  defaultLocale: 'fa',
  themeRuntime: {
    theme: { key: 'eshobe-corporation' },
    bindings: {
      home: { id: 'home-id' },
      restaurants: { id: 'rest-id' },
    },
  } as ThemeRuntime,
  ...overrides,
})

const settings = { ...DEFAULT_SETTINGS, demoSlug: 'book-a-demo' }

describe('resolveRoute', () => {
  it('resolves the bare home path with the default locale', () => {
    expect(resolveRoute({ path: [], site: site(), settings })).toEqual({
      kind: 'page',
      locale: 'fa',
      slot: 'home',
      pageRef: { id: 'home-id' },
      publicPath: '/',
      landing: true,
    })
  })

  it('resolves an English home path', () => {
    const plan = resolveRoute({ path: ['en'], site: site(), settings })
    expect(plan).toMatchObject({ kind: 'page', locale: 'en', slot: 'home', publicPath: '/' })
  })

  it('redirects a default-locale prefix to the canonical unprefixed URL', () => {
    expect(resolveRoute({ path: ['fa', 'pricing'], site: site(), settings })).toEqual({
      kind: 'redirect',
      to: '/pricing',
    })
    expect(resolveRoute({ path: ['fa', 'en'], site: site(), settings })).toEqual({
      kind: 'redirect',
      to: '/en',
    })
  })

  it('404s a locale the site does not serve', () => {
    expect(resolveRoute({ path: ['en', 'pricing'], site: site({ availableLocales: ['fa'] }), settings })).toEqual({ kind: 'not-found' })
  })

  it('resolves theme routes by their configured slug and binding id', () => {
    const plan = resolveRoute({ path: ['en', 'restaurants'], site: site(), settings })
    expect(plan).toMatchObject({
      kind: 'page',
      locale: 'en',
      slot: 'restaurants',
      pageRef: { id: 'rest-id' },
      publicPath: '/restaurants',
      landing: true,
    })
  })

  it('uses the theme setting slug when no binding exists', () => {
    const plan = resolveRoute({ path: ['book-a-demo'], site: site(), settings })
    expect(plan).toMatchObject({ slot: 'demo', pageRef: { slug: 'book-a-demo' }, publicPath: '/book-a-demo' })
  })

  it('falls back to the platform home slug when the home binding is absent', () => {
    const plan = resolveRoute({
      path: [],
      site: site({ themeRuntime: { theme: { key: 'eshobe-corporation' } } }),
      settings,
    })
    expect(plan).toMatchObject({ slot: 'home', pageRef: { slug: 'home' }, publicPath: '/' })
  })

  it('resolves a generic CMS page and refuses reserved segments', () => {
    expect(resolveRoute({ path: ['en', 'legal', 'terms'], site: site(), settings })).toMatchObject({
      kind: 'page',
      slot: null,
      pageRef: { slug: 'legal/terms' },
      publicPath: '/legal/terms',
    })
    expect(resolveRoute({ path: ['posts'], site: site(), settings })).toEqual({ kind: 'not-found' })
    expect(resolveRoute({ path: ['search'], site: site(), settings })).toEqual({ kind: 'not-found' })
  })

  it('builds localized URLs for metadata and the locale switch', () => {
    const plan = resolveRoute({ path: ['en', 'pricing'], site: site(), settings })
    expect(routeLocalePath(plan, 'fa', 'fa')).toBe('/pricing')
    expect(routeLocalePath(plan, 'en', 'fa')).toBe('/en/pricing')
  })
})
```

- [ ] **Step 2: Write the nav test (failing first)**

`tests/unit/nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { linkHref, normalizeNav } from '@/lib/nav'

describe('CMS nav links', () => {
  it('localizes internal custom links and leaves external links alone', () => {
    expect(linkHref({ type: 'custom', url: '/pricing', label: 'Pricing' }, 'en', 'fa')).toBe('/en/pricing')
    expect(linkHref({ type: 'custom', url: '/pricing', label: 'Pricing' }, 'fa', 'fa')).toBe('/pricing')
    expect(linkHref({ type: 'custom', url: 'https://biza.example/x', label: 'Biza' }, 'en', 'fa')).toBe('https://biza.example/x')
    expect(linkHref({ type: 'custom', url: 'javascript:alert(1)', label: 'x' }, 'fa', 'fa')).toBeNull()
  })

  it('resolves a populated page reference through its slug', () => {
    expect(
      linkHref(
        { type: 'reference', reference: { relationTo: 'pages', value: { id: '1', slug: 'home' } }, label: 'Home' },
        'en',
        'fa',
      ),
    ).toBe('/en')
    expect(
      linkHref(
        { type: 'reference', reference: { relationTo: 'pages', value: { id: '1', slug: 'features' } }, label: 'Features' },
        'fa',
        'fa',
      ),
    ).toBe('/features')
  })

  it('drops unusable links and labels', () => {
    expect(normalizeNav({ navItems: [{ link: { type: 'custom', url: '/x' } }, { link: { type: 'custom', url: '/y', label: 'Y' } }] }, 'fa', 'fa')).toEqual([
      { href: '/y', label: 'Y', newTab: false },
    ])
    expect(normalizeNav(null, 'fa', 'fa')).toEqual([])
  })
})
```

- [ ] **Step 3: Run and confirm failure**

Run: `pnpm vitest run tests/unit/routing.test.ts tests/unit/nav.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 4: Write `src/lib/routing.ts`**

```ts
import {
  HOME_SLUG,
  isLocale,
  localeHref,
  resolveSiteRoute,
  type Locale,
} from '@eshobe/site-runtime'

import type { ThemeRuntime } from '@/cms/types'
import type { ThemeSettings } from '@/lib/theme/settings'

export type ThemeSlot = 'home' | 'restaurants' | 'pricing' | 'features' | 'demo'

type SiteRouteInput = {
  availableLocales: string[]
  defaultLocale: string
  themeRuntime?: ThemeRuntime | null
}

export type RoutePlan =
  | { kind: 'redirect'; to: string }
  | { kind: 'not-found' }
  | {
      kind: 'page'
      locale: Locale
      slot: ThemeSlot | null
      pageRef: { id: string } | { slug: string }
      publicPath: string
      landing: boolean
    }

const SLOT_ORDER: readonly Exclude<ThemeSlot, 'home'>[] = ['restaurants', 'features', 'pricing', 'demo']

const slugFor = (slot: ThemeSlot, settings: ThemeSettings): string => {
  switch (slot) {
    case 'home':
      return HOME_SLUG
    case 'restaurants':
      return settings.restaurantsSlug
    case 'pricing':
      return settings.pricingSlug
    case 'features':
      return settings.featuresSlug
    case 'demo':
      return settings.demoSlug
  }
}

/**
 * One resolver for theme routes, CMS pages and locale prefixes. Kept pure so the
 * two-URLs-for-one-page class of bug is unit-testable.
 */
export function resolveRoute(input: {
  path: string[]
  site: SiteRouteInput
  settings: ThemeSettings
}): RoutePlan {
  const available = input.site.availableLocales.filter(isLocale)
  const declared = input.site.defaultLocale
  const siteDefault: Locale =
    isLocale(declared) && available.includes(declared)
      ? declared
      : (available[0] ?? 'fa')

  const first = input.path[0]
  let locale: Locale = siteDefault
  let rest = input.path

  if (isLocale(first)) {
    if (!available.includes(first)) return { kind: 'not-found' }
    if (first === siteDefault) {
      const remaining = input.path.slice(1)
      return { kind: 'redirect', to: remaining.length === 0 ? '/' : `/${remaining.join('/')}` }
    }
    locale = first
    rest = input.path.slice(1)
  }

  if (rest.length === 0) {
    const binding = input.site.themeRuntime?.bindings?.home ?? null
    const pageRef = binding?.id
      ? { id: binding.id }
      : { slug: typeof binding?.slug === 'string' && binding.slug !== '' ? binding.slug : HOME_SLUG }
    return { kind: 'page', locale, slot: 'home', pageRef, publicPath: '/', landing: true }
  }

  if (rest.length === 1) {
    const segment = rest[0] as string
    const slot = SLOT_ORDER.find((candidate) => slugFor(candidate, input.settings) === segment)
    if (slot) {
      const binding = input.site.themeRuntime?.bindings?.[slot] ?? null
      const pageRef = binding?.id
        ? { id: binding.id }
        : {
            slug:
              typeof binding?.slug === 'string' && binding.slug !== ''
                ? binding.slug
                : slugFor(slot, input.settings),
          }
      return {
        kind: 'page',
        locale,
        slot,
        pageRef,
        publicPath: `/${segment}`,
        landing: true,
      }
    }
  }

  const siteRoute = resolveSiteRoute(rest)
  if (siteRoute.kind !== 'page') return { kind: 'not-found' }

  return {
    kind: 'page',
    locale,
    slot: null,
    pageRef: { slug: siteRoute.slug },
    publicPath: `/${siteRoute.slug}`,
    landing: false,
  }
}

export function routeLocalePath(plan: RoutePlan, locale: Locale, siteDefault: string): string | null {
  if (plan.kind !== 'page') return null
  return localeHref(plan.publicPath, locale, siteDefault)
}
```

- [ ] **Step 5: Write `src/lib/nav.ts`**

```ts
import { HOME_SLUG, localeHref } from '@eshobe/site-runtime'

import type { CmsLink, FooterGlobal, HeaderGlobal } from '@/cms/types'

export type NavLink = { href: string; label: string; newTab: boolean }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const safeUrl = (value: string): string | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  try {
    const url = new URL(trimmed)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

/** CMS link → href. Reference links use the populated page slug; ids alone cannot route. */
export function linkHref(raw: unknown, locale: string, siteDefault: string): string | null {
  if (!isRecord(raw)) return null
  const link = raw as CmsLink

  if (link.type === 'custom') {
    const safe = typeof link.url === 'string' ? safeUrl(link.url) : null
    if (!safe) return null
    if (/^[a-z][a-z0-9+.-]*:/i.test(safe) || safe.startsWith('//')) return safe
    return localeHref(safe, locale, siteDefault)
  }

  if (link.type === 'reference') {
    const value = link.reference?.value
    if (isRecord(value) && typeof value.slug === 'string') {
      const slug = value.slug === HOME_SLUG || value.slug === '' ? '/' : `/${value.slug}`
      return localeHref(slug, locale, siteDefault)
    }
  }

  return null
}

export function normalizeNav(
  global: HeaderGlobal | FooterGlobal | null | undefined,
  locale: string,
  siteDefault: string,
): NavLink[] {
  const items = Array.isArray(global?.navItems) ? global.navItems : []
  const links: NavLink[] = []
  for (const item of items) {
    const raw = isRecord(item) ? item.link : null
    const href = linkHref(raw, locale, siteDefault)
    const label = isRecord(raw) && typeof raw.label === 'string' ? raw.label.trim() : ''
    if (!href || label === '') continue
    links.push({
      href,
      label,
      newTab: isRecord(raw) && raw.newTab === true,
    })
  }
  return links
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm vitest run tests/unit/routing.test.ts tests/unit/nav.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/routing.ts src/lib/nav.ts tests/unit/routing.test.ts tests/unit/nav.test.ts
git commit -m "feat: add locale-aware route resolver and CMS navigation normalization"
```

---

### Task 8: Root layout, middleware, header, footer and theme switch

**Files:**
- Create: `middleware.ts`
- Create: `src/lib/i18n.ts`
- Create: `src/components/site-header.tsx`, `src/components/site-footer.tsx`, `src/components/mobile-menu.tsx`, `src/components/theme-toggle.tsx`, `src/components/locale-switch.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/unit/i18n.test.ts`

**Interfaces:**
- Produces: `uiStrings(locale)` with all theme-owned UI copy (no marketing claims).
- Produces: `SiteHeader({ site, locale, nav, alternateLocale })` and `SiteFooter({ site, locale, nav })`, both server components except their client islands.
- Produces: `data-theme` on `<html>` before first paint; localStorage key `eshobe-theme`.

- [ ] **Step 1: Write the i18n test (failing first)**

`tests/unit/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { uiStrings } from '@/lib/i18n'

describe('UI strings', () => {
  it('provides both locales with identical keys', () => {
    const fa = uiStrings('fa')
    const en = uiStrings('en')
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort())
    expect(fa.skipToContent).toBe('رفتن به محتوای اصلی')
    expect(en.skipToContent).toBe('Skip to content')
  })

  it('keeps pricing and contact labels honest', () => {
    expect(uiStrings('fa').priceNotPublished).toContain('ثبت نشده')
    expect(uiStrings('en').priceNotPublished.toLowerCase()).toContain('not published')
    expect(uiStrings('fa').formError).not.toBe('')
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run tests/unit/i18n.test.ts`
Expected: FAIL — `src/lib/i18n.ts` missing.

- [ ] **Step 3: Write `src/lib/i18n.ts`**

```ts
import type { Locale } from '@eshobe/site-runtime'

export type UiStrings = {
  skipToContent: string
  openMenu: string
  closeMenu: string
  menuTitle: string
  menuDescription: string
  theme: string
  themeLight: string
  themeDark: string
  switchToLight: string
  switchToDark: string
  language: string
  persian: string
  english: string
  priceNotPublished: string
  featuredPlan: string
  formRequired: string
  formInvalidEmail: string
  formInvalidNumber: string
  formSubmit: string
  formSubmitting: string
  formSuccess: string
  formError: string
  formRetry: string
  formConsentRequired: string
  honeypotLabel: string
  illustrationLabel: string
  contactPhone: string
  contactEmail: string
  contactHours: string
  contactAddress: string
  contactMap: string
  rights: string
  expected: string
  outageTitle: string
  outageBody: string
  outageRetry: string
  notFoundTitle: string
  notFoundBody: string
  notFoundHome: string
  holdingTitle: string
  holdingBody: string
  errorTitle: string
  errorBody: string
}

const fa: UiStrings = {
  skipToContent: 'رفتن به محتوای اصلی',
  openMenu: 'باز کردن منو',
  closeMenu: 'بستن منو',
  menuTitle: 'منو',
  menuDescription: 'پیوندهای اصلی سایت',
  theme: 'پوسته',
  themeLight: 'روشن',
  themeDark: 'تاریک',
  switchToLight: 'تغییر به پوستهٔ روشن',
  switchToDark: 'تغییر به پوستهٔ تاریک',
  language: 'زبان',
  persian: 'فارسی',
  english: 'English',
  priceNotPublished: 'قیمت در CMS ثبت نشده است',
  featuredPlan: 'طرح پیشنهادی',
  formRequired: 'این فیلد الزامی است.',
  formInvalidEmail: 'نشانی رایانامه معتبر نیست.',
  formInvalidNumber: 'یک عدد معتبر وارد کنید.',
  formSubmit: 'ارسال',
  formSubmitting: 'در حال ارسال…',
  formSuccess: 'درخواست شما ثبت شد.',
  formError: 'ارسال نشد. لطفاً دوباره تلاش کنید.',
  formRetry: 'تلاش دوباره',
  formConsentRequired: 'برای ادامه، رضایت خود را تأیید کنید.',
  honeypotLabel: 'این فیلد را خالی بگذارید',
  illustrationLabel: 'نمونهٔ تصویری',
  contactPhone: 'تلفن',
  contactEmail: 'رایانامه',
  contactHours: 'ساعات کاری',
  contactAddress: 'نشانی',
  rights: 'همهٔ حقوق محفوظ است.',
  expected: 'انتظار می‌رفت',
  outageTitle: 'فعلاً نمی‌توانیم این صفحه را نشان دهیم',
  outageBody: 'اتصال به CMS برقرار نشد. محتوای ذخیره‌شده در دسترس نبود؛ لطفاً کمی بعد دوباره تلاش کنید.',
  outageRetry: 'تلاش دوباره',
  notFoundTitle: 'این صفحه پیدا نشد',
  notFoundBody: 'نشانی ممکن است تغییر کرده باشد یا صفحه هنوز منتشر نشده باشد.',
  notFoundHome: 'بازگشت به صفحهٔ اصلی',
  holdingTitle: 'این سایت موقتاً در دسترس نیست',
  holdingBody: 'برای اطلاعات بیشتر با صاحب سایت تماس بگیرید.',
  errorTitle: 'خطایی رخ داد',
  errorBody: 'بارگذاری این بخش کامل نشد. لطفاً دوباره تلاش کنید.',
}

const en: UiStrings = {
  skipToContent: 'Skip to content',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  menuTitle: 'Menu',
  menuDescription: 'Main site links',
  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  switchToLight: 'Switch to light theme',
  switchToDark: 'Switch to dark theme',
  language: 'Language',
  persian: 'فارسی',
  english: 'English',
  priceNotPublished: 'Price not published in the CMS',
  featuredPlan: 'Featured plan',
  formRequired: 'This field is required.',
  formInvalidEmail: 'Enter a valid email address.',
  formInvalidNumber: 'Enter a valid number.',
  formSubmit: 'Send',
  formSubmitting: 'Sending…',
  formSuccess: 'Your request was received.',
  formError: 'Could not send. Please try again.',
  formRetry: 'Try again',
  formConsentRequired: 'Please confirm consent to continue.',
  honeypotLabel: 'Leave this field empty',
  illustrationLabel: 'Illustrative preview',
  contactPhone: 'Phone',
  contactEmail: 'Email',
  contactHours: 'Hours',
  contactAddress: 'Address',
  rights: 'All rights reserved.',
  expected: 'Expected',
  outageTitle: 'We cannot show this page right now',
  outageBody: 'The CMS could not be reached and no cached content was available. Please try again shortly.',
  outageRetry: 'Try again',
  notFoundTitle: 'This page was not found',
  notFoundBody: 'The address may have changed, or the page has not been published yet.',
  notFoundHome: 'Back to home',
  holdingTitle: 'This site is temporarily unavailable',
  holdingBody: 'Please contact the site owner for more information.',
  errorTitle: 'Something went wrong',
  errorBody: 'This section did not finish loading. Please try again.',
}

export const uiStrings = (locale: string): UiStrings => (locale === 'fa' ? fa : en)
```

- [ ] **Step 4: Write `middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { isLocale } from '@eshobe/site-runtime'

/**
 * The root layout needs a locale before the page resolves its own route. This header is
 * a hint only: routing validates it against the site's advertised locales.
 */
export function middleware(request: NextRequest) {
  const first = request.nextUrl.pathname.split('/').filter(Boolean)[0]
  const prefix = isLocale(first) ? first : ''
  const headers = new Headers(request.headers)
  headers.set('x-theme-locale-prefix', prefix)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|fonts|demo|favicon.ico|.*\\..*).*)'],
}
```

- [ ] **Step 5: Write the header, footer and client islands**

`src/components/theme-toggle.tsx`:

```tsx
'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

import { uiStrings } from '@/lib/i18n'

export function ThemeToggle({ locale }: { locale: string }) {
  const strings = uiStrings(locale)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    setTheme(current)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('eshobe-theme', next)
    } catch {
      // Storage can be blocked; the in-memory toggle still works for this page.
    }
  }

  const label = theme === 'dark' ? strings.switchToLight : strings.switchToDark
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-canvas-soft-2"
    >
      {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
    </button>
  )
}
```

`src/components/locale-switch.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { type Locale } from '@eshobe/site-runtime'

export function LocaleSwitch({
  locales,
  defaultLocale,
  current,
  label,
}: {
  locales: Locale[]
  defaultLocale: string
  current: string
  label: string
}) {
  const pathname = usePathname() ?? '/'
  const segments = pathname.split('/').filter(Boolean)
  const bare = locales.includes(segments[0] as Locale) && segments[0] !== defaultLocale
    ? segments.slice(1)
    : segments
  const base = bare.length === 0 ? '/' : `/${bare.join('/')}`

  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {locales.map((locale) => {
        const href = locale === defaultLocale ? base : `/${locale}${base === '/' ? '' : base}`
        const active = locale === current
        return (
          <Link
            key={locale}
            href={href}
            hrefLang={locale}
            aria-current={active ? 'true' : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm ${
              active ? 'bg-canvas-soft-2 font-medium text-ink' : 'text-mute hover:text-ink'
            }`}
          >
            {locale === 'fa' ? 'فارسی' : 'EN'}
          </Link>
        )
      })}
    </nav>
  )
}
```

`src/components/mobile-menu.tsx`:

```tsx
'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import type { NavLink } from '@/lib/nav'
import { uiStrings } from '@/lib/i18n'

export function MobileMenu({ links, locale }: { links: NavLink[]; locale: string }) {
  const strings = uiStrings(locale)
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={strings.openMenu}
          className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-canvas-soft-2 md:hidden"
        >
          <Menu aria-hidden="true" size={20} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" />
        <Dialog.Content className="fixed inset-y-0 end-0 z-50 flex w-[min(22rem,90vw)] flex-col gap-6 border-s border-hairline bg-canvas p-6 shadow-l4 md:hidden">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{strings.menuTitle}</Dialog.Title>
            <Dialog.Description className="sr-only">{strings.menuDescription}</Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={strings.closeMenu}
                className="inline-flex size-11 items-center justify-center rounded-full hover:bg-canvas-soft-2"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </Dialog.Close>
          </div>
          <nav aria-label={strings.menuTitle} className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                target={link.newTab ? '_blank' : undefined}
                rel={link.newTab ? 'noreferrer noopener' : undefined}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-3 text-base hover:bg-canvas-soft-2"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

`src/components/site-header.tsx`:

```tsx
import Link from 'next/link'

import { LocaleSwitch } from '@/components/locale-switch'
import { MobileMenu } from '@/components/mobile-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { normalizeNav } from '@/lib/nav'
import { uiStrings } from '@/lib/i18n'
import { localeHref, type Locale } from '@eshobe/site-runtime'
import type { HeaderGlobal } from '@/cms/types'

export function SiteHeader({
  name,
  header,
  locale,
  locales,
  defaultLocale,
}: {
  name: string
  header: HeaderGlobal | null
  locale: Locale
  locales: Locale[]
  defaultLocale: string
}) {
  const strings = uiStrings(locale)
  const links = normalizeNav(header, locale, defaultLocale)
  const homeHref = localeHref('/', locale, defaultLocale)

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileMenu links={links} locale={locale} />
          <Link href={homeHref} className="text-base font-semibold tracking-tight">
            {name}
          </Link>
        </div>
        <nav aria-label={strings.menuTitle} className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              target={link.newTab ? '_blank' : undefined}
              rel={link.newTab ? 'noreferrer noopener' : undefined}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-body hover:bg-canvas-soft-2 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <LocaleSwitch locales={locales} defaultLocale={defaultLocale} current={locale} label={strings.language} />
          <ThemeToggle locale={locale} />
        </div>
      </div>
    </header>
  )
}
```

`src/components/site-footer.tsx`:

```tsx
import Link from 'next/link'

import { formatNumber, localeHref, type Locale } from '@eshobe/site-runtime'
import type { FooterGlobal } from '@/cms/types'
import { normalizeNav } from '@/lib/nav'
import { uiStrings } from '@/lib/i18n'

export function SiteFooter({
  name,
  footer,
  locale,
  defaultLocale,
}: {
  name: string
  footer: FooterGlobal | null
  locale: Locale
  defaultLocale: string
}) {
  const strings = uiStrings(locale)
  const links = normalizeNav(footer, locale, defaultLocale)
  const year = formatNumber(new Date().getFullYear(), locale, { useGrouping: false })

  return (
    <footer className="border-t border-hairline bg-canvas-soft">
      <div className="container-page flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Link href={localeHref('/', locale, defaultLocale)} className="text-base font-semibold">
            {name}
          </Link>
          <p className="mt-2 text-sm text-mute">
            © {year} {name} — {strings.rights}
          </p>
        </div>
        <nav aria-label={strings.menuTitle} className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          {links.map((link) => (
            <Link key={`${link.href}-${link.label}`} href={link.href} className="min-h-11 py-2 text-body hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
```

- [ ] **Step 6: Replace `src/app/layout.tsx`**

```tsx
import '@fontsource-variable/jetbrains-mono'
import '@/styles/globals.css'

import { headers } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import {
  defaultLocale as runtimeDefaultLocale,
  dirFor,
  isLocale,
  type Locale,
} from '@eshobe/site-runtime'
import { themeCss } from '@eshobe/site-runtime/theme'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getHeader, getFooter } from '@/cms/queries'
import { getSiteContext, type SiteContext } from '@/cms/site'
import { fontPreloadHrefs } from '@/lib/fonts'
import { uiStrings } from '@/lib/i18n'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

const noFlashTheme = `(function(){try{var t=localStorage.getItem('eshobe-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`

async function safeSite(): Promise<SiteContext | null> {
  try {
    return await getSiteContext()
  } catch {
    // The page owns the loud failure (contract mismatch, outage, 404). The document
    // shell must stay well-formed so those states can render inside it.
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await safeSite()
  const strings = uiStrings('fa')
  return {
    title: site?.site.name ?? strings.holdingTitle,
    ...(site && site.status === 'active' ? {} : { robots: { index: false, follow: false, nocache: true } }),
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [site, incoming] = await Promise.all([safeSite(), headers()])
  const prefix = incoming.get('x-theme-locale-prefix')
  const locale: Locale =
    prefix && isLocale(prefix) && (site?.locales.includes(prefix) ?? false)
      ? prefix
      : site?.defaultLocale ?? runtimeDefaultLocale
  const css = site?.site.theme ? themeCss(site.site.theme) : ''
  const [header, footer] = site
    ? await Promise.all([
        getHeader(locale).catch(() => null),
        getFooter(locale).catch(() => null),
      ])
    : [null, null]
  const strings = uiStrings(locale)

  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        {fontPreloadHrefs.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
        {css !== '' ? <style id="site-theme" dangerouslySetInnerHTML={{ __html: css }} /> : null}
      </head>
      <body className="min-h-dvh bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-canvas focus:px-4 focus:py-2 focus:shadow-l3"
        >
          {strings.skipToContent}
        </a>
        {site ? (
          <SiteHeader
            name={site.site.name}
            header={header}
            locale={locale}
            locales={site.locales}
            defaultLocale={site.defaultLocale}
          />
        ) : null}
        {children}
        {site ? (
          <SiteFooter
            name={site.site.name}
            footer={footer}
            locale={locale}
            defaultLocale={site.defaultLocale}
          />
        ) : null}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Run tests, typecheck, lint and a fixture build**

Run:
```bash
pnpm vitest run tests/unit/i18n.test.ts
pnpm typecheck && pnpm lint
ESHOBE_FIXTURE=1 pnpm build
```
Expected: PASS and a build that renders the layout against fixtures. Fix any logical-property lint error by switching to `ms/me/ps/pe/start/end`.

- [ ] **Step 8: Commit**

```bash
git add middleware.ts src/lib/i18n.ts src/components src/app/layout.tsx tests/unit/i18n.test.ts
git commit -m "feat: add themed shell, RTL navigation, locale switch and no-flash theme toggle"
```

---

### Task 9: UI primitives, media helpers, rich text and reveal

**Files:**
- Create: `src/lib/cn.ts`, `src/lib/media.ts`, `src/components/ui/{button,badge,eyebrow,section-header}.tsx`
- Create: `src/components/rich-text.tsx`, `src/components/reveal.tsx`, `src/components/media-image.tsx`
- Test: `tests/unit/media.test.ts`, `tests/unit/rich-text.test.tsx`

**Interfaces:**
- Produces: `cn(...)`, `ButtonLink` (`anchor`), `Button` (`button`, `variant: primary | secondary | ghost`, `size: sm | md | lg`), `Badge`, `Eyebrow`, `SectionHeader`.
- Produces: `mediaSrc(media, origin): string | null`, `mediaDimensions(media)`, `MediaImage`.
- Produces: `RichText({ data, className, mediaOrigin })` with no `dangerouslySetInnerHTML`.
- Produces: `Reveal` client island (IntersectionObserver, reduced-motion aware).

- [ ] **Step 1: Write media tests (failing first)**

`tests/unit/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mediaSrc, mediaDimensions } from '@/lib/media'

describe('media resolution', () => {
  it('keeps same-origin proxy paths and strips a CMS host', () => {
    expect(mediaSrc({ id: 1, url: '/api/media/file/a.png' }, 'https://cms.example.test')).toBe('/api/media/file/a.png')
    expect(mediaSrc({ id: 1, url: 'https://cms.example.test/api/media/file/a.png' }, 'https://cms.example.test')).toBe('/api/media/file/a.png')
    expect(mediaSrc({ id: 1, url: '/demo/dashboard.png' }, '')).toBe('/demo/dashboard.png')
  })

  it('refuses off-origin media and missing urls', () => {
    expect(mediaSrc({ id: 1, url: 'https://evil.example/x.png' }, 'https://cms.example.test')).toBeNull()
    expect(mediaSrc({ id: 1 }, 'https://cms.example.test')).toBeNull()
    expect(mediaSrc(null, 'https://cms.example.test')).toBeNull()
  })

  it('reads intrinsic dimensions only when both are positive', () => {
    expect(mediaDimensions({ id: 1, width: 1600, height: 900 })).toEqual({ width: 1600, height: 900 })
    expect(mediaDimensions({ id: 1, width: 1600 })).toBeNull()
    expect(mediaDimensions({ id: 1, width: 0, height: 10 })).toBeNull()
  })
})
```

- [ ] **Step 2: Write the rich-text test (failing first)**

`tests/unit/rich-text.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RichText } from '@/components/rich-text'

const data = {
  root: {
    type: 'root',
    children: [
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'عنوان' }] },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'متن ' },
          { type: 'text', text: 'پررنگ', format: 1 },
          { type: 'link', fields: { url: '/pricing' }, children: [{ type: 'text', text: ' تعرفه' }] },
        ],
      },
      { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [{ type: 'text', text: 'یک' }] }] },
    ],
  },
}

describe('RichText', () => {
  it('renders headings, emphasis, internal links and lists without raw HTML', () => {
    const html = renderToStaticMarkup(<RichText data={data} />)
    expect(html).toContain('<h2')
    expect(html).toContain('<strong>')
    expect(html).toContain('href="/pricing"')
    expect(html).toContain('<ul>')
    expect(html).toContain('bidi-plaintext')
  })

  it('drops unsafe link protocols and empty trees', () => {
    const unsafe = {
      root: {
        children: [
          { type: 'link', fields: { url: 'javascript:alert(1)' }, children: [{ type: 'text', text: 'x' }] },
        ],
      },
    }
    const html = renderToStaticMarkup(<RichText data={unsafe} />)
    expect(html).not.toContain('javascript:')
    expect(renderToStaticMarkup(<RichText data={null} />)).toBe('')
  })
})
```

- [ ] **Step 3: Run and confirm failure**

Run: `pnpm vitest run tests/unit/media.test.ts tests/unit/rich-text.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 4: Write `src/lib/cn.ts` and `src/lib/media.ts`**

`src/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
```

`src/lib/media.ts`:

```ts
import type { Media } from '@/cms/types'

type MediaInput = Media | string | number | null | undefined

const asMedia = (value: MediaInput): Media | null =>
  value && typeof value === 'object' ? (value as Media) : null

/**
 * Same-origin media only. A CMS-provided absolute URL is reduced to its path so the
 * browser streams through this deployment's proxy; an off-origin host is refused.
 */
export function mediaSrc(value: MediaInput, mediaOrigin: string): string | null {
  const media = asMedia(value)
  const raw = typeof media?.url === 'string' ? media.url.trim() : ''
  if (raw === '') return null
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  let origin: string
  try {
    origin = mediaOrigin ? new URL(mediaOrigin).origin : ''
  } catch {
    return null
  }
  return origin !== '' && url.origin === origin ? `${url.pathname}${url.search}` : null
}

export function mediaDimensions(value: MediaInput): { width: number; height: number } | null {
  const media = asMedia(value)
  const width = typeof media?.width === 'number' ? media.width : 0
  const height = typeof media?.height === 'number' ? media.height : 0
  return width > 0 && height > 0 ? { width, height } : null
}

export const mediaAlt = (value: MediaInput): string => {
  const media = asMedia(value)
  return typeof media?.alt === 'string' ? media.alt : ''
}

export const isSvg = (value: MediaInput): boolean => {
  const media = asMedia(value)
  return typeof media?.mimeType === 'string' && media.mimeType.includes('svg')
}
```

- [ ] **Step 5: Write the UI primitives**

`src/components/ui/button.tsx`:

```tsx
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,box-shadow,transform] duration-200 ease-theme disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  {
    variants: {
      variant: {
        primary: 'btn-primary hover:opacity-90',
        secondary: 'border border-hairline-strong bg-canvas text-ink hover:bg-canvas-soft-2 rounded-[var(--radius-control)]',
        ghost: 'text-ink hover:bg-canvas-soft-2 rounded-[var(--radius-control)]',
      },
      size: {
        sm: 'min-h-11 px-4 text-sm',
        md: 'min-h-11 px-5 text-sm',
        lg: 'min-h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariants = VariantProps<typeof button>

export type ButtonLinkProps = ComponentProps<'a'> & ButtonVariants & { asChild?: boolean }

export function ButtonLink({ className, variant, size, asChild = false, ...props }: ButtonLinkProps) {
  const Component = asChild ? Slot : 'a'
  return <Component className={cn(button({ variant, size }), className)} {...props} />
}

export type ButtonProps = ComponentProps<'button'> & ButtonVariants

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...props} />
}
```

`src/components/ui/badge.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-hairline bg-canvas px-2.5 py-1 font-mono text-[11px] text-mute', className)}>
      {children}
    </span>
  )
}
```

`src/components/ui/eyebrow.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('font-mono text-xs uppercase tracking-[0.14em] text-mute', className)}>
      <span aria-hidden="true" className="me-2 inline-block size-1.5 rounded-full bg-accent align-middle" />
      {children}
    </p>
  )
}
```

`src/components/ui/section-header.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/ui/eyebrow'
import { cn } from '@/lib/cn'

export function SectionHeader({
  eyebrow,
  heading,
  intro,
  align = 'start',
  className,
}: {
  eyebrow?: string | null
  heading?: string | null
  intro?: string | null
  align?: 'start' | 'center'
  className?: string
}) {
  if (!heading && !intro && !eyebrow) return null
  return (
    <header className={cn('flex max-w-3xl flex-col gap-4', align === 'center' && 'mx-auto items-center text-center', className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {heading ? <h2 className="text-3xl tracking-tight text-ink md:text-4xl">{heading}</h2> : null}
      {intro ? <p className="text-lg text-body">{intro}</p> : null}
    </header>
  )
}
```

- [ ] **Step 6: Write `src/components/media-image.tsx`**

```tsx
import Image from 'next/image'

import type { Media } from '@/cms/types'
import { mediaAlt, mediaDimensions, mediaSrc, isSvg } from '@/lib/media'

export function MediaImage({
  media,
  mediaOrigin,
  sizes,
  className,
  priority = false,
}: {
  media: Media | string | number | null | undefined
  mediaOrigin: string
  sizes: string
  className?: string
  priority?: boolean
}) {
  const src = mediaSrc(media, mediaOrigin)
  if (!src) return null
  const alt = mediaAlt(media)
  const dimensions = mediaDimensions(media)

  if (!dimensions || isSvg(media)) {
    // An SVG must never be inlined; an unknown-size bitmap cannot use next/image.
    return <img src={src} alt={alt} className={className} loading={priority ? 'eager' : 'lazy'} decoding="async" />
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  )
}
```

- [ ] **Step 7: Write `src/components/rich-text.tsx`**

```tsx
import type { ReactNode } from 'react'

import type { LexicalElementNode, LexicalNode, LexicalTextNode, Media, RichText as RichTextData } from '@/cms/types'
import { MediaImage } from '@/components/media-image'
import { cn } from '@/lib/cn'

const safeHref = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  try {
    const url = new URL(trimmed)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

function renderText(node: LexicalTextNode, key: string): ReactNode {
  let content: ReactNode = node.text ?? ''
  const format = typeof node.format === 'number' ? node.format : 0
  if (format & 16) content = <code key={`${key}-code`}>{content}</code>
  if (format & 8) content = <u key={`${key}-u`}>{content}</u>
  if (format & 4) content = <s key={`${key}-s`}>{content}</s>
  if (format & 2) content = <em key={`${key}-em`}>{content}</em>
  if (format & 1) content = <strong key={`${key}-strong`}>{content}</strong>
  if (format & 32) content = <sub key={`${key}-sub`}>{content}</sub>
  if (format & 64) content = <sup key={`${key}-sup`}>{content}</sup>
  return <span key={key}>{content}</span>
}

function renderChildren(nodes: LexicalNode[] | undefined, mediaOrigin: string): ReactNode[] {
  if (!Array.isArray(nodes)) return []
  return nodes.map((node, index) => renderNode(node, `${index}`, mediaOrigin))
}

function renderNode(node: LexicalNode, key: string, mediaOrigin: string): ReactNode {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'text') return renderText(node, key)
  const element = node as LexicalElementNode

  switch (element.type) {
    case 'paragraph':
      return <p key={key}>{renderChildren(element.children, mediaOrigin)}</p>
    case 'heading': {
      const tag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.tag ?? '') ? element.tag! : 'h2'
      const Heading = tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return <Heading key={key}>{renderChildren(element.children, mediaOrigin)}</Heading>
    }
    case 'list': {
      const ordered = element.listType === 'number'
      return ordered
        ? <ol key={key}>{renderChildren(element.children, mediaOrigin)}</ol>
        : <ul key={key}>{renderChildren(element.children, mediaOrigin)}</ul>
    }
    case 'listitem':
      return <li key={key}>{renderChildren(element.children, mediaOrigin)}</li>
    case 'quote':
      return <blockquote key={key}>{renderChildren(element.children, mediaOrigin)}</blockquote>
    case 'link': {
      const href = safeHref(element.fields?.url)
      const children = renderChildren(element.children, mediaOrigin)
      if (!href) return <span key={key}>{children}</span>
      return (
        <a key={key} href={href} className="text-link underline decoration-hairline-strong underline-offset-4 hover:decoration-current" target={element.fields?.newTab === true ? '_blank' : undefined} rel={element.fields?.newTab === true ? 'noreferrer noopener' : undefined}>
          {children}
        </a>
      )
    }
    case 'linebreak':
      return <br key={key} />
    case 'horizontalrule':
      return <hr key={key} className="my-8 border-hairline" />
    case 'upload': {
      const value = element.value as Media | undefined
      return value ? (
        <span key={key} className="my-6 block">
          <MediaImage media={value} mediaOrigin={mediaOrigin} sizes="(min-width: 960px) 720px, 100vw" className="rounded-[var(--radius-control)]" />
        </span>
      ) : null
    }
    default:
      return <span key={key}>{renderChildren(element.children, mediaOrigin)}</span>
  }
}

export function RichText({
  data,
  className,
  mediaOrigin = '',
}: {
  data: RichTextData
  className?: string
  mediaOrigin?: string
}) {
  const children = data?.root?.children
  if (!Array.isArray(children) || children.length === 0) return null
  return (
    <div className={cn('rich-text bidi-plaintext flex flex-col gap-4 text-body [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:text-ink [&_h2]:text-ink [&_h3]:text-ink [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6 [&_blockquote]:border-s-2 [&_blockquote]:border-hairline-strong [&_blockquote]:ps-4 [&_code]:font-mono [&_code]:text-sm', className)}>
      {children.map((node, index) => renderNode(node, `${index}`, mediaOrigin))}
    </div>
  )
}
```

- [ ] **Step 8: Write `src/components/reveal.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Server-rendered and in-viewport content stays visible; only below-fold content is armed
  // after mount, so the page is never blank without JavaScript.
  const [armed, setArmed] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return

    setArmed(true)
    setVisible(false)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-reveal={armed ? (visible ? 'visible' : 'armed') : 'static'}
      style={{ transitionDelay: `${Math.min(delay, 80)}ms` }}
      className={cn(
        'motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-theme',
        armed && !visible ? 'motion-safe:translate-y-2 motion-safe:opacity-0' : 'motion-safe:translate-y-0 motion-safe:opacity-100',
        'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        className,
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 9: Run tests, typecheck and lint**

Run: `pnpm vitest run tests/unit/media.test.ts tests/unit/rich-text.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS. The rich-text test asserts the wrapper carries the `bidi-plaintext` class; the global stylesheet defines it.

- [ ] **Step 10: Commit**

```bash
git add src/lib/cn.ts src/lib/media.ts src/components tests/unit/media.test.ts tests/unit/rich-text.test.tsx
git commit -m "feat: add UI primitives, safe rich-text renderer, media helpers and reveal island"
```

---

### Task 10: Block vocabulary, normalization and the section planner

**Files:**
- Create: `src/blocks/vocabulary.ts`, `src/blocks/normalize.ts`, `src/blocks/plan.ts`
- Test: `tests/unit/section-plan.test.ts`

**Interfaces:**
- Produces: `BUSINESS_BLOCK_TYPES`, `BusinessBlockType`, `isBusinessBlockType(value)`.
- Produces: `asRecord`, `asString`, `asNumber`, `asBoolean`, `asArray`, `asMedia`, `asMediaList`, `readLink`, `readLinks`, `relationId`.
- Produces: `SectionKind`, `SectionSurface`, `SectionPlan`, `PlanDiagnostic`, `planSections(input)`.
- Consumes: `Block`, `Media`, `CmsLink` (Task 5); `linkHref` (Task 7); `ThemeSettings` (Task 6).

The planner is pure: it never fetches, logs or renders. It receives the descriptor's allowed
block list, so a block the *contract* knows but the tenant has not enabled is dropped as
`disallowed` rather than rendered.

- [ ] **Step 1: Write the failing tests**

`tests/unit/section-plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { planSections } from '@/blocks/plan'
import { readLinks, relationId } from '@/blocks/normalize'
import { DEFAULT_SETTINGS } from '@/lib/theme/settings'

const allowed = ['content', 'mediaBlock', 'cta', 'features', 'pricing', 'faq', 'testimonials']

const settings = {
  heroTreatment: DEFAULT_SETTINGS.heroTreatment,
  featureTreatment: DEFAULT_SETTINGS.featureTreatment,
  showcaseTreatment: DEFAULT_SETTINGS.showcaseTreatment,
}

describe('section planner', () => {
  it('assigns hero, showcase, band and deterministic surfaces on a landing page', () => {
    const layout = [
      { id: 'hero', blockType: 'cta', richText: null, links: [] },
      { id: 'shot', blockType: 'mediaBlock', media: null },
      { id: 'feat', blockType: 'features', items: [] },
      { id: 'price', blockType: 'pricing', plans: [] },
      { id: 'band', blockType: 'cta', richText: null, links: [] },
    ]
    const { sections, diagnostics } = planSections({ layout, allowed, landing: true, settings })

    expect(diagnostics).toEqual([])
    expect(sections.map((section) => `${section.key}:${section.kind}:${section.variant}:${section.surface}`)).toEqual([
      'hero:hero:mesh:canvas',
      'shot:showcase:mockup:ink',
      'feat:features:grid:canvas',
      'price:pricing:grid:canvas-soft',
      'band:cta-band:band:ink',
    ])
  })

  it('applies the manifest treatments and never treats a lone landing CTA as a band', () => {
    const { sections } = planSections({
      layout: [{ blockType: 'cta' }],
      allowed,
      landing: true,
      settings: { ...settings, heroTreatment: 'plain' },
    })
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ kind: 'hero', variant: 'plain' })

    const sticky = planSections({
      layout: [{ blockType: 'features', items: [] }],
      allowed,
      landing: false,
      settings: { ...settings, featureTreatment: 'sticky' },
    })
    expect(sticky.sections[0]).toMatchObject({ kind: 'features', variant: 'sticky' })
  })

  it('only makes the last CTA a band and uses editorial figures off the landing hero', () => {
    const { sections } = planSections({
      layout: [
        { blockType: 'content', columns: [] },
        { blockType: 'mediaBlock' },
        { blockType: 'cta' },
        { blockType: 'cta' },
      ],
      allowed,
      landing: false,
      settings,
    })
    expect(sections.map((section) => section.kind)).toEqual(['content', 'editorial-figure', 'inline-cta', 'cta-band'])
  })

  it('drops unknown, disabled, deferred and malformed blocks with diagnostics', () => {
    const { sections, diagnostics } = planSections({
      layout: [
        { blockType: 'features', items: [] },
        { blockType: 'archive' },
        { blockType: 'productGrid' },
        { blockType: 'team' },
        { blockType: 42 },
        { id: 'kept', blockType: 'faq', items: [] },
      ],
      allowed: ['features', 'faq'],
      landing: false,
      settings,
    })
    expect(sections.map((section) => section.key)).toEqual(['features-0', 'kept'])
    expect(diagnostics).toEqual([
      { index: 1, blockType: 'archive', reason: 'deferred' },
      { index: 2, blockType: 'productGrid', reason: 'unknown' },
      { index: 3, blockType: 'team', reason: 'disallowed' },
      { index: 4, blockType: '', reason: 'invalid' },
    ])
  })

  it('tolerates a missing layout', () => {
    expect(planSections({ layout: null, allowed, landing: true, settings })).toEqual({ sections: [], diagnostics: [] })
  })
})

describe('block readers', () => {
  it('localizes and filters CMS links', () => {
    const links = readLinks(
      [
        { link: { type: 'custom', url: '/pricing', label: 'Pricing', appearance: 'outline' } },
        { link: { type: 'custom', url: 'javascript:alert(1)', label: 'Bad' } },
        { link: { type: 'custom', url: '/no-label' } },
      ],
      'en',
      'fa',
    )
    expect(links).toEqual([{ href: '/en/pricing', label: 'Pricing', newTab: false, appearance: 'outline' }])
  })

  it('reads a relation id from either an id or a populated document', () => {
    expect(relationId('abc')).toBe('abc')
    expect(relationId(7)).toBe('7')
    expect(relationId({ id: 'doc-1', title: 'x' })).toBe('doc-1')
    expect(relationId(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run tests/unit/section-plan.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `src/blocks/vocabulary.ts`**

```ts
/** The contract's business block vocabulary. Nothing outside this list may render. */
export const BUSINESS_BLOCK_TYPES = [
  'content',
  'mediaBlock',
  'cta',
  'features',
  'testimonials',
  'faq',
  'contact',
  'formBlock',
  'gallery',
  'team',
  'pricing',
  'logos',
  'archive',
] as const

export type BusinessBlockType = (typeof BUSINESS_BLOCK_TYPES)[number]

export const isBusinessBlockType = (value: string): value is BusinessBlockType =>
  (BUSINESS_BLOCK_TYPES as readonly string[]).includes(value)
```

- [ ] **Step 4: Write `src/blocks/normalize.ts`**

```ts
import type { Block, Media } from '@/cms/types'
import { linkHref } from '@/lib/nav'

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

export const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export const asBoolean = (value: unknown): boolean => value === true

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export const asMedia = (value: unknown): Media | null => {
  const record = asRecord(value)
  return record && (typeof record.id === 'string' || typeof record.id === 'number')
    ? (record as Media)
    : null
}

export const asMediaList = (value: unknown): Media[] =>
  asArray(value)
    .map(asMedia)
    .filter((media): media is Media => media !== null)

export function relationId(value: unknown): string | null {
  if (typeof value === 'string' && value !== '') return value
  if (typeof value === 'number') return String(value)
  const record = asRecord(value)
  if (!record) return null
  if (typeof record.id === 'string' && record.id !== '') return record.id
  if (typeof record.id === 'number') return String(record.id)
  return null
}

export type SectionLink = {
  href: string
  label: string
  newTab: boolean
  appearance: 'default' | 'outline'
}

export function readLink(raw: unknown, locale: string, siteDefault: string): SectionLink | null {
  const record = asRecord(raw)
  if (!record) return null
  const href = linkHref(record, locale, siteDefault)
  const label = asString(record.label)
  if (!href || label === '') return null
  return {
    href,
    label,
    newTab: record.newTab === true,
    appearance: record.appearance === 'outline' ? 'outline' : 'default',
  }
}

/** `links` is the contract's array of `{ link }` rows. */
export function readLinks(value: unknown, locale: string, siteDefault: string): SectionLink[] {
  return asArray(value).flatMap((entry) => {
    const link = readLink(asRecord(entry)?.link, locale, siteDefault)
    return link ? [link] : []
  })
}

export const blockId = (block: Block, index: number): string =>
  typeof block.id === 'string' && block.id !== '' ? block.id : `${block.blockType}-${index}`
```

- [ ] **Step 5: Write `src/blocks/plan.ts`**

```ts
import type { Block } from '@/cms/types'
import type { ThemeSettings } from '@/lib/theme/settings'
import {
  blockId,
  asRecord,
} from './normalize'
import { isBusinessBlockType, type BusinessBlockType } from './vocabulary'

export type SectionKind =
  | 'hero'
  | 'showcase'
  | 'editorial-figure'
  | 'cta-band'
  | 'inline-cta'
  | 'features'
  | 'pricing'
  | 'testimonials'
  | 'faq'
  | 'logos'
  | 'content'
  | 'gallery'
  | 'team'
  | 'contact'
  | 'form'

export type SectionSurface = 'canvas' | 'canvas-soft' | 'ink'

export type SectionPlan = {
  key: string
  kind: SectionKind
  variant: string
  surface: SectionSurface
  block: Block
}

export type PlanDiagnostic = {
  index: number
  blockType: string
  reason: 'invalid' | 'unknown' | 'disallowed' | 'deferred'
}

export type SectionPlanInput = {
  layout: unknown
  allowed: readonly string[]
  landing: boolean
  settings: Pick<ThemeSettings, 'heroTreatment' | 'featureTreatment' | 'showcaseTreatment'>
}

type Accepted = { block: Block; index: number }

const kindFor = (type: BusinessBlockType): SectionKind => {
  switch (type) {
    case 'mediaBlock':
      return 'editorial-figure'
    case 'cta':
      return 'inline-cta'
    case 'features':
      return 'features'
    case 'pricing':
      return 'pricing'
    case 'testimonials':
      return 'testimonials'
    case 'faq':
      return 'faq'
    case 'logos':
      return 'logos'
    case 'content':
      return 'content'
    case 'gallery':
      return 'gallery'
    case 'team':
      return 'team'
    case 'contact':
      return 'contact'
    case 'formBlock':
      return 'form'
    case 'archive':
      throw new Error('archive is deferred and never planned')
  }
}

/**
 * Pure block → section plan. Ordering is preserved; omission never changes the
 * surface rhythm because surfaces are assigned while walking accepted blocks.
 */
export function planSections(input: SectionPlanInput): { sections: SectionPlan[]; diagnostics: PlanDiagnostic[] } {
  const raw = Array.isArray(input.layout) ? input.layout : []
  const allowed = new Set(input.allowed)
  const accepted: Accepted[] = []
  const diagnostics: PlanDiagnostic[] = []

  raw.forEach((entry, index) => {
    const record = asRecord(entry)
    const blockType = record && typeof record.blockType === 'string' ? record.blockType.trim() : ''
    if (!record || blockType === '') {
      diagnostics.push({ index, blockType: '', reason: 'invalid' })
      return
    }
    if (!isBusinessBlockType(blockType)) {
      diagnostics.push({ index, blockType, reason: 'unknown' })
      return
    }
    if (blockType === 'archive') {
      diagnostics.push({ index, blockType, reason: 'deferred' })
      return
    }
    if (!allowed.has(blockType)) {
      diagnostics.push({ index, blockType, reason: 'disallowed' })
      return
    }
    accepted.push({ block: record as Block, index })
  })

  const ctaIndexes = accepted.filter((entry) => entry.block.blockType === 'cta').map((entry) => entry.index)
  const heroIndex = input.landing && ctaIndexes.length > 0 ? ctaIndexes[0] : null
  const lastCtaIndex = ctaIndexes.length > 0 ? ctaIndexes[ctaIndexes.length - 1] : null
  const bandIndex = lastCtaIndex !== null && lastCtaIndex !== heroIndex ? lastCtaIndex : null

  let alternator = 0
  const nextSurface = (): SectionSurface => {
    const surface: SectionSurface = alternator % 2 === 0 ? 'canvas' : 'canvas-soft'
    alternator += 1
    return surface
  }

  const sections: SectionPlan[] = []
  accepted.forEach(({ block, index }) => {
    const type = block.blockType as BusinessBlockType
    const key = blockId(block, index)
    const afterHero = heroIndex !== null && index === heroIndex + 1

    if (type === 'cta') {
      if (index === heroIndex) {
        sections.push({ key, kind: 'hero', variant: input.settings.heroTreatment, surface: 'canvas', block })
      } else if (index === bandIndex) {
        sections.push({ key, kind: 'cta-band', variant: 'band', surface: 'ink', block })
      } else {
        sections.push({ key, kind: 'inline-cta', variant: 'inline', surface: nextSurface(), block })
      }
      return
    }

    if (type === 'mediaBlock' && afterHero) {
      sections.push({ key, kind: 'showcase', variant: input.settings.showcaseTreatment, surface: 'ink', block })
      return
    }

    const kind = kindFor(type)
    const variant =
      type === 'features'
        ? input.settings.featureTreatment === 'sticky'
          ? 'sticky'
          : 'grid'
        : kind === 'editorial-figure'
          ? 'framed'
          : 'default'

    sections.push({ key, kind, variant, surface: nextSurface(), block })
  })

  return { sections, diagnostics }
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm vitest run tests/unit/section-plan.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/blocks tests/unit/section-plan.test.ts
git commit -m "feat: add contract block vocabulary, field readers and pure section planner"
```

---

### Task 11: Marketing sections

**Files:**
- Create: `src/sections/types.ts`, `src/sections/section-shell.tsx`, `src/sections/media-figure.tsx`
- Create: `src/sections/hero.tsx`, `src/sections/showcase.tsx`, `src/sections/features.tsx`, `src/sections/pricing.tsx`, `src/sections/testimonials.tsx`, `src/sections/logos.tsx`, `src/sections/cta.tsx`
- Create: `src/sections/faq.tsx`, `src/sections/faq-accordion.tsx`
- Test: `tests/unit/marketing-sections.test.tsx`

**Interfaces:**
- Produces: `SectionRenderProps` (`block, locale, siteDefault, mediaOrigin, variant, surface, settings`).
- Produces: `SectionShell`, `MediaFigure`, `HeroSection`, `ShowcaseSection`, `FeaturesSection`, `PricingSection`, `TestimonialsSection`, `LogosSection`, `FaqSection`, `CtaSection`.
- Consumes: readers/planner (Task 10), `RichText`/`MediaImage`/`ButtonLink`/`SectionHeader` (Task 9), `uiStrings`, `formatNumber`.

Sections are server components except `faq-accordion.tsx`. Every section returns `null` when its
CMS collection is empty; no section invents rows.

- [ ] **Step 1: Write the failing tests**

`tests/unit/marketing-sections.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatNumber } from '@eshobe/site-runtime'

import { FeaturesSection } from '@/sections/features'
import { HeroSection } from '@/sections/hero'
import { LogosSection } from '@/sections/logos'
import { PricingSection } from '@/sections/pricing'
import { TestimonialsSection } from '@/sections/testimonials'
import { uiStrings } from '@/lib/i18n'
import { DEFAULT_SETTINGS } from '@/lib/theme/settings'

const base = {
  locale: 'fa',
  siteDefault: 'fa',
  mediaOrigin: 'https://cms.example.test',
  surface: 'canvas' as const,
  settings: DEFAULT_SETTINGS,
}

describe('marketing sections', () => {
  it('renders CMS prices in Persian digits and flags the featured plan', () => {
    const html = renderToStaticMarkup(
      <PricingSection
        {...base}
        variant="default"
        block={{
          blockType: 'pricing',
          heading: 'تعرفه‌ها',
          plans: [
            { name: 'پایه', price: 490000, unit: 'تومان', period: 'ماهانه', features: ['منو', 'گزارش'], featured: false },
            { name: 'کامل', price: null, unit: 'تومان', featured: true, features: ['همه‌چیز'] },
          ],
        }}
      />,
    )
    expect(html).toContain(formatNumber(490000, 'fa'))
    expect(html).toContain('طرح پیشنهادی')
    expect(html).toContain(uiStrings('fa').priceNotPublished)
    expect(html).not.toContain('۴۹۰٬۰۰۰ تومان تومان')
  })

  it('omits an empty collection and never quotes a fabricated testimonial', () => {
    const empty = renderToStaticMarkup(
      <TestimonialsSection {...base} variant="default" block={{ blockType: 'testimonials', items: [] }} />,
    )
    expect(empty).toBe('')

    const html = renderToStaticMarkup(
      <TestimonialsSection
        {...base}
        variant="default"
        block={{ blockType: 'testimonials', items: [{ quote: 'نقل قول واقعی', author: 'نام واقعی', role: 'مدیر' }] }}
      />,
    )
    expect(html).toContain('نقل قول واقعی')
    expect(html).toContain('نام واقعی')
  })

  it('renders sticky feature items only when the treatment asks for it', () => {
    const block = { blockType: 'features', columns: '3', items: [{ title: 'منو' }, { title: 'سفارش' }] }
    const grid = renderToStaticMarkup(<FeaturesSection {...base} variant="grid" block={block} />)
    expect(grid).not.toContain('sticky')
    const sticky = renderToStaticMarkup(<FeaturesSection {...base} variant="sticky" block={block} />)
    expect(sticky).toContain('sticky')
    expect(sticky).toContain('منو')
  })

  it('drops unsafe hero links and empty logo rows', () => {
    const hero = renderToStaticMarkup(
      <HeroSection
        {...base}
        variant="plain"
        block={{
          blockType: 'cta',
          links: [{ link: { type: 'custom', url: 'javascript:alert(1)', label: 'Bad' } }],
        }}
      />,
    )
    expect(hero).not.toContain('javascript:')

    const logos = renderToStaticMarkup(
      <LogosSection
        {...base}
        variant="default"
        block={{ blockType: 'logos', logos: [{ id: 1, url: '/api/media/file/a.png', alt: '' }] }}
      />,
    )
    expect(logos).toBe('')
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run tests/unit/marketing-sections.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `src/sections/types.ts` and `src/sections/section-shell.tsx`**

`src/sections/types.ts`:

```ts
import type { SectionSurface } from '@/blocks/plan'
import type { Block } from '@/cms/types'
import type { ThemeSettings } from '@/lib/theme/settings'

export type SectionRenderProps = {
  block: Block
  locale: string
  siteDefault: string
  mediaOrigin: string
  variant: string
  surface: SectionSurface
  settings: ThemeSettings
}
```

`src/sections/section-shell.tsx`:

```tsx
import type { ReactNode } from 'react'

import type { SectionSurface } from '@/blocks/plan'
import { cn } from '@/lib/cn'

const SURFACE_CLASS: Record<SectionSurface, string> = {
  canvas: 'bg-canvas text-ink',
  'canvas-soft': 'bg-canvas-soft text-ink',
  ink: 'bg-ink text-canvas',
}

export function SectionShell({
  surface,
  id,
  className,
  children,
}: {
  surface: SectionSurface
  id?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn(
        'border-t border-hairline py-14 md:py-24 lg:py-28',
        SURFACE_CLASS[surface],
        className,
      )}
    >
      <div className="container-page">{children}</div>
    </section>
  )
}
```

- [ ] **Step 4: Write `src/sections/media-figure.tsx`**

```tsx
import type { Media } from '@/cms/types'
import { MediaImage } from '@/components/media-image'
import { cn } from '@/lib/cn'
import { mediaDimensions, mediaSrc } from '@/lib/media'

const ASPECT_CLASS: Record<string, string> = {
  '16/9': 'aspect-video',
  '3/2': 'aspect-[3/2]',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '4/5': 'aspect-[4/5]',
  '3/4': 'aspect-[3/4]',
}

const SIZE_CLASS: Record<string, string> = {
  narrow: 'max-w-xl',
  content: 'max-w-3xl',
  wide: 'max-w-5xl',
  full: 'max-w-none',
}

export function MediaFigure({
  media,
  mediaOrigin,
  caption = '',
  size = 'content',
  aspect = 'auto',
  frame = true,
  priority = false,
  className,
}: {
  media: Media | null
  mediaOrigin: string
  caption?: string
  size?: string
  aspect?: string
  frame?: boolean
  priority?: boolean
  className?: string
}) {
  if (!media || !mediaSrc(media, mediaOrigin)) return null
  const dimensions = mediaDimensions(media)
  const autoAspect =
    dimensions && dimensions.height > dimensions.width ? '4/5' : '3/2'
  const aspectClass =
    aspect === 'original' ? '' : (ASPECT_CLASS[aspect] ?? ASPECT_CLASS[autoAspect])
  const sized = SIZE_CLASS[size] ?? SIZE_CLASS.content

  return (
    <figure className={cn('mx-auto flex w-full flex-col gap-3', sized, className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden',
          frame && 'card-surface p-2',
          aspectClass,
        )}
      >
        <MediaImage
          media={media}
          mediaOrigin={mediaOrigin}
          sizes={size === 'full' ? '100vw' : '(min-width: 1024px) 960px, 100vw'}
          priority={priority}
          className={cn(
            'size-full',
            aspect === 'original' ? 'h-auto w-full' : 'object-cover',
          )}
        />
      </div>
      {caption ? <figcaption className="text-sm text-mute">{caption}</figcaption> : null}
    </figure>
  )
}
```

- [ ] **Step 5: Write `src/sections/hero.tsx` and `showcase.tsx`**

`src/sections/hero.tsx`:

```tsx
import { RichText } from '@/components/rich-text'
import { ButtonLink } from '@/components/ui/button'
import { asString, readLinks } from '@/blocks/normalize'
import type { RichText as RichTextData } from '@/cms/types'

import type { SectionRenderProps } from './types'

export function HeroSection({ block, locale, siteDefault, mediaOrigin, variant }: SectionRenderProps) {
  const links = readLinks(block.links, locale, siteDefault)
  const richText = (block.richText ?? null) as RichTextData
  const hasContent = Boolean(richText?.root?.children?.length) || links.length > 0
  if (!hasContent) return null

  return (
    <section className="relative overflow-hidden bg-canvas py-16 text-ink md:py-24 lg:py-32">
      {variant === 'mesh' ? <div aria-hidden="true" className="hero-mesh" /> : null}
      <div className="container-page relative">
        <div className="max-w-4xl">
          <RichText
            data={richText}
            mediaOrigin={mediaOrigin}
            className="[&_h1]:text-4xl [&_h1]:leading-[1.1] [&_h1]:tracking-tight [&_h2]:text-4xl [&_h2]:leading-[1.1] [&_h2]:tracking-tight [&_p]:text-lg [&_p]:text-body md:[&_h1]:text-6xl md:[&_h2]:text-6xl"
          />
          {links.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {links.map((link) =>
                link.appearance === 'outline' ? (
                  <ButtonLink
                    key={`${link.href}-${link.label}`}
                    href={link.href}
                    variant="secondary"
                    size="lg"
                    target={link.newTab ? '_blank' : undefined}
                    rel={link.newTab ? 'noreferrer noopener' : undefined}
                  >
                    {link.label}
                  </ButtonLink>
                ) : (
                  <ButtonLink
                    key={`${link.href}-${link.label}`}
                    href={link.href}
                    variant="primary"
                    size="lg"
                    target={link.newTab ? '_blank' : undefined}
                    rel={link.newTab ? 'noreferrer noopener' : undefined}
                  >
                    {link.label}
                  </ButtonLink>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
```

`asString` is unused there; remove it from the import. Note this now.

`src/sections/showcase.tsx`:

```tsx
import { asMedia, asString } from '@/blocks/normalize'
import { MediaImage } from '@/components/media-image'
import { mediaDimensions } from '@/lib/media'

import { MediaFigure } from './media-figure'
import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

export function ShowcaseSection({ block, mediaOrigin, variant, surface }: SectionRenderProps) {
  const media = asMedia(block.media)
  if (!media) return null
  const caption = asString(block.caption)
  const aspect = asString(block.aspect) || '16/9'

  if (variant === 'editorial') {
    return (
      <SectionShell surface="canvas-soft">
        <MediaFigure media={media} mediaOrigin={mediaOrigin} caption={caption} size="wide" aspect={aspect} />
      </SectionShell>
    )
  }

  return (
    <SectionShell surface={surface}>
      <figure className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-white/15 bg-canvas shadow-l4">
          <div aria-hidden="true" className="flex items-center gap-1.5 border-b border-hairline bg-canvas-soft-2 px-4 py-3">
            <span className="size-2 rounded-full bg-hairline-strong" />
            <span className="size-2 rounded-full bg-hairline-strong" />
            <span className="size-2 rounded-full bg-hairline-strong" />
          </div>
          <div className="bg-canvas-soft p-3 md:p-6">
            <MediaFigure media={media} mediaOrigin={mediaOrigin} size="full" aspect={aspect} frame={false} priority />
          </div>
        </div>
        {caption ? <figcaption className="text-center text-sm text-canvas/70">{caption}</figcaption> : null}
      </figure>
    </SectionShell>
  )
}
```

`mediaDimensions`/`MediaImage` imports are unused; remove. The showcase editorial branch ignores `surface`; acceptable but inconsistent with planner surface 'ink'. If variant editorial, use surface 'canvas-soft'? Planner assigned ink but editorial shouldn't be inverted maybe. Better keep `surface={surface}` (ink) with MediaFigure that uses `card-surface` white frame; that looks fine on ink. Remove special branch surface override → `<SectionShell surface={surface}>`. Simplify:
```tsx
if (variant === 'editorial') return <SectionShell surface={surface}><MediaFigure .../></SectionShell>
```

- [ ] **Step 6: Write `features.tsx`, `pricing.tsx`, `testimonials.tsx`, `logos.tsx`**

`src/sections/features.tsx`:

```tsx
import { asArray, asMedia, asRecord, asString } from '@/blocks/normalize'
import { MediaImage } from '@/components/media-image'
import { SectionHeader } from '@/components/ui/section-header'
import { cn } from '@/lib/cn'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

const COLUMNS: Record<string, string> = {
  '2': 'sm:grid-cols-2',
  '3': 'sm:grid-cols-2 lg:grid-cols-3',
  '4': 'sm:grid-cols-2 lg:grid-cols-4',
}

export function FeaturesSection({ block, mediaOrigin, variant, surface }: SectionRenderProps) {
  const items = asArray(block.items).flatMap((entry) => {
    const item = asRecord(entry)
    const title = item ? asString(item.title) : ''
    return title === '' ? [] : [{ title, description: item ? asString(item.description) : '', icon: item ? asMedia(item.icon) : null }]
  })
  if (items.length === 0) return null
  const columns = COLUMNS[asString(block.columns)] ?? COLUMNS['3']
  const sticky = variant === 'sticky'

  return (
    <SectionShell surface={surface}>
      <SectionHeader heading={asString(block.heading)} intro={asString(block.intro)} />
      <ul className={cn('mt-10 grid gap-4', columns)}>
        {items.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            className={cn(
              'card-surface flex flex-col gap-3 p-6',
              sticky && 'md:motion-safe:sticky',
            )}
            style={sticky ? { top: `calc(6rem + ${index * 0.75}rem)` } : undefined}
          >
            {item.icon ? (
              <MediaImage media={item.icon} mediaOrigin={mediaOrigin} sizes="32px" className="size-8" />
            ) : (
              <span aria-hidden="true" className="font-mono text-xs text-mute">{String(index + 1).padStart(2, '0')}</span>
            )}
            <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
            {item.description ? <p className="text-sm text-body">{item.description}</p> : null}
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
```

`pricing.tsx`:

```tsx
import { formatNumber } from '@eshobe/site-runtime'

import { asArray, asBoolean, asNumber, asRecord, asString, readLink } from '@/blocks/normalize'
import { ButtonLink } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { uiStrings } from '@/lib/i18n'
import { cn } from '@/lib/cn'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

export function PricingSection({ block, locale, siteDefault, variant, surface }: SectionRenderProps) {
  const strings = uiStrings(locale)
  const plans = asArray(block.plans).flatMap((entry) => {
    const plan = asRecord(entry)
    const name = plan ? asString(plan.name) : ''
    if (!plan || name === '') return []
    return [{
      name,
      featured: asBoolean(plan.featured),
      price: asNumber(plan.price),
      unit: asString(plan.unit),
      period: asString(plan.period),
      features: asArray(plan.features).map(asString).filter((value) => value !== ''),
      link: plan.enableLink === true ? readLink(plan.link, locale, siteDefault) : null,
    }]
  })
  if (plans.length === 0) return null

  return (
    <SectionShell surface={surface}>
      <SectionHeader heading={asString(block.heading)} intro={asString(block.intro)} />
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={cn(
              'flex flex-col gap-6 border p-6',
              plan.featured
                ? 'border-ink bg-ink text-canvas'
                : 'card-surface',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {plan.featured ? <span className="mono text-[11px] text-canvas/70">{strings.featuredPlan}</span> : null}
            </div>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight">
                {plan.price === null ? strings.priceNotPublished : formatNumber(plan.price, locale)}
              </span>
              {plan.price !== null && plan.unit ? <span className="text-sm opacity-70">{plan.unit}</span> : null}
              {plan.period ? <span className="text-sm opacity-70">/ {plan.period}</span> : null}
            </p>
            {plan.features.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-60" />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : null}
            {plan.link ? (
              <ButtonLink
                href={plan.link.href}
                variant={plan.featured ? 'secondary' : 'primary'}
                className="mt-auto"
                target={plan.link.newTab ? '_blank' : undefined}
                rel={plan.link.newTab ? 'noreferrer noopener' : undefined}
              >
                {plan.link.label}
              </ButtonLink>
            ) : null}
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
```

Need `featuredPlan` string added to UiStrings + fa/en. Test expects 'طرح پیشنهادی'.

`testimonials.tsx`:

```tsx
import { asArray, asMedia, asRecord, asString } from '@/blocks/normalize'
import { MediaImage } from '@/components/media-image'
import { SectionHeader } from '@/components/ui/section-header'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

export function TestimonialsSection({ block, mediaOrigin, surface }: SectionRenderProps) {
  const items = asArray(block.items).flatMap((entry) => {
    const item = asRecord(entry)
    const quote = item ? asString(item.quote) : ''
    const author = item ? asString(item.author) : ''
    return quote === '' || author === '' ? [] : [{
      quote,
      author,
      role: item ? asString(item.role) : '',
      avatar: item ? asMedia(item.avatar) : null,
    }]
  })
  if (items.length === 0) return null

  return (
    <SectionShell surface={surface}>
      <SectionHeader heading={asString(block.heading)} intro={asString(block.intro)} />
      <ul className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <li key={`${item.author}-${index}`} className="card-surface flex flex-col gap-6 p-6">
            <blockquote className="flex-1 text-base text-body">«{item.quote}»</blockquote>
            <div className="flex items-center gap-3">
              {item.avatar ? (
                <MediaImage media={item.avatar} mediaOrigin={mediaOrigin} sizes="40px" className="size-10 rounded-full object-cover" />
              ) : null}
              <div>
                <p className="text-sm font-medium text-ink">{item.author}</p>
                {item.role ? <p className="text-xs text-mute">{item.role}</p> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
```

`logos.tsx`:

```tsx
import { asMediaList } from '@/blocks/normalize'
import { mediaAlt } from '@/lib/media'
import { MediaImage } from '@/components/media-image'
import { SectionHeader } from '@/components/ui/section-header'
import { cn } from '@/lib/cn'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

export function LogosSection({ block, mediaOrigin, settings, surface }: SectionRenderProps) {
  const logos = asMediaList(block.logos).filter((media) => mediaAlt(media) !== '')
  if (logos.length === 0) return null

  return (
    <SectionShell surface={surface}>
      <SectionHeader heading={asString(block.heading)} intro={asString(block.intro)} align="center" />
      <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {logos.map((logo) => (
          <li key={logo.id}>
            <MediaImage
              media={logo}
              mediaOrigin={mediaOrigin}
              sizes="(min-width: 768px) 160px, 120px"
              className={cn('h-8 w-auto object-contain', settings.logosMonochrome && 'opacity-65 grayscale transition hover:opacity-100 hover:grayscale-0 motion-reduce:transition-none')}
            />
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
```

`asString` import missing; add.

- [ ] **Step 7: Write `faq.tsx` + `faq-accordion.tsx` and `cta.tsx`**

`src/sections/faq.tsx`:

```tsx
import { asArray, asRecord, asString } from '@/blocks/normalize'
import { SectionHeader } from '@/components/ui/section-header'

import { FaqAccordion } from './faq-accordion'
import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

export function FaqSection({ block, surface }: SectionRenderProps) {
  const items = asArray(block.items).flatMap((entry) => {
    const item = asRecord(entry)
    const question = item ? asString(item.question) : ''
    const answer = item ? asString(item.answer) : ''
    return question === '' || answer === '' ? [] : [{ question, answer }]
  })
  if (items.length === 0) return null

  return (
    <SectionShell surface={surface}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <SectionHeader heading={asString(block.heading)} intro={asString(block.intro)} />
        <FaqAccordion items={items} />
      </div>
    </SectionShell>
  )
}
```

`faq-accordion.tsx` as drafted.

`cta.tsx`:

```tsx
import { asString, readLinks } from '@/blocks/normalize'
import { RichText } from '@/components/rich-text'
import { ButtonLink } from '@/components/ui/button'
import type { RichText as RichTextData } from '@/cms/types'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

function Actions({ links, inverted }: { links: ReturnType<typeof readLinks>; inverted: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <ButtonLink
          key={`${link.href}-${link.label}`}
          href={link.href}
          variant={link.appearance === 'outline' ? 'secondary' : 'primary'}
          size="md"
          target={link.newTab ? '_blank' : undefined}
          rel={link.newTab ? 'noreferrer noopener' : undefined}
          className={inverted && link.appearance !== 'outline' ? 'border border-canvas bg-canvas text-ink' : undefined}
        >
          {link.label}
        </ButtonLink>
      ))}
    </div>
  )
}

export function CtaSection({ block, locale, siteDefault, mediaOrigin, variant, surface }: SectionRenderProps) {
  const links = readLinks(block.links, locale, siteDefault)
  const richText = (block.richText ?? null) as RichTextData
  const heading = asString(block.heading)
  const intro = asString(block.intro)
  if (!richText?.root?.children?.length && heading === '' && links.length === 0) return null

  if (variant === 'band') {
    return (
      <SectionShell surface="ink">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <RichText
              data={richText}
              mediaOrigin={mediaOrigin}
              className="[&_h1]:text-3xl [&_h2]:text-3xl [&_h1]:font-semibold [&_h2]:font-semibold [&_p]:text-canvas/70 md:[&_h1]:text-5xl md:[&_h2]:text-5xl"
            />
            {!richText?.root?.children?.length && heading ? <h2 className="text-3xl font-semibold md:text-5xl">{heading}</h2> : null}
            {intro ? <p className="mt-4 text-canvas/70">{intro}</p> : null}
          </div>
          {links.length > 0 ? <Actions links={links} inverted /> : null}
        </div>
      </SectionShell>
    )
  }

  return (
    <SectionShell surface={surface}>
      <div className="card-surface flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center">
        <div className="max-w-2xl">
          <RichText data={richText} mediaOrigin={mediaOrigin} className="[&_h1]:text-2xl [&_h2]:text-2xl [&_h1]:font-semibold [&_h2]:font-semibold" />
          {!richText?.root?.children?.length && heading ? <h2 className="text-2xl font-semibold text-ink">{heading}</h2> : null}
          {intro ? <p className="mt-2 text-body">{intro}</p> : null}
        </div>
        {links.length > 0 ? <Actions links={links} inverted={false} /> : null}
      </div>
    </SectionShell>
  )
}
```

Note `surface` unused in band branch; fine. `inverted` secondary button on ink: secondary uses `bg-canvas text-ink`, already light. Only primary needs override.

- [ ] **Step 8: Run tests, typecheck and lint**

Run: `pnpm vitest run tests/unit/marketing-sections.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS. Fix any unused import the compiler flags (for example `asString` in `hero.tsx`).

- [ ] **Step 9: Commit**

```bash
git add src/sections tests/unit/marketing-sections.test.tsx
git commit -m "feat: add marketing sections with CMS-driven variants"
```

---

### Task 12: Content sections

**Files:**
- Create: `src/sections/content.tsx`, `src/sections/editorial-figure.tsx`, `src/sections/gallery.tsx`, `src/sections/team.tsx`, `src/sections/contact.tsx`
- Test: `tests/unit/content-sections.test.tsx`

**Interfaces:**
- Produces: `ContentSection`, `EditorialFigureSection`, `GallerySection`, `TeamSection`, `ContactSection`, all `SectionRenderProps`.
- Consumes: `readLink`/`asMedia`/`asMediaList` (Task 10), `MediaFigure` (Task 11), `RichText`/`MediaImage` (Task 9), `toLocaleDigits` (`@eshobe/site-runtime`).

- [ ] **Step 1: Write the failing tests**

`tests/unit/content-sections.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ContactSection } from '@/sections/contact'
import { ContentSection } from '@/sections/content'
import { GallerySection } from '@/sections/gallery'
import { TeamSection } from '@/sections/team'
import { DEFAULT_SETTINGS } from '@/lib/theme/settings'

const base = {
  locale: 'fa',
  siteDefault: 'fa',
  mediaOrigin: 'https://cms.example.test',
  surface: 'canvas' as const,
  settings: DEFAULT_SETTINGS,
}

const paragraph = (text: string) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] },
})

describe('content sections', () => {
  it('renders CMS columns with the size asked for and their links', () => {
    const html = renderToStaticMarkup(
      <ContentSection
        {...base}
        variant="default"
        block={{
          blockType: 'content',
          columns: [
            { size: 'twoThirds', richText: paragraph('ستون اصلی'), enableLink: true, link: { type: 'custom', url: '/features', label: 'بیشتر' } },
            { size: 'oneThird', richText: paragraph('ستون کنار') },
          ],
        }}
      />,
    )
    expect(html).toContain('ستون اصلی')
    expect(html).toContain('ستون کنار')
    expect(html).toContain('lg:col-span-8')
    expect(html).toContain('href="/features"')
    expect(html).toContain('بیشتر')
  })

  it('omits empty content, gallery and team blocks', () => {
    expect(renderToStaticMarkup(<ContentSection {...base} variant="default" block={{ blockType: 'content', columns: [] }} />)).toBe('')
    expect(renderToStaticMarkup(<GallerySection {...base} variant="default" block={{ blockType: 'gallery', images: [] }} />)).toBe('')
    expect(renderToStaticMarkup(<TeamSection {...base} variant="default" block={{ blockType: 'team', members: [] }} />)).toBe('')
  })

  it('renders gallery alt text from media and team members from CMS only', () => {
    const gallery = renderToStaticMarkup(
      <GallerySection
        {...base}
        variant="default"
        block={{ blockType: 'gallery', columns: '2', images: [{ id: 1, url: '/api/media/file/hall.png', alt: 'نمای سالن' }] }}
      />,
    )
    expect(gallery).toContain('alt="نمای سالن"')

    const team = renderToStaticMarkup(
      <TeamSection
        {...base}
        variant="default"
        block={{ blockType: 'team', members: [{ name: 'نام عضو', role: 'مدیر' }] }}
      />,
    )
    expect(team).toContain('نام عضو')
    expect(team).toContain('مدیر')
  })

  it('converts phone digits and refuses a non-HTTPS map link', () => {
    const html = renderToStaticMarkup(
      <ContactSection
        {...base}
        variant="default"
        block={{
          blockType: 'contact',
          address: 'تهران',
          phones: ['0912 345 6789'],
          email: 'hello@biza.example',
          mapUrl: 'http://maps.example/x',
        }}
      />,
    )
    expect(html).toContain('۰۹۱۲ ۳۴۵ ۶۷۸۹')
    expect(html).toContain('mailto:hello@biza.example')
    expect(html).not.toContain('http://maps.example')
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run tests/unit/content-sections.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `src/sections/content.tsx`**

```tsx
import { asArray, asBoolean, asRecord, asString, readLink } from '@/blocks/normalize'
import { RichText } from '@/components/rich-text'
import { ButtonLink } from '@/components/ui/button'
import type { RichText as RichTextData } from '@/cms/types'
import { cn } from '@/lib/cn'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

const WIDTH: Record<string, string> = {
  oneQuarter: 'lg:col-span-3',
  oneThird: 'lg:col-span-4',
  half: 'lg:col-span-6',
  twoThirds: 'lg:col-span-8',
  threeQuarters: 'lg:col-span-9',
  full: 'lg:col-span-12',
}

export function ContentSection({ block, locale, siteDefault, mediaOrigin, surface }: SectionRenderProps) {
  const columns = asArray(block.columns).flatMap((entry) => {
    const column = asRecord(entry)
    if (!column) return []
    const richText = (column.richText ?? null) as RichTextData
    const hasText = Boolean(richText?.root?.children?.length)
    const link = asBoolean(column.enableLink) ? readLink(column.link, locale, siteDefault) : null
    if (!hasText && !link) return []
    return [{
      size: asString(column.size) || 'oneThird',
      richText: hasText ? richText : null,
      link,
    }]
  })
  if (columns.length === 0) return null

  return (
    <SectionShell surface={surface}>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        {columns.map((column, index) => (
          <div key={index} className={cn('flex flex-col gap-4', WIDTH[column.size] ?? WIDTH.oneThird)}>
            <RichText data={column.richText} mediaOrigin={mediaOrigin} />
            {column.link ? (
              <ButtonLink
                href={column.link.href}
                variant="secondary"
                size="sm"
                className="self-start"
                target={column.link.newTab ? '_blank' : undefined}
                rel={column.link.newTab ? 'noreferrer noopener' : undefined}
              >
                {column.link.label}
              </ButtonLink>
            ) : null}
          </div>
        ))}
      </div>
    </SectionShell>
  )
}
```

- [ ] **Step 4: Write `src/sections/editorial-figure.tsx` and `gallery.tsx`**

`editorial-figure.tsx`:

```tsx
import { asMedia, asString } from '@/blocks/normalize'

import { MediaFigure } from './media-figure'
import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

export function EditorialFigureSection({ block, mediaOrigin, surface }: SectionRenderProps) {
  const media = asMedia(block.media)
  if (!media) return null
  return (
    <SectionShell surface={surface} className="py-10 md:py-14">
      <MediaFigure
        media={media}
        mediaOrigin={mediaOrigin}
        caption={asString(block.caption)}
        size={asString(block.size) || 'content'}
        aspect={asString(block.aspect) || 'auto'}
      />
    </SectionShell>
  )
}
```

`gallery.tsx`:

```tsx
import { asMediaList, asString } from '@/blocks/normalize'
import { MediaImage } from '@/components/media-image'
import { SectionHeader } from '@/components/ui/section-header'
import { cn } from '@/lib/cn'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

const COLUMNS: Record<string, string> = {
  '2': 'sm:grid-cols-2',
  '3': 'sm:grid-cols-2 lg:grid-cols-3',
  '4': 'sm:grid-cols-2 lg:grid-cols-4',
}

export function GallerySection({ block, mediaOrigin, surface }: SectionRenderProps) {
  const images = asMediaList(block.images)
  if (images.length === 0) return null
  return (
    <SectionShell surface={surface}>
      <SectionHeader heading={asString(block.heading)} intro={asString(block.intro)} />
      <ul className={cn('mt-10 grid gap-4', COLUMNS[asString(block.columns)] ?? COLUMNS['3'])}>
        {images.map((image) => (
          <li key={image.id} className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-canvas-soft">
            <MediaImage
              media={image}
              mediaOrigin={mediaOrigin}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="aspect-square size-full object-cover"
            />
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
```

- [ ] **Step 5: Write `src/sections/team.tsx` and `contact.tsx`**

`team.tsx`:

```tsx
import { asArray, asMedia, asRecord, asString } from '@/blocks/normalize'
import { MediaImage } from '@/components/media-image'
import { SectionHeader } from '@/components/ui/section-header'
import { cn } from '@/lib/cn'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

const COLUMNS: Record<string, string> = {
  '2': 'sm:grid-cols-2',
  '3': 'sm:grid-cols-2 lg:grid-cols-3',
  '4': 'sm:grid-cols-2 lg:grid-cols-4',
}

export function TeamSection({ block, mediaOrigin, surface }: SectionRenderProps) {
  const members = asArray(block.members).flatMap((entry) => {
    const member = asRecord(entry)
    const name = member ? asString(member.name) : ''
    if (!member || name === '') return []
    return [{
      name,
      role: asString(member.role),
      bio: asString(member.bio),
      photo: asMedia(member.photo),
    }]
  })
  if (members.length === 0) return null

  return (
    <SectionShell surface={surface}>
      <SectionHeader heading={asString(block.heading)} intro={asString(block.intro)} />
      <ul className={cn('mt-10 grid gap-6', COLUMNS[asString(block.columns)] ?? COLUMNS['3'])}>
        {members.map((member) => (
          <li key={member.name} className="flex flex-col gap-4">
            {member.photo ? (
              <MediaImage
                media={member.photo}
                mediaOrigin={mediaOrigin}
                sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                className="aspect-[4/5] w-full rounded-[var(--radius-card)] object-cover"
              />
            ) : null}
            <div>
              <h3 className="text-base font-semibold text-ink">{member.name}</h3>
              {member.role ? <p className="text-sm text-mute">{member.role}</p> : null}
              {member.bio ? <p className="mt-2 text-sm text-body">{member.bio}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
```

`contact.tsx`:

```tsx
import { toLocaleDigits } from '@eshobe/site-runtime'

import { asArray, asString } from '@/blocks/normalize'
import { SectionHeader } from '@/components/ui/section-header'
import { uiStrings } from '@/lib/i18n'

import { SectionShell } from './section-shell'
import type { SectionRenderProps } from './types'

const httpsUrl = (value: unknown): string | null => {
  const raw = asString(value)
  if (raw === '') return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function ContactSection({ block, locale, surface }: SectionRenderProps) {
  const strings = uiStrings(locale)
  const address = asString(block.address)
  const phones = asArray(block.phones).map(asString).filter((phone) => phone !== '')
  const email = asString(block.email)
  const hours = asString(block.hours)
  const mapUrl = httpsUrl(block.mapUrl)
  if (!address && phones.length === 0 && !email && !hours && !mapUrl) return null

  return (
    <SectionShell surface={surface}>
      <SectionHeader heading={asString(block.heading)} intro={asString(block.intro)} />
      <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {address ? (
          <div>
            <dt className="mono text-xs text-mute">{strings.contactAddress}</dt>
            <dd className="mt-2 text-sm text-body">{address}</dd>
          </div>
        ) : null}
        {phones.length > 0 ? (
          <div>
            <dt className="mono text-xs text-mute">{strings.contactPhone}</dt>
            <dd className="mt-2 flex flex-col gap-1 text-sm text-body">
              {phones.map((phone) => <span key={phone} dir="ltr">{toLocaleDigits(phone, locale)}</span>)}
            </dd>
          </div>
        ) : null}
        {email ? (
          <div>
            <dt className="mono text-xs text-mute">{strings.contactEmail}</dt>
            <dd className="mt-2 text-sm">
              <a className="text-link underline underline-offset-4" href={`mailto:${email}`}>{email}</a>
            </dd>
          </div>
        ) : null}
        {hours ? (
          <div>
            <dt className="mono text-xs text-mute">{strings.contactHours}</dt>
            <dd className="mt-2 whitespace-pre-line text-sm text-body">{hours}</dd>
          </div>
        ) : null}
      </dl>
      {mapUrl ? (
        <a className="mt-8 inline-flex min-h-11 items-center text-sm text-link underline underline-offset-4" href={mapUrl} target="_blank" rel="noreferrer noopener">
          {strings.contactMap}
        </a>
      ) : null}
    </SectionShell>
  )
}
```

Add `contactMap` to `UiStrings` plus fa/en: `'مسیریابی روی نقشه'`, `'Open in maps'`.

- [ ] **Step 6: Run tests, typecheck and lint**

Run: `pnpm vitest run tests/unit/content-sections.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sections tests/unit/content-sections.test.tsx src/lib/i18n.ts
git commit -m "feat: add content, gallery, team and contact sections"
```

---

