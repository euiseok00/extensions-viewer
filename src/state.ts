import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// 서버가 떠 있는지 런처가 알아내기 위한 상태. 이 파일이 저장하는 유일한 상태다.
export type State = { pid: number; port: number; token: string; cwd: string };

// 테스트에서 EV_STATE_DIR로 바꿀 수 있다. Claude Code 설정 폴더는 건드리지 않는다.
const dir = () => process.env.EV_STATE_DIR ?? join(homedir(), '.extensions-viewer');

// 프로젝트마다 서버가 따로 떠야 하므로 cwd별로 파일을 나눈다.
export const statePath = (cwd: string) => join(dir(), `state-${createHash('sha1').update(cwd).digest('hex').slice(0, 12)}.json`);

export async function readState(cwd: string): Promise<State | undefined> {
  try {
    const s = JSON.parse(await readFile(statePath(cwd), 'utf8'));
    return typeof s?.port === 'number' && typeof s?.token === 'string' && typeof s?.pid === 'number' ? s : undefined;
  } catch {
    return undefined; // 없거나 깨졌으면 서버가 없는 것으로 본다.
  }
}

export async function writeState(s: State): Promise<void> {
  await mkdir(dir(), { recursive: true });
  const file = statePath(s.cwd);
  await writeFile(file, JSON.stringify(s), { mode: 0o600 });
  // shortcut: Windows에서는 0600이 적용되지 않는다. 사용자 프로필 하위 경로의 기본 ACL에 의존, 대체 방식 확정 시 변경.
  await chmod(file, 0o600).catch(() => {});
}

// 내 토큰으로 쓴 파일만 지운다. 다른 서버가 덮어썼다면 건드리지 않는다.
export async function removeState(cwd: string, token: string): Promise<void> {
  if ((await readState(cwd))?.token === token) await rm(statePath(cwd), { force: true });
}
