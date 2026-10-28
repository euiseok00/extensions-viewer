import { join } from 'node:path';
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

// enabledPlugins는 user < project < local 순으로 덮어쓴다.
async function enabledMap(ctx: Context): Promise<Map<string, boolean>> {
  const files = [
    join(ctx.home, '.claude', 'settings.json'),
    join(ctx.cwd, '.claude', 'settings.json'),
    join(ctx.cwd, '.claude', 'settings.local.json'),
  ];
  const map = new Map<string, boolean>();
  for (const f of files) {
    const enabled = (await readJson(f))?.enabledPlugins;
    for (const [k, v] of Object.entries(enabled ?? {})) if (typeof v === 'boolean') map.set(k, v);
  }
  return map;
}

// shortcut: `claude plugin list --json`은 쓰지 않고 파일만 읽는다. CLI 출력 형식 확인 후 추가.
export async function collectPlugins(ctx: Context): Promise<CollectResult> {
  const [installed, enabled] = await Promise.all([listInstalled(ctx), enabledMap(ctx)]);
  const items: Extension[] = installed.map((p) => ({
    kind: 'plugin',
    name: p.id,
    scope: p.scope,
    source: p.file,
    enabled: enabled.get(p.id) ?? null,
    detail: { version: p.version, installPath: p.installPath },
  }));
  return { items };
}
