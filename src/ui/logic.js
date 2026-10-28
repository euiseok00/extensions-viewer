// 화면 로직 중 DOM과 무관한 순수 함수. node:test로 검증한다.
export const SCOPES = ['user', 'project', 'local', 'plugin'];
export const STATES = ['on', 'off', 'unknown'];
export const DEFAULTS = { tab: 'plugins', view: 'tree', sort: 'name', scopes: [], states: [], parent: '', q: '' };

export const stateOf = (i) => (i.enabled === true ? 'on' : i.enabled === false ? 'off' : 'unknown');

const searchText = (i) => `${i.name} ${Object.values(i.detail).join(' ')}`.toLowerCase();

// 필터 f의 빈 배열·빈 문자열은 "조건 없음"이다. 같은 그룹은 OR, 그룹 사이는 AND.
// ignoreScope: 플러그인의 하위 항목은 범위가 항상 plugin이라 범위 필터를 적용하지 않는다.
export function matches(i, f, { ignoreScope = false } = {}) {
  if (!ignoreScope && f.scopes.length && !f.scopes.includes(i.scope)) return false;
  if (f.states.length && !f.states.includes(stateOf(i))) return false;
  // parent '-'는 "플러그인 밖"(플러그인 소속이 아닌 스킬·MCP)를 뜻한다.
  if (f.parent === '-') {
    if (i.kind === 'plugin' || i.parent) return false;
  } else if (f.parent && i.parent !== f.parent && !(i.kind === 'plugin' && i.name === f.parent)) return false;
  return !f.q || searchText(i).includes(f.q.toLowerCase());
}

// 플러그인 id -> { skills, mcp }
export function childrenByParent(data) {
  const m = new Map();
  for (const kind of ['skills', 'mcp']) {
    for (const i of data[kind].items) {
      if (!i.parent) continue;
      if (!m.has(i.parent)) m.set(i.parent, { skills: [], mcp: [] });
      m.get(i.parent)[kind].push(i);
    }
  }
  return m;
}

// 트리 보기의 플러그인 행. 플러그인 자신이 맞거나, 검색·상태 조건에 맞는 하위 항목이 있으면 보인다.
export function pluginTree(data, f) {
  const kids = childrenByParent(data);
  const childFilter = (i) => matches(i, f, { ignoreScope: true });
  const rows = [];
  for (const plugin of data.plugins.items) {
    const c = kids.get(plugin.name) ?? { skills: [], mcp: [] };
    const skills = c.skills.filter(childFilter);
    const mcp = c.mcp.filter(childFilter);
    const childActive = Boolean(f.q) || f.states.length > 0;
    if (!matches(plugin, f) && !(childActive && skills.length + mcp.length > 0)) continue;
    rows.push({ plugin, skills, mcp, total: { skills: c.skills.length, mcp: c.mcp.length } });
  }
  return rows;
}

// 플러그인 밖(parent 없음)을 맨 앞에 두고, 나머지는 플러그인 id 순으로 묶는다.
export function groupByParent(items) {
  const m = new Map();
  for (const i of items) m.set(i.parent ?? '', [...(m.get(i.parent ?? '') ?? []), i]);
  return [...m.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))).map(([key, list]) => ({ key, items: list }));
}

export function sortItems(items, by) {
  const scopeRank = (i) => SCOPES.indexOf(i.scope);
  return [...items].sort((a, b) => (by === 'scope' ? scopeRank(a) - scopeRank(b) : 0) || a.name.localeCompare(b.name));
}

// 같은 종류·이름의 항목 모음. 어느 쪽이 적용되는지는 판단하지 않는다.
export function sameName(data, item) {
  const list = item.kind === 'plugin' ? data.plugins.items : item.kind === 'mcp' ? data.mcp.items : data.skills.items;
  return list.filter((i) => i.name === item.name);
}

// 검색어와 일치하는 부분을 나눈다. 화면은 hit 조각만 <mark>로 감싼다.
export function highlight(text, q) {
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts = [];
  let at = 0;
  for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, at)) {
    if (i > at) parts.push({ text: text.slice(at, i), hit: false });
    parts.push({ text: text.slice(i, i + needle.length), hit: true });
    at = i + needle.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}

const list = (s) => (s ? s.split(',').filter(Boolean) : []);

export function parseHash(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
  return {
    tab: pick(p.get('tab'), ['plugins', 'mcp', 'skills'], DEFAULTS.tab),
    view: pick(p.get('view'), ['tree', 'list'], DEFAULTS.view),
    sort: pick(p.get('sort'), ['name', 'scope'], DEFAULTS.sort),
    scopes: list(p.get('scope')).filter((s) => SCOPES.includes(s)),
    states: list(p.get('state')).filter((s) => STATES.includes(s)),
    parent: p.get('parent') ?? '',
    q: p.get('q') ?? '',
  };
}

// 기본값과 같은 항목은 해시에서 뺀다.
export function formatHash(s) {
  const p = new URLSearchParams();
  for (const k of ['tab', 'view', 'sort', 'parent', 'q']) if (s[k] !== DEFAULTS[k]) p.set(k, s[k]);
  if (s.scopes.length) p.set('scope', s.scopes.join(','));
  if (s.states.length) p.set('state', s.states.join(','));
  const out = p.toString();
  return out ? `#${out}` : '';
}

// 'name@marketplace'를 둘로 나눈다. 화면은 앞부분만 진하게 보여준다.
export function splitId(name) {
  const at = name.lastIndexOf('@');
  return at > 0 ? { base: name.slice(0, at), market: name.slice(at) } : { base: name, market: '' };
}

// 같은 종류·이름이 두 곳 이상인 것들. 어느 쪽이 적용되는지는 판단하지 않는다.
export function duplicateNames(data) {
  const out = [];
  for (const kind of ['plugins', 'mcp', 'skills']) {
    const counts = new Map();
    for (const i of data[kind].items) counts.set(i.name, (counts.get(i.name) ?? 0) + 1);
    for (const [name, count] of counts) if (count > 1) out.push({ kind, name, count });
  }
  return out;
}

// 화면의 한 줄 요약. 실제 데이터에서 계산하고, 주의할 사실이 있으면 notes에 담는다.
export function finding(data) {
  const kids = childrenByParent(data);
  let skills = 0;
  let mcp = 0;
  for (const c of kids.values()) {
    skills += c.skills.length;
    mcp += c.mcp.length;
  }
  const directSkills = data.skills.items.length - skills;
  const directMcp = data.mcp.items.length - mcp;
  const off = data.plugins.items.filter((p) => p.enabled === false).length;
  const dup = duplicateNames(data).length;
  const notes = [];
  if (off) notes.push(`비활성 플러그인 ${off}개`);
  if (dup) notes.push(`이름이 겹치는 항목 ${dup}개`);
  return {
    summary: `플러그인 ${data.plugins.items.length}개가 스킬 ${skills}개와 MCP 서버 ${mcp}개를 들여옵니다. 플러그인 밖에서 읽은 것은 스킬 ${directSkills}개, MCP 서버 ${directMcp}개입니다.`,
    notes,
  };
}

// 필터 사이드바의 옵션별 개수. 각 옵션을 단독으로 골랐을 때 남는 항목 수라서 필터를 바꿀 때마다 달라진다.
export function facets(items, f) {
  const n = (patch) => items.filter((i) => matches(i, { ...f, ...patch })).length;
  return {
    scopes: Object.fromEntries(SCOPES.map((v) => [v, n({ scopes: [v] })])),
    states: Object.fromEntries(STATES.map((v) => [v, n({ states: [v] })])),
    parent: (id) => n({ parent: id }),
  };
}
