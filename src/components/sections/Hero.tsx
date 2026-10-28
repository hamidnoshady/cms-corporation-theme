import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { RichText } from '../blocks/RichText';
import { MediaFigure } from '../blocks/MediaFigure';
import { actionEvent, linkHref, setting, mediaSrc } from '@/lib/cms/urls';
import { getDict } from '@/lib/i18n/dict';
import type { PageDoc, Snapshot } from '@/lib/cms/types';
export function Hero({
  page,
  snap,
  home = false,
}: {
  page: PageDoc;
  snap: Snapshot;
  home?: boolean;
}) {
  const { site, locale } = snap;
  const t = getDict(locale);
  const media = page.hero?.media ?? (home ? snap.productMedia : null);
  const showMedia = !!mediaSrc(media);
  const hero = page.hero;
  if (hero?.type === 'none')
    return (
      <div className="page-shell pt-12">
        <h1 className="t-display-2">{page.title}</h1>
      </div>
    );
  return (
    <section className={`hero-section ${home ? 'hero-home' : 'hero-page'}`}>
      {home && <div className="hero-mesh" aria-hidden="true" />}
      <div className="page-shell relative">
        <div className="hero-copy">
          {home && (
            <p className="t-caption hero-eyebrow">
              <span className="status-dot" aria-hidden="true" />
              {setting(site, 'heroEyebrow', locale, site.branding?.tagline ?? site.name)}
            </p>
          )}
          {hero?.richText ? (
            <RichText data={hero.richText} site={site} locale={locale} hero />
          ) : (
            <h1 className="t-display-2">{page.title}</h1>
          )}
          {!!hero?.links?.length && (
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              {hero.links.slice(0, 2).map(({ link }, i) => {
                const href = linkHref(link, site, locale);
                return href && link.label ? (
                  <Link
                    key={i}
                    href={href}
                    className={`btn btn-lg ${i === 0 ? 'btn-primary' : 'btn-secondary'}`}
                    data-analytics-event={actionEvent(href, site, locale)}
                  >
                    {link.label}
                    {i === 0 && <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />}
                  </Link>
                ) : null;
              })}
            </div>
          )}
        </div>
        {showMedia && (
          <figure id="product" className="product-figure scroll-mt-24">
            <div className="product-frame">
              <MediaFigure media={media} priority />
            </div>
            <figcaption className="mt-4 t-body-sm !text-muted text-center max-w-3xl mx-auto">
              {setting(site, 'productCaption', locale, t.product)}
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
