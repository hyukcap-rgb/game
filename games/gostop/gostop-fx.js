/* 고스톱 효과·소리 묶음(효과·사운드팀, 2026-10-04) — games/gostop 전용
   · 꾸밈은 보이기만 한다: 게임 상태(G)·씨앗 rng·시계·대전 통신을 건드리지 않고, 모든 DOM은 pointer-events:none, 모든 함수는 try/catch
   · 큰 글자 타이틀은 #gsb(기준 판 1630×923) 안에 판 좌표로 만들어 판과 함께 확대·회전된다. 동시에 최대 2개, 1.6초 안에 지움
   · 파티클은 공용 엔진(fxEmit 등, 화면 좌표). 판 좌표 → 화면 좌표는 #gsb의 transform 행렬로 바꾼다
   · 소리는 반드시 sfx('gsfx…')로 부른다(사용자 음소거·효과음 크기 설정을 따름). 국악 타악기 흉내(꽹과리·장구·북·징) + 5음계
   · 움직임 줄이기(FXR.reduce)면 흔들기·번쩍·큰 움직임을 빼고 글자만 짧게
   · 그림·연출은 직접 만든 오리지널(다른 맞고 게임의 연출을 베끼지 않음) */
const GSFX = (() => {
  const BW = 1630, BH = 923, CX = 630, CY = 334;          /* 판 기준 크기, 타이틀 가운데(바닥 가운데) */
  const CAP_OP = [615, 54], CAP_ME = [615, 620];           /* 먹은 패 쟁반 가운데(판 좌표) */
  const NAVY = '#1A0F45', GOLD = '#FFD34D';
  const GOLDS = ['#FFE27A', '#FFD34D', '#FFB020', '#FFFFFF'];
  const FIRE = ['#FFE27A', '#FFB020', '#FF6A2B', '#FF3B3B', '#FFFFFF'];
  const live = [];                                          /* 떠 있는 타이틀 층 */
  let tickLayer = null;
  const T = (f) => { try{ return f(); }catch(_){ return undefined; } };
  const RD = () => { try{ return !!FXR.reduce; }catch(_){ return true; } };
  const S = (name, o) => { try{ if(typeof sfx === 'function') sfx(name, o || {}); }catch(_){} };
  const board = () => document.getElementById('gsb');
  const body = () => document.getElementById('gsBody');
  const rr = (a, b) => a + Math.random() * (b - a);         /* 보이기 전용 난수(게임 상태와 무관) */

  /* ---------- 스타일(한 번만) ---------- */
  function css(){
    if(document.getElementById('gsfxCss')) return;
    const st = document.createElement('style'); st.id = 'gsfxCss';
    st.textContent = `
.gsfx-l{position:absolute; inset:0; pointer-events:none; z-index:120; overflow:hidden; contain:layout style}
.gsfx-l *{pointer-events:none}
.gsfx-t{position:absolute; left:${CX}px; top:${CY}px; transform:translate(-50%,-50%); text-align:center; white-space:nowrap; font-family:'Noto Sans KR','Malgun Gothic',system-ui,sans-serif}
.gsfx-in{display:flex; flex-direction:column; align-items:center; animation:gsfx-pop 1.5s cubic-bezier(.2,1.3,.4,1) forwards; will-change:transform,opacity}
/* 글자 = 아래층(b 자체: 남보라 두꺼운 외곽선+그림자) + 위층(::before: 그라데이션 채움) */
.gsfx-in b{position:relative; display:block; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:2px; padding:0 18px;
  color:${NAVY}; -webkit-text-stroke:26px ${NAVY}; text-shadow:0 14px 0 ${NAVY}, 0 20px 26px rgba(10,4,40,.45)}
.gsfx-in b::before{content:attr(data-t); position:absolute; left:0; top:0; right:0; padding:0 18px; -webkit-text-stroke:0; text-shadow:none; color:transparent;
  background:linear-gradient(180deg,#FFFBE0 0%,#FFE27A 38%,${GOLD} 55%,#FF9F1C 100%); -webkit-background-clip:text; background-clip:text}
.gsfx-in b::after{content:attr(data-t); position:absolute; left:0; top:0; right:0; padding:0 18px; -webkit-text-stroke:0; text-shadow:none; color:transparent;
  background:linear-gradient(180deg,rgba(255,255,255,.75) 0 30%,rgba(255,255,255,0) 31%); -webkit-background-clip:text; background-clip:text; opacity:.55}
.gsfx-in i{display:block; margin-top:6px; font-style:normal; font-size:52px; font-weight:900; color:#fff; padding:6px 26px; border-radius:40px; background:${NAVY}; border:5px solid ${GOLD}; box-shadow:0 7px 0 rgba(10,4,40,.6)}
/* 색 */
.gsfx-red b::before{background-image:linear-gradient(180deg,#FFE3E3 0%,#FF7A7A 40%,#E0262F 70%,#9E0F1A 100%)}
.gsfx-red i{border-color:#FF5A5F}
.gsfx-blue b::before{background-image:linear-gradient(180deg,#F2FBFF 0%,#9EE7FF 40%,#3EA6FF 75%,#2251D6 100%)}
.gsfx-blue i{border-color:#9EE7FF}
.gsfx-green b::before{background-image:linear-gradient(180deg,#F1FFE6 0%,#B6F36A 40%,#4CC23A 75%,#1E7A2A 100%)}
.gsfx-green i{border-color:#B6F36A}
.gsfx-gray b::before{background-image:linear-gradient(180deg,#FFFFFF 0%,#D9D6EC 45%,#9B95BD 100%)}
.gsfx-gray i{border-color:#C9C3E6}
.gsfx-pink b::before{background-image:linear-gradient(180deg,#FFF0F6 0%,#FF9CC4 45%,#FF3D7F 100%)}
.gsfx-pink i{border-color:#FF9CC4}
.gsfx-rainbow b::before{background-image:linear-gradient(90deg,#FF5A5F,#FFB020,#FFE27A,#6EE06A,#5EC8FF,#B48BFF); background-size:200% 100%; animation:gsfx-hue 1s linear infinite}
.gsfx-op .gsfx-in{transform-origin:center} .gsfx-op b{filter:saturate(.75) brightness(.95)} .gsfx-op{scale:.82}
.gsfx-small b{font-size:96px; -webkit-text-stroke:18px ${NAVY}; text-shadow:0 9px 0 ${NAVY}}
.gsfx-huge b{font-size:220px; -webkit-text-stroke:32px ${NAVY}; text-shadow:0 16px 0 ${NAVY}, 0 22px 28px rgba(10,4,40,.45)}
/* 움직임 */
.gsfx-slam .gsfx-in{animation:gsfx-slam 1.5s cubic-bezier(.3,1.5,.5,1) forwards}
.gsfx-crack .gsfx-in{animation:gsfx-crack 1.5s ease-out forwards}
.gsfx-sink .gsfx-in{animation:gsfx-sink 1.55s cubic-bezier(.3,.6,.4,1) forwards}
.gsfx-wob .gsfx-in{animation:gsfx-wob 1.5s ease-in-out forwards}
.gsfx-beat .gsfx-in{animation:gsfx-beat 1.5s cubic-bezier(.2,1.3,.4,1) forwards}
.gsfx-spin .gsfx-in{animation:gsfx-spinin 1.5s cubic-bezier(.2,1.2,.4,1) forwards}
.gsfx-rd .gsfx-in{animation:gsfx-fade .8s ease-out forwards !important}
@keyframes gsfx-pop{0%{opacity:0; transform:scale(.3)} 16%{opacity:1; transform:scale(1.18)} 28%{transform:scale(.95)} 38%{transform:scale(1)} 82%{opacity:1; transform:scale(1.03)} 100%{opacity:0; transform:translateY(-34px) scale(1.06)}}
@keyframes gsfx-slam{0%{opacity:0; transform:scale(2.8) rotate(-8deg)} 13%{opacity:1; transform:scale(.9) rotate(-4deg)} 21%{transform:scale(1.05) rotate(-4deg)} 30%{transform:scale(1) rotate(-4deg)} 84%{opacity:1; transform:scale(1) rotate(-4deg)} 100%{opacity:0; transform:scale(1.1) rotate(-4deg)}}
@keyframes gsfx-crack{0%{opacity:0; transform:scale(.4)} 14%{opacity:1; transform:scale(1.12)} 22%{transform:scale(1) rotate(0)} 30%{transform:translateX(-14px) rotate(-3deg)} 36%{transform:translateX(12px) rotate(2deg)} 42%{transform:translateX(-8px) rotate(-1deg)} 48%{transform:translateX(4px)} 54%{transform:none} 80%{opacity:1; transform:translateY(0) rotate(0)} 100%{opacity:0; transform:translateY(70px) rotate(6deg)}}
@keyframes gsfx-sink{0%{opacity:0; transform:translateY(-60px) scale(.9)} 22%{opacity:1; transform:translateY(0) scale(1)} 70%{opacity:1; transform:translateY(16px)} 100%{opacity:0; transform:translateY(80px) scale(.94)}}
@keyframes gsfx-wob{0%{opacity:0; transform:scale(.4)} 14%{opacity:1; transform:scale(1.1) rotate(-9deg)} 26%{transform:rotate(9deg)} 38%{transform:rotate(-7deg)} 50%{transform:rotate(6deg)} 62%{transform:rotate(-3deg)} 72%{transform:rotate(0)} 84%{opacity:1} 100%{opacity:0; transform:translateY(-30px)}}
@keyframes gsfx-beat{0%{opacity:0; transform:scale(.2)} 14%{opacity:1; transform:scale(1.25)} 24%{transform:scale(.96)} 34%{transform:scale(1.12)} 44%{transform:scale(1)} 54%{transform:scale(1.08)} 64%{transform:scale(1)} 84%{opacity:1} 100%{opacity:0; transform:scale(1.3)}}
@keyframes gsfx-spinin{0%{opacity:0; transform:rotate(-200deg) scale(.2)} 30%{opacity:1; transform:rotate(10deg) scale(1.08)} 40%{transform:rotate(0) scale(1)} 82%{opacity:1} 100%{opacity:0; transform:rotate(12deg) translateY(50px) scale(.9)}}
@keyframes gsfx-fade{0%{opacity:0} 15%{opacity:1} 75%{opacity:1} 100%{opacity:0}}
@keyframes gsfx-hue{to{background-position:200% 0}}
/* 뒤 장식: 빛살·금·도장·바람·새·띠 */
.gsfx-rays{position:absolute; left:${CX}px; top:${CY}px; width:1100px; height:1100px; margin:-550px 0 0 -550px; border-radius:50%;
  background:repeating-conic-gradient(from 0deg, rgba(255,232,140,.6) 0deg 7deg, rgba(255,232,140,0) 7deg 20deg);
  -webkit-mask:radial-gradient(circle, #000 8%, rgba(0,0,0,.6) 30%, transparent 62%); mask:radial-gradient(circle, #000 8%, rgba(0,0,0,.6) 30%, transparent 62%);
  animation:gsfx-rays 1.5s ease-out forwards}
.gsfx-rays.c2{background:repeating-conic-gradient(from 10deg, rgba(255,90,95,.45) 0deg 6deg, rgba(255,180,32,.45) 6deg 12deg, rgba(110,224,106,.4) 12deg 18deg, rgba(94,200,255,.45) 18deg 24deg, transparent 24deg 30deg)}
.gsfx-rays.cold{background:repeating-conic-gradient(from 0deg, rgba(190,230,255,.45) 0deg 7deg, transparent 7deg 20deg)}
@keyframes gsfx-rays{0%{opacity:0; transform:scale(.3) rotate(0)} 20%{opacity:1; transform:scale(1) rotate(20deg)} 80%{opacity:.85} 100%{opacity:0; transform:scale(1.1) rotate(70deg)}}
.gsfx-glow{position:absolute; left:${CX}px; top:${CY}px; width:760px; height:420px; margin:-210px 0 0 -380px; border-radius:50%; background:radial-gradient(closest-side, rgba(255,240,170,.75), rgba(255,200,60,.25) 55%, transparent); animation:gsfx-fade 1.4s ease-out forwards}
.gsfx-glow.red{background:radial-gradient(closest-side, rgba(255,90,90,.55), rgba(160,10,20,.2) 55%, transparent)}
.gsfx-glow.blue{background:radial-gradient(closest-side, rgba(150,220,255,.5), rgba(40,90,200,.18) 55%, transparent)}
.gsfx-crk{position:absolute; left:${CX - 450}px; top:${CY - 260}px; width:900px; height:520px; overflow:visible}
.gsfx-crk path{fill:none; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:900; stroke-dashoffset:900; animation:gsfx-draw .28s .12s ease-out forwards, gsfx-fade2 1.5s ease-out forwards}
@keyframes gsfx-draw{to{stroke-dashoffset:0}}
@keyframes gsfx-fade2{0%,75%{opacity:1} 100%{opacity:0}}
.gsfx-seal{position:absolute; left:${CX}px; top:${CY}px; width:420px; height:420px; margin:-210px 0 0 -210px; border-radius:50%; border:16px solid #D7263D; box-shadow:inset 0 0 0 8px rgba(255,255,255,.85), inset 0 0 0 14px #D7263D, 0 10px 0 rgba(26,15,69,.5);
  background:radial-gradient(circle, rgba(255,247,230,.9), rgba(255,226,200,.75)); animation:gsfx-seal 1.5s cubic-bezier(.3,1.5,.5,1) forwards}
@keyframes gsfx-seal{0%{opacity:0; transform:scale(2.6) rotate(-30deg)} 13%{opacity:1; transform:scale(.92) rotate(-12deg)} 22%{transform:scale(1.03) rotate(-12deg)} 30%{transform:scale(1) rotate(-12deg)} 84%{opacity:1} 100%{opacity:0; transform:scale(1.06) rotate(-12deg)}}
.gsfx-wind{position:absolute; height:12px; border-radius:12px; background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.95) 60%, rgba(255,255,255,0)); filter:drop-shadow(0 0 6px rgba(255,255,255,.7))}
.gsfx-fly{position:absolute; left:0; top:0; will-change:transform}
.gsfx-wing{transform-origin:50% 60%; animation:gsfx-flap .22s ease-in-out infinite alternate}
@keyframes gsfx-flap{from{transform:scaleY(1)} to{transform:scaleY(-.55)}}
.gsfx-mini{position:absolute; width:46px; height:72px; margin:-36px 0 0 -23px; border-radius:7px; background:linear-gradient(160deg,#FF6B6B,#D7263D); border:4px solid ${NAVY}; box-shadow:0 4px 0 rgba(10,4,40,.5)}
.gsfx-mini::after{content:''; position:absolute; inset:8px; border-radius:4px; border:3px solid rgba(255,255,255,.7)}
.gsfx-num{position:absolute; left:${CX}px; top:${CY}px; transform:translate(-50%,-50%); font:900 230px/1 'Noto Sans KR',system-ui,sans-serif; color:#FF5A5F; -webkit-text-stroke:22px ${NAVY}; paint-order:stroke fill; animation:gsfx-tick .7s cubic-bezier(.2,1.4,.4,1) forwards}
@keyframes gsfx-tick{0%{opacity:0; transform:translate(-50%,-50%) scale(1.8)} 25%{opacity:.95; transform:translate(-50%,-50%) scale(1)} 100%{opacity:0; transform:translate(-50%,-50%) scale(.85)}}
.gsfx-edge{position:absolute; inset:0; box-shadow:inset 0 0 90px 30px rgba(255,40,60,.55); animation:gsfx-fade .7s ease-out forwards}
.gsfx-land{position:absolute; width:10px; height:10px; margin:-5px 0 0 -5px; border-radius:50%; border:6px solid rgba(255,255,255,.95); animation:gsfx-landring .45s ease-out forwards}
@keyframes gsfx-landring{0%{opacity:1; transform:scale(1)} 100%{opacity:0; transform:scale(var(--s,18))}}
@media (prefers-reduced-motion: reduce){ .gsfx-in{animation:gsfx-fade .8s ease-out forwards !important} .gsfx-rays,.gsfx-wind,.gsfx-fly{display:none} }
`;
    document.head.appendChild(st);
  }

  /* ---------- 좌표: 판 ↔ 화면 ---------- */
  function mat(){
    const b = board(); if(!b) return null;
    const r = b.getBoundingClientRect(); if(!r.width) return null;
    let m; try{ const tf = getComputedStyle(b).transform; m = (!tf || tf === 'none') ? new DOMMatrix() : new DOMMatrix(tf); }catch(_){ m = { a:1, b:0, c:0, d:1 }; }
    return { cx:r.left + r.width / 2, cy:r.top + r.height / 2, a:m.a, b:m.b, c:m.c, d:m.d, s:Math.hypot(m.a, m.b) || 1 };
  }
  function P(x, y){   /* 판 좌표 → 화면 좌표 */
    const M = mat(); if(!M) return { x:innerWidth / 2, y:innerHeight / 2, s:1 };
    const dx = x - BW / 2, dy = y - BH / 2;
    return { x:M.cx + M.a * dx + M.c * dy, y:M.cy + M.b * dx + M.d * dy, s:M.s };
  }
  function B(sx, sy){   /* 화면 좌표 → 판 좌표 */
    const M = mat(); if(!M) return { x:CX, y:CY };
    const dx = sx - M.cx, dy = sy - M.cy, det = (M.a * M.d - M.b * M.c) || 1;
    return { x:BW / 2 + (M.d * dx - M.c * dy) / det, y:BH / 2 + (-M.b * dx + M.a * dy) / det };
  }
  const K = () => { const M = mat(); return Math.max(.45, Math.min(1.25, (M ? M.s : .6) * 1.6)); };   /* 화면 크기에 맞춘 파티클 속도 배율 */
  const ctr = el => { const r = el.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2, w:r.width, h:r.height }; };
  const pan = x => T(() => panX(x)) || 0;

  /* ---------- 타이틀 층 ---------- */
  function layer(keep){
    const b = board(); if(!b) return null;
    css();
    const l = document.createElement('div'); l.className = 'gsfx-l'; l.setAttribute('aria-hidden', 'true');
    b.appendChild(l);
    if(!keep){
      live.push(l);
      while(live.length > 2){ const o = live.shift(); T(() => o.remove()); }
    }
    setTimeout(() => { T(() => l.remove()); const i = live.indexOf(l); if(i >= 0) live.splice(i, 1); }, 1580);
    return l;
  }
  function title(l, txt, cls, sub){
    if(!l) return null;
    const t = document.createElement('div');
    t.className = 'gsfx-t ' + (cls || '') + (RD() ? ' gsfx-rd' : '');
    const safe = String(txt).replace(/[<>&"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' })[c]);
    const sb = sub ? String(sub).replace(/[<>&]/g, '') : '';
    t.innerHTML = `<div class="gsfx-in"><b data-t="${safe}">${safe}</b>${sb ? `<i>${sb}</i>` : ''}</div>`;
    l.appendChild(t);
    return t;
  }
  function deco(l, cls, html, style){
    if(!l || RD()) return null;
    const d = document.createElement('div'); d.className = cls; if(html) d.innerHTML = html; if(style) d.style.cssText = style;
    l.appendChild(d); return d;
  }
  const who = o => (o && o.who === 'op') ? 'op' : 'me';
  const shake = px => { if(RD()) return; T(() => fxShake(body(), px)); };
  const flash = (c, a, ms) => { if(RD()) return; T(() => fxFlash(c, a, ms)); };
  const ring = (x, y, c, r, d, w) => T(() => fxRing(x, y, c, r, d, w));
  const emit = (x, y, cfg) => T(() => fxEmit(x, y, cfg));

  /* 금 간 선(뻑) SVG */
  function crackSvg(n){
    let p = '';
    for(let i = 0; i < n; i++){
      const a0 = (i / n) * Math.PI * 2 + rr(-.3, .3); let x = 450, y = 260, d = 'M450 260';
      for(let k = 0; k < 5; k++){ const a = a0 + rr(-.45, .45), L = rr(45, 85); x += Math.cos(a) * L; y += Math.sin(a) * L * .65; d += ` L${x.toFixed(0)} ${y.toFixed(0)}`; }
      p += `<path d="${d}" stroke="${NAVY}" stroke-width="16"/><path d="${d}" stroke="#FFFFFF" stroke-width="6"/>`;
    }
    return `<svg class="gsfx-crk" viewBox="0 0 900 520">${p}</svg>`;
  }
  /* 새(고도리): 직접 그린 단순한 새 실루엣 */
  const BIRD = c => `<svg width="230" height="172" viewBox="0 0 120 90"><g class="gsfx-wing"><path d="M60 50 C44 18 22 14 4 24 C24 28 40 40 52 56 Z" fill="${c}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/><path d="M60 50 C76 18 98 14 116 24 C96 28 80 40 68 56 Z" fill="${c}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/></g><ellipse cx="60" cy="56" rx="14" ry="11" fill="#FFF7E6" stroke="${NAVY}" stroke-width="5"/><path d="M72 54 l12 3 -12 4z" fill="${GOLD}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/><circle cx="64" cy="52" r="2.6" fill="${NAVY}"/></svg>`;

  /* ---------- 공통 연출 묶음 ---------- */
  function goldBlast(px, py, n, big){
    const k = K();
    ring(px, py, '#FFE27A', 160 * k * (big ? 1.6 : 1), .6, 14);
    ring(px, py, '#FFFFFF', 110 * k * (big ? 1.4 : 1), .45, 8);
    emit(px, py, { quantity:Math.round(n * .55), speed:{ min:220 * k, max:560 * k }, lifespan:{ min:600, max:1100 }, kind:'star', tint:GOLDS, scale:{ start:7, end:0, ease:'quad.in', random:true }, gravityY:520, drag:1.6, glow:true });
    emit(px, py, { quantity:Math.round(n * .25), speed:{ min:300 * k, max:700 * k }, lifespan:{ min:350, max:650 }, kind:'spark', tint:['#FFFFFF', '#FFE27A'], scale:{ start:4, end:0 }, drag:2.2, glow:true });
    emit(px, py, { quantity:Math.round(n * .2), speed:{ min:20, max:120 * k }, lifespan:{ min:600, max:1000 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2B0'], scale:{ start:6, end:0 }, gravityY:-40, glow:true });
  }
  function coinRain(n, spread){
    const k = K();
    for(let i = 0; i < n; i++){
      const p = P(rr(CX - spread, CX + spread), rr(-40, 40));
      emit(p.x, p.y, { quantity:1, speed:{ min:120 * k, max:260 * k }, angle:{ min:70, max:110 }, lifespan:{ min:1000, max:1450 }, kind:'rect', flip:true, tint:['#FFD34D', '#FFE98E', '#FFB020'], scale:{ start:rr(6, 9) * Math.max(.7, k) }, alpha:{ start:1, end:0 }, gravityY:700 * k, drag:.4, delay:{ min:0, max:350 } });
    }
  }
  function fireworks(px, py, n, cols){
    const k = K();
    ring(px, py, cols[0], 90 * k, .5, 6);
    emit(px, py, { quantity:n, speed:{ min:160 * k, max:360 * k }, lifespan:{ min:550, max:950 }, kind:'spark', tint:cols, scale:{ start:4.5, end:0, ease:'quad.in' }, gravityY:260, drag:1.8, glow:true });
  }
  function flames(px, py, n, w){
    const k = K();
    emit(px, py, { quantity:n, x:{ min:-w, max:w }, speed:{ min:120 * k, max:320 * k }, angle:{ min:250, max:290 }, lifespan:{ min:450, max:900 }, kind:'glow', tint:['#FFB020', '#FF6A2B', '#FFE27A'], scale:{ start:6, end:1 }, gravityY:-120, drag:1 });
  }

  /* =========================================================
     소리(국악 타악기 흉내 + 5음계). 이벤트는 sfx('gsfx…')로만 부른다
     ========================================================= */
  const V = o => (o && o.op) ? .65 : 1;
  const P5 = (n, root) => T(() => penta(n, root)) || 440;
  /* 꽹과리: 쨍한 금속(비정수 배음) */
  function kkw(o = {}){ const v = (o.v || .07), t = o.t || 0, f = o.f || 1480;
    aBell({ f, ratio:1.483, idx:3.2, d:o.d || .32, v, t, rev:.25, pan:o.pan });
    aBell({ f:f * 1.37, ratio:2.31, idx:2.4, d:(o.d || .32) * .75, v:v * .55, t, pan:o.pan });
    aNoise({ ft:'highpass', f:5200, d:.1, v:v * .9, t, pan:o.pan }); }
  /* 꽹과리 막음(짧게 '깻') */
  function kkwM(o = {}){ const v = (o.v || .06), t = o.t || 0; aBell({ f:1620, ratio:1.483, idx:2.6, d:.07, v, t }); aNoise({ ft:'bandpass', f:4200, q:2, d:.04, v:v * .8, t }); }
  /* 징: 길게 우웅 */
  function jing(o = {}){ const f = o.f || 98, t = o.t || 0, v = o.v || .14, d = o.d || 1.3;
    aBell({ f, ratio:1.414, idx:.9, a:.025, d, v, t, rev:.6 });
    aBell({ f:f * 2.01, ratio:1.5, idx:.5, a:.04, d:d * .8, v:v * .35, t, rev:.6 });
    aTone({ f:f * 1.003, f2:f * .985, a:.05, d, v:v * .5, t, rev:.4 }); }
  /* 북: 둥 */
  function buk(o = {}){ const v = o.v || .36, t = o.t || 0;
    aThump({ f:o.f || 120, f2:o.f2 || 42, d:o.d || .45, v, t, pan:o.pan });
    aNoise({ ft:'lowpass', f:700, f2:120, d:.22, v:v * .4, t, pan:o.pan, rev:.2 }); }
  /* 장구: 덩(궁편 낮게)·따(채편 날카롭게) */
  function jgD(o = {}){ const v = o.v || .22, t = o.t || 0; aThump({ f:200, f2:92, d:.22, v, t, pan:o.pan }); aNoise({ ft:'bandpass', f:420, q:1.2, d:.12, v:v * .5, t, pan:o.pan }); aNoise({ ft:'bandpass', f:2600, q:1.5, d:.04, v:v * .4, t, pan:o.pan }); }
  function jgT(o = {}){ const v = o.v || .14, t = o.t || 0; aNoise({ ft:'bandpass', f:3300, q:1.4, d:.05, v, t, pan:o.pan }); aTone({ f:1250, f2:700, type:'triangle', d:.045, v:v * .55, t, pan:o.pan }); aThump({ f:440, f2:210, d:.05, v:v * .5, t, pan:o.pan }); }
  /* 화투 '착!': 찰싹(종이 띠 소음) + 딱(나무 판 클릭) + 둔탁(낮은 쿵) */
  function slap(pw, o = {}){ const v = V(o), t = o.t || 0, pn = o.pan;
    aNoise({ ft:'bandpass', f:2400 + pw * 350, q:.9, a:.001, d:.04 + pw * .018, v:(.12 + pw * .05) * v, t, pan:pn });
    aNoise({ ft:'highpass', f:5200, a:.001, d:.018, v:(.06 + pw * .02) * v, t, pan:pn });
    aThump({ f:250 - pw * 35, f2:65, d:.07 + pw * .05, v:(.2 + pw * .1) * v, t, pan:pn });
    aTone({ f:1800, f2:900, type:'triangle', d:.025, v:.03 * v, t, pan:pn }); }
  /* 가야금 비슷한 퉁김(살짝 꺾는 음) */
  function gyg(f, o = {}){ const t = o.t || 0, v = (o.v || .1);
    aTone({ f, f2:f * (o.bend || 1.02), slide:.12, type:'triangle', d:o.d || .55, v, t, rev:.3, lp:3000 });
    aTone({ f:f * 2, type:'sine', d:.12, v:v * .35, t });
    aNoise({ ft:'bandpass', f:Math.min(7000, f * 4), q:4, d:.02, v:v * .5, t }); }
  /* 대금 비슷한 바람 섞인 피리 */
  function flute(f, o = {}){ const t = o.t || 0, v = o.v || .05, d = o.d || .3;
    aTone({ f:f * .985, f2:f, slide:.06, type:'sine', a:.04, hold:o.hold || .05, d, v, t, rev:.45 });
    aNoise({ ft:'bandpass', f:f * 2, q:6, a:.04, hold:o.hold || .05, d:d * .8, v:v * .35, t }); }
  /* 동전 쏟아짐 */
  function coins(n, o = {}){ const t = o.t || 0; for(let k = 0; k < n; k++){ const tt = t + k * rr(.035, .07); aTone({ f:m2f(rr(88, 98)), type:'square', lp:4200, d:.05, v:.022, t:tt, pan:rr(-.5, .5) }); aBell({ f:m2f(rr(93, 100)), ratio:2.76, idx:1, d:.18, v:.025, t:tt + .01 }); } }
  function arp(steps, root, o = {}){ steps.forEach((s, i) => aMarimba(P5(s, root), { t:(o.t || 0) + i * (o.gap || .055), v:o.v || .12, d:o.d || .45 })); }

  const sounds = {
    /* 카드 부딪힘 1·2·3 */
    gsfxLand1(o){ slap(1, o); },
    gsfxLand2(o){ slap(2, o); aMarimba(P5(7, 67), { t:.03, v:.1 * V(o), d:.3, pan:o.pan }); jgT({ t:.01, v:.06 * V(o), pan:o.pan }); },
    gsfxLand3(o){ slap(3, o); buk({ v:.4 * V(o), pan:o.pan }); kkw({ t:.02, v:.06 * V(o), pan:o.pan }); aNoise({ ft:'lowpass', f:2600, f2:200, d:.45, v:.2 * V(o), rev:.35 }); },
    gsfxFlip(o){ aWhoosh({ f:900, f2:4200, a:.012, d:.09, v:.06, pan:o.pan }); slap(1, { t:.07, pan:o.pan }); aBell({ f:m2f(91), t:.09, d:.25, v:.025, idx:1.2, rev:.3 }); },
    gsfxGrab(o){ const n = Math.max(1, Math.min(7, o.n || 1)), v = V(o);
      for(let k = 0; k < n; k++){ aNoise({ ft:'bandpass', f:3000, q:1.2, t:k * .055, d:.03, v:.07 * v }); aMarimba(P5(k + 3, o.op ? 67 : 72), { t:k * .055, v:.11 * v, d:.35 }); }
      if(n >= 3) aSparkle({ t:n * .055, n:Math.min(6, n), v:.035 * v, root:o.op ? 79 : 84 }); },
    /* 뻑: 금 가는 소리 + 털썩 + 어긋난 하강 */
    gsfxPpuk(o){ const v = V(o);
      for(let k = 0; k < 4; k++) aNoise({ ft:'bandpass', f:rr(3500, 6500), q:3, t:k * .035, d:.03, v:.09 * v });
      aThump({ f:150, f2:50, t:.08, d:.35, v:.32 * v });
      aTone({ f:m2f(70), f2:m2f(58), type:'triangle', t:.12, d:.45, v:.09 * v, lp:2400, rev:.3 }); aTone({ f:m2f(69), f2:m2f(57), type:'triangle', t:.12, d:.45, v:.07 * v, lp:2400 });
      aTone({ f:m2f(55), f2:m2f(48), type:'sawtooth', lp:600, t:.45, d:.5, v:.05 * v, rev:.3 }); },
    gsfxPpuk3(o){ sounds.gsfxPpuk(o); buk({ t:.05, v:.45 }); buk({ t:.3, v:.4, f:100 }); jing({ t:.35, f:82, v:.16, d:1.2 }); kkw({ t:.05, v:.07 }); kkw({ t:.2, v:.07 }); kkw({ t:.35, v:.08 }); },
    /* 뻑 먹기: 큰 착 + 꽹과리 몰이 + 동전 + 5음계 상승 */
    gsfxPpukEat(o){ const v = V(o);
      slap(3, o); buk({ v:.42 * v });
      [0, .09, .18, .27].forEach((t, i) => (i % 2 ? kkwM : kkw)({ t:.05 + t, v:.07 * v }));
      arp([0, 1, 2, 3, 4, 5, 7], o.op ? 67 : 72, { t:.12, gap:.05, v:.12 * v });
      coins(o.op ? 5 : 10, { t:.2 });
      aSparkle({ t:.5, n:6, v:.05 * v }); },
    gsfxJappuk(o){ const v = V(o);
      sounds.gsfxPpukEat(o);
      jing({ t:.05, f:110, v:.15 * v });
      [67, 72, 76, 79].forEach((m, i) => aBrass(m2f(m), { t:.45 + i * .08, d:.18, v:.06 * v }));
      [72, 76, 79, 84].forEach(m => aBrass(m2f(m), { t:.8, hold:.2, d:.4, v:.045 * v })); buk({ t:.8, v:.4 * v }); },
    /* 쪽: 입맞춤 같은 '쪽' + 마림바 두 음 */
    gsfxJjok(o){ const v = V(o); aTone({ f:900, f2:2600, a:.003, d:.05, v:.12 * v }); aNoise({ ft:'highpass', f:3800, d:.02, v:.06 * v }); aMarimba(P5(5, 72), { t:.08, v:.12 * v }); aMarimba(P5(7, 72), { t:.15, v:.12 * v }); aBell({ f:m2f(91), t:.2, d:.4, v:.035 * v, rev:.3 }); },
    /* 따닥: 장구 채 두 번 + 꽹과리 */
    gsfxTtadak(o){ const v = V(o); jgT({ v:.16 * v }); slap(2, { t:.0 }); jgT({ t:.13, v:.18 * v }); slap(2, { t:.13 }); kkw({ t:.2, v:.06 * v }); arp([2, 4, 5], 72, { t:.24, v:.11 * v }); },
    /* 쓸: 길게 쓸고 가는 바람 + 5음계 글리산도 */
    gsfxSseul(o){ const v = V(o); aWhoosh({ f:250, f2:5200, a:.25, d:.45, v:.11 * v, q:.7 }); aNoise({ ft:'highpass', f:3000, a:.2, d:.4, v:.04 * v });
      for(let k = 0; k < 9; k++) gyg(P5(k, 67), { t:.05 + k * .045, v:.06 * v, d:.4 }); aBell({ f:m2f(96), t:.5, d:.8, v:.05 * v, rev:.5 }); },
    /* 폭탄: 깊은 쾅 + 파편 */
    gsfxBomb(o){ const v = V(o); aThump({ f:130, f2:28, d:.8, v:.48 * v }); aNoise({ ft:'lowpass', f:3200, f2:120, d:1, v:.38 * v, rev:.4 }); aNoise({ ft:'highpass', f:2800, d:.09, v:.14 * v });
      for(let k = 0; k < 6; k++) aNoise({ ft:'bandpass', f:rr(1500, 4000), q:3, t:.15 + k * rr(.04, .09), d:.03, v:.05 * v }); buk({ t:.02, v:.3 * v, f:90 }); },
    /* 흔들기: 장구 잔가락(빠르게 굴림) */
    gsfxShake(o){ const v = V(o); for(let k = 0; k < 8; k++) (k % 2 ? jgT : jgD)({ t:k * .055, v:(k % 2 ? .1 : .16) * v, pan:k % 2 ? .3 : -.3 }); kkw({ t:.45, v:.06 * v }); },
    gsfxBonus(o){ const v = V(o); aCoin({ v:.06 * v }); aSparkle({ t:.08, n:5, v:.05 * v, root:86 }); aTone({ f:600, f2:1800, type:'triangle', d:.25, v:.04 * v }); },
    gsfxSteal(o){ const v = V(o), n = Math.max(1, Math.min(4, o.n || 1)); aWhoosh({ f:3000, f2:600, a:.02, d:.18, v:.07 * v }); for(let k = 0; k < n; k++){ aTone({ f:m2f(84 + k * 2), type:'square', lp:3500, t:.15 + k * .08, d:.06, v:.035 * v }); aBell({ f:m2f(91 + k * 2), t:.17 + k * .08, d:.25, v:.03 * v }); } },
    /* n고: 클수록 화려. 3고부터 북이 빨라지며 올라가고 징·나팔 */
    gsfxGo(o){ const n = Math.max(1, o.n || 1), v = V(o);
      jgD({ v:.2 * v }); jgT({ t:.12, v:.14 * v }); kkw({ t:.2, v:.07 * v });
      aBrass(m2f(67), { t:.1, d:.14, v:.07 * v }); aBrass(m2f(72), { t:.22, d:.3, v:.07 * v });
      if(n >= 2){ kkw({ t:.32, v:.07 * v }); aBrass(m2f(76), { t:.34, d:.35, v:.065 * v }); }
      if(n >= 3){ const hits = Math.min(12, 5 + n);
        for(let k = 0; k < hits; k++){ const tt = .3 + .5 * (1 - Math.pow(1 - k / hits, 1.6)); buk({ t:tt, f:95 + k * 8, f2:45 + k * 3, d:.2, v:(.22 + k * .015) * v }); }
        jing({ t:.85, f:98, v:.14 * v });
        [72, 76, 79, 84].forEach(m => aBrass(m2f(m), { t:.85, hold:.18, d:.35, v:.05 * v }));
        kkw({ t:.85, v:.08 * v }); kkwM({ t:.95, v:.06 * v }); kkw({ t:1.02, v:.07 * v });
        aSparkle({ t:.9, n:Math.min(8, n + 3), v:.045 * v, root:n >= 5 ? 89 : 84 }); } },
    /* 스톱: 묵직한 쾅(도장) + 낮은 징 + 나무 딱 */
    gsfxStop(o){ const v = V(o); buk({ v:.48 * v, f:110, f2:35, d:.6 }); aNoise({ ft:'lowpass', f:1800, f2:150, d:.4, v:.22 * v, rev:.3 }); aTone({ f:1100, f2:800, type:'triangle', t:.01, d:.05, v:.07 * v }); jing({ t:.08, f:73, v:.12 * v, d:1 }); },
    /* 고도리: 새 세 마리가 짹짹 + 대금 */
    gsfxGodori(o){ const v = V(o); for(let b = 0; b < 3; b++){ const pn = -.6 + b * .6; for(let k = 0; k < 3; k++) aTone({ f:rr(2600, 3400), f2:rr(3600, 4400), t:b * .16 + k * .06, d:.045, v:.03 * v, pan:pn, rev:.2 }); }
      [0, 2, 3, 4, 6].forEach((s, i) => flute(P5(s, 72), { t:.12 + i * .1, d:.22, v:.05 * v })); aBell({ f:m2f(91), t:.65, d:.7, v:.04 * v, rev:.5 }); },
    gsfxHongdan(o){ sounds._dan(o, 74); }, gsfxCheongdan(o){ sounds._dan(o, 72); }, gsfxChodan(o){ sounds._dan(o, 69); },
    _dan(o, root){ const v = V(o); aWhoosh({ f:600, f2:2400, a:.08, d:.3, v:.06 * v }); [0, 1, 2, 4, 3, 5].forEach((s, i) => gyg(P5(s, root), { t:.04 + i * .07, v:.09 * v, bend:i === 5 ? 1.06 : 1.015 })); jgD({ t:.04, v:.14 * v }); jgT({ t:.25, v:.1 * v }); },
    /* 광: n장 수만큼 종 + 5광 최고 */
    gsfxGwang(o){ const n = Math.max(3, Math.min(5, o.n || 3)), v = V(o);
      for(let k = 0; k < n; k++) aBell({ f:P5(k * 2, 76), t:k * .1, d:.9, v:.07 * v, idx:1.6, rev:.45 });
      [72, 76, 79].forEach(m => aBrass(m2f(m), { t:n * .1, hold:.15, d:.4, v:.045 * v }));
      if(n >= 4) kkw({ t:n * .1, v:.07 * v });
      if(n >= 5){ jing({ t:.5, f:110, v:.15 * v }); [84, 88, 91, 96].forEach((m, i) => aBrass(m2f(m), { t:.62 + i * .07, d:.25, v:.045 * v })); buk({ t:.5, v:.4 }); aSparkle({ t:.75, n:8, v:.05 }); } },
    gsfxChongtong(o){ const v = V(o); [0, .12, .24].forEach(t => buk({ t, v:.38 * v })); jing({ t:.36, f:98, v:.16 * v }); [67, 72, 76, 79, 84].forEach((m, i) => aBrass(m2f(m), { t:.36 + i * .06, d:.3, v:.055 * v })); kkw({ t:.36, v:.08 * v }); coins(8, { t:.5 }); },
    gsfxWin(o){ jgD({ v:.2 }); kkw({ t:.1, v:.07 }); [0, 2, 4, 5, 7].forEach((s, i) => aMarimba(P5(s, 72), { t:.08 + i * .07, v:.13 }));
      [67, 72, 76].forEach((m, i) => aBrass(m2f(m), { t:.45 + i * .1, d:.14, v:.07 })); [72, 76, 79, 84].forEach(m => aBrass(m2f(m), { t:.75, hold:.25, d:.45, v:.05 }));
      buk({ t:.75, v:.38 }); jing({ t:.75, f:131, v:.1 }); aSparkle({ t:.8, n:7, v:.05 }); },
    gsfxLose(o){ [67, 64, 62, 57, 55].forEach((m, i) => gyg(m2f(m), { t:i * .16, v:.08, bend:.97, d:.6 })); aTone({ f:m2f(43), f2:m2f(40), t:.75, d:.9, v:.1, rev:.3 }); jing({ t:.8, f:65, v:.08, d:1 }); },
    gsfxDraw(o){ aTone({ f:520, f2:160, type:'triangle', d:.6, v:.07, rev:.2 }); aTone({ f:530, f2:165, type:'triangle', d:.6, v:.05 }); jgT({ t:.6, v:.1 }); jgD({ t:.7, v:.14 }); },
    gsfxBak(o){ const v = V(o); buk({ v:.42 * v, f:105, f2:38 }); aTone({ f:1000, f2:700, type:'triangle', t:.01, d:.05, v:.06 * v }); kkw({ t:.12, v:.07 * v }); kkwM({ t:.24, v:.06 * v }); kkw({ t:.32, v:.07 * v }); },
    /* 째깍: 남은 초가 적을수록 높고 급함 */
    gsfxTick(o){ const n = Math.max(1, Math.min(3, o.n || 3)), f = [1900, 1500, 1200][n - 1];
      aTone({ f, type:'square', lp:5200, d:.03, v:.05 }); aNoise({ ft:'highpass', f:5000, d:.015, v:.04 }); aTone({ f:f * .5, type:'triangle', t:.005, d:.06, v:.05 });
      if(n === 1){ aTone({ f:f * 1.26, type:'square', lp:5200, t:.12, d:.03, v:.045 }); aThump({ f:160, f2:80, d:.1, v:.15 }); } },
    gsfxTimeout(o){ aTone({ f:880, type:'square', lp:2600, d:.1, v:.05 }); aTone({ f:660, type:'square', lp:2600, t:.12, d:.18, v:.05 }); buk({ t:.12, v:.3 }); aWhoosh({ f:800, f2:3000, t:.2, d:.2, v:.05 }); slap(2, { t:.32 }); },
    gsfxSun(o){ const v = V(o); jgD({ v:.18 * v }); kkw({ t:.08, v:.06 * v }); arp([0, 2, 4, 7], 72, { t:.1, v:.12 * v }); aBell({ f:m2f(96), t:.35, d:.7, v:.04 * v, rev:.4 }); },
    gsfxSunFlip(o){ aWhoosh({ f:1000, f2:4000, a:.01, d:.08, v:.05 }); slap(1, { t:.06 }); aBell({ f:m2f(88), t:.08, d:.3, v:.03 }); },
    gsfxTurn(o){ aBell({ f:P5(7, 72), d:.5, v:.04, idx:1.1, rev:.35 }); aBell({ f:P5(9, 72), t:.08, d:.6, v:.035, idx:1.1, rev:.35 }); },
    gsfxDeal(o){ const n = Math.max(4, Math.min(20, o.n || 14)); for(let k = 0; k < n; k++) slap(.6, { t:k * .045, pan:(k % 2 ? .35 : -.35) }); aWhoosh({ f:400, f2:2600, a:.05, d:.25, v:.04 }); }
  };
  /* 너무 자주 겹치면 안 되는 소리: 최소 간격(ms) */
  const gate = { gsfxLand1:35, gsfxLand2:50, gsfxLand3:120, gsfxFlip:45, gsfxGrab:90, gsfxTick:250, gsfxTurn:400, gsfxDeal:500, gsfxSunFlip:60, gsfxSteal:150, gsfxTimeout:600, gsfxBonus:120 };

  /* =========================================================
     효과 API
     ========================================================= */
  /* 카드가 바닥에 '탁' */
  function land(el, power){
    try{
      const pw = Math.max(1, Math.min(3, Math.round(power || 1)));
      let c = null;
      if(el && el.getBoundingClientRect){ c = ctr(el); if(!c.w) c = null; }
      if(!c){ const p = P(CX, CY); c = { x:p.x, y:p.y, w:60, h:90 }; }
      S('gsfxLand' + pw, { pan:pan(c.x) });
      if(RD()) return;
      const k = K(), bottom = c.y + c.h * .38;
      /* 카드 눌림: 안쪽 그림(svg)만 크기를 바꿔 FLIP(transform)과 left/top을 건드리지 않음 */
      const inner = el && el.firstElementChild;
      if(inner && inner.animate){
        const sq = [0, .05, .08, .12][pw];
        T(() => inner.animate([{ transform:'scale(1)' }, { transform:`scale(${1 + sq * .4},${1 - sq})`, offset:.25 }, { transform:`scale(${1 - sq * .25},${1 + sq * .35})`, offset:.55 }, { transform:'scale(1)' }], { duration:260 + pw * 60, easing:'ease-out', composite:'add' }));
      }
      /* 충격파 */
      ring(c.x, c.y, pw >= 2 ? '#FFE27A' : '#FFFFFF', Math.max(40, c.w * (.8 + pw * .35)), .32 + pw * .08, 4 + pw * 3);
      if(pw >= 3) ring(c.x, c.y, '#FF9F1C', c.w * 2.2, .55, 12);
      /* 먼지: 카드 아래 양옆으로 퍼짐 */
      emit(c.x, bottom, { quantity:5 + pw * 4, x:{ min:-c.w * .4, max:c.w * .4 }, speed:{ min:40 * k, max:(90 + pw * 60) * k }, angle:[200, 190, 340, 350, 180, 0], lifespan:{ min:350, max:650 + pw * 100 }, kind:'smoke', tint:['rgba(255,250,220,.55)', 'rgba(220,240,190,.5)'], scale:{ start:(4 + pw * 1.5) * Math.max(.7, k), end:(9 + pw * 3) * Math.max(.7, k), ease:'quad.out' }, alpha:{ start:.7, end:0 }, drag:3, gravityY:-30 });
      /* 파편·불꽃 */
      if(pw >= 2) emit(c.x, c.y, { quantity:6 + pw * 5, speed:{ min:160 * k, max:(260 + pw * 90) * k }, lifespan:{ min:300, max:600 }, kind:pw >= 3 ? 'shard' : 'spark', tint:pw >= 3 ? FIRE : GOLDS, scale:{ start:3.5 + pw, end:0, ease:'quad.in' }, gravityY:500, drag:2, glow:pw >= 3 });
      if(pw >= 3){ shake(22); flash('#FFF4C2', .28, 180); emit(c.x, c.y, { quantity:1, speed:0, lifespan:280, kind:'glow', tint:['#FFE27A'], scale:{ start:c.w * .35, end:c.w * .7, ease:'expo.out' }, alpha:{ start:.9, end:0 } }); }
    }catch(_){}
  }
  /* 더미에서 뒤집은 카드 */
  function flip(el){
    try{
      let c = null; if(el && el.getBoundingClientRect){ c = ctr(el); if(!c.w) c = null; }
      S('gsfxFlip', { pan:c ? pan(c.x) : 0 });
      if(!c || RD()) return;
      const k = K();
      ring(c.x, c.y, '#FFFFFF', c.w * .9, .3, 4);
      emit(c.x, c.y, { quantity:7, x:{ min:-c.w * .4, max:c.w * .4 }, y:{ min:-c.h * .4, max:c.h * .4 }, speed:{ min:10, max:60 * k }, lifespan:{ min:400, max:700 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2B0'], scale:{ start:4.5, end:0 }, glow:true });
      const inner = el.firstElementChild;
      if(inner && inner.animate) T(() => inner.animate([{ filter:'brightness(1.6)' }, { filter:'brightness(1)' }], { duration:260, easing:'ease-out' }));
    }catch(_){}
  }
  /* 먹은 카드 모으기 */
  function grab(els, w){
    try{
      const list = (Array.isArray(els) ? els : els ? Array.from(els.length != null ? els : [els]) : []).filter(e => e && e.getBoundingClientRect);
      const op = w === 'op';
      S('gsfxGrab', { n:list.length || 1, op });
      if(RD() || !list.length) return;
      const k = K(), per = Math.max(4, Math.floor(60 / list.length));
      const from = P(CX, CY);
      list.slice(0, 8).forEach((el, i) => {
        const c = ctr(el); if(!c.w) return;
        setTimeout(() => {
          /* 바닥 쪽에서 카드로 이어지는 반짝 궤적 */
          const steps = 5;
          for(let s = 1; s <= steps; s++){ const t = s / (steps + 1); emit(from.x + (c.x - from.x) * t, from.y + (c.y - from.y) * t, { quantity:1, speed:{ min:0, max:20 }, lifespan:{ min:300, max:520 }, kind:'glow', tint:[op ? '#BFE6FF' : '#FFE27A'], scale:{ start:4, end:0 }, delay:s * 18 }); }
          emit(c.x, c.y, { quantity:per, speed:{ min:60 * k, max:200 * k }, lifespan:{ min:350, max:700 }, kind:i % 2 ? 'star' : 'twinkle', tint:op ? ['#DDF1FF', '#9EE7FF', '#FFFFFF'] : GOLDS, scale:{ start:4.5, end:0 }, gravityY:op ? 160 : -60, drag:2, glow:true });
          const inner = el.firstElementChild; if(inner && inner.animate) T(() => inner.animate([{ filter:'brightness(1.7) drop-shadow(0 0 10px #FFE27A)' }, { filter:'none' }], { duration:380, easing:'ease-out' }));
        }, i * 55);
      });
    }catch(_){}
  }

  /* ----- 이벤트별 연출 ----- */
  const EV = {
    ppuk(o, l, P0, k){ S('gsfxPpuk', { op:o.op });
      deco(l, 'gsfx-glow red'); deco(l, '', crackSvg(7));
      title(l, '뻑!', 'gsfx-red gsfx-crack' + o.oc, o.op ? '상대가 뻑' : '싼 패가 묶였어요');
      shake(14);
      emit(P0.x, P0.y, { quantity:26, speed:{ min:120 * k, max:320 * k }, lifespan:{ min:500, max:900 }, kind:'shard', tint:['#FF7A7A', '#E0262F', '#FFFFFF', '#5A2E7A'], scale:{ start:6, end:2 }, gravityY:900, drag:.8 });
      emit(P0.x, P0.y + 60 * k, { quantity:10, x:{ min:-120 * k, max:120 * k }, speed:{ min:10, max:60 }, angle:{ min:80, max:100 }, lifespan:{ min:700, max:1100 }, kind:'smoke', tint:['rgba(60,40,90,.35)'], scale:{ start:10 * k, end:26 * k }, alpha:{ start:.6, end:0 }, gravityY:40 }); },
    ppuk3(o, l, P0, k){ S('gsfxPpuk3', { op:o.op });
      deco(l, 'gsfx-glow red'); deco(l, '', crackSvg(11));
      title(l, '3뻑!', 'gsfx-red gsfx-huge gsfx-crack' + o.oc, o.op ? '상대 3뻑 — 판 끝!' : '3뻑 — 판 끝!');
      flash('#FF2A3A', .35, 320); shake(30);
      emit(P0.x, P0.y, { quantity:50, speed:{ min:160 * k, max:460 * k }, lifespan:{ min:600, max:1100 }, kind:'shard', tint:['#FF7A7A', '#E0262F', '#FFFFFF', NAVY], scale:{ start:7, end:2 }, gravityY:900, drag:.6 });
      ring(P0.x, P0.y, '#FF3B3B', 260 * k, .7, 16); },
    ppukEat(o, l, P0, k){ S('gsfxPpukEat', { op:o.op });
      deco(l, 'gsfx-rays' + (o.op ? ' cold' : '')); deco(l, 'gsfx-glow' + (o.op ? ' blue' : ''));
      title(l, '뻑 먹기!', 'gsfx-beat' + o.oc, o.op ? '상대가 싼 패를 먹었어요' : '싼 패 싹 쓸어 담기!');
      if(!o.op){ flash('#FFE9A0', .4, 260); shake(18); }
      goldBlast(P0.x, P0.y, o.op ? 40 : 60, true);
      coinRain(o.op ? 20 : 40, 520); },
    jappuk(o, l, P0, k){ S('gsfxJappuk', { op:o.op });
      deco(l, 'gsfx-rays c2'); deco(l, 'gsfx-rays'); deco(l, 'gsfx-glow');
      title(l, '자뻑!', 'gsfx-rainbow gsfx-huge gsfx-beat' + o.oc, o.op ? '상대가 자기 뻑을 먹었어요' : '내 뻑을 내가 먹었다!');
      flash('#FFFFFF', .5, 320); shake(26);
      goldBlast(P0.x, P0.y, 50, true);
      [[-380, -120], [380, -120]].forEach(([dx, dy], i) => setTimeout(() => { const p = P(CX + dx, CY + dy); fireworks(p.x, p.y, 12, ['#FF5A5F', '#FFE27A', '#6EE06A', '#5EC8FF']); }, 200 + i * 140));
      coinRain(36, 600); },
    jjok(o, l, P0, k){ S('gsfxJjok', { op:o.op });
      title(l, '쪽!', 'gsfx-pink' + o.oc);
      ring(P0.x, P0.y, '#FF9CC4', 150 * k, .45, 10);
      emit(P0.x, P0.y, { quantity:22, speed:{ min:140 * k, max:340 * k }, lifespan:{ min:500, max:850 }, kind:'heart', tint:['#FF3D7F', '#FF9CC4', '#FFFFFF'], scale:{ start:7, end:0, ease:'quad.in' }, gravityY:300, drag:1.6 }); },
    ttadak(o, l, P0, k){ S('gsfxTtadak', { op:o.op });
      title(l, '따닥!', 'gsfx-wob' + o.oc);
      [0, 130].forEach((d, i) => setTimeout(() => { const p = P(CX + (i ? 120 : -120), CY + 40); ring(p.x, p.y, '#FFE27A', 120 * k, .4, 10); emit(p.x, p.y, { quantity:16, speed:{ min:180 * k, max:380 * k }, lifespan:{ min:300, max:550 }, kind:'spark', tint:GOLDS, scale:{ start:4.5, end:0 }, drag:2, glow:true }); shake(8); }, d)); },
    sseul(o, l, P0, k){ S('gsfxSseul', { op:o.op });
      if(!RD()) for(let i = 0; i < 9; i++){ const w = deco(l, 'gsfx-wind', '', `left:-700px; top:${170 + i * 40 + rr(-10, 10)}px; width:${rr(380, 680)}px; height:${rr(6, 16)}px`);
        if(w && w.animate) T(() => w.animate([{ transform:'translateX(0)', opacity:0 }, { opacity:1, offset:.2 }, { transform:'translateX(2200px)', opacity:0 }], { duration:rr(650, 900), delay:i * 45, easing:'cubic-bezier(.4,0,.3,1)', fill:'both' })); }
      title(l, '싹쓸이!', 'gsfx-blue' + o.oc, o.op ? '상대가 바닥을 쓸었어요' : '바닥이 깨끗!');
      const a = P(150, CY), b = P(1150, CY);
      /* 판이 돌려져 있어도 '판의 왼쪽 → 오른쪽'으로 쓸리게: 화면에서 본 판 x축 각도 */
      const ax = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      for(let i = 0; i < 5; i++){ const q = P(150, 190 + i * 70);
        emit(q.x, q.y, { quantity:8, speed:{ min:420 * k, max:820 * k }, angle:{ min:ax - 10, max:ax + 10 }, lifespan:{ min:600, max:1000 }, kind:'ribbon', flip:true, tint:['#FFFFFF', '#BFE6FF', '#B6F36A', '#FFE27A'], scale:{ start:4 }, alpha:{ start:1, end:0 }, drag:1.2, delay:{ min:0, max:220 } }); } },
    bomb(o, l, P0, k){ S('gsfxBomb', { op:o.op });
      deco(l, 'gsfx-glow red');
      title(l, '폭탄!', 'gsfx-slam' + o.oc);
      flash('#FFB020', .5, 300); shake(32);
      ring(P0.x, P0.y, '#FFFFFF', 220 * k, .45, 18); ring(P0.x, P0.y, '#FF6A2B', 340 * k, .75, 22);
      emit(P0.x, P0.y, { quantity:40, speed:{ min:250 * k, max:700 * k }, lifespan:{ min:450, max:900 }, kind:'shard', tint:FIRE, scale:{ start:7, end:1 }, gravityY:700, drag:1.2, glow:true });
      { const sm = P(CX, CY + 150); emit(sm.x, sm.y, { quantity:14, x:{ min:-200 * k, max:200 * k }, speed:{ min:40 * k, max:160 * k }, angle:{ min:20, max:160 }, lifespan:{ min:700, max:1200 }, kind:'smoke', tint:['rgba(70,50,60,.4)', 'rgba(120,90,80,.35)'], scale:{ start:12 * k, end:36 * k, ease:'quad.out' }, alpha:{ start:.6, end:0 }, drag:1.8 }); }
      emit(P0.x, P0.y, { quantity:1, speed:0, lifespan:320, kind:'glow', tint:['#FFB020'], scale:{ start:40 * k, end:90 * k, ease:'expo.out' }, alpha:{ start:1, end:0 } }); },
    shake(o, l, P0, k){ S('gsfxShake', { op:o.op });
      title(l, '흔들기!', 'gsfx-wob gsfx-green' + o.oc, o.n ? `${o.n}배` : '');
      shake(10); setTimeout(() => shake(10), 220);
      emit(P0.x, P0.y, { quantity:20, x:{ min:-220 * k, max:220 * k }, speed:{ min:60 * k, max:180 * k }, angle:{ min:240, max:300 }, lifespan:{ min:500, max:900 }, kind:'twinkle', tint:['#B6F36A', '#FFFFFF', '#FFE27A'], scale:{ start:5, end:0 }, gravityY:200, glow:true }); },
    bonus(o, l, P0, k){ S('gsfxBonus', { op:o.op });
      title(l, '보너스!', 'gsfx-small gsfx-beat' + o.oc, o.n ? `피 +${o.n}` : '');
      emit(P0.x, P0.y, { quantity:26, speed:{ min:40, max:220 * k }, lifespan:{ min:600, max:1000 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2B0', '#FFD6F0'], scale:{ start:6, end:0 }, gravityY:-30, drag:1.4, glow:true }); },
    steal(o, l, P0, k){ S('gsfxSteal', { op:o.op, n:o.n });
      const n = Math.max(1, Math.min(5, o.n || 1)), src = o.op ? CAP_ME : CAP_OP, dst = o.op ? CAP_OP : CAP_ME;
      title(l, `피 ${n}장!`, 'gsfx-small' + (o.op ? ' gsfx-gray' : '') + o.oc, o.op ? '상대에게 뺏겼어요' : '뺏어 왔어요');
      for(let i = 0; i < n; i++){
        const m = deco(l, 'gsfx-mini', '', `left:${src[0] + (i - (n - 1) / 2) * 56}px; top:${src[1]}px`);
        if(m && m.animate){ const dx = dst[0] - src[0] + (i - (n - 1) / 2) * 30, dy = dst[1] - src[1];
          T(() => m.animate([{ transform:'translate(0,0) scale(.6) rotate(0)', opacity:0 }, { opacity:1, offset:.12 }, { transform:`translate(${dx * .5 + 160}px,${dy * .5}px) scale(1.2) rotate(200deg)`, offset:.5 }, { transform:`translate(${dx}px,${dy}px) scale(.8) rotate(360deg)`, opacity:1, offset:.9 }, { transform:`translate(${dx}px,${dy}px) scale(.3)`, opacity:0 }], { duration:900, delay:i * 90, easing:'cubic-bezier(.4,0,.3,1)', fill:'both' }));
          setTimeout(() => { const p = P(dst[0], dst[1]); emit(p.x, p.y, { quantity:8, speed:{ min:60 * k, max:200 * k }, lifespan:{ min:300, max:600 }, kind:'star', tint:o.op ? ['#DDF1FF', '#9EE7FF'] : GOLDS, scale:{ start:4, end:0 }, glow:true }); }, 820 + i * 90); }
      } },
    go(o, l, P0, k){ const n = Math.max(1, Math.min(9, o.n || 1)); S('gsfxGo', { n, op:o.op });
      if(n >= 2) deco(l, 'gsfx-rays' + (o.op ? ' cold' : ''));
      if(n >= 3) deco(l, 'gsfx-glow' + (o.op ? ' blue' : ''));
      title(l, `${n}고!`, (n >= 3 ? 'gsfx-beat gsfx-huge' : 'gsfx-slam') + (n >= 5 ? ' gsfx-rainbow' : n >= 3 ? ' gsfx-red' : '') + o.oc, n >= 3 ? `점수 ×${Math.pow(2, n - 2)}` : '');
      flames(P0.x, P0.y + 80 * k, 10 + n * 4, 160 * k);
      const L = P(CX - 330, CY + 40), R = P(CX + 330, CY + 40);
      fireworks(L.x, L.y, 8 + n * 2, FIRE); fireworks(R.x, R.y, 8 + n * 2, FIRE);
      if(n >= 2) setTimeout(() => { const a = P(CX - 200, CY - 170), b = P(CX + 200, CY - 170); fireworks(a.x, a.y, 10, GOLDS); fireworks(b.x, b.y, 10, GOLDS); }, 260);
      if(n >= 3){ if(!o.op){ flash('#FFE27A', .45, 300); } shake(14 + n * 2);
        setTimeout(() => { if(!o.op) flash('#FFFFFF', .35, 220); shake(18 + n * 2); goldBlast(P0.x, P0.y, Math.min(46, 20 + n * 5), n >= 5); }, 850); } },
    stop(o, l, P0, k){ S('gsfxStop', { op:o.op });
      deco(l, 'gsfx-seal');
      title(l, '스톱!', 'gsfx-red gsfx-slam' + o.oc);
      setTimeout(() => { shake(24); ring(P0.x, P0.y, '#D7263D', 240 * k, .5, 14);
        emit(P0.x, P0.y + 120 * k, { quantity:18, x:{ min:-180 * k, max:180 * k }, speed:{ min:60 * k, max:200 * k }, angle:[180, 0, 200, 340], lifespan:{ min:450, max:800 }, kind:'smoke', tint:['rgba(255,250,230,.5)'], scale:{ start:7 * k, end:20 * k }, alpha:{ start:.5, end:0 }, drag:2.5 }); }, 170); },
    godori(o, l, P0, k){ S('gsfxGodori', { op:o.op });
      title(l, '고도리!', 'gsfx-blue' + o.oc);
      if(!RD()) ['#FF9CC4', '#FFE27A', '#9EE7FF'].forEach((c, i) => { const b = deco(l, 'gsfx-fly', BIRD(c));
        if(b && b.animate){ const y0 = 520 - i * 60, y1 = 60 + i * 50;
          T(() => b.animate([{ transform:`translate(-160px,${y0}px) rotate(-10deg)` }, { transform:`translate(520px,${y0 - 160}px) rotate(-18deg)`, offset:.45 }, { transform:`translate(1400px,${y1}px) rotate(-6deg)` }], { duration:1300, delay:i * 130, easing:'cubic-bezier(.3,.1,.5,1)', fill:'both' }));
          setTimeout(() => { const p = P(520, y0 - 160); emit(p.x, p.y, { quantity:6, speed:{ min:20, max:90 * k }, lifespan:{ min:700, max:1100 }, kind:'heart', tint:[c, '#FFFFFF'], scale:{ start:4, end:0 }, gravityY:120, wob:60, flip:true }); }, 600 + i * 130); } }); },
    hongdan(o, l, P0, k){ EV._dan(o, l, P0, k, '홍단!', 'gsfx-red', ['#FF5A5F', '#E0262F', '#FFB3B3'], 'gsfxHongdan'); },
    cheongdan(o, l, P0, k){ EV._dan(o, l, P0, k, '청단!', 'gsfx-blue', ['#3EA6FF', '#2251D6', '#BFE6FF'], 'gsfxCheongdan'); },
    chodan(o, l, P0, k){ EV._dan(o, l, P0, k, '초단!', 'gsfx-green', ['#4CC23A', '#1E7A2A', '#D6F7B0'], 'gsfxChodan'); },
    _dan(o, l, P0, k, txt, cls, cols, snd){ S(snd, { op:o.op });
      if(!RD()) for(let i = 0; i < 3; i++){
        const d = deco(l, 'gsfx-fly', `<svg width="1500" height="80" viewBox="0 0 1500 80"><path d="M0 40 Q 94 0 188 40 T 375 40 T 563 40 T 750 40 T 938 40 T 1125 40 T 1313 40 T 1500 40" fill="none" stroke="${NAVY}" stroke-width="34" stroke-linecap="round"/><path d="M0 40 Q 94 0 188 40 T 375 40 T 563 40 T 750 40 T 938 40 T 1125 40 T 1313 40 T 1500 40" fill="none" stroke="${cols[i % 2]}" stroke-width="22" stroke-linecap="round"/><path d="M0 34 Q 94 -6 188 34 T 375 34 T 563 34 T 750 34 T 938 34 T 1125 34 T 1313 34 T 1500 34" fill="none" stroke="${cols[2]}" stroke-width="5" stroke-linecap="round" opacity=".8"/></svg>`);
        if(d && d.animate){ const y = 150 + i * 150;
          T(() => d.animate([{ transform:`translate(${i % 2 ? 1300 : -1600}px,${y}px) rotate(${i % 2 ? 6 : -6}deg)` }, { transform:`translate(${i % 2 ? -1600 : 1300}px,${y + (i % 2 ? -40 : 40)}px) rotate(${i % 2 ? -4 : 4}deg)` }], { duration:1250, delay:i * 90, easing:'cubic-bezier(.45,.05,.55,.95)', fill:'both' })); }
      }
      title(l, txt, cls + ' gsfx-pop' + o.oc);
      emit(P0.x, P0.y, { quantity:30, speed:{ min:120 * k, max:360 * k }, lifespan:{ min:600, max:1000 }, kind:'ribbon', flip:true, tint:cols, scale:{ start:4.5 }, alpha:{ start:1, end:0 }, gravityY:300, drag:1.2, wob:50 }); },
    gwang(o, l, P0, k){ const n = Math.max(3, Math.min(5, o.n || 3)); S('gsfxGwang', { n, op:o.op });
      deco(l, 'gsfx-rays' + (o.op ? ' cold' : '')); if(n >= 4) deco(l, 'gsfx-glow' + (o.op ? ' blue' : ''));
      if(n >= 5) deco(l, 'gsfx-rays c2');
      title(l, `${n}광!`, (n >= 5 ? 'gsfx-huge gsfx-beat gsfx-rainbow' : 'gsfx-beat') + o.oc, n >= 5 ? '오광 — 최고의 패!' : '');
      for(let i = 0; i < n; i++){ const a = Math.PI + (i / (n - 1)) * Math.PI, p = P(CX + Math.cos(a) * 340, CY + Math.sin(a) * 210 + 30);
        setTimeout(() => { ring(p.x, p.y, '#FFE27A', 70 * k, .45, 7); emit(p.x, p.y, { quantity:8, speed:{ min:60 * k, max:200 * k }, lifespan:{ min:450, max:800 }, kind:'star', tint:GOLDS, scale:{ start:6, end:0 }, glow:true, gravityY:120 }); }, i * 100); }
      if(n >= 5){ flash('#FFFFFF', .5, 360); shake(24); setTimeout(() => { goldBlast(P0.x, P0.y, 46, true); coinRain(20, 560); }, 520); } else if(n >= 4){ flash('#FFE9A0', .3, 240); shake(12); } },
    chongtong(o, l, P0, k){ S('gsfxChongtong', { op:o.op });
      deco(l, 'gsfx-rays'); deco(l, 'gsfx-rays c2'); deco(l, 'gsfx-glow');
      title(l, '총통!', 'gsfx-huge gsfx-slam' + o.oc, '같은 월 넉 장!');
      flash('#FFFFFF', .45, 300); setTimeout(() => shake(26), 180);
      goldBlast(P0.x, P0.y, 50, true); coinRain(30, 560); },
    win(o, l, P0, k){ S('gsfxWin', {});
      deco(l, 'gsfx-rays'); deco(l, 'gsfx-glow');
      title(l, '승리!', 'gsfx-huge gsfx-beat', o.text || '');
      if(!RD()) T(() => fxConfetti());
      goldBlast(P0.x, P0.y, 40, true); },
    lose(o, l, P0, k){ S('gsfxLose', {});
      deco(l, 'gsfx-glow blue');
      title(l, '아쉬워요…', 'gsfx-gray gsfx-sink', o.text || '');
      emit(P0.x, P0.y - 120 * k, { quantity:22, x:{ min:-400 * k, max:400 * k }, speed:{ min:30, max:90 * k }, angle:{ min:80, max:100 }, lifespan:{ min:1000, max:1500 }, kind:'dot', tint:['#9EB8FF', '#C9C3E6', '#6E7BD6'], scale:{ start:4, end:2 }, alpha:{ start:.8, end:0 }, gravityY:80 }); },
    draw(o, l, P0, k){ S('gsfxDraw', {});
      title(l, '나가리', 'gsfx-gray gsfx-spin', o.text || '이번 판은 무승부');
      emit(P0.x, P0.y, { quantity:16, speed:{ min:60 * k, max:180 * k }, lifespan:{ min:700, max:1100 }, kind:'smoke', tint:['rgba(230,225,245,.55)'], scale:{ start:8 * k, end:24 * k }, alpha:{ start:.6, end:0 }, drag:2 }); },
    bak(o, l, P0, k){ S('gsfxBak', { op:o.op });
      deco(l, 'gsfx-seal');
      title(l, String(o.text || '박') + '!', 'gsfx-red gsfx-slam' + o.oc, o.op ? '내가 박을 썼어요' : '상대에게 박!');
      setTimeout(() => { shake(18); ring(P0.x, P0.y, '#D7263D', 220 * k, .45, 12); emit(P0.x, P0.y, { quantity:18, speed:{ min:150 * k, max:360 * k }, lifespan:{ min:400, max:700 }, kind:'shard', tint:['#FF5A5F', '#FFFFFF', '#FFD34D'], scale:{ start:5, end:1 }, gravityY:600, drag:1.2 }); }, 170); },
    timeout(o, l, P0, k){ S('gsfxTimeout', {});
      deco(l, 'gsfx-edge');
      title(l, '시간 끝!', 'gsfx-red gsfx-wob gsfx-small' + o.oc, '자동으로 냈어요');
      shake(10); },
    sun(o, l, P0, k){ S('gsfxSun', { op:o.op });
      deco(l, 'gsfx-rays' + (o.op ? ' cold' : ''));
      title(l, '선!', 'gsfx-beat' + o.oc, o.op ? '상대가 먼저' : '내가 먼저 쳐요');
      goldBlast(P0.x, P0.y, 26, false); },
    sunFlip(o, l, P0, k){ S('gsfxSunFlip', {}); emit(P0.x, P0.y, { quantity:10, x:{ min:-150 * k, max:150 * k }, speed:{ min:10, max:80 * k }, lifespan:{ min:400, max:700 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2B0'], scale:{ start:5, end:0 }, glow:true }); },
    turn(o, l, P0, k){ S('gsfxTurn', {}); const h = P(CX, 760); ring(h.x, h.y, 'rgba(255,240,180,.9)', 260 * k, .6, 6); },
    deal(o, l, P0, k){ S('gsfxDeal', { n:o.n }); emit(P0.x, P0.y, { quantity:14, x:{ min:-300 * k, max:300 * k }, y:{ min:-100 * k, max:100 * k }, speed:{ min:10, max:60 * k }, lifespan:{ min:400, max:800 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2B0'], scale:{ start:4, end:0 }, delay:{ min:0, max:500 }, glow:true }); }
  };
  /* 타이틀 없이 가볍게 지나가는 이벤트(층 대기열을 쓰지 않음) */
  const LIGHT = { sunFlip:1, turn:1, deal:1 };

  function event(name, o){
    try{
      o = Object.assign({}, o || {});
      o.op = who(o) === 'op'; o.oc = o.op ? ' gsfx-op' : '';
      const k = K(), P0 = P(CX, CY);
      if(name === 'tick'){   /* 째깍: 큰 숫자 한 개만(이전 것은 지움) */
        const n = Math.max(1, Math.min(3, o.n || 3)); S('gsfxTick', { n });
        if(tickLayer) T(() => tickLayer.remove());
        const l = layer(true); tickLayer = l; if(!l) return;
        const d = document.createElement('div'); d.className = 'gsfx-num'; d.textContent = String(n); if(RD()) d.style.animation = 'gsfx-fade .6s forwards'; l.appendChild(d);
        if(n === 1) deco(l, 'gsfx-edge');
        setTimeout(() => { T(() => l.remove()); if(tickLayer === l) tickLayer = null; }, 760);
        return;
      }
      const f = EV[name]; if(!f || name[0] === '_') return;
      const l = LIGHT[name] ? null : layer(false);
      f(o, l, P0, k);
    }catch(_){}
  }
  function clear(){
    try{
      while(live.length){ const l = live.shift(); T(() => l.remove()); }
      if(tickLayer){ T(() => tickLayer.remove()); tickLayer = null; }
      document.querySelectorAll('.gsfx-l').forEach(l => T(() => l.remove()));
    }catch(_){}
  }
  return { land, flip, grab, event, clear, sounds, gate, _P:P, _B:B };
})();
