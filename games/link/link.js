/* 짝 잇기 */
/* ===== 짝 잇기 (link) · 하루퍼즐 리그 게임 모듈 =====
   판 위의 같은 그림 타일 두 개를 "두 번까지 꺾이는 길"로 이어 지운다. 길은 빈칸과 판 바깥 테두리로만 지나갈 수 있다.
   모든 판은 거꾸로 쌓기(지울 수 있는 짝을 차례로 놓기)로 만들어 처음 상태에서는 반드시 다 지울 수 있다.
   그림은 전부 직접 그린 오리지널 SVG(굵은 외곽선 #1A0F45 + 밝은 색). */
NG.link = (() => {
  const OL = '#1A0F45';
  const O = `stroke="${OL}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const O2 = `stroke="${OL}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  const HL = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''} fill="#fff" opacity=".7"/>`;
  const starPath = (cx, cy, R, r, n = 5) => { let d = ''; for(let i = 0; i < n * 2; i++){ const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); } return d + 'z'; };
  const poly = (cx, cy, r, n, rot = -90) => Array.from({ length:n }, (_, i) => { const a = (rot + i * 360 / n) * Math.PI / 180; return (cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1); }).join(' ');

  /* ----- 타일 그림: [이름, 대표색, SVG 내용(64×64)] — 모양과 색이 모두 달라 한눈에 구분되게 ----- */
  const SYM = {
    sun:['해', '#FF9A1F', `${Array.from({ length:8 }, (_, i) => `<path d="M29.5 4h5l-2.5 9z" transform="rotate(${i * 45} 32 32)" fill="#FFC93C" ${O2}/>`).join('')}<circle cx="32" cy="32" r="15" fill="#FF9A1F" ${O}/>${HL(26, 26, 3, 4.5, 30)}`],
    moon:['달', '#9B7BFF', `<path d="M40 7A26 26 0 1 0 57 45 21 21 0 1 1 40 7z" fill="#9B7BFF" ${O}/><path d="M19 22c-3 5-4 11-2 16" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".75"/>`],
    star:['별', '#FFD12E', `<path d="${starPath(32, 34, 27, 12)}" fill="#FFD12E" ${O}/><path d="${starPath(32, 34, 15, 7)}" fill="#FFF0A0"/>`],
    heart:['하트', '#F0368A', `<path d="M32 55C17 45 7 36 7 24c0-8 6-14 13-14 5 0 9 3 12 7 3-4 7-7 12-7 7 0 13 6 13 14 0 12-10 21-25 31z" fill="#F0368A" ${O}/><path d="M15 22c0-4 3-7 6-7" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" opacity=".85"/>`],
    cloud:['구름', '#7CCBFF', `<path d="M16 48h33a11 11 0 0 0 3-21.5 15 15 0 0 0-28-5A11 11 0 0 0 16 48z" fill="#7CCBFF" ${O}/><path d="M22 27a9 9 0 0 1 8-5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".85"/>`],
    drop:['물방울', '#2F7BFF', `<path d="M32 6C24 19 14 29 14 40a18 18 0 0 0 36 0C50 29 40 19 32 6z" fill="#2F7BFF" ${O}/>${HL(25, 39, 3.4, 7, 15)}`],
    leaf:['나뭇잎', '#3DBE5A', `<path d="M10 54C8 30 24 10 54 10c2 28-16 46-44 44z" fill="#3DBE5A" ${O}/><path d="M12 52L44 20M24 40h12M30 34V22" fill="none" stroke="#1F7F3A" stroke-width="2.6" stroke-linecap="round"/>`],
    flower:['꽃', '#FF8FC8', `${[0, 72, 144, 216, 288].map(a => `<ellipse cx="32" cy="17" rx="9" ry="12" transform="rotate(${a} 32 32)" fill="#FF8FC8" ${O}/>`).join('')}<circle cx="32" cy="32" r="8.5" fill="#FFD93D" ${O}/>`],
    mushroom:['버섯', '#FF4D3D', `<path d="M23 40h18c1 6 1 12-2 16H25c-3-4-3-10-2-16z" fill="#FFF1D6" ${O}/><path d="M7 37c0-14 11-25 25-25s25 11 25 25c0 3-3 4-6 4H13c-3 0-6-1-6-4z" fill="#FF4D3D" ${O}/><circle cx="32" cy="21" r="4.5" fill="#fff"/><circle cx="19" cy="30" r="3.6" fill="#fff"/><circle cx="45" cy="30" r="3.6" fill="#fff"/>`],
    apple:['사과', '#E8203F', `<path d="M32 19c-4-3-12-4-17 1-6 6-4 18 1 25 4 6 9 9 13 7 2-1 4-1 6 0 4 2 9-1 13-7 5-7 7-19 1-25-5-5-13-4-17-1z" fill="#E8203F" ${O}/><path d="M32 19c0-4 1-8 3-11" fill="none" ${O}/><path d="M35 13c4-5 11-6 15-3-2 5-9 7-15 3z" fill="#2EAA4A" ${O2}/>${HL(21, 29, 3.6, 7, 20)}`],
    cherry:['체리', '#C3123A', `<path d="M22 40C24 27 29 17 38 10M43 40C41 28 40 19 38 10" fill="none" stroke="#3E7A22" stroke-width="3.2" stroke-linecap="round"/><circle cx="21" cy="45" r="10.5" fill="#C3123A" ${O}/><circle cx="43" cy="45" r="10.5" fill="#C3123A" ${O}/><circle cx="17.5" cy="41.5" r="3" fill="#fff" opacity=".75"/><circle cx="39.5" cy="41.5" r="3" fill="#fff" opacity=".75"/>`],
    lemon:['레몬', '#FFE34D', `<path d="M7 35c3-1 4-3 5-6 4-9 13-13 21-12 9 1 16 7 19 14 1 2 3 3 5 4-3 1-4 3-5 6-4 9-13 13-21 12-9-1-16-7-19-14-1-2-3-3-5-4z" fill="#FFE34D" ${O}/><path d="M17 29c3-6 9-8 14-8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>`],
    carrot:['당근', '#FF7A1A', `<path d="M42 18L12 54c-2 2 0 4 2 3l38-27c4-3 4-9 0-12-3-2-7-2-10 0z" fill="#FF7A1A" ${O}/><path d="M28 34l5 4M22 42l4 3M34 26l4 3" stroke="#C24E00" stroke-width="2.4" stroke-linecap="round"/><path d="M46 18c0-8 4-12 10-12-1 6-4 10-10 12zM46 18c6-3 11-2 14 2-5 3-10 2-14-2z" fill="#3DBE5A" ${O2}/>`],
    fish:['물고기', '#1FC3C9', `<path d="M46 32l13-11v22z" fill="#FF9A1F" ${O}/><path d="M6 32c6-11 17-15 28-13 7 1 11 6 13 13-2 7-6 12-13 13-11 2-22-2-28-13z" fill="#1FC3C9" ${O}/><path d="M30 22c3 6 3 14 0 20" fill="none" stroke="#0E8F99" stroke-width="2.4" stroke-linecap="round"/><circle cx="17" cy="29" r="3" fill="${OL}"/>`],
    bell:['종', '#F2B705', `<path d="M32 8c-11 0-17 9-17 20v10l-6 9h46l-6-9V28c0-11-6-20-17-20z" fill="#F2B705" ${O}/><circle cx="32" cy="53" r="5" fill="#B07A00" ${O2}/><path d="M22 26c0-6 3-10 8-11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>`],
    crown:['왕관', '#FFB020', `<path d="M8 22l12 12 12-20 12 20 12-12-5 30H13z" fill="#FFB020" ${O}/><rect x="13" y="46" width="38" height="8" rx="2" fill="#E08A00" ${O2}/><circle cx="32" cy="36" r="4" fill="#E8203F" ${O2}/>`],
    gem:['보석', '#22B8E8', `<path d="M14 24l9-12h18l9 12-18 30z" fill="#22B8E8" ${O}/><path d="M14 24h36M23 12l9 42M41 12l-9 42M23 12l-3 12M41 12l3 12" fill="none" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/><path d="M24 17l-3 5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`],
    snow:['눈송이', '#8FB8FF', `${[0, 60, 120].map(a => `<path d="M32 6v52M24 12l8 8 8-8M24 52l8-8 8 8" transform="rotate(${a} 32 32)" fill="none" stroke="${OL}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}${[0, 60, 120].map(a => `<path d="M32 6v52M24 12l8 8 8-8M24 52l8-8 8 8" transform="rotate(${a} 32 32)" fill="none" stroke="#8FB8FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}`],
    bolt:['번개', '#FFE600', `<path d="M38 4L12 36h16l-6 24 28-34H34z" fill="#FFE600" ${O}/><path d="M33 12L20 30" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`],
    anchor:['닻', '#2E4FB0', `<circle cx="32" cy="12" r="6" fill="none" stroke="${OL}" stroke-width="7"/><circle cx="32" cy="12" r="6" fill="none" stroke="#2E4FB0" stroke-width="3.4"/><path d="M32 18v38M20 28h24M10 38c2 12 12 18 22 18s20-6 22-18" fill="none" stroke="${OL}" stroke-width="7.5" stroke-linecap="round"/><path d="M32 18v38M20 28h24M10 38c2 12 12 18 22 18s20-6 22-18" fill="none" stroke="#2E4FB0" stroke-width="3.6" stroke-linecap="round"/>`],
    cup:['찻잔', '#A0643C', `<path d="M46 26h4a8 8 0 0 1 0 16h-5" fill="none" stroke="${OL}" stroke-width="7"/><path d="M46 26h4a8 8 0 0 1 0 16h-5" fill="none" stroke="#A0643C" stroke-width="3.4"/><path d="M10 22h38l-4 24c-1 6-6 10-12 10H26c-6 0-11-4-12-10z" fill="#A0643C" ${O}/><path d="M22 6c-3 4 3 6 0 10M32 4c-3 4 3 6 0 10" fill="none" stroke="#B9A6D9" stroke-width="2.6" stroke-linecap="round"/><path d="M16 28l2 14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`],
    balloon:['풍선', '#FF5CA8', `<path d="M32 44c-3 6 4 8 0 16" fill="none" stroke="${OL}" stroke-width="2" stroke-linecap="round"/><path d="M29 47l3-4 3 4z" fill="#D63384" ${O2}/><ellipse cx="32" cy="25" rx="16" ry="19" fill="#FF5CA8" ${O}/>${HL(25, 18, 3.6, 6.5, 25)}`],
    clover:['클로버', '#14A37F', `<path d="M33 34c2 9 5 15 11 22" fill="none" stroke="#0B6B53" stroke-width="3.6" stroke-linecap="round"/>${[0, 120, 240].map(a => `<circle cx="32" cy="19" r="10" transform="rotate(${a} 32 32)" fill="#14A37F" ${O}/>`).join('')}<circle cx="32" cy="32" r="3" fill="#0B6B53"/>`],
    hexa:['벌집', '#FFA62B', `<polygon points="${poly(32, 32, 26, 6, 0)}" fill="#FFA62B" ${O}/><polygon points="${poly(32, 32, 14, 6, 0)}" fill="#FFD27A" ${O2}/>`],
    button:['단추', '#6C5CE7', `<circle cx="32" cy="32" r="25" fill="#6C5CE7" ${O}/><circle cx="32" cy="32" r="17" fill="none" stroke="#A99BFF" stroke-width="3"/>${[[26, 26], [38, 26], [26, 38], [38, 38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${OL}"/>`).join('')}`],
    shell:['조개', '#FF9E8A', `<path d="M32 54L8 30c0-12 11-20 24-20s24 8 24 20z" fill="#FF9E8A" ${O}/><path d="M32 54L18 16M32 54V10M32 54l14-38M32 54L10 26M32 54l22-28" fill="none" stroke="#C85A48" stroke-width="2.2" stroke-linecap="round"/>`],
    tree:['나무', '#2B9348', `<rect x="28" y="40" width="8" height="16" rx="2" fill="#8A5A2B" ${O2}/><path d="M32 6L12 30h8L10 44h44L44 30h8z" fill="#2B9348" ${O}/>`],
    rocket:['로켓', '#E04F5F', `<path d="M32 4c10 8 14 20 12 36H20C18 24 22 12 32 4z" fill="#F4F4F8" ${O}/><circle cx="32" cy="22" r="5" fill="#5BC0EB" ${O2}/><path d="M20 30l-9 12v8l10-6zM44 30l9 12v8l-10-6z" fill="#E04F5F" ${O2}/><path d="M26 42c0 6 3 12 6 16 3-4 6-10 6-16z" fill="#FFB020" ${O2}/>`]
  };
  const POOL = Object.keys(SYM);
  const STONE = '@stone', CLOCK = '@clock', ALT = '~b';   /* 닮은꼴 = 원래 키 + '~b' (색이 다르고 작은 점이 붙음) */
  const CLOCK_SEC = 10;
  const baseOf = k => k && k.endsWith(ALT) ? k.slice(0, -ALT.length) : k;
  const STONE_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 44l6-22 14-10 18 4 8 18-6 14-22 4z" fill="#8E8AA6" ${O}/><path d="M16 24l12 6 6 16M30 30l18-12" fill="none" stroke="#5E5A78" stroke-width="2.4" stroke-linecap="round"/><path d="M18 26l8-6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/></svg>`;
  const CLOCK_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="35" r="22" fill="#5BD08A" ${O}/><circle cx="32" cy="35" r="15.5" fill="#F4FFF6" ${O2}/><rect x="27" y="5" width="10" height="7" rx="2" fill="#1F8A55" ${O2}/><path d="M32 25v10l7 5" fill="none" stroke="${OL}" stroke-width="3.2" stroke-linecap="round"/><text x="47" y="62" font-size="15" font-weight="900" text-anchor="middle" fill="#fff" stroke="${OL}" stroke-width="3.6" paint-order="stroke">+${CLOCK_SEC}</text></svg>`;
  const symSvg = k => {
    if(k === STONE) return STONE_SVG;
    if(k === CLOCK) return CLOCK_SVG;
    const b = baseOf(k), alt = k !== b;
    return `<svg viewBox="0 0 64 64" aria-hidden="true"${alt ? ' class="lk-alt"' : ''}>${SYM[b][2]}</svg>${alt ? '<i class="lk-dot" aria-hidden="true"></i>' : ''}`;
  };
  const symName = k => k === STONE ? '돌' : k === CLOCK ? '시계' : (k.endsWith(ALT) ? '점 찍힌 ' : '') + SYM[baseOf(k)][0];
  const symCol = k => k === CLOCK ? '#5BD08A' : k === STONE ? '#8E8AA6' : SYM[baseOf(k)][1];

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C6 17 2.5 13.6 2.5 9.2 2.5 6.3 4.7 4 7.4 4c1.9 0 3.5 1 4.6 2.6C13.1 5 14.7 4 16.6 4c2.7 0 4.9 2.3 4.9 5.2 0 4.4-3.5 7.8-9.5 11.8z" fill="currentColor" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/></svg>';
  const LIVES = 3;   /* 기본 기회 3번: 세 번째 실수에서 끝 */
  const ICO = {
    pair:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="8" height="10" rx="2" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8"/><rect x="14" y="9" width="8" height="10" rx="2" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8"/><path d="M6 5V2h12v7" fill="none" stroke="#FF9A1F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    mix:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4c4 0 6 10 10 10h3M3 17h4c1.6 0 2.8-1.6 3.8-3.6M13.2 9.6C14.2 8.1 15.4 7 17 7h3" fill="none" stroke="#1A0F45" stroke-width="2.2" stroke-linecap="round"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3" fill="none" stroke="#1A0F45" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['stone', 'twins', 'clock', 'slide'],
    info:{
      stone:{ name:'돌 타일', desc:'지울 수 없는 돌이 길을 막아요. 돌을 피해 두 번까지 꺾이는 길을 찾아요.' },
      twins:{ name:'닮은꼴', desc:'색이 다르고 작은 점이 찍힌 닮은 타일이 섞여 있어요. 색과 점까지 똑같아야 짝이에요.' },
      clock:{ name:'시계 타일', desc:'초록 시계 두 개를 이어 지우면 남은 시간이 ' + CLOCK_SEC + '초 늘어나요. 급할 때 아껴 쓰세요.' },
      slide:{ name:'미끄럼', desc:'짝을 지우면 위에 있던 타일이 아래로 미끄러져 내려와요. 판 모양이 계속 바뀌어요.' }
    },
    twists:['flash', 'bare', 'tight', 'turn1', 'tick'],
    twInfo:{
      flash:{ name:'번개', desc:'타일은 조금 적지만 제한 시간이 아주 짧아요. 빠르게 훑어보세요!' },
      bare:{ name:'맨손', desc:'힌트와 섞기 없이 오직 눈으로 찾아요. (짝이 하나도 없을 때만 저절로 섞여요)' },
      tight:{ name:'외줄 타기', desc:'기회가 딱 한 번! 다른 그림을 고르거나 막힌 짝을 고르면 바로 끝나요.' },
      turn1:{ name:'한 번 꺾기', desc:'이번 판은 길이 한 번까지만 꺾일 수 있어요. 대신 시간은 넉넉해요.' },
      tick:{ name:'째깍 벌칙', desc:'길이 없는 짝을 고를 때마다 남은 시간이 3초씩 줄어요.' }
    }
  };
  const RULE_TIP = { stone:'돌은 피해서', twins:'색·점까지 똑같이', clock:'시계 짝 = +' + CLOCK_SEC + '초', slide:'지우면 위 타일이 내려와요', flash:'시간이 짧아요', bare:'힌트·섞기 없음', tight:'한 번 틀리면 끝', turn1:'한 번만 꺾기', tick:'틀리면 −3초' };

  /* ----- 솔로 난이도 표 -----
     짝 수 = 챕터 1은 LT.ch1[k−1], 챕터 2~는 LT.base[c] + LT.kOff[k] (변주 배수). 판 크기는 gridOf(타일 + 돌).
     제한 시간 = 짝 × LT.spp[c] × kTime[k] × 규칙·변주 배수 (사람 기준 한 짝 약 3~4초 + 여유) */
  const LT = {
    ch1:[16, 18, 20, 18, 24, 16, 20, 22, 18, 26],
    base:[0, 0, 22, 24, 26, 28, 30],
    kOff:[0, -4, -2, 0, 0, 4, -2, 0, 2, -4, 4],
    spp:[0, 5.6, 5.4, 5.2, 5.0, 4.9, 4.8],
    kTime:[0, 1.15, 1.05, 1.0, 1.0, 0.9, 1.1, 1.0, 1.0, 1.1, 0.85],
    mjTime:{ stone:1.12, twins:1.15, clock:0.9, slide:1.1 },
    twPairs:{ flash:0.8, turn1:0.8 }, twTime:{ flash:0.7, bare:1.1, tight:1.05, turn1:1.25, tick:1.1 }
  };
  const gridOf = cells => {
    let best = null;
    for(let c = 4; c <= 8; c++){
      const r = Math.ceil(cells / c); if(r > 11 || r < c - 1) continue;
      const s = (c * r - cells) * 1.5 + Math.abs(r / c - 1.3) * 6;   /* 휴대폰 세로 화면: 세로가 조금 긴 판 */
      if(!best || s < best.s) best = { c, r, s };
    }
    return best ? [best.c, best.r] : [8, Math.ceil(cells / 8)];
  };
  function stageCfg(n){
    const p = planOf('link', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let pairs = c === 1 ? LT.ch1[k - 1] : LT.base[Math.min(c, LT.base.length - 1)] + LT.kOff[k];
    if(tw) pairs *= LT.twPairs[tw] || 1;
    pairs = Math.max(12, Math.min(42, Math.round(pairs)));
    const stones = has('stone') ? Math.min(8, 2 + Math.round(pairs / 6) + (p.boss ? 1 : 0)) : 0;
    const clocks = has('clock') ? (k === 5 || k === 10 ? 2 : 1) : 0;
    const twins = has('twins') ? Math.max(1, Math.min(4, Math.round(pairs / 7))) : 0;
    const turns = tw === 'turn1' ? 1 : 2;
    /* 빈칸 여유: 돌이 있거나 한 번 꺾기면 판에 빈칸을 더 둔다(길이 생기게) */
    const room = turns === 1 ? Math.round(pairs * 2 * .45) : stones ? Math.ceil(stones / 2) + 2 : 2;
    const [cols, rows] = gridOf(pairs * 2 + stones + room);
    let limit = pairs * LT.spp[Math.min(c, LT.spp.length - 1)] * LT.kTime[k];
    mj.forEach(x => { limit *= LT.mjTime[x] || 1; });
    if(tw) limit *= LT.twTime[tw] || 1;
    limit = Math.max(30, Math.round(limit / 5) * 5);
    const hints = tw === 'bare' ? 0 : p.boss ? 2 : 3, mixes = tw === 'bare' ? 0 : 2;
    const lives = tw === 'tight' ? 1 : LIVES;
    return { cols, rows, pairs, stones, clocks, twins, slide:has('slide'), turns, tick:tw === 'tick' ? 3 : 0,
      limit, hints, mixes, lives, boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 길 찾기: 판 바깥 한 줄(테두리)까지 쓰는 확장 좌표에서, 꺾는 횟수 ≤ maxT 인 직선 길 =====
     층(꺾은 횟수)마다 꺾는 점에서 네 방향으로 빈칸을 따라 쭉 뻗는다. 처음 닿은 층이 가장 적게 꺾은 길. */
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function search(b, cols, rows, a, maxT, target){
    const W = cols + 2, H = rows + 2, ex = i => (Math.floor(i / cols) + 1) * W + (i % cols) + 1;
    const free = (x, y) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1 || b[(y - 1) * cols + (x - 1)] == null;
    const A = ex(a), T = target == null ? -1 : ex(target), par = new Map([[A, -1]]), reach = [];
    let front = [A];
    for(let t = 0; t <= maxT && front.length; t++){
      const nx = [];
      for(const p of front){
        const px = p % W, py = Math.floor(p / W);
        for(const [dx, dy] of DIRS){
          let x = px + dx, y = py + dy;
          while(x >= 0 && y >= 0 && x < W && y < H){
            const q = y * W + x;
            if(q === T){ const pts = [q]; let r = p; while(r !== -1){ pts.push(r); r = par.get(r); } return pts.reverse().map(v => [v % W - 1, Math.floor(v / W) - 1]); }
            if(!free(x, y)) break;
            if(!par.has(q)){ par.set(q, p); nx.push(q); if(x > 0 && y > 0 && x < W - 1 && y < H - 1) reach.push((y - 1) * cols + (x - 1)); }
            x += dx; y += dy;
          }
        }
      }
      front = nx;
    }
    return target == null ? reach : null;
  }
  const findPath = (m, a, b) => search(m.b, m.cols, m.rows, a, m.turns, b);
  const same = (x, y) => x != null && x === y && x !== STONE;
  /* 지금 지울 수 있는 짝 하나(없으면 null) */
  function findMove(m){
    const by = {};
    m.b.forEach((k, i) => { if(k != null && k !== STONE) (by[k] = by[k] || []).push(i); });
    for(const k in by){ const L = by[k]; for(let x = 0; x < L.length; x++) for(let y = x + 1; y < L.length; y++){ const p = findPath(m, L[x], L[y]); if(p) return [L[x], L[y], p]; } }
    return null;
  }

  /* ===== 판 만들기(거꾸로 쌓기): 빈 판에서 시작해, 지금 놓인 타일 사이로 이어지는 빈칸 두 곳에 짝을 놓는다.
     마지막에 놓은 짝부터 지우면 언제나 길이 있으므로 처음 판은 반드시 다 지울 수 있다. rng만 쓴다. */
  function deal(cfg, rng){
    const cols = cfg.cols, rows = cfg.rows, N = cols * rows, pairs = cfg.pairs, turns = cfg.turns || 2;
    /* 짝 목록: 그림 하나에 보통 2짝(타일 4개), 닮은꼴은 두 번째 짝을 점 찍힌 타일로, 시계 짝은 따로 */
    const plain = pairs - (cfg.clocks || 0), types = Math.ceil(plain / 2);
    const keys = shuffle(POOL.slice(), rng).slice(0, Math.min(types, POOL.length));
    const list = [];
    for(let i = 0; list.length < plain; i++){ const k = keys[i % keys.length]; list.push(k); if(list.length < plain) list.push(k); }
    const tw = Math.min(cfg.twins || 0, Math.floor(plain / 2));
    for(let t = 0; t < tw; t++){ const k = keys[t]; const j = list.lastIndexOf(k); if(j > list.indexOf(k)) list[j] = k + ALT; }
    for(let c = 0; c < (cfg.clocks || 0); c++) list.push(CLOCK);
    for(let tries = 0; tries < 40; tries++){
      const b = new Array(N).fill(null), order = shuffle(list.slice(), rng);
      /* 돌: 테두리와 바로 붙지 않은 안쪽 칸에, 서로 붙지 않게 */
      let s = 0; const spots = shuffle(Array.from({ length:N }, (_, i) => i).filter(i => { const x = i % cols, y = Math.floor(i / cols); return x > 0 && y > 0 && x < cols - 1 && y < rows - 1; }), rng);
      for(const i of spots){ if(s >= (cfg.stones || 0)) break; const x = i % cols, y = Math.floor(i / cols); if([-1, 0, 1].some(dy => [-1, 0, 1].some(dx => b[(y + dy) * cols + x + dx] === STONE))) continue;   /* 대각선으로도 붙지 않게 → 돌이 칸 하나를 가두지 못한다 */ b[i] = STONE; s++; }
      let ok = true;
      /* 안쪽(테두리에서 먼 칸)부터 채운다: 나중에 놓는 짝(= 먼저 지울 짝)일수록 바깥쪽이라 길이 열려 있다. 남는 빈칸은 바깥쪽에 생긴다 */
      const depth = i => { const x = i % cols, y = Math.floor(i / cols); return Math.min(x, y, cols - 1 - x, rows - 1 - y); };
      const byDepth = list => { const r = shuffle(list, rng); return r.map((i, n) => [depth(i) + rng() * .9, i]).sort((p, q) => q[0] - p[0]).map(p => p[1]); };
      for(const k of order){
        const empt = byDepth(b.map((v, i) => v == null ? i : -1).filter(i => i >= 0));
        let placed = false;
        /* 같은 그림이 바로 옆에 붙는 칸은 피한다(먼저 엄격하게, 안 되면 너그럽게) */
        const nbSame = i => { const x = i % cols, y = Math.floor(i / cols); return (x > 0 && b[i - 1] === k) || (x < cols - 1 && b[i + 1] === k) || (y > 0 && b[i - cols] === k) || (y < rows - 1 && b[i + cols] === k); };
        const near = (i, j) => Math.abs(i % cols - j % cols) + Math.abs(Math.floor(i / cols) - Math.floor(j / cols)) === 1;
        const tryA = empt.filter(i => !nbSame(i)).concat(empt.filter(i => nbSame(i)));
        for(const a of tryA){
          const all = search(b, cols, rows, a, turns, null).filter(j => j !== a), good = all.filter(j => !nbSame(j) && !near(a, j));
          const reach = good.length ? good : all;
          if(!reach.length) continue;
          /* 짝은 멀리 떨어뜨린다(바로 붙은 짝·한눈에 보이는 짝을 줄여 난이도↑): 거리 + 안쪽 + 약간의 운 */
          const ax = a % cols, ay = Math.floor(a / cols);
          const sc = j => Math.abs(j % cols - ax) + Math.abs(Math.floor(j / cols) - ay) + depth(j) * .6 + rng() * 2.5;
          const bb = reach.map(j => [sc(j), j]).sort((p, q) => q[0] - p[0])[0][1];
          b[a] = k; b[bb] = k; placed = true; break;
        }
        if(!placed){ ok = false; break; }
      }
      if(ok) return { b, solvable:true };
      if(tries === 39){ /* 거의 없지만, 끝내 못 만들면 그냥 섞어 놓는다(막히면 저절로 섞기) */
        const cells = shuffle(b.map((v, i) => v === STONE ? -1 : i).filter(i => i >= 0), rng);
        const nb = b.map(v => v === STONE ? STONE : null); order.concat(order).sort().forEach((k, i) => { nb[cells[i]] = k; });
        return { b:nb, solvable:false };
      }
    }
  }

  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const cellEl = i => document.querySelector(`.ng-link .lk-cell[data-i="${i}"]`);

  function hud(){
    const m = S(); if(!m) return;
    const f = $('#lkFound'); if(f) f.textContent = m.found;
    const h = $('#lkHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0; }
    const x = $('#lkMix'); if(x){ x.querySelector('b').textContent = m.mixLeft; x.disabled = m.mixLeft <= 0; }
    const lv = $('#lkLives'); if(lv && !m.lives) lv.hidden = true; else if(lv){ const left = Math.max(0, m.lives - m.misses); lv.innerHTML = Array.from({ length:m.lives }, (_, n) => `<i class="lk-heart${n >= left ? ' off' : ''}">${HEART}</i>`).join(''); lv.classList.toggle('last', left === 1); lv.setAttribute('aria-label', '남은 기회 ' + left + '번'); }
  }
  function msg(html, cls){ const e = $('#lkMsg'); if(!e) return; e.className = 'lk-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">보스 판</b><span>' + (m.tips[0] || '끝까지 집중!') + '</span>';
    if(m.tips.length) return '<span>' + m.tips.slice(0, 2).join(' · ') + '</span>';
    return '<span>같은 그림을 두 번까지 꺾어 이어요</span>';
  }

  function layout(){
    const m = S(), bd = $('#bd'), root = document.querySelector('.ng-link'); if(!bd || !root) return;
    const W = Math.min(root.clientWidth || 360, 460);
    const top = bd.getBoundingClientRect().top + (window.scrollY || 0);
    const H = Math.max(280, (innerHeight || 740) - top - 14);
    const gap = 3, pad = m.cols >= 8 ? 12 : 14;
    let cw = Math.min((W - pad * 2 - gap * (m.cols - 1)) / m.cols, ((H - pad * 2 - gap * (m.rows - 1)) / m.rows - 4) * 0.82, 66);
    cw = Math.max(26, Math.floor(cw)); const ch = Math.floor(cw / 0.82);
    m.geo = { cw, ch, gap, pad };
    bd.style.setProperty('--cw', cw + 'px'); bd.style.setProperty('--ch', ch + 'px'); bd.style.setProperty('--gap', gap + 'px'); bd.style.setProperty('--pad', pad + 'px');
    bd.style.gridTemplateColumns = `repeat(${m.cols}, ${cw}px)`;
  }
  /* 확장 좌표(−1 ~ cols) → 판 안의 픽셀 좌표(테두리 길은 판 가장자리 여백 위로) */
  function px(x, y){
    const g = S().geo, m = S(), bd = $('#bd');
    const bw = bd ? bd.clientWidth : 0, bh = bd ? bd.clientHeight : 0;
    const cx = x < 0 ? g.pad * .5 : x >= m.cols ? bw - g.pad * .5 : g.pad + x * (g.cw + g.gap) + g.cw / 2;
    const cy = y < 0 ? g.pad * .5 : y >= m.rows ? bh - g.pad * .5 : g.pad + y * (g.ch + g.gap) + g.ch / 2;
    return [cx, cy];
  }
  function drawPath(pts, col, cls){
    const svg = $('#lkPath'), bd = $('#bd'); if(!svg || !bd) return;
    svg.setAttribute('viewBox', `0 0 ${bd.clientWidth} ${bd.clientHeight}`);
    const d = pts.map(([x, y], i) => (i ? 'L' : 'M') + px(x, y).map(v => v.toFixed(1)).join(' ')).join('');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'lk-line ' + (cls || ''));
    g.innerHTML = `<path d="${d}" class="o"/><path d="${d}" class="c" style="stroke:${col}"/><path d="${d}" class="w"/>`;
    svg.appendChild(g);
    const len = g.querySelector('.c').getTotalLength ? g.querySelector('.c').getTotalLength() : 300;
    g.style.setProperty('--len', Math.ceil(len));
    T(() => g.remove(), cls === 'hint' ? 1700 : 520);
  }

  /* 이펙트 v2: 이은 선을 따라 빛 알갱이가 달려감(보이기만 함) */
  function pathSpark(pts, col){
    try{
      const bd = $('#bd'); if(!bd || typeof fxEmit !== 'function' || FXR.reduce) return;
      const r = bd.getBoundingClientRect(), ox = r.left + bd.clientLeft, oy = r.top + bd.clientTop;
      const P = pts.map(([x, y]) => { const q = px(x, y); return [ox + q[0], oy + q[1]]; });
      let acc = 0;
      for(let s = 1; s < P.length; s++){
        const [x0, y0] = P[s - 1], [x1, y1] = P[s], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 16));
        for(let j = 0; j < n; j++){ const t = j / n;
          fxEmit(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, { quantity:1, speed:{ min:4, max:26 }, lifespan:{ min:320, max:460 }, kind:'glow', tint:[col], scale:{ start:3.4, end:.4 }, alpha:{ start:1, end:0 }, delay:acc * .9 });
          acc += 16; }
      }
    }catch(_){}
  }
  function setSel(i, on){ const el = cellEl(i); if(el) el.classList.toggle('sel', on); }
  function tap(i){
    const m = S();
    if(!m || G.over || G.paused || m.phase !== 'play' || m.lock) return;
    const k = m.b[i]; if(k == null || k === STONE) return;
    clearHint();
    if(m.sel == null){ m.sel = i; setSel(i, true); sfx('linkPick'); return; }
    if(m.sel === i){ setSel(i, false); m.sel = null; sfx('linkPick', { off:1 }); return; }
    const a = m.sel;
    const diff = m.b[a] !== k;
    const p = diff ? null : findPath(m, a, i);
    if(p){ setSel(a, false); m.sel = null; clear(a, i, p); return; }
    /* 실수(마구 누르기 막기): 다른 그림을 고르거나, 같은 그림인데 길이 없으면 기회 하나를 잃는다. 기회를 다 쓰면 끝 */
    m.misses++; m.combo = 0;
    const left = m.lives ? Math.max(0, m.lives - m.misses) : -1;   /* -1 = 기회 제한 없음(대전) */
    [a, i].forEach(j => { const el = cellEl(j); if(el){ el.classList.add('bad'); fxShake(el, 4); } });
    setSel(a, false); m.sel = null;
    sfx('linkMiss'); fxBuzz(25);
    msg('<b class="bad">' + (diff ? '다른 그림이에요' : '길이 막혔어요') + '</b><span>' + (left < 0 ? '점수 −25' : left ? '기회 ' + left + '번 남음' : '기회를 다 썼어요') + '</span>', 'lk-pop');
    const hs = document.querySelectorAll('.ng-link .lk-heart'), lost = left >= 0 && hs[left]; if(lost){ lost.classList.add('lost'); const q = fxCenter(lost); fxBurst(q.x, q.y, ['#FF4D6D', '#FFB3C1', '#fff'], 10, { speed:200, size:4, kinds:['dot','spark'], up:60, g:500, dur:.6 }); }
    if(m.tick){ m.pen += m.tick; const tp = $('#lkTimeP'); if(tp){ const q = fxCenter(tp); fxFloat(q.x, q.y + 30, '−' + m.tick + '초', 'bad'); } }
    hud();
    T(() => { [a, i].forEach(j => { const el = cellEl(j); if(el) el.classList.remove('bad'); }); if(m.phase === 'play') msg(playMsg()); }, 700);
    if(left >= 0){ G.paws = left; if(!left) failMiss(); }
  }

  function clear(a, b, p){
    const m = S(), k = m.b[a], col = symCol(k);
    m.lock = true; m.found++; m.combo++; m.best = Math.max(m.best, m.combo);
    drawPath(p, col);
    pathSpark(p, col);
    [a, b].forEach((j, n) => {
      const el = cellEl(j); if(!el) return; el.classList.add('gone');
      const q = fxCenter(el);
      fxBurst(q.x, q.y, [col, '#FFE27A', '#FFFFFF'], 9, { speed:220, size:4.5, kinds:['star','dot','spark'], up:100, g:460, glow:n === 1, dur:.6 });
    });
    if(k === CLOCK){ m.pen -= CLOCK_SEC; m.bonus += CLOCK_SEC; const tp = $('#lkTimeP'); if(tp){ const q = fxCenter(tp); fxFloat(q.x, q.y + 30, '+' + CLOCK_SEC + '초', 'good'); } sfx('linkClock'); }
    sfx('linkMatch', { n:m.combo - 1 }); fxBuzz(12);
    if(m.combo >= 3) fxCombo(m.combo);
    m.b[a] = null; m.b[b] = null; hud();
    T(() => {
      if(m.found >= m.pairs){ win(); return; }
      if(m.slide){ slideDown(); }
      else { [a, b].forEach(j => { const el = cellEl(j); if(el) el.outerHTML = cellHtml(j); }); }
      afterMove();
    }, 300);
  }
  function afterMove(){
    const m = S();
    if(!findMove(m)){ autoMix(); return; }
    m.lock = false;
  }

  /* 미끄럼: 열마다 돌 사이 구간에서 타일을 아래로 모은다 */
  function slideDown(){
    const m = S(), C = m.cols, R = m.rows, moved = new Map();
    for(let x = 0; x < C; x++){
      let y = R - 1;
      while(y >= 0){
        let seg = []; let y0 = y;
        while(y >= 0 && m.b[y * C + x] !== STONE){ seg.push(y); y--; }
        const tiles = seg.map(yy => [m.b[yy * C + x], m.id[yy * C + x], yy]).filter(t => t[0] != null);
        seg.forEach(yy => { m.b[yy * C + x] = null; m.id[yy * C + x] = null; });
        tiles.forEach(([k, id, from], n) => { const to = y0 - n, j = to * C + x; m.b[j] = k; m.id[j] = id; if(to !== from) moved.set(j, to - from); });
        y--;
      }
    }
    build();
    const g = m.geo;
    moved.forEach((dy, j) => { const el = cellEl(j); if(el && el.animate && !FXR.reduce) el.animate([{ transform:`translateY(${-dy * (g.ch + g.gap)}px)` }, { transform:'translateY(0)' }], { duration:220 + dy * 40, easing:'cubic-bezier(.4,1.4,.6,1)' }); });
    if(moved.size) sfx('linkSlide');
  }

  /* 섞기: 남은 타일의 자리만 rng로 바꾼다(지울 짝이 생길 때까지) */
  function mixBoard(){
    const m = S(), idx = m.b.map((k, i) => k != null && k !== STONE ? i : -1).filter(i => i >= 0);
    const keys = idx.map(i => m.b[i]), ids = idx.map(i => m.id[i]);
    for(let t = 0; t < 60; t++){
      const ord = shuffle(idx.map((_, n) => n), m.rng);
      idx.forEach((i, n) => { m.b[i] = keys[ord[n]]; m.id[i] = ids[ord[n]]; });
      if(findMove(m)) break;
    }
    m.mixes++;
    build();
    document.querySelectorAll('.ng-link .lk-cell.tile').forEach((e, n) => { e.style.setProperty('--d', (n % 9) * 25 + 'ms'); e.classList.add('mixin'); });
    T(() => document.querySelectorAll('.ng-link .lk-cell.mixin').forEach(e => e.classList.remove('mixin')), 700);
    sfx('linkMix');
  }
  function autoMix(){
    const m = S(); m.lock = true; m.autoMix++;
    msg('<b class="boss">이을 짝이 없어요</b><span>타일을 섞을게요</span>', 'lk-pop');
    T(() => { mixBoard(); m.lock = false; T(() => { if(m.phase === 'play') msg(playMsg()); }, 1200); }, 650);
  }
  function useMix(){
    const m = S(); if(!m || G.over || G.paused || m.phase !== 'play' || m.lock || m.mixLeft <= 0) return;
    m.mixLeft--; m.manualMix++; clearHint(); if(m.sel != null){ setSel(m.sel, false); m.sel = null; }
    hud(); mixBoard();
  }
  function clearHint(){ document.querySelectorAll('.ng-link .lk-cell.hint').forEach(e => e.classList.remove('hint')); }
  function useHint(){
    const m = S(); if(!m || G.over || G.paused || m.phase !== 'play' || m.lock || m.hintLeft <= 0) return;
    const mv = findMove(m); if(!mv) return;
    m.hintLeft--; m.hints++; hud(); clearHint();
    [mv[0], mv[1]].forEach(j => { const el = cellEl(j); if(el) el.classList.add('hint'); });
    drawPath(mv[2], '#FFE27A', 'hint');
    sfx('linkHint');
  }

  /* 시계 */
  const remTime = t => Math.max(0, G.limit - S().pen - t);
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed(), bar = $('#lkBar');
    if(m.phase === 'deal'){ if(t >= .45){ m.phase = 'play'; G.start = Date.now(); G.pausedMs = 0; msg(playMsg()); sfx('linkGo'); } return; }
    if(m.phase !== 'play') return;
    const rem = remTime(t), sec = Math.ceil(rem);
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#lkTime'); if(e) e.textContent = mmss(sec);
      const p = $('#lkTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#lkBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0){ sfx('linkTick', { hi:sec <= 5 }); if(p && !FXR.reduce && p.animate) p.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)' }, { transform:'scale(1)' }], { duration:300, easing:'ease-out' }); }
    }
    if(rem <= 0) timeUp();
  }

  function win(){
    const m = S(); m.phase = 'done'; m.lock = true; m.sec = elapsed();
    msg('<b>판을 모두 비웠어요!</b>', 'lk-win');
    sfx('win', { g:'link' }); fxBuzz([30, 50, 30]);
    const bd = $('#bd'); if(bd){ bd.classList.add('cleared'); const p = fxCenter(bd); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); fxBurst(p.x, p.y, ['#FFE27A', '#FF8FC8', '#7CCBFF', '#5BD08A'], 26, { speed:340, size:6, kinds:['star','dot','spark'], up:140, g:420, glow:true, dur:1 }); }
    T(() => finish(true), 1000);
  }
  function lose(text, why){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.lock = true; m.fail = why;
    msg('<b class="bad">' + text + '</b><span>남은 짝 ' + (m.pairs - m.found) + '개</span>', 'lk-pop');
    sfx('linkTimeUp'); fxBuzz([40, 40, 60]); fxShake($('#bd'), 6);
    document.querySelectorAll('.ng-link .lk-cell.tile').forEach(e => e.classList.add('left'));
    T(() => finish(false), 1400);
  }
  function timeUp(){ const e = $('#lkTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요', 'time'); }
  function failMiss(){ lose('기회를 다 썼어요', 'miss'); }

  function cellHtml(i){
    const m = S(), k = m.b[i], x = i % m.cols, y = Math.floor(i / m.cols);
    if(k == null) return `<span class="lk-cell empty" data-i="${i}" aria-hidden="true"></span>`;
    if(k === STONE) return `<span class="lk-cell stone" data-i="${i}" role="img" aria-label="돌 ${y + 1}행 ${x + 1}열"><span class="lk-face">${STONE_SVG}</span></span>`;
    return `<button class="lk-cell tile${k === CLOCK ? ' clk' : ''}${m.sel === i ? ' sel' : ''}" data-i="${i}" aria-label="${symName(k)} ${y + 1}행 ${x + 1}열"><span class="lk-face">${symSvg(k)}</span></button>`;
  }
  function build(){
    const m = S(), bd = $('#bd'); if(!bd) return;
    bd.querySelectorAll('.lk-cell').forEach(e => e.remove());
    bd.insertAdjacentHTML('afterbegin', m.b.map((_, i) => cellHtml(i)).join(''));
    layout();
  }
  function wire(){
    const m = S(), bd = $('#bd');
    bd.onpointerdown = e => { const el = e.target.closest && e.target.closest('.lk-cell.tile'); if(!el) return; e.preventDefault(); tap(+el.dataset.i); };
    bd.onkeydown = e => {
      const el = e.target.closest && e.target.closest('.lk-cell'); if(!el) return;
      const i = +el.dataset.i, c = m.cols, n = m.b.length;
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); tap(i); return; }
      const d = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-c, ArrowDown:c }[e.key];
      if(d != null){ e.preventDefault(); let j = i + d; while(j >= 0 && j < n && (m.b[j] == null || m.b[j] === STONE)) j += d; if(j >= 0 && j < n){ const t = cellEl(j); if(t) t.focus(); } }
    };
    const h = $('#lkHint'); if(h) h.onclick = useHint;
    const x = $('#lkMix'); if(x) x.onclick = useMix;
  }

  return {
    name:'짝 잇기', abil:'공간지각', col:['#9EE6C3','#2BB673','#13703F'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 9A1.5 1.5 0 0 1 5 7.5h4A1.5 1.5 0 0 1 10.5 9v9A1.5 1.5 0 0 1 9 19.5H5A1.5 1.5 0 0 1 3.5 18zm10 3A1.5 1.5 0 0 1 15 10.5h4a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M7 7V3.2h10V10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    art(){
      const u = 'linkA' + Math.floor(performance.now() * 1000 % 1e6);
      const tile = (x, y, k, glow) => `<g transform="translate(${x} ${y})"><rect x="-11" y="-12" width="22" height="27" rx="5" fill="#7FC9A0" stroke="#1A0F45" stroke-width="2.2"/><rect x="-11" y="-14" width="22" height="25" rx="5" fill="${glow ? '#FFF6C8' : '#FFFDF4'}" stroke="#1A0F45" stroke-width="2.2"/><svg x="-9" y="-12" width="18" height="18" viewBox="0 0 64 64">${SYM[k][2]}</svg></g>`;
      const ks = [['leaf', 'drop', 'star', 'cherry', 'moon'], ['flower', 'star', 'gem', 'leaf', 'bell'], ['cherry', 'bolt', 'flower', 'drop', 'gem']];
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DFF7E6"/><stop offset="1" stop-color="#9FDDBA"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <g fill="#fff" opacity=".45"><circle cx="10" cy="12" r="3"/><circle cx="150" cy="88" r="4"/><circle cx="148" cy="10" r="2.4"/></g>
        ${ks.map((row, r) => row.map((k, c) => (r === 0 && c === 2) || (r === 1 && c === 1) ? '' : tile(32 + c * 24, 22 + r * 29, k, false)).join('')).join('')}
        <path d="M80 8V4H56v15" fill="none" stroke="#1A0F45" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M80 8V4H56v15" fill="none" stroke="#FFB020" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
        ${tile(80, 22, 'star', true)}${tile(56, 51, 'star', true)}
        <path d="${starPath(18, 50, 6, 2.6)}" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    },
    help:[
      ['같은 그림 두 개를 골라요', '같은 그림 타일 두 개를 차례로 누르면 길로 이어져 함께 사라져요. 고른 타일을 다시 누르면 취소돼요.'],
      ['길은 두 번까지만 꺾여요', '길은 빈칸과 판 바깥 테두리로만 지나갈 수 있고, 꺾이는 곳은 두 번까지예요.'],
      ['기회는 3번', '다른 그림을 고르거나 길이 막힌 짝을 고르면 기회 하나(♥)를 잃어요. 세 번 틀리면 게임이 끝나요. 마구 누르지 말고 잘 보고 골라요!'],
      ['시간 안에 판을 비워요', '제한 시간 안에 모든 짝을 지우면 성공! 막히면 💡힌트나 섞기를 쓸 수 있지만 점수가 조금 줄어요. 지울 짝이 하나도 없으면 저절로 섞여요.'],
      ['솔로: 5판마다 새 규칙', '솔로에서는 돌 타일·닮은꼴·시계 타일·미끄럼 같은 새 규칙과 번개·외줄 타기·한 번 꺾기 같은 변주가 5판마다 하나씩 나와요.']
    ],
    helpExtra(){ const m = G && G.id === 'link' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['꽃밭 산책','과일 장터','별빛 정원','바닷가 마을','눈꽃 궁전'],
    starRule:'★ 클리어 · ★★ 힌트·섞기·실수 1번 이하 · ★★★ 힌트·섞기·실수 없이',
    levels:{
      easy:{ cols:7, rows:8, pairs:27, limit:170, hints:3, mixes:2 },
      normal:{ cols:7, rows:10, pairs:33, limit:210, hints:3, mixes:2 },
      hard:{ cols:8, rows:11, pairs:42, limit:250, hints:3, mixes:2 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.cols}×${c.rows} · ${c.pairs}짝 · ${mmss(c.limit)}${c.lives === 1 ? ' · 기회 1번' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.cols}×${c.rows} · ${c.pairs}짝`; },
    init(cfg, rng){
      const d = deal(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { cols:cfg.cols, rows:cfg.rows, pairs:cfg.pairs, b:d.b, id:d.b.map((k, i) => k != null && k !== STONE ? i : null), turns:cfg.turns || 2, slide:!!cfg.slide, tick:cfg.tick || 0,
        sel:null, lock:false, found:0, combo:0, best:0, misses:0, hints:0, mixes:0, manualMix:0, autoMix:0, pen:0, bonus:0,
        hintLeft:cfg.hints == null ? 3 : cfg.hints, mixLeft:cfg.mixes == null ? 2 : cfg.mixes, lives:G.duel ? 0 : cfg.lives || LIVES,   /* 대전은 기회 제한 없음(0) — 틀려도 끝나지 않고 점수만 깎인다 */
        phase:'deal', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, rng, lastSec:-1, sec:0, fail:null, timers:new Set(), geo:{ cw:40, ch:48, gap:3, pad:12 } };
      G.limit = cfg.limit; if(G.m.lives) G.paws = G.m.lives;
      const m = G.m;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
        document.querySelectorAll('.fxcombo').forEach(e => e.remove());
      };
      /* 테스트·도구용: 지울 수 있는 짝을 차례로 모두 지운다 */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.found); return; }
          if(m.lock || m.phase !== 'play'){ setTimeout(step, 60); return; }
          const mv = findMove(m); if(!mv){ setTimeout(step, 60); return; }
          tap(mv[0]); tap(mv[1]); setTimeout(step, 40);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _deal:deal, _search:search, _stage:stageCfg,
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-link">
        <div class="lk-hud">
          <div class="lk-pill" aria-label="지운 짝"><span class="lk-ic">${ICO.pair}</span><b id="lkFound">0</b><small>/${m.pairs}짝</small></div>
          <div class="lk-pill lk-time" id="lkTimeP" aria-label="남은 시간"><span class="lk-ic">${ICO.clock}</span><b id="lkTime">${mmss(G.limit)}</b></div>
          <button class="lk-pill lk-btn" id="lkHint" aria-label="힌트"><span class="lk-ic">${ICO.hint}</span><b>${m.hintLeft}</b></button>
          <button class="lk-pill lk-btn" id="lkMix" aria-label="섞기"><span class="lk-ic">${ICO.mix}</span><b>${m.mixLeft}</b></button>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="lk-rules" aria-label="켜진 규칙">${m.boss ? '<span class="lk-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="lk-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="lk-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="lk-barw" id="lkBarWrap"><i id="lkBar"></i></div>
        <div class="lk-row"><div class="lk-lives" id="lkLives" role="img"></div><div class="lk-msg" id="lkMsg"><span>타일을 놓는 중…</span></div></div>
        <div class="lk-board in" id="bd" role="grid" aria-label="타일 판"><svg class="lk-path" id="lkPath" aria-hidden="true"></svg></div>
      </div>`;
      build(); wire(); hud();
      T(() => { const b = $('#bd'); if(b) b.classList.remove('in'); }, 900);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m ? m.found / m.pairs : 0; },
    lossText(){ const m = G.m; return (m.fail === 'miss' ? '기회를 다 썼어요. ' : '') + `짝 ${m.found}/${m.pairs}개를 지웠어요.`; },
    score(){
      const m = G.m, sec = Math.max(0, Math.min(G.limit, (m.sec || elapsed()) + (m.pen || 0)));
      const time = Math.max(0, 350 - Math.floor(sec * 350 / G.limit));
      const extra = Math.max(0, 150 - 40 * m.hints - 25 * m.manualMix - 25 * m.misses);
      return { base:500, time, extra, rows:['판 모두 비우기', '시간 보너스 (' + mmss(sec) + ')', `힌트 ${m.hints} · 섞기 ${m.manualMix} · 실수 ${m.misses}`] };
    },
    stars(){ const m = G.m, help = m.hints + m.manualMix; return help === 0 && m.misses === 0 ? 3 : help <= 1 && m.misses <= 1 ? 2 : 1; },
    css:`
body[data-mode="link"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.25) 0 3px, transparent 3.5px) 0 0/44px 44px,
  linear-gradient(180deg,#E3F8EA 0%,#B6E8CB 55%,#8FD5B0 100%) fixed}
.ng-link{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-link .lk-hud{display:flex; gap:7px; width:100%; justify-content:space-between}
.ng-link .lk-pill{flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; gap:5px; height:44px; padding:0 8px; border-radius:999px; font:inherit;
  background:linear-gradient(180deg,#FFFFFF,#EFFAF2); border:2.5px solid #1A0F45; box-shadow:inset 0 -3px 0 rgba(40,120,80,.14), 0 3px 0 #1A0F45; color:#1E4A35; white-space:nowrap}
.ng-link .lk-pill b{font-family:var(--heavy); font-size:20px; font-weight:400; line-height:1; font-variant-numeric:tabular-nums}
.ng-link .lk-pill small{font-family:var(--disp); font-size:14px; color:#5E8A74}
.ng-link .lk-ic{width:22px; height:22px; flex:none; display:block}
.ng-link .lk-ic svg{width:100%; height:100%; display:block}
.ng-link .lk-time{flex:1.3 1 0}
.ng-link .lk-time b{font-size:23px}
.ng-link .lk-time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-link .lk-time.hurry b{text-shadow:0 2px 0 #8E0F2F}
.ng-link .lk-btn{flex:.8 1 0; cursor:pointer; -webkit-tap-highlight-color:transparent; background:linear-gradient(180deg,#FFF6C8,#FFE07A)}
.ng-link .lk-btn:active{transform:translateY(2px); box-shadow:inset 0 -3px 0 rgba(40,120,80,.14), 0 1px 0 #1A0F45}
.ng-link .lk-btn:disabled{opacity:.45; background:#EDEDED; cursor:default}
.ng-link .lk-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid #1A0F45; overflow:hidden}
.ng-link .lk-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#9EF0B8,#27B86A); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-link .lk-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-link .lk-row{display:flex; align-items:center; gap:8px; width:100%; height:38px}
.ng-link .lk-lives{display:flex; gap:2px; flex:none; padding:4px 7px; border-radius:99px; background:#fff; border:2px solid #1A0F45; box-shadow:0 2px 0 #1A0F45}
.ng-link .lk-heart{display:block; width:19px; height:19px; color:#FF4D6D}
.ng-link .lk-heart svg{width:100%; height:100%; display:block}
.ng-link .lk-heart.off{color:#DCD6E6}
.ng-link .lk-heart.lost{animation:link-lost .5s ease-out}
.ng-link .lk-lives.last{background:#FFE3E3; animation:link-last 1s ease-in-out infinite alternate}
@keyframes link-lost{0%{transform:scale(1.5); color:#FF4D6D} 100%{transform:none}}
@keyframes link-last{to{box-shadow:0 2px 0 #1A0F45, 0 0 10px 3px rgba(255,77,109,.6)}}
.ng-link .lk-msg{flex:1; min-width:0; overflow:hidden; height:38px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#1E5A3D; white-space:nowrap}
.ng-link .lk-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px}
.ng-link .lk-msg b.boss{color:#FFE27A}
.ng-link .lk-msg b.bad{color:#FF8A8F}
.ng-link .lk-msg.lk-pop, .ng-link .lk-msg.lk-win{animation:link-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-link .lk-msg.lk-win b{font-size:24px; color:#FFE27A}
@keyframes link-in{from{transform:scale(.6); opacity:0}}
.ng-link .lk-board{position:relative; display:grid; width:max-content; gap:var(--gap); padding:var(--pad); border-radius:20px; justify-content:center;
  background:radial-gradient(circle at 50% 40%, #F4FFF7 0%, #DDF3E5 100%); border:3px solid #1A0F45;
  box-shadow:inset 0 0 0 3px rgba(255,255,255,.8), inset 0 0 0 calc(var(--pad) - 2px) rgba(120,200,150,.18), 0 5px 0 #1A0F45, 0 14px 22px rgba(20,90,50,.22); touch-action:manipulation}
.ng-link .lk-board.in .lk-cell.tile{animation:link-deal .45s cubic-bezier(.2,1.5,.4,1) both}
.ng-link .lk-board.in .lk-cell.tile:nth-child(3n){animation-delay:.06s}
.ng-link .lk-board.in .lk-cell.tile:nth-child(3n+1){animation-delay:.12s}
@keyframes link-deal{from{transform:translateY(-16px) scale(.4); opacity:0}}
.ng-link .lk-path{position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:4; overflow:visible}
.ng-link .lk-line path{fill:none; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:var(--len); stroke-dashoffset:var(--len); animation:link-draw .2s ease-out forwards, link-fade .52s ease-in forwards}
.ng-link .lk-line .o{stroke:#1A0F45; stroke-width:9}
.ng-link .lk-line .c{stroke-width:5.5}
.ng-link .lk-line .w{stroke:#fff; stroke-width:1.8; opacity:.8}
.ng-link .lk-line.hint path{animation:link-draw .35s ease-out forwards, link-fade 1.7s ease-in forwards}
.ng-link .lk-line.hint .c{stroke-dasharray:6 6 !important}
@keyframes link-draw{to{stroke-dashoffset:0}}
@keyframes link-fade{0%,70%{opacity:1} 100%{opacity:0}}
.ng-link .lk-cell{position:relative; width:var(--cw); height:var(--ch); padding:0; border:0; background:none; display:block; -webkit-tap-highlight-color:transparent; outline:none; font:inherit; color:inherit}
.ng-link .lk-cell.tile{cursor:pointer}
.ng-link .lk-face{position:absolute; left:0; right:0; top:0; bottom:4px; display:grid; place-items:center; border-radius:calc(var(--cw) * .2); border:2.2px solid #1A0F45;
  background:linear-gradient(180deg,#FFFFFB 0%,#FFF6E0 100%); box-shadow:inset 0 2px 0 rgba(255,255,255,.8), 0 2px 0 #7FC9A0, 0 4px 0 #1A0F45; transition:transform .12s, box-shadow .12s, background .12s}
.ng-link .lk-face svg{width:80%; height:auto; max-height:80%; display:block; overflow:visible}
.ng-link .lk-cell.tile:focus-visible .lk-face{box-shadow:0 0 0 3px #FFE27A, 0 0 0 5px #1A0F45}
.ng-link .lk-cell.clk .lk-face{background:linear-gradient(180deg,#F2FFF5,#CFF5DC)}
.ng-link .lk-cell.sel .lk-face{transform:translateY(-4px); background:linear-gradient(180deg,#FFFBE0,#FFE38A); box-shadow:inset 0 0 0 2px #FFB020, 0 2px 0 #E09A10, 0 8px 0 #1A0F45, 0 0 14px 4px rgba(255,200,60,.8)}
.ng-link .lk-cell.hint .lk-face{animation:link-hint .7s ease-in-out infinite alternate}
@keyframes link-hint{from{box-shadow:inset 0 2px 0 rgba(255,255,255,.8), 0 2px 0 #7FC9A0, 0 4px 0 #1A0F45, 0 0 0 0 rgba(255,214,90,0)} to{box-shadow:inset 0 2px 0 rgba(255,255,255,.8), 0 2px 0 #7FC9A0, 0 4px 0 #1A0F45, 0 0 12px 5px rgba(255,214,90,.95); transform:translateY(-2px)}}
.ng-link .lk-cell.bad .lk-face{background:linear-gradient(180deg,#FFE8E8,#FFC6C8); box-shadow:inset 0 0 0 2px #E5484D, 0 2px 0 #C04040, 0 4px 0 #1A0F45}
.ng-link .lk-cell.gone{pointer-events:none}
.ng-link .lk-cell.gone .lk-face{animation:link-gone .3s cubic-bezier(.4,0,.6,1) forwards}
@keyframes link-gone{0%{transform:scale(1)} 40%{transform:scale(1.18) rotate(-6deg); opacity:1} 100%{transform:scale(.2) rotate(10deg); opacity:0}}
.ng-link .lk-cell.stone .lk-face{background:linear-gradient(180deg,#D9D6E8,#B5B0CC); box-shadow:inset 0 2px 0 rgba(255,255,255,.5), 0 2px 0 #77728F, 0 4px 0 #1A0F45}
.ng-link .lk-cell.stone .lk-face svg{width:78%}
.ng-link .lk-cell.left .lk-face{filter:grayscale(.55) brightness(.95)}
.ng-link .lk-cell.mixin .lk-face{animation:link-mix .5s cubic-bezier(.2,1.4,.4,1) var(--d) both}
@keyframes link-mix{0%{transform:rotateY(90deg) scale(.7)} 100%{transform:none}}
.ng-link .lk-alt{filter:hue-rotate(150deg) saturate(1.3)}
.ng-link .lk-dot{position:absolute; top:9%; right:9%; width:26%; aspect-ratio:1; border-radius:50%; background:#FF3D7F; border:2px solid #1A0F45}
.ng-link .lk-board.cleared{animation:link-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes link-cheer{40%{transform:scale(1.04)}}
.ng-link .lk-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-link .lk-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#1E4A35; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-link .lk-chip.mj{background:#E3FAEC; color:#13703F}
.ng-link .lk-chip.tw{background:#EFE7FF; color:#5B3FB5}
.ng-link .lk-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
.ng-link .lk-chip.miss{background:#E6FFF0; color:#15703F}
.ng-link .lk-chip.miss b{font-family:var(--heavy); font-weight:400; font-size:15px}
.ng-link .lk-chip.miss.low{background:#FFE3E3; color:#B3122E}
@media (max-width:370px){ .ng-link .lk-pill b{font-size:18px} .ng-link .lk-time b{font-size:20px} .ng-link .lk-pill small{font-size:12px} .ng-link .lk-hud{gap:5px} .ng-link .lk-pill{padding:0 5px} .ng-link .lk-msg b{font-size:18px} .ng-link .lk-chip{font-size:12px; padding:4px 7px} }
@media (prefers-reduced-motion: reduce){ .ng-link .lk-line path{animation:link-fade .52s ease-in forwards; stroke-dasharray:none} .ng-link .lk-board.in .lk-cell.tile, .ng-link .lk-cell.mixin .lk-face, .ng-link .lk-cell.hint .lk-face{animation:none} }
`,
    sounds:{
      linkPick(o){ if(o.off){ aTone({ f:660, f2:520, type:'triangle', d:.06, v:.04 }); return; } aNoise({ ft:'bandpass', f:2800, q:2, d:.04, v:.06 }); aTone({ f:880, f2:1040, type:'triangle', d:.07, v:.05 }); },
      linkMatch(o){ const n = Math.min(10, o.n || 0); aWhoosh({ f:900, f2:3200, a:.01, d:.14, v:.035 }); aBell({ f:penta(n + 4, 72), t:.05, d:.6, v:.085, idx:1.4, rev:.35 }); aBell({ f:penta(n + 6, 72), t:.12, d:.7, v:.07, idx:1.2, rev:.4 }); if(n >= 2) aSparkle({ root:84 + Math.min(7, n), n:4, t:.16, v:.03 }); },
      linkMiss(){ aTone({ f:330, f2:220, type:'triangle', d:.2, v:.1 }); aThump({ f:140, f2:70, d:.14, v:.12 }); },
      linkHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      linkMix(){ aWhoosh({ f:500, f2:3200, q:1.2, a:.05, d:.35, v:.06 }); for(let k = 0; k < 7; k++) aNoise({ ft:'bandpass', f:rnd(1800, 3200), q:2, t:.05 + k * .06, d:.035, v:.04 }); },
      linkSlide(){ aTone({ f:520, f2:300, type:'triangle', d:.16, v:.05 }); aThump({ f:120, f2:60, t:.12, d:.12, v:.1 }); },
      linkClock(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(76 + d), { t:i * .06, v:.12 })); },
      linkGo(){ aWhoosh({ f:2600, f2:600, a:.03, d:.25, v:.05 }); aBell({ f:m2f(84), t:.15, d:.5, v:.06, rev:.3 }); },
      linkTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      linkTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ linkPick:35, linkTick:250, linkMatch:60 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); [79, 84, 88, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();


/* 대전: AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
Object.assign(NG.link, { duelPace:[140,.72], duelStat:{ unit:"짝", lfMax:3, get:() => ({ v:G.m.found, t:G.m.pairs, lf:G.m.lives ? Math.max(0, G.m.lives - G.m.misses) : null }) } });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.link.scene = { kind:'motes', colors:['#FFFFFF','#B8F0D0','#FFF3B0'], density:1 };
