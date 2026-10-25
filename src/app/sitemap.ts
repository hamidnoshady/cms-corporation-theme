import type { MetadataRoute } from 'next';
import { getSite, listPublishedPages } from '@/lib/cms/source';
import { siteOrigin } from '@/lib/cms/client';
import { localePath, pagePath } from '@/lib/cms/urls';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();
  const origin = siteOrigin();
  const entries: { id: string; locale: string; url: string; modified?: Date }[] = [];
  for (const locale of site.availableLocales ?? [site.defaultLocale ?? 'fa'])
    for (const collection of ['pages', 'posts'] as const) {
      for (const page of await listPublishedPages(locale, collection)) {
        const route =
          collection === 'posts'
            ? `/posts/${encodeURIComponent(page.slug)}`
            : pagePath(page.id, page.slug, site);
        entries.push({
          id: `${collection}:${page.id}`,
          locale,
          url: new URL(localePath(route, locale, site.defaultLocale), origin).toString(),
          modified:
            page.updatedAt && Number.isFinite(Date.parse(page.updatedAt))
              ? new Date(page.updatedAt)
              : undefined,
        });
      }
    }
  return entries
    .filter((e, index) => entries.findIndex((x) => x.url === e.url) === index)
    .map((entry) => ({
      url: entry.url,
      lastModified: entry.modified,
      alternates: {
        languages: Object.fromEntries(
          entries
            .filter((other) => other.id === entry.id)
            .map((other) => [other.locale, other.url]),
        ),
      },
    }));
}
