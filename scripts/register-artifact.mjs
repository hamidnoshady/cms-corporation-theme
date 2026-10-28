import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('eshobe.theme.json', 'utf8'));
const required = [
  'ESHOBE_CMS_URL',
  'ESHOBE_THEME_PACKAGE_ID',
  'ESHOBE_THEME_ARTIFACT_SECRET',
  'GITHUB_SHA',
  'GITHUB_REPOSITORY',
  'GITHUB_RUN_ID',
  'IMAGE_DIGEST',
];
for (const key of required)
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
const env = process.env;
if (
  !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA) ||
  !/^sha256:[a-f0-9]{64}$/.test(env.IMAGE_DIGEST) ||
  !/^[a-f0-9-]{36}$/.test(env.ESHOBE_THEME_PACKAGE_ID)
)
  throw new Error('Invalid immutable artifact identity');
const base = new URL(env.ESHOBE_CMS_URL);
if (base.protocol !== 'https:' || base.username || base.password)
  throw new Error('CMS callback must use a credential-free HTTPS origin');
const body = JSON.stringify({
  repository: env.GITHUB_REPOSITORY,
  ref: env.GITHUB_REF_NAME,
  commit: env.GITHUB_SHA,
  registry: 'ghcr',
  image: manifest.deployment.registryImageRepository,
  tag: env.GITHUB_SHA,
  digest: env.IMAGE_DIGEST,
  workflowRunId: env.GITHUB_RUN_ID,
  workflowRunUrl: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
  platform: 'linux/amd64',
  provenanceAvailable: true,
  sbomAvailable: true,
});
const signature = `sha256=${createHmac('sha256', env.ESHOBE_THEME_ARTIFACT_SECRET).update(body).digest('hex')}`;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const response = await fetch(
      new URL(`/api/platform/theme-packages/${env.ESHOBE_THEME_PACKAGE_ID}/artifacts`, base),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Eshobe-Signature-256': signature },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.ok) {
      console.log(`Registered immutable artifact ${env.IMAGE_DIGEST}`);
      process.exit(0);
    }
    if (response.status < 500) {
      const raw = await response.text().catch(() => '');
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.message === 'string') detail = parsed.message;
      } catch {
        // non-JSON body: keep the raw text
      }
      detail = detail.replace(/\s+/g, ' ').trim().slice(0, 400);
      throw new Error(
        `Artifact registration rejected (${response.status})${detail ? `: ${detail}` : ''}; check CMS package configuration`,
      );
    }
  } catch (error) {
    if (attempt === 2 || String(error).includes('registration rejected')) throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
}
throw new Error('CMS artifact registration unavailable; image is not approved for deployment');
