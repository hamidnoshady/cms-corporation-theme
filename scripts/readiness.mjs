// Read-only launch gate. Runtime secrets come from the operator environment, never CLI args.
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('eshobe.theme.json', 'utf8'));
const checks = [];
const check = (name, ok) => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'BLOCKED'} ${name}`);
};
const cms = process.env.ESHOBE_CMS_URL;
const key = process.env.ESHOBE_API_KEY;
check('CMS endpoint and tenant key configured', !!cms && !!key);
check('Demo mode disabled', process.env.APEX_DEMO_MODE !== 'true');
check('Local upstream exceptions disabled', process.env.APEX_ALLOW_LOCAL_UPSTREAM !== 'true');
check(
  'Lead challenge signing key configured',
  (process.env.LEAD_FORM_SECRET || process.env.ESHOBE_REVALIDATE_SECRET || '').length >= 32,
);
check('Public origin is HTTPS', /^https:\/\//.test(process.env.ESHOBE_PUBLIC_ORIGIN ?? ''));
check('Signed revalidation configured', !!process.env.ESHOBE_REVALIDATE_SECRET);
check(
  'Biza Miz lead intake configured',
  !!process.env.BIZAMIZ_LEAD_WEBHOOK_URL && !!process.env.BIZAMIZ_LEAD_TOKEN,
);
check('Approved published pricing source configured', !!process.env.BIZAMIZ_CATALOGUE_URL);
if (cms && key) {
  const origin = new URL(cms);
  // Mirrors src/lib/cms/origin.ts: credential-free HTTPS, a single-label internal
  // service name over HTTP, or an exact APEX_CMS_HTTP_ORIGINS entry.
  const allowlist = (process.env.APEX_CMS_HTTP_ORIGINS ?? '')
    .split(',')
    .map((entry) =>
      entry
        .trim()
        .toLowerCase()
        .replace(/^http:\/\//, '')
        .replace(/\/+$/, ''),
    )
    .filter(Boolean);
  const serviceName =
    /^[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?$/i.test(origin.hostname) &&
    origin.hostname !== 'localhost';
  const internalHttp =
    origin.protocol === 'http:' && (serviceName || allowlist.includes(origin.host));
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    !(origin.protocol === 'https:' || internalHttp)
  )
    throw new Error(
      'Readiness requires a credential-free HTTPS CMS origin, a single-label internal Docker service name, or an exact APEX_CMS_HTTP_ORIGINS entry',
    );
  if (origin.protocol !== 'https:')
    console.log(
      `NOTE internal HTTP CMS origin accepted (${origin.host}); the deployment must set the same policy or the theme will fail closed`,
    );
  if (!process.env.APEX_READY_TOKEN && !process.env.ESHOBE_REVALIDATE_SECRET)
    console.log('NOTE no APEX_READY_TOKEN/ESHOBE_REVALIDATE_SECRET: /api/ready stays closed');
  const get = async (path) => {
    const response = await fetch(new URL(path, origin), {
      headers: { Authorization: `Bearer ${key}` },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Readiness CMS request failed (${response.status})`);
    return response.json();
  };
  const site = await get('/api/site');
  check('Contract version matches', site.contractVersion === manifest.contractVersion);
  check(
    'Tenant id matches deployed binding',
    !!process.env.ESHOBE_SITE_ID && site.id === process.env.ESHOBE_SITE_ID,
  );
  const bindings = site.themeRuntime?.bindings ?? {};
  for (const slot of ['home', 'features', 'restaurants', 'pricing', 'demo', 'privacy']) {
    const binding = bindings[slot];
    check(`${slot} has an explicit page binding`, binding?.type === 'page' && !!binding.id);
    if (!binding?.id) continue;
    for (const locale of site.availableLocales ?? [site.defaultLocale]) {
      const page = await get(
        `/api/pages/${encodeURIComponent(binding.id)}?locale=${locale}&fallbackLocale=false&depth=0&draft=false`,
      );
      check(
        `${slot}/${locale} is published and translated`,
        page._status === 'published' && !!page.title && !!page.slug,
      );
    }
  }
  check(
    'Approved product media bound',
    bindings.productMedia?.type === 'media' && !!bindings.productMedia.id,
  );
}
console.log(
  'Manual gates still required: approved copy/media, device demo, lead receipt in sales, real pricing review, analytics emitter, Eshobe promotion + rollback.',
);
if (checks.some((c) => !c.ok)) process.exitCode = 1;
