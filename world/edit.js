// 세계관 노트 편집 + 내보내기 (index.html, page.html 공용). render.js(WN) 다음에 불러온다.
window.WEdit = (function () {
  const LABEL = { core: '핵심', add: '첨언', ask: '열린 질문', rules: '규칙', story: '이야기 씨앗' };
  const ORDER = { note: ['core', 'add', 'ask'], entry: ['core', 'rules', 'add', 'story', 'ask'] };
  let on = false, onRefresh = () => {};
  const hooks = { deleted: () => onRefresh() };   // 페이지마다 삭제 뒤 이동을 정한다
  try { on = sessionStorage.getItem('world.editmode') === '1'; } catch (e) {}
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt !== undefined) e.textContent = txt; return e; };
  const btn = (txt, fn, title) => { const b = el('button', 'eb', txt); b.type = 'button'; b.onclick = fn; if (title) { b.title = title; b.setAttribute('aria-label', title); } return b; };
  const grow = t => { t.style.height = 'auto'; t.style.height = Math.max(40, t.scrollHeight + 2) + 'px'; };

  function editorFor(x) {
    const id = x.id, kind = WN.kindOf(id), box = el('div', 'editor');
    const nameKey = kind === 'note' ? 'title' : 'name';
    const head = el('div', 'erow');
    const inp = el('input', 'etext'); inp.value = x[nameKey] || ''; inp.setAttribute('aria-label', kind === 'note' ? '제목' : '이름');
    inp.oninput = () => { WN.setField(id, nameKey, inp.value); refresh(); };
    const sel = el('select', 'esel'); sel.setAttribute('aria-label', '상태');
    (kind === 'entry' ? ['blank', 'seed', 'draft', 'ok'] : ['seed', 'draft', 'ok']).forEach(k => { const o = el('option', '', WN.STATUS[k][0]); o.value = k; if (x.status === k) o.selected = true; sel.append(o); });
    sel.onchange = () => { WN.setField(id, 'status', sel.value); refresh(); };
    head.append(inp, sel); box.append(head);

    ORDER[kind].forEach(f => {
      const arr = (x[f] || []).slice(), sec = el('div', 'esec');
      const h = el('div', 'eh'); h.append(el('span', 'tag' + (f === 'core' ? ' k' : f === 'add' ? ' w' : ''), LABEL[f]));
      sec.append(h);
      const set = (next, focusIdx) => { WN.setField(id, f, next); refresh(); redo(focusIdx); };
      const redo = focusIdx => { const n = editorFor(WN.objOf(id)); box.replaceWith(n); if (focusIdx !== undefined) { const t = n.querySelectorAll('.esec')[ORDER[kind].indexOf(f)].querySelectorAll('textarea')[focusIdx]; if (t) t.focus(); } };
      arr.forEach((txt, i) => {
        const row = el('div', 'ebl'), ta = el('textarea', 'etext'); ta.value = txt; ta.rows = 1; ta.setAttribute('aria-label', LABEL[f] + ' ' + (i + 1));
        ta.oninput = () => { grow(ta); const cur = (WN.objOf(id)[f] || []).slice(); cur[i] = ta.value; WN.setField(id, f, cur); refresh(); };
        const bs = el('div', 'ebs');
        if (f === 'add') bs.append(btn('핵심↑', () => { const cur = WN.objOf(id); const a2 = (cur.add || []).slice(); const [m] = a2.splice(i, 1); WN.setField(id, 'add', a2); WN.setField(id, 'core', [...(cur.core || []), m]); refresh(); redoAll(); }, '핵심으로 올리기'));
        if (i > 0) bs.append(btn('↑', () => { const c = arr.slice(); [c[i - 1], c[i]] = [c[i], c[i - 1]]; set(c); }, '위로'));
        if (i < arr.length - 1) bs.append(btn('↓', () => { const c = arr.slice(); [c[i + 1], c[i]] = [c[i], c[i + 1]]; set(c); }, '아래로'));
        bs.append(btn('✕', () => { const c = arr.slice(); c.splice(i, 1); set(c); }, '이 문장 지우기'));
        row.append(ta, bs); sec.append(row); setTimeout(() => grow(ta), 0);
      });
      sec.append(btn('＋ ' + LABEL[f] + ' 추가', () => set([...arr, ''], arr.length), LABEL[f] + ' 추가'));
      box.append(sec);
    });
    const foot = el('div', 'erow');
    if (WN.isAdded(id)) foot.append(el('span', 'tag k', '새로 만든 항목'));
    if (WN.isStale(id)) foot.append(el('span', 'tag w', '원본이 바뀌었어요 · 내보낼 때 합쳐져요'));
    foot.append(btn('이 항목 수정 되돌리기', () => { const r = WN.revert(id); refresh(); if (r.reload) location.reload(); else onRefresh(); }, '이 항목 되돌리기'));
    foot.append(btn(WN.isAdded(id) ? '이 새 항목 지우기' : '이 항목 삭제', () => {
      const p = WN.pathSel(id), back = p.length > 1 ? p[p.length - 2].sel : '';
      if (!confirm(WN.isAdded(id) ? '새로 만든 항목을 지울까요?' : '이 항목을 삭제할까요? (내보내기 파일에 "삭제"로 담겨요. 내보내기 창에서 삭제를 취소할 수 있어요)')) return;
      const r = WN.removeItem(id); if (!r.ok) { alert(r.reason); return; }
      refresh(); hooks.deleted(back);
    }, '이 항목 삭제'));
    box.append(foot);
    function redoAll() { onRefresh(); }
    return box;
  }

  // ----- 상단 막대 + 내보내기 창 -----
  let bar, panel;
  function refresh() {
    const n = WN.changes(), ids = new Set(n.map(c => c.id));
    if (!bar) return;
    bar.hidden = !on && !n.length;
    bar.querySelector('.cnt').textContent = n.length ? `수정 ${ids.size}곳 · 묶음 ${n.length}개` + (n.some(c => c.op === 'add') ? ` · 새 항목 ${n.filter(c => c.op === 'add').length}` : '') + (n.some(c => c.op === 'remove') ? ` · 삭제 ${n.filter(c => c.op === 'remove').length}` : '') : '아직 수정한 곳이 없어요';
    bar.querySelector('.exp').disabled = !n.length; bar.querySelector('.rev').disabled = !n.length;
  }
  const ts = () => { const d = new Date(), p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
  function diffHTML(c) {
    const e = WN.esc;
    if (!Array.isArray(c.before)) return `<del>${e(c.before)}</del> → <ins>${e(c.after)}</ins>`;
    const del = c.before.filter(x => !c.after.includes(x)), ins = c.after.filter(x => !c.before.includes(x));
    const moved = !del.length && !ins.length;
    return moved ? '<span>순서만 바뀜</span>' : del.map(x => `<div><del>${e(x)}</del></div>`).join('') + ins.map(x => `<div><ins>${e(x)}</ins></div>`).join('');
  }
  function openPanel() {
    const obj = WN.exportObj(), json = JSON.stringify(obj, null, 2);
    panel.innerHTML = '';
    const box = el('div', 'pbox'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '변경 내용 내보내기');
    box.append(el('h2', '', '변경 내용 내보내기'), el('p', 'note', `바뀐 부분만 담았어요. 항목 ${new Set(obj.changes.map(c => c.id)).size}곳 · ${obj.changes.length}개 묶음 · ${json.length.toLocaleString()}자`));
    const list = el('div', 'plist');
    const FL = { core: '핵심', add: '첨언', ask: '열린 질문', rules: '규칙', story: '이야기 씨앗', title: '제목', name: '이름', status: '상태' };
    obj.changes.forEach(c => {
      const r = el('div', 'pitem');
      if (c.op === 'add') {
        const a = c.after, cnt = ['core', 'add', 'ask', 'rules', 'story'].filter(f => (a[f] || []).length).map(f => FL[f] + ' ' + a[f].length).join(' · ');
        r.innerHTML = `<b>${WN.esc(c.label || c.id)}</b> <span class="tag k">새 ${c.kind === 'note' ? '줄' : '사전 항목'}</span><div class="pd"><div><ins>${WN.esc(c.kind === 'note' ? '분류 ' + (WN.gById[c.group] ? WN.gById[c.group].name : c.group) : '종류 ' + (WN.tById[c.type] ? WN.tById[c.type].name : c.type) + (c.parent ? ' · 상위 ' + WN.esc(WN.title(c.parent) || c.parent) : ''))}</ins></div><div>${WN.esc(cnt || '(내용 없음)')}</div></div>`;
      } else if (c.op === 'remove') {
        r.innerHTML = `<b>${WN.esc(c.label || c.id)}</b> <span class="tag w">삭제</span>`;
        r.append(btn('삭제 취소', () => { WN.revert(c.id); location.reload(); }));
      } else {
        r.innerHTML = `<b>${WN.esc(c.label || c.id)}</b> <span class="tag">${WN.esc(FL[c.field] || c.field)}</span><div class="pd">${diffHTML(c)}</div>`;
      }
      list.append(r);
    });
    box.append(list);
    const msg = el('span', 'note', ''), partsBox = el('div', 'bar');
    const row = el('div', 'bar');
    row.append(btn('JSON 복사', async () => { try { await navigator.clipboard.writeText(json); msg.textContent = '복사했어요.'; } catch (e) { const t = el('textarea'); t.value = json; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); msg.textContent = '복사했어요.'; } }));
    row.append(btn('파일로 저장', () => { const a = el('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = `world-edits-${ts()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); msg.textContent = '파일을 저장했어요. 저에게 전달해 주세요.'; }));
    row.append(btn('텔레그램용 나눠 복사', () => {
      const ps = WN.parts(obj, 3200); partsBox.innerHTML = '';
      partsBox.append(el('p', 'note', `텔레그램은 한 번에 약 4,000자까지라 ${ps.length}조각으로 나눴어요. 1번부터 차례로 복사해서 보내 주세요 (조각은 각각 #WE 번호/전체 로 시작해요).`));
      ps.forEach((p, i) => { const b = btn(`${i + 1}/${ps.length} 복사 (${p.length.toLocaleString()}자)`, async () => { try { await navigator.clipboard.writeText(p); } catch (e) { const t = el('textarea'); t.value = p; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); } msg.textContent = `${i + 1}/${ps.length} 조각을 복사했어요.`; }); partsBox.append(b); });
    }));
    row.append(btn('닫기', () => { panel.hidden = true; }), msg);
    box.append(row, partsBox); panel.append(box); panel.hidden = false;
  }
  function mount(host, refreshCb) {
    onRefresh = refreshCb || (() => {});
    bar = el('div', 'ebar'); bar.hidden = true;
    bar.append(el('b', '', '✎ 편집'), el('span', 'cnt', ''));
    const ex = btn('변경 내용 내보내기', openPanel); ex.classList.add('exp');
    const rv = btn('전체 되돌리기', () => { if (confirm('모든 수정을 되돌릴까요? (이 브라우저에 저장된 수정, 새 항목, 삭제가 모두 지워져요)')) { WN.revert(); location.reload(); } }); rv.classList.add('rev');
    bar.append(ex, rv);
    panel = el('div', 'panel'); panel.hidden = true; panel.onclick = e => { if (e.target === panel) panel.hidden = true; };
    host.prepend(bar); document.body.append(panel); refresh();
    window.addEventListener('keydown', e => { if (e.key === 'Escape') panel.hidden = true; });
  }
  return { hooks, mount, refresh, editorFor, isOn: () => on, set: v => { on = v; try { sessionStorage.setItem('world.editmode', v ? '1' : '0'); } catch (e) {} refresh(); }, openPanel };
})();
