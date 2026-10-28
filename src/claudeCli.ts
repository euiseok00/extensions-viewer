import { execFile } from 'node:child_process';

// claude CLI를 부르는 함수. 테스트에서는 Context.cli로 가짜를 주입한다.
// 실패(없음, 시간 초과, 비정상 종료)는 예외 대신 undefined로 돌려주고, 호출한 쪽이 파일 기반 값으로 대체한다.
export type Cli = (args: string[], opts?: { timeoutMs?: number; ttlMs?: number }) => Promise<string | undefined>;

const cache = new Map<string, { at: number; out: string | undefined }>();

// 같은 명령을 짧은 시간 안에 반복하지 않도록 결과를 잠깐 기억한다(실패도 기억해 시간 초과가 겹치지 않게 한다).
export const runClaude: Cli = (args, { timeoutMs = 8000, ttlMs = 30_000 } = {}) => {
  const key = args.join('\0');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.out);
  return new Promise((resolve) => {
    // 셸을 거치지 않는다. 인자는 배열로만 넘긴다.
    execFile('claude', args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      const out = err ? undefined : stdout;
      cache.set(key, { at: Date.now(), out });
      resolve(out);
    });
  });
};

// 설치 기록에서 읽은 이름은 신뢰할 수 없는 입력이라, 옵션처럼 보이거나 이상한 문자가 든 것은 CLI에 넘기지 않는다.
export const safeId = (id: string) => /^[\w][\w.@-]*$/.test(id);
