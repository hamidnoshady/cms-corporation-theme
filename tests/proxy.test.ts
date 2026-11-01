import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { proxyGet, proxyQuery } from '../src/lib/cms/proxy';

/**
 * `proxiesApi: true` (THEME_API §17b) makes this container answer CMS-owned
 * `/api/*` in `direct` mode. These tests pin the three rules that keep it a proxy:
 * reads only, published only, and never tenant input.
 */

const env = { ...process.env };
const calls: string[] = [];
let reply: () => Response;

beforeEach(() => {
  calls.length = 0;
  process.env.ESHOBE_CMS_URL = 'https://cms.example.test';
  process.env.ESHOBE_API_KEY = 'fixture-site-key';
  reply = () => Response.json({ docs: [] });
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return reply();
  }) as typeof fetch;
});

after(() => {
  process.env = env;
});

/** What Next hands the catch-all: the segments after `/api/`. */
const api = (path: string, method = 'GET') =>
  proxyGet(
    new Request(`https://shop.example.test/api/${path}`, { method }),
    path.split('?')[0].split('/'),
  );

test('proxies CMS-owned public reads with the site key, never a cookie', async () => {
  for (const [path, upstream] of [
    ['pages', '/api/pages'],
    ['pages/2f1c', '/api/pages/2f1c'],
    ['posts', '/api/posts'],
    ['products', '/api/products'],
    ['media/2f1c', '/api/media/2f1c'],
    ['search', '/api/search'],
    ['forms/2f1c', '/api/forms/2f1c'],
    ['globals/header', '/api/globals/header'],
    ['globals/footer', '/api/globals/footer'],
    ['payments/methods', '/api/payments/methods'],
  ] as const) {
    const res = await api(path);
    assert.equal(res.status, 200, path);
    assert.equal(calls.at(-1)?.split('?')[0], `https://cms.example.test${upstream}`);
  }
  assert.equal(await (await api('pages')).json().then((b) => typeof b), 'object');
});

test('drops drafts, tenant overrides and unknown query keys', async () => {
  await api(
    'pages?draft=true&overrideAccess=true&where[site][equals]=other&where[slug][equals]=home&locale=en&depth=1&page=2&evil=1',
  );
  const url = new URL(calls.at(-1)!);
  assert.equal(url.searchParams.get('draft'), null);
  assert.equal(url.searchParams.get('overrideAccess'), null);
  assert.equal(url.searchParams.get('where[site][equals]'), null);
  assert.equal(url.searchParams.get('evil'), null);
  assert.equal(url.searchParams.get('where[slug][equals]'), 'home');
  assert.equal(url.searchParams.get('locale'), 'en');
  assert.equal(url.searchParams.get('depth'), '1');
  assert.equal(url.searchParams.get('page'), '2');
  // A site key reads drafts, so the proxy publishes-filter every draft collection.
  assert.equal(url.searchParams.get('where[_status][equals]'), 'published');
});

test('keeps collections without versions: no _status constraint on media/globals', async () => {
  await api('media/2f1c');
  await api('globals/header');
  for (const call of calls)
    assert.equal(new URL(call).searchParams.get('where[_status][equals]'), null);
});

test('an explicit status constraint is not doubled', () => {
  const query = proxyQuery(
    new URLSearchParams('where[_status][equals]=published&where[_status][equals]=draft'),
    true,
  );
  assert.deepEqual(
    Object.keys(query).filter((key) => key.startsWith('where[_status]')),
    ['where[_status][equals]'],
  );
});

test('refuses everything that is not a documented CMS-owned read', async () => {
  for (const path of [
    'orders',
    'orders/2f1c',
    'users',
    'api-keys/list',
    'globals/site',
    'payments/callback',
    'search/2f1c',
    'pages/2f1c/extra',
    'pages/..',
    'pages/.',
    'media/file',
    'media/file/..',
    'revalidate',
  ]) {
    const res = await api(path);
    assert.equal(res.status, 404, path);
  }
  assert.deepEqual(calls, []);
});

test('media bytes stream through the CMS with a sandboxed content type', async () => {
  reply = () =>
    new Response(Buffer.from('webp'), {
      status: 200,
      headers: { 'content-type': 'image/webp', etag: '"a"' },
    });
  const res = await api('media/file/logo.webp');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/webp');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await res.text(), 'webp');
  assert.equal(await (await api('media/file/logo.webp', 'HEAD')).text(), '');
});

test('an upstream failure never leaks the CMS body or key', async () => {
  reply = () => Response.json({ message: 'boom', key: 'leak' }, { status: 500 });
  const res = await api('pages');
  assert.equal(res.status, 502);
  assert.equal(await res.text(), '');

  reply = () => Response.json({ message: 'missing' }, { status: 404 });
  assert.equal((await api('pages/2f1c')).status, 404);
});

test('without CMS credentials the proxy answers 404 instead of demo content', async () => {
  delete process.env.ESHOBE_CMS_URL;
  assert.equal((await api('pages')).status, 404);
  assert.deepEqual(calls, []);
});
