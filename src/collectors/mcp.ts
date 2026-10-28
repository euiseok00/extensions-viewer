import { join } from 'node:path';
import { readJson } from '../fsutil.js';
import { keyNames, maskArgs, maskCommand, maskUrl } from '../sanitize.js';
import type { CollectResult, Context, Extension } from '../types.js';
import { enabledMap, listInstalled, settingsFiles } from './plugins.js';

// 서버 정의 하나를 마스킹된 Extension으로 바꾼다. 원본 env·headers 값은 여기서 버린다.
type Opts = { parent?: string; enabled?: boolean | null; approval?: string };

function toExtension(name: string, def: any, scope: Extension['scope'], source: string, { parent, enabled = null, approval }: Opts = {}): Extension {
  const detail: Record<string, string> = {};
  const transport = def?.type ?? (def?.url ? 'http' : 'stdio');
  detail.transport = String(transport);
  if (typeof def?.command === 'string') detail.command = maskCommand(def.command);
  if (Array.isArray(def?.args)) detail.args = maskArgs(def.args.map(String)).join(' ');
  if (typeof def?.url === 'string') detail.url = maskUrl(def.url);
  if (def?.env) detail.envKeys = keyNames(def.env);
  if (def?.headers) detail.headerKeys = keyNames(def.headers);
  if (approval) detail.approval = approval;
  return { kind: 'mcp', name, scope, source, enabled, detail, ...(parent && { parent }) };
}

// .mcp.json은 {mcpServers:{...}} 또는 서버 맵 자체일 수 있다.
function serverMap(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  return data.mcpServers && typeof data.mcpServers === 'object' ? data.mcpServers : data;
}

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// 활성 여부를 정하는 설정 값들. 규칙은 공식 문서(MCP 설정) 기준이며 docs/05-roadmap.md에 한계를 적었다.
async function readRules(ctx: Context, local: any) {
  // /mcp에서 끈 서버는 ~/.claude.json의 프로젝트 항목에 기록된다(사용자·로컬·플러그인 서버 대상).
  const disabled = new Set(strs(local?.disabledMcpServers));
  // .mcp.json 서버의 승인·거부는 설정 파일과 같은 프로젝트 항목에 적힌다.
  const approved = new Set(strs(local?.enabledMcpjsonServers));
  const rejected = new Set(strs(local?.disabledMcpjsonServers));
  let approveAll = false;
  for (const f of settingsFiles(ctx)) {
    const s = await readJson(f);
    strs(s?.enabledMcpjsonServers).forEach((n) => approved.add(n));
    strs(s?.disabledMcpjsonServers).forEach((n) => rejected.add(n));
    if (typeof s?.enableAllProjectMcpServers === 'boolean') approveAll = s.enableAllProjectMcpServers;
  }
  return { disabled, approved, rejected, approveAll };
}

export async function collectMcp(ctx: Context): Promise<CollectResult> {
  const items: Extension[] = [];
  const claudeJson = join(ctx.home, '.claude.json');
  const userCfg = await readJson(claudeJson);

  // Windows에서 프로젝트 키는 슬래시 구분이고 드라이브 문자 대소문자가 제각각이라 정규화해서 비교한다.
  const norm = (p: string) => (process.platform === 'win32' ? p.replaceAll('\\', '/').toLowerCase() : p);
  const projects: Record<string, any> = userCfg?.projects ?? {};
  const key = Object.keys(projects).find((k) => norm(k) === norm(ctx.cwd));
  const local = key === undefined ? undefined : projects[key];
  const rules = await readRules(ctx, local);

  // 사용자·로컬 서버: 끈 목록(disabledMcpServers)에 없으면 활성이다.
  for (const [n, d] of Object.entries(userCfg?.mcpServers ?? {})) items.push(toExtension(n, d, 'user', claudeJson, { enabled: !rules.disabled.has(n) }));
  for (const [n, d] of Object.entries(local?.mcpServers ?? {})) items.push(toExtension(n, d, 'local', claudeJson, { enabled: !rules.disabled.has(n) }));

  const projFile = join(ctx.cwd, '.mcp.json');
  // 프로젝트 서버: 거부 목록이 우선이고, 전체 승인 또는 개별 승인이면 활성이다. 그 외는 승인 대기라 알 수 없다.
  for (const [n, d] of Object.entries(serverMap(await readJson(projFile)))) {
    const enabled = rules.rejected.has(n) ? false : rules.approveAll || rules.approved.has(n) ? true : null;
    items.push(toExtension(n, d, 'project', projFile, { enabled, approval: enabled === null ? '승인 대기 (대화형 세션에서 승인 필요)' : undefined }));
  }

  // 플러그인 서버: 플러그인이 켜져 있어야 시작되고, /mcp에서 끈 서버는 목록에 기록된다.
  // shortcut: 목록에 플러그인 서버가 어떤 이름으로 적히는지 확인하지 못해 서버 이름만 비교한다.
  const plugins = await enabledMap(ctx);
  for (const p of await listInstalled(ctx)) {
    const f = join(p.installPath, '.mcp.json');
    for (const [n, d] of Object.entries(serverMap(await readJson(f)))) {
      const pluginOn = plugins.get(p.id) ?? null;
      const enabled = pluginOn === false || rules.disabled.has(n) ? false : pluginOn;
      items.push(toExtension(n, d, 'plugin', f, { parent: p.id, enabled }));
    }
  }
  return { items };
}
