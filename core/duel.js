/* 1:1 대전(모든 게임 공용): 상대 찾기 · AI 상대 · 동시 시작 · 진행 막대 · 알림 · 승패 판정.
   게임마다 다른 값은 게임 정의의 duelPace·duelStat·duelHow·duelLaunch에서 읽는다. */
/* ---- 대전: 같은 문제를 동시에 풀고 게임 점수로 승부. 함대는 기존 턴제 실시간 ---- */
const DUEL_NICK_A = ['재빠른','느긋한','꼼꼼한','용감한','반짝이는','새벽의','번개','조용한','씩씩한','영리한'];
const DUEL_NICK_B = ['토끼','곰','고양이','강아지','판다','호랑이'];   /* 동물 얼굴(FACE_KIND)과 짝 */
const duelNick = () => DUEL_NICK_A[Math.floor(Math.random() * DUEL_NICK_A.length)] + ' ' + DUEL_NICK_B[Math.floor(Math.random() * DUEL_NICK_B.length)];
const duelLive = () => ROOM_STATE === 'ok' && !!ROOM && netUp();
function duelRec(){ return store.get('hp:duelRec', null) || {}; }
function duelWaiting(id){ try{ return ROOM ? ROOM.peers().filter(p => !p.sameTab && p.presence && p.presence.du === 'wait' && (!id || p.presence.dg === id)).length : 0; }catch(_){ return 0; } }
const oppAv = nick => { const k = DUEL_NICK_B.findIndex(a => String(nick || '').endsWith(a)), i = k >= 0 ? k : seedFrom(nick || '?') % 6; return `<span class="av" style="--avbg:${FACE_BG[i]}">${animalFace(FACE_KIND[i])}</span>`; };


let DS = null;   /* 상대 찾기 상태 */
function duelStart(id){
  if(!HOST.canDuel()) return;
  if(NG[id].duelLaunch){ NG[id].duelLaunch(); return; }   /* 함대: 자기 방식의 대전 */
  duelSearch(id);
}
function duelSearchStop(){
  if(!DS) return;
  clearInterval(DS.iv); clearTimeout(DS.to); if(DS.un) try{ DS.un(); }catch(_){}
  if(DS.nr && !DS.keep) try{ DS.nr.leave(); }catch(_){}
  if(ROOM && DS.live) ROOM.presence({ du:null, dg:null, dt:null, dp:null, nk:null }).catch(() => {});
  DS = null;
}
function duelSearch(id){
  duelSearchStop();
  const S = DS = { id, nick:duelNick(), t0:Date.now(), live:duelLive(), phase:'search' };
  const WAIT = 12;
  /* 실시간 연결이 없으면 '찾는 중' 연출 없이 처음부터 AI 상대를 보여 준다(표시만, 흐름은 그대로) */
  const opp = S.live ? `<span class="ds-radar"><i></i><i></i><i></i></span><b id="dsOppN">찾는 중…</b><small id="dsOppS"></small>`
    : `<span class="av" style="--avbg:#E6DAFF">${toyImg('owl')}</span><b id="dsOppN">AI 상대</b><small id="dsOppS">곧 시작해요</small>`;
  openModal(`<div class="dsearch${S.live ? '' : ' ai'}" style="--gc:${GCOL[id][1]}"><p class="kick">1:1 대전</p><h3>${GAMES[id].name}</h3>
    <div class="vsrow"><div class="vs-side">${avatar({ me:true })}<b>나</b><small>${esc(S.nick)}</small></div><div class="vs-x">VS</div>
      <div class="vs-side op" id="dsOpp">${opp}</div></div>
    <p class="note" id="dsTxt"></p>
    ${HOST.duelRewardHtml()}
    <div class="mbtns"><button class="b2" id="dsCancel">취소</button><button class="b1" id="dsAi">${S.live ? 'AI와 바로 대전' : '바로 시작'} ${costTag()}</button></div></div>`);
  $('#modal').classList.add('duelm');
  sfx('flPing');
  $('#dsCancel').onclick = () => { duelSearchStop(); closeModal(); };
  $('#dsAi').onclick = () => duelGoAI(S);
  const text = () => {
    if(DS !== S) return;
    const left = Math.max(0, WAIT - Math.floor((Date.now() - S.t0) / 1000)), t = $('#dsTxt'); if(!t) return;
    if(S.phase === 'join'){ t.innerHTML = '상대를 찾았어요! 연결하는 중…'; return; }
    if(!S.live){ t.innerHTML = '<b>지금은 AI와 겨뤄요.</b> 실시간 서버에 연결되면 사람과 붙어요.'; return; }
    const n = duelWaiting(id);
    t.innerHTML = `<b class="num">${left}초</b> 안에 상대가 없으면 AI와 붙어요${n ? ` · 기다리는 사람 ${n}명` : ''}`;
    if(left <= 0) duelGoAI(S);
  };
  text();
  if(!S.live){ S.to = setTimeout(() => duelGoAI(S), 1600); return; }
  ROOM.presence({ du:'wait', dg:id, dt:S.t0, nk:S.nick, dp:null }).catch(() => {});
  const check = () => {
    if(DS !== S || S.phase !== 'search') return;
    let ps; try{ ps = ROOM.peers(); }catch(_){ return; }
    const me = ps.find(p => p.sameTab); if(!me) return;
    S.myPeer = me.peer;
    const claim = ps.find(p => !p.sameTab && p.presence && p.presence.du === 'play' && p.presence.dg === id && p.presence.dp === me.peer);
    if(claim){ duelMatch(S, claim); return; }
    const list = ps.filter(p => p.presence && p.presence.du === 'wait' && p.presence.dg === id && typeof p.presence.dt === 'number')
      .sort((a, b) => a.presence.dt - b.presence.dt || (a.peer < b.peer ? -1 : 1));
    const i = list.findIndex(p => p.sameTab); if(i < 0) return;
    const opp = list[i % 2 ? i - 1 : i + 1]; if(opp) duelMatch(S, opp);
  };
  try{ S.un = ROOM.onPeers(check, () => {}); }catch(_){}
  S.iv = setInterval(() => { check(); text(); }, 500);
}
async function duelMatch(S, opp){
  if(S.phase !== 'search') return;
  S.phase = 'join'; clearInterval(S.iv); if(S.un) try{ S.un(); }catch(_){} S.un = null;
  const nick = String((opp.presence && opp.presence.nk) || '상대').slice(0, 12);
  const on = $('#dsOppN'), os = $('#dsOppS'), ob = $('#dsOpp');
  if(on){ on.textContent = nick; os.textContent = '실시간 상대'; ob.querySelector('.ds-radar').outerHTML = oppAv(nick); }
  sfx('flLock'); fxBuzz([20, 40, 20]);
  ROOM.presence({ du:'play', dp:opp.peer }).catch(() => {});
  const a = [S.myPeer, opp.peer].map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)).sort();
  const name = ('du-' + a[0] + '-' + a[1]).slice(0, 60);
  let nr;
  try{ nr = await ROOM.join(name); }catch(_){ if(DS === S){ S.phase = 'search'; toast('상대와 연결하지 못했어요. 다시 찾을게요'); duelSearch(S.id); } return; }
  if(DS !== S){ try{ nr.leave(); }catch(_){} return; }
  S.nr = nr; nr.presence({ nk:S.nick, nw:store.get('hp:help:' + S.id, false) ? 0 : 1, pg:0, dn:0, sc:0 }).catch(() => {});
  /* 두 사람이 모두 방에 들어오면 시작(최대 6초) */
  const t0 = Date.now();
  S.iv = setInterval(() => {
    if(DS !== S) return;
    let ps = []; try{ ps = nr.peers(); }catch(_){}
    const o = ps.find(p => !p.sameTab), meP = ps.find(p => p.sameTab);
    /* 상대 정보(nk)까지 받으면 시작. 방장(peer가 작은 쪽)이 서버 시각으로 시작 시각을 정해 알림 → 두 사람이 같은 순간에 시작 */
    if((o && o.presence && o.presence.nk) || Date.now() - t0 > 6000){
      clearInterval(S.iv);
      if(!o){ try{ nr.leave(); }catch(_){} S.nr = null; toast('상대가 떠났어요. 다시 찾을게요'); duelSearch(S.id); return; }
      S.keep = true;
      const duel = { mode:'pvp', seed:name + ':' + dayKey(), nr, oppPeer:o.peer, myNick:S.nick, opp:{ nick, pg:0, dn:0, sc:0 }, me:null };
      const myId = String((meP && meP.peer) || S.myPeer || '');
      if(myId && myId < String(o.peer)){
        const fresh = !store.get('hp:help:' + S.id, false) || !!(o.presence && o.presence.nw);
        const srv = netNow() + (fresh ? 4000 : 2500);   /* 준비 1초(처음 하는 게임이면 2.5초) + 3·2·1 각 0.5초 */
        duel.startAt = duelLocalStart(srv); nr.presence({ go:srv }).catch(() => {});
      }
      duelSearchStop(); closeModal(); startGame(S.id, 'normal', { duel });
    }
  }, 250);
}
function duelGoAI(S){
  if(DS !== S || S.phase === 'join') return;
  const id = S.id, nick = duelNick(), seed = 'ai:' + id + ':' + Date.now() + ':' + Math.random();
  const duel = { mode:'ai', seed, myNick:S.nick, startAt:Date.now() + (store.get('hp:help:' + id, false) ? 2000 : 3500), opp:{ nick, pg:0, dn:0, sc:0 }, ai:duelAiPlan(id, mulberry(seedFrom(seed + 'p'))), me:null };
  duelSearchStop(); closeModal(); startGame(id, 'normal', { duel });
}
/* AI 상대: 게임별 평균 시간·성공률로 결과를 미리 정하고, 경과 시간에 맞춰 진행도를 보여 준다 */
function duelAiPlan(id, rng){
  if(NG[id] && NG[id].duelAi) return NG[id].duelAi(rng);   /* 게임이 직접 정하는 AI(동물 삼총사: 이동 20번 점수) */
  const [T0, p] = NG[id].duelPace || [180, .65], cfg = levelOf(id, 'normal')[id] || {}, lim = cfg.limit || 0;
  const ok = rng() < p;
  let T = T0 * (0.7 + rng() * 0.6); if(lim) T = Math.min(T, lim * 0.97);
  return { ok, T, sc: ok ? Math.round((560 + rng() * 380) / 10) * 10 : 0, fail: 0.3 + rng() * 0.6 };
}
function gameProg(){
  if(!G) return 0; const id = G.id; let v = 0;
  try{
    v = NG[id].progress();
  }catch(_){ v = 0; }
  return Math.max(0, Math.min(1, v || 0));
}

/* ---- 대전 v2 (UI팀 설계): 동시 시작 · 게임별 진행 표시 · 순간 알림 · 멈춤 없음 ---- */
/* 게임별로 상대에게 보내는 값(presence). pg 진행도 0~1 · v 현재 수 · t 목표 수 · lf 남은 기회/생명 · dn 끝남 · sc 끝났을 때 점수 */
/* 게임마다 상대에게 보내는 값: 게임 정의의 duelStat = { unit, lfMax?, score?, tile?, lfIcon?, get:() => ({ v, t, lf }) } */
const duelStatOf = id => NG[id] && NG[id].duelStat;
function duelStatNow(){
  const S = duelStatOf(G.id); let s = {};
  try{ if(S) s = S.get(); }catch(_){}
  for(const k in s) if(typeof s[k] !== 'number' || !isFinite(s[k])) delete s[k];
  return Object.assign({ pg:Math.round(gameProg() * 1000) / 1000 }, s);
}
/* 값 칸 문구: 32/51칸 · 1,240점 · [128]/256 */
function duelValHtml(id, s){
  const S = duelStatOf(id) || {};
  if(s.dn) return s.ok ? `<span class="ck">✔</span>${fmt(s.sc || 0)}<small>점</small>` : '실패';
  if(s.left) return '나감';
  if(S.score) return `${fmt(s.v || 0)}<small>점</small>`;
  if(S.tile) return `<span class="tile">${s.v || 2}</span><small>/${s.t || ''}</small>`;
  if(s.t == null) return `${Math.round((s.pg || 0) * 100)}<small>%</small>`;
  return `${s.v || 0}<small>/${s.t}${S.unit}</small>`;
}
function duelSubHtml(id, s, lostFlash){
  const S = duelStatOf(id) || {}; if(!S.lfMax || s.lf == null || s.dn || s.left) return '';
  if(S.lfMax === 3) return [0, 1, 2].map(i => `<i class="pip${i >= s.lf ? ' off' : ''}${lostFlash && i === s.lf ? ' lost' : ''}"></i>`).join('');
  if(S.lfIcon) return `${S.lfIcon()}${s.lf}`;
  return `${ic('heart')}${s.lf}`;
}
const duelLocalStart = srv => srv - ((ROOM && ROOM.clockOffset) || 0);   /* 서버 시각 → 내 시계 */
const duelStarted = () => !!(G && G.duel && G.duel.go);

/* ---- (1) 준비·카운트다운: 문제는 미리 만들되 가려 두고, 정해진 시각에 두 사람이 같이 시작 ---- */
function duelGoOpen(){
  const D = G.duel, id = G.id, rules = (HELP[id] || []).slice(0, 3), me = G;
  const old = $('#duelGo'); if(old) old.remove();
  document.body.classList.add('duel-ready');
  const el = document.createElement('div'); el.className = 'duelgo'; el.id = 'duelGo';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', GAMES[id].name + ' 대전 준비');
  el.style.setProperty('--gc', (GCOL[id] || [])[2] || 'var(--ink)');
  el.innerHTML = `<div class="dg-card panel">
      <p class="dg-kick">1:1 대전 · ${G.L.name}</p>
      <h2 class="dg-title">${GAMES[id].name}</h2>
      <div class="dg-vs">
        <div class="dg-side me">${avatar({ me:true })}<b>나</b><small>${esc(D.myNick || '')}</small></div>
        <div class="dg-x">VS</div>
        <div class="dg-side op">${oppAv(D.opp.nick)}<b>${esc(D.opp.nick)}</b><small class="ok">${D.mode === 'ai' ? 'AI 상대' : '실시간 상대 · 준비 완료'}</small></div>
      </div>
      <ol class="dg-rules">${rules.map((r, i) => `<li><span class="hn" style="background:${GAME_META[id].col}">${i + 1}</span>${r[0]}</li>`).join('')}</ol>
      <p class="dg-win">같은 문제예요 · 끝났을 때 점수가 높은 쪽이 이겨요</p>
    </div>
    <div class="dg-count" aria-live="assertive"><svg class="dg-ring" viewBox="0 0 176 176"><circle class="bg" cx="88" cy="88" r="82"/><circle class="fg" cx="88" cy="88" r="82"/></svg><span class="dg-n wait">준비</span></div>
    <p class="dg-status" id="dgStatus"><i></i>${D.mode === 'ai' ? '곧 시작해요' : '두 사람 모두 들어왔어요 · 같은 순간에 시작해요'}</p>`;
  document.body.appendChild(el);
  const n = el.querySelector('.dg-n'), ring = el.querySelector('.dg-ring .fg'), opened = Date.now();
  let shown = null;
  const loop = () => {
    if(!el.isConnected || G !== me || me.over) return;
    /* 실시간: 시작 시각은 방장이 서버 시각으로 정해 presence(go)로 알림. 못 받으면 6초 뒤 내 시계로 시작 */
    if(D.startAt == null && D.mode === 'pvp'){
      duelReadOpp();
      if(D.startAt == null && Date.now() - opened > 3000) D.startAt = Date.now() + 1600;
    }
    const left = D.startAt == null ? 99999 : D.startAt - Date.now();
    const k = left > 1500 ? 'wait' : left > 0 ? String(Math.ceil(left / 500)) : 'go';   /* 3·2·1을 0.5초씩 */
    if(k !== shown){
      shown = k;
      if(k === 'wait'){ n.className = 'dg-n wait'; n.textContent = '준비'; }
      else if(k === 'go'){
        n.className = 'dg-n go'; void n.offsetWidth; n.classList.add('pop'); n.textContent = '시작!';
        sfx('start'); fxBuzz(30);
        duelBegin();
        setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 450);
        return;
      } else {
        n.className = 'dg-n'; void n.offsetWidth; n.classList.add('pop'); n.textContent = k;
        ring.style.transition = 'none'; ring.style.strokeDashoffset = '0'; void ring.getBBox();
        ring.style.transition = ''; ring.style.strokeDashoffset = '515';
        sfx('tReady'); fxBuzz(12);
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
/* 시작 순간: 시계를 정해진 시각에 맞추고 판을 보여 줌(늦게 도착했으면 그만큼 이미 지난 것으로) */
function duelBegin(){
  const D = G.duel; if(D.go) return;
  D.go = true;
  const at = Math.min(Date.now(), D.startAt || Date.now());
  G.start = at; G.pausedMs = 0; G.pauseAt = 0; G.paused = false; G.lt = 0;
  document.body.classList.remove('duel-ready');
  if(D.mode === 'pvp') duelPub(true);
  duelTick();
}

/* ---- (2) 게임 중 대전 막대: 상단 바가 있는 게임은 제목 자리, 자체 머리를 쓰는 게임은 맨 위 ---- */
function duelBarPlace(bar){
  const play = $('#play'), pbar = play.querySelector(':scope > .pbar');
  pbar.classList.remove('has-duel');
  /* 상단 바가 보이는 게임만 제목 자리에. 자체 머리를 쓰는 게임(동물 삼총사 등)은 맨 위 단독 막대 */
  if(getComputedStyle(pbar).display !== 'none'){ pbar.insertBefore(bar, $('#helpBtn')); pbar.classList.add('has-duel'); return; }
  play.insertBefore(bar, play.firstChild);
}
/* 판이 지워질 때 막대도 같이 지워지지 않게 제자리로 */
function duelBarRestore(){
  const bar = $('#duelBar'), play = $('#play'); if(!bar) return;
  play.insertBefore(bar, play.firstChild); play.querySelector(':scope > .pbar').classList.remove('has-duel');
}
function duelBarInit(){
  let bar = $('#duelBar'); const D = G && G.duel;
  if(!bar){ bar = document.createElement('div'); bar.className = 'duelbar'; bar.id = 'duelBar'; bar.hidden = true; $('#play').insertBefore(bar, $('#play').firstChild); }
  const oldGo = $('#duelGo'); if(oldGo) oldGo.remove();
  const rc = $('#dRules'); if(rc) rc.hidden = true;
  document.body.classList.remove('duel-ready', 'is-duel');
  if(!D || D.fleet){ duelBarRestore(); bar.hidden = true; bar.innerHTML = ''; return; }
  document.body.classList.add('is-duel');
  duelBarPlace(bar);
  bar.hidden = false;
  bar.innerHTML = `<span class="db-tag" id="dbTag" hidden></span>
    <div class="db-row me" id="dbRowMe"><span class="db-av">${avatar({ me:true })}</span><span class="db-who">나</span><span class="db-track"><i id="dbMe"></i><b id="dbMark"></b></span><span class="db-val num" id="dbMeV"></span><span class="db-sub" id="dbMeS"></span></div>
    <div class="db-row op" id="dbRowOp"><span class="db-av">${oppAv(D.opp.nick)}</span><span class="db-who">상대</span><span class="db-track"><i id="dbOp"></i></span><span class="db-val num" id="dbOpV"></span><span class="db-sub" id="dbOpS"></span></div>
    <div class="dping" id="dPing" role="status" aria-live="polite"></div>`;
  bar.setAttribute('aria-label', '대전 진행: 나와 ' + D.opp.nick);
  Object.assign(D, { lastPub:0, pubSig:'', lead:null, pingAt:{}, pingOnce:{}, pingLast:0, pingPri:0, oppLf:null, oppLfPing:null, meLf:null });
  if(D.mode === 'pvp'){
    const me = G;
    try{ D.un = D.nr.onPeers(ch => { if(G !== me || !G.duel) return; duelReadOpp(); if(ch.left && ch.left.some(p => p.peer === D.oppPeer)) duelOppGone(); }, () => { if(G === me && G.duel) duelMyNetLost(); }); }catch(_){}
  }
  /* 시작 전: 판은 만들어 두되 멈춰 두고 가림 → 준비·카운트다운 */
  G.paused = true; G.pauseAt = G.start = Date.now(); G.pausedMs = 0;
  duelGoOpen();
  duelRender();
}
/* 앞섬 판정: 5%p 넘으면 앞섬, 2%p 안으로 좁혀지면 풀림. 동물 삼총사는 점수 차 */
function duelLeadOf(me, op, prev){
  const S = duelStatOf(G.id) || {};
  const d = S.score ? ((me.v || 0) - (op.v || 0)) / Math.max(1, me.t || 1) : (me.pg || 0) - (op.pg || 0);
  if(prev === 'me' && d > .02) return 'me';
  if(prev === 'op' && d < -.02) return 'op';
  return d >= .05 ? 'me' : d <= -.05 ? 'op' : 'tie';
}
function duelMeStat(){
  const D = G.duel;
  if(G.over && D.me) return Object.assign({}, D.meStat || {}, { pg:D.me.pg, dn:1, ok:!!D.me.sc, sc:D.me.sc });
  return duelStatNow();
}
function duelOppStat(){
  const D = G.duel, o = D.opp, st = D.oppStat || {}, S = duelStatOf(G.id) || {};
  /* AI는 칸 수(v/t)와 막대가 어긋나지 않게 칸 수 기준으로 */
  let pg = o.pg;
  if(D.mode === 'ai' && st.t && S.score && D.ai.pts) pg = Math.min(1, (st.v || 0) / st.t);
  else if(D.mode === 'ai' && st.t && !S.score && !(o.dn && !o.sc)) pg = S.tile ? Math.max(0, Math.min(1, (Math.log2(Math.max(2, st.v || 2)) - 1) / (Math.log2(st.t) - 1))) : st.v / st.t;
  return Object.assign({}, st, { pg, dn:o.dn ? 1 : 0, ok:!!o.sc, sc:o.sc, left:!!D.oppLeft && !o.dn });
}
function duelRender(){
  const D = G && G.duel; if(!D || D.fleet || !$('#dbMe')) return;
  const id = G.id, me = duelMeStat(), op = duelOppStat();
  const w = x => (Math.max(0, Math.min(1, x || 0)) * 100).toFixed(1) + '%';
  $('#dbMe').style.width = w(me.pg); $('#dbOp').style.width = w(op.pg); $('#dbMark').style.left = w(op.pg);
  $('#dbMeV').innerHTML = duelValHtml(id, me); $('#dbOpV').innerHTML = duelValHtml(id, op);
  const meLost = D.meLf != null && me.lf != null && me.lf < D.meLf, opLost = D.oppLfShow != null && op.lf != null && op.lf < D.oppLfShow;
  $('#dbMeS').innerHTML = duelSubHtml(id, me, meLost); $('#dbOpS').innerHTML = duelSubHtml(id, op, opLost);
  D.meLf = me.lf; D.oppLfShow = op.lf;
  const rm = $('#dbRowMe'), ro = $('#dbRowOp');
  rm.classList.toggle('done', !!(me.dn && me.ok)); rm.classList.toggle('fail', !!(me.dn && !me.ok));
  ro.classList.toggle('done', !!(op.dn && op.ok)); ro.classList.toggle('fail', !!(op.dn && !op.ok)); ro.classList.toggle('left', !!op.left);
  const lead = !D.go || elapsed() < 3 ? null : duelLeadOf(me, op, D.lead);
  rm.classList.toggle('lead', lead === 'me'); ro.classList.toggle('lead', lead === 'op');
  const tag = $('#dbTag');
  if(!lead || op.left || me.dn || op.dn || Math.max(me.pg || 0, op.pg || 0) < .05) tag.hidden = true;
  else {
    tag.hidden = false;
    const cls = 'db-tag ' + lead;
    if(tag.dataset.k !== lead){ tag.className = cls; if(tag.dataset.k){ void tag.offsetWidth; tag.classList.add('flip'); } tag.dataset.k = lead; }
    tag.textContent = lead === 'me' ? '▲ 내가 앞서요' : lead === 'op' ? '▼ 상대가 앞서요' : '막상막하';
  }
  /* 역전 알림: me↔op로 바뀔 때만(막상막하를 거쳐도 마지막 앞선 쪽 기준) */
  if(lead === 'me' || lead === 'op'){
    if(D.leadSide && D.leadSide !== lead && !me.dn && !op.dn) duelPing(lead === 'me' ? 'meLead' : 'oppLead', lead === 'me' ? '내가 앞섰어요!' : `${esc(D.opp.nick)}님이 앞질렀어요`);
    D.leadSide = lead;
  }
  if(lead) D.lead = lead;
}

/* ---- (3) 순간 알림(말풍선): 우선순위 높은 것이 끼어들고, 최소 4초 간격 ---- */
const DPING = {
  oppDone: { pri:5, cls:'end',  sfx:'flHorn', buzz:[30, 40, 30], ms:3200 },
  oppFail: { pri:5, cls:'gray', sfx:'toggle', ms:2800 },
  oppLeft: { pri:5, cls:'gray', sfx:'toggle', ms:3200 },
  oppNet:  { pri:5, cls:'gray', sfx:'toggle', ms:3200 },
  meNet:   { pri:5, cls:'gray', sfx:'toggle', ms:3600 },
  oppBack: { pri:5, cls:'good', sfx:'toast',  ms:2200 },
  meLead:  { pri:4, cls:'good', sfx:'star',   ms:2200, same:12000 },
  oppLead: { pri:4, cls:'bad',  sfx:'starOff', buzz:20, ms:2400, same:12000 },
  oppHot:  { pri:3, cls:'hot',  sfx:'flPing', ms:2600, once:true },
  last10:  { pri:3, cls:'hot',  sfx:'flPing', ms:2600, once:true },
  oppMiss: { pri:2, cls:'',     sfx:'toast',  ms:2000, same:15000 },
  oppHit:  { pri:2, cls:'',     sfx:'toast',  ms:2200, same:15000 }
};
function duelPing(kind, text){
  const D = G && G.duel, P = DPING[kind], el = $('#dPing'); if(!D || !P || !el) return;
  const now = Date.now();
  if(P.once && D.pingOnce[kind]) return;
  if(P.same && now - (D.pingAt[kind] || 0) < P.same) return;
  if(P.pri < 5 && (!D.go || elapsed() < 5)) return;
  if(P.pri < 5 && now - (D.pingLast || 0) < 4000 && (D.pingPri || 0) >= P.pri) return;
  D.pingAt[kind] = D.pingLast = now; D.pingPri = P.pri; D.pingOnce[kind] = 1;
  el.className = 'dping ' + P.cls;
  el.innerHTML = `${kind === 'meLead' ? avatar({ me:true }) : oppAv(D.opp.nick)}<span>${text}</span>`;
  void el.offsetWidth; el.classList.add('on');
  sfx(P.sfx, P.sfx === 'star' ? { i:1 } : P.sfx === 'toggle' ? { on:false } : {}); if(P.buzz) fxBuzz(P.buzz);
  clearTimeout(D.pingT); D.pingT = setTimeout(() => el.classList.remove('on'), P.ms);
}

/* ---- 상대 소식 읽기 ---- */
function duelReadOpp(){
  const D = G && G.duel; if(!D || D.mode !== 'pvp' || !D.nr) return;
  let ps = []; try{ ps = D.nr.peers(); }catch(_){ return; }
  const o = ps.find(p => !p.sameTab && p.peer === D.oppPeer) || ps.find(p => !p.sameTab);
  if(!o || !o.presence) return;
  if(o.peer !== D.oppPeer) D.oppPeer = o.peer;   /* 상대가 다시 연결하면 peer id가 바뀜 */
  if(D.oppGone){ D.oppGone = 0; if(!G.over) duelPing('oppBack', '상대가 다시 연결됐어요'); }
  const q = o.presence, qs = JSON.stringify(q);
  if(q.q && !q.dn){ duelOppLeft(); return; }   /* 상대가 그만두기를 눌러 나감 */
  if(qs !== D.oppSig){ D.oppSig = qs; D.lastOppMsg = Date.now(); }
  if(D.startAt == null && typeof q.go === 'number') D.startAt = duelLocalStart(q.go);
  if(!D.go) return;
  if(typeof q.pg === 'number') D.opp.pg = Math.max(D.opp.pg, Math.min(1, q.pg));
  const st = D.oppStat || (D.oppStat = {});
  for(const k of ['v', 't', 'lf']) if(typeof q[k] === 'number') st[k] = q[k];
  duelOppEvents();
  if(q.dn && !D.opp.dn){ D.opp.dn = 1; D.opp.sc = +q.sc || 0; D.opp.pg = typeof q.pg === 'number' ? q.pg : D.opp.pg; duelOppDone(); }
}
/* 상대 기회 잃음 · 디펜스 생명 크게 줄어듦 · 마무리 중 */
function duelOppEvents(){
  const D = G.duel, st = D.oppStat || {}, S = duelStatOf(G.id) || {};
  if(D.opp.dn || G.over) return;
  if(S.lfMax && typeof st.lf === 'number'){
    if(S.lfMax === 3){ if(D.oppLf != null && st.lf < D.oppLf && st.lf > 0) duelPing('oppMiss', '상대가 한 번 틀렸어요'); }
    else { if(D.oppLfPing == null) D.oppLfPing = st.lf; else if(D.oppLfPing - st.lf >= 2){ D.oppLfPing = st.lf; duelPing('oppHit', `상대가 도토리를 뺏겼어요 · 남은 ${st.lf}개`); } }
    D.oppLf = st.lf;
  }
  if(!S.score && D.opp.pg >= .8) duelPing('oppHot', '상대가 마무리 중이에요!');
  if(S.score && G.mt && G.mt.E.movesLeft != null && G.mt.E.movesLeft <= 3) duelPing('last10', `마지막 3번 · 상대 ${fmt(st.v || 0)}점`);
}
function duelOppDone(){
  const D = G.duel;
  if(!G.over){ duelPing(D.opp.sc ? 'oppDone' : 'oppFail', D.opp.sc ? `상대가 끝냈어요 · ${fmt(D.opp.sc)}점` : '상대가 실패했어요'); duelCutSoon('done'); }
  else sfx(D.opp.sc ? 'flPing' : 'toggle');
  duelRender();
}
/* 한쪽이 끝나면(성공·실패·나감) 다른 쪽 판도 바로 끝난다. 끝난 쪽은 결과 뒤 '계속 풀기'로 혼자 이어 풀 수 있다(기록 안 됨) */
function duelCutSoon(why){
  const D = G && G.duel, me = G; if(!D || D.fleet || G.over || D.cutT) return;
  D.cutT = setTimeout(() => { if(G === me && !G.over && G.duel === D) duelCut(why); }, 700);   /* 알림을 잠깐 보여 준 뒤 */
}
function duelCut(why){
  const D = G && G.duel; if(!D || D.fleet || G.over) return;
  D.cut = why; D.cutSec = elapsed();
  finish(false);
}
function duelCanContinue(){
  const D = G && G.duel;
  return !!(D && !D.fleet && D.cut && G.over && !(D.me && D.me.sc) && NG[G.id] && NG[G.id].render);
}
/* 결과 창에 붙이는 '계속 풀기' 버튼(사이트·모듈 결과 창이 같이 씀) */
function duelContinueHtml(){
  return duelCanContinue() ? `<button class="btn secondary block dcont" id="mCont">${ic('play')} 계속 풀기 <small>혼자 이어 풀기 · 기록 안 됨</small></button>` : '';
}
function duelContinueBind(){ const b = $('#mCont'); if(b) b.onclick = duelContinue; }
function duelContinue(){
  if(!duelCanContinue()) return;
  const D = G.duel, id = G.id, sec = D.cutSec || 0;
  closeModal();
  duelClose();
  Object.assign(G, { duel:null, practice:true, over:false, paused:false, pauseAt:0, pausedMs:0, start:Date.now() - sec * 1000, lt:0 });
  try{ NG[id].render($('#stage')); }catch(_){}
  $('#ptitle').innerHTML = GAMES[id].name + '<small>대전 뒤 계속 풀기 · 기록되지 않아요</small>';
  clearInterval(tick); tick = setInterval(updateClock, 250); updateClock();
  ambStart(ambFor(id));
  toast('혼자 이어서 풀어요 · 기록되지 않아요');
}
/* 계속 풀기 판이 끝남 */
function practiceFinish(win){
  setTimeout(() => {
    openModal(`<h3 class="${win ? 'ok' : 'bad'}">${win ? '다 풀었어요!' : '여기까지예요'}</h3>
      <p class="note">${win ? '대전 뒤 혼자 끝까지 풀었어요.' : lossProgress()} 계속 풀기는 기록되지 않아요.</p>
      <div class="mbtns one"><button class="b1" id="mOut">나가기</button></div>`);
    if(win){ sfx('result'); try{ fxConfetti(); }catch(_){} } else sfx('lose');
    $('#mOut').onclick = () => { closeModal(); HOST.exit(); };
  }, win ? 500 : 250);
}
/* 상대 연결 끊김: 휴대폰은 앱을 오가면 잠깐 끊겼다 다시 들어오므로 15초 기다린 뒤에 나감으로 처리 */
function duelOppGone(){
  const D = G && G.duel; if(!D || D.oppLeft || D.opp.dn || D.oppGone) return;
  D.oppGone = Date.now();
  if(!G.over) duelPing('oppNet', '상대 연결이 끊겼어요 · 15초 기다려요');
}
/* 내 연결이 20초 넘게 끊김: 결과를 주고받을 수 없어서 무승부로 처리 */
function duelMyNetLost(){
  const D = G && G.duel; if(!D || D.netLost || D.resolved) return;
  D.netLost = true;
  if(!G.over) duelPing('meNet', '연결이 끊겼어요 · 이번 판은 무승부로 처리돼요');
  if(G.over && D.me) duelResolve();
}
/* 연결 상태 점검(게임 중·대기 창 모두): 상대 15초 유예, 내 연결 끊김/복구 알림 */
function duelNetCheck(){
  const D = G && G.duel; if(!D || D.mode !== 'pvp') return;
  if(D.oppGone && !D.oppLeft && !D.opp.dn){
    let back = false; try{ back = !!D.nr && D.nr.peers().some(p => !p.sameTab); }catch(_){}
    if(back){ D.oppGone = 0; if(!G.over) duelPing('oppBack', '상대가 다시 연결됐어요'); }
    else if(Date.now() - D.oppGone > 15000){ D.oppGone = 0; duelOppLeft(); }
  }
  if(!D.netLost && D.go){
    const up = typeof netUp === 'function' ? netUp() : true;
    if(!up && !D.netDown){ D.netDown = Date.now(); if(!G.over) duelPing('meNet', '연결이 끊겼어요 · 다시 연결하는 중…'); }
    else if(up && D.netDown){ D.netDown = 0; if(!G.over) duelPing('oppBack', '다시 연결됐어요'); duelPub(true); }
  }
}
function duelOppLeft(){
  const D = G && G.duel; if(!D || D.oppLeft || D.opp.dn) return;
  D.oppLeft = true;
  if(!G.over){ duelPing('oppLeft', '상대가 나갔어요 · 내가 이겼어요'); duelCutSoon('left'); }
  duelRender();
  if(G.over && D.me) duelResolve();
}
/* 내 진행 보내기: 0.8초마다, 기회를 잃거나 끝나면 바로(최소 0.3초 간격) */
function duelPub(force){
  const D = G.duel; if(!D || D.mode !== 'pvp' || !D.nr || !D.go) return;
  const s = G.over && D.me ? { pg:D.me.pg } : duelStatNow(), now = Date.now();
  const sig = JSON.stringify(s), urgent = D.meStatLf != null && s.lf != null && s.lf < D.meStatLf;
  if(!force && sig === D.pubSig && now - D.lastPub < 5000) return;
  if(!force && !(urgent && now - D.lastPub > 300) && now - D.lastPub < 800) return;
  D.lastPub = now; D.pubSig = sig; D.meStatLf = s.lf;
  try{ D.nr.presence(Object.assign({ hb:(D.hb = (D.hb || 0) + 1) }, s)).catch(() => {}); }catch(_){}
}
/* AI 상대: 미리 정한 결과대로 진행도·수치·실수를 흉내 */
function duelAiStat(){
  const D = G.duel, a = D.ai, S = duelStatOf(G.id) || {}, me = duelStatNow(), t = me.t, pg = D.opp.pg;
  const st = D.oppStat || (D.oppStat = {});
  if(t != null){
    st.t = t;
    if(S.tile){ const top = Math.log2(Math.max(4, t)); st.v = Math.pow(2, Math.max(1, Math.round(1 + pg * (top - 1)))); }
    else if(S.score) st.v = Math.round((a.pts ? (a.ok ? pg : pg / Math.max(.01, a.fail)) * a.pts : pg * (a.sc || t * .5)) / 10) * 10;
    else st.v = Math.min(t, Math.floor(pg * t));
  }
  if(S.lfMax === 3){
    if(!a.miss){ const r = mulberry(seedFrom(D.seed + 'm')); a.miss = a.ok ? [r() < .45 ? .25 + r() * .5 : 2, r() < .2 ? .6 + r() * .3 : 2] : [.2 + r() * .2, .45 + r() * .2]; }
    const k = a.ok ? pg : pg / Math.max(.01, a.fail);
    st.lf = 3 - a.miss.filter(x => k >= x).length - (!a.ok && D.opp.dn ? 1 : 0);
    st.lf = Math.max(0, st.lf);
  }
  if(S.lfMax === 10) st.lf = Math.max(1, 10 - Math.floor(pg * (a.ok ? 3 : 7)));
}
function duelTick(){
  const D = G && G.duel; if(!D || D.fleet) return;
  if(!D.go){ duelRender(); return; }
  const t = elapsed();
  if(D.mode === 'ai' && !D.opp.dn){
    const a = D.ai;
    D.opp.pg = a.ok ? Math.min(1, Math.pow(Math.max(0, t) / a.T, .9)) : Math.min(a.fail, a.fail * t / a.T);
    duelAiStat(); duelOppEvents();
    if(t >= a.T){ D.opp.dn = 1; D.opp.sc = a.ok ? a.sc : 0; D.opp.pg = a.ok ? 1 : a.fail; duelOppDone(); }
  }
  if(D.mode === 'pvp'){ duelReadOpp(); duelNetCheck(); if(!G.over) duelPub(false); }
  duelRender();
}

/* ---- (4) 대전 중 멈춤 없음 ---- */
function duelNoPause(){
  let t = $('#noPause');
  if(!t){ t = document.createElement('div'); t.id = 'noPause'; t.className = 'nopause'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = `${ic('clock')}대전 중에는 멈출 수 없어요`;
  t.classList.add('on'); sfx('toggle', { on:false });
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 1800);
}
function duelRulesToggle(){
  let c = $('#dRules');
  if(c && !c.hidden){ c.hidden = true; return; }
  if(!c){ c = document.createElement('div'); c.id = 'dRules'; c.className = 'drules'; document.body.appendChild(c); }
  const id = G.id;
  c.innerHTML = `<h4>${GAMES[id].name} 방법</h4><button class="x" aria-label="닫기">✕</button>
    <ol class="dg-rules">${HELP[id].map((r, i) => `<li><span class="hn" style="background:${GAME_META[id].col}">${i + 1}</span><span><b style="font-weight:400">${r[0]}</b><br><small style="font-family:var(--font);font-size:12.5px;color:var(--sub)">${r[1]}</small></span></li>`).join('')}</ol>
    <p class="dg-win" style="margin-top:6px">⏱ 대전 중이라 시간은 계속 가요</p>`;
  c.querySelector('.x').onclick = () => { c.hidden = true; };
  c.hidden = false;
}
/* 구슬·디펜스 일시정지 버튼 → 멈추지 않는 대전 메뉴 */
function duelMenu(){
  openModal(`<h3>대전 메뉴</h3><p class="dmenu-live"><i></i>대전 중에는 멈출 수 없어요 · 시간이 계속 가요</p>
    <div class="mbtns one"><button class="b1" id="mResume">게임으로 돌아가기</button></div>
    <div class="mbtns"><button class="b2" id="mHelp2">게임 방법</button><button class="b2" id="mQuit2">기권하고 나가기</button></div>${sndBtnHtml()}`);
  sndBtnBind();
  $('#mResume').onclick = closeModal;
  $('#mHelp2').onclick = () => { closeModal(); duelRulesToggle(); };
  $('#mQuit2').onclick = () => { closeModal(); confirmQuit(); };
}

/* ---- (5) 먼저 끝냈을 때 대기 창 ---- */
function duelWaitModal(){
  const D = G.duel, me = D.me, op = duelOppStat();
  const eta = G.limit && D.mode === 'pvp' ? `<span class="dw-eta">${ic('clock')}늦어도 <b class="num" id="dwEta">${mmss(Math.max(0, G.limit - elapsed()))}</b> 뒤엔 결과가 나와요</span>` : `<span class="dw-eta">${ic('clock')}상대가 끝내면 바로 결과가 나와요</span>`;
  openModal(`<div class="dsearch dwait"><p class="kick">대전</p><h3>${me.sc ? '다 풀었어요!' : '이번 판은 여기까지'}</h3>
    <div class="dw-me">${avatar({ me:true })}<div><small>내 점수 · 확정</small><br><b class="num">${me.sc ? fmt(me.sc) + '점' : '실패 · 진행 ' + Math.round(me.pg * 100) + '%'}</b></div></div>
    <div class="dw-op">${oppAv(D.opp.nick)}<div><b>${esc(D.opp.nick)} ${D.mode === 'ai' ? '<em class="aitag">AI</em>' : ''}</b>
      <span class="dw-stat" id="dwOp">아직 푸는 중 · ${duelValHtml(G.id, op).replace(/<[^>]+>/g, '')}</span>
      <span class="db-track"><i id="dwBar" style="width:${(op.pg || 0) * 100}%"></i></span></div></div>
    <p class="dw-need">${me.sc ? `상대가 <b>${fmt(me.sc)}점</b>보다 높아야 역전돼요` : '상대도 실패하면 진행도로 판정해요'}</p>
    ${eta}
    <p class="dw-quiet" id="dwTxt">${D.mode === 'ai' ? 'AI 상대가 마무리하는 중이에요…' : '창을 닫지 말고 기다려 주세요'}</p></div>`);
  $('#modal').classList.add('duelm');
}
function duelWaitText(){
  const D = G.duel, op = duelOppStat(), o = $('#dwOp'), b = $('#dwBar'), e = $('#dwEta');
  if(o) o.textContent = (op.dn ? '끝냈어요 · ' : '아직 푸는 중 · ') + duelValHtml(G.id, op).replace(/<[^>]+>/g, '');
  if(b) b.style.width = ((op.pg || 0) * 100) + '%';
  if(e) e.textContent = mmss(Math.max(0, G.limit - elapsed()));
  const tx = $('#dwTxt');
  if(tx && D.mode === 'pvp' && D.lastOppMsg && Date.now() - D.lastOppMsg > 15000) tx.textContent = '상대 연결을 확인하는 중…';
}

/* ---- 대전 끝 ---- */
function duelFinish(win){
  const D = G.duel, id = G.id;
  if(D.fleet){ duelResult(D.r || (win ? 'w' : 'l'), D.a || null, D.b || null); return; }   /* 대전을 직접 진행하는 게임은 D.r(무승부 'd' 포함)·D.a·D.b를 정해 둘 수 있음 */
  D.meStat = duelStatNow();
  D.me = { sc: win ? calcScore().score : 0, pg: win ? 1 : gameProg() };
  duelRender();
  if(D.mode === 'pvp'){
    try{ D.nr.presence({ dn:1, sc:D.me.sc, pg:D.me.pg }).catch(() => {}); }catch(_){}
    duelReadOpp();
    if(D.opp.dn || D.oppLeft || D.netLost){ setTimeout(duelResolve, win ? 700 : 400); return; }
    duelWaitModal();
    const me = G, t0 = Date.now();
    D.waitIv = setInterval(() => {
      if(G !== me){ clearInterval(D.waitIv); return; }
      duelReadOpp(); duelNetCheck(); duelWaitText();
      if(D.opp.dn || D.oppLeft || D.netLost){ clearInterval(D.waitIv); duelResolve(); }
      else if(Date.now() - t0 > 240000){ clearInterval(D.waitIv); D.oppLeft = true; duelResolve(); }
    }, 400);
    return;
  }
  /* AI: 내가 끝나면 AI 판도 그 자리에서 끝(대전은 한쪽이 끝나면 둘 다 끝) */
  if(!D.opp.dn){ D.opp.dn = 1; D.opp.sc = 0; D.opp.cut = true; duelAiStat(); }
  duelRender();
  setTimeout(duelResolve, win ? 700 : 400);
}
function duelResolve(){
  const D = G.duel; if(!D || D.resolved) return;
  const a = D.me, b = D.opp; let r;
  if(D.netLost && !b.dn && !D.oppLeft) r = 'd';
  else if(D.oppLeft && !b.dn) r = 'w';
  else if(a.sc !== b.sc) r = a.sc > b.sc ? 'w' : 'l';
  else if(!a.sc){ const dp = a.pg - b.pg; r = Math.abs(dp) < .02 ? 'd' : dp > 0 ? 'w' : 'l'; }
  else r = 'd';
  duelResult(r, a, b);
}
/* 결과: 승패 판정 뒤 보여 주기는 HOST(사이트는 대전 포인트, 모듈은 이벤트) */
function duelResult(r, a, b){
  const D = G.duel; if(D.resolved) return; D.resolved = true;
  duelNetClose();
  HOST.duelResult(r, a, b);
}
/* 결과 창 공통 조각: 양쪽 얼굴·점수, 판정 이유 */
function duelSidesHtml(r, a, b){
  const D = G.duel, nick = D.opp.nick;
  const side = (me, sc, pg, won) => `<div class="dr-side${won ? ' win' : ''}">${won ? '<span class="crown">👑</span>' : ''}${me ? avatar({ me:true }) : oppAv(nick)}<b>${me ? '나' : esc(nick)}</b>${sc == null ? '' : `<span class="num">${sc ? fmt(sc) + '점' : '실패'}</span>`}${sc === 0 && pg != null ? `<small>진행 ${Math.round(pg * 100)}%</small>` : ''}</div>`;
  return `<div class="dres">${side(true, a ? a.sc : null, a ? a.pg : null, r === 'w')}<div class="dr-vs">VS</div>${side(false, b ? b.sc : null, b ? b.pg : null, r === 'l')}</div>`;
}
function duelWhy(r, a, b){
  const D = G.duel, win = r === 'w';
  if(D.why) return D.why;   /* 게임이 정한 판정 이유 */
  return D.fleet ? (win ? (G.forfeit ? '상대가 떠나 기권승이에요' : '적 함대를 모두 격침했어요') : '우리 함대가 먼저 침몰했어요')
    : D.cut === 'done' && b && b.sc ? '상대가 먼저 끝내서 판이 끝났어요'
    : D.cut === 'done' && b && !b.sc ? '상대가 실패해서 판이 끝났어요 · 진행도로 판정했어요'
    : !D.cut && a && a.sc && b && !b.sc && !D.oppLeft && !D.netLost ? '내가 먼저 끝내서 상대 판도 끝났어요'
    : D.netLost && r === 'd' && !b.dn && !D.oppLeft ? '연결이 끊겨서 무승부로 처리했어요' : D.oppLeft && win && !b.dn ? '상대가 나가서 기권승이에요' : a && b && a.sc && b.sc ? (r === 'd' ? '점수가 똑같아요!' : `${fmt(Math.abs(a.sc - b.sc))}점 차이`) : a && b && !a.sc && !b.sc ? '둘 다 못 풀어서 진행도로 판정했어요' : '';
}
function duelNetClose(){
  const D = G && G.duel; if(!D) return;
  clearInterval(D.waitIv); if(D.un) try{ D.un(); }catch(_){} D.un = null;
  if(D.nr){ const nr = D.nr; D.nr = null; if(!D.resolved) try{ nr.presence({ q:1 }).catch(() => {}); }catch(_){} setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1500); }
}
function duelClose(){
  duelSearchStop();
  if(G && G.duel) clearTimeout(G.duel.cutT);
  if(G && G.duel) duelNetClose();
  duelBarRestore();
  const bar = $('#duelBar'); if(bar){ bar.hidden = true; bar.innerHTML = ''; }
  const go = $('#duelGo'); if(go) go.remove();
  const rc = $('#dRules'); if(rc) rc.hidden = true;
  document.body.classList.remove('duel-ready', 'is-duel');
}
