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
const MAX_WATCH = 30;   // 한 방에 관전 포함 최대 인원
const DAILY_STACK = 10000;
const DAILY_HANDS = Number(process.env.DAILY_HANDS) || 30;
const TURN_SEC_DEF = 15;     // 차례 제한 시간(초) 기본값 — 관리자 설정 '차례 시간'으로 바꿈
const AWAY_MS = 4000;
const KICK_TIMEOUTS = 2;      // 친구 대전: 시간 초과가 연속 이만큼이면 방에서 내보냄
const TB_MS = 15000;         // 타임뱅크 한 번 = +15초(차례마다 1번)
const TB_MAX = 3, TB_EVERY = 20;   // 타임뱅크는 처음 3개, 20핸드마다 1개 다시 채움(최대 3)
const HAND_LOG_DAYS = 7;     // 관리자 게임 기록 보관(일)
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
const DEF_SETTINGS = { welcomeChips: 10000, buyIn: 10000, minBuyIn: 1000, autoApprove: false, testPin: '1234', turnSec: TURN_SEC_DEF };
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
// ---------- 게임 기록(관리자용, 핸드마다 한 줄) ----------
// DATA_DIR/hands/날짜(KST).jsonl — 게임번호·시간·방·참가자(카드·시작/끝 칩)·행동 순서·보드·결과. 7일 지나면 지움.
const HAND_DIR = path.join(DATA_DIR, 'hands');
fs.mkdirSync(HAND_DIR, { recursive: true });
const kstDay = (t) => new Date((t || Date.now()) + 9 * 3600e3).toISOString().slice(0, 10);
let handPruned = '';
function writeHand(rec) {
  const day = kstDay(rec.at);
  fs.appendFile(path.join(HAND_DIR, day + '.jsonl'), JSON.stringify(rec) + '\n', () => {});
  if (handPruned !== day) {
    handPruned = day;
    const cut = kstDay(Date.now() - (HAND_LOG_DAYS + 1) * 86400e3);
    fs.readdir(HAND_DIR, (e, list) => { for (const f of list || []) if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.slice(0, 10) < cut) fs.unlink(path.join(HAND_DIR, f), () => {}); });
  }
}
function readHands(days) {
  const out = [];
  for (let k = Math.max(1, Math.min(HAND_LOG_DAYS + 1, days)) - 1; k >= 0; k--) {
    let txt = '';
    try { txt = fs.readFileSync(path.join(HAND_DIR, kstDay(Date.now() - k * 86400e3) + '.jsonl'), 'utf8'); } catch (e) { continue; }
    for (const line of txt.split('\n')) { if (!line) continue; try { out.push(JSON.parse(line)); } catch (e) { /* 잘린 줄 */ } }
  }
  return out;
}

// 즉시 저장(종료·되살리기 때). save()와 같은 임시 파일→이름 바꾸기 방식이라 비동기 저장과 겹쳐도 파일이 반쯤 쓰인 채 남지 않음
function saveNow() { if (frozen) return; clearTimeout(saveT); try { const tmp = DB_FILE + '.now.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); } catch (e) { /* */ } }

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
// 운영 로그(Railway 로그에서 문제 상황을 되짚기용): 방 시작·끝, 끊김·재접속, 시간 초과 퇴장, 화면 오류
function ev(...a) { console.log('[ev]', new Date(now() + 9 * 3600e3).toISOString().slice(5, 19).replace('T', ' '), ...a); }
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
    if (this.seats.size >= MAX_SEATS) return '자리가 다 찼어요';
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
    this.spokeFor = 0; this.hl = null;   // 새 게임: 지난 게임 마지막 핸드 번호가 남아 새 1핸드 기록·수수료를 건너뛰지 않게
    // 오늘의 토너먼트: 모두 같은 카드여야 하므로 날짜 + 서버 비밀값(밖에서 날짜만으로 덱을 계산 못 하게)
    // 그 밖의 방: 핸드마다 암호학적 난수로 섞음(덱을 미리 계산할 방법 없음)
    if (!db.dailySecret) { db.dailySecret = rid(24); save(); }
    this.seed = this.mode === 'daily' ? 'daily:' + this.date + ':' + db.dailySecret : rid(16);
    const deckRng = this.mode === 'daily' ? null : () => () => crypto.randomBytes(4).readUInt32LE(0) / 4294967296;
    const g = (this.game = new H.Game({ seed: this.seed, gid: rid(6), deckRng }));
    if (this.mode === 'friends') {
      // 친구 대전은 항상 9자리: 사람은 고르게 띄워 앉히고, 나머지는 AI 또는 빈자리(나중에 들어온 사람이 앉을 수 있음)
      const k = this.members.length, at = new Map();
      if (k > MAX_SEATS) return 'full';   // 관전자까지 앉아 10명 넘으면 자리가 겹쳐 칩이 사라짐
      this.members.forEach((m, j) => at.set(Math.floor((j * MAX_SEATS) / k), m));
      const used = new Set(this.members.map((m) => m.acct.avatar));
      const pool = BOTS.filter((b) => !used.has(b.avatar)).concat(BOTS.filter((b) => used.has(b.avatar)));
      const botStack = Math.max(this.minIn, this.bb * 100);
      let bk = 0;
      for (let i = 0; i < MAX_SEATS; i++) {
        const m = at.get(i);
        if (m) { g.addPlayer({ id: m.pid, name: m.acct.name, stack: this.seats.get(m.id), avatar: m.acct.avatar }); g.players[i].acct = m.id; }
        else if (this.fillBots) { const b = pool[bk % pool.length]; g.addPlayer({ id: 'bot' + bk, name: b.name, stack: botStack, isBot: true, style: b.style, avatar: b.avatar }); bk++; }
        else g.addPlayer({ id: 'e' + i, empty: true });
      }
      this.botSeq = bk;
    } else for (const m of this.members) {
      const stack = this.paid() ? this.seats.get(m.id) : DAILY_STACK;
      g.addPlayer({ id: m.pid, name: m.acct.name, stack, avatar: m.acct.avatar });
      const gp = g.players[g.players.length - 1];
      gp.acct = m.id; gp.tb = TB_MAX;
    }
    // 게임 기록: 행동·카드 공개를 받아 적음
    const origAct = g.act.bind(g), origRun = g.runoutStep.bind(g);
    g.act = (id, type, amount) => {
      const st = g.stage;
      g.lastAct = null;
      const ok = origAct(id, type, amount);
      if (ok) this.hlAct(st);
      return ok;
    };
    g.runoutStep = () => { origRun(); this.hlBoard(); };
    if (this.mode !== 'friends') {
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
    ev('방 시작', this.mode, this.code, 'tid=' + this.tid, '사람:', this.members.map((m) => m.acct.name).join(','));
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
    this.hlMark(p, 'out', amt);   // 핸드 도중에 나가 정산한 칩(게임 기록 손익에서 '진 칩'으로 잘못 잡히지 않게)
    if (!a) return amt;
    { const uu = users.get(a.id); if (!(uu && uu.room && uu.room !== this.code && rooms.has(uu.room))) a.inPlay = 0; }   // 핸드 중 다른 방으로 옮겨 그 방에 이미 칩을 가져갔으면 그 값은 덮지 않음
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
    this.applyPending();
    this.syncInPlay();
    const alive = g.players.filter((p) => p.stack > 0);
    if (this.endAfterHand && this.mode === 'solo') { ev('AI 대결 자동 종료(끊긴 채 시간 초과)', this.code); return this.finish(); }
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
    const before = new Map(g.players.map((p) => [p, p.stack]));
    g.startHand();
    for (const p of g.players) {
      p.preFold = false; p.preCall = null;
      if (p.acct && p.tb == null) p.tb = TB_MAX;   // 친구 대전·중간에 앉은 사람도 타임뱅크 3개
      if (p.acct && g.handNo % TB_EVERY === 0) p.tb = Math.min(TB_MAX, (p.tb || 0) + 1);
    }
    this.hlBegin(before);
    this.tick();
  }

  tick() { this.schedule(); this.broadcastState(); }

  schedule() {
    const g = this.game;
    // 같은 차례(핸드·행동 번호·단계)에 다시 불리면(재접속·누가 나감·끊김) 남은 시간을 이어 감 — 매번 처음부터 다시 재면 새로고침으로 시간을 무한히 끌 수 있고, 남이 들락날락할 때마다 내 시계가 되돌아감
    const key = g && this.status === 'playing' ? [g.handNo, g.actionSeq, g.stage, g.runout ? 1 : 0, g.toAct].join(':') : '';
    const same = key && key === this.schedKey && this.fireAt > now();
    const left = same ? this.fireAt - now() : 0;   // 같은 상황이면 남은 시간만(결과 화면 4.2초·AI 생각 시간·내 차례 모두)
    this.schedKey = key;
    clearTimeout(this.timer); clearTimeout(this.nagT);
    this.deadline = 0; this.fireAt = 0;
    if (!g || this.status !== 'playing') return;
    const after = (ms, fn) => { ms = same ? Math.min(ms, left) : ms; this.fireAt = now() + ms; this.timer = setTimeout(fn, ms); return ms; };
    if (g.stage === 'done') {
      if (!this.spokeFor || this.spokeFor !== g.handNo) { this.spokeFor = g.handNo; this.botReactResult(); this.recordRake(); this.hlEnd(); }
      after(g.result.type === 'showdown' ? 4200 : 2000, () => this.nextHand());
      return;
    }
    if (g.runout) { after(1200, () => { g.runoutStep(); this.tick(); }); return; }
    const p = g.players[g.toAct];
    if (p.isBot) {
      const rand = this.mode === 'daily' ? H.mulberry32(H.hashSeed(this.seed + ':bot:' + g.handNo + ':' + g.actionSeq)) : Math.random;
      const delay = 600 + (this.mode === 'daily' ? rand() : Math.random()) * 800;
      after(delay, () => {
        const L = g.legal();
        const d = H.botDecide(g, rand);
        g.act(p.id, d.type, d.amount);
        if (d.type === 'fold' && L && L.toCall >= L.pot * 0.4) this.botSay(['p3'], 0.18, p.id);
        else if (p.allIn) this.botSay(['p6'], 0.5, p.id, p.id);
        this.tick();
      });
      return;
    }
    const m = this.members.find((x) => x.pid === p.id);
    // 폴드 예약: 차례가 오면 기다리지 않고 바로 폴드. 체크할 수 있으면 체크하고 예약은 유지(다음에 베팅이 오면 폴드)
    // 콜·체크 예약: 예약한 금액(같은 스트리트) 그대로면 바로 콜/체크, 그사이 누가 더 올렸으면 예약 취소하고 평소처럼 기다림
    if (m && p.preCall && !p.gone) {
      const pc = p.preCall; p.preCall = null;
      if (pc.st === g.stage && g.currentBet <= pc.to) {
        const L = g.legal();
        this.how = 'reserve'; g.act(p.id, L && L.canCheck ? 'check' : 'call'); this.how = ''; p.timeouts = 0;
        return this.schedule();
      }
    }
    if (m && p.preFold && !p.gone) {
      const L = g.legal();
      this.how = 'reserve'; g.act(p.id, 'fold'); this.how = ''; p.timeouts = 0;
      if (!L || !L.canCheck) p.preFold = false;
      return this.schedule();
    }
    const turnMs = this.turnMs();
    let ms = !m || p.gone ? 700 : (!m.ws || p.away) ? AWAY_MS : turnMs;
    if (!same) this.tbKey = '';   // 새 차례면 타임뱅크를 다시 쓸 수 있음(같은 차례면 사용 기록 유지)
    ms = after(ms, () => this.timeout(p));
    this.deadline = this.fireAt;
    if (m && !same && ms === turnMs && turnMs > 9000) this.nagT = setTimeout(() => this.botSay(['p1', 'p12'], 0.6), Math.round(turnMs * 0.6));   // 오래 고민하면 AI가 재촉
  }
  turnMs() { return Math.max(5, Math.min(60, Number(SET(this.tid).turnSec) || TURN_SEC_DEF)) * 1000; }
  // 시간이 다 되면 체크(할 수 없으면 폴드), 다음부터는 자리비움(4초)
  timeout(p) {
    const g = this.game;
    if (!g || g.players[g.toAct] !== p) return;
    const L = g.legal();
    this.how = 'timeout'; g.act(p.id, L && L.canCheck ? 'check' : 'fold'); this.how = '';
    p.away = true;
    p.timeouts = (p.timeouts || 0) + 1;   // 직접 행동하면 0으로
    // 친구 대전: 시간 초과가 연속 2번이면 방에서 내보냄(끊긴 사람이 몇십 판씩 남아 판을 늦추지 않게). 칩은 보유 칩으로 정산
    const m = this.members.find((x) => x.pid === p.id);
    if (this.mode === 'solo' && m && !m.ws && p.timeouts >= KICK_TIMEOUTS + 1) this.endAfterHand = true;   // AI 대결: 끊긴 채 계속 시간 초과면 이 핸드 끝에 정산하고 끝냄(10분 동안 블라인드만 빠지지 않게)
    if (this.mode === 'friends' && m && p.timeouts >= KICK_TIMEOUTS) {
      this.members.forEach((x) => x !== m && send(x, { t: 'toast', msg: `${p.name}님이 응답이 없어 방에서 나갔어요 (시간 초과 ${p.timeouts}번)` }));
      ev('시간 초과 퇴장', this.code, p.name, '접속', !!m.ws);
      send(m, { t: 'kicked', msg: `시간 초과가 ${p.timeouts}번 나서 방에서 나왔어요. 테이블 칩은 보유 칩으로 돌아갔어요.` });
      this.remove(m);
      if (this.status !== 'playing' || !this.game) return;
    }
    this.tick();
  }
  // 타임뱅크: 내 차례에 +15초(차례마다 1번)
  timebank(u) {
    const g = this.game;
    if (!g || this.status !== 'playing' || !this.deadline) return;
    const p = g.players[g.toAct];
    if (!p || p.id !== u.pid || p.away) return;
    const key = g.handNo + ':' + g.actionSeq;
    if (this.tbKey === key) return send(u, { t: 'error', msg: '타임뱅크는 차례마다 한 번만 쓸 수 있어요' });
    if (!(p.tb > 0)) return send(u, { t: 'error', msg: '남은 타임뱅크가 없어요' });
    p.tb--; this.tbKey = key;
    this.deadline += TB_MS; this.fireAt = this.deadline;   // 타임뱅크로 늘어난 시간도 재접속 때 이어지게
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.timeout(p), Math.max(0, this.deadline - now()));
    if (this.hl) this.hl.acts.push({ t: now() - this.hl.at, st: g.stage, n: p.name, a: 'timebank' });
    this.broadcastState();
  }
  setPreFold(u, on) {
    const g = this.game;
    const p = g && g.players.find((x) => x.id === u.pid);
    if (!p || this.status !== 'playing' || g.stage === 'done' || !p.inHand || p.folded || p.allIn) return;
    p.preFold = !!on;
    if (on) { p.preCall = null; p.away = false; p.timeouts = 0; }   // 예약을 누른 것도 '자리에 있다'는 뜻
    if (p.preFold && g.players[g.toAct] === p) return this.tick();   // 이미 내 차례면 바로 행동하고 방송
    this.broadcastState();
  }

  // 콜(체크) 예약: to = 지금 스트리트에서 맞출 금액(지금 걸린 최고 베팅과 같아야 함). null이면 끔
  setPreCall(u, to) {
    const g = this.game;
    const p = g && g.players.find((x) => x.id === u.pid);
    if (!p || this.status !== 'playing' || g.stage === 'done' || !p.inHand || p.folded || p.allIn) return;
    if (to == null) p.preCall = null;
    else {
      to = Math.round(Number(to) || 0);
      if (to !== g.currentBet) return this.broadcastState();   // 그사이 금액이 바뀜 → 화면만 새로
      p.preCall = { to, st: g.stage }; p.preFold = false; p.away = false; p.timeouts = 0;   // 예약을 누른 것도 '자리에 있다'는 뜻
      if (g.players[g.toAct] === p) return this.tick();   // 이미 내 차례면 바로 행동하고 모두에게 방송(schedule만 하면 아무도 모름)
    }
    this.broadcastState();
  }

  // ---------- 게임 기록 ----------
  hlBegin(before) {
    const g = this.game;
    db.handSeq = (db.handSeq || 0) + 1; save();
    const pos = (i) => (i === g.dealer ? 'D' : '') + (i === g.sbIdx ? (i === g.dealer ? '/' : '') + 'SB' : i === g.bbIdx ? 'BB' : '');
    this.hl = {
      no: db.handSeq, at: now(), tid: this.tid, room: this.code, mode: this.mode, hand: g.handNo, sb: g.sb, bb: g.bb,
      rake: g.rake ? g.rake.pct : 0,
      players: g.players.map((p, i) => ({ seat: i, n: p.name, acct: p.acct || null, bot: !!p.isBot, pos: pos(i),
        start: before.get(p) != null ? before.get(p) : p.stack + p.total, hole: p.hole.slice(), in: !!p.inHand })).filter((x) => x.in),
      acts: g.players.map((p, i) => (i === g.sbIdx || i === g.bbIdx || (p.lastAction && p.lastAction.type === 'BB')) && p.lastAction ? { t: 0, st: 'preflop', n: p.name, a: p.lastAction.type, to: p.lastAction.amount } : null).filter(Boolean)   // 새로 앉아 BB를 낸 사람(posting)도 기록
        .sort((a, b) => (a.a === 'SB' ? -1 : b.a === 'SB' ? 1 : 0)),
      board: [],
    };
    this.hl.players.forEach((x) => delete x.in);
  }
  hlAct(st) {
    const g = this.game, hl = this.hl, la = g.lastAct;
    if (!hl || !la) return;
    const p = g.players.find((x) => x.id === la.id);
    const e = { t: now() - hl.at, st, n: p ? p.name : la.id, a: la.type, to: la.to, left: la.stack };
    if (this.how) e.how = this.how;
    hl.acts.push(e);
    this.hlBoard();
  }
  hlBoard() {
    const g = this.game, hl = this.hl;
    if (!hl || g.board.length <= hl.board.length) return;
    const add = g.board.slice(hl.board.length);
    hl.board = g.board.slice();
    hl.acts.push({ t: now() - hl.at, st: g.board.length === 3 ? 'flop' : g.board.length === 4 ? 'turn' : 'river', deal: add });
  }
  // 핸드 도중 칩이 판 밖에서 들어오거나 나간 것(리바인·나가서 정산)을 기록 — 손익 = 끝 + 나간 칩 - 시작 - 리바인
  hlMark(p, key, amt) {
    const hl = this.hl, g = this.game;
    if (!hl || !g) return false;
    const x = hl.players.find((q) => q.seat === g.players.indexOf(p));
    if (!x) return false;
    x[key] = (x[key] || 0) + amt;
    return true;
  }
  hlEnd() {
    const g = this.game, hl = this.hl, r = g.result;
    if (!hl || !r || hl.done) return;
    hl.done = true;
    hl.end = now();
    hl.board = g.board.slice();
    hl.type = r.type;
    hl.rakeAmt = r.rake || 0;
    hl.pots = r.pots.map((x) => ({ amt: x.amount, win: x.winners.map((id) => (g.players.find((p) => p.id === id) || {}).name || id), hand: x.handName || null, refund: !!x.refund }));
    for (const x of hl.players) {
      const p = g.players[x.seat];
      x.end = p.stack; x.net = p.stack + (x.out || 0) - x.start - (x.rebuy || 0);
      x.fold = !!p.folded; x.won = p.won || 0;
      if (r.hands && r.hands[p.id]) x.hn = r.hands[p.id].name;
      if (p.showMask) x.show = p.showMask;
    }
    delete hl.done;
    writeHand(hl);
    this.hl = null;
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

  // ---------- 진행 중에 들어와 자리 차지(관전 → 앉기) ----------
  // 앉을 수 있는 자리: 빈자리, AI 자리, 나가서 정산이 끝난 사람 자리(친구 대전만)
  seatOpen(i) {
    const g = this.game, p = g && g.players[i];
    if (!p || this.mode !== 'friends' || this.status !== 'playing') return false;
    if (this.pending && this.pending.has(i)) return false;
    return p.empty || p.isBot || (p.acct && p.gone && p.cashed);
  }
  seated(u) { return !!(this.game && this.game.players.some((p) => p.id === u.pid && p.acct && !p.gone)) || !!(this.pending && [...this.pending.values()].some((x) => x.u === u)); }
  takeSeat(u, i, amount, post) {
    const g = this.game;
    if (this.mode !== 'friends' || this.status !== 'playing' || !g) return '지금은 앉을 수 없어요';
    if (!this.members.includes(u)) return '방에 먼저 들어오세요';
    if (this.seated(u)) return '이미 자리에 앉아 있어요';
    i = Math.floor(Number(i));
    if (!(i >= 0 && i < g.players.length) || !this.seatOpen(i)) return '그 자리는 비어 있지 않아요';
    amount = Math.round(Number(amount) || 0);
    if (amount < this.minIn) return `최소 ${this.minIn.toLocaleString()} 이상 가져와야 해요`;
    if (amount > u.acct.balance) return `보유 칩(${u.acct.balance.toLocaleString()})보다 많이 가져올 수 없어요`;
    u.acct.balance -= amount; u.acct.inPlay = amount;
    log(u.acct, 'buyin', -amount, this.label() + ' 자리에 앉음(가져간 칩)');
    pushMe(u.id);
    if (!this.pending) this.pending = new Map();
    this.pending.set(i, { u, amount, post: !!post });
    this.applyPending();   // 그 자리가 지금 핸드에 걸려 있지 않으면 바로 앉힘(걸려 있는 AI면 핸드가 끝난 뒤)
    this.members.forEach((m) => send(m, { t: 'seatTaken', pid: u.pid, name: u.acct.name, post: !!post }));
    this.broadcastState();
    return '';
  }
  applyPending() {
    const g = this.game;
    if (!g || !this.pending || !this.pending.size) return;
    for (const [i, x] of [...this.pending]) {
      if (!this.members.includes(x.u)) continue;
      const old = g.players[i];
      if (old && old.inHand && g.stage !== 'done' && g.stage !== 'idle') continue;   // 이번 핸드에 걸린 자리(폴드해도 팟에 칩이 있음) → 핸드가 끝난 뒤
      // 같은 사람이 예전에 나간 자리 기록은 다른 id로(화면에서 헷갈리지 않게)
      g.players.forEach((p, k) => { if (k !== i && p.id === x.u.pid) p.id = p.id + '~' + k; });
      g.seatPlayer(i, { id: x.u.pid, name: x.u.acct.name, stack: x.amount, avatar: x.u.acct.avatar, waitBB: !x.post, postBB: x.post });
      g.players[i].acct = x.u.id;
      this.pending.delete(i);
    }
  }
  refundPending(reason, onlyU) {
    if (!this.pending) return;
    for (const [i, x] of [...this.pending]) {
      if (onlyU && x.u !== onlyU) continue;
      x.u.acct.balance += x.amount; x.u.acct.inPlay = 0;
      log(x.u.acct, 'cashout', x.amount, this.label() + ' ' + reason);
      pushMe(x.u.id);
      this.pending.delete(i);
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
    if (this.hlMark(p, 'rebuy', amount) && this.hl) this.hl.acts.push({ t: now() - this.hl.at, st: g.stage, n: p.name, a: 'rebuy', to: amount });   // 핸드 도중 리바인(폴드한 뒤)은 손익이 아님
    log(u.acct, 'rebuy', -amount, `${this.label()} 리바인 ${p.rebuys}회차 (${Math.round(amount / this.bb)}BB)`);
    pushMe(u.id);
    this.members.forEach((m) => send(m, { t: 'rebuy', pid: p.id, name: p.name, amount, stack: p.stack, count: p.rebuys, bb: Math.round(amount / this.bb) }));
    if (this.waitUntil > 0) { this.waitUntil = 0; clearTimeout(this.timer); this.nextHand(); }
    else this.broadcastState();
  }

  broadcastState() {
    const g = this.game;
    if (!g) return;
    const rr = this.rebuyRange();
    for (const q of g.players) if (q.preCall && (q.preCall.st !== g.stage || g.currentBet > q.preCall.to || q.folded || q.allIn)) q.preCall = null;   // 누가 더 올렸거나 스트리트가 바뀌면 콜 예약 취소
    for (const m of this.members) {
      const p = g.players.find((x) => x.id === m.pid);
      const rebuy = this.paid() ? { min: rr.min, max: rr.max, can: this.rebuyOk(p), balance: m.acct.balance, count: (p && p.rebuys) || 0 } : null;
      const view = g.view(m.pid);
      for (const vp of view.players) {   // 사람 자리 중 연결이 끊긴 사람 표시
        const gp = g.players[vp.seat];
        if (gp && gp.gone) vp.gone = true;   // 나간 사람 자리('칩 없음'으로 탈락한 것처럼 보이지 않게)
        if (!gp || !gp.acct || gp.gone) continue;
        const mm = this.members.find((x) => x.pid === vp.id);
        if (!mm || !mm.ws) vp.off = true;
      }
      if (this.mode === 'friends') {
        const res = this.pending ? [...this.pending].find(([, x]) => x.u === m) : null;
        view.watch = !p || !!p.gone;                       // 관전 중(자리에 안 앉음)
        view.reserved = res ? res[0] : -1;                 // 핸드가 끝나면 앉을 자리
        view.open = view.watch && !res ? g.players.map((_, i) => i).filter((i) => this.seatOpen(i)) : [];
      }
      send(m, { t: 'state', view, deadline: this.deadline ? this.deadline - now() : 0, handLimit: DAILY_HANDS, mode: this.mode,
        rebuy, waitRebuy: this.waitUntil > 0 ? this.waitUntil - now() : 0,
        preFold: !!(p && p.preFold), preCall: p && p.preCall ? p.preCall.to : null, tb: p ? (p.tb || 0) : 0, tbUsed: !!this.tbKey && this.tbKey === g.handNo + ':' + g.actionSeq, turnMs: this.turnMs() });
    }
  }

  act(u, type, amount) {
    if (this.status !== 'playing' || !this.game) return;
    this.lastActive = now();
    const p = this.game.players.find((x) => x.id === u.pid);
    if (p) { p.away = false; p.preFold = false; p.preCall = null; p.timeouts = 0; this.endAfterHand = false; }
    if (this.game.act(u.pid, type, amount)) this.tick();
  }
  reveal(u, mask) {
    if (this.status !== 'playing' || !this.game) return;
    if (this.game.reveal(u.pid, mask)) { this.revealSeq = (this.revealSeq || 0) + 1; this.broadcastState(); }
  }

  finish() {
    clearTimeout(this.timer); clearTimeout(this.nagT);
    if (this.status === 'over') return;
    ev('방 끝', this.mode, this.code, '핸드', this.game ? this.game.handNo : 0);
    this.status = 'over';
    const g = this.game;
    this.refundPending('게임이 끝나 자리 예약 취소 — 칩 반환');
    const standings = g.players.filter((p) => !p.empty && (!p.gone || p.acct)).sort((a, b) => b.stack - a.stack)
      .map((p) => ({ pid: p.id, name: p.name, avatar: p.avatar, stack: p.stack }));
    const cash = {};
    if (g.stage !== 'done') for (const p of g.players) if (p.acct && !p.cashed && p.total > 0) { p.stack += p.total; p.total = 0; p.bet = 0; }   // 핸드 도중 끝나면(모두 나감·오래 방치) 이번 핸드에 건 칩은 각자에게 돌려줌 — 승자를 정할 수 없고, 돌려주지 않으면 그 칩이 사라짐
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
    this.refundPending('자리에 앉기 전에 나감 — 칩 반환', u);
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
    this.refundPending('방 정리 — 칩 반환');
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
  const pw = String((req.body || {}).password || '');
  const T = TEN(req.tid);
  const sup = safeEq(pw, ADMIN_PASSWORD);   // 슈퍼 관리자는 모든 사업장 관리자 페이지에 들어갈 수 있음
  // 잠금은 '틀린 시도'만 막음 — 슈퍼 비밀번호는 잠금 중에도 통과(공격자가 진짜 관리자를 잠그는 DoS 방지).
  // 사업장 비밀번호 검사(scrypt, 약 50ms 동기)는 잠금 확인 뒤에만 — 잠긴 상태에서 반복 요청으로 서버 전체를 느리게 만들지 못하게
  if (!sup && checkFail(key)) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요' });
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
// 게임 기록(최근 7일): 회원별 / 게임번호 / 전체
app.get('/admin/api/hands', adminAuth, (req, res) => {
  const acct = req.query.acct ? Number(req.query.acct) : null;
  const no = req.query.no ? Number(String(req.query.no).replace(/\D/g, '')) : null;
  const days = Math.max(1, Math.min(HAND_LOG_DAYS, Number(req.query.days) || HAND_LOG_DAYS));
  const limit = Math.min(5000, Number(req.query.limit) || 2000);
  let list = readHands(days + 1).filter((h) => h.tid === req.tid && h.at >= now() - days * 86400e3);
  if (no) list = list.filter((h) => h.no === no);
  else if (acct) list = list.filter((h) => h.players.some((p) => p.acct === acct));
  const total = list.length;
  res.json({ total, hands: list.slice(-limit).reverse() });
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
  const num = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : (def != null ? def : min); };   // 숫자가 아니면 NaN이 저장되지 않게
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
  if (b.turnSec != null) { const t = Math.round(Number(b.turnSec)); if (!(t >= 5 && t <= 60)) return res.status(400).json({ error: '차례 시간은 5~60초예요' }); S.turnSec = t; }
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
  if (!safeEq(String((req.body || {}).password || ''), ADMIN_PASSWORD)) { if (checkFail('super')) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요' }); addFail('super'); return res.status(401).json({ error: '비밀번호가 틀렸어요' }); }
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
    for (const u of users.values()) if (u.acct.tid === T.id) { kick(u, '운영이 멈췄어요'); if (u.ws) { try { u.ws.close(); } catch (e) { /* */ } } }
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
const SILENT_MS = 45e3;   // 화면에서 45초 넘게 아무 소식(ping 포함)이 없으면 끊긴 것으로 봄 — 휴대폰 앱을 닫거나 화면이 꺼져도 소켓이 살아 있는 척하던 문제
wss.on('connection', (ws) => {
  ws.isAlive = true; ws.lastRx = now();
  // 오류(너무 큰 프레임 4096바이트 초과·깨진 프레임 등)는 그 연결만 끊음 — 리스너가 없으면 미처리 예외로 서버 전체(모든 방)가 죽음
  ws.on('error', (e) => { try { ws.terminate(); } catch (e2) { /* */ } });
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    ws.lastRx = now();
    if (!TEN(ws.tid).active) return ws.close();   // 운영이 멈춘 사업장: 이미 붙어 있던 연결도 더는 못 씀
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
    if (r) { ev('끊김', r.mode, r.code, u.acct.name, r.status); r.sendRoom(); if (r.status === 'playing' && r.game) { r.schedule(); r.broadcastState(); } }   // 남은 사람 화면에 바로 '연결 끊김'
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
  if (u.ws && u.ws !== ws) { sendWs(u.ws, { t: 'kicked', reason: 'dup', msg: '다른 곳에서 접속했어요. 이 화면은 더 이상 연결되지 않아요.' }); const old = u.ws; u.ws = null; try { old.close(); } catch (e) { /* */ } }   // 옛 연결은 다시 붙지 않음(reason: dup → 화면이 재접속을 멈춤). 서로 밀어내는 핑퐁 방지
  // 오래 끊겼다 들어오면 입장 승인을 다시 받아야 함(접속할 때마다 승인)
  if (u.offAt && now() - u.offAt > APPROVAL_GRACE_MS && !u.room) { u.approved = false; u.req = 0; }
  u.ws = ws; u.offAt = 0; ws.user = u;
  acct.lastSeen = now();
  if (token) sendWs(ws, { t: 'session', token });
  send(u, meMsg(u));
  const r = rooms.get(u.room);
  if (r && u.approved) {
    ev('다시 접속', r.mode, r.code, acct.name); send(u, r.roomMsg(u)); r.sendRoom();
    if (r.status === 'playing' && r.game) { const p = r.game.players.find((x) => x.id === u.pid); if (p) p.away = false; r.tick(); }   // 돌아왔으니 자리비움(4초) 해제. tick은 같은 차례면 남은 시간을 이어 감
  }
  else send(u, { t: 'noRoom' });   // 그사이 방에서 빠졌거나(시간 초과) 게임이 끝났으면 화면을 홈으로
  return u;
}

function handle(ws, m) {
  if (m.t === 'ping') return sendWs(ws, { t: 'pong' });
  if (m.t === 'clientErr') {   // 화면(브라우저)에서 난 오류 — 연결마다 30개까지만
    ws.errN = (ws.errN || 0) + 1;
    if (ws.errN <= 30) console.error('[화면 오류]', ws.user ? ws.user.acct.name : '-', ws.user && ws.user.room ? ws.user.room : '-', String(m.ua || '').slice(0, 120), '|', String(m.msg || '').slice(0, 300), '|', String(m.stack || '').slice(0, 600), '|', String(m.ctx || '').slice(0, 300));
    return;
  }   // 화면 쪽 연결 확인(휴대폰 화면이 꺼졌다 켜진 뒤 죽은 연결을 알아채려고)
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
            count: x.game ? x.game.players.filter((p) => p.acct && !p.gone).length : x.members.length, maxSeats: MAX_SEATS,
            open: x.game ? x.game.players.filter((_, i) => x.seatOpen(i)).length : MAX_SEATS - x.members.length, watchers: x.game ? x.members.filter((mm) => !x.seated(mm)).length : 0, bots: !!x.fillBots, mine: x.members.includes(u), createdAt: x.createdAt };
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
      if (room.status === 'playing') {   // 진행 중: 관전으로 들어와 빈자리·AI 자리를 골라 앉음
        if (room.members.length >= MAX_WATCH) return send(u, { t: 'error', msg: '방이 가득 찼어요' });
        room.add(u); room.broadcastState();
        return;
      }
      if (room.status !== 'lobby') return send(u, { t: 'error', msg: '이미 게임이 진행 중인 방이에요' });
      if (room.members.length >= MAX_SEATS) return send(u, { t: 'error', msg: '방이 가득 찼어요' });
      if (a.balance < room.minIn) return send(u, { t: 'error', msg: `이 방은 최소 ${room.minIn.toLocaleString()}이 필요해요` });
      if (r && r !== room) leaveRoom(u, true);   // 다른 방(대기실·게임)에 앉은 채 들어오면 먼저 그 방 칩을 정산(inPlay가 0으로 덮이는 문제)
      const err = room.sit(u, m.buyIn);
      if (err) return send(u, { t: 'error', msg: err });
      room.add(u);
      break;
    }
    case 'takeSeat': {
      if (!r) return;
      const err = r.takeSeat(u, m.seat, m.buyIn, m.post);
      if (err) send(u, { t: 'error', msg: err });
      break;
    }
    case 'setBots': if (r && r.hostId === u.id && r.status === 'lobby') { r.fillBots = !!m.on; r.sendRoom(); } break;
    case 'start': {
      if (!r || r.hostId !== u.id || r.status !== 'lobby') return;
      const why = r.start();
      if (why === 'seat') send(u, { t: 'error', msg: '모두 칩을 가져와 앉아야 시작할 수 있어요' });
      else if (why === 'few') send(u, { t: 'error', msg: '2명 이상이어야 시작할 수 있어요' });
      else if (why === 'full') send(u, { t: 'error', msg: '자리는 9개예요. 9명까지만 앉을 수 있어요' });
      break;
    }
    case 'act': if (r) { if (m.seq != null && r.game && Number(m.seq) !== r.game.actionSeq) break; r.act(u, String(m.type), Number(m.amount)); } break;   // 화면이 보낸 행동 번호가 지금과 다르면(두 번 터치·늦게 도착) 버림
    case 'reveal': if (r) r.reveal(u, Number(m.mask)); break;
    case 'rebuy': if (r) r.rebuy(u, m.amount); break;
    case 'pre': if (r) { if ('call' in m) r.setPreCall(u, m.call); else r.setPreFold(u, !!m.fold); } break;
    case 'timebank': if (r) r.timebank(u); break;
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
    case 'resync': {   // 화면이 뒤처졌을 때 지금 방·상태를 다시 보냄
      if (!r) return send(u, { t: 'noRoom' });
      send(u, r.roomMsg(u));
      if (r.status === 'playing' && r.game) r.broadcastState();
      break;
    }
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
    if (ws.user && now() - (ws.lastRx || 0) > SILENT_MS) {   // 브라우저가 망 단에서 pong만 자동 응답하고 화면은 멈춘(앱이 뒤로 간) 경우
      ev('응답 없음 → 끊음', ws.user.acct.name, ws.user.room || '-');
      return ws.terminate();
    }
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

// 예상 못 한 오류 하나로 서버(모든 방)가 죽지 않게 — 기록만 남기고 계속. 그래도 죽어야 하면 데이터부터 저장
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => { console.error('[uncaughtException]', e); try { saveNow(); } catch (e2) { /* */ } });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  // 배포로 서버가 다시 켜지면 진행 중인 판은 사라짐(방은 메모리에만 있음) → 멈춘 것처럼 보이지 않게 알리고, 칩은 다시 켜질 때 보유 칩으로 돌려줌
  let n = 0;
  for (const r of rooms.values()) for (const m of r.members) if (m.ws) { send(m, { t: 'restart', mode: r.mode }); n++; }
  ev('서버 종료', sig, '방', rooms.size, '알린 사람', n);
  saveNow();
  setTimeout(() => process.exit(0), n ? 300 : 0);
});
server.on('error', (e) => { console.error('[서버 시작 실패]', e); process.exit(1); });   // 포트 충돌 같은 시작 오류는 위 안전망에 삼켜지지 않고 바로 종료(Railway가 다시 띄움)
server.listen(PORT, () => console.log('로열 홀덤 서버 :' + PORT));
