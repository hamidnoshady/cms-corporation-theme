import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { preflightCmsOrigin } from '../src/lib/cms/preflight';

/**
 * The preflight is the build/publish face of the same policy the request path
 * enforces, so it must accept exactly what `resolveCmsOrigin` accepts — and it
 * must never print or return the site key.
 */
const ENV_KEYS = [
  'ESHOBE_CMS_URL',
  'ESHOBE_API_KEY',
  'APEX_CMS_HTTP_ORIGINS',
  'APEX_ALLOW_LOCAL_UPSTREAM',
  'ESHOBE_PUBLIC_ORIGIN',
  'ESHOBE_SITE_DOMAIN',
  'NEXT_PUBLIC_SITE_URL',
] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const KEY = 'preflight-site-key-value';

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => setEnv({}));
after(() => setEnv(ORIGINAL_ENV as Record<string, string | undefined>));

test('an unconfigured environment is skipped unless the gate is strict', () => {
  const relaxed = preflightCmsOrigin();
  assert.equal(relaxed.ok, true);
  assert.equal(relaxed.state, 'unconfigured');
  assert.equal(relaxed.origin, null);

  const strict = preflightCmsOrigin(true);
  assert.equal(strict.ok, false);
  assert.equal(strict.state, 'invalid');
  assert.equal(strict.reason, 'cms_url_missing');
});

test('a half-configured environment is rejected, not skipped', () => {
  setEnv({ ESHOBE_API_KEY: KEY });
  const result = preflightCmsOrigin();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cms_url_missing');
  assert.equal(result.keyPresent, true);
});

test('a loopback plain-HTTP CMS origin is blocked with the allowlist remedy', () => {
  setEnv({ ESHOBE_CMS_URL: 'http://127.0.0.1:3001', ESHOBE_API_KEY: KEY });
  const result = preflightCmsOrigin();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cms_url_untrusted_http');
  assert.equal(result.origin, 'http://127.0.0.1:3001');
  assert.match(result.hint ?? '', /APEX_CMS_HTTP_ORIGINS=127\.0\.0\.1:3001/);
  assert.ok(!JSON.stringify(result).includes(KEY));
});

test('the same origin passes once the operator allowlists it exactly', () => {
  setEnv({
    ESHOBE_CMS_URL: 'http://127.0.0.1:3001',
    ESHOBE_API_KEY: KEY,
    APEX_CMS_HTTP_ORIGINS: '127.0.0.1:3001',
  });
  const result = preflightCmsOrigin(true);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'ok');
  assert.equal(result.origin, 'http://127.0.0.1:3001');
  assert.ok(!JSON.stringify(result).includes(KEY));
});

test('internal destinations the deployment is told to use are accepted', () => {
  for (const [url, extra] of [
    ['http://eshobe-cms-web:3000', {}],
    ['http://eshobe-cms-web:3000/', {}],
    ['http://cms.internal', {}],
    ['http://10.0.0.7:3001', {}],
    ['https://cms.example.com', {}],
    ['https://cms.example.com/base-path', {}],
    ['http://localhost:3001', { APEX_ALLOW_LOCAL_UPSTREAM: 'true' }],
  ] as const) {
    setEnv({ ESHOBE_CMS_URL: url, ESHOBE_API_KEY: KEY, ...extra });
    const result = preflightCmsOrigin(true);
    assert.equal(result.ok, true, url);
    assert.equal(result.reason, null, url);
  }
});

test('public HTTP, this site own origin and unclean URLs stay blocked', () => {
  const cases: [string, string, Record<string, string>][] = [
    ['http://cms.example.com', 'cms_url_untrusted_http', {}],
    ['https://site.test', 'cms_url_self_origin', { ESHOBE_PUBLIC_ORIGIN: 'https://site.test' }],
    // `..` is normalized away by the URL parser; a duplicate slash is not.
    ['https://cms.example.com/a//b', 'cms_url_path', {}],
    ['https://user:pass@cms.example.com', 'cms_url_credentials', {}],
    ['https://cms.example.com?site=other', 'cms_url_query', {}],
    // A bare host:port parses as a non-HTTP scheme, not as a malformed URL.
    ['cms.example.com:3000', 'cms_url_scheme', {}],
    ['ftp://cms.example.com', 'cms_url_scheme', {}],
    ['not a url', 'cms_url_malformed', {}],
  ];
  for (const [url, reason, extra] of cases) {
    setEnv({ ESHOBE_CMS_URL: url, ESHOBE_API_KEY: KEY, ...extra });
    const result = preflightCmsOrigin(true);
    assert.equal(result.ok, false, url);
    assert.equal(result.reason, reason, url);
    assert.ok(result.hint && result.hint.length > 10, url);
  }
});

test('a missing key is reported without blocking the origin check', () => {
  setEnv({ ESHOBE_CMS_URL: 'https://cms.example.com' });
  const result = preflightCmsOrigin(true);
  assert.equal(result.ok, true);
  assert.equal(result.keyPresent, false);
});
