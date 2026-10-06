/* 숫자 합치기 */
/* ===== 숫자 합치기 (merge) · 4×4 밀어서 합치는 퍼즐 =====
   규칙: 밀면 모든 타일이 끝까지 미끄러지고, 같은 숫자는 한 번씩 합쳐져 두 배가 된다.
   움직임이 생긴 뒤마다 빈칸 하나에 새 타일(2: 90%, 4: 10%). 새 타일의 자리·값은 "몇 번째 이동인지"로 정해진
   rng 수열에서 꺼내므로 되돌리기를 해도 같은 수가 나온다(같은 씨앗 + 같은 이동 = 같은 판).
   세대별 테스트(2026-10-06, 21번 문서 WP9): 레벨 = 숫자 키우기가 아니라 "목표 종류 7가지"의 조합.
     A 숫자 만들기 · B 여러 개 만들기 · C 이동 제한 · D 얼음 깨기 · E 별 칸 배달 · F 미리 보기 퍼즐 · G 점수 목표.
   오늘의 문제는 이동 제한 + 목표 조합(무작위로 눌러서는 못 깨게, tools/random-bot.mjs로 점검). */
NG.merge = (() => {
  const ST = -1, SLIDE_MS = 110;
  /* par = 잘 두는 사람 기준 이동 수. 자동 플레이어로 측정:
     2수 탐색 AI 중앙값: 32→19, 64→38, 128→67, 256→132, 512→247, 1024→490 (30판). 약한 1수 AI는 256→158, 512→273. */
  const PAR = { 16:9, 32:19, 64:38, 128:67, 256:132, 512:247, 1024:490, 2048:980 };
  const parOf = t => PAR[t] || Math.round(t * 0.48);
  /* 새 오늘의 문제·대전·솔로 규칙은 이 날짜(0시)부터. 그 전 날짜의 오늘의 문제는 예전 그대로(같은 날 문제가 바뀌지 않게) */
  const NEW_FROM = '2026-10-07';
  /* 판 크기 N(4 기본, '좁은 판'은 3). 칸 값 v[i]: 0 빈칸, -1 돌, 짝수 음수 = 자물쇠 타일(값의 음수),
     홀수 음수 = 얼음 타일 -(값×16 + 남은 맞기 수×2 + 1), 그 밖엔 값.
     방향: 0 위, 1 오른쪽, 2 아래, 3 왼쪽. 각 줄은 "미는 쪽 끝"부터 순서대로 */
  const GEO = {};
  function geo(N){
    if(GEO[N]) return GEO[N];
    const C = N * N, L = [0, 1, 2, 3].map(d => {
      const out = [];
      for(let k = 0; k < N; k++){
        const l = [];
        for(let j = 0; j < N; j++){
          if(d === 0) l.push(j * N + k); else if(d === 2) l.push((N - 1 - j) * N + k);
          else if(d === 3) l.push(k * N + j); else l.push(k * N + (N - 1 - j));
        }
        out.push(l);
      }
      return out;
    });
    /* 판 평가용 뱀 모양 가중치(8가지 대칭 중 가장 좋은 쪽 = 구석 전략) */
    const snake = new Array(C);
    for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){ const s = r * N + (r % 2 ? N - 1 - c : c); snake[r * N + c] = Math.pow(4, (C - 1 - s) / 3); }
    const tr = [(r, c) => [r, c], (r, c) => [r, N - 1 - c], (r, c) => [N - 1 - r, c], (r, c) => [N - 1 - r, N - 1 - c], (r, c) => [c, r], (r, c) => [c, N - 1 - r], (r, c) => [N - 1 - c, r], (r, c) => [N - 1 - c, N - 1 - r]];
    const SYM = tr.map(f => { const w = new Array(C); for(let i = 0; i < C; i++){ const [r, c] = f(Math.floor(i / N), i % N); w[r * N + c] = snake[i]; } return w; });
    /* 이웃 칸(상하좌우) — 얼음 맞기 판정 */
    const NB = []; for(let i = 0; i < C; i++){ const r = Math.floor(i / N), c = i % N, a = []; if(r) a.push(i - N); if(r < N - 1) a.push(i + N); if(c) a.push(i - 1); if(c < N - 1) a.push(i + 1); NB.push(a); }
    return (GEO[N] = { N, C, L, SYM, NB });
  }
  const LINES = geo(4).L;
  const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const log2 = v => Math.round(Math.log2(v));
  const eul = v => '을을를을를를을을을를'[v % 10] === '를' ? v + '를' : v + '을';   /* 숫자 뒤 조사: 2 이→를, 8 팔→을 */
  const sizeOf = v => v.length === 9 ? 3 : 4;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  /* 얼음 타일(D): 움직이지 않고 벽처럼 줄을 끊는다. 바로 옆(상하좌우) 칸에서 합치기가 일어나면 한 번 맞음(금), 두 번이면 깨져 보통 타일이 된다 */
  const ICE_HP = 2;
  const isIce = x => x < -1 && ((-x) & 1) === 1, mkIce = (val, h) => -(val * 16 + h * 2 + 1), iceVal = x => (-x) >> 4, iceHp = x => ((-x) >> 1) & 7;

  /* ---------- 숫자만 다루는 엔진(자동 플레이어·막힘 판정·시뮬레이션용) ----------
     돌·자물쇠·얼음 타일은 벽처럼 줄을 끊는다. 자물쇠 타일 쪽으로 미끄러져 온 첫 타일이 같은 숫자면
     둘이 합쳐지며 자물쇠가 풀린다(합친 타일은 자물쇠 자리에 남고, 그 판에는 더 합쳐지지 않음).
     cells를 주면 합쳐진 타일이 놓인 칸을 담는다(얼음 맞기 판정용). */
  function slideV(v, d, N = sizeOf(v), cells = null){
    const o = v.slice(), buf = []; let moved = false, pts = 0, mc = 0;
    for(const line of geo(N).L[d]){
      let a = 0;   /* 벽(돌·자물쇠·얼음) 사이 구간 line[a..b-1]을 앞쪽(line[a])으로 민다 */
      for(let b = 0; b <= N; b++){
        if(b < N && v[line[b]] >= 0) continue;
        if(b > a){
          buf.length = 0; for(let j = a; j < b; j++){ const x = o[line[j]]; if(x > 0) buf.push(x); }
          let s = 0, w = a;
          if(a > 0){ const f = line[a - 1]; if(o[f] < -1 && buf.length && buf[0] === -o[f]){ o[f] = buf[0] * 2; pts += o[f]; mc++; moved = true; s = 1; if(cells) cells.push(f); } }
          for(let i = s; i < buf.length; i++){
            let nv = buf[i], mg = false;
            if(i + 1 < buf.length && buf[i] === buf[i + 1]){ nv *= 2; pts += nv; mc++; i++; mg = true; }
            const ci = line[w++]; if(o[ci] !== nv){ moved = true; o[ci] = nv; } if(mg && cells) cells.push(ci);
          }
          for(; w < b; w++){ const ci = line[w]; if(o[ci] !== 0){ moved = true; o[ci] = 0; } }
        }
        a = b + 1;
      }
    }
    return { v:o, moved, pts, mc };
  }
  /* 합친 칸 옆의 얼음을 한 번씩 때린다(한 번 밀 때 얼음 하나는 최대 1번). 깨진 수를 돌려줌 */
  function hitIce(v, cells, N = sizeOf(v)){
    if(!cells.length) return 0; const NB = geo(N).NB; let br = 0;
    for(let i = 0; i < v.length; i++){
      const x = v[i]; if(!isIce(x) || !NB[i].some(j => cells.includes(j))) continue;
      const h = iceHp(x) - 1; if(h <= 0){ v[i] = iceVal(x); br++; } else v[i] = mkIce(iceVal(x), h);
    }
    return br;
  }
  /* 한 번 밀기 = 미끄러짐 + 얼음 맞기 */
  function stepV(v, d, N = sizeOf(v)){ const cells = []; const r = slideV(v, d, N, cells); if(r.moved) hitIce(r.v, cells, N); r.cells = cells; return r; }
  /* 목표를 모두 채웠나(A·B 목표 숫자 개수, D 얼음 없음, E 별 칸, G 점수) */
  function goalV(c, v, pts, stars){
    if(c.target){ let n = 0; for(const x of v) if(x >= c.target) n++; if(n < (c.cnt || 1)) return false; }
    if(c.ice && v.some(isIce)) return false;
    if(c.star && stars) for(const i of stars) if(!(v[i] >= c.starV)) return false;
    if(c.pts && pts < c.pts) return false;
    return true;
  }
  /* 움직일 수 있는 방향이 하나라도 있나(ban = 막힌 방향, -1 없음) */
  function canMoveV(v, ban = -1){ const N = sizeOf(v); for(let d = 0; d < 4; d++) if(d !== ban && slideV(v, d, N).moved) return true; return false; }
  /* 자동 플레이어가 지금 판의 목표를 알게 하는 값(얼음·별 칸 가중) — simGame·화면 자동 풀기가 잠깐 켠다 */
  let GX = null;
  const goalCtx = (c, stars) => ({ c, stars:stars || [], ice:!!c.ice, starV:c.starV || 0 });
  const IDX = [], VAL = [];
  function evalV(v){
    const N = sizeOf(v), C = N * N, SYM = geo(N).SYM; let best = -Infinity, empty = 0, rough = 0, n = 0;
    for(let i = 0; i < C; i++){
      const x = v[i];
      if(x === 0){ empty++; continue; }
      if(x < 0) continue;
      IDX[n] = i; VAL[n++] = x;
      const l = 31 - Math.clz32(x);
      if(i % N < N - 1 && v[i + 1] > 0) rough += Math.abs(l - (31 - Math.clz32(v[i + 1])));
      if(i + N < C && v[i + N] > 0) rough += Math.abs(l - (31 - Math.clz32(v[i + N])));
    }
    for(let k = 0; k < 8; k++){ const w = SYM[k]; let s = 0; for(let j = 0; j < n; j++) s += VAL[j] * w[IDX[j]]; if(s > best) best = s; }
    if(!n) best = 0;
    let e = best + empty * 120 * (1 + empty * .15) - rough * 30;
    if(GX){
      if(GX.ice) for(let i = 0; i < C; i++) if(isIce(v[i])) e -= 2500 * iceHp(v[i]);
      for(const i of GX.stars){ const x = v[i]; if(x > 0) e += x >= GX.starV ? 9000 : 700 * (31 - Math.clz32(x)); }
    }
    return e;
  }
  const BR_FULL = [[2, .9], [4, .1]], BR_TWO = [[2, 1]];   /* two = 빠른 근사(새 타일을 2로만 가정) */
  function chanceV(v, depth, ban = -1, two = false){
    const N = sizeOf(v), em = []; for(let i = 0; i < v.length; i++) if(v[i] === 0) em.push(i);
    if(!em.length) return evalV(v);
    let s = 0;
    for(const i of em){
      for(const [val, p] of two ? BR_TWO : BR_FULL){
        v[i] = val;
        let b = -Infinity;
        if(depth > 0){ for(let d = 0; d < 4; d++){ if(d === ban) continue; const r = slideV(v, d, N); if(r.moved){ const e = chanceV(r.v, depth - 1, ban, two); if(e > b) b = e; } } }
        else b = evalV(v);
        if(b === -Infinity) b = evalV(v) - 1e7;
        s += p * b;
        v[i] = 0;
      }
    }
    return s / em.length;
  }
  /* 방향별 점수(움직일 수 없는 방향은 빠짐), 높은 순. 첫 수는 얼음 맞기까지 반영하고, 목표를 채우는 수는 맨 앞 */
  function rankMoves(v, depth = 0, ban = -1, two = false, pts = 0){
    const N = sizeOf(v), out = [];
    for(let d = 0; d < 4; d++){
      if(d === ban) continue; const r = GX ? stepV(v, d, N) : slideV(v, d, N); if(!r.moved) continue;
      if(GX && goalV(GX.c, r.v, pts + r.pts, GX.stars)){ out.push({ d, s:1e12 }); continue; }
      out.push({ d, s:chanceV(r.v, depth, ban, two) });
    }
    return out.sort((a, b) => b.s - a.s);
  }
  /* 가장 좋은 방향(없으면 -1). depth 0 = 한 수 + 평균, 1 = 두 수 */
  function aiMove(v, depth = 0, greedy = false, ban = -1, pts = 0){
    if(greedy){ for(const d of [2, 3, 1, 0]) if(d !== ban && slideV(v, d).moved) return d; return -1; }
    const r = rankMoves(v, depth, ban, false, pts); return r.length ? r[0].d : -1;
  }

  /* ---------- 새 판 만들기(화면·시뮬레이션 공용, 같은 난수면 같은 판) ----------
     rng를 꺼내는 순서: 돌 → 자물쇠 → 얼음 → 처음 놓인 타일(pre) → 별 칸 → 첫 타일 2개. 없는 것은 rng를 쓰지 않는다(예전 판과 같은 수열) */
  /* 돌 자리: 구석이 아닌 테두리 칸. 두 개면 한 구석을 막아 가두지 않게 */
  const EDGE = { 4:[1, 2, 4, 7, 8, 11, 13, 14], 3:[1, 3, 5, 7] };
  const CORNER_PAIRS = { 4:['1,4', '2,7', '8,13', '11,14'], 3:['1,3', '1,5', '3,7', '5,7'] };
  const ICE_VALS = [2, 4, 8];
  function spawnV(v, pair, p4){
    const em = []; for(let i = 0; i < v.length; i++) if(v[i] === 0) em.push(i);
    if(!em.length) return -1;
    const cell = em[Math.min(em.length - 1, Math.floor(pair[0] * em.length))]; v[cell] = pair[1] < p4 ? 4 : 2; return cell;
  }
  function initV(cfg, rng){
    const N = cfg.N || 4, C = N * N, v = new Array(C).fill(0), ns = cfg.stones || 0;
    if(ns){
      const ed = EDGE[N], got = [];
      for(let t = 0; got.length < ns && t < 60; t++){
        const c = ed[Math.floor(rng() * ed.length)];
        if(got.includes(c) || got.some(x => CORNER_PAIRS[N].includes(Math.min(x, c) + ',' + Math.max(x, c)))) continue;
        got.push(c);
      }
      for(const c of got) v[c] = ST;
    }
    /* 자물쇠·얼음 타일: 구석이 아닌 빈칸에 */
    const corners = [0, N - 1, C - N, C - 1], inner = () => { const em = []; for(let i = 0; i < C; i++) if(v[i] === 0 && !corners.includes(i)) em.push(i); return em; };
    for(const val of cfg.locks || []){ const em = inner(); if(!em.length) break; v[em[Math.floor(rng() * em.length)]] = -val; }
    for(let k = 0; k < (cfg.ice || 0); k++){ const em = inner(); if(!em.length) break; const c = em[Math.floor(rng() * em.length)]; v[c] = mkIce(ICE_VALS[Math.floor(rng() * ICE_VALS.length)], ICE_HP); }
    /* 처음부터 놓인 타일(짧은 퍼즐·오늘의 문제) */
    for(const val of cfg.pre || []){ const em = []; for(let i = 0; i < C; i++) if(v[i] === 0) em.push(i); if(!em.length) break; v[em[Math.floor(rng() * em.length)]] = val; }
    /* 별 칸(E): 구석이 아니고 벽이 아닌 칸(타일이 있어도 됨) */
    const stars = [];
    for(let k = 0; k < (cfg.star || 0); k++){ const em = []; for(let i = 0; i < C; i++) if(v[i] >= 0 && !corners.includes(i) && !stars.includes(i)) em.push(i); if(!em.length) break; stars.push(em[Math.floor(rng() * em.length)]); }
    for(let k = 0; k < 2; k++) spawnV(v, [rng(), rng()], .1);
    return { v, stars };
  }
  /* 한 수에 나오는 새 타일 수 — '쌍둥이 타일' 변주면 4번째 밀기마다 2개 */
  const spawnCount = (cfg, moves) => cfg.extra && moves % 4 === 0 ? 2 : 1;
  /* '막힌 길' 변주: 8번 밀 때마다 막힌 방향이 위 → 오른쪽 → 아래 → 왼쪽 순으로 바뀐다 */
  const ROT_EVERY = 8;
  const banOf = (cfg, moves) => cfg.rot ? Math.floor(moves / ROT_EVERY) % 4 : -1;
  const bestV = v => v.reduce((m, x) => x > m ? x : m, 0);

  /* 점수: 이동 제한 판은 "남긴 이동"이 효율 = (제한 − 이동) ÷ (제한 − par×0.8)(무작위로 겨우 깨면 400점 아래), 그 밖은 기준 이동(par) 대비 */
  function scoreOf(c, moves, undoUsed){
    const par = c.par || parOf(c.target || 128);
    if(c.mv){
      const good = Math.min(c.mv - 1, Math.round(par * .8)), eff = clamp01((c.mv - moves) / Math.max(1, c.mv - good));
      return { base:200, time:Math.round(700 * eff), extra:undoUsed ? 0 : Math.round(100 * eff) };   /* 되돌리기 안 쓴 보너스도 효율만큼 */
    }
    return { base:500, time:Math.round(350 * clamp01((1.6 * par - moves) / (0.8 * par))), extra:undoUsed ? 0 : 150 };
  }
  const scoreSum = s => s.base + s.time + s.extra;

  /* 사람 같은 자동 플레이어로 한 판(되돌리기 1번 포함) — 난이도 맞추기용. 규칙은 화면의 doMove와 같다.
     bot: { depth, eps, two, rng } — eps 확률로 가장 좋은 수 대신 두 번째(가끔 그 밖의) 수를 둔다
     bot.kind: 'greedy'(가장 큰 합치기) · 'lr'(←→ 번갈아) · 'ud'(↑↓) · 'cw'(시계 방향) · 'any'(아무거나) — 되돌리기 없이 */
  function simGame(cfg, rng, bot = {}){
    const depth = bot.depth == null ? 1 : bot.depth, two = bot.two !== false, eps = bot.eps == null ? .2 : bot.eps, br = bot.rng || rng, kind = bot.kind || 'ai';
    const B = initV(cfg, rng), stars = B.stars, N = cfg.N || 4; let v = B.v;
    const seq = [], p4 = cfg.p4 != null ? cfg.p4 : .1, lim = cfg.mv || 0;
    const pairAt = k => { while(seq.length <= k) seq.push(cfg.extra ? [rng(), rng(), rng(), rng()] : [rng(), rng()]); return seq[k]; };
    let moves = 0, pts = 0, undo = cfg.noUndo || kind !== 'ai' ? 0 : 1, used = false, snap = null, avoid = -1, lastD = -1, tries = 0;
    const gx0 = GX; GX = goalCtx(cfg, stars);
    const end = (win, why) => { const o = { win, moves, best:bestV(v), pts, why, undo:used }; if(win) o.score = scoreSum(scoreOf(cfg, moves, used)); return o; };
    try{
      for(let guard = 0; guard < 6000; guard++){
        const ban = banOf(cfg, moves); let d;
        if(kind === 'ai'){
          let r = rankMoves(v, depth, ban, two, pts); if(avoid >= 0) r = r.filter(x => x.d !== avoid);
          if(!r.length){
            if(undo && snap){ undo = 0; used = true; v = snap.v; moves = snap.moves; pts = snap.pts; avoid = lastD; snap = null; continue; }
            return end(false, 'stuck');
          }
          let pick = r[0];
          if(r.length > 1 && br() < eps) pick = r.length > 2 && br() < .3 ? r[2 + Math.floor(br() * (r.length - 2))] : r[1];
          d = pick.d;
        } else {
          if(!canMoveV(v, ban)) return end(false, 'stuck');
          if(++tries > 3000) return end(false, 'guard');
          if(kind === 'greedy'){ let bp = -1; for(const k of [2, 3, 1, 0]){ if(k === ban) continue; const r = slideV(v, k, N); if(r.moved && r.pts > bp){ bp = r.pts; d = k; } } }
          else if(kind === 'lr') d = tries % 2 ? 3 : 1;
          else if(kind === 'ud') d = tries % 2 ? 0 : 2;
          else if(kind === 'cw') d = tries % 4;
          else d = Math.floor(br() * 4);
          if(d === ban) continue;
        }
        const r = stepV(v, d, N); if(!r.moved) continue;
        snap = { v, moves, pts }; lastD = d; avoid = -1;
        const nv = r.v; moves++; pts += r.pts;
        if(goalV(cfg, nv, pts, stars)){ v = nv; return end(true); }
        const pr = pairAt(moves - 1); spawnV(nv, pr, p4); if(spawnCount(cfg, moves) > 1) spawnV(nv, [pr[2], pr[3]], p4);
        v = nv;
        if(lim && moves >= lim){
          if(undo){ undo = 0; used = true; v = snap.v; moves = snap.moves; pts = snap.pts; avoid = lastD; snap = null; continue; }
          return end(false, 'moves');
        }
      }
      return end(false, 'guard');
    } finally { GX = gx0; }
  }

  /* ---------- 화면용 타일 판: 새 타일은 n번째 이동 뒤 seq[n]에서 꺼낸다(되돌리기로 다른 수를 뽑을 수 없게) ---------- */
  function seqAt(M, k){ while(M.seq.length <= k) M.seq.push(M.extra ? [M.rng(), M.rng(), M.rng(), M.rng()] : [M.rng(), M.rng()]); return M.seq[k]; }
  function spawnInto(M, grid, pair){
    const em = []; for(let i = 0; i < grid.length; i++) if(!grid[i]) em.push(i);
    if(!em.length) return null;
    const cell = em[Math.min(em.length - 1, Math.floor(pair[0] * em.length))], v = pair[1] < M.p4 ? 4 : 2;
    const t = { id:++M.nid, v }; grid[cell] = t; return { cell, t };
  }
  const valsOf = g => g.map(x => x === ST ? ST : x ? (x.lk ? -x.v : x.ice ? mkIce(x.v, x.ice) : x.v) : 0);
  const bestOf = g => g.reduce((m, x) => x && x !== ST && !x.lk && !x.ice && x.v > m ? x.v : m, 0);
  const isWall = x => x === ST || !!(x && (x.lk || x.ice));

  /* 타일 객체 판에서 밀기: 합치기 목록과 이동 정보를 함께 돌려준다(규칙은 slideV와 같음) */
  function slideT(g, d){
    const o = g.slice(); let moved = false, pts = 0; const merges = [];
    for(const line of geo(sizeOf(g)).L[d]){
      let seg = [], front = -1;
      const run = () => {
        if(!seg.length) return;
        const ts = []; for(const i of seg) if(o[i]) ts.push(o[i]);
        let s = 0;
        const fr = front >= 0 ? o[front] : null;
        if(fr && fr !== ST && fr.lk && ts.length && ts[0].v === fr.v){
          const keep = { id:fr.id, v:fr.v * 2 }; merges.push({ keep:keep.id, gone:ts[0].id, v:keep.v, cell:front, unlock:true }); o[front] = keep; pts += keep.v; moved = true; s = 1;
        }
        const res = [];
        for(let i = s; i < ts.length; i++){
          if(i + 1 < ts.length && ts[i].v === ts[i + 1].v){
            const keep = { id:ts[i].id, v:ts[i].v * 2 }; res.push(keep); merges.push({ keep:keep.id, gone:ts[i + 1].id, v:keep.v, cell:-1 }); pts += keep.v; i++;
          } else res.push(ts[i]);
        }
        seg.forEach((ci, k) => { const nt = res[k] || null; const was = o[ci]; if((was && was.id) !== (nt && nt.id) || (was && nt && was.v !== nt.v)) moved = true; o[ci] = nt; });
        seg = [];
      };
      for(const i of line){ if(isWall(g[i])){ run(); front = i; } else seg.push(i); }
      run();
    }
    for(const m of merges) m.cell = o.findIndex(x => x && x !== ST && x.id === m.keep);
    /* 얼음 맞기(slideV + hitIce와 같은 규칙): 타일 객체는 새로 만들어 되돌리기 사진을 건드리지 않는다 */
    const hits = [];
    if(moved && merges.length){
      const NB = geo(sizeOf(g)).NB, cells = merges.map(m => m.cell);
      o.forEach((t, i) => { if(!t || t === ST || !t.ice || !NB[i].some(j => cells.includes(j))) return;
        const h = t.ice - 1; o[i] = h > 0 ? { id:t.id, v:t.v, ice:h } : { id:t.id, v:t.v }; hits.push({ cell:i, id:t.id, broke:h <= 0 }); });
    }
    return { g:o, moved, pts, merges, hits };
  }

  /* ---------- 목표 문장 ---------- */
  /* 판 설정 → 목표 한 줄. short: "40번 안에 64 이상 2개", 아니면 "40번 안에 64 이상 타일을 2개 만들어요" */
  function goalText(c, short){
    if(short){
      const b = []; if(c.target) b.push(c.cnt > 1 ? `${c.target} 이상 ${c.cnt}개` : String(c.target));
      if(c.ice) b.push(`얼음 ${c.ice}개`); if(c.star) b.push(`별 칸 ${c.starV}↑${c.star > 1 ? ' ' + c.star + '곳' : ''}`); if(c.pts) b.push(`점수 ${fmt(c.pts)}`);
      return (c.mv ? c.mv + '번 안에 ' : '') + b.join(' + ');
    }
    const acts = [];
    if(c.ice) acts.push(`얼음 ${c.ice}개를 깨`);
    if(c.star) acts.push(`별 칸${c.star > 1 ? ' ' + c.star + '곳' : ''}에 ${c.starV} 이상을 올려 두`);
    if(c.pts) acts.push(`합친 점수 ${fmt(c.pts)}점을 넘기`);
    if(c.target) acts.push(c.cnt > 1 ? `${c.target} 이상 타일을 ${c.cnt}개 만들` : `${eul(c.target)} 만들`);
    const END = { '깨':'깨요', '두':'둬요', '기':'겨요', '들':'들어요' }, last = acts.pop() || '';
    return (c.mv ? c.mv + '번 안에 ' : '') + acts.map(a => a + '고 ').join('') + last.slice(0, -1) + (END[last.slice(-1)] || last.slice(-1) + '요');
  }

  /* ---------- 오늘의 문제 · 대전 (2026-10-07부터) ----------
     쉬움 = B+C "40번 안에 64 이상 2개", 보통 = A+C+F "38번 안에 128, 다음 타일 2개 미리 보기", 어려움 = A+C+D "40번 안에 128 + 얼음 2개".
     처음 놓인 타일(pre)이 있어야 이동 안에 만들 수 있다(새 타일만으로는 40번에 합 88 정도). 자리는 날짜 씨앗으로 매일 다름.
     이동 수는 설계서 예시(50·60번)보다 짧다: 그만큼 주면 시계 방향으로 돌려 누르기만 해도 30~40%가 깨져서, 잘 두는 자동 플레이어 60~80% ·
     무작위 4종 합계 3% 이하가 되는 자리로 맞췄다(30~60일 측정). par = 잘 두는 자동 플레이어(2수 탐색) 중앙값 = 점수의 효율 기준 */
  const DAILY = {
    easy:  { limit:0, target:64,  cnt:2, mv:40, pre:[16, 16, 16, 8, 4], par:37, goals:'BC' },
    normal:{ limit:0, target:128, mv:38, peek:2, pre:[32, 32, 8, 4], par:33, goals:'ACF' },
    hard:  { limit:0, target:128, mv:40, ice:2, pre:[32, 16, 8, 4], par:38, goals:'ACD' }
  };
  const OLD_LEVELS = { easy:{ limit:0, target:128, stones:0 }, normal:{ limit:0, target:256, stones:0 }, hard:{ limit:0, target:512, stones:0 } };
  /* 대전: 같은 판·같은 새 타일 수열로 128 먼저(2분, 되돌리기 없음). 느긋하게는 4분 */
  const DUEL = { limit:120, target:128, pre:[16, 16, 8, 8, 4], noUndo:true, duel:true, par:44, goals:'A' };
  const dailyCfg = (lv, day) => (day || (typeof dayKey === 'function' ? dayKey() : NEW_FROM)) >= NEW_FROM ? DAILY[lv] || DAILY.normal : OLD_LEVELS[lv] || OLD_LEVELS.normal;

  /* ---------- 솔로: 목표 종류 7가지로 짠 레벨(세대별 테스트 2026-10-06, 21번 문서 WP9) ----------
     5판마다 새 개념(엔진 개념 사이클): 11 얼음 타일 · 21 별 칸 · 31 자물쇠 타일 · 41 좁은 판(3×3). 변주: 6 번개 · 16 4가 우르르 · 26 맨손 · 36 쌍둥이 타일 · 46 막힌 길.
     챕터마다 목표 종류를 바꾼다: 1 = A·B(최대 64) · 2 = C·D(최대 128) · 3 = E·F · 4 = G + 섞기 · 5 = 모두 섞기(최대 256). 51부터 리믹스(씨앗으로 고름).
     글자: A 숫자 만들기 · B 여러 개 · C 이동 제한 · D 얼음 깨기 · E 별 칸 배달 · F 미리 보기 퍼즐(처음 놓인 타일 + 다음 3개 보임 + 짧은 이동) · G 점수 목표(이동 제한 포함).
     난이도 손잡이 x(0~35): 0 = 이동 제한 없음(C·F·G 판은 넉넉한 제한), 1~35 = 이동 제한 = par × (2.3 − (x−1)×0.045).
     판마다 x는 사람 같은 자동 플레이어(2수 탐색 + 20% 두 번째 수 + 되돌리기 1번, 그 판 씨앗 그대로 40번)로 첫 도전 성공률 wantRate에 맞췄다(TUNE). */
  const GOALS = {
    1:['A', 'B', 'A', 'B', 'A', 'A', 'B', 'A', 'A', 'B'],
    2:['D', 'DC', 'D', 'DC', 'DC', 'AC', 'D', 'DC', 'D', 'DC'],
    3:['E', 'EF', 'E', 'ED', 'EF', 'F', 'E', 'EF', 'E', 'EDC'],
    4:['A', 'G', 'G', 'EG', 'G', 'G', 'AC', 'G', 'A', 'EG'],
    5:['A', 'B', 'C', 'G', 'DC', 'E', 'F', 'DC', 'A', 'BC']
  };
  const PRE_F = { '4:64':[16, 8, 8, 4, 2], '4:128':[32, 16, 16, 8, 4], '3:64':[16, 8, 4] };
  function goalsOf(p){
    if(p.c <= 5) return GOALS[p.c][p.k - 1];
    const r = mulberry(seedFrom('mgoal:' + p.c + ':' + p.k)), hI = p.mj.includes('ice'), hS = p.mj.includes('star');
    const pool = hI && hS ? ['DE', 'DEC'] : hI ? ['D', 'DC', 'AD', 'DG'] : hS ? ['E', 'EC', 'EG', 'EF'] : ['A', 'B', 'AC', 'BC', 'G', 'F'];
    return pool[Math.floor(r() * pool.length)];
  }
  /* 기준 이동 어림값(TUNE에 잰 값이 없는 101판부터) */
  function estPar(c){
    const spv = (2 + 2 * c.p4) * (c.extra ? 1.25 : 1), pre = (c.pre || []).reduce((a, b) => a + b, 0), lk = (c.locks || []).reduce((a, b) => a + b, 0);
    const sum = (c.target || 0) * (c.cnt || 1) + (c.star ? c.starV * c.star : 0) + (c.pts ? c.pts / 5 : 0);
    return Math.max(6, Math.round((sum * 1.15 - pre - lk * .6) / spv + (c.ice || 0) * 4));
  }
  const round50 = x => Math.round(x / 50) * 50;
  /* 스테이지 n + 손잡이 x + 기준 이동 par → 판 설정 */
  function soloCfg(n, x = 0, par = 0){
    const p = planOf('merge', n), c = p.c, k = p.k, L = goalsOf(p), has = ch => L.includes(ch), tw = p.tw || null, hardish = p.hard || p.boss;
    const small = p.mj.includes('small'), lock = p.mj.includes('lock'), N = small ? 3 : 4;
    const cfg = { limit:0, N, stones:c >= 3 && p.hard && !small ? 1 : 0, locks:lock ? (small ? [16] : p.boss ? [64, 32] : [32]) : [], p4:tw === 'four' ? .45 : .1,
      extra:tw === 'extra', rot:tw === 'rot', noUndo:tw === 'bare', flash:tw === 'flash', tw, boss:!!p.boss, hard:!!p.hard, intro:p.intro || null, introKind:p.introKind || null,
      goals:L, target:0, cnt:1, ice:0, star:0, starV:0, pts:0, peek:0, pre:[], mv:0 };
    if(has('A') || (has('C') && !/[BDEFG]/.test(L))) cfg.target = small ? (hardish ? 128 : 64) : c === 1 ? (k === 1 ? 32 : 64) : c === 2 ? (hardish ? 128 : 64) : (hardish ? 256 : 128);
    if(has('B')){ cfg.target = small || (c === 1 && k === 2) ? 32 : 64; cfg.cnt = p.boss && c > 1 && !small ? 3 : 2; }
    if(has('F')){ cfg.target = small || c <= 3 ? 64 : 128; cfg.peek = 3; cfg.pre = PRE_F[N + ':' + cfg.target].slice(); }
    if(has('D')) cfg.ice = small ? (p.boss ? 2 : 1) : k === 1 ? 2 : hardish ? 4 : 3;
    if(has('E')){ cfg.star = p.boss && !small ? 2 : 1; cfg.starV = small || (c <= 3 && k === 1) ? 32 : 64; }
    if(has('G')) cfg.pts = round50((small ? 300 : 500) * (hardish ? 1.4 : p.easy ? .8 : 1));
    /* 자동 플레이어로 재 보니 이동을 아무리 줘도 거의 못 깨는 조합은 장애물을 덜어 준다: 막힌 길 + 별 칸·좁은 판 퍼즐, 돌 + 얼음 4개 */
    if(cfg.rot && cfg.star){ cfg.star = 1; cfg.starV = 32; }
    if(cfg.rot && cfg.peek && small){ cfg.target = 32; cfg.pre = [8, 8, 4]; }
    if(cfg.stones && cfg.ice > 3) cfg.ice = 3;
    cfg.par = par || estPar(cfg);
    const mf = x > 0 ? 2.3 - (x - 1) * .045 : /[CFG]/.test(L) ? 2.4 : 0;
    cfg.mv = mf ? Math.max(6, Math.ceil(cfg.par * mf)) : 0;
    cfg.mj = [cfg.ice && 'ice', cfg.star && 'star', cfg.locks.length && 'lock', small && 'small', cfg.stones && 'stone'].filter(Boolean);
    return cfg;
  }
  /* 판마다 원하는 첫 도전 성공률(%) — 로얄 매치식 톱니: 쉬움 90 · 보통 75~85 · 어려움 60 · 보스 40 */
  function wantRate(n){
    const c = Math.ceil(n / 10), k = n - (c - 1) * 10;
    if(k === 1) return 92; if(k === 6 || k === 9) return 90;
    const base = { 2:86, 3:83, 4:80, 5:60, 7:80, 8:77, 10:40 }[k], drop = k === 5 || k === 10 ? Math.min(4, (c - 1) * .8) : Math.min(6, (c - 1) * 1.2);
    return base - drop + (c === 1 ? 5 : 0);
  }
  /* 스테이지 1~100: 두 글자씩(36진수) = 손잡이 x · 기준 이동 par/4 */
  const TUNE = '060a0a0hvb0a0hp90dsh03a4y5o3t5wbt4n405s30g8cji17sbm51azr0bqz0hufufegugtaoetc0l0n09t9t908y10az5y309090frkkfscu403tksdkdyw0gvahds7x80en6t808t50brdtevetha833120fvf06khq8r8s20482y1p4y20fhfvjxi0brd07mfcaq8';
  const tuneOf = n => { if(n <= TUNE.length / 2){ const s = TUNE.substr((n - 1) * 2, 2); return { x:parseInt(s[0], 36), par:parseInt(s[1], 36) * 4 }; }
    return { x:Math.max(0, Math.min(35, Math.round((96 - wantRate(n)) * .45))), par:0 }; };
  /* 별 기준 [★★★ 이하, ★★ 이하] */
  function starCut(c){
    const par = c.par || parOf(c.target); let t3 = par, t2 = par * 1.3;
    if(c.mv){ t3 = Math.min(t3, c.mv * .85); t2 = Math.min(t2, c.mv * .95); }
    if(c.flash){ t3 *= .8; t2 *= .8; }
    return [Math.floor(t3), Math.floor(t2)];
  }

  /* ---------- 화면 ---------- */
  const COMBO = ['', '', '더블!', '트리플!', '쿼드러플!', '대박!'];
  const ICON_UNDO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v5h5"/><path d="M5.5 15a7 7 0 1 0 1.2-7.3L4 10"/></svg>';
  const vcls = v => 'v' + (v > 4096 ? 'x' : v);
  const fsz = v => v >= 1000 ? .3 : v >= 100 ? .38 : .47;
  const tileHTML = v => `<div class="mi ${vcls(v)}" style="--k:${fsz(v)}"><b>${v}</b></div>`;
  const TCOL = { 2:['#FFE9C2', '#E2B071'], 4:['#FFDD5C', '#E0A800'], 8:['#FFA53A', '#E07A10'], 16:['#FF7A45', '#D8521E'], 32:['#FF4F6A', '#D62A48'], 64:['#F0368A', '#C21566'],
    128:['#C040E8', '#E9A0FF'], 256:['#7C4DFF', '#B9A0FF'], 512:['#FFC93C', '#FFF3A8'], 1024:['#FFA820', '#FFE08A'], 2048:['#26D1B8', '#9FF5E6'] };
  const tcol = v => TCOL[v] || ['#FF3DA5', '#FFB2E0'];

  const ICON_LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" fill="none" stroke="#1A0F45" stroke-width="3.2" stroke-linecap="round"/><path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" fill="none" stroke="#E8E2FF" stroke-width="1.6" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="3" fill="#FFD84A" stroke="#1A0F45" stroke-width="2"/><circle cx="12" cy="15" r="1.7" fill="#1A0F45"/><path d="M12 15.5v2.5" stroke="#1A0F45" stroke-width="1.8" stroke-linecap="round"/></svg>';
  /* 얼음 덮개(디자인팀: 하늘 #BFE6FF 60% + 한 번 맞으면 금 1줄) */
  const ICE_HTML = '<i class="mice" aria-hidden="true"><svg viewBox="0 0 40 40" preserveAspectRatio="none"><path class="gl" d="M6 12l7-6M8 20l12-12" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".85"/><path class="ck" d="M4 23l9-3 4 5 7-9 5 4 7-6" stroke="#2E6E9E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></i>';
  const STAR_PATH = 'M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.9 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z';
  const ARROW = ['↑', '→', '↓', '←'], DIRN = ['위', '오른쪽', '아래', '왼쪽'];
  const cOf = i => i % G.M.N, rOf = i => Math.floor(i / G.M.N);
  const nameOf = k => (conceptInfo('merge', k) || {}).name || k;
  const banNow = M => banOf(M.cfg, M.moves);
  const iceLeft = M => M.grid.reduce((n, t) => n + (t && t !== ST && t.ice ? 1 : 0), 0);
  const starOK = M => M.stars.filter(i => { const t = M.grid[i]; return t && t !== ST && !t.lk && !t.ice && t.v >= M.cfg.starV; }).length;
  const cntOK = M => M.grid.reduce((n, t) => n + (t && t !== ST && !t.lk && !t.ice && t.v >= M.target ? 1 : 0), 0);

  /* 위 칩 줄(UI팀: "목표 128" · "지금 32" · 이동). 판 종류에 따라 3~4칸 */
  function chipDefs(M){
    const c = M.cfg, a = [];
    if(c.pts) a.push({ cls:'mgoal', em:'점수 목표', v:fmt(c.pts) }, { id:'mNowP', em:'지금 점수', v:'0' });
    if(c.target) a.push({ cls:'mgoal', em:'목표', v:c.cnt > 1 ? `${c.target}<small>이상 ×${c.cnt}</small>` : String(c.target) }, { id:'mNow', em:c.cnt > 1 ? '만든 개수' : '지금', v:'' });
    if(c.ice) a.push({ id:'mIce', cls:'mice-c', em:'얼음 깨기', v:'' });
    if(c.star) a.push({ id:'mStar', cls:'mstar-c', em:`별 칸 ${c.starV}↑`, v:'' });
    if(M.limit) a.push({ id:'mTime', cls:'time', em:'남은 시간', v:mmss(M.limit) });
    a.push({ id:'mMoves', cls:M.mv ? 'lim' : '', em:M.mv ? '남은 이동' : '이동', v:String(M.mv || 0) });
    return a;
  }
  const chipHTML = d => `<div class="hchip ${d.cls || ''}"${d.id ? ` data-k="${d.id}"` : ''}><span class="hv"><b${d.id ? ` id="${d.id}"` : ''}>${d.v}</b></span><em>${d.em}</em></div>`;
  function peekVals(M){ const a = []; for(let j = 0; j < M.peek; j++) a.push(seqAt(M, M.moves + j)[1] < M.p4 ? 4 : 2); return a; }
  function hud(){
    const M = G.M, s = (id, t) => { const e = document.getElementById(id); if(e) e.innerHTML = t; };
    if(M.mv){ const left = Math.max(0, M.mv - M.moves); s('mMoves', left); const e = document.getElementById('mMoves'); if(e) e.closest('.hchip').classList.toggle('warn', left <= Math.max(3, Math.round(M.mv * .12))); }
    else s('mMoves', M.moves);
    if(M.cfg.pts) s('mNowP', fmt(M.pts));
    if(M.target) s('mNow', M.cfg.cnt > 1 ? `${Math.min(cntOK(M), M.cfg.cnt)}<small>/${M.cfg.cnt}</small>` : String(M.best || '-'));
    if(M.cfg.ice) s('mIce', `${M.cfg.ice - iceLeft(M)}<small>/${M.cfg.ice}</small>`);
    if(M.cfg.star){ const k = starOK(M); s('mStar', `${k}<small>/${M.stars.length}</small>`);
      if(M.starEl) M.stars.forEach((ci, j) => { const t = M.grid[ci], ok = !!(t && t !== ST && !t.lk && !t.ice && t.v >= M.cfg.starV), b = M.starEl[j]; if(b && b.classList.contains('ok') !== ok){ b.classList.toggle('ok', ok); if(ok) try{ const p = cellXY(ci); fxRing(p.x, p.y, '#FFE38A', p.w * .9, .45, 7); sfx('mergeStar'); }catch(_){} } }); }
    if(M.peek){ const e = document.getElementById('mPeek'); if(e) e.innerHTML = peekVals(M).map((v, j) => `<span class="mpk${j ? '' : ' first'}">${tileHTML(v)}</span>`).join(''); }
    const u = document.getElementById('mUndo');
    if(u){ u.disabled = M.noUndo || !M.snap || M.undoUsed || M.lock; u.querySelector('.cnt').textContent = M.noUndo || M.undoUsed ? '0' : '1'; }
    if(M.cfg.rot){
      const d = banNow(M), left = ROT_EVERY - M.moves % ROT_EVERY, bar = document.getElementById('mBan');
      if(bar){ bar.className = 'mban d' + d; bar.setAttribute('aria-label', DIRN[d] + '쪽으로는 밀 수 없어요'); }
      s('mBanTxt', ARROW[d] + ' 막힘 · ' + left + '번 뒤 바뀜');
    }
  }
  function mkTile(t, cell, cls){
    const el = document.createElement('div'); el.className = 'mt' + (cls ? ' ' + cls : '') + (t.lk ? ' lk' : '') + (t.ice ? ' ice' + (t.ice < ICE_HP ? ' crk' : '') : '');
    el.style.setProperty('--c', cell % G.M.N); el.style.setProperty('--r', Math.floor(cell / G.M.N));
    el.innerHTML = tileHTML(t.v) + (t.lk ? '<i class="mlk">' + ICON_LOCK + '</i>' : '') + (t.ice ? ICE_HTML : '');
    if(t.lk) el.setAttribute('aria-label', '자물쇠 ' + t.v); else if(t.ice) el.setAttribute('aria-label', '얼음 속 ' + t.v);
    G.M.els.set(t.id, el); G.M.layer.appendChild(el); return el;
  }
  function drawAll(cls){
    const M = G.M; M.layer.innerHTML = ''; M.els.clear();
    M.grid.forEach((t, i) => { if(t === ST){ const el = document.createElement('div'); el.className = 'mt stone'; el.style.setProperty('--c', cOf(i)); el.style.setProperty('--r', rOf(i));
      el.innerHTML = '<div class="mi"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 14l7 4 3 8M19 26l8-3 4 5M16 18l9-6" fill="none" stroke="#4E4670" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
      el.setAttribute('aria-label', '돌 칸'); M.layer.appendChild(el); }
      else if(t) mkTile(t, i, cls); });
  }
  function measure(){
    const M = G && G.M; if(!M || !M.board) return;
    const w = M.layer.getBoundingClientRect().width; if(!w) return;
    M.board.style.setProperty('--ts', ((w - (M.N - 1) * M.gapPx) / M.N).toFixed(2) + 'px');
  }
  /* 앞 애니메이션을 즉시 끝냄(빠른 연속 밀기에서도 화면과 상태가 어긋나지 않게) */
  function flush(){
    const M = G.M;
    if(M.pend){ clearTimeout(M.pendT); const f = M.pend; M.pend = null; f(); }
    M.layer.classList.add('snap'); void M.layer.offsetWidth; M.layer.classList.remove('snap');
  }
  function later(fn, ms){ const M = G.M, id = setTimeout(() => { M.timers.delete(id); fn(); }, ms); M.timers.add(id); return id; }
  function cellXY(cell){
    const M = G.M, r = M.layer.getBoundingClientRect(), ts = (r.width - (M.N - 1) * M.gapPx) / M.N;
    return { x:r.left + cOf(cell) * (ts + M.gapPx) + ts / 2, y:r.top + rOf(cell) * (ts + M.gapPx) + ts / 2, w:ts };
  }
  function bump(d){
    const M = G.M, [dx, dy] = DV[d]; sfx('mergeBump'); M.mis++;
    if(M.board.animate && !FXR.reduce) M.board.animate([{ transform:'translate(0,0)' }, { transform:`translate(${dx * 5}px,${dy * 5}px)` }, { transform:'translate(0,0)' }], { duration:160, easing:'ease-out' });
  }
  const goalNow = M => goalV(M.cfg, valsOf(M.grid), M.pts, M.stars);

  function doMove(d){
    const M = G && G.M;
    if(!M || G.over || G.paused || M.lock) return false;
    flush();
    if(M.cfg.rot && d === banNow(M)){   /* 막힌 길 */
      bump(d); const bar = document.getElementById('mBan');
      if(bar && !M.banTip){ M.banTip = 1; fxBubble(bar, DIRN[d] + '쪽은 지금 막혔어요'); later(() => { M.banTip = 0; }, 1400); }
      return false;
    }
    const res = slideT(M.grid, d);
    if(!res.moved){ bump(d); return false; }
    M.snap = { grid:M.grid.slice(), moves:M.moves, pts:M.pts, best:M.best, merges:M.mergeN };
    M.grid = res.g; M.moves++; M.pts += res.pts; M.mergeN += res.merges.length;
    M.best = Math.max(M.best, bestOf(M.grid));
    const won = goalNow(M), sps = [];
    if(!won){ const pr = seqAt(M, M.moves - 1); sps.push(spawnInto(M, M.grid, pr)); if(spawnCount(M.cfg, M.moves) > 1) sps.push(spawnInto(M, M.grid, [pr[2], pr[3]])); }
    /* 1) 미끄러짐: 모든 타일의 칸 좌표만 바꾸면 CSS transform이 움직인다 */
    const gone = new Map(res.merges.map(m => [m.gone, m.cell]));
    M.grid.forEach((t, i) => { if(t && t !== ST){ const el = M.els.get(t.id); if(el){ el.style.setProperty('--c', cOf(i)); el.style.setProperty('--r', rOf(i)); } } });
    for(const [id, cell] of gone){ const el = M.els.get(id); if(el){ el.classList.add('gone'); el.style.setProperty('--c', cOf(cell)); el.style.setProperty('--r', rOf(cell)); } }
    for(const sp of sps) if(sp) mkTile(sp.t, sp.cell, 'new' + (sps.length > 1 ? ' twin' : ''));
    /* 소리는 바로(손맛), 합친 모양·파티클은 도착한 뒤 */
    const top = res.merges.reduce((m, x) => x.v > m ? x.v : m, 0), unl = res.merges.filter(m => m.unlock);
    if(top){ sfx('mergeHit', { v:top, n:res.merges.length }); fxBuzz(top >= 256 ? [20, 30, 30] : 12); } else sfx('mergeSlide');
    if(unl.length) sfx('mergeUnlock');
    if(res.hits.length) sfx('mergeIce', { broke:res.hits.some(h => h.broke) });
    M.pend = () => {
      for(const id of gone.keys()){ const el = M.els.get(id); if(el) el.remove(); M.els.delete(id); }
      for(const m of res.merges){ const el = M.els.get(m.keep); if(!el) continue; el.innerHTML = tileHTML(m.v); el.classList.remove('pop', 'lk'); el.removeAttribute('aria-label'); void el.offsetWidth; el.classList.add('pop'); }
      for(const el of M.layer.querySelectorAll('.mt.new')) el.classList.remove('new', 'twin');
      try{ iceFx(res.hits); }catch(_){}
      mergeFx(res);
      for(const m of unl){ const p = cellXY(m.cell); fxBurst(p.x, p.y, ['#FFD84A', '#FFF3A8', '#FFFFFF'], 14, { speed:240, size:4.5, kinds:['spark', 'dot'], up:40, dur:.6 }); fxFloat(p.x, p.y + p.w * .1, '자물쇠 풀림!', 'mgf unl'); }
    };
    M.pendT = setTimeout(() => { if(M.pend){ const f = M.pend; M.pend = null; f(); } }, SLIDE_MS);
    hud();
    if(won) celebrate();
    else if(M.mv && M.moves >= M.mv) stuck('moves');
    else if(!canMoveV(valsOf(M.grid), M.cfg.rot ? banNow(M) : -1)) stuck('stuck');
    return true;
  }
  /* 얼음: 금 가기(한 번) · 깨짐(두 번). 보이기만 함 */
  function iceFx(hits){
    const M = G.M;
    for(const h of hits){
      const el = M.els.get(h.id); if(!el) continue; const p = cellXY(h.cell);
      if(h.broke){ el.classList.remove('ice', 'crk'); const ic = el.querySelector('.mice'); if(ic) ic.remove(); el.removeAttribute('aria-label');
        fxBurst(p.x, p.y, ['#BFE6FF', '#FFFFFF', '#8FD0F5'], 16, { speed:260, size:5, kinds:['shard', 'spark', 'dot'], up:50, glow:true, dur:.7 }); fxFloat(p.x, p.y - p.w * .2, '얼음 깨짐!', 'mgf ice'); }
      else { el.classList.add('crk'); fxBurst(p.x, p.y, ['#BFE6FF', '#FFFFFF'], 7, { speed:150, size:3.5, kinds:['shard', 'dot'], up:20, dur:.45 }); }
    }
  }
  function mergeFx(res){
    const M = G.M; if(!res.merges.length || !M.layer.isConnected) return;
    let big = res.merges[0]; for(const m of res.merges) if(m.v > big.v) big = m;
    for(const m of res.merges){ if(m.v < 64) continue; const p = cellXY(m.cell), c = tcol(m.v);
      fxBurst(p.x, p.y, [c[0], c[1], '#FFFFFF'], m.v >= 256 ? 22 : 12, { speed:m.v >= 256 ? 300 : 220, size:4.5, kinds:['star', 'dot', 'spark'], up:70, glow:m.v >= 128, dur:.7 });
      fxRing(p.x, p.y, c[1], p.w * (m.v >= 256 ? 1.2 : .9), .45, 7); }
    const p = cellXY(big.cell);
    if(M.lastF) M.lastF.remove();   /* 빠르게 밀어도 '+N'이 쌓이지 않게 하나만 */
    M.lastF = fxFloat(p.x, p.y - p.w * .35, '+' + fmt(res.pts), 'mgf' + (big.v >= 128 ? ' hi' : ''));
    /* 64 이상을 처음 만들면: 그 타일이 커졌다 돌아오고 빛 알갱이가 빨려 들어감(크기는 숫자에 비례). 512 이상은 번쩍 */
    if(big.v >= 64 && !M.seen.has(big.v)){
      M.seen.add(big.v); const k = log2(big.v) - 5;   /* 64 → 1, 128 → 2 … */
      try{ const el = M.els.get(big.keep); if(el && el.animate && !FXR.reduce){ el.style.zIndex = 5; el.animate([{ scale:'1' }, { scale:String(1.25 + k * .07), offset:.35 }, { scale:'1' }], { duration:520, easing:'cubic-bezier(.2,1.5,.4,1)' }).onfinish = () => { el.style.zIndex = ''; }; } }catch(_){}
      try{ const q = cellXY(big.cell); if(q && typeof fxEmit === 'function') fxEmit(q.x, q.y, { quantity:8 + k * 5, x:{ min:-q.w * (1 + k * .25), max:q.w * (1 + k * .25) }, y:{ min:-q.w * (1 + k * .25), max:q.w * (1 + k * .25) }, speed:{ min:0, max:20 }, lifespan:{ min:420, max:560 }, kind:'glow', tint:['#FFE27A', '#FFFFFF', tcol(big.v)[1]], scale:{ start:1.8 + k * .3, end:.6 }, alpha:{ start:1, end:0 }, well:{ x:q.x, y:q.y, power:1.1 + k * .25 } }); }catch(_){}
      if(big.v >= 128){ fxShake(M.board, Math.min(7, 3 + k)); sfx('mergeBig', { v:big.v }); }
      if(big.v >= 512) setTimeout(() => { try{ fxFlash('#FFE9A8', .2, 280); }catch(_){} }, 380);
    }
    if(res.merges.length >= 2) combo(res.merges.length);
  }
  function combo(n){
    const M = G.M, old = M.wrap.querySelector('.merge_mcombo'); if(old) old.remove();
    const d = document.createElement('div'); d.className = 'merge_mcombo' + (n >= 3 ? ' max' : '');
    d.innerHTML = `<b>×${n}</b><span>${COMBO[Math.min(n, 5)]} 한 번에 ${n}번 합쳤어요</span>`;
    M.bwrap.appendChild(d); later(() => d.remove(), 1150);
    sfx('mergeCombo', { n });
  }
  function celebrate(){
    const M = G.M; M.lock = true; hud();
    later(() => {
      flush();
      let ti = -1; M.grid.forEach((x, i) => { if(x && x !== ST && !x.lk && !x.ice && (ti < 0 || x.v > M.grid[ti].v)) ti = i; });
      const el = ti >= 0 && M.els.get(M.grid[ti].id);
      if(el){ el.classList.add('win'); fxPop(el, 'gold'); }
      const b = document.createElement('div'); b.className = 'mbanner win' + (ti >= M.N * M.N / 2 ? ' up' : ''); b.innerHTML = `<b>목표 완성!</b><span>${M.mv ? (M.mv - M.moves) + '번 남기고' : M.moves + '번 만에'} 해냈어요</span>`;
      M.bwrap.appendChild(b);
      fxConfetti(); sfx('win', { g:'merge' }); fxBuzz([30, 60, 30, 60, 80]);
    }, SLIDE_MS + 40);
    later(() => { if(G && G.M === M) finish(true); }, 1500);
  }
  /* 끝남: 'moves' 이동을 다 씀 · 'stuck' 막힘 · 'time' 대전 시간 끝 */
  function stuck(why){
    const M = G.M; M.lock = true; M.out = why; hud();
    later(() => {
      flush();
      sfx('mergeStuck'); fxShake(M.board, 6); fxBuzz([60, 40, 90]);
      const canUndo = why !== 'time' && M.snap && !M.undoUsed && !M.noUndo;
      const b = document.createElement('div'); b.className = 'mbanner bad';
      const t1 = why === 'time' ? '시간이 다 됐어요' : why === 'moves' ? '이동을 다 썼어요' : '더 움직일 수 없어요';
      const t2 = canUndo ? '되돌리기로 한 번 살려 볼까요?' : why === 'time' ? '가장 큰 타일 ' + M.best + '까지 만들었어요' : why === 'moves' ? M.mv + '번 안에 목표를 다 채우지 못했어요' : '빈칸이 없고 합칠 짝도 없어요';
      b.innerHTML = `<b>${t1}</b><span>${t2}</span>` +
        (canUndo ? `<div class="mbb"><button class="btn small secondary" id="mEnd" aria-label="여기서 끝내기">끝내기</button><button class="btn small primary" id="mSave" aria-label="되돌리기 사용">${ICON_UNDO}되돌리기</button></div>` : '');
      M.bwrap.appendChild(b); M.banner = b;
      if(canUndo){ b.querySelector('#mSave').onclick = () => undo(); b.querySelector('#mEnd').onclick = () => { b.remove(); finish(false); }; }
      else later(() => { if(G && G.M === M) finish(false); }, 1500);
    }, SLIDE_MS + 60);
  }
  function undo(){
    const M = G && G.M; if(!M || G.over || G.paused || !M.snap || M.undoUsed || M.noUndo) return;
    if(M.lock && !M.banner) return;   /* 승리 연출 중에는 안 됨 */
    flush();
    if(M.banner){ M.banner.remove(); M.banner = null; }
    const s = M.snap; M.grid = s.grid; M.moves = s.moves; M.pts = s.pts; M.best = s.best; M.mergeN = s.merges;
    M.undoUsed = true; M.snap = null; M.lock = false; M.out = false;
    drawAll('back'); sfx('mergeUndo');
    const u = document.getElementById('mUndo'); if(u) fxPop(u);
    hud();
  }
  /* 판 아래 한 줄 안내: 새 규칙/변주 판이면 그 설명, 아니면 이번 판 목표 문장 */
  function tipHTML(M){
    const c = M.cfg, bits = [];
    if(c.intro){ const inf = conceptInfo('merge', c.intro); if(inf) return `<b>${c.introKind === 'twist' ? '새 변주' : '새 규칙'}</b>${inf.desc}`; }
    if(c.stones) bits.push('<u>돌 칸</u>은 안 움직여요');
    if(c.locks && c.locks.length) bits.push('<u>자물쇠</u>는 같은 숫자로 부딪혀 풀어요');
    if(c.ice) bits.push('<u>얼음</u> 옆에서 두 번 합치면 깨져요');
    if(c.peek) bits.push('위에 <u>다음 타일</u>이 보여요');
    if(c.tw === 'rot') bits.push('막힌 방향은 ' + ROT_EVERY + '번마다 바뀌어요');
    if(c.tw === 'extra') bits.push('4번째마다 새 타일 2개');
    if(c.tw === 'bare') bits.push('되돌리기 없이');
    if(c.tw === 'four') bits.push('4가 자주 나와요');
    if(c.tw === 'flash') bits.push('별 기준 이동이 짧아요');
    if(M.limit) return `<b>대전</b>상대보다 먼저 <b class="n">${M.target}</b>${eul(M.target).slice(String(M.target).length)} 만들면 승리 · ${Math.round(M.limit / 60)}분`;
    const lead = c.boss ? '<b>대장 판</b>' : c.hard ? '<b>어려움</b>' : '';
    return lead + goalText(Object.assign({}, c, { mv:M.mv })) + (bits.length ? ' · ' + bits.join(' · ') : '');
  }
  /* 대전 시계(2분): 시간이 다 되면 그 자리에서 끝(가장 큰 타일로 판정) */
  function duelClock(M){
    const iv = setInterval(() => {
      if(!G || G.M !== M){ clearInterval(iv); return; }
      if(!G.duel || G.over || !M.limit) return;
      try{ if(typeof mergeDuelTick === 'function') mergeDuelTick(); }catch(_){}   /* 다른 사람이 64·128을 만들면 큰 알림(보이기만) */
      const rem = M.limit - elapsed(), e = document.getElementById('mTime');
      if(e){ e.textContent = mmss(Math.max(0, Math.ceil(rem))); e.closest('.hchip').classList.toggle('warn', rem <= 20); }
      if(rem <= 0 && !M.lock){ M.lock = true; stuck('time'); }
    }, 250);
    M.timers.add(iv);
  }

  const tileOf = x => x === ST ? ST : x > 0 ? { v:x } : isIce(x) ? { v:iceVal(x), ice:iceHp(x) } : x < -1 ? { v:-x, lk:true } : null;
  function lpOf(v, T){ return v >= T ? 1 : clamp01((Math.log2(Math.max(2, v)) - 1) / (Math.log2(T) - 1)); }
  /* 자동 풀기(테스트·_ai): 목표를 아는 자동 플레이어로 한 수 */
  function aiNow(M, depth){ const gx = GX; GX = goalCtx(M.cfg, M.stars); try{ return aiMove(valsOf(M.grid), depth, false, M.cfg.rot ? banNow(M) : -1, M.pts); } finally { GX = gx; } }

  return {
    name:'숫자 합치기', abil:'전략력', col:['#FFB86B', '#F2711C', '#9A3A00'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="2.5" width="8" height="8" rx="2.2"/><rect x="1.5" y="13.5" width="8" height="8" rx="2.2" opacity=".6"/><path d="M11 12h3.2l-1.6-1.8a1 1 0 0 1 1.5-1.3l3.1 3.1-3.1 3.1a1 1 0 0 1-1.5-1.3L14.2 12H11z" transform="translate(-.5 0)"/><rect x="16.5" y="6" width="6.5" height="12" rx="2.2"/></svg>',
    art(){
      const t = (x, y, s, v) => { const c = tcol(v); const fs = s * fsz(v) * 1.02;
        return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * .22}" fill="${c[0]}" stroke="#1A0F45" stroke-width="2"/><rect x="${x + s * .14}" y="${y + s * .1}" width="${s * .72}" height="${s * .3}" rx="${s * .14}" fill="#fff" opacity=".38"/>` +
          `<text x="${x + s / 2}" y="${y + s / 2 + fs * .36}" text-anchor="middle" font-size="${fs}" font-family="Black Han Sans, Jua, sans-serif" fill="#fff" stroke="${v <= 4 ? '#B8651E' : '#1A0F45'}" stroke-width="${s * .06}" paint-order="stroke">${v}</text>`; };
      const lay = [[2, 0, 0], [0, 1, 0], [4, 2, 0], [0, 3, 0], [8, 0, 1], [16, 1, 1], [0, 2, 1], [2, 3, 1], [32, 0, 2], [64, 1, 2], [128, 2, 2], [0, 3, 2], [512, 0, 3], [256, 1, 3], [0, 2, 3], [4, 3, 3]];
      let g = ''; const x0 = 47, y0 = 7, s = 18.5, gp = 3;
      for(const [v, c, r] of lay){ const x = x0 + c * (s + gp), y = y0 + r * (s + gp); g += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="4" fill="#1B1150"/>`; if(v) g += t(x, y, s, v); }
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="mergeA1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB86B"/><stop offset=".55" stop-color="#F0568F"/><stop offset="1" stop-color="#7B3FD8"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#mergeA1)"/><circle cx="20" cy="18" r="28" fill="#fff" opacity=".22"/><circle cx="148" cy="90" r="30" fill="#FFE27A" opacity=".25"/>
        <rect x="${x0 - 5}" y="${y0 - 5}" width="${4 * s + 3 * gp + 10}" height="${4 * s + 3 * gp + 10}" rx="10" fill="#2A1B6E" stroke="#1A0F45" stroke-width="2.5"/>${g}
        ${t(8, 34, 28, 1024)}${t(126, 34, 26, 64)}<path d="M139 16l2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z" fill="#FFF3A8" stroke="#1A0F45" stroke-width="1.5" stroke-linejoin="round"/><path d="M22 76l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" fill="#fff"/></svg>`;
    },
    /* 도움말 3줄(세대별 테스트: 4번 카드 삭제) */
    /* 도움말 v2(WP3 공용 도움말): 움직이는 그림 1장 + 3줄. 그림 = 오른쪽으로 밀면 2와 2가 미끄러져 4가 됨 */
    howto:{
      pic(){
        const S = 52, G0 = 6, X = 160 - (S * 4 + G0 * 3) / 2, Y = 54, dur = '3s';
        const cx = c => X + c * (S + G0);
        const tile = (v, x) => { const c = tcol(v), fs = S * fsz(v) * 1.02;
          return `<rect x="${x}" y="${Y}" width="${S}" height="${S}" rx="12" fill="${c[0]}" stroke="#1A0F45" stroke-width="2.5"/><text x="${x + S / 2}" y="${Y + S / 2 + fs * .36}" text-anchor="middle" font-size="${fs}" font-family="Black Han Sans, Jua, sans-serif" fill="#fff" stroke="${v <= 4 ? '#B8651E' : '#1A0F45'}" stroke-width="3" paint-order="stroke">${v}</text>`; };
        const slide = (dx, kt) => `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;${dx} 0;${dx} 0;0 0" keyTimes="${kt}" dur="${dur}" repeatCount="indefinite"/>`;
        const show = (vals, kt) => `<animate attributeName="opacity" values="${vals}" keyTimes="${kt}" dur="${dur}" repeatCount="indefinite"/>`;
        let slots = ''; for(let c = 0; c < 4; c++) slots += `<rect x="${cx(c)}" y="${Y}" width="${S}" height="${S}" rx="12" fill="#2A1B6E"/>`;
        return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="16" fill="#FFE9D2"/>
          <rect x="${X - 8}" y="${Y - 8}" width="${S * 4 + G0 * 3 + 16}" height="${S + 16}" rx="16" fill="#1B1150" stroke="#1A0F45" stroke-width="3"/>${slots}
          <g>${show('1;1;0;0;1', '0;.42;.44;.96;1')}<g>${slide(cx(3) - cx(0), '0;.2;.42;.96;1')}${tile(2, cx(0))}</g><g>${slide(cx(3) - cx(1), '0;.2;.42;.96;1')}${tile(2, cx(1))}</g></g>
          <g opacity="0">${show('0;0;1;1;0', '0;.42;.44;.92;1')}<g transform-origin="${cx(3) + S / 2} ${Y + S / 2}"><animateTransform attributeName="transform" type="scale" values="1;1;1.25;1;1" keyTimes="0;.42;.5;.58;1" dur="${dur}" repeatCount="indefinite"/>${tile(4, cx(3))}</g></g>
          <g>${show('0;1;1;0;0', '0;.06;.36;.44;1')}<path d="M${X + 20} 34h120" stroke="#F2711C" stroke-width="6" stroke-linecap="round"/><path d="M${X + 132} 24l14 10-14 10z" fill="#F2711C"/></g>
          <text x="160" y="150" text-anchor="middle" font-family="Jua,sans-serif" font-size="17" fill="#3A2261">밀면 끝까지 미끄러지고</text>
          <text x="160" y="171" text-anchor="middle" font-family="Jua,sans-serif" font-size="15" fill="#9A3A00">같은 숫자는 부딪혀 하나로 합쳐져요</text></svg>`;
      },
      lines:['밀면 타일이 끝까지 미끄러져요', '같은 숫자가 부딪히면 합쳐져요', '목표를 이동 안에 만들면 성공'],
      more:[['밀기', '판을 손가락으로 밀거나 키보드 화살표를 눌러요. 밀 때마다 빈칸에 2나 4가 하나 새로 나와요.'],
        ['점수', '남긴 이동이 많을수록 점수가 높아요. 되돌리기는 판에 한 번(대전·맨손 판은 없음).'],
        ['대전', '같은 판·같은 새 타일로 128을 먼저 만들면 1등이에요. 2분이 지나면 가장 큰 타일로 순위를 매겨요.']]
    },
    help:[['밀어서 모두 움직여요', '밀면 타일이 끝까지 미끄러져요. 키보드 화살표도 돼요.'],
      ['같은 숫자는 하나로', '같은 숫자가 부딪히면 합쳐져 두 배가 돼요.'],
      ['목표를 만들면 성공', '목표를 이동 안에 만들면 성공이에요. 남긴 이동이 많을수록 점수가 높아요.']],
    chapters:['숫자 마을', '계산 공장', '합산 탑', '제곱 협곡', '무한 궁전'],
    starRule:'★ 목표 달성 · ★★ 적은 이동으로 · ★★★ 아주 적은 이동으로',
    /* 오늘의 문제·연습: 날짜 문턱(NEW_FROM) 전에는 예전 판, 그 뒤엔 새 목표 조합 */
    get levels(){ return { easy:dailyCfg('easy'), normal:dailyCfg('normal'), hard:dailyCfg('hard') }; },
    levelCfg(lv){ const B = (typeof LEVELS !== 'undefined' && (LEVELS[lv] || LEVELS.normal)) || { name:'보통', mult:1 }; return Object.assign({}, B, { merge:Object.assign({}, dailyCfg(lv)) }); },
    /* 난이도 v2 계약: 새 규칙 4개(11·21·31·41) + 변주 5개(6·16·26·36·46) */
    concepts:{
      order:['ice', 'star', 'lock', 'small'],
      info:{
        ice:{ name:'얼음 타일', desc:'얼음에 갇힌 타일은 움직이지 않아요. 바로 옆에서 합치면 금이 가고, 두 번이면 깨져요. 얼음을 모두 깨면 성공!' },
        star:{ name:'별 칸', desc:'판에 노란 별 칸이 생겨요. 별 칸 위에 정해진 숫자 이상 타일을 올려 두면 성공!' },
        lock:{ name:'자물쇠 타일', desc:'자물쇠 타일은 움직이지 않고 벽처럼 막아요. 같은 숫자 타일을 밀어 부딪히면 자물쇠가 풀리며 둘이 합쳐져요!' },
        small:{ name:'좁은 판', desc:'판이 3×3으로 줄어요. 빈칸이 금방 차니 한 수 한 수 신중하게!' },
        stone:{ name:'돌 칸', desc:'회색 돌 칸은 움직이지도, 합쳐지지도 않아요. 돌이 줄을 끊으니 타일이 돌 앞에서 멈춰요.' }
      },
      twists:['flash', 'four', 'bare', 'extra', 'rot'],
      twInfo:{
        flash:{ name:'번개', desc:'별 기준 이동 수가 짧아요(80%). 적은 이동으로 빠르게 만들어 봐요!' },
        four:{ name:'4가 우르르', desc:'새 타일이 절반 가까이 4로 나와요. 빨리 커지지만 2끼리 짝 맞추기가 어려워요.' },
        bare:{ name:'맨손', desc:'되돌리기 없이 오직 실력으로 풀어요.' },
        extra:{ name:'쌍둥이 타일', desc:'4번 밀 때마다 새 타일이 2개씩 나와요. 빈칸을 넉넉히 남겨요!' },
        rot:{ name:'막힌 길', desc:'한 방향으로는 밀 수 없어요. 막힌 방향은 8번 밀 때마다 위 → 오른쪽 → 아래 → 왼쪽으로 바뀌어요.' }
      }
    },
    stage(n){ const t = tuneOf(n); return soloCfg(n, t.x, t.par); },
    stageDesc(n){
      const s = this.stage(n);
      return (s.N === 3 ? '3×3 판 · ' : '') + goalText(s, true) + (s.stones ? ' · 돌 ' + s.stones + '개' : '') + (s.locks.length ? ' · 자물쇠 ' + s.locks.join('·') : '') + (s.peek ? ' · 미리 보기' : '');
    },
    levelDesc(lv){ return goalText(dailyCfg(lv), true); },
    init(cfg, rng){
      /* 대전(1:1 경주): 오늘의 문제 설정 대신 대전 판(128 먼저 · 2분 · 되돌리기 없음) */
      if(typeof G !== 'undefined' && G && G.duel && !G.duel.fleet && !cfg.duel){
        cfg = this.duelCfg({}); try{ G.cfg = cfg; G.limit = cfg.limit; if(G.L) G.L = Object.assign({}, G.L, { merge:cfg }); }catch(_){}
      }
      const B = initV(cfg, rng);
      const M = { rng, cfg, N:cfg.N || 4, target:cfg.target || 0, p4:cfg.p4 != null ? cfg.p4 : .1, extra:!!cfg.extra, mv:cfg.mv || 0, noUndo:!!cfg.noUndo,
        limit:cfg.duel ? cfg.limit || 0 : 0, stars:B.stars, peek:cfg.peek || 0, seen:new Set(), mis:0,
        grid:null, seq:[], nid:0, moves:0, pts:0, best:0, mergeN:0,
        snap:null, undoUsed:false, lock:false, out:false, pend:null, pendT:0, timers:new Set(), els:new Map(), stones:cfg.stones || 0, gapPx:8 };
      M.grid = B.v.map(x => { const t = tileOf(x); if(t && t !== ST) t.id = ++M.nid; return t; });
      M.iceN = M.grid.filter(t => t && t !== ST && t.ice).length;
      M.best = bestOf(M.grid);
      for(const t of M.grid) if(t && t !== ST && !t.lk && !t.ice && t.v >= 64) M.seen.add(t.v);   /* 처음 놓인 큰 타일은 "처음 만듦" 연출에서 뺌 */
      G.M = M;
      G.cleanup = () => { if(M.lastF) M.lastF.remove(); clearTimeout(M.pendT); M.pend = null; for(const t of M.timers) clearTimeout(t); M.timers.clear(); if(M.off) M.off(); };
    },
    render(st){
      const M = G.M, c = M.cfg, chips = [];
      for(const k of c.mj || []) chips.push(`<span class="mc r">${nameOf(k)}</span>`);
      if(c.tw) chips.push(`<span class="mc t">${nameOf(c.tw)}</span>`);
      if(c.boss) chips.unshift('<span class="mc b">대장 판</span>'); else if(c.hard) chips.unshift('<span class="mc h">어려움</span>');
      const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
      const slots = Array.from({ length:M.N * M.N }, (_, i) => M.stars.includes(i) ? `<i class="star">${STAR_SVG}</i>` : '<i></i>').join('');
      const badges = M.stars.map(i => `<span class="msb" style="--c:${i % M.N};--r:${Math.floor(i / M.N)}">${STAR_SVG}<small>${c.starV}</small></span>`).join('');
      st.innerHTML = `<div class="ng-merge${c.boss || M.stones ? ' boss' : ''}${M.N === 3 ? ' n3' : ''}" style="--n:${M.N}">
        <div class="hud-row mhud">${chipDefs(M).map(chipHTML).join('')}</div>
        ${chips.length ? `<div class="mchips" aria-label="이번 판 규칙">${chips.join('')}${c.rot ? '<span class="mc x" id="mBanTxt"></span>' : ''}</div>` : ''}
        ${M.peek ? `<div class="mpeek" aria-label="다음에 나올 새 타일"><em>다음 타일</em><span class="mpks" id="mPeek"></span></div>` : ''}
        <div class="mbwrap"><div class="mboard" id="mBoard" role="application" aria-label="숫자 판. 밀거나 화살표 키로 움직여요">
          <div class="mslots">${slots}</div><div class="mlayer"></div>${badges ? `<div class="mstars" aria-hidden="true">${badges}</div>` : ''}${c.rot ? '<div class="mban" id="mBan"></div>' : ''}</div></div>
        <div class="mtools">
          <button class="tool item mundo" id="mUndo" aria-label="되돌리기 한 번">${ICON_UNDO}<span>되돌리기</span><b class="cnt">1</b></button>
          <div class="mtip">${tipHTML(M)}</div>
        </div></div>`;
      M.wrap = st.querySelector('.ng-merge'); M.board = st.querySelector('#mBoard'); M.bwrap = st.querySelector('.mbwrap'); M.layer = st.querySelector('.mlayer');
      M.starEl = [...st.querySelectorAll('.msb')];
      if(M.noUndo) M.wrap.querySelector('.mundo').hidden = true;
      drawAll('new'); measure(); hud();
      if(M.limit) duelClock(M);
      requestAnimationFrame(() => { if(G && G.M === M) measure(); });   /* 화면이 자리 잡은 뒤 한 번 더 */
      /* 밀기: 24px 넘게 끌면 바로 움직임(손을 떼기 전에) */
      let sx = 0, sy = 0, pid = null, used = false;
      const down = e => { if(e.button > 0) return; pid = e.pointerId; sx = e.clientX; sy = e.clientY; used = false; try{ M.wrap.setPointerCapture(pid); }catch(_){} };
      const move = e => { if(e.pointerId !== pid || used) return; const dx = e.clientX - sx, dy = e.clientY - sy;
        if(Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; used = true;
        doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); };
      const up = e => { if(e.pointerId === pid) pid = null; };
      M.wrap.addEventListener('pointerdown', down); M.wrap.addEventListener('pointermove', move);
      M.wrap.addEventListener('pointerup', up); M.wrap.addEventListener('pointercancel', up);
      const KEYS = { ArrowUp:0, ArrowRight:1, ArrowDown:2, ArrowLeft:3, w:0, d:1, s:2, a:3, W:0, D:1, S:2, A:3 };
      const key = e => { if(!G || G.M !== M) return; const v = document.getElementById('veil'); if(v && v.classList.contains('on')) return;
        if(e.key in KEYS){ e.preventDefault(); doMove(KEYS[e.key]); } else if((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)){ e.preventDefault(); undo(); } };
      const rs = () => measure();
      addEventListener('keydown', key); addEventListener('resize', rs);
      M.off = () => { removeEventListener('keydown', key); removeEventListener('resize', rs); };
      st.querySelector('#mUndo').onclick = () => undo();
      /* 처음 보는 장치에는 말풍선 한 번 */
      later(() => {
        const s = M.layer.querySelector('.stone'), l = M.layer.querySelector('.mt.lk'), ic = M.layer.querySelector('.mt.ice'), sb = M.starEl[0];
        if(ic) fxBubble(ic, '옆에서 두 번 합치면 깨져요'); else if(sb) fxBubble(sb, `별 칸에 ${c.starV} 이상을 올려요`);
        else if(l) fxBubble(l, '같은 숫자로 부딪히면 풀려요'); else if(s) fxBubble(s, '돌 칸: 움직이지 않아요');
        else if(M.mv){ const e = document.getElementById('mMoves'); if(e) fxBubble(e.closest('.hchip'), M.mv + '번 안에 만들어요'); }
      }, 700);
    },
    progress(){
      const M = G && G.M; if(!M) return 0; const c = M.cfg, parts = [];
      if(c.target){
        if((c.cnt || 1) > 1){ const vs = M.grid.filter(t => t && t !== ST && !t.lk && !t.ice).map(t => t.v).sort((a, b) => b - a).slice(0, c.cnt); parts.push(vs.reduce((s, v) => s + lpOf(v, c.target), 0) / c.cnt); }
        else parts.push(lpOf(M.best, c.target));
      }
      if(M.iceN) parts.push(M.grid.reduce((s, t) => s + (t && t !== ST && t.ice ? (ICE_HP - t.ice) / ICE_HP : 0), M.iceN - iceLeft(M)) / M.iceN);
      if(c.star) parts.push(M.stars.reduce((s, i) => { const t = M.grid[i]; return s + (t && t !== ST && !t.lk && !t.ice ? lpOf(t.v, c.starV) : 0); }, 0) / Math.max(1, M.stars.length));
      if(c.pts) parts.push(clamp01(M.pts / c.pts));
      return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    },
    lossText(){
      const M = G.M, c = M.cfg, b = [];
      if(c.target) b.push(c.cnt > 1 ? `${c.target} 이상 ${Math.min(cntOK(M), c.cnt)}/${c.cnt}개` : `목표 ${c.target}까지 ${eul(M.best)} 만들었어요`);
      if(M.iceN) b.push(`얼음 ${M.iceN - iceLeft(M)}/${M.iceN}개 깸`);
      if(c.star) b.push(`별 칸 ${starOK(M)}/${M.stars.length}곳`);
      if(c.pts) b.push(`점수 ${fmt(M.pts)}/${fmt(c.pts)}`);
      const head = M.out === 'moves' ? `이동 ${M.mv}번을 다 썼어요. ` : M.out === 'time' ? '시간이 다 됐어요. ' : '';
      return head + b.join(' · ') + (/요$/.test(b[b.length - 1] || '') ? '' : '.');
    },
    score(){
      const M = G.M, s = scoreOf(M.cfg, M.moves, M.undoUsed);
      return Object.assign(s, { rows:['목표 달성', M.mv ? `남긴 이동 보너스 (${Math.max(0, M.mv - M.moves)}번 남김)` : '효율 보너스 (' + M.moves + '번 이동)', M.undoUsed ? '되돌리기 사용' : '되돌리기 안 씀'] });
    },
    /* 별: 기준 이동(par) 안이면 ★★★, 1.3배 안이면 ★★. 이동 제한 판은 제한보다 넉넉하지 않게, 번개는 기준 ×0.8 */
    stars(){ const M = G.M, t = starCut(M.cfg); return M.moves <= t[0] ? 3 : M.moves <= t[1] ? 2 : 1; },
    css:`
body[data-mode="merge"]{background:
  radial-gradient(80% 40% at 15% 0%, rgba(255,214,120,.55) 0%, rgba(255,214,120,0) 70%),
  radial-gradient(70% 45% at 100% 100%, rgba(80,40,200,.55) 0%, rgba(80,40,200,0) 70%),
  linear-gradient(170deg,#FF9A5C 0%, #F0568F 42%, #8B3FD0 78%, #4A2398 100%) fixed}
.ng-merge{--gap:8px; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; touch-action:none; color:#fff; padding-bottom:6px}
.ng-merge{display:flex; flex-direction:column}
/* 위 칩 줄(UI팀): 목표 · 지금 · (얼음·별·시간) · 이동 */
.ng-merge .mhud{margin:0; color:#3A2261}
.ng-merge .mhud .hchip{height:auto; min-height:56px; padding:4px 6px}
.ng-merge .mhud .hchip b{font-size:20px}
.ng-merge .mhud .hchip b small{font-family:var(--heavy); font-size:13px; color:#6A5884; margin-left:2px}
.ng-merge .mhud .hchip em{font-size:13px}
.ng-merge .mhud .hchip.mgoal{background:linear-gradient(180deg,#FFF3B0,#FFC93C)}
.ng-merge .mhud .hchip.mgoal b{color:#8A3A00}
.ng-merge .mhud .hchip.mgoal em{color:#7A4A00}
.ng-merge .mhud .hchip.mice-c{background:linear-gradient(180deg,#F2FAFF,#BFE6FF)}
.ng-merge .mhud .hchip.mice-c em{color:#1F5A86}
.ng-merge .mhud .hchip.mstar-c{background:linear-gradient(180deg,#FFFBE6,#FFE38A)}
/* 미리 보기 줄(F): 판 위 40px */
.ng-merge .mpeek{display:flex; align-items:center; justify-content:center; gap:10px; height:40px; margin:8px 0 0}
.ng-merge .mpeek em{font-style:normal; font-family:var(--disp); font-size:14px; color:#fff; -webkit-text-stroke:3px #1A0F45; paint-order:stroke fill}
.ng-merge .mpks{display:flex; gap:6px}
.ng-merge .mpk{position:relative; display:block; width:34px; height:34px; --ts:34px; opacity:.75}
.ng-merge .mpk.first{opacity:1; transform:scale(1.08)}
.ng-merge .mpk .mi{border-width:2px}
.ng-merge .mbwrap{position:relative; margin:0; padding:10px 0 10px}
.ng-merge .mboard{--ts:70px; position:relative; aspect-ratio:1; width:100%; max-width:440px; margin:0 auto; padding:var(--gap); border-radius:22px;
  background:linear-gradient(180deg,#34228A,#241668); border:3px solid #1A0F45;
  box-shadow:inset 0 3px 0 rgba(255,255,255,.18), inset 0 -4px 0 rgba(0,0,0,.25), 0 6px 0 #0E0730, 0 16px 30px rgba(20,5,60,.45)}
.ng-merge .mslots, .ng-merge .mlayer, .ng-merge .mstars{position:absolute; inset:var(--gap)}
.ng-merge .mslots{display:grid; grid-template-columns:repeat(var(--n,4),1fr); grid-template-rows:repeat(var(--n,4),1fr); gap:var(--gap)}
.ng-merge .mslots i{position:relative; border-radius:22%; background:#1B1150; box-shadow:inset 0 3px 6px rgba(0,0,0,.5), inset 0 -2px 0 rgba(255,255,255,.06)}
/* 별 칸(디자인팀: 칸 바닥에 연노랑 별 #FFE38A 50%) */
.ng-merge .mslots i.star{background:#2A1C6E; box-shadow:inset 0 0 0 3px rgba(255,227,138,.55), inset 0 3px 6px rgba(0,0,0,.4)}
.ng-merge .mslots i.star svg{position:absolute; inset:14%; width:72%; height:72%; fill:#FFE38A; opacity:.5}
.ng-merge .mstars{z-index:6; pointer-events:none}
.ng-merge .msb{position:absolute; left:0; top:0; width:var(--ts); height:var(--ts); transform:translate(calc(var(--c) * (100% + var(--gap))), calc(var(--r) * (100% + var(--gap))))}
.ng-merge .msb svg{position:absolute; left:-7%; top:-9%; width:38%; height:38%; fill:#FFE38A; stroke:#1A0F45; stroke-width:2; filter:drop-shadow(0 2px 0 rgba(10,4,40,.6))}
.ng-merge .msb small{position:absolute; left:-4%; top:26%; min-width:28%; padding:0 3px; border-radius:6px; background:#1A0F45; color:#FFE38A; font:13px/16px var(--heavy); text-align:center}
.ng-merge .msb.ok svg{fill:#FFC93C; animation:merge_star .9s cubic-bezier(.2,1.6,.4,1)}
.ng-merge .msb.ok small{background:#2BB673; color:#fff}
@keyframes merge_star{0%{transform:scale(1)} 40%{transform:scale(1.5) rotate(18deg)} 100%{transform:scale(1)}}
.ng-merge .mt{position:absolute; left:0; top:0; width:var(--ts); height:var(--ts); will-change:transform; z-index:2;
  transform:translate(calc(var(--c) * (100% + var(--gap))), calc(var(--r) * (100% + var(--gap)))); transition:transform ${SLIDE_MS}ms cubic-bezier(.25,.8,.35,1)}
.ng-merge .mlayer.snap .mt{transition:none}
.ng-merge .mt.gone{z-index:1}
.ng-merge .mi{--a:#FFFDF3; --b:#FFE9C2; --d:#E2B071; --s:#B8651E; --gl:transparent;
  position:absolute; inset:0; border-radius:22%; border:3px solid #1A0F45; overflow:hidden; display:grid; place-items:center;
  background:linear-gradient(180deg,var(--a) 0%, var(--b) 48%, var(--d) 100%);
  box-shadow:inset 0 -5px 0 rgba(0,0,0,.16), inset 0 2px 0 rgba(255,255,255,.7), 0 3px 0 rgba(10,4,40,.55), 0 0 16px var(--gl)}
.ng-merge .mi::before{content:""; position:absolute; left:12%; right:12%; top:7%; height:32%; border-radius:40% 40% 50% 50%; background:linear-gradient(rgba(255,255,255,.75), rgba(255,255,255,.08))}
.ng-merge .mi b{position:relative; font-family:var(--heavy); font-weight:400; font-size:calc(var(--ts) * var(--k)); line-height:1; color:#fff; letter-spacing:-.02em;
  -webkit-text-stroke:calc(var(--ts) * .075) var(--s); paint-order:stroke fill; text-shadow:0 calc(var(--ts) * .04) 0 var(--s)}
.ng-merge .v4{--a:#FFF6B8; --b:#FFDD5C; --d:#E0A800; --s:#A86A00}
.ng-merge .v8{--a:#FFD08A; --b:#FFA53A; --d:#E07A10; --s:#9A4A00}
.ng-merge .v16{--a:#FFB795; --b:#FF7A45; --d:#D8521E; --s:#8E2E08}
.ng-merge .v32{--a:#FF9EAC; --b:#FF4F6A; --d:#D62A48; --s:#86122A}
.ng-merge .v64{--a:#FF9BD0; --b:#F0368A; --d:#C21566; --s:#7A0A42}
.ng-merge .v128{--a:#EDB0FF; --b:#C040E8; --d:#8E1FBE; --s:#530B78; --gl:rgba(224,123,255,.75)}
.ng-merge .v256{--a:#C6B2FF; --b:#7C4DFF; --d:#5230D6; --s:#2A1386; --gl:rgba(158,123,255,.85)}
.ng-merge .v512, .ng-merge .v1024, .ng-merge .v2048, .ng-merge .v4096, .ng-merge .vx{--gl:rgba(255,214,90,.85)}
.ng-merge .v512{--a:#FFF6BD; --b:#FFC93C; --d:#E39200; --s:#8A5200}
.ng-merge .v1024{--a:#FFE5A0; --b:#FFA820; --d:#DA6A00; --s:#7A3500}
.ng-merge .v2048{--a:#C4FFF4; --b:#26D1B8; --d:#0B968A; --s:#054E48; --gl:rgba(90,255,220,.8)}
.ng-merge .v4096, .ng-merge .vx{--a:#FFC6E8; --b:#FF3DA5; --d:#C0106E; --s:#6A0038}
.ng-merge .v512::after, .ng-merge .v1024::after, .ng-merge .v2048::after, .ng-merge .v4096::after, .ng-merge .vx::after{content:""; position:absolute; top:-20%; bottom:-20%; width:36%; left:0;
  background:linear-gradient(100deg, rgba(255,255,255,0), rgba(255,255,255,.75), rgba(255,255,255,0)); transform:translateX(-160%) skewX(-18deg); animation:merge_mshine 2.6s ease-in-out infinite}
@keyframes merge_mshine{0%,55%{transform:translateX(-160%) skewX(-18deg)} 100%{transform:translateX(360%) skewX(-18deg)}}
.ng-merge .mt.new .mi{animation:merge_mgrow .2s ${SLIDE_MS - 20}ms cubic-bezier(.3,1.5,.5,1) both}
.ng-merge .mt.back .mi{animation:merge_mgrow .22s cubic-bezier(.3,1.4,.5,1) both}
@keyframes merge_mgrow{0%{transform:scale(0); opacity:.4} 100%{transform:scale(1); opacity:1}}
.ng-merge .mt.pop{z-index:3}
/* 합칠 때 '쿵': 0.08초 눌렸다가 튀어 오름(디자인팀) */
.ng-merge .mt.pop .mi{animation:merge_mpop .3s cubic-bezier(.3,1.4,.5,1)}
@keyframes merge_mpop{0%{transform:scale(1)} 27%{transform:scale(.84,.8)} 62%{transform:scale(1.18)} 100%{transform:scale(1)}}
.ng-merge .mt.win{z-index:4}
.ng-merge .mt.win .mi{animation:merge_mwin 1.2s cubic-bezier(.3,1.5,.5,1) both; box-shadow:0 0 0 4px #FFF3A8, 0 0 36px 10px rgba(255,214,90,.95)}
@keyframes merge_mwin{0%{transform:scale(1)} 25%{transform:scale(1.35) rotate(-6deg)} 45%{transform:scale(1.18) rotate(4deg)} 100%{transform:scale(1.22)}}
.ng-merge .mt.stone .mi{--gl:transparent; background:radial-gradient(circle at 28% 70%, rgba(40,30,80,.28) 0 6%, transparent 7%), radial-gradient(circle at 74% 34%, rgba(40,30,80,.22) 0 5%, transparent 6%), radial-gradient(circle at 66% 78%, rgba(255,255,255,.3) 0 4%, transparent 5%), linear-gradient(180deg,#C9C2DE 0%, #9890B6 50%, #6C648C 100%); border-color:#1A0F45; box-shadow:inset 0 -5px 0 rgba(0,0,0,.25), inset 0 2px 0 rgba(255,255,255,.5), 0 3px 0 rgba(10,4,40,.55)}
.ng-merge .mt.stone .mi::before{opacity:.45}
.ng-merge .mt.stone svg{position:relative; width:80%; height:80%}
/* 얼음 타일(디자인팀: 숫자 위 반투명 하늘 #BFE6FF 60% + 한 번 맞으면 금 1줄) */
.ng-merge .mice{position:absolute; inset:0; z-index:3; border-radius:22%; background:rgba(191,230,255,.6); border:3px solid #2E6E9E; box-shadow:inset 0 0 0 2px rgba(255,255,255,.7), inset 0 -6px 10px rgba(46,110,158,.35); overflow:hidden}
.ng-merge .mice svg{position:absolute; inset:0; width:100%; height:100%}
.ng-merge .mice .ck{display:none}
.ng-merge .mt.crk .mice .ck{display:block}
.ng-merge .mt.crk .mice{background:rgba(191,230,255,.45); animation:merge_crk .3s ease-out}
@keyframes merge_crk{0%{transform:translateX(0)} 30%{transform:translateX(-3px)} 60%{transform:translateX(3px)} 100%{transform:translateX(0)}}
.ng-merge .merge_mcombo{position:absolute; left:50%; top:-14px; z-index:8; pointer-events:none; transform:translate(-50%,0); display:flex; align-items:center; gap:8px; padding:6px 14px 6px 8px; border-radius:999px; white-space:nowrap;
  background:linear-gradient(90deg,#FF8A3D,#FF5C8A); border:2.5px solid #1A0F45; box-shadow:0 4px 0 #0E0730, 0 8px 18px rgba(255,92,138,.45); animation:merge_mcombo 1.1s cubic-bezier(.2,1.4,.4,1) forwards}
.ng-merge .merge_mcombo.max{background:linear-gradient(90deg,#FFB300,#FF5C8A,#8E6BD1)}
.ng-merge .merge_mcombo b{font-family:var(--heavy); font-weight:400; font-size:20px; background:#fff; color:#E0306F; border-radius:999px; padding:1px 9px; line-height:1.2}
.ng-merge .merge_mcombo span{font-family:var(--disp); font-size:15px; color:#fff; -webkit-text-stroke:3px #7A1440; paint-order:stroke fill}
@keyframes merge_mcombo{0%{opacity:0; transform:translate(-50%,10px) scale(.4)} 18%{opacity:1; transform:translate(-50%,0) scale(1.12)} 30%{transform:translate(-50%,0) scale(1)} 78%{opacity:1} 100%{opacity:0; transform:translate(-50%,-14px)}}
.ng-merge .mbanner{position:absolute; left:50%; top:50%; z-index:9; transform:translate(-50%,-50%); width:min(86%,320px); text-align:center; padding:14px 16px 16px; border-radius:20px; border:3px solid #1A0F45;
  display:flex; flex-direction:column; gap:4px; animation:merge_mban .45s cubic-bezier(.2,1.5,.4,1) both}
.ng-merge .mbanner b{font-family:var(--disp); font-weight:400; font-size:26px; line-height:1.2; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill}
.ng-merge .mbanner span{font-size:14px; font-weight:700}
.ng-merge .mbanner.win{background:linear-gradient(180deg,#FFF3B0,#FFC93C); color:#6A3A00; box-shadow:0 6px 0 #8A5200, 0 0 40px rgba(255,214,90,.8); top:auto; bottom:-10px; transform:translate(-50%,0)}
.ng-merge .mbanner.win.up{bottom:auto; top:-10px}
.ng-merge .mbanner.bad{background:linear-gradient(180deg,#FFFFFF,#EEE6FF); color:#4A3A7A; box-shadow:0 6px 0 #0E0730, 0 12px 30px rgba(10,4,40,.5)}
.ng-merge .mbanner.bad b{color:#FF5C6A}
.ng-merge .mbb{display:flex; gap:8px; justify-content:center; margin-top:8px}
.ng-merge .mbb .btn{height:46px; flex:1; gap:4px}
.ng-merge .mbb .btn svg{width:18px; height:18px}
@keyframes merge_mban{0%{opacity:0; scale:.5} 100%{opacity:1; scale:1}}
/* 되돌리기·안내 줄: 판 바로 아래 엄지 자리(UI팀), 안내 14px 진하게 */
.ng-merge .mtools{display:flex; align-items:stretch; gap:10px; margin:2px 0 0; padding-bottom:4px}
.ng-merge .mundo{flex:0 0 96px; min-height:56px}
.ng-merge .mundo[hidden]{display:none}
.ng-merge .mundo svg{width:22px; height:22px}
.ng-merge .mtip{flex:1; min-width:0; align-self:center; font-size:14px; font-weight:800; line-height:1.4; color:#fff; background:rgba(26,15,69,.62); border-radius:16px; padding:9px 12px}
.ng-merge .mtip b{font-family:var(--heavy); font-weight:400; color:#FFE27A}
.ng-merge.boss .mtip{background:rgba(26,15,69,.72); box-shadow:inset 0 0 0 2px rgba(207,197,255,.4)}
.ng-merge .mtip b:not(.n){display:inline-block; font-family:var(--disp); font-size:13px; color:#1A0F45; background:#FFE27A; border-radius:6px; padding:0 6px; margin-right:4px}
.ng-merge .mtip u{text-decoration:none; color:#FFFFFF; border-bottom:2px solid #FFE27A}
/* 규칙 칩 · 남은 이동 · 자물쇠 타일 · 막힌 길 · 3×3 판 */
.ng-merge .mchips{display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin:10px 4px 0}
.ng-merge .mc{font-family:var(--disp); font-size:13px; line-height:1; padding:5px 10px 4px; border-radius:999px; border:2px solid #1A0F45; color:#1A0F45; background:#fff; box-shadow:0 2px 0 #0E0730; white-space:nowrap}
.ng-merge .mc.r{background:#FFE27A}
.ng-merge .mc.t{background:#9FE3FF}
.ng-merge .mc.b{background:#FF5C6A; color:#fff; -webkit-text-stroke:3px #7A1440; paint-order:stroke fill}
.ng-merge .mc.h{background:#FFA53A}
.ng-merge .mc.x{background:#1B1150; color:#FFE27A; border-color:#FF5C6A; font-variant-numeric:tabular-nums}
.ng-merge .hchip.lim{background:linear-gradient(180deg,#FFF9DA,#FFE9A0)}
.ng-merge .hchip.lim em{color:#7A4A00}
.ng-merge .hchip.warn{background:linear-gradient(180deg,#FFE3E6,#FFB3BB); animation:merge_mwarn 1s ease-in-out infinite}
.ng-merge .hchip.warn b{color:#C21F3A}
@keyframes merge_mwarn{50%{transform:scale(1.05)}}
.ng-merge .mt.lk .mi{filter:saturate(.4) brightness(.78)}
.ng-merge .mt.lk .mi::after{content:""; position:absolute; inset:0; background:repeating-linear-gradient(135deg, rgba(26,15,69,.3) 0 7%, rgba(26,15,69,0) 7% 16%)}
.ng-merge .mlk{position:absolute; right:-9%; top:-11%; width:46%; height:46%; z-index:3; filter:drop-shadow(0 2px 0 rgba(10,4,40,.6)); animation:merge_lkwob 2.8s ease-in-out infinite}
.ng-merge .mlk svg{display:block; width:100%; height:100%}
@keyframes merge_lkwob{0%,78%,100%{transform:rotate(0)} 85%{transform:rotate(-12deg)} 92%{transform:rotate(9deg)}}
.ng-merge .mt.new.twin .mi{box-shadow:0 0 0 3px #9FE3FF, 0 3px 0 rgba(10,4,40,.55)}
.ng-merge .mban{position:absolute; z-index:5; pointer-events:none; border:2px solid #1A0F45; border-radius:8px; background:repeating-linear-gradient(45deg,#FF5C6A 0 8px,#FFE27A 8px 16px); box-shadow:0 0 12px rgba(255,92,106,.8); transition:all .25s cubic-bezier(.3,1.4,.5,1)}
.ng-merge .mban.d0{left:12%; right:12%; top:-8px; height:12px}
.ng-merge .mban.d2{left:12%; right:12%; bottom:-8px; height:12px}
.ng-merge .mban.d1{top:12%; bottom:12%; right:-8px; width:12px}
.ng-merge .mban.d3{top:12%; bottom:12%; left:-8px; width:12px}
.ng-merge.n3 .mboard{max-width:330px}
body[data-mode="merge"] .fxfloat.mgf.unl{color:#FFD84A; font-size:20px}
body[data-mode="merge"] .fxfloat.mgf.ice{color:#BFE6FF; font-size:20px}
body[data-mode="merge"] .fxfloat.mgf{font-family:var(--heavy); font-weight:400; font-size:24px; color:#fff; -webkit-text-stroke:5px #1A0F45}
body[data-mode="merge"] .fxfloat.mgf.hi{color:#FFE27A; font-size:28px}
/* 대전 미니 화면(4×4 숫자, 칸 약 13px): 공용 상대 카드(72×64)를 이 게임에서만 조금 높게 */
/* 공용 base.css의 아이콘용 .mini(19×19)가 대전 막대 class "mini"에도 걸려 막대가 19px로 줄어듦 → 이 게임에서 되돌림(공용 수정은 WP1에 보고) */
body[data-mode="merge"] .duelbar.v3.mini{width:auto; height:auto; border-radius:0; background:none; color:inherit}
body[data-mode="merge"] .duelbar.mini .dmini{height:82px}
body[data-mode="merge"] .duelbar.mini .dmini .dm-board{left:10px; right:4px; top:3px; bottom:auto; height:55px; display:grid; place-items:center}
body[data-mode="merge"] .duelbar.mini .dmini .dm-board svg{display:block; width:55px; height:55px}
body[data-mode="merge"] .duelbar.mini .dmini .dm-val{bottom:2px}
/* 대전 결과 창: 모두의 끝 판 나란히 */
#modal .mgres{display:flex; flex-wrap:wrap; justify-content:center; gap:8px 10px; margin:10px 0 4px}
#modal .mgres figure{margin:0; display:grid; justify-items:center; gap:3px; padding:6px 6px 4px; border-radius:14px; background:#fff; border:2.5px solid var(--paper-line, #E6DCF5); border-top:5px solid var(--sc, #F0368A)}
#modal .mgres figure.me{border-color:#F0368A; border-top-color:#F0368A}
#modal .mgres figure.win{background:linear-gradient(180deg,#FFF6C8,#FFE08A); border-color:#E0A21C}
#modal .mgres svg{display:block; width:60px; height:60px}
#modal .mgres figcaption{font-family:var(--disp); font-size:13px; line-height:1.2; color:var(--ink, #1A0F45); max-width:76px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
@media (max-width:370px){ .ng-merge{--gap:7px} .ng-merge .mhud .hchip b{font-size:18px} .ng-merge .mhud .hchip{padding:4px 3px} .ng-merge .mtip{font-size:13px} }
@media (prefers-reduced-motion: reduce){ .ng-merge .mt{transition-duration:60ms} .ng-merge .v512::after, .ng-merge .v1024::after, .ng-merge .v2048::after, .ng-merge .msb.ok svg{animation:none} }
`,
    sounds:{
      mergeSlide(){ aNoise({ ft:'bandpass', f:900, f2:1800, q:1.4, a:.01, d:.07, v:.035 }); aTone({ f:340, f2:260, type:'triangle', d:.05, v:.035 }); },
      mergeBump(){ aThump({ f:120, f2:70, d:.08, v:.1 }); },
      mergeHit(o){ const k = log2(o.v || 4); aMarimba(penta(k + 1, 67), { v:.17 }); aMarimba(penta(k + 3, 67), { t:.05, v:.1 });
        if(k >= 6) aBell({ f:penta(k + 6, 67), t:.08, d:.6, v:.05, rev:.4 }); aThump({ f:170, f2:80, d:.08, v:.11 }); },
      mergeCombo(o){ const n = Math.min(5, o.n || 2); for(let i = 0; i < n + 1; i++) aBell({ f:penta(8 + i * 2, 67), t:.1 + i * .05, d:.45, v:.045, idx:1.3, rev:.35 }); },
      mergeBig(o){ aThump({ f:130, f2:40, d:.4, v:.28 }); aNoise({ ft:'lowpass', f:2200, f2:200, d:.45, v:.14, rev:.3 }); aSparkle({ root:(o.v || 256) >= 512 ? 86 : 79, n:5, t:.08 }); },
      mergeUnlock(){ aTone({ f:880, f2:1320, type:'square', d:.08, v:.04, lp:3000 }); aBell({ f:m2f(84), t:.06, d:.5, v:.06, rev:.35 }); aBell({ f:m2f(91), t:.12, d:.6, v:.05, rev:.4 }); },
      mergeIce(o){ aNoise({ ft:'highpass', f:3500, f2:6000, a:.005, d:o && o.broke ? .25 : .1, v:o && o.broke ? .12 : .06 }); if(o && o.broke){ aBell({ f:m2f(93), t:.04, d:.5, v:.05, rev:.4 }); aBell({ f:m2f(98), t:.1, d:.5, v:.04, rev:.4 }); } else aTone({ f:2400, f2:1800, type:'triangle', d:.06, v:.04 }); },
      mergeStar(){ aBell({ f:m2f(88), d:.5, v:.05, rev:.35 }); aBell({ f:m2f(95), t:.07, d:.6, v:.045, rev:.4 }); },
      mergeUndo(){ aTone({ f:1300, f2:420, type:'triangle', d:.18, v:.06 }); aWhoosh({ f:3200, f2:500, a:.02, d:.2, v:.04 }); },
      mergeStuck(){ aThump({ f:150, f2:50, d:.3, v:.3 }); [64, 61, 57].forEach((m, i) => aTone({ f:m2f(m), type:'triangle', t:.05 + i * .13, d:.3, v:.07, lp:2000, rev:.3 })); }
    },
    gate:{ mergeSlide:45, mergeBump:120, mergeHit:35, mergeCombo:120, mergeBig:150, mergeIce:60, mergeStar:150 },
    jingle(){ [0, 2, 4, 5, 7, 9, 11].forEach((d, i) => aMarimba(penta(d, 67), { t:i * .06, v:.15 })); [72, 76, 79, 84, 88].forEach(m => aBell({ f:m2f(m), t:.48, d:1.3, v:.06, idx:1.3, rev:.45 })); aThump({ f:140, f2:60, t:.45, d:.4, v:.22 }); aSparkle({ t:.55, n:6 }); },
    /* 무작위 입력 봇 점검(tools/random-bot.mjs): 오늘의 문제(날짜·난이도)를 숫자 엔진으로 한 판. kind = lr·ud·cw·any·greedy·ai */
    botRun(o){
      const cfg = dailyCfg(o.lv, o.day), rng = mulberry(seedFrom('exam:' + o.day + ':merge'));
      const bot = o.kind === 'ai' ? { depth:1, eps:0 } : o.kind === 'human' ? { depth:1, eps:.25, rng:mulberry(seedFrom('h:' + o.run)) } : { kind:o.kind, rng:mulberry(seedFrom(o.kind + ':' + o.day + ':' + o.run)) };
      const g = simGame(cfg, rng, bot); return { win:g.win, score:g.win ? g.score : 0, moves:g.moves };
    },
    /* ---- 테스트용 ---- */
    _core:{ slideV, stepV, hitIce, goalV, canMoveV, aiMove, evalV, valsOf, PAR, parOf, LINES, geo, initV, simGame, rankMoves, slideT, scoreOf, isIce, mkIce, tcol, fsz },
    _tune:{ soloCfg, goalsOf, GOALS, wantRate, estPar, starCut, tuneOf, DAILY, DUEL, OLD_LEVELS, dailyCfg, goalText, NEW_FROM },
    _move(d){ return doMove(d); },
    _undo(){ undo(); },
    _ai(depth = 0){ return aiNow(G.M, depth); },
    /* 자동 플레이로 끝까지(애니메이션 없이 즉시). 성공/막힘까지 이동 수 반환 */
    _solveForTest(max = 5000, depth = 0){ const M = G.M; let k = 0; while(!M.lock && !G.over && k < max){ const d = aiNow(M, depth); if(d < 0) break; doMove(d); k++; } return { moves:M.moves, best:M.best, lock:M.lock }; },
    _set(vals){ const M = G.M; flush(); M.grid = vals.map(v => { const t = tileOf(v); if(t && t !== ST) t.id = ++M.nid; return t; }); M.best = bestOf(M.grid); drawAll(); hud(); },
    _state(){ const M = G.M; return { grid:valsOf(M.grid).join(','), moves:M.moves, pts:M.pts, best:M.best, undoUsed:M.undoUsed, seq:M.seq.length, stars:M.stars.join(','), mv:M.mv, target:M.target }; }
  };
})();

/* @@NG_MODULES_END@@ */


/* 대전(대전 v3 경주, 2~5명, 세대별 테스트 2026-10-06): 같은 판·같은 새 타일 수열로 128 먼저, 2분(느긋하게 4분), 되돌리기 없음.
   2단계(다인원): duelMax 5 · 미니 화면 4×4 숫자 · 다른 사람이 64·128을 만들면 큰 알림 · 결과 창에 모두의 끝 판을 나란히 */
/* 미니 판 그림(SVG): s = duelMini.get()의 글자열(칸마다 log2 값 36진수, '.' 빈칸, '#' 막힌 칸) */
function mergeBoardSvg(s, px){
  s = String(s || ''); const n = s.length === 9 ? 3 : 4, gp = Math.max(1, Math.round(px / 40)), c = (px - gp * (n + 1)) / n, C = NG.merge._core;
  let g = `<rect width="${px}" height="${px}" rx="${Math.round(px / 9)}" fill="#1B1150"/>`;
  [...s.padEnd(n * n, '.')].slice(0, n * n).forEach((ch, i) => {
    const x = gp + (i % n) * (c + gp), y = gp + Math.floor(i / n) * (c + gp);
    if(ch === '.'){ g += `<rect x="${x}" y="${y}" width="${c}" height="${c}" rx="${c * .2}" fill="#2E2178"/>`; return; }
    if(ch === '#'){ g += `<rect x="${x}" y="${y}" width="${c}" height="${c}" rx="${c * .2}" fill="#9890B6"/>`; return; }
    const v = Math.pow(2, parseInt(ch, 36) || 1), col = C.tcol(v), fs = c * C.fsz(v) * 1.15;
    g += `<rect x="${x}" y="${y}" width="${c}" height="${c}" rx="${c * .2}" fill="${col[0]}"/><text x="${x + c / 2}" y="${y + c / 2 + fs * .36}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-family="Black Han Sans, Jua, sans-serif" fill="#fff" stroke="${v <= 4 ? '#B8651E' : '#1A0F45'}" stroke-width="${(c * .09).toFixed(1)}" paint-order="stroke">${v}</text>`;
  });
  return `<svg viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" aria-hidden="true">${g}</svg>`;
}
/* 컴퓨터 상대는 판이 없어서, 지금 가장 큰 타일(v)로 그럴듯한 판을 그려 보여 줌(보이기만, 씨앗 난수) */
function mergeFakeBoard(v, seed){
  const r = mulberry(seedFrom(String(seed || '') + ':mg:' + v)), a = Array(16).fill('.'), snake = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12];
  let k = Math.max(1, Math.round(Math.log2(Math.max(2, v || 2)))), i = 0;
  a[snake[i++]] = k.toString(36);
  for(let x = k - 1; x >= 1 && i < 16; x--) if(r() < .7) a[snake[i++]] = x.toString(36);
  for(; i < 16; i++) if(r() < .45) a[snake[i]] = (r() < .8 ? 1 : 2).toString(36);
  return a.join('');
}
const mergeNick = n => (typeof duelShortNick === 'function' ? duelShortNick(n) : String(n || '상대').split(/\s+/).pop()) || '상대';
/* 대전 시계(merge.js duelClock)가 0.25초마다 부름: 다른 사람의 가장 큰 타일이 64·128을 넘으면 큰 알림(사람·컴퓨터 모두) */
function mergeDuelTick(){
  const D = G && G.duel; if(!D || D.v !== 3 || !D.go || G.over || typeof duelNotify !== 'function') return;
  const seen = D.mgSeen = D.mgSeen || {};
  D.pl.forEach(pid => {
    const P = D.P[pid]; if(!P || P.me || P.left) return;
    if(P.ai && P.st.v) P.mv = mergeFakeBoard(P.st.v, D.seed + pid);   /* 컴퓨터 미니 판(보이기만) */
    const v = +P.st.v || 0, was = seen[pid]; if(was == null){ seen[pid] = v; return; }
    if(v <= was) return; seen[pid] = v;
    if(v >= 128 && was < 128) duelNotify(`${esc(mergeNick(P.nick))} 128 만들었어요!`, { from:P, kind:'bad', force:true, ms:1800 });
    else if(v >= 64 && was < 64) duelNotify(`${esc(mergeNick(P.nick))} 64 만들었어요`, { from:P, kind:'hot' });
  });
}
/* 결과 창(사이트·모듈 공용 #modal)이 뜨면 순위 목록 아래에 모두의 끝 판을 끼워 넣음. 엔진(core)은 그대로 */
function mergeResWatch(){
  const me = G, m = document.getElementById('modal'); if(!m || typeof MutationObserver === 'undefined' || me.mgRes) return;
  const ob = me.mgRes = new MutationObserver(() => { try{
    if(G !== me){ ob.disconnect(); return; }
    const D = G.duel; if(!D || !D.resolved || !D.res || m.querySelector('.mgres')) return;
    const at = m.querySelector('.dres-list, .dres'); if(!at) return;
    const mine = NG.merge.duelMini.get();
    const figs = D.res.rows.slice(0, 5).map(x => { const P = D.P[x.pid] || {};
      const s = x.me ? mine : (P.mv || mergeFakeBoard(x.v || (P.st && P.st.v) || 2, D.seed + x.pid));
      return `<figure class="${x.me ? 'me' : ''}${x.rank === 1 ? ' win' : ''}" style="--sc:${x.col}">${mergeBoardSvg(s, 60)}<figcaption>${x.rank}위 ${x.me ? '나' : esc(mergeNick(x.nick))}</figcaption></figure>`; }).join('');
    at.insertAdjacentHTML('afterend', `<div class="mgres" aria-label="모두의 끝 판">${figs}</div>`);
    ob.disconnect();
  }catch(_){ ob.disconnect(); } });
  ob.observe(m, { childList:true });
}
Object.assign(NG.merge, {
  duelPace:[90, .6],
  duelStat:{ unit:'', tile:true, get:() => { if(G.duel && G.duel.v === 3) mergeResWatch(); return { v:G.M.best, t:G.M.target, mis:G.M.mis || 0, p:G.M.pts }; } },
  duelHow:'같은 판에서 128을 먼저 만들면 승리 · 2분',
  duelKind:'race', duelMax:5,
  /* 대전 판: 128 먼저 · 2분. 느긋하게(4분)는 엔진이 duelSlow로 바꿈(여기서 pace를 보면 두 번 늘어남) */
  duelCfg(){ return Object.assign({}, NG.merge._tune.DUEL); },
  duelSlow(cfg){ return Object.assign({}, cfg, { limit:(cfg.limit || 120) * 2 }); },
  /* 순위: 128 먼저(ok·ft) → 가장 큰 타일(v) → 합친 값 합(p) → 실수(mis) 적은 순 */
  duelRank(a, b){ return (b.ok ? 1 : 0) - (a.ok ? 1 : 0) || (a.ok && b.ok ? (a.ft || 0) - (b.ft || 0) : 0) || (b.v || 0) - (a.v || 0) || (b.p || 0) - (a.p || 0) || (a.mis || 0) - (b.mis || 0); },
  /* 미니 화면: 상대 판 4×4 숫자(칸 약 13px). 컴퓨터는 가장 큰 타일로 그린 판 */
  duelMini:{ w:55, h:55,
    get:() => NG.merge._core.valsOf(G.M.grid).map(x => x > 0 ? Math.round(Math.log2(x)).toString(36) : x === 0 ? '.' : '#').join(''),
    draw(el, s, p){ if(!el) return; if(!s && p && p.st && p.st.v) s = mergeFakeBoard(p.st.v, (G.duel && G.duel.seed) + p.pid); el.innerHTML = mergeBoardSvg(s, 55); } }
});
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.merge.scene = { kind:'motes', colors:['#FFD27A','#FF9AC0','#FFFFFF'], density:1 };
