import 'server-only';
import { createHash } from 'node:crypto';
import { StaleCache } from './cache';
import {
  CmsError,
  classifyFetchError,
  classifyStatus,
  describeFetchError,
  type CmsFailure,
} from './errors';
import { newCorrelationId, reportCmsFailure } from './diagnostics';
import {
  cmsConfigured,
  cmsKey,
  cmsUrlRaw,
  resolveCmsOrigin,
  safeCmsOrigin,
  type CmsConfig,
} from './origin';

export { CmsError } from './errors';

const descriptorCache = new StaleCache();

export const cmsEnabled = () => cmsConfigured();
export const demoEnabled = () =>
  !cmsUrlRaw() &&
  !cmsKey().trim() &&
  (process.env.APEX_DEMO_MODE === 'true' || process.env.NODE_ENV === 'development');
export const cmsTag = () =>
  `cms:${createHash('sha256').update(`${cmsUrlRaw()}|${cmsKey()}`).digest('hex').slice(0, 24)}`;
export const published = { 'where[_status][equals]': 'published', draft: 'false' } as const;

export type CmsMode = 'cms' | 'demo' | 'unconfigured' | 'invalid';
/** Reported by liveness/readiness; never triggers a network call. */
export function cmsMode(): CmsMode {
  const configured = cmsConfigured();
  if (configured) return resolveCmsOrigin().ok ? 'cms' : 'invalid';
  if (cmsUrlRaw() || cmsKey().trim()) return 'invalid';
  return demoEnabled() ? 'demo' : 'unconfigured';
}

export function invalidateCmsCache() {
  descriptorCache.invalidate();
}

/** A logged, fail-closed error for a rejected or missing CMS configuration. */
export function cmsConfigFailure(config: Exclude<CmsConfig, { ok: true }>, correlationId = '') {
  const failure: CmsFailure =
    config.failure === 'cms_key_missing'
      ? 'key_missing'
      : config.failure === 'cms_url_missing'
        ? 'config_missing'
        : 'config_invalid';
  reportCmsFailure({
    failure,
    correlationId,
    origin: safeCmsOrigin(),
    reason: config.failure,
    hint: config.hint,
  });
  return new CmsError(failure, correlationId);
}

const KEY_HINT = 'Set ESHOBE_API_KEY to the site-scoped key issued by Eshobe for this deployment.';

/** The precise, logged, fail-closed configuration error for this process. */
export function cmsConfigurationError(correlationId = newCorrelationId()): CmsError {
  const config = resolveCmsOrigin();
  if (!config.ok) return cmsConfigFailure(config, correlationId);
  if (!cmsKey().trim())
    return cmsConfigFailure(
      { ok: false, failure: 'cms_key_missing', hint: KEY_HINT },
      correlationId,
    );
  return new CmsError('config_invalid', correlationId);
}

/** Resolve the approved CMS origin or throw a logged, fail-closed error. */
export function requireCmsOrigin(correlationId = newCorrelationId()): URL {
  const config = resolveCmsOrigin();
  if (!config.ok || !cmsKey().trim()) throw cmsConfigurationError(correlationId);
  return config.origin;
}

/** A logged error for a descriptor that violates the render contract. */
export function cmsFailureError(
  failure: Extract<CmsFailure, 'contract_mismatch' | 'site_mismatch'>,
  path?: string,
): CmsError {
  const correlationId = newCorrelationId();
  reportCmsFailure({ failure, correlationId, origin: safeCmsOrigin(), path: path ?? null });
  return new CmsError(failure, correlationId);
}

export type Query = Record<string, string | number | boolean | undefined>;

const validPath = (path: string) =>
  path.startsWith('/api/') &&
  !path.includes('..') &&
  !path.includes('?') &&
  !/[\\\u0000-\u001f]/.test(path);

async function request(
  origin: URL,
  path: string,
  search: string,
  correlationId: string,
  init: RequestInit,
  passthrough = false,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(new URL(path + search, origin), init);
  } catch (error) {
    const failure = classifyFetchError(error);
    reportCmsFailure({
      failure,
      correlationId,
      origin: origin.origin,
      path,
      cause: describeFetchError(error),
    });
    throw new CmsError(failure, correlationId);
  }
  if (!res.ok) {
    const failure = classifyStatus(res.status);
    // Media passthrough answers 304/404/416 itself; only log real upstream faults.
    const noteworthy = failure !== 'not_found' && !(passthrough && res.status === 416);
    if (noteworthy)
      reportCmsFailure({
        failure,
        correlationId,
        origin: origin.origin,
        path,
        upstreamStatus: res.status,
      });
    if (passthrough) return res;
    // Never read an upstream error body into memory or into a log.
    void res.body?.cancel().catch(() => {});
    throw new CmsError(failure, correlationId, res.status);
  }
  return res;
}

export async function cmsGet<T>(path: string, query?: Query, draft = false): Promise<T> {
  const correlationId = newCorrelationId();
  const origin = requireCmsOrigin(correlationId);
  if (!validPath(path)) {
    reportCmsFailure({ failure: 'request_invalid', correlationId, origin: origin.origin, path });
    throw new CmsError('request_invalid', correlationId);
  }
  const url = new URL(path, origin);
  for (const [k, v] of Object.entries(query ?? {}))
    if (v !== undefined) url.searchParams.set(k, String(v));
  const load = async (): Promise<T> => {
    const res = await request(origin, path, url.search, correlationId, {
      headers: { Authorization: `Bearer ${cmsKey()}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      redirect: 'error',
      ...(draft || path === '/api/site'
        ? { cache: 'no-store' as const }
        : { cache: 'force-cache' as const, next: { revalidate: 30, tags: [cmsTag()] } }),
    });
    try {
      return (await res.json()) as T;
    } catch {
      reportCmsFailure({
        failure: 'invalid_response',
        correlationId,
        origin: origin.origin,
        path,
        upstreamStatus: res.status,
        cause: 'invalid json',
      });
      throw new CmsError('invalid_response', correlationId, res.status);
    }
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
  const correlationId = newCorrelationId();
  const origin = requireCmsOrigin(correlationId);
  if (!validPath(path)) {
    reportCmsFailure({ failure: 'request_invalid', correlationId, origin: origin.origin, path });
    throw new CmsError('request_invalid', correlationId);
  }
  return request(
    origin,
    path,
    '',
    correlationId,
    {
      method,
      headers: { Authorization: `Bearer ${cmsKey()}`, ...(range ? { Range: range } : {}) },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    },
    true,
  );
}
