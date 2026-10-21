// 로열 홀덤 100판 시뮬레이터 — 실제 서버에 웹소켓 봇 클라이언트로 붙어 사람처럼(가끔 엉뚱하게) 치면서 불변식을 점검
// 사용: node sim.js <repoDir> <port> [games]
const path = require('path');
const REPO = path.resolve(process.argv[2]);
const PORT = Number(process.argv[3] || 4100);
const GAMES = Number(process.argv[4] || 100);
const WebSocket = require(path.join(REPO, 'node_modules/ws'));
const H = require(path.join(REPO, 'public/engine.js'));
const BASE = 'http://127.0.0.1:' + PORT;
const ADMIN_PW = process.env.ADMIN_PASSWORD;

const issues = [];   // { kind, game, msg, extra }
const seen = new Map();
function issue(kind, game, msg, extra) {
  const key = kind + '|' + msg;
  seen.set(key, (seen.get(key) || 0) + 1);
  if (seen.get(key) <= 3) issues.push({ kind, game, msg, extra });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

let adminToken = '';
async function api(method, url, body) {
  const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', 'x-admin-token': adminToken }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { raw: t, status: r.status }; }
}

let nameSeq = 0;
class Client {
  constructor(game, tag) {
    this.game = game; this.tag = tag;
    this.name = ('b' + (nameSeq++).toString(36) + tag).slice(0, 10);
    this.msgs = []; this.me = null; this.room = null; this.state = null; this.over = null; this.daily = null;
    this.errors = []; this.waiters = [];
    this.hands = new Map();    // hk → { start sum, rebuys }
    this.behaviour = { afk: 0.03, tb: 0.05, pre: 0.15, reveal: 0.3, junk: 0.02, rebuy: 0.6 };
    this.acted = new Set();
    this.lastStateAt = Date.now();
  }
  async connect() {
    this.ws = new WebSocket(BASE.replace('http', 'ws') + '/ws');
    this.ws.on('message', (d) => this.onMsg(JSON.parse(d)));
    this.ws.on('error', (e) => issue('ws', this.game.id, 'ws error ' + e.message));
    await new Promise((res, rej) => { this.ws.once('open', res); this.ws.once('error', rej); });
    if (this.token) this.send({ t: 'hello', token: this.token });
    else this.send({ t: 'login', name: this.name, pin: '1234', avatar: rnd(0, 8) });
    await this.wait((m) => m.t === 'me', 4000, 'login');
    if (!this.me.approved) { this.send({ t: 'enterReq' }); await this.wait((m) => m.t === 'me' && m.approved, 4000, 'approve'); }
  }
  async reconnect() {
    try { this.ws.terminate(); } catch (e) { /* */ }
    await sleep(rnd(20, 200));
    this.ws = new WebSocket(BASE.replace('http', 'ws') + '/ws');
    this.ws.on('message', (d) => this.onMsg(JSON.parse(d)));
    await new Promise((res) => this.ws.once('open', res));
    this.send({ t: 'hello', token: this.token });
    await this.wait((m) => m.t === 'me', 4000, 'reconnect');
  }
  close() { try { this.ws.close(); } catch (e) { /* */ } }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  wait(pred, ms, what) {
    return new Promise((res, rej) => {
      const w = { pred, res };
      this.waiters.push(w);
      setTimeout(() => { const i = this.waiters.indexOf(w); if (i >= 0) { this.waiters.splice(i, 1); rej(new Error('timeout waiting ' + what + ' (' + this.name + ')')); } }, ms);
    });
  }
  onMsg(m) {
    if (m.t === 'session') this.token = m.token;
    if (m.t === 'me') {
      this.me = m;
      if (m.balance < 0) issue('chips', this.game.id, '보유 칩이 음수', { name: this.name, balance: m.balance });
    }
    if (m.t === 'room') this.room = m;
    if (m.t === 'error') this.errors.push(m.msg);
    if (m.t === 'over') { this.over = m; this.state = null; }
    if (m.t === 'dailyEnd') this.daily = m;
    if (m.t === 'kicked') { if (/시간 초과/.test(m.msg)) { this.game.kicks = (this.game.kicks || 0) + 1; this.inGame = false; this.state = null; } else issue('flow', this.game.id, 'kicked: ' + m.msg); }
    if (m.t === 'state') this.onState(m);
    for (const w of this.waiters.slice()) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m); }
  }
  onState(m) {
    const v = m.view, prev = this.state && this.state.view;
    this.hist = (this.hist || []).slice(-8); if (v) this.hist.push({ hk: v.hk, st: v.stage, seq: v.actionSeq, pot: v.potTotal, ps: v.players.map((p) => `${p.id}:${p.stack}:${p.inHand ? 'H' : '-'}${p.folded ? 'F' : ''}${p.allIn ? 'A' : ''}:${p.total}`).join(' ') });
    this.state = m; this.lastStateAt = Date.now();
    this.game.lastProgress = Date.now();
    if (!v) return issue('proto', this.game.id, 'state without view');
    // 1) 남의 카드가 새지 않는가
    for (const p of v.players) {
      if (p.id === this.me.pid) continue;
      const known = (p.hole || []).filter((c) => c !== '??');
      if (!known.length) continue;
      const okDone = v.stage === 'done' || (v.runout && p.inHand && !p.folded);   // 폴드한 사람 카드는 끝나기 전엔 절대 안 됨
      if (!okDone) issue('leak', this.game.id, '진행 중에 남의 카드가 보임', { stage: v.stage, p: p.name, hole: p.hole, showMask: p.showMask });
    }
    // 2) 한 핸드 안에서 칩 총량 보존(스택 합 + 팟)
    // 살아 있는(폴드 안 한) 사람 스택 + 팟 = 일정(폴드한 사람·빈자리는 리바인·정산·착석으로 바뀔 수 있어 뺌)
    const liveIds = new Set(v.players.filter((p) => p.inHand && !p.folded).map((p) => p.id));
    const h = this.hands.get(v.hk);
    if (h && !h.done) for (const id of [...h.live]) if (!liveIds.has(id)) {   // 방금 폴드한 사람: 그 사람 스택은 이제 계산에서 뺌
      h.live.delete(id);
      const p = v.players.find((x) => x.id === id);
      h.sum -= h.last && h.last.has(id) ? h.last.get(id) : p ? p.stack : 0;   // 폴드 직전 스택(시간 초과로 나가면 폴드와 동시에 정산돼 0이 됨)
    }
    const liveSet = h ? h.live : liveIds;
    const sum = v.players.filter((p) => liveSet.has(p.id)).reduce((s, p) => s + p.stack, 0) + (v.stage === 'done' ? 0 : v.potTotal);
    if (!h) this.hands.set(v.hk, { sum, done: v.stage === 'done', live: liveIds });   // 핸드 끝에 처음 본 경우(늦게 들어옴)는 점검 안 함
    else if (!h.done) {
      const rake = v.stage === 'done' && v.result ? (v.result.rake || 0) : 0;
      const exp = h.sum + (h.adj || 0) - rake;
      if (sum !== exp && v.stage !== 'done') issue('chips', this.game.id, '핸드 중 칩 총량이 바뀜', { hk: v.hk, stage: v.stage, before: h.sum + (h.adj || 0), now: sum });
      if (v.stage === 'done') {
        h.done = true;
        if (sum !== exp) issue('chips', this.game.id, '핸드 끝 칩 총량 불일치', { me: this.me.pid, hk: v.hk, before: h.sum + (h.adj || 0), rake, after: sum, hist: this.hist });
        this.checkResult(v);
      }
    }
    { const hh = this.hands.get(v.hk); if (hh) hh.last = new Map(v.players.map((p) => [p.id, p.stack])); }
    // 3) 음수 스택·베팅
    for (const p of v.players) if (p.stack < 0 || p.bet < 0 || !Number.isFinite(p.stack)) issue('chips', this.game.id, '스택/베팅 이상값', { p: p.name, stack: p.stack, bet: p.bet });
    // 4) 내 차례 legal 일관성
    const me = v.players.find((p) => p.id === this.me.pid);
    if (v.legal) {
      const L = v.legal;
      if (L.minTo > L.maxTo) issue('rules', this.game.id, 'minTo > maxTo', L);
      if (L.toCall < 0) issue('rules', this.game.id, 'toCall 음수', L);
      if (me && L.toCall !== Math.min(v.currentBet - me.bet, me.stack)) issue('rules', this.game.id, 'toCall 계산 불일치', { L, me });
      if (me && (me.folded || me.allIn)) issue('rules', this.game.id, '폴드/올인한 사람에게 차례', { me });
    }
    if (v.stage !== 'done' && !v.runout && v.toAct >= 0) {
      const tp = v.players[v.toAct];
      if (!tp || tp.folded || tp.allIn || !tp.inHand || tp.empty) issue('rules', this.game.id, '행동할 수 없는 자리에 차례', { toAct: v.toAct, tp });
    }
    // 블라인드 자리
    if (v.stage === 'preflop' && v.actionSeq === 0) {
      const inHand = v.players.filter((p) => p.inHand);
      if (inHand.length >= 2) {
        const sbP = v.players[v.sbIdx], bbP = v.players[v.bbIdx];
        if (!bbP || !bbP.inHand) issue('rules', this.game.id, 'BB 자리가 핸드에 없음', { sbIdx: v.sbIdx, bbIdx: v.bbIdx });
        if (inHand.length === 2 && v.sbIdx !== v.dealer) issue('rules', this.game.id, '헤즈업인데 D≠SB', { d: v.dealer, sb: v.sbIdx });
        if (sbP && bbP && sbP.inHand && v.sbIdx === v.bbIdx) issue('rules', this.game.id, 'SB=BB', {});
      }
    }
    this.maybeAct(m, prev);
  }
  checkResult(v) {
    const r = v.result;
    if (!r) return issue('rules', this.game.id, 'done인데 result 없음', {});
    const paid = r.pots.reduce((s, p) => s + p.amount, 0);
    const wonSum = v.players.reduce((s, p) => s + (p.won || 0), 0);
    if (paid !== wonSum) issue('chips', this.game.id, '팟 합 ≠ 승자 받은 합', { paid, wonSum, pots: r.pots });
    if (r.type === 'showdown') {
      const live = v.players.filter((p) => p.inHand && !p.folded);
      if (v.board.length !== 5) issue('rules', this.game.id, '쇼다운인데 보드 5장 아님', { board: v.board });
      for (const p of live) if ((p.hole || []).some((c) => c === '??')) issue('rules', this.game.id, '쇼다운인데 카드 미공개', { p: p.name });
      const score = new Map(live.map((p) => [p.id, H.evaluate(p.hole.concat(v.board)).score]));
      for (const pot of r.pots) {
        if (pot.refund) continue;
        const ws = pot.winners;
        const ws0 = ws.map((id) => score.get(id));
        // 이 팟에 걸린 사람 중 최고점이 승자인지(팟 자격은 total 기준이라 정확히는 서버만 앎 → 승자끼리 같은 점수, 승자보다 높은 사람이 '더 많이 낸' 사람이 아닌지)
        if (new Set(ws0).size > 1) issue('rules', this.game.id, '공동 승자 점수가 다름', { pot, ws0 });
        const best = ws0[0];
        for (const p of live) if (score.get(p.id) > best && p.total >= Math.max(...ws.map((id) => (v.players.find((x) => x.id === id) || {}).total || 0))) issue('rules', this.game.id, '더 좋은 패가 팟을 못 받음', { pot, p: p.name, board: v.board });
      }
    }
  }
  maybeAct(m, prev) {
    const v = m.view;
    // 리바인
    if (m.rebuy && m.rebuy.can && chance(this.behaviour.rebuy) && !this.rebuyAsked) {
      this.rebuyAsked = true;
      const amt = Math.min(m.rebuy.balance, rnd(m.rebuy.min, m.rebuy.max));
      setTimeout(() => { this.send({ t: 'rebuy', amount: chance(0.05) ? -5 : amt }); this.rebuyAsked = false; }, rnd(0, 40));
    }
    // 폴드 뒤/끝난 뒤 패 공개
    const me = v.players.find((p) => p.id === this.me.pid);
    if (me && me.inHand && (me.folded || v.stage === 'done') && !me.showMask && chance(this.behaviour.reveal * 0.8)) this.send({ t: 'reveal', mask: pick([1, 2, 3]) });
    // 엉뚱한 메시지(서버가 버텨야 함)
    if (chance(this.behaviour.junk)) this.send(pick([
      { t: 'act', type: 'raise', amount: 'abc' }, { t: 'act', type: 'cheat' }, { t: 'act', type: 'raise', amount: -1e9 },
      { t: 'act', type: 'raise', amount: 1e15 }, { t: 'rebuy', amount: 1e12 }, { t: 'takeSeat', seat: 99, buyIn: 1 },
      { t: 'pre', call: 'x' }, { t: 'pre', fold: 'yes' }, { t: 'timebank' }, { t: 'reveal', mask: 7 }, { t: 'start' }, { t: 'sit', buyIn: 1e9 },
      { t: 'emote', e: '🔥' }, { t: 'emote', p: 'p1' }, { t: 'act', type: 'call', amount: NaN },
    ]));
    if (!v.legal) {
      // 예약 버튼
      if (me && me.inHand && !me.folded && !me.allIn && v.stage !== 'done' && chance(this.behaviour.pre * 0.3)) {
        if (chance(0.5)) this.send({ t: 'pre', fold: chance(0.8) }); else this.send({ t: 'pre', call: chance(0.85) ? v.currentBet : null });
      }
      return;
    }
    const key = v.hk + ':' + v.actionSeq;
    if (this.acted.has(key)) return;
    this.acted.add(key);
    if (chance(this.behaviour.afk)) return;   // 시간 초과 시키기
    if (chance(this.behaviour.tb)) this.send({ t: 'timebank' });
    const L = v.legal;
    const delay = rnd(0, 60);
    setTimeout(() => {
      const r = Math.random();
      let a;
      if (r < 0.12) a = { type: 'fold' };
      else if (r < 0.55) a = { type: L.canCheck ? 'check' : 'call' };
      else if (r < 0.85 && L.canRaise) a = { type: 'raise', amount: rnd(L.minTo, Math.min(L.maxTo, L.minTo + L.pot)) };
      else if (r < 0.92) a = { type: 'allin' };
      else a = { type: L.canCheck ? 'check' : 'call' };
      this.send({ t: 'act', ...a });
    }, delay);
  }
}

// ---------- 시나리오 ----------
const BL = [100, 200, 500, 1000, 2000];
async function waitOver(game, clients, maxHands, extra) {
  const host = clients[0];
  const t0 = Date.now();
  while (true) {
    await sleep(100);
    if (extra) await extra();
    const live = clients.filter((c) => c.state && !c.over);
    const hn = Math.max(0, ...clients.map((c) => (c.state && c.state.view ? c.state.view.handNo : 0)));
    game.hands = Math.max(game.hands || 0, hn);
    if (clients.every((c) => c.over || c.daily || !c.inGame)) return 'over';
    if (hn >= maxHands) return 'cap';
    if (Date.now() - game.lastProgress > 8000) { issue('stall', game.id, '게임이 8초 넘게 멈춤', { mode: game.mode, hand: hn, errors: clients.map((c) => c.errors.slice(-3)), states: live.map((c) => c.state && { stage: c.state.view.stage, toAct: c.state.view.toAct, wait: c.state.waitRebuy, dl: c.state.deadline }) }); return 'stall'; }
    if (Date.now() - t0 > 240000) { issue('stall', game.id, '게임이 4분 넘게 안 끝남', { hand: hn }); return 'slow'; }
    void host;
  }
}

async function soloGame(game) {
  const c = new Client(game, 's'); await c.connect(); c.inGame = true;
  const bb = pick(BL);
  const minIn = Math.max([1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000].find((x) => x >= bb * 20), 1000);
  const buyIn = chance(0.3) ? minIn : rnd(minIn, Math.min(c.me.balance, bb * 200));
  const bal0 = c.me.balance;
  c.send({ t: 'solo', bb, buyIn });
  game.lastProgress = Date.now();
  const cap = rnd(8, 60);
  let reconnected = false;
  const res = await waitOver(game, [c], cap, async () => {
    if (!reconnected && game.hands >= 3 && chance(0.02)) { reconnected = true; await c.reconnect(); }
  });
  if (res === 'cap') { c.send({ t: 'leave' }); await sleep(150); }
  c.inGame = false;
  await sleep(100);
  game.check.push({ c, bal0 });
  c.close();
  return res;
}

async function friendsGame(game) {
  const n = rnd(1, 4);
  const cs = [];
  for (let i = 0; i < n; i++) { const c = new Client(game, 'f'); await c.connect(); cs.push(c); }
  const host = cs[0];
  const bb = pick(BL);
  const minIn = pick([1000, 2000, 5000, 10000, 20000, 50000].filter((x) => x >= bb * 10));
  const fillBots = n === 1 ? true : chance(0.6);
  const bal0 = new Map(cs.map((c) => [c, c.me.balance]));
  host.send({ t: 'create', bb, minIn, buyIn: rnd(minIn, minIn * 3) });
  const room = await host.wait((m) => m.t === 'room', 3000, 'room');
  if (!fillBots) host.send({ t: 'setBots', on: false });
  for (const c of cs.slice(1)) {
    c.send({ t: 'roomList' });
    const rl = await c.wait((m) => m.t === 'roomList', 3000, 'roomList');
    if (!rl.list.some((x) => x.code === room.code)) issue('flow', game.id, '열린 방 목록에 방이 없음', { code: room.code });
    c.send({ t: 'join', code: room.code, buyIn: rnd(minIn, minIn * 3) });
    await c.wait((m) => m.t === 'room', 3000, 'join');
  }
  await sleep(100);
  for (const c of cs) c.inGame = true;
  host.send({ t: 'start' });
  game.lastProgress = Date.now();
  const cap = rnd(10, 50);
  const late = [];
  let events = 0;
  const res = await waitOver(game, cs.concat(late), cap, async () => {
    // 진행 중 들어와 앉기
    if (late.length < 2 && game.hands >= 2 && chance(0.01)) {
      const c = new Client(game, 'l'); await c.connect(); late.push(c); bal0.set(c, c.me.balance);
      c.send({ t: 'join', code: room.code });
      try {
        const st = await c.wait((m) => m.t === 'state', 3000, 'watch');
        const open = st.view.open || [];
        if (open.length) { c.send({ t: 'takeSeat', seat: pick(open), buyIn: rnd(minIn, minIn * 2), post: chance(0.5) }); c.inGame = true; }
        else { c.send({ t: 'leave' }); }
      } catch (e) { issue('flow', game.id, e.message); }
    }
    // 누군가 나감 / 끊김
    if (events < 3 && game.hands >= 3 && chance(0.008)) {
      events++;
      const c = pick(cs.concat(late).filter((x) => x.inGame));
      if (c) {
        if (chance(0.5)) await c.reconnect();
        else if (c !== host || chance(0.3)) { c.send({ t: 'leave' }); c.inGame = false; }
      }
    }
  });
  const all = cs.concat(late);
  // 끝나면 재대결 한 번(가끔)
  if (res === 'over' && chance(0.3)) {
    const h2 = all.find((c) => c.room && c.room.isHost);
    if (h2) {
      for (const c of all) if (c.room) { c.over = null; c.send({ t: 'sit', buyIn: minIn }); }
      await sleep(200);
      h2.send({ t: 'start' });
      game.lastProgress = Date.now();
      await sleep(1500);
    }
  }
  for (const c of all) { c.send({ t: 'leave' }); c.inGame = false; }
  await sleep(300);
  for (const c of all) { game.check.push({ c, bal0: bal0.get(c) }); c.close(); }
  return res;
}

async function dailyGame(game) {
  const c = new Client(game, 'd'); await c.connect(); c.inGame = true;
  const bal0 = c.me.balance;
  c.send({ t: 'daily' });
  game.lastProgress = Date.now();
  const res = await waitOver(game, [c], 999);
  if (!c.daily) issue('flow', game.id, '토너먼트가 끝났는데 dailyEnd 없음', { res });
  game.check.push({ c, bal0, free: true });
  c.close();
  return res;
}

async function main() {
  adminToken = (await api('POST', '/admin/api/login', { password: ADMIN_PW })).token;
  if (!adminToken) throw new Error('admin login failed');
  await api('POST', '/admin/api/settings', { autoApprove: true, welcomeChips: 2000000 });
  const plan = [];
  for (let i = 0; i < GAMES; i++) plan.push(process.env.SIM_ONLY ? process.env.SIM_ONLY : i % 20 < 9 ? 'solo' : i % 20 < 17 ? 'friends' : 'daily');
  const results = [];
  const CONC = Number(process.env.SIM_CONC || 8);
  let next = 0;
  const t0 = Date.now();
  async function worker() {
    while (next < plan.length) {
      const id = next++;
      const game = { id: id + 1, mode: plan[id], check: [], lastProgress: Date.now() };
      let res;
      try { res = await (game.mode === 'solo' ? soloGame : game.mode === 'friends' ? friendsGame : dailyGame)(game); }
      catch (e) { issue('flow', game.id, game.mode + ': ' + e.message); res = 'error'; }
      results.push({ id: game.id, mode: game.mode, res, hands: game.hands || 0, check: game.check, kicks: game.kicks || 0 });
      process.stdout.write(`#${game.id} ${game.mode} ${res} hands=${game.hands || 0}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  await sleep(1500);
  // ---------- 계정 정산 점검 ----------
  const st = await api('GET', '/admin/api/state');
  const logs = (await api('GET', '/admin/api/logs?limit=1000')).logs;   // 최근 1000개만 → 계정별로 다시
  void logs;
  let acctChecked = 0;
  for (const r of results) for (const { c } of r.check) {
    const row = st.users.find((u) => u.name === c.name);
    if (!row) continue;
    acctChecked++;
    if (row.inPlay !== 0 && !row.room) issue('chips', r.id, '방을 나왔는데 inPlay가 남음', { name: c.name, inPlay: row.inPlay, mode: r.mode });
    if (row.room) issue('flow', r.id, '다 나갔는데 아직 방에 있음', { name: c.name, room: row.room, mode: r.mode });
    const L = (await api('GET', '/admin/api/logs?acct=' + row.id + '&limit=1000')).logs;
    const sum = L.reduce((s, l) => s + (l.amount || 0), 0);
    if (sum !== row.balance + 0 && !(row.inPlay)) issue('chips', r.id, '칩 로그 합 ≠ 보유 칩', { name: c.name, sum, balance: row.balance, mode: r.mode });
  }
  // 게임 기록: 핸드마다 손익 합 = -수수료
  const hands = (await api('GET', '/admin/api/hands?limit=5000')).hands || [];
  let badHands = 0;
  for (const h of hands) {
    const net = h.players.reduce((s, p) => s + (p.net || 0), 0);
    if (net !== -(h.rakeAmt || 0)) { badHands++; if (badHands <= 3) issue('chips', 0, '게임 기록 손익 합 ≠ -수수료', { no: h.no, net, rake: h.rakeAmt, mode: h.mode }); }
  }
  const summary = {
    games: results.length, byMode: results.reduce((o, r) => ((o[r.mode] = (o[r.mode] || 0) + 1), o), {}),
    results: results.reduce((o, r) => ((o[r.res] = (o[r.res] || 0) + 1), o), {}),
    hands: results.reduce((s, r) => s + r.hands, 0), timeoutKicks: results.reduce((s, r) => s + r.kicks, 0), handLogs: hands.length, acctChecked, sec: Math.round((Date.now() - t0) / 1000),
    issueCounts: Object.fromEntries(seen),
  };
  console.log('SUMMARY ' + JSON.stringify(summary, null, 1));
  console.log('ISSUES ' + JSON.stringify(issues, null, 1));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
