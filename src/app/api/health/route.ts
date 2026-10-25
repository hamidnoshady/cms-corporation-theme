import { cmsEnabled, demoEnabled } from '@/lib/cms/client';
export const dynamic = 'force-dynamic';
/** Local process liveness only; no CMS, pricing, CRM, database or network probe. */
export function GET() {
  return Response.json(
    { ok: true, mode: cmsEnabled() ? 'cms' : demoEnabled() ? 'demo' : 'unconfigured' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
