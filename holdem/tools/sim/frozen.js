// 앱이 뒤로 간 휴대폰 흉내: 소켓은 살아 있고 망 단 pong은 자동 응답하지만, 화면(JS)은 아무 메시지도 안 보냄
const path = require('path'); const REPO = process.argv[2], PORT = process.argv[3];
const WebSocket = require(path.join(REPO, 'node_modules/ws'));
const B = 'http://127.0.0.1:' + PORT; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const tk = (await (await fetch(B + '/admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":"simpw"}' })).json()).token;
  await fetch(B + '/admin/api/settings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': tk }, body: '{"autoApprove":true,"turnSec":60}' });
  const mk = async (name, live) => {
    const c = { name }; c.ws = new WebSocket(B.replace('http', 'ws') + '/ws');
    c.ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'me') c.me = m; if (m.t === 'room') c.room = m; if (m.t === 'state') { c.state = m; const v = m.view; if (live && v.legal && c.k !== v.hk + v.actionSeq) { c.k = v.hk + v.actionSeq; c.ws.send(JSON.stringify({ t: 'act', type: v.legal.canCheck ? 'check' : 'call' })); } } });
    c.ws.on('close', () => { c.closedAt = Date.now(); });
    await new Promise((r) => c.ws.once('open', r));
    c.ws.send(JSON.stringify({ t: 'login', name, pin: '1234' })); await sleep(150); c.ws.send(JSON.stringify({ t: 'enterReq' })); await sleep(150);
    if (live) c.pinger = setInterval(() => c.ws.readyState === 1 && c.ws.send('{"t":"ping"}'), 400);   // 살아 있는 화면은 ping(가속 서버 기준 8초)
    return c;
  };
  const tag = Date.now().toString(36).slice(-4);
  const A = await mk('fa' + tag, true), Z = await mk('fz' + tag, false);
  A.ws.send(JSON.stringify({ t: 'create', bb: 100, minIn: 2000, buyIn: 10000 })); await sleep(200);
  A.ws.send(JSON.stringify({ t: 'setBots', on: false }));
  Z.ws.send(JSON.stringify({ t: 'join', code: A.room.code, buyIn: 10000 })); await sleep(200);
  A.ws.send(JSON.stringify({ t: 'start' }));
  const t0 = Date.now();
  // Z는 이제 아무것도 안 보냄(ws 라이브러리가 망 단 pong만 자동 응답)
  for (let i = 0; i < 40; i++) { await sleep(250); const zp = A.state && A.state.view.players.find((p) => p.id === Z.me.pid); if (Z.closedAt && zp && zp.off) break; }
  const zp = A.state && A.state.view.players.find((p) => p.id === Z.me.pid);
  console.log(JSON.stringify({ 서버가끊음: !!Z.closedAt, 걸린시간_실제초: Z.closedAt ? ((Z.closedAt - t0) / 1000 / 0.05).toFixed(0) : null, 상대화면_연결끊김표시: zp ? !!zp.off : '자리없음(이미 빠짐)' }));
  // A(살아 있는 화면)는 끊기면 안 됨
  await sleep(4000);
  console.log(JSON.stringify({ 살아있는사람_끊김여부: !!A.closedAt }));
  process.exit(0);
})();
