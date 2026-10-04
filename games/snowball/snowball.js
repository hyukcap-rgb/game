/* ---------- 스노우볼: 말랑볼을 굴려 먹고 커지는 육성 대결 (games/snowball) ----------
   규칙 원본: docs/22_스노우볼_종료규칙.md (기획팀 v1, 2026-10-05)
   - 솔로: 혼자 3분, 종료 순간 레벨로 별(★ Lv10 · ★★ Lv18 · ★★★ Lv25). Lv30 퍼펙트 / 녹아 사라지면 실패
   - 대전: 나 + 봇 29명 배틀로열. 흡수·녹음으로 탈락, 2:00 전 탈락이면 5초 안에 1회 부활, 1명 남거나 3:00에 종료
   판·봇·먹이 배치는 모두 씨앗 rng(S.rng)로만 만든다. Math.random은 쓰지 않는다. */
NG.snowball = (() => {
  const ID = 'snowball';
  const RULE = {
    MATCH:180, SUNRISE_AT:120, SUNRISE_WARN:100, SAFE_MIN:.30,
    START_MASS:20, DEATH_MASS:15,
    ABSORB_RATIO:1.2, ABSORB_GAIN:.7,
    IDLE_MELT:.005, SUN_MELT:.03, IDLE_SPEED:.2,
    BOOST_COST:20, BOOST_MIN:40, BOOST_MUL:1.8,
    REVIVE_WINDOW:5, REVIVE_BEFORE:120, REVIVE_KEEP:.3, INVULN:3,
    BOTS:29, MAX_LV:30, WIN_RANK:3,
    GOLD_EVERY:45, GOLD_MASS:300, GOLD_XP:100,
    STAR:[10, 18, 25]
  };
  const WORLD_R = 2400, RESPAWN = 15;
  /* 레벨 공식: Lv n이 되는 질량 M(n) = 20 + 1480 × ((n−1)/14)^2.65 (Lv15 = 1,500 · Lv30 ≈ 10,220) */
  const massFor = n => n <= 1 ? 20 : 20 + 1480 * Math.pow((n - 1) / 14, 2.65);
  const snLv = m => { if(m < 20) return 1; const n = 1 + 14 * Math.pow((m - 20) / 1480, 1 / 2.65); return Math.max(1, Math.min(RULE.MAX_LV, Math.floor(n + 1e-9))); };
  const meters = m => .119 * Math.sqrt(m);
  const radiusOf = m => 6 * Math.sqrt(m);
  const starOf = lv => lv >= RULE.STAR[2] ? 3 : lv >= RULE.STAR[1] ? 2 : lv >= RULE.STAR[0] ? 1 : 0;

  const FOOD = {
    flake:  { mass:1,   lv:1,  r:7,  count:700, label:'눈송이',    key:'flake' },
    crystal:{ mass:8,   lv:1,  r:10, count:120, label:'반짝 결정', key:'crystal' },
    cupcake:{ mass:25,  lv:5,  r:15, count:120, label:'컵케이크',  key:'object' },
    teddy:  { mass:60,  lv:10, r:24, count:80,  label:'곰인형',    key:'object' },
    truck:  { mass:150, lv:18, r:40, count:50,  label:'푸드트럭',  key:'object' }
  };
  const SKINS = [
    { name:'딸기우유', eye:'#C2347A', body:'#FFD3E6', shade:'#FF9CC6', acc:'ribbon' },
    { name:'민트초코', eye:'#1F8F6A', body:'#D2F7EA', shade:'#7FDDBB', acc:'berry' },
    { name:'레몬버터', eye:'#B07A00', body:'#FFF3BF', shade:'#FFD45E', acc:'none' },
    { name:'복숭아냥', eye:'#C8582E', body:'#FFE3D3', shade:'#FFB18F', acc:'cat' },
    { name:'포도왕관', eye:'#6A3FC0', body:'#E3D0FF', shade:'#A77BEA', acc:'crown' },
    { name:'소다냥', eye:'#1F6FC4',   body:'#D6F1FF', shade:'#8FCBF2', acc:'cat' }
  ];
  const NAMES = ['눈폭풍','굴러굴러','포도공주','말랑이','솜사탕','몽글이','젤리곰','쿠키볼','별사탕','마카롱','동글동글','콩떡','하늘꿈','봄봄','딸기잼','라떼','푸딩','모찌','버블티','눈꽃','토끼발','방울이','구름빵','설탕눈','민트향','초코칩','레몬톡','바닐라','소다팝'];
  const REL = {
    prey:  { ring:'#2E8BE6', pill:'#1F6FC4', fg:'#fff',    mood:'scared', w:4 },
    same:  { ring:'#A898B8', pill:'#6E5A82', fg:'#fff',    mood:'calm',   w:3 },
    danger:{ ring:'#FF8A3D', pill:'#FF8A3D', fg:'#2A1300', mood:'smug',   w:5 }
  };
  const CHIPS = [['flake', '눈송이'], ['crystal', '반짝 결정'], ['cupcake', '컵케이크'], ['teddy', '곰인형'], ['truck', '푸드트럭']];

  let S = null;   /* 지금 판의 시뮬레이션 상태(G.sn에도 걸어 둠) */
  const rnd = (a, b) => a + S.rng() * (b - a);
  function inDisk(R){ const a = S.rng() * Math.PI * 2, d = Math.sqrt(S.rng()) * R; return { x:Math.cos(a) * d, y:Math.sin(a) * d }; }
  const fx = f => { try{ f(); }catch(_){} };   /* 효과·소리는 실패해도 판이 멈추지 않게 */

  function mkPlayer(me, name, skin){
    const p = inDisk(WORLD_R * .85);
    return { me, name, skin, x:p.x, y:p.y, vx:0, vy:0, mass:RULE.START_MASS, peak:RULE.START_MASS, peakAt:0,
      alive:true, kills:0, golds:0, eaten:{ flake:0, crystal:0, object:0, absorb:0 }, stickers:[],
      dirx:1, diry:0, throttle:0, boosting:false, invuln:RULE.INVULN, idle:false,   /* 시작 3초 보호(시작하자마자 먹히지 않게) */
      ai:me ? null : { t:0, skill:rnd(.55, 1), mode:'food', boost:false } };
  }

  /* ---------------- 판 만들기 ---------------- */
  function init(cfg, rng, lv){
    const battle = !!(G.duel);
    S = { rng, battle, cfg:cfg || {}, t:0, foods:[], players:[], gold:null, nextGold:RULE.GOLD_EVERY, safeR:WORLD_R, floats:[],
      reviveUsed:false, reviveLeft:0, deathInfo:null, end:null, total:0, cam:{ x:0, y:0, z:1 }, W:0, H:0, DPR:1,
      mouse:{ x:0, y:0, active:false, last:'mouse' }, joy:{ on:false, cruise:false, dx:1, dy:0, thr:0 }, keys:{}, boostHeld:false, hudT:0, lt:0 };
    G.sn = S;
    const mul = (cfg && cfg.food) || 1;
    for(const [type, f] of Object.entries(FOOD)){
      const n = Math.round(f.count * mul);
      for(let i = 0; i < n; i++){ const p = inDisk(WORLD_R * .97); S.foods.push({ type, x:p.x, y:p.y, alive:true, back:0 }); }
    }
    const me = mkPlayer(true, '나', SKINS[0]); me.x = 0; me.y = 0;
    S.me = me; S.players.push(me);
    if(battle) for(let i = 0; i < RULE.BOTS; i++) S.players.push(mkPlayer(false, NAMES[i % NAMES.length], SKINS[1 + (i % (SKINS.length - 1))]));
    S.total = S.players.length;
  }

  /* ---------------- 조작 ---------------- */
  const maxSpeed = r => 430 * Math.pow(27 / r, .22);   /* v1.1: 체감 속도 약 1.5배(큰 공도 덜 느려짐) */
  const zoomFor = r => 1.25 * Math.pow(40 / (r + 13), .55) * Math.min(S.W, S.H) / 700;
  /* v1.1: 내 공은 위·아래 판 사이 '보이는 곳' 한가운데에(아래 레버 판에 가리지 않게) */
  const midY = () => S.safeTop && S.safeBot && S.H - S.safeBot > S.safeTop ? (S.safeTop - 10 + S.H - S.safeBot) / 2 : S.H / 2;
  const toScreen = (x, y) => ({ x:(x - S.cam.x) * S.cam.z + S.W / 2, y:(y - S.cam.y) * S.cam.z + midY() });

  function humanControl(p){
    const K = S.keys, m = S.mouse; let dx = 0, dy = 0, thr = 0;
    const kx = (K.ArrowRight || K.KeyD ? 1 : 0) - (K.ArrowLeft || K.KeyA ? 1 : 0);
    const ky = (K.ArrowDown || K.KeyS ? 1 : 0) - (K.ArrowUp || K.KeyW ? 1 : 0);
    if(m.last === 'key' && (kx || ky)){ const l = Math.hypot(kx, ky); dx = kx / l; dy = ky / l; thr = 1; }
    else if(S.joy.on || S.joy.cruise){ dx = S.joy.dx; dy = S.joy.dy; thr = S.joy.thr; }
    else if(m.active && m.last === 'mouse'){
      const s = toScreen(p.x, p.y), vx = m.x - s.x, vy = m.y - s.y, d = Math.hypot(vx, vy);
      const dead = Math.max(14, radiusOf(p.mass) * S.cam.z * .55);
      if(d > dead){ dx = vx / d; dy = vy / d; thr = Math.min(1, (d - dead) / 110); }
    }
    if(thr > 0){ p.dirx = dx; p.diry = dy; }
    p.throttle = thr;
    p.boosting = S.boostHeld && p.mass > RULE.BOOST_MIN && thr > 0;
  }

  function botThink(p, dt){
    const ai = p.ai; ai.t -= dt; if(ai.t > 0) return; ai.t = rnd(.18, .4) / ai.skill;
    const r = radiusOf(p.mass), lv = snLv(p.mass), aware = 420 + 380 * ai.skill + r * 2;
    let fx_ = 0, fy_ = 0, threat = false, prey = null, preyD = 1e9;
    for(const q of S.players){
      if(q === p || !q.alive) continue;
      const qr = radiusOf(q.mass), d = Math.hypot(q.x - p.x, q.y - p.y);
      if(d > aware + qr) continue;
      if(qr >= r * RULE.ABSORB_RATIO && q.invuln <= 0){ const w = 1 / Math.max(30, d - qr); fx_ -= (q.x - p.x) * w; fy_ -= (q.y - p.y) * w; threat = true; }
      else if(r >= qr * RULE.ABSORB_RATIO && q.invuln <= 0 && d < preyD){ prey = q; preyD = d; }
    }
    let tx, ty; ai.boost = false;
    const fromC = Math.hypot(p.x, p.y);
    if(S.t > RULE.SUNRISE_WARN && fromC > S.safeR * .82 - r){ tx = -p.x; ty = -p.y; ai.mode = 'sun'; ai.boost = fromC > S.safeR && p.mass > 80; }
    else if(threat){ tx = fx_; ty = fy_; ai.mode = 'flee'; ai.boost = p.mass > 90 && S.rng() < .5 * ai.skill; }
    else if(prey && preyD < 520 * ai.skill + r){ tx = prey.x - p.x; ty = prey.y - p.y; ai.mode = 'chase'; ai.boost = preyD < 240 + r && p.mass > 120 && S.rng() < .6 * ai.skill; }
    else {
      let best = null, bs = 0;
      for(const f of S.foods){
        if(!f.alive) continue; const F = FOOD[f.type]; if(lv < F.lv) continue;
        const dx = f.x - p.x, dy = f.y - p.y; if(Math.abs(dx) > 700 || Math.abs(dy) > 700) continue;
        const s = F.mass / (Math.hypot(dx, dy) + 60); if(s > bs){ bs = s; best = f; }
      }
      if(S.gold && Math.hypot(S.gold.x - p.x, S.gold.y - p.y) < 900 * ai.skill) best = S.gold;
      if(best){ tx = best.x - p.x; ty = best.y - p.y; } else { tx = -p.x + rnd(-500, 500); ty = -p.y + rnd(-500, 500); }
      ai.mode = 'food';
    }
    const l = Math.hypot(tx, ty) || 1; p.dirx = tx / l; p.diry = ty / l; p.throttle = ai.mode === 'food' ? rnd(.8, 1) : 1;
  }

  function addFloat(x, y, text, color){ S.floats.push({ x, y, text, color, t:0 }); if(S.floats.length > 24) S.floats.shift(); }

  function eat(p, f){
    const F = FOOD[f.type]; p.mass += F.mass; f.alive = false; f.back = S.t + RESPAWN;
    p.eaten[F.key] += F.mass;
    if(F.key === 'object'){
      p.stickers.push({ a:rnd(0, Math.PI * 2), d:rnd(.25, .72), k:['heart', 'star', 'dot'][Math.floor(rnd(0, 3))], rot:rnd(-.5, .5) });
      if(p.stickers.length > 14) p.stickers.shift();
      if(p.me){ addFloat(p.x, p.y, `+${F.mass} ${F.label}`, '#E0457F'); fx(() => sfx('snEat')); }
    }
  }

  /* ---------------- 한 틱 ---------------- */
  function step(dt){
    S.t += dt;
    S.safeR = S.t < RULE.SUNRISE_AT ? WORLD_R : WORLD_R * (1 - (1 - RULE.SAFE_MIN) * Math.min(1, (S.t - RULE.SUNRISE_AT) / (RULE.MATCH - RULE.SUNRISE_AT)));
    if(!S.gold && S.t >= S.nextGold && S.t < RULE.MATCH - 5){ const p = inDisk(S.safeR * .7); S.gold = { x:p.x, y:p.y }; S.nextGold = S.t + RULE.GOLD_EVERY; }
    for(const f of S.foods) if(!f.alive && S.t >= f.back){ const p = inDisk(WORLD_R * .97); f.x = p.x; f.y = p.y; f.alive = true; }

    const alive = S.players.filter(p => p.alive);
    for(const p of alive){
      if(p.me) humanControl(p); else { botThink(p, dt); p.boosting = p.ai.boost && p.mass > RULE.BOOST_MIN; }
      const r = radiusOf(p.mass), vmax = maxSpeed(r) * (p.boosting ? RULE.BOOST_MUL : 1);
      const k = Math.min(1, dt * 9);
      p.vx += (p.dirx * vmax * p.throttle - p.vx) * k; p.vy += (p.diry * vmax * p.throttle - p.vy) * k;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const d = Math.hypot(p.x, p.y), lim = WORLD_R - r * .5; if(d > lim){ p.x *= lim / d; p.y *= lim / d; }
      if(p.invuln > 0) p.invuln -= dt;
      /* 녹음: 멈춤 −0.5%/초, 햇볕 구역 −3%/초 */
      p.idle = Math.hypot(p.vx, p.vy) < maxSpeed(r) * RULE.IDLE_SPEED;
      let melt = 0;
      if(p.idle) melt += RULE.IDLE_MELT;
      if(Math.hypot(p.x, p.y) > S.safeR) melt += RULE.SUN_MELT;
      p.mass -= p.mass * melt * dt;
      if(p.boosting) p.mass -= RULE.BOOST_COST * dt;
      const lv = snLv(p.mass);
      for(const f of S.foods){
        if(!f.alive) continue; const dx = f.x - p.x, dy = f.y - p.y;
        if(Math.abs(dx) > r || Math.abs(dy) > r) continue;
        if(dx * dx + dy * dy < r * r){
          if(lv >= FOOD[f.type].lv) eat(p, f);
          else if(p.me && S.t > (S.lockMsg || 0)){ S.lockMsg = S.t + 3; { const L = FOOD[f.type].label, k = L.charCodeAt(L.length - 1) - 0xAC00; addFloat(p.x, p.y, `${L}${k >= 0 && k % 28 ? '은' : '는'} Lv ${FOOD[f.type].lv}부터!`, '#6E5A82'); } }   /* 못 먹는 사물에 닿으면 한 번 알려 줌 */
        }
      }
      if(S.gold && Math.hypot(S.gold.x - p.x, S.gold.y - p.y) < r + 18){
        p.mass += RULE.GOLD_MASS; p.golds++; p.eaten.object += RULE.GOLD_MASS; S.gold = null;
        if(p.me){ addFloat(p.x, p.y, `+${RULE.GOLD_MASS} 황금 눈사람!`, '#B07A00'); fx(() => sfx('snGold')); }
      }
      if(p.mass > p.peak){ p.peak = p.mass; p.peakAt = S.t; }
    }
    /* 흡수(1.2배 이상) · 튕김(1.2배 미만) */
    const deaths = [];
    for(let i = 0; i < alive.length; i++) for(let j = i + 1; j < alive.length; j++){
      const a = alive[i], b = alive[j]; if(!a.alive || !b.alive) continue;
      const ra = radiusOf(a.mass), rb = radiusOf(b.mass), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01;
      if(d > ra + rb) continue;
      const [big, small, rB, rS] = ra >= rb ? [a, b, ra, rb] : [b, a, rb, ra];
      if(rB >= rS * RULE.ABSORB_RATIO && big.invuln <= 0 && small.invuln <= 0){
        if(d < rB - rS * .4){
          const pre = small.mass;
          big.mass += pre * RULE.ABSORB_GAIN; big.kills++; big.eaten.absorb += pre * RULE.ABSORB_GAIN;
          big.stickers.push(...small.stickers.slice(-3)); while(big.stickers.length > 14) big.stickers.shift();
          small.alive = false; deaths.push({ p:small, mass:pre, by:big, why:'absorb' });
          if(big.me){ addFloat(big.x, big.y, `+${Math.round(pre * RULE.ABSORB_GAIN)} ${small.name} 꿀꺽!`, '#B4550F'); fx(() => sfx('snGulp')); }
          if(big.mass > big.peak){ big.peak = big.mass; big.peakAt = S.t; }
        }
      } else if(rB < rS * RULE.ABSORB_RATIO){
        const push = (ra + rb - d) * .5, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const va = a.vx * nx + a.vy * ny, vb = b.vx * nx + b.vy * ny;
        a.vx += (vb - va) * nx; a.vy += (vb - va) * ny; b.vx += (va - vb) * nx; b.vy += (va - vb) * ny;
      }
    }
    for(const p of alive) if(p.alive && p.mass < RULE.DEATH_MASS){ p.alive = false; deaths.push({ p, mass:p.mass + 1e-4, why:'melt' }); }
    if(deaths.length) onDeaths(deaths);
    for(const f of S.floats) f.t += dt;
    S.floats = S.floats.filter(f => f.t < 1.4);
    checkEnd();
  }

  /* 같은 틱 탈락은 탈락 직전 질량 큰 쪽이 높은 순위. 내 순위 = 탈락 직후 생존자 수 + 1 */
  function onDeaths(deaths){
    deaths.sort((a, b) => b.mass - a.mass);
    const aliveAfter = S.players.filter(p => p.alive).length;
    deaths.forEach((d, i) => {
      d.rank = aliveAfter + 1 + i;
      if(!d.p.me || S.end) return;
      S.deathInfo = d; fx(() => sfx('snPop'));
      if(!S.battle){ endWith('melt'); return; }
      if(!S.reviveUsed && S.t < RULE.REVIVE_BEFORE) openRevive(d); else endWith(d.why);
    });
  }

  function checkEnd(){
    if(S.end) return;
    const me = S.me;
    if(!S.battle){
      if(me.alive && snLv(me.mass) >= RULE.MAX_LV) return endWith('perfect');
      if(S.t >= RULE.MATCH) return endWith('time');
      return;
    }
    const n = S.players.filter(p => p.alive).length;
    if(me.alive && n === 1) return endWith('last');
    if(S.t >= RULE.MATCH){
      if(me.alive) return endWith('time');
      if(S.reviveLeft > 0) return endWith(S.deathInfo.why);
    }
  }

  function survivorRank(){
    const me = S.me; let ahead = 0;
    for(const q of S.players){
      if(!q.alive || q.me) continue;
      if(q.mass > me.mass || (q.mass === me.mass && (q.kills > me.kills || (q.kills === me.kills && q.peakAt < me.peakAt)))) ahead++;
    }
    return 1 + ahead;
  }

  /* 판 끝: 결과를 정리해 두고 엔진 finish()로 넘긴다 */
  function endWith(reason){
    if(S.end) return;
    closeRevive();
    const me = S.me, lv = me.alive ? snLv(me.mass) : 0, E = { reason, lv, peakLv:snLv(me.peak), t:Math.min(S.t, RULE.MATCH) };
    if(!S.battle){
      E.stars = reason === 'perfect' ? 3 : reason === 'time' ? starOf(lv) : 0;
      E.win = E.stars > 0;
      E.score = reason === 'perfect' ? Math.round(me.mass + Math.max(0, RULE.MATCH - S.t) * 10) : Math.round(me.mass);
      E.why = { perfect:'Lv 30 달성 · 퍼펙트 클리어', time:'3:00 완주', melt:'녹아서 사라졌어요' }[reason];
    } else {
      E.rank = reason === 'last' ? 1 : reason === 'time' ? survivorRank() : (S.deathInfo ? S.deathInfo.rank : S.players.filter(p => p.alive && !p.me).length + 1);
      E.why = reason === 'last' ? '최후의 1인!' : reason === 'time' ? '3:00 종료 · 생존' : S.deathInfo && S.deathInfo.why === 'absorb' ? `${S.deathInfo.by.name}에게 흡수됨` : '녹아서 사라짐';
      E.win = E.rank <= RULE.WIN_RANK;
      const top = E.rank / S.total;
      E.xp = 100 + Math.floor(me.peak / 5) + me.kills * 50 + me.golds * RULE.GOLD_XP + (E.rank === 1 ? 500 : top <= .1 ? 300 : top <= .34 ? 100 : 0);
      E.score = Math.round(me.peak);
      G.duel.r = E.win ? 'w' : 'l';
      G.duel.why = `${S.total}명 중 ${E.rank}위 · ${E.why} · 흡수 ${me.kills}명 · 최고 Lv ${E.peakLv}`;
      G.duel.a = { sc:E.score, pg:Math.min(1, (S.total - E.rank + 1) / S.total) };
    }
    S.end = E;
    const g = G; setTimeout(() => { if(G === g && !g.over) finish(E.win); }, 650);
  }

  /* ---------------- 부활(대전, 판당 1회) ---------------- */
  const $s = sel => S.root ? S.root.querySelector(sel) : null;
  function openRevive(d){
    S.reviveLeft = RULE.REVIVE_WINDOW;
    const box = $s('.snb-rv'); if(!box) return;
    box.querySelector('.rv-t').textContent = d.why === 'absorb' ? `${d.by.name}에게 흡수됐어요` : '녹아서 사라졌어요';
    box.querySelector('.rv-d').textContent = `광고를 보면 ${Math.max(RULE.START_MASS, Math.round(d.mass * RULE.REVIVE_KEEP))} 질량(직전의 30%)으로 한 번 부활해요. 부활 후 3초 무적.`;
    box.hidden = false;
    fx(() => { const cv = box.querySelector('.rv-ball'), c = cv.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 96, 104); drawBall(c, 48, 60, 34, S.me.skin, 'scared', S.me.stickers, null, false); });
  }
  function closeRevive(){ S.reviveLeft = 0; const box = $s('.snb-rv'); if(box) box.hidden = true; }
  function doRevive(){
    if(!S || S.reviveLeft <= 0 || S.end) return;
    const me = S.me, d = S.deathInfo;
    me.mass = Math.max(RULE.START_MASS, d.mass * RULE.REVIVE_KEEP); me.alive = true; me.invuln = RULE.INVULN; me.vx = me.vy = 0;
    me.stickers = me.stickers.slice(-4);
    let best = null, bestD = -1;
    for(let i = 0; i < 24; i++){
      const c = inDisk(S.safeR * .8); let m = 1e9;
      for(const q of S.players) if(q.alive && q !== me && radiusOf(q.mass) >= radiusOf(me.mass) * RULE.ABSORB_RATIO) m = Math.min(m, Math.hypot(q.x - c.x, q.y - c.y));
      if(m > bestD){ bestD = m; best = c; }
    }
    me.x = best.x; me.y = best.y; S.reviveUsed = true; S.deathInfo = null; closeRevive();
  }

  /* ---------------- 그리기: 말랑볼 ---------------- */
  function ell(c, x, y, rx, ry, rot = 0){ c.beginPath(); c.ellipse(x, y, Math.max(.5, rx), Math.max(.5, ry), rot, 0, Math.PI * 2); }
  function heart(c, x, y, s){ c.beginPath(); c.moveTo(x, y + s * .35); c.bezierCurveTo(x - s, y - s * .25, x - s * .45, y - s, x, y - s * .4); c.bezierCurveTo(x + s * .45, y - s, x + s, y - s * .25, x, y + s * .35); c.closePath(); }
  function star(c, x, y, R, r){ c.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); }
  function rrect(c, x, y, w, h, r){ c.beginPath(); if(c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

  /* 디자인 v2(2026-10-05 · 디자인팀 "스티커북 디저트 마을"): 맵 위의 모든 것은 흰 테두리로 오려 붙인 스티커.
     말랑볼은 움직이는 쪽으로 살짝 늘어나고, 숨 쉬듯 출렁이고, 가끔 눈을 깜박인다. 모두 보이기만 함(게임 상태 안 바꿈). */
  const now = () => performance.now() / 1000;
  const seedOf = s => { let h = 7; for(const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 997; return h / 997 * 6.28; };
  function groundShadow(c, x, y, r){ c.fillStyle = 'rgba(91,48,110,.16)'; ell(c, x, y + r * .9, r * .82, r * .2); c.fill(); }

  function drawBall(c, X, Y, r, skin, mood, stickers, ring, inv, anim){
    const ink = '#2A1240', lw = Math.max(2.2, r * .084), cut = Math.max(2.5, r * .075), A = anim || {};
    const t = now(), sd = A.seed || 0;
    groundShadow(c, X, Y, r);
    c.save(); c.translate(X, Y);
    /* 말랑: 속도 방향으로 늘어남 + 숨쉬기 */
    const sp = A.vmax ? Math.min(1, Math.hypot(A.vx || 0, A.vy || 0) / A.vmax) : 0, br = Math.sin(t * 3.2 + sd) * .022;
    const ang = sp > .05 ? Math.atan2(A.vy, A.vx) : 0;
    c.rotate(ang); c.scale(1 + .07 * sp + br, 1 - .06 * sp - br); c.rotate(-ang);
    const x = 0, y = 0;
    if(skin.acc === 'cat') for(const sg of [-1, 1]){
      c.save(); c.translate(x + sg * r * .58, y - r * .78); c.rotate(sg * .3);
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -r * .38 - cut * 1.4); c.lineTo(r * .3 + cut, r * .2 + cut * .4); c.lineTo(-r * .3 - cut, r * .2 + cut * .4); c.closePath(); c.fill();
      c.fillStyle = skin.shade; c.beginPath(); c.moveTo(0, -r * .38); c.lineTo(r * .3, r * .2); c.lineTo(-r * .3, r * .2); c.closePath(); c.fill();
      c.fillStyle = '#FF9CC6'; c.beginPath(); c.moveTo(0, -r * .2); c.lineTo(r * .15, r * .14); c.lineTo(-r * .15, r * .14); c.closePath(); c.fill();
      c.restore();
    }
    if(ring){
      const ro = r + cut;
      if(ring.pulse){ c.strokeStyle = `rgba(255,138,61,${.22 + .1 * Math.sin(t * 5)})`; c.lineWidth = ring.width * 2.4; c.beginPath(); c.arc(x, y, ro + ring.width * 1.6, 0, Math.PI * 2); c.stroke(); }
      c.strokeStyle = ring.color; c.lineWidth = ring.width; c.beginPath(); c.arc(x, y, ro + ring.width / 2, 0, Math.PI * 2); c.stroke();
      if(ring.outer){ c.strokeStyle = ring.outer; c.lineWidth = ring.width * .8; c.beginPath(); c.arc(x, y, ro + ring.width * 1.4, 0, Math.PI * 2); c.stroke(); }
    }
    /* 스티커 흰 테두리 */
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r + cut, 0, Math.PI * 2); c.fill();
    /* 몸: 밝은 위 · 그늘진 아래 · 테두리 빛 */
    const g = c.createRadialGradient(x - r * .32, y - r * .44, 0, x, y, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(.42, skin.body); g.addColorStop(1, skin.shade);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    const lg = c.createLinearGradient(0, y - r, 0, y + r); lg.addColorStop(.55, 'rgba(91,48,110,0)'); lg.addColorStop(1, 'rgba(91,48,110,.22)');
    c.fillStyle = lg; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1.5, r * .06); c.beginPath(); c.arc(x, y, r * .9, Math.PI * .1, Math.PI * .55); c.stroke();
    c.restore();
    if(inv){ c.strokeStyle = 'rgba(255,255,255,.95)'; c.setLineDash([6, 6]); c.lineDashOffset = -t * 30; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + cut + 6, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
    /* 반짝 하이라이트 */
    c.fillStyle = 'rgba(255,255,255,.9)'; ell(c, x - r * .4, y - r * .55, r * .2, r * .1, -.56); c.fill(); ell(c, x - r * .1, y - r * .68, r * .055, r * .055); c.fill();
    if(stickers && r > 14) for(const s of stickers){
      const sx = x + Math.cos(s.a) * s.d * r, sy = y + Math.sin(s.a) * s.d * r * .9 + r * .12, sz = r * .16;
      if(sy - y < r * .38 && Math.abs(sx - x) < r * .66) continue;   /* 얼굴(눈·볼·입)은 비워 둠 */
      c.save(); c.translate(sx, sy); c.rotate(s.rot); c.lineJoin = 'round'; c.lineWidth = Math.max(2, r * .045); c.strokeStyle = '#fff';
      if(s.k === 'heart'){ c.fillStyle = '#FF5C9A'; heart(c, 0, 0, sz); c.stroke(); c.fill(); }
      else if(s.k === 'star'){ c.fillStyle = '#FFC93C'; star(c, 0, 0, sz * .9, sz * .42); c.stroke(); c.fill(); }
      else { c.fillStyle = '#7FDDBB'; c.beginPath(); c.arc(0, 0, sz * .45, 0, Math.PI * 2); c.stroke(); c.fill(); }
      c.restore();
    }
    /* 볼터치(빗금 세 줄) */
    for(const sg of [-1, 1]){
      c.fillStyle = 'rgba(255,110,170,.42)'; ell(c, x + sg * r * .56, y + r * .2, r * .16, r * .085); c.fill();
      if(r > 22){ c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, r * .018); for(let i = -1; i <= 1; i++){ const bx = x + sg * r * .56 + i * r * .06; c.beginPath(); c.moveTo(bx + r * .02, y + r * .16); c.lineTo(bx - r * .02, y + r * .24); c.stroke(); } }
    }
    /* 얼굴: 눈은 작은 공에서도 최소 크기 */
    const ex = r * .32, ey = -r * .13, eRx = Math.max(3.6, r * .145), eRy = Math.max(4.6, r * .195);
    const blink = ((t + sd) % 4.3) < .11;
    c.lineCap = 'round';
    const eye = (sg, sx = 1, sy = 1) => {
      const cx = x + sg * ex, cy = y + ey, rx = eRx * sx, ry = eRy * sy;
      if(blink){ c.strokeStyle = ink; c.lineWidth = Math.max(2, lw * .8); c.beginPath(); c.arc(cx, cy, rx, Math.PI * .15, Math.PI * .85); c.stroke(); return; }
      c.fillStyle = ink; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.6; ell(c, cx, cy, rx, ry); c.fill(); c.stroke();
      c.save(); ell(c, cx, cy, rx, ry); c.clip(); c.fillStyle = skin.eye || '#7A3DB8'; ell(c, cx, cy + ry * .55, rx * .85, ry * .62); c.fill(); c.restore();
      c.fillStyle = '#fff'; ell(c, cx - rx * .3, cy - ry * .38, rx * .42, rx * .42); c.fill();
      ell(c, cx + rx * .32, cy + ry * .3, rx * .17, rx * .17); c.fill();
    };
    if(mood === 'happy'){
      eye(-1); eye(1);
      const mw = Math.max(3, r * .13); c.fillStyle = ink; c.beginPath(); c.arc(x, y + r * .13, mw, 0, Math.PI); c.closePath(); c.fill();
      c.fillStyle = '#FF7EB3'; c.beginPath(); c.arc(x, y + r * .13 + mw * .55, mw * .5, Math.PI, 0); c.fill();
    } else if(mood === 'scared'){
      eye(-1, .78, .7); eye(1, .78, .7);
      c.strokeStyle = ink; c.lineWidth = lw * .8; ell(c, x, y + r * .2, Math.max(2.5, r * .07), Math.max(3, r * .09)); c.stroke();
      c.fillStyle = '#8FD3FF'; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.2, r * .025); c.save(); c.translate(x + r * .62, y - r * .42);
      c.beginPath(); c.moveTo(0, -r * .14); c.quadraticCurveTo(r * .1, 0, 0, r * .07); c.quadraticCurveTo(-r * .1, 0, 0, -r * .14); c.fill(); c.stroke(); c.restore();
    } else if(mood === 'calm'){
      c.strokeStyle = ink; c.lineWidth = lw;
      for(const sg of [-1, 1]){ c.beginPath(); c.arc(x + sg * ex, y + ey + r * .06, Math.max(4, r * .15), Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      c.beginPath(); c.arc(x, y + r * .1, Math.max(3, r * .09), Math.PI * .15, Math.PI * .85); c.stroke();
    } else {
      c.strokeStyle = ink; c.lineWidth = lw;
      for(const sg of [-1, 1]){
        c.beginPath(); c.moveTo(x + sg * (ex + r * .17), y + ey - r * .2); c.lineTo(x + sg * (ex - r * .15), y + ey - r * .12); c.stroke();
        c.fillStyle = ink; c.beginPath(); c.ellipse(x + sg * ex, y + ey + r * .02, Math.max(4, r * .16), Math.max(3, r * .1), 0, 0, Math.PI); c.closePath(); c.fill();
        c.fillStyle = '#fff'; ell(c, x + sg * ex - r * .05, y + ey + r * .05, Math.max(1, r * .03), Math.max(1, r * .03)); c.fill();
      }
      c.beginPath(); c.arc(x + r * .03, y + r * .08, Math.max(4, r * .15), Math.PI * .2, Math.PI * .8); c.stroke();
    }
    /* 액세서리(흰 테두리 스티커) */
    c.lineJoin = 'round';
    if(skin.acc === 'ribbon'){
      c.save(); c.translate(x + r * .5, y - r * .82); c.rotate(.3);
      c.strokeStyle = '#fff'; c.lineWidth = cut * 1.6;
      const bow = () => { ell(c, -r * .17, 0, r * .19, r * .13, .25); ell(c, r * .17, 0, r * .19, r * .13, -.25); };
      c.beginPath(); c.moveTo(-r * .05, r * .05); c.lineTo(-r * .14, r * .26); c.moveTo(r * .05, r * .05); c.lineTo(r * .14, r * .26); c.stroke();
      ell(c, -r * .17, 0, r * .19, r * .13, .25); c.stroke(); ell(c, r * .17, 0, r * .19, r * .13, -.25); c.stroke();
      c.strokeStyle = '#E0457F'; c.lineWidth = Math.max(2, r * .06); c.beginPath(); c.moveTo(-r * .05, r * .05); c.lineTo(-r * .14, r * .26); c.moveTo(r * .05, r * .05); c.lineTo(r * .14, r * .26); c.stroke();
      c.fillStyle = '#FF5C9A'; ell(c, -r * .17, 0, r * .19, r * .13, .25); c.fill(); ell(c, r * .17, 0, r * .19, r * .13, -.25); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, -r * .2, -r * .04, r * .07, r * .035, .25); c.fill(); ell(c, r * .14, -r * .04, r * .07, r * .035, -.25); c.fill();
      c.fillStyle = '#FF8CC0'; ell(c, 0, 0, r * .075, r * .09); c.fill(); c.restore(); void bow;
    } else if(skin.acc === 'crown'){
      const cw = r * .72, ch = r * .4, cx = x - cw / 2, cy = y - r * .92 - ch * .4;
      const path = () => { c.beginPath(); c.moveTo(cx, cy + ch); c.lineTo(cx, cy + ch * .25); c.lineTo(cx + cw * .25, cy + ch * .6); c.lineTo(cx + cw * .5, cy); c.lineTo(cx + cw * .75, cy + ch * .6); c.lineTo(cx + cw, cy + ch * .25); c.lineTo(cx + cw, cy + ch); c.closePath(); };
      path(); c.strokeStyle = '#fff'; c.lineWidth = cut * 1.8; c.stroke();
      const cg = c.createLinearGradient(0, cy, 0, cy + ch); cg.addColorStop(0, '#FFE27A'); cg.addColorStop(1, '#FFB21E'); path(); c.fillStyle = cg; c.fill();
      c.fillStyle = '#FF5C9A'; c.beginPath(); c.arc(x, cy + ch * .68, r * .065, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7FDDBB'; for(const sg of [-1, 1]){ c.beginPath(); c.arc(x + sg * cw * .3, cy + ch * .74, r * .04, 0, Math.PI * 2); c.fill(); }
    } else if(skin.acc === 'berry'){
      c.save(); c.translate(x, y - r * .95);
      for(const pass of [0, 1]){
        c.fillStyle = pass ? '#4CC08A' : '#fff';
        for(let i = -2; i <= 2; i++){ c.save(); c.rotate(i * .45); ell(c, 0, -r * .08, r * .06 + (pass ? 0 : cut * .8), r * .15 + (pass ? 0 : cut * .8)); c.fill(); c.restore(); }
      }
      c.restore();
    }
    c.restore();
  }

  /* 먹이·사물: 흰 테두리 스티커 + 바닥 그림자. 못 먹는 사물은 흐리게(글자 없음) */
  function drawFood(c, type, x, y, s, locked){
    c.save(); c.translate(x, y); c.globalAlpha = locked ? .3 : 1; c.lineJoin = 'round'; c.lineCap = 'round';
    const big = type === 'cupcake' || type === 'teddy' || type === 'truck';
    if(big && !locked){ c.fillStyle = 'rgba(91,48,110,.14)'; ell(c, 0, s * .95, s * .9, s * .22); c.fill(); }
    if(big){ c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, s * 1.12, 0, Math.PI * 2); c.fill(); }
    if(type === 'flake'){
      const sp = (performance.now() / 900 + x * .01) % 6.28;
      c.rotate(sp * .15);
      c.strokeStyle = '#fff'; c.lineWidth = Math.max(3.6, s * .55);
      for(let i = 0; i < 3; i++){ const a = i * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * s, Math.sin(a) * s); c.lineTo(-Math.cos(a) * s, -Math.sin(a) * s); c.stroke(); }
      c.strokeStyle = '#A27BDB'; c.lineWidth = Math.max(1.6, s * .26);
      for(let i = 0; i < 3; i++){ const a = i * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * s, Math.sin(a) * s); c.lineTo(-Math.cos(a) * s, -Math.sin(a) * s); c.stroke(); }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, s * .32, 0, Math.PI * 2); c.fill();
    } else if(type === 'crystal'){
      const gem = () => { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .75, -s * .2); c.lineTo(0, s); c.lineTo(-s * .75, -s * .2); c.closePath(); };
      gem(); c.strokeStyle = '#fff'; c.lineWidth = Math.max(3, s * .4); c.stroke();
      const gg = c.createLinearGradient(-s, -s, s, s); gg.addColorStop(0, '#D6F6FF'); gg.addColorStop(1, '#5CC4F0'); gem(); c.fillStyle = gg; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = Math.max(1, s * .1); c.beginPath(); c.moveTo(-s * .75, -s * .2); c.lineTo(s * .75, -s * .2); c.moveTo(0, -s); c.lineTo(0, s); c.stroke();
    } else if(type === 'cupcake'){
      c.fillStyle = '#FFE7A8'; c.strokeStyle = '#E8A84A'; c.lineWidth = Math.max(1.2, s * .08);
      c.beginPath(); c.moveTo(-s * .68, 0); c.lineTo(-s * .5, s * .8); c.lineTo(s * .5, s * .8); c.lineTo(s * .68, 0); c.closePath(); c.fill();
      for(const px of [-.3, 0, .3]){ c.beginPath(); c.moveTo(s * px, s * .08); c.lineTo(s * px * .85, s * .75); c.stroke(); }
      c.fillStyle = '#FFB3D1'; c.beginPath(); c.arc(-s * .35, -s * .05, s * .38, Math.PI, 0); c.arc(s * .35, -s * .05, s * .38, Math.PI, 0); c.arc(0, -s * .3, s * .42, Math.PI, 0); c.lineTo(s * .73, 0); c.lineTo(-s * .73, 0); c.closePath(); c.fill();
      c.fillStyle = '#E0457F'; c.beginPath(); c.arc(0, -s * .82, s * .17, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; [[-.3, -.2], [.25, -.35], [.05, -.1]].forEach(([a, b]) => { c.beginPath(); c.arc(s * a, s * b, Math.max(.8, s * .05), 0, Math.PI * 2); c.fill(); });
    } else if(type === 'teddy'){
      c.fillStyle = '#D9A877';
      for(const sg of [-1, 1]){ c.beginPath(); c.arc(sg * s * .58, -s * .58, s * .28, 0, Math.PI * 2); c.fill(); }
      c.beginPath(); c.arc(0, 0, s * .82, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#F5DCC0'; for(const sg of [-1, 1]){ c.beginPath(); c.arc(sg * s * .58, -s * .58, s * .14, 0, Math.PI * 2); c.fill(); }
      ell(c, 0, s * .26, s * .32, s * .24); c.fill();
      c.fillStyle = '#3B2150'; for(const sg of [-1, 1]){ c.beginPath(); c.arc(sg * s * .3, -s * .1, Math.max(1.2, s * .085), 0, Math.PI * 2); c.fill(); }
      c.beginPath(); c.arc(0, s * .17, Math.max(1.2, s * .08), 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,110,170,.45)'; for(const sg of [-1, 1]){ ell(c, sg * s * .5, s * .12, s * .12, s * .07); c.fill(); }
      c.fillStyle = '#FF5C9A'; ell(c, -s * .12, s * .62, s * .14, s * .09, .3); c.fill(); ell(c, s * .12, s * .62, s * .14, s * .09, -.3); c.fill();
    } else if(type === 'truck'){
      c.fillStyle = '#C7A6F5'; rrect(c, -s * .95, -s * .5, s * 1.25, s * .85, s * .14); c.fill();
      c.fillStyle = '#FFD3E6'; rrect(c, s * .32, -s * .22, s * .62, s * .57, s * .12); c.fill();
      c.fillStyle = '#fff'; rrect(c, s * .46, -s * .12, s * .3, s * .22, s * .05); c.fill();
      c.fillStyle = '#FF8CC0'; for(let i = 0; i < 5; i++){ c.beginPath(); c.arc(-s * .85 + i * s * .26, -s * .5, s * .13, 0, Math.PI); c.fill(); }
      c.fillStyle = '#FFF3BF'; rrect(c, -s * .75, -s * .28, s * .8, s * .26, s * .06); c.fill();
      c.fillStyle = '#3B2150'; for(const px of [-s * .55, s * .55]){ c.beginPath(); c.arc(px, s * .42, s * .17, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#fff'; for(const px of [-s * .55, s * .55]){ c.beginPath(); c.arc(px, s * .42, s * .06, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
  }
  function drawGold(c, x, y, s){
    const t = now();
    c.save(); c.translate(x, y + Math.sin(t * 2.4) * s * .08);
    c.fillStyle = 'rgba(255,212,59,.28)'; c.beginPath(); c.arc(0, 0, s * 1.7 + Math.sin(t * 5) * s * .15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, s * .35, s * .7 + 3, 0, Math.PI * 2); c.arc(0, -s * .55, s * .48 + 3, 0, Math.PI * 2); c.fill();
    const gg = c.createLinearGradient(0, -s, 0, s); gg.addColorStop(0, '#FFF0A8'); gg.addColorStop(1, '#FFB21E');
    c.fillStyle = gg; c.beginPath(); c.arc(0, s * .35, s * .7, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(0, -s * .55, s * .48, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3A2A00'; for(const sg of [-1, 1]){ c.beginPath(); c.arc(sg * s * .17, -s * .6, Math.max(1.2, s * .07), 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#FF7EB3'; ell(c, -s * .3, -s * .45, s * .08, s * .05); c.fill(); ell(c, s * .3, -s * .45, s * .08, s * .05); c.fill();
    for(let i = 0; i < 3; i++){ const a = t * 1.5 + i * 2.09, d = s * 1.45; c.fillStyle = '#fff'; star(c, Math.cos(a) * d, Math.sin(a) * d, s * .2, s * .08); c.fill(); }
    c.restore();
  }

  function relation(me, q){
    const ratio = Math.sqrt(q.mass / me.mass);
    return { k:ratio >= RULE.ABSORB_RATIO ? 'danger' : ratio <= 1 / RULE.ABSORB_RATIO ? 'prey' : 'same', ratio };
  }
  function pill(c, x, y, text, bg, fg, icon){
    c.font = '700 12px "Noto Sans KR", system-ui, sans-serif';
    const tw = c.measureText(text).width, w = tw + (icon ? 26 : 16), h = 20;
    c.fillStyle = '#fff'; rrect(c, x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4, 12); c.fill();
    c.fillStyle = bg; rrect(c, x - w / 2, y - h / 2, w, h, 10); c.fill();
    c.fillStyle = fg; c.strokeStyle = fg; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
    const ix = x - w / 2 + 10, iy = y;
    c.beginPath();
    if(icon === 'prey'){ c.moveTo(ix - 4, iy - 2); c.lineTo(ix, iy + 2); c.lineTo(ix + 4, iy - 2); c.stroke(); }
    else if(icon === 'same'){ c.moveTo(ix - 4, iy - 2.5); c.lineTo(ix + 4, iy - 2.5); c.moveTo(ix - 4, iy + 2.5); c.lineTo(ix + 4, iy + 2.5); c.stroke(); }
    else if(icon === 'danger'){ c.moveTo(ix, iy - 5); c.lineTo(ix + 5, iy + 4); c.lineTo(ix - 5, iy + 4); c.closePath(); c.stroke(); c.fillRect(ix - .9, iy - 1.5, 1.8, 3); }
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(text, x - w / 2 + (icon ? 19 : 8), y + .5);
  }

  /* ---------------- 화면 ---------------- */
  function draw(){
    const c = S.ctx; if(!c) return;
    const W = S.W, H = S.H;
    c.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
    const me = S.me, focus = me.alive ? me : (S.deathInfo ? S.deathInfo.p : me);
    const tz = zoomFor(radiusOf(Math.max(focus.mass, 20)));
    S.cam.z += (tz - S.cam.z) * .08; S.cam.x += (focus.x - S.cam.x) * .2; S.cam.y += (focus.y - S.cam.y) * .2;
    const z = S.cam.z, O = toScreen(0, 0);
    /* 바닥: 우유 크림 + 스프링클(설탕 가루) 무늬, 맵 끝은 바느질 테두리 */
    c.fillStyle = '#F1E2F6'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#FFF5F9'; c.beginPath(); c.arc(O.x, O.y, WORLD_R * z, 0, Math.PI * 2); c.fill();
    const CELL = 150, SPR = ['#FFB3D1', '#A8E6CF', '#CDB8F5', '#FFE08A', '#9FD8FF'];
    const wx0 = S.cam.x - S.W / 2 / z, wy0 = S.cam.y - midY() / z, wx1 = S.cam.x + S.W / 2 / z, wy1 = S.cam.y + (S.H - midY()) / z;
    c.save(); c.beginPath(); c.arc(O.x, O.y, WORLD_R * z, 0, Math.PI * 2); c.clip(); c.lineCap = 'round';
    const sl = Math.max(3, 11 * z), sw = Math.max(1.6, 4 * z);
    for(let i = Math.floor(wx0 / CELL); i <= Math.ceil(wx1 / CELL); i++) for(let j = Math.floor(wy0 / CELL); j <= Math.ceil(wy1 / CELL); j++){
      const h = Math.abs((i * 73856093) ^ (j * 19349663)) % 1000;
      const px = (i + (h % 97) / 97) * CELL, py = (j + ((h * 7) % 89) / 89) * CELL, p = toScreen(px, py), a2 = h * .37;
      c.strokeStyle = SPR[h % 5]; c.globalAlpha = .55; c.lineWidth = sw;
      c.beginPath(); c.moveTo(p.x - Math.cos(a2) * sl / 2, p.y - Math.sin(a2) * sl / 2); c.lineTo(p.x + Math.cos(a2) * sl / 2, p.y + Math.sin(a2) * sl / 2); c.stroke();
      if(h % 3 === 0){ const q = toScreen(px + CELL * .45, py + CELL * .3); c.fillStyle = SPR[(h + 2) % 5]; c.beginPath(); c.arc(q.x, q.y, Math.max(1.4, 3 * z), 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1; c.restore();
    if(S.safeR < WORLD_R){
      c.save(); c.beginPath(); c.arc(O.x, O.y, WORLD_R * z, 0, Math.PI * 2); c.arc(O.x, O.y, S.safeR * z, 0, Math.PI * 2, true); c.fillStyle = 'rgba(255,176,120,.36)'; c.fill('evenodd'); c.restore();
      c.strokeStyle = '#FF8A3D'; c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = -now() * 20; c.beginPath(); c.arc(O.x, O.y, S.safeR * z, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    c.strokeStyle = '#E3CCF2'; c.lineWidth = Math.max(10, 30 * z); c.beginPath(); c.arc(O.x, O.y, WORLD_R * z + c.lineWidth / 2, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, 4 * z); c.setLineDash([Math.max(6, 18 * z), Math.max(5, 14 * z)]); c.beginPath(); c.arc(O.x, O.y, WORLD_R * z + Math.max(10, 30 * z) / 2, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    const lv = snLv(me.mass), pad = 60;
    for(const f of S.foods){
      if(!f.alive) continue; const p = toScreen(f.x, f.y);
      if(p.x < -pad || p.x > W + pad || p.y < -pad || p.y > H + pad) continue;
      const F = FOOD[f.type], s = Math.max(f.type === 'flake' ? 6 : f.type === 'crystal' ? 8 : 10, F.r * z), lock = lv < F.lv;
      drawFood(c, f.type, p.x, p.y, s, lock);   /* 아직 못 먹는 사물은 흐리게만(필요 레벨은 아래 칩에만 표시) */
    }
    if(S.gold){ const p = toScreen(S.gold.x, S.gold.y); drawGold(c, p.x, p.y, Math.max(10, 22 * z)); }
    const list = S.players.filter(p => p.alive).sort((a, b) => a.mass - b.mass);
    const tags = [];   /* 이름표는 공을 다 그린 뒤 맨 위에(큰 공에 가리지 않게) */
    for(const p of list){
      const s = toScreen(p.x, p.y), r = radiusOf(p.mass) * z;
      if(s.x < -r - 80 || s.x > W + r + 80 || s.y < -r - 80 || s.y > H + r + 80) continue;
      if(p.me){
        drawBall(c, s.x, s.y, r, p.skin, 'happy', p.stickers, { color:'#3B2150', width:3 }, p.invuln > 0, { vx:p.vx, vy:p.vy, vmax:maxSpeed(radiusOf(p.mass)), seed:0 });
        tags.push(() => pill(c, s.x, s.y - r - (p.skin.acc === 'ribbon' ? .3 * r : 0) - 24, `나 Lv ${snLv(p.mass)}`, '#3B2150', '#fff', null));
      } else {
        const rel = me.alive ? relation(me, p) : { k:'same', ratio:1 }, R = REL[rel.k];
        drawBall(c, s.x, s.y, r, p.skin, R.mood, p.stickers, { color:R.ring, width:R.w, pulse:rel.k === 'danger' }, p.invuln > 0, { vx:p.vx, vy:p.vy, vmax:maxSpeed(radiusOf(p.mass)), seed:p.seed || (p.seed = seedOf(p.name)) });
        tags.push(() => pill(c, s.x, s.y - r - (p.skin.acc === 'crown' || p.skin.acc === 'cat' ? .45 * r : .2 * r) - 16, `Lv ${snLv(p.mass)}  ×${rel.ratio.toFixed(2)}`, R.pill, R.fg, rel.k));
      }
    }
    for(const f of tags) f();
    for(const f of S.floats){
      const p = toScreen(f.x, f.y), yy = p.y - radiusOf(me.mass) * z - 50 - f.t * 40;
      c.globalAlpha = 1 - f.t / 1.4; c.font = '22px Jua, "Noto Sans KR", sans-serif'; c.textAlign = 'center';
      c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = '#fff'; c.strokeText(f.text, p.x, yy); c.fillStyle = f.color; c.fillText(f.text, p.x, yy); c.globalAlpha = 1;
    }
    /* 화면 밖: 위험 상대 + 황금 눈사람 */
    if(me.alive){
      const arrows = [];
      for(const q of S.players){
        if(!q.alive || q.me || relation(me, q).k !== 'danger') continue;
        const d = Math.hypot(q.x - me.x, q.y - me.y); if(d > 1400) continue;
        arrows.push({ x:q.x, y:q.y, d, txt:`Lv ${snLv(q.mass)} · ${Math.round(d * .02)}m`, bg:'#FF8A3D', fg:'#2A1300' });
      }
      arrows.sort((u, v) => u.d - v.d); arrows.length = Math.min(arrows.length, 2);   /* 가까운 위험 2개만(화면이 덮이지 않게) */
      if(S.gold){ const d = Math.hypot(S.gold.x - me.x, S.gold.y - me.y); arrows.push({ x:S.gold.x, y:S.gold.y, txt:`황금 눈사람 · ${Math.round(d * .02)}m`, bg:'#FFD43B', fg:'#3A2A00' }); }
      const top = S.safeTop, bot = H - S.safeBot;
      for(const a of arrows){
        const p = toScreen(a.x, a.y); if(p.x > 0 && p.x < W && p.y > top && p.y < bot) continue;
        const cx = W / 2, cy = (top + bot) / 2, dx = p.x - cx, dy = p.y - cy;
        const k = Math.min((W / 2 - 18) / Math.abs(dx || 1e-6), ((bot - top) / 2 - 10) / Math.abs(dy || 1e-6));
        const ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx);
        c.save(); c.translate(ax, ay); c.rotate(ang); c.fillStyle = a.bg; c.strokeStyle = a.fg; c.lineWidth = 1.5; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -8); c.lineTo(-6, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
        c.font = '900 11px "Noto Sans KR", sans-serif'; const tw = c.measureText(a.txt).width + 14;
        let lx = ax - Math.cos(ang) * (tw / 2 + 16); const ly = ay - Math.sin(ang) * 22; lx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, lx));
        c.fillStyle = a.bg; rrect(c, lx - tw / 2, ly - 10, tw, 20, 8); c.fill(); c.fillStyle = a.fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(a.txt, lx, ly + .5);
      }
    }
  }

  function hud(dt){
    S.hudT -= dt; if(S.hudT > 0) return; S.hudT = .1;
    const me = S.me, lv = snLv(me.mass), cur = massFor(lv), nx = massFor(Math.min(RULE.MAX_LV, lv + 1));
    const q = sel => $s(sel);
    q('.sn-lv').textContent = lv; q('.sn-dia').textContent = meters(me.mass).toFixed(1) + 'm'; q('.sn-mass').textContent = Math.round(me.mass).toLocaleString();
    const frac = lv >= RULE.MAX_LV ? 1 : (me.mass - cur) / (nx - cur);
    q('.sn-bar i').style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%';
    q('.sn-next').innerHTML = lv >= RULE.MAX_LV ? '<b>최대 레벨</b>' : `Lv ${lv + 1}까지 <b>${Math.ceil(nx - me.mass).toLocaleString()}</b>`;
    q('.sn-frac').textContent = `${Math.round(me.mass).toLocaleString()} / ${Math.round(nx).toLocaleString()}`;
    const left = Math.max(0, RULE.MATCH - S.t), mm = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    let html;
    if(S.battle){
      const alive = S.players.filter(p => p.alive).sort((a, b) => b.mass - a.mass), mi = alive.indexOf(me);
      const rows = alive.slice(0, 5).map((p, i) => [i + 1, p]); if(mi >= 5) rows.push([mi + 1, me]);
      html = `<div class="sn-bh"><span>${mm} 남음</span><span>생존 ${alive.length}/${S.total}</span></div>` + rows.map(([k, p]) => {
        let bg = '#FF8CC0', fg = '#3B2150';
        if(!p.me){ const r = REL[me.alive ? relation(me, p).k : 'same']; bg = r.pill; fg = r.fg; }
        return `<div class="sn-br"><span class="k">${k}</span><span class="n${p.me ? ' me' : ''}">${esc(p.name)}</span><span class="chip" style="background:${bg};color:${fg}">Lv ${snLv(p.mass)}</span></div>`;
      }).join('');
    } else {
      const st = starOf(lv), goal = st >= 3 ? '★★★ 확보' : st === 2 ? '다음 ★★★ Lv 25' : st === 1 ? '다음 ★★ Lv 18' : '첫 ★ Lv 10';
      html = `<div class="sn-bh"><span>${mm} 남음</span><span>솔로</span></div><div class="sn-st">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></div><div class="sn-g">${goal}</div><div class="sn-g">최고 Lv ${snLv(me.peak)}</div>`;
    }
    q('.sn-board').innerHTML = html;
    const ban = q('.sn-ban');
    if(S.t >= RULE.SUNRISE_AT){ ban.hidden = false; ban.textContent = me.alive && Math.hypot(me.x, me.y) > S.safeR ? '햇볕 구역! 녹고 있어요 −3%/초' : `해돋이 진행 중 · 안전 구역 ${Math.round(S.safeR / WORLD_R * 100)}%`; }
    else if(S.t >= RULE.SUNRISE_WARN){ ban.hidden = false; ban.textContent = `해돋이 ${Math.ceil(RULE.SUNRISE_AT - S.t)}초 후 · 맵이 좁아져요`; }
    else if(me.invuln > 0){ ban.hidden = false; ban.textContent = `부활 무적 ${me.invuln.toFixed(1)}초`; }
    else ban.hidden = true;
    for(const el of q('.sn-chips').children){
      const F = FOOD[el.dataset.t], ok = lv >= F.lv; el.classList.toggle('locked', !ok);
      el.querySelector('b').textContent = ok ? `+${F.mass}` : `Lv ${F.lv}`;
    }
    const nl = CHIPS.map(([t]) => FOOD[t]).find(F => lv < F.lv);
    q('.sn-unlock').textContent = nl ? `다음 해금: ${nl.label} · ${nl.lv - lv}레벨 남음` : '모든 사물 해금!';
    const melt = me.idle ? '<b class="d">멈춰서 녹는 중</b>' : '멈추면 조금씩 녹아요';
    if(S.battle && me.alive){
      let pr = 0, sm = 0, dg = 0;
      for(const o of S.players){ if(!o.alive || o.me || Math.hypot(o.x - me.x, o.y - me.y) > 1200) continue; const k = relation(me, o).k; if(k === 'prey') pr++; else if(k === 'danger') dg++; else sm++; }
      q('.sn-status').innerHTML = `<span>근처 <b class="p">사냥 ${pr}</b> · 비슷 ${sm} · <b class="d">위험 ${dg}</b></span><span>${melt}</span>`;
    } else q('.sn-status').innerHTML = `<span>황금 눈사람 ${S.gold ? '등장!' : Math.max(0, Math.ceil(S.nextGold - S.t)) + '초 후'}</span><span>${melt}</span>`;
    const bb = q('.sn-boost'); bb.disabled = me.mass <= RULE.BOOST_MIN; bb.classList.toggle('on', !!me.boosting);
    mini();
  }
  function mini(){
    const m = $s('.sn-mini'), c = m.getContext('2d'), Z = m.width, me = S.me, k = Z / 2 / WORLD_R;
    c.clearRect(0, 0, Z, Z);
    c.fillStyle = '#FFD9C2'; c.beginPath(); c.arc(Z / 2, Z / 2, Z / 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#FFF5F9'; c.beginPath(); c.arc(Z / 2, Z / 2, S.safeR * k, 0, Math.PI * 2); c.fill();
    if(S.gold){ c.fillStyle = '#FFD43B'; c.strokeStyle = '#3A2A00'; c.lineWidth = 2; c.beginPath(); c.arc(Z / 2 + S.gold.x * k, Z / 2 + S.gold.y * k, 6, 0, Math.PI * 2); c.fill(); c.stroke(); }
    for(const q of S.players){
      if(!q.alive || q.me) continue; const r = me.alive ? relation(me, q).k : 'same';
      c.fillStyle = r === 'danger' ? '#FF8A3D' : r === 'prey' ? '#2E8BE6' : '#A898B8';
      c.beginPath(); c.arc(Z / 2 + q.x * k, Z / 2 + q.y * k, Math.max(3.5, radiusOf(q.mass) * k * 1.5), 0, Math.PI * 2); c.fill();
    }
    if(me.alive){ c.fillStyle = '#FF5C9A'; c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(Z / 2 + me.x * k, Z / 2 + me.y * k, Math.max(6, radiusOf(me.mass) * k * 1.5), 0, Math.PI * 2); c.fill(); c.stroke(); }
  }

  /* ---------------- 판 화면 붙이기 (#stage) ---------------- */
  function render(st){
    st.innerHTML = `<div class="snb">
      <canvas class="sn-cv" aria-label="스노우볼 맵"></canvas>
      <div class="sn-top">
        <div class="sn-me sn-pan">
          <div class="sn-row"><div class="sn-l" aria-label="크기 레벨"><small>Lv</small><b class="sn-lv">1</b></div>
            <div class="sn-meta"><span>지름 <b class="sn-dia">0.5m</b></span><span>질량 <b class="sn-mass">20</b></span></div></div>
          <div class="sn-bar"><i></i></div>
          <div class="sn-bf"><span class="sn-next"></span><span class="sn-frac"></span></div>
        </div>
        <div class="sn-board sn-pan"></div>
      </div>
      <div class="sn-ban" hidden></div>
      <div class="sn-bot sn-pan">
        <div class="sn-cap"><span>지금 먹을 수 있는 것</span><span class="sn-unlock"></span></div>
        <div class="sn-chips">${CHIPS.map(([t, l]) => `<div class="sn-chip" data-t="${t}"><canvas width="44" height="44"></canvas><span>${l}</span><b></b></div>`).join('')}</div>
        <div class="sn-ctl"><div class="sn-joy" role="slider" aria-label="이동 레버: 끌어서 방향 정하기"><i class="sn-knob"></i></div>
          <div class="sn-mid"><div class="sn-status"></div><canvas class="sn-mini" width="144" height="144" aria-label="미니맵"></canvas></div>
          <button class="sn-boost" type="button" aria-label="부스트"><span>부스트</span><small>질량 −20/초</small></button></div>
      </div>
      <div class="snb-rv" hidden><div class="rv-box"><canvas class="rv-ball" width="192" height="208" aria-hidden="true"></canvas><b class="rv-t">흡수됐어요</b><div class="rv-n"><span>5</span></div><p class="rv-d"></p>
        <div class="rv-b"><button class="rv-btn rv-no" type="button">결과 보기</button><button class="rv-btn rv-yes" type="button">광고 보고 부활</button></div></div></div>
    </div>`;
    S.root = st.querySelector('.snb');
    const cv = S.root.querySelector('.sn-cv'); S.cv = cv; S.ctx = cv.getContext('2d');
    for(const el of S.root.querySelector('.sn-chips').children){ const c = el.querySelector('canvas').getContext('2d'); c.scale(2, 2); drawFood(c, el.dataset.t, 11, 11, el.dataset.t === 'truck' ? 9.5 : 8, false); }
    const size = () => {
      const top = S.root.getBoundingClientRect().top + (window.scrollY || 0);
      const h = Math.max(420, window.innerHeight - top - 6);
      S.root.style.height = h + 'px';
      S.DPR = Math.min(2, window.devicePixelRatio || 1);
      S.W = S.root.clientWidth; S.H = h;
      cv.width = Math.round(S.W * S.DPR); cv.height = Math.round(S.H * S.DPR);
      S.safeTop = (S.root.querySelector('.sn-top').offsetHeight || 120) + 44;   /* 화살표 이름표가 순위표 밑으로 숨지 않게 */
      S.safeBot = (S.root.querySelector('.sn-bot').offsetHeight || 170) + 10;
    };
    size(); S.cam.z = zoomFor(radiusOf(20));
    /* 입력 */
    const M = S.mouse, rect = () => cv.getBoundingClientRect();
    const pos = e => { const r = rect(); M.x = e.clientX - r.left; M.y = e.clientY - r.top; M.active = true; M.last = 'mouse'; };
    cv.addEventListener('pointermove', e => { if(e.pointerType === 'mouse'){ pos(e); S.joy.cruise = false; } });
    /* 이동 레버(하단): 끌면 그 방향으로, 많이 끌수록 빠르게. 손을 떼도 마지막 방향으로 계속 굴러감 */
    const joy = S.root.querySelector('.sn-joy'), knob = joy.querySelector('.sn-knob'), J = S.joy;
    let jid = null;
    const jmove = e => {
      const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width * .34;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
      if(d > max){ dx = dx / d * max; dy = dy / d * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      if(d > 6){ J.dx = dx / Math.min(d, max); J.dy = dy / Math.min(d, max); const l = Math.hypot(J.dx, J.dy) || 1; J.dx /= l; J.dy /= l; J.thr = Math.min(1, .35 + .65 * Math.min(d, max) / max); }
      else J.thr = 0;
    };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; J.on = true; M.last = 'joy'; try{ joy.setPointerCapture(jid); }catch(_){} jmove(e); e.preventDefault(); });
    joy.addEventListener('pointermove', e => { if(J.on && e.pointerId === jid) jmove(e); });
    const jup = e => { if(e.pointerId !== jid) return; J.on = false; jid = null; knob.style.transform = ''; if(J.thr > 0){ J.cruise = true; J.thr = 1; } };
    joy.addEventListener('pointerup', jup); joy.addEventListener('pointercancel', jup);
    joy.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
    cv.addEventListener('pointerleave', () => { if(M.last === 'mouse') M.active = false; });
    cv.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
    const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
    const kd = e => { if(!G || G.over || G.id !== ID || document.body.classList.contains('modal-open')) return;
      if(e.code === 'Space'){ S.boostHeld = true; e.preventDefault(); }
      if(KEYS.includes(e.code)){ S.keys[e.code] = true; M.last = 'key'; S.joy.cruise = false; e.preventDefault(); } };
    const ku = e => { if(e.code === 'Space') S.boostHeld = false; S.keys[e.code] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('resize', size);
    const bb = S.root.querySelector('.sn-boost');
    bb.addEventListener('pointerdown', e => { S.boostHeld = true; e.stopPropagation(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => bb.addEventListener(t, () => { S.boostHeld = false; }));
    S.root.querySelector('.rv-yes').onclick = () => { fx(() => sfx('snGold')); doRevive(); };
    S.root.querySelector('.rv-no').onclick = () => { if(S.reviveLeft > 0 && S.deathInfo){ const w = S.deathInfo.why; closeRevive(); endWith(w); } };
    /* 루프 */
    const me = G;
    const loop = now => {
      if(G !== me) return;
      const dt = Math.min(.05, (now - (S.lt || now)) / 1000); S.lt = now;
      try{
        if(!me.over && !me.paused && !S.end){
          step(dt);
          if(S.reviveLeft > 0 && !S.end){
            S.reviveLeft -= dt; const n = $s('.rv-n'); if(n){ n.querySelector('span').textContent = Math.max(0, Math.ceil(S.reviveLeft)); n.style.setProperty('--p', Math.max(0, S.reviveLeft / RULE.REVIVE_WINDOW).toFixed(3)); }
            if(S.reviveLeft <= 0 && S.deathInfo){ const w = S.deathInfo.why; closeRevive(); endWith(w); }
          }
          if(!S.end) hud(dt);
        }
        draw();
      }catch(err){ console.error(err); }
      me.raf = requestAnimationFrame(loop);
    };
    me.raf = requestAnimationFrame(loop);
    me.cleanup = () => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', size); cancelAnimationFrame(me.raf); };
  }

  /* ---------------- 게임 정의 ---------------- */
  const LV = { easy:{ limit:0, food:1.2 }, normal:{ limit:0, food:1 }, hard:{ limit:0, food:.85 } };
  const stageFood = n => Math.max(.7, Math.round((1.15 - (n - 1) * .01) * 100) / 100);
  /* 디자인 v2: 우유빛 반투명 판 + 진보라 글자. 핑크는 '내 성장'(레벨 배지·막대·부스트·레버)에만 */
  const css = `
.snb{--ink:#3B2150; --sub:#6E5A82; --pk:#E0457F; --pk2:#FF8CC0; --line:#F0DCEB; --milk:rgba(255,255,255,.9);
  position:relative; width:100%; min-height:420px; border-radius:24px; overflow:hidden; background:#FFF5F9; color:var(--ink); touch-action:none; user-select:none; -webkit-user-select:none}
.snb .sn-cv{position:absolute; inset:0; width:100%; height:100%; display:block}
.snb .sn-pan{background:var(--milk); color:var(--ink); border-radius:20px; box-shadow:0 0 0 2px #fff, 0 5px 0 rgba(91,48,110,.10); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px)}
.snb .sn-top{position:absolute; left:10px; right:10px; top:10px; display:flex; gap:8px; align-items:flex-start; pointer-events:none}
.snb .sn-me{flex:0 1 220px; min-width:0; padding:9px 12px 10px 9px; display:flex; flex-direction:column; gap:7px}
.snb .sn-row{display:flex; align-items:center; gap:10px}
.snb .sn-l{width:54px; height:54px; flex:none; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1;
  background:radial-gradient(circle at 35% 28%, #FF9CC6, #E0457F 70%); color:#fff; box-shadow:0 0 0 3px #fff, 0 4px 0 #B8306A}
.snb .sn-l small{font-family:var(--disp); font-size:12px; opacity:.9}
.snb .sn-l b{font-family:var(--disp); font-weight:400; font-size:27px; font-variant-numeric:tabular-nums}
.snb .sn-meta{display:flex; flex-direction:column; gap:1px; font-size:11px; color:var(--sub)}
.snb .sn-meta b{color:var(--ink); font-family:var(--disp); font-weight:400; font-size:16px}
.snb .sn-bar{height:12px; border-radius:999px; background:#F6E3EF; overflow:hidden; position:relative; box-shadow:inset 0 2px 0 rgba(91,48,110,.08)}
.snb .sn-bar i{position:absolute; left:0; top:0; bottom:0; border-radius:999px; transition:width .15s;
  background:repeating-linear-gradient(-45deg, #FF8CC0 0 7px, #FFA9D0 7px 14px); box-shadow:inset 0 2px 0 rgba(255,255,255,.55)}
.snb .sn-bf{display:flex; justify-content:space-between; font-size:10.5px; color:var(--sub)}
.snb .sn-bf b{color:var(--pk)}
.snb .sn-board{margin-left:auto; width:150px; padding:9px 10px 8px; display:flex; flex-direction:column; gap:4px; font-size:11.5px}
.snb .sn-bh{display:flex; justify-content:space-between; color:var(--sub); font-size:10.5px; font-weight:700; padding-bottom:2px; border-bottom:2px dotted var(--line)}
.snb .sn-br{display:flex; align-items:center; gap:5px}
.snb .sn-br .k{min-width:18px; white-space:nowrap; color:var(--sub); font-family:var(--disp); font-size:13px}
.snb .sn-br .n{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.snb .sn-br .n.me{font-weight:900; color:var(--pk)}
.snb .sn-br .chip{font-family:var(--disp); font-size:12px; padding:0 6px; border-radius:7px; box-shadow:0 0 0 1.5px #fff}
.snb .sn-st{font-family:var(--disp); font-size:24px; color:#FFB21E; letter-spacing:2px; line-height:1.1; text-shadow:0 2px 0 #fff}
.snb .sn-st i{font-style:normal; color:#E9DDF0}
.snb .sn-g{color:var(--sub)}
.snb .sn-ban{position:absolute; left:50%; top:140px; transform:translateX(-50%); padding:6px 14px; border-radius:999px; font-size:12.5px; font-weight:900; white-space:nowrap; background:#FF8A3D; color:#2A1300; box-shadow:0 0 0 3px #fff, 0 4px 0 rgba(180,85,15,.35); pointer-events:none}
.snb .sn-ban[hidden]{display:none}
.snb .sn-bot{position:absolute; left:0; right:0; bottom:0; padding:10px 12px 12px; border-radius:26px 26px 0 0; display:flex; flex-direction:column; gap:8px}
.snb .sn-cap{display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:11.5px; font-weight:700}
.snb .sn-cap span:first-child{color:var(--sub)}
.snb .sn-unlock{color:var(--pk); text-align:right}
.snb .sn-chips{display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:6px}
.snb .sn-chip{background:#FFF0F6; border-radius:14px; padding:4px 3px 3px; display:flex; flex-direction:column; align-items:center; gap:0; font-size:10px; color:var(--ink); box-shadow:inset 0 0 0 2px #FFE0EE}
.snb .sn-chip canvas{width:20px; height:20px}
.snb .sn-chip b{font-family:var(--disp); font-weight:400; font-size:13px; color:var(--pk)}
.snb .sn-chip.locked{background:#F7F2FA; box-shadow:inset 0 0 0 2px #E6DAF0; color:#9A86AE}
.snb .sn-chip.locked canvas{opacity:.4; filter:grayscale(1)}
.snb .sn-chip.locked b{color:#9A86AE; font-family:var(--font); font-size:10px; font-weight:700}
.snb .sn-ctl{display:flex; align-items:center; gap:10px}
.snb .sn-joy{position:relative; width:112px; height:112px; border-radius:50%; flex:none; touch-action:none; cursor:grab;
  background:radial-gradient(circle, #FBF1F7 0 56%, #F3E2EE 57%); box-shadow:inset 0 0 0 3px #fff, inset 0 4px 0 rgba(91,48,110,.08), 0 0 0 2px var(--line)}
.snb .sn-joy::before{content:''; position:absolute; inset:15px; border-radius:50%; border:2px dashed #E6CFE0}
.snb .sn-joy::after{content:''; position:absolute; inset:6px; border-radius:50%;
  background:conic-gradient(from -8deg, #D9BCD0 0 16deg, transparent 0 90deg, #D9BCD0 0 106deg, transparent 0 180deg, #D9BCD0 0 196deg, transparent 0 270deg, #D9BCD0 0 286deg, transparent 0);
  -webkit-mask:radial-gradient(circle, transparent 0 44px, #000 45px 47px, transparent 48px); mask:radial-gradient(circle, transparent 0 44px, #000 45px 47px, transparent 48px)}
.snb .sn-knob{position:absolute; left:50%; top:50%; width:54px; height:54px; margin:-27px 0 0 -27px; border-radius:50%; z-index:1; pointer-events:none; transition:transform .06s;
  background:radial-gradient(circle at 34% 28%, #fff 0 12%, #FFC2DD 38%, #FF7EB3 100%); box-shadow:0 0 0 3px #fff, 0 6px 0 rgba(184,48,106,.45)}
.snb .sn-mid{flex:1; min-width:0; display:flex; flex-direction:column; align-items:flex-start; gap:6px}
.snb .sn-mini{width:58px; height:58px; border-radius:50%; flex:none; background:#FFF5F9; box-shadow:0 0 0 3px #fff, 0 0 0 5px var(--line)}
.snb .sn-status{width:100%; min-width:0; display:flex; flex-direction:column; gap:2px; font-size:10.5px; line-height:1.35; color:var(--sub)}
.snb .sn-status b.p{color:#1F6FC4} .snb .sn-status b.d{color:#B4550F}
.snb .sn-boost{width:84px; height:84px; border-radius:50%; border:0; color:var(--ink); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; flex:none; touch-action:none; font-family:var(--font);
  background:radial-gradient(circle at 34% 28%, #fff 0 10%, #FFC2DD 36%, #FF8CC0 100%); box-shadow:0 0 0 3px #fff, 0 6px 0 #C2347A; transition:transform .06s, box-shadow .06s}
.snb .sn-boost span{font-family:var(--disp); font-size:17px} .snb .sn-boost small{font-size:9.5px; font-weight:700}
.snb .sn-boost.on{transform:translateY(4px); box-shadow:0 0 0 3px #fff, 0 2px 0 #C2347A}
.snb .sn-boost:disabled{opacity:.5; filter:grayscale(.6)}
.snb .sn-boost:focus-visible{outline:3px solid #6A3FC0; outline-offset:3px}
.snb .snb-rv{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(59,33,80,.38)}
.snb .snb-rv[hidden]{display:none}
.snb .rv-box{width:100%; max-width:330px; background:#fff; color:var(--ink); border-radius:28px; padding:18px 20px 20px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; box-shadow:0 0 0 4px #FFE0EE, 0 8px 0 rgba(91,48,110,.18)}
.snb .rv-ball{width:96px; height:104px}
.snb .rv-t{font-family:var(--disp); font-weight:400; font-size:23px}
.snb .rv-n{position:relative; width:74px; height:74px; display:grid; place-items:center; font-family:var(--disp); font-size:38px; color:var(--pk); border-radius:50%;
  background:conic-gradient(var(--pk2) calc(var(--p, 1) * 360deg), #F6E3EF 0); }
.snb .rv-n::before{content:''; position:absolute; inset:7px; border-radius:50%; background:#fff}
.snb .rv-n span{position:relative}
.snb .rv-d{margin:0; font-size:13px; color:var(--sub); line-height:1.5}
.snb .rv-b{width:100%; display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px}
.snb .rv-b button{min-height:52px; border-radius:18px; font-family:var(--disp); font-size:17px; border:0; text-shadow:none}
.snb .rv-b .rv-no{background:#F6EEF8; color:var(--ink); box-shadow:0 4px 0 #E2D3EA} .snb .rv-b .rv-yes{background:radial-gradient(circle at 34% 28%, #FFC2DD, #FF7EB3); color:var(--ink); box-shadow:0 4px 0 #C2347A}
@media (max-width:380px){ .snb .sn-board{width:130px} .snb .sn-me{flex-basis:200px} }
@media (prefers-reduced-motion:reduce){ .snb .sn-bar i, .snb .sn-knob, .snb .sn-boost{transition:none} }`;

  return {
    name:'스노우볼', col:['#FFC2DD', '#E0457F', '#3B2150'], time:'3분', abil:'전략력',
    modes:['solo', 'duel'],
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="13.5" r="8.5"/><path d="M15.5 3.2c1.6-.9 3.6-.4 3.3 1.3-.1.9-1 1.4-2 1.3l-1.5.9-.6-1.7z" opacity=".75"/><circle cx="9" cy="12.5" r="1.3" fill="#fff"/><circle cx="15" cy="12.5" r="1.3" fill="#fff"/></svg>',
    art(){
      const u = 'snA' + (++SVG_UID);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <radialGradient id="${u}a" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#FFD3E6"/><stop offset="1" stop-color="#FF9CC6"/></radialGradient>
        <radialGradient id="${u}b" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#E3D0FF"/><stop offset="1" stop-color="#A77BEA"/></radialGradient>
        <radialGradient id="${u}c" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#D2F7EA"/><stop offset="1" stop-color="#7FDDBB"/></radialGradient></defs>
        <rect width="160" height="100" fill="#FFF3F8"/><ellipse cx="40" cy="80" rx="60" ry="22" fill="#F6E6FF"/><ellipse cx="130" cy="20" rx="50" ry="18" fill="#F6E6FF"/>
        ${[[24, 22], [62, 14], [140, 70], [104, 88], [12, 70], [150, 40]].map(([x, y]) => `<path d="M${x - 4} ${y}h8M${x - 2} ${y - 3.5}l4 7M${x + 2} ${y - 3.5}l-4 7" stroke="#8E63C9" stroke-width="1.8" stroke-linecap="round"/>`).join('')}
        <circle cx="120" cy="46" r="27" fill="url(#${u}b)" stroke="#FF8A3D" stroke-width="3"/><path d="M106 22l3-9 5 6 5-8 5 8 5-6 3 9z" fill="#FFC93C"/>
        <path d="M108 42l7 2M132 42l-7 2" stroke="#2A1240" stroke-width="2.4" stroke-linecap="round"/><path d="M110 46a5 3 0 0 0 9 0zM122 46a5 3 0 0 0 9 0z" fill="#2A1240"/><path d="M115 55q5 4 10 0" fill="none" stroke="#2A1240" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="34" cy="44" r="12" fill="url(#${u}c)" stroke="#2E8BE6" stroke-width="2.5"/><circle cx="30" cy="43" r="1.8" fill="#2A1240"/><circle cx="38" cy="43" r="1.8" fill="#2A1240"/><ellipse cx="34" cy="49" rx="1.5" ry="2" fill="none" stroke="#2A1240" stroke-width="1.3"/>
        <circle cx="72" cy="58" r="21" fill="url(#${u}a)" stroke="#fff" stroke-width="3"/>
        <ellipse cx="65" cy="55" rx="3" ry="4" fill="#2A1240"/><ellipse cx="79" cy="55" rx="3" ry="4" fill="#2A1240"/><circle cx="64" cy="53.5" r="1.2" fill="#fff"/><circle cx="78" cy="53.5" r="1.2" fill="#fff"/>
        <path d="M68 62a4 4 0 0 0 8 0z" fill="#2A1240"/><ellipse cx="60" cy="62" rx="3.4" ry="1.8" fill="#FF7EB3" opacity=".6"/><ellipse cx="84" cy="62" rx="3.4" ry="1.8" fill="#FF7EB3" opacity=".6"/>
        <g transform="translate(82 38) rotate(18)"><ellipse cx="-4" cy="0" rx="5" ry="3.4" fill="#FF5C9A"/><ellipse cx="4" cy="0" rx="5" ry="3.4" fill="#FF5C9A"/><circle r="2" fill="#FF8CC0"/></g></svg>`;
    },
    help:[
      ['아래 레버로 굴려요', '왼쪽 아래 레버를 끌면 그 방향으로 굴러가고, 많이 끌수록 빨라요. 손을 떼도 마지막 방향으로 계속 굴러가요. (PC는 마우스·방향키도 돼요) 눈송이 +1 · 반짝 결정 +8 · 컵케이크 +25(Lv 5) · 곰인형 +60(Lv 10) · 푸드트럭 +150(Lv 18). 아래 줄에 지금 먹을 수 있는 것이 보여요.'],
      ['멈추면 녹아요', '레버를 가운데에 잡고 있으면 멈추고, 멈추면 초마다 0.5%씩 녹아요. 부스트(스페이스·버튼)는 1.8배 빠르지만 질량을 초당 20 써요. 질량이 15 아래로 녹으면 사라져요.'],
      ['상대는 링과 표정으로', '지름이 1.2배 이상 크면 상대를 꿀꺽(질량 70% 획득)! 파란 링·겁먹은 얼굴 = 먹을 수 있음, 회색 = 비슷(부딪히면 튕김), 주황 링·자신만만 = 위험. 머리 위 ×숫자는 나와의 크기 비율이에요.'],
      ['3분과 해돋이', '2:00부터 해가 떠서 1분 동안 맵이 30%까지 좁아져요. 햇볕(주황) 구역에선 초마다 3%씩 녹아요. 솔로는 3:00에 끝난 순간 레벨로 별, 대전은 1명 남거나 3:00에 끝나요.']
    ],
    helpExtra:() => S && S.battle ? [['대전 판정', `나 + 봇 ${RULE.BOTS}명. 흡수당하거나 녹으면 탈락, 2:00 전 탈락이면 5초 안에 한 번 부활(질량 30%, 3초 무적). 순위는 늦게 탈락할수록 높고, 끝까지 남으면 질량 순. ${RULE.WIN_RANK}위 안에 들면 승리예요.`]] : [],
    chapters:['딸기 언덕', '민트 숲', '레몬 광장', '복숭아 마을', '포도 성'],
    starRule:'3:00 끝난 순간 레벨: ★ Lv 10 · ★★ Lv 18 · ★★★ Lv 25 (Lv 30이면 바로 퍼펙트)',
    levels:LV,
    levelDesc:lv => ({ easy:'먹이 많음', normal:'보통', hard:'먹이 적음' })[lv] || '보통',
    stage:n => ({ limit:0, food:stageFood(n) }),
    stageDesc:n => `먹이 양 ${Math.round(stageFood(n) * 100)}% · 3분 동안 Lv 10 / 18 / 25`,
    init(cfg, rng, lv){ init(cfg, rng, lv); },
    render:st => render(st),
    progress(){ if(!S) return 0; return S.battle ? Math.min(1, (S.t || 0) / RULE.MATCH) : Math.min(1, snLv(S.me.mass) / RULE.STAR[2]); },
    lossText(){
      if(!S) return '판이 시작되지 않았어요.';
      const E = S.end;
      if(S.battle) return E ? `${S.total}명 중 ${E.rank}위 · ${E.why}. 최고 Lv ${E.peakLv}, 흡수 ${S.me.kills}명.` : `최고 Lv ${snLv(S.me.peak)}까지 컸어요.`;
      if(E && E.reason === 'time') return `3:00까지 Lv ${E.lv}이었어요. 별을 받으려면 끝날 때 Lv 10이 필요해요.`;
      return `녹아서 사라졌어요. 최고 Lv ${snLv(S.me.peak)}까지 컸어요.`;
    },
    score(){
      const me = S ? S.me : null, E = S && S.end;
      const st = E ? (E.stars || 0) : me ? starOf(snLv(me.mass)) : 0, m = me ? Math.round(me.mass) : 0;
      const bonus = E && E.reason === 'perfect' ? Math.round(Math.max(0, RULE.MATCH - S.t) * 10) : 0;
      return { base:500, time:Math.min(350, Math.floor(m / 20) + Math.min(200, Math.floor(bonus / 10))), extra:st * 50,
        rows:[E ? E.why : '완주', `크기 보너스 (질량 ${fmt(m)} ÷ 20, 최대 350)`, `별 ${st}개 × 50`] };
    },
    stars(){ const E = S && S.end; if(E && E.stars) return E.stars; return S ? Math.max(1, starOf(snLv(S.me.mass))) : 1; },
    winTitle:'잘 컸어요!', loseTitle:'이번 판은 아쉬워요', bodyClass:'snmode',
    duelHow:`나 + 봇 ${RULE.BOTS}명 배틀로열 · ${RULE.WIN_RANK}위 안이면 승리`,
    /* 스노우볼 대전은 따로 진행(30명 배틀로열). fleet:true = "게임이 대전을 직접 진행" */
    duelLaunch(){ startGame(ID, 'normal', { duel:{ fleet:true, mode:'ai', opp:{ nick:`봇 ${RULE.BOTS}명` } } }); },
    css,
    sounds:{
      snEat(){ aMarimba(m2f(81), { v:.07 }); },
      snGold(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(76 + d), { t:i * .05, v:.1 })); },
      snGulp(){ aThump({ f:180, f2:70, d:.16, v:.22 }); aMarimba(m2f(72), { t:.05, v:.1 }); },
      snPop(){ aTone({ f:520, f2:180, type:'triangle', d:.3, v:.09 }); }
    },
    gate:{ snEat:70 },
    _rules:{ RULE, massFor, snLv, starOf }   /* 점검용 */
  };
})();
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임에 영향 없음 */
NG.snowball.scene = { kind:'motes', colors:['#FFD3E6', '#E3D0FF', '#FFFFFF'], density:.5 };
