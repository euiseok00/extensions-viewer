// 화면. 서버 데이터는 신뢰할 수 없는 입력이므로 textContent만 쓴다(HTML 문자열 삽입 금지).
import { SCOPES, STATES, DEFAULTS, stateOf, matches, pluginTree, groupByParent, sortItems, sameName, highlight, parseHash, formatHash, splitId, finding, facets } from './logic.js';

const $ = (id) => document.getElementById(id);
const TABS = { plugins: '플러그인', mcp: 'MCP 서버', skills: '스킬' };
const KIND = { plugin: '플러그인', mcp: 'MCP 서버', skill: '스킬' };
const STATE_LABEL = { on: '활성', off: '비활성', unknown: '알 수 없음' };

let data = null;
let s = parseHash(location.hash);
let sel = null; // 선택한 항목의 키
let returnFocus = null; // 상세를 닫으면 돌아갈 행 버튼의 키
const open = new Set(); // 트리에서 펼친 플러그인

const keyOf = (i) => `${i.kind}|${i.scope}|${i.name}|${i.source}`;
const allItems = () => (data ? [...data.plugins.items, ...data.mcp.items, ...data.skills.items] : []);
const pluginById = (id) => data?.plugins.items.find((p) => p.name === id);

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function button(text, onClick, cls) {
  const b = el('button', text, cls);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// 검색어 부분만 <mark>로 감싼다.
function marked(text, cls) {
  const e = el('span', undefined, cls);
  for (const p of highlight(text, s.q)) e.append(p.hit ? el('mark', p.text) : document.createTextNode(p.text));
  return e;
}

function setState(patch) {
  s = { ...s, ...patch };
  history.replaceState(null, '', formatHash(s) || location.pathname);
  render();
}

function describe(i) {
  return i.detail.description ?? i.detail.command ?? i.detail.target ?? (i.detail.version ? `v${i.detail.version}` : '');
}

// 행 하나. 주 버튼(선택)과 부가 버튼(펼침, 소속 필터)을 형제로 두어 상호작용 요소를 중첩하지 않는다.
function row(i, { child = false, tree } = {}) {
  const li = el('li', undefined, `row${child ? ' child' : ''}${sel === keyOf(i) ? ' selected' : ''}`);
  if (tree) {
    const t = button('▸', () => { open.has(i.name) ? open.delete(i.name) : open.add(i.name); render(); }, 'toggle');
    t.setAttribute('aria-expanded', String(tree.isOpen));
    t.setAttribute('aria-label', `${i.name} 하위 항목 ${tree.isOpen ? '접기' : '펼치기'}`);
    t.disabled = tree.count === 0;
    li.append(t);
  } else li.append(el('span'));

  const main = button('', () => select(keyOf(i)), 'main');
  main.dataset.key = keyOf(i);
  main.setAttribute('aria-pressed', String(sel === keyOf(i)));
  const st = stateOf(i);
  const text = el('span');
  const { base, market } = splitId(i.name);
  const name = marked(base, 'name');
  if (market) name.append(el('span', market, 'market'));
  text.append(name, marked(describe(i), 'desc'));
  main.append(el('span', STATE_LABEL[st], `st ${st}`), text);
  li.append(main);

  const side = el('span', undefined, 'side');
  if (tree) side.append(el('span', `스킬 ${tree.total.skills} · MCP ${tree.total.mcp}`, 'kids'));
  if (i.parent && pluginById(i.parent)?.enabled === false) side.append(el('span', '플러그인 비활성', 'warn'));
  if (i.parent && !child) {
    const chip = button(splitId(i.parent).base, () => setState({ parent: i.parent }), 'parent');
    chip.setAttribute('aria-label', `${i.parent} 플러그인으로 필터`);
    side.append(chip);
  }
  side.append(el('span', i.scope, 'scope'));
  li.append(side);
  return li;
}

function group(title) {
  const li = el('li', title, 'group');
  li.setAttribute('role', 'presentation');
  return li;
}

function renderTabs() {
  const tabs = $('tabs');
  tabs.replaceChildren();
  for (const [key, label] of Object.entries(TABS)) {
    const b = button(label, () => setState({ tab: key, parent: '' }));
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(s.tab === key));
    b.append(el('span', String(data?.[key].items.length ?? 0), 'n'));
    tabs.append(b);
  }
}

function renderFilters(items) {
  const f = facets(items, s);
  const box = $('filters');
  box.replaceChildren();
  const chips = (label, values, chosen, key, names, counts) => {
    const g = el('div', undefined, 'fgroup');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    g.append(el('span', label));
    for (const v of values) {
      const on = chosen.includes(v);
      const c = button(names[v] ?? v, () => setState({ [key]: on ? chosen.filter((x) => x !== v) : [...chosen, v] }), 'chip');
      c.setAttribute('aria-pressed', String(on));
      c.append(el('span', String(counts[v]), 'n'));
      g.append(c);
    }
    return g;
  };
  box.append(chips('범위', SCOPES, s.scopes, 'scopes', {}, f.scopes), chips('상태', STATES, s.states, 'states', STATE_LABEL, f.states));
  if (s.tab !== 'plugins') {
    const lab = el('label', undefined, 'fgroup');
    lab.append(el('span', '출처'));
    const pick = el('select');
    const opt = (v, t) => { const o = el('option', t); o.value = v; o.selected = s.parent === v; pick.append(o); };
    opt('', '전체');
    opt('-', `플러그인 밖 (${f.parent('-')})`);
    for (const p of data.plugins.items) opt(p.name, `${splitId(p.name).base} (${f.parent(p.name)})`);
    pick.addEventListener('change', () => setState({ parent: pick.value }));
    lab.append(pick);
    box.append(lab);
  }
}

function renderView() {
  const seg = $('viewmode');
  seg.replaceChildren();
  for (const [v, t] of [['tree', '트리'], ['list', '목록']]) {
    const b = button(t, () => setState({ view: v }));
    b.setAttribute('aria-pressed', String(s.view === v));
    seg.append(b);
  }
  $('sort').value = s.sort;
}

// 목록을 그리고 [전체 개수, 보이는 개수]를 돌려준다.
function renderList() {
  const list = $('list');
  list.replaceChildren();
  const items = data[s.tab].items;
  if (s.tab === 'plugins' && s.view === 'tree') {
    const rows = pluginTree(data, s);
    let shown = 0;
    for (const r of sortItems(rows.map((x) => x.plugin), s.sort).map((p) => rows.find((x) => x.plugin === p))) {
      const count = r.skills.length + r.mcp.length;
      const isOpen = open.has(r.plugin.name) || (count > 0 && Boolean(s.q));
      list.append(row(r.plugin, { tree: { isOpen, count, total: r.total } }));
      shown++;
      if (isOpen) for (const c of [...sortItems(r.skills, s.sort), ...sortItems(r.mcp, s.sort)]) list.append(row(c, { child: true }));
    }
    return [items.length, shown];
  }
  const hits = sortItems(items.filter((i) => matches(i, s)), s.sort);
  if (s.view === 'tree') {
    for (const g of groupByParent(hits)) {
      list.append(group(g.key ? `플러그인 ${g.key}` : '플러그인 밖'));
      for (const i of g.items) list.append(row(i));
    }
  } else for (const i of hits) list.append(row(i));
  return [items.length, hits.length];
}

function renderDetail() {
  const d = $('detail');
  const i = sel && allItems().find((x) => keyOf(x) === sel);
  d.hidden = !i;
  document.querySelector('.layout').classList.toggle('has-detail', Boolean(i));
  if (!i) return d.replaceChildren();
  const h = el('h2', i.name);
  h.tabIndex = -1;
  const head = el('header');
  head.append(h, button('닫기', () => select(null)));
  const dl = el('dl');
  const add = (k, v, cls) => { if (v) dl.append(el('dt', k), el('dd', v, cls)); };
  add('종류', KIND[i.kind]);
  add('범위', i.scope);
  add('상태', STATE_LABEL[stateOf(i)]);
  add('소속 플러그인', i.parent);
  for (const [k, v] of Object.entries(i.detail)) add(k, v);
  add('출처 파일', i.source, 'mono');
  const live = el('span', '', 'muted');
  live.setAttribute('aria-live', 'polite');
  const copy = button('경로 복사', () => navigator.clipboard?.writeText(i.source).then(() => {
    live.textContent = '복사했습니다';
    setTimeout(() => (live.textContent = ''), 1500);
  }));
  const actions = el('div');
  actions.append(copy, document.createTextNode(' '), live);
  d.replaceChildren(head, dl, actions);
  const same = sameName(data, i);
  if (same.length > 1) {
    const box = el('div', undefined, 'same');
    box.append(el('strong', `같은 이름 ${same.length}곳`), el('div', '어느 쪽이 적용되는지는 판단하지 않습니다.', 'muted'));
    const ul = el('ul');
    for (const x of same) ul.append(el('li', `${x.scope} · ${x.source}`, 'mono'));
    box.append(ul);
    box.style.marginTop = '16px';
    d.append(box);
  }
}

function showState(text, error = false) {
  const e = $('state');
  e.textContent = text ?? '';
  e.classList.toggle('error', error);
}

function render() {
  renderTabs();
  if (!data) return;
  const items = data[s.tab].items;
  renderFilters(items);
  renderView();
  const [total, shown] = renderList();
  const result = data[s.tab];
  $('count').textContent = `${total}개 중 ${shown}개 표시`;
  $('reset').hidden = formatHash({ ...s, tab: DEFAULTS.tab, view: DEFAULTS.view, sort: DEFAULTS.sort }) === '';
  if (result.error) showState(`수집 실패: ${result.error}`, true);
  else if (total === 0) showState('설정에서 찾은 항목이 없습니다.');
  else if (shown === 0) showState('조건에 맞는 항목이 없습니다. 필터를 초기화해 보세요.');
  else showState(null);
  renderDetail();
}

function focusRow(key) {
  [...document.querySelectorAll('.main')].find((b) => b.dataset.key === key)?.focus();
}

// 열면 상세 제목으로, 닫으면 원래 행으로 포커스를 옮긴다.
function select(key) {
  const next = key === sel ? null : key;
  if (next) returnFocus = next;
  sel = next;
  render();
  if (sel) $('detail').querySelector('h2')?.focus();
  else if (returnFocus) focusRow(returnFocus);
}

async function load() {
  showState('불러오는 중…');
  $('refresh').disabled = true;
  try {
    const res = await fetch('/api/extensions');
    if (res.status === 403) throw new Error('auth');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    $('project').textContent = data.meta?.project ?? '';
    const f = finding(data);
    $('summary').textContent = f.summary;
    $('notes').replaceChildren(...f.notes.map((n) => el('li', n)));
    render();
  } catch (e) {
    data = null;
    render();
    $('list').replaceChildren();
    // fetch 자체가 실패하면 서버가 꺼진 것이다(유휴 10분 종료 등).
    showState(e instanceof TypeError ? '서버가 종료되었습니다. /extensions-viewer 를 다시 실행하세요.' : e.message === 'auth' ? '인증이 만료되었습니다. /extensions-viewer 를 다시 실행하세요.' : `불러오지 못했습니다: ${e.message}`, true);
  } finally {
    $('refresh').disabled = false;
  }
}

$('q').value = s.q;
$('q').addEventListener('input', (e) => setState({ q: e.target.value.trim() }));
$('sort').addEventListener('change', (e) => setState({ sort: e.target.value }));
$('reset').addEventListener('click', () => { $('q').value = ''; setState({ scopes: [], states: [], parent: '', q: '' }); });
$('refresh').addEventListener('click', load);
window.addEventListener('hashchange', () => { s = parseHash(location.hash); $('q').value = s.q; render(); });

window.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input, select');
  if (e.key === '/' && !typing) { e.preventDefault(); $('q').focus(); return; }
  if (e.key === 'Escape') { if (typing) e.target.blur(); else if (sel) select(null); return; }
  if (!e.target.classList?.contains('main') || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const rows = [...document.querySelectorAll('.main')];
  const at = rows.indexOf(e.target);
  rows[e.key === 'ArrowDown' ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0)]?.focus();
});

load();
