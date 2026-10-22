// 게임 화면 글자 수 점검(UI팀, 2026-10-18): 게임마다 오늘의 문제·솔로(1판·11판)·대전(컴퓨터) 판을 열어
// 게임 화면(#play, 창 제외)에 보이는 글자 수를 센다. 공백·숫자·기호는 빼고 "읽어야 하는 글자"(한글·영문)만 센다.
//   node tools/text-audit.mjs              → 표 + docs/text-audit.json
//   node tools/text-audit.mjs --base=파일.json   → 예전 결과와 비교(줄어든 비율)
//   node tools/text-audit.mjs ball fleet   → 몇 게임만
//
// 영어 넘침 검사(DEV-21, 2026-10-22, docs/34 · docs/34_영어문구사전.md 0-5절):
//   node tools/text-audit.mjs --en              → 트럼프 고스톱(tgostop) 모듈을 ?lang=en으로 열어 검사 + docs/text-audit-en.json
//   node tools/text-audit.mjs --en ball fleet   → 다른 게임 모듈도(게임 이름을 주면 그 게임만)
//   - 화면 크기 2가지: 1280×800 글자 100% · 1280×800 글자 130%(큰 글씨 body.big + 화면 배율 1.3)
//   - 화면: 첫 화면 · 게임 방법 · 솔로 맵 · 연습 고르기 · 솔로 판 · 판 도움말 · 그만하기 창 · 솔로 결과(성공·실패) · 오늘의 문제 결과
//   - 찾는 것: ① 버튼 밖으로 넘친 글자 ② 넘침을 숨긴 칸에서 잘린 글(줄임표 포함) ③ 화면 오른쪽 밖으로 나간 글
//   - 사전 문서 0-5절 글자 수 제한(B 24 · FX 15 · S 30 · N 48 · TB 60 · R 24 · P 8 · H 240 · H1 28, 숫자, 'B+6' 같은 더하기)을 넘는 en 문장
//     (사전 문서 표의 en 칸 + core/i18n.js 영어 사전에 같은 키가 있으면 그 글도). 바꿔 넣는 값은 보기 값으로 채워 셈({g} → '12,400 G' 등)
//   - 결과가 0건이면 종료 코드 0, 하나라도 있으면 1
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

/* ===================== 영어 넘침 검사(--en) ===================== */
const LIMIT_SYM = { B:24, FX:15, S:30, N:48, TB:60, R:24, P:8, H:240, H1:28 };
/* 바꿔 넣는 값의 보기(사전 0-2절): 길이를 셀 때 이 글로 채움 */
const SAMPLE = { g:'12,400 G', sg:'+1,500 G', g2:'12,400 G', n:'12', m:'12', c:'3', s:'3', r:'10', name:'CPU Master', table:'Grand Table', t:'2h 14m', app:'Go-Stop Duel', rank:'High Roller', code:'K7M Q4P', lv:'Normal', w:'3', max:'5', v:'7', u:'', who:'CPU Master', list:'3★ Win', text:'Win', tag:' (Boss Stage)', k:'First try', wd:'Mon', ch:'Market Alley' };
function limitOf(cell){
  const c = String(cell || '').replace(/[`*\s]/g, '');
  if(/^\d+$/.test(c)) return +c;
  const m = c.match(/^(B|FX|S|N|TB|R|P|H1|H)(?:\+(\d+))?$/);
  return m ? LIMIT_SYM[m[1]] + (+m[2] || 0) : null;
}
const cleanEn = s => String(s || '').replace(/\*\(.*?\)\*/g, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\\\|/g, '|').trim();
const fillLen = s => String(s).replace(/<[^>]+>/g, '').replace(/\{(\w+)\}/g, (m, k) => SAMPLE[k] != null ? SAMPLE[k] : 'xxx').length;   /* 모르는 자리는 3글자로 셈 */
/* 사전 문서 표 읽기: 머리 줄에 'en'·'제한' 칸이 있는 표만 */
function dictRows(){
  const md = fs.readFileSync(path.join(ROOT, 'docs/34_영어문구사전.md'), 'utf8').split('\n');
  const split = l => l.replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map(x => x.trim());
  const rows = []; let head = null, sec = '';
  for(const l of md){
    if(/^#{2,3} /.test(l)){ sec = l.replace(/^#+\s*/, ''); head = null; continue; }
    if(!l.startsWith('|')){ head = null; continue; }
    const c = split(l);
    if(!head){ const iKey = c.findIndex(x => x === '키'), iEn = c.findIndex(x => x === 'en'), iLim = c.findIndex(x => x === '제한'); head = iKey >= 0 && iEn >= 0 && iLim >= 0 ? { iKey, iEn, iLim } : { skip:true }; continue; }
    if(head.skip || /^-+$/.test(c[0].replace(/[:\s]/g, ''))) continue;
    const key = (c[head.iKey].match(/`([^`]+)`/) || [])[1]; if(!key) continue;
    const en = cleanEn(c[head.iEn]); if(/[가-힣]/.test(en)) continue;   /* en 칸이 설명(한국어 메모)인 줄은 뺌 */
    const keys = [...c[head.iKey].matchAll(/`([^`]+)`/g)].map(m => m[1]), parts = keys.length > 1 ? en.split(/\s+\/\s+/) : [en];   /* `a` / `b` 두 키 줄 → en도 ' / '로 나눔 */
    if(/~/.test(c[head.iKey])){ en.split(/\s+[·\/]\s+/).forEach(x => rows.push({ sec, key:keys.join('~'), en:x, lim:limitOf(c[head.iLim]), limRaw:c[head.iLim] })); continue; }   /* `a0`~`a3` 범위 줄 → 나열된 글 하나씩 */
    keys.forEach((k, i) => rows.push({ sec, key:i && !k.includes('.') ? key.replace(/[^.]+$/, k) : k, en:parts.length === keys.length ? parts[i] : en, lim:limitOf(c[head.iLim]), limRaw:c[head.iLim] }));
  }
  return rows;
}
async function enDictCheck(){
  const rows = dictRows(), out = [];
  /* core/i18n.js의 영어 사전(지금 코드에 들어간 글)도 같은 제한으로 */
  let code = {};
  try{ const vm = await import('node:vm'); const ctx = { window:{ HP_LANG:'en' }, document:{ documentElement:{} } }; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'core/i18n.js'), 'utf8') + '\nthis.__D = I18N.dict.en;', ctx); code = ctx.__D || {}; }catch(e){ console.warn('core/i18n.js 읽기 실패:', String(e).slice(0, 120)); }
  for(const r of rows){
    if(!r.lim) continue;
    const L = fillLen(r.en); if(L > r.lim) out.push({ kind:'사전 글자 수', key:r.key, text:r.en, len:L, limit:r.lim, where:'docs/34_영어문구사전.md · ' + r.sec });
    const v = code[r.key];
    if(typeof v === 'string' && v !== r.en){ const L2 = fillLen(v); if(L2 > r.lim) out.push({ kind:'코드 사전 글자 수', key:r.key, text:v, len:L2, limit:r.lim, where:'core/i18n.js' }); }
  }
  return { rows:rows.length, out };
}
/* 화면 검사(페이지 안에서): 버튼 밖 넘침 · 잘림/줄임표 · 화면 밖 */
function overflowScan(){
  const W = innerWidth, res = [], seen = new Set();
  const roots = ['#menu', '#play', '.duelgo', '.coach', '#toast.on'].map(s => document.querySelector(s)).filter(Boolean);
  const veil = document.querySelector('#veil'); if(veil && veil.classList.contains('on')) roots.push(document.querySelector('#modal'));
  const vis = el => { for(let e = el; e && e !== document.body; e = e.parentElement){ const s = getComputedStyle(e); if(s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || e.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const sel = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
  const txt = el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const add = (kind, el, extra) => { const k = kind + '|' + sel(el) + '|' + txt(el); if(seen.has(k)) return; seen.add(k); res.push(Object.assign({ kind, sel:sel(el), text:txt(el) }, extra || {})); };
  for(const root of roots){
    if(!vis(root)) continue;
    const els = [root, ...root.querySelectorAll('*')];
    for(const el of els){
      if(el.closest('svg') || !vis(el)) continue;
      const t = txt(el); if(!t || !/[A-Za-z가-힣0-9]/.test(t)) continue;
      const cs = getComputedStyle(el);
      /* ② 넘침을 숨긴 칸에서 잘림(줄임표 포함). 큰 스크롤 창(창 본문 등)은 빼고 글자 줄 단위만 */
      const clipX = /hidden|clip/.test(cs.overflowX) || cs.textOverflow === 'ellipsis';
      if(clipX && el.scrollWidth > el.clientWidth + 1 && el.children.length <= 3) add(cs.textOverflow === 'ellipsis' ? '줄임표로 잘림' : '칸 밖으로 잘림', el, { over:el.scrollWidth - el.clientWidth });
      const clipY = /hidden|clip/.test(cs.overflowY) && cs.overflowY !== 'visible';
      if(clipY && el.scrollHeight > el.clientHeight + 2 && el.children.length <= 3 && el.clientHeight < 200) add('아래로 잘림', el, { over:el.scrollHeight - el.clientHeight });
      /* ① 버튼 밖으로 넘친 글자 */
      if(el.matches('button, [role="button"], .b1, .b2, .btn, a.g')){
        const br = el.getBoundingClientRect(), tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, worst = 0;
        while((n = tw.nextNode())){ if(!n.nodeValue.trim() || !n.parentElement || !vis(n.parentElement) || n.parentElement.closest('svg')) continue;
          let deco = false; for(let e = n.parentElement; e && e !== el; e = e.parentElement){ if(/absolute|fixed/.test(getComputedStyle(e).position)){ deco = true; break; } } if(deco) continue;   /* 일부러 버튼 밖에 붙인 꼬리표(별·NEW 등)는 뺌 */
          const r = document.createRange(); r.selectNodeContents(n);
          for(const q of r.getClientRects()){ worst = Math.max(worst, br.left - q.left, q.right - br.right, br.top - q.top - 1, q.bottom - br.bottom - 1); } }
        if(worst > 1.5) add('버튼 밖으로 넘침', el, { over:Math.round(worst) });
      }
    }
    /* ③ 화면 오른쪽·왼쪽 밖 */
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while((n = tw.nextNode())){ if(!n.nodeValue.trim() || !n.parentElement || n.parentElement.closest('svg') || !vis(n.parentElement)) continue;
      const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect();
      if(b.width > 0 && (b.right > W + 1 || b.left < -1)) add('화면 밖', n.parentElement, { over:Math.round(Math.max(b.right - W, -b.left)) }); }
  }
  return res;
}
async function enAudit(){
  const pick = args.filter(a => ALL.includes(a));
  const games = pick.length ? pick : ['tgostop'];
  const SIZES = [ { name:'1280×800 · 100%', w:1280, h:800, zoom:1, big:false }, { name:'1280×800 · 130%', w:1280, h:800, zoom:1.3, big:true } ];
  const STEPS = [
    ['첫 화면', () => 'HaruPuzzleEmbed.menu()'],
    ['게임 방법', g => `openHelp('${g}')`],
    ['솔로 맵', g => `closeModal(); if(EMB.modes.includes('solo')) openAdvMap('${g}')`],
    ['연습 고르기', g => `closeModal(); if(EMB.modes.includes('practice') && !NG['${g}'].levelSheet) embLevelSheet()`],
    ['솔로 판', g => `closeModal(); if(EMB.modes.includes('solo')) startGame('${g}', null, { adv:1, cardDone:true })`, 1500],
    ['판 도움말', g => `if(G && !G.over) openHelp('${g}')`],
    ['그만하기 창', () => `closeModal(); if(G && !G.over) confirmQuit()`],
    ['솔로 결과(성공)', () => `closeModal(); if(G && !G.over){ G.paused = false; finish(true); }`, 1500],
    ['솔로 결과(실패)', g => `closeModal(); if(EMB.modes.includes('solo')){ startGame('${g}', null, { adv:2, cardDone:true }); setTimeout(() => { closeModal(); if(G && !G.over) finish(false); }, 400); }`, 1800],
    ['오늘의 문제 결과', g => `closeModal(); HaruPuzzleEmbed.menu(); if(EMB.modes.includes('daily')){ HaruPuzzleEmbed.start('daily'); setTimeout(() => { closeModal(); if(G && !G.over) finish(true); }, 600); }`, 2600]
  ];
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
  const found = [], errs = [], koLeft = {};
  for(const g of games){
    if(!fs.existsSync(path.join(ROOT, 'embed', g + '.html'))){ errs.push(`${g}: embed/${g}.html 없음(node tools/build.js 먼저)`); continue; }
    for(const S of SIZES){
      const page = await browser.newPage({ viewport:{ width:Math.round(S.w / S.zoom), height:Math.round(S.h / S.zoom) }, deviceScaleFactor:S.zoom });
      page.on('pageerror', e => errs.push(`${g} ${S.name}: ${String(e).slice(0, 160)}`));
      await page.addInitScript(([id, big]) => { try{ for(const p of ['', 'hpe:::']){ localStorage.setItem(p + 'hp:welcome', '9'); localStorage.setItem(p + 'hp:age19', '1'); localStorage.setItem(p + 'hp:help:' + id, '1'); localStorage.setItem(p + 'hp:coach:' + id, '1'); localStorage.setItem(p + 'hp:big', big ? '1' : '0'); localStorage.setItem(p + 'hp:adv:' + id, JSON.stringify({ max:12, stars:{ 1:3, 2:2 } })); } }catch(_){} }, [g, S.big]);
      await page.goto(BASE + `embed/${g}.html?lang=en`); await wait(800);
      for(const [name, code, ms] of STEPS){
        try{ await page.evaluate(new Function(code(g))); }catch(e){ errs.push(`${g} ${S.name} ${name}: ${String(e).split('\n')[0].slice(0, 160)}`); }
        await wait(ms || 700);
        const r = await page.evaluate(overflowScan);
        for(const x of r) found.push(Object.assign({ game:g, size:S.name, screen:name }, x));
        if(S.zoom === 1){ const ko = await page.evaluate(() => { const out = []; const roots = ['#menu', '#play', '#modal'].map(s => document.querySelector(s)).filter(Boolean);
            for(const r of roots){ if(r.id === 'modal' && !document.querySelector('#veil.on')) continue; const tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n; while((n = tw.nextNode())){ const t = n.nodeValue.trim(); if(/[가-힣]/.test(t) && n.parentElement && n.parentElement.offsetParent !== null) out.push(t.slice(0, 40)); } } return out; });
          if(ko.length) koLeft[`${g} · ${name}`] = [...new Set(ko)].slice(0, 20); }
      }
      await page.close();
    }
  }
  await browser.close();
  const dict = await enDictCheck();
  const all = found.concat(dict.out);
  console.log(`영어 넘침 검사 · 게임 ${games.join(', ')} · 화면 ${STEPS.length}개 × 크기 ${SIZES.length}개 · 사전 ${dict.rows}줄`);
  for(const x of found) console.log(`✗ [${x.kind}] ${x.game} · ${x.size} · ${x.screen} · ${x.sel} (+${x.over}px) "${x.text}"`);
  for(const x of dict.out) console.log(`✗ [${x.kind}] ${x.key} ${x.len}/${x.limit}자 "${x.text.slice(0, 70)}" (${x.where})`);
  const kn = Object.keys(koLeft).length;
  if(kn){ console.log(`\n참고(실패 아님): 영어 화면에 남은 한글 — 게임 정의가 주는 글(이름·도움말·스테이지 설명 등)은 DEV-02에서 옮김`); for(const k in koLeft) console.log(`  · ${k}: ${koLeft[k].join(' ‖ ').slice(0, 300)}`); }
  for(const e of errs) console.log('! ' + e);
  const outPath = (args.find(a => a.startsWith('--out=')) || '--out=docs/text-audit-en.json').slice(6);
  fs.writeFileSync(path.resolve(ROOT, outPath), JSON.stringify({ date:new Date().toISOString().slice(0, 10), games, sizes:SIZES.map(s => s.name), screens:STEPS.map(s => s[0]), overflow:found, dict:dict.out, koLeft, errors:errs }, null, 1));
  console.log(all.length ? `\n넘침·글자 수 초과 ${all.length}건 (${outPath})` : `\n넘침 0건 · 글자 수 초과 0건 (${outPath})`);
  srv.close();
  process.exit(all.length || errs.length ? 1 : 0);
}
if(args.includes('--en')) await enAudit();

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
