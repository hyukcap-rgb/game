// 동물 삼총사 난이도 자동 튜닝(헤드리스). index.html의 NG.match 엔진을 그대로 불러와 자동 플레이어로 돌린다.
// 사용:
//   node tools/match-tune.js tune [from] [to] [index.html]       솔로 MT_D 표 다시 맞추기(스테이지 from~to) → JSON 한 줄씩
//   node tools/match-tune.js winrate [from] [to] [index.html] [판수]  지금 MT_D로 스테이지별 승률(튜닝과 다른 씨앗)
//   node tools/match-tune.js daily [index.html] [판수]             오늘의 문제: 요일 장애물별 이동 20번 그리디 점수 분포 → BOT 평균·난이도별 성공률
//   node tools/match-tune.js check [from] [to] [index.html]       판 만들기 점검: 시작 판에 맞는 줄 없음·움직일 곳 있음·장애물 개수가 목표와 같음
// 방법(14_난이도_벤치마크.md 3절): 흔들리는 자동 플레이어(좋은 수 1~3위를 60/25/15%)로 판마다 24번 플레이하고,
// 목표 승률(q) 분위수의 이동 수가 설계 이동 수와 같아지게 목표 양 배율 D를 이분 탐색한다(0.3~4.99).
// 0.3에서도 이동이 모자라면 [0.3, 이동](최대 40)으로 이동 수를 따로 늘리고, 4.99에서도 남으면 [4.99, 이동]으로 줄인다.
const vm = require('vm');

function load(file){
  const src = require('./source').readSource(file);
  const cut = (startMark, endRe) => { const a = src.indexOf(startMark); if(a < 0) throw new Error('not found: ' + startMark); const rest = src.slice(a); const m = rest.match(endRe); return rest.slice(0, m.index + m[0].length); };
  const toy = cut('const TOY = (() => {', /\n\}\)\(\);/);
  const match = cut('NG.match = (() => {', /\n\}\)\(\);/);
  const seed = src.match(/^function seedFrom\(.*$/m)[0];
  const ctx = { Math, Date, console, NG:{}, G:null, store:{ get:(k, d) => d, set(){} }, encodeURIComponent, document:{}, window:{} };
  vm.createContext(ctx);
  vm.runInContext(seed + '\n' + toy + '\n' + match + '\nthis.TOY = TOY;', ctx);
  return ctx.NG.match._eng;
}
const mb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function hs(str){ let h = 2166136261; for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const PLAYS = +(process.env.PLAYS || 24);   // 판마다 플레이 수(기본 24)
function runs(eng, n, D, tag, plays, cap){
  const cfg = eng.stagePlan(n, D), out = [];
  for(let j = 0; j < plays; j++) out.push(eng.botMoves(mb(hs(tag + ':' + n + ':' + j)), cfg, mb(hs('noise:' + tag + ':' + n + ':' + j)), cap || 60));
  return out.sort((a, b) => a - b);
}
const quant = (arr, q) => arr[Math.max(0, Math.ceil(q * arr.length) - 1)];

function tuneStage(eng, n){
  const p = eng.stagePlan(n, 1), Mv = Math.min(30, 16 + Math.floor(n / 4)), q = p.q;
  const Q = D => quant(runs(eng, n, D, 'mtune', PLAYS, 60), q);
  let lo = 0.3, qlo = Q(lo);
  if(qlo > Mv) return { n, D:[0.3, Math.min(40, qlo)], q, Mv, qm:qlo };
  let hi = 4.99, qhi = Q(hi);
  if(qhi <= Mv) return { n, D:[4.99, Math.max(8, qhi)], q, Mv, qm:qhi };   // 가장 많이 놓아도 쉬우면 이동 수를 줄인다
  for(let it = 0; it < 7; it++){
    const mid = (lo + hi) / 2, qm = Q(mid);
    if(qm <= Mv){ lo = mid; qlo = qm; } else { hi = mid; qhi = qm; }
  }
  return { n, D:Math.round(lo * 100) / 100, q, Mv, qm:qlo };
}
function rateStage(eng, n, plays){
  const c = eng.stageCfg(n), r = runs(eng, n, undefined, 'meval', plays, c.moves + 1);
  // stagePlan(n) without D0 uses MT_D and its move override
  const wins = r.filter(x => x <= c.moves).length;
  return { n, win:wins / plays, q:c.q, moves:c.moves, goals:c.goals.map(g => g.t + (g.t === 'k' ? g.k : '') + ':' + g.n).join(' ') };
}
function checkStage(eng, n){
  const c = eng.stageCfg(n), bad = [];
  for(let j = 0; j < 8; j++){
    const E = eng.makeStage(mb(hs('adv:match:' + n + ':' + j)), c);
    if(eng.findGroups(E.b).length) bad.push('시작부터 맞는 줄');
    if(!eng.hasMove(E)) bad.push('움직일 곳 없음');
    const cnt = { box:0, log:0, shell:0, acorn:0, balloon:0, lock:0, ice:0, honey:0 };
    E.b.forEach(t => { if(!t) return; if(t.s === 6) cnt.box++; if(t.s === 9) cnt.log++; if(t.s === 10) cnt.shell++; if(t.s === 11) cnt.acorn++; if(t.bl) cnt.balloon++; if(t.lk) cnt.lock++; });
    E.ice.forEach(v => { if(v) cnt.ice++; }); E.honey.forEach(v => { if(v) cnt.honey++; });
    c.goals.forEach(g => { if(g.t !== 'k' && cnt[g.t] !== g.n) bad.push(`${g.t} ${cnt[g.t]}/${g.n}`); });
  }
  return { n, ok:!bad.length, types:c.goals.filter(g => g.t !== 'k').map(g => g.t).join('+') || '-', bad:[...new Set(bad)] };
}

const [mode = 'winrate', a1, a2, a3, a4] = process.argv.slice(2);
if(mode === 'tune' || mode === 'winrate' || mode === 'check'){
  const from = +(a1 || 1), to = +(a2 || 100), eng = load(a3), plays = +(a4 || 40);
  for(let n = from; n <= to; n++){
    const t0 = Date.now();
    const r = mode === 'tune' ? tuneStage(eng, n) : mode === 'check' ? checkStage(eng, n) : rateStage(eng, n, plays);
    r.ms = Date.now() - t0;
    console.log(JSON.stringify(r));
  }
} else if(mode === 'daily'){
  const eng = load(a1), games = +(a2 || 150), res = {}, OBS = ['', 'ice', 'box', 'log', 'lock', 'honey'];
  for(const K of [5, 6]) for(const ob of OBS){
    const pts = [];
    for(let j = 0; j < games; j++) pts.push(eng.botRun(mb(hs('mday:' + K + ':' + ob + ':' + j)), K, 20, ob).pts);
    pts.sort((x, y) => x - y);
    const mean = Math.round(pts.reduce((s, x) => s + x, 0) / games);
    const at = p => pts[Math.floor((1 - p) * games)];   // 성공률 p가 되는 점수
    res[K + ':' + (ob || '-')] = { mean, f90:+(at(.9) / mean).toFixed(3), f75:+(at(.75) / mean).toFixed(3), f55:+(at(.55) / mean).toFixed(3) };
  }
  // 지금 코드의 목표로 실제 성공률(요일 장애물마다)
  const chk = {};
  for(const lv of ['easy', 'normal', 'hard']) for(const ob of OBS){
    const c = eng.levelCfg(lv, ob); let ok = 0;
    for(let j = 0; j < games; j++) if(eng.botRun(mb(hs('mdaychk:' + lv + ':' + ob + ':' + j)), c.kinds, 20, ob).pts >= c.target) ok++;
    chk[lv + ':' + (ob || '-')] = { target:c.target, success:ok / games };
  }
  console.log(JSON.stringify({ dist:res, check:chk }, null, 1));
}
