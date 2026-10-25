import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify } from '../src/lib/security/signatures';
import { HttpError, readBody, sameOrigin, serverUrl } from '../src/lib/security/http';
import { safeHref, linkHref, localePath, mediaSrc, splitPath } from '../src/lib/cms/urls';
import { demoSnapshot } from '../src/lib/demo/content';
import { encodePreview, decodePreview, normalizePreviewPath } from '../src/lib/security/preview';
import { RateLimiter } from '../src/lib/security/rate-limit';
test('raw-body revalidation contract rejects tampering and malformed hex', () => {
  const raw = '{"siteId":"a"}';
  const secret = 'test-only';
  const sig = sign(raw, secret);
  assert.ok(verify(raw, `sha256=${sig}`, secret));
  assert.ok(!verify(raw + ' ', sig, secret));
  assert.ok(!verify(raw, 'x'.repeat(64), secret));
  assert.ok(!verify(raw, sign(`timestamp.${raw}`, secret), secret));
});
test('bounded stream rejects both oversized known and chunked bodies', async () => {
  await assert.rejects(
    readBody(new Request('https://site.test', { method: 'POST', body: 'oversized' }), 3),
    (e: unknown) => e instanceof HttpError && e.status === 413,
  );
  assert.equal(
    await readBody(new Request('https://site.test', { method: 'POST', body: 'سلام' })),
    'سلام',
  );
});
test('links, media and canonical routes are safe and binding-id based', () => {
  for (const href of [
    'javascript:alert(1)',
    '//evil.test',
    '/\\evil.test',
    'data:text/html,<script>',
    'https://user:pass@evil.test',
    '/path\nheader',
  ])
    assert.equal(safeHref(href), null);
  assert.equal(mediaSrc({ url: 'https://evil.test/tracker.png' }), null);
  assert.equal(
    mediaSrc({ url: 'https://cms.test/api/media/file/logo.svg' }),
    '/api/media/file/logo.svg',
  );
  const site = demoSnapshot('fa').site;
  assert.equal(
    linkHref(
      {
        type: 'reference',
        reference: { value: { id: 'sample-features', slug: 'renamed-persian-title' } },
      },
      site,
      'en',
    ),
    '/en/features',
  );
  assert.equal(localePath('/en/pricing', 'fa', 'fa'), '/pricing');
  assert.deepEqual(splitPath(['en', 'features']), { locale: 'en', slug: 'features' });
  assert.equal(linkHref({ type: 'reference', reference: { value: 'unknown' } }, site, 'fa'), null);
});
test('preview grants are short-lived, signed and bound to the deployed site', () => {
  assert.equal(normalizePreviewPath('/fa/ویژگی‌ها', 'fa'), '/' + encodeURIComponent('ویژگی‌ها'));
  assert.equal(
    normalizePreviewPath('/en/' + encodeURIComponent('درباره'), 'fa'),
    '/en/' + encodeURIComponent('درباره'),
  );
  assert.equal(normalizePreviewPath('/en/features/', 'en'), '/features');
  for (const path of [
    '//evil.test',
    '/x/../api/pages',
    '/%2e%2e/api/pages',
    '/x%2fy',
    '/api/pages',
    '/fa/next/preview',
    '/a%252fb',
  ])
    assert.equal(normalizePreviewPath(path, 'fa'), null);

  const now = Date.now();
  const token = encodePreview({ siteId: 'a', path: '/features', expires: now + 60_000 }, 'secret');
  assert.equal(decodePreview(token, 'secret', 'a', now)?.path, '/features');
  assert.equal(decodePreview(token, 'secret', 'b', now), null);
  assert.equal(decodePreview(token, 'wrong', 'a', now), null);
  assert.equal(decodePreview(token, 'secret', 'a', now + 60_001), null);
});
test('same-origin checks never trust an arbitrary forwarded host', () => {
  assert.ok(
    sameOrigin(
      new Request('https://site.test/api/leads', {
        headers: { host: 'site.test', origin: 'https://site.test' },
      }),
    ),
  );
  assert.ok(
    !sameOrigin(
      new Request('https://site.test/api/leads', {
        headers: {
          host: 'site.test',
          origin: 'https://evil.test',
          'x-forwarded-host': 'evil.test',
        },
      }),
    ),
  );
  assert.equal(serverUrl('http://internal.test'), null);
  assert.equal(serverUrl('https://user:pass@example.test'), null);
});
test('rate limits expire and cap memory for attacker-supplied identities', () => {
  const limiter = new RateLimiter(2, 100, 1);
  assert.ok(limiter.allow('a', 0));
  assert.ok(limiter.allow('a', 1));
  assert.ok(!limiter.allow('a', 2));
  assert.ok(!limiter.allow('b', 3));
  assert.ok(limiter.allow('b', 101));
});
