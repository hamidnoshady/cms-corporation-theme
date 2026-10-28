export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** Bound the stream before decoding; Content-Length alone is not trustworthy. */
export async function readBody(request: Request, max = 16_384): Promise<string> {
  if (Number(request.headers.get('content-length')) > max)
    throw new HttpError(413, 'payload_too_large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, 'payload_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}
export const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
export function jsonError(error: string, status: number, extra: Record<string, string> = {}) {
  return Response.json({ ok: false, error }, { status, headers: { ...privateHeaders, ...extra } });
}
export function serverUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    return !u.username &&
      !u.password &&
      !u.hash &&
      (u.protocol === 'https:' ||
        (process.env.APEX_ALLOW_LOCAL_UPSTREAM === 'true' && loopback && u.protocol === 'http:'))
      ? u
      : null;
  } catch {
    return null;
  }
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') ?? new URL(request.url).host;
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try {
    return new URL(origin).host === host && ['https:', 'http:'].includes(new URL(origin).protocol);
  } catch {
    return false;
  }
}
