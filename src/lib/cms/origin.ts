import 'server-only';

/**
 * CMS-specific server origin policy.
 *
 * The shared `serverUrl()` in `src/lib/security/http.ts` is intentionally strict
 * (HTTPS, or loopback with a local-only test flag) and is still used by the lead,
 * analytics and pricing integrations. Deployed Eshobe themes, however, are told to
 * use a direct internal CMS origin such as `http://eshobe-cms-web:3000` that is
 * reachable on a shared Docker network without a Host/SNI-routing proxy.
 *
 * This module keeps that relaxation narrow and explicit:
 *  - HTTPS origins are always accepted (credentials, fragments, queries and paths
 *    are rejected);
 *  - plain HTTP is accepted only for
 *      1. a single-label Docker/Compose service name (`eshobe-cms-web`, and any
 *         other name with no dot, `:` or `localhost`), which cannot be a public
 *         origin, or
 *      2. the exact `host[:port]` named in `APEX_CMS_HTTP_ORIGINS` (operator
 *         opt-in, no wildcards) for multi-label internal DNS names and internal
 *         IP addresses, or
 *      3. loopback during local tests with `APEX_ALLOW_LOCAL_UPSTREAM=true`;
 *  - an arbitrary/public HTTP URL (`http://cms.example.com`), a public IP, a
 *    user-controlled destination, URL credentials or a redirect target can
 *    therefore never become the CMS origin.
 *
 * Only the origin is ever kept, so the site key can only ever be sent to that
 * approved origin.
 */
export type CmsConfigFailure =
  | 'cms_url_missing'
  | 'cms_url_malformed'
  | 'cms_url_scheme'
  | 'cms_url_credentials'
  | 'cms_url_fragment'
  | 'cms_url_query'
  | 'cms_url_path'
  | 'cms_url_untrusted_http'
  | 'cms_key_missing';

export type CmsConfig =
  | { ok: true; origin: URL; label: string }
  | { ok: false; failure: CmsConfigFailure; hint: string };

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const HOST_ENTRY =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d{1,5})?$/;

export function cmsUrlRaw(): string {
  return (process.env.ESHOBE_CMS_URL ?? '').trim();
}

export function cmsKey(): string {
  return process.env.ESHOBE_API_KEY ?? '';
}

/** Both values are present. A rejected origin still counts as configured, so a
 * misconfiguration fails closed instead of falling back to demo content. */
export function cmsConfigured(): boolean {
  return Boolean(cmsUrlRaw() && cmsKey().trim());
}

export function localUpstreamAllowed(): boolean {
  return process.env.APEX_ALLOW_LOCAL_UPSTREAM === 'true';
}

/**
 * Parse `APEX_CMS_HTTP_ORIGINS` into exact `host[:port]` entries.
 * Accepts `host`, `host:port` or a full `http://host:port` value. Wildcards,
 * schemes other than HTTP and anything carrying a path or credentials are ignored.
 */
export function parseCmsHttpOrigins(value = process.env.APEX_CMS_HTTP_ORIGINS ?? ''): string[] {
  const entries = new Set<string>();
  for (const raw of value.split(',')) {
    let entry = raw.trim().toLowerCase();
    if (!entry) continue;
    if (entry.includes('://')) {
      try {
        const url = new URL(entry);
        if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash)
          continue;
        entry = url.host;
      } catch {
        continue;
      }
    }
    entry = entry.replace(/\/+$/, '');
    if (!entry || entry.includes('*') || !HOST_ENTRY.test(entry)) continue;
    entries.add(entry);
  }
  return [...entries];
}

/**
 * A single-label name cannot be a public DNS origin, so it can only resolve
 * inside the deployment's own network namespace (Docker/Compose service name,
 * Kubernetes pod alias, /etc/hosts entry). `localhost` and IP literals are not
 * included: they need the explicit allowlist or the local test flag.
 */
export function isInternalServiceName(hostname: string): boolean {
  const name = hostname.toLowerCase();
  return (
    name !== 'localhost' &&
    !name.includes('.') &&
    !name.includes(':') &&
    /^[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?$/.test(name)
  );
}

function failure(failure: CmsConfigFailure, hint: string): CmsConfig {
  return { ok: false, failure, hint };
}

export function resolveCmsOrigin(raw = cmsUrlRaw()): CmsConfig {
  if (!raw)
    return failure(
      'cms_url_missing',
      'Set ESHOBE_CMS_URL to the reachable CMS origin (Eshobe injects its DEPLOY_CMS_URL value).',
    );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return failure(
      'cms_url_malformed',
      'ESHOBE_CMS_URL must be an absolute origin such as https://cms.example.com or http://eshobe-cms-web:3000.',
    );
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return failure(
      'cms_url_scheme',
      'ESHOBE_CMS_URL must use http or https; include the scheme (a bare host:port is not a URL).',
    );
  if (url.username || url.password)
    return failure(
      'cms_url_credentials',
      'Remove credentials from ESHOBE_CMS_URL; the site key is sent as a bearer header, never in a URL.',
    );
  if (url.hash)
    return failure('cms_url_fragment', 'ESHOBE_CMS_URL must not contain a fragment (#...).');
  if (url.search)
    return failure('cms_url_query', 'ESHOBE_CMS_URL must not contain a query string.');
  if (url.pathname !== '/' && url.pathname !== '')
    return failure(
      'cms_url_path',
      'ESHOBE_CMS_URL must be an origin without a path; the theme appends /api/... itself.',
    );
  if (url.protocol === 'http:') {
    const host = url.host.toLowerCase();
    const allowlist = parseCmsHttpOrigins();
    const loopback = LOOPBACK.has(url.hostname.toLowerCase());
    const trusted =
      allowlist.includes(host) ||
      isInternalServiceName(url.hostname) ||
      (loopback && localUpstreamAllowed());
    if (!trusted)
      return failure(
        'cms_url_untrusted_http',
        `Plain-HTTP CMS origins are rejected for public hosts. Use an internal Docker/Coolify service name (no dot), list the exact origin in APEX_CMS_HTTP_ORIGINS=${host} (no wildcards), or serve the CMS over HTTPS.`,
      );
  }
  const origin = new URL(url.origin);
  return { ok: true, origin, label: origin.origin };
}

/** Redacted origin for diagnostics: scheme + host only, never credentials or path. */
export function safeCmsOrigin(raw = cmsUrlRaw()): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}
