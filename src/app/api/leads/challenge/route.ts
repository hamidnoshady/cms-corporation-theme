import { createChallenge, leadConfigured } from '@/lib/integrations/leads';
import { RateLimiter, rateKey } from '@/lib/security/rate-limit';
import { jsonError, privateHeaders } from '@/lib/security/http';
const limiter = new RateLimiter(40);
export function GET(request: Request) {
  if (!leadConfigured()) return jsonError('not_configured', 503);
  if (!limiter.allow(rateKey(request)))
    return jsonError('rate_limited', 429, { 'Retry-After': '60' });
  return Response.json({ token: createChallenge() }, { headers: privateHeaders });
}
