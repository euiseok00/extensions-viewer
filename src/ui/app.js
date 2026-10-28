// 화면은 textContent만 쓴다. 플러그인·스킬 메타데이터는 신뢰할 수 없는 입력이다.
import { SCOPES, STATES, DEFAULTS, facets, finding, formatHash, groupByParent, highlight, matches, parseHash, pluginTree, sameName, sortItems, splitId, stateOf } from '/logic.js';

const TABS = [['plugins', '플러그인'], ['mcp', 'MCP'], ['skills', '스킬']];
const STATE_LABEL = { on: '활성', off: '비활성', unknown: '알 수 없음' };
const STATE_MARK = { on: '●', off: '○', unknown: '–' };
const KIND_LABEL = { plugin: '플러그인', mcp: 'MCP', skill: '스킬' };
const HEAD = { plugins: ['이름', '범위', '', '버전', '포함'], mcp: ['이름', '범위', '소속 플러그인', '명령', ''], skills: ['이름', '범위', '소속 플러그인', '설명', ''] };

const $ = (id) => document.getElementById(id);
let data = null;
let s = parseHash(location.hash);
let sel = null;
let mcpStatus = null; // 마지막 연결 확인 결과. 새로 불러와도 다시 합친다.
let mcpChecking = false;
const open = new Set();

const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const button = (text, onclick, cls, pressed) => {
  const b = el('button', text, cls);
  b.type = 'button';
  b.onclick = onclick;
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
  return b;
};
const keyOf = (i) => `${i.kind}|${i.name}|${i.scope}|${i.source}`;
const allItems = () => (data ? [...data.plugins.items, ...data.mcp.items, ...data.skills.items] : []);
const pluginById = () => new Map(data.plugins.items.map((p) => [p.name, p]));

function setState(patch) {
  Object.assign(s, patch);
  history.replaceState(null, '', location.pathname + formatHash(s));
  if (('q' in patch || 'states' in patch) && (s.q || s.states.length)) {
    for (const r of pluginTree(data, s)) if (r.skills.length + r.mcp.length) open.add(r.plugin.name);
  }
  keepFocus(render);
}
const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function withHits(text, cls) {
  const span = el('span', undefined, cls);
  for (const p of highlight(text, s.q)) span.append(p.hit ? el('mark', p.text) : document.createTextNode(p.text));
  return span;
}

// 'name@marketplace'는 앞부분만 진하게, 뒷부분은 회색으로 보여준다.
function idName(name, cls) {
  const { base, market } = splitId(name);
  const span = withHits(base, cls);
  if (market) span.append(el('span', market, 'market'));
  return span;
}

// 한 행은 항상 일곱 칸이다: 펼침, 상태, 이름, 범위, 소속, 설명, 포함 개수.
function row(i, { nested = false, toggle = null, count = null } = {}) {
  const li = el('li', undefined, 'row' + (nested ? ' nested' : ''));
  li.tabIndex = 0;
  li.dataset.key = keyOf(i);
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', String(sel === li.dataset.key));
  li.onclick = () => select(li.dataset.key);

  const st = stateOf(i);
  const mark = el('span', STATE_MARK[st], `state c-state ${st}`);
  mark.title = STATE_LABEL[st];
  mark.setAttribute('aria-label', STATE_LABEL[st]);

  const name = idName(i.name, 'c-name');
  // 종류가 섞이는 곳(플러그인 탭의 하위·플러그인 밖 행)에서만 종류 태그를 붙인다.
  if (s.tab === 'plugins' && i.kind !== 'plugin') name.prepend(el('span', KIND_LABEL[i.kind], 'tag kind'));
  const dups = data ? sameName(data, i).length : 1;
  if (dups > 1) name.append(el('span', `같은 이름 ${dups}곳`, 'tag dup'));

  const from = el('span', undefined, 'c-from');
  if (i.parent && !nested) { // 트리 안의 하위 행은 이미 소속이 보이므로 칩을 생략한다
    const chip = button(splitId(i.parent).base, (e) => { e.stopPropagation(); setState({ parent: i.parent }); });
    chip.title = `${i.parent} 로 필터`;
    from.append(chip);
  }
  if (i.detail.connection) from.append(el('span', i.detail.connection, 'tag'));
  const parent = i.parent && pluginById().get(i.parent);
  if (parent && parent.enabled === false) {
    li.classList.add('dim');
    from.append(el('span', '플러그인 비활성', 'tag warn'));
  }
  const desc = i.detail.description || i.detail.command || i.detail.target || (i.detail.version ? 'v' + i.detail.version : '');
  li.append(toggle ?? el('span', undefined, 'c-toggle'), mark, name, el('span', i.scope, 'tag c-scope'), from, withHits(desc, 'c-desc'), count ?? el('span', undefined, 'c-count'));
  return li;
}

function pluginRow(r) {
  const isOpen = open.has(r.plugin.name);
  const kids = r.skills.length + r.mcp.length;
  const t = button(isOpen ? '▾' : '▸', (e) => {
    e.stopPropagation();
    if (isOpen) open.delete(r.plugin.name); else open.add(r.plugin.name);
    render();
  }, 'toggle c-toggle');
  t.setAttribute('aria-expanded', String(isOpen));
  t.setAttribute('aria-label', `${r.plugin.name} 하위 항목 ${isOpen ? '접기' : '펼치기'}`);
  const n = (shown, total) => (shown === total ? `${total}` : `${shown}/${total}`);
  const count = el('span', undefined, 'count c-count');
  count.append(el('b', n(r.skills.length, r.total.skills)), ` 스킬 · `, el('b', n(r.mcp.length, r.total.mcp)), ' MCP');
  const out = [row(r.plugin, { toggle: t, count })];
  if (isOpen && kids) for (const c of [...sortItems(r.mcp, s.sort), ...sortItems(r.skills, s.sort)]) out.push(row(c, { nested: true }));
  return out;
}

// 현재 탭에서 보여줄 행(li 배열)과 최상위 행 개수를 만든다.
function buildRows() {
  const items = data[s.tab].items;
  if (s.tab === 'plugins' && s.view === 'tree') {
    const rows = pluginTree(data, s);
    const order = new Map(sortItems(rows.map((r) => r.plugin), s.sort).map((p, n) => [p, n]));
    rows.sort((a, b) => order.get(a.plugin) - order.get(b.plugin));
    // 트리의 뿌리는 플러그인과 플러그인 밖 항목이다. 플러그인 밖 항목은 종류별로 나눠 같은 트리 끝에 보여준다.
    const direct = sortItems([...data.mcp.items, ...data.skills.items].filter((i) => !i.parent), s.sort);
    const lis = rows.flatMap(pluginRow);
    let shownDirect = 0;
    for (const [kind, label] of [['mcp', 'MCP 서버'], ['skill', '스킬']]) {
      const list = direct.filter((i) => i.kind === kind && matches(i, s));
      if (!list.length) continue;
      const head = el('li', `플러그인 밖 · ${label}`, 'group-head');
      head.setAttribute('role', 'presentation');
      lis.push(head, ...list.map((i) => row(i)));
      shownDirect += list.length;
    }
    return { lis, shown: rows.length + shownDirect, total: items.length + direct.length };
  }
  const list = sortItems(items.filter((i) => matches(i, s)), s.sort);
  if (s.tab !== 'plugins' && s.view === 'tree') {
    const lis = groupByParent(list).flatMap((g) => {
      const head = el('li', g.key || '플러그인 밖', 'group-head');
      head.setAttribute('role', 'presentation');
      return [head, ...g.items.map((i) => row(i))];
    });
    return { lis, shown: list.length, total: items.length };
  }
  return { lis: list.map((i) => row(i)), shown: list.length, total: items.length };
}

function renderHead() {
  const [name, scope, from, desc, count] = HEAD[s.tab];
  const h = (text, cls) => el('span', text, cls);
  $('thead').replaceChildren(h(''), h('상태'), h(name), h(scope), h(from), h(desc), h(count, 'h-count'));
}

// 현재 포커스를 기억했다가 다시 그린 뒤 되돌린다. 키보드로 필터를 고르는 중에도 흐름이 끊기지 않는다.
function keepFocus(fn) {
  const id = document.activeElement?.dataset?.fid;
  fn();
  if (id) document.querySelector(`[data-fid="${id}"]`)?.focus({ preventScroll: true });
}

// 옵션 한 줄: 체크박스(또는 라디오), 이름, 현재 조건에서 남는 개수.
function opt(fid, type, label, count, checked, onchange) {
  const l = el('label', undefined, 'opt' + (count === 0 && !checked ? ' zero' : ''));
  const input = el('input');
  input.type = type;
  input.name = fid.split(':')[0];
  input.checked = checked;
  input.dataset.fid = fid;
  input.onchange = onchange;
  l.append(input, el('span', label, 'l'), el('span', String(count), 'n'));
  return l;
}

function renderSide() {
  // 플러그인 탭의 트리에는 플러그인 밖 항목도 보이므로, 개수도 같은 항목들을 센다.
  const direct = [...data.mcp.items, ...data.skills.items].filter((i) => !i.parent);
  const items = s.tab === 'plugins' && s.view === 'tree' ? [...data.plugins.items, ...direct] : data[s.tab].items;
  const fc = facets(items, s);
  const group = (title, ...rows) => {
    const g = el('section', undefined, 'fgroup');
    g.append(el('h3', title), ...rows);
    return g;
  };
  const dirty = s.scopes.length || s.states.length || s.parent || s.q;
  const reset = button('초기화', () => { $('search').value = ''; setState({ ...DEFAULTS, tab: s.tab, view: s.view, sort: s.sort }); });
  reset.disabled = !dirty;
  reset.dataset.fid = 'reset';
  const head = el('div', undefined, 'side-head');
  head.append(el('span', '필터'), reset);
  const inner = el('div', undefined, 'side-inner');
  inner.append(
    head,
    group('범위', ...SCOPES.map((v) => opt(`scope:${v}`, 'checkbox', v, fc.scopes[v], s.scopes.includes(v), () => setState({ scopes: toggleIn(s.scopes, v) })))),
    group('상태', ...STATES.map((v) => opt(`state:${v}`, 'checkbox', STATE_LABEL[v], fc.states[v], s.states.includes(v), () => setState({ states: toggleIn(s.states, v) })))),
  );
  // 플러그인 탭은 트리가 출처를 이미 보여주므로 출처 필터를 쓰지 않는다.
  if (s.tab !== 'plugins') {
    const pick = (v) => () => setState({ parent: v });
    inner.append(group('출처',
      opt('parent:all', 'radio', '전체', items.filter((i) => matches(i, { ...s, parent: '' })).length, s.parent === '', pick('')),
      opt('parent:-', 'radio', '플러그인 밖', fc.parent('-'), s.parent === '-', pick('-')),
      ...data.plugins.items.map((p, n) => opt(`parent:${n}`, 'radio', splitId(p.name).base, fc.parent(p.name), s.parent === p.name, pick(p.name))),
    ));
  }
  $('side').replaceChildren(inner);

  // 툴바: 보기 전환(알약 세그먼트)과 텍스트 정렬 탭
  const seg = el('div', undefined, 'seg');
  seg.append(button('트리', () => setState({ view: 'tree' }), '', s.view === 'tree'), button('목록', () => setState({ view: 'list' }), '', s.view === 'list'));
  const sorts = el('div', undefined, 'sorts');
  sorts.append(button('이름순', () => setState({ sort: 'name' }), '', s.sort === 'name'), button('범위순', () => setState({ sort: 'scope' }), '', s.sort === 'scope'));
  seg.querySelectorAll('button').forEach((b, n) => (b.dataset.fid = `view:${n}`));
  sorts.querySelectorAll('button').forEach((b, n) => (b.dataset.fid = `sort:${n}`));
  const nodes = [seg, sorts];
  if (s.tab === 'mcp') {
    const check = button(mcpChecking ? '확인 중…' : mcpStatus ? '연결 다시 확인' : '연결 상태 확인', checkMcp);
    check.disabled = mcpChecking;
    check.dataset.fid = 'mcpcheck';
    check.title = '켜진 MCP 서버를 실제로 실행해 연결을 확인합니다(수 초 걸립니다)';
    nodes.unshift(check);
  }
  $('controls').replaceChildren(...nodes);
}

function setSide(open) {
  $('shell').dataset.side = open ? 'open' : 'closed';
  $('sidetoggle').textContent = open ? '필터 접기' : '필터 펼치기';
  $('sidetoggle').setAttribute('aria-expanded', String(open));
  $('side').inert = !open;
}

function renderDetail() {
  const d = $('detail');
  const i = sel && allItems().find((x) => keyOf(x) === sel);
  d.classList.toggle('open', Boolean(i));
  d.inert = !i;
  d.setAttribute('aria-hidden', String(!i));
  if (!i) return; // 닫힐 때는 내용을 그대로 두어 밀려 나가는 동안 비지 않게 한다
  const dl = el('dl');
  const add = (k, v, cls) => { if (v) dl.append(el('dt', k), el('dd', v, cls)); };
  add('종류', KIND_LABEL[i.kind]);
  add('범위', i.scope);
  add('상태', STATE_LABEL[stateOf(i)]);
  add('소속 플러그인', i.parent);
  for (const [k, v] of Object.entries(i.detail)) add(k, v);
  add('출처 파일', i.source, 'mono');
  const head = el('header');
  head.append(el('h2', i.name), button('닫기', () => select(null)));
  const copy = button('경로 복사', () => {
    navigator.clipboard?.writeText(i.source).then(() => {
      copy.textContent = '복사됨';
      setTimeout(() => (copy.textContent = '경로 복사'), 1500);
    });
  });
  const nodes = [head, dl, el('div', undefined, 'copyrow')];
  nodes[2].append(copy);
  nodes[2].style.marginTop = '12px';
  const same = sameName(data, i);
  if (same.length > 1) {
    const box = el('div', undefined, 'also');
    box.append(el('p', `같은 이름 ${same.length}곳. 어느 쪽이 적용되는지는 확인하지 않았습니다.`));
    for (const o of same) box.append(el('div', `${o.scope} · ${o.source}`));
    nodes.push(box);
  }
  d.replaceChildren(...nodes);
}

// 목록 틀은 그대로 두고 그 안에서 상태를 알린다. 오류에는 다시 시도 버튼이 붙는다.
function message(text, { error = false, retry = false } = {}) {
  const m = $('message');
  m.hidden = !text;
  m.className = error ? 'error' : '';
  m.replaceChildren();
  if (!text) return;
  m.append(text);
  if (retry) m.append(button('다시 시도', load));
}

function renderTop() {
  $('scope').textContent = data.meta?.project ?? '';
  $('scope').hidden = !data.meta?.project;
  $('stamp').textContent = data.meta?.generatedAt ? `갱신 ${new Date(data.meta.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}` : '';
  const f = finding(data);
  const line = $('finding');
  line.replaceChildren(f.summary);
  if (f.notes.length) line.append(' ', el('b', f.notes.join(' · ')));
}

function render() {
  if (!data) return;
  renderTop();
  $('tabs').replaceChildren(...TABS.map(([key, name]) => {
    const n = data[key].items.filter((i) => matches(i, s, { ignoreScope: false })).length;
    const filtered = s.scopes.length || s.states.length || s.parent || s.q;
    const b = el('button', `${name} ${filtered ? n : data[key].items.length}`);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(s.tab === key));
    b.onclick = () => { sel = null; setState({ tab: key }); };
    return b;
  }));
  renderSide();
  renderHead();
  const result = data[s.tab];
  const { lis, shown, total } = buildRows();
  $('list').replaceChildren(...lis);
  $('count').textContent = `${total}개 중 ${shown}개 표시`;
  if (result.error) message(`수집 실패: ${result.error}`, { error: true });
  else if (total === 0) message('설정에서 찾은 항목이 없습니다.');
  else if (shown === 0) message('조건에 맞는 항목이 없습니다. 필터를 초기화해 보세요.');
  else message(null);
  renderDetail();
}

function select(key) {
  sel = key === sel ? null : key;
  render();
  const row = sel && [...$('list').children].find((li) => li.dataset.key === sel);
  if (row) row.focus();
}

// `claude mcp list` 결과를 MCP 목록에 합친다. 목록에 없던 서버(예: claude.ai 커넥터)는 범위를 알 수 없는 항목으로 더한다.
function applyMcpStatus() {
  if (!data || !mcpStatus) return;
  data.mcp.items = data.mcp.items.filter((i) => i.source !== 'claude mcp list');
  for (const st of mcpStatus) {
    const found = data.mcp.items.find((i) => i.name === st.name);
    const connected = /connected/i.test(st.status) && !/not|fail/i.test(st.status);
    if (found) found.detail = { ...found.detail, connection: st.status };
    else data.mcp.items.push({ kind: 'mcp', name: st.name, scope: 'unknown', source: 'claude mcp list', enabled: connected ? true : null, detail: { target: st.target, connection: st.status } });
  }
}

async function checkMcp() {
  mcpChecking = true;
  keepFocus(render);
  try {
    const r = await fetch('/api/mcp-status');
    const j = r.ok ? await r.json() : { error: `HTTP ${r.status}` };
    if (j.error) message(`연결 확인 실패: ${j.error}`, { error: true });
    else mcpStatus = j.items;
  } catch {
    message('연결 확인 실패: 서버에 닿지 않습니다.', { error: true });
  }
  mcpChecking = false;
  applyMcpStatus();
  keepFocus(render);
}

// 불러오는 동안에는 실제 행 높이의 회색 막대로 틀을 보여준다(깜빡임 없음).
function skeleton() {
  message(null);
  $('list').replaceChildren(...Array.from({ length: 5 }, () => {
    const li = el('li', undefined, 'skeleton');
    li.append(...Array.from({ length: 7 }, () => el('i')));
    return li;
  }));
}

async function load() {
  if (!data) skeleton();
  try {
    const r = await fetch('/api/extensions');
    if (r.status === 403) return message('접근이 거부되었습니다. /extensions-viewer 로 다시 여십시오.', { error: true });
    if (!r.ok) return message(`불러오기 실패: HTTP ${r.status}`, { error: true, retry: true });
    data = await r.json();
    applyMcpStatus();
    render();
  } catch {
    $('list').replaceChildren();
    message('서버가 종료되었습니다. /extensions-viewer 를 다시 실행하세요.', { error: true });
  }
}

$('list').setAttribute('role', 'listbox');
setSide(!matchMedia('(max-width: 700px)').matches);
$('sidetoggle').onclick = () => setSide($('shell').dataset.side === 'closed');
$('search').value = s.q;
$('search').addEventListener('input', (e) => data && setState({ q: e.target.value }));
$('refresh').onclick = load;
// 주소의 해시를 직접 바꾸거나 뒤로 가기를 눌러도 화면이 따라온다(replaceState로 바꾼 해시는 이 이벤트를 일으키지 않는다).
window.addEventListener('hashchange', () => {
  s = parseHash(location.hash);
  $('search').value = s.q;
  if (data) render();
});
window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const typing = tag === 'INPUT' || tag === 'SELECT';
  if (e.key === '/' && !typing) { e.preventDefault(); $('search').focus(); return; }
  if (e.key === 'Escape') { if (typing) e.target.blur(); else if (sel) select(null); return; }
  if (typing) return;
  const rows = [...document.querySelectorAll('.row')];
  const at = rows.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); rows[Math.min(at + 1, rows.length - 1)]?.focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); rows[Math.max(at - 1, 0)]?.focus(); }
  else if ((e.key === 'Enter' || e.key === ' ') && at >= 0) { e.preventDefault(); rows[at].click(); }
});
load();
