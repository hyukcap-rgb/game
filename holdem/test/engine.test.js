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

// 봇끼리 대량 시뮬레이션: 칩 보존 + 무한루프 없음
t('bot simulation', () => {
  const styles = Object.keys(H.BOT_STYLES);
  let hands = 0;
  for (let gi = 0; gi < 30; gi++) {
    const g = new H.Game({ sb: 50, bb: 100, seed: 'sim' + gi });
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
      const tot = g.players.reduce((s, p) => s + p.stack, 0);
      assert.strictEqual(tot, 60000);
      assert(g.players.every((p) => p.stack >= 0));
    }
  }
  console.log('  simulated hands:', hands);
});

console.log('OK', n, 'tests');
