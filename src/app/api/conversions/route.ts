import { conversionEvents, sendEvent, analyticsConfigured } from '@/lib/integrations/analytics';
import { verify } from '@/lib/security/signatures';
import { HttpError, jsonError, readBody, privateHeaders } from '@/lib/security/http';
const seen = new Map<string, number>();
const pending = new Set<string>();
/** Optional server-to-server adapter. Browser events can never claim payment/activation. */
export async function POST(request: Request) {
  const secret = process.env.BIZAMIZ_CONVERSION_SECRET;
  if (!secret || !analyticsConfigured()) return jsonError('not_configured', 503);
  try {
    const raw = await readBody(request, 4096);
    if (!verify(raw, request.headers.get('x-apex-signature'), secret))
      return jsonError('unauthorized', 401);
    const body = JSON.parse(raw) as {
      id?: unknown;
      event?: unknown;
      timestamp?: unknown;
      consent?: unknown;
      verified?: unknown;
    };
    if (
      typeof body.id !== 'string' ||
      !/^[a-zA-Z0-9:_-]{8,128}$/.test(body.id) ||
      !conversionEvents.includes(body.event as (typeof conversionEvents)[number]) ||
      typeof body.timestamp !== 'string' ||
      !Number.isFinite(Date.parse(body.timestamp)) ||
      Math.abs(Date.now() - Date.parse(body.timestamp)) > 300_000 ||
      body.verified !== true
    )
      return jsonError('invalid_event', 400);
    if (body.consent !== true) return new Response(null, { status: 204, headers: privateHeaders });
    for (const [key, time] of seen) if (time < Date.now() - 86400_000) seen.delete(key);
    if (seen.has(body.id))
      return Response.json({ ok: true, duplicate: true }, { headers: privateHeaders });
    if (pending.has(body.id) || seen.size >= 10_000)
      return jsonError('retry_later', 503, { 'Retry-After': '5' });
    pending.add(body.id);
    try {
      if (!(await sendEvent(String(body.event)))) return jsonError('analytics_unavailable', 503);
      seen.set(body.id, Date.now());
      return Response.json({ ok: true }, { headers: privateHeaders });
    } finally {
      pending.delete(body.id);
    }
  } catch (err) {
    return jsonError('invalid_event', err instanceof HttpError ? err.status : 400);
  }
}
