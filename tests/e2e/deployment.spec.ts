import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Issue #6 regression: a deployed container must consume the CMS through the
 * operator-provisioned internal plain-HTTP origin (no Host-routing proxy) while
 * liveness, readiness and media keep the same origin policy.
 */
const TOKEN = 'fixture-revalidate-secret';
const auth = { Authorization: `Bearer ${TOKEN}` };
/** Dedicated fixture instance: its own origin, so no other local server's data
 * cache can answer for it while the suite runs. */
const FIXTURE = 'http://127.0.0.1:3301';

async function control(request: APIRequestContext, data: Record<string, unknown> = {}) {
  return request.post(`${FIXTURE}/__control`, { data });
}

async function fixture(request: APIRequestContext) {
  return (await request.get(`${FIXTURE}/__control`)).json();
}

test.beforeEach(async ({ request }) => {
  await control(request, {
    cmsDown: false,
    title: 'CMS published homepage',
    redirectSite: false,
    delayMs: 0,
  });
});

test.afterEach(async ({ request }) => {
  await control(request, { cmsDown: false, redirectSite: false, delayMs: 0 });
});

test('the allowlisted internal HTTP CMS origin serves published content in both locales', async ({
  page,
  request,
}) => {
  const before = (await fixture(request)).requests.length;
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('CMS published homepage');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await page.goto('/en');
  await expect(page.locator('h1')).toHaveText('CMS published homepage');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const requests = (await fixture(request)).requests.slice(before) as {
    path: string;
    authorization?: string;
    cookie?: string;
  }[];
  const reads = requests.filter((entry) => entry.path.startsWith('/api/pages'));
  expect(reads.length).toBeGreaterThan(0);
  expect(reads.every((entry) => entry.authorization === 'Bearer fixture-site-key')).toBe(true);
  expect(reads.every((entry) => !entry.cookie)).toBe(true);
});

test('readiness is authenticated, bounded and reports the real CMS contract', async ({
  request,
}) => {
  expect((await request.get('/api/ready')).status()).toBe(401);
  expect(
    (
      await request.get('/api/ready', { headers: { Authorization: 'Bearer not-the-secret' } })
    ).status(),
  ).toBe(401);

  const response = await request.get('/api/ready', { headers: auth });
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const report = await response.json();
  expect(report.ok).toBe(true);
  expect(report.checks).toEqual({ config: 'ok', cms: 'ok', contract: 'ok', site: 'ok' });
  expect(report.origin).toBe('http://127.0.0.1:3301');
  expect(JSON.stringify(report)).not.toContain('fixture-site-key');
  expect(JSON.stringify(report)).not.toContain(TOKEN);

  // Liveness is local, cheap and reports the same mode without a CMS call.
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, mode: 'cms' });
});

test('a CMS outage fails readiness and media, but never liveness', async ({ request }) => {
  await control(request, { cmsDown: true });

  // Readiness coalesces for two seconds, so poll until the fresh probe lands.
  await expect
    .poll(async () => (await request.get('/api/ready', { headers: auth })).status(), {
      timeout: 20_000,
      intervals: [500, 2_500, 2_500, 2_500, 2_500],
    })
    .toBe(503);

  const report = await (await request.get('/api/ready', { headers: auth })).json();
  expect(report.ok).toBe(false);
  expect(report.checks).toMatchObject({ config: 'ok', cms: 'unavailable' });
  expect(report.hints.join(' ')).toMatch(/CMS/);
  expect(JSON.stringify(report)).not.toContain('fixture-site-key');

  // The same approved origin is used for media: a CMS failure is a 502 at the
  // theme proxy, never an unvalidated pass-through or a cached success.
  expect((await request.get('/api/media/file/test.webp')).status()).toBe(502);

  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, mode: 'cms' });
});

test('a redirect or a slow CMS is reported as such, never followed and never leaked', async ({
  request,
}) => {
  // A redirect from the approved origin must not be followed: the key would
  // otherwise travel to an unapproved destination.
  await control(request, { redirectSite: true });
  await expect
    .poll(
      async () => {
        const response = await request.get('/api/ready', { headers: auth });
        if (response.status() === 200) return 'ok';
        return (await response.json()).checks.cms;
      },
      { timeout: 20_000, intervals: [500, 2_500, 2_500, 2_500] },
    )
    .toBe('redirect');
  await control(request, { redirectSite: false });

  // A CMS that exceeds the bounded readiness timeout reports `timeout`, and
  // liveness stays local throughout.
  await control(request, { delayMs: 4_000 });
  await expect
    .poll(
      async () => {
        const response = await request.get('/api/ready', { headers: auth });
        if (response.status() === 200) return 'ok';
        return (await response.json()).checks.cms;
      },
      { timeout: 25_000, intervals: [500, 2_500, 2_500, 2_500, 2_500] },
    )
    .toBe('timeout');
  const report = await (await request.get('/api/ready', { headers: auth })).json();
  expect(report.checks.config).toBe('ok');
  expect(JSON.stringify(report)).not.toContain('fixture-site-key');
  expect((await request.get('/api/health')).status()).toBe(200);
  await control(request, { delayMs: 0 });
});
