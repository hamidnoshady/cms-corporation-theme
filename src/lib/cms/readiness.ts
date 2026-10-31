import 'server-only';
import { classifyFetchError, classifyStatus, describeFetchError, type CmsFailure } from './errors';
import { newCorrelationId, reportCmsFailure } from './diagnostics';
import { cmsKey, resolveCmsOrigin, safeCmsOrigin } from './origin';

/**
 * CMS readiness probe (distinct from process liveness).
 *
 * One bounded, redirect-refusing `GET /api/site` with the site key. The result is
 * coalesced for two seconds so a polling operator or orchestrator cannot turn one
 * CMS outage into a request storm, and it never contains the bearer key, upstream
 * headers or an upstream body. Liveness (`/api/health`) stays local and never
 * calls this.
 */
export type CmsCheck =
  | 'ok'
  | 'skipped'
  | 'auth'
  | 'not_found'
  | 'unavailable'
  | 'error'
  | 'unreachable'
  | 'timeout'
  | 'redirect'
  | 'invalid_response';

export type ReadinessChecks = {
  config: 'ok' | 'missing' | 'invalid' | 'key_missing';
  cms: CmsCheck;
  contract: 'ok' | 'mismatch' | 'invalid' | 'skipped';
  site: 'ok' | 'mismatch' | 'inactive' | 'missing' | 'skipped';
};

export type ReadinessReport = {
  ok: boolean;
  checkedAt: string;
  correlationId: string;
  latencyMs: number;
  origin: string | null;
  cached: boolean;
  checks: ReadinessChecks;
  /** Configuration rule code (e.g. `cms_url_self_origin`); never a host or key. */
  reason: string | null;
  hints: string[];
};

const CACHE_MS = 2_000;
const TIMEOUT_MS = 2_500;
let cached: { at: number; report: ReadinessReport } | null = null;
let pending: Promise<ReadinessReport> | null = null;

/** Test hook: drop the coalescing window. */
export function resetReadinessProbe() {
  cached = null;
  pending = null;
}

type SiteLike = { id?: unknown; contractVersion?: unknown; status?: unknown };

const NETWORK_HINT =
  'The CMS origin is not answering from this container. Check the shared Docker network and that ESHOBE_CMS_URL is reachable without a Host/SNI-routing proxy, then redeploy.';

export async function probeCmsReadiness(now = Date.now()): Promise<ReadinessReport> {
  if (cached && now - cached.at < CACHE_MS) return { ...cached.report, cached: true };
  if (pending) return pending;
  const started = Date.now();
  pending = run(started)
    .then((report) => {
      cached = { at: Date.now(), report };
      return report;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

async function run(started: number): Promise<ReadinessReport> {
  const correlationId = newCorrelationId();
  const origin = safeCmsOrigin();
  let reason: string | null = null;
  const build = (
    ok: boolean,
    checks: ReadinessChecks,
    hints: string[] = [],
    rule?: string,
  ): ReadinessReport => ({
    ok,
    checkedAt: new Date().toISOString(),
    correlationId,
    latencyMs: Date.now() - started,
    origin,
    cached: false,
    checks,
    reason: rule ?? reason,
    hints,
  });
  const skipped = { contract: 'skipped', site: 'skipped' } as const;
  const fail = (
    failure: CmsFailure,
    checks: ReadinessChecks,
    hint: string,
    extra: { upstreamStatus?: number; reason?: string; cause?: string } = {},
  ) => {
    reportCmsFailure({ failure, correlationId, origin, path: '/api/site', hint, ...extra });
    if (extra.reason) reason = extra.reason;
    return build(false, checks, [hint], extra.reason);
  };

  const config = resolveCmsOrigin();
  if (!config.ok) {
    const configCheck =
      config.failure === 'cms_url_missing'
        ? 'missing'
        : config.failure === 'cms_key_missing'
          ? 'key_missing'
          : 'invalid';
    return fail(
      configCheck === 'missing'
        ? 'config_missing'
        : configCheck === 'key_missing'
          ? 'key_missing'
          : 'config_invalid',
      { config: configCheck, cms: 'skipped', ...skipped },
      config.hint,
      { reason: config.failure },
    );
  }
  if (!cmsKey().trim())
    return fail(
      'key_missing',
      { config: 'key_missing', cms: 'skipped', ...skipped },
      'Set ESHOBE_API_KEY to the site-scoped key issued by Eshobe for this deployment.',
    );

  let response: Response;
  try {
    response = await fetch(`${config.base}/api/site`, {
      headers: { Authorization: `Bearer ${cmsKey()}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const failure = classifyFetchError(error);
    const cms: CmsCheck =
      failure === 'timeout'
        ? 'timeout'
        : failure === 'redirect'
          ? 'redirect'
          : failure === 'dns' || failure === 'network'
            ? 'unreachable'
            : 'error';
    return fail(failure, { config: 'ok', cms, ...skipped }, NETWORK_HINT, {
      cause: describeFetchError(error),
    });
  }

  if (!response.ok) {
    const failure = classifyStatus(response.status);
    void response.body?.cancel().catch(() => {});
    const cms: CmsCheck =
      failure === 'auth'
        ? 'auth'
        : failure === 'not_found'
          ? 'not_found'
          : failure === 'upstream_unavailable'
            ? 'unavailable'
            : 'error';
    const hint =
      failure === 'auth'
        ? 'The CMS rejected ESHOBE_API_KEY. Confirm the deployment key was issued for this site and was not rotated, then redeploy.'
        : failure === 'not_found'
          ? 'The CMS has no /api/site at this origin; confirm ESHOBE_CMS_URL points at the CMS API origin itself.'
          : 'The CMS answered with an upstream error; retry after it recovers.';
    return fail(failure, { config: 'ok', cms, ...skipped }, hint, {
      upstreamStatus: response.status,
    });
  }

  let site: SiteLike | null;
  try {
    site = (await response.json()) as SiteLike;
  } catch {
    site = null;
  }
  if (!site || typeof site !== 'object') {
    return fail(
      'invalid_response',
      { config: 'ok', cms: 'invalid_response', contract: 'invalid', site: 'skipped' },
      'The CMS origin answered but not with a JSON site descriptor; check that ESHOBE_CMS_URL points at the CMS API, not at a proxy error page.',
      { upstreamStatus: response.status, cause: 'invalid json' },
    );
  }

  const contract: ReadinessChecks['contract'] =
    site.contractVersion === 1 ? 'ok' : site.contractVersion === undefined ? 'invalid' : 'mismatch';
  const expectedId = process.env.ESHOBE_SITE_ID;
  const siteCheck: ReadinessChecks['site'] =
    typeof site.id !== 'string' || !site.id
      ? 'missing'
      : expectedId && site.id !== expectedId
        ? 'mismatch'
        : site.status && site.status !== 'active'
          ? 'inactive'
          : 'ok';
  if (contract !== 'ok')
    return fail(
      'contract_mismatch',
      { config: 'ok', cms: 'ok', contract, site: siteCheck },
      `The CMS /api/site contract does not match this theme build (expected contractVersion ${
        process.env.ESHOBE_CONTRACT_VERSION ?? '1'
      }).`,
    );
  if (siteCheck !== 'ok')
    return fail(
      siteCheck === 'inactive' ? 'not_found' : 'site_mismatch',
      { config: 'ok', cms: 'ok', contract, site: siteCheck },
      siteCheck === 'mismatch'
        ? 'The descriptor belongs to a different site than ESHOBE_SITE_ID; this container is bound to the wrong key.'
        : siteCheck === 'inactive'
          ? 'The CMS reports this site as inactive.'
          : 'The descriptor carries no site id.',
    );
  return build(true, { config: 'ok', cms: 'ok', contract, site: siteCheck });
}
