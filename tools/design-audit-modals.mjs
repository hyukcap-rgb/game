// 디자인 검수(테스트팀) 2: 사이트의 창(모달)들을 테마·폭별로 열어 글자 잘림·화면 밖 넘침을 찾고 스크린샷을 남긴다.
// 사용: node tools/design-audit-modals.mjs [출력폴더]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || 'audit-modals'); fs.mkdirSync(OUT, { recursive:true });
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/index.html`;
const THEMES = (process.env.THEMES || 'neon,ticket,jelly,classic').split(',');
const WIDTHS = (process.env.WIDTHS || '360,390').split(',').map(Number);
const MODALS = {
  heart:'openHeartSheet()', inbox:'openInbox()', settings:'openSettings()', report:'openReport()', share:'openShare(closeModal)', donate:'openDonateInfo()',
  grow:'openGrow()', badges:'openBadges()', friends:'frHub()', rooms:"rmList('fox')", help:"openHelp('fox')", advmap:"openAdvMap('fox')", invite:'viralShare(cardInvite(), closeModal)',
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const PROBE = () => {
  const out = [], vw = innerWidth, root = document.querySelector('#modal');
  if(!root || !root.offsetParent) return [{ kind:'창 안 열림' }];
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = el => { let s = el.tagName.toLowerCase(); if(el.id) s += '#' + el.id; if(typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); return s; };
  const mr = root.getBoundingClientRect(); if(mr.right > vw + 1 || mr.left < -1) out.push({ kind:'창이 화면 밖', w:Math.round(mr.width) });
  for(const el of root.querySelectorAll('*')){
    if(!vis(el) || el.closest('svg')) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    let p = el.parentElement, scroller = false; while(p && p !== root){ if(/auto|scroll/.test(getComputedStyle(p).overflowX)){ scroller = true; break; } p = p.parentElement; }
    if(!scroller && (r.right > mr.right + 2 || r.left < mr.left - 2)) out.push({ kind:'창 밖 넘침', el:name(el), txt:(el.innerText || '').trim().slice(0, 18) });
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if(!hasText) continue;
    if(/hidden|clip/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== 'ellipsis') out.push({ kind:'가로 잘림', el:name(el), txt:el.innerText.trim().slice(0, 20) });
    if(/hidden|clip/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push({ kind:'세로 잘림', el:name(el), txt:el.innerText.trim().slice(0, 20) });
    if(s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push({ kind:'말줄임(…)', el:name(el), txt:el.innerText.trim().slice(0, 20) });
    if(parseFloat(s.fontSize) < 12) out.push({ kind:'작은 글씨', el:name(el), txt:el.innerText.trim().slice(0, 12), fs:s.fontSize });
    // 대비: 글자색과 가장 가까운 불투명 배경
    const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
    let bgEl = el, bg = null; while(bgEl){ const b = getComputedStyle(bgEl); const c = rgb(b.backgroundColor); if(b.backgroundImage !== 'none'){ bg = null; break; } if(c.length >= 3 && (c[3] === undefined || c[3] > .9)){ bg = c; break; } bgEl = bgEl.parentElement; }
    if(bg){ const L = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
      const fg = rgb(s.color), a = L(fg), b = L(bg), cr = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if((fg[3] === undefined || fg[3] > .5) && cr < 3) out.push({ kind:'대비 낮음', el:name(el), txt:el.innerText.trim().slice(0, 14), cr:+cr.toFixed(2) }); }
  }
  for(const b of root.querySelectorAll('button')){ if(!vis(b)) continue; const r = b.getBoundingClientRect(); if(r.width < 32 || r.height < 32) out.push({ kind:'작은 터치', el:name(b), txt:b.innerText.trim().slice(0, 10), wh:[Math.round(r.width), Math.round(r.height)] }); }
  return out;
};
const browser = await chromium.launch();
const report = {};
for(const th of THEMES) for(const w of WIDTHS){
  const page = await browser.newPage({ viewport:{ width:w, height:800 }, deviceScaleFactor:2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(t => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:theme', JSON.stringify(t)); localStorage.setItem('hp:age19', '1'); }catch(_){} }, th);
  await page.goto(BASE); await wait(1500);
  for(const [k, code] of Object.entries(MODALS)){
    await page.evaluate(() => { try{ closeModal(); }catch(_){} });
    await wait(150);
    try{ await page.evaluate(code); }catch(e){ report[`${th}-${w}-${k}`] = [{ kind:'열기 오류', txt:String(e).slice(0, 80) }]; continue; }
    await wait(600);
    report[`${th}-${w}-${k}`] = await page.evaluate(PROBE);
    await page.screenshot({ path:path.join(OUT, `${th}-${w}-${k}.png`) });
  }
  if(errs.length) report[`${th}-${w}-errors`] = errs.map(e => ({ kind:'페이지 오류', txt:e.slice(0, 100) }));
  await page.close();
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const uniq = {};
for(const [k, list] of Object.entries(report)) for(const it of list){ const id = [it.kind, it.el, (it.txt || '').replace(/\n/g, ' '), it.cr || it.wh || it.fs || ''].join(' | '); (uniq[id] ||= []).push(k); }
for(const [id, ks] of Object.entries(uniq).sort()) console.log(id, '←', ks.length > 3 ? ks.length + '곳 ' + ks.slice(0, 3).join(',') : ks.join(','));
