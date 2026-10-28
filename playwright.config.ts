import { defineConfig } from '@playwright/test';
import { browserOptions } from './scripts/browser';
// Explicitly isolate fixture servers even when the operator shell has live keys.
const isolatedEnv = Object.fromEntries(
  Object.keys(process.env)
    .filter((key) => /^(ESHOBE_|BIZAMIZ_|PLAUSIBLE_|APEX_|LEAD_FORM_|NEXT_PUBLIC_)/.test(key))
    .map((key) => [key, '']),
);
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled', caret: 'hide' },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    launchOptions: await browserOptions(),
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'demo', testMatch: /marketing\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:3200' } },
    { name: 'cms', testMatch: /cms\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:3201' } },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx tests/fixtures/cms-server.ts',
      url: 'http://127.0.0.1:3300/__health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm start --hostname 0.0.0.0 --port 3200',
      url: 'http://127.0.0.1:3200/api/health',
      reuseExistingServer: false,
      env: {
        ...isolatedEnv,
        APEX_DEMO_MODE: 'true',
        ESHOBE_PUBLIC_ORIGIN: 'http://127.0.0.1:3200',
        NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3200',
      },
    },
    {
      command: 'pnpm start --hostname 0.0.0.0 --port 3201',
      url: 'http://127.0.0.1:3201/api/health',
      reuseExistingServer: false,
      env: {
        ...isolatedEnv,
        ESHOBE_CMS_URL: 'http://127.0.0.1:3300',
        ESHOBE_API_KEY: 'fixture-site-key',
        ESHOBE_SITE_ID: 'fixture-site-a',
        ESHOBE_SITE_DOMAIN: 'fixture.example.test',
        ESHOBE_PUBLIC_ORIGIN: 'http://127.0.0.1:3201',
        APEX_ALLOW_LOCAL_UPSTREAM: 'true',
        ESHOBE_REVALIDATE_SECRET: 'fixture-revalidate-secret',
        ESHOBE_PREVIEW_SECRET: 'fixture-preview-secret',
        BIZAMIZ_LEAD_WEBHOOK_URL: 'http://127.0.0.1:3300/api/website/leads',
        BIZAMIZ_LEAD_TOKEN: 'fixture-lead-token',
        LEAD_FORM_SECRET: 'fixture-form-secret',
        PLAUSIBLE_EVENTS_URL: 'http://127.0.0.1:3300/events',
        PLAUSIBLE_DOMAIN: 'fixture.example.test',
        BIZAMIZ_CONVERSION_SECRET: 'fixture-conversion-secret',
      },
    },
  ],
});
