/* 로열 홀덤 — 클라이언트 */
(function () {
  'use strict';
  const H = window.Holdem;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- 저장소 ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 무시 */ } },
  };
  // 하루퍼즐 사이트 안(iframe)에 붙였을 때: ?embed=1&start=solo|friends|daily&name=닉네임
  const Q0 = new URLSearchParams(location.search);
  const EMBED = Q0.get('embed') === '1' && window.parent !== window;
  function toParent(type) { try { window.parent.postMessage({ holdem: type }, '*'); } catch (e) { /* 무시 */ } }
  const profile = {
    name: store.get('rh_name', ''),
    avatar: store.get('rh_avatar', 5),
    token: store.get('rh_token', null),
  };

  // ---------- 사운드 (WebAudio 합성) ----------
  const Sound = {
    ctx: null, on: store.get('rh_sound', true),
    ensure() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(f, d, type, vol, when, f2) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + (when || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.02);
    },
    noise(d, vol, freq, when) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + (when || 0);
      const len = Math.floor(this.ctx.sampleRate * d);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 3000; f.Q.value = 0.8;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
      s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start(t);
    },
    card(w) { this.noise(0.07, 0.35, 2600, w); },
    flip(w) { this.noise(0.05, 0.25, 4200, w); },
    chip(w) { this.tone(2900, 0.05, 'triangle', 0.09, w); this.tone(3700, 0.05, 'triangle', 0.06, (w || 0) + 0.035); },
    check() { this.tone(180, 0.06, 'square', 0.06); this.tone(170, 0.06, 'square', 0.06, 0.09); },
    fold() { this.noise(0.12, 0.2, 900); },
    turn() { this.tone(988, 0.09, 'sine', 0.1); this.tone(1319, 0.12, 'sine', 0.08, 0.08); },
    allin() { this.tone(220, 0.35, 'sawtooth', 0.06, 0, 440); this.tone(330, 0.35, 'sawtooth', 0.04, 0.05, 660); },
    win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.09)); },
    epic() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.13, i * 0.08)); this.noise(0.6, 0.12, 6000, 0.45); },
    lose() { this.tone(392, 0.2, 'sine', 0.08); this.tone(311, 0.35, 'sine', 0.08, 0.15); },
  };
  document.addEventListener('pointerdown', () => Sound.ensure(), { passive: true });

  // ---------- 공통 UI ----------
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  }
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function modal(html, onMount) {
    $('#modalCard').innerHTML = html;
    $('#modal').classList.add('show');
    if (onMount) onMount($('#modalCard'));
  }
  function closeModal() { $('#modal').classList.remove('show'); }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' && !$('#modal').dataset.lock) closeModal();
    const b = e.target.closest('[data-close]');
    if (b) closeModal();
  });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const avatarSrc = (i) => `img/av${((i % 6) + 6) % 6}.png`;

  // ---------- 카드 DOM ----------
  const SUIT_SYM = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const rankTxt = (r) => (r === 'T' ? '10' : r);
  function faceHTML(c) {
    if (!c || c === '??') return '';
    const s = SUIT_SYM[c[1]];
    return `<span class="rk">${rankTxt(c[0])}</span><span class="st">${s}</span><span class="big">${s}</span>`;
  }
  function cardEl(c, down) {
    const d = document.createElement('div');
    d.className = 'card' + (down ? ' down' : '');
    d.innerHTML = '<div class="inner"><div class="face"></div><div class="back"></div></div>';
    setFace(d, c);
    return d;
  }
  function setFace(el, c) {
    el.dataset.c = c || '';
    const f = el.querySelector('.face');
    f.innerHTML = faceHTML(c);
    f.classList.toggle('r', !!c && (c[1] === 'h' || c[1] === 'd'));
  }
  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  // 덱 위치에서 날아오는 연출
  function flyIn(el, from, delay, scale) {
    const c = center(el);
    const end = getComputedStyle(el).transform;
    const endT = !end || end === 'none' ? 'none' : end;
    el.animate([
      { transform: `translate(${from.x - c.x}px, ${from.y - c.y}px) scale(${scale || 0.55}) rotate(-25deg)`, opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: endT, opacity: 1 },
    ], { duration: 430, delay: delay || 0, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
  }

  // ---------- 좌석 배치 ----------
  const SLOT_POS = [[50, 85], [14, 64], [14, 30], [50, 12], [86, 30], [86, 64]];
  const SLOT_SETS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
  const CENTER = [50, 47];
  const TAG_TXT = { fold: '폴드', check: '체크', call: '콜', bet: '베팅', raise: '레이즈', allin: '올인', SB: 'SB', BB: 'BB' };
  const CHIP_COLORS = ['#e0384d', '#2563eb', '#16a34a', '#111827', '#9333ea', '#d4a017'];

  // ---------- 렌더러 ----------
  const R = {
    v: null, prev: null, myId: null, seatEls: [], betEls: [], deadline: 0, turnKey: '',
    animLock: 0, pendingWinStacks: null,

    reset() {
      this.v = null; this.prev = null; this.seatEls = []; this.betEls = [];
      $('#seats').innerHTML = ''; $('#bets').innerHTML = ''; $('#fx').innerHTML = '';
      $('#board').innerHTML = '<div class="slot"></div>'.repeat(5);
      $('#banner').className = 'banner'; $('#pot').classList.remove('show');
      $('#myHand').classList.remove('show'); $('#dealerBtn').classList.remove('show');
      $('#actions').className = 'actions';
    },
    myIndex(v) { const i = v.players.findIndex((p) => p.id === this.myId); return i; },
    slotPos(v, seat) {
      const n = v.players.length;
      const mi = Math.max(0, this.myIndex(v));
      const rel = (seat - mi + n) % n;
      return SLOT_POS[(SLOT_SETS[n] || SLOT_SETS[6])[rel] ?? rel];
    },
    lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; },
    betPos(v, seat) {
      const p = this.slotPos(v, seat);
      if (p[1] > 80) return [50, 66.5];
      if (p[1] < 20) return [50, 26];
      return this.lerp(p, CENTER, 0.43).map((x, i) => (i === 1 ? x + 2 : x));
    },
    dealerPos(v, seat) {
      const p = this.slotPos(v, seat);
      if (p[1] > 80) return [69, 76];
      if (p[1] < 20) return [33, 18];
      return [p[0] < 50 ? p[0] + 15 : p[0] - 15, p[1] + 7.5];
    },
    tablePt(pct) {
      const r = $('#table').getBoundingClientRect();
      return { x: r.left + (r.width * pct[0]) / 100, y: r.top + (r.height * pct[1]) / 100 };
    },

    build(v) {
      $('#seats').innerHTML = ''; $('#bets').innerHTML = '';
      this.seatEls = v.players.map((p, i) => {
        const el = document.createElement('div');
        el.className = 'seat';
        el.innerHTML = `<div class="cards"></div>
          <div class="ava"><img alt=""><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16.5" pathLength="100"/></svg></div>
          <div class="plate"><div class="nm"></div><div class="stk"></div></div>
          <div class="tag"></div><div class="hn"></div>`;
        $('#seats').appendChild(el);
        return el;
      });
      this.betEls = v.players.map(() => {
        const b = document.createElement('div');
        b.className = 'bet'; b.style.opacity = 0;
        b.innerHTML = '<span class="chip"></span><span class="amt"></span>';
        $('#bets').appendChild(b);
        return b;
      });
      this.layout(v);
    },
    layout(v) {
      v.players.forEach((p, i) => {
        const [x, y] = this.slotPos(v, i);
        const el = this.seatEls[i];
        el.style.left = x + '%'; el.style.top = y + '%';
        el.classList.toggle('me', p.id === this.myId);
        const [bx, by] = this.betPos(v, i);
        const b = this.betEls[i];
        b.style.left = bx + '%'; b.style.top = by + '%';
        b.querySelector('.chip').style.setProperty('--c', CHIP_COLORS[i % CHIP_COLORS.length]);
      });
    },

    render(v, opts) {
      opts = opts || {};
      const prev = this.prev;
      this.v = v;
      if (!prev || prev.players.length !== v.players.length || this.myIndex(prev) !== this.myIndex(v)) this.build(v);
      const newHand = !prev || prev.hk !== v.hk;   // 재대결로 새 게임이면 핸드 번호가 다시 1이라 게임 씨앗까지 같이 비교
      if (newHand) this.newHand(v, prev);
      this.renderBoard(v, prev, newHand);
      this.renderSeats(v, prev, newHand);
      this.renderBets(v, prev, newHand);
      this.renderPot(v);
      this.renderDealer(v);
      this.renderTurn(v, opts.deadline);
      if (v.result && (!prev || !prev.result || newHand)) this.showResult(v);
      if (!v.result) $('#banner').className = 'banner';   // 결과가 없는 동안은 승리 글자를 절대 남기지 않음
      $('#myHand').textContent = v.myHand || '';
      $('#myHand').classList.toggle('show', !!v.myHand && !v.result);
      this.prev = JSON.parse(JSON.stringify(v));
      Actions.render(v);
    },

    newHand(v, prev) {
      $('#banner').className = 'banner';
      $('#fx').innerHTML = '';
      $$('#seats .card, #board .card').forEach((c) => c.remove());
      this.seatEls.forEach((el) => { el.classList.remove('win'); el.querySelector('.hn').textContent = ''; });
      this.pendingWinStacks = null;
      if (prev) Sound.card();
    },

    renderBoard(v, prev, newHand) {
      const slots = $$('#board .slot');
      const from = this.tablePt([50, 27]);
      const had = newHand ? 0 : (prev ? prev.board.length : 0);
      v.board.forEach((c, i) => {
        if (i < had && slots[i].firstChild) return;
        slots[i].innerHTML = '';
        const el = cardEl(c, true);
        slots[i].appendChild(el);
        const delay = (i - had) * 140 + (v.runout ? 150 : 0);
        flyIn(el, from, delay, 0.8);
        setTimeout(() => { el.classList.remove('down'); Sound.flip(); }, delay + 380);
        Sound.card(delay / 1000);
      });
      for (let i = v.board.length; i < 5; i++) slots[i].innerHTML = '';
    },

    renderSeats(v, prev, newHand) {
      const deckPt = this.tablePt([50, 27]);
      const n = v.players.length;
      const winners = new Set();
      if (v.result) v.result.pots.forEach((p) => { if (!p.refund || v.result.pots.length === 1) p.winners.forEach((w) => winners.add(w)); });
      v.players.forEach((p, i) => {
        const el = this.seatEls[i];
        const pp = prev && !newHand ? prev.players[i] : null;
        el.classList.toggle('folded', p.inHand && p.folded);
        el.classList.toggle('out', !p.inHand && p.stack <= 0);
        el.classList.toggle('away', !!p.away);
        el.querySelector('img').src = avatarSrc(p.avatar);
        el.querySelector('.nm').textContent = p.id === this.myId ? (p.name + ' (나)') : p.name;
        let shownStack = p.stack;
        if (v.result && p.won && (!prev || !prev.result || newHand)) {
          shownStack = p.stack - p.won; // 칩이 날아온 뒤 갱신
          const target = p.stack;
          setTimeout(() => this.tickStack(el, target - p.won, target), 1250);
        } else if (v.result && p.won) {
          shownStack = Number(el.dataset.shown || p.stack);
        }
        if (!(v.result && p.won)) el.dataset.shown = p.stack;
        el.querySelector('.stk').textContent = !p.inHand && p.stack <= 0 ? '탈락' : fmt(shownStack);

        // 홀카드
        const box = el.querySelector('.cards');
        const isMe = p.id === this.myId;
        if (newHand || box.children.length !== p.hole.length) {
          box.innerHTML = '';
          const order = (i - v.sbIdx + n) % n;
          p.hole.forEach((c, k) => {
            const down = c === '??' || isMe;
            const ce = cardEl(c === '??' ? null : c, down);
            box.appendChild(ce);
            if (newHand) {
              const delay = 250 + (k * n + order) * 75;
              flyIn(ce, deckPt, delay);
              if (isMe) setTimeout(() => { ce.classList.remove('down'); Sound.flip(); }, delay + 650);
            } else if (isMe) ce.classList.remove('down');
          });
          if (newHand && p.hole.length) Sound.card(0.25 + order * 0.075);
        } else {
          p.hole.forEach((c, k) => {
            const ce = box.children[k];
            if (c !== '??' && ce.dataset.c !== c) {
              setFace(ce, c);
              setTimeout(() => { ce.classList.remove('down'); Sound.flip(); }, 80 + i * 60);
            }
          });
        }

        // 액션 태그
        const tag = el.querySelector('.tag');
        const la = p.lastAction;
        const changed = !pp || JSON.stringify(pp.lastAction) !== JSON.stringify(la);
        if (v.result && winners.has(p.id)) {
          tag.className = 'tag win show'; tag.textContent = '승리';
        } else if (la && !(la.type === 'SB' || la.type === 'BB') || (la && newHand)) {
          tag.className = 'tag ' + la.type + (changed ? '' : ' show');
          tag.textContent = TAG_TXT[la.type] || la.type;
          if (changed) {
            requestAnimationFrame(() => tag.classList.add('show'));
            if (!newHand) {
              if (la.type === 'fold') Sound.fold();
              else if (la.type === 'check') Sound.check();
              else if (la.type === 'allin') Sound.allin();
            }
          }
        } else {
          tag.className = 'tag';
        }
        // 쇼다운 족보
        const hn = el.querySelector('.hn');
        hn.textContent = v.result && v.result.hands && v.result.hands[p.id] ? v.result.hands[p.id].name : '';
      });
    },

    tickStack(el, from, to) {
      const t0 = performance.now();
      const dur = 700;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const val = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        el.querySelector('.stk').textContent = fmt(val);
        if (k < 1) requestAnimationFrame(step); else el.dataset.shown = to;
      };
      requestAnimationFrame(step);
    },

    dispBet(v, p) { return v.stage === 'done' ? 0 : p.bet; },

    renderBets(v, prev, newHand) {
      const potPt = this.tablePt([50, 35.5]);
      v.players.forEach((p, i) => {
        const b = this.betEls[i];
        const amt = this.dispBet(v, p);
        const before = prev && !newHand ? this.dispBet(prev, prev.players[i]) : 0;
        if (amt > before) {
          // 좌석 → 베팅 위치
          const from = center(this.seatEls[i].querySelector('.ava'));
          this.flyChip(from, center(b), CHIP_COLORS[i % CHIP_COLORS.length], () => {});
          Sound.chip(0.05);
        } else if (amt < before && before > 0) {
          // 베팅 → 팟
          this.flyChip(center(b), potPt, CHIP_COLORS[i % CHIP_COLORS.length]);
          Sound.chip(0.1);
        }
        if (newHand && prev) {
          // 새 핸드: 블라인드 칩 날리기
          if (amt > 0) this.flyChip(center(this.seatEls[i].querySelector('.ava')), center(b), CHIP_COLORS[i % CHIP_COLORS.length]);
        }
        b.querySelector('.amt').textContent = fmt(amt);
        b.style.opacity = amt > 0 ? 1 : 0;
      });
    },

    flyChip(from, to, color, done, delay) {
      const fx = $('#fx');
      const tr = $('#table').getBoundingClientRect();
      const c = document.createElement('span');
      c.className = 'chip fly';
      c.style.setProperty('--c', color || '#d4a017');
      c.style.left = from.x - tr.left + 'px'; c.style.top = from.y - tr.top + 'px';
      fx.appendChild(c);
      setTimeout(() => {
        c.style.left = to.x - tr.left + 'px'; c.style.top = to.y - tr.top + 'px';
      }, 20 + (delay || 0));
      setTimeout(() => { c.style.opacity = 0; }, 520 + (delay || 0));
      setTimeout(() => { c.remove(); if (done) done(); }, 860 + (delay || 0));
    },

    renderPot(v) {
      const amt = v.stage === 'done' ? v.potTotal : v.pot;
      $('#potAmt').textContent = fmt(amt);
      $('#pot').classList.toggle('show', amt > 0 && !(v.result && this._potGone === v.hk));
    },

    renderDealer(v) {
      if (v.dealer < 0) return;
      const [x, y] = this.dealerPos(v, v.dealer);
      const d = $('#dealerBtn');
      d.style.left = x + '%'; d.style.top = y + '%';
      d.classList.add('show');
    },

    renderTurn(v, deadline) {
      this.seatEls.forEach((el, i) => el.classList.toggle('turn', v.toAct === i && !v.result));
      const key = v.hk + ':' + v.actionSeq + ':' + v.toAct;
      if (key === this.turnKey) return;
      this.turnKey = key;
      this.seatEls.forEach((el) => { const c = el.querySelector('circle'); c.style.transition = 'none'; c.style.strokeDashoffset = 0; });
      if (v.toAct >= 0 && deadline) {
        const c = this.seatEls[v.toAct].querySelector('circle');
        const ms = Math.max(0, deadline - Date.now());
        void c.getBoundingClientRect();
        requestAnimationFrame(() => {
          c.style.transition = `stroke-dashoffset ${ms}ms linear`;
          c.style.strokeDashoffset = 100;
        });
      }
      if (v.legal) Sound.turn();
    },

    showResult(v) {
      const res = v.result;
      const me = v.players.find((p) => p.id === this.myId);
      const potPt = this.tablePt([50, 35.5]);
      const hand = v.hk;
      // 쇼다운 하이라이트
      if (res.type === 'showdown') {
        const mainPot = res.pots.find((p) => !p.refund) || res.pots[0];
        const wid = mainPot.winners[0];
        const best = new Set((res.hands[wid] || {}).best || []);
        setTimeout(() => {
          if (this.v.hk !== hand) return;
          $$('#board .card').forEach((c) => { c.classList.toggle('best', best.has(c.dataset.c)); c.classList.toggle('dim', !best.has(c.dataset.c)); });
          const wi = v.players.findIndex((p) => p.id === wid);
          if (wi >= 0) Array.from(this.seatEls[wi].querySelectorAll('.cards .card')).forEach((c) => c.classList.toggle('best', best.has(c.dataset.c)));
        }, 700);
      }
      // 팟 → 승자
      setTimeout(() => {
        if (this.v.hk !== hand) return;
        res.pots.forEach((pot, pi) => {
          pot.winners.forEach((w, wi) => {
            const si = v.players.findIndex((p) => p.id === w);
            if (si < 0) return;
            const to = center(this.seatEls[si].querySelector('.ava'));
            for (let k = 0; k < 5; k++) this.flyChip(potPt, to, '#d4a017', null, k * 60 + pi * 120 + wi * 40);
          });
        });
        Sound.chip(); Sound.chip(0.12); Sound.chip(0.24);
        this._potGone = hand;
        setTimeout(() => $('#pot').classList.remove('show'), 400);
        v.players.forEach((p, i) => {
          if (p.won > 0) {
            const pt = this.slotPos(v, i);
            const f = document.createElement('div');
            f.className = 'float-num'; f.textContent = '+' + fmt(p.won);
            f.style.left = pt[0] + '%'; f.style.top = pt[1] + 3 + '%';
            setTimeout(() => $('#fx').appendChild(f), 500);
            this.seatEls[i].classList.add('win');
          }
        });
      }, res.type === 'showdown' ? 1100 : 450);

      // 배너
      const myWin = me && me.won > 0 && res.pots.some((p) => p.winners.includes(me.id) && !(p.refund && res.pots.length > 1));
      const mainPot = res.pots.find((p) => !p.refund) || res.pots[0];
      const handNameTxt = mainPot.handName;
      const cat = res.type === 'showdown' && res.hands[mainPot.winners[0]] ? res.hands[mainPot.winners[0]].cat : -1;
      const winnerNames = mainPot.winners.map((w) => (v.players.find((p) => p.id === w) || {}).name).join(', ');
      const b = $('#banner');
      let t1, t2, cls = '';
      if (myWin) {
        t1 = mainPot.winners.length > 1 ? '스플릿!' : (cat >= 6 ? handNameTxt + '!' : '승리!');
        t2 = '+' + fmt(me.won) + (handNameTxt && cat < 6 ? ' · ' + handNameTxt : '');
      } else {
        t1 = handNameTxt || (winnerNames + ' 승');
        t2 = handNameTxt ? winnerNames + ' 승리' : '모두 폴드';
        cls = 'lose';
      }
      if (cat >= 6) cls += ' epic';
      setTimeout(() => {
        if (this.v.hk !== hand) return;
        b.innerHTML = `<div class="t1">${esc(t1)}</div><div class="t2">${esc(t2)}</div>`;
        b.className = 'banner ' + cls;
        requestAnimationFrame(() => b.classList.add('show'));
        if (myWin) { Sound.win(); this.confetti(cat >= 6 ? 90 : 36); }
        else if (me && me.inHand && !me.folded && res.type === 'showdown') Sound.lose();
        if (cat >= 6) { Sound.epic(); const fl = document.createElement('div'); fl.className = 'flash'; $('#fx').appendChild(fl); if (!myWin) this.confetti(50); }
        if (navigator.vibrate && myWin) try { navigator.vibrate(cat >= 6 ? [60, 40, 120] : 40); } catch (e) { /* */ }
      }, res.type === 'showdown' ? 900 : 300);
    },

    confetti(n) {
      const fx = $('#fx');
      const colors = ['#f2c35b', '#ff4d63', '#3b82f6', '#2fbf71', '#fff', '#c084fc'];
      for (let i = 0; i < n; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.background = colors[i % colors.length];
        c.style.left = 50 + (Math.random() - 0.5) * 20 + '%';
        c.style.top = '35%';
        fx.appendChild(c);
        const dx = (Math.random() - 0.5) * 700, dy = -200 - Math.random() * 300;
        const rot = Math.random() * 720;
        c.animate([
          { transform: 'translate(0,0) rotate(0)', opacity: 1 },
          { transform: `translate(${dx * 0.6}px, ${dy}px) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px, ${dy + 900}px) rotate(${rot}deg)`, opacity: 0 },
        ], { duration: 1800 + Math.random() * 900, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
        setTimeout(() => c.remove(), 2800);
      }
    },

    emote(pid, e) {
      if (!this.v) return;
      const i = this.v.players.findIndex((p) => p.id === pid);
      if (i < 0) return;
      const d = document.createElement('div');
      d.className = 'emo'; d.textContent = e;
      this.seatEls[i].appendChild(d);
      setTimeout(() => d.remove(), 2100);
    },
  };

  // ---------- 액션 패널 ----------
  const Actions = {
    ctrl: null, raising: false, raiseTo: 0, L: null,
    render(v) {
      const a = $('#actions');
      const L = v.legal;
      this.L = L;
      a.classList.toggle('online', !!(this.ctrl && this.ctrl.online && Online.mode !== 'daily'));
      if (L && !v.result) {
        a.classList.add('mine'); a.classList.remove('waiting');
        const fold = $('#foldBtn'), call = $('#callBtn'), raise = $('#raiseBtn');
        fold.disabled = L.canCheck;
        const me = v.players.find((p) => p.id === R.myId);
        if (L.canCheck) call.innerHTML = '체크';
        else if (L.toCall >= me.stack) call.innerHTML = `올인 콜<small>${fmt(L.toCall)}</small>`;
        else call.innerHTML = `콜<small>${fmt(L.toCall)}</small>`;
        raise.disabled = !L.canRaise;
        if (!this.raising) this.raiseTo = L.minTo;
        this.syncRaise();
      } else {
        a.classList.remove('mine', 'raising');
        this.raising = false;
        a.classList.add('waiting');
        const wr = $('#waitRow');
        const me = v.players.find((p) => p.id === R.myId);
        let txt = '';
        if (me && !me.inHand && me.stack <= 0) txt = '관전 중';
        else if (v.result) txt = '다음 핸드 준비 중…';
        else if (v.runout) txt = '올인! 카드 공개 중…';
        else if (v.toAct >= 0) txt = `${esc(v.players[v.toAct].name)} 차례…`;
        if (wr.dataset.txt !== txt) { wr.innerHTML = `<span>${txt}</span>`; wr.dataset.txt = txt; }
      }
    },
    syncRaise() {
      const L = this.L;
      if (!L) return;
      const raise = $('#raiseBtn');
      const lbl = L.currentBet === 0 ? '베팅' : '레이즈';
      const allin = this.raiseTo >= L.maxTo;
      raise.classList.toggle('allin', allin && this.raising);
      if (L.minTo >= L.maxTo) raise.innerHTML = `올인<small>${fmt(L.maxTo)}</small>`;
      else if (this.raising) raise.innerHTML = `${allin ? '올인' : lbl}<small>${fmt(this.raiseTo)}</small>`;
      else raise.innerHTML = lbl;
      const range = $('#raiseRange');
      range.min = L.minTo; range.max = L.maxTo; range.step = 1; range.value = this.raiseTo;
      const potTo = (f) => Math.round(L.currentBet + f * (L.pot + L.toCall));
      const presets = [['최소', L.minTo], ['½팟', potTo(0.5)], ['¾팟', potTo(0.75)], ['팟', potTo(1)], ['올인', L.maxTo]];
      $('#presets').innerHTML = presets.map(([n, val]) => {
        const vv = Math.max(L.minTo, Math.min(L.maxTo, val));
        return `<button data-to="${vv}" class="${vv === this.raiseTo ? 'on' : ''}">${n}</button>`;
      }).join('');
    },
    setTo(x) {
      const L = this.L; if (!L) return;
      const bb = L.bb;
      x = Math.round(x);
      if (x < L.maxTo) x = Math.max(L.minTo, Math.round(x / (bb / 2)) * (bb / 2));
      this.raiseTo = Math.max(L.minTo, Math.min(L.maxTo, x));
      this.syncRaise();
    },
    send(type, amount) {
      if (!this.ctrl) return;
      this.raising = false;
      $('#actions').classList.remove('raising');
      this.ctrl.act(type, amount);
    },
  };
  $('#foldBtn').onclick = () => Actions.send('fold');
  $('#callBtn').onclick = () => Actions.send('call');
  $('#raiseBtn').onclick = () => {
    const L = Actions.L; if (!L) return;
    if (L.minTo >= L.maxTo) return Actions.send('allin');
    if (!Actions.raising) {
      Actions.raising = true; Actions.raiseTo = L.minTo;
      $('#actions').classList.add('raising'); Actions.syncRaise(); return;
    }
    Actions.send(Actions.raiseTo >= L.maxTo ? 'allin' : 'raise', Actions.raiseTo);
  };
  $('#presets').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) Actions.setTo(+b.dataset.to); });
  $('#raiseRange').addEventListener('input', (e) => {
    const L = Actions.L; if (!L) return;
    // 슬라이더 비선형 (작은 금액을 세밀하게)
    Actions.setTo(+e.target.value);
  });
  $('#minus').onclick = () => Actions.L && Actions.setTo(Actions.raiseTo - Actions.L.bb);
  $('#plus').onclick = () => Actions.L && Actions.setTo(Actions.raiseTo + Actions.L.bb);
  $('#table').addEventListener('click', () => {
    if (Actions.raising) { Actions.raising = false; $('#actions').classList.remove('raising'); Actions.syncRaise(); }
  });
  $('#emoToggle').onclick = () => $('#emotes').classList.toggle('open');
  ['👍', '😂', '😱', '😡', '🔥'].forEach((e) => {
    const b = document.createElement('button'); b.textContent = e;
    b.onclick = () => { $('#emotes').classList.remove('open'); if (Actions.ctrl && Actions.ctrl.emote) Actions.ctrl.emote(e); };
    $('#emoList').appendChild(b);
  });

  // ---------- 블라인드 레벨 ----------
  const LEVELS = [[50, 100], [100, 200], [200, 400], [300, 600], [500, 1000], [1000, 2000], [2000, 4000]];
  const levelFor = (handNo) => LEVELS[Math.min(LEVELS.length - 1, Math.floor(handNo / 10))];

  function hud(title, v, extra) {
    $('#hudTitle').textContent = title;
    if (v) $('#hudSub').textContent = `블라인드 ${fmt(v.sb)}/${fmt(v.bb)} · ${extra || '#' + v.handNo}`;
  }

  // ---------- AI 대결 (로컬) ----------
  const BOTS = [
    { name: '김영감', style: 'rock', avatar: 0 },
    { name: '샤크', style: 'shark', avatar: 1 },
    { name: '해피', style: 'fish', avatar: 2 },
    { name: '폭주핑크', style: 'maniac', avatar: 3 },
    { name: '에이스', style: 'pro', avatar: 4 },
    { name: '레드', style: 'pro', avatar: 5 },
  ];
  class Solo {
    constructor() {
      this.online = false;
      this.g = new H.Game({ sb: 50, bb: 100 });
      this.g.addPlayer({ id: 'me', name: profile.name || '나', stack: 10000, avatar: profile.avatar });
      BOTS.filter((b) => b.avatar !== profile.avatar).slice(0, 5)
        .forEach((b, i) => this.g.addPlayer({ id: 'bot' + i, name: b.name, stack: 10000, isBot: true, style: b.style, avatar: b.avatar }));
      this.timer = null;
      this.over = false;
    }
    start() {
      R.myId = 'me'; R.reset(); Actions.ctrl = this;
      show('game');
      this.nextHand();
    }
    nextHand() {
      const g = this.g;
      const alive = g.players.filter((p) => p.stack > 0);
      if (g.players[0].stack <= 0) return this.end(false);
      if (alive.length === 1) return this.end(true);
      const [sb, bb] = levelFor(g.handNo);
      g.setBlinds(sb, bb);
      g.startHand();
      this.update();
    }
    update() {
      const v = this.g.view('me');
      R.render(v);
      hud('AI 대결', v);
      this.schedule();
    }
    schedule() {
      clearTimeout(this.timer);
      const g = this.g;
      if (this.over) return;
      if (g.stage === 'done') {
        this.timer = setTimeout(() => this.nextHand(), g.result.type === 'showdown' ? 4300 : 2300);
        return;
      }
      if (g.runout) { this.timer = setTimeout(() => { g.runoutStep(); this.update(); }, 1500); return; }
      const p = g.players[g.toAct];
      const meOut = g.players[0].folded;
      if (p.isBot) {
        this.timer = setTimeout(() => {
          const d = H.botDecide(g);
          g.act(p.id, d.type, d.amount);
          this.update();
        }, meOut ? 350 + Math.random() * 300 : 700 + Math.random() * 800);
      }
    }
    act(type, amount) { if (this.g.act('me', type, amount)) this.update(); }
    end(won) {
      this.over = true;
      const hands = this.g.handNo;
      const wins = store.get('rh_solo_wins', 0) + (won ? 1 : 0);
      if (won) store.set('rh_solo_wins', wins);
      modal(`<h3>${won ? '🏆 테이블 정복!' : '탈락'}</h3>
        <p>${won ? `AI 5명을 모두 이겼어요! (${hands}핸드)` : `${hands}핸드 동안 버텼어요.`}</p>
        <p class="muted">누적 우승 ${wins}회</p>
        <div class="btns"><button class="btn primary big" id="again">다시 하기</button><button class="btn ghost" data-close id="toHome">홈으로</button></div>`,
      (m) => {
        m.querySelector('#again').onclick = () => { closeModal(); startSolo(); };
        m.querySelector('#toHome').onclick = () => goHome();
      });
      if (won) { Sound.epic(); R.confetti(100); }
    }
    leave() { clearTimeout(this.timer); this.over = true; }
  }

  // ---------- 온라인 ----------
  const Net = {
    ws: null, open: false, queue: [], handlers: {}, wantOpen: false, retry: 0,
    connect() {
      this.wantOpen = true;
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      this.ws = ws;
      ws.onopen = () => {
        this.open = true; this.retry = 0;
        ws.send(JSON.stringify({ t: 'hello', token: profile.token, name: myName(), avatar: profile.avatar }));
        const q = this.queue; this.queue = [];
        q.forEach((m) => ws.send(JSON.stringify(m)));
      };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (er) { return; }
        const h = this.handlers[m.t]; if (h) h(m);
      };
      ws.onclose = () => {
        this.open = false;
        if (this.wantOpen) {
          this.retry++;
          if (this.retry === 2) toast('연결이 끊겼어요. 다시 연결 중…');
          setTimeout(() => this.connect(), Math.min(5000, 500 * this.retry));
        }
      };
    },
    send(m) {
      if (this.open && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
      else { this.queue.push(m); this.connect(); }
    },
    on(t, fn) { this.handlers[t] = fn; },
  };
  function myName() {
    let n = ($('#nick').value || profile.name || '').trim();
    if (!n) { n = '게스트' + Math.floor(100 + Math.random() * 900); }
    if (n !== profile.name) { profile.name = n; store.set('rh_name', n); $('#nick').value = n; }
    return n;
  }

  const Online = {
    online: true, room: null, mode: null, active: false,
    act(type, amount) { Net.send({ t: 'act', type, amount }); },
    emote(e) { Net.send({ t: 'emote', e }); },
    leave() { Net.send({ t: 'leave' }); this.active = false; this.room = null; },
  };
  Net.on('welcome', (m) => {
    profile.token = m.token; store.set('rh_token', m.token);
    R.myId = m.pid;
    if (Online.pendingJoin) { Net.send({ t: 'join', code: Online.pendingJoin }); Online.pendingJoin = null; }
  });
  Net.on('error', (m) => toast(m.msg));
  Net.on('room', (m) => {
    Online.room = m; Online.active = true; Online.mode = m.mode;
    Actions.ctrl = Online;
    if (m.status === 'lobby') {
      show('lobby');
      renderLobby(m);
    } else if (!$('#game').classList.contains('active')) {
      R.reset(); show('game');
    }
    if (m.status !== 'over' && $('#modal').dataset.kind === 'over') { closeModal(); $('#modal').dataset.kind = ''; }
  });
  Net.on('state', (m) => {
    if (!Online.active) return;
    if (!$('#game').classList.contains('active')) { R.reset(); show('game'); }
    R.render(m.view, { deadline: m.deadline ? Date.now() + m.deadline : 0 });
    if (Online.mode === 'daily') hud('오늘의 토너먼트', m.view, `핸드 ${Math.min(m.view.handNo, m.handLimit)}/${m.handLimit}`);
    else hud('친구 대전 · ' + (Online.room ? Online.room.code : ''), m.view);
  });
  Net.on('emote', (m) => R.emote(m.pid, m.e));
  Net.on('over', (m) => {
    const isHost = Online.room && Online.room.isHost;
    $('#modal').dataset.kind = 'over';
    modal(`<h3>🏁 게임 종료</h3>
      <ol class="rank-list">${m.standings.map((s, i) => `<li class="${s.pid === R.myId ? 'me' : ''}"><span class="rk">${i + 1}</span><img src="${avatarSrc(s.avatar)}"><span class="nm">${esc(s.name)}</span><span class="sc">${fmt(s.stack)}</span></li>`).join('')}</ol>
      <div class="btns">${isHost ? '<button class="btn primary big" id="rematch">🔁 재대결</button>' : '<p class="muted">방장이 재대결을 누르면 바로 시작돼요</p>'}
      <button class="btn ghost" id="leaveRoom">나가기</button></div>`,
    (el) => {
      const r = el.querySelector('#rematch'); if (r) r.onclick = () => { Net.send({ t: 'rematch' }); };
      el.querySelector('#leaveRoom').onclick = () => { goHome(); };
    });
  });
  Net.on('dailyEnd', (m) => {
    $('#modal').dataset.kind = 'daily';
    modal(`<h3>🏆 오늘의 기록</h3>
      <div class="big-score">${fmt(m.score)}</div>
      <p>${m.total}명 중 <b style="color:var(--gold)">${m.rank}위</b></p>
      ${rankListHTML(m.top, m.pid)}
      <div class="btns"><button class="btn gold" id="shareScore">📣 기록 자랑하기</button><button class="btn ghost" id="dHome">홈으로</button></div>`,
    (el) => {
      el.querySelector('#dHome').onclick = () => goHome();
      el.querySelector('#shareScore').onclick = () => share(`오늘의 홀덤 토너먼트 ${m.rank}위! 최종 칩 ${fmt(m.score)} — 같은 카드로 붙어보자`, location.origin);
    });
  });
  Net.on('left', () => { Online.active = false; });

  function renderLobby(m) {
    $('#roomCode').textContent = m.code;
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const p = m.members[i];
      if (p) slots.push(`<li class="${p.online ? '' : 'off'}">${p.host ? '<span class="host">👑</span>' : ''}<img src="${avatarSrc(p.avatar)}"><span>${esc(p.name)}${p.pid === R.myId ? ' (나)' : ''}</span></li>`);
      else slots.push(`<li class="empty">${m.fillBots ? '🤖 AI' : '빈자리'}</li>`);
    }
    $('#members').innerHTML = slots.join('');
    $('#botToggle').checked = m.fillBots;
    $('#botToggle').disabled = !m.isHost;
    $('#startBtn').style.display = m.isHost ? '' : 'none';
    const canStart = m.members.length >= 2 || m.fillBots;
    $('#startBtn').disabled = !canStart;
    $('#lobbyHint').textContent = m.isHost ? (canStart ? '' : '친구가 들어오거나 AI 채우기를 켜면 시작할 수 있어요') : '방장이 시작하길 기다리는 중…';
  }
  $('#botToggle').onchange = (e) => Net.send({ t: 'setBots', on: e.target.checked });
  $('#startBtn').onclick = () => Net.send({ t: 'start' });
  $('#shareBtn').onclick = () => {
    const code = Online.room && Online.room.code;
    share(`${myName()}님이 홀덤 한 판 하자고 초대했어요! 방 코드 ${code}`, `${location.origin}/?room=${code}`);
  };
  async function share(text, url) {
    if (navigator.share) { try { await navigator.share({ title: '로열 홀덤', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text + '\n' + url); toast('링크를 복사했어요'); }
    catch (e) { prompt('아래 링크를 복사하세요', url); }
  }

  // ---------- 홈 ----------
  let current = null;
  function goHome() {
    closeModal();
    if (current && current.leave) current.leave();
    if (Online.active) Online.leave();
    current = null;
    history.replaceState(null, '', location.pathname + (EMBED ? '?embed=1' : ''));
    show('home');
    loadDailyInfo();
  }
  function startSolo() {
    myName();
    if (current && current.leave) current.leave();
    current = new Solo();
    current.start();
  }
  function startFriends() {
    myName();
    current = Online;
    Net.connect();
    Net.send({ t: 'create' });
  }
  function joinRoom(code) {
    code = (code || '').trim().toUpperCase();
    if (code.length !== 4) return toast('방 코드 4자리를 입력하세요');
    myName();
    current = Online;
    if (!profile.token || !Net.open) { Online.pendingJoin = code; Net.connect(); }
    else Net.send({ t: 'join', code });
  }
  async function startDaily() {
    myName();
    const info = await fetchDaily();
    if (info && info.played) return showRanking(info, true);
    modal(`<h3>🏆 오늘의 토너먼트</h3>
      <p>오늘 참가자 <b>모두 같은 카드</b>로 AI 5명과 겨뤄요.<br>시작 칩 10,000 · <b>30핸드</b> 후 남은 칩으로 순위!<br>블라인드는 10핸드마다 올라가요.</p>
      <p class="muted">하루 1번만 도전할 수 있고, 시작하면 중간에 나가도 그때 칩으로 기록돼요.</p>
      <div class="btns"><button class="btn gold big" id="goDaily">도전 시작</button><button class="btn ghost" data-close>다음에</button></div>`,
    (el) => {
      el.querySelector('#goDaily').onclick = () => {
        closeModal(); current = Online; Net.connect(); Net.send({ t: 'daily' });
      };
    });
  }
  async function fetchDaily() {
    try {
      const r = await fetch('/api/daily' + (profile.token ? '?token=' + encodeURIComponent(profile.token) : ''));
      return await r.json();
    } catch (e) { return null; }
  }
  function rankListHTML(top, myPid) {
    if (!top || !top.length) return '<p class="muted">아직 기록이 없어요. 첫 번째 주인공이 되어보세요!</p>';
    return `<ol class="rank-list">${top.map((s, i) => `<li class="${s.mine || (myPid && s.pid === myPid) ? 'me' : ''}"><span class="rk">${i + 1}</span><img src="${avatarSrc(s.avatar)}"><span class="nm">${esc(s.name)}</span><span class="sc">${fmt(s.score)}</span></li>`).join('')}</ol>`;
  }
  function showRanking(info, playedMsg) {
    info = info || {};
    modal(`<h3>🏅 오늘의 랭킹</h3>
      <p class="muted">${esc(info.date || '')} · 참가 ${fmt(info.total || 0)}명</p>
      ${playedMsg && info.my ? `<p>오늘 기록 <b style="color:var(--gold)">${fmt(info.my.score)}</b> · ${info.my.rank}위<br><span class="muted">내일 새 카드로 다시 도전하세요!</span></p>` : ''}
      ${rankListHTML(info.top)}
      <div class="btns"><button class="btn ghost" data-close>닫기</button></div>`);
  }
  async function loadDailyInfo() {
    const info = await fetchDaily();
    if (!info) return;
    $('#dailySub').textContent = info.played ? `오늘 기록 ${fmt(info.my ? info.my.score : 0)} · ${info.my ? info.my.rank + '위' : ''}` : `모두 같은 카드 · 30핸드 · 참가 ${fmt(info.total)}명`;
  }

  function rules() {
    const rows = [
      ['로열 스트레이트 플러시', 'A K Q J 10 같은 무늬'], ['스트레이트 플러시', '연속 5장 같은 무늬'], ['포카드', '같은 숫자 4장'],
      ['풀하우스', '트리플 + 원페어'], ['플러시', '같은 무늬 5장'], ['스트레이트', '연속된 숫자 5장'],
      ['트리플', '같은 숫자 3장'], ['투페어', '페어 2개'], ['원페어', '같은 숫자 2장'], ['하이카드', '가장 높은 카드'],
    ];
    modal(`<h3>📖 족보·규칙</h3><div class="rules">
      <p>내 카드 2장 + 바닥 카드 5장 중 <b>가장 좋은 5장</b>으로 승부해요. 위로 갈수록 강해요.</p>
      <table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
      <p><b>진행</b> 프리플롭(카드 2장) → 플랍(바닥 3장) → 턴(1장) → 리버(1장). 매번 베팅해요.</p>
      <p><b>체크</b> 넘기기 · <b>콜</b> 같은 금액 따라가기 · <b>레이즈</b> 더 올리기 · <b>폴드</b> 포기 · <b>올인</b> 전부 걸기</p>
      </div><div class="btns"><button class="btn ghost" data-close>닫기</button></div>`);
  }

  // 아바타 선택
  const ap = $('#avatarPick');
  for (let i = 0; i < 6; i++) {
    const img = document.createElement('img');
    img.src = avatarSrc(i);
    img.className = i === profile.avatar ? 'on' : '';
    img.onclick = () => {
      profile.avatar = i; store.set('rh_avatar', i);
      $$('#avatarPick img').forEach((x, k) => x.classList.toggle('on', k === i));
    };
    ap.appendChild(img);
  }
  $('#nick').value = profile.name;
  $('#nick').addEventListener('change', () => { profile.name = $('#nick').value.trim(); store.set('rh_name', profile.name); });
  $$('.mode-card').forEach((b) => b.onclick = () => {
    const m = b.dataset.mode;
    if (m === 'solo') startSolo();
    else if (m === 'friends') startFriends();
    else startDaily();
  });
  $('#joinBtn').onclick = () => joinRoom($('#joinCode').value);
  $('#joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(e.target.value); });
  $('#rankBtn').onclick = async () => showRanking(await fetchDaily());
  $('#rulesBtn').onclick = rules;
  $$('[data-back]').forEach((b) => b.onclick = goHome);
  $('#exitBtn').onclick = () => {
    const daily = Online.active && Online.mode === 'daily';
    modal(`<h3>나가기</h3><p>${daily ? '지금 나가면 현재 칩으로 오늘 기록이 확정돼요.' : '게임에서 나갈까요?'}</p>
      <div class="btns"><button class="btn primary big" data-close>계속하기</button><button class="btn ghost" id="reallyExit">나가기</button></div>`,
    (el) => { el.querySelector('#reallyExit').onclick = () => goHome(); });
  };
  const syncSoundBtn = () => { $('#soundBtn').textContent = Sound.on ? '🔊' : '🔇'; };
  $('#soundBtn').onclick = () => { Sound.on = !Sound.on; store.set('rh_sound', Sound.on); syncSoundBtn(); };
  syncSoundBtn();
  window.addEventListener('resize', () => { if (R.v) R.layout(R.v); });

  // 하루퍼즐 안에서 열렸을 때
  if (EMBED) {
    $('#homeBack').hidden = false;
    $('#homeBack').onclick = () => toParent('exit');
    const nm = (Q0.get('name') || '').trim().slice(0, 10);
    if (nm && !profile.name) { profile.name = nm; store.set('rh_name', nm); $('#nick').value = nm; }
    const st = Q0.get('start');
    if (st === 'solo') setTimeout(startSolo, 50);
    else if (st === 'friends') setTimeout(startFriends, 50);
    else if (st === 'daily') setTimeout(startDaily, 50);
    toParent('ready');
  }

  // 초대 링크로 들어온 경우
  const params = new URLSearchParams(location.search);
  if (params.get('room')) {
    const code = params.get('room');
    if (!profile.name) {
      modal(`<h3>친구 대전 초대</h3><p>방 <b style="color:var(--gold)">${esc(code.toUpperCase())}</b>에 초대받았어요!</p>
        <input id="inviteNick" maxlength="10" placeholder="닉네임" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;text-align:center;font-weight:700;margin-top:6px">
        <div class="btns"><button class="btn primary big" id="inviteGo">입장하기</button></div>`,
      (el) => {
        el.querySelector('#inviteGo').onclick = () => {
          const n = el.querySelector('#inviteNick').value.trim();
          if (n) $('#nick').value = n;
          closeModal(); joinRoom(code);
        };
      });
    } else joinRoom(code);
  } else if (profile.token) {
    // 진행 중인 방이 있으면 서버가 다시 붙여줌
    Net.connect();
  }
  loadDailyInfo();

  // 디버그/테스트용
  window.__rh = { R, Online, Net, get current() { return current; } };
})();
