import 'server-only';
import { randomUUID } from 'node:crypto';
import { serverUrl } from '../security/http';
import { sign, verify } from '../security/signatures';
export function formSecret() {
  return process.env.LEAD_FORM_SECRET ?? process.env.ESHOBE_REVALIDATE_SECRET ?? '';
}
export function leadConfigured() {
  return Boolean(
    serverUrl(process.env.BIZAMIZ_LEAD_WEBHOOK_URL) &&
      process.env.BIZAMIZ_LEAD_TOKEN &&
      formSecret(),
  );
}
export function createChallenge(now = Date.now()) {
  const payload = `${now}:${randomUUID()}`;
  return `${payload}:${sign(payload, `apex-lead:${formSecret()}`)}`;
}
export function verifyChallenge(token: unknown, now = Date.now()): string | null {
  if (typeof token !== 'string' || token.length > 200 || !formSecret()) return null;
  const [issued, nonce, signature, extra] = token.split(':');
  const time = Number(issued);
  if (
    extra ||
    !Number.isSafeInteger(time) ||
    now - time < 1500 ||
    now - time > 3_600_000 ||
    !/^[a-f0-9-]{36}$/.test(nonce ?? '')
  )
    return null;
  return verify(`${issued}:${nonce}`, signature, `apex-lead:${formSecret()}`) ? nonce : null;
}
export type LeadPayload = {
  name: string;
  phone: string;
  email: string;
  message: string;
  source: Record<string, unknown>;
  consent: { contact: true; marketing: false; timestamp: string; policyVersion: string };
};
export type LeadResult = { ok: true; duplicate: boolean } | { ok: false; status: 429 | 502 | 503 };
export async function deliverLead(
  payload: LeadPayload,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<LeadResult> {
  const url = serverUrl(process.env.BIZAMIZ_LEAD_WEBHOOK_URL);
  if (!url || !process.env.BIZAMIZ_LEAD_TOKEN) return { ok: false, status: 503 };
  // This is Biza Miz's actual /api/website/leads contract. Same idempotency key
  // for network retries: upstream stores exactly one CRM lead durably.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetcher(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.BIZAMIZ_LEAD_TOKEN}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
        cache: 'no-store',
      });
      if (res.status === 429) return { ok: false, status: 429 };
      if (res.ok) {
        const body: unknown = await res.json();
        if (
          body &&
          typeof body === 'object' &&
          (body as { accepted?: unknown }).accepted === true &&
          typeof (body as { id?: unknown }).id === 'string'
        )
          return { ok: true, duplicate: (body as { duplicate?: unknown }).duplicate === true };
        return { ok: false, status: 502 };
      }
      if (![502, 503, 504].includes(res.status))
        return { ok: false, status: res.status === 401 || res.status === 403 ? 503 : 502 };
    } catch {
      /* Timeout/network ambiguity: same durable idempotency key. */
    }
    if (!attempt) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { ok: false, status: 502 };
}
