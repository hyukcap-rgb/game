// 디자인 검수(테스트팀): 사이트 홈 화면을 휴대폰 폭·테마별로 열어 글자 잘림·화면 밖 넘침·겹침을 자동으로 찾고 스크린샷을 남긴다.
// 사용: node tools/design-audit.mjs [출력폴더]   (기본 ./audit-shots)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || 'audit-shots'); fs.mkdirSync(OUT, { recursive:true });
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/index.html`;
const THEMES = (process.env.THEMES || 'neon,ticket,jelly,classic').split(',');
const WIDTHS = (process.env.WIDTHS || '390,360').split(',').map(Number);
const TABS = ['today', 'adv', 'duel', 'league', 'me'];
const wait = ms => new Promise(r => setTimeout(r, ms));

// 화면 안 보이는 요소 빼고, 잘린 글자·넘침·겹친 형제를 찾는다
const PROBE = () => {
  const out = [], vw = innerWidth;
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const name = el => { let s = el.tagName.toLowerCase(); if(el.id) s += '#' + el.id; if(el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); return s; };
  const root = document.querySelector('#home');
  for(const el of root.querySelectorAll('*')){
    if(!vis(el) || el.closest('[hidden]')) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if(el.closest('.dock') === null && (r.right > vw + 1 || r.left < -1) && !el.closest('[style*="overflow"],.fchips,.rpdays,.hscroll,.frrow,.duelfr')) {
      // 가로 스크롤 영역 안은 정상
      let p = el.parentElement, scroller = false; while(p && p !== root){ const ps = getComputedStyle(p); if(/auto|scroll/.test(ps.overflowX)) { scroller = true; break; } p = p.parentElement; }
      if(!scroller) out.push({ kind:'화면 밖', el:name(el), txt:(el.innerText || '').trim().slice(0, 20), r:[Math.round(r.left), Math.round(r.right)] });
    }
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || [...el.children].some(c => /^(SMALL|B|EM|SPAN|I)$/.test(c.tagName) && c.innerText.trim());
    if(!hasText) continue;
    const clipX = /hidden|clip/.test(s.overflowX), clipY = /hidden|clip/.test(s.overflowY);
    if(clipX && el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== 'ellipsis') out.push({ kind:'가로 잘림', el:name(el), txt:el.innerText.trim().slice(0, 24), d:el.scrollWidth - el.clientWidth });
    if(clipY && el.scrollHeight > el.clientHeight + 1 && !/auto|scroll/.test(s.overflowY) && !s.webkitLineClamp?.match(/\d/)) out.push({ kind:'세로 잘림', el:name(el), txt:el.innerText.trim().slice(0, 24), d:el.scrollHeight - el.clientHeight });
    // 자식이 부모(잘라내는) 밖으로 나가는 경우
    for(const c of el.children){ if(!vis(c)) continue; const cr = c.getBoundingClientRect();
      if((clipY && (cr.bottom > r.bottom + 1 || cr.top < r.top - 1)) || (clipX && (cr.right > r.right + 1 || cr.left < r.left - 1))) out.push({ kind:'자식 잘림', el:name(el) + ' > ' + name(c), txt:(c.innerText || '').trim().slice(0, 16) }); }
  }
  // 버튼끼리 겹침(같은 줄 형제)
  const btns = [...root.querySelectorAll('button')].filter(b => vis(b) && !b.closest('[hidden]'));
  for(let i = 0; i < btns.length; i++) for(let j = i + 1; j < btns.length; j++){
    const a = btns[i].getBoundingClientRect(), b = btns[j].getBoundingClientRect();
    if(btns[i].contains(btns[j]) || btns[j].contains(btns[i])) continue;
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if(ox > 4 && oy > 4) out.push({ kind:'버튼 겹침', el:name(btns[i]) + ' ↔ ' + name(btns[j]) });
  }
  // 작은 글씨(12px 미만)
  for(const el of root.querySelectorAll('*')){ if(!vis(el) || el.closest('[hidden]')) continue; const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(''); if(!t) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if(fs < 12) out.push({ kind:'작은 글씨', el:name(el), txt:t.slice(0, 16), fs }); }
  // 작은 터치(36px 미만)
  for(const b of btns){ const r = b.getBoundingClientRect(); if(r.width < 36 || r.height < 36) out.push({ kind:'작은 터치', el:name(b), wh:[Math.round(r.width), Math.round(r.height)] }); }
  return out;
};

const browser = await chromium.launch();
const report = {};
for(const th of THEMES) for(const w of WIDTHS){
  const page = await browser.newPage({ viewport:{ width:w, height:844 }, deviceScaleFactor:2 });
  await page.addInitScript(t => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:theme', JSON.stringify(t)); localStorage.setItem('hp:age19', '1'); }catch(_){} }, th);
  await page.goto(BASE); await wait(1500);
  await page.evaluate(() => { try{ closeModal(); }catch(_){} document.querySelectorAll('.modal,.sheet').forEach(m => m.classList.remove('on')); });
  for(const tab of TABS){
    await page.evaluate(t => { const b = document.querySelector(`.dock [data-tab="${t}"]`); b && b.click(); scrollTo(0, 0); }, tab); await wait(500);
    const issues = await page.evaluate(PROBE);
    const key = `${th}-${w}-${tab}`; report[key] = issues;
    await page.screenshot({ path:path.join(OUT, key + '.png'), fullPage:true });
  }
  await page.close();
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const uniq = {};
for(const [k, list] of Object.entries(report)) for(const it of list){ const id = it.kind + ' | ' + it.el + ' | ' + (it.txt || ''); (uniq[id] ||= []).push(k); }
for(const [id, ks] of Object.entries(uniq).sort()) console.log(id, '←', ks.length > 4 ? ks.length + '곳' : ks.join(','));
