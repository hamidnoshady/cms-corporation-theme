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
 *  - plain HTTP is accepted only for destinations that are not publicly routable:
 *      1. a single-label Docker/Compose service name (`eshobe-cms-web`),
 *      2. a reserved private DNS suffix (`*.internal`, `*.local`, `*.svc`,
 *         `*.svc.cluster.local`, `*.docker`, `*.lan`, `*.home.arpa`),
 *      3. a private address literal (10/8, 172.16/12, 192.168/16, 169.254/16,
 *         100.64/10, IPv6 fc00::/7 and fe80::/10),
 *      4. the exact `host[:port]` named in `APEX_CMS_HTTP_ORIGINS` (operator
 *         opt-in, no wildcards), or
 *      5. loopback during local tests with `APEX_ALLOW_LOCAL_UPSTREAM=true`;
 *  - an arbitrary/public HTTP URL (`http://cms.example.com`), a public IP, a
 *    user-controlled destination, URL credentials or a redirect target can
 *    therefore never become the CMS origin. Loopback stays rejected by default
 *    because `http://localhost:3000` from inside the container is the theme
 *    itself, which produces the self-routing loop this policy must prevent.
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
  | 'cms_url_self_origin'
  | 'cms_key_missing';

export type CmsConfig =
  | { ok: true; origin: URL; label: string }
  | { ok: false; failure: CmsConfigFailure; hint: string };

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
/** Reserved for private/internal use, so they cannot name a public CMS. */
const INTERNAL_SUFFIXES = [
  '.internal',
  '.local',
  '.localhost',
  '.svc',
  '.svc.cluster.local',
  '.cluster.local',
  '.docker',
  '.lan',
  '.home.arpa',
];
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

/** Reserved `.internal`/`.local`/`.svc` style names: never public DNS. */
export function isInternalSuffixName(hostname: string): boolean {
  const name = hostname.toLowerCase();
  return INTERNAL_SUFFIXES.some((suffix) => name.length > suffix.length && name.endsWith(suffix));
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** RFC1918 / link-local / CGNAT / IPv6 ULA and link-local literals. */
export function isPrivateAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = IPV4.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (v4.slice(1).some((part) => Number(part) > 255)) return false;
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (!host.includes(':')) return false;
  return /^f[cd][0-9a-f]{0,2}:/.test(host) || /^fe[89ab][0-9a-f]?:/.test(host);
}

/** Every plain-HTTP destination this policy accepts without extra configuration. */
export function isTrustedHttpHost(hostname: string): boolean {
  return (
    isInternalServiceName(hostname) || isInternalSuffixName(hostname) || isPrivateAddress(hostname)
  );
}

/** Hosts this deployment publishes, from which a CMS origin would loop back. */
export function publicSiteHosts(): string[] {
  const hosts = new Set<string>();
  for (const value of [
    process.env.ESHOBE_PUBLIC_ORIGIN,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.ESHOBE_SITE_DOMAIN ? `https://${process.env.ESHOBE_SITE_DOMAIN}` : undefined,
  ]) {
    if (!value) continue;
    try {
      hosts.add(new URL(value).host.toLowerCase());
    } catch {
      if (process.env.ESHOBE_SITE_DOMAIN) hosts.add(process.env.ESHOBE_SITE_DOMAIN.toLowerCase());
    }
  }
  return [...hosts];
}

/** True when the CMS origin is this theme's own public origin (a routing loop). */
export function isSelfOrigin(url: URL): boolean {
  const host = url.host.toLowerCase();
  return publicSiteHosts().includes(host);
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
  if (isSelfOrigin(url))
    return failure(
      'cms_url_self_origin',
      `ESHOBE_CMS_URL points at this theme's own public origin (${url.origin}); the container would call itself and the request would loop or answer 503. Set Eshobe's DEPLOY_CMS_URL to a proxy-free internal CMS origin such as http://eshobe-cms-web:3000, then redeploy.`,
    );
  if (url.protocol === 'http:') {
    const host = url.host.toLowerCase();
    const allowlist = parseCmsHttpOrigins();
    const loopback = LOOPBACK.has(url.hostname.toLowerCase());
    const trusted =
      allowlist.includes(host) ||
      isTrustedHttpHost(url.hostname) ||
      (loopback && localUpstreamAllowed());
    if (!trusted)
      return failure(
        'cms_url_untrusted_http',
        `Plain-HTTP CMS origins are accepted only for internal destinations (Docker service name, *.internal/*.local/*.svc, or a private IP). Add the exact origin to APEX_CMS_HTTP_ORIGINS=${host} (no wildcards) if it is internal, or serve the CMS over HTTPS.`,
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
