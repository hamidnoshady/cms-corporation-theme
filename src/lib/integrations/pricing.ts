import 'server-only';
import { createHash } from 'node:crypto';
import { isCurrencyCode, type CurrencyCode } from '@eshobe/site-runtime';
import type { Locale } from '../cms/types';
import { serverUrl } from '../security/http';
export type Catalogue = {
  sourceUrl: string;
  publishedAt: string;
  validUntil: string;
  taxNote: string;
  plans: {
    id: string;
    name: string;
    amountMinor: number;
    currency: CurrencyCode;
    period: string;
    description: string;
    features: string[];
  }[];
};
const localized = (v: unknown, locale: Locale): string =>
  typeof v === 'string'
    ? v.slice(0, 1000)
    : v && typeof v === 'object' && typeof (v as Record<string, unknown>)[locale] === 'string'
      ? String((v as Record<string, unknown>)[locale]).slice(0, 1000)
      : '';
export function parseCatalogue(raw: unknown, locale: Locale, now = Date.now()): Catalogue | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (
    body.version !== 1 ||
    typeof body.publishedAt !== 'string' ||
    typeof body.validUntil !== 'string' ||
    typeof body.sourceUrl !== 'string'
  )
    return null;
  const published = Date.parse(body.publishedAt);
  const until = Date.parse(body.validUntil);
  if (
    !Number.isFinite(published) ||
    !Number.isFinite(until) ||
    published > now + 300_000 ||
    until <= now ||
    until - published > 7 * 86400_000
  )
    return null;
  if (!serverUrl(body.sourceUrl) || !body.sourceUrl.startsWith('https://')) return null;
  const taxNote = localized(body.taxNote, locale);
  if (!taxNote || !Array.isArray(body.plans) || !body.plans.length || body.plans.length > 24)
    return null;
  const plans: Catalogue['plans'] = [];
  const ids = new Set<string>();
  for (const item of body.plans) {
    if (!item || typeof item !== 'object') return null;
    const p = item as Record<string, unknown>;
    const name = localized(p.name, locale);
    const period = localized(p.period, locale);
    if (
      typeof p.id !== 'string' ||
      ids.has(p.id) ||
      !name ||
      !period ||
      !isCurrencyCode(p.currency) ||
      typeof p.amountMinor !== 'number' ||
      !Number.isSafeInteger(p.amountMinor) ||
      p.amountMinor < 0
    )
      return null;
    ids.add(p.id);
    plans.push({
      id: p.id,
      name,
      period,
      amountMinor: p.amountMinor,
      currency: p.currency,
      description: localized(p.description, locale),
      features: Array.isArray(p.features)
        ? p.features
            .slice(0, 20)
            .map((f) => localized(f, locale))
            .filter(Boolean)
        : [],
    });
  }
  return {
    sourceUrl: body.sourceUrl,
    publishedAt: body.publishedAt,
    validUntil: body.validUntil,
    taxNote,
    plans,
  };
}
export async function getCatalogue(locale: Locale): Promise<Catalogue | null> {
  const url = serverUrl(process.env.BIZAMIZ_CATALOGUE_URL);
  if (!url) return null;
  // Only an explicitly approved *published* feed. Never scrape private billing/wallet endpoints.
  const token = process.env.BIZAMIZ_CATALOGUE_TOKEN;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: {
        revalidate: 300,
        tags: [
          `catalogue:${createHash('sha256')
            .update(`${url}|${token ?? ''}`)
            .digest('hex')
            .slice(0, 20)}`,
        ],
      },
      redirect: 'error',
      signal: AbortSignal.timeout(3500),
    });
    return res.ok ? parseCatalogue(await res.json(), locale) : null;
  } catch {
    return null;
  }
}
