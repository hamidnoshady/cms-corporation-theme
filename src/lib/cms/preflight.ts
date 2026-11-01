import 'server-only';

import { cmsKey, resolveCmsOrigin, safeCmsOrigin, type CmsConfigFailure } from './origin';

/**
 * Build/publish-time gate for the CMS origin policy.
 *
 * The runtime already fails closed on a rejected `ESHOBE_CMS_URL`, but only when
 * the first request arrives: every page then renders the global error page and
 * the operator sees an HTTP 500 with an error digest and nothing else. This gate
 * runs the *same* resolver the request path uses, so a value the theme would
 * refuse cannot be baked into an image or handed to a deployment.
 *
 * It performs no network call and never reads or returns the site key.
 */
export type CmsPreflightState = 'ok' | 'unconfigured' | 'invalid';

export type CmsPreflightResult = {
  ok: boolean;
  state: CmsPreflightState;
  /** The policy rule that rejected the value, e.g. `cms_url_untrusted_http`. */
  reason: CmsConfigFailure | null;
  /** Scheme + host + base path only; never credentials and never the key. */
  origin: string | null;
  /** The resolver's operator hint: safe to print in a build log. */
  hint: string | null;
  /** The key is injected at deploy time, so its absence is not an origin failure. */
  keyPresent: boolean;
};

export function preflightCmsOrigin(requireConfigured = false): CmsPreflightResult {
  const keyPresent = cmsKey().trim().length > 0;
  const config = resolveCmsOrigin();
  if (config.ok)
    return { ok: true, state: 'ok', reason: null, origin: safeCmsOrigin(), hint: null, keyPresent };
  // Nothing asked for CMS mode: an image build carries no credentials because
  // Eshobe injects them at deployment. A publish gate sets `requireConfigured`.
  if (config.failure === 'cms_url_missing' && !keyPresent && !requireConfigured)
    return {
      ok: true,
      state: 'unconfigured',
      reason: null,
      origin: null,
      hint: null,
      keyPresent,
    };
  return {
    ok: false,
    state: 'invalid',
    reason: config.failure,
    origin: safeCmsOrigin(),
    hint: config.hint,
    keyPresent,
  };
}
