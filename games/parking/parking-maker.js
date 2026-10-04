/* 자동차 주차하기 — 문제 목록 만들기 스크립트(게임이 불러오지 않음, 사람이 node로 돌린다)
     node games/parking/parking-maker.js        → games/parking/parking-bank.js 를 다시 만든다
   방법(판마다 최단 수가 정확히 맞는 문제를 고르는 법):
   1) 씨앗 난수로 차를 무작위로 놓은 판 하나를 만든다(빨간 차 길 위에 가로 차는 두지 않음).
   2) 그 판에서 움직여 갈 수 있는 모든 상태를 모은다(연결된 상태 묶음).
   3) 묶음 안의 "목표 상태"(빨간 차·노란 차가 자리에 있음)에서 거꾸로 너비 우선 탐색 → 상태마다 최단 수.
      (보통 규칙에선 수를 되돌릴 수 있으니 같은 이웃 함수로 거꾸로 가도 된다. 미끄러운 바닥은 되돌릴 수 없어 앞쪽 간선을 모아 뒤집는다)
   4) 최단 수 d인 상태를 문제로 뽑아 갈래(크기·기둥·두 대·미끄럼)·수별 칸에 담는다.
   게임은 이 목록에서 rng로 고르고, 뒤집기(좌우·상하)와 차 색을 rng로 바꿔 쓴다. 같은 씨앗 = 같은 문제. */
const fs = require('fs'), path = require('path');
const PKS = require('./parking-solver.js');

function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

/* 갈래: 크기 6/7, p = 기둥, 2 = 노란 차도 주차, i = 미끄러운 바닥 */
const CATS = ['6', '6p', '62', '6p2', '7', '7p', '72', '7p2', '6i', '6pi', '62i', '6p2i'];
const MAXD = { i:16, n:25 };
const QUOTA = cat => cat === '6' ? 10 : ['6p', '62', '7', '6i'].includes(cat) ? 5 : 3;   /* 수 하나에 담을 문제 수 */

function randomBoard(rng, cat){
  const N = +cat[0], W = N, H = N, pillar = cat.includes('p'), pair = cat.includes('2');
  const o = new Int8Array(W * H).fill(-1), cars = [], walls = [];
  const free = (r, c, len, h) => { for(let t = 0; t < len; t++){ const rr = h ? r : r + t, cc = h ? c + t : c; if(rr >= H || cc >= W || o[rr * W + cc] !== -1) return false; } return true; };
  const put = (r, c, len, h) => { const i = cars.length; cars.push({ r, c, len, h }); for(let t = 0; t < len; t++) o[(h ? r : r + t) * W + (h ? c + t : c)] = i; };
  const rr = ri(rng, 1, H - 2), rc = ri(rng, 0, W - 4);
  put(rr, rc, 2, true);
  const goals = [[0, rng() < .3 ? ri(rng, Math.min(W - 2, rc + 2), W - 2) : W - 2]];   /* 출구(오른쪽 벽) 또는 판 안 주차 자리 */
  let yc = -1;
  if(pair){
    for(let t = 0; t < 50 && yc < 0; t++){ const c = ri(rng, 1, W - 2), r = ri(rng, 0, 1); if(free(r, c, 2, false)){ put(r, c, 2, false); yc = c; } }
    if(yc < 0) return null;
    goals.push([1, H - 2]);   /* 노란 차: 아래쪽 출구 */
  }
  if(pillar){ const n = N === 6 ? ri(rng, 1, 2) : ri(rng, 2, 3); for(let t = 0, k = 0; t < 60 && k < n; t++){ const i = ri(rng, 0, W * H - 1); if(o[i] === -1 && Math.floor(i / W) !== rr && i % W !== yc){ o[i] = -2; walls.push(i); k++; } } }
  const want = N === 6 ? ri(rng, 9, 13) : ri(rng, 15, 20);   /* 7×7은 빽빽해야 상태 수가 작고 깊은 판이 나온다 */
  for(let t = 0; t < 400 && cars.length < want; t++){
    const h = rng() < .5, len = rng() < .28 ? 3 : 2;
    const r = ri(rng, 0, H - (h ? 1 : len)), c = ri(rng, 0, W - (h ? len : 1));
    if(h && r === rr) continue;                  /* 빨간 차 줄에 가로 차 금지(영영 막힘) */
    if(!h && c === yc) continue;                 /* 노란 차 줄에 세로 차 금지 */
    if(free(r, c, len, h)) put(r, c, len, h);
  }
  return { W, H, cars, walls, goals, ice:cat.includes('i') };
}

/* 상태 묶음 + 목표까지 최단 수 */
function distances(P, cap){
  PKS.prep(P);
  const start = PKS.posOf(P), key = p => String.fromCharCode.apply(null, p);
  const idx = new Map([[key(start), 0]]), states = [start], rev = P.ice ? [[]] : null;
  for(let h = 0; h < states.length; h++){
    for(const [i, v] of PKS.moves(P, states[h], 0)){
      const np = states[h].slice(); np[i] = v; const k = key(np);
      let j = idx.get(k);
      if(j == null){ j = states.length; idx.set(k, j); states.push(np); if(rev) rev.push([]); if(states.length > cap) return null; }
      if(rev) rev[j].push(h);
    }
  }
  const dist = new Int16Array(states.length).fill(-1), q = [];
  states.forEach((p, j) => { if(PKS.isGoal(P, p)){ dist[j] = 0; q.push(j); } });
  if(!q.length) return null;
  for(let h = 0; h < q.length; h++){
    const j = q[h], nb = rev ? rev[j] : PKS.moves(P, states[j], 0).map(([i, v]) => { const np = states[j].slice(); np[i] = v; return idx.get(key(np)); });
    for(const x of nb) if(dist[x] < 0){ dist[x] = dist[j] + 1; q.push(x); }
  }
  return { states, dist };
}

/* 언덕 오르기: 차 하나를 빼거나 더해 보고, 가장 깊은 문제(최단 수 최대)가 줄지 않으면 받아들인다 → 어려운 판을 빨리 찾는다 */
function maxD(R){ let m = -1; for(const d of R.dist) if(d > m) m = d; return m; }
function climb(rng, P, cat){
  const capC = P.W === 7 ? 60000 : 30000;
  let R = distances(P, capC); if(!R) return null;
  let best = maxD(R);
  const N = P.W, steps = 30, keep = P.goals.length;
  for(let s = 0; s < steps; s++){
    const Q = { W:P.W, H:P.H, walls:P.walls.slice(), goals:P.goals, ice:P.ice, cars:P.cars.map(k => Object.assign({}, k)) };
    if(rng() < .5 && Q.cars.length > keep + 4){ Q.cars.splice(keep + Math.floor(rng() * (Q.cars.length - keep)), 1); }
    else {
      const o = PKS.occ(Q, PKS.posOf(Q)), rr = Q.cars[0].r, yc = keep > 1 ? Q.cars[1].c : -1;
      let ok = false;
      for(let t = 0; t < 30 && !ok; t++){
        const h = rng() < .5, len = rng() < .28 ? 3 : 2, r = ri(rng, 0, N - (h ? 1 : len)), c = ri(rng, 0, N - (h ? len : 1));
        if((h && r === rr) || (!h && c === yc)) continue;
        let free = true; for(let u = 0; u < len; u++) if(o[(h ? r : r + u) * N + (h ? c + u : c)] !== -1) free = false;
        if(free){ Q.cars.push({ r, c, len, h }); ok = true; }
      }
      if(!ok) continue;
    }
    const R2 = distances(Q, capC); if(!R2) continue;
    const d2 = maxD(R2);
    if(d2 >= best){ P = Q; R = R2; best = d2; }
  }
  return { P, R };
}

/* 최단 풀이 → 글자(차 글자 + 위치) */
const pathStr = path => path.map(([i, v]) => String.fromCharCode(65 + i) + v).join('');
function write(bank){
  const out = `/* 자동차 주차하기 — 문제 목록(parking-maker.js가 만든 파일, 손으로 고치지 않기)
   갈래 열쇠: 크기(6·7) + p(기둥) + 2(노란 차도 주차) + i(미끄러운 바닥)
   한 줄 = "판 글자|목표 위치(빨간 차[,노란 차])|최단 수|최단 풀이"  판 글자: '.' 빈칸 '#' 기둥 'A' 빨간 차 'B'~ 다른 차
   최단 풀이 = (차 글자 + 옮길 위치 숫자)를 이어 붙인 것. 예: "C0A4" = C차를 위치 0으로, A차를 위치 4로 */
const PARKING_BANK = ${JSON.stringify(bank, null, 0).replace(/\],"/g, '],\n"')};
if(typeof module !== 'undefined') module.exports = PARKING_BANK;
`;
  fs.writeFileSync(path.join(__dirname, 'parking-bank.js'), out);
  console.log('  파일', (out.length / 1024).toFixed(1) + 'KB');
}
function make(){
  const rng = mulberry(20261004), bank = {}, t0 = Date.now();
  /* node parking-maker.js 6p 7 … → 그 갈래만 다시 만들어 기존 목록에 덮어씀. PARK_OUT=파일 → 그 갈래만 JSON으로(여러 개를 나눠 돌릴 때) */
  const only = process.argv.slice(2).filter(c => CATS.includes(c));
  if(only.length && !process.env.PARK_OUT){ try{ Object.assign(bank, require('./parking-bank.js')); }catch(_){} }
  for(const cat of only.length ? only : CATS){
    const maxd = cat.includes('i') ? MAXD.i : MAXD.n, need = QUOTA(cat), box = {}, seen = new Set();
    const full = () => { for(let d = 4; d <= maxd; d++) if((box[d] || []).length < need) return false; return true; };
    let tries = 0;
    const tc = Date.now();
    while(!full() && tries < 60000 && Date.now() - tc < (cat === '6' ? 600000 : cat[0] === '7' ? 300000 : 170000)){
      tries++;
      const P0 = randomBoard(rng, cat); if(!P0) continue;
      /* 깊은 칸(어려운 문제)이 비었으면 세 번에 한 번은 언덕 오르기, 아니면 그냥 무작위 판 */
      let deep = false; for(let d = maxd - 8; d <= maxd; d++) if((box[d] || []).length < need) deep = true;
      const climbed = deep && tries % 3 === 0;
      const hc = climbed ? climb(rng, P0, cat) : { P:P0, R:distances(P0, P0.W === 7 ? 150000 : 60000) }; if(!hc || !hc.R) continue;
      const P = hc.P, R = hc.R;
      const byD = {};
      R.dist.forEach((d, j) => { if(d >= 4 && d <= maxd && (box[d] || []).length < need) (byD[d] = byD[d] || []).push(j); });
      let took = 0;
      /* 빈 칸(수)을 고르게: 언덕 오르기 판은 깊은 쪽에서, 아니면 아무 칸이나 무작위 순서로 */
      let ds = Object.keys(byD).map(Number);
      if(climbed){ const top = Math.max(...ds, 0); ds = ds.filter(d => d >= Math.min(top, maxd - 8)); }
      for(let a = ds.length - 1; a > 0; a--){ const b = Math.floor(rng() * (a + 1)); [ds[a], ds[b]] = [ds[b], ds[a]]; }
      for(const d of ds){
        if(took >= (climbed ? 4 : 2)) break;
        const L = byD[d], j = L[Math.floor(rng() * L.length)], pos = R.states[j];
        const s = PKS.encode(P, pos);
        if(seen.has(s)) continue;
        /* 판 모양: 빨간 차는 'A', 노란 차는 'B'로 다시 붙임(encode가 차 번호 순서로 글자를 붙인다) */
        const chk = PKS.solve(Object.assign({}, P, { goals:P.goals }), pos, 0);
        if(!chk || chk.n !== d) continue;
        seen.add(s); (box[d] = box[d] || []).push(s + '|' + P.goals.map(g => g[1]).join(',') + '|' + d + '|' + pathStr(chk.path)); took++;
      }
    }
    const list = []; for(let d = 4; d <= maxd; d++) (box[d] || []).forEach(x => list.push(x));
    bank[cat] = list;
    if(process.env.PARK_OUT) fs.writeFileSync(process.env.PARK_OUT, JSON.stringify(bank)); else write(bank);
    const miss = []; for(let d = 4; d <= maxd; d++) if((box[d] || []).length < need) miss.push(d + ':' + (box[d] || []).length);
    console.log(cat, '문제', list.length, '시도', tries, ((Date.now() - tc) / 1000).toFixed(1) + 's', miss.length ? '부족 ' + miss.join(' ') : '');
  }
  console.log('끝', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
make();
