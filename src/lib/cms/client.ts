import 'server-only';
import { createHash } from 'node:crypto';
import { StaleCache } from './cache';
import { serverUrl } from '../security/http';

const base = () => (process.env.ESHOBE_CMS_URL ?? '').replace(/\/+$/, '');
const key = () => process.env.ESHOBE_API_KEY ?? '';
export const cmsEnabled = () => Boolean(base() && key());
export const demoEnabled = () =>
  !base() &&
  !key() &&
  (process.env.APEX_DEMO_MODE === 'true' || process.env.NODE_ENV === 'development');
export const cmsTag = () =>
  `cms:${createHash('sha256').update(`${base()}|${key()}`).digest('hex').slice(0, 24)}`;
export const published = { 'where[_status][equals]': 'published', draft: 'false' } as const;
export class CmsError extends Error {
  constructor(public status: number) {
    super(`CMS request failed (${status})`);
  }
}
const descriptorCache = new StaleCache();
export function invalidateCmsCache() {
  descriptorCache.invalidate();
}
export type Query = Record<string, string | number | boolean | undefined>;
export async function cmsGet<T>(path: string, query?: Query, draft = false): Promise<T> {
  if (!cmsEnabled() || !serverUrl(base())) throw new CmsError(503);
  if (!path.startsWith('/api/') || path.includes('..') || path.includes('?'))
    throw new CmsError(400);
  const url = new URL(base() + path);
  for (const [k, v] of Object.entries(query ?? {}))
    if (v !== undefined) url.searchParams.set(k, String(v));
  const load = async (): Promise<T> => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key()}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      redirect: 'error',
      ...(draft || path === '/api/site'
        ? { cache: 'no-store' as const }
        : { cache: 'force-cache' as const, next: { revalidate: 30, tags: [cmsTag()] } }),
    });
    if (!res.ok) throw new CmsError(res.status);
    return (await res.json()) as T;
  };
  // Descriptor responses authenticated by a site key are private upstream; safe
  // process caching must include the credential hash, never a caller's ?site.
  return path === '/api/site' && !draft ? descriptorCache.get(`${cmsTag()}:${url}`, load) : load();
}
export function siteOrigin() {
  const value =
    process.env.ESHOBE_PUBLIC_ORIGIN ??
    (process.env.ESHOBE_SITE_DOMAIN ? `https://${process.env.ESHOBE_SITE_DOMAIN}` : undefined) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000';
  try {
    return new URL(value).origin;
  } catch {
    return 'http://localhost:3000';
  }
}
export function deploymentIsPreview() {
  if (demoEnabled() || process.env.APEX_NOINDEX === 'true') return true;
  const canonical = process.env.ESHOBE_SITE_DOMAIN;
  return !canonical || new URL(siteOrigin()).host !== canonical;
}
export async function cmsMedia(path: string, method: string, range: string | null) {
  if (!cmsEnabled() || !serverUrl(base())) throw new CmsError(503);
  return fetch(base() + path, {
    method,
    headers: { Authorization: `Bearer ${key()}`, ...(range ? { Range: range } : {}) },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
}
