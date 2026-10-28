import 'server-only';
import type { Metadata } from 'next';
import type { PageDoc, Snapshot } from './cms/types';
import { deploymentIsPreview, siteOrigin } from './cms/client';
import { listPublishedPages } from './cms/source';
import { localePath, mediaSrc, pagePath } from './cms/urls';
import { plainText } from '@/components/blocks/RichText';
export async function pageMetadata(
  page: PageDoc,
  snap: Snapshot,
  path: string,
  post = false,
): Promise<Metadata> {
  const title = page.meta?.title || page.title || snap.site.name;
  const description = page.meta?.description || plainText(page.hero?.richText).slice(0, 180);
  const canonical = new URL(
    localePath(path, snap.locale, snap.site.defaultLocale),
    siteOrigin(),
  ).toString();
  const languages: Record<string, string> = {};
  if (!snap.preview)
    for (const locale of snap.site.availableLocales ?? [snap.locale]) {
      const docs = await listPublishedPages(locale, post ? 'posts' : 'pages');
      const match = docs.find((p) => p.id === page.id);
      if (match)
        languages[locale] = new URL(
          localePath(
            post
              ? `/posts/${encodeURIComponent(match.slug)}`
              : pagePath(match.id, match.slug, snap.site),
            locale,
            snap.site.defaultLocale,
          ),
          siteOrigin(),
        ).toString();
    }
  if (languages[snap.site.defaultLocale ?? 'fa'])
    languages['x-default'] = languages[snap.site.defaultLocale ?? 'fa'];
  const image = mediaSrc(page.meta?.image ?? snap.site.branding?.socialImage);
  return {
    title,
    description,
    alternates: { canonical, languages },
    robots:
      deploymentIsPreview() || snap.preview
        ? { index: false, follow: false }
        : { index: true, follow: true },
    openGraph: {
      type: post ? 'article' : 'website',
      url: canonical,
      title,
      description,
      siteName: snap.site.name,
      locale: snap.locale === 'fa' ? 'fa_IR' : 'en_US',
      ...(image ? { images: [{ url: new URL(image, siteOrigin()).toString() }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [new URL(image, siteOrigin()).toString()] } : {}),
    },
  };
}
export function structuredData(page: PageDoc, snap: Snapshot, path: string) {
  const url = new URL(
    localePath(path, snap.locale, snap.site.defaultLocale),
    siteOrigin(),
  ).toString();
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: snap.site.name,
        inLanguage: snap.site.availableLocales ?? [snap.locale],
      },
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: page.meta?.title ?? page.title,
        description: page.meta?.description,
        inLanguage: snap.locale,
        isPartOf: { '@id': `${origin}/#website` },
      },
    ],
  };
}
