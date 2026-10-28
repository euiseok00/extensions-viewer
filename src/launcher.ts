import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readState, removeState, type State } from './state.js';

const url = (s: State) => `http://127.0.0.1:${s.port}/?t=${s.token}`;

// pid는 재사용될 수 있어서 믿지 않는다. 토큰으로 접속해 302가 오면 우리 서버다.
function healthy(s: State): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request(
      { host: '127.0.0.1', port: s.port, path: `/?t=${s.token}`, headers: { Host: `127.0.0.1:${s.port}` }, timeout: 1000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 302);
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
    req.end();
  });
}

export async function launch(cwd: string): Promise<string> {
  const old = await readState(cwd);
  if (old) {
    if (await healthy(old)) return url(old);
    await removeState(cwd, old.token); // 죽은 서버의 잔여 상태
  }

  // 셸 없이 node만 직접 실행하고 부모와 분리한다.
  const child = spawn(process.execPath, [fileURLToPath(new URL('./serve.js', import.meta.url))], {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const s = await readState(cwd);
    if (s && (await healthy(s))) return url(s);
  }
  throw new Error('서버가 5초 안에 시작되지 않았습니다.');
}

try {
  console.log(await launch(process.cwd()));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
