// 세계관 노트 공용 그리기 (index.html 과 page.html 이 같이 쓴다)
window.WN = (function () {
  const W = window.WORLD;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  const li = a => (a || []).map(c => `<li>${md(c)}</li>`).join('');
  const GROUPS = W.groups || [], TYPES = W.types || [], ENTRIES = W.entries || [];
  const ALL = GROUPS.flatMap(g => g.items.map(i => { i.group = g.id; i.gname = g.name; return i; }));
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
  // 원본(data.js) 값은 BASE 에 보관하고, 사이트에서 고친 값은 브라우저(localStorage)에 저장한다.
  //  - 글 수정: {before, after} 필드 단위 (before 는 "수정하던 때의 원본"이라 나중에 data.js 가 바뀌어도 3-way 로 합칠 수 있다)
  //  - 새 줄 / 새 사전 항목: added (항목 전체)      - 삭제: removed (지우기 전 원본 전체)
  const EDITABLE = { note: ['title', 'status', 'core', 'add', 'ask'], entry: ['name', 'status', 'core', 'add', 'ask', 'rules', 'story'] };
  const LISTS = ['core', 'add', 'ask', 'rules', 'story'];
  const objOf = id => byId[id] || eById[id];
  const kindOf = id => byId[id] ? 'note' : eById[id] ? 'entry' : null;
  const clone = v => JSON.parse(JSON.stringify(v));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const empty = f => LISTS.includes(f) ? [] : '';
  const BASE = {};
  [...ALL, ...ENTRIES].forEach(x => { const k = kindOf(x.id); BASE[x.id] = {}; EDITABLE[k].forEach(f => { if (x[f] !== undefined) BASE[x.id][f] = clone(x[f]); }); });
  const KEY = 'world.edits.v1';
  let store = { baseUpdated: W.updated, fields: {}, added: [], removed: [] };
  try { const t = JSON.parse(localStorage.getItem(KEY) || 'null'); if (t && t.fields) store = { baseUpdated: t.baseUpdated, fields: t.fields, added: t.added || [], removed: t.removed || [] }; } catch (e) {}
  const ADDED = [], REMOVED = [];       // 런타임 기록
  const snap = (x, useBase) => {          // 항목의 편집 가능한 값 + 위치 정보 (useBase: 원본 값으로)
    const k = x.title !== undefined ? 'note' : 'entry', o = {};
    EDITABLE[k].forEach(f => { const v = useBase && BASE[x.id] ? BASE[x.id][f] : x[f]; if (v !== undefined) o[f] = clone(v); });
    o.link = clone(x.link || []);
    if (k === 'entry') { o.type = x.type; if (x.parent) o.parent = x.parent; } else o.group = x.group;
    return o;
  };
  function insertNote(groupId, o) { const g = gById[groupId]; if (!g) return null; o.group = g.id; o.gname = g.name; g.items.push(o); ALL.push(o); byId[o.id] = o; return o; }
  function insertEntry(o) { ENTRIES.push(o); eById[o.id] = o; return o; }
  function detach(id) {
    if (byId[id]) { const o = byId[id], g = gById[o.group]; if (g) g.items.splice(g.items.indexOf(o), 1); ALL.splice(ALL.indexOf(o), 1); delete byId[id]; return o; }
    if (eById[id]) { const o = eById[id]; ENTRIES.splice(ENTRIES.indexOf(o), 1); delete eById[id]; return o; }
    return null;
  }
  const stale = {};
  Object.entries(store.fields).forEach(([id, fs]) => {
    const o = objOf(id); if (!o) return;
    Object.entries(fs).forEach(([f, v]) => {
      if (!EDITABLE[kindOf(id)].includes(f) || !v || v.after === undefined) return;
      if (!eq(BASE[id][f], v.before)) stale[id + '.' + f] = true;   // 원본이 그 사이에 바뀜
      o[f] = clone(v.after);
    });
  });
  store.removed.forEach(r => { if (!objOf(r.id)) return; detach(r.id); REMOVED.push({ kind: r.kind, id: r.id, label: r.label, before: r.before }); });
  store.added.forEach(a => {
    if (objOf(a.id) || !a.obj) return;
    const o = clone(a.obj); o.id = a.id;
    if (a.kind === 'note') { if (!insertNote(a.group, o)) return; } else insertEntry(o);
    ADDED.push({ kind: a.kind, id: a.id, group: a.group, type: a.type, parent: a.parent });
  });
  const isAdded = id => ADDED.some(a => a.id === id);
  const baseOf = (id, f) => (store.fields[id] && store.fields[id][f]) ? store.fields[id][f].before : BASE[id][f];
  const lab = o => o.title || o.name;
  function changes() {
    const out = [];
    ADDED.forEach(a => { const o = objOf(a.id); if (o) out.push({ op: 'add', kind: a.kind, id: a.id, label: lab(o), group: a.group, type: a.type, parent: a.parent, after: snap(o) }); });
    REMOVED.forEach(r => out.push({ op: 'remove', kind: r.kind, id: r.id, label: r.label, before: r.before }));
    Object.keys(BASE).forEach(id => {
      const o = objOf(id); if (!o) return;                 // 삭제된 항목
      EDITABLE[kindOf(id)].forEach(f => {
        if (BASE[id][f] === undefined && o[f] === undefined) return;
        const before = baseOf(id, f), after = o[f];
        if (!eq(before, after)) out.push({ op: 'set', id, kind: kindOf(id), field: f, label: lab(o), before: clone(before === undefined ? empty(f) : before), after: clone(after === undefined ? empty(f) : after) });
      });
    });
    return out;
  }
  function persist() {
    const fs = {};
    changes().filter(c => c.op === 'set').forEach(c => { (fs[c.id] = fs[c.id] || {})[c.field] = { before: c.before, after: c.after }; });
    store = { baseUpdated: store.baseUpdated || W.updated, fields: fs,
      added: ADDED.filter(a => objOf(a.id)).map(a => ({ ...a, obj: snap(objOf(a.id)) })), removed: REMOVED.slice() };
    try { if (Object.keys(fs).length || store.added.length || store.removed.length) localStorage.setItem(KEY, JSON.stringify(store)); else localStorage.removeItem(KEY); } catch (e) {}
  }
  function setField(id, f, v) { const o = objOf(id); if (!o) return; o[f] = v; persist(); }
  const newId = p => { let id; do { id = p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); } while (objOf(id)); return id; };
  function createNote(groupId) {
    const id = newId('n'), o = { id, title: '새 줄', status: 'seed', core: [''], add: [''], ask: [], link: [] };
    if (!insertNote(groupId, o)) return null; ADDED.push({ kind: 'note', id, group: groupId }); persist(); return id;
  }
  // 새 사전 항목: 종류가 상위 항목을 요구하면(장소 계층) parentId 가 그 종류에 맞아야 한다
  function allowedParents(typeId) { const t = tById[typeId]; return t && t.parents ? ENTRIES.filter(e => t.parents.includes(e.type)) : []; }
  function createEntry(typeId, parentId) {
    const t = tById[typeId]; if (!t) return null;
    if (t.parents && !(parentId && eById[parentId] && t.parents.includes(eById[parentId].type))) return null;
    if (!t.parents) parentId = undefined;
    const id = newId('e'), o = { id, type: typeId, name: '새 항목', status: 'blank', core: [], add: [''], ask: [], rules: [], story: [], link: [] };
    if (parentId) o.parent = parentId;
    insertEntry(o); ADDED.push({ kind: 'entry', id, type: typeId, parent: parentId }); persist(); return id;
  }
  // 삭제: 새로 만든 것은 그냥 지우고, 원본에 있던 것은 "삭제" 로 기록한다. 하위 항목이 있으면 막는다.
  function removeItem(id) {
    const o = objOf(id); if (!o) return { ok: false, reason: '항목이 없어요' };
    if (kindOf(id) === 'entry' && ENTRIES.some(e => e.parent === id)) return { ok: false, reason: '하위 항목(도시 · 마을 등)이 있어서 지울 수 없어요. 아래 항목부터 지워 주세요.' };
    if (isAdded(id)) { detach(id); ADDED.splice(ADDED.findIndex(a => a.id === id), 1); persist(); return { ok: true }; }
    const before = snap(o, true), kind = kindOf(id), label = lab(o);
    detach(id); REMOVED.push({ kind, id, label, before }); persist(); return { ok: true };
  }
  // 되돌리기: 글 수정은 바로 되돌리고, 추가·삭제가 섞여 있으면 저장을 비우고 다시 불러와야 한다 (reload 가 true)
  function revert(id) {
    if (id && !isAdded(id) && !REMOVED.some(r => r.id === id)) {
      changes().filter(c => c.op === 'set' && c.id === id).forEach(c => { objOf(c.id)[c.field] = clone(BASE[c.id][c.field] === undefined ? empty(c.field) : BASE[c.id][c.field]); });
      persist(); return { reload: false };
    }
    if (id && REMOVED.some(r => r.id === id)) { REMOVED.splice(REMOVED.findIndex(r => r.id === id), 1); persist(); return { reload: true }; }
    if (id) { removeItem(id); return { reload: false }; }
    store = { baseUpdated: W.updated, fields: {}, added: [], removed: [] };
    try { localStorage.removeItem(KEY); } catch (e) {}
    return { reload: true };
  }
  const isChanged = id => ADDED.some(a => a.id === id) || changes().some(c => c.id === id);
  const isStale = id => Object.keys(stale).some(k => k.startsWith(id + '.'));
  const trim = a => Array.isArray(a) ? a.map(x => String(x).trim()).filter(Boolean) : a;
  function exportObj() {
    const norm = o => { const r = clone(o); LISTS.forEach(f => { if (r[f]) r[f] = trim(r[f]); }); return r; };
    return { format: 'world-edits', version: 2, createdAt: new Date().toISOString(), baseUpdated: store.baseUpdated || W.updated,
      changes: changes().map(c => {
        if (c.op === 'add') return { ...c, after: norm(c.after) };
        if (c.op === 'remove') return c;
        return { op: 'set', id: c.id, kind: c.kind, field: c.field, label: c.label, before: c.before, after: LISTS.includes(c.field) ? trim(c.after) : c.after };
      }).filter(c => c.op !== 'set' || !eq(c.before, c.after)) };
  }
  // 텔레그램처럼 한 번에 보낼 수 있는 길이가 짧은 곳에 쓰는 나눠 보내기 형식:  #WE 1/3 ⏎ 조각
  function parts(obj, size) {
    const json = JSON.stringify(obj), lim = size || 3200, out = []; let i = 0;
    while (i < json.length) {            // 조각의 앞뒤가 공백이 되지 않게 자른다 (붙여넣을 때 공백이 사라져도 안전)
      let j = Math.min(json.length, i + lim);
      while (j < json.length && (/\s/.test(json[j]) || /\s/.test(json[j - 1]))) j++;
      out.push(json.slice(i, j)); i = j;
    }
    return out.map((p, k) => `#WE ${k + 1}/${out.length}\n${p}`);
  }
  const statusOf = x => STATUS[x.status] || STATUS.draft;
  const searchText = x => (x.title ? [x.title, ...x.core, ...x.add, ...(x.ask || [])] : [x.name, tById[x.type].name, ...(x.core || []), ...(x.add || []), ...(x.ask || []), ...(x.rules || []), ...(x.story || [])]).join(' ').toLowerCase();
  return { SECTIONS, secById, secOfGroup, secOfType, EDITABLE, LISTS, objOf, kindOf, clone, eq, changes, persist, setField, revert, isChanged, isStale, exportObj, parts, createNote, createEntry, removeItem, allowedParents, isAdded, W, esc, md, GROUPS, TYPES, ENTRIES, ALL, byId, eById, tById, gById, STATUS, placeTypes, childrenOf, ancestors, title, isPlace, pathSel, noteBlocks, entryBlocks, statusOf, searchText };
})();
