// 쌍둥이 찾기(twin) 점검: 카드 만들기 대량 점검 + 자동 플레이 봇 + 사람 흉내 모형.
//   node tools/build.js && PW_CHROMIUM=/opt/pw-browsers/chromium node tools/twin-check.mjs [--gen-only] [--seeds=500]
// 1) 생성 점검(10만 문제 이상): 공통 그림 정확히 1개, 겹침 없음(누르는 자리까지), 그리는 크기·누르는 자리 바닥,
//    크기 차이(gap) 지킴, 같은 씨앗 = 같은 카드. 가장 작은 카드 크기(390×844·360×740에서 잰 값)로 px도 보여 줌.
// 2) 봇: 정답만 0.4초에 누르기(성공·900점 이상), 막 누르기·가만히(실패).
// 3) 사람 흉내 모형(그림 수·크기 차이·함정에 따라 찾는 시간이 늘어나는 단순 모형)으로 난이도별 성공률·점수.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN_ONLY = process.argv.includes('--gen-only');
const SEEDS = +((process.argv.find(a => a.startsWith('--seeds=')) || '').split('=')[1] || 500);
const T = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if(!fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type':T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
let bad = 0;

async function open(){
  const p = await browser.newPage({ viewport:{ width:390, height:844 } });
  p.on('pageerror', e => { console.log('  페이지 오류', String(e)); bad++; });
  await p.addInitScript(() => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:coach:twin', '1'); }catch(_){} });
  await p.goto(BASE + 'embed/twin.html?ns=chk'); await wait(700);
  return p;
}

/* ---------- 1) 생성 점검 ---------- */
{
  const p = await open();
  const res = await p.evaluate(SEEDS => {
    const M = NG.twin, out = { n:0, fail:{}, cases:[], ex:[], det:0 };
    /* 가장 작은 카드 반지름(px): 360×740에서 잰 값, 두 장 114(카드 지름 228) · 세 장 94(188) */
    const RPX = { 2:114, 3:94 };
    const cfgs = [];
    for(const lv of ['easy', 'normal', 'hard']) cfgs.push([lv, M.levels[lv], SEEDS * 2]);
    for(let n = 1; n <= 70; n++) cfgs.push(['s' + n, M._stage(n), Math.ceil(SEEDS / 12)]);
    for(const [name, cfg, ns] of cfgs){
      const st = { name, probs:0, minDraw:1e9, minHit:1e9, minRatio:1e9, sumRatio:0, maxR:0, fail:0 };
      for(let s = 1; s <= ns; s++){
        const P = M._gen(cfg, mulberry(s * 7919 + name.length));
        const why = M._check(P, cfg);
        if(why){ st.fail++; out.fail[why] = (out.fail[why] || 0) + 1; if(out.ex.length < 8) out.ex.push(name + ' 씨앗 ' + s + ': ' + why); }
        for(const q of P){
          const nc = q.cards.length, R = RPX[nc], ra = M._ratio(q);
          st.minRatio = Math.min(st.minRatio, ra); st.sumRatio += ra;
          for(const c of q.cards) for(const l of c.L){ st.minDraw = Math.min(st.minDraw, l.r * R * 2); st.minHit = Math.min(st.minHit, l.b * R * 2); st.maxR = Math.max(st.maxR, l.r); }
        }
        st.probs += P.length;
        if(s <= 3){ const Q = M._gen(cfg, mulberry(s * 7919 + name.length)); if(JSON.stringify(Q) !== JSON.stringify(P)){ out.det++; } }
      }
      out.n += st.probs;
      st.avgRatio = st.sumRatio / st.probs; delete st.sumRatio;
      out.cases.push(st);
    }
    return out;
  }, SEEDS);
  const stats = res.cases.filter(x => typeof x === 'object');
  console.log(`생성 점검: ${res.n.toLocaleString()}문제 · 실패 ${Object.values(res.fail).reduce((a, b) => a + b, 0)} ${JSON.stringify(res.fail)} · 같은 씨앗 다른 카드 ${res.det}`);
  res.ex.forEach(x => console.log('  ✗', x));
  const show = stats.filter(s => /^(easy|normal|hard|s1|s5|s10|s11|s15|s20|s21|s24|s30|s31|s35|s40|s41|s45|s50)$/.test(s.name));
  console.log('  판      그리기 최소px  누르기 최소px  공통 그림 크기비(최소·평균)  가장 큰 반지름');
  for(const s of show) console.log(`  ${s.name.padEnd(7)} ${s.minDraw.toFixed(1).padStart(8)} ${s.minHit.toFixed(1).padStart(12)} ${s.minRatio.toFixed(2).padStart(14)} · ${s.avgRatio.toFixed(2)} ${s.maxR.toFixed(3).padStart(12)}`);
  const all = stats.reduce((a, s) => ({ d:Math.min(a.d, s.minDraw), h:Math.min(a.h, s.minHit) }), { d:1e9, h:1e9 });
  console.log(`  전체: 그리기 최소 ${all.d.toFixed(1)}px · 누르기 최소 ${all.h.toFixed(1)}px`);
  if(res.n < 100000 || Object.keys(res.fail).length || res.det || all.h < 40) bad++;

  /* ---------- 3) 사람 흉내 모형 ----------
     찾는 시간 = 0.5 + 0.22초 × 그림 수 × (세 장 1.6) × (1 + 0.9×|ln 크기비|) × (빙글 1.15) × 잡음(로그정규 σ 0.3)
     닮은꼴 함정에서 가짜를 누를 확률 12%(가짜가 같은 크기면 18%) */
  const model = await p.evaluate(() => {
    const M = NG.twin, rows = [];
    const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
    const play = (cfg, seed) => {
      const P = M._gen(cfg, mulberry(seed)), r = mulberry(seed ^ 0x5bd1), lives0 = cfg.lives || 3; let lives = lives0, ok = 0, sp = 0, i = 0;
      const tb = [];
      for(const q of P){
        const k = q.cards[0].ids.length, ra = M._ratio(q), base = .22 * k * (q.cards.length === 3 ? 1.6 : 1) * (1 + .9 * Math.abs(Math.log(ra))) * (cfg.spin ? 1.15 : 1);
        const t = (.5 + base) * Math.exp(.3 * gauss(r)), fool = q.trap && r() < (cfg.lure ? .18 : .12);
        tb.push([ra, t]);
        i++;
        if(!fool && t < q.W){ ok++; sp += 1 - t / q.W; } else { lives--; if(lives <= 0) break; }
      }
      const win = lives > 0, sc = Math.round(500 * ok / P.length) + Math.round(350 * sp / P.length) + 50 * Math.max(0, lives);
      return { win, sc, tb };
    };
    const cfgs = [['easy', M.levels.easy], ['normal', M.levels.normal], ['hard', M.levels.hard], ['v1.0 nor', { N:25, k:6, w0:5, w1:3.5, trap:.25 }], ['v1.0 har', { N:30, k:7, w0:4.2, w1:3, trap:.35 }]];   /* v1.0(크기 차이 없음)과 비교 */
    for(const n of [1, 5, 10, 11, 21, 24, 30, 31, 41, 50]) cfgs.push(['s' + n, M._stage(n)]);
    const bucket = {};
    for(const [name, cfg] of cfgs){
      let w = 0, s = 0; const R = 400;
      for(let i = 1; i <= R; i++){ const g = play(cfg, i * 31 + 7); if(g.win){ w++; s += g.sc; } g.tb.forEach(([ra, t]) => { const b = ra < 1.15 ? '1.00~1.15' : ra < 1.4 ? '1.15~1.40' : ra < 1.8 ? '1.40~1.80' : '1.80+'; (bucket[b] = bucket[b] || [0, 0]); bucket[b][0] += t; bucket[b][1]++; }); }
      rows.push([name, Math.round(w / R * 100), w ? Math.round(s / w) : 0, cfg.w0, cfg.w1, (cfg.sz || []).join('~'), cfg.gap || 0]);
    }
    return { rows, bucket:Object.entries(bucket).sort().map(([b, [t, n]]) => [b, (t / n).toFixed(2), n]) };
  });
  console.log('사람 흉내 모형(400판씩): 판 · 성공률 · 성공 평균 점수(배율 전) · 창 · 크기 범위 · gap');
  for(const r of model.rows) console.log(`  ${r[0].padEnd(7)} ${String(r[1]).padStart(3)}% ${String(r[2]).padStart(5)}점  창 ${r[3]}→${r[4]}초  크기 ${r[5]}  gap ${r[6]}`);
  console.log('  공통 그림 크기비별 평균 찾는 시간: ' + model.bucket.map(([b, t, n]) => `${b} ${t}초(${n})`).join(' · '));
  await p.close();
}

/* ---------- 2) 봇 ---------- */
async function bot(kind, lv, stage){
  const p = await open();
  await p.evaluate(([lv, stage]) => { if(stage) startGame('twin', null, { adv:stage }); else startGame('twin', lv); }, [lv, stage]);
  await wait(400);
  for(let i = 0; i < 4; i++){ await p.evaluate(() => { const b = document.querySelector('#ncGo') || document.querySelector('#mOk'); if(b) b.click(); }); await wait(250); }
  const t0 = Date.now();
  let lastT = -1;
  while(Date.now() - t0 < 120000){
    const st = await p.evaluate(() => ({ over:!!G.over, ph:G.m && G.m.phase, i:G.m && G.m.i, el:G.m ? elapsed() * 1000 - G.m.t0 : 0 }));
    if(st.over) break;
    if(kind === 'perfect' && st.ph === 'show' && st.el >= 400 && st.i !== lastT){
      lastT = st.i;
      const pt = await p.evaluate(() => G.m._answerPoint());
      if(pt) await p.mouse.click(pt.x, pt.y);
    } else if(kind === 'spam'){
      const r = await p.evaluate(() => { const t = document.querySelector('#twTable').getBoundingClientRect(); return { x:t.left, y:t.top, w:t.width, h:t.height }; });
      for(let j = 0; j < 3; j++) await p.mouse.click(r.x + r.w * (.2 + .6 * Math.random()), r.y + r.h * (.1 + .8 * Math.random()));
    }
    await wait(kind === 'spam' ? 90 : 40);
  }
  await wait(1700);
  const out = await p.evaluate(() => { const m = G.m, q = NG.twin.score(); return { win:m.lives > 0 && m.done >= m.N, done:m.done, N:m.N, correct:m.correct, wrong:m.wrong, raw:q.base + q.time + q.extra, mult:G.L.mult, stars:NG.twin.stars() }; });
  await p.close();
  return out;
}
if(!GEN_ONLY){
  for(const [kind, lv, st] of [['perfect', 'easy'], ['perfect', 'normal'], ['perfect', 'hard'], ['perfect', null, 21], ['perfect', null, 41], ['spam', 'normal'], ['idle', 'normal']]){
    const r = await bot(kind, lv, st);
    const okBot = kind === 'perfect' ? r.win && r.raw >= 900 : !r.win && r.done <= 6;
    if(!okBot) bad++;
    console.log(`${okBot ? '✓' : '✗'} 봇 ${kind} ${lv || '솔로 ' + st}: ${r.win ? '성공' : '실패'} ${r.correct}/${r.N} 오답 ${r.wrong} · 점수(배율 전) ${r.raw} ×${r.mult} · 별 ${r.stars} · ${r.done}문제 만에 끝`);
  }
}
await browser.close(); srv.close();
console.log(bad ? `✗ 문제 ${bad}개` : '모두 통과');
process.exit(bad ? 1 : 0);
