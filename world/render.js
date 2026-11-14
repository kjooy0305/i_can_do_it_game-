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
  const STATUS = { seed: ['핵심만', ''], draft: ['첨언 있음', 'w'], ok: ['확정', 'k'], blank: ['이름만', ''] };
  const placeTypes = new Set(TYPES.flatMap(t => t.parents ? [t.id, ...t.parents] : []));
  const childrenOf = e => ENTRIES.filter(x => x.parent === e.id);
  const ancestors = e => { const r = []; for (let c = eById[e.parent]; c; c = eById[c.parent]) r.unshift(c); return r; };
  const title = id => byId[id] ? byId[id].title : eById[id] ? eById[id].name : null;
  const isPlace = e => placeTypes.has(e.type);

  // 경로: [{label, sel}]  (sel 은 location.hash 로 쓰는 값)
  function pathSel(sel) {
    const root = { label: '노트', sel: '' };
    if (!sel) return [root];
    if (sel === 'x=notes') return [root, { label: '주제 노트', sel: 'x=notes' }];
    if (sel === 'x=dict') return [root, { label: '사전', sel: 'x=dict' }];
    if (sel === 'x=places') return [root, { label: '사전', sel: 'x=dict' }, { label: '장소', sel: 'x=places' }];
    if (sel.startsWith('g=') && gById[sel.slice(2)]) return [root, { label: '주제 노트', sel: 'x=notes' }, { label: gById[sel.slice(2)].name, sel }];
    if (sel.startsWith('t=') && tById[sel.slice(2)]) return [root, { label: '사전', sel: 'x=dict' }, { label: tById[sel.slice(2)].name, sel }];
    if (byId[sel]) { const i = byId[sel]; return [root, { label: '주제 노트', sel: 'x=notes' }, { label: i.gname, sel: 'g=' + i.group }, { label: i.title, sel }]; }
    if (eById[sel]) {
      const e = eById[sel];
      const mid = isPlace(e) ? [{ label: '장소', sel: 'x=places' }, ...ancestors(e).map(a => ({ label: a.name, sel: a.id }))] : [{ label: tById[e.type].name, sel: 't=' + e.type }];
      return [root, { label: '사전', sel: 'x=dict' }, ...mid, { label: e.name, sel }];
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
  const statusOf = x => STATUS[x.status] || STATUS.draft;
  const searchText = x => (x.title ? [x.title, ...x.core, ...x.add, ...(x.ask || [])] : [x.name, tById[x.type].name, ...(x.core || []), ...(x.add || []), ...(x.ask || []), ...(x.rules || []), ...(x.story || [])]).join(' ').toLowerCase();
  return { W, esc, md, GROUPS, TYPES, ENTRIES, ALL, byId, eById, tById, gById, STATUS, placeTypes, childrenOf, ancestors, title, isPlace, pathSel, noteBlocks, entryBlocks, statusOf, searchText };
})();
