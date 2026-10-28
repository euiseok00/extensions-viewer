import { test } from 'node:test';
import assert from 'node:assert/strict';

// 브라우저용 ES 모듈이라 타입 선언 없이 동적으로 불러온다.
const L: any = await import(new URL('../../src/ui/logic.js', import.meta.url).href);

const item = (kind: string, name: string, extra: any = {}) => ({
  kind, name, scope: 'user', source: 's', enabled: null, detail: {}, ...extra,
});
const data = {
  plugins: { items: [item('plugin', 'p1@m', { enabled: true }), item('plugin', 'p2@m', { enabled: false })] },
  mcp: { items: [item('mcp', 'srv', { scope: 'plugin', parent: 'p1@m', detail: { command: 'npx' } })] },
  skills: {
    items: [
      item('skill', 'alpha', { scope: 'plugin', parent: 'p1@m', detail: { description: 'does cave things' } }),
      item('skill', 'beta', { scope: 'plugin', parent: 'p2@m' }),
      item('skill', 'alpha', { scope: 'user' }),
    ],
  },
};
const F = { ...L.DEFAULTS };

test('matches: 같은 그룹은 OR, 그룹 사이는 AND', () => {
  const i = item('skill', 'x', { scope: 'user', enabled: true });
  assert.ok(L.matches(i, { ...F, scopes: ['user', 'project'] }));
  assert.ok(!L.matches(i, { ...F, scopes: ['project'] }));
  assert.ok(!L.matches(i, { ...F, scopes: ['user'], states: ['off'] }));
  assert.ok(L.matches(i, { ...F, states: ['on', 'off'] }));
});

test('matches: 검색은 이름과 detail 값을 대소문자 무시로 찾는다', () => {
  assert.ok(L.matches(data.skills.items[0], { ...F, q: 'CAVE' }));
  assert.ok(L.matches(data.mcp.items[0], { ...F, q: 'npx' }));
  assert.ok(!L.matches(data.skills.items[1], { ...F, q: 'cave' }));
});

test('matches: parent 필터는 플러그인 자신과 하위 항목을 모두 통과시킨다', () => {
  const f = { ...F, parent: 'p1@m' };
  assert.ok(L.matches(data.plugins.items[0], f));
  assert.ok(L.matches(data.skills.items[0], f));
  assert.ok(!L.matches(data.skills.items[1], f));
  assert.ok(!L.matches(data.skills.items[2], f));
});

test('pluginTree: 하위 항목 개수와 필터된 하위를 돌려준다', () => {
  const rows = L.pluginTree(data, F);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].total.skills, rows[0].total.mcp], [1, 1]);
});

test('pluginTree: 검색어에 맞는 하위 항목이 있으면 플러그인도 보인다', () => {
  const rows = L.pluginTree(data, { ...F, q: 'cave' });
  assert.deepEqual(rows.map((r: any) => r.plugin.name), ['p1@m']);
  assert.deepEqual(rows[0].skills.map((s: any) => s.name), ['alpha']);
  assert.equal(rows[0].mcp.length, 0);
});

test('pluginTree: 범위 필터는 하위 항목에 적용하지 않는다', () => {
  const rows = L.pluginTree(data, { ...F, scopes: ['user'] });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].skills.length, 1);
});

test('groupByParent: 플러그인 밖이 맨 앞', () => {
  const g = L.groupByParent(data.skills.items);
  assert.deepEqual(g.map((x: any) => x.key), ['', 'p1@m', 'p2@m']);
});

test('sortItems: 범위순은 user가 plugin보다 앞', () => {
  const s = L.sortItems(data.skills.items, 'scope');
  assert.equal(s[0].scope, 'user');
  assert.equal(L.sortItems(data.skills.items, 'name')[0].name, 'alpha');
});

test('sameName: 같은 종류·이름 항목을 모은다', () => {
  assert.equal(L.sameName(data, data.skills.items[0]).length, 2);
  assert.equal(L.sameName(data, data.skills.items[1]).length, 1);
});

test('highlight: 일치 부분만 hit로 나눈다', () => {
  assert.deepEqual(L.highlight('Cavecrew cave', 'cave'), [
    { text: 'Cave', hit: true },
    { text: 'crew ', hit: false },
    { text: 'cave', hit: true },
  ]);
  assert.deepEqual(L.highlight('abc', ''), [{ text: 'abc', hit: false }]);
  assert.deepEqual(L.highlight('<b>', 'x'), [{ text: '<b>', hit: false }]);
});

test('해시: 왕복 변환하고, 잘못된 값은 기본값으로 돌린다', () => {
  const s = { ...F, tab: 'skills', scopes: ['user', 'plugin'], states: ['on'], parent: 'p1@m', q: 'a b', view: 'list' };
  assert.deepEqual(L.parseHash(L.formatHash(s)), s);
  assert.equal(L.formatHash(F), '');
  const bad = L.parseHash('#tab=evil&scope=user,hack&view=x');
  assert.equal(bad.tab, 'plugins');
  assert.deepEqual(bad.scopes, ['user']);
  assert.equal(bad.view, 'tree');
});

test('splitId: name@marketplace를 나눈다', () => {
  assert.deepEqual(L.splitId('caveman@caveman'), { base: 'caveman', market: '@caveman' });
  assert.deepEqual(L.splitId('plain'), { base: 'plain', market: '' });
});

test('duplicateNames와 finding: 겹치는 이름과 비활성 플러그인을 센다', () => {
  assert.deepEqual(L.duplicateNames(data), [{ kind: 'skills', name: 'alpha', count: 2 }]);
  const f = L.finding(data);
  assert.match(f.summary, /플러그인 2개가 스킬 2개와 MCP 서버 1개/);
  assert.match(f.summary, /플러그인 밖에서 읽은 것은 스킬 1개, MCP 서버 0개/);
  assert.deepEqual(f.notes, ['비활성 플러그인 1개', '이름이 겹치는 항목 1개']);
});

test('matches: parent "-"는 플러그인 밖 스킬·MCP만 통과시킨다', () => {
  const f = { ...F, parent: '-' };
  assert.ok(L.matches(data.skills.items[2], f));
  assert.ok(!L.matches(data.skills.items[0], f));
  assert.ok(!L.matches(data.plugins.items[0], f));
});

test('facets: 옵션별 개수가 다른 필터를 반영한다', () => {
  const items = data.skills.items;
  assert.deepEqual(L.facets(items, F).scopes, { user: 1, project: 0, local: 0, plugin: 2 });
  assert.equal(L.facets(items, { ...F, q: 'cave' }).scopes.plugin, 1);
  assert.equal(L.facets(items, F).parent('p1@m'), 1);
  assert.equal(L.facets(items, F).parent('-'), 1);
});
