import { cmsMode } from '@/lib/cms/client';

export const dynamic = 'force-dynamic';

/**
 * Local process liveness only: no CMS, CRM, database or network probe.
 *
 * Coolify runs this continuously from inside the container, so a CMS or network
 * blip must never mark every theme container unhealthy. `mode: "invalid"` is
 * reported so a misconfiguration is visible without failing liveness; CMS
 * availability is covered by the authenticated `/api/ready` probe.
 */
export function GET() {
  return Response.json(
    { ok: true, mode: cmsMode(), readiness: '/api/ready' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
