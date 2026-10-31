import assert from 'node:assert/strict';
const base = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:3000';
// CMS readiness is separate from liveness. Probe it only when the operator gives
// a token; the value is never printed and never sent anywhere else.
const readyToken = process.env.SMOKE_READY_TOKEN ?? process.env.ESHOBE_REVALIDATE_SECRET;
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

if (readyToken) {
  const response = await fetch(new URL('/api/ready', base), {
    headers: { Authorization: `Bearer ${readyToken}` },
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  const report = await response.json().catch(() => ({}));
  assert.equal(
    response.status,
    200,
    `/api/ready: not ready (${JSON.stringify(report.hints ?? [])})`,
  );
  assert.equal(report.ok, true, '/api/ready: ok was not true');
  assert.equal(report.checks?.cms, 'ok', '/api/ready: CMS check was not ok');
  assert.ok(!JSON.stringify(report).includes(readyToken), '/api/ready leaked its token');
  console.log(`PASS /api/ready (${report.origin}, ${report.latencyMs} ms)`);
} else {
  console.log(
    'SKIP /api/ready (set SMOKE_READY_TOKEN or ESHOBE_REVALIDATE_SECRET to probe CMS readiness)',
  );
}
