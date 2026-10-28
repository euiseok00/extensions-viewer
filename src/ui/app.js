// 화면은 textContent만 쓴다. 플러그인·스킬 메타데이터는 신뢰할 수 없는 입력이다.
const TABS = [
  ['plugins', '플러그인'],
  ['mcp', 'MCP'],
  ['skills', '스킬'],
];
let data = null;
let current = 'plugins';

const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

function render() {
  const tabs = document.getElementById('tabs');
  tabs.replaceChildren(
    ...TABS.map(([key, name]) => {
      const b = el('button', `${name} (${data[key].items.length})`, key === current ? 'active' : '');
      b.onclick = () => {
        current = key;
        render();
      };
      return b;
    }),
  );

  const err = document.getElementById('error');
  const result = data[current];
  err.hidden = !result.error;
  err.textContent = result.error ? `수집 실패: ${result.error}` : '';

  const q = document.getElementById('search').value.toLowerCase();
  const rows = result.items.filter((i) => `${i.name} ${Object.values(i.detail).join(' ')}`.toLowerCase().includes(q));
  document.getElementById('list').replaceChildren(
    ...rows.map((i) => {
      const li = el('li');
      const state = i.enabled === null ? '' : i.enabled ? ' · 활성' : ' · 비활성';
      li.append(el('strong', i.name), el('div', `${i.scope}${state} · ${i.source}`, 'meta'));
      const d = Object.entries(i.detail).filter(([, v]) => v);
      if (d.length) li.append(el('div', d.map(([k, v]) => `${k}: ${v}`).join(' | '), 'detail'));
      return li;
    }),
  );
}

document.getElementById('search').addEventListener('input', () => data && render());
fetch('/api/extensions')
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
  .then((j) => {
    data = j;
    render();
  })
  .catch((e) => {
    const err = document.getElementById('error');
    err.hidden = false;
    err.textContent = `불러오기 실패: ${e.message}`;
  });
