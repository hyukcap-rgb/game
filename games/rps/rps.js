/* ===== 가위바위보 지령 (rps) · 순발력 · 기획서 docs/20_순발력5종_기획.md 2-5 =====
   진행자(챕터 캐릭터)가 손을 내밀고, 지령 판(이겨라·져라·비겨라)에 맞는 내 손을 고르는 게임.
   - 한 판 = 지령 N개(시간이 아니라 개수로 끝남). 지령마다 판단 시간(창)이 있고 뒤로 갈수록 짧아진다.
   - 기회 3개(별). 틀리거나 시간이 지나면 1개씩 줄고 0이면 실패. N개를 다 하면 성공.
   - 모든 지령은 글자 + 그림(왕관·눈물·악수, 모양까지 서로 다름)으로 보인다. 소리는 덤.
   - 문제 내용은 rng로만(같은 씨앗 = 같은 손·같은 지령·같은 버튼 순서). */
NG.rps = (() => {
  const HN = ['가위', '바위', '보'];                 /* 손 번호: 0 가위 · 1 바위 · 2 보 */
  const winOf = h => (h + 1) % 3, loseOf = h => (h + 2) % 3;
  const targetOf = (t, h) => t === 'win' ? winOf(h) : t === 'lose' ? loseOf(h) : h;
  const ansOf = (t, not, h) => { const g = targetOf(t, h); return not ? [0, 1, 2].filter(x => x !== g) : [g]; };
  const OD = {   /* 지령 모양·색(색 + 모양 + 글자 셋 다 다르게: 색약 배려) */
    win:{ txt:'이겨라!', not:'이기지 마라!', col:'#22A559', ink:'#0F6B36', lite:'#E6F8EC' },
    lose:{ txt:'져라!', not:'지지 마라!', col:'#E5484D', ink:'#A3202A', lite:'#FFE9EA' },
    draw:{ txt:'비겨라!', not:'비기지 마라!', col:'#F5B400', ink:'#7A5200', lite:'#FFF6D6' },
    last:{ txt:'아까처럼!', col:'#8A5CF0', ink:'#4E2BB8', lite:'#F1EAFF' }
  };
  const HOSTS = ['dog', 'cat', 'bear', 'rabbit', 'tiger'];
  const HOST_COL = { dog:'#C98A48', cat:'#7E88A8', bear:'#A0612C', rabbit:'#A86BE8', tiger:'#FF8A1A' };
  const HOST_LINE = {
    dog:['멍! 지령 잘 봐!', '천천히, 정확하게!'], cat:['냥, 눈 크게 떠!', '함정 조심해냥'], bear:['곰곰이 생각해!', '서두르지 마!'],
    rabbit:['깡총, 준비됐지?', '헷갈려도 침착!'], tiger:['어흥! 마지막 시험!', '진짜 실력을 봐야지']
  };
  /* 챕터마다 노을 빛(차분하게: 강한 대비 없음) [하늘 위, 하늘 가운데, 지평선, 땅, 실루엣] */
  const PAL = [
    ['#7C6AB8', '#E99A8A', '#FFD3A6', '#E7B98E', '#6B4F86'],
    ['#6F7FC2', '#E8A47C', '#FFDDA0', '#D9C08A', '#5E5288'],
    ['#8B66B8', '#EB93A8', '#FFD0B8', '#E4B4A6', '#6D4A8C'],
    ['#4F72A8', '#C99AA6', '#FFD7B0', '#CDB49A', '#3F4F7E'],
    ['#6A4FA8', '#D98A86', '#FFCE8E', '#DDB07E', '#4E3A7E']
  ];
  const COMBO_TXT = { 5:'좋아요!', 10:'대단해요!', 20:'완벽해요!', 30:'완벽해요!' };
  const W_FLOOR = .9;

  /* ---------- 그림: 3D 비닐 장난감 질감 장갑 손(공용 TOY 필터 재사용, 외곽선 없음) ---------- */
  /* 둥근 막대(손가락): 선(stroke)은 필터 영역 계산에 안 들어가 잘리므로 회전한 둥근 사각형으로 그린다 */
  const L = (x1, y1, x2, y2, w, c) => { const len = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    return `<rect x="${(-len / 2 - w / 2).toFixed(2)}" y="${-w / 2}" width="${(len + w).toFixed(2)}" height="${w}" rx="${w / 2}" fill="${c}" transform="translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${a.toFixed(2)})"/>`; };
  const R = (x, y, w, h, r, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
  const fg = (f, s) => `<g filter="url(#${f})">${s}</g>`;
  function handBody(h, glove, cuff, dk){
    const gl = TOY.GL, tip = (x, y) => gl(x, y, 3.2, 3.2, 0);
    /* 소매: 둥근 밴드 + 위 테두리 밝은 줄 + 아래 골 한 줄(납작한 회색 받침처럼 보이지 않게) */
    const cf = fg('pm', R(28, 78, 44, 20, 9, cuff)) + `<rect x="31" y="80.5" width="38" height="3.6" rx="1.8" fill="#fff" opacity=".3"/><rect x="31" y="90.5" width="38" height="2.2" rx="1.1" fill="#1A0F45" opacity=".14"/>` + gl(41, 86, 8, 2.2, 0);
    if(h === 1){   /* 바위: 꽉 쥔 주먹(접힌 손가락 4개 + 앞으로 감싼 엄지) */
      return cf + fg('pb', R(19, 32, 62, 54, 25, glove)) + gl(34, 46, 10, 6)
        + [28, 42.5, 57, 71].map(x => fg('pm', R(x - 7.6, 22, 15.2, 30, 7.6, glove))).join('')
        + [28, 42.5, 57, 71].map(x => tip(x - 2.5, 28)).join('')
        + fg('pm', `<path d="M23 62Q24 54 34 55L55 54Q62 55 61 61Q60 67 53 67L30 69Q23 69 23 62Z" fill="${dk}"/>`) + tip(30, 59);
    }
    if(h === 0){   /* 가위: 두 손가락 V(검지·중지) + 접힌 약지·소지 + 엄지 */
      return cf + fg('pm', L(40, 52, 29, 12, 16, glove)) + fg('pm', L(58, 52, 70, 12, 16, glove))
        + tip(27, 15) + tip(68, 15)
        + fg('pb', R(21, 44, 58, 42, 20, glove)) + gl(34, 56, 9, 5)
        + fg('pm', R(48, 40, 15, 21, 7.5, glove)) + fg('pm', R(62, 44, 13.5, 18, 6.7, glove)) + tip(53, 45) + tip(66, 49)
        + fg('pm', `<path d="M25 66Q26 60 34 60L52 59Q58 60 57 65Q56 70 50 70L32 72Q25 72 25 66Z" fill="${dk}"/>`);
    }
    /* 보: 쫙 편 손(손가락 4개 + 옆으로 벌린 엄지) */
    return cf + fg('pm', L(33, 50, 24, 15, 14, glove)) + fg('pm', L(45, 47, 42, 7, 14, glove)) + fg('pm', L(57, 47, 61, 8, 14, glove)) + fg('pm', L(68, 52, 78, 21, 13, glove))
      + tip(22.5, 17) + tip(40.5, 10) + tip(59.5, 11) + tip(76, 23)
      + fg('pb', R(22, 42, 56, 44, 21, glove)) + gl(36, 55, 10, 6)
      + fg('pm', L(32, 67, 11, 50, 15, dk)) + tip(12, 50);
  }
  const HSRC = {};
  let GLOVE = ['#FFF0DF', '#FCDDBC'];   /* 장갑 색 [밝은, 엄지·접힌 손가락] */
  function handSrc(h, cuff, sh){
    const key = h + cuff + (sh ? 's' : '') + GLOVE.join();
    if(HSRC[key]) return HSRC[key];
    const body = (sh ? `<ellipse cx="50" cy="97" rx="26" ry="3.2" fill="url(#gs)"/>` : '') + handBody(h, GLOVE[0], cuff, GLOVE[1]);
    return HSRC[key] = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${TOY.DEFS}</defs>${body}</svg>`).replace(/'/g, '%27');
  }
  /* 지령 메달: 모양이 지령마다 다름(왕관 = 꽃 테두리 원, 눈물 = 아래가 뾰족한 방패, 악수 = 마름모, 아까처럼 = 점선 원) */
  function rosette(cx, cy, r, n, a){ let d = ''; for(let i = 0; i < n * 2; i++){ const t = Math.PI * i / n - Math.PI / 2, rr = i % 2 ? r - a : r; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(t)).toFixed(1) + ' ' + (cy + rr * Math.sin(t)).toFixed(1); } return d + 'Z'; }
  const MED_SHAPE = {
    win:c => `<path d="${rosette(30, 30, 28.5, 12, 4)}" fill="${c}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>`,
    lose:c => `<path d="M7 9Q7 5 11 5H49Q53 5 53 9V29Q53 47 30 57Q7 47 7 29Z" fill="${c}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>`,
    draw:c => `<rect x="11" y="11" width="38" height="38" rx="8" transform="rotate(45 30 30)" fill="${c}" stroke="#fff" stroke-width="2.5"/>`,
    last:c => `<circle cx="30" cy="30" r="27" fill="${c}"/><circle cx="30" cy="30" r="23.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="5 4"/>`,
    wait:c => `<circle cx="30" cy="30" r="27" fill="${c}"/>`
  };
  const MED_ICON = {
    win:`<path d="M17 40L15 21L23.5 28L30 17L36.5 28L45 21L43 40Z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><rect x="17" y="41.5" width="26" height="5" rx="2" fill="#fff"/><circle cx="30" cy="33" r="2.6" fill="#22A559"/>`,
    lose:`<path d="M30 13C30 13 41 26 41 33.5A11 11 0 0 1 19 33.5C19 26 30 13 30 13Z" fill="#fff"/><ellipse cx="25.5" cy="33" rx="2.4" ry="4" fill="#E5484D" opacity=".35"/>`,
    draw:`<rect x="10.5" y="25" width="8" height="13" rx="2.5" fill="#fff"/><rect x="41.5" y="25" width="8" height="13" rx="2.5" fill="#fff"/><path d="M18 27Q24 22 31 25L41 28V37Q35 42 28 40L18 36Z" fill="#fff"/><path d="M27 31.5l7 3M25 35l6 2.6" stroke="#F5B400" stroke-width="2" stroke-linecap="round"/>`,
    last:`<path d="M39.5 23A12 12 0 1 0 41.5 34" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M33 17L42.5 22.5L36.5 30.5Z" fill="#fff"/>`,
    wait:`<text x="30" y="40" text-anchor="middle" font-family="Jua, sans-serif" font-size="28" fill="#fff">?</text>`
  };
  const NOT_MARK = `<g><circle cx="30" cy="30" r="25" fill="none" stroke="#fff" stroke-width="8"/><path d="M13 47L47 13" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="30" cy="30" r="25" fill="none" stroke="#1A0F45" stroke-width="4.5"/><path d="M13 47L47 13" stroke="#1A0F45" stroke-width="4.5" stroke-linecap="round"/></g>`;
  const medSvg = (k, not) => `<svg viewBox="0 0 60 60" aria-hidden="true">${MED_SHAPE[k](k === 'wait' ? '#B9AFCF' : OD[k].col)}${MED_ICON[k]}${not ? NOT_MARK : ''}</svg>`;
  const ICO = {
    cmd:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="4" fill="#22A559"/><path d="M8 18l-1.5 3.5L11 18" fill="#22A559"/><path d="M8 12.2l2.5 2.3L16 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    combo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6.2z" fill="#FFB020" stroke="#7A4A00" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  };

  /* ---------- 판 만들기(rng만) ---------- */
  function gen(cfg, rng){
    const N = cfg.N, mj = cfg.mj || [], Q = [];
    let prevH = -1, rep = 0, prev = null;
    for(let i = 0; i < N; i++){
      const k = N > 1 ? i / (N - 1) : 0;
      let h = Math.floor(rng() * 3);
      if(h === prevH && rep >= 1) h = (h + 1 + Math.floor(rng() * 2)) % 3;   /* 같은 손 세 번 연속은 피함 */
      rep = h === prevH ? rep + 1 : 0; prevH = h;
      const two = mj.includes('two') && rng() < .55;
      const h2 = two ? (h + 1 + Math.floor(rng() * 2)) % 3 : -1;
      const side = two ? (rng() < .5 ? 0 : 1) : 0;
      const ref = two && side ? h2 : h;
      const trapP = Math.min(.9, (cfg.trap || 0) * (.6 + .8 * k));   /* 한 판 안에서 뒤로 갈수록 함정이 늘어남(평균은 cfg.trap) */
      let t = 'win', not = false, last = false;
      /* 규칙 문제(하지 마라·아까처럼)는 함정과 따로 일정 비율로 나온다(소개 판에서도 충분히 보이게, 뒤로 갈수록 늘어남) */
      const cp = .7 + .6 * k, rc = rng();
      const pNot = mj.includes('not') ? .3 * cp : 0, pLast = mj.includes('last') && prev ? .26 * cp : 0;
      if(rc < pNot){ const r2 = rng(); t = r2 < .5 ? 'win' : r2 < .8 ? 'lose' : 'draw'; not = true; }
      else if(rc < pNot + pLast){ last = true; t = prev.t; not = prev.not; }
      else if(rng() < trapP) t = rng() < .6 ? 'lose' : 'draw';
      const hide = mj.includes('hide') && rng() < .6;
      const perm = cfg.swap ? shuffle([0, 1, 2], rng) : [0, 1, 2];
      let win = (cfg.w0 + (cfg.w1 - cfg.w0) * k) * (not ? 1.15 : 1) * (two ? 1.1 : 1) * (last ? 1.1 : 1);
      win = Math.max(W_FLOOR, +win.toFixed(3));
      Q.push({ h, h2, two, side, ref, t, not, last, hide, perm, win, ans:ansOf(t, not, ref), trap:t !== 'win' || not || last });
      prev = { t, not };
    }
    return Q;
  }
  function stageCfg(n){
    const p = planOf('rps', n), c = p.c, k = p.k;
    const base = 12 + 2 * (c - 1);
    let N = base + Math.round((Math.min(k, 9) - 1) * 6 / 8);
    if(p.boss) N = base + 6 + 6;
    N = Math.min(32, N);
    const dec = Math.pow(.94, Math.min(c - 1, 12));
    const km = p.boss ? .85 : p.hard ? .9 : k === 9 ? 1.15 : (k === 1 || k === 6) ? 1.08 : 1;
    const tm = p.tw === 'flash' ? .85 : 1;
    const w0 = Math.max(1.1, 2.7 * dec * km * tm), w1 = Math.max(W_FLOOR, 2.1 * dec * km * tm);
    let trap = Math.min(.45, .10 + .075 * (c - 1));
    if(p.boss) trap += .10; else if(p.easy) trap = Math.max(.08, trap - .05);
    return { N, w0:+w0.toFixed(2), w1:+w1.toFixed(2), trap:+trap.toFixed(3), mj:p.mj.slice(), tw:p.tw, boss:p.boss, hard:p.hard,
      lives:p.tw === 'tight' ? 2 : 3, swap:p.tw === 'swap', host:HOSTS[(c - 1) % 5], pal:(c - 1) % 5, limit:0 };
  }
  const CONC = {
    order:['hide', 'not', 'two', 'last'],
    info:{
      hide:{ name:'그림 지령', desc:'지령 글자가 사라지고 그림만 나와요. 왕관은 이겨라, 눈물은 져라, 악수는 비겨라!' },
      not:{ name:'하지 마라', desc:'"이기지 마라"는 지거나 비기면 정답이에요. 맞는 손이 두 개! 메달에 금지 표시가 붙어요.' },
      two:{ name:'두 손', desc:'상대가 두 손을 내밀어요. 지령 판의 화살표가 가리키는 쪽 손을 기준으로 내요.' },
      last:{ name:'아까처럼', desc:'"아까처럼!"이 나오면 바로 앞 문제의 지령을 그대로 따라요. 지령을 기억해 두세요!' }
    },
    twists:['flash', 'swap', 'tight'],
    twInfo:{
      flash:{ name:'빠른 판', desc:'판단 시간이 더 짧아요. 침착하게, 하지만 빠르게!' },
      swap:{ name:'자리 바꾸기', desc:'내 손 버튼 세 개의 순서가 지령마다 바뀌어요. 그림과 글자를 보고 눌러요.' },
      tight:{ name:'외줄 타기', desc:'기회가 2개뿐이에요. 실수는 딱 한 번까지!' }
    }
  };
  const RULE_TIP = { hide:'그림 지령: 글자 없이 그림만', not:'하지 마라: 맞는 손이 두 개', two:'두 손: 화살표 쪽 손 기준', last:'아까처럼: 앞 지령 그대로', flash:'빠른 판: 판단 시간이 짧아요', swap:'자리 바꾸기: 버튼 순서가 바뀌어요', tight:'외줄 타기: 기회 2개' };
  const tagName = k => (CONC.info[k] || CONC.twInfo[k] || {}).name || k;

  /* ---------- 진행 ---------- */
  const S = () => G && G.m;
  let UID = 0;
  function T(fn, ms){ const m = S(); if(!m) return; const id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) try{ fn(); }catch(_){} }, ms); m.timers.add(id); }
  const fx = fn => { try{ fn(); }catch(_){} };
  const el = id => document.getElementById(id);

  function hud(){
    const m = S(); if(!m) return;
    const c = el('rpCnt'); if(c) c.textContent = Math.min(m.N, m.i + (m.phase === 'fb' || m.phase === 'end' ? 1 : 0));
    const cb = el('rpCombo'); if(cb) cb.textContent = m.combo;
    const lv = el('rpLives'); if(lv){ lv.innerHTML = '기회 ' + Array.from({ length:m.maxLives }, (_, i) => `<i class="${i < m.lives ? '' : 'off'}${i === m.lives && m.lostAt ? ' lost' : ''}">★</i>`).join(''); lv.setAttribute('aria-label', '남은 기회 ' + m.lives + '개'); }
  }
  function setHost(mood){
    const m = S(), im = el('rpHost'); if(!m || !im) return;
    if(m.mood === mood) return; m.mood = mood;
    im.src = toySrc(m.host, mood);
    if(mood) fx(() => { im.classList.remove('hop'); void im.offsetWidth; im.classList.add('hop'); });
  }
  let bubT = 0;   /* 말풍선 타이머(판 상태 G에 두지 않음: 대전 판 지문이 기기마다 같게) */
  function bubble(txt, ms){
    const b = el('rpBub'); if(!b) return;
    b.textContent = txt; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(bubT); bubT = setTimeout(() => b.classList.remove('on'), ms || 1200);
  }
  /* 지령 판 그리기 */
  function signWait(txt){
    const s = el('rpSign'); if(!s) return;
    s.className = 'rp-sign wait'; s.style.removeProperty('--oc'); s.style.removeProperty('--ol'); s.style.removeProperty('--oi');
    el('rpMed').innerHTML = medSvg('wait');
    el('rpTxt').textContent = txt; el('rpSub').textContent = ''; el('rpSub').className = 'rp-sub';
    s.setAttribute('aria-label', txt);
  }
  function signShow(q){
    const s = el('rpSign'); if(!s) return;
    const k = q.last ? 'last' : q.t, o = OD[k];
    const txt = q.last ? o.txt : q.not ? o.not : o.txt;
    s.className = 'rp-sign o-' + k + (q.hide ? ' hide' : '') + (q.not && !q.last ? ' not' : '');
    s.style.setProperty('--oc', o.col); s.style.setProperty('--ol', o.lite); s.style.setProperty('--oi', o.ink);
    el('rpMed').innerHTML = medSvg(k, q.not && !q.last);
    el('rpTxt').textContent = q.hide ? '' : txt;
    const sub = el('rpSub');
    sub.className = 'rp-sub' + (q.two ? ' arw ' + (q.side ? 'r' : 'l') : '');
    sub.innerHTML = q.two ? (q.side ? '오른쪽 손 <b>▶</b>' : '<b>◀</b> 왼쪽 손') : '';
    s.setAttribute('aria-label', (q.two ? (q.side ? '오른쪽 손 기준, ' : '왼쪽 손 기준, ') : '') + txt);
    fx(() => { void s.offsetWidth; s.classList.add('pop'); });
  }
  function setOpp(q, pump){
    const a = el('rpOpp'); if(!a) return;
    const m = S(), cuff = HOST_COL[m.host] || '#FF8A1A';
    a.className = 'rp-opp' + (q && q.two ? ' two' : '') + (pump ? ' pump' : ' rv');
    const hs = q && q.two ? [q.h, q.h2] : [q ? q.h : 1];
    a.innerHTML = hs.map((h, i) => `<i class="rp-shd s${i}" aria-hidden="true"></i><img class="rp-hand${q && q.two && i === 0 ? ' fl' : ''}" src="${handSrc(pump ? 1 : h, cuff)}" alt="${pump ? '' : '상대 ' + HN[h]}" draggable="false">`).join('')
      + (pump ? '' : '<i class="rp-burst" aria-hidden="true"></i><i class="rp-ring" aria-hidden="true"></i>');
    if(pump) a.setAttribute('aria-label', '가위 바위');
    else a.setAttribute('aria-label', q.two ? `상대 왼쪽 ${HN[q.h]}, 오른쪽 ${HN[q.h2]}` : '상대 ' + HN[q.h]);
  }
  function setBtns(perm, anim){
    const bs = document.querySelectorAll('.ng-rps .rp-b');
    bs.forEach((b, p) => {
      const h = perm[p]; if(+b.dataset.h === h && !anim) return;
      b.dataset.h = h; b.className = 'rp-b h' + h;
      b.querySelector('img').src = handSrc(h, '#FF6F9F', true);
      b.querySelector('span').textContent = HN[h];
      b.setAttribute('aria-label', HN[h] + ' 내기 (' + (p + 1) + ')');
      if(anim) fx(() => { if(!FXR.reduce && b.animate) b.animate([{ transform:'rotateY(90deg) scale(.9)' }, { transform:'rotateY(0) scale(1)' }], { duration:220, easing:'cubic-bezier(.2,1.4,.4,1)' }); });
    });
  }
  function clearMarks(){ document.querySelectorAll('.ng-rps .rp-b').forEach(b => b.classList.remove('ok', 'bad', 'right', 'dim')); const my = el('rpMy'); if(my) my.className = 'rp-my'; }

  function startPump(){
    const m = S(), q = m.Q[m.i];
    m.phase = 'pump'; m.until = m.t + m.pumpT;
    if(q.perm.join() !== el('rpBtns').dataset.perm){ clearMarks(); el('rpBtns').dataset.perm = q.perm.join(); setBtns(q.perm, true); }
    else document.querySelectorAll('.ng-rps .rp-b.ok').forEach(b => b.classList.remove('ok'));   /* 틀린 표시(정답 알려 주기)는 다음 손이 나올 때까지 남겨 둔다 */
    setHost('');
    fx(() => { const my = el('rpMy'); if(my && my.classList.contains('on')) my.className = 'rp-my out'; const ck = el('rpClash'); if(ck) ck.className = 'rp-clash'; });
    setOpp(q, true); signWait('가위 바위…');
    const w = el('rpWin'); if(w){ w.className = 'rp-win'; w.firstElementChild.style.transform = 'scaleX(1)'; }
    sfx('rpsPump'); hud();
  }
  function reveal(){
    const m = S(), q = m.Q[m.i];
    m.phase = 'go'; m.t0 = m.t; m.tapped = false;
    clearMarks(); setOpp(q, false); signShow(q); sfx('rpsGo', { t:q.last ? 'last' : q.t });
    hud();
  }
  /* 내 손 던지기: 버튼에서 무대로 휙 → 상대 손과 맞부딪힘(정답 = 상대 손이 밀려남 · 오답 = 내 손이 흔들리며 처짐). 보이기만 함 */
  function flyMine(pos, hand, ok){
    fx(() => {
      const b = document.querySelectorAll('.ng-rps .rp-b')[pos], my = el('rpMy'), ar = el('rpArena'); if(!b || !my || !ar) return;
      const im = my.querySelector('img'); im.src = handSrc(hand, '#FF6F9F'); my.className = 'rp-my on' + (ok ? ' win' : ' miss');
      const opp = el('rpOpp'), m = S(), q = m && m.Q[m.i];
      const hit = () => fx(() => {
        if(opp){ opp.classList.remove('hit', 'won'); void opp.offsetWidth; opp.classList.add(ok ? 'hit' : 'won'); }
        /* 맞부딪히는 점: 움직임(transform)을 뺀 제자리 기준(무대 좌표) = 내 손 윗부분과 상대 손 아랫부분 사이 */
        const ck = el('rpClash'), r0 = ar.getBoundingClientRect();
        const tgt = q && q.two ? opp.querySelectorAll('.rp-hand')[q.side] : opp && opp.querySelector('.rp-hand');
        const mx = my.offsetLeft + my.offsetWidth * .45, my0 = my.offsetTop + my.offsetHeight * .22;
        const ox = tgt ? opp.offsetLeft + tgt.offsetLeft + tgt.offsetWidth * .5 : mx, oy = tgt ? opp.offsetTop + tgt.offsetTop + tgt.offsetHeight * .8 : my0;
        const lx = (mx + ox) / 2, ly = (my0 + oy) / 2, x = r0.left + lx, y = r0.top + ly;
        if(ck){ ck.style.left = lx + 'px'; ck.style.top = ly + 'px'; ck.className = 'rp-clash ' + (ok ? 'ok' : 'no'); void ck.offsetWidth; ck.classList.add('on'); }
        if(ok && !FXR.reduce) fxEmit(x, y, { quantity:9, speed:{ min:90, max:220 }, lifespan:{ min:260, max:460 }, kind:'spark', tint:['#FFFFFF', '#FFE27A', '#FFC2A8'], scale:{ start:4.5, end:0 }, drag:1.6, glow:true });
      });
      if(FXR.reduce || !my.animate){ hit(); return; }
      const a = b.getBoundingClientRect(), c = my.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (c.left + c.width / 2), dy = a.top + a.height * .4 - (c.top + c.height / 2);
      my.animate([{ transform:`translate(${dx}px,${dy}px) scale(.6) rotate(-20deg)`, opacity:.7 }, { transform:'translate(0,-6%) scale(1.1) rotate(6deg)', opacity:1, offset:.7 }, { transform:'translate(0,0) scale(1) rotate(0)', opacity:1 }], { duration:200, easing:'cubic-bezier(.3,.9,.4,1)' });
      T(hit, 140);
    });
  }
  /* 손이 나오기 전(흔들기 중)에 누름: 판정하지 않고 버튼만 살짝 도리도리(아직이에요). 벌점·잠금 없음 */
  function early(pos){
    fx(() => { const b = document.querySelectorAll('.ng-rps .rp-b')[pos]; if(!b || FXR.reduce || !b.animate) return;
      b.animate([{ transform:'translateX(0)' }, { transform:'translateX(-5px)' }, { transform:'translateX(5px)' }, { transform:'translateX(-3px)' }, { transform:'translateX(0)' }], { duration:220, easing:'ease-out' }); });
  }
  function press(pos){
    const m = S(); if(!m || G.over || G.paused) return;
    const now = performance.now();
    if(now < m.lockUntil) return;
    m.taps = m.taps.filter(x => now - x < 250); m.taps.push(now);
    if(m.taps.length > 3){ m.lockUntil = now + 500; m.taps = []; slow(); return; }   /* 마구 누르기: "천천히!" 0.5초 잠금(벌점 없음) */
    if(m.phase !== 'go' || m.tapped){ if(m.phase === 'pump' || m.phase === 'ready') early(pos); return; }   /* 손이 나오기 전·판정 뒤 누름은 무시 */
    /* 판단 시간: 마지막 화면 프레임 시각 + 그 뒤 흐른 시간(프레임 사이에 누른 것도 정확하게) */
    const extra = m.tAt ? Math.max(0, Math.min(.05, (now - m.tAt) / 1000)) : 0;
    judge(pos, m.t - m.t0 + extra);
  }
  function slow(){
    sfx('rpsSlow');
    const s = el('rpSlow'); if(s){ s.classList.remove('on'); void s.offsetWidth; s.classList.add('on'); }
    T(() => { const s2 = el('rpSlow'); if(s2) s2.classList.remove('on'); }, 600);
  }
  function judge(pos, rt0){
    const m = S(), q = m.Q[m.i], rt = Math.min(q.win, rt0 != null ? rt0 : m.t - m.t0);
    m.tapped = true;
    const bs = document.querySelectorAll('.ng-rps .rp-b');
    const hand = pos >= 0 ? q.perm[pos] : -1, ok = pos >= 0 && q.ans.includes(hand);
    const ratio = ok ? Math.max(0, Math.min(1, 1 - rt / q.win)) : 0;
    m.res.push({ ok, rt, ratio, to:pos < 0 });
    const w = el('rpWin'); if(w) w.classList.add('stop');
    if(pos >= 0) flyMine(pos, hand, ok);
    if(ok){
      m.ok++; m.combo++; m.best = Math.max(m.best, m.combo); m.ratio += ratio;
      const pts = Math.round((500 + 350 * ratio) / m.N);
      bs[pos].classList.add('ok'); setHost('joy');
      sfx('rpsOk', { n:m.combo });
      fx(() => {
        const r = fxCenter(bs[pos]); fxFloat(r.x, r.y - r.h * .45, '+' + pts, 'rpf');
        fxEmit(r.x, r.y - 6, { quantity:10, speed:{ min:90, max:240 }, lifespan:{ min:380, max:650 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2A8', '#B8F5C8'], scale:{ start:5, end:0 }, gravityY:120, drag:1.4, glow:true });
        const my = el('rpMy'); if(my){ const c = fxCenter(my); fxEmit(c.x, c.y, { quantity:8, speed:{ min:60, max:180 }, lifespan:{ min:300, max:520 }, kind:'spark', tint:['#FFFFFF', '#FFE27A'], scale:{ start:4, end:0 }, glow:true }); }
      });
      if(COMBO_TXT[m.combo]) combo(m.combo);
      m.phase = 'fb'; m.until = m.t + .22;
    } else {
      m.combo = 0; m.lives--; m.wrong++; m.lostAt = 1;
      if(pos >= 0) bs[pos].classList.add('bad');
      q.ans.forEach(h => { const p = q.perm.indexOf(h); if(bs[p]) bs[p].classList.add('right'); });
      bs.forEach((b, p) => { if(p !== pos && !q.ans.includes(q.perm[p])) b.classList.add('dim'); });
      setHost('sad');
      if(pos < 0){ const s = el('rpSign'); if(s) s.classList.add('late'); }
      sfx(pos < 0 ? 'rpsTime' : 'rpsBad'); fxBuzz([40, 30, 40]);
      fx(() => { fxFlash('#FF3B3B', .16, 260); fxVignette(); fxShake(el('rpArena'), 5); });
      m.phase = 'fb'; m.until = m.t + .3;
      if(m.lives <= 0){ hud(); m.phase = 'end'; T(() => end(false), 700); return; }
    }
    hud(); m.lostAt = 0;
  }
  function combo(n){
    sfx('rpsCombo', { n });
    const c = el('rpCombo'); if(c) fx(() => fxPunch(c.closest('.hchip'), 1.12));
    const t = el('rpCtxt'); if(t){ t.innerHTML = `<b>${n}</b><span>${COMBO_TXT[n]}</span>`; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }
    bubble(COMBO_TXT[n], 900);
    fx(() => { const a = el('rpArena'); if(a){ const r = fxCenter(a); fxEmit(r.x, r.y - r.h * .1, { quantity:18, speed:{ min:120, max:320 }, lifespan:{ min:500, max:900 }, kind:'star', tint:['#FFE27A', '#FF9EC4', '#9FE1FF', '#FFFFFF'], scale:{ start:6, end:0 }, gravityY:260, drag:1, glow:true }); } });
  }
  const avgRt = m => { const g = m.res.filter(r => r.ok); return g.length ? g.reduce((s, r) => s + r.rt, 0) / g.length : 0; };
  function end(win){
    const m = S(); if(!m || m.done) return;
    m.done = true; m.phase = 'end'; m.win = win;
    const avg = avgRt(m), key = 'hp:rps:best', best = store.get(key, null);
    let rec = '';
    if(m.ok){
      const isNew = win && (!best || avg < best);
      if(isNew) store.set(key, +avg.toFixed(3));
      rec = `평균 판단 ${avg.toFixed(2)}초` + (isNew ? ' · <em>새 기록!</em>' : best ? ` · 내 최고 ${(+best).toFixed(2)}초` : '');
    }
    const b = el('rpEnd');
    if(b){ b.innerHTML = `<b>${win ? '지령 완료!' : '기회를 다 썼어요'}</b>${rec ? `<span>${rec}</span>` : ''}`; b.className = 'rp-end on' + (win ? ' win' : ''); }
    setHost(win ? 'joy' : 'sad');
    fx(() => { const s = el('rpSign'); if(s){ signWait(win ? '지령 끝!' : '여기까지!'); s.classList.add('done'); } const w = el('rpWin'); if(w) w.className = 'rp-win stop'; });
    if(win){ sfx('rpsEnd'); fx(() => { const a = el('rpArena'); if(a){ const r = fxCenter(a); fxEmit(r.x, r.y, { quantity:26, speed:{ min:140, max:360 }, lifespan:{ min:600, max:1000 }, kind:'twinkle', tint:['#FFFFFF', '#FFE27A', '#FFC2DD'], scale:{ start:6, end:0 }, gravityY:200, drag:1.2, glow:true }); } }); }
    T(() => finish(win), win ? 1300 : 1500);
  }
  function loop(now){
    const m = S(); if(!m || G.over || m.dead) return;
    G.raf = requestAnimationFrame(loop);
    const dt = m.lt ? Math.min(.1, (now - m.lt) / 1000) : 0; m.lt = now;
    if(G.paused) return;
    m.t += dt; m.tAt = now;
    if(m.phase === 'ready'){ if(m.t >= m.until) startPump(); }
    else if(m.phase === 'pump'){ if(m.t >= m.until) reveal(); }
    else if(m.phase === 'go'){
      const q = m.Q[m.i], e = m.t - m.t0, left = Math.max(0, q.win - e), k = left / q.win;
      const w = el('rpWin');
      if(w){ w.firstElementChild.style.transform = `scaleX(${k.toFixed(4)})`; const c = 'rp-win ' + (k > .5 ? 'g' : k > .25 ? 'y' : 'r') + (left < .4 ? ' hurry' : ''); if(w.className !== c) w.className = c; }
      if(e >= q.win) judge(-1);
    }
    else if(m.phase === 'fb'){ if(m.t >= m.until){ if(m.i + 1 >= m.N) end(true); else { m.i++; startPump(); } } }
  }
  function layout(){
    const root = document.querySelector('.ng-rps'); if(!root) return;
    const top = root.getBoundingClientRect().top + (window.scrollY || 0);
    const h = Math.max(470, Math.min(820, (innerHeight || 740) - top - 10));
    root.style.height = h + 'px';
    const a = el('rpArena'); if(!a) return;
    /* 지령 판이 무대 아래쪽을 COVER px 덮는다(판이 무대에 걸린 간판처럼). 덮인 곳은 땅이라 그림이 가리지 않게 뺀다 */
    const COVER = 20, band = S() && S().boss ? 26 : 0;
    const ah = a.clientHeight - COVER - band, aw = a.clientWidth;
    const hs = Math.min(ah * .3, aw * .3, 132), hz = Math.min(ah * .5, aw * .5, 220), mz = Math.min(ah * .3, aw * .28, 118);
    root.style.setProperty('--cover', COVER + 'px');
    root.style.setProperty('--hs', Math.round(hs) + 'px');
    root.style.setProperty('--hz', Math.round(hz) + 'px');
    root.style.setProperty('--hz2', Math.round(Math.min(ah * .44, aw * .4, 176)) + 'px');
    root.style.setProperty('--mz', Math.round(mz) + 'px');
    /* 진행자 + 상대 손 묶음을 위쪽에, 아래에는 내 손이 올라와 맞부딪힐 자리 */
    root.style.setProperty('--gy', Math.round(band + Math.max(4, (ah - hs * .8 - hz - mz * .5) * .45)) + 'px');
  }
  function arenaBg(pal){
    const u = 'rpbg' + (++UID), P = PAL[pal % PAL.length], s = P[4];
    return `<svg class="rp-bg" viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
      <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P[0]}"/><stop offset=".55" stop-color="${P[1]}"/><stop offset=".82" stop-color="${P[2]}"/></linearGradient>
      <radialGradient id="${u}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF1C9" stop-opacity=".85"/><stop offset="1" stop-color="#FFF1C9" stop-opacity="0"/></radialGradient>
      <linearGradient id="${u}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P[3]}"/><stop offset="1" stop-color="${P[3]}" stop-opacity=".82"/></linearGradient></defs>
      <rect width="360" height="300" fill="url(#${u}s)"/>
      <circle cx="196" cy="236" r="78" fill="url(#${u}g)"/><circle cx="196" cy="236" r="30" fill="#FFE9BE" opacity=".9"/>
      <g fill="#fff" opacity=".22"><ellipse cx="70" cy="64" rx="38" ry="9"/><ellipse cx="96" cy="56" rx="22" ry="8"/><ellipse cx="290" cy="92" rx="34" ry="8"/><ellipse cx="270" cy="86" rx="18" ry="7"/></g>
      <path d="M0 214Q60 196 120 210T240 206T360 210V240H0Z" fill="${s}" opacity=".18"/>
      <g stroke="${s}" stroke-linecap="round" fill="none" opacity=".42">
        <path d="M30 236V166M46 236V166M30 182h16M30 198h16M30 214h16" stroke-width="4"/><path d="M26 164h38" stroke-width="6"/>
        <path d="M60 166C84 168 92 200 120 232" stroke-width="9"/>
        <path d="M262 236L276 172L290 236M318 236L332 172L346 236M272 172H336" stroke-width="5"/>
        <path d="M290 172V212M302 172V212M314 172V206M326 172V206" stroke-width="2"/><path d="M286 213h20M310 207h20" stroke-width="5"/>
      </g>
      <path d="M0 236H360V300H0Z" fill="url(#${u}d)"/><path d="M0 236H360" stroke="#fff" stroke-width="2" opacity=".25"/>
      <g fill="#fff" opacity=".16"><ellipse cx="60" cy="262" rx="40" ry="5"/><ellipse cx="250" cy="276" rx="56" ry="6"/></g>
    </svg>`;
  }

  return {
    name:'가위바위보 지령', abil:'순발력', col:['#FFC7A8', '#F2785C', '#9E3B2A'], time:'약 1분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.3 1.9c1-.2 1.9.4 2.1 1.4l1.2 5.9.8-5.6c.1-1 1.1-1.7 2.1-1.5 1 .1 1.7 1.1 1.5 2.1l-.9 6.2c1.9.2 3.3 1.5 3.7 3.3l.4 1.9c.6 3.1-1.8 6-5 6h-2.4c-2.6 0-4.8-2-5-4.6l-.3-3.3c-.1-1 .5-1.9 1.5-2.1l-1.8-7.6c-.2-1 .4-1.9 1.4-2.1z"/></svg>',
    art(){
      const u = 'rpA' + Math.floor(performance.now() * 1000 % 1e6);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A74C4"/><stop offset=".6" stop-color="#EE9C88"/><stop offset="1" stop-color="#FFD6A8"/></linearGradient>
        <radialGradient id="${u}2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF3CC" stop-opacity=".9"/><stop offset="1" stop-color="#FFF3CC" stop-opacity="0"/></radialGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <circle cx="80" cy="86" r="40" fill="url(#${u}2)"/><rect y="84" width="160" height="16" fill="#E7B98E"/>
        <g stroke="#6B4F86" stroke-linecap="round" fill="none" opacity=".35"><path d="M12 84V58M20 84V58M12 66h8M12 75h8" stroke-width="2.4"/><path d="M22 60C32 62 36 74 46 84" stroke-width="4"/><path d="M128 84l8-26 8 26M140 58h14M150 84l4-26" stroke-width="2.6"/></g>
        <image href="${handSrc(1, '#FF8A1A', true)}" x="6" y="22" width="64" height="64" transform="rotate(-10 38 54)"/>
        <image href="${handSrc(2, '#FF6F9F', true)}" x="90" y="22" width="64" height="64" transform="rotate(10 122 54)"/>
        <g transform="translate(66 6) scale(.47)">${MED_SHAPE.win(OD.win.col)}${MED_ICON.win}</g>
        <path d="M80 44l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    },
    help:[
      ['상대 손과 지령을 봐요', '진행자가 가위·바위·보 중 하나를 내밀어요. 아래 지령 판에 이겨라·져라·비겨라가 글자와 그림으로 나와요. 왕관은 이겨라, 눈물은 져라, 악수는 비겨라!'],
      ['지령에 맞는 손을 내요', '아래 큰 버튼 세 개 중 맞는 손을 눌러요. 지령 판 안의 막대가 다 줄기 전에! 키보드는 1·2·3.'],
      ['막 누르면 손해', '틀리거나 시간이 지나면 기회 별이 하나 줄어요. 별이 다 없어지면 끝. 침착하게 바로 판단할수록 점수가 높아요.'],
      ['솔로: 새 지령', '그림 지령·하지 마라·두 손·아까처럼 같은 새 규칙과 빠른 판·자리 바꾸기·외줄 타기 같은 변주가 나와요.']
    ],
    helpExtra(){ const m = G && G.id === 'rps' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['골목 대결', '운동장', '놀이공원', '지령 본부', '가위바위보 왕좌'],
    starRule:'★ 클리어 · ★★ 틀린 지령 1개 이하 · ★★★ 틀린 지령 없이',
    levels:{
      easy:{ N:20, w0:2.6, w1:2.0, trap:.15, limit:0, host:'dog', pal:0 },
      normal:{ N:25, w0:2.2, w1:1.5, trap:.25, limit:0, host:'cat', pal:2 },
      hard:{ N:30, w0:1.9, w1:1.2, trap:.35, limit:0, host:'tiger', pal:4 }
    },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `지령 ${c.N}개 · 판단 ${c.w0}→${c.w1}초 · 함정 ${Math.round(c.trap * 100)}%`; },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `지령 ${c.N}개 · 판단 ${c.w0}→${c.w1}초 · 함정 ${Math.round(c.trap * 100)}%${c.lives < 3 ? ' · 기회 ' + c.lives + '개' : ''}`; },
    init(cfg, rng){
      const Q = gen(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      const lives = G.duel ? 3 : cfg.lives || 3;
      G.m = { Q, N:Q.length, i:0, t:0, t0:0, lt:0, tAt:0, ratio:0, until:.95, phase:'ready', pumpT:.3, ok:0, wrong:0, combo:0, best:0, res:[],
        lives, maxLives:lives, lostAt:0, taps:[], lockUntil:0, tapped:false, mood:'', done:false, win:false,
        host:cfg.host || 'cat', pal:cfg.pal || 0, boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, timers:new Set() };
      G.paws = lives;
      const m = G.m;
      G.cleanup = () => {
        m.dead = true;
        m.timers.forEach(clearTimeout); m.timers.clear(); clearTimeout(bubT);
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(m.onKey) removeEventListener('keydown', m.onKey);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
    },
    render(st){
      const m = S(), pal = PAL[m.pal % PAL.length];
      /* 꼬리표: 이번 판 규칙·변주(보스는 무대 위 빨간 띠가 알려 줘서 뺌: 좁은 폭에서 두 줄이 되어 기회 칸이 눌리던 것) */
      const tags = m.mj.map(k => `<span class="rp-tag">${tagName(k)}</span>`).join('') + (m.tw ? `<span class="rp-tag tw">${tagName(m.tw)}</span>` : '');
      st.innerHTML = `<div class="ng-rps${m.boss ? ' boss' : ''}" style="--p0:${pal[0]};--p1:${pal[1]};--p2:${pal[2]}">
        <div class="hud-row">
          <div class="hchip" aria-label="지령 진행"><span class="hv">${ICO.cmd}<b id="rpCnt">0</b><small>/${m.N}</small></span><em>지령</em></div>
          <div class="hchip" aria-label="연속 정답"><span class="hv">${ICO.combo}<b id="rpCombo">0</b></span><em>연속 정답</em></div>
        </div>
        <div class="rp-row"><div class="hlives" id="rpLives" role="img"></div><div class="rp-tags">${tags}</div></div>
        <div class="rp-arena" id="rpArena">${arenaBg(m.pal)}
          ${m.boss ? '<div class="rp-bossband" aria-hidden="true"><b>대장 판!</b></div>' : ''}
          <img class="toy rp-host" id="rpHost" src="${toySrc(m.host, m.boss ? 'wow' : '')}" alt="" aria-hidden="true" draggable="false">
          <div class="rp-bub" id="rpBub" aria-hidden="true"></div>
          <div class="rp-opp pump" id="rpOpp" role="img"></div>
          <div class="rp-my" id="rpMy" aria-hidden="true"><img src="${handSrc(1, '#FF6F9F')}" alt="" draggable="false"></div>
          <i class="rp-clash" id="rpClash" aria-hidden="true"></i>
          <div class="rp-ctxt" id="rpCtxt" aria-hidden="true"></div>
          <div class="rp-slow" id="rpSlow" aria-hidden="true">천천히!</div>
          <div class="rp-end" id="rpEnd" role="status"></div>
        </div>
        <div class="rp-sign wait" id="rpSign" role="status" aria-live="polite"><div class="rp-med" id="rpMed"></div><div class="rp-tx"><span class="rp-sub" id="rpSub"></span><b id="rpTxt"></b></div><div class="rp-win" id="rpWin" aria-hidden="true"><i></i></div></div>
        <div class="rp-btns" id="rpBtns" data-perm="0,1,2">${[0, 1, 2].map(p => `<button class="rp-b h${p}" data-p="${p}" data-h="${p}" aria-label="${HN[p]} 내기 (${p + 1})"><img src="${handSrc(p, '#FF6F9F', true)}" alt="" draggable="false"><span>${HN[p]}</span></button>`).join('')}</div>
      </div>`;
      document.querySelectorAll('.ng-rps .rp-b').forEach(b => { b.onpointerdown = e => { e.preventDefault(); press(+b.dataset.p); }; b.onclick = e => { if(e.detail === 0) press(+b.dataset.p); }; });
      const sg = el('rpSign'); if(sg) sg.addEventListener('animationend', () => sg.classList.remove('pop'));
      setOpp(m.Q[0], true); signWait(m.boss ? '대장 판 등장!' : '준비!');
      hud(); layout();
      fx(() => [ '', 'joy', 'sad', 'wow' ].forEach(md => { const im = new Image(); im.src = toySrc(m.host, md); }));   /* 표정 그림 미리 만들기 */
      /* 상대 손·내 손 그림 미리 풀어 두기: 손이 나온 순간(판단 시간 시작)에 그림이 늦게 뜨지 않게 */
      fx(() => [0, 1, 2].forEach(h => [handSrc(h, HOST_COL[m.host] || '#FF8A1A'), handSrc(h, '#FF6F9F')].forEach(src => { const im = new Image(); im.src = src; if(im.decode) im.decode().catch(() => {}); m.pre = (m.pre || []).concat(im); })));
      const lines = HOST_LINE[m.host] || HOST_LINE.cat;
      T(() => bubble(m.boss ? '대장 판이다!' : lines[0], 1100), 120);
      if(m.boss){ m.mood = 'wow'; sfx('rpsBoss'); }
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      m.onKey = e => {
        if(!G || G.m !== m || G.over || (document.getElementById('veil') && document.getElementById('veil').classList.contains('on'))) return;
        const k = e.key, p = { '1':0, '2':1, '3':2, a:0, s:1, d:2, A:0, S:1, D:2, ArrowLeft:0, ArrowDown:1, ArrowUp:1, ArrowRight:2 }[k];
        if(p == null || e.repeat) return;
        e.preventDefault(); press(p);
        const b = document.querySelectorAll('.ng-rps .rp-b')[p]; if(b) fx(() => { b.classList.add('kd'); setTimeout(() => b.classList.remove('kd'), 120); });
      };
      addEventListener('keydown', m.onKey);
      if(G.raf) cancelAnimationFrame(G.raf);
      m.lt = 0; G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m && m.N ? m.res.length / m.N : 0; },
    lossText(){ const m = G.m; return `지령 ${m.res.length}/${m.N}개 중 ${m.ok}개를 맞혔어요.`; },
    score(){
      const m = G.m, N = m.N || 1;
      const base = Math.round(500 * m.ok / N);
      const time = Math.round(350 * m.res.reduce((s, r) => s + r.ratio, 0) / N);
      const extra = 50 * Math.max(0, m.lives);
      return { base, time, extra, rows:[`정답 ${m.ok}/${m.N}`, `판단 속도 보너스 (평균 ${avgRt(m).toFixed(2)}초)`, `남은 기회 ${Math.max(0, m.lives)}개`] };
    },
    stars(){ const w = G.m.wrong; return w === 0 ? 3 : w === 1 ? 2 : 1; },
    sounds:{
      rpsPump(){ aMarimba(m2f(55), { v:.11, d:.12 }); aThump({ f:120, f2:70, d:.08, v:.08 }); aMarimba(m2f(55), { t:.15, v:.12, d:.12 }); aThump({ t:.15, f:120, f2:70, d:.08, v:.09 }); },
      rpsGo(o){ const r = { win:72, lose:67, draw:69, last:74 }[o.t] || 72; aTone({ f:520, f2:1180, d:.07, v:.08 }); aBell({ f:m2f(r + 12), d:.45, v:.07, idx:1.3, rev:.3 }); aNoise({ ft:'highpass', f:5200, d:.05, v:.03 }); },
      rpsOk(o){ const n = Math.min(14, o.n || 1); aMarimba(penta(n + 2, 72), { v:.18 }); aMarimba(penta(n + 4, 72), { t:.055, v:.13 }); aNoise({ ft:'highpass', f:6000, t:.02, d:.14, v:.03 }); if(n >= 5) aBell({ f:penta(n + 7, 72), t:.08, d:.5, v:.045, rev:.35 }); },
      rpsBad(){ aTone({ f:196, f2:150, type:'square', lp:900, d:.16, v:.07 }); aTone({ f:147, type:'square', lp:700, t:.1, d:.22, v:.06 }); aThump({ f:110, f2:50, d:.2, v:.16 }); },
      rpsTime(){ aTone({ f:660, f2:330, type:'triangle', d:.22, v:.07 }); aTone({ f:220, type:'square', lp:800, t:.16, d:.24, v:.05 }); },
      rpsCombo(o){ const b = o.n >= 20 ? 79 : o.n >= 10 ? 76 : 72; [0, 4, 7, 12].forEach((s, i) => aBrass(m2f(b + s), { t:i * .07, d:.16, v:.05 })); aSparkle({ t:.25, n:4, v:.04 }); },
      rpsSlow(){ aTone({ f:330, f2:262, type:'triangle', d:.18, v:.06 }); },
      rpsBoss(){ aThump({ f:90, f2:45, d:.5, v:.3 }); aBrass(m2f(55), { t:.08, hold:.2, d:.5, v:.06 }); aBrass(m2f(62), { t:.08, hold:.2, d:.5, v:.045 }); },
      rpsEnd(){ [0, 2, 4, 7, 9, 12].forEach((d, i) => aMarimba(penta(d, 72), { t:i * .055, v:.14 })); aSparkle({ t:.35, n:5, v:.045 }); }
    },
    gate:{ rpsOk:40, rpsBad:80, rpsPump:100, rpsSlow:200, rpsGo:60 },
    jingle(){ [0, 2, 4, 5, 7].forEach((d, i) => aMarimba(penta(d, 67), { t:i * .07, v:.16 })); [67, 72, 76, 79].forEach(m => aMarimba(m2f(m), { t:.42, d:1.1, v:.11 })); aBrass(m2f(79), { t:.42, hold:.3, d:.7, v:.04 }); aSparkle({ t:.5, n:6 }); },
    /* 테스트·도구용 */
    _gen:gen, _stage:stageCfg, _hand:handSrc, _glove:g => { GLOVE = g; },
    _test:{
      state(){ const m = S(); if(!m) return null; const q = m.Q[m.i]; return { phase:m.phase, i:m.i, N:m.N, t:m.t, rt:m.phase === 'go' ? m.t - m.t0 : 0, win:q && q.win, pos:q ? q.ans.map(h => q.perm.indexOf(h)) : [], lives:m.lives, ok:m.ok }; },
      press:p => press(p),
      sig(){ return S().Q.map(q => [q.h, q.h2, q.side, q.t, q.not ? 1 : 0, q.last ? 1 : 0, q.hide ? 1 : 0, q.perm.join(''), q.win].join(':')).join('|'); }
    }
  };
})();

/* 대전: 같은 지령 25개 · 모두 끝났을 때 점수가 높은 쪽 승(기획 docs/20 1절).
   대전 v3 기본값은 '경주'(먼저 끝낸 사람이 1등, 0.7초 뒤 모두 끝)라서, 판단 시간이 정해진 이 게임에서는 실수가 많아도 빨리 끝낸 쪽이 이기고
   늦은 사람이 끝나기 직전에 잘렸다 → 점수전('score', 모두 끝까지)으로 맞춤. 막대 수치 v = 지금까지 점수(정답 + 판단 속도, 배율 전).
   끝난 두 사람은 결과 점수(sc, 남은 기회 포함)로, 성공한 사람이 실패한 사람보다 앞. 컴퓨터 상대도 같은 점수 눈금으로(duelAi) */
const rpsLive = () => { const m = G && G.m; if(!m || !m.N) return 0; return Math.round(500 * m.ok / m.N) + Math.round(350 * (m.ratio || 0) / m.N); };
Object.assign(NG.rps, { duelKind:'score', duelMax:2, duelEnd:'all', duelPace:[55, .75],
  duelStat:{ unit:'점', score:true, lfMax:3, get:() => ({ v:rpsLive(), t:G.m ? G.m.N : 25, lf:G.m ? Math.max(0, G.m.lives) : 3, mis:G.m ? G.m.wrong : 0 }) },
  duelRank(a, b){ if(a.dn && b.dn){ if(!!a.ok !== !!b.ok) return a.ok ? -1 : 1; if(a.ok && (a.sc || 0) !== (b.sc || 0)) return (b.sc || 0) - (a.sc || 0); } return 0; },
  duelAi(rng, o){
    const ok = rng() < .75, T = 55 * (.7 + rng() * .6) * (o && o.pace === 's' ? 1.5 : 1);
    const acc = ok ? .92 + rng() * .08 : .55 + rng() * .3, sp = .3 + rng() * .35;   /* 정답 비율 · 남은 창 비율 */
    const pts = Math.round(500 * acc + 350 * acc * sp), lv = ok ? (acc > .99 ? 3 : 1 + Math.floor(rng() * 2)) : 0;
    return { ok, T, pts, sc:ok ? pts + 50 * lv : 0, fail:.3 + rng() * .6 };
  },
  duelHow:'같은 지령 25개 · 모두 끝나면 점수가 높은 쪽이 이겨요' });
/* 움직이는 배경(core/scene.js): 노을 놀이터의 따뜻한 빛 알갱이. 보이기만 함 */
NG.rps.scene = { kind:'motes', colors:['#FFE2B8', '#FFC9C2', '#FFFFFF'], density:.6, alpha:.6 };
