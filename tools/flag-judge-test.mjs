/* 청기 백기(flag) 판정 점검 (Playwright · 테스트팀 2026-10-06)
   node tools/flag-judge-test.mjs [--seeds 6]        (PW_CHROMIUM=/opt/pw-browsers/chromium 이면 그 브라우저로)

   규칙(games/flag/CLAUDE.md 규칙 칸): 이번 명령이 요구하는 동작 = 화면 글자대로 할 때 지금 상태와 달라지는 깃발을 그쪽으로.
   - 요구된 동작이 아닌 누르기는 모두 바로 오답 → 0.4초 안에 다음 명령(이미 그 상태인 깃발·같은 버튼 두 번·가만히 명령에 누르기 포함).
   - 두 개 한꺼번에: 요구된 두 동작은 순서 상관없이 정답, 그 사이 다른 누르기는 오답.
   - 가만히 명령(이미 그 상태·하지 마·흉내쟁이·두 개 모두 이미 그 상태): 아무것도 안 누르고 창이 끝나면 정답.
   - 창이 끝난 뒤(화면 칸이 돌기 전) 온 누르기는 판정에 안 들어간다.
   1) 빠른 점검(같은 함수 press를 바로 부르고 시계는 앞으로 감기): 난이도 3개 + 솔로 개념·변주·보스 판 × 여러 씨앗.
      판마다 (버튼 수 + 안 누름 + 늦게 누름) 번 돌며 명령마다 첫 동작을 하나씩 바꿔 가며 해 본다 → 모든 명령에 모든 첫 동작.
      정답 판단은 게임 속 목표(tgt)가 아니라 **화면 글자(깃발·올려/내려·하지 마·흉내쟁이·반대로)** 와 테스트가 따로 센 깃발 상태로 낸다.
   2) 실제 시간 점검: 진짜 키보드(Q/A/P/L/T/G) · 버튼 누르기(pointerdown) · 밀기로 막 누르기 → 오답 뒤 다음 명령까지 실제 시간 ≤ 0.45초.
   3) 봇: 정답 봇(0.18초) 900점 이상 성공, 막 누르기 봇·안 누르기 봇 실패. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEEDS = +arg('seeds', 6);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const wait = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, msg) => { if(!c){ fail++; console.log('  ✗ ' + msg); } return c; };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if(m.type() === 'error' && !/WebSocket/.test(m.text())) errs.push(m.text()); });
await page.addInitScript(() => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:help:flag', '1'); localStorage.setItem('hp:coach:flag', '1'); }catch(_){} });
await page.goto(BASE + 'index.html'); await wait(700);
await page.evaluate(() => { closeModal(); startGame('flag', 'normal', { seed:'judge' }); });
await wait(300);

/* ---------- 1) 빠른 점검 ---------- */
const CASES = arg('cases', '') ? arg('cases', '').split(',').map(x => isNaN(+x) ? [x] : [+x])
  : [['easy'], ['normal'], ['hard'], [6], [11], [15], [16], [21], [25], [26], [31], [35], [41], [45], [50], [60], ['mix']];
const out = await page.evaluate(({ CASES, SEEDS }) => {
  const FN = { b:'청기', w:'백기', y:'황기' };
  const errs = [], cover = {}, stat = { cmds:0, presses:0, wrong:0, right:0 }, sec = {};
  const bad = m => { if(errs.length < 40) errs.push(m); };
  const cov = (k) => { cover[k] = (cover[k] || 0) + 1; };
  const ff = s => { G.start -= s * 1000; };
  /* 빠른 점검 동안만 효과·소리를 끈다(보이기만 하는 것이라 판정과 무관, 화면 칸 없이 쌓이지 않게) */
  const KEEP = {};
  ['sfx', 'fxEmit', 'fxBurst', 'fxShake', 'fxFlash', 'fxBuzz', 'fxPunch'].forEach(k => { KEEP[k] = window[k]; window[k] = () => {}; });
  const stEl = document.querySelector('#stage'); stEl.style.display = 'none';   /* 그리기 비용 없이(글자·클래스 확인은 그대로 됨) */
  const T0 = performance.now();
  for(const [c] of CASES){
    /* 'mix' = 모든 규칙을 한꺼번에(두 개 한꺼번에 많이 + 노란 깃발 + 반대로 2구간 + 하지 마 + 흉내쟁이) */
    const cfg = typeof c === 'number' ? NG.flag._stage(c) : c === 'mix' ? Object.assign({}, NG.flag._stage(45), { cnt:32, both:true, bothP:1, third:true, flip:true, flipEp:3, neg:true, mimic:true, trap:.3 }) : Object.assign({}, NG.flag.levels[c]);
    const F = cfg.third ? ['b', 'w', 'y'] : ['b', 'w'];
    const OPTS = F.flatMap(f => [[f, 1], [f, 0]]);          /* 버튼 전부 */
    const NOPT = OPTS.length + 2;                            /* + 안 누름 + 창 끝난 뒤 누름 */
    for(let s = 0; s < (c === 'mix' ? SEEDS * 2 : SEEDS); s++){
      for(let pass = 0; pass < NOPT; pass++){
        const name = `${c}#${s}/${pass}`;
        G.over = false; G.paused = false; G.pausedMs = 0; G.start = Date.now();
        NG.flag.init(cfg, mulberry(seedFrom('judge:' + c + ':' + s)));
        renderStage(); cancelAnimationFrame(G.raf);
        const m = G.fl; m.lives = 999;
        const st = { b:0, w:0, y:0 };                         /* 테스트가 따로 세는 깃발 상태 */
        let idx = 0, guard = 0;
        while(!G.over && m.phase !== 'done' && guard++ < 4000){
          if(m.phase !== 'cmd'){ ff(Math.max(0, m.until - elapsed()) + .001); NG.flag._tick(); continue; }
          const q = m.cur, i = idx++;
          /* 화면에 보이는 것 확인 */
          const cmdEl = document.querySelector('#flCmd'), txt = cmdEl ? cmdEl.textContent : '';
          q.parts.forEach(p => { if(!txt.includes(FN[p.f])) bad(`${name} 명령 ${i}: 글자에 ${FN[p.f]} 없음 "${txt}"`); const vb = p.neg ? (p.up ? '올리지 마' : '내리지 마') : (p.up ? '올리' : '내리'); if(!txt.includes(vb) && !(p.up ? txt.includes('올려') : txt.includes('내려'))) bad(`${name} 명령 ${i}: 동사 없음 "${txt}"`); });
          const mim = q.from === 'mimic', bubMim = document.querySelector('#flBub').classList.contains('mimic');
          if(mim !== bubMim) bad(`${name} 명령 ${i}: 흉내쟁이 표시가 다름`);
          const flipShown = document.querySelector('.ng-flag').classList.contains('flipped');
          if(!!q.flip !== flipShown) bad(`${name} 명령 ${i}: 반대로 표시가 다름(${q.flip}/${flipShown})`);
          F.forEach(f => { if(m.my[f] !== st[f]) bad(`${name} 명령 ${i}: 시작 깃발 상태가 다름 ${f} ${m.my[f]}≠${st[f]}`); });
          /* 화면 글자로 낸 요구 동작 */
          const R = [];
          if(!mim) q.parts.forEach(p => { if(p.neg) return; const want = (q.flip ? !p.up : p.up) ? 1 : 0; if(st[p.f] !== want) R.push([p.f, want]); });
          const after = Object.assign({}, st); R.forEach(([f, d]) => { after[f] = d; });
          F.forEach(f => { if(q.tgt[f] !== after[f]) bad(`${name} 명령 ${i}: 게임 목표가 글자와 다름 ${f}`); });
          if((R.length === 0) !== !!q.stay) bad(`${name} 명령 ${i}: 가만히 여부가 다름`);
          const kind = (q.kind === 'single' || q.kind === 'both' ? q.kind : 'stay:' + q.kind) + (q.flip ? '+flip' : '') + (q.parts.some(p => p.f === 'y') ? '+y' : '');
          stat.cmds++;
          const n0 = m.res.length, o = (i + pass) % NOPT;
          const isReq = (f, d) => R.some(r => r[0] === f && r[1] === d);
          const cls = (f, d, done) => isReq(f, d) && !done.some(x => x[0] === f && x[1] === d) ? 'req'
            : done.some(x => x[0] === f && x[1] === d) ? 'dup' : R.some(r => r[0] === f) ? 'wrongDir' : st[f] === d ? 'sameState' : 'otherChange';
          const judged = () => m.res.length > n0;
          const last = () => m.res[m.res.length - 1];
          const checkWrong = (why) => {
            if(!judged()) { bad(`${name} 명령 ${i} [${kind}] ${why}: 오답인데 판정이 안 남(창 끝까지 기다림)`); return; }
            if(last().ok) bad(`${name} 명령 ${i} [${kind}] ${why}: 오답인데 정답으로 셈`);
            if(m.phase !== 'gap' && m.phase !== 'done') bad(`${name} 명령 ${i}: 오답 뒤 간격 아님(${m.phase})`);
            const gap = m.until - elapsed(); if(gap > .401) bad(`${name} 명령 ${i}: 오답 뒤 다음 명령까지 ${gap.toFixed(3)}초`);
            stat.wrong++;
          };
          if(o === OPTS.length){                                 /* 안 누름 → 창 끝 */
            cov(kind + ' 안 누름');
            ff(q.win - (elapsed() - m.t0) + .002); NG.flag._tick();
            if(!judged()) bad(`${name} 명령 ${i}: 창이 끝났는데 판정 없음`);
            else if(!!last().ok !== (R.length === 0)) bad(`${name} 명령 ${i} [${kind}] 안 누름: ${R.length ? '늦었는데 정답' : '참았는데 오답'}`);
          } else if(o === OPTS.length + 1){                      /* 창이 끝난 뒤(화면 칸 전) 누름 */
            cov(kind + ' 늦게 누름');
            const [f, d] = OPTS[(i + s) % OPTS.length];
            ff(q.win - (elapsed() - m.t0) + .002); NG.flag._press(f, d);
            if(!judged()) bad(`${name} 명령 ${i}: 창 끝 누르기 뒤 판정 없음`);
            else { if(!!last().ok !== (R.length === 0)) bad(`${name} 명령 ${i} [${kind}] 창 끝 누르기: 결과가 다름`); if(m.res.length !== n0 + 1) bad(`${name} 명령 ${i}: 창 끝 누르기가 두 번 판정됨`); }
            if(m.phase === 'gap') NG.flag._press(f, d);         /* 간격에 누른 것은 무시 */
            if(m.res.length !== n0 + 1) bad(`${name} 명령 ${i}: 간격 누르기가 판정됨`);
          } else {
            const [f, d] = OPTS[o], c1 = cls(f, d, []);
            cov(kind + ' 첫 동작 ' + c1);
            ff(.05 + (i % 5) * .03); stat.presses++;
            NG.flag._press(f, d);
            if(c1 !== 'req') checkWrong(`첫 동작 ${FN[f]}${d ? '↑' : '↓'}(${c1})`);
            else if(R.length === 1){
              if(!judged() || !last().ok) bad(`${name} 명령 ${i} [${kind}]: 요구 동작인데 정답 아님`); else stat.right++;
            } else {
              if(judged()) bad(`${name} 명령 ${i} [${kind}]: 두 개 중 하나만 했는데 판정됨`);
              /* 두 번째 동작: 명령 종류마다 모든 버튼을 차례로 돌려 가며 */
              const k2 = (sec[kind + OPTS.length] = (sec[kind + OPTS.length] || 0) + 1), [f2, d2] = OPTS[k2 % OPTS.length], c2 = cls(f2, d2, [[f, d]]);
              cov(kind + ' 둘째 동작 ' + c2);
              ff(.04); stat.presses++;
              NG.flag._press(f2, d2);
              if(c2 !== 'req') checkWrong(`둘째 동작 ${FN[f2]}${d2 ? '↑' : '↓'}(${c2})`);
              else if(!judged() || !last().ok) bad(`${name} 명령 ${i} [${kind}]: 두 동작 다 했는데 정답 아님`); else stat.right++;
            }
          }
          /* 판정 뒤 간격에 누른 것은 무시 */
          if(m.phase === 'gap'){ const k = m.res.length; NG.flag._press(OPTS[i % OPTS.length][0], OPTS[i % OPTS.length][1]); if(m.res.length !== k) bad(`${name} 명령 ${i}: 간격 누르기가 판정됨`); }
          Object.assign(st, after);
          F.forEach(f => { if(m.phase === 'gap' && m.my[f] !== st[f]) bad(`${name} 명령 ${i}: 판정 뒤 내 깃발이 정답 상태로 안 맞춰짐`); });
        }
        if(idx !== m.N) bad(`${name}: 명령 ${idx}/${m.N}개만 진행`);
        if(m.res.length !== m.N) bad(`${name}: 판정 ${m.res.length}/${m.N}`);
      }
    }
  }
  G.over = true;
  Object.assign(window, KEEP); stEl.style.display = '';
  stat.ms = Math.round(performance.now() - T0);
  return { errs, cover, stat };
}, { CASES, SEEDS });
console.log(`1) 빠른 점검: 판 ${CASES.length}종 × 씨앗 ${SEEDS} · 명령 ${out.stat.cmds}개 · 누르기 ${out.stat.presses}번(정답 ${out.stat.right} · 바로 오답 ${out.stat.wrong}) · ${(out.stat.ms / 1000).toFixed(1)}초`);
out.errs.forEach(e => ok(false, e));
/* 모든 명령 종류 × 모든 동작 종류가 실제로 나왔는지 */
const kinds = [...new Set(Object.keys(out.cover).map(k => k.replace(/ (안 누름|늦게 누름|첫 동작.*|둘째 동작.*)$/, '')))].sort();
const need = k => k.startsWith('stay:') ? ['안 누름', '늦게 누름', '첫 동작 sameState', '첫 동작 otherChange'].concat(k.includes('neg') || k.includes('mimic') || k.includes('already') || k.includes('both0') ? [] : [])
  : k.startsWith('single') ? ['안 누름', '늦게 누름', '첫 동작 req', '첫 동작 wrongDir', '첫 동작 otherChange', '첫 동작 sameState']
  : ['안 누름', '늦게 누름', '첫 동작 req', '첫 동작 wrongDir', '둘째 동작 req', '둘째 동작 dup', '둘째 동작 wrongDir'];
for(const k of kinds){
  const miss = need(k).filter(x => !out.cover[k + ' ' + x]);
  console.log(`   ${miss.length ? '✗' : '✓'} ${k.padEnd(22)} ${Object.keys(out.cover).filter(x => x.startsWith(k + ' ')).map(x => x.slice(k.length + 1) + ' ' + out.cover[x]).join(' · ')}`);
  ok(!miss.length, `${k}: 안 해 본 동작 ${miss.join(', ')}`);
}
for(const k of ['single', 'both', 'stay:already', 'stay:neg', 'stay:mimic', 'stay:both0', 'single+flip', 'single+y']) ok(kinds.some(x => x.startsWith(k)), '명령 종류가 안 나옴: ' + k);

const PART1 = process.argv.includes('--part1');   /* 빠른 점검만 */
/* ---------- 2) 실제 시간 점검: 키보드 · 버튼 · 밀기 ---------- */
async function realRun(route, cfgCode, seed){
  await page.evaluate(({ cfgCode, seed }) => {
    G.over = false; G.paused = false; G.pausedMs = 0; G.start = Date.now();
    NG.flag.init(eval(cfgCode), mulberry(seedFrom(seed))); renderStage(); G.fl.lives = 999;
    window.__rec = [];
  }, { cfgCode, seed });
  const KEY = { b:['q', 'a'], w:['p', 'l'], y:['t', 'g'] };
  let tested = 0, wrongs = 0, maxGap = 0, maxWall = 0;
  for(let k = 0; k < 8; k++){
    /* 다음 명령이 뜰 때까지 진짜 시간으로 기다림 */
    let s = null;
    for(let w = 0; w < 120; w++){ s = await page.evaluate(() => { const x = NG.flag._state(); return x.phase === 'cmd' ? x : (x.phase === 'done' ? x : null); }); if(s) break; await wait(25); }
    if(!s || s.phase === 'done') break;
    const F = s.third ? ['b', 'w', 'y'] : ['b', 'w'];
    /* 요구 동작이 아닌 누르기 하나 고르기(이미 그 상태·다른 깃발·반대 방향을 돌려 가며) */
    const q = s.cur, R = q.stay ? [] : F.filter(f => q.tgt[f] !== s.my[f]).map(f => [f, q.tgt[f]]);
    const cand = F.flatMap(f => [[f, 1], [f, 0]]).filter(([f, d]) => !R.some(r => r[0] === f && r[1] === d));
    const [f, d] = cand[k % cand.length];
    const n0 = s.res, t0 = Date.now();
    if(route === 'key') await page.keyboard.press(KEY[f][d ? 0 : 1]);
    else if(route === 'btn') await page.locator(`.fl-btn[data-f="${f}"][data-d="${d}"]`).dispatchEvent('pointerdown');
    else {
      const box = await page.locator('#flScene').boundingBox();
      const fx = s.third ? (f === 'b' ? 1 / 6 : f === 'y' ? .5 : 5 / 6) : (f === 'b' ? .25 : .75);
      const x = box.x + box.width * fx, y = box.y + box.height * .6;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + (d ? -60 : 60), { steps:3 }); await page.mouse.up();
    }
    const a = await page.evaluate(() => { const x = NG.flag._state(); return { res:x.res, last:x.last, phase:x.phase, gap:x.until - elapsed() }; });
    tested++;
    if(!ok(a.res === n0 + 1 && a.last && !a.last.ok, `${route} 명령 ${k}: ${f}${d ? '↑' : '↓'}(요구 동작 아님)가 바로 오답이 아님 (판정 ${a.res - n0}, ${a.last && a.last.ok})`)) continue;
    wrongs++;
    ok(a.gap <= .401, `${route} 명령 ${k}: 오답 뒤 다음 명령 예약 ${a.gap.toFixed(3)}초`);
    maxGap = Math.max(maxGap, a.gap);
    /* 다음 명령(또는 카드)이 실제로 뜰 때까지(벽시계, 이 컴퓨터의 화면 칸 속도 포함) */
    for(let w = 0; w < 200; w++){ const ph = await page.evaluate(() => NG.flag._state().pos); if(ph > s.pos) break; await wait(10); }
    maxWall = Math.max(maxWall, (Date.now() - t0) / 1000);
  }
  console.log(`   ${route.padEnd(5)} 요구 동작이 아닌 누르기 ${tested}번 → 바로 오답 ${wrongs}번 · 다음 명령 예약 최대 ${maxGap.toFixed(2)}초(게임 시계) · 실제로 뜨기까지 최대 ${maxWall.toFixed(2)}초(이 컴퓨터 화면 칸 속도 포함)`);
}
if(!PART1) console.log('2) 실제 시간 점검(키보드 · 버튼 · 밀기):');
if(!PART1) for(const route of ['key', 'btn', 'swipe']){
  await realRun(route, "NG.flag.levels.normal", 'real:' + route);
  await realRun(route, 'NG.flag._stage(31)', 'real3:' + route);
}

/* ---------- 3) 봇 ---------- */
async function bot(kind, lv){
  await page.evaluate(({ lv }) => { closeModal(); goHome(); startGame('flag', lv, { seed:'bot:' + lv }); }, { lv });
  await wait(200);
  const r = await page.evaluate(({ kind }) => new Promise(done => {
    let pend = null, lastPos = -1;
    const iv = setInterval(() => {
      if(!G || G.over || G.fl.phase === 'done'){ clearInterval(iv); setTimeout(() => done({ win:G.fl.phase === 'done' && G.fl.lives > 0 && G.fl.res.length === G.fl.N, ok:G.fl.ok, N:G.fl.N, lives:G.fl.lives, sc:G.fl.lives > 0 && G.fl.res.length === G.fl.N ? calcScore().score : 0 }), 50); return; }
      const m = G.fl;
      if(kind === 'spam'){ const F = m.third ? ['b', 'w', 'y'] : ['b', 'w']; NG.flag._press(F[Math.floor(Math.random() * F.length)], Math.random() < .5 ? 1 : 0); return; }
      if(kind === 'idle' || m.phase !== 'cmd') return;
      if(m.pos !== lastPos){ lastPos = m.pos; pend = elapsed() + .18; }
      if(elapsed() >= pend && !m.cur.stay){ (m.third ? ['b', 'w', 'y'] : ['b', 'w']).forEach(f => { if(m.phase === 'cmd' && m.cur.tgt[f] !== m.my[f]) NG.flag._press(f, m.cur.tgt[f]); }); }
    }, 20);
  }), { kind });
  return r;
}
if(!PART1) console.log('3) 봇:');
if(!PART1) for(const lv of ['normal', 'hard']){
  const p = await bot('perfect', lv);
  console.log(`   정답 봇 ${lv}: ${p.win ? '성공' : '실패'} · 정답 ${p.ok}/${p.N} · ${p.sc}점`);
  ok(p.win && p.sc >= 900, `정답 봇 ${lv}: 성공 900점 이상이어야 함`);
}
if(!PART1) for(const k of ['spam', 'idle']){
  const p = await bot(k, 'normal');
  console.log(`   ${k === 'spam' ? '막 누르기' : '안 누르기'} 봇: ${p.win ? '성공' : '실패'} · 정답 ${p.ok}/${p.N}`);
  ok(!p.win, `${k} 봇은 실패해야 함`);
}
errs.forEach(e => ok(false, '페이지 오류: ' + e));
await browser.close(); srv.close();
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
