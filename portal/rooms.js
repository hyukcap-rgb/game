/* ===================== 대전 방 · 친구 접속 (2026-10-05 docs/22 → 2026-10-06 docs/21 10-2·11-1, 결정 208·209·212) =====================
   대전 서버(중계)는 그대로 쓰고, 대기실(lobby) presence로 방 광고·접속 상태·초대를 주고받는다(서버 배포 없음).
   · 대기실 presence(내 것): u 기기 표식 · mn 이름 · ml 레벨 · fh 친구 표식(친구 코드를 바꾼 값, 친구만 알아봄)
     · ps 하는 일('h' 접속 · 'r:<게임>' 방 · 'p:<게임>' 게임 중) · rm 방 광고(방장만, n 인원 · c 정원) · iv 실시간 초대 목록
   · 방마다 중계 방 'rm-<코드>' 하나. 방 코드 = 6글자(I·O·0·1 없음). 비공개 방 = 친구 방(따로 만들지 않음).
     - 모두의 presence: nk 이름 · lv 레벨 · u 기기 표식 · rdy 준비(한 판 더 = 자동 준비) · rv 결과 보는 중
     - 방장 presence: h · hv(방장 차례 번호) · g · d · b · pv · cap 정원(2~그 게임 최대) · st 상태('w' 기다림 · 'go' 시작 · 'p' 대전 중)
       · rd 판 번호 · kick 내보낸 사람 · ord 들어온 순서 · pl 이번 판 참가자 · av 최근 본 판(같은 판 반복 줄이기) · ca 자동 시작 시각(서버 ms)
   · 방장이 나가면 ord에서 가장 먼저 들어온 사람이 방장(hv+1). 남은 사람이 1명이면 그 사람이 방장으로 방 유지(혼자서는 시작 못 함).
   · 판은 공용 대전 엔진(duelPrivate)으로 대전 방 'fl-d3-r-<코드>-<판>'에서 같은 순간 시작. 씨앗 = 방 + 판 번호 + 날짜.
   · 시작: 2명 이상 + 처음 판은 들어온 사람 모두 준비, 다음 판부터는 준비(한 판 더)한 사람끼리. 꽉 차고(다음 판부터는 남은 모두) 모두 준비면 3초 뒤 자동 시작.
   · 한 판 더 없이 3판 연속 쉬면 자동으로 방에서 나감(12절).
   게임 이름으로 나누지 않는다: 자기 방식 대전(duelLaunch)인 게임은 게임 정의에 duelRoom:true가 있을 때만 방(duelLaunch(o)로 방을 넘김). */
const RM_DIFF = ['easy', 'normal', 'hard'];
const RM_DNAME = { easy:'쉬움', normal:'보통', hard:'어려움' };
const RM_PTS = DUEL_TWO;   /* 2명 줄(결정 199) — 인원별 표는 duelPts(portal/duel-ui.js) */
const RM_HARD_LV = 5, RM_BAND = 5, RM_BONUS = DUEL_STRONG, RM_INV_GAP = 30000, RM_REST = 3, RM_AUTO = 3000;
const RM_CODE_A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/* 방 링크·방 QR(?room=)로 들어온 방 번호: readLink(start.js)가 주소를 지우기 전에 먼저 잡아 둔다 */
const RM_ARRIVE = (() => { try{ return String(new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }catch(_){ return ''; } })();
const rmLv = () => { try{ return lvInfo().L; }catch(_){ return 1; } };
const rmRec = L => L >= 12 ? 'hard' : L >= 5 ? 'normal' : 'easy';
const rmCanD = (d, L = rmLv()) => d !== 'hard' || L >= RM_HARD_LV;
const rmOk = id => !!(NG[id] && (!NG[id].duelLaunch || NG[id].duelRoom === true));   /* 동시에 푸는 게임 + 방을 받는 자기 방식 게임 */
const rmMax = id => duelMaxOf(id);
const rmNorm = id => String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const rmRelay = id => 'rm-' + String(id).toLowerCase();
const rmCodeFmt = c => (c = String(c || '')).length === 6 ? c.slice(0, 3) + ' ' + c.slice(3) : c;
/* 인원별 순위 보상 글: "1위 +450 · 2위 +270 · 3위 +150" (2명은 승/무/패) */
function rmPtsTxt(d, n){
  n = Math.max(2, Math.min(5, n | 0));
  if(n === 2){ const p = RM_PTS[d] || DUEL_PTS; return `승 +${p.w} · 무 +${p.d} · 패 +${p.l}`; }
  return Array.from({ length:n }, (_, i) => `${i + 1}위 +${duelPtsAt(n, i + 1, d)}`).join(' · ');
}
const rmChip = d => `<span class="dchip ${d}">${RM_DNAME[d] || '보통'}</span>`;
/* 게임이 정하는 방 선택 칸(게임 정의 roomOpt, 예: 고스톱 점당 금액). 방장이 고른 값 x가 방 광고·방장 presence·판 정보(info.x)로 간다 */
const rmRO = g => (NG[g] && NG[g].roomOpt) || null;
/* 게임 정의 duelNoPts: 대전 포인트·난이도 보상·레벨 제한이 없는 게임(예: 고스톱) → 방 화면에서 난이도·보상·레벨 칸을 숨기고 누구나 들어옴 */
const rmNoPts = g => !!(NG[g] && NG[g].duelNoPts);
const rmXChip = (g, x) => { const R = rmRO(g); if(!R || x == null) return ''; try{ return `<span class="dchip rmx">${escH(R.chip(x))}</span>`; }catch(_){ return ''; } };
const rmXWhy = (g, x) => { const R = rmRO(g); if(!R || !R.can || x == null) return ''; try{ return R.can(x) || ''; }catch(_){ return ''; } };
function rmUid(){ let u = store.get('hp:uid', ''); if(!u){ u = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store.set('hp:uid', u); } return u; }
const rmHash = code => code ? 'f' + (seedFrom('fr:' + code) >>> 0).toString(36) : '';
const rmVisible = () => store.get('hp:fronline', true) !== false;
const rmPlaying = () => !!(G && !G.over && $('#play') && $('#play').style.display === 'block');
const QR_IC = `<svg class="qric" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M6 6h1v1H6zM17 6h1v1h-1zM6 17h1v1H6zM14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" fill="currentColor" stroke="currentColor" stroke-width="1.6"/></svg>`;
const RM_CROWN = `<svg class="rmcrown" viewBox="0 0 32 24" width="16" height="12" aria-hidden="true"><path d="M3 7l6.5 6L16 3l6.5 10L29 7l-3 14H6z" fill="#FFC93C" stroke="#1A0F45" stroke-width="2.6" stroke-linejoin="round"/></svg>`;

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
    rm:c && c.host && !c.closed ? { i:c.id, g:c.g, d:c.d, b:c.b, pv:c.pv ? 1 : 0, n:Math.max(1, c.ord.length), c:c.cap, s:c.st === 'w' ? 'w' : 'p', t:c.t, x:c.x ?? null } : null,
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
    .map(p => Object.assign({ peer:p.peer, nk:String(p.presence.mn || '익명').slice(0, 12), lv:+p.presence.ml || 1, fh:p.presence.fh || '' }, p.presence.rm, { c:Math.max(2, Math.min(5, +p.presence.rm.c || 2)) }))
    .filter(r => RM_DIFF.includes(r.d));
}
const rmOpenAd = r => r.n < r.c && r.s === 'w';
const rmCount = g => rmAds(g).filter(rmOpenAd).length;
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
    if(L.ps.startsWith('r:') && L.rm && !L.rm.pv && L.rm.n < Math.max(2, +L.rm.c || 2) && L.rm.s === 'w') return { on:true, txt:`대전 방에서 기다리는 중 · ${gn} ${RM_DNAME[L.rm.d] || ''} ${L.rm.n}/${Math.max(2, +L.rm.c || 2)}`, room:L.rm };
    if(L.ps.startsWith('r:')) return { on:true, txt:'대전 방에 있어요' + (gn ? ' · ' + gn : '') };
    if(L.ps.startsWith('p:')) return { on:true, txt:'게임 중' + (gn ? ' · ' + gn : ''), busy:true };
    return { on:true, txt:'접속 중' };
  }
  const recent = f.seen && Date.now() - f.seen < 180000;
  return { on:false, recent, txt:f.seen ? agoTxt(f.seen) + ' 접속' : '' };
}
const frOnlineN = () => frLive().size;

/* ---------- 방 만들기 · 들어가기 · 나가기 ---------- */
function rmNewCode(){ let s = ''; for(let i = 0; i < 6; i++) s += RM_CODE_A[Math.random() * RM_CODE_A.length | 0]; return s; }   /* 문제 내용과 무관한 방 번호라 Math.random */
function rmMyPres(){ return { nk:myNick(), lv:rmLv(), u:rmUid() }; }
function rmHostPub(c, extra){
  if(!c || !c.host) return;
  c.nr.presence(Object.assign({ h:1, hv:c.hv, g:c.g, d:c.d, x:c.x ?? null, b:c.b, pv:c.pv ? 1 : 0, cap:c.cap, st:c.st, rd:c.rd, kick:c.kick.slice(-30), ord:c.ord.slice(0, 5), pl:c.pl || [], av:c.av || [], ca:c.ca || null }, extra || {})).catch(() => {});
}
async function rmCreate(o){
  if(RM.cur){ toast('이미 대전 방에 있어요'); rmOpen(); return false; }
  if(!duelLive()){ toast('지금은 실시간 연결이 안 돼요. 빠른 대전(컴퓨터)으로 겨뤄 보세요'); return false; }
  const L = rmLv(), id = rmNewCode(), mx = rmMax(o.g), me = rmUid();
  const c = { id, g:o.g, x:rmRO(o.g) && o.x != null ? o.x : null, d:rmCanD(o.d, L) ? o.d : 'normal', b:o.band === 'near' ? [Math.max(1, L - RM_BAND), L + RM_BAND] : null, pv:!!o.pv, cap:Math.max(2, Math.min(mx, +o.cap || mx)),
    host:true, hv:1, st:'w', rd:0, kick:[], ord:[me], pl:[], av:[], t:Date.now(), lastInv:{}, rdy:true, rv:0, rest:0, joinAt:Date.now() };
  let nr; try{ nr = await ROOM.join(rmRelay(id)); }catch(_){ toast('방을 만들지 못했어요. 잠시 뒤 다시 해 주세요'); return false; }
  c.nr = nr; RM.cur = c; duelFreeReset(id);
  nr.presence(Object.assign(rmMyPres(), { rdy:1, rv:0 })).catch(() => {});
  rmHostPub(c);
  c.un = nr.onPeers(() => rmSync(), () => rmLost());
  lbPush(); sfx('flLock');
  return c;
}
/* 방 들어가기: 방장이 보이면 확인(내보내짐·레벨·꽉 참·대전 중) 뒤 방 안으로. o = { invited, onErr(msg), quiet } */
async function rmJoin(id, o = {}){
  id = rmNorm(id);
  const err = msg => { if(o.onErr) o.onErr(msg); else { closeModal(); toast(msg); } };
  if(!id) return err('그런 방이 없어요. 코드를 다시 봐 주세요');
  if(RM.cur){ if(RM.cur.id === id){ rmOpen(); return; } toast('이미 다른 대전 방에 있어요. 먼저 나가 주세요'); rmOpen(); return; }
  if(!duelLive()) return err('실시간 연결이 안 돼요. 잠시 뒤 다시 해 주세요');
  if(!o.quiet) openModal(`<div class="rmwait"><span class="ds-radar"><i></i><i></i><i></i></span><p class="note">대전 방에 들어가는 중…</p></div>`);
  let nr; try{ nr = await ROOM.join(rmRelay(id)); }catch(_){
    await new Promise(r => setTimeout(r, 600));   /* 방금 나온 방이면 나가기가 끝난 뒤 한 번 더 */
    try{ nr = await ROOM.join(rmRelay(id)); }catch(_2){ return err('방에 들어가지 못했어요'); }
  }
  const me = rmUid();
  nr.presence(Object.assign(rmMyPres(), { rdy:0, rv:0, bye:0, iv:o.invited ? 1 : 0 })).catch(() => {});   /* bye:0 — 막혀서 나갔다 다시 들어올 때 지난 '나감' 표시가 남지 않게 */
  const t0 = Date.now();
  const host = await new Promise(res => { const iv = setInterval(() => { let h = null; try{ h = rmBestHost(nr.peers().filter(p => !p.sameTab)); }catch(_){} if(h || Date.now() - t0 > 4000){ clearInterval(iv); res(h); } }, 150); });
  const out = msg => { try{ nr.presence({ bye:1 }).catch(() => {}); }catch(_){} setTimeout(() => { try{ nr.leave(); }catch(_){} }, 100); err(msg); };
  if(!host) return out('그런 방이 없어요. 코드를 다시 봐 주세요');
  const H = host.presence, L = rmLv(), cap = Math.max(2, Math.min(5, +H.cap || 2)), ord = Array.isArray(H.ord) ? H.ord : [];
  if((H.kick || []).includes(me)) return out('이 방에서 내보내져서 들어갈 수 없어요');
  if(!o.invited && H.b && !rmNoPts(H.g) && (L < H.b[0] || L > H.b[1])) return out(`Lv ${H.b[0]}~${H.b[1]}만 들어갈 수 있는 방이에요`);
  if(!GAMES[H.g] || !rmOk(H.g)) return out('지금은 들어갈 수 없는 방이에요');
  if(H.st && H.st !== 'w' && !ord.includes(me)) return out('지금 대전 중이에요. 판이 끝나면 다시 눌러 주세요');
  if(ord.length >= cap && !ord.includes(me)) return out('방이 꽉 찼어요');
  { const why = rmXWhy(H.g, H.x); if(why) return out(why); }
  const c = RM.cur = { id, g:H.g, x:H.x ?? null, d:RM_DIFF.includes(H.d) ? H.d : 'normal', b:H.b || null, pv:!!H.pv, cap, host:false, hv:+H.hv || 0, st:H.st || 'w', rd:+H.rd || 0, kick:(H.kick || []).slice(), ord:ord.slice(), pl:[], av:[],
    t:Date.now(), nr, joinAt:Date.now(), hostSeen:Date.now(), hostU:H.u, hostNk:String(H.nk || '방장'), rdy:false, rv:0, rest:0, invited:!!o.invited, lastInv:{} };
  duelFreeReset(id);
  c.un = nr.onPeers(() => rmSync(), () => rmLost());
  sfx('flLock'); fxBuzz(15);
  lbPush(); rmOpen();
  return c;
}
function rmLeave(msg){
  const c = RM.cur; if(!c) return;
  RM.cur = null; RM.inv = [];
  if(c.dh) try{ c.dh.cancel(); }catch(_){}
  if(c.un) try{ c.un(); }catch(_){}
  try{ c.nr.presence({ bye:1, h:0 }).catch(() => {}); }catch(_){}
  setTimeout(() => { try{ c.nr.leave(); }catch(_){} }, 150);
  duelFreeReset('');
  lbPush(); rmPillRender();
  if(($('#rmRoom') || $('#dzRes')) && $('#veil').classList.contains('on')) closeModal();
  if(msg) toast(msg);
  if(typeof renderHome === 'function' && $('#home').style.display !== 'none') renderHome();
}
/* 연결이 오래 끊겨 방을 잃음 */
function rmLost(){ if(!RM.cur) return; if(rmPlaying() && G.duel && G.duel.room){ RM.cur.closed = true; return; } rmLeave('연결이 끊겨 대전 방에서 나왔어요'); }

/* ---------- 방 상태 맞추기(방장은 정하고, 나머지는 따른다) ---------- */
function rmPeers(c){ try{ return c.nr.peers(); }catch(_){ return []; } }
/* 방장이 둘 보이면(넘겨받는 사이): 방장 차례 번호가 큰 쪽, 같으면 기기 표식이 작은 쪽 */
function rmBestHost(ps){
  return ps.filter(p => p.presence && p.presence.h && p.presence.g && !p.presence.bye && p.presence.u)
    .sort((a, b) => (+b.presence.hv || 0) - (+a.presence.hv || 0) || (a.presence.u < b.presence.u ? -1 : 1))[0] || null;
}
/* 방 안 사람들(나 포함), 들어온 순서대로: { u, nk, lv, rdy, rv, me, host, seat } */
function rmMembers(c){
  if(!c) return [];
  const me = rmUid(), ps = rmPeers(c), by = {};
  ps.forEach(p => { const P = p.presence; if(!p.sameTab && P && P.u && !P.bye && !c.kick.includes(P.u)) by[P.u] = P; });
  const hostU = c.host ? me : c.hostU;
  const mine = { u:me, nk:myNick(), lv:rmLv(), rdy:!!c.rdy, rv:c.rv ? 1 : 0, me:true };
  const ord = c.ord.filter(u => u === me || by[u]);
  if(!ord.includes(me)) ord.push(me);
  return ord.slice(0, 5).map((u, i) => { const P = u === me ? mine : by[u];
    return { u, nk:String(P.nk || '?').slice(0, 12), lv:+P.lv || 1, rdy:!!P.rdy, rv:!!P.rv, me:u === me, host:u === hostU, seat:i }; });
}
function rmSync(){
  const c = RM.cur; if(!c) return;
  const me = rmUid(), now = Date.now(), ps = rmPeers(c);
  const live = ps.filter(p => !p.sameTab && p.presence && p.presence.u && !p.presence.bye && p.presence.u !== me);
  if(c.host){
    const other = rmBestHost(live.filter(p => (+p.presence.hv || 0) > c.hv || ((+p.presence.hv || 0) === c.hv && p.presence.u < me)));
    if(other){ c.host = false; c.hostU = other.presence.u; c.hostNk = String(other.presence.nk || '방장'); c.hostSeen = now; try{ c.nr.presence({ h:0 }).catch(() => {}); }catch(_){} rmRefreshViews(); return; }
    const us = live.filter(p => !c.kick.includes(p.presence.u)).map(p => p.presence.u);
    const ord = c.ord.filter(u => u === me || us.includes(u) || (c.st !== 'w' && (c.pl || []).includes(u)));
    if(!ord.includes(me)) ord.unshift(me);
    for(const u of us) if(!ord.includes(u) && ord.length < c.cap) ord.push(u);
    if(ord.join() !== c.ord.join()){
      const added = ord.filter(u => !c.ord.includes(u)), gone = c.ord.filter(u => !ord.includes(u));
      c.ord = ord; rmHostPub(c);
      if(added.length){ sfx('flPing'); fxBuzz([20, 30, 20]); }
      if(gone.length && c.st === 'w') toast('한 명이 방에서 나갔어요');
      lbPush();
    }
    /* 판이 끝났는데 상태가 남아 있으면 기다림으로 */
    if(c.st !== 'w' && (!c.dh || c.dh.dead) && !(rmPlaying() && G.duel && G.duel.room) && now - (c.goAt || 0) > 8000){ c.st = 'w'; rmHostPub(c); lbPush(); }
    rmAutoCheck(c);
  } else {
    const h = rmBestHost(live);
    if(h){
      const H = h.presence;
      if(c.hostU && c.hostU !== H.u && c.hostLost){ toast(`이제 ${String(H.nk || '방장').slice(0, 12)}님이 방장이에요`); sfx('flPing'); }
      c.hostLost = 0; c.hostSeen = now; c.hostU = H.u; c.hostNk = String(H.nk || '방장'); c.hostPeer = h.peer;
      if((H.kick || []).includes(me)){ rmLeave('방장이 방에서 내보냈어요'); return; }
      c.kick = (H.kick || []).slice(); c.ord = Array.isArray(H.ord) ? H.ord.slice(0, 5) : c.ord; c.hv = +H.hv || 0;
      c.cap = Math.max(2, Math.min(5, +H.cap || 2)); c.g = H.g || c.g; c.x = H.x ?? null; c.d = RM_DIFF.includes(H.d) ? H.d : c.d; c.b = H.b || null; c.pv = !!H.pv;
      if(!c.ord.includes(me) && now - c.joinAt > 2500 && c.ord.length >= c.cap){ rmLeave('방이 꽉 찼어요'); return; }
      c.st = H.st || 'w'; c.ca = typeof H.ca === 'number' ? H.ca : null;
      if((H.st === 'go' || H.st === 'p') && +H.rd > c.rd){
        const pl = Array.isArray(H.pl) ? H.pl : [];
        if(pl.includes(me)){ if(H.st === 'go') rmBegin(+H.rd, pl, H.av); }
        else if(c.ord.includes(me)){
          c.rd = +H.rd; c.rest = (c.rest | 0) + 1;
          if(c.rest >= RM_REST){ rmLeave(`${RM_REST}판 연속 쉬어서 방에서 나왔어요`); return; }
          toast('이번 판은 쉬어요 · 판이 끝나면 같이 해요');
        } else c.rd = +H.rd;
      }
    } else if(!(rmPlaying() && G.duel && G.duel.room)){
      /* 방장이 안 보임: 나가기(bye)는 바로, 끊김은 4초 뒤 → 들어온 순서가 가장 빠른 사람이 방장 */
      const bye = ps.some(p => p.presence && p.presence.u === c.hostU && p.presence.bye);
      if(!c.hostLost) c.hostLost = now;
      if(bye || now - c.hostSeen > 4000){
        const liveU = new Set(live.map(p => p.presence.u)); liveU.add(me);
        const nxt = c.ord.find(u => u !== c.hostU && liveU.has(u)) || [...liveU].sort()[0];
        if(nxt === me) rmPromote(c, live);
        else if(now - c.hostSeen > 20000){ rmLeave('방장이 나가서 방이 닫혔어요'); return; }
      }
    }
  }
  rmRefreshViews();
}
/* 방장 넘겨받기 */
function rmPromote(c, live){
  const me = rmUid(), liveU = new Set(live.map(p => p.presence.u));
  c.host = true; c.hv = (c.hv | 0) + 1; c.hostLost = 0;
  c.ord = c.ord.filter(u => u !== c.hostU && (u === me || liveU.has(u)));
  if(!c.ord.includes(me)) c.ord.unshift(me);
  for(const u of liveU) if(!c.ord.includes(u) && c.ord.length < c.cap) c.ord.push(u);
  c.hostU = me; c.st = 'w'; c.ca = null; c.autoAt = 0; c.t = Date.now();
  rmHostPub(c); lbPush();
  sfx('flPing'); fxBuzz([20, 30, 20]);
  toast('이제 내가 방장이에요 · 시작 버튼이 생겼어요');
}
/* 꽉 차고(다음 판부터는 남은 모두) 모두 준비면 3초 뒤 자동 시작. 그 사이 누가 준비를 풀면 멈춤 */
function rmAutoCheck(c){
  if(!c.host || c.st !== 'w') return;
  const mem = rmMembers(c), all = mem.length >= 2 && mem.every(m => m.rdy) && (mem.length >= c.cap || c.rd >= 1);
  if(!all){ if(c.autoAt){ c.autoAt = 0; c.ca = null; rmHostPub(c); } return; }
  if(!c.autoAt){ c.autoAt = Date.now() + RM_AUTO; c.ca = Math.round(netNow() + RM_AUTO); rmHostPub(c); sfx('flPing'); return; }
  if(Date.now() >= c.autoAt){ c.autoAt = 0; c.ca = null; rmStartGame(true); }
}
function rmReady(on){
  const c = RM.cur; if(!c) return;
  if(on && !HOST.canDuel({ again:true, room:c.id })) return;
  if(on){ const why = rmXWhy(c.g, c.x); if(why){ toast(why); return; } }
  c.rdy = !!on; c.rv = 0; c.nr.presence({ rdy:on ? 1 : 0, rv:0 }).catch(() => {});
  sfx(on ? 'flLock' : 'toggle'); rmRefreshViews();
}
/* 방장 [시작]: 2명 이상. 처음 판은 들어온 사람 모두 준비, 다음 판부터는 준비한 사람끼리 */
function rmStartGame(auto){
  const c = RM.cur; if(!c || !c.host || c.st !== 'w') return;
  const mem = rmMembers(c), others = mem.filter(m => !m.me), rdy = others.filter(m => m.rdy);
  if(!rdy.length){ if(!auto) toast(others.length ? '준비한 사람이 있어야 시작할 수 있어요' : '혼자서는 시작할 수 없어요 · 친구를 불러 보세요'); return; }
  if(c.rd === 0 && rdy.length < others.length){ if(!auto) toast('들어온 사람이 모두 준비하면 시작할 수 있어요'); return; }
  if(!HOST.canDuel({ again:true, room:c.id })) return;
  const pl = [rmUid(), ...rdy.map(m => m.u)].slice(0, c.cap), rd = c.rd + 1;
  c.st = 'go'; c.pl = pl; c.goAt = Date.now(); c.autoAt = 0; c.ca = null; c.av = duelSeenGet(c.g);
  rmHostPub(c, { rd });
  rmBegin(rd, pl, c.av);
}
/* 판 시작: 이번 판 사람들이 같은 대전 방에 들어가 공용 엔진으로 같은 순간 시작 */
function rmBegin(rd, pl, av){
  const c = RM.cur; if(!c || rd <= c.rd) return;
  const me = rmUid(), mem = rmMembers(c);
  c.rd = rd; c.rdy = false; c.rv = 0; c.rest = 0; c.pl = pl.slice(); c.goAt = Date.now();
  c.nr.presence({ rdy:0, rv:0 }).catch(() => {});
  const lvs = {}; mem.forEach(m => { if(pl.includes(m.u)) lvs[m.me ? myNick() : m.nk] = m.lv; });
  const name = 'fl-d3-r-' + c.id.toLowerCase() + '-' + rd;
  const room = { id:c.id, g:c.g, d:c.d, x:c.x ?? null, host:c.host, lvs, code:c.pv ? c.id : null, n:pl.length, rd };
  const fail = why => {
    c.dh = null;
    if(c.host){ c.st = 'w'; rmHostPub(c); }
    toast(why === 'start' ? '하트가 없어 시작하지 못했어요' : '함께 시작하지 못했어요. 다시 준비해 주세요');
    if(RM.cur === c) rmOpen();
  };
  if(NG[c.g].duelLaunch){   /* 자기 방식 대전(duelRoom:true): 방 정보를 넘겨 게임이 그 중계 방에서 시작 */
    closeModal();
    try{ NG[c.g].duelLaunch({ room:name, pl:pl.slice(), host:pl[0] === me, me, seed:name + ':' + dayKey(), again:rd > 1, pace:'n', n:pl.length, lv:c.d, nick:myNick(), info:room, onFail:fail }); }catch(e){ console.warn('duelLaunch', e); fail('join'); }
  } else {
    openModal(`<div class="rmwait"><span class="ds-radar"><i></i><i></i><i></i></span><p class="note">곧 시작해요 · ${pl.length}명이 같은 문제를 같은 순간에 풀어요</p></div>`);
    c.dh = duelPrivate(c.g, c.d, name, { nick:myNick(), n:pl.length, round:rd, avoid:Array.isArray(av) ? av : [], room, onFail:fail });
  }
  if(c.host) setTimeout(() => { if(RM.cur === c && c.st === 'go'){ c.st = 'p'; rmHostPub(c); lbPush(); } }, 1500);
  lbPush();
}
/* 판이 끝남(결과 창이 뜰 때): 방장은 방을 다시 대기로, 모두 '결과 보는 중' */
function rmAfterDuel(){
  const c = RM.cur; if(!c) return;
  c.dh = null; c.rv = 1; c.rdy = false;
  c.nr.presence({ rv:1, rdy:0 }).catch(() => {});
  if(c.host){ c.st = 'w'; rmHostPub(c); }
  if(c.closed) setTimeout(() => rmLeave('대전 방 연결이 끊겨 방에서 나왔어요'), 1500);
  lbPush();
}
/* 결과 창 [한 판 더] = 방으로 돌아가기 + 자동 준비 · [방으로] = 준비 없이 방으로 */
function rmAgain(){
  const c = RM.cur; goHome(); setTab('duel');
  if(!c){ toast('방이 닫혔어요'); return; }
  rmOpen(); rmReady(true);
}
function rmBack(){ const c = RM.cur; if(!c) return; c.rv = 0; c.nr.presence({ rv:0 }).catch(() => {}); rmOpen(); }
function rmKick(u){
  const c = RM.cur; if(!c || !c.host || c.st !== 'w') return;
  const m = rmMembers(c).find(x => x.u === u && !x.me); if(!m) return;
  const nk = escH(m.nk);
  openModal(`<h3>내보내기</h3><p class="note"><b>${nk}</b>님을 방에서 내보낼까요?<br>이 방이 닫힐 때까지 다시 들어올 수 없어요.</p>
    <div class="mbtns"><button class="b2" id="rkNo">취소</button><button class="b1 danger" id="rkYes">내보내기</button></div>`);
  $('#rkNo').onclick = rmOpen;
  $('#rkYes').onclick = () => {
    if(RM.cur !== c) return closeModal();
    c.kick.push(u); c.ord = c.ord.filter(x => x !== u);
    rmHostPub(c);
    toast(m.nk + '님을 내보냈어요'); sfx('toggle');
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
function rmLink(keepF){
  const c = RM.cur; if(!c) return '';
  const u = new URL(linkOf({ room:c.id })); if(!keepF) u.searchParams.delete('f'); return u.toString();   /* QR(얼굴 보고 초대)은 친구 코드도 넣어 들어오면 친구가 됨 */
}
/* 방 QR로 초대: 옆에 있는 친구가 폰 카메라로 찍으면 이 방으로 바로 들어옴(초대받은 사람이라 레벨 제한 없음 · 처음이면 친구도 맺어짐) */
function rmQrSheet(back){
  const c = RM.cur; if(!c){ frQrInvite(); return; }
  const url = rmLink(true), n = Math.max(1, c.ord.length);
  openModal(`<div class="rmqr" id="rmQr" style="--gc:${GCOL[c.g][1]}"><p class="kick">방 QR로 초대</p><h3>${GAMES[c.g].name}</h3>
    <p class="rmqr-m">${rmChip(c.d)}<span>${c.cap}명 방</span><span id="rqN">지금 ${n}/${c.cap}명</span></p>
    <div class="qrbox">${qrSvg(url, 5)}</div>
    <p class="rmqr-s">친구 폰 <b>카메라로 찍으면</b> 이 방으로 바로 들어와요<br><small>처음 온 친구는 하트 2개 선물 · 친구도 바로 맺어져요</small></p>
    <div class="rmcode sm"><span>방 코드</span><b class="num">${rmCodeFmt(c.id)}</b><button class="btn small secondary" id="rqCode">코드 복사</button></div>
    <div class="mbtns"><button class="b2" id="rqLink">링크 보내기</button><button class="b1" id="rqBack">방으로</button></div></div>`);
  $('#rqCode').onclick = rmCopyCode;
  $('#rqLink').onclick = rmShareLink;
  $('#rqBack').onclick = typeof back === 'function' ? back : rmOpen;
}
/* 친구 초대하기 → 방 QR: 방에 있으면 그 방 QR, 없으면 게임 고르기 → 방 만들기(비공개) → QR */
function frQrInvite(back){
  if(RM.cur){ rmQrSheet(); return; }
  if(!duelLive()){   /* 실시간이 안 되면 방 대신 친구 초대 QR */
    const url = linkOf({ i:1 });
    openModal(`<div class="rmqr" id="rmQr"><p class="kick">QR로 친구 초대</p><h3>하루퍼즐 리그</h3>
      <div class="qrbox">${qrSvg(url, 5)}</div>
      <p class="rmqr-s">지금은 실시간 연결이 안 돼서 대전 방 대신 <b>친구 초대 QR</b>이에요<br><small>친구 폰 카메라로 찍으면 바로 친구가 되고 하트 2개 선물</small></p>
      <div class="mbtns one"><button class="b2" id="rqBack">뒤로</button></div></div>`);
    $('#rqBack').onclick = typeof back === 'function' ? back : frHub;
    return;
  }
  const set = dayState().set, ids = GAME_IDS.filter(g => rmOk(g) && !isAdult(g)).sort((a, b) => (set.includes(b) ? 1 : 0) - (set.includes(a) ? 1 : 0));
  openModal(`<div class="frpickg"><p class="kick">방 QR로 초대</p><h3>어떤 게임 방을 열까요?</h3>
    <p class="note">방을 만들면 QR이 나와요. 옆에 있는 친구가 폰 카메라로 찍으면 바로 같은 방으로 들어와요.</p>
    <div class="gpick">${ids.map(g => `<button data-qg="${g}" style="--gc:${GCOL[g][1]}"><span class="g-art">${ART[g]()}</span><b>${GAMES[g].name}</b><em class="mx5">${duelMaxOf(g) > 2 ? duelMaxOf(g) + '명' : '2명'}</em>${set.includes(g) ? '<em class="tdy">오늘</em>' : ''}</button>`).join('')}</div>
    <div class="mbtns one"><button class="b2" id="qgBack">뒤로</button></div></div>`);
  $('#qgBack').onclick = typeof back === 'function' ? back : frHub;
  document.querySelectorAll('[data-qg]').forEach(b => b.onclick = () => rmCreateSheet(b.dataset.qg, { qr:true, pv:true, back:() => frQrInvite(back) }));
}
async function rmShareLink(){
  const c = RM.cur; if(!c) return;
  const url = rmLink(), text = `${myNick()}의 ${GAMES[c.g].name} 대전 방(${RM_DNAME[c.d]} · ${c.cap}명)으로 와! 방 코드 ${rmCodeFmt(c.id)}\n같은 문제, 다른 점수.`;
  try{ if(navigator.share){ await navigator.share({ title:'하루퍼즐 리그 대전 방', text, url }); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText(text + '\n' + url); toast('방 링크를 복사했어요. 카톡에 붙여 넣어 보내세요'); }catch(_){ toast(url); }
}
async function rmCopyCode(){
  const c = RM.cur; if(!c) return;
  let ok = false; try{ await navigator.clipboard.writeText(c.id); ok = true; }catch(_){}
  if(!ok){ try{ const ta = document.createElement('textarea'); ta.value = c.id; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); }catch(_){} }
  sfx('toggle'); toast(ok ? '방 코드를 복사했어요' : '방 코드 ' + rmCodeFmt(c.id));
}
function rmInviteSheet(){
  const c = RM.cur; if(!c) return;
  const live = frLive();
  const fs = FR.friends.slice().sort((a, b) => (live.has(b.fid) ? 1 : 0) - (live.has(a.fid) ? 1 : 0));
  const row = f => { const s = frStatus(f, live), wait = Date.now() - (c.lastInv[f.fid] || 0) < RM_INV_GAP;
    return `<div class="frrow${s.on ? ' on' : ''}"><span class="frav">${rivalAv({ name:f.fid })}${s.on ? '<i class="ondot"></i>' : ''}</span><span class="frn"><b>${escH(f.nick)}</b><small>${escH(s.txt || '')}</small></span>
      <button class="btn small ${s.on ? 'primary' : 'secondary'}" data-inv="${f.fid}" ${wait ? 'disabled' : ''}>${wait ? '보냄' : s.on ? '바로 초대' : '알림 보내기'}</button></div>`; };
  openModal(`<h3>친구 초대</h3><p class="note">${GAMES[c.g].name} · ${RM_DNAME[c.d]} · ${c.cap}명 방으로 불러요. 초대받은 친구는 레벨이 달라도 들어올 수 있어요.</p>
    <div class="rmcode sm"><span>방 코드</span><b class="num">${rmCodeFmt(c.id)}</b><button class="btn small secondary" id="riCode">코드 복사</button></div>
    <div class="frlist">${fs.length ? fs.map(row).join('') : `<p class="note">아직 친구가 없어요. 아래 링크나 방 코드를 보내거나, 친구 메뉴에서 친구를 먼저 맺어 보세요.</p>`}</div>
    <div class="riway"><button class="btn gold" id="riLink">${ic('share')} 방 링크 · 카톡</button><button class="btn secondary" id="riQr">${QR_IC} QR로 초대</button></div>
    <div class="mbtns one"><button class="b2" id="riBack">방으로</button></div>`);
  document.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { const f = FR.friends.find(q => q.fid === b.dataset.inv); if(f){ rmInviteFriend(f); rmInviteSheet(); } });
  $('#riLink').onclick = rmShareLink;
  $('#riQr').onclick = () => rmQrSheet(rmInviteSheet);
  $('#riCode').onclick = rmCopyCode;
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
      if(RM.cur && RM.cur.id === rmNorm(x.r)) continue;
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
  if(!rmOk(g)){   /* 방을 받지 않는 자기 방식 게임 */
    openModal(`<div class="rmlist"><p class="kick">대전</p><h3>${GAMES[g].name}</h3>
      <p class="note">이 게임은 <b>빠른 대전</b>으로 바로 붙어요.<br>대전 방은 다음 업데이트에서 열려요.</p>
      ${HOST.duelRewardHtml()}
      <div class="mbtns"><button class="b2" id="rlClose">닫기</button><button class="b1" id="rlQuick">빠른 대전 ${costTag()}</button></div></div>`);
    $('#rlClose').onclick = closeModal; $('#rlQuick').onclick = () => { closeModal(); gateThen(g, () => duelStart(g)); };
    return;
  }
  RM.listG = g;
  const L = rmLv(), rec = rmRec(L), mx = rmMax(g);
  const pt = d => mx > 2 ? `<b class="num">1위 ${duelTopTxt(d, mx)}</b><small>꼴찌 +${DUEL_LAST[d]}</small>` : `<b class="num">승 +${RM_PTS[d].w}</b><small>무 +${RM_PTS[d].d} · 패 +${RM_PTS[d].l}</small>`;
  openModal(`<div class="rmlist" id="rmList" style="--gc:${GCOL[g][1]}"><button class="mx" id="rlX" aria-label="닫기">✕</button>
    <div class="rmhead"><span class="g-art">${ART[g]()}</span><div><p class="kick">대전 방 · ${mx > 2 ? `2~${mx}명` : '1:1'}</p><h3>${GAMES[g].name}</h3></div></div>
    ${rmNoPts(g) ? `<p class="rmme">${escH((NG[g].duelNoPtsNote && NG[g].duelNoPtsNote()) || '대전 포인트가 없는 게임이에요')}</p>` : `<div class="rmpts">${RM_DIFF.map(d => `<div class="rmpt ${d}${rmCanD(d, L) ? '' : ' lock'}">${rmChip(d)}${d === rec ? '<em>추천</em>' : ''}${pt(d)}${rmCanD(d, L) ? '' : `<small class="lk">${ic('lock')}Lv ${RM_HARD_LV}부터</small>`}</div>`).join('')}</div>
    <div class="fchips rmf" role="group" aria-label="난이도로 거르기">${['all', ...RM_DIFF].map(f => `<button data-rf="${f}" class="${RM.listF === f ? 'on' : ''}">${f === 'all' ? '전체' : RM_DNAME[f]}</button>`).join('')}</div>`}
    <div class="rmrows" id="rmRows"></div>
    <p class="rmme">${rmNoPts(g) ? '' : `내 레벨 Lv ${L} · `}첫 판 ${ic('heart')}1 · 같은 방 3판 무료 · 방에서는 사람끼리만 붙어요</p>
    <div class="mbtns"><button class="b2" id="rlQuick">빠른 대전 ${costTag()}</button><button class="b1" id="rlMake">${RM.cur ? '내 방으로' : '방 만들기'}</button></div></div>`);
  $('#rlX').onclick = () => { RM.listG = ''; closeModal(); };
  $('#rlQuick').onclick = () => { if(RM.cur){ toast('대전 방에 있는 동안은 빠른 대전을 할 수 없어요'); return; } RM.listG = ''; closeModal(); gateThen(g, () => duelStart(g)); };
  $('#rlMake').onclick = () => { RM.listG = ''; if(RM.cur) rmOpen(); else rmCreateSheet(g); };
  document.querySelectorAll('[data-rf]').forEach(b => b.onclick = () => { RM.listF = b.dataset.rf; document.querySelectorAll('[data-rf]').forEach(x => x.classList.toggle('on', x === b)); rmListRender(); });
  rmListRender();
}
function rmListRender(){
  const box = $('#rmRows'), g = RM.listG; if(!box || !g) return;
  if(!duelLive()){ box.innerHTML = `<p class="rmempty">지금은 실시간 연결이 안 돼요.<br>빠른 대전을 누르면 컴퓨터와 겨뤄요.</p>`; return; }
  const L = rmLv(), fhs = new Set([...FR.friends].filter(f => f.code).map(f => rmHash(f.code)));
  let rs = rmAds(g).filter(r => rmNoPts(g) || RM.listF === 'all' || r.d === RM.listF);
  const can = r => rmOpenAd(r) && (rmNoPts(g) || !r.b || (L >= r.b[0] && L <= r.b[1])) && !(RM.cur && RM.cur.id === r.i) && !rmXWhy(g, r.x);
  rs.sort((a, b) => (can(b) - can(a)) || (fhs.has(b.fh) - fhs.has(a.fh)) || (Math.abs(a.lv - L) - Math.abs(b.lv - L)) || (a.t - b.t));
  const sig = JSON.stringify(rs.map(r => [r.i, r.n, r.c, r.s, r.d, r.nk, r.lv, r.x, rmXWhy(g, r.x)])) + L + RM.listF;
  if(box.dataset.sig === sig) return; box.dataset.sig = sig;
  if(!rs.length){ box.innerHTML = `<p class="rmempty">${RM.listF === 'all' ? '아직 열린 방이 없어요.' : RM_DNAME[RM.listF] + ' 방이 없어요.'}<br><b>방 만들기</b>로 첫 방을 열어 보세요.</p>`; return; }
  box.innerHTML = rs.map(r => {
    const ok = can(r), fr = fhs.has(r.fh), full = r.n >= r.c, why = r.s !== 'w' ? '대전 중' : full ? '꽉 참' : !rmNoPts(g) && r.b && (L < r.b[0] || L > r.b[1]) ? `Lv ${r.b[0]}~${r.b[1]}만` : rmXWhy(g, r.x) ? '포인트 부족' : '';
    const stc = r.s !== 'w' ? '<em class="rmstc off">대전 중</em>' : full ? '<em class="rmstc off">꽉 찼어요</em>' : '<em class="rmstc">기다리는 중</em>';
    return `<div class="rmrow${ok ? '' : ' off'}${fr ? ' fr' : ''}"><span class="frav">${rivalAv({ name:r.nk })}</span>
      <span class="rmrn"><b>${escH(r.nk)} ${rmNoPts(g) ? '' : `<em class="lvt">Lv ${r.lv}</em>`}${fr ? '<em class="frt">친구</em>' : ''}</b><small>${rmXChip(g, r.x)}${rmNoPts(g) ? '' : `${rmChip(r.d)}<span class="gp">1위 +${duelPtsAt(r.c, 1, r.d)}</span> · ${r.b ? `Lv ${r.b[0]}~${r.b[1]}` : '누구나'}`}</small></span>
      <span class="rmn"><b class="num">${r.n}/${r.c}</b>${stc}</span><button class="btn small ${ok ? 'primary' : 'secondary'}" data-rj="${r.i}" ${ok ? '' : 'disabled'}>${ok ? '들어가기' : why}</button></div>`;
  }).join('');
  box.querySelectorAll('[data-rj]').forEach(b => b.onclick = () => { RM.listG = ''; rmJoin(b.dataset.rj, { invited:false }); });
}

/* ---------- 화면: 방 만들기 ---------- */
function rmCreateSheet(g, o = {}){
  if(RM.cur){ rmOpen(); return; }
  const L = rmLv(), mx = rmMax(g); let d = rmCanD(o.d || rmRec(L), L) ? (o.d || rmRec(L)) : 'normal', band = o.band || 'near', pv = o.friend ? true : !!o.pv, cap = Math.max(2, Math.min(mx, +o.cap || mx));
  /* 게임이 정하는 칸(roomOpt): 기본값을 못 고르면(보유 포인트 부족 등) 고를 수 있는 것 중 가장 큰 값 */
  const RO = rmRO(g), xs = RO ? (typeof RO.opts === 'function' ? RO.opts() : RO.opts || []) : [];
  let x = RO ? (o.x != null ? o.x : RO.def) : null;
  if(RO && rmXWhy(g, x)){ const ok = xs.filter(v => !rmXWhy(g, v.v)); x = ok.length ? ok[ok.length - 1].v : (xs[0] ? xs[0].v : null); }
  const draw = () => {
    openModal(`<div class="rmmake" style="--gc:${GCOL[g][1]}"><p class="kick">${o.friend ? escH(o.friend.nick) + '님과 같이 하기' : o.qr ? '방 QR로 초대' : '방 만들기'}</p><h3>${GAMES[g].name}</h3>
      ${RO ? `<p class="rmlb">${escH(RO.label || '방 설정')}${RO.note ? ` <small class="rmxn">${escH(RO.note())}</small>` : ''}</p>
      <div class="rmxs" role="group" aria-label="${escH(RO.label || '방 설정')}">${xs.map(v => { const why = rmXWhy(g, v.v); return `<button class="rmxo${v.v === x ? ' on' : ''}" data-x="${v.v}" ${why ? 'disabled' : ''} aria-pressed="${v.v === x}"><b>${escH(v.name)}</b><small>${escH(why ? '포인트 부족' : v.sub || '')}</small></button>`; }).join('')}</div>` : ''}
      ${rmNoPts(g) ? '' : `<p class="rmlb">난이도 · 1위 보상</p>
      <div class="rmdiffs">${RM_DIFF.map(x => { const lk = !rmCanD(x, L); return `<button class="rmd ${x}${x === d ? ' on' : ''}${lk ? ' lock' : ''}" data-d="${x}" ${lk ? 'disabled' : ''}>${rmChip(x)}${x === rmRec(L) ? '<em>추천</em>' : ''}<b class="num">1위 +${duelPtsAt(cap, 1, x)}</b><small>${cap > 2 ? `꼴찌 +${DUEL_LAST[x]}` : `무 +${RM_PTS[x].d}<br>패 +${RM_PTS[x].l}`}</small>${lk ? `<small class="lk">${ic('lock')}Lv ${RM_HARD_LV}부터</small>` : ''}</button>`; }).join('')}</div>`}
      <p class="rmlb">정원</p>
      ${mx > 2 ? `<div class="rmcap" role="group" aria-label="정원">${Array.from({ length:mx - 1 }, (_, i) => i + 2).map(n => `<button data-cap="${n}" class="${n === cap ? 'on' : ''}" aria-pressed="${n === cap}">${n}명</button>`).join('')}</div>
        <p class="rmcapn">${cap}명이 모이면 1위 +${duelPtsAt(cap, 1, d)} · 꼴찌도 +${DUEL_LAST[d]}</p>` : '<p class="rmcapn">이 게임은 2명이 붙어요</p>'}
      ${o.friend ? '' : `${rmNoPts(g) ? '' : `<p class="rmlb">누가 들어오나</p>
      <div class="seg"><button data-b="near" class="${band === 'near' ? 'on' : ''}">내 레벨 근처<small>Lv ${Math.max(1, L - RM_BAND)}~${L + RM_BAND}</small></button><button data-b="all" class="${band === 'all' ? 'on' : ''}">누구나<small>레벨 상관없이</small></button></div>`}
      <label class="rmpv"><input type="checkbox" id="rmPv" ${pv ? 'checked' : ''}><span><b>비공개 방</b><small>목록에 안 보이고 초대·링크·방 코드로만 들어와요</small></span></label>`}
      <p class="rmme">${rmNoPts(g) ? '' : `강자 보너스: 나보다 ${RM_BAND}레벨 이상 높은 사람보다 높은 순위면 +${RM_BONUS}<br>`}첫 판 ${ic('heart')}1 · 같은 방 2~4판째 무료</p>
      <div class="mbtns"><button class="b2" id="rcBack">뒤로</button><button class="b1" id="rcGo">${o.friend ? '방 만들고 초대하기' : o.qr ? '방 만들고 QR 보기' : '방 만들기'}</button></div></div>`);
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { d = b.dataset.d; sfx('toggle'); draw(); });
    document.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { x = isNaN(+b.dataset.x) ? b.dataset.x : +b.dataset.x; sfx('toggle'); draw(); });
    document.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => { cap = +b.dataset.cap; sfx('toggle'); draw(); });
    document.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { band = b.dataset.b; draw(); });
    const pc = $('#rmPv'); if(pc) pc.onchange = () => { pv = pc.checked; };
    $('#rcBack').onclick = () => o.back ? o.back() : rmList(g);
    $('#rcGo').onclick = async () => {
      $('#rcGo').disabled = true;
      const c = await rmCreate({ g, d:rmNoPts(g) ? 'normal' : d, x, cap, band:o.friend || rmNoPts(g) ? 'all' : band, pv:o.friend ? true : pv });
      if(!c){ const b = $('#rcGo'); if(b) b.disabled = false; return; }
      if(o.friend) rmInviteFriend(o.friend);
      if(o.qr) rmQrSheet(); else rmOpen();
    };
  };
  draw();
}

/* ---------- 화면: 방 코드로 들어가기(대전 탭 "친구와 대전" 카드) ---------- */
function rmCodeSheet(pre){
  if(RM.cur){ rmOpen(); return; }
  openModal(`<div class="rmcodeq"><h3>방 코드로 들어가기</h3><p class="rmcq-s">친구에게 받은 6글자를 넣어요</p>
    <label class="rmcbox"><input id="rcIn" maxlength="14" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="방 코드 6글자" aria-describedby="rcErr">
      <span class="rmcells" aria-hidden="true">${Array.from({ length:6 }, (_, i) => `<i data-i="${i}"></i>`).join('')}</span></label>
    <p class="rmcq-n">I·O·0·1은 쓰지 않아요</p><p class="rmcerr" id="rcErr" role="alert"></p>
    <div class="mbtns rmfoot"><button class="b2" id="rcNo">취소</button><button class="b1" id="rcGo" disabled>들어가기</button></div></div>`);
  const inp = $('#rcIn'), err = $('#rcErr'), go = $('#rcGo');
  let busy = false;
  const val = () => inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const paint = () => {
    const v = val(); if(inp.value !== v) inp.value = v;
    document.querySelectorAll('.rmcells i').forEach((el, i) => { el.textContent = v[i] || ''; el.classList.toggle('cur', i === Math.min(5, v.length) && document.activeElement === inp); el.classList.toggle('on', !!v[i]); });
    go.disabled = v.length < 6 || busy;
  };
  const tryJoin = () => {
    const v = val(); if(v.length < 6 || busy) return;
    if([...v].some(ch => !RM_CODE_A.includes(ch))){ err.textContent = '그런 방이 없어요. 코드를 다시 봐 주세요'; sfx('toggle'); return; }
    busy = true; err.classList.remove('bad'); err.textContent = '대전 방에 들어가는 중…'; paint();
    rmJoin(v, { invited:true, quiet:true, onErr:m => { busy = false; if(!$('#rcErr')) return; err.classList.add('bad'); err.textContent = m; sfx('toggle'); paint(); } });
  };
  inp.oninput = () => { err.textContent = ''; paint(); if(val().length === 6) tryJoin(); };
  inp.onfocus = inp.onblur = paint;
  inp.onkeydown = e => { if(e.key === 'Enter') tryJoin(); };
  go.onclick = tryJoin;
  $('#rcNo').onclick = closeModal;
  if(pre){ inp.value = pre; }
  paint(); setTimeout(() => { try{ inp.focus(); }catch(_){} }, 60);
}

/* ---------- 화면: 방 안 ---------- */
function rmOpen(){
  const c = RM.cur; if(!c){ closeModal(); return; }
  if(c.rv){ c.rv = 0; c.nr.presence({ rv:0 }).catch(() => {}); }
  openModal(`<div class="rmroom" id="rmRoom" style="--gc:${GCOL[c.g][1]}"></div>`);
  $('#modal').classList.add('duelm', 'rmm');
  rmRoomRender(true);
  rmPillRender();
}
/* 자리 표식: 들어온 순서로 자리 번호, 내 화면에서는 나 = 언제나 분홍 원(자리 0과 내 자리를 바꿔 그림) */
function rmSeatOf(m, mine){ const s = m.me ? 0 : m.seat === 0 ? mine : m.seat; return DUEL_SEAT[s % 5]; }
function rmRoomRender(force){
  const c = RM.cur, box = $('#rmRoom'); if(!c || !box) return;
  const mem = rmMembers(c), me = mem.find(m => m.me) || { seat:0 }, n = mem.length, others = mem.filter(m => !m.me);
  const rdyN = mem.filter(m => m.rdy || (m.host && c.host && m.me)).length;
  const cd = c.ca ? Math.max(0, Math.ceil((c.ca - netNow()) / 1000)) : 0;
  const playing = c.st !== 'w', inPl = (c.pl || []).includes(rmUid());
  const sig = JSON.stringify([c.st, c.cap, c.host, c.rdy, cd, c.d, c.x, c.pv, mem.map(m => [m.u, m.nk, m.lv, m.rdy, m.rv, m.host]), Object.keys(c.lastInv).length]);
  if(!force && box.dataset.sig === sig) return; box.dataset.sig = sig;
  const tag = m => {
    if(playing && (c.pl || []).includes(m.u)) return '<span class="rdytag play">대전 중</span>';
    if(playing) return '<span class="rdytag">쉬는 중</span>';
    if(m.rv) return '<span class="rdytag rv">결과 보는 중</span>';
    if(m.rdy) return '<span class="rdytag on">준비 완료</span>';
    if(m.host) return '<span class="rdytag host">방장</span>';
    return '<span class="rdytag">준비 중…</span>';
  };
  const seatRow = m => { const S = rmSeatOf(m, me.seat);
    return `<div class="rmseat2${m.rdy ? ' rdy' : ''}${m.me ? ' me' : ''}">${duelShapeSvg(S.shape, S.col, 20)}<span class="frav">${m.me ? avatar({ me:true }) : rivalAv({ name:m.nk })}</span>
      <span class="rmsn"><b>${m.me ? '나' : escH(m.nk)}${m.host ? RM_CROWN : ''}</b><small>${rmNoPts(c.g) ? (m.host ? '방장' : '') : `Lv ${m.lv}${m.host ? ' · 방장' : ''}`}</small></span>${tag(m)}
      ${c.host && !m.me && c.st === 'w' ? `<button class="rmkick" data-kick="${m.u}" aria-label="${escH(m.nk)} 내보내기">내보내기</button>` : ''}</div>`; };
  const empty = i => { const S = DUEL_SEAT[i % 5];
    return `<div class="rmseat2 empty"><span class="rmeshape" style="--sc:${S.col}"></span><span class="frav"><i class="rmedot"></i></span><span class="rmsn"><b>빈자리</b><small>${c.pv ? '초대한 친구·방 코드로' : '방 목록에 보여요'}</small></span>
      ${c.host ? `<button class="btn small gold" data-inv2="1">초대</button>` : '<span class="rdytag">기다리는 중</span>'}</div>`; };
  const seats = Array.from({ length:c.cap }, (_, i) => mem[i] ? seatRow(mem[i]) : empty(i)).join('');
  const free = duelFreeNext(c.id), cost = free ? ' · 무료' : ' ' + costTag();
  const canGo = c.host && !playing && others.some(m => m.rdy) && (c.rd > 0 || others.every(m => m.rdy));
  const goN = 1 + others.filter(m => m.rdy).length;
  let status;
  if(playing) status = inPl ? '대전이 진행 중이에요' : '<b>이번 판은 쉬어요</b> · 판이 끝나면 같이 해요';
  else if(cd > 0) status = `<span class="rmcd">모두 준비! <b class="num">${cd}</b></span>`;
  else if(n < 2) status = '혼자서는 시작할 수 없어요 · 친구를 불러 보세요';
  else status = `${n}명 중 ${rdyN}명 준비 · ${c.host ? (canGo ? '시작을 누르세요' : c.rd > 0 ? '준비한 사람끼리 시작해요' : '모두 준비하면 시작') : n >= c.cap || c.rd > 0 ? '모두 준비하면 바로 시작' : '방장이 시작해요'}`;
  const main = c.host ? `<button class="b1" id="rmGo" ${canGo ? '' : 'disabled'}>시작 · ${goN}명${cost}</button>`
    : `<button class="b1${c.rdy ? ' on' : ''}" id="rmRdy" ${playing ? 'disabled' : ''}>${c.rdy ? '준비 취소' : '준비' + cost}</button>`;
  box.innerHTML = `<button class="mx" id="rmX" aria-label="방 창 접기">—</button>
    <p class="kick">대전 방${c.pv ? ' · 비공개' : ''}${c.b && !rmNoPts(c.g) ? ` · Lv ${c.b[0]}~${c.b[1]}` : ''}</p><h3>${GAMES[c.g].name}</h3>
    <div class="rmtags">${rmXChip(c.g, c.x)}${rmNoPts(c.g) ? '' : `${rmChip(c.d)}<span class="gp">${Math.max(2, n) > 2 ? `지금 ${n}명: ` : ''}${rmPtsTxt(c.d, Math.max(2, n))}</span>`}</div>
    ${c.pv ? `<div class="rmcode"><span>방 코드</span><b class="num">${rmCodeFmt(c.id)}</b><button class="btn small secondary" id="rmCopy">코드 복사</button></div>` : ''}
    <div class="rmseats2">${seats}</div>
    <p class="rmst">${status}</p>
    ${c.host && !playing ? `<button class="btn secondary block rminvbtn" id="rmInv">${ic('share')} 초대하기 · 친구 / 링크 / 코드</button>` : ''}
    <div class="mbtns rmfoot"><button class="b2" id="rmOut">나가기</button>${main}</div>`;
  $('#rmX').onclick = () => { closeModal(); rmPillRender(); };
  $('#rmOut').onclick = () => rmLeave('방에서 나왔어요');
  const go = $('#rmGo'); if(go) go.onclick = () => rmStartGame(false);
  const rd = $('#rmRdy'); if(rd) rd.onclick = () => rmReady(!c.rdy);
  box.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => rmKick(b.dataset.kick));
  box.querySelectorAll('[data-inv2]').forEach(b => b.onclick = rmInviteSheet);
  const i1 = $('#rmInv'); if(i1) i1.onclick = rmInviteSheet;
  const cp = $('#rmCopy'); if(cp) cp.onclick = rmCopyCode;
}
function rmRefreshViews(){ const qn = $('#rqN'); if(qn && RM.cur) qn.textContent = `지금 ${Math.max(1, RM.cur.ord.length)}/${RM.cur.cap}명`; if($('#rmRoom')) rmRoomRender(); if($('#rmRows')) rmListRender(); rmPillRender(); }
/* 방 창을 접었을 때 아래에 떠 있는 알약 */
function rmPillRender(){
  let el = $('#rmPill'); const c = RM.cur;
  const show = c && !rmPlaying() && $('#home').style.display !== 'none' && !($('#veil').classList.contains('on'));
  if(!show){ if(el) el.hidden = true; return; }
  if(!el){ el = document.createElement('button'); el.id = 'rmPill'; el.className = 'rmpill'; el.onclick = () => rmOpen(); document.body.appendChild(el); }
  const mem = rmMembers(c), n = mem.length;
  const txt = `${ic('duel')}<span><b>대전 방 · ${GAMES[c.g].name}</b><small>${RM_DNAME[c.d]} · ${n}/${c.cap} · ${c.st !== 'w' ? '대전 중' : c.rdy ? '준비 완료' : c.host ? (n > 1 ? '시작할 수 있어요' : '기다리는 중') : '준비를 눌러요'}</small></span><em>열기</em>`;
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
    <div class="frtop"><button class="btn gold" id="fhInv">${ic('share')} 친구 초대하기</button><button class="btn secondary" id="fhMng">코드 · 추가 · 삭제</button><button class="btn secondary frqr" id="fhQr">${QR_IC} 방 QR로 초대하기 <small>옆 친구가 찍으면 바로 같은 방</small></button></div>
    ${!duelLive() ? '<p class="note">실시간 연결이 안 돼서 접속 상태를 못 보고 있어요. 같이 하기는 알림함으로 보내져요.</p>' : ''}
    ${all.length ? `${on.length ? `<p class="frsec"><i class="ondot"></i>접속 중 ${on.length}</p><div class="frlist">${on.map(row).join('')}</div>` : '<p class="frsec">접속 중인 친구가 없어요</p>'}
      ${off.length ? `<p class="frsec">다른 친구 ${off.length}</p><div class="frlist">${off.map(row).join('')}</div>` : ''}`
      : `<p class="note">아직 친구가 없어요.<br>초대 링크를 보내면 들어오는 순간 친구가 돼요. 친구가 되면 접속 중인지 보이고, 원하는 게임으로 바로 같이 할 수 있어요.</p>`}
    <label class="frvis"><input type="checkbox" id="fhVis" ${rmVisible() ? 'checked' : ''}><span>내 접속 상태를 친구에게 보이기<small>끄면 바로 초대는 못 받고 알림함으로만 받아요</small></span></label></div>`);
  $('#fhX').onclick = closeModal;
  $('#fhInv').onclick = () => viralShare(cardInvite(), frHub);
  $('#fhMng').onclick = frManage;
  $('#fhQr').onclick = () => frQrInvite(frHub);
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
    <div class="gpick">${ids.map(g => `<button data-tg="${g}" style="--gc:${GCOL[g][1]}"><span class="g-art">${ART[g]()}</span><b>${GAMES[g].name}</b><em class="mx5">${duelMaxOf(g) > 2 ? duelMaxOf(g) + '명' : '2명'}</em>${set.includes(g) ? '<em class="tdy">오늘</em>' : ''}</button>`).join('')}</div>
    <div class="mbtns one"><button class="b2" id="tgBack">뒤로</button></div></div>`);
  $('#tgBack').onclick = frHub;
  document.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => rmCreateSheet(b.dataset.tg, { friend:f, back:() => frTogether(f) }));
}
/* 대전 탭 맨 위: 접속 중인 친구 줄 */
function duelFriendsHtml(){
  if(!FR.friends.length) return '';   /* 친구가 없으면 위 "친구와 대전" 카드가 대신(겹치지 않게) */
  if(false) return `<button class="dfr empty" id="dfrInv">${FR_G}<span><b>친구와 같이 대전하기</b><small>친구를 초대하면 접속 중인 친구가 여기 보여요</small></span>${ic('chev')}</button>`;
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
  const id = RM_ARRIVE;   /* 주소에서 먼저 잡아 둔 값(초대 링크라 readLink가 주소를 이미 지웠을 수 있음) */
  if(id){
    try{ const u = new URL(location.href); if(u.searchParams.has('room')){ u.searchParams.delete('room'); history.replaceState(history.state, '', u.toString()); } }catch(_){}
    let n = 0; const t = setInterval(() => {
      if(duelLive() && !($('#veil').classList.contains('on') && !$('#rmRoom'))){ clearInterval(t); rmJoin(id, { invited:true }); }
      else if(++n > 120){ clearInterval(t); if(!duelLive()) toast('실시간 연결이 안 돼서 대전 방에 못 들어갔어요'); }
    }, 500);
  }
}
