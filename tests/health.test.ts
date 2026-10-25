import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Simple build-time sanity checks (no network required).
 * Browser, contract and visual tests live alongside these smoke invariants.
 */

describe('eshobe.theme.json', () => {
  it('is valid JSON with required fields', async () => {
    const fs = await import('node:fs/promises');
    const raw = await fs.readFile('eshobe.theme.json', 'utf8');
    const json = JSON.parse(raw) as Record<string, unknown>;
    assert.equal(json.contractVersion, 1);
    assert.equal(json.key, 'apex');
    assert.equal(json.proxiesApi, true);
    assert.deepEqual(json.locales, ['fa', 'en']);
    assert.ok((json.build as Record<string, unknown>).healthCheckPath);
  });
});

describe('DESIGN.md', () => {
  it('exists and lists color tokens', async () => {
    const fs = await import('node:fs/promises');
    const md = await fs.readFile('DESIGN.md', 'utf8');
    for (const tok of ['--background', '--foreground', '--accent', '--border', '--primary']) {
      assert.ok(md.includes(tok), `DESIGN.md must define ${tok}`);
    }
    assert.ok(md.includes('Vazirmatn'), 'DESIGN.md must call out Vazirmatn for Persian');
  });
});

it('local health never calls a remote service', async () => {
  const { GET } = await import('../src/app/api/health/route');
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('Health must be local');
  };
  try {
    assert.equal((await GET().json()).ok, true);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});
