/* ===== 고백점프 (goback) · 순발력 · 2~5명 차례 넘기기 =====
   "고 백 점프 ~ 고 백 점프!" 노래가 끝나면 시작하는 사람부터 셋 중 하나를 외친다.
   - 고: 지금 방향(처음엔 시계 방향)으로 다음 사람에게 차례
   - 백: 방향을 바꿔 반대쪽 사람에게 차례
   - 점프: 지금 방향으로 한 사람을 건너뛰고 그다음 사람에게 차례
   누구 차례인지 화면이 알려 주지 않는다. 앞사람이 외친 것(말풍선·화살표·가운데 큰 글자)을 보고 내 차례인지 스스로 알아채야 한다.
   - 늦음: 내 차례에 박자 안에 못 외치면 기회 별 1개, 그 사람부터 다시 시작
   - 헛누름: 내 차례가 아닌데 누르면 기회 별 1개(판은 그대로 이어짐)
   - 별이 0개면 탈락(구경). 끝까지 남은 한 사람이 1등. 차례가 갈수록 박자가 빨라진다.
   대전(2~5명): 차례인 사람의 기기만 그 차례를 정한다(외침·늦음·넘김 사건에 다음 사람 자리를 담아 보냄) → 모든 기기가 같은 순서.
   헛누름은 그 사람 기기가 정해 별 수만 보낸다(순서와 상관없음). 문제 내용·컴퓨터의 수는 씨앗 rng로만. */
NG.goback = (() => {
  const OL = '#1A0F45';
  const KEYS = ['go', 'back', 'jump'];
  const CALL = {
    go:{ txt:'고', col:'#20C063', ink:'#0B5B2A', lite:'#E2FBEA', say:'고' },
    back:{ txt:'백', col:'#FF8A1A', ink:'#8A3A00', lite:'#FFF0DE', say:'백' },
    jump:{ txt:'점프', col:'#A66BFF', ink:'#4B1FA8', lite:'#F1E8FF', say:'점프' }
  };
  const ICON = {
    go:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12h14M12 5.5l6.5 6.5-6.5 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 20V10.5a5.5 5.5 0 0 0-11 0V14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M2.5 10.5l4 4.5 4-4.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    jump:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="19" r="2.6" fill="currentColor"/><path d="M2.8 19C4.5 6 18.5 5 20.4 15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16.2 13.6l4.3 2.3 1.4-4.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const HICO = {
    ppl:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.6" fill="#FF8FB1" stroke="#1A0F45" stroke-width="1.8"/><circle cx="16.5" cy="9" r="3" fill="#9FD3FF" stroke="#1A0F45" stroke-width="1.8"/><path d="M2.5 20c.6-4 3.2-6 6.5-6s5.9 2 6.5 6z" fill="#FF8FB1" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M15.5 14.2c3 .1 5.2 1.9 5.8 5.8h-4.6" fill="#9FD3FF" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    beat:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13" fill="none" stroke="#1A0F45" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="3.2" fill="#FFD23F" stroke="#1A0F45" stroke-width="1.8"/><circle cx="17.5" cy="16" r="3.2" fill="#FFD23F" stroke="#1A0F45" stroke-width="1.8"/></svg>',
    cnt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h3l5-4v14l-5-4H4z" fill="#FF8A1A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  const CPU = [['토끼', 'rabbit'], ['곰', 'bear'], ['고양이', 'cat'], ['판다', 'panda']];
  const SEAT_COL = ['#FF6FA5', '#2F9BFF', '#22C55E', '#F5B400', '#A66BFF'];
  const LYRIC = ['고', '백', '점', '프', '고', '백', '점', '프!'];
  const BEAT = .36;              /* 노래 박자(초) */
  const CAP = 150;               /* 대전 최대 시간(초): 넘으면 남은 별로 순위 */
  const OUT_TXT = { late:'늦었어요', false:'헛누름', left:'나갔어요' };

  /* ---------- 공용 도구 ---------- */
  const S = () => G && G.m && G.m.gb ? G.m : null;
  const el = id => document.getElementById(id);
  const fx = fn => { try{ fn(); }catch(_){} };
  let UID = 0;
  function T(fn, ms){ const m = S(); if(!m) return; const id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) try{ fn(); }catch(_){} }, ms); m.timers.add(id); }
  const rngOf = (m, pid, salt) => mulberry(seedFrom(m.seed + ':' + m.n + ':' + pid + ':' + salt));
  function pplMap(m){
    if(!m.duel) return {};
    if(!m.ppl || performance.now() - m.pplAt > 500){ m.ppl = {}; try{ duelPlayers().forEach(p => { m.ppl[p.pid] = p; }); }catch(_){} m.pplAt = performance.now(); }
    return m.ppl;
  }
  const leftOf = (m, pid) => { const p = pplMap(m)[pid]; return !!(p && p.left); };
  const alive = (m, pid) => !!m.P[pid] && !m.P[pid].out && !leftOf(m, pid);
  const isLocal = (m, pid) => pid === m.me || !!(m.P[pid] && m.P[pid].ai);
  const nmOf = (m, pid) => pid === m.me ? '나' : m.P[pid].nick;
  const oppKindOf = nick => { try{ const k = DUEL_NICK_B.findIndex(a => String(nick || '').endsWith(a)); return FACE_KIND[k >= 0 ? k : seedFrom(String(nick || '?')) % 6]; }catch(_){ return 'cat'; } };
  /* 차례 넘기기: from에서 d 방향으로 살아 있는 사람을 k번째까지(excl은 없는 셈) */
  function step(m, from, d, k, excl){
    const L = m.seats.length; let i = m.seats.indexOf(from), c = 0;
    for(let g = 0; g < L * 3; g++){
      i = (i + d + L) % L; const p = m.seats[i];
      if(p !== excl && alive(m, p)){ c++; if(c >= k) return p; }
    }
    return from;
  }
  /* 박자(초): w0에서 ramp번 차례 동안 w1까지, 그 뒤 오래가면 조금씩 더 빨라짐(최소 0.55초) */
  function beatW(m, n){
    const c = m.cfg, r = c.ramp || 30;
    let w = c.w0 * Math.pow(c.w1 / c.w0, Math.min(1, n / r));
    if(n > r * 2) w = Math.max(.55, c.w1 * Math.pow(.985, n - r * 2));
    return w;
  }
  const keyOf = (m, pid) => { const p = m.P[pid]; return p.out ? p.outN : 1000 + p.lives * 100 + Math.min(99, p.calls); };
  /* 목소리(덤): 소리가 켜져 있고 한국어 목소리가 있을 때만 */
  function say(text, rate){
    try{
      if(typeof SND === 'undefined' || !SND.on || !(AUD.set.sfx > 0) || !('speechSynthesis' in window)) return;
      const ss = window.speechSynthesis, v = ss.getVoices().find(x => /^ko/i.test(x.lang)); if(!v) return;
      ss.cancel(); const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = 'ko-KR'; u.rate = rate || 1.6; u.pitch = 1.15; u.volume = Math.min(1, AUD.set.sfx);
      ss.speak(u);
    }catch(_){}
  }
  const hush = () => { try{ if('speechSynthesis' in window) window.speechSynthesis.cancel(); }catch(_){} };

  /* ---------- 판 설정 ---------- */
  function stageCfg(n){
    const p = planOf('goback', n), c = p.c, k = p.k;
    let cpu = c === 1 ? (k <= 3 ? 1 : 2) : c === 2 ? 3 : 4;
    if(p.boss) cpu = Math.min(4, cpu + 1);
    const dec = Math.pow(.92, Math.min(c - 1, 8)), km = p.boss ? .9 : p.hard ? .94 : k === 9 ? 1.1 : 1;
    const w0 = Math.max(1.0, 2.2 * dec * km), w1 = Math.max(.62, 1.15 * dec * km);
    return { cpu, w0:+w0.toFixed(2), w1:+w1.toFixed(2), lives:3, cpuLives:c === 1 ? 1 : 2, aiMiss:.05, aiMissK:.15, aiFalse:c === 1 ? 0 : Math.min(.03, .01 * (c - 1)),
      jumpP:Math.min(.3, .18 + .03 * (c - 1)), hint:c === 1 && k <= 3, boss:p.boss, ramp:30, limit:0 };
  }
  const LEVELS = {
    easy:{ cpu:2, w0:2.2, w1:1.3, lives:3, cpuLives:1, aiMiss:.05, aiMissK:.15, aiFalse:0, jumpP:.18, ramp:30, limit:0 },
    normal:{ cpu:3, w0:1.9, w1:1.0, lives:3, cpuLives:2, aiMiss:.05, aiMissK:.15, aiFalse:.015, jumpP:.22, ramp:30, limit:0 },
    hard:{ cpu:4, w0:1.6, w1:.8, lives:3, cpuLives:2, aiMiss:.04, aiMissK:.14, aiFalse:.025, jumpP:.26, ramp:30, limit:0 }
  };

  /* ---------- 진행 ---------- */
  function initState(cfg, rng){
    const D = G.duel && G.duel.v === 3 && !G.duel.replay ? G.duel : null;
    const m = { gb:1, cfg:Object.assign({}, cfg), duel:!!D, pvp:!!(D && D.mode === 'pvp'), seats:[], P:{}, me:'me', cur:null, dir:1, n:0,
      phase:'wait', t:0, lt:0, t0:0, ts:0, W:cfg.w0, dl:null, ai:null, aiF:[], q:[], pend:null, lock:0, log:[], outN:0, beat:-1,
      introEnd:0, pauseEnd:0, myCalls:0, tr:[], timers:new Set(), seed:'' };
    if(D){
      m.me = D.myPid; m.seats = D.pl.slice(); m.seed = 'gb:' + D.seed;
      let pp = {}; try{ duelPlayers().forEach(p => { pp[p.pid] = p; }); }catch(_){}
      const lives = cfg.lives || 3;
      m.seats.forEach((pid, i) => { const p = pp[pid] || {}, me = pid === m.me, nick = me ? '나' : duelShortNick(p.nick || (D.P[pid] && D.P[pid].nick) || '상대');
        m.P[pid] = { pid, nick, kind:me ? 'fox' : oppKindOf(p.nick || nick), col:p.col || SEAT_COL[i % 5], me, ai:!!(D.P[pid] && D.P[pid].ai), lives, maxL:lives, out:0, outN:0, calls:0, mis:0 }; });
    } else {
      m.seed = 'gb:' + Math.floor(rng() * 1e9);
      m.seats = ['me'];
      m.P.me = { pid:'me', nick:'나', kind:'fox', col:SEAT_COL[0], me:true, ai:false, lives:cfg.lives || 3, maxL:cfg.lives || 3, out:0, outN:0, calls:0, mis:0 };
      const order = [0, 1, 2, 3]; for(let i = 3; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for(let i = 0; i < Math.min(4, cfg.cpu || 2); i++){ const [nick, kind] = CPU[order[i]], pid = 'c' + (i + 1);
        m.seats.push(pid); m.P[pid] = { pid, nick, kind, col:SEAT_COL[i + 1], me:false, ai:true, lives:cfg.cpuLives || 2, maxL:cfg.cpuLives || 2, out:0, outN:0, calls:0, mis:0 }; }
    }
    m.cur = m.seats[0];   /* 시작하는 사람: 솔로는 나, 대전은 참가 순서 첫 사람 */
    return m;
  }

  function startIntro(){
    const m = S(); m.phase = 'intro'; m.t0 = m.t; m.introEnd = m.t + BEAT * 10; m.beat = -1;
    say('고 백 점프, 고 백 점프', 1.25);
    center({ big:'', who:'', dir:true });
  }
  function introTick(){
    const m = S(), b = Math.floor((m.t - m.t0) / BEAT);
    if(b === m.beat) return; m.beat = b;
    if(b < 8){
      const w = LYRIC[b];
      const big = el('gbBig'); if(big){ big.className = 'gb-big lyr k' + (b % 4); big.textContent = w; fx(() => { void big.offsetWidth; big.classList.add('pop'); }); }
      const who = el('gbWho'); if(who) who.textContent = b < 4 ? '고 백 점프 ~' : '고 백 점프!';
      sfx('gbBeat', { hi:b % 4 === 0, n:b });
      fx(() => { const tb = el('gbFelt'); if(tb){ tb.classList.remove('thump'); void tb.offsetWidth; tb.classList.add('thump'); } });
    } else if(b === 8){
      const big = el('gbBig'); if(big){ big.className = 'gb-big start'; big.textContent = '시작!'; }
      const who = el('gbWho'); if(who) who.innerHTML = `<i style="--sc:${m.P[m.cur].col}"></i>${esc(nmOf(m, m.cur))}부터`;
      sfx('gbStart');
    }
  }
  /* 새 차례 */
  function startTurn(){
    const m = S(); if(!m || m.phase === 'end') return;
    if(checkEnd()) return;
    m.phase = 'turn'; m.ts = m.t; m.W = beatW(m, m.n); m.dl = null; m.ai = null; m.aiF = []; m.hintOn = false;
    document.querySelectorAll('.ng-gb .gb-seat.hint').forEach(s => s.classList.remove('hint'));
    const cur = m.cur, q = m.P[cur];
    /* 컴퓨터의 헛누름(헷갈림): 차례가 아닌 컴퓨터가 가끔 */
    if(m.cfg.aiFalse) m.seats.forEach(pid => { const p = m.P[pid]; if(!p.ai || pid === cur || !alive(m, pid)) return; const r = rngOf(m, pid, 'f'); if(r() < m.cfg.aiFalse) m.aiF.push({ pid, at:m.t + m.W * (.25 + .6 * r()) }); });
    if(!isLocal(m, cur)){ hud(); return; }   /* 다른 사람 차례: 그 기기의 사건을 기다림 */
    if(q.out){ if(cur === m.me) act({ t:'p', pid:cur }); else m.ai = { at:m.t + .15, kind:'p' }; return; }
    m.dl = m.t + m.W;
    if(cur === m.me){
      if(m.pend && m.t - m.pend.at <= grace(m)){ const c = m.pend.c; m.pend = null; myCall(c); return; }   /* 차례가 오기 직전(통신 지연)에 누른 것 */
    } else {
      const r = rngOf(m, cur, 'a'), prog = Math.max(0, Math.min(1, (m.cfg.w0 - m.W) / Math.max(.01, m.cfg.w0 - m.cfg.w1)));
      const miss = r() < (m.cfg.aiMiss || .05) + (m.cfg.aiMissK || .15) * prog + (m.n > (m.cfg.ramp || 30) * 2 ? .06 : 0);
      if(miss) m.ai = { at:m.dl, kind:'m' };
      else { const x = r(), jp = m.cfg.jumpP || .22; m.ai = { at:m.t + m.W * (.3 + .4 * r()), kind:'c', c:x < jp ? 'jump' : x < jp + .28 ? 'back' : 'go' }; }
    }
    hud();
  }
  const grace = m => m.pvp ? .35 : .15;
  /* 로컬(나·컴퓨터)이 정하는 사건 → 다음 사람을 담아 적용(사람 대전이면 내 것은 보냄) */
  function act(ev, send = true){
    const m = S(); if(!m || m.phase === 'end') return;
    const e = Object.assign({ n:m.n }, ev), p = m.P[e.pid]; if(!p) return;
    if(e.t === 'c'){ e.d = e.c === 'back' ? -m.dir : m.dir; e.nx = step(m, e.pid, e.d, e.c === 'jump' ? 2 : 1); }
    else if(e.t === 'm'){ e.d = m.dir; e.nx = p.lives - 1 > 0 ? e.pid : step(m, e.pid, m.dir, 1, e.pid); }
    else if(e.t === 'p'){ e.d = m.dir; e.nx = step(m, e.pid, m.dir, 1, e.pid); }
    else if(e.t === 'x'){ e.h = Math.max(0, p.lives - 1); }
    if(send && m.pvp && e.pid === m.me) fx(() => duelSend('gb', pack(m, e)));
    apply(e);
  }
  function pack(m, e){
    const o = { t:e.t };
    if(e.t === 'x'){ o.h = e.h; return o; }
    o.n = e.n; o.d = e.d; o.x = m.seats.indexOf(e.nx); if(e.t === 'c') o.c = KEYS.indexOf(e.c);
    return o;
  }
  function recv(pid, d){
    const m = S(); if(!m || !d || !m.P[pid] || pid === m.me) return;
    if(d.t === 'x'){ apply({ t:'x', pid, h:+d.h || 0 }); return; }
    if(!['c', 'm', 'p'].includes(d.t) || typeof d.n !== 'number') return;
    const nx = m.seats[d.x]; if(!nx) return;
    m.q.push({ t:d.t, pid, n:d.n, d:d.d === -1 ? -1 : 1, nx, c:KEYS[d.c] || 'go' });
    drain();
  }
  function drain(){
    const m = S(); if(!m) return;
    let go = true;
    while(go && m.phase !== 'end'){
      go = false;
      const i = m.q.findIndex(e => e.n === m.n && e.pid === m.cur);
      if(i >= 0){ const e = m.q.splice(i, 1)[0]; apply(e); go = true; }
      m.q = m.q.filter(e => e.n >= m.n);
    }
  }
  function apply(e){
    const m = S(); if(!m || m.phase === 'end') return;
    const p = m.P[e.pid]; if(!p) return;
    if(e.t === 'x'){ loseLife(e.pid, 'false', e.h); if(m.phase !== 'end') checkEnd(); return; }
    if(e.n !== m.n || e.pid !== m.cur) return;
    m.tr.push(e.t + e.n + '>' + m.seats.indexOf(e.nx)); if(m.tr.length > 400) m.tr.shift();   /* 점검용 차례 기록 */
    m.n++; m.dl = null; m.ai = null;
    if(e.t === 'c'){
      p.calls++; if(e.pid === m.me) m.myCalls++;
      m.dir = e.d; m.cur = e.nx;
      showCall(e);
      startTurn();
    } else if(e.t === 'm'){
      loseLife(e.pid, 'late', p.lives - 1);
      m.dir = e.d; m.cur = e.nx;
      if(checkEnd()) return;
      m.phase = 'pause'; m.pauseEnd = m.t + 1.5; restartShow();
    } else if(e.t === 'p'){
      m.dir = e.d; m.cur = e.nx; startTurn();
    }
    syncAi(); drain();
  }
  function loseLife(pid, why, h){
    const m = S(), p = m.P[pid]; if(!p || p.out || h >= p.lives) return;
    p.lives = Math.max(0, h); p.mis++;
    const idx = m.seats.indexOf(pid), seat = el('gbS' + idx), me = pid === m.me;
    if(p.lives <= 0){ p.out = why; p.outN = ++m.outN; }
    fx(() => {
      if(seat){
        const st = seat.querySelector('.gb-stamp'); st.textContent = why === 'late' ? '늦었다!' : '헛누름!'; st.className = 'gb-stamp on' + (why === 'false' ? ' f' : '');
        clearTimeout(st._t); st._t = setTimeout(() => { st.className = 'gb-stamp'; }, 1100);
        fxShake(seat, 7);
        const q = fxCenter(seat.querySelector('.gb-av'));
        fxEmit(q.x, q.y - q.h * .3, { quantity:8, speed:{ min:90, max:220 }, angle:{ min:-150, max:-30 }, lifespan:{ min:500, max:800 }, kind:'star', tint:['#FFD23F', '#FFFFFF'], scale:{ start:7, end:0 }, gravityY:420 });
      }
    });
    seatDraw(pid);
    if(me){ sfx(p.out ? 'gbOut' : 'gbLate'); fxBuzz(p.out ? [60, 40, 90] : [40, 30, 40]); fx(() => fxFlash('#FF2A44', .22, 220)); m.lock = m.t + .5; }
    else sfx(p.out ? 'gbOut' : why === 'false' ? 'gbFalse' : 'gbLate');
    if(p.out){
      const b = el('gbB' + idx); if(b){ b.className = 'gb-bub out on'; b.innerHTML = '<b>탈락</b>'; }
      if(m.duel && !me) fx(() => duelNotify(`${esc(p.nick)}님 탈락!`, { from:pplMap(m)[pid], kind:'good', force:true }));
      if(me && m.duel) note('탈락! 끝날 때까지 구경해요', 'bad');
    } else if(me) note(why === 'late' ? '늦었어요! 별 하나 잃음' : '내 차례가 아니에요! 별 하나 잃음', 'bad');
    syncAi(); hud(); btns();
  }
  /* 끝: 솔로는 내가 탈락하면 실패, 혼자 남으면 성공. 대전은 1명 남거나 시간이 다 되면 */
  function checkEnd(){
    const m = S(); if(!m) return true; if(m.phase === 'end') return true;
    const al = m.seats.filter(p => alive(m, p));
    if(!m.duel){
      if(m.P[m.me].out){ endSolo(false); return true; }
      if(al.length <= 1){ endSolo(true); return true; }
      return false;
    }
    if(al.length <= 1){ endDuel(al.length ? (al[0] === m.me ? '내가 끝까지 남았어요!' : `${esc(m.P[al[0]].nick)}님이 끝까지 남았어요`) : '모두 탈락했어요'); return true; }
    if(m.phase !== 'wait' && m.phase !== 'intro' && m.t - m.t0 > CAP){ endDuel('시간 끝! 남은 별로 순위를 매겼어요'); return true; }
    return false;
  }
  function stopAll(m){ m.phase = 'end'; m.dl = null; m.ai = null; m.aiF = []; m.pend = null; btns(); }
  function endSolo(win){
    const m = S(); stopAll(m);
    center({ big:win ? '1등!' : '탈락', who:win ? '끝까지 살아남았어요' : `${m.myCalls}번 외쳤어요`, cls:win ? 'win' : 'lose' });
    if(win){ sfx('gbWin'); fx(() => { const q = fxCenter(el('gbFelt')); fxRing(q.x, q.y, '#FFE27A', q.w * .55, .7, 12); fxEmit(q.x, q.y, { quantity:30, speed:{ min:150, max:380 }, lifespan:{ min:600, max:1100 }, kind:'twinkle', tint:['#FFFFFF', '#FFE27A', '#FFC2DD'], scale:{ start:7, end:0 }, gravityY:220, drag:1.1, glow:true }); }); }
    else sfx('gbLose');
    T(() => finish(win), win ? 1500 : 1600);
  }
  function endDuel(why){
    const m = S(); stopAll(m);
    const keys = m.seats.map(p => keyOf(m, p)), best = Math.max(...keys), top = keyOf(m, m.me) === best, tie = keys.filter(k => k === best).length > 1;
    center({ big:top ? (tie ? '공동 1위!' : '1위!') : '끝!', who:why, cls:top ? 'win' : 'lose' });
    sfx(top ? 'gbWin' : 'gbLose');
    if(top) fx(() => { const q = fxCenter(el('gbFelt')); fxRing(q.x, q.y, '#FFE27A', q.w * .55, .7, 12); });
    syncAi();
    T(() => fx(() => duelEndNow(why)), 1500);
  }
  function syncAi(){
    fx(() => { const m = S(), D = G.duel; if(!m || !D || !D.P || !D.P.ai || !m.P.ai) return; const q = m.P.ai;
      Object.assign(D.P.ai.st, { v:q.calls, lf:keyOf(m, 'ai'), mis:q.mis, pg:Math.min(1, m.n / 60) }); });
  }

  /* ---------- 누르기 ---------- */
  function press(c){
    const m = S(); if(!m || G.over || m.phase === 'end' || !alive(m, m.me)) return;
    pressFx(c);
    if(m.t < m.lock) return;
    if(m.phase !== 'turn'){ note(m.phase === 'pause' ? '잠깐! 다시 시작해요' : '노래가 끝나면 시작!', ''); return; }
    if(m.cur === m.me){ m.pend = null; myCall(c); return; }
    if(!m.pend) m.pend = { c, at:m.t };   /* 통신이 늦게 와서 아직 내 차례로 안 보일 수 있음 → 잠깐 기다렸다가 판정 */
  }
  function myCall(c){ const m = S(); m.lock = m.t + .12; act({ t:'c', pid:m.me, c }); }
  function pressFx(c){
    fx(() => { const b = document.querySelector(`.ng-gb .gb-b[data-c="${c}"]`); if(!b) return; b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); });
  }

  /* ---------- 그리기 ---------- */
  function showCall(e){
    const m = S(), C = CALL[e.c], idx = m.seats.indexOf(e.pid);
    /* 지난 외침: 바로 앞 사람 것만 흐리게 남기고 나머지는 지움(겹침 방지) */
    document.querySelectorAll('.ng-gb .gb-bub.on.old:not(.out)').forEach(b => { b.className = 'gb-bub'; });
    document.querySelectorAll('.ng-gb .gb-bub.on:not(.out)').forEach(b => b.classList.add('old'));
    const b = el('gbB' + idx);
    if(b){ b.className = 'gb-bub c-' + e.c; b.style.setProperty('--cc', C.col); b.style.setProperty('--ci', C.ink); b.innerHTML = `<span class="gb-bi">${ICON[e.c]}</span><b>${C.txt}!</b>`; void b.offsetWidth; b.classList.add('on'); }
    fx(() => { const a = document.querySelector(`#gbS${idx} .gb-av`); if(a){ a.classList.remove('hop'); void a.offsetWidth; a.classList.add('hop'); } });
    center({ big:C.txt + '!', who:nmOf(m, e.pid), col:C.col, ink:C.ink, pid:e.pid, dir:e.c === 'back' ? 'flip' : true });
    m.log.push({ pid:e.pid, c:e.c }); if(m.log.length > 4) m.log.shift();
    const lg = el('gbLog');
    if(lg) lg.innerHTML = m.log.map((x, i) => `<span class="gb-lc${i === m.log.length - 1 ? ' new' : ''}" style="--sc:${m.P[x.pid].col};--cc:${CALL[x.c].col}"><i></i>${esc(nmOf(m, x.pid))} <b>${CALL[x.c].txt}</b></span>`).join('<em aria-hidden="true">›</em>');
    arc(idx, e.d, e.c);
    sfx('gb' + e.c[0].toUpperCase() + e.c.slice(1));
    say(C.say, 1.7);
    hud();
  }
  /* 테이블 위 화살표: 외친 사람 자리에서 방향대로(점프는 한 자리를 넘는 호) */
  function arc(idx, d, c){
    fx(() => {
      const m = S(), svg = el('gbArc'), L = m.geo; if(!svg || !L) return;
      const n = m.seats.length, view = (idx - m.seats.indexOf(m.me) + n) % n, gap = 360 / n;
      const th0 = 90 + view * gap, span = d * gap * (c === 'jump' ? 1.62 : .64), N = 26, pts = [];
      for(let i = 0; i <= N; i++){
        const t = i / N, th = (th0 + span * t) * Math.PI / 180, f = c === 'jump' ? .74 - .2 * Math.sin(Math.PI * t) : .74;
        pts.push([L.cx + L.rx * f * Math.cos(th), L.cy + L.ry * f * Math.sin(th)]);
      }
      const [x1, y1] = pts[N], [x0, y0] = pts[N - 2], ang = Math.atan2(y1 - y0, x1 - x0), hs = 13;
      const head = `${x1 + Math.cos(ang) * 4},${y1 + Math.sin(ang) * 4} ${x1 + Math.cos(ang + 2.5) * hs},${y1 + Math.sin(ang + 2.5) * hs} ${x1 + Math.cos(ang - 2.5) * hs},${y1 + Math.sin(ang - 2.5) * hs}`;
      const dpath = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
      const col = CALL[c].col, u = 'ga' + (++UID);
      svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
      svg.innerHTML = `<g class="gb-ar" id="${u}"><path d="${dpath}" fill="none" stroke="${OL}" stroke-width="11" stroke-linecap="round" opacity=".55"/><path d="${dpath}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"${c === 'jump' ? ' stroke-dasharray="2 11"' : ''}/><polygon points="${head}" fill="${col}" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/></g>`;
    });
  }
  function center(o){
    const m = S(); if(!m) return;
    const big = el('gbBig'), who = el('gbWho'), dir = el('gbDir');
    if(big && o.big != null){ big.className = 'gb-big' + (o.cls ? ' ' + o.cls : ''); big.textContent = o.big; if(o.col){ big.style.setProperty('--cc', o.col); big.style.setProperty('--ci', o.ink); } else { big.style.removeProperty('--cc'); big.style.removeProperty('--ci'); } fx(() => { void big.offsetWidth; big.classList.add('pop'); }); }
    if(who && o.who != null) who.innerHTML = o.pid ? `<i style="--sc:${m.P[o.pid].col}"></i>${esc(o.who)}` : esc(o.who);
    if(dir && o.dir){
      const cw = m.dir === 1;
      dir.className = 'gb-dir ' + (cw ? 'cw' : 'ccw') + (o.dir === 'flip' ? ' flip' : '');
      dir.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><g${cw ? '' : ' transform="matrix(-1 0 0 1 24 0)"'}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M18.4 2.6l-.6 4.9-4.9-.4" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg><span>${cw ? '시계 방향' : '반대 방향'}</span>`;
      dir.setAttribute('aria-label', '지금 방향: ' + (cw ? '시계 방향' : '반대 방향'));
    }
  }
  function restartShow(){
    const m = S(); if(!m) return;
    const who = m.cur;
    center({ big:'다시!', who:`${nmOf(m, who)}부터 고 백 점프!`, cls:'again', dir:true });
    document.querySelectorAll('.ng-gb .gb-bub.on:not(.out)').forEach(b => b.className = 'gb-bub');
    const lg = el('gbLog'); if(lg) lg.innerHTML = ''; m.log = [];
    fx(() => { const s = el('gbArc'); if(s) s.innerHTML = ''; });
    say('고 백 점프', 1.5);
    [0, 1, 2].forEach(i => T(() => sfx('gbBeat', { hi:i === 0, n:i }), 450 + i * 300));
  }
  let noteT = 0;
  function note(txt, cls){
    const n = el('gbNote'); if(!n) return;
    n.textContent = txt; n.className = 'gb-note' + (cls ? ' ' + cls : ''); void n.offsetWidth; n.classList.add('on');
    clearTimeout(noteT); noteT = setTimeout(() => n.classList.remove('on'), 1300);
  }
  function seatDraw(pid){
    const m = S(), idx = m.seats.indexOf(pid), s = el('gbS' + idx); if(!s) return;
    const p = m.P[pid], lf = leftOf(m, pid);
    s.classList.toggle('out', !!p.out || lf);
    const lv = s.querySelector('.gb-lv'); if(lv) lv.innerHTML = lf ? '나감' : Array.from({ length:p.maxL }, (_, i) => `<i class="${i < p.lives ? '' : 'off'}">★</i>`).join('');
    s.setAttribute('aria-label', `${p.nick} · 기회 별 ${p.lives}개${p.out ? ' · 탈락' : ''}`);
  }
  function hud(){
    const m = S(); if(!m) return;
    const al = m.seats.filter(p => alive(m, p)).length;
    const a = el('gbAlive'); if(a) a.textContent = al;
    const w = el('gbSpd'); if(w) w.textContent = beatW(m, m.n).toFixed(1);
    const c = el('gbCnt'); if(c) c.textContent = m.myCalls;
  }
  function btns(){
    const m = S(); if(!m) return;
    const off = m.phase === 'end' || !alive(m, m.me);
    document.querySelectorAll('.ng-gb .gb-b').forEach(b => { b.disabled = off; });
    const r = el('gbRoot'); if(r) r.classList.toggle('watch', !!(m.duel && m.P[m.me].out && m.phase !== 'end'));
  }
  /* 자리 배치: 나는 늘 맨 아래, 시계 방향(화면에서 아래 → 왼쪽 → 위 → 오른쪽)으로 참가 순서 */
  function layout(){
    const m = S(), root = el('gbRoot'); if(!m || !root) return;
    const top = root.getBoundingClientRect().top + (window.scrollY || 0);
    const H = Math.max(500, Math.min(900, (innerHeight || 760) - top - 8));
    root.style.height = H + 'px';
    const tb = el('gbTable'); if(!tb) return;
    const w = tb.clientWidth, h = tb.clientHeight, n = m.seats.length;
    const big = n >= 5 ? 56 : 62, meSz = Math.min(84, Math.max(66, h * .15));
    const fw = Math.min(w - big - 12, h * .78), fh = Math.min(h - meSz - 64, fw * 1.45);
    const cx = w / 2, cy = 12 + big / 2 + (fh / 2);
    m.geo = { w, h, cx, cy, rx:fw / 2, ry:fh / 2 };
    const felt = el('gbFelt'); if(felt){ felt.style.width = fw + 'px'; felt.style.height = fh + 'px'; felt.style.left = (cx - fw / 2) + 'px'; felt.style.top = (cy - fh / 2) + 'px'; }
    tb.style.setProperty('--av', big + 'px'); tb.style.setProperty('--avme', Math.round(meSz) + 'px');
    const meI = m.seats.indexOf(m.me);
    m.seats.forEach((pid, i) => {
      const s = el('gbS' + i); if(!s) return;
      const v = (i - meI + n) % n, th = (90 + v * 360 / n) * Math.PI / 180;
      const x = cx + (fw / 2 + 2) * Math.cos(th), y = cy + (fh / 2 + 2) * Math.sin(th);
      s.style.left = Math.max(big / 2 + 2, Math.min(w - big / 2 - 2, x)) + 'px'; s.style.top = y + 'px';
      /* 말풍선: 얼굴 옆(가운데 쪽). 위·아래 가운데 자리는 오른쪽 옆, 내 자리는 왼쪽 위 */
      const dx = cx - x, a = v === 0 ? meSz : big;
      let bx, by;
      if(v === 0){ bx = -(a / 2 + 40); by = -a * .3; }
      else if(Math.abs(dx) < 24){ bx = a / 2 + 42; by = 4; }
      else { bx = Math.sign(dx) * (a / 2 + 40); by = -4; }
      s.style.setProperty('--bx', bx.toFixed(1) + 'px'); s.style.setProperty('--by', by.toFixed(1) + 'px');
    });
    fx(() => { const sv = el('gbArc'); if(sv) sv.setAttribute('viewBox', `0 0 ${w} ${h}`); });
  }
  const damask = () => {
    const p = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><g fill='none' stroke='%23A8324E' stroke-width='1.6' opacity='.55'><path d='M32 6c6 8 6 14 0 20-6-6-6-12 0-20zM32 58c6-8 6-14 0-20-6 6-6 12 0 20z'/><path d='M6 32c8-6 14-6 20 0-6 6-12 6-20 0zM58 32c-8-6-14-6-20 0 6 6 12 6 20 0z'/><circle cx='32' cy='32' r='4'/><path d='M14 14q6 2 8 8M50 14q-6 2-8 8M14 50q6-2 8-8M50 50q-6-2-8-8'/></g><g fill='%23A8324E' opacity='.4'><circle cx='0' cy='0' r='2.4'/><circle cx='64' cy='0' r='2.4'/><circle cx='0' cy='64' r='2.4'/><circle cx='64' cy='64' r='2.4'/></g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(p.replace(/%23/g, '#'))}")`;
  };

  /* ---------- 흐름(그림 틀마다) ---------- */
  function loop(now){
    const m = S(); if(!m || G.over || m.dead) return;
    G.raf = requestAnimationFrame(loop);
    const dt = m.lt ? Math.min(.1, (now - m.lt) / 1000) : 0; m.lt = now;
    if(G.paused) return;
    m.t += dt;
    tick();
  }
  function tick(){
    const m = S(); if(!m || G.over || m.phase === 'end') return;
    if(m.phase === 'wait'){ if(!m.duel || (G.duel && G.duel.go)) startIntro(); return; }
    if(m.phase === 'intro'){ introTick(); if(m.t >= m.introEnd) startTurn(); }
    else if(m.phase === 'pause'){ if(m.t >= m.pauseEnd) startTurn(); }
    else if(m.phase === 'turn'){
      if(m.ai && m.t >= m.ai.at){ const a = m.ai; m.ai = null; act({ t:a.kind, pid:m.cur, c:a.c }); }
      else if(m.cur === m.me && m.dl != null && m.t > m.dl){ m.dl = null; act({ t:'m', pid:m.me }); }
      if(m.phase === 'turn' && m.aiF.length){ const due = m.aiF.filter(f => m.t >= f.at); m.aiF = m.aiF.filter(f => m.t < f.at); due.forEach(f => { if(m.phase === 'turn' && m.cur !== f.pid && alive(m, f.pid)) act({ t:'x', pid:f.pid }); }); }
      if(m.phase === 'turn' && m.cfg.hint && !m.hintOn && m.t - m.ts > m.W * .45){ m.hintOn = true; const s = el('gbS' + m.seats.indexOf(m.cur)); if(s) s.classList.add('hint'); }
      if(m.phase === 'turn' && m.duel && !isLocal(m, m.cur) && leftOf(m, m.cur)) act({ t:'p', pid:m.cur }, false);   /* 차례인 사람이 나감: 모든 기기가 같이 건너뜀 */
    }
    if(m.pend && m.t - m.pend.at > grace(m)){ m.pend = null; if(m.phase === 'turn' && m.cur !== m.me && alive(m, m.me)) act({ t:'x', pid:m.me }); }
    if(m.duel && m.phase !== 'end' && m.phase !== 'intro') checkEnd();
  }

  return {
    name:'고백점프', abil:'순발력', col:['#FF9AAE', '#D4142F', '#6E0716'], time:'약 2분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c5.2 0 9.5 3.8 9.5 8.5s-4.3 8.5-9.5 8.5S2.5 16.7 2.5 12 6.8 3.5 12 3.5zm0 2.6c-3.9 0-6.9 2.7-6.9 5.9s3 5.9 6.9 5.9 6.9-2.7 6.9-5.9-3-5.9-6.9-5.9z"/><circle cx="12" cy="4.6" r="2.4"/><circle cx="20" cy="12" r="2.4"/><circle cx="4" cy="12" r="2.4"/><path d="M8 12h6.5l-2.4-2.4 1.2-1.2 4.4 4.4-4.4 4.4-1.2-1.2 2.4-2.4H8z"/></svg>',
    art(){
      const u = 'gbA' + (++UID) + Math.floor(performance.now() % 1e5);
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <radialGradient id="${u}f" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#F0284A"/><stop offset=".6" stop-color="#B5122C"/><stop offset="1" stop-color="#6E0716"/></radialGradient>
        <linearGradient id="${u}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A3A2C"/><stop offset="1" stop-color="#241410"/></linearGradient></defs>
        <rect width="160" height="100" fill="#2A0A12"/>
        <g fill="none" stroke="#A8324E" stroke-width="1" opacity=".45"><path d="M10 10c3 4 3 7 0 10-3-3-3-6 0-10zM150 10c3 4 3 7 0 10-3-3-3-6 0-10zM10 80c3 4 3 7 0 10-3-3-3-6 0-10zM150 80c3 4 3 7 0 10-3-3-3-6 0-10z"/></g>
        <ellipse cx="80" cy="52" rx="62" ry="38" fill="url(#${u}r)"/><ellipse cx="80" cy="52" rx="55" ry="32" fill="url(#${u}f)"/>
        <ellipse cx="80" cy="52" rx="47" ry="25" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.2"/>
        <path d="M58 38a26 16 0 0 1 44 0" fill="none" stroke="#FFE27A" stroke-width="3" stroke-linecap="round"/><path d="M98 32l5 6-7 2" fill="none" stroke="#FFE27A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${[['고', '#20C063', 46], ['백', '#FF8A1A', 80], ['점프', '#A66BFF', 114]].map(([t, c, x]) => `<g transform="translate(${x} 60)"><rect x="-15" y="-11" width="30" height="22" rx="11" fill="#fff" stroke="${c}" stroke-width="3"/><text x="0" y="5" text-anchor="middle" font-size="${t.length > 1 ? 11 : 14}" font-weight="900" fill="${c}" font-family="sans-serif">${t}</text></g>`).join('')}
        ${toyImage('fox', 66, 72, 28, 28)}${toyImage('rabbit', 8, 36, 24, 24)}${toyImage('bear', 128, 36, 24, 24)}${toyImage('cat', 68, 0, 24, 24)}</svg>`;
    },
    help:[
      ['노래가 끝나면 시작', '"고 백 점프 ~ 고 백 점프!" 노래가 끝나면 시작하는 사람부터 고·백·점프 중 하나를 외쳐요(아래 큰 버튼).'],
      ['고 · 백 · 점프', '고는 지금 방향(처음엔 시계 방향)으로 다음 사람. 백은 방향을 바꿔 반대쪽 사람. 점프는 한 사람을 건너뛰고 그다음 사람.'],
      ['내 차례는 스스로 알아채요', '화면은 누구 차례인지 알려 주지 않아요. 앞사람의 말풍선·화살표·가운데 큰 글자를 보고 내 차례면 박자 안에 바로 눌러요.'],
      ['늦거나 헛누르면 별이 줄어요', '내 차례에 늦으면 별 하나를 잃고 나부터 다시 시작해요. 내 차례가 아닌데 누르면(헛누름) 별 하나. 별이 다 없으면 탈락, 끝까지 남은 사람이 1등!']
    ],
    howto:{
      pic(){
        return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="16" fill="#2A0A12"/>
          <ellipse cx="160" cy="92" rx="118" ry="68" fill="#4A2A20"/><ellipse cx="160" cy="92" rx="108" ry="60" fill="#C3162F"/>
          ${toyImage('fox', 142, 140, 36, 36)}${toyImage('rabbit', 30, 74, 36, 36)}${toyImage('bear', 142, 6, 36, 36)}${toyImage('cat', 254, 74, 36, 36)}
          <path d="M140 150C100 150 70 136 64 116" fill="none" stroke="#20C063" stroke-width="6" stroke-linecap="round"/><path d="M58 124l6-10 9 6" fill="none" stroke="#20C063" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
          <g transform="translate(110 118)"><rect x="-20" y="-14" width="40" height="28" rx="14" fill="#fff" stroke="#20C063" stroke-width="3.5"/><text x="0" y="7" text-anchor="middle" font-size="18" font-weight="900" fill="#0B5B2A" font-family="sans-serif">고</text></g>
          <g transform="translate(160 92)"><rect x="-44" y="-15" width="88" height="30" rx="15" fill="#fff" fill-opacity=".92"/><text x="0" y="6" text-anchor="middle" font-size="15" font-weight="800" fill="#6E0716" font-family="sans-serif">시계 방향</text></g></svg>`;
      },
      lines:['고: 시계 방향 다음 사람에게', '백: 방향을 바꿔 반대쪽으로', '점프: 한 사람 건너뛰기']
    },
    chapters:['동네 노래방', '대학 축제', '캠핑장 모닥불', '한강 돗자리', '왕중왕 무대'],
    starRule:'★ 끝까지 남기 · ★★ 별 2개 이상 남기고 · ★★★ 한 번도 안 틀리고',
    levels:LEVELS,
    levelDesc(lv){ const c = LEVELS[lv] || LEVELS.normal; return `컴퓨터 ${c.cpu}명 · 박자 ${c.w0}→${c.w1}초`; },
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `컴퓨터 ${c.cpu}명 · 박자 ${c.w0}→${c.w1}초${c.hint ? ' · 차례 도움' : ''}`; },
    init(cfg, rng){
      const m = initState(cfg || LEVELS.normal, rng);
      G.m = m; G.limit = 0;
      G.cleanup = () => {
        m.dead = true; hush(); clearTimeout(noteT);
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(m.onKey) removeEventListener('keydown', m.onKey);
        if(G && G.raf) cancelAnimationFrame(G.raf);
      };
    },
    render(st){
      const m = S(); if(!m) return;
      const n = m.seats.length;
      const seats = m.seats.map((pid, i) => { const p = m.P[pid];
        return `<div class="gb-seat${p.me ? ' me' : ''}" id="gbS${i}" style="--sc:${p.col}" role="img">
          <div class="gb-av">${toyImg(p.kind, 'gb-avimg')}</div>
          <div class="gb-nm"><b>${esc(p.nick)}${p.ai && m.duel ? ' <em>컴퓨터</em>' : ''}</b><span class="gb-lv"></span></div>
          <div class="gb-bub" id="gbB${i}" aria-hidden="true"></div>
          <div class="gb-stamp" aria-hidden="true"></div></div>`; }).join('');
      st.innerHTML = `<div class="ng-gb" id="gbRoot">
        <div class="hud-row">
          <div class="hchip" aria-label="남은 사람"><span class="hv">${HICO.ppl}<b id="gbAlive">${n}</b><small>/${n}</small></span><em>남은 사람</em></div>
          <div class="hchip" aria-label="지금 박자"><span class="hv">${HICO.beat}<b id="gbSpd">${m.cfg.w0.toFixed(1)}</b><small>초</small></span><em>박자</em></div>
          <div class="hchip" aria-label="내가 외친 수"><span class="hv">${HICO.cnt}<b id="gbCnt">0</b></span><em>외친 수</em></div>
        </div>
        <div class="gb-table" id="gbTable">
          <div class="gb-felt" id="gbFelt"><span class="gb-mark" aria-hidden="true">GO · BACK · JUMP</span>
            <div class="gb-center" role="status" aria-live="polite"><div class="gb-dir cw" id="gbDir"></div><div class="gb-big" id="gbBig">준비</div><div class="gb-who" id="gbWho">${m.duel ? '모두 모이면 노래가 나와요' : '노래가 끝나면 나부터!'}</div><div class="gb-log" id="gbLog"></div></div></div>
          <svg class="gb-arc" id="gbArc" aria-hidden="true"></svg>
          ${seats}
          <div class="gb-note" id="gbNote" role="status"></div>
        </div>
        <div class="gb-btns">${KEYS.map((k, i) => `<button class="gb-b b-${k}" data-c="${k}" style="--cc:${CALL[k].col};--ci:${CALL[k].ink}" aria-label="${CALL[k].txt} 외치기 (${i + 1})"><span class="gb-bi">${ICON[k]}</span><b>${CALL[k].txt}</b></button>`).join('')}</div>
      </div>`;
      document.querySelectorAll('.ng-gb .gb-b').forEach(b => { b.onpointerdown = e => { e.preventDefault(); press(b.dataset.c); }; b.onclick = e => { if(e.detail === 0) press(b.dataset.c); }; });
      fx(() => el('gbTable').style.setProperty('--dmk', damask()));
      m.seats.forEach(seatDraw); center({ dir:true }); hud(); btns(); layout();
      m.onResize = () => layout(); addEventListener('resize', m.onResize);
      m.onKey = e => {
        if(!G || G.m !== m || G.over || (document.getElementById('veil') && document.getElementById('veil').classList.contains('on'))) return;
        const c = { '1':'go', '2':'back', '3':'jump', ArrowRight:'go', ArrowLeft:'back', ArrowUp:'jump', ' ':'go' }[e.key];
        if(!c || e.repeat) return; e.preventDefault(); press(c);
      };
      addEventListener('keydown', m.onKey);
      if(m.duel) T(() => layout(), 300);
      if(G.raf) cancelAnimationFrame(G.raf);
      m.lt = 0; G.raf = requestAnimationFrame(loop);
      m.iv = setInterval(() => { if(!G || G.m !== m || G.over || m.dead){ clearInterval(m.iv); return; } if(document.hidden && !G.paused){ m.t += .2; tick(); } }, 200);   /* 화면이 가려져 그림이 멈춰도 대전 차례는 돌게 */
      m.timers.add(m.iv);
    },
    progress(){ const m = S(); if(!m) return 0; if(m.duel) return Math.min(1, m.n / 60); const cpus = m.seats.filter(p => p !== m.me); return cpus.length ? cpus.filter(p => m.P[p].out).length / cpus.length : 0; },
    lossText(){ const m = S(); if(!m) return ''; const left = m.seats.filter(p => p !== m.me && alive(m, p)).length; return `${m.myCalls}번 외치고 탈락했어요 · 컴퓨터 ${left}명이 남았어요.`; },
    score(){
      const m = S(), p = m.P[m.me];
      const base = 500, time = Math.min(300, m.myCalls * 15), extra = 100 * Math.max(0, p.lives);
      return { base, time, extra, rows:['끝까지 살아남기', `외친 수 ${m.myCalls}번`, `남은 별 ${p.lives}개`] };
    },
    stars(){ const m = S(), p = m.P[m.me]; return p.mis === 0 ? 3 : p.lives >= 2 ? 2 : 1; },
    winTitle:'끝까지 살아남았어요!',
    modes:['solo', 'duel'],
    /* 대전 v3: 2~5명. 차례는 이 게임이 직접(차례인 사람 기기가 다음 사람을 정해 보냄). 공용 차례 엔진(duelTurn)은 순서가 참가 순서로 고정이고
       위 칩 줄에 '차례' 꼬리표를 띄워(이 게임은 누구 차례인지 숨겨야 함) 쓰지 않는다 → 종류는 점수전('score'), 끝은 게임이 알림('game') */
    duelKind:'score', duelMax:5, duelEnd:'game', duelReplay:false,
    duelHow:'2~5명 고·백·점프 · 늦거나 헛누르면 별 −1 · 끝까지 남으면 1등',
    duelCfg:o => ({ w0:1.9, w1:.95, lives:o && o.n >= 4 ? 2 : 3, aiMiss:.05, aiMissK:.15, aiFalse:.015, jumpP:.24, ramp:30, limit:0, duel:1 }),
    duelSlow:cfg => Object.assign({}, cfg, { w0:+(cfg.w0 * 1.4).toFixed(2), w1:+(cfg.w1 * 1.4).toFixed(2) }),
    duelAi:() => null,   /* 컴퓨터 상대는 이 게임이 직접 외친다 */
    duelRank(a, b){ return ((b.lf || 0) - (a.lf || 0)) || ((b.v || 0) - (a.v || 0)) || ((a.mis || 0) - (b.mis || 0)); },
    duelStat:{ unit:'번', get:() => { const m = S(); if(!m) return { v:0 }; const p = m.P[m.me]; return { v:p.calls, mis:p.mis, lf:keyOf(m, m.me) }; } },
    onDuelEvent(ev, from){ if(ev && ev.kind === 'gb' && from) recv(from.pid, ev.data); },
    duelHelp:[
      ['노래가 끝나면 시작', '모두 같은 순간에 "고 백 점프 ~ 고 백 점프!" 노래가 나오고, 참가 순서 첫 사람부터 외쳐요.'],
      ['고 · 백 · 점프', '고 = 지금 방향 다음 사람 · 백 = 방향을 바꿔 반대쪽 · 점프 = 한 사람 건너뛰기.'],
      ['별 2~3개', '늦으면 별 −1(그 사람부터 다시), 헛누름도 별 −1. 별이 없으면 탈락, 끝까지 남은 사람이 1등. 2분 30초가 지나면 남은 별로 순위.']
    ],
    sounds:{
      gbBeat(o){ const hi = o && o.hi; aThump({ f:hi ? 150 : 120, f2:55, d:.14, v:hi ? .22 : .14 }); aNoise({ ft:'highpass', f:hi ? 5000 : 7000, d:.05, v:.035 }); aMarimba(m2f([72, 74, 76, 79][((o && o.n) || 0) % 4]), { v:.07, d:.2 }); },
      gbStart(){ aWhoosh({ f:600, f2:3200, d:.25, v:.05 }); [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(72 + d), { t:i * .05, v:.1 })); },
      gbGo(){ aMarimba(m2f(76), { v:.15, d:.25 }); aMarimba(m2f(83), { t:.05, v:.1, d:.25 }); },
      gbBack(){ aTone({ f:700, f2:420, type:'triangle', d:.14, v:.08 }); aMarimba(m2f(71), { t:.06, v:.12, d:.25 }); },
      gbJump(){ aTone({ f:420, f2:1250, type:'triangle', d:.16, v:.08 }); aMarimba(m2f(84), { t:.1, v:.11, d:.3 }); },
      gbLate(){ aTone({ f:330, f2:200, type:'square', lp:900, d:.2, v:.07 }); aThump({ f:110, f2:50, d:.22, v:.18 }); },
      gbFalse(){ aTone({ f:520, f2:300, type:'square', lp:1200, d:.12, v:.06 }); aTone({ f:300, type:'square', lp:900, t:.09, d:.14, v:.05 }); },
      gbOut(){ aThump({ f:120, f2:40, d:.4, v:.25 }); aTone({ f:392, f2:180, type:'sawtooth', lp:1300, d:.55, v:.06 }); },
      gbWin(){ [0, 2, 4, 7, 9, 12].forEach((d, i) => aMarimba(penta(d, 72), { t:i * .06, v:.14 })); aSparkle({ t:.35, n:6 }); },
      gbLose(){ aTone({ f:392, f2:262, type:'triangle', d:.5, v:.08 }); }
    },
    gate:{ gbBeat:60, gbGo:50, gbBack:50, gbJump:50, gbFalse:120, gbLate:120 },
    jingle(){ [0, 2, 4, 7].forEach((d, i) => aMarimba(penta(d, 72), { t:i * .09, v:.15 })); aBell({ f:m2f(84), t:.4, d:1, v:.06, rev:.4 }); aSparkle({ t:.45, n:5 }); },
    /* 점검용 */
    _test:{
      state(){ const m = S(); if(!m) return null; return { phase:m.phase, cur:m.cur, me:m.me, dir:m.dir, n:m.n, W:m.W, seats:m.seats.slice(), lives:Object.fromEntries(m.seats.map(p => [p, m.P[p].lives])), out:m.seats.filter(p => m.P[p].out), calls:m.myCalls, tr:m.tr.join(' ') }; },
      press:c => press(c), step:(from, d, k) => step(S(), from, d, k)
    }
  };
})();
NG.goback.scene = { kind:'motes', colors:['#FFD9A8', '#FF9AAE', '#FFFFFF'], density:.4, alpha:.35 };
