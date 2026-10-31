import { cookies } from 'next/headers';
import { cmsEnabled, requireCmsOrigin, siteOrigin } from '@/lib/cms/client';
import { classifyFetchError, describeFetchError } from '@/lib/cms/errors';
import { newCorrelationId, reportCmsFailure } from '@/lib/cms/diagnostics';
import { equalSecret } from '@/lib/security/signatures';
import {
  encodePreview,
  PREVIEW_COOKIE,
  previewSecret,
  normalizePreviewPath,
} from '@/lib/security/preview';
import { jsonError, privateHeaders } from '@/lib/security/http';
/** Eshobe's native editor handoff: secret AND a CMS-verified editor session. */
export async function GET(request: Request) {
  const correlationId = newCorrelationId();
  const q = new URL(request.url).searchParams;
  const path = normalizePreviewPath(
    q.get('path') ?? '/',
    process.env.ESHOBE_DEFAULT_LOCALE === 'en' ? 'en' : 'fa',
  );
  const token = q.get('token') ?? '';
  const secret = previewSecret();
  if (
    !cmsEnabled() ||
    !secret ||
    !process.env.ESHOBE_SITE_ID ||
    !equalSecret(q.get('previewSecret') ?? '', secret)
  )
    return jsonError('forbidden', 403);
  if (!path) return jsonError('invalid_path', 400);
  if (!/^[A-Za-z0-9_.-]{16,4096}$/.test(token)) return jsonError('forbidden', 403);
  // Same CMS-specific origin policy as every other server-only CMS call.
  let base: URL;
  try {
    // requireCmsOrigin() already logged the sanitized failure and correlation ID.
    base = requireCmsOrigin(correlationId);
  } catch {
    return jsonError('unavailable', 503);
  }
  try {
    const result = await fetch(new URL('/api/users/me', base), {
      headers: { Cookie: `payload-token=${token}` },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(4000),
    });
    const { user } = result.ok
      ? ((await result.json()) as {
          user?: {
            role?: string;
            tenants?: { tenant?: string | { id?: string }; role?: string }[];
          };
        })
      : {};
    if (
      !user ||
      (user.role !== 'platformAdmin' &&
        !user.tenants?.some(
          (row) =>
            ['owner', 'editor'].includes(row.role ?? '') &&
            (typeof row.tenant === 'string' ? row.tenant : row.tenant?.id) ===
              process.env.ESHOBE_SITE_ID,
        ))
    )
      return jsonError('forbidden', 403);
    const value = encodePreview(
      { siteId: process.env.ESHOBE_SITE_ID, path, expires: Date.now() + 300_000 },
      secret,
    );
    // Tie cookie security to the public origin, not to the CMS upstream scheme:
    // an internal plain-HTTP CMS origin on an HTTPS deployment still needs Secure.
    const secure = siteOrigin().startsWith('https://');
    (await cookies()).set(PREVIEW_COOKIE, value, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      maxAge: 300,
    });
    return new Response(null, {
      status: 303,
      headers: { ...privateHeaders, Location: path, 'X-Robots-Tag': 'noindex, nofollow' },
    });
  } catch (error) {
    reportCmsFailure({
      failure: classifyFetchError(error),
      correlationId,
      origin: base.origin,
      path: '/api/users/me',
      cause: describeFetchError(error),
    });
    return jsonError('preview_unavailable', 503);
  }
}
