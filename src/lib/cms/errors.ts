/**
 * Failure taxonomy for server-only CMS access.
 *
 * Every failure class maps to one status so existing callers keep working, while
 * `failure` and `correlationId` make the classes distinguishable in logs and in
 * the authenticated readiness probe. An error never carries the bearer key, an
 * upstream response body, or any header value.
 */
export type CmsFailure =
  | 'config_missing'
  | 'config_invalid'
  | 'key_missing'
  | 'request_invalid'
  | 'dns'
  | 'network'
  | 'timeout'
  | 'redirect'
  | 'auth'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'upstream_error'
  | 'invalid_response'
  | 'contract_mismatch'
  | 'site_mismatch';

const STATUS: Record<CmsFailure, number> = {
  config_missing: 503,
  config_invalid: 503,
  key_missing: 503,
  request_invalid: 400,
  dns: 503,
  network: 503,
  timeout: 503,
  redirect: 503,
  auth: 403,
  not_found: 404,
  rate_limited: 503,
  upstream_unavailable: 503,
  upstream_error: 502,
  invalid_response: 502,
  contract_mismatch: 502,
  site_mismatch: 403,
};

const RETRYABLE: Record<CmsFailure, boolean> = {
  config_missing: false,
  config_invalid: false,
  key_missing: false,
  request_invalid: false,
  dns: true,
  network: true,
  timeout: true,
  redirect: false,
  auth: false,
  not_found: false,
  rate_limited: true,
  upstream_unavailable: true,
  upstream_error: true,
  invalid_response: true,
  contract_mismatch: false,
  site_mismatch: false,
};

export const cmsStatus = (failure: CmsFailure) => STATUS[failure];

export class CmsError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(
    readonly failure: CmsFailure,
    readonly correlationId = '',
    readonly upstreamStatus?: number,
  ) {
    super(`CMS request failed (${STATUS[failure]}) [${failure}]`);
    this.name = 'CmsError';
    this.status = STATUS[failure];
    this.retryable = RETRYABLE[failure];
  }
}

export const isCmsError = (error: unknown): error is CmsError => error instanceof CmsError;

/** Map an upstream HTTP status to a failure class without reading the body. */
export function classifyStatus(status: number): CmsFailure {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status === 502 || status === 503 || status === 504) return 'upstream_unavailable';
  return 'upstream_error';
}

type ErrorRecord = { name?: string; message?: string; code?: string };

function chain(error: unknown): ErrorRecord[] {
  const seen: ErrorRecord[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const record = current as ErrorRecord;
    seen.push({
      name: typeof record.name === 'string' ? record.name : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
      code: typeof record.code === 'string' ? record.code : undefined,
    });
    current = (current as { cause?: unknown }).cause;
  }
  return seen;
}

/** Classify a rejected fetch without echoing URLs, headers or bodies. */
export function classifyFetchError(error: unknown): CmsFailure {
  const text = chain(error)
    .flatMap((record) => [record.name, record.message, record.code])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (text.includes('redirect')) return 'redirect';
  if (text.includes('timeouterror') || text.includes('aborterror')) return 'timeout';
  if (text.includes('enotfound') || text.includes('eai_again') || text.includes('eai_fail'))
    return 'dns';
  return 'network';
}

/** Short, non-sensitive detail for a log line: an error code or name only. */
export function describeFetchError(error: unknown): string {
  const records = chain(error);
  const code = records.find((record) => record.code)?.code;
  if (code) return code.slice(0, 40);
  const failure = classifyFetchError(error);
  return failure === 'network' ? 'network error' : failure;
}
