/* 지뢰찾기 */
/* ===== 지뢰찾기 (mines) · 하루퍼즐 리그 게임 모듈 =====
   가을 밤숲 테마: 덮인 나뭇잎 칸 아래에 '밤송이'가 숨어 있다. 연 칸의 숫자 = 둘레 8칸의 밤송이 수.
   모든 판은 "찍기 없는 판": 씨앗(rng)으로 판을 만들고, 논리 풀이기(단순 규칙 + 부분집합(두 숫자 비교) + 남은 개수)로
   첫 칸부터 끝까지 찍지 않고 풀리는 판만 쓴다. 오늘의 문제는 모두 같은 문제여야 하므로 첫 칸은 씨앗이 정해 미리 열어 둔다.
   그림은 전부 직접 그린 오리지널 SVG(굵은 외곽선 #1A0F45). */
NG.mines = (() => {
  const OL = '#1A0F45';
  const O = `stroke="${OL}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const O2 = `stroke="${OL}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;

  /* ----- 그림(64×64) ----- */
  const spikes = (cx, cy, r0, r1, n, col) => {
    let a = '', b = '';
    for(let i = 0; i < n; i++){
      const t = (i + .5) * Math.PI * 2 / n, x0 = (cx + Math.cos(t) * r0).toFixed(1), y0 = (cy + Math.sin(t) * r0).toFixed(1), x1 = (cx + Math.cos(t) * r1).toFixed(1), y1 = (cy + Math.sin(t) * r1).toFixed(1);
      a += `M${x0} ${y0}L${x1} ${y1}`; b += `M${x0} ${y0}L${x1} ${y1}`;
    }
    return `<path d="${a}" stroke="${OL}" stroke-width="5.6" stroke-linecap="round"/><path d="${b}" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
  };
  const BURR_IN = `${spikes(32, 33, 17, 29, 16, '#9BD14B')}<circle cx="32" cy="33" r="19" fill="#86C33A" ${O}/>
    <path d="M20 40c0-9 5-17 12-19 7 2 12 10 12 19 0 5-5 8-12 8s-12-3-12-8z" fill="#8A4B1E" ${O2}/>
    <path d="M22 43c3 3 7 4 10 4s7-1 10-4" fill="none" stroke="#E9C08A" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="27" cy="31" rx="2.6" ry="5" transform="rotate(25 27 31)" fill="#fff" opacity=".6"/>`;
  const BURR = `<svg viewBox="0 0 64 64" aria-hidden="true">${BURR_IN}</svg>`;
  const FLAG = `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="30" cy="54" rx="15" ry="5" fill="#5E9A26" ${O2}/><path d="M24 54V9" stroke="${OL}" stroke-width="6.5" stroke-linecap="round"/><path d="M24 54V9" stroke="#B07A45" stroke-width="3" stroke-linecap="round"/><path d="M26 10l25 9-25 10z" fill="#FF5A3C" ${O}/><path d="M29 15l10 4" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/></svg>`;
  const STONE = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 46l6-23 15-11 18 4 8 18-6 15-23 4z" fill="#9A94B2" ${O}/><path d="M16 26l12 6 6 16M30 32l18-12" fill="none" stroke="#625D80" stroke-width="2.4" stroke-linecap="round"/><path d="M18 27l8-6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/></svg>`;
  const FOG = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 46h34a10 10 0 0 0 2-19.8A14 14 0 0 0 23 22 10 10 0 0 0 14 46z" fill="#E4E0F2" ${O2}/><text x="32" y="43" font-size="22" font-weight="900" text-anchor="middle" fill="#7B70A8">?</text></svg>`;
  const ICO = {
    burr:`<svg viewBox="0 0 64 64" aria-hidden="true">${BURR_IN}</svg>`,
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    dig:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3.5l6 6-2.2 2.2-6-6z" fill="#B07A45" stroke="#1A0F45" stroke-width="1.7" stroke-linejoin="round"/><path d="M13.6 8.4L4 18a1.6 1.6 0 0 0 2.2 2.2l9.6-9.6" fill="none" stroke="#1A0F45" stroke-width="4" stroke-linecap="round"/><path d="M13.6 8.4L4 18a1.6 1.6 0 0 0 2.2 2.2l9.6-9.6" fill="none" stroke="#C8D2E0" stroke-width="1.8" stroke-linecap="round"/></svg>',
    flag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21.5V3" stroke="#1A0F45" stroke-width="3.2" stroke-linecap="round"/><path d="M8 21.5V3" stroke="#B07A45" stroke-width="1.4" stroke-linecap="round"/><path d="M9 3.5l11 4-11 4.5z" fill="#FF5A3C" stroke="#1A0F45" stroke-width="1.7" stroke-linejoin="round"/></svg>'
  };
  /* 숫자 색(오리지널 팔레트: 하늘·초록·분홍·보라·주황·청록·밤색·회색) */
  const NUMC = ['', '#2E8BFF', '#1E9E55', '#E83E8C', '#7B4DFF', '#EE7414', '#109C9C', '#8A5A2B', '#6F6A88'];
  const numCol = v => NUMC[Math.min(8, v)] || '#1A0F45';

  /* 칸 모양: 0 보통(둘레 8칸) · 1 십자(위아래양옆 4칸) · 2 넓은(둘레 2칸까지 24칸) · 3 안개(숫자가 가려짐) */
  const SH_N = 0, SH_X = 1, SH_W = 2, SH_F = 3;
  const OFFS = [
    [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
    [[0, -1], [-1, 0], [1, 0], [0, 1]],
    (() => { const r = []; for(let y = -2; y <= 2; y++) for(let x = -2; x <= 2; x++) if(x || y) r.push([x, y]); return r; })()
  ];
  const LIVES = 3;          /* 기회 3번: 밤송이를 세 번 건드리면 실패 */
  const STUN = 2.5;         /* 대전: 밤송이를 건드리면 2.5초 동안 못 누름(기회 제한 대신) */

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['stone', 'fog', 'cross', 'wide'],
    info:{
      stone:{ name:'바위 칸', desc:'판 곳곳에 바위가 박혀 있어요. 바위 밑에는 밤송이가 없고, 숫자도 바위는 세지 않아요.' },
      fog:{ name:'안개 칸', desc:'열어도 숫자가 안개(?)에 가려지는 칸이 있어요. 둘레 다른 숫자로만 풀어야 해요.' },
      cross:{ name:'십자 숫자', desc:'＋ 표시가 붙은 숫자는 위·아래·왼쪽·오른쪽 4칸의 밤송이만 세요. 대각선은 세지 않아요.' },
      wide:{ name:'넓은 숫자', desc:'점선 동그라미 숫자는 두 칸 거리까지(둘레 24칸)의 밤송이를 모두 세요.' }
    },
    twists:['flash', 'noflag', 'tight', 'dense', 'bare'],
    twInfo:{
      flash:{ name:'번개', desc:'판은 같은데 제한 시간이 아주 짧아요. 확실한 칸부터 빠르게!' },
      noflag:{ name:'깃발 없이', desc:'이번 판은 깃발을 꽂을 수 없어요. 밤송이 자리를 머리로 기억하며 풀어요.' },
      tight:{ name:'외줄 타기', desc:'기회가 딱 한 번! 밤송이를 건드리면 바로 끝나요.' },
      dense:{ name:'빽빽한 숲', desc:'밤송이가 평소보다 훨씬 많아요. 대신 시간은 조금 더 줘요.' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 논리로만 풀어요.' }
    }
  };
  const RULE_TIP = { stone:'바위는 세지 않아요', fog:'?칸은 숫자가 가려져요', cross:'＋숫자 = 4칸만', wide:'◌숫자 = 둘레 24칸', flash:'시간이 짧아요', noflag:'깃발 없이', tight:'한 번 건드리면 끝', dense:'밤송이가 많아요', bare:'힌트 없음' };

  /* ----- 솔로 난이도 표 -----
     판 크기 = SZ[챕터 기본 + KS[k]], 밤송이 = 칸 × (DEN[c] + KD[k]), 제한 시간 = (40 + 밤송이 × SPM[c]) × kTime × 규칙·변주 배수 */
  const SZ = [[7, 8], [8, 9], [8, 10], [9, 11], [9, 12], [10, 13], [10, 14]];
  const LT = {
    KS:[0, 0, 0, 1, 1, 2, 0, 1, 1, 0, 2],
    DEN:[0, .11, .13, .145, .155, .165, .175],
    KD:[0, -.02, 0, .005, .01, .02, -.015, 0, .01, -.02, .025],
    SPM:[0, 12, 11.5, 11, 10.5, 10, 10],
    kTime:[0, 1.15, 1.05, 1.0, 1.0, 0.9, 1.1, 1.0, 1.0, 1.1, 0.9],
    mjTime:{ stone:1.0, fog:1.15, cross:1.1, wide:1.15 },
    twTime:{ flash:0.7, noflag:1.2, tight:1.1, dense:1.15, bare:1.1 },
    shape:{ fog:.16, cross:.2, wide:.13 }
  };
  function stageCfg(n){
    const p = planOf('mines', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    const si = Math.max(0, Math.min(6, (c === 1 ? 0 : Math.min(4, c - 1)) + LT.KS[k]));
    const [cols, rows] = SZ[si];
    const stones = has('stone') ? Math.round(cols * rows * .07) + (p.boss ? 1 : 0) : 0;
    let d = LT.DEN[Math.min(c, LT.DEN.length - 1)] + LT.KD[k];
    if(tw === 'dense') d += .035;
    d = Math.max(.08, Math.min(has('fog') ? .16 : .21, d));   /* 안개 칸은 정보가 적어 빽빽하면 찍기 없는 판이 드물다 */
    const mines = Math.max(5, Math.round((cols * rows - stones) * d));
    let limit = (40 + mines * LT.SPM[Math.min(c, LT.SPM.length - 1)]) * LT.kTime[k];
    mj.forEach(x => { limit *= LT.mjTime[x] || 1; });
    if(tw) limit *= LT.twTime[tw] || 1;
    limit = Math.max(60, Math.round(limit / 5) * 5);
    return { cols, rows, mines, stones, fog:has('fog') ? LT.shape.fog : 0, cross:has('cross') ? LT.shape.cross : 0, wide:has('wide') ? LT.shape.wide : 0,
      limit, hints:tw === 'bare' ? 0 : p.boss ? 1 : 2, lives:tw === 'tight' ? 1 : LIVES, noflag:tw === 'noflag', boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 이웃(칸 모양별, 바위 제외) ===== */
  function nbrs(b, i, sh){
    const cols = b.cols, rows = b.rows, x = i % cols, y = (i - x) / cols, r = [];
    for(const [dx, dy] of OFFS[sh === SH_F ? SH_N : sh]){
      const nx = x + dx, ny = y + dy;
      if(nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx; if(!b.stone[j]) r.push(j);
    }
    return r;
  }
  function calcVals(b){
    const v = new Int16Array(b.N);
    b.nb = Array.from({ length:b.N }, (_, i) => nbrs(b, i, b.shape[i]));   /* 칸마다 이웃 목록(칸 모양별)을 한 번만 만든다 */
    for(let i = 0; i < b.N; i++){ if(b.stone[i] || b.mine[i]) continue; let s = 0; for(const j of b.nb[i]) s += b.mine[j]; v[i] = s; }
    return v;
  }

  /* ===== 논리 풀이기 =====
     known: 0 모름 · 1 열림(안전) · 2 밤송이 확실. 지금 아는 것만으로 확실한 칸들을 찾는다(찍지 않음).
     1) 단순 규칙: 숫자 − 확실한 밤송이 = 0 → 남은 칸 모두 안전 / = 남은 칸 수 → 모두 밤송이
     2) 부분집합(두 숫자 비교): A의 필요 − B의 필요 = |A만의 칸| → A만의 칸은 모두 밤송이, B만의 칸은 모두 안전
     3) 남은 개수: 남은 밤송이 0 → 모르는 칸 모두 안전 / 남은 밤송이 = 모르는 칸 수 → 모두 밤송이 */
  function deduce(b, known, total){
    const safe = new Set(), mine = new Set(), C = [];
    for(let i = 0; i < b.N; i++){
      if(known[i] !== 1 || b.shape[i] === SH_F) continue;
      const nb = b.nb[i], U = []; let need = b.val[i];
      for(const j of nb){ if(known[j] === 2) need--; else if(known[j] === 0) U.push(j); }
      if(!U.length) continue;
      if(need === 0) U.forEach(j => safe.add(j));
      else if(need === U.length) U.forEach(j => mine.add(j));
      else C.push({ U, need });
    }
    if(safe.size || mine.size) return { safe:[...safe], mine:[...mine], how:'basic' };
    /* 부분집합 */
    const byCell = new Map();
    C.forEach((c, n) => c.U.forEach(j => { let L = byCell.get(j); if(!L) byCell.set(j, L = []); L.push(n); }));
    const mark = new Int32Array(b.N); let stamp = 0;
    for(let a = 0; a < C.length; a++){
      const A = C[a], seen = new Set();
      stamp++; A.U.forEach(j => { mark[j] = stamp; });
      for(const j of A.U) for(const bi of byCell.get(j)){
        if(bi === a || seen.has(bi)) continue; seen.add(bi);
        const B = C[bi]; let inter = 0; const onlyB = [];
        for(const q of B.U){ if(mark[q] === stamp) inter++; else onlyB.push(q); }
        const onlyAn = A.U.length - inter;
        if(onlyAn > 0 && A.need - B.need === onlyAn){
          const inB = new Set(B.U);
          A.U.forEach(q => { if(!inB.has(q)) mine.add(q); }); onlyB.forEach(q => safe.add(q));
          return { safe:[...safe], mine:[...mine], how:'pair' };
        }
      }
    }
    /* 남은 개수 */
    let unk = 0, km = 0; const U = [];
    for(let i = 0; i < b.N; i++){ if(b.stone[i]) continue; if(known[i] === 0){ unk++; U.push(i); } else if(known[i] === 2) km++; }
    const rem = total - km;
    if(unk && rem === 0) return { safe:U, mine:[], how:'count' };
    if(unk && rem === unk) return { safe:[], mine:U, how:'count' };
    return null;
  }
  /* 열기(0이면 둘레도 저절로 열림. 안개 칸은 숫자를 모르니 저절로 퍼지지 않음). 새로 열린 칸 목록을 연 순서대로 돌려준다 */
  function flood(b, known, start, canOpen){
    const out = [], st = [start];
    while(st.length){
      const i = st.pop();
      if(known[i] !== 0 || !canOpen(i)) continue;
      known[i] = 1; out.push(i);
      if(b.shape[i] !== SH_F && b.val[i] === 0) for(const j of b.nb[i]) if(known[j] === 0) st.push(j);
    }
    return out;
  }
  /* 처음 칸부터 끝까지 찍지 않고 풀리는지 */
  function solve(b){
    const known = new Uint8Array(b.N), stat = { basic:0, pair:0, count:0 };
    for(let i = 0; i < b.N; i++) if(b.stone[i]) known[i] = 3;
    let opened = flood(b, known, b.start, j => !b.mine[j]).length;
    const safeTotal = b.N - b.stoneN - b.mines;
    for(let guard = 0; guard < 2000 && opened < safeTotal; guard++){
      const d = deduce(b, known, b.mines);
      if(!d) break;
      stat[d.how]++;
      for(const j of d.mine) known[j] = 2;
      for(const j of d.safe){ if(b.mine[j]) return { ok:false, bug:true, stat }; opened += flood(b, known, j, q => !b.mine[q]).length; }
    }
    return { ok:opened >= safeTotal, stat };
  }

  /* ===== 판 만들기(rng만) =====
     첫 칸(씨앗이 정함, 가운데 쪽 칸)과 둘레 3×3은 밤송이 없음 → 첫 칸은 0이라 넓게 열린다.
     바위·밤송이·칸 모양을 rng로 놓고, 풀이기로 끝까지 풀리는 판만 쓴다. 40번 안에 못 찾으면 밤송이를 하나 줄여 다시(끝내는 반드시 찾음). */
  function deal(cfg, rng){
    const cols = cfg.cols, rows = cfg.rows, N = cols * rows;
    /* 첫 칸은 가운데 쪽(가장자리에서 1/4 안쪽) → 처음 열리는 땅이 판 가운데에서 넓게 퍼진다 */
    const lx = Math.max(1, Math.floor(cols / 4)), ly = Math.max(1, Math.floor(rows / 4));
    const sx = lx + Math.floor(rng() * Math.max(1, cols - 2 * lx)), sy = ly + Math.floor(rng() * Math.max(1, rows - 2 * ly)), start = sy * cols + sx;
    const zone = new Set(); for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const x = sx + dx, y = sy + dy; if(x >= 0 && y >= 0 && x < cols && y < rows) zone.add(y * cols + x); }
    let mines = cfg.mines, tries = 0;
    for(;;){
      tries++;
      const b = { cols, rows, N, start, mines, stone:new Uint8Array(N), mine:new Uint8Array(N), shape:new Uint8Array(N), stoneN:0 };
      /* 바위: 첫 칸 둘레 밖, 서로(대각선 포함) 붙지 않게 */
      if(cfg.stones){
        for(const i of shuffle(Array.from({ length:N }, (_, i) => i).filter(i => !zone.has(i)), rng)){
          if(b.stoneN >= cfg.stones) break;
          const x = i % cols, y = (i - x) / cols; let near = false;
          for(let dy = -1; dy <= 1 && !near; dy++) for(let dx = -1; dx <= 1; dx++){ const nx = x + dx, ny = y + dy; if(nx >= 0 && ny >= 0 && nx < cols && ny < rows && b.stone[ny * cols + nx]){ near = true; break; } }
          if(near) continue; b.stone[i] = 1; b.stoneN++;
        }
      }
      const cand = shuffle(Array.from({ length:N }, (_, i) => i).filter(i => !zone.has(i) && !b.stone[i]), rng);
      b.mines = mines = Math.min(mines, cand.length);
      for(let n = 0; n < mines; n++) b.mine[cand[n]] = 1;
      /* 칸 모양(첫 칸은 보통) */
      const fx = cfg.fog || 0, cx = cfg.cross || 0, wx = cfg.wide || 0;
      if(fx || cx || wx) for(let i = 0; i < N; i++){
        if(b.stone[i] || b.mine[i] || i === start){ continue; }
        const r = rng();
        b.shape[i] = r < fx ? SH_F : r < fx + cx ? SH_X : r < fx + cx + wx ? SH_W : SH_N;
      }
      b.val = calcVals(b);
      const s = solve(b);
      if(s.ok){ b.tries = tries; b.stat = s.stat; return b; }
      if(tries % 40 === 0 && mines > 1) mines--;
    }
  }

  /* ===== 게임 상태 · 화면 ===== */
  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const cellEl = i => document.querySelector(`.ng-mines .mn-cell[data-i="${i}"]`);
  /* st: 0 덮임 · 1 열림 · 2 깃발 · 3 터진 밤송이 */
  const knownMines = m => { let n = 0; for(let i = 0; i < m.N; i++) if(m.st[i] === 2 || m.st[i] === 3) n++; return n; };

  function hud(){
    const m = S(); if(!m) return;
    const f = $('#mnLeft'); if(f) f.textContent = m.mines - knownMines(m);
    const h = $('#mnHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0; }
    const lv = $('#mnLives');
    if(lv && !m.lives) lv.style.display = 'none';
    else if(lv){ const left = Math.max(0, m.lives - m.hits); lv.innerHTML = '기회 ' + Array.from({ length:m.lives }, (_, n) => `<i${n >= left ? ' class="off"' : ''}>★</i>`).join(''); lv.classList.toggle('last', left === 1); lv.setAttribute('aria-label', '남은 기회 ' + left + '번'); }
    document.querySelectorAll('.ng-mines .mn-mode button').forEach(b => { const on = b.dataset.m === m.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function msg(html, cls){ const e = $('#mnMsg'); if(!e) return; e.className = 'mn-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">보스 판</b><span>' + (m.tips[0] || '끝까지 침착하게!') + '</span>';
    if(m.tips.length) return '<span>' + m.tips.slice(0, 2).join(' · ') + '</span>';
    return '<span>숫자 = 둘레 밤송이 수</span>';
  }

  function layout(){
    const m = S(), bd = $('#bd'), root = document.querySelector('.ng-mines'); if(!bd || !root) return;
    const W = Math.min((root.clientWidth || 360) + 16, 480);   /* 판은 양옆 여백을 8px씩 더 쓴다(.mn-board 음수 여백) */
    const top = bd.getBoundingClientRect().top + (window.scrollY || 0);
    const H = Math.max(300, (innerHeight || 740) - top - 96);   /* 아래 열기·깃발 단추 자리 */
    const gap = 2, pad = 5;
    let cw = Math.min((W - pad * 2 - gap * (m.cols - 1) - 4) / m.cols, (H - pad * 2 - gap * (m.rows - 1) - 6) / m.rows, 52);
    cw = Math.max(30, Math.floor(cw));
    bd.style.setProperty('--cw', cw + 'px'); bd.style.setProperty('--gap', gap + 'px'); bd.style.setProperty('--pad', pad + 'px');
    bd.style.gridTemplateColumns = `repeat(${m.cols}, ${cw}px)`;
    /* 화면 높이 채우기(보이기만): 판은 가운데, 열기·깃발 단추는 엄지 자리(아래)로 */
    try{ const rt = root.getBoundingClientRect().top + (window.scrollY || 0); root.style.minHeight = Math.max(0, Math.floor((innerHeight || 740) - rt - 20)) + 'px'; }catch(_){}
  }
  function cellHtml(i){
    const m = S(), x = i % m.cols, y = (i - x) / m.cols, pos = `${y + 1}행 ${x + 1}열`, st = m.st[i];
    if(m.stone[i]) return `<span class="mn-cell stone" data-i="${i}" role="img" aria-label="바위 ${pos}">${STONE}</span>`;
    if(st === 0) return `<button class="mn-cell hid" data-i="${i}" aria-label="덮인 칸 ${pos}"></button>`;
    if(st === 2) return `<button class="mn-cell hid flag" data-i="${i}" aria-label="깃발 ${pos}">${FLAG}</button>`;
    if(st === 3) return `<span class="mn-cell boom" data-i="${i}" role="img" aria-label="밤송이 ${pos}">${BURR}</span>`;
    const sh = m.shape[i];
    if(sh === SH_F) return `<span class="mn-cell op fog" data-i="${i}" role="img" aria-label="안개 칸 ${pos}">${FOG}</span>`;
    const v = m.val[i], cls = sh === SH_X ? ' cross' : sh === SH_W ? ' wide' : '', nm = sh === SH_X ? '십자 ' : sh === SH_W ? '넓은 ' : '';
    return `<button class="mn-cell op${cls}${v ? '' : ' zero'}" data-i="${i}" aria-label="${nm}${v} ${pos}">${v || sh ? `<b style="color:${numCol(v)}">${v}</b>` : ''}${sh === SH_X ? '<i class="mk-x" aria-hidden="true"></i>' : ''}</button>`;
  }
  function redraw(i, cls, delay){
    const el = cellEl(i); if(!el) return;
    el.outerHTML = cellHtml(i);
    if(cls){ const e = cellEl(i); if(e){ e.classList.add(cls); if(delay) e.style.animationDelay = delay + 'ms'; } }
  }
  function build(){
    const m = S(), bd = $('#bd'); if(!bd) return;
    bd.innerHTML = Array.from({ length:m.N }, (_, i) => cellHtml(i)).join('');
    layout();
  }

  /* ----- 동작 ----- */
  const canPlay = () => { const m = S(); return m && !G.over && !G.paused && m.phase === 'play' && !(m.stunUntil && elapsed() < m.stunUntil); };
  function act(i, how){
    const m = S(); if(!canPlay() || m.stone[i]) return;
    clearHint();
    const st = m.st[i];
    if(st === 1){ chord(i); return; }
    if(st === 3) return;
    if(how === 'flag'){ toggleFlag(i); return; }
    if(st === 2){ const el = cellEl(i); if(el){ fxShake(el, 3); } msg('<span>깃발 칸은 열리지 않아요 · 깃발 모드로 뽑아요</span>', 'mn-pop'); T(() => { if(S().phase === 'play') msg(playMsg()); }, 1300); return; }
    reveal([i], i);
  }
  function toggleFlag(i){
    const m = S();
    if(m.noflag){ msg('<b class="bad">깃발 없이!</b><span>이번 판은 깃발을 못 꽂아요</span>', 'mn-pop'); T(() => { if(S().phase === 'play') msg(playMsg()); }, 1200); return; }
    if(m.st[i] === 0){ m.st[i] = 2; m.flags++; sfx('minesFlag'); fxBuzz(15); redraw(i, 'plant'); }
    else if(m.st[i] === 2){ m.st[i] = 0; sfx('minesFlag', { off:1 }); redraw(i); }
    hud();
  }
  /* 숫자 칸을 누르면: 둘레의 깃발(+터진 밤송이) 수가 숫자와 같을 때 나머지 덮인 칸을 한꺼번에 연다 */
  function chord(i){
    const m = S(); if(m.shape[i] === SH_F) return;
    const nb = m.nb[i];
    const marked = nb.filter(j => m.st[j] === 2 || m.st[j] === 3).length, hid = nb.filter(j => m.st[j] === 0);
    if(!hid.length) return;
    if(marked !== m.val[i]){
      nb.forEach(j => { if(m.st[j] === 0){ const e = cellEl(j); if(e){ e.classList.add('peek'); setTimeout(() => e.classList.remove('peek'), 260); } } });
      sfx('minesPeek'); return;
    }
    reveal(hid, i);
  }
  /* 칸 열기(밤송이면 터짐). 여러 칸을 한 번에 열 수도 있다(숫자 누르기) */
  function reveal(list, from){
    const m = S(); let boom = -1; const opened = [];
    for(const i of list){
      if(m.st[i] !== 0) continue;
      if(m.mine[i]){ if(boom < 0) boom = i; continue; }
      const known = m.known;
      for(const j of flood(m, known, i, q => !m.mine[q] && m.st[q] === 0)) opened.push(j);
    }
    if(opened.length){
      const fx0 = from % m.cols, fy0 = (from - fx0) / m.cols;
      opened.forEach(j => { m.st[j] = 1; });
      opened.forEach(j => { const x = j % m.cols, y = (j - x) / m.cols; redraw(j, 'pop', Math.min(420, (Math.abs(x - fx0) + Math.abs(y - fy0)) * 28)); });
      m.opened += opened.length;
      if(opened.length >= 6){ sfx('minesWide', { n:opened.length }); try{ const e = cellEl(from) || cellEl(opened[0]); if(e){ const q = fxCenter(e); fxRing(q.x, q.y, '#FFE27A', 60 + opened.length * 3, .5, 6); } }catch(_){} }
      else sfx('minesOpen');
    }
    if(boom >= 0) explode(boom);
    hud();
    if(m.phase === 'play' && m.opened >= m.safeTotal) win();
  }
  function explode(i){
    const m = S(); m.st[i] = 3; m.known[i] = 2; m.hits++;
    redraw(i, 'blast');
    sfx('minesBoom'); fxBuzz([40, 30, 40]);
    try{ const e = cellEl(i); if(e){ const q = fxCenter(e); fxBurst(q.x, q.y, ['#86C33A', '#8A4B1E', '#FFE27A', '#fff'], 14, { speed:260, size:5, kinds:['shard', 'dot', 'spark'], up:80, g:520, dur:.7 }); } fxShake($('#bd'), 5); }catch(_){}
    const left = m.lives ? Math.max(0, m.lives - m.hits) : -1;
    const hs = document.querySelectorAll('.ng-mines .hlives i'), lost = left >= 0 && hs[left];
    if(lost){ lost.classList.add('lost'); try{ const q = fxCenter(lost); fxBurst(q.x, q.y, ['#FFB020', '#FFE27A', '#fff'], 10, { speed:200, size:4, kinds:['dot', 'spark'], up:60, g:500, dur:.6 }); }catch(_){} }
    if(left < 0){
      /* 대전: 기회 제한 없이 잠깐 못 누름 */
      m.stunUntil = elapsed() + STUN;
      const bd = $('#bd'); if(bd) bd.classList.add('stun');
      msg('<b class="bad">앗, 밤송이!</b><span>' + STUN + '초 쉬어요</span>', 'mn-pop');
      T(() => { const b = $('#bd'); if(b) b.classList.remove('stun'); if(S().phase === 'play') msg(playMsg()); }, STUN * 1000);
      return;
    }
    G.paws = left;
    if(!left){ hud(); lose('기회를 다 썼어요', 'miss'); return; }
    msg('<b class="bad">앗, 밤송이!</b><span>기회 ' + left + '번 남음</span>', 'mn-pop');
    T(() => { if(S().phase === 'play') msg(playMsg()); }, 1400);
  }

  /* 힌트: 지금 보이는 것만으로 확실한 칸 하나를 알려 준다(안전한 칸 우선) */
  function clearHint(){ document.querySelectorAll('.ng-mines .mn-cell.hint').forEach(e => e.classList.remove('hint')); }
  function playerKnown(m){ const k = new Uint8Array(m.N); for(let i = 0; i < m.N; i++) k[i] = m.stone[i] ? 3 : m.st[i] === 1 ? 1 : m.st[i] === 3 ? 2 : 0; return k; }
  /* 다음 한 수: 지금 보이는 것(열린 칸·터진 밤송이, 깃발은 틀릴 수 있어 빼고)에서 논리로 확실한 칸.
     덮인 안전 칸을 먼저, 없으면 아직 깃발 없는 확실한 밤송이. 이미 깃발 꽂힌 밤송이만 나오면 그걸 알고 한 단계 더 추론한다 */
  function nextMove(m){
    const known = playerKnown(m);
    for(let g = 0; g < 400; g++){
      const d = deduce(m, known, m.mines); if(!d) break;
      const s = d.safe.find(j => m.st[j] === 0); if(s != null) return { i:s, safe:true };
      const x = d.mine.find(j => m.st[j] === 0); if(x != null) return { i:x, safe:false };
      d.mine.forEach(j => { known[j] = 2; }); d.safe.forEach(j => { known[j] = 1; });
    }
    for(let j = 0; j < m.N; j++) if(m.st[j] === 0 && !m.mine[j] && !m.stone[j]) return { i:j, safe:true };   /* (거의 없음) 안전 칸이 깃발 밑에만 남음 등 */
    return null;
  }
  function useHint(){
    const m = S(); if(!canPlay() || m.hintLeft <= 0) return;
    const mv = nextMove(m); if(!mv) return;
    const i = mv.i, safe = mv.safe;
    m.hintLeft--; m.hints++; hud(); clearHint();
    const el = cellEl(i); if(el) el.classList.add('hint');
    msg('<b>' + (safe ? '이 칸은 안전해요' : '여기는 밤송이예요') + '</b>', 'mn-pop');
    sfx('minesHint');
    T(() => { clearHint(); if(S().phase === 'play') msg(playMsg()); }, 2200);
  }

  /* 시계 */
  const remTime = t => Math.max(0, G.limit - t);
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed(), bar = $('#mnBar');
    if(m.phase === 'ready'){ if(t >= .3){ m.phase = 'play'; msg(playMsg()); sfx('minesGo'); } return; }
    if(m.phase !== 'play') return;
    const rem = remTime(t), sec = Math.ceil(rem);
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#mnTime'); if(e) e.textContent = mmss(sec);
      const p = $('#mnTimeP'); if(p) p.classList.toggle('warn', sec <= 10);
      const b = $('#mnBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0) sfx('minesTick', { hi:sec <= 5 });
    }
    if(rem <= 0){ const e = $('#mnTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요', 'time'); }
  }
  function revealAll(){
    const m = S();
    for(let i = 0; i < m.N; i++){
      if(m.mine[i] && m.st[i] === 0){ const e = cellEl(i); if(e){ e.classList.add('show'); e.innerHTML = BURR; } }
      else if(!m.mine[i] && m.st[i] === 2){ const e = cellEl(i); if(e) e.classList.add('wrong'); }
    }
  }
  function win(){
    const m = S(); m.phase = 'done'; m.sec = elapsed();
    for(let i = 0; i < m.N; i++) if(m.mine[i] && m.st[i] === 0){ m.st[i] = 2; redraw(i, 'plant'); }
    hud();
    msg('<b>밤송이를 모두 찾았어요!</b>', 'mn-win');
    sfx('win', { g:'mines' }); fxBuzz([30, 50, 30]);
    try{ const bd = $('#bd'); if(bd){ bd.classList.add('cleared'); const p = fxCenter(bd); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); fxBurst(p.x, p.y, ['#FFE27A', '#FFB45A', '#86C33A', '#fff'], 26, { speed:340, size:6, kinds:['star', 'dot', 'spark'], up:140, g:420, glow:true, dur:1 }); } }catch(_){}
    T(() => finish(true), 1000);
  }
  function lose(text, why){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.fail = why;
    msg('<b class="bad">' + text + '</b><span>남은 칸 ' + (m.safeTotal - m.opened) + '개</span>', 'mn-pop');
    sfx('minesTimeUp'); fxBuzz([40, 40, 60]);
    try{ fxShake($('#bd'), 6); }catch(_){}
    revealAll();
    T(() => finish(false), 1500);
  }

  /* ----- 입력: 누르기 = 지금 모드, 길게 누르기 = 반대 동작(열기 모드면 깃발), 마우스 오른쪽 = 깃발 ----- */
  function wire(){
    const m = S(), bd = $('#bd');
    let press = null;
    const end = () => { if(press){ clearTimeout(press.tm); const e = cellEl(press.i); if(e) e.classList.remove('hold'); } press = null; };
    bd.oncontextmenu = e => e.preventDefault();
    bd.onpointerdown = e => {
      const el = e.target.closest && e.target.closest('.mn-cell'); if(!el) return;
      e.preventDefault();
      const i = +el.dataset.i;
      if(e.button === 2){ end(); act(i, 'flag'); return; }
      end();
      press = { i, x:e.clientX, y:e.clientY, long:false };
      if(m.st[i] === 0 || m.st[i] === 2){
        el.classList.add('hold');
        press.tm = setTimeout(() => { if(!press) return; press.long = true; const e2 = cellEl(press.i); if(e2) e2.classList.remove('hold'); act(press.i, m.mode === 'open' ? 'flag' : 'open'); }, 380);
      }
    };
    bd.onpointermove = e => { if(press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 14) end(); };
    bd.onpointerup = e => { if(!press) return; const p = press; end(); if(!p.long) act(p.i, m.mode); };
    bd.onpointercancel = bd.onpointerleave = () => end();
    bd.onkeydown = e => {
      const el = e.target.closest && e.target.closest('.mn-cell'); if(!el) return;
      const i = +el.dataset.i, c = m.cols;
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); act(i, m.mode); return; }
      if(e.key === 'f' || e.key === 'F'){ e.preventDefault(); act(i, 'flag'); return; }
      const d = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-c, ArrowDown:c }[e.key];
      if(d != null){ e.preventDefault(); const j = i + d; if(j >= 0 && j < m.N && !(Math.abs(d) === 1 && Math.floor(j / c) !== Math.floor(i / c))){ const t = cellEl(j); if(t && t.focus) t.focus(); } }
    };
    document.querySelectorAll('.ng-mines .mn-mode button').forEach(b => b.onclick = () => { if(m.noflag && b.dataset.m === 'flag') return; m.mode = b.dataset.m; sfx('minesMode'); hud(); });
    const h = $('#mnHint'); if(h) h.onclick = useHint;
  }

  return {
    name:'지뢰찾기', abil:'논리력', col:['#FFD9A8', '#E07B2A', '#8A3F0E'], time:'약 4분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12.5" r="6.4"/><path d="M12 1.8l1.3 4h-2.6zM12 23.2l-1.3-4h2.6zM1.3 12.5l4-1.3v2.6zM22.7 12.5l-4 1.3v-2.6zM4.4 4.9l3.7 2-1.8 1.8zM19.6 20.1l-3.7-2 1.8-1.8zM19.6 4.9l-2 3.7-1.8-1.8zM4.4 20.1l2-3.7 1.8 1.8z"/></svg>',
    art(){
      const u = 'mnA' + Math.floor(performance.now() * 1000 % 1e6);
      const T0 = (x, y, kind, v) => {
        const base = kind !== 'o' ? `<rect x="${x}" y="${y}" width="20" height="20" rx="4" fill="#8CCB4A" stroke="${OL}" stroke-width="2"/><path d="M${x + 4} ${y + 5}h8" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5"/>`
          : `<rect x="${x}" y="${y}" width="20" height="20" rx="4" fill="#FFF3DC" stroke="${OL}" stroke-width="2"/>`;
        const n = v ? `<text x="${x + 10}" y="${y + 15.5}" font-size="14" font-weight="900" text-anchor="middle" fill="${numCol(v)}">${v}</text>` : '';
        const f = kind === 'f' ? `<path d="M${x + 7} ${y + 17}V${y + 3}" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/><path d="M${x + 8} ${y + 3.5}l8 3-8 3.5z" fill="#FF5A3C" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` : '';
        return base + n + f;
      };
      const G0 = [['o', 0, 'o', 1, 'o', 1, 'h', 0, 'h', 0], ['o', 1, 'o', 2, 'o', 3, 'f', 0, 'h', 0], ['o', 1, 'h', 0, 'h', 0, 'h', 0, 'h', 0]];
      let tiles = '';
      G0.forEach((row, r) => { for(let c = 0; c < 5; c++) tiles += T0(28 + c * 22, 18 + r * 22, row[c * 2] === 'o' ? 'o' : row[c * 2], row[c * 2] === 'o' ? row[c * 2 + 1] : 0); });
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7C2"/><stop offset="1" stop-color="#F2A55A"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <g opacity=".55"><path d="M12 20c4-6 10-6 12 0-4 4-8 4-12 0z" fill="#E8742A"/><path d="M140 82c4-6 10-6 12 0-4 4-8 4-12 0z" fill="#C9541C"/><path d="M146 14c3-5 8-5 10 0-3 3-7 3-10 0z" fill="#FFB45A"/></g>
        ${tiles}
        <svg x="118" y="56" width="34" height="34" viewBox="0 0 64 64">${BURR_IN}</svg></svg>`;
    },
    help:[
      ['숫자는 둘레 밤송이 수', '덮인 나뭇잎 칸 아래에 밤송이가 숨어 있어요. 연 칸의 숫자는 둘레 8칸에 있는 밤송이 수예요. 첫 칸은 미리 열어 뒀어요.'],
      ['열기 · 깃발', '아래 단추로 열기/깃발 모드를 바꿔요. 길게 누르면 지금 모드와 반대로(열기 모드면 깃발) 해요. 깃발을 다 꽂은 숫자를 누르면 둘레가 한꺼번에 열려요.'],
      ['기회는 3번', '밤송이를 열면 기회(★) 하나를 잃고 계속해요. 세 번이면 끝! 모든 판은 찍지 않고 논리로 풀 수 있어요. 확실한 칸만 여세요.'],
      ['시간 안에 다 열어요', '밤송이가 아닌 칸을 모두 열면 성공. 막히면 💡힌트가 확실한 칸 하나를 알려 줘요(점수 조금 줄어요).'],
      ['솔로: 5판마다 새 규칙', '솔로에서는 바위 칸·안개 칸·십자 숫자·넓은 숫자 같은 새 규칙과 번개·깃발 없이·외줄 타기 같은 변주가 5판마다 하나씩 나와요.']
    ],
    helpExtra(){ const m = G && G.id === 'mines' && G.m; if(!m) return []; const r = []; if(m.lives === 0) r.push(['대전 규칙', '대전은 기회 제한이 없어요. 대신 밤송이를 열면 ' + STUN + '초 동안 못 누르고 점수가 줄어요.']); if(m.tips.length) r.push(['이번 판 규칙', m.tips.join(' · ')]); return r; },
    chapters:['도토리 언덕', '밤나무 숲', '단풍 골짜기', '버섯 오솔길', '달빛 숲속'],
    starRule:'★ 클리어 · ★★ 힌트·밤송이 1번 이하 · ★★★ 힌트·밤송이 없이',
    levels:{
      easy:{ cols:8, rows:10, mines:10, limit:180, hints:2 },
      normal:{ cols:9, rows:12, mines:18, limit:270, hints:2 },
      hard:{ cols:10, rows:14, mines:28, limit:390, hints:2 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.cols}×${c.rows} · 밤송이 ${c.mines} · ${mmss(c.limit)}${c.lives === 1 ? ' · 기회 1번' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.cols}×${c.rows} · 밤송이 ${c.mines}`; },
    init(cfg, rng){
      const b = deal(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      const known = new Uint8Array(b.N); for(let i = 0; i < b.N; i++) if(b.stone[i]) known[i] = 3;
      G.m = Object.assign(b, {
        st:new Uint8Array(b.N), known, safeTotal:b.N - b.stoneN - b.mines, opened:0, flags:0, hits:0, hints:0,
        hintLeft:cfg.hints == null ? 2 : cfg.hints, lives:G.duel ? 0 : cfg.lives || LIVES,   /* 대전은 기회 제한 없음(0) — 대신 잠깐 못 누름 */
        mode:'open', noflag:!!cfg.noflag, phase:'ready', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips,
        stunUntil:0, lastSec:-1, sec:0, fail:null, timers:new Set()
      });
      const m = G.m;
      /* 첫 칸은 씨앗이 정해 미리 열어 둔다(모두 같은 문제) */
      for(const j of flood(m, known, m.start, q => !m.mine[q])){ m.st[j] = 1; m.opened++; }
      G.limit = cfg.limit; if(m.lives) G.paws = m.lives;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
      /* 테스트·도구용: 논리로 확실한 칸을 차례로 열어 끝까지 푼다(깃발도 꽂음) */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.opened); return; }
          if(m.phase !== 'play' || (m.stunUntil && elapsed() < m.stunUntil)){ setTimeout(step, 80); return; }
          const mv = nextMove(m);
          if(mv && mv.safe) act(mv.i, 'open');
          else if(mv && !m.noflag) act(mv.i, 'flag');
          else if(mv){ const s = m.st.findIndex((v, j) => v === 0 && !m.mine[j] && !m.stone[j]); if(s >= 0) act(s, 'open'); }
          setTimeout(step, 30);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _deal:deal, _solve:solve, _stage:stageCfg,
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-mines">
        <div class="hud-row">
          <div class="hchip" aria-label="남은 밤송이"><span class="hv">${ICO.burr}<b id="mnLeft">${m.mines}</b></span><em>남은 밤송이</em></div>
          <div class="hchip time" id="mnTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="mnTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
          <button class="hchip item" id="mnHint" aria-label="힌트"><span class="hv">${ICO.hint}<b>${m.hintLeft}</b></span><em>힌트</em></button>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="mn-rules" aria-label="켜진 규칙">${m.boss ? '<span class="mn-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="mn-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="mn-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="mn-barw" id="mnBarWrap"><i id="mnBar"></i></div>
        <div class="mn-row"><div class="hlives" id="mnLives" role="img"></div><div class="mn-msg" id="mnMsg"><span>숲을 살피는 중…</span></div></div>
        <div class="mn-board in" id="bd" role="grid" aria-label="밤숲 판"></div>
        <div class="tools-row mn-mode${m.noflag ? ' noflag' : ''}" role="group" aria-label="누르기 모드">
          <button class="tool toggle" data-m="open" aria-pressed="true">${ICO.dig}<span>열기</span></button>
          <button class="tool toggle" data-m="flag" aria-pressed="false"${m.noflag ? ' disabled' : ''}>${ICO.flag}<span>${m.noflag ? '깃발 없음' : '깃발'}</span></button>
        </div>
      </div>`;
      build(); wire(); hud();
      T(() => { const b = $('#bd'); if(b) b.classList.remove('in'); }, 800);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m && m.safeTotal ? m.opened / m.safeTotal : 0; },
    lossText(){ const m = G.m; return (m.fail === 'miss' ? '기회를 다 썼어요. ' : '') + `안전한 칸 ${m.opened}/${m.safeTotal}칸을 열었어요.`; },
    score(){
      const m = G.m, sec = Math.max(0, Math.min(G.limit, m.sec || elapsed()));
      const time = Math.max(0, 350 - Math.floor(sec * 350 / G.limit));
      const extra = Math.max(0, 150 - 50 * m.hits - 40 * m.hints);
      return { base:500, time, extra, rows:['밤숲 모두 열기', '시간 보너스 (' + mmss(sec) + ')', `밤송이 ${m.hits} · 힌트 ${m.hints}`] };
    },
    stars(){ const m = G.m, n = m.hits + m.hints; return n === 0 ? 3 : n <= 1 ? 2 : 1; },
    css:`
body[data-mode="mines"] .ptitle{font-family:var(--heavy); font-size:20px; letter-spacing:.5px}   /* 제목 '지뢰찾기': Jua에서는 ㅚ가 작아 '지리찾기'처럼 읽힘 */
body[data-mode="mines"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.22) 0 3px, transparent 3.5px) 0 0/44px 44px,
  linear-gradient(180deg,#FFF0D6 0%,#FFD29A 55%,#F2A55A 100%) fixed}
.ng-mines{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none}
.ng-mines .hud-row{margin:0}
.ng-mines .hchip.time.warn{background:linear-gradient(180deg,#FFE3E4,#FFB3B6)}
.ng-mines .hchip .hv svg{overflow:visible}
.ng-mines .mn-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid #1A0F45; overflow:hidden}
.ng-mines .mn-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#FFD27A,#F08A24); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-mines .mn-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-mines .mn-row{display:flex; align-items:center; gap:8px; width:100%; height:38px}
.ng-mines .hlives{flex:none}
.ng-mines .hlives i.lost{animation:mines-lost .5s ease-out}
.ng-mines .hlives.last{background:#FFE3E3; animation:mines-last 1s ease-in-out infinite alternate}
@keyframes mines-lost{0%{transform:scale(1.5); color:#FF4D6D} 100%{transform:none}}
@keyframes mines-last{to{box-shadow:0 2px 0 #1A0F45, 0 0 10px 3px rgba(255,77,109,.6)}}
.ng-mines .mn-msg{flex:1; min-width:0; overflow:hidden; height:38px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#6A3410; white-space:nowrap}
.ng-mines .mn-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px}
.ng-mines .mn-msg b.boss{color:#FFE27A}
.ng-mines .mn-msg b.bad{color:#FF8A8F}
.ng-mines .mn-msg.mn-pop, .ng-mines .mn-msg.mn-win{animation:mines-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-mines .mn-msg.mn-win b{font-size:22px; color:#FFE27A}
@keyframes mines-in{from{transform:scale(.6); opacity:0}}
.ng-mines .mn-board{position:relative; display:grid; width:max-content; margin:auto -8px; max-width:calc(100% + 16px); gap:var(--gap); padding:var(--pad); border-radius:18px; justify-content:center;
  background:linear-gradient(180deg,#6B4425,#553319); border:3px solid #1A0F45;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.18), 0 5px 0 #1A0F45, 0 14px 22px rgba(120,60,10,.25); touch-action:none}
.ng-mines .mn-board.in .mn-cell{animation:mines-deal .4s cubic-bezier(.2,1.5,.4,1) both}
.ng-mines .mn-board.in .mn-cell:nth-child(3n){animation-delay:.05s}
.ng-mines .mn-board.in .mn-cell:nth-child(3n+1){animation-delay:.1s}
@keyframes mines-deal{from{transform:scale(.5); opacity:0}}
.ng-mines .mn-board.stun{filter:saturate(.5) brightness(.9)}
.ng-mines .mn-board.stun .mn-cell{pointer-events:none}
.ng-mines .mn-board.cleared{animation:mines-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes mines-cheer{40%{transform:scale(1.04)}}
.ng-mines .mn-cell{position:relative; width:var(--cw); height:var(--cw); padding:0; border:0; margin:0; display:grid; place-items:center; border-radius:calc(var(--cw) * .2);
  -webkit-tap-highlight-color:transparent; outline:none; font:inherit; color:inherit; box-sizing:border-box}
.ng-mines .mn-cell > svg{width:82%; height:82%; display:block; overflow:visible; pointer-events:none}
.ng-mines .mn-cell.hid{cursor:pointer; border:2px solid #1A0F45; background:
  radial-gradient(circle at 30% 26%, rgba(255,255,255,.55) 0 12%, transparent 13%),
  linear-gradient(180deg,#A6DA62 0%,#7DBF3F 100%);
  box-shadow:inset 0 -3px 0 rgba(40,90,10,.28), 0 2px 0 #1A0F45; transition:transform .1s}
.ng-mines .mn-cell.hid:nth-child(odd){background:radial-gradient(circle at 30% 26%, rgba(255,255,255,.55) 0 12%, transparent 13%), linear-gradient(180deg,#9AD258 0%,#74B636 100%)}
.ng-mines .mn-cell.hid.hold{transform:scale(.9); filter:brightness(1.12)}
.ng-mines .mn-cell.hid.peek{filter:brightness(1.25); transform:scale(.93)}
.ng-mines .mn-cell.hid:focus-visible{box-shadow:0 0 0 3px #FFE27A, 0 0 0 5px #1A0F45}
.ng-mines .mn-cell.flag > svg{width:78%; height:78%}
.ng-mines .mn-cell.plant > svg{animation:mines-plant .35s cubic-bezier(.2,1.6,.4,1)}
@keyframes mines-plant{from{transform:translateY(-40%) scale(.4); opacity:0}}
.ng-mines .mn-cell.op{background:#FFF3DC; border:2px solid rgba(26,15,69,.35); box-shadow:inset 0 2px 3px rgba(120,60,10,.18); cursor:default}
.ng-mines .mn-cell.op.zero{background:#F7E6C6; border-color:rgba(26,15,69,.18)}
.ng-mines .mn-cell.op b{font-family:var(--heavy); font-weight:400; font-size:calc(var(--cw) * .62); line-height:1; -webkit-text-stroke:1.2px rgba(26,15,69,.55); paint-order:stroke fill; pointer-events:none}
.ng-mines .mn-cell.op.cross .mk-x{position:absolute; left:2px; top:2px; width:calc(var(--cw) * .3); height:calc(var(--cw) * .3); pointer-events:none;
  background:linear-gradient(#1A0F45,#1A0F45) center/100% 28% no-repeat, linear-gradient(#1A0F45,#1A0F45) center/28% 100% no-repeat; opacity:.7}
.ng-mines .mn-cell.op.cross{background:#E8F3FF}
.ng-mines .mn-cell.op.wide{background:#FFF0F6}
.ng-mines .mn-cell.op.wide::after{content:''; position:absolute; inset:3px; border-radius:50%; border:2px dashed rgba(232,62,140,.75); pointer-events:none}
.ng-mines .mn-cell.op.fog{background:#ECE8F7}
.ng-mines .mn-cell.op.fog > svg{width:86%; height:86%}
.ng-mines .mn-cell.pop{animation:mines-pop .3s cubic-bezier(.2,1.5,.4,1) both}
@keyframes mines-pop{from{transform:scale(.4); opacity:.2}}
.ng-mines .mn-cell.boom{background:radial-gradient(circle,#FFD0C8 0%,#FF7B6B 100%); border:2px solid #1A0F45}
.ng-mines .mn-cell.blast{animation:mines-blast .45s cubic-bezier(.2,1.6,.4,1)}
@keyframes mines-blast{0%{transform:scale(1.5)} 100%{transform:none}}
.ng-mines .mn-cell.hid.show, .ng-mines .mn-cell.hid.show:nth-child(odd){background:#E9DCC4; border-color:rgba(26,15,69,.4); box-shadow:none}
.ng-mines .mn-cell.show > svg{opacity:.85}
.ng-mines .mn-cell.hid.wrong, .ng-mines .mn-cell.hid.wrong:nth-child(odd){background:#FFD6D6}
.ng-mines .mn-cell.wrong::after{content:''; position:absolute; inset:18%; background:linear-gradient(45deg,transparent 42%,#E5484D 42% 58%,transparent 58%), linear-gradient(-45deg,transparent 42%,#E5484D 42% 58%,transparent 58%)}
.ng-mines .mn-cell.stone{background:#C9C3DA; border:2px solid rgba(26,15,69,.5); box-shadow:inset 0 2px 0 rgba(255,255,255,.4)}
.ng-mines .mn-cell.hint{animation:mines-hint .6s ease-in-out infinite alternate; z-index:2}
@keyframes mines-hint{to{box-shadow:0 0 0 3px #FFE27A, 0 0 14px 6px rgba(255,214,90,.95); transform:scale(1.06)}}
.ng-mines .mn-mode{margin:12px 0 0; width:min(100%, 360px)}
.ng-mines .mn-mode .tool{flex-direction:row; gap:8px; min-height:54px; font-size:18px}
.ng-mines .mn-mode .tool svg{width:24px; height:24px}
.ng-mines .mn-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-mines .mn-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#5A2E0E; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-mines .mn-chip.mj{background:#FFF0DC; color:#A04A10}
.ng-mines .mn-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-mines .mn-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
@media (max-width:370px){ .ng-mines .mn-msg b{font-size:18px} .ng-mines .mn-chip{font-size:12px; padding:4px 7px} }
@media (prefers-reduced-motion: reduce){ .ng-mines .mn-cell.pop, .ng-mines .mn-board.in .mn-cell, .ng-mines .mn-cell.hint, .ng-mines .mn-cell.plant > svg{animation:none} }
`,
    sounds:{
      minesOpen(){ aNoise({ ft:'bandpass', f:1800, q:1.4, d:.05, v:.07 }); aTone({ f:720, f2:900, type:'triangle', d:.07, v:.05 }); },
      minesWide(o){ const n = Math.min(6, Math.floor((o.n || 6) / 6)); aWhoosh({ f:600, f2:2600, a:.02, d:.22, v:.05 }); for(let k = 0; k < 3 + n; k++) aMarimba(penta(k + 2, 67), { t:k * .045, v:.09 }); },
      minesFlag(o){ if(o.off){ aTone({ f:640, f2:480, type:'triangle', d:.07, v:.05 }); return; } aThump({ f:220, f2:120, d:.08, v:.1 }); aTone({ f:980, f2:1180, type:'triangle', d:.08, v:.05 }); },
      minesPeek(){ aTone({ f:420, f2:380, type:'triangle', d:.06, v:.04 }); },
      minesBoom(){ aThump({ f:160, f2:50, d:.35, v:.28 }); aNoise({ ft:'lowpass', f:1400, q:.8, d:.3, v:.12 }); aTone({ f:330, f2:180, type:'triangle', d:.25, v:.08 }); },
      minesHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      minesMode(){ aTone({ f:880, type:'triangle', d:.05, v:.04, bus:'ui' }); },
      minesGo(){ aWhoosh({ f:2400, f2:600, a:.03, d:.25, v:.05 }); aBell({ f:m2f(84), t:.12, d:.5, v:.06, rev:.3 }); },
      minesTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      minesTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ minesOpen:40, minesTick:250, minesFlag:40, minesPeek:80 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 69), { t:i * .08, v:.16 })); [79, 83, 86, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();

/* 대전: AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat = 열린 안전 칸) */
Object.assign(NG.mines, { duelPace:[150, .72], duelStat:{ unit:'칸', get:() => ({ v:G.m.opened, t:G.m.safeTotal, lf:null }) }, duelHow:'같은 밤숲, 누가 먼저 다 열까?' });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.mines.scene = { kind:'petals', colors:['#FFB45A', '#E8742A', '#FFD27A', '#C9541C'], density:.8 };
