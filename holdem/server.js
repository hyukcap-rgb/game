/* 로열 홀덤 — 서버 (정적 파일 + 실시간 대전 + 오늘의 토너먼트) */
'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const H = require('./public/engine');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const START_STACK = 10000;
const DAILY_HANDS = Number(process.env.DAILY_HANDS) || 30;
const TURN_MS = 25000;
const AWAY_MS = 4000;
const LEVELS = [[50, 100], [100, 200], [200, 400], [300, 600], [500, 1000], [1000, 2000], [2000, 4000]];
const levelFor = (handNo) => LEVELS[Math.min(LEVELS.length - 1, Math.floor(handNo / 10))];
const BOTS = [
  { name: '김영감', style: 'rock', avatar: 0 },
  { name: '샤크', style: 'shark', avatar: 1 },
  { name: '해피', style: 'fish', avatar: 2 },
  { name: '폭주핑크', style: 'maniac', avatar: 3 },
  { name: '에이스', style: 'pro', avatar: 4 },
  { name: '레드', style: 'pro', avatar: 5 },
];
const EMOTES = new Set(['👍', '😂', '😱', '😡', '🔥']);

// ---------- 저장 (오늘의 토너먼트 기록) ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
const LB_FILE = path.join(DATA_DIR, 'daily.json');
let LB = {};
try { LB = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')); } catch (e) { LB = {}; }
let saveT = null;
function saveLB() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const keys = Object.keys(LB).sort();
    while (keys.length > 14) delete LB[keys.shift()];
    fs.writeFile(LB_FILE + '.tmp', JSON.stringify(LB), (err) => {
      if (!err) fs.rename(LB_FILE + '.tmp', LB_FILE, () => {});
    });
  }, 300);
}
const kstDate = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
function dayBoard(date) { return (LB[date] = LB[date] || { entries: {} }); }
function ranking(date) {
  const d = dayBoard(date);
  return Object.entries(d.entries)
    .filter(([, e]) => e.score != null)
    .sort((a, b) => b[1].score - a[1].score || a[1].at - b[1].at)
    .map(([token, e]) => ({ token, ...e }));
}
function dailyInfo(token) {
  const date = kstDate();
  const list = ranking(date);
  const myIdx = token ? list.findIndex((e) => e.token === token) : -1;
  const entry = token ? dayBoard(date).entries[token] : null;
  return {
    date, total: list.length,
    played: !!entry,
    my: myIdx >= 0 ? { score: list[myIdx].score, rank: myIdx + 1 } : (entry ? { score: entry.score || 0, rank: '-' } : null),
    top: list.slice(0, 20).map((e) => ({ name: e.name, avatar: e.avatar, score: e.score, mine: e.token === token })),
  };
}

// ---------- HTTP ----------
const app = express();
app.disable('x-powered-by');
app.get('/api/daily', (req, res) => res.json(dailyInfo(String(req.query.token || ''))));
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '10m' }));
const server = http.createServer(app);

// ---------- 사용자 / 방 ----------
const users = new Map(); // token -> user
const rooms = new Map(); // code -> Room
const rid = (n) => crypto.randomBytes(n).toString('base64url');
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10) || '게스트';
function send(u, msg) {
  if (u && u.ws && u.ws.readyState === 1) u.ws.send(JSON.stringify(msg));
}
function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)];
    if (!rooms.has(c)) return c;
  }
}

class Room {
  constructor(mode, host) {
    this.code = genCode();
    this.mode = mode;
    this.hostToken = host.token;
    this.members = [];
    this.fillBots = true;
    this.status = 'lobby';
    this.game = null;
    this.timer = null;
    this.deadline = 0;
    this.lastActive = Date.now();
    rooms.set(this.code, this);
    this.add(host);
  }
  add(u) {
    if (u.room && u.room !== this.code) leaveRoom(u, true);
    if (!this.members.includes(u)) this.members.push(u);
    u.room = this.code;
    this.sendRoom();
  }
  roomMsg(u) {
    return {
      t: 'room', code: this.code, mode: this.mode, status: this.status,
      isHost: u.token === this.hostToken, fillBots: this.fillBots,
      members: this.members.map((m) => ({ pid: m.pid, name: m.name, avatar: m.avatar, online: !!m.ws, host: m.token === this.hostToken })),
    };
  }
  sendRoom() { this.members.forEach((m) => send(m, this.roomMsg(m))); }

  start() {
    clearTimeout(this.timer);
    this.status = 'playing';
    const daily = this.mode === 'daily';
    this.seed = daily ? 'daily:' + this.date : rid(8);
    const g = (this.game = new H.Game({ seed: this.seed }));
    for (const m of this.members) g.addPlayer({ id: m.pid, name: m.name, stack: START_STACK, avatar: m.avatar });
    if (daily || this.fillBots) {
      const used = new Set(this.members.map((m) => m.avatar));
      const pool = BOTS.filter((b) => !used.has(b.avatar)).concat(BOTS.filter((b) => used.has(b.avatar)));
      let k = 0;
      while (g.players.length < 6) {
        const b = pool[k % pool.length];
        g.addPlayer({ id: 'bot' + k, name: b.name, stack: START_STACK, isBot: true, style: b.style, avatar: b.avatar });
        k++;
      }
    }
    this.sendRoom();
    this.nextHand();
  }

  nextHand() {
    const g = this.game;
    if (this.mode === 'daily') {
      const me = g.players[0];
      if (g.handNo >= DAILY_HANDS || me.stack <= 0) return this.finishDaily();
    } else {
      const alive = g.players.filter((p) => p.stack > 0);
      const humansAlive = alive.filter((p) => !p.isBot && this.members.some((m) => m.pid === p.id));
      if (alive.length < 2 || humansAlive.length === 0) return this.finishFriends();
    }
    const [sb, bb] = levelFor(g.handNo);
    g.setBlinds(sb, bb);
    g.startHand();
    this.tick();
  }

  tick() { this.schedule(); this.broadcastState(); }

  schedule() {
    clearTimeout(this.timer);
    this.deadline = 0;
    const g = this.game;
    if (!g || this.status !== 'playing') return;
    if (g.stage === 'done') {
      this.timer = setTimeout(() => this.nextHand(), g.result.type === 'showdown' ? 5200 : 2600);
      return;
    }
    if (g.runout) {
      this.timer = setTimeout(() => { g.runoutStep(); this.tick(); }, 1500);
      return;
    }
    const p = g.players[g.toAct];
    if (p.isBot) {
      const rand = this.mode === 'daily' ? H.mulberry32(H.hashSeed(this.seed + ':bot:' + g.handNo + ':' + g.actionSeq)) : Math.random;
      const delay = 700 + (this.mode === 'daily' ? rand() : Math.random()) * 900;
      this.timer = setTimeout(() => {
        const d = H.botDecide(g, rand);
        g.act(p.id, d.type, d.amount);
        this.tick();
      }, delay);
      return;
    }
    const m = this.members.find((x) => x.pid === p.id);
    const ms = !m ? 700 : (!m.ws || p.away) ? AWAY_MS : TURN_MS;
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => {
      const L = g.legal();
      g.act(p.id, L && L.canCheck ? 'check' : 'fold');
      p.away = true;
      this.tick();
    }, ms);
  }

  broadcastState() {
    const g = this.game;
    for (const m of this.members) {
      send(m, { t: 'state', view: g.view(m.pid), deadline: this.deadline ? this.deadline - Date.now() : 0, handLimit: DAILY_HANDS });
    }
  }

  act(u, type, amount) {
    if (this.status !== 'playing' || !this.game) return;
    this.lastActive = Date.now();
    const p = this.game.players.find((x) => x.id === u.pid);
    if (p) p.away = false;
    if (this.game.act(u.pid, type, amount)) this.tick();
  }

  finishFriends() {
    clearTimeout(this.timer);
    this.status = 'over';
    const standings = this.game.players.slice().sort((a, b) => b.stack - a.stack)
      .map((p) => ({ pid: p.id, name: p.name, avatar: p.avatar, stack: p.stack }));
    this.members.forEach((m) => send(m, { t: 'over', standings }));
    this.sendRoom();
  }

  finishDaily() {
    clearTimeout(this.timer);
    if (this.status === 'over') return;
    this.status = 'over';
    const u = this.members[0];
    const me = this.game ? this.game.players[0] : null;
    const score = me ? me.stack : 0;
    const e = dayBoard(this.date).entries[this.ownerToken];
    if (e) { e.score = score; e.at = Date.now(); e.hands = this.game ? this.game.handNo : 0; }
    saveLB();
    const list = ranking(this.date);
    const rank = list.findIndex((x) => x.token === this.ownerToken) + 1;
    if (u) {
      send(u, {
        t: 'dailyEnd', score, rank, total: list.length,
        top: list.slice(0, 10).map((x) => ({ name: x.name, avatar: x.avatar, score: x.score, mine: x.token === this.ownerToken })),
      });
      u.room = null;
    }
    this.destroy();
  }

  remove(u) {
    this.members = this.members.filter((m) => m !== u);
    if (u.room === this.code) u.room = null;
    if (this.mode === 'daily') return this.finishDaily();
    if (!this.members.length) return this.destroy();
    if (this.hostToken === u.token) this.hostToken = this.members[0].token;
    this.sendRoom();
    if (this.status === 'playing') this.schedule(); // 나간 사람 차례면 빨리 넘김
  }

  destroy() {
    clearTimeout(this.timer);
    rooms.delete(this.code);
    for (const m of this.members) if (m.room === this.code) m.room = null;
  }
}

function leaveRoom(u, silent) {
  const r = rooms.get(u.room);
  if (r) r.remove(u);
  u.room = null;
  if (!silent) send(u, { t: 'left' });
}

// ---------- 웹소켓 ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    try { handle(ws, m); } catch (e) { console.error('handle error', e); }
  });
  ws.on('close', () => {
    const u = ws.user;
    if (!u || u.ws !== ws) return;
    u.ws = null;
    u.offAt = Date.now();
    const r = rooms.get(u.room);
    if (r) { r.sendRoom(); if (r.status === 'playing') r.schedule(); }
  });
});

function handle(ws, m) {
  if (m.t === 'hello') {
    let u = m.token && users.get(m.token);
    if (!u) {
      // 서버 재시작 후에도 같은 토큰을 이어서 사용 (하루 1회 제한 유지)
      const keep = typeof m.token === 'string' && /^[\w-]{20,32}$/.test(m.token);
      u = { token: keep ? m.token : rid(18), pid: rid(6), room: null };
      users.set(u.token, u);
    }
    if (u.ws && u.ws !== ws) { try { u.ws.close(); } catch (e) { /* */ } }
    u.ws = ws; ws.user = u;
    u.name = cleanName(m.name);
    u.avatar = Math.max(0, Math.min(5, m.avatar | 0));
    send(u, { t: 'welcome', token: u.token, pid: u.pid });
    const r = rooms.get(u.room);
    if (r) {
      send(u, r.roomMsg(u));
      r.sendRoom();
      if (r.status === 'playing') r.tick();
    }
    return;
  }
  const u = ws.user;
  if (!u) return;
  const r = rooms.get(u.room);
  u.lastMsg = Date.now();

  switch (m.t) {
    case 'create': {
      if (r) leaveRoom(u, true);
      new Room('friends', u);
      break;
    }
    case 'join': {
      const code = String(m.code || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.mode !== 'friends') return send(u, { t: 'error', msg: '방을 찾을 수 없어요' });
      if (room.members.includes(u)) { send(u, room.roomMsg(u)); if (room.status === 'playing') room.tick(); return; }
      if (room.status !== 'lobby') return send(u, { t: 'error', msg: '이미 게임이 진행 중인 방이에요' });
      if (room.members.length >= 6) return send(u, { t: 'error', msg: '방이 가득 찼어요' });
      room.add(u);
      break;
    }
    case 'setBots': {
      if (r && r.hostToken === u.token && r.status === 'lobby') { r.fillBots = !!m.on; r.sendRoom(); }
      break;
    }
    case 'start': {
      if (!r || r.hostToken !== u.token || r.status !== 'lobby') return;
      if (r.members.length < 2 && !r.fillBots) return send(u, { t: 'error', msg: '2명 이상이어야 시작할 수 있어요' });
      r.start();
      break;
    }
    case 'rematch': {
      if (!r || r.hostToken !== u.token || r.status !== 'over') return;
      if (r.members.length < 2 && !r.fillBots) return send(u, { t: 'error', msg: '함께할 친구가 없어요' });
      r.start();
      break;
    }
    case 'act': {
      if (r) r.act(u, String(m.type), Number(m.amount));
      break;
    }
    case 'emote': {
      if (!r || !EMOTES.has(m.e)) return;
      const now = Date.now();
      if (u.lastEmote && now - u.lastEmote < 1200) return;
      u.lastEmote = now;
      r.members.forEach((x) => send(x, { t: 'emote', pid: u.pid, e: m.e }));
      break;
    }
    case 'leave': {
      leaveRoom(u);
      break;
    }
    case 'daily': {
      const date = kstDate();
      const board = dayBoard(date);
      if (board.entries[u.token]) {
        const info = dailyInfo(u.token);
        return send(u, { t: 'error', msg: `오늘은 이미 도전했어요 (${info.my ? info.my.rank + '위' : ''})` });
      }
      if (r) leaveRoom(u, true);
      board.entries[u.token] = { name: u.name, avatar: u.avatar, score: null, at: Date.now() };
      saveLB();
      const room = new Room('daily', u);
      room.date = date;
      room.ownerToken = u.token;
      room.start();
      break;
    }
    default:
  }
}

// ---------- 정리 ----------
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* */ }
  });
  const now = Date.now();
  for (const r of rooms.values()) {
    // 로비에서 오래 끊긴 사람 정리
    if (r.status !== 'playing') {
      for (const m of r.members.slice()) if (!m.ws && now - (m.offAt || now) > 90e3) r.remove(m);
    }
    const anyOnline = r.members.some((m) => m.ws);
    if (anyOnline) r.lastActive = now;
    else if (now - r.lastActive > 10 * 60e3) {
      if (r.mode === 'daily') r.finishDaily(); else r.destroy();
    }
  }
  // 오래된 사용자 정리
  for (const [t, u] of users) if (!u.ws && !u.room && now - (u.offAt || now) > 24 * 3600e3) users.delete(t);
}, 20000);

server.listen(PORT, () => console.log('로열 홀덤 서버 :' + PORT));
