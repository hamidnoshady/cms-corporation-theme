/**
 * Boot-time CMS configuration diagnostic.
 *
 * One sanitized line per process start, before any request: the resolved mode, the
 * origin (scheme + host only) and, when the configuration is rejected, the exact
 * policy reason code plus the operator hint. This makes a misconfigured deployment
 * diagnosable from container logs alone — the previous failure mode was a bare
 * `CmsError(503)` with nothing to act on.
 *
 * It never logs the site key, another env value, a header or an upstream body, and
 * it never performs a network call (readiness does that, authenticated).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { cmsMode, cmsConfigIssue } = await import('./lib/cms/client');
  const { safeCmsOrigin, resolveCmsOrigin } = await import('./lib/cms/origin');
  const mode = cmsMode();
  const config = resolveCmsOrigin();
  const payload = {
    event: 'cms_startup',
    mode,
    origin: safeCmsOrigin(),
    reason: config.ok ? null : config.failure,
    hint: config.ok ? null : config.hint,
    configIssue: cmsConfigIssue(),
    readiness: '/api/ready',
  };
  if (mode === 'cms') {
    console.log(`[cms] ${JSON.stringify(payload)}`);
    return;
  }
  console.error(`[cms] ${JSON.stringify(payload)}`);
}
