/* 트럼프 고스톱 카드 그림 (games/tgostop)
   - 52장 모두 직접 그린 SVG(176×287 — 고스톱 판의 카드 자리·크기를 그대로 쓰려고 화투와 같은 비율).
   - 숫자 A~Q = 1~12월, 무늬 = 패 종류(♠ 광·열끗, ♥ 띠, ♦♣ 피). K 4장 = 보너스패.
   - 아래 띠 한 줄로 패 종류를 바로 알게: 광(금) · 홍단(빨강) · 청단(파랑) · 초단(초록) · 띠(회색) · 열끗/새/국진(검정) · 쌍피(보라). 피는 띠 없음.
   - 뒷면·폭탄 빈 패는 고스톱(games/gostop)과 같은 모양. */
const TGART = (() => {
  const W = 176, H = 287;
  const RED = '#C8102E', BLK = '#161A24', PAPER = '#FBF8F1', EDGE = '#CFC5AE';
  const FONT = "'Noto Sans KR','Malgun Gothic',system-ui,sans-serif", SERIF = "Georgia,'Times New Roman',serif";
  const RK = ['K', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'];
  /* 무늬 모양(100×100 칸) */
  const SUIT = [
    'M50 2C62 20 98 38 98 64C98 80 86 90 72 90C63 90 56 85 53 79C54 89 58 96 66 99H34C42 96 46 89 47 79C44 85 37 90 28 90C14 90 2 80 2 64C2 38 38 20 50 2Z',
    'M50 96C22 72 2 54 2 31C2 14 15 3 29 3C39 3 46 9 50 17C54 9 61 3 71 3C85 3 98 14 98 31C98 54 78 72 50 96Z',
    'M50 1L88 50L50 99L12 50Z',
    'M50 3a22 22 0 0 1 20 31a22 22 0 1 1 -12 36q2 16 10 28h-36q8-12 10-28a22 22 0 1 1 -12-36a22 22 0 0 1 20-31z'
  ];
  const col = s => (s === 1 || s === 2) ? RED : BLK;
  const pip = (s, cx, cy, size, flip) => `<path d="${SUIT[s]}" fill="${col(s)}" transform="translate(${cx} ${cy})${flip ? ' rotate(180)' : ''} scale(${size / 100}) translate(-50 -50)"/>`;
  const T = (x, y, sz, c, t, w = 900, f = FONT, extra = '') => `<text x="${x}" y="${y}" font-size="${sz}" font-weight="${w}" text-anchor="middle" fill="${c}" font-family="${f}"${extra}>${t}</text>`;

  /* 숫자 카드 무늬 자리(가로 L·C·R, 세로 0~1) */
  const L = 58, Cx = 88, R = 118, Y0 = 76, Y1 = 206;
  const yy = t => Y0 + (Y1 - Y0) * t;
  const LAYOUT = {
    2:[[Cx, 0], [Cx, 1]],
    3:[[Cx, 0], [Cx, .5], [Cx, 1]],
    4:[[L, 0], [R, 0], [L, 1], [R, 1]],
    5:[[L, 0], [R, 0], [Cx, .5], [L, 1], [R, 1]],
    6:[[L, 0], [R, 0], [L, .5], [R, .5], [L, 1], [R, 1]],
    7:[[L, 0], [R, 0], [Cx, .25], [L, .5], [R, .5], [L, 1], [R, 1]],
    8:[[L, 0], [R, 0], [Cx, .25], [L, .5], [R, .5], [Cx, .75], [L, 1], [R, 1]],
    9:[[L, 0], [R, 0], [L, 1 / 3], [R, 1 / 3], [Cx, .5], [L, 2 / 3], [R, 2 / 3], [L, 1], [R, 1]],
    10:[[L, 0], [R, 0], [Cx, 1 / 6], [L, 1 / 3], [R, 1 / 3], [L, 2 / 3], [R, 2 / 3], [Cx, 5 / 6], [L, 1], [R, 1]]
  };

  /* 아래 종류 띠 */
  function strip(c){
    let fill = null, txt = '', ink = '#fff', ribbon = false;
    if(c.bonus){ fill = RED; txt = c.pv === 3 ? '보너스 쓰리피' : '보너스 쌍피'; }
    else if(c.g){ fill = '#E9A923'; ink = '#3A2400'; txt = c.rg ? '비광' : '광'; }
    else if(c.tt){ ribbon = true; fill = { hong:'#D7263D', cheong:'#2459C4', cho:'#2B8A47', rain:'#737C86' }[c.tt]; txt = { hong:'홍단', cheong:'청단', cho:'초단', rain:'띠' }[c.tt]; }
    else if(c.y){ fill = '#262A35'; txt = c.kj ? '국진' : c.bird ? '새 · 열끗' : '열끗'; }
    else if(c.pv === 2){ fill = '#7A3DB8'; txt = '쌍피'; }
    if(!fill) return '';
    const shape = ribbon
      ? `<path d="M10 230H166L156 249L166 268H10L20 249Z" fill="${fill}"/><path d="M10 230H166" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`
      : `<rect x="12" y="231" width="152" height="36" rx="9" fill="${fill}"/>`;
    return shape + T(88, 258, txt.length > 4 ? 22 : 26, ink, txt, 900);
  }
  /* 모서리 숫자 */
  const corner = (rk, s) => T(29, 48, rk === '10' ? 30 : 38, col(s), rk, 800, SERIF, rk === '10' ? ' letter-spacing="-2"' : '') + pip(s, 29, 70, 24);

  function face(c){
    const s = c.su ?? 0, m = c.bonus ? 0 : c.m, rk = RK[m], ink = col(s);
    let body = '';
    const bg = c.bonus ? '#FFE6A3' : PAPER;
    const glow = c.g ? `<rect x="4" y="4" width="168" height="279" rx="11" fill="none" stroke="#E9A923" stroke-width="5"/><rect x="10" y="10" width="156" height="267" rx="7" fill="none" stroke="#F6D57A" stroke-width="1.5"/>` : '';
    if(m === 1){
      body = pip(s, 88, 140, c.g ? 92 : 84);
      if(c.g) body = `<circle cx="88" cy="140" r="60" fill="#FFF1C4"/>` + body;
    } else if(m >= 2 && m <= 10){
      body = LAYOUT[m].map(([x, t]) => pip(s, x, yy(t), m >= 9 ? 30 : 34, t > .5)).join('');
    } else {
      /* J · Q · K: 테두리 칸 + 큰 글자 + 무늬 */
      const tint = ink === RED ? '#FBE3E6' : '#E4E8F0';
      body = `<rect x="44" y="60" width="88" height="160" rx="8" fill="${c.bonus ? '#FFF6D8' : tint}" stroke="${ink}" stroke-width="2.5"/>`
        + `<rect x="50" y="66" width="76" height="148" rx="5" fill="none" stroke="${ink}" stroke-width="1" opacity=".45"/>`
        + (c.bonus ? `<path d="M64 92l8-16 8 12 8-16 8 16 8-12 8 16z" fill="#E9A923" stroke="#8A5A00" stroke-width="1.5"/>` : '')
        + T(88, c.bonus ? 168 : 158, 74, ink, rk, 700, SERIF)
        + pip(s, 88, 194, 30);
    }
    return `<rect x="1" y="1" width="174" height="285" rx="13" fill="${bg}" stroke="${EDGE}" stroke-width="2"/>` + glow
      + corner(rk, s) + body + strip(c)
      + `<rect x="2.4" y="2.4" width="171.2" height="282.2" rx="11.5" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>`;
  }

  /* 뒷면: 고스톱과 같은 남보라 + 금색 마름모 무늬 */
  function back(){
    let s = `<rect x="1" y="1" width="174" height="285" rx="11" fill="#2E1A6B"/><rect x="9" y="9" width="158" height="269" rx="8" fill="#3A2384" stroke="#FFD34D" stroke-width="2.5"/>`;
    for(let y = 24; y < 272; y += 22) for(let x = 22 + ((y - 24) / 22 % 2) * 11; x < 160; x += 22) s += `<path d="M${x} ${y - 6}l6 6-6 6-6-6z" fill="#5A3DB0"/>`;
    s += `<circle cx="88" cy="143" r="30" fill="#2E1A6B" stroke="#FFD34D" stroke-width="3"/>` + pip(0, 88, 143, 30).replace(BLK, '#FFD34D');
    return s + `<rect x="1" y="1" width="174" height="285" rx="11" fill="none" stroke="#1A0F45" stroke-width="2"/>`;
  }
  const dummy = `<rect x="1" y="1" width="174" height="285" rx="13" fill="#ECE7F0" stroke="${EDGE}" stroke-width="2"/><circle cx="88" cy="128" r="40" fill="#2E2838" stroke="#1A1212" stroke-width="3"/><path d="M114 100l18-20" stroke="#1A1212" stroke-width="5"/><circle cx="136" cy="76" r="9" fill="#FF8A1F"/><circle cx="72" cy="112" r="9" fill="#fff" opacity=".35"/>` + T(88, 222, 28, '#5A4E6A', '넘기기');
  return { VB:`0 0 ${W} ${H}`, W, H, face, back:back(), dummy, url:() => '' };
})();
