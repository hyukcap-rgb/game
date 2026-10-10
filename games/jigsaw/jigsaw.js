/* ===== 명화 퍼즐 (jigsaw) · 섞인 명화 조각을 3×3 · 4×4 · 5×5로 맞추기 =====
   그림: games/jigsaw/img/<key>.webp (720×720 정사각, 모두 저작권이 끝난 퍼블릭 도메인 명화 · 위키미디어 커먼즈)
   조각 두 개를 눌러(또는 끌어) 자리를 바꾼다. 제자리에 맞으면 잠겨서 더는 안 움직인다(맞춘 조각은 안 흔들림).
   문제(어떤 명화·어떻게 섞였나)는 씨앗 난수(rng)로만 만든다. */
NG.jigsaw = (() => {
  /* 그림 주소: 사이트(index.html)는 games/jigsaw/img/, 붙여 쓰는 모듈(embed/jigsaw.html)은 ../games/jigsaw/img/ */
  let base = 'games/jigsaw/img/';
  try{ if(/\/embed\/[^/]*$/.test(location.pathname)) base = '../games/jigsaw/img/'; }catch(_){}
  const srcOf = k => base + k + '.webp';

  /* 명화 13점: [열쇠, 이름, 화가, 연도, 대표색] */
  const ARTS = [
    ['starry', '별이 빛나는 밤', '빈센트 반 고흐', '1889', '#27408B'],
    ['mona', '모나리자', '레오나르도 다 빈치', '1503경', '#7A6A3A'],
    ['wave', '가나가와 해변의 높은 파도', '가쓰시카 호쿠사이', '1831경', '#2A5B9C'],
    ['sunrise', '인상, 해돋이', '클로드 모네', '1872', '#4E8C8A'],
    ['pearl', '진주 귀걸이를 한 소녀', '요하네스 페르메이르', '1665경', '#243A66'],
    ['scream', '절규', '에드바르 뭉크', '1893', '#D9602B'],
    ['kiss', '키스', '구스타프 클림트', '1908', '#C8962A'],
    ['milkmaid', '우유 따르는 여인', '요하네스 페르메이르', '1658경', '#C9A85A'],
    ['adam', '아담의 창조', '미켈란젤로', '1512경', '#C9B79A'],
    ['lilies', '수련', '클로드 모네', '1906', '#4A7A9A'],
    ['fuji', '붉은 후지산(개풍쾌청)', '가쓰시카 호쿠사이', '1831경', '#B8442A'],
    ['bedroom', '아를의 침실', '빈센트 반 고흐', '1888', '#C9A23A'],
    ['wanderer', '안개 바다 위의 방랑자', '카스파르 다비트 프리드리히', '1818경', '#7C8EA0']
  ];
  const artOf = k => ARTS.find(a => a[0] === k) || ARTS[0];

  const LIM = { 3:120, 4:240, 5:420 };
  /* 솔로: 10판 한 바퀴(k) 조각 수 · 판마다 명화를 돌려 가며(챕터가 오를수록 큰 판이 많아짐) */
  const SZ_K = [3, 3, 3, 4, 4, 3, 4, 4, 3, 5];
  const EASY_K = [1, 6, 9];
  function stageCfg(n){
    const c = Math.ceil(n / 10), k = n - (c - 1) * 10;
    const bump = EASY_K.includes(k) ? Math.min(1, c - 1) : Math.min(2, c - 1);
    const size = Math.max(3, Math.min(5, SZ_K[k - 1] + bump));
    const tight = k === 10 || c >= 3 ? .9 : 1;
    return { n:size, limit:Math.round(LIM[size] * tight), hints:3, art:ARTS[(n - 1) % ARTS.length][0] };
  }

  /* ----- 작은 그림(아이콘) ----- */
  const ICO = {
    piece:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h4.2a2.6 2.6 0 1 1 5.2 0H17a1 1 0 0 1 1 1v3.2a2.6 2.6 0 1 1 0 5.2V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a6.5 6.5 0 0 0-3.6 11.9c.7.5 1.1 1.3 1.1 2.1v.5h5v-.5c0-.8.4-1.6 1.1-2.1A6.5 6.5 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.6 20h4.8M10.5 22.2h3" stroke="#1A0F45" stroke-width="1.8" stroke-linecap="round"/></svg>',
    eye:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.3" fill="#6C3CE0" stroke="#1A0F45" stroke-width="1.6"/></svg>'
  };

  const S = () => G.j;
  const T_ = (fn, ms) => { const m = S(); const id = setTimeout(() => { m.timers.delete(id); try{ fn(); }catch(_){} }, ms); m.timers.add(id); return id; };
  const totalOf = m => m.n * m.n;

  /* 섞기: 제자리인 조각이 하나도 없게(안 되면 몇 번 더). perm[칸] = 그 칸에 놓인 조각 번호(조각 번호 = 원래 자리) */
  function makePerm(n, rng){
    const N = n * n; let p = null;
    for(let t = 0; t < 60; t++){
      p = shuffle(Array.from({ length:N }, (_, i) => i), rng);
      if(p.every((v, i) => v !== i)) break;
    }
    if(p.every((v, i) => v === i)){ p.push(p.shift()); }   /* 아주 드문 경우: 이미 완성이면 한 칸씩 밀기 */
    return p;
  }
  /* 가장 적게 바꿀 수 있는 횟수 = 조각 수 − 순환 고리 수 */
  function minSwaps(p){
    const seen = new Array(p.length).fill(false); let cyc = 0;
    for(let i = 0; i < p.length; i++){ if(seen[i]) continue; cyc++; for(let j = i; !seen[j]; j = p[j]) seen[j] = true; }
    return p.length - cyc;
  }
  const lockedAt = (m, i) => m.perm[i] === i;

  /* ----- 그림 읽기 ----- */
  function pieceStyle(m, i){
    const n = m.n, id = m.perm[i], r = Math.floor(id / n), c = id % n, d = n - 1;
    return `--bx:${(c / d * 100).toFixed(3)}%;--by:${(r / d * 100).toFixed(3)}%`;
  }
  function pieceHtml(m, i){
    const lk = lockedAt(m, i);
    return `<div class="jg-p${lk ? ' ok' : ''}" role="button" tabindex="${lk ? -1 : 0}" data-pos="${i}" style="${pieceStyle(m, i)}" aria-label="${Math.floor(i / m.n) + 1}줄 ${i % m.n + 1}칸 조각${lk ? ' (제자리)' : ''}"><span class="jg-no">${m.perm[i] + 1}</span></div>`;
  }
  const cell = i => document.querySelector(`#jgBoard .jg-p[data-pos="${i}"]`);
  function paint(i){
    const m = S(), el = cell(i); if(!el) return;
    el.setAttribute('style', pieceStyle(m, i));
    const lk = lockedAt(m, i);
    el.classList.toggle('ok', lk); el.tabIndex = lk ? -1 : 0;
    el.querySelector('.jg-no').textContent = m.perm[i] + 1;
  }

  function hud(){
    const m = S(); if(!m) return;
    const a = $('#jgPlaced'); if(a) a.textContent = m.placed;
    const h = $('#jgHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0 || m.phase !== 'play'; }
  }
  function msg(html, cls){ const e = $('#jgMsg'); if(e){ e.className = 'jg-msg' + (cls ? ' ' + cls : ''); e.innerHTML = html; } }
  const playMsg = () => '<b>조각 두 개</b>를 눌러 서로 자리를 바꿔요';

  /* ----- 움직임 ----- */
  function flip(el, dx, dy){
    if(!el || FXR.reduce) return;
    el.style.transition = 'none'; el.style.transform = `translate(${dx}px,${dy}px)`;
    void el.offsetWidth;
    el.style.transition = 'transform .22s cubic-bezier(.2,.8,.3,1)'; el.style.transform = '';
    setTimeout(() => { if(el) el.style.transition = ''; }, 260);
  }
  function lockFx(el, strong){
    try{
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      const p = fxCenter(el);
      fxBurst(p.x, p.y, ['#FFE27A', '#FFFFFF', '#FFB84D'], strong ? 14 : 8, { speed:200, size:4, kinds:['star', 'spark'], life:.5 });
    }catch(_){}
  }
  /* 두 칸의 조각을 바꾼다(화면 + 상태). 손으로 하든 힌트든 같은 길 */
  function swap(a, b, how){
    const m = S(); if(!m || m.phase !== 'play' || a === b || lockedAt(m, a) || lockedAt(m, b)) return false;
    const ea = cell(a), eb = cell(b); if(!ea || !eb) return false;
    const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
    [m.perm[a], m.perm[b]] = [m.perm[b], m.perm[a]];
    if(how !== 'hint') m.moves++;
    clearSel();
    paint(a); paint(b);
    flip(ea, rb.left - ra.left, rb.top - ra.top); flip(eb, ra.left - rb.left, ra.top - rb.top);
    let got = 0;
    [a, b].forEach(i => { if(lockedAt(m, i)){ got++; m.placed++; lockFx(cell(i), how === 'hint'); } });
    sfx(got ? 'jgLock' : 'jgSwap', { n:m.placed });
    if(got){ try{ fxBuzz([15]); }catch(_){} }
    else msg(playMsg());
    if(got && m.placed < totalOf(m)) msg(`<b>${m.placed}조각</b> 제자리! 남은 ${totalOf(m) - m.placed}조각`);
    hud();
    if(m.placed >= totalOf(m)) win();
    return true;
  }
  function clearSel(){
    const m = S(); if(!m) return;
    if(m.sel >= 0){ const e = cell(m.sel); if(e) e.classList.remove('sel'); }
    m.sel = -1;
  }
  function tapPiece(pos){
    const m = S(); if(!m || m.phase !== 'play' || lockedAt(m, pos)) return;
    if(m.sel === pos){ clearSel(); sfx('tap'); return; }
    if(m.sel < 0){ m.sel = pos; const e = cell(pos); if(e) e.classList.add('sel'); sfx('jgPick'); msg('<b>어디와 바꿀까요?</b> 다른 조각을 눌러요'); return; }
    swap(m.sel, pos);
  }
  const canAct = () => { const m = G && G.j; return !!m && m.phase === 'play' && !G.paused && !(G.duel && !G.duel.go && !G.duel.replay); };

  function wire(){
    const bd = $('#jgBoard'); if(!bd) return;
    let dr = null;
    const under = (x, y, skip) => {
      const els = document.elementsFromPoint(x, y);
      for(const e of els){ const p = e.closest && e.closest('#jgBoard .jg-p'); if(p && p !== skip) return p; }
      return null;
    };
    const mark = p => { bd.querySelectorAll('.jg-p.aim').forEach(e => { if(e !== p) e.classList.remove('aim'); }); if(p && !p.classList.contains('ok')) p.classList.add('aim'); };
    const reset = () => { if(dr){ dr.el.classList.remove('drag'); dr.el.style.transform = ''; dr.el.style.zIndex = ''; } mark(null); dr = null; };
    bd.addEventListener('pointerdown', e => {
      if(!canAct() || dr) return;
      const p = e.target.closest('.jg-p'); if(!p) return;
      const pos = +p.dataset.pos;
      if(lockedAt(S(), pos)){ p.classList.remove('nope'); void p.offsetWidth; p.classList.add('nope'); return; }
      dr = { pos, el:p, x:e.clientX, y:e.clientY, on:false, id:e.pointerId };
      try{ bd.setPointerCapture(e.pointerId); }catch(_){}
    });
    bd.addEventListener('pointermove', e => {
      if(!dr || e.pointerId !== dr.id) return;
      const dx = e.clientX - dr.x, dy = e.clientY - dr.y;
      if(!dr.on && Math.hypot(dx, dy) > 10){ dr.on = true; dr.el.classList.add('drag'); }
      if(dr.on){ dr.el.style.transform = `translate(${dx}px,${dy}px) scale(1.07)`; mark(under(e.clientX, e.clientY, dr.el)); }
    });
    const up = e => {
      if(!dr || e.pointerId !== dr.id) return;
      const d = dr, wasDrag = d.on, tgt = wasDrag && e.type === 'pointerup' ? under(e.clientX, e.clientY, d.el) : null;
      reset();
      if(!canAct()) return;
      if(wasDrag){ if(tgt) swap(d.pos, +tgt.dataset.pos); }
      else if(e.type === 'pointerup') tapPiece(d.pos);
    };
    bd.addEventListener('pointerup', up); bd.addEventListener('pointercancel', up);
    bd.addEventListener('keydown', e => {
      if(e.key !== 'Enter' && e.key !== ' ') return;
      const p = e.target.closest && e.target.closest('.jg-p'); if(!p) return;
      e.preventDefault(); if(canAct()) tapPiece(+p.dataset.pos);
    });
    $('#jgHint').onclick = hint;
    $('#jgPeekBtn').onclick = peek;
    $('#jgPeek').onclick = () => peekHide();
  }

  /* 힌트: 틀린 칸 하나를 골라 맞는 조각을 그 자리로 보냄(맨 위 줄부터) */
  function hint(){
    const m = S(); if(!canAct() || m.hintLeft <= 0) return;
    const pos = m.perm.findIndex((v, i) => v !== i); if(pos < 0) return;
    const from = m.perm.indexOf(pos);
    m.hintLeft--; m.hints++;
    sfx('jgHint');
    swap(pos, from, 'hint');
    hud();
  }
  function peek(){
    const m = S(); if(!canAct()) return;
    m.peeks++;
    const pk = $('#jgPeek'); pk.hidden = false; pk.classList.add('on');
    sfx('toggle', { on:true });
    clearTimeout(m.peekT); m.peekT = setTimeout(peekHide, 2600); m.timers.add(m.peekT);
  }
  function peekHide(){ const pk = $('#jgPeek'); if(pk){ pk.classList.remove('on'); pk.hidden = true; } }

  /* ----- 끝 ----- */
  function win(){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.sec = elapsed(); peekHide();
    const bd = $('#jgBoard'); if(bd) bd.classList.add('done');
    const [, nm, who, yr] = artOf(m.art);
    msg(`<b>완성!</b> <span>${esc(nm)} · ${esc(who)} (${esc(yr)})</span>`, 'jg-win');
    hud();
    sfx('win', { g:'jigsaw' }); try{ fxBuzz([30, 50, 30]); }catch(_){}
    try{ if(bd){ const p = fxCenter(bd); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); fxConfetti(); } }catch(_){}
    T_(() => finish(true), G.duel ? 900 : 1700);
  }
  function lose(){
    const m = S(); if(!m || m.phase !== 'play') return;
    m.phase = 'done'; m.fail = 'time'; clearSel(); peekHide();
    msg(`<b class="bad">시간이 다 됐어요</b><span>${m.placed}/${totalOf(m)}조각</span>`, 'jg-pop');
    sfx('jgTimeUp'); try{ fxBuzz([40, 40, 60]); }catch(_){}
    T_(() => finish(false), 800);
  }

  function loop(){
    if(!G || !G.j || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S();
    if(m.phase !== 'play') return;
    const rem = Math.max(0, G.limit - elapsed()), sec = Math.ceil(rem);
    const bar = $('#jgBar'); if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#jgTime'); if(e) e.textContent = mmss(sec);
      const p = $('#jgTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#jgBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0) sfx('jgTick', { hi:sec <= 5 });
    }
    if(rem <= 0 && !G.duel){ const e = $('#jgTime'); if(e) e.textContent = '0:00'; lose(); }
  }

  /* 판 크기(화면 높이에 맞춰 정사각 조절) */
  function layout(){
    const w = $('#jgWrap'); if(!w) return;
    const top = w.getBoundingClientRect().top, avail = Math.max(220, innerHeight - top - 74);
    const room = ($('#stage') && $('#stage').clientWidth) || innerWidth;
    w.style.setProperty('--jgs', Math.floor(Math.min(room - 4, avail, 520)) + 'px');
  }

  /* ----- 게임 정의 ----- */
  return {
    name:'명화 퍼즐', abil:'공간지각', col:['#FFE19A', '#E8A317', '#8A5A00'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1.5 2.5v13h13v-13z"/><path d="M7 16.5l3.2-4.4 2.3 2.8 1.7-1.9 2.8 3.5z"/><circle cx="15.6" cy="9" r="1.5"/></svg>',
    art(){
      /* 썸네일: 명화(별이 빛나는 밤)를 3×3으로 나눠 두 조각이 자리를 바꾸는 중 */
      const src = srcOf('starry'), K = 3, cs = 28, gap = 2, x0 = (160 - (K * cs + (K - 1) * gap)) / 2, y0 = (100 - (K * cs + (K - 1) * gap)) / 2;
      const order = [0, 1, 2, 3, 7, 5, 6, 4, 8];   /* 4번과 7번 조각이 서로 바뀐 모습 */
      const tile = (pos, id) => {
        const r = Math.floor(id / K), c = id % K, x = x0 + (pos % K) * (cs + gap), y = y0 + Math.floor(pos / K) * (cs + gap), ok = pos === id;
        return `<svg x="${x}" y="${y}" width="${cs}" height="${cs}" viewBox="${c * 100 / K} ${r * 100 / K} ${100 / K} ${100 / K}" preserveAspectRatio="none"><image href="${src}" width="100" height="100" preserveAspectRatio="none"/></svg>
          <rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="none" stroke="${ok ? '#FFE27A' : '#1A0F45'}" stroke-width="${ok ? 1.6 : 2}"/>`;
      };
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="100" fill="#8A5A00"/><rect x="${x0 - 5}" y="${y0 - 5}" width="${K * cs + (K - 1) * gap + 10}" height="${K * cs + (K - 1) * gap + 10}" rx="3" fill="#E8A317" stroke="#1A0F45" stroke-width="2.4"/>
        ${order.map((id, pos) => tile(pos, id)).join('')}</svg>`;
    },
    help:[
      ['조각 두 개를 눌러요', '섞인 명화 조각 하나를 누르고, 바꾸고 싶은 다른 조각을 누르면 서로 자리가 바뀌어요. 끌어다 놓아도 돼요.'],
      ['제자리에 맞으면 잠겨요', '조각이 제 자리를 찾으면 반짝이며 잠겨요. 잠긴 조각은 더 움직이지 않아요.'],
      ['막히면 도움을 받아요', '[완성 그림 보기]로 원래 그림을 잠깐 볼 수 있고, [힌트]는 틀린 조각 하나를 알아서 제자리로 보내 줘요(점수가 조금 깎여요).'],
      ['3×3 · 4×4 · 5×5', '쉬움은 3×3(9조각), 보통은 4×4(16조각), 어려움은 5×5(25조각)예요. 시간 안에 완성하면 성공!']
    ],
    howto:{
      /* 그림(320×180, 글자 없음): 3×3 색 조각 중 두 조각이 서로 자리를 바꿈 */
      pic(){
        const cs = 46, gap = 4, K = 3, x0 = (320 - (K * cs + (K - 1) * gap)) / 2, y0 = (180 - (K * cs + (K - 1) * gap)) / 2;
        const col = ['#3B5BA9', '#4D7CC9', '#8FB8E8', '#2A6F6A', '#E8A317', '#F4D27A', '#7A4A2A', '#B8442A', '#E9D9B5'];
        const xy = i => [x0 + (i % K) * (cs + gap), y0 + Math.floor(i / K) * (cs + gap)];
        const A = 1, B = 7, [ax, ay] = xy(A), [bx, by] = xy(B);
        const tile = (i, anim) => { const [x, y] = xy(i);
          return `<g transform="translate(${x} ${y})"><g>${anim || ''}<rect width="${cs}" height="${cs}" rx="5" fill="${col[i]}" stroke="#1A0F45" stroke-width="3"/><path d="M6 ${cs - 8}l12-14 9 9 7-8 6 13z" fill="#fff" opacity=".28"/></g></g>`; };
        const mv = (dx, dy) => `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;${dx} ${dy};${dx} ${dy};0 0;0 0" keyTimes="0;.2;.4;.7;.9;1" dur="5s" repeatCount="indefinite"/>`;
        return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="16" fill="#FFE9B8"/>
          ${col.map((_, i) => i === A || i === B ? '' : tile(i)).join('')}
          ${tile(A, mv(bx - ax, by - ay))}${tile(B, mv(ax - bx, ay - by))}
          <g opacity="0"><circle cx="${ax + cs / 2}" cy="${ay + cs / 2}" r="${cs * .62}" fill="none" stroke="#FFC93C" stroke-width="5"/><circle cx="${bx + cs / 2}" cy="${by + cs / 2}" r="${cs * .62}" fill="none" stroke="#FFC93C" stroke-width="5"/>
            <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.15;.2;.4;.45;1" dur="5s" repeatCount="indefinite"/></g></svg>`;
      },
      lines:['섞인 조각을 두 개 눌러요', '서로 자리가 바뀌어요', '명화를 완성하면 끝!'],
      more:[
        ['누르기 · 끌기', '조각을 누르고 다른 조각을 누르면 자리가 바뀌어요. 조각을 끌어서 다른 조각 위에 놓아도 돼요. 제자리에 맞은 조각은 잠겨요.'],
        ['완성 그림 보기', '[완성 그림 보기]를 누르면 원래 그림이 2~3초 보여요. 시간은 계속 가요. 많이 볼수록 점수가 조금 줄어요.'],
        ['힌트', '[힌트]는 틀린 조각 하나를 제자리로 보내 줘요. 한 판에 3번, 쓸 때마다 점수가 줄어요.'],
        ['점수', '빨리 끝낼수록, 조각을 적게 바꿀수록, 힌트를 안 쓸수록 점수가 높아요.']
      ]
    },
    chapters:['빛의 정원', '붓끝의 거장들', '파도와 후지산', '별빛 화랑', '세계 미술관'],
    starRule:'★ 완성 · ★★ 적게 바꾸고 힌트 1번 이하 · ★★★ 아주 적게 바꾸고 힌트 없이',
    levels:{
      easy:{ n:3, limit:LIM[3], hints:3 },
      normal:{ n:4, limit:LIM[4], hints:3 },
      hard:{ n:5, limit:LIM[5], hints:3 }
    },
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.n}×${c.n} · 조각 ${c.n * c.n}개 · ${mmss(c.limit)}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.n}×${c.n} · 조각 ${c.n * c.n}개 · ${mmss(c.limit)}`; },
    init(cfg, rng){
      const n = cfg.n || 4;
      /* 어떤 명화: 솔로는 판마다 정해 둠, 그 밖은 씨앗으로(대전은 최근 본 그림을 피해) */
      let key = cfg.art;
      if(!key){
        const avoid = (G.duel && G.duel.avoid) || cfg.avoid || [];
        const pool = ARTS.filter(a => !avoid.includes(a[0]));
        key = (pool.length ? pool : ARTS)[Math.floor(rng() * (pool.length || ARTS.length))][0];
      }
      const perm = makePerm(n, rng);
      G.j = { n, art:key, perm, min:minSwaps(perm), sel:-1, moves:0, hints:0, peeks:0, hintLeft:cfg.hints == null ? 3 : cfg.hints,
        placed:0, phase:'play', lastSec:-1, sec:0, fail:null, timers:new Set(), peekT:0, imgOk:false };
      G.limit = cfg.limit;
      const m = G.j;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
      /* 테스트·도구용: 남은 조각을 차례로 제자리로 보낸다 */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.j !== m || m.phase !== 'play'){ res(m.placed); return; }
          if(G.paused || !canAct()){ setTimeout(step, 80); return; }
          const pos = m.perm.findIndex((v, i) => v !== i);
          if(pos < 0){ res(m.placed); return; }
          swap(pos, m.perm.indexOf(pos));
          setTimeout(step, 60);
        };
        step();
      });
    },
    _solveForTest(){ return G.j._solveForTest(); },
    _tapForTest(i){ tapPiece(i); return true; },
    render(st){
      const m = S(), N = totalOf(m), a = artOf(m.art);
      st.innerHTML = `<div class="ng-jig">
        <div class="hud-row">
          <div class="hchip" aria-label="제자리에 맞춘 조각"><span class="hv">${ICO.piece}<b id="jgPlaced">0</b><small>/${N}</small></span><em>맞춘 조각</em></div>
          <div class="hchip time" id="jgTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="jgTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
          <button class="hchip item" id="jgHint" aria-label="힌트"><span class="hv">${ICO.hint}<b>${m.hintLeft}</b></span><em>힌트</em></button>
        </div>
        <div class="hbar jg-tbar" id="jgBarWrap"><i id="jgBar"></i></div>
        <div class="jg-msg" id="jgMsg">${playMsg()}</div>
        <div class="jg-wrap" id="jgWrap" style="--n:${m.n};--art:url('${srcOf(m.art)}');--artc:${a[4]}">
          <div class="jg-board" id="jgBoard" role="group" aria-label="${m.n}×${m.n} 명화 조각판">${m.perm.map((_, i) => pieceHtml(m, i)).join('')}</div>
          <div class="jg-peek" id="jgPeek" hidden><img alt="완성된 명화" src="${srcOf(m.art)}"><span>눌러서 닫기</span></div>
        </div>
        <div class="jg-tools"><button class="jg-look" id="jgPeekBtn">${ICO.eye}<span>완성 그림 보기</span></button></div>
      </div>`;
      wire(); hud(); layout();
      const img = new Image();
      img.onload = () => { const w = $('#jgWrap'); if(w) w.classList.add('ready'); m.imgOk = true; };
      img.onerror = () => { const w = $('#jgWrap'); if(w) w.classList.add('noimg', 'ready'); };
      img.src = srcOf(m.art);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.j; return m ? m.placed / totalOf(m) : 0; },
    lossText(){ const m = G.j; return `조각 ${m.placed}/${totalOf(m)}개를 제자리에 맞췄어요.`; },
    score(){
      const m = G.j, sec = Math.max(0, Math.min(G.limit, m.sec || elapsed()));
      const time = Math.max(0, 350 - Math.floor(sec * 350 / G.limit));
      const eff = Math.round(150 * Math.min(1, m.min / Math.max(1, m.moves)));
      const extra = Math.max(0, eff - 30 * m.hints - Math.min(30, 3 * m.peeks));
      return { base:500, time, extra, rows:['명화 완성', '시간 보너스 (' + mmss(sec) + ')', `바꾼 횟수 ${m.moves}번(최소 ${m.min}번) · 힌트 ${m.hints}번`] };
    },
    stars(){
      const m = G.j;
      return m.moves <= m.min * 1.6 + 3 && m.hints === 0 ? 3 : m.moves <= m.min * 2.6 + 5 && m.hints <= 1 ? 2 : 1;
    },
    starGoal(){
      const m = G && G.j; if(!m) return [];
      const lim = Math.floor(m.min * 1.6 + 3);
      return [{ s:3, text:`${lim}번 안에 바꾸고 · 힌트 없이`, ok:() => m.moves <= lim && m.hints === 0 }];
    },
    recMoves(){ return G && G.j ? G.j.moves : null; },
    /* 대전: 같은 명화·같은 섞임에서 누가 먼저 완성하나(경주). 막대 = 제자리에 맞춘 조각 수 */
    duelPace:[110, .92],
    duelStat:{ unit:'조각', get:() => ({ v:G.j.placed, t:totalOf(G.j) }) },
    duelAvoidKey:() => (G && G.id === 'jigsaw' && G.j ? G.j.art : null),
    css:`
    .ng-jig{display:flex; flex-direction:column; align-items:center; width:100%}
    .ng-jig .hud-row{width:100%}
    .jg-tbar{margin:0 0 6px}
    .jg-tbar.hurry > i{background:linear-gradient(90deg,#FF7A6B,#E83B3B)}
    .jg-msg{min-height:22px; margin:0 0 8px; font-size:14px; line-height:1.4; text-align:center; color:#FFF3D0}
    .jg-msg b{font-weight:800}
    .jg-msg b.bad{color:#FF8A7A}
    .jg-msg span{margin-left:6px; opacity:.8}
    .jg-msg.jg-win{animation:jgWin .5s ease-out}
    @keyframes jgWin{0%{transform:scale(.9)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
    .jg-wrap{--jgs:340px; position:relative; width:var(--jgs); max-width:100%; aspect-ratio:1}
    .jg-board{position:absolute; inset:0; display:grid; grid-template-columns:repeat(var(--n),1fr); grid-template-rows:repeat(var(--n),1fr); gap:3px; padding:6px; box-sizing:border-box; touch-action:none; user-select:none; -webkit-user-select:none;
      background:linear-gradient(135deg,#B27A14,#E8B84A 45%,#9A6508); border:3px solid #1A0F45; border-radius:10px; box-shadow:0 6px 0 rgba(26,15,69,.28), inset 0 0 0 2px rgba(255,236,170,.55); transition:gap .5s, padding .5s}
    .jg-p{position:relative; background-color:var(--artc,#8A6A3A); background-image:var(--art); background-repeat:no-repeat; background-size:calc(var(--n) * 100%) calc(var(--n) * 100%); background-position:var(--bx) var(--by);
      border-radius:3px; box-shadow:0 0 0 1px rgba(26,15,69,.55), inset 0 0 0 1px rgba(255,255,255,.18); cursor:pointer; outline:none; -webkit-tap-highlight-color:transparent; will-change:transform}
    .jg-wrap:not(.ready) .jg-p{background-image:none; animation:jgShim 1s ease-in-out infinite alternate}
    @keyframes jgShim{from{opacity:.55}to{opacity:.9}}
    .jg-wrap.noimg .jg-p{background-image:linear-gradient(135deg,var(--artc),#1A0F45)}
    .jg-no{position:absolute; left:3px; top:2px; font-size:11px; font-weight:800; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.8); opacity:0; pointer-events:none}
    .jg-wrap.noimg .jg-no{opacity:1; font-size:18px; left:50%; top:50%; transform:translate(-50%,-50%)}
    .jg-p:focus-visible{box-shadow:0 0 0 3px #6C3CE0}
    .jg-p.sel{z-index:3; transform:scale(1.08); box-shadow:0 0 0 3px #FFC93C, 0 8px 18px rgba(26,15,69,.5)}
    .jg-p.aim{box-shadow:0 0 0 3px #4DD6FF, 0 0 14px rgba(77,214,255,.8)}
    .jg-p.drag{z-index:5; transition:none!important; box-shadow:0 0 0 3px #FFC93C, 0 12px 22px rgba(26,15,69,.55); cursor:grabbing}
    .jg-p.ok{cursor:default; box-shadow:0 0 0 1px rgba(255,226,122,.7)}
    .jg-p.pop{animation:jgPop .45s ease-out}
    @keyframes jgPop{0%{transform:scale(1.18); filter:brightness(1.5)}100%{transform:scale(1); filter:none}}
    .jg-p.nope{animation:jgNope .25s}
    @keyframes jgNope{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
    .jg-board.done{gap:0; padding:3px}
    .jg-board.done .jg-p{border-radius:0; box-shadow:none; transform:scale(1.012)}
    .jg-peek{position:absolute; inset:0; z-index:8; display:flex; align-items:center; justify-content:center; background:#1A0F45; border:3px solid #1A0F45; border-radius:10px; overflow:hidden; cursor:pointer; opacity:0; transition:opacity .18s}
    .jg-peek[hidden]{display:none}
    .jg-peek.on{opacity:1}
    .jg-peek img{width:100%; height:100%; object-fit:cover; display:block}
    .jg-peek span{position:absolute; bottom:8px; left:50%; transform:translateX(-50%); padding:3px 12px; border-radius:99px; background:rgba(26,15,69,.75); color:#fff; font-size:12px; white-space:nowrap}
    .jg-tools{margin-top:10px; display:flex; gap:8px; justify-content:center}
    .jg-look{display:flex; align-items:center; gap:8px; height:46px; padding:0 18px; border:3px solid #1A0F45; border-radius:14px; background:#FFF8EA; color:#2A1F5C; font:inherit; font-size:15px; font-weight:800; cursor:pointer; box-shadow:0 3px 0 rgba(26,15,69,.3)}
    .jg-look:active{transform:translateY(2px); box-shadow:0 1px 0 rgba(26,15,69,.3)}
    .jg-look svg{width:22px; height:22px}
    body.big .jg-msg{font-size:16px} body.big .jg-look{font-size:17px}
    @media (prefers-reduced-motion:reduce){ .jg-p.pop,.jg-msg.jg-win,.jg-wrap:not(.ready) .jg-p{animation:none} .jg-board{transition:none} }
    `,
    sounds:{
      jgPick(){ aTone({ f:700, f2:980, type:'triangle', d:.07, v:.07, bus:'ui' }); },
      jgSwap(){ aTone({ f:380, f2:560, type:'triangle', d:.09, v:.08 }); aNoise({ ft:'highpass', f:3000, d:.04, v:.03 }); },
      jgLock(o){ const n = Math.min(10, o.n || 0); aBell({ f:penta(n % 7 + 5, 72), t:0, d:.5, v:.09, idx:1.3, rev:.3 }); aBell({ f:penta(n % 7 + 7, 72), t:.07, d:.6, v:.06, idx:1.1, rev:.35 }); },
      jgHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      jgTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      jgTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ jgTick:250, jgSwap:60, jgLock:60 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); [79, 84, 88, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();
