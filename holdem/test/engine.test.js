const assert = require('assert');
const H = require('../public/engine');

const ev = (s) => H.evaluate(s.split(' '));
const name = (s) => H.handName(ev(s));
let n = 0;
function t(desc, fn) { fn(); n++; }

// 족보
t('names', () => {
  assert.strictEqual(name('As Ks Qs Js Ts 2d 3c'), '로열 스트레이트 플러시');
  assert.strictEqual(name('5s 4s 3s 2s As Kd Kc'), '스트레이트 플러시');
  assert.strictEqual(name('9h 9d 9s 9c 2d 3c 4h'), '포카드');
  assert.strictEqual(name('7h 7d 7s 5c 5d 9c 9h'), '풀하우스');
  assert.strictEqual(name('2h 7h 9h Jh Kh Ad Ac'), '플러시');
  assert.strictEqual(name('5d 4c 3h 2s Ah Kd Qc'), '스트레이트');
  assert.strictEqual(name('Qh Qd Qs 5c 2d 9c 8h'), '트리플');
  assert.strictEqual(name('Qh Qd 5s 5c 2d 2c 8h'), '투페어');
  assert.strictEqual(name('Qh Qd 5s 6c 2d 9c 8h'), '원페어');
  assert.strictEqual(name('Ah Qd 5s 6c 2d 9c 8h'), '하이카드');
});
t('full house picks best pair over 2nd trips', () => {
  assert(ev('7h 7d 7s 5c 5d 9c 9h').score > ev('7h 7d 7s 5c 5d 5s 2h').score);
  assert.deepStrictEqual(ev('7h 7d 7s 5c 5d 9c 9h').ks, [7, 9]);
  assert.deepStrictEqual(ev('7h 7d 7s 9c 9d 9s 2h').ks, [9, 7]);
});
t('kickers', () => {
  assert(ev('Ah Ad Ks 7c 4d').score > ev('Ah Ad Qs Jc Td').score);
  assert(ev('Kh Kd 5s 5c Ad').score > ev('Kh Kd 5s 5c Qd').score);
  assert.strictEqual(ev('Kh Kd 5s 5c Ad 2h 3h').score, ev('Ks Kc 5h 5d As 7h 8h').score);
  assert(ev('6d 5c 4h 3s 2h').score > ev('5d 4c 3h 2s Ah').score); // 6하이 > 휠
  assert(ev('2h 3h 4h 5h 7h').score < ev('2d 3d 4d 6d 8d').score);
});
t('bestFive', () => {
  const b = H.bestFive('As Ks Qs Js Ts 2d 3c'.split(' '));
  assert.deepStrictEqual(b.sort(), ['As', 'Js', 'Ks', 'Qs', 'Ts'].sort());
});

// 게임 진행
function mkGame(stacks, opts) {
  const g = new H.Game(Object.assign({ sb: 50, bb: 100, seed: 'test' }, opts));
  stacks.forEach((s, i) => g.addPlayer({ id: 'p' + i, name: 'P' + i, stack: s }));
  return g;
}
const sum = (g) => g.players.reduce((s, p) => s + p.stack, 0) + g.potTotal() * (g.stage === 'done' ? 0 : 1);

t('blinds and order (3 players)', () => {
  const g = mkGame([1000, 1000, 1000]);
  g.startHand();
  assert.strictEqual(g.dealer, 0); assert.strictEqual(g.sbIdx, 1); assert.strictEqual(g.bbIdx, 2);
  assert.strictEqual(g.toAct, 0);
  assert(g.act('p0', 'call')); assert(g.act('p1', 'call'));
  assert.strictEqual(g.toAct, 2); // BB 옵션
  assert(g.act('p2', 'check'));
  assert.strictEqual(g.stage, 'flop'); assert.strictEqual(g.board.length, 3);
  assert.strictEqual(g.toAct, 1); // SB부터
});
t('heads-up order', () => {
  const g = mkGame([1000, 1000]);
  g.startHand();
  assert.strictEqual(g.sbIdx, g.dealer);
  assert.strictEqual(g.toAct, g.dealer);
  g.act(g.players[g.toAct].id, 'call');
  g.act(g.players[g.toAct].id, 'check');
  assert.strictEqual(g.stage, 'flop');
  assert.strictEqual(g.toAct, g.bbIdx);
});
t('min raise and reopen', () => {
  const g = mkGame([5000, 5000, 5000]);
  g.startHand();
  const L = g.legal();
  assert.strictEqual(L.minTo, 200);
  g.act('p0', 'raise', 350); // +250
  assert.strictEqual(g.legal().minTo, 600);
  g.act('p1', 'fold');
  g.act('p2', 'call');
  assert.strictEqual(g.stage, 'flop');
});
t('uncontested', () => {
  const g = mkGame([1000, 1000, 1000]);
  g.startHand();
  g.act('p0', 'fold'); g.act('p1', 'fold');
  assert.strictEqual(g.stage, 'done');
  assert.strictEqual(g.players[2].stack, 1050);
});
t('side pots conserve chips', () => {
  for (let k = 0; k < 300; k++) {
    const g = mkGame([300, 1000, 2500, 700], { seed: 'sp' + k });
    g.startHand();
    // 모두 올인
    let guard = 0;
    while (g.stage !== 'done' && guard++ < 50) {
      if (g.runout) { g.runoutStep(); continue; }
      g.act(g.players[g.toAct].id, 'allin');
    }
    assert.strictEqual(g.stage, 'done');
    const tot = g.players.reduce((s, p) => s + p.stack, 0);
    assert.strictEqual(tot, 4500);
    // 짧은 스택은 자기 기여분*인원 이상 못 땀
    assert(g.players[0].stack <= 300 * 4);
  }
});
t('uncalled bet returned', () => {
  const g = mkGame([300, 5000]);
  g.startHand(); // p0 딜러=SB
  g.act('p0', 'allin');
  g.act('p1', 'call');
  while (g.stage !== 'done') g.runoutStep();
  const tot = g.players.reduce((s, p) => s + p.stack, 0);
  assert.strictEqual(tot, 5300);
  assert(g.players[1].stack >= 4700);
});


// 심판 점검(2026-10-12)에서 나온 규칙
t('incomplete all-in raise does not reopen raising', () => {
  const g = mkGame([5000, 5000, 1200]);
  g.startHand();                       // D0 SB1 BB2, p0 먼저
  g.act('p0', 'call'); g.act('p1', 'call'); g.act('p2', 'check');
  assert.strictEqual(g.stage, 'flop');
  g.act('p1', 'raise', 1000);          // 벳 1000
  g.act('p2', 'allin');                // 1100 올인(+100, 부족)
  g.act('p0', 'call');
  const L = g.legal();
  assert.strictEqual(g.players[g.toAct].id, 'p1');
  assert.strictEqual(L.toCall, 100);
  assert.strictEqual(L.canRaise, false);
  assert.strictEqual(g.act('p1', 'raise', 3000), true); // 레이즈 요청은 콜로 처리
  assert.strictEqual(g.players[1].total, 1200); // 프리플롭 100 + 플롭 1100(콜)
});
t('full raise reopens', () => {
  const g = mkGame([5000, 5000, 5000]);
  g.startHand();
  g.act('p0', 'raise', 300); g.act('p1', 'raise', 900); g.act('p2', 'fold');
  assert.strictEqual(g.legal().canRaise, true);
});
t('unknown action rejected', () => {
  const g = mkGame([1000, 1000, 1000]);
  g.startHand();
  assert.strictEqual(g.act('p0', 'bet', 999), false);
  assert.strictEqual(g.toAct, 0);
});
t('no back-to-back BB when going heads-up', () => {
  const g = mkGame([1000, 1000, 1000]);
  g.startHand();                       // D0 SB1 BB2
  assert.strictEqual(g.bbIdx, 2);
  g.act('p0', 'fold'); g.act('p1', 'fold');
  g.players[0].stack = 0;              // 버튼 탈락
  g.startHand();
  assert.notStrictEqual(g.players[g.bbIdx].id, 'p2');
  assert.strictEqual(g.sbIdx, g.dealer);
});
t('short BB all-in heads-up: SB already covers', () => {
  const g = mkGame([1000, 30]);
  g.startHand();                       // p0 딜러=SB 50, p1 BB 올인 30
  assert.strictEqual(g.stage === 'done' || g.runout, true);
  while (g.stage !== 'done') g.runoutStep();
  assert.strictEqual(g.players[0].stack + g.players[1].stack, 1030);
});

// 수수료(레이크)
t('rake: no flop no drop', () => {
  const g = mkGame([1000, 1000, 1000], { rake: { pct: 5, cap: 3000, nfnd: true } });
  g.startHand(); g.act('p0', 'raise', 300); g.act('p1', 'fold'); g.act('p2', 'fold');
  assert.strictEqual(g.result.rake, 0);
  assert.strictEqual(g.players[0].stack, 1150);
});
t('rake: percent and cap on showdown, chips conserved', () => {
  const g = mkGame([10000, 10000], { rake: { pct: 5, cap: 300, nfnd: true } });
  g.startHand();
  g.act(g.players[g.toAct].id, 'allin'); g.act(g.players[g.toAct].id, 'call');
  while (g.stage !== 'done') g.runoutStep();
  assert.strictEqual(g.result.rake, 300);                 // 20000의 5% = 1000 → 상한 300
  assert.strictEqual(g.players[0].stack + g.players[1].stack + g.rakeTotal, 20000);
  const g2 = mkGame([1000, 1000], { rake: { pct: 5, cap: 3000 } });
  g2.startHand(); g2.act(g2.players[g2.toAct].id, 'call'); g2.act(g2.players[g2.toAct].id, 'check');
  g2.act(g2.players[g2.toAct].id, 'raise', 200); g2.act(g2.players[g2.toAct].id, 'fold');
  assert.strictEqual(g2.result.rake, 10);                 // 플랍 후 팟 200(베팅 200은 돌려받음) × 5%
  assert.strictEqual(g2.players[0].stack + g2.players[1].stack + g2.rakeTotal, 2000);
});
t('rake: split pot shares after rake', () => {
  for (let k = 0; k < 400; k++) {
    const g = mkGame([300, 1000, 2500, 700], { seed: 'rk' + k, rake: { pct: 5, cap: 200 } });
    g.startHand();
    let guard = 0;
    while (g.stage !== 'done' && guard++ < 50) { if (g.runout) { g.runoutStep(); continue; } g.act(g.players[g.toAct].id, 'allin'); }
    assert.strictEqual(g.players.reduce((s, p) => s + p.stack, 0) + g.rakeTotal, 4500);
    assert(g.result.rake <= 200);
  }
});

// 봇끼리 대량 시뮬레이션: 칩 보존 + 무한루프 없음
t('bot simulation', () => {
  const styles = Object.keys(H.BOT_STYLES);
  let hands = 0;
  for (let gi = 0; gi < 30; gi++) {
    const g = new H.Game({ sb: 50, bb: 100, seed: 'sim' + gi, rake: gi % 2 ? { pct: 5, cap: 3000 } : null });
    for (let i = 0; i < 6; i++) g.addPlayer({ id: 'b' + i, name: 'B' + i, stack: 10000, isBot: true, style: styles[i % styles.length] });
    const rand = H.mulberry32(gi + 1);
    for (let h = 0; h < 60; h++) {
      if (!g.startHand()) break;
      hands++;
      let guard = 0;
      while (g.stage !== 'done') {
        if (++guard > 500) throw new Error('loop');
        if (g.runout) { g.runoutStep(); continue; }
        const d = H.botDecide(g, rand);
        const ok = g.act(g.players[g.toAct].id, d.type, d.amount);
        assert(ok, 'action rejected ' + JSON.stringify(d));
      }
      const tot = g.players.reduce((s, p) => s + p.stack, 0) + g.rakeTotal;
      assert.strictEqual(tot, 60000);
      assert(g.players.every((p) => p.stack >= 0));
    }
  }
  console.log('  simulated hands:', hands);
});

// ---------- 새로 앉은 사람 규칙 ----------
// 9자리: 0~3번 사람, 나머지 빈자리. 핸드를 모두 폴드로 끝내는 도우미
function seatGame(stacks) {
  const g = new H.Game({ seed: 'seat', sb: 50, bb: 100 });
  for (let i = 0; i < 9; i++) g.addPlayer(stacks[i] ? { id: 'p' + i, name: 'P' + i, stack: stacks[i] } : { id: 'e' + i, empty: true });
  return g;
}
function foldOut(g) { let k = 0; while (g.stage !== 'done') { const L = g.legal(); g.act(g.players[g.toAct].id, L.canCheck ? 'check' : 'fold'); if (++k > 50) throw new Error('loop'); } }
t('empty seats never dealt, button skips them', () => {
  const g = seatGame([1e4, 0, 1e4, 0, 1e4]);
  g.startHand();
  assert.deepStrictEqual(g.players.filter((p) => p.inHand).map((p) => p.id), ['p0', 'p2', 'p4']);
  assert(!g.players[g.dealer].empty && !g.players[g.sbIdx].empty && !g.players[g.bbIdx].empty);
});
t('waitBB: skipped for button/SB, dealt in exactly when BB reaches them', () => {
  const g = seatGame([1e4, 1e4, 1e4, 1e4]);
  g.startHand(); foldOut(g);                      // 버튼 p0, SB p1, BB p2
  assert.strictEqual(g.dealer, 0);
  g.seatPlayer(5, { id: 'n5', name: 'N', stack: 1e4, waitBB: true });
  let entered = -1;
  for (let h = 0; h < 8; h++) {
    g.startHand();
    const n5 = g.players[5];
    assert(g.dealer !== 5 && g.sbIdx !== 5, '기다리는 사람이 버튼·SB를 받으면 안 됨');
    if (n5.inHand) { assert.strictEqual(g.bbIdx, 5, 'BB로만 들어와야 함'); entered = h; break; }
    assert.strictEqual(n5.lastAction.type, 'WAIT');
    foldOut(g);
  }
  assert(entered >= 0, '결국 BB로 들어와야 함');
});
t('postBB: seat between button and SB must wait for the button to pass', () => {
  const g = seatGame([1e4, 0, 1e4, 1e4, 1e4]);   // 0,2,3,4 사람
  g.startHand(); foldOut(g);                      // 버튼 0
  // 다음 핸드 버튼 2, SB 3, BB 4 → 2와 3 사이에는 자리가 없음. 0→2 사이 1번은 버튼이 지나간 자리라 바로 참여 가능
  g.seatPlayer(1, { id: 'n1', name: 'N1', stack: 1e4, postBB: true });
  g.startHand();
  assert.strictEqual(g.dealer, 2);
  assert(g.players[1].inHand, '버튼이 이미 지나간 자리는 BB 내고 바로 참여');
  assert.strictEqual(g.players[1].bet, 100);
  foldOut(g);
  // 이제 버튼 3, SB 4 예정 → 3과 4 사이엔 자리 없음. 버튼(2)과 SB(3) 사이 시험: 새 게임
  const h = seatGame([1e4, 1e4, 0, 1e4, 1e4]);   // 0,1,3,4
  h.startHand(); foldOut(h);                      // 버튼 0, SB 1, BB 3
  // 다음: 버튼 1, SB 3 → 2번 자리는 버튼과 SB 사이
  h.seatPlayer(2, { id: 'n2', name: 'N2', stack: 1e4, postBB: true });
  h.startHand();
  assert.strictEqual(h.dealer, 1); assert.strictEqual(h.sbIdx, 3);
  assert(!h.players[2].inHand, '버튼과 SB 사이는 BB를 내도 바로 못 들어옴');
  assert(h.players[2].waitBB, '대신 BB 차례를 기다림');
  assert.strictEqual(h.players[2].stack, 1e4, '칩을 떼지 않음');
});
t('postBB on the natural BB seat just plays the BB (no double post)', () => {
  const g = seatGame([1e4, 1e4, 0, 1e4]);        // 0,1,3
  g.startHand(); foldOut(g);                      // 버튼 0, SB 1, BB 3
  g.seatPlayer(2, { id: 'n2', name: 'N2', stack: 1e4, postBB: true });   // 다음: 버튼 1, SB 3, 그다음 2? → 3 다음은 0. 2는 1과 3 사이 = 버튼·SB 사이
  g.startHand();
  assert(!g.players[2].inHand);
  const k = seatGame([1e4, 1e4, 1e4, 0]);         // 0,1,2
  k.startHand(); foldOut(k);                       // 버튼 0, SB 1, BB 2
  k.seatPlayer(3, { id: 'n3', name: 'N3', stack: 1e4, postBB: true });   // 다음: 버튼 1, SB 2, BB → 3
  k.startHand();
  assert.strictEqual(k.bbIdx, 3); assert(k.players[3].inHand); assert.strictEqual(k.players[3].bet, 100);
  assert.strictEqual(k.players.reduce((s, p) => s + p.bet, 0), 150, 'SB+BB만 걸림');
});
t('only one regular left: newcomers join without blind obligation', () => {
  const g = seatGame([1e4]);
  g.seatPlayer(4, { id: 'n4', name: 'N4', stack: 1e4, waitBB: true });
  assert(g.startHand(), '새 판처럼 시작');
  assert(g.players[4].inHand && g.players[0].inHand);
});
t('chips conserved with joiners over many hands', () => {
  const rand = H.mulberry32(7);
  const g = seatGame([1e4, 0, 1e4, 0, 1e4, 0, 0, 0, 0]);
  let joined = 0;
  for (let h = 0; h < 300; h++) {
    if (h % 7 === 3) { const free = g.players.map((p, i) => (p.empty ? i : -1)).filter((i) => i >= 0); if (free.length) { g.seatPlayer(free[0], { id: 'j' + h, name: 'J', stack: 1e4, [h % 2 ? 'waitBB' : 'postBB']: true }); joined++; } }
    if (!g.startHand()) break;
    let guard = 0;
    while (g.stage !== 'done') { if (++guard > 500) throw new Error('loop'); if (g.runout) { g.runoutStep(); continue; } const d = H.botDecide(g, rand); assert(g.act(g.players[g.toAct].id, d.type, d.amount)); }
    const tot = g.players.reduce((s, p) => s + p.stack, 0) + g.rakeTotal;
    assert.strictEqual(tot, 1e4 * (3 + joined));
  }
});

t('folded reveal is hidden from others until the hand ends', () => {
  const g = seatGame([1e4, 1e4, 1e4]);
  g.startHand();
  const f = g.players[g.toAct];
  assert(g.act(f.id, 'fold'));
  assert(g.reveal(f.id, 3), '폴드 뒤 공개 요청은 받음');
  const other = g.players.find((p) => p !== f && p.inHand && !p.folded);
  let guard = 0;
  while (g.stage !== 'done') {
    const v = g.view(other.id).players.find((p) => p.id === f.id);
    assert.deepStrictEqual(v.hole, [], '진행 중엔 폴드한 사람 카드가 남에게 안 보임');
    assert.strictEqual(v.showMask, 0, '진행 중엔 공개 표시도 안 감');
    assert.strictEqual(g.view(f.id).players.find((p) => p.id === f.id).showMask, 3, '본인은 예약 상태를 앎');
    if (++guard > 200) throw new Error('loop');
    if (g.runout) { g.runoutStep(); continue; }
    const L = g.legal(); assert(g.act(g.players[g.toAct].id, L.canCheck ? 'check' : 'call'));
  }
  const v = g.view(other.id).players.find((p) => p.id === f.id);
  assert.deepStrictEqual(v.hole, f.hole, '핸드가 끝나면 공개');
});

t('reveal does not bump actionSeq (timebank/tournament seed unaffected) and repeats are no-ops', () => {
  const g = seatGame([1e4, 1e4, 1e4]);
  g.startHand();
  const f = g.players[g.toAct];
  assert(g.act(f.id, 'fold'));
  const seq = g.actionSeq;
  assert(g.reveal(f.id, 1));
  assert.strictEqual(g.actionSeq, seq, '공개는 행동 번호를 바꾸지 않음');
  assert.strictEqual(g.reveal(f.id, 1), false, '이미 공개한 장은 다시 공개해도 바뀐 게 없음');
  assert(g.reveal(f.id, 3), '남은 장은 공개됨');
  assert.strictEqual(g.reveal(f.id, 3), false);
});

console.log('OK', n, 'tests');
