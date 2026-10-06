// 가위바위보 지령(rps) 판정 점검: "틀린 손이 정답으로 세어짐"·"틀려도 바로 안 넘어감" 같은 판정 버그를 잡는다.
//  1) 판 만들기 점검(화면 없이): 난이도 3개 + 솔로 1~60판 × 씨앗 여러 개로 gen()을 돌려,
//     이 파일에 따로 적은 규칙(가위 > 보, 바위 > 가위, 보 > 바위 · 하지 마라 = 나머지 둘 · 두 손 = 화살표 쪽 손 · 아까처럼 = 앞 지령)으로
//     계산한 정답과 게임의 정답(q.ans)이 같은지, 같은 씨앗 = 같은 판인지 본다.
//  2) 진짜 화면 점검: 판을 열고 지령마다 화면에 보이는 것만(상대 손 그림·메달 색·금지 표시·글자·화살표 꼬리표·버튼 그림) 읽어서
//     정답 버튼을 따로 계산한 뒤, 버튼 1·2·3을 돌아가며 "첫 번째로" 누른다(마우스 누르기·키보드 1·2·3 / A·S·D / ←↓→).
//     확인: 판정이 기준과 같음 · 틀리면 0.4초 안에 다음으로 · 흔들기 중 누름은 무시 · 두 번 눌러도 판정 한 번 · 시간 초과 = 오답 ·
//     자리 바꾸기에서 버튼 그림 = 실제로 내는 손.
//
//   node tools/build.js && PW_CHROMIUM=/opt/pw-browsers/chromium node tools/rps-judge-test.mjs
//   옵션: --quick (화면 점검 판 수 줄이기)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('--quick');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const wait = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, msg) => { if(!c){ fail++; console.log('✗ ' + msg); } return c; };

/* ---------- 따로 적은 정답 규칙(게임 코드를 보지 않고 규칙만으로) ---------- */
const NAMES = ['가위', '바위', '보'];
const BEATS = { '가위':'보', '바위':'가위', '보':'바위' };   /* 왼쪽이 오른쪽을 이김 */
function refAnswer(opp, order, not){   /* opp, 답: 손 이름 · order: win|lose|draw */
  const good = NAMES.filter(x => order === 'win' ? BEATS[x] === opp : order === 'lose' ? BEATS[opp] === x : x === opp);
  if(good.length !== 1) throw new Error('규칙 표 오류');
  return not ? NAMES.filter(x => x !== good[0]) : good;
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
async function open(){
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if(m.type() === 'error' && !/WebSocket|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(() => { try{ localStorage.setItem('jt:hp:welcome', '9'); localStorage.setItem('jt:hp:help:rps', '1'); localStorage.setItem('hp:help:rps', '1'); }catch(_){} });
  await page.goto(BASE + 'embed/rps.html?ns=jt&mode=menu', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof NG !== 'undefined' && NG.rps && typeof startGame === 'function', null, { timeout:30000 });
  return { page, errs };
}

/* ================= 1) 판 만들기 점검 ================= */
{
  const { page, errs } = await open();
  const r = await page.evaluate(({ NAMES, BEATS }) => {
    const ref = (opp, order, not) => { const g = NAMES.filter(x => order === 'win' ? BEATS[x] === opp : order === 'lose' ? BEATS[opp] === x : x === opp); return not ? NAMES.filter(x => x !== g[0]) : g; };
    const out = { n:0, bad:[], kinds:{}, det:0 };
    const cfgs = [['easy', NG.rps.levels.easy], ['normal', NG.rps.levels.normal], ['hard', NG.rps.levels.hard]];
    for(let s = 1; s <= 60; s++) cfgs.push(['stage' + s, NG.rps._stage(s)]);
    for(const [name, cfg] of cfgs) for(let seed = 1; seed <= 40; seed++){
      const Q = NG.rps._gen(cfg, mulberry(seed * 7919 + 13)), Q2 = NG.rps._gen(cfg, mulberry(seed * 7919 + 13));
      if(JSON.stringify(Q) !== JSON.stringify(Q2)) out.det++;
      if(Q.length !== cfg.N) out.bad.push(name + ' 길이');
      let prev = null, run = 0, prevH = -1;
      Q.forEach((q, i) => {
        out.n++;
        /* 플레이어가 보는 것: 상대 손(두 손이면 왼쪽 h · 오른쪽 h2), 화살표 쪽, 지령(아까처럼이면 앞 지령) */
        const order = q.last ? prev.order : q.t, not = q.last ? prev.not : q.not;
        if(q.last && i === 0) out.bad.push(name + ' 첫 문제가 아까처럼');
        const opp = NAMES[q.two ? (q.side ? q.h2 : q.h) : q.h];
        const want = ref(opp, order, not).sort().join(), got = q.ans.map(h => NAMES[h]).sort().join();
        if(want !== got && out.bad.length < 20) out.bad.push(`${name} 씨앗${seed} #${i} 상대 ${opp} ${order}${not ? '(하지 마라)' : ''}${q.last ? '(아까처럼)' : ''}: 기준 ${want} · 게임 ${got}`);
        if(q.perm.slice().sort().join() !== '0,1,2') out.bad.push(name + ' 버튼 순서 이상');
        if(!cfg.swap && q.perm.join() !== '0,1,2') out.bad.push(name + ' 자리 바꾸기 아닌데 순서가 섞임');
        if(q.two && q.h2 === q.h) out.bad.push(name + ' 두 손이 같은 손');
        if(!(q.win >= .9)) out.bad.push(name + ' 판단 창이 0.9초보다 짧음');
        run = q.h === prevH ? run + 1 : 0; prevH = q.h; if(run >= 2) out.bad.push(name + ' 같은 손 세 번 연속');
        const k = (q.last ? 'last' : q.not ? 'not' : q.t) + (q.two ? '+two' : '') + (q.hide ? '+hide' : '');
        out.kinds[k] = (out.kinds[k] || 0) + 1;
        prev = { order, not };
      });
    }
    return out;
  }, { NAMES, BEATS });
  ok(!r.bad.length, '판 만들기: ' + r.bad.slice(0, 10).join(' / '));
  ok(!r.det, '같은 씨앗인데 판이 다름 ' + r.det + '번');
  ok(!errs.length, '판 만들기 오류: ' + errs.join(' | '));
  console.log(`${r.bad.length || r.det ? '✗' : '✓'} 판 만들기 ${r.n}문제(난이도 3 + 솔로 60판 × 씨앗 40) 정답 = 기준 규칙 · 종류 ${Object.keys(r.kinds).length}가지`);
  await page.close();
}

/* ================= 2) 진짜 화면 점검 ================= */
/* 화면에서 읽기: 그림 src를 손 그림 표와 맞춰서 무슨 손인지 알아냄(alt 글자를 믿지 않음) */
const readScreen = page => page.evaluate(() => {
  const CUFF = ['#C98A48', '#7E88A8', '#A0612C', '#A86BE8', '#FF8A1A'];
  const handOf = (src, sh) => { for(const c of CUFF.concat(['#FF6F9F'])) for(let h = 0; h < 3; h++) if(NG.rps._hand(h, c, sh) === src) return ['가위', '바위', '보'][h]; return null; };
  const opp = [...document.querySelectorAll('#rpOpp .rp-hand')].map(im => ({ hand:handOf(im.getAttribute('src'), false), x:im.getBoundingClientRect().left + im.getBoundingClientRect().width / 2 })).sort((a, b) => a.x - b.x);
  const med = document.querySelector('#rpMed').innerHTML;
  const col = { '#22A559':'win', '#E5484D':'lose', '#F5B400':'draw', '#8A5CF0':'last' };
  const shape = (med.match(/fill="(#[0-9A-F]{6})"/) || [])[1];
  const sub = document.querySelector('#rpSub'), txt = document.querySelector('#rpTxt');
  const btns = [...document.querySelectorAll('.ng-rps .rp-b')].map(b => { const r = b.getBoundingClientRect(); return { hand:handOf(b.querySelector('img').getAttribute('src'), true), label:b.querySelector('span').textContent, x:r.left + r.width / 2, y:r.top + r.height / 2, w:r.width, h:r.height }; });
  return { opp, medal:col[shape] || null, notMark:/M13 47L47 13/.test(med), text:getComputedStyle(txt).display === 'none' ? '' : txt.textContent,
    side:sub && getComputedStyle(sub).display !== 'none' ? (/오른쪽/.test(sub.textContent) ? 'R' : /왼쪽/.test(sub.textContent) ? 'L' : '') : '', btns };
});
const TXT = { win:'이겨라!', lose:'져라!', draw:'비겨라!', last:'아까처럼!' }, NOT_TXT = { win:'이기지 마라!', lose:'지지 마라!', draw:'비기지 마라!' };
const KEYS = [['1', '2', '3'], ['a', 's', 'd'], ['ArrowLeft', 'ArrowDown', 'ArrowRight']];
const stateOf = page => page.evaluate(() => { const s = NG.rps._test.state(); const m = G.m; return s && { ...s, res:m.res.length, lastOk:m.res.length ? m.res[m.res.length - 1].ok : null, over:!!G.over, perf:performance.now() }; });

async function startRun(page, how){
  await page.evaluate(h => { try{ closeModal(); }catch(_){} if(h.adv) startGame('rps', null, { adv:h.adv }); else startGame('rps', h.lv); }, how);
  for(let k = 0; k < 6; k++){
    await wait(250);
    const st = await page.evaluate(() => ({ m:!!(G && G.id === 'rps' && G.m), veil:!!(document.querySelector('#veil') && document.querySelector('#veil').classList.contains('on')) }));
    if(st.m && !st.veil) return true;
    if(st.veil) await page.evaluate(() => { const bs = [...document.querySelectorAll('#modal button')]; const b = bs.find(x => /ncGo|hGo|mPri|start/i.test(x.id)) || bs[bs.length - 1]; if(b) b.click(); });
  }
  return page.evaluate(() => !!(G && G.id === 'rps' && G.m));
}
async function press(page, scr, pos, path){
  if(path === 'tap'){ const b = scr.btns[pos]; await page.mouse.click(b.x, b.y); }
  else await page.keyboard.press(KEYS[path][pos]);
}

const RUNS = [
  { name:'쉬움', lv:'easy' }, { name:'보통', lv:'normal' }, { name:'어려움', lv:'hard' },
  { name:'솔로 6 번개', adv:6 }, { name:'솔로 11 그림 지령', adv:11 }, { name:'솔로 16 자리 바꾸기', adv:16 }, { name:'솔로 21 하지 마라', adv:21 }, { name:'솔로 23 하지 마라', adv:23 },
  { name:'솔로 26 외줄 타기', adv:26 }, { name:'솔로 31 두 손', adv:31 }, { name:'솔로 41 아까처럼', adv:41 }, { name:'솔로 48 섞기', adv:48 }, { name:'솔로 50 보스', adv:50 }, { name:'솔로 57 리믹스', adv:57 }
].filter((r, i) => !QUICK || [1, 4, 5, 6, 9, 10, 12].includes(i));
const seen = { gap:0, noGap:0, tap:0, key:0, wrong:0, right:0, timeout:0, pump:0, dbl:0, two:0, not:0, last:0, hide:0, swap:0 };
let runIdx = 0;
for(const run of RUNS){
  const { page, errs } = await open();
  if(!ok(await startRun(page, run), run.name + ': 판이 시작되지 않음')){ await page.close(); continue; }
  /* 단계가 바뀐 게임 시각(m.t)을 화면 프레임마다 적어 둠(점검용, 판에 영향 없음) */
  await page.evaluate(() => { window.__ph = []; let k = ''; const f = () => { const m = G && G.m; if(m){ const s = m.i + ':' + m.phase; if(s !== k){ k = s; window.__ph.push({ i:m.i, phase:m.phase, t:m.t, marks:m.phase === 'fb' || m.phase === 'end' ? [...document.querySelectorAll('.ng-rps .rp-b')].map(b => b.className) : null }); } } requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const bad = [];
  let prevOrder = null, prevNot = false, prevPerm = null;
  const N = await page.evaluate(() => G.m.N);
  for(let i = 0; i < N; i++){
    await page.evaluate(() => { G.m.lives = 99; });   /* 점검 중엔 끝나지 않게 */
    /* 흔들기(손이 나오기 전) 중에 누르기 → 무시되어야 함 */
    const doPump = i % 5 === 2;
    if(doPump){
      await page.waitForFunction(k => { const s = NG.rps._test.state(); return s && s.i === k && s.phase === 'pump'; }, i, { timeout:8000 }).catch(() => {});
      const s0 = await stateOf(page);
      if(s0.phase === 'pump'){
        const scr0 = await readScreen(page);
        await press(page, scr0, (i + runIdx) % 3, 'tap');
        const s1 = await stateOf(page);
        if(s1.res !== s0.res) bad.push(`#${i} 흔들기 중 누름이 판정됨`);
        seen.pump++;
      }
    }
    const okGo = await page.waitForFunction(k => { const s = NG.rps._test.state(); return s && s.i === k && s.phase === 'go'; }, i, { timeout:8000 }).then(() => true).catch(() => false);
    if(!okGo){ bad.push(`#${i} 손이 나오지 않음`); break; }
    const scr = await readScreen(page), s0 = await stateOf(page);
    /* 화면만 보고 정답 계산 */
    let order = scr.medal, not = scr.notMark;
    if(!order){ bad.push(`#${i} 메달을 못 읽음`); break; }
    if(scr.text && scr.text !== (order === 'last' ? TXT.last : not ? NOT_TXT[order] : TXT[order])) bad.push(`#${i} 글자(${scr.text})와 메달(${order}${not ? ' 금지' : ''})이 다름`);
    if(order === 'last'){ if(!prevOrder){ bad.push(`#${i} 첫 문제가 아까처럼`); break; } seen.last++; order = prevOrder; not = prevNot; }
    if(not) seen.not++;
    if(!scr.text) seen.hide++;
    let opp;
    if(scr.opp.length === 2){
      seen.two++;
      if(!scr.side){ bad.push(`#${i} 두 손인데 화살표 꼬리표 없음`); break; }
      opp = scr.side === 'L' ? scr.opp[0].hand : scr.opp[1].hand;
    } else { opp = scr.opp[0] && scr.opp[0].hand; if(scr.side) bad.push(`#${i} 한 손인데 화살표 꼬리표`); }
    if(!opp){ bad.push(`#${i} 상대 손 그림을 못 읽음`); break; }
    scr.btns.forEach((b, p) => { if(b.hand !== b.label) bad.push(`#${i} ${p + 1}번 버튼 그림 ${b.hand} · 글자 ${b.label}`); if(b.h < 92) bad.push(`#${i} 버튼 높이 ${b.h}`); });
    const perm = scr.btns.map(b => b.hand).join();
    if(prevPerm && perm !== prevPerm) seen.swap++;
    prevPerm = perm;
    const want = refAnswer(opp, order, not), wantPos = scr.btns.map((b, p) => want.includes(b.hand) ? p : -1).filter(p => p >= 0);
    const gamePos = s0.pos.slice().sort().join();
    if(wantPos.join() !== gamePos) bad.push(`#${i} 정답 위치: 화면 기준 ${wantPos} · 게임 ${gamePos} (상대 ${opp} ${order}${not ? ' 금지' : ''})`);
    prevOrder = order; prevNot = not;
    const timeout = i % 9 === 6;
    if(timeout){
      await page.waitForFunction(k => G.m.res.length > k, s0.res, { timeout:6000 }).catch(() => {});
      const s1 = await stateOf(page), late = await page.evaluate(() => document.querySelector('#rpSign').classList.contains('late'));
      if(s1.lastOk !== false || !late) bad.push(`#${i} 시간 초과가 오답으로 안 됨`);
      seen.timeout++;
    } else {
      const pos = (i + runIdx) % 3, path = i % 4 === 1 ? 'tap' : i % 4 === 3 ? 'tap' : (i >> 1) % 3;
      const t0 = await page.evaluate(() => performance.now());
      await press(page, scr, pos, path);
      if(path === 'tap') seen.tap++; else seen.key++;
      const dbl = i % 6 === 4;
      if(dbl){ await press(page, scr, (pos + 1) % 3, path); seen.dbl++; }
      await page.waitForFunction(k => G.m.res.length > k, s0.res, { timeout:3000 }).catch(() => {});
      const s1 = await stateOf(page);
      const expect = wantPos.includes(pos);
      if(s1.res !== s0.res + 1) bad.push(`#${i} 판정 수 ${s1.res - s0.res}번(1번이어야)`);
      if(s1.lastOk !== expect) bad.push(`#${i} ${pos + 1}번(${scr.btns[pos].hand}) 누름: 기준 ${expect ? '정답' : '오답'} · 게임 ${s1.lastOk ? '정답' : '오답'} (상대 ${opp} ${order}${not ? ' 금지' : ''})`);
      await page.waitForFunction(k => (window.__ph || []).some(x => x.i === k && x.marks), i, { timeout:2000 }).catch(() => {});
      const marks = await page.evaluate(k => ((window.__ph || []).find(x => x.i === k && x.marks) || { marks:['', '', ''] }).marks, i);   /* 판정 바로 다음 프레임의 표시 */
      if(expect && !/\bok\b/.test(marks[pos])) bad.push(`#${i} 정답 표시 없음`);
      if(!expect){
        seen.wrong++;
        if(!/\bbad\b/.test(marks[pos])) bad.push(`#${i} 오답 표시 없음`);
        wantPos.forEach(p => { if(!/\bright\b/.test(marks[p])) bad.push(`#${i} 정답 손 알려 주기 없음`); });
        /* 틀리면 바로 다음으로: 판정 → 다음 흔들기까지 0.4초 이하(게임 시계) */
        if(i + 1 < N){
          await page.waitForFunction(k => { const s = NG.rps._test.state(); return s && s.i === k + 1; }, i, { timeout:3000 }).catch(() => {});
          const gap = await page.evaluate(k => { const L = window.__ph || [], a = L.find(x => x.i === k && x.phase === 'fb'), b = L.find(x => x.i === k + 1 && x.phase === 'pump'); return a && b ? b.t - a.t : null; }, i);
          if(gap == null) seen.noGap++;   /* 기록 프레임을 놓침(느린 점검 기기) → 재지 못함 */
          else{ seen.gap = Math.max(seen.gap, gap); if(gap > .4 + 1 / 30) bad.push(`#${i} 틀린 뒤 다음 손 준비까지 ${gap.toFixed(2)}초`); }
        }
      } else seen.right++;
      void t0;
    }
    if(bad.length > 12) break;
  }
  if(errs.length) bad.push('오류: ' + errs.slice(0, 3).join(' | '));
  ok(!bad.length, run.name + '\n    ' + bad.slice(0, 12).join('\n    '));
  if(!bad.length) console.log(`✓ ${run.name} ${N}문제: 화면 기준 판정 = 게임 판정`);
  await page.close(); runIdx++;
}
console.log(`   누른 길: 마우스 ${seen.tap} · 키보드 ${seen.key} · 맞힘 ${seen.right} · 틀림 ${seen.wrong} · 시간 초과 ${seen.timeout} · 흔들기 중 ${seen.pump} · 두 번 ${seen.dbl}`);
console.log(`   틀린 뒤 다음 손 준비까지 가장 길게 ${seen.gap.toFixed(2)}초(못 잰 것 ${seen.noGap}번)`);
ok(seen.noGap < 10, '틀린 뒤 간격을 거의 못 잼');
console.log(`   본 지령: 두 손 ${seen.two} · 하지 마라 ${seen.not} · 아까처럼 ${seen.last} · 그림 지령 ${seen.hide} · 버튼 자리 바뀜 ${seen.swap}`);
ok(seen.two && seen.not && seen.last && seen.hide && seen.swap, '어떤 지령 종류를 하나도 못 봄');

/* ================= 3) 봇: 정답만 0.3초에 → 성공 900점 이상 · 마구 누르기 → 실패 · 가만히 → 실패 ================= */
const BOTS = [['정답 봇 보통', { lv:'normal' }, 'perfect'], ['정답 봇 어려움', { lv:'hard' }, 'perfect'], ['정답 봇 스테이지 50', { adv:50 }, 'perfect'],
  ['마구 누르기 봇 보통', { lv:'normal' }, 'spam'], ['마구 누르기 봇 쉬움', { lv:'easy' }, 'spam'], ['가만히 봇 보통', { lv:'normal' }, 'idle']].filter((b, i) => !QUICK || i % 2 === 0);
for(const [name, how, kind] of BOTS){
  const { page, errs } = await open();
  if(!ok(await startRun(page, how), name + ': 시작 안 됨')){ await page.close(); continue; }
  await page.evaluate(kind => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    window.__bot = setInterval(() => { const s = NG.rps._test.state(); if(!s || G.over) return;
      if(kind === 'perfect' && s.phase === 'go' && s.rt >= .3) NG.rps._test.press(s.pos[0]);
      if(kind === 'spam') NG.rps._test.press(Math.floor(rnd() * 3)); }, kind === 'spam' ? 55 : 16);
  }, kind);
  await page.waitForFunction(() => G.m && G.m.done, null, { timeout:180000 }).catch(() => {});
  const r = await page.evaluate(() => ({ done:G.m.done, win:G.m.win, ok:G.m.ok, N:G.m.N, sc:G.m.win ? (c => c.base + c.time + c.paw)(calcScore()) : 0 }));
  const good = kind === 'perfect' ? r.win && r.sc >= 900 : r.done && !r.win;
  ok(good && !errs.length, `${name}: ${JSON.stringify(r)} ${errs.join(' | ')}`);
  if(good) console.log(`✓ ${name}: ${r.win ? '성공 ' + r.sc + '점' : '실패'} (정답 ${r.ok}/${r.N})`);
  await page.close();
}

await browser.close(); srv.close();
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
