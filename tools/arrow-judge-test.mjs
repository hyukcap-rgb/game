/* 거꾸로 화살표 · 판정 점검 (Playwright, 가짜 시계)
   node tools/arrow-judge-test.mjs [--quick] [--seeds 40] [--only "스테이지 41"]
   1) 문제 만들기: 스테이지 1~60 × 여러 씨앗 + 난이도 3개. 화살표의 색·방향·글자만 보고 따로 계산한 답(기준 답)과
      게임의 답이 같은지, 두 개 중 하나의 가짜를 따라 민 답이 정답이 되는 일이 없는지
   2) 실제 판: 화살표마다 네 방향 + 가만히(5가지)를 판을 5번 돌려 모두 넣어 보고, 판정이 기준 답과 같은지
      - 기준 답은 화면(data-* 속성: 색·방향·글자·금색 테두리)만 보고 계산(게임의 정답 값을 안 씀)
      - 틀린 입력 = 그 자리에서 바로 실수 + 다음 화살표로 넘어감, 회색(멈춤) = 어떤 입력이든 실수
      - 입력 방법을 돌려 가며: 키보드 · 버튼 누름 · 화면 밀기 · 키보드로 버튼 누름(click detail 0)
      - 한 번에 두 입력(키 + 버튼, 버튼 pointerdown + click) = 한 번만 셈
      - 화살표 사이 간격·시작 전 입력은 무시(다음 화살표 답으로 안 넘어감)
      - 간격 중에 다 민 획은 버려짐(새 화살표에서 계속 밀어도 안 셈), 간격 중에 조금 움직인 획은 새 화살표가 나온 뒤 움직인 방향만 셈
      - 판단 창이 끝나기 직전까지는 판정 안 됨, 끝나면 시간 초과(회색이면 정답) */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const QUICK = process.argv.includes('--quick'), SEEDS = +arg('seeds', QUICK ? 8 : 40);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8100 + Math.floor(Math.random() * 600);
const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd:root, stdio:'ignore' });
await new Promise(r => setTimeout(r, 700));
let fail = 0;
const bad = (...a) => { fail++; if(fail <= 40) console.log('  ✗', ...a); };
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.clock.install();
  await page.goto(`http://localhost:${port}/embed/arrow.html?mode=menu&sound=0`);
  await page.clock.pauseAt(Date.now() + 5000);
  await page.clock.runFor(800);
  await page.evaluate(() => { store.set('hp:help:arrow', 1); ['side', 'word', 'stop', 'pair', 'flash', 'ghost', 'tight'].forEach(k => store.set('hp:seenC:arrow:' + k, 1)); });

  /* ===== 1) 문제 만들기 ===== */
  const g = await page.evaluate(SEEDS => {
    const opp = d => (d + 2) % 4, ref1 = (c, d) => c === 'b' ? d : c === 'r' ? opp(d) : -1;
    const ref = q => q.kind === 'word' ? (q.wc === 'y' ? q.w : opp(q.w)) : q.kind === 'pair' ? ref1(q.items[q.lit].col, q.items[q.lit].dir) : ref1(q.col, q.dir);
    const out = { n:0, bad:[], pairs:0, fakeSame:0, stops:0, words:0, sides:0 };
    const cfgs = [];
    for(let n = 1; n <= 60; n++) cfgs.push(['stage ' + n, NG.arrow._stage(n)]);
    ['easy', 'normal', 'hard'].forEach(lv => cfgs.push([lv, NG.arrow.levels[lv]]));
    for(const [name, cfg] of cfgs) for(let s = 0; s < SEEDS; s++){
      const items = NG.arrow._gen(cfg, mulberry(seedFrom('judge:' + name + ':' + s)));
      if(items.length !== cfg.N) out.bad.push(name + ' N');
      items.forEach((q, i) => {
        out.n++;
        if(q.ans !== ref(q)) out.bad.push(`${name} 씨앗${s} #${i} 답 ${q.ans} ≠ 기준 ${ref(q)}`);
        if(!(q.win > .5 && q.win < 4)) out.bad.push(`${name} #${i} 창 ${q.win}`);
        if(q.kind === 'pair'){ out.pairs++; const f = q.items[1 - q.lit]; if(ref1(f.col, f.dir) === q.ans){ out.fakeSame++; out.bad.push(`${name} 씨앗${s} #${i} 가짜 화살표를 따라도 정답`); } }
        if(q.ans === -1) out.stops++;
        if(q.kind === 'word') out.words++;
        if(q.kind === 'arrow' && q.pos !== 'c') out.sides++;
        if(q.ans === -1 && !cfg.stop) out.bad.push(`${name} #${i} 멈춤 규칙이 없는 판에 회색`);
        if(q.kind === 'word' && !cfg.word) out.bad.push(`${name} #${i} 글자 규칙이 없는 판에 글자`);
        if(q.kind === 'pair' && !cfg.pair) out.bad.push(`${name} #${i} 두 개 규칙이 없는 판에 두 개`);
      });
    }
    return out;
  }, SEEDS);
  console.log(`문제 만들기: 화살표 ${g.n}개 (두 개 ${g.pairs} · 회색 ${g.stops} · 글자 ${g.words} · 가장자리 ${g.sides})`);
  g.bad.slice(0, 20).forEach(b => bad(b)); if(g.bad.length > 20) bad(`… 외 ${g.bad.length - 20}개`);

  /* ===== 2) 실제 판 ===== */
  const run = ms => page.clock.runFor(ms);
  const S = () => page.evaluate(() => { const m = G && G.m; if(!m) return null; return { phase:m.phase, i:m.i, N:m.N, done:m.done, correct:m.correct, wrong:m.wrong, res:m.res.length ? m.res[m.res.length - 1] : null, rl:m.res.length, over:G.over, t:elapsed(), t0:m.t0, win:m.i >= 0 && m.items[m.i] ? m.items[m.i].win : 0, lock:m.lockUntil, next:m.next }; });
  /* 화면만 보고 기준 답: 금색 테두리 칸(없으면 하나뿐인 칸)의 data-* */
  const refDom = () => page.evaluate(() => {
    const L = document.getElementById('arLayer'), sl = L.querySelector('.ar-slot.lit') || L.querySelector('.ar-slot'); if(!sl) return null;
    const opp = d => (d + 2) % 4, ds = sl.dataset;
    if(ds.w != null) return { ref:ds.wc === 'y' ? +ds.w : opp(+ds.w), kind:'word', pos:null };
    const d = +ds.d; return { ref:ds.c === 'b' ? d : ds.c === 'r' ? opp(d) : -1, kind:sl.classList.contains('pr') ? 'pair' : 'arrow', fake:(() => { const f = L.querySelector('.ar-slot.dim'); if(!f) return null; const fd = +f.dataset.d; return f.dataset.c === 'b' ? fd : f.dataset.c === 'r' ? opp(fd) : -1; })() };
  });
  const KEY = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'], DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  /* 입력 방법들(모두 실제 이벤트) */
  const input = {
    key:d => page.keyboard.press(KEY[d]),
    btn:d => page.evaluate(d => { const b = document.querySelector(`.ng-arrow .ar-key[data-d="${d}"]`), r = b.getBoundingClientRect(), o = { bubbles:true, cancelable:true, pointerId:7, isPrimary:true, button:0, clientX:r.left + r.width / 2, clientY:r.top + r.height / 2 };
      b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); b.dispatchEvent(new MouseEvent('click', Object.assign({ detail:1 }, o))); }, d),   /* 누름 + 뗌 + click(detail 1) = 한 번 */
    kclick:d => page.evaluate(d => { document.querySelector(`.ng-arrow .ar-key[data-d="${d}"]`).dispatchEvent(new MouseEvent('click', { bubbles:true, detail:0 })); }, d),
    swipe:d => page.evaluate(d => { const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]], el = document.getElementById('arDisc'), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, root = document.querySelector('.ng-arrow');
      const ev = (t, k) => root.dispatchEvent(new PointerEvent(t, { bubbles:true, cancelable:true, pointerId:11, isPrimary:true, button:0, clientX:x + DV[d][0] * k + (k ? 3 : 0), clientY:y + DV[d][1] * k }));
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, pointerId:11, isPrimary:true, button:0, clientX:x, clientY:y }));
      [10, 20, 32, 44].forEach(k => ev('pointermove', k)); ev('pointerup', 44); }, d),
    both:async d => { await page.evaluate(d => { const b = document.querySelector(`.ng-arrow .ar-key[data-d="${d}"]`), r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, pointerId:8, button:0, clientX:r.left + 5, clientY:r.top + 5 })); }, d); await page.keyboard.press(KEY[d]); }   /* 같은 순간 버튼 + 키 = 한 번 */
  };
  const METHODS = ['key', 'btn', 'swipe', 'kclick', 'both'];
  /* 화면 밀기 한 획을 나눠서(간격 → 새 화살표) */
  const stroke = (kind, a, b) => page.evaluate(([kind, a, b]) => {
    const root = document.querySelector('.ng-arrow'), el = document.getElementById('arDisc'), r = el.getBoundingClientRect();
    const S = window.__st || (window.__st = { x:r.left + r.width / 2, y:r.top + r.height / 2 });
    const ev = (t, x, y) => (t === 'pointerdown' ? el : root).dispatchEvent(new PointerEvent(t, { bubbles:true, cancelable:true, pointerId:21, isPrimary:true, button:0, clientX:x, clientY:y }));
    if(kind === 'down'){ window.__st = { x:r.left + r.width / 2, y:r.top + r.height / 2 }; ev('pointerdown', window.__st.x, window.__st.y); return; }
    if(kind === 'up'){ ev('pointerup', S.x, S.y); window.__st = null; return; }
    const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];   /* move: a 방향으로 b px(4px씩) */
    for(let k = 0; k < b; k += 4){ S.x += DV[a][0] * 4; S.y += DV[a][1] * 4; ev('pointermove', S.x, S.y); }
  }, [kind, a, b]);

  const configs = [];
  for(const lv of ['easy', 'normal', 'hard']) for(let s = 0; s < (QUICK ? 1 : 2); s++) configs.push({ name:lv + ' 씨앗' + s, lv, seed:'judge:' + lv + ':' + s });
  for(const n of (QUICK ? [1, 11, 16, 21, 31, 41] : [1, 6, 10, 11, 16, 20, 21, 26, 30, 31, 36, 41, 46, 50, 51, 57])) configs.push({ name:'스테이지 ' + n, adv:n });
  const ONLY = arg('only', '');   /* 이름에 이 글자가 든 판만(빠르게 볼 때) */
  if(ONLY) configs.splice(0, configs.length, ...configs.filter(c => c.name.includes(ONLY)));
  const PASSES = 5;
  let lates = 0, arrows = 0, presses = 0, timeouts = 0, strays = 0, splits = 0, doubles = 0, stopsHit = 0, pairsHit = 0, fakeHit = 0;
  for(const C of configs){
    for(let pass = 0; pass < PASSES; pass++){
      await page.evaluate(C => { try{ closeModal(); }catch(_){} startGame('arrow', C.lv || null, C.adv ? { adv:C.adv, cardDone:true } : { seed:C.seed }); }, C);
      await page.evaluate(() => { G.m.lives = G.m.lives0 = 99; G.paws = 99; try{ sceneStop(); }catch(_){} FXR.reduce = true; });   /* 점검 빠르게: 배경·파티클 끔(판정과 무관) */   /* 기회가 다 떨어져 끝나지 않게(점검만) */
      /* 시작 전 입력은 무시 */
      await run(150); await input.key(1); await run(300); await input.swipe(0);
      let s = await S(); if(s.done !== 0 || s.phase !== 'intro') bad(C.name, '시작 전 입력이 판정됨', JSON.stringify(s));
      let lastIn = -1, guard = 0, gapAct = -2, split = null, prev = null;
      while(guard++ < 3000){
        s = await S();
        if(s.over || s.phase === 'done') break;
        if(s.phase === 'intro'){ await run(Math.max(20, Math.round((s.next - s.t) * 1000) + 18)); continue; }
        if(s.phase === 'gap'){
          /* 화살표 사이 간격: 가끔 엉뚱한 입력(무시돼야 함) 또는 다음 화살표로 이어지는 획 시작 */
          if(gapAct !== s.i && s.t - lastIn >= .27 && s.i + 1 < s.N){
            gapAct = s.i;
            const act = (s.i + pass) % 4;
            if(act === 0){
              const d0 = s.done; await input[METHODS[(s.i + pass) % 4]]((s.i * 3 + pass) % 4); strays++;
              const s2 = await S(); if(s2.done !== d0) bad(C.name, '간격 중 입력이 판정됨', s.i);
              lastIn = s2.t;
            } else if(act === 1){
              /* full: 간격 중에 24px을 다 민 획 / 아니면 20px만 움직인 획(g 방향). 새 화살표 뒤에 g로 8px 더 → 앞 움직임과 합쳐 판정되면 안 됨 */
              const full = (s.i + pass) % 8 === 1, g = (s.i + pass) % 4;
              await stroke('down'); await stroke('move', g, full ? 32 : 20);
              const s2 = await S(); if(s2.done !== s.done) bad(C.name, '간격 중 밀기가 판정됨', s.i);
              split = { full, g }; if(full) lastIn = s2.t;
            }
          }
          const s3 = await S();   /* 다음 화살표가 나올 때까지(행동할 게 남았으면 조금씩) */
          await run(gapAct === s3.i ? Math.max(20, Math.round((s3.next - s3.t) * 1000) + 18) : 20); continue;
        }
        /* 화살표가 나와 있음 */
        if(prev && prev.i !== s.i){
          if(s.i !== prev.i + 1) bad(C.name, '다음 화살표 번호가 이상함', prev.i, '→', s.i);
          if(prev.tj != null){ const gap = s.t0 - prev.tj; if(gap < prev.gap - .003 || gap > prev.gap + .04) bad(C.name, `다음 화살표까지 간격 ${gap.toFixed(3)}초(기대 ${prev.gap})`, prev.i); }
          prev = null;
        }
        if(split){
          await run(40);
          const r = await refDom(), before = await S();
          let want = r.ref >= 0 ? r.ref : (before.i % 4);
          if(!split.full){
            if(want === split.g || want === (split.g + 2) % 4) want = (split.g + 1) % 4;   /* g와 직각 방향으로 밀어 봄 */
            await stroke('move', split.g, 8);
            const mid = await S(); if(mid.done !== before.done) bad(C.name, '화살표가 나오기 전 움직임이 합쳐져 판정됨', before.i);
          }
          await stroke('move', want, 36);
          const after = await S(); splits++;
          if(split.full){ if(after.done !== before.done) bad(C.name, '간격 중 다 민 획이 다음 화살표에 셈', before.i); }
          else {
            arrows++; presses++;
            if(after.done !== before.done + 1) bad(C.name, '새 화살표 뒤 밀기가 안 셈', before.i);
            else if(after.res !== (want === r.ref ? 1 : 0)) bad(C.name, '이어진 획의 방향 판정이 틀림', before.i, 'want', want, 'ref', r.ref, 'res', after.res);
            prev = { i:before.i, tj:after.t, gap:after.res ? .42 : .4 }; lastIn = after.t;
          }
          await stroke('up'); split = null;
          continue;
        }
        await run(30);
        const r = await refDom(); if(!r){ bad(C.name, '화살표 그림이 없음', s.i); await run(50); continue; }
        s = await S();
        const opt = (s.i + pass) % 5, meth = METHODS[(s.i * 2 + pass) % METHODS.length];
        /* 막 누르기 잠금에 안 걸리게 앞 입력과 0.27초 이상 */
        const needWait = Math.max(0, .27 - (s.t - lastIn));
        const off = Math.min(s.win * .85, needWait + .02 + ((s.i * 37 + pass * 11) % 50) / 100 * s.win * .5);
        await run(Math.round(off * 1000));
        s = await S(); if(s.phase !== 'show'){ bad(C.name, '판단 창 안인데 판정됨(입력 전)', s.i); continue; }
        arrows++;
        if(r.ref === -1) stopsHit++;
        if(r.kind === 'pair'){ pairsHit++; if(opt < 4 && opt === r.fake) fakeHit++; }
        if(opt === 4){
          /* 가만히: 창 끝 직전까지는 판정 없음, 끝나면 시간 초과(회색이면 정답) */
          const left = s.t0 + s.win - s.t;
          await run(Math.max(0, Math.round(left * 1000) - 40));
          let x = await S(); if(x.done !== s.done) bad(C.name, '창이 끝나기 전에 판정됨', s.i);
          await run(80); x = await S(); timeouts++;
          if(x.done !== s.done + 1) bad(C.name, '창이 끝났는데 판정 안 됨', s.i);
          else if(x.res !== (r.ref === -1 ? 1 : 0)) bad(C.name, `가만히 판정 틀림 #${s.i} 기준 ${r.ref} 결과 ${x.res}`);
          prev = { i:s.i, tj:null };
          continue;
        }
        /* 가끔: 판단 창이 끝난 직후, 다음 그림(프레임) 전에 들어온 입력 = 시간 초과(회색이면 정답) */
        const late = (s.i * 5 + pass) % 9 === 4;
        if(late){ const now = await page.evaluate(() => Date.now()); await page.clock.setSystemTime(now + Math.round((s.t0 + s.win - s.t) * 1000) + 3); lates++; }
        await input[meth](opt); presses++; if(meth === 'both' || meth === 'btn') doubles++;
        const x = await S();
        const want = late ? (r.ref === -1 ? 1 : 0) : opt === r.ref ? 1 : 0;
        if(x.done !== s.done + 1) bad(C.name, `입력이 한 번으로 안 셈(${meth}) #${s.i}: done ${s.done}→${x.done}`);
        else if(x.res !== want) bad(C.name, `판정 틀림(${meth}) #${s.i} 입력 ${opt} 기준 ${r.ref} 결과 ${x.res}`);
        if(x.phase !== 'gap' && x.phase !== 'done') bad(C.name, '판정 뒤 바로 다음으로 안 넘어감', s.i, x.phase);
        if(!want && x.wrong !== s.wrong + 1) bad(C.name, '실수가 바로 세지지 않음', s.i);
        if(want && x.correct !== s.correct + 1) bad(C.name, '정답이 바로 세지지 않음', s.i);
        prev = { i:s.i, tj:late ? null : x.t, gap:want ? .42 : .4 };
        lastIn = x.t;
        /* 같은 화살표에 한 번 더(판정 바로 뒤) = 무시 */
        if((s.i + pass) % 2 === 0){ await input.key((opt + 1) % 4); const y = await S(); if(y.done !== x.done) bad(C.name, '판정 뒤 입력이 또 셈', s.i); lastIn = y.t; }
      }
      s = await S();
      if(!(s.over || s.phase === 'done')) bad(C.name, '판이 끝나지 않음');
      if(s.correct + s.wrong !== s.N || s.rl !== s.N) bad(C.name, `판정 수가 맞지 않음 정답 ${s.correct} + 실수 ${s.wrong} ≠ ${s.N}`);
      await run(2500);
    }
    process.stdout.write('.');
  }
  /* ===== 3) 경계 상황(새 판 하나에서 차례로) ===== */
  {
    await page.evaluate(() => { try{ closeModal(); }catch(_){} startGame('arrow', 'hard', { seed:'judge:edge' }); });
    await page.evaluate(() => { G.m.lives = G.m.lives0 = 99; G.paws = 99; try{ sceneStop(); }catch(_){} FXR.reduce = true; });
    const toShow = async () => { for(let k = 0; k < 400; k++){ const s = await S(); if(s.phase === 'show' && s.t - s.t0 > .05) return s; await run(20); } return S(); };
    const ev = (t, x, y, on) => page.evaluate(([t, x, y, on]) => { const el = on === 'btn' ? document.querySelector('.ng-arrow .ar-key[data-d="1"]') : t === 'pointerdown' ? document.getElementById('arDisc') : document.querySelector('.ng-arrow');
      const r = document.getElementById('arDisc').getBoundingClientRect(), b = on === 'btn' ? el.getBoundingClientRect() : r, cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      el.dispatchEvent(new PointerEvent(t, { bubbles:true, cancelable:true, pointerId:31, isPrimary:true, button:0, clientX:cx + x, clientY:cy + y })); }, [t, x, y, on]);
    let s, x, edges = 0;
    /* 막 누르기: 화살표가 떠 있을 때 0.25초 안에 5번 → 첫 입력은 반드시 판정(한 번만), 나머지는 무시, 다음 화살표는 0.5초 늦게 */
    for(let rep = 0; rep < 6; rep++){
      s = await toShow(); await run(300);
      s = await S(); const r = await refDom(); const first = r.ref >= 0 ? (r.ref + 1 + rep % 3) % 4 : rep % 4;   /* 틀린 방향(회색이면 아무 방향 = 실수) */
      await input.key(first); for(let k = 0; k < 4; k++){ await run(30); await input.key((first + k) % 4); }
      x = await S(); edges++;
      if(x.done !== s.done + 1) bad('막 누르기', `입력 5번이 ${x.done - s.done}번 판정됨`);
      else if(x.res !== 0) bad('막 누르기', '틀린 첫 입력이 실수가 아님');
      if(!(x.lock > x.t)) bad('막 누르기', '천천히 잠금이 안 걸림');
      if(x.next < x.lock - .001) bad('막 누르기', '잠금 중에 다음 화살표가 나옴');
      await run(Math.round((x.next - x.t) * 1000) + 20);
      const y = await S(); if(y.i !== s.i + 1 || y.phase !== 'show') bad('막 누르기', '잠금 뒤 다음 화살표가 안 나옴');
      /* 잠금이 끝난 바로 뒤의 첫 입력도 판정 */
      await run(320); const y0 = await S(); await input.key(0); const y1 = await S();
      if(y0.phase === 'show' && y1.done !== y0.done + 1) bad('막 누르기', '잠금 뒤 첫 입력이 판정 안 됨');
    }
    /* 화면 밀기 경계: 23px = 판정 없음, 정확한 대각선 30px = 아직 없음, 대각선을 계속 밀면(56px 넘음) 판정 하나, 버튼 누른 채 밀기 = 버튼 한 번만 */
    for(let rep = 0; rep < 6; rep++){
      s = await toShow(); await run(320);
      await ev('pointerdown', 0, 0); await ev('pointermove', 0, -23); x = await S(); edges++;
      if(x.done !== s.done) bad('밀기', '23px 획이 판정됨');
      await ev('pointerup', 0, -23);
      await ev('pointerdown', 0, 0); await ev('pointermove', 20, 20); await ev('pointermove', 30, 30); x = await S();
      if(x.done !== s.done) bad('밀기', '정확한 대각선 30px이 판정됨');
      const sg = rep % 2 ? 1 : -1; await ev('pointermove', 60 * sg, 40); await ev('pointermove', 70 * sg, 46); x = await S();
      if(x.done !== s.done + 1) bad('밀기', `대각선을 더 민 획이 ${x.done - s.done}번 판정됨`);
      await ev('pointerup', 70 * sg, 46);
      s = await toShow(); await run(320);
      await ev('pointerdown', 0, 0, 'btn'); for(const k of [10, 30, 60]) await ev('pointermove', 0, -k, 'btn'); await ev('pointerup', 0, -60, 'btn');
      x = await S(); if(x.done !== s.done + 1) bad('밀기', `버튼 누르고 민 것이 ${x.done - s.done}번 판정됨`);
    }
    console.log(`경계 상황 ${edges}번 (막 누르기 · 짧은 획 · 대각선 · 버튼 위 밀기)`);
  }
  console.log(`\n실제 판: ${configs.length}판 × ${PASSES}번, 화살표 ${arrows}개 (입력 ${presses} · 가만히 ${timeouts} · 간격 입력 ${strays} · 이어진 획 ${splits} · 겹친 입력 ${doubles} · 창 끝난 직후 ${lates} · 회색 ${stopsHit} · 두 개 ${pairsHit}(가짜 따라 밀기 ${fakeHit}))`);
  if(errs.length){ errs.slice(0, 5).forEach(e => bad('페이지 오류', e)); }
} finally { await browser.close(); srv.kill(); }
console.log(fail ? `\n실패 ${fail}개` : '\n판정 점검 모두 통과');
process.exit(fail ? 1 : 0);
