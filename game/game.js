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
  const NAMES = { start: '게임 시작', load: '이어서 하기', dict: '사전', ach: '업적', set: '설정', play: '게임 플레이', body: '전체 몸 상태', stats: '스텟 · 돈 · 아이템' };
  const INGAME = { play: 1, body: 1, stats: 1 }; // 진행 중인 게임이 있어야 열리는 화면
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
  // 몸 상태: 지금은 모두 원본. 왼쪽 막대는 급소 5곳을 보여 주기만 하고, 버튼 하나로 전체 몸 상태 창을 연다.
  const ST = '원본';
  const VITALS = ['머리', '목', '척추', '심장', '다리'];
  const BODY = [ // 전체 몸 상태 창: [그룹, [[부위, 역할]]]
    ['얼굴', [['왼쪽 눈', '시야 · 조준'], ['오른쪽 눈', '시야 · 조준'], ['코', '냄새 · 침식 감지'], ['입', '말 · 먹기'], ['왼쪽 귀', '소리 · 경계'], ['오른쪽 귀', '소리 · 경계']]],
    ['몸', [['목', '급소'], ['몸통', ''], ['척추', '급소 · 이동과 자세 전체에 영향'], ['심장', '급소 · 생존 한계를 정한다'], ['장기', '폐 · 위 · 간 · 신장 · 장']]],
    ['팔', [['왼쪽 팔', '공격 방식'], ['왼쪽 손', '공격 방식'], ['오른쪽 팔', '공격 방식'], ['오른쪽 손', '공격 방식']]],
    ['다리', [['왼쪽 다리', '회피'], ['왼쪽 발', '회피'], ['오른쪽 다리', '회피'], ['오른쪽 발', '회피']]],
    ['뼈', [['두개골', ''], ['갈비뼈', ''], ['팔뼈', ''], ['다리뼈', ''], ['손발뼈', '']]]
  ];
  const STATS = ['힘', '민첩', '체력', '변이도', '명성', '정신력'];
  const STAT_VAL = Object.fromEntries(STATS.map(k => [k, 0])); // 값은 태어나기 뒤에 정해진다
  const MONEY = [['세오', '금화'], ['므나', '은화'], ['하무', '동화']];

  // 임시 캐릭터: 일본 판타지풍 어린이 도트 (24x38). K 검정 · D 진회색 · G 연회색 · W 흰색 · . 투명
  const SPRITE = [
    '.............KDK........',
    '............KDDK........',
    '...........KDKK.........',
    '..........KDDDK.........',
    '.........KKKKKK.........',
    '......KKKDDDDDDKKK......',
    '.....KDDDDDDDDDDDDK.....',
    '....KDDDDDDDDDDDDDDK....',
    '...KDDDDDDDDDDDDDDDDK...',
    '..KDDDDDDDDDDDDDDDDDDK..',
    '..KDDDDDDDDDDDDDDDDDDK..',
    '.KDDDDDDDDDDDDDDDDDDDDK.',
    '.KDDDDDDDDDDDDDDDDDDDDK.',
    '..KDDDDDDDDDDDDDDDDDDK..',
    '..KDDWWDWWDWWDWWDWWDDK..',
    '..KDDWWKKKWWWWKKKWWDDK..',
    '..KDDWWWKKWWWWWKKWWDDK..',
    '..KDDWWWKKWWWWWKKWWDDK..',
    '..KDKWWKKKWWWWKKKWWKDK..',
    '...KKWWKKWWWWWKKWWWKK...',
    '....KGGWWWWWWWWWWGGK....',
    '.....KKKWWWKKWWWKKK.....',
    '........KKKKKKKK........',
    '.....KKKWWWWWWWWKKK.....',
    '....KDDDWWWWWWWWWDDK....',
    '....KDDDGGGWWGGWWDDK....',
    '....KDGGGGGWWGGWDGDK....',
    '....KDWWGGGWWGGWWWDK....',
    '....KDWWGGGWWGGWDWDK....',
    '....KDWWGGGWWGGGWWDK....',
    '....KDWWDDDDDDDDWWDK....',
    '....KDDDGGGGGGGGDDDK....',
    '....KDDDDWWDDWWDDDDK....',
    '.....KKKKWWKKWWKKKK.....',
    '........KWWKKWWK........',
    '.......KDDDDDDDDK.......',
    '.......KDDDDDDDDK.......',
    '........KKKKKKKK........'
  ];
  const PAL = { K: '#000', D: '#464646', G: '#c4c4c4', W: '#fff' };
  function spriteCanvas(px) {
    const c = document.createElement('canvas'); c.width = SPRITE[0].length * px; c.height = SPRITE.length * px; c.className = 'sprite';
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', '임시 캐릭터');
    const x = c.getContext('2d'); if (!x) return c; SPRITE.forEach((r, j) => [...r].forEach((ch, i) => { if (PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i * px, j * px, px, px); } }));
    return c;
  }
  const bar = v => `<div class="bar2"><i style="width:${v}%"></i></div>`;


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
      app.classList.add('wide');
      app.innerHTML = `<div class="gframe" aria-label="게임 화면">
        <header class="gtop">
          <button class="sq" id="menuBtn" aria-label="메뉴" aria-haspopup="true" aria-expanded="false">☰</button>
          <div class="gmid"><b>태아기 · 0세 0개월</b><small>${lv.name}(${lv.sub}) · 시드 <span class="mono">${run.seed}</span></small></div>
        </header>
        <div class="gline"></div>
        <div class="gmain">
          <aside class="rail l" aria-label="주요 신체 상태"><h4>몸 상태</h4>${VITALS.map(v => `<div class="rrow"><span>${v}</span><em>${ST}</em></div>`).join('')}<button class="wbtn" id="bodyBtn">전체 몸 상태 <span aria-hidden="true">▸</span></button></aside>
          <section class="gstage" aria-label="이야기">
            <div class="head2"><span>이번 달</span><span class="mono">#000</span></div>
            <div class="art"><span>장면</span></div>
            <div class="log"><p class="sys">▸ 시작 · 시드 ${run.seed}${run.auto ? ' (자동)' : ''} · ${lv.name}</p><p>이야기가 여기에 나옵니다.</p><p><button class="back" id="sample">임시 · 선택지 창 보기</button></p></div>
          </section>
          <aside class="rail r" aria-label="스텟 · 돈 · 아이템">
            <button class="rowbtn" id="statBtn" aria-label="스텟과 돈 화면 열기"><span class="rh">스텟</span>${STATS.map(k => `<span class="sl"><span>${k}</span><b>${STAT_VAL[k]}</b></span>`).join('')}</button>
            <button class="rowbtn" id="moneyBtn" aria-label="스텟과 돈 화면 열기"><span class="sl"><span>돈</span><b>0</b></span><small>하무</small></button>
            <button class="rowbtn" id="itemBtn" aria-label="스텟 · 돈 · 아이템 화면 열기"><span class="sl"><span>아이템</span><b>0/12</b></span></button>
          </aside>
        </div>
      </div>
      <div class="pop" id="pop" hidden></div>`;
      const pop = document.getElementById('pop'), menuBtn = document.getElementById('menuBtn');
      let opener = null;
      const close = () => { pop.hidden = true; pop.innerHTML = ''; menuBtn.setAttribute('aria-expanded', 'false'); if (opener) { opener.focus(); opener = null; } };
      const show = (title, body, from) => { opener = from; pop.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${title}"><div class="shead"><h3>${title}</h3><button class="back" data-close data-first>닫기</button></div>${body}</div>`; pop.hidden = false; pop.querySelector('[data-first]').focus(); pop.querySelectorAll('[data-close]').forEach(x => x.onclick = close); };
      pop.onclick = e => { if (e.target === pop && !pop.dataset.choice) close(); };
      const $ = id => document.getElementById(id);
      $('bodyBtn').onclick = e => { e.stopPropagation(); go('body'); };
      document.querySelector('.rail.l').onclick = () => go('body');   // 막대 어디를 눌러도 몸 상태 화면으로
      $('statBtn').onclick = () => go('stats');
      $('moneyBtn').onclick = () => go('stats');
      $('itemBtn').onclick = () => go('stats');
      // 선택지가 필요한 장면은 이 창으로 띄운다. 뒤는 흐리게 가리고, 고르기 전에는 닫히지 않는다 (숫자 키로도 고른다).
      const ask = (question, choices) => new Promise(res => {
        opener = document.activeElement;
        pop.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="선택"><div class="q"><span>${question}</span></div><div class="mlist">${choices.map((c, i) => `<button class="menu-btn" data-c="${i}"><span><b>${c}</b></span><span class="key" aria-hidden="true">${i + 1}</span></button>`).join('')}</div></div>`;
        pop.hidden = false; pop.dataset.choice = '1';
        const pick = i => { delete pop.dataset.choice; close(); const lg = document.querySelector('.log'); if (lg) { const p = document.createElement('p'); p.className = 'me'; p.textContent = '▸ 선택: ' + choices[i]; lg.append(p); } res(i); };
        pop.querySelectorAll('[data-c]').forEach(b => b.onclick = () => pick(+b.dataset.c));
        pop.__pick = pick; pop.__n = choices.length; pop.querySelector('[data-c]').focus();
      });
      CEG.ask = ask;
      $('sample').onclick = () => ask('지하 대피소의 불이 깜박인다. 이번 달 어떻게 할까?', ['엄마 품에서 울음을 터뜨린다', '아빠 손을 잡고 첫걸음을 떼 본다', '가만히 위의 소리를 듣는다']);
      menuBtn.onclick = () => {
        menuBtn.setAttribute('aria-expanded', 'true');
        show('메뉴', `<div class="mlist"><button class="menu-btn" id="m-start"><span><b>게임 시작 화면으로</b><small>난이도와 시드를 다시 고른다</small></span></button><button class="menu-btn" id="m-home"><span><b>홈으로</b></span></button></div>`, menuBtn);
        $('m-start').onclick = () => go('start'); $('m-home').onclick = () => go('home');
      };
      window.__closePop = () => { if (pop.dataset.choice) return true; if (!pop.hidden) { close(); return true; } return false; };
      window.__pickChoice = k => { if (pop.dataset.choice && k < pop.__n) { pop.__pick(k); return true; } return false; };
    },
    body() {
      if (!store.get('run', null)) { go('home'); return; }
      app.classList.add('wide');
      const dmg = {}; // 부위별 손상도 0~100 (지금은 모두 0)
      const groupPct = ps => Math.round(100 - ps.reduce((n, p) => n + (dmg[p[0]] || 0), 0) / ps.length); // 묶음 전체의 온전함
      const label = pct => pct >= 100 ? '모두 원본' : pct >= 70 ? '가벼운 손상' : pct >= 40 ? '손상' : '위험';
      const run = store.get('run', {});
      app.innerHTML = `<section class="stub" aria-label="전체 몸 상태"><div class="topbar"><button class="back" id="back">← 게임으로</button></div><h2>전체 몸 상태</h2>
        <section class="who" aria-label="캐릭터">
          <div class="fig" id="fig"><small>임시 캐릭터</small></div>
          <dl class="info">
            <div><dt>이름</dt><dd>아직 없음</dd></div>
            <div><dt>현재 나이</dt><dd>0세 0개월 (태아기)</dd></div>
            <div><dt>가족 현황</dt><dd><ul class="fam"><li><span>엄마</span><em>알 수 없음</em></li><li><span>아빠</span><em>알 수 없음</em></li><li><span>형제</span><em>알 수 없음</em></li></ul></dd></div>
          </dl>
        </section>
        <div class="gbar"><button class="back" id="openAll">모두 펴기</button><button class="back" id="closeAll">모두 접기</button></div>
        ${BODY.map(([g, ps]) => { const pct = groupPct(ps); return `<details class="bgrp" open><summary><span class="gn">${g}</span><span class="gs"><span class="bar2" role="img" aria-label="${g} 통합 상태 ${pct}%"><i style="width:${pct}%"></i></span><b class="mono">${pct}%</b><small>${label(pct)}</small></span></summary><ul class="plist">${ps.map(p => `<li><div><b>${p[0]}</b>${p[1] ? `<small>${p[1]}</small>` : ''}</div><span class="st">${ST}</span>${bar(dmg[p[0]] || 0)}</li>`).join('')}</ul></details>`; }).join('')}
        <small class="foot">상태 · 원본 / 침식 / 감염 / 대체 / 창조 &nbsp;·&nbsp; 묶음 막대는 그 묶음 부위들의 온전함 평균이에요 (100% = 손상 없음)</small></section>`;
      document.getElementById('fig').prepend(spriteCanvas(6));
      const all = open => document.querySelectorAll('.bgrp').forEach(d => { d.open = open; });
      document.getElementById('openAll').onclick = () => all(true); document.getElementById('closeAll').onclick = () => all(false);
      document.getElementById('back').onclick = () => go('play'); document.getElementById('back').focus();
    },
    stats() {
      if (!store.get('run', null)) { go('home'); return; }
      app.innerHTML = `<section class="stub" aria-label="스텟 · 돈 · 아이템"><div class="topbar"><button class="back" id="back">← 게임으로</button></div><h2>스텟 · 돈 · 아이템</h2>
        <section class="pgrp"><h4>스텟</h4><ul class="plist">${STATS.map(k => `<li><div><b>${k}</b></div><span class="st mono">${STAT_VAL[k]}</span>${bar(STAT_VAL[k])}</li>`).join('')}</ul></section>
        <section class="pgrp"><h4>돈</h4><ul class="plist">${MONEY.map(([n, k]) => `<li><div><b>${n}</b><small>${k}</small></div><span class="st mono">0</span></li>`).join('')}</ul></section>
        <section class="pgrp"><h4>아이템 <span class="mono" style="font-weight:800">0 / 12</span></h4><div class="box">가진 물건이 없어요.</div></section>
        <small class="foot">스텟 값은 태어난 뒤에 정해져요 &nbsp;·&nbsp; 하무 100 = 므나 1 · 므나 100 = 세오 1</small></section>`;
      document.getElementById('back').onclick = () => go('play'); document.getElementById('back').focus();
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
    cur = id; app.classList.remove('wide'); window.__closePop = null; window.__pickChoice = null; CEG.ask = null; try { history.replaceState(null, '', id === 'home' ? location.pathname + location.search : '#' + id); } catch (e) {}
    (SCREENS[id] || SCREENS.stub)(id);
  }
  function open(id) { sel = Math.max(0, MENU.findIndex(m => m.id === id)); go(id); }
  let cur = 'home';
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (cur === 'play' && window.__pickChoice && /^[1-9]$/.test(e.key) && window.__pickChoice(+e.key - 1)) { e.preventDefault(); return; }
    if (cur === 'home') {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(sel + 1, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(sel - 1, true); }
      else if (/^[1-9]$/.test(e.key) && MENU[+e.key - 1]) { e.preventDefault(); open(MENU[+e.key - 1].id); }
      // Enter / Space 는 포커스된 버튼이 알아서 누른다
    } else if (e.key === 'Escape' && cur === 'play' && window.__closePop && window.__closePop()) { e.preventDefault(); }
    else if (e.key === 'Escape' || (e.key === 'Backspace' && !/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName))) { e.preventDefault(); go(cur === 'body' || cur === 'stats' ? 'play' : cur === 'play' ? 'start' : 'home'); }
  });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (NAMES[h] && !INGAME[h] && h !== cur) open(h); else if (INGAME[h] && h !== cur && store.get('run', null)) go(h); else if (!h && cur !== 'home') go('home'); });
  const CEG = window.CEG = { go, toast, store, ask: null }; // 다음 화면들이 쓸 문
  const h = location.hash.slice(1); NAMES[h] && !INGAME[h] ? open(h) : INGAME[h] && store.get('run', null) ? go(h) : go('home');
})();
