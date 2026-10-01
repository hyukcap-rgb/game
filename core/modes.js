/* 공용: 새 게임 등록(ngRegister)·솔로 점수·대전·테스트 도구 */
function ngRegister(){
  for(const id of Object.keys(NG)){
    const m = NG[id];
    GAMES[id] = { name:m.name, ico:'', rule:m.help.map(h => h[1]).join(' ') };
    GAME_META[id] = { col:m.col[1], time:m.time };
    GCOL[id] = m.col; HELP[id] = m.help; ADV_CH[id] = m.chapters; ADV_RULE[id] = m.starRule; ABIL[id] = m.abil;
    SVG[id] = m.icon; ART[id] = () => m.art();
    if(!GAME_IDS.includes(id)) GAME_IDS.push(id);
    if(m.css){ const el = document.createElement('style'); el.dataset.ng = id; el.textContent = m.css; document.head.appendChild(el); }
    if(m.sounds) Object.assign(SFX_LIB, m.sounds);
    if(m.gate) Object.assign(SFX_GATE, m.gate);
    if(m.jingle) WIN_JINGLE[id] = m.jingle;
  }
}
ngRegister();

/* ===================== 모드 v6: 솔로 점수 카드 · 대전 ===================== */
function renderSoloPts(){
  const d = dayState(), el = $('#soloPts'); if(!el) return;
  const pct = Math.min(100, d.solo / SOLO_CAP * 100);
  el.innerHTML = `<span class="sp-i">${ic('coin')}</span><span class="sp-t"><small>오늘 솔로 포인트 · 솔로 기록(오늘 점수와 따로)</small><b class="num">${fmt(d.solo)} <em>/ ${fmt(SOLO_CAP)}</em></b><span class="sp-bar"><i style="width:${pct}%"></i></span><span class="sp-r">새 스테이지 첫 클리어 +100 · 별 하나당 +50</span></span>`;
}

/* ---- 대전: 같은 문제를 동시에 풀고 게임 점수로 승부. 함대는 기존 턴제 실시간 ---- */
const DUEL_AI = { fox:[150,.72], sudoku:[420,.68], ball:[170,.66], tower:[280,.62], nono:[220,.72], match:[120,.62], block:[200,.66], memory:[70,.74], merge:[240,.62] };
const DUEL_NICK_A = ['재빠른','느긋한','꼼꼼한','용감한','반짝이는','새벽의','번개','조용한','씩씩한','영리한'];
const DUEL_NICK_B = ['토끼','곰','고양이','강아지','판다','호랑이'];   /* 동물 얼굴(FACE_KIND)과 짝 */
const duelNick = () => DUEL_NICK_A[Math.floor(Math.random() * DUEL_NICK_A.length)] + ' ' + DUEL_NICK_B[Math.floor(Math.random() * DUEL_NICK_B.length)];
const duelLive = () => ROOM_STATE === 'ok' && !!ROOM;
function duelRec(){ return store.get('hp:duelRec', null) || {}; }
function duelWaiting(id){ try{ return ROOM ? ROOM.peers().filter(p => !p.sameTab && p.presence && p.presence.du === 'wait' && (!id || p.presence.dg === id)).length : 0; }catch(_){ return 0; } }
const oppAv = nick => { const k = DUEL_NICK_B.findIndex(a => String(nick || '').endsWith(a)), i = k >= 0 ? k : seedFrom(nick || '?') % 6; return `<span class="av" style="--avbg:${FACE_BG[i]}">${animalFace(FACE_KIND[i])}</span>`; };

function renderDuel(d){
  const live = duelLive(), n = duelWaiting(), R = duelRec();
  $('#duelHead').innerHTML = `<div class="dh-top"><span class="dh-ico">${ic('duel')}</span><div><b>1:1 대전</b><small>상대와 같은 문제를 동시에 풀고 점수로 겨뤄요</small></div></div>
    <div class="dh-rec"><div><b class="num">${d.dw}</b><span>승</span></div><div><b class="num">${d.dd}</b><span>무</span></div><div><b class="num">${d.dl}</b><span>패</span></div><div class="pts"><b class="num">+${fmt(d.duel)}</b><span>오늘 대전 점수</span></div></div>
    <div class="dh-rw"><span class="w">승리 +${DUEL_PTS.w}</span><span class="d">무승부 +${DUEL_PTS.d}</span><span class="l">패배 +${DUEL_PTS.l}</span><span class="c">한 판 ${ic('heart')}1</span></div>
    <div class="dh-live${live ? '' : ' off'}"><i></i>${live ? (n ? `지금 대전을 기다리는 사람 <b>${n}명</b>` : '실시간 서버 연결됨 · 상대가 없으면 AI와 겨뤄요') : '지금은 실시간 연결이 안 돼요 · AI와 겨뤄요'}</div>`;
  const list = $('#duelList'); list.innerHTML = '';
  for(const id of GAME_IDS){
    const r = R[id] || { w:0, d:0, l:0 }, tot = r.w + r.d + r.l, wait = duelWaiting(id);
    const how = id === 'fleet' ? '서로 포격하는 턴제 대전' : id === 'match' ? '20번 움직여 누가 더 높은 점수?' : '같은 문제 · 점수가 높으면 승리';
    const row = document.createElement('div'); row.className = 'grow panel duelrow'; row.style.setProperty('--gc', GCOL[id][1]);
    row.innerHTML = `<span class="g-art">${ART[id]()}${wait ? `<span class="live"><i></i>${wait}명</span>` : ''}</span><span class="gr-mid"><b>${GAMES[id].name}</b><span>${how}</span><span class="drec">${tot ? `${r.w}승 ${r.d}무 ${r.l}패` : '첫 대전을 해 보세요'}</span></span><button class="gr-go duel" aria-label="${GAMES[id].name} 대전 시작, 하트 1개">대전 ${costTag()}</button>`;
    row.querySelector('.gr-go').onclick = () => duelStart(id);
    row.querySelector('.g-art').onclick = () => duelStart(id);
    list.appendChild(row);
  }
}

let DS = null;   /* 상대 찾기 상태 */
function duelStart(id){
  if(heartState().n < 1){ openHeartSheet('empty'); return; }
  if(id === 'fleet'){ const lv = duelLive() ? 'pvp' : 'normal'; startGame('fleet', lv, { duel:{ fleet:true, mode:lv === 'pvp' ? 'pvp' : 'ai', opp:{ nick:lv === 'pvp' ? '상대 선장' : 'AI 함장' } } }); return; }
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
  openModal(`<div class="dsearch" style="--gc:${GCOL[id][1]}"><p class="kick">1:1 대전</p><h3>${GAMES[id].name}</h3>
    <div class="vsrow"><div class="vs-side">${avatar({ me:true })}<b>나</b><small>${flEsc(S.nick)}</small></div><div class="vs-x">VS</div>
      <div class="vs-side op" id="dsOpp"><span class="ds-radar"><i></i><i></i><i></i></span><b id="dsOppN">찾는 중…</b><small id="dsOppS"></small></div></div>
    <p class="note" id="dsTxt"></p>
    <div class="dh-rw sm"><span class="w">승리 +${DUEL_PTS.w}</span><span class="d">무 +${DUEL_PTS.d}</span><span class="l">패배 +${DUEL_PTS.l}</span></div>
    <div class="mbtns"><button class="b2" id="dsCancel">취소</button><button class="b1" id="dsAi">AI와 바로 대전 ${costTag()}</button></div></div>`);
  $('#modal').classList.add('duelm');
  sfx('flPing');
  $('#dsCancel').onclick = () => { duelSearchStop(); closeModal(); };
  $('#dsAi').onclick = () => duelGoAI(S);
  const text = () => {
    if(DS !== S) return;
    const left = Math.max(0, WAIT - Math.floor((Date.now() - S.t0) / 1000)), t = $('#dsTxt'); if(!t) return;
    if(S.phase === 'join'){ t.innerHTML = '상대를 찾았어요! 연결하는 중…'; return; }
    if(!S.live){ t.textContent = '지금은 실시간 연결이 안 돼서 AI 상대와 겨뤄요.'; return; }
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
        const srv = flNow() + (fresh ? 6000 : 4000);
        duel.startAt = duelLocalStart(srv); nr.presence({ go:srv }).catch(() => {});
      }
      duelSearchStop(); closeModal(); startGame(S.id, 'normal', { duel });
    }
  }, 250);
}
function duelGoAI(S){
  if(DS !== S || S.phase === 'join') return;
  const id = S.id, nick = duelNick(), seed = 'ai:' + id + ':' + Date.now() + ':' + Math.random();
  const duel = { mode:'ai', seed, myNick:S.nick, startAt:Date.now() + (store.get('hp:help:' + id, false) ? 3000 : 5000), opp:{ nick, pg:0, dn:0, sc:0 }, ai:duelAiPlan(id, mulberry(seedFrom(seed + 'p'))), me:null };
  duelSearchStop(); closeModal(); startGame(id, 'normal', { duel });
}
/* AI 상대: 게임별 평균 시간·성공률로 결과를 미리 정하고, 경과 시간에 맞춰 진행도를 보여 준다 */
function duelAiPlan(id, rng){
  if(NG[id] && NG[id].duelAi) return NG[id].duelAi(rng);   /* 게임이 직접 정하는 AI(동물 삼총사: 이동 20번 점수) */
  const [T0, p] = DUEL_AI[id] || [180, .65], cfg = levelOf(id, 'normal')[id] || {}, lim = cfg.limit || 0;
  const ok = rng() < p;
  let T = T0 * (0.7 + rng() * 0.6); if(lim) T = Math.min(T, lim * 0.97);
  return { ok, T, sc: ok ? Math.round((560 + rng() * 380) / 10) * 10 : 0, fail: 0.3 + rng() * 0.6 };
}
function gameProg(){
  if(!G) return 0; const id = G.id; let v = 0;
  try{
    if(NG[id]) v = NG[id].progress();
    else if(id === 'fox') v = G.placed / G.N;
    else if(id === 'sudoku') v = Object.keys(G.earnedCells).length / Math.max(1, Math.round(500 / G.perCell));
    else if(id === 'ball') v = G.total ? G.broken / G.total : 0;
    else if(id === 'tower') v = G.waves ? (G.cleared || 0) / G.waves.length : 0;
  }catch(_){ v = 0; }
  return Math.max(0, Math.min(1, v || 0));
}

/* ---- 대전 v2 (UI팀 설계): 동시 시작 · 게임별 진행 표시 · 순간 알림 · 멈춤 없음 ---- */
/* 게임별로 상대에게 보내는 값(presence). pg 진행도 0~1 · v 현재 수 · t 목표 수 · lf 남은 기회/생명 · dn 끝남 · sc 끝났을 때 점수 */
const DUEL_STAT = {
  fox:    { unit:'마리', lfMax:3,  get:() => ({ v:G.placed || 0, t:G.N, lf:G.paws }) },
  sudoku: { unit:'칸',   lfMax:3,  get:() => ({ v:Object.keys(G.earnedCells).length, t:Math.round(500 / G.perCell), lf:G.paws }) },
  ball:   { unit:'개',             get:() => ({ v:G.broken, t:G.total }) },
  tower:  { unit:'무리', lfMax:10, get:() => ({ v:G.cleared || 0, t:G.waves.length, lf:G.lives }) },
  nono:   { unit:'칸',   lfMax:3,  get:() => ({ v:G.found, t:G.total, lf:Math.max(0, 3 - (G.miss || 0)) }) },
  block:  { unit:'줄',             get:() => ({ v:Math.min(G.bk.lines, G.bk.target), t:G.bk.target }) },
  memory: { unit:'쌍',             get:() => ({ v:G.m.found, t:G.m.pairs }) },
  merge:  { unit:'', tile:true,    get:() => ({ v:G.M.best, t:G.M.target }) },
  match:  { unit:'점', score:true, get:() => ({ v:G.mt ? G.mt.E.pts : 0, t:G.cfg.target }) }
};
function duelStatNow(){
  const S = DUEL_STAT[G.id]; let s = {};
  try{ if(S) s = S.get(); }catch(_){}
  for(const k in s) if(typeof s[k] !== 'number' || !isFinite(s[k])) delete s[k];
  return Object.assign({ pg:Math.round(gameProg() * 1000) / 1000 }, s);
}
/* 값 칸 문구: 32/51칸 · 1,240점 · [128]/256 */
function duelValHtml(id, s){
  const S = DUEL_STAT[id] || {};
  if(s.dn) return s.ok ? `<span class="ck">✔</span>${fmt(s.sc || 0)}<small>점</small>` : '실패';
  if(s.left) return '나감';
  if(S.score) return `${fmt(s.v || 0)}<small>점</small>`;
  if(S.tile) return `<span class="tile">${s.v || 2}</span><small>/${s.t || ''}</small>`;
  if(s.t == null) return `${Math.round((s.pg || 0) * 100)}<small>%</small>`;
  return `${s.v || 0}<small>/${s.t}${S.unit}</small>`;
}
function duelSubHtml(id, s, lostFlash){
  const S = DUEL_STAT[id] || {}; if(!S.lfMax || s.lf == null || s.dn || s.left) return '';
  if(S.lfMax === 3) return [0, 1, 2].map(i => `<i class="pip${i >= s.lf ? ' off' : ''}${lostFlash && i === s.lf ? ' lost' : ''}"></i>`).join('');
  if(id === 'tower') return `${FS_ICO.acorn.replace('<svg ', '<svg class="ico" ')}${s.lf}`;
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
        <div class="dg-side me">${avatar({ me:true })}<b>나</b><small>${flEsc(D.myNick || '')}</small></div>
        <div class="dg-x">VS</div>
        <div class="dg-side op">${oppAv(D.opp.nick)}<b>${flEsc(D.opp.nick)}</b><small class="ok">${D.mode === 'ai' ? 'AI 상대' : '실시간 상대 · 준비 완료'}</small></div>
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
      if(D.startAt == null && Date.now() - opened > 6000) D.startAt = Date.now() + 2500;
    }
    const left = D.startAt == null ? 99999 : D.startAt - Date.now();
    const k = left > 3000 ? 'wait' : left > 0 ? String(Math.ceil(left / 1000)) : 'go';
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
    try{ D.un = D.nr.onPeers(ch => { if(G !== me || !G.duel) return; duelReadOpp(); if(ch.left && ch.left.some(p => p.peer === D.oppPeer)) duelOppLeft(); }, () => { if(G === me && G.duel && !G.duel.oppLeft) duelOppLeft(); }); }catch(_){}
  }
  /* 시작 전: 판은 만들어 두되 멈춰 두고 가림 → 준비·카운트다운 */
  G.paused = true; G.pauseAt = G.start = Date.now(); G.pausedMs = 0;
  duelGoOpen();
  duelRender();
}
/* 앞섬 판정: 5%p 넘으면 앞섬, 2%p 안으로 좁혀지면 풀림. 동물 삼총사는 점수 차 */
function duelLeadOf(me, op, prev){
  const S = DUEL_STAT[G.id] || {};
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
  const D = G.duel, o = D.opp, st = D.oppStat || {}, S = DUEL_STAT[G.id] || {};
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
    if(D.leadSide && D.leadSide !== lead && !me.dn && !op.dn) duelPing(lead === 'me' ? 'meLead' : 'oppLead', lead === 'me' ? '내가 앞섰어요!' : `${flEsc(D.opp.nick)}님이 앞질렀어요`);
    D.leadSide = lead;
  }
  if(lead) D.lead = lead;
}

/* ---- (3) 순간 알림(말풍선): 우선순위 높은 것이 끼어들고, 최소 4초 간격 ---- */
const DPING = {
  oppDone: { pri:5, cls:'end',  sfx:'flHorn', buzz:[30, 40, 30], ms:3200 },
  oppFail: { pri:5, cls:'gray', sfx:'toggle', ms:2800 },
  oppLeft: { pri:5, cls:'gray', sfx:'toggle', ms:3200 },
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
  const q = o.presence, qs = JSON.stringify(q);
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
  const D = G.duel, st = D.oppStat || {}, S = DUEL_STAT[G.id] || {};
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
  if(!G.over) duelPing(D.opp.sc ? 'oppDone' : 'oppFail', D.opp.sc ? `상대가 끝냈어요 · ${fmt(D.opp.sc)}점` : '상대가 실패했어요');
  else sfx(D.opp.sc ? 'flPing' : 'toggle');
  duelRender();
}
function duelOppLeft(){
  const D = G && G.duel; if(!D || D.oppLeft || D.opp.dn) return;
  D.oppLeft = true;
  if(!G.over) duelPing('oppLeft', '상대가 나갔어요 · 끝까지 하면 승리');
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
  const D = G.duel, a = D.ai, S = DUEL_STAT[G.id] || {}, me = duelStatNow(), t = me.t, pg = D.opp.pg;
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
  if(D.mode === 'pvp'){ duelReadOpp(); if(!G.over) duelPub(false); }
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
    <div class="dw-op">${oppAv(D.opp.nick)}<div><b>${flEsc(D.opp.nick)} ${D.mode === 'ai' ? '<em class="aitag">AI</em>' : ''}</b>
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
  if(D.fleet){ duelResult(win ? 'w' : 'l', null, null); return; }
  D.meStat = duelStatNow();
  D.me = { sc: win ? calcScore().score : 0, pg: win ? 1 : gameProg() };
  duelRender();
  if(D.mode === 'pvp'){
    try{ D.nr.presence({ dn:1, sc:D.me.sc, pg:D.me.pg }).catch(() => {}); }catch(_){}
    duelReadOpp();
    if(D.opp.dn || D.oppLeft){ setTimeout(duelResolve, win ? 700 : 400); return; }
    duelWaitModal();
    const me = G, t0 = Date.now();
    D.waitIv = setInterval(() => {
      if(G !== me){ clearInterval(D.waitIv); return; }
      duelReadOpp(); duelWaitText();
      if(D.opp.dn || D.oppLeft){ clearInterval(D.waitIv); duelResolve(); }
      else if(Date.now() - t0 > 240000){ clearInterval(D.waitIv); D.oppLeft = true; duelResolve(); }
    }, 400);
    return;
  }
  /* AI: 아직 안 끝났으면 빨리 감기로 마무리 */
  if(D.opp.dn){ setTimeout(duelResolve, win ? 700 : 400); return; }
  duelWaitModal();
  const a = D.ai, p0 = D.opp.pg, pEnd = a.ok ? 1 : a.fail, t0 = performance.now(), me = G;
  const step = () => {
    if(G !== me) return;
    const k = Math.min(1, (performance.now() - t0) / 1400);
    D.opp.pg = p0 + (pEnd - p0) * k; duelAiStat(); duelWaitText(); duelRender();
    if(k < 1) requestAnimationFrame(step); else { D.opp.dn = 1; D.opp.sc = a.ok ? a.sc : 0; D.opp.pg = pEnd; setTimeout(duelResolve, 350); }
  };
  setTimeout(() => requestAnimationFrame(step), 450);
}
function duelResolve(){
  const D = G.duel; if(!D || D.resolved) return;
  const a = D.me, b = D.opp; let r;
  if(D.oppLeft && !b.dn) r = 'w';
  else if(a.sc !== b.sc) r = a.sc > b.sc ? 'w' : 'l';
  else if(!a.sc){ const dp = a.pg - b.pg; r = Math.abs(dp) < .02 ? 'd' : dp > 0 ? 'w' : 'l'; }
  else r = 'd';
  duelResult(r, a, b);
}
function duelResult(r, a, b){
  const D = G.duel; if(D.resolved) return; D.resolved = true;
  const id = G.id, pts = DUEL_PTS[r], d = dayState(), firstToday = !d.att;
  d.duel += pts; d['d' + r] = (d['d' + r] || 0) + 1; d.att = true; saveDay(d);
  const R = duelRec(), x = R[id] || { w:0, d:0, l:0 }; x[r]++; R[id] = x; store.set('hp:duelRec', R);
  duelNetClose();
  const tl = myTL(), win = r === 'w', nick = D.opp.nick;
  const side = (me, sc, pg, won) => `<div class="dr-side${won ? ' win' : ''}">${won ? '<span class="crown">👑</span>' : ''}${me ? avatar({ me:true }) : oppAv(nick)}<b>${me ? '나' : flEsc(nick)}</b>${sc == null ? '' : `<span class="num">${sc ? fmt(sc) + '점' : '실패'}</span>`}${sc === 0 && pg != null ? `<small>진행 ${Math.round(pg * 100)}%</small>` : ''}</div>`;
  const why = D.fleet ? (win ? (G.forfeit ? '상대가 떠나 기권승이에요' : '적 함대를 모두 격침했어요') : '우리 함대가 먼저 침몰했어요')
    : D.oppLeft && win && !b.dn ? '상대가 나가서 기권승이에요' : a && b && a.sc && b.sc ? (r === 'd' ? '점수가 똑같아요!' : `${fmt(Math.abs(a.sc - b.sc))}점 차이`) : a && b && !a.sc && !b.sc ? '둘 다 못 풀어서 진행도로 판정했어요' : '';
  let html = `${win ? '<div class="burst" aria-hidden="true"></div>' : ''}<h3 class="${r === 'l' ? 'bad' : 'ok'}">${win ? '승리!' : r === 'd' ? '무승부' : '패배'}</h3>
    <div class="dres">${side(true, a ? a.sc : null, a ? a.pg : null, r === 'w')}<div class="dr-vs">VS</div>${side(false, b ? b.sc : null, b ? b.pg : null, r === 'l')}</div>
    ${why ? `<p class="note">${why}</p>` : ''}
    <p class="dr-lb">대전 포인트</p><div class="big" id="bigScore">+0</div>
    <div><span class="pill info">오늘 대전 ${d.dw}승 ${d.dd}무 ${d.dl}패 · 대전 포인트 ${fmt(d.duel)}</span>${firstToday ? attPillHtml() : ''}</div>
    <p class="note">${r === 'l' ? '져도 대전 포인트를 받아요. ' : ''}대전 포인트는 대전 기록에 쌓이고, 오늘 점수(시험지)와는 따로예요.</p>
    <div class="mbtns"><button class="b2" id="mSec">대전 목록</button><button class="b1" id="mPri">다시 대전 ${costTag()}</button></div><button class="btn ghost" id="mGh">홈으로</button>`;
  setTimeout(() => {
    openModal(html);
    if(win){ fxConfetti(); sfx('fanfare'); } else if(r === 'd') sfx('result'); else sfx('lose');
    $('#mPri').onclick = () => { closeModal(); goHome(); duelStart(id); };
    $('#mSec').onclick = () => { closeModal(); goHome(); setTab('duel'); };
    $('#mGh').onclick = () => { closeModal(); goHome(); setTab('today'); };
    const el = $('#bigScore'), t0 = performance.now(), dur = FXR.reduce ? 0 : 800;
    const stepN = t => { const k = dur ? Math.min(1, (t - t0) / dur) : 1; el.textContent = '+' + fmt(Math.round(pts * (1 - Math.pow(1 - k, 3))));
      if(k < 1){ sfx('tick', { p:k }); requestAnimationFrame(stepN); } else if(el.isConnected){ el.classList.add('land'); sfx('ding'); fxPop(el, 'gold'); } };
    requestAnimationFrame(stepN);
    const w = $('#modal .dr-side.win'); if(w) setTimeout(() => fxPop(w, 'gold'), 300);
  }, $('#veil').classList.contains('on') ? 0 : (win ? 500 : 250));
}
function duelNetClose(){
  const D = G && G.duel; if(!D) return;
  clearInterval(D.waitIv); if(D.un) try{ D.un(); }catch(_){} D.un = null;
  if(D.nr){ const nr = D.nr; D.nr = null; setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1500); }
}
function duelClose(){
  duelSearchStop();
  if(G && G.duel) duelNetClose();
  duelBarRestore();
  const bar = $('#duelBar'); if(bar){ bar.hidden = true; bar.innerHTML = ''; }
  const go = $('#duelGo'); if(go) go.remove();
  const rc = $('#dRules'); if(rc) rc.hidden = true;
  document.body.classList.remove('duel-ready', 'is-duel');
}

let lastSig = '', ABOVE = null;
/* 추월 알림: 친구가 나를 제치면 여우가 알려줌 */
function checkOvertake(){
  const d = dayState(); if(!myTotal(d)){ ABOVE = null; return; }
  const b = board(d), mi = b.findIndex(x => x.me), above = b.slice(0, mi).filter(x => x.score > 0).map(x => x.name);
  if(ABOVE){ const nw = above.filter(n => !ABOVE.includes(n)); if(nw.length) toast(nw[0] + '님이 당신을 제쳤어요! 가만있을 거예요? 🦊'); }
  ABOVE = above;
}
function homeSig(){ const d = dayState(), h = heartState(); return [dayKey(), h.n, d.ads, d.att ? 1 : 0, RANK_MODE, TAB === 'duel' ? duelWaiting() + ':' + ROOM_STATE : '', FRIENDS.map(friendScore).join(',')].join('|'); }
function tickHome(){
  const h = heartState();
  const ht = $('#hsT'); if(ht) ht.textContent = heartLeft(h);
  if($('#home').style.display === 'none' || $('#veil').classList.contains('on')) return;
  const sig = homeSig();
  if(sig !== lastSig){ lastSig = sig; checkOvertake(); renderHome(); return; }
  const t = $('#hTimer'); if(t) t.textContent = heartLeft(h);
  const cl = $('#closing'); if(cl) cl.textContent = closingText();
  const pa = $('#poolAmt'), pb = $('#poolAmt2'), lc = $('#lgClose'), pv = fmt(prizePool()) + '원';
  if(pa) pa.textContent = pv; if(pb) pb.textContent = pv; if(lc) lc.textContent = weekLeft();
}
$('#quitBtn').innerHTML = ic('back'); $('#helpBtn').innerHTML = ic('help');
document.querySelectorAll('#dock button').forEach(b => { b.innerHTML = b.innerHTML.replace(/ICO_(\w+)/, (_, n) => ic(n)); b.onclick = () => setTab(b.dataset.tab); });
$('#meBtn').onclick = () => setTab('me');
$('#strip').onclick = () => setTab('me');
$('#pool').onclick = () => { RANK_MODE = 'week'; setTab('league'); };
$('#devWeek').onclick = () => { const s0 = leagueState(); s0.week = addDays(weekStartKey(), -7); store.set('hp:league', s0); showLeagueResult(leagueRollover()); };
$('#advPromo').onclick = () => setTab('adv'); $('#duelPromo').onclick = () => setTab('duel');
$('#meSound').onclick = () => openSoundSheet(); $('#meReport').onclick = openReport; $('#meShare').onclick = () => openShare(closeModal);
if(!store.get('hp:advLv', 0)) store.set('hp:advLv', lvInfo().L);
$('#devAdv').onclick = () => { GAME_IDS.forEach(g => store.set(advKey(g), null)); store.set('hp:advLv', 1); renderHome(); toast('솔로 기록을 초기화했어요'); };
$('#devLvUp').onclick = () => { const L = lvInfo().L + 1; showCelebrations([{ kind:'level', L, from:L - 1, hearts:1 }], () => {}); };
$('#devCh').onclick = () => showCelebrations([{ kind:'chapter', id:'fox', c:1 }], () => {});
$('#heartChip').onclick = () => openHeartSheet();
$('#inboxBtn').innerHTML = MAIL_G + '<span class="badge" id="badge">0</span>'; $('#inboxBtn').onclick = openInbox;
$('#quitBtn').onclick = confirmQuit;
$('#helpBtn').onclick = () => { if(G && !G.over) openHelp(G.id); };
$('#devFill').onclick = () => { const h = heartState(); if(h.n < MAX_H){ h.n = MAX_H; h.t = Date.now(); store.set('hp:hearts', h); } renderHome(); toast('하트를 채웠어요'); };
$('#devReset').onclick = () => { store.set('hp:day:' + dayKey(), null); renderHome(); toast('오늘 기록을 초기화했어요'); };
$('#devWelcome').onclick = () => { GAME_IDS.forEach(g => store.set('hp:help:' + g, 0)); welcome(); };
$('#tabDay').onclick = () => { RANK_MODE = 'day'; renderHome(); };
$('#tabMonth').onclick = () => { RANK_MODE = 'week'; renderHome(); };
$('#devHist').onclick = () => {
  const today = dayKey(), r = mulberry(seedFrom('hist' + today));
  for(let i = 1; i <= 14; i++){
    const k = addDays(today, -i);
    if(i === 4 || i === 11){ store.set('hp:day:' + k, null); continue; }
    const best = {}; for(const g of GAME_IDS) best[g] = r() < 0.75 ? Math.round((350 + r() * 750) / 10) * 10 : 0;
    const set = todaySet(k); for(const g of GAME_IDS) if(!set.includes(g)) best[g] = 0;
    store.set('hp:day:' + k, { best, tries:{}, sent:{}, claimed:[], ads:0, att:true, set, solo:r() < .5 ? 250 : 0, duel:r() < .4 ? 400 : 0 });
  }
  renderHome(); toast('지난 2주 기록을 만들었어요(2일은 휴식권)');
};
$('#devHistClr').onclick = () => { const today = dayKey(); for(let i = 0; i <= 120; i++) store.set('hp:day:' + addDays(today, -i), null); renderHome(); toast('출석 기록을 모두 지웠어요'); };
