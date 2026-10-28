import { join } from 'node:path';
import { runClaude, safeId } from '../claudeCli.js';
import { readJson } from '../fsutil.js';
import type { CollectResult, Context, Extension } from '../types.js';

type Install = { id: string; scope: Extension['scope']; version: string; installPath: string; file: string };

// 설치된 플러그인 목록. MCP·스킬 수집기도 플러그인 폴더를 찾을 때 재사용한다.
export async function listInstalled(ctx: Context): Promise<Install[]> {
  const file = join(ctx.home, '.claude', 'plugins', 'installed_plugins.json');
  const data = await readJson(file);
  const out: Install[] = [];
  for (const [id, installs] of Object.entries<any>(data?.plugins ?? {})) {
    for (const i of Array.isArray(installs) ? installs : []) {
      const scope = ['user', 'project', 'local'].includes(i?.scope) ? i.scope : 'unknown';
      out.push({ id, scope, version: String(i?.version ?? ''), installPath: String(i?.installPath ?? ''), file });
    }
  }
  return out;
}

// 설정 파일을 user < project < local 순으로 나열한다. 뒤의 값이 앞을 덮어쓴다.
export const settingsFiles = (ctx: Context) => [
  join(ctx.home, '.claude', 'settings.json'),
  join(ctx.cwd, '.claude', 'settings.json'),
  join(ctx.cwd, '.claude', 'settings.local.json'),
];

export async function enabledMap(ctx: Context): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  for (const f of settingsFiles(ctx)) {
    const enabled = (await readJson(f))?.enabledPlugins;
    for (const [k, v] of Object.entries(enabled ?? {})) if (typeof v === 'boolean') map.set(k, v);
  }
  return map;
}

const DETAIL_KEYS: Record<string, string> = { Skills: 'skills', Agents: 'agents', Hooks: 'hooks', 'MCP servers': 'mcpServers', 'LSP servers': 'lsp' };
const COMPONENT = /^\s*(Skills|Agents|Hooks|MCP servers|LSP servers) \((\d+)\)\s*(.*)$/;
const ALWAYS_ON = /Always-on:\s*(~[\d.,]+k?)\s*tok/;

// `claude plugin details <id>`의 구성 목록과 토큰 비용을 읽는다. JSON 출력이 없어 글자를 파싱하므로 줄을 못 알아보면 그 항목만 비운다.
export function parseDetails(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = COMPONENT.exec(line);
    if (m) {
      const names = m[3].replace(/\s*\(harness-only.*\)\s*$/, '').trim();
      out[DETAIL_KEYS[m[1]]] = names && m[1] !== 'Skills' ? `${m[2]}: ${names}` : m[2];
      continue;
    }
    const t = ALWAYS_ON.exec(line);
    if (t) out.alwaysOnTokens = `${t[1]} tok`;
  }
  return out;
}

// 파일을 기본으로 읽고, claude CLI가 되면 그 값(켜짐 여부, 구성 목록)으로 덮어쓴다. CLI가 없거나 실패하면 파일 값만 쓴다.
export async function collectPlugins(ctx: Context): Promise<CollectResult> {
  const cli = ctx.cli ?? runClaude;
  const [installed, enabled, listText] = await Promise.all([listInstalled(ctx), enabledMap(ctx), cli(['plugin', 'list', '--json'], { timeoutMs: 5000 })]);
  const fromCli = new Map<string, boolean>();
  try {
    for (const p of JSON.parse(listText ?? '[]')) if (typeof p?.enabled === 'boolean') fromCli.set(`${p.id}|${p.scope}`, p.enabled);
  } catch {
    // 출력 형식을 못 읽으면 CLI 값은 쓰지 않는다.
  }
  const items = await Promise.all(
    installed.map(async (p): Promise<Extension> => {
      const detail: Record<string, string> = { version: p.version, installPath: p.installPath };
      const text = safeId(p.id) ? await cli(['plugin', 'details', p.id], { timeoutMs: 8000 }) : undefined;
      if (text) Object.assign(detail, parseDetails(text));
      return { kind: 'plugin', name: p.id, scope: p.scope, source: p.file, enabled: fromCli.get(`${p.id}|${p.scope}`) ?? enabled.get(p.id) ?? null, detail };
    }),
  );
  return { items };
}
