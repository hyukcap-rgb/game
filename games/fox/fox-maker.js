/* 여우 자리 찾기: 문제 만들기(오늘의 시험지·대전용 genFox, 솔로용 fxx 엔진) */
function countFox(reg, N, limit, fixed){
  let count = 0; const colU = new Array(N).fill(false), regU = new Array(N).fill(false), pos = [];
  (function bt(r){
    if(count >= limit) return;
    if(r === N){ count++; return; }
    for(let c=0;c<N;c++){
      if(fixed && fixed[r] >= 0 && fixed[r] !== c) continue;
      if(colU[c]) continue;
      const g = reg[r*N+c]; if(regU[g]) continue;
      if(r > 0 && Math.abs(pos[r-1]-c) < 2) continue;
      colU[c] = regU[g] = true; pos[r] = c; bt(r+1); colU[c] = regU[g] = false;
    }
  })(0);
  return count;
}
/* 여우 자리 찾기 생성기: 정답 배치 → 구역 키우기 → 다른 답이 있으면 그 답의 칸을 이웃 구역으로 넘겨 없앰(답이 하나가 될 때까지) */
function solveFox(reg, N, limit){
  const out = [], colU = new Array(N).fill(false), regU = new Array(N).fill(false), pos = [];
  (function bt(r){
    if(out.length >= limit) return;
    if(r === N){ out.push(pos.slice()); return; }
    for(let c=0;c<N;c++){
      if(colU[c]) continue;
      const g = reg[r*N+c]; if(regU[g]) continue;
      if(r > 0 && Math.abs(pos[r-1]-c) < 2) continue;
      colU[c] = regU[g] = true; pos[r] = c; bt(r+1); colU[c] = regU[g] = false;
    }
  })(0);
  return out;
}
function genFox(rng, N){
  let best = null;
  for(let attempt=0; attempt<40; attempt++){
    const perm = [], used = new Array(N).fill(false);
    (function bt(r){
      if(r === N) return true;
      for(const c of shuffle([...Array(N).keys()], rng)){
        if(used[c] || (r > 0 && Math.abs(perm[r-1]-c) < 2)) continue;
        used[c] = true; perm[r] = c;
        if(bt(r+1)) return true;
        used[c] = false;
      }
      return false;
    })(0);
    const reg = new Array(N*N).fill(-1), seed = new Array(N*N).fill(false);
    for(let r=0;r<N;r++){ reg[r*N+perm[r]] = r; seed[r*N+perm[r]] = true; }
    const nb = i => { const r = Math.floor(i/N), c = i%N, o = []; if(r) o.push(i-N); if(r < N-1) o.push(i+N); if(c) o.push(i-1); if(c < N-1) o.push(i+1); return o; };
    /* 크기가 들쭉날쭉하게: 구역마다 성장 가중치를 달리 줌 */
    const w = [...Array(N)].map(() => 0.5 + rng()*1.8);
    let left = N*N - N;
    while(left > 0){
      const cands = [];
      for(let i=0;i<N*N;i++){ if(reg[i] !== -1) continue; for(const j of nb(i)) if(reg[j] !== -1) cands.push([i, reg[j]]); }
      let tot = 0; for(const [, g] of cands) tot += w[g];
      let x = rng()*tot, k = 0; for(; k<cands.length-1; k++){ x -= w[cands[k][1]]; if(x <= 0) break; }
      reg[cands[k][0]] = cands[k][1]; left--;
    }
    const connected = (g, without) => {
      const cells = []; for(let i=0;i<N*N;i++) if(reg[i] === g && i !== without) cells.push(i);
      if(!cells.length) return false;
      const seen = new Set([cells[0]]), st = [cells[0]];
      while(st.length){ const i = st.pop(); for(const j of nb(i)) if(j !== without && reg[j] === g && !seen.has(j)){ seen.add(j); st.push(j); } }
      return seen.size === cells.length;
    };
    let ok = false;
    for(let it=0; it<N*N*3; it++){
      const sols = solveFox(reg, N, 2);
      if(sols.length === 1){ ok = true; break; }
      const alt = sols.find(s => s.some((c, r) => c !== perm[r])) || sols[1];
      let moved = false;
      for(const r of shuffle([...Array(N).keys()], rng)){
        if(alt[r] === perm[r]) continue;
        const i = r*N + alt[r], g = reg[i];
        if(seed[i]) continue;
        const targets = shuffle(nb(i).map(j => reg[j]).filter(h => h !== g), rng);
        if(!targets.length || !connected(g, i)) continue;
        reg[i] = targets[0]; moved = true; break;
      }
      if(!moved) break;
    }
    const tiny = [...Array(N)].filter((_, g) => reg.filter(x => x === g).length === 1).length;
    if(ok && tiny === 0) return { N, reg, sol:perm.slice(), tries:attempt + 1 };
    if(ok && (!best || !best.ok)) best = { N, reg:reg.slice(), sol:perm.slice(), tries:attempt + 1, ok:true };
    continue;
  }
  return best || { N, reg:[], sol:[], tries:40 };
}

/* FOXX-BEGIN ===== 여우 난이도 v2 엔진(솔로 전용): 바위 칸·여우 굴 숫자·쌍둥이 여우·가늘고 긴 구역 =====
   오늘의 문제·대전은 위 genFox를 그대로 쓴다. 여기는 G.adv(솔로)에서만.
   판 P = { N, k(줄·구역마다 여우 수 1|2), reg(구역 번호, 바위 −1), blk(1=여우 못 옴: 바위·숫자 칸), rock, clue(숫자, 없으면 −1), sol(정답 칸 번호) } */
const FXX_NB8 = {};
function fxxNb8(N){
  if(FXX_NB8[N]) return FXX_NB8[N];
  const out = FXX_NB8[N] = [];
  for(let i=0;i<N*N;i++){ const r = (i/N)|0, c = i%N, o = [];
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ if(!dr && !dc) continue; const rr = r+dr, cc = c+dc; if(rr >= 0 && rr < N && cc >= 0 && cc < N) o.push(rr*N+cc); }
    out.push(o); }
  return out;
}
function fxxNb4(N, i){ const r = (i/N)|0, c = i%N, o = []; if(r) o.push(i-N); if(r < N-1) o.push(i+N); if(c) o.push(i-1); if(c < N-1) o.push(i+1); return o; }
/* 답 세기(최대 limit개): 칸마다 여우/빈칸을 정해 가며 규칙으로 좁히고(줄·열·구역 개수, 이웃, 숫자), 가장 빡빡한 단위에서 갈라 봄 */
function fxxSolve(P, limit){
  const { N, k, reg, blk, clue } = P, NN = N*N;
  const nb8 = fxxNb8(N), units = [], need = [];
  const rowU = [...Array(N)].map(() => []), colU = [...Array(N)].map(() => []), regU = [...Array(N)].map(() => []);
  for(let i=0;i<NN;i++){ if(blk[i]) continue; rowU[(i/N)|0].push(i); colU[i%N].push(i); if(reg[i] >= 0) regU[reg[i]].push(i); }
  for(const u of rowU.concat(colU, regU)){ units.push(u); need.push(k); }
  if(clue) for(let i=0;i<NN;i++) if(clue[i] >= 0){ units.push(nb8[i].filter(j => !blk[j])); need.push(clue[i]); }
  const cellU = [...Array(NN)].map(() => []);
  units.forEach((u, x) => u.forEach(c => cellU[c].push(x)));
  const UN = units.length, out = [];
  const st0 = new Uint8Array(NN); for(let i=0;i<NN;i++) if(blk[i]) st0[i] = 2;
  /* 0 모름 1 여우 2 빈칸. 큐로 바뀐 칸의 단위만 다시 봄 */
  const prop = (s, q) => {
    const inQ = new Uint8Array(UN), uq = [];
    const push = c => { for(const x of cellU[c]) if(!inQ[x]){ inQ[x] = 1; uq.push(x); } };
    for(const c of q){ if(s[c] === 1) for(const j of nb8[c]){ if(s[j] === 1) return false; if(s[j] === 0){ s[j] = 2; push(j); } } push(c); }
    if(!q.length) for(let x=0;x<UN;x++){ inQ[x] = 1; uq.push(x); }
    while(uq.length){
      const x = uq.pop(); inQ[x] = 0;
      const u = units[x], nd = need[x]; let f = 0, n0 = 0;
      for(const c of u){ const v = s[c]; if(v === 1) f++; else if(!v) n0++; }
      if(f > nd || f + n0 < nd) return false;
      if(!n0 || (f !== nd && f + n0 !== nd)) continue;
      const v = f === nd ? 2 : 1;
      for(const c of u) if(!s[c]){ s[c] = v; push(c);
        if(v === 1) for(const j of nb8[c]){ if(s[j] === 1) return false; if(!s[j]){ s[j] = 2; push(j); } } }
    }
    return true;
  };
  const dfs = s => {
    if(out.length >= limit) return;
    /* 남은 자리 여유(모르는 칸 − 필요 수)가 가장 적은 단위 */
    let bx = -1, bs = 1e9;
    for(let x=0;x<UN;x++){ const u = units[x]; let f = 0, n0 = 0; for(const c of u){ const v = s[c]; if(v === 1) f++; else if(!v) n0++; }
      if(!n0) continue; const sl = n0 - (need[x] - f); if(sl < bs){ bs = sl; bx = x; if(sl <= 1) break; } }
    if(bx < 0){ const r = []; for(let i=0;i<NN;i++) if(s[i] === 1) r.push(i); out.push(r); return; }
    const c = units[bx].find(c => !s[c]);
    for(const v of [1, 2]){
      const t = s.slice(); t[c] = v;
      if(prop(t, [c])) dfs(t);
      if(out.length >= limit) return;
    }
  };
  if(prop(st0, [])) dfs(st0);
  return out;
}
/* 정답 심기: 줄·열마다 k마리, 서로 안 붙게 */
function fxxPlant(rng, N, k){
  const colCnt = new Int8Array(N), pos = [];
  const opts = [];
  if(k === 1) for(let c=0;c<N;c++) opts.push([c]);
  else for(let a=0;a<N;a++) for(let b=a+2;b<N;b++) opts.push([a, b]);
  let budget = 20000;
  const ok = (function bt(r){
    if(r === N) return true;
    if(--budget < 0) return false;
    for(const cmb of shuffle(opts.slice(), rng)){
      if(cmb.some(c => colCnt[c] >= k)) continue;
      if(r && pos[r-1].some(p => cmb.some(c => Math.abs(p - c) < 2))) continue;
      cmb.forEach(c => colCnt[c]++);
      let f = true;
      for(let c=0;c<N && f;c++){ const need = k - colCnt[c], st = cmb.includes(c) ? r+2 : r+1; if(need > Math.ceil(Math.max(0, N - st)/2)) f = false; }
      if(f){ pos[r] = cmb; if(bt(r+1)) return true; }
      cmb.forEach(c => colCnt[c]--);
    }
    return false;
  })(0);
  if(!ok) return null;
  const s = []; pos.forEach((cmb, r) => cmb.forEach(c => s.push(r*N+c)));
  return s;
}
function fxxConnected(reg, N, g, without, blk){
  const cells = []; for(let i=0;i<N*N;i++) if(reg[i] === g && i !== without) cells.push(i);
  if(!cells.length) return false;
  const seen = new Set([cells[0]]), st = [cells[0]];
  while(st.length){ const i = st.pop(); for(const j of fxxNb4(N, i)) if(j !== without && reg[j] === g && !seen.has(j)){ seen.add(j); st.push(j); } }
  return seen.size === cells.length;
}
/* cfg = { N, k:1|2, rocks:바위 수, clue:숫자 규칙, clueT:숫자 전 남겨 둘 답 수, thin:긴 구역 } */
function fxxGen(rng, cfg){
  const N = cfg.N, k = cfg.k || 1, NN = N*N, nb8 = fxxNb8(N);
  const minSize = k === 1 ? 2 : 4;
  for(let attempt=0; attempt<30; attempt++){
    const sol = fxxPlant(rng, N, k); if(!sol) continue;
    const solSet = new Uint8Array(NN); sol.forEach(i => solSet[i] = 1);
    const blk = new Uint8Array(NN), rock = new Uint8Array(NN), clue = new Int8Array(NN).fill(-1);
    /* 1) 바위: 일부는 먼저 깔아 구역이 돌아가게, 나머지는 답을 하나로 좁히는 데 씀 */
    let rockLeft = cfg.rocks || 0;
    const rock0 = Math.round(rockLeft * 0.6);
    const allOpen = () => { const f = []; for(let i=0;i<NN;i++) if(!blk[i]) f.push(i); const seen = new Set([f[0]]), st = [f[0]];
      while(st.length){ const i = st.pop(); for(const j of fxxNb4(N, i)) if(!blk[j] && !seen.has(j)){ seen.add(j); st.push(j); } } return seen.size === f.length; };
    for(const i of shuffle([...Array(NN).keys()], rng)){
      if(rockLeft <= (cfg.rocks || 0) - rock0) break;
      if(solSet[i] || nb8[i].some(j => rock[j])) continue;
      blk[i] = rock[i] = 1;
      if(!allOpen()){ blk[i] = rock[i] = 0; continue; }
      rockLeft--;
    }
    /* 2) 구역 씨앗: k=1은 여우 하나, k=2는 가까운 여우 둘을 길로 이음 */
    const reg = new Int16Array(NN).fill(-1);
    let paired2 = k === 1;
    if(k === 1) sol.forEach((i, g) => reg[i] = g);
    else for(let pt=0; pt<6 && !paired2; pt++){
      reg.fill(-1);
      const paired = new Uint8Array(NN); let g = 0, fail = false;
      for(const a of shuffle(sol.slice(), rng)){
        if(paired[a]) continue;
        const from = new Int32Array(NN).fill(-2); from[a] = -1; const q = [a]; let b = -1;
        for(let h=0; h<q.length && b < 0; h++){ const i = q[h];
          for(const j of shuffle(fxxNb4(N, i), rng)){ if(from[j] !== -2 || blk[j] || reg[j] !== -1) continue;
            if(solSet[j]){ if(!paired[j]){ from[j] = i; b = j; break; } continue; }
            from[j] = i; q.push(j); } }
        if(b < 0){ fail = true; break; }
        for(let x=b; x!==-1; x=from[x]) reg[x] = g;
        paired[a] = paired[b] = 1; g++;
      }
      if(!fail) paired2 = true;
    }
    if(!paired2) continue;
    /* 3) 긴 구역: 구역마다 양 끝에서만 한 칸씩 뻗는 뱀. 뻗는 칸은 제 몸 옆에 붙지 않게(두 줄로 접히지 않게) */
    if(cfg.thin){
      const ends = [...Array(N)].map(() => []), sz = new Array(N).fill(0);
      for(let i=0;i<NN;i++) if(reg[i] >= 0) sz[reg[i]]++;
      for(let i=0;i<NN;i++){ const g = reg[i]; if(g < 0) continue; const d = fxxNb4(N, i).filter(j => reg[j] === g).length; if(d <= 1) ends[g].push(i); }
      ends.forEach(e => { if(e.length === 1) e.push(e[0]); });
      for(let guard=0; guard<NN*2; guard++){
        const opt = []; let tot = 0;
        for(let g=0; g<N; g++) ends[g].forEach((e, ei) => { for(const j of fxxNb4(N, e)){
          if(reg[j] !== -1 || blk[j] || fxxNb4(N, j).some(t => t !== e && reg[t] === g)) continue;
          const wt = 1 / sz[g]; opt.push([g, ei, j, wt]); tot += wt; } });
        if(!opt.length) break;
        let x = rng()*tot, m = 0; for(; m<opt.length-1; m++){ x -= opt[m][3]; if(x <= 0) break; }
        const [g, ei, j] = opt[m]; reg[j] = g; ends[g][ei] = j; sz[g]++;
      }
    }
    /* 구역 키우기(긴 구역이면 남은 빈틈만 메움) */
    const w = [...Array(N)].map(() => 0.5 + rng()*1.8);
    let left = 0; for(let i=0;i<NN;i++) if(reg[i] === -1 && !blk[i]) left++;
    while(left > 0){
      const cands = []; let tot = 0;
      for(let i=0;i<NN;i++){ if(reg[i] !== -1 || blk[i]) continue;
        const ns = fxxNb4(N, i);
        for(const j of ns){ const g = reg[j]; if(g < 0) continue;
          let wt = w[g];
          if(cfg.thin){   /* 끝에서 한 칸씩 뻗기 우대, 2×2 덩어리가 생기는 칸은 거의 안 줌 */
            let s = 0; for(const t of ns) if(reg[t] === g) s++;
            const r = (i/N)|0, c = i%N, G2 = (a, b) => a >= 0 && a < N && b >= 0 && b < N && reg[a*N+b] === g;
            let blob = false; for(const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) if(G2(r+dr, c) && G2(r, c+dc) && G2(r+dr, c+dc)) blob = true;
            wt *= blob ? 0.005 : s === 1 ? 1 : 0.15; }
          cands.push([i, g, wt]); tot += wt; } }
      if(!cands.length) break;
      let x = rng()*tot, m = 0; for(; m<cands.length-1; m++){ x -= cands[m][2]; if(x <= 0) break; }
      if(reg[cands[m][0]] === -1){ reg[cands[m][0]] = cands[m][1]; left--; }
    }
    if(left > 0) continue;
    const P = { N, k, reg, blk, rock, clue, sol };
    const size = g => { let n = 0; for(let i=0;i<NN;i++) if(reg[i] === g && !blk[i]) n++; return n; };
    /* 너무 작게 갇힌 구역(긴 구역에서 흔함)은 옆 구역 칸을 하나씩 얻어 옴 */
    for(let g=0, guard2=0; g<N && guard2 < NN; g++){
      if(size(g) >= minSize) continue;
      let got = false;
      for(let i=0;i<NN && !got;i++){ if(reg[i] !== g) continue;
        for(const j of fxxNb4(N, i)){ const h = reg[j]; if(h < 0 || h === g || blk[j] || solSet[j] || size(h) - 1 < minSize || !fxxConnected(reg, N, h, j)) continue; reg[j] = g; got = true; break; } }
      if(got){ g--; guard2++; }
    }
    /* 4) 답이 하나가 될 때까지: 다른 답의 여우 칸을 옆 구역으로 넘기거나 바위로 막거나(바위 규칙) 숫자로 가름(숫자 규칙) */
    const altOf = sols => sols.find(s => s.some(i => !solSet[i]));
    const blobAt = (i, h) => { const r = (i/N)|0, c = i%N, H = (a, b) => a >= 0 && a < N && b >= 0 && b < N && reg[a*N+b] === h;
      for(const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) if(H(r+dr, c) && H(r, c+dc) && H(r+dr, c+dc)) return true; return false; };
    /* i를 빼면 g가 끊기는 경우: 정답 여우가 없는 떨어진 조각까지 함께 옆 구역으로 */
    const cutOff = (g, i) => {
      const comps = [], seen = new Set([i]);
      for(let s0=0; s0<NN; s0++){ if(reg[s0] !== g || seen.has(s0)) continue;
        const cc = [s0]; seen.add(s0);
        for(let h=0; h<cc.length; h++) for(const j of fxxNb4(N, cc[h])) if(reg[j] === g && !seen.has(j)){ seen.add(j); cc.push(j); }
        comps.push(cc); }
      const keep = comps.filter(cc => cc.some(x => solSet[x]));
      if(keep.length !== 1) return null;
      return comps.filter(cc => cc !== keep[0]).flat();
    };
    const fixOnce = alt => {
      const cand = shuffle(alt.filter(x => !solSet[x]), rng);
      for(const strict of [true, false]) for(const i of cand){
        const g = reg[i], tg = shuffle(fxxNb4(N, i).map(j => reg[j]).filter(h => h >= 0 && h !== g && !(strict && cfg.thin && blobAt(i, h))), rng);
        const extra = cutOff(g, i); if(!extra) continue;
        const rest = size(g) - 1 - extra.filter(x => !blk[x]).length;
        if(strict && (rest < minSize || (cfg.thin && extra.length))) continue;
        if(rockLeft > 0 && !extra.length && rng() < 0.6){ reg[i] = -1; blk[i] = rock[i] = 1; rockLeft--; return true; }
        if(!tg.length) continue;
        if(cfg.thin) tg.sort((a, b) => size(a) - size(b));   /* 긴 구역: 한 구역만 뚱뚱해지지 않게 작은 구역부터 */
        reg[i] = tg[0]; extra.forEach(x => reg[x] = tg[0]); return true;
      }
      return false;
    };
    const cntSol = (set, c) => { let n = 0; for(const j of nb8[c]) n += set[j]; return n; };
    let sols = fxxSolve(P, 2), guard = NN*3, clues = 0, noClue = 0;
    if(cfg.clue){
      /* 가) 구역만으로는 답이 여러 개(2~T개) 남게 느슨하게 */
      const T = cfg.clueT || 6, T0 = Math.min(T, cfg.clueMin || 3);
      let cnt = fxxSolve(P, T + 1).length;
      /* 구역만으로 답이 너무 적으면(쌍둥이 판에 흔함) 정답 아닌 경계 칸을 옆 구역으로 흔들어 느슨하게 */
      for(let lo=0; cnt < T0 && lo < 80; lo++){
        const i = Math.floor(rng() * NN), g = reg[i];
        if(blk[i] || solSet[i] || size(g) - 1 < minSize) continue;
        const tg = fxxNb4(N, i).map(j => reg[j]).filter(h => h >= 0 && h !== g);
        if(!tg.length || !fxxConnected(reg, N, g, i)) continue;
        reg[i] = tg[Math.floor(rng() * tg.length)]; const c2 = fxxSolve(P, T + 1).length;
        if(c2 < cnt) reg[i] = g; else cnt = c2;   /* 답이 줄어드는 쪽으로는 안 감 */
      }
      if(cnt < T0) continue;
      while(cnt > T && guard-- > 0){
        const alt = altOf(fxxSolve(P, 2)); const bak = [reg.slice(), blk.slice(), rock.slice(), rockLeft];
        if(!fixOnce(alt)) break;
        const c2 = fxxSolve(P, T + 1).length;
        if(c2 < T0){ reg.set(bak[0]); blk.set(bak[1]); rock.set(bak[2]); rockLeft = bak[3]; break; }
        cnt = c2;
      }
      noClue = fxxSolve(P, 2).length;
      if(noClue < 2) continue;
      /* 나) 두 답에서 둘레 여우 수가 다른 칸에 숫자 */
      sols = fxxSolve(P, 2);
      while(sols.length > 1 && clues < (cfg.clueMax || 7)){
        const alt = altOf(sols), aSet = new Uint8Array(NN); alt.forEach(i => aSet[i] = 1);
        let best = [], bestS = -1;
        for(let c=0;c<NN;c++){
          if(blk[c] || solSet[c] || cntSol(solSet, c) === cntSol(aSet, c)) continue;
          if(size(reg[c]) - 1 < minSize) continue;
          const s = (aSet[c] ? 0 : 2) + (nb8[c].some(j => clue[j] >= 0) ? 0 : 1);
          if(s > bestS){ bestS = s; best = [c]; } else if(s === bestS) best.push(c);
        }
        if(!best.length) break;
        const c = best[Math.floor(rng()*best.length)];
        clue[c] = cntSol(solSet, c); blk[c] = 1; clues++;
        sols = fxxSolve(P, 2);
      }
    }
    while(sols.length > 1 && guard-- > 0){ if(!fixOnce(altOf(sols))) break; sols = fxxSolve(P, 2); }
    if(sols.length !== 1) continue;
    /* 긴 구역 다듬기: 2×2 덩어리의 칸을 옆 구역으로 넘겨도 답이 하나로 남으면 넘김(더 가늘게) */
    if(cfg.thin) for(let pass=0; pass<2; pass++) for(let r=0; r<N-1; r++) for(let c=0; c<N-1; c++){
      const q4 = [r*N+c, r*N+c+1, (r+1)*N+c, (r+1)*N+c+1], g = reg[q4[0]];
      if(g < 0 || q4.some(q => reg[q] !== g)) continue;
      let done = false;
      for(const q of shuffle(q4.slice(), rng)){ if(done || solSet[q] || blk[q] || size(g) - 1 < minSize || !fxxConnected(reg, N, g, q)) continue;
        for(const h of fxxNb4(N, q).map(j => reg[j])){ if(h < 0 || h === g || blobAt(q, h)) continue;
          reg[q] = h; if(fxxSolve(P, 2).length === 1){ done = true; break; } reg[q] = g; } }
    }
    let tiny = false; for(let g=0; g<N; g++) if(size(g) < minSize) tiny = true;
    if(tiny) continue;
    if(cfg.clue){ const Q = { N, k, reg, blk:blk.map((b, i) => rock[i] ? 1 : 0), clue:null }; if(fxxSolve(Q, 2).length < 2) continue; }
    return Object.assign(P, { tries:attempt + 1, clues });
  }
  return null;
}
/* 사람처럼 풀어 보며 난이도 재기: 기본 규칙(0) → 한 구역·한 줄 갇힘(1) → 두 개 갇힘(3) → 한 칸 가정(4) → 세 개 갇힘(6) → 깊은 가정(10) → 찍기(25) */
function fxxRate(P){
  const { N, k, reg, blk, clue, sol } = P, NN = N*N, nb8 = fxxNb8(N);
  const rowU = [...Array(N)].map(() => []), colU = [...Array(N)].map(() => []), regU = [...Array(N)].map(() => []);
  for(let i=0;i<NN;i++){ if(blk[i]) continue; rowU[(i/N)|0].push(i); colU[i%N].push(i); if(reg[i] >= 0) regU[reg[i]].push(i); }
  const units = rowU.concat(colU, regU);
  const clues = []; if(clue) for(let i=0;i<NN;i++) if(clue[i] >= 0) clues.push([nb8[i].filter(j => !blk[j]), clue[i]]);
  const st = new Uint8Array(NN); for(let i=0;i<NN;i++) if(blk[i]) st[i] = 2;
  if(P.given) for(const i of P.given) st[i] = 1;
  const prop = s => {
    let ch = true;
    while(ch){ ch = false;
      for(let i=0;i<NN;i++) if(s[i] === 1) for(const j of nb8[i]){ if(s[j] === 1) return false; if(s[j] === 0){ s[j] = 2; ch = true; } }
      const grp = (cells, need) => { let f = 0, u = 0; for(const c of cells){ if(s[c] === 1) f++; else if(s[c] === 0) u++; }
        if(f > need || f + u < need) return false;
        if(u && (f === need || f + u === need)){ const v = f === need ? 2 : 1; for(const c of cells) if(s[c] === 0) s[c] = v; ch = true; }
        return true; };
      for(const u of units) if(!grp(u, k)) return false;
      for(const [cells, v] of clues) if(!grp(cells, v)) return false;
    }
    return true;
  };
  const need = (s, u) => { let f = 0; for(const c of u) if(s[c] === 1) f++; return k - f; };
  const unk = (s, u) => u.filter(c => s[c] === 0);
  /* 갇힘: A쪽 단위 m개의 남은 칸이 B쪽 단위 m개 안에만 있고 필요 수가 같으면, B의 나머지 칸은 비움 */
  const keyR = i => (i/N)|0, keyC = i => i%N, keyG = i => reg[i];
  const PAIRS = [[regU, keyR, rowU], [regU, keyC, colU], [rowU, keyG, regU], [colU, keyG, regU]];
  const confine = (s, m) => {
    for(const [A, keyB, B] of PAIRS){
      const act = []; for(let a=0;a<A.length;a++) if(need(s, A[a]) > 0) act.push(a);
      const sub = (start, pick) => {
        if(pick.length === m){
          const bs = new Set(), inS = new Set(); let nS = 0;
          for(const a of pick){ nS += need(s, A[a]); for(const c of unk(s, A[a])){ bs.add(keyB(c)); inS.add(c); } }
          if(bs.size !== m) return false;
          let nB = 0; for(const b of bs) nB += need(s, B[b]);
          if(nB !== nS) return false;
          let did = false; for(const b of bs) for(const c of B[b]) if(s[c] === 0 && !inS.has(c)){ s[c] = 2; did = true; }
          return did;
        }
        for(let x=start; x<act.length; x++){ pick.push(act[x]); const d = sub(x+1, pick); pick.pop(); if(d) return true; }
        return false;
      };
      if(sub(0, [])) return true;
    }
    return false;
  };
  const hyp = (s, deep) => {
    for(let i=0;i<NN;i++){ if(s[i] !== 0) continue;
      for(const v of [1, 2]){
        const t = s.slice(); t[i] = v; let okk = prop(t);
        if(okk && deep){ while(okk && confine(t, 1)) okk = prop(t); }
        if(!okk){ s[i] = v === 1 ? 2 : 1; return true; } } }
    return false;
  };
  const W = [0, 1, 3, 4, 6, 10, 25], TECH = [null, s => confine(s, 1), s => confine(s, 2), s => hyp(s, false), s => confine(s, 3), s => hyp(s, true)];
  const use = [0, 0, 0, 0, 0, 0, 0];
  let score = 0, maxLv = 0, rounds = 0;
  while(rounds++ < 400){
    if(!prop(st)) return { score:-1, maxLv:-1, use, bad:true };
    if(!st.some(v => v === 0)) break;
    let lv = 0;
    for(let t=1; t<TECH.length; t++) if(TECH[t](st)){ lv = t; break; }
    if(!lv){ lv = 6; const c = sol.find(i => st[i] === 0); if(c == null) break; st[c] = 1; }
    use[lv]++; score += W[lv]; maxLv = Math.max(maxLv, lv);
  }
  return { score, maxLv, use };
}
/* FOXX-END */
