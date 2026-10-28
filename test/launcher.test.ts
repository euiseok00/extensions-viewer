import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readState, statePath, writeState } from '../src/state.js';

const run = promisify(execFile);
const launcher = fileURLToPath(new URL('../src/launcher.js', import.meta.url));

// 임시 상태 폴더와 임시 프로젝트로 런처를 실행하고, 끝나면 띄운 서버를 반드시 죽인다.
async function withLauncher(fn: (cwd: string, launch: () => Promise<string>) => Promise<void>) {
  // macOS의 tmpdir은 심볼릭 링크라, 런처의 process.cwd()와 같도록 실제 경로를 쓴다.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'ev-l-')));
  const cwd = join(root, 'proj');
  await mkdir(cwd);
  process.env.EV_STATE_DIR = join(root, 'state');
  const launch = async () => (await run(process.execPath, [launcher], { cwd, env: process.env })).stdout.trim();
  try {
    await fn(cwd, launch);
  } finally {
    const s = await readState(cwd);
    if (s) process.kill(s.pid);
  }
}

test('URL 한 줄을 출력하고 다시 실행하면 같은 서버를 재사용한다', () =>
  withLauncher(async (cwd, launch) => {
    const first = await launch();
    assert.match(first, /^http:\/\/127\.0\.0\.1:\d+\/\?t=[0-9a-f]{64}$/);
    const pid = (await readState(cwd))!.pid;
    assert.equal(await launch(), first);
    assert.equal((await readState(cwd))!.pid, pid);
    const res = await fetch(first, { redirect: 'manual' });
    assert.equal(res.status, 302);
  }));

test('죽은 서버의 상태 파일은 버리고 새로 기동한다', () =>
  withLauncher(async (cwd, launch) => {
    await writeState({ pid: 1, port: 9, token: 'dead', cwd }); // 아무도 듣지 않는 포트
    const url = await launch();
    assert.notEqual(new URL(url).port, '9');
    assert.equal((await fetch(url, { redirect: 'manual' })).status, 302);
  }));

test('상태 파일 권한이 0600이다', { skip: process.platform === 'win32' }, () =>
  withLauncher(async (cwd, launch) => {
    await launch();
    assert.equal((await stat(statePath(cwd))).mode & 0o777, 0o600);
  }));

