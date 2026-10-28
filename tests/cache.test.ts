import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaleCache } from '../src/lib/cms/cache';
test('coalesces concurrent loads and invalidates without blocking a webhook', async () => {
  const cache = new StaleCache(30000, 300000);
  let calls = 0;
  const load = async () => {
    calls++;
    return 'value';
  };
  assert.deepEqual(await Promise.all([cache.get('a', load), cache.get('a', load)]), [
    'value',
    'value',
  ]);
  assert.equal(calls, 1);
  cache.invalidate();
  assert.equal(await cache.get('a', async () => 'updated'), 'value');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await cache.get('a', load), 'updated');
});
test('serves bounded stale on outage, never mixes tenant keys', async () => {
  const cache = new StaleCache(1, 10);
  const now = Date.now();
  assert.equal(await cache.get('site-a', async () => 'A'), 'A');
  cache.invalidate();
  assert.equal(
    await cache.get(
      'site-a',
      async () => {
        throw new Error('offline');
      },
      now + 2,
    ),
    'A',
  );
  assert.equal(await cache.get('site-b', async () => 'B'), 'B');
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    cache.get(
      'site-a',
      async () => {
        throw new Error('offline');
      },
      Date.now() + 100,
    ),
  );
});
test('in-flight old loads cannot repopulate an invalidated descriptor', async () => {
  const cache = new StaleCache();
  let resolve!: (v: string) => void;
  const pending = cache.get(
    'a',
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  cache.invalidate();
  resolve('old');
  await pending;
  assert.equal(await cache.get('a', async () => 'new'), 'new');
});
