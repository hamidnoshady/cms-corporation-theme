import { createHash } from 'node:crypto';
/** Process-local first line of defence; the CRM applies a durable per-credential limit. */
export class RateLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  constructor(
    private limit = 10,
    private windowMs = 60_000,
    private maxKeys = 2000,
  ) {}
  allow(key: string, now = Date.now()) {
    for (const [k, bucket] of this.buckets) if (bucket.until <= now) this.buckets.delete(k);
    const bucket = this.buckets.get(key);
    if (bucket) {
      if (bucket.count >= this.limit) return false;
      bucket.count++;
      return true;
    }
    if (this.buckets.size >= this.maxKeys) return false;
    this.buckets.set(key, { count: 1, until: now + this.windowMs });
    return true;
  }
}
export function rateKey(request: Request) {
  // Only trust a header explicitly configured AND overwritten by the deployment edge.
  const header = process.env.APEX_TRUSTED_IP_HEADER;
  const value = header
    ? request.headers.get(header)?.split(',')[0]?.trim().slice(0, 80)
    : undefined;
  return createHash('sha256')
    .update(value ?? 'shared-untrusted')
    .digest('hex');
}
