import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readCmsJson, STATUS_HINTS, FETCH_HINTS } from '../src/lib/cms/gate';

/**
 * The operator launch gate must turn every CMS read failure into a classified,
 * printable hint instead of a stack trace, and it must keep matching the failure
 * classes `/api/ready` reports.
 */
const BASE = 'https://cms.example.test/base';
const KEY = 'gate-site-key-value';
const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});
after(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

/** Capture the request the reader makes so the contract can be asserted. */
function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return impl(url, init);
  }) as typeof fetch;
  return calls;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('a readable descriptor returns data and sends the key only to the approved base', async () => {
  const calls = mockFetch(async () => jsonResponse({ contractVersion: 1, id: 'site-a' }));
  const result = await readCmsJson<{ contractVersion: number }>(BASE, KEY, '/api/site');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.contractVersion, 1);
  assert.equal(calls.length, 1);
  // A CMS under a base path keeps it, exactly like the theme's own client.
  assert.equal(calls[0].url, 'https://cms.example.test/base/api/site');
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${KEY}`);
  assert.equal(calls[0].init?.redirect, 'error');
});

test('a rejected key is classified as auth with the key-rotation hint', async () => {
  for (const status of [401, 403]) {
    mockFetch(async () => new Response(null, { status }));
    const result = await readCmsJson(BASE, KEY, '/api/site');
    assert.equal(result.ok, false, String(status));
    if (result.ok) return;
    assert.equal(result.failure, 'auth', String(status));
    assert.match(result.hint, /ESHOBE_API_KEY/);
    assert.match(result.hint, new RegExp(`HTTP ${status}`));
    assert.ok(!result.hint.includes(KEY), 'the key never appears in a hint');
  }
});

test('an unreachable CMS is classified as timeout with its elapsed-time hint', async () => {
  mockFetch(async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  });
  const result = await readCmsJson(BASE, KEY, '/api/site');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failure, 'timeout');
  assert.match(result.hint, /did not answer within 8 s/);
  assert.equal(result.hint, `${FETCH_HINTS.timeout} (timeout)`);
});

test('a descriptor that is not JSON is classified as an unreadable response', async () => {
  for (const body of ['<html>502 Bad Gateway</html>', '']) {
    mockFetch(async () => new Response(body, { status: 200 }));
    const result = await readCmsJson(BASE, KEY, '/api/site');
    assert.equal(result.ok, false, body);
    if (result.ok) return;
    assert.equal(result.failure, 'invalid_response');
    assert.match(result.hint, /did not answer with JSON/);
    assert.equal(result.hint, `${STATUS_HINTS.invalid_response} (HTTP 200)`);
  }
});

test('upstream status classes keep their distinct hints', async () => {
  const cases: [number, string, RegExp][] = [
    [404, 'not_found', /no such path at this origin/],
    [429, 'rate_limited', /rate-limiting/],
    [503, 'upstream_unavailable', /upstream error/],
    [500, 'upstream_error', /unexpected upstream error/],
  ];
  for (const [status, failure, pattern] of cases) {
    mockFetch(async () => new Response(null, { status }));
    const result = await readCmsJson(BASE, KEY, '/api/site');
    assert.equal(result.ok, false, String(status));
    if (result.ok) return;
    assert.equal(result.failure, failure, String(status));
    assert.match(result.hint, pattern, String(status));
    assert.match(result.hint, new RegExp(`HTTP ${status}`), String(status));
  }
});

test('transport failures stay distinguishable: dns, redirect and plain network', async () => {
  const cases: [unknown, string, RegExp][] = [
    [
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }),
      'dns',
      /does not resolve/,
    ],
    [
      Object.assign(new TypeError('fetch failed'), { cause: new Error('unexpected redirect') }),
      'redirect',
      /refuses redirects/,
    ],
    [new TypeError('fetch failed'), 'network', /unreachable from this machine/],
  ];
  for (const [error, failure, pattern] of cases) {
    mockFetch(async () => {
      throw error;
    });
    const result = await readCmsJson(BASE, KEY, '/api/site');
    assert.equal(result.ok, false, failure);
    if (result.ok) return;
    assert.equal(result.failure, failure);
    assert.match(result.hint, pattern);
    assert.ok(!result.hint.includes(KEY));
  }
});

test('an unreadable descriptor never leaks an upstream body into the hint', async () => {
  mockFetch(async () => new Response('{"secret":"upstream-detail"}', { status: 500 }));
  const result = await readCmsJson(BASE, KEY, '/api/site');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(!result.hint.includes('upstream-detail'));
});
