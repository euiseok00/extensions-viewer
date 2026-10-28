import { runClaude } from './claudeCli.js';
import { maskArgs } from './sanitize.js';
import type { Context } from './types.js';

export type McpStatus = { name: string; target: string; status: string };

// `claude mcp list`의 한 줄: "이름: 대상 - 상태". 대상에 " - "가 있어도 마지막 것을 구분자로 본다.
const LINE = /^(.+?): (.+) - (\S.*)$/;

export function parseMcpList(text: string): McpStatus[] {
  const out: McpStatus[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = LINE.exec(line.trim());
    // 대상은 명령줄이나 URL이라 비밀이 들 수 있어서 인자 마스킹을 거친다.
    if (m) out.push({ name: m[1], target: maskArgs(m[2].split(' ')).join(' '), status: m[3] });
  }
  return out;
}

// 켜진 서버를 실제로 띄워 연결을 확인하므로 느리고(수 초) 프로세스를 실행한다. 사용자가 누를 때만 부른다.
export async function collectMcpStatus(ctx: Context): Promise<{ items: McpStatus[]; error?: string }> {
  const cli = ctx.cli ?? runClaude;
  const text = await cli(['mcp', 'list'], { timeoutMs: 20_000, ttlMs: 0 });
  if (text === undefined) return { items: [], error: 'claude mcp list를 실행하지 못했습니다(명령이 없거나 시간이 초과됨).' };
  return { items: parseMcpList(text) };
}
