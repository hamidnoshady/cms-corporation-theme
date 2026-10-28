import 'server-only';
import { serverUrl } from '../security/http';
import { siteOrigin } from '../cms/client';
export const browserEvents = ['pageview', 'demo_cta', 'onboarding_click'] as const;
export const conversionEvents = ['demo_completed', 'activation', 'settled_top_up'] as const;
export function analyticsConfigured() {
  return Boolean(process.env.PLAUSIBLE_DOMAIN && serverUrl(process.env.PLAUSIBLE_EVENTS_URL));
}
export async function sendEvent(event: string, path = '/') {
  const url = serverUrl(process.env.PLAUSIBLE_EVENTS_URL);
  if (!url || !process.env.PLAUSIBLE_DOMAIN) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Apex/1.0' },
      body: JSON.stringify({
        name: event,
        url: new URL(path, siteOrigin()).toString(),
        domain: process.env.PLAUSIBLE_DOMAIN,
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    return res.ok && res.headers.get('x-plausible-dropped') !== '1';
  } catch {
    return false;
  }
}
