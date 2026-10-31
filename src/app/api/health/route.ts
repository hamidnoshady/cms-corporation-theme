import { cmsConfigIssue, cmsMode } from '@/lib/cms/client';

export const dynamic = 'force-dynamic';

/**
 * Local process liveness only: no CMS, CRM, database or network probe.
 *
 * Coolify runs this continuously from inside the container, so a CMS or network
 * blip must never mark every theme container unhealthy. `mode: "invalid"` plus
 * `configIssue` (a rule code such as `cms_url_untrusted_http`, never a host or a
 * key) makes a misconfiguration visible without failing liveness; CMS
 * availability is covered by the authenticated `/api/ready` probe.
 */
export function GET() {
  const mode = cmsMode();
  return Response.json(
    {
      ok: true,
      mode,
      ...(mode === 'invalid' ? { configIssue: cmsConfigIssue() } : {}),
      readiness: '/api/ready',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
