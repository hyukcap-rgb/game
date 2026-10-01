// 별빛 구슬 자동 플레이어(헤드리스 난이도 점검). index.html의 별빛 구슬 물리를 그대로 불러와 턴마다 각도를 훑어 가장 좋은 수를 고른다.
// 사용: node tools/star-ball-bot.js [index.html] [모드] [각도 수] [조준 흔들림(rad)]
//   모드: stages:1:30 | stagesL:5,10,20 | daily:easy|normal|hard:판수   예) node tools/star-ball-bot.js index.html stages:1:30 40
//   각도 16 + 흔들림 0.03 = 서툰 사람 흉내, 각도 40 = 잘하는 사람
const fs = require('fs'), vm = require('vm');
const src = require('./source').readSource(process.argv[2]);
const a = src.indexOf('/* ---------- 별빛 구슬: 밤하늘'), b = src.indexOf('\nObject.assign(SFX_GATE, { bTink');
if(a < 0 || b < 0) throw new Error('section not found');
const pick = name => { const m = src.match(new RegExp('^function ' + name + '\\(.*$', 'm')); return m[0]; };
const code = [pick('seedFrom'), pick('mulberry'), pick('shuffle'), src.slice(a, b)].join('\n');
const ctx = { Math, console, performance:{ now:() => 0 }, SFX_LIB:{}, SFX_GATE:{}, FXR:{ reduce:true },
  sfx(){}, fxBuzz(){}, toast(){}, $:() => null, panC:() => 0, G:null, document:{},
  finish(win){ ctx.G.over = true; ctx.G.result = win; } };
vm.createContext(ctx);
vm.runInContext(code.replace(/^function ballStageCfg/m, 'var ballStageCfg = function') + '\n;this.api = { genBall, ballInit, ballFire, ballUpdate, get ballStageCfg(){ return ballStageCfg; }, ballStars, BAIM_MIN, BAIM_MAX, ballBlocksLeft };', ctx);
const A = ctx.api;
const NA = +(process.argv[4] || 60), NOISE = +(process.argv[5] || 0);
if(process.env.CFGFILE) vm.runInContext(fs.readFileSync(process.env.CFGFILE, "utf8"), ctx);

function hpSum(g){ let s = 0, low = 0; for(let r=0;r<g.gridB.length;r++) for(const c of g.gridB[r]) if(c && c.hp > 0){ s += c.hp; low = Math.max(low, r); } return { s, low }; }
function runTurn(g, ang){
  ctx.G = g; A.ballFire(ang);
  let n = 0;
  while(!g.over && g.phase === 'shoot' && n < 30 * 120){ A.ballUpdate(1/30); n++; }
  g.slide = 0; g.fx = []; g.rings = []; g.txts = [];
  return g;
}
function clone(g){ const rows = g.rows; g.rows = null; const c = structuredClone(g); g.rows = rows; c.rows = rows; return c; }
function evalState(g){
  if(g.over) return g.result ? 1e9 - g.turn * 1000 : -1e9;
  if(g.won) return 1e9 - g.turn * 1000;
  const { s, low } = hpSum(g);
  return -s * 10 + g.balls * 12 - (low >= 8 ? 4000 : low >= 7 ? 600 : 0) - (g.shield ? 0 : 3000) + g.broken * 5;
}
function play(cfg, seed, opt = {}){
  const g = { id:'ball', sim:true, adv:0, L:{}, over:false };
  ctx.G = g; A.ballInit(A.genBall(mul(seed), cfg));
  g.sim = true;
  let guard = 0;
  while(!g.over && guard++ < 200){
    if(g.won){ g.over = true; g.result = true; break; }
    let best = null, bestV = -Infinity;
    for(let i=0;i<NA;i++){
      const ang = A.BAIM_MIN + (A.BAIM_MAX - A.BAIM_MIN) * (i + .5) / NA + (opt.noise ? (Math.random() - .5) * .02 : 0);
      const c = runTurn(clone(g), ang), v = evalState(c);
      if(v > bestV){ bestV = v; best = ang; }
    }
    runTurn(g, best + (NOISE ? (Math.random() * 2 - 1) * NOISE : 0));
    if(g.won){ g.over = true; g.result = true; }
  }
  if(process.env.DUMP && !g.result) console.log(g.gridB.map(r => r.map(c => !c ? ' .  ' : c.star ? ' *  ' : (c.t === 'bump' ? 'o' : c.sp ? c.sp[0].toUpperCase() : '#') + String(c.hp).padEnd(3)).join('')).join('\n'));
  return { win:!!g.result, turn:g.turn, R:g.R, rows:g.rowsN, shield:g.shield, balls:g.balls, total:g.total, top:g.hpTop, stars:g.result ? A.ballStars(g.turn, g.R, g.shield > 0) : 0 };
}
function mul(seed){ return ctx.mulberry(ctx.seedFrom(seed)); }
vm.runInContext('this.mulberry = mulberry; this.seedFrom = seedFrom;', ctx);

const mode = process.argv[3] || 'stages';
const out = [];
if(mode.startsWith('stages')){
  const [, s0, s1] = mode.split(':'); const from = +(s0 || 1), to = +(s1 || 30);
  const list = mode.startsWith('stagesL') ? s0.split(',').map(Number) : Array.from({ length:to - from + 1 }, (_, i) => from + i);
  for(const n of list){
    const cfg = A.ballStageCfg(n), t0 = Date.now();
    const r = play(cfg, 'adv:ball:' + n);
    out.push(r); console.log(`N${String(n).padStart(2)} rows ${r.rows} top ${String(r.top).padStart(3)} blocks ${String(r.total).padStart(3)} | ${r.win ? 'WIN ' : 'LOSE'} turns ${r.turn} par ${r.R} (${r.turn - r.R >= 0 ? '+' : ''}${r.turn - r.R}) shield ${r.shield ? 'kept' : 'used'} balls ${r.balls} ★${r.stars}  ${Date.now() - t0}ms`);
  }
} else {
  const L = { easy:{ rows:10, like:5 }, normal:{ rows:14, like:12 }, hard:{ rows:18, like:22 } };
  const k = mode.split(':')[1] || 'normal', N = +(mode.split(':')[2] || 6);
  for(let i=1;i<=N;i++){
    const r = play(Object.assign({ limit:0 }, L[k]), '2026-09-30:ball:' + k + ':' + i);
    out.push(r); console.log(`${k} #${i} top ${r.top} blocks ${r.total} | ${r.win ? 'WIN ' : 'LOSE'} turns ${r.turn} par ${r.R} shield ${r.shield ? 'kept' : 'used'} balls ${r.balls} ★${r.stars}`);
  }
}
const w = out.filter(r => r.win);
console.log(`\nwins ${w.length}/${out.length}, avg over-par ${(w.reduce((s, r) => s + r.turn - r.R, 0) / Math.max(1, w.length)).toFixed(1)}, shield used ${out.filter(r => !r.shield).length}, stars ${out.map(r => r.stars).join('')}`);
