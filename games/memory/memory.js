/* 카드 짝 맞추기 */
/* ===== 카드 짝 맞추기 (memory) · 하루퍼즐 리그 새 게임 모듈 =====
   처음 몇 초 동안 모든 카드를 보여 주고, 덮은 뒤 두 장씩 뒤집어 같은 그림 짝을 모두 찾는다.
   그림은 전부 직접 그린 오리지널 SVG(굵은 외곽선 #1A0F45 + 밝은 색 + 하이라이트). */
NG.memory = (() => {
  const OL = '#1A0F45';
  const O = `stroke="${OL}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const O2 = `stroke="${OL}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  const HL = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''} fill="#fff" opacity=".7"/>`;
  const FACE = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="-5" cy="0" r="2" fill="${OL}"/><circle cx="5" cy="0" r="2" fill="${OL}"/><path d="M-2.6 3.6q2.6 2.2 5.2 0" fill="none" stroke="${OL}" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="-8.5" cy="4" rx="2.3" ry="1.4" fill="#FF6F9A" opacity=".6"/><ellipse cx="8.5" cy="4" rx="2.3" ry="1.4" fill="#FF6F9A" opacity=".6"/></g>`;
  const starPath = (cx, cy, R, r) => { let d = ''; for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); } return d + 'z'; };

  /* ----- 그림 목록: [이름, 대표색, SVG 내용(64×64)] ----- */
  const SYM = {
    apple:['청사과', '#8BD346',
      `<path d="M32 19c-4-3-12-4-17 1-6 6-4 18 1 25 4 6 9 9 13 7 2-1 4-1 6 0 4 2 9-1 13-7 5-7 7-19 1-25-5-5-13-4-17-1z" fill="#8BD346" ${O}/>
       <path d="M40 22c6 1 9 6 9 12" fill="none" stroke="#5FAE24" stroke-width="3" stroke-linecap="round" opacity=".7"/>
       <path d="M32 19c0-4 1-8 3-11" fill="none" ${O}/><path d="M35 13c4-5 11-6 15-3-2 5-9 7-15 3z" fill="#2EAA4A" ${O2}/>${HL(21, 29, 3.6, 7, 20)}`],
    cherry:['체리', '#E8203F',
      `<path d="M22 40C24 27 29 17 38 10M43 40C41 28 40 19 38 10" fill="none" stroke="#3E7A22" stroke-width="3.2" stroke-linecap="round"/>
       <path d="M38 10c4-4 11-4 15 0-4 4-11 4-15 0z" fill="#3DBE5A" ${O2}/>
       <circle cx="21" cy="45" r="10.5" fill="#E8203F" ${O}/><circle cx="43" cy="45" r="10.5" fill="#E8203F" ${O}/>
       <circle cx="17.5" cy="41.5" r="3" fill="#fff" opacity=".75"/><circle cx="39.5" cy="41.5" r="3" fill="#fff" opacity=".75"/>`],
    grape:['포도', '#9B5DE5',
      (() => { const pts = [[32,49],[26,40],[38,40],[20,30],[32,30],[44,30]]; return `<path d="M32 22V10" fill="none" stroke="#6B4424" stroke-width="3.2" stroke-linecap="round"/><path d="M33 14c4-5 12-5 16-1-4 5-12 5-16 1z" fill="#3DBE5A" ${O2}/>` +
        pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.4" fill="#9B5DE5" ${O2}/><circle cx="${x - 2.4}" cy="${y - 2.6}" r="2" fill="#fff" opacity=".7"/>`).join(''); })()],
    lemon:['레몬', '#FFE34D',
      `<path d="M7 35c3-1 4-3 5-6 4-9 13-13 21-12 9 1 16 7 19 14 1 2 3 3 5 4-3 1-4 3-5 6-4 9-13 13-21 12-9-1-16-7-19-14-1-2-3-3-5-4z" fill="#FFE34D" ${O}/>
       <path d="M36 17c3-6 9-9 14-8-1 6-8 9-14 8z" fill="#5BC236" ${O2}/>
       <path d="M17 29c3-6 9-8 14-8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>`],
    strawberry:['딸기', '#FF3B4E',
      `<path d="M12 25c7-5 33-5 40 0 2 13-9 28-20 32C21 53 10 38 12 25z" fill="#FF3B4E" ${O}/>
       ${[[22,33],[32,31],[42,33],[26,42],[38,42],[32,50],[18,26.5],[46,26.5]].slice(0, 6).map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry="2.2" fill="#FFE27A"/>`).join('')}
       <path d="M16 23l5-9 5 6 6-11 6 11 5-6 5 9c-9 5-23 5-32 0z" fill="#3DBE5A" ${O2}/>${HL(19, 34, 2.6, 5, 15)}`],
    watermelon:['수박', '#FF4D6D',
      `<path d="M5 22h54c0 17-12 32-27 32S5 39 5 22z" fill="#2FA84F" ${O}/>
       <path d="M10 22h44c0 14-10 27-22 27S10 36 10 22z" fill="#E9FFD9"/>
       <path d="M13 22h38c0 12-8 23-19 23S13 34 13 22z" fill="#FF4D6D"/>
       ${[[22,28],[32,32],[42,28],[27,37],[37,37]].map(([x, y]) => `<path d="M${x} ${y - 2.6}c1.6 1.4 1.6 3.4 0 4.6-1.6-1.2-1.6-3.2 0-4.6z" fill="${OL}"/>`).join('')}
       <path d="M5 22h54" fill="none" ${O}/>`],
    peach:['복숭아', '#FFA27F',
      `<path d="M32 21c-8-7-23-3-23 13 0 13 11 21 23 21s23-8 23-21c0-16-15-20-23-13z" fill="#FFA27F" ${O}/>
       <path d="M32 21c-5 9-5 22 0 33" fill="none" stroke="#E86A4F" stroke-width="2.6" stroke-linecap="round"/>
       <ellipse cx="44" cy="40" rx="6" ry="7" fill="#FF6F7F" opacity=".45"/>
       <path d="M32 21c1-6 7-11 15-10-1 7-8 11-15 10z" fill="#3DBE5A" ${O2}/>${HL(19, 31, 3.4, 6, 25)}`],
    banana:['바나나', '#FFC933',
      `<path d="M9 15c0 22 14 38 37 38 5 0 9-2 12-5-3-2-6-2-9-2C29 46 20 32 20 14c-3-2-8-2-11 1z" fill="#FFC933" ${O}/>
       <path d="M15 22c2 14 11 23 27 26" fill="none" stroke="#E39A12" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>
       <path d="M13 26c1 5 3 9 5 12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
       <path d="M9 16c-1-4 0-7 3-9l6 2c-1 2-1 4 0 6z" fill="#8A5A2B" ${O2}/>`],
    star:['별', '#FFC93C',
      `<path d="${starPath(32, 34, 26, 12)}" fill="#FFC93C" ${O}/><path d="${starPath(32, 34, 17, 8)}" fill="#FFE27A"/>${FACE(32, 35, .9)}`],
    moon:['달', '#B9A6FF',
      `<path d="M40 7A26 26 0 1 0 57 45 21 21 0 1 1 40 7z" fill="#B9A6FF" ${O}/>
       <path d="M20 22c-3 5-4 11-2 16" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".75"/>
       <path d="M31 38q3 3 6 0" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>
       <path d="${starPath(52, 14, 6, 2.6)}" fill="#FFE27A" ${O2}/>`],
    sun:['해', '#FF9A1F',
      `${Array.from({ length:8 }, (_, i) => `<path d="M30 3.5h4l-2 9z" transform="rotate(${i * 45} 32 32)" fill="#FFC93C" ${O2}/>`).join('')}
       <circle cx="32" cy="32" r="16" fill="#FF9A1F" ${O}/>${HL(25, 25, 3, 4.5, 30)}${FACE(32, 31, 1.05)}`],
    cloud:['구름', '#8FD3FF',
      `<path d="M16 48h33a11 11 0 0 0 3-21.5 15 15 0 0 0-28-5A11 11 0 0 0 16 48z" fill="#8FD3FF" ${O}/>
       <path d="M22 27a9 9 0 0 1 8-5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".85"/>${FACE(33, 36, .95)}`],
    heart:['하트', '#F0368A',
      `<path d="M32 55C17 45 7 36 7 24c0-8 6-14 13-14 5 0 9 3 12 7 3-4 7-7 12-7 7 0 13 6 13 14 0 12-10 21-25 31z" fill="#F0368A" ${O}/>
       <path d="M15 22c0-4 3-7 6-7" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" opacity=".85"/>`],
    balloon:['풍선', '#3A8DFF',
      `<path d="M32 44c-3 6 4 8 0 16" fill="none" stroke="${OL}" stroke-width="2" stroke-linecap="round"/>
       <path d="M29 47l3-4 3 4z" fill="#2466D6" ${O2}/>
       <ellipse cx="32" cy="25" rx="16" ry="19" fill="#3A8DFF" ${O}/>${HL(25, 18, 3.6, 6.5, 25)}`],
    cupcake:['컵케이크', '#7FE0C8',
      `<path d="M17 38h30l-4 19H21z" fill="#E5A15C" ${O}/><path d="M25 40l1.5 16M32 40v16M39 40l-1.5 16" fill="none" stroke="#B5733A" stroke-width="2" stroke-linecap="round"/>
       <path d="M13 38c-2-6 3-10 8-10 0-8 6-13 11-13s11 5 11 13c5 0 10 4 8 10z" fill="#7FE0C8" ${O}/>
       <path d="M24 26l2 1M36 23l-1.5 1.8M40 31l2 .5M28 33l-1.6 1.6M20 33l2-.5" stroke="#FF5C8A" stroke-width="2.4" stroke-linecap="round"/>
       <circle cx="32" cy="12" r="4.5" fill="#E8203F" ${O2}/>`],
    icecream:['아이스크림', '#8B5A3C',
      `<path d="M20 33h24L32 60z" fill="#F4B860" ${O}/><path d="M24 38l12 10M40 38l-12 10M28 48l4 4" fill="none" stroke="#C98A34" stroke-width="1.8" stroke-linecap="round"/>
       <path d="M16 34c-3 0-4-4-2-6 0-10 8-17 18-17s18 7 18 17c2 2 1 6-2 6-2 0-3 4-5 4s-3-4-5-4-3 5-6 5-3-5-6-5-3 4-5 4-3-4-5-4z" fill="#8B5A3C" ${O}/>
       ${HL(24, 20, 3, 5, 30)}<path d="M33 18l2 1M40 24l1 2M29 26l2-1" stroke="#FFE27A" stroke-width="2.4" stroke-linecap="round"/>`],
    clover:['네잎클로버', '#2EC27E',
      `<path d="M33 34c2 9 5 15 11 22" fill="none" stroke="#1F8A55" stroke-width="3.6" stroke-linecap="round"/>
       ${[0, 90, 180, 270].map(a => `<path d="M32 31c-9-3-15-9-13-15 2-5 8-5 11-1l2 2.6 2-2.6c3-4 9-4 11 1 2 6-4 12-13 15z" transform="rotate(${a} 32 32)" fill="#2EC27E" ${O}/>`).join('')}
       <circle cx="32" cy="32" r="2.8" fill="#1F8A55"/><path d="M23 14c2-2 4-2 6 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>`],
    flower:['꽃', '#FF8FC8',
      `${[0, 72, 144, 216, 288].map(a => `<ellipse cx="32" cy="17" rx="9" ry="12" transform="rotate(${a} 32 32)" fill="#FF8FC8" ${O}/>`).join('')}
       <circle cx="32" cy="32" r="9" fill="#FFD93D" ${O}/><circle cx="29" cy="29" r="2.4" fill="#fff" opacity=".8"/>`],
    fish:['물고기', '#1FC3C9',
      `<path d="M46 32l13-11v22z" fill="#FF9A1F" ${O}/>
       <path d="M27 18c4-5 10-6 13-3l-3 5z" fill="#FF9A1F" ${O2}/>
       <path d="M6 32c6-11 17-15 28-13 7 1 11 6 13 13-2 7-6 12-13 13-11 2-22-2-28-13z" fill="#1FC3C9" ${O}/>
       <path d="M30 22c3 6 3 14 0 20M37 22c2 6 2 14 0 20" fill="none" stroke="#0E8F99" stroke-width="2.4" stroke-linecap="round"/>
       <circle cx="17" cy="29" r="3" fill="${OL}"/><circle cx="17.8" cy="28.2" r="1" fill="#fff"/>`],
    mushroom:['버섯', '#FF4D3D',
      `<path d="M23 40h18c1 6 1 12-2 16H25c-3-4-3-10-2-16z" fill="#FFF1D6" ${O}/>
       <path d="M7 37c0-14 11-25 25-25s25 11 25 25c0 3-3 4-6 4H13c-3 0-6-1-6-4z" fill="#FF4D3D" ${O}/>
       <circle cx="32" cy="21" r="4.5" fill="#fff"/><circle cx="19" cy="30" r="3.6" fill="#fff"/><circle cx="45" cy="30" r="3.6" fill="#fff"/><circle cx="31" cy="34" r="2.4" fill="#fff"/>
       <circle cx="29" cy="47" r="1.5" fill="${OL}"/><circle cx="35" cy="47" r="1.5" fill="${OL}"/>`],
    gift:['선물 상자', '#8A5CF6',
      `<rect x="12" y="30" width="40" height="26" rx="3" fill="#8A5CF6" ${O}/>
       <rect x="9" y="22" width="46" height="11" rx="3" fill="#A884FF" ${O}/>
       <path d="M28 22h8v34h-8z" fill="#FFC93C" ${O2}/>
       <path d="M32 21c-4-7-13-9-14-4-1 4 7 5 14 4zM32 21c4-7 13-9 14-4 1 4-7 5-14 4z" fill="#FFC93C" ${O2}/>`],
    rainbow:['무지개', '#FF5C5C',
      `${[['#FF5C5C', 26], ['#FFA23A', 21.5], ['#FFE34D', 17], ['#5BC236', 12.5], ['#3A8DFF', 8]].map(([c, r]) => `<path d="M${32 - r} 46a${r} ${r} 0 0 1 ${2 * r} 0z" fill="${c}" ${O2}/>`).join('')}
       <path d="M28 46a4 4 0 0 1 8 0z" fill="#FFF8EA" ${O2}/>
       <path d="M3 50a5 5 0 0 1 6-7 6 6 0 0 1 11 2 4 4 0 0 1 0 8H7a4 4 0 0 1-4-3z" fill="#fff" ${O2}/>
       <path d="M61 50a5 5 0 0 0-6-7 6 6 0 0 0-11 2 4 4 0 0 0 0 8h13a4 4 0 0 0 4-3z" fill="#fff" ${O2}/>`],
    umbrella:['우산', '#FFD93D',
      `<path d="M32 30v20a5 5 0 0 1-10 0" fill="none" stroke="${OL}" stroke-width="3.2" stroke-linecap="round"/>
       <path d="M6 32C6 18 18 8 32 8s26 10 26 24c-3-3-6-3-8.7 0-3-3-6-3-8.6 0-3-3-6-3-8.7 0-3-3-6-3-8.7 0-3-3-6-3-8.6 0-3-3-6-3-8.7 0z" fill="#FFD93D" ${O}/>
       <path d="M32 8c-5 6-8 15-8.7 24M32 8c5 6 8 15 8.7 24" fill="none" stroke="${OL}" stroke-width="2.4"/>
       <path d="M32 8c-5 6-8 15-8.7 24h17.4C40 23 37 14 32 8z" fill="#5BC236" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>
       <path d="M13 24c2-5 6-9 11-11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`]
  };
  const ANIMAL = { rabbit:['토끼', '#FFD6E6'], bear:['곰', '#FFE7A8'], panda:['판다', '#D9E8FF'], cat:['고양이', '#D8F5C8'] };
  const FRUITS = ['apple','cherry','grape','lemon','strawberry','watermelon','peach','banana'];
  const POOL = Object.keys(SYM).concat(Object.keys(ANIMAL));
  const symName = k => SYM[k] ? SYM[k][0] : ANIMAL[k][0];
  const symCol = k => SYM[k] ? SYM[k][1] : ANIMAL[k][1];
  const symSvg = k => {
    if(SYM[k]) return `<svg viewBox="0 0 64 64" aria-hidden="true">${SYM[k][2]}</svg>`;
    const f = typeof toyImage === 'function' ? toyImage(k, 5, 4, 54, 54) : '';
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="25" fill="${ANIMAL[k][1]}" ${O}/>${f}</svg>`;
  };
  /* 카드 뒷면 문양: 분홍 사탕 마름모 + 금빛 반짝이 */
  const BACK = `<svg class="mm-emb" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l15 17-15 17L5 20z" fill="#FF5C9A" ${O2}/><path d="M20 8l11 12-11 12L9 20z" fill="#FF8AB8"/>
    <path d="M20 11c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" fill="#FFE27A" ${O2} stroke-width="1.6"/><circle cx="14.5" cy="15" r="1.6" fill="#fff" opacity=".9"/></svg>`;
  const ICO = {
    pair:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="11" height="15" rx="2.5" transform="rotate(-10 8 12)" fill="#A884FF" stroke="#1A0F45" stroke-width="1.8"/><rect x="10" y="4" width="11" height="15" rx="2.5" transform="rotate(8 15.5 11.5)" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8"/><path d="M15.6 15.2c-2.4-1.6-3.6-2.8-3.6-4.3 0-1.1.8-1.9 1.8-1.9.8 0 1.4.5 1.8 1.1.4-.6 1-1.1 1.8-1.1 1 0 1.8.8 1.8 1.9 0 1.5-1.2 2.7-3.6 4.3z" fill="#F0368A"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    flip:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3.5" width="12" height="17" rx="2.6" fill="#6C3CE0" stroke="#1A0F45" stroke-width="1.8"/><path d="M12 7.5l3.2 4.5-3.2 4.5-3.2-4.5z" fill="#FF8AB8"/><path d="M2.6 10a9.5 9.5 0 0 1 3-4.6M21.4 14a9.5 9.5 0 0 1-3 4.6" fill="none" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round"/></svg>'
  };

  /* ----- 특수 카드 그림: 폭탄, 조커, 닮은꼴 리본(모두 직접 그린 오리지널) ----- */
  const BOMB = '@bomb', JOKER = '@joker', ALT = '~b';   /* 닮은꼴 카드 키 = 원래 키 + '~b' (색이 다르고 리본을 달았다) */
  const BOMB_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M44 15c4-6 10-7 14-4" fill="none" stroke="#8A5A2B" stroke-width="3.2" stroke-linecap="round"/>
    <path d="${starPath(57, 9, 7, 3)}" fill="#FFB020" ${O2}/><path d="${starPath(57, 9, 3.6, 1.6)}" fill="#FFF3A8"/>
    <rect x="35" y="14" width="12" height="10" rx="2.5" transform="rotate(38 41 19)" fill="#7B7497" ${O2}/>
    <circle cx="29" cy="38" r="20" fill="#3A3553" ${O}/>
    <ellipse cx="21" cy="30" rx="5" ry="7.5" transform="rotate(35 21 30)" fill="#fff" opacity=".35"/>
    <path d="M20 37l6 3M38 37l-6 3" stroke="#FF6A6A" stroke-width="3" stroke-linecap="round"/>
    <path d="M23 47q6-4 12 0" fill="none" stroke="#FF6A6A" stroke-width="2.6" stroke-linecap="round"/></svg>`;
  const JOKER_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
    ${['#FF5C5C', '#FFA23A', '#FFE34D', '#5BC236', '#3A8DFF', '#9B5DE5'].map((cc, i) => `<path d="M32 32L${(32 + 28 * Math.cos((i * 60 - 90) * Math.PI / 180)).toFixed(1)} ${(32 + 28 * Math.sin((i * 60 - 90) * Math.PI / 180)).toFixed(1)}A28 28 0 0 1 ${(32 + 28 * Math.cos(((i + 1) * 60 - 90) * Math.PI / 180)).toFixed(1)} ${(32 + 28 * Math.sin(((i + 1) * 60 - 90) * Math.PI / 180)).toFixed(1)}z" fill="${cc}"/>`).join('')}
    <circle cx="32" cy="32" r="28" fill="none" ${O}/>
    <path d="${starPath(32, 33, 20, 9.5)}" fill="#FFF8EA" ${O}/>${FACE(32, 34, .9)}
    <path d="${starPath(10, 10, 5, 2)}" fill="#fff" ${O2} stroke-width="1.6"/><path d="${starPath(55, 54, 4.5, 2)}" fill="#fff" ${O2} stroke-width="1.6"/></svg>`;
  const BOW_SVG = `<svg class="mm-bow" viewBox="0 0 32 24" aria-hidden="true"><path d="M16 12L3 3c-2 5-2 13 0 18z" fill="#FF3D7F" ${O2}/><path d="M16 12L29 3c2 5 2 13 0 18z" fill="#FF3D7F" ${O2}/>
    <path d="M6 7c-.6 2-.6 4 0 5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/><rect x="12" y="8" width="8" height="8" rx="3" fill="#FFC93C" ${O2}/></svg>`;
  const isSpecial = k => k === BOMB || k === JOKER;
  const baseOf = k => k && k.endsWith(ALT) ? k.slice(0, -ALT.length) : k;
  const cardName = k => k === BOMB ? '폭탄' : k === JOKER ? '조커' : k.endsWith(ALT) ? '리본 단 ' + symName(baseOf(k)) : symName(k);
  const faceHtml = k => k === BOMB ? BOMB_SVG : k === JOKER ? JOKER_SVG : k.endsWith(ALT) ? symSvg(baseOf(k)).replace('<svg ', '<svg class="mm-alt" ') + BOW_SVG : symSvg(k);
  const frontCls = k => k === BOMB ? ' mm-fb' : k === JOKER ? ' mm-fj' : '';

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['triple', 'bomb', 'joker', 'twins'],
    info:{
      triple:{ name:'세 장 짝', desc:'같은 그림이 세 장씩 있어요. 한 번에 세 장까지 뒤집고, 세 장이 모두 같아야 짝이 돼요. 두 장이 다르면 바로 덮여요.' },
      bomb:{ name:'폭탄 카드', desc:'폭탄을 뒤집으면 펑! 시간이 8초 줄고, 덮인 카드 두 장이 자리를 바꿔요. 터진 폭탄은 사라져요. 미리 보기 때 폭탄 자리를 기억해 두세요.' },
      joker:{ name:'조커', desc:'무지개 조커는 어떤 카드와도 짝이 돼요. 조커와 같이 뒤집은 카드는 나머지 짝까지 한꺼번에 찾아 줘요. 짝을 모르는 카드에 아껴 쓰세요.' },
      twins:{ name:'닮은꼴', desc:'색이 다르고 리본을 단 닮은 카드가 섞여 있어요. 색과 리본까지 똑같아야 짝이에요.' }
    },
    twists:['flash', 'tight', 'shuffle', 'bare', 'tick'],
    twInfo:{
      flash:{ name:'번개', desc:'카드는 조금 적지만 제한 시간이 아주 짧아요. 빠르고 정확하게!' },
      tight:{ name:'외줄 타기', desc:'틀릴 수 있는 횟수가 정해져 있어요. 위쪽 실수 칸을 다 쓰고 또 틀리면 끝나요.' },
      shuffle:{ name:'카드 섞기', desc:'짝을 3번 찾을 때마다 덮인 카드 몇 장이 자리를 바꿔요. 움직이는 카드를 눈으로 따라가요.' },
      bare:{ name:'맨손', desc:'미리 보기 없이 시작해요. 처음부터 한 장씩 뒤집으며 기억해요.' },
      tick:{ name:'째깍 벌칙', desc:'틀릴 때마다 남은 시간이 3초씩 줄어요. 찍기보다 기억!' }
    }
  };
  const RULE_TIP = { triple:'세 장이 같아야 짝', bomb:'폭탄은 피해요', joker:'조커는 아무 카드와 짝', twins:'색·리본까지 똑같이', shuffle:'짝 3번마다 섞여요', tick:'틀리면 −3초', bare:'미리 보기 없음', tight:'실수 횟수 제한', flash:'시간이 짧아요' };

  /* ----- 난이도 표 (기억 용량이 제한된 봇 시뮬레이션으로 맞춤: tools/memory-bot.js) -----
     카드 수 = 챕터 기본 + 자리(k) 톱니(규칙·변주에 따라 줄임).
     제한 시간 = A × 카드^(alpha [+ alpha3: 세 장 짝]) × 자리 배수 × 규칙 배수 × 변주 배수 (시뮬레이션 필요 시간의 로그 회귀)
     목표 첫 도전 클리어율: k=1·6·9 ≈90%, 보통 75~85%, k=5 ≈60%, 보스 ≈40% (챕터마다 조금씩 내려감) */
  const MT = {
    ch1:[6, 8, 12, 12, 16, 10, 12, 16, 12, 14],                 /* 챕터 1(기본 규칙) 판별 카드 수 */
    base:[0, 0, 16, 18, 20, 20, 22, 24, 24],                    /* 챕터 c(≥2) 기본 카드 수 */
    kOff:[0, -4, -2, 0, 0, 4, -2, 0, 2, -4, 4],
    mjCards:{ triple:0.8 }, twCards:{ flash:0.75, bare:0.8 },
    A:0.742, alpha:1.4, alpha3:0.474,
    kTime:[0, 1.14, 1.02, 1.01, 0.98, 0.88, 1.13, 1.03, 1.01, 1.08, 0.77],
    mjTime:{ triple:0.47, bomb:1.23, joker:0.94, twins:1.13 },
    bossTw:{ flash:0.92, shuffle:0.92, bare:1.07, tick:1.04 },
    tjTime:0.84,
    twTime:{ flash:0.93, shuffle:1.02, bare:1.06, tick:1.55, tight:1.6 },
    /* 외줄 타기: 허용 실수 = cap0 × 짝 수^capE × 자리 배수 × (세 장 짝 capG3) × (닮은꼴 capTw) */
    cap0:0.4, capE:1.4, capK:{ 6:0.85, 7:1.0, 8:1.15, 10:0.7 }, capG3:2.6, capTw:1.15
  };
  const gridOf = total => {
    let best = null;
    for(let c = 2; c <= 6; c++){
      const r = Math.ceil(total / c); if(r > (total > 36 ? 7 : 6) || r > 2 * c || (c === 2 && total > 8) || r < c - 1) continue;
      const s = (c * r - total) * 2 + Math.abs(r / c - 1.05) * 6;   /* 휴대폰 세로 화면: 카드(3:4)를 거의 정사각 배열로 놓을 때 가장 크다 */
      if(!best || s < best.s) best = { c, r, s };
    }
    return best ? [best.c, best.r] : [6, Math.ceil(total / 6)];
  };
  function stageCfg(n){
    const p = planOf('memory', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    const g = has('triple') ? 3 : 2;
    let L = c === 1 ? MT.ch1[k - 1] : MT.base[Math.min(c, MT.base.length - 1)] + MT.kOff[k];
    mj.forEach(x => { L *= MT.mjCards[x] || 1; });
    if(tw) L *= MT.twCards[tw] || 1;
    const bombs = has('bomb') ? (k === 5 || k === 10 || p.remix && k === 8 ? 2 : 1) : 0, jokers = has('joker') ? 1 : 0;
    let sets = Math.max(3, Math.round(L / g));
    while(sets * g + bombs + jokers > 42) sets--;
    const twins = has('twins') ? Math.max(1, Math.min(Math.floor(sets / 2), k === 1 ? 1 : Math.round(sets / 3))) : 0;
    const total = sets * g + bombs + jokers, [cols, rows] = gridOf(total), cards = sets * g;
    let limit = MT.A * Math.pow(cards, MT.alpha + (g === 3 ? MT.alpha3 : 0)) * MT.kTime[k];
    mj.forEach(x => { limit *= x === 'bomb' ? Math.pow(MT.mjTime.bomb, bombs) : MT.mjTime[x] || 1; });   /* 폭탄은 한 개마다 */
    if(tw) limit *= MT.twTime[tw] || 1;
    if(has('triple') && has('joker')) limit *= MT.tjTime;
    if(p.boss && tw) limit *= MT.bossTw[tw] || 1;   /* 보스에서 변주가 겹칠 때 보정 */   /* 조커가 세 장 짝 한 세트를 통째로 풀어 줘서 훨씬 쉬워진다 */
    limit = Math.max(10, Math.round(1.5 * cards), Math.round(limit));   /* 카드 한 장에 적어도 1.5초 */
    let preview = tw === 'bare' ? 0 : Math.max(1.5, (cards <= 12 ? 3 : cards <= 20 ? 2.5 : 2) - (p.boss ? .5 : 0) + (bombs ? .5 : 0));
    const missCap = tw === 'tight' ? Math.max(2, Math.round(MT.cap0 * Math.pow(sets, MT.capE) * (MT.capK[k] || 1) * (g === 3 ? MT.capG3 : 1) * (twins ? MT.capTw : 1))) : 0;
    return { cols, rows, g, sets, bombs, jokers, twins, limit, preview, missCap, shuffle:tw === 'shuffle', tick:tw === 'tick' ? 3 : 0,
      boss:p.boss, hard:p.hard, fruit:c === 1 && !twins, mj:mj.slice(), tw, n };
  }

  const S = () => G.m;   /* 이 게임의 상태 묶음 */
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };

  function cardEl(i){ return document.querySelector(`.ng-memory .mm-card[data-i="${i}"]`); }
  function setUp(i, up){ const el = cardEl(i), m = S(); if(!el || !m.cards[i]) return; el.classList.toggle('up', up); el.setAttribute('aria-label', up || m.st[i] === 2 ? cardName(m.cards[i]) + (m.st[i] === 2 ? (m.cards[i] === BOMB ? ' (터짐)' : ' (짝 찾음)') : '') : '덮인 카드 ' + (Math.floor(i / m.cols) + 1) + '행 ' + (i % m.cols + 1) + '열'); }

  function hud(){
    const m = S(); if(!m) return;
    const f = $('#mmFound'); if(f) f.textContent = m.found;
    const fl = $('#mmFlips'); if(fl) fl.textContent = m.flips;
    const mc = $('#mmMiss'); if(mc && m.missCap){ const left = Math.max(0, m.missCap - m.misses); mc.innerHTML = `실수 <b>${left}</b>번 남음`; mc.classList.toggle('low', left <= 1); }
  }
  function msg(html, cls){ const e = $('#mmMsg'); if(!e) return; e.className = 'mm-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">보스 판</b><span>' + (m.tips[0] || '끝까지 집중!') + '</span>';
    if(m.tips.length) return '<span>' + m.tips.slice(0, 2).join(' · ') + '</span>';
    return '<span>같은 그림 두 장을 찾아요</span>';
  }

  function layout(){
    const m = S(), bd = $('#bd'), root = document.querySelector('.ng-memory'); if(!bd || !root) return;
    const W = Math.min(root.clientWidth || 360, 430);
    const top = bd.getBoundingClientRect().top + (window.scrollY || 0);
    const H = Math.max(260, (innerHeight || 740) - top - 14);
    const gap = m.cols >= 6 || m.rows >= 7 ? 5 : m.cols >= 5 ? 6 : 8, pad = m.cols >= 5 ? 8 : 10;
    let cw = Math.min((W - pad * 2 - gap * (m.cols - 1)) / m.cols, (H - pad * 2 - gap * (m.rows - 1)) / m.rows * 0.75, 104);
    cw = Math.max(34, Math.floor(cw)); const ch = Math.floor(cw / 0.75);
    bd.style.setProperty('--cw', cw + 'px'); bd.style.setProperty('--ch', ch + 'px'); bd.style.setProperty('--gap', gap + 'px'); bd.style.setProperty('--pad', pad + 'px');
    bd.style.gridTemplateColumns = `repeat(${m.cols}, ${cw}px)`;
  }

  /* ----- 루프: 카드 나눠주기 → 미리 보기 → 카운트다운 ----- */
  const DEAL = 0.55;
  const remTime = t => Math.max(0, G.limit - S().pen - t);
  function startPlay(){
    const m = S();
    m.phase = 'play'; G.start = Date.now(); G.pausedMs = 0;
    m.cards.forEach((_, i) => { const el = cardEl(i); if(el){ el.style.setProperty('--d', (i % m.cols + Math.floor(i / m.cols)) * 18 + 'ms'); el.classList.add('wave'); } setUp(i, false); });
    T(() => document.querySelectorAll('.ng-memory .mm-card.wave').forEach(e => e.classList.remove('wave')), 700);
    sfx('memoryGo'); msg(m.preview > 0 ? playMsg() : '<b class="boss">미리 보기 없음</b><span>뒤집으며 기억해요</span>');
    const b = $('#mmBarWrap'); if(b) b.classList.remove('pv');
  }
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed(), bar = $('#mmBar');
    if(m.phase === 'deal' && t >= DEAL){
      if(m.preview <= 0){ startPlay(); return; }
      m.phase = 'preview'; m.cards.forEach((_, i) => { const el = cardEl(i); if(el) el.style.transitionDelay = ''; setUp(i, true); });
      sfx('memoryFlip', { n:3 }); msg('<b>기억하세요!</b><span>' + m.preview + '초 뒤에 카드가 덮여요</span>', 'mm-remember');
      const b = $('#mmBarWrap'); if(b) b.classList.add('pv');
    }
    if(m.phase === 'preview'){
      const k = Math.max(0, Math.min(1, (t - DEAL - .3) / m.preview));
      if(bar) bar.style.transform = `scaleX(${1 - k})`;
      if(k >= 1) startPlay();
      return;
    }
    if(m.phase !== 'play') return;
    const rem = remTime(t), sec = Math.ceil(rem);
    if(bar) bar.style.transform = `scaleX(${rem / G.limit})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#mmTime'); if(e) e.textContent = mmss(sec);
      const p = $('#mmTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#mmBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0){ sfx('memoryTick', { hi:sec <= 5 }); if(p && !FXR.reduce && p.animate) p.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)' }, { transform:'scale(1)' }], { duration:300, easing:'ease-out' }); }
    }
    if(rem <= 0) timeUp();
  }

  /* 뒤집기: 보통은 g장(2 또는 3)이 모두 같으면 짝. 조커 + 아무 카드 = 그 카드의 짝 전부. 폭탄은 뒤집자마자 터진다 */
  function tap(i){
    const m = S();
    if(!m || G.over || G.paused || m.phase !== 'play' || m.lock || m.st[i] !== 0 || m.open.includes(i)) return;
    m.flips++; m.seen.add(i);
    if(m.cards[i] === BOMB){ hud(); boom(i); return; }
    m.open.push(i); setUp(i, true); hud();
    sfx('memoryFlip', { n:Math.min(2, m.open.length) });
    const jk = m.open.filter(j => m.cards[j] === JOKER), nm = m.open.filter(j => m.cards[j] !== JOKER);
    if(jk.length && nm.length){ m.lock = true; T(() => jokerMatch(jk[0], nm[0]), 290); return; }
    if(!nm.length) return;
    if(!nm.every(j => m.cards[j] === m.cards[nm[0]])){ m.lock = true; const o = m.open.slice(); T(() => miss(o), 290); return; }
    if(nm.length >= m.g){ m.lock = true; const o = nm.slice(); T(() => match(o), 290); }
  }

  function celebrate(list, col){
    list.forEach((i, k) => {
      const el = cardEl(i); if(!el) return; el.classList.add('ok'); setUp(i, true);
      const p = fxCenter(el);
      fxRing(p.x, p.y, '#FFE27A', p.w * .9, .45, 7);
      fxBurst(p.x, p.y, [col, '#FFE27A', '#FFFFFF'], 10, { speed:230, size:4.5, kinds:['star','dot','spark'], up:110, g:460, glow:k === list.length - 1, dur:.7 });
      /* 이펙트 v2: 짝을 맞힌 카드 위로 작은 하트·반짝이가 떠오름 */
      try{ fxEmit(p.x, p.y - p.h * .2, { quantity:3, x:{ min:-p.w * .3, max:p.w * .3 }, speed:{ min:30, max:70 }, angle:{ min:250, max:290 }, lifespan:{ min:700, max:1000 }, kind:k % 2 ? 'twinkle' : 'heart', tint:['#FFFFFF', '#FFB3D1'], scale:{ start:4.5, end:2 }, alpha:{ start:1, end:0 }, gravityY:-30, wob:30, delay:120 }); }catch(_){}
    });
  }
  function afterMatch(){
    const m = S();
    sfx('memoryMatch', { n:m.combo - 1 }); fxBuzz(15);
    if(m.combo >= 2) fxCombo(m.combo);
    hud();
    if(m.found >= m.pairs){ win(); return; }
    if(m.shuf && m.sinceSwap >= 3){ m.sinceSwap = 0; T(swapTwist, 420); return; }
    m.lock = false;
  }
  function match(list){
    const m = S(); m.open = []; list.forEach(i => { m.st[i] = 2; }); m.found++; m.combo++; m.best = Math.max(m.best, m.combo); m.sinceSwap++;
    celebrate(list, symCol(baseOf(m.cards[list[0]])));
    afterMatch();
  }
  /* 조커: 같이 뒤집은 카드와 같은 그림을 모두(덮인 것까지) 찾아 준다 */
  function jokerMatch(j, a){
    const m = S(), key = m.cards[a];
    const all = m.cards.map((c, i) => c === key && m.st[i] === 0 ? i : -1).filter(i => i >= 0);
    m.open.forEach(i => { if(i !== j && m.cards[i] !== key) setUp(i, false); });
    m.open = []; m.st[j] = 2; all.forEach(i => { m.st[i] = 2; });
    m.found++; m.combo++; m.best = Math.max(m.best, m.combo); m.sinceSwap++; m.jokerUsed = 1;
    const ej = cardEl(j); if(ej){ ej.classList.add('ok', 'jk'); const p = fxCenter(ej); fxRing(p.x, p.y, '#B08BFF', p.w * 1.3, .6, 9); fxBurst(p.x, p.y, ['#FF5C5C', '#FFE34D', '#5BC236', '#3A8DFF', '#9B5DE5'], 16, { speed:280, size:5, kinds:['star','spark'], up:120, g:420, glow:true, dur:.8 }); }
    celebrate(all, symCol(baseOf(key)));
    afterMatch();
  }

  function miss(list){
    const m = S(); m.misses++; m.combo = 0;
    list.forEach(i => { const el = cardEl(i); if(el){ el.classList.add('bad'); fxShake(el, 5); } });
    sfx('memoryMiss'); fxBuzz(25);
    if(m.tick){ m.pen += m.tick; const tp = $('#mmTimeP'); if(tp){ const p = fxCenter(tp); fxFloat(p.x, p.y + 30, '−' + m.tick + '초', 'bad'); } }
    hud();
    const out = m.missCap && m.misses > m.missCap;
    T(() => {
      list.forEach(i => { const el = cardEl(i); if(el) el.classList.remove('bad'); setUp(i, false); });
      m.open = [];
      if(out){ failMiss(); return; }
      m.lock = false;
    }, 460);
  }

  /* 폭탄: 시간 −8초, 열린 카드는 다시 덮이고, 덮인 카드 두 장(가능하면 이미 본 카드)이 자리를 바꾼다. 폭탄은 사라진다 */
  const BOMB_SEC = 8;
  function boom(i){
    const m = S(); m.lock = true; m.st[i] = 2; m.booms++;
    const el = cardEl(i); if(el){ el.classList.add('fuse'); } setUp(i, true);
    sfx('memoryFuse');
    T(() => {
      m.pen += BOMB_SEC; m.combo = 0;
      if(el){ el.classList.remove('fuse'); el.classList.add('boomed'); const p = fxCenter(el); fxRing(p.x, p.y, '#FF8A3D', p.w * 1.6, .5, 12); fxBurst(p.x, p.y, ['#FF5C2B', '#FFB020', '#3A3553', '#FFF3A8'], 22, { speed:360, size:6, kinds:['dot','spark','star'], up:60, g:520, glow:true, dur:.8 }); fxFloat(p.x, p.y - 10, '−' + BOMB_SEC + '초', 'bad'); }
      sfx('memoryBoom'); fxBuzz([50, 30, 60]); fxShake($('#bd'), 8);
      m.open.forEach(j => setUp(j, false)); m.open = [];
      const down = m.st.map((s, j) => s === 0 ? j : -1).filter(j => j >= 0);
      if(down.length < 2){ m.lock = false; return; }
      const seen = shuffle(down.filter(j => m.seen.has(j)), m.rng), rest = shuffle(down.filter(j => !m.seen.has(j)), m.rng), pool = seen.concat(rest);
      msg('<b class="bad">펑!</b><span>시간 −' + BOMB_SEC + '초 · 카드 두 장이 자리를 바꿔요</span>', 'mm-shuffle');
      T(() => swapCards([[pool[0], pool[1]]], () => { msg(playMsg()); m.lock = false; }), 380);
    }, 330);
  }

  /* 덮인 카드 자리 바꾸기(애니메이션) */
  function swapCards(pairs, done){
    const m = S(), dur = FXR.reduce ? 10 : 620;
    sfx('memoryShuffle');
    pairs.forEach(([x, y]) => {
      const ex = cardEl(x), ey = cardEl(y); if(!ex || !ey) return;
      const px = ex.getBoundingClientRect(), py = ey.getBoundingClientRect(), dx = py.left - px.left, dy = py.top - px.top;
      ex.classList.add('moving'); ey.classList.add('moving');
      if(ex.animate){
        ex.animate([{ transform:'translate(0,0) scale(1)' }, { transform:`translate(${dx / 2}px,${dy / 2 - 18}px) scale(1.12)`, offset:.5 }, { transform:`translate(${dx}px,${dy}px) scale(1)` }], { duration:dur, easing:'cubic-bezier(.5,0,.3,1)' });
        ey.animate([{ transform:'translate(0,0) scale(1)' }, { transform:`translate(${-dx / 2}px,${-dy / 2 + 18}px) scale(.92)`, offset:.5 }, { transform:`translate(${-dx}px,${-dy}px) scale(1)` }], { duration:dur, easing:'cubic-bezier(.5,0,.3,1)' });
      }
    });
    T(() => {
      pairs.forEach(([x, y]) => {
        [m.cards[x], m.cards[y]] = [m.cards[y], m.cards[x]];
        const ex = cardEl(x), ey = cardEl(y); if(!ex || !ey) return;
        const fx = ex.querySelector('.mm-front'), fy = ey.querySelector('.mm-front');
        fx.className = 'mm-face mm-front' + frontCls(m.cards[x]); fy.className = 'mm-face mm-front' + frontCls(m.cards[y]);
        fx.innerHTML = faceHtml(m.cards[x]); fy.innerHTML = faceHtml(m.cards[y]);
        ex.classList.remove('moving'); ey.classList.remove('moving');
      });
      sfx('memoryFlip', { n:1 });
      m.swaps++; done();
    }, dur + 20);
  }
  /* 변주 '카드 섞기': 짝을 3번 찾을 때마다 덮인 카드 몇 장이 서로 자리를 바꾼다(rng로 결정) */
  function swapTwist(){
    const m = S(), down = m.st.map((s, i) => s === 0 ? i : -1).filter(i => i >= 0);
    if(down.length < 4){ m.lock = false; return; }
    const pick = shuffle(down.slice(), m.rng), nSwap = Math.min(3, Math.floor(pick.length / 2)), pairs = [];
    for(let k = 0; k < nSwap; k++) pairs.push([pick[2 * k], pick[2 * k + 1]]);
    msg('<b class="boss">카드가 섞여요!</b><span>움직이는 카드를 잘 보세요</span>', 'mm-shuffle');
    swapCards(pairs, () => { msg(playMsg()); m.lock = false; });
  }

  function win(){
    const m = S(); m.phase = 'done'; m.lock = true; m.sec = elapsed();
    msg('<b>모두 찾았어요!</b>', 'mm-win');
    sfx('win', { g:'memory' }); fxBuzz([30, 50, 30]);
    const bd = $('#bd');
    m.cards.forEach((c, i) => { if(!c) return; if(m.st[i] === 0){ m.st[i] = 2; setUp(i, true); } const el = cardEl(i); if(el){ el.style.setProperty('--d', (i % m.cols + Math.floor(i / m.cols)) * 35 + 'ms'); el.classList.add('cheer'); } });
    if(bd){ const p = fxCenter(bd); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); }
    T(() => finish(true), 1000);
  }

  function showLeft(){ const m = S(); m.st.forEach((s, i) => { if(s === 0 && m.cards[i]){ const el = cardEl(i); if(el){ el.classList.add('left'); } setUp(i, true); } }); }
  function timeUp(){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.lock = true; m.open = []; m.fail = 'time';
    const e = $('#mmTime'); if(e) e.textContent = '0:00';
    msg('<b class="bad">시간이 다 됐어요</b><span>남은 짝을 보여 드릴게요</span>', 'mm-fail');
    sfx('memoryTimeUp'); fxBuzz([40, 40, 60]); fxShake($('#bd'), 6);
    showLeft();
    T(() => finish(false), 1500);
  }
  function failMiss(){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.lock = true; m.open = []; m.fail = 'miss';
    msg('<b class="bad">실수를 다 썼어요</b><span>남은 짝을 보여 드릴게요</span>', 'mm-fail');
    sfx('memoryTimeUp'); fxBuzz([40, 40, 60]); fxShake($('#bd'), 6);
    showLeft();
    T(() => finish(false), 1500);
  }

  function build(){
    const m = S(), bd = $('#bd'); if(!bd) return;
    bd.innerHTML = m.cards.map((k, i) => k ? `<button class="mm-card${m.st[i] ? ' up' : ''}${m.st[i] === 2 ? ' ok' : ''} in" data-i="${i}" style="--d:${(i % m.cols + Math.floor(i / m.cols)) * 30}ms" aria-label="덮인 카드 ${Math.floor(i / m.cols) + 1}행 ${i % m.cols + 1}열"><span class="mm-pop"><span class="mm-in"><span class="mm-face mm-back">${BACK}</span><span class="mm-face mm-front${frontCls(k)}">${faceHtml(k)}</span></span></span></button>`
      : `<span class="mm-gap" aria-hidden="true"></span>`).join('');
    layout();
    T(() => document.querySelectorAll('.ng-memory .mm-card.in').forEach(e => e.classList.remove('in')), 900);
    bd.onpointerdown = e => {
      const el = e.target.closest && e.target.closest('.mm-card'); if(!el) return;
      e.preventDefault(); tap(+el.dataset.i);
    };
    bd.onkeydown = e => {
      const el = e.target.closest && e.target.closest('.mm-card'); if(!el) return;
      const i = +el.dataset.i, c = m.cols, n = m.cards.length;
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); tap(i); return; }
      const d = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-c, ArrowDown:c }[e.key];
      if(d != null){ e.preventDefault(); let j = i + d; while(j >= 0 && j < n && !m.cards[j]) j += d; if(j >= 0 && j < n){ const t = cardEl(j); if(t) t.focus(); } }
    };
  }

  return {
    name:'카드 짝 맞추기', abil:'집중력', col:['#FFA8BE','#FF5C8A','#B0214F'], time:'약 2분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M3.3 5.6a2.6 2.6 0 0 1 2.2-3l5.4-.9a2.6 2.6 0 0 1 3 2.2l.2 1.1h-2.4a4.4 4.4 0 0 0-4.4 4.4v9.2l-.6.1a2.6 2.6 0 0 1-3-2.2zM11.7 6.4h6.6A2.7 2.7 0 0 1 21 9.1v10.2a2.7 2.7 0 0 1-2.7 2.7h-6.6A2.7 2.7 0 0 1 9 19.3V9.1a2.7 2.7 0 0 1 2.7-2.7zm3.3 11.6c-2.9-1.9-4.3-3.4-4.3-5.2 0-1.3 1-2.3 2.2-2.3.9 0 1.6.5 2.1 1.2.5-.7 1.2-1.2 2.1-1.2 1.2 0 2.2 1 2.2 2.3 0 1.8-1.4 3.3-4.3 5.2z"/></svg>',
    art(){
      const card = (x, y, r, inner, back) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-15" y="-20" width="30" height="40" rx="6" fill="${back ? 'url(#memoryA2)' : '#FFF8EA'}" stroke="#1A0F45" stroke-width="2.6"/>${back ? '<path d="M-15 -8l30-12M-15 6l30-12M-15 20l30-12" stroke="#fff" stroke-width="3" opacity=".14"/><path d="M0 -9l8 9-8 9-8-9z" fill="#FF5C9A" stroke="#1A0F45" stroke-width="1.6" stroke-linejoin="round"/><path d="M0-4.5c.6 3 1.5 3.9 4.5 4.5-3 .6-3.9 1.5-4.5 4.5-.6-3-1.5-3.9-4.5-4.5 3-.6 3.9-1.5 4.5-4.5z" fill="#FFE27A"/>' : ''}${inner || ''}</g>`;
      const sym = k => `<svg x="-13" y="-13" width="26" height="26" viewBox="0 0 64 64">${SYM[k][2]}</svg>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="memoryA1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9C2"/><stop offset="1" stop-color="#FF9A9E"/></linearGradient>
        <linearGradient id="memoryA2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B08BFF"/><stop offset="1" stop-color="#6C3CE0"/></linearGradient>
        <radialGradient id="memoryA3" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF6B0" stop-opacity=".95"/><stop offset="1" stop-color="#FFE27A" stop-opacity="0"/></radialGradient></defs>
        <rect width="160" height="100" fill="url(#memoryA1)"/>
        <g fill="#fff" opacity=".35"><circle cx="12" cy="14" r="3"/><circle cx="150" cy="84" r="4"/><circle cx="140" cy="12" r="2.4"/><circle cx="18" cy="86" r="2.4"/></g>
        <ellipse cx="80" cy="52" rx="62" ry="40" fill="url(#memoryA3)"/>
        ${card(30, 56, -14, '', true)}${card(130, 56, 14, '', true)}
        ${card(62, 50, -7, sym('cherry'))}${card(98, 50, 7, sym('cherry'))}
        <path d="${starPath(80, 22, 7, 3)}" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="${starPath(116, 20, 4.5, 2)}" fill="#fff" stroke="#1A0F45" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="${starPath(44, 22, 4, 1.8)}" fill="#fff" stroke="#1A0F45" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    },
    help:[
      ['그림을 기억해요', '처음 몇 초 동안 모든 카드가 앞면으로 보여요. 어디에 무슨 그림이 있는지 잘 기억해 두세요.'],
      ['두 장씩 뒤집어요', '카드를 눌러 두 장을 뒤집어요. 같은 그림이면 짝을 찾은 거예요. 다르면 다시 덮여요.'],
      ['시간 안에 모두 찾기', '제한 시간 안에 짝을 모두 찾으면 성공이에요. 덜 틀리고 빨리 찾을수록 점수가 높아요.'],
      ['솔로: 5판마다 새 규칙', '솔로에서는 세 장 짝·폭탄·조커·닮은꼴 같은 새 규칙과 번개·외줄 타기 같은 변주가 5판마다 하나씩 나와요. 지금 켜진 규칙은 판 위쪽 이름표에 보여요.']
    ],
    chapters:['과일 바구니','장난감 상자','별빛 하늘','바닷속 친구들','마법 서랍'],
    starRule:'★ 클리어 · ★★ 조금만 틀리기 · ★★★ 거의 안 틀리기',
    levels:{
      easy:{ cols:4, rows:4, limit:90, preview:3 },
      normal:{ cols:4, rows:5, limit:120, preview:2.5 },
      hard:{ cols:5, rows:6, limit:180, preview:2 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `카드 ${c.sets * c.g + c.bombs + c.jokers}장 · ${c.sets}${c.g === 3 ? '세트' : '쌍'} · ${mmss(c.limit)}${c.missCap ? ' · 실수 ' + c.missCap + '번까지' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.cols}×${c.rows} · ${c.cols * c.rows / 2}쌍`; },
    init(cfg, rng){
      const cols = cfg.cols, rows = cfg.rows, g = cfg.g || 2, bombs = cfg.bombs || 0, jokers = cfg.jokers || 0, twins = cfg.twins || 0;
      const pairs = cfg.sets || cols * rows / 2;
      let cards;
      if(g === 2 && !bombs && !jokers && !twins && pairs * 2 === cols * rows){
        /* 기본(오늘의 문제·대전과 같은 순서로 rng를 쓴다 → 예전 판과 똑같다) */
        const src = cfg.fruit && pairs <= FRUITS.length ? FRUITS.slice() : POOL.slice();
        const syms = shuffle(src, rng).slice(0, pairs);
        cards = shuffle(syms.concat(syms), rng);
      } else {
        /* 닮은꼴: 원래 그림 + 색이 다르고 리본 단 그림을 각각 한 세트로. 조커·폭탄을 더해 섞고, 남는 칸은 마지막 줄 양 끝의 빈자리 */
        const tb = shuffle(Object.keys(SYM).filter(k => k !== 'rainbow'), rng).slice(0, twins);
        const src = (cfg.fruit && pairs <= FRUITS.length ? FRUITS.slice() : POOL.slice()).filter(k => !tb.includes(k));
        const syms = tb.flatMap(k => [k, k + ALT]).concat(shuffle(src, rng).slice(0, pairs - 2 * twins));
        const deck = [];
        syms.forEach(k => { for(let r = 0; r < g; r++) deck.push(k); });
        for(let r = 0; r < bombs; r++) deck.push(BOMB);
        for(let r = 0; r < jokers; r++) deck.push(JOKER);
        const dealt = shuffle(deck, rng), total = cols * rows, gaps = total - dealt.length, lastN = cols - gaps, lo = (rows - 1) * cols + Math.floor(gaps / 2);
        cards = []; let q = 0;
        for(let i = 0; i < total; i++){ const inLast = i >= (rows - 1) * cols; cards.push(gaps > 0 && inLast && (i < lo || i >= lo + lastN) ? null : dealt[q++]); }
      }
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { cols, rows, g, pairs, cards, st:cards.map(c => c ? 0 : 3), open:[], lock:false, found:0, flips:0, misses:0, combo:0, best:0, pen:0, booms:0, jokerUsed:0, fail:null,
        phase:'deal', preview:cfg.preview == null ? 2.5 : cfg.preview, boss:!!cfg.boss, shuf:!!cfg.shuffle, tick:cfg.tick || 0, missCap:cfg.missCap || 0,
        mj:cfg.mj || [], tw:cfg.tw || null, tips, seen:new Set(), sinceSwap:0, swaps:0, rng, lastSec:-1, sec:0, timers:new Set() };
      G.limit = cfg.limit;
      const m = G.m;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
        document.querySelectorAll('.fxcombo').forEach(e => e.remove());
      };
      /* 테스트용: 남은 짝을 차례로 모두 맞힌다 */
      m._solveForTest = (missFirst = 0) => new Promise(res => {
        const step = () => {
          if(G.over || G.m !== m || m.phase !== 'play'){ res(m.found); return; }
          if(m.lock){ setTimeout(step, 60); return; }
          const down = m.st.map((s, i) => s === 0 && !isSpecial(m.cards[i]) ? i : -1).filter(i => i >= 0);
          if(!down.length){ res(m.found); return; }
          if(missFirst > 0){ const b = down.find(j => m.cards[j] !== m.cards[down[0]]); missFirst--; tap(down[0]); tap(b); }
          else { const a = down[0]; down.filter(j => m.cards[j] === m.cards[a]).slice(0, m.g).forEach(j => tap(j)); }
          setTimeout(step, 80);
        };
        step();
      });
    },
    _solveForTest(missFirst){ return G.m._solveForTest(missFirst); },
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-memory">
        <div class="hud-row mm-hud">
          <div class="hchip" aria-label="찾은 짝"><span class="hv"><span class="mm-ic">${ICO.pair}</span><b id="mmFound">0</b><small>/${m.pairs}${m.g === 3 ? '세트' : '쌍'}</small></span><em>찾은 짝</em></div>
          <div class="hchip time mm-time" id="mmTimeP" aria-label="남은 시간"><span class="hv"><span class="mm-ic">${ICO.clock}</span><b id="mmTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
          <div class="hchip" aria-label="뒤집은 횟수"><span class="hv"><span class="mm-ic">${ICO.flip}</span><b id="mmFlips">0</b><small>번</small></span><em>뒤집은 수</em></div>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="mm-rules" aria-label="켜진 규칙">${m.boss ? '<span class="mm-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="mm-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="mm-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}${m.missCap ? `<span class="mm-chip miss" id="mmMiss"></span>` : ''}</div>` : ''}
        <div class="mm-barw" id="mmBarWrap"><i id="mmBar"></i></div>
        <div class="mm-msg" id="mmMsg"><span>카드를 나눠 주는 중…</span></div>
        <div class="mm-board" id="bd" role="grid" aria-label="카드 판"></div>
      </div>`;
      build(); hud();
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m ? m.found / m.pairs : 0; },
    lossText(){ const m = G.m; return (m.fail === 'miss' ? '허용 실수를 넘었어요. ' : '') + `짝 ${m.found}/${m.pairs}${m.g === 3 ? '세트' : '쌍'}을 찾았어요.`; },
    score(){
      const m = G.m, sec = Math.min(G.limit, (m.sec || elapsed()) + (m.pen || 0));
      const time = Math.max(0, 350 - Math.floor(sec * 350 / G.limit));
      const extra = Math.max(0, Math.round(150 * (1 - m.misses / (1.5 * m.pairs * (m.g === 3 ? 1.6 : 1)))));
      return { base:500, time, extra, rows:['짝 모두 찾기', '시간 보너스 (' + mmss(sec) + ')', '틀린 뒤집기 ' + m.misses + '번'] };
    },
    stars(){ const m = G.m, f = m.g === 3 ? 1.6 : 1; return m.misses <= m.pairs * .5 * f ? 3 : m.misses <= m.pairs * 1.2 * f ? 2 : 1; },
    css:`
body[data-mode="memory"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.22) 0 3px, transparent 3.5px) 0 0/46px 46px,
  linear-gradient(180deg,#FFE0C9 0%,#FFB8A8 55%,#FF8F9E 100%) fixed}
.ng-memory{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-memory .mm-hud{margin:0}
.ng-memory .mm-ic{width:20px; height:20px; flex:none; display:block}
.ng-memory .mm-ic svg{width:100%; height:100%; display:block}
.ng-memory .mm-time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-memory .mm-time.hurry em{color:#fff}
.ng-memory .mm-time.hurry b{text-shadow:0 2px 0 #8E0F2F}
.ng-memory .mm-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid #1A0F45; overflow:hidden}
.ng-memory .mm-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#9EF0B8,#27B86A); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-memory .mm-barw.pv i{background:linear-gradient(180deg,#FFB3D4,#F0368A)}
.ng-memory .mm-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-memory .mm-msg{height:40px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#7A3050; white-space:nowrap}
.ng-memory .mm-msg b{font-family:var(--heavy); font-weight:400; font-size:21px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px}
.ng-memory .mm-msg b.boss{color:#FFE27A}
.ng-memory .mm-msg b.bad{color:#FF8A8F}
.ng-memory .mm-msg.mm-remember b{color:#FFE27A; font-size:24px; animation:memory-bob .9s ease-in-out infinite alternate}
.ng-memory .mm-msg.mm-remember, .ng-memory .mm-msg.mm-shuffle, .ng-memory .mm-msg.mm-win, .ng-memory .mm-msg.mm-fail{animation:memory-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-memory .mm-msg.mm-win b{font-size:26px; color:#FFE27A}
@keyframes memory-bob{to{transform:translateY(-2px) scale(1.05)}}
@keyframes memory-in{from{transform:scale(.6); opacity:0}}
.ng-memory .mm-board{display:grid; gap:var(--gap); padding:var(--pad); border-radius:22px; justify-content:center;
  background:repeating-linear-gradient(0deg, rgba(255,120,150,.16) 0 12px, transparent 12px 24px), repeating-linear-gradient(90deg, rgba(255,120,150,.16) 0 12px, transparent 12px 24px), #FFF3EC;
  border:3px solid #1A0F45; box-shadow:inset 0 0 0 3px rgba(255,255,255,.75), 0 5px 0 #1A0F45, 0 14px 22px rgba(120,20,60,.25); touch-action:manipulation}
.ng-memory .mm-card{position:relative; width:var(--cw); height:var(--ch); perspective:600px; -webkit-tap-highlight-color:transparent; outline:none; border-radius:calc(var(--cw) * .16)}
.ng-memory .mm-card:focus-visible{box-shadow:0 0 0 3px #FFE27A, 0 0 0 6px #1A0F45}
.ng-memory .mm-card.in{animation:memory-deal .42s cubic-bezier(.2,1.5,.4,1) var(--d) both}
@keyframes memory-deal{from{transform:translateY(-24px) scale(.3) rotate(-10deg); opacity:0}}
.ng-memory .mm-pop{position:absolute; inset:0; display:block}
.ng-memory .mm-in{position:absolute; inset:0; display:block; transform-style:preserve-3d; transition:transform .3s cubic-bezier(.3,1.35,.5,1)}
.ng-memory .mm-card.wave .mm-in{transition-delay:var(--d)}
.ng-memory .mm-card.up .mm-in{transform:rotateY(180deg)}
.ng-memory .mm-face{position:absolute; inset:0; display:grid; place-items:center; border-radius:calc(var(--cw) * .16); border:2.5px solid #1A0F45; backface-visibility:hidden; -webkit-backface-visibility:hidden; overflow:hidden;
  box-shadow:inset 0 2px 0 rgba(255,255,255,.55), inset 0 -4px 0 rgba(0,0,0,.12), 0 3px 0 #1A0F45}
.ng-memory .mm-back{background:repeating-linear-gradient(135deg, rgba(255,255,255,.13) 0 6px, transparent 6px 13px), radial-gradient(circle at 30% 20%, #C6A8FF 0%, rgba(198,168,255,0) 60%), linear-gradient(160deg,#A77BFF 0%,#6C3CE0 70%,#5427B8 100%)}
.ng-memory .mm-back::before{content:""; position:absolute; inset:4px; border-radius:calc(var(--cw) * .1); border:2px dashed rgba(255,255,255,.4)}
.ng-memory .mm-emb{width:52%; height:auto; position:relative; filter:drop-shadow(0 2px 0 rgba(26,15,69,.35))}
.ng-memory .mm-front{transform:rotateY(180deg); background:linear-gradient(180deg,#FFFDF6 0%,#FFF1D8 100%)}
.ng-memory .mm-front svg{width:88%; height:auto; max-height:88%; display:block; overflow:visible}
.ng-memory .mm-card.bad .mm-front{background:linear-gradient(180deg,#FFE8E8,#FFC6C8); box-shadow:inset 0 0 0 3px #E5484D, 0 3px 0 #1A0F45}
.ng-memory .mm-card.ok .mm-front{background:linear-gradient(180deg,#FFFBE0,#FFEDB0); box-shadow:inset 0 0 0 3px #FFC93C, 0 3px 0 #1A0F45, 0 0 14px 3px rgba(255,214,90,.85)}
.ng-memory .mm-card.ok .mm-pop{animation:memory-pop .5s cubic-bezier(.2,1.6,.4,1)}
@keyframes memory-pop{0%{transform:scale(1)} 35%{transform:scale(1.18) rotate(-4deg)} 70%{transform:scale(.96) rotate(2deg)} 100%{transform:scale(1)}}
.ng-memory .mm-card.ok::after{content:""; position:absolute; right:-5px; top:-5px; width:18px; height:18px; border-radius:50%; background:#27B86A url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'%3E%3Cpath d='M4.5 9.5l3 3 6-7' fill='none' stroke='%23fff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/100% no-repeat; border:2px solid #1A0F45; animation:memory-in .35s .2s cubic-bezier(.2,1.6,.4,1) both; z-index:2}
.ng-memory .mm-card.left .mm-front{background:linear-gradient(180deg,#EFE9F5,#DCD2E8)}
.ng-memory .mm-card.left .mm-front svg{opacity:.75}
.ng-memory .mm-card.moving{z-index:3}
.ng-memory .mm-card.moving .mm-back{box-shadow:inset 0 2px 0 rgba(255,255,255,.55), 0 0 0 3px #FFE27A, 0 8px 14px rgba(26,15,69,.35)}
.ng-memory .mm-card.cheer .mm-pop{animation:memory-cheer .6s cubic-bezier(.2,1.6,.4,1) var(--d) both}
.ng-memory .mm-gap{width:var(--cw); height:var(--ch)}
.ng-memory .mm-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-memory .mm-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#3A2261; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-memory .mm-chip.mj{background:#FFE7F0; color:#B0214F}
.ng-memory .mm-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-memory .mm-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
.ng-memory .mm-chip.miss{background:#E6FFF0; color:#15703F}
.ng-memory .mm-chip.miss b{font-family:var(--heavy); font-weight:400; font-size:15px}
.ng-memory .mm-chip.miss.low{background:#FFE3E3; color:#B3122E}
.ng-memory .mm-front.mm-fb{background:radial-gradient(circle at 50% 60%, #FFE1C7 0%, #FFB28A 100%)}
.ng-memory .mm-front.mm-fj{background:linear-gradient(160deg,#FFF6D8 0%,#FFE3F4 50%,#E3ECFF 100%)}
.ng-memory .mm-front .mm-alt{filter:hue-rotate(155deg) saturate(1.35)}
.ng-memory .mm-front .mm-bow{position:absolute; top:5%; right:4%; width:38%; height:auto; max-height:none; filter:drop-shadow(0 1px 0 rgba(26,15,69,.4)); z-index:1}
.ng-memory .mm-card.fuse .mm-pop{animation:memory-fuse .33s ease-in-out}
@keyframes memory-fuse{0%,100%{transform:none} 25%{transform:scale(1.1) rotate(-6deg)} 75%{transform:scale(1.1) rotate(6deg)}}
.ng-memory .mm-card.boomed .mm-front{background:radial-gradient(circle,#6B5A5A 0%,#3A2F3F 100%)}
.ng-memory .mm-card.boomed .mm-front svg{opacity:.35; filter:grayscale(1)}
.ng-memory .mm-card.boomed{opacity:.55}
.ng-memory .mm-card.ok.jk .mm-front{background:linear-gradient(160deg,#FFF1A8,#FFC6EA 50%,#C9DAFF)}
@keyframes memory-cheer{0%{transform:none} 40%{transform:translateY(-10px) scale(1.1)} 100%{transform:none}}
@media (max-width:370px){ .ng-memory .mm-chip{font-size:12px; padding:4px 7px} .ng-memory .mm-rules{gap:4px} .ng-memory .mm-msg b{font-size:19px} }
@media (prefers-reduced-motion: reduce){ .ng-memory .mm-in{transition-duration:.01s} .ng-memory .mm-card.in, .ng-memory .mm-card.ok .mm-pop, .ng-memory .mm-card.cheer .mm-pop, .ng-memory .mm-msg b{animation:none} }
`,
    sounds:{
      memoryFlip(o){ aNoise({ ft:'bandpass', f:o.n === 2 ? 3000 : 2400, f2:1400, q:1.4, d:.06, v:.07 }); aTone({ f:o.n === 2 ? 880 : 740, f2:o.n === 2 ? 1180 : 980, type:'triangle', d:.07, v:.05 }); },
      memoryMatch(o){ const n = Math.min(10, o.n || 0); aBell({ f:penta(n + 3, 72), d:.7, v:.09, idx:1.4, rev:.35 }); aBell({ f:penta(n + 5, 72), t:.08, d:.8, v:.08, idx:1.2, rev:.4 }); aTone({ f:penta(n + 3, 60), type:'triangle', d:.18, v:.06 }); aNoise({ ft:'highpass', f:6500, t:.05, d:.25, v:.035 }); if(n >= 2) aSparkle({ root:84 + Math.min(7, n), n:4, t:.14, v:.035 }); },
      memoryMiss(){ aTone({ f:330, f2:220, type:'triangle', d:.2, v:.1 }); aTone({ f:311, f2:208, type:'triangle', t:.02, d:.2, v:.06 }); aThump({ f:140, f2:70, d:.14, v:.12 }); },
      memoryGo(){ aWhoosh({ f:2600, f2:600, a:.03, d:.25, v:.05 }); for(let k = 0; k < 5; k++) aNoise({ ft:'bandpass', f:2600, q:2, t:.03 + k * .04, d:.03, v:.035 }); aBell({ f:m2f(84), t:.2, d:.5, v:.06, rev:.3 }); },
      memoryTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); aTone({ f:o.hi ? 1760 : 1320, t:.06, d:.03, v:.02, bus:'ui' }); },
      memoryShuffle(){ aWhoosh({ f:500, f2:3200, q:1.2, a:.05, d:.35, v:.06 }); for(let k = 0; k < 7; k++) aNoise({ ft:'bandpass', f:rnd(1800, 3200), q:2, t:.05 + k * .07, d:.035, v:.04 }); aTone({ f:520, f2:780, t:.5, d:.12, v:.05, type:'triangle' }); },
      memoryFuse(){ aNoise({ ft:'highpass', f:3500, d:.3, v:.05 }); aTone({ f:1200, f2:1800, type:'square', lp:2500, d:.25, v:.03 }); },
      memoryBoom(){ aThump({ f:110, f2:35, d:.5, v:.35 }); aNoise({ ft:'lowpass', f:1400, f2:200, d:.6, v:.16 }); aTone({ f:220, f2:90, type:'sawtooth', lp:900, d:.35, v:.06 }); },
      memoryTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); aBell({ f:m2f(67), t:.1, d:.9, v:.05, rev:.4 }); }
    },
    gate:{ memoryFlip:35, memoryTick:250, memoryMatch:60 },
    jingle(){ [0, 2, 4, 5, 7].forEach((d, i) => aMarimba(penta(d + 2, 72), { t:i * .075, v:.16 })); [76, 79, 84, 88].forEach((mm, i) => aBell({ f:m2f(mm), t:.42 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.5, n:6 }); }
  };
})();


/* 대전: AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
Object.assign(NG.memory, { duelPace:[70,.74], duelStat:{ unit:'쌍',             get:() => ({ v:G.m.found, t:G.m.pairs }) } });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.memory.scene = { kind:'petals', colors:['#FFFFFF','#FFC2DA','#FFE3A3'], density:1 };
