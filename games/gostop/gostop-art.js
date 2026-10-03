/* 고스톱 화투 그림 (games/gostop) — 직접 그린 오리지널 SVG, viewBox 100×150
   전통 화투의 월별 구도(1월 송학·2월 매조·3월 벚꽃 … 12월 비)를 따르되, 특정 회사 인쇄본 그림은 베끼지 않는다.
   그라데이션·클립 id는 쓰지 않는다(같은 그림이 화면에 여러 번 나와도 안전하게). 단색 면 + 얇은 검은 선 = 실물 화투 인쇄 느낌. */
const GSART = (() => {
  const K = '#1A1212', RED = '#D9261C', RED2 = '#A8160F', CRM = '#FBF3DF', PAP = '#F7ECD2', GRN = '#139447', GRN2 = '#0B6532', LGRN = '#7CC04B',
    YEL = '#F6C21B', ORG = '#F08A1D', PUR = '#5B2C91', LPUR = '#9567C9', BLU = '#1F57B5', PNK = '#F6AFC6', BRN = '#6B4226', WHT = '#FFFFFF', GRY = '#8A8A8A';
  const st = (w = 1.4, c = K) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const R = (n, k) => Math.round(n * 10) / 10;
  const rot = (x, y, a) => `rotate(${a} ${x} ${y})`;

  /* ----- 바탕·하늘 ----- */
  const BASE = (bg = CRM) => `<rect x="1" y="1" width="98" height="148" rx="9" fill="${bg}"/>`;
  const SKY = (col, h) => `<path d="M5 ${h}V9a4 4 0 0 1 4-4h82a4 4 0 0 1 4 4v${h - 9}z" fill="${col}"/>`;
  const EDGE = `<rect x="1.5" y="1.5" width="97" height="147" rx="8.5" fill="none" stroke="#2A1810" stroke-width="2.6"/><rect x="5" y="5" width="90" height="140" rx="4.5" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`;

  /* ----- 표시: 월 숫자 · 光 · 쌍피 ----- */
  const NUM = m => `<circle cx="13.5" cy="13.5" r="8" fill="${K}" stroke="${CRM}" stroke-width="1.6"/><text x="13.5" y="17.6" font-size="${m > 9 ? 9.5 : 11}" font-weight="900" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${m}</text>`;
  const HIKARI = `<circle cx="84" cy="15" r="10.5" fill="${WHT}" stroke="${RED}" stroke-width="2.6"/><text x="84" y="20.3" font-size="14.5" font-weight="900" text-anchor="middle" fill="${RED}" font-family="'Noto Serif KR','Noto Serif CJK KR','Batang',serif">光</text>`;
  const DOUBLE = `<g transform="translate(83 136)"><rect x="-12" y="-7" width="24" height="13" rx="6.5" fill="${PUR}" stroke="${CRM}" stroke-width="1.4"/><text x="0" y="3.6" font-size="9.5" font-weight="900" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">쌍피</text></g>`;

  /* ----- 띠: 매듭 + 길게 늘어진 천, 끝은 제비 꼬리 ----- */
  function ribbon(col, t1, t2, x = 47, y = 16, a = -6, tc = K){
    return `<g transform="translate(${x} ${y}) rotate(${a})">
      <path d="M-11 4h22v76l-11-8-11 8z" fill="${col}" ${st(1.5)}/>
      <path d="M-11 4h22" stroke="${K}" stroke-width="1.5"/><path d="M-8 9v62M8 9v62" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>
      <path d="M-13 -2h26l-2 7h-22z" fill="${col}" ${st(1.4)}/><circle cx="0" cy="1.5" r="3" fill="${col}" ${st(1.2)}/>
      ${t1 ? `<text x="0" y="31" font-size="15" font-weight="900" text-anchor="middle" fill="${tc}" font-family="'Noto Serif KR','Batang',serif">${t1}</text><text x="0" y="51" font-size="15" font-weight="900" text-anchor="middle" fill="${tc}" font-family="'Noto Serif KR','Batang',serif">${t2}</text>` : ''}
    </g>`;
  }

  /* ===== 1월 송학 ===== */
  function needles(cx, cy, w, h, fill = GRN){
    let s = `<path d="M${cx - w / 2} ${cy}Q${cx - w / 2} ${cy - h} ${cx} ${cy - h}Q${cx + w / 2} ${cy - h} ${cx + w / 2} ${cy}z" fill="${fill}" ${st(1.4)}/>`;
    for(let i = 1; i < 9; i++){ const t = i / 9, ang = Math.PI * (1 - t); s += `<path d="M${cx} ${cy}L${R(cx + Math.cos(ang) * w * .47)} ${R(cy - Math.sin(ang) * h * .92)}" stroke="${GRN2}" stroke-width="1.3"/>`; }
    return s + `<path d="M${cx - w / 2 + 1} ${cy}h${w - 2}" stroke="${K}" stroke-width="2.4"/>`;
  }
  function pine(v){
    if(v === 2){ const t2 = 'M16 146C20 126 12 110 24 94C32 84 28 70 36 60';
      return `<path d="${t2}" fill="none" stroke="${K}" stroke-width="10"/><path d="${t2}" fill="none" stroke="${BRN}" stroke-width="6.5"/>${[[30, 70, 40, 18], [18, 96, 30, 15], [36, 112, 34, 15], [20, 134, 30, 14]].map(c => needles(...c)).join('')}`; }
    const tr = v === 1 ? 'M44 146C40 124 52 112 46 96C40 80 56 66 50 50C46 38 56 30 60 22' : 'M30 146C36 128 24 112 38 96C50 82 44 66 58 52C66 44 64 34 72 26';
    const cl = v === 1 ? [[48, 56, 50, 22], [30, 82, 46, 20], [66, 92, 44, 20], [44, 112, 52, 22], [70, 34, 36, 16], [26, 130, 36, 16]] : [[58, 58, 46, 20], [32, 84, 48, 22], [70, 96, 40, 18], [44, 116, 50, 22], [76, 36, 34, 15], [24, 104, 30, 14]];
    return `<path d="${tr}" fill="none" stroke="${K}" stroke-width="11"/><path d="${tr}" fill="none" stroke="${BRN}" stroke-width="7.5"/><path d="${tr}" fill="none" stroke="#8C5A33" stroke-width="2" stroke-dasharray="3 5"/>${cl.map(c => needles(...c)).join('')}`;
  }
  function crane(){
    return `<g transform="translate(52 108)">
      <path d="M-6 18l-4 26M4 18l3 26" stroke="${K}" stroke-width="2.4"/><path d="M-14 44h8M4 44h8" stroke="${K}" stroke-width="2"/>
      <path d="M-32 6C-26-14 4-18 20-6C26-1 24 10 14 16C2 22-20 20-32 6z" fill="${WHT}" ${st(1.6)}/>
      <path d="M-32 6l-12 6 6-12-8-2 14-4z" fill="${K}"/>
      <path d="M-24 4C-14-6 2-8 14-2M-20 10C-10 4 2 4 12 8" fill="none" stroke="${GRY}" stroke-width="1.2"/>
      <path d="M-30 4C-22 0-14 2-8 6C-16 10-24 10-30 4z" fill="${K}"/>
      <path d="M16-6C26-22 26-40 16-56" fill="none" stroke="${K}" stroke-width="8"/><path d="M15-10C23-24 22-38 15-50" fill="none" stroke="${WHT}" stroke-width="2.6"/>
      <ellipse cx="15" cy="-59" rx="6.5" ry="5.5" fill="${WHT}" ${st(1.4)}/><circle cx="14" cy="-63" r="3.2" fill="${RED}"/><circle cx="17" cy="-59.5" r="1.1" fill="${K}"/>
      <path d="M20-59l14 3-14 1z" fill="#C9A24A" ${st(1)}/>
    </g>`;
  }

  /* ===== 2월 매조 ===== */
  function plumFlower(x, y, r, c = RED){
    let s = '';
    for(let i = 0; i < 5; i++){ const a = i * 72 - 90; s += `<circle cx="${R(x + Math.cos(a * Math.PI / 180) * r * .62)}" cy="${R(y + Math.sin(a * Math.PI / 180) * r * .62)}" r="${R(r * .5)}" fill="${c}" ${st(1)}/>`; }
    return s + `<circle cx="${x}" cy="${y}" r="${R(r * .32)}" fill="${YEL}" ${st(.8)}/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${R(x + Math.cos(a * Math.PI / 180) * r * .3)}" cy="${R(y + Math.sin(a * Math.PI / 180) * r * .3)}" r=".8" fill="${K}"/>`).join('')}`;
  }
  function plum(){
    const br = 'M6 146L22 120L16 104L38 84L32 66L56 46L50 30L76 14';
    const tw = 'M38 84L62 78L70 64M56 46L78 50L88 40M22 120L46 118';
    return `<path d="${br}" fill="none" stroke="${K}" stroke-width="9"/><path d="${br}" fill="none" stroke="#3A2416" stroke-width="5.5"/><path d="${tw}" fill="none" stroke="${K}" stroke-width="4.5"/><path d="${tw}" fill="none" stroke="#3A2416" stroke-width="2"/>
      ${[[22, 118, 11], [40, 82, 12], [58, 46, 11], [76, 16, 9], [68, 64, 10], [86, 40, 8], [46, 118, 9], [30, 66, 8], [12, 104, 7]].map(p => plumFlower(...p)).join('')}
      ${[[50, 30], [88, 52], [64, 80], [16, 132]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="4.2" fill="${RED}" ${st(1)}/>`).join('')}`;
  }
  function warbler(){
    return `<g transform="translate(50 74) rotate(-12)">
      <path d="M-26 8l-14 10 6-14z" fill="#5E6F1E" ${st(1.2)}/>
      <path d="M-28 6C-24-10 0-16 16-8C24-4 24 8 14 14C0 20-18 18-28 6z" fill="#9AAE2E" ${st(1.6)}/>
      <path d="M-14 12C-4 16 8 14 14 10C8 4-4 4-14 12z" fill="#E8E2A6"/>
      <path d="M-24 4C-12-8 4-8 10-2C2 2-12 6-24 4z" fill="#6E8020" ${st(1)}/>
      <circle cx="14" cy="-8" r="9" fill="#9AAE2E" ${st(1.5)}/><circle cx="17" cy="-10" r="2" fill="${K}"/><circle cx="17.6" cy="-10.6" r=".6" fill="#fff"/>
      <path d="M22-8l9 1-9 3z" fill="${K}"/><path d="M-4 16l-2 8M4 16l2 8" stroke="${K}" stroke-width="2"/>
    </g>`;
  }

  /* ===== 3월 벚꽃 ===== */
  function sakura(x, y, r){
    let s = '';
    for(let i = 0; i < 5; i++){ const a = i * 72; s += `<path transform="${rot(x, y, a)}" d="M${x} ${y}C${x - r * .7} ${y - r * .5} ${x - r * .55} ${y - r * 1.05} ${x - r * .14} ${y - r}L${x} ${y - r * .82}L${x + r * .14} ${y - r}C${x + r * .55} ${y - r * 1.05} ${x + r * .7} ${y - r * .5} ${x} ${y}z" fill="#FDE3EC" stroke="#D1477A" stroke-width=".9"/>`; }
    return s + `<circle cx="${x}" cy="${y}" r="${R(r * .26)}" fill="${RED}"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${R(x + Math.cos(a * Math.PI / 180) * r * .42)}" cy="${R(y + Math.sin(a * Math.PI / 180) * r * .42)}" r=".9" fill="${YEL}"/>`).join('')}`;
  }
  function cherry(lowCut){
    const cl = [[22, 30, 20], [52, 22, 22], [80, 34, 18], [34, 56, 21], [66, 54, 22], [18, 80, 16], [84, 76, 15], [50, 82, 18]].filter(c => !lowCut || c[1] < 70);
    let s = cl.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${R(r * .8)}" fill="${PNK}" ${st(1.2, '#C9557F')}/>`).join('');
    const fl = [[14, 22, 7], [28, 34, 7.5], [44, 18, 7], [60, 26, 8], [80, 28, 7], [24, 54, 7.5], [42, 52, 7], [60, 58, 8], [78, 52, 7], [88, 76, 6.5], [16, 80, 6.5], [50, 80, 7], [70, 78, 6.5], [34, 70, 6]].filter(c => !lowCut || c[1] < 70);
    s += fl.map(p => sakura(...p)).join('');
    if(!lowCut) s += `<path d="M46 148C48 124 40 108 50 96" fill="none" stroke="${K}" stroke-width="8"/><path d="M46 148C48 124 40 108 50 96" fill="none" stroke="#4A2C1A" stroke-width="5"/>`;
    return s;
  }
  function curtain(){
    let s = `<path d="M5 78h90v58a9 9 0 0 1-9 9H14a9 9 0 0 1-9-9z" fill="${WHT}" ${st(1.6)}/>`;
    for(let i = 0; i < 9; i++) if(i % 2 === 0) s += `<rect x="${5 + i * 10}" y="78" width="10" height="${i === 0 || i === 8 ? 58 : 67}" fill="${RED}"/>`;
    s += `<path d="M5 78h90" stroke="${K}" stroke-width="1.6"/><rect x="3" y="70" width="94" height="9" rx="2" fill="${K}"/>${[14, 32, 50, 68, 86].map(x => `<circle cx="${x}" cy="74.5" r="2.4" fill="${YEL}"/>`).join('')}`;
    s += `<circle cx="50" cy="108" r="13" fill="${WHT}" ${st(1.6)}/><path d="M50 97l3 8h8l-6 5 2 8-7-5-7 5 2-8-6-5h8z" fill="${PUR}"/>`;
    return s + `<path d="M5 78Q28 92 50 78Q72 92 95 78" fill="none" stroke="${K}" stroke-width="1.4"/>`;
  }

  /* ===== 4월 흑싸리 ===== */
  function wisteria(){
    let s = `<path d="M8 12Q50 2 94 16" fill="none" stroke="${K}" stroke-width="4"/>`;
    const xs = [16, 30, 44, 58, 72, 86];
    xs.forEach((x, i) => {
      const len = 60 + (i % 3) * 22, y0 = 10 + Math.abs(i - 2.5) * 1.6;
      s += `<path d="M${x} ${y0}Q${x + 3} ${y0 + len / 2} ${x - 2} ${y0 + len}" fill="none" stroke="${K}" stroke-width="1.4"/>`;
      for(let k = 0; k < Math.floor(len / 9); k++){ const yy = y0 + 6 + k * 9, side = k % 2 ? 1 : -1; s += `<path transform="${rot(x, yy, side * 35)}" d="M${x} ${yy}c${side * 2}-3 ${side * 8}-3 ${side * 10} 0c${-side * 2} 3 ${-side * 8} 3 ${-side * 10} 0z" fill="${K}"/>`; }
      s += `<circle cx="${x - 2}" cy="${y0 + len + 3}" r="2.6" fill="${RED}" ${st(.8)}/>`;
    });
    return s;
  }
  function cuckoo(){
    return `<path d="M60 30A16 16 0 1 0 82 50 13 13 0 1 1 60 30z" fill="${YEL}" ${st(1.4)}/>
      <g transform="translate(46 98) rotate(-18)">
      <path d="M-30 4l-16-6 6 8-6 8z" fill="#2E2A3A" ${st(1.2)}/>
      <path d="M-4-4C-14-26-6-38 10-44C6-30 8-18 4-6z" fill="#3B3550" ${st(1.4)}/>
      <path d="M-30 4C-22-8 4-12 22-4C28 0 26 8 18 12C4 16-18 14-30 4z" fill="#3B3550" ${st(1.6)}/>
      <path d="M-20 8C-8 12 6 12 16 8" fill="none" stroke="#E8E0D0" stroke-width="2.4"/>
      <circle cx="22" cy="-4" r="8" fill="#3B3550" ${st(1.4)}/><circle cx="25" cy="-5" r="2" fill="${RED}"/><path d="M29-3l9 2-9 2z" fill="${YEL}" ${st(.8)}/>
      <path d="M-6 4C2-12 16-20 30-22C24-10 14-2 2 6z" fill="#4B4466" ${st(1.4)}/></g>`;
  }

  /* ===== 5월 난초(창포) ===== */
  function iris(){
    let s = '';
    [[10, 148, 24, 50], [22, 148, 18, 30], [36, 148, 42, 44], [56, 148, 50, 36], [72, 148, 80, 52], [88, 148, 94, 64], [64, 148, 68, 70]].forEach(([x1, y1, x2, y2]) => {
      s += `<path d="M${x1 - 3} ${y1}Q${(x1 + x2) / 2 - 8} ${(y1 + y2) / 2} ${x2} ${y2}Q${(x1 + x2) / 2 + 2} ${(y1 + y2) / 2} ${x1 + 3} ${y1}z" fill="${GRN}" ${st(1.2)}/><path d="M${x1} ${y1}Q${(x1 + x2) / 2 - 3} ${(y1 + y2) / 2} ${x2} ${y2}" fill="none" stroke="${GRN2}" stroke-width="1"/>`;
    });
    const flower = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})">
      <path d="M0 6C-4-8-2-20 0-24C2-20 4-8 0 6z" fill="${LPUR}" ${st(1.2)}/>
      <path d="M0 4C-10-6-18-6-22 2C-16 10-8 12 0 4z" fill="${PUR}" ${st(1.3)}/><path d="M0 4C10-6 18-6 22 2C16 10 8 12 0 4z" fill="${PUR}" ${st(1.3)}/>
      <path d="M0 6C-6 14-6 24-2 30C2 24 4 14 0 6z" fill="${PUR}" ${st(1.3)}/>
      <path d="M-4 2l-10 0M4 2l10 0M0 10v12" stroke="${YEL}" stroke-width="2"/><path d="M-4 2l-10 0M4 2l10 0" stroke="${WHT}" stroke-width=".8"/>
      <path d="M0 30v20" stroke="${GRN2}" stroke-width="2.4"/></g>`;
    return s + flower(26, 30, 1) + flower(70, 40, 1.05) + flower(50, 66, .85);
  }
  function bridge(){
    let s = '';
    [[2, 92, 34, 84], [30, 84, 66, 98], [62, 98, 98, 88]].forEach(([x1, y1, x2, y2]) => {
      const dx = x2 - x1, dy = y2 - y1;
      for(let k = 0; k < 7; k++){ const t = k / 7, x = x1 + dx * t, y = y1 + dy * t; s += `<path d="M${R(x)} ${R(y)}l${R(dx / 7)} ${R(dy / 7)}l0 14l${R(-dx / 7)} ${R(-dy / 7)}z" fill="${k % 2 ? '#C8873C' : '#D99A4E'}" ${st(1.1)}/>`; }
      s += `<path d="M${x1} ${y1 + 14}L${x2} ${y2 + 14}" stroke="${K}" stroke-width="1.6"/><path d="M${x1 + 4} ${y1 + 14}v18M${x2 - 4} ${y2 + 14}v18" stroke="${K}" stroke-width="3"/>`;
    });
    return s;
  }

  /* ===== 6월 모란 ===== */
  function peony(x, y, r){
    let s = `<circle cx="${x}" cy="${y}" r="${r}" fill="${RED2}" ${st(1.5)}/>`;
    for(let ring = 0; ring < 3; ring++){
      const rr = r * (1 - ring * .27), n = 7 - ring;
      for(let i = 0; i < n; i++){ const a = (i / n) * 360 + ring * 20; s += `<path transform="${rot(x, y, a)}" d="M${x} ${y - rr * .25}C${x - rr * .55} ${y - rr * .5} ${x - rr * .45} ${y - rr * 1.02} ${x} ${y - rr * .98}C${x + rr * .45} ${y - rr * 1.02} ${x + rr * .55} ${y - rr * .5} ${x} ${y - rr * .25}z" fill="${ring === 0 ? RED : ring === 1 ? '#EE4D6E' : '#F9839B'}" stroke="${K}" stroke-width=".9"/>`; }
    }
    return s + `<circle cx="${x}" cy="${y}" r="${R(r * .22)}" fill="${YEL}" ${st(1)}/>`;
  }
  function peonyLeaf(x, y, a, sc = 1){
    return `<g transform="translate(${x} ${y}) rotate(${a}) scale(${sc})"><path d="M0 0C-6-8-18-10-24-6C-20-14-12-22-2-20C-4-28 4-34 10-30C12-22 10-12 6-4C14-8 22-4 24 4C14 6 6 4 0 0z" fill="${GRN2}" ${st(1.3)}/><path d="M0 0L-16-10M0 0L4-24M0 0L18 2" stroke="${LGRN}" stroke-width="1.1"/></g>`;
  }
  function peonies(){
    return `${peonyLeaf(20, 118, -20, 1.3)}${peonyLeaf(78, 124, 30, 1.25)}${peonyLeaf(50, 140, 0, 1.1)}${peonyLeaf(16, 74, -60, 1)}${peonyLeaf(86, 82, 60, 1)}
      <path d="M48 148V100M48 112Q30 104 28 90M48 118Q66 108 70 94" fill="none" stroke="${GRN2}" stroke-width="3"/>${peony(32, 72, 22)}${peony(70, 84, 19)}${peony(52, 40, 17)}`;
  }
  function butterflies(){
    const bf = (x, y, a, c1, c2) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0C-10-18-26-14-22 0C-26 10-12 18 0 4z" fill="${c1}" ${st(1.3)}/><path d="M0 0C10-18 26-14 22 0C26 10 12 18 0 4z" fill="${c1}" ${st(1.3)}/><circle cx="-12" cy="-4" r="3.6" fill="${c2}" ${st(.8)}/><circle cx="12" cy="-4" r="3.6" fill="${c2}" ${st(.8)}/><path d="M0-6v14" stroke="${K}" stroke-width="3"/><path d="M0-6l-6-8M0-6l6-8" stroke="${K}" stroke-width="1"/></g>`;
    return bf(30, 28, -15, YEL, BLU) + bf(74, 46, 20, '#7FC6F2', ORG);
  }

  /* ===== 7월 홍싸리 ===== */
  function clover(){
    let s = '';
    const stems = ['M4 146C20 96 46 66 92 40', 'M14 148C34 116 58 98 94 90', 'M2 110C18 78 30 48 60 18'];
    stems.forEach(d => { s += `<path d="${d}" fill="none" stroke="#5A2F1C" stroke-width="2.2"/>`; });
    const pts = [[20, 112], [30, 96], [42, 84], [56, 72], [70, 60], [84, 48], [34, 124], [48, 112], [64, 104], [80, 96], [12, 90], [20, 70], [30, 52], [42, 36], [54, 24]];
    pts.forEach(([x, y], i) => {
      s += `<g transform="${rot(x, y, -30 + (i % 3) * 25)}">${[-6, 0, 6].map(d => `<ellipse cx="${x + d}" cy="${y - 5}" rx="2.6" ry="4.8" fill="${i % 2 ? '#D3215A' : RED}" ${st(.8)}/>`).join('')}</g>`;
      s += `<g transform="${rot(x + 4, y + 6, 40 - (i % 4) * 30)}"><ellipse cx="${x + 4}" cy="${y + 8}" rx="2.4" ry="4.4" fill="${GRN}" ${st(.7)}/><ellipse cx="${x + 9}" cy="${y + 6}" rx="2.4" ry="4.4" fill="${GRN}" ${st(.7)}/></g>`;
    });
    return s;
  }
  function boar(){
    return `<g transform="translate(50 112)">
      <path d="M-34 6l-6 18h6l4-12M-18 12l-2 18h6l2-16M14 12l2 18h6l0-18M28 6l6 16h6l-4-18" fill="${K}"/>
      <path d="M-40 0C-38-20-18-30 8-28C26-26 40-16 44-2C46 8 38 16 24 16H-24C-36 16-40 10-40 0z" fill="#8A4A24" ${st(1.8)}/>
      <path d="M-30-18C-20-30 6-34 26-24" fill="none" stroke="${K}" stroke-width="5" stroke-dasharray="2 2.5"/>
      <path d="M36-12C46-10 52-4 54 4C48 8 42 8 38 4z" fill="#6E3818" ${st(1.4)}/><ellipse cx="53" cy="2" rx="3.2" ry="4" fill="#E8B49A" ${st(1)}/>
      <path d="M44 6c4 2 8 0 10-4" fill="none" stroke="${WHT}" stroke-width="2.4"/><circle cx="38" cy="-8" r="2" fill="${K}"/><circle cx="38.6" cy="-8.6" r=".6" fill="#fff"/>
      <path d="M28-20l4-8 4 8z" fill="#6E3818" ${st(1.2)}/><path d="M-40 0c-6 0-8-4-6-8" fill="none" stroke="${K}" stroke-width="2"/>
    </g>`;
  }

  /* ===== 8월 공산 ===== */
  function hill(sky){
    let s = sky ? `<path d="M5 96V9a4 4 0 0 1 4-4h82a4 4 0 0 1 4 4v87z" fill="${sky}"/>` : '';
    s += `<path d="M5 84Q30 46 58 60Q80 70 95 58V141a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="${K}"/>`;
    for(let i = 0; i < 26; i++){ const x = 8 + i * 3.4, y = 70 + Math.abs(Math.sin(i * 1.7)) * 30 + (i % 3) * 14; s += `<path d="M${R(x)} ${R(y + 16)}Q${R(x + 2)} ${R(y + 6)} ${R(x + 6)} ${R(y)}" fill="none" stroke="${i % 4 ? '#E9E3D3' : '#BFB6A0'}" stroke-width="1"/>`; }
    return s;
  }

  /* ===== 9월 국진 ===== */
  function mum(x, y, r){
    let s = '';
    for(let ring = 0; ring < 2; ring++){ const n = ring ? 14 : 18, rr = ring ? r * .7 : r; for(let i = 0; i < n; i++){ const a = i * 360 / n + ring * 10; s += `<path transform="${rot(x, y, a)}" d="M${x} ${y}C${x - rr * .16} ${y - rr * .4} ${x - rr * .14} ${y - rr * .9} ${x} ${y - rr}C${x + rr * .14} ${y - rr * .9} ${x + rr * .16} ${y - rr * .4} ${x} ${y}z" fill="${ring ? '#FFD84A' : YEL}" stroke="#9A6A00" stroke-width=".8"/>`; } }
    return s + `<circle cx="${x}" cy="${y}" r="${R(r * .2)}" fill="${ORG}" ${st(1)}/>`;
  }
  function mums(){
    const lf = (x, y, a) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 0C-8-6-16-4-18 2C-12 2-10 8-14 12C-6 12 0 8 0 4C2 10 8 12 14 10C10 6 12 0 18-2C12-6 4-6 0 0z" fill="${GRN2}" ${st(1.2)}/>`;
    return `<path d="M30 148Q34 110 30 76M30 110Q50 96 66 70M30 124Q16 110 14 96" fill="none" stroke="${GRN2}" stroke-width="2.6"/>${lf(22, 116, -20)}${lf(46, 104, 15)}${lf(16, 136, 30)}${lf(58, 128, -10)}${mum(30, 66, 22)}${mum(68, 64, 18)}${mum(14, 92, 12)}`;
  }
  function sakeCup(){
    return `<g transform="translate(54 112)">
      <path d="M-16 20h32l-4 10h-24z" fill="${RED2}" ${st(1.4)}/>
      <path d="M-34-12h68C32 8 18 20 0 20S-32 8-34-12z" fill="${RED}" ${st(1.8)}/>
      <ellipse cx="0" cy="-12" rx="34" ry="8" fill="#B5130C" ${st(1.6)}/><ellipse cx="0" cy="-12" rx="29" ry="5.6" fill="${YEL}" ${st(1)}/>
      ${mum(0, 4, 9).replace(/YEL/g, '')}
      <path d="M-26-2C-14 8 14 8 26-2" fill="none" stroke="${YEL}" stroke-width="1.6"/>
    </g>`;
  }

  /* ===== 10월 단풍 ===== */
  function maple(x, y, s, a, col){
    const p = [];
    for(let i = 0; i < 7; i++){ const ang = (-90 + (i - 3) * 30) * Math.PI / 180, r1 = i === 3 ? 13 : i === 0 || i === 6 ? 8 : 11; p.push([Math.cos(ang) * r1, Math.sin(ang) * r1]); const ang2 = (-90 + (i - 2.5) * 30) * Math.PI / 180; if(i < 6) p.push([Math.cos(ang2) * 4.5, Math.sin(ang2) * 4.5]); }
    const d = 'M0 4L' + p.map(q => R(q[0]) + ' ' + R(q[1])).join('L') + 'z';
    return `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="${d}" fill="${col}" ${st(1.1 / s)}/><path d="M0 4V12M0 3L0-10M0 3L-8-6M0 3L8-6" stroke="${K}" stroke-width="${.7 / s}"/></g>`;
  }
  function maples(){
    const cols = [RED, '#E8401C', ORG, RED2, '#E25822'];
    const pos = [[20, 20, 1.2, -10], [44, 14, 1.1, 15], [70, 22, 1.25, -20], [86, 44, 1, 10], [30, 42, 1.15, 25], [58, 40, 1.3, -5], [14, 66, 1, -30], [42, 68, 1.2, 20], [72, 66, 1.15, -15], [88, 86, 1, 30], [24, 92, 1.1, 5], [56, 92, 1.05, -25]];
    return `<path d="M4 4Q40 50 30 146M30 60Q60 70 96 100M20 30Q50 20 96 8" fill="none" stroke="#4A2C1A" stroke-width="1.8"/>${pos.map((q, i) => maple(q[0], q[1], q[2], q[3], cols[i % cols.length])).join('')}`;
  }
  function deer(){
    return `<g transform="translate(50 112)">
      <path d="M-24 8l-4 28M-14 10l-2 26M16 10l2 26M24 6l6 28" stroke="${K}" stroke-width="3.4"/>
      <path d="M-30 0C-30-14-14-18 4-16C18-14 28-10 30 2C30 12 20 14 6 14H-20C-28 14-30 8-30 0z" fill="#B87333" ${st(1.8)}/>
      ${[[-20, -6], [-10, -10], [0, -6], [10, -10], [-14, 2], [4, 4], [16, -2]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.6" fill="#F4E3C3"/>`).join('')}
      <path d="M-30-2l-6-6 4 10z" fill="#F4E3C3" ${st(1)}/>
      <path d="M22-12C24-26 30-34 38-38C42-32 40-24 32-14z" fill="#B87333" ${st(1.6)}/>
      <path d="M32-40C36-46 44-46 46-40C44-36 38-34 32-36z" fill="#B87333" ${st(1.4)}/><circle cx="40" cy="-41" r="1.4" fill="${K}"/><circle cx="46.4" cy="-39.6" r="1.4" fill="${K}"/>
      <path d="M34-44C30-54 22-58 16-56M30-50l-6-6M36-44C40-56 50-58 54-54M44-54l2-8" fill="none" stroke="#5A3618" stroke-width="2.6"/>
      <path d="M30-42l-6-2 4 5z" fill="#B87333" ${st(1)}/>
    </g>`;
  }

  /* ===== 11월 오동 ===== */
  function paulownia(tint, low){
    const lc = tint ? '#E8A21B' : '#1E1A16', vc = tint ? '#FFE48A' : '#6E6658', fc = tint ? RED : LPUR;
    const leaf = (x, y, a, s) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M0 0C-22-4-30-26-18-40C-10-48 0-44 0-36C0-44 10-48 18-40C30-26 22-4 0 0z" fill="${lc}" ${st(1.4 / s)}/><path d="M0 0V-38M0-12L-14-22M0-12L14-22M0-24L-10-34M0-24L10-34" stroke="${vc}" stroke-width="${1.3 / s}"/></g>`;
    if(low) return `${leaf(24, 141, -30, .85)}${leaf(76, 141, 30, .85)}${leaf(50, 140, 0, .8)}`;
    let s = `<path d="M50 148V72" stroke="${K}" stroke-width="4"/>${leaf(28, 140, -25, 1.2)}${leaf(74, 142, 25, 1.2)}${leaf(50, 120, 0, 1.15)}${leaf(22, 104, -50, .9)}${leaf(80, 106, 50, .9)}`;
    s += `<path d="M50 74V30" stroke="${K}" stroke-width="2"/>`;
    for(let k = 0; k < 8; k++){ const y = 34 + k * 5; s += `<circle cx="${45 + (k % 2) * 10}" cy="${y}" r="3.4" fill="${fc}" ${st(.9)}/><circle cx="50" cy="${y + 2}" r="2.6" fill="${tint ? YEL : PUR}" ${st(.8)}/>`; }
    return s;
  }
  function phoenix(){
    return `<path d="M5 100V9a4 4 0 0 1 4-4h82a4 4 0 0 1 4 4v91z" fill="${RED}"/>
      <g transform="translate(44 66) scale(1.22)">
      <path d="M-8 10C-30 4-44 18-46 40C-36 30-24 28-14 30z" fill="${GRN}" ${st(1.4)}/>
      <path d="M-6 14C-24 18-34 36-30 56C-22 42-12 36-2 34z" fill="${BLU}" ${st(1.4)}/>
      <path d="M0 16C-6 34 0 50 12 60C12 46 10 34 8 24z" fill="${PUR}" ${st(1.4)}/>
      <path d="M-14-8C-16 8-4 18 10 16C20 14 24 4 20-6C14-18-8-22-14-8z" fill="${YEL}" ${st(1.6)}/>
      <path d="M-8 0C0 8 10 8 16 2" fill="none" stroke="${ORG}" stroke-width="2"/>
      <path d="M12-10C14-26 26-32 34-26C34-18 28-12 20-8z" fill="${GRN}" ${st(1.4)}/>
      <circle cx="30" cy="-30" r="8" fill="${YEL}" ${st(1.4)}/><path d="M24-36C22-46 30-50 34-44M30-38C32-48 40-50 42-44" fill="none" stroke="${RED2}" stroke-width="3"/>
      <circle cx="32" cy="-31" r="1.8" fill="${K}"/><path d="M37-30l8 3-8 2z" fill="${ORG}" ${st(.8)}/><path d="M32-24c2 4 0 8-2 10" fill="none" stroke="${RED}" stroke-width="2.4"/>
      <path d="M-30 20c-8 4-12 12-10 20M-24 26c-6 6-6 14-2 20" fill="none" stroke="${YEL}" stroke-width="1.4"/>
      </g>`;
  }

  /* ===== 12월 비 ===== */
  const rainLines = (c = '#7D93B5', n = 14) => { let s = ''; for(let i = 0; i < n; i++){ const x = 8 + ((i * 37) % 86), y = 8 + ((i * 53) % 120); s += `<path d="M${x} ${y}l-5 14" stroke="${c}" stroke-width="1.4"/>`; } return s; };
  function willow(x0 = 92){
    let s = `<path d="M${x0} 4C${x0 - 16} 14 ${x0 - 26} 30 ${x0 - 30} 60" fill="none" stroke="${K}" stroke-width="3"/>`;
    for(let i = 0; i < 7; i++){ const x = x0 - 6 - i * 5, y = 8 + i * 6; s += `<path d="M${x} ${y}C${x - 6} ${y + 30} ${x - 4} ${y + 60} ${x - 10} ${y + 90}" fill="none" stroke="${GRN}" stroke-width="1.8"/>`; for(let k = 0; k < 7; k++) s += `<ellipse cx="${R(x - 2 - k * 1.1)}" cy="${R(y + 10 + k * 12)}" rx="1.4" ry="4" fill="${GRN2}"/>`; }
    return s;
  }
  function umbrellaMan(){
    return `${rainLines('#9AA9C2', 10)}
      <path d="M5 112Q40 100 95 116V141a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="#3B5FA0"/><path d="M8 122q10-4 20 0t20 0t20 0t20 0" fill="none" stroke="#BFD3F2" stroke-width="1.4"/>
      ${willow(94)}
      <g transform="translate(40 62)">
      <path d="M-26-10A28 22 0 0 1 30-10z" fill="${RED}" ${st(1.8)}/>${[-18, -6, 6, 18].map(x => `<path d="M2-32L${x}-10" stroke="${K}" stroke-width="1"/>`).join('')}<path d="M2-32V40" stroke="${K}" stroke-width="1.8"/>
      <circle cx="-4" cy="0" r="7" fill="#F4D4B0" ${st(1.4)}/><path d="M-11-4C-10-12 2-12 3-4z" fill="${K}"/>
      <path d="M-18 8C-14 4 6 4 8 8L12 46H-22z" fill="${PUR}" ${st(1.6)}/><path d="M-16 20h26M-18 32h28" stroke="${YEL}" stroke-width="1.6"/>
      <path d="M8 12l-2 12" stroke="#F4D4B0" stroke-width="3"/>
      <path d="M-20 46l-2 6h8M4 46l2 6h-8" stroke="${K}" stroke-width="2"/>
      </g>
      <g transform="translate(72 122)"><ellipse cx="0" cy="0" rx="9" ry="6" fill="${LGRN}" ${st(1.3)}/><circle cx="-4" cy="-6" r="2.6" fill="${LGRN}" ${st(1)}/><circle cx="4" cy="-6" r="2.6" fill="${LGRN}" ${st(1)}/><circle cx="-4" cy="-6" r="1" fill="${K}"/><circle cx="4" cy="-6" r="1" fill="${K}"/><path d="M-9 4l-5 4M9 4l5 4" stroke="${K}" stroke-width="1.6"/></g>`;
  }
  function swallow(){
    return `${willow(96)}${rainLines('#9AA9C2', 8)}
      <g transform="translate(44 80) rotate(-20)">
      <path d="M-20 4L-46 0L-30 8L-48 16L-20 10z" fill="#1B2440" ${st(1.2)}/>
      <path d="M-6-4C-14-26-6-44 12-52C8-34 10-18 4-4z" fill="#1B2440" ${st(1.4)}/>
      <path d="M-22 6C-14-6 8-10 22-2C26 2 24 8 18 10C4 14-12 14-22 6z" fill="#1B2440" ${st(1.6)}/>
      <path d="M-12 8C0 12 12 10 18 6" fill="none" stroke="${WHT}" stroke-width="3"/>
      <circle cx="22" cy="-2" r="6.4" fill="#1B2440" ${st(1.3)}/><path d="M24 2c2 2 2 4 0 6" fill="none" stroke="${RED}" stroke-width="3"/><circle cx="24" cy="-3" r="1.2" fill="#fff"/><path d="M28-1l6 1-6 2z" fill="${K}"/>
      <path d="M-2 0C8-20 22-28 36-30C30-16 20-6 8 2z" fill="#26325A" ${st(1.4)}/></g>`;
  }
  function rainRibbon(){ return `${willow(94)}${rainLines('#9AA9C2', 12)}${ribbon(RED, '', '', 44, 22, -14)}<path d="M36 38l6 6 6-6 6 6M36 52l6 6 6-6 6 6M36 66l6 6 6-6 6 6" fill="none" stroke="${WHT}" stroke-width="1.4" transform="rotate(-14 44 22)"/>`; }
  function thunder(){
    return `<rect x="5" y="5" width="90" height="140" rx="4.5" fill="#2A2830"/>${rainLines('#6C7A94', 18)}
      <path d="M70 10l-12 22h10l-14 24" fill="none" stroke="${YEL}" stroke-width="3"/><path d="M24 14l-8 16h7l-10 18" fill="none" stroke="${YEL}" stroke-width="2.4"/>
      <g transform="translate(50 92)">
      <circle r="28" fill="${RED}" ${st(2)}/><circle r="22" fill="${K}"/><circle r="17" fill="${WHT}"/>
      ${[0, 120, 240].map(a => `<path transform="rotate(${a})" d="M0 0C0-10 8-16 14-10C10-12 4-8 4 0z" fill="${K}"/><circle transform="rotate(${a})" cx="0" cy="-8" r="3.6" fill="${K}"/>`).join('')}
      ${[...Array(12)].map((_, i) => `<circle transform="rotate(${i * 30})" cx="0" cy="-25" r="1.6" fill="${YEL}"/>`).join('')}
      <path d="M-28 28h56l-6 10h-44z" fill="${BRN}" ${st(1.4)}/></g>`;
  }

  /* ===== 보너스 · 빈 패 · 뒷면 ===== */
  function bonus(pv){
    return `<rect x="5" y="5" width="90" height="140" rx="4.5" fill="${YEL}"/><rect x="11" y="11" width="78" height="128" rx="3" fill="none" stroke="${RED}" stroke-width="2"/>
      <g transform="translate(50 62)">${[...Array(12)].map((_, i) => `<path transform="rotate(${i * 30})" d="M0-34l4 12h-8z" fill="${ORG}"/>`).join('')}<circle r="22" fill="${RED}" ${st(1.8)}/><circle r="16" fill="none" stroke="${YEL}" stroke-width="1.6"/><text y="8" font-size="22" font-weight="900" text-anchor="middle" fill="${YEL}" font-family="'Noto Serif KR','Batang',serif">福</text></g>
      <text x="50" y="112" font-size="15" font-weight="900" text-anchor="middle" fill="${K}" font-family="system-ui,sans-serif">보너스</text>
      <text x="50" y="130" font-size="12" font-weight="900" text-anchor="middle" fill="${RED}" font-family="system-ui,sans-serif">${pv === 3 ? '쓰리피 +3' : '쌍피 +2'}</text>`;
  }
  const DUMMY_ART = `<rect x="5" y="5" width="90" height="140" rx="4.5" fill="#E4DEE9"/><circle cx="50" cy="72" r="22" fill="#2E2838" ${st(1.8)}/><path d="M64 54l10-12" stroke="${K}" stroke-width="3"/><circle cx="76" cy="40" r="4.6" fill="${ORG}"/><circle cx="76" cy="40" r="2" fill="${YEL}"/><circle cx="42" cy="64" r="5" fill="#fff" opacity=".35"/><text x="50" y="124" font-size="14" font-weight="900" text-anchor="middle" fill="#5A4E6A" font-family="system-ui,sans-serif">넘기기</text>`;
  function back(){
    let s = `<rect x="1" y="1" width="98" height="148" rx="9" fill="#A3141B"/><rect x="7" y="7" width="86" height="136" rx="5" fill="none" stroke="#E7B54A" stroke-width="1.6"/>`;
    for(let i = -6; i < 12; i++) s += `<path d="M${7 + i * 12} 7l136 136M${93 - i * 12} 7l-136 136" stroke="#8C0F15" stroke-width="2.4"/>`;
    s += `<rect x="7" y="7" width="86" height="136" rx="5" fill="none" stroke="#A3141B" stroke-width="0"/>`;
    s += `<g transform="translate(50 75)"><circle r="24" fill="#A3141B" stroke="#E7B54A" stroke-width="2"/>${[0, 72, 144, 216, 288].map(a => `<ellipse transform="rotate(${a})" cx="0" cy="-11" rx="7" ry="10" fill="#E7B54A"/>`).join('')}<circle r="6" fill="#A3141B" stroke="#E7B54A" stroke-width="1.6"/></g>`;
    return s + `<rect x="1.5" y="1.5" width="97" height="147" rx="8.5" fill="none" stroke="#2A1810" stroke-width="2.6"/>`;
  }

  /* ===== 한 장 그리기: 월(m) · 몇 번째(k) ===== */
  const MONTH = {
    1:k => k === 0 ? `${SKY(RED, 92)}<circle cx="60" cy="40" r="19" fill="#FFE08A" ${st(1.6)}/><circle cx="60" cy="40" r="13" fill="#F7A71B"/>${pine(2)}${crane().replace('translate(52 108)', 'translate(60 106)')}` : k === 1 ? `${pine(k)}${ribbon(RED, '홍', '단')}` : `${k === 3 ? SKY(RED, 44) : ''}${pine(k % 2)}`,
    2:k => k === 0 ? `${plum()}${warbler()}` : k === 1 ? `${plum()}${ribbon(RED, '홍', '단', 52, 20, 8)}` : `${k === 3 ? SKY(RED, 40) : ''}${plum()}`,
    3:k => k === 0 ? `${SKY('#F3D7A6', 80)}${cherry(true)}${curtain()}` : k === 1 ? `${cherry()}${ribbon(RED, '홍', '단', 50, 34, -4)}` : `${k === 3 ? SKY(RED, 46) : ''}${cherry()}`,
    4:k => k === 0 ? `${wisteria()}${cuckoo()}` : k === 1 ? `${wisteria()}${ribbon(RED, '', '', 50, 30, 6)}` : wisteria(),
    5:k => k === 0 ? `${iris()}${bridge()}` : k === 1 ? `${iris()}${ribbon(RED, '', '', 52, 40, -6)}` : iris(),
    6:k => k === 0 ? `${peonies()}${butterflies()}` : k === 1 ? `${peonies()}${ribbon(BLU, '청', '단', 50, 14, 6, WHT)}` : peonies(),
    7:k => k === 0 ? `${clover()}${boar()}` : k === 1 ? `${clover()}${ribbon(RED, '', '', 52, 22, 10)}` : clover(),
    8:k => k === 0 ? `${hill(RED)}<circle cx="50" cy="40" r="26" fill="#FFF6D6" ${st(1.8)}/>` : k === 1 ? `${hill(YEL)}${[[30, 30], [52, 20], [72, 34]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M-12 2C-8-6-2-6 0 0C2-6 8-6 12 2C8 0 2 2 0 4C-2 2-8 0-12 2z" fill="${K}"/><circle cx="0" cy="1" r="2" fill="${K}"/></g>`).join('')}` : hill(k === 3 ? '#F2E2C2' : null),
    9:k => k === 0 ? `${mums()}${sakeCup()}` : k === 1 ? `${mums()}${ribbon(BLU, '청', '단', 54, 16, 4, WHT)}` : `${k === 3 ? SKY(RED, 40) : ''}${mums()}`,
    10:k => k === 0 ? `${maples()}${deer()}` : k === 1 ? `${maples()}${ribbon(BLU, '청', '단', 52, 30, -8, WHT)}` : maples(),
    11:k => k === 0 ? `${phoenix()}${paulownia(false, true)}` : k === 1 ? `${SKY('#FFF1C4', 146)}${paulownia(true)}` : paulownia(false),
    12:k => k === 0 ? umbrellaMan() : k === 1 ? swallow() : k === 2 ? rainRibbon() : thunder()
  };
  /* c = 게임의 패 정보(C[id]) */
  function face(c){
    if(c.bonus) return BASE(CRM) + bonus(c.pv) + EDGE;
    const art = MONTH[c.m](c.k);
    return BASE(c.m === 12 && c.k === 3 ? '#2A2830' : CRM) + art + NUM(c.m) + (c.g ? HIKARI : '') + (c.pv === 2 ? DOUBLE : '') + EDGE;
  }
  return { face, back:back(), dummy:BASE('#E4DEE9') + DUMMY_ART + EDGE, VB:'0 0 100 150' };
})();
