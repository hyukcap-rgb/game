// 고스톱 소리 검수 도구(테스트 체크팀): 브라우저에서 실제로 여러 판을 두면서 '실제로 난 소리'를 시각과 함께 모두 기록하고
// 겹침·중복을 찾는다. (먼저 node tools/build.js — 이 도구는 빌드하지 않음)
//
// 쓰는 법
//   node tools/gostop-sound-audit.mjs                 고스톱: 솔로 4판 + AI 대전 3판
//   node tools/gostop-sound-audit.mjs --game tgostop  트럼프 고스톱
//   옵션: --solo 1,15,38 · --duel N · --par P · --out DIR(기본 scratch/sound-audit)
//
// 기록: 공용 엔진 SFX_LIB의 소리 함수가 실제로 불린 순간(간격 제한 gate를 통과한 것만) = 실제로 소리가 난 것.
// 검사 규칙(위반하면 종료 코드 1)
//   R1 패 소리 중복   패 소리(패 '착'·누름 딸깍·뒤집기·휙) 두 개가 150ms 안에 → 한 번 낼 때 두 번 들림
//   R2 같은 소리 반복  같은 이름이 250ms 안에 두 번
//   R3 패+이벤트 겹침  패 '착' 앞뒤 200ms 안에 이벤트 소리(뻑·쪽·따닥·폭탄·쓸 등, 이벤트 녹음에 패 소리가 들어 있음)
//   R4 이벤트 겹침     큰 소리(이벤트·고/스톱·족보·승패·잭팟) 둘이 앞 소리 길이의 70% 안에 시작
//   R5 동시에 너무 많음 동시에 울리는 소리(길이 표 기준) 3개 이상
//   R6 모으기 겹침     먹은 패 모으기(차라락)가 패 '착' 뒤 120ms 안에
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const GAME = opt('game', 'gostop');
const SOLO = opt('solo', '1,9,15,38').split(',').filter(Boolean).map(Number);
const DUELN = +opt('duel', '3');
const PAR = +opt('par', '4');
const OUT = path.resolve(ROOT, opt('out', 'scratch/sound-audit'));
fs.mkdirSync(OUT, { recursive:true });

const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if(!fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); r.end(); return; } r.end(fs.readFileSync(p)); }).listen(0);
await new Promise(r => srv.on('listening', r));
const B = `http://127.0.0.1:${srv.address().port}/`; const w = ms => new Promise(r => setTimeout(r, ms));

/* 소리 분류·길이(초, 녹음 길이 기준 대략) */
const CARD = new Set(['gsfxLand1', 'gsfxLand2', 'gsfxLand3', 'gsPick', 'tap', 'gsSlap', 'gsFlip']);
const SILENT = new Set(['gsfxToss', 'gsfxFlip']);   /* 지금은 소리 없는 빈 함수(기록에서 뺌) */
const UIONLY = new Set(['start', 'heartUse', 'toast', 'tab', 'pop', 'open']);   /* 판 밖 화면 소리(동시 개수만 셈에서 뺌) */
const EVENT = new Set(['gsfxPpuk', 'gsfxPpuk3', 'gsfxPpukEat', 'gsfxJappuk', 'gsfxJjok', 'gsfxTtadak', 'gsfxSseul', 'gsfxBomb', 'gsfxShake', 'gsfxBonus', 'gsfxSteal', 'gsCap']);
const BIG = new Set([...EVENT, 'gsfxGo', 'gsfxStop', 'gsfxGodori', 'gsfxHongdan', 'gsfxCheongdan', 'gsfxChodan', 'gsfxGwang', 'gsfxChongtong', 'gsfxWin', 'gsfxLose', 'gsfxDraw', 'gsfxBak', 'gsWin', 'gsBad', 'gsBig', 'gsfxSun', 'gsfxTimeout']);
const DUR = { gsfxLand1:.18, gsfxLand2:.18, gsfxLand3:.2, gsPick:.06, gsfxFlip:.25, gsfxToss:.12, gsfxGrab:.42, gsfxDeal:.83, gsfxPpuk:.55, gsfxBomb:.45, gsfxGo:.82, gsfxStop:1, gsfxWin:1.13, gsfxLose:1.45,
  gsfxSteal:.68, gsfxJjok:.8, gsfxTtadak:1, gsfxSseul:.94, gsfxShake:.75, gsfxGodori:1.14, gsfxHongdan:.96, gsfxCheongdan:.96, gsfxChodan:.96, gsfxGwang:1.07, gsfxPpukEat:1.15, gsfxJappuk:1.15, gsfxChongtong:1.15,
  gsfxBonus:.47, gsfxTimeout:.22, gsfxTick:.08, gsfxTurn:.25, gsCap:.3, gsBig:.5, gsWin:.6, gsBad:.5, gsfxBak:.5, gsfxDraw:.8, gsfxSun:.7, gsfxSunFlip:.3, gsfxPpuk3:1.2 };
const dur = n => DUR[n] || .3;

function analyze(L0){
  const L = L0.filter(x => !SILENT.has(x.n));
  const P = [];
  const add = (rule, a, b, note) => P.push({ rule, a:a.n, b:b ? b.n : '', at:a.t, gap:b ? Math.round(b.t - a.t) : 0, ctx:a.c, note });
  for(let i = 0; i < L.length; i++){
    const a = L[i];
    for(let j = i + 1; j < L.length && L[j].t - a.t < 2000; j++){
      const b = L[j], dt = b.t - a.t;
      if(CARD.has(a.n) && CARD.has(b.n) && dt < 150) add('R1 패 소리 중복', a, b);
      if(a.n === b.n && dt < 250 && a.n !== 'gsfxTick') add('R2 같은 소리 반복', a, b);
      if(((CARD.has(a.n) && EVENT.has(b.n)) || (EVENT.has(a.n) && CARD.has(b.n))) && dt < 200) add('R3 패+이벤트 겹침', a, b);
      if(BIG.has(a.n) && BIG.has(b.n) && a.n !== b.n && dt < dur(a.n) * 700) add('R4 이벤트 겹침', a, b);
      if(CARD.has(a.n) && b.n === 'gsfxGrab' && dt < 120) add('R6 모으기 겹침', a, b);
    }
    const on = L.filter(b => b.t <= a.t && b.t + dur(b.n) * 1000 > a.t && b.n !== 'gsfxTick' && !UIONLY.has(b.n));
    if(on.length >= 3 && !UIONLY.has(a.n)) P.push({ rule:'R5 동시에 너무 많음', a:on.map(x => x.n).join('+'), b:'', at:a.t, gap:0, ctx:a.c });
  }
  return P;
}

/* 브라우저 안: 실제로 난 소리 기록 */
async function instrument(pg){
  await pg.evaluate(() => {
    window.__SND = []; const t0 = performance.now();
    const ctx = () => { try{ const g = G && G.gs; return g ? `${g.phase || ''}${g.S ? ' ' + (g.gi + 1) + '판 ' + g.k + '수' : ''}` : ''; }catch(_){ return ''; } };
    for(const k of Object.keys(SFX_LIB)){ const f = SFX_LIB[k]; if(f.__w) continue; SFX_LIB[k] = function(o){ window.__SND.push({ n:k, t:Math.round(performance.now() - t0), c:ctx() }); return f.apply(this, arguments); }; SFX_LIB[k].__w = 1; }
  });
}
async function step(pg){
  return pg.evaluate(() => {
    if(typeof G === 'undefined' || !G || !G.gs) return 'nogame';
    if(G.over) return 'over';
    const room = document.querySelector('#gsLobby:not([hidden]) [data-r="1"]:not([disabled])') || document.querySelector('#gsLobby:not([hidden]) [data-r="0"]');
    if(room){ if(!window.__roomT) window.__roomT = performance.now(); if(performance.now() - window.__roomT < 900) return 'wait'; room.click(); return 'room'; }   /* 사람처럼 0.9초 뒤 */
    const sc = document.querySelector('#gsSun:not([hidden]) .sunc.can'); if(sc){ sc.click(); return 'sun'; }
    const ask = document.querySelector('#gsAsk:not([hidden])');
    if(ask && ask.querySelector('#gsEndBye')) return 'between';
    if(ask){
      if(!window.__askT) window.__askT = performance.now();
      if(performance.now() - window.__askT < 700) return 'wait';   /* 사람처럼 창을 읽고 누름(0.7초) */
      window.__askT = 0;
      const end = ask.querySelector('#gsEndOk'); if(end){ end.click(); return 'end'; }
      const bs = [...ask.querySelectorAll('[data-i]')]; if(!bs.length) return 'wait';
      const go = ask.querySelector('button.go'); if(go){ (Math.random() < .5 ? go : ask.querySelector('button.stop')).click(); return 'gs'; }
      bs[Math.floor(Math.random() * bs.length)].click(); return 'ask';
    }
    const g = G.gs; if(!g.S || g.phase !== 'play' || g.busy || g.picking || g.S.turn !== g.me || g.S.pendingGS >= 0) return 'wait';
    const cards = [...document.querySelectorAll('#gsHand .gs-c.hd')]; if(!cards.length) return 'wait';
    const m = cards.filter(c => c.classList.contains('match'));
    (m.length && Math.random() < .8 ? m[Math.floor(Math.random() * m.length)] : cards[Math.floor(Math.random() * cards.length)]).click();
    return 'played';
  });
}
const br = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const RES = [];
async function job(name, start, maxMs){
  const ctx = await br.newContext({ viewport:{ width:1366, height:768 } });
  await ctx.addInitScript(id => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:help:' + id, '1'); localStorage.setItem('hp:age19', '1'); }catch(_){} }, GAME);
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await pg.goto(B + 'index.html'); await w(500);
  await pg.mouse.click(5, 5);
  await instrument(pg);
  await pg.evaluate(start);
  const t0 = Date.now(); let bye = false;
  while(Date.now() - t0 < maxMs){
    const s = await step(pg).catch(() => 'err');
    if(s === 'over' || s === 'err') break;
    if(!bye && name.startsWith('duel')){ const gi = await pg.evaluate(() => G.gs && G.gs.gi).catch(() => 0); if(gi >= DUELN - 1){ bye = true; await pg.evaluate(() => { const b = document.querySelector('#gsOut'); if(b) b.click(); }); } }
    await w(s === 'played' ? 400 : 150);
  }
  const L = await pg.evaluate(() => window.__SND).catch(() => []);
  RES.push({ name, L, P:analyze(L), errs });
  await ctx.close();
}
const jobs = [...SOLO.map(n => () => job('solo' + n, `startGame('${GAME}', null, { adv:${n} })`, 150000)),
  ...(DUELN ? [() => job('duel', `startGame('${GAME}', 'normal', { duel:{ fleet:true, mode:'ai', opp:{ nick:'AI 고수' } } })`, 60000 * DUELN + 30000)] : [])];
let qi = 0; await Promise.all([...Array(Math.min(PAR, jobs.length))].map(async () => { while(qi < jobs.length) await jobs[qi++](); }));
await br.close(); srv.close();

/* 보고 */
let total = 0; const byRule = {}, byPair = {};
for(const r of RES){ for(const p of r.P){ total++; byRule[p.rule] = (byRule[p.rule] || 0) + 1; const key = `${p.rule} | ${p.a}${p.b ? ' → ' + p.b : ''}`; (byPair[key] = byPair[key] || []).push(`${r.name} ${p.ctx} +${p.gap}ms`); } }
const nS = RES.reduce((a, r) => a + r.L.length, 0);
console.log(`\n${GAME} 소리 검수: ${RES.length}묶음 · 소리 ${nS}번 · 문제 ${total}건`);
for(const [k, v] of Object.entries(byPair).sort((a, b) => b[1].length - a[1].length)) console.log(`■ ${k}  ×${v.length}   예: ${v.slice(0, 2).join(' / ')}`);
const cnt = {}; for(const r of RES) for(const s of r.L) cnt[s.n] = (cnt[s.n] || 0) + 1;
console.log('소리별 횟수:', Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
const errs = RES.flatMap(r => r.errs); if(errs.length) console.log('오류:', errs.slice(0, 5));
fs.writeFileSync(path.join(OUT, GAME + '-sound.json'), JSON.stringify(RES, null, 1));
console.log('결과 파일:', path.join(OUT, GAME + '-sound.json'));
process.exit(total || errs.length ? 1 : 0);
