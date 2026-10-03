/* 공용: 움직이는 배경 장면(배경팀, 2026-10-03)
   게임 화면 뒤에서 천천히 움직이는 배경. 게임 정의의 scene 칸으로 고른다(core는 게임 이름을 모름):
     scene:{ kind:'stars'|'sea'|'forest'|'bubbles'|'petals'|'shapes'|'motes', colors:['#색', …], density:1, alpha:1 }
   지키는 것
   · 보이기만 한다: 게임 상태(G)·문제 씨앗(rng)·시계·대전 통신을 건드리지 않고, 눌림도 막지 않는다(pointer-events:none).
   · 가볍게: 초당 30장 상한, 화면 배율 1.5 상한, 그림 30~50개. 그리는 데 오래 걸리면 개수를 줄이고, 그래도 무거우면 멈춘 한 장으로 바꾼다.
   · 대전 중에는 개수를 25% 줄이고, 시작 카운트다운 동안은 아예 쉰다. 화면이 숨겨지면(다른 앱) 브라우저가 알아서 멈춘다. '동작 줄이기' 설정이면 멈춘 한 장만.
   · 이 파일에서 오류가 나면 배경만 끄고 게임은 그대로 간다. */
const SCN = { cv:null, ctx:null, cfg:null, items:[], raf:0, last:0, t:0, cost:2, lite:1, home:null, tex:{}, w:0, h:0, reduce:false };
try{ SCN.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){}
const SCN_BASE = { stars:46, sea:30, forest:26, bubbles:22, petals:20, shapes:16, motes:26 };

function scnCanvas(){
  if(SCN.cv && SCN.cv.isConnected) return true;
  const cv = document.createElement('canvas'); cv.className = 'bgscene'; cv.setAttribute('aria-hidden', 'true');
  const wrap = document.querySelector('.wrap'); if(!wrap || !wrap.parentNode) return false;
  wrap.parentNode.insertBefore(cv, wrap);
  SCN.cv = cv; SCN.ctx = cv.getContext('2d');
  addEventListener('resize', () => { if(SCN.cfg){ scnSize(); scnFill(); if(SCN.reduce || SCN.lite === 0) scnFrame(0); } });
  return true;
}
function scnSize(){ const d = Math.min(1.5, devicePixelRatio || 1); SCN.w = innerWidth; SCN.h = innerHeight; SCN.cv.width = SCN.w * d; SCN.cv.height = SCN.h * d; SCN.ctx.setTransform(d, 0, 0, d, 0, 0); }
/* 빛 텍스처(색마다 한 번) */
function scnTex(c, soft){
  const key = c + (soft ? 's' : ''); let t = SCN.tex[key]; if(t) return t;
  t = document.createElement('canvas'); t.width = t.height = 64; const x = t.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  const [r, gg, b] = typeof fxRgb === 'function' ? fxRgb(c) : [255, 255, 255];
  if(soft){ g.addColorStop(0, `rgba(${r},${gg},${b},.55)`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`); }
  else { g.addColorStop(0, '#fff'); g.addColorStop(.2, `rgba(${r},${gg},${b},1)`); g.addColorStop(.55, `rgba(${r},${gg},${b},.3)`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return SCN.tex[key] = t;
}
const sr = (a, b) => a + Math.random() * (b - a);   /* 그림 위치용(문제 씨앗과 무관) */
const scol = () => { const c = SCN.cfg.colors || ['#FFFFFF']; return c[Math.floor(Math.random() * c.length)]; };
function scnItem(kind, fresh){
  const W = SCN.w, H = SCN.h, c = scol();
  switch(kind){
    case 'stars': return { x:sr(0, W), y:sr(0, H), r:sr(.6, 1.9), ph:sr(0, 6.3), sp:sr(.6, 2.2), c, vy:sr(1, 4) };
    case 'sea': return Math.random() < .7 ? { b:1, x:sr(0, W), y:fresh ? sr(0, H) : H + 20, r:sr(2, 7), vy:sr(14, 34), ph:sr(0, 6.3), c } : { b:0, x:sr(0, W), y:sr(0, H), r:sr(1, 2.2), vx:sr(-4, 4), vy:sr(-3, 3), ph:sr(0, 6.3), c };
    case 'forest': return Math.random() < .55 ? { fly:1, x:sr(0, W), y:sr(H * .2, H), r:sr(2, 3.6), ph:sr(0, 6.3), sp:sr(.4, 1), ang:sr(0, 6.3), c:'#FFF3A0' }
      : { fly:0, x:sr(-20, W), y:fresh ? sr(0, H) : -20, r:sr(5, 9), rot:sr(0, 6.3), vr:sr(-1.2, 1.2), vy:sr(16, 30), vx:sr(4, 14), ph:sr(0, 6.3), c };
    case 'bubbles': return { x:sr(0, W), y:fresh ? sr(0, H) : H + 40, r:sr(8, 26), vy:sr(10, 24), ph:sr(0, 6.3), c };
    case 'petals': return { x:sr(-30, W), y:fresh ? sr(0, H) : -20, r:sr(5, 9), rot:sr(0, 6.3), vr:sr(-1.5, 1.5), vy:sr(18, 34), vx:sr(8, 20), ph:sr(0, 6.3), heart:Math.random() < .3, c };
    case 'shapes': return { x:sr(0, W), y:fresh ? sr(0, H) : H + 40, r:sr(10, 22), rot:sr(0, 6.3), vr:sr(-.35, .35), vy:sr(8, 18), ph:sr(0, 6.3), sh:Math.floor(sr(0, 4)), c };
    default: return { x:sr(0, W), y:sr(0, H), r:sr(10, 30), vx:sr(-6, 6), vy:sr(-8, -2), ph:sr(0, 6.3), c };   /* motes: 흐린 빛 방울 */
  }
}
function scnFill(){
  const k = SCN.cfg.kind, area = Math.min(2.2, (SCN.w * SCN.h) / (390 * 844));
  const n = Math.round((SCN_BASE[k] || 24) * (SCN.cfg.density || 1) * area * SCN.lite * (typeof G !== 'undefined' && G && G.duel ? .75 : 1));
  SCN.items = []; for(let i = 0; i < n; i++) SCN.items.push(scnItem(k, true));
  SCN.shoot = null; SCN.nextShoot = 2 + Math.random() * 4;
}
function scnFrame(dt){
  const ctx = SCN.ctx, W = SCN.w, H = SCN.h, k = SCN.cfg.kind, t = (SCN.t += dt), A = SCN.cfg.alpha || 1;
  ctx.clearRect(0, 0, W, H);
  if(k === 'sea'){   /* 위에서 내려오는 빛줄기 */
    ctx.globalCompositeOperation = 'lighter';
    for(let i = 0; i < 4; i++){
      const x = W * (.15 + i * .24) + Math.sin(t * .25 + i * 1.7) * 40, w = 50 + 30 * Math.sin(t * .4 + i);
      const g = ctx.createLinearGradient(0, 0, 0, H * .8); g.addColorStop(0, `rgba(190,235,255,${.10 * A})`); g.addColorStop(1, 'rgba(190,235,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * .3, 0); ctx.lineTo(x + w * .3, 0); ctx.lineTo(x + w * 1.4, H * .8); ctx.lineTo(x - w * .6, H * .8); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  for(let i = 0; i < SCN.items.length; i++){
    const p = SCN.items[i];
    if(k === 'stars'){
      p.y += p.vy * dt; if(p.y > H + 4){ p.y = -4; p.x = sr(0, W); }
      const a = (.35 + .65 * (.5 + .5 * Math.sin(t * p.sp + p.ph))) * A;
      if(p.r > 1.5){ ctx.globalAlpha = a; const d = p.r * 7; ctx.drawImage(scnTex(p.c), p.x - d / 2, p.y - d / 2, d, d); }
      else { ctx.globalAlpha = a * .9; ctx.fillStyle = p.c; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
    } else if(k === 'sea'){
      if(p.b){ p.y -= p.vy * dt; p.x += Math.sin(t * 1.6 + p.ph) * 8 * dt; if(p.y < -20){ Object.assign(p, scnItem('sea')); p.b = 1; p.y = H + 20; }
        ctx.globalAlpha = .35 * A; ctx.strokeStyle = '#DDF6FF'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.stroke();
        ctx.globalAlpha = .5 * A; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - p.r * .35, p.y - p.r * .35, p.r * .22, 0, 6.283); ctx.fill(); }
      else { p.x += p.vx * dt; p.y += p.vy * dt; if(p.x < -5) p.x = W + 5; if(p.x > W + 5) p.x = -5; if(p.y < -5) p.y = H + 5; if(p.y > H + 5) p.y = -5;
        ctx.globalAlpha = (.25 + .2 * Math.sin(t + p.ph)) * A; const d = p.r * 6; ctx.drawImage(scnTex('#BFF4FF'), p.x - d / 2, p.y - d / 2, d, d); }
    } else if(k === 'forest'){
      if(p.fly){ p.ang += (Math.sin(t * .7 + p.ph) * .9) * dt; p.x += Math.cos(p.ang) * 14 * p.sp * dt; p.y += Math.sin(p.ang) * 10 * p.sp * dt;
        if(p.x < -10) p.x = W + 10; if(p.x > W + 10) p.x = -10; if(p.y < H * .1) p.ang = Math.abs(p.ang); if(p.y > H + 10) p.y = H * .3;
        const a = Math.max(0, Math.sin(t * 1.3 * p.sp + p.ph)); ctx.globalAlpha = (.15 + .85 * a * a) * A; ctx.globalCompositeOperation = 'lighter';
        const d = p.r * 9; ctx.drawImage(scnTex(p.c), p.x - d / 2, p.y - d / 2, d, d); ctx.globalCompositeOperation = 'source-over'; }
      else { p.y += p.vy * dt; p.x += (p.vx + Math.sin(t * 1.2 + p.ph) * 18) * dt; p.rot += p.vr * dt; if(p.y > H + 20 || p.x > W + 30){ Object.assign(p, scnItem('forest')); if(p.fly){ p.fly = 0; Object.assign(p, { y:-20, r:sr(5, 9), rot:0, vr:sr(-1.2, 1.2), vy:sr(16, 30), vx:sr(4, 14), c:scol() }); } else p.y = -20; }
        ctx.globalAlpha = .55 * A; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.quadraticCurveTo(0, -p.r * .8, p.r, 0); ctx.quadraticCurveTo(0, p.r * .8, -p.r, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-p.r * .8, 0); ctx.lineTo(p.r * .8, 0); ctx.stroke(); ctx.restore(); }
    } else if(k === 'bubbles'){
      p.y -= p.vy * dt; p.x += Math.sin(t * .8 + p.ph) * 10 * dt; if(p.y < -p.r - 10){ Object.assign(p, scnItem('bubbles')); }
      ctx.globalAlpha = .22 * A; ctx.drawImage(scnTex(p.c, true), p.x - p.r * 1.3, p.y - p.r * 1.3, p.r * 2.6, p.r * 2.6);
      ctx.globalAlpha = .45 * A; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.stroke();
      ctx.globalAlpha = .7 * A; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .72, 3.6, 4.4); ctx.stroke();
    } else if(k === 'petals'){
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(t * 1.4 + p.ph) * 22) * dt; p.rot += p.vr * dt; if(p.y > H + 20 || p.x > W + 30){ Object.assign(p, scnItem('petals')); p.y = -20; }
      ctx.globalAlpha = .6 * A; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, .55 + .45 * Math.cos(t * 2 + p.ph)); ctx.fillStyle = p.c; const s = p.r;
      ctx.beginPath();
      if(p.heart){ ctx.moveTo(0, s * .9); ctx.bezierCurveTo(-s * 1.6, -s * .2, -s * .7, -s * 1.3, 0, -s * .45); ctx.bezierCurveTo(s * .7, -s * 1.3, s * 1.6, -s * .2, 0, s * .9); }
      else { ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * .9, -s * .2, 0, s); ctx.quadraticCurveTo(-s * .9, -s * .2, 0, -s); }
      ctx.fill(); ctx.restore();
    } else if(k === 'shapes'){
      p.y -= p.vy * dt; p.rot += p.vr * dt; p.x += Math.sin(t * .5 + p.ph) * 5 * dt; if(p.y < -40) Object.assign(p, scnItem('shapes'));
      ctx.globalAlpha = .16 * A; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.strokeStyle = p.c; ctx.fillStyle = p.c; ctx.lineWidth = 3; const s = p.r;
      ctx.beginPath();
      if(p.sh === 0){ const r = s * .3; ctx.moveTo(-s + r, -s); ctx.arcTo(s, -s, s, s, r); ctx.arcTo(s, s, -s, s, r); ctx.arcTo(-s, s, -s, -s, r); ctx.arcTo(-s, -s, s, -s, r); ctx.closePath(); ctx.stroke(); }
      else if(p.sh === 1){ ctx.arc(0, 0, s * .9, 0, 6.283); ctx.stroke(); }
      else if(p.sh === 2){ ctx.moveTo(0, -s); ctx.lineTo(s * .95, s * .7); ctx.lineTo(-s * .95, s * .7); ctx.closePath(); ctx.stroke(); }
      else { ctx.lineWidth = s * .42; ctx.lineCap = 'round'; ctx.moveTo(-s * .7, 0); ctx.lineTo(s * .7, 0); ctx.moveTo(0, -s * .7); ctx.lineTo(0, s * .7); ctx.stroke(); }
      ctx.restore();
    } else {   /* motes */
      p.x += p.vx * dt; p.y += p.vy * dt; if(p.y < -40){ p.y = H + 30; p.x = sr(0, W); } if(p.x < -40) p.x = W + 30; if(p.x > W + 40) p.x = -30;
      ctx.globalAlpha = (.18 + .14 * Math.sin(t * .9 + p.ph)) * A; ctx.drawImage(scnTex(p.c, true), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
  }
  /* 별똥별 */
  if(k === 'stars' && SCN.lite > 0 && dt > 0){
    SCN.nextShoot -= dt;
    if(!SCN.shoot && SCN.nextShoot <= 0){ SCN.shoot = { x:sr(W * .2, W * 1.1), y:sr(-10, H * .35), vx:-sr(380, 520), vy:sr(160, 240), t:0 }; SCN.nextShoot = 5 + Math.random() * 7; }
    const s = SCN.shoot;
    if(s){ s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; const a = Math.min(1, s.t * 4) * Math.max(0, 1 - s.t / 1.1);
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * .18, s.y - s.vy * .18); g.addColorStop(0, `rgba(255,255,255,${a * A})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * .18, s.y - s.vy * .18); ctx.stroke();
      if(s.t > 1.1) SCN.shoot = null; }
  }
  ctx.globalAlpha = 1;
}
function scnLoop(now){
  SCN.raf = requestAnimationFrame(scnLoop);
  if(now - SCN.last < 32) return;   /* 초당 30장 */
  if(document.body.classList.contains('duel-ready')){ SCN.last = now; return; }   /* 대전 카운트다운 동안은 쉬어서 두 사람의 시작 순간이 정확하게 */
  const dt = Math.min(.1, (now - (SCN.last || now)) / 1000); SCN.last = now;
  const t0 = performance.now();
  try{ scnFrame(dt); }catch(_){ sceneStop(); return; }
  /* 그리는 데 걸린 시간을 보고 가볍게 조절: 4ms 넘으면 반으로, 반으로 줄였는데도 8ms 넘으면 멈춘 한 장 */
  SCN.cost = SCN.cost * .92 + (performance.now() - t0) * .08;
  if(SCN.cost > 4 && SCN.lite === 1){ SCN.lite = .5; SCN.items.length = Math.ceil(SCN.items.length / 2); SCN.cost = 2; }
  else if(SCN.cost > 8 && SCN.lite === .5){ SCN.lite = 0; cancelAnimationFrame(SCN.raf); SCN.raf = 0; }
}
/* 장면 켜기: cfg 없으면 기본 장면(SCN.home, 사이트 홈처럼). 같은 장면이면 그대로 둔다 */
function sceneStart(cfg){
  try{
    cfg = cfg || SCN.home;
    if(!cfg){ sceneStop(); return; }
    if(SCN.cfg === cfg && SCN.raf) return;
    sceneStop();
    if(!scnCanvas()) return;
    SCN.cfg = cfg; SCN.t = 0; SCN.last = 0; SCN.cost = 2; SCN.lite = 1; SCN.cv.hidden = false;
    scnSize(); scnFill();
    if(SCN.reduce){ scnFrame(0); return; }
    SCN.raf = requestAnimationFrame(scnLoop);
  }catch(_){ sceneStop(); }
}
function sceneStop(){
  if(SCN.raf) cancelAnimationFrame(SCN.raf); SCN.raf = 0; SCN.cfg = null; SCN.items = [];
  if(SCN.cv){ try{ SCN.ctx.clearRect(0, 0, SCN.w, SCN.h); }catch(_){} SCN.cv.hidden = true; }
}
/* 기본 장면 정하기(사이트 홈 등). 지금 게임 중이 아니면 바로 켠다 */
function sceneHome(cfg){ SCN.home = cfg; if(!(typeof G !== 'undefined' && G && !G.over && document.body.dataset.mode)) sceneStart(cfg); }
