// 서버 흐름 점검(실제 서버를 임시 포트·임시 데이터 폴더로 띄워 웹소켓으로 확인). 사용: node test/server.test.js
// ① 같은 계정 2중 접속: 옛 연결은 reason:'dup'로 끊기고 새 연결만 남음 ② 재접속해도 내 차례 남은 시간이 이어짐(초기화 안 됨)
// ③ 같은 차례에 행동을 두 번 보내면 둘째는 버려짐, 옛 행동 번호(seq)는 무시 ④ 너무 큰 프레임을 보내도 서버가 죽지 않음
// ⑤ 대기실에 10명 넘게 앉을 수 없음
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
const assert = require('assert');
const WebSocket = require('ws');

const PORT = 4900 + Math.floor(Math.random() * 90);
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-test-'));
fs.writeFileSync(path.join(DIR, 'db.json'), JSON.stringify({ tenants: { main: { id: 'main', name: '본사', slug: '', domains: [], active: true, settings: { welcomeChips: 100000, buyIn: 10000, minBuyIn: 1000, autoApprove: true, testPin: '1234', turnSec: 15 } } }, accounts: {}, sessions: {}, logs: [], daily: {}, seq: 1 }));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DIR, ADMIN_PASSWORD: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const open = (token) => new Promise((res, rej) => { const ws = new WebSocket('ws://localhost:' + PORT + '/ws'); ws.msgs = []; ws.on('error', rej); ws.on('message', (d) => { const m = JSON.parse(d); ws.msgs.push(m); if (ws.onm) ws.onm(m); }); ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', token })); res(ws); }); });
const wait = (ws, pred, ms = 8000) => new Promise((res, rej) => { const hit = ws.msgs.find(pred); if (hit) return res(hit); const t = setTimeout(() => rej(new Error('timeout: ' + pred)), ms); ws.onm = (m) => { if (pred(m)) { clearTimeout(t); ws.onm = null; res(m); } }; });
const J = (ws, m) => ws.send(JSON.stringify(m));
const login = async (name) => { const ws = await open(null); J(ws, { t: 'login', name, pin: '1234' }); const s = await wait(ws, (m) => m.t === 'session'); J(ws, { t: 'enterReq' }); await wait(ws, (m) => m.t === 'me' && m.approved); return [ws, s.token]; };
let n = 0;
const t = async (name, fn) => { try { await fn(); n++; console.log('  ok', name); } catch (e) { console.error('  FAIL', name, '\n', e && e.stack); console.error(out.slice(-2000)); srv.kill(); process.exit(1); } };

(async () => {
  for (let i = 0; i < 50; i++) { try { await new Promise((res, rej) => { const c = net.connect(PORT, '127.0.0.1', () => { c.destroy(); res(); }); c.on('error', rej); }); break; } catch (e) { await sleep(100); } }

  await t('큰 프레임(4096바이트 초과)에도 서버가 살아 있음', async () => {
    await new Promise((res) => {
      const s = net.connect(PORT, '127.0.0.1', () => s.write('GET /ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n'));
      s.once('data', () => { const len = 8000; const h = Buffer.from([0x81, 0x80 | 127, 0, 0, 0, 0, 0, 0, (len >> 8) & 255, len & 255]); s.write(Buffer.concat([h, Buffer.from([1, 2, 3, 4]), Buffer.alloc(len, 0x41)])); setTimeout(() => { s.destroy(); res(); }, 400); });
      s.on('error', () => res());
    });
    await sleep(300);
    assert.strictEqual(srv.exitCode, null, '서버가 죽음');
    const ws = await open(null); ws.close();
  });

  let token, me;
  await t('내 차례 중 재접속해도 남은 시간이 이어짐', async () => {
    const [ws, tk] = await login('점검A'); token = tk;
    J(ws, { t: 'solo', bb: 100, buyIn: 10000 });
    const st = await wait(ws, (m) => m.t === 'state' && m.view.legal, 20000);
    me = st.view.players.find((p) => p.hole && p.hole[0] !== '??').id;
    await sleep(2500);
    const ws2 = await open(token); J(ws2, { t: 'enterReq' });
    const st2 = await wait(ws2, (m) => m.t === 'state' && m.view.legal, 8000);
    assert(st2.deadline <= st.deadline - 2000, `재접속 뒤 남은 시간 ${st2.deadline} (처음 ${st.deadline}) — 초기화됨`);
    // 옛 연결은 dup으로 끊김
    const k = await wait(ws, (m) => m.t === 'kicked', 3000);
    assert.strictEqual(k.reason, 'dup');
    global.ws2 = ws2; global.st2 = st2;
  });

  await t('같은 차례에 행동 2번 → 둘째는 버려짐, 옛 seq는 무시', async () => {
    const ws2 = global.ws2, st2 = global.st2;
    const seq = st2.view.actionSeq;
    J(ws2, { t: 'act', type: 'call', seq }); J(ws2, { t: 'act', type: 'call', seq });
    await sleep(600);
    const a1 = ws2.msgs.filter((m) => m.t === 'state').pop();
    const mine = a1.view.players.find((p) => p.id === me);
    assert.strictEqual(mine.lastAction.type, 'call');
    assert(!mine.folded);
    J(ws2, { t: 'act', type: 'fold', seq: seq - 1 });
    await sleep(400);
    const a2 = ws2.msgs.filter((m) => m.t === 'state').pop();
    assert(!a2.view.players.find((p) => p.id === me).folded, '옛 seq의 폴드가 실행됨');
    ws2.close();
  });

  await t('대기실은 9명까지만 들어올 수 있음', async () => {
    const [host] = await login('방장');
    J(host, { t: 'create', bb: 100, minIn: 1000, fillBots: false, buyIn: 5000 });
    const room = await wait(host, (m) => m.t === 'room');
    const socks = [];
    for (let i = 0; i < 9; i++) {
      const [w] = await login('손님' + i); socks.push(w);
      J(w, { t: 'join', code: room.code, buyIn: 5000 });
      await wait(w, (m) => m.t === 'room' || m.t === 'error');
    }
    const last = socks[8];
    assert(last.msgs.some((m) => m.t === 'error' && /가득/.test(m.msg)), '9명이 찬 방에 더 들어와짐: ' + JSON.stringify(last.msgs.slice(-2)));
    [host, ...socks].forEach((w) => w.close());
  });

  console.log('OK', n, 'server tests');
  srv.kill(); setTimeout(() => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { /* */ } process.exit(0); }, 300);
})().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
