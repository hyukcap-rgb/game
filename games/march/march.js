/* ---------- 행군대작전: 관문으로 병력을 키워 적 부대·보스를 뚫는 행군 게임 (games/march) ----------
   - 솔로: 스테이지마다 새 기믹, 3의 배수 스테이지는 보스전. 결승선 통과·보스 격파 = 클리어, 병력 0 = 실패
   - 대전: 나와 라이벌(봇)이 같은 씨앗의 똑같은 길을 동시에 행군. 먼저 전멸하면 패배, 2:00까지 둘 다 살면 병력 많은 쪽 승리
   그림: games/march/img/*.webp (Figma AI로 만든 오리지널 그림, 배경 제거)
   판·적·봇 판단은 모두 씨앗 rng(S.rng)로만. 효과(흔들림·연기)는 S.vr(씨앗에서 나눈 보이기 전용 줄)로. Math.random은 쓰지 않는다. */
NG.march = (() => {
  const ID = 'march';
  const RULE = {
    SPEED:24, BATTLE_TIME:120, BATTLE_START:10, ARROW_RANGE:58, BOSS_EVERY:3,
    STAR_SOLO:[.4, .7], STAR_BOSS:[.3, .55]   /* 남은 병력 ÷ 최대 병력: ★★ · ★★★ */
  };
  const NEWS = {
    1:['기본 관문', '+는 더하고 −는 빼요. 좋은 숫자 쪽으로 이동하세요. 파란 +판 줄은 지나갈 때마다 병사가 늘어요.'],
    2:['적 부대', '빨간 부대와 부딪히면 서로 병력을 잃어요. 다가오는 동안 화살이 먼저 줄여 줘요.'],
    3:['보스 · 몽둥이 거인', '내려찍기로 병사를 쓸어내요. 화살과 돌격으로 쓰러뜨리세요.'],
    4:['곱셈 관문', '×는 병력을 배로, ÷는 반으로 만들어요.'],
    5:['회전 톱날', '좌우로 움직이는 톱날에 닿으면 병사를 잃어요. 틈을 노려 지나가세요.'],
    6:['보스 · 방패 기사', '방패를 든 동안엔 피해가 거의 안 들어가요. 방패를 내릴 때가 기회예요.'],
    7:['성장 관문', '마이너스 관문도 줄 서서 쏘면 숫자가 1씩 올라가요. 일찍 줄을 서세요.'],
    8:['적 궁수탑', '길가의 탑이 병사를 저격해요. 화살로 먼저 부수세요.'],
    9:['보스 · 주술사', '졸개를 부르고 발밑에 독 웅덩이를 깔아요. 초록 원에서 비켜나세요.'],
    10:['움직이는 관문', '관문 숫자가 좌우로 자리를 바꿔요. 지나가는 순간을 맞추세요.'],
    11:['성문', '길을 막은 성문은 부숴야 지나갈 수 있어요.'],
    12:['보스 · 화염 용', '붉게 표시된 쪽에 불을 뿜어요. 반대쪽으로 피하세요.']
  };
  const NEWF = { 2:'crowd', 4:'mul', 5:'saw', 7:'grow', 8:'tower', 10:'move', 11:'door' };
  const KIND = {
    brute:{ name:'몽둥이 거인', hpk:6.5 }, knight:{ name:'방패 기사', hpk:5 },
    shaman:{ name:'주술사', hpk:4.6 }, dragon:{ name:'화염 용', hpk:5.6 }
  };
  const BOSS_ORDER = ['brute', 'knight', 'shaman', 'dragon'];
  const RIVALS = ['철벽 민수', '돌격대장 하나', '궁수왕 지훈', '행군의 달인', '성문지기 소라', '붉은 깃발 태오'];
  const feat = d => ({ crowd:d >= 2, mul:d >= 4, saw:d >= 5, grow:d >= 7, tower:d >= 8, move:d >= 10, door:d >= 11 });
  const isBossStage = n => n % RULE.BOSS_EVERY === 0;
  const bossKindFor = n => BOSS_ORDER[(n / RULE.BOSS_EVERY - 1) % 4];
  const startN = n => 5 + Math.min(25, n);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fx = f => { try{ f(); }catch(_){} };
  function mul32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- 그림 ---------- */
  let BASE = 'games/march/img/';
  try{ if(/\/embed\/[^/]*$/.test(location.pathname)) BASE = '../games/march/img/'; }catch(_){}
  const IMGF = { soldier:'soldier.webp', enemy:'enemy.webp', brute:'brute.webp', knight:'knight.webp', shaman:'shaman.webp', dragon:'dragon.webp',
    tower:'tower.webp', stone:'stone.jpg', gateB:'gateB.webp', gateR:'gateR.webp', door:'door.webp', saw:'saw.webp' };
  const IMG = {};
  function loadImgs(){ if(IMG.soldier) return; for(const k in IMGF){ const im = new Image(); im.decoding = 'async'; im.src = BASE + IMGF[k]; IMG[k] = im; } }
  const ok = im => im && im.complete && im.naturalWidth > 0;
  let STRIP = null;
  function getStrip(){
    if(STRIP) return STRIP; if(!ok(IMG.stone)) return null;
    const s = document.createElement('canvas'); s.width = 1024; s.height = 256; const x = s.getContext('2d');
    for(let i = 0; i < 4; i++) x.drawImage(IMG.stone, i * 256, 0, 256, 256);
    x.fillStyle = 'rgba(255,240,210,.12)'; x.fillRect(0, 0, 1024, 256);
    return STRIP = s;
  }

  /* ---------- 관문 계산 ---------- */
  function applyOp(n, o){ if(o.op === '+') return n + o.v; if(o.op === '-') return n - o.v; if(o.op === '×') return n * o.v; if(o.op === '÷') return Math.ceil(n / o.v); return n; }
  function opText(o){ if(o.op === '+') return (o.v >= 0 ? '+' : '−') + Math.abs(Math.round(o.v)); if(o.op === '-') return '−' + o.v; return o.op + o.v; }
  const opGood = o => (o.op === '+' && o.v >= 0) || o.op === '×';

  /* ---------- 길 만들기(대전은 두 부대가 같은 길을 나눠 씀) ---------- */
  function newGen(rng, mode, stage, sN){ return { rng, items:[], z:40, E:sN, mode, stage, seg:0, nextBoss:620, bossN:0, ended:false, lastT:'', firstGate:false }; }
  const gD = g => g.mode === 'solo' ? g.stage : Math.min(14, 1 + Math.floor(g.z / 220));
  function extendGen(g, toZ){ while(!g.ended && g.z < toZ) genSeg(g); }
  function genSeg(g){
    const r = g.rng, d = gD(g), f = feat(d), R = (a, b) => a + (b - a) * r();
    const nf = g.mode === 'solo' ? NEWF[d] : null;
    if(g.mode === 'solo'){
      if(g.seg >= 9 + Math.min(d, 12)){
        if(isBossStage(d)){
          const kind = bossKindFor(d), hp = Math.round(KIND[kind].hpk * g.E + 60 + d * 12);
          g.items.push({ t:'boss', z:g.z + 30, x:0, kind, hp, max:hp, final:true, d, minion:Math.round(g.E * .22 + 4), t1:0, t2:0, sc:0 });
        } else g.items.push({ t:'finish', z:g.z + 20 });
        g.ended = true; return;
      }
    } else if(g.z >= g.nextBoss){
      const kind = BOSS_ORDER[g.bossN % 4], hp = Math.round(KIND[kind].hpk * g.E * .85 + 60 + d * 10);
      g.items.push({ t:'boss', z:g.z + 20, x:0, kind, hp, max:hp, final:false, d, minion:Math.round(g.E * .2 + 4), t1:0, t2:0, sc:0 });
      g.bossN++; g.nextBoss = g.z + 760; g.z += 70; g.E *= .75; return;
    }
    const even = g.seg % 2 === 0; g.seg++;
    const haz = [];
    if(f.crowd) haz.push('crowd', 'crowd');
    if(f.saw) haz.push('saw');
    if(f.tower) haz.push('tower');
    if(f.door && g.lastT !== 'door') haz.push('door');
    let t;
    if(even || !haz.length) t = r() < .7 ? 'gate' : 'col';
    else if(nf && ['crowd', 'saw', 'tower', 'door'].includes(nf) && r() < .55) t = nf;
    else t = haz[Math.floor(r() * haz.length)];
    g.lastT = t;
    const E = g.E;
    if(t === 'gate'){
      const grow = f.grow && r() < (nf === 'grow' ? .6 : .25);
      const moving = !grow && f.move && r() < (nf === 'move' ? .6 : .25);
      const addV = Math.round(R(5, 13) + d * 3 + E * .16);
      let ops;
      if(grow){
        const a = { op:'+', v:-Math.round(R(2, 6) + d * .6 + E * .05) }, b = { op:'+', v:-Math.round(R(8, 14) + d * 1.5 + E * .15) };
        ops = r() < .5 ? [a, b] : [b, a];
        g.E = Math.max(5, E + addV * .5);
      } else {
        let good, bad;
        if(f.mul && E < 220 && r() < (nf === 'mul' ? .6 : .3)) good = { op:'×', v:r() < .75 ? 2 : 3 };
        else good = { op:'+', v:addV };
        const br = r();
        if(br < .3) bad = { op:'+', v:Math.max(1, Math.round(addV * R(.2, .5))) };
        else if(f.mul && br < .55) bad = { op:'÷', v:2 };
        else bad = { op:'-', v:Math.min(Math.round(R(4, 10) + d * 2.5 + E * .25), Math.round(E * .7) + 2) };
        if(!g.firstGate){ g.firstGate = true; bad = { op:'+', v:Math.max(1, Math.round(addV * .4)) }; }   /* 첫 관문은 둘 다 플러스(가만히 있어도 안 죽게) */
        ops = r() < .5 ? [good, bad] : [bad, good];
        g.E = Math.max(E, applyOp(E, good) * .93);
      }
      g.items.push({ t:'gate', z:g.z, ops, grow, moving, used:false });
      g.z += 52;
    } else if(t === 'col'){
      const n = 5 + Math.floor(R(0, 6)), k = 1 + Math.floor(d / 4);
      g.items.push({ t:'col', z:g.z, x:(r() < .5 ? -1 : 1) * R(14, 32), n, k, step:7, got:[] });
      g.E += n * k * .8; g.z += n * 7 + 26;
    } else if(t === 'crowd'){
      const n = Math.round(E * R(.5, .95) + 2 + d * .6);
      g.items.push({ t:'crowd', z:g.z, x:R(-26, 26), n, max:n });
      g.E = Math.max(5, E - Math.max(0, n - .5 * E)); g.z += 52;
    } else if(t === 'saw'){
      const two = d >= 9 && r() < .5;
      g.items.push({ t:'saw', z:g.z, x0:R(-18, 18), amp:R(16, 30), sp:R(1.3, 2.4), ph:R(0, 6), x:0, r:6 });
      if(two) g.items.push({ t:'saw', z:g.z + 16, x0:R(-18, 18), amp:R(16, 30), sp:R(1.3, 2.4), ph:R(0, 6), x:0, r:6 });
      g.E *= .9; g.z += two ? 56 : 40;
    } else if(t === 'tower'){
      const side = r() < .5 ? -1 : 1, hp = Math.round(12 + d * 5), rate = Math.max(.45, .9 - d * .03), dmg = 1 + Math.floor(d / 6);
      g.items.push({ t:'tower', z:g.z, x:side * 45, hp, max:hp, rate, dmg, tt:0 });
      if(d >= 10 && r() < .5) g.items.push({ t:'tower', z:g.z + 14, x:-side * 45, hp, max:hp, rate, dmg, tt:.3 });
      g.E = Math.max(5, E - 4 - d); g.z += 40;
    } else if(t === 'door'){
      const hp = Math.round(E * 1.2 + 30 + d * 5);
      g.items.push({ t:'door', z:g.z, hp, max:hp });
      g.E *= .95; g.z += 46;
    }
  }

  /* ---------- 부대 하나(나·라이벌) ---------- */
  let UID = 0;
  function newRun(gen, n, isMe, rng){
    return { gen, idx:0, ents:[], arrows:[], earrows:[], fx:[], z:0, prevZ:0, x:0, tx:0, N:n, peak:n, time:0, rng,
      dead:false, done:false, win:false, deathTime:null, isMe, fireT:0, ai:{}, bossActive:null, halted:false, shake:0, kills:0, bossKills:0, lastBoss:null };
  }
  const armyR = n => 3 * Math.sqrt(Math.min(Math.max(n, 1), 120)) * .85 + 2;
  const crowdR = n => 2.9 * Math.sqrt(Math.min(Math.max(n, 1), 90)) * .85 + 2;
  const effOps = (e, run) => e.moving && Math.floor(run.time / 1.5) % 2 ? [e.ops[1], e.ops[0]] : e.ops;
  function addFx(run, f){ if(run.fx.length < 80) run.fx.push(Object.assign({ t:0 }, f)); }
  function hurt(run, k, text){
    if(k <= 0) return;
    run.N -= k;
    if(text) addFx(run, { k:'txt', x:run.x, z:run.z + 2, text:'−' + Math.max(1, Math.round(k)), col:'#ff5a4f', life:1 });
  }
  function bossDmg(e, a){ if(e.kind === 'knight' && e.shield) a *= .15; e.hp -= a; e.hitT = .12; }
  const snd = k => fx(() => { if(S && S.mine) sfx(k); });

  function step(run, dt){
    if(run.dead || run.done) return;
    const g = run.gen, rr = run.rng; run.time += dt; S.cur = run;
    extendGen(g, run.z + 340);
    while(run.idx < g.items.length && g.items[run.idx].z < run.z + 240){
      const c = JSON.parse(JSON.stringify(g.items[run.idx++])); c.id = ++UID;
      if(g.mode === 'solo'){   /* 솔로는 실제 내 병력에 맞춰 적 크기·성문·보스 체력을 줄여 줌(생성기의 기대 병력보다 적을 때) */
        if(c.t === 'crowd') c.n = c.max = Math.max(3, Math.round(Math.min(c.n, run.N * .9 + 3 + g.stage * .5)));
        if(c.t === 'boss'){ c.hp = c.max = Math.round(Math.min(c.hp, KIND[c.kind].hpk * Math.max(run.N, 12) * 1.05 + 60 + c.d * 12)); c.minion = Math.max(4, Math.round(Math.min(c.minion, run.N * .2 + 4))); }
        if(c.t === 'door') c.hp = c.max = Math.round(Math.min(c.hp, run.N * 1.3 + 30 + g.stage * 5));
      }
      run.ents.push(c);
    }
    if(!run.isMe) aiThink(run);
    else if(S.keyDir) run.tx = clamp(run.tx + S.keyDir * 85 * dt, -44, 44);
    run.x += clamp(run.tx - run.x, -100 * dt, 100 * dt);
    run.x = clamp(run.x, -44, 44);
    const R = armyR(run.N);
    let haltZ = Infinity, fighting = false;
    run.bossActive = null;
    for(const e of run.ents){
      if(e.t === 'crowd' && e.n > 0){
        const dz = e.z - run.z;
        if(dz < 60 && dz > -3){ e.x += clamp(run.x - e.x, -12 * dt, 12 * dt); e.z -= 7 * dt; }
        const er = crowdR(e.n);
        if(Math.abs(e.z - run.z) < R * .5 + er * .5 + 2 && Math.abs(run.x - e.x) < R + er - 2){
          fighting = true;
          const k = Math.min((5 + .7 * Math.min(run.N, e.n)) * dt, e.n, run.N);
          e.n -= k; hurt(run, k, false); run.kills += k;
          if(S.vr() < dt * 14) addFx(run, { k:'puff', x:(run.x + e.x) / 2 + (S.vr() - .5) * R, z:run.z + R * .4, life:.4 });
          if(run.isMe && S.vr() < dt * 6) snd('mcClash');
        }
      } else if(e.t === 'door' && e.hp > 0){
        const hz = e.z - 3 - R * .5; haltZ = Math.min(haltZ, hz);
        if(run.z >= hz - .05){ e.hp -= run.N * .6 * dt; e.hitT = .08; }
      } else if(e.t === 'boss' && e.hp > 0){
        const sd = e.kind === 'shaman' ? 30 : 13, hz = e.z - sd - R * .5; haltZ = Math.min(haltZ, hz);
        if(e.z - run.z < 95){ run.bossActive = e; if(run.lastBoss !== e.id){ run.lastBoss = e.id; if(run.isMe) bossIntro(e); } }
        if(run.z >= hz - .05 && e.kind !== 'shaman') bossDmg(e, run.N * .35 * dt);
        if(e.z - run.z < 75) bossAI(run, e, dt, R);
      } else if(e.t === 'saw'){
        e.x = e.x0 + Math.sin(run.time * e.sp + e.ph) * e.amp; e.rot = (e.rot || 0) + dt * 14;
      } else if(e.t === 'tower' && e.hp > 0){
        const dz = e.z - run.z;
        if(dz > 0 && dz < 75){ e.tt += dt; if(e.tt >= e.rate){ e.tt = 0; run.earrows.push({ x0:e.x, z0:e.z, t:0, dur:.45, dmg:e.dmg }); } }
      } else if(e.t === 'puddle'){
        e.life -= dt; e.age = (e.age || 0) + dt;
        if(e.age > .8 && Math.abs(run.x - e.x) < e.r + R * .3 && Math.abs(run.z - e.z) < e.r + 2){
          hurt(run, (2 + run.N * .16) * dt, false);
          if(S.vr() < dt * 6) addFx(run, { k:'txt', x:run.x, z:run.z + 3, text:'독!', col:'#7ee05a', life:.7 });
        }
      }
      if(e.hitT) e.hitT = Math.max(0, e.hitT - dt);
    }
    run.prevZ = run.z;
    let nz = run.z + RULE.SPEED * (fighting ? .3 : 1) * dt;
    if(nz >= haltZ){ nz = Math.max(run.z, haltZ); run.halted = true; } else run.halted = false;
    run.z = nz;
    const pz = run.prevZ, z = run.z;
    for(const e of run.ents){
      if(e.t === 'gate' && !e.used && pz < e.z && z >= e.z){
        e.used = true; const side = run.x < 0 ? 0 : 1; e.hit = side;
        const o = effOps(e, run)[side], b = run.N;
        run.N = Math.max(0, applyOp(run.N, o));
        const diff = Math.round(run.N - b);
        addFx(run, { k:'txt', x:run.x, z:run.z + 3, text:(diff >= 0 ? '+' : '−') + Math.abs(diff), col:diff >= 0 ? '#ffd84a' : '#ff5a4f', life:1.1, big:1 });
        addFx(run, { k:'ring', x:run.x, z:run.z, col:diff >= 0 ? '#7fd0ff' : '#ff6a5f', life:.5 });
        if(run.isMe) snd(diff >= 0 ? 'mcUp' : 'mcDown');
      } else if(e.t === 'col'){
        for(let i = 0; i < e.n; i++){
          const p = e.z + i * e.step;
          if(!e.got[i] && pz < p && z >= p){
            e.got[i] = Math.abs(run.x - e.x) < 6 + R * .45 ? 1 : 2;
            if(e.got[i] === 1){ run.N += e.k; addFx(run, { k:'txt', x:e.x, z:p + 2, text:'+' + e.k, col:'#ffd84a', life:.8 }); if(run.isMe) snd('mcPlus'); }
          }
        }
      } else if(e.t === 'saw' && !e.done && pz < e.z && z >= e.z){
        e.done = true; const dx = Math.abs(e.x - run.x);
        if(dx < R + 4){ const frac = clamp(1 - dx / (R + 4), .15, .7) * .55; hurt(run, Math.ceil(run.N * frac), true); run.shake = .3; if(run.isMe) snd('mcSaw'); }
      } else if(e.t === 'finish' && pz < e.z && z >= e.z){ run.done = true; run.win = true; }
    }
    for(const a of run.earrows){ a.t += dt; if(a.t >= a.dur && !a.hit){ a.hit = 1; hurt(run, a.dmg, false); if(S.vr() < .5) addFx(run, { k:'txt', x:run.x, z:run.z + 2, text:'−' + a.dmg, col:'#ff5a4f', life:.6 }); } }
    run.earrows = run.earrows.filter(a => !a.hit);
    /* 우리 화살: 병력이 많을수록 빠르고 셈 */
    const rate = Math.min(2 + run.N * .25, 18), per = Math.max(1, (2 + run.N * .25) / 18);
    run.fireT -= dt;
    if(run.fireT <= 0 && run.N >= 1){
      run.fireT = 1 / rate;
      const tg = findTarget(run);
      if(tg){
        const sx = run.x + (rr() - .5) * R * 1.4, sz = run.z + (rr() - .3) * R * .6;
        let txx = tg.x, tz = tg.z, side = -1;
        if(tg.t === 'gate'){ side = run.x < 0 ? 0 : 1; txx = side ? 25 : -25; }
        else if(tg.t === 'door') txx = sx;
        else if(tg.t === 'boss') txx = (rr() - .5) * 8;
        const dist = Math.hypot(txx - sx, tz - sz);
        run.arrows.push({ sx, sz, tx:txx, tz, tg, side, t:0, dur:Math.max(.12, dist / 150), dmg:per });
      }
    }
    for(const a of run.arrows){
      a.t += dt;
      if(a.t >= a.dur && !a.hit){
        a.hit = 1; const e = a.tg;
        if(e.t === 'crowd' && e.n > 0){ const k = Math.min(e.n, a.dmg); e.n -= k; run.kills += k; }
        else if(e.t === 'tower' && e.hp > 0){ e.hp -= a.dmg; e.hitT = .1; }
        else if(e.t === 'door' && e.hp > 0){ e.hp -= a.dmg; e.hitT = .08; }
        else if(e.t === 'boss' && e.hp > 0) bossDmg(e, a.dmg);
        else if(e.t === 'gate' && !e.used){
          let s = a.side; if(e.moving && Math.floor(run.time / 1.5) % 2) s = 1 - s;
          e.ops[s].v += Math.max(1, Math.round(a.dmg)); e.pulse = e.pulse || [0, 0]; e.pulse[a.side] = .15;
        }
      }
    }
    run.arrows = run.arrows.filter(a => !a.hit);
    for(const e of run.ents){
      if(e.t === 'crowd' && e.n <= 0 && !e.gone){ e.gone = 1; addFx(run, { k:'ring', x:e.x, z:e.z, col:'#ffffff', life:.4 }); }
      if((e.t === 'tower' || e.t === 'door') && e.hp <= 0 && !e.gone){ e.gone = 1; addFx(run, { k:'boom', x:e.t === 'door' ? 0 : e.x, z:e.z, life:.6 }); if(run.isMe) snd('mcBreak'); }
      if(e.t === 'boss' && e.hp <= 0 && !e.gone){
        e.gone = 1; run.bossKills++;
        addFx(run, { k:'boom', x:0, z:e.z, life:.9, big:1 });
        addFx(run, { k:'txt', x:0, z:e.z + 8, text:'보스 격파!', col:'#ffd84a', life:1.6, big:1 });
        if(run.isMe) snd('mcBossDown');
        if(e.final){ run.done = true; run.win = true; }
      }
      if(e.pulse){ e.pulse[0] = Math.max(0, e.pulse[0] - dt); e.pulse[1] = Math.max(0, e.pulse[1] - dt); }
    }
    run.ents = run.ents.filter(e => !e.gone && !(e.t === 'puddle' && e.life <= 0) && e.z > run.z - 45);
    for(const f of run.fx) f.t += dt;
    run.fx = run.fx.filter(f => f.t < f.life);
    run.shake = Math.max(0, run.shake - dt);
    if(run.N < 1 && !run.done){ run.N = 0; run.dead = true; run.deathTime = run.time; }
    run.peak = Math.max(run.peak, run.N);
  }
  function findTarget(run){
    let best = null, bd = 1e9;
    for(const e of run.ents){
      const dz = e.z - run.z; if(dz < -2) continue;
      let can = false;
      if(e.t === 'crowd' && e.n > 0 && dz < RULE.ARROW_RANGE) can = true;
      else if((e.t === 'tower' || e.t === 'door') && e.hp > 0 && dz < 72) can = true;
      else if(e.t === 'boss' && e.hp > 0 && dz < 85) can = true;
      else if(e.t === 'gate' && e.grow && !e.used && dz < 62 && dz > 4) can = true;
      if(can && dz < bd){ bd = dz; best = e; }
    }
    return best;
  }
  function bossAI(run, e, dt, R){
    e.t1 += dt;
    if(e.kind === 'brute'){
      if(e.swing > 0) e.swing -= dt;
      if(e.t1 > 2.4 && run.halted){ e.t1 = 0; e.swing = .5; hurt(run, Math.round(2 + run.N * .08 + e.d * .3), true); run.shake = .35; addFx(run, { k:'ring', x:run.x, z:run.z, col:'#ffb347', life:.6, big:1 }); if(run.isMe) snd('mcSlam'); }
    } else if(e.kind === 'knight'){
      e.sc += dt; e.shield = (e.sc % 5.5) < 3;
      if(e.swing > 0) e.swing -= dt;
      if(e.t1 > 1.9 && run.halted){ e.t1 = 0; e.swing = .4; hurt(run, Math.round(1 + run.N * .05 + e.d * .2), true); run.shake = .2; if(run.isMe) snd('mcSlam'); }
    } else if(e.kind === 'shaman'){
      e.t2 += dt;
      if(e.t1 > 4.5){ e.t1 = 0; const n = Math.round(e.minion); run.ents.push({ t:'crowd', z:e.z - 14, x:(run.rng() - .5) * 50, n, max:n, id:++UID }); addFx(run, { k:'ring', x:0, z:e.z - 12, col:'#b07cff', life:.6, big:1 }); }
      if(e.t2 > 5 && run.halted){ e.t2 = 0; run.ents.push({ t:'puddle', z:run.z, x:run.x, r:9 + R * .3, life:4.2, id:++UID }); }
    } else if(e.kind === 'dragon'){
      if(!e.phase){ e.phase = 'idle'; e.fireN = 0; }
      if(e.phase === 'idle' && e.t1 > 3.6){ e.phase = 'tele'; e.t1 = 0; e.fireSide = run.x < 0 ? -1 : 1; e.fireN++; }
      else if(e.phase === 'tele' && e.t1 > 1.3){
        e.phase = 'fire'; e.t1 = 0;
        const inSide = e.fireSide < 0 ? run.x < 4 : run.x > -4;
        if(inSide){ hurt(run, Math.ceil(run.N * .42), true); run.shake = .45; if(run.isMe) snd('mcFire'); }
        else addFx(run, { k:'txt', x:run.x, z:run.z + 4, text:'회피!', col:'#7fd0ff', life:1, big:1 });
      } else if(e.phase === 'fire' && e.t1 > .7){ e.phase = 'idle'; e.t1 = 0; }
      e.t2 += dt; if(e.t2 > 2.2 && run.halted){ e.t2 = 0; hurt(run, Math.round(1 + run.N * .03), false); }
    }
  }

  /* ---------- 라이벌 판단(씨앗 rng) ---------- */
  function aiThink(run){
    const R = armyR(run.N), ahead = run.ents.filter(e => e.z > run.z - 3).sort((a, b) => a.z - b.z);
    for(const e of ahead){
      if(e.t === 'boss' && e.kind === 'dragon' && e.phase === 'tele'){
        const key = 'd' + e.id + '_' + e.fireN;
        if(run.ai[key] === undefined) run.ai[key] = run.rng() < .72;
        if(run.ai[key]){ run.tx = e.fireSide > 0 ? -32 : 32; return; }
      }
    }
    for(const e of ahead) if(e.t === 'puddle' && Math.abs(e.x - run.x) < e.r + R * .4 + 3){ run.tx = clamp(e.x > 0 ? e.x - e.r - R - 6 : e.x + e.r + R + 6, -44, 44); return; }
    for(const e of ahead){
      const dz = e.z - run.z; if(dz > 75) break;
      if(e.t === 'gate' && !e.used){
        const key = 'g' + e.id;
        if(run.ai[key] === undefined) run.ai[key] = run.rng() < .8;
        const ops = effOps(e, run), a = applyOp(run.N, ops[0]), b = applyOp(run.N, ops[1]);
        let side = a >= b ? 0 : 1; if(!run.ai[key]) side = 1 - side;
        run.tx = side ? 24 : -24; return;
      }
      if(e.t === 'col' && dz < 40 && dz > -e.n * e.step){ run.tx = e.x; return; }
      if(e.t === 'saw' && !e.done && dz < 30 && dz > 0 && Math.abs(e.x - run.x) < R + 9){ run.tx = e.x > 0 ? -38 : 38; return; }
      if(e.t === 'crowd' && e.n > run.N * .7 && dz < 50 && dz > 0){ run.tx = e.x > 0 ? -40 : 40; return; }
    }
  }

  /* ---------- 그리기 ---------- */
  const SUN = []; for(let i = 0; i < 130; i++){ const a = i * 2.39996, r = Math.sqrt(i); SUN.push([Math.cos(a) * r, Math.sin(a) * r * .8]); }
  const FONT = '"Black Han Sans","Jua",sans-serif';
  function roundRect(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function hpBar(c, X, Y, w, frac, col){ c.fillStyle = 'rgba(22,35,61,.75)'; roundRect(c, X - w / 2, Y, w, 6, 3); c.fill(); c.fillStyle = col; roundRect(c, X - w / 2 + 1, Y + 1, Math.max(0, (w - 2) * frac), 4, 2); c.fill(); }
  function strokeText(c, t, x, y, fill, stroke, lw){ c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = stroke; c.strokeText(t, x, y); c.fillStyle = fill; c.fillText(t, x, y); }

  function render(c, w, h, run, mini, clock){
    const F = 55, unit = Math.min(w / 108, 6.2), horizon = h * (mini ? .06 : .1), armyY = h * (mini ? .8 : .76);
    let shx = 0, shy = 0;
    if(run.shake > 0 && !mini){ shx = (S.vr() - .5) * 10 * run.shake; shy = (S.vr() - .5) * 10 * run.shake; }
    const P = (x, z) => { const d = z - run.z; if(d < -F + 6) return null; const s = F / (F + d); return { X:w / 2 + x * s * unit + shx, Y:horizon + (armyY - horizon) * s + shy, s }; };
    let gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe6ff'); gr.addColorStop(.12, '#5aa9ec'); gr.addColorStop(1, '#2f7fd6');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    if(!mini){ c.fillStyle = 'rgba(255,255,255,.18)'; for(let i = 0; i < 26; i++){ const zz = Math.floor(run.z / 9) * 9 + i * 9 - 20, px = ((i * 37) % 23) - 11; const L = P(-70 - ((i * 13) % 30), zz), Rr = P(70 + ((i * 17) % 30), zz); if(L) c.fillRect(L.X + px * L.s, L.Y, 10 * L.s * unit * .4, 1.5); if(Rr) c.fillRect(Rr.X + px * Rr.s, Rr.Y, 10 * Rr.s * unit * .4, 1.5); } }
    const quad = (x1, x2, z1, z2, col) => { const a = P(x1, z1), b = P(x2, z1), cc = P(x2, z2), d = P(x1, z2); if(!a || !b || !cc || !d) return; c.fillStyle = col; c.beginPath(); c.moveTo(a.X, a.Y); c.lineTo(b.X, b.Y); c.lineTo(cc.X, cc.Y); c.lineTo(d.X, d.Y); c.closePath(); c.fill(); };
    const z0 = Math.floor((run.z - 40) / 6) * 6, zEnd = run.z + 235, strip = getStrip();
    for(let zz = z0; zz < zEnd; zz += 6){
      const alt = (Math.round(zz / 6) % 2 + 2) % 2;
      if(!strip) quad(-50, 50, zz, zz + 6.05, alt ? '#eadcc2' : '#e2d2b5');
      quad(-58, -50, zz, zz + 6.05, alt ? '#cdb489' : '#bfa577');
      quad(50, 58, zz, zz + 6.05, alt ? '#cdb489' : '#bfa577');
      if(alt){ quad(-58, -54, zz + .5, zz + 5.5, '#e6d2a6'); quad(54, 58, zz + .5, zz + 5.5, '#e6d2a6'); }
    }
    if(strip){
      for(let Y = Math.floor(horizon); Y < h; Y += 2){
        const s = (Y - horizon) / (armyY - horizon); if(s <= .03) continue;
        const zz = run.z + F / s - F, hw = 50 * s * unit, v = Math.min(255, Math.floor(((zz * 10.24) % 256 + 256) % 256));
        c.drawImage(strip, 0, v, 1024, 1, w / 2 - hw + shx, Y + shy, hw * 2, 2.6);
      }
      const a = P(-50, run.z - 30), b = P(-50, zEnd), a2 = P(50, run.z - 30), b2 = P(50, zEnd);
      if(a && b && a2 && b2){ c.strokeStyle = 'rgba(90,60,20,.28)'; c.lineWidth = 4; c.beginPath(); c.moveTo(a.X + 2, a.Y); c.lineTo(b.X + 1, b.Y); c.moveTo(a2.X - 2, a2.Y); c.lineTo(b2.X - 1, b2.Y); c.stroke(); }
    }
    gr = c.createLinearGradient(0, horizon, 0, horizon + h * .12); gr.addColorStop(0, 'rgba(191,230,255,.95)'); gr.addColorStop(1, 'rgba(191,230,255,0)'); c.fillStyle = gr; c.fillRect(0, horizon - 2, w, h * .12);
    for(const e of run.ents){
      if(e.t === 'puddle'){
        const p = P(e.x, e.z); if(!p) continue;
        c.fillStyle = (e.age || 0) > .8 ? 'rgba(110,210,70,.55)' : 'rgba(110,210,70,.22)';
        c.beginPath(); c.ellipse(p.X, p.Y, e.r * p.s * unit, e.r * p.s * unit * .5, 0, 0, 7); c.fill();
        c.strokeStyle = 'rgba(60,140,30,.8)'; c.lineWidth = 2; c.stroke();
      }
      if(e.t === 'boss' && e.kind === 'dragon' && (e.phase === 'tele' || e.phase === 'fire') && e.hp > 0){
        const x1 = e.fireSide < 0 ? -50 : -4, x2 = e.fireSide < 0 ? 4 : 50;
        if(e.phase === 'tele'){ const a = .18 + .18 * Math.sin(clock * 18); quad(x1, x2, run.z - 30, e.z, 'rgba(255,40,30,' + a.toFixed(2) + ')'); }
        else quad(x1, x2, run.z - 30, e.z, 'rgba(255,140,30,.55)');
      }
      if(e.t === 'col') quad(e.x - 6.5, e.x + 6.5, e.z - 4, e.z + e.n * e.step, 'rgba(255,200,61,.25)');
    }
    const list = [];
    for(const e of run.ents){
      if(e.t === 'col'){ for(let i = e.n - 1; i >= 0; i--) list.push({ z:e.z + i * e.step, f:() => drawPanel(c, P, e, i, mini) }); }
      else if(e.t !== 'puddle') list.push({ z:e.z, f:() => drawEnt(c, P, unit, e, run, mini, clock) });
    }
    list.push({ z:run.z, army:1, f:() => drawArmy(c, P, unit, run.x, run.z, run.N, false, clock, mini) });
    list.sort((a, b) => b.z - a.z || (a.army ? 1 : -1));
    for(const it of list) it.f();
    c.lineCap = 'round';
    for(const a of run.arrows){
      const k = a.t / a.dur, x = a.sx + (a.tx - a.sx) * k, z = a.sz + (a.tz - a.sz) * k, arc = Math.sin(k * Math.PI) * 6, k2 = Math.max(0, k - .12);
      const p = P(x, z), q = P(a.sx + (a.tx - a.sx) * k2, a.sz + (a.tz - a.sz) * k2);
      if(!p || !q) continue;
      c.strokeStyle = 'rgba(190,230,255,.7)'; c.lineWidth = Math.max(1, 2.4 * p.s);
      c.beginPath(); c.moveTo(q.X, q.Y - arc * q.s * unit * .8); c.lineTo(p.X, p.Y - arc * p.s * unit * .8); c.stroke();
      c.fillStyle = '#5a3a20'; c.beginPath(); c.arc(p.X, p.Y - arc * p.s * unit * .8, Math.max(1, 1.6 * p.s), 0, 7); c.fill();
    }
    for(const a of run.earrows){
      const k = a.t / a.dur, p = P(a.x0 + (run.x - a.x0) * k, a.z0 + (run.z - a.z0) * k); if(!p) continue;
      c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(p.X, p.Y - 5 * p.s * unit * Math.sin(k * Math.PI), Math.max(1.5, 2.2 * p.s), 0, 7); c.fill();
    }
    for(const f of run.fx){
      const p = P(f.x, f.z); if(!p) continue; const k = f.t / f.life;
      if(f.k === 'txt'){
        if(mini && !f.big) continue;
        const sz = (f.big ? 30 : 20) * (mini ? .45 : 1);
        c.font = sz + 'px ' + FONT; c.textAlign = 'center'; c.globalAlpha = 1 - k * k;
        strokeText(c, f.text, p.X, p.Y - 24 * p.s - k * 40 * (mini ? .4 : 1), f.col, '#16233d', sz * .18); c.globalAlpha = 1;
      } else if(f.k === 'ring'){
        c.strokeStyle = f.col; c.globalAlpha = 1 - k; c.lineWidth = 3;
        const r = (f.big ? 30 : 14) * p.s * unit * (.4 + k); c.beginPath(); c.ellipse(p.X, p.Y, r, r * .5, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
      } else if(f.k === 'puff'){
        c.fillStyle = 'rgba(255,255,255,' + (.8 * (1 - k)).toFixed(2) + ')'; c.beginPath(); c.arc(p.X, p.Y - 3 * p.s * unit, (2 + k * 4) * p.s * unit, 0, 7); c.fill();
      } else if(f.k === 'boom'){
        const r = (f.big ? 26 : 14) * p.s * unit * (.3 + k);
        c.fillStyle = 'rgba(255,200,70,' + (.8 * (1 - k)).toFixed(2) + ')'; c.beginPath(); c.arc(p.X, p.Y - r * .4, r, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,' + (.7 * (1 - k)).toFixed(2) + ')'; c.beginPath(); c.arc(p.X, p.Y - r * .4, r * .5, 0, 7); c.fill();
      }
    }
  }
  function soldier(c, X, Y, sz, red, bob){
    const im = red ? IMG.enemy : IMG.soldier;
    c.fillStyle = 'rgba(40,30,10,.18)'; c.beginPath(); c.ellipse(X, Y, sz, sz * .38, 0, 0, 7); c.fill();
    if(ok(im)){ const hh = sz * (red ? 3.7 : 3.9), ww = hh * im.naturalWidth / im.naturalHeight; c.drawImage(im, X - ww / 2, Y - hh - bob + sz * .25, ww, hh); return; }
    c.fillStyle = red ? '#e2403a' : '#2f7be8'; c.beginPath(); c.ellipse(X, Y - sz * 1.4 - bob, sz * .85, sz * 1.1, 0, 0, 7); c.fill();
    c.fillStyle = red ? '#a92723' : '#1a4ea8'; c.beginPath(); c.arc(X, Y - sz * 2.4 - bob, sz * .7, 0, 7); c.fill();
  }
  function drawArmy(c, P, unit, x, z, N, red, clock, mini){
    const n = Math.min(Math.ceil(N), mini ? 45 : 120); if(n <= 0) return;
    const sp = red ? 2.9 * .85 : 3 * .85, pts = [];
    for(let i = 0; i < n; i++){ const s = SUN[i]; pts.push([x + s[0] * sp, z + s[1] * sp, i]); }
    pts.sort((a, b) => b[1] - a[1]);
    for(const q of pts){ const p = P(q[0], q[1]); if(!p) continue; soldier(c, p.X, p.Y, 2.05 * p.s * unit, red, mini ? 0 : Math.abs(Math.sin(clock * 9 + q[2])) * 1.6 * p.s); }
    const top = P(x, z + (red ? crowdR(N) : armyR(N)) * .75); if(!top) return;
    const label = String(Math.ceil(N)), fs = mini ? 11 : Math.max(14, 22 * top.s);
    c.font = fs + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tw = c.measureText(label).width + fs * .9, ty = top.Y - 8.6 * top.s * unit - fs * .4;
    c.fillStyle = red ? '#a92723' : '#1a4ea8'; roundRect(c, top.X - tw / 2, ty - fs * .65, tw, fs * 1.3, fs * .65); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.fillText(label, top.X, ty + 1); c.textBaseline = 'alphabetic';
  }
  function drawPanel(c, P, e, i, mini){
    if(e.got[i] === 1) return;
    const a = P(e.x - 7, e.z + i * e.step), b = P(e.x + 7, e.z + i * e.step); if(!a || !b) return;
    const bw = b.X - a.X, im = IMG.gateB; if(!ok(im)) return;
    const hh = bw * im.naturalHeight / im.naturalWidth;
    c.globalAlpha = e.got[i] === 2 ? .45 : 1;
    c.drawImage(im, a.X, a.Y - hh, bw, hh);
    if(!mini || a.s > .6){ const fs = Math.max(9, hh * .34); c.font = fs + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; strokeText(c, '+' + e.k, (a.X + b.X) / 2, a.Y - hh * .57, '#fff', '#0f3a85', fs * .2); c.textBaseline = 'alphabetic'; }
    c.globalAlpha = 1;
  }
  function drawEnt(c, P, unit, e, run, mini, clock){
    if(e.t === 'gate'){
      const ops = effOps(e, run);
      for(let sd = 0; sd < 2; sd++){
        const a = P(sd ? 2 : -49, e.z), b = P(sd ? 49 : -2, e.z); if(!a || !b) continue;
        const o = ops[sd], good = opGood(o), im = good ? IMG.gateB : IMG.gateR, bw = b.X - a.X;
        c.globalAlpha = e.used ? (e.hit === sd ? .25 : .5) : 1;
        let hh, ty;
        if(ok(im)){
          hh = bw * im.naturalHeight / im.naturalWidth;
          c.fillStyle = 'rgba(40,30,10,.2)'; c.beginPath(); c.ellipse((a.X + b.X) / 2, a.Y, bw * .5, 4 * a.s, 0, 0, 7); c.fill();
          c.drawImage(im, a.X, a.Y - hh, bw, hh);
          if(e.pulse && e.pulse[sd]){ c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(a.X + bw * .14, a.Y - hh * .8, bw * .72, hh * .47); }
          ty = a.Y - hh * .57;
        } else { hh = 15 * a.s * unit; c.fillStyle = good ? '#2f7be8' : '#e2403a'; c.fillRect(a.X, a.Y - hh, bw, hh * .9); ty = a.Y - hh * .45; hh *= 1.6; }
        const fs = Math.max(10, hh * .3), tx = (a.X + b.X) / 2;
        c.font = fs + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
        strokeText(c, opText(o), tx, ty, '#fff', good ? '#0f3a85' : '#7a1410', fs * .2);
        c.textBaseline = 'alphabetic';
        if((e.grow || e.moving) && !mini && !e.used){ const ls = Math.max(13, fs * .42); c.font = ls + 'px ' + FONT; strokeText(c, e.grow ? '쏘면 +1' : '⇄ 이동', tx, a.Y - hh - ls * .3, '#ffd84a', '#16233d', ls * .22); }
        c.globalAlpha = 1;
      }
    } else if(e.t === 'crowd' && e.n > 0){
      drawArmy(c, P, unit, e.x, e.z, e.n, true, clock, mini);
    } else if(e.t === 'saw'){
      const g1 = P(-50, e.z), g2 = P(50, e.z); if(g1 && g2){ c.fillStyle = 'rgba(90,70,50,.5)'; c.fillRect(g1.X, g1.Y - 2 * g1.s, g2.X - g1.X, 3 * g1.s); }
      const p = P(e.x, e.z); if(!p) return; const r = e.r * p.s * unit;
      c.save(); c.translate(p.X, p.Y - r * .9); c.rotate(e.rot || 0);
      if(ok(IMG.saw)) c.drawImage(IMG.saw, -r * 1.15, -r * 1.15, r * 2.3, r * 2.3);
      else { c.fillStyle = '#c9ced8'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); }
      c.restore();
    } else if(e.t === 'tower' && e.hp > 0){
      const p = P(e.x, e.z); if(!p) return;
      const th = 26 * p.s * unit, tw = ok(IMG.tower) ? th * IMG.tower.naturalWidth / IMG.tower.naturalHeight : th * .6;
      if(ok(IMG.tower)){ if(e.hitT) c.filter = 'brightness(1.8)'; c.drawImage(IMG.tower, p.X - tw / 2, p.Y - th, tw, th); c.filter = 'none'; }
      else { c.fillStyle = '#b9a27a'; c.fillRect(p.X - tw / 2, p.Y - th, tw, th); }
      hpBar(c, p.X, p.Y - th - 8, tw * .9, e.hp / e.max, '#ff5a4f');
    } else if(e.t === 'door' && e.hp > 0){
      const a = P(-52, e.z), b = P(52, e.z); if(!a || !b) return;
      const bw = (b.X - a.X) / 2, cx = (a.X + b.X) / 2;
      const dh = ok(IMG.door) ? bw * IMG.door.naturalHeight / IMG.door.naturalWidth : 16 * a.s * unit;
      if(ok(IMG.door)){ if(e.hitT) c.filter = 'brightness(1.5)'; c.drawImage(IMG.door, a.X, a.Y - dh, bw, dh); c.drawImage(IMG.door, a.X + bw, a.Y - dh, bw, dh); c.filter = 'none'; }
      else { c.fillStyle = '#a8743f'; c.fillRect(a.X, a.Y - dh, b.X - a.X, dh); }
      hpBar(c, cx, a.Y - dh - 12, bw, e.hp / e.max, '#ffc83d');
      if(!mini){ const fs = Math.max(13, dh * .18); c.font = fs + 'px ' + FONT; c.textAlign = 'center'; strokeText(c, '성문 ' + Math.ceil(e.hp), cx, a.Y - dh * .5, '#fff', '#16233d', fs * .2); }
    } else if(e.t === 'boss' && e.hp > 0){
      drawBoss(c, P, unit, e, clock);
    } else if(e.t === 'finish'){
      const a = P(-50, e.z), b = P(50, e.z); if(!a || !b) return; const hh = 4 * a.s * unit, n = 20, cw = (b.X - a.X) / n;
      for(let i = 0; i < n; i++){ c.fillStyle = i % 2 ? '#16233d' : '#fff'; c.fillRect(a.X + i * cw, a.Y - hh, cw, hh / 2); c.fillStyle = i % 2 ? '#fff' : '#16233d'; c.fillRect(a.X + i * cw, a.Y - hh / 2, cw, hh / 2); }
      if(!mini){ c.font = Math.max(13, 18 * a.s) + 'px ' + FONT; c.textAlign = 'center'; c.fillStyle = '#16233d'; c.fillText('결승', (a.X + b.X) / 2, a.Y - hh - 6); }
    }
  }
  function drawBoss(c, P, unit, e, clock){
    const p = P(0, e.z); if(!p) return;
    const S_ = p.s * unit, X = p.X, Y = p.Y, im = IMG[e.kind];
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(X, Y, 16 * S_, 6 * S_, 0, 0, 7); c.fill();
    const h = (e.kind === 'dragon' ? 52 : 48) * S_;
    let lift = 0, sq = 1, rot = 0;
    if(e.kind === 'brute' && e.swing > 0){ const k = (.5 - e.swing) / .5; lift = Math.sin(k * Math.PI) * 8 * S_; sq = 1 + Math.sin(k * Math.PI) * .06; rot = Math.sin(k * Math.PI * 2) * .08; }
    if(e.kind === 'knight' && e.swing > 0) rot = -.08 * Math.sin((.4 - e.swing) / .4 * Math.PI);
    if(e.kind === 'dragon') lift = (3 + Math.sin(clock * 3) * 2.5) * S_;
    if(e.kind === 'shaman') lift = Math.sin(clock * 2.4) * 2 * S_;
    const w = ok(im) ? h * im.naturalWidth / im.naturalHeight : h * .8;
    c.save(); c.translate(X, Y - lift); c.rotate(rot); c.scale(1 / sq, sq);
    if(e.hitT > 0) c.filter = 'brightness(1.9)';
    if(ok(im)) c.drawImage(im, -w / 2, -h, w, h); else { c.fillStyle = '#c9673a'; c.fillRect(-w / 2, -h, w, h); }
    c.filter = 'none'; c.restore();
    if(e.kind === 'knight' && e.shield){
      const gl = .25 + .1 * Math.sin(clock * 8);
      c.fillStyle = 'rgba(120,180,255,' + gl.toFixed(2) + ')'; c.beginPath(); c.ellipse(X, Y - h * .5, w * .62, h * .62, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(200,230,255,.9)'; c.lineWidth = 2 * S_; c.stroke();
    }
    if(e.kind === 'shaman'){ const gl = .35 + .25 * Math.sin(clock * 6); c.fillStyle = 'rgba(170,255,90,' + gl.toFixed(2) + ')'; c.beginPath(); c.arc(X + w * .3, Y - lift - h * .86, 6 * S_, 0, 7); c.fill(); }
    if(e.kind === 'dragon' && e.phase === 'fire'){
      const tg = P(e.fireSide * 24, e.z - 40);
      if(tg){ c.lineCap = 'round'; c.strokeStyle = 'rgba(255,120,30,.85)'; c.lineWidth = 12 * S_; c.beginPath(); c.moveTo(X, Y - lift - h * .62); c.lineTo(tg.X, tg.Y - 4 * tg.s * unit); c.stroke(); c.strokeStyle = 'rgba(255,240,150,.95)'; c.lineWidth = 5 * S_; c.stroke(); }
    }
    hpBar(c, X, Y - lift - h - 10 * S_, 40 * S_, e.hp / e.max, e.shield ? '#9cc6ff' : '#ff5a4f');
  }

  /* ---------- 판 상태 ---------- */
  let S = null;
  function init(cfg, rng){
    loadImgs();
    const battle = !!G.duel, stage = battle ? 0 : Math.max(1, (cfg && cfg.stage) || 1);
    S = { rng, battle, stage, keyDir:0, clock:0, lt:0, end:null, mine:true, hold:0 };
    S.vr = mul32(Math.floor(rng() * 4294967296));
    G.mc = S;
    if(battle){
      const gen = newGen(mul32(Math.floor(rng() * 4294967296)), 'battle', 0, RULE.BATTLE_START);
      S.me = newRun(gen, RULE.BATTLE_START, true, mul32(Math.floor(rng() * 4294967296)));
      S.rv = newRun(gen, RULE.BATTLE_START, false, mul32(Math.floor(rng() * 4294967296)));
      S.rvName = RIVALS[Math.floor(rng() * RIVALS.length)];
      S.left = RULE.BATTLE_TIME;
      if(G.duel && G.duel.opp) G.duel.opp.nick = S.rvName;
    } else {
      const gen = newGen(mul32(Math.floor(rng() * 4294967296)), 'solo', stage, startN(stage));
      extendGen(gen, 1e9);
      S.me = newRun(gen, startN(stage), true, mul32(Math.floor(rng() * 4294967296)));
      S.endZ = gen.items[gen.items.length - 1].z;
    }
  }

  /* 판 끝: 결과를 정리하고 엔진 finish()로 */
  function endWith(win, why){
    if(S.end) return;
    const me = S.me, E = { win, why, n:Math.ceil(me.N), peak:Math.ceil(me.peak) };
    if(!S.battle){
      const ratio = me.N / Math.max(1, me.peak), th = isBossStage(S.stage) ? RULE.STAR_BOSS : RULE.STAR_SOLO;
      E.stars = win ? 1 + (ratio >= th[0] ? 1 : 0) + (ratio >= th[1] ? 1 : 0) : 0;
    } else {
      const rv = S.rv;
      G.duel.r = win === null ? 'd' : win ? 'w' : 'l';
      G.duel.why = why;
      G.duel.a = { sc:Math.ceil(me.N) };
      G.duel.b = { sc:Math.ceil(rv.N) };
    }
    S.end = E;
    snd(win ? 'mcWin' : 'mcLose');
    const g = G; setTimeout(() => { if(G === g && !g.over) finish(!!win); }, 900);
  }
  function checkEnd(){
    const me = S.me;
    if(!S.battle){
      if(me.dead) endWith(false, me.bossActive ? KIND[me.bossActive.kind].name + '에게 전멸했어요' : '부대가 전멸했어요');
      else if(me.done) endWith(true, isBossStage(S.stage) ? KIND[bossKindFor(S.stage)].name + ' 격파!' : '결승선 통과!');
      return;
    }
    const rv = S.rv, t = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    if(me.dead && rv.dead){
      const d = Math.abs(me.deathTime - rv.deathTime) < .05;
      endWith(d ? null : me.deathTime > rv.deathTime, d ? '같은 순간 전멸 · 무승부' : me.deathTime > rv.deathTime ? `라이벌보다 더 오래 버팀 (${t(me.deathTime)})` : `라이벌이 더 오래 버팀 (${t(rv.deathTime)})`);
    } else if(rv.dead) endWith(true, `${S.rvName} 부대 전멸 · ${t(rv.deathTime)}에 승리`);
    else if(me.dead) endWith(false, `내 부대가 먼저 전멸 (${t(me.deathTime)})`);
    else if(S.left <= 0){
      const a = Math.ceil(me.N), b = Math.ceil(rv.N);
      endWith(a > b ? true : a < b ? false : null, `2:00 종료 · 병력 ${a} 대 ${b}`);
    }
  }

  /* ---------- 화면(HUD) ---------- */
  const $s = sel => S.root ? S.root.querySelector(sel) : null;
  function bossIntro(e){
    const b = $s('.mc-bi'); if(!b) return;
    b.querySelector('img').src = BASE + IMGF[e.kind];
    b.querySelector('b').textContent = KIND[e.kind].name;
    b.hidden = false; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
    snd('mcBoss');
    clearTimeout(S.biT); S.biT = setTimeout(() => { if(b) b.hidden = true; }, 2300);
  }
  function hud(){
    const me = S.me, root = S.root; if(!root) return;
    const cnt = Math.ceil(me.N).toLocaleString('ko-KR');
    if(S.hudN !== cnt){ S.hudN = cnt; const el = $s('.mc-n'); el.textContent = cnt; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    if(!S.battle){ $s('.mc-road i').style.width = clamp(me.z / S.endZ * 100, 0, 100) + '%'; $s('.mc-road .mc-mk').style.left = clamp(me.z / S.endZ * 100, 0, 100) + '%'; }
    else {
      const rv = Math.ceil(S.rv.N).toLocaleString('ko-KR'), l = Math.max(0, S.left);
      $s('.mc-vme').textContent = cnt; $s('.mc-vrv').textContent = rv;
      $s('.mc-tm').textContent = Math.floor(l / 60) + ':' + String(Math.floor(l % 60)).padStart(2, '0');
      const tot = Math.max(1, me.N + S.rv.N); $s('.mc-tug i').style.width = (me.N / tot * 100).toFixed(1) + '%';
      $s('.mc-tm').classList.toggle('hot', l <= 15);
    }
    const b = me.bossActive, bb = $s('.mc-boss');
    if(b && b.hp > 0){
      bb.hidden = false;
      const im = bb.querySelector('img'), src = BASE + IMGF[b.kind]; if(im.dataset.k !== b.kind){ im.src = src; im.dataset.k = b.kind; }
      bb.querySelector('.mc-bn').textContent = KIND[b.kind].name + (b.kind === 'knight' && b.shield ? ' · 방패!' : '') + (b.kind === 'dragon' && b.phase === 'tele' ? ' · 불길 경고!' : '');
      bb.querySelector('.mc-bp').textContent = Math.ceil(b.hp / b.max * 100) + '%';
      bb.querySelector('.mc-bt i').style.width = (b.hp / b.max * 100) + '%';
      bb.classList.toggle('mc-sh', !!b.shield);
    } else bb.hidden = true;
  }

  function mount(st){
    const solo = !S.battle;
    st.innerHTML = `<div class="mcw">
      <canvas class="mc-cv" aria-label="행군대작전 전장"></canvas>
      <div class="mc-top">
        <div class="mc-plate"><img class="mc-ic" src="${BASE}soldier.webp" alt=""><div class="mc-cnt"><small>병력</small><b class="mc-n">0</b></div></div>
        ${solo ? `<div class="mc-road" aria-label="결승까지 진행"><i></i><span class="mc-mk"></span><span class="mc-fl">${isBossStage(S.stage) ? '보스' : '결승'}</span></div>`
        : `<div class="mc-vs"><div class="mc-side me"><small>나</small><b class="mc-vme">0</b></div><div class="mc-tm">2:00</div><div class="mc-side rv"><small class="mc-rvn"></small><b class="mc-vrv">0</b></div><div class="mc-tug"><i></i></div></div>`}
      </div>
      <div class="mc-boss" hidden><img alt=""><div class="mc-bw"><div class="mc-bh"><span class="mc-bn"></span><span class="mc-bp"></span></div><div class="mc-bt"><i></i></div></div></div>
      ${solo ? '' : `<div class="mc-mini"><canvas aria-label="라이벌 화면"></canvas><span class="mc-mtag"></span></div>`}
      <div class="mc-bi" hidden><img alt=""><div><small>보스 등장!</small><b></b></div></div>
      <div class="mc-hint">좌우로 끌어서 부대 이동</div>
      <div class="mc-new" hidden><span class="mc-tag"></span><b></b><p></p><small>눌러서 바로 시작</small></div>
    </div>`;
    S.root = st.querySelector('.mcw');
    /* 시작 카드: 솔로는 이 스테이지에 처음 나오는 것, 대전은 VS 라이벌. 카드가 떠 있는 동안 판은 멈춤 */
    const nc = S.root.querySelector('.mc-new');
    const card = solo ? (NEWS[S.stage] ? ['NEW · 스테이지 ' + S.stage, NEWS[S.stage][0], NEWS[S.stage][1]] : isBossStage(S.stage) ? ['스테이지 ' + S.stage, '보스 ' + KIND[bossKindFor(S.stage)].name, '지금까지 나온 기믹이 모두 섞여 나와요. 병력을 지켜 보스까지!'] : null)
      : ['대전 · 2분', 'VS ' + S.rvName, '먼저 전멸하면 패배! 2:00까지 둘 다 살면 남은 병력이 많은 쪽이 이겨요.'];
    if(card){ nc.querySelector('.mc-tag').textContent = card[0]; nc.querySelector('b').textContent = card[1]; nc.querySelector('p').textContent = card[2]; nc.hidden = false; S.hold = solo ? 2.6 : 2; }
    const skip = () => { if(S.hold > 0){ S.hold = 0; nc.hidden = true; } };
    nc.addEventListener('pointerdown', skip);
    if(!solo){ S.root.querySelector('.mc-rvn').textContent = S.rvName; S.root.querySelector('.mc-mtag').textContent = S.rvName; S.mcv = S.root.querySelector('.mc-mini canvas'); S.mctx = S.mcv.getContext('2d'); }
    const cv = S.root.querySelector('.mc-cv'), ctx = cv.getContext('2d');
    const size = () => {
      const top = S.root.getBoundingClientRect().top + (window.scrollY || 0);
      const h = Math.max(440, window.innerHeight - top - 6);
      S.root.style.height = h + 'px';
      S.DPR = Math.min(2, window.devicePixelRatio || 1); S.W = S.root.clientWidth; S.H = h;
      cv.width = Math.round(S.W * S.DPR); cv.height = Math.round(S.H * S.DPR);
      if(S.mcv){ S.mcv.width = Math.round(96 * S.DPR); S.mcv.height = Math.round(150 * S.DPR); }
    };
    size();
    /* 조작: 화면을 좌우로 끌기 · ← → / A D */
    let drag = null;
    cv.addEventListener('pointerdown', e => { if(S.end) return; skip(); drag = { x0:e.clientX, t0:S.me.tx, id:e.pointerId }; try{ cv.setPointerCapture(e.pointerId); }catch(_){} S.root.classList.add('touched'); });
    cv.addEventListener('pointermove', e => { if(!drag || e.pointerId !== drag.id) return; const unit = Math.min(S.W / 108, 6.2); S.me.tx = clamp(drag.t0 + (e.clientX - drag.x0) / unit * 1.25, -44, 44); });
    const up = () => { drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
    const kd = e => { if(!G || G.over || G.id !== ID || document.body.classList.contains('modal-open')) return;
      if(e.code === 'ArrowLeft' || e.code === 'KeyA'){ S.keyDir = -1; e.preventDefault(); S.root.classList.add('touched'); }
      else if(e.code === 'ArrowRight' || e.code === 'KeyD'){ S.keyDir = 1; e.preventDefault(); S.root.classList.add('touched'); } };
    const ku = e => { if(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) S.keyDir = 0; };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('resize', size);
    const g = G;
    const loop = now => {
      if(G !== g) return;
      const dt = Math.min(.05, (now - (S.lt || now)) / 1000); S.lt = now; S.clock += dt;
      try{
        if(S.hold <= 0 && !nc.hidden) nc.hidden = true;
        if(S.hold > 0){ if(!g.paused){ S.hold -= dt; hud(); } }
        else if(!g.over && !g.paused && !S.end){
          step(S.me, dt);
          if(S.rv){ S.mine = false; step(S.rv, dt); S.mine = true; if(!S.me.dead && !S.rv.dead) S.left -= dt; }
          checkEnd();
          hud();
        }
        ctx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
        render(ctx, S.W, S.H, S.me, false, S.clock);
        if(S.mctx){
          S.mctx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0); render(S.mctx, 96, 150, S.rv, true, S.clock);
          if(S.rv.dead){ S.mctx.fillStyle = 'rgba(22,35,61,.6)'; S.mctx.fillRect(0, 0, 96, 150); S.mctx.font = '18px ' + FONT; S.mctx.textAlign = 'center'; S.mctx.fillStyle = '#fff'; S.mctx.fillText('전멸', 48, 82); }
        }
      }catch(err){ console.error(err); }
      g.raf = requestAnimationFrame(loop);
    };
    g.raf = requestAnimationFrame(loop);
    g.cleanup = () => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', size); cancelAnimationFrame(g.raf); clearTimeout(S && S.biT); };
  }

  /* ---------- 스타일(게임 톤: 남색 판 + 금색 글자, 파랑=나 · 빨강=적) ---------- */
  const css = `
.mcw{position:relative; width:100%; min-height:440px; border-radius:22px; overflow:hidden; background:#3b8fe0; touch-action:none; user-select:none; -webkit-user-select:none; --mc-ink:#16233d; --mc-gold:#ffc83d; --mc-blue:#2f7be8; --mc-red:#e2403a}
.mcw [hidden]{display:none!important}
.mcw .mc-cv{position:absolute; inset:0; width:100%; height:100%; display:block}
.mcw .mc-top{position:absolute; left:10px; right:10px; top:10px; display:flex; gap:8px; align-items:stretch; pointer-events:none}
.mcw .mc-plate{display:flex; align-items:center; gap:6px; padding:4px 12px 4px 4px; border-radius:16px; background:linear-gradient(#24365c, #16233d); box-shadow:0 0 0 2px #e9c46a, 0 4px 0 #0b1426; flex:none}
.mcw .mc-ic{width:30px; height:38px; object-fit:contain; filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
.mcw .mc-cnt{display:flex; flex-direction:column; line-height:1}
.mcw .mc-cnt small{font-family:var(--disp); font-size:13px; color:#9fb6dc}
.mcw .mc-n{font-family:var(--heavy); font-weight:400; font-size:26px; color:var(--mc-gold); text-shadow:0 2px 0 #7a4b00; font-variant-numeric:tabular-nums; display:inline-block}
.mcw .mc-n.pop{animation:mcPop .28s ease-out}
@keyframes mcPop{0%{transform:scale(1.35)} 100%{transform:scale(1)}}
.mcw .mc-road{position:relative; flex:1; align-self:center; height:16px; border-radius:99px; background:#d9c08f; box-shadow:inset 0 2px 0 rgba(0,0,0,.18), 0 0 0 2px #fff6, 0 3px 0 rgba(22,35,61,.35); margin-right:34px}
.mcw .mc-road i{position:absolute; left:0; top:0; bottom:0; border-radius:99px; background:repeating-linear-gradient(-45deg, #ffc83d 0 8px, #ffd86b 8px 16px); width:0}
.mcw .mc-mk{position:absolute; top:50%; width:20px; height:20px; margin:-10px 0 0 -10px; border-radius:50%; background:var(--mc-blue); box-shadow:0 0 0 3px #fff, 0 2px 0 3px rgba(22,35,61,.4)}
.mcw .mc-fl{position:absolute; right:-36px; top:50%; transform:translateY(-50%); font-family:var(--heavy); font-size:13px; color:#fff; background:var(--mc-red); padding:2px 7px; border-radius:8px; box-shadow:0 2px 0 #a92723}
.mcw .mc-vs{flex:1; position:relative; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:4px; padding:5px 10px 11px; border-radius:16px; background:linear-gradient(#24365c, #16233d); box-shadow:0 0 0 2px #e9c46a, 0 4px 0 #0b1426; min-width:0}
.mcw .mc-side{display:flex; flex-direction:column; line-height:1.05; min-width:0}
.mcw .mc-side small{font-family:var(--disp); font-size:13px; color:#9fb6dc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mcw .mc-side b{font-family:var(--heavy); font-weight:400; font-size:20px; font-variant-numeric:tabular-nums}
.mcw .mc-side.me b{color:#8fc0ff} .mcw .mc-side.rv{text-align:right} .mcw .mc-side.rv b{color:#ff9a94}
.mcw .mc-tm{font-family:var(--heavy); font-size:22px; color:var(--mc-gold); font-variant-numeric:tabular-nums}
.mcw .mc-tm.hot{color:#ff7a6e; animation:mcBlink .5s steps(2) infinite}
@keyframes mcBlink{50%{opacity:.45}}
.mcw .mc-tug{position:absolute; left:10px; right:10px; bottom:5px; height:4px; border-radius:99px; background:var(--mc-red); overflow:hidden}
.mcw .mc-tug i{display:block; height:100%; background:var(--mc-blue); width:50%; transition:width .3s}
.mcw .mc-boss{position:absolute; left:10px; right:10px; top:68px; display:flex; align-items:center; gap:8px; padding:5px 10px 5px 5px; border-radius:16px; background:rgba(22,35,61,.88); box-shadow:0 0 0 2px #ff7a6e; pointer-events:none}
.mcw .mc-boss img{width:44px; height:44px; object-fit:contain; background:radial-gradient(#ffd0a0, #c0563a); border-radius:12px; box-shadow:0 0 0 2px #fff}
.mcw .mc-bw{flex:1; min-width:0}
.mcw .mc-bh{display:flex; justify-content:space-between; gap:6px; font-family:var(--heavy); font-size:14px; color:#fff}
.mcw .mc-bt{height:10px; margin-top:4px; border-radius:99px; background:#3a1f22; overflow:hidden}
.mcw .mc-bt i{display:block; height:100%; background:linear-gradient(90deg, #ff5a4f, #ff9a3c); transition:width .15s}
.mcw .mc-boss.mc-sh{box-shadow:0 0 0 2px #9cc6ff} .mcw .mc-boss.mc-sh .mc-bt i{background:linear-gradient(90deg, #7fb4ff, #c9e1ff)}
.mcw .mc-mini{position:absolute; right:10px; top:122px; width:96px; pointer-events:none}
.mcw .mc-mini canvas{display:block; width:96px; height:150px; border-radius:12px; box-shadow:0 0 0 3px #fff, 0 6px 14px rgba(0,0,0,.3)}
.mcw .mc-mtag{display:block; margin-top:6px; text-align:center; font-family:var(--heavy); font-size:13px; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mcw .mc-bi{position:absolute; left:50%; top:34%; display:flex; align-items:center; gap:10px; padding:8px 18px 8px 8px; border-radius:20px; background:linear-gradient(#b8322b, #7a1410); box-shadow:0 0 0 3px #ffc83d, 0 8px 24px rgba(0,0,0,.35); transform:translate(-50%, -50%); pointer-events:none}
.mcw .mc-bi.go{animation:mcSlam .45s cubic-bezier(.2, 1.6, .4, 1)}
@keyframes mcSlam{0%{transform:translate(-50%, -50%) scale(2.2); opacity:0} 100%{transform:translate(-50%, -50%) scale(1); opacity:1}}
.mcw .mc-bi img{width:64px; height:64px; object-fit:contain}
.mcw .mc-bi small{display:block; font-family:var(--heavy); font-size:14px; color:#ffd84a; letter-spacing:.06em}
.mcw .mc-bi b{display:block; font-family:var(--heavy); font-weight:400; font-size:26px; color:#fff; line-height:1.1}
.mcw .mc-hint{position:absolute; left:50%; bottom:16px; transform:translateX(-50%); padding:7px 14px; border-radius:99px; background:rgba(22,35,61,.75); color:#fff; font-family:var(--disp); font-size:15px; white-space:nowrap; pointer-events:none; transition:opacity .4s}
.mcw.touched .mc-hint{opacity:0}
.mcw .mc-new{position:absolute; left:50%; top:42%; transform:translate(-50%, -50%); width:min(320px, calc(100% - 40px)); padding:16px 18px 14px; border-radius:22px; text-align:center; background:linear-gradient(#fffaf0, #f3e6c8); box-shadow:0 0 0 3px #e9c46a, 0 6px 0 #b8893a, 0 16px 34px rgba(0,0,0,.3); animation:mcIn .35s cubic-bezier(.2, 1.4, .4, 1); cursor:pointer}
@keyframes mcIn{0%{transform:translate(-50%, -40%) scale(.85); opacity:0} 100%{transform:translate(-50%, -50%) scale(1); opacity:1}}
.mcw .mc-tag{display:inline-block; font-family:var(--heavy); font-size:13px; letter-spacing:.06em; color:#fff; background:var(--mc-red); padding:3px 11px; border-radius:99px; box-shadow:0 2px 0 #a92723}
.mcw .mc-new b{display:block; margin:8px 0 4px; font-family:var(--heavy); font-weight:400; font-size:26px; color:var(--mc-ink); line-height:1.15}
.mcw .mc-new p{margin:0; font-family:var(--disp); font-size:16px; line-height:1.45; color:#3c4a66}
.mcw .mc-new small{display:block; margin-top:8px; font-family:var(--disp); font-size:13px; color:#8a7a55}
@media (prefers-reduced-motion:reduce){ .mcw .mc-n.pop, .mcw .mc-bi.go, .mcw .mc-tm.hot, .mcw .mc-new{animation:none} }`;

  /* ---------- 게임 정의 ---------- */
  return {
    name:'행군대작전', col:['#8fc0ff', '#2f7be8', '#16233d'], time:'약 1분', abil:'전략력',
    modes:['solo', 'duel'],
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h7v6H4zM13 4h7v6h-7z" opacity=".55"/><circle cx="8" cy="15" r="2.4"/><circle cx="16" cy="15" r="2.4"/><circle cx="12" cy="19" r="2.4"/><path d="M6 13.2l2-3 2 3zM14 13.2l2-3 2 3zM10 17.2l2-3 2 3z"/></svg>',
    art(){
      const u = 'mcA' + (++SVG_UID);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6ff"/><stop offset="1" stop-color="#2f7fd6"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u})"/><image href="${BASE}thumb.jpg" x="0" y="0" width="160" height="100" preserveAspectRatio="xMidYMid slice"/></svg>`;
    },
    help:[
      ['좌우로 끌어 이동', '화면을 좌우로 끌면 부대가 따라 움직여요(PC는 ← → 키). 부대는 앞으로 저절로 걸어가요.'],
      ['관문을 골라 키우기', '파란 관문(+, ×)으로 지나가면 병력이 늘고, 빨간 관문(−, ÷)은 줄어요. 노란 줄의 파란 +판은 지나갈 때마다 병사가 늘어요.'],
      ['화살과 돌격', '부대는 앞의 적에게 화살을 자동으로 쏴요. 병력이 많을수록 빨리, 세게 쏴요. 빨간 부대와 부딪히면 서로 병력을 잃어요.'],
      ['보스와 별', '3·6·9…스테이지 끝엔 보스가 나와요. 끝까지 남은 병력이 최대 병력의 40%면 ★★, 70%면 ★★★(보스 판은 30%·55%).']
    ],
    helpExtra:() => S && S.battle ? [['대전 판정', `라이벌과 똑같은 길을 동시에 걸어요(오른쪽 위 작은 화면). 먼저 전멸하면 패배, 2:00까지 둘 다 살면 남은 병력이 많은 쪽이 이겨요.`]] : [],
    chapters:['푸른 성벽', '바닷가 다리', '톱날 협곡', '궁수 요새', '용의 성'],
    starRule:'클리어 ★ · 남은 병력 40%↑ ★★ · 70%↑ ★★★ (보스 판 30% · 55%)',
    starGoal:() => [{ s:3, text:isBossStage((S && S.stage) || 1) ? '병력 55% 이상 지키기' : '병력 70% 이상 지키기', ok:() => S && S.me ? S.me.N / Math.max(1, S.me.peak) >= (isBossStage(S.stage) ? .55 : .7) : null }],
    levels:{ easy:{ limit:0, stage:2 }, normal:{ limit:0, stage:5 }, hard:{ limit:0, stage:9 } },
    levelDesc:lv => ({ easy:'적 부대까지', normal:'톱날까지', hard:'보스 주술사' })[lv] || '보통',
    stage:n => ({ limit:0, stage:n }),
    stageDesc:n => (NEWS[n] ? '새로 나옴: ' + NEWS[n][0] + ' · ' : '') + (isBossStage(n) ? '보스 ' + KIND[bossKindFor(n)].name : '결승선까지') + ` · 시작 병력 ${startN(n)}`,
    stageTag:n => isBossStage(n) ? 'boss' : '',
    init(cfg, rng, lv){ init(cfg, rng, lv); },
    render:st => mount(st),
    progress(){ if(!S) return 0; return S.battle ? Math.min(1, (RULE.BATTLE_TIME - S.left) / RULE.BATTLE_TIME) : Math.min(1, S.me.z / S.endZ); },
    lossText(){
      if(!S) return '판이 시작되지 않았어요.';
      if(S.battle) return S.end ? S.end.why : '라이벌보다 먼저 전멸했어요.';
      return `${Math.round(Math.min(1, S.me.z / S.endZ) * 100)}%까지 행군했어요. 최대 병력 ${Math.ceil(S.me.peak)}.`;
    },
    score(){
      const E = S && S.end, n = E ? E.n : S ? Math.ceil(S.me.N) : 0, st = E ? (E.stars || 0) : 1;
      return { base:500, time:Math.min(350, n), extra:st * 50, rows:[E ? E.why : '완주', `남은 병력 ${n} (최대 350)`, `별 ${st}개 × 50`] };
    },
    stars(){ return S && S.end && S.end.stars ? S.end.stars : 1; },
    winTitle:'행군 성공!', loseTitle:'부대가 전멸했어요', bodyClass:'mcmode',
    duelHow:'라이벌과 같은 길 · 먼저 전멸하면 패배 · 2:00엔 병력 많은 쪽 승리',
    duelLaunch(){ startGame(ID, 'normal', { duel:{ fleet:true, mode:'ai', opp:{ nick:'라이벌' } } }); },
    css,
    sounds:{
      mcUp(){ [0, 4, 7].forEach((d, i) => aMarimba(m2f(76 + d), { t:i * .04, v:.09 })); },
      mcDown(){ aTone({ f:330, f2:160, type:'triangle', d:.25, v:.08 }); },
      mcPlus(){ aMarimba(m2f(84), { v:.05, d:.2 }); },
      mcClash(){ aThump({ f:160, f2:80, d:.08, v:.08 }); },
      mcSaw(){ aTone({ f:900, f2:300, type:'sawtooth', d:.18, v:.05 }); },
      mcBreak(){ aThump({ f:120, f2:40, d:.3, v:.22 }); },
      mcSlam(){ aThump({ f:90, f2:35, d:.35, v:.25 }); },
      mcFire(){ aTone({ f:220, f2:60, type:'sawtooth', d:.5, v:.08 }); },
      mcBoss(){ [0, -3, -7].forEach((d, i) => aTone({ f:m2f(57 + d), type:'square', t:i * .12, d:.18, v:.06 })); },
      mcBossDown(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(72 + d), { t:i * .06, v:.12 })); },
      mcWin(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(79 + d), { t:i * .05, v:.1 })); },
      mcLose(){ aTone({ f:300, f2:120, type:'triangle', d:.6, v:.08 }); }
    },
    gate:{ mcPlus:60, mcClash:120, mcUp:80 },
    _rules:{ RULE, applyOp, newGen, extendGen, isBossStage }   /* 점검용 */
  };
})();
