import Link from 'next/link';
import { ArrowUpRight, Check, Plus } from 'lucide-react';
import { formatDate, formatNumber, toLocaleDigits } from '@eshobe/site-runtime';
import type { Block, FormDoc, Media, PageDoc, Snapshot } from '@/lib/cms/types';
import { getDict } from '@/lib/i18n/dict';
import { actionEvent, linkHref, localePath, mediaSrc, safeHref } from '@/lib/cms/urls';
import { leadConfigured } from '@/lib/integrations/leads';
import { leadFields } from '@/lib/integrations/form-schema';
import { RichText } from './RichText';
import { MediaFigure } from './MediaFigure';
import { DemoForm } from '../forms/DemoForm';
const supported = new Set([
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
]);
const columns = (value: Block['columns']) =>
  value === '2'
    ? 'md:grid-cols-2'
    : value === '4'
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : 'sm:grid-cols-2 lg:grid-cols-3';
export function LeadSection({ snap, form = snap.form }: { snap: Snapshot; form?: FormDoc | null }) {
  return (
    <DemoForm
      locale={snap.locale}
      fields={leadFields(form, snap.locale)}
      ready={leadConfigured() && !snap.preview && (snap.demo || !!snap.pages.privacy)}
      privacyHref={localePath('/privacy', snap.locale, snap.site.defaultLocale)}
      formId={form?.id}
      submitLabel={form?.submitButtonLabel}
    />
  );
}
function Content({ block, snap }: { block: Block; snap: Snapshot }) {
  const { site, locale } = snap;
  const t = getDict(locale);
  switch (block.blockType) {
    case 'content':
      return (
        <div className="grid gap-10 md:grid-cols-12">
          {Array.isArray(block.columns) &&
            block.columns.map((col, i) => {
              const width =
                {
                  oneQuarter: 'md:col-span-3',
                  oneThird: 'md:col-span-4',
                  half: 'md:col-span-6',
                  twoThirds: 'md:col-span-8',
                  threeQuarters: 'md:col-span-9',
                  full: 'md:col-span-12',
                }[col.size ?? 'full'] ?? 'md:col-span-12';
              const href = col.enableLink ? linkHref(col.link, site, locale) : null;
              return (
                <div className={`${width} min-w-0`} key={i}>
                  <RichText data={col.richText} site={site} locale={locale} />
                  {href && (
                    <Link className="btn btn-secondary mt-6" href={href}>
                      {col.link?.label ?? t.readMore}
                      <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              );
            })}
        </div>
      );
    case 'features':
      return (
        <div className={`grid gap-px feature-grid ${columns(block.columns)}`}>
          {block.items?.map((item, i) => (
            <article className="feature-item" key={i}>
              <div className="feature-number">
                {typeof item.icon === 'object' && mediaSrc(item.icon) ? (
                  <span className="w-8">
                    <MediaFigure media={item.icon} />
                  </span>
                ) : (
                  formatNumber(i + 1, locale, { minimumIntegerDigits: 2 })
                )}
              </div>
              <h3 className="t-h3 mt-6">{item.title}</h3>
              <p className="t-body-sm !text-muted mt-3">{item.description}</p>
            </article>
          ))}
        </div>
      );
    case 'mediaBlock':
      return (
        <figure className="max-w-5xl mx-auto">
          <div className="product-frame">
            <MediaFigure media={block.media} />
          </div>
          {block.caption && (
            <figcaption className="mt-5">
              <RichText data={block.caption} site={site} locale={locale} />
            </figcaption>
          )}
        </figure>
      );
    case 'cta':
      return (
        <div className="cta-panel">
          <div className="max-w-2xl mx-auto">
            <RichText data={block.richText} site={site} locale={locale} />
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {block.links?.map(({ link }, i) => {
                const href = linkHref(link, site, locale);
                return (
                  href && (
                    <Link
                      key={i}
                      href={href}
                      className={`btn btn-lg ${i ? 'btn-secondary' : 'btn-primary'}`}
                      data-analytics-event={actionEvent(href, site, locale)}
                    >
                      {link.label}
                      <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
                    </Link>
                  )
                );
              })}
            </div>
          </div>
        </div>
      );
    case 'faq':
      return (
        <div className="faq-list">
          {block.items
            ?.filter((i) => i.question && i.answer)
            .map((item, i) => (
              <details key={i}>
                <summary>
                  <span>{item.question}</span>
                  <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
                </summary>
                <p className="t-body-sm !text-muted">{item.answer}</p>
              </details>
            ))}
        </div>
      );
    case 'testimonials':
      return (
        <div className="grid gap-6 md:grid-cols-2">
          {block.items
            ?.filter((item) => item.quote && item.author)
            .map((item, i) => (
              <figure key={i} className="card">
                <blockquote className="t-body">“{item.quote}”</blockquote>
                <figcaption className="mt-6 flex gap-3 items-center">
                  {typeof item.avatar === 'object' && (
                    <span className="w-10 shrink-0 rounded-full overflow-hidden">
                      <MediaFigure media={item.avatar} />
                    </span>
                  )}
                  <span>
                    <span className="block font-medium">{item.author}</span>
                    <span className="t-body-sm !text-muted">{item.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
        </div>
      );
    case 'pricing':
      return (
        <>
          <p className="form-notice mb-6">{t.illustrative}</p>
          <div className="grid gap-6 lg:grid-cols-3">
            {block.plans?.map((plan, i) => {
              const href = plan.enableLink ? linkHref(plan.link, site, locale) : null;
              return (
                <article
                  className={`card flex flex-col ${plan.featured ? '!border-accent' : ''}`}
                  key={i}
                >
                  <h3 className="t-h3">{plan.name}</h3>
                  {typeof plan.price === 'number' && Number.isFinite(plan.price) && (
                    <p className="t-h2 mt-5">
                      {formatNumber(plan.price, locale)}{' '}
                      <span className="t-body-sm">{plan.unit}</span>
                    </p>
                  )}
                  <p className="t-body-sm !text-muted mt-2">{plan.period}</p>
                  <ul className="mt-6 space-y-3 flex-1">
                    {plan.features?.map((feature, n) => (
                      <li className="flex gap-2 items-start t-body-sm" key={n}>
                        <Check
                          size={18}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="shrink-0"
                        />
                        {typeof feature === 'string' ? feature : feature.feature}
                      </li>
                    ))}
                  </ul>
                  {href && (
                    <Link href={href} className="btn btn-secondary mt-6">
                      {plan.link?.label}
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </>
      );
    case 'logos':
      return (
        <div className="flex flex-wrap items-center justify-center gap-10">
          {block.logos?.map((media, i) => (
            <div className="max-w-32" key={i}>
              <MediaFigure media={media} />
            </div>
          ))}
        </div>
      );
    case 'gallery':
      return (
        <div className={`grid gap-6 ${columns(block.columns)}`}>
          {block.images?.map((media, i) => (
            <figure className="overflow-hidden rounded-md border border-border" key={i}>
              <MediaFigure media={media} />
            </figure>
          ))}
        </div>
      );
    case 'team':
      return (
        <div className={`grid gap-6 ${columns(block.columns)}`}>
          {block.members?.map((member, i) => (
            <article className="card" key={i}>
              <MediaFigure media={member.photo} />
              <h3 className="t-h3 mt-5">{member.name}</h3>
              <p className="t-body-sm !text-muted mt-2">{member.role}</p>
              <p className="t-body-sm mt-3">{member.bio}</p>
            </article>
          ))}
        </div>
      );
    case 'contact':
      return (
        <address className="not-italic t-body space-y-3">
          <p className="whitespace-pre-line">{block.address}</p>
          {block.phones?.map((phone, i) => {
            const value = typeof phone === 'string' ? phone : phone.phone;
            const href = value && safeHref(`tel:${value.replace(/[\s()-]/g, '')}`);
            return (
              href && (
                <a className="block min-h-11 underline" key={i} href={href} dir="ltr">
                  {toLocaleDigits(value!, locale)}
                </a>
              )
            );
          })}
          {block.email && safeHref(`mailto:${block.email}`) && (
            <a href={`mailto:${block.email}`} className="block min-h-11 underline" dir="ltr">
              {block.email}
            </a>
          )}
          <p>{block.hours}</p>
        </address>
      );
    case 'formBlock':
      return (
        <div className="max-w-3xl mx-auto">
          {block.enableIntro && (
            <div className="mb-8">
              <RichText data={block.introContent} site={site} locale={locale} />
            </div>
          )}
          {typeof block.form === 'object' ? (
            <LeadSection snap={snap} form={block.form} />
          ) : (
            <p className="form-notice">{t.noContent}</p>
          )}
        </div>
      );
    case 'archive':
      return (
        <>
          <RichText data={block.introContent} site={site} locale={locale} />
          <div className="grid gap-6 md:grid-cols-3 mt-6">
            {block.selectedDocs?.map((ref, i) => {
              const doc = ref.value as PageDoc | undefined;
              if (
                !doc ||
                typeof doc === 'string' ||
                !doc.slug ||
                (!snap.preview && doc._status !== 'published')
              )
                return null;
              return (
                <article className="card" key={i}>
                  {typeof doc.meta?.image === 'object' && (
                    <MediaFigure media={doc.meta.image as Media} />
                  )}
                  <h3 className="t-h3 mt-4">
                    <Link
                      href={localePath(
                        `/posts/${encodeURIComponent(doc.slug)}`,
                        locale,
                        site.defaultLocale,
                      )}
                    >
                      {doc.title}
                    </Link>
                  </h3>
                  {doc.publishedAt && Number.isFinite(Date.parse(doc.publishedAt)) && (
                    <time className="t-body-sm !text-muted" dateTime={doc.publishedAt}>
                      {formatDate(doc.publishedAt, locale)}
                    </time>
                  )}
                  <p className="t-body-sm mt-3">{doc.meta?.description}</p>
                </article>
              );
            })}
          </div>
        </>
      );
    default:
      return null;
  }
}
export function Blocks({ blocks, snap }: { blocks?: Block[]; snap: Snapshot }) {
  return (blocks ?? []).slice(0, 100).map((block, index) => {
    if (
      !supported.has(block.blockType) ||
      (snap.site.blocks && !snap.site.blocks.includes(block.blockType))
    ) {
      console.warn('Apex: unsupported CMS block omitted', String(block.blockType).slice(0, 40));
      return null;
    }
    const empty =
      (['features', 'testimonials', 'faq'].includes(block.blockType) && !block.items?.length) ||
      (block.blockType === 'logos' && !block.logos?.length) ||
      (block.blockType === 'team' && !block.members?.length);
    if (empty) return null;
    return (
      <section
        key={block.id ?? index}
        className={`block-section ${block.blockType === 'cta' ? 'block-cta' : ''}`}
      >
        <div className="page-shell">
          {block.heading && (
            <div className="section-heading">
              <p className="section-index" aria-hidden="true">
                {formatNumber(index + 1, snap.locale, { minimumIntegerDigits: 2 })} /
              </p>
              <div>
                <h2 className="t-h2">{block.heading}</h2>
                {block.intro && <p className="t-lead mt-4 max-w-2xl">{block.intro}</p>}
              </div>
            </div>
          )}
          <Content block={block} snap={snap} />
        </div>
      </section>
    );
  });
}
