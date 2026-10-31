import { test, expect } from '@playwright/test';

/**
 * Issue #6 fail-closed regression: an untrusted public plain-HTTP CMS origin is
 * rejected before any request is issued. The deployment must show the localized
 * fallback, never demo content, while liveness still answers locally.
 */
test('an untrusted public HTTP CMS origin fails closed with the localized fallback', async ({
  page,
  request,
}) => {
  // Liveness still answers locally, and names the rejecting rule without
  // exposing the configured host to an unauthenticated caller.
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  const healthBody = await health.json();
  expect(healthBody).toMatchObject({
    ok: true,
    mode: 'invalid',
    configIssue: 'cms_url_untrusted_http',
  });
  expect(JSON.stringify(healthBody)).not.toContain('cms.public.example.test');

  const ready = await request.get('/api/ready', {
    headers: { Authorization: 'Bearer fixture-revalidate-secret' },
  });
  expect(ready.status()).toBe(503);
  const report = await ready.json();
  expect(report.ok).toBe(false);
  expect(report.checks).toMatchObject({ config: 'invalid', cms: 'skipped' });
  expect(report.reason).toBe('cms_url_untrusted_http');
  expect(report.hints.join(' ')).toContain('APEX_CMS_HTTP_ORIGINS=cms.public.example.test');
  expect(JSON.stringify(report)).not.toContain('fixture-site-key');

  for (const path of ['/', '/en', '/pricing']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(500);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('سرویس موقتاً در دسترس نیست.');
    await expect(page.locator('body')).toContainText('The site is temporarily unavailable');
    // The reference is a bounded digest, never an error message or upstream detail.
    await expect(page.locator('body')).toContainText('Reference:');
    const html = await page.content();
    expect(html).not.toContain('fixture-site-key');
    expect(html).not.toContain('public.example.test');
  }
});
