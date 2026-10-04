/* 자동차 주차하기 — 판 풀이 도구(게임과 문제 만들기 스크립트가 같이 쓴다)
   판 P = { W, H, cars:[{ r, c, len, h }], walls:[칸 번호…], goals:[[차 번호, 목표 위치]…], once:[차 번호…], way:{ 차 번호:+1|-1 }, ice:bool }
   - 차 위치 = 가로 차는 c(왼쪽 끝 열), 세로 차는 r(위쪽 끝 행). 차는 자기 방향(가로/세로)으로만 미끄러진다.
   - 한 수 = 차 한 대를 원하는 칸 수만큼 한 번에 미는 것.
   - once(한 번만 움직이는 차): 한 번 움직이면 더 못 움직임. way(일방통행 차): 한 방향으로만. ice(미끄러운 바닥): 멈출 때까지 끝까지 미끄러짐.
   - 상태 = 위치 배열 + 한 번 움직인 차 표시(used 비트, 차 번호 기준). 너비 우선 탐색(BFS)으로 최단 수를 찾는다.
   - 빠르게: 상태 열쇠는 숫자(차마다 자리 수만큼 곱하는 혼합 진법), 칸 점유는 한 배열을 다시 씀. Math.random 없음. */
const PKS = (() => {
  function occ(P, pos){
    const o = new Int8Array(P.W * P.H).fill(-1);
    for(const w of P.walls || []) o[w] = -2;
    P.cars.forEach((k, i) => { for(let t = 0; t < k.len; t++){ const r = k.h ? k.r : pos[i] + t, c = k.h ? pos[i] + t : k.c; o[r * P.W + c] = i; } });
    return o;
  }
  /* 차 i가 갈 수 있는 위치 범위 [lo, hi] (지금 판에서, 규칙 무시) */
  function range(P, pos, i, o){
    o = o || occ(P, pos);
    const k = P.cars[i], W = P.W, lim = k.h ? W : P.H, at = v => k.h ? k.r * W + v : v * W + k.c;
    let lo = pos[i], hi = pos[i];
    while(lo - 1 >= 0 && o[at(lo - 1)] === -1) lo--;
    while(hi + k.len < lim && o[at(hi + k.len)] === -1) hi++;
    return [lo, hi];
  }
  function prep(P){
    P.onceMask = (P.once || []).reduce((m, i) => m | (1 << i), 0);
    P.way = P.way || {};
    /* 숫자 열쇠: 차마다 자리 수(rad)로 곱함. used는 한 번 차만 골라 작은 수로 */
    let mul = 1; P.mul = P.cars.map(k => { const m = mul; mul *= (k.h ? P.W : P.H) - k.len + 1; return m; });
    P.onceList = P.cars.map((_, i) => i).filter(i => P.onceMask & (1 << i));
    P.uMul = mul;
    return P;
  }
  const ucode = (P, used) => { let c = 0; P.onceList.forEach((i, j) => { if(used & (1 << i)) c |= 1 << j; }); return c; };
  const keyOf = (pos, used) => Array.prototype.join.call(pos, ',') + '|' + used;   /* 게임 쪽 기억용(문자열) */
  /* 한 수로 갈 수 있는 모든 다음 상태: [차, 새 위치] (게임·스크립트용, 느려도 됨) */
  function moves(P, pos, used){
    const o = occ(P, pos), out = [], once = P.onceMask || 0, way = P.way || {};
    for(let i = 0; i < P.cars.length; i++){
      if(once & (1 << i) && used & (1 << i)) continue;
      const [lo, hi] = range(P, pos, i, o), w = way[i] || 0, p = pos[i];
      if(P.ice){
        if(lo < p && w !== 1) out.push([i, lo]);
        if(hi > p && w !== -1) out.push([i, hi]);
      } else {
        if(w !== 1) for(let v = lo; v < p; v++) out.push([i, v]);
        if(w !== -1) for(let v = p + 1; v <= hi; v++) out.push([i, v]);
      }
    }
    return out;
  }
  const isGoal = (P, pos) => P.goals.every(([i, g]) => pos[i] === g);
  /* 최단 풀이: { n:최단 수, path:[[차, 위치]…], states } 또는 null(못 풂·cap 넘음) */
  function solve(P, pos0, used0, cap){
    prep(P); cap = cap || 400000;
    const n = P.cars.length, W = P.W, H = P.H, cars = P.cars, mul = P.mul, uMul = P.uMul, ice = !!P.ice;
    const way = new Int8Array(n), once = new Uint8Array(n), uBit = new Int32Array(n);
    for(let i = 0; i < n; i++){ way[i] = P.way[i] || 0; }
    P.onceList.forEach((i, j) => { once[i] = 1; uBit[i] = 1 << j; });
    const gi = P.goals.map(g => g[0]), gv = P.goals.map(g => g[1]), ng = gi.length;
    const start = Int8Array.from(pos0);
    if(isGoal(P, start)) return { n:0, path:[], states:1 };
    const base = new Int8Array(W * H).fill(-1); for(const w of P.walls || []) base[w] = -2;
    const o = new Int8Array(W * H);
    /* 상태 저장: 위치(n칸씩), 부모 번호, 움직인 차·위치 */
    let capS = 4096, POS = new Int8Array(capS * n), PAR = new Int32Array(capS), MC = new Int8Array(capS), MV = new Int8Array(capS), U = new Int32Array(capS);
    const grow = () => { capS *= 2; const a = new Int8Array(capS * n); a.set(POS); POS = a; const b = new Int32Array(capS); b.set(PAR); PAR = b; const c = new Int8Array(capS); c.set(MC); MC = c; const d = new Int8Array(capS); d.set(MV); MV = d; const e = new Int32Array(capS); e.set(U); U = e; };
    let u0 = 0; P.onceList.forEach((i, j) => { if((used0 || 0) & (1 << i)) u0 |= 1 << j; });
    let k0 = 0; for(let i = 0; i < n; i++) k0 += start[i] * mul[i];
    const seen = new Map(); seen.set(k0 + u0 * uMul, 0);
    POS.set(start, 0); PAR[0] = -1; U[0] = u0;
    let count = 1;
    const done = j => { const path = []; while(PAR[j] >= 0){ path.push([MC[j], MV[j]]); j = PAR[j]; } path.reverse(); return { n:path.length, path, states:count }; };
    for(let h = 0; h < count; h++){
      const off = h * n, uu = U[h];
      let key = 0; for(let i = 0; i < n; i++) key += POS[off + i] * mul[i];
      o.set(base);
      for(let i = 0; i < n; i++){ const k = cars[i], p = POS[off + i]; if(k.h){ const b = k.r * W + p; for(let t = 0; t < k.len; t++) o[b + t] = i; } else { for(let t = 0; t < k.len; t++) o[(p + t) * W + k.c] = i; } }
      for(let i = 0; i < n; i++){
        if(once[i] && (uu & uBit[i])) continue;
        const k = cars[i], p = POS[off + i], len = k.len;
        let lo = p, hi = p;
        if(k.h){ const b = k.r * W; while(lo > 0 && o[b + lo - 1] === -1) lo--; while(hi + len < W && o[b + hi + len] === -1) hi++; }
        else { while(lo > 0 && o[(lo - 1) * W + k.c] === -1) lo--; while(hi + len < H && o[(hi + len) * W + k.c] === -1) hi++; }
        if(lo === hi) continue;
        const nu = once[i] ? uu | uBit[i] : uu;
        for(let v = lo; v <= hi; v++){
          if(v === p) continue;
          if(ice && v !== lo && v !== hi) continue;
          if(way[i] > 0 && v < p) continue;
          if(way[i] < 0 && v > p) continue;
          const nk = key + (v - p) * mul[i] + nu * uMul;
          if(seen.has(nk)) continue;
          if(count >= capS) grow();
          const no = count * n;
          POS.copyWithin(no, off, off + n); POS[no + i] = v; PAR[count] = h; MC[count] = i; MV[count] = v; U[count] = nu;
          seen.set(nk, count);
          let g = true; for(let q = 0; q < ng; q++) if(POS[no + gi[q]] !== gv[q]){ g = false; break; }
          count++;
          if(g) return done(count - 1);
          if(count > cap) return null;
        }
      }
    }
    return null;
  }
  /* 판 글자(문제 목록) → 판. 글자: '.' 빈칸, '#' 기둥, 'A' 빨간 차, 'B'~ 다른 차(같은 글자가 이어진 칸이 한 대) */
  function decode(str, W, H, goalStr){
    const cars = [], walls = [], ids = {};
    for(let i = 0; i < W * H; i++){
      const ch = str[i]; if(ch === '.') continue; if(ch === '#'){ walls.push(i); continue; }
      const r = Math.floor(i / W), c = i % W;
      if(ids[ch] != null){ cars[ids[ch]].len++; continue; }
      const h = c + 1 < W && str[i + 1] === ch;
      ids[ch] = ch.charCodeAt(0) - 65; cars[ids[ch]] = { r, c, len:1, h };
    }
    const goals = String(goalStr).split(',').map((g, i) => [i, +g]);
    return { W, H, cars, walls, goals };
  }
  function encode(P, pos){
    const s = new Array(P.W * P.H).fill('.');
    (P.walls || []).forEach(w => { s[w] = '#'; });
    P.cars.forEach((k, i) => { for(let t = 0; t < k.len; t++){ const r = k.h ? k.r : pos[i] + t, c = k.h ? pos[i] + t : k.c; s[r * P.W + c] = String.fromCharCode(65 + i); } });
    return s.join('');
  }
  const posOf = P => P.cars.map(k => k.h ? k.c : k.r);
  return { solve, moves, range, occ, decode, encode, posOf, isGoal, prep, keyOf, ucode };
})();
if(typeof module !== 'undefined') module.exports = PKS;
