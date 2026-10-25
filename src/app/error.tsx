'use client';
import { getDict } from '@/lib/i18n/dict';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const locale =
    typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'fa';
  const t = getDict(locale);
  return (
    <section className="page-shell py-24" role="alert">
      <h1 className="t-display-2">{t.error}</h1>
      <p className="t-lead mt-6">{t.errorBody}</p>
      <button type="button" className="btn btn-primary mt-8" onClick={reset}>
        {t.retry}
      </button>
    </section>
  );
}
