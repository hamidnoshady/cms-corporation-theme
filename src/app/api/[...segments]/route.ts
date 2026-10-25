import { proxyGet } from '@/lib/cms/proxy';

export const dynamic = 'force-dynamic';

/**
 * Catch-all API proxy for CMS-owned paths (when proxiesApi: true).
 * Whitelisting is enforced inside proxyGet.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await params;
  return proxyGet(request, segments);
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await params;
  return proxyGet(request, segments);
}
