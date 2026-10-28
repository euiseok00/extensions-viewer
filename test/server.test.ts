import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import { once } from 'node:events';
import { startServer } from '../src/server.js';

const DATA = { plugins: { items: [] }, mcp: { items: [] }, skills: { items: [{ name: '<script>x</script>' }] } };
const ctx = { home: '', cwd: '' };

// fetch는 Host 헤더를 바꿀 수 없어서 node:http로 직접 보낸다.
function get(port: number, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: Record<string, any>; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function withServer(fn: (s: { port: number; token: string }) => Promise<void>, idleMs?: number) {
  const s = await startServer({ ctx, idleMs, collect: async () => DATA });
  try {
    await fn(s);
  } finally {
    s.server.close();
    s.server.closeAllConnections();
  }
}

test('토큰 없음·틀린 토큰은 403', () =>
  withServer(async ({ port, token }) => {
    assert.equal((await get(port, '/')).status, 403);
    assert.equal((await get(port, '/?t=wrong')).status, 403);
    const r = await get(port, '/api/extensions');
    assert.equal(r.status, 403);
    assert.ok(!r.body.includes(token));
  }));

test('잘못된 Host는 올바른 토큰이어도 403', () =>
  withServer(async ({ port, token }) => {
    assert.equal((await get(port, `/?t=${token}`, { Host: 'evil.example' })).status, 403);
    assert.equal((await get(port, `/?t=${token}`, { Host: `evil.example:${port}` })).status, 403);
  }));

test('정상 토큰: 쿠키로 교체 후 200, 보안 헤더 포함', () =>
  withServer(async ({ port, token }) => {
    const first = await get(port, `/?t=${token}`);
    assert.equal(first.status, 302);
    assert.equal(first.headers.location, '/');
    const cookie: string = first.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);

    const page = await get(port, '/', { Cookie: cookie.split(';')[0] });
    assert.equal(page.status, 200);
    assert.equal(page.headers['content-security-policy'], "default-src 'self'");
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.ok(!('access-control-allow-origin' in page.headers));

    const api = await get(port, '/api/extensions', { Cookie: cookie.split(';')[0], Host: `localhost:${port}` });
    assert.equal(api.status, 200);
    assert.deepEqual(JSON.parse(api.body), DATA);
  }));

test('화면 모듈 3개를 인증 후 서빙한다', () =>
  withServer(async ({ port, token }) => {
    const cookie = (await get(port, `/?t=${token}`)).headers['set-cookie'][0].split(';')[0];
    for (const p of ['/app.js', '/logic.js', '/style.css']) {
      const r = await get(port, p, { Cookie: cookie });
      assert.equal(r.status, 200, p);
      assert.ok(r.body.length > 100, p);
      assert.equal((await get(port, p)).status, 403, p);
    }
  }));

test('/api/mcp-status: 인증이 필요하고 주입한 결과를 돌려준다', async () => {
  const s = await startServer({ ctx, collect: async () => DATA, mcpStatus: async () => ({ items: [{ name: 'rea', target: 'x', status: 'ok' }] }) });
  try {
    assert.equal((await get(s.port, '/api/mcp-status')).status, 403);
    const cookie = (await get(s.port, `/?t=${s.token}`)).headers['set-cookie'][0].split(';')[0];
    const r = await get(s.port, '/api/mcp-status', { Cookie: cookie });
    assert.equal(r.status, 200);
    assert.equal(JSON.parse(r.body).items[0].name, 'rea');
  } finally {
    s.server.close();
    s.server.closeAllConnections();
  }
});

test('화면 코드에 innerHTML이 없다', async () => {
  for (const f of ['app.js', 'logic.js', 'index.html']) {
    const text = await readFile(new URL(`../../src/ui/${f}`, import.meta.url), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(text), f);
  }
});

test('유휴 시간이 지나면 서버가 종료된다', async () => {
  const s = await startServer({ ctx, idleMs: 50, collect: async () => DATA });
  await once(s.server, 'close');
  assert.equal(s.server.listening, false);
});

test('127.0.0.1에만 바인딩한다', async () => {
  const s = await startServer({ ctx, collect: async () => DATA });
  try {
    assert.equal((s.server.address() as { address: string }).address, '127.0.0.1');
  } finally {
    s.server.close();
    s.server.closeAllConnections();
  }
});
