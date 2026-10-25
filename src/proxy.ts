import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase();
  const configured = [
    process.env.ESHOBE_SITE_DOMAIN,
    ...(process.env.APEX_ALLOWED_HOSTS ?? '').split(','),
  ]
    .filter(Boolean)
    .map((h) => h!.toLowerCase());
  try {
    if (process.env.ESHOBE_PUBLIC_ORIGIN)
      configured.push(new URL(process.env.ESHOBE_PUBLIC_ORIGIN).host.toLowerCase());
  } catch {
    /* invalid config fails closed below */
  }
  // One immutable image per tenant binding. Unknown hosts cannot use its bearer key.
  const cms = Boolean(process.env.ESHOBE_CMS_URL || process.env.ESHOBE_API_KEY);
  const health = request.nextUrl.pathname === '/api/health';
  if (cms && !health && !configured.includes(host))
    return new NextResponse('Unknown host', { status: 404 });
  const headers = new Headers(request.headers);
  const part = request.nextUrl.pathname.split('/')[1];
  const defaultLocale = process.env.ESHOBE_DEFAULT_LOCALE === 'en' ? 'en' : 'fa';
  if (part === defaultLocale) {
    const canonical = request.nextUrl.clone();
    canonical.pathname = canonical.pathname.slice(defaultLocale.length + 1) || '/';
    canonical.host = host;
    canonical.protocol = process.env.ESHOBE_PUBLIC_ORIGIN
      ? new URL(process.env.ESHOBE_PUBLIC_ORIGIN).protocol
      : /^(localhost|127\.0\.0\.1)(:|$)/.test(host)
        ? 'http:'
        : 'https:';
    return NextResponse.redirect(canonical, 308);
  }
  headers.set('x-apex-locale', part === 'fa' || part === 'en' ? part : 'default');
  headers.set('x-apex-path', request.nextUrl.pathname);
  // Never accept a client-supplied preview flag or tenant identity header.
  headers.delete('x-apex-preview');
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'] };
