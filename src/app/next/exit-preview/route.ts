import { cookies } from 'next/headers';
import { PREVIEW_COOKIE } from '@/lib/security/preview';
import { privateHeaders } from '@/lib/security/http';
export async function GET() {
  (await cookies()).delete(PREVIEW_COOKIE);
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: '/' } });
}
