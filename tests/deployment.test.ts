import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInternalServiceName,
  parseCmsHttpOrigins,
  resolveCmsOrigin,
} from '../src/lib/cms/origin';
import { classifyFetchError, classifyStatus, describeFetchError } from '../src/lib/cms/errors';
import { resetCmsDiagnostics } from '../src/lib/cms/diagnostics';
import { cmsGet, cmsMode, cmsTag } from '../src/lib/cms/client';
import { resetReadinessProbe } from '../src/lib/cms/readiness';

/**
 * Deployment regressions for issue #6: the deployed theme must accept an
 * operator-provisioned internal HTTP CMS origin without weakening SSRF policy,
 * and must distinguish failure classes without logging secrets.
 */
const ENV_KEYS = [
  'ESHOBE_CMS_URL',
  'ESHOBE_API_KEY',
  'ESHOBE_SITE_ID',
  'ESHOBE_REVALIDATE_SECRET',
  'ESHOBE_CONTRACT_VERSION',
  'ESHOBE_PUBLIC_ORIGIN',
  'APEX_CMS_HTTP_ORIGINS',
  'APEX_ALLOW_LOCAL_UPSTREAM',
  'APEX_DEMO_MODE',
  'APEX_READY_TOKEN',
  'APEX_TRUSTED_IP_HEADER',
] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const ORIGINAL_FETCH = globalThis.fetch;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function captureLogs() {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(' '));
  };
  return {
    lines,
    restore() {
      console.error = original;
    },
  };
}

beforeEach(() => {
  setEnv({});
  resetCmsDiagnostics();
  resetReadinessProbe();
  globalThis.fetch = ORIGINAL_FETCH;
});

after(() => {
  setEnv(ORIGINAL_ENV as Record<string, string | undefined>);
  globalThis.fetch = ORIGINAL_FETCH;
});

test('CMS origin policy keeps HTTPS and narrows plain HTTP to internal service names', () => {
  for (const value of [
    'https://cms.example.test',
    'https://cms.example.test/',
    'https://10.0.0.12:8443',
  ])
    assert.equal(resolveCmsOrigin(value).ok, true, value);

  // Docker/Compose service names cannot be public origins, so they are allowed
  // without extra configuration: this is the deployed Eshobe topology.
  for (const value of ['http://eshobe-cms-web:3000', 'http://cms', 'http://eshobe_cms_web:3000']) {
    const result = resolveCmsOrigin(value);
    assert.equal(result.ok, true, value);
    assert.equal(result.ok && result.label, value);
  }
  // Loopback and public hosts are not service names.
  for (const host of ['localhost', '127.0.0.1', 'cms.example.test', '[::1]', '-cms', 'cms-'])
    assert.equal(isInternalServiceName(host), false, host);

  const origin = resolveCmsOrigin('https://cms.example.test/nested//path');
  assert.equal(origin.ok, false);
  assert.equal(!origin.ok && origin.failure, 'cms_url_path');

  for (const [value, failure] of [
    ['https://user:pass@cms.example.test', 'cms_url_credentials'],
    ['https://cms.example.test?site=other', 'cms_url_query'],
    ['https://cms.example.test#fragment', 'cms_url_fragment'],
    ['ftp://cms.example.test', 'cms_url_scheme'],
    ['eshobe-cms-web:3000', 'cms_url_scheme'],
    ['not a url', 'cms_url_malformed'],
    ['', 'cms_url_missing'],
    ['http://cms.example.test', 'cms_url_untrusted_http'],
    ['http://10.0.0.12:3000', 'cms_url_untrusted_http'],
    ['http://127.0.0.1:3300', 'cms_url_untrusted_http'],
    ['http://localhost:3300', 'cms_url_untrusted_http'],
  ] as const) {
    const result = resolveCmsOrigin(value);
    assert.equal(result.ok, false, value);
    assert.equal(!result.ok && result.failure, failure, value);
  }

  // A multi-label internal DNS name or an internal IP needs the exact entry.
  setEnv({ APEX_CMS_HTTP_ORIGINS: ' eshobe-cms-web:3000 , http://internal.example.test:8080/ ' });
  assert.deepEqual(parseCmsHttpOrigins(), ['eshobe-cms-web:3000', 'internal.example.test:8080']);
  assert.equal(resolveCmsOrigin('http://internal.example.test:8080').ok, true);
  for (const value of [
    'http://internal.example.test:9090',
    'http://evil.internal.example.test:8080',
    'http://public.example.test:3000',
  ])
    assert.equal(resolveCmsOrigin(value).ok, false, value);
  // An internal address can be trusted by exact host:port.
  setEnv({ APEX_CMS_HTTP_ORIGINS: '10.0.0.12:3000' });
  assert.equal(resolveCmsOrigin('http://10.0.0.12:3000').ok, true);
  assert.equal(resolveCmsOrigin('http://10.0.0.12:3001').ok, false);

  // Wildcards are ignored, never expanded.
  assert.deepEqual(parseCmsHttpOrigins('*'), []);
  setEnv({ APEX_CMS_HTTP_ORIGINS: '*' });
  assert.equal(resolveCmsOrigin('http://internal.example.test:8080').ok, false);
  assert.equal(resolveCmsOrigin('http://cms.example.test').ok, false);
});

test('loopback stays behind the local test flag unless it is allowlisted', () => {
  assert.equal(resolveCmsOrigin('http://127.0.0.1:3300').ok, false);
  setEnv({ APEX_ALLOW_LOCAL_UPSTREAM: 'true' });
  assert.equal(resolveCmsOrigin('http://localhost:3300').ok, true);
  setEnv({ APEX_ALLOW_LOCAL_UPSTREAM: undefined, APEX_CMS_HTTP_ORIGINS: '127.0.0.1:3300' });
  assert.equal(resolveCmsOrigin('http://127.0.0.1:3300').ok, true);
});

test('mode distinguishes configured, misconfigured, demo and unconfigured processes', () => {
  assert.equal(cmsMode(), 'unconfigured');
  setEnv({ APEX_DEMO_MODE: 'true' });
  assert.equal(cmsMode(), 'demo');
  setEnv({ ESHOBE_CMS_URL: 'https://cms.example.test', ESHOBE_API_KEY: 'site-key' });
  assert.equal(cmsMode(), 'cms');
  setEnv({ ESHOBE_CMS_URL: 'http://public.example.test', ESHOBE_API_KEY: 'site-key' });
  assert.equal(cmsMode(), 'invalid');
  setEnv({ ESHOBE_CMS_URL: 'https://cms.example.test', ESHOBE_API_KEY: undefined });
  assert.equal(cmsMode(), 'invalid');
});

test('a rejected CMS origin fails closed before any request is issued', async () => {
  setEnv({ ESHOBE_CMS_URL: 'http://public.example.test', ESHOBE_API_KEY: 'secret-site-key' });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ docs: [] });
  };
  const logs = captureLogs();
  try {
    await assert.rejects(cmsGet('/api/globals/header'), (error: unknown) => {
      const cms = error as { failure?: string; status?: number };
      return cms.failure === 'config_invalid' && cms.status === 503;
    });
    assert.equal(calls, 0);
  } finally {
    logs.restore();
  }
  assert.equal(logs.lines.length, 1);
  const entry = JSON.parse(logs.lines[0].replace(/^\[cms\] /, ''));
  assert.equal(entry.failure, 'config_invalid');
  assert.equal(entry.origin, 'http://public.example.test');
  assert.match(entry.hint, /APEX_CMS_HTTP_ORIGINS=public\.example\.test/);
  assert.ok(!logs.lines[0].includes('secret-site-key'));
});

test('every CMS request failure class is distinguishable and safe', async () => {
  setEnv({
    ESHOBE_CMS_URL: 'http://eshobe-cms-web:3000',
    ESHOBE_API_KEY: 'secret-site-key',
    APEX_CMS_HTTP_ORIGINS: 'eshobe-cms-web:3000',
  });
  const aborted = Object.assign(
    new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
  );
  const fetchFailed = (cause: Error & { code?: string }) => {
    const error = new TypeError('fetch failed');
    error.cause = cause;
    return error;
  };
  const cases: {
    name: string;
    respond: () => Promise<Response>;
    failure: string;
    status: number;
  }[] = [
    {
      name: 'upstream 503',
      respond: async () => new Response(null, { status: 503 }),
      failure: 'upstream_unavailable',
      status: 503,
    },
    {
      name: 'upstream 401',
      respond: async () => new Response(null, { status: 401 }),
      failure: 'auth',
      status: 403,
    },
    {
      name: 'upstream 429',
      respond: async () => new Response(null, { status: 429 }),
      failure: 'rate_limited',
      status: 503,
    },
    {
      name: 'invalid JSON',
      respond: async () => new Response('<html>proxy error</html>', { status: 200 }),
      failure: 'invalid_response',
      status: 502,
    },
    {
      name: 'timeout',
      respond: async () => {
        throw aborted;
      },
      failure: 'timeout',
      status: 503,
    },
    {
      name: 'dns',
      respond: async () => {
        throw fetchFailed(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }));
      },
      failure: 'dns',
      status: 503,
    },
    {
      name: 'refused connection',
      respond: async () => {
        throw fetchFailed(
          Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
        );
      },
      failure: 'network',
      status: 503,
    },
    {
      name: 'redirect',
      respond: async () => {
        throw fetchFailed(new Error('unexpected redirect'));
      },
      failure: 'redirect',
      status: 503,
    },
  ];
  for (const entry of cases) {
    resetCmsDiagnostics();
    const logs = captureLogs();
    let seenUrl = '';
    let seenAuth = '';
    globalThis.fetch = async (input, init) => {
      seenUrl = String(input);
      seenAuth = (init?.headers as Record<string, string>).Authorization;
      return entry.respond();
    };
    try {
      await assert.rejects(
        cmsGet('/api/globals/header'),
        (error: unknown) => {
          const cms = error as { failure?: string; status?: number };
          return cms.failure === entry.failure && cms.status === entry.status;
        },
        entry.name,
      );
    } finally {
      logs.restore();
    }
    assert.equal(seenUrl, 'http://eshobe-cms-web:3000/api/globals/header', entry.name);
    assert.equal(seenAuth, 'Bearer secret-site-key', entry.name);
    assert.ok(logs.lines.length >= 1, `${entry.name}: expected one diagnostic line`);
    assert.ok(!logs.lines.join('\n').includes('secret-site-key'), entry.name);
    assert.match(logs.lines[0], new RegExp(`"failure":"${entry.failure}"`), entry.name);
  }
  assert.equal(classifyStatus(418), 'upstream_error');
  assert.equal(classifyFetchError(new TypeError('fetch failed')), 'network');
  assert.equal(describeFetchError(aborted), 'timeout');
});

test('identical failures are deduplicated inside the log window', async () => {
  setEnv({ ESHOBE_CMS_URL: 'https://cms.example.test', ESHOBE_API_KEY: 'secret-site-key' });
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const logs = captureLogs();
  try {
    for (let i = 0; i < 5; i++) await assert.rejects(cmsGet('/api/globals/header'));
  } finally {
    logs.restore();
  }
  assert.equal(logs.lines.length, 1);
  const entry = JSON.parse(logs.lines[0].replace(/^\[cms\] /, ''));
  assert.equal(entry.failure, 'upstream_unavailable');
  assert.equal(entry.upstreamStatus, 503);
  assert.equal(typeof entry.correlationId, 'string');
  assert.ok(entry.correlationId.length >= 8);
});

test('a healthy CMS read sends the key only to the approved origin', async () => {
  setEnv({
    ESHOBE_CMS_URL: 'http://eshobe-cms-web:3000',
    ESHOBE_API_KEY: 'secret-site-key',
    APEX_CMS_HTTP_ORIGINS: 'eshobe-cms-web:3000',
  });
  let seen: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = async (input, init) => {
    seen = { url: String(input), init };
    return Response.json({ docs: [] });
  };
  assert.deepEqual(await cmsGet('/api/globals/header', { locale: 'fa' }), { docs: [] });
  assert.equal(seen!.url, 'http://eshobe-cms-web:3000/api/globals/header?locale=fa');
  assert.equal(seen!.init!.redirect, 'error');
  assert.equal(
    (seen!.init!.headers as Record<string, string>).Authorization,
    'Bearer secret-site-key',
  );
  assert.equal(cmsTag().startsWith('cms:'), true);
  assert.ok(!cmsTag().includes('secret-site-key'));

  // Non-CMS paths (and path traversal) are refused before a request is made.
  await assert.rejects(cmsGet('https://evil.test/api/site'), /CMS request failed/);
  await assert.rejects(cmsGet('/api/../api/site'), /CMS request failed/);
});
