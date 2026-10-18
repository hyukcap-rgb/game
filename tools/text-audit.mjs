// 게임 화면 글자 수 점검(UI팀, 2026-10-18): 게임마다 오늘의 문제·솔로(1판·11판)·대전(컴퓨터) 판을 열어
// 게임 화면(#play, 창 제외)에 보이는 글자 수를 센다. 공백·숫자·기호는 빼고 "읽어야 하는 글자"(한글·영문)만 센다.
//   node tools/text-audit.mjs              → 표 + docs/text-audit.json
//   node tools/text-audit.mjs --base=파일.json   → 예전 결과와 비교(줄어든 비율)
//   node tools/text-audit.mjs ball fleet   → 몇 게임만
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL = fs.readdirSync(path.join(ROOT, 'games')).filter(d => fs.existsSync(path.join(ROOT, 'games', d, 'game.json')));
const args = process.argv.slice(2);
const ONLY = args.filter(a => ALL.includes(a));
const GAMES = ONLY.length ? ONLY : ALL;
const baseArg = args.find(a => a.startsWith('--base='));
const OUT = (args.find(a => a.startsWith('--out=')) || '--out=docs/text-audit.json').slice(6);
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const wait = ms => new Promise(r => setTimeout(r, ms));

const MODES = [
  ['오늘', g => `startGame('${g}', 'normal')`, 1200],
  ['솔로1', g => `startGame('${g}', null, { adv:1, cardDone:true })`, 1200],
  ['솔로11', g => `startGame('${g}', null, { adv:11, cardDone:true })`, 1200],
  ['대전', g => `duelStart('${g}'); setTimeout(() => { const b = document.querySelector('#dsAi'); if(b) b.click(); }, 200)`, 7000]
];

/* 화면에 실제로 보이는 글자만: 숨김·크기 0·화면 밖·창(veil) 제외 */
function visibleText(){
  const root = document.querySelector('#play'); if(!root) return { n:0, items:[] };
  const W = innerWidth, H = innerHeight, items = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while((node = tw.nextNode())){
    const t = node.nodeValue.replace(/\s+/g, ' ').trim(); if(!t) continue;
    const el = node.parentElement; if(!el || el.closest('svg') && !el.closest('text')) {}
    const cs = getComputedStyle(el);
    if(cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    let e = el, hide = false; while(e && e !== root){ const s = getComputedStyle(e); if(s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || e.hidden){ hide = true; break; }
      if(s.overflow === 'hidden' || s.clip !== 'auto'){ const rb = e.getBoundingClientRect(); if(rb.width <= 2 || rb.height <= 2){ hide = true; break; } } e = e.parentElement; }
    if(hide) continue;
    const r = document.createRange(); r.selectNodeContents(node); const b = r.getBoundingClientRect();
    if(b.width < 1 || b.height < 1 || b.bottom < 0 || b.top > H * 1.6 || b.right < 0 || b.left > W) continue;
    const letters = (t.match(/[가-힣A-Za-z]/g) || []).length;
    if(!letters) continue;
    items.push({ t:t.slice(0, 60), n:letters, cls:(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || el.tagName).toString().slice(0, 40) });
  }
  return { n:items.reduce((a, b) => a + b.n, 0), items };
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
const result = {};
for(const g of GAMES){
  result[g] = {};
  for(const [mode, code, ms] of MODES){
    const page = await browser.newPage({ viewport:{ width:390, height:844 } });
    await page.addInitScript(id => { try{
      for(const k of ['hp:welcome']) localStorage.setItem(k, '9');
      localStorage.setItem('hp:age19', '1'); localStorage.setItem('hp:help:' + id, '1'); localStorage.setItem('hp:coach:' + id, '1');
      localStorage.setItem('hp:adv:' + id, JSON.stringify({ max:60, stars:{} }));
    }catch(_){} }, g);
    try{
      await page.goto(BASE + 'index.html'); await wait(600);
      await page.evaluate(() => typeof closeModal === 'function' && closeModal());
      const ok = await page.evaluate(id => typeof NG !== 'undefined' && !!NG[id], g);
      if(!ok){ await page.close(); continue; }
      const m = await page.evaluate(id => ({ modes:NG[id].modes || null, entry:!!NG[id].entry, duel:typeof duelStart === 'function' }), g);
      if(m.entry){ await page.close(); continue; }
      if(m.modes && mode !== '대전' && !m.modes.includes('solo')){ await page.close(); continue; }
      if(m.modes && mode === '오늘' && !m.modes.includes('daily')){ await page.close(); continue; }
      if(m.modes && mode === '대전' && !m.modes.includes('duel')){ await page.close(); continue; }
      await page.evaluate(new Function(code(g)));
      await wait(ms);
      await page.evaluate(() => { try{ const v = document.querySelector('#veil'); if(v && v.classList.contains('on')){ const b = document.querySelector('#mOk,#ncGo'); if(b) b.click(); else closeModal(); } }catch(_){} });
      await wait(400);
      result[g][mode] = await page.evaluate(visibleText);
    }catch(e){ result[g][mode] = { n:-1, err:String(e).slice(0, 120), items:[] }; }
    await page.close();
  }
}
await browser.close(); srv.close();

const base = baseArg ? JSON.parse(fs.readFileSync(baseArg.slice(7), 'utf8')) : null;
let tb = 0, ta = 0;
for(const g of GAMES){
  const row = Object.entries(result[g]).map(([m, v]) => {
    const b = base && base[g] && base[g][m] ? base[g][m].n : null;
    if(b != null && v.n >= 0){ tb += b; ta += v.n; }
    return `${m} ${v.n}${b != null ? `(${b}→${b ? Math.round((1 - v.n / b) * 100) : 0}%↓)` : ''}`;
  }).join(' · ');
  console.log(`${g.padEnd(10)} ${row}`);
}
if(base) console.log(`\n전체: ${tb} → ${ta} 글자 (${tb ? Math.round((1 - ta / tb) * 100) : 0}% 줄어듦)`);
fs.writeFileSync(path.resolve(ROOT, OUT), JSON.stringify(result, null, 1));
