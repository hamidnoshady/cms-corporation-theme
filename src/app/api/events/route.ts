import { analyticsConfigured, browserEvents, sendEvent } from '@/lib/integrations/analytics';
import { jsonError, privateHeaders, readBody, sameOrigin } from '@/lib/security/http';
import { RateLimiter, rateKey } from '@/lib/security/rate-limit';
const limiter = new RateLimiter(60);
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError('forbidden', 403);
  if (!limiter.allow(rateKey(request))) return jsonError('rate_limited', 429);
  if (!analyticsConfigured()) return new Response(null, { status: 204, headers: privateHeaders });
  try {
    const body = JSON.parse(await readBody(request, 2048)) as {
      event?: unknown;
      path?: unknown;
      consent?: unknown;
    };
    if (
      body.consent !== true ||
      !browserEvents.includes(body.event as (typeof browserEvents)[number]) ||
      typeof body.path !== 'string' ||
      !/^\/[\p{L}\p{N}/_%.-]*$/u.test(body.path) ||
      body.path.startsWith('//') ||
      body.path.length > 200
    )
      return jsonError('invalid_event', 400);
    await sendEvent(String(body.event), body.path);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch {
    return jsonError('invalid_event', 400);
  }
}
