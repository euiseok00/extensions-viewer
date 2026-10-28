import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeId } from '../src/claudeCli.js';
import { collectPlugins, parseDetails } from '../src/collectors/plugins.js';
import { collectMcpStatus, parseMcpList } from '../src/mcpStatus.js';

// 실제 `claude plugin details ponytail@ponytail` 출력에서 줄여온 예
const DETAILS = `ponytail 5.3.2
  Description: Forces the laziest solution that works.

Component inventory
  Skills (6)  ponytail, ponytail-audit, ponytail-debt
  Agents (0)
  Hooks (3)  SessionStart, SubagentStart, UserPromptSubmit  (harness-only — no model context cost)
  MCP servers (0)
  LSP servers (0)

Projected token cost
  Always-on:   ~641 tok   added to every session
`;

test('parseDetails: 구성 개수와 상시 토큰 비용', () => {
  assert.deepEqual(parseDetails(DETAILS), {
    skills: '6',
    agents: '0',
    hooks: '3: SessionStart, SubagentStart, UserPromptSubmit',
    mcpServers: '0',
    lsp: '0',
    alwaysOnTokens: '~641 tok',
  });
  assert.deepEqual(parseDetails('알 수 없는 출력'), {});
});

const MCP_LIST = `Checking MCP server health…

claude.ai Claude Docs: https://api.anthropic.com/v1/pages/mcp?key=FAKE_URL_SECRET - ✔ Connected
rea: cmd.exe /d /c npx -y rea-agents@6.8.0 mcp --token FAKE_ARG_SECRET - ✔ Connected
broken: node x.js - ✘ Failed to connect
`;

test('parseMcpList: 이름·대상·상태를 나누고 대상의 비밀값을 가린다', () => {
  const r = parseMcpList(MCP_LIST);
  assert.deepEqual(r.map((x) => [x.name, x.status]), [['claude.ai Claude Docs', '✔ Connected'], ['rea', '✔ Connected'], ['broken', '✘ Failed to connect']]);
  const json = JSON.stringify(r);
  assert.ok(!json.includes('FAKE_URL_SECRET') && !json.includes('FAKE_ARG_SECRET'));
});

test('collectMcpStatus: CLI가 실패하면 오류 문구를 돌려준다', async () => {
  assert.ok((await collectMcpStatus({ home: '', cwd: '', cli: async () => undefined })).error);
  assert.equal((await collectMcpStatus({ home: '', cwd: '', cli: async () => MCP_LIST })).items.length, 3);
});

test('safeId: 옵션처럼 보이거나 이상한 문자가 든 이름은 거부한다', () => {
  assert.ok(safeId('caveman@caveman') && safeId('a.b-c@d_e'));
  for (const bad of ['--help', '-x', '', 'a b', 'a;b', 'a$(x)']) assert.ok(!safeId(bad), bad);
});

async function pluginFixture() {
  const home = await mkdtemp(join(tmpdir(), 'ev-c-'));
  await mkdir(join(home, '.claude', 'plugins'), { recursive: true });
  await writeFile(
    join(home, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify({ plugins: { 'p1@m': [{ scope: 'user', version: '1.0.0', installPath: '/x' }], '--bad@m': [{ scope: 'user', version: '1', installPath: '/y' }] } }),
  );
  await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'p1@m': false } }));
  return { home, cwd: join(home, 'proj') };
}

test('collectPlugins: CLI 값이 파일 값을 덮어쓰고 구성 목록을 더한다', async () => {
  const calls: string[] = [];
  const cli = async (args: string[]) => {
    calls.push(args.join(' '));
    if (args[1] === 'list') return JSON.stringify([{ id: 'p1@m', scope: 'user', enabled: true }]);
    return DETAILS;
  };
  const r = await collectPlugins({ ...(await pluginFixture()), cli });
  const p1 = r.items.find((i) => i.name === 'p1@m')!;
  assert.equal(p1.enabled, true); // 파일은 false, CLI는 true
  assert.equal(p1.detail.skills, '6');
  assert.equal(p1.detail.alwaysOnTokens, '~641 tok');
  assert.ok(!calls.some((c) => c.includes('--bad')), '위험한 이름은 CLI에 넘기지 않는다');
});

test('collectPlugins: CLI가 실패하면 파일 값만 쓴다', async () => {
  const r = await collectPlugins({ ...(await pluginFixture()), cli: async () => undefined });
  const p1 = r.items.find((i) => i.name === 'p1@m')!;
  assert.equal(p1.enabled, false);
  assert.equal(p1.detail.skills, undefined);
});
