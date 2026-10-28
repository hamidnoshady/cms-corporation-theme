import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHmac } from 'node:crypto';
const signature = (raw: string, secret = 'fixture-revalidate-secret') =>
  `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
async function control(request: APIRequestContext, data: Record<string, unknown> = {}) {
  return request.post('http://127.0.0.1:3300/__control', { data });
}
async function revalidate(request: APIRequestContext) {
  const raw = JSON.stringify({ siteId: 'fixture-site-a', paths: ['/'] });
  return request.post('/api/revalidate', {
    data: raw,
    headers: { 'x-eshobe-signature': signature(raw), 'content-type': 'application/json' },
  });
}
async function fixture(request: APIRequestContext) {
  return (await request.get('http://127.0.0.1:3300/__control')).json();
}
test.beforeEach(async ({ request }) => {
  await control(request, {
    cmsDown: false,
    title: 'CMS published homepage',
    draft: false,
    missingEnglish: false,
    foreign: false,
    leadFailures: 0,
    malformedLead: false,
    renamed: false,
  });
  await revalidate(request);
});
test('real CMS bindings, publishing edits, caching, safe public descriptor and host isolation', async ({
  page,
  request,
}) => {
  await page.goto('/en');
  await expect(page.locator('h1')).toHaveText('CMS published homepage');
  await expect(page.locator('header')).toContainText('Fixture company');
  const descriptor = await (await request.get('/api/site?site=other&draft=true')).json();
  expect(descriptor.id).toBeUndefined();
  expect(JSON.stringify(descriptor)).not.toContain('fixture-site-key');
  expect((await request.get('/api/pages?draft=true')).status()).toBe(404);
  expect(
    (await request.get('/api/site', { headers: { Host: 'unknown.example.test' } })).status(),
  ).toBe(404);
  await control(request, { title: 'Published edit without a release' });
  await revalidate(request);
  await expect(async () => {
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Published edit without a release', {
      timeout: 1000,
    });
  }).toPass({ timeout: 15000 });
  const records = (await fixture(request)).requests as {
    path: string;
    authorization?: string;
    cookie?: string;
  }[];
  expect(
    records
      .filter((r) => r.path.startsWith('/api/pages'))
      .every((r) => r.authorization === 'Bearer fixture-site-key' && !r.cookie),
  ).toBe(true);
});
test('draft, missing locale and explicit foreign-site document never render publicly', async ({
  page,
  request,
}) => {
  for (const condition of [
    { draft: true },
    { draft: false, missingEnglish: true },
    { missingEnglish: false, foreign: true },
  ]) {
    await control(request, condition);
    await revalidate(request);
    await expect(async () => {
      const response = await page.goto('/en/features');
      expect(response?.status()).toBe(404);
      await expect(page.locator('h1')).toContainText('has not been published', { timeout: 1000 });
    }).toPass({ timeout: 15000 });
  }
});
test('native CMS preview requires secret AND editor membership and does not leak through a forged cookie', async ({
  page,
  request,
  context,
}) => {
  await control(request, { draft: true });
  await revalidate(request);
  const path = '/en/features';
  const query = new URLSearchParams({
    path,
    previewSecret: 'fixture-preview-secret',
    token: 'fixture-editor-token-site-b',
  });
  expect((await request.get(`/next/preview?${query}`, { maxRedirects: 0 })).status()).toBe(403);
  query.set('token', 'fixture-editor-token-site-a');
  query.set('path', '//evil.test');
  expect((await request.get(`/next/preview?${query}`, { maxRedirects: 0 })).status()).toBe(400);
  query.set('path', path);
  await page.goto(`/next/preview?${query}`);
  await expect(page.locator('aside')).toContainText('Private draft preview');
  await expect(page.locator('h1')).toContainText('connected workflow');
  expect((await context.cookies()).find((c) => c.name === 'apex-preview')?.httpOnly).toBe(true);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.goto('/next/exit-preview');
  await expect(async () => {
    await page.goto(path);
    await expect(page.locator('h1')).toContainText('has not been published', { timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await context.addCookies([
    { name: 'apex-preview', value: 'forged', url: 'http://127.0.0.1:3201' },
  ]);
  await page.reload();
  await expect(page.locator('h1')).toContainText('has not been published');
  // Native CMS preview may include the default-locale prefix and a Unicode slug.
  await control(request, { renamed: true, draft: true });
  await revalidate(request);
  for (const locale of ['en', 'fa']) {
    query.set('path', `/${locale}/ویژگی‌های-تازه`);
    await page.goto(`/next/preview?${query}`);
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect(new URL(page.url()).pathname).toBe(
      (locale === 'en' ? '/en' : '') + '/' + encodeURIComponent('ویژگی‌های-تازه'),
    );
    await page.goto('/next/exit-preview');
  }
});
test('lead validation, consent, retry and idempotent handoff use the real Biza Miz contract', async ({
  page,
  request,
}) => {
  await control(request, { leadFailures: 1 });
  await page.addInitScript(() => localStorage.setItem('apex-analytics', 'yes'));
  let submission = '';
  page.on('request', (r) => {
    if (r.url().endsWith('/api/leads') && r.method() === 'POST') submission = r.postData() ?? '';
  });
  await page.goto('/en/demo?utm_source=contract-test');
  const submit = page.getByRole('button', { name: 'Request a demo', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('form').getByRole('alert')).toContainText('highlighted');
  await page.getByLabel('Full name').fill('Test Owner');
  await page.getByLabel('Phone number').fill('۰۹۱۲۳۴۵۶۷۸۹');
  await page.getByLabel('City').fill('Test City');
  await page.getByLabel('Business type').selectOption('cafe');
  await page.getByLabel(/I agree to share/).check();
  await submit.click();
  await expect(page.getByRole('status')).toContainText('reached the sales system');
  const data = await fixture(request);
  const payload = data.leads.at(-1)[1];
  expect(payload.phone).toBe('+989123456789');
  expect(payload.consent).toMatchObject({ contact: true, marketing: false });
  expect(payload.source.utm_source).toBe('contract-test');
  expect(payload.siteId).toBeUndefined();
  const count = data.leads.length;
  expect(
    (
      await request.post('/api/leads', {
        data: submission,
        headers: { Origin: 'http://127.0.0.1:3201', 'Content-Type': 'application/json' },
      })
    ).status(),
  ).toBe(200);
  const replayed = await fixture(request);
  expect(replayed.leads.length).toBe(count);
  expect(
    replayed.events.filter((event: { name: string }) => event.name === 'lead_submitted'),
  ).toHaveLength(1);
  const calls = data.requests.filter((r: { path: string }) => r.path === '/api/website/leads');
  expect(calls.length).toBeGreaterThanOrEqual(2);
  expect(
    (
      await request.post('/api/leads', { headers: { Origin: 'https://evil.test' }, data: {} })
    ).status(),
  ).toBe(403);
});
test('upstream failure cannot create a false success and preserves filled inputs', async ({
  page,
  request,
}) => {
  await control(request, { malformedLead: true });
  await page.goto('/en/demo');
  await page.getByLabel('Full name').fill('Retry Owner');
  await page.getByLabel('Phone number').fill('09123456789');
  await page.getByLabel('City').fill('Test City');
  await page.getByLabel('Business type').selectOption('restaurant');
  await page.getByLabel(/I agree to share/).check();
  const submit = page.getByRole('button', { name: 'Request a demo', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('form').getByRole('alert')).toContainText('not confirmed');
  await expect(page.getByLabel('Full name')).toHaveValue('Retry Owner');
});
test('signed raw revalidation and local health keep working during CMS outage', async ({
  page,
  request,
}) => {
  await page.goto('/en', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toBeVisible();
  await page.close();
  const raw = '{"siteId":"fixture-site-a"}';
  expect(
    (
      await request.post('/api/revalidate', {
        data: raw,
        headers: { 'x-eshobe-signature': 'invalid' },
      })
    ).status(),
  ).toBe(401);
  const other = '{"siteId":"fixture-site-b"}';
  const otherResponse = await request.post('/api/revalidate', {
    data: other,
    headers: { 'x-eshobe-signature': signature(other) },
  });
  expect(await otherResponse.json()).toEqual({ ok: true, purged: false });
  await control(request, { cmsDown: true });
  const before = (await fixture(request)).requests.length;
  expect((await request.get('/api/health')).status()).toBe(200);
  expect((await fixture(request)).requests.length).toBe(before);
  const start = Date.now();
  expect((await revalidate(request)).status()).toBe(200);
  expect(Date.now() - start).toBeLessThan(3000);
  expect((await request.get('/api/site')).status()).toBe(200);
});
test('analytics requires opt-in; verified payment events require a signed server callback', async ({
  page,
  request,
}) => {
  const before = (await fixture(request)).events.length;
  await page.goto('/en');
  await expect(page.getByRole('button', { name: 'Allow analytics' })).toBeVisible();
  expect((await fixture(request)).events.length).toBe(before);
  await page.getByRole('button', { name: 'Allow analytics' }).click();
  await expect.poll(async () => (await fixture(request)).events.length).toBeGreaterThan(before);
  expect(
    (
      await request.post('/api/events', {
        headers: { Origin: 'http://127.0.0.1:3201' },
        data: { event: 'settled_top_up', path: '/', consent: true },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/events', {
        headers: { Origin: 'http://127.0.0.1:3201' },
        data: { event: 'lead_submitted', path: '/', consent: true },
      })
    ).status(),
  ).toBe(400);
  const body = JSON.stringify({
    id: 'fixture-settlement-001',
    event: 'settled_top_up',
    timestamp: new Date().toISOString(),
    consent: true,
    verified: true,
  });
  expect((await request.post('/api/conversions', { data: body })).status()).toBe(401);
  const headers = { 'x-apex-signature': signature(body, 'fixture-conversion-secret') };
  expect((await request.post('/api/conversions', { data: body, headers })).status()).toBe(200);
  expect(await (await request.post('/api/conversions', { data: body, headers })).json()).toEqual({
    ok: true,
    duplicate: true,
  });
});

test('renamed bindings redirect by ID; unbound Persian slugs do not redirect in a loop', async ({
  page,
  request,
}) => {
  await control(request, { renamed: true });
  await revalidate(request);
  await expect(async () => {
    const alias = await request.get('/en/' + encodeURIComponent('ویژگی‌های-تازه'), {
      maxRedirects: 0,
    });
    expect(alias.status()).toBe(308);
    expect(alias.headers().location).toBe('/en/features');
  }).toPass({ timeout: 15000 });
  const response = await page.goto('/en/' + encodeURIComponent('درباره'));
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('An unbound page');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'http://127.0.0.1:3201/en/' + encodeURIComponent('درباره'),
  );
  const forged = await request.get('/en/' + encodeURIComponent('درباره'), {
    headers: { 'x-apex-path': '/en/features', 'x-apex-locale': 'fa' },
  });
  expect(forged.status()).toBe(200);
  expect(await forged.text()).toContain('An unbound page');
});

test('media proxy drops visitor credentials and tenant/draft query selectors', async ({
  request,
}) => {
  const response = await request.get('/api/media/file/test.webp?site=other&draft=true', {
    headers: {
      Authorization: 'Bearer visitor-cannot-pick-tenant',
      Cookie: 'payload-token=visitor-token',
    },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/webp');
  const data = await fixture(request);
  const forwarded = data.requests
    .filter((r: { path: string }) => r.path.startsWith('/api/media/file/'))
    .at(-1);
  expect(forwarded).toMatchObject({
    path: '/api/media/file/test.webp',
    authorization: 'Bearer fixture-site-key',
  });
  expect(forwarded.cookie).toBeUndefined();
});
