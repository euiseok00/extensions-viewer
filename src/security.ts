import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export const COOKIE = 'ev_token';

export function makeToken(): string {
  return randomBytes(32).toString('hex');
}

// 길이가 달라도 상수 시간으로 비교하려고 해시한 뒤 비교한다.
export function tokenEquals(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

// DNS 리바인딩 방어: Host가 우리가 연 주소일 때만 통과한다.
export function hostOk(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

// 쿠키 또는 쿼리 t 중 하나라도 맞으면 인증된 것으로 본다. fromQuery는 첫 접속 판별용.
export function authenticate(req: IncomingMessage, token: string): { ok: boolean; fromQuery: boolean } {
  const q = new URL(req.url ?? '/', 'http://x').searchParams.get('t') ?? undefined;
  if (tokenEquals(q, token)) return { ok: true, fromQuery: true };
  return { ok: tokenEquals(cookieValue(req.headers.cookie, COOKIE), token), fromQuery: false };
}

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'",
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
