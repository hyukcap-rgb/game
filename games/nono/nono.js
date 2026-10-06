/* 네모 그림 */

/* ===== 네모 그림 (nono) — 가로·세로 숫자 단서로 칸을 칠해 숨은 그림을 찾는 논리 퍼즐 =====
   · 그림은 rng로 만든 좌우 대칭 도트 그림(무작위 채우기 → 셀룰러 오토마타로 다듬기 → 거울 복사)
   · 줄 단위 논리(가로/세로 한 줄씩 가능한 배치를 겹쳐 확정)만으로 끝까지 풀리는 판만 쓴다 ⇒ 답이 하나뿐
   · 칠하기/✕ 모드, 끌면 한 줄(첫 방향으로 고정), 틀리면 빨간 ✕ + 하트 1개, 줄 완성 시 자동 ✕ 물결 */
NG.nono = (() => {
  const ID = 'nono';
  const SIZES = { 5:180, 7:300, 8:360, 10:600, 12:900, 15:1200 };
  const MAXCL = N => N <= 5 ? 3 : N <= 8 ? 4 : N <= 10 ? 4 : 5;   /* 한 줄 단서 개수 상한(화면 폭 확보) */
  const PALS = [['#FFB347','#F0368A','#8E3CC8'], ['#7FD8FF','#5B7BF0','#8E4BD1'], ['#FFE066','#FF8A3D','#E6457A'], ['#6FE3C1','#2EA8E8','#3A5BD8'], ['#C8EE7A','#4CC38A','#1C8A7A'], ['#FFB3D1','#E86FB0','#7E57D6'], ['#FFD23F','#FF7B54','#C2366B']];

  /* ---------- 줄 풀이기: 단서와 현재 칸(-1 모름, 0 빈칸, 1 칠함)으로 확정되는 칸을 찾는다 ---------- */
  const SB = {};   /* 줄 풀이 임시 버퍼(생성 중 수천 번 불려서 재사용) */
  function solveLine(cl, cells, L){
    const k = cl.length, K = k + 1;
    if(!SB.z || SB.z.length < L + 1 || SB.f.length < (L + 2) * K){ const m = Math.max(L + 2, 32); SB.z = new Int16Array(m); SB.diff = new Int16Array(m); SB.f = new Uint8Array(m * Math.max(K, 12)); SB.b = new Uint8Array(m * Math.max(K, 12)); }
    const z = SB.z, f = SB.f, b = SB.b, diff = SB.diff;
    z[0] = 0;
    for(let i = 0; i < L; i++) z[i + 1] = z[i] + (cells[i] === 0 ? 1 : 0);
    f.fill(0, 0, (L + 1) * K); b.fill(0, 0, (L + 2) * K); diff.fill(0, 0, L + 1);
    f[0] = 1;
    for(let i = 1; i <= L; i++) for(let j = 0; j <= k; j++){
      let v = 0;
      if(cells[i - 1] !== 1 && f[(i - 1) * K + j]) v = 1;
      else if(j > 0){ const s = i - cl[j - 1]; if(s >= 0 && z[i] - z[s] === 0){ if(s === 0){ if(j === 1) v = 1; } else if(cells[s - 1] !== 1 && f[(s - 1) * K + j - 1]) v = 1; } }
      f[i * K + j] = v;
    }
    if(!f[L * K + k]) return null;
    b[L * K + k] = 1;
    for(let i = L - 1; i >= 0; i--) for(let j = k; j >= 0; j--){
      let v = 0;
      if(cells[i] !== 1 && b[(i + 1) * K + j]) v = 1;
      else if(j < k){ const e = i + cl[j]; if(e <= L && z[e] - z[i] === 0){ if(e === L){ if(j === k - 1) v = 1; } else if(cells[e] !== 1 && b[(e + 1) * K + j + 1]) v = 1; } }
      b[i * K + j] = v;
    }
    const out = new Int8Array(L);
    for(let j = 0; j < k; j++){
      const len = cl[j];
      for(let s = 0; s + len <= L; s++){
        const e = s + len; if(z[e] - z[s]) continue;
        const pre = s === 0 ? j === 0 : (cells[s - 1] !== 1 && f[(s - 1) * K + j]);
        if(!pre) continue;
        const suf = e === L ? j === k - 1 : (cells[e] !== 1 && b[(e + 1) * K + j + 1]);
        if(suf){ diff[s]++; diff[e]--; }
      }
    }
    let run = 0;
    for(let i = 0; i < L; i++){
      run += diff[i];
      let canE = false;
      if(cells[i] !== 1) for(let j = 0; j <= k; j++) if(f[i * K + j] && b[(i + 1) * K + j]){ canE = true; break; }
      const canF = run > 0;
      if(canF && canE) out[i] = -1; else if(canF) out[i] = 1; else if(canE) out[i] = 0; else return null;
    }
    return out;
  }
  /* 판 전체: 줄 논리만 반복. solved = 모든 칸 확정, rounds = 반복 횟수(난이도 척도) */
  function solveGrid(N, rows, cols){
    const g = new Int8Array(N * N).fill(-1), dr = new Uint8Array(N).fill(1), dc = new Uint8Array(N).fill(1), line = new Int8Array(N);
    let rounds = 0, any = true;
    while(any){
      any = false; rounds++;
      for(let r = 0; r < N; r++){ if(!dr[r]) continue; dr[r] = 0;
        for(let c = 0; c < N; c++) line[c] = g[r * N + c];
        const o = solveLine(rows[r], line, N); if(!o) return { solved:false, rounds, bad:true };
        for(let c = 0; c < N; c++) if(o[c] !== -1 && g[r * N + c] === -1){ g[r * N + c] = o[c]; dc[c] = 1; any = true; } }
      for(let c = 0; c < N; c++){ if(!dc[c]) continue; dc[c] = 0;
        for(let r = 0; r < N; r++) line[r] = g[r * N + c];
        const o = solveLine(cols[c], line, N); if(!o) return { solved:false, rounds, bad:true };
        for(let r = 0; r < N; r++) if(o[r] !== -1 && g[r * N + c] === -1){ g[r * N + c] = o[r]; dr[r] = 1; any = true; } }
    }
    for(let i = 0; i < N * N; i++) if(g[i] === -1) return { solved:false, rounds };
    return { solved:true, rounds };
  }
  const runs = a => { const o = []; let n = 0; for(const v of a){ if(v) n++; else if(n){ o.push(n); n = 0; } } if(n) o.push(n); return o; };
  function cluesOf(N, pic){
    const rows = [], cols = [];
    for(let r = 0; r < N; r++) rows.push(runs(pic.slice(r * N, r * N + N)));
    for(let c = 0; c < N; c++){ const a = []; for(let r = 0; r < N; r++) a.push(pic[r * N + c]); cols.push(runs(a)); }
    return { rows, cols };
  }
  /* 도트 그림: 가운데일수록 잘 채워지는 무작위 → 이웃 다수결로 다듬기 → 좌우 거울 */
  function makePic(N, rng, fill, asym){   /* asym: 좌우 거울 없이(가려진 숫자 판 — 거울 짝 단서로 ?가 들통나지 않게) */
    const half = asym ? N : Math.ceil(N / 2), c0 = (N - 1) / 2, R = N / 2;
    let g = new Uint8Array(N * N);
    for(let r = 0; r < N; r++) for(let c = 0; c < half; c++){
      const d = Math.hypot((c - c0) / R, (r - c0) / R);
      const p = Math.max(.08, Math.min(.95, fill + .26 * (.6 - d)));
      const v = rng() < p ? 1 : 0; g[r * N + c] = v; if(!asym) g[r * N + N - 1 - c] = v;
    }
    const passes = N >= 10 ? 2 : N >= 7 ? 1 : 0;
    for(let p = 0; p < passes; p++){
      const h = new Uint8Array(N * N);
      for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){
        let cnt = 0, n = 0;
        for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const y = r + dy, x = c + dx; if(y < 0 || x < 0 || y >= N || x >= N) continue; n++; cnt += g[y * N + x]; }
        h[r * N + c] = cnt * 2 > n ? 1 : cnt * 2 < n ? 0 : g[r * N + c];
      }
      g = h;
    }
    return g;
  }
  function picOk(N, g){
    let tot = 0;
    for(let r = 0; r < N; r++){ let s = 0; for(let c = 0; c < N; c++) s += g[r * N + c]; if(!s) return false; tot += s; }
    for(let c = 0; c < N; c++){ let s = 0; for(let r = 0; r < N; r++) s += g[r * N + c]; if(!s) return false; }
    const d = tot / (N * N);
    return d >= .36 && d <= .72;
  }
  function gen(N, rng, o = {}){
    const fill = o.fill || .5, mx = MAXCL(N), want = o.want || (o.boss ? 2 : 1);   /* want·easy는 솔로 난이도 v2만 씀(오늘의 문제는 예전 그대로) */
    let best = null, got = 0;
    for(let t = 0; t < 4000 && got < want; t++){
      const pic = makePic(N, rng, fill);
      if(!picOk(N, pic)) continue;
      const cl = cluesOf(N, pic);
      if(cl.rows.some(a => a.length > mx) || cl.cols.some(a => a.length > mx)) continue;
      const s = solveGrid(N, cl.rows, cl.cols);
      if(!s.solved) continue;
      got++;
      if(!best || (o.easy ? s.rounds < best.rounds : s.rounds > best.rounds)) best = { pic, rows:cl.rows, cols:cl.cols, rounds:s.rounds, tries:t + 1 };
    }
    if(!best){   /* 안전망(사실상 안 옴): 테두리 액자 모양은 줄 논리로 항상 풀린다 */
      const pic = new Uint8Array(N * N); for(let r = 0; r < N; r++) for(let c = 0; c < N; c++) pic[r * N + c] = (r === 0 || c === 0 || r === N - 1 || c === N - 1) ? 1 : 0;
      const cl = cluesOf(N, pic); best = { pic, rows:cl.rows, cols:cl.cols, rounds:2, tries:-1 };
    }
    return best;
  }

  /* ---------- 난이도 v2 확장 풀이기: 두 가지 색 · 가려진 숫자(?) · 거울 그림 ----------
     단서 항목 = { n:길이(0이면 '?' = 길이 모름, 1칸 이상), c:색(1|2), o:가리기 전 길이 }. 줄 값: -1 모름, 0 빈칸, 1·2 색.
     결과 = 칸마다 가능한 값 비트(1 빈칸 · 2 색1 · 4 색2). 줄 논리(+거울 대칭)만으로 다 풀리면 답은 하나뿐이다. */
  const BIT = [1, 2, 4];
  const XB = {};
  function lineX(cl, cells, L){
    const k = cl.length, K = k + 1, S = (L + 1) * K * 3;
    if(!XB.F || XB.F.length < S){ XB.F = new Uint8Array(S * 2); XB.R = new Uint8Array(S * 2); }
    const F = XB.F, R = XB.R;
    F.fill(0, 0, S); R.fill(0, 0, S);
    const b1 = new Int16Array(L + 1), b2 = new Int16Array(L + 1);
    for(let i = 0; i < L; i++){ const v = cells[i]; b1[i + 1] = b1[i] + (v === 0 || v === 2 ? 1 : 0); b2[i + 1] = b2[i] + (v === 0 || v === 1 ? 1 : 0); }
    const ok = (c, s, e) => c === 1 ? b1[e] === b1[s] : b2[e] === b2[s];
    const id = (i, j, p) => (i * K + j) * 3 + p;
    for(let p = 0; p < 3; p++) F[id(L, k, p)] = 1;
    /* F(i,j,p): i칸부터 j번째 묶음 이후를 다 놓을 수 있나(p = 바로 앞 칸 색, 0이면 빈칸/시작) */
    for(let i = L - 1; i >= 0; i--) for(let j = k; j >= 0; j--) for(let p = 0; p < 3; p++){
      let v = 0;
      if(cells[i] <= 0 && F[id(i + 1, j, 0)]) v = 1;
      if(!v && j < k){ const c = cl[j].c, n = cl[j].n;
        if(p !== c){
          if(n){ const e = i + n; if(e <= L && ok(c, i, e) && F[id(e, j + 1, c)]) v = 1; }
          else for(let e = i + 1; e <= L; e++){ if(!ok(c, i, e)) break; if(F[id(e, j + 1, c)]){ v = 1; break; } }
        } }
      F[id(i, j, p)] = v;
    }
    if(!F[id(0, 0, 0)]) return null;
    const d1 = new Int16Array(L + 1), d2 = new Int16Array(L + 1), em = new Uint8Array(L);
    R[id(0, 0, 0)] = 1;
    for(let i = 0; i < L; i++) for(let j = 0; j <= k; j++) for(let p = 0; p < 3; p++){
      const s0 = id(i, j, p); if(!R[s0] || !F[s0]) continue;
      if(cells[i] <= 0 && F[id(i + 1, j, 0)]){ em[i] = 1; R[id(i + 1, j, 0)] = 1; }
      if(j < k){ const c = cl[j].c, n = cl[j].n, d = c === 1 ? d1 : d2;
        if(p !== c){
          const lo = n ? i + n : i + 1, hi = n ? i + n : L;
          for(let e = lo; e <= hi && e <= L; e++){ if(!ok(c, i, e)) break; if(F[id(e, j + 1, c)]){ d[i]++; d[e]--; R[id(e, j + 1, c)] = 1; } }
        } }
    }
    const out = new Uint8Array(L); let r1 = 0, r2 = 0;
    for(let i = 0; i < L; i++){ r1 += d1[i]; r2 += d2[i]; const m = (em[i] ? 1 : 0) | (r1 > 0 ? 2 : 0) | (r2 > 0 ? 4 : 0); if(!m) return null; out[i] = m; }
    return out;
  }
  function colorRuns(a){ const o = []; let n = 0, c = 0; for(const v of a){ if(v && v === c) n++; else { if(n) o.push({ n, c }); n = v ? 1 : 0; c = v; } } if(n) o.push({ n, c }); return o; }
  const runsMatch = (a, cl) => a.length === cl.length && a.every((x, j) => x.c === cl[j].c && (!cl[j].n || cl[j].n === x.n));
  /* 거울 그림의 가로줄: 줄 자체가 좌우 대칭이어야 한다 → 왼쪽 절반만 늘어놓고 확인(단서가 가려진 줄은 대칭만 쓴다) */
  function linePal(cl, cells, L, nc){
    const h = Math.ceil(L / 2), row = new Int8Array(L), out = new Uint8Array(L), V = nc + 1, tot = Math.pow(V, h);
    for(let t = 0; t < tot; t++){
      let x = t, good = true;
      for(let i = 0; i < h; i++){ const v = x % V; x = (x - v) / V; const a = cells[i], b = cells[L - 1 - i]; if((a !== -1 && a !== v) || (b !== -1 && b !== v)){ good = false; break; } row[i] = v; row[L - 1 - i] = v; }
      if(!good || (cl && !runsMatch(colorRuns(row), cl))) continue;
      for(let i = 0; i < L; i++) out[i] |= BIT[row[i]];
    }
    for(let i = 0; i < L; i++) if(!out[i]) return null;
    return out;
  }
  function lineAny(cl, cells, L, nc){
    if(nc === 1 && cl.every(x => x.n)){ const o = solveLine(cl.map(x => x.n), cells, L); if(!o) return null; const out = new Uint8Array(L); for(let i = 0; i < L; i++) out[i] = o[i] === -1 ? 3 : o[i] ? 2 : 1; return out; }
    return lineX(cl, cells, L);
  }
  /* 판 전체(확장): P = { N, rows:[단서|null], cols:[단서|null], mir, nc }. 거울이면 칸이 정해질 때 맞은편 칸도 같이 정해지고, 숨긴 오른쪽 세로줄은 왼쪽 거울 줄 단서를 쓴다 */
  function solveX(P){
    const N = P.N, g = new Int8Array(N * N).fill(-1), dr = new Uint8Array(N).fill(1), dc = new Uint8Array(N).fill(1), line = new Int8Array(N);
    const mir = !!P.mir, nc = P.nc || 1, colCl = c => P.cols[c] || (mir ? P.cols[N - 1 - c] : null);
    const PC = mir ? (P.pc || (P.pc = new Map())) : null;
    let rounds = 0, steps = 0, any = true, bad = false, known = 0, f1 = 0;
    const put = (i, v) => { if(g[i] === v) return; if(g[i] !== -1){ bad = true; return; } g[i] = v; known++; dr[(i / N) | 0] = 1; dc[i % N] = 1; any = true; };
    const take = (o, idx) => { let got = 0; for(let t = 0; t < N; t++){ const i = idx(t); if(g[i] !== -1) continue; const m = o[t], v = m === 1 ? 0 : m === 2 ? 1 : m === 4 ? 2 : -1; if(v < 0) continue; put(i, v); got++; if(mir) put(((i / N) | 0) * N + N - 1 - i % N, v); } return got; };
    while(any && !bad){
      any = false; rounds++;
      for(let r = 0; r < N && !bad; r++){ if(!dr[r]) continue; dr[r] = 0; const cl = P.rows[r]; if(!cl && !mir) continue;
        for(let c = 0; c < N; c++) line[c] = g[r * N + c];
        let o;
        if(mir){   /* 대칭 줄 풀이는 무거워서 (단서, 줄 상태)별로 기억해 둔다(가리기 확인 때 같은 상태가 반복됨) */
          const key = (cl ? cl.map(x => x.n + ':' + x.c).join(',') : '-') + '|' + line.join('');
          o = PC.get(key); if(o === undefined){ o = linePal(cl, line, N, nc); PC.set(key, o); }
        } else o = lineAny(cl, line, N, nc);
        if(!o) return { solved:false, rounds, steps, bad:true };
        if(take(o, t => r * N + t)) steps++; }
      for(let c = 0; c < N && !bad; c++){ if(!dc[c]) continue; dc[c] = 0; const cl = colCl(c); if(!cl) continue;
        for(let r = 0; r < N; r++) line[r] = g[r * N + c];
        const o = lineAny(cl, line, N, nc); if(!o) return { solved:false, rounds, steps, bad:true };
        if(take(o, t => t * N + c)) steps++; }
      if(rounds === 1) f1 = known / (N * N);   /* 첫 바퀴에 바로 정해지는 칸 비율(높을수록 쉬운 출발) */
    }
    if(bad) return { solved:false, rounds, steps, bad:true };
    for(let i = 0; i < N * N; i++) if(g[i] === -1) return { solved:false, rounds, steps };
    return { solved:true, rounds, steps, f1, grid:g };
  }
  function cluesX(N, pic){
    const rows = [], cols = [];
    for(let r = 0; r < N; r++) rows.push(colorRuns(pic.slice(r * N, r * N + N)));
    for(let c = 0; c < N; c++){ const a = []; for(let r = 0; r < N; r++) a.push(pic[r * N + c]); cols.push(colorRuns(a)); }
    return { rows, cols };
  }
  /* 두 번째 색 입히기(좌우 대칭 유지): 아래 띠 · 가운데 동그라미 · 윗면 테두리 중 하나 */
  function colorize(N, pic, rng){
    const out = Uint8Array.from(pic), c0 = (N - 1) / 2;
    let tot = 0; for(const v of pic) tot += v;
    for(let a = 0; a < 4; a++){
      const mode = Math.floor(rng() * 3), t = rng(), cut = Math.round(N * (.4 + t * .3)), cy = N * (.3 + t * .4);
      let n2 = 0;
      for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){ const i = r * N + c; if(!pic[i]) continue;
        const two = mode === 0 ? r >= cut : mode === 1 ? Math.hypot(r - cy, (c - c0) * 1.1) < N * .3 : (r === 0 || !pic[i - N]);
        out[i] = two ? 2 : 1; if(two) n2++; }
      if(n2 >= tot * .18 && n2 <= tot * .6) return out;
    }
    return null;
  }
  /* 개념 판 만들기: 도트 그림(→ 색) → 줄 논리로 풀리는지 → 숫자 가리기/가로 단서 숨기기(가릴 때마다 여전히 하나로 풀리는지 확인) */
  function genX(N, rng, o){
    const mj = o.mj || [], has = x => mj.indexOf(x) >= 0;
    const col = has('color'), mys = has('mystery'), mir = has('mirror'), nc = col ? 2 : 1;
    const mx = MAXCL(N) + (col ? 1 : 0), want = o.want || 1, t0 = performance.now(), budget = o.budget || 320, h = Math.ceil(N / 2);
    const pool = [];
    for(let t = 0; t < 3000 && pool.length < want; t++){
      const dt = performance.now() - t0; if(pool.length ? dt > budget : dt > budget * 3) break;
      let pic = makePic(N, rng, o.fill || .5, mys && !mir);
      if(!picOk(N, pic)) continue;
      if(col){ pic = colorize(N, pic, rng); if(!pic) continue; }
      const cl = cluesX(N, pic);
      if(cl.rows.some(a => a.length > mx) || cl.cols.some(a => a.length > mx)) continue;
      const P = { N, rows:cl.rows, cols:cl.cols.map((a, c) => mir && c >= h ? null : a), mir, nc };
      let s = solveX(P); if(!s.solved) continue;
      let hid = 0, rh = 0;
      if(mys && o.q){
        const items = [];
        P.rows.forEach(a => a && a.forEach(x => items.push(x))); P.cols.forEach(a => a && a.forEach(x => items.push(x)));
        shuffle(items, rng);
        for(const x of items){ if(hid >= o.q) break; x.o = x.n; x.n = 0; const s2 = solveX(P); if(s2.solved && s2.rounds <= (o.maxR || 99)){ s = s2; hid++; } else { x.n = x.o; delete x.o; } }
      }
      if(mir && o.mh){   /* 가로 단서를 통째로 숨긴다(세로 숫자와 대칭으로 알아내야 함). 왼쪽 세로 단서는 많아야 1줄만 */
        const ls = shuffle(Array.from({ length:N }, (_, i) => i), rng); if(o.mh >= 4) ls.push(N + Math.floor(rng() * h));
        for(const x of ls){ if(rh >= o.mh) break; const A = x < N ? P.rows : P.cols, j = x < N ? x : x - N, keep = A[j]; A[j] = null; const s2 = solveX(P); if(s2.solved && s2.rounds <= (o.maxR || 99)){ s = s2; rh++; } else A[j] = keep; }
      }
      pool.push({ pic, rowsX:P.rows, colsX:P.cols, rounds:s.rounds, steps:s.steps, f1:s.f1, hid, rh, tries:t + 1 });
    }
    if(!pool.length) return null;
    /* 후보 여러 장을 난이도 점수로 줄 세우고 자리(rank 0 쉬움 ~ 1 어려움)에 맞는 것을 고른다 */
    const sc = x => x.rounds * 10 + (1 - x.f1) * 25 + x.steps / N * 4 + x.hid + x.rh * 2;
    pool.sort((a, b) => sc(a) - sc(b));
    const rank = o.rank != null ? o.rank : o.easy ? 0 : 1;
    return pool[Math.round(rank * (pool.length - 1))];
  }
  /* 솔로 판: 개념(색·?·거울)이 없으면 예전 생성기, 있으면 genX. 너무 무거우면 가리기를 줄이고 → 거울을 빼고 → 기본 판으로 물러선다 */
  const GEN_MJ = ['mystery', 'color', 'mirror'];
  function genSolo(N, rng, cfg){
    const mj = (cfg.mj || []).filter(x => GEN_MJ.indexOf(x) >= 0);
    let p = null, used = mj;
    p = genX(N, rng, Object.assign({}, cfg, { mj }));
    if(!p && mj.length){
      if(cfg.q || cfg.mh) p = genX(N, rng, Object.assign({}, cfg, { mj, q:Math.floor((cfg.q || 0) / 2), mh:0, want:1 }));
      if(!p && mj.length > 1){ used = mj.filter(x => x !== 'mirror'); p = genX(N, rng, Object.assign({}, cfg, { mj:used, want:1 })); }
      if(!p) used = [];
    }
    if(!p){
      const q = gen(N, rng, cfg);
      p = { pic:q.pic, rowsX:q.rows.map(a => a.map(n => ({ n, c:1 }))), colsX:q.cols.map(a => a.map(n => ({ n, c:1 }))), rounds:q.rounds, steps:0, hid:0, rh:0, tries:q.tries };
    }
    p.used = (cfg.mj || []).filter(x => GEN_MJ.indexOf(x) < 0 || used.indexOf(x) >= 0);
    return p;
  }

  /* ---------- 그림 조각(아이콘·✕) ---------- */
  const ZOOM = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const WATCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFB020" stroke="#1A0F45" stroke-width="1.6"/><circle cx="12" cy="13.5" r="6.2" fill="#FFF8EA"/><rect x="10.2" y="1.8" width="3.6" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.6v4.2l2.8 1.7" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>';
  const BULB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a6.8 6.8 0 0 0-4 12.3c.7.5 1.1 1.3 1.1 2.1V18h5.8v-1.1c0-.8.4-1.6 1.1-2.1A6.8 6.8 0 0 0 12 2.5z" fill="#FFD23F" stroke="#1A0F45" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.3 19.3h5.4v1.2a1.8 1.8 0 0 1-1.8 1.8h-1.8a1.8 1.8 0 0 1-1.8-1.8z" fill="#8E6BD1" stroke="#1A0F45" stroke-width="1.3"/><path d="M9.8 7.6a3 3 0 0 1 2.2-1.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
  const SQ = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" rx="3.2" fill="#3A2A92" stroke="#1A0F45" stroke-width="1.6"/><path d="M5.5 6.5h6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".45"/></svg>';
  const MIR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5v17" stroke="currentColor" stroke-width="1.7" stroke-dasharray="2.2 2"/><path d="M7.8 5.5L2.5 10l5.3 4.5zM12.2 5.5l5.3 4.5-5.3 4.5z" fill="currentColor"/></svg>';
  const XS = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';
  const xUri = c => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M5.5 5.5l9 9M14.5 5.5l-9 9' stroke='${c}' stroke-width='2.6' stroke-linecap='round'/></svg>`)}")`;

  /* ---------- 게임 상태 도우미 ---------- */
  const $n = s => document.querySelector(s);
  const nnDuel = () => !!(G && G.duel && !G.duel.fleet);
  const NN_DUEL_LOCK = 800, NN_DUEL_PEN = 30;   /* 대전: 틀리면 0.8초 못 누름 · −30점 */
  const cellEl = i => G.nnEls ? G.nnEls[i] : null;
  const isFilled = s => s === 1 || s === 4;
  function lineDone(kind, k){
    const N = G.N;
    for(let t = 0; t < N; t++){ const i = kind === 'r' ? k * N + t : t * N + k; if(G.sol[i] && !isFilled(G.cells[i])) return false; }
    return true;
  }
  function stateCls(s){ return s === 1 ? ' f' : s === 4 ? ' f h' : s === 2 ? ' x' : s === 3 ? ' w' : s === 5 ? ' x a' : ''; }
  function paint(i, extra){
    const el = cellEl(i); if(!el) return;
    const s = G.cells[i];
    let cls = G.nnBase[i] + stateCls(s) + (G.fc && G.fc[i] === 2 && isFilled(s) ? ' c2' : '') + (extra ? ' ' + extra : '');
    if(G.nnHl){ const N = G.N; if(Math.floor(i / N) === G.nnHl[0] || i % N === G.nnHl[1]) cls += ' hl'; }
    if(G.nnCur === i) cls += ' cur';
    el.className = cls;
  }
  function hud(){
    const c = $n('#nnCnt'); if(c) c.textContent = G.found + '/' + G.total;
    const bar = $n('#nnBar'); if(bar) bar.style.width = Math.min(100, G.found / G.total * 100).toFixed(1) + '%';
    const h = $n('#nnHintN'), hb = $n('#nnHint');
    if(h){ h.textContent = G.hints; h.classList.toggle('off', !G.hints); }
    if(hb) hb.disabled = !G.hints || G.done;
    const ck = $n('#nnChk'); if(ck){ const ready = G.found >= G.total && !G.done && !G.nnChk; ck.disabled = !ready; ck.classList.toggle('ready', ready); }
    drawPrev();
  }
  function lives(){
    const mn = $n('#nnMis'); if(mn){ mn.textContent = G.miss || 0; $n('#nnMisC').setAttribute('aria-label', '실수 ' + (G.miss || 0) + '번'); }   /* 대전: 기회 대신 실수 횟수 */
    const el = $n('#nnLives'); if(!el) return;
    const MP = G.nnMaxP || 3, prev = +(el.dataset.n || MP);
    /* 기회 = 별(공용 .hlives). 하트는 사이트 재화 전용이라 쓰지 않는다 */
    el.innerHTML = Array.from({ length:MP }, (_, k) => k).map(k => `<i class="${k >= G.paws ? 'off' + (k === G.paws && G.paws < prev ? ' lost' : '') : ''}${G.paws === 1 && k === 0 ? ' last' : ''}">★</i>`).join('');
    el.dataset.n = G.paws; el.setAttribute('aria-label', '남은 기회 ' + G.paws + '번');
    const fr = $n('#nnFrame');
    if(fr){ fr.classList.toggle('danger', G.paws === 1 && !G.over); const tag = fr.querySelector('.nn-last');
      if(G.paws === 1 && !tag && !G.done){ const t = document.createElement('div'); t.className = 'nn-last'; t.textContent = '마지막 기회!'; fr.appendChild(t); } else if(G.paws !== 1 && tag) tag.remove(); }
  }
  /* 모서리 미리보기: 지금까지 찾은 칸이 작은 그림으로 */
  function drawPrev(){
    const cv = G.nnPrev; if(!cv) return;
    const ctx = cv.getContext('2d'), N = G.N, W = cv.width, u = W / N;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#FFFDF6'; ctx.fillRect(0, 0, W, W);
    for(let i = 0; i < N * N; i++){
      if(!isFilled(G.cells[i])) continue;
      const r = Math.floor(i / N), c = i % N;
      ctx.fillStyle = G.nnWin ? G.nnCol[i] : G.fc && G.fc[i] === 2 ? '#F0602E' : '#3A2A92';
      ctx.fillRect(Math.floor(c * u), Math.floor(r * u), Math.ceil(u), Math.ceil(u));
    }
  }
  function colorAt(i){   /* 완성 그림 색: 위→아래 3색 그라데이션 + 도트 느낌 체크무늬 */
    const N = G.N, r = Math.floor(i / N), c = i % N, t = (r * .78 + Math.abs(c - (N - 1) / 2) * .44) / ((N - 1) || 1);
    const P = G.nnPal.map(x => [1, 3, 5].map(k => parseInt(x.slice(k, k + 2), 16)));
    const u = Math.min(1, t) * 2, [A, B] = u < 1 ? [P[0], P[1]] : [P[1], P[2]], w = u < 1 ? u : u - 1, dim = (r + c) % 2 ? .93 : 1;
    return 'rgb(' + A.map((v, k) => Math.round((v + (B[k] - v) * w) * dim)).join(',') + ')';
  }
  function colorAt2(i){   /* 두 가지 색 판의 두 번째 색: 노랑 → 주황 */
    const N = G.N, r = Math.floor(i / N), c = i % N, w = r / ((N - 1) || 1), dim = (r + c) % 2 ? .93 : 1, A = [255, 214, 90], B = [255, 110, 60];
    return 'rgb(' + A.map((v, k) => Math.round((v + (B[k] - v) * w) * dim)).join(',') + ')';
  }


  /* ---------- 칸 조작 ---------- */
  function doFill(i, n){
    const s = G.cells[i]; if(s !== 0) return 'skip';
    if(G.blind){   /* 확인 없이: 맞는지 알려 주지 않고 칠한다(채점 때 확인) */
      G.cells[i] = 1; G.fc[i] = G.nnC; G.found++; paint(i, 'pop');
      const el = cellEl(i); if(el && !G.nnQuiet){ const p = fxCenter(el); sfx('nonoFill', { n, pan:panX(p.x) }); fxBuzz(6); }
      afterFill([i], i); return 'ok';
    }
    if(!G.sol[i]){ wrong(i); return 'bad'; }
    if(G.sol[i] !== G.nnC){ wrong(i); if(!G.done) afterFill([i], i); return 'bad'; }   /* 두 가지 색: 색을 잘못 고름 → 실수, 맞는 색으로 바로잡아 보여 준다 */
    G.cells[i] = 1; G.fc[i] = G.nnC; G.found++; G.mine++; G.combo++;
    paint(i, 'pop');
    const el = cellEl(i);
    if(el && !G.nnQuiet){
      const p = fxCenter(el);
      fxBurst(p.x, p.y, ['#6C4EE0', '#FFD23F', '#FFFFFF', '#B9A8FF'], 6, { speed:150, size:3.2, kinds:['star', 'dot', 'spark'], up:60, g:520, dur:.5 });
      sfx('nonoFill', { n, pan:panX(p.x) }); fxBuzz(8);
      if(G.combo >= 10 && G.combo % 10 === 0){ fxCombo(Math.min(5, G.combo / 5)); const cb = document.querySelector('.fxcombo b'); if(cb) cb.textContent = '연속 ' + G.combo; sfx('chain', { n:5 }); }
    }
    afterFill([i], i);
    return 'ok';
  }
  function doMark(i, on){
    const s = G.cells[i];
    if(on && s === 0){ G.cells[i] = 2; paint(i, 'xin'); return true; }
    if(!on && s === 2){ G.cells[i] = 0; paint(i); return true; }
    return false;
  }
  function wrong(i){
    const sc = G.sol[i];
    if(sc){ if(!isFilled(G.cells[i]) && !G.blind) G.found++; G.cells[i] = 1; G.fc[i] = sc; G.nnFixed++; }   /* 색만 틀림: 맞는 색으로 */
    else { if(G.blind && isFilled(G.cells[i])) G.found--; G.cells[i] = 3; }
    G.combo = 0; G.miss++;
    paint(i, 'bad');
    const el = cellEl(i), p = el ? fxCenter(el) : { x:innerWidth / 2, y:innerHeight / 2, w:20, h:20 };
    fxRing(p.x, p.y, '#E5484D', p.w * 2.2, .45, 7);
    fxBurst(p.x, p.y, ['#E5484D', '#FF9AA4', '#7A1030'], 10, { speed:190, size:3.6, kinds:['rect', 'dot'], g:900, up:20 });
    const fr = $n('#nnFrame'); if(fr && !FXR.reduce){ fr.classList.remove('shake'); void fr.offsetWidth; fr.classList.add('shake'); }
    if(nnDuel()){   /* 대전(WP10): 기회 별 없음 — 틀리면 −30점 + 0.8초 못 누름, 판은 계속 */
      G.nnLock = Date.now() + NN_DUEL_LOCK; if(drag) drag.act = null;
      const bd = $n('#bd'); if(bd){ bd.classList.add('lock'); setTimeout(() => { const b2 = $n('#bd'); if(b2) b2.classList.remove('lock'); }, NN_DUEL_LOCK); }
      sfx('fBad'); fxBuzz([70, 40, 110]); fxFloat(p.x, p.y - p.h * .6, '−' + NN_DUEL_PEN, 'bad');
      const mc = $n('#nnMisC'); if(mc){ mc.classList.remove('hurt'); void mc.offsetWidth; mc.classList.add('hurt'); }
      lives(); return;
    }
    fxVignette(); sfx('fBad'); fxBuzz([70, 40, 110]);
    const hs = document.querySelectorAll('#nnLives i'), lostEl = hs[G.paws - 1];
    if(lostEl && !FXR.reduce){
      const q = fxCenter(lostEl), d = document.createElement('div'); d.className = 'ng-nono nn-lost'; d.textContent = '★';
      d.style.left = (q.x - 14) + 'px'; d.style.top = (q.y - 14) + 'px'; document.body.appendChild(d);
      d.animate([{ transform:'translate(0,0) rotate(0)', opacity:1 }, { transform:'translate(-8px,-26px) rotate(-30deg) scale(1.3)', opacity:1, offset:.25 }, { transform:'translate(26px,150px) rotate(200deg) scale(.6)', opacity:0 }], { duration:900, easing:'cubic-bezier(.3,0,.7,1)' }).onfinish = () => d.remove();
    }
    G.paws--; lives();
    const pill = $n('#nnLivesC'); if(pill){ pill.classList.remove('hurt'); void pill.offsetWidth; pill.classList.add('hurt'); }
    fxFloat(p.x, p.y - p.h * .6, '−1', 'bad');
    if(G.paws <= 0){ G.done = true; endDrag(); hud(); setTimeout(() => { if(!G.over) finish(false); }, 900); }
  }
  /* 칸을 채운 뒤: 줄 완성 확인(단서 흐리게 + 남은 칸 자동 ✕ 물결) → 승리 확인 */
  function afterFill(list, origin){
    const N = G.N, rs = new Set(), cs = new Set();
    for(const i of list){ rs.add(Math.floor(i / N)); cs.add(i % N); }
    if(G.blind){ blindLines(rs, cs); hud(); return; }
    let k = 0;
    const o = origin != null ? origin : list[0], or = Math.floor(o / N), oc = o % N;
    for(const r of rs) if(!G.rowDone[r] && lineDone('r', r)){ G.rowDone[r] = 1; if(!G.nodone){ k++; lineWave('r', r, oc); } }
    for(const c of cs) if(!G.colDone[c] && lineDone('c', c)){ G.colDone[c] = 1; if(!G.nodone){ k++; lineWave('c', c, or); } }
    if(k && !G.nnQuiet) sfx('nonoLine', { k });
    hud();
    if(G.found >= G.total) win();
  }
  function lineWave(kind, k, from){
    const N = G.N;
    const ce = document.querySelector(kind === 'r' ? `#nnRC [data-k="${k}"]` : `#nnCC [data-k="${k}"]`);
    if(ce){ ce.classList.add('done'); ce.classList.remove('dpop'); void ce.offsetWidth; ce.classList.add('dpop');
      ce.querySelectorAll('i.q').forEach(e => { e.textContent = e.dataset.o; e.classList.add('rv'); }); }   /* 가려진 숫자: 줄을 다 채우면 진짜 숫자가 보인다 */
    for(let t = 0; t < N; t++){
      const i = kind === 'r' ? k * N + t : t * N + k, s = G.cells[i], el = cellEl(i);
      if(s === 0 || s === 2) G.cells[i] = 5;
      if(!el) continue;
      const d = Math.abs(t - from) * 34;
      paint(i, isFilled(G.cells[i]) ? 'lw' : G.cells[i] === 5 ? 'xin' : '');
      el.style.setProperty('--d', d + 'ms');
    }
    if(ce && !G.nnQuiet){ const p = fxCenter(ce); fxBurst(p.x, p.y, ['#FFD23F', '#FFFFFF', '#3EC9A5'], 8, { speed:160, size:4, kinds:['star', 'spark'], up:80, g:300, glow:true, dur:.7 }); }
  }
  function win(){
    if(G.done) return;
    G.done = true; G.winSec = elapsed(); G.nnWin = true; endDrag();
    if(G.nnZoom){ G.nnZoom = false; layout(); }   /* 완성 그림은 판 전체로 보여 준다 */
    const N = G.N, bd = $n('#bd'), fr = $n('#nnFrame');
    const c0 = (N - 1) / 2;
    for(let i = 0; i < N * N; i++){
      const el = cellEl(i); if(!el) continue;
      const r = Math.floor(i / N), c = i % N, d = Math.hypot(r - c0, c - c0);
      el.style.setProperty('--pc', G.nnCol[i]); el.style.setProperty('--d', Math.round(d * 55) + 'ms');
    }
    if(bd) bd.classList.add('win');
    if(fr) fr.classList.remove('danger');
    const tag = fr && fr.querySelector('.nn-last'); if(tag) tag.remove();
    drawPrev(); hud();
    sfx('nonoReveal');
    setTimeout(() => {
      if(G.over) return;
      fxConfetti(); sfx('win', { g:ID }); fxBuzz([30, 60, 30, 60, 80]);
      if(bd){ const d = document.createElement('div'); d.className = 'nn-stamp'; d.textContent = '그림 완성!'; bd.appendChild(d);
        setTimeout(() => { const p = fxCenter(d); fxRing(p.x, p.y, '#FFD23F', p.w * .8, .6, 10); if(fr && !FXR.reduce){ fr.classList.remove('bump'); void fr.offsetWidth; fr.classList.add('bump'); setTimeout(() => { if(fr.isConnected) fr.classList.add('won'); }, 520); } }, 300); }
    }, 350 + N * 40);
    setTimeout(() => { if(!G.over) finish(true); }, 1700 + N * 50);
  }
  function hint(){
    if(G.over || G.paused || G.done || G.hints < 1) return;
    const N = G.N, cand = [];
    for(let k = 0; k < N; k++){
      for(const kind of ['r', 'c']){
        if((kind === 'r' ? G.rowDone : G.colDone)[k]) continue;
        let left = 0, need = 0;
        for(let t = 0; t < N; t++){ const i = kind === 'r' ? k * N + t : t * N + k; if(G.sol[i]){ need++; if(!isFilled(G.cells[i])) left++; } }
        const cl = kind === 'r' ? G.rows[k] : G.cols[k], tight = cl.reduce((a, b) => a + b, 0) + cl.length - 1;
        cand.push({ kind, k, left, tight });
      }
    }
    if(!cand.length) return;
    /* 가장 많이 남은 줄(막힌 곳일 가능성이 큰 곳), 같으면 단서가 빡빡한 줄 */
    cand.sort((a, b) => b.left - a.left || b.tight - a.tight || (a.kind < b.kind ? -1 : 1) || a.k - b.k);
    const h = cand[0], got = [];
    G.hints--; G.hintLines++;
    for(let t = 0; t < N; t++){
      const i = h.kind === 'r' ? h.k * N + t : t * N + h.k, s = G.cells[i];
      if(G.sol[i]){ if(!isFilled(s) || G.fc[i] !== G.sol[i]){ if(!isFilled(s)) G.found++; G.cells[i] = 4; G.fc[i] = G.sol[i]; G.hintCells++; got.push(i); paint(i, 'hin'); } }
      else if(s === 0 || s === 2){ G.cells[i] = 5; paint(i, 'xin'); }
      else if(G.blind && isFilled(s)){ G.cells[i] = 5; G.found--; paint(i, 'xin'); }   /* 확인 없이: 힌트 줄의 잘못 칠한 칸은 실수 없이 지워 준다 */
      const el = cellEl(i); if(el) el.style.setProperty('--d', t * 40 + 'ms');
    }
    sfx('fHint'); fxBuzz(15);
    const ce = document.querySelector(h.kind === 'r' ? `#nnRC [data-k="${h.k}"]` : `#nnCC [data-k="${h.k}"]`);
    if(ce){ const p = fxCenter(ce); fxBurst(p.x, p.y, ['#FFE27A', '#FFFFFF', '#9C7BD8'], 14, { speed:170, size:4, kinds:['spark', 'star'], glow:true, up:110, g:220 }); fxFloat(p.x, p.y, '힌트'); }
    if(got.length) afterFill(got, got[0]); else afterFill([h.kind === 'r' ? h.k * N : h.k], null);
  }

  /* ---------- 입력: 누르기·끌기(첫 방향으로 고정)·키보드 ---------- */
  let drag = null;
  function hl(r, c){
    if(!G.nnEls) return;
    const N = G.N;
    if(G.nnHl && G.nnHl[0] === r && G.nnHl[1] === c) return;
    if(G.nnHl){ const [r0, c0] = G.nnHl; document.querySelectorAll('#nnRC .on, #nnCC .on').forEach(e => e.classList.remove('on'));
      for(let t = 0; t < N; t++){ G.nnEls[r0 * N + t].classList.remove('hl'); G.nnEls[t * N + c0].classList.remove('hl'); } }
    G.nnHl = r < 0 ? null : [r, c];
    if(r < 0) return;
    const rc = document.querySelector(`#nnRC [data-k="${r}"]`), cc = document.querySelector(`#nnCC [data-k="${c}"]`);
    if(rc) rc.classList.add('on'); if(cc) cc.classList.add('on');
    for(let t = 0; t < N; t++){ G.nnEls[r * N + t].classList.add('hl'); G.nnEls[t * N + c].classList.add('hl'); }
  }
  function actFor(i){
    const s = G.cells[i];
    if(G.mode === 'fill'){
      if(G.blind && s === 1) return G.fc[i] === G.nnC ? 'unfill' : 'recolor';   /* 확인 없이: 칠한 칸을 다시 누르면 지우기(다른 색이면 바꾸기) */
      return s === 0 ? 'fill' : s === 2 ? 'blocked' : null;
    }
    return s === 0 ? 'mark' : s === 2 ? 'clear' : null;
  }
  function apply(i, act){
    if(act === 'fill'){ drag && drag.n++; const r = doFill(i, drag ? drag.n : 0); if(r === 'bad' && drag) drag.act = null; return; }
    if(act === 'unfill'){ if(G.cells[i] === 1 && G.fc[i] === G.nnC){ G.cells[i] = 0; G.found--; paint(i); sfx('fErase'); afterFill([i], i); } return; }
    if(act === 'recolor'){ if(G.cells[i] === 1 && G.fc[i] !== G.nnC){ G.fc[i] = G.nnC; paint(i, 'pop'); sfx('nonoFill', { n:drag ? drag.n++ : 0 }); afterFill([i], i); } return; }
    if(act === 'mark'){ if(doMark(i, true)){ sfx('nonoMark', { n:drag ? drag.n++ : 0 }); fxBuzz(5); } return; }
    if(act === 'clear'){ if(doMark(i, false)) sfx('fErase'); }
  }
  function cellFromPt(x, y, clamp){
    const bd = $n('#bd'); if(!bd) return null;
    const R = bd.getBoundingClientRect(), N = G.N;
    let c = Math.floor((x - R.left) / (R.width / N)), r = Math.floor((y - R.top) / (R.height / N));
    if(!clamp && (r < 0 || c < 0 || r >= N || c >= N)) return null;
    r = Math.max(0, Math.min(N - 1, r)); c = Math.max(0, Math.min(N - 1, c));
    return [r, c];
  }
  function down(e){
    if(G.over || G.paused || G.done || G.nnChk || (G.nnLock && Date.now() < G.nnLock)) return;
    const p = cellFromPt(e.clientX, e.clientY, false); if(!p) return;
    e.preventDefault();
    try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
    const [r, c] = p, i = r * G.N + c, act = actFor(i);
    setCur(-1);
    drag = { id:e.pointerId, r, c, axis:null, act, last:0, n:0, done:new Set([i]) };
    hl(r, c);
    if(act === 'blocked'){ sfx('nonoNo'); const el = cellEl(i); if(el){ el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); } drag.act = null; return; }
    if(act) apply(i, act);
  }
  function move(e){
    if(!drag || e.pointerId !== drag.id || G.done) return;
    const p = cellFromPt(e.clientX, e.clientY, true); if(!p) return;
    let [r, c] = p;
    if(!drag.axis){ if(r === drag.r && c === drag.c) return; drag.axis = Math.abs(r - drag.r) > Math.abs(c - drag.c) ? 'c' : 'r'; }
    if(drag.axis === 'r') r = drag.r; else c = drag.c;
    hl(r, c);
    if(!drag.act) return;
    const t = drag.axis === 'r' ? c - drag.c : r - drag.r, st = Math.sign(t);
    for(let k = st; k !== t + st && drag.act; k += st){   /* 빠르게 끌어도 사이 칸을 건너뛰지 않게 */
      const i = drag.axis === 'r' ? drag.r * G.N + drag.c + k : (drag.r + k) * G.N + drag.c;
      if(drag.done.has(i)) continue; drag.done.add(i);
      apply(i, drag.act);
    }
  }
  function endDrag(){ drag = null; hl(-1, -1); }
  function setCur(i){
    if(!G.nnEls) return;
    if(G.nnCur >= 0 && G.nnEls[G.nnCur]) G.nnEls[G.nnCur].classList.remove('cur');
    G.nnCur = i;
    if(i >= 0){ G.nnEls[i].classList.add('cur'); hl(Math.floor(i / G.N), i % G.N); }
  }
  function key(e){
    if(!G || G.id !== ID || G.over || G.paused || G.done) return;
    const v = document.getElementById('veil'); if(v && v.classList.contains('on')) return;
    const N = G.N, k = e.key;
    const mv = { ArrowUp:[-1, 0], ArrowDown:[1, 0], ArrowLeft:[0, -1], ArrowRight:[0, 1] }[k];
    if(mv){ e.preventDefault(); let i = G.nnCur < 0 ? 0 : G.nnCur; if(G.nnCur >= 0){ const r = Math.max(0, Math.min(N - 1, Math.floor(i / N) + mv[0])), c = Math.max(0, Math.min(N - 1, i % N + mv[1])); i = r * N + c; } setCur(i); sfx('sSel'); return; }
    if(k === 'x' || k === 'X' || k === 'Tab'){ e.preventDefault(); if(G.nomark){ sfx('nonoNo'); return; } setMode(G.mode === 'fill' ? 'mark' : 'fill'); return; }
    if(G.twoC && (k === 'c' || k === 'C' || k === '1' || k === '2')){ e.preventDefault(); setMode(k === '1' ? 'fill' : k === '2' ? 'fill2' : G.mode === 'fill' && G.nnC === 1 ? 'fill2' : 'fill'); return; }
    if(G.blind && (k === 'Enter' && e.shiftKey)){ e.preventDefault(); check(); return; }
    if((k === ' ' || k === 'Enter') && G.nnCur >= 0){ e.preventDefault(); const a = actFor(G.nnCur); if(a === 'blocked') sfx('nonoNo'); else if(a) apply(G.nnCur, a); }
  }
  function setMode(m){
    if(m === 'mark' && G.nomark) return;
    G.mode = m === 'fill2' ? 'fill' : m; if(m !== 'mark') G.nnC = m === 'fill2' ? 2 : 1;
    document.querySelectorAll('#nnSeg button').forEach(b => { const on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const sg = $n('#nnSeg'); if(sg) sg.dataset.m = m;
    sfx('toggle', { on:m !== 'mark' });
  }
  /* 확인 없이: 채점 → 틀린 칸을 하나씩 보여 주고 칸마다 실수 1번. 다 맞으면 완성 */
  function check(){
    if(!G.blind || G.over || G.paused || G.done || G.nnChk || G.found < G.total) return;
    const bad = [];
    for(let i = 0; i < G.N * G.N; i++) if(isFilled(G.cells[i]) && G.fc[i] !== G.sol[i]) bad.push(i);
    endDrag();
    if(!bad.length){ G.mine = Math.max(0, G.total - G.hintCells - G.nnFixed); win(); return; }
    G.nnChk = true; hud();
    const bd = $n('#bd'); if(bd){ const p = fxCenter(bd); fxFloat(p.x, p.y, '틀린 칸 ' + bad.length + '개!', 'bad'); }
    sfx('nonoNo');
    bad.forEach((i, t) => setTimeout(() => {
      if(!G || G.id !== ID || G.over) return;
      if(!G.done) wrong(i);
      if(t === bad.length - 1){
        G.nnChk = false;
        const N = G.N, rs = new Set(), cs = new Set(); bad.forEach(j => { rs.add(Math.floor(j / N)); cs.add(j % N); }); blindLines(rs, cs); hud();
        if(!G.done && G.found >= G.total){ let ok = true; for(let j = 0; j < N * N; j++) if(isFilled(G.cells[j]) && G.fc[j] !== G.sol[j]){ ok = false; break; } if(ok){ G.mine = Math.max(0, G.total - G.hintCells - G.nnFixed); win(); } }
      }
    }, 450 + t * 280));
  }
  /* 확인 없이의 줄 완성 표시: 정답이 아니라 '내가 칠한 모양이 숫자와 같은지'만 본다(정답을 흘리지 않게). ✕ 자동 채우기 없음 */
  function blindLines(rs, cs){
    if(G.nodone) return;
    const N = G.N, v = i => isFilled(G.cells[i]) ? G.fc[i] : 0;
    const one = (kind, k) => {
      const cl = (kind === 'r' ? G.rowX : G.colX)[k]; if(!cl) return;
      const a = []; for(let t = 0; t < N; t++) a.push(v(kind === 'r' ? k * N + t : t * N + k));
      const ok = runsMatch(colorRuns(a), cl), D = kind === 'r' ? G.rowDone : G.colDone;
      if(!!D[k] === ok) return; D[k] = ok ? 1 : 0;
      const ce = document.querySelector(kind === 'r' ? `#nnRC [data-k="${k}"]` : `#nnCC [data-k="${k}"]`);
      if(ce){ ce.classList.toggle('done', ok); if(ok){ ce.classList.remove('dpop'); void ce.offsetWidth; ce.classList.add('dpop'); } }
      if(ok && !G.nnQuiet) sfx('nonoLine', { k:1 });
    };
    for(const r of rs) one('r', r); for(const c of cs) one('c', c);
  }

  /* 문서 맨 위에서 요소까지 거리(등장 애니메이션의 transform에 흔들리지 않게 offsetTop으로) */
  const docTop = el => { let t = 0; for(let e = el; e; e = e.offsetParent) t += e.offsetTop; return t; };
  /* ---------- 크기 계산: 폭(단서 영역 포함)과 높이에 맞춰 칸 크기를 정한다 ---------- */
  function layout(){
    const root = $n('#nnRoot'), grid = $n('#nnGrid'); if(!root || !grid) return;
    const N = G.N, avail = root.clientWidth - 16;   /* 판 패널 테두리·안쪽 여백 */
    /* 화면 아래까지 채운다: 판은 남은 높이만큼 키우고, 조작 줄은 엄지가 닿는 아래쪽 */
    const top = docTop(root);
    root.style.minHeight = Math.max(0, Math.min(innerHeight, Math.floor(innerHeight - top - 10))) + 'px';
    const rl = $n('#nnRules'), extra = rl ? rl.offsetHeight + 8 : 0;
    const hd = $n('#nnHud'), ct = $n('#nnCtrl'), tp = $n('#nnTip');
    const below = (hd ? hd.offsetHeight + 8 : 56) + (ct ? ct.offsetHeight : 56) + (tp ? tp.offsetHeight + 8 : 0) + 14 + 16 + 12;
    const maxH = Math.max(240, innerHeight - top - below - extra);
    const pad = G.twoC ? .34 : 0;   /* 두 색 단서는 동그란 배지라 폭이 조금 더 든다 */
    const wOf = (cl, f) => cl.reduce((a, v) => a + ((v >= 10 ? 1.12 : .62) + pad) * f, 0) + Math.max(0, cl.length - 1) * .42 * f + 9;
    const fit = (cs, fx) => {
      const f = Math.max(13, Math.min(fx || 19, cs * .56));   /* 단서 숫자는 13px 아래로 줄이지 않는다(15×15 솔로 판도, WP10) */
      let rw = Math.ceil(Math.max(...G.rows.map(cl => wOf(cl, f)))), ch = Math.ceil(Math.max(...G.cols.map(cl => cl.length)) * f * 1.06 + 8);
      rw = Math.max(rw, Math.round(cs * .9)); ch = Math.max(ch, Math.round(cs * .9));
      return { f, rw, ch };
    };
    const fitAll = fx => { let c = 56, q = fit(c, fx); for(; c >= 12; c--){ q = fit(c, fx); if(q.rw + 3 + c * N <= avail && q.ch + 3 + c * N <= maxH) break; } return [c, q]; };
    let [cs, m] = fitAll(19);
    if(cs < 40 && N <= 8){ const [c2, m2] = fitAll(15); if(c2 > cs){ cs = c2; m = m2; } }   /* 작은 판(대전 7×7)은 단서 글자를 조금 줄여서라도 칸을 40px 이상으로(WP10) */
    const fr = $n('#nnFrame'), zoom = !!G.nnZoom && cs < 30;
    if(zoom){ cs = 32; m = fit(cs); }   /* 확대 보기: 칸을 손가락 크기로 키우고 판 틀 안에서 밀어 본다(숫자 줄은 붙어 있음) */
    if(fr){ fr.classList.toggle('zoom', zoom); fr.style.maxHeight = zoom ? (maxH + 16) + 'px' : ''; }
    const zb = $n('#nnZoom'); if(zb){ zb.hidden = !(G.nnZoom || cs < 30); zb.setAttribute('aria-pressed', zoom); }
    const { f, rw, ch } = m;
    G.nnCs = cs;
    grid.style.setProperty('--cs', cs + 'px'); grid.style.setProperty('--f', f.toFixed(1) + 'px');
    grid.style.gridTemplateColumns = `${rw}px ${cs * N}px`; grid.style.gridTemplateRows = `${ch}px ${cs * N}px`;
    const cv = G.nnPrev; if(cv){ const s = Math.max(10, Math.min(rw, ch) - 8), px = Math.max(1, Math.floor(s / N)) * N; cv.width = px; cv.height = px; cv.style.width = cv.style.height = px + 'px'; drawPrev(); }
  }

  /* ---------- 시간(남은 시간 카운트다운) ---------- */
  function tick(){
    if(!G || G.id !== ID || G.over) return;
    const el = $n('#nnClock'); if(!el) return;
    if(!G.limit){ el.textContent = mmss(G.done && G.winSec ? G.winSec : elapsed()); return; }
    const rem = G.limit - (G.done && G.winSec ? G.winSec : elapsed());
    el.textContent = mmss(Math.ceil(Math.max(0, rem)));
    const pill = $n('#nnTimeP'); if(pill) pill.classList.toggle('warn', rem <= 30 && !G.done);
    if(G.done || G.paused) return;
    const s = Math.ceil(rem);
    if(s <= 10 && s > 0 && s !== G.nnLastBeep){ G.nnLastBeep = s; sfx('nonoWarn', { s }); }
    if(rem <= 0){
      G.done = true; endDrag();
      const bd = $n('#bd'); if(bd){ const p = fxCenter(bd); fxFloat(p.x, p.y, '시간 초과!', 'bad'); }
      sfx('bAlarm'); fxBuzz([80, 50, 80]);
      setTimeout(() => { if(!G.over) finish(false); }, 1000);
    }
  }

  const cfgFor = (N, limit, extra) => Object.assign({ N, limit, fill:.5 }, extra || {});

  return {
    name:'네모 그림', abil:'논리력', col:['#FF9CB8', '#E6457A', '#8C1740'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="2" width="4.2" height="4.2" rx=".9"/><rect x="12.8" y="2" width="4.2" height="4.2" rx=".9"/><rect x="2" y="7.6" width="4.2" height="4.2" rx=".9"/><rect x="7" y="7.6" width="4.2" height="4.2" rx=".9"/><rect x="12.8" y="7.6" width="4.2" height="4.2" rx=".9"/><rect x="17.8" y="7.6" width="4.2" height="4.2" rx=".9"/><rect x="4.6" y="13.2" width="4.2" height="4.2" rx=".9" opacity=".55"/><rect x="10" y="13.2" width="4.2" height="4.2" rx=".9"/><rect x="15.2" y="13.2" width="4.2" height="4.2" rx=".9" opacity=".55"/><rect x="10" y="18.6" width="4.2" height="3.6" rx=".9"/></svg>',
    art(){
      const pic = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'], X = { '0,0':1, '0,3':1, '3,0':1, '4,1':1, '5,5':1 };
      const cs = 9.5, ox = 58, oy = 30;
      let g = '';
      pic.forEach((row, r) => [...row].forEach((v, c) => {
        const x = ox + c * cs, y = oy + r * cs, show = v === '1' && !(r >= 4 && c >= 4 && r + c > 8);
        g += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${show ? 'url(#nonoA2)' : '#FFFDF6'}" stroke="#D9C9A8" stroke-width=".6"/>`;
        if(!show && X[r + ',' + c]) g += `<path d="M${x + 2.6} ${y + 2.6}l4.3 4.3M${x + 6.9} ${y + 2.6}l-4.3 4.3" stroke="#A89CC0" stroke-width="1.3" stroke-linecap="round"/>`;
      }));
      const rc = ['2 2', '7', '7', '5', '3', '1'], cc = ['2', '4', '5', '5', '5', '4', '2'];
      const t = rc.map((s, r) => `<text x="${ox - 3}" y="${oy + r * cs + 7.2}" text-anchor="end">${s}</text>`).join('') + cc.map((s, c) => `<text x="${ox + c * cs + cs / 2}" y="${oy - 3.5}" text-anchor="middle">${s}</text>`).join('');
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="nonoA1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E4F8EE"/><stop offset="1" stop-color="#D9CCFF"/></linearGradient>
        <linearGradient id="nonoA2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FB8"/><stop offset="1" stop-color="#8E6BD1"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#nonoA1)"/>
        <g stroke="#fff" stroke-width="1" opacity=".55">${[20, 40, 60, 80, 100, 120, 140].map(x => `<path d="M${x} 0v100"/>`).join('')}${[20, 40, 60, 80].map(y => `<path d="M0 ${y}h160"/>`).join('')}</g>
        <circle cx="150" cy="10" r="22" fill="#FFD23F" opacity=".35"/><circle cx="12" cy="92" r="24" fill="#FF8FB8" opacity=".3"/>
        <rect x="30" y="10" width="104" height="92" rx="10" fill="#FFF8EA" stroke="#1A0F45" stroke-width="2.6"/>
        <rect x="${ox}" y="${oy}" width="${cs * 7}" height="${cs * 6}" fill="#FFFDF6"/>
        ${g}<rect x="${ox}" y="${oy}" width="${cs * 7}" height="${cs * 6}" fill="none" stroke="#1A0F45" stroke-width="1.6"/>
        <g font-family="Jua, sans-serif" font-size="7.4" fill="#2A1B5E">${t}</g>
        <g transform="translate(112 74) rotate(-35)"><rect x="0" y="-3.2" width="26" height="6.4" rx="1.5" fill="#FFD23F" stroke="#1A0F45" stroke-width="1.6"/><path d="M26 -3.2l6 3.2-6 3.2z" fill="#FFE3C2" stroke="#1A0F45" stroke-width="1.4" stroke-linejoin="round"/><path d="M30 -1l2 1-2 1z" fill="#1A0F45"/><rect x="-5" y="-3.2" width="6" height="6.4" rx="1.5" fill="#FF8FB8" stroke="#1A0F45" stroke-width="1.6"/></g>
        <path d="M142 14l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#FFD23F" stroke="#1A0F45" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
    },
    help:[
      ['숫자만큼 이어서 칠하기', '왼쪽 숫자는 그 가로줄, 위 숫자는 그 세로줄에서 이어서 칠할 칸 수예요. "3 1"이면 3칸 묶음, 한 칸 이상 띄고 1칸 묶음이에요.'],
      ['칠하기 · ✕ 표시', '아래 버튼으로 모드를 바꿔요. 누르면 한 칸, 손가락으로 끌면 한 줄로 여러 칸이 돼요. ✕는 비워 둘 칸 메모고, 다시 누르면 지워져요.'],
      ['틀리면 기회 1개', '비어야 할 칸을 칠하면 빨간 ✕가 되고 기회 별이 하나 꺼져요. 3번 틀리거나 시간이 다 되면 끝(대전은 −30점). 힌트는 한 줄을 통째로(판당 3번).']
    ],
    /* 도움말 v2(WP3 공용 도움말이 쓰는 칸): 그림 1장 + 3줄. 그림 = "3 1" 줄을 칠하는 움직임(S-NONO-4) */
    howto:{
      pic(){
        const cs = 34, x0 = 104, y0 = 64, fill = [1, 1, 1, 0, 1, 0];
        let g = '';
        fill.forEach((f, k) => { const x = x0 + k * cs;
          g += `<rect x="${x}" y="${y0}" width="${cs}" height="${cs}" fill="#FFFDF6" stroke="#D9C9A8"/>`;
          g += f ? `<rect x="${x + 2}" y="${y0 + 2}" width="${cs - 4}" height="${cs - 4}" rx="3" fill="#3A2A92" opacity="0"><animate attributeName="opacity" values="0;1" dur=".2s" begin="${.5 + k * .35}s" fill="freeze"/></rect>`
            : `<path d="M${x + 10} ${y0 + 10}l14 14M${x + 24} ${y0 + 10}l-14 14" stroke="#A89CC0" stroke-width="3" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;1" dur=".2s" begin="${.5 + k * .35}s" fill="freeze"/></path>`; });
        return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="16" fill="#ECE7FF"/>
          <text x="${x0 - 10}" y="${y0 + 24}" text-anchor="end" font-family="Jua,sans-serif" font-size="22" fill="#2A1B5E">3 1</text>
          <rect x="${x0}" y="${y0}" width="${cs * 6}" height="${cs}" fill="none" stroke="#1A0F45" stroke-width="2.5"/>${g}
          <text x="160" y="38" text-anchor="middle" font-family="Jua,sans-serif" font-size="16" fill="#2A1B5E">"3 1" = 3칸 칠하고, 띄우고, 1칸</text>
          <text x="160" y="140" text-anchor="middle" font-family="Jua,sans-serif" font-size="14" fill="#6A5884">✕는 비워 둘 칸 메모예요</text></svg>`;
      },
      lines:['숫자만큼 이어서 칠해요', '"3 1" = 3칸 · 띄우고 · 1칸', '아래에서 칠하기 / ✕ 표시를 골라요'],
      more:[['끌어서 칠하기','손가락으로 끌면 한 줄로 여러 칸이 칠해져요.'],['틀리면','기회 별이 하나 꺼지고 3번이면 끝나요. 대전은 끝나지 않고 30점 줄고 0.8초 쉬어요.']]
    },
    helpExtra(){   /* 솔로: 이번 판 새 규칙·변주 설명(첫 도움말에서는 뺐음) */
      if(!(G && G.id === ID && G.solo && !G.over)) return [];
      return (G.mjOn || []).concat(G.tw ? [G.tw] : []).map(k => { const f = conceptInfo(ID, k) || {}; return [((G.mjOn || []).includes(k) ? '새 규칙 · ' : '변주 · ') + (f.name || k), f.desc || '']; });
    },
    chapters:['모눈 공방', '픽셀 마을', '도트 정원', '타일 궁전', '모자이크 성'],
    starRule:'★ 클리어 · ★★ 실수 1번 이하 · ★★★ 실수·힌트 없이',
    levels:{ easy:cfgFor(5, 180, { fill:.52 }), normal:cfgFor(10, 600, { fill:.5 }), hard:cfgFor(15, 1200, { fill:.48 }) },
    /* 난이도 v2(개념 사이클): 11 가려진 숫자 · 21 두 가지 색 · 31 거울 그림 · 41 확인 없이, 변주 6 번개 · 16 ✕ 없이 · 26 외줄 타기 · 36 줄 완성 표시 끔 · 46 맨손 */
    concepts:{
      order:['mystery', 'color', 'mirror', 'blind'],
      info:{
        mystery:{ name:'가려진 숫자', desc:'숫자 몇 개가 ?로 가려져 있어요. ?는 길이를 모르는 묶음 하나예요(1칸 이상). 다른 줄 숫자로 길이를 알아내요!' },
        color:{ name:'두 가지 색', desc:'숫자 색이 곧 칠할 색이에요. 아래에서 색을 골라 칠해요. 색이 다른 묶음끼리는 띄지 않고 딱 붙어 있을 수 있어요.' },
        mirror:{ name:'거울 그림', desc:'그림이 가운데 선을 기준으로 좌우 대칭이에요. 오른쪽 세로 숫자는 왼쪽 거울 줄과 같아서 숨겨져 있고, 가로 숫자가 가려진 줄도 있어요.' },
        blind:{ name:'확인 없이', desc:'틀리게 칠해도 바로 알려 주지 않아요. 다 칠하면 [채점]을 눌러요. 틀린 칸 하나마다 실수 1번, 기회를 다 쓰면(3칸) 실패예요.' }
      },
      twists:['flash', 'nomark', 'tight', 'nodone', 'bare'],
      twInfo:{
        nomark:{ name:'✕ 없이', desc:'이번 판은 ✕ 표시를 쓸 수 없어요. 비워 둘 칸은 머릿속으로 기억해요.' },
        nodone:{ name:'줄 완성 표시 끔', desc:'다 채운 줄이어도 숫자가 흐려지지 않고 ✕도 저절로 쳐지지 않아요.' }
      }
    },
    stage(n){
      const p = planOf(ID, n), c = p.c, k = p.k, has = x => p.mj.indexOf(x) >= 0;
      const NB = [5, 7, 8, 9, 10, 10, 12, 12, 12, 15][Math.min(9, c - 1)];
      let N = Math.min(15, NB + (p.boss ? 1 : 0) - (k === 6 && c >= 2 ? 1 : 0));   /* 보스는 한 칸 크게, 변주 소개 판은 한 칸 작게 */
      if(has('blind')) N = Math.max(7, N - 2);                  /* 확인 없이는 틀린 걸 모른 채 가서 판을 두 칸 줄인다 */
      if(has('mirror')) N = Math.max(N, Math.min(12, N + 2));   /* 거울은 절반만 풀면 돼서 판을 두 칸 키운다(12칸까지) */
      if(has('color') && N > 12) N = 12;                        /* 두 색 단서는 길어져서 12칸까지 */
      const tier = p.boss ? 'boss' : p.hard ? 'hard' : p.easy ? 'easy' : 'mid';
      const tr = Math.min(1, (c - 1) / 9);                        /* 챕터가 갈수록 아주 조금씩 성기게(=어렵게) */
      const fill = { easy:.57, mid:.54, hard:.51, boss:.5 }[tier] - tr * .03 + (n <= 3 ? .02 : 0);
      const want = { easy:5, mid:5, hard:6, boss:8 }[tier];      /* 후보 몇 장을 줄 풀이 난이도로 줄 세워 자리(rank)에 맞는 것을 고른다 */
      const rank = { 1:0, 2:.3, 3:.4, 4:.3, 5:.9, 6:0, 7:.4, 8:.5, 9:0, 10:1 }[k];
      const qf = { 1:.25, 2:.35, 3:.4, 4:.2, 5:.55, 6:.25, 7:.35, 8:.4, 9:.25, 10:.8 }[k];
      const q = has('mystery') ? Math.max(2, Math.round(N * qf)) : 0;
      const mh = has('mirror') ? Math.round(({ 1:0, 2:2, 3:2, 4:1, 5:3, 6:1, 7:2, 8:2, 9:1, 10:5 }[k] || 0) * N / 8) : 0;
      const think = (has('mystery') ? .12 : 0) + (has('mirror') ? .08 : 0) + (has('color') ? .1 : 0);
      const base = SIZES[N] || N * N * 6;
      const limit = Math.round(base * (p.boss ? 1.15 : 1) * (1 + think) * (p.tw === 'flash' ? .6 : 1) / 10) * 10;
      const maxR = { easy:4, mid:5, hard:6, boss:8 }[tier] + (N >= 10 ? 1 : 0);   /* 가리다가 너무 깊어지면(줄 풀이 라운드) 그만 가린다 */
      return { N, fill, boss:p.boss, limit, want, rank, easy:tier === 'easy', mj:p.mj.slice(), tw:p.tw, q, mh, maxR };
    },
    stageDesc(n){ const s = this.stage(n); return s.N + '×' + s.N + ' 판' + (s.boss ? ' · 보스' : ''); },
    levelDesc(lv){ const s = this.levels[lv] || this.levels.normal; return s.N + '×' + s.N + ' 판 · ' + Math.round(s.limit / 60) + '분'; },

    /* 대전 전용 작은 판(WP10): 7×7, 2분. 지금 엔진(1:1)은 보통 판을 넘겨 주므로 init에서 바꿔 끼운다(v3 엔진이 duelCfg를 직접 불러도 같은 값) */
    duelCfg(){ return cfgFor(7, 120, { fill:.5, duel:1 }); },
    duelSlow(cfg){ return Object.assign({}, cfg, { limit:cfg.limit * 2 }); },   /* 느긋하게: 4분 */
    duelKind:'race', duelMax:5,   /* 2~5명 경주(2단계) */
    init(cfg, rng){
      if(G.duel && !G.duel.fleet && !G.adv && !cfg.duel){ cfg = cfgFor(7, 120, { fill:.5, duel:1 }); G.cfg = cfg; G.limit = cfg.limit; }
      const N = cfg.N || 10, t0 = performance.now();
      const solo = Array.isArray(cfg.mj);   /* 솔로 난이도 v2 판(오늘의 문제·대전은 예전 생성기 그대로) */
      const p = solo ? genSolo(N, rng, cfg) : gen(N, rng, cfg);
      const genMs = performance.now() - t0;
      let pal = PALS[Math.floor(rng() * PALS.length)];
      let total = 0; for(const v of p.pic) total += v ? 1 : 0;
      if(solo && p.used.indexOf('color') >= 0) pal = PALS[pal === PALS[3] ? 3 : 1];   /* 두 번째 색(주황)과 안 겹치게 차가운 색 */
      const mjOn = solo ? p.used : [], on = x => mjOn.indexOf(x) >= 0, tw = solo ? cfg.tw || null : null;
      const rowX = solo ? p.rowsX : p.rows.map(a => a.map(n => ({ n, c:1 }))), colX = solo ? p.colsX : p.cols.map(a => a.map(n => ({ n, c:1 })));
      const nums = a => a ? a.map(x => x.n || x.o || 1) : [];
      const mir = on('mirror'), hN = Math.ceil(N / 2);
      Object.assign(G, { N, sol:p.pic, rows:rowX.map(nums), cols:colX.map((a, c) => nums(a || (mir && c >= hN ? colX[N - 1 - c] : null))), rowX, colX,
        rounds:p.rounds, genMs, genTries:p.tries, solo, mjOn, tw, blind:on('blind'), mir, twoC:on('color'), mys:on('mystery'),
        nomark:tw === 'nomark', nodone:tw === 'nodone', nnC:1, nnFixed:0, nnChk:false, fc:new Uint8Array(N * N), nnMaxP:tw === 'tight' ? 2 : 3,
        cells:new Uint8Array(N * N), rowDone:new Uint8Array(N), colDone:new Uint8Array(N),
        total, found:0, mine:0, miss:0, combo:0, hints:tw === 'bare' ? 0 : 3, hintLines:0, hintCells:0, mode:'fill', done:false, winSec:0,
        nnLock:0, nnPal:pal, nnZoom:false, nnEls:null, nnBase:null, nnHl:null, nnCur:-1, nnWin:false, nnPrev:null, nnQuiet:false, nnLastBeep:0 });
      G.paws = G.nnMaxP;   /* 외줄 타기: 두 번째 실수에서 끝 */
      G.nnCol = Array.from({ length:N * N }, (_, i) => p.pic[i] === 2 ? colorAt2(i) : colorAt(i));
      G.cleanup = () => {
        clearInterval(G.nnT); drag = null;
        removeEventListener('keydown', key); removeEventListener('resize', layout);
        document.querySelectorAll('.nn-lost').forEach(e => e.remove());
      };
    },
    render(st){
      const N = G.N;
      const hN = Math.ceil(N / 2);
      const cl = (a, k, kind) => {
        if(!G.solo) return `<div class="nn-cl" data-k="${k}" aria-label="${kind} ${k + 1}: ${a.join(' ')}">${a.map(v => `<i>${v}</i>`).join('')}</div>`;
        const X = (kind === '가로줄' ? G.rowX : G.colX)[k];
        if(!X){
          if(kind === '세로줄' && G.mir && k >= hN) return `<div class="nn-cl mi" data-k="${k}" aria-label="세로줄 ${k + 1}: 거울 건너편 ${N - k}번 세로줄과 같아요"><i class="mi">${MIR}</i></div>`;
          return `<div class="nn-cl hid" data-k="${k}" aria-label="${kind} ${k + 1}: 숫자 숨김"><i class="hq"></i></div>`;
        }
        const lab = X.map(x => (x.n || '물음표') + (G.twoC ? (x.c === 2 ? ' 주황' : ' 보라') : '')).join(', ');
        return `<div class="nn-cl" data-k="${k}" aria-label="${kind} ${k + 1}: ${lab || '없음'}">${X.map(x => `<i class="${x.n ? '' : 'q'}${G.twoC ? (x.c === 2 ? ' c2' : ' c1') : ''}"${x.n ? '' : ` data-o="${x.o}"`}>${x.n || '?'}</i>`).join('')}</div>`;
      };
      const chip = (k, t) => { const inf = conceptInfo(ID, k) || { name:k, desc:'' }; return `<span class="nn-rule ${t}" title="${inf.desc}" aria-label="${t === 'tw' ? '변주' : '규칙'} ${inf.name}: ${inf.desc}">${t === 'tw' ? '⚡' : '★'} ${inf.name}</span>`; };
      const rules = G.solo && (G.mjOn.length || G.tw) ? `<div class="nn-rules" id="nnRules">${G.mjOn.map(k => chip(k, 'mj')).join('')}${G.tw ? chip(G.tw, 'tw') : ''}</div>` : '';
      /* 도구 버튼: 칠하기/표시는 켜고 끄기(.tool.toggle), 힌트는 아이템(.tool.item) — 공용 규격 v1 */
      const segBtns = G.twoC
        ? `<button class="tool toggle on" data-m="fill" aria-pressed="true" aria-label="보라색 칠하기"><span class="nn-sq"></span>보라</button><button class="tool toggle" data-m="fill2" aria-pressed="false" aria-label="주황색 칠하기"><span class="nn-sq o"></span>주황</button>`
        : `<button class="tool toggle on" data-m="fill" aria-pressed="true" aria-label="칠하기"><span class="nn-sq"></span>칠하기</button>`;
      const markBtn = `<button class="tool toggle${G.nomark ? ' lock' : ''}" data-m="mark" aria-pressed="false" aria-label="${G.nomark ? '✕ 표시(이번 판은 못 써요)' : '✕ 표시'}"${G.nomark ? ' aria-disabled="true"' : ''}>${XS}표시</button>`;
      const tip = G.blind ? '틀려도 바로 알려 주지 않아요 · 다 칠하면 [채점]을 눌러요 · 칠한 칸을 다시 누르면 지워져요'
        : G.twoC ? '색을 골라 칠해요 · 색이 다른 묶음끼리는 붙어 있을 수 있어요'
        : G.mir ? '그림이 좌우 대칭이에요 · 오른쪽 세로 숫자는 왼쪽 거울 줄과 같아요'
        : G.mys ? '?는 길이를 모르는 묶음 하나예요(1칸 이상) · 줄을 다 채우면 숫자가 보여요'
        : G.nodone ? '이번 판은 줄을 다 채워도 표시가 안 나요'
        : '끌면 한 줄로 칠해요 · 다 채운 줄엔 ✕가 저절로 쳐져요';
      st.innerHTML = `<div class="ng-nono" id="nnRoot">
        <div class="hud-row nn-hud" id="nnHud">
          <div class="hchip" aria-label="${G.blind ? '칠한 칸' : '찾은 칸'}"><span class="hv">${SQ}<b id="nnCnt">0/${G.total}</b></span><em>${G.blind ? '칠한 칸' : '찾은 칸'}</em></div>
          <div class="hchip time" id="nnTimeP" aria-label="남은 시간"><span class="hv">${WATCH}<b id="nnClock">${mmss(G.limit || 0)}</b></span><em>남은 시간</em></div>
          ${nnDuel() ? `<div class="hchip" id="nnMisC" aria-label="실수 0번"><span class="hv"><b id="nnMis">0</b></span><em>실수</em></div>`
            : `<div class="hchip nn-lv" id="nnLivesC"><span class="hv"><span class="hlives" id="nnLives" aria-label="남은 기회"></span></span><em>기회</em></div>`}
        </div>${rules}
        <div class="nn-frame" id="nnFrame">
          <div class="nn-grid" id="nnGrid" style="--n:${N}">
            <div class="nn-corner"><canvas id="nnPrev" aria-hidden="true"></canvas></div>
            <div class="nn-cc" id="nnCC">${G.cols.map((a, k) => cl(a, k, '세로줄')).join('')}</div>
            <div class="nn-rc" id="nnRC">${G.rows.map((a, k) => cl(a, k, '가로줄')).join('')}</div>
            <div class="nn-bd" id="bd" role="grid" aria-label="네모 그림 판 ${N}×${N}"></div>
          </div>
        </div>
        <div class="tools-row nn-ctrl" id="nnCtrl">
          <div class="nn-seg" id="nnSeg" role="group" aria-label="칠하기 모드" data-m="fill">${segBtns}${markBtn}</div>
          <button class="tool nn-hint" id="nnHint" aria-label="힌트: 한 줄 알려주기${G.tw === 'bare' ? '(이번 판은 없어요)' : ''}">${BULB}<span>힌트</span><i class="cnt" id="nnHintN">${G.hints}</i></button>
          ${N >= 12 ? `<button class="tool toggle nn-zoom" id="nnZoom" aria-pressed="false" aria-label="판 확대해서 보기" hidden>${ZOOM}<span>확대</span></button>` : ''}
          ${G.blind ? `<button class="tool nn-check" id="nnChk" aria-label="채점: 다 칠했으면 눌러요" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>채점</span></button>` : ''}
        </div>
        <p class="nn-tip" id="nnTip">${tip}</p>
      </div>`;
      const bd = $n('#bd'), frag = document.createDocumentFragment();
      G.nnEls = []; G.nnBase = [];
      for(let i = 0; i < N * N; i++){
        const r = Math.floor(i / N), c = i % N, el = document.createElement('div');
        let b = 'nn-c';
        if(c % 5 === 4 && c < N - 1) b += ' gr'; if(r % 5 === 4 && r < N - 1) b += ' gb';
        if(c === N - 1) b += ' er'; if(r === N - 1) b += ' eb';
        G.nnBase.push(b); el.className = b; el.style.setProperty('--d', ((r + c) * 18) + 'ms');
        el.classList.add('in');
        frag.appendChild(el); G.nnEls.push(el);
      }
      if(G.mir){ const ax = document.createElement('div'); ax.className = 'nn-axis'; ax.setAttribute('aria-hidden', 'true'); frag.appendChild(ax); }   /* 거울 축 */
      bd.appendChild(frag);
      /* 등장 애니메이션 끝나면 'in' 제거 */
      setTimeout(() => { if(G.nnEls) G.nnEls.forEach((e, i) => { if(e.classList.contains('in')) paint(i); }); }, 600 + N * 36);
      bd.addEventListener('animationend', e => { const t = e.target; if(t.classList && /nnpop|nnbad|nnxin|nnlw|nnhin|nnnope/.test(e.animationName)) t.classList.remove('pop', 'bad', 'xin', 'lw', 'hin', 'nope'); });
      G.nnPrev = $n('#nnPrev');
      bd.onpointerdown = down; bd.onpointermove = move;
      bd.onpointerup = bd.onpointercancel = e => { if(drag && e.pointerId === drag.id) endDrag(); };
      bd.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
      document.querySelectorAll('#nnSeg button').forEach(b => b.onclick = () => {
        if(b.dataset.m === 'mark' && G.nomark){ sfx('nonoNo'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); const p = fxCenter(b); fxFloat(p.x, p.y - 20, '이번 판은 ✕ 없이!', 'bad'); return; }
        const cur = G.mode === 'mark' ? 'mark' : G.nnC === 2 ? 'fill2' : 'fill'; if(cur !== b.dataset.m) setMode(b.dataset.m); });
      $n('#nnHint').onclick = hint;
      const zb = $n('#nnZoom'); if(zb) zb.onclick = () => { G.nnZoom = !G.nnZoom; endDrag(); layout(); sfx('toggle', { on:G.nnZoom }); };
      const ck = $n('#nnChk'); if(ck) ck.onclick = check;
      addEventListener('keydown', key); addEventListener('resize', layout);
      lives(); layout(); hud();
      requestAnimationFrame(() => { if(G && G.id === ID && !G.over) layout(); });   /* 화면이 자리 잡은 뒤 높이를 한 번 더 맞춘다 */
      clearInterval(G.nnT); G.nnT = setInterval(tick, 250); tick();
    },
    progress(){ return G && G.total ? Math.min(1, G.found / G.total) : 0; },
    lossText(){ return '칸 ' + G.found + '/' + G.total + '개를 채웠어요.'; },
    score(){
      const sec = G.winSec || elapsed(), lim = G.limit || 600;
      const base = Math.round(500 * G.mine / G.total);
      const time = Math.max(0, 350 - Math.floor(sec * 350 / lim));
      if(nnDuel()) return { base, time, extra:Math.max(10 - base - time, -(G.miss || 0) * NN_DUEL_PEN),   /* 대전: 실수마다 −30(끝난 판은 최소 10점) */
        rows:['칸 채우기' + (G.hintCells ? ' (힌트 ' + G.hintCells + '칸 제외)' : ''), '시간 보너스 (' + mmss(sec) + ')', '실수 ' + (G.miss || 0) + '번'] };
      const extra = Math.max(0, G.paws) * 50;
      return { base, time, extra, rows:['칸 채우기' + (G.hintCells ? ' (힌트 ' + G.hintCells + '칸 제외)' : ''), '시간 보너스 (' + mmss(sec) + ')', '남은 기회 ' + Math.max(0, G.paws) + '개'] };
    },
    stars(){ const m = G.miss; return m === 0 && !G.hintLines ? 3 : m <= 1 ? 2 : 1; },   /* 실수 수 기준(외줄 타기처럼 기회가 2개인 판도 같은 잣대) */
    /* 테스트용: 남은 정답 칸을 전부 칠해 완성 경로를 탄다 */
    _solveForTest(){ if(G.id !== ID || G.done) return false; G.nnQuiet = true; const c0 = G.nnC, m0 = G.mode; G.mode = 'fill';
      for(let i = 0; i < G.N * G.N; i++){ const s = G.cells[i];
        if(G.blind && s === 1 && G.fc[i] !== G.sol[i]){ if(G.sol[i]){ G.fc[i] = G.sol[i]; paint(i); } else { G.cells[i] = 0; G.found--; paint(i); } }
        if(G.sol[i] && G.cells[i] === 0){ G.nnC = G.sol[i]; doFill(i, 0); } }
      G.nnC = c0; G.mode = m0; G.nnQuiet = false; if(G.blind) check(); return G.done; },
    _check:() => check(),
    _wrongForTest(){ for(let i = 0; i < G.N * G.N; i++) if(!G.sol[i] && (G.cells[i] === 0 || G.cells[i] === 2)){ G.cells[i] = 0; doFill(i, 0); return i; } return -1; },
    _gen:gen, _solveGrid:solveGrid, _solveLine:solveLine, _genSolo:genSolo, _solveX:solveX, _lineX:lineX, _linePal:linePal,

    css:`
body[data-mode="nono"]{background:#ECE7FF; background-image:linear-gradient(rgba(255,255,255,.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.55) 1px, transparent 1px), linear-gradient(180deg,#E9FBF3 0%,#ECE7FF 55%,#F3E6FF 100%); background-size:22px 22px, 22px 22px, 100% 100%; background-attachment:fixed}
.ng-nono{--ink:#2A1B5E; --line:#E2D4B6; --grid:#1A0F45; color:var(--ink); margin:0 -8px; display:flex; flex-direction:column; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none}
.ng-nono .nn-hud{margin:0 0 8px}
.ng-nono .hchip .hv > svg{width:20px; height:20px; flex:none}
.ng-nono .nn-lv .hlives{height:auto; padding:0; border:0; background:none; gap:2px}
.ng-nono .nn-lv .hlives i{display:inline-block; font-size:19px}
.ng-nono .hlives i.lost{animation:nnlost .5s}
.ng-nono .hlives i.last{animation:nnbeat 1s ease-in-out infinite}
@keyframes nnlost{30%{transform:scale(1.5) rotate(-12deg)}}
@keyframes nnbeat{0%,100%{transform:scale(1)}15%{transform:scale(1.22)}30%{transform:scale(1)}45%{transform:scale(1.14)}}
.ng-nono .hchip.hurt{animation:nnhurt .5s}
@keyframes nnhurt{20%{background:#FFD6DE; transform:translateX(-4px)}50%{transform:translateX(4px)}}
.ng-nono .hchip.time b{min-width:52px; text-align:center}
.ng-nono .hchip.time.warn{background:linear-gradient(180deg,#FFF1F3,#FFD3DA); animation:nnwarn 1s ease-in-out infinite}
.ng-nono .hchip.time.warn em{color:#B3123E}
@keyframes nnwarn{50%{transform:scale(1.05)}}
.ng-nono .nn-frame{position:relative; padding:5px; border-radius:18px; background:linear-gradient(180deg,#FFF8EA,#FBEBCB); border:3px solid var(--grid); box-shadow:inset 0 0 0 2px rgba(255,255,255,.8), 0 5px 0 var(--grid), 0 12px 22px rgba(40,20,90,.18); width:fit-content; max-width:100%; margin:auto; flex:none}
.ng-nono .nn-frame.zoom{width:100%; overflow:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch}
.ng-nono .nn-frame.zoom .nn-corner{position:sticky; left:0; top:0; z-index:4}
.ng-nono .nn-frame.zoom .nn-cc{position:sticky; top:0; z-index:3; background:#FFF8EA; touch-action:pan-x pan-y}
.ng-nono .nn-frame.zoom .nn-rc{position:sticky; left:0; z-index:3; background:#FFF8EA; touch-action:pan-x pan-y}
.ng-nono .nn-frame.shake{animation:nnshake .45s cubic-bezier(.36,.07,.19,.97)}
@keyframes nnshake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(5px)}30%,50%,70%{transform:translateX(-8px) rotate(-.5deg)}40%,60%{transform:translateX(8px) rotate(.5deg)}}
.ng-nono .nn-frame.bump{animation:nnbump .5s cubic-bezier(.2,1.6,.4,1)}
@keyframes nnbump{30%{transform:scale(1.03)}}
.ng-nono .nn-frame.danger{box-shadow:0 0 0 4px rgba(229,72,77,.45), inset 0 0 0 2px rgba(255,255,255,.8), 0 5px 0 var(--grid), 0 12px 22px rgba(40,20,90,.18)}
.ng-nono .nn-last{position:absolute; left:50%; top:-15px; transform:translateX(-50%); background:#E5484D; color:#fff; border:2px solid var(--grid); font-family:var(--disp); font-size:14px; padding:2px 12px; border-radius:999px; z-index:5; white-space:nowrap; animation:nnlastin .4s cubic-bezier(.2,1.6,.4,1)}
@keyframes nnlastin{from{transform:translateX(-50%) scale(.4)}}
.ng-nono .nn-grid{display:grid; gap:3px; --cs:24px; --f:13px}
.ng-nono .nn-corner{display:grid; place-items:center; border-radius:10px; background:#F5E6C8}
.ng-nono .nn-corner canvas{display:block; border-radius:3px; box-shadow:0 0 0 1.5px var(--grid); image-rendering:pixelated}
.ng-nono .nn-cc{display:flex; align-items:stretch}
.ng-nono .nn-rc{display:flex; flex-direction:column}
.ng-nono .nn-cl{font-family:var(--disp); font-size:var(--f); line-height:1.06; color:var(--ink); font-variant-numeric:tabular-nums; display:flex; transition:background .12s, color .2s, opacity .2s}
.ng-nono .nn-cl i{font-style:normal; display:block}
.ng-nono .nn-cc .nn-cl{width:var(--cs); flex:none; flex-direction:column; justify-content:flex-end; align-items:center; padding-bottom:4px; border-radius:7px 7px 0 0}
.ng-nono .nn-rc .nn-cl{height:var(--cs); flex:none; justify-content:flex-end; align-items:center; gap:.42em; padding-right:5px; border-radius:7px 0 0 7px}
.ng-nono .nn-cc .nn-cl:nth-child(even), .ng-nono .nn-rc .nn-cl:nth-child(even){background:rgba(234,219,192,.45)}
.ng-nono .nn-cl.on{background:#FFE27A!important; color:#1A0F45}
.ng-nono .nn-cl.done{opacity:.4}   /* 다 맞은 줄 단서는 40%로 흐리게(S-NONO-9) */
.ng-nono .nn-cl.done i{text-decoration:line-through; text-decoration-thickness:1.5px; text-decoration-color:rgba(142,107,209,.55)}
.ng-nono .nn-cl.dpop{animation:nndpop .5s cubic-bezier(.2,1.6,.4,1)}
@keyframes nndpop{0%{background:#C9F5DF}40%{transform:scale(1.12); background:#C9F5DF}100%{}}
.ng-nono .nn-bd{position:relative; display:grid; grid-template-columns:repeat(var(--n),var(--cs)); grid-template-rows:repeat(var(--n),var(--cs)); background:#FFFDF6; box-shadow:0 0 0 2px var(--grid); border-radius:2px; touch-action:none; cursor:pointer}
.ng-nono .nn-c{position:relative; border-right:1px solid var(--line); border-bottom:1px solid var(--line); background:#FFFDF6}
.ng-nono .nn-c.gr{border-right:2px solid #6E5A9C}
.ng-nono .nn-c.gb{border-bottom:2px solid #6E5A9C}
.ng-nono .nn-c.er{border-right:0}
.ng-nono .nn-c.eb{border-bottom:0}
.ng-nono .nn-c.in{animation:nnin .35s cubic-bezier(.2,1.4,.5,1) var(--d) both}
@keyframes nnin{from{opacity:0; transform:scale(.4)}}
.ng-nono .nn-c.hl{background:#F0EAFF}
.ng-nono .nn-c.cur{box-shadow:inset 0 0 0 2.5px #F0368A; z-index:2}
.ng-nono .nn-c::before{content:""; position:absolute; inset:1px; border-radius:2px; background:linear-gradient(150deg,#5140B8 0%,#2E2080 60%,#221661 100%); box-shadow:inset 0 1.5px 0 rgba(255,255,255,.3), inset 0 -2px 0 rgba(0,0,0,.28); transform:scale(0); opacity:0; transition:background .35s}
.ng-nono .nn-c.f::before{transform:scale(1); opacity:1}
.ng-nono .nn-c.h::after{content:""; position:absolute; right:18%; top:18%; width:22%; height:22%; border-radius:50%; background:#FFD23F; box-shadow:0 0 4px #FFD23F}
.ng-nono .nn-c.x, .ng-nono .nn-c.w{background-image:${xUri('#A89CC0')}; background-size:78% 78%; background-position:center; background-repeat:no-repeat}
.ng-nono .nn-c.x.a{background-image:${xUri('#CFC6DE')}}
.ng-nono .nn-c.w{background-color:#FFE1E4; background-image:${xUri('#E5484D')}}
.ng-nono .nn-c.hl.x, .ng-nono .nn-c.hl.w{background-color:#F0EAFF}
.ng-nono .nn-c.hl.w{background-color:#FFD3D8}
.ng-nono .nn-c.pop{z-index:2}
.ng-nono .nn-c.pop::before{animation:nnpop .32s cubic-bezier(.2,1.8,.4,1)}
@keyframes nnpop{0%{transform:scale(.3)}60%{transform:scale(1.22)}100%{transform:scale(1)}}
.ng-nono .nn-c.xin{animation:nnxin .32s cubic-bezier(.2,1.6,.4,1) var(--d,0ms) both}
@keyframes nnxin{0%{background-size:0 0}70%{background-size:100% 100%}}
.ng-nono .nn-c.lw::before{animation:nnlw .5s ease-out var(--d,0ms) both}
@keyframes nnlw{0%{filter:none}35%{filter:brightness(1.9) saturate(1.3); transform:scale(1.12)}100%{filter:none}}
.ng-nono .nn-c.hin::before{animation:nnhin .45s cubic-bezier(.2,1.6,.4,1) var(--d,0ms) both}
@keyframes nnhin{0%{transform:scale(0); background:#FFE27A}60%{transform:scale(1.2); background:#FFE27A}}
.ng-nono .nn-c.bad{z-index:3; animation:nnbad .5s ease-out}
@keyframes nnbad{0%{background-color:#E5484D; background-size:0 0}30%{background-color:#FF8A95; background-size:130% 130%}100%{}}
.ng-nono .nn-c.nope{animation:nnnope .3s}
@keyframes nnnope{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.ng-nono .nn-bd.win .nn-c{background-color:#FFFDF6; background-image:none; transition:background-color .3s}
.ng-nono .nn-bd.win .nn-c::before{background:var(--pc); transition:background .45s var(--d), transform .45s var(--d); box-shadow:inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)}
.ng-nono .nn-bd.win .nn-c.f::before{animation:nnrev .55s cubic-bezier(.2,1.6,.4,1) var(--d) both}
.ng-nono .nn-bd.win .nn-c.h::after{opacity:0}
@keyframes nnrev{0%{transform:scale(1); background:#2E2080}45%{transform:scale(1.3); filter:brightness(1.4)}100%{transform:scale(1)}}
.ng-nono .nn-stamp{position:absolute; left:50%; top:100%; z-index:6; transform:translate(-50%,-50%) rotate(-6deg); font-family:var(--heavy); font-size:clamp(24px,7.5vw,34px); color:#fff; white-space:nowrap; padding:6px 18px; border-radius:16px; background:linear-gradient(180deg,#FF8AC0,#F0368A); border:3px solid var(--grid); box-shadow:0 5px 0 var(--grid); text-shadow:0 2px 0 #8E0F4F; pointer-events:none; animation:nnstamp .45s cubic-bezier(.2,1.8,.4,1) both}
@keyframes nnstamp{0%{transform:translate(-50%,-50%) rotate(-6deg) scale(2.6); opacity:0}100%{transform:translate(-50%,-50%) rotate(-6deg) scale(1); opacity:1}}
.ng-nono .nn-ctrl{align-items:stretch; margin:0; padding:0 4px 4px}
.ng-nono .nn-seg{flex:1 1 0; min-width:0; display:flex; gap:8px}
.ng-nono .nn-ctrl > .tool{flex:0 0 68px}
.ng-nono .nn-seg .tool{flex:1 1 0; min-width:0; min-height:56px; flex-direction:row; gap:6px; font-size:17px}
.ng-nono .nn-seg .tool > svg{width:18px; height:18px}
.ng-nono .nn-sq{width:17px; height:17px; border-radius:4px; flex:none; background:#3A2A92; box-shadow:inset 0 1.5px 0 rgba(255,255,255,.4)}
.ng-nono .nn-seg .tool.on .nn-sq{background:#fff}
.ng-nono .nn-seg .tool:not(.on) > svg{color:#8E80AE}
.ng-nono .nn-hint > svg, .ng-nono .nn-zoom > svg{width:24px; height:24px}
.ng-nono .nn-hint .cnt.off{background:#B9AECB}
.ng-nono .tool[hidden]{display:none}
.ng-nono .nn-tip{text-align:center; font-size:13px; color:#6A5884; margin:0 8px; padding:8px 0 4px; line-height:1.4}
.ng-nono .nn-ctrl{margin-top:12px}
.ng-nono .nn-frame{margin:4px auto 0}   /* 판 바로 아래 조작 줄(S-NONO-3) */
/* 칠하기/✕ 표시: 고른 쪽 진한 색 + 체크(S-NONO-3) */
.ng-nono .nn-seg .tool.on[data-m="fill"]{background:linear-gradient(180deg,#5A43D6,#2E2080)}
.ng-nono .nn-seg .tool.on::after{content:"✓"; position:absolute; top:-9px; right:-6px; width:24px; height:24px; border-radius:50%; background:#2BB673; color:#fff; border:2px solid #1A0F45; font:15px/20px var(--heavy); text-align:center}
.ng-nono .nn-bd.lock{filter:saturate(.55) brightness(.95)}
.ng-nono #nnMisC.hurt{animation:nnhurt .5s}
/* 완성 그림이 살짝 둥실(S-NONO-2) */
.ng-nono .nn-frame.won{animation:nnwon 1.6s ease-in-out infinite alternate}
@keyframes nnwon{from{transform:translateY(0) rotate(0)} to{transform:translateY(-6px) rotate(-.8deg)}}
.ng-nono.nn-lost{position:fixed; z-index:19; pointer-events:none; width:28px; height:28px; font-size:24px; line-height:28px; text-align:center; color:#FFB020; text-shadow:0 1px 0 #7A4A00}
.ng-nono .nn-rules{display:flex; justify-content:center; flex-wrap:wrap; gap:6px; margin:-2px 4px 10px}
.ng-nono .nn-rule{font-family:var(--disp); font-size:13.5px; line-height:1; padding:6px 11px; border-radius:999px; background:#E9DEFF; border:2px solid var(--grid); box-shadow:0 2px 0 var(--grid); white-space:nowrap}
.ng-nono .nn-rule.tw{background:#FFE9A8}
.ng-nono .nn-cl i.q{min-width:1.1em; text-align:center; color:#fff; background:#8E6BD1; border-radius:5px; padding:0 .1em; margin:1px 0; box-shadow:inset 0 -2px 0 rgba(0,0,0,.2)}
.ng-nono .nn-cl i.q.rv{background:#C9F5DF; color:#1A6B4A; box-shadow:none}
.ng-nono .nn-cl i.c1{color:#2E2080}
.ng-nono .nn-cl i.c2{color:#fff; background:#F0602E; border-radius:.55em; padding:0 .24em; margin:1px 0; box-shadow:inset 0 -2px 0 rgba(0,0,0,.2); text-align:center; min-width:1.1em}
.ng-nono .nn-cl i.q.c1{background:#5140B8}
.ng-nono .nn-cl i.q.c2{background:#F0602E; outline:1.5px dashed #fff; outline-offset:-3px}
.ng-nono .nn-cl.done i.c2, .ng-nono .nn-cl.done i.q{opacity:.5}
.ng-nono .nn-cl.mi{color:#E6457A; opacity:.8}
.ng-nono .nn-cl .mi svg{width:calc(var(--f) * 1.2); height:calc(var(--f) * 1.2); display:block}
.ng-nono .nn-cl i.hq{width:calc(var(--f) * 1.15); height:calc(var(--f) * 1.15); border:2px dashed #B9AECB; border-radius:5px; box-sizing:border-box}
.ng-nono .nn-axis{position:absolute; top:-9px; bottom:-9px; left:50%; width:0; border-left:3px dashed rgba(240,54,138,.8); transform:translateX(-1.5px); pointer-events:none; z-index:4}
.ng-nono .nn-axis::before, .ng-nono .nn-axis::after{content:""; position:absolute; left:-7.5px; border:6px solid transparent}
.ng-nono .nn-axis::before{top:-4px; border-top-color:#F0368A}
.ng-nono .nn-axis::after{bottom:-4px; border-bottom-color:#F0368A}
.ng-nono .nn-bd.win .nn-axis{opacity:0; transition:opacity .3s}
.ng-nono .nn-c.c2::before{background:linear-gradient(150deg,#FF9A6B 0%,#F0602E 60%,#C8401A 100%)}
.ng-nono .nn-c.bad.f::before{animation:nnbadf .6s ease-out}
@keyframes nnbadf{0%{box-shadow:0 0 0 3px #E5484D}35%{transform:scale(.72); box-shadow:0 0 0 4px #E5484D}100%{}}
.ng-nono .nn-seg .nn-sq.o{background:#F0602E}
.ng-nono .nn-seg .tool.on .nn-sq.o{background:#FFD1BC}
.ng-nono .nn-seg .tool.on[data-m="fill2"]{background:linear-gradient(180deg,#FFB089,#F0602E)}
.ng-nono .nn-seg .tool.on[data-m="mark"]{background:linear-gradient(180deg,#FFB3C8,#E6457A)}
.ng-nono .nn-seg .tool.lock{opacity:.4}
.ng-nono .nn-seg .tool.nope{animation:nnnope .3s}
.ng-nono .nn-check svg{width:24px; height:24px}
.ng-nono .nn-check.ready{background:linear-gradient(180deg,#D8F8E8,#3EC9A5); color:#0D4A38; animation:nnready 1.1s ease-in-out infinite}
@media (max-width:370px){ .ng-nono .nn-seg .tool{font-size:15px; gap:4px} .ng-nono .nn-rule{font-size:13px; padding:5px 8px} }
@keyframes nnready{50%{transform:scale(1.08)}}
#modal .nnres{display:flex; flex-direction:column; align-items:center; gap:4px; margin:10px auto 2px}
#modal .nnres svg{display:block; animation:nnresIn .5s cubic-bezier(.2,1.5,.4,1)}
#modal .nnres span{font-family:var(--disp); font-size:13px; color:#6A5884}
@keyframes nnresIn{0%{transform:scale(.6) rotate(-6deg); opacity:0}100%{transform:none; opacity:1}}
@media (prefers-reduced-motion: reduce){ .ng-nono .nn-c, .ng-nono .nn-c::before, .ng-nono .nn-cl{animation:none!important; transition:none!important} }
`,
    sounds:{
      nonoFill(o){ const n = Math.min(14, o.n || 0); aMarimba(penta(n, 67), { v:.16, d:.32, pan:o.pan }); aThump({ f:170, f2:90, d:.05, v:.07, pan:o.pan }); },
      nonoMark(o){ aTone({ f:rnd(520, 600) + Math.min(8, o.n || 0) * 22, type:'triangle', d:.035, v:.05, pan:o.pan }); aNoise({ ft:'highpass', f:3600, d:.015, v:.025 }); },
      nonoNo(){ aTone({ f:260, f2:220, type:'triangle', d:.07, v:.06 }); },
      nonoLine(o){ const k = Math.min(3, o.k || 1), notes = [72, 76, 79, 84, 88, 91, 96]; for(let i = 0; i < 3 + k * 2 && i < notes.length; i++) aBell({ f:m2f(notes[i]), t:.04 + i * .045, d:.7, v:.065, idx:1.3, rev:.45 }); aWhoosh({ f:900, f2:4200, a:.04, d:.28, v:.045 }); for(let i = 0; i < 5; i++) aTone({ f:rnd(900, 1200), type:'triangle', t:.05 + i * .035, d:.025, v:.02 }); },
      nonoWarn(o){ const hi = (o.s || 10) <= 3; aTone({ f:hi ? 1320 : 990, type:'square', lp:3000, d:.06, v:hi ? .05 : .035, bus:'ui' }); },
      nonoReveal(){ aWhoosh({ f:300, f2:4600, q:1.2, a:.1, d:.5, v:.06 }); [0, 2, 4, 7, 9, 12].forEach((d, i) => aBell({ f:penta(d, 72), t:.1 + i * .07, d:.8, v:.05, idx:1.2, rev:.45 })); }
    },
    gate:{ nonoFill:28, nonoMark:24, nonoNo:120, nonoLine:90 },
    jingle(){ [0, 2, 4, 5, 7, 9, 11, 12].forEach((d, i) => aMarimba(m2f(67 + [0, 2, 4, 7, 9, 12, 16, 19][i]), { t:i * .065, v:.15 })); [72, 76, 79, 84].forEach(m => aBell({ f:m2f(m + 12), t:.58, d:1.4, v:.05, idx:1.2, rev:.5 })); aSparkle({ t:.62, n:6 }); }
  };
})();


/* 대전: AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
/* 대전 결과 창(#modal)이 뜨면 순위 아래에 이번 판의 완성 그림을 작게 끼워 넣음(보이기만, 엔진은 그대로) */
function nonoResWatch(){
  const me = G, m = document.getElementById('modal'); if(!m || typeof MutationObserver === 'undefined' || me.nnRes) return;
  const ob = me.nnRes = new MutationObserver(() => { try{
    if(G !== me){ ob.disconnect(); return; }
    const D = G.duel; if(!D || !D.resolved || m.querySelector('.nnres')) return;
    const at = m.querySelector('.dres-list, .dres'); if(!at || !G.sol || !G.nnCol) return;
    const N = G.N, c = Math.max(6, Math.floor(84 / N)), W = c * N; let g = '';
    for(let i = 0; i < N * N; i++) if(G.sol[i]) g += `<rect x="${(i % N) * c}" y="${Math.floor(i / N) * c}" width="${c}" height="${c}" fill="${G.nnCol[i]}"/>`;
    at.insertAdjacentHTML('afterend', `<div class="nnres"><svg viewBox="-2 -2 ${W + 4} ${W + 4}" width="${W + 4}" height="${W + 4}" role="img" aria-label="이번 판 완성 그림"><rect x="-2" y="-2" width="${W + 4}" height="${W + 4}" rx="6" fill="#FFFDF6" stroke="#1A0F45" stroke-width="2"/>${g}</svg><span>이번 판 그림</span></div>`);
    ob.disconnect();
  }catch(_){ ob.disconnect(); } });
  ob.observe(m, { childList:true });
}
Object.assign(NG.nono, { duelPace:[90,.85], duelStat:{ unit:'칸', get:() => { if(G.duel && G.duel.v === 3) nonoResWatch(); return { v:G.found, t:G.total, mis:G.miss || 0 }; } } });   /* 7×7 판: 컴퓨터 평균 90초. 대전은 기회가 없어 lf 대신 틀린 횟수(mis) */
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.nono.scene = { kind:'shapes', colors:['#8E6BD1','#5B8DEF','#F0368A'], density:1, alpha:.9 };
