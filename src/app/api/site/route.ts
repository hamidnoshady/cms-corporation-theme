import { getSite } from '@/lib/cms/source';
import { privateHeaders } from '@/lib/security/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const site = await getSite();
    // Do not forward API-key-only fields (internal site id/domainVerified) to a browser.
    return Response.json(
      {
        contractVersion: site.contractVersion,
        domain: site.domain,
        name: site.name,
        slug: site.slug,
        type: site.type,
        defaultLocale: site.defaultLocale,
        availableLocales: site.availableLocales,
        blocks: site.blocks,
        branding: site.branding,
        media: site.media,
        store: site.store,
        theme: site.theme,
        themeRuntime: site.themeRuntime,
      },
      { headers: { ...privateHeaders, Vary: 'Host' } },
    );
  } catch {
    return Response.json({ error: 'site_unavailable' }, { status: 503, headers: privateHeaders });
  }
}
