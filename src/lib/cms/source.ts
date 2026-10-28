import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cmsEnabled, cmsGet, CmsError, demoEnabled, published } from './client';
import { demoSnapshot } from '../demo/content';
import { isPreviewRequest } from '../security/preview';
import { isLocale, SLOT_PATHS } from './urls';
import {
  PAGE_SLOTS,
  type Block,
  type FormDoc,
  type Locale,
  type PageDoc,
  type SiteDescriptor,
  type Snapshot,
  type Media,
  type SlotKey,
  type LinkData,
} from './types';
export { siteOrigin } from './client';

type Docs<T> = { docs?: T[]; hasNextPage?: boolean };
export function belongsToSite(
  doc: { site?: string | { id: string } },
  site: SiteDescriptor,
): boolean {
  const mine = process.env.ESHOBE_SITE_ID ?? site.id;
  const owner = typeof doc.site === 'string' ? doc.site : doc.site?.id;
  // Site keys enforce this upstream; explicit mismatch is also rejected here.
  return !owner || (!!mine && owner === mine);
}
export const getSite = cache(async (): Promise<SiteDescriptor> => {
  if (!cmsEnabled()) {
    if (!demoEnabled()) throw new CmsError(503);
    return demoSnapshot('fa').site;
  }
  const site = await cmsGet<SiteDescriptor>('/api/site');
  if (
    site.contractVersion !== 1 ||
    (process.env.ESHOBE_SITE_ID && site.id && site.id !== process.env.ESHOBE_SITE_ID)
  )
    throw new CmsError(403);
  if (site.status && site.status !== 'active') notFound();
  return site;
});
async function optional<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof CmsError && [403, 404].includes(err.status)) return null;
    throw err;
  }
}
function usable(doc: PageDoc | null, site: SiteDescriptor, preview: boolean): doc is PageDoc {
  return (
    !!doc &&
    !!doc.title &&
    !!doc.slug &&
    belongsToSite(doc, site) &&
    (preview || doc._status === 'published')
  );
}
async function hydrateBlock(
  block: Block,
  locale: Locale,
  site: SiteDescriptor,
  preview: boolean,
): Promise<Block> {
  if (block.blockType === 'formBlock' && typeof block.form === 'string') {
    const form = await optional(
      cmsGet<FormDoc>(
        `/api/forms/${encodeURIComponent(block.form)}`,
        { locale, fallbackLocale: 'false', depth: 1 },
        preview,
      ),
    );
    return { ...block, form: form && belongsToSite(form, site) ? form : undefined };
  }
  if (block.blockType === 'archive') {
    const docs =
      block.populateBy === 'selection'
        ? (
            await Promise.all(
              (block.selectedDocs ?? [])
                .slice(0, 24)
                .map(async (ref) =>
                  typeof ref.value === 'object'
                    ? ref.value
                    : typeof ref.value === 'string'
                      ? optional(
                          cmsGet<PageDoc>(
                            `/api/posts/${encodeURIComponent(ref.value)}`,
                            { locale, fallbackLocale: 'false', depth: 1 },
                            preview,
                          ),
                        )
                      : null,
                ),
            )
          ).filter((p): p is PageDoc => usable(p, site, preview))
        : (
            (
              await cmsGet<Docs<PageDoc>>(
                '/api/posts',
                {
                  locale,
                  fallbackLocale: 'false',
                  ...published,
                  depth: 1,
                  limit: Math.max(1, Math.min(24, block.limit ?? 6)),
                  sort: '-publishedAt',
                },
                preview,
              )
            ).docs ?? []
          ).filter((p) => usable(p, site, preview));
    return { ...block, selectedDocs: docs.map((value) => ({ relationTo: 'posts', value })) };
  }
  return block;
}
async function hydratePage(
  doc: PageDoc | null,
  site: SiteDescriptor,
  locale: Locale,
  preview: boolean,
): Promise<PageDoc | null> {
  if (!usable(doc, site, preview)) return null;
  const layout = await Promise.all(
    (doc.layout ?? []).slice(0, 100).map((block) => hydrateBlock(block, locale, site, preview)),
  );
  return { ...doc, layout };
}
export const loadSnapshot = cache(async (preferredLocale?: Locale): Promise<Snapshot> => {
  const site = await getSite();
  const requested = preferredLocale ?? (await headers()).get('x-apex-locale');
  const locale = isLocale(requested) ? requested : (site.defaultLocale ?? 'fa');
  if (!(site.availableLocales ?? [site.defaultLocale ?? 'fa']).includes(locale)) notFound();
  if (!cmsEnabled()) return demoSnapshot(locale);
  const preview = await isPreviewRequest();
  const bindings = site.themeRuntime?.bindings ?? {};
  const page = async (slot: SlotKey) => {
    const ref = bindings[slot];
    let doc: PageDoc | null;
    if (ref?.id) {
      if (ref.type !== 'page') return null;
      doc = await optional(
        cmsGet<PageDoc>(
          `/api/pages/${encodeURIComponent(ref.id)}`,
          { locale, fallbackLocale: 'false', depth: 2, draft: preview },
          preview,
        ),
      );
    } else {
      const result = await cmsGet<Docs<PageDoc>>(
        '/api/pages',
        {
          locale,
          fallbackLocale: 'false',
          ...(preview ? { draft: true } : published),
          'where[slug][equals]': slot,
          depth: 2,
          limit: 1,
        },
        preview,
      );
      doc = result.docs?.[0] ?? null;
    }
    return hydratePage(doc, site, locale, preview);
  };
  const [pages, header, footer, form, media] = await Promise.all([
    Promise.all(PAGE_SLOTS.map(page)),
    optional(
      cmsGet<{ navItems?: { link: LinkData }[] }>(
        '/api/globals/header',
        { locale, fallbackLocale: 'false', depth: 1 },
        preview,
      ),
    ),
    optional(
      cmsGet<{ navItems?: { link: LinkData }[] }>(
        '/api/globals/footer',
        { locale, fallbackLocale: 'false', depth: 1 },
        preview,
      ),
    ),
    bindings.demoForm?.id && bindings.demoForm.type === 'form'
      ? optional(
          cmsGet<FormDoc>(
            `/api/forms/${encodeURIComponent(bindings.demoForm.id)}`,
            { locale, fallbackLocale: 'false', depth: 1 },
            preview,
          ),
        )
      : null,
    bindings.productMedia?.id && bindings.productMedia.type === 'media'
      ? optional(
          cmsGet<Media>(
            `/api/media/${encodeURIComponent(bindings.productMedia.id)}`,
            { locale, depth: 0 },
            preview,
          ),
        )
      : null,
  ]);
  return {
    site,
    locale,
    preview,
    demo: false,
    pages: Object.fromEntries(PAGE_SLOTS.map((key, i) => [key, pages[i]])),
    header: header?.navItems ?? [],
    footer: footer?.navItems ?? [],
    form: form && belongsToSite(form, site) ? form : null,
    productMedia: media,
  };
});
export async function getPageBySlug(
  slug: string,
  snap: Snapshot,
  collection: 'pages' | 'posts' = 'pages',
) {
  if (snap.demo) return null;
  const result = await cmsGet<Docs<PageDoc>>(
    `/api/${collection}`,
    {
      locale: snap.locale,
      fallbackLocale: 'false',
      ...(snap.preview ? { draft: true } : published),
      'where[slug][equals]': slug,
      limit: 1,
      depth: 2,
    },
    snap.preview,
  );
  return hydratePage(result.docs?.[0] ?? null, snap.site, snap.locale, snap.preview);
}
export async function listPublishedPages(locale: Locale, collection: 'pages' | 'posts' = 'pages') {
  if (!cmsEnabled())
    return collection === 'pages' && demoEnabled()
      ? Object.values(demoSnapshot(locale).pages).filter((p): p is PageDoc => !!p)
      : [];
  const site = await getSite();
  const docs: PageDoc[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await cmsGet<Docs<PageDoc>>(`/api/${collection}`, {
      ...published,
      locale,
      fallbackLocale: 'false',
      depth: 0,
      limit: 100,
      page,
    });
    docs.push(...(result.docs ?? []).filter((p) => usable(p, site, false)));
    if (!result.hasNextPage) break;
  }
  return docs;
}
export function slotForPath(path: string): SlotKey | undefined {
  return PAGE_SLOTS.find((key) => SLOT_PATHS[key] === path);
}
