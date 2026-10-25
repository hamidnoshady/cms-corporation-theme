# DESIGN.md — Apex corporate/SaaS theme (Eshobe CMS)

**Status:** Implementation specification for stages 1–4.
**Inspired by:** Vercel's marketing design language as documented on
[designmd.co/d/vercel](https://www.designmd.co/d/vercel).
**Adapted for:** Eshobe CMS multi-tenant corporate/SaaS storefronts, starting with
[Biza Miz](https://github.com/hamidnoshady/biza-miz) — the Persian-first POS platform
for restaurants and cafés.
**Bidirectional:** `fa` (RTL) is first-class; `en` (LTR) ships with equal parity.

This document is the *single source of truth* for visual decisions in this theme. AI
agents and human developers MUST read it (and `AGENTS.md`) before editing any UI file.
If a change would conflict with these tokens or rules, update this file first and
reference the change in the PR.

> Important: this theme is *inspired by*, not a clone of, Vercel. Do not copy Vercel
> wordmarks, triangles, proprietary product screenshots, hero copy, pricing, or
> brand assets. We reuse the *system* (palette discipline, scale, grid, motion
> restraint, typographic hierarchy) under original branding supplied by the tenant.

---

## 0. What "Vercel-inspired" means here

1. A **near-monochrome** canvas: crisp `#ffffff` / `#fafafa` surfaces against near-black
   `#0a0a0a` ink. Color is reserved for *meaning* (primary action, link, focus ring,
   destructive, success, accent mesh in the hero).
2. **1px hairline dividers**, generous whitespace, strict vertical alignment, no drop
   shadows that compete with content. "Premium" comes from spacing, not decoration.
3. **Large, readable** editorial headlines (clamped to viewport) paired with
   quiet supporting body copy; never both loud at once.
4. A subtle **multi-color mesh gradient** behind the hero (cyan / blue / magenta /
   amber on light; deeper saturated tones on dark) — this is the *only* decorative
   flourish. No confetti, no emoji stickers, no cartoon illustrations.
5. **Geometric sans for Latin headlines** (Inter / Geist-style), **Vazirmatn for
   Persian** (Eshobe standard), with correct Persian numerals, Jalali dates, and
   locale-aware direction.
6. **Restrained motion:** 150–240 ms easing on hover/focus; nothing > 400 ms on the
   interaction path; respect `prefers-reduced-motion`.
7. **Accessibility first:** 4.5:1 contrast for body text, visible focus rings,
   keyboard-operable menus and forms, no hover-only information.

---

## 1. Color tokens

All colors are exposed as CSS custom properties in `src/app/globals.css` and mapped
into Tailwind v4 via `@theme inline`. Values below are canonical and are mirrored in the stylesheet;
there is no automatic token code generator.

### 1.1 Light theme (default)

| Token                  | Hex       | Role                                                                 |
| ---------------------- | --------- | -------------------------------------------------------------------- |
| `--background`         | `#ffffff` | Page canvas                                                          |
| `--background-soft`    | `#fafafa` | Section background, cards flush to page                              |
| `--background-soft-2`  | `#f5f5f5` | Inputs, code blocks, inset panels                                    |
| `--foreground`         | `#0a0a0a` | Primary text / ink                                                   |
| `--foreground-body`    | `#171717` | Body copy (DesignMD's "primary")                                     |
| `--muted`              | `#666666` | Secondary body copy                                                  |
| `--muted-2`            | `#737373` | Tertiary / captions (DesignMD "mute")                                |
| `--border`             | `#ebebeb` | Hairline dividers, card borders (DesignMD "hairline")                |
| `--border-strong`      | `#d4d4d4` | Input borders, strong separators (≈DesignMD "hairline-strong")       |
| `--primary`            | `#0a0a0a` | Solid buttons, active nav, strong text                               |
| `--primary-foreground` | `#ffffff` | Text on primary                                                      |
| `--accent`             | `#0069e0` | Links, focus ring, the single brand color (DesignMD "link")          |
| `--accent-deep`        | `#0761d1` | Pressed link / hover (DesignMD "link-deep")                          |
| `--success`            | `#0f9d58` | Positive feedback, "live" badges                                     |
| `--warning`            | `#f5a623` | Caution, pricing notes                                               |
| `--destructive`        | `#c90000` | Errors, destructive actions (tone `#c90000` at 100% on light)           |
| `--overlay`            | `#0a0a0a` | Modal scrim at 60% opacity                                           |

On adoption, the Eshobe CMS copies `design.primary`, `design.accent`,
`design.background`, `design.foreground` from `eshobe.theme.json` *once* into the
tenant's theme document. Runtime per-tenant theming uses the pinned `themeCss` helper in a server-rendered
style tag — never recompile Tailwind. That runtime currently handles primary,
accent and light foreground but not arbitrary background/neutral ramps; see
`vendor/site-runtime/LIMITATIONS.md`. Custom palettes require their own contrast review.

### 1.2 Dark theme

| Token                  | Hex (dark) |
| ---------------------- | ---------- |
| `--background`         | `#0a0a0a`  |
| `--background-soft`    | `#111111`  |
| `--background-soft-2`  | `#171717`  |
| `--foreground`         | `#ededed`  |
| `--foreground-body`    | `#e5e5e5`  |
| `--muted`              | `#a1a1a1`  |
| `--muted-2`            | `#a1a1a1`  |
| `--border`             | `#1f1f1f`  |
| `--border-strong`      | `#333333`  |
| `--primary`            | `#fafafa`  |
| `--primary-foreground` | `#0a0a0a`  |
| `--accent`             | `#3b82f6`  |
| `--accent-deep`        | `#60a5fa`  |
| `--success`            | `#22c55e`  |
| `--warning`            | `#f59e0b`  |
| `--destructive`        | `#ef4444`  |
| `--overlay`            | `#000000`  |

Dark theme sets both `.dark` and `data-theme="dark"` on `<html>`; the latter
also disables the runtime helper's light-only overrides. The theme switch is a user preference stored in a preference cookie under `apex-theme`, defaulting to the OS
`prefers-color-scheme`.

### 1.3 Hero mesh gradient

The hero decoration is a radial-gradient multi-stop mesh, used *once per page* behind
the main headline. No other element may use this gradient.

Light:

```css
background:
  radial-gradient(1200px 600px at 10% 10%, rgba(0,112,243,.12), transparent 60%),
  radial-gradient(900px 500px at 90% 20%, rgba(236,72,153,.10), transparent 60%),
  radial-gradient(800px 500px at 50% 100%, rgba(245,166,35,.08), transparent 60%);
```

Dark — saturate slightly, reduce opacity so it stays a whisper:

```css
background:
  radial-gradient(1200px 600px at 10% 10%, rgba(59,130,246,.18), transparent 60%),
  radial-gradient(900px 500px at 90% 20%, rgba(217,70,239,.14), transparent 60%),
  radial-gradient(800px 500px at 50% 100%, rgba(245,158,11,.12), transparent 60%);
```

Do **not** add blur noise/grain layers. Keep it crisp.

---

## 2. Typography

### 2.1 Font families

| Role          | Family                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latin sans    | `Inter`, `"Geist"`, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif                                                               |
| Persian sans  | `"Vazirmatn", "Inter", system-ui, ...` — self-hosted via `next/font/local` from Fontsource, applied when `<html lang="fa">` or a parent has `dir="rtl"`.                  |
| Mono / code   | `"Geist Mono"`, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace                                                   |

Vazirmatn is mandatory for Persian; fall back gracefully to the Latin stack if it is
still loading (use `font-display: swap`). Numbers in Persian contexts render as
Persian-Indic digits (۰۱۲۳۴۵۶۷۸۹) via `@eshobe/site-runtime` formatting; `font-variant-numeric` only aligns them. CSS alone does not turn Latin digits into Persian digits.

### 2.2 Type scale

| Name           | Size (clamped)           | Weight | Tracking   | Line-height | Use                          |
| -------------- | ------------------------ | ------ | ---------- | ----------- | ---------------------------- |
| `t-display-1`  | `clamp(40px, 7vw, 84px)` | 700    | `-0.04em`  | 1.02        | Home hero h1                 |
| `t-display-2`  | `clamp(32px, 5vw, 60px)` | 700    | `-0.035em` | 1.05        | Section h1, page titles      |
| `t-h2`         | `clamp(24px, 3.4vw, 36px)` | 600  | `-0.025em` | 1.15        | Section h2                   |
| `t-h3`         | `20px`–`24px`            | 600    | `-0.02em`  | 1.3         | Card titles, h3              |
| `t-lead`       | `clamp(16px, 1.4vw, 20px)` | 400  | `-0.01em`  | 1.55        | Hero supporting copy         |
| `t-body`       | `16px`                   | 400    | `-0.005em` | 1.65        | Body copy                    |
| `t-body-sm`    | `14px`                   | 400    | `-0.005em` | 1.6         | Secondary body, metadata     |
| `t-caption`    | `12px` / `13px`          | 500    | `0.02em`   | 1.4         | Eyebrows, badges, all-caps   |
| `t-nav`        | `14px`                   | 500    | `-0.005em` | 1           | Primary navigation           |
| `t-mono`       | `12.5px`                 | 400    | `0`        | 1.5         | Code, keyboard hints, prices |

Persian line-height is 1.1×–1.15× the Latin value at the same size (Vazirmatn has
taller diacritics). Apply `line-height: 1.8` as the `--body-lh` default on
`[lang="fa"]` body text; the Eshobe tenant theme's `lineHeight` token (1.4–2.4)
overrides this via CSS variable.

### 2.3 Headline rules

- Only one `t-display-1` per page.
- Section headings (h2) sit above their body copy by at least `--space-12` on
  desktop, `--space-8` on mobile.
- All-caps captions/eyebrows use `text-transform: uppercase` *only for Latin*.
  Persian uses a `t-caption` weight/tracking without case transform.
- Never center long body copy. Centering is allowed only for: eyebrow captions,
  hero supporting copy (when ≤2 lines), CTA group labels.

---

## 3. Spacing scale

Use a 4px base (Tailwind default). The semantic scale below is preferred over raw
pixel values:

| Token      | Value | Use                                             |
| ---------- | ----- | ----------------------------------------------- |
| `--space-1`| 4px   | Icon-text gap, tight inline groups              |
| `--space-2`| 8px   | Inside badges, chips, compact rows              |
| `--space-3`| 12px  | Form field inner padding, small card gutters    |
| `--space-4`| 16px  | Default component padding (cards, list items)   |
| `--space-5`| 20px  | Button padding y for lg buttons                 |
| `--space-6`| 24px  | Section item gap, form field groups             |
| `--space-8`| 32px  | Card padding, column gap on mobile              |
| `--space-10`| 40px | Section padding y on mobile                     |
| `--space-12`| 48px | Section padding y on tablet, column gap desktop |
| `--space-16`| 64px | Section padding y desktop                       |
| `--space-20`| 80px | Major section spacing (between hero and body)   |
| `--space-24`| 96px | Hero vertical padding desktop                   |
| `--space-32`| 128px| Above-the-fold overflow allowance               |

Layout edges (page gutters) are semantic tokens that shift at breakpoints:

| Breakpoint           | `--edge-x` |
| -------------------- | ---------- |
| `< 640px` (mobile)   | `16px`     |
| `640–1023px` (tablet)| `24px`     |
| `≥ 1024px` (desktop) | `32px`     |
| `≥ 1440px` (wide)    | `48px`     |

Max content width: `--content-max = 1200px`. The hero and wide grids can stretch to
`--wide-max = 1440px`, but text columns never exceed 720px without a companion
element.

---

## 4. Surfaces, borders, radii, elevation

- **Hairline rule:** cards and panels use a 1px `var(--border)` stroke on all four
  sides *or* a single directional divider. Never both.
- **Radii:** controlled by the tenant `theme.radius` token:
  - `none` → `0`
  - `sm` → `6px`
  - `md` → `10px` (theme default)
  - `lg` → `14px`
  Expose as `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill` (999px).
  Buttons default to `--radius-md`; input fields match; cards match; badges use
  `--radius-sm` or pill.
- **Shadows:** very limited. Only two elevation layers exist:
  - `--shadow-sm` for raised buttons on hover: `0 1px 2px rgba(0,0,0,.04)`
  - `--shadow-lg` for popovers/dropdowns/modals: `0 8px 30px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)`
  **No** glow effects, no colored drop shadows except the hero mesh (which is a
  background, not a shadow).
- **Surface shades:** `--background` (page), `--background-soft` (section strip),
  `--background-soft-2` (pressable inset / code / input). Do not invent a fourth.

---

## 5. Grid & layout primitives

- Every page uses a single `.page-shell` wrapper that applies `--edge-x` padding
  horizontally and constrains to `--content-max` centered.
- Column grids:
  - Homepage: 12-column desktop, 6-column tablet, 4-column mobile.
  - Feature grids: `repeat(auto-fit, minmax(260px, 1fr))` with `gap: var(--space-8)`.
  - Pricing: 3 cards → at ≤880px collapse to 1-up.
- Section divider between major blocks is a full-bleed hairline:
  `<div class="h-px w-full bg-[var(--border)]" />`.
- RTL: never use `left`/`right` in CSS for spacing, borders, or transforms; prefer
  logical properties (`padding-inline`, `margin-inline`, `inset-inline-start`,
  `border-inline-start`, `start`/`end`). Tailwind v4's logical utilities (`ps-4`,
  `ms-4`, `text-start`, `rounded-s-*`) are preferred.

---

## 6. Components

This is the reference shape. Every component in `src/components/` must match.

### 6.1 Buttons

- **Primary (`.btn-primary`):** `bg-[var(--primary)] text-[var(--primary-foreground)]`,
  `px-5 py-2.5 rounded-[var(--radius-md)]`, `font-medium`, hover → 4% lighten/darken,
  active → 8%, focus → 2px `outline` in accent color offset 2px.
- **Secondary (`.btn-secondary`):** transparent bg, 1px `var(--border)` border,
  foreground body text, hover bg `var(--background-soft-2)`.
- **Ghost:** no border, transparent, hover bg `var(--background-soft-2)`; used for
  nav items and icon buttons.
- **Sizes:** `sm` (h-8, px-3, text-sm), default (h-10, px-5), `lg` (h-12, px-6,
  text-base).
- CTAs in the hero: tenant-provided primary/secondary labels (Biza Miz: "درخواست دمو"
  / "Request a demo") with a small `→` / `←` arrow that slides 2px on hover.

### 6.2 Badges

- Pill shape (radius 999px), padding `2px 10px`, text 12px/500.
- Announcement banners use a badge for the tag ("New") followed by a short link.
- States: `default` (border + muted text), `accent` (accent-10 bg + accent text),
  `success` (green soft bg), `warning`, `destructive`.

### 6.3 Header & mobile menu

- Height: 64px with 44px interaction targets.
- Sticky translucent canvas with a permanent bottom hairline and backdrop blur;
  no per-scroll JavaScript or layout-changing header state.
- Logo wordmark left (or right in RTL), primary nav center/start, CTA + theme
  switch + locale switch end.
- Mobile/tablet: hamburger opens a native modal dialog sheet. Tap the backdrop
  or press Escape to close; focus is trapped and restored to the opener.
- Nav items are ghost buttons, 44px min hit area.

### 6.4 Announcement bar (optional)

- Thin strip above header, 40px, bg `var(--background-soft-2)`, 12px text, centered,
  with a close (×) button that dismisses to `sessionStorage`.

### 6.5 Cards

- All cards: 1px `var(--border)`, radius `var(--radius-md)`, bg `var(--background)`,
  hover: `border-strong` with 0→1 `shadow-sm` on a 200ms ease.
- Press: subtle `translateY(1px)`.
- Content padding `var(--space-6)`; optional media region flush to top (no radius
  mismatch — media uses `rounded-t-[var(--radius-md)]`).
- Static information cards are not fake controls. Only supplied actions render
  links; never stretch an overlay across nested links or selectable content.

### 6.6 Product mockup container

- A 16:10 (or 4:3 on mobile) panel, `var(--radius-lg)`, 1px `var(--border)`,
  `bg var(--background-soft)`, containing either a screenshot image or (later) a
  live dashboard iframe preview. Subtle inner shadow top (`inset 0 1px 0
  rgba(255,255,255,.6)` light / `inset 0 1px 0 rgba(255,255,255,.04)` dark) to
  imply a bezel. No fake browser chrome unless real.

### 6.7 Pricing cards

- 3-up by default, middle card elevated with `border-[var(--accent)]` or
  `background-soft-2` and a small "پیشنهادی / Recommended" badge.
- Prices render through `@eshobe/site-runtime` `formatPrice()` (integer minor units,
  site currency, Persian/English numerals per locale). Never hardcode "تومان" or
  "تومان ۱٬۰۰۰٬۰۰۰".
- Feature list uses 16px check icon (Accent color) + 14/15px text; unavailable
  features use `muted-2` and no icon, never a cross out of deference.

### 6.8 Testimonial cards

- Quotation-mark glyph in `muted-2` at 36px/300 top-left, quote text in
  `t-body` italic off, attribution row below with avatar (32px, rounded-full),
  name, role, company. Do not fabricate quotes.

### 6.9 FAQ accordion

- Native `<details>`/`<summary>` supplies keyboard activation and expanded state
  without JavaScript. The indicator rotates, but content does not animate height;
  reduced motion disables the indicator transition. Multiple items may be open.

### 6.10 Footer

- Full-bleed, hairline top, bg `var(--background-soft)`.
- Brand/note and navigation form two desktop regions, stacked on mobile;
  navigation links wrap into two columns.
- Bottom strip: locale-formatted year + site name and locale links. Theme controls
  live in the header/mobile dialog; analytics preferences follow the footer.

### 6.11 Forms

- Labels 13px/500, fields 40–44px high, `var(--radius-md)`, 1px `var(--border-strong)`
  → focus in `var(--accent)` 2px outline.
- Error: 1px `var(--destructive)`, field + inline 12px error message below in
  destructive color.
- Submit button always shows a disabled+spinner state while submitting; success
  state returns inline (no alert dialog) with a green check + message.
- Honeypot, server-signed timed challenge, bounded validation and rate limits.
  No external CAPTCHA is represented as wired: an edge challenge service would
  need a separate reviewed integration and privacy approval.

---

## 7. Motion

- Use `transition: <property> 200ms cubic-bezier(0.32, 0.72, 0, 1);` for standard
  micro-interactions (hover, toggle, focus reveal).
- Use `320ms cubic-bezier(0.16, 1, 0.3, 1)` for entry (fade-up for sections that
  enter viewport).
- When `prefers-reduced-motion: reduce`, set `--motion: 0ms` globally and skip
  parallax, mesh animation, and any non-essential transform.
- Never animate layout properties (`width`, `height`, `top`, `left`) on repeated
  interaction — prefer transform/opacity.
- Hero mesh drift (slow 40s rotate on one gradient layer) is allowed only inside
  `@media (prefers-reduced-motion: no-preference)`.

---

## 8. Responsive rules

| Token    | Min-width | Behavior |
| -------- | --------- | -------- |
| `sm`     | 640px     | Stacked-to-row nav begins |
| `md`     | 768px     | Two-column grids |
| `lg`     | 1024px    | Desktop header, three-column features, full nav |
| `xl`     | 1280px    | Wide layout; gutters open to 48px at 1440px |
| `2xl`    | 1536px    | Cap content max-width |

- No horizontal overflow. Run `pnpm build` and visually inspect at 360px, 768px,
  1024px, 1440px before submitting UI PRs.
- Touch targets ≥ 44×44px on pointer:coarse.
- RTL: test the complete Persian page at every breakpoint. Logical properties are
  mandatory; visual RTL regressions are P0 bugs.

---

## 9. Accessibility checklist (every PR)

- [ ] All interactive elements reachable by Tab; visible focus ring (accent, 2px).
- [ ] Color contrast ≥ 4.5:1 for body, ≥ 3:1 for large text (use axe DevTools or
      `pnpm test:a11y`).
- [ ] Images carry `alt` (empty `alt=""` for decorative mesh and dividers).
- [ ] Buttons have accessible names (no icon-only buttons without `aria-label`).
- [ ] Menus/dialogs/accordions use correct ARIA (`aria-expanded`, `aria-controls`,
      `aria-modal`, `role="dialog"`).
- [ ] `prefers-reduced-motion` honored (no parallax/animation when set).
- [ ] Form inputs associate `<label for>` + error message via `aria-describedby`
      and `aria-invalid`.
- [ ] Locale switch sets `lang` and `dir` on `<html>`; focus is managed on change.

---

## 10. Biza Miz adaptations (Stage 2 landing content)

These are *tenant content* decisions for the first deployment; do not hardcode
them into the theme's design system. They are noted so agents don't have to guess:

- Hero headline emphasizes the POS workflow: menu → table/order → payment/receipt
  → shift/sales report.
- Primary CTA is "درخواست دمو" / "Request demo" — leads to the demo form, not a
  checkout. Billing, wallet top-ups, and sign-up happen inside Biza Miz itself;
  this theme never collects payment.
- Pricing display reads from Biza Miz's live catalogue via an authorized API (or
  is clearly marked "illustrative"); never imply a 1M-toman top-up is a fixed
  license.
- Success metrics, testimonials, and customer logos must be real and approved;
  use placeholder slots until then instead of fabricating them.

---

## 11. Do / Don't

**Do**
- Use the tokens. If you need a color, add it here first.
- Use logical properties for RTL safety.
- Use `formatPrice`, `formatDate`, `formatNumber` from `@eshobe/site-runtime`
  for every date/number/price.
- Keep the primary action visually heavier than any secondary action on screen.
- Let whitespace do the work.

**Don't**
- Don't introduce a second gradient, a second accent color, or a new shadow.
- Don't hardcode "Vercel", "Biza Miz" (except demo/bindings), "تومان", USD/IRR
  symbols, Jalali conversions, or prices in JSX.
- Don't animate on every scroll tick; prefer CSS and `IntersectionObserver`
  with `once: true`.
- Don't use images of code terminals as hero decoration unless the product is
  literally for developers (it isn't — Biza Miz is for restaurant operators).
- Don't copy blocks, copy, or logos from vercel.com. The system is the reference,
  not the words.


## 12. Implementation reconciliation (2026-10-25)

The current DesignMD page was fetched and its documented roles compared again:
primary/ink `#171717`, body `#4d4d4d`, mute `#888888`, hairline `#ebebeb`,
hairline-strong `#a1a1a1`, canvas `#fff`, soft `#fafafa`/`#f5f5f5`,
link `#0070f3` and link-deep `#0761d1`. These are source tokens, not a claim
that this is Vercel's official design system or a pixel clone of its current site.
A live visual comparison with vercel.com remains an operator review gate.

Deliberate corporate adaptations:
- Small text uses `#737373` on white and `#a1a1a1` on dark; source `#888`
  on white fails AA for small captions. On soft surfaces captions use `--muted`.
- Link/focus blue is `#0069e0` in light mode; errors use `#c90000` for contrast.
- Persian display line-height is 1.35, tracking zero, so joined letters/marks do not collide.
- Fonts are self-hosted from Fontsource (SIL OFL); no build-time font network.
- All touch targets are at least 44px. A native select provides keyboard theme controls;
  the mobile navigation is a native modal dialog with focus restoration/trapping.
- Native details/summary implements the FAQ accordion; no JS is required.
- The hero alone has a static mesh. Final CTAs use a plain inset panel.
- No "free", offline, installation-time, performance or customer-count claims without
  tenant approval. Sample product captures are captioned with provenance and sample-data status.
- Price blocks authored in CMS are explicitly illustrative. Only a validated, authorized
  catalogue response is labelled published pricing; absent/live-failure states never invent numbers.
- Explicit locale URLs, not a cookie, determine page language and canonical/hreflang.
- Deterministic visual checks: Playwright at 360/768/1024/1440, fa/en × light/dark,
  fixed reduced motion and screenshot baselines; axe checks and keyboard menu/form tests.
