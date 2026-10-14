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
const REBUY_MIN_BB = 40, REBUY_MAX_BB = 200;   // 리바인: 빅블라인드의 40배 ~ 200배
const REBUY_WAIT_MS = 30000;                    // 사람이 모두 칩을 잃으면 리바인을 이만큼 기다림
// 방을 만들 때 고르는 블라인드(고정)와 최소 머니
const BLINDS = [[50, 100], [100, 200], [250, 500], [500, 1000], [1000, 2000], [2500, 5000], [5000, 10000], [10000, 20000]];
const MIN_INS = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
function roomOpts(m, tid) {
  const bi = BLINDS.findIndex((b) => b[1] === Number(m.bb));
  const [sb, bb] = BLINDS[bi >= 0 ? bi : 0];
  let minIn = Math.round(Number(m.minIn) || 0);
  if (!MIN_INS.includes(minIn)) minIn = MIN_INS.find((x) => x >= bb * 20) || bb * 20;
  minIn = Math.max(minIn, bb * 10, SET(tid).minBuyIn);   // 최소 머니는 BB 10배 이상
  return { sb, bb, minIn };
}
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
db = Object.assign({ seq: 1, accounts: {}, sessions: {}, logs: [], daily: {}, settings: {}, tenants: {} }, db || {});

// ---------- 분양(사업장) ----------
// 사업장마다 회원·보유 칩·칩 로그·게임 방·오늘의 토너먼트·설정(수수료 포함)이 따로예요. 'main' = 본사(기본 주소).
const DEF_SETTINGS = { welcomeChips: 10000, buyIn: 10000, minBuyIn: 1000, autoApprove: false, testPin: '1234' };
function defRake() {
  const levels = {};
  for (const [, bb] of BLINDS) levels[bb] = { pct: 5, capBB: 30 };   // 기본: 5%, 최대 30BB
  return { on: true, nfnd: true, solo: true, friends: true, levels };
}
function fixTenant(t) {
  t.settings = Object.assign({}, DEF_SETTINGS, t.settings || {});
  const R = (t.settings.rake = Object.assign(defRake(), t.settings.rake || {}));
  const d = defRake().levels;
  R.levels = Object.assign(d, R.levels || {});
  t.domains = t.domains || [];
  t.stats = Object.assign({ rake: 0, rakeDays: {} }, t.stats || {});
  if (t.active == null) t.active = true;
  return t;
}
if (!db.tenants.main) db.tenants.main = { id: 'main', name: '본사', slug: '', domains: [], active: true, createdAt: Date.now(), settings: Object.assign({}, db.settings) };
for (const t of Object.values(db.tenants)) fixTenant(t);
for (const a of Object.values(db.accounts)) if (!a.tid) a.tid = 'main';
const TEN = (tid) => db.tenants[tid] || db.tenants.main;
const SET = (tid) => TEN(tid).settings;
const RESERVED = new Set(['admin', 'super', 'api', 'ws', 'img', 's']);
const tenantBySlug = (slug) => Object.values(db.tenants).find((t) => t.slug && t.slug === slug);
const tenantByHost = (host) => { const h = String(host || '').split(':')[0].toLowerCase(); return h ? Object.values(db.tenants).find((t) => t.domains.includes(h)) : null; };
// 이 방의 수수료(오늘의 토너먼트는 무료)
function rakeOf(tid, bb, mode) {
  const R = SET(tid).rake;
  if (!R || !R.on || mode === 'daily' || (mode === 'solo' && !R.solo) || (mode === 'friends' && !R.friends)) return null;
  const L = R.levels[bb] || { pct: 5, capBB: 30 };
  if (!(L.pct > 0)) return null;
  return { pct: L.pct, capBB: L.capBB, cap: Math.round(L.capBB * bb), nfnd: R.nfnd !== false };
}
let saveT = null;
let frozen = false;   // 백업 되살리기 중엔 저장을 멈춤(되살린 파일을 덮어쓰지 않게)
function save() {
  if (frozen) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const cut = new Date(Date.now() - 15 * 86400e3).toISOString().slice(0, 10);
    for (const k of Object.keys(db.daily)) if (k.split('|').pop() < cut) delete db.daily[k];
    if (db.logs.length > 20000) db.logs = db.logs.slice(-20000);
    const tmp = DB_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(db), (err) => { if (!err) fs.rename(tmp, DB_FILE, () => {}); });
  }, 200);
}
function saveNow() { if (frozen) return; clearTimeout(saveT); try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) { /* */ } }

const rid = (n) => crypto.randomBytes(n).toString('base64url');
const now = () => Date.now();
const nameKey = (s) => String(s).trim().toLowerCase();
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>"'`\\]/g, '').trim().slice(0, 10);
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const findByName = (tid, name) => Object.values(db.accounts).find((a) => a.tid === tid && a.nameKey === nameKey(name));

function log(acct, type, amount, reason, by) {
  db.logs.push({ at: now(), tid: acct.tid || 'main', acct: acct.id, name: acct.name, type, amount, balance: acct.balance, inPlay: acct.inPlay || 0, reason: reason || '', by: by || 'system' });
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
const dayKey = (tid, date) => (tid === 'main' ? date : tid + '|' + date);
const dayBoard = (tid, date) => (db.daily[dayKey(tid, date)] = db.daily[dayKey(tid, date)] || { entries: {} });
function ranking(tid, date) {
  return Object.entries(dayBoard(tid, date).entries)
    .filter(([, e]) => e.score != null)
    .sort((a, b) => b[1].score - a[1].score || a[1].at - b[1].at)
    .map(([acct, e]) => ({ acct, ...e }));
}
function dailyInfo(tid, acctId) {
  const date = kstDate();
  const list = ranking(tid, date);
  const myIdx = acctId ? list.findIndex((e) => e.acct === String(acctId)) : -1;
  const entry = acctId ? dayBoard(tid, date).entries[acctId] : null;
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
    approved: !!u.approved, req: !!u.req, buyIn: SET(a.tid).buyIn, minBuyIn: SET(a.tid).minBuyIn, rake: rakeTable(a.tid) };
}
// 화면에 보여 줄 블라인드별 수수료(AI 대결·친구 대전)
function rakeTable(tid) {
  const out = {};
  for (const [, bb] of BLINDS) { const x = rakeOf(tid, bb, 'friends'), y = rakeOf(tid, bb, 'solo'); out[bb] = { friends: x, solo: y }; }
  return out;
}
function pushMe(acctId) { const u = users.get(acctId); if (u) send(u, meMsg(u)); }
function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)]; if (!rooms.has(c)) return c; }
}

// ---------- 게임 방 ----------
class Room {
  constructor(mode, host, opts) {
    this.code = genCode();
    this.mode = mode;          // 'solo' | 'friends' | 'daily'
    opts = opts || {};
    this.sb = opts.sb || 50; this.bb = opts.bb || 100; this.minIn = opts.minIn || 1000;
    this.seats = new Map();    // 회원 id → 가져온 칩(대기실에서 앉을 때 보유 칩에서 빠짐)
    this.hostId = host.id;
    this.tid = host.acct.tid || 'main';   // 같은 사업장 사람만 들어올 수 있음
    this.rakeReal = 0;                     // 이 방에서 사람에게서 뗀 수수료
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
      isHost: u.id === this.hostId, fillBots: this.fillBots, sb: this.sb, bb: this.bb, minIn: this.minIn, rake: rakeOf(this.tid, this.bb, this.mode),
      mySeat: this.seats.get(u.id) || 0,
      members: this.members.map((m) => ({ pid: m.pid, name: m.acct.name, avatar: m.acct.avatar, online: !!m.ws, host: m.id === this.hostId, seat: this.seats.get(m.id) || 0 })),
    };
  }
  sendRoom() { this.members.forEach((m) => send(m, this.roomMsg(m))); }
  paid() { return this.mode !== 'daily'; }
  label() { return this.mode === 'solo' ? 'AI 대결' : '친구 대전 ' + this.code; }

  // 앉기: 내가 고른 만큼 보유 칩에서 테이블로(최소 머니 이상, 보유 칩 이하)
  sit(u, amount) {
    if (!this.paid() || this.status !== 'lobby') return 'now';
    if (this.seats.get(u.id)) return '';
    amount = Math.round(Number(amount) || 0);
    if (amount < this.minIn) return `최소 ${this.minIn.toLocaleString()} 이상 가져와야 해요`;
    if (amount > u.acct.balance) return `보유 칩(${u.acct.balance.toLocaleString()})보다 많이 가져올 수 없어요`;
    u.acct.balance -= amount; u.acct.inPlay = amount;
    this.seats.set(u.id, amount);
    log(u.acct, 'buyin', -amount, this.label() + ' 입장(가져간 칩)');
    pushMe(u.id);
    return '';
  }
  unsit(u, reason) {
    const amt = this.seats.get(u.id);
    if (!amt) return;
    this.seats.delete(u.id);
    u.acct.balance += amt; u.acct.inPlay = 0;
    log(u.acct, 'cashout', amt, this.label() + ' ' + (reason || '대기실에서 나감'));
    pushMe(u.id);
  }

  start() {
    clearTimeout(this.timer);
    // 모두 칩을 가져와 앉아야 시작
    if (this.paid() && this.members.some((m) => !this.seats.get(m.id))) return 'seat';
    if (this.mode === 'friends' && this.members.length < 2 && !this.fillBots) return 'few';
    this.status = 'playing';
    this.waitUntil = 0;
    this.seed = this.mode === 'daily' ? 'daily:' + this.date : rid(8);
    const g = (this.game = new H.Game({ seed: this.seed }));
    for (const m of this.members) {
      const stack = this.paid() ? this.seats.get(m.id) : DAILY_STACK;
      g.addPlayer({ id: m.pid, name: m.acct.name, stack, avatar: m.acct.avatar });
      g.players[g.players.length - 1].acct = m.id;
    }
    if (this.mode !== 'friends' || this.fillBots) {
      const used = new Set(this.members.map((m) => m.acct.avatar));
      const pool = BOTS.filter((b) => !used.has(b.avatar)).concat(BOTS.filter((b) => used.has(b.avatar)));
      const botStack = this.paid() ? Math.max(this.minIn, this.bb * 100) : DAILY_STACK;
      let k = 0;
      while (g.players.length < MAX_SEATS) {
        const b = pool[k % pool.length];
        g.addPlayer({ id: 'bot' + k, name: b.name, stack: botStack, isBot: true, style: b.style, avatar: b.avatar });
        k++;
      }
    }
    this.seats.clear();   // 이제 칩은 테이블(게임) 위에 있음
    this.sendRoom();
    this.nextHand();
    return '';
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
      if (alive.length < 2 || humansAlive.length === 0) {
        // 칩을 잃은 사람이 리바인할 수 있으면 잠깐 기다림
        const canWait = this.paid() && g.players.some((p) => this.rebuyOk(p));
        if (canWait && this.waitUntil !== -1) {
          if (!this.waitUntil) { this.waitUntil = now() + REBUY_WAIT_MS; this.broadcastState(); }
          clearTimeout(this.timer);
          this.timer = setTimeout(() => { this.waitUntil = -1; this.nextHand(); }, Math.max(0, this.waitUntil - now()));
          return;
        }
        this.waitUntil = 0;
        return this.finish();
      }
      this.waitUntil = 0;
    }
    // 오늘의 토너먼트만 블라인드가 오르고, 일반 방은 방장이 정한 블라인드 고정
    const [sb, bb] = this.mode === 'daily' ? levelFor(g.handNo) : [this.sb, this.bb];
    g.setBlinds(sb, bb);
    g.setRake(rakeOf(this.tid, bb, this.mode));   // 관리자가 바꾸면 다음 핸드부터
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
      if (!this.spokeFor || this.spokeFor !== g.handNo) { this.spokeFor = g.handNo; this.botReactResult(); this.recordRake(); }
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

  // 수수료 집계: 사람이 이긴 몫에서 뗀 것만 사업장 수수료로(AI 칩은 진짜 칩이 아님)
  recordRake() {
    const g = this.game, r = g && g.result;
    if (!r || !r.rake || !this.paid()) return;
    let real = 0;
    for (const pot of r.pots) {
      if (!pot.rake || !pot.winners.length) continue;
      const share = pot.rake / pot.winners.length;
      for (const w of pot.winners) {
        const p = g.players.find((x) => x.id === w);
        const a = p && p.acct && db.accounts[p.acct];
        if (!a) continue;
        real += share; a.rakePaid = Math.round((a.rakePaid || 0) + share);
      }
    }
    real = Math.round(real);
    if (!real) return;
    const st = TEN(this.tid).stats, day = kstDate();
    st.rake += real; st.rakeDays[day] = (st.rakeDays[day] || 0) + real;
    const keep = Object.keys(st.rakeDays).sort(); while (keep.length > 60) delete st.rakeDays[keep.shift()];
    this.rakeReal += real;
    save();
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

  // 리바인: 칩이 BB 40배보다 적고, 지금 핸드에 걸려 있지 않을 때. 금액은 BB 40배 ~ 200배
  rebuyRange() { return { min: this.bb * REBUY_MIN_BB, max: this.bb * REBUY_MAX_BB }; }
  rebuyOk(p) {
    if (!this.paid() || this.status !== 'playing' || !this.game || !p || !p.acct || p.gone) return false;
    const g = this.game, { min } = this.rebuyRange();
    const a = db.accounts[p.acct];
    if (!a || a.balance < min || p.stack >= min) return false;
    return g.stage === 'done' || !p.inHand || p.folded;
  }
  rebuy(u, amount) {
    const g = this.game;
    const p = g && g.players.find((x) => x.id === u.pid);
    const { min, max } = this.rebuyRange();
    if (!this.rebuyOk(p)) return send(u, { t: 'error', msg: `리바인은 칩이 ${min.toLocaleString()}(${REBUY_MIN_BB}BB)보다 적고, 지금 핸드에 참여하지 않을 때 할 수 있어요` });
    amount = Math.round(Number(amount) || 0);
    if (amount < min || amount > max) return send(u, { t: 'error', msg: `리바인은 ${min.toLocaleString()} ~ ${max.toLocaleString()} (${REBUY_MIN_BB}~${REBUY_MAX_BB}BB)이에요` });
    if (amount > u.acct.balance) return send(u, { t: 'error', msg: `보유 칩(${u.acct.balance.toLocaleString()})이 모자라요` });
    u.acct.balance -= amount;
    p.stack += amount; p.rebuys = (p.rebuys || 0) + 1;
    u.acct.inPlay = p.stack;
    log(u.acct, 'rebuy', -amount, `${this.label()} 리바인 ${p.rebuys}회차 (${Math.round(amount / this.bb)}BB)`);
    pushMe(u.id);
    this.members.forEach((m) => send(m, { t: 'rebuy', pid: p.id, name: p.name, amount, stack: p.stack, count: p.rebuys, bb: Math.round(amount / this.bb) }));
    if (this.waitUntil > 0) { this.waitUntil = 0; clearTimeout(this.timer); this.nextHand(); }
    else this.broadcastState();
  }

  broadcastState() {
    const g = this.game;
    const rr = this.rebuyRange();
    for (const m of this.members) {
      const p = g.players.find((x) => x.id === m.pid);
      const rebuy = this.paid() ? { min: rr.min, max: rr.max, can: this.rebuyOk(p), balance: m.acct.balance, count: (p && p.rebuys) || 0 } : null;
      send(m, { t: 'state', view: g.view(m.pid), deadline: this.deadline ? this.deadline - now() : 0, handLimit: DAILY_HANDS, mode: this.mode,
        rebuy, waitRebuy: this.waitUntil > 0 ? this.waitUntil - now() : 0 });
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
    // 친구 대전: 다시 대기실로(각자 칩을 다시 가져와 앉으면 방장이 시작)
    this.status = 'lobby'; this.game = null;
    this.sendRoom();
  }

  finishDaily() {
    clearTimeout(this.timer); clearTimeout(this.nagT);
    if (this.status === 'over') return;
    this.status = 'over';
    const u = this.members[0];
    const me = this.game ? this.game.players[0] : null;
    const score = me ? me.stack : 0;
    const e = dayBoard(this.tid, this.date).entries[this.ownerId];
    if (e) { e.score = score; e.at = now(); e.hands = this.game ? this.game.handNo : 0; }
    save();
    const list = ranking(this.tid, this.date);
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
    this.unsit(u);
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
    for (const m of this.members) this.unsit(m, '방 정리 — 칩 반환');
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
const json32 = express.json({ limit: '32kb' });
app.use((req, res, next) => (req.path === '/super/api/restore' ? next() : json32(req, res, next)));
app.get('/healthz', (req, res) => res.send('ok'));
const msgPage = (title, msg) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="background:#0b0f17;color:#e8e2d0;font-family:sans-serif;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h2>${title}</h2><p>${msg}</p></div>`;
// 사업장 찾기: 사업장 도메인 → /s/주소이름/… → 본사
app.use((req, res, next) => {
  if (req.path.startsWith('/super')) { req.tid = null; return next(); }
  let t = tenantByHost(req.headers.host);
  const q = req.url.indexOf('?');
  const pathname = q < 0 ? req.url : req.url.slice(0, q), query = q < 0 ? '' : req.url.slice(q);
  const m = pathname.match(/^\/s\/([a-z0-9-]{2,30})(\/.*)?$/);
  if (m) {
    const t2 = tenantBySlug(m[1]);
    if (!t2) return res.status(404).send(msgPage('없는 주소예요', '주소를 다시 확인해 주세요.'));
    if (!m[2]) return res.redirect(302, '/s/' + m[1] + '/' + query);
    t = t2; req.url = m[2] + query; req.base = '/s/' + m[1];
  }
  t = t || db.tenants.main;
  if (!t.active) return res.status(403).send(msgPage('운영이 멈춘 곳이에요', '자세한 내용은 운영자에게 문의해 주세요.'));
  req.tid = t.id;
  next();
});
app.get('/api/config', (req, res) => res.json({ testPin: SET(req.tid).testPin || '', name: TEN(req.tid).name, main: req.tid === 'main' }));
app.get('/api/daily', (req, res) => {
  const id = db.sessions[String(req.query.token || '')];
  const acctId = id && db.accounts[id] && db.accounts[id].tid === req.tid ? id : null;
  res.json(dailyInfo(req.tid, acctId));
});

// ----- 관리자 -----
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { ADMIN_PASSWORD = rid(9); console.log('[관리자] ADMIN_PASSWORD 환경 변수가 없어 임시 비밀번호를 만들었어요:', ADMIN_PASSWORD); }
const adminTokens = new Map(); // token → { exp, tid(사업장 관리자) | sup(슈퍼 관리자) }
const adminFails = new Map();  // 사업장 → { n, until }
function adminAuth(req, res, next) {
  const t = req.get('x-admin-token') || '';
  const k = adminTokens.get(t);
  if (!k || k.exp < now() || !(k.sup || k.tid === req.tid)) { if (k && k.exp < now()) adminTokens.delete(t); return res.status(401).json({ error: '다시 로그인해 주세요' }); }
  req.sup = !!k.sup;
  next();
}
// 이 사업장 회원만
const acctIn = (req) => { const a = db.accounts[req.params.id]; return a && a.tid === req.tid ? a : null; };
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function checkFail(key) { const f = adminFails.get(key); return f && f.until > now(); }
function addFail(key) { const f = adminFails.get(key) || { n: 0, until: 0 }; f.n++; if (f.n >= 5) { f.until = now() + 60e3; f.n = 0; } adminFails.set(key, f); }
app.post('/admin/api/login', (req, res) => {
  const key = 'a:' + req.tid;
  if (checkFail(key)) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요' });
  const pw = String((req.body || {}).password || '');
  const T = TEN(req.tid);
  const sup = safeEq(pw, ADMIN_PASSWORD);   // 슈퍼 관리자는 모든 사업장 관리자 페이지에 들어갈 수 있음
  const own = !sup && T.adminSalt && safeEq(hashPin(pw, T.adminSalt), T.adminHash);
  if (!sup && !own) { addFail(key); return res.status(401).json({ error: '비밀번호가 틀렸어요' }); }
  adminFails.delete(key);
  const t = rid(24); adminTokens.set(t, { exp: now() + 12 * 3600e3, tid: req.tid, sup });
  res.json({ token: t });
});
function userRow(a) {
  const u = users.get(a.id);
  const room = u && u.room ? rooms.get(u.room) : null;
  return { id: a.id, name: a.name, avatar: a.avatar, status: a.status, balance: a.balance, inPlay: a.inPlay || 0,
    online: !!(u && u.ws), approved: !!(u && u.approved), req: u && u.req ? u.req : 0,
    room: room ? { code: room.code, mode: room.mode, status: room.status } : null,
    createdAt: a.createdAt, lastSeen: u && u.ws ? now() : a.lastSeen || 0, note: a.note || '', rakePaid: a.rakePaid || 0 };
}
app.get('/admin/api/state', adminAuth, (req, res) => {
  const accts = Object.values(db.accounts).filter((a) => a.tid === req.tid);
  const T = TEN(req.tid), day = kstDate();
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
      rakeTotal: T.stats.rake, rakeToday: T.stats.rakeDays[day] || 0, rakeDays: T.stats.rakeDays,
    },
    tenant: { id: T.id, name: T.name, slug: T.slug, sup: req.sup },
    blinds: BLINDS,
    users: rows.sort((a, b) => (b.online - a.online) || (b.req - a.req) || a.name.localeCompare(b.name)),
    rooms: [...rooms.values()].filter((r) => r.tid === req.tid).map((r) => ({ code: r.code, mode: r.mode, status: r.status, hand: r.game ? r.game.handNo : 0, sb: r.sb, bb: r.bb, minIn: r.minIn, rake: r.rakeReal,
      players: r.game ? r.game.players.map((p) => ({ name: p.name, stack: p.stack, bot: !!p.isBot, gone: !!p.gone })) : r.members.map((m) => ({ name: m.acct.name, stack: 0, bot: false })),
      createdAt: r.createdAt })),
    settings: SET(req.tid),
  });
});
app.get('/admin/api/logs', adminAuth, (req, res) => {
  const acct = req.query.acct ? Number(req.query.acct) : null;
  const type = req.query.type || '';
  const limit = Math.min(1000, Number(req.query.limit) || 300);
  let list = db.logs.filter((l) => (l.tid || 'main') === req.tid);
  if (acct) list = list.filter((l) => l.acct === acct);
  if (type) list = list.filter((l) => l.type === type);
  res.json({ logs: list.slice(-limit).reverse() });
});
app.post('/admin/api/signup/:id', adminAuth, (req, res) => {
  const a = acctIn(req);
  if (!a) return res.status(404).json({ error: '회원이 없어요' });
  if (req.body.approve) {
    if (a.status !== 'pending' && a.status !== 'rejected') return res.json({ ok: true });
    a.status = 'active'; a.approvedAt = now();
    save();
    if (SET(a.tid).welcomeChips > 0) addMoney(a, SET(a.tid).welcomeChips, 'welcome', '가입 승인 지급', 'admin');
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
  if (req.params.id === 'all') { for (const u of users.values()) if (u.req && u.acct.tid === req.tid) approveEntry(u, true); return res.json({ ok: true }); }
  const u = users.get(Number(req.params.id));
  if (!u || u.acct.tid !== req.tid) return res.status(404).json({ error: '접속 중이 아니에요' });
  approveEntry(u, !!req.body.approve);
  res.json({ ok: true });
});
app.post('/admin/api/money/:id', adminAuth, (req, res) => {
  const a = acctIn(req);
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
  const a = acctIn(req);
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
  const S = SET(req.tid);
  const num = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v))));
  if (b.welcomeChips != null) S.welcomeChips = num(b.welcomeChips, 0, 1e8);
  if (b.buyIn != null) S.buyIn = num(b.buyIn, 1000, 1e8);
  if (b.minBuyIn != null) S.minBuyIn = num(b.minBuyIn, 200, S.buyIn);
  if (b.autoApprove != null) {
    const was = S.autoApprove; S.autoApprove = !!b.autoApprove;
    if (S.autoApprove && !was) {   // 켜는 순간 기다리던 가입·입장도 한꺼번에 승인
      for (const a of Object.values(db.accounts)) if (a.tid === req.tid && a.status === 'pending') {
        a.status = 'active'; a.approvedAt = now();
        if (S.welcomeChips > 0) addMoney(a, S.welcomeChips, 'welcome', '가입 지급(자동 승인)', 'admin');
        pushMe(a.id);
      }
      for (const u of users.values()) if (u.req && u.acct.tid === req.tid) approveEntry(u, true);
    }
  }
  if (b.testPin != null) { const t = String(b.testPin).trim(); if (t && !/^\d{4,6}$/.test(t)) return res.status(400).json({ error: '테스트 PIN은 숫자 4~6자리(비우면 끔)' }); S.testPin = t; }
  // 수수료: 블라인드(BB)별 % 와 최대(BB 배수)
  if (b.rake && typeof b.rake === 'object') {
    const R = S.rake, x = b.rake;
    if (x.on != null) R.on = !!x.on;
    if (x.nfnd != null) R.nfnd = !!x.nfnd;
    if (x.solo != null) R.solo = !!x.solo;
    if (x.friends != null) R.friends = !!x.friends;
    if (x.levels && typeof x.levels === 'object') {
      for (const [, bb] of BLINDS) {
        const L = x.levels[bb];
        if (!L) continue;
        const pct = Number(L.pct), capBB = Number(L.capBB);
        if (!(pct >= 0 && pct <= 20)) return res.status(400).json({ error: `${bb.toLocaleString()} 블라인드: 수수료는 0~20%` });
        if (!(capBB >= 0 && capBB <= 1000)) return res.status(400).json({ error: `${bb.toLocaleString()} 블라인드: 최대는 0~1000BB` });
        R.levels[bb] = { pct: Math.round(pct * 100) / 100, capBB: Math.round(capBB * 10) / 10 };
      }
    }
    for (const u of users.values()) if (u.acct.tid === req.tid) pushMe(u.id);
  }
  save();
  res.json({ ok: true, settings: S });
});
// ----- 슈퍼 관리자(분양 관리) -----
function superAuth(req, res, next) {
  const k = adminTokens.get(req.get('x-admin-token') || '');
  if (!k || k.exp < now() || !k.sup) return res.status(401).json({ error: '다시 로그인해 주세요' });
  next();
}
app.post('/super/api/login', (req, res) => {
  if (checkFail('super')) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요' });
  if (!safeEq(String((req.body || {}).password || ''), ADMIN_PASSWORD)) { addFail('super'); return res.status(401).json({ error: '비밀번호가 틀렸어요' }); }
  adminFails.delete('super');
  const t = rid(24); adminTokens.set(t, { exp: now() + 12 * 3600e3, tid: null, sup: true });
  res.json({ token: t });
});
// 데이터 옮기기(다른 서버로 이전): 전체 백업 내려받기 / 백업 파일로 되살리기
app.get('/super/api/backup', superAuth, (req, res) => {
  saveNow();
  const name = 'royal-holdem-backup-' + kstDate() + '.json';
  res.set('content-disposition', 'attachment; filename="' + name + '"');
  res.type('application/json').send(JSON.stringify(db));
});
app.post('/super/api/restore', superAuth, express.json({ limit: '200mb' }), (req, res) => {
  const b = req.body;
  if (!b || typeof b !== 'object' || typeof b.accounts !== 'object' || typeof b.tenants !== 'object' || !Array.isArray(b.logs)) return res.status(400).json({ error: '홀덤 백업 파일이 아니에요' });
  try {
    fs.writeFileSync(DB_FILE + '.before-restore', JSON.stringify(db));
    fs.writeFileSync(DB_FILE, JSON.stringify(b));
  } catch (e) { return res.status(500).json({ error: '저장 실패: ' + e.message }); }
  frozen = true;
  res.json({ ok: true, members: Object.keys(b.accounts).length, tenants: Object.keys(b.tenants).length });
  // 되살린 파일로 다시 시작(Railway가 자동으로 다시 켬)
  setTimeout(() => process.exit(1), 800);
});
function tenantRow(T) {
  const accts = Object.values(db.accounts).filter((a) => a.tid === T.id);
  const online = [...users.values()].filter((u) => u.ws && u.acct.tid === T.id).length;
  const day = kstDate();
  return { id: T.id, name: T.name, slug: T.slug, domains: T.domains, active: T.active, createdAt: T.createdAt, hasPw: !!T.adminSalt, memo: T.memo || '',
    members: accts.filter((a) => a.status === 'active').length, pending: accts.filter((a) => a.status === 'pending').length, online,
    chips: accts.reduce((s, a) => s + (a.balance || 0) + (a.inPlay || 0), 0),
    playing: [...rooms.values()].filter((r) => r.tid === T.id && r.status === 'playing').length,
    rakeTotal: T.stats.rake, rakeToday: T.stats.rakeDays[day] || 0, rakeDays: T.stats.rakeDays };
}
app.get('/super/api/tenants', superAuth, (req, res) => {
  res.json({ now: now(), tenants: Object.values(db.tenants).sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : (a.createdAt || 0) - (b.createdAt || 0))).map(tenantRow) });
});
// 이름·주소·도메인·관리자 비밀번호·운영 여부 확인
function tenantInput(b, T) {
  const out = {};
  if (b.name != null) { const n = String(b.name).trim().slice(0, 30); if (!n) return { error: '사업자 이름을 입력해 주세요' }; out.name = n; }
  if (b.slug != null && (!T || T.id !== 'main')) {
    const sl = String(b.slug).trim().toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(sl)) return { error: '주소 이름은 영문 소문자·숫자·- 2~30자예요' };
    if (RESERVED.has(sl)) return { error: '쓸 수 없는 주소 이름이에요' };
    const o = tenantBySlug(sl); if (o && (!T || o.id !== T.id)) return { error: '이미 쓰는 주소 이름이에요' };
    out.slug = sl;
  }
  if (b.domains != null) {
    const list = String(b.domains).split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean);
    for (const d of list) {
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return { error: `도메인 형식이 맞지 않아요: ${d}` };
      const o = tenantByHost(d); if (o && (!T || o.id !== T.id)) return { error: `다른 사업장이 쓰는 도메인이에요: ${d}` };
    }
    out.domains = [...new Set(list)];
  }
  if (b.adminPassword) { const pw = String(b.adminPassword); if (pw.length < 6) return { error: '관리자 비밀번호는 6자 이상이에요' }; out.adminSalt = rid(12); out.adminHash = hashPin(pw, out.adminSalt); }
  if (b.active != null && (!T || T.id !== 'main')) out.active = !!b.active;
  if (b.memo != null) out.memo = String(b.memo).slice(0, 200);
  return { out };
}
app.post('/super/api/tenant', superAuth, (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.slug) return res.status(400).json({ error: '사업자 이름과 주소 이름을 입력해 주세요' });
  if (!b.adminPassword) return res.status(400).json({ error: '사업장 관리자 비밀번호를 정해 주세요' });
  const r = tenantInput(b, null);
  if (r.error) return res.status(400).json({ error: r.error });
  let id; do { id = 't_' + rid(5).toLowerCase().replace(/[^a-z0-9]/g, 'x'); } while (db.tenants[id]);
  const T = fixTenant(Object.assign({ id, createdAt: now(), domains: [], active: true }, r.out));
  db.tenants[id] = T; save();
  res.json({ ok: true, tenant: tenantRow(T) });
});
app.post('/super/api/tenant/:id', superAuth, (req, res) => {
  const T = db.tenants[req.params.id];
  if (!T) return res.status(404).json({ error: '사업장이 없어요' });
  const r = tenantInput(req.body || {}, T);
  if (r.error) return res.status(400).json({ error: r.error });
  Object.assign(T, r.out);
  if (r.out.active === false) {   // 운영 중지: 그 사업장 접속자 모두 내보냄(칩은 정산)
    for (const u of users.values()) if (u.acct.tid === T.id) kick(u, '운영이 멈췄어요');
  }
  save();
  res.json({ ok: true, tenant: tenantRow(T) });
});
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/super', (req, res) => res.sendFile(path.join(__dirname, 'public', 'super.html')));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m' }));
const server = http.createServer(app);

// ---------- 웹소켓 ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, sock, head) => {
  const pathname = String(req.url || '').split('?')[0];
  const m = pathname.match(/^\/s\/([a-z0-9-]{2,30})\/ws$/);
  if (pathname !== '/ws' && !m) return sock.destroy();
  const t = m ? tenantBySlug(m[1]) : (tenantByHost(req.headers.host) || db.tenants.main);
  if (!t || !t.active) return sock.destroy();
  wss.handleUpgrade(req, sock, head, (ws) => { ws.tid = t.id; wss.emit('connection', ws, req); });
});
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
function createAccount(ws, name, pin, avatar) {
  const salt = rid(12), S = SET(ws.tid);
  const a = { id: db.seq++, tid: ws.tid, name, nameKey: nameKey(name), salt, pinHash: hashPin(pin, salt), avatar: Math.max(0, Math.min(AVATARS - 1, avatar | 0)),
    status: S.autoApprove ? 'active' : 'pending', balance: 0, inPlay: 0, createdAt: now(), lastSeen: now() };
  db.accounts[a.id] = a;
  log(a, 'signup', 0, '가입 신청');
  if (a.status === 'active' && S.welcomeChips > 0) { a.balance += S.welcomeChips; log(a, 'welcome', S.welcomeChips, '가입 지급(자동 승인)'); }
  const token = rid(24); db.sessions[token] = a.id; save();
  attach(ws, a, token);
}
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
      const tp = SET(ws.tid).testPin || '';
      if (!a || a.tid !== ws.tid) return sendWs(ws, { t: 'auth', reason: m.token ? 'expired' : '', testPin: tp });
      if (a.status === 'blocked') return sendWs(ws, { t: 'auth', reason: 'blocked', testPin: tp });
      attach(ws, a);
      return;
    }
    case 'signup': {
      const name = cleanName(m.name), pin = String(m.pin || '');
      if (name.length < 1) return sendWs(ws, { t: 'authError', msg: '닉네임을 입력해 주세요' });
      if (!/^\d{4,6}$/.test(pin)) return sendWs(ws, { t: 'authError', msg: 'PIN은 숫자 4~6자리예요' });
      if (findByName(ws.tid, name)) return sendWs(ws, { t: 'authError', msg: '이미 있는 닉네임이에요' });
      return createAccount(ws, name, pin, m.avatar);
    }
    case 'login': {
      const name = cleanName(m.name), key = ws.tid + ':' + nameKey(name), pin = String(m.pin || '');
      const T = SET(ws.tid).testPin;
      // 테스트 기간: 테스트 PIN이면 누구든 들어옴(없는 닉네임이면 바로 가입 신청)
      if (T && pin === T && name.length >= 1) {
        const a0 = findByName(ws.tid, name);
        if (!a0) return createAccount(ws, name, pin, m.avatar);
        if (a0.status === 'blocked') return sendWs(ws, { t: 'authError', msg: '이용이 막힌 계정이에요. 관리자에게 문의해 주세요' });
        const token = rid(24); db.sessions[token] = a0.id; save();
        attach(ws, a0, token);
        return;
      }
      const f = loginFails.get(key);
      if (f && f.until > now()) return sendWs(ws, { t: 'authError', msg: '여러 번 틀려서 1분 뒤에 다시 해 주세요' });
      const a = findByName(ws.tid, name);
      if (!a || !safeEq(hashPin(pin, a.salt), a.pinHash)) {
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
      sendWs(ws, { t: 'auth', reason: 'logout', testPin: SET(a.tid).testPin || '' });
      return;
    }
    case 'enterReq': {
      if (a.status !== 'active' || u.approved) return send(u, meMsg(u));
      u.req = now();
      if (SET(a.tid).autoApprove) { u.approved = true; u.req = 0; }
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
      const o = roomOpts(m, a.tid);
      if (a.balance < o.minIn) return send(u, { t: 'error', msg: `이 블라인드는 최소 ${o.minIn.toLocaleString()}이 필요해요` });
      const room = new Room('solo', u, o);
      const err = room.sit(u, m.buyIn);
      if (err) { leaveRoom(u, true); return send(u, { t: 'error', msg: err }); }
      room.start();
      break;
    }
    case 'create': {
      if (r) leaveRoom(u, true);
      const o = roomOpts(m, a.tid);
      if (a.balance < o.minIn) return send(u, { t: 'error', msg: `최소 머니 ${o.minIn.toLocaleString()}보다 보유 칩이 적어요` });
      const room = new Room('friends', u, o);
      const err = room.sit(u, m.buyIn);
      if (err) send(u, { t: 'error', msg: err });
      room.sendRoom();
      break;
    }
    case 'roomList': {   // 홈 화면 '친구 대전' 옆 열린 방 목록(같은 사업장만)
      const list = [...rooms.values()].filter((x) => x.mode === 'friends' && x.tid === a.tid && x.status !== 'over' && x.members.length)
        .map((x) => {
          const h = x.members.find((mm) => mm.id === x.hostId) || x.members[0];
          return { code: x.code, host: h.acct.name, hostAva: h.acct.avatar, sb: x.sb, bb: x.bb, minIn: x.minIn, status: x.status,
            count: x.members.length, maxSeats: MAX_SEATS, bots: !!x.fillBots, mine: x.members.includes(u), createdAt: x.createdAt };
        })
        .sort((p, q) => (q.mine - p.mine) || ((p.status === 'lobby' ? 0 : 1) - (q.status === 'lobby' ? 0 : 1)) || (q.createdAt - p.createdAt));
      send(u, { t: 'roomList', list });
      return;
    }
    case 'peek': {   // 들어가기 전에 방 설정 보기(블라인드·최소 머니)
      const room = rooms.get(String(m.code || '').toUpperCase());
      if (!room || room.mode !== 'friends' || room.tid !== a.tid) return send(u, { t: 'error', msg: '방을 찾을 수 없어요' });
      send(u, { t: 'roomInfo', code: room.code, sb: room.sb, bb: room.bb, minIn: room.minIn, rake: rakeOf(room.tid, room.bb, room.mode), status: room.status, count: room.members.length, maxSeats: MAX_SEATS, mine: room.members.includes(u) });
      break;
    }
    case 'sit': {
      if (!r) return;
      const err = r.sit(u, m.buyIn);
      if (err) return send(u, { t: 'error', msg: err === 'now' ? '지금은 칩을 가져올 수 없어요' : err });
      r.sendRoom();
      break;
    }
    case 'join': {
      const code = String(m.code || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.mode !== 'friends' || room.tid !== a.tid) return send(u, { t: 'error', msg: '방을 찾을 수 없어요' });
      if (room.members.includes(u)) { send(u, room.roomMsg(u)); if (room.status === 'playing') room.tick(); return; }
      if (room.status !== 'lobby') return send(u, { t: 'error', msg: '이미 게임이 진행 중인 방이에요' });
      if (room.members.length >= MAX_SEATS) return send(u, { t: 'error', msg: '방이 가득 찼어요' });
      if (a.balance < room.minIn) return send(u, { t: 'error', msg: `이 방은 최소 ${room.minIn.toLocaleString()}이 필요해요` });
      const err = room.sit(u, m.buyIn);
      if (err) return send(u, { t: 'error', msg: err });
      room.add(u);
      break;
    }
    case 'setBots': if (r && r.hostId === u.id && r.status === 'lobby') { r.fillBots = !!m.on; r.sendRoom(); } break;
    case 'start': {
      if (!r || r.hostId !== u.id || r.status !== 'lobby') return;
      const why = r.start();
      if (why === 'seat') send(u, { t: 'error', msg: '모두 칩을 가져와 앉아야 시작할 수 있어요' });
      else if (why === 'few') send(u, { t: 'error', msg: '2명 이상이어야 시작할 수 있어요' });
      break;
    }
    case 'act': if (r) r.act(u, String(m.type), Number(m.amount)); break;
    case 'reveal': if (r) r.reveal(u, Number(m.mask)); break;
    case 'rebuy': if (r) r.rebuy(u, m.amount); break;
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
      const board = dayBoard(a.tid, date);
      if (board.entries[a.id]) {
        const info = dailyInfo(a.tid, a.id);
        return send(u, { t: 'error', msg: `오늘은 이미 도전했어요 (${info.my ? info.my.rank + '위' : ''})` });
      }
      if (r) leaveRoom(u, true);
      board.entries[a.id] = { name: a.name, avatar: a.avatar, score: null, at: now() };
      save();
      const room = new Room('daily', u, { sb: 50, bb: 100, minIn: 0 });
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
