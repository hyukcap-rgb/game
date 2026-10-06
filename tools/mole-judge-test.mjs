// 두더지 땅땅 판정 점검(2026-10-06 P0 "폭탄을 눌렀는데 맞다고 나옴"):
// 진짜 브라우저로 여러 씨앗·난이도·솔로 스테이지(새 규칙 11·21·31·41, 변주, 보스)·대전을 돌리며
// 화면에 보이는 두더지 그림 자리를 직접 누른다(브라우저 hit-test와 같은 elementFromPoint → pointerdown, 일부는 진짜 마우스 클릭).
//  - 폭탄: 막 올라올 때 · 다 올라왔을 때 · 들어가는 중 · 마지막 몇 프레임 · 멍(빈 구멍) 중 · 숫자 키 → 모두 오답(기회 −1)이어야 하고,
//          누른 폭탄은 끝까지 '참았다'로 세지면 안 된다. 안 누른 폭탄은 '참았다'.
//  - 일반·헬멧·황금·번호 두더지: 막 올라올 때 · 다 올라왔을 때 → 정답(헬멧은 두 번, 황금은 2개, 번호는 순서대로).
//    판정이 끝나 들어가는 두더지를 누르면 아무 일도 없음(감점 없음). 숨바꼭질 첫 쏙 = 빗나감.
//  - 구멍 사이(두더지 그림이 없는 틈) 누르기 → 아무 일도 없음.
//  - 봇: 정답만 누르는 봇 → 성공·900점 이상, 마구 누르기 봇·아무것도 안 누르는 봇 → 실패.
//
//   node tools/build.js && PW_CHROMIUM=/opt/pw-browsers/chromium node tools/mole-judge-test.mjs [--quick]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('--quick');
const TY = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type':TY[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`; const wait = ms => new Promise(r => setTimeout(r, ms));
const br = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});

/* ---- 판 목록 ---- */
const RUNS = [];
for(const lv of ['easy', 'normal', 'hard']) for(const s of (QUICK ? [1] : [1, 2, 3])) RUNS.push({ name:`${lv} 씨앗${s}`, code:`startGame('mole', '${lv}', { seed:'judge:${lv}:${s}' })` });
for(const n of (QUICK ? [5, 11, 20, 31, 41] : [1, 5, 6, 9, 10, 11, 14, 16, 20, 21, 26, 30, 31, 36, 40, 41, 46, 50, 55])) RUNS.push({ name:`솔로 ${n}판`, code:`startGame('mole', null, { adv:${n}, cardDone:true })` });
RUNS.push({ name:'대전(컴퓨터)', duel:true });
RUNS.forEach((r, i) => { r.off = (i * 5) % 12; });
const VIEW = [[390, 844], [360, 740]];

/* ---- 페이지 안에서 도는 누르기 요원(rAF마다 상태를 보고 정해진 순간에 그림 위를 누름) ---- */
function AGENT(off){
  const W = window, out = W.__J = { fails:[], taps:{}, bombTapped:new Set(), notes:[], outside:0, gaps:0, done:false };
  const cnt = k => { out.taps[k] = (out.taps[k] || 0) + 1; };
  const fail = s => { if(out.fails.length < 40) out.fails.push(s); };
  const cellEl = h => document.querySelector(`.ng-mole .ml-cell[data-i="${h}"]`);
  const MOM_B = ['appear', 'up', 'sink', 'skip', 'last', 'stun', 'key', 'up', 'appear', 'skip', 'last', 'sink'];   /* skip = 안 누름 → 참았다여야 함 */
  const MOM_N = ['appear', 'up', 'up', 'appear', 'late'];
  let bi = off || 0, ni = off || 0, lastTap = -1, gapAt = 0;   /* 판마다 시작 순간을 바꿔 모든 순간이 고루 나오게 */
  const plan = new Map();   /* 두더지 기록 → 누를 순간 */
  /* 보이는 그림 위의 점: fy = 그림 상자 높이 비율(폭탄 공 가운데 .2, 얼굴 .5) */
  function pt(h, fy){
    const c = cellEl(h); if(!c) return null;
    const a = c.querySelector('.ml-img').getBoundingClientRect(), k = c.querySelector('.ml-clip').getBoundingClientRect();
    const x = a.left + a.width / 2; let y = a.top + a.height * fy;
    if(y < k.top + 2) y = k.top + 2;
    if(y > k.bottom - 3 || y > a.bottom - 3) return null;   /* 그 높이는 이미 구멍 속(안 보임) */
    return { x, y, visH:Math.min(k.bottom, a.bottom) - Math.max(k.top, a.top), cw:c.getBoundingClientRect().width, cell:c.getBoundingClientRect() };
  }
  const plog = [];
  function press(p, why){ plog.push({ why:why || '?', t:G.m.t }); if(plog.length > 12) plog.shift(); const el = document.elementFromPoint(p.x, p.y); if(!el) return false; el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, clientX:p.x, clientY:p.y, pointerType:'touch', isPrimary:true })); return true; }
  const snap = m => ({ c:m.correct, w:m.wrong, e:m.empty, l:m.lives });
  /* 그 점이 어떤 두더지 그림(보이는 부분) 위인가: 넉넉하게(그림 상자 전체 ∩ 구멍 위 잘림 상자) */
  const onAnyMole = (x, y) => Array.from(document.querySelectorAll('.ng-mole .ml-cell')).some(c => { const img = c.querySelector('.ml-img').getBoundingClientRect(), k = c.querySelector('.ml-clip').getBoundingClientRect();
    return x > img.left + img.width * .06 && x < img.right - img.width * .06 && y > Math.max(img.top, k.top) - 6 && y < Math.min(img.bottom, k.bottom); });
  function frame(){
    if(typeof G === 'undefined' || !G || !G.m || G.id !== 'mole'){ requestAnimationFrame(frame); return; }
    const m = G.m;
    if(m.lives < 50 && !m.done){ m.lives = 99; }
    if(G.over || m.done){ out.done = true; out.final = { correct:m.correct, wrong:m.wrong, resist:m.resist, hits:m.hits, N:m.N, empty:m.empty };
      /* 끝: 누른 폭탄이 '참았다'로 세졌는지, 안 누른 폭탄이 참았다인지 */
      return; }
    requestAnimationFrame(frame);
    if(!(m.phase === 'wave') || G.paused || (G.duel && !G.duel.go)) return;
    if(m.t - lastTap < .09) return;   /* 마구 누르기(0.25초 3번 넘게)에 걸리지 않게 */
    /* 끝난 두더지 검사 */
    for(const r of m.act){
      if(r.kind === 'bomb' && r.st === 'gone' && !r._chk){ r._chk = 1;
        if(r._tapped && r.res !== 'wrong') fail(`누른 폭탄이 ${r.res}로 끝남(물결 ${r.wave} 구멍 ${r.hole})`);
        if(!r._tapped && r.res !== 'resist') fail(`안 누른 폭탄이 ${r.res}로 끝남(물결 ${r.wave}, 그때 누른 것: ${plog.filter(q => Math.abs(q.t - r.goneAt) < .03).map(q => q.why).join(',') || '없음'})`);
      }
    }
    for(const r of m.act){
      if(!plan.has(r)) plan.set(r, r.kind === 'bomb' ? MOM_B[bi++ % MOM_B.length] : r.kind === 'hide' ? 'peek' : MOM_N[ni++ % MOM_N.length]);
      const mom = plan.get(r); if(mom === 'done') continue;
      const age = m.t - r.upAt, before = snap(m);
      if(r.kind === 'bomb'){
        if(r._real) continue;   /* 진짜 마우스가 누르기로 한 폭탄 */
        let p = null;
        if(mom === 'appear' && r.st === 'up' && age < .2) p = pt(r.hole, .2);
        else if(mom === 'up' && r.st === 'up' && age > .3) p = pt(r.hole, .2);
        else if(mom === 'stun' && r.st === 'up' && age > .3){   /* 빈 구멍을 눌러 멍한 사이에 폭탄 */
          const free = Array.from(document.querySelectorAll('.ng-mole .ml-cell')).find(c => !m.act.some(x => x.st !== 'gone' && x.st !== 'wait' && (x.hole === +c.dataset.i || x.peek === +c.dataset.i)) && !c.classList.contains('lit'));
          if(free){ const b = free.getBoundingClientRect(); const q = [.25, .45, .65, .85].map(f => ({ x:b.left + b.width / 2, y:b.top + b.height * f })).find(q => !onAnyMole(q.x, q.y)); if(q) press(q, '멍 만들기 빈 칸'); }
          if(m.t < m.lockUntil) p = pt(r.hole, .2); else { plan.set(r, 'up'); continue; }
        }
        else if(mom === 'key' && r.st === 'up' && age > .3){
          if(m.cols === 3 && m.rows === 3){ document.dispatchEvent(new KeyboardEvent('keydown', { key:'789456123'[r.hole], bubbles:true, cancelable:true })); }
          else { plan.set(r, 'up'); continue; }
          cnt('폭탄:키'); r._tapped = 1; out.bombTapped.add(r); lastTap = m.t; plan.set(r, 'done');
          if(m.wrong !== before.w + 1 || r.res !== 'wrong') fail(`숫자 키로 폭탄 → 오답 아님(w ${before.w}→${m.wrong}, st ${r.st})`);
          continue;
        }
        else if(mom === 'sink' && r.st === 'sink') p = pt(r.hole, .2);
        else if(mom === 'last' && r.st === 'sink'){ const q = pt(r.hole, .06); if(q && q.visH < q.cw * .28) p = q; }
        if(r.st === 'gone' && (mom === 'sink' || mom === 'last')){ plan.set(r, 'done'); continue; }   /* 그 순간을 못 잡음(괜찮음) */
        if(!p) continue;
        const cb = cellEl(r.hole).getBoundingClientRect(); if(p.y < cb.top || p.x < cb.left || p.x > cb.right) out.outside++;
        if(!press(p)) continue;
        r._tapped = 1; out.bombTapped.add(r); lastTap = m.t; plan.set(r, 'done'); cnt('폭탄:' + mom);
        if(m.wrong !== before.w + 1) fail(`폭탄(${mom}) 눌렀는데 오답 아님: w ${before.w}→${m.wrong} c ${before.c}→${m.correct} 구멍 ${r.hole} st ${r.st}`);
        if(m.correct !== before.c) fail(`폭탄(${mom}) 눌렀는데 정답 수가 바뀜 ${before.c}→${m.correct}`);
        if(r.res !== 'wrong') fail(`폭탄(${mom}) 결과 ${r.res}`);
        continue;
      }
      if(r.kind !== 'bomb' && m.t < m.lockUntil + .02) continue;   /* 멍·잠금 중에는 일반 두더지를 누르지 않음(누를 수 없는 게 규칙) */
      if(r.kind === 'hide' && mom === 'peek'){
        if(r.st === 'peek' && m.t - r.at > .25){ const p = pt(r.peek, .5); if(p && press(p)){ lastTap = m.t; cnt('숨바꼭질:쏙'); plan.set(r, 'up');
          if(m.empty !== before.e + 1 || m.correct !== before.c) fail(`숨바꼭질 첫 쏙 → 빗나감 아님(e ${before.e}→${m.empty})`); } }
        else if(r.st === 'up') plan.set(r, 'up');
        continue;
      }
      if(mom === 'late'){   /* 놓친 뒤 들어가는 두더지 누르기: 아무 일 없음 */
        if(r.st === 'gone' && r.res === 'miss' && !r._late){ const p = pt(r.hole, .45); if(p){ r._late = 1; if(press(p)){ lastTap = m.t; cnt('일반:들어가는중');
          const a = snap(m); if(a.c !== before.c || a.w !== before.w || a.e !== before.e) fail(`들어가는 일반 두더지 누름 → 변화 있음 ${JSON.stringify(before)}→${JSON.stringify(a)}`); } plan.set(r, 'done'); } }
        continue;
      }
      if(r.st !== 'up') continue;
      if(r.kind === 'num'){ const want = Math.min(...m.act.filter(x => x.kind === 'num' && x.st !== 'gone').map(x => x.num)); if(r.num !== want) continue; }
      let p = null;
      if(mom === 'appear' && age < .2) p = pt(r.hole, .5);
      else if(mom === 'up' && age > .3 && age < r.win - .25) p = pt(r.hole, .5);
      if(!p) continue;
      if(!press(p)) continue;
      lastTap = m.t; cnt(r.kind + ':' + mom);
      const val = r.kind === 'gold' ? 2 : 1;
      if(r.kind === 'helmet' && r.st === 'up' && r.helm === false && m.correct === before.c){ plan.set(r, 'up'); continue; }   /* 헬멧 첫 번째: 헬멧만 날아감 */
      if(m.correct !== before.c + val || m.wrong !== before.w || m.empty !== before.e) fail(`${r.kind}(${mom}) 눌렀는데 정답 아님: ${JSON.stringify(before)}→${JSON.stringify(snap(m))} 구멍 ${r.hole}`);
      plan.set(r, 'done');
    }
    /* 구멍 사이 틈 누르기(물결마다 가끔): 두더지 그림이 없는 자리여야 함 */
    if(m.t - gapAt > 1.3 && m.act.some(r => r.st === 'up')){
      const cs = Array.from(document.querySelectorAll('.ng-mole .ml-cell'));
      const a = cs[0].getBoundingClientRect(), b = cs[1].getBoundingClientRect();
      const x = (a.right + b.left) / 2;
      for(const rowCell of [cs[0], cs[m.cols]]){ if(!rowCell) continue;
        const rb = rowCell.getBoundingClientRect(), y = rb.bottom - rb.height * .15;
        const onMole = onAnyMole(x, y);
        if(onMole || x <= a.right) continue;
        const before = snap(m); press({ x, y }, '틈'); gapAt = m.t; lastTap = m.t; out.gaps++;
        const af = snap(m); if(af.c !== before.c || af.w !== before.w || af.e !== before.e) fail(`구멍 사이 틈 누름 → 변화 ${JSON.stringify(before)}→${JSON.stringify(af)}`);
        break;
      }
    }
  }
  requestAnimationFrame(frame);
}

async function newPage([w, h]){
  const ctx = await br.newContext({ viewport:{ width:w, height:h } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|railway|battle-production/, r => r.abort());
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  pg.on('console', m => { if(m.type() === 'error' && !/WebSocket|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.addInitScript(() => { try{ for(const k of ['hp:welcome', 'hp:help:mole', 'hp:coach:mole']){ localStorage.setItem(k, '9'); localStorage.setItem('hpe:test::' + k, '9'); } }catch(_){} });
  await pg.goto(BASE + (process.env.MOLE_PAGE || 'embed/mole.html') + '?ns=test'); await wait(500);
  await pg.evaluate(() => { try{ closeModal(); }catch(_){} });
  return { ctx, pg, errs };
}

let fails = 0; const tot = {}; let outside = 0, gaps = 0;
async function judgeRun(run, vp){
  const { ctx, pg, errs } = await newPage(vp);
  if(run.duel){
    await pg.evaluate(() => { HaruPuzzleEmbed.start('duel'); setTimeout(() => { const b = document.querySelector('#dsAi'); if(b) b.click(); }, 200); });
    await pg.waitForFunction(() => G && G.duel && G.duel.go, null, { timeout:20000 }).catch(() => {});
  } else await pg.evaluate(c => { eval(c); }, run.code);
  await wait(150); await pg.evaluate(() => { try{ if(document.querySelector('#modal.on #mOk')) document.querySelector('#mOk').click(); }catch(_){} });
  await pg.evaluate(AGENT, run.off || 0);
  /* 진짜 마우스로도 몇 번: 다 올라온 폭탄 */
  let real = 0;
  const t0 = Date.now();
  while(Date.now() - t0 < 300000){
    const st = await pg.evaluate(() => { const J = window.__J; if(J.done) return { done:true }; const m = G.m;
      const r = m.act.find(r => r.kind === 'bomb' && r.st === 'up' && m.t - r.upAt > .35 && r.endAt - m.t > .45 && !r._tapped);
      if(!r || (window.__realN || 0) >= 2) return {};
      const c = document.querySelector(`.ml-cell[data-i="${r.hole}"]`), a = c.querySelector('.ml-img').getBoundingClientRect();
      r._tapped = 1; r._real = 1; window.__realN = (window.__realN || 0) + 1; window.__rw = m.wrong; window.__rr = r;
      return { x:a.left + a.width / 2, y:a.top + a.height * .2 }; });
    if(st.done) break;
    if(st.x != null){
      await pg.mouse.click(st.x, st.y); real++;
      const ok = await pg.evaluate(() => { const r = window.__rr; return G.m.wrong > window.__rw && r.res === 'wrong'; });
      if(!ok){ console.log(`  ✗ ${run.name}: 진짜 마우스로 폭탄 눌렀는데 오답 아님`); fails++; }
    }
    await wait(60);
  }
  const J = await pg.evaluate(() => { const J = window.__J; return { fails:J.fails, taps:J.taps, done:J.done, final:J.final, outside:J.outside, gaps:J.gaps,
    bombs:[...J.bombTapped].map(r => r.res) }; });
  if(!J.done) J.fails.push('판이 끝나지 않음 ' + await pg.evaluate(() => { const m = G.m; return JSON.stringify({ t:+m.t.toFixed(1), phase:m.phase, wi:m.wi, W:m.waves.length, over:G.over, paused:G.paused, act:m.act.map(r => r.kind + ':' + r.st) }); }));
  if(J.bombs.some(x => x !== 'wrong')) J.fails.push('누른 폭탄 중 오답이 아닌 것: ' + J.bombs.join(','));
  const bad = J.fails.concat(errs.map(e => '오류: ' + e));
  for(const [k, v] of Object.entries(J.taps)) tot[k] = (tot[k] || 0) + v;
  outside += J.outside; gaps += J.gaps;
  console.log(`${bad.length ? '✗' : '✓'} ${run.name} ${vp.join('×')}  누름 ${Object.values(J.taps).reduce((a, b) => a + b, 0)}번(폭탄 ${J.bombs.length}, 진짜 클릭 ${real}) 틈 ${J.gaps}${J.final ? `  정답 ${J.final.correct}/${J.final.N} 오답 ${J.final.wrong} 참음 ${J.final.resist}` : ''}${bad.length ? '\n    ' + bad.slice(0, 8).join('\n    ') : ''}`);
  if(bad.length) fails++;
  await ctx.close();
}

/* ---- 봇: 정답만 / 마구 누르기 / 아무것도 안 함 ---- */
function BOT(kind){
  const out = window.__B = { done:false };
  let last = -1;
  function press(x, y){ const el = document.elementFromPoint(x, y); if(el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, clientX:x, clientY:y, pointerType:'touch' })); }
  function frame(){
    if(typeof G === 'undefined' || !G || !G.m){ requestAnimationFrame(frame); return; }
    const m = G.m;
    if(G.over || m.done){ out.done = true; out.ok = !m.fail; try{ const q = NG.mole.score(); out.score = !m.fail ? q.base + q.time + q.extra : 0; out.mult = calcScore().score; }catch(_){ out.score = -1; } out.correct = m.correct; out.N = m.N; out.need = m.need; return; }
    requestAnimationFrame(frame);
    if(m.phase !== 'wave') return;
    if(kind === 'perfect'){
      if(m.t - last < .1) return;
      const nums = m.act.filter(x => x.kind === 'num' && x.st !== 'gone').map(x => x.num), want = nums.length ? Math.min(...nums) : 0;
      const r = m.act.find(r => r.st === 'up' && r.kind !== 'bomb' && m.t - r.upAt > .2 && (r.kind !== 'num' || r.num === want));
      if(!r) return;
      const c = document.querySelector(`.ml-cell[data-i="${r.hole}"]`), a = c.querySelector('.ml-img').getBoundingClientRect();
      press(a.left + a.width / 2, a.top + a.height * .5); last = m.t;
    } else if(kind === 'spam'){
      if(m.t - last < .07) return; last = m.t;
      const cs = document.querySelectorAll('.ng-mole .ml-cell'), c = cs[Math.floor(Math.random() * cs.length)].getBoundingClientRect();
      press(c.left + c.width / 2, c.top + c.height * .6);
    }
  }
  requestAnimationFrame(frame);
}
async function botRun(kind, code, label, vp = VIEW[0]){
  const { ctx, pg, errs } = await newPage(vp);
  await pg.evaluate(c => { eval(c); }, code); await wait(150);
  await pg.evaluate(BOT, kind);
  await pg.waitForFunction(() => window.__B && window.__B.done, null, { timeout:150000, polling:250 }).catch(() => {});
  const B = await pg.evaluate(() => window.__B);
  let good;
  if(kind === 'perfect') good = B.done && B.ok && B.score >= 900;
  else good = B.done && !B.ok;
  console.log(`${good && !errs.length ? '✓' : '✗'} 봇 ${label}: ${B.done ? (B.ok ? '성공' : '실패') : '안 끝남'} 정답 ${B.correct}/${B.N}(목표 ${B.need})${kind === 'perfect' ? ` 점수 ${B.score}(배율 뒤 ${B.mult})` : ''} ${errs.join(' ')}`);
  if(!good || errs.length) fails++;
  await ctx.close();
}

/* ---- 실행(동시에 몇 판) ---- */
const jobs = [], ONLYR = process.env.JUDGE_ONLY ? new RegExp(process.env.JUDGE_ONLY) : null;   /* JUDGE_ONLY='hard 씨앗2' 처럼 몇 판만 */
RUNS.forEach((r, i) => { if(!ONLYR || ONLYR.test(r.name)) jobs.push(() => judgeRun(r, VIEW[i % 2])); });
if(!ONLYR){
for(const lv of ['easy', 'normal', 'hard']) jobs.push(() => botRun('perfect', `startGame('mole', '${lv}', { seed:'bot:${lv}' })`, `정답만(${lv})`));
for(const n of [11, 21, 31, 41]) jobs.push(() => botRun('perfect', `startGame('mole', null, { adv:${n}, cardDone:true })`, `정답만(솔로 ${n}판)`, VIEW[1]));
jobs.push(() => botRun('spam', `startGame('mole', 'normal', { seed:'bot:spam' })`, '마구 누르기(normal)'));
jobs.push(() => botRun('idle', `startGame('mole', 'normal', { seed:'bot:idle' })`, '안 누르기(normal)'));
jobs.push(() => botRun('idle', `startGame('mole', 'easy', { seed:'bot:idle2' })`, '안 누르기(easy)'));
}
const PAR = +(process.env.PAR || 6);
let ji = 0;
await Promise.all(Array.from({ length:PAR }, async () => { while(ji < jobs.length){ const j = jobs[ji++]; try{ await j(); }catch(e){ console.log('✗ 점검 오류', String(e).split('\n')[0]); fails++; } } }));
console.log('\n누른 순간별 횟수:', JSON.stringify(tot));
console.log(`칸 밖(윗칸 영역)에 그려진 폭탄 머리를 누른 횟수: ${outside} · 구멍 사이 틈: ${gaps}`);
const need = ['폭탄:appear', '폭탄:up', '폭탄:sink', '폭탄:last', '폭탄:stun', '폭탄:키'];
for(const k of need) if(!ONLYR && !tot[k]){ console.log('✗ 이 순간을 한 번도 못 눌러 봄: ' + k); fails++; }
await br.close(); srv.close();
console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과');
process.exit(fails ? 1 : 0);
