// 함대 결전 솔로(난이도 v2 개념 사이클) 헤드리스 시뮬레이션.
// index.html의 AI·배치·규칙 함수(flAiPickK, flDensity, flRadarPick, flSilentResolve, flRandomFleet, flStageFx, flTune, cyclePlan …)를
// 그대로 잘라 와서, '괜찮은 사람' 봇(패리티 사냥 + 명중 주변 추적, 가끔 어설픈 선택)과 스테이지 AI를 붙인다.
// 사용:
//   node tools/fleet-sim.js rate [from] [to] [판수]      스테이지별 첫 도전 승률 · 이긴 판 발수 분포(30/70%) · 별 기준
//   node tools/fleet-sim.js q [q] [판수] [규칙…]         AI 세기 q를 고정해서 한 설정의 승률(튜닝용). 규칙: island radar salvo silent flash bare first fog tight=N airadar=N
// 봇 모델(사람 흉내): 사냥은 85% 체크무늬(패리티)·15% 아무 칸, 명중 뒤엔 줄을 잇되 10%는 아무 이웃, 섬·'배 없음' 표시는 피함.
//   레이더는 사냥 중 50% 확률로(3발 이후) 빈칸이 가장 많은 3×3에. 안개: 사라진 빗나감을 30% 확률로 잊어 다시 쏠 수 있음.
//   침묵: 양 끝이 막힌 명중 줄을 격침으로 본다(flSilentResolve, AI와 같음). 맨손: 격침 둘레 자동 표시가 없어 그 칸도 쏜다.
const fs = require('fs'), vm = require('vm'), path = require('path');

function load(file){
  const src = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const fn = name => {
    const a = src.search(new RegExp('^function ' + name + '\\(', 'm')); if(a < 0) throw new Error('no function ' + name);
    let i = src.indexOf('{', a), d = 0;
    for(; i < src.length; i++){ const ch = src[i]; if(ch === '{') d++; else if(ch === '}' && --d === 0) break; }
    return src.slice(a, i + 1);
  };
  const line = re => { const m = src.match(re); if(!m) throw new Error('no line ' + re); return m[0]; };
  const block = (start) => { const a = src.indexOf(start); if(a < 0) throw new Error('no ' + start); const b = src.indexOf('\n};', a); return src.slice(a, b + 3); };
  const code = [
    line(/^const FL_SHIPS = .*$/m), line(/^const FL_TOTAL = .*$/m), line(/^const FL_TH_BASE = .*$/m), line(/^const FL_Q = \[[\s\S]*?\];/m), line(/^const FL_QOFF = .*$/m),
    'const CONCEPTS = {};', block('CONCEPTS.fleet = {'),
    ...['seedFrom', 'mulberry', 'cyclePlan', 'flCells', 'flInBounds', 'flRandomFleet', 'flMapOf', 'flNb', 'flArea', 'flRocks', 'flDensity', 'flAiPickK', 'flAiLvl', 'flRadarPick', 'flSilentResolve', 'flStageFx', 'flTune', 'flTarget'].map(fn), 'let FL_PL = null;',
    "function planOf(id, n){ return cyclePlan(n, CONCEPTS.fleet.order, CONCEPTS.fleet.twists); }",
    'this.X = { FL_Q, FL_QOFF, flTarget, flStageFx, flRandomFleet, flMapOf, flAiPickK, flAiLvl, flRadarPick, flSilentResolve, flArea, flNb, mulberry, seedFrom, planOf, CONCEPTS, FL_SHIPS };'
  ].join('\n');
  const ctx = { Math, console, G:null };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  return ctx.X;
}
const X = load(process.env.HTML);

const par = i => (Math.floor(i / 10) + i % 10) % 2 === 0;
function humanPick(V, rnd, hot, fx){
  const pick = a => a[Math.floor(rnd() * a.length)];
  const unk = [], hits = [];
  for(let i = 0; i < 100; i++){ if(!V[i]) unk.push(i); else if(V[i] === 2) hits.push(i); }
  if(!unk.length) return -1;
  if(hits.length){
    const nb = [...new Set(hits.flatMap(X.flNb))].filter(j => !V[j]);
    if(nb.length && rnd() < .1) return pick(nb);
    const ext = new Set();
    for(const h of hits) for(const d of [1, 10]){
      const nx = h + d, okN = d === 1 ? h % 10 < 9 : h < 90;
      if(!okN || V[nx] !== 2) continue;
      let a = h; while((d === 1 ? a % 10 > 0 : a >= 10) && V[a - d] === 2) a -= d;
      let b = nx; while((d === 1 ? b % 10 < 9 : b < 90) && V[b + d] === 2) b += d;
      if((d === 1 ? a % 10 > 0 : a >= 10) && !V[a - d]) ext.add(a - d);
      if((d === 1 ? b % 10 < 9 : b < 90) && !V[b + d]) ext.add(b + d);
    }
    if(ext.size) return pick([...ext]);
    if(nb.length) return pick(nb);
  }
  let pool = unk;
  if(hot){ const hu = hot.filter(i => !V[i]); if(hu.length) pool = hu; }
  if(rnd() < (fx.flash ? .8 : .85)){ const p = pool.filter(par); if(p.length) pool = p; }
  return pick(pool);
}
function humanRadar(V, rnd){
  let mx = -1, best = [];
  for(let r = 1; r < 9; r++) for(let c = 1; c < 9; c++){ const i = r * 10 + c; const s = X.flArea(i).filter(j => !V[j]).length; if(s > mx){ mx = s; best = [i]; } else if(s === mx) best.push(i); }
  return best[Math.floor(rnd() * best.length)];
}

function play(fx, rnd){
  const rocks = fx.rocks || [];
  const mk = () => { const fleet = X.flRandomFleet(rnd, rocks); return { fleet, map:X.flMapOf(fleet), left:17 }; };
  const EN = mk(), MY = mk();   // EN = AI 함대(내가 쏨), MY = 내 함대(AI가 쏨)
  const P = { human:true, K:new Array(100).fill(0), sunk:[], radar:fx.radar, hot:null, shots:0, turnN:0, missAt:{}, forgot:new Set(), keep:new Set() };
  const A = { K:new Array(100).fill(0), sunk:[], radar:fx.aiRadar || 0, hot:null, shots:0, turn:0 };
  rocks.forEach(c => { P.K[c] = 4; A.K[c] = 4; });
  const shoot = (T, S, i, mark) => {   // T: 맞는 함대, S: 쏘는 쪽 지식
    const si = T.map[i];
    if(si < 0){ S.K[i] = 1; return 0; }
    const sh = T.fleet[si];
    if(S.K[i] === 2 || S.K[i] === 3) return 1;
    sh.hits++; T.left--; S.K[i] = 2;
    if(sh.hits >= sh.len){
      if(!fx.silent){
        const cs = []; for(let k = 0; k < sh.len; k++) cs.push((sh.y + (sh.v ? k : 0)) * 10 + sh.x + (sh.v ? 0 : k));
        cs.forEach(c => S.K[c] = 3); S.sunk.push(sh.len);
        if(mark) cs.forEach(c => X.flArea(c).forEach(j => { if(!S.K[j]) S.K[j] = 5; }));
        else if(S.human) cs.forEach(c => X.flArea(c).forEach(j => { if(!S.K[j] && rnd() < .5) S.K[j] = 5; }));   // 표시가 없으면 '붙지 않음'을 반쯤만 떠올림
      }
      return 2;
    }
    return 1;
  };
  const radarTruth = (T, c) => X.flArea(c).some(j => T.map[j] >= 0 && !T.hitCells.has(j));   // 아직 안 맞힌 적 배 칸이 있나
  const hitSet = new Set(), aiHitSet = new Set();
  EN.hitCells = hitSet; MY.hitCells = aiHitSet;
  const view = () => { const V = P.K.slice(); P.forgot.forEach(c => { if(V[c] === 1) V[c] = 0; }); return V; };
  const hasHits = K => K.some(v => v === 2);
  const pRadar = () => {
    if(P.radar > 0 && P.shots >= 3 && !hasHits(P.K) && rnd() < .5){
      P.radar--; const c = humanRadar(view(), rnd);
      if(radarTruth(EN, c)) P.hot = X.flArea(c); else X.flArea(c).forEach(j => { if(!P.K[j]) P.K[j] = 5; });
    }
  };
  const aRadar = () => {
    if(A.radar > 0 && A.turn >= 1 && !hasHits(A.K) && rnd() < .6){
      A.radar--; const c = X.flRadarPick(A.K, A.sunk, rnd);
      if(radarTruth(MY, c)) A.hot = X.flArea(c); else X.flArea(c).forEach(j => { if(!A.K[j]) A.K[j] = 5; });
    }
  };
  const pFire = i => {
    P.shots++;
    const again = P.K[i] === 1;   // 안개로 잊은 칸을 다시 쏨
    const r = shoot(EN, P, i, fx.mark);
    if(r) { hitSet.add(i); P.hot = null; }
    else { P.forgot.delete(i); if(again) P.keep.add(i); P.missAt[i] = P.turnN; }
    if(P.hot && !P.hot.some(j => !P.K[j])) P.hot = null;
    return r;
  };
  const aFire = i => {
    A.shots++; const r = shoot(MY, A, i, false);
    if(r){ aiHitSet.add(i); A.hot = null; }
    if(A.hot && !A.hot.some(j => !A.K[j])) A.hot = null;
    return r;
  };
  let cur = fx.first ? 'A' : 'P';
  for(let guard = 0; guard < 500; guard++){
    if(cur === 'P'){
      P.turnN++;
      if(fx.fog) for(const c in P.missAt){ if(P.turnN - P.missAt[c] >= 3 && P.K[c] === 1){ delete P.missAt[c]; if(!P.keep.has(+c) && rnd() < .3) P.forgot.add(+c); } }
      if(fx.silent) X.flSilentResolve(P.K, P.sunk);
      if(fx.salvo){
        pRadar();
        const V = view(), picks = [];
        let n = 3; if(fx.tight) n = Math.min(n, fx.tight - P.shots);
        for(let k = 0; k < n; k++){ const i = humanPick(V, rnd, P.hot, fx); if(i < 0) break; picks.push(i); V[i] = 6; }
        for(const i of picks){ pFire(i); if(EN.left <= 0) return { win:true, shots:P.shots }; }
        if(fx.tight && P.shots >= fx.tight) return { win:false, shots:P.shots, why:'ammo' };
      } else {
        for(;;){
          if(fx.silent) X.flSilentResolve(P.K, P.sunk);
          pRadar();
          const i = humanPick(view(), rnd, P.hot, fx); if(i < 0) return { win:false, shots:P.shots, why:'stuck' };
          const r = pFire(i);
          if(EN.left <= 0) return { win:true, shots:P.shots };
          if(fx.tight && P.shots >= fx.tight) return { win:false, shots:P.shots, why:'ammo' };
          if(!r) break;
        }
      }
      cur = 'A';
    } else {
      A.turn++;
      if(fx.salvo){
        if(fx.silent) X.flSilentResolve(A.K, A.sunk);
        aRadar();
        const K2 = A.K.slice(), picks = [];
        for(let k = 0; k < 3; k++){ const i = X.flAiPickK(K2, A.sunk, X.flAiLvl(fx.aiQ, rnd), rnd, A.hot); if(i < 0) break; picks.push(i); K2[i] = 6; }
        for(const i of picks){ aFire(i); if(MY.left <= 0) return { win:false, shots:P.shots, why:'sunk' }; }
      } else {
        for(;;){
          if(fx.silent) X.flSilentResolve(A.K, A.sunk);
          aRadar();
          const i = X.flAiPickK(A.K, A.sunk, X.flAiLvl(fx.aiQ, rnd), rnd, A.hot);
          const r = aFire(i);
          if(MY.left <= 0) return { win:false, shots:P.shots, why:'sunk' };
          if(!r) break;
        }
      }
      cur = 'P';
    }
  }
  return { win:false, shots:P.shots, why:'guard' };
}

const quant = (a, q) => a.length ? a[Math.min(a.length - 1, Math.max(0, Math.ceil(q * a.length) - 1))] : NaN;
function rate(fx, games, tag){
  const rnd = X.mulberry(X.seedFrom('sim:' + tag));
  let w = 0, s3 = 0, s2 = 0; const shots = [], why = {};
  for(let g = 0; g < games; g++){
    const r = play(fx, rnd);
    if(r.win){ w++; shots.push(r.shots); if(fx.th){ if(r.shots <= fx.th[1]) s3++; else if(r.shots <= fx.th[0]) s2++; } }
    else why[r.why] = (why[r.why] || 0) + 1;
  }
  shots.sort((a, b) => a - b);
  return { win:w / games, p30:quant(shots, .3), p35:quant(shots, .35), p50:quant(shots, .5), p70:quant(shots, .7), p85:quant(shots, .85), star3:w ? s3 / w : 0, star2:w ? s2 / w : 0, why };
}

const [mode = 'rate', a1, a2, a3, ...rest] = process.argv.slice(2);
if(mode === 'rate'){
  const from = +(a1 || 1), to = +(a2 || 70), games = +(a3 || 300);
  for(let n = from; n <= to; n++){
    const fx = X.flStageFx(n), r = rate(fx, games, 'st' + n);
    const tags = [...fx.mj, fx.tw ? '~' + fx.tw : ''].filter(Boolean).join('+') || '-';
    console.log([n, 'k' + fx.p.k, tags.padEnd(22), 'q=' + fx.aiQ.toFixed(2), 'aiR=' + fx.aiRadar, 'win=' + (r.win * 100).toFixed(0) + '%', 'shots p30/50/70=' + r.p30 + '/' + r.p50 + '/' + r.p70, 'th=' + fx.th.join('/') + (fx.tight ? ' ammo=' + fx.tight : ''), '★★★' + (r.star3 * 100).toFixed(0) + '%', JSON.stringify(r.why)].join('  '));
  }
} else if(mode === 'tune'){
  // 스테이지마다 목표 승률(flTarget)에 맞는 AI 세기 q를 이분 탐색(같은 씨앗으로 비교) → FL_Q 표
  const from = +(a1 || 1), to = +(a2 || 70), games = +(a3 || 400), out = [];
  for(let n = from; n <= to; n++){
    const fx0 = X.flStageFx(n), T = X.flTarget(fx0.p.c, fx0.p.k);
    const W = q => rate(Object.assign({}, fx0, { aiQ:q }), games, 'tune' + n).win;
    let lo = 0, hi = 2, wlo = W(0), whi = W(2), q;
    if(wlo <= T) q = 0; else if(whi >= T) q = 2;
    else { for(let it = 0; it < 8; it++){ const m = (lo + hi) / 2, wm = W(m); if(wm > T){ lo = m; wlo = wm; } else { hi = m; whi = wm; } } q = (lo + hi) / 2; }
    q = Math.round(q * 20) / 20; out.push(q);
    console.error(n, 'k' + fx0.p.k, [...fx0.mj, fx0.tw ? '~' + fx0.tw : ''].filter(Boolean).join('+'), 'T=' + T.toFixed(2), 'q=' + q, 'w(0)=' + wlo.toFixed(2), 'w(2)=' + whi.toFixed(2));
  }
  console.log(JSON.stringify(out));
} else if(mode === 'q'){
  const q = +(a1 || 1), games = +(a2 || 400), fx = { aiQ:q, aiRadar:0, rocks:[], radar:0, mark:true, th:[60, 45] };
  for(const t of [a3, ...rest].filter(Boolean)){
    const [k, v] = t.split('=');
    if(k === 'island') fx.rocks = X.flStageFx(12).rocks;
    else if(k === 'radar') fx.radar = 2;
    else if(k === 'airadar') fx.aiRadar = +(v || 2);
    else if(k === 'tight') fx.tight = +v;
    else if(k === 'bare'){ fx.bare = true; fx.mark = false; }
    else fx[k] = true;
    if(k === 'silent') fx.mark = false;
  }
  const r = rate(fx, games, 'q' + q + [a3, ...rest].join());
  console.log(JSON.stringify(Object.assign({ q }, r)));
}
