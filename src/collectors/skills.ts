import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listDir } from '../fsutil.js';
import type { CollectResult, Context, Extension } from '../types.js';
import { listInstalled } from './plugins.js';

// SKILL.md 상단 frontmatter에서 name·description만 읽는다.
// 한 줄 값과 `>`/`|` 블록만 지원하고, 그 밖의 YAML은 무시한다.
export function parseFrontmatter(text: string): Record<string, string> {
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out: Record<string, string> = {};
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(name|description):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^[>|][+-]?$/.test(v)) {
      const parts: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
      v = parts.join(' ');
    }
    out[kv[1]] = v.replace(/^(["'])(.*)\1$/, '$2');
  }
  return out;
}

async function scanDir(dir: string, scope: Extension['scope'], parent?: string): Promise<Extension[]> {
  const items: Extension[] = [];
  for (const entry of await listDir(dir)) {
    const file = join(dir, entry, 'SKILL.md');
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue; // SKILL.md가 없는 폴더는 스킬이 아니다.
    }
    const fm = parseFrontmatter(text);
    items.push({
      kind: 'skill',
      name: fm.name || entry,
      scope,
      source: file,
      enabled: null,
      detail: { description: fm.description ?? '' },
      ...(parent && { parent }),
    });
  }
  return items;
}

// 플러그인의 commands/*.md도 Claude Code는 스킬(슬래시 명령)로 센다. claude plugin details의 개수와 대조해 확인했다.
async function scanCommands(dir: string, scope: Extension['scope'], parent?: string): Promise<Extension[]> {
  const items: Extension[] = [];
  for (const entry of await listDir(dir)) {
    if (!entry.endsWith('.md')) continue;
    const file = join(dir, entry);
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue; // 폴더 등 읽을 수 없는 항목은 건너뛴다.
    }
    const fm = parseFrontmatter(text);
    items.push({
      kind: 'skill',
      name: fm.name || entry.slice(0, -3),
      scope,
      source: file,
      enabled: null,
      detail: { description: fm.description ?? '', type: 'commands/ 폴더의 명령' },
      ...(parent && { parent }),
    });
  }
  return items;
}

export async function collectSkills(ctx: Context): Promise<CollectResult> {
  const items = [
    ...(await scanDir(join(ctx.home, '.claude', 'skills'), 'user')),
    ...(await scanDir(join(ctx.cwd, '.claude', 'skills'), 'project')),
  ];
  for (const p of await listInstalled(ctx)) items.push(...(await scanDir(join(p.installPath, 'skills'), 'plugin', p.id)), ...(await scanCommands(join(p.installPath, 'commands'), 'plugin', p.id)));
  return { items };
}
