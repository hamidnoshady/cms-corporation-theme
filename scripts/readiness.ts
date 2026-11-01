// Read-only launch gate. Runtime secrets come from the operator environment, never CLI args.
import { readFile } from 'node:fs/promises';
import { readCmsJson } from '../src/lib/cms/gate';
import { cmsKey, resolveCmsOrigin, safeCmsOrigin } from '../src/lib/cms/origin';

/**
 * The CMS origin is checked with the resolver the request path, `/api/ready` and
 * `pnpm preflight:cms` use, so this gate can never disagree with the container it
 * is about to approve: a value the theme would refuse fails here for the same
 * rule code, and one it accepts (a private IP, a reserved internal suffix, an
 * exact `APEX_CMS_HTTP_ORIGINS` entry, a base path) is not rejected here.
 */
type Manifest = { contractVersion?: number };
type Binding = { type?: string; id?: string };
type SiteDescriptor = {
  contractVersion?: number;
  id?: string;
  availableLocales?: string[];
  defaultLocale?: string;
  themeRuntime?: { bindings?: Record<string, Binding | undefined> };
};
type PageDoc = { _status?: string; title?: string; slug?: string };

const manifest = JSON.parse(await readFile('eshobe.theme.json', 'utf8')) as Manifest;
const checks: { name: string; ok: boolean }[] = [];
const check = (name: string, ok: boolean) => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'BLOCKED'} ${name}`);
};

const config = resolveCmsOrigin();
const origin = safeCmsOrigin();
const key = cmsKey().trim();

check('CMS origin accepted by the theme policy', config.ok);
check('CMS endpoint and tenant key configured', config.ok && key.length > 0);
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

if (!config.ok) {
  console.log(
    `BLOCKED CMS origin rejected [${config.failure}]${origin ? `: ${origin}` : ''} — the deployed theme fails closed on this value`,
  );
  console.log(`  fix: ${config.hint}`);
} else if (key) {
  if (!config.base.startsWith('https://'))
    console.log(
      `NOTE internal HTTP CMS origin accepted (${new URL(config.base).host}); the deployment must set the same policy or the theme will fail closed`,
    );
  if (!process.env.APEX_READY_TOKEN && !process.env.ESHOBE_REVALIDATE_SECRET)
    console.log('NOTE no APEX_READY_TOKEN/ESHOBE_REVALIDATE_SECRET: /api/ready stays closed');
  // The theme appends `/api/...` to the approved base, which may carry a base path.
  const read = <T>(path: string) => readCmsJson<T>(config.base, key, path);
  const report = (hint: string) => console.log(`  hint: ${hint}`);

  const site = await read<SiteDescriptor>('/api/site');
  check('CMS descriptor readable', site.ok);
  if (!site.ok) {
    report(site.hint);
    console.log(
      'SKIPPED contract, tenant and binding checks: they need the descriptor. Nothing else here can be approved.',
    );
  } else {
    check('Contract version matches', site.value.contractVersion === manifest.contractVersion);
    check(
      'Tenant id matches deployed binding',
      !!process.env.ESHOBE_SITE_ID && site.value.id === process.env.ESHOBE_SITE_ID,
    );
    const bindings = site.value.themeRuntime?.bindings ?? {};
    for (const slot of ['home', 'features', 'restaurants', 'pricing', 'demo', 'privacy']) {
      const binding = bindings[slot];
      check(`${slot} has an explicit page binding`, binding?.type === 'page' && !!binding.id);
      if (!binding?.id) continue;
      for (const locale of site.value.availableLocales ?? [site.value.defaultLocale]) {
        const page = await read<PageDoc>(
          `/api/pages/${encodeURIComponent(binding.id)}?locale=${locale}&fallbackLocale=false&depth=0&draft=false`,
        );
        check(
          `${slot}/${locale} is published and translated`,
          page.ok && page.value._status === 'published' && !!page.value.title && !!page.value.slug,
        );
        if (!page.ok) report(page.hint);
      }
    }
    check(
      'Approved product media bound',
      bindings.productMedia?.type === 'media' && !!bindings.productMedia.id,
    );
  }
}
console.log(
  'Manual gates still required: approved copy/media, device demo, lead receipt in sales, real pricing review, analytics emitter, Eshobe promotion + rollback.',
);
if (checks.some((entry) => !entry.ok)) process.exitCode = 1;
