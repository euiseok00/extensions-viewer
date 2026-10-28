import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectAll } from '../src/collect.js';
import { parseFrontmatter } from '../src/collectors/skills.js';

const SECRETS = ['FAKE_ENV_SECRET', 'FAKE_HEADER_SECRET', 'FAKE_ARG_SECRET', 'FAKE_URL_SECRET', 'FAKE_PLUGIN_SECRET'];

// 가짜 비밀값을 넣은 임시 홈·프로젝트 디렉터리를 만든다. 실제 설정 파일은 복사하지 않는다.
async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'ev-'));
  const home = join(root, 'home');
  const cwd = join(root, 'proj');
  const pluginDir = join(home, '.claude', 'plugins', 'cache', 'p1');
  await mkdir(join(home, '.claude', 'skills', 'my-skill'), { recursive: true });
  await mkdir(join(cwd, '.claude', 'skills', 'proj-skill'), { recursive: true });
  await mkdir(join(pluginDir, 'skills', 'plug-skill'), { recursive: true });
  await mkdir(join(pluginDir, 'commands'), { recursive: true });
  const w = (p: string, o: unknown) => writeFile(p, typeof o === 'string' ? o : JSON.stringify(o));

  await w(join(home, '.claude.json'), {
    projects: { [cwd]: { disabledMcpServers: ['srv'] } },
    mcpServers: {
      srv: {
        command: 'npx',
        args: ['-y', 'pkg', '--token', 'FAKE_ARG_SECRET'],
        env: { API_KEY: 'FAKE_ENV_SECRET' },
      },
      remote: {
        type: 'http',
        url: 'https://h.example/mcp?key=FAKE_URL_SECRET',
        headers: { Authorization: 'Bearer FAKE_HEADER_SECRET' },
      },
    },
  });
  await w(join(pluginDir, '.mcp.json'), { mcpServers: { pm: { command: 'x', env: { T: 'FAKE_PLUGIN_SECRET' } } } });
  await w(join(home, '.claude', 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: { 'p1@m': [{ scope: 'user', version: '1.0.0', installPath: pluginDir }] },
  });
  await w(join(home, '.claude', 'settings.json'), { enabledPlugins: { 'p1@m': true } });
  await w(join(cwd, '.claude', 'settings.local.json'), { enabledPlugins: { 'p1@m': false } });
  await w(join(cwd, '.claude', 'settings.json'), { enabledMcpjsonServers: ['b'], disabledMcpjsonServers: ['a'] });
  await w(join(cwd, '.mcp.json'), { mcpServers: { a: { command: 'x' }, b: { command: 'x' }, c: { command: 'x' } } });
  await w(join(home, '.claude', 'skills', 'my-skill', 'SKILL.md'), '---\nname: my-skill\ndescription: <script>alert(1)</script>\n---\nbody');
  await w(join(cwd, '.claude', 'skills', 'proj-skill', 'SKILL.md'), '---\ndescription: >\n  folded\n  text\n---\n');
  await w(join(pluginDir, 'skills', 'plug-skill', 'SKILL.md'), '---\nname: plug-skill\n---\n');
  await w(join(pluginDir, 'commands', 'plug-cmd.md'), '---\ndescription: a command\n---\n');
  return { home, cwd, cli: async () => undefined };
}

test('3종 수집과 범위·활성 여부', async () => {
  const r = await collectAll(await makeFixture());
  assert.equal(r.plugins.items.length, 1);
  assert.equal(r.plugins.items[0].enabled, false); // local이 user를 덮어쓴다
  assert.deepEqual(r.mcp.items.map((i) => [i.name, i.scope]).sort(), [['a', 'project'], ['b', 'project'], ['c', 'project'], ['pm', 'plugin'], ['remote', 'user'], ['srv', 'user']]);
  assert.deepEqual(r.skills.items.map((i) => [i.name, i.scope]).sort(), [['my-skill', 'user'], ['plug-cmd', 'plugin'], ['plug-skill', 'plugin'], ['proj-skill', 'project']]);
  assert.equal(r.skills.items.find((i) => i.name === 'proj-skill')?.detail.description, 'folded text');
});

test('MCP 활성 여부: 끈 목록, 승인·거부, 플러그인 상태를 따른다', async () => {
  const r = await collectAll(await makeFixture());
  const on = (n: string) => r.mcp.items.find((i) => i.name === n)?.enabled;
  assert.equal(on('srv'), false); // ~/.claude.json의 disabledMcpServers
  assert.equal(on('remote'), true); // 끈 목록에 없는 사용자 서버
  assert.equal(on('a'), false); // disabledMcpjsonServers
  assert.equal(on('b'), true); // enabledMcpjsonServers
  assert.equal(on('c'), null); // 승인 대기
  assert.equal(r.mcp.items.find((i) => i.name === 'c')?.detail.approval, '승인 대기 (대화형 세션에서 승인 필요)');
  assert.equal(on('pm'), false); // 소속 플러그인이 비활성
});

test('플러그인 유래 스킬·MCP만 parent를 가진다', async () => {
  const r = await collectAll(await makeFixture());
  const parent = (list: { name: string; parent?: string }[], n: string) => list.find((i) => i.name === n)?.parent;
  assert.equal(parent(r.mcp.items, 'pm'), 'p1@m');
  assert.equal(parent(r.skills.items, 'plug-skill'), 'p1@m');
  assert.equal(parent(r.skills.items, 'my-skill'), undefined);
  assert.equal(parent(r.mcp.items, 'srv'), undefined);
});

test('출력 JSON 어디에도 비밀값이 남지 않는다', async () => {
  const out = JSON.stringify(await collectAll(await makeFixture()));
  for (const s of SECRETS) assert.ok(!out.includes(s), `${s} 노출`);
  assert.ok(out.includes('API_KEY')); // 키 이름은 보인다
});

test('수집기 하나가 실패해도 나머지는 표시한다', async () => {
  const f = await makeFixture();
  await writeFile(join(f.home, '.claude.json'), '{broken');
  const r = await collectAll(f);
  assert.ok(r.mcp.error);
  assert.equal(r.mcp.items.length, 0);
  assert.equal(r.plugins.items.length, 1);
  assert.equal(r.skills.items.length, 4);
});

test('parseFrontmatter: frontmatter가 없으면 빈 객체', () => {
  assert.deepEqual(parseFrontmatter('no meta'), {});
});
