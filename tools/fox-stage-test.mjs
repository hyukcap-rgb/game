/* 여우 자리 찾기 · 솔로 난이도 v2 점검 (Playwright)
   node tools/fox-stage-test.mjs [--seeds 4] [--shots dir] [--from 1 --to 70]
   - 스테이지 1~70 판을 게임과 같은 씨앗으로 만들어: 예외 없음, 생성 시간, 답 하나, (숫자 규칙) 숫자 없이는 답 여러 개 확인
   - 사람처럼 풀어 본 난이도 점수(fxxRate)를 스테이지마다 출력(여러 씨앗 평균) → 톱니 모양(k5↑, k6·k9↓, k10 최고) 확인
   - 실제 화면: 솔로 판 시작·풀기·틀리기, 오늘의 문제(기본 판) 그대로인지 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEEDS = +arg('seeds', 4), FROM = +arg('from', 1), TO = +arg('to', 80), SHOTS = arg('shots', '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8700 + Math.floor(Math.random() * 800);
const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd:root, stdio:'ignore' });
await new Promise(r => setTimeout(r, 700));
let fail = 0;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { localStorage.setItem('hp:welcome', '3'); ['fox'].forEach(g => localStorage.setItem('hp:help:' + g, '1')); });

  /* 1) 판 생성·검증·난이도 */
  const rows = await page.evaluate(({ FROM, TO, SEEDS }) => {
    const out = [];
    for(let n = FROM; n <= TO; n++){
      const x = foxStageCfg(n), p = planOf('fox', n), r = { n, k:p.k, N:x.N, kk:x.k, mj:p.mj.join('+'), tw:p.tw || '', pick:'목표' + x.target.toFixed(0), limit:x.limit, ms:[], score:[], ok:true, why:'', clues:0, rocks:0 };
      for(let s = 0; s < SEEDS; s++){
        const rng = mulberry(seedFrom(s ? 'adv:fox:' + n + ':' + s : 'adv:fox:' + n));
        const t = performance.now(); let P;
        try { P = foxAdvBoard(rng, x); } catch(e){ r.ok = false; r.why = 'throw ' + e.message; break; }
        r.ms.push(performance.now() - t);
        const sols = fxxSolve(P, 2);
        if(sols.length !== 1){ r.ok = false; r.why = 'solutions=' + sols.length; }
        if(P.k !== x.k || P.N !== x.N){ r.ok = false; r.why = 'fallback'; }
        if(x.clue){
          const noClue = fxxSolve({ N:P.N, k:P.k, reg:P.reg, blk:P.rock, clue:null }, 2).length;
          const nc = P.clue.filter(v => v >= 0).length;
          if(!nc || noClue < 2){ r.ok = false; r.why = 'clue not needed'; }
          if(!s) r.clues = nc;
        }
        const nr = P.rock.reduce((a, b) => a + b, 0);
        if(!s) r.rocks = nr;
        if(!x.rocks && nr){ r.ok = false; r.why = 'rocks on non-rock stage'; }
        if(x.rocks && !nr){ r.ok = false; r.why = 'no rocks'; }
        const R = fxxRate(P); if(R.bad){ r.ok = false; r.why = 'rate contradiction'; }
        r.score.push(R.score);
      }
      out.push(r);
    }
    return out;
  }, { FROM, TO, SEEDS });
  const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  let tot = 0, cnt = 0;
  console.log('  n  k  판      규칙          변주     목표    시간한도  생성ms(평균/최대)  난이도(평균)  막대');
  for(const r of rows){
    tot += r.ms.reduce((a, b) => a + b, 0); cnt += r.ms.length;
    const sc = avg(r.score), tag = r.k === 10 ? ' 보스' : r.k === 5 ? ' 어려움' : [1, 6, 9].includes(r.k) ? ' 쉬움' : '';
    console.log(String(r.n).padStart(3), String(r.k).padStart(2), (r.N + '×' + r.N + (r.kk === 2 ? '×2' : '')).padEnd(7), (r.mj || '-').padEnd(12), (r.tw || '-').padEnd(8),
      r.pick.padEnd(7), String(r.limit).padStart(6), (avg(r.ms).toFixed(0) + '/' + Math.max(...r.ms).toFixed(0)).padStart(14), sc.toFixed(1).padStart(10), ' ' + '█'.repeat(Math.min(60, Math.round(sc / 3))) + tag,
      r.clues ? '숫자' + r.clues : '', r.rocks ? '바위' + r.rocks : '', r.ok ? '' : '  <<< FAIL ' + r.why);
    if(!r.ok) fail++;
  }
  console.log(`\n평균 생성 시간 ${(tot / cnt).toFixed(0)}ms (${cnt}판)`);
  /* 챕터 자리별 평균(톱니 모양) */
  const byK = {}; rows.forEach(r => (byK[r.k] = byK[r.k] || []).push(avg(r.score)));
  console.log('챕터 자리 k별 평균 난이도: ' + Object.keys(byK).map(k => k + ':' + avg(byK[k]).toFixed(1)).join('  '));

  /* 2) 실제 화면: 솔로 판을 시작해서 틀려 보고 끝까지 풀기 */
  const play = async (n, shot) => {
    await page.evaluate(n => { closeModal && closeModal(); startGame('fox', null, { adv:n, cardDone:true }); }, n);
    await page.waitForFunction(() => G && G.reg && document.querySelectorAll('#bd .fxc').length === G.N * G.N, null, { timeout:8000 });
    await page.waitForTimeout(shot ? 4000 : 700);   /* 앞 판 꽃가루가 걷힐 때까지 */
    if(shot && SHOTS) await page.screenshot({ path:`${SHOTS}/fox-${n}.png` });
    return page.evaluate(() => {
      const res = { N:G.N, total:G.total, chips:[...document.querySelectorAll('.fx-rule')].map(e => e.textContent.trim()), paws:G.paws, lives:document.querySelectorAll('#fxLives .fx-star').length };
      const bad = [...Array(G.N * G.N).keys()].find(i => !G.solSet.has(i) && !(G.blk && G.blk[i]));
      foxTap(bad); foxTap(bad); res.afterWrong = G.paws;
      res.blkTap = (() => { const b = [...Array(G.N * G.N).keys()].find(i => G.blk[i]); if(b == null) return 'none'; foxTap(b); return G.cells[b]; })();
      for(const i of G.sol){ if(G.cells[i] !== 2){ if(G.cells[i] === 0) foxTap(i); foxTap(i); } }
      res.placed = G.placed; res.done = !!G.done;
      return res;
    });
  };
  for(const n of [6, 11, 16, 21, 26, 31, 36, 41, 46, 50, 55, 70]){
    const r = await play(n, [11, 21, 31, 36, 41, 50].includes(n));
    const ok = r.done && r.placed === r.total && r.blkTap !== 2;
    console.log('화면', n, JSON.stringify(r), ok ? 'OK' : '<<< FAIL');
    if(!ok) fail++;
    await page.waitForTimeout(3600);
    const over = await page.evaluate(() => G.over); if(!over){ console.log('  끝나지 않음 <<< FAIL'); fail++; }
  }
  /* 3) 오늘의 문제(기본 판)는 예전 그대로: genFox, 행마다 정답 1칸, 규칙 칩 없음 */
  const daily = await page.evaluate(async () => {
    closeModal && closeModal(); localStorage.setItem('hp:hearts', JSON.stringify({ n:5, t:Date.now() }));
    startGame('fox', 'normal'); await new Promise(r => setTimeout(r, 400));
    const q = { N:G.N, fx:!!G.fx, solSet:!!G.solSet, chips:document.querySelectorAll('.fx-rule').length, sol:Array.isArray(G.sol) && G.sol.length === G.N && G.sol.every(c => c < G.N), cnt:$('#fxCnt').textContent, lives:document.querySelectorAll('#fxLives .fx-star').length };
    for(let r = 0; r < G.N; r++){ const i = r * G.N + G.sol[r]; foxTap(i); foxTap(i); }
    q.done = !!G.done; return q;
  });
  const dOk = daily.N === 9 && !daily.fx && !daily.solSet && !daily.chips && daily.sol && daily.done && daily.lives === 3;
  console.log('오늘의 문제', JSON.stringify(daily), dOk ? 'OK' : '<<< FAIL'); if(!dOk) fail++;
  await page.waitForTimeout(2600);
  const real = errs.filter(e => !/WebSocket|railway/i.test(e));
  console.log('페이지 오류', real.length ? real : '없음'); if(real.length) fail++;
} finally {
  await browser.close(); srv.kill();
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
