import assert from 'node:assert/strict';
const base = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:3000';
for (const path of [
  '/api/health',
  '/',
  '/en',
  '/features',
  '/restaurants',
  '/pricing',
  '/demo',
  '/robots.txt',
  '/sitemap.xml',
]) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
  assert.equal(response.status, 200, `${path}: unexpected HTTP status`);
  const text = await response.text();
  if (path === '/api/health') assert.equal(JSON.parse(text).ok, true);
  if (path === '/') {
    assert.match(text, /lang="fa"/);
    assert.match(text, /dir="rtl"/);
  }
  if (path === '/en') {
    assert.match(text, /lang="en"/);
    assert.match(text, /dir="ltr"/);
  }
  assert.ok(!/eshobe_live_/.test(text), 'Unexpected secret-shaped value in public response');
  console.log(`PASS ${path}`);
}
