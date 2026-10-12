/* 로열 홀덤 — 공용 게임 엔진 (브라우저 + Node 공용)
 * 텍사스 홀덤 노리밋: 블라인드, 4개 베팅 라운드, 사이드팟, 쇼다운, 봇 AI
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Holdem = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RANKS = '23456789TJQKA';
  const SUITS = 'shdc';
  const HAND_NAMES = ['하이카드', '원페어', '투페어', '트리플', '스트레이트', '플러시', '풀하우스', '포카드', '스트레이트 플러시'];

  // ---------- 난수 ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    str = String(str);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function fullDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push(r + s);
    return d;
  }
  function makeDeck(rand) {
    const d = fullDeck();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  // ---------- 족보 판정 ----------
  const rankOf = (c) => RANKS.indexOf(c[0]) + 2;

  function straightHigh(ranks) {
    const has = new Array(15).fill(false);
    for (const r of ranks) { has[r] = true; if (r === 14) has[1] = true; }
    for (let h = 14; h >= 5; h--) {
      if (has[h] && has[h - 1] && has[h - 2] && has[h - 3] && has[h - 4]) return h;
    }
    return 0;
  }
  function mk(cat, ks) {
    let v = cat;
    for (let i = 0; i < 5; i++) v = v * 16 + (ks[i] || 0);
    return { score: v, cat, ks };
  }

  // 5~7장 중 최고 패 점수
  function evaluate(cards) {
    const rs = cards.map(rankOf);
    const suitMap = {};
    for (let i = 0; i < cards.length; i++) (suitMap[cards[i][1]] = suitMap[cards[i][1]] || []).push(rs[i]);
    let flush = null;
    for (const s in suitMap) if (suitMap[s].length >= 5) flush = suitMap[s].slice().sort((a, b) => b - a);
    if (flush) {
      const h = straightHigh(flush);
      if (h) return mk(8, [h]);
    }
    const cnt = new Array(15).fill(0);
    for (const r of rs) cnt[r]++;
    const quads = [], trips = [], pairs = [];
    for (let r = 14; r >= 2; r--) {
      if (cnt[r] === 4) quads.push(r);
      else if (cnt[r] === 3) trips.push(r);
      else if (cnt[r] === 2) pairs.push(r);
    }
    const desc = rs.slice().sort((a, b) => b - a);
    const kick = (excl, n) => desc.filter((r) => !excl.includes(r)).slice(0, n);
    if (quads.length) return mk(7, [quads[0], ...kick([quads[0]], 1)]);
    if (trips.length && (trips.length > 1 || pairs.length)) {
      return mk(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
    }
    if (flush) return mk(5, flush.slice(0, 5));
    const sh = straightHigh(rs);
    if (sh) return mk(4, [sh]);
    if (trips.length) return mk(3, [trips[0], ...kick([trips[0]], 2)]);
    if (pairs.length >= 2) return mk(2, [pairs[0], pairs[1], ...kick([pairs[0], pairs[1]], 1)]);
    if (pairs.length === 1) return mk(1, [pairs[0], ...kick([pairs[0]], 3)]);
    return mk(0, desc.slice(0, 5));
  }

  function handName(ev) {
    if (ev.cat === 8 && ev.ks[0] === 14) return '로열 스트레이트 플러시';
    return HAND_NAMES[ev.cat];
  }

  // 최고 5장 (하이라이트용)
  function bestFive(cards) {
    if (cards.length <= 5) return cards.slice();
    let best = null, bestScore = -1;
    const n = cards.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
      for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
        const combo = [cards[a], cards[b], cards[c], cards[d], cards[e]];
        const s = evaluate(combo).score;
        if (s > bestScore) { bestScore = s; best = combo; }
      }
    return best;
  }

  // ---------- 승률 (몬테카를로) ----------
  function equity(hole, board, nOpp, iters, rand) {
    rand = rand || Math.random;
    nOpp = Math.max(1, nOpp);
    const known = new Set(hole.concat(board));
    const rest = fullDeck().filter((c) => !known.has(c));
    const needBoard = 5 - board.length;
    const need = needBoard + nOpp * 2;
    let win = 0;
    for (let it = 0; it < iters; it++) {
      // 부분 셔플
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(rand() * (rest.length - i));
        const t = rest[i]; rest[i] = rest[j]; rest[j] = t;
      }
      const fb = board.concat(rest.slice(0, needBoard));
      const my = evaluate(hole.concat(fb)).score;
      let best = 0, ties = 0, lost = false;
      for (let o = 0; o < nOpp; o++) {
        const k = needBoard + o * 2;
        const s = evaluate([rest[k], rest[k + 1]].concat(fb)).score;
        if (s > my) { lost = true; break; }
        if (s === my) ties++;
        if (s > best) best = s;
      }
      if (!lost) win += 1 / (ties + 1);
    }
    return win / iters;
  }

  // ---------- 게임 ----------
  class Game {
    constructor(opts) {
      opts = opts || {};
      this.sb = opts.sb || 50;
      this.bb = opts.bb || 100;
      this.seed = opts.seed != null ? String(opts.seed) : String(Math.floor(Math.random() * 4294967296));
      this.players = [];
      this.dealer = -1;
      this.handNo = 0;
      this.stage = 'idle';
      this.board = [];
      this.result = null;
      this.runout = false;
      this.toAct = -1;
      this.actionSeq = 0;
      // 수수료(레이크): { pct: 5, cap: 3000, nfnd: true } — 없으면 안 뗌. 떼어 간 칩은 rakeTotal에 쌓임
      this.rake = null; this.setRake(opts.rake);
      this.rakeTotal = 0;
    }

    setRake(r) { this.rake = r && r.pct > 0 ? { pct: +r.pct, cap: Math.max(0, Math.round(r.cap || 0)), nfnd: r.nfnd !== false } : null; }
    // 이 판에서 뗄 수수료(플랍 전에 끝나면 0)
    rakeFor(base) {
      const R = this.rake;
      if (!R || base <= 0) return 0;
      if (R.nfnd && this.board.length < 3) return 0;
      let x = Math.floor((base * R.pct) / 100);
      if (R.cap > 0) x = Math.min(x, R.cap);
      return Math.max(0, x);
    }

    addPlayer(p) {
      this.players.push({
        id: p.id, name: p.name, stack: p.stack, isBot: !!p.isBot, avatar: p.avatar || 0,
        style: p.style || null, hole: [], bet: 0, total: 0, folded: true, allIn: false,
        acted: false, inHand: false, lastAction: null, raises: 0, away: false,
      });
    }

    setBlinds(sb, bb) { this.sb = sb; this.bb = bb; }

    nextIdx(from, pred) {
      const n = this.players.length;
      for (let k = 1; k <= n; k++) {
        const i = (((from + k) % n) + n) % n;
        if (pred(this.players[i], i)) return i;
      }
      return -1;
    }
    canAct(p) { return p.inHand && !p.folded && !p.allIn; }
    live() { return this.players.filter((p) => p.inHand && !p.folded); }
    potTotal() { return this.players.reduce((s, p) => s + p.total, 0); }

    startHand() {
      const eligible = (p) => p.stack > 0;
      const seated = this.players.filter(eligible);
      if (seated.length < 2) return false;
      this.handNo++;
      this.actionSeq = 0;
      this.deck = makeDeck(mulberry32(hashSeed(this.seed + ':deck:' + this.handNo)));
      this.board = [];
      this.result = null;
      this.runout = false;
      for (const p of this.players) {
        p.hole = []; p.bet = 0; p.total = 0; p.acted = false; p.actedAt = 0; p.lastAction = null; p.raises = 0;
        p.inHand = eligible(p); p.folded = !p.inHand; p.allIn = false; p.won = 0; p.shown = false; p.showMask = 0;
      }
      this.dealer = this.nextIdx(this.dealer, (p) => p.inHand);
      const headsUp = seated.length === 2;
      this.sbIdx = headsUp ? this.dealer : this.nextIdx(this.dealer, (p) => p.inHand);
      this.bbIdx = this.nextIdx(this.sbIdx, (p) => p.inHand);
      // 헤즈업으로 바뀌는 핸드에서 같은 사람이 BB를 두 번 연속 내지 않게 버튼을 넘김(TDA)
      if (headsUp && this.lastBB != null && this.players[this.bbIdx].id === this.lastBB) {
        const t = this.bbIdx; this.bbIdx = this.sbIdx; this.sbIdx = t; this.dealer = t;
      }
      this.lastBB = this.players[this.bbIdx].id;
      this.post(this.sbIdx, this.sb, 'SB');
      this.post(this.bbIdx, this.bb, 'BB');
      this.currentBet = this.bb;
      this.minRaise = this.bb;
      for (let r = 0; r < 2; r++) {
        let i = this.sbIdx;
        do {
          this.players[i].hole.push(this.deck.pop());
          i = this.nextIdx(i, (p) => p.inHand);
        } while (i !== this.sbIdx);
      }
      this.stage = 'preflop';
      this.toAct = this.bbIdx;
      this.advance();
      return true;
    }

    post(i, amt, label) {
      const p = this.players[i];
      const a = Math.min(amt, p.stack);
      p.stack -= a; p.bet += a; p.total += a;
      if (p.stack === 0) p.allIn = true;
      p.lastAction = { type: label, amount: a };
    }

    needsToAct(p) { return this.canAct(p) && (!p.acted || p.bet < this.currentBet); }

    // 다음 행동자 결정 또는 라운드 종료
    advance() {
      const live = this.live();
      if (live.length === 1) return this.finishUncontested(live[0]);
      const actors = live.filter((p) => !p.allIn);
      const pending = actors.filter((p) => this.needsToAct(p));
      // 행동할 수 있는 사람이 하나뿐이면, 다른 사람(올인)들의 최대 베팅 이상이면 더 할 일 없음(짧은 BB 올인 등)
      const maxOther = actors.length === 1 ? Math.max(0, ...live.filter((p) => p !== actors[0]).map((p) => p.bet)) : 0;
      const done = pending.length === 0 || (actors.length === 1 && actors[0].bet >= maxOther);
      if (done) return this.endRound();
      this.toAct = this.nextIdx(this.toAct, (p) => this.needsToAct(p));
    }

    endRound() {
      // 아무도 따라오지 않은 베팅(최고 베팅 - 두 번째 베팅)은 라운드가 끝날 때 바로 돌려줌(실제 딜러처럼)
      const bets = this.players.map((p) => p.bet).sort((a, b) => b - a);
      const extra = bets[0] - (bets[1] || 0);
      if (extra > 0) {
        const top = this.players.find((p) => p.bet === bets[0]);
        top.bet -= extra; top.total -= extra; top.stack += extra;
        if (top.allIn && top.stack > 0) top.allIn = false;
        if (top.lastAction) top.lastAction = Object.assign({}, top.lastAction, { returned: extra });
      }
      for (const p of this.players) {
        p.bet = 0; p.acted = false; p.actedAt = 0; p.raises = 0;
        if (p.lastAction && !p.folded && !p.allIn) p.lastAction = null;
      }
      this.currentBet = 0;
      this.minRaise = this.bb;
      this.toAct = -1;
      const actors = this.live().filter((p) => !p.allIn);
      if (actors.length <= 1) {
        // 올인 상황: 남은 카드를 한 장씩 공개 (컨트롤러가 runoutStep 호출)
        if (this.stage === 'river') return this.showdown();
        this.runout = true;
        return;
      }
      this.dealStreet();
    }

    dealStreet() {
      if (this.stage === 'river') return this.showdown();
      this.deck.pop(); // 번
      if (this.stage === 'preflop') { this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop()); this.stage = 'flop'; }
      else if (this.stage === 'flop') { this.board.push(this.deck.pop()); this.stage = 'turn'; }
      else if (this.stage === 'turn') { this.board.push(this.deck.pop()); this.stage = 'river'; }
      if (!this.runout) {
        this.toAct = this.dealer;
        this.toAct = this.nextIdx(this.dealer, (p) => this.canAct(p));
      }
    }

    runoutStep() {
      if (!this.runout || this.stage === 'done') return;
      if (this.stage === 'river') { this.runout = false; return this.showdown(); }
      this.dealStreet();
    }

    legal() {
      if (this.toAct < 0 || this.stage === 'done' || this.runout) return null;
      const p = this.players[this.toAct];
      const toCall = Math.min(this.currentBet - p.bet, p.stack);
      const maxTo = p.bet + p.stack;
      let minTo = this.currentBet + this.minRaise;
      const others = this.players.some((o) => o !== p && this.canAct(o));
      // 이미 행동한 사람은, 그 뒤로 완전한 레이즈(최소 레이즈 이상)가 있었을 때만 다시 레이즈 가능(TDA)
      const reopened = !p.acted || this.currentBet - p.actedAt >= this.minRaise;
      const canRaise = others && maxTo > this.currentBet && reopened;
      if (minTo > maxTo) minTo = maxTo;
      return {
        toCall, canCheck: toCall === 0, canRaise, minTo, maxTo,
        currentBet: this.currentBet, pot: this.potTotal(), bb: this.bb,
      };
    }

    act(id, type, amount) {
      if (this.stage === 'done' || this.runout || this.toAct < 0) return false;
      const p = this.players[this.toAct];
      if (!p || p.id !== id) return false;
      if (!['fold', 'check', 'call', 'raise', 'allin'].includes(type)) return false;   // 정해진 행동만
      const L = this.legal();
      const put = (a) => { a = Math.min(a, p.stack); p.stack -= a; p.bet += a; p.total += a; if (p.stack === 0) p.allIn = true; };
      let label = type;
      if (type === 'allin') {
        if (L.canRaise) { type = 'raise'; amount = L.maxTo; }
        else type = 'call';
      }
      if (type === 'fold') {
        if (L.canCheck) { type = 'check'; label = 'check'; } else p.folded = true;
      }
      if (type === 'check') {
        if (!L.canCheck) return false;
        label = 'check';
      } else if (type === 'call') {
        if (L.canCheck) label = 'check';
        else { put(L.toCall); label = 'call'; }
      } else if (type === 'raise') {
        if (!L.canRaise) { if (L.canCheck) label = 'check'; else { put(L.toCall); label = 'call'; } }
        else {
          let to = Math.round(Number(amount) || 0);
          to = Math.max(L.minTo, Math.min(L.maxTo, to));
          if (to <= this.currentBet) { put(L.toCall); label = 'call'; }
          else {
            const wasBet = this.currentBet === 0;
            put(to - p.bet);
            const size = to - this.currentBet;
            const full = size >= this.minRaise;
            if (full) this.minRaise = size;
            this.currentBet = to;
            // 완전한 레이즈만 다른 사람의 행동을 다시 엶. 부족한 올인은 콜/폴드만 받으면 됨(베팅이 모자라 차례는 돌아옴)
            if (full) for (const o of this.players) if (o !== p && this.canAct(o)) o.acted = false;
            p.raises++;
            label = wasBet ? 'bet' : 'raise';
          }
        }
      }
      if (p.allIn && label !== 'fold') label = 'allin';
      p.acted = true;
      p.actedAt = this.currentBet;
      p.lastAction = { type: label, amount: p.bet };
      this.actionSeq++;
      this.advance();
      return true;
    }

    // 폴드했거나 핸드가 끝난 뒤 내 카드 공개(1 = 첫 장, 2 = 둘째 장, 3 = 둘 다)
    reveal(id, mask) {
      const p = this.players.find((x) => x.id === id);
      if (!p || !p.inHand || p.hole.length < 2) return false;
      if (!(p.folded || this.stage === 'done')) return false;
      mask = (mask | 0) & 3;
      if (!mask) return false;
      p.showMask = (p.showMask | 0) | mask;
      this.actionSeq++;
      return true;
    }

    buildPots() {
      const contrib = this.players.filter((p) => p.total > 0);
      const live = this.live();
      const levels = [...new Set(live.map((p) => p.total))].sort((a, b) => a - b);
      const pots = [];
      let prev = 0;
      for (const L of levels) {
        let amount = 0;
        for (const p of contrib) amount += Math.max(0, Math.min(p.total, L) - Math.min(p.total, prev));
        const eligible = live.filter((p) => p.total >= L);
        if (amount > 0) pots.push({ amount, eligible, level: L });
        prev = L;
      }
      const assigned = pots.reduce((s, x) => s + x.amount, 0);
      const leftover = this.potTotal() - assigned;
      if (leftover > 0 && pots.length) pots[pots.length - 1].amount += leftover;
      return pots;
    }

    // 그 높이(level)에서 올인한 사람(같은 높이면 딜러 왼쪽부터 첫 사람)
    potOwner(level, col) {
      col = col || ((p) => p.total);
      const c = this.seatOrder(this.live().filter((p) => p.allIn && col(p) === level));
      return c.length ? c[0].id : null;
    }

    // 화면용 팟 나누기: 이미 가운데로 모인 칩만, 올인한 사람이 이길 수 있는 만큼은 그 사람 근처(at), 나머지는 가운데(at=null, 맨 끝)
    viewPots() {
      const col = (p) => p.total - (this.stage === 'done' ? 0 : p.bet);
      const live = this.live();
      const caps = [...new Set(live.filter((p) => p.allIn && (p.bet === 0 || this.stage === 'done')).map(col))].sort((a, b) => a - b);
      const out = [];
      let prev = 0;
      const slice = (lo, hi) => this.players.reduce((s, p) => s + Math.max(0, Math.min(col(p), hi) - Math.min(col(p), lo)), 0);
      for (const L of caps) {
        const amount = slice(prev, L);
        if (amount > 0) out.push({ amount, at: this.potOwner(L, col) });
        prev = L;
      }
      const rest = slice(prev, Infinity);
      if (rest > 0 || !out.length) out.push({ amount: rest, at: null });
      else out[out.length - 1].at = null;   // 남은 게 없으면 마지막 팟이 가운데
      return out;
    }

    // 딜러 왼쪽부터 순서 (홀수 칩 배분용)
    seatOrder(list) {
      const n = this.players.length;
      return list.slice().sort((a, b) => {
        const ia = (this.players.indexOf(a) - this.dealer - 1 + n) % n;
        const ib = (this.players.indexOf(b) - this.dealer - 1 + n) % n;
        return ia - ib;
      });
    }

    showdown() {
      this.runout = false;
      const live = this.live();
      const evals = new Map();
      for (const p of live) {
        const all = p.hole.concat(this.board);
        const ev = evaluate(all);
        evals.set(p, { ev, name: handName(ev), best: bestFive(all) });
        p.shown = true;
      }
      const pots = this.buildPots();
      const out = [];
      // 가운데 팟 = 마지막 다툼 팟. 그 아래 팟은 그 높이에서 올인한 사람 근처에 놓임(화면 연출용)
      let centerIdx = -1;
      pots.forEach((pot, i) => { if (pot.eligible.length > 1) centerIdx = i; });
      const contested = pots.filter((x) => x.eligible.length > 1).reduce((s, x) => s + x.amount, 0);
      let rakeLeft = this.rakeFor(contested);
      const rake = rakeLeft;
      for (const pot of pots) {
        if (pot.eligible.length < 2 || rakeLeft <= 0) continue;
        const t = Math.min(rakeLeft, pot.amount);
        pot.amount -= t; pot.rake = t; rakeLeft -= t;
      }
      this.rakeTotal += rake;
      for (const [pi, pot] of pots.entries()) {
        let bestScore = -1;
        for (const p of pot.eligible) bestScore = Math.max(bestScore, evals.get(p).ev.score);
        const winners = this.seatOrder(pot.eligible.filter((p) => evals.get(p).ev.score === bestScore));
        const share = Math.floor(pot.amount / winners.length);
        let rem = pot.amount - share * winners.length;
        for (const w of winners) {
          const g = share + (rem > 0 ? 1 : 0);
          if (rem > 0) rem--;
          w.stack += g; w.won += g;
        }
        out.push({
          amount: pot.amount, winners: winners.map((w) => w.id),
          handName: evals.get(winners[0]).name,
          refund: pot.eligible.length === 1,
          at: pi < centerIdx ? this.potOwner(pot.level) : null,
          rake: pot.rake || 0,
        });
      }
      const hands = {};
      for (const [p, e] of evals) hands[p.id] = { name: e.name, best: e.best, cat: e.ev.cat };
      this.result = { type: 'showdown', pots: out, hands, rake };
      this.stage = 'done';
      this.toAct = -1;
    }

    finishUncontested(p) {
      // 아무도 따라오지 않은 베팅은 수수료 없이 돌려주고, 나머지에서 수수료
      const otherMax = Math.max(0, ...this.players.filter((x) => x !== p).map((x) => x.bet));
      const uncalled = Math.max(0, p.bet - otherMax);
      const total = this.potTotal();
      const rake = this.rakeFor(total - uncalled);
      this.rakeTotal += rake;
      const amount = total - rake;
      p.stack += amount; p.won = amount;
      this.result = { type: 'fold', pots: [{ amount, winners: [p.id], handName: null, rake }], hands: {}, rake };
      this.stage = 'done';
      this.toAct = -1;
      this.runout = false;
    }

    // 특정 플레이어 시점의 화면 상태 (남의 카드는 가림)
    view(forId) {
      const reveal = (p) => (this.runout || this.stage === 'done') && p.shown || (this.runout && p.inHand && !p.folded && this.live().length > 1);
      const streetBets = this.players.reduce((s, p) => s + p.bet, 0);
      const me = this.players.find((p) => p.id === forId);
      let myHand = null;
      if (me && me.inHand && !me.folded && this.board.length >= 3) myHand = handName(evaluate(me.hole.concat(this.board)));
      const toActP = this.toAct >= 0 ? this.players[this.toAct] : null;
      return {
        stage: this.stage, handNo: this.handNo, hk: this.seed + ':' + this.handNo, board: this.board.slice(),
        pot: this.potTotal() - streetBets, potTotal: this.potTotal(), pots: this.viewPots(),
        currentBet: this.currentBet, rake: this.rake, dealer: this.dealer, sbIdx: this.sbIdx, bbIdx: this.bbIdx,
        toAct: this.toAct, sb: this.sb, bb: this.bb, runout: this.runout, actionSeq: this.actionSeq,
        myHand,
        players: this.players.map((p, i) => ({
          seat: i, id: p.id, name: p.name, stack: p.stack, bet: p.bet, total: p.total,
          folded: p.folded, allIn: p.allIn, inHand: p.inHand, isBot: p.isBot, avatar: p.avatar,
          lastAction: p.lastAction, won: p.won || 0, away: !!p.away,
          hole: p.id === forId || reveal(p) ? p.hole.slice()
            : p.showMask ? p.hole.map((c, k) => (p.showMask & (1 << k) ? c : '??'))
            : (p.inHand && !p.folded ? ['??', '??'] : []),
          showMask: p.showMask || 0,
          rebuys: p.rebuys || 0,
        })),
        legal: toActP && toActP.id === forId ? this.legal() : null,
        result: this.result,
      };
    }
  }

  // ---------- 봇 AI ----------
  const BOT_STYLES = {
    rock: { tight: 0.8, aggr: 0.3, bluff: 0.02 },     // 단단한 수비형
    shark: { tight: 0.5, aggr: 0.75, bluff: 0.08 },   // 공격형 고수
    fish: { tight: 0.1, aggr: 0.25, bluff: 0.03 },    // 아무거나 콜
    maniac: { tight: 0.2, aggr: 0.95, bluff: 0.18 },  // 막 지르는 타입
    pro: { tight: 0.55, aggr: 0.55, bluff: 0.06 },    // 균형형
  };

  function botDecide(game, rand) {
    rand = rand || Math.random;
    const idx = game.toAct;
    const p = game.players[idx];
    const L = game.legal();
    if (!L) return { type: 'check' };
    const st = (typeof p.style === 'string' ? BOT_STYLES[p.style] : p.style) || BOT_STYLES.pro;
    const nOpp = game.live().length - 1;
    const iters = game.board.length === 0 ? 180 : 260;
    const eq = equity(p.hole, game.board, nOpp, iters, rand);
    const base = 1 / (nOpp + 1);
    const rel = eq / base;               // 1 = 평균
    const pot = L.pot;
    const potOdds = L.toCall / (pot + L.toCall);
    const r = rand();
    const bb = L.bb;
    const round = (x) => Math.max(bb / 2, Math.round(x / (bb / 2)) * (bb / 2));
    const sizeTo = (frac) => {
      let to = L.currentBet + Math.max(L.minTo - L.currentBet, round(pot * frac));
      if (to >= L.maxTo * 0.75) to = L.maxTo;
      return Math.min(L.maxTo, Math.max(L.minTo, to));
    };
    const commitRatio = L.toCall / Math.max(1, p.stack + p.bet);

    // 강한 패
    const strong = rel > 1.9 - st.aggr * 0.4 && eq > 0.32;
    const monster = eq > 0.8 || (rel > 2.6 && eq > 0.55);
    if (L.canRaise && p.raises < 2) {
      if (monster && (r < 0.25 + st.aggr * 0.3)) return { type: 'raise', amount: r < 0.15 ? L.maxTo : sizeTo(0.8 + rand() * 0.6) };
      if (strong && r < 0.35 + st.aggr * 0.5) return { type: 'raise', amount: sizeTo(0.45 + rand() * 0.5) };
      // 블러프
      if (r < st.bluff && game.stage !== 'preflop' && nOpp <= 2) return { type: 'raise', amount: sizeTo(0.5 + rand() * 0.4) };
    }
    if (L.canCheck) {
      if (L.canRaise && rel > 1.25 && rand() < st.aggr * 0.45 && p.raises < 1) return { type: 'raise', amount: sizeTo(0.35 + rand() * 0.35) };
      return { type: 'check' };
    }
    // 콜 판단: 승률이 팟 오즈보다 높은가
    let need = potOdds * (1 + st.tight * 0.45) + commitRatio * 0.12 * st.tight;
    if (game.stage === 'preflop') need = Math.max(need, base * (0.8 + st.tight * 0.6));
    if (monster || eq > need) return { type: 'call' };
    // 아주 싸면 그냥 콜
    if (L.toCall <= bb && rand() < 0.5 - st.tight * 0.4) return { type: 'call' };
    return { type: 'fold' };
  }

  return {
    RANKS, SUITS, HAND_NAMES, mulberry32, hashSeed, makeDeck, fullDeck,
    evaluate, handName, bestFive, equity, Game, botDecide, BOT_STYLES,
  };
});
