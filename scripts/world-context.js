// 이야기를 쓸 때 쓰는 맥락 뽑기: node scripts/world-context.js <사전 항목 id>
// 그 항목과, 위 계층(제국 > 국가 > 도시 > 마을)에서 물려받는 핵심·규칙을 한꺼번에 보여 준다.
global.window = {};
require('../world/data.js');
const W = window.WORLD, by = Object.fromEntries((W.entries || []).map(e => [e.id, e]));
const tn = Object.fromEntries((W.types || []).map(t => [t.id, t.name]));
const id = process.argv[2];
if (!id || !by[id]) { console.error('사용법: node scripts/world-context.js <id>\n항목: ' + Object.keys(by).join(', ')); process.exit(1); }
const chain = []; for (let c = by[id]; c; c = by[c.parent]) chain.unshift(c);
console.log('경로: ' + chain.map(e => `${tn[e.type]} ${e.name}`).join(' > '));
chain.forEach(e => {
  console.log(`\n## ${tn[e.type]} ${e.name} (${e.id}) [${e.status}]`);
  (e.core || []).forEach(x => console.log('- 핵심: ' + x));
  (e.rules || []).forEach(x => console.log('- 규칙: ' + x));
  if (e === chain[chain.length - 1]) { (e.story || []).forEach(x => console.log('- 이야기 씨앗: ' + x)); (e.ask || []).forEach(x => console.log('- 미정: ' + x)); }
});
