# CMS authoring and content bindings

Read `THEME_API.md` §4, §8 and §17b. The site key injected by Eshobe selects the
tenant. No URL or form `siteId` may select one.

## First publish

1. Add localized **pages** in Eshobe for Home, Features, Restaurants/cafés,
   Pricing, Demo/contact and Privacy. Publish the Persian and English fields;
   untranslated bound content does not silently fall back to another language.
2. In **Site → Theme Settings**, bind `home`, `features`, `restaurants`, `pricing`,
   `demo`, `privacy` to their IDs. Bind `productMedia` to the approved screenshot.
   Hero media on the home page takes precedence over `productMedia`.
3. Populate the site's branding and header/footer `navItems`. Use reference links
   where possible. Renaming a bound page does not move `/features`, `/pricing`, etc.
   The page's localized slug becomes a redirect to its fixed slot route.
4. Set hero/CTA copy in the page's hero group (Lexical headings, paragraphs, links).
   Optional home eyebrow, screenshot caption, footer note and announcement text
   have separate `Fa` / `En` settings; there are no ambiguous default-language labels.
5. Set page `meta.title`, `meta.description`, `meta.image` and site social/favicons.
   Only published/translated documents appear in the sitemap and hreflang set.
6. Publish the real privacy policy, contact/retention/deletion information and a
   consent-policy version before enabling live lead delivery. The sample policy
   is explicitly not a business's legal policy.

No binding yet: the slot key is only a first-run slug hint. A bound missing,
unpublished or untranslated document never substitutes a different slug match.
CMS-mode errors never show the bundled Biza Miz tenant snapshot.

## Blocks

The renderer implements the upstream business schemas, not a parallel page model:

| Block | Rendering / guard |
|---|---|
| `content` | Logical-width rich-text columns, optional validated link |
| `mediaBlock` | Same-origin CMS image, explicit dimensions, alt and caption |
| `features` | 2/3/4-column grid, optional uploaded icons, locale-formatted ordinals |
| `cta` | Plain inset panel; two or more configured actions, no second mesh |
| `faq` | Native keyboard-accessible details/summary |
| `pricing` | CMS-authored plan numbers through `formatNumber` + the authored unit; **always illustrative** |
| `testimonials` / `logos` | Only editor-supplied quotes/attribution/media; no sample endorsements |
| `contact` | Address, safe mail/tel links, locale digits |
| `formBlock` | Site-owned form, intro and form-builder field labels/options |
| `gallery` / `team` | Uploaded media and authored biographies |
| `archive` | Published, translated site posts; paginated data, locale dates |

`productGrid` is intentionally not an ecommerce entry point for this business
theme. Unknown block types render nothing. Rich text supports paragraphs,
headings, lists, emphasis, quotes, links, uploads and embedded media grids; no
editor HTML is injected. A field's own RTL/LTR direction is respected.

## Lead forms

`demoForm` can bind a CMS form, or a published page can embed `formBlock`. Supported
form-builder fields: `text`, `email`, `number`, `textarea`, `select`, `checkbox`.
Names, labels, required flags and options come from CMS. `name` and one means of
contact are enforced; `phone`, `email`, `city`, `businessType`, `message` have known
lead meanings. Extra supported fields are bounded and included in the CRM notes.
Payment fields, tenant selectors and untrusted redirect/confirmation targets are
not implemented. Submission success text is controlled by the verified delivery
state, not by an authored promise that a failed request succeeded.

Forms submit through the theme to Biza Miz's site-credential intake. They do not
create an Eshobe storefront account or a second customer/wallet ledger.

## Biza Miz reference tenant

`src/lib/demo/content.ts` is sample tenant content in the same page-builder schema.
Use it as an authoring guide, not automatic production seeding (no credentials or
writes are run by this repository). Replace the reference screenshots with current,
approved release captures; see `ASSETS.md`. Do not publish offline/one-day
onboarding promises, fabricated testimonials or guaranteed wallet usage duration.
