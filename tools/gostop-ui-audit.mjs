// 고스톱 화면 검수 도구(테스트팀): 브라우저에서 실제로 여러 판을 두면서 장면마다 UI 겹침·넘침·잘림·오류를 자동으로 찾는다.
//
// 쓰는 법(먼저 node tools/build.js 로 빌드해 둘 것 — 이 도구는 빌드하지 않음)
//   node tools/gostop-ui-audit.mjs                       기본: 가로 1366×768 + 세로 390×844, 솔로 6판 + AI 대전 연속 판(뷰포트마다)
//   node tools/gostop-ui-audit.mjs --solo 1,7,25 --duel 3 --vp land --par 3
//   node tools/gostop-ui-audit.mjs --rounds 2            같은 구성을 2번(판 수 늘리기)
//   옵션
//     --vp land,port        뷰포트(land = 가로 1366×768 데스크톱·마우스 올림 있음, port = 세로 휴대폰 390×844 터치·판이 90° 돌아감)
//     --solo 1,6,15,25,38,45  솔로 스테이지 번호(판마다 새 페이지)
//     --duel N              AI 대전에서 연속으로 둘 판 수(N판째에 나가기 예약 → 대전 끝). 0이면 대전 안 함
//     --lazy                AI 대전 한 묶음을 더: 내 차례에 시계가 2.5초 아래(울상)일 때까지 기다렸다 냄 → 시계 링·초·표정 상태도 검사
//     --rounds R            위 구성을 R번 반복(매번 다른 판 · 솔로 씨앗은 기기 판 번호라 페이지마다 다름)
//     --par P               동시에 돌릴 브라우저 페이지 수(기본 4)
//     --out DIR             스크린샷·결과(audit.json) 저장 폴더(기본: 환경변수 AUDIT_DIR 또는 scratch/gostop-audit)
//     --shots K             문제 종류마다 저장할 스크린샷 수(기본 1, 뷰포트별)
//   결과: 콘솔에 문제 종류별(심각한 순) 횟수·최대 px·예시 상황·판 좌표·스크린샷 경로, DIR/audit.json 에 전체.
//   문제가 있으면 종료 코드 1.
//
// 검사 방법
//   - 판 좌표 = 판(#gsb, 1630×923) 기준 px. HTML 요소는 offsetLeft/Top 사슬로(움직임·transform 무시 = 자리 잡은 뒤 위치),
//     선 뽑기 화면·SVG(시계 링)처럼 transform이 위치를 정하는 것은 getBoundingClientRect를 판의 scale/rotate를 되돌려 계산.
//   - 장면 = 판 DOM이 바뀔 때마다(MutationObserver, 패 한 장면·뒤집기·먹기·창 열림) + 0.4초마다(시계·표정) + 마우스 올림 직후.
//   - 연출 층(.gsfx-l)·파티클 캔버스·FLIP 비행 중 위치는 겹침 검사에서 뺀다. 대신 연출 DOM이 생긴 뒤 안 지워지고 남아 있으면 문제
//     (연출은 1.58초에 지움. 동시 실행 부하로 타이머가 늦는 것을 빼려고 4초 넘게 남은 것만 보고).
//   - 로컬 서버라 바깥 API(사이트 등록 등) CORS·네트워크 오류는 콘솔 오류에서 뺀다.
//   - 같은 종류(같은 두 요소 짝) 문제는 묶어서 센다. 처음 나올 때 겹친 곳에 빨간/파란 테두리를 그려 스크린샷.
//   - 겹침 허용 오차 1px(가장자리 맞닿음은 문제 아님).
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const VPS = opt('vp', 'land,port').split(',').filter(Boolean);
const SOLO = opt('solo', '1,6,15,25,38,45').split(',').filter(Boolean).map(Number);
const DUELN = +opt('duel', '4');
const ROUNDS = +opt('rounds', '1');
const PAR = +opt('par', '4');
const SHOTS_PER = +opt('shots', '1');
const OUT = path.resolve(opt('out', process.env.AUDIT_DIR || path.join(ROOT, 'scratch', 'gostop-audit')));
fs.mkdirSync(OUT, { recursive:true });
const VIEW = {
  land:{ viewport:{ width:1366, height:768 }, deviceScaleFactor:1 },
  port:{ viewport:{ width:390, height:844 }, deviceScaleFactor:2, isMobile:true, hasTouch:true },
};

/* ---- 로컬 정적 서버 ---- */
const T = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if(!fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type':T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const B = `http://127.0.0.1:${srv.address().port}/`; const w = ms => new Promise(r => setTimeout(r, ms));

/* ---- 가짜 중계 서버(server/index.ts와 같은 동작, AI 대전에선 대기실 연결만) ---- */
const rooms = new Map(), last = new Map(); let N = 0;
const snapP = r => [...(rooms.get(r) || [])].map(c => ({ peer:c.id, presence:c.rooms.get(r) || {} }));
function flush(r){ const set = rooms.get(r); const peers = snapP(r), ids = peers.map(p => p.peer), prev = last.get(r) || [];
  const joined = ids.filter(x => !prev.includes(x)).map(peer => ({ peer })), left = prev.filter(x => !ids.includes(x)).map(peer => ({ peer }));
  if(!set || !set.size){ rooms.delete(r); last.delete(r); return; } last.set(r, ids);
  for(const c of set) c.send({ t:'peers', r, you:c.id, peers, joined, left }); }
function leave(c, r){ if(!c.rooms.has(r)) return; c.rooms.delete(r); const s = rooms.get(r); if(s){ s.delete(c); flush(r); } }
function attach(ws){ const c = { id:'p' + (++N) + 'x' + Math.random().toString(36).slice(2, 8), rooms:new Map(), send:m => { try{ ws.send(JSON.stringify(m)); }catch(_){} } };
  c.send({ t:'hello', you:c.id, now:Date.now() });
  ws.onMessage(raw => { let m; try{ m = JSON.parse(String(raw)); }catch{ return; }
    if(m.t === 'ping'){ c.send({ t:'pong', now:Date.now() }); return; }
    const r = typeof m.r === 'string' ? m.r.slice(0, 64) : ''; if(!r) return;
    if(m.t === 'join'){ if(c.rooms.has(r)){ flush(r); return; } let s = rooms.get(r); if(!s){ s = new Set(); rooms.set(r, s); } s.add(c); c.rooms.set(r, {}); flush(r); }
    else if(m.t === 'leave') leave(c, r);
    else if(m.t === 'p'){ const cur = c.rooms.get(r); if(!cur || !m.p) return; c.rooms.set(r, { ...cur, ...m.p }); setTimeout(() => flush(r), r.startsWith('fl-') ? 0 : 60); } });
  ws.onClose(() => { for(const r of [...c.rooms.keys()]) leave(c, r); }); }

/* =====================================================================================
   브라우저 안에서 도는 검수 코드(페이지마다 addInitScript로 심음)
   window.__AUD = { 서명: { kind, sig, w(무게), n(횟수), max(px), ex(가장 큰 예시 상황), at(판 좌표), first } }
   ===================================================================================== */
function pageAudit(){
  const BW = 1630, BH = 923, TOL = 1;
  /* G는 엔진의 전역 let(window 속성이 아님) */
  const GG = () => { try{ return G; }catch(_){ return null; } };
  const A = window.__AUD = {}; window.__AUDN = 0;
  const born = new WeakMap();          /* 연출 DOM 생긴 때 */
  let shotQ = Promise.resolve(), shotsLeft = 400;
  const $ = s => document.querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const gsb = () => document.getElementById('gsb');
  const R = b => b && `(${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)})`;
  /* 판 좌표: offset 사슬(transform·애니메이션 무시) */
  function lay(el){
    const root = gsb(); if(!el || !root || !el.isConnected) return null;
    if(!(el instanceof HTMLElement)) return vis(el);
    if(el.offsetParent === null && el !== root) return null;   /* 숨김 */
    let x = 0, y = 0, e = el;
    while(e && e !== root){ x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    if(e !== root) return null;
    if(!el.offsetWidth && !el.offsetHeight) return null;
    return { x, y, w:el.offsetWidth, h:el.offsetHeight };
  }
  /* 판 좌표: 화면 사각형 → 판(scale/rotate 되돌림) */
  function vis(el){
    const root = gsb(), g = GG() && GG().gs; if(!el || !root || !g) return null;
    const r = el.getBoundingClientRect(); if(!r.width && !r.height) return null;   /* el은 getBoundingClientRect만 있으면 됨 */
    const b = root.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, S = g.sc || 1;
    const P = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]].map(([sx, sy]) => { const dx = sx - cx, dy = sy - cy; return g.rot ? [dy / S + BW / 2, -dx / S + BH / 2] : [dx / S + BW / 2, dy / S + BH / 2]; });
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w:Math.max(...xs) - x, h:Math.max(...ys) - y };
  }
  const uni = L => { L = L.filter(Boolean); if(!L.length) return null; const x = Math.min(...L.map(b => b.x)), y = Math.min(...L.map(b => b.y)); return { x, y, w:Math.max(...L.map(b => b.x + b.w)) - x, h:Math.max(...L.map(b => b.y + b.h)) - y }; };
  const ov = (a, b) => { if(!a || !b) return null; const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > TOL && h > TOL ? { w:Math.round(w), h:Math.round(h), x:Math.round(Math.max(a.x, b.x)), y:Math.round(Math.max(a.y, b.y)) } : null; };
  /* a가 box 밖으로 나간 양(px): 왼·위·오른·아래 중 최대 */
  const out = (a, box) => { if(!a || !box) return 0; return Math.round(Math.max(box.x - a.x, box.y - a.y, a.x + a.w - (box.x + box.w), a.y + a.h - (box.y + box.h), 0)); };
  const shown = el => { if(!el || !el.isConnected) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > .05; };
  const MON = m => m + '월';
  const RU = () => (typeof NG !== 'undefined' && NG.gostop && NG.gostop._rules) || null;
  const mon = id => { const r = RU(); return r && r.C[id] ? r.C[id].m : null; };
  /* 지금 상황(예시로 남김) */
  function ctx(scene){
    const g = GG() && GG().gs; if(!g) return scene;
    const s = [scene];
    try{
      if(g.S && g.phase === 'play'){
        const r = RU(), S = g.S, me = g.me, op = 1 - me;
        const fm = {}; S.floor.forEach(id => { const m = r.C[id] && r.C[id].m; fm[m] = (fm[m] || 0) + 1; });
        const sc = p => r.scoreOf(S.P[p].cap);
        const a = sc(me), b = sc(op);
        s.push(`${g.gi + 1}판 ${g.k}수`, `바닥 ${Object.entries(fm).map(([m, n]) => m + '월×' + n).join(' ') || '없음'}${S.ppuk && Object.keys(S.ppuk).length ? ' · 뻑 ' + Object.keys(S.ppuk).map(MON).join(',') : ''}`,
          `더미 ${S.deck.length}`, `손 ${S.P[me].hand.length}장`,
          `내 먹은 패 광${a.gN} 열${a.yN} 띠${a.tN} 피${a.piV}(${S.P[me].cap.length}장)`, `상대 광${b.gN} 열${b.yN} 띠${b.tN} 피${b.piV}(${S.P[op].cap.length}장)`,
          `고 ${S.P[me].go}/${S.P[op].go} 흔들 ${S.P[me].shake}/${S.P[op].shake} 뻑 ${S.P[me].ppuk || 0}/${S.P[op].ppuk || 0}`);
        const tags = $$('#gsOpp .gs-ps b').map(b => b.textContent).concat(['|'], $$('#gsMe .gs-ps b').map(b => b.textContent));
        if(tags.length > 1) s.push('태그 ' + tags.join(' '));
      } else s.push('단계 ' + g.phase);
    }catch(_){}
    return s.join(' · ');
  }
  /* 문제 하나 기록 */
  function hit(kind, w, sig, px, at, scene, marks){
    let e = A[sig];
    const first = !e;
    if(!e) e = A[sig] = { kind, w, sig, n:0, max:0, ex:'', at:'', shots:[] };
    e.n++; window.__AUDN++;
    if(px >= e.max){ e.max = px; e.ex = ctx(scene); e.at = at; }
    if(first && shotsLeft > 0 && typeof window.__audShot === 'function'){ shotsLeft--; shot(sig, marks); }
  }
  function shot(sig, marks){
    window.__audPend = (window.__audPend || 0) + 1;   /* 사진 찍는 동안 도구 쪽 '사람'은 손을 멈춤 */
    shotQ = shotQ.then(async () => {
      const root = gsb(); const ovs = [];
      try{
        (marks || []).forEach((b, i) => { if(!b || !root) return; const d = document.createElement('div'); d.className = 'aud-ov';
          d.style.cssText = `position:absolute;left:${b.x - 3}px;top:${b.y - 3}px;width:${b.w + 6}px;height:${b.h + 6}px;border:5px ${i ? 'dashed #00E0FF' : 'solid #FF1744'};box-sizing:border-box;z-index:9999;pointer-events:none;border-radius:4px`;
          root.appendChild(d); ovs.push(d); });
        /* 패가 날아가는 중이면 자리 잡을 때까지 잠깐(최대 0.7초) 기다렸다 찍음 */
        for(let t = 0; t < 7 && document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#gsBody, #gsSun') && a.effect.getComputedTiming().iterations !== Infinity); t++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => requestAnimationFrame(() => r()));
        const f = await window.__audShot(sig);
        if(f && A[sig]) A[sig].shots.push(f);
      }catch(_){}
      ovs.forEach(d => d.remove());
      window.__audPend--;
    });
  }
  const nm = el => el.id ? '#' + el.id : '.' + [...el.classList].join('.');

  /* ---------------- 검사들 ---------------- */
  function auditBody(scene){
    const body = $('#gsBody'); if(!body || body.hidden || !RU()) return;
    const g = GG().gs;
    const BOARD = { x:0, y:0, w:BW, h:BH };
    const trayOp = lay($('.gs-tray.op')), trayMe = lay($('.gs-tray.me'));
    const ptsOp = lay($('#gsPtsOp')), ptsMe = lay($('#gsPtsMe')), tag = lay($('#gsTag')), auto = lay($('#gsAuto'));
    const deckEls = $$('#gsDeck > *').map(el => ({ el, b:lay(el), nm:el.classList.contains('gs-dn') ? '더미 장수' : '더미 패' })).filter(x => x.b);
    const side = [['상대 프로필', '#gsOpp'], ['내 패 정보', '#gsInfo'], ['단추 줄', '.gs-side .gs-btns'], ['내 프로필', '#gsMe'], ['알림 칸', '#gsMsg']].map(([n, s]) => {
      const el = $(s); const b = lay(el); if(!b) return null;
      /* 칸 + 칸 밖으로 튀어나온 표시(태그·시계 링·초) */
      const parts = [['칸', b]];
      if(el.classList.contains('gs-prof')){
        const ps = el.querySelector('.gs-ps'); if(ps && ps.children.length) parts.push(['상태 태그(.gs-ps)', lay(ps)]);
        /* 시계 링(SVG): 화면 사각형은 흔들기 연출(fxShake)에 따라 움직이므로 얼굴 칸 위치 + CSS left/top/width/height로 */
        const ring = el.querySelector('.gs-ring'); if(ring && shown(ring)){ const pv = lay(ring.parentElement), cs = getComputedStyle(ring); if(pv) parts.push(['시계 링', { x:pv.x + parseFloat(cs.left), y:pv.y + parseFloat(cs.top), w:parseFloat(cs.width), h:parseFloat(cs.height) }]); }
        const sec = el.querySelector('.gs-sec'); if(sec && shown(sec)) parts.push(['남은 초', lay(sec)]);
      }
      return { n, el, b, parts, ext:uni(parts.map(p => p[1])) };
    }).filter(Boolean);
    /* 1) 바닥 패: 월 묶음끼리, 더미·점수 동전·이름표·먹은 패 줄·손패·오른쪽 패널과 */
    const groups = {};
    $$('#gsFloor .gs-c').forEach(el => { const m = mon(+el.dataset.cid); const b = lay(el); if(!b) return; (groups[m] = groups[m] || []).push(b); });
    const G2 = Object.entries(groups).map(([m, L]) => ({ m:+m, b:uni(L), n:L.length }));
    for(let i = 0; i < G2.length; i++) for(let j = i + 1; j < G2.length; j++){
      const o = ov(G2[i].b, G2[j].b);
      if(o) hit('바닥 패 겹침', 60, `바닥: ${MON(G2[i].m)} 묶음(${G2[i].n}장) ↔ ${MON(G2[j].m)} 묶음(${G2[j].n}장) 겹침`, o.w * o.h, `겹친 곳 ${o.w}×${o.h}px @(${o.x},${o.y}) · ${R(G2[i].b)} / ${R(G2[j].b)}`, scene, [G2[i].b, G2[j].b]);
    }
    const others = [['점수 동전(상대)', ptsOp], ['점수 동전(나)', ptsMe], ['판 이름표', tag], ['자동 치기', auto], ['위 먹은 패 쟁반', trayOp], ['아래 먹은 패 쟁반', trayMe], ...deckEls.map(d => [d.nm, d.b]), ...side.map(s => [s.n, s.ext])];
    for(const gr of G2) for(const [on, ob] of others){
      const o = ov(gr.b, ob);
      if(o) hit('바닥 패 겹침', 60, `바닥 ${MON(gr.m)} 묶음 ↔ ${on} 겹침`, Math.max(o.w, o.h), `겹친 곳 ${o.w}×${o.h}px @(${o.x},${o.y}) · 묶음 ${gr.n}장 ${R(gr.b)} / ${on} ${R(ob)}`, scene, [gr.b, ob]);
    }
    /* 바닥 패 ↔ 손패 */
    const hand = $$('#gsHand .gs-c.hd').map(el => ({ el, b:lay(el), id:+el.dataset.cid, match:el.classList.contains('match') })).filter(x => x.b);
    for(const gr of G2) for(const h of hand){ const o = ov(gr.b, h.b); if(o) hit('바닥 패 겹침', 60, `바닥 ${MON(gr.m)} 묶음 ↔ 손패 겹침`, o.h, `겹친 곳 ${o.w}×${o.h}px @(${o.x},${o.y})`, scene, [gr.b, h.b]); }
    /* 뻑 표시 */
    $$('#gsFloor .gs-ppk').forEach(el => {
      const b = lay(el); if(!b) return;
      for(const gr of G2){
        /* 자기 묶음 위에 올라가는 건 정상: 가장 가까운 묶음을 자기 것으로 */
        const own = G2.slice().sort((a, c) => Math.abs(a.b.x + a.b.w / 2 - (b.x + b.w / 2)) + Math.abs(a.b.y - b.y) - (Math.abs(c.b.x + c.b.w / 2 - (b.x + b.w / 2)) + Math.abs(c.b.y - b.y)))[0];
        if(gr === own) continue;
        const o = ov(b, gr.b); if(o) hit('뻑 표시 겹침', 50, `뻑 표시 ↔ 다른 월(${MON(gr.m)}) 패 겹침`, o.w * o.h, `${o.w}×${o.h}px @(${o.x},${o.y}) 뻑 ${R(b)}`, scene, [b, gr.b]);
      }
      for(const [on, ob] of others){ const o = ov(b, ob); if(o) hit('뻑 표시 겹침', 50, `뻑 표시 ↔ ${on} 겹침`, o.w * o.h, `${o.w}×${o.h}px @(${o.x},${o.y}) 뻑 ${R(b)} / ${R(ob)}`, scene, [b, ob]); }
      if(out(b, BOARD)) hit('판 밖', 80, '뻑 표시가 판 밖', out(b, BOARD), R(b), scene, [b]);
    });
    /* 2) 먹은 패 줄 */
    for(const [who, sel, tray] of [['상대', '#gsCapOp', trayOp], ['나', '#gsCapMe', trayMe]]){
      const kids = $$(sel + ' > *'); let gi = 0; const grp = [[]], cnts = [];
      const KN = { kg:'광', ky:'열끗', kt:'띠', kp:'피' };
      kids.forEach(el => { const b = lay(el); if(!b) return; if(el.classList.contains('gs-cnt')){ cnts.push({ el, b, gi, k:KN[[...el.classList].find(c => KN[c])] || '?' }); gi++; grp[gi] = []; } else grp[gi].push({ el, b }); });
      const gnm = i => (cnts[i] && cnts[i].k) || '?';
      const cards = grp.flat();
      if(tray){
        const cb = uni(cards.map(c => c.b));
        const o = out(cb, tray); if(cb && o) hit('먹은 패 넘침', 70, `먹은 패(${who})가 쟁반 밖으로 넘침`, o, `패 ${R(cb)} / 쟁반 ${R(tray)} · ${cards.length}장`, scene, [cb, tray]);
      }
      for(const c of cnts){
        if(tray){ const o = out(c.b, tray); if(o) hit('장수 표시', 30, `장수 표시(${who})가 쟁반 밖으로 나감`, o, `${o}px · ${c.k} ${R(c.b)} / 쟁반 ${R(tray)} · 글자 "${c.el.textContent}"`, scene, [c.b, tray]); }
        grp.forEach((L, i) => { if(i === c.gi) return; for(const x of L){ const o = ov(c.b, x.b); if(o){ hit('장수 표시', 45, `장수 표시(${who}·${c.k})가 ${gnm(i)} 묶음 패를 가림`, o.w * o.h, `${o.w}×${o.h}px @(${o.x},${o.y}) · "${c.el.textContent}" ${R(c.b)}`, scene, [c.b, x.b]); break; } } });
        for(const h of hand){ const o = ov(c.b, h.b); if(o) hit('장수 표시', 45, `장수 표시(${who}) ↔ 손패 겹침${h.b.y >= 683 ? '' : h.b.y >= 669 ? '(올라간 패 .match)' : '(마우스 올림)'}`, o.h, `${o.w}×${o.h}px @(${o.x},${o.y}) · ${c.k} 장수 "${c.el.textContent}" ${R(c.b)} / 손패 ${R(h.b)}`, scene, [c.b, h.b]); }
      }
      const cb = uni(cards.map(c => c.b).concat(cnts.map(c => c.b)));
      for(const [on, ob] of [['점수 동전(상대)', ptsOp], ['점수 동전(나)', ptsMe], ['판 이름표', tag], ...side.map(s => [s.n, s.ext])]){
        for(const x of cards.concat(cnts)){ const o = ov(x.b, ob); if(o){ hit('먹은 패 겹침', 55, `먹은 패 줄(${who}) ↔ ${on} 겹침`, o.w * o.h, `${o.w}×${o.h}px @(${o.x},${o.y}) · 줄 ${R(cb)} / ${on} ${R(ob)} · ${cards.length}장`, scene, [x.b, ob]); break; } }
      }
    }
    /* 3) 손패 */
    const capMe = $$('#gsCapMe > *').map(el => lay(el)).filter(Boolean);
    for(const h of hand){
      const tagH = h.b.y >= 683 ? '' : h.b.y >= 669 ? '(낼 수 있어 올라간 패 .match, top 669)' : `(마우스 올림 :hover, top ${h.b.y})`;
      const tests = [['자동 치기 단추', auto], ['점수 동전(나)', ptsMe], ['아래 먹은 패 쟁반', trayMe], ...side.map(s => [s.n, s.ext])];
      for(const [on, ob] of tests){ const o = ov(h.b, ob); if(o) hit('손패 겹침', 65, `손패 ↔ ${on} 겹침${tagH}`, o.h * 1000 + o.w, `${o.w}×${o.h}px @(${o.x},${o.y}) · 손패 ${R(h.b)} / ${on} ${R(ob)} · 손 ${hand.length}장`, scene, [h.b, ob]); }
      for(const cb of capMe){ const o = ov(h.b, cb); if(o){ hit('손패 겹침', 65, `손패 ↔ 먹은 패 줄(나) 겹침${tagH}`, o.h, `${o.w}×${o.h}px @(${o.x},${o.y}) · 손패 ${R(h.b)}`, scene, [h.b, cb]); break; } }
      if(out(h.b, BOARD)) hit('판 밖', 80, `손패가 판 밖${tagH}`, out(h.b, BOARD), `${R(h.b)} · 손 ${hand.length}장`, scene, [h.b]);
    }
    /* 4) 오른쪽 패널: 서로 겹침 */
    for(let i = 0; i < side.length; i++) for(let j = i + 1; j < side.length; j++){
      for(const [pa, ba] of side[i].parts) for(const [pb, bb] of side[j].parts){
        const o = ov(ba, bb);
        if(o) hit('오른쪽 패널 겹침', 75, `${side[i].n}${pa === '칸' ? '' : '의 ' + pa} ↔ ${side[j].n}${pb === '칸' ? '' : '의 ' + pb} 겹침`, o.w * o.h, `${o.w}×${o.h}px @(${o.x},${o.y}) · ${R(ba)} / ${R(bb)}`, scene, [ba, bb]);
      }
    }
    /* 오른쪽 패널 ↔ 자동 치기 / 점수 동전 / 이름표 */
    for(const s of side) for(const [on, ob] of [['자동 치기', auto], ['점수 동전(상대)', ptsOp], ['점수 동전(나)', ptsMe], ['판 이름표', tag]]){ const o = ov(s.ext, ob); if(o) hit('오른쪽 패널 겹침', 75, `${s.n} ↔ ${on} 겹침`, o.w * o.h, `${o.w}×${o.h}px @(${o.x},${o.y})`, scene, [s.ext, ob]); }
    /* 판 이름표 ↔ 점수 동전·쟁반 */
    for(const [on, ob] of [['점수 동전(상대)', ptsOp], ['점수 동전(나)', ptsMe], ['위 먹은 패 쟁반', trayOp]]){ const o = ov(tag, ob); if(o) hit('이름표 겹침', 40, `판 이름표 ↔ ${on} 겹침`, o.w * o.h, `${o.w}×${o.h}px @(${o.x},${o.y})`, scene, [tag, ob]); }
    /* 5) 패널 안 글자·표시가 칸 밖으로 넘치거나 잘림 */
    textCheck(scene, [
      ['.gs-prof .gs-pn', '프로필 이름'], ['.gs-prof .gs-ptv', '프로필 포인트'], ['.gs-prof .gs-sub', '프로필 설명 줄'], ['.gs-prof .gs-ps', '상태 태그 줄'],
      ['#gsInfo .gs-ih', '내 패 정보 제목'], ['#gsInfo .gs-ir', '내 패 정보 숫자 줄'], ['#gsInfo .gs-ir2', '내 패 정보 배수 줄'], ['#gsInfo', '내 패 정보 칸'],
      ['.gs-side .gs-btns button', '오른쪽 단추'], ['#gsMsg', '알림 칸'], ['#gsTag', '판 이름표'], ['#gsTag b', '판 이름표 글자'], ['#gsAuto', '자동 치기'], ['.gs-pts', '점수 동전'],
    ]);
    /* 패널 자식이 패널 밖으로(태그·링·초는 일부러 튀어나옴 → 위 겹침 검사로) */
    for(const s of side){
      const box = s.b;
      $$('*', s.el).forEach(el => {
        if(el.closest('.gs-ps, .gs-pav, .gs-timer') && !el.matches('.gs-ps')) return;
        if(el.matches('.gs-ps, .gs-pav, .gs-ring, .gs-sec, .gs-sweat, svg, svg *')) return;
        if(!shown(el)) return;
        const b = lay(el); if(!b) return; const o = out(b, box);
        if(o > 2) hit('글자 넘침', 50, `${s.n} 안 ${nm(el)}가 칸 밖으로 나감`, o, `${o}px · ${R(b)} / 칸 ${R(box)} · "${(el.textContent || '').trim().slice(0, 30)}"`, scene, [b, box]);
      });
      /* 상태 태그: 숨겨진(잘린) 태그 */
      const ps = s.el.querySelector('.gs-ps');
      if(ps){ const pb = lay(ps); $$('b', ps).forEach(t => { const tb = lay(t); if(tb && pb && tb.x + tb.w > pb.x + pb.w + 1) hit('글자 잘림', 70, `${s.n} 상태 태그가 줄 밖이라 안 보임: "${t.textContent}"`, Math.round(tb.x + tb.w - pb.x - pb.w), `태그 ${R(tb)} / 줄 ${R(pb)} · 태그 ${$$('b', ps).map(x => x.textContent).join(',')}`, scene, [tb, pb]); }); }
    }
    /* 5b) 움직임이 다 끝났는데 보이는 위치가 제자리(레이아웃)와 다른 패 = 연출이 남긴 transform */
    const moving = document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#gsBody') && a.effect.getComputedTiming().iterations !== Infinity);
    if(!moving){
      $$('#gsFloor .gs-c, #gsHand .gs-c, #gsCapOp .gs-c, #gsCapMe .gs-c, #gsDeck .gs-c').forEach(el => {
        const a = lay(el), v = vis(el); if(!a || !v) return;
        const d = Math.round(Math.max(Math.abs(a.x - v.x), Math.abs(a.y - v.y), Math.abs(a.w - v.w), Math.abs(a.h - v.h)));
        if(d > 3) hit('패 위치 어긋남', 60, `움직임이 끝났는데 패가 제자리에 안 있음(${el.parentElement.id})`, d, `${d}px · 제자리 ${R(a)} / 보이는 곳 ${R(v)} · transform ${getComputedStyle(el).transform}`, scene, [a, v]);
      });
    }
    /* 6) 판 밖 */
    const all = [...$$('#gsFloor > *'), ...$$('#gsDeck > *'), ...$$('#gsCapOp > *'), ...$$('#gsCapMe > *'), ...$$('.gs-pts, .gs-tag, .gs-auto, .gs-tray'), ...side.map(s => s.el)];
    all.forEach(el => { const b = lay(el); const o = out(b, BOARD); if(o) hit('판 밖', 80, `${nm(el)}가 판(1630×923) 밖`, o, R(b), scene, [b]); });
    side.forEach(s => { const o = out(s.ext, BOARD); if(o) hit('판 밖', 80, `${s.n}(튀어나온 표시 포함)가 판 밖`, o, R(s.ext), scene, [s.ext]); });
  }
  function textCheck(scene, list, kind){
    for(const [sel, n] of list) $$(sel).forEach(el => {
      if(!shown(el) || el.closest('[hidden]')) return;
      const cs = getComputedStyle(el), clip = /hidden|clip/.test(cs.overflowX) || cs.textOverflow === 'ellipsis';
      const dw = el.scrollWidth - el.clientWidth, dh = el.scrollHeight - el.clientHeight;
      const who = el.closest('#gsOpp') ? '(상대)' : el.closest('#gsMe') ? '(나)' : '';
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if(dw > 1) hit(kind || (clip ? '글자 잘림' : '글자 넘침'), clip ? 55 : 50, `${n}${who} 가로 ${clip ? '잘림' : '넘침'}`, dw, `${dw}px · 칸 ${el.clientWidth}px 글자 ${el.scrollWidth}px · "${txt}"`, scene, [lay(el)]);
      const vclip = /hidden|clip/.test(cs.overflowY);
      /* 세로는 잘리는 칸(overflow hidden)만. 한 줄 글자(줄 높이 = 칸 높이)는 글꼴 위아래 여백 때문에 scrollHeight가 2~4px 크게 나옴 → 4px 넘어야 문제 */
      if(dh > 4 && vclip) hit(kind || (vclip ? '글자 잘림' : '글자 넘침'), vclip ? 55 : 50, `${n}${who} 세로 ${vclip ? '잘림' : '넘침'}`, dh, `${dh}px · 칸 ${el.clientHeight}px 내용 ${el.scrollHeight}px · "${txt}"`, scene, [lay(el)]);
      /* 가운데 정렬 flex 칸(알림)은 위로도 넘쳐 scrollHeight에 안 잡힘 → 자식 높이로 */
      if(el.id === 'gsMsg'){ const sp = el.firstElementChild; if(sp && sp.offsetHeight > el.clientHeight + 1) hit('글자 잘림', 55, `${n} 글자가 칸보다 높아 위아래 잘림`, sp.offsetHeight - el.clientHeight, `글자 ${sp.offsetHeight}px / 칸 ${el.clientHeight}px · "${txt}"`, scene, [lay(el)]); }
    });
  }
  function auditAsk(scene){
    const box = $('#gsAsk'); if(!box || box.hidden) return;
    const c = box.querySelector('.gs-askc'); if(!c) return;
    const BOARD = { x:0, y:0, w:BW, h:BH };
    const cb = lay(c), isEnd = c.classList.contains('gs-end'), wn = isEnd ? '결과 창' : '고르기 창';
    const o = out(cb, BOARD); if(o) hit('창 넘침', 85, `${wn}이 판 밖으로 잘림(위·아래)`, o, `창 ${R(cb)} · 판 높이 ${BH}`, scene, [cb]);
    const bs = $$('.gs-askb button', c).map(el => ({ el, b:lay(el) })).filter(x => x.b);
    bs.forEach(x => { const k = out(x.b, BOARD); if(k) hit('창 넘침', 85, `${wn} 단추가 판 밖: "${x.el.textContent.trim().slice(0, 12)}"`, k, R(x.b), scene, [x.b]); const k2 = out(x.b, cb); if(k2) hit('창 넘침', 70, `${wn} 단추가 창 밖`, k2, R(x.b), scene, [x.b, cb]); });
    for(let i = 0; i < bs.length; i++) for(let j = i + 1; j < bs.length; j++){ const q = ov(bs[i].b, bs[j].b); if(q) hit('창 겹침', 75, `${wn} 단추끼리 겹침`, q.w, `${q.w}×${q.h}px`, scene, [bs[i].b, bs[j].b]); }
    $$('.gs-askcards .gs-c, .gs-askb .gs-c', c).forEach(el => { const b = lay(el); const k = out(b, cb); if(k) hit('창 넘침', 60, `${wn} 안 패 그림이 창 밖`, k, R(b), scene, [b, cb]); });
    textCheck(scene, [['#gsAsk .gs-askb button', wn + ' 단추'], ['#gsAsk .gs-askc > b', wn + ' 제목'], ['#gsAsk .gs-erows div', wn + ' 점수 줄'], ['#gsAsk .gs-pay', wn + ' 포인트 줄'], ['#gsAsk .gs-ew', wn + ' 설명'], ['#gsAsk .gs-nx', wn + ' 다음 판 막대']]);
  }
  function auditSun(scene){
    const box = $('#gsSun'); if(!box || box.hidden) return;
    const BOARD = { x:0, y:0, w:BW, h:BH };
    /* 등장 애니메이션 중이면 건너뜀 */
    if($$('.sunc', box).some(el => el.getAnimations().some(a => a.playState === 'running' && !(a.animationName === 'gs-bob')))) return;
    const cards = $$('.sunc', box).map((el, i) => ({ el, i, b:vis(el) })).filter(x => x.b);
    const labs = $$('.gs-sunl', box).map(el => ({ el, b:vis(el) })).filter(x => x.b);
    /* 글줄(display:block)은 칸 전체 폭이라 실제 글자 폭(Range)으로 */
    const tbox = el => { if(!el) return null; const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); if(!r.width) return null; return vis({ getBoundingClientRect:() => r }); };
    /* 사람 = 얼굴·이름·설명 각각(칸 300px 전체가 아니라 실제 그려진 것) */
    const ppl = $$('.gs-sunp', box).map(el => ({ el, b:uni([...$$('.gs-mask, .av', el).map(lay), ...$$('b, small', el).map(tbox)]), n:el.querySelector('b') ? el.querySelector('b').textContent : '' }));
    const fixed = [['안내 글', tbox($('#gsSunM'))], ['시간 막대', lay($('#gsSunT'))], ['나가기 단추', lay($('#gsSunX'))], ['제목', uni($$('.gs-sunh b, .gs-sunh span', box).map(tbox))]];
    cards.forEach(c => { const k = out(c.b, BOARD); if(k) hit('선 뽑기', 70, '선 뽑기 패가 판 밖', k, R(c.b), scene, [c.b]); });
    for(let i = 0; i < cards.length; i++) for(let j = i + 1; j < cards.length; j++){ const q = ov(cards[i].b, cards[j].b); if(q) hit('선 뽑기', 55, `선 뽑기 패끼리 겹침${cards[i].el.classList.contains('sun') || cards[j].el.classList.contains('sun') ? '(선 된 패 커짐)' : ''}`, q.w, `${q.w}×${q.h}px`, scene, [cards[i].b, cards[j].b]); }
    labs.forEach(l => {
      const own = l.el.closest('.sunc');
      cards.forEach(c => { if(c.el === own) return; const q = ov(l.b, c.b); if(q) hit('선 뽑기', 55, '선 뽑기 패 이름표(n월) ↔ 옆 패 겹침', q.w * q.h, `${q.w}×${q.h}px "${l.el.textContent}"`, scene, [l.b, c.b]); });
      labs.forEach(m => { if(m === l) return; const q = ov(l.b, m.b); if(q) hit('선 뽑기', 55, '선 뽑기 이름표끼리 겹침', q.w * q.h, `${q.w}×${q.h}px "${l.el.textContent}" / "${m.el.textContent}"`, scene, [l.b, m.b]); });
      ppl.forEach(p => { const q = ov(l.b, p.b); if(q) hit('선 뽑기', 55, '선 뽑기 이름표 ↔ 사람 얼굴·이름 겹침', q.w * q.h, `${q.w}×${q.h}px "${l.el.textContent}" / ${p.n}`, scene, [l.b, p.b]); });
      fixed.forEach(([fn, fb]) => { const q = ov(l.b, fb); if(q) hit('선 뽑기', 55, `선 뽑기 이름표 ↔ ${fn} 겹침`, q.w * q.h, `${q.w}×${q.h}px`, scene, [l.b, fb]); });
      const k = out(l.b, BOARD); if(k) hit('선 뽑기', 70, '선 뽑기 이름표가 판 밖', k, R(l.b), scene, [l.b]);
    });
    ppl.forEach(p => { cards.forEach(c => { const q = ov(p.b, c.b); if(q) hit('선 뽑기', 55, `선 뽑기 사람(${p.el.classList.contains('a') ? '왼쪽' : '오른쪽'}) ↔ 패 겹침`, q.w * q.h, `${q.w}×${q.h}px`, scene, [p.b, c.b]); }); fixed.forEach(([fn, fb]) => { const q = ov(p.b, fb); if(q) hit('선 뽑기', 55, `선 뽑기 사람 ↔ ${fn} 겹침`, q.w * q.h, `${q.w}×${q.h}px`, scene, [p.b, fb]); }); });
    for(let i = 0; i < fixed.length; i++) for(let j = i + 1; j < fixed.length; j++){ const q = ov(fixed[i][1], fixed[j][1]); if(q) hit('선 뽑기', 55, `선 뽑기 ${fixed[i][0]} ↔ ${fixed[j][0]} 겹침`, q.w * q.h, `${q.w}×${q.h}px`, scene, [fixed[i][1], fixed[j][1]]); }
    cards.forEach(c => fixed.forEach(([fn, fb]) => { const q = ov(c.b, fb); if(q) hit('선 뽑기', 55, `선 뽑기 패 ↔ ${fn} 겹침`, q.w * q.h, `${q.w}×${q.h}px`, scene, [c.b, fb]); }));
    textCheck(scene, [['#gsSun .gs-sunm', '선 뽑기 안내 글'], ['#gsSun .gs-sunh span', '선 뽑기 설명']]);
  }
  function auditLobby(scene){
    const box = $('#gsLobby'); if(!box || box.hidden) return;
    const BOARD = { x:0, y:0, w:BW, h:BH };
    const lb = lay(box.querySelector('.gs-lb')); const k = out(lb, BOARD); if(k) hit('방 고르기', 70, '방 고르기 창이 판 밖', k, R(lb), scene, [lb]);
    const rs = $$('.gs-room', box).map(el => lay(el));
    rs.forEach(b => { const q = out(b, lb); if(q) hit('방 고르기', 60, '방 단추가 창 밖', q, R(b), scene, [b, lb]); });
    for(let i = 0; i < rs.length; i++) for(let j = i + 1; j < rs.length; j++){ const q = ov(rs[i], rs[j]); if(q) hit('방 고르기', 60, '방 단추끼리 겹침', q.w, `${q.w}×${q.h}px`, scene, [rs[i], rs[j]]); }
    $$('.gs-lb > *, .gs-earn > *', box).forEach(el => { const b = lay(el); const q = out(b, lb); if(q > 2) hit('방 고르기', 55, `방 고르기 ${nm(el)}가 창 밖`, q, R(b), scene, [b, lb]); });
    textCheck(scene, [['#gsLobby .gs-room b', '방 이름'], ['#gsLobby .gs-room small', '방 설명'], ['#gsLobby .gs-earn > div span', '포인트 얻기 항목'], ['#gsLobby .gs-wal b', '보유 포인트'], ['#gsLobby .gs-earn button', '포인트 받기 단추']]);
  }
  function auditView(scene){
    const root = gsb(); if(!root) return;
    const r = root.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    const o = Math.round(Math.max(-r.left, -r.top, r.right - vw, r.bottom - vh, 0));
    if(o > 1) hit('화면 밖', 90, '판이 화면(뷰포트) 밖으로 잘림', o, `판 화면 사각형 ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)} / 화면 ${vw}×${vh}`, scene, []);
  }
  /* 연출 DOM이 1.8초 넘게 남아 있음 */
  function auditFx(scene){
    const now = performance.now();
    $$('.gsfx-l, .fxflash, .fxfloat, .fxfly, .fxbubble, .fxvig, .fxcombo').forEach(el => {
      if(!born.has(el)) born.set(el, now);
      const age = now - born.get(el);
      if(age > 4000){   /* 연출 층은 1.58초에 지우게 돼 있음. 여러 페이지를 동시에 돌리면 타이머가 1초 넘게 늦기도 해서(실측 2.0·2.75초) 4초 넘게 남은 것만 '안 지워짐'으로 봄 */
        const what = el.classList.contains('gsfx-l') ? '연출 층 .gsfx-l(' + [...new Set($$('*', el).map(x => [...x.classList].filter(c => c.startsWith('gsfx')).join('.')).filter(Boolean))].slice(0, 4).join(' ') + ')' : nm(el);
        if(!el.__audFx){ el.__audFx = 1; hit('연출 남음', 30, `연출이 끝났는데 DOM이 남음: ${what}`, Math.round(age), `${Math.round(age)}ms 지남 · 화면에 ${shown(el) ? '보임' : '안 보임'}`, scene, []); }
      }
    });
  }
  function auditAll(scene){
    try{
      const g = GG() && GG().gs; if(!g || !gsb()) return;
      auditView(scene); auditBody(scene); auditAsk(scene); auditSun(scene); auditLobby(scene); auditFx(scene);
    }catch(e){ hit('도구 오류', 1, '검수 도구 오류: ' + String(e && e.message || e).slice(0, 80), 0, String(e && e.stack || '').slice(0, 200), scene, []); }
  }
  window.__audNow = s => auditAll(s || '직접');
  /* 장면 바뀔 때마다 */
  let deb = 0, lastScene = '';
  const mo = new MutationObserver(ms => {
    const now = performance.now();
    for(const m of ms) for(const n of m.addedNodes) if(n.nodeType === 1 && n.matches && n.matches('.gsfx-l, .fxflash, .fxfloat, .fxfly, .fxbubble, .fxvig, .fxcombo')) born.set(n, now);
    if(ms.every(m => [...m.addedNodes, ...m.removedNodes].every(n => n.nodeType === 1 && n.classList && (n.classList.contains('aud-ov') || /^(gsfx|fx)/.test(n.className || ''))) && m.type === 'childList')) return;
    const t = ms.map(m => m.target && m.target.id).find(Boolean) || '';
    lastScene = t === 'gsAsk' ? '창' : t === 'gsSun' ? '선 뽑기' : t === 'gsLobby' ? '방 고르기' : t === 'gsHand' || t === 'gsFloor' || t === 'gsCapMe' || t === 'gsCapOp' ? '수 장면' : lastScene || '장면';
    clearTimeout(deb); deb = setTimeout(() => auditAll(lastScene), 60);
  });
  const boot = setInterval(() => {
    if(!document.body) return;
    mo.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
    clearInterval(boot);
    setInterval(() => auditAll('0.4초 점검'), 400);
  }, 50);
}

/* ===================== 사람처럼 두기 ===================== */
async function step(pg, goPref){
  return pg.evaluate(goPref => {
    if(typeof G === 'undefined' || !G || !G.gs) return 'nogame';
    if(window.__audPend > 0) return 'wait';
    if(G.over) return 'over';
    const room = document.querySelector('#gsLobby:not([hidden]) [data-r="1"]:not([disabled])') || document.querySelector('#gsLobby:not([hidden]) [data-r="0"]');
    if(room){ room.click(); return 'room'; }
    const sc = document.querySelector('#gsSun:not([hidden]) .sunc.can'); if(sc){ sc.click(); return 'sun'; }
    const ask = document.querySelector('#gsAsk:not([hidden])');
    if(ask && ask.querySelector('#gsEndBye')) return 'between';
    if(ask){
      const end = ask.querySelector('#gsEndOk'); if(end){ end.click(); return 'end'; }
      const bs = [...ask.querySelectorAll('[data-i]')]; if(!bs.length) return 'wait';
      const go = ask.querySelector('button.go'); if(go){ (goPref ? go : ask.querySelector('button.stop')).click(); return 'gs'; }
      bs[Math.floor(Math.random() * bs.length)].click(); return 'ask';
    }
    const g = G.gs; if(!g.S || g.phase !== 'play' || g.busy || g.picking || g.S.turn !== g.me || g.S.pendingGS >= 0) return 'wait';
    return 'myturn';
  }, goPref);
}
async function playHand(x, hover){
  /* 손패 하나 고르기(낼 수 있는 패 우선, 가끔 아무 패) + 데스크톱이면 오른쪽 끝 패에 마우스 올려 검사 */
  if(hover){
    const bb = await x.pg.evaluate(() => { const L = [...document.querySelectorAll('#gsHand .gs-c.hd')]; const el = L[L.length - 1]; if(!el) return null; const r = el.getBoundingClientRect(); return { x:r.left + r.width * .7, y:r.top + r.height * .5 }; });
    if(bb){ await x.pg.mouse.move(bb.x, bb.y); await w(220); await x.pg.evaluate(() => window.__audNow && window.__audNow('마우스 올림(오른쪽 끝 손패)'));
      await x.pg.waitForFunction(() => !(window.__audPend > 0), null, { timeout:8000 }).catch(() => {});   /* 사진 다 찍고 마우스 치움 */
      await x.pg.mouse.move(5, 5); }
  }
  return x.pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#gsHand .gs-c.hd')]; if(!cards.length) return false;
    const m = cards.filter(c => c.classList.contains('match'));
    const c = m.length && Math.random() < .8 ? m[Math.floor(Math.random() * m.length)] : cards[Math.floor(Math.random() * cards.length)];
    c.click(); return true;
  });
}

const br = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
const RES = [];   /* { vp, job, aud, errs, games, scenes } */
let shotN = 0;
async function mkCtx(vp){
  const ctx = await br.newContext(VIEW[vp]);
  await ctx.routeWebSocket(/battle-production/, ws => attach(ws));
  await ctx.addInitScript(() => { try{ localStorage.setItem('hp:welcome', '9'); localStorage.setItem('hp:help:gostop', '1'); localStorage.setItem('hp:age19', '1'); }catch(_){} });
  await ctx.addInitScript(pageAudit);
  return ctx;
}
async function mkPage(ctx, vp, job){
  const pg = await ctx.newPage(); const errs = [];
  const st = { vp, job, shotsBySig:{} };
  pg.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 300)));
  pg.on('console', m => { if(m.type() === 'error' && !/WebSocket|favicon|ERR_|net::|CORS policy|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  await pg.exposeBinding('__audShot', async (src, sig) => {
    if(SHOTS_LEFT[vp + sig] === undefined) SHOTS_LEFT[vp + sig] = SHOTS_PER;
    if(SHOTS_LEFT[vp + sig] <= 0) return null;
    SHOTS_LEFT[vp + sig]--;
    const f = path.join(OUT, `${vp}-${String(++shotN).padStart(3, '0')}.png`);
    try{ await pg.screenshot({ path:f }); return f; }catch(_){ return null; }
  });
  await pg.goto(B + 'index.html'); await w(500);
  await pg.evaluate(() => typeof closeModal === 'function' && closeModal());
  return { pg, errs, st };
}
const SHOTS_LEFT = {};
async function collect(x, vp, job, games){
  const aud = await x.pg.evaluate(() => ({ A:window.__AUD || {}, n:window.__AUDN || 0 })).catch(() => ({ A:{}, n:0 }));
  RES.push({ vp, job, aud:aud.A, errs:x.errs.slice(), games });
}
/* 솔로 한 판 */
async function soloJob(vp, stage, goPref){
  const ctx = await mkCtx(vp); const x = await mkPage(ctx, vp, 'solo' + stage);
  let games = 0;
  try{
    await x.pg.evaluate(n => startGame('gostop', null, { adv:n }), stage);
    const t0 = Date.now();
    while(Date.now() - t0 < 200000){
      const s = await step(x.pg, goPref);
      if(s === 'over' || s === 'end'){ if(s === 'end') games = 1; if(s === 'over') break; }
      if(s === 'myturn') await playHand(x, vp === 'land');
      await w(s === 'wait' ? 120 : 260);
    }
    await w(2200); await x.pg.evaluate(() => window.__audNow && window.__audNow('끝난 뒤'));
  }catch(e){ x.errs.push('도구: ' + e.message); }
  await collect(x, vp, 'solo' + stage, games || 1);
  await ctx.close();
}
/* AI 대전: 선 뽑기 → n판 연속 → 나가기 예약 */
async function duelJob(vp, n, goPref, lazy){
  const ctx = await mkCtx(vp); const tag = 'duel' + (lazy ? '-lazy' : ''); const x = await mkPage(ctx, vp, tag);
  let games = 0;
  try{
    await x.pg.evaluate(() => startGame('gostop', 'normal', { duel:{ fleet:true, mode:'ai', opp:{ nick:'AI 고수' } } }));
    const t0 = Date.now(); let bye = false;
    while(Date.now() - t0 < 160000 * n){
      const s = await step(x.pg, goPref); if(s === 'over') break;
      const f = await x.pg.evaluate(() => ({ gi:G.gs.gi, ph:G.gs.phase, n:G.gs.tot.n, panic:!!document.querySelector('#gsMe.panic') }));
      games = Math.max(games, f.n);
      if(!bye && f.gi >= n - 1 && f.ph === 'play'){ bye = true; await x.pg.evaluate(() => document.querySelector('#gsOut').click()); }
      if(s === 'myturn' && (!lazy || f.panic)) await playHand(x, vp === 'land');
      await w(s === 'wait' || s === 'myturn' ? 150 : 260);
    }
    await w(2200); await x.pg.evaluate(() => window.__audNow && window.__audNow('대전 끝난 뒤'));
  }catch(e){ x.errs.push('도구: ' + e.message); }
  await collect(x, vp, tag, games);
  await ctx.close();
}

/* ---- 일 목록 ---- */
const jobs = [];
for(let r = 0; r < ROUNDS; r++) for(const vp of VPS){
  SOLO.forEach((s, i) => jobs.push(() => soloJob(vp, s, (i + r) % 2 === 0)));
  if(DUELN > 0){ jobs.push(() => duelJob(vp, DUELN, true, false)); jobs.push(() => duelJob(vp, Math.max(1, DUELN - 1), false, false)); }
  if(flag('lazy')) jobs.push(() => duelJob(vp, 1, true, true));
}
const T0 = Date.now(); let ji = 0;
await Promise.all(Array.from({ length:Math.min(PAR, jobs.length) }, async () => { while(ji < jobs.length){ const j = jobs[ji++]; await j(); process.stdout.write(`. ${ji}/${jobs.length}\n`); } }));
await br.close(); srv.close();

/* ---- 묶어서 보고 ---- */
const M = {};
let games = 0, sceneHits = 0;
const errs = [];
for(const r of RES){
  games += r.games || 0;
  r.errs.forEach(e => errs.push(`[${r.vp} ${r.job}] ${e}`));
  for(const e of Object.values(r.aud)){
    const k = r.vp + '|' + e.sig; const m = M[k] = M[k] || { vp:r.vp, kind:e.kind, w:e.w, sig:e.sig, n:0, max:-1, ex:'', at:'', shots:[], jobs:new Set() };
    m.n += e.n; sceneHits += e.n; m.jobs.add(r.job);
    if(e.max > m.max){ m.max = e.max; m.ex = e.ex; m.at = e.at; }
    m.shots.push(...(e.shots || []));
  }
}
const list = Object.values(M).sort((a, b) => b.w - a.w || b.n - a.n);
const VPN = { land:'가로 1366×768', port:'세로 390×844' };
console.log(`\n고스톱 UI 검수: 페이지 ${RES.length}개 · 끝난 판 약 ${games}판 · ${((Date.now() - T0) / 1000) | 0}초 · 문제 기록 ${sceneHits}회(${list.length}종류)\n`);
if(errs.length){ console.log('■ 콘솔 오류·pageerror ' + errs.length + '건'); [...new Set(errs)].slice(0, 30).forEach(e => console.log('  ' + e)); console.log(''); }
for(const m of list){
  console.log(`■ [${VPN[m.vp]}] ${m.kind} — ${m.sig}`);
  console.log(`   ${m.n}회 · 최대 ${m.max} · ${m.at}`);
  console.log(`   예: ${m.ex}`);
  if(m.shots.length) console.log(`   사진: ${m.shots.slice(0, 2).join(', ')}`);
}
fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify({ when:new Date().toISOString(), pages:RES.length, games, errs, issues:list.map(m => ({ ...m, jobs:[...m.jobs] })) }, null, 1));
console.log(`\n결과 파일: ${path.join(OUT, 'audit.json')}`);
process.exit(list.length || errs.length ? 1 : 0);
