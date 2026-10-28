import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { collectAll } from './collect.js';
import { COOKIE, SECURITY_HEADERS, authenticate, hostOk, makeToken } from './security.js';
import type { Context } from './types.js';

export type Options = {
  ctx: Context;
  idleMs?: number; // 기본 10분
  collect?: () => Promise<unknown>; // 테스트에서 주입
};

// 정적 파일은 허용 목록만 서빙한다. 경로를 요청에서 조합하지 않는다.
const STATIC: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};
// shortcut: 컴파일 결과(dist/src) 기준으로 src/ui를 직접 가리킨다. 단계 3에서 배포 구조 확정 시 변경.
const UI_DIR = new URL('../../src/ui/', import.meta.url);

export async function startServer(opts: Options): Promise<{ server: Server; port: number; token: string }> {
  const token = makeToken();
  const idleMs = opts.idleMs ?? 10 * 60 * 1000;
  const collect = opts.collect ?? (() => collectAll(opts.ctx));
  let port = 0;

  const server = createServer(async (req, res) => {
    const send = (status: number, body: string, extra: Record<string, string> = {}) => {
      res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...extra });
      res.end(body);
    };
    const auth = authenticate(req, token);
    // 거부된 요청은 유휴 타이머를 리셋하지 않는다. 응답에는 토큰·사유를 담지 않는다.
    if (!hostOk(req.headers.host, port) || !auth.ok) return send(403, 'forbidden');
    idle.refresh();
    if (req.method !== 'GET') return send(405, 'method not allowed');

    const path = new URL(req.url ?? '/', 'http://x').pathname;
    // 첫 접속: 토큰을 쿠키로 바꾸고 URL에서 제거한다.
    if (auth.fromQuery && path === '/') {
      return send(302, '', { Location: '/', 'Set-Cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/` });
    }
    if (path === '/api/extensions') {
      try {
        return send(200, JSON.stringify(await collect()), { 'Content-Type': 'application/json; charset=utf-8' });
      } catch {
        return send(500, 'error');
      }
    }
    const file = STATIC[path];
    if (!file) return send(404, 'not found');
    return send(200, await readFile(new URL(file[0], UI_DIR), 'utf8'), { 'Content-Type': file[1] });
  });

  // 유휴 시간이 지나면 서버를 닫는다.
  const idle = setTimeout(() => {
    server.close();
    server.closeAllConnections();
  }, idleMs);
  server.on('close', () => clearTimeout(idle));

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
  return { server, port, token };
}
