'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { getDict } from '@/lib/i18n/dict';
import { localePath } from '@/lib/cms/urls';
import type { Locale } from '@/lib/cms/types';
export type NavLink = {
  label: string;
  href: string;
  newTab?: boolean;
  event?: 'demo_cta' | 'onboarding_click';
};
export function Header({
  name,
  logo,
  nav,
  cta,
  locale,
  defaultLocale,
  locales,
}: {
  name: string;
  logo: string | null;
  nav: NavLink[];
  cta: NavLink;
  locale: Locale;
  defaultLocale: Locale;
  locales: Locale[];
}) {
  const t = getDict(locale);
  const { theme, setTheme } = useTheme();
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const listener = () => {
      if (window.innerWidth >= 1024) dialog.current?.close();
    };
    window.addEventListener('resize', listener);
    return () => {
      window.removeEventListener('resize', listener);
      document.body.style.overflow = '';
    };
  }, []);
  const close = () => {
    dialog.current?.close();
  };
  const preferences = (id: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <label className="sr-only" htmlFor={id}>
        {t.theme}
      </label>
      <select
        id={id}
        value={theme}
        onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
        className="theme-select t-nav"
      >
        <option value="light">{t.light}</option>
        <option value="dark">{t.dark}</option>
        <option value="system">{t.system}</option>
      </select>
      {locales.length > 1 && (
        <a
          href={localePath(path, locale === 'fa' ? 'en' : 'fa', defaultLocale)}
          hrefLang={locale === 'fa' ? 'en' : 'fa'}
          lang={locale === 'fa' ? 'en' : 'fa'}
          aria-label={locale === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
          className="btn btn-ghost btn-sm"
          onClick={close}
        >
          {locale === 'fa' ? 'EN' : 'فارسی'}
        </a>
      )}
    </div>
  );
  return (
    <header className="site-header">
      <div className="page-shell flex h-16 items-center justify-between gap-3" data-wide="true">
        <Link
          href={localePath('/', locale, defaultLocale)}
          className="wordmark"
          aria-label={`${name} — ${t.home}`}
        >
          {logo ? (
            <Image
              unoptimized
              src={logo}
              alt=""
              width={32}
              height={32}
              className="h-8 w-auto max-w-24 object-contain"
            />
          ) : (
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
          <span>{name}</span>
        </Link>
        <nav aria-label={t.menu} className="hidden lg:flex items-center gap-1">
          {nav.map((item, i) => (
            <Link
              key={`${item.href}-${i}`}
              href={item.href}
              aria-current={path === item.href ? 'page' : undefined}
              className="btn btn-ghost t-nav"
              target={item.newTab ? '_blank' : undefined}
              rel={item.newTab ? 'noopener noreferrer' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">{preferences('theme-desktop')}</div>
          <Link
            href={cta.href}
            className="btn btn-primary hidden sm:inline-flex"
            data-analytics-event={cta.event}
          >
            {cta.label}
            <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <button
            ref={opener}
            type="button"
            aria-label={t.openMenu}
            aria-haspopup="dialog"
            aria-controls="mobile-navigation"
            className="btn btn-ghost !px-3 lg:hidden"
            onClick={() => {
              dialog.current?.showModal();
              document.body.style.overflow = 'hidden';
            }}
          >
            <Menu size={22} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
      <dialog
        ref={dialog}
        id="mobile-navigation"
        className="mobile-dialog"
        aria-label={t.menu}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const nodes = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),select:not([disabled]),[tabindex="0"]',
            ),
          ).filter((node) => node.getClientRects().length > 0);
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClose={() => {
          document.body.style.overflow = '';
          opener.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="mobile-dialog-content">
          <div className="flex justify-between items-center gap-4">
            <span className="t-h3">{name}</span>
            <button
              className="btn btn-ghost !px-3"
              type="button"
              onClick={close}
              aria-label={t.close}
              autoFocus
            >
              <X size={22} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label={t.menu} className="flex flex-col gap-2 py-8">
            {nav.map((item, i) => (
              <Link
                key={`${item.href}-${i}`}
                href={item.href}
                className="btn btn-ghost !justify-start !h-12"
                onClick={close}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href={cta.href}
            className="btn btn-primary btn-lg w-full"
            data-analytics-event={cta.event}
            onClick={close}
          >
            {cta.label}
          </Link>
          <div className="mt-8 border-t border-border pt-6">{preferences('theme-mobile')}</div>
        </div>
      </dialog>
    </header>
  );
}
