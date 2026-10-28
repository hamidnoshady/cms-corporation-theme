# Assets and provenance

Fonts: Inter Variable and Vazirmatn Variable, self-hosted Fontsource packages,
SIL Open Font License (their licences ship in the installed packages). Icons:
Lucide, ISC. There are no Vercel logos, product imagery or copied marketing text.

The two **sample tenant** images are actual captures from the owner's Biza Miz
repository at `619d011b839c9cfc4ca7b39f7d88a8f4e605a3c3`:

- `public/demo/pos-reference.webp`: `docs/design/verification/pos-sell-captured.png`.
  That upstream set is explicitly historical; it shows a sample owner/menu, not
  a current release certification or a real customer. Converted to WebP only.
- `public/demo/orders-reference.webp`: `docs/design/visual/accounting-orders.png`.
  Empty sample order queue; converted to WebP only.

These images belong to the Biza Miz reference tenant, **not** reusable Apex brand
assets. The CMS-mode renderer does not fall back to them. Each production tenant
must bind its own approved media. The Biza Miz launch operator should replace
these references with captures of the release actually demonstrated, verify
printer/connectivity behaviour and approve captions before publication.
