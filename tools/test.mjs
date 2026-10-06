// 하루퍼즐 자동 점검: 사이트(index.html)와 게임 모듈(embed/<게임>.html)을 진짜 브라우저로 열어
// 모든 게임을 오늘의 문제·솔로·연습·대전으로 한 판씩 돌려 보고, 오류가 하나라도 나면 실패로 끝난다.
//
//   npm install                     (처음 한 번)
//   npx playwright install chromium (이 컴퓨터에 브라우저가 없을 때 한 번)
//   node tools/build.js && npm test
//   npm test -- ball fleet          (몇 게임만)
//
// 대전 서버 연결 실패(WebSocket) 경고는 무시한다(인터넷이 막힌 곳에서도 돌 수 있게).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL = fs.readdirSync(path.join(ROOT, 'games')).filter(d => fs.existsSync(path.join(ROOT, 'games', d, 'game.json')));
const ONLY = process.argv.slice(2).filter(a => ALL.includes(a));
const GAMES = ONLY.length ? ONLY : ALL;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const wait = ms => new Promise(r => setTimeout(r, ms));

const SITE = [
  ['오늘의 문제', g => `startGame('${g}', 'normal')`], ['도움말', g => `openHelp('${g}')`], ['성공', () => 'finish(true)'], ['홈', () => 'goHome(); closeModal()'],
  ['솔로', g => `startGame('${g}', null, { adv:1 })`], ['솔로 성공', () => 'finish(true)'], ['홈', () => 'goHome(); closeModal()'],
  ['실패', g => `startGame('${g}', 'normal'); setTimeout(() => finish(false), 300)`], ['맵', g => `goHome(); closeModal(); openAdvMap('${g}')`],
  ['대전', g => `closeModal(); duelStart('${g}'); setTimeout(() => { const b = document.querySelector('#dsAi'); if(b) b.click(); }, 200)`, 6500], ['대전 끝', () => 'finish(true)', 2500]
];
const EMBED = [
  ['오늘의 문제', () => "HaruPuzzleEmbed.start('daily')"], ['성공', () => 'finish(true)'], ['처음으로', () => 'HaruPuzzleEmbed.menu()'],
  ['솔로', () => "HaruPuzzleEmbed.start('solo')"], ['솔로 성공', () => 'finish(true)'], ['다음 스테이지', () => "document.querySelector('#mPri').click()"], ['솔로 실패', () => 'finish(false)'],
  ['연습', () => "HaruPuzzleEmbed.menu(); HaruPuzzleEmbed.start('practice', { level:'hard' })"], ['그만하기', () => "confirmQuit(); document.querySelector('#mQuit').click()"],
  ['대전', () => "HaruPuzzleEmbed.start('duel'); setTimeout(() => { const b = document.querySelector('#dsAi'); if(b) b.click(); }, 200)", 6500], ['대전 끝', () => 'finish(true)', 2500]
];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
let fail = 0;
async function run(label, url, steps, g, needEvents){
  const page = await browser.newPage({ viewport:{ width:400, height:820 } }), errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if(m.type() === 'error' && !/WebSocket/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:age19', '1'); localStorage.setItem('hpe:::hp:age19', '1'); localStorage.setItem('hpe:test::hp:age19', '1'); }catch(_){} window.__ev = []; addEventListener('haru-puzzle', e => window.__ev.push(e.detail.type)); });
  await page.goto(url); await wait(700);
  await page.evaluate(() => typeof closeModal === 'function' && closeModal());
  const bad = [];
  for(const [name, code, ms] of steps){
    const n0 = errs.length;
    try{ await page.evaluate(new Function(code(g))); }catch(e){ errs.push(name + ': ' + String(e).split('\n')[0]); }
    await wait(ms || 800);
    if(errs.length > n0) bad.push(`${name}: ${errs.slice(n0).join(' | ').slice(0, 300)}`);
  }
  if(needEvents){
    const ev = await page.evaluate(() => window.__ev);
    for(const t of ['ready', 'start', 'finish', 'progress']) if(!ev.includes(t)) bad.push('이벤트 없음: ' + t);
  }
  await page.close();
  console.log(`${bad.length ? '✗' : '✓'} ${label} ${g}${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
  if(bad.length) fail++;
}
for(const g of GAMES) await run('사이트', BASE + 'index.html', SITE, g, false);
for(const g of GAMES){
  if(!fs.existsSync(path.join(ROOT, 'embed', g + '.html'))){ console.log(`✗ 모듈 ${g}: embed/${g}.html 없음 (node tools/build.js 먼저)`); fail++; continue; }
  await run('모듈', BASE + `embed/${g}.html?ns=test`, EMBED, g, true);
}
await browser.close(); srv.close();
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
