import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attribution,
  leadFields,
  normalizePhone,
  validateFields,
} from '../src/lib/integrations/form-schema';
import { createChallenge, verifyChallenge, deliverLead } from '../src/lib/integrations/leads';
import { parseCatalogue } from '../src/lib/integrations/pricing';

test('normalizes Persian phone digits and requires valid fields/contact', () => {
  assert.equal(normalizePhone('۰۹۱۲ ۳۴۵ ۶۷۸۹'), '+989123456789');
  const fields = leadFields(null, 'fa');
  assert.equal(Object.keys(validateFields({}, fields).errors).length, 4);
  const result = validateFields(
    {
      name: 'Test Owner',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      email: '',
      city: 'Test City',
      businessType: 'cafe',
      message: '',
      siteId: 'other',
    },
    fields,
  );
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.phone, '+989123456789');
  assert.equal(result.values.siteId, undefined);
  assert.ok(
    validateFields(
      { name: 'x', email: 'nope' },
      leadFields(
        { id: 'form', fields: [{ blockType: 'email', name: 'email', required: true }] },
        'en',
      ),
    ).errors.email,
  );
});
test('form schema rejects unsupported payment/unsafe fields; attribution excludes arbitrary payload', () => {
  const fields = leadFields(
    {
      id: 'f',
      fields: [
        { name: '__proto__', blockType: 'text' },
        { name: 'siteId', blockType: 'text' },
        { name: 'amount', blockType: 'payment' },
      ],
    },
    'en',
  );
  assert.deepEqual(
    fields.map((f) => f.name),
    ['name', 'phone'],
  );
  assert.deepEqual(
    attribution({
      utm_source: 'campaign',
      password: 'secret',
      referrer: 'https://example.test/private?token=secret',
      path: '/demo?email=private',
    }),
    { utm_source: 'campaign', referrer: 'https://example.test' },
  );
});
test('lead challenges expire, require a minimum dwell time, and resist forgery', () => {
  process.env.LEAD_FORM_SECRET = 'test-only-lead-secret';
  const now = Date.now();
  const token = createChallenge(now);
  assert.equal(verifyChallenge(token, now + 100), null);
  assert.ok(verifyChallenge(token, now + 2000));
  assert.equal(verifyChallenge(token + 'x', now + 2000), null);
  assert.equal(verifyChallenge(token, now + 3600001), null);
});
test('lead network retries preserve upstream idempotency and do not treat 2xx garbage as delivery', async () => {
  process.env.BIZAMIZ_LEAD_WEBHOOK_URL = 'https://crm.example.test/api/website/leads';
  process.env.BIZAMIZ_LEAD_TOKEN = 'fixture';
  const calls: RequestInit[] = [];
  const payload = {
    name: 'Test',
    phone: '+989123456789',
    email: '',
    message: '',
    source: {},
    consent: {
      contact: true as const,
      marketing: false as const,
      timestamp: new Date().toISOString(),
      policyVersion: 'v1',
    },
  };
  const fetcher = (async (_url: unknown, init: RequestInit) => {
    calls.push(init);
    return calls.length === 1
      ? new Response('', { status: 503 })
      : Response.json({ accepted: true, id: 'fixture-id' });
  }) as typeof fetch;
  assert.deepEqual(await deliverLead(payload, 'stable-request-id', fetcher), {
    ok: true,
    duplicate: false,
  });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(new Headers(call.headers).get('idempotency-key'), 'stable-request-id');
    assert.equal(call.redirect, 'error');
  }
  assert.deepEqual(
    await deliverLead(payload, 'stable-request-id', (async () =>
      Response.json({ accepted: true })) as typeof fetch),
    { ok: false, status: 502 },
  );
  assert.deepEqual(
    await deliverLead(
      payload,
      'stable-request-id',
      (async () => new Response('', { status: 429 })) as typeof fetch,
    ),
    { ok: false, status: 429 },
  );
});
test('pricing fails closed on expired/ambiguous/unlocalized values, keeps integer minor units', () => {
  const now = Date.now();
  const valid = {
    version: 1,
    publishedAt: new Date(now - 60000).toISOString(),
    validUntil: new Date(now + 60000).toISOString(),
    sourceUrl: 'https://billing.example.test/pricing',
    taxNote: { fa: 'مالیات طبق قرارداد', en: 'Tax per agreement' },
    plans: [
      {
        id: 'approved',
        name: { fa: 'طرح آزمایشی', en: 'Test plan' },
        amountMinor: 12345,
        currency: 'USD',
        period: { fa: 'ماهانه', en: 'monthly' },
        features: [],
      },
    ],
  };
  assert.equal(parseCatalogue(valid, 'en', now)?.plans[0].amountMinor, 12345);
  assert.equal(
    parseCatalogue({ ...valid, validUntil: new Date(now - 1).toISOString() }, 'en', now),
    null,
  );
  assert.equal(
    parseCatalogue({ ...valid, plans: [{ ...valid.plans[0], amountMinor: 1.23 }] }, 'en', now),
    null,
  );
  assert.equal(
    parseCatalogue({ ...valid, plans: [{ ...valid.plans[0], currency: 'UNKNOWN' }] }, 'en', now),
    null,
  );
  assert.equal(parseCatalogue({ ...valid, taxNote: { en: 'only English' } }, 'fa', now), null);
});

test('CMS-edited contact fields keep Biza intake types and name limits', () => {
  const fields = leadFields(
    {
      id: 'edited',
      fields: [
        { name: 'name', blockType: 'checkbox' },
        { name: 'email', blockType: 'text' },
      ],
    },
    'en',
  );
  assert.equal(fields.find((f) => f.name === 'name')?.blockType, 'text');
  assert.equal(fields.find((f) => f.name === 'email')?.blockType, 'email');
  assert.equal(
    validateFields({ name: 'x'.repeat(160), email: 'test@example.test' }, fields).errors.name,
    undefined,
  );
  assert.equal(
    validateFields({ name: 'x'.repeat(161), email: 'test@example.test' }, fields).errors.name,
    'invalid',
  );
  assert.equal(validateFields({ name: 'Test', email: 'invalid' }, fields).errors.email, 'invalid');
  assert.deepEqual(attribution({ path: '//evil.test' }), {});
});
