import Link from 'next/link';
import { formatDate, formatPrice } from '@eshobe/site-runtime';
import { getCatalogue } from '@/lib/integrations/pricing';
import { getDict } from '@/lib/i18n/dict';
import { localePath, safeHref, setting } from '@/lib/cms/urls';
import type { Snapshot } from '@/lib/cms/types';
export async function PublishedPricing({ snap }: { snap: Snapshot }) {
  const t = getDict(snap.locale);
  const catalogue = await getCatalogue(snap.locale);
  const demo = localePath('/demo', snap.locale, snap.site.defaultLocale);
  if (!catalogue)
    return (
      <section className="page-shell pb-16">
        <div className="card bg-background-soft !p-8 md:!p-12">
          <h2 className="t-h2">{t.pricingUnavailable}</h2>
          <p className="t-body !text-muted mt-4 max-w-2xl">{t.pricingNote}</p>
          <Link href={demo} className="btn btn-primary mt-6">
            {t.quote}
          </Link>
        </div>
      </section>
    );
  const accountHref = safeHref(setting(snap.site, 'ownerSignupHref', snap.locale));
  return (
    <section className="page-shell pb-16">
      <p className="t-caption !text-muted mb-6">{t.publishedPricing}</p>
      <div className="grid gap-6 lg:grid-cols-3">
        {catalogue.plans.map((plan) => (
          <article className="card flex flex-col" key={plan.id}>
            <h2 className="t-h3">{plan.name}</h2>
            <p className="t-body-sm !text-muted mt-3">{plan.description}</p>
            <p className="t-h2 mt-6">{formatPrice(plan.amountMinor, plan.currency, snap.locale)}</p>
            <p className="t-body-sm !text-muted mt-2">{plan.period}</p>
            <ul className="my-6 list-disc ps-5 space-y-2 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="t-body-sm">
                  {f}
                </li>
              ))}
            </ul>
            <Link
              className="btn btn-secondary"
              href={accountHref ?? demo}
              data-analytics-event={accountHref ? 'onboarding_click' : 'demo_cta'}
            >
              {accountHref ? t.start : t.quote}
            </Link>
          </article>
        ))}
      </div>
      <p className="t-body-sm !text-muted mt-6">{catalogue.taxNote}</p>
      <p className="t-body-sm !text-muted mt-3">
        {t.updated}:{' '}
        <time dateTime={catalogue.publishedAt}>
          {formatDate(catalogue.publishedAt, snap.locale)}
        </time>{' '}
        ·{' '}
        <a
          href={catalogue.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {t.source}
        </a>
      </p>
    </section>
  );
}
