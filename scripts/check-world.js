// 세계관 노트 데이터 검사: node scripts/check-world.js
// - 주제 노트(groups): id 중복 / 끊긴 연결 / 빈 핵심·첨언 / 잘못된 status
// - 사전(types, entries): id 중복 / 없는 종류 / 맞지 않는 상위 항목 / 순환 / 끊긴 연결 / 잘못된 status
// 이상이 있으면 종료 코드 1.
global.window = {};
require('../world/data.js');
const W = window.WORLD;
const ids = new Set(), errs = [];
const items = W.groups.flatMap(g => g.items.map(i => ({ ...i, group: g.name })));
items.forEach(i => { if (ids.has(i.id)) errs.push('중복 id: ' + i.id); ids.add(i.id); });

const types = W.types || [], entries = W.entries || [];
const typeById = {};
types.forEach(t => { if (typeById[t.id]) errs.push('중복 종류: ' + t.id); typeById[t.id] = t; });
types.forEach(t => (t.parents || []).forEach(p => { if (!typeById[p]) errs.push(`없는 상위 종류: ${t.id} → ${p}`); }));
const entById = {};
entries.forEach(e => {
  if (ids.has(e.id)) errs.push('중복 id: ' + e.id);
  ids.add(e.id); entById[e.id] = e;
});

items.forEach(i => {
  (i.link || []).forEach(l => { if (!ids.has(l)) errs.push(`끊긴 연결: ${i.id} → ${l}`); });
  if (!i.core || !i.core.length) errs.push('핵심이 비어 있음: ' + i.id);
  if (!i.add || !i.add.length) errs.push('첨언이 비어 있음: ' + i.id);
  if (!['seed', 'draft', 'ok'].includes(i.status)) errs.push(`status 오류: ${i.id} (${i.status})`);
});

entries.forEach(e => {
  const t = typeById[e.type];
  if (!t) { errs.push(`없는 종류: ${e.id} (${e.type})`); return; }
  if (!e.name) errs.push('이름이 비어 있음: ' + e.id);
  if (!['blank', 'seed', 'draft', 'ok'].includes(e.status)) errs.push(`status 오류: ${e.id} (${e.status})`);
  ['core', 'add', 'ask', 'rules', 'story'].forEach(k => { if (e[k] !== undefined && !Array.isArray(e[k])) errs.push(`${k} 는 배열이어야 함: ${e.id}`); });
  if (e.status !== 'blank' && !(e.core || []).length) errs.push(`blank 가 아닌데 핵심이 비어 있음: ${e.id}`);
  if ((e.rules || []).length && !(e.core || []).length) errs.push(`핵심 없이 규칙만 있음: ${e.id}`);
  (e.link || []).forEach(l => { if (!ids.has(l)) errs.push(`끊긴 연결: ${e.id} → ${l}`); });
  if (t.parents) {
    if (!e.parent) errs.push(`상위 항목이 필요함: ${e.id} (${t.name}는 ${t.parents.map(p => typeById[p].name).join('/')} 아래에 둔다)`);
    else if (!entById[e.parent]) errs.push(`없는 상위 항목: ${e.id} → ${e.parent}`);
    else if (!t.parents.includes(entById[e.parent].type)) errs.push(`상위 종류가 맞지 않음: ${e.id} (${t.name}) → ${e.parent} (${entById[e.parent].type})`);
  } else if (e.parent) errs.push(`이 종류는 상위 항목을 둘 수 없음: ${e.id}`);
});
entries.forEach(e => { // 순환
  const seen = new Set(); let c = e;
  while (c && c.parent) { if (seen.has(c.id)) { errs.push('순환: ' + e.id); break; } seen.add(c.id); c = entById[c.parent]; }
});

const asks = items.reduce((n, i) => n + (i.ask ? i.ask.length : 0), 0) + entries.reduce((n, e) => n + (e.ask ? e.ask.length : 0), 0);
console.log(`줄 ${items.length} · 그룹 ${W.groups.length} · 사전 ${entries.length}개(${types.length}종) · 열린 질문 ${asks} · 확정 ${items.concat(entries).filter(i => i.status === 'ok').length}`);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log('OK');
