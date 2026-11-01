import 'server-only';
import { cmsEnabled, cmsGet, cmsMedia, CmsError } from './client';

/**
 * Same-origin API surface for `proxiesApi: true` (THEME_API §17b, pattern A).
 *
 * In `direct` mode the customer domain points at this container, so every
 * CMS-owned `/api/*` request arrives here instead of at the CMS. The theme
 * renders server-side with the site key, but a reader of the promise — a browser
 * script, a CMS tool, an embed — may still ask this origin for a public read.
 *
 * Three rules keep this a proxy and not a second CMS:
 *  1. **Reads only.** No collection writes, no visitor credentials, no cookies
 *     are forwarded; theme-owned writes (`/api/leads`, `/api/events`,
 *     `/api/conversions`) keep their own handlers.
 *  2. **Published only.** `draft` and `overrideAccess` are dropped and the
 *     draft-enabled collections get an explicit `_status=published` constraint,
 *     because a site key can read drafts.
 *  3. **No tenant input.** `where[site]` and any `site`/`tenant` query key are
 *     dropped; the site key is the tenant.
 */

/** Draft-enabled collections: the key can read drafts, so publish-filter them. */
const DRAFT_COLLECTIONS = new Set(['pages', 'posts', 'products', 'search']);

const SAFE_SEGMENT = /^[A-Za-z0-9_.~-]{1,160}$/;
const ALLOWED_PARAM = /^(locale|fallbackLocale|depth|limit|page|sort|pagination)$/;
const ALLOWED_PREFIX = /^(select|where)\[/;
const FORBIDDEN_PARAM = /(^|[^a-z])(site|tenant|overrideAccess|draft)/i;

/** Exact two-segment CMS-owned reads (a fixed resource id is validated below). */
const TWO_SEGMENT: Record<string, string[]> = {
  globals: ['header', 'footer'],
  payments: ['methods'],
};

/** One-or-two segment public reads: a collection, optionally one document id. */
const COLLECTIONS = new Set(['pages', 'posts', 'products', 'media', 'search', 'forms']);

type Plan = { path: string; drafts: boolean };

/** Map request segments to a CMS-owned read path, or null when not proxied. */
function plan(segments: string[]): Plan | null {
  if (segments.length < 1 || segments.length > 2) return null;
  if (!segments.every((segment) => SAFE_SEGMENT.test(segment) && !/^\.+$/.test(segment)))
    return null;
  const [first, second] = segments;
  if (first === 'media' && second === 'file') return null;
  const fixed = TWO_SEGMENT[first];
  if (fixed) {
    if (segments.length !== 2 || !fixed.includes(second)) return null;
    return { path: `/api/${first}/${second}`, drafts: false };
  }
  if (!COLLECTIONS.has(first)) return null;
  // `search` is an index, not a collection with a document route.
  if (second && first === 'search') return null;
  return {
    path: `/api/${first}${second ? `/${second}` : ''}`,
    drafts: DRAFT_COLLECTIONS.has(first),
  };
}

/** Query string the upstream may see: shape-safe, tenant-free, published-only. */
export function proxyQuery(params: URLSearchParams, drafts: boolean): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of params) {
    if (value.length > 512) continue;
    if (!ALLOWED_PARAM.test(key) && !ALLOWED_PREFIX.test(key)) continue;
    if (FORBIDDEN_PARAM.test(key)) continue;
    query[key] = value;
  }
  if (drafts && !Object.keys(query).some((key) => key.startsWith('where[_status]')))
    query['where[_status][equals]'] = 'published';
  return query;
}

function upstreamError(error: unknown) {
  if (error instanceof CmsError) {
    const status = error.status === 404 ? 404 : error.status === 403 ? 404 : 502;
    return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
}

/** Proxy CMS-owned media bytes (private bucket, streamed through the CMS). */
async function media(request: Request, segments: string[]) {
  if (
    !cmsEnabled() ||
    segments.length !== 3 ||
    segments[0] !== 'media' ||
    segments[1] !== 'file' ||
    !segments[2] ||
    /[\\/\u0000-\u001f]/.test(segments[2]) ||
    ['.', '..'].includes(segments[2])
  )
    return new Response(null, { status: 404 });
  try {
    const res = await cmsMedia(
      `/api/media/file/${encodeURIComponent(segments[2])}`,
      request.method === 'HEAD' ? 'HEAD' : 'GET',
      request.headers.get('range'),
    );
    if (![200, 206, 304, 404, 416].includes(res.status)) return new Response(null, { status: 502 });
    const headers = new Headers({
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    for (const h of ['content-type', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(request.method === 'HEAD' ? null : res.body, {
      status: res.status,
      headers,
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

export async function proxyGet(request: Request, segments: string[]) {
  const target = plan(segments);
  if (segments[0] === 'media' && segments[1] === 'file') return media(request, segments);
  if (!target || !cmsEnabled()) return new Response(null, { status: 404 });
  try {
    const body = await cmsGet<unknown>(
      target.path,
      proxyQuery(new URL(request.url).searchParams, target.drafts),
    );
    const headers = {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    };
    return request.method === 'HEAD'
      ? new Response(null, { status: 200, headers })
      : Response.json(body, { headers });
  } catch (error) {
    return upstreamError(error);
  }
}
