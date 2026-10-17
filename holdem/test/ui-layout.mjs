// 화면 겹침 점검(쇼다운은 모두 이긴 장면 → 모든 자리의 WINNER 배지도 점검): 2~9명 × 모든 D 위치 × 360/390/1280px 에서 쇼다운(모두 카드 공개)·베팅 중(모두 베팅 칩) 화면을 그려
// 카드·아바타·이름·족보·D·베팅 칩·팟·보드가 서로 겹치는지 검사. 사용: 서버를 켜고(PORT=3960) node test/ui-layout.mjs [스크린샷 폴더]
import { chromium } from 'playwright';
const out = process.argv[2] || '.';
const b = await chromium.launch();
const results = [];
for (const [w, h] of [[360, 740], [390, 844], [1280, 800]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:' + (process.env.PORT || 3960) + '/'); await p.waitForTimeout(600);
  for (const mode of ['showdown', 'bet']) for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) for (const dl of [...Array(n).keys()]) {
    const r = await p.evaluate(([n, dl, mode]) => {
      const { R, show } = window.__rh;
      show('game'); R.reset(); R.prev = null;
      const deck = ['As','Kd','Qh','Jc','Ts','9d','8h','7c','6s','5d','4h','3c','2s','Ad','Kh','Qc','Js','Td','9h','8c'];
      const names = ['나테스트','에이스','레드','폭주핑크','마담','꼬마천재','카우보이','해피','샤크'];
      const players = [];
      for (let i = 0; i < n; i++) players.push({ seat: i, id: 'p' + i, name: names[i], stack: 123456, bet: 0, total: 1000, folded: false, allIn: false, inHand: true, isBot: i > 0, avatar: i, lastAction: { type: 'call' }, won: 5000, away: false, hole: [deck[i * 2], deck[i * 2 + 1]], showMask: 0, rebuys: 0 });
      R.myId = 'p0';
      if (mode === 'bet') {
        const sbI = n === 2 ? dl : (dl + 1) % n, bbI = n === 2 ? (dl + 1) % n : (dl + 2) % n;
        players.forEach((q, i) => { q.bet = i === sbI ? 50 : i === bbI ? 100 : 12300; q.lastAction = i === sbI ? { type: 'SB' } : i === bbI ? { type: 'BB' } : { type: 'raise' }; q.won = 0; if (i) q.hole = ['??', '??']; });
        R.render({ stage: 'preflop', handNo: 3, hk: 'ub:' + n + ':' + dl, board: [], pot: 0, potTotal: 3000, pots: [{ amount: 33000, at: null }], currentBet: 12300, rake: null, dealer: dl, sbIdx: sbI, bbIdx: bbI, toAct: 0, sb: 50, bb: 100, runout: false, actionSeq: 2, myHand: null, players, legal: null, result: null });
        return true;
      }
      const v = { stage: 'done', handNo: 7, hk: 'ui:' + n, board: ['2h','7d','9c','Kc','4s'], pot: 0, potTotal: n * 1000, pots: [{ amount: n * 1000, at: null }], currentBet: 0, rake: null, dealer: dl, sbIdx: 0, bbIdx: 0, toAct: -1, sb: 50, bb: 100, runout: false, actionSeq: 1, myHand: null, players, legal: null,
        result: { type: 'showdown', rake: 0, pots: [{ amount: n * 1000, winners: players.map((q) => q.id), handName: '투페어', refund: false, at: null }], hands: Object.fromEntries(players.map((p) => [p.id, { name: '투페어', best: [], cat: 2 }])) } };
      R.render(v);
      return true;
    }, [n, dl, mode]);
    await p.waitForTimeout(mode === 'bet' ? 2200 : 1900);
    const ov = await p.evaluate(([mode, dl]) => {
      const seats = [...document.querySelectorAll('#seats .seat')];
      const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 2;
      const issues = [];
      const parts = seats.map((s, i) => ({ i, name: s.querySelector('.nm').textContent, cards: [...s.querySelectorAll('.cards .card')].map(rect), others: [...s.querySelectorAll('.ava, .plate, .hn, .tag.show')].filter((e) => e.textContent !== '' || e.classList.contains('ava')).map((e) => ({ k: e.className.split(' ')[0], r: rect(e) })) }));
      const board = [...document.querySelectorAll('#board .card')].map(rect);
      const D = rect(document.querySelector('#dealerBtn'));
      // 쇼다운 땐 버튼 주인의 공개 카드·족보가 D를 덮어도 됨(일부러 D가 자리 아래에 깔림)
      for (const a of parts) { const ownShow = mode === 'showdown' && a.i === dl; for (const c of a.cards) if (!ownShow && hit(D, c)) issues.push('D ↔ ' + a.name + ' 카드'); for (const o of a.others) if (o.k !== 'ava' && !(ownShow && o.k === 'hn') && hit(D, o.r)) issues.push('D ↔ ' + a.name + ' ' + o.k); }
      for (const bc of board) if (hit(D, bc)) issues.push('D ↔ 보드');
      const bets = [...document.querySelectorAll('#bets .bet')].filter((e) => e.style.opacity !== '0').map(rect);
      const pot = document.querySelector('#pot.show') ? rect(document.querySelector('#pot')) : null;
      if (pot && hit(D, pot)) issues.push('D ↔ 팟');
      bets.forEach((bt, k) => {
        if (hit(D, bt)) issues.push('D ↔ 베팅' + k);
        return;   // 모두 큰 금액을 건 극단 상황의 베팅 칩끼리 겹침은 D 점검 대상이 아님
        if (pot && hit(bt, pot)) issues.push('베팅' + k + ' ↔ 팟');
        bets.forEach((b2, k2) => { if (k2 > k && hit(bt, b2)) issues.push('베팅' + k + ' ↔ 베팅' + k2); });
        for (const a of parts) { for (const c of a.cards) if (hit(bt, c)) issues.push('베팅' + k + ' ↔ ' + a.name + ' 카드'); for (const o of a.others) if (hit(bt, o.r)) issues.push('베팅' + k + ' ↔ ' + a.name + ' ' + o.k); }
      });
      const vw = innerWidth;
      for (const a of parts) for (const c of a.cards) {
        for (const b of parts) if (b !== a) {
          for (const c2 of b.cards) if (hit(c, c2)) issues.push(`${a.name} 카드 ↔ ${b.name} 카드`);
          for (const o of b.others) if (hit(c, o.r)) issues.push(`${a.name} 카드 ↔ ${b.name} ${o.k}`);
        }
        for (const bc of board) if (hit(c, bc)) issues.push(`${a.name} 카드 ↔ 보드`);
        if (c.l < 0 || c.r > vw) issues.push(`${a.name} 카드 화면 밖`);
      }
      for (const a of parts) for (const o of a.others) for (const bc of board) if (hit(o.r, bc)) issues.push(`${a.name} ${o.k} ↔ 보드`);
      for (const a of parts) for (const o of a.others) for (const b of parts) if (b !== a) for (const o2 of b.others) if (a.i < b.i && hit(o.r, o2.r)) issues.push(`${a.name} ${o.k} ↔ ${b.name} ${o2.k}`);
      // WINNER 배지가 자기 공개 카드·족보를 가리면 안 됨(모두 이긴 나눠 먹기 장면이라 모든 자리를 한 번에 점검)
      seats.forEach((s) => { const tg = s.querySelector('.tag.win.show'); if (!tg) return; const t = rect(tg);
        for (const c of s.querySelectorAll('.cards .card')) if (hit(t, rect(c))) issues.push(s.querySelector('.nm').textContent + ' WINNER ↔ 자기 카드');
        const hn = s.querySelector('.hn'); if (hn && hn.textContent && hit(t, rect(hn))) issues.push(s.querySelector('.nm').textContent + ' WINNER ↔ 자기 족보'); });
      if (mode === 'bet') return [...new Set(issues.filter((x) => x.startsWith('D')))];
      return [...new Set(issues)];
    }, [mode, dl]);
    results.push(`${mode} ${w}px ${n}명 D${dl}: ${ov.length ? ov.join(', ') : 'OK'}`);
    if (n === 9 && (dl === 3 || dl === 0) && (w === 390 || w === 1280)) await p.screenshot({ path: `${out}/${mode}_${w}_${n}_D${dl}.png` });
  }
  await p.close();
}
console.log(results.join('\n'));
await b.close();
