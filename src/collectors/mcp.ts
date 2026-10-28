import { join } from 'node:path';
import { readJson } from '../fsutil.js';
import { keyNames, maskArgs, maskCommand, maskUrl } from '../sanitize.js';
import type { CollectResult, Context, Extension } from '../types.js';
import { listInstalled } from './plugins.js';

// 서버 정의 하나를 마스킹된 Extension으로 바꾼다. 원본 env·headers 값은 여기서 버린다.
function toExtension(name: string, def: any, scope: Extension['scope'], source: string): Extension {
  const detail: Record<string, string> = {};
  const transport = def?.type ?? (def?.url ? 'http' : 'stdio');
  detail.transport = String(transport);
  if (typeof def?.command === 'string') detail.command = maskCommand(def.command);
  if (Array.isArray(def?.args)) detail.args = maskArgs(def.args.map(String)).join(' ');
  if (typeof def?.url === 'string') detail.url = maskUrl(def.url);
  if (def?.env) detail.envKeys = keyNames(def.env);
  if (def?.headers) detail.headerKeys = keyNames(def.headers);
  // shortcut: 활성 여부 판정 규칙을 확인하지 못해 항상 null. 확인되면 채운다.
  return { kind: 'mcp', name, scope, source, enabled: null, detail };
}

// .mcp.json은 {mcpServers:{...}} 또는 서버 맵 자체일 수 있다.
function serverMap(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  return data.mcpServers && typeof data.mcpServers === 'object' ? data.mcpServers : data;
}

export async function collectMcp(ctx: Context): Promise<CollectResult> {
  const items: Extension[] = [];
  const claudeJson = join(ctx.home, '.claude.json');
  const userCfg = await readJson(claudeJson);
  for (const [n, d] of Object.entries(userCfg?.mcpServers ?? {})) items.push(toExtension(n, d, 'user', claudeJson));

  // 프로젝트 키가 슬래시/역슬래시 어느 쪽인지 확인하지 못해 둘 다 시도한다.
  const projects = userCfg?.projects ?? {};
  const local = projects[ctx.cwd] ?? projects[ctx.cwd.replaceAll('\\', '/')];
  for (const [n, d] of Object.entries(local?.mcpServers ?? {})) items.push(toExtension(n, d, 'local', claudeJson));

  const projFile = join(ctx.cwd, '.mcp.json');
  for (const [n, d] of Object.entries(serverMap(await readJson(projFile)))) items.push(toExtension(n, d, 'project', projFile));

  for (const p of await listInstalled(ctx)) {
    const f = join(p.installPath, '.mcp.json');
    for (const [n, d] of Object.entries(serverMap(await readJson(f)))) items.push(toExtension(n, d, 'plugin', f));
  }
  return { items };
}
