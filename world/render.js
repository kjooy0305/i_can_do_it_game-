// 세계관 노트 공용 그리기 (index.html 과 page.html 이 같이 쓴다)
window.WN = (function () {
  const W = window.WORLD;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  const li = a => (a || []).map(c => `<li>${md(c)}</li>`).join('');
  const GROUPS = W.groups || [], TYPES = W.types || [], ENTRIES = W.entries || [];
  const ALL = GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.id, gname: g.name })));
  const byId = Object.fromEntries(ALL.map(i => [i.id, i]));
  const eById = Object.fromEntries(ENTRIES.map(e => [e.id, e]));
  const tById = Object.fromEntries(TYPES.map(t => [t.id, t]));
  const gById = Object.fromEntries(GROUPS.map(g => [g.id, g]));
  const SECTIONS = W.sections || [];
  const secById = Object.fromEntries(SECTIONS.map(x => [x.id, x]));
  const secOfGroup = {}, secOfType = {};
  SECTIONS.forEach(x => { (x.groups || []).forEach(g => { secOfGroup[g] = x; }); (x.types || []).forEach(t => { secOfType[t] = x; }); });
  const STATUS = { seed: ['핵심만', ''], draft: ['첨언 있음', 'w'], ok: ['확정', 'k'], blank: ['이름만', ''] };
  const placeTypes = new Set(TYPES.flatMap(t => t.parents ? [t.id, ...t.parents] : []));
  const childrenOf = e => ENTRIES.filter(x => x.parent === e.id);
  const ancestors = e => { const r = []; for (let c = eById[e.parent]; c; c = eById[c.parent]) r.unshift(c); return r; };
  const title = id => byId[id] ? byId[id].title : eById[id] ? eById[id].name : null;
  const isPlace = e => placeTypes.has(e.type);

  // 경로: [{label, sel}]  (sel 은 location.hash 로 쓰는 값). 맨 위는 "노트 › 큰 분류 › ..." 순서다.
  function pathSel(sel) {
    const root = { label: '노트', sel: '' };
    if (!sel) return [root];
    const sec = x => x ? { label: x.name, sel: 's=' + x.id } : null;
    const keep = a => a.filter(Boolean);
    if (sel.startsWith('s=') && secById[sel.slice(2)]) return [root, sec(secById[sel.slice(2)])];
    if (sel.startsWith('g=') && gById[sel.slice(2)]) { const g = gById[sel.slice(2)]; return keep([root, sec(secOfGroup[g.id]), { label: g.name, sel }]); }
    if (sel.startsWith('t=') && tById[sel.slice(2)]) { const t = tById[sel.slice(2)]; return keep([root, sec(secOfType[t.id]), { label: t.name, sel }]); }
    if (byId[sel]) { const i = byId[sel]; return keep([root, sec(secOfGroup[i.group]), { label: i.gname, sel: 'g=' + i.group }, { label: i.title, sel }]); }
    if (eById[sel]) {
      const e = eById[sel];
      const mid = isPlace(e) ? ancestors(e).map(a => ({ label: a.name, sel: a.id })) : [{ label: tById[e.type].name, sel: 't=' + e.type }];
      return keep([root, sec(secOfType[e.type]), ...mid, { label: e.name, sel }]);
    }
    return [root];
  }

  // 본문 블록. mk(id, text) 는 이어지는 항목으로 가는 버튼/링크를 만든다.
  function noteBlocks(i, mk) {
    const refs = (i.link || []).filter(id => title(id)).map(id => mk(id, title(id))).join('');
    return `<div class="blk core"><h3><span class="tag k">핵심</span></h3><ul>${li(i.core)}</ul></div>
      <div class="blk"><h3><span class="tag w">첨언</span></h3><ul>${li(i.add)}</ul></div>
      ${(i.ask || []).length ? `<div class="blk ask"><h3><span class="tag">열린 질문</span></h3><ul>${li(i.ask)}</ul></div>` : ''}
      ${refs ? `<div class="blk"><h3>이어지는 줄</h3><div class="refs">${refs}</div></div>` : ''}`;
  }
  function entryBlocks(e, mk) {
    const anc = ancestors(e), kids = childrenOf(e);
    const inh = anc.flatMap(a => [...(a.rules || []).map(r => [a, '규칙', r]), ...(a.core || []).map(r => [a, '핵심', r])]);
    const refs = (e.link || []).filter(id => title(id)).map(id => mk(id, title(id))).join('');
    const kidRefs = kids.map(k => mk(k.id, `${tById[k.type].name} · ${k.name}`)).join('');
    return `${(e.core || []).length ? `<div class="blk core"><h3><span class="tag k">핵심</span></h3><ul>${li(e.core)}</ul></div>` : ''}
      ${(e.rules || []).length ? `<div class="blk rule"><h3><span class="tag k">규칙</span> 이야기가 어기면 안 돼요</h3><ul>${li(e.rules)}</ul></div>` : ''}
      ${inh.length ? `<div class="blk inh"><h3>위에서 물려받는 규칙·핵심</h3><ul>${inh.map(([a, k, r]) => `<li><b>${esc(a.name)}</b> (${k}) ${md(r)}</li>`).join('')}</ul></div>` : ''}
      ${(e.add || []).length ? `<div class="blk"><h3><span class="tag w">첨언</span></h3><ul>${li(e.add)}</ul></div>` : ''}
      ${(e.story || []).length ? `<div class="blk"><h3>이야기 씨앗</h3><ul>${li(e.story)}</ul></div>` : ''}
      ${(e.ask || []).length ? `<div class="blk ask"><h3><span class="tag">열린 질문</span></h3><ul>${li(e.ask)}</ul></div>` : ''}
      ${kidRefs ? `<div class="blk"><h3>하위 항목</h3><div class="refs">${kidRefs}</div></div>` : ''}
      ${refs ? `<div class="blk"><h3>이어지는 줄</h3><div class="refs">${refs}</div></div>` : ''}`;
  }
  // ===== 수정 내용(편집) =====
  // 원본(data.js) 값은 BASE 에 보관하고, 사이트에서 고친 값은 브라우저(localStorage)에 {before, after} 로 저장한다.
  // 내보내기는 바뀐 곳만 담는다. before 는 "수정하던 때의 원본"이라 나중에 data.js 가 바뀌어도 3-way 로 합칠 수 있다.
  const EDITABLE = { note: ['title', 'status', 'core', 'add', 'ask'], entry: ['name', 'status', 'core', 'add', 'ask', 'rules', 'story'] };
  const LISTS = ['core', 'add', 'ask', 'rules', 'story'];
  const objOf = id => byId[id] || eById[id];
  const kindOf = id => byId[id] ? 'note' : eById[id] ? 'entry' : null;
  const clone = v => JSON.parse(JSON.stringify(v));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const BASE = {};
  [...ALL, ...ENTRIES].forEach(x => { const k = kindOf(x.id); BASE[x.id] = {}; EDITABLE[k].forEach(f => { if (x[f] !== undefined) BASE[x.id][f] = clone(x[f]); }); });
  const KEY = 'world.edits.v1';
  let store = { baseUpdated: W.updated, fields: {} };
  try { const t = JSON.parse(localStorage.getItem(KEY) || 'null'); if (t && t.fields) store = t; } catch (e) {}
  const stale = {};
  Object.entries(store.fields).forEach(([id, fs]) => {
    const o = objOf(id); if (!o) return;
    Object.entries(fs).forEach(([f, v]) => {
      if (!EDITABLE[kindOf(id)].includes(f) || !v || v.after === undefined) return;
      if (!eq(BASE[id][f], v.before)) stale[id + '.' + f] = true;   // 원본이 그 사이에 바뀜
      o[f] = clone(v.after);
    });
  });
  const baseOf = (id, f) => (store.fields[id] && store.fields[id][f]) ? store.fields[id][f].before : BASE[id][f];
  function changes() {
    const out = [];
    Object.keys(BASE).forEach(id => {
      const o = objOf(id);
      EDITABLE[kindOf(id)].forEach(f => {
        if (BASE[id][f] === undefined && o[f] === undefined) return;
        const before = baseOf(id, f), after = o[f];
        if (!eq(before, after)) out.push({ id, kind: kindOf(id), field: f, label: o.title || o.name, before: clone(before === undefined ? (LISTS.includes(f) ? [] : '') : before), after: clone(after === undefined ? (LISTS.includes(f) ? [] : '') : after) });
      });
    });
    return out;
  }
  function persist() {
    const fs = {};
    changes().forEach(c => { (fs[c.id] = fs[c.id] || {})[c.field] = { before: c.before, after: c.after }; });
    store = { baseUpdated: store.baseUpdated || W.updated, fields: fs };
    try { if (Object.keys(fs).length) localStorage.setItem(KEY, JSON.stringify(store)); else localStorage.removeItem(KEY); } catch (e) {}
  }
  function setField(id, f, v) { const o = objOf(id); if (!o) return; o[f] = v; persist(); }
  function revert(id) {
    changes().filter(c => !id || c.id === id).forEach(c => { objOf(c.id)[c.field] = clone(BASE[c.id][c.field] === undefined ? (LISTS.includes(c.field) ? [] : '') : BASE[c.id][c.field]); });
    store = { baseUpdated: W.updated, fields: {} }; persist();
  }
  const isChanged = id => changes().some(c => c.id === id);
  const isStale = id => Object.keys(stale).some(k => k.startsWith(id + '.'));
  function exportObj() {
    return { format: 'world-edits', version: 1, createdAt: new Date().toISOString(), baseUpdated: store.baseUpdated || W.updated,
      changes: changes().map(({ id, kind, field, label, before, after }) => ({ id, kind, field, label, before, after })) };
  }
  const statusOf = x => STATUS[x.status] || STATUS.draft;
  const searchText = x => (x.title ? [x.title, ...x.core, ...x.add, ...(x.ask || [])] : [x.name, tById[x.type].name, ...(x.core || []), ...(x.add || []), ...(x.ask || []), ...(x.rules || []), ...(x.story || [])]).join(' ').toLowerCase();
  return { SECTIONS, secById, secOfGroup, secOfType, EDITABLE, LISTS, objOf, kindOf, clone, eq, changes, persist, setField, revert, isChanged, isStale, exportObj, W, esc, md, GROUPS, TYPES, ENTRIES, ALL, byId, eById, tById, gById, STATUS, placeTypes, childrenOf, ancestors, title, isPlace, pathSel, noteBlocks, entryBlocks, statusOf, searchText };
})();
