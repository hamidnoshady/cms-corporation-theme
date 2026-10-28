import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getPageBySlug, getSite, loadSnapshot, slotForPath } from '@/lib/cms/source';
import { localePath, pagePath, splitPath } from '@/lib/cms/urls';
import { Hero } from '@/components/sections/Hero';
import { Blocks, LeadSection } from '@/components/blocks/Blocks';
import { RichText } from '@/components/blocks/RichText';
import { PublishedPricing } from '@/components/sections/PublishedPricing';
import { pageMetadata, structuredData } from '@/lib/seo';
import { cache, Suspense } from 'react';
import SectionLoading from '@/components/chrome/SectionLoading';
type Props = { params: Promise<{ path?: string[] }> };
const resolve = cache(async (path: string[]) => {
  // Next can supply encoded metadata params and decoded page params. Decode the
  // proxy-owned URL exactly once so both passes resolve the same Unicode slug.
  const requestPath = (await headers()).get('x-apex-path');
  let parts = path;
  if (requestPath) {
    try {
      parts = requestPath.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      notFound();
    }
  }
  if (parts.some((part) => /[/\\\u0000-\u001f]/.test(part))) notFound();
  const site = await getSite();
  const { locale, slug } = splitPath(parts, site.defaultLocale);
  if (slug.includes('..') || slug.startsWith('_') || slug.split('/').length > 2) notFound();
  const snap = await loadSnapshot(locale);
  const route = slug === 'home' ? '/' : `/${slug}`;
  const slot = slotForPath(route);
  const post = slug.startsWith('posts/');
  const page = slot
    ? snap.pages[slot]
    : await getPageBySlug(post ? slug.slice(6) : slug, snap, post ? 'posts' : 'pages');
  if (!page) notFound();
  const canonicalPath = post
    ? `/posts/${encodeURIComponent(slug.slice(6))}`
    : pagePath(page.id, page.slug, site);
  const expected = localePath(slot ? route : canonicalPath, locale, site.defaultLocale);
  const actual = '/' + parts.map(encodeURIComponent).join('/');
  if (actual !== expected && !snap.preview) permanentRedirect(expected);
  return { page, snap, route: slot ? route : canonicalPath, post, slot };
});
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path = [] } = await params;
  const result = await resolve(path);
  return pageMetadata(result.page, result.snap, result.route, result.post);
}
export default async function Page({ params }: Props) {
  const { path = [] } = await params;
  const { page, snap, route, slot } = await resolve(path);
  return (
    <>
      {!snap.preview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData(page, snap, route)).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <Hero page={page} snap={snap} home={slot === 'home'} />
      {slot === 'pricing' && (
        <Suspense fallback={<SectionLoading />}>
          <PublishedPricing snap={snap} />
        </Suspense>
      )}
      {slot === 'demo' && !page.layout?.some((b) => b.blockType === 'formBlock') && (
        <section className="page-shell pb-20">
          <div className="max-w-3xl mx-auto">
            <LeadSection snap={snap} />
          </div>
        </section>
      )}
      {page.content && (
        <div className="page-shell max-w-3xl py-12">
          <RichText data={page.content} site={snap.site} locale={snap.locale} />
        </div>
      )}
      <Blocks blocks={page.layout} snap={snap} />
    </>
  );
}
