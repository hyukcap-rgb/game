// 테스트팀 정밀 디자인 검수 (2026-10-18)
// - 진짜 웹폰트를 내려받아(프록시가 있으면 경유) 실제 폰과 같은 글꼴로 그린 뒤 검사한다. (예전 검수는 웹폰트 없이 대체 글꼴로 그려 로고 잘림을 놓쳤음)
// - 화면: 홈 5탭 · 창 13종(테마 4종 × 폭) + 게임 플레이 화면 전부 + 결과 창
// - 검사: ①글꼴(웹폰트 미적용·종류 수) ②글자 크기(13px 미만·크기 종류 수) ③글자 잘림(박스·글자 획) ④가림(다른 요소/고정 메뉴에 덮임)
//         ⑤대비(그라데이션 바탕 포함) ⑥테마 새는 색(네온·티켓·젤리에 밤하늘 색) ⑦배치(같은 줄 버튼 높이 들쭉날쭉·붙음·작은 터치·머리줄 겹침·화면 밖)
// 사용: node tools/design-audit-deep.mjs [출력폴더]   환경변수 THEMES, WIDTHS, GAMES=0(게임 화면 건너뛰기)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright'; import { execFileSync } from 'node:child_process'; import crypto from 'node:crypto';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || 'audit-deep'); fs.mkdirSync(OUT, { recursive:true });
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.mp3':'audio/mpeg' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/index.html`;
const THEMES = (process.env.THEMES || 'neon,ticket,jelly,classic').split(',');
const WIDTHS = (process.env.WIDTHS || '360,390,430').split(',').map(Number);
const ALLG = fs.readdirSync(path.join(ROOT, 'games')).filter(d => fs.existsSync(path.join(ROOT, 'games', d, 'game.json')));
const TABS = ['today', 'adv', 'duel', 'league', 'me'];
const MODALS = {
  heart:'openHeartSheet()', inbox:'openInbox()', settings:'openSettings()', report:'openReport()', share:'openShare(closeModal)', donate:'openDonateInfo()',
  grow:'openGrow()', badges:'openBadges()', friends:'frHub()', rooms:"rmList('fox')", help:"openHelp('fox')", advmap:"openAdvMap('fox')", invite:'viralShare(cardInvite(), closeModal)',
};
const wait = ms => new Promise(r => setTimeout(r, ms));

/* 페이지 안에서 도는 검사. scope: 검사할 뿌리 선택자, theme: 지금 테마 */
const PROBE = ({ scope, theme }) => {
  const out = [], vw = innerWidth, vh = innerHeight, root = document.querySelector(scope);
  if(!root) return [{ k:'뿌리 없음', el:scope }];
  const CS = el => getComputedStyle(el);
  const vis = el => { const r = el.getBoundingClientRect(), s = CS(el); return r.width > 0.5 && r.height > 0.5 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && !el.closest('[hidden]'); };
  const name = el => { let s = el.tagName.toLowerCase(); if(el.id) s += '#' + el.id; if(typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); const p = el.parentElement; if(p && !el.id){ let ps = p.tagName.toLowerCase(); if(p.id) ps += '#' + p.id; else if(typeof p.className === 'string' && p.className.trim()) ps += '.' + p.className.trim().split(/\s+/)[0]; s = ps + '>' + s; } return s; };
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  const txt = el => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22);
  const rgb = c => { const m = (c || '').match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hexs = s => (s.match(/rgba?\([^)]+\)/g) || []).map(rgb).filter(c => c && (c[3] === undefined || c[3] > .5));
  const inScroller = el => { let p = el.parentElement; while(p && p !== document.body){ const s = CS(p); if(/auto|scroll/.test(s.overflowX) || /auto|scroll/.test(s.overflowY)) return p; p = p.parentElement; } return null; };
  const els = [...root.querySelectorAll('*')].filter(el => !el.closest('svg') && vis(el));
  const texts = els.filter(el => ownText(el));

  /* ① 글꼴 */
  const fams = new Map();
  for(const el of texts){ const s = CS(el); const first = s.fontFamily.split(',')[0].trim().replace(/["']/g, '');
    const generic = /^(system-ui|sans-serif|serif|monospace|-apple-system)$/.test(first);
    const loaded = generic || document.fonts.check(`${s.fontWeight} ${s.fontSize} "${first}"`, ownText(el).slice(0, 4));
    const key = first + ' ' + s.fontWeight; fams.set(key, (fams.get(key) || 0) + 1);
    if(!loaded) out.push({ k:'웹폰트 미적용', el:name(el), t:txt(el), v:first });
    if(/Apple SD Gothic|Malgun|system-ui|sans-serif|Noto Sans CJK/.test(first)) out.push({ k:'기본 글꼴로 나옴', el:name(el), t:txt(el), v:first });
  }
  /* ② 글자 크기 */
  const sizes = new Map();
  for(const el of texts){ const fs = parseFloat(CS(el).fontSize); sizes.set(Math.round(fs * 2) / 2, (sizes.get(Math.round(fs * 2) / 2) || 0) + 1);
    if(fs < 13) out.push({ k:'글자 13px 미만', el:name(el), t:txt(el), v:fs }); }
  out.push({ k:'#글꼴 목록', v:[...fams].sort((a, b) => b[1] - a[1]).map(([f, n]) => f + '×' + n).join(', ') });
  out.push({ k:'#크기 목록', v:[...sizes].sort((a, b) => a[0] - b[0]).map(([f, n]) => f + 'px×' + n).join(' ') });

  /* ③ 글자 잘림: 박스 넘침 + 글자 줄이 잘라내는 조상 박스 밖으로 나감 + 획 잘림 위험(줄 높이 좁은데 overflow hidden) */
  for(const el of texts){
    const s = CS(el);
    if(/hidden|clip/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1){
      out.push({ k:s.textOverflow === 'ellipsis' ? '말줄임(…)으로 잘림' : '가로로 잘림', el:name(el), t:txt(el), v:el.scrollWidth - el.clientWidth });
    }
    if(/hidden|clip/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1 && !/\d/.test(s.webkitLineClamp || '')) out.push({ k:'세로로 잘림', el:name(el), t:txt(el), v:el.scrollHeight - el.clientHeight });
    const fs = parseFloat(s.fontSize), lh = s.lineHeight === 'normal' ? fs * 1.2 : parseFloat(s.lineHeight);
    let p = el, clipper = null; while(p && p !== root.parentElement){ const ps = CS(p); if(/hidden|clip/.test(ps.overflowY) || /hidden|clip/.test(ps.overflow)){ clipper = p; break; } p = p.parentElement; }
    if(clipper){
      const cr0 = clipper.getBoundingClientRect(), rg = document.createRange();
      for(const n of el.childNodes){ if(n.nodeType !== 3 || !n.textContent.trim()) continue; rg.selectNodeContents(n);
        for(const r of rg.getClientRects()){ const ink = (fs * 1.15 - (r.height)) / 2;   /* 굵은 한글 글꼴은 글자 획이 줄 박스보다 위아래로 조금 나감 */
          if(r.bottom + Math.max(0, ink) > cr0.bottom + 1 || r.top - Math.max(0, ink) < cr0.top - 1){ if(!inScroller(el) || clipper !== inScroller(el)) out.push({ k:'글자 획 잘림', el:name(el), t:txt(el), v:'by ' + name(clipper) }); break; }
          if(r.right > cr0.right + 1 && s.textOverflow !== 'ellipsis' && clipper !== inScroller(el)){ out.push({ k:'글자 옆 잘림', el:name(el), t:txt(el), v:'by ' + name(clipper) }); break; } } }
    }
    if(lh < fs * 1.1 && /hidden|clip/.test(s.overflow) && s.display !== 'inline') out.push({ k:'줄 높이 좁고 잘라냄(획 잘림 위험)', el:name(el), t:txt(el), v:(lh / fs).toFixed(2) });
  }

  /* ④ 가림: 글자·버튼의 여러 점을 찍어 맨 위가 자기 자신(또는 자식)인지 */
  const dock = document.querySelector('.dock'); const dockR = dock && vis(dock) ? dock.getBoundingClientRect() : null;
  for(const el of els.filter(e => ownText(e) || e.tagName === 'BUTTON')){
    const r = el.getBoundingClientRect(); if(r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const sc = inScroller(el); const scr = sc ? sc.getBoundingClientRect() : null;
    const pts = [[.5, .5], [.15, .5], [.85, .5]];
    let hidden = 0, by = null;
    for(const [fx, fy] of pts){ const x = r.left + r.width * fx, y = r.top + r.height * fy; if(x < 0 || x >= vw || y < 0 || y >= vh) continue;
      if(scr && (x < scr.left || x > scr.right || y < scr.top || y > scr.bottom)) continue;
      const top = document.elementFromPoint(x, y); if(!top || el.contains(top) || top.contains(el)) continue;
      if(el.closest('button') && el.closest('button').contains(top)) continue;
      if(dock && dock.contains(top) && !dock.contains(el)) continue;   /* 고정 메뉴 밑으로 스크롤되는 건 아래에서 따로 봄 */
      hidden++; by = top; }
    if(hidden >= 2) out.push({ k:'다른 요소에 가려짐', el:name(el), t:txt(el), v:'by ' + name(by) });
  }
  /* 맨 아래까지 내렸을 때 마지막 내용이 고정 메뉴(독)에 가리는지 */
  if(dockR && scope === '#home'){
    const pane = [...root.querySelectorAll('.pane')].find(p => !p.hidden);
    if(pane){ const last = [...pane.querySelectorAll('*')].filter(e => vis(e) && ownText(e)).pop();
      if(last){ const before = scrollY; scrollTo(0, document.documentElement.scrollHeight); const lr = last.getBoundingClientRect(), dr = dock.getBoundingClientRect(); if(lr.bottom > dr.top - 4) out.push({ k:'맨 아래 내용이 메뉴(독)에 가려짐', el:name(last), t:txt(last), v:Math.round(lr.bottom - dr.top) }); scrollTo(0, before); } }
  }

  /* ⑤ 대비: 가장 가까운 바탕(단색·그라데이션 색 전부) 대비 최저값 */
  for(const el of texts){
    const s = CS(el), fg = rgb(s.color); if(!fg || (fg[3] !== undefined && fg[3] < .5)) continue;
    if(parseFloat(s.webkitTextStrokeWidth) >= 2) continue;
    let p = el, bgs = null; while(p){ const ps = CS(p); const img = ps.backgroundImage; const c = rgb(ps.backgroundColor);
      if(img && img !== 'none' && /gradient/.test(img)){ const st = hexs(img); if(st.length){ bgs = st; break; } }
      else if(img && img !== 'none'){ bgs = null; break; }
      if(c && (c[3] === undefined || c[3] > .85)){ bgs = [c]; break; } p = p.parentElement; }
    if(!bgs) continue;
    const fs = parseFloat(s.fontSize), bold = +s.fontWeight >= 700 || /Han Sans|Do Hyeon|Jua/.test(s.fontFamily);
    const need = fs >= 18 || (fs >= 14 && bold) ? 3 : 4.5;
    const min = Math.min(...bgs.map(b => cr(fg, b)));
    if(min < need) out.push({ k:'글자 대비 부족', el:name(el), t:txt(el), v:min.toFixed(2) + '<' + need });
  }

  /* ⑥ 테마 새는 색: 네온·티켓·젤리 화면에 밤하늘(기본) 전용 색이 남은 곳 */
  if(theme !== 'classic'){
    const CLASSIC = ['14,7,48', '142,15,79', '255,248,234', '23,12,69', '18,79,146', '255,240,194', '26,15,69', '108,60,224', '98,54,214', '74,51,168', '44,28,124', '233,220,192', '183,162,122', '251,235,203', '28,18,80', '36,21,99', '207,197,255', '255,227,90', '231,221,255', '255,241,218', '220,207,180', '168,150,111', '11,5,38'];
    const PAL = { neon:['11,15,42', '22,27,69', '33,39,92', '58,68,160'], ticket:['43,27,18'], jelly:['42,35,64'] }[theme] || [];
    for(const el of els){ const s = CS(el);
      const props = { 글자:s.color, 바탕:s.backgroundColor + ' ' + s.backgroundImage, 테두리:s.borderTopWidth !== '0px' ? s.borderTopColor : '', 그림자:s.boxShadow };
      for(const [k, v] of Object.entries(props)){ if(!v) continue; const hit = (v.match(/rgba?\(([^)]+)\)/g) || []).map(x => x.match(/\d+/g).slice(0, 3).join(',')).find(c => CLASSIC.includes(c) && !PAL.includes(c));
        if(hit){ out.push({ k:'테마에 밤하늘 색이 남음', el:name(el), t:txt(el), v:k + ' rgb(' + hit + ')' }); break; } } }
  }

  /* ⑦ 배치 */
  const btns = els.filter(e => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button');
  for(const b of btns){ const r = b.getBoundingClientRect(); if(r.width < 40 || r.height < 40) out.push({ k:'누르기 작은 버튼(40px 미만)', el:name(b), t:txt(b), v:Math.round(r.width) + 'x' + Math.round(r.height) });
    if(!inScroller(b) && (r.right > vw + 1 || r.left < -1)) out.push({ k:'버튼이 화면 밖', el:name(b), t:txt(b) }); }
  /* 같은 부모 안 같은 줄 버튼들: 높이 들쭉날쭉 · 너무 붙음 · 겹침 */
  const byParent = new Map(); for(const b of btns){ const p = b.parentElement; if(!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(b); }
  for(const [p, list] of byParent){ if(list.length < 2) continue; const rs = list.map(b => [b, b.getBoundingClientRect()]);
    for(let i = 0; i < rs.length; i++) for(let j = i + 1; j < rs.length; j++){ const [a, ra] = rs[i], [b, rb] = rs[j];
      const sameRow = Math.abs((ra.top + ra.bottom) / 2 - (rb.top + rb.bottom) / 2) < Math.min(ra.height, rb.height) / 2;
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if(ox > 2 && oy > 2) out.push({ k:'버튼끼리 겹침', el:name(a) + ' ↔ ' + name(b), t:txt(a) + ' / ' + txt(b) });
      else if(sameRow && Math.abs(ra.height - rb.height) > 4 && getComputedStyle(p).display !== 'block') out.push({ k:'같은 줄 버튼 높이 다름', el:name(p), t:txt(a) + ' / ' + txt(b), v:Math.round(ra.height) + ' vs ' + Math.round(rb.height) });
      else if(sameRow && ox < 0 && ox > -4) out.push({ k:'버튼 간격 너무 좁음', el:name(p), t:txt(a) + ' / ' + txt(b), v:Math.round(-ox) + 'px' }); } }
  /* 머리줄(hud) 안 요소끼리 겹침 */
  const hud = root.querySelector('.hud'); if(hud && vis(hud)){ const kids = [...hud.children].filter(vis).map(e => [e, e.getBoundingClientRect()]);
    for(let i = 0; i < kids.length; i++) for(let j = i + 1; j < kids.length; j++){ const a = kids[i][1], b = kids[j][1]; const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if(ox > 1 && oy > 1) out.push({ k:'머리줄 요소 겹침', el:name(kids[i][0]) + ' ↔ ' + name(kids[j][0]), v:Math.round(ox) + 'px' }); } }
  /* 전체 가로 넘침(옆으로 밀리는 화면) */
  if(document.documentElement.scrollWidth > vw + 1) out.push({ k:'화면이 옆으로 밀림(가로 스크롤)', v:document.documentElement.scrollWidth - vw });
  return out;
};

/* 웹폰트: 브라우저가 바깥 인터넷에 못 나가는 환경이 있어 구글 폰트 요청을 curl로 받아(캐시) 대신 돌려준다 → 실제 폰과 같은 글꼴로 검사 */
const FCACHE = path.join(OUT, '.fontcache'); fs.mkdirSync(FCACHE, { recursive:true });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
function fetchCached(url){ const f = path.join(FCACHE, crypto.createHash('md5').update(url).digest('hex'));
  if(!fs.existsSync(f)) execFileSync('curl', ['-sS', '-m', '30', '-A', UA, '-o', f, url]); return fs.readFileSync(f); }
async function fontRoutes(ctx){
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async route => { try{ const u = route.request().url(); const body = fetchCached(u);
    await route.fulfill({ status:200, body, headers:{ 'content-type':/googleapis/.test(u) ? 'text/css' : 'font/woff2', 'access-control-allow-origin':'*' } }); }catch(e){ await route.abort(); } });
}
const browser = await chromium.launch();
const report = {};
async function newPage(th, w){
  const ctx = await browser.newContext({ viewport:{ width:w, height:844 }, deviceScaleFactor:2, ignoreHTTPSErrors:true, hasTouch:true, isMobile:true });
  await fontRoutes(ctx); const page = await ctx.newPage(); page.__errs = []; page.on('pageerror', e => page.__errs.push(String(e).slice(0, 120)));
  await page.addInitScript(t => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:theme', JSON.stringify(t)); localStorage.setItem('hp:age19', '1'); }catch(_){} }, th);
  await page.goto(BASE); await wait(1500); await page.evaluate(() => document.fonts.ready);
  const fontsOk = await page.evaluate(() => ['Black Han Sans', 'Do Hyeon', 'Noto Sans KR', 'IBM Plex Sans KR', 'Jua', 'Gowun Dodum'].map(f => f + ':' + document.fonts.check(`16px "${f}"`, '가')));
  return [page, ctx, fontsOk];
}
async function shot(page, key, full){ await page.screenshot({ path:path.join(OUT, key + '.png'), fullPage:!!full }); }
for(const th of THEMES) for(const w of WIDTHS){
  const [page, ctx, fontsOk] = await newPage(th, w);
  report[`${th}-${w}-fonts`] = [{ k:'#웹폰트 로딩', v:fontsOk.join(' ') }];
  for(const tab of TABS){
    await page.evaluate(t => { try{ closeModal(); }catch(_){} const b = document.querySelector(`.dock [data-tab="${t}"]`); b && b.click(); scrollTo(0, 0); }, tab); await wait(450);
    report[`${th}-${w}-${tab}`] = await page.evaluate(PROBE, { scope:'#home', theme:th });
    await shot(page, `${th}-${w}-${tab}`, true);
  }
  for(const [k, code] of Object.entries(MODALS)){
    await page.evaluate(() => { try{ closeModal(); }catch(_){} scrollTo(0, 0); }); await wait(120);
    try{ await page.evaluate(code); }catch(e){ report[`${th}-${w}-m-${k}`] = [{ k:'창 열기 오류', v:String(e).slice(0, 80) }]; continue; }
    await wait(550);
    report[`${th}-${w}-m-${k}`] = await page.evaluate(PROBE, { scope:'#modal', theme:th });
    await shot(page, `${th}-${w}-m-${k}`);
  }
  if(page.__errs.length) report[`${th}-${w}-errors`] = page.__errs.map(e => ({ k:'페이지 오류', v:e }));
  await ctx.close();
}
/* 게임 플레이 화면 + 결과 창 (테마와 무관: body[data-mode]) */
if(process.env.GAMES !== '0') for(const w of [360, 390]){
  const [page, ctx] = await newPage('neon', w);
  for(const g of ALLG){
    try{
      await page.evaluate(g => { try{ closeModal(); goHome(); }catch(_){} startGame(g, 'normal'); }, g); await wait(1300);
      await page.evaluate(() => { try{ closeModal(); }catch(_){} });   /* 첫 도움말 닫기 */
      await wait(300);
      report[`game-${w}-${g}`] = await page.evaluate(PROBE, { scope:'#play', theme:'classic' });
      await shot(page, `game-${w}-${g}`);
      await page.evaluate(() => { try{ finish(true); }catch(_){} }); await wait(900);
      report[`game-${w}-${g}-result`] = await page.evaluate(PROBE, { scope:'#modal', theme:'classic' });
      await shot(page, `game-${w}-${g}-result`);
    }catch(e){ report[`game-${w}-${g}`] = [{ k:'게임 열기 오류', v:String(e).slice(0, 100) }]; }
  }
  if(page.__errs.length) report[`game-${w}-errors`] = page.__errs.map(e => ({ k:'페이지 오류', v:e }));
  await ctx.close();
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
/* 요약: 종류별 → 같은 요소끼리 묶어 어느 화면에서 나왔는지 */
const kinds = {};
for(const [scr, list] of Object.entries(report)) for(const it of list){ if(it.k.startsWith('#')) continue; const id = `${it.el || ''} | ${it.t || ''} | ${it.v ?? ''}`; ((kinds[it.k] ||= {})[id] ||= []).push(scr); }
let md = '# 정밀 디자인 검수 결과\n';
for(const [k, ids] of Object.entries(kinds)){ md += `\n## ${k} (${Object.keys(ids).length}종)\n`; for(const [id, scrs] of Object.entries(ids).sort((a, b) => b[1].length - a[1].length)) md += `- ${id} ← ${scrs.length > 4 ? scrs.length + '곳: ' + scrs.slice(0, 4).join(', ') + ' …' : scrs.join(', ')}\n`; }
fs.writeFileSync(path.join(OUT, 'summary.md'), md);
console.log(Object.entries(kinds).map(([k, ids]) => `${k}: ${Object.keys(ids).length}종`).join('\n'));
