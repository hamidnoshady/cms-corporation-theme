import Link from 'next/link';
import { headers } from 'next/headers';
import { getDict } from '@/lib/i18n/dict';
export default async function NotFound() {
  const locale = (await headers()).get('x-apex-locale') === 'en' ? 'en' : 'fa';
  const t = getDict(locale);
  return (
    <section className="page-shell py-24">
      <h1 className="t-display-2">{t.unavailable}</h1>
      <p className="t-lead mt-6">{t.unavailableBody}</p>
      <Link href={locale === 'en' ? '/en' : '/'} className="btn btn-primary mt-8">
        {t.home}
      </Link>
    </section>
  );
}
