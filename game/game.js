// 끝에 도달하는 이야기 · 플레이 틀. 지금은 홈 화면과 버튼 반응만 있다.
// 화면은 SCREENS 에 하나씩 덧붙인다. 저장은 localStorage 의 'ceg.' 키를 쓴다 (앱으로 감쌀 때 저장소만 바꾸면 된다).
(function () {
  const app = document.getElementById('app');
  const mem = {}; // 저장소를 못 쓰는 환경(비공개 창 등)에서는 이번 방문 동안만 기억한다
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ceg.' + k); if (v != null) return JSON.parse(v); } catch (e) {} return k in mem ? mem[k] : d; },
    set(k, v) { mem[k] = v; try { localStorage.setItem('ceg.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const MENU = [ // 홈 메뉴 순서는 세계관 노트의 정한 순서 그대로
    { id: 'start', title: '게임 시작', sub: () => '0세부터 한 달씩, 태어나는 것에서 시작', first: true },
    { id: 'load', title: '이어서 하기', sub: () => { const n = (store.get('saves', []) || []).length; return n ? '저장 ' + n + '개' : '저장된 게임 없음'; } },
    { id: 'dict', title: '사전', sub: () => '발견 0 / 120 · 몬스터 · 장비 · 변이' },
    { id: 'ach', title: '업적', sub: () => '달성 0 / 48' },
    { id: 'set', title: '설정', sub: () => '저장 · 전투 · 화면 · 소리' }
  ];
  const NAMES = { start: '게임 시작', load: '이어서 하기', dict: '사전', ach: '업적', set: '설정', play: '게임 플레이' };
  const LEVELS = [ // 난이도는 미니게임과 일부 선택지의 보정에 쓸 예정 (아직 효과 없음)
    { id: 'hero', name: '영웅', sub: '어려움', desc: '당신은 영웅의 싹입니다. 그런 당신에게 가호가 깃들기를.' },
    { id: 'daily', name: '일상', sub: '보통', desc: '이곳을 느끼기에 좋습니다. 어쩌면 당신 또한 영웅이 될 수 있겠죠.' },
    { id: 'watch', name: '방관', sub: '쉬움', desc: '당신은 변덕쟁이입니다. 원하는건 취하고 필요 없는 건 무시하는.' }
  ];
  const SEED_RE = /^[A-Z0-9-]{1,16}$/;
  const newSeed = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = n => Array.from({ length: n }, () => c[Math.floor(Math.random() * c.length)]).join(''); return r(2) + '-' + r(4); };
  const NOTES = {
    start: '태어나기 화면이 들어올 자리예요.', load: '저장된 게임이 없어요. 게임 시작 뒤에 여기서 이어 할 수 있어요.',
    dict: '발견한 몬스터 · 장비 · 변이 · 지역 · 특성이 쌓이는 곳이에요.', ach: '달성한 업적이 쌓이는 곳이에요.', set: '저장 · 전투 시간 · 화면 · 소리 설정이 들어올 자리예요.'
  };
  let sel = 0, toastTimer = null;

  function toast(msg) {
    let t = document.querySelector('.toast'); if (t) t.remove();
    t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.append(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 1800);
  }
  const SCREENS = {
    home() {
      app.innerHTML = `<section class="home" aria-label="홈">
        <div class="steps" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i>끝</i></div>
        <h1>끝에 도달하는 이야기</h1>
        <p class="lead">80억 분의 1, 단 하나의 선택으로 이어지는 길.</p>
        <nav class="menu" aria-label="메뉴">${MENU.map((m, i) => `<button class="menu-btn${m.first ? ' first' : ''}${i === sel ? ' sel' : ''}" data-i="${i}" data-id="${m.id}"><span><b>${m.title}</b><small>${m.sub()}</small></span><span style="display:flex;gap:10px;align-items:center"><span class="key" aria-hidden="true">${i + 1}</span><span class="go" aria-hidden="true">→</span></span></button>`).join('')}</nav>
        <div class="foot"><span>↑ ↓ 로 고르고 Enter · 숫자 1~5</span><span>v0.1</span></div>
      </section>`;
      app.querySelectorAll('.menu-btn').forEach(b => {
        b.addEventListener('click', () => open(b.dataset.id));
        b.addEventListener('mouseenter', () => mark(+b.dataset.i, false));
        b.addEventListener('focus', () => mark(+b.dataset.i, false));
      });
      focusSel();
    },
    start() {
      const last = store.get('start', {}) || {};
      let tab = 'basic', level = LEVELS.some(l => l.id === last.level) ? last.level : 'daily';
      app.innerHTML = `<section class="stub" aria-label="게임 시작">
        <div class="topbar"><button class="back" id="back">← 홈</button></div>
        <h2>게임 시작</h2>
        <div class="tabs" role="tablist" aria-label="모드">
          <button role="tab" id="tab-basic" aria-selected="true" aria-controls="p-basic">기본 모드</button>
          <button role="tab" id="tab-custom" aria-selected="false" aria-controls="p-custom" tabindex="-1">커스텀 모드</button>
        </div>
        <div id="p-basic" role="tabpanel" aria-labelledby="tab-basic" class="panel">
          <fieldset class="levels"><legend>난이도</legend>
            ${LEVELS.map(l => `<label class="lv"><input type="radio" name="level" value="${l.id}"${l.id === level ? ' checked' : ''}><span><span class="lt"><b>${l.name}</b><small>${l.sub}</small></span><em>${l.desc}</em></span></label>`).join('')}
          </fieldset>
          <div class="seedbox"><label for="seed">시드</label>
            <div class="seedrow"><input id="seed" type="text" maxlength="16" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="비워 두면 자동으로 정해져요" value="${(last.seed || '').replace(/"/g, '')}"><button type="button" class="back" id="rand">랜덤</button></div>
            <small id="seedhint">같은 시드는 같은 세계를 내놓아요. 영문 · 숫자 · - 만 쓸 수 있어요. 예: K7-3F9A</small>
          </div>
        </div>
        <div id="p-custom" role="tabpanel" aria-labelledby="tab-custom" class="panel" hidden><div class="box"><b>제작 중</b>커스텀 모드는 아직 만드는 중이에요.</div></div>
        <button class="play" id="play">게임 플레이 <span aria-hidden="true">→</span></button>
      </section>`;
      const $ = id => document.getElementById(id), seed = $('seed'), hint = $('seedhint');
      const setTab = t => { tab = t; ['basic', 'custom'].forEach(k => { const on = k === t; $('tab-' + k).setAttribute('aria-selected', on); $('tab-' + k).tabIndex = on ? 0 : -1; $('p-' + k).hidden = !on; }); $('play').hidden = t !== 'basic'; };
      ['basic', 'custom'].forEach(k => { $('tab-' + k).onclick = () => setTab(k); $('tab-' + k).onkeydown = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = k === 'basic' ? 'custom' : 'basic'; setTab(n); $('tab-' + n).focus(); } }; });
      document.querySelectorAll('input[name=level]').forEach(r => r.onchange = () => { level = r.value; });
      seed.oninput = () => { const p = seed.selectionStart; seed.value = seed.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''); try { seed.setSelectionRange(p, p); } catch (e) {} seed.removeAttribute('aria-invalid'); hint.textContent = '같은 시드는 같은 세계를 내놓아요. 영문 · 숫자 · - 만 쓸 수 있어요. 예: K7-3F9A'; };
      $('rand').onclick = () => { seed.value = newSeed(); seed.focus(); };
      seed.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('play').click(); } };
      $('back').onclick = () => go('home');
      $('play').onclick = () => {
        const sv = seed.value.trim();
        if (sv && !SEED_RE.test(sv)) { seed.setAttribute('aria-invalid', 'true'); hint.textContent = '시드는 영문 · 숫자 · - 만, 16자까지 쓸 수 있어요.'; seed.focus(); return; }
        const run = { mode: 'basic', level, seed: sv || newSeed(), auto: !sv };
        store.set('start', { level, seed: sv }); store.set('run', run); go('play');
      };
      document.querySelector('input[name=level]:checked').focus();
    },
    play() {
      const run = store.get('run', null); if (!run) { go('start'); return; }
      const lv = LEVELS.find(l => l.id === run.level) || LEVELS[1];
      app.innerHTML = `<section class="stub" aria-label="게임 플레이"><div class="topbar"><button class="back" id="back">← 게임 시작</button></div><h2>게임 플레이</h2>
        <dl class="sum"><div><dt>모드</dt><dd>기본 모드</dd></div><div><dt>난이도</dt><dd>${lv.name} (${lv.sub})</dd></div><div><dt>시드</dt><dd class="mono">${run.seed}${run.auto ? ' (자동)' : ''}</dd></div></dl>
        <div class="box"><b>게임 화면은 아직 만들지 않았어요</b>태어나기부터 이어서 만들 예정이에요.</div></section>`;
      document.getElementById('back').onclick = () => go('start');
      document.getElementById('back').focus();
    },
    stub(id) {
      app.innerHTML = `<section class="stub" aria-label="${NAMES[id]}"><div class="topbar"><button class="back" id="back">← 홈</button></div><h2>${NAMES[id]}</h2><div class="box"><b>아직 만들지 않았어요</b>${NOTES[id]}</div></section>`;
      document.getElementById('back').onclick = () => go('home');
      document.getElementById('back').focus();
    }
  };
  function mark(i, focus) {
    sel = (i + MENU.length) % MENU.length;
    app.querySelectorAll('.menu-btn').forEach((b, k) => b.classList.toggle('sel', k === sel));
    if (focus) focusSel();
  }
  function focusSel() { const b = app.querySelector('.menu-btn.sel'); if (b && document.activeElement !== b) b.focus({ preventScroll: true }); }
  function go(id) {
    cur = id; try { history.replaceState(null, '', id === 'home' ? location.pathname + location.search : '#' + id); } catch (e) {}
    (SCREENS[id] || SCREENS.stub)(id);
  }
  function open(id) { sel = Math.max(0, MENU.findIndex(m => m.id === id)); go(id); }
  let cur = 'home';
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (cur === 'home') {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(sel + 1, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(sel - 1, true); }
      else if (/^[1-9]$/.test(e.key) && MENU[+e.key - 1]) { e.preventDefault(); open(MENU[+e.key - 1].id); }
      // Enter / Space 는 포커스된 버튼이 알아서 누른다
    } else if (e.key === 'Escape' || (e.key === 'Backspace' && !/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName))) { e.preventDefault(); go(cur === 'play' ? 'start' : cur === 'start' ? 'home' : 'home'); }
  });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (NAMES[h] && h !== 'play' && h !== cur) open(h); else if (!h && cur !== 'home') go('home'); });
  window.CEG = { go, toast, store }; // 다음 화면들이 쓸 문
  const h = location.hash.slice(1); NAMES[h] && h !== 'play' ? open(h) : go('home');
})();
