import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export function equalSecret(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
export function sign(raw: string, secret: string) {
  return createHmac('sha256', secret).update(raw).digest('hex');
}
export function verify(raw: string, signature: string | null, secret: string): boolean {
  const given = (signature ?? '').replace(/^sha256=/, '');
  return /^[a-f0-9]{64}$/i.test(given) && equalSecret(given.toLowerCase(), sign(raw, secret));
}
