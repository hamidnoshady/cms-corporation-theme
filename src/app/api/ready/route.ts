import { demoEnabled } from '@/lib/cms/client';
import { probeCmsReadiness } from '@/lib/cms/readiness';
import { RateLimiter, rateKey } from '@/lib/security/rate-limit';
import { equalSecret } from '@/lib/security/signatures';
import { privateHeaders } from '@/lib/security/http';

export const dynamic = 'force-dynamic';

/**
 * CMS readiness probe: a real, bounded `/api/site` read with the site key.
 *
 * Authenticated because every call can reach the CMS and because readiness is not
 * public information. The bearer token must equal `APEX_READY_TOKEN` or the
 * deployment's `ESHOBE_REVALIDATE_SECRET` (the CMS already holds both). Without a
 * configured token the endpoint fails closed instead of answering publicly.
 * Responses never contain the key, upstream headers or an upstream body.
 */
const limiter = new RateLimiter(60, 60_000, 500);

function authorized(request: Request): 'ok' | 'denied' | 'not_configured' {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const allowed = [process.env.APEX_READY_TOKEN, process.env.ESHOBE_REVALIDATE_SECRET].filter(
    (value): value is string => Boolean(value && value.length >= 16),
  );
  if (!allowed.length) return demoEnabled() ? 'ok' : 'not_configured';
  return token && allowed.some((secret) => equalSecret(token, secret)) ? 'ok' : 'denied';
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (auth === 'not_configured')
    return Response.json(
      { ok: false, error: 'not_configured' },
      { status: 503, headers: privateHeaders },
    );
  if (auth === 'denied')
    return Response.json(
      { ok: false, error: 'forbidden' },
      { status: 401, headers: privateHeaders },
    );
  if (!limiter.allow(rateKey(request)))
    return Response.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { ...privateHeaders, 'Retry-After': '60' } },
    );

  const report = await probeCmsReadiness();
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: {
      ...privateHeaders,
      'X-Robots-Tag': 'noindex, nofollow',
      ...(report.ok ? {} : { 'Retry-After': '10' }),
    },
  });
}
