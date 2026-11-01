/**
 * `pnpm preflight:cms [--require]`
 *
 * Build/publish-time gate for `ESHOBE_CMS_URL`. The theme refuses a CMS origin
 * that is not HTTPS, not an internal destination and not in
 * `APEX_CMS_HTTP_ORIGINS`, and then fails closed on every page — so the value is
 * checked here with the exact same policy before an image ships.
 *
 * Without `--require` an environment that carries no CMS configuration is
 * skipped: an image build has no tenant credentials, because Eshobe injects them
 * at deployment. `--require` (the operator/publish gate) fails on "not
 * configured" as well. Prints the origin and the rule, never the site key.
 */
import { preflightCmsOrigin } from '../src/lib/cms/preflight';

const result = preflightCmsOrigin(process.argv.includes('--require'));

if (result.state === 'unconfigured') {
  console.log(
    'SKIP no ESHOBE_CMS_URL/ESHOBE_API_KEY in this environment: the image carries no CMS binding (Eshobe injects it at deploy time).',
  );
} else if (result.ok) {
  console.log(`PASS CMS origin accepted by the runtime policy: ${result.origin}`);
  if (!result.keyPresent)
    console.log(
      'NOTE ESHOBE_API_KEY is not set here; the deployment must inject the site key or GET /api/health reports cms_key_missing.',
    );
} else {
  console.error(
    `BLOCKED CMS origin rejected [${result.reason}]${result.origin ? `: ${result.origin}` : ''}`,
  );
  if (result.hint) console.error(`  fix: ${result.hint}`);
  console.error(
    '  The theme fails closed on this value: every page would render the global error page and /api/health would report mode "invalid".',
  );
  process.exitCode = 1;
}
