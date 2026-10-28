import { basename } from 'node:path';
import type { CollectResult, Context } from './types.js';
import { collectMcp } from './collectors/mcp.js';
import { collectPlugins } from './collectors/plugins.js';
import { collectSkills } from './collectors/skills.js';

async function safe(fn: (c: Context) => Promise<CollectResult>, ctx: Context): Promise<CollectResult> {
  try {
    return await fn(ctx);
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// 수집기 하나가 실패해도 나머지는 결과를 돌려준다.
export async function collectAll(ctx: Context) {
  const [plugins, mcp, skills] = await Promise.all([
    safe(collectPlugins, ctx),
    safe(collectMcp, ctx),
    safe(collectSkills, ctx),
  ]);
  return { plugins, mcp, skills, meta: { project: basename(ctx.cwd), generatedAt: new Date().toISOString() } };
}
