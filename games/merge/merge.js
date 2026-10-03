/* 숫자 합치기 */
/* ===== 숫자 합치기 (merge) · 4×4 밀어서 합치는 퍼즐 =====
   규칙: 밀면 모든 타일이 끝까지 미끄러지고, 같은 숫자는 한 번씩 합쳐져 두 배가 된다.
   움직임이 생긴 뒤마다 빈칸 하나에 새 타일(2: 90%, 4: 10%). 새 타일의 자리·값은 "몇 번째 이동인지"로 정해진
   rng 수열에서 꺼내므로 되돌리기를 해도 같은 수가 나온다(같은 씨앗 + 같은 이동 = 같은 판).
   보스 스테이지(n%10===0): 움직이지도 합쳐지지도 않는 돌 블록 1개(큰 목표는 2개가 아니라 1개로 고정). */
NG.merge = (() => {
  const ST = -1, SLIDE_MS = 110;
  /* par = 잘 두는 사람 기준 이동 수. 자동 플레이어로 측정:
     2수 탐색 AI 중앙값: 32→19, 64→38, 128→67, 256→132, 512→247, 1024→490 (30판). 약한 1수 AI는 256→158, 512→273. */
  const PAR = { 16:9, 32:19, 64:38, 128:67, 256:132, 512:247, 1024:490, 2048:980 };
  const parOf = t => PAR[t] || Math.round(t * 0.48);
  /* 판 크기 N(4 기본, '좁은 판'은 3). 칸 값 v[i]: 0 빈칸, -1 돌, -2 이하 = 자물쇠 타일(값의 음수), 그 밖엔 값.
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
    return (GEO[N] = { N, C, L, SYM });
  }
  const LINES = geo(4).L;
  const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const log2 = v => Math.round(Math.log2(v));
  const eul = v => '을을를을를를을을을를'[v % 10] === '를' ? v + '를' : v + '을';   /* 숫자 뒤 조사: 2 이→를, 8 팔→을 */
  const sizeOf = v => v.length === 9 ? 3 : 4;

  /* ---------- 숫자만 다루는 엔진(자동 플레이어·막힘 판정·시뮬레이션용) ----------
     돌과 자물쇠 타일은 벽처럼 줄을 끊는다. 자물쇠 타일 쪽으로 미끄러져 온 첫 타일이 같은 숫자면
     둘이 합쳐지며 자물쇠가 풀린다(합친 타일은 자물쇠 자리에 남고, 그 판에는 더 합쳐지지 않음). */
  function slideV(v, d, N = sizeOf(v)){
    const o = v.slice(), buf = []; let moved = false, pts = 0, mc = 0;
    for(const line of geo(N).L[d]){
      let a = 0;   /* 벽(돌·자물쇠) 사이 구간 line[a..b-1]을 앞쪽(line[a])으로 민다 */
      for(let b = 0; b <= N; b++){
        if(b < N && v[line[b]] >= 0) continue;
        if(b > a){
          buf.length = 0; for(let j = a; j < b; j++){ const x = o[line[j]]; if(x > 0) buf.push(x); }
          let s = 0, w = a;
          if(a > 0){ const f = line[a - 1]; if(o[f] < -1 && buf.length && buf[0] === -o[f]){ o[f] = buf[0] * 2; pts += o[f]; mc++; moved = true; s = 1; } }
          for(let i = s; i < buf.length; i++){
            let nv = buf[i];
            if(i + 1 < buf.length && buf[i] === buf[i + 1]){ nv *= 2; pts += nv; mc++; i++; }
            const ci = line[w++]; if(o[ci] !== nv){ moved = true; o[ci] = nv; }
          }
          for(; w < b; w++){ const ci = line[w]; if(o[ci] !== 0){ moved = true; o[ci] = 0; } }
        }
        a = b + 1;
      }
    }
    return { v:o, moved, pts, mc };
  }
  /* 움직일 수 있는 방향이 하나라도 있나(ban = 막힌 방향, -1 없음) */
  function canMoveV(v, ban = -1){ const N = sizeOf(v); for(let d = 0; d < 4; d++) if(d !== ban && slideV(v, d, N).moved) return true; return false; }
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
    return best + empty * 120 * (1 + empty * .15) - rough * 30;
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
  /* 방향별 점수(움직일 수 없는 방향은 빠짐), 높은 순 */
  function rankMoves(v, depth = 0, ban = -1, two = false){
    const N = sizeOf(v), out = [];
    for(let d = 0; d < 4; d++){ if(d === ban) continue; const r = slideV(v, d, N); if(r.moved) out.push({ d, s:chanceV(r.v, depth, ban, two) }); }
    return out.sort((a, b) => b.s - a.s);
  }
  /* 가장 좋은 방향(없으면 -1). depth 0 = 한 수 + 평균, 1 = 두 수 */
  function aiMove(v, depth = 0, greedy = false, ban = -1){
    if(greedy){ for(const d of [2, 3, 1, 0]) if(d !== ban && slideV(v, d).moved) return d; return -1; }
    const r = rankMoves(v, depth, ban); return r.length ? r[0].d : -1;
  }

  /* ---------- 새 판 만들기(화면·시뮬레이션 공용, 같은 난수면 같은 판) ---------- */
  /* 돌 자리: 구석이 아닌 테두리 칸. 두 개면 한 구석을 막아 가두지 않게 */
  const EDGE = { 4:[1, 2, 4, 7, 8, 11, 13, 14], 3:[1, 3, 5, 7] };
  const CORNER_PAIRS = { 4:['1,4', '2,7', '8,13', '11,14'], 3:['1,3', '1,5', '3,7', '5,7'] };
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
    /* 자물쇠 타일: 구석이 아닌 빈칸에 */
    const corners = [0, N - 1, C - N, C - 1];
    for(const val of cfg.locks || []){
      const em = []; for(let i = 0; i < C; i++) if(v[i] === 0 && !corners.includes(i)) em.push(i);
      if(!em.length) break;
      v[em[Math.floor(rng() * em.length)]] = -val;
    }
    for(let k = 0; k < 2; k++) spawnV(v, [rng(), rng()], .1);
    return v;
  }
  /* 한 수에 나오는 새 타일 수 — '쌍둥이 타일' 변주면 4번째 밀기마다 2개 */
  const spawnCount = (cfg, moves) => cfg.extra && moves % 4 === 0 ? 2 : 1;
  /* '막힌 길' 변주: 8번 밀 때마다 막힌 방향이 위 → 오른쪽 → 아래 → 왼쪽 순으로 바뀐다 */
  const ROT_EVERY = 8;
  const banOf = (cfg, moves) => cfg.rot ? Math.floor(moves / ROT_EVERY) % 4 : -1;
  const bestV = v => v.reduce((m, x) => x > m ? x : m, 0);

  /* 사람 같은 자동 플레이어로 한 판(되돌리기 1번 포함) — 난이도 맞추기용. 규칙은 화면의 doMove와 같다.
     bot: { depth, eps } — eps 확률로 가장 좋은 수 대신 두 번째(가끔 그 밖의) 수를 둔다 */
  function simGame(cfg, rng, bot = {}){
    const depth = bot.depth == null ? 1 : bot.depth, two = bot.two !== false, eps = bot.eps == null ? .2 : bot.eps, br = bot.rng || rng;
    let v = initV(cfg, rng); const seq = [], p4 = cfg.p4 || .1, lim = cfg.mv || 0;
    const pairAt = k => { while(seq.length <= k) seq.push(cfg.extra ? [rng(), rng(), rng(), rng()] : [rng(), rng()]); return seq[k]; };
    let moves = 0, undo = cfg.noUndo ? 0 : 1, snap = null, avoid = -1, lastD = -1;
    for(let guard = 0; guard < 6000; guard++){
      let r = rankMoves(v, depth, banOf(cfg, moves), two); if(avoid >= 0) r = r.filter(x => x.d !== avoid);
      if(!r.length){
        if(undo && snap){ undo = 0; v = snap.v; moves = snap.moves; avoid = lastD; snap = null; continue; }
        return { win:false, moves, best:bestV(v), why:'stuck' };
      }
      let pick = r[0];
      if(r.length > 1 && br() < eps) pick = r.length > 2 && br() < .3 ? r[2 + Math.floor(br() * (r.length - 2))] : r[1];
      snap = { v, moves }; lastD = pick.d; avoid = -1;
      const nv = slideV(v, pick.d).v; moves++;
      if(bestV(nv) >= cfg.target) return { win:true, moves, best:bestV(nv) };
      const pr = pairAt(moves - 1); spawnV(nv, pr, p4); if(spawnCount(cfg, moves) > 1) spawnV(nv, [pr[2], pr[3]], p4);
      v = nv;
      if(lim && moves >= lim){
        if(undo){ undo = 0; v = snap.v; moves = snap.moves; avoid = lastD; snap = null; continue; }
        return { win:false, moves, best:bestV(v), why:'moves' };
      }
    }
    return { win:false, moves, best:bestV(v), why:'guard' };
  }

  /* ---------- 화면용 타일 판: 새 타일은 n번째 이동 뒤 seq[n]에서 꺼낸다(되돌리기로 다른 수를 뽑을 수 없게) ---------- */
  function seqAt(M, k){ while(M.seq.length <= k) M.seq.push(M.extra ? [M.rng(), M.rng(), M.rng(), M.rng()] : [M.rng(), M.rng()]); return M.seq[k]; }
  function spawnInto(M, grid, pair){
    const em = []; for(let i = 0; i < grid.length; i++) if(!grid[i]) em.push(i);
    if(!em.length) return null;
    const cell = em[Math.min(em.length - 1, Math.floor(pair[0] * em.length))], v = pair[1] < M.p4 ? 4 : 2;
    const t = { id:++M.nid, v }; grid[cell] = t; return { cell, t };
  }
  const valsOf = g => g.map(x => x === ST ? ST : x ? (x.lk ? -x.v : x.v) : 0);
  const bestOf = g => g.reduce((m, x) => x && x !== ST && !x.lk && x.v > m ? x.v : m, 0);
  const isWall = x => x === ST || !!(x && x.lk);

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
    return { g:o, moved, pts, merges };
  }

  /* ---------- 솔로 난이도 v2: 5판마다 새 개념(기획팀 2026-09-30) ----------
     새 규칙: 11 돌 칸 · 21 이동 제한 · 31 자물쇠 타일 · 41 좁은 판(3×3). 변주: 6 번개 · 16 4가 우르르 · 26 맨손 · 36 쌍둥이 타일 · 46 막힌 길.
     규칙 조합마다 '사다리'(쉬움 → 어려움 설정 목록)를 두고, 판마다 사다리의 한 칸을 고른다.
     칸 고르기는 사람 같은 자동 플레이어(2수 탐색 + 20%는 두 번째로 좋은 수)로 첫 도전 성공률을 재서 맞췄다:
     챕터 자리 k=1·6·9 약 90% · 보통 75~85% · k=5 약 60% · k=10 보스 약 40%(챕터마다 조금씩 낮아짐).
     챕터 1(1~10)은 기본 익히기라 목표만 32→128로 키우고, 5·10판만 512로 어렵게. 자동 플레이어 = _core.simGame(판마다 40판으로 칸 찾기, 100판으로 검증).
     사다리 칸: T 목표, s 돌 수, l 자물쇠 타일 값들, p4 새 타일이 4일 확률(숨은 손잡이, 기본 .1), mf 이동 제한 = 기준 이동 × mf */
  const LAD = {
    '':            [{ T:32 }, { T:64 }, { T:128 }, { T:256, p4:.01 }, { T:256 }, { T:256, p4:.3 }, { T:256, p4:.5 }, { T:512, p4:.01 }, { T:512 }, { T:512, p4:.5 }],
    stone:         [{ T:64, s:1 }, { T:128, s:1 }, { T:128, s:2 }, { T:128, s:2, p4:.4 }, { T:256, s:1, p4:.01 }, { T:256, s:1 }, { T:256, s:1, p4:.4 }, { T:128, s:3 }, { T:128, s:3, p4:.4 }, { T:256, s:2, p4:.01 }, { T:256, s:2 }, { T:256, s:2, p4:.4 }],
    moves:         [{ T:128, mf:1.8 }, { T:128, mf:1.5 }, { T:128, mf:1.35 }, { T:128, mf:1.25 }, { T:128, mf:1.15 }, { T:128, mf:1.08 }, { T:256, mf:1.1 }, { T:256, mf:1.05 }, { T:128, mf:1.0 }, { T:256, mf:1.0 }, { T:256, mf:.96 }],
    lock:          [{ T:128, l:[32] }, { T:256, l:[64] }, { T:256, l:[64, 32] }, { T:256, l:[64, 64] }, { T:256, l:[128, 64] }, { T:256, l:[128, 64], p4:.4 }, { T:512, l:[128, 64] }, { T:512, l:[128] }, { T:512, l:[128, 128] }],
    small:         [{ T:32 }, { T:64, p4:.01 }, { T:64 }, { T:64, p4:.5 }, { T:128, p4:.8 }, { T:128, p4:.6 }, { T:128, p4:.3 }, { T:128 }, { T:128, p4:.01 }],
    'moves+stone': [{ T:128, s:1, mf:1.6 }, { T:128, s:1, mf:1.45 }, { T:128, s:1, mf:1.35 }, { T:128, s:1, mf:1.2 }, { T:128, s:1, mf:1.1 }, { T:128, s:2, mf:1.15 }, { T:128, s:2, mf:1.05 }, { T:128, s:2, mf:1.0 }, { T:128, s:2, mf:.95 }],
    'lock+moves':  [{ T:256, l:[64], mf:1.75 }, { T:256, l:[64], mf:1.6 }, { T:256, l:[64], mf:1.48 }, { T:256, l:[64], mf:1.38 }, { T:256, l:[64], mf:1.3 }, { T:256, l:[64], mf:1.24 }, { T:256, l:[64], mf:1.17 }, { T:256, l:[64], mf:1.1 }, { T:256, l:[64], mf:1.02 }, { T:256, l:[64], mf:.95 }],
    'moves+small': [{ T:64, mf:1.4 }, { T:64, mf:1.25 }, { T:64, mf:1.15 }, { T:64, mf:1.08 }, { T:64, mf:1.02 }, { T:64, mf:.96 }, { T:64, mf:.9 }, { T:64, mf:.85 }],
    'lock+stone':  [{ T:128, s:1, l:[32] }, { T:128, s:1, l:[32, 32] }, { T:128, s:2, l:[32] }, { T:256, s:1, l:[64] }, { T:256, s:1, l:[64, 32] }, { T:256, s:1, l:[128, 64] }, { T:256, s:2, l:[64] }, { T:256, s:1, l:[64, 64] }, { T:256, s:2, l:[128, 64] }],
    'lock+small':  [{ T:32, l:[8] }, { T:64, l:[8] }, { T:64, l:[16] }, { T:64, l:[8, 8] }, { T:64, l:[16, 16] }, { T:64, l:[32, 8] }, { T:128, l:[16] }, { T:128, l:[64, 16] }, { T:128, l:[32] }],
    'small+stone': [{ T:32, s:1, p4:.01 }, { T:32, s:1 }, { T:32, s:1, p4:.4 }, { T:64, s:1, p4:.01 }, { T:64, s:1 }, { T:64, s:1, p4:.3 }]
  };
  const ladKey = mj => mj.slice().sort().join('+');
  /* 판별 기준 이동 수(별·이동 제한 기준): 목표까지 쌓아야 할 합 ÷ 한 번에 새로 생기는 평균 값 */
  function parFor(c){
    const spv = (2 + 2 * c.p4) * (c.extra ? 1.25 : 1), lockSum = (c.locks || []).reduce((a, b) => a + b, 0);
    return Math.max(6, Math.round((parOf(c.target) * 2.2 - lockSum * .6) / spv));
  }
  /* 사다리 칸 + 계획(규칙·변주) → 판 설정 */
  function buildCfg(p, b){
    const tw = p.tw || null, mj = p.mj || [];
    const c = { limit:0, target:b.T, N:mj.includes('small') ? 3 : 4, stones:b.s || 0, locks:(b.l || []).slice(), p4:tw === 'four' ? .45 : b.p4 != null ? b.p4 : .1,
      extra:tw === 'extra', rot:tw === 'rot', noUndo:tw === 'bare', flash:tw === 'flash', mj:mj.slice(), tw, boss:!!p.boss, hard:!!p.hard, intro:p.intro || null, introKind:p.introKind || null };
    c.par = parFor(c); c.mv = b.mf ? Math.ceil(c.par * b.mf) : 0;
    return c;
  }
  /* 판마다 원하는 첫 도전 성공률(%) — 로얄 매치식 톱니: 쉬움 90 · 보통 75~85 · 어려움 60 · 보스 40 */
  function wantRate(n){
    const c = Math.ceil(n / 10), k = n - (c - 1) * 10;
    if(k === 1) return 92; if(k === 6 || k === 9) return 90;
    const base = { 2:86, 3:83, 4:80, 5:60, 7:80, 8:77, 10:40 }[k], drop = k === 5 || k === 10 ? Math.min(4, (c - 1) * .8) : Math.min(6, (c - 1) * 1.2);
    return base - drop + (c === 1 ? 5 : 0);
  }
  /* 판별 사다리 칸(스테이지 1~100, 자동 플레이어로 맞춘 값 · 36진수 한 글자) */
  const TUNE = '0124824429133372241901314423150223521216113342011322423232151223402316143231322512333232251333600315';
  /* 100판 뒤(리믹스 반복): 사다리 칸별 측정 성공률(변주 없음)로 원하는 성공률에 가장 가까운 칸. 변주는 그만큼 쉬운 칸으로 */
  const RATE = { '':[100,100,100,90,90,93,82,57,45,30], 'stone':[100,98,87,83,78,68,65,55,50,40,40,33], 'moves':[100,83,85,75,60,55,53,40,25,33,10], 'lock':[100,95,82,77,68,53,35,30,23], 'small':[100,93,93,95,55,50,42,38,35], 'moves+stone':[93,83,73,60,55,48,30,12,5], 'lock+moves':[95,90,85,75,68,60,52,45,40,30], 'moves+small':[98,92,85,78,70,55,40,30], 'lock+stone':[92,80,75,65,47,37,35,28,18], 'lock+small':[98,85,85,70,60,50,42,30,20], 'small+stone':[97,100,95,57,57,53] };
  const TW_EASE = { four:6, bare:4, extra:6, rot:20 };
  function rungOf(n, p, key){
    if(n <= TUNE.length) return parseInt(TUNE[n - 1], 36);
    const lad = LAD[key] || LAD[''], rt = RATE[key], want = Math.min(97, wantRate(n) + (TW_EASE[p.tw] || 0));
    if(!rt) return Math.round((lad.length - 1) * (1 - want / 100) * 1.4);
    let bi = 0; rt.forEach((r, i) => { if(Math.abs(r - want) < Math.abs(rt[bi] - want)) bi = i; }); return bi;
  }
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
  const ARROW = ['↑', '→', '↓', '←'], DIRN = ['위', '오른쪽', '아래', '왼쪽'];
  const cOf = i => i % G.M.N, rOf = i => Math.floor(i / G.M.N);
  const nameOf = k => (conceptInfo('merge', k) || {}).name || k;
  const banNow = M => banOf(M.cfg, M.moves);

  function hud(){
    const M = G.M, s = (id, t) => { const e = document.getElementById(id); if(e) e.textContent = t; };
    if(M.mv){ const left = Math.max(0, M.mv - M.moves); s('mMoves', left); const e = document.getElementById('mMoves'); if(e) e.parentNode.classList.toggle('warn', left <= Math.max(3, Math.round(M.mv * .12))); }
    else s('mMoves', M.moves);
    s('mPts', fmt(M.pts));
    const b = document.getElementById('mBest'); if(b && +b.dataset.v !== M.best){ b.dataset.v = M.best; b.innerHTML = tileHTML(M.best); }
    const f = document.getElementById('mFill'); if(f) f.style.width = (NG.merge.progress() * 100).toFixed(1) + '%';
    const u = document.getElementById('mUndo');
    if(u){ u.disabled = M.noUndo || !M.snap || M.undoUsed || M.lock; u.querySelector('small').textContent = M.noUndo ? '맨손' : M.undoUsed ? '사용함' : '1회'; }
    if(M.cfg.rot){
      const d = banNow(M), left = ROT_EVERY - M.moves % ROT_EVERY, bar = document.getElementById('mBan');
      if(bar){ bar.className = 'mban d' + d; bar.setAttribute('aria-label', DIRN[d] + '쪽으로는 밀 수 없어요'); }
      s('mBanTxt', ARROW[d] + ' 막힘 · ' + left + '번 뒤 바뀜');
    }
  }
  function mkTile(t, cell, cls){
    const el = document.createElement('div'); el.className = 'mt' + (cls ? ' ' + cls : '') + (t.lk ? ' lk' : '');
    el.style.setProperty('--c', cell % G.M.N); el.style.setProperty('--r', Math.floor(cell / G.M.N)); el.innerHTML = tileHTML(t.v) + (t.lk ? '<i class="mlk">' + ICON_LOCK + '</i>' : '');
    if(t.lk) el.setAttribute('aria-label', '자물쇠 ' + t.v);
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
    const M = G.M, [dx, dy] = DV[d]; sfx('mergeBump');
    if(M.board.animate && !FXR.reduce) M.board.animate([{ transform:'translate(0,0)' }, { transform:`translate(${dx * 5}px,${dy * 5}px)` }, { transform:'translate(0,0)' }], { duration:160, easing:'ease-out' });
  }

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
    const won = M.best >= M.target, sps = [];
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
    M.pend = () => {
      for(const id of gone.keys()){ const el = M.els.get(id); if(el) el.remove(); M.els.delete(id); }
      for(const m of res.merges){ const el = M.els.get(m.keep); if(!el) continue; el.innerHTML = tileHTML(m.v); el.classList.remove('pop', 'lk'); el.removeAttribute('aria-label'); void el.offsetWidth; el.classList.add('pop'); }
      for(const el of M.layer.querySelectorAll('.mt.new')) el.classList.remove('new', 'twin');
      mergeFx(res);
      for(const m of unl){ const p = cellXY(m.cell); fxBurst(p.x, p.y, ['#FFD84A', '#FFF3A8', '#FFFFFF'], 14, { speed:240, size:4.5, kinds:['spark', 'dot'], up:40, dur:.6 }); fxFloat(p.x, p.y + p.w * .1, '자물쇠 풀림!', 'mgf unl'); }
    };
    M.pendT = setTimeout(() => { if(M.pend){ const f = M.pend; M.pend = null; f(); } }, SLIDE_MS);
    hud();
    if(won) celebrate();
    else if(M.mv && M.moves >= M.mv) stuck(true);
    else if(!canMoveV(valsOf(M.grid), M.cfg.rot ? banNow(M) : -1)) stuck(false);
    return true;
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
    if(big.v >= 256){ fxShake(M.board, big.v >= 512 ? 7 : 5); sfx('mergeBig', { v:big.v }); }
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
      let ti = -1; M.grid.forEach((x, i) => { if(x && x !== ST && !x.lk && (ti < 0 || x.v > M.grid[ti].v)) ti = i; });
      const el = ti >= 0 && M.els.get(M.grid[ti].id);
      if(el){ el.classList.add('win'); fxPop(el, 'gold'); }
      const b = document.createElement('div'); b.className = 'mbanner win' + (ti >= M.N * M.N / 2 ? ' up' : ''); b.innerHTML = `<b>목표 ${M.target} 완성!</b><span>${M.mv ? (M.mv - M.moves) + '번 남기고' : M.moves + '번 만에'} 해냈어요</span>`;
      M.bwrap.appendChild(b);
      fxConfetti(); sfx('win', { g:'merge' }); fxBuzz([30, 60, 30, 60, 80]);
    }, SLIDE_MS + 40);
    later(() => { if(G && G.M === M) finish(true); }, 1500);
  }
  /* 막힘(out = 이동 제한을 다 씀) */
  function stuck(out){
    const M = G.M; M.lock = true; M.out = !!out; hud();
    later(() => {
      flush();
      sfx('mergeStuck'); fxShake(M.board, 6); fxBuzz([60, 40, 90]);
      const canUndo = M.snap && !M.undoUsed && !M.noUndo;
      const b = document.createElement('div'); b.className = 'mbanner bad';
      b.innerHTML = `<b>${out ? '이동을 다 썼어요' : '더 움직일 수 없어요'}</b><span>${canUndo ? '되돌리기로 한 번 살려 볼까요?' : out ? M.mv + '번 안에 ' + eul(M.target) + ' 만들지 못했어요' : '빈칸이 없고 합칠 짝도 없어요'}</span>` +
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
  /* 판 아래 한 줄 안내: 새 규칙/변주 판이면 그 설명, 아니면 켜진 규칙 요약 */
  function tipHTML(M){
    const c = M.cfg, bits = [];
    if(c.intro){ const inf = conceptInfo('merge', c.intro); if(inf) return `<b>${c.introKind === 'twist' ? '새 변주' : '새 규칙'}</b>${inf.desc}`; }
    if(c.mj && c.mj.includes('stone')) bits.push('<u>돌 칸</u>은 안 움직여요');
    if(c.mj && c.mj.includes('lock')) bits.push('<u>자물쇠</u>는 같은 숫자로 부딪혀 풀어요');
    if(M.mv) bits.push(M.mv + '번 안에');
    if(c.tw === 'rot') bits.push('막힌 방향은 ' + ROT_EVERY + '번마다 바뀌어요');
    if(c.tw === 'extra') bits.push('4번째마다 새 타일 2개');
    if(c.tw === 'bare') bits.push('되돌리기 없이');
    if(c.tw === 'four') bits.push('4가 자주 나와요');
    if(c.tw === 'flash') bits.push('별 기준 이동이 짧아요');
    const lead = c.boss ? '<b>보스</b>' : c.hard ? '<b>어려움</b>' : '';
    return bits.length ? lead + bits.join(' · ') + ` — <b class="n">${M.target}</b>` + eul(M.target).slice(String(M.target).length) + ' 만들어요'
      : lead + '같은 숫자끼리 밀어 붙여 <b class="n">' + M.target + '</b>' + eul(M.target).slice(String(M.target).length) + ' 만들어요';
  }

  return {
    name:'숫자 합치기', abil:'전략력', col:['#FFB86B', '#F2711C', '#9A3A00'], time:'약 4분',
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
    help:[['밀어서 모두 움직여요', '위·아래·왼쪽·오른쪽으로 밀면(키보드 화살표도 돼요) 모든 타일이 그쪽 끝까지 미끄러져요.'],
      ['같은 숫자는 하나로', '같은 숫자끼리 부딪히면 합쳐져 두 배가 돼요. 한 번 밀 때마다 빈칸에 새 타일(2 또는 4)이 생겨요.'],
      ['목표 숫자를 만들면 성공', '목표 타일을 만들면 이겨요. 더 움직일 수 없으면 실패예요. 적게 움직일수록 점수가 높고, 되돌리기는 한 판에 1번이에요.'],
      ['솔로는 5판마다 새 규칙', '돌 칸(안 움직여요) · 이동 제한 · 자물쇠 타일(같은 숫자로 부딪히면 풀리며 합쳐져요) · 좁은 3×3 판이 차례로 나오고, 사이사이 변주가 더해져요. 판 위 칩에 지금 규칙이 보여요.']],
    chapters:['숫자 마을', '계산 공장', '합산 탑', '제곱 협곡', '무한 궁전'],
    starRule:'★ 목표 달성 · ★★ 적은 이동으로 · ★★★ 아주 적은 이동으로',
    levels:{ easy:{ limit:0, target:128, stones:0 }, normal:{ limit:0, target:256, stones:0 }, hard:{ limit:0, target:512, stones:0 } },
    /* 난이도 v2 계약: 새 규칙 4개(11·21·31·41) + 변주 5개(6·16·26·36·46) */
    concepts:{
      order:['stone', 'moves', 'lock', 'small'],
      info:{
        stone:{ name:'돌 칸', desc:'회색 돌 칸은 움직이지도, 합쳐지지도 않아요. 돌이 줄을 끊으니 타일이 돌 앞에서 멈춰요.' },
        moves:{ name:'이동 제한', desc:'정해진 이동 수 안에 목표 숫자를 만들어야 해요. 남은 이동이 0이 되면 실패예요.' },
        lock:{ name:'자물쇠 타일', desc:'자물쇠 타일은 움직이지 않고 벽처럼 막아요. 같은 숫자 타일을 밀어 부딪히면 자물쇠가 풀리며 둘이 합쳐져요!' },
        small:{ name:'좁은 판', desc:'판이 3×3으로 줄어요. 목표는 낮지만 빈칸이 금방 차니 한 수 한 수 신중하게!' }
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
    stage(n){
      const p = planOf('merge', n), key = ladKey(p.mj), lad = LAD[key] || LAD[''];
      return buildCfg(p, lad[Math.max(0, Math.min(lad.length - 1, rungOf(n, p, key)))]);
    },
    stageDesc(n){
      const s = this.stage(n);
      return (s.N === 3 ? '3×3 판 · ' : '') + '목표 ' + s.target + (s.mv ? ' · 이동 ' + s.mv + '번' : '') + (s.stones ? ' · 돌 ' + s.stones + '개' : '') + (s.locks.length ? ' · 자물쇠 ' + s.locks.join('·') : '');
    },
    levelDesc(lv){ return '목표 ' + (this.levels[lv] || this.levels.normal).target; },
    init(cfg, rng){
      const v = initV(cfg, rng);
      const M = { rng, cfg, N:cfg.N || 4, target:cfg.target || 256, p4:cfg.p4 != null ? cfg.p4 : .1, extra:!!cfg.extra, mv:cfg.mv || 0, noUndo:!!cfg.noUndo,
        grid:null, seq:[], nid:0, moves:0, pts:0, best:0, mergeN:0,
        snap:null, undoUsed:false, lock:false, out:false, pend:null, pendT:0, timers:new Set(), els:new Map(), stones:cfg.stones || 0, gapPx:8 };
      M.grid = v.map(x => x === ST ? ST : x > 0 ? { id:++M.nid, v:x } : x < -1 ? { id:++M.nid, v:-x, lk:true } : null);
      M.best = bestOf(M.grid);
      G.M = M;
      G.cleanup = () => { if(M.lastF) M.lastF.remove(); clearTimeout(M.pendT); M.pend = null; for(const t of M.timers) clearTimeout(t); M.timers.clear(); if(M.off) M.off(); };
    },
    render(st){
      const M = G.M, c = M.cfg, chips = [];
      for(const k of c.mj || []) chips.push(`<span class="mc r">${nameOf(k)}</span>`);
      if(c.tw) chips.push(`<span class="mc t">${nameOf(c.tw)}</span>`);
      if(c.boss) chips.unshift('<span class="mc b">보스</span>'); else if(c.hard) chips.unshift('<span class="mc h">어려움</span>');
      st.innerHTML = `<div class="ng-merge${c.boss || M.stones ? ' boss' : ''}${M.N === 3 ? ' n3' : ''}" style="--n:${M.N}">
        <div class="mhud">
          <div class="mgoal" aria-label="목표 ${M.target}"><span>목표</span><div class="mgt">${tileHTML(M.target)}</div></div>
          <div class="mstats">
            <div class="ms"><span>최고</span><b class="mbest" id="mBest" data-v="0"></b></div>
            <div class="ms${M.mv ? ' lim' : ''}"><span>${M.mv ? '남은 이동' : '이동'}</span><b id="mMoves">0</b></div>
            <div class="ms"><span>점수</span><b id="mPts">0</b></div>
            <div class="ms"><span>시간</span><b id="sclock">00:00</b></div>
          </div>
        </div>
        ${chips.length ? `<div class="mchips" aria-label="이번 판 규칙">${chips.join('')}${c.rot ? '<span class="mc x" id="mBanTxt"></span>' : ''}</div>` : ''}
        <div class="mprog" aria-hidden="true"><i id="mFill"></i></div>
        <div class="mbwrap"><div class="mboard" id="mBoard" role="application" aria-label="숫자 판. 밀거나 화살표 키로 움직여요">
          <div class="mslots">${'<i></i>'.repeat(M.N * M.N)}</div><div class="mlayer"></div>${c.rot ? '<div class="mban" id="mBan"></div>' : ''}</div></div>
        <div class="mtools">
          <button class="mundo" id="mUndo" aria-label="되돌리기 한 번">${ICON_UNDO}<span>되돌리기<small>1회</small></span></button>
          <div class="mtip">${tipHTML(M)}</div>
        </div></div>`;
      M.wrap = st.querySelector('.ng-merge'); M.board = st.querySelector('#mBoard'); M.bwrap = st.querySelector('.mbwrap'); M.layer = st.querySelector('.mlayer');
      drawAll('new'); measure(); hud();
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
        const s = M.layer.querySelector('.stone'), l = M.layer.querySelector('.mt.lk');
        if(l) fxBubble(l, '같은 숫자로 부딪히면 풀려요'); else if(s) fxBubble(s, '돌 칸: 움직이지 않아요');
        else if(M.mv){ const e = document.getElementById('mMoves'); if(e) fxBubble(e.parentNode, M.mv + '번 안에 만들어요'); }
      }, 700);
    },
    progress(){ const M = G && G.M; if(!M) return 0; return Math.max(0, Math.min(1, (Math.log2(Math.max(2, M.best)) - 1) / (Math.log2(M.target) - 1))); },
    lossText(){ const M = G.M; return M.out ? `이동 ${M.mv}번을 다 썼어요. 목표 ${M.target}까지 ${eul(M.best)} 만들었어요.` : `목표 ${M.target}까지 ${eul(M.best)} 만들었어요.`; },
    score(){
      const M = G.M, par = M.cfg.par || parOf(M.target), mv = M.moves;
      const time = Math.round(350 * Math.max(0, Math.min(1, (1.6 * par - mv) / (0.8 * par))));
      return { base:500, time, extra:M.undoUsed ? 0 : 150, rows:['목표 ' + M.target + ' 만들기', '효율 보너스 (' + mv + '번 이동)', M.undoUsed ? '되돌리기 사용' : '되돌리기 안 씀'] };
    },
    /* 별: 기준 이동(par) 안이면 ★★★, 1.3배 안이면 ★★. 이동 제한 판은 제한보다 넉넉하지 않게, 번개는 기준 ×0.8 */
    stars(){ const M = G.M, t = starCut(M.cfg); return M.moves <= t[0] ? 3 : M.moves <= t[1] ? 2 : 1; },
    css:`
body[data-mode="merge"]{background:
  radial-gradient(80% 40% at 15% 0%, rgba(255,214,120,.55) 0%, rgba(255,214,120,0) 70%),
  radial-gradient(70% 45% at 100% 100%, rgba(80,40,200,.55) 0%, rgba(80,40,200,0) 70%),
  linear-gradient(170deg,#FF9A5C 0%, #F0568F 42%, #8B3FD0 78%, #4A2398 100%) fixed}
.ng-merge{--gap:8px; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; touch-action:none; color:#fff; padding-bottom:6px}
.ng-merge .mhud{display:flex; align-items:stretch; gap:8px; padding:8px; border-radius:20px; background:linear-gradient(180deg,#3A2596,#23166A); border:3px solid #1A0F45;
  box-shadow:inset 0 2px 0 rgba(255,255,255,.2), 0 4px 0 #0E0730, 0 10px 18px rgba(20,5,60,.3)}
.ng-merge .mgoal{flex:none; width:76px; border-radius:14px; background:radial-gradient(circle at 50% 60%, rgba(255,226,122,.35), rgba(255,226,122,0) 70%), #170D47; box-shadow:inset 0 2px 5px rgba(0,0,0,.45);
  display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px 0 7px; gap:2px}
.ng-merge .mgoal > span{font-family:var(--disp); font-size:13px; color:#FFE27A; line-height:1}
.ng-merge .mgt{position:relative; width:52px; height:52px; --ts:52px; animation:merge_mgbob 2.4s ease-in-out infinite}
@keyframes merge_mgbob{50%{transform:translateY(-2px) rotate(-3deg)}}
.ng-merge .mstats{flex:1; min-width:0; display:grid; grid-template-columns:1fr 1fr; gap:6px}
.ng-merge .ms{display:flex; align-items:center; justify-content:space-between; gap:4px; padding:0 10px; border-radius:12px; background:rgba(255,255,255,.1); box-shadow:inset 0 1px 0 rgba(255,255,255,.12); min-height:34px}
.ng-merge .ms > span{font-size:12px; font-weight:700; color:#CFC5FF; white-space:nowrap}
.ng-merge .ms > b{font-family:var(--heavy); font-weight:400; font-size:19px; letter-spacing:.3px; font-variant-numeric:tabular-nums; color:#fff; line-height:1}
.ng-merge .ms > b#sclock{font-family:var(--heavy); font-size:17px; color:#FFE27A}
.ng-merge .mbest{position:relative; width:32px; height:32px; --ts:32px; display:block}
.ng-merge .mbest .mi, .ng-merge .mgt .mi{border-width:2px}
.ng-merge .mprog{position:relative; height:10px; margin:10px 6px 10px; border-radius:6px; background:rgba(26,15,69,.55); box-shadow:inset 0 2px 3px rgba(0,0,0,.35); overflow:hidden}
.ng-merge .mprog i{position:absolute; left:0; top:0; bottom:0; width:0; border-radius:6px; background:linear-gradient(90deg,#FFE27A,#FFB020); box-shadow:inset 0 2px 0 rgba(255,255,255,.55); transition:width .35s cubic-bezier(.2,.8,.3,1)}
.ng-merge .mbwrap{position:relative}
.ng-merge .mboard{--ts:70px; position:relative; aspect-ratio:1; width:100%; max-width:440px; margin:0 auto; padding:var(--gap); border-radius:22px;
  background:linear-gradient(180deg,#34228A,#241668); border:3px solid #1A0F45;
  box-shadow:inset 0 3px 0 rgba(255,255,255,.18), inset 0 -4px 0 rgba(0,0,0,.25), 0 6px 0 #0E0730, 0 16px 30px rgba(20,5,60,.45)}
.ng-merge .mslots, .ng-merge .mlayer{position:absolute; inset:var(--gap)}
.ng-merge .mslots{display:grid; grid-template-columns:repeat(var(--n,4),1fr); grid-template-rows:repeat(var(--n,4),1fr); gap:var(--gap)}
.ng-merge .mslots i{border-radius:22%; background:#1B1150; box-shadow:inset 0 3px 6px rgba(0,0,0,.5), inset 0 -2px 0 rgba(255,255,255,.06)}
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
.ng-merge .mt.pop .mi{animation:merge_mpop .2s cubic-bezier(.3,1.6,.5,1)}
@keyframes merge_mpop{0%{transform:scale(1)} 45%{transform:scale(1.2)} 100%{transform:scale(1)}}
.ng-merge .mt.win{z-index:4}
.ng-merge .mt.win .mi{animation:merge_mwin 1.2s cubic-bezier(.3,1.5,.5,1) both; box-shadow:0 0 0 4px #FFF3A8, 0 0 36px 10px rgba(255,214,90,.95)}
@keyframes merge_mwin{0%{transform:scale(1)} 25%{transform:scale(1.35) rotate(-6deg)} 45%{transform:scale(1.18) rotate(4deg)} 100%{transform:scale(1.22)}}
.ng-merge .mt.stone .mi{--gl:transparent; background:radial-gradient(circle at 28% 70%, rgba(40,30,80,.28) 0 6%, transparent 7%), radial-gradient(circle at 74% 34%, rgba(40,30,80,.22) 0 5%, transparent 6%), radial-gradient(circle at 66% 78%, rgba(255,255,255,.3) 0 4%, transparent 5%), linear-gradient(180deg,#C9C2DE 0%, #9890B6 50%, #6C648C 100%); border-color:#1A0F45; box-shadow:inset 0 -5px 0 rgba(0,0,0,.25), inset 0 2px 0 rgba(255,255,255,.5), 0 3px 0 rgba(10,4,40,.55)}
.ng-merge .mt.stone .mi::before{opacity:.45}
.ng-merge .mt.stone svg{position:relative; width:80%; height:80%}
.ng-merge .merge_mcombo{position:absolute; left:50%; top:-24px; z-index:8; pointer-events:none; transform:translate(-50%,0); display:flex; align-items:center; gap:8px; padding:6px 14px 6px 8px; border-radius:999px; white-space:nowrap;
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
.ng-merge .mtools{display:flex; align-items:center; gap:10px; margin-top:16px}
.ng-merge .mundo{flex:none; display:flex; align-items:center; gap:8px; height:52px; padding:0 16px 0 12px; border-radius:16px; color:#fff; font-family:var(--disp); font-size:16px; text-shadow:0 2px 0 #124F92;
  background:linear-gradient(180deg,#86D6FF,#2E8FE8); border:2.5px solid #124F92; box-shadow:inset 0 2px 0 rgba(255,255,255,.55), inset 0 -4px 0 rgba(0,0,0,.14), 0 4px 0 #124F92, 0 7px 12px rgba(20,5,40,.22); transition:transform .08s}
.ng-merge .mundo span{display:flex; flex-direction:column; align-items:flex-start; line-height:1.1}
.ng-merge .mundo small{font-family:var(--font); font-size:11px; font-weight:800; opacity:.9; text-shadow:none}
.ng-merge .mundo:active:not(:disabled){transform:translateY(3px); box-shadow:inset 0 2px 0 rgba(255,255,255,.5), 0 1px 0 #124F92}
.ng-merge .mundo:disabled{filter:grayscale(.8); opacity:.55}
.ng-merge .mtip{flex:1; min-width:0; font-size:13px; font-weight:700; line-height:1.35; color:#fff; background:rgba(26,15,69,.35); border-radius:14px; padding:8px 12px}
.ng-merge .mtip b{font-family:var(--heavy); font-weight:400; color:#FFE27A}
.ng-merge.boss .mtip{background:rgba(26,15,69,.6); box-shadow:inset 0 0 0 2px rgba(207,197,255,.4)}
.ng-merge .mtip b:not(.n){display:inline-block; font-family:var(--disp); font-size:12px; color:#1A0F45; background:#FFE27A; border-radius:6px; padding:0 6px; margin-right:4px}
.ng-merge .mtip u{text-decoration:none; color:#E2DCFA; border-bottom:2px solid #A69DC4}
/* 난이도 v2: 규칙 칩 · 남은 이동 · 자물쇠 타일 · 막힌 길 · 3×3 판 */
.ng-merge .mchips{display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin:10px 4px -2px}
.ng-merge .mc{font-family:var(--disp); font-size:13px; line-height:1; padding:5px 10px 4px; border-radius:999px; border:2px solid #1A0F45; color:#1A0F45; background:#fff; box-shadow:0 2px 0 #0E0730; white-space:nowrap}
.ng-merge .mc.r{background:#FFE27A}
.ng-merge .mc.t{background:#9FE3FF}
.ng-merge .mc.b{background:#FF5C6A; color:#fff; -webkit-text-stroke:3px #7A1440; paint-order:stroke fill}
.ng-merge .mc.h{background:#FFA53A}
.ng-merge .mc.x{background:#1B1150; color:#FFE27A; border-color:#FF5C6A; font-variant-numeric:tabular-nums}
.ng-merge .ms.lim{background:rgba(255,226,122,.2); box-shadow:inset 0 0 0 2px rgba(255,226,122,.55)}
.ng-merge .ms.lim > span{color:#FFE27A}
.ng-merge .ms.warn{background:rgba(255,92,106,.5); box-shadow:inset 0 0 0 2px #FF8A95; animation:merge_mwarn 1s ease-in-out infinite}
@keyframes merge_mwarn{50%{background:rgba(255,92,106,.25)}}
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
body[data-mode="merge"] .fxfloat.mgf{font-family:var(--heavy); font-weight:400; font-size:24px; color:#fff; -webkit-text-stroke:5px #1A0F45}
body[data-mode="merge"] .fxfloat.mgf.hi{color:#FFE27A; font-size:28px}
@media (max-width:370px){ .ng-merge{--gap:7px} .ng-merge .mgoal{width:66px} .ng-merge .mgt{width:46px; height:46px; --ts:46px} .ng-merge .ms{padding:0 8px} .ng-merge .ms > b{font-size:17px} .ng-merge .mtip{font-size:12px} }
@media (prefers-reduced-motion: reduce){ .ng-merge .mt{transition-duration:60ms} .ng-merge .v512::after, .ng-merge .v1024::after, .ng-merge .v2048::after, .ng-merge .mgt{animation:none} }
`,
    sounds:{
      mergeSlide(){ aNoise({ ft:'bandpass', f:900, f2:1800, q:1.4, a:.01, d:.07, v:.035 }); aTone({ f:340, f2:260, type:'triangle', d:.05, v:.035 }); },
      mergeBump(){ aThump({ f:120, f2:70, d:.08, v:.1 }); },
      mergeHit(o){ const k = log2(o.v || 4); aMarimba(penta(k + 1, 67), { v:.17 }); aMarimba(penta(k + 3, 67), { t:.05, v:.1 });
        if(k >= 6) aBell({ f:penta(k + 6, 67), t:.08, d:.6, v:.05, rev:.4 }); aThump({ f:170, f2:80, d:.08, v:.09 }); },
      mergeCombo(o){ const n = Math.min(5, o.n || 2); for(let i = 0; i < n + 1; i++) aBell({ f:penta(8 + i * 2, 67), t:.1 + i * .05, d:.45, v:.045, idx:1.3, rev:.35 }); },
      mergeBig(o){ aThump({ f:130, f2:40, d:.4, v:.28 }); aNoise({ ft:'lowpass', f:2200, f2:200, d:.45, v:.14, rev:.3 }); aSparkle({ root:(o.v || 256) >= 512 ? 86 : 79, n:5, t:.08 }); },
      mergeUnlock(){ aTone({ f:880, f2:1320, type:'square', d:.08, v:.04, lp:3000 }); aBell({ f:m2f(84), t:.06, d:.5, v:.06, rev:.35 }); aBell({ f:m2f(91), t:.12, d:.6, v:.05, rev:.4 }); },
      mergeUndo(){ aTone({ f:1300, f2:420, type:'triangle', d:.18, v:.06 }); aWhoosh({ f:3200, f2:500, a:.02, d:.2, v:.04 }); },
      mergeStuck(){ aThump({ f:150, f2:50, d:.3, v:.3 }); [64, 61, 57].forEach((m, i) => aTone({ f:m2f(m), type:'triangle', t:.05 + i * .13, d:.3, v:.07, lp:2000, rev:.3 })); }
    },
    gate:{ mergeSlide:45, mergeBump:120, mergeHit:35, mergeCombo:120, mergeBig:150 },
    jingle(){ [0, 2, 4, 5, 7, 9, 11].forEach((d, i) => aMarimba(penta(d, 67), { t:i * .06, v:.15 })); [72, 76, 79, 84, 88].forEach(m => aBell({ f:m2f(m), t:.48, d:1.3, v:.06, idx:1.3, rev:.45 })); aThump({ f:140, f2:60, t:.45, d:.4, v:.22 }); aSparkle({ t:.55, n:6 }); },
    /* ---- 테스트용 ---- */
    _core:{ slideV, canMoveV, aiMove, evalV, valsOf, PAR, parOf, LINES, geo, initV, simGame, rankMoves, slideT },
    _tune:{ LAD, ladKey, buildCfg, wantRate, parFor, starCut, rungOf },
    _move(d){ return doMove(d); },
    _undo(){ undo(); },
    _ai(depth = 0){ const M = G.M; return aiMove(valsOf(M.grid), depth, false, M.cfg.rot ? banNow(M) : -1); },
    /* 자동 플레이로 끝까지(애니메이션 없이 즉시). 성공/막힘까지 이동 수 반환 */
    _solveForTest(max = 5000, depth = 0){ const M = G.M; let k = 0; while(!M.lock && !G.over && k < max){ const d = aiMove(valsOf(M.grid), depth, false, M.cfg.rot ? banNow(M) : -1); if(d < 0) break; doMove(d); k++; } return { moves:M.moves, best:M.best, lock:M.lock }; },
    _set(vals){ const M = G.M; flush(); M.grid = vals.map(v => v === ST ? ST : v > 0 ? { id:++M.nid, v } : v < -1 ? { id:++M.nid, v:-v, lk:true } : null); M.best = bestOf(M.grid); drawAll(); hud(); },
    _state(){ const M = G.M; return { grid:valsOf(M.grid).join(','), moves:M.moves, pts:M.pts, best:M.best, undoUsed:M.undoUsed, seq:M.seq.length }; }
  };
})();

/* @@NG_MODULES_END@@ */


/* 대전: AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
Object.assign(NG.merge, { duelPace:[240,.62], duelStat:{ unit:'', tile:true,    get:() => ({ v:G.M.best, t:G.M.target }) } });
