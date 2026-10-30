// 트럼프 고스톱 골드(G) 점검: 진짜 규칙·AI로 판을 두고, tgostop.js의 settle()·fpCheck() 식을 그대로 옮겨 골드가 맞게 오가는지 본다.
//   node tools/tgostop-gold-sim.js [판 수=4000]
//  1) 판마다 불변식: 보유 < 0 없음 · 컴퓨터 판 첫뻑+정산 ≤ ±상한 · 실시간 대전 두 기기 합 = 0 · 연습 판 ±0
//  2) 방별 골드 흐름(사람 대신 'normal' AI): 첫뻑 + 판 정산 합이 한 판 ±상한 안인지(2026-10-31부터 첫뻑도 상한 안)
//  3) 솔로 [한 판 더] 반복: 첫 클리어 보상이 매번 다시 나오는지(연습 판 포함)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { NG:{}, console, Math, JSON, Object, Array, Set, String, Number, Promise, setTimeout, clearTimeout };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core/util.js'), 'utf8').replace(/^const \$ = .*$/m, '').replace(/^function toast[\s\S]*?\n/m, ''), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games/tgostop/tgostop-art.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games/tgostop/tgostop.js'), 'utf8'), ctx);
const R = vm.runInContext('NG.tgostop._rules', ctx);
const mulberry = vm.runInContext('mulberry', ctx), seedFrom = vm.runInContext('seedFrom', ctx);
const N = +process.argv[2] || 4000;

/* tgostop.js와 같은 값 */
const ROOMS = [{ k:0, stake:0, min:0 }, { k:1, stake:100, min:2000 }, { k:2, stake:500, min:10000 }, { k:3, stake:1000, min:30000 }, { k:4, stake:5000, min:150000 }];
const FEE = 0, feeOf = n => Math.round(Math.max(0, n) * FEE), FP_X = 5;
const capOf = (room, mode) => room.stake && mode !== 'pvp' ? room.min : 0;

/* 한 판: me = 사람 자리(S 번호). fp 지불은 수마다(fpCheck), 끝나면 settle */
function playGame(seed, lv, me, room, mode, w, opp){
  const S = R.gsDeal(seed), rnd = mulberry(seedFrom(seed + ':t'));
  const fpPaid = [0, 0]; let fpd = 0, oppFp = 0, guard = 0;
  const fp = () => { for(const i of [0, 1]) while((S.P[i].fp || 0) > fpPaid[i]){
    const lvl = ++fpPaid[i], amt = room.stake * FP_X * lvl, mine = i === me; if(!amt) continue;
    const cap = capOf(room, mode);
    const gross = mine ? Math.min(amt, mode === 'pvp' ? opp.pt : cap ? Math.max(0, cap - fpd) : Infinity) : Math.min(amt, w.pt, cap ? Math.max(0, cap + fpd) : Infinity);
    const d = mine ? gross - feeOf(gross) : -gross;
    w.pt += d; fpd += d;
    if(mode === 'pvp'){ const od = mine ? -gross : gross - feeOf(gross); opp.pt = Math.max(0, opp.pt + od); oppFp += od; }
  } };
  while(!S.over){
    if(++guard > 200) throw new Error('끝나지 않음');
    const p = S.turn, act = R.aiPick(S, p, lv[p], rnd);
    R.gsApply(S, p, act); fp();
    if(S.pendingGS === p) R.gsGoStop(S, p, R.aiGo(S, p, lv[p], rnd));
  }
  /* settle() 그대로 */
  const r = S.result, win = r.w === me, lose = r.w >= 0 && !win, cap = capOf(room, mode);
  let d = 0, raw = 0, opD = 0; const roomW = cap ? Math.max(0, cap - fpd) : Infinity, roomL = cap ? Math.max(0, cap + fpd) : Infinity;
  if(room.stake && (win || lose)) raw = Math.round(r.final * room.stake);
  if(room.stake && win){ const gross = Math.min(raw, mode === 'pvp' ? opp.pt : roomW); d = gross - feeOf(gross); opD = -gross; }
  else if(room.stake && lose){ const loss = Math.min(raw, roomL, w.pt); d = -loss; opD = loss - feeOf(loss); }
  w.pt += d; if(mode === 'pvp') opp.pt = Math.max(0, opp.pt + opD);   /* endGame: g.oppPt += pay.opp */
  return { S, r, d, fpd, raw, cap, opD, oppFp };
}

const errs = []; const bad = (m) => { errs.push(m); };
/* ---- 1·2: 방별 ---- */
const LV = ['easy', 'normal', 'hard'];
const out = [];
for(const [rk, lvAi] of [[1, 'easy'], [2, 'normal'], [3, 'hard']]){
  const room = ROOMS[rk]; let sum = 0, maxLoss = 0, maxLossFp = 0, overLabel = 0, wins = 0, fpLossGames = 0, cap3 = 0;
  for(let i = 0; i < N; i++){
    const me = i % 2, lv = me === 0 ? ['normal', lvAi] : [lvAi, 'normal'];
    const w = { pt:room.min * 3 };   /* 넉넉히 가진 사람(뻑 손실이 상한 밖으로 나가는지 보려고) */
    const g = playGame('gold:' + rk + ':' + i, lv, me, room, 'ai', w, null);
    const tot = g.d + g.fpd;
    if(w.pt < 0) bad(`방${rk} 판${i}: 보유 음수 ${w.pt}`);
    if(g.r.why === '3연뻑' && g.r.w === me) cap3++;
    if(g.r.w === me) wins++;
    if(Math.abs(tot) > room.min){ overLabel++; bad(`방${rk} 판${i}: 첫뻑 포함 ${tot} G — 상한 ±${room.min} 넘음`); }
    if(g.fpd < 0) fpLossGames++;
    sum += tot; maxLoss = Math.min(maxLoss, g.d); maxLossFp = Math.min(maxLossFp, tot);
  }
  out.push(`방 점당 ${room.stake} G(입장·상한 ${room.min} G, 컴퓨터 ${lvAi}): 승률 ${(wins / N * 100).toFixed(1)}% · 판당 평균 ${Math.round(sum / N)} G · 판 정산만 최대 손실 ${-maxLoss} G · 첫뻑 포함 최대 손실 ${-maxLossFp} G · ±${room.min} 넘게 오간 판 ${overLabel}(${(overLabel / N * 100).toFixed(2)}%) · 첫뻑으로 잃은 판 ${fpLossGames}`);
}

/* ---- 실시간 대전: 두 기기 따로 계산해도 합 = 0(골드가 생기거나 사라지지 않음) ---- */
let pvpLeak = 0, pvpLeakSum = 0, pvpN = 0;
for(const rk of [1, 2, 3]){
  const room = ROOMS[rk];
  for(let i = 0; i < N / 2; i++){
    const a0 = room.min + (i * 137) % (room.min * 3), b0 = room.min + (i * 71) % (room.min * 2);
    /* 기기 A(자리 0)와 기기 B(자리 1)가 같은 씨앗·같은 수로 각자 정산 */
    const A = { pt:a0 }, Aopp = { pt:b0 }, B = { pt:b0 }, Bopp = { pt:a0 };
    const ga = playGame('pvp:' + rk + ':' + i, ['normal', 'normal'], 0, room, 'pvp', A, Aopp);
    const gb = playGame('pvp:' + rk + ':' + i, ['normal', 'normal'], 1, room, 'pvp', B, Bopp);
    pvpN++;
    const leak = (A.pt - a0) + (B.pt - b0);
    if(leak !== 0){ pvpLeak++; pvpLeakSum += leak; if(pvpLeak < 4) bad(`대전 방${rk} 판${i}: A ${A.pt - a0} + B ${B.pt - b0} = ${leak}(골드가 생기거나 사라짐)`); }
    if(A.pt !== Bopp.pt || B.pt !== Aopp.pt) bad(`대전 방${rk} 판${i}: 두 기기가 보는 상대 골드가 다름 A ${A.pt}/${Bopp.pt} B ${B.pt}/${Aopp.pt}`);
  }
}

/* ---- 3: 솔로 [한 판 더] 반복 — 별(stars)은 HOST.finish(결과 보기)에서만 저장 → 그 전까지 이길 때마다 첫 클리어 보상 ---- */
const farm = [];
for(const [adv, rk] of [[10, 0], [50, 0], [50, 1]]){
  const room = ROOMS[rk], w = { pt:rk ? 10000 : 0 }, start = w.pt; let stars = false, bonus = 0, item = 0, games = 0, winsN = 0;
  for(let i = 0; i < 100; i++){
    games++;
    const g = playGame('farm:' + adv + ':' + rk + ':' + i, ['easy', 'easy'], i % 2, room, 'ai', w, null);
    if(g.r.w === i % 2){ winsN++; if(!stars){ stars = true; const b = 500 * Math.ceil(adv / 10); w.pt += b; bonus += b; if(adv % 10 === 0) item++; } }
    /* 별은 [결과 보기] 때 저장되지만, 같은 스테이지 안에서는 G.advPaid로 한 번만 줌(2026-10-31 고침) */
  }
  farm.push(`스테이지 ${adv} ${rk ? '점당 100 G' : '연습 판'} [한 판 더] 100판: ${winsN}승 · 첫 클리어 보상 ${bonus ? Math.round(bonus / (500 * Math.ceil(adv / 10))) : 0}번 = +${bonus} G · 충전권 +${item}장(최대 5장까지) · 보유 ${start} → ${w.pt} G`);
}

console.log(`골드 점검 ${N}판 × 방 3개 + 대전 ${pvpN}판`);
out.forEach(x => console.log(' ' + x));
console.log(` 실시간 대전 골드 합 ≠ 0인 판: ${pvpLeak}/${pvpN}${pvpLeak ? ' (합계 ' + pvpLeakSum + ' G)' : ''}`);
farm.forEach(x => console.log(' ' + x));
console.log(errs.length ? '✗ 불변식 오류 ' + errs.length + '건\n  ' + errs.slice(0, 8).join('\n  ') : '✓ 불변식 오류 0건');
