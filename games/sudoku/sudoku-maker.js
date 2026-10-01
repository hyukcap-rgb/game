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
