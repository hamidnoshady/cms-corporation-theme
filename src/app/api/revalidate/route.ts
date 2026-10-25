import { revalidateTag } from 'next/cache';
import { cmsTag, invalidateCmsCache } from '@/lib/cms/client';
import { readBody, HttpError, jsonError, privateHeaders } from '@/lib/security/http';
import { verify } from '@/lib/security/signatures';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const secret = process.env.ESHOBE_REVALIDATE_SECRET;
  if (!secret) return jsonError('not_configured', 503);
  try {
    const raw = await readBody(request, 65_536);
    // v1 signs raw body ONLY; x-eshobe-timestamp is not signed.
    if (!verify(raw, request.headers.get('x-eshobe-signature'), secret))
      return jsonError('unauthorized', 401);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return jsonError('invalid_payload', 400);
    const siteId = (body as { siteId?: unknown }).siteId;
    if (process.env.ESHOBE_SITE_ID && siteId !== process.env.ESHOBE_SITE_ID)
      return Response.json({ ok: true, purged: false }, { headers: privateHeaders });
    invalidateCmsCache();
    revalidateTag(cmsTag(), 'max');
    return Response.json({ ok: true, purged: true }, { headers: privateHeaders });
  } catch (err) {
    return jsonError('invalid_payload', err instanceof HttpError ? err.status : 400);
  }
}
