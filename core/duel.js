/* 대전 v3 (모든 게임 공용, docs/21 3절): 2~5명 빠른 대전 · 컴퓨터 상대 · 동시 시작 · 칩 줄 · 알림 · 순위 · 사건·선점·차례.
   게임마다 다른 값은 게임 정의 NG.<id>의 선택 항목에서 읽는다(games/CLAUDE.md "대전 v3" 표):
   duelKind · duelMax · duelCfg · duelSlow · duelStat(mis) · duelRank · duelEnd · onDuelEvent · onDuelClaim · duelMini · duelAi ·
   duelAvoidKey · duelKeys · duelLaunch · duelPlace · duelPace · duelHow.
   - 서버(server/)는 그대로. 대기실 상태값 w3/h3/j3(v2 'wait'와 섞이지 않음), 대전 방 이름 'fl-d3-…'(서버 묶음 지연 없음).
   - 문제 씨앗 = 방 이름 + ':' + 판 번호 + ':' + 판 표지 → 같은 방에서 한 판 더 해도 항상 새 판.
   - 이 파일은 게임 이름을 모른다(게임마다 다른 것은 모두 게임 정의에). */
const DUEL_NICK_A = ['재빠른','느긋한','꼼꼼한','용감한','반짝이는','새벽의','번개','조용한','씩씩한','영리한'];
const DUEL_NICK_B = ['토끼','곰','고양이','강아지','판다','호랑이'];   /* 동물 얼굴(FACE_KIND)과 짝 */
const duelNick = () => DUEL_NICK_A[Math.floor(Math.random() * DUEL_NICK_A.length)] + ' ' + DUEL_NICK_B[Math.floor(Math.random() * DUEL_NICK_B.length)];
const duelLive = () => ROOM_STATE === 'ok' && !!ROOM && netUp();
function duelRec(){ return store.get('hp:duelRec', null) || {}; }
/* 대기실에서 대전을 기다리는 사람 수(v2 'wait' + v3 'w3'·'h3') */
function duelWaiting(id){ try{ return ROOM ? ROOM.peers().filter(p => !p.sameTab && p.presence && ['wait', 'w3', 'h3'].includes(p.presence.du) && (!id || p.presence.dg === id)).length : 0; }catch(_){ return 0; } }
const oppAv = nick => { const k = DUEL_NICK_B.findIndex(a => String(nick || '').endsWith(a)), i = k >= 0 ? k : seedFrom(nick || '?') % 6; return `<span class="av" style="--avbg:${FACE_BG[i]}">${animalFace(FACE_KIND[i])}</span>`; };
/* 이 기기의 대전 참가 표지(판마다 새로, 문제 내용과 무관 → Math.random 사용 가능). 다시 연결해 peer가 바뀌어도 같은 사람으로 본다 */
/* 좁은 자리에 쓰는 짧은 이름: '반짝이는 고양이' → '고양이' */
const duelShortNick = n => String(n || '').trim().split(/\s+/).pop().slice(0, 5);
const duelPidNew = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
const duelSdNew = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

/* ---- 자리 색·모양(디자인팀, 색약 대비). 나는 내 화면에서 늘 분홍 원 ---- */
const DUEL_SEAT = [
  { col:'#F0368A', shape:'circle' }, { col:'#2F7BFF', shape:'square' }, { col:'#F29E3D', shape:'tri' },
  { col:'#2BB673', shape:'diamond' }, { col:'#8B5CF6', shape:'star' }
];
function duelShapeSvg(shape, col, px = 14){
  const P = { circle:'<circle cx="8" cy="8" r="6"/>', square:'<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/>', tri:'<path d="M8 1.8l6.4 11.4H1.6z"/>',
    diamond:'<path d="M8 1.2l6.8 6.8L8 14.8 1.2 8z"/>', star:'<path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.3 1-4.6L1.3 6l4.7-.5z"/>' };
  return `<svg class="dseat" viewBox="0 0 16 16" width="${px}" height="${px}" aria-hidden="true" fill="${col}" stroke="#1A0F45" stroke-width="1.6" stroke-linejoin="round">${P[shape] || P.circle}</svg>`;
}

/* ---- 게임 정의에서 읽는 대전 설정 ---- */
const duelNG = id => NG[id] || {};
const duelKindOf = id => ['race', 'score', 'shared', 'turn'].includes(duelNG(id).duelKind) ? duelNG(id).duelKind : 'race';
const duelMaxOf = id => Math.max(2, Math.min(5, Math.floor(+duelNG(id).duelMax || 2)));
function duelEndOf(id){ const e = duelNG(id).duelEnd, k = duelKindOf(id); return ['first', 'all', 'game'].includes(e) ? e : k === 'race' ? 'first' : k === 'score' ? 'all' : 'game'; }
const duelPaceGet = () => store.get('hp:duelPace', 'n') === 's' ? 's' : 'n';
const duelSeenGet = id => { const a = store.get('hp:duelSeen:' + id, null); return Array.isArray(a) ? a.slice(-3).map(x => String(x).slice(0, 40)) : []; };
function duelSeenPush(id){
  try{ const f = duelNG(id).duelAvoidKey; if(!f) return; const k = f(); if(k == null || k === '') return;
    const a = duelSeenGet(id).filter(x => x !== String(k)); a.push(String(k).slice(0, 40)); store.set('hp:duelSeen:' + id, a.slice(-3)); }catch(_){}
}
/* 대전 판 설정: 게임의 duelCfg({ n, pace, avoid, diff })가 있으면 그것, 없으면 그 난이도 판. 느긋하게면 duelSlow 또는 limit×2.
   null을 돌려주면 엔진(startGame)이 원래 난이도 판을 쓴다. 문제 내용은 여기서 정하지 않음(init의 rng로만) */
function duelCfgFor(id, lv, o){
  const m = duelNG(id); let cfg = null;
  try{ if(m.duelCfg) cfg = m.duelCfg(Object.assign({ diff:lv }, o)) || null; }catch(_){ cfg = null; }
  if(!cfg && o.pace !== 's') return null;
  if(!cfg){ try{ cfg = Object.assign({}, levelOf(id, lv)[id]); }catch(_){ return null; } }
  if(o.pace === 's'){
    try{ cfg = m.duelSlow ? (m.duelSlow(Object.assign({}, cfg)) || cfg) : Object.assign({}, cfg, { limit:(cfg.limit || 0) * 2 }); }catch(_){}
  }
  return cfg;
}

/* ======================================================================
   (1) 빠른 대전 찾기 v3 (docs/21 3-4, 10-2)
   대기실 presence { du:'w3'|'h3'|'j3', dg, dt, nk, dk:'n'|'s', dv:3, dr, dc }
   - 같은 게임·같은 속도에서 dt가 가장 이른 사람이 방장(h3) → 방 이름 'fl-d3-<peer12>-<dt36>'
   - 나머지는 그 방에 들어감(j3). 방장이 시작: 최대 인원이 차거나, 2명 이상 + 두 번째 입장 6초, 또는 찾기 12초
   - 12초에 혼자면 컴퓨터 1:1. 시작 정보 { go, pl, sd, r, cf }에 없는 늦은 사람은 다시 찾기
   ====================================================================== */
let DS = null;   /* 상대 찾기 상태 */
function duelStart(id){
  if(!HOST.canDuel()) return;
  if(duelNG(id).duelLaunch){ duelNG(id).duelLaunch({ pace:duelPaceGet() }); return; }   /* 자기 방식의 대전(함대·고스톱·끝말잇기) */
  duelSearch(id);
}
function duelLobbyClear(){ if(ROOM) try{ ROOM.presence({ du:null, dg:null, dt:null, dp:null, nk:null, dk:null, dv:null, dr:null, dc:null }).catch(() => {}); }catch(_){} }
function duelSearchStop(){
  if(!DS) return;
  clearInterval(DS.iv); clearTimeout(DS.to); if(DS.un) try{ DS.un(); }catch(_){}
  if(DS.nr && !DS.keep) try{ DS.nr.leave(); }catch(_){}
  if(DS.live) duelLobbyClear();
  DS = null;
}
const duelPeerKey = p => String(p || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
function duelSearch(id, keepT0){
  const t0 = keepT0 || Date.now();
  duelSearchStop();
  const max = duelMaxOf(id), pace = duelPaceGet();
  const S = DS = { id, nick:duelNick(), pid:duelPidNew(), t0, dt:Date.now(), live:duelLive(), phase:'search', max, pace, fresh:!store.get('hp:help:' + id, false) };
  const slots = Array.from({ length:max }, (_, i) => `<span class="ds-slot${i ? '' : ' me'}" data-i="${i}">${i ? '' : avatar({ me:true })}</span>`).join('');
  openModal(`<div class="dsearch v3" style="--gc:${GCOL[id][1]}"><p class="kick">대전 · ${max}명까지</p><h3>대전 찾는 중</h3><p class="ds-game">${GAMES[id].name}</p>
    <div class="ds-ppl" id="dsPpl">${slots}</div>
    <p class="ds-cnt" id="dsCnt">${S.live ? `지금 1명 · ${max}명까지` : '지금은 컴퓨터와 겨뤄요'}</p>
    <p class="note" id="dsTxt"></p>
    <button class="ds-pace${pace === 's' ? ' on' : ''}" id="dsPace" aria-pressed="${pace === 's'}"><i></i>느긋하게 · 시간 2배</button>
    ${HOST.duelRewardHtml()}
    <div class="mbtns"><button class="b2" id="dsCancel">취소</button><button class="b1" id="dsAi">${S.live ? '컴퓨터와 바로 하기' : '바로 시작'} ${costTag()}</button></div></div>`);
  $('#modal').classList.add('duelm');
  sfx('flPing');
  $('#dsCancel').onclick = () => { duelSearchStop(); closeModal(); };
  $('#dsAi').onclick = () => duelGoAI(S);
  $('#dsPace').onclick = () => { if(DS !== S || S.phase === 'start') return; store.set('hp:duelPace', S.pace === 's' ? 'n' : 's'); sfx('toggle', { on:S.pace !== 's' }); duelSearch(id); };
  if(!S.live){ duelSearchText(S); S.to = setTimeout(() => duelGoAI(S), 1600); return; }
  duelLobbyPub(S, { du:'w3' });
  const check = () => { if(DS === S) try{ duelSearchCheck(S); }catch(_){} };
  try{ S.un = ROOM.onPeers(check, () => {}); }catch(_){}
  S.iv = setInterval(() => { check(); duelSearchText(S); }, 400);
  duelSearchText(S);
}
function duelLobbyPub(S, o){
  try{ ROOM.presence(Object.assign({ du:'w3', dg:S.id, dt:S.dt, nk:S.nick, dk:S.pace, dv:3, dp:null, dr:null, dc:null }, o)).catch(() => {}); }catch(_){}
}
/* 찾기 창 글자·얼굴 */
function duelSearchText(S){
  if(DS !== S) return;
  const t = $('#dsTxt'), c = $('#dsCnt'), ppl = $('#dsPpl'); if(!t) return;
  if(!S.live){ t.innerHTML = '<b>지금은 컴퓨터와 겨뤄요.</b> 실시간 서버에 연결되면 사람과 붙어요.'; return; }
  const left = Math.max(0, 12 - Math.floor((Date.now() - S.t0) / 1000));
  const mem = S.mem || [];
  if(c) c.textContent = `지금 ${Math.max(1, mem.length)}명 · ${S.max}명까지`;
  if(ppl){
    const others = mem.filter(m => m.pid !== S.pid);
    ppl.querySelectorAll('.ds-slot').forEach((el, i) => {
      if(!i) return; const m = others[i - 1], k = m ? m.pid : '';
      if(el.dataset.k === k) return; el.dataset.k = k;
      el.classList.toggle('on', !!m); el.innerHTML = m ? oppAv(m.nick) : '';
    });
  }
  if(S.phase === 'start'){ t.innerHTML = '모두 모였어요! 곧 시작해요'; return; }
  if(S.aiSoon){ t.innerHTML = '<b>사람이 없어 컴퓨터와 붙어요</b>'; return; }
  const n = duelWaiting(S.id);
  t.innerHTML = mem.length >= 2 ? `<b>${mem.length}명이 모였어요.</b> 곧 시작해요${S.max > mem.length ? ' · 더 들어올 수 있어요' : ''}`
    : `<b class="num">${left}초</b> 안에 상대가 없으면 컴퓨터와 붙어요${n ? ` · 기다리는 사람 ${n}명` : ''}`;
}
/* 대기실·방을 보고 할 일 정하기(0.4초마다 + 대기실이 바뀔 때) */
function duelSearchCheck(S){
  if(S.phase === 'start' || S.aiSoon) return;
  const now = Date.now();
  if(S.phase === 'search'){
    let ps; try{ ps = ROOM.peers(); }catch(_){ return; }
    const me = ps.find(p => p.sameTab); if(!me) return;
    S.myPeer = me.peer;
    const same = p => p.presence && p.presence.dv === 3 && p.presence.dg === S.id && (p.presence.dk || 'n') === S.pace && typeof p.presence.dt === 'number';
    const ord = (a, b) => a.presence.dt - b.presence.dt || (a.peer < b.peer ? -1 : 1);
    const hosts = ps.filter(p => !p.sameTab && same(p) && p.presence.du === 'h3' && p.presence.dr && (+p.presence.dc || 1) < S.max && !(S.skip || {})[p.presence.dr]).sort(ord);
    if(hosts.length){ duelJoinRoom(S, hosts[0].presence.dr); return; }
    const ws = ps.filter(p => same(p) && p.presence.du === 'w3').sort(ord);
    /* 가장 이른 사람이 0.8초 동안 그대로면 방장(동시에 찾기 시작해 대기실 소식이 덜 왔을 때 방장이 둘 생기는 것 줄이기) */
    if(ws.length && ws[0].sameTab){ if(!S.firstAt) S.firstAt = now; if(now - S.firstAt >= 800){ duelBecomeHost(S); return; } } else S.firstAt = 0;
    if(now - S.t0 > 12000) duelAiSoon(S);
    return;
  }
  if(!S.nr) return;
  let rp = []; try{ rp = S.nr.peers(); }catch(_){ return; }
  S.mem = rp.filter(p => p.presence && p.presence.pid && p.presence.nk && p.presence.dv === 3).map(p => ({ pid:p.presence.pid, nick:String(p.presence.nk).slice(0, 12), peer:p.peer, nw:!!p.presence.nw, me:!!p.sameTab, hs:!!p.presence.hs, go:p.presence.go, pl:p.presence.pl, sd:p.presence.sd, r:p.presence.r, cf:p.presence.cf }));
  if(!S.mem.some(m => m.me)) S.mem.unshift({ pid:S.pid, nick:S.nick, me:true });
  if(S.phase === 'host'){
    const n = S.mem.length;
    try{ ROOM.presence({ dc:n }).catch(() => {}); }catch(_){}
    if(n >= 2){ if(!S.secondAt) S.secondAt = now; } else S.secondAt = 0;
    /* 거의 같은 때 방장이 둘 생겼으면: 합쳐도 정원 안이면 늦은 쪽 방장이 이른 쪽 방으로(남은 사람도 방장이 없어 다시 찾다가 합류) */
    {
      let ps = []; try{ ps = ROOM.peers(); }catch(_){}
      const other = ps.find(p => !p.sameTab && p.presence && p.presence.dv === 3 && p.presence.du === 'h3' && p.presence.dg === S.id && (p.presence.dk || 'n') === S.pace && p.presence.dr && p.presence.dr !== S.R
        && (+p.presence.dc || 1) + n <= S.max && (p.presence.dt < S.dt || (p.presence.dt === S.dt && p.peer < S.myPeer)));
      if(other){ const nr = S.nr; S.nr = null; try{ nr.leave(); }catch(_){} duelJoinRoom(S, other.presence.dr); return; }
    }
    if(n >= S.max || (n >= 2 && now - S.secondAt >= 6000) || (n >= 2 && now - S.t0 >= 12000)){ duelHostGo(S); return; }
    if(n < 2 && now - S.t0 >= 12000) duelAiSoon(S);
    return;
  }
  if(S.phase === 'join'){
    const h = S.mem.find(m => m.hs || (m.go && Array.isArray(m.pl)));
    if(h && typeof h.go === 'number' && Array.isArray(h.pl) && (h.r || 1) === 1){
      if(h.pl.includes(S.pid)){ duelLaunchRound(S, h); return; }
      duelRejoin(S, '이번 판은 꽉 찼어요 · 다시 찾을게요'); return;
    }
    if(!h){ if(!S.noHost) S.noHost = now; else if(now - S.noHost > 1500){ duelRejoin(S, '방이 닫혔어요 · 다시 찾을게요'); return; } } else S.noHost = 0;
    if(now - S.joinAt > 25000) duelRejoin(S, '');
  }
}
async function duelJoinRoom(S, R){
  S.phase = 'joining';
  duelLobbyPub(S, { du:'j3', dr:R });
  let nr;
  try{ nr = await ROOM.join(String(R).slice(0, 60)); }catch(_){ if(DS === S){ S.phase = 'search'; (S.skip = S.skip || {})[R] = 1; duelLobbyPub(S, { du:'w3' }); } return; }
  if(DS !== S){ try{ nr.leave(); }catch(_){} return; }
  S.nr = nr; S.R = R; S.phase = 'join'; S.joinAt = Date.now(); S.noHost = 0;
  nr.presence({ pid:S.pid, nk:S.nick, nw:S.fresh ? 1 : 0, dv:3, hs:0 }).catch(() => {});
  sfx('flLock'); fxBuzz([20, 40, 20]);
}
async function duelBecomeHost(S){
  S.phase = 'hosting';
  const R = ('fl-d3-' + duelPeerKey(S.myPeer) + '-' + S.dt.toString(36)).slice(0, 60);
  let nr;
  try{ nr = await ROOM.join(R); }catch(_){ if(DS === S) S.phase = 'search'; return; }
  if(DS !== S){ try{ nr.leave(); }catch(_){} return; }
  S.nr = nr; S.R = R; S.phase = 'host'; S.secondAt = 0;
  nr.presence({ pid:S.pid, nk:S.nick, nw:S.fresh ? 1 : 0, dv:3, hs:1 }).catch(() => {});
  duelLobbyPub(S, { du:'h3', dr:R, dc:1 });
}
/* 방장: 시작 정보 보내고 시작 */
function duelHostGo(S){
  const mem = S.mem.slice(0, S.max), me = mem.find(m => m.me) || { pid:S.pid };
  const pl = [me.pid, ...mem.filter(m => !m.me).map(m => m.pid)].slice(0, S.max);
  const fresh = S.fresh || mem.some(m => m.nw);
  const go = netNow() + (fresh ? 4000 : 2500), sd = duelSdNew();
  const info = { go, pl, sd, r:1, cf:{ dk:S.pace, av:duelSeenGet(S.id), n:pl.length } };
  try{ S.nr.presence(Object.assign({ hs:1 }, info)).catch(() => {}); }catch(_){}
  duelLaunchRound(S, Object.assign({ pid:S.pid }, info));
}
function duelRejoin(S, msg){
  const nr = S.nr; S.nr = null; if(nr) try{ nr.leave(); }catch(_){}
  if(msg) toast(msg);
  if(DS === S){ (S.skip = S.skip || {})[S.R] = 1; S.phase = 'search'; S.mem = []; S.R = null; S.t0 = Date.now(); duelLobbyPub(S, { du:'w3' }); }
}
function duelAiSoon(S){
  if(S.aiSoon) return; S.aiSoon = true; duelSearchText(S);
  S.to = setTimeout(() => { S.aiSoon = false; duelGoAI(S); }, 700);
}
/* 모두 같은 시작 정보로 같은 판을 시작 */
function duelLaunchRound(S, h){
  if(S.phase === 'start') return;
  S.phase = 'start'; S.keep = true; clearInterval(S.iv); if(S.un) try{ S.un(); }catch(_){} S.un = null;
  duelSearchText(S);
  const byPid = {}; (S.mem || []).forEach(m => { byPid[m.pid] = m; });
  const cf = h.cf || {}, avoid = Array.isArray(cf.av) ? cf.av.slice(0, 3) : [];
  const pl = h.pl.map(pid => ({ pid, nick:pid === S.pid ? S.nick : ((byPid[pid] || {}).nick || '상대'), peer:(byPid[pid] || {}).peer }));
  const duel = duelMake({ id:S.id, mode:'pvp', R:S.R, r:h.r || 1, sd:h.sd, nr:S.nr, pl, myPid:S.pid, myNick:S.nick, go:h.go, pace:S.pace, avoid, quick:true });
  duelSearchStop(); closeModal(); startGame(S.id, 'normal', { duel });
}
function duelGoAI(S){
  if(DS !== S || S.phase === 'start' || S.phase === 'joining' || S.phase === 'hosting') return;
  const id = S.id, myNick = S.nick;
  if(S.nr){ const nr = S.nr; S.nr = null; try{ nr.leave(); }catch(_){} }
  const duel = duelMakeAI(id, myNick, S.pace);
  duelSearchStop(); closeModal(); startGame(id, 'normal', { duel });
}
function duelMakeAI(id, myNick, pace){
  const seed = 'ai:' + id + ':' + Date.now() + ':' + Math.random(), pid = duelPidNew();
  return duelMake({ id, mode:'ai', seed, pl:[{ pid, nick:myNick }, { pid:'ai', nick:duelNick(), ai:true }], myPid:pid, myNick, pace, avoid:duelSeenGet(id),
    startAt:Date.now() + (store.get('hp:help:' + id, false) ? 2000 : 3500) });
}
/* 상대가 이미 정해진 대전(대전 방·친구와 같이 하기): 상대 찾기 없이 같은 이름의 대전 방에 들어가 같은 순간에 시작.
   o = { nick, room(결과 창이 쓰는 방 정보), onFail(why), n:모일 인원(기본 2, 2~5), seed, round, pace, avoid(방장이 보낸 최근 본 판, 모두 같게) }. 돌려주는 값의 cancel()로 그만둠.
   씨앗 = o.seed 또는 '방이름:날짜'(대전 방은 판마다 방 이름이 바뀜). 방장 = 들어온 사람 중 peer가 가장 작은 사람. */
function duelPrivate(id, lv, name, o = {}){
  const H = { dead:false, cancel(){ H.dead = true; clearInterval(H.iv); if(H.nr) try{ H.nr.leave(); }catch(_){} } };
  const fail = why => { if(H.dead) return; H.cancel(); if(o.onFail) try{ o.onFail(why); }catch(_){} };
  if(!duelLive()){ setTimeout(() => fail('offline'), 0); return H; }
  const nick = o.nick || duelNick(), pid = duelPidNew(), need = Math.max(2, Math.min(5, +o.n || 2)), pace = o.pace === 's' ? 's' : 'n';
  ROOM.join(String(name).slice(0, 60)).then(nr => {
    if(H.dead){ try{ nr.leave(); }catch(_){} return; }
    H.nr = nr; nr.presence({ pid, nk:nick, nw:store.get('hp:help:' + id, false) ? 0 : 1, dv:3, pg:0, dn:0, sc:0 }).catch(() => {});
    const t0 = Date.now();
    H.iv = setInterval(() => {
      if(H.dead) return;
      let ps = []; try{ ps = nr.peers(); }catch(_){}
      const mem = ps.filter(p => p.presence && p.presence.nk).map(p => ({ pid:p.sameTab ? pid : (p.presence.pid || 'p:' + p.peer), peer:String(p.peer), nick:String(p.presence.nk).slice(0, 12), me:p.sameTab, nw:!!p.presence.nw, go:p.presence.go }));
      if(!mem.some(m => m.me)) return;
      const enough = mem.length >= need || (mem.length >= 2 && Date.now() - t0 > 12000);
      if(!enough){ if(Date.now() - t0 > 12000) fail('gone'); return; }
      clearInterval(H.iv);
      mem.sort((a, b) => a.peer < b.peer ? -1 : a.peer > b.peer ? 1 : 0);
      const host = mem[0], pl = mem.slice(0, 5).map(m => ({ pid:m.pid, nick:m.me ? nick : m.nick, peer:m.peer }));
      const duel = duelMake({ id, mode:'pvp', seed:o.seed || (name + ':' + dayKey()), R:name, r:+o.round || 1, nr, pl, myPid:pid, myNick:nick, pace, lv, room:o.room || null, avoid:Array.isArray(o.avoid) ? o.avoid.slice(0, 3).map(x => String(x).slice(0, 40)) : [] });
      if(host.me){
        const srv = netNow() + (mem.some(m => m.nw) || !store.get('hp:help:' + id, false) ? 4000 : 2500);
        duel.startAt = duelLocalStart(srv); nr.presence({ go:srv, pl:pl.map(x => x.pid) }).catch(() => {});
      } else if(typeof host.go === 'number') duel.startAt = duelLocalStart(host.go);
      H.dead = true; closeModal(); startGame(id, lv, { duel });
      if(!(G && G.duel === duel)){ try{ nr.presence({ q:1 }).catch(() => {}); nr.leave(); }catch(_){} if(o.onFail) try{ o.onFail('start'); }catch(_){} }   /* 하트가 없어 시작 못 함 */
    }, 250);
  }).catch(() => fail('join'));
  return H;
}
/* 컴퓨터 상대 결과 미리 정하기: 게임별 평균 시간·성공률(duelPace). 게임이 duelAi(rng, o)로 직접 정할 수도 있음 */
function duelAiPlan(id, rng, o = {}){
  const m = duelNG(id);
  if(m.duelAi) return m.duelAi(rng, o);
  const [T0, p] = m.duelPace || [180, .65];
  const cfg = o.cfg || (levelOf(id, 'normal')[id] || {}), lim = cfg.limit || 0;
  const ok = rng() < p;
  let T = T0 * (0.7 + rng() * 0.6) * (o.pace === 's' ? 1.5 : 1); if(lim) T = Math.min(T, lim * 0.97);
  return { ok, T, sc: ok ? Math.round((560 + rng() * 380) / 10) * 10 : 0, fail: 0.3 + rng() * 0.6 };
}
function gameProg(){
  if(!G) return 0; const id = G.id; let v = 0;
  try{ v = NG[id].progress(); }catch(_){ v = 0; }
  return Math.max(0, Math.min(1, v || 0));
}

/* ======================================================================
   (2) 대전 상태(G.duel) 만들기 · 참가자
   ====================================================================== */
/* o = { id, mode:'pvp'|'ai', seed?, R?, r, sd?, nr?, pl:[{pid,nick,peer?,ai?}], myPid, myNick, go?(서버 ms), startAt?, pace, avoid, lv?, room?, quick? } */
function duelMake(o){
  const kind = duelKindOf(o.id), seed = o.seed || (o.R + ':' + (o.r || 1) + ':' + o.sd);
  const P = {}, pl = o.pl.map(x => x.pid);
  o.pl.forEach((x, i) => { P[x.pid] = { pid:x.pid, seat:i, nick:String(x.nick || '상대').slice(0, 12), me:x.pid === o.myPid, ai:!!x.ai, peer:x.peer || null,
    st:{ pg:0, dn:0, ok:0, sc:0, mis:0 }, left:false, gone:0, evN:0, cl:{}, mv:'' }; });
  const opp = o.pl.find(x => x.pid !== o.myPid) || { nick:'상대' };
  const cfg = duelCfgFor(o.id, o.lv || 'normal', { n:pl.length, pace:o.pace, avoid:o.avoid || [] });
  const D = { v:3, mode:o.mode, kind, end:duelEndOf(o.id), seed, R:o.R || null, r:o.r || 1, sd:o.sd || null, nr:o.nr || null, pl, P, myPid:o.myPid, myNick:o.myNick,
    pace:o.pace || 'n', avoid:o.avoid || [], cfg, quick:!!o.quick, room:o.room || null,
    opp:{ nick:P[opp.pid] ? P[opp.pid].nick : '상대', pg:0, dn:0, sc:0 }, oppPeer:opp.peer || null, me:null,
    vs:pl.length > 2 ? pl.length + '명 대전' : null };
  if(typeof o.go === 'number') D.startAt = duelLocalStart(o.go);
  else if(o.startAt != null) D.startAt = o.startAt;
  if(o.mode === 'ai'){ const rng = mulberry(seedFrom(seed + 'p')); D.ai = duelAiPlan(o.id, rng, { pace:D.pace, cfg:cfg || null }); }
  return D;
}
const duelStatOf = id => NG[id] && NG[id].duelStat;
const duelLocalStart = srv => srv - ((ROOM && ROOM.clockOffset) || 0);   /* 서버 시각 → 내 시계 */
const duelSrv = () => typeof netNow === 'function' ? netNow() : Date.now();
const duelStarted = () => !!(G && G.duel && G.duel.go);
const duelV3 = () => !!(G && G.duel && G.duel.v === 3 && !G.duel.fleet);
/* 지금 내 수치(게임 duelStat + 엔진이 세는 틀린 횟수·마지막으로 하나 푼 시각) */
function duelStatNow(){
  const D = G && G.duel, S = duelStatOf(G.id); let s = {};
  try{ if(S) s = S.get() || {}; }catch(_){}
  for(const k in s) if(typeof s[k] !== 'number' || !isFinite(s[k])) delete s[k];
  s = Object.assign({ pg:Math.round(gameProg() * 1000) / 1000 }, s);
  if(D && D.v === 3){
    if(typeof s.lf === 'number'){ if(D.lfPrev != null && s.lf < D.lfPrev) D.misAuto = (D.misAuto || 0) + (D.lfPrev - s.lf); D.lfPrev = s.lf; }
    if(s.mis == null) s.mis = D.misAuto || 0;
    const key = s.v != null ? s.v : s.pg;
    if(D.vPrev != null && key > D.vPrev && D.go) D.la = duelSrv();
    D.vPrev = key; if(D.la) s.la = D.la;
    if(D.kind === 'shared'){ const me = D.P[D.myPid]; if(me){ s.v = me.own || 0; if(me.la) s.la = me.la; } }
    D.lastGood = (!D.lastGood || (s.pg || 0) >= (D.lastGood.pg || 0) || (s.v || 0) >= (D.lastGood.v || 0)) ? s : D.lastGood;
  }
  return s;
}
/* 내 수치: 끝났으면 저장된 마지막 값(끝난 뒤 다시 읽지 않음 → 진행 0% 버그 막기) */
function duelMeStat(){
  const D = G.duel;
  if(D.fin) return D.fin;
  if(G.over && D.me) return Object.assign({}, D.meStat || {}, { pg:D.me.pg, dn:1, ok:!!D.me.sc, sc:D.me.sc });
  return duelStatNow();
}
/* 참가자 목록(자리 순서). col·shape는 내 화면 기준(나는 늘 분홍 원) */
function duelPlayers(){
  const D = G && G.duel; if(!D || D.v !== 3) return [];
  const rk = duelRanks();
  return D.pl.map(pid => duelPub3(D, D.P[pid], rk));
}
function duelPub3(D, P, rk){
  const vs = duelViewSeat(D, P), S = DUEL_SEAT[vs % 5];
  const st = P.me ? Object.assign({}, duelMeStat()) : Object.assign({}, P.st);
  return { pid:P.pid, seat:P.seat, nick:P.me ? D.myNick : P.nick, me:P.me, ai:P.ai, col:S.col, shape:S.shape, st, left:!!P.left, gone:!!P.gone, rank:rk ? rk[P.pid] : 0 };
}
function duelViewSeat(D, P){ const me = D.P[D.myPid]; if(P.me) return 0; if(P.seat === 0 && me) return me.seat; return P.seat; }
const duelMe = () => { const D = G && G.duel; return D && D.v === 3 ? duelPub3(D, D.P[D.myPid], duelRanks()) : null; };
/* 지금 방장인지: 나간 사람을 빼고 pl 순서 첫 사람 */
function duelIsHost(){ const D = G && G.duel; if(!D || D.v !== 3) return false; const h = D.pl.find(pid => !D.P[pid].left && !D.P[pid].ai); return h === D.myPid; }
function duelSeed(){ return G && G.duel ? G.duel.seed : null; }
const DUEL_SERIES = {};   /* 방마다 판별 1위 수(같은 규칙이라 모두 같은 값) */
function duelRound(){
  const D = G && G.duel; if(!D) return { r:1, series:{}, freeLeft:null };
  let free = null; try{ if(typeof HOST.duelFreeLeft === 'function') free = HOST.duelFreeLeft(D.R || (D.room && D.room.id) || null); }catch(_){}
  return { r:D.r || 1, series:Object.assign({}, DUEL_SERIES[D.R] || {}), freeLeft:free };
}

/* ---- 순위(docs/21 3-11): 경주 ok → ft 이른 → v 많은 → mis 적은 → la 이른 → 공동. 점수: 점수 큰 → mis. 선점: 차지 수 → mis → 마지막 차지 이른 ---- */
/* 순위에 쓰는 값. 선점은 늘 지금 차지 기록(cl)으로 다시 센 수를 씀(늦게 도착한 더 이른 기록까지 반영 → 모두 같은 값) */
function duelStOf(D, P){
  const s = P.me ? (D.fin || duelMeStat()) : P.st;
  return D.kind === 'shared' ? Object.assign({}, s, { v:P.own || 0, la:P.la || undefined }) : s;
}
function duelCmp(D, A, B){
  const a = duelStOf(D, A), b = duelStOf(D, B);
  const la = A.left && !a.dn, lb = B.left && !b.dn;   /* 끝내기 전에 나간 사람은 맨 뒤 */
  if(la !== lb) return la ? 1 : -1;
  const f = duelNG(G.id).duelRank;
  if(f){ try{ const x = f(Object.assign({ left:la }, a), Object.assign({ left:lb }, b)); if(typeof x === 'number' && x) return x; }catch(_){} }
  const num = (x, k) => typeof x[k] === 'number' ? x[k] : null;
  const val = x => num(x, 'v') != null ? x.v : (x.pg || 0) * 1000;
  const lt = x => num(x, 'la') != null ? x.la : Infinity;
  if(D.kind === 'score'){
    const sa = val(a), sb = val(b); if(sa !== sb) return sb - sa;
    return (a.mis || 0) - (b.mis || 0);
  }
  if(D.kind === 'race'){
    if(!!a.ok !== !!b.ok) return a.ok ? -1 : 1;
    if(a.ok && b.ok){ const fa = num(a, 'ft'), fb = num(b, 'ft'); if(fa != null && fb != null && fa !== fb) return fa - fb; if(a.sc !== b.sc) return (b.sc || 0) - (a.sc || 0); }
  }
  const va = val(a), vb = val(b); if(va !== vb) return vb - va;
  if((a.mis || 0) !== (b.mis || 0)) return (a.mis || 0) - (b.mis || 0);
  if(lt(a) !== lt(b)) return lt(a) < lt(b) ? -1 : 1;
  return 0;
}
/* pid → 순위(1부터, 공동이면 같은 수) */
function duelRanks(){
  const D = G && G.duel; if(!D || D.v !== 3) return {};
  const ps = D.pl.map(pid => D.P[pid]), out = {};
  for(const A of ps){ let ahead = 0; for(const B of ps) if(B !== A && duelCmp(D, B, A) < 0) ahead++; out[A.pid] = ahead + 1; }
  return out;
}
const duelTieAt = (rk, pid) => Object.keys(rk).filter(k => rk[k] === rk[pid]).length > 1;

/* ======================================================================
   (3) 사건 · 선점 · 차례 (docs/21 3-9)
   ====================================================================== */
/* 사건 보내기 → 번호. 나에게는 다시 오지 않음. 받는 쪽은 사람마다 마지막 번호보다 큰 것만 차례로 처리 */
function duelSend(kind, data){
  const D = G && G.duel; if(!D || D.v !== 3) return 0;
  D.evN = (D.evN || 0) + 1; D.evLog = D.evLog || [];
  D.evLog.push([D.evN, String(kind).slice(0, 12), data == null ? null : data, Math.round(duelSrv())]);
  while(D.evLog.length > 40 || (D.evLog.length > 1 && JSON.stringify(D.evLog).length > 2000)) D.evLog.shift();
  D.urgent = true; duelPub(false);
  return D.evN;
}
function duelEvRead(D, P, ev){
  if(!Array.isArray(ev)) return;
  const list = ev.filter(e => Array.isArray(e) && typeof e[0] === 'number' && e[0] > P.evN).sort((a, b) => a[0] - b[0]);
  for(const e of list){
    P.evN = e[0];
    const x = { n:e[0], kind:e[1], data:e[2], at:e[3] };
    if(x.kind === '~t'){ duelTurnRecv(D, P, x); continue; }
    try{ const f = duelNG(G.id).onDuelEvent; if(f) f(x, duelPub3(D, P, null)); }catch(_){}
  }
}
/* 선점: 누르는 순간 서버 시각을 cl[key]에 올림. 주인 = 서버 시각이 가장 이른 사람(같으면 pid가 작은 사람) */
function duelClaim(key){
  const D = G && G.duel; if(!D || D.v !== 3 || G.over || !D.go) return { ok:false };
  key = String(key).slice(0, 24);
  const own = duelOwner(key);
  if(own && own !== D.myPid) return { ok:false, owner:own };
  const me = D.P[D.myPid];
  if(me.cl[key]) return { ok:true, again:true };
  me.cl[key] = Math.round(duelSrv());
  duelClaimsRecalc(D);
  D.urgent = true; duelPub(false);
  const g = G;
  setTimeout(() => { try{ if(G !== g || !G.duel) return; if(duelOwner(key) === D.myPid){ const f = duelNG(G.id).onDuelClaim; if(f) f(key, D.myPid, { mine:true, lost:false, at:me.cl[key], sure:true }); sfx('ding'); } }catch(_){} }, 400);
  return { ok:true };
}
function duelOwner(key){ const D = G && G.duel; return D && D.owners ? (D.owners[String(key)] || null) : null; }
function duelClaimsRecalc(D){
  const best = {};
  for(const pid of D.pl){
    const P = D.P[pid], cl = P.cl || {};
    for(const k in cl){ const t = +cl[k]; if(!isFinite(t)) continue; const b = best[k]; if(!b || t < b.t || (t === b.t && pid < b.pid)) best[k] = { t, pid }; }
  }
  const prev = D.owners || {}, own = {};
  D.pl.forEach(pid => { D.P[pid].own = 0; D.P[pid].la = 0; });
  for(const k in best){ own[k] = best[k].pid; const P = D.P[best[k].pid]; P.own++; P.la = Math.max(P.la || 0, best[k].t); }
  D.owners = own;
  for(const k in own) if(prev[k] !== own[k]){
    const lost = prev[k] === D.myPid && own[k] !== D.myPid;
    try{ const f = duelNG(G.id).onDuelClaim; if(f) f(k, own[k], { mine:own[k] === D.myPid, lost, at:best[k].t }); }catch(_){}
    if(lost){ const w = D.P[own[k]]; duelNotify(`간발의 차! ${esc(w.nick)}님이 먼저`, { from:w, kind:'bad', force:true }); }
  }
  D.pl.forEach(pid => { if(!D.P[pid].me && D.kind === 'shared'){ D.P[pid].st.v = D.P[pid].own; if(D.P[pid].la) D.P[pid].st.la = D.P[pid].la; } });
}
/* 차례: duelTurn.order()·cur()·mine()·act(kind, data, { next })·onAct(cb)·timeout(sec)·left().
   차례 순서 = pl 순서(나간 사람 건너뜀). 차례인 사람의 사건만 인정. 시간 + 2초가 지나면 모든 기기가 같은 '대신 하기'(rng = 판 씨앗 + 차례 번호) */
const duelTurn = {
  order(){ const D = G && G.duel; return D && D.v === 3 ? D.pl.filter(pid => !D.P[pid].left) : []; },
  cur(){ const T = duelTurnState(); return T ? T.pid : null; },
  n(){ const T = duelTurnState(); return T ? T.n : 0; },
  mine(){ const T = duelTurnState(); return !!T && T.pid === G.duel.myPid; },
  act(kind, data, o = {}){
    const D = G && G.duel, T = duelTurnState(); if(!T || G.over) return false;
    const as = o.as && D.P[o.as] && D.P[o.as].ai ? o.as : D.myPid;   /* 컴퓨터 상대 차례는 게임이 대신 둠 */
    if(T.pid !== as) return false;
    if(T.lim && duelSrv() > T.since + T.lim * 1000 + 1000) return false;   /* 늦은 수는 무효(다른 기기가 곧 '대신 하기') */
    const next = o.next !== false, n = T.n, at = Math.round(duelSrv());
    if(as === D.myPid && D.mode === 'pvp') duelSend('~t', { k:String(kind).slice(0, 12), d:data == null ? null : data, n, nx:next ? 1 : 0 });
    if(next) duelTurnAdvance(D, at);
    return true;
  },
  onAct(cb){ const D = G && G.duel; if(D && typeof cb === 'function') (D.turnCbs = D.turnCbs || []).push(cb); },
  timeout(sec){ const T = duelTurnState(); if(T) T.lim = Math.max(0, +sec || 0) * (G.duel.pace === 's' && !duelNG(G.id).duelSlow ? 2 : 1); },
  left(){ const T = duelTurnState(); return T && T.lim ? Math.max(0, (T.since + T.lim * 1000 - duelSrv()) / 1000) : null; }
};
function duelTurnState(){
  const D = G && G.duel; if(!D || D.v !== 3) return null;
  if(!D.turn){ const o = D.pl.filter(pid => !D.P[pid].left); D.turn = { n:0, pid:o[0] || null, since:D.goSrv || duelSrv(), lim:0, wait:[] }; }
  return D.turn;
}
function duelTurnAdvance(D, at){
  const T = D.turn, o = D.pl.filter(pid => !D.P[pid].left); if(!o.length) return;
  const i = D.pl.indexOf(T.pid);
  let nx = null; for(let k = 1; k <= D.pl.length; k++){ const p = D.pl[(i + k) % D.pl.length]; if(!D.P[p].left){ nx = p; break; } }
  T.n++; T.pid = nx; T.since = at;
}
function duelTurnFire(D, x){ (D.turnCbs || []).forEach(cb => { try{ cb(x); }catch(_){} }); }
function duelTurnRecv(D, P, x){
  const T = duelTurnState(), d = x.data || {};
  if(typeof d.n !== 'number' || d.n < T.n) return;
  T.wait.push({ pid:P.pid, d, at:x.at });
  duelTurnDrain(D);
}
function duelTurnDrain(D){
  const T = D.turn; let go = true;
  while(go){
    go = false;
    const i = T.wait.findIndex(w => w.d.n === T.n && w.pid === T.pid);
    if(i >= 0){ const w = T.wait.splice(i, 1)[0]; duelTurnFire(D, { kind:w.d.k, data:w.d.d, pid:w.pid, n:w.d.n, auto:false }); if(w.d.nx) duelTurnAdvance(D, w.at); go = true; }
    T.wait = T.wait.filter(w => w.d.n >= T.n);
  }
}
function duelTurnTick(D){
  if(D.kind !== 'turn' || !D.turn || G.over) return;
  const T = D.turn;
  if(T.pid && D.P[T.pid] && D.P[T.pid].left){ duelTurnFire(D, { kind:'skip', pid:T.pid, n:T.n, auto:true }); duelTurnAdvance(D, Math.round(duelSrv())); return; }
  if(T.lim && duelSrv() > T.since + T.lim * 1000 + 2000){
    const at = T.since + T.lim * 1000 + 2000;
    duelTurnFire(D, { kind:'timeout', pid:T.pid, n:T.n, auto:true, rng:mulberry(seedFrom(D.seed + ':t' + T.n)) });
    duelTurnAdvance(D, at);
  }
}
/* 선점·차례 게임이 '판 끝'을 알림(모두 같은 상태에서 같은 판단 → 누가 불러도 같음) */
function duelEndNow(why){
  const D = G && G.duel; if(!D || D.v !== 3 || G.over) return;
  D.ge = 1; if(why && !D.endWhy) D.endWhy = String(why);
  if(!D.endBy) D.endBy = { k:'game' };
  duelCut('game');
}

/* ======================================================================
   (4) 컴퓨터 상대(사람 같은 속도, docs/21 3-10): 미리 정한 결과를 한 칸씩 계단으로
   ====================================================================== */
function duelAiSched(D){
  const a = D.ai, S = duelStatOf(G.id) || {}, me = duelStatNow();
  const dT = Object.getOwnPropertyDescriptor(a, 'T');
  if(a.smooth || (dT && dT.get)) return { smooth:true };   /* 게임이 직접 움직이는 컴퓨터(예: 실제로 두는 수) */
  const rng = mulberry(seedFrom(D.seed + 'h'));
  const score = S.score || a.pts != null || D.kind === 'score';
  const N = score ? Math.max(4, Math.round(a.T / 6)) : Math.max(1, Math.min(60, me.t != null && !S.tile ? me.t : 12));
  const fEnd = a.ok ? 1 : Math.max(0, Math.min(.99, a.fail || 0));
  const K = a.ok ? N : Math.max(0, Math.floor(N * fEnd));
  const first = 3 + rng() * 3, at = [];
  let tt = first;
  for(let k = 0; k < K; k++){ if(k){ let g = (0.5 + rng() * 1.1); if(rng() < .15) g += (4 + rng() * 4) / Math.max(1, (a.T - first) / Math.max(1, K - 1)); tt += g; } at.push(tt); }
  if(K > 1){ const span = at[K - 1] - first, want = Math.max(1, a.T - first); for(let k = 1; k < K; k++) at[k] = first + (at[k] - first) * want / span; }
  else if(K === 1) at[0] = Math.min(first, a.T);
  /* 틀린 횟수: 기회 3번 게임에서 못 끝내면 3번(기회를 다 씀), 아니면 0~2번 */
  const nm = S.lfMax === 3 && !a.ok ? 3 : Math.floor(rng() * 3), mis = [];
  for(let k = 0; k < nm; k++) mis.push(S.lfMax === 3 && !a.ok && k === nm - 1 ? a.T : 2 + rng() * Math.max(1, a.T - 2));
  mis.sort((x, y) => x - y);
  return { N, K, at, mis, score, keys:null, kOrder:null };
}
function duelAiTick(D){
  const a = D.ai, P = D.P.ai; if(!a || !P || P.st.dn) return;
  const S = duelStatOf(G.id) || {}, t = elapsed(), st = P.st;
  if(!D.aiS) D.aiS = duelAiSched(D);
  const H = D.aiS, me = duelStatNow();
  if(H.smooth){   /* 예전 방식(연속) */
    st.pg = a.ok ? Math.min(1, Math.pow(Math.max(0, t) / a.T, .9)) : Math.min(a.fail, a.fail * t / a.T);
    if(me.t != null){ st.t = me.t; st.v = Math.min(me.t, Math.floor(st.pg * me.t)); }
  } else {
    const k = H.at.filter(x => x <= t).length, prevV = st.k || 0;
    st.k = k; st.pg = Math.min(1, k / H.N);
    if(k > prevV) st.la = Math.round(D.goSrv + H.at[k - 1] * 1000);
    if(D.kind === 'shared'){ if(me.t != null) st.t = me.t; }
    else if(me.t != null){
      st.t = me.t;
      if(S.tile){ const top = Math.log2(Math.max(4, me.t)); st.v = Math.pow(2, Math.max(1, Math.round(1 + st.pg * (top - 1)))); }
      else if(H.score) st.v = Math.round(st.pg * (a.pts != null ? a.pts : (a.sc || me.t * .5)) / 10) * 10;
      else st.v = Math.min(me.t, k);
    } else st.v = k;
    st.mis = H.mis.filter(x => x <= t).length;
    if(S.lfMax === 3) st.lf = Math.max(0, 3 - st.mis);
    if(S.lfMax === 10) st.lf = Math.max(1, 10 - Math.floor(st.pg * (a.ok ? 3 : 7)));
    /* 선점 게임: 계단마다 남은 키 하나를 차지(같은 씨앗 → 같은 순서). 키 목록은 게임의 duelKeys() */
    if(D.kind === 'shared' && k > (H.claimed || 0)){
      try{ if(!H.keys){ const f = duelNG(G.id).duelKeys; H.keys = f ? (f() || []).map(String) : []; H.kOrder = shuffle(H.keys.slice(), mulberry(seedFrom(D.seed + 'k'))); } }catch(_){ H.keys = []; H.kOrder = []; }
      for(let j = H.claimed || 0; j < k; j++){
        const key = H.kOrder.find(x => !(D.owners || {})[x]);
        if(key != null) P.cl[key] = Math.round(D.goSrv + H.at[j] * 1000);
      }
      H.claimed = k; duelClaimsRecalc(D);
      if(!H.keys.length) st.v = k;
    }
    if(k > prevV) duelOppStep(D, P, prevV);
  }
  if(t >= a.T && !(H.smooth && !a.ok)){
    st.dn = 1; st.ok = a.ok ? 1 : 0; st.sc = a.ok ? (a.sc || 0) : 0;
    if(a.ok){ st.ft = Math.round(D.goSrv + a.T * 1000); st.pg = 1; if(st.t != null && !S.score && !S.tile && D.kind !== 'shared') st.v = st.t; }
    duelOnDone(D, P);
  } else if(H.smooth && t >= a.T){ /* 끝나지 않는 컴퓨터(게임이 끝을 정함) */ }
  duelSyncOpp(D);
}

/* ======================================================================
   (5) 화면: 준비·카운트다운 · 2명 막대 · 3~5명 칩 줄 · 미니 화면 · 큰 알림
   ====================================================================== */
function duelGoOpen(){
  const D = G.duel, id = G.id, rules = (HELP[id] || []).slice(0, 3), me = G, n = D.pl.length;
  const old = $('#duelGo'); if(old) old.remove();
  document.body.classList.add('duel-ready');
  const el = document.createElement('div'); el.className = 'duelgo'; el.id = 'duelGo';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', GAMES[id].name + ' 대전 준비');
  el.style.setProperty('--gc', (GCOL[id] || [])[2] || 'var(--ink)');
  const op = D.P[D.pl.find(p => p !== D.myPid)] || { nick:'상대' };
  const vs = n > 2 ? `<div class="dg-many">${D.pl.map(pid => { const P = D.P[pid], s = DUEL_SEAT[duelViewSeat(D, P) % 5];
      return `<div class="dg-one">${P.me ? avatar({ me:true }) : oppAv(P.nick)}<b>${P.me ? '나' : esc(duelShortNick(P.nick))}</b>${duelShapeSvg(s.shape, s.col, 14)}</div>`; }).join('')}</div>`
    : `<div class="dg-vs"><div class="dg-side me">${avatar({ me:true })}<b>나</b><small>${esc(D.myNick || '')}</small></div><div class="dg-x">VS</div>
        <div class="dg-side op">${oppAv(op.nick)}<b>${esc(op.nick)}</b><small class="ok">${D.mode === 'ai' ? '컴퓨터' : '실시간 상대 · 준비 완료'}</small></div></div>`;
  const win = { race:'같은 문제예요 · 먼저 다 푼 사람이 1등, 그 순간 모두 끝나요', score:'같은 문제예요 · 끝났을 때 점수가 높은 사람이 이겨요',
    shared:'같은 판을 같이 봐요 · 먼저 누른 사람이 차지해요', turn:'차례대로 해요 · 많이 가져간 사람이 이겨요' }[D.kind];
  el.innerHTML = `<div class="dg-card panel">
      <p class="dg-kick">${n > 2 ? n + '명 대전' : '1:1 대전'} · ${G.L.name}${D.pace === 's' ? ' · 느긋하게' : ''}</p>
      <h2 class="dg-title">${GAMES[id].name}</h2>
      ${vs}
      <ol class="dg-rules">${rules.map((r, i) => `<li><span class="hn" style="background:${GAME_META[id].col}">${i + 1}</span>${r[0]}</li>`).join('')}</ol>
      <p class="dg-win">${win}</p>
    </div>
    <div class="dg-count" aria-live="assertive"><svg class="dg-ring" viewBox="0 0 176 176"><circle class="bg" cx="88" cy="88" r="82"/><circle class="fg" cx="88" cy="88" r="82"/></svg><span class="dg-n wait">준비</span></div>
    <p class="dg-status" id="dgStatus"><i></i>${D.mode === 'ai' ? '곧 시작해요' : (n > 2 ? n + '명' : '두 사람') + ' 모두 들어왔어요 · 같은 순간에 시작해요'}</p>`;
  document.body.appendChild(el);
  const nEl = el.querySelector('.dg-n'), ring = el.querySelector('.dg-ring .fg'), opened = Date.now();
  let shown = null;
  const loop = () => {
    if(!el.isConnected || G !== me || me.over) return;
    /* 실시간: 시작 시각은 방장이 서버 시각으로 정해 presence(go)로 알림. 못 받으면 3초 뒤 내 시계로 시작 */
    if(D.startAt == null && D.mode === 'pvp'){
      duelRead();
      if(D.startAt == null && Date.now() - opened > 3000) D.startAt = Date.now() + 1600;
    }
    const left = D.startAt == null ? 99999 : D.startAt - Date.now();
    const k = left > 1500 ? 'wait' : left > 0 ? String(Math.ceil(left / 500)) : 'go';   /* 3·2·1을 0.5초씩 */
    if(k !== shown){
      shown = k;
      if(k === 'wait'){ nEl.className = 'dg-n wait'; nEl.textContent = '준비'; }
      else if(k === 'go'){
        nEl.className = 'dg-n go'; void nEl.offsetWidth; nEl.classList.add('pop'); nEl.textContent = '시작!';
        sfx('start'); fxBuzz(30);
        duelBegin();
        setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 450);
        return;
      } else {
        nEl.className = 'dg-n'; void nEl.offsetWidth; nEl.classList.add('pop'); nEl.textContent = k;
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
  D.goSrv = at + (D.mode === 'pvp' ? ((ROOM && ROOM.clockOffset) || 0) : 0);
  if(D.mode === 'ai') D.goSrv = duelSrv() - (Date.now() - at);
  G.start = at; G.pausedMs = 0; G.pauseAt = 0; G.paused = false; G.lt = 0;
  D.t3 = Date.now();
  if(D.turn) D.turn.since = D.goSrv;
  document.body.classList.remove('duel-ready');
  if(D.mode === 'pvp') duelPub(true);
  duelTick();
}

/* 막대·칩 줄 자리: 상단 바가 보이면 제목 자리(2명) 또는 바로 아래(3~5명·미니), 자체 머리를 쓰는 게임은 맨 위 */
function duelBarPlace(bar, under){
  const play = $('#play'), pbar = play.querySelector(':scope > .pbar');
  pbar.classList.remove('has-duel');
  const place = duelNG(G.id).duelPlace;
  if(place !== 'top' && getComputedStyle(pbar).display !== 'none'){
    if(under) play.insertBefore(bar, pbar.nextSibling);
    else { pbar.insertBefore(bar, $('#helpBtn')); pbar.classList.add('has-duel'); }
    return;
  }
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
  document.body.classList.remove('duel-ready', 'is-duel', 'duel-many');
  if(!D || D.fleet){ duelBarRestore(); bar.hidden = true; bar.innerHTML = ''; bar.className = 'duelbar'; return; }
  document.body.classList.add('is-duel');
  const n = D.pl.length, mini = !!duelNG(G.id).duelMini;
  D.ui = mini ? 'mini' : n > 2 ? 'chips' : 'two';
  bar.className = 'duelbar v3 ' + D.ui;
  document.body.classList.toggle('duel-many', D.ui !== 'two');
  duelBarPlace(bar, D.ui !== 'two');
  bar.hidden = false;
  if(D.ui === 'two'){
    const op = D.P[D.pl.find(p => p !== D.myPid)];
    bar.innerHTML = `<div class="d2 me" id="d2Me"><span class="d2-av">${avatar({ me:true })}</span><span class="d2-t"><em>나</em><b class="num" id="d2MeV"></b></span><span class="d2-s" id="d2MeS"></span><i class="d2-trk"><i id="d2MeB"></i></i></div>
      <span class="d2-mid" id="d2Mid" aria-hidden="true">VS</span>
      <div class="d2 op" id="d2Op"><span class="d2-s" id="d2OpS"></span><span class="d2-t"><em>${op.ai ? '컴퓨터' : esc(duelShortNick(op.nick))}</em><b class="num" id="d2OpV"></b></span><span class="d2-av">${oppAv(op.nick)}</span><i class="d2-trk"><i id="d2OpB"></i></i></div>`;
    bar.setAttribute('aria-label', '대전 진행: 나와 ' + op.nick);
  } else if(D.ui === 'chips'){
    bar.innerHTML = `<div class="dchips" id="dChips">${D.pl.map(pid => duelChipHtml(D, D.P[pid])).join('')}</div>`;
    bar.setAttribute('aria-label', n + '명 대전 순위');
    bar.querySelectorAll('.dpchip').forEach(c => { c.onclick = () => duelChipName(c); });
  } else {
    const others = D.pl.filter(p => p !== D.myPid).slice(0, 4);
    bar.innerHTML = `<div class="dminis" id="dMinis">${others.map(pid => { const P = D.P[pid], s = DUEL_SEAT[duelViewSeat(D, P) % 5];
        return `<div class="dmini" data-pid="${pid}" style="--sc:${s.col}"><span class="dm-av">${oppAv(P.nick)}</span>${duelShapeSvg(s.shape, s.col, 12)}<div class="dm-board"></div><span class="dm-val num"></span></div>`; }).join('')}
      <span class="dm-rank num" id="dmRank">-</span></div>`;
    bar.setAttribute('aria-label', '상대 판 미리 보기');
  }
  Object.assign(D, { lastPub:0, pubSig:'', lead:null, pingAt:{}, pingOnce:{}, pingLast:0, pingPri:0, noteAt:{}, meLf:null });
  if(D.mode === 'pvp'){
    const me = G;
    try{ D.un = D.nr.onPeers(ch => { if(G !== me || !G.duel) return; duelRead(); }, () => { if(G === me && G.duel) duelMyNetLost(); }); }catch(_){}
  }
  if(D.kind === 'turn') duelTurnState();
  /* 시작 전: 판은 만들어 두되 멈춰 두고 가림 → 준비·카운트다운 */
  G.paused = true; G.pauseAt = G.start = Date.now(); G.pausedMs = 0;
  duelGoOpen();
  duelRender();
}
function duelChipHtml(D, P){
  const s = DUEL_SEAT[duelViewSeat(D, P) % 5];
  return `<button class="dpchip${P.me ? ' me' : ''}" data-pid="${P.pid}" style="--sc:${s.col}" aria-label="${P.me ? '나' : esc(P.nick)}">
    <span class="dc-rank num">1</span>${duelShapeSvg(s.shape, s.col, 14)}<span class="dc-av">${P.me ? avatar({ me:true }) : oppAv(P.nick)}</span>
    <span class="dc-val"></span><span class="dc-tag">차례</span><span class="dc-name">${P.me ? '나' : esc(P.nick)}</span></button>`;
}
function duelChipName(c){ c.classList.add('say'); clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('say'), 1500); }
/* 값 칸 문구(짧게): 7/9 · 2,940 · [128] · 4곳 · 3쌍 */
function duelValShort(id, s, D){
  const S = duelStatOf(id) || {}, unit = S.unit || '';
  if(D.kind === 'shared') return `${s.v || 0}<small>${unit || '개'}</small>`;
  if(D.kind === 'turn') return `${s.v || 0}<small>${unit}</small>`;
  if(S.score || D.kind === 'score') return `${fmt(s.v || 0)}`;
  if(S.tile) return `<span class="tile">${s.v || 2}</span>`;
  if(s.t == null) return `${Math.round((s.pg || 0) * 100)}<small>%</small>`;
  return `${s.v || 0}<small>/${s.t}</small>`;
}
function duelSubHtml(id, s, lostFlash){
  const S = duelStatOf(id) || {}; if(!S.lfMax || s.lf == null || s.dn || s.left) return '';
  if(S.lfMax === 3) return [0, 1, 2].map(i => `<i class="pip${i >= s.lf ? ' off' : ''}${lostFlash && i === s.lf ? ' lost' : ''}"></i>`).join('');
  if(S.lfIcon) return `${S.lfIcon()}${s.lf}`;
  return `${ic('heart')}${s.lf}`;
}
/* (옛 이름 유지) 값 칸 문구 */
function duelValHtml(id, s){ return G && G.duel && G.duel.v === 3 ? duelValShort(id, s, G.duel) : `${s.v || 0}`; }
function duelRender(){
  const D = G && G.duel; if(!D || D.fleet || D.v !== 3) return;
  const bar = $('#duelBar'); if(!bar || bar.hidden) return;
  const id = G.id, rk = duelRanks(), meSt = duelMeStat();
  const stOf = P => P.me ? meSt : P.st;
  if(D.ui === 'two'){
    const op = D.P[D.pl.find(p => p !== D.myPid)], os = Object.assign({}, op.st, { left:op.left && !op.st.dn });
    const pgOf = s => s.ok ? 1 : (s.t && s.v != null && !(duelStatOf(id) || {}).tile && D.kind !== 'score' ? Math.min(1, s.v / s.t) : (s.pg || 0));
    const w = x => (Math.max(0, Math.min(1, x || 0)) * 100).toFixed(1) + '%';
    const mv = $('#d2MeV'); if(!mv) return;
    mv.innerHTML = meSt.dn && meSt.ok ? '<span class="ck">✔</span>' + duelValShort(id, meSt, D) : duelValShort(id, meSt, D);
    $('#d2OpV').innerHTML = os.left ? '나감' : op.gone && !os.dn ? `끊김 ${Math.max(0, 15 - Math.floor((Date.now() - op.gone) / 1000))}` : (os.dn && os.ok ? '<span class="ck">✔</span>' : '') + duelValShort(id, os, D);
    $('#d2MeB').style.width = w(pgOf(meSt)); $('#d2OpB').style.width = w(pgOf(os));
    const meLost = D.meLf != null && meSt.lf != null && meSt.lf < D.meLf, opLost = D.oppLfShow != null && os.lf != null && os.lf < D.oppLfShow;
    $('#d2MeS').innerHTML = duelSubHtml(id, meSt, meLost); $('#d2OpS').innerHTML = duelSubHtml(id, os, opLost);
    D.meLf = meSt.lf; D.oppLfShow = os.lf;
    const lead = !D.go || elapsed() < 3 ? null : rk[D.myPid] < rk[op.pid] ? 'me' : rk[D.myPid] > rk[op.pid] ? 'op' : 'tie';
    const mid = $('#d2Mid');
    mid.className = 'd2-mid' + (lead ? ' ' + lead : ''); mid.textContent = lead === 'me' ? '◀' : lead === 'op' ? '▶' : lead === 'tie' ? '=' : 'VS';
    $('#d2Me').classList.toggle('lead', lead === 'me'); $('#d2Op').classList.toggle('lead', lead === 'op');
    $('#d2Op').classList.toggle('left', !!(os.left || op.gone));
    if(lead === 'me' || lead === 'op'){
      if(D.leadSide && D.leadSide !== lead && !meSt.dn && !os.dn) duelPing(lead === 'me' ? 'meLead' : 'oppLead', lead === 'me' ? '내가 앞섰어요!' : `${esc(op.nick)}님이 앞질렀어요`, lead === 'me' ? null : op);
      D.leadSide = lead;
    }
    return;
  }
  if(D.ui === 'chips'){
    const box = $('#dChips'); if(!box) return;
    const order = D.pl.slice().sort((a, b) => rk[a] - rk[b] || D.P[a].seat - D.P[b].seat);
    const narrow = (box.clientWidth || 358) < 352, step = narrow ? 65 : 73;
    box.style.width = (order.length * step - (narrow ? 5 : 7)) + 'px';
    const named = Date.now() - (D.t3 || Date.now()) < 3000 || !D.go;
    const T = D.kind === 'turn' && D.turn ? D.turn : null;
    order.forEach((pid, i) => {
      const P = D.P[pid], s = stOf(P), c = box.querySelector(`.dpchip[data-pid="${pid}"]`); if(!c) return;
      c.style.transform = `translateX(${i * step}px)`;
      c.querySelector('.dc-rank').textContent = rk[pid];
      const gone = P.gone && !s.dn, left = P.left && !s.dn;
      c.querySelector('.dc-val').innerHTML = left ? '나감' : gone ? `끊김 ${Math.max(0, 15 - Math.floor((Date.now() - P.gone) / 1000))}` : named ? `<em>${P.me ? '나' : esc(duelShortNick(P.nick))}</em>` : duelValShort(id, s, D) + (s.dn && D.kind === 'score' ? '<i class="ck">✓</i>' : '');
      c.classList.toggle('first', rk[pid] === 1 && D.go); c.classList.toggle('done', !!(s.dn && D.kind === 'score'));
      c.classList.toggle('gone', !!gone); c.classList.toggle('left', !!left);
      c.classList.toggle('turn', !!(T && T.pid === pid));
    });
    return;
  }
  /* 미니 화면 */
  const box = $('#dMinis'); if(!box) return;
  const mini = duelNG(id).duelMini;
  box.querySelectorAll('.dmini').forEach(c => {
    const P = D.P[c.dataset.pid]; if(!P) return; const s = P.st;
    c.querySelector('.dm-val').innerHTML = P.left && !s.dn ? '나감' : duelValShort(id, s, D);
    c.classList.toggle('left', !!(P.left || P.gone)); c.classList.toggle('first', rk[P.pid] === 1 && D.go);
    const b = c.querySelector('.dm-board');
    if(b._s !== P.mv){ b._s = P.mv; try{ mini.draw(b, P.mv || '', duelPub3(D, P, rk)); }catch(_){} }
  });
  const r = $('#dmRank'); if(r){ r.textContent = D.go ? rk[D.myPid] + '위' : '-'; r.classList.toggle('first', rk[D.myPid] === 1 && D.go); }
}

/* ---- 큰 알림(docs/21 3-12): 화면 위 30%, 1.2초, 같은 사람 3초에 1번, 판을 가리지 않게 반투명 ---- */
function duelNotify(text, o = {}){
  try{
    const D = G && G.duel; if(!D) return;
    const now = Date.now(), from = o.from || null, key = from ? from.pid : '_';
    D.noteAt = D.noteAt || {};
    if(!o.force && from && now - (D.noteAt[key] || 0) < 3000) return;
    D.noteAt[key] = now;
    let el = $('#dNote');
    if(!el){ el = document.createElement('div'); el.id = 'dNote'; el.className = 'dnote'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    const P = from && D.P ? D.P[from.pid] : null, s = P ? DUEL_SEAT[duelViewSeat(D, P) % 5] : DUEL_SEAT[0];
    el.style.setProperty('--sc', s.col);
    el.className = 'dnote ' + (o.kind || 'info');
    el.innerHTML = `${from ? (from.me ? avatar({ me:true }) : oppAv(from.nick)) : ''}${from ? duelShapeSvg(s.shape, s.col, 14) : ''}<span>${text}</span>`;
    void el.offsetWidth; el.classList.add('on');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), o.ms || 1200);
  }catch(_){}
}
/* 상황별 알림(우선순위·같은 알림 간격) → 큰 알림으로 보여 줌 */
const DPING = {
  oppDone: { pri:5, kind:'end',  sfx:'flHorn', buzz:[30, 40, 30] },
  oppFail: { pri:5, kind:'gray', sfx:'toggle' },
  oppLeft: { pri:5, kind:'gray', sfx:'toggle' },
  oppNet:  { pri:5, kind:'gray', sfx:'toggle' },
  meNet:   { pri:5, kind:'gray', sfx:'toggle', ms:2400 },
  oppBack: { pri:5, kind:'good', sfx:'toast' },
  meLead:  { pri:4, kind:'good', sfx:'star', same:12000 },
  oppLead: { pri:4, kind:'bad',  sfx:'starOff', buzz:20, same:12000 },
  oppHot:  { pri:3, kind:'hot',  sfx:'flPing', once:true },
  last10:  { pri:3, kind:'hot',  sfx:'flPing', once:true },
  oppStep: { pri:2, kind:'info' },
  oppMiss: { pri:2, kind:'info', sfx:'toast', same:15000 },
  oppHit:  { pri:2, kind:'info', sfx:'toast', same:15000 }
};
function duelPing(kind, text, from){
  const D = G && G.duel, P = DPING[kind]; if(!D || !P) return;
  const now = Date.now();
  D.pingAt = D.pingAt || {}; D.pingOnce = D.pingOnce || {};
  if(P.once && D.pingOnce[kind + (from ? from.pid : '')]) return;
  if(P.same && now - (D.pingAt[kind] || 0) < P.same) return;
  if(P.pri < 5 && (!D.go || elapsed() < 3)) return;
  if(P.pri < 5 && now - (D.pingLast || 0) < 1300 && (D.pingPri || 0) > P.pri) return;
  D.pingAt[kind] = D.pingLast = now; D.pingPri = P.pri; D.pingOnce[kind + (from ? from.pid : '')] = 1;
  duelNotify(text, { from:from || (kind === 'meLead' ? { pid:D.myPid, me:true } : null), kind:P.kind, force:P.pri >= 4, ms:P.ms });
  try{ if(P.sfx) sfx(P.sfx, P.sfx === 'star' ? { i:1 } : P.sfx === 'toggle' ? { on:false } : {}); if(P.buzz) fxBuzz(P.buzz); }catch(_){}
}
/* 상대가 하나 찾음(경주): "판다 · 5/9". 5명 대전은 1위가 바뀔 때와 마무리 때만 */
function duelOppStep(D, P, prev){
  if(G.over || D.kind !== 'race') return;
  const s = P.st, S = duelStatOf(G.id) || {};
  if(S.score || S.tile) return;
  const n = D.pl.length, rk = duelRanks();
  const near = s.t != null && s.v >= s.t - 1;
  if(n >= 5){ const lead = D.pl.find(pid => rk[pid] === 1); if(lead === D.lastLead && !near) return; D.lastLead = lead; }
  if(near) duelPing('oppHot', `${esc(P.nick)}님이 마무리 중이에요!`, P);
  else if(s.t != null) duelNotify(`${esc(P.nick)} · ${s.v}/${s.t}`, { from:P, kind:'info' });
}

/* ---- 대전 중 멈춤 없음 ---- */
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
    <ol class="dg-rules">${HELP[id].map((r, i) => `<li><span class="hn" style="background:${GAME_META[id].col}">${i + 1}</span><span><b style="font-weight:400">${r[0]}</b><br><small style="font-family:var(--font);font-size:13px;color:var(--sub)">${r[1]}</small></span></li>`).join('')}</ol>
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

/* ======================================================================
   (6) 소식 주고받기 · 판정
   ====================================================================== */
/* 다른 사람들의 presence 읽기 */
function duelRead(){
  const D = G && G.duel; if(!D || D.v !== 3 || D.mode !== 'pvp' || !D.nr) return;
  let ps = []; try{ ps = D.nr.peers(); }catch(_){ return; }
  const seen = {}; let dirty = false;
  for(const p of ps){
    if(p.sameTab) continue;
    const q = p.presence || {}, pid = q.pid || ('p:' + p.peer), P = D.P[pid];
    if(!P || P.me) continue;
    seen[pid] = 1; P.peer = p.peer;
    if(P.gone && !P.left){ P.gone = 0; if(!G.over) duelPing('oppBack', `${esc(P.nick)}님이 다시 연결됐어요`, P); }
    if(D.startAt == null && typeof q.go === 'number' && (q.r == null || q.r === D.r)) D.startAt = duelLocalStart(q.go);
    if(q.rr != null && q.rr !== D.r) continue;   /* 지난 판 값 */
    const sig = JSON.stringify(q); if(sig !== P.sig){ P.sig = sig; P.msgAt = Date.now(); }
    if(q.q && !q.dn && !P.st.dn){ duelLeft(D, P); continue; }
    if(!D.go) continue;
    const st = P.st, prevV = st.v != null ? st.v : 0, prevLf = st.lf;
    if(typeof q.pg === 'number') st.pg = Math.max(st.pg || 0, Math.min(1, q.pg));
    for(const k of D.kind === 'shared' ? ['t', 'lf', 'mis', 'sc', 'ft'] : ['v', 't', 'lf', 'mis', 'la', 'sc', 'ft']) if(typeof q[k] === 'number') st[k] = q[k];
    if(q.ok) st.ok = 1;
    if(D.kind === 'shared' && q.cl && typeof q.cl === 'object'){ const s2 = JSON.stringify(q.cl); if(s2 !== P.clSig){ P.clSig = s2; P.cl = Object.assign({}, q.cl); dirty = true; } }
    if(typeof q.mv === 'string') P.mv = q.mv.slice(0, 400);
    duelEvRead(D, P, q.ev);
    if(!G.over && !st.dn){
      if(D.kind === 'race' && typeof st.v === 'number' && st.v > prevV) duelOppStep(D, P, prevV);
      const S = duelStatOf(G.id) || {};
      if(S.lfMax === 3 && prevLf != null && st.lf < prevLf && st.lf > 0) duelPing('oppMiss', `${esc(P.nick)}님이 한 번 틀렸어요`, P);
    }
    if(q.dn && !st.dn){ st.dn = 1; st.ge = q.ge ? 1 : 0; if(!q.ok) st.ok = 0; duelOnDone(D, P); }
  }
  if(dirty) duelClaimsRecalc(D);
  for(const pid of D.pl){ const P = D.P[pid]; if(P.me || P.ai || P.left || P.st.dn) continue; if(!seen[pid] && !P.gone){ P.gone = Date.now(); if(!G.over) duelPing('oppNet', `${esc(P.nick)}님 연결이 끊겼어요 · 15초 기다려요`, P); } }
  if(D.kind === 'turn' && D.turn) duelTurnDrain(D);
  duelSyncOpp(D);
}
/* 예전 이름(1:1 게임이 G.duel.opp·oppPeer를 읽음): 첫 상대 값 맞추기 */
function duelSyncOpp(D){
  const P = D.P[D.pl.find(p => p !== D.myPid)]; if(!P) return;
  D.opp.nick = P.nick; D.opp.pg = P.st.pg || 0; D.opp.dn = P.st.dn ? 1 : 0; D.opp.sc = P.st.sc || 0;
  if(P.peer) D.oppPeer = P.peer; D.oppLeft = !!P.left; D.oppStat = P.st;
}
/* 다른 사람이 끝남 */
function duelOnDone(D, P){
  if(!G.over){
    if(P.st.ok && D.end === 'first') duelPing('oppDone', `${esc(P.nick)}님이 다 풀었어요!`, P);
    else if(!P.st.ok && D.kind === 'race') duelPing('oppFail', `${esc(P.nick)}님이 멈췄어요 · ${duelRowTxt(D, P.st, false)}`, P);
  } else try{ sfx(P.st.ok ? 'flPing' : 'toggle'); }catch(_){}
  duelJudge(D);
  duelRender();
}
function duelLeft(D, P){
  if(P.left) return;
  P.left = true; P.gone = 0;
  if(!G.over) duelPing('oppLeft', `${esc(P.nick)}님이 나갔어요`, P);
  if(D.kind === 'turn' && D.turn && D.turn.pid === P.pid) duelTurnTick(D);
  duelSyncOpp(D);
  duelJudge(D);
  duelRender();
}
/* 끝나는 규칙(대표 의견 1): 경주는 누가 다 풀면 0.7초 뒤 모두 끝. 혼자 남았는데 이미 1위면 끝. 점수는 모두 끝나거나 시간. 선점·차례는 게임이 */
function duelJudge(D){
  if(!D.go) return;
  const others = D.pl.filter(p => p !== D.myPid).map(p => D.P[p]);
  if(G.over){ if(D.fin && !D.resolved && others.every(P => P.st.dn || P.left || P.ai)) duelResolveSoon(D); return; }
  if(D.end === 'first'){ const f = others.find(P => P.st.dn && P.st.ok); if(f){ if(!D.endBy) D.endBy = { k:'first', pid:f.pid }; duelCutSoon('done', typeof f.st.ft === 'number' ? f.st.ft + 700 : null); return; } }
  if(D.end === 'game'){ const f = others.find(P => P.st.dn && P.st.ge); if(f){ if(!D.endBy) D.endBy = { k:'game' }; duelCutSoon('game'); return; } }
  const active = others.filter(P => !P.left && !P.st.dn);
  if(active.length) return;
  if(others.every(P => P.left && !P.st.dn)){ if(!D.endBy) D.endBy = { k:'left' }; duelCutSoon('left'); return; }
  if(D.end === 'first' || (D.end === 'game' && D.kind === 'shared')){
    const rk = duelRanks();
    if(rk[D.myPid] === 1 && !duelTieAt(rk, D.myPid)){ if(!D.endBy) D.endBy = { k:'ahead' }; duelCutSoon('ahead'); }
  }
}
/* 한쪽이 끝나면(다 풂·나감) 다른 쪽 판도 끝난다. 끝난 쪽은 결과 뒤 '계속 풀기'로 혼자 이어 풀 수 있다(기록 안 됨) */
/* atSrv(서버 ms)를 주면 그 시각에 끝냄 → 소식이 늦게 와도 모두 같은 순간(다 푼 시각 + 0.7초)에 끝남 */
function duelCutSoon(why, atSrv){
  const D = G && G.duel, me = G; if(!D || D.fleet || G.over || D.cutT) return;
  D.cutStat = duelStatNow();   /* 알림을 보여 주는 동안에도 값이 바뀌지 않게 지금 값을 먼저 저장 */
  const ms = typeof atSrv === 'number' ? Math.max(150, Math.min(700, atSrv - duelSrv())) : 700;
  D.cutT = setTimeout(() => { if(G === me && !G.over && G.duel === D) duelCut(why); }, ms);
}
function duelCut(why){
  const D = G && G.duel; if(!D || D.fleet || G.over) return;
  if(D.v === 3){ try{ const s = duelStatNow(); D.cutStat = !D.cutStat || (s.v || 0) >= (D.cutStat.v || 0) ? s : D.cutStat; }catch(_){} }   /* 잘리기 직전 값(0% 버그) */
  D.cut = why; D.cutSec = elapsed();
  finish(false);
}
function duelCanContinue(){
  const D = G && G.duel;
  return !!(D && !D.fleet && D.cut && D.cut !== 'game' && G.over && !(D.fin ? D.fin.ok : D.me && D.me.sc) && NG[G.id] && NG[G.id].render);
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
/* 내 연결이 20초 넘게 끊김: 결과를 주고받을 수 없어서 무승부로 처리 */
function duelMyNetLost(){
  const D = G && G.duel; if(!D || D.netLost || D.resolved) return;
  D.netLost = true;
  if(!G.over) duelPing('meNet', '연결이 끊겼어요 · 이번 판은 무승부로 처리돼요');
  if(G.over && D.fin) duelResolve();
}
/* 연결 상태 점검(게임 중·대기 창 모두): 끊긴 사람 15초 유예, 내 연결 끊김/복구 알림 */
function duelNetCheck(){
  const D = G && G.duel; if(!D || D.v !== 3 || D.mode !== 'pvp') return;
  for(const pid of D.pl){ const P = D.P[pid]; if(P.gone && !P.left && !P.st.dn && Date.now() - P.gone > 15000) duelLeft(D, P); }
  if(!D.netLost && D.go){
    const up = typeof netUp === 'function' ? netUp() : true;
    if(!up && !D.netDown){ D.netDown = Date.now(); if(!G.over) duelPing('meNet', '연결이 끊겼어요 · 다시 연결하는 중…'); }
    else if(up && D.netDown){ D.netDown = 0; if(!G.over) duelPing('oppBack', '다시 연결됐어요'); duelPub(true); }
  }
}
/* 내 진행 보내기: 0.8초마다, 급할 때(기회 잃음·끝남·사건·선점) 바로(최소 0.15초 간격) */
function duelPub(force){
  const D = G && G.duel; if(!D || D.v !== 3 || D.mode !== 'pvp' || !D.nr || !D.go) return;
  const s = G.over && D.fin ? D.fin : duelStatNow(), now = Date.now();
  const o = Object.assign({ pid:D.myPid, nk:D.myNick, rr:D.r }, s);
  if(D.evLog) o.ev = D.evLog;
  if(D.kind === 'shared') o.cl = D.P[D.myPid].cl;
  const mini = duelNG(G.id).duelMini;
  if(mini && !G.over && now - (D.mvAt || 0) > 700){ try{ const m = mini.get(); if(typeof m === 'string'){ D.mv = m.slice(0, 400); D.mvAt = now; } }catch(_){} }
  if(D.mv != null) o.mv = D.mv;
  const sig = JSON.stringify(o), urgent = D.urgent || (D.meStatLf != null && s.lf != null && s.lf < D.meStatLf);
  if(!force && sig === D.pubSig && now - D.lastPub < 5000) return;
  if(!force && !(urgent && now - D.lastPub > 150) && now - D.lastPub < 800) return;
  D.lastPub = now; D.pubSig = sig; D.meStatLf = s.lf; D.urgent = false;
  try{ D.nr.presence(Object.assign({ hb:(D.hb = (D.hb || 0) + 1) }, o)).catch(() => {}); }catch(_){}
}
function duelTick(){
  const D = G && G.duel; if(!D || D.fleet) return;
  if(D.v !== 3) return;
  if(!D.go){ duelRender(); return; }
  if(D.mode === 'ai' && !G.over) duelAiTick(D);
  if(D.mode === 'pvp'){ duelRead(); duelNetCheck(); if(!G.over) duelPub(false); }
  duelTurnTick(D);
  if(!G.over){
    duelJudge(D);
    const S = duelStatOf(G.id) || {}, st = duelStatNow();
    if(S.score && G.mt && G.mt.E && G.mt.E.movesLeft != null && G.mt.E.movesLeft <= 3){ const o = D.P[D.pl.find(p => p !== D.myPid)]; duelPing('last10', `마지막 3번 · ${esc(o.nick)} ${fmt(o.st.v || 0)}점`); }
    if(st && D.mode === 'ai' && D.P.ai && !D.P.ai.st.dn && D.kind === 'race' && D.P.ai.st.t != null && D.P.ai.st.v >= D.P.ai.st.t - 1) duelPing('oppHot', `${esc(D.P.ai.nick)}님이 마무리 중이에요!`, D.P.ai);
  }
  duelRender();
}

/* ---- 먼저 끝냈을 때 대기 창(아직 하는 사람이 있을 때) ---- */
function duelWaitModal(){
  const D = G.duel, me = D.fin;
  openModal(`<div class="dsearch dwait"><p class="kick">대전</p><h3>${me.ok ? '다 풀었어요!' : '이번 판은 여기까지'}</h3>
    <div class="dw-me">${avatar({ me:true })}<div><small>내 기록 · 확정</small><br><b class="num">${duelRowTxt(D, me, true)}</b></div></div>
    <div class="dw-list" id="dwList"></div>
    <p class="dw-need">${D.kind === 'race' ? '아직 푸는 사람이 있어요 · 끝나면 바로 순위가 나와요' : '모두 끝나면 점수로 순위를 매겨요'}</p>
    ${G.limit && D.mode === 'pvp' ? `<span class="dw-eta">${ic('clock')}늦어도 <b class="num" id="dwEta">${mmss(Math.max(0, G.limit - elapsed()))}</b> 뒤엔 결과가 나와요</span>` : ''}
    <p class="dw-quiet" id="dwTxt">창을 닫지 말고 기다려 주세요</p></div>`);
  $('#modal').classList.add('duelm');
  duelWaitText();
}
function duelWaitText(){
  const D = G.duel, l = $('#dwList'), e = $('#dwEta');
  if(l) l.innerHTML = D.pl.filter(p => p !== D.myPid).map(pid => { const P = D.P[pid], s = P.st;
    return `<div class="dw-op">${oppAv(P.nick)}<div><b>${esc(P.nick)}${P.ai ? ' <em class="aitag">컴퓨터</em>' : ''}</b><span class="dw-stat">${P.left && !s.dn ? '나갔어요' : s.dn ? '끝냈어요 · ' + duelRowTxt(D, s, false) : '아직 하는 중 · ' + duelRowTxt(D, s, false)}</span></div></div>`; }).join('');
  if(e) e.textContent = mmss(Math.max(0, G.limit - elapsed()));
}

/* ======================================================================
   (7) 대전 끝 · 결과(HOST.duelResult(r, a, b, res))
   ====================================================================== */
function duelFinish(win){
  const D = G.duel, id = G.id;
  if(D.fleet){ duelResult(D.r || (win ? 'w' : 'l'), D.a || null, D.b || null); return; }   /* 대전을 직접 진행하는 게임은 D.r(무승부 'd' 포함)·D.a·D.b를 정해 둘 수 있음 */
  /* 끝난 순간의 값: 잘렸으면 잘리기 직전 값, 아니면 지금 값(게임이 판을 정리해 0이 되었으면 마지막으로 본 값) */
  let s = D.cutStat || null;
  if(!s){ try{ s = duelStatNow(); }catch(_){ s = {}; } }
  if(!win && D.lastGood && (s.v == null ? (s.pg || 0) < (D.lastGood.pg || 0) : s.v < (D.lastGood.v || 0))) s = Object.assign({}, D.lastGood);
  const sc = win ? calcScore().score : 0;
  D.fin = Object.assign({}, s, { dn:1, ok:win ? 1 : 0, sc, ft:win ? Math.round(duelSrv()) : null, ge:D.ge ? 1 : 0 });
  if(win){ D.fin.pg = 1; if(D.fin.t != null && D.kind === 'race' && !(duelStatOf(id) || {}).tile && !(duelStatOf(id) || {}).score) D.fin.v = D.fin.t; }
  if(D.fin.ft == null) delete D.fin.ft;
  D.meStat = D.fin; D.me = { sc, pg:D.fin.pg };
  if(win && !D.endBy) D.endBy = D.end === 'first' ? { k:'first', pid:D.myPid } : { k:'me' };
  if(!win && !D.endBy && G.limit && elapsed() >= G.limit - .5) D.endBy = { k:'time' };
  duelSeenPush(id);
  duelRender();
  if(D.mode === 'pvp'){
    D.urgent = true; duelPub(true);
    duelRead();
    const me = G, t0 = Date.now();
    const done = () => D.pl.every(pid => pid === D.myPid || D.P[pid].st.dn || D.P[pid].left) || D.netLost;
    if(done()){ duelResolveSoon(D, win ? 700 : 400); return; }
    D.waitShowT = setTimeout(() => { if(G === me && !D.resolved && !done()) duelWaitModal(); }, D.cut ? 1500 : 900);
    D.waitIv = setInterval(() => {
      if(G !== me){ clearInterval(D.waitIv); return; }
      duelRead(); duelNetCheck(); duelPub(false); duelWaitText(); duelRender();
      if(done()){ clearInterval(D.waitIv); duelResolve(); }
      else if(Date.now() - t0 > 240000){ clearInterval(D.waitIv); D.pl.forEach(pid => { const P = D.P[pid]; if(!P.me && !P.st.dn) P.left = true; }); duelResolve(); }
    }, 400);
    return;
  }
  /* 컴퓨터: 내가 끝나면 컴퓨터 판도 그 자리에서 끝 */
  const A = D.P.ai;
  if(A && !A.st.dn){ try{ duelAiTick(D); }catch(_){} if(!A.st.dn){ A.st.dn = 1; A.st.ok = 0; A.st.sc = 0; A.cut = true; } }
  duelSyncOpp(D);
  duelRender();
  duelResolveSoon(D, win ? 700 : 400);
}
function duelResolveSoon(D, ms){ if(D.resolveT || D.resolved) return; const g = G; D.resolveT = setTimeout(() => { if(G === g) duelResolve(); }, ms || 300); }
/* 결과 한 줄: "9개 중 7개 · 실수 1번", 1위 "다 풀었어요 · 1:42", 점수 "2,940점", 선점 "4곳 차지" */
function duelRowTxt(D, s, withMis){
  const S = duelStatOf(G.id) || {}, unit = S.unit || '개', mis = withMis && s.mis ? ` · 실수 ${s.mis}번` : '';
  if(D.kind === 'shared') return `${s.v || 0}${unit} 차지${mis}`;
  if(D.kind === 'score' || S.score) return `${fmt(s.v || 0)}점${mis}`;
  if(D.kind === 'turn') return `${s.v || 0}${unit}${mis}`;
  if(s.ok){ const tm = typeof s.ft === 'number' && D.goSrv ? ' · ' + mmss((s.ft - D.goSrv) / 1000) : ''; return '다 풀었어요' + tm; }
  if(S.tile) return `최고 ${s.v || 2} · 목표 ${s.t || ''}${mis}`;
  if(s.t != null) return `${s.t}${unit} 중 ${s.v || 0}${unit}${mis}`;
  const p = Math.round((s.pg || 0) * 100);
  return (p ? `${p}% 했어요` : '아직 시작 전이었어요') + mis;
}
function duelWhyV3(D, rk){
  if(D.why) return D.why;
  if(D.netLost && D.pl.some(pid => pid !== D.myPid && !D.P[pid].st.dn && !D.P[pid].left)) return '연결이 끊겨서 무승부로 처리했어요';
  const E = D.endBy || {}, n = D.pl.length, op = D.P[D.pl.find(p => p !== D.myPid)];
  const nm = pid => pid === D.myPid ? '내가' : esc(D.P[pid].nick) + '님이';
  if(D.kind === 'race'){
    const okp = D.pl.filter(pid => (pid === D.myPid ? D.fin : D.P[pid].st).ok).sort((a, b) => rk[a] - rk[b]);
    if(okp.length) return `${nm(okp[0])} 먼저 다 풀어서 끝났어요`;
  }
  if(E.k === 'left') return n > 2 ? '다른 사람이 모두 나가서 끝났어요' : '상대가 나가서 기권승이에요';
  if(E.k === 'ahead') return n > 2 ? '다른 사람이 모두 멈춰서, 내가 앞선 채로 끝났어요' : `${esc(op.nick)}님이 멈춰서, 내가 앞선 채로 끝났어요`;
  if(E.k === 'game') return D.endWhy || '판이 끝났어요';
  if(E.k === 'time') return '시간이 다 돼서 그때 기록으로 순위를 매겼어요';
  if(D.kind === 'score') return '모두 끝나서 점수로 순위를 매겼어요';
  if(D.kind !== 'race') return D.endWhy || '판이 끝났어요';
  return '모두 멈춰서 푼 만큼 순위를 매겼어요';
}
function duelResolve(){
  const D = G && G.duel; if(!D || D.resolved) return;
  clearInterval(D.waitIv); clearTimeout(D.waitShowT); clearTimeout(D.resolveT);
  duelSyncOpp(D);
  const rk = duelRanks(), myR = rk[D.myPid], tie = duelTieAt(rk, D.myPid), n = D.pl.length;
  let r = myR === 1 ? (tie ? 'd' : 'w') : 'l';
  const lostNet = D.netLost && D.pl.some(pid => pid !== D.myPid && !D.P[pid].st.dn && !D.P[pid].left);
  if(lostNet) r = 'd';
  const rows = D.pl.map(pid => { const P = D.P[pid], s = duelStOf(D, P), vs = DUEL_SEAT[duelViewSeat(D, P) % 5];
    return { pid, nick:P.me ? D.myNick : P.nick, me:P.me, ai:P.ai, col:vs.col, shape:vs.shape, rank:rk[pid], ok:!!s.ok, v:s.v, t:s.t, mis:s.mis || 0, sc:s.sc || 0, ft:s.ft || null, left:!!(P.left && !s.dn),
      txt:P.left && !s.dn ? '나감' : duelRowTxt(D, s, true) }; }).sort((a, b) => a.rank - b.rank);
  /* 같은 방 판 기록(1위 수) */
  if(D.R){ const ser = DUEL_SERIES[D.R] = DUEL_SERIES[D.R] || {}; const w = D.pl.filter(pid => rk[pid] === 1); if(w.length === 1) ser[w[0]] = (ser[w[0]] || 0) + 1; }
  const canAgain = D.mode === 'pvp' && D.quick && !lostNet && D.pl.some(pid => pid !== D.myPid && !D.P[pid].left);
  D.res = { kind:D.kind, n, ai:D.mode === 'ai', pace:D.pace, rank:myR, tie, rows, why:lostNet ? '연결이 끊겨서 무승부로 처리했어요' : duelWhyV3(D, rk),
    round:duelRound(), room:{ code:D.room && D.room.id != null ? D.room.id : null, canAgain }, seed:D.seed, cfg:D.cfg || (G.L ? G.L[G.id] : null) };
  const op = D.P[D.pl.find(p => p !== D.myPid)] || { st:{} };
  const top = n > 2 ? D.P[rows.find(x => !x.me).pid] : op;
  const a = { sc:D.fin.sc, pg:D.fin.pg, rank:myR, txt:duelRowTxt(D, D.fin, true) }, b = { sc:top.st.sc || 0, pg:top.st.pg || 0, dn:top.st.dn ? 1 : 0, rank:rk[top.pid], txt:duelRowTxt(D, top.st, true) };
  if(canAgain) duelAgainKeep(D);
  duelResult(r, a, b, D.res);
}
/* 결과: 보여 주기는 HOST(사이트는 대전 포인트, 모듈은 이벤트). res는 4번째 인자로 더함(docs/21 3-11) */
function duelResult(r, a, b, res){
  const D = G.duel; if(D.resolved) return; D.resolved = true;
  duelNetClose();
  HOST.duelResult(r, a, b, res || null);
}
/* 결과 창 공통 조각: 2명은 양쪽 얼굴·기록·순위, 3명 이상은 순위 목록 */
function duelSidesHtml(r, a, b){
  const D = G.duel;
  if(D.v === 3 && D.res){
    const R = D.res;
    if(R.n > 2) return `<ol class="dres-list">${R.rows.map(x => `<li class="${x.me ? 'me' : ''}${x.rank === 1 ? ' win' : ''}${x.left ? ' left' : ''}" style="--sc:${x.col}"><span class="dl-rank num">${x.rank}위</span>${x.me ? avatar({ me:true }) : oppAv(x.nick)}${duelShapeSvg(x.shape, x.col, 14)}<b>${x.me ? '나' : esc(x.nick)}${x.ai ? ' <em class="aitag">컴퓨터</em>' : ''}</b><span class="dl-txt">${esc(x.txt)}</span></li>`).join('')}</ol>`;
    const me = R.rows.find(x => x.me), op = R.rows.find(x => !x.me);
    const side = x => `<div class="dr-side${x.rank === 1 && !R.tie ? ' win' : ''}">${x.rank === 1 && !R.tie ? '<span class="crown">👑</span>' : ''}${x.me ? avatar({ me:true }) : oppAv(x.nick)}<b>${x.me ? '나' : esc(x.nick)}${x.ai ? ' <em class="aitag">컴퓨터</em>' : ''}</b><span class="num drank">${x.rank}위</span><small>${esc(x.txt)}</small></div>`;
    return `<div class="dres">${side(me)}<div class="dr-vs">VS</div>${side(op)}</div>`;
  }
  const nick = D.opp ? D.opp.nick : '상대';
  const side = (me, sc, won) => `<div class="dr-side${won ? ' win' : ''}">${won ? '<span class="crown">👑</span>' : ''}${me ? avatar({ me:true }) : oppAv(nick)}<b>${me ? '나' : esc(nick)}</b>${sc == null ? '' : `<span class="num">${sc ? fmt(sc) + '점' : '멈춤'}</span>`}</div>`;
  return `<div class="dres">${side(true, a ? a.sc : null, r === 'w')}<div class="dr-vs">VS</div>${side(false, b ? b.sc : null, r === 'l')}</div>`;
}
function duelWhy(r, a, b){
  const D = G.duel, win = r === 'w';
  if(D.why) return D.why;   /* 게임이 정한 판정 이유 */
  if(D.v === 3 && D.res) return D.res.why;
  return D.fleet ? (win ? (G.forfeit ? '상대가 떠나 기권승이에요' : '적 함대를 모두 격침했어요') : '우리 함대가 먼저 침몰했어요') : '';
}

/* ---- 같은 방 한 판 더(빠른 대전, docs/21 10-2): 결과 뒤 30초 동안 방을 열어 두고 2명 이상 누르면 누른 사람끼리 3초 뒤 새 판 ---- */
let DA = null;
function duelAgainKeep(D){
  duelAgainStop();
  const id = G.id;
  DA = { id, nr:D.nr, R:D.R, r:D.r, pl:D.pl.slice(), nick:{}, myPid:D.myPid, myNick:D.myNick, pace:D.pace, until:Date.now() + 30000, want:false, twoAt:0, sent:false };
  D.pl.forEach(pid => { DA.nick[pid] = D.P[pid].nick; });
  D.nr = null;   /* 결과 처리(duelNetClose)가 방을 닫지 않게 */
  DA.iv = setInterval(duelAgainCheck, 300);
}
function duelAgainStop(){ if(!DA) return; clearInterval(DA.iv); const nr = DA.nr; DA = null; if(nr) try{ nr.presence({ ag:null }).catch(() => {}); nr.leave(); }catch(_){} }
/* 결과 창 버튼이 부름(사이트·모듈). 하트 판단은 HOST.canDuel({ again, room }) */
function duelAgain(){
  if(!DA || Date.now() > DA.until) return false;
  try{ if(HOST.canDuel({ again:true, room:DA.R }) === false) return false; }catch(_){}
  DA.want = true; DA.until = Math.max(DA.until, Date.now() + 10000);
  try{ DA.nr.presence({ ag:DA.r + 1, pid:DA.myPid }).catch(() => {}); }catch(_){}
  return true;
}
/* 지금 한 판 더 상태(결과 창 표시용): { on, want, n:누른 사람 수, left:남은 초 } */
function duelAgainState(){
  if(!DA) return { on:false };
  let n = 0; try{ n = DA.nr.peers().filter(p => p.presence && p.presence.ag === DA.r + 1).length; }catch(_){}
  return { on:true, want:DA.want, n, left:Math.max(0, Math.ceil((DA.until - Date.now()) / 1000)) };
}
function duelAgainCheck(){
  const A = DA; if(!A) return;
  if(Date.now() > A.until && !A.sent){ duelAgainStop(); return; }
  let ps = []; try{ ps = A.nr.peers(); }catch(_){ return; }
  const nx = A.r + 1;
  /* 방장이 새 판 시작 정보를 보냈으면 */
  const h = ps.find(p => !p.sameTab && p.presence && p.presence.r === nx && typeof p.presence.go === 'number' && Array.isArray(p.presence.pl));
  if(h){
    if(A.want && h.presence.pl.includes(A.myPid)) duelAgainLaunch(A, h.presence, ps);
    return;
  }
  if(!A.want) return;
  const agree = A.pl.filter(pid => pid === A.myPid ? true : ps.some(p => !p.sameTab && p.presence && p.presence.pid === pid && p.presence.ag === nx));
  if(agree.length < 2){ A.twoAt = 0; return; }
  if(!A.twoAt) A.twoAt = Date.now();
  if(agree[0] !== A.myPid || A.sent) return;   /* 방장 = 누른 사람 중 pl 순서가 가장 앞 */
  const alive = A.pl.filter(pid => pid === A.myPid || ps.some(p => p.presence && p.presence.pid === pid));
  if(agree.length < alive.length && Date.now() - A.twoAt < 3000) return;   /* 남은 모두가 누르면 바로, 아니면 3초 기다림 */
  A.sent = true;
  const info = { go:netNow() + 3000, pl:agree, sd:duelSdNew(), r:nx, cf:{ dk:A.pace, av:duelSeenGet(A.id), n:agree.length } };
  try{ A.nr.presence(info).catch(() => {}); }catch(_){}
  duelAgainLaunch(A, info, ps);
}
function duelAgainLaunch(A, h, ps){
  clearInterval(A.iv); DA = null;
  const pl = h.pl.map(pid => ({ pid, nick:pid === A.myPid ? A.myNick : (A.nick[pid] || '상대') }));
  const duel = duelMake({ id:A.id, mode:'pvp', R:A.R, r:h.r, sd:h.sd, nr:A.nr, pl, myPid:A.myPid, myNick:A.myNick, go:h.go, pace:A.pace, avoid:(h.cf && h.cf.av) || [], quick:true });
  try{ A.nr.presence({ pid:A.myPid, nk:A.myNick, rr:h.r, ag:null, dn:0, ok:0, sc:0, pg:0, v:null, mis:0, la:null, ft:null, ge:0, q:0, ev:[], cl:{}, mv:null }).catch(() => {}); }catch(_){}
  closeModal(); leavePlayKeep(); startGame(A.id, 'normal', { duel });
}
/* 한 판 더: 지난 판 화면만 정리(방은 그대로) */
function leavePlayKeep(){ try{ if(G && G.cleanup){ G.cleanup(); G.cleanup = null; } }catch(_){} if(G && G.duel) clearTimeout(G.duel.cutT); }

function duelNetClose(){
  const D = G && G.duel; if(!D) return;
  clearInterval(D.waitIv); clearTimeout(D.waitShowT); if(D.un) try{ D.un(); }catch(_){} D.un = null;
  if(D.nr){ const nr = D.nr; D.nr = null; if(!D.resolved && !D.fin) try{ nr.presence({ q:1, rr:D.r }).catch(() => {}); }catch(_){} setTimeout(() => { try{ nr.leave(); }catch(_){} }, 1500); }
}
function duelClose(){
  duelSearchStop();
  duelAgainStop();
  if(G && G.duel) clearTimeout(G.duel.cutT);
  if(G && G.duel) duelNetClose();
  duelBarRestore();
  const bar = $('#duelBar'); if(bar){ bar.hidden = true; bar.innerHTML = ''; bar.className = 'duelbar'; }
  const go = $('#duelGo'); if(go) go.remove();
  const rc = $('#dRules'); if(rc) rc.hidden = true;
  const nt = $('#dNote'); if(nt) nt.classList.remove('on');
  document.body.classList.remove('duel-ready', 'is-duel', 'duel-many');
}
