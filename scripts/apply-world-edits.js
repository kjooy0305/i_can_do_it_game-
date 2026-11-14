#!/usr/bin/env node
// 사이트에서 내보낸 수정 파일(world-edits JSON)을 world/data.js 에 반영한다.
//   node scripts/apply-world-edits.js <파일> [--dry-run] [--prefer hold|mine|data] [--data 경로]
//
// 반영 방식: data.js 의 서식·주석은 그대로 두고, 바뀐 필드의 글만 교체한다 (필드 단위 텍스트 치환).
// 수정 파일의 before 는 "수정하던 때의 원본"이라, 그 뒤에 data.js 가 바뀌었어도 문장 단위로 합친다 (3-way).
//   --prefer hold (기본) 겹치는 것은 반영하지 않고 목록으로 알려 준다 (겹치지 않는 것은 반영)
//   --prefer mine        겹치면 수정 파일의 내용을 우선한다
//   --prefer data        겹치면 data.js 의 현재 내용을 우선한다 (겹친 수정은 버림)
const fs = require('fs'), path = require('path'), vm = require('vm');

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const file = args.find(a => !a.startsWith('--') && a !== opt('--prefer') && a !== opt('--data'));
if (!file) { console.error('사용법: node scripts/apply-world-edits.js <파일> [--dry-run] [--prefer hold|mine|data] [--data 경로]'); process.exit(2); }
const PREFER = opt('--prefer', 'hold');
if (!['hold', 'mine', 'data'].includes(PREFER)) { console.error('--prefer 는 hold | mine | data'); process.exit(2); }
const DATA = path.resolve(opt('--data', path.join(__dirname, '..', 'world', 'data.js')));
const DRY = flag('--dry-run');

// ---------- 입력 검사 ----------
let edits;
try { edits = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('파일을 읽을 수 없어요: ' + e.message); process.exit(2); }
if (edits.format !== 'world-edits' || !Array.isArray(edits.changes)) { console.error('world-edits 형식이 아니에요.'); process.exit(2); }
const LISTS = ['core', 'add', 'ask', 'rules', 'story'];
const NOTE_F = ['title', 'status', 'core', 'add', 'ask'], ENTRY_F = ['name', 'status', 'core', 'add', 'ask', 'rules', 'story'];
const STATUSES = ['blank', 'seed', 'draft', 'ok'];

let src = fs.readFileSync(DATA, 'utf8');
const sandbox = { window: {} }; vm.runInNewContext(src, sandbox);
const W = sandbox.window.WORLD;
const notes = Object.fromEntries(W.groups.flatMap(g => g.items.map(i => [i.id, i])));
const entries = Object.fromEntries((W.entries || []).map(e => [e.id, e]));

// ---------- 3-way 합치기 ----------
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function lcs(a, b) { // 같은 문장 쌍의 인덱스
  const n = a.length, m = b.length, t = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const pairs = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) i++; else j++; }
  return pairs;
}
// before→after 를 [{del:[...], ins:[...], anchor}] 묶음으로 만든다 (anchor = after 쪽에서 바로 앞에 있는 유지된 문장)
function groups(before, after) {
  const pairs = lcs(before, after), out = []; let bi = 0, ai = 0, anchor = null;
  const flush = (bEnd, aEnd) => { const del = before.slice(bi, bEnd), ins = after.slice(ai, aEnd); if (del.length || ins.length) out.push({ del, ins, anchor }); };
  for (const [i, j] of pairs) { flush(i, j); anchor = before[i]; bi = i + 1; ai = j + 1; }
  flush(before.length, after.length);
  return out;
}
function mergeList(cur, before, after) {
  const conflicts = []; let res = cur.slice();
  if (eq(cur, before)) return { value: after.slice(), conflicts }; // 원본이 그대로면 그냥 적용
  if (eq(cur, after)) return { value: cur, conflicts };            // 이미 반영됨
  if (eq([...before].sort(), [...after].sort())) {                  // 순서만 바뀐 수정 (원본이 그 사이에 바뀌었으므로 보류)
    if (PREFER === 'mine') return { value: after.filter(x => res.includes(x)).concat(res.filter(x => !after.includes(x))), conflicts };
    if (PREFER === 'hold') conflicts.push({ what: '순서 변경', detail: '원본이 그 사이에 바뀌어 순서 변경은 반영하지 않았어요' });
    return { value: res, conflicts };
  }
  for (const g of groups(before, after)) {
    const present = g.del.filter(x => res.includes(x)), missing = g.del.filter(x => !res.includes(x));
    if (missing.length) { // 지우거나 고치려던 문장이 현재 없다 = 그 사이에 바뀜
      const detail = '대상 문장이 바뀌었거나 이미 없어요: ' + missing.map(x => '“' + x.slice(0, 40) + '”').join(', ');
      if (PREFER === 'mine') { /* 수정 파일 우선: 새 문장을 그대로 넣는다 */ }
      else if (PREFER === 'data') continue;
      else { conflicts.push({ what: g.ins.length ? '문장 수정' : '문장 삭제', detail, ins: g.ins }); continue; }
    }
    // 지울 문장이 있던 자리(가장 앞 위치)를 기억하고 지운다 → 그 자리에 새 문장을 넣는다 (치환)
    const idxs = present.map(x => res.indexOf(x)).sort((x, y) => x - y);
    let pos = idxs.length ? idxs[0] : -1;
    idxs.slice().reverse().forEach(k => res.splice(k, 1));
    const ins = g.ins.filter(x => !res.includes(x));
    if (!ins.length) continue;
    if (pos < 0) { const a = g.anchor === null ? -1 : res.indexOf(g.anchor); pos = a >= 0 ? a + 1 : (g.anchor === null ? 0 : res.length); }
    res.splice(Math.min(pos, res.length), 0, ...ins);
  }
  return { value: res, conflicts };
}

// ---------- data.js 글 치환 (서식 보존) ----------
const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
function skipString(s, i) { // s[i] 가 따옴표일 때 닫는 따옴표 다음 위치
  const ch = s[i]; i++;
  while (i < s.length) { if (s[i] === '\\') { i += 2; continue; } if (s[i] === ch) return i + 1; i++; }
  return i;
}
function skipComment(s, i) {
  if (s[i] === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; return i; }
  if (s[i] === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); return e < 0 ? s.length : e + 2; }
  return i;
}
function matchClose(s, open) { // s[open] 가 { 또는 [ 일 때 짝이 되는 닫는 위치
  let d = 0;
  for (let i = open; i < s.length;) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(s, i); continue; }
    if (c === '/' && (s[i + 1] === '/' || s[i + 1] === '*')) { i = skipComment(s, i); continue; }
    if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') { d--; if (d === 0) return i; }
    i++;
  }
  return -1;
}
function objectSpan(s, id) {
  const re = new RegExp("\\{\\s*id:\\s*'" + id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + "'");
  const m = re.exec(s); if (!m) return null;
  const start = m.index, end = matchClose(s, start); return end < 0 ? null : { start, end };
}
function fieldSpan(obj, text, name) { // 객체 최상위의 name: 값 의 위치 (값의 [시작, 끝) )
  let i = 1, d = 0;
  while (i < text.length - 1) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(text, i); continue; }
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) { i = skipComment(text, i); continue; }
    if (c === '{' || c === '[') { d++; i++; continue; }
    if (c === '}' || c === ']') { d--; i++; continue; }
    if (d === 0 && text.startsWith(name + ':', i) && !/[\w$]/.test(text[i - 1] || ' ')) {
      let v = i + name.length + 1; while (/\s/.test(text[v])) v++;
      if (text[v] === '[') return [v, matchClose(text, v) + 1];
      if (text[v] === "'" || text[v] === '"') return [v, skipString(text, v)];
      return null;
    }
    i++;
  }
  return null;
}
function serialize(value, indent) {
  if (!Array.isArray(value)) return q(value);
  if (!value.length) return '[]';
  const one = '[' + value.map(q).join(', ') + ']';
  if (one.length <= 110) return one;
  const pad = ' '.repeat(indent + 2);
  return '[\n' + value.map(x => pad + q(x)).join(',\n') + ']';
}
function setField(id, name, value) {
  const span = objectSpan(src, id); if (!span) return false;
  const text = src.slice(span.start, span.end + 1), f = fieldSpan(null, text, name); if (!f) return false;
  const lineStart = src.lastIndexOf('\n', span.start + f[0]) + 1;
  const indent = (/^ */.exec(src.slice(lineStart))[0]).length;
  src = src.slice(0, span.start + f[0]) + serialize(value, indent) + src.slice(span.start + f[1]);
  return true;
}

// ---------- 적용 ----------
const applied = [], held = [], skipped = [];
for (const c of edits.changes) {
  const kind = notes[c.id] ? 'note' : entries[c.id] ? 'entry' : null;
  const label = c.label || c.id;
  if (!kind) { held.push({ id: c.id, label, field: c.field, what: '항목 없음', detail: '이 항목이 data.js 에 없어요 (지워졌거나 id가 바뀜)' }); continue; }
  if (!(kind === 'note' ? NOTE_F : ENTRY_F).includes(c.field)) { skipped.push(`${label}.${c.field} (편집할 수 없는 필드)`); continue; }
  const obj = kind === 'note' ? notes[c.id] : entries[c.id], cur = obj[c.field];
  const isList = LISTS.includes(c.field);
  if (isList ? !(Array.isArray(c.before) && Array.isArray(c.after)) : !(typeof c.after === 'string')) { skipped.push(`${label}.${c.field} (값 형식 오류)`); continue; }
  if (c.field === 'status' && !STATUSES.includes(c.after)) { skipped.push(`${label}.status (알 수 없는 상태 ${c.after})`); continue; }
  let next, conflicts = [];
  if (isList) { const r = mergeList(Array.isArray(cur) ? cur : [], c.before, c.after); next = r.value; conflicts = r.conflicts; }
  else if (eq(cur, c.before) || eq(cur, c.after)) next = c.after;
  else if (PREFER === 'mine') next = c.after;
  else if (PREFER === 'data') next = cur;
  else { next = cur; conflicts = [{ what: '값이 겹침', detail: `현재 “${String(cur).slice(0, 30)}” / 수정 “${String(c.after).slice(0, 30)}”` }]; }
  conflicts.forEach(x => held.push({ id: c.id, label, field: c.field, ...x }));
  if (eq(next, cur)) { if (!conflicts.length) skipped.push(`${label}.${c.field} (이미 반영됨)`); continue; }
  if (DRY) { applied.push({ id: c.id, label, field: c.field }); continue; }
  if (setField(c.id, c.field, next)) { applied.push({ id: c.id, label, field: c.field }); obj[c.field] = next; }
  else held.push({ id: c.id, label, field: c.field, what: '쓰기 실패', detail: 'data.js 에서 이 필드를 찾지 못했어요 (필드가 없거나 서식이 달라요)' });
}
const FL = { core: '핵심', add: '첨언', ask: '열린 질문', rules: '규칙', story: '이야기 씨앗', title: '제목', name: '이름', status: '상태' };
console.log(`${DRY ? '[미리보기] ' : ''}수정 파일: ${edits.changes.length}개 묶음 (기준 ${edits.baseUpdated || '?'}) · 방식 ${PREFER}`);
console.log(`반영${DRY ? ' 예정' : ''} ${applied.length}개`);
applied.forEach(a => console.log(`  ✓ ${a.label} · ${FL[a.field] || a.field}`));
if (skipped.length) { console.log(`건너뜀 ${skipped.length}개`); skipped.forEach(s => console.log('  - ' + s)); }
if (held.length) { console.log(`보류(겹침·오류) ${held.length}개`); held.forEach(h => console.log(`  ! ${h.label} · ${FL[h.field] || h.field} — ${h.what}: ${h.detail}${h.ins && h.ins.length ? ' / 수정 내용: ' + h.ins.map(x => '“' + x.slice(0, 40) + '”').join(', ') : ''}`)); }
if (DRY || !applied.length) process.exit(held.length ? 3 : 0);

// 마지막 정리 날짜 갱신 + 저장
const d = new Date(), pad = n => String(n).padStart(2, '0'), today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
src = src.replace(/(\bupdated:\s*)'[^']*'/, `$1'${today}'`);
fs.writeFileSync(DATA, src);
// 반영 기록
const log = path.join(path.dirname(DATA), '..', 'docs', 'edit-log.md');
try {
  if (!fs.existsSync(log)) fs.writeFileSync(log, '# 사이트 편집 반영 기록\n\n| 날짜 | 파일 | 반영 | 보류 | 방식 |\n|---|---|---|---|---|\n');
  fs.appendFileSync(log, `| ${today} | ${path.basename(file)} | ${applied.length} | ${held.length} | ${PREFER} |\n`);
} catch (e) {}
// edits/ 폴더에서 받은 파일은 처리 후 edits/applied/ 로 옮긴다 (보류가 없을 때)
const editsDir = path.resolve(path.dirname(DATA), '..', 'edits');
if (!held.length && path.dirname(path.resolve(file)) === editsDir) {
  fs.mkdirSync(path.join(editsDir, 'applied'), { recursive: true });
  fs.renameSync(path.resolve(file), path.join(editsDir, 'applied', path.basename(file)));
  console.log('처리한 파일을 edits/applied/ 로 옮겼어요.');
}
console.log('data.js 를 저장했어요. 이어서: node scripts/check-world.js');
process.exit(held.length ? 3 : 0);
