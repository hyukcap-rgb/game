// 카드 짝 맞추기(NG.memory) 솔로 난이도 시뮬레이터(헤드리스). index.html의 개념 사이클(planOf)과 NG.memory.stage(n)을 그대로 불러와
// 기억 용량이 제한된 봇으로 첫 도전 클리어율을 잰다.
// 사용:
//   node tools/memory-bot.js [판수=400] [from=1] [to=70] [--calib] [--file index.html]
//     --calib: 스테이지마다 목표 클리어율에 맞는 제한 시간(needScale)·외줄 타기 허용 실수(needCap)를 이분 탐색하고,
//              로그 선형 회귀로 NG.memory의 MT(A·alpha·alpha3·kTime·mjTime·twTime·tjTime) 추천값을 한 줄 JSON으로 낸다.
// 봇: 기억 용량 6±1.3(자리+그림 묶음, 3~9), 한 장 약 0.95초(개인차 로그정규), 미리 보기 1.3장/초로 외움,
//     뒤집을 때마다 기억 하나가 1.5% 확률로 흐려짐, 용량을 넘으면 오래된 것부터(60%) 잊음, 3% 확률로 옆 칸과 헷갈림,
//     닮은꼴은 15%(미리 보기 22%) 확률로 색·리본을 헷갈려 외움, 자리 바꿈은 50%(폭탄)/40%(섞기) 확률로만 따라감.
//     전략: 아는 짝(세 장)이 다 모이면 그걸 뒤집고, 아니면 모르는 카드 → 그 짝을 알면 짝, 모르면 조커(알면) → 또 모르는 카드.
// 목표(첫 도전): k=1·6·9 ≈90%, 보통 75~85%, k=5 ≈60%, 보스 ≈40%, 챕터마다 0.4~1%p씩 내려감(로얄 매치 톱니 벤치마크).
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const argv = process.argv.slice(2), flag = k => argv.includes(k), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const nums = argv.filter((a, i) => /^\d+$/.test(a) && argv[i - 1] !== '--file').map(Number);
const RUNS = nums[0] || 400, FROM = nums[1] || 1, TO = nums[2] || 70, CALIB = flag('--calib');

function loadStages(file){
  const src = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const cut = (startMark, endMark) => { const a = src.indexOf(startMark); if(a < 0) throw new Error('not found: ' + startMark); const e = src.indexOf(endMark, a); if(e < 0) throw new Error('not found: ' + endMark); return src.slice(a, e); };
  const cyc = cut('const TWISTS = {', '/* 스테이지 설명에 붙는 한 줄');
  const memSrc = cut('NG.memory = (() => {', '\n})();') + '\n})();';
  const lines = ['function seedFrom', 'function mulberry', 'function shuffle'].map(k => src.match(new RegExp('^' + k + '\\(.*$', 'm'))[0]);
  const ctx = { Math, console, G:null, store:{ get:(k, d) => d, set(){} }, document:{}, window:{}, mmss:s => s + 's' };
  vm.createContext(ctx);
  vm.runInContext(lines.join('\n') + '\nconst NG = {};\n' + cyc + '\n' + memSrc + '\nthis.NG = NG;', ctx);
  return n => ctx.NG.memory.stage(n);
}
const stageOf = loadStages(opt('--file'));
const cfgs = []; for(let n = 1; n <= Math.max(TO, 70); n++) cfgs.push(stageOf(n));
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const P = {
  K:[6, 1.3, 3, 9],       /* 기억 용량(자리+그림 묶음) 평균·표준편차·최소·최대 */
  spd:0.18,               /* 손 빠르기 개인차(로그정규) */
  flipBase:0.6, flipExp:0.35,   /* 한 장 뒤집는 데 드는 시간(초) = sp × (base + 지수분포 평균 exp) */
  encRate:1.3,            /* 미리 보기 동안 외우는 속도(장/초) */
  decay:0.015,            /* 뒤집을 때마다 기억 하나가 흐려질 확률 */
  evictOld:0.6,           /* 용량 초과 시 가장 오래된 기억을 잊을 확률(나머지는 무작위) */
  recallErr:0.03,         /* 기억한 자리를 옆 칸과 헷갈릴 확률 */
  twinConf:0.15, twinConfPv:0.22,   /* 닮은꼴 색·리본을 헷갈려 외울 확률(뒤집을 때/미리 보기 때) */
  bombNotice:0.8,         /* 미리 보기 때 폭탄 자리를 따로 외울 확률 */
  trackSwap:0.5, trackShuffle:0.4   /* 자리 바꿈을 눈으로 따라갈 확률(폭탄 1쌍 / 섞기 여러 쌍) */
};
function normal(R){ let u = 0, v = 0; while(!u) u = R(); v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function shuffle(a, R){ for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function runOnce(cfg, R, limitScale = 1, capAdd = 0){
  const g = cfg.g, sets = cfg.sets, tw = cfg.twins;
  const deck = [];
  for(let s = 0; s < sets; s++) for(let r = 0; r < g; r++) deck.push(s);
  for(let r = 0; r < cfg.bombs; r++) deck.push('B');
  for(let r = 0; r < cfg.jokers; r++) deck.push('J');
  shuffle(deck, R);
  const N = deck.length, cols = cfg.cols;
  const sib = s => typeof s === 'number' && s < 2 * tw ? s ^ 1 : -1;
  const st = new Array(N).fill(0), seen = new Set();
  const K = Math.max(P.K[2], Math.min(P.K[3], Math.round(P.K[0] + P.K[1] * normal(R))));
  const sp = Math.exp(P.spd * normal(R));
  const mem = new Map(); let clock = 0;
  const limit = cfg.limit * limitScale, cap = cfg.missCap ? cfg.missCap + capAdd : 0;
  const encode = (pos, conf) => {
    let b = deck[pos]; const s2 = sib(b); if(s2 >= 0 && R() < conf) b = s2;
    mem.delete(pos); mem.set(pos, { b, c:clock++ });
    while(mem.size > K){
      const keys = [...mem.keys()];
      const drop = R() < P.evictOld ? keys[0] : keys[Math.floor(R() * keys.length)];
      mem.delete(drop);
    }
  };
  /* 미리 보기 */
  if(cfg.preview > 0){
    let n = Math.min(K, Math.floor(cfg.preview * P.encRate * (0.8 + 0.4 * R())));
    const bombsPos = deck.map((c, i) => c === 'B' ? i : -1).filter(i => i >= 0);
    for(const b of bombsPos) if(n > 0 && R() < P.bombNotice){ encode(b, 0); n--; }
    const others = shuffle(deck.map((_, i) => i).filter(i => deck[i] !== 'B'), R);
    for(let q = 0; q < n && q < others.length; q++) encode(others[q], P.twinConfPv);
  }
  let t = 0, pen = 0, misses = 0, found = 0, flips = 0, sinceSwap = 0;
  const alive = i => st[i] === 0;
  const unknown = () => { const u = []; for(let i = 0; i < N; i++) if(alive(i) && !mem.has(i)) u.push(i); return u; };
  const pickUnknown = (open) => {
    let u = unknown().filter(i => !open.includes(i));
    if(!u.length) u = [...Array(N).keys()].filter(i => alive(i) && !open.includes(i) && !(mem.get(i) && mem.get(i).b === 'B'));
    if(!u.length) u = [...Array(N).keys()].filter(i => alive(i) && !open.includes(i));
    return u[Math.floor(R() * u.length)];
  };
  const recall = (pos, open) => {   /* 기억으로 뒤집기: 가끔 옆 칸과 헷갈림 */
    if(R() < P.recallErr){
      const r = Math.floor(pos / cols), c = pos % cols;
      const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && x >= 0 && x < cols && y * cols + x < N).map(([y, x]) => y * cols + x).filter(i => alive(i) && !open.includes(i));
      if(nb.length) return nb[Math.floor(R() * nb.length)];
    }
    return pos;
  };
  const known = (b, open) => [...mem.entries()].filter(([p, v]) => v.b === b && alive(p) && !open.includes(p)).map(([p]) => p);
  const swapPos = (x, y, track) => {
    [deck[x], deck[y]] = [deck[y], deck[x]];
    const a = mem.get(x), b = mem.get(y);
    if(track){ mem.delete(x); mem.delete(y); if(b) mem.set(x, b); if(a) mem.set(y, a); }
    else { mem.delete(x); mem.delete(y); }
  };
  const over = () => t + pen > limit || (cap && misses > cap);
  while(found < sets){
    /* 한 턴 */
    const open = [];
    let ended = false;
    while(!ended){
      /* 다음에 뒤집을 카드 고르기 */
      let pos;
      const nm = open.filter(i => deck[i] !== 'J'), hasJ = open.some(i => deck[i] === 'J');
      if(!open.length){
        const byId = new Map();
        for(const [p, v] of mem) if(typeof v.b === 'number' && alive(p)){ if(!byId.has(v.b)) byId.set(v.b, []); byId.get(v.b).push(p); }
        const full = [...byId.values()].find(a => a.length >= g);
        pos = full ? recall(full[0], open) : pickUnknown(open);
      } else if(hasJ && !nm.length){
        pos = pickUnknown(open);
      } else {
        const a = deck[nm[0]], kp = known(a, open), kj = known('J', open);
        pos = kp.length ? recall(kp[0], open) : kj.length ? recall(kj[0], open) : pickUnknown(open);
      }
      if(pos == null){ ended = true; break; }
      /* 뒤집기 */
      flips++; seen.add(pos);
      t += sp * (P.flipBase - P.flipExp * Math.log(1 - R() * 0.999));
      for(const k of [...mem.keys()]) if(R() < P.decay) mem.delete(k);
      const c = deck[pos];
      if(c === 'B'){
        st[pos] = 2; mem.delete(pos); pen += 8; t += 1.35;
        const down = [...Array(N).keys()].filter(alive);
        if(down.length >= 2){
          const sn = shuffle(down.filter(i => seen.has(i)), R), rs = shuffle(down.filter(i => !seen.has(i)), R), pool = sn.concat(rs);
          swapPos(pool[0], pool[1], R() < P.trackSwap);
        }
        ended = true; break;
      }
      open.push(pos); encode(pos, P.twinConf);
      const nm2 = open.filter(i => deck[i] !== 'J'), j2 = open.find(i => deck[i] === 'J');
      if(j2 != null && nm2.length){
        const key = deck[nm2[0]];
        for(let i = 0; i < N; i++) if(alive(i) && deck[i] === key){ st[i] = 2; mem.delete(i); }
        st[j2] = 2; mem.delete(j2); found++; sinceSwap++; t += 0.29; ended = true; break;
      }
      if(!nm2.length) continue;
      if(!nm2.every(i => deck[i] === deck[nm2[0]])){ misses++; pen += cfg.tick || 0; t += 0.75; ended = true; break; }
      if(nm2.length >= g){ nm2.forEach(i => { st[i] = 2; mem.delete(i); }); found++; sinceSwap++; t += 0.29; ended = true; break; }
    }
    if(found >= sets) break;
    if(over()) return { win:false, t, misses, flips };
    if(cfg.shuffle && sinceSwap >= 3){
      sinceSwap = 0; t += 1.06;
      const down = shuffle([...Array(N).keys()].filter(alive), R);
      if(down.length >= 4){ const ns = Math.min(3, Math.floor(down.length / 2)); for(let k = 0; k < ns; k++) swapPos(down[2 * k], down[2 * k + 1], R() < P.trackShuffle); }
    }
  }
  return { win:!over(), t:t + pen, misses, flips };
}

function rate(cfg, runs, seed, ls = 1, ca = 0){
  const R = mulberry(seed); let w = 0, tt = 0, mm = 0;
  for(let r = 0; r < runs; r++){ const o = runOnce(cfg, R, ls, ca); w += o.win ? 1 : 0; tt += o.t; mm += o.misses; }
  return { p:w / runs, t:tt / runs, m:mm / runs };
}
function target(n){
  const c = Math.ceil(n / 10), k = n - (c - 1) * 10, d = Math.min(c, 7) - 1;
  const base = { 1:.92, 2:.85, 3:.83, 4:.80, 5:.62, 6:.90, 7:.82, 8:.79, 9:.90, 10:.45 }[k];
  if(k === 1 || k === 6 || k === 9) return base - 0.004 * d;
  return base - (k === 10 ? 0.01 : 0.008) * d;
}

const NAME = { triple:'세 장 짝', bomb:'폭탄', joker:'조커', twins:'닮은꼴', flash:'번개', tight:'외줄 타기', shuffle:'카드 섞기', bare:'맨손', tick:'째깍 벌칙' };
const rows = [], calib = [];
for(let n = FROM; n <= TO; n++){
  const cfg = cfgs[n - 1], r = rate(cfg, RUNS, 1234 + n), tg = target(n);
  let extra = '';
  if(CALIB){
    let lo = 0.3, hi = 3;
    for(let it = 0; it < 14; it++){ const mid = (lo + hi) / 2; const q = rate(cfg, RUNS, 99 + n, mid).p; if(q < tg) lo = mid; else hi = mid; }
    extra = ' needScale=' + ((lo + hi) / 2).toFixed(2);
    const out = { n, need:cfg.limit * (lo + hi) / 2, cards:cfg.sets * cfg.g, k:n - (Math.ceil(n / 10) - 1) * 10, mj:cfg.mj, tw:cfg.tw, g:cfg.g, sets:cfg.sets, bombs:cfg.bombs };
    if(cfg.missCap){ /* 외줄 타기: 시간은 넉넉히(×2) 두고 필요한 허용 실수 찾기 */
      let a = -20, b = 40;
      while(b - a > 1){ const mid = Math.floor((a + b) / 2); const q = rate(cfg, RUNS, 77 + n, 2, mid).p; if(q < tg) a = mid; else b = mid; }
      out.needCap = cfg.missCap + b; extra += ' needCap=' + out.needCap;
    }
    calib.push(out);
  }
  rows.push({ n, p:r.p, tg });
  const k = n - (Math.ceil(n / 10) - 1) * 10, rule = cfg.mj.map(x => NAME[x]).concat(cfg.tw ? ['/' + NAME[cfg.tw]] : []).join('+') || '기본';
  console.log(String(n).padStart(3), 'k' + String(k).padEnd(2), String(Math.round(r.p * 100)).padStart(3) + '%', '목표 ' + Math.round(tg * 100) + '%', `평균 ${r.t.toFixed(1)}/${cfg.limit}초 실수 ${r.m.toFixed(1)}${cfg.missCap ? '/' + cfg.missCap : ''}`, `${cfg.cols}x${cfg.rows} ${cfg.sets}${cfg.g === 3 ? '세트' : '쌍'}${cfg.bombs ? ' 폭탄' + cfg.bombs : ''}${cfg.jokers ? ' 조커' : ''}${cfg.twins ? ' 닮은꼴' + cfg.twins : ''} 미리보기${cfg.preview}초`, rule + extra);
}
console.log('평균 |오차| =', (rows.reduce((a, r) => a + Math.abs(r.p - r.tg), 0) / rows.length * 100).toFixed(1) + '%p');
if(CALIB) fit(calib);

/* 로그 선형 회귀: log(필요 시간) = alpha·log(카드) + alpha3·[세 장]·log(카드) + kTime[k] + mjTime(폭탄은 개수) + twTime + tj(세 장+조커) */
function fit(C){
  const MJ = ['triple', 'bomb', 'joker', 'twins'], TW = ['flash', 'shuffle', 'bare', 'tick'];
  const feats = r => { const f = [Math.log(r.cards), r.g === 3 ? Math.log(r.cards) : 0];
    for(let k = 1; k <= 10; k++) f.push(r.k === k ? 1 : 0);
    MJ.forEach(m => f.push(m === 'bomb' ? r.bombs || 0 : r.mj.includes(m) ? 1 : 0)); TW.forEach(t => f.push(r.tw === t ? 1 : 0));
    f.push(r.mj.includes('triple') && r.mj.includes('joker') ? 1 : 0); return f; };
  const rs = C.filter(r => r.tw !== 'tight'); if(rs.length < 25){ console.log('(회귀는 스테이지가 25개 이상일 때만)'); return; }
  const X = rs.map(feats), y = rs.map(r => Math.log(r.need)), p = X[0].length;
  const A = Array.from({ length:p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
  X.forEach((x, i) => { for(let a = 0; a < p; a++){ b[a] += x[a] * y[i]; for(let c = 0; c < p; c++) A[a][c] += x[a] * x[c]; } });
  for(let a = 2; a < p; a++) A[a][a] += 0.02;
  const M = A.map((r, i) => r.concat([b[i]]));
  for(let i = 0; i < p; i++){ let mx = i; for(let r = i + 1; r < p; r++) if(Math.abs(M[r][i]) > Math.abs(M[mx][i])) mx = r; [M[i], M[mx]] = [M[mx], M[i]];
    for(let r = 0; r < p; r++) if(r !== i){ const f = M[r][i] / M[i][i]; for(let c = i; c <= p; c++) M[r][c] -= f * M[i][c]; } }
  const w = M.map((r, i) => r[p] / r[i]), kw = w.slice(2, 12), km = kw.reduce((a, v) => a + v, 0) / 10;
  console.log('MT 추천:', JSON.stringify({ A:+Math.exp(km).toFixed(3), alpha:+w[0].toFixed(3), alpha3:+w[1].toFixed(3), kTime:[0].concat(kw.map(v => +Math.exp(v - km).toFixed(2))),
    mjTime:Object.fromEntries(MJ.map((m, i) => [m, +Math.exp(w[12 + i]).toFixed(2)])), twTime:Object.fromEntries(TW.map((t, i) => [t, +Math.exp(w[16 + i]).toFixed(2)])), tjTime:+Math.exp(w[20]).toFixed(2) }));
}
