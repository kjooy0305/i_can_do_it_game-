// 끝에 도달하는 이야기 · 플레이 틀. 지금은 홈 화면과 버튼 반응만 있다.
// 화면은 SCREENS 에 하나씩 덧붙인다. 저장은 localStorage 의 'ceg.' 키를 쓴다 (앱으로 감쌀 때 저장소만 바꾸면 된다).
(function () {
  const app = document.getElementById('app');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ceg.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ceg.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const MENU = [ // 홈 메뉴 순서는 세계관 노트의 정한 순서 그대로
    { id: 'start', title: '게임 시작', sub: () => '0세부터 한 달씩, 태어나는 것에서 시작', first: true },
    { id: 'load', title: '이어서 하기', sub: () => { const n = (store.get('saves', []) || []).length; return n ? '저장 ' + n + '개' : '저장된 게임 없음'; } },
    { id: 'dict', title: '사전', sub: () => '발견 0 / 120 · 몬스터 · 장비 · 변이' },
    { id: 'ach', title: '업적', sub: () => '달성 0 / 48' },
    { id: 'set', title: '설정', sub: () => '저장 · 전투 · 화면 · 소리' }
  ];
  const NAMES = { start: '게임 시작', load: '이어서 하기', dict: '사전', ach: '업적', set: '설정' };
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
    id === 'home' ? SCREENS.home() : SCREENS.stub(id);
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
    } else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); go('home'); }
  });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (NAMES[h] && h !== cur) open(h); else if (!h && cur !== 'home') go('home'); });
  window.CEG = { go, toast, store }; // 다음 화면들이 쓸 문
  const h = location.hash.slice(1); NAMES[h] ? open(h) : go('home');
})();
