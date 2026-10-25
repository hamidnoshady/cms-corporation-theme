import { sendEvent } from '@/lib/integrations/analytics';
import { loadSnapshot } from '@/lib/cms/source';
import type { FormDoc } from '@/lib/cms/types';
import {
  createChallenge,
  deliverLead,
  leadConfigured,
  verifyChallenge,
} from '@/lib/integrations/leads';
import { attribution, leadFields, validateFields } from '@/lib/integrations/form-schema';
import { isLocale, setting } from '@/lib/cms/urls';
import { RateLimiter, rateKey } from '@/lib/security/rate-limit';
import { HttpError, jsonError, privateHeaders, readBody, sameOrigin } from '@/lib/security/http';
const perClient = new RateLimiter(8);
const globalLimit = new RateLimiter(120);
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError('forbidden', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return jsonError('unsupported_content_type', 415);
  if (!perClient.allow(rateKey(request)) || !globalLimit.allow('global'))
    return jsonError('rate_limited', 429, { 'Retry-After': '60' });
  try {
    const raw: unknown = JSON.parse(await readBody(request));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return jsonError('invalid_payload', 400);
    const body = raw as Record<string, unknown>;
    if (typeof body.website === 'string' && body.website.trim())
      return Response.json({ ok: true }, { status: 202, headers: privateHeaders });
    if (!leadConfigured()) return jsonError('not_configured', 503);
    const nonce = verifyChallenge(body.challenge);
    if (!nonce)
      return Response.json(
        { ok: false, error: 'challenge_expired', challenge: createChallenge() },
        { status: 400, headers: privateHeaders },
      );
    if (body.consent !== true)
      return Response.json(
        { ok: false, errors: { consent: 'required' } },
        { status: 422, headers: privateHeaders },
      );
    const snap = await loadSnapshot(isLocale(body.locale) ? body.locale : undefined);
    if (snap.preview || (!snap.demo && !snap.pages.privacy))
      return jsonError('not_configured', 503);
    let form: FormDoc | null = snap.form;
    if (body.formId) {
      const forms = [
        snap.form,
        ...Object.values(snap.pages).flatMap((p) =>
          (p?.layout ?? []).map((b) => (typeof b.form === 'object' ? b.form : null)),
        ),
      ].filter((f): f is FormDoc => !!f);
      form = forms.find((f) => f.id === body.formId) ?? null;
      if (!form) return jsonError('invalid_form', 400);
    }
    const { values, errors } = validateFields(body.data, leadFields(form, snap.locale));
    if (Object.keys(errors).length)
      return Response.json({ ok: false, errors }, { status: 422, headers: privateHeaders });
    const details = Object.entries(values)
      .filter(([k]) => !['name', 'phone', 'email', 'message'].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    const result = await deliverLead(
      {
        name: String(values.name),
        phone: String(values.phone ?? ''),
        email: String(values.email ?? '').toLowerCase(),
        message: [values.message, details].filter(Boolean).join('\n\n').slice(0, 5000),
        source: {
          ...attribution(body.attribution),
          locale: snap.locale,
          formId: form?.id ?? 'demo',
          leadReference: nonce,
          analyticsConsent: body.analyticsConsent === true,
        },
        consent: {
          contact: true,
          marketing: false,
          timestamp: new Date().toISOString(),
          policyVersion: setting(snap.site, 'consentVersion', snap.locale, 'contact-v1'),
        },
      },
      nonce,
    );
    if (!result.ok)
      return jsonError(
        result.status === 429
          ? 'rate_limited'
          : result.status === 503
            ? 'not_configured'
            : 'delivery_failed',
        result.status,
        result.status === 429 ? { 'Retry-After': '60' } : {},
      );
    if (body.analyticsConsent === true && !result.duplicate && !snap.demo)
      await sendEvent('lead_submitted', attribution(body.attribution).path ?? '/demo');
    return Response.json({ ok: true, reference: nonce }, { headers: privateHeaders });
  } catch (err) {
    return jsonError(
      'request_failed',
      err instanceof HttpError ? err.status : err instanceof SyntaxError ? 400 : 503,
    );
  }
}
