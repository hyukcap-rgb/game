// 블록 채우기 솔로 난이도 자동 튜닝(헤드리스). index.html의 NG.block 엔진·개념 사이클(planOf)을 그대로 불러와 자동 플레이어로 돌린다.
// 사용:
//   node tools/block-tune.js tune [from] [to] [index.html]          BK_T 표 다시 맞추기 → 판마다 JSON 한 줄 {n, y, par, rate, want}
//   node tools/block-tune.js refine [from] [to] [index.html]        지금 BK_T 값을 150판으로 다시 재고 어긋난 판만 y를 조금씩 옮김
//   node tools/block-tune.js apply a.jsonl b.jsonl …               JSON 줄 결과를 index.html의 BK_T 표에 씀
//   node tools/block-tune.js winrate [from] [to] [index.html] [판수]  지금 BK_T로 첫 판 클리어율(튜닝과 다른 흔들림 씨앗)
// 방법: 자동 플레이어 = 한 수 평가(줄·보석·얼음·폭탄 급한 정도·판 모양) + 흔들림(좋은 수 1~3위를 60/25/15%).
//   조각 순서는 게임과 같은 스테이지 씨앗(adv:block:n)을 쓰고, 흔들림 씨앗만 바꿔 PLAYS번 플레이한다.
//   목표 클리어율(want)에 맞게 난이도 한 값 y를 이분 탐색(-2.5 ~ 2.6, 같은 흔들림 씨앗으로 비교해 잡음 줄임).
//   기준 조각 수(par) = 이긴 판들의 조각 수 30% 분위수.
const fs = require('fs'), vm = require('vm'), path = require('path');

function load(file){
  const src = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const cut = (startMark, endRe) => { const a = src.indexOf(startMark); if(a < 0) throw new Error('not found: ' + startMark); const rest = src.slice(a); const m = rest.match(endRe); return rest.slice(0, m.index + m[0].length); };
  const seed = src.match(/^function seedFrom\(.*$/m)[0] + '\n' + src.match(/^function mulberry\(.*$/m)[0];
  const cyc = cut('const TWISTS = {', /\nfunction conceptInfo[\s\S]*?\n\}\n/);
  const block = cut('NG.block = (function(){', /\n\}\)\(\);/);
  const ctx = { Math, console, NG:{}, G:null, store:{ get:(k, d) => d, set(){} }, document:{}, window:{} };
  vm.createContext(ctx);
  vm.runInContext(seed + '\n' + cyc + '\n' + block + '\nthis.planOf = planOf;', ctx);
  return { B:ctx.NG.block, E:ctx.NG.block._E, planOf:ctx.planOf, mulberry:ctx.mulberry, seedFrom:ctx.seedFrom };
}
const mb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function hs(str){ let h = 2166136261; for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* 목표 첫 판 클리어율: 쉬움(1·6·9) 90% · 익히기(2·3) 84% · 섞기·변주(4·7·8) 78% · 어려움(5) 60% · 보스(10) 40%, 챕터마다 조금씩 낮춤 */
function want(p){
  const c = Math.min(10, p.c) - 1, k = p.k;
  if(k === 1 || k === 6 || k === 9) return .92 - .005 * c;
  if(k === 2 || k === 3) return .85 - .01 * c;
  if(k === 5) return .62 - .008 * c;
  if(k === 10) return .42 - .006 * c;
  return .80 - .01 * c;
}
/* 자동 플레이어가 못 느끼는 변주(미리보기 없음)는 사람에게만 어려우므로 목표를 5%p 높여 둠 */
const wantAdj = p => want(p) + (p.tw === 'nopeek' ? .05 : 0);
/* 쉬운 판·첫 챕터는 조각이 너무 험해지지 않게 y 위쪽을 막음(목표보다 쉬우면 그대로 둠) */
const hiCap = p => (p.k === 1 || p.k === 6 || p.k === 9) ? Math.min(2.6, .4 + .1 * (p.c - 1)) : p.c === 1 && !p.boss ? (p.hard ? 2.4 : 1) : 2.6;
const PLAYS = +(process.env.PLAYS || 60);
function runs(M, n, y, tag, plays){
  const cfg = M.B._stageCfg(n, y), out = [];
  for(let j = 0; j < plays; j++){
    const r = M.E.botRun(cfg, M.mulberry(M.seedFrom('adv:block:' + n)), mb(hs(tag + ':' + n + ':' + j)));
    out.push({ win:r.win, used:r.used, boom:!!r.boom });
  }
  return out;
}
const rateOf = rs => rs.filter(r => r.win).length / rs.length;
function parOf(rs){ const u = rs.filter(r => r.win).map(r => r.used).sort((a, b) => a - b); return u.length ? u[Math.max(0, Math.ceil(.3 * u.length) - 1)] : 0; }

function tuneStage(M, n){
  const p = M.planOf('block', n), w = wantAdj(p), R = y => rateOf(runs(M, n, y, 'btune', PLAYS));
  let lo = -2.5, hi = hiCap(p), rlo = R(lo), rhi;
  if(rlo < w){ const y = lo; return finish(M, n, y, w, rlo, 'min'); }
  rhi = R(hi);
  if(rhi >= w) return finish(M, n, hi, w, rhi, 'max');
  for(let it = 0; it < 7; it++){ const mid = (lo + hi) / 2, rm = R(mid); if(rm >= w){ lo = mid; rlo = rm; } else { hi = mid; rhi = rm; } }
  /* 목표에 더 가까운 쪽 */
  const y = Math.abs(rlo - w) <= Math.abs(rhi - w) ? lo : hi;
  return finish(M, n, y, w, null, '');
}
function finish(M, n, y, w, r0, flag){
  y = Math.round(y * 100) / 100;
  const rs = runs(M, n, y, 'bpar', 100);
  return { n, y, par:parOf(rs), rate:rateOf(rs), want:Math.round(w * 100) / 100, flag };
}
function rateStage(M, n, plays){
  const p = M.planOf('block', n), cfg = M.B._stageCfg(n), rs = runs(M, n, undefined, 'beval', plays);
  return { n, k:p.k, rate:rateOf(rs), want:Math.round(wantAdj(p) * 100) / 100, booms:rs.filter(r => r.boom).length / plays, par:cfg.par, med:(rs.filter(r => r.win).map(r => r.used).sort((a, b) => a - b)[Math.floor(rs.filter(r => r.win).length / 2)] || 0),
    mj:p.mj.join('+'), tw:p.tw || '', d:cfg.d, goal:[cfg.target && cfg.target + 'L', cfg.ice && cfg.ice + 'I', cfg.gem && cfg.gem + 'G'].filter(Boolean).join(' '), bomb:cfg.bomb ? cfg.bomb.n + 'x' + cfg.bomb.t : '', stones:cfg.stones };
}

/* 다듬기: 지금 표의 y에서 150판으로 다시 재고, 목표와 6%p 넘게 차이 나면 y를 STEP(기본 0.12)씩 옮겨 가장 가까운 값 */
const STEP = +(process.env.STEP || .12);
function refineStage(M, n){
  const p = M.planOf('block', n), w = wantAdj(p), t = M.B._BK_T[n];
  let y = t ? t[0] : 0; const P = 150;
  const ev = y => { const rs = runs(M, n, y, 'bref', P); return { y, rs, r:rateOf(rs) }; };
  let best = ev(y), cur = best;
  if(Math.abs(best.r - w) > .06){
    const dir = best.r > w ? 1 : -1;
    for(let i = 0; i < 8; i++){
      const ny = Math.round(Math.max(-2.5, Math.min(hiCap(p), cur.y + dir * STEP)) * 100) / 100; if(ny === cur.y) break;
      cur = ev(ny); if(Math.abs(cur.r - w) < Math.abs(best.r - w)) best = cur;
      if(dir > 0 ? cur.r <= w : cur.r >= w) break;
    }
  }
  return { n, y:best.y, par:parOf(best.rs), rate:best.r, want:Math.round(w * 100) / 100, flag:best.y !== y ? 'moved' : '' };
}
/* 표 쓰기: JSON 줄 파일들 → index.html의 const BK_T = [...] */
function apply(files, html){
  html = html || path.join(__dirname, '..', 'index.html');
  const T = [];
  for(const f of files) fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).forEach(l => { const o = JSON.parse(l); T[o.n] = [o.y, o.par]; });
  const lit = '[' + Array.from({ length:T.length }, (_, i) => T[i] ? '[' + T[i][0] + ',' + T[i][1] + ']' : 0).join(',') + ']';
  const src = fs.readFileSync(html, 'utf8'), re = /const BK_T = \[.*\];/;
  if(!re.test(src)) throw new Error('BK_T not found');
  fs.writeFileSync(html, src.replace(re, 'const BK_T = ' + lit + ';'));
  console.log('BK_T', T.filter(Boolean).length, 'stages');
}

if(require.main === module){
  const [mode = 'winrate', a1, a2, a3, a4] = process.argv.slice(2);
  if(mode === 'apply'){ apply(process.argv.slice(3)); process.exit(0); }
  const from = +(a1 || 1), to = +(a2 || 70), M = load(a3);
  for(let n = from; n <= to; n++){
    const t0 = Date.now();
    const r = mode === 'tune' ? tuneStage(M, n) : mode === 'refine' ? refineStage(M, n) : rateStage(M, n, +(a4 || 150));
    r.ms = Date.now() - t0;
    console.log(JSON.stringify(r));
  }
}
module.exports = { load, runs, want };
