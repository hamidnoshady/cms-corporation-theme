import chromium from '@sparticuz/chromium';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
/** npm-distributed Chromium: tests also work when Google's download host is blocked. */
export async function browserOptions() {
  const require = createRequire(import.meta.url);
  const entry = require.resolve('@sparticuz/chromium');
  let dir = path.dirname(entry);
  while (!existsSync(path.join(dir, 'bin', 'al2023.tar.br'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Chromium support archive missing');
    dir = parent;
  }
  const libs = path.join(tmpdir(), 'apex-browser-libs');
  if (!existsSync(path.join(libs, 'lib', 'libnspr4.so'))) {
    mkdirSync(libs, { recursive: true });
    const tar = path.join(libs, 'libs.tar');
    writeFileSync(tar, brotliDecompressSync(readFileSync(path.join(dir, 'bin', 'al2023.tar.br'))));
    execFileSync('tar', ['-xf', tar, '-C', libs]);
  }
  return {
    executablePath: await chromium.executablePath(),
    headless: true,
    args: chromium.args.filter(
      (arg) =>
        ![
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--disable-site-isolation-trials',
          '--single-process',
        ].includes(arg),
    ),
    env: {
      ...process.env,
      LD_LIBRARY_PATH: `${path.join(libs, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`,
    },
  };
}
