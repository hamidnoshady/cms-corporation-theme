import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const locale of ['fa', 'en'] as const)
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [360, 768, 1024, 1440]) {
      test(`responsive ${locale} ${theme} ${width}${width === 360 || width === 1440 ? ' visual' : ''}`, async ({
        page,
        context,
      }) => {
        await context.addCookies([
          { name: 'apex-theme', value: theme, url: 'http://127.0.0.1:3200' },
        ]);
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(locale === 'en' ? '/en' : '/');
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'fa' ? 'rtl' : 'ltr');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('.hero-copy .btn-primary')).toHaveCSS(
          'color',
          theme === 'dark' ? 'rgb(10, 10, 10)' : 'rgb(255, 255, 255)',
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        if (width === 360 || width === 1440)
          await expect(page).toHaveScreenshot(`home-${locale}-${theme}-${width}.png`, {
            fullPage: true,
          });
        expect(errors).toEqual([]);
        expect(
          await page.locator('.hero-mesh').evaluate((e) => getComputedStyle(e).animationName),
        ).toBe('none');
      });
    }
    test(`accessibility ${locale} ${theme}`, async ({ page, context }) => {
      await context.addCookies([
        { name: 'apex-theme', value: theme, url: 'http://127.0.0.1:3200' },
      ]);
      for (const path of ['', '/features', '/restaurants', '/pricing', '/demo', '/privacy']) {
        await page.goto((locale === 'en' ? '/en' : '') + path || '/');
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(
          results.violations,
          `${locale} ${theme} ${path}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
        ).toEqual([]);
      }
    });
  }
test('mobile dialog traps focus, Escape restores focus, language and theme persist', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/en');
  const opener = page.getByRole('button', { name: 'Open menu' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
  await dialog.getByLabel('Theme', { exact: true }).selectOption('dark');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await opener.click();
  await dialog.getByRole('link', { name: 'تغییر زبان به فارسی' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
test('FAQ works with keyboard and unconfigured form cannot fake delivery', async ({ page }) => {
  await page.goto('/en');
  const summary = page.locator('summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
  await page.goto('/en/demo');
  await expect(page.getByRole('status')).toContainText('Submissions are not enabled');
  await expect(page.getByRole('button', { name: 'Request a demo', exact: true })).toBeDisabled();
});
test('SEO uses locale canonicals and unknown routes are not duplicate homepages', async ({
  page,
  request,
}) => {
  await page.goto('/en/pricing');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://127.0.0.1:3200/en/pricing',
  );
  await expect(page.locator('link[hreflang="fa"]')).toHaveAttribute(
    'href',
    'http://127.0.0.1:3200/pricing',
  );
  expect((await request.get('/fa/pricing', { maxRedirects: 0 })).status()).toBe(308);
  await page.goto('/de');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('منتشر نشده');
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/en/features');
});
test('production performance smoke: bounded JS/image payload and layout shift', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const metrics: { cls: number; lcp: number; maxInteractionDuration: number | null } = {
      cls: 0,
      lcp: 0,
      maxInteractionDuration: null,
    };
    (window as unknown as { metrics: typeof metrics }).metrics = metrics;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[])
        if (!e.hadRecentInput) metrics.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) metrics.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEventTiming & {
        interactionId?: number;
      })[])
        if (entry.interactionId)
          metrics.maxInteractionDuration = Math.max(
            metrics.maxInteractionDuration ?? 0,
            entry.duration,
          );
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
  await page.goto('/en', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('summary').first().click();
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const measurements = await page.evaluate(() => ({
    ...(
      window as unknown as {
        metrics: { cls: number; lcp: number; maxInteractionDuration: number | null };
      }
    ).metrics,
    bytes: performance
      .getEntriesByType('resource')
      .reduce((sum, e) => sum + (e as PerformanceResourceTiming).encodedBodySize, 0),
  }));
  await info.attach('lab-performance.json', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  });
  expect(measurements.cls).toBeLessThan(0.1);
  expect(measurements.maxInteractionDuration ?? 0).toBeLessThan(200);
  expect(measurements.bytes).toBeLessThan(1_500_000);
  // Event Timing entries <16ms can be absent. This is a lab interaction, not field INP.
  // Local smoke is not a field CWV claim; LCP is recorded, not a flaky shared-CPU gate.
});
