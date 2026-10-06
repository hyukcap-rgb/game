// 무작위 입력 봇 점검(21번 문서 5-2 ⑩ · 결정 219): 오늘의 문제를 생각 없이 마구 눌러서 깰 수 있는지 잰다.
// "같은 문제, 실력대로 다른 점수"가 시험지의 약속이라, 화살표만 번갈아 눌러 깨지는 게임이 없어야 한다.
//
//   node tools/build.js && npm run test:bot              (모든 게임, 표 출력)
//   npm run test:bot -- merge ball                       (몇 게임만)
//   npm run test:bot -- --quick                          (숫자 엔진이 있는 게임만, 빠르게)
//   옵션: --days 30(날짜 수) --runs 3(판마다 입력 씨앗 수) --sec 6(화면 봇 한 판 시간) --from 2026-10-08(첫 날짜)
//
// 두 가지 방법
//  1) 게임 정의에 botRun({ day, lv, kind, run })이 있으면(숫자 합치기) 화면 없이 게임의 숫자 엔진으로
//     날짜 × 난이도 3 × 입력 4종(←→ 번갈아 · ↑↓ 번갈아 · 시계 방향 · 아무거나) × runs 판을 돌린다.
//     같은 날짜 씨앗('exam:<날짜>:<게임>')이라 사이트·모듈의 오늘의 문제와 같은 판. 비교용으로 탐욕 봇(가장 큰 합치기)·자동 플레이어도 잰다.
//  2) 없으면 브라우저에서 오늘의 문제를 열고 sec초 동안 판 안 아무 데나 누르기·밀기·화살표를 섞어 넣는다(참고용, 적은 수).
// 기준표(5-2)를 넘는 게임이 있으면 실패(exit 1). 기준이 없는 게임은 재기만 한다.
// 무작위 4종의 성공률은 4종을 합친 비율로 기준과 비교하고, 종류별 값도 같이 보여 준다. 깬 판의 점수는 평균이 400점 이하여야 한다.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL = fs.readdirSync(path.join(ROOT, 'games')).filter(d => fs.existsSync(path.join(ROOT, 'games', d, 'game.json')));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = argv.filter((a, i) => ALL.includes(a) && !(i && argv[i - 1].startsWith('--')));
const QUICK = argv.includes('--quick');
const DAYS = +opt('days', 30), RUNS = +opt('runs', 3), SEC = +opt('sec', 6);
const FROM = opt('from', null);
/* 기준표(21번 문서 5-2): 무작위 입력 성공률 상한 % */
const LIMIT = { merge:3, ball:10, block:5, match:10, parking:1, link:0, memory:0, hidden:0, spot:0, fox:0, sudoku:0, nono:0, mines:0 };
const SCORE_MAX = 400;   /* 혹시 깨도 이 점수 아래(평균) */
const GAMES = (ONLY.length ? ONLY : ALL).filter(g => g !== 'tower');

const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const wait = ms => new Promise(r => setTimeout(r, ms));
/* 날짜 목록: 내일부터(새 규칙이 날짜 문턱 뒤에 켜지는 게임이 있어서) */
const day0 = FROM ? new Date(FROM + 'T00:00:00') : new Date(Date.now() + 864e5);
const DAYLIST = Array.from({ length:DAYS }, (_, i) => { const d = new Date(day0.getTime() + i * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
const LVS = ['easy', 'normal', 'hard'];
const KINDS = ['lr', 'ud', 'cw', 'any'];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
async function open(g){
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());   /* 글꼴은 필요 없음(인터넷이 막혀도 돌게) */
  await page.addInitScript(id => { try{ localStorage.setItem('bot:hp:welcome', '9'); localStorage.setItem('bot:hp:help:' + id, '1'); localStorage.setItem('hp:help:' + id, '1'); }catch(_){} }, g);
  await page.goto(BASE + `embed/${g}.html?ns=bot&mode=menu`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(id => typeof NG !== 'undefined' && NG[id], g, { timeout:30000 });
  return page;
}
const pct = (w, n) => n ? 100 * w / n : 0;
const rows = []; let fail = 0;

for(const g of GAMES){
  if(!fs.existsSync(path.join(ROOT, 'embed', g + '.html'))){ console.log(`✗ ${g}: embed/${g}.html 없음 (node tools/build.js 먼저)`); fail++; continue; }
  const page = await open(g);
  const fast = await page.evaluate(id => typeof NG[id].botRun === 'function', g);
  if(!fast && QUICK){ await page.close(); continue; }
  let res;
  if(fast){
    /* 1) 숫자 엔진: 브라우저 안에서 한 번에 */
    res = await page.evaluate(({ id, days, lvs, kinds, runs }) => {
      const out = {};
      for(const k of kinds.concat(['greedy', 'ai'])){
        const o = { n:0, w:0, sc:[], lv:{} };
        for(const lv of lvs){ let lw = 0, ln = 0;
          for(const day of days) for(let run = 0; run < (k === 'ai' || k === 'greedy' ? 1 : runs); run++){
            const r = NG[id].botRun({ day, lv, kind:k, run }); o.n++; ln++; if(r.win){ o.w++; lw++; o.sc.push(r.score); } }
          o.lv[lv] = [lw, ln]; }
        out[k] = o;
      }
      return out;
    }, { id:g, days:DAYLIST, lvs:LVS, kinds:KINDS, runs:RUNS });
  } else {
    /* 2) 화면 봇: 판 안 아무 데나 누르기·밀기·화살표(참고용) */
    const days = DAYLIST.slice(0, Math.min(DAYS, 2)); res = { any:{ n:0, w:0, sc:[], lv:{} } };
    for(const lv of LVS){ let lw = 0, ln = 0;
      for(const day of days){
        const r = await page.evaluate(async ({ id, lv, day, sec }) => {
          window.dayKey = () => day; try{ closeModal(); }catch(_){}
          let out = null; const fin = window.finish;
          window.finish = function(w){ if(!out && G && !G.over){ let sc = 0; if(w) try{ sc = calcScore().score; }catch(_){} out = { win:!!w, sc }; } return fin.apply(this, arguments); };
          try{ startGame(id, lv); }catch(e){ window.finish = fin; return { err:String(e) }; }
          const st = document.querySelector('#stage'), rnd = (() => { let a = 12345 + day.length * 7 + lv.length; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
          const t0 = performance.now(), keys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', ' ', 'Enter'];
          const ev = (el, type, x, y, extra) => el.dispatchEvent(new PointerEvent(type, Object.assign({ bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:1, pointerType:'touch', isPrimary:true }, extra)));
          while(!out && performance.now() - t0 < sec * 1000){
            const m = document.querySelector('#modal'); if(m && m.classList.contains('on') && !(G && G.over)) try{ closeModal(); }catch(_){}
            const r = st.getBoundingClientRect(), x = r.left + rnd() * r.width, y = r.top + rnd() * Math.min(r.height, innerHeight - r.top), el = document.elementFromPoint(x, y) || st, a = rnd();
            if(a < .5){ ev(el, 'pointerdown', x, y); ev(el, 'pointerup', x, y); el.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:x, clientY:y })); }
            else if(a < .8){ const d = Math.floor(rnd() * 4), dx = [0, 60, 0, -60][d], dy = [-60, 0, 60, 0][d]; ev(el, 'pointerdown', x, y); ev(el, 'pointermove', x + dx / 2, y + dy / 2); ev(el, 'pointermove', x + dx, y + dy); ev(el, 'pointerup', x + dx, y + dy); }
            else dispatchEvent(new KeyboardEvent('keydown', { key:keys[Math.floor(rnd() * keys.length)], bubbles:true }));
            await new Promise(r => setTimeout(r, 60));
          }
          window.finish = fin;
          try{ if(G && !G.over){ G.over = true; leavePlay(); } }catch(_){}
          return out || { win:false, sc:0 };
        }, { id:g, lv, day, sec:SEC });
        res.any.n++; ln++; if(r.win){ res.any.w++; lw++; res.any.sc.push(r.sc); }
      }
      res.any.lv[lv] = [lw, ln];
    }
  }
  await page.close();
  /* 판정 */
  const rk = Object.keys(res).filter(k => k !== 'greedy' && k !== 'ai'), N = rk.reduce((s, k) => s + res[k].n, 0), W = rk.reduce((s, k) => s + res[k].w, 0);
  const sc = rk.flatMap(k => res[k].sc), avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 0, mx = sc.length ? Math.max(...sc) : 0;
  const lim = LIMIT[g], rate = pct(W, N), bad = lim != null && (rate > lim + 1e-9 || (sc.length && avg > SCORE_MAX));
  if(bad) fail++;
  rows.push({ g, how:fast ? '엔진' : '화면', n:N, rate, lim, avg, mx, kinds:rk.length > 1 ? rk.map(k => `${k} ${pct(res[k].w, res[k].n).toFixed(1)}%`).join(' · ') : '',
    lv:LVS.map(lv => { const a = rk.reduce((s, k) => [s[0] + res[k].lv[lv][0], s[1] + res[k].lv[lv][1]], [0, 0]); return lv[0] + ' ' + pct(a[0], a[1]).toFixed(1) + '%'; }).join(' · '),
    ref:res.greedy ? `탐욕 ${pct(res.greedy.w, res.greedy.n).toFixed(0)}% · 자동 플레이어 ${pct(res.ai.w, res.ai.n).toFixed(0)}%` : '', bad });
  const r = rows[rows.length - 1];
  console.log(`${bad ? '✗' : '✓'} ${g.padEnd(9)} [${r.how}] 무작위 ${r.rate.toFixed(1)}% (${W}/${N})${lim != null ? ` 기준 ≤${lim}%` : ' 기준 없음'}${sc.length ? ` · 깬 판 점수 평균 ${Math.round(avg)} 최고 ${mx}` : ''}`);
  if(r.kinds) console.log(`    종류별: ${r.kinds}`);
  console.log(`    난이도별: ${r.lv}${r.ref ? '\n    비교: ' + r.ref : ''}`);
}
await browser.close(); srv.close();
console.log(`\n날짜 ${DAYLIST[0]}부터 ${DAYS}일 · 난이도 3 · 엔진 게임은 입력 4종 × ${RUNS}판, 화면 게임은 ${Math.min(DAYS, 2)}일 × ${SEC}초(참고)`);
console.log(fail ? `기준을 넘은 게임 ${fail}개` : '모두 기준 안');
process.exit(fail ? 1 : 0);
