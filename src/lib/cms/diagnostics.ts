import 'server-only';
import { randomBytes } from 'node:crypto';
import { cmsStatus, type CmsFailure } from './errors';

/**
 * Bounded, structured CMS diagnostics.
 *
 * One line per distinct failure class per window instead of one per request, so a
 * CMS outage cannot flood a container log. A line only ever contains: the failure
 * class, the status, the sanitized origin, the theme-owned request path, a short
 * correlation ID, an operator hint and how many identical failures were folded
 * into it. Never a bearer key, an env value, a header, or an upstream body.
 */
export type CmsLogRecord = {
  failure: CmsFailure;
  correlationId: string;
  origin?: string | null;
  path?: string | null;
  upstreamStatus?: number;
  cause?: string;
  hint?: string;
  reason?: string;
};

const WINDOW_MS = 60_000;
const MAX_KEYS = 64;
const buckets = new Map<string, { lastLog: number; suppressed: number }>();

export const newCorrelationId = () => randomBytes(6).toString('hex');

export function reportCmsFailure(record: CmsLogRecord, now = Date.now()): number {
  const key = [record.failure, record.upstreamStatus ?? '', record.origin ?? '', record.path ?? '']
    .join('|')
    .toLowerCase();
  const bucket = buckets.get(key);
  if (bucket && now - bucket.lastLog < WINDOW_MS) {
    bucket.suppressed += 1;
    return -1;
  }
  const suppressed = bucket?.suppressed ?? 0;
  if (!bucket && buckets.size >= MAX_KEYS) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].lastLog - b[1].lastLog)[0];
    if (oldest) buckets.delete(oldest[0]);
  }
  buckets.set(key, { lastLog: now, suppressed: 0 });
  console.error(
    `[cms] ${JSON.stringify({
      event: 'cms_failure',
      failure: record.failure,
      status: cmsStatus(record.failure),
      upstreamStatus: record.upstreamStatus ?? null,
      origin: record.origin ?? null,
      path: record.path ?? null,
      reason: record.reason ?? null,
      cause: record.cause ?? null,
      correlationId: record.correlationId,
      suppressed,
      hint: record.hint ?? null,
      at: new Date(now).toISOString(),
    })}`,
  );
  return suppressed;
}

/** Test hook: forget dedupe state so the next failure logs again. */
export function resetCmsDiagnostics() {
  buckets.clear();
}
