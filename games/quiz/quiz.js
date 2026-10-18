/* ===== 두뇌 퀴즈쇼 (quiz) · 기획 docs/28_퀴즈쇼_법무검토.md =====
   "여기서 노는 시간, 머리가 깨어나는 시간" 캠페인용 퀴즈. 아이·어른이 같이 푸는 4지선다.
   - 한 판 = 문제 N개. 종류: 멜로디(게임이 직접 연주) · 추억 간식(상표 가리고 힌트) · 그림 속담 · 옛 인물 힌트.
   - 문제마다 제한 시간. 힌트형(간식·인물)은 시간이 지날수록 힌트가 하나씩 열리고, 빨리 맞힐수록 점수가 높다.
   - 문제 내용·보기 순서는 rng로만(같은 씨앗 = 전 국민 같은 문제). 문제 은행은 quiz-bank.js(QZ_BANK). */
NG.quiz = (() => {
  const CATS = ['mel', 'snack', 'emoji', 'person'];
  const CAT = {
    mel:{ name:'멜로디', tag:'🎵 멜로디 듣고 맞히기', q:'이 멜로디의 곡 제목은?', col:'#7C5CFF' },
    snack:{ name:'추억 간식', tag:'🍦 상표 가리고 맞히기', q:'상표를 가렸어요. 이 간식은?', col:'#FF8A3D' },
    emoji:{ name:'그림 속담', tag:'🧩 그림 보고 속담', q:'그림이 말하는 속담은?', col:'#22A57A' },
    person:{ name:'옛 인물', tag:'📜 힌트로 인물 맞히기', q:'이 사람은 누구일까요?', col:'#3D7BE0' }
  };
  const BEAT = .32;
  const el = id => document.getElementById(id);
  const fx = f => { try{ f(); }catch(_){} };
  let UID = 0;

  /* ---------- 판 만들기(rng만, 순서 중요: 종류 순서 → 문제 고르기 → 보기 섞기) ---------- */
  function gen(cfg, rng){
    const N = cfg.N, mix = cfg.mix || CATS, order = [];
    for(let i = 0; i < N; i++) order.push(mix[i % mix.length]);
    shuffle(order, rng);
    const used = {}, Q = [];
    for(const c of order){
      const bank = QZ_BANK[c], left = bank.map((_, i) => i).filter(i => !(used[c] || []).includes(i));
      const pick = left[Math.floor(rng() * left.length)];
      used[c] = (used[c] || []).concat(pick);
      const item = bank[pick];
      /* 보기: 같은 종류에서 3개(간식은 같은 분류를 먼저) */
      let pool = bank.filter((x, i) => i !== pick);
      if(c === 'snack'){ const same = pool.filter(x => x.k === item.k); if(same.length >= 3) pool = same; }
      const wrong = shuffle(pool.slice(), rng).slice(0, 3).map(x => x.a);
      const ch = shuffle([item.a].concat(wrong), rng);
      Q.push({ c, item, ch, ans:ch.indexOf(item.a) });
    }
    return Q;
  }
  function stageCfg(n){
    const c = Math.ceil(n / 10), k = n - (c - 1) * 10, focus = CATS[(c - 1) % 4];
    const N = Math.min(12, 6 + Math.floor((c - 1) / 2) + (k >= 5 ? 1 : 0) + (k === 10 ? 2 : 0));
    const sec = Math.max(9, 18 - (c - 1) * 1.2 - (k === 10 ? 2 : 0));
    const mix = c >= 5 ? CATS : [focus, focus, focus].concat(CATS.slice(0, Math.min(4, c)).filter(x => x !== focus));
    return { N, sec, mix, boss:k === 10 };
  }

  /* ---------- 그림 ---------- */
  function snackSvg(sh, col){
    const u = 'qzs' + (++UID), dk = 'rgba(40,20,10,.25)';
    const body = {
      bar:`<rect x="60" y="18" width="40" height="74" rx="18" fill="${col}"/><rect x="74" y="88" width="12" height="30" rx="5" fill="#E8D2A6"/>`,
      twin:`<rect x="46" y="18" width="68" height="70" rx="16" fill="${col}"/><path d="M80 18V88" stroke="${dk}" stroke-width="4"/><rect x="56" y="84" width="10" height="32" rx="5" fill="#E8D2A6"/><rect x="94" y="84" width="10" height="32" rx="5" fill="#E8D2A6"/>`,
      twist:`<path d="M66 20Q96 32 66 46Q96 58 66 72Q96 84 70 94H90" fill="none" stroke="${col}" stroke-width="22" stroke-linecap="round"/><rect x="74" y="92" width="12" height="28" rx="5" fill="#E8D2A6"/>`,
      cone:`<path d="M58 54L80 118L102 54Z" fill="#E9B872"/><path d="M62 62L98 62M66 76L94 76M70 90L90 90" stroke="${dk}" stroke-width="3"/><circle cx="80" cy="46" r="26" fill="${col === '#E9B872' ? '#F7F0E2' : col}"/><circle cx="72" cy="36" r="8" fill="#7A4A2E"/>`,
      round:`<ellipse cx="80" cy="72" rx="52" ry="30" fill="${col}"/><ellipse cx="80" cy="62" rx="46" ry="20" fill="#fff" opacity=".18"/>`,
      chunk:`<g fill="${col}"><circle cx="58" cy="70" r="16"/><circle cx="82" cy="60" r="18"/><circle cx="104" cy="74" r="15"/><circle cx="78" cy="84" r="14"/></g><g fill="#FFF3D6"><circle cx="60" cy="64" r="3"/><circle cx="86" cy="54" r="3"/><circle cx="100" cy="70" r="3"/></g>`,
      stick:`<g fill="${col}"><rect x="34" y="50" width="56" height="16" rx="8" transform="rotate(-14 62 58)"/><rect x="70" y="66" width="56" height="16" rx="8" transform="rotate(10 98 74)"/><rect x="46" y="84" width="56" height="16" rx="8" transform="rotate(-4 74 92)"/></g>`,
      sticks:`<g>${[44, 62, 80, 98, 116].map((x, i) => `<rect x="${x - 4}" y="${22 + i % 2 * 6}" width="8" height="90" rx="4" fill="#E8C98A"/><rect x="${x - 5}" y="${22 + i % 2 * 6}" width="10" height="60" rx="5" fill="${col}"/>`).join('')}</g>`,
      cones:`<g fill="${col}">${[[52, 80], [80, 64], [108, 84], [76, 96]].map(([x, y]) => `<path d="M${x - 12} ${y + 14}L${x} ${y - 16}L${x + 12} ${y + 14}Z"/>`).join('')}</g>`,
      ball:`<g fill="${col}">${[[56, 66], [84, 58], [108, 72], [70, 88], [98, 92]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13"/>`).join('')}</g>`,
      ring:`<g fill="none" stroke="${col}" stroke-width="11">${[[58, 64], [100, 62], [80, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16"/>`).join('')}</g>`,
      fish:`<path d="M30 70Q70 30 112 70Q70 110 30 70Z" fill="${col}"/><path d="M110 70L136 50V90Z" fill="${col}"/><circle cx="52" cy="64" r="5" fill="#3A2416"/>`,
      jar:`<rect x="66" y="18" width="28" height="16" rx="4" fill="#E9E2CF"/><path d="M62 34H98Q122 56 112 96Q104 116 80 116Q56 116 48 96Q38 56 62 34Z" fill="${col}"/>`
    }[sh] || `<circle cx="80" cy="70" r="40" fill="${col}"/>`;
    return `<svg viewBox="0 0 160 130" class="qz-snack" role="img" aria-label="상표를 가린 간식 그림"><defs><radialGradient id="${u}" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#FFFDF5"/><stop offset="1" stop-color="#FFE9C7"/></radialGradient></defs>
      <rect width="160" height="130" rx="18" fill="url(#${u})"/>${body}
      <g transform="translate(108 8) rotate(12)"><rect width="46" height="22" rx="5" fill="#1A0F45"/><text x="23" y="15.5" font-size="11" font-weight="800" fill="#fff" text-anchor="middle">상표 ?</text></g></svg>`;
  }

  /* ---------- 진행 ---------- */
  const S = () => G && G.id === 'quiz' ? G.m : null;
  function T(f, ms){ const m = S(); if(!m) return; const t = setTimeout(() => { m.timers.delete(t); if(!m.dead) f(); }, ms); m.timers.add(t); }
  function playMel(q){
    if(!q || q.c !== 'mel') return;
    const notes = q.item.n.slice(0, 12);
    sfx('qzMel', { notes });
    const m = S(); if(m){ m.played = (m.played || 0) + 1; const b = el('qzPlay'); if(b) fx(() => { b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }); }
  }
  function hintsShown(m){ const q = m.Q[m.i]; if(!q || !q.item.h) return 0; const r = m.t / m.sec; return r < 1 / 3 ? 1 : r < 2 / 3 ? 2 : 3; }
  function drawQ(){
    const m = S(); if(!m) return; const q = m.Q[m.i], C = CAT[q.c];
    el('qzCnt').textContent = m.i + 1; el('qzPts').textContent = fmt(m.pts);
    el('qzTag').textContent = C.tag; el('qzTag').style.background = C.col;
    el('qzAsk').textContent = C.q;
    let body = '';
    if(q.c === 'mel') body = `<button class="qz-play" id="qzPlay" aria-label="멜로디 다시 듣기"><span>▶</span><b>다시 듣기</b></button><p class="qz-sub">소리가 안 나면 음량을 켜 주세요</p>`;
    else if(q.c === 'snack') body = `${snackSvg(q.item.sh, q.item.c)}<ol class="qz-hints" id="qzHints"></ol><p class="qz-legal">상표는 각 회사의 것이며 이 퀴즈와 제휴 관계가 없어요</p>`;
    else if(q.c === 'emoji') body = `<div class="qz-emoji" aria-label="속담 그림">${esc(q.item.e)}</div>`;
    else body = `<div class="qz-person" aria-hidden="true">?</div><ol class="qz-hints" id="qzHints"></ol>`;
    el('qzBody').innerHTML = body;
    el('qzBtns').innerHTML = q.ch.map((t, i) => `<button class="qz-b" data-i="${i}"><i>${'ABCD'[i]}</i><span>${esc(t)}</span></button>`).join('');
    el('qzBtns').querySelectorAll('.qz-b').forEach(b => b.onclick = () => pick(+b.dataset.i));
    const pb = el('qzPlay'); if(pb) pb.onclick = () => playMel(q);
    m.hs = 0; updHints(true);
    if(q.c === 'mel') T(() => playMel(q), 250);
  }
  function updHints(force){
    const m = S(); if(!m) return; const q = m.Q[m.i]; if(!q || !q.item.h) return;
    const n = m.lock ? 3 : hintsShown(m); if(n === m.hs && !force) return;
    m.hs = n; const ol = el('qzHints'); if(!ol) return;
    ol.innerHTML = q.item.h.map((h, i) => `<li class="${i < n ? 'on' : ''}">${i < n ? esc(h) : '힌트 ' + (i + 1) + ' · 곧 열려요'}</li>`).join('');
    if(n > 1 && !force) sfx('qzHint');
  }
  function pick(i){
    const m = S(); if(!m || m.lock || m.done || G.paused) return;
    const q = m.Q[m.i], ok = i === q.ans, left = Math.max(0, 1 - m.t / m.sec);
    m.lock = true;
    /* 힌트형은 열린 힌트 수에 따라 점수 배율(1개 1.0 · 2개 .8 · 3개 .6), 나머지는 남은 시간 */
    const hint = q.item.h ? [1, 1, .8, .6][hintsShown(m)] : 1;
    const got = ok ? Math.round(60 + 40 * left * hint) : 0;
    m.res.push({ ok, left:ok ? left * hint : 0 });
    if(ok){ m.ok++; m.pts += got; m.combo++; sfx('qzOk', { n:m.combo }); } else { m.wrong++; m.combo = 0; sfx('qzBad'); }
    updHints(true);
    el('qzBtns').querySelectorAll('.qz-b').forEach((b, k) => { b.disabled = true; if(k === q.ans) b.classList.add('ans'); else if(k === i) b.classList.add('no'); });
    el('qzPts').textContent = fmt(m.pts);
    const msg = el('qzMsg'); msg.textContent = ok ? (m.combo >= 3 ? `${m.combo}연속 정답! +${got}` : `정답! +${got}`) : (i < 0 ? '시간 끝!' : '아쉬워요') + ' · 정답: ' + q.item.a;
    msg.className = 'qz-msg on ' + (ok ? 'good' : 'bad');
    fx(() => { if(ok){ const b = el('qzBtns').children[q.ans].getBoundingClientRect(); fxBurst && fxBurst(b.left + b.width / 2, b.top + b.height / 2, CAT[q.c].col); } });
    T(next, ok ? 900 : 1500);
  }
  function next(){
    const m = S(); if(!m) return;
    el('qzMsg').className = 'qz-msg';
    m.i++; m.t = 0; m.lock = false;
    if(m.i >= m.N){ m.done = true; sfx('qzEnd'); T(() => finish(m.ok >= Math.ceil(m.N / 2)), 400); return; }
    drawQ();
  }
  function loop(ts){
    const m = S(); if(!m || m.dead) return;
    const dt = m.lt ? Math.min(.1, (ts - m.lt) / 1000) : 0; m.lt = ts;
    if(!G.paused && !m.lock && !m.done){
      m.t += dt;
      const r = Math.max(0, 1 - m.t / m.sec), bar = el('qzBar');
      if(bar){ bar.style.transform = `scaleX(${r})`; bar.className = 'qz-bar' + (r < .25 ? ' red' : r < .5 ? ' yel' : ''); }
      updHints(false);
      if(m.t >= m.sec) pick(-1);
    }
    G.raf = requestAnimationFrame(loop);
  }

  return {
    name:'두뇌 퀴즈쇼', abil:'추리력', col:['#D9CCFF', '#7C5CFF', '#3E2A99'], time:'약 2분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.2 15.6a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm1.6-5.3c-.8.5-1 .8-1 1.5v.4h-2v-.5c0-1.4.6-2.1 1.6-2.7.8-.5 1.1-.8 1.1-1.4 0-.7-.6-1.2-1.4-1.2-.9 0-1.5.5-1.6 1.4H8.4C8.5 7.7 9.9 6.4 12.2 6.4c2.1 0 3.6 1.2 3.6 2.9 0 1.3-.7 2.2-2 3z"/></svg>',
    art(){
      const u = 'qzA' + (++UID);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B1C6E"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u})"/>
        <g fill="#FFE27A" opacity=".85">${[[18, 18], [140, 22], [30, 82], [132, 80], [80, 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('')}</g>
        <rect x="34" y="26" width="92" height="50" rx="12" fill="#fff"/><text x="80" y="62" text-anchor="middle" font-size="34" font-weight="900" fill="#7C5CFF">?</text>
        <text x="24" y="58" font-size="22">🎵</text><text x="120" y="58" font-size="22">🍦</text></svg>`;
    },
    help:[
      ['4개 중 하나를 골라요', '멜로디·추억 간식·그림 속담·옛 인물 문제가 섞여 나와요. 아래 보기 4개 중 정답을 눌러요.'],
      ['빨리 맞히면 점수가 커요', '문제마다 시간 막대가 줄어요. 남은 시간이 많을수록 점수가 커요.'],
      ['힌트는 점점 열려요', '간식·인물 문제는 시간이 지나면 힌트가 하나씩 더 열려요. 힌트를 적게 보고 맞힐수록 점수가 커요.'],
      ['멜로디는 직접 연주해요', '게임이 음표로 직접 연주해요. 다시 듣기를 눌러 몇 번이고 들을 수 있어요.']
    ],
    howto:{ lines:['멜로디·간식·속담·인물 4지선다', '빨리 맞힐수록 점수가 커요', '힌트는 시간이 지나면 열려요'] },
    chapters:['추억의 멜로디', '추억의 간식', '그림 속담', '옛 인물', '종합 퀴즈쇼'],
    starRule:'★ 절반 이상 정답 · ★★ 틀린 문제 2개 이하 · ★★★ 모두 정답',
    concepts:{ fixed:[
      { at:11, key:'snack', name:'상표 가린 간식', desc:'모양과 힌트만 보고 추억의 과자·아이스크림을 맞혀요.' },
      { at:21, key:'emoji', name:'그림 속담', desc:'그림 기호를 보고 어떤 속담인지 맞혀요.' },
      { at:31, key:'person', name:'옛 인물', desc:'힌트 3개로 역사 속 인물을 맞혀요.' }
    ] },
    levels:{
      easy:{ N:6, sec:20, limit:0 },
      normal:{ N:8, sec:15, limit:0 },
      hard:{ N:10, sec:12, limit:0 }
    },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `문제 ${c.N}개 · 문제당 ${c.sec}초`; },
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `문제 ${c.N}개 · 문제당 ${Math.round(c.sec)}초${c.boss ? ' · 대장 판' : ''}`; },
    init(cfg, rng){
      const Q = gen(cfg, rng);
      G.m = { Q, N:Q.length, i:0, t:0, sec:cfg.sec || 15, lt:0, ok:0, wrong:0, pts:0, combo:0, res:[], hs:0, lock:false, done:false, boss:!!cfg.boss, timers:new Set() };
      const m = G.m;
      G.cleanup = () => { m.dead = true; m.timers.forEach(clearTimeout); m.timers.clear(); if(G && G.raf) cancelAnimationFrame(G.raf); };
    },
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-quiz${m.boss ? ' boss' : ''}">
        <div class="hud-row">
          <div class="hchip"><span class="hv"><b id="qzCnt">1</b><small>/${m.N}</small></span><em>문제</em></div>
          <div class="hchip"><span class="hv"><b id="qzPts">0</b></span><em>점수</em></div>
        </div>
        <div class="qz-card">
          <span class="qz-tag" id="qzTag"></span>
          <h3 class="qz-ask" id="qzAsk"></h3>
          <div class="qz-body" id="qzBody"></div>
          <div class="qz-time" aria-hidden="true"><i class="qz-bar" id="qzBar"></i></div>
          <div class="qz-msg" id="qzMsg" role="status" aria-live="polite"></div>
        </div>
        <div class="qz-btns" id="qzBtns"></div>
      </div>`;
      drawQ();
      m.lt = 0; if(G.raf) cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = S(); return m && m.N ? m.res.length / m.N : 0; },
    lossText(){ const m = G.m; return `${m.N}문제 중 ${m.ok}문제를 맞혔어요. 절반 넘게 맞히면 성공!`; },
    score(){
      const m = G.m, N = m.N || 1;
      const base = Math.round(600 * m.ok / N);
      const time = Math.round(300 * m.res.reduce((s, r) => s + r.left, 0) / N);
      const extra = m.wrong === 0 ? 100 : 0;
      return { base, time, extra, rows:[`정답 ${m.ok}/${m.N}`, '빠르게·힌트 적게 맞힌 보너스', m.wrong === 0 ? '모두 정답 보너스' : '모두 정답 보너스 없음'] };
    },
    stars(){ const w = G.m.wrong; return w === 0 ? 3 : w <= 2 ? 2 : 1; },
    sounds:{
      qzMel(o){ let t = 0; (o.notes || []).forEach(([mi, b]) => { aMarimba(m2f(mi), { t, d:Math.max(.25, b * BEAT * 1.4), v:.2 }); t += b * BEAT; }); },
      qzOk(o){ const n = Math.min(10, o.n || 1); aMarimba(m2f(72 + n), { v:.17 }); aMarimba(m2f(76 + n), { t:.07, v:.14 }); aMarimba(m2f(79 + n), { t:.14, v:.12 }); },
      qzBad(){ aTone({ f:220, f2:160, type:'triangle', d:.25, v:.08 }); },
      qzHint(){ aBell({ f:m2f(84), d:.4, v:.05, rev:.3 }); },
      qzEnd(){ [0, 4, 7, 12].forEach((s, i) => aMarimba(m2f(67 + s), { t:i * .08, v:.14 })); }
    },
    gate:{ qzHint:300 },
    _gen:gen, _stage:stageCfg,
    _test:{ state(){ const m = S(); if(!m) return null; const q = m.Q[m.i]; return { i:m.i, N:m.N, c:q && q.c, ans:q && q.ans, ok:m.ok, lock:m.lock }; }, pick:i => pick(i) }
  };
})();

/* 대전: 같은 문제 · 모두 끝나면 점수가 높은 쪽 승(점수전) */
Object.assign(NG.quiz, { duelKind:'score', duelMax:4, duelEnd:'all', duelPace:[80, .8],
  duelStat:{ unit:'점', score:true, get:() => ({ v:G.m ? G.m.pts : 0, t:G.m ? G.m.N : 8, mis:G.m ? G.m.wrong : 0 }) },
  duelAi(rng, o){
    const acc = .45 + rng() * .5, N = 8, ok = acc >= .5, T = 70 * (.7 + rng() * .6) * (o && o.pace === 's' ? 1.5 : 1);
    const pts = Math.round(N * acc * (60 + 40 * (.3 + rng() * .4)));
    return { ok, T, pts, sc:ok ? Math.round(600 * acc + 300 * acc * .5 + (acc > .99 ? 100 : 0)) : 0, fail:.5 + rng() * .4 };
  },
  duelHow:'같은 문제 · 모두 끝나면 점수가 높은 사람이 이겨요 (최대 4명)' });
NG.quiz.scene = { kind:'stars', colors:['#FFE27A', '#D9CCFF', '#FFFFFF'], density:.5, alpha:.5 };
