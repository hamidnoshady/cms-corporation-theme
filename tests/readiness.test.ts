import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { GET as ready } from '../src/app/api/ready/route';
import { GET as health } from '../src/app/api/health/route';
import { resetReadinessProbe } from '../src/lib/cms/readiness';
import { resetCmsDiagnostics } from '../src/lib/cms/diagnostics';

/**
 * Liveness and CMS readiness are separate gates: `/api/health` must stay a local
 * 200 through a CMS outage, `/api/ready` must report the real failure class
 * (authenticated, bounded, secret-free).
 */
const ENV_KEYS = [
  'ESHOBE_CMS_URL',
  'ESHOBE_API_KEY',
  'ESHOBE_SITE_ID',
  'ESHOBE_REVALIDATE_SECRET',
  'ESHOBE_CONTRACT_VERSION',
  'APEX_CMS_HTTP_ORIGINS',
  'APEX_ALLOW_LOCAL_UPSTREAM',
  'APEX_DEMO_MODE',
  'APEX_READY_TOKEN',
] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const ORIGINAL_FETCH = globalThis.fetch;
const SECRET = 'readiness-site-key-value';
const TOKEN = 'r'.repeat(32);

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function patchEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const configured = () =>
  setEnv({
    ESHOBE_CMS_URL: 'https://cms.example.test',
    ESHOBE_API_KEY: SECRET,
    ESHOBE_SITE_ID: 'site-a',
    ESHOBE_REVALIDATE_SECRET: TOKEN,
  });

const request = (token?: string) =>
  new Request('https://site.test/api/ready', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

function mockFetch(impl: () => Promise<Response>) {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return impl();
  };
  return () => calls;
}

beforeEach(() => {
  setEnv({});
  resetReadinessProbe();
  resetCmsDiagnostics();
  globalThis.fetch = ORIGINAL_FETCH;
});

after(() => {
  setEnv(ORIGINAL_ENV as Record<string, string | undefined>);
  globalThis.fetch = ORIGINAL_FETCH;
  resetReadinessProbe();
});

test('readiness is authenticated and fails closed without a configured deployment token', async () => {
  configured();
  patchEnv({ ESHOBE_REVALIDATE_SECRET: undefined });
  const unset = await ready(request());
  assert.equal(unset.status, 503);
  assert.deepEqual(await unset.json(), { ok: false, error: 'not_configured' });
  assert.equal(unset.headers.get('cache-control'), 'private, no-store');

  patchEnv({ ESHOBE_REVALIDATE_SECRET: TOKEN });
  assert.equal((await ready(request())).status, 401);
  assert.equal((await ready(request('wrong-token'))).status, 401);
  // The dedicated operator token is accepted as well as the deployment secret.
  const operatorToken = `o${'k'.repeat(31)}`;
  patchEnv({ APEX_READY_TOKEN: operatorToken });
  mockFetch(async () => Response.json({ contractVersion: 1, id: 'site-a', status: 'active' }));
  assert.equal((await ready(request(operatorToken))).status, 200);
});

test('readiness reports CMS availability without leaking the key or the secret', async () => {
  configured();
  mockFetch(async () =>
    Response.json({ contractVersion: 1, id: 'site-a', status: 'active', name: 'Fixture' }),
  );
  const response = await ready(request(TOKEN));
  assert.equal(response.status, 200);
  const text = await response.text();
  const report = JSON.parse(text);
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks, {
    config: 'ok',
    cms: 'ok',
    contract: 'ok',
    site: 'ok',
  });
  assert.equal(report.origin, 'https://cms.example.test');
  assert.equal(typeof report.correlationId, 'string');
  assert.ok(report.correlationId.length >= 8);
  assert.ok(!text.includes(SECRET));
  assert.ok(!text.includes(TOKEN));

  // A second probe inside the coalescing window reuses the bounded result.
  const second = await ready(request(TOKEN));
  assert.equal(second.status, 200);
  assert.equal((await second.json()).cached, true);
});

test('readiness distinguishes configuration, auth, upstream and network failures', async () => {
  const cases: {
    name: string;
    env?: Record<string, string | undefined>;
    fetch?: () => Promise<Response>;
    status: number;
    checks: Record<string, string>;
    reason?: string;
  }[] = [
    {
      name: 'untrusted plain-HTTP origin',
      env: { ESHOBE_CMS_URL: 'http://public.example.test', APEX_CMS_HTTP_ORIGINS: undefined },
      status: 503,
      checks: { config: 'invalid', cms: 'skipped' },
      reason: 'cms_url_untrusted_http',
    },
    {
      name: "CMS origin equal to this site's own origin",
      env: {
        ESHOBE_CMS_URL: 'https://site.test',
        ESHOBE_PUBLIC_ORIGIN: 'https://site.test',
        APEX_CMS_HTTP_ORIGINS: undefined,
      },
      status: 503,
      checks: { config: 'invalid', cms: 'skipped' },
      reason: 'cms_url_self_origin',
    },
    {
      name: 'missing origin',
      env: { ESHOBE_CMS_URL: undefined },
      status: 503,
      checks: { config: 'missing' },
    },
    {
      name: 'missing key',
      env: { ESHOBE_API_KEY: undefined },
      status: 503,
      checks: { config: 'key_missing' },
    },
    {
      name: 'rejected key',
      fetch: async () => new Response(null, { status: 401 }),
      status: 503,
      checks: { cms: 'auth' },
    },
    {
      name: 'CMS 503',
      fetch: async () => new Response(null, { status: 503 }),
      status: 503,
      checks: { cms: 'unavailable' },
    },
    {
      name: 'CMS timeout',
      fetch: async () => {
        throw new DOMException('timeout', 'TimeoutError');
      },
      status: 503,
      checks: { cms: 'timeout' },
    },
    {
      name: 'CMS redirect is not followed',
      fetch: async () => {
        const error = new TypeError('fetch failed');
        error.cause = new Error('unexpected redirect');
        throw error;
      },
      status: 503,
      checks: { cms: 'redirect' },
    },
    {
      name: 'proxy error page instead of JSON',
      fetch: async () => new Response('<html>bad gateway</html>'),
      status: 503,
      checks: { cms: 'invalid_response' },
    },
    {
      name: 'wrong contract version',
      fetch: async () => Response.json({ contractVersion: 2, id: 'site-a' }),
      status: 503,
      checks: { contract: 'mismatch' },
    },
    {
      name: 'descriptor for another site',
      fetch: async () => Response.json({ contractVersion: 1, id: 'site-b' }),
      status: 503,
      checks: { site: 'mismatch' },
    },
    {
      name: 'inactive site',
      fetch: async () => Response.json({ contractVersion: 1, id: 'site-a', status: 'paused' }),
      status: 503,
      checks: { site: 'inactive' },
    },
  ];
  for (const entry of cases) {
    configured();
    if (entry.env) patchEnv(entry.env);
    resetReadinessProbe();
    resetCmsDiagnostics();
    globalThis.fetch = entry.fetch ?? (async () => new Response(null, { status: 502 }));
    const response = await ready(request(TOKEN));
    assert.equal(response.status, entry.status, entry.name);
    const report = await response.json();
    assert.equal(report.ok, false, entry.name);
    for (const [key, value] of Object.entries(entry.checks))
      assert.equal(report.checks[key], value, `${entry.name}: ${key}`);
    assert.equal(typeof report.hints[0], 'string', entry.name);
    if (entry.reason) assert.equal(report.reason, entry.reason, entry.name);
    assert.ok(!JSON.stringify(report).includes(SECRET), entry.name);
    assert.ok(!JSON.stringify(report).includes(TOKEN), entry.name);
  }
});

test('liveness stays a local 200 with a misconfiguration reported, during a CMS outage', async () => {
  configured();
  patchEnv({ ESHOBE_CMS_URL: 'http://public.example.test' });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('Liveness must not call the CMS');
  };
  const response = health();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'invalid');
  assert.equal(body.configIssue, 'cms_url_untrusted_http');
  assert.equal(body.readiness, '/api/ready');
  assert.ok(!JSON.stringify(body).includes('public.example.test'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls, 0);

  configured();
  resetReadinessProbe();
  const callsForReady = mockFetch(async () => new Response(null, { status: 503 }));
  assert.equal((await ready(request(TOKEN))).status, 503);
  assert.equal(callsForReady(), 1);
  assert.equal((await health()).status, 200);
});

test('an internal HTTP CMS origin is ready once the operator allowlists it', async () => {
  setEnv({
    ESHOBE_CMS_URL: 'http://eshobe-cms-web:3000',
    ESHOBE_API_KEY: SECRET,
    ESHOBE_SITE_ID: 'site-a',
    ESHOBE_REVALIDATE_SECRET: TOKEN,
  });
  assert.equal((await ready(request(TOKEN))).status, 503);
  resetReadinessProbe();
  resetCmsDiagnostics();
  patchEnv({ APEX_CMS_HTTP_ORIGINS: 'eshobe-cms-web:3000' });
  const counts = mockFetch(async () =>
    Response.json({ contractVersion: 1, id: 'site-a', status: 'active' }),
  );
  const response = await ready(request(TOKEN));
  const report = await response.json();
  assert.equal(response.status, 200);
  assert.equal(report.checks.config, 'ok');
  assert.equal(report.origin, 'http://eshobe-cms-web:3000');
  assert.equal(counts(), 1);
});

test('demo mode is not a ready production state', async () => {
  setEnv({ APEX_DEMO_MODE: 'true' });
  const response = await ready(request());
  const report = await response.json();
  assert.equal(response.status, 503);
  assert.equal(report.ok, false);
  assert.equal(report.checks.config, 'missing');
});
