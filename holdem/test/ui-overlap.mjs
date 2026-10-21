// 화면 겹침 정밀 점검(최종 검수용): 핸드 진행 중 장면까지 모든 요소 쌍을 검사.
// 장면: ① bet(모두 베팅 + 행동 말풍선 + 연결 끊김/BB 대기) ② allin(사이드팟이 자리 앞에 쌓임) ③ myturn(내 차례 알약·고리)
//      ④ reveal(핸드 끝, 폴드한 사람들이 패 공개 + 승자 WINNER)  × 2~9명 × 모든 D 위치 × 360/390/430/1280px
// 검사 쌍: 말풍선·베팅 칩·카드·아바타·이름/칩 숫자·족보·공개 표시·연결 끊김·BB 대기·D·팟·사이드팟·보드·내 차례 알약(근사)
// 사용: 서버를 켜고(PORT=3960) node test/ui-overlap.mjs [스크린샷 폴더] [n목록 예: 2,6,9]
import { chromium } from 'playwright';
const out = process.argv[2] || '.';
const NS = (process.argv[3] || '2,3,4,5,6,7,8,9').split(',').map(Number);
const WS = (process.argv[4] || '360,390,430,1280').split(',').map(Number);
const SIZES = { 360: 740, 390: 844, 430: 932, 1280: 800 };
const b = await chromium.launch();
const results = []; let bad = 0;
for (const w of WS) { const h = SIZES[w] || 844;
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:' + (process.env.PORT || 3960) + '/'); await p.waitForTimeout(600);
  for (const scene of ['bet', 'allin', 'myturn', 'reveal']) for (const n of NS) for (const dl of [...Array(n).keys()]) {
    await p.evaluate(([n, dl, scene]) => {
      const { R, show, Online } = window.__rh;
      show('game'); R.reset(); R.prev = null; Online.online = true;
      const deck = ['As','Kd','Qh','Jc','Ts','9d','8h','7c','6s','5d','4h','3c','2s','Ad','Kh','Qc','Js','Td','9h','8c'];
      const names = ['나테스트','에이스','레드','폭주핑크','마담','꼬마천재','카우보이','해피','샤크'];
      const sbI = n === 2 ? dl : (dl + 1) % n, bbI = n === 2 ? (dl + 1) % n : (dl + 2) % n;
      const acts = ['raise', 'call', 'allin', 'check', 'bet', 'call', 'raise', 'allin', 'call'];
      const players = [];
      for (let i = 0; i < n; i++) players.push({ seat: i, id: 'p' + i, name: names[i], stack: 1234567, bet: 0, total: 1000, folded: false, allIn: false, inHand: true, isBot: i > 0, avatar: i, lastAction: null, won: 0, away: false, hole: i ? ['??', '??'] : [deck[0], deck[1]], showMask: 0, rebuys: 0 });
      R.myId = 'p0';
      const base = { handNo: 3, hk: scene + ':' + n + ':' + dl, gid: 'g', currentBet: 0, rake: null, dealer: dl, sbIdx: sbI, bbIdx: bbI, sb: 5000, bb: 10000, runout: false, actionSeq: 2, myHand: null, legal: null, result: null };
      if (scene === 'bet' || scene === 'myturn') {
        // 모두 큰 금액을 걸고 행동 말풍선이 떠 있음. 1명은 연결 끊김, 1명은 BB 대기(핸드 밖)
        players.forEach((q, i) => { q.bet = 1230000 + i * 1000; q.lastAction = { type: acts[i] }; if (acts[i] === 'allin') q.allIn = true; });
        if (n >= 4) { players[2].off = true; }
        if (n >= 5) { const q = players[n - 1]; q.inHand = false; q.bet = 0; q.lastAction = null; q.waitBB = true; q.hole = []; }
        const v = { ...base, stage: 'flop', board: ['2h', '7d', '9c'], pot: 3000000, potTotal: 3000000, pots: [{ amount: 3000000, at: null }], currentBet: 1238000, toAct: scene === 'myturn' ? 0 : 1, players,
          legal: scene === 'myturn' ? { toCall: 8000, canCheck: false, canRaise: true, minTo: 2000000, maxTo: 1234567, currentBet: 1238000, pot: 3000000, bb: 10000 } : null };
        R.render(v, { deadline: Date.now() + 15000 });
      } else if (scene === 'allin') {
        // 베팅 라운드가 끝나 올인한 사람 몫이 자리 앞에 사이드팟으로 쌓임(최대 3개) + 남은 사람 말풍선
        const allins = dl % 2 ? [...Array(n).keys()].filter((i) => i % 3 === 1).slice(0, 3) : [...Array(n).keys()].filter((i) => i % 2 === 0 && i > 0).slice(0, 4);   // 홀수 D: 3명 / 짝수 D: 4명(맨 윗줄 둘 다 올인인 경우 포함)
        players.forEach((q, i) => { q.lastAction = { type: allins.includes(i) ? 'allin' : 'raise' }; q.allIn = allins.includes(i); q.bet = allins.includes(i) ? 0 : 1230000; });   // 올인 아닌 사람은 다음 스트리트 베팅 중
        const pots = allins.map((i, k) => ({ amount: 1500000 * (k + 1), at: 'p' + i })).concat([{ amount: 2500000, at: null }]);
        const v = { ...base, stage: 'turn', board: ['2h', '7d', '9c', 'Kc'], pot: 2500000, potTotal: pots.reduce((s, x) => s + x.amount, 0), pots, currentBet: 1230000, toAct: 0, players };
        R.render(v, { deadline: Date.now() + 15000 });
      } else {
        // 핸드 끝: 승자 2명(WINNER), 폴드한 사람은 패 공개, 나머지 쇼다운 공개
        players.forEach((q, i) => { q.hole = [deck[i * 2], deck[i * 2 + 1]]; q.lastAction = { type: 'call' }; if (i % 3 === 2) { q.folded = true; q.showMask = 3; q.lastAction = { type: 'fold' }; } });
        const winners = players.filter((q) => !q.folded).slice(0, 2).map((q) => q.id);
        players.forEach((q) => { if (winners.includes(q.id)) q.won = 1605823; });
        const v = { ...base, stage: 'done', board: ['2h', '7d', '9c', 'Kc', '4s'], pot: 0, potTotal: 3000000, pots: [{ amount: 3000000, at: null }], toAct: -1, players,
          result: { type: 'showdown', rake: 0, pots: [{ amount: 3000000, winners, handName: '투페어', refund: false, at: null }], hands: Object.fromEntries(players.filter((q) => !q.folded).map((q) => [q.id, { name: '투페어', best: [], cat: 2 }])) } };
        R.render(v);
      }
    }, [n, dl, scene]);
    await p.waitForTimeout(2300);
    const ov = await p.evaluate(([scene, dl]) => {
      const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      // 글자만 있는 요소(이름·칩 숫자·금액)는 상자가 아니라 글자가 실제로 차지하는 영역으로
      const trect = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : rect(el); };
      const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 2;
      const vis = (e) => { const cs = getComputedStyle(e); return e.offsetParent !== null && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && cs.display !== 'none'; };
      const items = [];   // { who, k, r }
      const seats = [...document.querySelectorAll('#seats .seat')];
      const tw = document.querySelector('#table').getBoundingClientRect().width / 100;
      seats.forEach((s, i) => {
        if (s.classList.contains('empty')) return;
        const who = s.querySelector('.nm').textContent.replace(' (나)', '');
        for (const c of s.querySelectorAll('.cards .card')) if (vis(c) && vis(c.parentElement)) items.push({ who, k: '카드', r: rect(c) });
        for (const q of ['.ava', '.nm', '.stk', '.hn', '.shown-tag', '.off-tag', '.wait-bb']) { const e = s.querySelector(q); if (e && vis(e) && e.textContent !== '' || (e && q === '.ava')) items.push({ who, k: q.slice(1), r: (q === '.nm' || q === '.stk') ? trect(e) : rect(e) }); }
        const tg = s.querySelector('.tag'); if (tg && tg.classList.contains('show') && vis(tg)) items.push({ who, k: tg.classList.contains('win') ? 'WINNER' : '말풍선', r: rect(tg) });
        if (s.classList.contains('my-go')) { const a = rect(s.querySelector('.ava')); const cx = (a.l + a.r) / 2; items.push({ who, k: '내차례알약', r: { l: cx + 7.5 * tw, t: a.t + 4.5 * tw - 0.2 * tw, r: cx + 7.5 * tw + 13.5 * tw, b: a.t + 4.5 * tw + 5.2 * tw } }); }
      });
      [...document.querySelectorAll('#bets .bet')].forEach((e, k) => { if (vis(e)) { const a = rect(e.querySelector('.stack')), t = trect(e.querySelector('.amt')); items.push({ who: '베팅' + k, k: '베팅칩', r: { l: Math.min(a.l, t.l), t: Math.min(a.t, t.t), r: Math.max(a.r, t.r), b: Math.max(a.b, t.b) } }); } });
      for (const bc of document.querySelectorAll('#board .card')) items.push({ who: '보드', k: '보드', r: rect(bc) });
      const D = document.querySelector('#dealerBtn'); if (D && D.classList.contains('show')) items.push({ who: 'D', k: 'D', r: rect(D) });
      const pot = document.querySelector('#pot'); if (pot && pot.classList.contains('show') && vis(pot)) items.push({ who: '팟', k: '팟', r: rect(pot) });
      [...document.querySelectorAll('#sidePots .side-pot')].forEach((e, k) => { if (vis(e)) items.push({ who: '사이드팟' + k, k: '사이드팟', r: rect(e) }); });
      const issues = [];
      const okPair = (a, b) => {
        if (a.who === b.who && a.k !== '보드') {   // 같은 자리 안: 카드끼리 겹침(부채꼴)은 정상, 아바타↔카드(내 카드 아래)도 정상
          const ks = [a.k, b.k].sort().join('+');
          return ['카드+카드', 'ava+카드', 'ava+말풍선', 'ava+내차례알약', 'nm+stk', 'hn+카드', 'ava+hn', 'ava+shown-tag', 'nm+WINNER', 'stk+WINNER', 'ava+WINNER', 'WINNER+hn', 'ava+off-tag', 'ava+wait-bb', 'nm+off-tag', 'nm+wait-bb', 'stk+off-tag', 'stk+wait-bb', 'shown-tag+카드', 'ava+stk', 'ava+nm'].includes(ks);
        }
        if (a.k === '보드' && b.k === '보드') return true;
        if (a.k === 'D' && b.k === '카드' && scene === 'reveal' && seats[dl] && b.who === seats[dl].querySelector('.nm').textContent.replace(' (나)', '')) return true;   // 쇼다운 땐 주인 카드가 D를 덮도록 되어 있음
        if (a.k === 'D' && b.k === 'hn' && scene === 'reveal' && seats[dl] && b.who === seats[dl].querySelector('.nm').textContent.replace(' (나)', '')) return true;
        return false;
      };
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], c = items[j];
        if (okPair(a, c) || okPair(c, a)) continue;
        if (hit(a.r, c.r)) issues.push(`${a.who} ${a.k} ↔ ${c.who} ${c.k}`);
      }
      const vw = innerWidth;
      for (const it of items) if (it.r.l < -1 || it.r.r > vw + 1) issues.push(`${it.who} ${it.k} 화면 밖`);
      return [...new Set(issues)];
    }, [scene, dl]);
    if (ov.length) bad++;
    results.push(`${scene} ${w}px ${n}명 D${dl}: ${ov.length ? ov.join(', ') : 'OK'}`);
    if (ov.length || (n === 9 && dl === 0)) await p.screenshot({ path: `${out}/${scene}_${w}_${n}_D${dl}.png` });
  }
  await p.close();
}
console.log(results.join('\n'));
console.log(`\n문제 ${bad} / ${results.length}`);
await b.close();
