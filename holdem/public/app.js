/* 로열 홀덤 — 클라이언트 */
(function () {
  'use strict';
  const H = window.Holdem;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const rakeTxt = (rk) => (rk && rk.pct > 0 ? `수수료 ${rk.pct}% · 최대 ${fmt(rk.cap)}${rk.capBB ? ` (${rk.capBB}BB)` : ''}${rk.nfnd === false ? '' : ' · 플랍 전 무료'}` : '수수료 없음');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 분양 주소(/s/이름/…)면 그 사업장으로 연결. 로그인 정보도 사업장마다 따로 저장
  const BASE = (location.pathname.match(/^\/s\/[a-z0-9-]{2,30}/) || [''])[0];
  const SESS = 'rh_sess' + (BASE ? ':' + BASE.slice(3) : '');

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
    token: store.get(SESS, null),
  };

  // ---------- 사운드 (WebAudio 합성) ----------
  const Sound = {
    ctx: null, out: null, noiseBuf: null, on: store.get('rh_sound', true),
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
        // 마스터 체인: 소리가 한꺼번에 겹쳐도 찢어지지 않게 압축기 → 전체 볼륨
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
        const master = this.ctx.createGain(); master.gain.value = 0.85;
        comp.connect(master); master.connect(this.ctx.destination);
        this.out = comp;
        // 잡음 버퍼는 한 번만 만들어 재사용
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    ok() { return this.on && this.ctx && this.ctx.state === 'running'; },
    tone(f, d, type, vol, when, f2) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime + (when || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      // 짧은 어택(5ms)으로 '딱' 하는 클릭 잡음 없이
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.out); o.start(t); o.stop(t + d + 0.03);
    },
    noise(d, vol, freq, when, type, q) {
      if (!this.ok()) return;
      const t = this.ctx.currentTime + (when || 0);
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 3000; f.Q.value = q || 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f); f.connect(g); g.connect(this.out);
      s.start(t, Math.random() * 0.5); s.stop(t + d + 0.03);
    },
    // 카드 돌리기: 짧고 가벼운 '샥'(고음 잡음, 빠른 감쇠)
    card(w) { this.noise(0.07, 0.16, 5200, w, 'bandpass', 0.9); this.noise(0.035, 0.06, 2400, (w || 0) + 0.025, 'bandpass', 0.7); },
    flip(w) { this.noise(0.03, 0.14, 6500, w, 'highpass'); this.tone(2200, 0.02, 'sine', 0.012, w); },
    // 칩 한 번 부딪힘: 금속성 짧은 클릭 + 3~6kHz 울림
    clack(w, v) {
      const j = 1 + (Math.random() - 0.5) * 0.18, g = v || 1;
      this.noise(0.012, 0.22 * g, 7000 * j, w, 'bandpass', 2.5);
      this.tone(3600 * j, 0.05, 'sine', 0.05 * g, w); this.tone(5150 * j, 0.035, 'sine', 0.03 * g, w);
    },
    // 칩 걸기: 2~3개가 연달아 '착착'
    chip(w) { const t = w || 0, n = 2 + (Math.random() < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) this.clack(t + i * (0.028 + Math.random() * 0.02), 1 - i * 0.2); },
    // 팟 모으기·받기: 칩 여러 개가 쏟아지듯
    collect(w) { const t = w || 0; for (let i = 0; i < 9; i++) this.clack(t + i * 0.032 + Math.random() * 0.012, 0.9 - i * 0.07); },
    check() { this.tone(170, 0.06, 'sine', 0.2, 0, 110); this.noise(0.02, 0.08, 900, 0, 'lowpass'); this.tone(170, 0.06, 'sine', 0.16, 0.12, 110); this.noise(0.02, 0.06, 900, 0.12, 'lowpass'); },   // 테이블 '똑똑'
    fold() { this.noise(0.14, 0.1, 1800, 0, 'bandpass', 0.6); },                                                             // 카드 밀어내는 '스윽'
    // 내 차례: 맑은 '띵'(약 2kHz 종소리, 배음 포함)
    turn() { this.tone(1975, 0.45, 'sine', 0.08); this.tone(3950, 0.25, 'sine', 0.02); this.tone(2963, 0.3, 'sine', 0.015, 0.01); },
    tick(last) { this.tone(last ? 1480 : 1180, 0.05, 'sine', last ? 0.08 : 0.05); },
    allin() {
      this.noise(0.5, 0.06, 1200, 0, 'bandpass', 0.4); this.tone(110, 0.55, 'sine', 0.14, 0, 70);
      this.collect(0.08);
    },
    win() { [784, 988, 1175, 1568].forEach((f, i) => { this.tone(f, 0.35, 'sine', 0.07, i * 0.07); this.tone(f * 2, 0.2, 'sine', 0.015, i * 0.07); }); this.collect(0.05); },
    epic() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { this.tone(f, 0.5, 'sine', 0.07, i * 0.07); this.tone(f * 2, 0.3, 'sine', 0.015, i * 0.07); });
      this.noise(0.8, 0.04, 8000, 0.4, 'highpass');
    },
    lose() { this.tone(523, 0.18, 'sine', 0.05); this.tone(392, 0.32, 'sine', 0.05, 0.14); },
    voiceOn: store.get('rh_voice', true),
    pop() { this.tone(660, 0.08, 'sine', 0.05); this.tone(990, 0.1, 'sine', 0.04, 0.06); },
  };
  // ---------- 녹음 효과음(파일) ----------
  // public/snd/: 칩·카드는 실제 녹음(Kenney Casino Audio, CC0), 체크·종소리·차임은 직접 합성해 만든 파일, 행동 음성은 AI 성우(ElevenLabs, Creative Claw로 생성) 여자·남자.
  // 파일을 처음 터치 때 한 번에 받아 두고, 칠 때마다 여러 버전 중 하나를 골라 높낮이·크기를 살짝 바꿔 틀어서 덜 반복적으로 들림.
  // 파일이 아직 없거나 못 받으면 예전 합성음으로 자동 대체.
  const SND = {
    chip: ['chip1', 'chip2', 'chip3'], stack: ['stack1', 'stack2', 'stack3', 'stack4', 'stack5', 'stack6'], collide: ['collide1', 'collide2', 'collide3', 'collide4'],
    deal: ['deal1', 'deal2', 'deal3', 'deal4', 'deal5', 'deal6', 'deal7', 'deal8'], flip: ['flip1', 'flip2', 'flip3', 'flip4'], fold: ['fold1', 'fold2', 'fold3', 'fold4', 'fold5'], start: ['start'], enter: ['enter'],
    check: ['check_0', 'check_1', 'check_2'], turn: ['turn'], tick: ['tick'], tick_last: ['tick_last'], win: ['win'], epic: ['epic'], lose: ['lose'], allin: ['allin'], pop: ['pop'],
  };
  // 행동 음성: 여자(f)·남자(m) 성우, 각각 두 가지 말투(_2)를 번갈아 틂
  ['call', 'check', 'bet', 'raise', 'allin', 'fold'].forEach((t) => { SND['v_' + t] = ['v_' + t, 'v_' + t + '_2']; SND['v_m_' + t] = ['v_m_' + t, 'v_m_' + t + '_2']; });
  const SND_VOL = { chip: 0.8, stack: 0.85, collide: 0.8, deal: 0.55, flip: 0.5, fold: 0.6, check: 0.9, turn: 0.75, tick: 0.5, tick_last: 0.6, win: 0.7, epic: 0.75, lose: 0.5, allin: 0.8, pop: 0.45, start: 0.6, enter: 0.6, voice: 1.0 };
  // 캐릭터마다 목소리: 여자 캐릭터(폭주핑크·에이스·마담)는 여자 성우, 나머지는 남자 성우.
  // 같은 성우라도 캐릭터마다 높낮이를 조금씩 달리해 구분(김영감 낮게, 꼬마천재 높게 등)
  const AV_VOICE = [['m', 0.9], ['m', 0.97], ['m', 1.04], ['f', 1.07], ['f', 0.98], ['m', 1.06], ['f', 0.93], ['m', 1.11], ['m', 0.92]];
  const Syn = {};
  ['card', 'flip', 'chip', 'collect', 'check', 'fold', 'turn', 'tick', 'allin', 'win', 'epic', 'lose', 'pop'].forEach((k) => { Syn[k] = Sound[k].bind(Sound); });
  Object.assign(Sound, {
    buf: {}, loading: false,
    load() {
      if (this.loading || !this.ctx) return;
      this.loading = true;
      const names = [...new Set(Object.values(SND).flat())];
      names.forEach((n) => {
        fetch(BASE + '/snd/' + n + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
          .then((ab) => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
          .then((b) => { this.buf[n] = b; }).catch(() => {});
      });
    },
    // 한 소리 틀기: 버전 하나를 골라, 높낮이 ±jit, 크기 vol
    play(group, when, vol, jit, gainKey) {
      if (!this.ok()) return true;
      const list = (SND[group] || []).filter((n) => this.buf[n]);
      if (!list.length) return false;
      const b = this.buf[list[Math.floor(Math.random() * list.length)]];
      const t = this.ctx.currentTime + (when || 0);
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = b;
      src.playbackRate.value = 1 + (Math.random() - 0.5) * (jit == null ? 0.08 : jit);
      g.gain.value = (vol == null ? 1 : vol) * (SND_VOL[gainKey || group] || 0.8);
      src.connect(g); g.connect(this.voiceOut && gainKey === 'voice' ? this.voiceOut : this.out);
      src.start(t);
      return true;
    },
    card(w) { if (!this.play('deal', w, 1, 0.1)) Syn.card(w); },
    flip(w) { if (!this.play('flip', w, 1, 0.1)) Syn.flip(w); },
    chip(w) { if (!this.play('chip', w, 1, 0.12)) Syn.chip(w); },
    collect(w) { if (!this.play('stack', w, 1, 0.08)) Syn.collect(w); else this.play('collide', (w || 0) + 0.12, 0.6, 0.1); },
    check() { if (!this.play('check', 0, 1, 0.06)) Syn.check(); },
    fold() { if (!this.play('fold', 0, 1, 0.1)) Syn.fold(); },
    turn() { if (!this.play('turn', 0, 1, 0)) Syn.turn(); },
    tick(last) { if (!this.play(last ? 'tick_last' : 'tick', 0, 1, 0)) Syn.tick(last); },
    allin() { if (!this.play('allin', 0, 1, 0)) Syn.allin(); else this.play('collide', 0.05, 1, 0.08); },
    win() { if (!this.play('win', 0, 1, 0)) Syn.win(); else this.play('stack', 0.05, 0.9, 0.08); },
    epic() { if (!this.play('epic', 0, 1, 0)) Syn.epic(); },
    lose() { if (!this.play('lose', 0, 1, 0)) Syn.lose(); },
    pop() { if (!this.play('pop', 0, 1, 0.05)) Syn.pop(); },
    // 판 시작(카드 섞는 소리 + 맑은 2음), 테이블 입장(차임) — 파일이 없으면 조용히 넘어감
    handStart() { const w = Math.max(0, 1.1 - (performance.now() - (this._enterAt || 0)) / 1000); if (!this.play('start', w, 1, 0)) Syn.card(w); },   // 입장음과 겹치지 않게 뒤로
    enter() { this._enterAt = performance.now(); this.play('enter', 0, 1, 0); },
    // 행동 음성: 같은 사람이 연달아 말하면 앞 음성은 끊고 새 음성
    say(type, avatar) {
      if (!this.on || !this.voiceOn || !type) return;
      const [sex, pitch] = AV_VOICE[avatar | 0] || AV_VOICE[0];
      if (this._vsrc) { try { this._vsrc.stop(); } catch (e) { /* */ } this._vsrc = null; }
      const list = (SND[(sex === 'm' ? 'v_m_' : 'v_') + type] || []).filter((n) => this.buf[n]);
      if (!list.length || !this.ok()) return;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = this.buf[list[Math.floor(Math.random() * list.length)]]; g.gain.value = SND_VOL.voice;
      src.playbackRate.value = pitch;
      src.connect(g); g.connect(this.out); src.start(); this._vsrc = src;
    },
  });
  { const e0 = Sound.ensure.bind(Sound); Sound.ensure = function () { e0(); this.load(); }; }
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => document.addEventListener(ev, () => Sound.ensure(), { passive: true }));

  // ---------- 공통 UI ----------
  function show(id) {
    const was = $('.screen.active'); if ((id === 'game' || id === 'lobby') && (!was || (was.id !== 'game' && was.id !== 'lobby'))) Sound.enter();
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    if (id === 'home' && RoomList) RoomList.tick();
  }
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function modal(html, onMount) {
    $('#modalCard').onclick = null;   // 이전 창의 클릭 처리 지우기
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
  const avatarSrc = (i) => `img/av${(((i | 0) % 9) + 9) % 9}.png`;

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
  // 9인 테이블: 0 = 나(아래 가운데), 시계 방향으로 왼쪽 아래 → 위 → 오른쪽 아래, 9 = 위 가운데(인원이 짝수일 때)
  const SLOT_POS = [[50, 86], [11, 54], [10, 39.5], [17, 25.5], [33, 13.5], [67, 13.5], [83, 25.5], [90, 39.5], [89, 54], [50, 12]];
  const SLOT_SETS = { 1: [0], 2: [0, 9], 3: [0, 3, 6], 4: [0, 2, 9, 7], 5: [0, 2, 4, 5, 7], 6: [0, 1, 3, 9, 6, 8], 7: [0, 1, 2, 4, 5, 7, 8], 8: [0, 1, 2, 3, 9, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
  const CENTER = [50, 45];
  // D는 항상 버튼 주인 앞 + SB 쪽(시계 방향 다음 자리 쪽)으로. 반대쪽(이전 자리 쪽)으로 치우치면 그 사람이 버튼처럼 보임
  const DEALER_POS = [[37, 73], [29, 53], [28, 38.5], [26.5, 30.5], [42, 21], [58, 21], [73.5, 31.5], [72, 38.5], [71, 55], [57, 24]];
  const VOICE_TXT = { fold: '폴드', check: '체크', call: '콜', bet: '베팅', raise: '레이즈', allin: '올인' };
  const TAG_TXT = { fold: '폴드', check: '체크', call: '콜', bet: '베팅', raise: '레이즈', allin: '올인', SB: 'SB', BB: 'BB', WAIT: '대기' };
  const CHIP_COLORS = ['#e0384d', '#2563eb', '#16a34a', '#111827', '#9333ea', '#d4a017'];

  // 칩 더미: 금액을 큰 단위부터 칩 색으로 나눠 최대 6개까지 쌓음(피망처럼 실제 칩이 쌓인 모양)
  const DENOMS = [[100, '#1f2937'], [25, '#9333ea'], [5, '#16a34a'], [1, '#2563eb'], [0.5, '#e0384d']];   // BB 단위
  function chipStack(amt, bb) {
    let left = Math.max(0.5, amt / Math.max(1, bb));
    const out = [];
    for (const [d, c] of DENOMS) { while (left >= d - 1e-9 && out.length < 6) { out.push(c); left -= d; } }
    if (!out.length) out.push(DENOMS[DENOMS.length - 1][1]);
    return out.reverse().map((c, k) => `<i style="--c:${c};--k:${k}"></i>`).join('');
  }

  // ---------- 렌더러 ----------
  const R = {
    v: null, prev: null, myId: null, seatEls: [], betEls: [], deadline: 0, turnKey: '',
    animLock: 0, pendingWinStacks: null,

    reset() {
      this.v = null; this.prev = null; this.seatEls = []; this.betEls = [];
      $('#seats').innerHTML = ''; $('#bets').innerHTML = ''; $('#fx').innerHTML = ''; $('#sidePots').innerHTML = ''; this._sideHk = null;
      $('#board').innerHTML = '<div class="slot"></div>'.repeat(5);
      $('#banner').className = 'banner'; $('#pot').classList.remove('show');
      $('#myHand').classList.remove('show'); $('#dealerBtn').classList.remove('show');
      $('#actions').className = 'actions';
      Actions.raising = false; Actions.raiseTo = 0;   // 지난 게임에서 레이즈 패널을 연 채 나왔어도 새 게임 첫 차례에 지난 금액을 보내지 않게
      TurnFx.stop(); this.turnKey = '';
    },
    myIndex(v) { const i = v.players.findIndex((p) => p.id === this.myId && !p.gone); return i; },   // 나갔다가 관전으로 돌아오면 옛 자리(정산된 자리)는 내 자리가 아님
    slotPos(v, seat) {
      const n = v.players.length;
      const mi = Math.max(0, this.myIndex(v));
      const rel = (seat - mi + n) % n;
      return SLOT_POS[(SLOT_SETS[n] || SLOT_SETS[9])[rel] ?? rel];
    },
    lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; },
    betPos(v, seat) {
      const p = this.slotPos(v, seat);
      if (p[1] > 80) return [50, 68.9];                     // 내 자리: 보드 아래·내 카드 위 사이
      const q = this.lerp(p, CENTER, 0.5);
      if (p[1] < 20 && p[0] !== 50) { q[0] = p[0] < 50 ? 38.5 : 61.5; q[1] = 31; }   // 맨 윗줄 둘: 큰 금액 글자가 서로·D와 안 닿게 바깥쪽·조금 아래로
      return q;
    },
    // D 버튼: 참고 화면처럼 테이블(펠트) 위, 버튼 주인 앞에 놓음.
    // 자리마다 위치는 화면 겹침 점검(2~9명 × 쇼다운·모두 베팅 × 360/390/1280px)으로 고른 값:
    // 버튼 주인 쪽이 확실히 더 가깝고, 남의 카드·이름·베팅 칩·보드와 안 겹침(쇼다운 땐 주인 카드가 D 위를 덮음)
    slotIdx(v, seat) {
      const n = v.players.length, mi = Math.max(0, this.myIndex(v));
      const rel = (seat - mi + n) % n;
      return (SLOT_SETS[n] || SLOT_SETS[9])[rel] ?? rel;
    },
    dealerPos(v, seat) { return DEALER_POS[this.slotIdx(v, seat)] || this.betPos(v, seat); },
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
          <div class="ava"><img alt=""><svg viewBox="0 0 36 36"><circle class="rbg" cx="18" cy="18" r="16.5"/><circle class="rfg" cx="18" cy="18" r="16.5" pathLength="100"/></svg><div class="orbit"><i></i></div></div>
          <div class="plate"><div class="nm"></div><div class="stk"></div></div>
          <div class="tag"></div><div class="hn"></div><div class="shown-tag" hidden>공개</div>`;
        $('#seats').appendChild(el);
        return el;
      });
      this.betEls = v.players.map(() => {
        const b = document.createElement('div');
        b.className = 'bet'; b.style.opacity = 0;
        b.innerHTML = '<span class="stack"></span><span class="amt"></span>';
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
        el.classList.toggle('side-l', p.id !== this.myId && x <= 50);
        el.classList.toggle('side-r', p.id !== this.myId && x > 50);
        el.classList.toggle('top', p.id !== this.myId && y < 20);
        el.classList.toggle('low', p.id !== this.myId && y > 48);   // 아래 옆자리: 보드와 겹치지 않게 카드는 위쪽, 족보는 칩 아래   // 맨 윗줄: 공개 카드는 바깥쪽으로(가운데에서 서로 겹치지 않게)
        const [bx, by] = this.betPos(v, i);
        const b = this.betEls[i];
        b.style.left = bx + '%'; b.style.top = by + '%';
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
      Sound.handStart();
    },

    renderBoard(v, prev, newHand) {
      const slots = $$('#board .slot');
      const from = this.tablePt([50, 42]);
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
      const deckPt = this.tablePt([50, 42]);
      const n = v.players.length;
      const winners = new Set();
      if (v.result) v.result.pots.forEach((p) => { if (!p.refund || v.result.pots.length === 1) p.winners.forEach((w) => winners.add(w)); });
      v.players.forEach((p, i) => {
        const el = this.seatEls[i];
        const pp = prev && !newHand ? prev.players[i] : null;
        el.classList.toggle('folded', p.inHand && p.folded);
        el.classList.toggle('out', !p.inHand && p.stack <= 0 && !p.empty);
        el.classList.toggle('away', !!p.away);
        el.classList.toggle('off', !!p.off);   // 연결이 끊긴 사람(앱을 닫았거나 화면이 꺼짐)
        { let ot = el.querySelector('.off-tag'); if (p.off) { if (!ot) { ot = document.createElement('div'); ot.className = 'off-tag'; ot.textContent = '연결 끊김'; el.querySelector('.plate').appendChild(ot); } } else if (ot) ot.remove(); }
        el.classList.toggle('empty', !!p.empty);
        const open = !!(v.watch && v.open && v.open.includes(i)), resv = v.reserved === i;
        let sit = el.querySelector('.sit-btn');
        if (open || resv) {
          if (!sit) { sit = document.createElement('button'); sit.className = 'sit-btn'; el.appendChild(sit); sit.onclick = (e) => { e.stopPropagation(); if (!sit.disabled) sitModal(+sit.dataset.i); }; }
          sit.dataset.i = i; sit.disabled = resv; sit.textContent = resv ? '앉는 중…' : '앉기';
        } else if (sit) sit.remove();
        let wb = el.querySelector('.wait-bb');
        if (p.waitBB || p.postBB) { if (!wb) { wb = document.createElement('div'); wb.className = 'wait-bb'; el.querySelector('.plate').appendChild(wb); } wb.textContent = p.postBB ? '다음 핸드 참여' : 'BB 기다리는 중'; }
        else if (wb) wb.remove();
        if (!p.empty) el.querySelector('img').src = avatarSrc(p.avatar); else el.querySelector('img').removeAttribute('src');
        el.querySelector('.nm').textContent = p.empty ? '빈자리' : p.id === this.myId ? (p.name + ' (나)') : p.name;
        let shownStack = p.stack;
        if (v.result && p.won && (!prev || !prev.result || newHand)) {
          shownStack = p.stack - p.won; // 칩이 날아온 뒤 갱신
          const target = p.stack;
          const hk = v.hk;
          setTimeout(() => this.tickStack(el, target - p.won, target, hk), 1250);
        } else if (v.result && p.won) {
          // 결과 화면 중 리바인 등으로 칩이 바뀌면 바로 새 값(늘어나는 숫자 연출은 원래 값만)
          if (pp && pp.stack !== p.stack) { el.dataset.shown = p.stack; el.dataset.tickTo = ''; }
          shownStack = Number(el.dataset.shown || p.stack);
        }
        if (!(v.result && p.won)) el.dataset.shown = p.stack;
        el.querySelector('.stk').textContent = p.empty ? '' : p.gone ? '나감' : !p.inHand && p.stack <= 0 ? '칩 없음' : fmt(shownStack);
        { const rbc = el.querySelector('.rb-count'); if (rbc) rbc.remove(); }   // 리바인 횟수는 남에게 보이지 않음(리바인 순간 알림만)

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

        // 공개된 카드 / 앞면 카드는 크게
        const faceUp = p.hole.some((c) => c && c !== '??');
        box.classList.toggle('up', !isMe && faceUp);
        box.classList.toggle('shown', !!p.showMask);
        el.querySelector('.shown-tag').hidden = !(p.showMask && p.folded);
        if (isMe) el.querySelector('.shown-tag').textContent = v.stage === 'done' ? '공개' : '끝나고 공개';

        // 액션 태그
        const tag = el.querySelector('.tag');
        const la = p.lastAction;
        const laKey = (x) => (x ? x.type + ':' + (x.amount || 0) + ':' + (x.returned || 0) : '');
        const changed = !pp || laKey(pp.lastAction) !== laKey(la);
        if (v.result && winners.has(p.id)) {
          tag.className = 'tag win show'; tag.innerHTML = (p.won > 0 ? `<b>+${fmt(p.won)}</b>` : '') + 'WINNER';
        } else if (v.result && faceUp) {
          // 쇼다운: 공개된 카드를 가리지 않게 말풍선 숨김. 폴드한 뒤 스스로 보여 준 패는 '공개' 말풍선으로
          if (p.folded && p.showMask && !isMe) { tag.className = 'tag fold show'; tag.textContent = '공개'; }
          else tag.className = 'tag';
        } else if (la && la.prev && v.toAct === i && !v.result) {
          tag.className = 'tag';   // 지난 스트리트 말풍선은 그 사람 차례가 오면 숨김(새 행동 전)
        } else if (la && !(la.type === 'SB' || la.type === 'BB') || (la && newHand)) {
          tag.className = 'tag ' + la.type + (changed ? '' : ' show') + (la.prev ? ' prev' : '');
          tag.textContent = TAG_TXT[la.type] || la.type;
          if (changed) {
            requestAnimationFrame(() => tag.classList.add('show'));
            if (!newHand) {
              if (la.type === 'fold') Sound.fold();
              else if (la.type === 'check') Sound.check();
              else if (la.type === 'allin') Sound.allin();
              if (VOICE_TXT[la.type]) Sound.say(la.type, p.avatar);
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

    tickStack(el, from, to, hk) {
      if (!this.v || this.v.hk !== hk) return;   // 이미 다음 핸드면 지난 핸드 숫자로 덮지 않음
      const t0 = performance.now();
      const dur = 700;
      el.dataset.tickTo = to;
      const step = (t) => {
        if (!this.v || this.v.hk !== hk || el.dataset.tickTo !== String(to)) return;
        const k = Math.min(1, (t - t0) / dur);
        const val = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        el.querySelector('.stk').textContent = fmt(val);
        if (k < 1) requestAnimationFrame(step); else el.dataset.shown = to;
      };
      requestAnimationFrame(step);
    },

    dispBet(v, p) { return v.stage === 'done' ? 0 : p.bet; },

    renderBets(v, prev, newHand) {
      const potPt = this.tablePt([50, 46]);
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
          // 베팅 → 팟 (아무도 따라오지 않은 만큼은 본인에게 돌아감)
          const ret = p.lastAction && p.lastAction.returned;
          if (ret && this._retKey !== v.hk + ':' + i + ':' + v.stage) {
            this._retKey = v.hk + ':' + i + ':' + v.stage;
            this.flyChip(center(b), center(this.seatEls[i].querySelector('.ava')), CHIP_COLORS[i % CHIP_COLORS.length]);
            const pt = this.slotPos(v, i);
            const f = document.createElement('div');
            f.className = 'float-num'; f.textContent = '반환 +' + fmt(ret);
            f.style.left = pt[0] + '%'; f.style.top = pt[1] + 3 + '%';
            $('#fx').appendChild(f); setTimeout(() => f.remove(), 2000);
          }
          if (before - (ret || 0) > 0 || !ret) this.flyChip(center(b), potPt, CHIP_COLORS[i % CHIP_COLORS.length]);
          Sound.chip(0.1);
        }
        if (newHand && prev) {
          // 새 핸드: 블라인드 칩 날리기
          if (amt > 0) this.flyChip(center(this.seatEls[i].querySelector('.ava')), center(b), CHIP_COLORS[i % CHIP_COLORS.length]);
        }
        b.querySelector('.amt').textContent = fmt(amt);
        if (b.dataset.amt !== String(amt)) { b.dataset.amt = amt; b.querySelector('.stack').innerHTML = chipStack(amt, v.bb); }
        b.style.opacity = amt > 0 ? 1 : 0;
        const blind = v.stage === 'preflop' && amt > 0 ? (i === v.sbIdx && v.sbIdx !== v.bbIdx ? 'SB' : i === v.bbIdx ? 'BB' : '') : '';
        b.dataset.blind = blind;
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

    // 올인한 사람이 이길 수 있는 팟은 그 사람 근처, 나머지는 가운데에 계속 모임
    sidePotPos(v, id) {
      const i = v.players.findIndex((p) => p.id === id);
      if (i < 0) return [50, 46];
      const sp = this.slotPos(v, i);
      if (sp[1] > 80) return [25, 76, 'c'];   // 내 자리: 카드·족보 글자 왼쪽
      const [x, y] = this.betPos(v, i);
      if (sp[1] < 20) return [x < 50 ? 41.5 : x > 50 ? 58.5 : 50, 31, 'c', true];   // 맨 윗줄: 자기 베팅 칩 자리에 짧게(글자 없이)
      // 옆줄: 자리 앞(D 바로 안쪽)에서 가운데 쪽으로 늘어나게 — 팟과 안 닿게 아랫줄은 조금 아래, 가운뎃줄은 조금 위로. 위에서 둘째 줄은 맞은편 베팅과 안 닿게 짧게
      return [x < 50 ? x + 2 : x - 2, y > 46 ? y + 4.5 : y > 38 ? y - 3 : y, x < 50 ? 'l' : 'r', y < 46];
    },
    renderPot(v) {
      const pots = v.pots || [{ amount: v.stage === 'done' ? v.potTotal : v.pot, at: null }];
      const gone = !!(v.result && this._potGone === v.hk);
      const side = pots.filter((p) => p.at);
      const centerAmt = pots.filter((p) => !p.at).reduce((s, p) => s + p.amount, 0);
      $('#potAmt').textContent = fmt(centerAmt);
      $('#pot').classList.toggle('show', centerAmt > 0 && !gone);
      // 옆 팟: 자기 자리 앞(베팅 칩 자리)에서 가운데 쪽으로. 팟·남의 베팅 칩·먼저 놓인 옆 팟과 겹치면 위아래로 비켜 놓음
      const box = $('#sidePots');
      if (this._sideHk !== v.hk) { box.innerHTML = ''; this._sideHk = v.hk; }
      const keep = new Set();
      const T = $('#table').getBoundingClientRect();
      const placed = [];   // 피해야 할 네모들(테이블 % 단위) — 팟, 지금 걸린 베팅 칩
      if (centerAmt > 0 && !gone) placed.push({ l: 31, t: 43.4, r: 69, b: 48.6 });
      placed.push({ l: 17, t: 57.5, r: 83, b: 68 });   // 보드 카드 자리
      if (v.dealer >= 0) { const [dx, dy] = this.dealerPos(v, v.dealer); placed.push({ l: dx - 3.2, t: dy - 1.9, r: dx + 3.2, b: dy + 1.9, w: 40 }); }   // D는 작아서 겹침 넓이가 작게 나옴 → 가중치를 크게(절대 덮지 않게)
      v.players.forEach((q, i) => { if (q.bet > 0 && this.betEls[i]) { const r = this.betEls[i].getBoundingClientRect(); placed.push({ l: (r.left - T.left) / T.width * 100 - .4, t: (r.top - T.top) / T.height * 100 - .2, r: (r.right - T.left) / T.width * 100 + .4, b: (r.bottom - T.top) / T.height * 100 + .2 }); } });
            side.forEach((p, k) => {
        const key = p.at;
        keep.add(key);
        let el = box.querySelector(`[data-at="${CSS.escape(key)}"]`);
        let [x, y, anchor, compact] = this.sidePotPos(v, p.at);
        const fresh = !el;
        if (fresh) {
          el = document.createElement('div');
          el.className = 'pot side-pot' + (compact ? ' top' : ''); el.dataset.at = key;
          el.style.transform = anchor === 'l' ? 'translate(0, -50%)' : anchor === 'r' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)';
          el.innerHTML = '<span class="pot-chip"></span><small></small><b></b>';
          el.style.left = '50%'; el.style.top = '46%';   // 가운데에서 그 사람 쪽으로 밀려 나감
          box.appendChild(el);
        }
        el.querySelector('small').textContent = k === 0 ? '메인' : '사이드';
        el.querySelector('b').textContent = fmt(p.amount);
        el.classList.toggle('gone', gone);
        // 자리 찾기: 원하는 자리 → 아래/위로 한 칸씩
        const ovl = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) * (a.w || 1);
        let xx = x, yy = y, best = Infinity;
        const dxs = anchor === 'l' ? [0, -4, -8] : anchor === 'r' ? [0, 4, 8] : [0];   // 자리가 없으면 자기 자리 쪽으로도 조금 물러남
        const search = () => {
          const w = el.offsetWidth / T.width * 100, h = el.offsetHeight / T.height * 100;
          const rectAt = (xx, yy) => { const l = anchor === 'l' ? xx : anchor === 'r' ? xx - w : xx - w / 2; return { l, t: yy - h / 2, r: l + w, b: yy + h / 2 }; };
          best = Infinity;
          outer: for (const dx of dxs) for (const dy of [0, -1.6, 1.6, -3.8, 3.8, -5.6, 5.6, -7.6, 7.6, -9.6, 9.6, 13.6]) {
            const r = rectAt(x + dx, y + dy), area = placed.reduce((s, q) => s + ovl(q, r), 0);
            if (area < best - 1e-9) { best = area; xx = x + dx; yy = y + dy; }
            if (area === 0) break outer;
          }
          return rectAt;
        };
        let rectAt = search();
        if (best > 0 && !compact) { el.classList.add('top'); compact = true; rectAt = search(); }   // 그래도 자리가 없으면 '메인/사이드' 글자를 빼고 금액만(좁게) 다시 찾음
        placed.push(rectAt(xx, yy));
        if (fresh) {
          const from = this.tablePt([50, 46]), to = this.tablePt([xx, yy]);
          for (let c = 0; c < 4; c++) this.flyChip(from, to, '#d4a017', null, c * 70);
          Sound.chip(0.05);
          requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = xx + '%'; el.style.top = yy + '%'; }));
        } else { el.style.left = xx + '%'; el.style.top = yy + '%'; }
      });
      box.querySelectorAll('.side-pot').forEach((el) => { if (!keep.has(el.dataset.at)) el.remove(); });
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
      const dlChanged = deadline && Math.abs(deadline - (this.deadline || 0)) > 800;   // 타임뱅크로 시간이 늘어남
      if (key === this.turnKey && !dlChanged) return;
      const isNewTurn = key !== this.turnKey;
      this.turnKey = key; this.deadline = deadline || 0;
      // 차례 시간: 고리가 줄어들며 파랑 → 보라 → 빨강, 고리 끝에 빛 알갱이가 따라 돎(피망 방식). 모두 transform·색만 바뀌어 화면 크기는 그대로
      this.seatEls.forEach((el) => { el.classList.remove('hurry', 'timing'); const r = el.querySelector('.ava'); r.style.removeProperty('--ms'); r.style.removeProperty('--dl'); });
      if (v.toAct >= 0 && deadline && this.seatEls[v.toAct]) {
        const el = this.seatEls[v.toAct], r = el.querySelector('.ava');
        const ms = Math.max(0, deadline - Date.now());
        const full = Math.max(ms, Online.turnMs || ms);
        r.style.setProperty('--ms', full + 'ms'); r.style.setProperty('--dl', -(full - ms) + 'ms');
        void r.offsetWidth;
        el.classList.add('timing');
      }
      TurnFx.update(v, deadline, isNewTurn);
    },

    showResult(v) {
      const res = v.result;
      const me = v.players.find((p) => p.id === this.myId);
      const potPt = this.tablePt([50, 46]);
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
          const from = pot.at ? this.tablePt(this.sidePotPos(v, pot.at)) : potPt;
          pot.winners.forEach((w, wi) => {
            const si = v.players.findIndex((p) => p.id === w);
            if (si < 0) return;
            const to = center(this.seatEls[si].querySelector('.ava'));
            for (let k = 0; k < 5; k++) this.flyChip(from, to, '#d4a017', null, k * 60 + pi * 120 + wi * 40);
          });
        });
        Sound.collect();
        if (res.rake > 0) {   // 팟에서 뗀 수수료 — 팟 자리에 잠깐
          const f = document.createElement('div');
          f.className = 'float-num rake'; f.textContent = '수수료 -' + fmt(res.rake);
          f.style.left = '50%'; f.style.top = '40%';
          $('#fx').appendChild(f); setTimeout(() => f.remove(), 2400);
        }
        this._potGone = hand;
        setTimeout(() => { $('#pot').classList.remove('show'); $$('#sidePots .side-pot').forEach((el) => el.classList.add('gone')); }, 400);
        const winners = new Set(); res.pots.forEach((pt) => { if (!pt.refund || res.pots.length === 1) pt.winners.forEach((w) => winners.add(w)); });
        v.players.forEach((p, i) => {
          if (winners.has(p.id)) this.seatEls[i].classList.add('win');   // 금액은 WINNER 배지에. 반환 팟만 받은 사람은 승자 연출 없음(칩 숫자가 숨겨지던 문제)
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
        if (myWin) { if (cat < 6) Sound.win(); this.confetti(cat >= 6 ? 90 : 36); }
        else if (me && me.inHand && !me.folded && res.type === 'showdown') Sound.lose();
        if (cat >= 6) { Sound.epic(); const fl = document.createElement('div'); fl.className = 'flash'; $('#fx').appendChild(fl); if (!myWin) this.confetti(50); }
      }, res.type === 'showdown' ? 900 : 300);
    },

    confetti(n) {
      const fx = $('#fx');
      const tr = fx.getBoundingClientRect();
      const W = tr.width || 360, H = tr.height || 640;
      const colors = ['#f2c35b', '#ff4d63', '#3b82f6', '#2fbf71', '#fff', '#c084fc'];
      for (let i = 0; i < n; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.background = colors[i % colors.length];
        c.style.left = 50 + (Math.random() - 0.5) * 20 + '%';
        c.style.top = '35%';
        fx.appendChild(c);
        // 테이블 크기 기준으로 퍼지게(작은 폰에서 화면 밖으로 날아가지 않게)
        const dx = (Math.random() - 0.5) * W * 0.9, dy = -(0.12 + Math.random() * 0.2) * H;
        const fall = H * (0.55 + Math.random() * 0.15);
        const rot = (Math.random() - 0.5) * 1080;
        c.animate([
          { transform: 'translate(0,0) rotate(0) scale(.6)', opacity: 1 },
          { transform: `translate(${dx * 0.6}px, ${dy}px) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px, ${dy + fall}px) rotate(${rot}deg) scale(.9)`, opacity: 0 },
        ], { duration: 1700 + Math.random() * 800, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
        setTimeout(() => c.remove(), 2600);
      }
    },

    rebuyFx(pid, amount, bbN) {
      if (!this.v) return;
      const i = this.v.players.findIndex((p) => p.id === pid);
      if (i < 0) return;
      const el = this.seatEls[i];
      const b = document.createElement('div');
      b.className = 'rb-pop'; b.innerHTML = `리바인<b class="num">+${fmt(amount)}</b>`;
      el.appendChild(b);
      setTimeout(() => b.remove(), 3600);
      const n = document.createElement('div');
      n.className = 'rb-note'; n.innerHTML = `💰 <b>${esc(this.v.players[i].name)}</b> 리바인 <b class="num">+${fmt(amount)}</b> <small>${bbN}BB</small>`;
      $('#fx').appendChild(n);
      setTimeout(() => n.remove(), 3200);
      const tr = $('#table').getBoundingClientRect(), to = center(el.querySelector('.ava'));
      for (let k = 0; k < 5; k++) this.flyChip({ x: tr.left + tr.width / 2, y: tr.top + 4 }, to, '#d4a017', null, k * 70);
      Sound.chip(); Sound.chip(0.1); Sound.win();
    },

    say(pid, text) {
      if (!this.v || !text) return;
      const i = this.v.players.findIndex((p) => p.id === pid);
      if (i < 0) return;
      const old = this.seatEls[i].querySelector('.say'); if (old) old.remove();
      const d = document.createElement('div');
      d.className = 'say'; d.textContent = text;
      this.seatEls[i].appendChild(d);
      Sound.pop();
      setTimeout(() => d.remove(), 2700);
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

  // ---------- 내 차례 알림 ----------
  // 차례가 오면: 차임 + 진동 + 내 자리 금빛 파동 + 테이블 아래 '내 차례!' 배지 + 버튼 줄 빛 + 남은 시간 막대,
  // 남은 5초부터 째깍 소리·빨간 막대, 다른 창을 보고 있으면 탭 제목 깜빡임
  const TurnFx = {
    key: '', hurryT: null, tickT: null, barRaf: 0, titleT: null, baseTitle: document.title,
    update(v, deadline, isNew) {
      const mine = !!(v.legal && !v.result);
      const bar = $('#turnBar');
      clearTimeout(this.hurryT); clearInterval(this.tickT); cancelAnimationFrame(this.barRaf);
      $('#actions').classList.remove('hurry');
      if (!mine) { this.stop(); return; }
      { const me = R.seatEls[R.myIndex(v)]; if (me) me.classList.add('my-go'); }
      if (isNew) this.alert(v);
      bar.classList.add('show');
      const ms = deadline ? Math.max(0, deadline - Date.now()) : 0;
      const full = Online.turnMs || ms || 1;
      const fill = $('#turnBarFill'), secs = $('#turnSecs');
      const loop = () => {
        const left = Math.max(0, (deadline || 0) - Date.now());
        fill.style.transform = `scaleX(${Math.min(1, left / full)})`;
        secs.textContent = deadline ? Math.ceil(left / 1000) + '초' : '';
        if (left > 0) this.barRaf = requestAnimationFrame(loop);
      };
      loop();
      this.renderTb();
      if (deadline) {
        const hurry = () => {
          const me = R.seatEls[R.myIndex(v)];
          if (me) me.classList.add('hurry');
          $('#actions').classList.add('hurry');
          const beat = () => { const left = deadline - Date.now(); if (left <= 0) return clearInterval(this.tickT); Sound.tick(left < 1500); if (navigator.vibrate && left < 1500) navigator.vibrate(30); };
          beat(); this.tickT = setInterval(beat, 1000);
        };
        if (ms <= 5000) hurry(); else this.hurryT = setTimeout(hurry, ms - 5000);
      }
    },
    alert(v) {
      Sound.turn();
      if (navigator.vibrate) navigator.vibrate([70, 50, 70]);
      const me = R.seatEls[R.myIndex(v)];
      if (me) { me.classList.remove('my-turn'); void me.offsetWidth; me.classList.add('my-turn'); }
      if (document.hidden) {
        this.baseTitle = this.baseTitle && !this.baseTitle.startsWith('🔔') ? this.baseTitle : document.title;
        let on = false; clearInterval(this.titleT);
        this.titleT = setInterval(() => { on = !on; document.title = on ? '🔔 내 차례!' : this.baseTitle; }, 700);
      }
    },
    renderTb() {
      const b = $('#tbBtn');
      const n = Online.tb | 0;
      b.innerHTML = `⏱ +15초 <small>${n}</small>`;
      b.disabled = !n || Online.tbUsed;
    },
    stop() {
      $('#turnBar').classList.remove('show');
      R.seatEls.forEach((el) => el.classList.remove('hurry', 'my-turn', 'my-go'));
      clearInterval(this.titleT); this.titleT = null;
      if (this.baseTitle && document.title.startsWith('🔔')) document.title = this.baseTitle;
    },
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && TurnFx.titleT) { clearInterval(TurnFx.titleT); TurnFx.titleT = null; document.title = TurnFx.baseTitle; } });

  // ---------- 액션 패널 ----------
  const Actions = {
    ctrl: null, raising: false, raiseTo: 0, L: null,
    render(v) {
      const a = $('#actions');
      const L = v.legal;
      this.L = L;
      const me0 = v.players.find((p) => p.id === R.myId);
      const canReveal = me0 && me0.inHand && me0.hole.length === 2 && me0.hole[0] !== '??' && (me0.folded || (v.stage === 'done' && !(v.result && v.result.hands && v.result.hands[me0.id]))) && (me0.showMask | 0) !== 3;
      // '내 패 공개' 줄은 '다음 핸드 준비 중…' 줄 자리를 대신 써서 버튼 영역 높이가 변하지 않게(테이블이 줄었다 커지며 흔들리던 문제)
      const rb0 = Online.rebuy, rbCan = !!(rb0 && rb0.can);
      const showReveal = !!canReveal && !(L && !v.result) && !(Online.waitRebuy > Date.now());
      a.classList.toggle('can-reveal', showReveal);
      if (showReveal) {
        const key = v.hk + ':' + (me0.showMask | 0) + ':' + (rbCan ? 1 : 0) + ':' + (v.stage === 'done' ? 1 : 0);
        const rr = $('#revealRow');
        if (rr.dataset.key !== key) {
          rr.dataset.key = key;
          const mini = (cs) => `<span class="mini">${cs.map((c) => `<div class="card"><div class="inner"><div class="face${c[1] === 'h' || c[1] === 'd' ? ' r' : ''}">${faceHTML(c)}</div></div></div>`).join('')}</span>`;
          const m = me0.showMask | 0;
          const lb = v.stage === 'done' ? '공개' : '끝나고 공개';   // 핸드 진행 중엔 예약만(끝난 뒤에 보임)
          rr.innerHTML = `<button data-mask="1" ${m & 1 ? 'disabled' : ''}>${mini([me0.hole[0]])}${lb}</button><button data-mask="2" ${m & 2 ? 'disabled' : ''}>${mini([me0.hole[1]])}${lb}</button><button data-mask="3">${mini(me0.hole)}${lb}</button>` + (rbCan ? `<button class="rb" id="rebuyBtn2">💰 리바인</button>` : '');
          rr.classList.toggle('with-rb', rbCan);
          const b2 = $('#rebuyBtn2'); if (b2) b2.onclick = rebuyModal;
        }
      }
      a.classList.toggle('online', !!(this.ctrl && this.ctrl.online && Online.mode !== 'daily'));
      const fold = $('#foldBtn'), call = $('#callBtn'), raise = $('#raiseBtn');
      if (L && !v.result) {
        a.classList.add('mine'); a.classList.remove('waiting', 'pre');
        fold.classList.remove('on'); call.classList.remove('on');
        fold.innerHTML = '폴드';
        fold.disabled = L.canCheck;
        const me = v.players.find((p) => p.id === R.myId);
        if (L.canCheck) call.innerHTML = '체크';
        else if (L.toCall >= me.stack) call.innerHTML = `올인 콜<small>${fmt(L.toCall)}</small>`;
        else call.innerHTML = `콜<small>${fmt(L.toCall)}</small>`;
        raise.disabled = !L.canRaise;
        if (this.raising && this._raiseKey !== v.hk + ':' + v.actionSeq) { this.raising = false; a.classList.remove('raising'); }   // 다른 핸드·다른 차례에서 열어 둔 패널은 닫음
        this._raiseKey = v.hk + ':' + v.actionSeq;
        if (!this.raising) this.raiseTo = L.minTo;
        this.syncRaise();
      } else {
        a.classList.remove('mine', 'raising');
        this.raising = false;
        a.classList.add('waiting');
        const wr = $('#waitRow');
        const me = v.players.find((p) => p.id === R.myId);
        let txt = '';
        if (v.watch) txt = v.reserved >= 0 ? '이번 핸드가 끝나면 자리에 앉아요' : (v.open && v.open.length ? '관전 중 · 빈자리나 AI 자리를 눌러 앉으세요' : '관전 중 · 빈자리가 없어요');
        else if (me && !me.inHand && me.stack > 0 && (me.waitBB || me.postBB)) txt = me.postBB ? '다음 핸드부터 참여해요 (BB 납부)' : '빅블라인드가 내 자리에 오면 참여해요';
        else if (me && !me.inHand && me.stack <= 0) txt = '관전 중';
        else if (v.result) txt = '다음 핸드 준비 중…';
        else if (v.runout) txt = '올인! 카드 공개 중…';
        else if (v.toAct >= 0) txt = `${esc(v.players[v.toAct].name)} 차례…`;
        const rb = Online.rebuy;
        if (Online.waitRebuy > Date.now()) txt = `리바인을 기다리는 중 · ${Math.ceil((Online.waitRebuy - Date.now()) / 1000)}초`;
        else if (rb && rb.can && me && me.stack <= 0) txt = '칩을 모두 잃었어요';
        // 체크/폴드 예약(피망 방식): 버튼 줄과 같은 자리·같은 높이의 상자 하나. 늘 그 자리에 있고 켜고 끌 때 다시 그리지 않아 화면이 움직이지 않음
        const canPre = !!(me && me.inHand && !me.folded && !me.allIn && !v.result && !v.runout && v.stage !== 'done' && this.ctrl && this.ctrl.online);
        if (!wr.dataset.built) {
          wr.dataset.built = '1';
          wr.innerHTML = `<button class="pre-box" id="preFoldBtn" type="button"><i></i><span>체크/폴드</span></button><div class="wait-msg"><span id="waitTxt"></span><button class="btn gold rb-btn" id="rebuyBtn" hidden>💰 리바인</button></div>`;
          $('#rebuyBtn').onclick = rebuyModal;
          $('#preFoldBtn').onclick = () => { if (!Actions.canPre) return; Online.preFold = !Online.preFold; Net.send({ t: 'pre', fold: Online.preFold }); Sound.pop(); Actions.render(R.v); };
        }
        this.canPre = canPre;
        // 내 차례가 아니어도 베팅 줄(체크/폴드 · 콜/체크 · 레이즈)이 그 자리에 그대로 — 미리 눌러 두는 예약 버튼(피망 방식)
        a.classList.toggle('pre', canPre);
        wr.classList.add('no-pre');
        if (canPre) {
          const cb = v.currentBet || 0, toCall = Math.max(0, Math.min(cb - (me.bet || 0), me.stack));
          this.preTo = cb;
          fold.disabled = false; raise.disabled = true; call.disabled = false;
          fold.innerHTML = '<i class="ck"></i>체크/폴드';
          call.innerHTML = '<i class="ck"></i>' + (toCall <= 0 ? '체크' : toCall >= me.stack ? `올인 콜<small>${fmt(toCall)}</small>` : `콜<small>${fmt(toCall)}</small>`);
          raise.innerHTML = cb > 0 ? '레이즈' : '베팅';
          fold.classList.toggle('on', !!Online.preFold);
          call.classList.toggle('on', Online.preCall != null && Online.preCall === cb);
        } else { fold.classList.remove('on'); call.classList.remove('on'); }
        $('#waitTxt').innerHTML = txt;
        $('#rebuyBtn').hidden = !(rb && rb.can);
        clearTimeout(Actions._wt);
        if (Online.waitRebuy > Date.now()) Actions._wt = setTimeout(() => R.v && Actions.render(R.v), 1000);
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
      // 같은 차례에 두 번 보내지 않음(더블 탭이 다음 스트리트의 체크/콜이 되던 문제). 서버도 행동 번호(seq)가 다르면 버림
      const v = R.v, key = v ? v.hk + ':' + v.actionSeq : '';
      if (key && this.sentKey === key) return;
      this.sentKey = key;
      this.raising = false;
      $('#actions').classList.remove('raising');
      $$('#actRow .act').forEach((b) => { b.disabled = true; });   // 다음 상태가 올 때까지 잠금
      this.ctrl.act(type, amount, v ? v.actionSeq : undefined);
    },
  };
  const isPre = () => $('#actions').classList.contains('pre');
  $('#foldBtn').onclick = () => {
    if (!isPre()) return Actions.send('fold');
    if (!Actions.canPre) return;
    Online.preFold = !Online.preFold; if (Online.preFold) Online.preCall = null;
    Net.send({ t: 'pre', fold: Online.preFold }); Sound.pop(); Actions.render(R.v);
  };
  $('#tbBtn').onclick = () => { if (!$('#tbBtn').disabled) { Net.send({ t: 'timebank' }); $('#tbBtn').disabled = true; } };
  $('#callBtn').onclick = () => {
    if (!isPre()) return Actions.send('call');
    if (!Actions.canPre) return;
    const on = Online.preCall != null && Online.preCall === Actions.preTo;
    Online.preCall = on ? null : Actions.preTo; if (!on) Online.preFold = false;
    Net.send({ t: 'pre', call: Online.preCall }); Sound.pop(); Actions.render(R.v);
  };
  $('#raiseBtn').onclick = () => {
    const L = Actions.L; if (!L || isPre()) return;
    if (L.minTo >= L.maxTo) return Actions.send('allin');
    if (!Actions.raising) {
      Actions.raising = true; Actions.raiseTo = L.minTo; Actions.openedAt = Date.now();
      $('#actions').classList.add('raising'); Actions.syncRaise(); return;
    }
    if (Date.now() - (Actions.openedAt || 0) < 350) return;   // 패널을 연 직후의 두 번째 터치(더블 탭)는 전송이 아님
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

  function hud(title, v, extra) {
    $('#hudTitle').textContent = title;
    if (v) $('#hudSub').textContent = `블라인드 ${fmt(v.sb)}/${fmt(v.bb)}${v.rake && v.rake.pct > 0 ? ' · 수수료 ' + v.rake.pct + '%' : ''} · ${extra || '#' + v.handNo}`;
  }
  const PHRASES = {
    p1: '빨리빨리~', p2: '아 까비!', p3: '이걸 넘겨?', p4: '나이스!', p5: '블러프지?', p6: '올인 간다!',
    p7: '한 판 더!', p8: 'ㅋㅋㅋㅋ', p9: '봐줬다~', p10: '살려줘…', p11: '굿게임!', p12: '고민 중…',
  };
  Object.entries(PHRASES).forEach(([id, txt]) => {
    const b = document.createElement('button'); b.textContent = txt;
    b.onclick = () => { $('#emotes').classList.remove('open'); Net.send({ t: 'emote', p: id }); };
    $('#sayList').appendChild(b);
  });

  // ---------- 서버 연결 ----------
  const Net = {
    ws: null, open: false, queue: [], handlers: {}, wantOpen: false, retry: 0,
    halted: false,   // 다른 곳에서 같은 계정으로 접속해 밀려난 상태 — '여기서 계속하기'를 누르기 전엔 어떤 send()도 다시 붙지 않음
    connect() {
      if (this.halted) return;
      this.wantOpen = true;
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + BASE + '/ws');
      this.ws = ws;
      ws.onopen = () => {
        this.open = true; this.retry = 0;
        ws.send(JSON.stringify({ t: 'hello', token: profile.token }));
        const q = this.queue; this.queue = [];
        q.forEach((m) => ws.send(JSON.stringify(m)));
      };
      ws.onmessage = (e) => {
        if (ws !== this.ws) return;
        this.lastRx = Date.now();
        let m; try { m = JSON.parse(e.data); } catch (er) { return; }
        const h = this.handlers[m.t]; if (h) h(m);
      };
      this.lastRx = Date.now();
      ws.onclose = () => {
        if (ws !== this.ws) return;   // 이미 새 연결로 바꾼 옛 연결
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
      else {
        // 끊긴 동안 누른 행동·예약·타임뱅크·방 목록은 버림(다시 붙으면 서버가 상태를 새로 주고, 늦게 도착한 행동이 다른 차례에 실행되면 안 됨)
        if (!['act', 'pre', 'timebank', 'roomList', 'ping', 'emote', 'reveal'].includes(m.t)) { this.queue.push(m); if (this.queue.length > 20) this.queue.shift(); }
        this.connect();
      }
    },
    on(t, fn) { this.handlers[t] = fn; },
    // 연결 확인: 휴대폰 화면이 꺼졌다 켜지면 소켓이 죽어 있는데도 '열림'으로 남아 버튼이 안 먹고 화면이 멈춤 →
    // 8초마다 ping, 서버 소식이 20초 없으면(또는 화면이 다시 보일 때 3초 안에 답이 없으면) 연결을 새로 맺음(서버가 방·상태를 다시 보내 줌)
    check(timeoutMs) {
      if (!this.wantOpen) return;
      if (!this.ws || this.ws.readyState !== 1) { this.connect(); return; }
      const sent = Date.now();
      try { this.ws.send('{"t":"ping"}'); } catch (e) { /* */ }
      clearTimeout(this.chkT);
      this.chkT = setTimeout(() => { if (this.lastRx < sent && this.wantOpen) this.reset(); }, timeoutMs);
    },
    reset() {
      const old = this.ws;
      this.ws = null; this.open = false;
      try { old && old.close(); } catch (e) { /* */ }
      this.connect();
    },
  };
  // 8초마다(뒤로 간 탭에서도) 서버에 ping — 서버는 45초 넘게 소식이 없는 연결을 '끊김'으로 처리함. 답이 8초 안에 없으면 새로 연결
  setInterval(() => { if (Net.wantOpen) Net.check(8000); }, 8000);
  // 화면 오류를 서버 로그로(무엇이 멈췄는지 나중에 확인)
  let errSent = 0;
  function reportErr(e, ctx) {
    if (errSent++ > 20) return;
    try { Net.send({ t: 'clientErr', msg: String((e && e.message) || e), stack: String((e && e.stack) || ''), ctx: ctx || '', ua: navigator.userAgent }); } catch (er) { /* */ }
  }
  window.addEventListener('error', (e) => reportErr(e.error || e.message, 'window ' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', (e) => reportErr(e.reason, 'promise'));
  // 화면 멈춤 감지: 0.5초마다 도는 타이머가 2초 넘게 늦으면(화면이 보이는 동안) 멈춘 시간과 그때 상황을 서버 로그로
  { let last = performance.now();
    setInterval(() => {
      const n = performance.now(), lag = n - last - 500; last = n;
      if (lag > 2000 && !document.hidden && !(Date.now() - (window.__hiddenAt || 0) < lag + 1000)) {
        const v = R.v;
        reportErr('화면 멈춤 ' + (lag / 1000).toFixed(1) + '초', 'stall screen=' + (($('.screen.active') || {}).id) + ' stage=' + (v && v.stage) + ' hk=' + (v && v.hk) + ' seq=' + (v && v.actionSeq) + ' fx=' + $('#fx').children.length + ' dom=' + document.getElementsByTagName('*').length);
      }
    }, 500);
    document.addEventListener('visibilitychange', () => { if (document.hidden) window.__hiddenAt = Date.now(); });
  }
  // 게임 화면인데 서버 상태가 25초 넘게 안 오면(연결은 살아 있는데 화면이 뒤처짐) 서버에 지금 상태를 다시 달라고 함
  setInterval(() => {
    if (!Online.active || current !== Online || !$('#game').classList.contains('active') || document.hidden) return;
    if (Online.lastStateAt && Date.now() - Online.lastStateAt > 25000 && Net.ws && Net.ws.readyState === 1) {
      Online.lastStateAt = Date.now();
      reportErr('상태 25초 없음 → 다시 받기', 'resync');
      Net.send({ t: 'resync' });
    }
  }, 5000);
  const wake = () => { if (!document.hidden) Net.check(3000); };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('pageshow', wake);
  window.addEventListener('online', () => Net.check(3000));
  window.addEventListener('focus', wake);

  // ---------- 회원·승인 ----------
  const Me = { info: null, pendingStart: null };
  const Online = {
    online: true, room: null, mode: null, active: false, pid: null,
    preFold: false, tb: 0, tbUsed: false, turnMs: 15000,
    act(type, amount, seq) { Net.send({ t: 'act', type, amount, seq }); },
    emote(e) { Net.send({ t: 'emote', e }); },
    reveal(mask) { Net.send({ t: 'reveal', mask }); },
    leave() { Net.send({ t: 'leave' }); this.active = false; this.room = null; },
  };
  Actions.ctrl = Online;
  $('#revealRow').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mask]'); if (!b || b.disabled) return;
    Online.reveal(+b.dataset.mask);
    if (R.v && R.v.stage !== 'done') toast('핸드가 끝나면 다른 사람에게 공개돼요');
  });

  function homeState(kind) {
    // kind: 'auth' | 'gate' | 'ready'
    $('#authBox').hidden = kind !== 'auth';
    $('#gateBox').hidden = kind !== 'gate';
    const ready = kind === 'ready';
    $('#meBar').hidden = !ready; $('#modesBox').hidden = !ready; $('#joinRow').hidden = !ready; $('#homeLinks').hidden = !ready;
    if (RoomList) { RoomList.render(); if (ready) RoomList.tick(); }
  }
  function gate(html) { $('#gateBox').innerHTML = html; homeState('gate'); }
  function renderMe() {
    const m = Me.info;
    if (!m) return;
    if (m.status === 'pending') {
      gate(`<img src="${avatarSrc(m.avatar)}"><b>${esc(m.name)}님, 가입 신청을 받았어요</b><div class="spin"></div><p>관리자가 가입을 승인하면 바로 이용할 수 있어요.</p><div class="row"><button class="btn ghost" id="gLogout">로그아웃</button></div>`);
    } else if (m.status === 'rejected') {
      gate(`<b>가입이 승인되지 않았어요</b><p>관리자에게 문의해 주세요.</p><div class="row"><button class="btn ghost" id="gLogout">로그아웃</button></div>`);
    } else if (m.status === 'blocked') {
      gate(`<b>이용이 막힌 계정이에요</b><p>관리자에게 문의해 주세요.</p><div class="row"><button class="btn ghost" id="gLogout">로그아웃</button></div>`);
    } else if (!m.approved) {
      if (!m.req) { Net.send({ t: 'enterReq' }); }   // 접속할 때마다 입장 승인 요청
      gate(`<img src="${avatarSrc(m.avatar)}"><b>${esc(m.name)}님, 입장 승인을 기다리는 중</b><div class="spin"></div><p>관리자가 승인하면 자동으로 들어가요.<br>보유 칩 <b class="num" style="color:var(--gold)">${fmt(m.balance)}</b></p><div class="row"><button class="btn ghost" id="gLogout">로그아웃</button></div>`);
    } else {
      $('#meAva').src = avatarSrc(m.avatar); $('#meName').textContent = m.name; $('#meBal').textContent = fmt(m.balance);
      if ($('#home').classList.contains('active')) homeState('ready');
      if (Me.pendingStart) { const f = Me.pendingStart; Me.pendingStart = null; setTimeout(f, 30); }
    }
    const lo = $('#gLogout'); if (lo) lo.onclick = logout;
    $$('#avatarPick img').forEach((x, k) => x.classList.toggle('on', k === (m.avatar | 0)));
  }
  function logout() {
    Net.send({ t: 'logout', token: profile.token });
    profile.token = null; store.set(SESS, null);
    Me.info = null; closeModal(); show('home'); homeState('auth');
  }
  function showTestPin(pin) {
    const el = $('#testPinNote');
    if (pin) { el.innerHTML = `🧪 테스트 기간 동안 PIN은 <b class="num">${esc(pin)}</b> 입니다<br><small>닉네임만 정하고 PIN ${esc(pin)}을 넣으면 누구나 들어올 수 있어요</small>`; el.hidden = false; }
    else el.hidden = true;
  }
  fetch(BASE + '/api/config').then((r) => r.json()).then((c) => {
    showTestPin(c.testPin);
    if (c.name && !c.main) { const el = $('#siteName'); if (el) { el.textContent = c.name; el.hidden = false; } document.title = c.name + ' · 로열 홀덤'; }
  }).catch(() => {});
  Net.on('auth', (m) => {
    if ('testPin' in m) showTestPin(m.testPin);
    Me.info = null;
    if (m.reason === 'blocked') $('#authErr').textContent = '이용이 막힌 계정이에요';
    else if (m.reason === 'expired') { profile.token = null; store.set(SESS, null); }
    if (!$('#home').classList.contains('active')) show('home');
    homeState('auth');
  });
  Net.on('authError', (m) => { $('#authErr').textContent = m.msg; });
  Net.on('session', (m) => { profile.token = m.token; store.set(SESS, m.token); $('#authErr').textContent = ''; });
  Net.on('me', (m) => {
    const was = Me.info;
    Me.info = m; Online.pid = m.pid; R.myId = m.pid;
    if (was && was.approved && !m.approved && !$('#home').classList.contains('active')) { goHome(true); }
    if (was && was.balance !== m.balance && was.approved && m.approved && !$('#home').classList.contains('active')) toast(`보유 칩 ${fmt(m.balance)}`);
    if ($('#home').classList.contains('active') || !m.approved) renderMe();
    else { $('#meBal').textContent = fmt(m.balance); }
  });
  Net.on('entryRejected', () => {
    gate(`<b>입장이 승인되지 않았어요</b><p>잠시 후 다시 요청해 보세요.</p><div class="row"><button class="btn primary" id="gRetry">다시 요청</button><button class="btn ghost" id="gLogout">로그아웃</button></div>`);
    $('#gRetry').onclick = () => Net.send({ t: 'enterReq' });
    $('#gLogout').onclick = logout;
    if (Me.info) Me.info.req = false;
  });
  Net.on('kicked', (m) => {
    closeModal(); Online.active = false; current = null; show('home');
    if (m.reason === 'dup') {   // 다른 곳에서 같은 계정으로 접속 — 이 화면은 다시 붙지 않음(서로 밀어내는 핑퐁 방지). '여기서 계속'을 누르면 이쪽이 다시 가져감
      Net.halted = true; Net.wantOpen = false; try { Net.ws && Net.ws.close(); } catch (e) { /* */ }
      modal(`<h3>다른 곳에서 접속했어요</h3><p>${esc(m.msg)}</p><div class="btns"><button class="btn primary big" id="dupHere">여기서 계속하기</button></div>`, (el) => { el.querySelector('#dupHere').onclick = () => { closeModal(); Net.halted = false; Net.retry = 0; Net.queue = []; Net.connect(); }; });
      return;
    }
    modal(`<h3>알림</h3><p>${esc(m.msg)}</p><div class="btns"><button class="btn ghost" data-close>확인</button></div>`);
  });
  function doLogin(signup) {
    const name = $('#nick').value.trim(), pin = $('#pin').value.trim();
    $('#authErr').textContent = '';
    if (name.length < 1) return ($('#authErr').textContent = '닉네임을 입력해 주세요');
    if (!/^\d{4,6}$/.test(pin)) return ($('#authErr').textContent = 'PIN은 숫자 4~6자리예요');
    store.set('rh_name', name);
    Net.send(signup ? { t: 'signup', name, pin, avatar: profile.avatar } : { t: 'login', name, pin });
  }
  $('#loginBtn').onclick = () => doLogin(false);
  $('#signupBtn').onclick = () => doLogin(true);
  $('#pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(false); });

  // ---------- 게임 소식 ----------
  Net.on('error', (m) => toast(m.msg));
  Net.on('room', (m) => {
    current = Online;
    R.myId = Online.pid;
    Online.room = m; Online.active = true; Online.mode = m.mode;
    if (m.status === 'lobby') { show('lobby'); renderLobby(m); }
    else if (!$('#game').classList.contains('active')) { R.reset(); show('game'); }
    if (m.status === 'playing' && $('#modal').dataset.kind === 'over') { closeModal(); $('#modal').dataset.kind = ''; }
  });
  const MODE_TITLE = { solo: 'AI 대결', friends: '친구 대전', daily: '오늘의 토너먼트' };
  Net.on('state', (m) => {
    if (!Online.active || current !== Online) return;
    R.myId = Online.pid;
    Online.rebuy = m.rebuy || null;
    Online.waitRebuy = m.waitRebuy ? Date.now() + m.waitRebuy : 0;
    Online.preFold = !!m.preFold; Online.preCall = m.preCall == null ? null : m.preCall; Online.tb = m.tb | 0; Online.tbUsed = !!m.tbUsed; Online.turnMs = m.turnMs || 15000;
    if (!$('#game').classList.contains('active')) { R.reset(); show('game'); }
    try { R.render(m.view, { deadline: m.deadline ? Date.now() + m.deadline : 0 }); }
    catch (e) {
      // 화면 그리기에서 오류가 나도 버튼 줄은 살려 둠(예전엔 여기서 멈추면 그 판 내내 버튼이 안 먹음) + 서버 로그로 보냄
      reportErr(e, 'render ' + (m.view && m.view.stage) + ' hk=' + (m.view && m.view.hk) + ' seq=' + (m.view && m.view.actionSeq));
      // 한 번 꼬이면 다음 상태도 같은 곳에서 계속 실패해 화면이 굳음(새로고침해야 풀리던 증상) → 테이블을 처음부터 다시 그림
      try { R.reset(); R.render(m.view, { deadline: m.deadline ? Date.now() + m.deadline : 0 }); }
      catch (e2) { reportErr(e2, 'render-retry'); try { R.v = m.view; Actions.render(m.view); } catch (e3) { reportErr(e3, 'actions'); } }
    }
    Online.lastStateAt = Date.now();
    if (m.mode === 'daily') hud('오늘의 토너먼트', m.view, `핸드 ${Math.min(m.view.handNo, m.handLimit)}/${m.handLimit}`);
    else if (m.mode === 'friends') hud('친구 대전 · ' + (Online.room ? Online.room.code : ''), m.view);
    else hud(MODE_TITLE[m.mode] || '로열 홀덤', m.view);
  });
  Net.on('emote', (m) => { if (m.p) R.say(m.pid, PHRASES[m.p] || ''); else R.emote(m.pid, m.e); });
  Net.on('over', (m) => {
    $('#modal').dataset.kind = 'over';
    const cash = `<p>정산 <b class="num" style="color:var(--gold)">${fmt(m.cashOut)}</b> → 보유 칩 <b class="num">${fmt(m.balance)}</b></p>`;
    if (m.mode === 'solo') {
      const me = m.standings.find((s) => s.pid === R.myId);
      const won = me && m.standings[0].pid === R.myId && m.standings.filter((s) => s.stack > 0).length === 1;
      modal(`<h3>${won ? '🏆 테이블 정복!' : me && me.stack > 0 ? '게임 종료' : '탈락'}</h3>${cash}
        <div class="btns"><button class="btn primary big" id="again">다시 하기</button><button class="btn ghost" id="toHome">홈으로</button></div>`,
      (el) => {
        el.querySelector('#again').onclick = () => { closeModal(); startSolo(); };
        el.querySelector('#toHome').onclick = () => goHome();
      });
      if (won) { Sound.epic(); R.confetti(100); }
      Online.active = false;
      return;
    }
    modal(`<h3>🏁 게임 종료</h3>${cash}
      <ol class="rank-list">${m.standings.map((s, i) => `<li class="${s.pid === R.myId ? 'me' : ''}"><span class="rk">${i + 1}</span><img src="${avatarSrc(s.avatar)}"><span class="nm">${esc(s.name)}</span><span class="sc">${fmt(s.stack)}</span></li>`).join('')}</ol>
      <div class="btns"><button class="btn primary big" id="again">🔁 다시 앉기 (칩 가져오기)</button>
      <button class="btn ghost" id="leaveRoom">나가기</button></div>`,
    (el) => {
      el.querySelector('#again').onclick = () => { closeModal(); $('#modal').dataset.kind = ''; show('lobby'); const rm = Online.room; if (rm) $('#sitBtn').click(); };
      el.querySelector('#leaveRoom').onclick = () => { goHome(); };
    });
  });
  Net.on('dailyEnd', (m) => {
    $('#modal').dataset.kind = 'daily';
    Online.active = false;
    modal(`<h3>🏆 오늘의 기록</h3>
      <div class="big-score">${fmt(m.score)}</div>
      <p>${m.total}명 중 <b style="color:var(--gold)">${m.rank}위</b></p>
      ${rankListHTML(m.top)}
      <div class="btns"><button class="btn gold" id="shareScore">📣 기록 자랑하기</button><button class="btn ghost" id="dHome">홈으로</button></div>`,
    (el) => {
      el.querySelector('#dHome').onclick = () => goHome();
      el.querySelector('#shareScore').onclick = () => share(`오늘의 홀덤 토너먼트 ${m.rank}위! 최종 칩 ${fmt(m.score)} — 같은 카드로 붙어보자`, location.origin + BASE + '/');
    });
  });
  Net.on('left', () => { Online.active = false; });
  Net.on('pong', () => {});
  Net.on('restart', () => {
    if (!Online.active) return;
    Online.active = false; current = null; closeModal(); show('home');
    modal(`<h3>서버 업데이트</h3><p>서버가 새 버전으로 바뀌면서 진행 중이던 판이 끝났어요.<br>테이블 칩은 보유 칩으로 그대로 돌려드려요. 잠시 뒤 다시 시작해 주세요.</p><div class="btns"><button class="btn primary" data-close>확인</button></div>`);
  });
  Net.on('toast', (m) => toast(m.msg));
  // 다시 연결했는데 서버에 내 방이 없음(시간 초과로 빠졌거나 게임이 끝남) → 멈춘 화면 대신 홈으로
  Net.on('noRoom', () => {
    if (!Online.active || current !== Online) return;
    if ($('#modal').classList.contains('show') && ['over', 'daily'].includes($('#modal').dataset.kind)) return;
    if ($('#game').classList.contains('active') || $('#lobby').classList.contains('active')) { goHome(true); toast('연결이 끊긴 사이 방에서 나왔어요. 테이블 칩은 보유 칩으로 돌아갔어요'); }
  });

  function renderLobby(m) {
    $('#roomCode').textContent = m.code;
    const slots = [];
    for (let i = 0; i < (m.maxSeats || 9); i++) {
      const p = m.members[i];
      if (p) slots.push(`<li class="${p.online ? '' : 'off'}">${p.host ? '<span class="host">👑</span>' : ''}<img src="${avatarSrc(p.avatar)}"><span>${esc(p.name)}${p.pid === R.myId ? ' (나)' : ''}</span><small class="seat-amt ${p.seat ? '' : 'wait'}">${p.seat ? fmt(p.seat) : '칩 고르는 중'}</small></li>`);
      else slots.push(`<li class="empty">${m.fillBots ? '🤖 AI' : '빈자리'}</li>`);
    }
    $('#members').innerHTML = slots.join('');
    $('#botToggle').checked = m.fillBots;
    $('#botToggle').disabled = !m.isHost;
    $('#startBtn').style.display = m.isHost ? '' : 'none';
    const allSeated = m.members.every((x) => x.seat > 0);
    const canStart = (m.members.length >= 2 || m.fillBots) && allSeated;
    $('#startBtn').disabled = !canStart;
    $('#roomRule').innerHTML = `블라인드 <b class="num">${fmt(m.sb)} / ${fmt(m.bb)}</b> · 최소 머니 <b class="num">${fmt(m.minIn)}</b><br><small>${rakeTxt(m.rake)}</small>`;
    const sitBtn = $('#sitBtn');
    sitBtn.hidden = m.mySeat > 0;
    sitBtn.onclick = () => buyInModal({ title: '칩 가져오기', sb: m.sb, bb: m.bb, minIn: m.minIn, rake: m.rake || null, go: '앉기', onOk: (x) => Net.send({ t: 'sit', buyIn: x.buyIn }) });
    $('#lobbyHint').textContent = !allSeated ? '모두 칩을 가져와 앉으면 시작할 수 있어요' : m.isHost ? (canStart ? '' : '친구가 들어오거나 AI 채우기를 켜면 시작할 수 있어요') : '방장이 시작하길 기다리는 중…';
  }
  $('#botToggle').onchange = (e) => Net.send({ t: 'setBots', on: e.target.checked });
  $('#startBtn').onclick = () => Net.send({ t: 'start' });
  $('#shareBtn').onclick = () => {
    const code = Online.room && Online.room.code;
    share(`${Me.info ? Me.info.name : ''}님이 홀덤 한 판 하자고 초대했어요! 방 코드 ${code}`, `${location.origin}${BASE}/?room=${code}`);
  };
  async function share(text, url) {
    if (navigator.share) { try { await navigator.share({ title: '로열 홀덤', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text + '\n' + url); toast('링크를 복사했어요'); }
    catch (e) { prompt('아래 링크를 복사하세요', url); }
  }

  // ---------- 칩 가져오기(입장) 창 ----------
  const BLINDS = [[50, 100], [100, 200], [250, 500], [500, 1000], [1000, 2000], [2500, 5000], [5000, 10000], [10000, 20000]];
  const MIN_INS = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
  const short = (n) => n >= 10000 ? (n % 10000 === 0 ? n / 10000 + '만' : (n / 10000).toFixed(1) + '만') : fmt(n);
  const defMin = (bb) => Math.max(MIN_INS.find((x) => x >= bb * 20) || bb * 20, bb * 10, (Me.info && Me.info.minBuyIn) || 0);
  // o: { title, pickBlinds, pickMin, sb, bb, minIn, go:'만들기', onOk(opts) }
  function buyInModal(o) {
    const bal = Me.info ? Me.info.balance : 0;
    let bb = o.bb || 100, minIn = o.minIn || defMin(bb), amt = 0, post = false;
    const fitAmt = (v) => Math.max(minIn, Math.min(bal, Math.round(v / 100) * 100));
    amt = fitAmt(Math.min(bal, Math.max(minIn, (Me.info && Me.info.buyIn) || bb * 100)));
    modal(`<h3>${esc(o.title)}</h3>
      <div class="bi">
        ${o.pickBlinds ? '<label>블라인드 (SB / BB)</label><div class="bi-chips" id="biBlinds"></div>' : `<p class="bi-info">블라인드 <b class="num">${fmt(o.sb)} / ${fmt(o.bb)}</b> · 최소 머니 <b class="num">${fmt(minIn)}</b></p>`}
        ${o.pickMin ? '<label>최소 머니 (들어올 때 이만큼은 가져와야 해요)</label><div class="bi-chips" id="biMins"></div>' : ''}
        <p class="bi-rake" id="biRake"></p>
        <label>가져갈 칩 <small>보유 ${fmt(bal)}</small></label>
        <div class="bi-amt num" id="biAmt"></div>
        <input type="range" id="biRange">
        <div class="bi-quick" id="biQuick"></div>
        <p class="bi-err" id="biErr"></p>
        ${o.pickPost ? `<label>언제부터 칠까요?</label><div class="bi-post" id="biPost">
          <button data-post="0" class="on"><b>빅블라인드 차례까지 기다리기</b><small>추가로 내는 칩 없음 · BB가 내 자리에 오면 참여</small></button>
          <button data-post="1"><b>BB ${fmt(o.bb)} 내고 다음 핸드부터</b><small>버튼과 SB 사이 자리면 버튼이 지나갈 때까지 기다려요</small></button></div>` : ''}
      </div>
      <div class="btns"><button class="btn primary big" id="biOk">${esc(o.go || '입장')}</button><button class="btn ghost" data-close>취소</button></div>`,
    (el) => {
      const draw = () => {
        if (o.pickBlinds) el.querySelector('#biBlinds').innerHTML = BLINDS.map(([a, b]) => `<button data-bb="${b}" class="${b === bb ? 'on' : ''}">${short(a)}/${short(b)}</button>`).join('');
        if (o.pickMin) el.querySelector('#biMins').innerHTML = MIN_INS.filter((x) => x >= bb * 10).map((x) => `<button data-min="${x}" class="${x === minIn ? 'on' : ''}" ${x > bal ? 'disabled' : ''}>${short(x)}</button>`).join('');
        { const rt = Me.info && Me.info.rake && Me.info.rake[bb]; el.querySelector('#biRake').textContent = rakeTxt(o.rake !== undefined ? o.rake : rt ? rt[o.mode || 'friends'] : null); }
        const ok = bal >= minIn;
        const r = el.querySelector('#biRange');
        r.min = minIn; r.max = Math.max(minIn, bal); r.step = 100; r.value = amt; r.disabled = !ok;
        el.querySelector('#biAmt').textContent = ok ? fmt(amt) : '-';
        el.querySelector('#biAmt').dataset.bb = ok ? `${Math.floor(amt / bb)}BB` : '';
        el.querySelector('#biErr').textContent = ok ? '' : `보유 칩이 최소 머니(${fmt(minIn)})보다 적어요`;
        el.querySelector('#biOk').disabled = !ok;
        const qs = [['최소', minIn], ['100BB', bb * 100], ['절반', Math.floor(bal / 2)], ['전부', bal]].filter(([, v]) => v >= minIn && v <= bal);
        el.querySelector('#biQuick').innerHTML = qs.map(([n, v]) => `<button data-v="${v}">${n}</button>`).join('');
      };
      el.onclick = (e) => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.dataset.bb) { bb = +b.dataset.bb; if (minIn < bb * 10 || !o.pickMin || minIn > bal) minIn = defMin(bb); amt = fitAmt(Math.max(amt, minIn)); draw(); }
        else if (b.dataset.min) { minIn = +b.dataset.min; amt = fitAmt(Math.max(amt, minIn)); draw(); }
        else if (b.dataset.v) { amt = fitAmt(+b.dataset.v); draw(); }
        else if (b.dataset.post) { post = b.dataset.post === '1'; el.querySelectorAll('#biPost button').forEach((x) => x.classList.toggle('on', x === b)); }
      };
      el.querySelector('#biRange').oninput = (e) => { amt = fitAmt(+e.target.value); el.querySelector('#biAmt').textContent = fmt(amt); el.querySelector('#biAmt').dataset.bb = `${Math.floor(amt / bb)}BB`; };
      el.querySelector('#biOk').onclick = () => { closeModal(); o.onOk({ sb: (BLINDS.find((x) => x[1] === bb) || [bb / 2])[0], bb, minIn, buyIn: amt, post }); };
      draw();
    });
  }
  // ---------- 진행 중인 방: 빈자리·AI 자리에 앉기 ----------
  function sitModal(i) {
    const v = R.v, room = Online.room;
    if (!v || !room) return;
    const p = v.players[i];
    buyInModal({ title: p && p.isBot ? `${p.name} 자리에 앉기` : '빈자리에 앉기', sb: v.sb, bb: v.bb, minIn: room.minIn, pickPost: true, go: '앉기',
      onOk: (x) => Net.send({ t: 'takeSeat', seat: i, buyIn: x.buyIn, post: x.post }) });
  }
  Net.on('seatTaken', (m) => { if (m.pid !== Online.pid) toast(`${m.name}님이 자리에 앉았어요`); else toast(m.post ? '다음 핸드부터 참여해요' : '빅블라인드 차례에 참여해요'); });

  // ---------- 리바인 ----------
  function rebuyModal() {
    const rb = Online.rebuy, v = R.v;
    if (!rb || !rb.can || !v) return;
    const bb = v.bb, hi = Math.min(rb.max, rb.balance);
    let amt = Math.min(hi, bb * 100 >= rb.min ? Math.max(rb.min, Math.min(bb * 100, hi)) : rb.min);
    modal(`<h3>💰 리바인</h3>
      <div class="bi">
        <p class="bi-info">블라인드 <b class="num">${fmt(v.sb)} / ${fmt(bb)}</b><br>리바인 <b class="num">${fmt(rb.min)}</b> (40BB) ~ <b class="num">${fmt(rb.max)}</b> (200BB)</p>
        <label>리바인할 칩 <small>보유 ${fmt(rb.balance)}</small></label>
        <div class="bi-amt num" id="rbAmt"></div>
        <input type="range" id="rbRange" min="${rb.min}" max="${Math.max(rb.min, hi)}" step="${bb}">
        <div class="bi-quick" id="rbQuick">${[['40BB', rb.min], ['100BB', bb * 100], ['200BB', rb.max], ['최대', hi]].filter(([, x]) => x >= rb.min && x <= hi).map(([n, x]) => `<button data-v="${x}">${n}</button>`).join('')}</div>
        <p class="bi-err">${rb.balance < rb.min ? `보유 칩이 ${fmt(rb.min)}보다 적어요` : ''}</p>
      </div>
      <div class="btns"><button class="btn gold big" id="rbOk" ${rb.balance < rb.min ? 'disabled' : ''}>리바인</button><button class="btn ghost" data-close>취소</button></div>`,
    (el) => {
      const set = (x) => { amt = Math.max(rb.min, Math.min(hi, Math.round(x / bb) * bb)); el.querySelector('#rbAmt').textContent = fmt(amt); el.querySelector('#rbAmt').dataset.bb = Math.round(amt / bb) + 'BB'; el.querySelector('#rbRange').value = amt; el.querySelector('#rbOk').textContent = `리바인 +${fmt(amt)}`; };
      el.querySelector('#rbRange').oninput = (e) => set(+e.target.value);
      el.onclick = (e) => { const b = e.target.closest('button[data-v]'); if (b) set(+b.dataset.v); };
      el.querySelector('#rbOk').onclick = () => { closeModal(); Net.send({ t: 'rebuy', amount: amt }); };
      set(amt);
    });
  }
  Net.on('rebuy', (m) => {
    R.rebuyFx(m.pid, m.amount, m.bb);
    toast(`💰 ${m.name}님 리바인 +${fmt(m.amount)} (${m.bb}BB)`);
  });

  Net.on('roomInfo', (m) => {
    if (m.mine) { Net.send({ t: 'join', code: m.code }); return; }
    if (m.status === 'playing') { current = Online; R.reset(); Net.send({ t: 'join', code: m.code }); return; }   // 진행 중: 관전으로 들어가 빈자리에 앉기
    if (m.status !== 'lobby') return toast('이미 게임이 진행 중인 방이에요');
    buyInModal({ title: `방 ${m.code} 들어가기`, sb: m.sb, bb: m.bb, minIn: m.minIn, rake: m.rake || null, go: '칩 가져가서 입장', onOk: (x) => { current = Online; Net.send({ t: 'join', code: m.code, buyIn: x.buyIn }); } });
  });

  // ---------- 홈 ----------
  let current = null;
  function goHome(silent) {
    closeModal();
    if (Online.active && !silent) Online.leave();
    Online.active = false;
    current = null;
    history.replaceState(null, '', location.pathname + (EMBED ? '?embed=1' : ''));
    show('home');
    renderMe();
    loadDailyInfo();
  }
  const approved = () => Me.info && Me.info.approved;
  function needApproval(fn) {
    if (approved()) return fn();
    Me.pendingStart = fn;
    toast('관리자 입장 승인이 필요해요');
  }
  function startSolo() {
    needApproval(() => buyInModal({ title: 'AI 대결 — 테이블 고르기', pickBlinds: true, mode: 'solo', go: '앉기', onOk: (x) => { current = Online; R.reset(); Net.send(Object.assign({ t: 'solo' }, x)); } }));
  }
  function createFriends() {
    buyInModal({ title: '친구 대전 방 만들기', pickBlinds: true, pickMin: true, mode: 'friends', go: '방 만들기', onOk: (x) => { current = Online; Net.send(Object.assign({ t: 'create' }, x)); } });
  }
  // '친구 대전' → 열린 방 목록(바로 입장) + 방 만들기 + 코드로 입장
  function startFriends() {
    needApproval(() => {
      modal(`<h3>친구 대전</h3>
        <p class="rb-sub">열린 방에 바로 들어가거나 새 방을 만드세요</p>
        <div class="room-list rb-list" id="rbList"><div class="rb-empty">방 목록을 불러오는 중…</div></div>
        <div class="join-row rb-join"><input id="rbCode" maxlength="4" placeholder="방 코드" autocomplete="off"><button class="btn ghost" id="rbJoin">코드로 입장</button></div>
        <div class="btns"><button class="btn primary" id="rbCreate">＋ 새 방 만들기</button><button class="btn ghost" data-close>닫기</button></div>`, (el) => {
        el.querySelector('#rbCreate').onclick = createFriends;
        el.querySelector('#rbJoin').onclick = () => joinRoom(el.querySelector('#rbCode').value);
        el.querySelector('#rbCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(e.target.value); });
        el.querySelector('#rbList').addEventListener('click', (e) => { const b = e.target.closest('[data-join]'); if (b) joinRoom(b.dataset.join); });
        RoomList.browse = true;
        RoomList.render();
        RoomList.tick();
      });
    });
  }
  // ---------- 홈: 친구 대전 열린 방 목록 ----------
  var RoomList = {   // var: show()/homeState()가 먼저 불려도 안전하게
    list: [], open: false, t: null,
    tick() {
      clearTimeout(this.t);
      const home = $('#home').classList.contains('active');
      const browsing = this.browse && $('#modal').classList.contains('show') && $('#rbList');
      if ((home || browsing) && approved() && !document.hidden) Net.send({ t: 'roomList' });
      this.t = setTimeout(() => this.tick(), home || browsing ? 3000 : 8000);
    },
    browse: false,
    rows() {
      return this.list.map((r) => {
        const full = r.count >= r.maxSeats, playing = r.status !== 'lobby';
        const btn = r.mine ? `<button class="btn primary sm" data-join="${r.code}">돌아가기</button>`
          : playing ? `<button class="btn primary sm" data-join="${r.code}">${r.open ? '관전·앉기' : '관전하기'}</button>`
          : full ? `<button class="btn ghost sm" disabled>가득 참</button>`
          : `<button class="btn primary sm" data-join="${r.code}">입장하기</button>`;
        return `<div class="room-row${r.mine ? ' mine' : ''}">
          <img src="${avatarSrc(r.hostAva)}" alt="">
          <div class="rr-t"><b>${esc(r.host)}<small>님의 방</small></b>
            <span>👥 <i class="num">${r.count}/${r.maxSeats}</i>${playing && r.open ? ` · 빈자리 <i class="num">${r.open}</i>` : ''} · <i class="num">${short(r.sb)}/${short(r.bb)}</i> · 최소 <i class="num">${short(r.minIn)}</i></span></div>
          <span class="rr-st ${playing ? 'play' : 'wait'}">${playing ? '게임 중' : '대기 중'}</span>${btn}</div>`;
      }).join('');
    },
    render() {
      const L = this.list, box = $('#roomList'), cnt = $('#roomCnt');
      const show = approved() && !$('#modesBox').hidden;
      cnt.hidden = !show || !L.length;
      cnt.textContent = `방 ${L.length}개`;
      // 열린 친구 대전 창
      const rb = $('#rbList');
      if (rb && $('#modal').classList.contains('show')) {
        rb.innerHTML = L.length ? `<div class="rl-head">열린 방 <b class="num">${L.length}</b></div>` + this.rows()
          : `<div class="rb-empty">지금 열린 방이 없어요<br><small>새 방을 만들면 다른 사람도 여기서 바로 들어올 수 있어요</small></div>`;
      } else this.browse = false;
      box.hidden = !show || !L.length;
      if (box.hidden) return;
      box.innerHTML = `<div class="rl-head">열린 방 <b class="num">${L.length}</b> · 눌러서 바로 입장</div>` + this.rows();
    },
  };
  Net.on('roomList', (m) => { RoomList.list = m.list || []; RoomList.render(); });
  $('#roomList').addEventListener('click', (e) => { const b = e.target.closest('[data-join]'); if (b) joinRoom(b.dataset.join); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) RoomList.tick(); });

  function joinRoom(code) {
    code = (code || '').trim().toUpperCase();
    if (code.length !== 4) return toast('방 코드 4자리를 입력하세요');
    needApproval(() => Net.send({ t: 'peek', code }));
  }
  async function startDaily() {
    if (!approved()) return needApproval(startDaily);
    const info = await fetchDaily();
    if (info && info.played) return showRanking(info, true);
    modal(`<h3>🏆 오늘의 토너먼트</h3>
      <p>오늘 참가자 <b>모두 같은 카드</b>로 AI 8명과 겨뤄요.<br>시작 칩 10,000(보유 칩과 별개) · <b>30핸드</b> 후 남은 칩으로 순위!<br>블라인드는 10핸드마다 올라가요.</p>
      <p class="muted">하루 1번만 도전할 수 있고, 시작하면 중간에 나가도 그때 칩으로 기록돼요.</p>
      <div class="btns"><button class="btn gold big" id="goDaily">도전 시작</button><button class="btn ghost" data-close>다음에</button></div>`,
    (el) => { el.querySelector('#goDaily').onclick = () => { closeModal(); current = Online; R.reset(); Net.send({ t: 'daily' }); }; });
  }
  async function fetchDaily() {
    try {
      const r = await fetch(BASE + '/api/daily' + (profile.token ? '?token=' + encodeURIComponent(profile.token) : ''));
      return await r.json();
    } catch (e) { return null; }
  }
  function rankListHTML(top) {
    if (!top || !top.length) return '<p class="muted">아직 기록이 없어요. 첫 번째 주인공이 되어보세요!</p>';
    return `<ol class="rank-list">${top.map((s, i) => `<li class="${s.mine ? 'me' : ''}"><span class="rk">${i + 1}</span><img src="${avatarSrc(s.avatar)}"><span class="nm">${esc(s.name)}</span><span class="sc">${fmt(s.score)}</span></li>`).join('')}</ol>`;
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
      <p><b>보유 칩</b> 게임에 앉을 때 보유 칩에서 바이인하고, 나올 때 남은 칩이 돌아와요. 게임 안에서만 쓰는 칩이에요.</p>
      </div><div class="btns"><button class="btn ghost" data-close>닫기</button></div>`);
  }

  // 아바타 선택(9명)
  const ap = $('#avatarPick');
  for (let i = 0; i < 9; i++) {
    const img = document.createElement('img');
    img.src = avatarSrc(i);
    img.className = i === profile.avatar ? 'on' : '';
    img.onclick = () => {
      profile.avatar = i; store.set('rh_avatar', i);
      $$('#avatarPick img').forEach((x, k) => x.classList.toggle('on', k === i));
      if (Me.info) Net.send({ t: 'setAvatar', avatar: i });
    };
    ap.appendChild(img);
  }
  $('#meAva').onclick = () => {
    modal(`<h3>캐릭터 바꾸기</h3><div class="avatar-pick" id="avPick2" style="margin:12px auto"></div><div class="btns"><button class="btn ghost" data-close>닫기</button></div>`, (el) => {
      const box = el.querySelector('#avPick2');
      for (let i = 0; i < 9; i++) {
        const img = document.createElement('img'); img.src = avatarSrc(i); img.className = Me.info && Me.info.avatar === i ? 'on' : '';
        img.onclick = () => { Net.send({ t: 'setAvatar', avatar: i }); closeModal(); };
        box.appendChild(img);
      }
    });
  };
  $('#nick').value = store.get('rh_name', '') || '';
  $('#logoutBtn').onclick = logout;
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
  $$('[data-back]').forEach((b) => b.onclick = () => goHome());
  $('#exitBtn').onclick = () => {
    const daily = Online.active && Online.mode === 'daily';
    modal(`<h3>나가기</h3><p>${daily ? '지금 나가면 현재 칩으로 오늘 기록이 확정돼요.' : '게임에서 나갈까요? 남은 칩은 보유 칩으로 돌아가요(진행 중인 핸드에 건 칩은 제외).'}</p>
      <div class="btns"><button class="btn primary big" data-close>계속하기</button><button class="btn ghost" id="reallyExit">나가기</button></div>`,
    (el) => { el.querySelector('#reallyExit').onclick = () => goHome(); });
  };
  // 소리 버튼: 효과음+음성(캐릭터 목소리) → 효과음만 → 끔
  const syncSoundBtn = () => {
    const b = $('#soundBtn');
    b.textContent = !Sound.on ? '🔇' : Sound.voiceOn ? '🔊' : '🔉';
    b.title = !Sound.on ? '소리 끔' : Sound.voiceOn ? '효과음 + 캐릭터 음성' : '효과음만';
  };
  $('#soundBtn').onclick = () => {
    if (Sound.on && Sound.voiceOn) { Sound.voiceOn = false; toast('효과음만 (음성 끔)'); }
    else if (Sound.on) { Sound.on = false; toast('소리 끔'); }
    else { Sound.on = true; Sound.voiceOn = true; toast('효과음 + 캐릭터 음성'); Sound.ensure(); setTimeout(() => Sound.say('call', Me.info ? Me.info.avatar : profile.avatar), 150); }
    store.set('rh_sound', Sound.on); store.set('rh_voice', Sound.voiceOn); syncSoundBtn();
  };
  syncSoundBtn();
  window.addEventListener('resize', () => { if (R.v) R.layout(R.v); });

  // 하루퍼즐 안에서 열렸을 때
  if (EMBED) {
    $('#homeBack').hidden = false;
    $('#homeBack').onclick = () => { Net.send({ t: 'exit' }); setTimeout(() => toParent('exit'), 80); };
    const nm = (Q0.get('name') || '').trim().slice(0, 10);
    if (nm && !$('#nick').value) $('#nick').value = nm;
    const st = Q0.get('start');
    if (st === 'solo') Me.pendingStart = startSolo;
    else if (st === 'friends') Me.pendingStart = startFriends;
    toParent('ready');
  }

  // 초대 링크로 들어온 경우: 로그인·승인 뒤 바로 입장
  const params = new URLSearchParams(location.search);
  if (params.get('room')) { const code = params.get('room'); Me.pendingStart = () => joinRoom(code); }
  homeState(profile.token ? 'gate' : 'auth');
  if (profile.token) gate('<div class="spin"></div><p>연결 중…</p>');
  Net.connect();
  RoomList.tick();
  loadDailyInfo();

  // 디버그/테스트용
  window.__rh = { R, Online, Net, Me, Sound, show, get current() { return current; } };
})();
