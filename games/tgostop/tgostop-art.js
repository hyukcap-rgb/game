/* 트럼프 고스톱 카드 그림 (games/tgostop) — v0.2 디자인팀
   - 52장(176×287 — 고스톱 판의 카드 자리·크기를 그대로 쓰려고 화투와 같은 비율).
   - 숫자 A~Q = 1~12월, 무늬 = 패 종류(♠ 광·열끗, ♥ 띠, ♦♣ 피). K 4장 = 보너스패.
   - 모서리 숫자를 크게(먹은 패 64px에서도 읽히게), 오른쪽 위 문양 메달 = 광(금빛 해) · 열끗(사슴) · 고도리(새) · 쌍피(Figma 보라 메달)·쓰리피(SVG 빨강 메달),
     아래 띠 = 종류 글자(광·홍단·청단·초단·띠·열끗·고도리·국진·쌍피). 피는 띠·메달 없음.
   - J·Q·K 인물·광/열끗/고도리/쌍피 메달 그림은 Figma AI로 그린 원본(tgostop-img.js의 TG_IMG, 한 번만 Blob URL로 바꿔 씀). 쓰리피 메달은 SVG.
   - 뒷면·폭탄 빈 패는 고스톱(games/gostop)과 같은 모양. */
const TGART = (() => {
  const W = 176, H = 287;
  const RED = '#C8102E', BLK = '#14182A', PAPER = '#FCFAF4', EDGE = '#CDBF9F';
  const FONT = "'Noto Sans KR','Malgun Gothic',system-ui,sans-serif";
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
  const col = s => (s === 1 || s === 2) ? RED : BLK;
  const pip = (s, cx, cy, size, flip, fill) => `<path d="${SUIT[s]}" fill="${fill || col(s)}" transform="translate(${cx} ${cy})${flip ? ' rotate(180)' : ''} scale(${size / 100}) translate(-50 -50)"/>`;
  const T = (x, y, sz, c, t, w = 900, f = FONT, extra = '') => `<text x="${x}" y="${y}" font-size="${sz}" font-weight="${w}" text-anchor="middle" fill="${c}" font-family="${f}"${extra}>${t}</text>`;

  /* 숫자 카드 무늬 자리(가로 L·C·R, 세로 0~1) — 모서리 숫자·메달과 겹치지 않게 안쪽으로 */
  const L = 68, Cx = 98, R = 128, Y0 = 96, Y1 = 208;
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

  /* 오른쪽 위 메달 */
  function medal(c, cx = 145, cy = 37, r = 25){
    const ring = `<circle cx="${cx}" cy="${cy + 2}" r="${r + 1}" fill="rgba(40,20,0,.28)"/>`;
    const pic = k => ring + `<image href="${img(k)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"/>`;
    const disc = (fill, inner) => ring + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#E2A92A"/><circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="#FFD866"/><circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="${fill}"/>`
      + inner + `<ellipse cx="${cx - r * .3}" cy="${cy - r * .45}" rx="${r * .45}" ry="${r * .2}" fill="rgba(255,255,255,.28)"/>`;
    if(c.g) return pic('gwang');
    if(c.y) return pic(c.bird ? 'bird' : 'deer');
    if(c.pv === 2) return pic('ssangpi');   /* 쌍피·보너스 쌍피 = Figma 메달, 쓰리피는 아래 SVG */
    if(c.pv >= 3){      const leaf = (rot) => `<path d="M0 0C-7-6-7-16 0-22C7-16 7-6 0 0Z" fill="#7BE07B" stroke="#2C7A2C" stroke-width="1.4" transform="translate(${cx} ${cy + 9}) rotate(${rot})"/>`;
      return disc(c.bonus && c.pv === 3 ? '#B0122E' : '#5B2A9E', (c.pv === 3 ? leaf(-34) + leaf(0) + leaf(34) : leaf(-22) + leaf(22))
        + `<circle cx="${cx}" cy="${cy + 9}" r="3" fill="#FFD866"/>`);
    }
    return '';
  }
  /* 아래 종류 띠 */
  function strip(c){
    let fill = null, txt = '', ink = '#fff', ribbon = false;
    if(c.bonus){ fill = '#B0122E'; txt = c.pv === 3 ? '보너스 쓰리피' : '보너스 쌍피'; }
    else if(c.g){ fill = '#D99410'; ink = '#2E1A00'; txt = c.rg ? '비광' : '광'; }
    else if(c.tt){ ribbon = true; fill = { hong:'#D7263D', cheong:'#2459C4', cho:'#2B8A47', rain:'#737C86' }[c.tt]; txt = { hong:'홍단', cheong:'청단', cho:'초단', rain:'띠' }[c.tt]; }
    else if(c.y){ fill = c.bird ? '#8E1426' : '#1D2340'; txt = c.kj ? '국진' : c.bird ? '고도리' : '열끗'; }
    else if(c.pv === 2){ fill = '#5B2A9E'; txt = '쌍피'; }
    if(!fill) return '';
    const shape = ribbon
      ? `<path d="M6 228H170L160 248L170 268H6L16 248Z" fill="${fill}"/><path d="M6 228H170L166 236H10Z" fill="rgba(255,255,255,.22)"/><path d="M16 248L6 268H20Z M160 248L170 268H156Z" fill="rgba(0,0,0,.25)"/>`
      : `<rect x="10" y="229" width="156" height="38" rx="10" fill="${fill}"/><rect x="10" y="229" width="156" height="12" rx="6" fill="rgba(255,255,255,.18)"/>`
        + (c.g ? `<rect x="10" y="229" width="156" height="38" rx="10" fill="none" stroke="#FFE7A0" stroke-width="2"/>` : '');
    return shape + T(88, 257, txt.length > 4 ? 21 : txt.length > 2 ? 24 : 27, ink, txt, 900);
  }
  /* 모서리 숫자: 크고 굵게 + 흰 테두리(먹은 패·바닥 패에서도 잘 보이게) */
  const corner = (rk, s) => T(30, 60, rk === '10' ? 44 : 54, col(s), rk, 900, NUMF, ` stroke="${PAPER}" stroke-width="5" paint-order="stroke" letter-spacing="${rk === '10' ? -4 : 0}"`) + pip(s, 29, 86, 26);

  function face(c){
    const s = c.su ?? 0, m = c.bonus ? 13 : c.m, rk = c.bonus ? 'K' : RK[m];
    let body = '';
    const glow = c.g
      ? `<rect x="3.5" y="3.5" width="169" height="280" rx="12" fill="none" stroke="#E2A92A" stroke-width="6"/><rect x="9.5" y="9.5" width="157" height="268" rx="8" fill="none" stroke="#FFE08A" stroke-width="1.6"/>`
      : '';
    const sun = c.g ? (() => { let r = ''; for(let i = 0; i < 24; i++) r += `<path transform="rotate(${i * 15} 88 150)" d="M88 150L84 70h8z" fill="#F7C744" opacity="${i % 2 ? .25 : .42}"/>`; return r; })() : '';
    if(m === 1){
      body = sun + (c.g ? `<circle cx="94" cy="150" r="52" fill="#FFF0BE"/>` : '') + pip(s, 94, 150, c.g ? 84 : 92);
    } else if(m >= 2 && m <= 10){
      body = sun + LAYOUT[m].map(([x, t]) => pip(s, x, yy(t), m >= 9 ? 30 : 34, t > .5)).join('');
    } else {
      /* J · Q · K: Figma 인물 그림 + 무늬색 테두리 */
      const k = m === 11 ? 'jack' : m === 12 ? 'queen' : 'king', ink = col(s), cid = 'tgc' + c.id;
      const fx = 52, fy = 14, fw = 114, fh = 208;
      body = `<clipPath id="${cid}"><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="9"/></clipPath>`
        + `<rect x="${fx - 3}" y="${fy - 3}" width="${fw + 6}" height="${fh + 6}" rx="11" fill="${c.bonus ? '#E2A92A' : ink}"/>`
        + `<g clip-path="url(#${cid})"><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="#FBF8F1"/>`
        + `<image href="${img(k)}" x="${fx - 10}" y="${fy}" width="${fw + 20}" height="${fh}" preserveAspectRatio="xMidYMin slice"/>`
        + (c.bonus ? `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="rgba(255,200,60,.16)"/>` : '') + `</g>`
        + `<rect x="${fx + 2}" y="${fy + 2}" width="${fw - 4}" height="${fh - 4}" rx="8" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>`
        + `<circle cx="${fx + fw - 18}" cy="${fy + fh - 18}" r="15" fill="#fff" stroke="${ink}" stroke-width="2"/>` + pip(s, fx + fw - 18, fy + fh - 18, 18);
    }
    const bg = c.bonus ? '#FFF1C8' : PAPER;
    return `<rect x="1" y="1" width="174" height="285" rx="13" fill="${bg}" stroke="${EDGE}" stroke-width="2"/>` + glow
      + body + corner(rk, s) + medal(c, m >= 11 ? 145 : 145, m >= 11 ? 38 : 37) + strip(c)
      + `<rect x="2.4" y="2.4" width="171.2" height="282.2" rx="11.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>`;
  }

  /* 뒷면 v1.11: 실물 화투처럼 붉은 뒷면(직접 그린 무늬 — 진홍 바탕 · 살짝 어두운 테두리 · 은은한 결 · 윗빛). 그라데이션 id 없이 겹친 면으로만 */
  function back(){
    let s = `<rect x="1" y="1" width="174" height="285" rx="11" fill="#8E0F16"/><rect x="5" y="5" width="166" height="277" rx="9" fill="#C8161F"/>`;
    for(let y = 14; y < 282; y += 9) s += `<path d="M7 ${y}h162" stroke="#B3121B" stroke-width="3" opacity=".55"/>`;
    for(let y = 20; y < 276; y += 26) for(let x = 18 + ((y - 20) / 26 % 2) * 13; x < 162; x += 26) s += `<circle cx="${x}" cy="${y}" r="2.2" fill="#A50F18" opacity=".7"/>`;
    s += `<rect x="5" y="5" width="166" height="96" rx="9" fill="#fff" opacity=".07"/><rect x="5" y="5" width="166" height="40" rx="9" fill="#fff" opacity=".06"/>`;
    s += `<rect x="11" y="11" width="154" height="265" rx="6" fill="none" stroke="#7A0A10" stroke-width="1.6" opacity=".55"/>`;
    return s + `<rect x="1" y="1" width="174" height="285" rx="11" fill="none" stroke="#4A0508" stroke-width="2"/>`;
  }
  const dummy = `<rect x="1" y="1" width="174" height="285" rx="13" fill="#ECE7F0" stroke="${EDGE}" stroke-width="2"/><circle cx="88" cy="128" r="40" fill="#2E2838" stroke="#1A1212" stroke-width="3"/><path d="M114 100l18-20" stroke="#1A1212" stroke-width="5"/><circle cx="136" cy="76" r="9" fill="#FF8A1F"/><circle cx="72" cy="112" r="9" fill="#fff" opacity=".35"/>` + T(88, 222, 28, '#5A4E6A', '넘기기');
  return { VB:`0 0 ${W} ${H}`, W, H, face, back:back(), dummy, url:() => '', img };
})();
