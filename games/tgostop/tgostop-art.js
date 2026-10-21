/* 트럼프 고스톱 카드 그림 (games/tgostop) — v0.12 디자인팀 '고급 카드'
   - 52장(176×287 — 고스톱 판의 카드 자리·크기를 그대로 쓰려고 화투와 같은 비율).
   - 숫자 A~Q = 1~12월, 무늬 = 패 종류(♠ 광·열끗, ♥ 띠, ♦♣ 피). K 4장 = 보너스패.
   - 고급 카드 v0.12: 상아색 종이 + 금색 두 겹 테두리·모서리 장식, 입체 무늬(밝은 결·어두운 테두리), A는 금빛 문양 원 안에,
     광은 금테·햇살, 아래 종류 표시는 금테 명패(광·열끗·고도리·국진·쌍피), 피는 표시 없음.
   - 띠(홍단·청단·초단·비띠)는 화투처럼 **카드 그림 안에 매달린 띠(단책)**로: 홍단 = 붉은 띠 + '홍단' 글씨, 청단 = 푸른 띠 + '청단' 글씨,
     초단 = 글씨 없는 붉은 띠(작은 '초단' 표), 비띠(Q♥) = 검은 줄 붉은 띠. 숫자 카드는 오른쪽에, Q♥는 왼쪽 아래에 매달림.
   - J·Q·K 인물·광/열끗/고도리/쌍피 메달 그림은 Figma AI로 그린 원본(tgostop-img.js의 TG_IMG, 한 번만 Blob URL로 바꿔 씀). 쓰리피 메달은 SVG.
   - 그라데이션·패턴 id를 쓰지 않음(같은 카드가 여러 번 그려져도 안전) — 입체감은 겹친 면으로만. 인물 칸 clipPath id는 카드마다 다름.
   - 뒷면·폭탄 빈 패는 고스톱(games/gostop)과 같은 붉은 바탕 + 금장 테두리. */
const TGART = (() => {
  const W = 176, H = 287;
  const RED = '#C21430', RED_D = '#7E0A1C', BLK = '#161A2B', BLK_D = '#05070F';
  const PAPER = '#FBF7EC', EDGE = '#CDBF9F', GOLD = '#C9A24A', GOLD_L = '#EBD28E', GOLD_D = '#8A6A22';
  const FONT = "'Noto Sans KR','Malgun Gothic',system-ui,sans-serif";
  const BRUSH = "'Black Han Sans','Noto Sans KR','Malgun Gothic',system-ui,sans-serif";
  const NUMF = "'Arial Black','Noto Sans KR','Malgun Gothic',system-ui,sans-serif";
  const RK = ['K', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'];
  /* 그림(Figma 원본) → Blob URL 한 번만 */
  const URL0 = {};
  function img(k){
    if(URL0[k]) return URL0[k];
    try{
      const d = (typeof TG_IMG !== 'undefined' && TG_IMG[k]) || '';
      const bin = atob(d.slice(d.indexOf(',') + 1)), u8 = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      URL0[k] = URL.createObjectURL(new Blob([u8], { type:'image/webp' }));
    }catch(_){ URL0[k] = (typeof TG_IMG !== 'undefined' && TG_IMG[k]) || ''; }
    return URL0[k];
  }
  /* 무늬 모양(100×100 칸) */
  const SUIT = [
    'M50 2C62 20 98 38 98 64C98 80 86 90 72 90C63 90 56 85 53 79C54 89 58 96 66 99H34C42 96 46 89 47 79C44 85 37 90 28 90C14 90 2 80 2 64C2 38 38 20 50 2Z',
    'M50 96C22 72 2 54 2 31C2 14 15 3 29 3C39 3 46 9 50 17C54 9 61 3 71 3C85 3 98 14 98 31C98 54 78 72 50 96Z',
    'M50 1L88 50L50 99L12 50Z',
    'M50 3a22 22 0 0 1 20 31a22 22 0 1 1 -12 36q2 16 10 28h-36q8-12 10-28a22 22 0 1 1 -12-36a22 22 0 0 1 20-31z'
  ];
  const isRed = s => s === 1 || s === 2;
  const col = s => isRed(s) ? RED : BLK;
  /* 입체 무늬: 바탕 + 어두운 테두리 + 위쪽 밝은 결 */
  const pip = (s, cx, cy, size, flip, fill) => {
    const tf = (k, dy) => `translate(${cx} ${(cy + dy).toFixed(1)})${flip ? ' rotate(180)' : ''} scale(${(size * k / 100).toFixed(3)}) translate(-50 -50)`;
    if(fill) return `<path d="${SUIT[s]}" fill="${fill}" transform="${tf(1, 0)}"/>`;
    return `<path d="${SUIT[s]}" fill="${col(s)}" stroke="${isRed(s) ? RED_D : BLK_D}" stroke-width="3.5" stroke-linejoin="round" transform="${tf(1, 0)}"/>`
      + `<path d="${SUIT[s]}" fill="#fff" opacity="${isRed(s) ? .2 : .14}" transform="${tf(.62, (flip ? 1 : -1) * size * .14)}"/>`;
  };
  const T = (x, y, sz, c, t, w = 900, f = FONT, extra = '') => `<text x="${x}" y="${y}" font-size="${sz}" font-weight="${w}" text-anchor="middle" fill="${c}" font-family="${f}"${extra}>${t}</text>`;

  /* 숫자 카드 무늬 자리(가로 L·C·R, 세로 0~1). 띠 카드는 오른쪽에 띠가 매달려서 왼쪽으로 좁힘 */
  const Y0 = 96, Y1 = 208, TY0 = 120, TY1 = 216;   /* 띠 카드는 모서리 숫자와 겹치지 않게 아래로 */
  const yy = (t, tt) => tt ? TY0 + (TY1 - TY0) * t : Y0 + (Y1 - Y0) * t;
  const COLS = { n:[68, 98, 128], t:[46, 72, 98] };
  const LAYOUT = {
    2:[[1, 0], [1, 1]],
    3:[[1, 0], [1, .5], [1, 1]],
    4:[[0, 0], [2, 0], [0, 1], [2, 1]],
    5:[[0, 0], [2, 0], [1, .5], [0, 1], [2, 1]],
    6:[[0, 0], [2, 0], [0, .5], [2, .5], [0, 1], [2, 1]],
    7:[[0, 0], [2, 0], [1, .25], [0, .5], [2, .5], [0, 1], [2, 1]],
    8:[[0, 0], [2, 0], [1, .25], [0, .5], [2, .5], [1, .75], [0, 1], [2, 1]],
    9:[[0, 0], [2, 0], [0, 1 / 3], [2, 1 / 3], [1, .5], [0, 2 / 3], [2, 2 / 3], [0, 1], [2, 1]],
    10:[[0, 0], [2, 0], [1, 1 / 6], [0, 1 / 3], [2, 1 / 3], [0, 2 / 3], [2, 2 / 3], [1, 5 / 6], [0, 1], [2, 1]]
  };

  /* 종이: 상아색 + 은은한 결 + 금색 두 겹 테두리 + 모서리 마름모 장식 */
  function paper(c){
    const bg = c.bonus ? '#FFF3D2' : PAPER;
    let s = `<rect x="1" y="1" width="174" height="285" rx="13" fill="${bg}" stroke="${EDGE}" stroke-width="2"/>`;
    for(let i = -12; i < 22; i++) s += `<path d="M${i * 14} 2l${120} 283" stroke="#B89A5E" stroke-width=".7" opacity=".05"/>`;
    s += `<rect x="7.5" y="7.5" width="161" height="272" rx="9" fill="none" stroke="${GOLD}" stroke-width="1.6" opacity=".85"/>`
      + `<rect x="11" y="11" width="154" height="265" rx="7" fill="none" stroke="${GOLD}" stroke-width=".7" opacity=".55"/>`;
    for(const [x, y] of [[11, 11], [165, 11], [11, 276], [165, 276]]) s += `<path d="M${x} ${y - 5}l5 5-5 5-5-5z" fill="${GOLD}" opacity=".9"/>`;
    return s;
  }
  /* 광: 굵은 금테 + 햇살 */
  function gwangGlow(){
    let r = '';
    for(let i = 0; i < 24; i++) r += `<path transform="rotate(${i * 15} 92 150)" d="M92 150L88 66h8z" fill="#F2C14E" opacity="${i % 2 ? .18 : .34}"/>`;
    return r + `<rect x="3.5" y="3.5" width="169" height="280" rx="12" fill="none" stroke="${GOLD_D}" stroke-width="6.5"/><rect x="4.5" y="4.5" width="167" height="278" rx="11.5" fill="none" stroke="${GOLD_L}" stroke-width="2.4"/>`;
  }

  /* 오른쪽 위 메달(금 테두리 링) */
  function medal(c, cx = 145, cy = 37, r = 25){
    const ring = `<circle cx="${cx}" cy="${cy + 2.5}" r="${r + 2}" fill="rgba(40,20,0,.3)"/><circle cx="${cx}" cy="${cy}" r="${r + 2.5}" fill="${GOLD_D}"/><circle cx="${cx}" cy="${cy}" r="${r + 1.2}" fill="${GOLD_L}"/>`;
    const pic = k => ring + `<image href="${img(k)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"/>`;
    const disc = (fill, inner) => ring + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#E2A92A"/><circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="#FFD866"/><circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="${fill}"/>`
      + inner + `<ellipse cx="${cx - r * .3}" cy="${cy - r * .45}" rx="${r * .45}" ry="${r * .2}" fill="rgba(255,255,255,.28)"/>`;
    if(c.g) return pic('gwang');
    if(c.y) return pic(c.bird ? 'bird' : 'deer');
    if(c.pv === 2) return pic('ssangpi');   /* 쌍피·보너스 쌍피 = Figma 메달, 쓰리피는 아래 SVG */
    if(c.pv >= 3){
      const leaf = (rot) => `<path d="M0 0C-7-6-7-16 0-22C7-16 7-6 0 0Z" fill="#7BE07B" stroke="#2C7A2C" stroke-width="1.4" transform="translate(${cx} ${cy + 9}) rotate(${rot})"/>`;
      return disc(c.bonus && c.pv === 3 ? '#B0122E' : '#5B2A9E', leaf(-34) + leaf(0) + leaf(34) + `<circle cx="${cx}" cy="${cy + 9}" r="3" fill="#FFD866"/>`);
    }
    return '';
  }

  /* 띠(단책) — 화투처럼 카드 그림 안에 매달린 띠. x·y = 띠 왼쪽 위, h = 길이, rot = 기울기 */
  const RIB = {
    hong:{ fill:'#C8102E', dark:'#7E0A1C', txt:['홍', '단'], ink:'#170D0B', halo:'#F7D9A0' },
    cheong:{ fill:'#1F4FB0', dark:'#0F2A66', txt:['청', '단'], ink:'#FFF4D6', halo:'#0B1F4D' },
    cho:{ fill:'#C8102E', dark:'#7E0A1C', txt:null, tag:'초단' },
    rain:{ fill:'#9A1C22', dark:'#5A0E12', txt:null, tag:'띠', bands:true }
  };
  function ribbon(tt, x, y, h, rot, w = 40){
    const R = RIB[tt]; if(!R) return '';
    const b = y + h, m = x + w / 2;
    const body = `M${x} ${y}H${x + w}V${b}L${m} ${b - 16}L${x} ${b}Z`;
    let s = `<g transform="rotate(${rot} ${m} ${y + h / 2})">`;
    s += `<path d="${body}" fill="rgba(20,10,0,.22)" transform="translate(4 5)"/>`;                                   /* 그림자 */
    s += `<path d="M${m - 2.5} ${y - 14}h5v16h-5z" fill="#5A3A14"/><ellipse cx="${m}" cy="${y - 15}" rx="7" ry="4.5" fill="none" stroke="#5A3A14" stroke-width="2.5"/>`;   /* 끈·고리 */
    s += `<path d="${body}" fill="${R.fill}"/>`;
    if(R.bands) s += `<rect x="${x}" y="${y + h * .3}" width="${w}" height="9" fill="#1B1414" opacity=".85"/><rect x="${x}" y="${y + h * .55}" width="${w}" height="9" fill="#1B1414" opacity=".85"/>`;
    s += `<path d="M${x + 3} ${y + 2}h6V${b - 6}l-6 4z" fill="#fff" opacity=".2"/>`;                                     /* 왼쪽 밝은 결 */
    s += `<path d="M${x + w - 7} ${y + 2}h5V${b - 3}l-5-3z" fill="${R.dark}" opacity=".55"/>`;                          /* 오른쪽 그늘 */
    s += `<path d="${body}" fill="none" stroke="${GOLD}" stroke-width="1.6"/><rect x="${x}" y="${y}" width="${w}" height="7" fill="${GOLD_D}"/><rect x="${x}" y="${y}" width="${w}" height="2.5" fill="${GOLD_L}"/>`;   /* 금테·윗단 */
    if(R.txt){
      const sz = w * .78, y1 = y + h * .3, y2 = y1 + sz * 1.12;
      s += R.txt.map((t, i) => T(m, (i ? y2 : y1) + sz * .36, sz, R.ink, t, 400, BRUSH, ` stroke="${R.halo}" stroke-width="2.4" paint-order="stroke"`)).join('');
    } else if(R.tag){
      s += `<rect x="${x + 4}" y="${b - 50}" width="${w - 8}" height="22" rx="5" fill="${PAPER}" opacity=".94"/>` + T(m, b - 33.5, R.tag.length > 1 ? 15 : 16, R.dark, R.tag, 900);
    }
    return s + '</g>';
  }

  /* 아래 금테 명패(광·열끗·고도리·국진·쌍피·보너스). 띠는 그림 속 띠가 대신함, 피는 없음 */
  function plaque(c){
    let fill = null, txt = '', ink = '#fff';
    if(c.bonus){ fill = '#9E1028'; txt = c.pv === 3 ? '보너스 쓰리피' : '보너스 쌍피'; }
    else if(c.g){ fill = '#B98010'; ink = '#2E1A00'; txt = c.rg ? '비광' : '광'; }
    else if(c.y){ fill = c.bird ? '#8E1426' : '#1D2340'; txt = c.kj ? '국진' : c.bird ? '고도리' : '열끗'; }
    else if(c.pv === 2){ fill = '#5B2A9E'; txt = '쌍피'; }
    if(!fill) return '';
    const x = 22, y = 236, w = 132, h = 32;
    return `<rect x="${x}" y="${y + 2.5}" width="${w}" height="${h}" rx="16" fill="rgba(40,20,0,.25)"/>`
      + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${GOLD_L}" stroke-width="2.2"/>`
      + `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="12" fill="none" stroke="${GOLD}" stroke-width=".9" opacity=".8"/>`
      + `<rect x="${x + 6}" y="${y + 3}" width="${w - 12}" height="9" rx="4.5" fill="#fff" opacity=".14"/>`
      + `<path d="M${x - 7} ${y + h / 2}l7-6 7 6-7 6z M${x + w + 7} ${y + h / 2}l-7-6-7 6 7 6z" fill="${GOLD}"/>`
      + T(88, y + 23, txt.length > 4 ? 17 : txt.length > 2 ? 20 : 22, ink, txt, 900);
  }
  /* 모서리 숫자: 크고 굵게 + 흰 테두리(먹은 패·바닥 패에서도 잘 보이게) */
  const corner = (rk, s) => T(31, 62, rk === '10' ? 42 : 52, col(s), rk, 900, NUMF, ` stroke="${PAPER}" stroke-width="5" paint-order="stroke" letter-spacing="${rk === '10' ? -4 : 0}"`) + pip(s, 30, 87, 24);
  /* A: 금빛 문양 원 */
  function aceCrest(cx, cy, r){
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="none" stroke="${GOLD}" stroke-width=".8" opacity=".8"/>`;
    for(let i = 0; i < 24; i++){ const a = i * Math.PI / 12; s += `<circle cx="${(cx + Math.cos(a) * (r - 3)).toFixed(1)}" cy="${(cy + Math.sin(a) * (r - 3)).toFixed(1)}" r="${i % 2 ? 1 : 1.8}" fill="${GOLD}"/>`; }
    return s;
  }

  function face(c){
    const s = c.su ?? 0, m = c.bonus ? 13 : c.m, rk = c.bonus ? 'K' : RK[m], tt = c.tt;
    let body = '';
    if(c.g) body += gwangGlow();
    if(m === 1){
      const cx = tt ? 72 : 92;
      body += (c.g ? `<circle cx="${cx}" cy="150" r="54" fill="#FFF0BE"/>` : '') + aceCrest(cx, 150, tt ? 46 : 56) + pip(s, cx, 150, tt ? 62 : 80);
      if(tt) body += ribbon(tt, 120, 30, 196, -5);
    } else if(m >= 2 && m <= 10){
      const X = tt ? COLS.t : COLS.n, sz = tt ? (m >= 9 ? 22 : 26) : (m >= 9 ? 30 : 34);
      body += LAYOUT[m].map(([ci, t]) => pip(s, X[ci], yy(t, tt), sz, t > .5)).join('');
      if(tt) body += ribbon(tt, 122, 30, 196, -5);
    } else {
      /* J · Q · K: Figma 인물 그림 + 금색 두 겹 테두리 */
      const k = m === 11 ? 'jack' : m === 12 ? 'queen' : 'king', ink = col(s), cid = 'tgc' + c.id;
      const fx = 52, fy = 14, fw = 114, fh = 208;
      body += `<clipPath id="${cid}"><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="9"/></clipPath>`
        + `<rect x="${fx - 4}" y="${fy - 4}" width="${fw + 8}" height="${fh + 8}" rx="12" fill="${GOLD_D}"/><rect x="${fx - 2}" y="${fy - 2}" width="${fw + 4}" height="${fh + 4}" rx="10.5" fill="${c.bonus ? GOLD_L : ink}"/>`
        + `<g clip-path="url(#${cid})"><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="#FBF8F1"/>`
        + `<image href="${img(k)}" x="${fx - 10}" y="${fy}" width="${fw + 20}" height="${fh}" preserveAspectRatio="xMidYMin slice"/>`
        + (c.bonus ? `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="rgba(255,200,60,.16)"/>` : '')
        + `<rect x="${fx}" y="${fy + fh - 40}" width="${fw}" height="40" fill="#000" opacity=".08"/></g>`
        + `<rect x="${fx + 2.5}" y="${fy + 2.5}" width="${fw - 5}" height="${fh - 5}" rx="8" fill="none" stroke="${GOLD_L}" stroke-width="1.4" opacity=".9"/>`
        + `<circle cx="${fx + fw - 18}" cy="${fy + fh - 18}" r="15" fill="#fff" stroke="${GOLD}" stroke-width="2.4"/>` + pip(s, fx + fw - 18, fy + fh - 18, 17);
      if(tt) body += ribbon(tt, 12, 120, 140, 4, 34);
    }
    return paper(c) + body + corner(rk, s) + medal(c) + plaque(c)
      + `<rect x="2.4" y="2.4" width="171.2" height="282.2" rx="11.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>`;
  }

  /* 뒷면: 실물 화투처럼 붉은 바탕 + 은은한 결 + 금장 두 겹 테두리 + 가운데 금빛 문양(무늬 넷) */
  function back(){
    let s = `<rect x="1" y="1" width="174" height="285" rx="11" fill="#8E0F16"/><rect x="5" y="5" width="166" height="277" rx="9" fill="#C8161F"/>`;
    for(let y = 14; y < 282; y += 9) s += `<path d="M7 ${y}h162" stroke="#B3121B" stroke-width="3" opacity=".55"/>`;
    for(let y = 20; y < 276; y += 26) for(let x = 18 + ((y - 20) / 26 % 2) * 13; x < 162; x += 26) s += `<circle cx="${x}" cy="${y}" r="2.2" fill="#A50F18" opacity=".7"/>`;
    s += `<rect x="5" y="5" width="166" height="96" rx="9" fill="#fff" opacity=".07"/><rect x="5" y="5" width="166" height="40" rx="9" fill="#fff" opacity=".06"/>`;
    s += `<rect x="11" y="11" width="154" height="265" rx="7" fill="none" stroke="${GOLD}" stroke-width="2" opacity=".75"/><rect x="15" y="15" width="146" height="257" rx="5" fill="none" stroke="${GOLD}" stroke-width=".8" opacity=".55"/>`;
    for(const [x, y] of [[15, 15], [161, 15], [15, 272], [161, 272]]) s += `<path d="M${x} ${y - 6}l6 6-6 6-6-6z" fill="${GOLD_L}" opacity=".85"/>`;
    s += `<circle cx="88" cy="143.5" r="36" fill="#9E1119" stroke="${GOLD}" stroke-width="2.5"/><circle cx="88" cy="143.5" r="30" fill="none" stroke="${GOLD_L}" stroke-width=".9" opacity=".8"/>`;
    [[0, 88, 124], [1, 107, 143.5], [2, 88, 163], [3, 69, 143.5]].forEach(([su, x, y]) => { s += pip(su, x, y, 15, false, GOLD_L); });
    s += `<circle cx="88" cy="143.5" r="3.2" fill="${GOLD_L}"/>`;
    return s + `<rect x="1" y="1" width="174" height="285" rx="11" fill="none" stroke="#4A0508" stroke-width="2"/>`;
  }
  const dummy = `<rect x="1" y="1" width="174" height="285" rx="13" fill="#ECE7F0" stroke="${EDGE}" stroke-width="2"/><circle cx="88" cy="128" r="40" fill="#2E2838" stroke="#1A1212" stroke-width="3"/><path d="M114 100l18-20" stroke="#1A1212" stroke-width="5"/><circle cx="136" cy="76" r="9" fill="#FF8A1F"/><circle cx="72" cy="112" r="9" fill="#fff" opacity=".35"/>` + T(88, 222, 28, '#5A4E6A', '넘기기');
  return { VB:`0 0 ${W} ${H}`, W, H, face, back:back(), dummy, url:() => '', img };
})();
