import 'server-only';
import { cmsEnabled, cmsMedia } from './client';
/** No collection APIs, visitor authorization/cookies, redirects, or tenant query overrides. */
export async function proxyGet(request: Request, segments: string[]) {
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
