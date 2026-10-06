/* 블록 채우기 */
/* ===== 블록 채우기(block) · 8×8 판에 조각을 끌어다 놓고 가로·세로 줄을 지우는 공간지각 퍼즐 =====
   오리지널 그림(캔버스로 직접 그린 광택 블록). 조각 순서는 rng로만 정한다. */
NG.block = (function(){
  const N = 8, STONE = 9, ICE2 = 10, ICE1 = 11, GEM = 12, BOMB = 13, VINE = 14;
  /* 색: [밝은, 기본, 어두운] · 1~8 = 조각 색, 9 = 돌 · 솔로 특수 칸: 10 얼음 · 11 금 간 얼음 · 12 보석 · 13 시한폭탄 · 14 덩굴 */
  const PAL = [null,
    ['#FF9B9B','#F2434E','#9C1426'], ['#FFC98A','#FF8A1A','#A84D06'], ['#FFF09A','#FFCF1F','#A07A00'], ['#A6F29A','#3ACB50','#187A2A'],
    ['#9AF4F0','#1CC6D6','#0A7282'], ['#9CCBFF','#2F7DF2','#15459E'], ['#D6ABFF','#9A4BF0','#56199E'], ['#FFAEDB','#F54BA6','#9A1766'],
    ['#C9C4DA','#8C86A6','#4A4563'],
    ['#F4FDFF','#A9E6F7','#4F9FCB'], ['#EAF6FB','#BFDDEA','#7FA6BD'], ['#FFFFFF','#E6DEF7','#9A8FC0'], ['#FFB27A','#E0602E','#7A2410'], ['#D4EC8E','#6FA033','#2F5217']];
  const SPECIAL = v => v >= ICE2;

  /* ---------- 조각 모양(가족) · d(0~1 어려움)에 따라 무게가 바뀜 ---------- */
  const FAM = [
    { id:'o1', s:['#'], w:d => Math.max(.15, 1.1 - 1.0 * d) },
    { id:'i2', s:['##'], w:d => 1.5 - .9 * d },
    { id:'i3', s:['###'], w:d => 1.5 - .5 * d },
    { id:'i4', s:['####'], w:() => 1.2 },
    { id:'i5', s:['#####'], w:d => .45 + .7 * d },
    { id:'o2', s:['##','##'], w:d => 1.4 - .3 * d },
    { id:'o3', s:['###','###','###'], w:d => .3 + .6 * d },
    { id:'r23', s:['###','###'], w:d => .35 + .6 * d },
    { id:'v3', s:['#.','##'], w:d => 1.4 - .4 * d },
    { id:'l4', s:['#.','#.','##'], m:1, w:() => 1.5 },
    { id:'t4', s:['###','.#.'], w:d => .8 + .6 * d },
    { id:'s4', s:['.##','##.'], m:1, w:d => .35 + 1.1 * d },
    { id:'v5', s:['#..','#..','###'], w:d => .55 + .8 * d }
  ];
  const norm = cs => { const mx = Math.min(...cs.map(c => c[0])), my = Math.min(...cs.map(c => c[1])); const o = cs.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); return o; };
  const key = cs => cs.map(c => c.join(',')).join(';');
  FAM.forEach(f => {
    let base = []; f.s.forEach((row, y) => [...row].forEach((ch, x) => { if(ch === '#') base.push([x, y]); }));
    const seen = {}, out = [];
    const add = cs => { cs = norm(cs); const k = key(cs); if(!seen[k]){ seen[k] = 1; out.push(cs); } };
    for(const src of f.m ? [base, base.map(([x, y]) => [-x, y])] : [base]){ let c = src; for(let r = 0; r < 4; r++){ add(c); c = c.map(([x, y]) => [-y, x]); } }
    f.or = out;
  });
  const mkPiece = (fi, oi, col) => { const cells = FAM[fi].or[oi]; return { fi, oi, fam:FAM[fi].id, cells, w:Math.max(...cells.map(c => c[0])) + 1, h:Math.max(...cells.map(c => c[1])) + 1, col, n:cells.length }; };

  const BIG = [mkPiece(6, 0, 1), mkPiece(4, 0, 1), mkPiece(4, 1, 1)];
  const BIGF = { o3:2.2, r23:1.8, i5:1.8, v5:1.6, i4:1.3, o1:.5, i2:.6 };   /* 변주 '큰 조각 가방' 무게 배율 */
  /* ---------- 판 논리(순수 함수: 테스트·자동 풀이에도 사용) ---------- */
  const E = {
    canPlace(g, p, x, y){
      if(x < 0 || y < 0 || x + p.w > N || y + p.h > N) return false;
      for(const [cx, cy] of p.cells) if(g[(y + cy) * N + x + cx]) return false;
      return true;
    },
    fits(g, p){ for(let y = 0; y <= N - p.h; y++) for(let x = 0; x <= N - p.w; x++) if(E.canPlace(g, p, x, y)) return true; return false; },
    /* 놓고 꽉 찬 줄을 지운다. g를 직접 바꾼다 */
    place(g, p, x, y){
      for(const [cx, cy] of p.cells) g[(y + cy) * N + x + cx] = p.col;
      const rows = [], cols = [];
      for(let r = 0; r < N; r++){ let f = true; for(let c = 0; c < N; c++) if(!g[r * N + c]){ f = false; break; } if(f) rows.push(r); }
      for(let c = 0; c < N; c++){ let f = true; for(let r = 0; r < N; r++) if(!g[r * N + c]){ f = false; break; } if(f) cols.push(c); }
      const cl = new Map();
      rows.forEach(r => { for(let c = 0; c < N; c++) cl.set(r * N + c, g[r * N + c]); });
      cols.forEach(c => { for(let r = 0; r < N; r++) cl.set(r * N + c, g[r * N + c]); });
      /* 솔로 특수 칸: 얼음은 한 번 지우면 금만 가고(칸은 그대로), 두 번째에 깨짐. 보석·폭탄·덩굴은 지워지며 개수를 셈 */
      const cleared = [], cracked = []; let gems = 0, bombs = 0, ice = 0, vines = 0;
      cl.forEach((v, i) => {
        if(v === ICE2){ g[i] = ICE1; cracked.push(i); return; }
        g[i] = 0; cleared.push([i, v]);
        if(v === GEM) gems++; else if(v === BOMB) bombs++; else if(v === ICE1) ice++; else if(v === VINE) vines++;
      });
      return { rows, cols, lines:rows.length + cols.length, cleared, cracked, gems, bombs, ice, vines };
    },
    holes(g){ let h = 0; for(let i = 0; i < 64; i++){ if(g[i]) continue; const x = i % N, y = (i / N) | 0;
      if((x === 0 || g[i - 1]) && (x === N - 1 || g[i + 1]) && (y === 0 || g[i - N]) && (y === N - 1 || g[i + N])) h++; } return h; },
    draw(rng, d, big){
      let tot = 0; const ws = FAM.map(f => { const w = Math.max(.05, f.w(d)) * (big && BIGF[f.id] || 1); tot += w; return w; });
      let r = rng() * tot, fi = 0; while(fi < ws.length - 1 && r >= ws[fi]){ r -= ws[fi]; fi++; }
      const oi = Math.floor(rng() * FAM[fi].or.length), col = 1 + Math.floor(rng() * 8);
      return mkPiece(fi, oi, col);
    },
    /* 새 조각 3개. 판에 하나도 안 맞으면(쉬움은 2개 미만) 같은 rng로 다시 뽑기(최대 20번) */
    tray(rng, g, cfg){
      let best = null, bf = -1;
      const m = cfg.duo ? 2 : 3, d = cfg.big ? Math.min(1.4, cfg.d + .25) : cfg.d, need = Math.min(m, cfg.need || 1);
      for(let t = 0; t < 20; t++){
        const set = []; for(let k = 0; k < m; k++) set.push(E.draw(rng, d, cfg.big));
        for(let k = 1; k < m; k++) while(set.slice(0, k).some(q => q.col === set[k].col)) set[k].col = set[k].col % 8 + 1;
        const f = set.filter(p => E.fits(g, p)).length;
        if(f >= need){ best = set; break; }
        if(f > bf){ bf = f; best = set; }
      }
      while(best.length < 3) best.push(null);   /* 두 개씩: 세 번째 자리는 비워 둠 */
      return best;
    },
    /* 보스 스테이지 돌 배치(점대칭, 한 줄에 돌 5개 이하) */
    stones(rng, g, k, v = STONE, pad = 0){
      let tries = 0;
      while(k > 0 && tries++ < 400){
        const x = pad + Math.floor(rng() * (N - 2 * pad)), y = pad + Math.floor(rng() * (N - 2 * pad)), i = y * N + x, j = (N - 1 - y) * N + (N - 1 - x);
        if(g[i] || g[j]) continue;
        g[i] = v; g[j] = v;
        let bad = false; for(let a = 0; a < N && !bad; a++){ let r = 0, c = 0; for(let b = 0; b < N; b++){ if(g[a * N + b]) r++; if(g[b * N + a]) c++; } if(r > 5 || c > 5) bad = true; }
        if(bad){ g[i] = 0; g[j] = 0; continue; }
        k -= i === j ? 1 : 2;
      }
    },
    /* 얼음 배치: 안쪽 6×6에 두 칸짜리 얼음(가로·세로)을 점대칭으로. 한 줄 지우기로 두 칸이 같이 금 가도록 */
    icePlace(rng, g, k){
      let tries = 0;
      const okLines = () => { for(let a = 0; a < N; a++){ let r = 0, c = 0; for(let b = 0; b < N; b++){ if(g[a * N + b]) r++; if(g[b * N + a]) c++; } if(r > 5 || c > 5) return false; } return true; };
      while(k > 0 && tries++ < 400){
        const h = rng() < .5, x = 1 + Math.floor(rng() * (h ? 5 : 6)), y = 1 + Math.floor(rng() * (h ? 6 : 5));
        const a = y * N + x, b = h ? a + 1 : a + N, m = i => (N - 1 - ((i / N) | 0)) * N + (N - 1 - i % N);
        const cells = k >= 4 ? [a, b, m(a), m(b)] : [a, b];
        if(new Set(cells).size !== cells.length || cells.some(i => g[i])) continue;
        cells.forEach(i => { g[i] = ICE2; });
        if(!okLines()){ cells.forEach(i => { g[i] = 0; }); continue; }
        k -= cells.length;
      }
    },
    /* 판 좋은 정도: 구멍·들쭉날쭉함은 벌점, 큰 조각(3×3·5칸 막대) 들어갈 자리가 있으면 가산 */
    quality(g){
      let tr = 0, empty = 0;
      for(let a = 0; a < N; a++){ let pr = 1, pc = 1; for(let b = 0; b < N; b++){ const r = g[a * N + b] ? 1 : 0, c = g[b * N + a] ? 1 : 0; if(r !== pr) tr++; if(c !== pc) tr++; pr = r; pc = c; if(!r) empty++; } if(!pr) tr++; if(!pc) tr++; }
      return -E.holes(g) * 14 - tr * 1.6 + empty * .6 + (E.fits(g, BIG[0]) ? 14 : 0) + (E.fits(g, BIG[1]) ? 7 : 0) + (E.fits(g, BIG[2]) ? 7 : 0);
    },
    /* 자동 풀이: 지금 조각 + 다음 조각 하나까지 내다보고 고름 */
    best(g, tray, depth = 2){
      let bm = null;
      tray.forEach((p, pi) => { if(!p) return;
        for(let y = 0; y <= N - p.h; y++) for(let x = 0; x <= N - p.w; x++){
          if(!E.canPlace(g, p, x, y)) continue;
          const g2 = g.slice(), r = E.place(g2, p, x, y);
          let sc = r.lines * 60 + (r.lines >= 2 ? 30 : 0);
          const rest = tray.map((q, qi) => qi === pi ? null : q);
          if(depth > 1 && rest.some(q => q)){ const b2 = E.best(g2, rest, depth - 1); sc += b2 ? b2.sc : -500; }
          else sc += E.quality(g2) - rest.filter(q => q && !E.fits(g2, q)).length * 80;
          if(!bm || sc > bm.sc) bm = { pi, x, y, sc };
        }
      });
      return bm;
    },
    /* ---------- 솔로 규칙(난이도 v2): 보석 · 얼음 · 시한폭탄 · 덩굴 + 변주. 게임 화면과 자동 플레이어가 같이 쓰는 순수 논리 ---------- */
    lineCnt(g, i){ const x = i % N, y = (i / N) | 0; let r = 0, c = 0; for(let b = 0; b < N; b++){ if(g[y * N + b]) r++; if(g[b * N + x]) c++; } return [r, c]; },
    /* 빈 칸 하나 고르기: 채워도 줄이 바로 차지 않는 곳(가로·세로 6칸 이하). 후보 목록이 있으면 그 안에서 */
    spot(rng, g, list){
      const ok = []; (list || Array.from({ length:64 }, (_, i) => i)).forEach(i => { if(g[i]) return; const [r, c] = E.lineCnt(g, i); if(r <= 6 && c <= 6) ok.push(i); });
      return ok.length ? ok[Math.floor(rng() * ok.length)] : -1;
    },
    count(g, v){ let k = 0; for(let i = 0; i < 64; i++) if(g[i] === v) k++; return k; },
    /* 새 판 상태(게임·자동 플레이어 공용) */
    setup(cfg, rng){
      const g = new Int8Array(64), bt = new Int8Array(64);
      if(cfg.stones) E.stones(rng, g, cfg.stones);
      if(cfg.ice) E.icePlace(rng, g, cfg.ice);
      const st = { cfg, rng, g, bt, lines:0, gems:0, used:0, setLines:0, boom:-1, iceTot:E.count(g, ICE2), tray:[] };
      if(cfg.vine) for(let k = 0; k < cfg.vine.seeds; k++){ const i = E.spot(rng, g); if(i >= 0) g[i] = VINE; }
      if(cfg.gem) E.topGems(st);
      if(cfg.bomb) E.topBombs(st, true);
      st.tray = E.tray(rng, g, cfg);
      return st;
    },
    topGems(st){ const { cfg, g } = st, out = [];
      let on = E.count(g, GEM);
      while(on < cfg.gemOn && st.gems + on < cfg.gem){ const i = E.spot(st.rng, g); if(i < 0) break; g[i] = GEM; on++; out.push(i); }
      return out; },
    topBombs(st, first){ const { cfg, g, bt } = st, out = [];
      let on = E.count(g, BOMB);
      while(on < cfg.bomb.n){ const i = E.spot(st.rng, g); if(i < 0) break; g[i] = BOMB; bt[i] = cfg.bomb.t + (first ? on * 3 : 0); on++; out.push(i); }
      return out; },
    /* 덩굴: 한 세트(조각 3개)를 쓰는 동안 줄을 하나도 못 지우면 옆 칸으로 자라남 */
    grow(st){ const { g } = st, out = [];
      for(let k = 0; k < st.cfg.vine.grow; k++){
        const nb = new Set();
        for(let i = 0; i < 64; i++) if(g[i] === VINE){ const x = i % N, y = (i / N) | 0; if(x > 0) nb.add(i - 1); if(x < N - 1) nb.add(i + 1); if(y > 0) nb.add(i - N); if(y < N - 1) nb.add(i + N); }
        if(!nb.size) break;
        const i = E.spot(st.rng, g, [...nb]); if(i < 0) break; g[i] = VINE; out.push(i);
      }
      return out; },
    goalDone(st){ const c = st.cfg; return (!c.target || st.lines >= c.target) && (!c.ice || E.iceLeft(st.g) === 0) && (!c.gem || st.gems >= c.gem); },
    iceLeft(g){ let k = 0; for(let i = 0; i < 64; i++) if(g[i] === ICE2 || g[i] === ICE1) k++; return k; },
    /* 조각 하나 놓기: 줄 지우기 → 목표 확인 → 폭탄 숫자 줄이기 → 세트를 다 쓰면 덩굴·보석·폭탄 → 새 조각 */
    step(st, pi, gx, gy){
      const p = st.tray[pi], g = st.g, ev = { p, placed:p.cells.map(([cx, cy]) => (gy + cy) * N + gx + cx), refill:false, grown:[], spawned:[], state:'' };
      const r = E.place(g, p, gx, gy); ev.r = r;
      st.tray[pi] = null; st.used++; st.lines += r.lines; st.gems += r.gems; st.setLines += r.lines;
      if(st.cfg.bomb) for(let i = 0; i < 64; i++){ if(g[i] !== BOMB){ st.bt[i] = 0; continue; } }
      if(E.goalDone(st)){ ev.state = 'win'; return ev; }
      if(st.cfg.bomb){ for(let i = 0; i < 64; i++) if(g[i] === BOMB){ st.bt[i]--; if(st.bt[i] <= 0 && st.boom < 0) st.boom = i; } if(st.boom >= 0){ ev.state = 'lose'; ev.boom = st.boom; return ev; } }
      if(st.tray.every(q => !q)){
        ev.refill = true;
        if(st.cfg.vine && !st.setLines) ev.grown = E.grow(st);
        st.setLines = 0;
        if(st.cfg.gem) ev.spawned.push(...E.topGems(st));
        if(st.cfg.bomb) ev.spawned.push(...E.topBombs(st));
        st.tray = E.tray(st.rng, g, st.cfg);
      }
      if(!st.tray.some(q => q && E.fits(g, q))) ev.state = 'lose';
      return ev;
    },
    /* 자동 플레이어(사람 흉내): 한 수 평가 + 흔들림(좋은 수 1~3위를 60/25/15%). 튜닝 도구·테스트용 */
    botEval(st, g2, r, rest){
      const W = E.BW;
      let sc = r.lines * 60 + (r.lines >= 2 ? 30 : 0) + r.gems * W.gem + r.cracked.length * W.crack + r.ice * W.ice + r.bombs * W.bomb + r.vines * 12;
      sc += E.quality(g2) - rest.filter(q => q && !E.fits(g2, q)).length * 80;
      /* 목표·위험 칸이 있는 줄을 채우는 쪽을 선호, 폭탄은 숫자가 작을수록 급함 */
      for(let i = 0; i < 64; i++){ const v = g2[i]; if(v < ICE2) continue;
        const [a, b] = E.lineCnt(g2, i), f = Math.max(a, b);
        if(v === BOMB){ const t = st.bt[i] - 1; if(t <= 0) sc -= 2000; else sc -= (8 - f) * W.urg / t; }
        else if(v === GEM || v === ICE2 || v === ICE1) sc += f * f * W.tgt;
        else if(v === VINE) sc += f * .8; }
      return sc;
    },
    BW:{ gem:70, crack:45, ice:70, bomb:40, tgt:.3, urg:30, k:8 },
    /* 한 수 후보 전부 → 위 K개만 다음 조각 한 수까지 내다봄(남은 조각 중 가장 좋은 이어두기) */
    botCands(st, g, tray){
      const cand = [];
      tray.forEach((p, pi) => { if(!p) return;
        for(let y = 0; y <= N - p.h; y++) for(let x = 0; x <= N - p.w; x++){
          if(!E.canPlace(g, p, x, y)) continue;
          const g2 = g.slice(), r = E.place(g2, p, x, y), rest = tray.map((q, qi) => qi === pi ? null : q);
          cand.push({ pi, x, y, g2, r, rest, sc:E.botEval(st, g2, r, rest) });
        } });
      return cand.sort((a, b) => b.sc - a.sc);
    },
    botMove(st, nz){
      const cand = E.botCands(st, st.g, st.tray), K = E.BW.k;
      if(!cand.length) return null;
      if(K) for(const c of cand.slice(0, K)){
        if(!c.rest.some(q => q)) continue;
        const c2 = E.botCands(st, c.g2, c.rest);
        c.sc = c2.length ? c.sc * .35 + c2[0].sc + c.r.lines * 40 : c.sc - 600;
      }
      if(K) cand.splice(K);
      cand.sort((a, b) => b.sc - a.sc);
      const u = nz ? nz() : 0, j = u < .6 ? 0 : u < .85 ? 1 : 2;
      return cand[Math.min(j, cand.length - 1)];
    },
    /* 한 판 끝까지: { win, used } */
    botRun(cfg, rng, nz, cap = 400){
      const st = E.setup(cfg, rng);
      if(!st.tray.some(q => q && E.fits(st.g, q))) return { win:false, used:0 };
      while(st.used < cap){ const m = E.botMove(st, nz); if(!m) return { win:false, used:st.used, st };
        const ev = E.step(st, m.pi, m.x, m.y); if(ev.state) return { win:ev.state === 'win', used:st.used, boom:ev.state === 'lose' && st.boom >= 0, st }; }
      return { win:false, used:st.used, st };
    },
    /* 기준 조각 수: 자동 풀이(2수 앞보기) 중앙값의 약 94% (잘 둔 판 수준) */
    par(cfg){ return Math.round(.94 * (cfg.target * (2.3 - .5 * cfg.d) + 3) - .25 * (cfg.stones || 0)); },
    eff(used, par){ return Math.round(350 * Math.max(0, Math.min(1, (1.35 * par - used) / (.35 * par)))); }
  };

  const LV = {
    easy:{ limit:0, target:10, d:.2, need:2 },
    normal:{ limit:0, target:20, d:.45, need:1 },
    hard:{ limit:0, target:30, d:.65, need:1 }
  };
  /* 대전 판(세대별 테스트 2026-10-06): 12줄 먼저 · 3분. 지금 엔진은 levels.normal로 시작하므로 init에서 바꿔 끼우고, 대전 v3 엔진은 duelCfg()를 읽는다 */
  const DUEL = { limit:180, target:12, d:.45, need:1, duel:true };

  /* ---------- 그림: 광택 블록 스프라이트 ---------- */
  const SPR = new Map();
  function rr(x, px, py, w, h, r){ x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  function sprite(ci, px){
    px = Math.max(4, Math.round(px)); const k = ci + ':' + px; if(SPR.has(k)) return SPR.get(k);
    const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'); const [L, B, D] = PAL[ci];
    const m = px * .035, r = px * .17;
    rr(x, m, m, px - 2 * m, px - 2 * m, r); x.fillStyle = '#1A0F45'; x.fill();
    const i = m + Math.max(1.2, px * .055), s = px - 2 * i, b = px * .14;
    x.save(); rr(x, i, i, s, s, r * .72); x.clip();
    const gr = x.createLinearGradient(0, i, 0, i + s); gr.addColorStop(0, L); gr.addColorStop(.5, B); gr.addColorStop(1, D); x.fillStyle = gr; x.fillRect(i, i, s, s);
    const tz = (pts, col) => { x.beginPath(); pts.forEach(([a, bb], n) => n ? x.lineTo(a, bb) : x.moveTo(a, bb)); x.closePath(); x.fillStyle = col; x.fill(); };
    tz([[i, i], [i + s, i], [i + s - b, i + b], [i + b, i + b]], 'rgba(255,255,255,.5)');
    tz([[i, i], [i + b, i + b], [i + b, i + s - b], [i, i + s]], 'rgba(255,255,255,.22)');
    tz([[i + s, i], [i + s, i + s], [i + s - b, i + s - b], [i + s - b, i + b]], 'rgba(0,0,0,.16)');
    tz([[i, i + s], [i + b, i + s - b], [i + s - b, i + s - b], [i + s, i + s]], 'rgba(0,0,0,.3)');
    const f0 = i + b, fs = s - 2 * b, fg = x.createLinearGradient(0, f0, 0, f0 + fs); fg.addColorStop(0, L); fg.addColorStop(1, B);
    x.globalAlpha = .55; x.fillStyle = fg; x.fillRect(f0, f0, fs, fs); x.globalAlpha = 1;
    if(ci === STONE){
      x.strokeStyle = 'rgba(40,30,70,.55)'; x.lineWidth = Math.max(1, px * .045); x.lineCap = 'round';
      x.beginPath(); x.moveTo(f0 + fs * .2, f0 + fs * .15); x.lineTo(f0 + fs * .45, f0 + fs * .5); x.lineTo(f0 + fs * .35, f0 + fs * .85); x.moveTo(f0 + fs * .45, f0 + fs * .5); x.lineTo(f0 + fs * .85, f0 + fs * .62); x.stroke();
    } else if(ci === ICE2 || ci === ICE1){
      /* 얼음: 서리 낀 유리 + 굵은 빛줄기. 금 간 얼음은 흐려지고 굵은 금 */
      x.fillStyle = 'rgba(255,255,255,.55)';
      x.beginPath(); x.moveTo(f0 + fs * .1, f0 + fs * .62); x.lineTo(f0 + fs * .62, f0 + fs * .1); x.lineTo(f0 + fs * .8, f0 + fs * .1); x.lineTo(f0 + fs * .1, f0 + fs * .8); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(f0 + fs * .5, f0 + fs * .92); x.lineTo(f0 + fs * .92, f0 + fs * .5); x.lineTo(f0 + fs * .92, f0 + fs * .6); x.lineTo(f0 + fs * .6, f0 + fs * .92); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.9)'; [[.25, .3], [.7, .72], [.78, .28]].forEach(([a, b]) => { x.beginPath(); x.arc(f0 + fs * a, f0 + fs * b, fs * .045, 0, Math.PI * 2); x.fill(); });
      if(ci === ICE1){
        x.strokeStyle = '#2C5E86'; x.lineWidth = Math.max(1.2, px * .06); x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath(); x.moveTo(f0 + fs * .05, f0 + fs * .35); x.lineTo(f0 + fs * .38, f0 + fs * .45); x.lineTo(f0 + fs * .5, f0 + fs * .2); x.lineTo(f0 + fs * .72, f0 + fs * .55); x.lineTo(f0 + fs * .98, f0 + fs * .5);
        x.moveTo(f0 + fs * .38, f0 + fs * .45); x.lineTo(f0 + fs * .3, f0 + fs * .95); x.moveTo(f0 + fs * .72, f0 + fs * .55); x.lineTo(f0 + fs * .8, f0 + fs * .95); x.stroke();
      }
    } else if(ci === GEM){
      /* 보석: 밝은 받침 위 다이아몬드 */
      const cx = f0 + fs / 2, t = f0 + fs * .14, m = f0 + fs * .42, bt2 = f0 + fs * .9, w = fs * .44, w2 = fs * .24;
      const dg = x.createLinearGradient(0, t, 0, bt2); dg.addColorStop(0, '#FF9BE0'); dg.addColorStop(.5, '#E23DB0'); dg.addColorStop(1, '#6A1FC9');
      x.beginPath(); x.moveTo(cx - w2, t); x.lineTo(cx + w2, t); x.lineTo(cx + w, m); x.lineTo(cx, bt2); x.lineTo(cx - w, m); x.closePath();
      x.fillStyle = dg; x.fill(); x.strokeStyle = '#3B0E6E'; x.lineWidth = Math.max(1, px * .045); x.lineJoin = 'round'; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.moveTo(cx - w2, t); x.lineTo(cx, t); x.lineTo(cx - w * .35, m); x.lineTo(cx - w, m); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(59,14,110,.45)'; x.lineWidth = Math.max(.8, px * .025); x.beginPath(); x.moveTo(cx - w, m); x.lineTo(cx + w, m); x.moveTo(cx, bt2); x.lineTo(cx - w * .35, m); x.moveTo(cx, bt2); x.lineTo(cx + w * .35, m); x.stroke();
    } else if(ci === BOMB){
      /* 시한폭탄: 둥근 폭탄(숫자는 그릴 때 따로) */
      const cx = f0 + fs * .5, cy = f0 + fs * .56, rr2 = fs * .44;
      x.strokeStyle = '#C9B8A0'; x.lineWidth = Math.max(1.4, px * .06); x.lineCap = 'round'; x.beginPath(); x.moveTo(cx + rr2 * .45, cy - rr2 * .85); x.quadraticCurveTo(cx + rr2 * .8, cy - rr2 * 1.3, cx + rr2 * 1.05, cy - rr2 * 1.15); x.stroke();
      x.fillStyle = '#FFD84A'; x.beginPath(); x.arc(cx + rr2 * 1.05, cy - rr2 * 1.15, fs * .07, 0, Math.PI * 2); x.fill();
      const bg2 = x.createRadialGradient(cx - rr2 * .35, cy - rr2 * .35, rr2 * .1, cx, cy, rr2); bg2.addColorStop(0, '#5A5270'); bg2.addColorStop(1, '#0E0A1C');
      x.beginPath(); x.arc(cx, cy, rr2, 0, Math.PI * 2); x.fillStyle = bg2; x.fill(); x.strokeStyle = '#FF8A3A'; x.lineWidth = Math.max(1.4, px * .055); x.stroke();
    } else if(ci === VINE){
      /* 덩굴: 잎 두 장 + 줄기 */
      x.strokeStyle = '#2B4A14'; x.lineWidth = Math.max(1.6, px * .08); x.lineCap = 'round';
      x.beginPath(); x.moveTo(f0 + fs * .05, f0 + fs * .95); x.bezierCurveTo(f0 + fs * .5, f0 + fs * .75, f0 + fs * .35, f0 + fs * .3, f0 + fs * .95, f0 + fs * .05); x.stroke();
      /* 잎: 끝이 뾰족한 잎 모양 */
      const leaf = (a, b, rot, sz) => { x.save(); x.translate(f0 + fs * a, f0 + fs * b); x.rotate(rot); const L = fs * sz;
        x.beginPath(); x.moveTo(-L, 0); x.quadraticCurveTo(0, -L * .75, L, 0); x.quadraticCurveTo(0, L * .75, -L, 0); x.closePath();
        x.fillStyle = '#DDFB8C'; x.fill(); x.strokeStyle = '#2B4A14'; x.lineWidth = Math.max(1, px * .04); x.stroke();
        x.beginPath(); x.moveTo(-L * .85, 0); x.lineTo(L * .7, 0); x.lineWidth = Math.max(.8, px * .03); x.stroke(); x.restore(); };
      leaf(.3, .3, -.5, .27); leaf(.7, .66, -.5, .27);
    } else {
      x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(f0 + fs * .32, f0 + fs * .26, fs * .24, fs * .1, -.45, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.arc(f0 + fs * .72, f0 + fs * .2, fs * .06, 0, Math.PI * 2); x.fill();
    }
    x.restore();
    SPR.set(k, c); return c;
  }
  /* 폭탄 숫자: 3 이하면 빨갛게 두근두근 */
  function bombNum(x, i, px, ts, sc){
    const s = S(), t = Math.max(0, s.bt[i]), cx = ((i % N) + .5) * px, cy = (((i / N) | 0) + .58) * px, hot = t <= 3;
    const k = hot && !FXR.reduce ? 1 + .14 * Math.sin(ts / 110) : 1, z = (sc || 1) * k;
    if(hot){ x.globalAlpha = .45 + .25 * Math.sin(ts / 110); x.fillStyle = '#FF3B2E'; x.beginPath(); x.arc(cx, cy, px * .4 * z, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; s.dirty = true; }
    const ff = s.ff || (s.ff = getComputedStyle(document.documentElement).getPropertyValue('--heavy').trim() || 'sans-serif');
    x.font = `${Math.round(px * (t >= 10 ? .34 : .42) * z)}px ${ff}`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = Math.max(2, px * .09); x.strokeStyle = '#0E0A1C'; x.strokeText(String(t), cx, cy + px * .02);
    x.fillStyle = hot ? '#FFD84A' : '#FFFFFF'; x.fillText(String(t), cx, cy + px * .02);
  }
  function drawPiece(cv, p, cell, dpr){
    const px = Math.round(cell * dpr); cv.width = p.w * px; cv.height = p.h * px;
    cv.style.width = p.w * cell + 'px'; cv.style.height = p.h * cell + 'px';
    const x = cv.getContext('2d'), sp = sprite(p.col, px);
    for(const [cx, cy] of p.cells) x.drawImage(sp, cx * px, cy * px);
  }

  /* ---------- 상태 ---------- */
  const S = () => G.bk;

  function init(cfg, rng){
    if(G.duel && !G.adv && !cfg.duel) cfg = Object.assign({}, cfg, DUEL);
    if(cfg.duel) G.limit = cfg.limit;
    const st = E.setup(cfg, rng);   /* 오늘의 문제는 특수 칸이 없어 예전과 같은 순서로 rng를 씀 */
    const par = cfg.par ? Math.max(3, Math.round(cfg.par * (cfg.flash ? .8 : 1))) : E.par(cfg);
    G.bk = Object.assign(st, { target:cfg.target, par, pts:0, combo:0, maxCombo:0, multi:0, lock:false, drag:null,
      ghost:null, anims:[], dirty:true, timers:[], cell:40, dpr:1, stonesN:cfg.stones || 0, sel:null, lastSec:-1 });
    G.cleanup = cleanup;
  }
  function later(fn, ms){ const me = G; const t = setTimeout(() => { if(G === me) fn(); }, ms); S().timers.push(t); return t; }
  function cleanup(){
    const s = G && G.bk; if(!s) return;
    s.timers.forEach(clearTimeout); s.timers = [];
    if(s.dragEl) s.dragEl.remove(); s.dragEl = null; s.drag = null;
    if(s.onResize) removeEventListener('resize', s.onResize);
    if(G.raf) cancelAnimationFrame(G.raf); G.raf = 0; s.dead = true;
    document.querySelectorAll('.ng-block.bk-drag').forEach(e => e.remove());
  }

  /* ---------- 화면 ---------- */
  function render(st){
    const s = S();
    const gl = goals(s), multi = gl.length > 1 || gl[0].k !== 'lines';
    const gHtml = multi ? gl.map(o => `<span class="bk-gi g-${o.k}" aria-label="${o.name} ${o.need}개">${GIC[o.k]}<b><i id="bkG_${o.k}">0</i><small>/${o.need}</small></b></span>`).join('')
      : `<span class="bk-gi g-lines">${GIC.lines}<b><i id="bkLines">0</i><small>/${s.target}</small></b></span>`;
    const chips = ruleChips(s.cfg);
    st.innerHTML = `<div class="ng-block">
      <div class="hud-row bk-hud">
        <div class="hchip bk-goal" aria-live="polite"><div class="bk-gt${multi ? ' gm' : ''}">${gHtml}</div>
          <div class="hbar bk-bar"><i id="bkFill"></i></div><em id="bkLbl">${multi ? '모을 목표' : '지운 줄 0/' + s.target}</em></div>
        ${G.duel && G.limit ? `<div class="hchip time" id="bkRemP"><span class="hv"><b id="bkRem">${mmss(G.limit)}</b></span><em>남은 시간</em></div>` : '<div class="hchip time"><span class="hv"><b id="sclock">00:00</b></span><em>걸린 시간</em></div>'}
        <div class="hchip bk-pts"><span class="hv"><b id="bkPts">0</b></span><em>점수</em></div>
      </div>
      ${chips ? `<div class="bk-rules" aria-label="이번 판 규칙">${chips}</div>` : ''}
      <div class="bk-board" id="bd"><canvas id="bkCv" aria-label="8×8 블록 판"></canvas><div class="bk-msg" id="bkMsg"></div></div>
      <p class="bk-tip" id="bkTip">조각을 끌거나, 누르고 판 칸을 눌러요</p>
      <div class="bk-tray" id="bkTray" aria-label="놓을 조각 3개">${[0,1,2].map(i => `<div class="bk-slot" data-i="${i}" role="button" aria-label="조각 ${i + 1}"><div class="bk-pc"><canvas></canvas></div></div>`).join('')}</div>
    </div>`;
    const root = st.querySelector('.ng-block');
    s.cv = st.querySelector('#bkCv'); s.ctx = s.cv.getContext('2d'); s.boardEl = st.querySelector('#bd'); s.trayEl = st.querySelector('#bkTray');
    s.slots = [...st.querySelectorAll('.bk-slot')];
    ['selectstart','contextmenu','dragstart'].forEach(ev => root.addEventListener(ev, e => e.preventDefault()));
    [s.trayEl, s.cv].forEach(el => el.addEventListener('touchstart', e => e.preventDefault(), { passive:false }));
    s.slots.forEach(sl => {
      sl.addEventListener('pointerdown', e => dragStart(e, +sl.dataset.i));
      sl.addEventListener('pointermove', dragMove);
      sl.addEventListener('pointerup', e => dragEnd(e, false));
      sl.addEventListener('pointercancel', e => dragEnd(e, true));
    });
    s.cv.addEventListener('pointerdown', boardTap);
    s.onResize = () => { if(G && G.bk === s) { layout(); paintTray(false); } };
    addEventListener('resize', s.onResize);
    layout(); paintTray(true); hud();
    requestAnimationFrame(() => { if(G && G.bk === s && !s.dead){ layout(); paintTray(false); } });   /* 화면이 자리 잡은 뒤 높이를 한 번 더 맞춘다 */
    if(s.cfg.boss) later(() => { if(!G.paused) toast(s.cfg.plan && s.cfg.plan.mj.length ? '보스 스테이지 · 배운 규칙이 한꺼번에 나와요' : '보스 스테이지 · 돌 블록도 줄을 채우면 함께 사라져요'); }, 500);
    const me = G;
    const loop = ts => { if(G !== me || s.dead) return; G.raf = requestAnimationFrame(loop); frame(ts); };
    G.raf = requestAnimationFrame(loop);
  }
  /* 문서 맨 위에서 요소까지 거리(등장 애니메이션의 transform에 흔들리지 않게 offsetTop으로) */
  const docTop = el => { let t = 0; for(let e = el; e; e = e.offsetParent) t += e.offsetTop; return t; };
  function layout(){
    const s = S(), root = s.boardEl.parentNode, W = root.clientWidth || 360;
    const rt = docTop(root);   /* 화면 아래까지 채우고 조각 받침은 엄지 자리(아래) */
    root.style.minHeight = Math.max(0, Math.min(innerHeight, Math.floor(innerHeight - rt - 10))) + 'px';
    const avail = Math.max(200, innerHeight - 330);            /* 짧은 화면에서는 판을 조금 줄임 */
    const S0 = Math.floor(Math.min(W - 20, avail, 460) / 8) * 8;
    s.dpr = Math.min(3, devicePixelRatio || 1); s.cell = S0 / 8; s.size = S0;
    s.cv.style.width = S0 + 'px'; s.cv.style.height = S0 + 'px'; s.cv.width = Math.round(S0 * s.dpr); s.cv.height = Math.round(S0 * s.dpr);
    s.slotW = W / 3; s.tcell = s.cell * .7;
    s.trayEl.style.height = Math.round(Math.min(s.tcell * 5, s.slotW - 12) + 40) + 'px';
    s.bg = null; s.dirty = true;
  }
  function boardBg(){
    const s = S(); if(s.bg) return s.bg;
    const px = s.cell * s.dpr, c = document.createElement('canvas'); c.width = s.cv.width; c.height = s.cv.height; const x = c.getContext('2d');
    /* 빈칸 #2B2360 + 밝은 칸 테두리 #8274DA(빈칸 대비 3.6:1, 세대별 테스트 '남색에 남색' 고침) */
    const lw = Math.max(1, 1.5 * s.dpr);
    x.fillStyle = '#1B1550'; x.fillRect(0, 0, c.width, c.height);
    for(let i = 0; i < 64; i++){ const cx = (i % N) * px, cy = ((i / N) | 0) * px, m = px * .05, r = px * .14;
      rr(x, cx + m, cy + m, px - 2 * m, px - 2 * m, r); x.fillStyle = '#2B2360'; x.fill();
      x.lineWidth = lw; x.strokeStyle = '#8274DA'; rr(x, cx + m + lw / 2, cy + m + lw / 2, px - 2 * m - lw, px - 2 * m - lw, r); x.stroke(); }
    s.bg = c; return c;
  }
  function frame(ts){
    const s = S(); if(!s || !s.ctx) return;
    if(G.duel && G.limit && !G.over && !s.lock) duelClock();
    if(G.paused && s.drag) cancelDrag();
    if(s.drag && s.drag.need){ s.drag.need = false; dragUpdate(); }
    s.anims = s.anims.filter(a => ts - a.t0 < a.dur + (a.delay || 0) + 60 || a.t0 === 0);
    if(!s.dirty && !s.anims.length) return;
    s.dirty = false; drawBoard(ts);
  }
  function drawBoard(ts){
    const s = S(), x = s.ctx, px = s.cell * s.dpr, g = s.g;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, s.cv.width, s.cv.height); x.drawImage(boardBg(), 0, 0);
    const scl = {};
    for(const a of s.anims) if(a.type === 'place'){ if(!a.t0) a.t0 = ts; const k = Math.min(1, (ts - a.t0) / a.dur); a.cells.forEach(i => { scl[i] = 1 + .13 * Math.cos(k * Math.PI * 1.5) * (1 - k); }); }
    /* 새로 생긴 보석·폭탄·덩굴: 톡 튀어나옴 */
    for(const a of s.anims) if(a.type === 'pop'){ if(!a.t0) a.t0 = ts; const k = (ts - a.t0 - a.delay) / a.dur; a.cells.forEach(i => { if(g[i]) scl[i] = k <= 0 ? .001 : k >= 1 ? 1 : Math.min(1.18, 1.18 * Math.sin(k * Math.PI * .62) / Math.sin(Math.PI * .62)); }); }
    /* 줄 미리보기: 놓으면 지워질 줄은 조각 색으로 빛남(특수 칸은 모양 그대로 두고 빛만) */
    const hl = s.ghost && s.ghost.hl ? s.ghost.hl : null;
    for(let i = 0; i < 64; i++){
      if(!g[i]) continue; const cx = (i % N) * px, cy = ((i / N) | 0) * px;
      const ci = hl && hl.has(i) && !SPECIAL(g[i]) ? s.ghost.p.col : g[i], sp = sprite(ci, px), sc = scl[i] || 1;
      if(sc !== 1){ const d = px * (sc - 1) / 2; x.drawImage(sp, cx - d, cy - d, px * sc, px * sc); } else x.drawImage(sp, cx, cy);
      if(g[i] === BOMB) bombNum(x, i, px, ts, sc);
    }
    for(const a of s.anims) if(a.type === 'crack'){ if(!a.t0) a.t0 = ts; const k = (ts - a.t0) / a.dur; if(k < 1){ x.globalAlpha = .8 * (1 - k); x.fillStyle = '#FFFFFF'; a.cells.forEach(i => { rr(x, (i % N) * px, ((i / N) | 0) * px, px, px, px * .16); x.fill(); }); x.globalAlpha = 1; } }
    for(const a of s.anims) if(a.type === 'boom'){ if(!a.t0) a.t0 = ts; const k = Math.min(1, (ts - a.t0) / a.dur), i = a.i, cx = ((i % N) + .5) * px, cy = (((i / N) | 0) + .5) * px;
      x.globalAlpha = .75 * (1 - k); const gr = x.createRadialGradient(cx, cy, 0, cx, cy, px * (1 + 2.5 * k)); gr.addColorStop(0, '#FFF3B0'); gr.addColorStop(.4, '#FF7A2E'); gr.addColorStop(1, 'rgba(255,60,30,0)'); x.fillStyle = gr; x.fillRect(0, 0, s.cv.width, s.cv.height); x.globalAlpha = 1; }
    if(s.ghost){
      const { p, gx, gy } = s.ghost, sp = sprite(p.col, px), pulse = .6 + .08 * Math.sin(ts / 110);   /* 놓일 자리 60% 진하게 */
      x.globalAlpha = pulse; p.cells.forEach(([cx, cy]) => x.drawImage(sp, (gx + cx) * px, (gy + cy) * px)); x.globalAlpha = 1;
      x.strokeStyle = '#8CFFC1'; x.lineWidth = Math.max(2, px * .06); x.shadowColor = '#3DFF9A'; x.shadowBlur = px * .25;
      p.cells.forEach(([cx, cy]) => { const m = px * .07; rr(x, (gx + cx) * px + m, (gy + cy) * px + m, px - 2 * m, px - 2 * m, px * .16); x.stroke(); });
      x.shadowBlur = 0;
      if(hl){ x.globalAlpha = .22 + .12 * Math.sin(ts / 90); x.fillStyle = '#FFFFFF'; hl.forEach(i => x.fillRect((i % N) * px, ((i / N) | 0) * px, px, px)); x.globalAlpha = 1; }
      s.dirty = true;
    }
    /* 줄 지우기: 번쩍이는 빛줄기가 줄을 쓸고, 블록은 작아지며 사라짐 */
    for(const a of s.anims) if(a.type === 'clear'){
      if(!a.t0) a.t0 = ts; const t = ts - a.t0;
      /* 지워지는 줄 전체가 먼저 환하게 빛남 */
      if(t < 380) a.lines.forEach(([isRow, idx]) => { x.save(); x.globalAlpha = .7 * (1 - t / 380); x.shadowColor = '#FFE27A'; x.shadowBlur = px * .6; x.fillStyle = '#FFF3B0';
        if(isRow) x.fillRect(0, idx * px + px * .04, N * px, px * .92); else x.fillRect(idx * px + px * .04, 0, px * .92, N * px); x.restore(); });
      /* 블록이 빙글 돌며 위·바깥으로 날아감(움직임 줄이기 설정이면 제자리에서 작아짐) */
      const fly = !FXR.reduce, fc = a.fc || [N / 2, N / 2];
      a.cells.forEach(([i, ci, dl]) => { const k = (t - dl) / 320; if(k >= 1) return; const gx = i % N, gy = (i / N) | 0;
        const kk = Math.max(0, k), sc = fly ? 1 - .5 * kk : 1 - kk * kk, sp = sprite(ci, px), side = gx + .5 - fc[0] >= 0 ? 1 : -1;
        const ox = fly ? (gx + .5 - fc[0] + side * .6) * .45 * kk * px : 0, oy = fly ? -kk * kk * px * 1.3 : 0, rot = fly ? side * kk * .9 : 0;
        x.save(); x.translate(gx * px + px / 2 + ox, gy * px + px / 2 + oy); x.rotate(rot); x.globalAlpha = Math.max(0, 1 - kk * kk);
        if(sc > .02) x.drawImage(sp, -px * sc / 2, -px * sc / 2, px * sc, px * sc);
        if(k > -0.15){ x.globalAlpha = Math.max(0, .85 * (1 - Math.abs(kk - .15) * 2.2)); x.fillStyle = '#FFFFFF'; rr(x, -px * sc / 2, -px * sc / 2, px * sc, px * sc, px * .16); x.fill(); }
        x.restore(); });
      a.lines.forEach(([isRow, idx]) => { const k = t / 380; if(k >= 1) return; const pos = k * (N + 2) - 1;
        x.save(); const w = px * 1.6; let gr;
        if(isRow){ const cx = pos * px, cy = idx * px; gr = x.createLinearGradient(cx - w, 0, cx + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(cx - w, cy - px * .08, w * 2, px * 1.16); }
        else { const cy = pos * px, cx = idx * px; gr = x.createLinearGradient(0, cy - w, 0, cy + w); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(cx - px * .08, cy - w, px * 1.16, w * 2); }
        x.restore(); });
    }
    if(s.anims.length) s.dirty = true;
  }

  /* ---------- 조각 받침(트레이) ---------- */
  function paintTray(slide){
    const s = S();
    s.slots.forEach((sl, i) => {
      const p = s.tray[i], pc = sl.querySelector('.bk-pc'), cv = pc.querySelector('canvas');
      sl.classList.toggle('empty', !p);
      if(p){ drawPiece(cv, p, tc(p), s.dpr); sl.setAttribute('aria-label', '조각 ' + (i + 1) + ' · ' + p.n + '칸'); }
      else { cv.width = cv.height = 1; cv.style.width = cv.style.height = '0px'; }
      pc.style.visibility = s.drag && s.drag.i === i ? 'hidden' : '';
      if(slide && p && !FXR.reduce){ pc.classList.remove('in'); void pc.offsetWidth; pc.style.animationDelay = (i * 70) + 'ms'; pc.classList.add('in'); }
    });
    markFit();
  }
  const tc = p => { const s = S(); return Math.min(s.tcell, (s.slotW - 14) / p.w, (s.slotW - 12) / p.h); };
  function markFit(){ const s = S(); s.slots.forEach((sl, i) => { const p = s.tray[i]; sl.classList.toggle('nofit', !!p && !E.fits(s.g, p)); }); }
  /* 목표 목록: 줄(기본) · 얼음 · 보석 */
  function goals(s){
    const c = s.cfg, o = [];
    if(c.target) o.push({ k:'lines', name:'줄', have:Math.min(s.lines, c.target), need:c.target });
    if(c.ice) o.push({ k:'ice', name:'얼음', have:s.iceTot - E.iceLeft(s.g), need:s.iceTot });
    if(c.gem) o.push({ k:'gem', name:'보석', have:Math.min(s.gems, c.gem), need:c.gem });
    if(!o.length) o.push({ k:'lines', name:'줄', have:s.lines, need:Math.max(1, c.target) });
    return o;
  }
  const GIC = {
    lines:'<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="1.5" y="7" width="17" height="6" rx="2" fill="#EF4B3F" stroke="#1A0F45" stroke-width="1.6"/><path d="M4 9.2h12" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/></svg>',
    ice:'<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="4" fill="#A9E6F7" stroke="#1A0F45" stroke-width="1.6"/><path d="M5 12 12 5h2.5L5 14.5z" fill="#fff" opacity=".8"/><path d="M4 9l4 1 1.5-3 3 4.5L16 11" fill="none" stroke="#2C5E86" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gem:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3h8l4 5-8 10L2 8z" fill="#E23DB0" stroke="#3B0E6E" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 3h4L7 8H2z" fill="#fff" opacity=".6"/></svg>'
  };
  function ruleChips(c){
    const p = c.plan; if(!p) return '';
    const nm = k => (conceptInfo('block', k) || {}).name || k, out = [];
    p.mj.forEach(k => out.push(`<span class="bk-chip mj">${nm(k)}</span>`));
    if(p.tw) out.push(`<span class="bk-chip tw">${nm(p.tw)}</span>`);
    if(c.stones && p.tw !== 'rock') out.push('<span class="bk-chip tw">돌 블록</span>');
    return out.join('');
  }
  function hud(){
    const s = S(), set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
    const gl = goals(s);
    set('bkLines', Math.min(s.lines, s.target)); set('bkPts', fmt(s.pts));
    if(gl.length === 1 && gl[0].k === 'lines') set('bkLbl', '지운 줄 ' + Math.min(s.lines, s.target) + '/' + s.target);
    gl.forEach(o => set('bkG_' + o.k, o.have));
    const f = document.getElementById('bkFill'); if(f) f.style.width = Math.min(100, progressOf(s) * 100) + '%';
  }
  function progressOf(s){ const gl = goals(s); return gl.reduce((a, o) => a + Math.min(1, o.have / o.need), 0) / gl.length; }

  /* ---------- 끌어 놓기 ---------- */
  const LIFT = 60;   /* 손가락 위로 띄우는 거리(px): 조각 아래 끝이 손끝보다 이만큼 위(손가락에 가려지지 않게) */
  function dragStart(e, i){
    const s = S(); if(!s || G.over || G.paused || s.lock || s.drag || !s.tray[i]) return;
    e.preventDefault(); try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
    const p = s.tray[i], el = document.createElement('div'); el.className = 'ng-block bk-drag';
    const cv = document.createElement('canvas'); el.appendChild(cv); drawPiece(cv, p, s.cell, s.dpr);
    const src = s.slots[i].querySelector('canvas').getBoundingClientRect();
    el.style.setProperty('--s0', (tc(p) / s.cell).toFixed(3));
    el.style.setProperty('--ox', ((src.left + src.width / 2) - e.clientX).toFixed(1) + 'px');
    el.style.setProperty('--oy', ((src.top + src.height / 2) - (e.clientY - LIFT - p.h * s.cell / 2)).toFixed(1) + 'px');
    document.body.appendChild(el);
    s.dragEl = el; s.drag = { i, p, x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, id:e.pointerId, need:true };
    s.slots[i].querySelector('.bk-pc').style.visibility = 'hidden';
    dragUpdate(); sfx('blockPick'); fxBuzz(8);
  }
  function dragMove(e){ const s = S(); if(!s || !s.drag || e.pointerId !== s.drag.id) return; s.drag.x = e.clientX; s.drag.y = e.clientY; s.drag.need = true; }
  function dragUpdate(){
    const s = S(), d = s.drag; if(!d) return;
    const p = d.p, w = p.w * s.cell, h = p.h * s.cell, left = d.x - w / 2, top = d.y - LIFT - h;
    s.dragEl.style.transform = `translate3d(${left}px,${top}px,0)`;
    const r = s.cv.getBoundingClientRect(), fx = (left - r.left) / s.cell, fy = (top - r.top) / s.cell;
    let best = null;
    for(const gx of new Set([Math.floor(fx), Math.ceil(fx)])) for(const gy of new Set([Math.floor(fy), Math.ceil(fy)])){
      const dd = Math.hypot(gx - fx, gy - fy); if(dd > .8 || !E.canPlace(s.g, p, gx, gy)) continue;
      if(!best || dd < best.dd) best = { gx, gy, dd };
    }
    const old = s.ghost;
    if(best){
      if(!old || old.gx !== best.gx || old.gy !== best.gy || old.p !== p){
        const g2 = s.g.slice(); for(const [cx, cy] of p.cells) g2[(best.gy + cy) * N + best.gx + cx] = p.col;
        const hl = new Set();
        for(let rr2 = 0; rr2 < N; rr2++){ let f = true; for(let c = 0; c < N; c++) if(!g2[rr2 * N + c]){ f = false; break; } if(f) for(let c = 0; c < N; c++) hl.add(rr2 * N + c); }
        for(let c = 0; c < N; c++){ let f = true; for(let r2 = 0; r2 < N; r2++) if(!g2[r2 * N + c]){ f = false; break; } if(f) for(let r2 = 0; r2 < N; r2++) hl.add(r2 * N + c); }
        s.ghost = { p, gx:best.gx, gy:best.gy, hl:hl.size && !s.cfg.nopeek ? hl : null };   /* 변주 '미리보기 없음': 지워질 줄이 빛나지 않음 */
        if(old) sfx('blockTick');
      }
    } else s.ghost = null;
    s.dirty = true;
  }
  function dragEnd(e, cancel){
    const s = S(); if(!s || !s.drag || (e && e.pointerId !== s.drag.id)) return;
    if(e){ s.drag.x = e.clientX; s.drag.y = e.clientY; }
    dragUpdate();
    const d = s.drag, gh = s.ghost;
    /* 누르기만 함(거의 안 움직임) → 조각 고르기(tapPlace: 그다음 판 칸을 누르면 놓임). 다시 누르면 고르기 취소 */
    if(!cancel && Math.hypot(d.x - d.x0, d.y - d.y0) < 10){
      s.dragEl.remove(); s.dragEl = null; s.drag = null; s.ghost = null; s.dirty = true;
      s.slots[d.i].querySelector('.bk-pc').style.visibility = '';
      pickSel(s.sel === d.i ? null : d.i);
      return;
    }
    if(s.sel != null) pickSel(null);
    if(!cancel && gh && !G.over && !G.paused && !s.lock){
      s.dragEl.remove(); s.dragEl = null; s.drag = null; s.ghost = null;
      doPlace(d.i, gh.gx, gh.gy);
    } else returnPiece();
  }
  function cancelDrag(){ const s = S(); if(s.drag) returnPiece(); }

  /* ---------- 누르고 놓기(tapPlace): 조각을 누르고 → 판 칸을 누르면 그 칸을 덮는 자리에 놓기 ---------- */
  function pickSel(i){
    const s = S(); s.sel = i == null || !s.tray[i] ? null : i;
    s.slots.forEach((sl, k) => sl.classList.toggle('sel', k === s.sel));
    const tip = document.getElementById('bkTip');
    if(tip){ tip.textContent = s.sel != null ? '판에서 놓을 칸을 눌러요' : '조각을 끌거나, 누르고 판 칸을 눌러요'; if(s.sel != null) tip.classList.remove('off'); }
    if(s.sel != null){ sfx('blockPick'); fxBuzz(6); }
  }
  /* 누른 칸 (gx, gy)를 덮는 놓을 자리: 조각 칸 중 조각 가운데에 가까운 칸부터 그 칸이 (gx, gy)에 오게 맞춰 보고, 처음 들어가는 자리 */
  function tapSpot(p, gx, gy){
    const mx = (p.w - 1) / 2, my = (p.h - 1) / 2;
    const order = p.cells.map((c, k) => [c, k]).sort((a, b) => (Math.hypot(a[0][0] - mx, a[0][1] - my) - Math.hypot(b[0][0] - mx, b[0][1] - my)) || a[1] - b[1]);
    for(const [[cx, cy]] of order){ const ax = gx - cx, ay = gy - cy; if(E.canPlace(S().g, p, ax, ay)) return [ax, ay]; }
    return null;
  }
  function boardTap(e){
    const s = S(); if(!s || s.sel == null || s.drag || G.over || G.paused || s.lock) return;
    e.preventDefault();
    const r = s.cv.getBoundingClientRect(), gx = Math.floor((e.clientX - r.left) / s.cell), gy = Math.floor((e.clientY - r.top) / s.cell);
    if(gx < 0 || gy < 0 || gx >= N || gy >= N) return;
    const i = s.sel, p = s.tray[i]; if(!p){ pickSel(null); return; }
    const at = tapSpot(p, gx, gy);
    if(!at){ sfx('blockBack'); try{ fxShake(s.slots[i], 4); }catch(_){} const tip = document.getElementById('bkTip'); if(tip) tip.textContent = '거기엔 안 들어가요 · 다른 칸을 눌러요'; return; }
    pickSel(null);
    doPlace(i, at[0], at[1]);
  }
  function returnPiece(){
    const s = S(), d = s.drag, el = s.dragEl; s.drag = null; s.dragEl = null; s.ghost = null; s.dirty = true;
    if(!d) return;
    const pc = s.slots[d.i].querySelector('.bk-pc'), tgt = pc.querySelector('canvas').getBoundingClientRect();
    sfx('blockBack');
    const done = () => { el.remove(); if(G && G.bk === s && !(s.drag && s.drag.i === d.i)) pc.style.visibility = ''; };
    if(!el.animate || FXR.reduce){ done(); return; }
    const cur = el.style.transform, sc = tc(d.p) / s.cell, w = d.p.w * s.cell, h = d.p.h * s.cell;
    const tx = tgt.left + tgt.width / 2 - w / 2, ty = tgt.top + tgt.height / 2 - h / 2;
    const cv = el.firstChild; cv.style.animation = 'none';
    el.animate([{ transform:cur }, { transform:`translate3d(${tx}px,${ty}px,0)` }], { duration:200, easing:'cubic-bezier(.3,.7,.4,1)', fill:'forwards' });
    cv.animate([{ transform:'scale(1)' }, { transform:`scale(${sc})` }], { duration:200, easing:'ease-out', fill:'forwards' }).onfinish = done;
  }

  /* ---------- 놓기 · 줄 지우기 ---------- */
  function doPlace(i, gx, gy){
    const s = S(), p = s.tray[i]; if(!p || !E.canPlace(s.g, p, gx, gy)) return false;
    const ev = E.step(s, i, gx, gy), r = ev.r, placed = ev.placed;
    if(s.sel != null && s.slots) pickSel(null);
    s.pts += p.n;
    const tip = document.getElementById('bkTip'); if(tip) tip.classList.add('off');
    const hasUI = !!s.cv && s.cv.isConnected;
    const br = hasUI ? s.cv.getBoundingClientRect() : null, cpx = hasUI ? s.cell : 0;
    if(hasUI){ s.anims.push({ type:'place', cells:placed.filter(k => s.g[k]), t0:0, dur:220 }); s.dirty = true; }
    sfx('blockPlace', { n:p.n, pan:hasUI ? panX(br.left + (gx + p.w / 2) * cpx) : 0 }); fxBuzz(10);
    if(r.lines){
      s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo); if(r.lines >= 2) s.multi++;
      const gain = Math.round(10 * (r.cleared.length + r.cracked.length) * r.lines * (1 + (s.combo - 1) * .5)) + 30 * r.gems;
      s.pts += gain;
      if(hasUI) clearFx(r, gain, gx + p.w / 2, gy + p.h / 2);
    } else s.combo = 0;
    const refill = ev.refill;
    if(hasUI){
      paintTray(refill); if(refill) later(() => sfx('blockTray'), r.lines ? 260 : 90); hud();
      if(ev.grown.length){ s.anims.push({ type:'pop', cells:ev.grown, t0:0, dur:420, delay:r.lines ? 300 : 80 }); later(() => { sfx('blockVine'); toastOnce('vine', '줄을 못 지워서 덩굴이 자랐어요'); }, r.lines ? 300 : 80); }
      if(ev.spawned.length) s.anims.push({ type:'pop', cells:ev.spawned, t0:0, dur:420, delay:r.lines ? 360 : 140 });
      if(ev.grown.length || ev.spawned.length) s.dirty = true;
    }
    if(ev.state === 'win'){ win(); return true; }
    if(ev.state === 'lose'){ lose(ev.boom); return true; }
    return true;
  }
  function toastOnce(k, t){ const s = S(); s.told = s.told || {}; if(s.told[k]) return; s.told[k] = 1; if(!G.paused) toast(t); }
  function clearFx(r, gain, fcx, fcy){
    const s = S(), br = s.cv.getBoundingClientRect(), c = s.cell;
    const lines = r.rows.map(v => [1, v]).concat(r.cols.map(v => [0, v]));
    const cells = r.cleared.map(([i, ci]) => { const x = i % N, y = (i / N) | 0, rowHit = r.rows.includes(y), colHit = r.cols.includes(x);
      const dist = rowHit && colHit ? Math.min(Math.abs(x - fcx), Math.abs(y - fcy)) : rowHit ? Math.abs(x + .5 - fcx) : Math.abs(y + .5 - fcy); return [i, ci, dist * 34]; });
    s.anims.push({ type:'clear', cells, lines, fc:[fcx, fcy], t0:0, dur:760 }); s.dirty = true;
    if(r.cracked.length){ s.anims.push({ type:'crack', cells:r.cracked, t0:0, dur:420 }); later(() => sfx('blockCrack'), 120); }
    if(r.gems) later(() => sfx('blockGem', { k:r.gems }), 160);
    if(r.bombs) later(() => sfx('blockDefuse'), 140);
    const nParts = Math.max(1, Math.min(4, Math.floor(90 / Math.max(1, cells.length))));
    cells.forEach(([i, ci, dl]) => { later(() => { const pcx = br.left + ((i % N) + .5) * c, pcy = br.top + (((i / N) | 0) + .5) * c;
      fxBurst(pcx, pcy, [PAL[ci][0], PAL[ci][1], '#FFFFFF'], nParts, { speed:230, size:4.5, kinds:['rect','star','dot'], up:140, g:700, dur:.75 }); }, dl + 40); });
    const k = r.lines, cmb = s.combo;
    sfx('blockClear', { k, c:cmb }); fxBuzz(k >= 2 ? [18, 40, 22] : 16);
    const allC = r.cleared.map(c => c[0]).concat(r.cracked);
    let cx = 0, cy = 0; allC.forEach(i => { cx += (i % N) + .5; cy += ((i / N) | 0) + .5; }); cx /= allC.length; cy /= allC.length;
    fxFloat(br.left + cx * c, br.top + cy * c, '+' + fmt(gain), 'bkf' + (k >= 2 ? ' big' : ''));
    if(k >= 2){ const m = s.boardEl.querySelector('.bk-multi'); if(m) m.remove(); const d = document.createElement('div'); d.className = 'bk-multi m' + Math.min(k, 5); d.textContent = k + '줄 콤보!'; s.boardEl.appendChild(d); later(() => d.remove(), 1100); }
    if(k >= 3) fxShake(s.boardEl, 7 + k); else if(k === 2) fxShake(s.boardEl, 3);
    /* 이펙트 v2: 지워진 줄을 따라 반짝이가 훑고 지나감, 3줄 이상이면 화면이 살짝 번쩍 */
    try{ if(typeof fxEmit === 'function'){ lines.forEach(([isRow, v], li) => { for(let j = 0; j < N; j++){ const x = isRow ? j : v, y = isRow ? v : j, d = Math.abs((isRow ? x + .5 - fcx : y + .5 - fcy)) * 34 + li * 40;
      later(() => fxEmit(br.left + (x + .5) * c, br.top + (y + .5) * c, { quantity:2, speed:{ min:20, max:90 }, lifespan:{ min:380, max:620 }, kind:'twinkle', tint:['#FFFFFF', '#FFF3B0'], scale:{ start:4.2, end:0, ease:'quad.in' }, glow:true }), d); } });
      if(k >= 3) later(() => fxFlash('#FFF3B0', .32, 340), 60); } }catch(_){}
    if(k >= 2){ const pc = fxCenter(s.cv); fxRing(br.left + cx * c, br.top + cy * c, '#FFE27A', pc.w * .55, .55, 10); }
    if(cmb >= 2) later(() => fxCombo(cmb), 120);
    const bar = document.getElementById('bkFill'); if(bar && bar.animate) bar.animate([{ filter:'brightness(1.8)' }, { filter:'brightness(1)' }], { duration:500 });
  }
  function win(){
    const s = S(); s.lock = true; hud();
    if(!s.cv || !s.cv.isConnected){ finish(true); return; }
    later(() => {
      sfx('blockGoal'); fxBuzz([20, 40, 20]);
      showMsg('목표 달성!', 'ok');
      const br = s.cv.getBoundingClientRect();
      for(let k = 0; k < 6; k++) later(() => fxBurst(br.left + br.width * (.15 + Math.random() * .7), br.top + br.height * (.15 + Math.random() * .7), ['#FFE27A','#FFFFFF','#FF9BD0','#9CCBFF'], 10, { speed:280, kinds:['star','spark','dot'], glow:true, up:120 }), k * 90);
    }, 380);
    later(() => { if(!G.over) finish(true); }, 1250);
  }
  function lose(boom){
    const s = S(); s.lock = true; s.boomAt = boom >= 0 ? boom : -1;
    if(!s.cv || !s.cv.isConnected){ finish(false); return; }
    if(s.boomAt >= 0){
      later(() => { const br = s.cv.getBoundingClientRect(), i = s.boomAt, cx = br.left + ((i % N) + .5) * s.cell, cy = br.top + (((i / N) | 0) + .5) * s.cell;
        sfx('blockBoom'); fxBurst(cx, cy, ['#FF4D2E','#FFB020','#FFE27A','#2B2440'], 26, { speed:360, kinds:['dot','spark','rect'], glow:true, up:80 }); fxRing(cx, cy, '#FF7A3A', s.cell * 3.2, .5, 12);
        fxShake(s.boardEl, 10); fxBuzz([60, 40, 60]); s.anims.push({ type:'boom', i, t0:0, dur:600 }); s.dirty = true; showMsg('폭탄이 터졌어요!', 'bad'); }, 260);
      later(() => { if(!G.over) finish(false); }, 1900);
      return;
    }
    later(() => { showMsg('더 놓을 곳이 없어요', 'bad'); sfx('blockFail'); fxShake(s.boardEl, 6); fxBuzz([40, 60, 40]); s.slots.forEach(sl => sl.classList.add('nofit')); }, 420);
    later(() => { if(!G.over) finish(false); }, 1900);
  }
  /* 대전 제한 시간(3분): 시간이 다 되면 그 자리까지 지운 줄로 기록 */
  function duelClock(){
    const s = S(), rem = Math.max(0, G.limit - elapsed()), sec = Math.ceil(rem);
    if(sec !== s.lastSec){ s.lastSec = sec;
      const e = document.getElementById('bkRem'); if(e) e.textContent = mmss(sec);
      const p = document.getElementById('bkRemP'); if(p) p.classList.toggle('hurry', sec <= 10); }
    if(rem > 0) return;
    s.lock = true; if(s.drag) cancelDrag(); pickSel(null);
    later(() => { showMsg('시간이 다 됐어요', 'bad'); sfx('blockFail'); fxBuzz([40, 60, 40]); }, 60);
    later(() => { if(!G.over) finish(false); }, 1400);
  }
  function showMsg(t, cls){ const m = document.getElementById('bkMsg'); if(!m) return; m.textContent = t; m.className = 'bk-msg on ' + cls; }

  /* ---------- 썸네일 ---------- */
  function art(){
    const grid = ['..14....','.114..66','3...7.6.','3.2277..','33....85','55555555','1..44.8.','11.4..88'];
    const cols = { 1:PAL[1], 2:PAL[2], 3:PAL[5], 4:PAL[4], 5:PAL[3], 6:PAL[7], 7:PAL[8], 8:PAL[6] };
    const c = 10.5, x0 = 22, y0 = 8; let g = '';
    for(let y = 0; y < 8; y++) for(let x = 0; x < 8; x++){ const ch = grid[y][x], X = x0 + x * c, Y = y0 + y * c;
      if(ch === '.'){ g += `<rect x="${X + .6}" y="${Y + .6}" width="${c - 1.2}" height="${c - 1.2}" rx="2" fill="#2A2270"/>`; continue; }
      const [L, B, D] = cols[ch];
      g += `<rect x="${X + .4}" y="${Y + .4}" width="${c - .8}" height="${c - .8}" rx="2.2" fill="#1A0F45"/><rect x="${X + 1.2}" y="${Y + 1.2}" width="${c - 2.4}" height="${c - 2.4}" rx="1.6" fill="${B}"/><path d="M${X + 1.2} ${Y + 1.2}h${c - 2.4}l-2 2h-${c - 6.4}z" fill="${L}"/><path d="M${X + 1.2} ${Y + c - 1.2}h${c - 2.4}l-2 -2h-${c - 6.4}z" fill="${D}" opacity=".7"/>`; }
    const fy = y0 + 5 * c;
    const T = (X, Y) => `<rect x="${X}" y="${Y}" width="13" height="13" rx="2.8" fill="#1A0F45"/><rect x="${X + 1.3}" y="${Y + 1.3}" width="10.4" height="10.4" rx="2" fill="url(#blockA2)"/><path d="M${X + 1.3} ${Y + 1.3}h10.4l-2.4 2.4h-5.6z" fill="#fff" opacity=".6"/><ellipse cx="${X + 5}" cy="${Y + 5}" rx="2.4" ry="1" fill="#fff" opacity=".8" transform="rotate(-25 ${X + 5} ${Y + 5})"/>`;
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
      <linearGradient id="blockA1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A3FD0"/><stop offset="1" stop-color="#1E1260"/></linearGradient>
      <linearGradient id="blockA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9AF4F0"/><stop offset="1" stop-color="#0FA5B8"/></linearGradient>
      <linearGradient id="blockA3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <rect width="160" height="100" fill="url(#blockA1)"/><circle cx="148" cy="10" r="28" fill="#FF6BD5" opacity=".25"/><circle cx="8" cy="92" r="30" fill="#3FA9F5" opacity=".25"/>
      <rect x="${x0 - 4}" y="${y0 - 4}" width="${8 * c + 8}" height="${8 * c + 8}" rx="7" fill="#1D1752" stroke="#1A0F45" stroke-width="2.5"/>${g}
      <rect x="${x0 - 2}" y="${fy - 1}" width="${8 * c + 4}" height="${c + 2}" rx="3" fill="url(#blockA3)" opacity=".85"/>
      <g fill="#FFE27A"><path d="M${x0 + 8 * c + 6} ${fy - 4}l1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6z"/><path d="M${x0 - 8} ${fy + 12}l1.2 2.6 2.6 1.2-2.6 1.2-1.2 2.6-1.2-2.6-2.6-1.2 2.6-1.2z"/></g>
      <g transform="rotate(-8 132 40)"><ellipse cx="132" cy="64" rx="18" ry="3.5" fill="#0B0620" opacity=".45"/>${T(113, 22)}${T(126, 22)}${T(139, 22)}${T(126, 35)}</g></svg>`;
  }

  /* ---------- 솔로 스테이지(난이도 v2: 5판마다 새 개념) ----------
     새 규칙: 11 보석 모으기 · 21 얼음 칸 · 31 시한폭탄 · 41 덩굴 (챕터 이름 보석 광산·얼음 궁전·용암 동굴·덩굴 숲과 맞춤)
     변주: 6 번개(별 기준 조각 ×0.8) · 16 두 개씩 · 26 큰 조각 가방 · 36 돌 블록 · 46 미리보기 없음
     BK_T[n] = [y, 기준 조각 수]: y는 난이도 한 값(0~1.4 = 조각 난이도 d, 음수 = 목표 줄이고 폭탄 숫자 늘림(-1 아래는 새 조각이 모두 들어가게, -2 아래는 폭탄 1개), 1.4 초과 = 목표 늘림).
     tools/block-tune.js가 자동 플레이어로 판마다 목표 첫 판 클리어율(쉬움 90% · 보통 75~85% · 어려움 60% · 보스 40%)에 맞춘 값 */
  const BK_T = [0,[0.4,12],[1,14],[1,19],[1,20],[2.4,33],[0.4,17],[1,19],[1,18],[0.4,12],[1.52,17],[0.44,13],[0.3,18],[0.37,21],[0.23,24],[0.77,24],[0.5,16],[-0.02,21],[-0.06,22],[-0.28,15],[0.91,25],[-0.54,13],[-2,21],[-0.02,19],[-0.49,30],[0.01,24],[0.6,17],[-0.91,12],[-1.03,13],[0.01,21],[-0.89,18],[-0.23,17],[-0.36,20],[-0.63,18],[-0.96,15],[-0.38,24],[0.59,18],[-0.49,23],[-0.38,21],[-0.63,12],[-1.14,27],[0.8,20],[0.3,22],[0.77,23],[-0.78,18],[1.59,26],[-0.01,23],[1.02,24],[0.73,24],[0.8,17],[-0.93,15],[0.45,18],[-0.38,18],[0.01,33],[-0.77,15],[-0.81,17],[-0.44,24],[-0.51,22],[-1.8,15],[-0.32,17],[-0.89,15],[-0.38,17],[0.91,22],[-0.69,21],[-0.78,18],[-0.77,19],[-0.87,14],[-0.45,22],[-0.49,24],[1,20],[-0.92,18],[-0.42,19],[0.23,27],[-0.71,21],[-1.39,15],[-1.14,9],[-0.98,12],[-0.75,14],[-1.14,21],[0.2,25],[-1.6,14],[0.74,21],[-0.17,27],[0.37,30],[0.12,34],[0.23,36],[0,24],[-0.27,33],[-0.35,30],[-0.6,17],[0.05,30],[-0.86,15],[-0.74,24],[-0.91,18],[-1.72,20],[-2,27],[-0.89,18],[-0.13,22],[-1.74,21],[-0.04,21],[-2.2,27]];
  const ROLE = [0, .7, .9, 1, 1, 1.1, .8, 1, 1.05, .75, 1.2];     /* 챕터 안 자리별 목표 길이 */
  const Y0 = [0, .15, .35, .4, .45, .7, .2, .45, .5, .2, .8];      /* 표가 없는 판의 기본 y */
  function yOf(n){
    const t = BK_T[n]; if(t) return t[0];
    /* 표 밖(71~): 같은 자리(k)의 판 중 규칙·변주가 가장 닮은 판들의 y 평균 + 챕터마다 조금씩(최대 +0.2) */
    const p = planOf('block', n), L = BK_T.length;
    if(L > 60){
      let best = -1, ys = [];
      for(let m = 11; m < L; m++){ if(!BK_T[m] || (m - 1) % 10 + 1 !== p.k) continue;
        const q = planOf('block', m), same = q.mj.length === p.mj.length && q.mj.every(x => p.mj.includes(x));
        const sc = (same ? 4 : 0) + q.mj.filter(x => p.mj.includes(x)).length + (q.tw === p.tw ? 1 : 0) + (q.remix === p.remix ? .5 : 0);
        if(sc > best){ best = sc; ys = []; } if(sc === best) ys.push(BK_T[m][0]); }
      if(ys.length) return ys.reduce((a, b) => a + b, 0) / ys.length + Math.min(.2, .02 * Math.max(0, p.c - Math.ceil((L - 1) / 10)));
    }
    return Y0[p.k] + .04 * (p.c - 1);
  }
  function stageCfg(n, y0){
    const p = planOf('block', n), c = p.c, k = p.k, has = m => p.mj.includes(m), t = BK_T[n];
    const y = y0 != null ? y0 : yOf(n);
    const d = Math.max(0, Math.min(1.4, y)), len = y < 0 ? Math.max(.45, 1 + .55 * y) : y > 1.4 ? 1 + (y - 1.4) : 1, slack = y < 0 ? Math.round(-4 * y) : 0;
    const rl = ROLE[k] * (1 + .1 * Math.min(9, c - 1)) * len, ice = has('ice'), gem = has('gem'), both = ice && gem;
    const cfg = { limit:0, plan:p, boss:p.boss, d:Math.round(d * 1000) / 1000, need:y < -1 ? 3 : p.easy || c === 1 ? 2 : 1 };   /* 아주 쉽게 풀어 준 판(y < -1)은 새 조각이 모두 들어갈 자리가 있게 */
    cfg.target = ice || gem ? 0 : Math.max(3, Math.round(7 * rl));
    cfg.ice = ice ? Math.max(2, 2 * Math.round(2.5 * rl * (both ? .7 : 1))) : 0;
    cfg.gem = gem ? Math.max(2, Math.round(5 * rl * (both ? .7 : 1))) : 0;
    cfg.gemOn = gem ? Math.min(cfg.gem, p.boss ? 4 : 3) : 0;
    if(has('bomb')) cfg.bomb = { n:(p.hard || p.boss) && (c >= 5 || p.remix) && y >= -2 ? 2 : 1, t:Math.max(5, (k === 1 ? 12 : 10) - (p.hard ? 1 : 0) - (p.boss ? 2 : 0) - Math.min(1, Math.max(0, Math.floor((c - 4) / 2)))) + slack };
    if(has('vine')) cfg.vine = { seeds:k === 1 ? 1 : 2, grow:p.boss ? 2 : 1 };
    const tw = p.tw;
    cfg.duo = tw === 'duo'; cfg.big = tw === 'big'; cfg.nopeek = tw === 'nopeek'; cfg.flash = tw === 'flash';
    cfg.stones = tw === 'rock' ? 4 + 2 * Math.min(3, Math.floor(c / 3)) : c === 1 && p.boss ? 6 : 0;
    cfg.par = t && t[1] && y0 == null ? t[1] : parGuess(cfg);
    return cfg;
  }
  /* 표에 없는 판의 기준 조각 수(표 값으로 맞춘 식) */
  function parGuess(c){ return Math.max(4, Math.round((c.target * 1.41 + c.ice * 2.87 + c.gem * 2.32) * (1 + .15 * c.d) + (c.bomb ? 1.2 : 0) + 7.5)); }   /* 표 70판에 맞춘 식(평균 오차 약 2조각) */
  function goalText(c){ const g = []; if(c.target) g.push(c.target + '줄'); if(c.ice) g.push('얼음 ' + c.ice + '개'); if(c.gem) g.push('보석 ' + c.gem + '개'); return '목표 ' + g.join(' · '); }

  return {
    name:'블록 채우기', abil:'공간지각', col:['#FF9E8A','#EF4B3F','#8F1D1A'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="2.5" width="5.8" height="5.8" rx="1.5"/><rect x="9.1" y="2.5" width="5.8" height="5.8" rx="1.5"/><rect x="2.5" y="9.1" width="5.8" height="5.8" rx="1.5"/><rect x="15.7" y="9.1" width="5.8" height="5.8" rx="1.5" opacity=".6"/><rect x="15.7" y="15.7" width="5.8" height="5.8" rx="1.5" opacity=".6"/><rect x="9.1" y="15.7" width="5.8" height="5.8" rx="1.5" opacity=".6"/></svg>',
    art,
    help:[['조각을 끌어다 놓아요','아래 조각 3개 중 하나를 끌어 8×8 판의 빈 곳에 놓아요. 끌기가 어려우면 조각을 누르고 판 칸을 누르세요.'],
      ['줄을 꽉 채우면 사라져요','가로줄이나 세로줄을 빈틈없이 채우면 지워져요. 여러 줄을 한 번에, 또 연달아 지우면 점수가 커져요.'],
      ['목표 줄 수를 채우면 성공','목표만큼 줄을 지우면 클리어! 남은 조각을 놓을 곳이 없으면 끝나요. 조각을 적게 쓸수록 점수와 별이 많아요.']],
    /* 도움말 v2(공용 WP3가 읽음): 3줄 + 더 알아보기. 솔로 특별한 칸(보석·얼음·폭탄·덩굴)은 개념 카드에서만 설명 */
    howto:{ lines:['아래 조각을 판에 놓아요', '가로·세로 줄을 채우면 사라져요', '목표 줄을 지우면 성공'],
      more:[['누르고 놓기', '조각을 누른 뒤 판 칸을 누르면 그 칸에 놓여요.'], ['점수·별', '여러 줄을 한 번에·연달아 지우면 점수가 커지고, 조각을 적게 쓸수록 별이 많아요.'], ['대전', '같은 조각 순서로 동시에! 12줄을 먼저 지우면 이겨요(3분).']] },
    chapters:['나무 상자','보석 광산','얼음 궁전','용암 동굴','덩굴 숲'],
    concepts:{
      order:['gem','ice','bomb','vine'],
      info:{
        gem:{ name:'보석 모으기', desc:'판에 보석 칸이 박혀 있어요. 보석이 든 줄을 지우면 보석을 모아요. 목표만큼 모으면 클리어!' },
        ice:{ name:'얼음 칸', desc:'얼음 칸은 처음부터 채워져 있어요. 줄을 지우면 금이 가고, 한 번 더 지우면 깨져요. 얼음을 모두 깨면 클리어!' },
        bomb:{ name:'시한폭탄', desc:'폭탄 숫자는 조각을 하나 놓을 때마다 1씩 줄어요. 0이 되기 전에 폭탄이 든 가로줄이나 세로줄을 지워요!' },
        vine:{ name:'덩굴', desc:'조각 한 세트를 다 쓰는 동안 줄을 하나도 못 지우면 덩굴이 옆 칸으로 자라요. 줄을 지우면 덩굴도 함께 사라져요.' }
      },
      twists:['flash','duo','big','rock','nopeek'],
      twInfo:{
        flash:{ name:'번개', desc:'별 기준이 빡빡해요. 평소보다 조각을 20% 적게 써야 별 3개!' },
        duo:{ name:'두 개씩', desc:'조각이 3개가 아니라 2개씩만 나와요. 고를 수 있는 게 줄어요.' },
        big:{ name:'큰 조각 가방', desc:'3×3 네모나 5칸 막대 같은 큰 조각이 자주 나와요. 큰 자리를 비워 두세요!' },
        rock:{ name:'돌 블록', desc:'판에 돌 블록이 미리 놓여 있어요. 돌도 줄을 채우면 함께 사라져요.' },
        nopeek:{ name:'미리보기 없음', desc:'조각을 끌어도 지워질 줄이 미리 빛나지 않아요. 눈으로 잘 세어 봐요!' }
      }
    },
    starRule:'★ 클리어 · ★★ 조각을 아껴서 · ★★★ 아주 적은 조각으로',
    levels:LV,
    stage(n){ return stageCfg(n); },
    duelCfg(){ return Object.assign({}, DUEL); },
    stageDesc(n){ const c = this.stage(n); return goalText(c) + (c.stones ? ' · 돌 블록 ' + c.stones + '개' : '') + (c.bomb ? ' · 폭탄 ' + c.bomb.t + '수' : ''); },
    levelDesc(lv){ return '목표 ' + (LV[lv] || LV.normal).target + '줄'; },
    init, render,
    progress(){ const s = G && G.bk; return s ? Math.min(1, progressOf(s)) : 0; },
    lossText(){ const s = G.bk, gl = goals(s);
      const t = gl.length === 1 && gl[0].k === 'lines' ? '목표 ' + s.target + '줄 중 ' + Math.min(s.lines, s.target) + '줄을 지웠어요.' : gl.map(o => o.name + ' ' + o.have + '/' + o.need).join(' · ') + '까지 했어요.';
      return (s.boomAt >= 0 ? '시한폭탄이 터졌어요. ' : '') + t; },
    score(){
      const s = G.bk, time = E.eff(s.used, s.par), extra = Math.min(150, 50 * s.multi);
      return { base:500, time, extra, rows:[goalText(s.cfg) + ' 달성', '효율 보너스 (조각 ' + s.used + '개 · 기준 ' + s.par + '개)', '멀티 클리어 ' + s.multi + '번'] };
    },
    stars(){ const s = G.bk; return s.used <= s.par ? 3 : s.used <= s.par * 1.35 ? 2 : 1; },
    css:`
body[data-mode="block"]{background:radial-gradient(120% 60% at 50% 0%, #4B2FB8 0%, rgba(75,47,184,0) 60%), radial-gradient(80% 50% at 100% 100%, rgba(239,75,63,.28) 0%, rgba(239,75,63,0) 70%), linear-gradient(180deg,#2B1B82 0%, #1A1057 45%, #0E0833 100%); background-attachment:fixed}
.ng-block, .ng-block *{-webkit-user-select:none; user-select:none; -webkit-touch-callout:none}
.ng-block{display:flex; flex-direction:column}
.ng-block .bk-hud{margin:0 0 8px}
.ng-block .bk-goal{flex:2.3 1 0; height:auto; min-height:56px; padding:5px 10px; gap:3px}
.ng-block .bk-gt{display:flex; align-items:center; justify-content:center; gap:6px; white-space:nowrap; line-height:1}
.ng-block .bk-gt b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#EF4B3F; letter-spacing:.3px}
.ng-block .bk-gt b i{font-style:normal}
.ng-block .bk-gt b small{font-size:14px; color:#6A5884; margin-left:1px}
.ng-block .bk-gt.gm{gap:10px}
.ng-block .bk-gi{display:inline-flex; align-items:center; gap:4px}
.ng-block .bk-gi svg{width:20px; height:20px; flex:none}
.ng-block .bk-gt.gm .bk-gi b{font-size:19px}
.ng-block .bk-gi.g-gem b{color:#C42A95}
.ng-block .bk-gi.g-ice b{color:#2A76A8}
.ng-block .bk-hud .hchip:not(.bk-goal){height:auto; min-height:56px}
.ng-block .bk-pts b, .ng-block .bk-hud .time b{font-size:18px}
.ng-block .bk-rules{display:flex; flex-wrap:wrap; gap:5px; justify-content:center; margin:-3px 0 9px}
.ng-block .bk-chip{font-family:var(--disp); font-size:12.5px; line-height:1; padding:4px 9px 4px; border-radius:999px; border:2px solid #1A0F45; color:#1A0F45; background:#FFE27A; box-shadow:0 2px 0 #0E0730; white-space:nowrap}
.ng-block .bk-chip.tw{background:#CFC5FF}
.ng-block .bk-bar{margin:0; height:8px}
.ng-block .bk-goal em{font-size:13px; color:#4A3A6E}
.ng-block .hchip.time.hurry{background:linear-gradient(180deg,#FFE3E4,#FFB3B6)} .ng-block .hchip.time.hurry b{color:#E5484D}
.ng-block .bk-bar i{transition:width .35s cubic-bezier(.3,1.3,.5,1)}
.ng-block .bk-board{position:relative; width:max-content; margin:auto; padding:7px; border-radius:18px; background:linear-gradient(180deg,#30277E,#1C1650); border:3px solid #B4A8FF;
  box-shadow:0 0 0 2.5px #1A0F45, inset 0 2px 0 rgba(255,255,255,.25), 0 5px 0 2px #0B0628, 0 14px 26px rgba(4,0,20,.45), 0 0 18px rgba(160,140,255,.35); touch-action:none}
.ng-block .bk-board canvas{display:block; touch-action:none}
.ng-block .bk-msg{position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(.6); opacity:0; pointer-events:none; white-space:nowrap; padding:12px 22px; border-radius:18px; font-family:var(--disp); font-size:22px;
  background:linear-gradient(180deg,#FFF8EA,#FBEBCB); border:3px solid #1A0F45; box-shadow:0 5px 0 #0B0628, 0 14px 30px rgba(0,0,0,.45); color:var(--ink); transition:transform .3s cubic-bezier(.2,1.5,.4,1), opacity .2s}
.ng-block .bk-msg.on{opacity:1; transform:translate(-50%,-50%) scale(1)}
.ng-block .bk-msg.ok{color:#fff; background:linear-gradient(180deg,#FFB27A,#EF4B3F); text-shadow:0 2px 0 #8F1D1A; border-color:#8F1D1A; font-size:28px}
.ng-block .bk-multi{position:absolute; left:50%; top:42%; pointer-events:none; z-index:2; font-family:var(--heavy); font-size:44px; color:#FFE27A; -webkit-text-stroke:6px #1A0F45; paint-order:stroke fill; white-space:nowrap;
  text-shadow:0 5px 0 #1A0F45; animation:bkMulti 1.05s cubic-bezier(.2,1.4,.4,1) forwards}
.ng-block .bk-multi.m3{color:#FF9BD0; font-size:50px}
.ng-block .bk-multi.m4, .ng-block .bk-multi.m5{color:#8CFFC1; font-size:54px}
@keyframes bkMulti{0%{transform:translate(-50%,-50%) scale(.3) rotate(-8deg); opacity:0}25%{transform:translate(-50%,-50%) scale(1.12) rotate(-4deg); opacity:1}70%{transform:translate(-50%,-58%) scale(1) rotate(-4deg); opacity:1}100%{transform:translate(-50%,-80%) scale(.95) rotate(-4deg); opacity:0}}
.ng-block .bk-tray{display:grid; grid-template-columns:repeat(3,1fr); margin:0 0 4px; overflow:clip; border-radius:20px; background:rgba(8,4,30,.35); border:2px solid #8274DA; box-shadow:inset 0 3px 8px rgba(0,0,0,.35), inset 0 -1px 0 rgba(255,255,255,.08); touch-action:none}
.ng-block .bk-slot{position:relative; display:flex; align-items:center; justify-content:center; min-height:44px; padding-bottom:10px; cursor:grab; touch-action:none}
.ng-block .bk-slot + .bk-slot::before{content:""; position:absolute; left:0; top:14%; bottom:14%; width:1.5px; background:rgba(180,168,255,.55)}
/* 누르고 놓기: 고른 조각 */
.ng-block .bk-slot.sel{background:radial-gradient(70% 70% at 50% 50%, rgba(255,226,122,.28), rgba(255,226,122,0) 75%); box-shadow:inset 0 0 0 3px #FFE27A; border-radius:18px}
.ng-block .bk-slot.sel .bk-pc{animation:bkSel .9s ease-in-out infinite alternate}
@keyframes bkSel{from{transform:translateY(0) scale(1.04)} to{transform:translateY(-5px) scale(1.08)}}
.ng-block .bk-pc{display:flex; filter:drop-shadow(0 4px 0 rgba(8,3,30,.55)); transition:opacity .2s, filter .2s}
.ng-block .bk-pc canvas{display:block}
.ng-block .bk-pc.in{animation:bkIn .42s cubic-bezier(.2,1.3,.4,1) both}
@keyframes bkIn{0%{transform:translateX(130px) scale(.6); opacity:0}100%{transform:none; opacity:1}}
.ng-block .bk-slot.nofit .bk-pc{opacity:.38; filter:grayscale(.85) drop-shadow(0 3px 0 rgba(8,3,30,.4))}
.ng-block .bk-slot.nofit::after{content:"놓을 곳 없음"; position:absolute; bottom:4px; left:50%; transform:translateX(-50%); font-size:12px; font-weight:700; color:#FFC4C4; white-space:nowrap}
.ng-block .bk-slot.empty{cursor:default}
.ng-block .bk-tip{margin:0; padding:12px 0 10px; text-align:center; font-family:var(--disp); font-size:15px; color:#E4DDFF; transition:opacity .4s}
.ng-block .bk-tip.off{opacity:0}
.ng-block.bk-drag{position:fixed; left:0; top:0; z-index:30; pointer-events:none; will-change:transform}
.ng-block.bk-drag canvas{display:block; filter:drop-shadow(0 10px 8px rgba(0,0,0,.45)); transform-origin:50% 50%; animation:bkPick .14s ease-out both}
@keyframes bkPick{from{transform:translate(var(--ox),var(--oy)) scale(var(--s0))}to{transform:none}}
body[data-mode="block"] .fxfloat.bkf{font-family:var(--heavy); font-weight:400; font-size:24px; color:#fff; -webkit-text-stroke:5px #1A0F45}
body[data-mode="block"] .fxfloat.bkf.big{font-size:30px; color:#FFE27A}
@media (prefers-reduced-motion: reduce){ .ng-block .bk-multi{animation-duration:.01s} .ng-block.bk-drag canvas{animation:none} .ng-block .bk-slot.sel .bk-pc{animation:none} }
`,
    sounds:{
      blockPick(){ aTone({ f:520, f2:820, d:.07, v:.08, bus:'ui' }); aNoise({ ft:'highpass', f:5200, d:.02, v:.025, bus:'ui' }); },
      blockTick(){ aTone({ f:1500, type:'triangle', d:.018, v:.02, bus:'ui' }); },
      blockPlace(o){ const n = o.n || 4; aThump({ f:230, f2:70, d:.13, v:.26, pan:o.pan }); aNoise({ ft:'lowpass', f:1600, f2:300, d:.08, v:.14, pan:o.pan }); aTone({ f:m2f(62 - Math.min(9, n)), type:'triangle', d:.08, v:.07, pan:o.pan }); aNoise({ ft:'bandpass', f:2400, q:4, d:.02, v:.05, pan:o.pan }); },
      blockBack(){ aTone({ f:640, f2:320, d:.12, v:.05, bus:'ui' }); aWhoosh({ f:1800, f2:500, a:.02, d:.14, v:.03, bus:'ui' }); },
      blockClear(o){ const k = o.k || 1, c = Math.min(8, o.c || 1); for(let i = 0; i < 3 + k * 2 && i < 10; i++) aBell({ f:penta(i + c, 72), t:i * .045, d:.55, v:.06, idx:1.3, rev:.4 });
        aWhoosh({ f:700, f2:5200, a:.03, d:.34, v:.065 }); aThump({ f:170, f2:60, d:.2, v:.16 }); if(k >= 2){ aSparkle({ t:.18, n:4 + k, root:84 }); aThump({ f:110, f2:40, t:.05, d:.4, v:.22 }); } },
      blockTray(){ aWhoosh({ f:500, f2:2600, a:.03, d:.2, v:.05 }); [0, 1, 2].forEach(i => aPluck(penta(i * 2 + 3, 72), { t:.04 + i * .07, v:.07, d:.25 })); },
      blockFail(){ [67, 63, 60, 55].forEach((m, i) => aTone({ f:m2f(m), type:'triangle', t:i * .12, d:.3, v:.08 })); aThump({ t:.45, f:110, f2:40, d:.45, v:.2 }); },
      blockGoal(){ aSparkle({ root:79, n:8, gap:.04 }); aThump({ f:150, f2:60, d:.3, v:.2 }); },
      blockGem(o){ const k = Math.min(4, o.k || 1); for(let i = 0; i < 2 + k; i++) aBell({ f:penta(i * 2 + 5, 79), t:i * .06, d:.5, v:.07, idx:1.6, rev:.45 }); },
      blockCrack(){ aNoise({ ft:'highpass', f:3200, d:.07, v:.1 }); aTone({ f:1900, f2:1100, type:'triangle', d:.06, v:.05 }); aNoise({ ft:'bandpass', f:5200, q:3, t:.04, d:.05, v:.06 }); },
      blockDefuse(){ aTone({ f:880, f2:1320, type:'triangle', d:.12, v:.07 }); aTone({ f:1320, t:.08, type:'triangle', d:.15, v:.06 }); },
      blockVine(){ aTone({ f:220, f2:330, type:'triangle', d:.22, v:.07 }); aNoise({ ft:'lowpass', f:900, d:.18, v:.06 }); },
      blockBoom(){ aThump({ f:120, f2:30, d:.6, v:.35 }); aNoise({ ft:'lowpass', f:2400, f2:200, d:.7, v:.3 }); aWhoosh({ f:2000, f2:300, a:.01, d:.5, v:.08 }); }
    },
    gate:{ blockPlace:40, blockTick:30, blockClear:60, blockBack:80, blockCrack:60, blockGem:60 },
    jingle(){ [0, 2, 4, 5, 7, 9, 10].forEach((d, i) => aMarimba(penta(d, 72), { t:i * .065, v:.16 })); [72, 76, 79, 84].forEach(m => aBell({ f:m2f(m + 12), t:.5, d:1.4, v:.05, idx:1.2, rev:.5 })); aThump({ f:130, f2:60, t:.48, d:.5, v:.25 }); aSparkle({ t:.55, n:6 }); },

    /* ---------- 테스트용 ---------- */
    _E:E, _LV:LV, _stageCfg:stageCfg, _BK_T:BK_T,
    _state(){ const s = G.bk; return { lines:s.lines, target:s.target, used:s.used, par:s.par, pts:s.pts, multi:s.multi, combo:s.combo, maxCombo:s.maxCombo, lock:s.lock, over:G.over,
      tray:s.tray.map(p => p ? p.fam + ':' + p.oi + ':' + p.col : null), grid:Array.from(s.g).join('') }; },
    _step(){ const s = G.bk; if(G.over || s.lock) return false; const m = E.best(s.g, s.tray); if(!m) return false; return doPlace(m.pi, m.x, m.y); },
    _botStep(){ const s = G.bk; if(G.over || s.lock) return false; const m = E.botMove(s, null); if(!m) return false; return doPlace(m.pi, m.x, m.y); },
    _solveForTest(max = 400){ let n = 0; while(n++ < max && this._step()); return this._state(); },
    _forceFail(){ const s = G.bk; for(let i = 0; i < 64; i++){ const x = i % N, y = (i / N) | 0; s.g[i] = (x % 3 === 2 || y % 3 === 2) ? STONE : 0; }
      s.tray = [mkPiece(6, 0, 1), mkPiece(4, 0, 2), mkPiece(4, 1, 3)]; s.dirty = true; if(s.slots) paintTray(false); lose(); return this._state(); }
  };
})();


/* 대전: AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
/* 대전 판: 12줄 먼저 · 3분(DUEL). duelKind·duelMax·duelMini는 대전 v3 엔진이 읽는 값(지금 엔진은 1:1, 2단계에서 duelMax 5로 올림).
   duelMini = 상대에게 보내는 내 판(칸마다 글자 하나: 0 빈칸, 1~e 블록 색) + 8×8 작은 그림(칸 6px) */
Object.assign(NG.block, { duelPace:[130,.7], duelStat:{ unit:'줄', get:() => ({ v:Math.min(G.bk.lines, G.bk.target), t:G.bk.target, mis:0 }) },
  duelHow:'같은 조각 순서 · 12줄을 먼저 지우면 1등!', duelKind:'race', duelMax:2,
  duelMini:{ w:56, h:56,
    get:() => { const g = G && G.bk && G.bk.g; return g ? Array.from(g, v => v.toString(16)).join('') : ''; },
    draw(el, st){
      const str = typeof st === 'string' ? st : (st && st.mv) || ''; if(!el) return;
      let cv = el.querySelector('canvas.bk-mini'); if(!cv){ cv = document.createElement('canvas'); cv.className = 'bk-mini'; cv.width = cv.height = 50; cv.style.width = cv.style.height = '50px'; el.appendChild(cv); }
      const x = cv.getContext('2d'), C = ['#2B2360','#F2434E','#FF8A1A','#FFCF1F','#3ACB50','#1CC6D6','#2F7DF2','#9A4BF0','#F54BA6','#8C86A6','#A9E6F7','#BFDDEA','#E6DEF7','#E0602E','#6FA033'];
      x.fillStyle = '#1B1550'; x.fillRect(0, 0, 50, 50);
      for(let i = 0; i < 64; i++){ const v = parseInt(str[i] || '0', 16) || 0; x.fillStyle = C[v] || C[1]; x.fillRect(1 + (i % 8) * 6, 1 + ((i / 8) | 0) * 6, 5, 5); }
    } } });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.block.scene = { kind:'shapes', colors:['#FFFFFF','#FFD24C','#62AEFF','#FF7A9E'], density:1.1, alpha:1.2 };
