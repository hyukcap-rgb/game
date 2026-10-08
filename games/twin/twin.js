/* 쌍둥이 찾기 */
/* ===== 쌍둥이 찾기 (twin) · 하루퍼즐 리그 순발력 게임 =====
   위·아래 둥근 카드 두 장에 그림이 흩어져 있고, 두 카드에 똑같은 그림이 딱 하나 있다. 그 그림을 찾아 누른다.
   한 판 = 카드 N장(문제 N개). 문제마다 판단 시간(창)이 있고, 틀리거나 시간이 지나면 기회 별 하나가 준다(기회 3개).
   맞히면 위 카드가 아래로 내려오고 새 카드가 위로 날아 들어온다(아래 카드 = 바로 전 위 카드).
   판단 포인트: 닮은꼴 함정(모양은 같고 색만 다른 가짜), 세 장 규칙의 "두 장에만 있는 그림".
   카드 내용·배치는 rng로만 만든다(같은 씨앗 = 같은 카드). 그림은 twin-art.js(TWIN_ART). */
NG.twin = (() => {
  const A = TWIN_ART;
  const GAP_OK = 380, GAP_BAD = 600;          /* 판정 뒤 다음 카드까지(판단 시간에 안 들어감). 오답은 0.5초 잠금 포함 */
  const BEST_KEY = 'hp:twin:best';            /* 내 최고 평균 판단 속도(초) */
  const HOSTS = ['owl', 'cat', 'rabbit', 'panda', 'fox'];
  const HOST_LOOK = {
    owl:{ ac:'#7B4FE0', rim:'#E9DDFF', hi:'두 카드에 똑같은 그림이 딱 하나!' },
    cat:{ ac:'#5266B8', rim:'#DCE5FA', hi:'냐옹, 쌍둥이를 찾아봐요' },
    rabbit:{ ac:'#E6457A', rim:'#FFE0EC', hi:'깡총! 같은 그림을 콕!' },
    panda:{ ac:'#22998F', rim:'#D6F2EB', hi:'천천히, 정확하게 찾아요' },
    fox:{ ac:'#E8711F', rim:'#FFE4C8', hi:'쌍둥이 성의 마지막 시험!' }
  };

  /* ===== 카드 만들기(rng만) ===== */
  /* 카드 안 자리 틀: c = 가운데 자리 여부, R = 둘레 반지름, s = 그림 반지름(카드 반지름 = 1) */
  const TPL = { 3:{ c:0, R:.44, s:.36 }, 4:{ c:0, R:.5, s:.33 }, 5:{ c:1, R:.6, s:.285 }, 6:{ c:1, R:.6, s:.27 }, 7:{ c:1, R:.61, s:.26 }, 8:{ c:1, R:.62, s:.245 } };
  const LIM = .9, SEP = .03;   /* 그림이 들어갈 카드 안쪽 한계, 그림끼리 최소 틈 */
  /* 크기(v1.1): 그림마다 그리는 반지름 r과 누르는 자리 반지름 b(= r과 HB 중 큰 값)가 따로 있다.
     배치는 b로 겹침을 막으므로 작은 그림도 자기만의 누르는 자리(가장 작은 카드에서 지름 40px 이상)를 가진다.
     RMIN = 그리는 반지름 바닥(가장 작은 카드에서 지름 약 28px), FILL = 누르는 자리 넓이 합 한계(카드 안쪽 대비) */
  const HB = { 2:.19, 3:.225 }, RMIN = { 2:.135, 3:.16 }, FILL = .56;
  const SZ_RMAX = .42;   /* 가장 큰 그림 반지름 */
  function fits(L){
    for(let i = 0; i < L.length; i++){
      const a = L[i], ba = a.b || a.r;
      if(Math.hypot(a.x, a.y) + ba > LIM + 1e-3) return false;
      for(let j = i + 1; j < L.length; j++) if(Math.hypot(a.x - L[j].x, a.y - L[j].y) < ba + (L[j].b || L[j].r) + SEP - 1e-3) return false;
    }
    return true;
  }
  /* 겹치면 밀어내기(rng 안 씀). 그래도 안 되면 큰 그림부터 조금씩 줄여 다시(누르는 자리는 HB 아래로 안 줄어듦) */
  function relax(L, hb, rmin, keep){
    const setB = l => { l.b = Math.max(l.r, hb); };
    L.forEach(setB);
    for(let round = 0; round < 16; round++){
      for(let it = 0; it < 120; it++){
        let moved = false;
        for(let i = 0; i < L.length; i++) for(let j = i + 1; j < L.length; j++){
          const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), need = a.b + b.b + SEP;
          if(d >= need) continue;
          const ux = d > 1e-6 ? dx / d : Math.cos(i + j * 2.3), uy = d > 1e-6 ? dy / d : Math.sin(i + j * 2.3), p = (need - d) / 2 + 1e-4;
          a.x -= ux * p; a.y -= uy * p; b.x += ux * p; b.y += uy * p; moved = true;
        }
        for(const l of L){ const d = Math.hypot(l.x, l.y); if(d + l.b > LIM){ const k = Math.max(0, LIM - l.b) / (d || 1); l.x *= k; l.y *= k; moved = true; } }
        if(!moved) break;
      }
      if(fits(L)) return L;
      L.forEach((l, j) => { if(!keep || !(j in keep) || round >= 10){ l.r = Math.max(rmin, l.r * .94); setB(l); } });
    }
    return L;
  }
  /* o = { spin, size, sz:[lo, hi], tilt, n:카드 수 }, want = { 자리: 반지름 } 정해 둔 크기(정답·닮은꼴 가짜) */
  function layout(k, rng, o, want){
    const T = TPL[k] || TPL[8], ring = T.c ? k - 1 : k, a0 = rng() * Math.PI * 2, pts = T.c ? [[0, 0]] : [];
    for(let i = 0; i < ring; i++){ const a = a0 + i * Math.PI * 2 / ring; pts.push([Math.cos(a) * T.R, Math.sin(a) * T.R]); }
    shuffle(pts, rng);
    const [lo, hi] = o.sz || [.93, 1.07], nc = o.n || 2, hb = HB[nc] || HB[2], rmin = RMIN[nc] || RMIN[2];
    const L = pts.map(([x, y]) => {
      const sc = lo + rng() * (hi - lo);
      const rot = o.spin ? rng() * 360 - 180 : (rng() - .5) * (o.tilt || 22);   /* 빙글: 제각각 돌아감 */
      return { x:x + (rng() - .5) * .07, y:y + (rng() - .5) * .07, r:T.s * sc, rot };
    });
    if(o.sq) L.forEach((l, j) => { if(!want || !(j in want)) l.r *= o.sq; });   /* 다시 만들 때: 다른 그림을 줄여 정해 둔 크기가 들어갈 자리를 만듦 */
    if(want) for(const j in want) L[j].r = want[j];
    L.forEach(l => { l.r = Math.min(SZ_RMAX, Math.max(rmin, l.r)); l.b = Math.max(l.r, hb); });
    /* 누르는 자리 넓이가 너무 크면 정해 두지 않은 그림부터 줄임(크기 차이는 유지) */
    const area = () => L.reduce((s, l) => s + l.b * l.b, 0), cap = FILL * LIM * LIM;
    for(let g = 0; g < 30 && area() > cap; g++) L.forEach((l, j) => { if(!want || !(j in want) || g > 12){ l.r = Math.max(rmin, l.r * .97); l.b = Math.max(l.r, hb); } });
    return relax(L, hb, rmin, want);
  }
  /* 같은 그림 = 같은 번호(id = 그림 번호×2 + 색 변형). id ^ 1 = 색만 다른 가짜
     크기 차이(v1.1): cfg.sz = [작게, 크게](그림 크기 배율 범위), cfg.gap = 공통 그림이 카드끼리 적어도 이만큼 다른 크기(큰 것/작은 것 ≥ 1 + gap),
     cfg.lure = 닮은꼴 가짜를 원래 그림과 거의 같은 크기로(크기로 짝을 맞추는 눈을 속임) */
  function gen(cfg, rng){
    const N = cfg.N, k = cfg.k, three = !!cfg.three, NS = A.N, nc = three ? 3 : 2;
    const lo = { spin:!!cfg.spin, sz:cfg.sz || (cfg.size ? [.62, 1.38] : null), tilt:cfg.tilt, n:nc };
    const gap = cfg.gap || 0, rmin = RMIN[nc], T = TPL[k] || TPL[8];
    const bases = () => shuffle([...Array(NS).keys()], rng);
    const vr = () => rng() < .5 ? 1 : 0;
    const card = (ids, want, sq) => ({ ids, L:layout(ids.length, rng, sq ? Object.assign({}, lo, { sq }) : lo, want) });
    const rOf = (cd, id) => cd.L[cd.ids.indexOf(id)].r;
    /* 크기 차이 고르기: 기준 반지름 r0에서 1+gap배 이상 크거나 작게(둘 다 되면 rng로) */
    const away = r0 => {
      const m = (1 + gap) * (1.03 + rng() * .17), up = r0 * m, dn = r0 / m, canUp = up <= SZ_RMAX * .97, canDn = dn >= rmin * 1.02;
      const pickUp = canUp && canDn ? rng() < .5 : canUp ? true : canDn ? false : up / SZ_RMAX < rmin / dn;
      return Math.min(SZ_RMAX * .97, Math.max(rmin * 1.02, pickUp ? up : dn));
    };
    const P = [];
    let prev = three ? null : card(bases().slice(0, k).map(b => b * 2 + vr())), prevAns = -1;
    for(let i = 0; i < N; i++){
      const f = N > 1 ? i / (N - 1) : 0;
      const W = cfg.w0 + (cfg.w1 - cfg.w0) * f;                           /* 뒤로 갈수록 창이 짧아짐 */
      const tp = cfg.trap ? Math.min(.9, cfg.trap * (.4 + 1.2 * f)) : 0;  /* 뒤로 갈수록 함정이 늘어남(평균 = trap) */
      const trap = tp > 0 && rng() < tp;
      let cards, ans;
      if(!three){
        /* 새 위 카드: 아래 카드(prev)의 그림 하나(바로 전 정답 제외)만 같고, 나머지는 아래 카드에 없는 그림 */
        const pb = new Set(prev.ids.map(id => id >> 1));
        ans = prev.ids.filter(id => id !== prevAns)[Math.floor(rng() * (prev.ids.length - (prevAns >= 0 ? 1 : 0)))];
        const ids = [ans], fakes = [];
        if(trap){   /* 닮은꼴 함정: 아래 카드 그림의 색만 다른 가짜(전 정답의 가짜도 될 수 있음) */
          const nT = k >= 7 && rng() < .35 ? 2 : 1;
          shuffle(prev.ids.filter(id => id !== ans), rng).slice(0, nT).forEach(id => { ids.push(id ^ 1); fakes.push(id); });
        }
        const pool = bases().filter(b => !pb.has(b));
        while(ids.length < k) ids.push(pool.shift() * 2 + vr());
        shuffle(ids, rng);
        const want = {}, ja = ids.indexOf(ans), r0 = rOf(prev, ans);
        if(gap > 0) want[ja] = away(r0);
        if(cfg.lure) fakes.forEach(o => { want[ids.indexOf(o ^ 1)] = rOf(prev, o) * (.94 + rng() * .12); });
        let top = card(ids, Object.keys(want).length ? want : null);
        /* 자리가 모자라 줄어들어 크기 차이가 모자라면: 정답 그림을 작게 하는 쪽으로 다시(작게는 늘 됨) */
        for(let t = 0; t < 6 && gap > 0 && Math.max(r0 / rOf(top, ans), rOf(top, ans) / r0) < 1 + gap; t++){
          const dn = r0 / ((1 + gap) * (1.04 + .04 * t)), up = dn < rmin;   /* 작게가 안 되면 크게 + 다른 그림 줄이기 */
          want[ja] = up ? Math.min(SZ_RMAX * .97, r0 * (1 + gap) * (1.06 + .04 * t)) : dn;
          top = card(ids, up && t ? { [ja]:want[ja] } : want, up && t ? Math.pow(.9, t) : 0);   /* 크게 할 땐 닮은꼴 가짜 크기 맞춤은 포기 */
        }
        cards = [top, prev]; prev = top; prevAns = ans;
      } else {
        /* 세 장: 세 장 모두에 있는 그림 1개 + 두 장에만 있는 가짜 1~3개 + (함정) 색만 다른 가짜 */
        const bs = bases(); let q = 0;
        ans = bs[q++] * 2 + vr();
        const sets = [[ans], [ans], [ans]], pairs = shuffle([[0, 1], [1, 2], [0, 2]], rng);
        const nd = k >= 6 && rng() < .3 ? 3 : 1 + (rng() < .5 ? 1 : 0);
        for(let d = 0; d < nd; d++){ const id = bs[q++] * 2 + vr(); sets[pairs[d][0]].push(id); sets[pairs[d][1]].push(id); }
        if(trap){
          const nT = 1 + (k >= 6 && rng() < .35 ? 1 : 0);
          for(let t = 0; t < nT; t++){
            const x = Math.floor(rng() * 3), y = (x + 1 + Math.floor(rng() * 2)) % 3, id = bs[q++] * 2 + vr();
            if(sets[x].length < k && sets[y].length < k){ sets[x].push(id); sets[y].push(id ^ 1); }
          }
        }
        sets.forEach(s => { while(s.length < k) s.push(bs[q++] * 2 + vr()); shuffle(s, rng); });
        /* 공통 그림 크기: 작게·중간·크게를 세 장에 나눠(가장 큰 것/가장 작은 것 ≥ 1 + gap) */
        let rs = null;
        if(gap > 0){
          const sz = lo.sz || [.93, 1.07], m = (1 + gap) * (1.03 + rng() * .17);
          let a = T.s * (sz[0] + rng() * (sz[1] - sz[0])) / Math.sqrt(m), b = a * m;
          if(a < rmin * 1.02){ a = rmin * 1.02; b = a * m; }
          if(b > SZ_RMAX * .97){ b = SZ_RMAX * .97; a = Math.max(rmin * 1.02, b / m); }
          rs = shuffle([a, b, a + (b - a) * (.3 + rng() * .4)], rng);
        }
        cards = sets.map((s, ci) => card(s, rs ? { [s.indexOf(ans)]:rs[ci] } : null));
        for(let t = 0; t < 6 && gap > 0; t++){   /* 줄어들어 크기 차이가 모자라면 가장 작은 쪽을 더 작게(안 되면 가장 큰 쪽을 더 크게) */
          const ar = cards.map(c => rOf(c, ans)), mx = Math.max(...ar), mn = Math.min(...ar);
          if(mx / mn >= 1 + gap) break;
          let ci = ar.indexOf(mn), r = mx / ((1 + gap) * (1.04 + .04 * t)), up = r < rmin;
          if(up){ ci = ar.indexOf(mx); r = Math.min(SZ_RMAX * .97, mn * (1 + gap) * (1.06 + .04 * t)); }
          cards[ci] = card(sets[ci], { [sets[ci].indexOf(ans)]:r }, up && t ? Math.pow(.9, t) : 0);
        }
      }
      P.push({ cards, ans, W, trap });
    }
    return P;
  }
  /* 점검: 문제마다 모든 카드에 공통인 그림이 정확히 하나(= ans), 그림끼리(누르는 자리까지) 안 겹침,
     그리는 크기·누르는 자리 바닥, 크기 차이(cfg.gap)까지 지킴 → ''이면 통과 */
  function ansRatio(p){ const rs = p.cards.map(c => c.L[c.ids.indexOf(p.ans)].r); return Math.max(...rs) / Math.min(...rs); }
  function check(P, cfg){
    for(const p of P){
      const nc = p.cards.length, sets = p.cards.map(c => new Set(c.ids)), com = [...sets[0]].filter(id => sets.every(s => s.has(id)));
      if(com.length !== 1 || com[0] !== p.ans) return 'common';
      for(const c of p.cards){
        if(new Set(c.ids.map(id => id >> 1)).size !== c.ids.length) return 'dup';
        if(!fits(c.L)) return 'overlap';
        if(c.L.some(l => l.r < RMIN[nc] - 1e-6 || l.b < HB[nc] - 1e-6 || l.b < l.r - 1e-9)) return 'min';
      }
      if(nc === 2){ const b0 = new Set(p.cards[1].ids.map(id => id >> 1)); const sh = p.cards[0].ids.filter(id => b0.has(id >> 1)); if(!p.trap && sh.length !== 1) return 'look'; }
      if(cfg && cfg.gap && ansRatio(p) < 1 + cfg.gap - 1e-3) return 'gap';
    }
    return '';
  }

  /* ===== 여럿 대전 카드(2~5명, 2026-10-08 사용자 지시) =====
     가운데 카드 1장(모두 같음) + 자리마다 내 카드 1장(사람마다 다름). 가운데 카드와 모든 사람의 카드에 똑같은 그림이 딱 하나 있고,
     그 그림(ans)은 모든 사람에게 같다. 자리 0~4 카드를 늘 다 만든다(인원과 상관없이 같은 씨앗 = 같은 카드, 컴퓨터 자리 포함).
     cfg = { R:판 수, k:그림 수, W:판마다 시간(초), sz, gap, lure, trap } */
  const PSEATS = 5;
  function genParty(cfg, rng){
    const R = cfg.R, k = cfg.k, NS = A.N, gap = cfg.gap || 0, rmin = RMIN[2];
    const lo = { sz:cfg.sz || null, tilt:cfg.tilt, n:2 };
    const vr = () => rng() < .5 ? 1 : 0;
    const card = (ids, want, sq) => ({ ids, L:layout(ids.length, rng, sq ? Object.assign({}, lo, { sq }) : lo, want) });
    const rOf = (cd, id) => cd.L[cd.ids.indexOf(id)].r;
    const away = r0 => {
      const m = (1 + gap) * (1.03 + rng() * .17), up = r0 * m, dn = r0 / m, canUp = up <= SZ_RMAX * .97, canDn = dn >= rmin * 1.02;
      const pickUp = canUp && canDn ? rng() < .5 : canUp ? true : canDn ? false : up / SZ_RMAX < rmin / dn;
      return Math.min(SZ_RMAX * .97, Math.max(rmin * 1.02, pickUp ? up : dn));
    };
    const P = []; let prevX = -1;
    for(let i = 0; i < R; i++){
      const f = R > 1 ? i / (R - 1) : 0;
      const tp = cfg.trap ? Math.min(.9, cfg.trap * (.4 + 1.2 * f)) : 0;
      const bs = shuffle([...Array(NS).keys()], rng);
      if(bs[0] === prevX){ const t = bs[0]; bs[0] = bs[1]; bs[1] = t; }   /* 바로 전 판과 다른 쌍둥이 그림 */
      prevX = bs[0];
      const ans = bs[0] * 2 + vr(), cIds = [ans];
      for(let q = 1; q < k; q++) cIds.push(bs[q] * 2 + vr());
      shuffle(cIds, rng);
      const center = card(cIds), r0 = rOf(center, ans), pool = bs.slice(k), seats = [], traps = [], seen = new Set();
      for(let s = 0; s < PSEATS; s++){
        let best = null;
        for(let t = 0; t < 6; t++){   /* 앞 자리와 똑같은 그림 묶음이면 다시(사람마다 다른 카드) */
          const trap = tp > 0 && rng() < tp, ids = [ans], fakes = [];
          if(trap){ const o = shuffle(cIds.filter(id => id !== ans), rng)[0]; ids.push(o ^ 1); fakes.push(o); }
          const pl = shuffle(pool.slice(), rng);
          while(ids.length < k) ids.push(pl.shift() * 2 + vr());
          shuffle(ids, rng);
          const sig = ids.slice().sort((a, b) => a - b).join(',');
          best = { ids, fakes, trap, sig };
          if(!seen.has(sig)) break;
        }
        seen.add(best.sig);
        const ids = best.ids, want = {}, ja = ids.indexOf(ans);
        if(gap > 0) want[ja] = away(r0);
        if(cfg.lure) best.fakes.forEach(o => { want[ids.indexOf(o ^ 1)] = rOf(center, o) * (.94 + rng() * .12); });
        let cd = card(ids, Object.keys(want).length ? want : null);
        for(let t = 0; t < 6 && gap > 0 && Math.max(r0 / rOf(cd, ans), rOf(cd, ans) / r0) < 1 + gap; t++){
          const dn = r0 / ((1 + gap) * (1.04 + .04 * t)), up = dn < rmin;
          want[ja] = up ? Math.min(SZ_RMAX * .97, r0 * (1 + gap) * (1.06 + .04 * t)) : dn;
          cd = card(ids, up && t ? { [ja]:want[ja] } : want, up && t ? Math.pow(.9, t) : 0);
        }
        seats.push(cd); traps.push(best.trap);
      }
      P.push({ center, seats, ans, W:cfg.W || 12, traps });
    }
    return P;
  }
  /* 여럿 대전 카드 점검: 자리마다 가운데 카드와 겹치는 그림이 정확히 하나(= ans, 함정이 아니면 모양까지 하나), 자리 카드끼리 모두 다름,
     겹침·크기 바닥·크기 차이 → ''이면 통과 */
  function checkParty(P, cfg){
    const nc = 2;
    for(const p of P){
      const cs = new Set(p.center.ids), cb = new Set(p.center.ids.map(id => id >> 1)), sigs = new Set();
      for(const c of [p.center].concat(p.seats)){
        if(new Set(c.ids.map(id => id >> 1)).size !== c.ids.length) return 'dup';
        if(!fits(c.L)) return 'overlap';
        if(c.L.some(l => l.r < RMIN[nc] - 1e-6 || l.b < HB[nc] - 1e-6 || l.b < l.r - 1e-9)) return 'min';
      }
      for(let s = 0; s < p.seats.length; s++){
        const c = p.seats[s], com = c.ids.filter(id => cs.has(id));
        if(com.length !== 1 || com[0] !== p.ans) return 'common';
        const sh = c.ids.filter(id => cb.has(id >> 1));
        if(!p.traps[s] && sh.length !== 1) return 'look';
        const sig = c.ids.slice().sort((a, b) => a - b).join(','); if(sigs.has(sig)) return 'same'; sigs.add(sig);
        if(cfg && cfg.gap){ const a = p.center.L[p.center.ids.indexOf(p.ans)].r, b = c.L[c.ids.indexOf(p.ans)].r; if(Math.max(a / b, b / a) < 1 + cfg.gap - 1e-3) return 'gap'; }
      }
    }
    return '';
  }

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['spin', 'size', 'look', 'three'],
    info:{
      spin:{ name:'빙글', desc:'그림들이 제각각 빙글 돌아가 있어요. 방향이 달라도 같은 그림이면 정답이에요.' },
      size:{ name:'크고 작게', desc:'그림 크기가 제각각이에요. 크기가 달라도 같은 그림이면 정답이에요.' },
      look:{ name:'닮은꼴', desc:'모양은 같은데 색만 다른 가짜가 섞여 있어요. 색까지 똑같아야 진짜 쌍둥이예요!' },
      three:{ name:'세 장', desc:'카드가 세 장이에요. 세 장 모두에 있는 그림 하나를 찾아요. 두 장에만 있는 그림은 가짜!' }
    },
    twists:['flash', 'blink', 'tight'],
    twInfo:{
      flash:{ name:'빠른 판', desc:'판단 시간이 짧아요. 침착하게, 그래도 빠르게!' },
      blink:{ name:'깜빡', desc:'카드가 0.6초 보였다가 0.3초 덮여요. 보이는 동안 눈에 담아 두세요.' },
      tight:{ name:'외줄 타기', desc:'실수는 딱 한 번까지! 두 번 틀리면 끝나요.' }
    }
  };
  const RULE_TIP = { spin:'돌아가 있어도 같은 그림', size:'크기가 달라도 같은 그림', look:'색까지 같아야 진짜', three:'세 장 모두에 있는 그림', flash:'시간이 짧아요', blink:'덮여도 기억해요', tight:'두 번 틀리면 끝' };

  /* ----- 솔로 난이도 표 -----
     카드 수 = 12 + 2×(챕터−1) + KOFF[k] (최대 32, 보스 +6) · 그림 수 = 4→8(세 장은 6까지)
     판단 창 = 6.2초 × 0.94^(챕터−1) × 그림 수 배율 × 자리·규칙·변주 배수, 시작 최소 2.6초·끝 최소 2.2초(그림 찾기라 다른 순발력 게임보다 바닥이 높다)
     함정(닮은꼴) = 닮은꼴 규칙이 켜진 판만: 0.1 + 0.075×(챕터−1), 보스 +0.1, 최대 0.5 */
  const KOFF = [0, 0, 1, 2, 3, 4, 1, 4, 5, 2, 6];
  const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
  /* 크기 차이 곡선(솔로): 퍼짐 sp = 0.08 + 0.07×(챕터−1) + 0.008×(k−1), 쉬운 자리 −0.03, 최대 0.42 → 크기 범위 1±sp
     공통 그림 크기 차이 gap = (sp − 0.1)×1.1 (sp 0.15 미만이면 0). 크고 작게 규칙 판은 0.45~1.6배 · gap 0.6 · 기울기 ±40°(빙글과 섞임) */
  function sizeOf(c, k, easy, has){
    if(has('size')) return { sz:[.45, 1.6], gap:.6, tilt:has('spin') ? 0 : 80 };
    const sp = Math.min(.42, .08 + .07 * (c - 1) + .008 * (k - 1) - (easy ? .03 : 0));
    return { sz:[r2(1 - sp), r2(1 + sp)], gap:sp >= .15 ? r2((sp - .1) * 1.1) : 0, tilt:0 };
  }
  function stageCfg(n){
    const p = planOf('twin', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x), three = has('three');
    const N = Math.min(32, 12 + 2 * (Math.min(c, 11) - 1) + KOFF[k]);
    let sym = Math.max(4, Math.min(8, 3 + Math.min(c, 5) + (k >= 4 ? 1 : 0) - (p.easy ? 1 : 0)));
    if(three) sym = Math.min(sym, 6);
    const S = sizeOf(c, k, p.easy, has);
    let w = 6.2 * Math.pow(.94, c - 1) * (.55 + .075 * sym) * (1 + .35 * S.gap);   /* 크기 차이가 클수록 찾는 시간을 더 줌 */
    if(k === 5) w *= .9; if(p.boss) w *= .85; if(k === 9) w *= 1.15; if(k === 1 || k === 6) w *= 1.08;
    if(has('spin')) w *= 1.08; if(has('look')) w *= 1.1; if(three) w *= 1.35;
    if(tw === 'flash') w *= .75;
    const trap = has('look') ? Math.min(.5, .1 + .075 * (c - 1) + (p.boss ? .1 : 0)) : 0;
    return { N, k:sym, w0:r1(Math.max(2.6, w)), w1:r1(Math.max(2.2, w * .75)), trap, lives:tw === 'tight' ? 2 : 3,
      spin:has('spin'), size:has('size'), look:has('look'), three, blink:tw === 'blink', sz:S.sz, gap:S.gap, tilt:S.tilt || undefined, lure:has('look'),
      boss:p.boss, hard:p.hard, mj:mj.slice(), tw, host:HOSTS[(c - 1) % HOSTS.length], limit:0, n };
  }

  /* ===== 그림 굽기: SVG(조명 필터) → PNG 한 번(폰 성능) ===== */
  const IMG = {}, BAKED = {};
  const img = id => IMG[id] || A.src(id >> 1, id & 1, true);
  let bakeQ = [], bakeOn = false;
  function bake(ids, px){
    ids.forEach(id => { if((BAKED[id] || 0) < px && !bakeQ.some(q => q[0] === id)) bakeQ.push([id, px]); });
    if(bakeOn) return; bakeOn = true;
    const step = () => {
      const job = bakeQ.shift(); if(!job){ bakeOn = false; return; }
      const [id, sz] = job, im = new Image();
      const done = () => setTimeout(step, 0);
      im.onload = () => {
        try{
          const c = document.createElement('canvas'); c.width = c.height = sz; c.getContext('2d').drawImage(im, 0, 0, sz, sz);
          c.toBlob(b => { try{ if(b){ IMG[id] = URL.createObjectURL(b); BAKED[id] = sz; } }catch(_){} done(); }, 'image/png');
        }catch(_){ done(); }
      };
      im.onerror = done;
      im.src = A.src(id >> 1, id & 1, true);
    };
    step();
  }

  /* ===== 화면·조작 ===== */
  const S = () => G.m;
  const now = () => elapsed() * 1000;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) try{ fn(); }catch(_){} }, ms); m.timers.add(id); return id; };
  const pct = v => (v * 100).toFixed(2) + '%';
  const ICO = {
    card:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="7" fill="#FFF3DC" stroke="#1A0F45" stroke-width="1.8"/><circle cx="15" cy="12" r="7" fill="#F5DDFF" stroke="#1A0F45" stroke-width="1.8"/><path d="M12 8.2l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="#FFC21A" stroke="#1A0F45" stroke-width="1" stroke-linejoin="round"/></svg>',
    combo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.3 2c.6 3.4 2.6 5.2 4.3 7 1.6 1.7 3 3.6 3 6.3A7.5 7.5 0 0 1 12 22.6a7.5 7.5 0 0 1-7.6-7.3c0-2.6 1.3-4.7 3-6.3.2 1.8 1 3.1 2.4 3.9-.3-3.9.6-7.9 2.5-11.2z" fill="#FF8A3D" stroke="#1A0F45" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 22.6a3.5 3.5 0 0 1-3.5-3.5c0-2 1.8-3.2 2.6-5.2.9 1.4 4.4 2.7 4.4 5.2a3.5 3.5 0 0 1-3.5 3.5z" fill="#FFE27A"/></svg>'
  };
  const COVER = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const X_MARK = '<svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M-7-7L7 7M7-7L-7 7" stroke="#1A0F45" stroke-width="6.4" stroke-linecap="round"/><path d="M-7-7L7 7M7-7L-7 7" stroke="#FF4D6D" stroke-width="3.4" stroke-linecap="round"/></svg>';
  const CHECK = '<svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="#2BB673" stroke="#1A0F45" stroke-width="2"/><path d="M-5.5 0l3.8 3.8L5.8-4" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const reduce = () => { try{ return FXR.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; } };

  function say(html, cls){ const e = $('#twSay'); if(!e) return; e.className = 'tw-say ' + (cls || ''); e.innerHTML = html; }
  /* 말풍선 기본 문구: 규칙 알림이 짧으면 둘을 같이, 길면 카드마다 번갈아(말풍선이 잘리지 않게) */
  function sayIdle(){
    const m = S(); if(!m || m.phase === 'done') return;
    const n = Math.max(0, m.i), tip = !m.tips.length ? '' : m.tips.slice(0, 2).join(' · ').length <= 16 ? m.tips.slice(0, 2).join(' · ') : m.tips[n % m.tips.length];
    say(m.boss ? '<b class="boss">대장 판</b><span>' + (tip || '끝까지 침착하게!') + '</span>' : '<span>' + (tip || m.H.hi) + '</span>');
  }
  function hostMood(mood, ms){
    const m = S(), im = $('#twHostImg'); if(!m || !im) return;
    im.src = toySrc(m.host, mood); im.classList.remove('bop'); void im.offsetWidth; if(mood) im.classList.add('bop');
    if(m.moodT) clearTimeout(m.moodT);
    if(mood && ms) m.moodT = T(() => { const e = $('#twHostImg'); if(e) e.src = toySrc(m.host, ''); }, ms);
  }
  function hud(){
    const m = S(); if(!m) return;
    const p = $('#twProg'); if(p) p.textContent = m.done;
    const c = $('#twCombo'); if(c) c.textContent = m.combo;
    const mi = $('#twMine'); if(mi) mi.textContent = m.party ? ptMine() : 0;
    const lv = $('#twLives');
    if(lv){ lv.innerHTML = '기회 ' + Array.from({ length:m.maxLives }, (_, n) => `<i${n >= m.lives ? ' class="off"' : ''}>★</i>`).join(''); lv.classList.toggle('last', m.lives === 1); lv.setAttribute('aria-label', '남은 기회 ' + m.lives + '번'); }
  }

  /* 카드 크기: 화면 높이에 맞춰(스크롤 없이) */
  function layoutCards(trim){
    const m = S(), tb = $('#twTable'), root = document.querySelector('.ng-twin'); if(!m || !tb || !root) return;
    const gap = m.three ? 8 : 14, W = Math.min(tb.clientWidth || root.clientWidth || 360, 460);
    const top = tb.getBoundingClientRect().top + (window.scrollY || 0);
    const avail = Math.max(260, (innerHeight || 740) - top - 10 - (trim || 0));
    let d, pos;
    if(!m.three){
      /* 두 장: 위아래로 쌓기. 폭이 남고 높이가 모자란 화면(360×740 등)은 비스듬히 놓아 카드를 더 크게 */
      d = Math.floor(Math.max(150, Math.min(W - 6, (avail - gap - 6) / 2, 400)));
      let zx = 0, zy = d + gap;
      for(let t = Math.min(W - 6, 400); t >= d * 1.06; t -= 2){
        const x = Math.min(W - 6 - t, t + gap), y = Math.sqrt(Math.max(0, (t + gap) * (t + gap) - x * x));
        if(t + y + 6 <= avail){ d = Math.floor(t); zx = x; zy = y; break; }
      }
      pos = [0, 1].map(ci => ({ x:W / 2 + (ci ? zx / 2 : -zx / 2), y:d / 2 + ci * zy }));
      m.H2 = d + zy + 6;
    } else {
      /* 세 장: 지그재그(왼·오·왼)로 놓아 세로로 쌓을 때보다 카드를 크게 */
      d = 150; let dx = 0, dy = d + gap;
      for(let t = Math.min(W - 6, 400); t >= 150; t -= 2){
        const x = Math.min(W - 6 - t, t + gap), y = Math.sqrt(Math.max(0, (t + gap) * (t + gap) - x * x));
        if(t + 2 * y + 6 <= avail){ d = t; dx = x; dy = y; break; }
      }
      pos = [0, 1, 2].map(ci => ({ x:W / 2 + (ci % 2 ? dx / 2 : -dx / 2), y:d / 2 + ci * dy }));
      m.H2 = d + 2 * dy + 6;
    }
    tb.style.setProperty('--d', d + 'px'); tb.style.setProperty('--gap', gap + 'px'); tb.style.height = m.H2 + 'px';
    m.D = d; m.pos = pos; m.gap = gap;
    tb.querySelectorAll('.tw-card').forEach(c => { const p = pos[+c.dataset.ci] || pos[1]; c.style.left = (p.x - d / 2) + 'px'; c.style.top = (p.y - d / 2) + 'px'; });
    /* 판 아래 여백(화면 틀의 아래 padding 등)까지 한 화면에: 넘치면 그만큼 줄여 한 번 더 */
    if((trim || 0) < 120){ try{ const over = document.documentElement.scrollHeight - innerHeight; if(over > 0){ layoutCards((trim || 0) + over + 2); return; } }catch(_){} }
    try{ bake(m.need, Math.max(96, Math.min(256, Math.round(d * .4 * Math.min(2.5, devicePixelRatio || 1))))); }catch(_){}
  }

  function cardHtml(cd, ci, cls, delay, sty, lab){
    const syms = cd.ids.map((id, j) => { const l = cd.L[j];
      return `<span class="tw-s" data-j="${j}" style="left:${pct((1 + l.x) / 2)};top:${pct((1 + l.y) / 2)};width:${(l.r * 122).toFixed(2)}%;--rot:${l.rot.toFixed(1)}deg"><img src="${img(id)}" alt="${A.S[id >> 1].name}" draggable="false"></span>`; }).join('');
    const m = S(), p = (m.pos && (m.pos[ci] || m.pos[1])) || { x:0, y:0 }, d = m.D || 0;
    return `<div class="tw-card ${cls || ''}" data-ci="${ci}" role="group" aria-label="${ci + 1}번째 카드" style="left:${(p.x - d / 2).toFixed(1)}px;top:${(p.y - d / 2).toFixed(1)}px${delay ? `;animation-delay:${delay}ms` : ''}${sty ? ';' + sty : ''}"><div class="tw-face">${syms}</div><div class="tw-cover" aria-hidden="true">${COVER}</div>${lab || ''}</div>`;
  }
  function drawCards(i){
    const m = S(), tb = $('#twTable'); if(!tb) return;
    const cur = m.P[i], cs = cur.cards;
    if(!m.three && i > 0){
      /* 위 카드가 아래로 내려오고(같은 카드), 새 카드가 위로 날아 들어옴. 예전 아래 카드는 빠져나감 */
      const old = m.P[i - 1].cards[1], p0 = m.pos[0], p1 = m.pos[1];
      tb.innerHTML = cardHtml(old, 9, 'ghost') + cardHtml(cs[1], 1, 'drop', 0, `--fx:${(p0.x - p1.x).toFixed(1)}px;--fy:${(p0.y - p1.y).toFixed(1)}px`) + cardHtml(cs[0], 0, 'in', 70);
    } else tb.innerHTML = cs.map((c, ci) => cardHtml(c, ci, 'in', ci * 60)).join('');
    tb.classList.remove('solved', 'covered', 'slow');
    T(() => { const g = tb.querySelector('.ghost'); if(g) g.remove(); }, 340);
  }
  function symEl(ci, j){ return document.querySelector(`.ng-twin .tw-card[data-ci="${ci}"] .tw-s[data-j="${j}"]`); }
  /* 카드 자리(움직임 효과와 상관없는 제자리): 판정은 늘 이 자리로 → 느린 폰에서 날아오는 효과가 밀려도 엉뚱한 카드가 눌리지 않음 */
  function slot(ci){
    const m = S(), tb = $('#twTable'); if(!tb || !m.D || !m.pos || !m.pos[ci]) return null;
    const r = tb.getBoundingClientRect();
    return { x:r.left + m.pos[ci].x, y:r.top + m.pos[ci].y, R:m.D / 2 };
  }
  function symCenter(ci, j){
    const m = S(), s = slot(ci); if(!s) return null;
    const l = m.cur.cards[ci].L[j];
    return { x:s.x + l.x * s.R, y:s.y + l.y * s.R, r:l.r * s.R };
  }
  function mark(ci, j, cls, html){
    const card = document.querySelector(`.ng-twin .tw-card[data-ci="${ci}"] .tw-face`), l = S().cur.cards[ci].L[j]; if(!card) return;
    card.insertAdjacentHTML('beforeend', `<span class="tw-mk ${cls}" style="left:${pct((1 + l.x) / 2)};top:${pct((1 + l.y) / 2)};width:${(l.r * 2.3 * 50).toFixed(2)}%">${html || ''}</span>`);
  }
  /* 쌍둥이 실: 짝지은 그림들을 카드 너머로 잇는 부드러운 곡선(보이기만). cls = 'ok'(정답) | 'ans'(가르쳐 주기) */
  function thread(cls){
    const m = S(), tb = $('#twTable'); if(!tb || !m.pos) return;
    const R = m.D / 2, pts = ansSpots().map(([ci, j]) => { const l = m.cur.cards[ci].L[j], p = m.pos[ci]; return [p.x + l.x * R, p.y + l.y * R, l.r * R * .92]; }).sort((a, b) => a[1] - b[1]);
    const f = v => v.toFixed(1), toward = (a, c) => { const dx = c[0] - a[0], dy = c[1] - a[1], n = Math.hypot(dx, dy) || 1; return [a[0] + dx / n * a[2], a[1] + dy / n * a[2]]; };
    let d = '', dots = '';
    for(let k = 1; k < pts.length; k++){
      /* 그림 가장자리에서 가장자리까지 살짝 휜 실(가운데를 가리지 않게) */
      const a = pts[k - 1], b = pts[k], dx = b[0] - a[0], dy = b[1] - a[1], bend = (k % 2 ? 1 : -1) * .2;
      const c = [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend], a2 = toward(a, c), b2 = toward(b, c);
      d += `M${f(a2[0])} ${f(a2[1])} Q${f(c[0])} ${f(c[1])} ${f(b2[0])} ${f(b2[1])} `;
      dots += `<circle cx="${f(a2[0])}" cy="${f(a2[1])}" r="4.2"/><circle cx="${f(b2[0])}" cy="${f(b2[1])}" r="4.2"/>`;
    }
    tb.insertAdjacentHTML('beforeend', `<svg class="tw-thread ${cls}" aria-hidden="true" width="100%" height="100%"><path class="u" d="${d}"/><path class="t" d="${d}"/><g>${dots}</g></svg>`);
  }
  /* 정답 그림 자리(모든 카드) */
  const ansSpots = () => { const m = S(), a = m.cur.ans; return m.cur.cards.map((c, ci) => [ci, c.ids.indexOf(a)]); };

  function onDown(e){
    const m = S();
    if(!m || G.over || G.paused || m.phase === 'done' || m.phase === 'deal') return;
    if(e.cancelable) e.preventDefault();
    /* 막 누르기 막기: 0.25초 안에 3번 넘게 누르면 "천천히!" + 0.5초 잠금(벌점 없음) */
    const pn = performance.now(); m.taps = m.taps.filter(t => pn - t < 250); m.taps.push(pn);
    if(m.taps.length > 3){ slow(); return; }
    if(m.phase !== 'show' || m.cover) return;
    if(now() < m.lockUntil) return;
    if(m.party && Date.now() < m.pt.lockUntil) return;
    let hit = null, bd = 1e9;
    m.cur.cards.forEach((cd, ci) => {
      const s = slot(ci); if(!s || Math.hypot(e.clientX - s.x, e.clientY - s.y) > s.R + 6) return;
      cd.L.forEach((l, j) => {
        /* 누르는 자리 = 배치 때 겹치지 않게 잡아 둔 반지름 b(작은 그림도 가장 작은 카드에서 지름 40px 이상), 바닥 20px */
        const d = Math.hypot(e.clientX - (s.x + l.x * s.R), e.clientY - (s.y + l.y * s.R)), lim = Math.max((l.b || l.r) * s.R * 1.05, 20);
        if(d <= lim && d / lim < bd){ bd = d / lim; hit = [ci, j]; }
      });
    });
    if(!hit) return;   /* 카드 빈 곳: 아무 일 없음 */
    if(m.party){ ptJudge(hit[0], hit[1]); return; }
    judge(hit[0], hit[1]);
  }
  function slow(){
    const m = S(), t = now(); if(t < m.slowUntil) return;
    m.slowUntil = t + 500; m.lockUntil = Math.max(m.lockUntil, t + 500);
    say('<b class="warn">천천히!</b><span>잠깐 멈춰요</span>', 'pop');
    const tb = $('#twTable'); if(tb){ tb.classList.add('slow'); T(() => { const e = $('#twTable'); if(e) e.classList.remove('slow'); }, 500); }
    sfx('twinSlow'); fxBuzz(20);
    T(() => { if(S().phase === 'show') sayIdle(); }, 900);
  }

  const OK_WORDS = ['찾았다!', '쌍둥이!', '딩동!', '맞아요!'];
  function judge(ci, j){
    const m = S(), cur = m.cur, id = cur.cards[ci].ids[j], t = now() - m.t0;
    m.phase = 'judged'; m.done++;
    if(id === cur.ans){
      const ratio = Math.max(0, Math.min(1, 1 - t / m.W));
      m.correct++; m.speedSum += ratio; m.tSum += t; m.combo++; m.bestCombo = Math.max(m.bestCombo, m.combo);
      m.nextAt = now() + GAP_OK;
      okFx(ci, j, Math.round((500 + 350 * ratio) / m.N));
    } else {
      m.nextAt = now() + GAP_BAD;
      badFx(ci, j, id);
      loseLife();
    }
    hud();
  }
  function timeout(){
    const m = S(); m.phase = 'judged'; m.done++; m.nextAt = now() + GAP_BAD;
    badFx(-1, -1, -1);
    loseLife(); hud();
  }
  function loseLife(){
    const m = S(); m.lives--; m.wrong++; m.combo = 0; G.paws = Math.max(0, m.lives);
    hud();
    try{
      const h = document.querySelectorAll('.ng-twin .hlives i')[m.lives];
      if(h){ h.classList.add('lost'); if(!reduce()){ const q = fxCenter(h); fxEmit(q.x, q.y, { quantity:10, speed:{ min:60, max:200 }, lifespan:{ min:350, max:650 }, kind:'dot', tint:['#FFB020', '#FFE27A', '#FFFFFF'], scale:{ start:4, end:0 }, gravityY:300 }); } }
    }catch(_){}
    if(m.lives <= 0) lose();
  }
  function okFx(ci, j, pts){
    const m = S(), tb = $('#twTable');
    sfx('twinOk', { n:m.combo }); fxBuzz(12);
    try{
      if(tb) tb.classList.add('solved');
      ansSpots().forEach(([c, k]) => {
        const e = symEl(c, k); if(e) e.classList.add('hit');
        mark(c, k, 'ok');
        const q = symCenter(c, k);
        if(q && !reduce()){
          fxEmit(q.x, q.y, { quantity:c === ci ? 11 : 7, speed:{ min:50, max:180 }, lifespan:{ min:380, max:700 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2B0', '#C9F7DE'], scale:{ start:5, end:0, ease:'quad.in' }, drag:1.5, glow:true });
          fxRing(q.x, q.y, '#7BE3AE', q.r * 1.7, .4, 5);
        }
      });
      thread('ok');
      mark(ci, j, 'chk', CHECK);
      const q = symCenter(ci, j); if(q) fxFloat(q.x, q.y - q.r - 6, '+' + pts);
    }catch(_){}
    hostMood('joy', 650);
    const milestone = { 5:'좋아요!', 10:'대단해요!', 20:'완벽해요!' }[m.combo] || (m.combo > 20 && m.combo % 10 === 0 ? '완벽해요!' : '');
    if(milestone){
      say(`<b class="combo">${milestone}</b><span>연속 ${m.combo}번</span>`, 'pop');
      sfx('twinCombo', { n:m.combo });
      try{ fxPunch($('#twComboP'), 1.18); fxPunch(tb, 1.025); const p = fxCenter($('#twComboP')); if(!reduce()) fxEmit(p.x, p.y, { quantity:16, speed:{ min:80, max:260 }, lifespan:{ min:500, max:900 }, kind:'star', tint:['#FFE27A', '#FF9BCB', '#9FE7FF', '#FFFFFF'], scale:{ start:6, end:0 }, gravityY:260 }); }catch(_){}
      T(() => { if(S().phase !== 'done') sayIdle(); }, 1400);
    } else {
      say(`<b class="ok">${OK_WORDS[m.done % OK_WORDS.length]}</b>`, 'pop');
      T(() => { if(S().phase !== 'done' && !m.sayHold) sayIdle(); }, 700);
    }
  }
  function badFx(ci, j, id){
    const m = S(), cur = m.cur;
    sfx(ci < 0 ? 'twinLate' : 'twinBad'); fxBuzz(ci < 0 ? [20, 30, 20] : 30);
    let why = ci < 0 ? '시간이 지났어요' : '앗, 아니에요';
    if(ci >= 0){
      const others = cur.cards.filter((_, c) => c !== ci);
      if(others.some(c => c.ids.includes(id ^ 1))) why = '색이 다른 가짜!';
      else if(m.three && others.some(c => c.ids.includes(id))) why = '두 장에만 있어요';
    }
    say(`<b class="bad">${why}</b><span>점선이 정답</span>`, 'pop');
    T(() => { if(S().phase !== 'done') sayIdle(); }, 1300);
    hostMood('sad', 800);
    try{
      if(ci >= 0){ const e = symEl(ci, j); if(e) e.classList.add('bad'); mark(ci, j, 'x', X_MARK); }
      ansSpots().forEach(([c, k]) => { mark(c, k, 'ans'); const e = symEl(c, k); if(e) e.classList.add('show'); });
      thread('ans');
      const tb = $('#twTable'); if(tb) tb.classList.add('solved');
      if(!reduce()){ fxFlash('#FF4D6D', .1, 240); fxShake(tb, 4); }
      const ed = $('#twEdge'); if(ed){ ed.classList.remove('on'); void ed.offsetWidth; ed.classList.add('on'); }
    }catch(_){}
  }
  function show(i){
    const m = S();
    m.i = i; m.cur = m.P[i]; m.t0 = now(); m.W = m.cur.W * 1000; m.phase = 'show'; m.cover = false; m.ticked = false; m.barCls = '';
    if(i === 0) layoutCards();   /* 판 위 한 줄(별 목표 등)이 render 뒤에 붙어도 한 화면에 맞게 다시 잼 */
    drawCards(i);
    const b = $('#twBar'); if(b){ b.className = 'tw-wbar'; }
    const bi = $('#twBarI'); if(bi) bi.style.transform = 'scaleX(1)';
    sfx('twinDeal');
  }
  function next(){ const m = S(); if(m.i + 1 >= m.N){ win(); return; } show(m.i + 1); }
  function win(){
    const m = S(); m.phase = 'done';
    const avg = m.correct ? m.tSum / m.correct / 1000 : 0, best = store.get(BEST_KEY, 0);
    const nb = avg > 0 && (!best || avg < best); if(nb) store.set(BEST_KEY, Math.round(avg * 100) / 100);
    m.avg = avg; m.bestShown = nb ? avg : best;
    hostMood('joy');
    say('<b class="ok">모두 찾았어요!</b>', 'pop');
    sfx('twinClear'); fxBuzz([30, 50, 30]);
    const tb = $('#twTable');
    try{
      if(tb) tb.insertAdjacentHTML('beforeend', `<div class="tw-end"><small>평균 판단 속도</small><b>${avg.toFixed(2)}초</b><span>${nb ? '<i>새 최고 기록!</i>' : '내 최고 ' + Number(best).toFixed(2) + '초'}</span></div>`);
      if(tb && !reduce()){ const q = fxCenter(tb); fxEmit(q.x, q.y, { quantity:26, speed:{ min:120, max:340 }, lifespan:{ min:600, max:1000 }, kind:'star', tint:['#FFE27A', '#FF9BCB', '#9FE7FF', '#B7F5C9', '#FFFFFF'], scale:{ start:6, end:0 }, gravityY:300, drag:1 }); }
    }catch(_){}
    T(() => finish(true), 1300);
  }
  function lose(){
    const m = S(); if(m.lost) return;
    m.phase = 'done'; m.lost = true;
    hostMood('sad');
    m.sayHold = true;
    T(() => { say('<b class="bad">기회를 다 썼어요</b><span>' + m.correct + '장 맞혔어요</span>', 'pop'); }, 650);
    T(() => finish(false), 1500);
  }

  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = now();
    if(m.party){ ptTick(); return; }
    if(m.phase === 'deal'){   /* 첫 카드들 그림이 PNG로 구워질 때까지 잠깐(최대 1.5초) 기다렸다 시작 */
      const ready = m.P.slice(0, 2).every(p => p.cards.every(c => c.ids.every(id => BAKED[id])));
      if(t >= 450 && (ready || t >= 1500)){ show(0); sayIdle(); }
      return;
    }
    if(m.phase === 'show'){
      const el = t - m.t0, rem = m.W - el, k = Math.max(0, rem / m.W);
      const bi = $('#twBarI'); if(bi) bi.style.transform = `scaleX(${k.toFixed(4)})`;
      const cls = (k > .5 ? '' : k > .25 ? 'mid' : 'low') + (rem < 400 ? ' hurry' : '');
      if(cls !== m.barCls){ m.barCls = cls; const b = $('#twBar'); if(b) b.className = 'tw-wbar ' + cls; }
      if(m.blink){
        const cv = el % 900 >= 600;   /* 깜빡: 0.6초 보이고 0.3초 덮임 */
        if(cv !== m.cover){ m.cover = cv; const tb = $('#twTable'); if(tb) tb.classList.toggle('covered', cv); }
      }
      if(rem < 400 && !m.ticked){ m.ticked = true; sfx('twinTick'); }
      if(rem <= 0){ if(m.cover){ m.cover = false; const tb = $('#twTable'); if(tb) tb.classList.remove('covered'); } timeout(); }
    } else if(m.phase === 'judged'){ if(t >= m.nextAt) next(); }
  }

  /* ===== 여럿 대전(대전 v3 선점, 2~5명) =====
     가운데 카드(모두 같음) + 내 카드(자리마다 다름). 둘에 딱 하나 있는 같은 그림(모든 사람에게 같은 그림)을 먼저 누른 사람이 그 판을 차지(duelClaim('r'+판)).
     판 일정은 모든 기기가 서버 시각으로 같게 계산한다(초성 버저와 같은 방식): 첫 판은 대전 시작 + PT_LEAD에 열리고,
     누가 차지하면 그 사람이 누른 시각에, 아무도 못 찾으면 열린 뒤 W초에 닫힌다 → 보여 주기 PT_SHOW → 다음 판.
     차지 기록이 늦게 도착하면(간발의 차) 주인과 일정이 저절로 다시 맞춰진다. 마지막 판 뒤 duelEndNow → 순위 = 차지 수 → 틀린 수 → 마지막 차지 이른 순(엔진).
     틀리면 PT_LOCK 동안 못 누름(정답은 가르쳐 주지 않음 · 틀린 수 +1). 기회 별 없음 */
  const PT_LEAD = 300, PT_SHOW = 1500, PT_LOCK = 1000;
  const srvNow = () => typeof duelSrv === 'function' ? duelSrv() : Date.now();
  const ptPl = pid => { try{ return (duelPlayers() || []).find(x => x.pid === pid) || null; }catch(_){ return null; } };
  const ptSeatOf = pid => { try{ const P = G.duel.P[pid]; return P ? P.seat % PSEATS : 0; }catch(_){ return 0; } };
  const ptCur = i => { const m = S(), p = m.P[i]; return { cards:[p.center, p.seats[m.seat]], ans:p.ans, W:p.W, trap:p.traps[m.seat] }; };
  function ptMine(){ const D = G && G.duel; if(!D || !D.owners) return 0; let n = 0; for(const k in D.owners) if(D.owners[k] === D.myPid && k[0] === 'r') n++; return n; }
  /* 지금 몇 번째 판이 어떤 상태인가: { i, ph:'wait'|'open'|'show'|'done', s(열린 시각), end(닫힌 시각), own, now, W(ms) } */
  function ptSched(){
    const m = S(), D = G.duel; if(!D || !D.go || D.goSrv == null) return { i:0, ph:'wait' };
    const now = srvNow(); let s = D.goSrv + PT_LEAD;
    for(let i = 0; i < m.N; i++){
      const k = 'r' + i, own = duelOwner(k), at = own && D.P[own] && D.P[own].cl ? +D.P[own].cl[k] : NaN, W = m.P[i].W * 1000;
      const end = own && isFinite(at) ? Math.max(s, at) : s + W;
      if(!own && now < end) return { i, ph:now < s ? 'wait' : 'open', s, end, now, W };
      const nx = end + PT_SHOW;
      if(now < nx) return { i, ph:'show', s, end, own, now, W };
      s = nx;
    }
    return { i:m.N, ph:'done', now };
  }
  function ptTick(){
    const m = S(), B = m.pt, D = G.duel; if(!D || !D.go || m.phase === 'done') return;
    const s = ptSched();
    if(D.mode === 'ai') ptAi(s);
    const key = s.i + ':' + s.ph + ':' + (s.own || '');
    if(key !== B.key){ B.key = key; ptEnter(s); if(G.over) return; }
    if(s.ph === 'open'){
      const rem = Math.max(0, s.end - s.now), k = Math.min(1, rem / s.W);
      const bi = $('#twBarI'); if(bi) bi.style.transform = `scaleX(${k.toFixed(4)})`;
      const cls = (k > .5 ? '' : k > .25 ? 'mid' : 'low') + (rem < 1200 ? ' hurry' : '');
      if(cls !== m.barCls){ m.barCls = cls; const b = $('#twBar'); if(b) b.className = 'tw-wbar ' + cls; }
      if(rem < 1200 && !m.ticked){ m.ticked = true; sfx('twinTick'); }
      const lk = Date.now() < B.lockUntil, tb = $('#twTable');
      if(tb && tb.classList.contains('slow') !== lk) tb.classList.toggle('slow', lk);
    }
  }
  function ptEnter(s){
    const m = S(), B = m.pt, D = G.duel;
    if(s.ph === 'wait') return;
    if(s.ph === 'done'){
      m.phase = 'done'; m.done = m.N; hud();
      say(`<b class="ok">모든 카드 끝!</b><span>내가 ${ptMine()}장 차지</span>`, 'pop');
      duelEndNow(`카드 ${m.N}장이 모두 끝났어요`);
      return;
    }
    m.i = s.i; m.cur = ptCur(s.i);
    if(s.ph === 'open'){
      m.phase = 'show'; m.ticked = false; m.barCls = ''; m.t0 = now();
      if(B.shown !== s.i){ if(B.shown < 0) layoutCards(); B.shown = s.i; ptDraw(true); sfx('twinDeal'); }   /* 첫 판: 대전 막대(미니 카드 줄)가 붙은 뒤 다시 재어 한 화면에 */
      const b = $('#twBar'); if(b) b.className = 'tw-wbar';
      say(`<span>${s.i ? '다음 카드! ' : ''}가운데와 내 카드의 쌍둥이</span>`);
      ptMinis(); hud();
      return;
    }
    /* 보여 주기: 누가 찾았는지(자리 색 고리 + 이름표) + 내 카드의 그 그림 */
    m.phase = 'judged'; m.done = s.i + 1; B.shown = s.i;
    const own = s.own || null, mine = !!own && own === D.myPid, pl = own ? ptPl(own) : null;
    const wasMine = B.revI === s.i && B.revOwn === D.myPid && !mine;   /* 내 것으로 보였다가 뺏김('간발의 차' 알림은 엔진이) */
    B.revI = s.i; B.revOwn = own;
    try{ const bi = $('#twBarI'); if(bi) bi.style.transform = 'scaleX(0)'; const b = $('#twBar'); if(b) b.className = 'tw-wbar'; }catch(_){}
    ptDraw(false);
    const tb = $('#twTable'); if(tb){ tb.classList.add('solved'); tb.classList.remove('slow'); }
    const [, jc] = ansSpots()[0], [, jm] = ansSpots()[1];
    try{
      if(mine){
        m.correct = ptMine(); m.combo++; m.bestCombo = Math.max(m.bestCombo, m.combo);
        const t = Math.max(0, (s.end - s.s) / 1000); m.tSum += t * 1000; m.speedSum += Math.max(0, 1 - t / (s.W / 1000));
        ansSpots().forEach(([c, k]) => { const e = symEl(c, k); if(e) e.classList.add('hit'); mark(c, k, 'ok'); });
        thread('ok'); mark(1, jm, 'chk', CHECK);
        sfx('twinOk', { n:m.combo }); fxBuzz(12); hostMood('joy', 900);
        say(`<b class="ok">내가 차지!</b><span>${OK_WORDS[s.i % OK_WORDS.length]} 지금 ${m.correct}장</span>`, 'pop');
        if(!reduce()) ansSpots().forEach(([c, k]) => { const q = symCenter(c, k); if(q){ fxEmit(q.x, q.y, { quantity:9, speed:{ min:50, max:180 }, lifespan:{ min:380, max:700 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2B0', '#C9F7DE'], scale:{ start:5, end:0, ease:'quad.in' }, drag:1.5, glow:true }); fxRing(q.x, q.y, '#7BE3AE', q.r * 1.7, .4, 5); } });
        const q = symCenter(1, jm); if(q) fxFloat(q.x, q.y - q.r - 6, '+1장');
      } else {
        m.combo = 0; m.correct = ptMine();
        if(own){
          ptOwnMark(jc, pl); const e = symEl(0, jc); if(e) e.classList.add('show');
          mark(1, jm, 'ans'); const e2 = symEl(1, jm); if(e2) e2.classList.add('show');
          thread('ans');
          say(`<b class="op" style="--oc:${pl ? pl.col : '#8A8FA8'}">${pl ? esc(typeof duelShortNick === 'function' ? duelShortNick(pl.nick) : pl.nick) : '상대'}</b><span>님이 먼저!</span>`, 'pop');
          if(!wasMine) sfx('twinLate');
          hostMood('sad', 700);
        } else {
          ansSpots().forEach(([c, k]) => { mark(c, k, 'ans'); const e = symEl(c, k); if(e) e.classList.add('show'); });
          thread('ans');
          say('<b class="warn">아무도 못 찾았어요</b><span>점선이 쌍둥이</span>', 'pop');
          sfx('twinLate');
        }
      }
    }catch(_){}
    ptMinis(own); hud();
  }
  /* 다른 사람이 차지한 가운데 카드 그림: 그 사람 자리 색 고리 + 이름표(보이기만) */
  function ptOwnMark(j, pl){
    const card = document.querySelector('.ng-twin .tw-card[data-ci="0"] .tw-face'), l = S().cur.cards[0].L[j]; if(!card || !l) return;
    const col = pl ? pl.col : '#8A8FA8', nm = pl ? (pl.me ? '나' : duelShortNick ? duelShortNick(pl.nick) : String(pl.nick).slice(0, 5)) : '상대';
    const shp = pl && typeof duelShapeSvg === 'function' ? duelShapeSvg(pl.shape, col, 13) : '';
    card.insertAdjacentHTML('beforeend', `<span class="tw-mk own" style="--sc:${col};left:${pct((1 + l.x) / 2)};top:${pct((1 + l.y) / 2)};width:${(l.r * 2.3 * 50).toFixed(2)}%"></span>` +
      `<span class="tw-who" style="--sc:${col};left:${pct((1 + l.x) / 2)};top:${pct(Math.max(.06, (1 + l.y - l.r * 1.25) / 2))}">${shp}${esc(nm)}</span>`);
  }
  function ptDraw(anim){
    const m = S(), tb = $('#twTable'); if(!tb || !m.cur) return;
    const cs = m.cur.cards;
    tb.innerHTML = cardHtml(cs[0], 0, 'ctr' + (anim ? ' in' : ''), 0, '', '<b class="tw-lab ctr" aria-hidden="true">가운데 · 모두 같아요</b>') +
      cardHtml(cs[1], 1, 'mine' + (anim ? ' in' : ''), anim ? 70 : 0, '', '<b class="tw-lab me" aria-hidden="true">내 카드</b>');
    tb.classList.remove('solved', 'covered', 'slow');
  }
  /* 누르기: 쌍둥이면 차지 시도(내 화면에는 바로 차지로 보이고, 더 이른 기록이 오면 엔진이 바꿈). 틀리면 1초 못 누름 */
  function ptJudge(ci, j){
    const m = S(), B = m.pt, cur = m.cur, id = cur.cards[ci].ids[j];
    if(id === cur.ans){
      const r = duelClaim('r' + m.i);
      if(r && r.ok){ m.phase = 'claim'; ptTick(); return; }
      say('<b class="warn">한발 늦었어요</b><span>먼저 찾은 사람이 있어요</span>', 'pop');
      return;
    }
    m.wrong++; B.lockUntil = Date.now() + PT_LOCK;
    const other = cur.cards[1 - ci];
    const why = other.ids.includes(id ^ 1) ? '색이 다른 가짜!' : '앗, 아니에요';
    say(`<b class="bad">${why}</b><span>1초 쉬어요</span>`, 'pop');
    sfx('twinBad'); fxBuzz(30); hostMood('sad', 600);
    try{
      const e = symEl(ci, j); if(e) e.classList.add('bad');
      mark(ci, j, 'x', X_MARK);
      const tb = $('#twTable'); if(tb) tb.classList.add('slow');
      if(!reduce()) fxShake(tb, 3);
      const ed = $('#twEdge'); if(ed){ ed.classList.remove('on'); void ed.offsetWidth; ed.classList.add('on'); }
      const g = m.i; T(() => { const mk = document.querySelector('.ng-twin .tw-mk.x'); if(mk && S().i === g) mk.remove(); const e2 = symEl(ci, j); if(e2) e2.classList.remove('bad'); }, PT_LOCK);
    }catch(_){}
    T(() => { const q = S(); if(q.phase === 'show' && q.i === m.i) say('<span>가운데와 내 카드의 쌍둥이</span>'); }, PT_LOCK + 50);
  }
  /* 컴퓨터 상대: 판마다 판 씨앗 난수로 찾을지·몇 초 뒤에 찾을지(같은 판 = 같은 결과). 찾는 시간은 사람 흉내 모형(그림 수·크기 차이) */
  function ptAi(s){
    const m = S(), B = m.pt, D = G.duel, Ai = D.P && D.P.ai; if(!Ai || s.ph !== 'open') return;
    if(B.aiI !== s.i){
      B.aiI = s.i;
      const r = mulberry(seedFrom(D.seed + ':tai:' + s.i)), slow = D.pace === 's' ? 1.5 : 1, p = m.P[s.i], c = p.seats[ptSeatOf('ai')];
      const ra = p.center.L[p.center.ids.indexOf(p.ans)].r / c.L[c.ids.indexOf(p.ans)].r;
      const find = (0.9 + 0.22 * m.k * (1 + .9 * Math.abs(Math.log(ra)))) * (0.7 + r() * 0.8) * slow;
      B.aiAt = r() < .85 && find < s.W / 1000 - .3 ? s.s + find * 1000 : null;
    }
    const k = 'r' + s.i;
    if(B.aiAt && s.now >= B.aiAt && !duelOwner(k)){
      Ai.cl = Ai.cl || {}; Ai.cl[k] = Math.round(B.aiAt); B.aiAt = null;
      try{ if(typeof duelClaimsRecalc === 'function') duelClaimsRecalc(D); }catch(_){}
    }
  }
  /* 상대 미니 카드(엔진 미니 화면 칸): 그 사람 자리의 지금 카드. 보여 주기 때 쌍둥이 그림에 고리, 차지한 사람 카드는 자리 색 테두리 */
  function ptMiniHtml(pid){
    const m = G && G.id === 'twin' && G.m; if(!m || !m.party || m.i < 0 || m.i >= m.N) return '';
    const p = m.P[m.i], c = p.seats[ptSeatOf(pid)], sh = m.phase === 'judged', own = sh ? duelOwner('r' + m.i) : null;
    const col = own === pid ? (ptPl(pid) || {}).col || '#2BB673' : '';
    return `<span class="tw-mini${col ? ' won' : ''}"${col ? ` style="--sc:${col}"` : ''}>` + c.ids.map((id, j) => { const l = c.L[j];
      return `<img src="${img(id)}" alt="" style="left:${pct((1 + l.x) / 2)};top:${pct((1 + l.y) / 2)};width:${(l.r * 106).toFixed(1)}%"${sh && id === p.ans ? ' class="a"' : ''}>`; }).join('') + '</span>';
  }
  function ptMinis(){
    try{ document.querySelectorAll('#dMinis .dmini').forEach(c => { const b = c.querySelector('.dm-board'); if(b) b.innerHTML = ptMiniHtml(c.dataset.pid); b._tw = (S().i) + ':' + S().phase; }); }catch(_){}
  }

  /* 도움말 그림(작은 카드 그림) */
  const hpCard = (items, ring) => `<span class="tw-hpc">${items.map(([i, v, x, y, s], n) => `<img src="${A.src(i, v)}" alt="" style="left:${x}%;top:${y}%;width:${s}%">${ring === n ? `<i style="left:${x}%;top:${y}%;width:${s + 8}%"></i>` : ''}`).join('')}</span>`;
  const HP1 = `<i class="tw-hp" aria-hidden="true">${hpCard([[13, 0, 30, 34, 34], [0, 0, 70, 36, 32], [12, 0, 50, 72, 32]], 0)}${hpCard([[2, 0, 30, 32, 32], [13, 0, 68, 64, 34], [16, 0, 34, 72, 30]], 1)}</i>`;
  const HP2 = '<i class="tw-hp" aria-hidden="true"><span class="tw-hpbar"><s></s></span><em class="ok">빠를수록 +</em></i>';
  const HP3 = `<i class="tw-hp" aria-hidden="true">${hpCard([[2, 0, 50, 50, 46]])}<em>≠</em>${hpCard([[2, 1, 50, 50, 46]])}</i>`;
  let ARTN = 0;

  return {
    name:'쌍둥이 찾기', abil:'순발력', col:['#F2B8FF', '#B44FE0', '#5E1A86'], time:'약 2분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="12" r="6.6" opacity=".45"/><circle cx="16" cy="12" r="6.6" opacity=".45"/><path d="M12 7.4l1.4 2.8 3.1.5-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.5z"/></svg>',
    art(){
      const u = 'twA' + (++ARTN) + '_' + Math.floor(performance.now() % 1e6);
      const sy = (i, v, x, y, s, r) => `<image href="${A.src(i, v)}" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}"${r ? ` transform="rotate(${r} ${x} ${y})"` : ''}/>`;
      const cd = (x, y) => `<circle cx="${x}" cy="${y + 3}" r="35" fill="#1A0F45"/><circle cx="${x}" cy="${y}" r="35" fill="url(#${u}c)" stroke="#1A0F45" stroke-width="2.4"/><circle cx="${x}" cy="${y}" r="31.5" fill="none" stroke="#EBD7FF" stroke-width="3"/>`;
      const ring = (x, y) => `<circle cx="${x}" cy="${y}" r="12.5" fill="none" stroke="#1A0F45" stroke-width="5"/><circle cx="${x}" cy="${y}" r="12.5" fill="none" stroke="#5EE0A0" stroke-width="2.8"/>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6EA"/><stop offset="1" stop-color="#F0D6B6"/></linearGradient>
        <radialGradient id="${u}c" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F7EAD6"/></radialGradient></defs>
        <rect width="160" height="100" fill="url(#${u}b)"/><path d="M0 88h160v12H0z" fill="#E6C49C" opacity=".6"/>
        ${cd(44, 48)}${cd(116, 52)}
        ${sy(13, 0, 34, 38, 24)}${sy(0, 0, 58, 40, 22, 10)}${sy(12, 0, 34, 63, 20, -8)}${sy(29, 0, 57, 64, 18)}
        ${sy(2, 0, 104, 40, 22, -10)}${sy(13, 0, 127, 64, 24, 18)}${sy(18, 0, 130, 38, 18)}${sy(36, 0, 104, 64, 20)}
        ${ring(34, 38)}${ring(127, 64)}
        <path d="M74 50q6-6 12 0" fill="none" stroke="#1A0F45" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 3"/></svg>`;
    },
    help:[
      ['같은 그림 딱 하나', HP1 + '두 카드에 똑같은 그림이 딱 하나 있어요. 크기나 방향이 달라도 같은 그림이에요. 찾으면 어느 카드에서든 눌러요.'],
      ['판단은 빠르게', HP2 + '카드마다 판단 시간이 있어요. 위의 막대가 다 줄기 전에 눌러요. 빨리 찾을수록 점수가 높아요.'],
      ['막 누르면 손해', HP3 + '틀리거나 시간이 지나면 기회 별이 하나 줄어요. 모양이 같아도 색이 다르면 가짜! 마구 누르면 잠깐 멈춰요.']
    ],
    /* 도움말 v2(쉬운 화면): 그림 + 3줄. 자세한 설명은 "더 알아보기"(help) */
    howto:{
      pic(){
        const u = 'twH' + (++ARTN), im = (i, v, x, y, s, r) => `<image href="${A.src(i, v)}" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}"${r ? ` transform="rotate(${r} ${x} ${y})"` : ''}/>`;
        const cd = (x, y, rim) => `<circle cx="${x}" cy="${y + 5}" r="66" fill="#1A0F45"/><circle cx="${x}" cy="${y}" r="66" fill="url(#${u}c)" stroke="#1A0F45" stroke-width="3"/><circle cx="${x}" cy="${y}" r="60" fill="none" stroke="${rim}" stroke-width="6"/>`;
        return `<svg viewBox="0 0 320 180" aria-hidden="true"><defs>
          <linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6EA"/><stop offset="1" stop-color="#EFD3AE"/></linearGradient>
          <radialGradient id="${u}c" cx=".5" cy=".36" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F5E9D6"/></radialGradient></defs>
          <rect width="320" height="180" fill="url(#${u}b)"/>
          ${cd(86, 86, '#E9DDFF')}${cd(234, 94, '#FFE0EC')}
          ${im(12, 0, 60, 52, 40)}${im(2, 0, 112, 66, 34, -12)}${im(29, 0, 64, 122, 34, 10)}${im(13, 0, 112, 116, 56, 8)}
          ${im(13, 0, 206, 68, 30, -14)}${im(18, 0, 258, 72, 42)}${im(36, 0, 212, 124, 40, 6)}${im(13, 1, 264, 128, 38)}
          <path d="M136 108Q170 64 196 70" fill="none" stroke="#1A0F45" stroke-width="7" stroke-linecap="round"/><path d="M136 108Q170 64 196 70" fill="none" stroke="#FFD45C" stroke-width="3.6" stroke-linecap="round"/>
          <circle cx="136" cy="108" r="5" fill="#FFD45C" stroke="#1A0F45" stroke-width="2"/><circle cx="196" cy="70" r="5" fill="#FFD45C" stroke="#1A0F45" stroke-width="2"/>
          <path d="M283 112l-14 14M269 112l14 14" stroke="#1A0F45" stroke-width="7" stroke-linecap="round"/><path d="M283 112l-14 14M269 112l14 14" stroke="#FF4D6D" stroke-width="3.6" stroke-linecap="round"/></svg>`;
      },
      lines:['두 카드에 같은 그림이 딱 하나', '크기·방향이 달라도 같은 그림', '색이 다르면 가짜! 막 누르면 손해']
    },
    helpExtra(){ const m = G && G.id === 'twin' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['장난감 상자', '소풍 바구니', '별빛 서랍', '거울 방', '쌍둥이 성'],
    starRule:'★ 클리어 · ★★ 한 번만 틀림 · ★★★ 하나도 안 틀림',
    levels:{
      easy:{ N:20, k:5, w0:6, w1:4.5, trap:.15, sz:[.85, 1.15], gap:0, limit:0 },
      normal:{ N:25, k:6, w0:5.5, w1:3.9, trap:.25, sz:[.7, 1.3], gap:.25, lure:true, limit:0 },
      hard:{ N:30, k:7, w0:5.2, w1:3.8, trap:.35, sz:[.55, 1.45], gap:.4, lure:true, limit:0 }
    },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `카드 ${c.N}장 · 그림 ${c.k}개${c.gap >= .4 ? ' · 크기 차이 큼' : c.gap ? ' · 크기 차이' : ''} · 판단 ${c.w0}초부터`; },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `카드 ${c.N}장 · 그림 ${c.k}개 · 판단 ${c.w0}초부터${c.three ? ' · 카드 세 장' : ''}${c.lives < 3 ? ' · 기회 ' + c.lives + '번' : ''}`; },
    init(cfg, rng){
      /* 여럿 대전(2~5명): 대전 v3 + 대전 판 설정(R = 판 수)이 있으면 가운데 카드 + 자리마다 다른 내 카드 */
      const party = !!(G.duel && G.duel.v === 3 && !G.duel.fleet && !G.duel.replay && cfg.R);
      if(party){ for(let i = 0; i < 7; i++) rng(); }
      else for(let i = 0; i < (cfg.N || 0) * 3; i++) rng();   /* 같은 날 난이도마다 다른 카드가 나오게 */
      const P = party ? genParty(cfg, rng) : gen(cfg, rng), host = cfg.host || 'owl';
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      if(!G.adv && cfg.gap) tips.push(RULE_TIP.size);
      if(!G.adv && cfg.trap) tips.push(RULE_TIP.look);
      const need = []; P.forEach(p => (party ? [p.center].concat(p.seats) : p.cards).forEach(c => c.ids.forEach(id => { if(!need.includes(id)) need.push(id); })));
      const lives = G.duel ? 3 : cfg.lives || 3;
      G.m = { P, N:P.length, three:!!cfg.three, blink:!!cfg.blink, boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips,
        host, H:HOST_LOOK[host] || HOST_LOOK.owl, need, i:-1, cur:null, phase:'deal', t0:0, W:1, done:0, correct:0, wrong:0, speedSum:0, tSum:0,
        combo:0, bestCombo:0, lives, maxLives:lives, lockUntil:0, slowUntil:0, taps:[], cover:false, nextAt:0, avg:0, timers:new Set() };
      G.paws = lives;
      const m = G.m;
      if(party){
        const D = G.duel, me = D.P && D.P[D.myPid];
        Object.assign(m, { party:true, k:cfg.k, seat:me ? me.seat % PSEATS : 0, tips:[], pt:{ key:'', shown:-1, lockUntil:0, aiI:-1, aiAt:null, revI:-1, revOwn:null } });
      }
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
      /* 테스트·도구용: 지금 카드의 정답 그림 화면 자리 */
      m._answerPoint = () => { if(m.phase !== 'show') return null; const [ci, j] = ansSpots()[0]; return symCenter(ci, j); };
      /* 테스트용(여럿 대전): 지금 판의 쌍둥이 그림 · 틀린 그림 화면 자리 */
      m._wrongPoint = () => { if(m.phase !== 'show') return null; const c = m.cur.cards[1], j = c.ids.findIndex(id => id !== m.cur.ans); return symCenter(1, j); };
    },
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-twin${m.three ? ' three' : ''}${m.boss ? ' boss' : ''}${m.party ? ' party' : ''}" style="--ac:${m.H.ac};--rim:${m.H.rim}">
        ${m.party ? '' : `<div class="hud-row">
          <div class="hchip" id="twProgP" aria-label="푼 카드"><span class="hv">${ICO.card}<b id="twProg">0</b><small>/${m.N}</small></span><em>카드</em></div>
          <div class="hchip" id="twComboP" aria-label="연속 정답"><span class="hv">${ICO.combo}<b id="twCombo">0</b></span><em>연속 정답</em></div>
        </div>`}
        <div class="tw-host">
          <span class="tw-hostbox"><img class="toy tw-hostimg" id="twHostImg" src="${toySrc(m.host, m.boss ? 'wow' : '')}" alt="" aria-hidden="true" draggable="false"></span>
          <div class="tw-say" id="twSay" role="status" aria-live="polite"><span>${m.party ? '가운데 카드와 내 카드의 쌍둥이를 먼저!' : '카드를 섞는 중…'}</span></div>
          ${m.party ? `<div class="tw-pcnt" aria-label="카드 진행·내가 차지한 수"><span><b id="twProg">0</b><small>/${m.N}</small></span><span class="mine">내 것 <b id="twMine">0</b></span></div>` : '<div class="hlives" id="twLives" role="img"></div>'}
          ${m.boss ? '<b class="tw-bossband" aria-hidden="true">대장!</b>' : ''}
        </div>
        <div class="tw-wbar" id="twBar" aria-hidden="true"><i id="twBarI"></i></div>
        <div class="tw-table" id="twTable"></div>
        <div class="tw-edge" id="twEdge" aria-hidden="true"></div>
      </div>`;
      const tb = $('#twTable'); if(tb) tb.addEventListener('pointerdown', onDown);
      hud(); layoutCards();
      if(tb) tb.innerHTML = Array.from({ length:m.three ? 3 : 2 }, (_, ci) => cardHtml({ ids:[], L:[] }, ci, 'back' + (m.party ? (ci ? ' mine' : ' ctr') : ''), 0, '', m.party ? `<b class="tw-lab ${ci ? 'me' : 'ctr'}" aria-hidden="true">${ci ? '내 카드' : '가운데 · 모두 같아요'}</b>` : '')).join('');   /* 시작 전: 엎어 둔 카드 */
      if(m.boss){ sfx('twinBoss'); T(() => hostMood('', 0), 1800); }
      m.onResize = () => layoutCards();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m && m.N ? (m.party ? m.done : m.correct) / m.N : 0; },
    lossText(){ const m = G.m; return `카드 ${m.done}/${m.N}장까지 왔어요. 정답 ${m.correct}개.`; },
    score(){
      const m = G.m, N = m.N || 1, avg = m.correct ? m.tSum / m.correct / 1000 : 0;
      return { base:Math.round(500 * m.correct / N), time:Math.round(350 * m.speedSum / N), extra:50 * Math.max(0, m.lives),
        rows:[`정답 ${m.correct}/${N}`, `판단 속도 보너스 (평균 ${avg ? avg.toFixed(2) : '-'}초)`, `남은 기회 ${Math.max(0, m.lives)}개`] };
    },
    stars(){ const w = G.m.wrong; return w === 0 ? 3 : w === 1 ? 2 : 1; },
    _gen:gen, _check:check, _genParty:genParty, _checkParty:checkParty, _pseats:PSEATS, _ptMini:ptMiniHtml, _ratio:ansRatio, _hb:HB, _rmin:RMIN, _stage:stageCfg, _art:A, _baked:id => !!BAKED[id],
    css:`
body[data-mode="twin"]{background:
  radial-gradient(90% 55% at 50% 0%, rgba(255,255,255,.7), rgba(255,255,255,0) 70%),
  repeating-linear-gradient(90deg, rgba(150,95,40,.035) 0 2px, transparent 2px 120px),
  linear-gradient(180deg,#FCF3E6 0%,#F5E2C8 58%,#EBCFA9 100%) fixed}
.ng-twin{position:relative; display:flex; flex-direction:column; align-items:center; margin-bottom:-30px; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none}
.ng-twin .hud-row{margin:0 0 8px}
.ng-twin .tw-host{position:relative; display:flex; align-items:center; gap:8px; width:100%; height:46px; margin:0 0 8px}
.ng-twin .tw-hostbox{flex:none; width:46px; height:46px; display:grid; place-items:center}
.ng-twin .tw-hostimg{width:46px; height:46px}
.ng-twin .tw-hostimg.bop{animation:twin-bop .4s cubic-bezier(.2,1.6,.4,1)}
@keyframes twin-bop{40%{transform:translateY(-4px) scale(1.08)}}
.ng-twin .tw-say{position:relative; flex:1; min-width:0; height:38px; display:flex; align-items:center; gap:7px; padding:0 12px; border-radius:14px; background:#fff; border:2px solid #1A0F45; box-shadow:0 2px 0 #1A0F45;
  font-family:var(--disp); font-size:15px; color:#4A3466; white-space:nowrap; overflow:hidden}
.ng-twin .tw-say::before{content:""; position:absolute; left:-7px; top:50%; width:10px; height:10px; margin-top:-5px; background:#fff; border-left:2px solid #1A0F45; border-bottom:2px solid #1A0F45; transform:rotate(45deg)}
.ng-twin .tw-say span{overflow:hidden; text-overflow:ellipsis}
.ng-twin .tw-say b{flex:none; font-family:var(--heavy); font-weight:400; font-size:18px; letter-spacing:.3px; color:var(--ac)}
.ng-twin .tw-say b.ok{color:#1E9E5E} .ng-twin .tw-say b.bad{color:#E5484D} .ng-twin .tw-say b.warn{color:#E07B00} .ng-twin .tw-say b.boss{color:#D63A3A} .ng-twin .tw-say b.combo{color:#E0559A}
.ng-twin .tw-say.pop{animation:twin-pop .3s cubic-bezier(.2,1.5,.4,1)}
@keyframes twin-pop{from{transform:scale(.85); opacity:.3}}
.ng-twin .hlives{flex:none}
.ng-twin .hlives.last{background:#FFE3E3}
.ng-twin .hlives i.lost{animation:twin-lost .5s ease-out}
@keyframes twin-lost{0%{transform:scale(1.7); color:#FF6B6B}}
.ng-twin .tw-bossband{position:absolute; left:2px; top:-6px; z-index:2; font-family:var(--heavy); font-weight:400; font-size:13px; line-height:1; color:#fff; padding:3px 7px; border-radius:8px; background:#E5484D; border:2px solid #1A0F45; transform:rotate(-8deg); animation:twin-pop .4s cubic-bezier(.2,1.6,.4,1) .2s both}
.ng-twin.boss .tw-host::after{content:""; position:absolute; inset:-4px -6px; z-index:-1; border-radius:18px; background:linear-gradient(90deg,rgba(229,72,77,.22),rgba(229,72,77,.06))}
.ng-twin .tw-wbar{position:relative; width:100%; height:12px; margin:0 0 10px; border-radius:99px; border:2px solid #1A0F45; background:rgba(26,15,69,.1); overflow:hidden}
.ng-twin .tw-wbar i{position:absolute; inset:0; transform-origin:left center; border-radius:99px; background:linear-gradient(180deg,#7EE6A6,#2BB673); will-change:transform}
.ng-twin .tw-wbar.mid i{background:linear-gradient(180deg,#FFE27A,#F5B700)}
.ng-twin .tw-wbar.low i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-twin .tw-wbar.hurry{animation:twin-hurry .12s linear infinite alternate}
@keyframes twin-hurry{from{transform:translateX(-1.5px)} to{transform:translateX(1.5px)}}
.ng-twin .tw-table{position:relative; display:block; width:100%; height:calc(2 * var(--d) + 20px); touch-action:manipulation; --d:280px}
.ng-twin .tw-card{position:absolute; width:var(--d); height:var(--d); border-radius:50%; cursor:pointer; -webkit-tap-highlight-color:transparent;
  background:radial-gradient(circle at 50% 36%, #FFFFFF 0%, #FFFDF8 50%, #F4E7D2 100%);
  border:3px solid #1A0F45; box-shadow:inset 0 0 0 7px var(--rim), inset 0 0 0 8.5px rgba(26,15,69,.12), inset 0 16px 22px -10px rgba(120,80,30,.16), 0 6px 0 #1A0F45, 0 18px 26px -8px rgba(110,70,25,.28)}
.ng-twin .tw-card::after{content:""; position:absolute; inset:2px; border-radius:50%; pointer-events:none; border:2.5px solid transparent; border-top-color:rgba(255,255,255,.95); border-left-color:rgba(255,255,255,.5); transform:rotate(-18deg)}
.ng-twin .tw-face{position:absolute; inset:0; border-radius:50%; transition:opacity .2s, filter .2s}
.ng-twin .tw-s{position:absolute; aspect-ratio:1; transform:translate(-50%,-50%); pointer-events:none; transition:opacity .18s}
.ng-twin .tw-s::before{content:""; position:absolute; left:22%; right:22%; top:83%; height:11%; border-radius:50%; background:radial-gradient(closest-side, rgba(16,24,69,.3), rgba(16,24,69,0))}
.ng-twin .tw-s img{position:relative; display:block; width:100%; height:100%; transform:rotate(var(--rot)); transition:transform .18s}
.ng-twin .tw-table.solved .tw-s:not(.hit):not(.show):not(.bad){opacity:.34; filter:saturate(.6)}
.ng-twin .tw-s{transition:opacity .16s, filter .16s}
.ng-twin .tw-s.hit img{animation:twin-hit .42s cubic-bezier(.2,1.6,.4,1) both}
@keyframes twin-hit{40%{transform:rotate(var(--rot)) scale(1.32)} 100%{transform:rotate(var(--rot)) scale(1.16)}}
.ng-twin .tw-s.show img{transform:rotate(var(--rot)) scale(1.12)}
.ng-twin .tw-s.bad img{animation:twin-no .32s ease-out}
@keyframes twin-no{20%{transform:translateX(-5px) rotate(calc(var(--rot) - 6deg))} 50%{transform:translateX(5px) rotate(calc(var(--rot) + 5deg))} 80%{transform:translateX(-2px) rotate(var(--rot))}}
.ng-twin .tw-mk{position:absolute; aspect-ratio:1; transform:translate(-50%,-50%); pointer-events:none; border-radius:50%}
.ng-twin .tw-mk.ok{box-shadow:0 0 0 3px #1A0F45, inset 0 0 0 3.5px #5EE0A0, inset 0 0 0 5.5px #fff, 0 0 18px 5px rgba(94,224,160,.5); background:radial-gradient(closest-side, rgba(190,245,215,0) 72%, rgba(190,245,215,.45)); animation:twin-ring .3s cubic-bezier(.2,1.6,.4,1) both}
.ng-twin .tw-thread{position:absolute; left:0; top:0; z-index:4; pointer-events:none; overflow:visible}
.ng-twin .tw-thread path{fill:none; stroke-linecap:round}
.ng-twin .tw-thread .u{stroke:#1A0F45; stroke-width:7.5}
.ng-twin .tw-thread .t{stroke:#FFD45C; stroke-width:3.8}
.ng-twin .tw-thread g circle{fill:#FFD45C; stroke:#1A0F45; stroke-width:2.2}
.ng-twin .tw-thread.ok{animation:twin-thr .28s ease-out both}
.ng-twin .tw-thread.ans .u{stroke-width:6; opacity:.55}
.ng-twin .tw-thread.ans .t{stroke:#F5A700; stroke-width:3.2; stroke-dasharray:7 7}
.ng-twin .tw-thread.ans g circle{fill:#FFE27A}
.ng-twin .tw-thread.ans{animation:twin-thr .3s ease-out .12s both}
@keyframes twin-thr{from{opacity:0; transform:scale(.97); transform-origin:50% 50%}}
.ng-twin .tw-mk.ans{border:3.5px dashed #F5A700; background:rgba(255,226,122,.2); animation:twin-ring .35s cubic-bezier(.2,1.6,.4,1) .12s both}
@keyframes twin-ring{from{transform:translate(-50%,-50%) scale(1.6); opacity:0}}
.ng-twin .tw-mk.x, .ng-twin .tw-mk.chk{width:30px !important; border-radius:0; animation:twin-stamp .26s cubic-bezier(.2,1.6,.4,1) both}
.ng-twin .tw-mk.chk{margin:-22px 0 0 22px; z-index:2}
.ng-twin .tw-mk svg{display:block; width:100%; height:100%}
@keyframes twin-stamp{from{transform:translate(-50%,-50%) scale(2.2); opacity:0}}
.ng-twin .tw-cover{position:absolute; inset:5px; border-radius:50%; display:grid; place-items:center; pointer-events:none; opacity:0; transition:opacity .08s;
  color:color-mix(in srgb, var(--ac) 55%, #fff); background:radial-gradient(circle at 40% 35%, color-mix(in srgb, var(--rim) 70%, #fff), var(--rim))}
.ng-twin .tw-cover svg{width:34%; height:34%; opacity:.7}
.ng-twin .tw-table.covered .tw-cover, .ng-twin .tw-card.back .tw-cover{opacity:1}
.ng-twin .tw-table.slow .tw-card:not(.ghost){filter:grayscale(.5) brightness(.95); cursor:wait}
.ng-twin .tw-card.in{animation:twin-in .32s cubic-bezier(.2,1.25,.4,1) both}
@keyframes twin-in{from{transform:translateY(-28px) scale(.76) rotate(-10deg); opacity:0} 45%{opacity:1}}
.ng-twin .tw-card.drop{animation:twin-drop .3s cubic-bezier(.3,.9,.35,1) both}
@keyframes twin-drop{from{transform:translate(var(--fx,0px), var(--fy,-200px))}}
.ng-twin .tw-card.ghost{pointer-events:none; animation:twin-out .3s ease-in both}
@keyframes twin-out{to{transform:translateY(70px) scale(.82) rotate(8deg); opacity:0}}
.ng-twin .tw-end{position:absolute; left:50%; top:50%; z-index:6; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:2px; padding:14px 26px 12px; border-radius:22px; background:#FFFDF8; border:3px solid #1A0F45; box-shadow:inset 0 0 0 5px var(--rim), 0 5px 0 #1A0F45, 0 18px 30px rgba(26,15,69,.22); white-space:nowrap; animation:twin-pop .4s cubic-bezier(.2,1.6,.4,1) both}
.ng-twin .tw-end small{font-family:var(--disp); font-size:14px; color:#6A5884}
.ng-twin .tw-end b{font-family:var(--heavy); font-weight:400; font-size:30px; line-height:1.15; color:#3A2261}
.ng-twin .tw-end span{font-family:var(--disp); font-size:15px; color:#4A3A6E}
.ng-twin .tw-end i{font-style:normal; color:#D6407F}
.ng-twin .tw-edge{position:fixed; inset:0; pointer-events:none; z-index:16; opacity:0; box-shadow:inset 0 0 60px 14px rgba(229,72,77,.32)}
.ng-twin .tw-edge.on{animation:twin-edge .55s ease-out}
@keyframes twin-edge{20%{opacity:1} 100%{opacity:0}}
.tw-hp{display:flex; align-items:center; justify-content:center; gap:8px; margin:2px 0 6px; font-style:normal}
.tw-hp em{font-style:normal; font-family:var(--heavy); font-size:22px; color:#E5484D}
.tw-hpc{position:relative; display:block; width:74px; height:74px; border-radius:50%; background:radial-gradient(circle at 38% 30%,#fff,#F7ECDB); border:2px solid #1A0F45; box-shadow:inset 0 0 0 4px #EBD7FF}
.tw-hpc img{position:absolute; transform:translate(-50%,-50%); aspect-ratio:1}
.tw-hpc i{position:absolute; transform:translate(-50%,-50%); aspect-ratio:1; border-radius:50%; box-shadow:0 0 0 2.5px #1A0F45, inset 0 0 0 2px #5EE0A0}
.tw-hp em.ok{font-family:var(--disp); font-size:15px; color:#1E9E5E}
.tw-hpbar{position:relative; display:block; width:130px; height:14px; border-radius:99px; border:2px solid #1A0F45; background:rgba(26,15,69,.1); overflow:hidden}
.tw-hpbar s{position:absolute; left:0; top:0; bottom:0; width:62%; border-radius:99px; background:linear-gradient(180deg,#7EE6A6,#2BB673)}
.dg-rules .tw-hp{display:none}
/* 여럿 대전: 가운데 카드(금빛 테두리) + 내 카드(분홍 테두리, 나는 늘 분홍), 카드 이름표, 진행 칩, 차지한 사람 고리·이름표, 상대 미니 카드 */
.ng-twin.party .tw-host{margin:0 0 6px}
.ng-twin.party .tw-wbar{margin:0 0 14px}
.ng-twin .tw-card.ctr{--rim:#FFE39A}
.ng-twin .tw-card.mine{--rim:#FFD3E6}
.ng-twin .tw-lab{position:absolute; left:50%; top:-11px; z-index:5; transform:translateX(-50%); pointer-events:none; white-space:nowrap; font-family:var(--disp); font-weight:400; font-size:13px; line-height:1; padding:4px 10px 3px; border-radius:99px; border:2px solid #1A0F45; box-shadow:0 2px 0 #1A0F45}
.ng-twin .tw-lab.ctr{background:#FFE39A; color:#6A4300}
.ng-twin .tw-lab.me{background:#F0368A; color:#fff}
.ng-twin .tw-pcnt{flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:1px; font-family:var(--disp); font-size:13px; line-height:1.1; color:#4A3466}
.ng-twin .tw-pcnt b{font-family:var(--heavy); font-weight:400; font-size:17px; color:#3A2261}
.ng-twin .tw-pcnt small{font-size:13px; color:#6A5884}
.ng-twin .tw-pcnt .mine{padding:2px 7px; border-radius:99px; background:#FFE0EE; border:1.5px solid #1A0F45}
.ng-twin .tw-pcnt .mine b{font-size:15px; color:#D61F72}
.ng-twin .tw-say b.op{color:var(--oc, #5B3FB5)}
.ng-twin .tw-mk.own{box-shadow:0 0 0 3px #1A0F45, inset 0 0 0 4px var(--sc), inset 0 0 0 6px #fff, 0 0 16px 4px color-mix(in srgb, var(--sc) 55%, transparent); animation:twin-ring .3s cubic-bezier(.2,1.6,.4,1) both}
.ng-twin .tw-who{position:absolute; z-index:3; transform:translate(-50%,-100%); display:flex; align-items:center; gap:3px; pointer-events:none; white-space:nowrap; font-family:var(--disp); font-size:13px; line-height:1; padding:3px 7px 3px 5px; border-radius:99px; background:#fff; color:#1A0F45; border:2.5px solid var(--sc); box-shadow:0 2px 0 #1A0F45; animation:twin-pop .3s cubic-bezier(.2,1.6,.4,1) both}
.ng-twin .tw-who .dseat{flex:none}
body[data-mode="twin"] .dmini .tw-mini{position:absolute; left:50%; top:50%; width:42px; height:42px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle at 50% 36%, #fff, #F4E7D2); border:1.5px solid #1A0F45; box-shadow:inset 0 0 0 2px #FFE7C2}
body[data-mode="twin"] .dmini .tw-mini.won{box-shadow:inset 0 0 0 2px #fff, 0 0 0 2.5px var(--sc)}
body[data-mode="twin"] .dmini .tw-mini img{position:absolute; transform:translate(-50%,-50%); aspect-ratio:1; max-width:none; max-height:none}
body[data-mode="twin"] .dmini .tw-mini img.a{border-radius:50%; box-shadow:0 0 0 1.5px #1A0F45, 0 0 0 3px #7BE3AE}
@media (max-width:370px), (max-height:760px){ .tw-hpc{width:58px; height:58px} .tw-hp{margin:0 0 4px} }
@media (max-width:370px){ .ng-twin .tw-say{font-size:14px; padding:0 9px} .ng-twin .tw-say b{font-size:16px} .ng-twin .tw-host{gap:6px} .ng-twin .tw-hostbox, .ng-twin .tw-hostimg{width:40px; height:40px} }
@media (prefers-reduced-motion: reduce){ .ng-twin .tw-thread, .ng-twin .tw-card.in, .ng-twin .tw-card.drop, .ng-twin .tw-s.hit img, .ng-twin .tw-s.bad img, .ng-twin .tw-mk, .ng-twin .tw-wbar.hurry, .ng-twin .tw-say.pop, .ng-twin .tw-hostimg.bop{animation:none} .ng-twin .tw-card.ghost{display:none} }
`,
    sounds:{
      twinDeal(){ aWhoosh({ f:700, f2:2600, q:1.2, a:.01, d:.14, v:.03 }); aTone({ f:1180, type:'triangle', t:.05, d:.05, v:.025, bus:'ui' }); },
      twinOk(o){ const n = Math.min(12, o.n || 0); aBell({ f:penta(n + 4, 72), d:.55, v:.085, idx:1.3, rev:.3 }); aBell({ f:penta(n + 6, 72), t:.07, d:.6, v:.06, idx:1.2, rev:.35 }); aSparkle({ root:84 + Math.min(7, n), n:2, t:.1, v:.02 }); },
      twinBad(){ aTone({ f:220, f2:150, type:'square', lp:900, d:.22, v:.07 }); aTone({ f:233, f2:160, type:'square', lp:900, d:.22, v:.05 }); aThump({ f:120, f2:60, d:.16, v:.12 }); },
      twinLate(){ aTone({ f:440, f2:220, type:'triangle', d:.32, v:.08 }); aTone({ f:330, f2:165, type:'triangle', t:.12, d:.3, v:.06 }); },
      twinSlow(){ aTone({ f:520, type:'sine', d:.08, v:.06, bus:'ui' }); aTone({ f:390, type:'sine', t:.11, d:.12, v:.06, bus:'ui' }); },
      twinTick(){ aTone({ f:1320, type:'square', lp:2600, d:.04, v:.03, bus:'ui' }); },
      twinCombo(o){ const n = o.n || 5, top = n >= 20 ? 5 : n >= 10 ? 4 : 3; for(let i = 0; i < top; i++) aMarimba(penta(i * 2 + 2, 72), { t:i * .07, v:.13 }); aSparkle({ t:top * .07, root:88, n:4, v:.035 }); },
      twinClear(){ [0, 2, 4, 7].forEach((d, i) => aMarimba(penta(d + 3, 72), { t:i * .07, v:.15 })); aSparkle({ t:.3, n:6, v:.04 }); },
      twinBoss(){ aThump({ f:90, f2:50, d:.5, v:.2 }); aTone({ f:196, type:'sawtooth', lp:900, a:.05, hold:.2, d:.5, v:.05, rev:.4 }); aTone({ f:294, type:'sawtooth', lp:900, t:.18, a:.05, hold:.2, d:.5, v:.045, rev:.4 }); }
    },
    gate:{ twinDeal:120, twinOk:60, twinBad:80, twinSlow:300, twinTick:200 },
    jingle(){ [0, 4, 2, 7, 9, 12].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .075, v:.15 })); [79, 84, 88].forEach((mm, i) => aBell({ f:m2f(mm), t:.5 + i * .04, d:1.1, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.6, n:6 }); }
  };
})();

/* 대전 v3 = 여럿 대전(2~5명 선점, 2026-10-08 사용자 지시): 가운데 카드는 모두 같고 내 카드는 사람마다 다르다.
   가운데 카드와 모든 사람의 카드에 똑같은 그림이 딱 하나(모든 사람에게 같은 그림). 먼저 누른 사람이 그 판을 차지.
   판 수 easy 12 · normal 15 · hard 18, 판마다 12초(느긋하게 19초). 순위 = 차지 수 → 틀린 수 → 마지막 차지 이른 순(엔진 선점 순위) */
const TWIN_PARTY = {
  easy:{ R:12, k:5, W:12, sz:[.85, 1.15], gap:0, trap:.1 },
  normal:{ R:15, k:6, W:12, sz:[.7, 1.3], gap:.25, lure:true, trap:.2 },
  hard:{ R:18, k:7, W:12, sz:[.55, 1.45], gap:.4, lure:true, trap:.3 }
};
Object.assign(NG.twin, {
  duelKind:'shared', duelMax:5, duelEnd:'game', duelRoom:true,
  duelHow:'가운데 카드와 내 카드에 같은 그림 하나 · 먼저 누르면 차지',
  duelHelp:[
    ['가운데 카드와 내 카드', '가운데 카드는 모두 같고, 내 카드는 사람마다 달라요. 그래도 가운데 카드와 똑같은 그림이 딱 하나씩 있어요. 그 그림은 모두에게 같아요.'],
    ['먼저 누르면 차지', '그 그림을 가장 먼저 누른 사람이 이번 카드를 가져가요. 가운데 카드든 내 카드든 눌러도 돼요.'],
    ['막 누르면 손해', '틀리면 1초 동안 못 눌러요. 모양이 같아도 색이 다르면 가짜! 카드를 많이 가져간 사람이 1등이에요.']
  ],
  duelStat:{ unit:'장', get:() => ({ t:G.m.N, mis:G.m.wrong }) },
  duelCfg(o){
    const d = o && ['easy', 'normal', 'hard'].includes(o.diff) ? o.diff : 'normal', c = TWIN_PARTY[d];
    return Object.assign({}, c, { limit:Math.round(c.R * (c.W + 1.5) + 3) });
  },
  duelSlow(cfg){ const W = Math.round((cfg.W || 12) * 1.6); return Object.assign({}, cfg, { W, limit:Math.round(cfg.R * (W + 1.5) + 3) }); },
  /* 컴퓨터는 판마다 게임이 직접 차지시킨다(ptAi). 엔진의 계단 진행은 쓰지 않음(끝나지 않는 결과) */
  duelAi:() => ({ ok:false, T:1e6, sc:0, fail:0 }),
  duelKeys:() => (G && G.m && G.m.party ? G.m.P.map((_, i) => 'r' + i) : []),
  /* 상대 미니 카드: 그 사람 자리의 지금 카드(모든 기기가 같은 씨앗으로 계산하므로 판 번호만 보냄) */
  duelMini:{
    get:() => (G && G.m && G.m.party ? 'r' + G.m.i + ':' + G.m.phase : ''),
    draw(el, s, p){ if(!el || !p) return; const m = G && G.m, sig = m ? m.i + ':' + m.phase : ''; if(el._tw === sig) return; el._tw = sig; el.innerHTML = NG.twin._ptMini(p.pid); }
  }
});
/* 움직이는 배경(core/scene.js): 장난감 방 책상 위 햇빛 먼지. 보이기만 함 */
NG.twin.scene = { kind:'motes', colors:['#FFFFFF', '#FFE9C7', '#F6D9FF'], density:.55, alpha:.8 };
