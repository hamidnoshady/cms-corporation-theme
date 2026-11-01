import 'server-only';

import { classifyFetchError, classifyStatus, describeFetchError, type CmsFailure } from './errors';

/**
 * One bounded, redirect-refusing CMS read that classifies its own failure.
 *
 * `/api/ready` answers a single HTTP probe; an operator gate needs the same
 * verdict for a handful of paths but has to print a hint instead of a stack
 * trace. This is that reader: it reuses the runtime failure classes, refuses
 * redirects so the site key can never leave the approved origin, and never puts
 * the key, a response body or a header into its result.
 */
export type CmsRead<T> = { ok: true; value: T } | { ok: false; failure: CmsFailure; hint: string };

/** Actionable text per upstream status class; the HTTP status is appended. */
export const STATUS_HINTS: Partial<Record<CmsFailure, string>> = {
  auth: 'The CMS rejected ESHOBE_API_KEY: confirm the key was issued for this site and has not been rotated.',
  not_found:
    'The CMS has no such path at this origin: confirm ESHOBE_CMS_URL points at the CMS API itself and the base path is right.',
  rate_limited: 'The CMS is rate-limiting this deployment; retry after a pause.',
  upstream_unavailable: 'The CMS is answering with an upstream error; retry once it recovers.',
  upstream_error: 'The CMS answered with an unexpected upstream error.',
  invalid_response:
    'The CMS did not answer with JSON: an edge or proxy error page may sit in front of the API origin.',
};

/** Actionable text per transport failure. */
export const FETCH_HINTS: Partial<Record<CmsFailure, string>> = {
  dns: 'The CMS hostname does not resolve from this machine; check the host and the shared network.',
  network:
    'The CMS origin is unreachable from this machine; check the shared network and that nothing needs Host/SNI routing.',
  timeout: 'The CMS did not answer within 8 s.',
  redirect:
    'The CMS redirected; the theme refuses redirects so the site key can never leave the approved origin.',
};

/**
 * `base` is the approved origin plus optional base path (never a caller value),
 * so the request is `${base}${path}` exactly as the theme's own client builds it.
 */
export async function readCmsJson<T>(
  base: string,
  key: string,
  path: string,
  timeoutMs = 8000,
): Promise<CmsRead<T>> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const failure = classifyFetchError(error);
    return {
      ok: false,
      failure,
      hint: `${FETCH_HINTS[failure] ?? FETCH_HINTS.network} (${describeFetchError(error)})`,
    };
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    const failure = classifyStatus(response.status);
    return {
      ok: false,
      failure,
      hint: `${STATUS_HINTS[failure] ?? STATUS_HINTS.upstream_error} (HTTP ${response.status})`,
    };
  }
  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return {
      ok: false,
      failure: 'invalid_response',
      hint: `${STATUS_HINTS.invalid_response} (HTTP ${response.status})`,
    };
  }
}
