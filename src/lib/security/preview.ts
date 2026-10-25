import 'server-only';
import { cookies, headers } from 'next/headers';
import { sign, verify } from './signatures';
export const PREVIEW_COOKIE = 'apex-preview';
export type PreviewGrant = { siteId: string; path: string; expires: number };
/** Canonical, header-safe grant scope for raw or encoded native CMS paths. */
export function normalizePreviewPath(value: string, defaultLocale: 'fa' | 'en'): string | null {
  if (!/^\/(?!\/)/.test(value) || value.length > 2048 || /[\\\u0000-\u0020\u007f?#]/.test(value))
    return null;
  try {
    const parts = value.slice(1).replace(/\/$/, '').split('/').map(decodeURIComponent);
    if (
      parts.some(
        (part) => part === '.' || part === '..' || /[/\\\u0000-\u0020\u007f%?#]/.test(part),
      )
    )
      return null;
    if (parts[0] === defaultLocale) parts.shift();
    if (
      parts[0] === 'api' ||
      parts[0] === 'next' ||
      parts.some((part) => !part && parts.length > 1)
    )
      return null;
    const path = '/' + parts.map(encodeURIComponent).join('/');
    return path.length <= 1024 ? path : null;
  } catch {
    return null;
  }
}
export function previewSecret() {
  return process.env.ESHOBE_PREVIEW_SECRET ?? '';
}
export function encodePreview(grant: PreviewGrant, secret: string): string {
  const raw = Buffer.from(JSON.stringify(grant)).toString('base64url');
  return `${raw}.${sign(raw, `apex-preview:${secret}`)}`;
}
export function decodePreview(
  token: string,
  secret: string,
  siteId: string,
  now = Date.now(),
): PreviewGrant | null {
  if (!secret || !siteId || token.length > 2048) return null;
  const [raw, sig, extra] = token.split('.');
  if (extra || !raw || !verify(raw, sig, `apex-preview:${secret}`)) return null;
  try {
    const grant = JSON.parse(Buffer.from(raw, 'base64url').toString()) as PreviewGrant;
    return grant.siteId === siteId &&
      typeof grant.path === 'string' &&
      grant.expires > now &&
      grant.expires <= now + 300_000
      ? grant
      : null;
  } catch {
    return null;
  }
}
export async function isPreviewRequest() {
  const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
  const path = (await headers()).get('x-apex-path');
  const grant = token
    ? decodePreview(token, previewSecret(), process.env.ESHOBE_SITE_ID ?? '')
    : null;
  return Boolean(grant && grant.path === path);
}
