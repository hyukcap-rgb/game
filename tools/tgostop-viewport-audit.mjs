/* 트럼프 고스톱 해상도 점검(2026-10-22 사용자 지시: 모바일·PC 어떤 해상도에서도 잘림·넘침 없이)
   쓰는 법: node tools/build.js 다음에 node tools/tgostop-viewport-audit.mjs [--shots 폴더] [--result] [--only 이름,이름]
   화면: 19세 확인 → 게임 방법 → 판 고르기 → 판(내 차례) → (--result면) 결과 창. 해상도마다 사진과 문제 목록.
   문제 규칙:
   - 가로 스크롤(문서가 화면보다 넓음)
   - 버튼·링크가 화면 밖으로 나감(세로로 스크롤되는 상자 안이면 세로는 괜찮음)
   - 글자가 잘림(넘침 숨김 상자에서 글이 칸보다 넓음 / 줄임표)
   - 터치 기기에서 누르는 칸이 24px보다 작음
   - 게임 판(#gsb)이 화면 밖으로 나감
   - 페이지 오류(콘솔 오류) */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SHOTS = arg('--shots'); const RESULT = process.argv.includes('--result');
const ONLY = (arg('--only') || '').split(',').filter(Boolean);
const URL0 = pathToFileURL(path.resolve('embed/tgostop.html')).href + '?mode=menu';
if(SHOTS) fs.mkdirSync(SHOTS, { recursive:true });

const VP = [
  ['폰-작은세로', 360, 640, 'm'], ['폰-SE', 375, 667, 'm'], ['폰-세로', 390, 844, 'm'], ['폰-큰세로', 430, 932, 'm'],
  ['폰-작은가로', 640, 360, 'm'], ['폰-가로', 844, 390, 'm'], ['폰-큰가로', 932, 430, 'm'],
  ['폴드-펼침', 712, 840, 'm'], ['태블릿-세로', 768, 1024, 'm'], ['태블릿-가로', 1024, 768, 'm'], ['태블릿-큰', 1366, 1024, 'm'],
  ['PC-720p', 1280, 720, 'p'], ['스팀덱', 1280, 800, 'p'], ['PC-노트북', 1366, 768, 'p'], ['PC-1600', 1600, 900, 'p'],
  ['PC-1080p', 1920, 1080, 'p'], ['PC-울트라와이드', 2560, 1080, 'p'], ['PC-1440p', 2560, 1440, 'p'], ['PC-4K', 3840, 2160, 'p'],
  ['PC-작은창', 960, 540, 'p'], ['PC-세로모니터', 1080, 1920, 'p']
].filter(v => !ONLY.length || ONLY.includes(v[0]));

const w = ms => new Promise(r => setTimeout(r, ms));
function check(touch){
  const out = [], vw = innerWidth, vh = innerHeight, de = document.documentElement;
  if(de.scrollWidth > vw + 1) out.push(`가로 스크롤 ${de.scrollWidth}>${vw}`);
  const vis = el => { const s = getComputedStyle(el); if(s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && !el.closest('[hidden]'); };
  const docScroll = (() => { const se = document.scrollingElement, hs = getComputedStyle(document.documentElement).overflowY, bs = getComputedStyle(document.body).overflowY; return se.scrollHeight > se.clientHeight + 1 && hs !== 'hidden' && bs !== 'hidden' && hs !== 'clip' && bs !== 'clip'; })();
  const scrollY = el => { if(docScroll && !el.closest('[style*="position: fixed"]')) return document.scrollingElement; for(let p = el.parentElement; p; p = p.parentElement){ const s = getComputedStyle(p); if(/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return p; } return null; };
  const name = el => (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  for(const el of document.querySelectorAll('button, a[href], [role=button], input, select')){
    if(!vis(el)) continue;
    if(el.closest('#gsb')) continue;   /* 판 안은 판 전체로 따로 봄(돌리기·크기 맞춤) */
    const r = el.getBoundingClientRect();
    if(r.left < -1 || r.right > vw + 1) out.push('버튼 가로로 밖: ' + name(el));
    else if((r.top < -1 || r.bottom > vh + 1) && !scrollY(el)) out.push('버튼 세로로 밖(스크롤 안 됨): ' + name(el));
    if(touch && (r.width < 24 || r.height < 24)) out.push(`누르는 칸 작음 ${Math.round(r.width)}×${Math.round(r.height)}: ` + name(el));
  }
  for(const el of document.querySelectorAll('body *')){
    if(!vis(el) || el.closest('svg') || el.closest('#gsb')) continue;
    const s = getComputedStyle(el);
    const clipX = /(hidden|clip)/.test(s.overflowX) || s.textOverflow === 'ellipsis';
    if(clipX && el.scrollWidth > el.clientWidth + 2 && el.innerText && el.innerText.trim() && el.children.length < 4) out.push(`글 잘림(가로 ${el.scrollWidth}>${el.clientWidth}): ` + name(el));
    const clipY = /(hidden|clip)/.test(s.overflowY);
    if(clipY && el.scrollHeight > el.clientHeight + 4 && el.innerText && el.innerText.trim() && el.children.length < 4 && !/(auto|scroll)/.test(s.overflowY)) out.push(`글 잘림(세로 ${el.scrollHeight}>${el.clientHeight}): ` + name(el));
  }
  try{ if(!touch && G && G.gs && G.gs.rot) out.push('마우스 PC인데 판이 90도 돌아감(돌릴 수 없는 화면)'); }catch(_){}
  try{ if(touch && G && G.gs && G.gs.S && vh > vw * 1.05 && !G.gs.rot) out.push('휴대폰 세로인데 판이 안 돌아감'); }catch(_){}
  const b = document.querySelector('#gsb');
  if(b && vis(b)){ const r = b.getBoundingClientRect(); if(r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2) out.push(`판이 화면 밖 ${Math.round(r.left)},${Math.round(r.top)}~${Math.round(r.right)},${Math.round(r.bottom)} / ${vw}×${vh}`); }
  return [...new Set(out)];
}

const br = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
let total = 0; const report = [];
for(const [nm, vw, vh, kind] of VP){
  const touch = kind === 'm';
  const ctx = await br.newContext({ viewport:{ width:vw, height:vh }, deviceScaleFactor:vw >= 2560 ? 1 : touch ? 2 : 1, isMobile:touch, hasTouch:touch });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  pg.on('console', m => { if(m.type() === 'error' && !/WebSocket|favicon|net::/.test(m.text())) errs.push(m.text().slice(0, 120)); });
  await pg.addInitScript(() => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:tg:pt', JSON.stringify({ pt:12000, peak:12000, att:'', streak:0, ach:{}, games:0, wins:0 })); }catch(_){} });
  await pg.goto(URL0); await w(700);
  const shots = {};
  const snap = async k => { const p = await pg.evaluate(check, touch); shots[k] = p; if(SHOTS) await pg.screenshot({ path:path.join(SHOTS, `${nm}-${k}.png`) }); };
  await snap('1첫화면');
  await pg.evaluate(() => { try{ closeModal(); }catch(_){} startGame('tgostop', 'normal'); }); await w(900);
  for(const id of ['#mGo', '#gsAgeY']) if(await pg.$(id + ':visible')){ await snap('2나이확인'); await pg.click(id); await w(1800); }
  if(await pg.$('.modal:not([hidden]), .ov.show, [role=dialog]')){ await snap('3게임방법'); }
  for(const t of ['text=시작하기', 'text=확인', '.modal button.primary']){ try{ await pg.click(t, { timeout:800 }); await w(500); break; }catch(_){} }
  await w(600); await snap('4판고르기');
  await pg.evaluate(() => { const b = document.querySelector('#gsLobby:not([hidden]) [data-r="0"]'); if(b) b.click(); });
  await pg.waitForFunction(() => { const g = G && G.gs; return g && g.S && g.phase === 'play' && g.S.turn === g.me && !g.busy; }, null, { timeout:20000 }).catch(() => {});
  await w(500); await snap('5판');
  if(RESULT){
    const t0 = Date.now();
    while(Date.now() - t0 < 120000){
      const s = await pg.evaluate(() => {
        if(!G || !G.gs) return 'nogame'; if(G.over) return 'over';
        const ask = document.querySelector('#gsAsk:not([hidden])');
        if(ask){ if(ask.querySelector('#gsEndOk')) return 'end'; const st = ask.querySelector('button.stop'); if(st){ st.click(); return 'gs'; } const bs = [...ask.querySelectorAll('[data-i]')]; if(bs.length){ bs[bs.length - 1].click(); return 'ask'; } return 'wait'; }
        const g = G.gs; if(!g.S || g.phase !== 'play' || g.busy || g.picking || g.S.turn !== g.me || g.S.pendingGS >= 0) return 'wait';
        const c = document.querySelector('#gsHand .gs-c.hd.match') || document.querySelector('#gsHand .gs-c.hd'); if(!c) return 'wait'; c.click(); c.click(); return 'play';
      });
      if(s === 'end' || s === 'over') break; await w(s === 'wait' ? 150 : 250);
    }
    await w(1200); await snap('6결과');
  }
  const n = Object.values(shots).reduce((a, b) => a + b.length, 0) + errs.length; total += n;
  report.push(`\n■ ${nm} ${vw}×${vh} — 문제 ${n}`);
  for(const [k, p] of Object.entries(shots)) for(const x of p) report.push(`  [${k}] ${x}`);
  for(const e of errs) report.push('  [오류] ' + e);
  await ctx.close();
}
await br.close();
console.log(report.join('\n'));
console.log(`\n해상도 ${VP.length}개 · 문제 합계 ${total}`);
process.exit(total ? 1 : 0);
