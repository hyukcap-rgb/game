/* ===================== 대전 방 · 친구 접속 (2026-10-05, docs/22_대전방_친구_설계.md) =====================
   대전 서버(중계)는 그대로 쓰고, 대기실(lobby) presence로 방 광고·접속 상태·초대를 주고받는다(서버 배포 없음).
   · 대기실 presence(내 것): u 기기 표식 · mn 이름 · ml 레벨 · fh 친구 표식(친구 코드를 바꾼 값, 친구만 알아봄)
     · ps 하는 일('h' 접속 · 'r:<게임>' 방 · 'p:<게임>' 게임 중) · rm 방 광고(방장만) · iv 실시간 초대 목록
   · 방마다 중계 방 'rm-<번호>' 하나. 방장 presence가 방 상태를 정한다: gu 도전자(기기 표식) · kick 내보낸 사람 · rd 판 번호 · st 상태.
   · 판은 공용 대전 엔진(duelPrivate)으로 대전 방 'du-<번호>-<판>'에서 같은 순간 시작. 씨앗 = 방 번호 + 판 번호 + 날짜.
   게임 이름으로 나누지 않는다: 게임 정의에 duelLaunch가 있는 게임(차례로 두는 게임)은 이번엔 빠른 대전만. */
const RM_DIFF = ['easy', 'normal', 'hard'];
const RM_DNAME = { easy:'쉬움', normal:'보통', hard:'어려움' };
const RM_PTS = { easy:{ w:300, d:180, l:100 }, normal:DUEL_PTS, hard:{ w:550, d:330, l:200 } };
const RM_HARD_LV = 5, RM_BAND = 5, RM_BONUS = 100, RM_INV_GAP = 30000;
const rmLv = () => { try{ return lvInfo().L; }catch(_){ return 1; } };
const rmRec = L => L >= 12 ? 'hard' : L >= 5 ? 'normal' : 'easy';
const rmCanD = (d, L = rmLv()) => d !== 'hard' || L >= RM_HARD_LV;
const rmOk = id => !!(NG[id] && !NG[id].duelLaunch);   /* 동시에 푸는 게임만 방 */
const rmPtsTxt = d => { const p = RM_PTS[d] || DUEL_PTS; return `승 +${p.w} · 무 +${p.d} · 패 +${p.l}`; };
const rmChip = d => `<span class="dchip ${d}">${RM_DNAME[d] || '보통'}</span>`;
function rmUid(){ let u = store.get('hp:uid', ''); if(!u){ u = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store.set('hp:uid', u); } return u; }
const rmHash = code => code ? 'f' + (seedFrom('fr:' + code) >>> 0).toString(36) : '';
const rmVisible = () => store.get('hp:fronline', true) !== false;
const rmPlaying = () => !!(G && !G.over && $('#play') && $('#play').style.display === 'block');
/* 대전 포인트: 난이도별 + 강자 보너스(방에서 나보다 5레벨 이상 높은 상대를 이기면) */
function rmPts(lv, r, D){
  const base = (RM_PTS[lv] || DUEL_PTS)[r] || 0;
  const bonus = r === 'w' && D && D.room && typeof D.room.oppLv === 'number' && D.room.oppLv - rmLv() >= RM_BAND ? RM_BONUS : 0;
  return { pts:base + bonus, bonus };
}

/* ---------- 대기실 presence ---------- */
const RM = { cur:null, inv:[], seenInv:{}, pendInv:[], lbSig:{}, view:'', listG:'', listF:'all' };
function lbPeers(){
  try{ if(!duelLive()) return []; const me = rmUid(); return ROOM.peers().filter(p => !p.sameTab && p.presence && p.presence.u && p.presence.u !== me); }catch(_){ return []; }
}
function lbWant(){
  const c = RM.cur, now = Date.now();
  RM.inv = RM.inv.filter(x => now - x.t < 60000 && c && x.r === c.id);
  return {
    u:rmUid(), mn:myNick(), ml:rmLv(),
    fh:rmVisible() && frCode() ? rmHash(frCode()) : null,
    ps:rmPlaying() ? 'p:' + G.id : c ? 'r:' + c.g : 'h',
    rm:c && c.host && !c.closed ? { i:c.id, g:c.g, d:c.d, b:c.b, pv:c.pv ? 1 : 0, n:c.gu ? 2 : 1, s:c.st === 'w' ? 'w' : 'p', t:c.t } : null,
    iv:RM.inv.length ? RM.inv.map(x => ({ h:x.h, r:x.r, g:x.g, d:x.d, t:x.t })) : null
  };
}
function lbPush(){
  if(!duelLive()){ RM.lbSig = {}; return; }
  const w = lbWant(), ch = {};
  for(const k in w){ const s = JSON.stringify(w[k]); if(RM.lbSig[k] !== s){ ch[k] = w[k]; RM.lbSig[k] = s; } }
  if(Object.keys(ch).length) ROOM.presence(ch).catch(() => {});
}
/* 그 게임의 공개 방 목록 */
function rmAds(g){
  return lbPeers().filter(p => p.presence.rm && p.presence.rm.i && (!g || p.presence.rm.g === g) && !p.presence.rm.pv)
    .map(p => Object.assign({ peer:p.peer, nk:String(p.presence.mn || '익명').slice(0, 12), lv:+p.presence.ml || 1, fh:p.presence.fh || '' }, p.presence.rm))
    .filter(r => RM_DIFF.includes(r.d));
}
const rmCount = g => rmAds(g).filter(r => r.n < 2).length;
function rmSig(){ if(!duelLive()) return ''; return lbPeers().map(p => (p.presence.rm ? p.presence.rm.i + p.presence.rm.n + p.presence.rm.s : '') + (p.presence.fh || '') + (p.presence.ps || '')).join(',') + '|' + (RM.cur ? RM.cur.id : ''); }

/* ---------- 친구 접속 상태 ---------- */
function frLive(){
  const m = new Map(); if(!FR.friends.length) return m;
  const by = {}; for(const f of FR.friends) if(f.code) by[rmHash(f.code)] = f;
  for(const p of lbPeers()){ const f = p.presence.fh && by[p.presence.fh]; if(f) m.set(f.fid, { peer:p.peer, ps:String(p.presence.ps || 'h'), rm:p.presence.rm || null, lv:+p.presence.ml || 1 }); }
  return m;
}
function agoTxt(t){
  if(!t) return '';
  const s = (Date.now() - t) / 1000;
  return s < 180 ? '방금 전' : s < 3600 ? Math.floor(s / 60) + '분 전' : s < 86400 ? Math.floor(s / 3600) + '시간 전' : s < 172800 ? '어제' : Math.floor(s / 86400) + '일 전';
}
function frStatus(f, live){
  const L = (live || frLive()).get(f.fid);
  if(L){
    const g = L.ps.slice(2), gn = GAMES[g] ? GAMES[g].name : '';
    if(L.ps.startsWith('r:') && L.rm && !L.rm.pv && L.rm.n < 2) return { on:true, txt:`대전 방에서 기다리는 중 · ${gn} ${RM_DNAME[L.rm.d] || ''}`, room:L.rm };
    if(L.ps.startsWith('r:')) return { on:true, txt:'대전 방에 있어요' + (gn ? ' · ' + gn : '') };
    if(L.ps.startsWith('p:')) return { on:true, txt:'게임 중' + (gn ? ' · ' + gn : ''), busy:true };
    return { on:true, txt:'접속 중' };
  }
  const recent = f.seen && Date.now() - f.seen < 180000;
  return { on:false, recent, txt:f.seen ? agoTxt(f.seen) + ' 접속' : '' };
}
const frOnlineN = () => frLive().size;

/* ---------- 방 만들기 · 들어가기 · 나가기 ---------- */
function rmNewId(){ const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; for(let i = 0; i < 8; i++) s += a[Math.random() * a.length | 0]; return s; }
function rmMyPres(){ return { nk:myNick(), lv:rmLv(), u:rmUid() }; }
async function rmCreate(o){
  if(RM.cur){ toast('이미 대전 방에 있어요'); rmOpen(); return false; }
  if(!duelLive()){ toast('지금은 실시간 연결이 안 돼요. 빠른 대전(AI)으로 겨뤄 보세요'); return false; }
  const L = rmLv(), id = rmNewId();
  const c = { id, g:o.g, d:rmCanD(o.d, L) ? o.d : 'normal', b:o.band === 'near' ? [Math.max(1, L - RM_BAND), L + RM_BAND] : null, pv:!!o.pv, host:true, st:'w', rd:0, kick:[], gu:null, t:Date.now(), lastInv:{} };
  let nr; try{ nr = await ROOM.join('rm-' + id); }catch(_){ toast('방을 만들지 못했어요. 잠시 뒤 다시 해 주세요'); return false; }
  c.nr = nr; RM.cur = c;
  nr.presence(Object.assign(rmMyPres(), { h:1, g:c.g, d:c.d, b:c.b, pv:c.pv ? 1 : 0, st:'w', rd:0, kick:[], gu:null })).catch(() => {});
  c.un = nr.onPeers(() => rmSync(), () => rmLost());
  lbPush(); sfx('flLock');
  return c;
}
/* 방 들어가기: 방장이 보이면 확인(내보내짐·레벨·꽉 참) 뒤 방 안으로 */
async function rmJoin(id, o = {}){
  id = String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12); if(!id) return;
  if(RM.cur){ if(RM.cur.id === id){ rmOpen(); return; } toast('이미 다른 대전 방에 있어요. 먼저 나가 주세요'); rmOpen(); return; }
  if(!duelLive()){ toast('지금은 실시간 연결이 안 돼요. 잠시 뒤 다시 해 주세요'); return; }
  openModal(`<div class="rmwait"><span class="ds-radar"><i></i><i></i><i></i></span><p class="note">대전 방에 들어가는 중…</p></div>`);
  let nr; try{ nr = await ROOM.join('rm-' + id); }catch(_){ closeModal(); toast('방에 들어가지 못했어요'); return; }
  nr.presence(Object.assign(rmMyPres(), { rdy:0, iv:o.invited ? 1 : 0 })).catch(() => {});
  const t0 = Date.now();
  const host = await new Promise(res => { const iv = setInterval(() => { let h = null; try{ h = nr.peers().find(p => !p.sameTab && p.presence && p.presence.h && p.presence.g); }catch(_){} if(h || Date.now() - t0 > 4000){ clearInterval(iv); res(h); } }, 150); });
  const out = msg => { try{ nr.leave(); }catch(_){} closeModal(); toast(msg); };
  if(!host) return out('방이 닫혔거나 없는 방이에요');
  const H = host.presence, L = rmLv();
  if((H.kick || []).includes(rmUid())) return out('방장이 내보낸 방이라 들어갈 수 없어요');
  if(!o.invited && H.b && (L < H.b[0] || L > H.b[1])) return out(`Lv ${H.b[0]}~${H.b[1]}만 들어갈 수 있는 방이에요`);
  if(H.gu && H.gu !== rmUid()) return out('방이 꽉 찼어요');
  if(!GAMES[H.g] || !rmOk(H.g)) return out('지금은 들어갈 수 없는 방이에요');
  const c = RM.cur = { id, g:H.g, d:RM_DIFF.includes(H.d) ? H.d : 'normal', b:H.b || null, pv:!!H.pv, host:false, st:H.st || 'w', rd:+H.rd || 0, kick:[], gu:null, t:Date.now(), nr, joinAt:Date.now(), hostSeen:Date.now(), rdy:false, invited:!!o.invited, lastInv:{} };
  c.un = nr.onPeers(() => rmSync(), () => rmLost());
  sfx('flLock'); fxBuzz(15);
  lbPush(); rmOpen();
}
function rmLeave(msg){
  const c = RM.cur; if(!c) return;
  RM.cur = null; RM.inv = [];
  if(c.dh) try{ c.dh.cancel(); }catch(_){}
  if(c.un) try{ c.un(); }catch(_){}
  try{ c.nr.presence({ bye:1 }).catch(() => {}); }catch(_){}
  setTimeout(() => { try{ c.nr.leave(); }catch(_){} }, 150);
  lbPush(); rmPillRender();
  if($('#rmRoom') && $('#veil').classList.contains('on')) closeModal();
  if(msg) toast(msg);
  if(typeof renderHome === 'function' && $('#home').style.display !== 'none') renderHome();
}
/* 연결이 오래 끊겨 방을 잃음 */
function rmLost(){ if(!RM.cur) return; if(rmPlaying() && G.duel && G.duel.room){ RM.cur.closed = true; return; } rmLeave('연결이 끊겨 대전 방에서 나왔어요'); }

/* 방 상태 맞추기(방장은 정하고, 도전자는 따른다) */
function rmPeers(c){ try{ return c.nr.peers(); }catch(_){ return []; } }
function rmHostOf(c){ return rmPeers(c).find(p => p.presence && p.presence.h && !p.presence.bye); }
function rmGuestOf(c){
  if(c.host) return c.gu ? rmPeers(c).find(p => !p.sameTab && p.presence && p.presence.u === c.gu && !p.presence.bye) : null;
  return rmPeers(c).find(p => p.sameTab);
}
function rmSync(){
  const c = RM.cur; if(!c) return;
  if(c.host){
    const ps = rmPeers(c).filter(p => !p.sameTab && p.presence && p.presence.u && !p.presence.h && !p.presence.bye && !c.kick.includes(p.presence.u));
    let gu = c.gu;
    if(gu && !ps.some(p => p.presence.u === gu) && c.st === 'w') gu = null;   /* 대전 중에는 잠깐 끊겨도 자리 유지 */
    if(!gu && ps.length) gu = ps[0].presence.u;
    if(gu !== c.gu){
      const was = c.gu; c.gu = gu;
      c.nr.presence({ gu }).catch(() => {});
      if(gu && !was){ sfx('flPing'); fxBuzz([20, 30, 20]); }
      if(!gu && was && c.st === 'w') toast('도전자가 나갔어요');
      lbPush();
    }
  } else {
    const h = rmHostOf(c);
    if(h){
      c.hostSeen = Date.now(); const H = h.presence;
      c.hostPeer = h.peer;
      if((H.kick || []).includes(rmUid())){ rmLeave('방장이 방에서 내보냈어요'); return; }
      if(H.gu && H.gu !== rmUid() && Date.now() - c.joinAt > 1500){ rmLeave('방이 꽉 찼어요'); return; }
      c.st = H.st || 'w';
      if(H.st === 'go' && +H.rd > c.rd && H.gu === rmUid()) rmBegin(+H.rd);
    } else if(!(rmPlaying() && G.duel && G.duel.room) && Date.now() - c.hostSeen > 8000){ rmLeave('방장이 나가서 방이 닫혔어요'); return; }
  }
  rmRefreshViews();
}
function rmReady(on){
  const c = RM.cur; if(!c || c.host) return;
  if(on && !HOST.canDuel()) return;
  c.rdy = !!on; c.nr.presence({ rdy:on ? 1 : 0 }).catch(() => {});
  sfx(on ? 'flLock' : 'toggle'); rmRefreshViews();
}
function rmStartGame(){
  const c = RM.cur; if(!c || !c.host || c.st !== 'w') return;
  const g = rmGuestOf(c);
  if(!g || !g.presence.rdy){ toast('도전자가 준비하면 시작할 수 있어요'); return; }
  if(!HOST.canDuel()) return;
  const rd = c.rd + 1;
  c.st = 'go'; c.nr.presence({ st:'go', rd }).catch(() => {});
  rmBegin(rd);
}
/* 판 시작: 두 사람이 같은 대전 방에 들어가 공용 엔진으로 같은 순간 시작 */
function rmBegin(rd){
  const c = RM.cur; if(!c || rd <= c.rd) return;
  c.rd = rd; c.rdy = false;
  if(!c.host) c.nr.presence({ rdy:0 }).catch(() => {});
  const other = c.host ? rmGuestOf(c) : rmHostOf(c), oppLv = other && other.presence ? +other.presence.lv || 1 : 1;
  openModal(`<div class="rmwait"><span class="ds-radar"><i></i><i></i><i></i></span><p class="note">곧 시작해요 · 같은 문제를 같은 순간에 풀어요</p></div>`);
  c.dh = duelPrivate(c.g, c.d, 'du-' + c.id + '-' + rd, { nick:myNick(), room:{ id:c.id, g:c.g, d:c.d, oppLv, host:c.host },
    onFail:why => {
      c.dh = null;
      if(c.host){ c.st = 'w'; c.nr.presence({ st:'w' }).catch(() => {}); }
      toast(why === 'start' ? '하트가 없어 시작하지 못했어요' : '상대와 연결하지 못했어요. 다시 준비해 주세요');
      if(RM.cur === c) rmOpen();
    } });
  if(c.host) setTimeout(() => { if(RM.cur === c && c.st === 'go'){ c.st = 'p'; c.nr.presence({ st:'p' }).catch(() => {}); lbPush(); } }, 1500);
  lbPush();
}
/* 판이 끝남(결과 창이 뜰 때): 방장은 방을 다시 대기로 */
function rmAfterDuel(){
  const c = RM.cur; if(!c) return;
  c.dh = null;
  if(c.host){ c.st = 'w'; c.nr.presence({ st:'w' }).catch(() => {}); }
  if(c.closed) setTimeout(() => rmLeave('대전 방 연결이 끊겨 방에서 나왔어요'), 1500);
  lbPush();
}
function rmKick(){
  const c = RM.cur; if(!c || !c.host || c.st !== 'w') return;
  const g = rmGuestOf(c); if(!g) return;
  const nk = escH(String(g.presence.nk || '도전자').slice(0, 12));
  openModal(`<h3>내보내기</h3><p class="note"><b>${nk}</b>님을 방에서 내보낼까요?<br>이 방이 닫힐 때까지 다시 들어올 수 없어요.</p>
    <div class="mbtns"><button class="b2" id="rkNo">취소</button><button class="b1 danger" id="rkYes">내보내기</button></div>`);
  $('#rkNo').onclick = rmOpen;
  $('#rkYes').onclick = () => {
    if(RM.cur !== c) return closeModal();
    c.kick.push(g.presence.u); c.gu = null;
    c.nr.presence({ kick:c.kick.slice(-30), gu:null }).catch(() => {});
    toast(nk.replace(/&[a-z#0-9]+;/g, '') + '님을 내보냈어요'); sfx('toggle');
    lbPush(); rmOpen();
  };
}

/* ---------- 초대 ---------- */
function rmInviteFriend(f){
  const c = RM.cur; if(!c) return;
  const last = c.lastInv[f.fid] || 0;
  if(Date.now() - last < RM_INV_GAP){ toast('방금 초대했어요. 조금 뒤에 다시 보낼 수 있어요'); return; }
  c.lastInv[f.fid] = Date.now();
  const live = frLive().get(f.fid);
  if(live){
    RM.inv = RM.inv.filter(x => x.h !== rmHash(f.code));
    RM.inv.push({ h:rmHash(f.code), r:c.id, g:c.g, d:c.d, t:Date.now() }); lbPush();
    sfx('heartSend'); toast(f.nick + '님 화면에 초대를 보냈어요');
  } else {
    frSend(f, 'play', { day:dayKey(), g:c.g, d:c.d, room:c.id }).then(ok => { if(ok){ sfx('heartSend'); toast(f.nick + '님 알림함으로 초대를 보냈어요'); } });
  }
  rmRefreshViews();
}
function rmLink(){
  const c = RM.cur; if(!c) return '';
  const u = new URL(linkOf({ room:c.id })); u.searchParams.delete('f'); return u.toString();
}
async function rmShareLink(){
  const c = RM.cur; if(!c) return;
  const url = rmLink(), text = `${myNick()}의 ${GAMES[c.g].name} 대전 방(${RM_DNAME[c.d]})으로 와! 같은 문제, 다른 점수.`;
  try{ if(navigator.share){ await navigator.share({ title:'하루퍼즐 리그 대전 방', text, url }); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText(text + '\n' + url); toast('방 링크를 복사했어요. 카톡에 붙여 넣어 보내세요'); }catch(_){ toast(url); }
}
function rmInviteSheet(){
  const c = RM.cur; if(!c) return;
  const live = frLive();
  const fs = FR.friends.slice().sort((a, b) => (live.has(b.fid) ? 1 : 0) - (live.has(a.fid) ? 1 : 0));
  const row = f => { const s = frStatus(f, live), wait = Date.now() - (c.lastInv[f.fid] || 0) < RM_INV_GAP;
    return `<div class="frrow${s.on ? ' on' : ''}"><span class="frav">${rivalAv({ name:f.fid })}${s.on ? '<i class="ondot"></i>' : ''}</span><span class="frn"><b>${escH(f.nick)}</b><small>${escH(s.txt || '')}</small></span>
      <button class="btn small ${s.on ? 'primary' : 'secondary'}" data-inv="${f.fid}" ${wait ? 'disabled' : ''}>${wait ? '보냄' : s.on ? '바로 초대' : '알림 보내기'}</button></div>`; };
  openModal(`<h3>친구 초대</h3><p class="note">${GAMES[c.g].name} · ${RM_DNAME[c.d]} 방으로 불러요. 초대받은 친구는 레벨이 달라도 들어올 수 있어요.</p>
    <div class="frlist">${fs.length ? fs.map(row).join('') : `<p class="note">아직 친구가 없어요. 아래 링크를 보내거나, 친구 메뉴에서 친구를 먼저 맺어 보세요.</p>`}</div>
    <button class="btn gold block" id="riLink">${ic('share')} 방 링크 보내기 · 카톡</button>
    <div class="mbtns one"><button class="b2" id="riBack">방으로</button></div>`);
  document.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { const f = FR.friends.find(q => q.fid === b.dataset.inv); if(f){ rmInviteFriend(f); rmInviteSheet(); } });
  $('#riLink').onclick = rmShareLink;
  $('#riBack').onclick = rmOpen;
}
/* 실시간 초대 받기: 게임 중이면 끝난 뒤에 */
function rmInvScan(){
  const my = rmVisible() && frCode() ? rmHash(frCode()) : ''; if(!my) return;
  for(const p of lbPeers()){
    const iv = p.presence.iv; if(!Array.isArray(iv)) continue;
    for(const x of iv){
      if(!x || x.h !== my || !x.r) continue;
      const k = p.presence.u + ':' + x.r + ':' + x.t; if(RM.seenInv[k]) continue;
      RM.seenInv[k] = 1;
      if(RM.cur && RM.cur.id === x.r) continue;
      RM.pendInv.push({ r:x.r, g:x.g, d:x.d, nk:String(p.presence.mn || '친구').slice(0, 12), at:Date.now() });
    }
  }
  RM.pendInv = RM.pendInv.filter(x => Date.now() - x.at < 120000);
  if(!RM.pendInv.length || rmPlaying() || $('#rmInv')) return;
  rmInvBanner(RM.pendInv.shift());
}
function rmInvBanner(x){
  const el = document.createElement('div'); el.className = 'rminv'; el.id = 'rmInv'; el.setAttribute('role', 'alertdialog');
  const gn = GAMES[x.g] ? GAMES[x.g].name : '대전';
  el.innerHTML = `<span class="rminv-i">${ic('duel')}</span><span class="rminv-t"><b>${escH(x.nk)}님의 초대</b><small>${escH(gn)} · ${RM_DNAME[x.d] || '보통'} 대전 방</small></span>
    <button class="btn small secondary" id="rmInvNo">나중에</button><button class="btn small primary" id="rmInvGo">들어가기</button>`;
  document.body.appendChild(el);
  sfx('flPing'); fxBuzz([20, 40, 20]);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  el.querySelector('#rmInvNo').onclick = close;
  el.querySelector('#rmInvGo').onclick = () => { close(); rmJoin(x.r, { invited:true }); };
  setTimeout(() => { if(el.isConnected) close(); }, 20000);
}

/* ---------- 화면: 방 목록(게임별) ---------- */
function rmList(g){
  if(!GAMES[g]) return;
  if(!rmOk(g)){   /* 차례로 두는 게임 */
    openModal(`<div class="rmlist"><p class="kick">대전</p><h3>${GAMES[g].name}</h3>
      <p class="note">이 게임은 번갈아 두는 실시간 대전이라 <b>빠른 대전</b>으로 바로 붙어요.<br>대전 방은 다음 업데이트에서 열려요.</p>
      ${HOST.duelRewardHtml()}
      <div class="mbtns"><button class="b2" id="rlClose">닫기</button><button class="b1" id="rlQuick">빠른 대전 ${costTag()}</button></div></div>`);
    $('#rlClose').onclick = closeModal; $('#rlQuick').onclick = () => { closeModal(); duelStart(g); };
    return;
  }
  RM.listG = g;
  const L = rmLv(), rec = rmRec(L);
  openModal(`<div class="rmlist" id="rmList" style="--gc:${GCOL[g][1]}"><button class="mx" id="rlX" aria-label="닫기">✕</button>
    <div class="rmhead"><span class="g-art">${ART[g]()}</span><div><p class="kick">대전 방</p><h3>${GAMES[g].name}</h3></div></div>
    <div class="rmpts">${RM_DIFF.map(d => `<div class="rmpt ${d}${rmCanD(d, L) ? '' : ' lock'}">${rmChip(d)}${d === rec ? '<em>추천</em>' : ''}<b class="num">승 +${RM_PTS[d].w}</b><small>무 +${RM_PTS[d].d} · 패 +${RM_PTS[d].l}</small>${rmCanD(d, L) ? '' : `<small class="lk">${ic('lock')}Lv ${RM_HARD_LV}부터</small>`}</div>`).join('')}</div>
    <div class="fchips rmf" role="group" aria-label="난이도로 거르기">${['all', ...RM_DIFF].map(f => `<button data-rf="${f}" class="${RM.listF === f ? 'on' : ''}">${f === 'all' ? '전체' : RM_DNAME[f]}</button>`).join('')}</div>
    <div class="rmrows" id="rmRows"></div>
    <p class="rmme">내 레벨 Lv ${L} · 한 판 ${ic('heart')}1 · 방에서는 사람끼리만 붙어요</p>
    <div class="mbtns"><button class="b2" id="rlQuick">빠른 대전 ${costTag()}</button><button class="b1" id="rlMake">${RM.cur ? '내 방으로' : '방 만들기'}</button></div></div>`);
  $('#rlX').onclick = () => { RM.listG = ''; closeModal(); };
  $('#rlQuick').onclick = () => { if(RM.cur){ toast('대전 방에 있는 동안은 빠른 대전을 할 수 없어요'); return; } RM.listG = ''; closeModal(); duelStart(g); };
  $('#rlMake').onclick = () => { RM.listG = ''; if(RM.cur) rmOpen(); else rmCreateSheet(g); };
  document.querySelectorAll('[data-rf]').forEach(b => b.onclick = () => { RM.listF = b.dataset.rf; document.querySelectorAll('[data-rf]').forEach(x => x.classList.toggle('on', x === b)); rmListRender(); });
  rmListRender();
}
function rmListRender(){
  const box = $('#rmRows'), g = RM.listG; if(!box || !g) return;
  if(!duelLive()){ box.innerHTML = `<p class="rmempty">지금은 실시간 연결이 안 돼요.<br>빠른 대전을 누르면 AI와 겨뤄요.</p>`; return; }
  const L = rmLv(), live = frLive(), fhs = new Set([...FR.friends].filter(f => f.code).map(f => rmHash(f.code)));
  let rs = rmAds(g).filter(r => RM.listF === 'all' || r.d === RM.listF);
  const can = r => r.n < 2 && r.s === 'w' && (!r.b || (L >= r.b[0] && L <= r.b[1])) && !(RM.cur && RM.cur.id === r.i);
  rs.sort((a, b) => (can(b) - can(a)) || (fhs.has(b.fh) - fhs.has(a.fh)) || (Math.abs(a.lv - L) - Math.abs(b.lv - L)) || (a.t - b.t));
  const sig = JSON.stringify(rs.map(r => [r.i, r.n, r.s, r.d, r.nk, r.lv])) + L + RM.listF;
  if(box.dataset.sig === sig) return; box.dataset.sig = sig;
  if(!rs.length){ box.innerHTML = `<p class="rmempty">${RM.listF === 'all' ? '아직 열린 방이 없어요.' : RM_DNAME[RM.listF] + ' 방이 없어요.'}<br><b>방 만들기</b>로 첫 방을 열어 보세요.</p>`; return; }
  box.innerHTML = rs.map(r => {
    const ok = can(r), fr = fhs.has(r.fh), why = r.n >= 2 ? (r.s === 'w' ? '꽉 참' : '대전 중') : r.s !== 'w' ? '대전 중' : r.b && (L < r.b[0] || L > r.b[1]) ? `Lv ${r.b[0]}~${r.b[1]}만` : '';
    return `<div class="rmrow${ok ? '' : ' off'}${fr ? ' fr' : ''}"><span class="frav">${rivalAv({ name:r.nk })}</span>
      <span class="rmrn"><b>${escH(r.nk)} <em class="lvt">Lv ${r.lv}</em>${fr ? '<em class="frt">친구</em>' : ''}</b><small>${rmChip(r.d)}<span class="gp">승 +${RM_PTS[r.d].w}</span> · ${r.b ? `Lv ${r.b[0]}~${r.b[1]}` : '누구나'}</small></span>
      <span class="rmn num">${r.n}/2</span><button class="btn small ${ok ? 'primary' : 'secondary'}" data-rj="${r.i}" ${ok ? '' : 'disabled'}>${ok ? '들어가기' : why}</button></div>`;
  }).join('');
  box.querySelectorAll('[data-rj]').forEach(b => b.onclick = () => { RM.listG = ''; rmJoin(b.dataset.rj, { invited:false }); });
}

/* ---------- 화면: 방 만들기 ---------- */
function rmCreateSheet(g, o = {}){
  if(RM.cur){ rmOpen(); return; }
  const L = rmLv(); let d = rmCanD(o.d || rmRec(L), L) ? (o.d || rmRec(L)) : 'normal', band = o.band || 'near', pv = !!o.pv;
  const draw = () => {
    openModal(`<div class="rmmake" style="--gc:${GCOL[g][1]}"><p class="kick">${o.friend ? escH(o.friend.nick) + '님과 같이 하기' : '방 만들기'}</p><h3>${GAMES[g].name}</h3>
      <p class="rmlb">난이도 · 얻는 점수</p>
      <div class="rmdiffs">${RM_DIFF.map(x => { const lk = !rmCanD(x, L); return `<button class="rmd ${x}${x === d ? ' on' : ''}${lk ? ' lock' : ''}" data-d="${x}" ${lk ? 'disabled' : ''}>${rmChip(x)}${x === rmRec(L) ? '<em>추천</em>' : ''}<b class="num">승 +${RM_PTS[x].w}</b><small>무 +${RM_PTS[x].d}<br>패 +${RM_PTS[x].l}</small>${lk ? `<small class="lk">${ic('lock')}Lv ${RM_HARD_LV}부터</small>` : ''}</button>`; }).join('')}</div>
      ${o.friend ? '' : `<p class="rmlb">누가 들어오나</p>
      <div class="seg"><button data-b="near" class="${band === 'near' ? 'on' : ''}">내 레벨 근처<small>Lv ${Math.max(1, L - RM_BAND)}~${L + RM_BAND}</small></button><button data-b="all" class="${band === 'all' ? 'on' : ''}">누구나<small>레벨 상관없이</small></button></div>
      <label class="rmpv"><input type="checkbox" id="rmPv" ${pv ? 'checked' : ''}><span><b>비공개 방</b><small>목록에 안 보이고 초대·링크로만 들어와요</small></span></label>`}
      <p class="rmme">강자 보너스: 나보다 ${RM_BAND}레벨 이상 높은 상대를 이기면 +${RM_BONUS}<br>한 판 ${ic('heart')}1 · 두 사람 모두</p>
      <div class="mbtns"><button class="b2" id="rcBack">뒤로</button><button class="b1" id="rcGo">${o.friend ? '방 만들고 초대하기' : '방 만들기'}</button></div></div>`);
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { d = b.dataset.d; sfx('toggle'); draw(); });
    document.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { band = b.dataset.b; draw(); });
    const pc = $('#rmPv'); if(pc) pc.onchange = () => { pv = pc.checked; };
    $('#rcBack').onclick = () => o.back ? o.back() : rmList(g);
    $('#rcGo').onclick = async () => {
      $('#rcGo').disabled = true;
      const c = await rmCreate({ g, d, band:o.friend ? 'all' : band, pv:o.friend ? true : pv });
      if(!c){ const b = $('#rcGo'); if(b) b.disabled = false; return; }
      if(o.friend) rmInviteFriend(o.friend);
      rmOpen();
    };
  };
  draw();
}

/* ---------- 화면: 방 안 ---------- */
function rmOpen(){
  const c = RM.cur; if(!c){ closeModal(); return; }
  openModal(`<div class="rmroom" id="rmRoom" style="--gc:${GCOL[c.g][1]}"></div>`);
  $('#modal').classList.add('duelm');
  rmRoomRender(true);
  rmPillRender();
}
function rmRoomRender(force){
  const c = RM.cur, box = $('#rmRoom'); if(!c || !box) return;
  const hostP = c.host ? null : rmHostOf(c), guestP = rmGuestOf(c);
  const H = c.host ? Object.assign(rmMyPres(), {}) : (hostP ? hostP.presence : { nk:'방장', lv:'?' });
  const Gp = guestP ? guestP.presence : null;
  const gRdy = c.host ? !!(Gp && Gp.rdy) : c.rdy;
  const sig = JSON.stringify([c.st, c.gu, H.nk, H.lv, Gp && [Gp.nk, Gp.lv, Gp.rdy, Gp.iv], c.rdy, Object.keys(c.lastInv).length]);
  if(!force && box.dataset.sig === sig) return; box.dataset.sig = sig;
  const seat = (p, isHost, me) => p ? `<div class="rmseat${isHost ? ' host' : ''}${!isHost && (c.host ? !!p.rdy : c.rdy) ? ' rdy' : ''}">
      ${isHost ? '<span class="crown">👑</span>' : ''}<span class="frav">${me ? avatar({ me:true }) : rivalAv({ name:String(p.nk || '?') })}</span>
      <b>${me ? '나' : escH(String(p.nk || '?').slice(0, 12))}</b><small>Lv ${escH(String(p.lv || '?'))}${isHost ? ' · 방장' : ''}</small>
      ${!isHost ? `<span class="rdytag">${(c.host ? p.rdy : c.rdy) ? '준비 완료' : '준비 중…'}</span>` : ''}
      ${!isHost && c.host && c.st === 'w' ? '<button class="rmkick" id="rmKick">내보내기</button>' : ''}</div>`
    : `<div class="rmseat empty"><span class="ds-radar"><i></i><i></i><i></i></span><b>기다리는 중…</b><small>${c.pv ? '초대한 친구만 들어와요' : '방 목록에 보여요'}</small>${c.host ? `<button class="btn small gold" id="rmInv2">${ic('share')} 친구 초대</button>` : ''}</div>`;
  const status = c.st !== 'w' ? '대전이 진행 중이에요' : c.host ? (!Gp ? '도전자를 기다리고 있어요. 친구를 초대해 보세요' : gRdy ? '도전자가 준비됐어요! 시작을 누르세요' : '도전자가 준비하면 시작할 수 있어요')
    : (c.rdy ? '방장이 시작하면 바로 대전이 시작돼요' : '준비를 누르면 방장이 시작할 수 있어요');
  const main = c.host ? `<button class="b1" id="rmGo" ${Gp && gRdy && c.st === 'w' ? '' : 'disabled'}>시작 ${costTag()}</button>`
    : `<button class="b1${c.rdy ? ' on' : ''}" id="rmRdy" ${c.st === 'w' ? '' : 'disabled'}>${c.rdy ? '준비 취소' : '준비 ' + costTag()}</button>`;
  box.innerHTML = `<button class="mx" id="rmX" aria-label="방 창 접기">—</button>
    <p class="kick">대전 방${c.pv ? ' · 비공개' : ''}${c.b ? ` · Lv ${c.b[0]}~${c.b[1]}` : ''}</p><h3>${GAMES[c.g].name}</h3>
    <div class="rmtags">${rmChip(c.d)}<span class="gp">${rmPtsTxt(c.d)}</span></div>
    <div class="rmseats">${seat(H, true, c.host)}<div class="vs-x">VS</div>${seat(c.host ? Gp : rmMyPres(), false, !c.host)}</div>
    <p class="note rmst">${status}</p>
    <div class="mbtns"><button class="b2" id="rmOut">나가기</button>${main}</div>
    ${c.host ? `<button class="btn secondary block rminvbtn" id="rmInv">${ic('share')} 초대하기 · 친구 / 링크</button>` : ''}`;
  $('#rmX').onclick = () => { closeModal(); rmPillRender(); };
  $('#rmOut').onclick = () => rmLeave(c.host ? '방을 닫았어요' : '방에서 나왔어요');
  const go = $('#rmGo'); if(go) go.onclick = rmStartGame;
  const rd = $('#rmRdy'); if(rd) rd.onclick = () => rmReady(!c.rdy);
  const k = $('#rmKick'); if(k) k.onclick = rmKick;
  const i1 = $('#rmInv'), i2 = $('#rmInv2'); if(i1) i1.onclick = rmInviteSheet; if(i2) i2.onclick = rmInviteSheet;
}
function rmRefreshViews(){ if($('#rmRoom')) rmRoomRender(); if($('#rmRows')) rmListRender(); rmPillRender(); }
/* 방 창을 접었을 때 아래에 떠 있는 알약 */
function rmPillRender(){
  let el = $('#rmPill'); const c = RM.cur;
  const show = c && !rmPlaying() && $('#home').style.display !== 'none' && !($('#veil').classList.contains('on'));
  if(!show){ if(el) el.hidden = true; return; }
  if(!el){ el = document.createElement('button'); el.id = 'rmPill'; el.className = 'rmpill'; el.onclick = () => rmOpen(); document.body.appendChild(el); }
  const n = c.host ? (c.gu ? 2 : 1) : 2;
  const txt = `${ic('duel')}<span><b>대전 방 · ${GAMES[c.g].name}</b><small>${RM_DNAME[c.d]} · ${n}/2 · ${c.host ? (c.gu ? '도전자 입장!' : '기다리는 중') : (c.rdy ? '준비 완료' : '준비를 눌러요')}</small></span><em>열기</em>`;
  if(el.dataset.t !== txt){ el.innerHTML = txt; el.dataset.t = txt; }
  el.hidden = false;
}

/* ---------- 친구 화면(상단 친구 버튼) ---------- */
function frBtnRender(){
  const b = $('#frBtn'); if(!b) return;
  const n = frOnlineN(), k = n + ':' + FR.friends.length;
  if(b.dataset.k === k) return; b.dataset.k = k;
  b.innerHTML = `${FR_G}${n ? `<span class="badge on">${n}</span>` : ''}`;
  b.setAttribute('aria-label', '친구' + (n ? ', 접속 중 ' + n + '명' : ''));
}
const FR_G = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11.5" cy="11" r="5.2" fill="#FFC08A" stroke="#1A0F45" stroke-width="2.2"/><path d="M2.5 26c.6-5.4 4.2-8.4 9-8.4s8.4 3 9 8.4z" fill="#7C5CFF" stroke="#1A0F45" stroke-width="2.2" stroke-linejoin="round"/><circle cx="22" cy="12.5" r="4.4" fill="#FFE0C4" stroke="#1A0F45" stroke-width="2.2"/><path d="M17.5 19.6c1.3-.8 2.8-1.2 4.5-1.2 4 0 7 2.6 7.5 7.6h-7.3" fill="#FF7DB0" stroke="#1A0F45" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
function frHub(){
  const live = frLive(), all = FR.friends.slice();
  const on = all.filter(f => live.has(f.fid)), off = all.filter(f => !live.has(f.fid)).sort((a, b) => (b.seen || 0) - (a.seen || 0));
  const row = f => {
    const s = frStatus(f, live);
    const join = s.room ? `<button class="btn small gold" data-fj="${s.room.i}">들어가기</button>` : '';
    return `<div class="frrow${s.on ? ' on' : ''}"><button class="frtap" data-fo="${f.fid}"><span class="frav">${rivalAv({ name:f.fid })}${s.on ? '<i class="ondot"></i>' : ''}</span><span class="frn"><b>${escH(f.nick)}</b><small>${escH(s.txt || '')}${!s.on && f.played ? ' · 오늘 ' + fmt(f.score || 0) + '점' : ''}</small></span></button>
      ${join}<button class="btn small ${s.on ? 'primary' : 'secondary'}" data-ft="${f.fid}">같이 하기</button></div>`;
  };
  openModal(`<div class="frhub"><button class="mx" id="fhX" aria-label="닫기">✕</button><h3>친구 <small>${on.length ? `접속 중 <b>${on.length}</b>명` : ''}</small></h3>
    <div class="frtop"><button class="btn gold" id="fhInv">${ic('share')} 친구 초대하기</button><button class="btn secondary" id="fhMng">코드 · 추가 · 삭제</button></div>
    ${!duelLive() ? '<p class="note">실시간 연결이 안 돼서 접속 상태를 못 보고 있어요. 같이 하기는 알림함으로 보내져요.</p>' : ''}
    ${all.length ? `${on.length ? `<p class="frsec"><i class="ondot"></i>접속 중 ${on.length}</p><div class="frlist">${on.map(row).join('')}</div>` : '<p class="frsec">접속 중인 친구가 없어요</p>'}
      ${off.length ? `<p class="frsec">다른 친구 ${off.length}</p><div class="frlist">${off.map(row).join('')}</div>` : ''}`
      : `<p class="note">아직 친구가 없어요.<br>초대 링크를 보내면 들어오는 순간 친구가 돼요. 친구가 되면 접속 중인지 보이고, 원하는 게임으로 바로 같이 할 수 있어요.</p>`}
    <label class="frvis"><input type="checkbox" id="fhVis" ${rmVisible() ? 'checked' : ''}><span>내 접속 상태를 친구에게 보이기<small>끄면 바로 초대는 못 받고 알림함으로만 받아요</small></span></label></div>`);
  $('#fhX').onclick = closeModal;
  $('#fhInv').onclick = () => viralShare(cardInvite(), frHub);
  $('#fhMng').onclick = frManage;
  $('#fhVis').onchange = e => { store.set('hp:fronline', !!e.target.checked); lbPush(); toast(e.target.checked ? '친구에게 접속 상태가 보여요' : '접속 상태를 숨겼어요'); };
  document.querySelectorAll('[data-fo]').forEach(b => b.onclick = () => frFriendSheet({ fid:b.dataset.fo }));
  document.querySelectorAll('[data-ft]').forEach(b => b.onclick = () => { const f = FR.friends.find(q => q.fid === b.dataset.ft); if(f) frTogether(f); });
  document.querySelectorAll('[data-fj]').forEach(b => b.onclick = () => rmJoin(b.dataset.fj, { invited:false }));
}
/* 특정 게임 같이 하기: 게임 고르기 → 난이도 → 비공개 방 만들고 바로 초대 */
function frTogether(f){
  if(RM.cur){ rmInviteFriend(f); rmOpen(); return; }
  if(!duelLive()){ frInvitePlay(f); return; }   /* 실시간이 안 되면 예전처럼 오늘의 시험지로 부르기 */
  const set = dayState().set, ids = GAME_IDS.filter(g => rmOk(g) && !isAdult(g)).sort((a, b) => (set.includes(b) ? 1 : 0) - (set.includes(a) ? 1 : 0));
  openModal(`<div class="frpickg"><p class="kick">${escH(f.nick)}님과 같이 하기</p><h3>어떤 게임으로 붙을까요?</h3>
    <div class="gpick">${ids.map(g => `<button data-tg="${g}" style="--gc:${GCOL[g][1]}"><span class="g-art">${ART[g]()}</span><b>${GAMES[g].name}</b>${set.includes(g) ? '<em>오늘</em>' : ''}</button>`).join('')}</div>
    <div class="mbtns one"><button class="b2" id="tgBack">뒤로</button></div></div>`);
  $('#tgBack').onclick = frHub;
  document.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => rmCreateSheet(b.dataset.tg, { friend:f, back:() => frTogether(f) }));
}
/* 대전 탭 맨 위: 접속 중인 친구 줄 */
function duelFriendsHtml(){
  if(!FR.friends.length) return `<button class="dfr empty" id="dfrInv">${FR_G}<span><b>친구와 같이 대전하기</b><small>친구를 초대하면 접속 중인 친구가 여기 보여요</small></span>${ic('chev')}</button>`;
  const live = frLive(), on = FR.friends.filter(f => live.has(f.fid));
  if(!on.length) return `<button class="dfr empty" id="dfrHub">${FR_G}<span><b>접속 중인 친구가 없어요</b><small>친구 ${FR.friends.length}명 · 눌러서 알림으로 같이 하자고 하기</small></span>${ic('chev')}</button>`;
  return `<div class="dfr"><p><i class="ondot"></i>접속 중인 친구 ${on.length}명</p><div class="dfr-row">${on.map(f => { const s = frStatus(f, live);
    return `<button class="dfr-f" data-df="${f.fid}"><span class="frav">${rivalAv({ name:f.fid })}<i class="ondot"></i></span><b>${escH(f.nick)}</b><small>${escH(s.room ? '방에서 기다림' : s.busy ? '게임 중' : '같이 하기')}</small></button>`; }).join('')}</div></div>`;
}
function duelFriendsBind(){
  const a = $('#dfrInv'); if(a) a.onclick = () => viralShare(cardInvite(), closeModal);
  const h = $('#dfrHub'); if(h) h.onclick = frHub;
  document.querySelectorAll('[data-df]').forEach(b => b.onclick = () => {
    const f = FR.friends.find(q => q.fid === b.dataset.df); if(!f) return;
    const s = frStatus(f); if(s.room) rmJoin(s.room.i, { invited:false }); else frTogether(f);
  });
}
/* 대전 탭 게임 줄 버튼 */
function rmRowBtn(id){
  if(!rmOk(id)) return `대전 ${costTag()}`;
  const n = duelLive() ? rmCount(id) : 0;
  return n ? `방 <b class="num">${n}</b>` : '방 목록';
}

/* ---------- 시작 · 주기 ---------- */
function rmTick(){
  try{
    lbPush(); rmInvScan(); frBtnRender(); rmPillRender();
    if(RM.cur) rmSync(); else if($('#rmRows')) rmListRender();
  }catch(e){ console.warn('rooms', e); }
}
function rmStart(){
  const b = $('#frBtn'); if(b) b.onclick = frHub;
  frBtnRender();
  setInterval(rmTick, 1200);
  addEventListener('pagehide', () => { if(RM.cur) try{ RM.cur.nr.presence({ bye:1 }).catch(() => {}); }catch(_){} });
  /* 방 링크(?room=)로 들어옴: 실시간 연결을 기다렸다가 들어가기 */
  let id = ''; try{ id = new URLSearchParams(location.search).get('room') || ''; }catch(_){}
  if(id){
    try{ const u = new URL(location.href); u.searchParams.delete('room'); history.replaceState(history.state, '', u.toString()); }catch(_){}
    let n = 0; const t = setInterval(() => {
      if(duelLive() && !($('#veil').classList.contains('on') && !$('#rmRoom'))){ clearInterval(t); rmJoin(id, { invited:true }); }
      else if(++n > 120){ clearInterval(t); if(!duelLive()) toast('실시간 연결이 안 돼서 대전 방에 못 들어갔어요'); }
    }, 500);
  }
}
