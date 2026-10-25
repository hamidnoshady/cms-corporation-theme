import type { LinkData, Locale, Media, SiteDescriptor, SlotKey } from './types';
export const SLOT_PATHS: Record<SlotKey, string> = {
  home: '/',
  features: '/features',
  restaurants: '/restaurants',
  pricing: '/pricing',
  demo: '/demo',
  privacy: '/privacy',
};
export const isLocale = (v: unknown): v is Locale => v === 'fa' || v === 'en';
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f\\]/.test(value))
    return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('#')) return value;
  try {
    const u = new URL(value);
    return ['https:', 'mailto:', 'tel:'].includes(u.protocol) && !u.username && !u.password
      ? value
      : null;
  } catch {
    return null;
  }
}
export function localePath(path: string, locale: Locale, defaultLocale: Locale = 'fa') {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.startsWith('/api/') ||
    path.startsWith('/demo/')
  )
    return path;
  const clean = path.replace(/^\/(fa|en)(?=\/|$|\?|#)/, '') || '/';
  return locale === defaultLocale ? clean : `/${locale}${clean === '/' ? '' : clean}`;
}
export function splitPath(parts: string[] = [], defaultLocale: Locale = 'fa') {
  const locale = isLocale(parts[0]) ? parts[0] : defaultLocale;
  return { locale, slug: (isLocale(parts[0]) ? parts.slice(1) : parts).join('/') || 'home' };
}
export function pagePath(id: string | undefined, slug: string | undefined, site: SiteDescriptor) {
  for (const [key, binding] of Object.entries(site.themeRuntime?.bindings ?? {})) {
    if (Object.hasOwn(SLOT_PATHS, key) && id && binding?.id === id)
      return SLOT_PATHS[key as SlotKey];
  }
  return !slug || slug === 'home' ? '/' : `/${slug.split('/').map(encodeURIComponent).join('/')}`;
}
export function linkHref(
  link: LinkData | undefined,
  site: SiteDescriptor,
  locale: Locale,
): string | null {
  if (!link) return null;
  let href = link.url;
  if (link.type === 'reference') {
    const ref = link.reference?.value;
    if (!ref) return null;
    const id = typeof ref === 'string' ? ref : ref.id;
    const bound =
      !!id && Object.values(site.themeRuntime?.bindings ?? {}).some((b) => b?.id === id);
    if (typeof ref === 'object' && !ref.slug && !bound) return null;
    if (link.reference?.relationTo && !['pages', 'posts'].includes(link.reference.relationTo))
      return null;
    if (typeof ref === 'object' && ref._status === 'draft') return null;
    if (
      typeof ref === 'string' &&
      !Object.values(site.themeRuntime?.bindings ?? {}).some((b) => b?.id === id)
    )
      return null;
    href =
      link.reference?.relationTo === 'posts' && typeof ref === 'object' && ref.slug
        ? `/posts/${encodeURIComponent(ref.slug)}`
        : pagePath(id, typeof ref === 'object' ? ref.slug : undefined, site);
  }
  const safe = safeHref(href);
  return safe ? localePath(safe, locale, site.defaultLocale) : null;
}
export function mediaSrc(media: Media | string | null | undefined): string | null {
  if (!media || typeof media === 'string' || !media.url) return null;
  const safe = safeHref(media.url);
  if (!safe) return null;
  if (safe.startsWith('/api/media/file/') || safe.startsWith('/demo/')) return safe;
  // Only tenant CMS media, not arbitrary remote tracking pixels or credentials.
  try {
    const url = new URL(safe);
    return url.pathname.startsWith('/api/media/file/') ? url.pathname : null;
  } catch {
    return null;
  }
}
export function setting(site: SiteDescriptor, key: string, locale: Locale, fallback = ''): string {
  const settings = site.themeRuntime?.settings ?? {};
  const value = settings[`${key}${locale === 'en' ? 'En' : 'Fa'}`] ?? settings[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function actionEvent(
  href: string,
  site: SiteDescriptor,
  locale: Locale,
): 'demo_cta' | 'onboarding_click' | undefined {
  const demo = localePath('/demo', locale, site.defaultLocale);
  const owner = safeHref(setting(site, 'ownerSignupHref', locale));
  if (href === demo || href.startsWith(demo + '?') || href.startsWith(demo + '#'))
    return 'demo_cta';
  return owner && href === localePath(owner, locale, site.defaultLocale)
    ? 'onboarding_click'
    : undefined;
}
