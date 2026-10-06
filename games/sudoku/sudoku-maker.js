/* 스도쿠: 문제 만들기(오늘의 시험지·대전용) */


function countSud(g, limit){
  g = g.slice();
  const row = new Array(9).fill(0), col = new Array(9).fill(0), box = new Array(9).fill(0);
  for(let i=0;i<81;i++){ const v = g[i]; if(v){ const b = 1 << v, r = (i/9)|0, c = i%9, x = ((r/3)|0)*3 + ((c/3)|0); row[r] |= b; col[c] |= b; box[x] |= b; } }
  let count = 0;
  (function bt(){
    if(count >= limit) return;
    let best = -1, bestMask = 0, bestN = 10;
    for(let i=0;i<81;i++){
      if(g[i]) continue;
      const r = (i/9)|0, c = i%9, x = ((r/3)|0)*3 + ((c/3)|0);
      const m = ~(row[r] | col[c] | box[x]) & 0x3FE;
      let n = 0; for(let t=m; t; t &= t-1) n++;
      if(n < bestN){ best = i; bestMask = m; bestN = n; if(n <= 1) break; }
    }
    if(best === -1){ count++; return; }
    if(bestN === 0) return;
    const r = (best/9)|0, c = best%9, x = ((r/3)|0)*3 + ((c/3)|0);
    for(let v=1; v<=9; v++){
      const b = 1 << v; if(!(bestMask & b)) continue;
      g[best] = v; row[r] |= b; col[c] |= b; box[x] |= b;
      bt();
      g[best] = 0; row[r] &= ~b; col[c] &= ~b; box[x] &= ~b;
      if(count >= limit) return;
    }
  })();
  return count;
}
function genSudoku(rng, minGivens){
  const base = (r,c) => ((r*3 + Math.floor(r/3) + c) % 9) + 1;
  const rows = [], cols = [];
  for(const b of shuffle([0,1,2], rng)) for(const i of shuffle([0,1,2], rng)) rows.push(b*3+i);
  for(const s of shuffle([0,1,2], rng)) for(const i of shuffle([0,1,2], rng)) cols.push(s*3+i);
  const dig = shuffle([1,2,3,4,5,6,7,8,9], rng), tr = rng() < 0.5;
  const sol = [];
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){ const a = tr ? c : r, b = tr ? r : c; sol[r*9+c] = dig[base(rows[a], cols[b]) - 1]; }
  const puz = sol.slice(); let givens = 81;
  for(const i of shuffle([...Array(81).keys()], rng)){
    if(givens <= minGivens) break;
    const v = puz[i]; puz[i] = 0;
    if(countSud(puz, 2) !== 1) puz[i] = v; else givens--;
  }
  return { sol, puz };
}

/* ===== 대전 전용 6×6 판(WP10, 2026-10-06): 2×3 상자, 숫자 1~6, 빈칸 holes개(기본 18) =====
   만드는 법: 바른 완성 판(줄·상자 규칙식) → 띠(2줄 묶음)·띠 안 줄·기둥(3칸 묶음)·기둥 안 칸·숫자를 씨앗 rng로 섞음 →
   칸을 하나씩 비워 보며 "사람 기술(채울 수 있는 숫자가 하나뿐인 칸 · 줄/상자에서 그 숫자가 갈 곳이 하나뿐)"만으로 끝까지 풀릴 때만 비움.
   기술만으로 끝까지 풀린다 = 답이 하나뿐(찍기 없음). 시도 횟수로만 멈춤(시간으로 안 멈춤) → 어느 기기에서나 같은 판 */
const SUD6 = (() => {
  const S = 6, BR = 2, BC = 3, NN = 36, ALL = 0x7E;   /* 숫자 d의 비트 = 1 << d (1~6) */
  const units = [];
  for(let r = 0; r < S; r++) units.push([...Array(S)].map((_, c) => r * S + c));
  for(let c = 0; c < S; c++) units.push([...Array(S)].map((_, r) => r * S + c));
  for(let b = 0; b < S; b++){ const r0 = Math.floor(b / 2) * BR, c0 = (b % 2) * BC; units.push([...Array(S)].map((_, k) => (r0 + Math.floor(k / BC)) * S + c0 + k % BC)); }
  const peers = [...Array(NN)].map((_, i) => { const s = new Set(); units.forEach(u => { if(u.includes(i)) u.forEach(j => { if(j !== i) s.add(j); }); }); return [...s]; });
  const pc = m => { let n = 0; for(; m; m &= m - 1) n++; return n; };
  /* 기술 판정: 네이키드 싱글 + 히든 싱글만으로 끝까지 풀리면 true */
  function easy(puz){
    const g = puz.slice(); let left = g.filter(v => !v).length;
    for(let guard = 0; guard < 80 && left; guard++){
      let hit = false;
      const cand = i => { let m = ALL; for(const j of peers[i]) if(g[j]) m &= ~(1 << g[j]); return m; };
      for(let i = 0; i < NN; i++) if(!g[i]){ const m = cand(i); if(!m) return false; if(pc(m) === 1){ g[i] = 31 - Math.clz32(m); left--; hit = true; } }
      if(hit) continue;
      for(const u of units){ for(let d = 1; d <= S; d++){ if(u.some(i => g[i] === d)) continue; const at = u.filter(i => !g[i] && (cand(i) & (1 << d)));
        if(!at.length) return false; if(at.length === 1){ g[at[0]] = d; left--; hit = true; } } }
      if(!hit) return false;
    }
    return left === 0;
  }
  /* 답 세기(검증용) */
  function count(puz, limit){
    const g = puz.slice(); let k = 0;
    (function bt(){ if(k >= limit) return; let best = -1, bm = 0, bn = 9;
      for(let i = 0; i < NN; i++){ if(g[i]) continue; let m = ALL; for(const j of peers[i]) if(g[j]) m &= ~(1 << g[j]); const q = pc(m); if(q < bn){ best = i; bm = m; bn = q; } }
      if(best < 0){ k++; return; }
      for(let d = 1; d <= S; d++) if(bm & (1 << d)){ g[best] = d; bt(); g[best] = 0; if(k >= limit) return; } })();
    return k;
  }
  function gen(rng, holes){
    holes = holes || 18;
    const base = (r, c) => (BC * (r % BR) + Math.floor(r / BR) + c) % S;
    const rows = [], cols = [];
    for(const b of shuffle([0, 1, 2], rng)) for(const i of shuffle([0, 1], rng)) rows.push(b * BR + i);
    for(const s of shuffle([0, 1], rng)) for(const i of shuffle([0, 1, 2], rng)) cols.push(s * BC + i);
    const dig = shuffle([1, 2, 3, 4, 5, 6], rng), sol = [];
    for(let r = 0; r < S; r++) for(let c = 0; c < S; c++) sol[r * S + c] = dig[base(rows[r], cols[c])];
    let best = null;
    for(let t = 0; t < 40; t++){
      const puz = sol.slice(); let h = 0;
      for(const i of shuffle([...Array(NN).keys()], rng)){
        if(h >= holes) break;
        const v = puz[i]; puz[i] = 0;
        if(easy(puz)) h++; else puz[i] = v;
      }
      if(!best || h > best.h) best = { puz, h };
      if(h >= holes) break;
    }
    return { sol, puz:best.puz, size:S, br:BR, bc:BC };
  }
  return { gen, easy, count, units, S, BR, BC };
})();
function genSudoku6(rng, holes){ return SUD6.gen(rng, holes); }
