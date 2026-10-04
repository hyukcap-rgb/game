/* 공용: 화면 효과·소리 엔진·아이템 */
/* ---------- 공용 그림: 여우 얼굴(내 아바타)·도구 아이콘. (여우 게임 화면 설명은 games/fox로 옮김) 그림은 직접 그린 3D 여우 ---------- */
const FOX_FACE = `<svg viewBox="0 0 40 38" aria-hidden="true">${toyImage('fox', -3, -4, 46, 46)}</svg>`;   /* 공용 3D 여우(40×38 틀 안) */
const FX_ICON = {
  star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.9l3 6.1 6.7 1-4.9 4.7 1.2 6.7L12 17.2l-6 3.2 1.2-6.7L2.3 9l6.7-1z" fill="url(#gGold)" stroke="#2A1650" stroke-width="1.9" stroke-linejoin="round"/><path d="M8.6 9.3l2.3-.4 1-2.1" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".7"/></svg>',
  bulb:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6a6.6 6.6 0 0 0-3.9 11.9c.7.5 1.1 1.3 1.1 2.1v1h5.6v-1c0-.8.4-1.6 1.1-2.1A6.6 6.6 0 0 0 12 2.6z" fill="#FFF7D6" stroke="#4A2A00" stroke-width="2" stroke-linejoin="round"/><path d="M9.4 19.6h5.2v.6a1.9 1.9 0 0 1-1.9 1.9h-1.4a1.9 1.9 0 0 1-1.9-1.9z" fill="#4A2A00"/><path d="M9.9 8.4a2.8 2.8 0 0 1 2.1-1.5" stroke="#FFB020" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  auto:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-linecap="round"><rect x="2.5" y="2.5" width="19" height="19" rx="4.5" stroke-width="2.2"/><path d="M12 2.5v19M2.5 12h19" stroke-width="1.6" opacity=".7"/><path d="M5.2 5.2l3.6 3.6M8.8 5.2L5.2 8.8M15.2 15.2l3.6 3.6M18.8 15.2l-3.6 3.6M15.2 5.2l3.6 3.6M18.8 5.2l-3.6 3.6" stroke-width="2.3"/></svg>',
  undo:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5L4 9.5l5 5"/><path d="M4 9.5h10a5.5 5.5 0 0 1 0 11h-3"/></svg>'
};
/* ===================== 이펙트 엔진 v2 (효과팀, 2026-10-03) =====================
   Phaser 파티클·트윈·카메라, PixiJS 파티클 컨테이너의 방식을 이 엔진에 맞게 가볍게 옮긴 것.
   · 파티클: 수명 동안 크기·투명도·색이 시작→끝으로 바뀜(완화 곡선), 발광(더하기 합성)은 미리 그린 빛 텍스처로 그려 빠름
   · 묶음 관리: 한 캔버스·한 루프·개수 상한. 화면이 버벅이면(프레임이 길어지면) 새 효과 양을 자동으로 줄임
   · 카메라: 흔들기(fxShake)·번쩍임(fxFlash)·줌 펀치(fxPunch) — 판(요소)에만, 게임 상태는 건드리지 않음
   · 안전: 효과는 보이기만 한다(게임 상태·문제 씨앗 rng를 쓰지 않음, 눌림을 막지 않음). 효과 코드에서 오류가 나도 지우고 끝낸다 */
const FXR = { cv:null, ctx:null, parts:[], rings:[], raf:0, reduce:false, q:1, ema:16, good:0, tex:{}, CAP:620 };
try{ FXR.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){}
/* 완화 곡선(Phaser 이름과 같게) */
const FX_EASE = {
  linear:k => k, 'quad.out':k => 1 - (1 - k) * (1 - k), 'quad.in':k => k * k, 'cubic.out':k => 1 - Math.pow(1 - k, 3), 'cubic.in':k => k * k * k,
  'expo.out':k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k), 'sine.inout':k => -(Math.cos(Math.PI * k) - 1) / 2,
  'back.out':k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
};
const fxEase = n => FX_EASE[n] || FX_EASE.linear;
/* 효과 층 자리: 팝업 창이 열려 있으면 창 뒤(어두운 막 위, 창 아래)로 옮겨 글자·버튼 위로 지나가지 않게 한다 */
function fxPlace(){
  const cv = FXR.cv, v = document.getElementById('veil'); if(!cv) return;
  const on = !!(v && v.classList.contains('on'));
  if(on && cv.parentNode !== v) v.insertBefore(cv, v.firstChild);
  else if(!on && cv.parentNode !== document.body) document.body.appendChild(cv);
}
function fxCanvas(){
  if(FXR.cv && FXR.cv.parentNode){ fxPlace(); return; }
  const cv = document.createElement('canvas'); cv.className = 'fxfx'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv);
  FXR.cv = cv; FXR.ctx = cv.getContext('2d'); fxPlace();
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; FXR.ctx.setTransform(d, 0, 0, d, 0, 0); };
  size(); addEventListener('resize', size);
}
/* 빛 텍스처: 색마다 한 번 그려 두고 drawImage로 찍는다(그라데이션을 매번 만들지 않음) */
function fxTex(c){
  let t = FXR.tex[c]; if(t) return t;
  t = document.createElement('canvas'); t.width = t.height = 64; const x = t.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(.18, c); g.addColorStop(.5, fxRgba(c, .35)); g.addColorStop(1, fxRgba(c, 0));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return FXR.tex[c] = t;
}
function fxRgb(c){ const h = String(c).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(s => s + s).join('') : h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function fxRgba(c, a){ if(!/^#/.test(c)) return c; const [r, g, b] = fxRgb(c); return `rgba(${r},${g},${b},${a})`; }
function fxMix(c1, c2, k){ const a = fxRgb(c1), b = fxRgb(c2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; }
function fxDraw(ctx, p, k){
  const s = p.s * (p.s1 == null ? 1 : 1 + (p.s1 - 1) * p.se(k));
  const al = p.a1 === 0 ? p.a0 * (k < .6 ? 1 : 1 - p.ae((k - .6) / .4)) : p.a0 + (p.a1 - p.a0) * p.ae(k);   /* 사라지는 효과는 60%까지 또렷하게 */
  if(al <= .01 || s <= .05) return;
  ctx.globalAlpha = Math.min(1, al);
  const col = p.c2 ? fxMix(p.c, p.c2, k) : p.c;
  if(p.kind === 'glow'){   /* 빛 알갱이: 텍스처를 더하기로 */
    ctx.globalCompositeOperation = 'lighter'; const d = s * 4; ctx.drawImage(fxTex(p.c), p.x - d / 2, p.y - d / 2, d, d); ctx.globalCompositeOperation = 'source-over'; return;
  }
  if(p.kind === 'smoke'){ ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill(); return; }
  if(p.glow && FXR.q > .6){ ctx.globalCompositeOperation = 'lighter'; const d = s * 3.2; ctx.globalAlpha = Math.min(1, al) * .55; ctx.drawImage(fxTex(p.c), p.x - d / 2, p.y - d / 2, d, d); ctx.globalAlpha = Math.min(1, al); }
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.rotate(p.kind === 'spark' ? Math.atan2(p.vy, p.vx) : p.rot);
  if(p.flip) ctx.scale(1, Math.cos(p.rot * 1.7));   /* 종이가 뒤집히며 펄럭임 */
  ctx.fillStyle = col;
  if(p.kind === 'star'){ ctx.beginPath(); for(let i = 0; i < 10; i++){ const a = i * Math.PI / 5, rr = i % 2 ? s * .45 : s; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
  else if(p.kind === 'twinkle'){ const r = s * (1 + .35 * Math.sin(p.t * 22)); ctx.beginPath(); ctx.moveTo(0, -r * 1.6); ctx.quadraticCurveTo(0, 0, r * 1.6, 0); ctx.quadraticCurveTo(0, 0, 0, r * 1.6); ctx.quadraticCurveTo(0, 0, -r * 1.6, 0); ctx.quadraticCurveTo(0, 0, 0, -r * 1.6); ctx.fill(); }
  else if(p.kind === 'dot'){ ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); }
  else if(p.kind === 'spark'){ const l = Math.min(s * 5, 6 + Math.hypot(p.vx, p.vy) * .03); ctx.beginPath(); ctx.moveTo(-l, 0); ctx.lineTo(0, -s * .35); ctx.lineTo(s * .8, 0); ctx.lineTo(0, s * .35); ctx.closePath(); ctx.fill(); }
  else if(p.kind === 'shard'){ ctx.beginPath(); ctx.moveTo(-s, -s * .7); ctx.lineTo(s * 1.1, -s * .2); ctx.lineTo(-s * .3, s * .9); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(-s, -s * .7); ctx.lineTo(s * 1.1, -s * .2); ctx.lineTo(0, -s * .1); ctx.closePath(); ctx.fill(); }
  else if(p.kind === 'heart'){ ctx.beginPath(); ctx.moveTo(0, s * .9); ctx.bezierCurveTo(-s * 1.6, -s * .2, -s * .7, -s * 1.3, 0, -s * .45); ctx.bezierCurveTo(s * .7, -s * 1.3, s * 1.6, -s * .2, 0, s * .9); ctx.fill(); }
  else if(p.kind === 'ring'){ ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s * .35); ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke(); }
  else if(p.kind === 'ribbon'){ ctx.fillRect(-s * .35, -s * 1.6, s * .7, s * 3.2); }
  else ctx.fillRect(-s, -s * .45, s * 2, s * .9);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
function fxLoop(){
  const now = performance.now(), raw = now - (FXR.lt || now), dt = Math.min(0.05, raw / 1000); FXR.lt = now;
  /* 버벅임 감지: 프레임 시간이 길면 품질을 낮추고, 2초 넘게 부드러우면 되돌림 */
  if(raw > 0){ FXR.ema = FXR.ema * .9 + Math.min(100, raw) * .1; if(FXR.ema > 30){ FXR.q = .5; FXR.good = 0; } else if(FXR.ema < 20 && FXR.q < 1 && (FXR.good += raw) > 2000) FXR.q = 1; }
  try{
    const ctx = FXR.ctx;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for(const r of FXR.rings){
      r.t += dt; const k = r.t / r.dur; if(k >= 1 || r.t < 0) continue;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 3));
      ctx.strokeStyle = r.c;
      if(FXR.q > .6){ ctx.globalAlpha = (1 - k) * r.a * .35; ctx.lineWidth = (r.w * (1 - k) + 1) * 3; ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.stroke(); }   /* 바깥 번짐 */
      ctx.globalAlpha = (1 - k) * r.a; ctx.lineWidth = r.w * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.stroke();
    }
    for(const p of FXR.parts){
      p.t += dt; if(p.t < 0) continue; const k = p.t / p.dur; if(k >= 1) continue;
      if(p.well){ const dx = p.well.x - p.x, dy = p.well.y - p.y, d2 = Math.max(400, dx * dx + dy * dy), f = p.well.power * 9e5 / d2; p.vx += dx / Math.sqrt(d2) * f * dt; p.vy += dy / Math.sqrt(d2) * f * dt; }
      p.vy += p.g * dt; p.vx *= (1 - p.drag * dt); p.vy *= (1 - p.drag * dt); p.x += p.vx * dt + (p.wob ? Math.sin(p.t * 6 + p.ph) * p.wob * dt : 0); p.y += p.vy * dt; p.rot += p.vr * dt;
      fxDraw(ctx, p, k);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }catch(_){ FXR.parts = []; FXR.rings = []; try{ FXR.ctx.setTransform(1, 0, 0, 1, 0, 0); FXR.ctx.clearRect(0, 0, FXR.cv.width, FXR.cv.height); const d = Math.min(2, devicePixelRatio || 1); FXR.ctx.setTransform(d, 0, 0, d, 0, 0); }catch(__){} }
  FXR.parts = FXR.parts.filter(p => p.t < p.dur); FXR.rings = FXR.rings.filter(r => r.t < r.dur);
  if(FXR.parts.length || FXR.rings.length) FXR.raf = requestAnimationFrame(fxLoop); else { FXR.raf = 0; FXR.lt = 0; }
}
function fxKick(){ if(!FXR.raf){ FXR.lt = 0; FXR.raf = requestAnimationFrame(fxLoop); } }
/* 상한을 넘으면 오래된 것부터 버림(PixiJS 파티클 컨테이너처럼 한 묶음만 관리) */
function fxAdd(p){ FXR.parts.push(p); if(FXR.parts.length > FXR.CAP) FXR.parts.splice(0, FXR.parts.length - FXR.CAP); }
const fxN = n => Math.max(1, Math.round(n * FXR.q * (typeof G !== 'undefined' && G && G.duel && !G.over ? .75 : 1)));
function fxRing(x, y, c, r1, dur, w){ if(FXR.reduce) return; fxCanvas(); FXR.rings.push({ x, y, c, r0:4, r1, dur, w:w || 8, a:1, t:0 }); if(FXR.rings.length > 40) FXR.rings.shift(); fxKick(); }
const fxRange = (v, d) => v == null ? d : typeof v === 'number' ? v : Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v.min + Math.random() * (v.max - v.min);
/* 예전 방식(그대로 둠): 한 점에서 n개 터뜨리기 */
function fxBurst(x, y, colors, n, o = {}){
  if(FXR.reduce) return; fxCanvas();
  n = fxN(n);
  if(FXR.parts.length > 500) n = Math.min(n, 6);
  for(let i = 0; i < n; i++){
    const a = o.dir != null ? o.dir + (Math.random() - .5) * (o.spread ?? 1.2) : Math.random() * Math.PI * 2, sp = (o.speed || 260) * (0.45 + Math.random() * 0.8);
    fxAdd({ x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - (o.up ?? 90), g:o.g ?? 520, drag:o.drag ?? 2.2, rot:Math.random() * 6, vr:(Math.random() - .5) * 14, glow:!!o.glow,
      s:(o.size || 5) * (0.6 + Math.random() * 0.8), s1:.4, se:fxEase('quad.in'), a0:1, a1:0, ae:fxEase('linear'), c:colors[i % colors.length], kind:o.kinds ? o.kinds[i % o.kinds.length] : 'star',
      t:-(o.delay || 0) * Math.random(), dur:(o.dur || 0.8) * (0.8 + Math.random() * 0.4) });
  }
  /* 발광 효과는 가운데에 짧은 빛 덩어리 + 반짝이 몇 개를 곁들임 */
  if(o.glow && FXR.q > .6){
    fxAdd({ x, y, vx:0, vy:0, g:0, drag:0, rot:0, vr:0, s:(o.size || 5) * 5, s1:1.8, se:fxEase('expo.out'), a0:.9, a1:0, ae:fxEase('quad.out'), c:colors[0], kind:'glow', t:0, dur:.35 });
    for(let i = 0; i < 3; i++){ const a = Math.random() * 6.28, d = 10 + Math.random() * 26;
      fxAdd({ x:x + Math.cos(a) * d, y:y + Math.sin(a) * d, vx:0, vy:-20, g:0, drag:0, rot:0, vr:0, s:(o.size || 5) * .9, s1:0, se:fxEase('quad.in'), a0:1, a1:0, ae:fxEase('linear'), c:'#FFFFFF', kind:'twinkle', t:-Math.random() * .2, dur:.55 }); }
  }
  fxKick();
}
/* Phaser 방식 설정으로 뿜기: fxEmit(x, y, { quantity, speed:{min,max}, angle:{min,max}(도), lifespan:{min,max}(ms),
   scale:{start,end,ease}, alpha:{start,end,ease}, color:[시작, 끝], tint:[색들], gravityY, drag, kind, glow, rotate, wob, flip, well:{x,y,power} }) */
function fxEmit(x, y, c = {}){
  if(FXR.reduce) return; fxCanvas();
  const n = fxN(c.quantity || 12), sc = c.scale || {}, al = c.alpha || {}, tint = c.tint || (c.color ? [c.color[0]] : ['#FFFFFF']);
  for(let i = 0; i < n; i++){
    const ang = fxRange(c.angle, Math.random() * 360) * Math.PI / 180, sp = fxRange(c.speed, 200), life = fxRange(c.lifespan, 800) / 1000;
    const s0 = sc.start ?? fxRange(c.size, 5);
    fxAdd({ x:x + fxRange(c.x, 0), y:y + fxRange(c.y, 0), vx:Math.cos(ang) * sp, vy:Math.sin(ang) * sp, g:c.gravityY ?? 0, drag:c.drag ?? 0, rot:Math.random() * 6, vr:fxRange(c.rotate, (Math.random() - .5) * 8),
      s:s0 * (sc.random ? .6 + Math.random() * .8 : 1), s1:sc.end == null ? null : sc.end / (s0 || 1), se:fxEase(sc.ease), a0:al.start ?? 1, a1:al.end ?? 0, ae:fxEase(al.ease),
      c:tint[i % tint.length], c2:c.color && c.color[1], kind:c.kind || 'dot', glow:!!c.glow, wob:c.wob || 0, ph:Math.random() * 6, flip:!!c.flip, well:c.well || null,
      t:-fxRange(c.delay, 0) / 1000, dur:life });
  }
  fxKick();
}
/* 요소 가운데에서 터지는 효과 묶음 */
function fxPop(el, kind){
  if(!el) return; const p = fxCenter(el);
  if(kind === 'gold'){ fxRing(p.x, p.y, '#FFE27A', Math.max(60, p.w * .9), .55, 10); fxBurst(p.x, p.y, ['#FFE27A','#FFB020','#FFFFFF','#FFD35C'], 26, { speed:330, size:5.5, kinds:['star','spark','dot'], up:120, g:420, glow:true, dur:1 }); }
  else if(kind === 'heart'){ fxBurst(p.x, p.y, ['#FF3D7F','#FF9CC4','#FFFFFF'], 12, { speed:200, size:6, kinds:['heart','heart','dot'], up:160, g:380, dur:.9 }); }
  else if(kind === 'coin'){ fxBurst(p.x, p.y, ['#FFC93C','#FFE98E','#FFFFFF'], 14, { speed:240, size:5, kinds:['dot','star'], up:200, g:700, dur:.8 }); }
  else { fxRing(p.x, p.y, '#FFFFFF', Math.max(40, p.w * .7), .4, 6); fxBurst(p.x, p.y, ['#FFFFFF','#FFE27A','#CFC5FF'], 12, { speed:220, size:4, kinds:['spark','dot'], up:60, glow:true, dur:.6 }); }
}
/* 카메라: 흔들기(조금 회전 섞음)·줌 펀치·번쩍임. 모두 transform/opacity만 바꿔 배치(layout)는 그대로 */
function fxShake(el, px){ if(!el || FXR.reduce || !el.animate) return; const a = px || 6, r = Math.min(1.2, a * .12);
  el.animate([{ transform:'translate(0,0)' }, { transform:`translate(${-a}px,${a * .4}px) rotate(${-r}deg)` }, { transform:`translate(${a * .8}px,${-a * .3}px) rotate(${r * .7}deg)` }, { transform:`translate(${-a * .5}px,${a * .2}px) rotate(${-r * .3}deg)` }, { transform:`translate(${a * .2}px,0)` }, { transform:'translate(0,0)' }], { duration:380, easing:'ease-out' }); }
function fxPunch(el, s){ if(!el || FXR.reduce || !el.animate) return; el.animate([{ transform:'scale(1)' }, { transform:`scale(${s || 1.04})`, offset:.3 }, { transform:'scale(1)' }], { duration:320, easing:'cubic-bezier(.2,1.6,.4,1)' }); }
function fxFlash(color, alpha, ms){
  if(FXR.reduce) return;
  const d = document.createElement('div'); d.className = 'fxflash'; d.style.background = color || '#fff'; document.body.appendChild(d);
  const an = d.animate([{ opacity:alpha ?? .35 }, { opacity:0 }], { duration:ms || 260, easing:'ease-out' }); an.onfinish = () => d.remove(); setTimeout(() => d.remove(), (ms || 260) + 200);
}
function fxConfetti(){   /* 완성: 화면 위에서 색종이(펄럭임) + 양옆 대포 + 반짝이. 1.2초 안에 끝(UI 검수 2026-10-04) */
  if(FXR.reduce) return; fxCanvas();
  const cols = ['#FF9E4F','#FFD04D','#FF8C9E','#62AEFF','#5ECF9C','#B48BFF','#fff'], k = FXR.q;
  /* 결과 창이 열려 있으면 효과 층이 창 뒤로 가므로(CSS) 창 바깥에서 잘 보이게 위·양옆에만 뿌린다 */
  for(let i = 0; i < 90 * k; i++) fxAdd({ x:Math.random() * innerWidth, y:-20 - Math.random() * 80, vx:(Math.random() - .5) * 140, vy:260 + Math.random() * 320, g:420, drag:.7, wob:60, ph:Math.random() * 6, flip:true,
    rot:Math.random() * 6, vr:(Math.random() - .5) * 12, s:5 + Math.random() * 5, a0:1, a1:0, ae:fxEase('linear'), c:cols[i % cols.length], kind:i % 7 === 0 ? 'star' : i % 4 === 0 ? 'ribbon' : 'rect', t:-Math.random() * .15, dur:1.05 });
  for(const side of [0, 1]) for(let i = 0; i < 38 * k; i++){
    const a = side ? -Math.PI * (.62 + Math.random() * .16) : -Math.PI * (.22 + Math.random() * .16), sp = 760 + Math.random() * 520;
    fxAdd({ x:side ? innerWidth + 10 : -10, y:innerHeight * .78, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, g:1100, drag:1.8, wob:40, ph:Math.random() * 6, flip:true,
      rot:Math.random() * 6, vr:(Math.random() - .5) * 16, s:4 + Math.random() * 5, a0:1, a1:0, ae:fxEase('linear'), c:cols[(i + side) % cols.length], kind:i % 6 ? 'rect' : 'star', t:-Math.random() * .1, dur:1.05 });
  }
  /* 화면 가운데 위쪽에서 반짝이 */
  if(k > .6) fxEmit(innerWidth / 2, innerHeight * .3, { quantity:22, speed:{ min:60, max:260 }, lifespan:{ min:600, max:1000 }, kind:'twinkle', tint:['#FFFFFF','#FFF2B0','#FFD6F0'], scale:{ start:5, end:0, ease:'quad.in' }, gravityY:60, drag:1.5, glow:true });
  fxKick();
}
function fxCenter(el){ const r = el.getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2, w:r.width, h:r.height }; }
function fxFloat(x, y, html, cls){
  const d = document.createElement('div'); d.className = 'fxfloat ' + (cls || ''); d.innerHTML = html;
  d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d);
  setTimeout(() => d.remove(), 1300);
  return d;
}
function fxFly(fromEl, toEl, html, done){   /* 작은 여우가 위쪽 '여우 n/N' 칸으로 날아감 */
  if(!fromEl || !toEl || FXR.reduce){ done && done(); return; }
  const a = fxCenter(fromEl), b = fxCenter(toEl), d = document.createElement('div');
  d.className = 'fxfly'; d.innerHTML = html; d.style.width = a.w + 'px'; d.style.height = a.h + 'px'; d.style.left = (a.x - a.w/2) + 'px'; d.style.top = (a.y - a.h/2) + 'px';
  document.body.appendChild(d);
  const dx = b.x - a.x, dy = b.y - a.y, sc = b.w / a.w;
  const an = d.animate([
    { transform:'translate(0,0) scale(1) rotate(0)' },
    { transform:`translate(${dx * .45}px, ${dy * .45 - 60}px) scale(${(1 + sc) * .75}) rotate(-12deg)`, offset:.45 },
    { transform:`translate(${dx}px, ${dy}px) scale(${sc}) rotate(0)` }
  ], { duration:560, easing:'cubic-bezier(.45,0,.3,1)', fill:'forwards' });
  an.onfinish = () => { d.remove(); done && done(); };
}
/* ===================== 사운드·효과팀: 공용 오디오 엔진 =====================
   · 파일 없이 Web Audio로 전부 합성(내려받을 파일 0개, 로딩 0초)
   · 믹서: 효과음(sfx)·UI(ui)·배경 소리(amb) 버스 → 잔향(리버브) 보냄 → 리미터 → 스피커
   · 좌우 위치(스테레오): 화면 왼쪽에서 난 소리는 왼쪽에서 들림
   · 게이트: 같은 소리는 최소 간격, 동시에 울리는 소리는 최대 44개(구슬 수백 개가 부딪혀도 깨끗하게)
   · 음계: 연속 성공은 5음계(도레미솔라)로 한 칸씩 올라가 어떤 순서로 울려도 화음이 맞음
   · 설정(이 브라우저에 저장): 전체 소리, 효과음 크기, 배경 소리 크기, 진동 */
const SND = { ac:null, on:true };
try{ SND.on = localStorage.getItem('hp:sound') !== '0'; }catch(_){}
const AUD = { ac:null, master:null, bus:{}, rev:null, nb:null, last:{}, live:0, amb:null, ambKind:null, set:{ sfx:.85, amb:.5, hap:true } };
try{ Object.assign(AUD.set, JSON.parse(localStorage.getItem('hp:audio') || '{}')); }catch(_){}
function audSave(){ try{ localStorage.setItem('hp:audio', JSON.stringify(AUD.set)); localStorage.setItem('hp:sound', SND.on ? '1' : '0'); }catch(_){} }
function audInit(){
  if(AUD.ac) return AUD.ac;
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
  let ac; try{ ac = new AC({ latencyHint:'interactive' }); }catch(_){ try{ ac = new AC(); }catch(__){ return null; } }
  AUD.ac = SND.ac = ac;
  const lim = ac.createDynamicsCompressor(); lim.threshold.value = -12; lim.knee.value = 8; lim.ratio.value = 10; lim.attack.value = .002; lim.release.value = .16;
  const master = ac.createGain(); master.gain.value = SND.on ? 1 : 0; master.connect(lim); lim.connect(ac.destination);
  AUD.master = master;
  for(const k of ['sfx','ui','amb']){ const g = ac.createGain(); g.connect(master); AUD.bus[k] = g; }
  /* 잔향: 1.5초짜리 방 울림을 직접 만들어 씀(좌우 다르게 → 넓게 들림) */
  const len = Math.floor(ac.sampleRate * 1.5), ir = ac.createBuffer(2, len, ac.sampleRate);
  for(let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for(let i = 0; i < len; i++){ const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.4) * (i < 120 ? i / 120 : 1); } }
  const conv = ac.createConvolver(); conv.buffer = ir;
  const rin = ac.createGain(), hp = ac.createBiquadFilter(), wet = ac.createGain();
  hp.type = 'highpass'; hp.frequency.value = 300; wet.gain.value = .55;
  rin.connect(hp); hp.connect(conv); conv.connect(wet); wet.connect(master);
  AUD.rev = rin;
  /* 흰 소음 2초(바람·물·폭발·종이 소리의 재료) */
  const nl = Math.floor(ac.sampleRate * 2), nb = ac.createBuffer(1, nl, ac.sampleRate), nd = nb.getChannelData(0);
  for(let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
  AUD.nb = SND.nb = nb;
  audVol();
  return ac;
}
function audVol(){
  if(!AUD.ac) return;
  const t = AUD.ac.currentTime, s = AUD.set;
  AUD.master.gain.setTargetAtTime(SND.on ? 1 : 0, t, .03);
  AUD.bus.sfx.gain.setTargetAtTime(s.sfx, t, .03);
  AUD.bus.ui.gain.setTargetAtTime(s.sfx * .8, t, .03);
  AUD.bus.amb.gain.setTargetAtTime(s.amb, t, .25);
}
function audReady(){
  if(!SND.on) return null;
  const ac = audInit(); if(!ac) return null;
  if(ac.state !== 'running') ac.resume().catch(() => {});   /* 아이폰: 전화·백그라운드 뒤 'interrupted'도 다시 켬 */
  return ac;
}
function sndSetOn(v){
  SND.on = !!v; audSave();
  if(v) audInit();
  audVol();
  if(!v) ambStop(); else if(typeof G !== 'undefined' && G && !G.over && document.body.dataset.mode) ambStart(ambFor(G.id));
}
/* 휴대폰 소리 켜기
   · 아이폰은 화면을 누르는 순간에만 소리를 켤 수 있다 → 누를 때마다(한 번만이 아니라) 꺼져 있으면 다시 켬
     (첫 터치가 실패하거나 전화·카톡 전환으로 'interrupted'가 되면 예전엔 다시 켜지지 않았음)
   · 아이폰 무음(벨소리) 스위치를 켜 두면 웹 소리가 꺼지는 문제: iOS 17+는 audioSession을 'playback'으로,
     그보다 오래된 기기는 무음 오디오 태그를 한 번 재생해 미디어 소리로 바꾼다(게임 소리는 미디어 볼륨으로 남) */
let AUD_EL = null;
function audSession(){
  try{ if(navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; return !!navigator.audioSession; }catch(_){ return false; }
}
function audUnlock(){
  if(!SND.on) return;
  const hasSession = audSession();
  const ac = audInit(); if(!ac) return;
  if(ac.state !== 'running') ac.resume().catch(() => {});
  if(!AUD.unlocked){
    try{ const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); }catch(_){}
    if(!hasSession && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document){
      try{
        if(!AUD_EL){ AUD_EL = document.createElement('audio'); AUD_EL.setAttribute('playsinline', ''); AUD_EL.setAttribute('x-webkit-airplay', 'deny'); AUD_EL.preload = 'auto';
          AUD_EL.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='; }
        const p = AUD_EL.play(); if(p && p.catch) p.catch(() => {});
      }catch(_){}
    }
    if(ac.state === 'running') AUD.unlocked = true;
  }
}
audSession();
['touchend','click','pointerup','keydown'].forEach(ev => addEventListener(ev, audUnlock, { passive:true, capture:true }));
document.addEventListener('visibilitychange', () => { if(!AUD.ac) return; if(document.hidden) AUD.ac.suspend().catch(() => {}); else if(SND.on) AUD.ac.resume().catch(() => {}); });

/* ----- 소리 재료 ----- */
const m2f = m => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
const penta = (n, root = 72) => m2f(root + 12 * Math.floor(n / 5) + PENTA[((n % 5) + 5) % 5]);
const panX = x => Math.max(-.75, Math.min(.75, (x / (innerWidth || 1)) * 2 - 1));
const panC = (x, W) => Math.max(-.7, Math.min(.7, (x / W * 2 - 1) * .7));
const rnd = (a, b) => a + Math.random() * (b - a);
function aGate(k, ms){ const n = performance.now(); if(AUD.last[k] && n - AUD.last[k] < ms) return false; AUD.last[k] = n; return true; }
function aOut(o){
  const ac = AUD.ac, g = ac.createGain(); let tail = g;
  if(o.pan && ac.createStereoPanner){ const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); tail.connect(p); tail = p; }
  tail.connect(AUD.bus[o.bus || 'sfx']);
  if(o.rev){ const s = ac.createGain(); s.gain.value = o.rev; tail.connect(s); s.connect(AUD.rev); }
  return g;
}
function aEnv(g, t0, a, d, v, hold){
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(.0002, v), t0 + a);
  if(hold) g.gain.setValueAtTime(Math.max(.0002, v), t0 + a + hold);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + a + (hold || 0) + d);
}
const AUD_MAXV = 44;
/* 톤: f 시작 음높이, f2 끝 음높이(미끄러짐), type 파형, a 올라오는 시간, d 사라지는 시간, v 크기, lp 저역 필터, det 음 흔들림 */
function aTone(o){
  const ac = AUD.ac; if(!ac || AUD.live > AUD_MAXV) return;
  const t0 = ac.currentTime + (o.t || 0), a = o.a || .005, d = o.d || .2, h = o.hold || 0;
  const osc = ac.createOscillator(), env = ac.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t0);
  if(o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + (o.slide || a + h + d));
  if(o.det) osc.detune.value = o.det;
  let node = osc;
  if(o.lp){ const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t0); if(o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t0 + a + h + d); f.Q.value = o.q || .8; node.connect(f); node = f; }
  node.connect(env); env.connect(aOut(o));
  aEnv(env, t0, a, d, o.v || .2, h);
  osc.start(t0); osc.stop(t0 + a + h + d + .05);
  AUD.live++; osc.onended = () => { AUD.live = Math.max(0, AUD.live - 1); try{ env.disconnect(); }catch(_){} };
}
/* 종·유리 소리(FM 합성): ratio 배음 비율, idx 반짝임 세기 */
function aBell(o){
  const ac = AUD.ac; if(!ac || AUD.live > AUD_MAXV) return;
  const t0 = ac.currentTime + (o.t || 0), d = o.d || .8;
  const c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), env = ac.createGain();
  c.frequency.value = o.f; m.frequency.value = o.f * (o.ratio || 3.5);
  mg.gain.setValueAtTime(o.f * (o.idx || 2), t0); mg.gain.exponentialRampToValueAtTime(Math.max(1, o.f * .04), t0 + d * .7);
  m.connect(mg); mg.connect(c.frequency); c.connect(env); env.connect(aOut(o));
  aEnv(env, t0, o.a || .003, d, o.v || .12);
  c.start(t0); m.start(t0); c.stop(t0 + d + .1); m.stop(t0 + d + .1);
  AUD.live++; c.onended = () => { AUD.live = Math.max(0, AUD.live - 1); try{ env.disconnect(); }catch(_){} };
}
/* 소음: ft 필터 종류(lowpass·highpass·bandpass), f→f2 필터 움직임 */
function aNoise(o){
  const ac = AUD.ac; if(!ac || AUD.live > AUD_MAXV || !AUD.nb) return;
  const t0 = ac.currentTime + (o.t || 0), a = o.a || .004, d = o.d || .2, h = o.hold || 0;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), env = ac.createGain();
  s.buffer = AUD.nb; s.loop = true; s.playbackRate.value = o.rate || 1;
  f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.f || 1200, t0); if(o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2), t0 + a + h + d); f.Q.value = o.q || .8;
  s.connect(f); f.connect(env); env.connect(aOut(o));
  aEnv(env, t0, a, d, o.v || .2, h);
  s.start(t0, Math.random() * 1.8); s.stop(t0 + a + h + d + .05);
  AUD.live++; s.onended = () => { AUD.live = Math.max(0, AUD.live - 1); try{ env.disconnect(); }catch(_){} };
}
/* 악기 */
const aPluck = (f, o = {}) => { aTone({ ...o, f, type:'triangle', d:o.d || .35, v:o.v || .15, rev:o.rev ?? .15 }); aTone({ ...o, f:f * 2, type:'sine', d:(o.d || .35) * .45, v:(o.v || .15) * .3, rev:0 }); };
const aMarimba = (f, o = {}) => { aTone({ ...o, f, type:'sine', d:o.d || .5, v:o.v || .2, rev:o.rev ?? .18 }); aTone({ ...o, f:f * 3.98, type:'sine', d:.07, v:(o.v || .2) * .45, rev:0 }); aNoise({ ...o, f:Math.min(8000, f * 3), ft:'bandpass', q:5, d:.025, v:(o.v || .2) * .35, rev:0 }); };
const aBrass = (f, o = {}) => { aTone({ ...o, f, type:'sawtooth', a:o.a || .035, lp:o.lp || 1600, lp2:(o.lp || 1600) * .6, d:o.d || .35, v:o.v || .06, rev:o.rev ?? .3 }); aTone({ ...o, f, type:'sawtooth', det:9, a:o.a || .035, lp:o.lp || 1400, d:o.d || .35, v:(o.v || .06) * .7, rev:0 }); };
const aThump = (o = {}) => { aTone({ ...o, f:o.f || 140, f2:o.f2 || 45, d:o.d || .25, v:o.v || .3, rev:o.rev || 0 }); };
const aCoin = (o = {}) => { aTone({ ...o, f:m2f(83), type:'square', lp:3500, d:.06, v:(o.v || .06) }); aTone({ ...o, f:m2f(88), type:'square', lp:3500, t:(o.t || 0) + .065, d:.25, v:(o.v || .06), rev:.2 }); };
const aSparkle = (o = {}) => { const n = o.n || 6, base = o.root || 84, st = [0, 7, 12, 16, 19, 24, 28, 31]; for(let k = 0; k < n; k++) aBell({ ...o, f:m2f(base + st[k % st.length]), t:(o.t || 0) + k * (o.gap || .045), d:o.d || .55, v:o.v || .05, idx:1.4, rev:.4 }); aNoise({ ...o, ft:'highpass', f:6000, d:.35, v:(o.v || .05) * .6 }); };
const aWhoosh = (o = {}) => aNoise({ ...o, ft:'bandpass', f:o.f || 400, f2:o.f2 || 3000, q:o.q || 1, a:o.a || .08, d:o.d || .3, v:o.v || .06 });

/* 공용 버튼 아이콘(뒤로·도움말·소리 켜짐/꺼짐 등) */
const UI_ICON = {
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.3"/><circle cx="12" cy="17.8" r=".9" fill="currentColor"/></svg>',
  snd:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  mute:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".6"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  target:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>',
  shuf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.5c2 0 3 1 4.3 3l2.4 4c1.3 2 2.3 3 4.3 3H21M3 17h3.5c2 0 3-1 4.3-3M13.2 10c1.3-2 2.3-3 4.3-3H21M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
  radar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5" opacity=".6"/><path d="M12 12 18.4 5.6"/><circle cx="15.6" cy="9.2" r="1.6" fill="currentColor" stroke="none"/></svg>'
};
/* ===== 소리 목록(이름 → 소리): 모든 게임이 함께 쓰는 소리 라이브러리 ===== */
const SFX_GATE = { tap:40, pop:40, tab:60, open:120, toast:350, tick:35, bAim:28, bShot:42, bHit:24, bBreak:36, bLand:300, bRing:40, bSlide:200,
  tArrow:65, tMagic:80, tCannon:110, tBoom:80, tDie:55, tGold:90, tHit:130, fPaint:32, sSel:30, error:200, heartSend:100 };
const WIN_JINGLE = {
  fox(){ [0, 2, 4, 5, 7, 9, 10].forEach((d, i) => aMarimba(penta(d, 67), { t:i * .07, v:.17 })); [72, 76, 79, 84].forEach(m => aMarimba(m2f(m), { t:.56, d:1, v:.12 })); aSparkle({ t:.6, n:5 }); },
  sudoku(){ [60, 64, 67, 71, 72, 76, 79, 83, 84].forEach((m, i) => { aPluck(m2f(m + 12), { t:i * .055, d:.8, v:.1, rev:.35 }); }); [72, 76, 79, 84, 88].forEach(m => aBell({ f:m2f(m + 12), t:.55, d:1.6, v:.045, idx:1.2, rev:.5 })); },
  ball(){ [79, 84, 88, 91, 96, 100].forEach((m, i) => aBell({ f:m2f(m), ratio:2.76, idx:1.1, t:i * .07, d:.9, v:.05, rev:.45, pan:Math.sin(i * 1.3) * .5 })); [60, 67, 72, 76].forEach(m => aTone({ f:m2f(m), type:'triangle', lp:1800, a:.06, hold:.25, d:1.1, v:.04, t:.45, rev:.45 })); aMarimba(m2f(84), { t:.5, d:1, v:.12 }); aSparkle({ t:.62, n:6, v:.04 }); },
  tower(){ const q = [[67, 0], [67, .13], [67, .26], [72, .4]]; q.forEach(([m, t]) => aBrass(m2f(m), { t, d:.14, v:.07 })); [72, 76, 79, 84].forEach(m => aBrass(m2f(m), { t:.55, hold:.45, d:.8, v:.05 })); aThump({ f:110, f2:70, t:.4, d:.45, v:.28 }); aThump({ f:110, f2:70, t:.55, d:.9, v:.32 }); aSparkle({ t:.7, n:5 }); },
  fleet(){ aTone({ f:98, type:'sawtooth', lp:600, a:.1, hold:.35, d:.5, v:.12, rev:.5 }); aTone({ f:147, type:'sawtooth', lp:600, a:.1, hold:.35, d:.5, v:.07, rev:.5 }); [[67, .7], [72, .82], [76, .94], [79, 1.06]].forEach(([m, t]) => aBrass(m2f(m), { t, d:.16, v:.06 })); [72, 76, 79, 84].forEach(m => aBrass(m2f(m), { t:1.2, hold:.4, d:.8, v:.045 })); aThump({ f:100, f2:60, t:1.2, d:.8, v:.3 }); }
};
const SFX_LIB = {
  /* --- UI --- */
  tap(){ aTone({ f:1900, f2:1300, d:.035, v:.06, bus:'ui' }); aNoise({ ft:'highpass', f:4500, d:.012, v:.03, bus:'ui' }); },
  pop(){ aTone({ f:480, f2:900, a:.004, d:.085, v:.14, bus:'ui' }); aTone({ f:1400, type:'triangle', t:.028, d:.06, v:.04, bus:'ui' }); },
  tab(){ aWhoosh({ f:1500, f2:3800, q:1.6, a:.02, d:.1, v:.05, bus:'ui' }); aTone({ f:700, f2:1050, d:.07, v:.07, bus:'ui' }); },
  open(){ aTone({ f:360, f2:760, d:.13, v:.1, bus:'ui' }); aWhoosh({ f:700, f2:2600, a:.02, d:.14, v:.04, bus:'ui' }); },
  toast(){ aBell({ f:1568, d:.35, v:.05, idx:1.1, bus:'ui', rev:.2 }); },
  toggle(o){ const on = o.on !== false; aTone({ f:on ? 880 : 1320, d:.05, v:.08, bus:'ui' }); aTone({ f:on ? 1320 : 880, t:.06, d:.09, v:.08, bus:'ui' }); },
  error(){ aTone({ f:220, f2:185, type:'square', lp:900, d:.13, v:.06, bus:'ui' }); aTone({ f:165, type:'square', lp:700, t:.09, d:.16, v:.055, bus:'ui' }); },
  heartUse(){ aTone({ f:990, f2:500, d:.16, v:.1 }); aNoise({ ft:'bandpass', f:2200, q:2, d:.05, v:.04 }); },
  heartGet(){ [0, 4, 7, 12].forEach((s, i) => aBell({ f:m2f(79 + s), t:i * .06, d:.55, v:.07, idx:1.5, rev:.35 })); aTone({ f:520, f2:1040, d:.2, v:.06 }); },
  heartSend(){ aTone({ f:660, f2:1320, d:.16, v:.08 }); aBell({ f:1760, t:.08, d:.4, v:.05, rev:.3 }); },
  coin(o){ aCoin(o); },
  start(){ aWhoosh({ f:300, f2:3200, a:.05, d:.32, v:.06 }); [0, 4, 7, 12].forEach((s, i) => aPluck(m2f(67 + s), { t:.06 + i * .045, v:.08, d:.3 })); },
  tick(o){ aTone({ f:1100 + (o.p || 0) * 1300, type:'square', lp:4200, d:.022, v:.028, bus:'ui' }); },
  ding(){ aBell({ f:m2f(88), d:.9, v:.1, rev:.35 }); aBell({ f:m2f(95), t:.02, d:1.1, v:.05, rev:.35 }); aThump({ f:160, f2:80, d:.15, v:.12 }); },
  star(o){ const m = [76, 79, 84][Math.max(0, Math.min(2, (o.i || 1) - 1))]; aBell({ f:m2f(m), d:1, v:.13, rev:.4 }); aBell({ f:m2f(m + 12), d:.6, v:.045, idx:1.2 }); aNoise({ ft:'highpass', f:6500, d:.28, v:.045 }); aThump({ f:180, f2:90, d:.12, v:.12 }); },
  starOff(){ aTone({ f:300, f2:210, d:.12, v:.05 }); },
  newRecord(){ aSparkle({ root:84, n:7, gap:.05, v:.06 }); aTone({ f:520, f2:1560, d:.4, v:.04, type:'triangle' }); },
  result(){ [60, 64, 67, 71, 74].forEach((m, i) => aPluck(m2f(m + 12), { t:i * .035, d:1, v:.07, rev:.35 })); aNoise({ ft:'bandpass', f:6000, q:.8, d:.45, v:.025 }); },
  xp(){ aTone({ f:500, f2:1300, type:'triangle', d:.6, v:.035 }); },
  lose(){ [67, 63, 60, 55].forEach((m, i) => aTone({ f:m2f(m), type:'triangle', t:i * .17, d:.4, v:.08, lp:2200, rev:.3 })); aTone({ f:m2f(43), t:.68, d:.9, v:.1, rev:.2 }); },
  fanfare(){ WIN_JINGLE.tower(); },   /* 축하 팡파르(숲 지킴이 승리 음악과 같은 소리) */
  demote(){ [64, 62, 60].forEach((m, i) => aPluck(m2f(m), { t:i * .2, d:.6, v:.08, rev:.35 })); aBell({ f:m2f(67), t:.7, d:1.2, v:.05, rev:.4 }); },
  win(o){ (WIN_JINGLE[o.g] || SFX_LIB.result)(); },

  /* --- 여우 --- */
  fX(){ aTone({ f:rnd(500, 560), type:'triangle', d:.04, v:.06 }); aNoise({ ft:'highpass', f:3200, d:.018, v:.028 }); },
  fPaint(){ aTone({ f:rnd(600, 720), type:'triangle', d:.028, v:.035 }); },
  fErase(){ aNoise({ ft:'bandpass', f:2600, f2:1200, q:1.5, d:.06, v:.035 }); },
  fOk(o){ const n = o.n || 0; aMarimba(penta(n + 2, 72), { v:.2, pan:o.pan }); aMarimba(penta(n + 4, 72), { t:.06, v:.15, pan:o.pan }); aThump({ f:150, f2:70, d:.1, v:.12 }); aNoise({ ft:'highpass', f:6000, t:.03, d:.2, v:.035 }); if(n >= 2) aBell({ f:penta(n + 7, 72), t:.1, d:.6, v:.05, rev:.4, pan:o.pan }); },
  fBad(){ aThump({ f:160, f2:55, d:.28, v:.3 }); aTone({ f:220, f2:150, type:'sawtooth', lp:1100, d:.24, v:.06 }); aTone({ f:233, f2:156, type:'sawtooth', lp:1100, d:.24, v:.05 }); aNoise({ ft:'lowpass', f:700, d:.16, v:.12 }); },
  fHint(o){ aSparkle({ root:84, n:6, pan:o.pan }); aTone({ f:700, f2:1400, d:.3, v:.04, type:'triangle' }); },
  fAuto(){ aWhoosh({ f:700, f2:5200, q:2, a:.03, d:.34, v:.06 }); for(let k = 0; k < 6; k++) aTone({ f:rnd(560, 760), type:'triangle', t:k * .035, d:.03, v:.03 }); },
  fUndo(){ aTone({ f:950, f2:480, type:'triangle', d:.09, v:.06 }); },
  fLand(){ aTone({ f:1480, d:.05, v:.045 }); aTone({ f:2220, t:.03, d:.05, v:.025 }); },
  fStamp(){ aThump({ f:130, f2:45, d:.28, v:.38 }); aNoise({ ft:'lowpass', f:1800, d:.14, v:.16 }); },

  /* --- 스도쿠 --- */
  sSel(){ aTone({ f:1500, d:.02, v:.022, bus:'ui' }); },
  sNum(o){ const f = m2f([60, 62, 64, 65, 67, 69, 71, 72, 74][(o.v || 1) - 1] + 12); aPluck(f, { v:.13, d:.5, pan:o.pan, rev:.25 }); aBell({ f:f * 2, d:.4, v:.025, idx:.8, pan:o.pan }); if((o.n || 0) >= 3) aBell({ f:penta(o.n + 4, 84), t:.07, d:.5, v:.035, rev:.4 }); },
  sNote(o){ aNoise({ ft:'bandpass', f:o.on ? 3600 : 2400, q:3, d:.045, v:.045 }); aTone({ f:o.on ? 1800 : 1200, d:.02, v:.015 }); },
  sErase(){ aNoise({ ft:'bandpass', f:2400, f2:900, q:1.2, d:.09, v:.045 }); },
  sUndo(){ aTone({ f:900, f2:450, type:'triangle', d:.09, v:.06 }); },
  sLine(o){ const k = o.k || 1, notes = [72, 76, 79, 84, 88, 91, 96]; for(let i = 0; i < 3 + k * 2 && i < notes.length; i++) aBell({ f:m2f(notes[i]), t:.08 + i * .05, d:.8, v:.07, idx:1.3, rev:.45 }); aWhoosh({ f:900, f2:4000, a:.05, d:.3, v:.04 }); },
  sDigit(){ aSparkle({ root:91, n:4, gap:.04, v:.045 }); },
  sBad(){ SFX_LIB.fBad(); },

  /* --- 별빛 구슬 --- */
  bAim(){ aTone({ f:1900, type:'triangle', d:.014, v:.018 }); },
  bFire(){ aWhoosh({ f:500, f2:2600, q:1.2, a:.01, d:.16, v:.05 }); aTone({ f:220, f2:520, type:'triangle', d:.1, v:.07 }); },
  bShot(o){ aTone({ f:rnd(1150, 1260), f2:1750, d:.03, v:.02, pan:o.pan }); },
  bHit(o){ const f = penta(Math.min(22, Math.floor((o.n || 0) / 4)), 67); aTone({ f, type:'triangle', d:.055, v:.045, pan:o.pan }); aTone({ f:f * 2, d:.03, v:.018, pan:o.pan }); },
  bBreak(o){ const f = penta(Math.min(20, 5 + Math.floor((o.n || 0) / 6)), 72); aBell({ f, ratio:2.76, idx:3, d:.35, v:.07, pan:o.pan, rev:.25 }); aNoise({ ft:'highpass', f:3600, d:.1, v:.05, pan:o.pan }); aThump({ f:190, f2:80, d:.07, v:.07, pan:o.pan }); },
  bRing(o){ aBell({ f:m2f(88), d:.4, v:.08, idx:1.5, rev:.3, pan:o.pan }); aBell({ f:m2f(95), t:.05, d:.5, v:.06, rev:.3, pan:o.pan }); },
  bLand(o){ aTone({ f:320, f2:170, d:.06, v:.05, pan:o.pan }); aNoise({ ft:'lowpass', f:900, d:.04, v:.03, pan:o.pan }); },
  bSlide(){ aThump({ f:130, f2:80, d:.14, v:.1 }); aNoise({ ft:'lowpass', f:500, d:.1, v:.05 }); },
  bDanger(){ aTone({ f:880, type:'square', lp:2200, d:.07, v:.045 }); aTone({ f:660, type:'square', lp:2200, t:.12, d:.09, v:.045 }); },
  bAlarm(){ for(let k = 0; k < 3; k++){ aTone({ f:880, type:'square', lp:2400, t:k * .22, d:.08, v:.06 }); aTone({ f:587, type:'square', lp:2400, t:k * .22 + .1, d:.09, v:.06 }); } aThump({ f:90, f2:40, d:.5, v:.3 }); },
  bFast(){ aWhoosh({ f:400, f2:3200, q:1.5, a:.04, d:.32, v:.06 }); aTone({ f:400, f2:1300, d:.28, v:.04, type:'triangle' }); },
  chain(o){ const n = Math.min(8, o.n || 3); for(let k = 0; k < n; k++) aBell({ f:penta(5 + k, 72), t:k * .045, d:.4, v:.05, rev:.35 }); },

  /* --- 숲 지킴이 --- */
  tSel(){ aTone({ f:430, type:'triangle', d:.05, v:.07 }); aNoise({ ft:'bandpass', f:1600, q:3, d:.03, v:.04 }); },
  tBuild(o){ [0, .17, .34].forEach(t => { aNoise({ ft:'bandpass', f:rnd(800, 1100), q:2, t, d:.06, v:.1, pan:o.pan }); aThump({ f:190, f2:110, t, d:.07, v:.1, pan:o.pan }); }); },
  tBuilt(o){ aBell({ f:m2f(84), d:.6, v:.07, rev:.3, pan:o.pan }); aBell({ f:m2f(91), t:.08, d:.7, v:.055, rev:.3, pan:o.pan }); },
  tUp(o){ aWhoosh({ f:600, f2:4000, a:.05, d:.4, v:.05 }); aSparkle({ root:79, n:6, gap:.05, pan:o.pan }); },
  tSell(o){ for(let k = 0; k < 4; k++) aCoin({ t:k * .07, v:.045, pan:o.pan }); },
  tArrow(o){ aTone({ f:rnd(500, 560), f2:250, type:'triangle', d:.1, v:.045, pan:o.pan }); aNoise({ ft:'bandpass', f:3200, f2:1500, q:2, d:.07, v:.028, pan:o.pan }); },
  tMagic(o){ aTone({ f:1300, f2:2500, d:.16, v:.045, pan:o.pan, rev:.3 }); aBell({ f:2093, d:.25, v:.025, pan:o.pan }); },
  tCannon(o){ aThump({ f:150, f2:50, d:.28, v:.18, pan:o.pan }); aNoise({ ft:'lowpass', f:1600, f2:300, d:.22, v:.15, pan:o.pan }); },
  tBoom(o){ aNoise({ ft:'lowpass', f:2000, f2:150, d:.45, v:.22, pan:o.pan, rev:.2 }); aThump({ f:95, f2:35, d:.4, v:.22, pan:o.pan }); },
  tMeteorFall(){ aWhoosh({ f:250, f2:2600, q:1, a:.3, d:.4, v:.1 }); },
  tMeteor(o){ aThump({ f:100, f2:28, d:.9, v:.45, pan:o.pan }); aNoise({ ft:'lowpass', f:3000, f2:120, d:1.1, v:.4, pan:o.pan, rev:.45 }); aNoise({ ft:'highpass', f:3000, d:.1, v:.12 }); },
  tDie(o){ aNoise({ ft:'bandpass', f:1000, f2:300, q:1, d:.14, v:.07, pan:o.pan }); aTone({ f:rnd(280, 360), f2:120, type:'triangle', d:.12, v:.045, pan:o.pan }); },
  tGold(o){ aCoin({ v:.03, pan:o.pan }); },
  tHit(o){ aNoise({ ft:'bandpass', f:3400, q:6, d:.045, v:.035, pan:o.pan }); aTone({ f:1900, f2:1600, type:'square', lp:4200, d:.035, v:.012, pan:o.pan }); },
  tLeak(){ aTone({ f:110, f2:70, type:'sawtooth', lp:600, d:.5, v:.14 }); aNoise({ ft:'lowpass', f:800, d:.3, v:.14 }); aTone({ f:440, type:'square', lp:1500, t:.1, d:.14, v:.045 }); aTone({ f:349, type:'square', lp:1500, t:.27, d:.2, v:.045 }); },
  tHorn(){ aTone({ f:110, type:'sawtooth', lp:700, a:.09, hold:.35, d:.45, v:.11, rev:.45 }); aTone({ f:165, type:'sawtooth', lp:700, a:.12, hold:.3, d:.45, v:.06, rev:.45 }); aThump({ f:90, f2:55, t:.05, d:.35, v:.2 }); aThump({ f:90, f2:55, t:.3, d:.35, v:.2 }); },
  tBoss(){ [0, .24, .48, .6].forEach(t => aThump({ f:85, f2:42, t, d:.3, v:.3 })); aNoise({ ft:'lowpass', f:420, a:.25, d:1.1, v:.28, t:.3, rev:.4 }); aTone({ f:55, f2:44, type:'sawtooth', lp:320, a:.25, d:1.1, v:.18, t:.3 }); },
  tHero(){ aTone({ f:520, f2:800, d:.09, v:.07 }); aTone({ f:800, t:.07, d:.1, v:.05 }); },
  tRally(){ aBrass(m2f(67), { d:.12, v:.06 }); aBrass(m2f(72), { t:.12, d:.25, v:.06 }); },
  tReady(){ aBell({ f:m2f(86), d:.5, v:.05, rev:.3 }); },

  /* --- 함대 결전 --- */
  flFire(o){ aThump({ f:160, f2:45, d:.34, v:.34, pan:o.pan }); aNoise({ ft:'lowpass', f:3200, f2:280, d:.3, v:.28, pan:o.pan, rev:.3 }); aNoise({ ft:'highpass', f:2600, d:.05, v:.09, pan:o.pan }); aTone({ f:1800, f2:800, t:.1, d:.35, v:.015, pan:o.pan }); },
  flSplash(o){ aNoise({ ft:'bandpass', f:1500, f2:450, q:.7, d:.6, v:.2, pan:o.pan, rev:.25 }); aNoise({ ft:'highpass', f:3600, t:.05, d:.4, v:.05, pan:o.pan }); aTone({ f:560, f2:200, d:.12, v:.045, pan:o.pan }); },
  flBoom(o){ aThump({ f:115, f2:32, d:.7, v:.42, pan:o.pan }); aNoise({ ft:'lowpass', f:2800, f2:150, d:.9, v:.36, pan:o.pan, rev:.35 }); aNoise({ ft:'highpass', f:3000, d:.08, v:.13, pan:o.pan }); aNoise({ ft:'highpass', f:2500, t:.16, d:.05, v:.05, pan:o.pan }); },
  flSink(o){ SFX_LIB.flBoom(o); aTone({ f:92, f2:40, type:'sawtooth', lp:380, t:.3, d:1.4, v:.1, rev:.4 }); for(let k = 0; k < 7; k++) aTone({ f:rnd(300, 700), f2:rnd(800, 1200), t:.6 + k * .12, d:.06, v:.02 }); [392, 330, 262].forEach((f, k) => aTone({ f, type:'triangle', t:.45 + k * .16, d:.34, v:.055, rev:.3 })); },
  flPing(){ aBell({ f:1180, ratio:1, idx:.25, d:1.2, v:.09, rev:.6 }); aBell({ f:1180, ratio:1, idx:.2, t:.32, d:1, v:.03, rev:.6 }); },
  flAim(o){ aTone({ f:1500, type:'square', lp:4200, d:.022, v:.018, pan:o.pan }); },
  flLock(){ aTone({ f:900, type:'square', lp:3000, d:.05, v:.03 }); aTone({ f:1350, type:'square', lp:3000, t:.07, d:.07, v:.03 }); },
  flBad(){ aTone({ f:260, f2:140, type:'sawtooth', lp:1200, d:.2, v:.05 }); },
  flHorn(){ aTone({ f:98, type:'sawtooth', lp:520, a:.1, hold:.45, d:.5, v:.13, rev:.5 }); aTone({ f:147, type:'sawtooth', lp:520, a:.12, hold:.4, d:.5, v:.07, rev:.5 }); aThump({ f:80, f2:45, t:.1, d:.5, v:.2 }); }
};
/* 소리 내기: sfx('이름', { pan:좌우 -1~1, n:연속 횟수, ... }) */
function sfx(name, o = {}){
  const f = SFX_LIB[name]; if(!f || !SND.on || AUD.set.sfx <= 0) return;
  const g = SFX_GATE[name]; if(g && !aGate(name, g)) return;
  const ac = audReady(); if(!ac) return;
  try{ f(o); }catch(_){}
}
/* 예전 호출(여우) 호환 */
function fxSound(kind, level){
  if(kind === 'ok') sfx('fOk', { n:level || 0 });
  else if(kind === 'bad') sfx('fBad');
  else if(kind === 'x') sfx('fX');
  else if(kind === 'hint') sfx('fHint');
  else if(kind === 'win') sfx('win', { g:(typeof G !== 'undefined' && G) ? G.id : '' });
}
function fxBuzz(p){ if(!AUD.set.hap) return; if(navigator.vibrate) try{ navigator.vibrate(p); }catch(_){} }

/* ===== 배경 소리(게임별 분위기): 함대 = 바다 물결, 디펜스 = 숲 바람과 새, 구슬 = 별밤 ===== */
function ambFor(id){ return (NG[id] && NG[id].amb) || null; }   /* 게임 정의의 amb: 'sea' | 'forest' | 'stars' */
function ambStart(kind){
  if(AUD.ambKind === kind && AUD.amb) return;
  ambStop();
  if(!kind || !SND.on) return;
  const ac = audReady(); if(!ac) return;
  const out = ac.createGain(); out.gain.value = .0001; out.connect(AUD.bus.amb);
  out.gain.setTargetAtTime(1, ac.currentTime + .05, .9);
  const A = { out, nodes:[], timers:[], kind, stopped:false };
  const noise = (ft, f, q) => { const s = ac.createBufferSource(); s.buffer = AUD.nb; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = ft; fl.frequency.value = f; fl.Q.value = q || .7; s.connect(fl); s.start(0, Math.random() * 1.8); A.nodes.push(s); return fl; };
  const lfo = (param, rate, depth, base) => { param.value = base; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); A.nodes.push(o); };
  const gainTo = (node, v) => { const g = ac.createGain(); g.gain.value = v; node.connect(g); g.connect(out); return g; };
  if(kind === 'sea'){
    const swell = gainTo(noise('lowpass', 380), .07); lfo(swell.gain, .085, .045, .07);
    const foam = gainTo(noise('bandpass', 1500, .6), .015); lfo(foam.gain, .12, .012, .015);
    const low = ac.createOscillator(), lg = ac.createGain(); low.frequency.value = 46; lg.gain.value = .012; low.connect(lg); lg.connect(out); low.start(); A.nodes.push(low);
    const buoy = () => { if(A.stopped) return; aBell({ f:m2f(rnd(0, 1) < .5 ? 74 : 69), ratio:2.4, idx:.8, d:2.2, v:.018, rev:.7, bus:'amb', pan:rnd(-.6, .6) }); A.timers.push(setTimeout(buoy, rnd(7000, 13000))); };
    A.timers.push(setTimeout(buoy, 3000));
  } else if(kind === 'forest'){
    const wind = gainTo(noise('lowpass', 650), .03); lfo(wind.gain, .06, .02, .03);
    const leaves = gainTo(noise('bandpass', 2600, .8), .006); lfo(leaves.gain, .17, .005, .006);
    const bird = () => {
      if(A.stopped) return;
      const pan = rnd(-.8, .8), base = rnd(2400, 3600), n = 2 + Math.floor(rnd(0, 4));
      for(let k = 0; k < n; k++) aTone({ f:base * rnd(.9, 1.1), f2:base * rnd(1.2, 1.5), t:k * rnd(.08, .13), d:.06, v:.012, bus:'amb', pan, rev:.3 });
      A.timers.push(setTimeout(bird, rnd(2500, 7000)));
    };
    A.timers.push(setTimeout(bird, 1200));
  } else if(kind === 'stars'){
    const flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = .6; lfo(flt.frequency, .04, 160, 520);
    const g = ac.createGain(); g.gain.value = .012; flt.connect(g); g.connect(out); lfo(g.gain, .07, .004, .012);
    for(const [f, det] of [[130.81, 0], [196, 4], [261.63, -5], [329.63, 3]]){ const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det; o.connect(flt); o.start(); A.nodes.push(o); }
    const air = gainTo(noise('bandpass', 3200, .5), .003); lfo(air.gain, .11, .002, .003);
    const twinkle = () => { if(A.stopped) return; aBell({ f:m2f([84, 88, 91, 96, 100][Math.floor(rnd(0, 5))]), ratio:2.76, idx:.7, d:1.6, v:.014, rev:.7, bus:'amb', pan:rnd(-.7, .7) }); A.timers.push(setTimeout(twinkle, rnd(2500, 6500))); };
    A.timers.push(setTimeout(twinkle, 1500));
  }
  AUD.amb = A; AUD.ambKind = kind;
}
function ambStop(){
  const A = AUD.amb; AUD.amb = null; AUD.ambKind = null;
  if(!A || !AUD.ac) return;
  A.stopped = true; A.timers.forEach(clearTimeout);
  const t = AUD.ac.currentTime; try{ A.out.gain.cancelScheduledValues(t); A.out.gain.setTargetAtTime(.0001, t, .3); }catch(_){}
  setTimeout(() => { A.nodes.forEach(n => { try{ n.stop(); }catch(_){} }); try{ A.out.disconnect(); }catch(_){} }, 1600);
}
function ambDuck(on){ const A = AUD.amb; if(!A || !AUD.ac) return; A.out.gain.setTargetAtTime(on ? .25 : 1, AUD.ac.currentTime, .3); }

/* ===== 모든 버튼에 누르는 소리(게임 안 전용 소리가 있는 버튼은 제외) ===== */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button, summary, .stile');
  if(!b || b.disabled) return;
  if(b.closest('#pad, .fl-sea, .fx-board, .tools, .fx-tool, .bfoot, #bFast, .fl-fire, .snd-row, .sset')) return;
  if(b.matches('#fxSnd, #flSnd, #mSnd, #pSnd, .fl-rb#flSnd')) return;
  if(b.closest('#dock') || b.closest('.tabs')) sfx('tab');
  else if(b.matches('.b1, .cta, .gr-go, .btn.primary, .btn.gold, .fl-go, .opt, .st, .stile')) sfx('pop');
  else sfx('tap');
}, true);

/* ===== 소리·진동 설정 창 ===== */
function openSoundSheet(back){
  const s = AUD.set, pc = v => Math.round(v * 100);
  openModal(`<h3>소리 · 진동</h3>
    <div class="sset">
      <div class="srow2"><span><b>전체 소리</b><small>끄면 모든 효과음과 배경 소리가 꺼져요</small></span><button class="sw${SND.on ? ' on' : ''}" id="ssOn" role="switch" aria-checked="${SND.on}" aria-label="전체 소리"><i></i></button></div>
      <label class="srow2 col"><span><b>효과음</b><small>맞힘·깨짐·폭발·버튼 소리</small></span><span class="rg"><input type="range" min="0" max="100" value="${pc(s.sfx)}" id="ssSfx" aria-label="효과음 크기"><em id="ssSfxV">${pc(s.sfx)}</em></span></label>
      <label class="srow2 col"><span><b>배경 소리</b><small>함대 = 바다, 디펜스 = 숲, 구슬 = 별밤 분위기</small></span><span class="rg"><input type="range" min="0" max="100" value="${pc(s.amb)}" id="ssAmb" aria-label="배경 소리 크기"><em id="ssAmbV">${pc(s.amb)}</em></span></label>
      <div class="srow2"><span><b>진동</b><small>맞힘·틀림·폭발 때 짧게 떨려요(안드로이드)</small></span><button class="sw${s.hap ? ' on' : ''}" id="ssHap" role="switch" aria-checked="${s.hap}" aria-label="진동"><i></i></button></div>
    </div>
    <div class="snd-row"><button class="sdemo" data-d="fOk">맞힘</button><button class="sdemo" data-d="bBreak">깨짐</button><button class="sdemo" data-d="flBoom">폭발</button><button class="sdemo" data-d="fanfare">축하</button></div>
    <div class="mbtns one"><button class="b1" id="ssOk">${back ? '돌아가기' : '닫기'}</button></div>`);
  const upd = () => { $('#ssOn').classList.toggle('on', SND.on); $('#ssOn').setAttribute('aria-checked', SND.on); $('#ssHap').classList.toggle('on', AUD.set.hap); $('#ssHap').setAttribute('aria-checked', AUD.set.hap); };
  $('#ssOn').onclick = () => { sndSetOn(!SND.on); upd(); if(SND.on) sfx('toggle', { on:true }); };
  $('#ssHap').onclick = () => { AUD.set.hap = !AUD.set.hap; audSave(); upd(); sfx('toggle', { on:AUD.set.hap }); if(AUD.set.hap) fxBuzz(30); };
  const slide = (id, key, demo) => { const r = $(id); r.oninput = () => { AUD.set[key] = r.value / 100; $(id + 'V').textContent = r.value; audVol(); }; r.onchange = () => { audSave(); if(!SND.on) sndSetOn(true), upd(); demo(); }; };
  slide('#ssSfx', 'sfx', () => sfx('fOk', { n:2 }));
  slide('#ssAmb', 'amb', () => { if(!AUD.amb){ ambStart('sea'); setTimeout(() => { if(!(typeof G !== 'undefined' && G && !G.over && document.body.dataset.mode)) ambStop(); }, 2600); } });
  document.querySelectorAll('.sdemo').forEach(b => b.onclick = () => { if(!SND.on){ sndSetOn(true); upd(); } const d = b.dataset.d; sfx(d, d === 'fOk' ? { n:3 } : d === 'bBreak' ? { n:20 } : {}); if(d === 'fanfare' && typeof fxConfetti === 'function') fxConfetti(); });
  $('#ssOk').onclick = () => { if(typeof back === 'function') back(); else closeModal(); };
}
/* 일시정지 창 안의 소리 켜기/끄기 버튼 */
function sndBtnHtml(){ return `<button class="psnd" id="mSnd">${SND.on ? UI_ICON.snd : UI_ICON.mute}<span>${SND.on ? '소리 켜짐 · 누르면 끄기' : '소리 꺼짐 · 누르면 켜기'}</span></button>`; }
function sndBtnBind(){ const b = $('#mSnd'); if(!b) return; b.onclick = () => { sndSetOn(!SND.on); ambDuck(true); b.outerHTML = sndBtnHtml(); sndBtnBind(); if(SND.on) sfx('toggle', { on:true }); }; }
function fxBubble(el, text){
  const p = fxCenter(el), d = document.createElement('div'); d.className = 'fxbubble'; d.textContent = text;
  document.body.appendChild(d);
  const w = d.offsetWidth, x = Math.max(8, Math.min(innerWidth - w - 8, p.x - w / 2)), above = p.y - p.h / 2 - 12 > 90;
  d.style.left = x + 'px'; d.style.top = (above ? p.y - p.h / 2 - d.offsetHeight - 10 : p.y + p.h / 2 + 10) + 'px';
  d.style.setProperty('--ax', (p.x - x) + 'px'); d.classList.add(above ? 'up' : 'down');
  setTimeout(() => d.classList.add('out'), 1500); setTimeout(() => d.remove(), 1900);
}
function fxVignette(){ const v = document.createElement('div'); v.className = 'fxvig'; document.body.appendChild(v); setTimeout(() => v.remove(), 650); }
const COMBO_WORD = ['', '', '좋아요!', '멋져요!', '대단해요!', '완벽해요!'];
function fxCombo(n){
  const bd = $('#bd'); if(!bd) return;
  const old = document.querySelector('.fxcombo'); if(old) old.remove();
  const p = bd.getBoundingClientRect(), d = document.createElement('div'); d.className = 'fxcombo' + (n >= 5 ? ' max' : '');
  d.innerHTML = `<b>연속 ${n}</b><span>${COMBO_WORD[Math.min(n, 5)]}</span>`;
  d.style.left = (p.left + p.width / 2) + 'px'; d.style.top = (p.top + 18) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1200);
}
/* ===== 아이템(누적 보유) =====
   여우 힌트·자동 ✕는 판마다 새로 주지 않고 쌓아 둔 개수에서 쓴다. 한 판에 각각 1번까지.
   지금은 이 브라우저에 저장(hp:items). 로그인(카카오)이 붙으면 계정별 서버 저장으로 옮긴다. */
const ITEM_DEF = { foxHint:{ name:'여우 힌트', start:3 }, foxAuto:{ name:'자동 ✕', start:3 } };
const ITEM_MAX = 20, FOX_ITEM_PER_GAME = 1;
function items(){ const s = store.get('hp:items', null) || {}; for(const k in ITEM_DEF) if(typeof s[k] !== 'number') s[k] = ITEM_DEF[k].start; return s; }
const itemN = k => items()[k];
function itemAdd(k, n){ const s = items(); s[k] = Math.min(ITEM_MAX, s[k] + n); store.set('hp:items', s); }
function itemUse(k){ const s = items(); if(s[k] < 1) return false; s[k]--; store.set('hp:items', s); return true; }
/* 보상: 솔로 챕터 첫 클리어 = 힌트+1·자동+1, 레벨 업 = 힌트+1, 오늘의 문제 5게임 완주(하루 1번) = 자동+1 */
function itemReward(list, why){
  list.forEach(([k, n]) => itemAdd(k, n));
  setTimeout(() => toast(why + ' · ' + list.map(([k, n]) => ITEM_DEF[k].name + ' +' + n).join(' · ')), 1400);
}
