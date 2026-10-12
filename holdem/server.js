/* 로열 홀덤 — 서버
 * 정적 파일 + 회원(닉네임·PIN, 관리자 가입 승인) + 접속마다 관리자 입장 승인 + 보유 칩(바이인·정산·로그)
 * + 게임 방(AI 대결·친구 대전·오늘의 토너먼트, 최대 9명) + 관리자 API(/admin)
 * 보유 칩은 게임 안에서만 쓰는 칩이에요(현금 충전·환전 없음).
 */
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
const MAX_SEATS = 9;
const DAILY_STACK = 10000;
const DAILY_HANDS = Number(process.env.DAILY_HANDS) || 30;
const TURN_MS = 25000;
const AWAY_MS = 4000;
const APPROVAL_GRACE_MS = 90e3;   // 잠깐 끊겼다 돌아오면 입장 승인 유지(새로고침·통신 끊김)
const LEVELS = [[50, 100], [100, 200], [200, 400], [300, 600], [500, 1000], [1000, 2000], [2000, 4000]];
const levelFor = (handNo) => LEVELS[Math.min(LEVELS.length - 1, Math.floor(handNo / 10))];
const BOTS = [
  { name: '김영감', style: 'rock', avatar: 0 },
  { name: '샤크', style: 'shark', avatar: 1 },
  { name: '해피', style: 'fish', avatar: 2 },
  { name: '폭주핑크', style: 'maniac', avatar: 3 },
  { name: '에이스', style: 'pro', avatar: 4 },
  { name: '레드', style: 'pro', avatar: 5 },
  { name: '마담', style: 'shark', avatar: 6 },
  { name: '꼬마천재', style: 'pro', avatar: 7 },
  { name: '카우보이', style: 'maniac', avatar: 8 },
];
const AVATARS = 9;
const EMOTES = new Set(['👍', '😂', '😱', '😡', '🔥']);
const PHRASES = {
  p1: '빨리빨리~', p2: '아 까비!', p3: '이걸 넘겨?', p4: '나이스!', p5: '블러프지?', p6: '올인 간다!',
  p7: '한 판 더!', p8: 'ㅋㅋㅋㅋ', p9: '봐줬다~', p10: '살려줘…', p11: '굿게임!', p12: '고민 중…',
};

// ---------- 저장소 (data/db.json) ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = null; }
db = Object.assign({ seq: 1, accounts: {}, sessions: {}, logs: [], daily: {}, settings: {} }, db || {});
db.settings = Object.assign({ welcomeChips: 10000, buyIn: 10000, minBuyIn: 1000, autoApprove: false }, db.settings);
let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const days = Object.keys(db.daily).sort();
    while (days.length > 14) delete db.daily[days.shift()];
    if (db.logs.length > 20000) db.logs = db.logs.slice(-20000);
    const tmp = DB_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(db), (err) => { if (!err) fs.rename(tmp, DB_FILE, () => {}); });
  }, 200);
}
function saveNow() { clearTimeout(saveT); try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) { /* */ } }

const rid = (n) => crypto.randomBytes(n).toString('base64url');
const now = () => Date.now();
const nameKey = (s) => String(s).trim().toLowerCase();
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>"'`\\]/g, '').trim().slice(0, 10);
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const findByName = (name) => Object.values(db.accounts).find((a) => a.nameKey === nameKey(name));

function log(acct, type, amount, reason, by) {
  db.logs.push({ at: now(), acct: acct.id, name: acct.name, type, amount, balance: acct.balance, inPlay: acct.inPlay || 0, reason: reason || '', by: by || 'system' });
  save();
}
// 보유 칩 변경(모든 변경은 로그를 남김)
function addMoney(acct, amount, type, reason, by) {
  amount = Math.round(amount);
  if (!amount) return true;
  if (acct.balance + amount < 0) return false;
  acct.balance += amount;
  log(acct, type, amount, reason, by);
  pushMe(acct.id);
  return true;
}

// 서버가 다시 켜지면 테이블에 앉아 있던 칩을 돌려줌
for (const a of Object.values(db.accounts)) {
  if (a.inPlay > 0) {
    const amt = a.inPlay; a.inPlay = 0;
    a.balance += amt;
    log(a, 'refund', amt, '서버 재시작 — 테이블 칩 반환');
  }
}
save();

// ---------- 오늘의 토너먼트 기록 ----------
const kstDate = () => new Date(now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayBoard = (date) => (db.daily[date] = db.daily[date] || { entries: {} });
function ranking(date) {
  return Object.entries(dayBoard(date).entries)
    .filter(([, e]) => e.score != null)
    .sort((a, b) => b[1].score - a[1].score || a[1].at - b[1].at)
    .map(([acct, e]) => ({ acct, ...e }));
}
function dailyInfo(acctId) {
  const date = kstDate();
  const list = ranking(date);
  const myIdx = acctId ? list.findIndex((e) => e.acct === String(acctId)) : -1;
  const entry = acctId ? dayBoard(date).entries[acctId] : null;
  return {
    date, total: list.length, played: !!entry,
    my: myIdx >= 0 ? { score: list[myIdx].score, rank: myIdx + 1 } : (entry ? { score: entry.score || 0, rank: '-' } : null),
    top: list.slice(0, 20).map((e) => ({ name: e.name, avatar: e.avatar, score: e.score, mine: e.acct === String(acctId) })),
  };
}

// ---------- 접속 중인 회원 ----------
const users = new Map(); // 계정 id → { id, acct, ws, approved, req, room, offAt, pid }
const rooms = new Map();
function userOf(acct) {
  let u = users.get(acct.id);
  if (!u) { u = { id: acct.id, acct, ws: null, approved: false, req: 0, room: null, offAt: 0, pid: 'u' + acct.id }; users.set(acct.id, u); }
  u.acct = acct;
  return u;
}
function send(u, msg) { if (u && u.ws && u.ws.readyState === 1) u.ws.send(JSON.stringify(msg)); }
function sendWs(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function meMsg(u) {
  const a = u.acct;
  return { t: 'me', id: a.id, pid: u.pid, name: a.name, avatar: a.avatar, status: a.status, balance: a.balance, inPlay: a.inPlay || 0,
    approved: !!u.approved, req: !!u.req, buyIn: db.settings.buyIn, minBuyIn: db.settings.minBuyIn };
}
function pushMe(acctId) { const u = users.get(acctId); if (u) send(u, meMsg(u)); }
function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)]; if (!rooms.has(c)) return c; }
}

// ---------- 게임 방 ----------
class Room {
  constructor(mode, host) {
    this.code = genCode();
    this.mode = mode;          // 'solo' | 'friends' | 'daily'
    this.hostId = host.id;
    this.members = [];
    this.fillBots = true;
    this.status = 'lobby';
    this.game = null;
    this.timer = null; this.nagT = null;
    this.deadline = 0;
    this.lastActive = now();
    this.createdAt = now();
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
      t: 'room', code: this.code, mode: this.mode, status: this.status, maxSeats: MAX_SEATS,
      isHost: u.id === this.hostId, fillBots: this.fillBots,
      members: this.members.map((m) => ({ pid: m.pid, name: m.acct.name, avatar: m.acct.avatar, online: !!m.ws, host: m.id === this.hostId, balance: m.acct.balance })),
    };
  }
  sendRoom() { this.members.forEach((m) => send(m, this.roomMsg(m))); }
  paid() { return this.mode !== 'daily'; }

  start() {
    clearTimeout(this.timer);
    const S = db.settings;
    // 바이인(보유 칩에서 테이블로). 모자라는 사람은 방에서 내보냄
    if (this.paid()) {
      for (const m of this.members.slice()) {
        if (m.acct.balance < S.minBuyIn) {
          send(m, { t: 'error', msg: `보유 칩이 ${S.minBuyIn.toLocaleString()} 이상 있어야 앉을 수 있어요` });
          if (m.id === this.hostId && this.members.length === 1) return;
          this.members = this.members.filter((x) => x !== m); m.room = null; send(m, { t: 'left' });
        }
      }
      if (!this.members.length) return this.destroy();
      if (!this.members.some((m) => m.id === this.hostId)) this.hostId = this.members[0].id;
      if (this.mode === 'friends' && this.members.length < 2 && !this.fillBots) { this.sendRoom(); return; }
    }
    this.status = 'playing';
    this.seed = this.mode === 'daily' ? 'daily:' + this.date : rid(8);
    const g = (this.game = new H.Game({ seed: this.seed }));
    for (const m of this.members) {
      let stack = DAILY_STACK;
      if (this.paid()) {
        stack = Math.min(m.acct.balance, S.buyIn);
        m.acct.balance -= stack; m.acct.inPlay = stack;
        log(m.acct, 'buyin', -stack, (this.mode === 'solo' ? 'AI 대결' : '친구 대전 ' + this.code) + ' 바이인');
        pushMe(m.id);
      }
      g.addPlayer({ id: m.pid, name: m.acct.name, stack, avatar: m.acct.avatar });
      g.players[g.players.length - 1].acct = m.id;
    }
    if (this.mode !== 'friends' || this.fillBots) {
      const used = new Set(this.members.map((m) => m.acct.avatar));
      const pool = BOTS.filter((b) => !used.has(b.avatar)).concat(BOTS.filter((b) => used.has(b.avatar)));
      const botStack = this.paid() ? S.buyIn : DAILY_STACK;
      let k = 0;
      while (g.players.length < MAX_SEATS) {
        const b = pool[k % pool.length];
        g.addPlayer({ id: 'bot' + k, name: b.name, stack: botStack, isBot: true, style: b.style, avatar: b.avatar });
        k++;
      }
    }
    this.sendRoom();
    this.nextHand();
  }

  // 나간 사람의 칩을 보유 칩으로 돌려줌
  cashOut(p, reason) {
    if (!p.acct || p.cashed || !this.paid()) return 0;
    const a = db.accounts[p.acct];
    p.cashed = true;
    const amt = p.stack;
    if (!a) return amt;
    a.inPlay = 0;
    a.balance += amt;
    log(a, 'cashout', amt, reason || ((this.mode === 'solo' ? 'AI 대결' : '친구 대전 ' + this.code) + ' 정산'));
    pushMe(a.id);
    return amt;
  }
  syncInPlay() {
    if (!this.paid() || !this.game) return;
    for (const p of this.game.players) if (p.acct && !p.cashed && db.accounts[p.acct]) db.accounts[p.acct].inPlay = p.stack;
    save();
  }

  nextHand() {
    const g = this.game;
    if (!g || this.status !== 'playing') return;
    // 나간 사람 정산
    for (const p of g.players) if (p.gone && !p.cashed) { this.cashOut(p); p.stack = 0; }
    this.syncInPlay();
    const alive = g.players.filter((p) => p.stack > 0);
    if (this.mode === 'daily') {
      const me = g.players[0];
      if (g.handNo >= DAILY_HANDS || me.stack <= 0 || alive.length < 2) return this.finishDaily();
    } else {
      const humansAlive = alive.filter((p) => p.acct && !p.gone);
      if (alive.length < 2 || humansAlive.length === 0) return this.finish();
    }
    const [sb, bb] = levelFor(g.handNo);
    g.setBlinds(sb, bb);
    g.startHand();
    this.tick();
  }

  tick() { this.schedule(); this.broadcastState(); }

  schedule() {
    clearTimeout(this.timer); clearTimeout(this.nagT);
    this.deadline = 0;
    const g = this.game;
    if (!g || this.status !== 'playing') return;
    if (g.stage === 'done') {
      if (!this.spokeFor || this.spokeFor !== g.handNo) { this.spokeFor = g.handNo; this.botReactResult(); }
      this.timer = setTimeout(() => this.nextHand(), g.result.type === 'showdown' ? 5200 : 2600);
      return;
    }
    if (g.runout) { this.timer = setTimeout(() => { g.runoutStep(); this.tick(); }, 1500); return; }
    const p = g.players[g.toAct];
    if (p.isBot) {
      const rand = this.mode === 'daily' ? H.mulberry32(H.hashSeed(this.seed + ':bot:' + g.handNo + ':' + g.actionSeq)) : Math.random;
      const delay = 700 + (this.mode === 'daily' ? rand() : Math.random()) * 900;
      this.timer = setTimeout(() => {
        const L = g.legal();
        const d = H.botDecide(g, rand);
        g.act(p.id, d.type, d.amount);
        if (d.type === 'fold' && L && L.toCall >= L.pot * 0.4) this.botSay(['p3'], 0.18, p.id);
        else if (p.allIn) this.botSay(['p6'], 0.5, p.id, p.id);
        this.tick();
      }, delay);
      return;
    }
    const m = this.members.find((x) => x.pid === p.id);
    const ms = !m ? 700 : (!m.ws || p.away) ? AWAY_MS : TURN_MS;
    this.deadline = now() + ms;
    if (m && ms === TURN_MS) this.nagT = setTimeout(() => this.botSay(['p1', 'p12'], 0.6), 12000);   // 오래 고민하면 AI가 재촉
    this.timer = setTimeout(() => {
      const L = g.legal();
      g.act(p.id, L && L.canCheck ? 'check' : 'fold');
      p.away = true;
      this.tick();
    }, ms);
  }

  // AI가 가끔 대사(보이기만, 판에는 영향 없음)
  botSay(ids, chance, exceptPid, onlyPid) {
    if (Math.random() > chance) return;
    const g = this.game;
    const bots = g.players.filter((p) => p.isBot && p.inHand && (onlyPid ? p.id === onlyPid : p.id !== exceptPid));
    if (!bots.length) return;
    const b = bots[Math.floor(Math.random() * bots.length)];
    const pid = ids[Math.floor(Math.random() * ids.length)];
    this.members.forEach((x) => send(x, { t: 'emote', pid: b.id, p: pid }));
  }
  botReactResult() {
    const g = this.game, r = g.result;
    if (!r) return;
    const winners = new Set(r.pots.flatMap((x) => x.winners));
    for (const p of g.players) {
      if (!p.isBot || !p.inHand) continue;
      if (winners.has(p.id) && p.won >= g.bb * 6 && Math.random() < 0.3) {
        const id = ['p8', 'p9', 'p4'][Math.floor(Math.random() * 3)];
        setTimeout(() => this.members.forEach((x) => send(x, { t: 'emote', pid: p.id, p: id })), 1600);
        break;
      }
    }
    if (r.type === 'showdown') {
      const loser = g.players.find((p) => p.isBot && p.inHand && !p.folded && !winners.has(p.id));
      if (loser && Math.random() < 0.3) setTimeout(() => this.members.forEach((x) => send(x, { t: 'emote', pid: loser.id, p: 'p2' })), 2200);
    }
  }

  broadcastState() {
    const g = this.game;
    for (const m of this.members) {
      send(m, { t: 'state', view: g.view(m.pid), deadline: this.deadline ? this.deadline - now() : 0, handLimit: DAILY_HANDS, mode: this.mode });
    }
  }

  act(u, type, amount) {
    if (this.status !== 'playing' || !this.game) return;
    this.lastActive = now();
    const p = this.game.players.find((x) => x.id === u.pid);
    if (p) p.away = false;
    if (this.game.act(u.pid, type, amount)) this.tick();
  }
  reveal(u, mask) {
    if (this.status !== 'playing' || !this.game) return;
    if (this.game.reveal(u.pid, mask)) this.broadcastState();
  }

  finish() {
    clearTimeout(this.timer); clearTimeout(this.nagT);
    if (this.status === 'over') return;
    this.status = 'over';
    const g = this.game;
    const standings = g.players.slice().sort((a, b) => b.stack - a.stack)
      .map((p) => ({ pid: p.id, name: p.name, avatar: p.avatar, stack: p.stack }));
    const cash = {};
    for (const p of g.players) if (p.acct) cash[p.acct] = this.cashOut(p);
    this.members.forEach((m) => send(m, { t: 'over', mode: this.mode, standings, cashOut: cash[m.id] || 0, balance: m.acct.balance }));
    if (this.mode === 'solo') { for (const m of this.members) m.room = null; return this.destroy(); }
    this.sendRoom();
  }

  finishDaily() {
    clearTimeout(this.timer); clearTimeout(this.nagT);
    if (this.status === 'over') return;
    this.status = 'over';
    const u = this.members[0];
    const me = this.game ? this.game.players[0] : null;
    const score = me ? me.stack : 0;
    const e = dayBoard(this.date).entries[this.ownerId];
    if (e) { e.score = score; e.at = now(); e.hands = this.game ? this.game.handNo : 0; }
    save();
    const list = ranking(this.date);
    const rank = list.findIndex((x) => x.acct === String(this.ownerId)) + 1;
    if (u) {
      send(u, { t: 'dailyEnd', score, rank, total: list.length,
        top: list.slice(0, 10).map((x) => ({ name: x.name, avatar: x.avatar, score: x.score, mine: x.acct === String(this.ownerId) })) });
      u.room = null;
    }
    this.destroy();
  }

  remove(u) {
    this.members = this.members.filter((m) => m !== u);
    if (u.room === this.code) u.room = null;
    if (this.mode === 'daily') return this.finishDaily();
    if (this.status === 'playing' && this.game) {
      const p = this.game.players.find((x) => x.id === u.pid);
      if (p) {
        p.gone = true;
        // 이번 핸드에 걸린 칩이 없으면 바로 정산, 아니면 핸드가 끝난 뒤 정산(차례가 오면 자동 폴드)
        if (this.game.stage === 'done' || !p.inHand || p.folded) { this.cashOut(p); p.stack = 0; }
      }
      if (!this.members.length) {
        // 사람이 모두 나가면 남은 칩 정산하고 방을 닫음
        if (this.game.stage === 'done' || this.game.players.every((x) => !x.acct || x.cashed || !x.inHand || x.folded)) return this.finish(), this.destroy();
      }
    }
    if (!this.members.length && this.status !== 'playing') return this.destroy();
    if (this.members.length && this.hostId === u.id) this.hostId = this.members[0].id;
    this.sendRoom();
    if (this.status === 'playing') this.schedule();
  }

  destroy() {
    clearTimeout(this.timer); clearTimeout(this.nagT);
    if (this.game && this.status === 'playing' && this.paid()) {
      for (const p of this.game.players) if (p.acct && !p.cashed) this.cashOut(p, '방 정리 — 칩 반환');
    }
    this.status = 'over';
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

// ---------- HTTP ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.get('/healthz', (req, res) => res.send('ok'));
app.get('/api/daily', (req, res) => {
  const acctId = db.sessions[String(req.query.token || '')];
  res.json(dailyInfo(acctId));
});

// ----- 관리자 -----
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { ADMIN_PASSWORD = rid(9); console.log('[관리자] ADMIN_PASSWORD 환경 변수가 없어 임시 비밀번호를 만들었어요:', ADMIN_PASSWORD); }
const adminTokens = new Map(); // token → 만료 시각
const adminFails = { n: 0, until: 0 };
function adminAuth(req, res, next) {
  const t = req.get('x-admin-token') || '';
  const exp = adminTokens.get(t);
  if (!exp || exp < now()) { adminTokens.delete(t); return res.status(401).json({ error: '다시 로그인해 주세요' }); }
  next();
}
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
app.post('/admin/api/login', (req, res) => {
  if (adminFails.until > now()) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요' });
  if (!safeEq((req.body || {}).password || '', ADMIN_PASSWORD)) {
    adminFails.n++; if (adminFails.n >= 5) { adminFails.until = now() + 60e3; adminFails.n = 0; }
    return res.status(401).json({ error: '비밀번호가 틀렸어요' });
  }
  adminFails.n = 0;
  const t = rid(24); adminTokens.set(t, now() + 12 * 3600e3);
  res.json({ token: t });
});
function userRow(a) {
  const u = users.get(a.id);
  const room = u && u.room ? rooms.get(u.room) : null;
  return { id: a.id, name: a.name, avatar: a.avatar, status: a.status, balance: a.balance, inPlay: a.inPlay || 0,
    online: !!(u && u.ws), approved: !!(u && u.approved), req: u && u.req ? u.req : 0,
    room: room ? { code: room.code, mode: room.mode, status: room.status } : null,
    createdAt: a.createdAt, lastSeen: u && u.ws ? now() : a.lastSeen || 0, note: a.note || '' };
}
app.get('/admin/api/state', adminAuth, (req, res) => {
  const accts = Object.values(db.accounts);
  const rows = accts.map(userRow);
  res.json({
    now: now(),
    stats: {
      members: accts.filter((a) => a.status === 'active').length,
      pending: accts.filter((a) => a.status === 'pending').length,
      online: rows.filter((r) => r.online).length,
      playing: rows.filter((r) => r.room && r.room.status === 'playing').length,
      entryReq: rows.filter((r) => r.req).length,
      totalBalance: accts.reduce((s, a) => s + (a.balance || 0) + (a.inPlay || 0), 0),
    },
    users: rows.sort((a, b) => (b.online - a.online) || (b.req - a.req) || a.name.localeCompare(b.name)),
    rooms: [...rooms.values()].map((r) => ({ code: r.code, mode: r.mode, status: r.status, hand: r.game ? r.game.handNo : 0,
      players: r.game ? r.game.players.map((p) => ({ name: p.name, stack: p.stack, bot: !!p.isBot, gone: !!p.gone })) : r.members.map((m) => ({ name: m.acct.name, stack: 0, bot: false })),
      createdAt: r.createdAt })),
    settings: db.settings,
  });
});
app.get('/admin/api/logs', adminAuth, (req, res) => {
  const acct = req.query.acct ? Number(req.query.acct) : null;
  const type = req.query.type || '';
  const limit = Math.min(1000, Number(req.query.limit) || 300);
  let list = db.logs;
  if (acct) list = list.filter((l) => l.acct === acct);
  if (type) list = list.filter((l) => l.type === type);
  res.json({ logs: list.slice(-limit).reverse() });
});
app.post('/admin/api/signup/:id', adminAuth, (req, res) => {
  const a = db.accounts[req.params.id];
  if (!a) return res.status(404).json({ error: '회원이 없어요' });
  if (req.body.approve) {
    if (a.status !== 'pending' && a.status !== 'rejected') return res.json({ ok: true });
    a.status = 'active'; a.approvedAt = now();
    save();
    if (db.settings.welcomeChips > 0) addMoney(a, db.settings.welcomeChips, 'welcome', '가입 승인 지급', 'admin');
  } else {
    a.status = 'rejected'; save();
  }
  pushMe(a.id);
  res.json({ ok: true });
});
function approveEntry(u, ok) {
  if (!u) return;
  if (ok) { if (u.acct.status !== 'active') return; u.approved = true; u.req = 0; u.approvedAt = now(); }
  else { u.req = 0; send(u, { t: 'entryRejected' }); }
  pushMe(u.id);
}
app.post('/admin/api/entry/:id', adminAuth, (req, res) => {
  if (req.params.id === 'all') { for (const u of users.values()) if (u.req) approveEntry(u, true); return res.json({ ok: true }); }
  const u = users.get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: '접속 중이 아니에요' });
  approveEntry(u, !!req.body.approve);
  res.json({ ok: true });
});
app.post('/admin/api/money/:id', adminAuth, (req, res) => {
  const a = db.accounts[req.params.id];
  if (!a) return res.status(404).json({ error: '회원이 없어요' });
  const amount = Math.round(Number(req.body.amount) || 0);
  if (!amount || Math.abs(amount) > 1e9) return res.status(400).json({ error: '금액을 확인해 주세요' });
  const reason = String(req.body.reason || '').slice(0, 100);
  if (!addMoney(a, amount, amount > 0 ? 'admin_add' : 'admin_sub', reason, 'admin')) return res.status(400).json({ error: `보유 칩(${a.balance.toLocaleString()})보다 많이 뺄 수 없어요` });
  res.json({ ok: true, balance: a.balance });
});
function kick(u, msg) {
  if (!u) return;
  leaveRoom(u, true);
  u.approved = false; u.req = 0;
  send(u, { t: 'kicked', msg });
  pushMe(u.id);
}
app.post('/admin/api/user/:id', adminAuth, (req, res) => {
  const a = db.accounts[req.params.id];
  if (!a) return res.status(404).json({ error: '회원이 없어요' });
  const u = users.get(a.id);
  const act = req.body.action;
  if (act === 'block') { a.status = 'blocked'; kick(u, '관리자가 이용을 막았어요'); }
  else if (act === 'unblock') { a.status = 'active'; pushMe(a.id); }
  else if (act === 'kick') kick(u, '관리자가 퇴장시켰어요. 다시 들어오려면 입장 승인이 필요해요');
  else if (act === 'resetPin') {
    const pin = String(req.body.pin || '');
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN은 숫자 4~6자리예요' });
    a.salt = rid(12); a.pinHash = hashPin(pin, a.salt);
    for (const [t, id] of Object.entries(db.sessions)) if (id === a.id) delete db.sessions[t];
    kick(u, 'PIN이 바뀌어 다시 로그인해야 해요');
  } else if (act === 'note') a.note = String(req.body.note || '').slice(0, 200);
  else if (act === 'delete') {
    if ((a.balance || 0) + (a.inPlay || 0) > 0 && !req.body.force) return res.status(400).json({ error: '보유 칩이 남아 있어요. 먼저 차감하거나 강제 삭제하세요' });
    kick(u, '계정이 삭제됐어요');
    for (const [t, id] of Object.entries(db.sessions)) if (id === a.id) delete db.sessions[t];
    log(a, 'delete', 0, '계정 삭제', 'admin');
    delete db.accounts[a.id]; users.delete(a.id);
  } else return res.status(400).json({ error: '알 수 없는 작업' });
  save();
  res.json({ ok: true });
});
app.post('/admin/api/settings', adminAuth, (req, res) => {
  const b = req.body || {};
  const S = db.settings;
  const num = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v))));
  if (b.welcomeChips != null) S.welcomeChips = num(b.welcomeChips, 0, 1e8);
  if (b.buyIn != null) S.buyIn = num(b.buyIn, 1000, 1e8);
  if (b.minBuyIn != null) S.minBuyIn = num(b.minBuyIn, 200, S.buyIn);
  if (b.autoApprove != null) S.autoApprove = !!b.autoApprove;
  save();
  res.json({ ok: true, settings: S });
});
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m' }));
const server = http.createServer(app);

// ---------- 웹소켓 ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    try { handle(ws, m); } catch (e) { console.error('handle error', e); }
  });
  ws.on('close', () => {
    const u = ws.user;
    if (!u || u.ws !== ws) return;
    u.ws = null; u.offAt = now();
    u.acct.lastSeen = now(); save();
    const r = rooms.get(u.room);
    if (r) { r.sendRoom(); if (r.status === 'playing') r.schedule(); }
  });
});

const loginFails = new Map(); // 이름 → { n, until }
function attach(ws, acct, token) {
  const u = userOf(acct);
  if (u.ws && u.ws !== ws) { sendWs(u.ws, { t: 'kicked', msg: '다른 곳에서 접속했어요' }); try { u.ws.close(); } catch (e) { /* */ } }
  // 오래 끊겼다 들어오면 입장 승인을 다시 받아야 함(접속할 때마다 승인)
  if (u.offAt && now() - u.offAt > APPROVAL_GRACE_MS && !u.room) { u.approved = false; u.req = 0; }
  u.ws = ws; u.offAt = 0; ws.user = u;
  acct.lastSeen = now();
  if (token) sendWs(ws, { t: 'session', token });
  send(u, meMsg(u));
  const r = rooms.get(u.room);
  if (r && u.approved) { send(u, r.roomMsg(u)); r.sendRoom(); if (r.status === 'playing') r.tick(); }
  return u;
}

function handle(ws, m) {
  switch (m.t) {
    case 'hello': {
      const id = db.sessions[String(m.token || '')];
      const a = id && db.accounts[id];
      if (!a) return sendWs(ws, { t: 'auth', reason: m.token ? 'expired' : '' });
      if (a.status === 'blocked') return sendWs(ws, { t: 'auth', reason: 'blocked' });
      attach(ws, a);
      return;
    }
    case 'signup': {
      const name = cleanName(m.name), pin = String(m.pin || '');
      if (name.length < 1) return sendWs(ws, { t: 'authError', msg: '닉네임을 입력해 주세요' });
      if (!/^\d{4,6}$/.test(pin)) return sendWs(ws, { t: 'authError', msg: 'PIN은 숫자 4~6자리예요' });
      if (findByName(name)) return sendWs(ws, { t: 'authError', msg: '이미 있는 닉네임이에요' });
      const salt = rid(12);
      const a = { id: db.seq++, name, nameKey: nameKey(name), salt, pinHash: hashPin(pin, salt), avatar: Math.max(0, Math.min(AVATARS - 1, m.avatar | 0)),
        status: db.settings.autoApprove ? 'active' : 'pending', balance: 0, inPlay: 0, createdAt: now(), lastSeen: now() };
      db.accounts[a.id] = a;
      log(a, 'signup', 0, '가입 신청');
      if (a.status === 'active' && db.settings.welcomeChips > 0) { a.balance += db.settings.welcomeChips; log(a, 'welcome', db.settings.welcomeChips, '가입 지급(자동 승인)'); }
      const token = rid(24); db.sessions[token] = a.id; save();
      attach(ws, a, token);
      return;
    }
    case 'login': {
      const name = cleanName(m.name), key = nameKey(name);
      const f = loginFails.get(key);
      if (f && f.until > now()) return sendWs(ws, { t: 'authError', msg: '여러 번 틀려서 1분 뒤에 다시 해 주세요' });
      const a = findByName(name);
      if (!a || !safeEq(hashPin(String(m.pin || ''), a.salt), a.pinHash)) {
        const n = (f && f.until <= now() ? 0 : (f ? f.n : 0)) + 1;
        loginFails.set(key, { n: n >= 5 ? 0 : n, until: n >= 5 ? now() + 60e3 : 0 });
        return sendWs(ws, { t: 'authError', msg: '닉네임 또는 PIN이 맞지 않아요' });
      }
      loginFails.delete(key);
      if (a.status === 'blocked') return sendWs(ws, { t: 'authError', msg: '이용이 막힌 계정이에요. 관리자에게 문의해 주세요' });
      const token = rid(24); db.sessions[token] = a.id; save();
      attach(ws, a, token);
      return;
    }
    default:
  }
  const u = ws.user;
  if (!u || u.ws !== ws) return sendWs(ws, { t: 'auth', reason: '' });
  const a = u.acct;
  switch (m.t) {
    case 'logout': {
      for (const [t, id] of Object.entries(db.sessions)) if (id === a.id && t === m.token) delete db.sessions[t];
      leaveRoom(u, true);
      u.approved = false; u.req = 0; u.ws = null; ws.user = null; save();
      sendWs(ws, { t: 'auth', reason: 'logout' });
      return;
    }
    case 'enterReq': {
      if (a.status !== 'active' || u.approved) return send(u, meMsg(u));
      u.req = now();
      if (db.settings.autoApprove) { u.approved = true; u.req = 0; }
      send(u, meMsg(u));
      return;
    }
    case 'enterCancel': { u.req = 0; send(u, meMsg(u)); return; }
    case 'exit': {   // 홀덤을 나가면 다음 접속 때 다시 승인
      leaveRoom(u, true); u.approved = false; u.req = 0; send(u, meMsg(u)); return;
    }
    case 'setAvatar': { a.avatar = Math.max(0, Math.min(AVATARS - 1, m.avatar | 0)); save(); send(u, meMsg(u)); return; }
    default:
  }
  if (!u.approved) return send(u, { t: 'error', msg: '관리자 입장 승인이 필요해요' });
  const r = rooms.get(u.room);
  u.lastMsg = now();
  switch (m.t) {
    case 'solo': {
      if (r) leaveRoom(u, true);
      if (a.balance < db.settings.minBuyIn) return send(u, { t: 'error', msg: `보유 칩이 ${db.settings.minBuyIn.toLocaleString()} 이상 있어야 해요` });
      const room = new Room('solo', u);
      room.start();
      break;
    }
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
      if (room.members.length >= MAX_SEATS) return send(u, { t: 'error', msg: '방이 가득 찼어요' });
      if (a.balance < db.settings.minBuyIn) return send(u, { t: 'error', msg: `보유 칩이 ${db.settings.minBuyIn.toLocaleString()} 이상 있어야 해요` });
      room.add(u);
      break;
    }
    case 'setBots': if (r && r.hostId === u.id && r.status === 'lobby') { r.fillBots = !!m.on; r.sendRoom(); } break;
    case 'start': {
      if (!r || r.hostId !== u.id || r.status !== 'lobby') return;
      if (r.members.length < 2 && !r.fillBots) return send(u, { t: 'error', msg: '2명 이상이어야 시작할 수 있어요' });
      r.start();
      break;
    }
    case 'rematch': {
      if (!r || r.hostId !== u.id || r.status !== 'over') return;
      if (r.members.length < 2 && !r.fillBots) return send(u, { t: 'error', msg: '함께할 친구가 없어요' });
      r.start();
      break;
    }
    case 'act': if (r) r.act(u, String(m.type), Number(m.amount)); break;
    case 'reveal': if (r) r.reveal(u, Number(m.mask)); break;
    case 'emote': {
      if (!r) return;
      const isEmoji = EMOTES.has(m.e), isPhrase = Object.prototype.hasOwnProperty.call(PHRASES, m.p);
      if (!isEmoji && !isPhrase) return;
      const t = now();
      if (u.lastEmote && t - u.lastEmote < 1200) return;
      u.lastEmote = t;
      r.members.forEach((x) => send(x, isPhrase ? { t: 'emote', pid: u.pid, p: m.p } : { t: 'emote', pid: u.pid, e: m.e }));
      break;
    }
    case 'leave': leaveRoom(u); break;
    case 'daily': {
      const date = kstDate();
      const board = dayBoard(date);
      if (board.entries[a.id]) {
        const info = dailyInfo(a.id);
        return send(u, { t: 'error', msg: `오늘은 이미 도전했어요 (${info.my ? info.my.rank + '위' : ''})` });
      }
      if (r) leaveRoom(u, true);
      board.entries[a.id] = { name: a.name, avatar: a.avatar, score: null, at: now() };
      save();
      const room = new Room('daily', u);
      room.date = date; room.ownerId = a.id;
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
  const t = now();
  for (const u of users.values()) {
    // 오래 끊기면 입장 승인 해제(방에 있으면 방 정리 때)
    if (!u.ws && u.offAt && t - u.offAt > APPROVAL_GRACE_MS && !u.room) { u.approved = false; u.req = 0; }
  }
  for (const r of rooms.values()) {
    if (r.status !== 'playing') for (const m of r.members.slice()) if (!m.ws && t - (m.offAt || t) > APPROVAL_GRACE_MS) r.remove(m);
    if (r.members.some((m) => m.ws)) r.lastActive = t;
    else if (t - r.lastActive > 10 * 60e3) {
      if (r.mode === 'daily') r.finishDaily();
      else { if (r.status === 'playing') r.finish(); r.destroy(); }
      for (const m of r.members) { m.approved = false; m.req = 0; }
    }
  }
}, 20000);

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { saveNow(); process.exit(0); });
server.listen(PORT, () => console.log('로열 홀덤 서버 :' + PORT));
