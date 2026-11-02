// 세계관 노트 데이터 검사: node scripts/check-world.js
// - id 중복 / 끊긴 연결 / 빈 핵심·첨언 / 잘못된 status 를 찾는다. 이상이 있으면 종료 코드 1.
global.window = {};
require('../world/data.js');
const W = window.WORLD;
const ids = new Set(), errs = [];
const items = W.groups.flatMap(g => g.items.map(i => ({ ...i, group: g.name })));
items.forEach(i => { if (ids.has(i.id)) errs.push('중복 id: ' + i.id); ids.add(i.id); });
items.forEach(i => {
  (i.link || []).forEach(l => { if (!ids.has(l)) errs.push(`끊긴 연결: ${i.id} → ${l}`); });
  if (!i.core || !i.core.length) errs.push('핵심이 비어 있음: ' + i.id);
  if (!i.add || !i.add.length) errs.push('첨언이 비어 있음: ' + i.id);
  if (!['seed', 'draft', 'ok'].includes(i.status)) errs.push(`status 오류: ${i.id} (${i.status})`);
});
const asks = items.reduce((n, i) => n + (i.ask ? i.ask.length : 0), 0);
console.log(`줄 ${items.length} · 그룹 ${W.groups.length} · 열린 질문 ${asks} · 확정 ${items.filter(i => i.status === 'ok').length}`);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log('OK');
