import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { isHexColor } from '@eshobe/site-runtime';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/vazirmatn/wght.css';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { Header, type NavLink } from '@/components/chrome/Header';
import { Footer } from '@/components/chrome/Footer';
import { Announcement } from '@/components/chrome/Announcement';
import { PreviewBar } from '@/components/chrome/PreviewBar';
import { Analytics } from '@/components/analytics/Analytics';
import { loadSnapshot, siteOrigin } from '@/lib/cms/source';
import { deploymentIsPreview } from '@/lib/cms/client';
import { getDict } from '@/lib/i18n/dict';
import { readTheme } from '@/lib/i18n/cookies';
import {
  actionEvent,
  linkHref,
  localePath,
  mediaSrc,
  safeHref,
  setting,
  SLOT_PATHS,
} from '@/lib/cms/urls';
import type { LinkData, SlotKey } from '@/lib/cms/types';
import { analyticsConfigured } from '@/lib/integrations/analytics';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const { site } = await loadSnapshot();
  const icon = mediaSrc(site.branding?.favicon);
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: site.name, template: `%s — ${site.name}` },
    description: site.branding?.tagline,
    robots: deploymentIsPreview() ? { index: false, follow: false } : undefined,
    ...(icon ? { icons: { icon } } : {}),
  };
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};
function onColor(hex: string) {
  const full =
    hex.length === 4
      ? hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(1);
  const channels = [0, 2, 4].map((offset) => {
    const s = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2] > 0.179
    ? '#0a0a0a'
    : '#ffffff';
}
export default async function RootLayout({ children }: { children: ReactNode }) {
  const snap = await loadSnapshot();
  const { site, locale } = snap;
  const t = getDict(locale);
  const themePref = await readTheme(site.themeRuntime?.settings?.defaultTheme);
  const mapLinks = (links: { link: LinkData }[]): NavLink[] =>
    links.slice(0, 12).flatMap(({ link }) => {
      const href = linkHref(link, site, locale);
      return href && link.label ? [{ href, label: link.label, newTab: link.newTab }] : [];
    });
  const fallbackNav = (['features', 'restaurants', 'pricing'] as SlotKey[])
    .filter((key) => snap.pages[key])
    .map((key) => ({
      href: localePath(SLOT_PATHS[key], locale, site.defaultLocale),
      label: t[key as 'features' | 'restaurants' | 'pricing'],
    }));
  const nav = snap.header.length ? mapLinks(snap.header) : fallbackNav;
  const footerNav = snap.footer.length
    ? mapLinks(snap.footer)
    : [
        ...nav,
        ...(snap.pages.privacy
          ? [{ href: localePath('/privacy', locale, site.defaultLocale), label: t.privacy }]
          : []),
      ];
  const cta: NavLink = {
    href: localePath(
      safeHref(setting(site, 'ctaPrimaryHref', locale, '/demo')) ?? '/demo',
      locale,
      site.defaultLocale,
    ),
    label: setting(site, 'ctaPrimaryLabel', locale, t.start),
  };
  cta.event = actionEvent(cta.href, site, locale);
  const announce = setting(site, 'announcementText', locale);
  const announceHref = safeHref(setting(site, 'announcementHref', locale));
  const vars: Record<string, string> = {};
  for (const key of ['primary', 'accent', 'background', 'foreground'] as const) {
    const value = site.theme?.[key];
    if (isHexColor(value)) vars[`--tenant-${key}`] = value;
  }
  if (isHexColor(site.theme?.primary))
    vars['--tenant-primary-foreground'] = onColor(site.theme.primary);
  if (
    typeof site.theme?.lineHeight === 'number' &&
    site.theme.lineHeight >= 1.4 &&
    site.theme.lineHeight <= 2.4
  )
    vars['--body-lh'] = String(site.theme.lineHeight);
  const initScript = `try{var d=${JSON.stringify(themePref)}==='dark'||(${JSON.stringify(themePref)}==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`;
  return (
    <html
      lang={locale}
      dir={locale === 'fa' ? 'rtl' : 'ltr'}
      className={themePref === 'dark' ? 'dark' : ''}
      data-theme={themePref === 'dark' ? 'dark' : 'light'}
      data-radius={site.theme?.radius ?? 'md'}
      style={vars as React.CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="skip-link">
          {t.skip}
        </a>
        <ThemeProvider initialTheme={themePref}>
          {snap.preview && <PreviewBar locale={locale} />}
          {site.themeRuntime?.settings?.announcementEnabled === true && announce && (
            <Announcement
              text={announce}
              href={announceHref ? localePath(announceHref, locale, site.defaultLocale) : null}
              locale={locale}
            />
          )}
          <Header
            name={site.branding?.displayName ?? site.name}
            logo={mediaSrc(site.branding?.primaryLogo)}
            nav={nav}
            cta={cta}
            locale={locale}
            defaultLocale={site.defaultLocale ?? 'fa'}
            locales={site.availableLocales ?? [locale]}
          />
          <main id="main" tabIndex={-1} className="flex-1">
            {children}
          </main>
          <Footer
            name={site.name}
            note={setting(site, 'footerNote', locale, site.branding?.tagline ?? '')}
            nav={footerNav}
            locale={locale}
            defaultLocale={site.defaultLocale ?? 'fa'}
            showLocales={
              site.themeRuntime?.settings?.showFooterLocaleSwitcher !== false &&
              (site.availableLocales?.length ?? 1) > 1
            }
          />
          <Analytics
            enabled={analyticsConfigured() && !snap.preview && !snap.demo}
            locale={locale}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
