import Link from 'next/link';
import { formatDate } from '@eshobe/site-runtime';
import { getDict } from '@/lib/i18n/dict';
import { localePath } from '@/lib/cms/urls';
import type { Locale } from '@/lib/cms/types';
import type { NavLink } from './Header';
export function Footer({
  name,
  note,
  nav,
  locale,
  defaultLocale,
  showLocales,
}: {
  name: string;
  note: string;
  nav: NavLink[];
  locale: Locale;
  defaultLocale: Locale;
  showLocales: boolean;
}) {
  const t = getDict(locale);
  return (
    <footer className="border-t border-border bg-background-soft">
      <div className="page-shell py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <Link
              href={localePath('/', locale, defaultLocale)}
              className="t-h3 inline-flex min-h-11 items-center"
            >
              {name}
            </Link>
            {note && <p className="t-body-sm mt-3 max-w-sm !text-muted">{note}</p>}
          </div>
          <div>
            <h2 className="t-caption !text-muted">{t.navigation}</h2>
            <nav aria-label={t.navigation} className="mt-4 grid grid-cols-2 gap-x-6">
              {nav.map((link, i) => (
                <Link
                  key={i}
                  href={link.href}
                  target={link.newTab ? '_blank' : undefined}
                  rel={link.newTab ? 'noopener noreferrer' : undefined}
                  className="t-body-sm py-3 hover:underline underline-offset-4"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-wrap justify-between items-center gap-4 t-body-sm !text-muted">
          <p>
            © {formatDate(new Date(), locale, { year: 'numeric' })} {name}. {t.copyright}
          </p>
          {showLocales && (
            <div className="flex gap-4">
              <a
                className="py-3"
                href={localePath('/', 'fa', defaultLocale)}
                lang="fa"
                hrefLang="fa"
              >
                فارسی
              </a>
              <a
                className="py-3"
                href={localePath('/', 'en', defaultLocale)}
                lang="en"
                hrefLang="en"
              >
                English
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
