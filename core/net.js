/* 실시간 대전 서버 연결(모든 게임의 1:1 대전·함대 실시간 포격전이 함께 씀) */
/* ----- 실시간 대전: room(지금 이 페이지를 연 사람들). 없으면 AI로 ----- */
let ROOM = null, ROOM_STATE = 'pending';
/* 대전 서버(Railway). Claude 링크에서는 Claude의 room을, 그 밖(GitHub Pages 등)에서는 이 서버를 쓴다. */
const BATTLE_WS = 'wss://battle-production-c11b.up.railway.app/ws';
/* 대전 서버 연결. 휴대폰(특히 카카오톡 인앱 브라우저)은 화면을 끄거나 앱을 오가면 연결이 자주 끊긴다.
   - 끊겨도 대전 방을 바로 버리지 않고 곧장 다시 연결해 같은 방에 다시 들어간다(20초까지 기다림).
   - 다시 연결되면 모든 방에 다시 들어가고 내 presence를 다시 보낸다(서버는 새 연결마다 방을 새로 만듦).
   - 서버 오류(err)·입장 시간 초과는 바로 실패로 알리고, 시간 초과된 방은 서버에서도 나간다.
   - 응답이 45초 없으면 반쯤 죽은 연결로 보고 다시 연결한다. 화면이 다시 보이거나 온라인이 되면 바로 다시 연결.
   - 첫 연결이 7초를 넘겨도 계속 시도하고, 나중에 연결되면 onLate로 알린다. */
function netRoomConnect(url, onLate){
  return new Promise((resolve, reject) => {
    let ws = null, you = null, first = true, retry = 0, offset = 0, pingT = 0, lastMsg = 0, reT = 0, downAt = 0, ready = false;
    const rooms = new Map(); // name -> {peers, pres, subs:Set, errs:Set, waiters:[], joined}
    const isOpen = () => ws && ws.readyState === 1 && you;
    const send = m => { try{ if(ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }catch(_){} };
    const st = name => { let s = rooms.get(name); if(!s){ s = { peers:[], pres:{}, subs:new Set(), errs:new Set(), waiters:[], joined:false }; rooms.set(name, s); } return s; };
    function api(name, isLobby){
      const s = st(name);
      return {
        get clockOffset(){ return offset; },
        get connected(){ return !!isOpen(); },
        peers: () => s.peers.map(p => ({ peer:p.peer, presence:p.presence, sameTab:p.peer === you })),
        presence: obj => { Object.assign(s.pres, obj); send({ t:'p', r:name, p:obj }); return Promise.resolve(); },
        onPeers: (cb, err) => { s.subs.add(cb); if(err) s.errs.add(err); return () => { s.subs.delete(cb); if(err) s.errs.delete(err); }; },
        join: sub => new Promise((res, rej) => {
          const ss = st(sub); ss.pres = {}; ss.joined = false;
          const w = { ok:() => { clearTimeout(tm); res(api(sub, false)); }, fail:e => { clearTimeout(tm); rej(e); } };
          const tm = setTimeout(() => {   /* 시간 초과: 서버에 늦게 들어가 남지 않게 나가기까지 */
            ss.waiters = ss.waiters.filter(x => x !== w); send({ t:'leave', r:sub }); if(!ss.joined) rooms.delete(sub); rej(new Error('join timeout'));
          }, 8000);
          ss.waiters.push(w);
          if(isOpen()) send({ t:'join', r:sub }); else kick();   /* 끊겨 있으면 다시 연결 후 자동으로 들어감 */
        }),
        leave: () => { if(isLobby) return; send({ t:'leave', r:name }); rooms.delete(name); },
      };
    }
    /* 지금 연결을 버리고 바로 새로 연결(닫힘 신호를 기다리지 않음: 휴대폰의 반쯤 죽은 연결은 닫힘이 늦게 옴) */
    function restart(){
      const old = ws; ws = null; you = null; if(!downAt) downAt = Date.now();
      if(old){ old.onclose = old.onmessage = old.onerror = null; try{ old.close(); }catch(_){} }
      const lob = rooms.get('lobby'); if(lob) lob.peers = [];
      retry = 0; open();
    }
    function kick(){ if(ws && (ws.readyState === 0 || ws.readyState === 1)) return; clearTimeout(reT); retry = 0; open(); }
    function open(){
      clearTimeout(reT);
      try{ ws = new WebSocket(url); }catch(e){ if(first){ first = false; reject(e); } reT = setTimeout(open, 5000); return; }
      const me = ws;
      ws.onmessage = ev => {
        if(ws !== me) return;
        lastMsg = Date.now();
        let m; try{ m = JSON.parse(ev.data); }catch(_){ return; }
        if(m.t === 'pong'){ if(typeof m.now === 'number' && pingT){ offset = m.now - (pingT + Date.now()) / 2; pingT = 0; } return; }
        if(m.t === 'hello'){
          you = m.you; retry = 0; downAt = 0;
          if(typeof m.now === 'number') offset = m.now - Date.now();
          pingT = Date.now(); send({ t:'ping' });
          st('lobby');
          for(const [name, s] of rooms){   /* 대기실·대전 방 모두 다시 들어가고 내 정보 다시 보내기 */
            send({ t:'join', r:name });
            if(Object.keys(s.pres).length) send({ t:'p', r:name, p:s.pres });
          }
          if(first){ first = false; ready = true; resolve(api('lobby', true)); }
          else if(!ready){ ready = true; if(onLate) try{ onLate(api('lobby', true)); }catch(_){} }
          return;
        }
        if(m.t === 'err'){
          const s = rooms.get(m.r);
          if(m.e === 'too many rooms'){ restart(); return; }   /* 서버에 남은 방 정리: 새 연결로 다시 들어감 */
          if(s && !s.joined && s.waiters.length){ const w = s.waiters.splice(0); w.forEach(x => x.fail(new Error(m.e || 'err'))); rooms.delete(m.r); }
          return;
        }
        if(m.t === 'peers' && rooms.has(m.r)){
          const s = rooms.get(m.r); s.peers = m.peers || []; s.joined = true;
          const w = s.waiters.splice(0); w.forEach(x => x.ok());
          const ch = { joined:m.joined || [], left:m.left || [] };
          s.subs.forEach(cb => { try{ cb(ch); }catch(_){} });
        }
      };
      ws.onclose = () => {
        if(ws !== me) return;
        you = null;
        if(!downAt) downAt = Date.now();
        const lob = rooms.get('lobby'); if(lob) lob.peers = [];
        reT = setTimeout(open, Math.min(8000, 800 * (++retry)));
      };
      ws.onerror = () => {};
    }
    open();
    /* 첫 연결이 7초 안에 안 되면 일단 실패로 알림(AI로), 연결은 계속 시도 → 되면 onLate */
    setTimeout(() => { if(first){ first = false; reject(new Error('timeout')); } }, 7000);
    /* 살아 있는지 확인 · 오래 끊긴 대전 방 정리 */
    setInterval(() => {
      if(isOpen()){
        if(lastMsg && Date.now() - lastMsg > 45000){ restart(); return; }
        pingT = Date.now(); send({ t:'ping' });
      }
    }, 15000);
    setInterval(() => {
      if(!downAt || Date.now() - downAt < 20000) return;
      for(const [name, s] of rooms){ if(name !== 'lobby'){ s.errs.forEach(f => { try{ f(); }catch(_){} }); s.waiters.splice(0).forEach(x => x.fail(new Error('offline'))); rooms.delete(name); } }
    }, 1000);
    const wake = () => { if(!document.hidden) kick(); };
    document.addEventListener('visibilitychange', wake); addEventListener('online', kick); addEventListener('pageshow', wake); addEventListener('focus', wake);
  });
}
/* 연결 시작: 대전을 쓰는 화면에서만 부른다(사이트는 시작할 때, 붙여 쓰는 모듈은 대전을 켰을 때) */
function netStart(){
try{
  const useNet = () => {
    if(BATTLE_WS.includes('__')){ ROOM_STATE = 'none'; return; }
    netRoomConnect(BATTLE_WS, r => { if(!ROOM){ ROOM = r; ROOM_STATE = 'ok'; } })
      .then(r => { ROOM = r; ROOM_STATE = 'ok'; }).catch(() => { if(!ROOM) ROOM_STATE = 'none'; });
  };
  if(window.claude && typeof window.claude.use === 'function') window.claude.use('room').then(r => { if(r){ ROOM = r; ROOM_STATE = 'ok'; } else useNet(); }).catch(useNet);
  else useNet();
}catch(_){ ROOM_STATE = 'none'; }
}
/* 서버 시각(두 기기가 같은 시각을 보도록) */
const netNow = () => Date.now() + ((ROOM && ROOM.clockOffset) || 0);
/* 지금 연결돼 있나(Claude room은 항상 연결된 것으로 봄) */
const netUp = () => !!ROOM && ROOM.connected !== false;
