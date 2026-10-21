// 재현: 4명 친구 대전, 2명이 핸드 도중 '조용히' 끊김(휴대폰 화면 꺼짐 — 소켓이 응답을 멈춤). 그 뒤 판이 어떻게 흘러가는지
const path = require('path');
const REPO = path.resolve(process.argv[2]); const PORT = Number(process.argv[3]);
const WebSocket = require(path.join(REPO, 'node_modules/ws'));
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const tk = (await (await fetch(BASE + '/admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'simpw' }) })).json()).token;
  await fetch(BASE + '/admin/api/settings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': tk }, body: JSON.stringify({ autoApprove: true, welcomeChips: 1000000 }) });
  const mk = async (name) => {
    const c = { name, msgs: [], kicked: null, noRoom: 0, silent: false };
    c.ws = new WebSocket(BASE.replace('http', 'ws') + '/ws');
    c.ws.on('message', (d) => {
      if (c.silent) return;
      const m = JSON.parse(d);
      if (m.t === 'me') c.me = m; if (m.t === 'room') c.room = m; if (m.t === 'kicked') c.kicked = m.msg; if (m.t === 'noRoom') c.noRoom++;
      if (m.t === 'state') {
        c.state = m;
        const v = m.view;
        if (v.legal && !c.silent) { const k = v.hk + v.actionSeq; if (c.k !== k) { c.k = k; setTimeout(() => c.ws.send(JSON.stringify({ t: 'act', type: v.legal.canCheck ? 'check' : 'call' })), 20); } }
      }
    });
    await new Promise((r) => c.ws.once('open', r));
    c.ws.send(JSON.stringify({ t: 'login', name, pin: '1234' }));
    await sleep(150); c.ws.send(JSON.stringify({ t: 'enterReq' })); await sleep(150);
    return c;
  };
  const tag = Date.now().toString(36).slice(-4);
  const cs = [];
  for (let i = 0; i < 4; i++) cs.push(await mk('p' + i + tag));
  cs[0].ws.send(JSON.stringify({ t: 'create', bb: 100, minIn: 2000, buyIn: 10000 }));
  await sleep(200);
  const code = cs[0].room.code;
  cs[0].ws.send(JSON.stringify({ t: 'setBots', on: false }));
  for (const c of cs.slice(1)) c.ws.send(JSON.stringify({ t: 'join', code, buyIn: 10000 }));
  await sleep(300);
  cs[0].ws.send(JSON.stringify({ t: 'start' }));
  await sleep(1500);
  // 2명이 조용히 끊김: 소켓을 멈춰 핑에 답하지 않음(전화 화면 잠금과 같음)
  for (const c of cs.slice(2)) { c.silent = true; c.ws._socket.pause(); }
  const h0 = cs[0].state.view.handNo;
  await sleep(Number(process.argv[4] || 12000));
  const v = cs[0].state.view;
  const names = Object.fromEntries(cs.map((c) => [c.me.pid, c.name]));
  console.log(JSON.stringify({ handsPlayedAfterDrop: v.handNo - h0, players: v.players.filter((p) => !p.isBot && !p.empty).map((p) => ({ n: names[p.id] || p.id, stack: p.stack, away: p.away, last: p.lastAction && p.lastAction.type })), roomMembers: cs[0].room.members.map((m) => m.name + (m.online ? '' : '(끊김)')) }, null, 1));
  // 끊겼던 사람이 돌아오면?
  const back = cs[2];
  back.ws.terminate(); back.silent = false;
  const nb = new WebSocket(BASE.replace('http', 'ws') + '/ws');
  const got = [];
  nb.on('message', (d) => got.push(JSON.parse(d).t));
  await new Promise((r) => nb.once('open', r));
  nb.send(JSON.stringify({ t: 'login', name: back.name, pin: '1234' }));
  await sleep(600);
  console.log('돌아온 사람이 받은 메시지:', [...new Set(got)].join(','));
  process.exit(0);
})();
