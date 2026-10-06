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

  const LIVES = 3;   /* 기본 기회 3번: 세 번째 실수에서 끝 */

  /* ----- 오늘의 문제·연습 판 (2026-10-06 세대별 피드백: 하루 판이 길다 → 줄임). 문제 내용 변경은 적용일 다음 날 0시부터 ----- */
  const LV_FROM = '2026-10-07';
  const LV_OLD = {
    easy:{ cols:7, rows:8, pairs:27, limit:170, hints:3, mixes:2 },
    normal:{ cols:7, rows:10, pairs:33, limit:210, hints:3, mixes:2 },
    hard:{ cols:8, rows:11, pairs:42, limit:250, hints:3, mixes:2 }
  };
  const LV_NEW = {
    easy:{ cols:7, rows:8, pairs:24, limit:150, hints:3, mixes:2 },
    normal:{ cols:7, rows:9, pairs:28, limit:170, hints:3, mixes:2 },
    hard:{ cols:8, rows:9, pairs:34, limit:210, hints:3, mixes:2 }
  };
  const lvTable = () => { let d = ''; try{ d = dayKey(); }catch(_){} return d >= LV_FROM ? LV_NEW : LV_OLD; };

  /* ----- 대전 전용 판(1:1 경주, 2분): 6×8 칸 · 20짝. 비슷한 파랑 그림은 한 판에 2개까지만 ----- */
  const DUEL_CFG = { cols:6, rows:8, pairs:20, limit:120, hints:3, mixes:2, blueMax:2 };
  const BLUE = ['drop', 'snow', 'anchor', 'cloud', 'gem'];
  const ICE_MS = 6000, ICE_MAX = 6, COMBO_MS = 3000, FREEZE_MS = 1000;   /* 얼음 6초 · 판에 최대 6장 · 콤보 3초 안 · 대전 실수 1초 못 누름 */
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
      flash:{ name:'빠른 판', desc:'타일은 조금 적지만 제한 시간이 아주 짧아요. 빠르게 훑어보세요!' },
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
  function findMove(m, noIce){
    const by = {};
    m.b.forEach((k, i) => { if(k != null && k !== STONE && !(noIce && m.ice && m.ice.has(i))) (by[k] = by[k] || []).push(i); });
    for(const k in by){ const L = by[k]; for(let x = 0; x < L.length; x++) for(let y = x + 1; y < L.length; y++){ const p = findPath(m, L[x], L[y]); if(p) return [L[x], L[y], p]; } }
    return null;
  }

  /* ===== 판 만들기(거꾸로 쌓기): 빈 판에서 시작해, 지금 놓인 타일 사이로 이어지는 빈칸 두 곳에 짝을 놓는다.
     마지막에 놓은 짝부터 지우면 언제나 길이 있으므로 처음 판은 반드시 다 지울 수 있다. rng만 쓴다. */
  function deal(cfg, rng){
    const cols = cfg.cols, rows = cfg.rows, N = cols * rows, pairs = cfg.pairs, turns = cfg.turns || 2;
    /* 짝 목록: 그림 하나에 보통 2짝(타일 4개), 닮은꼴은 두 번째 짝을 점 찍힌 타일로, 시계 짝은 따로 */
    const plain = pairs - (cfg.clocks || 0), types = Math.ceil(plain / 2);
    let pool = shuffle(POOL.slice(), rng);
    if(cfg.blueMax != null){ let nb = 0; pool = pool.filter(k => !BLUE.includes(k) || nb++ < cfg.blueMax); }   /* 대전: 파랑 계열 제한(섞은 뒤 거르기라 다른 모드의 rng 순서는 그대로) */
    const keys = pool.slice(0, Math.min(types, pool.length));
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
    const lv = $('#lkLives'); if(lv && !m.lives) lv.hidden = true; else if(lv){ const left = Math.max(0, m.lives - m.misses); lv.innerHTML = '기회 ' + Array.from({ length:m.lives }, (_, n) => `<i${n >= left ? ' class="off"' : ''}>★</i>`).join(''); lv.classList.toggle('last', left === 1); lv.setAttribute('aria-label', '남은 기회 ' + left + '번'); }
  }
  function msg(html, cls){ const e = $('#lkMsg'); if(!e) return; e.className = 'lk-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">대장 판</b><span>' + (m.tips[0] || '끝까지 집중!') + '</span>';
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
  /* 선 끝 반짝(보이기만 함) */
  function lineEndSpark(pts, col){
    try{
      const bd = $('#bd'); if(!bd || typeof fxEmit !== 'function' || FXR.reduce || pts.length < 2) return;
      const r = bd.getBoundingClientRect(), ox = r.left + bd.clientLeft, oy = r.top + bd.clientTop;
      [pts[0], pts[pts.length - 1]].forEach(([x, y], n) => { const q = px(x, y); fxEmit(ox + q[0], oy + q[1], { quantity:6, speed:{ min:30, max:90 }, lifespan:{ min:300, max:520 }, kind:'twinkle', tint:['#FFFFFF', '#FFE27A', col], scale:{ start:3, end:.3 }, alpha:{ start:1, end:0 }, delay:n ? 160 : 0 }); });
    }catch(_){}
  }
  function setSel(i, on){ const el = cellEl(i); if(el) el.classList.toggle('sel', on); }
  function tap(i){
    const m = S();
    if(!m || G.over || G.paused || m.phase !== 'play' || m.lock) return;
    const k = m.b[i]; if(k == null || k === STONE) return;
    if(m.frozenUntil && Date.now() < m.frozenUntil) return;   /* 대전: 틀린 뒤 1초는 못 누름 */
    if(m.ice && m.ice.has(i)){   /* 얼음 덮인 타일은 못 고름(실수 아님) */
      const el = cellEl(i); try{ if(el) fxShake(el, 3); }catch(_){}
      sfx('linkIceNo'); msg('<b class="ice">꽁꽁 얼었어요</b><span>' + Math.max(1, Math.ceil((m.ice.get(i) - Date.now()) / 1000)) + '초 뒤 녹아요 · 옆 짝을 지우면 바로</span>', 'lk-pop');
      T(() => { if(m.phase === 'play') msg(playMsg()); }, 1100);
      return;
    }
    clearHint(); coachOff();
    if(m.sel == null){ m.sel = i; setSel(i, true); sfx('linkPick'); return; }
    if(m.sel === i){ setSel(i, false); m.sel = null; sfx('linkPick', { off:1 }); return; }
    const a = m.sel;
    const diff = m.b[a] !== k;
    const p = diff ? null : findPath(m, a, i);
    if(p){ setSel(a, false); m.sel = null; clear(a, i, p); return; }
    /* 실수(마구 누르기 막기): 다른 그림을 고르거나, 같은 그림인데 길이 없으면 기회 하나를 잃는다. 기회를 다 쓰면 끝 */
    m.misses++; m.combo = 0; m.chain = 0;
    const left = m.lives ? Math.max(0, m.lives - m.misses) : -1;   /* -1 = 기회 제한 없음(대전) */
    [a, i].forEach(j => { const el = cellEl(j); if(el){ el.classList.add('bad'); fxShake(el, 4); } });
    setSel(a, false); m.sel = null;
    sfx('linkMiss'); fxBuzz(25);
    if(left < 0){   /* 대전: 기회 대신 1초 동안 못 누름(막 누르기 막기) */
      m.frozenUntil = Date.now() + FREEZE_MS;
      const bd = $('#bd'); if(bd) bd.classList.add('frozen');
      T(() => { const b2 = $('#bd'); if(b2) b2.classList.remove('frozen'); }, FREEZE_MS);
    }
    msg('<b class="bad">' + (diff ? '다른 그림이에요' : '길이 막혔어요') + '</b><span>' + (left < 0 ? '−25점 · 1초 쉬어요' : left ? '기회 ' + left + '번 남음' : '기회를 다 썼어요') + '</span>', 'lk-pop');
    const hs = document.querySelectorAll('.ng-link .hlives i'), lost = left >= 0 && hs[left]; if(lost){ lost.classList.add('lost'); const q = fxCenter(lost); fxBurst(q.x, q.y, ['#FFB020', '#FFE27A', '#fff'], 10, { speed:200, size:4, kinds:['dot','spark'], up:60, g:500, dur:.6 }); }
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
    lineEndSpark(p, col);
    /* 지울 때 두 타일이 가운데로 모이며 터짐(보이기만 함) */
    const ea = cellEl(a), eb = cellEl(b);
    let mid = null; try{ if(ea && eb){ const qa = fxCenter(ea), qb = fxCenter(eb); mid = { x:(qa.x + qb.x) / 2, y:(qa.y + qb.y) / 2, qa, qb }; } }catch(_){}
    [a, b].forEach((j, n) => {
      const el = cellEl(j); if(!el) return; el.classList.add('gone');
      try{
        const q = fxCenter(el), f = el.querySelector('.lk-face');
        if(mid && f && f.animate && !FXR.reduce){ const dx = (mid.x - q.x) * .35, dy = (mid.y - q.y) * .35; f.animate([{ transform:'scale(1)' }, { transform:`translate(${dx}px,${dy}px) scale(1.12)`, opacity:1, offset:.45 }, { transform:`translate(${dx * 1.6}px,${dy * 1.6}px) scale(.2)`, opacity:0 }], { duration:300, easing:'cubic-bezier(.4,0,.6,1)', fill:'forwards' }); }
        fxBurst(q.x, q.y, [col, '#FFE27A', '#FFFFFF'], 9, { speed:220, size:4.5, kinds:['star','dot','spark'], up:100, g:460, glow:n === 1, dur:.6 });
      }catch(_){}
    });
    if(m.duel) duelAfterClear(a, b);
    if(k === CLOCK){ m.pen -= CLOCK_SEC; m.bonus += CLOCK_SEC; const tp = $('#lkTimeP'); if(tp){ const q = fxCenter(tp); fxFloat(q.x, q.y + 30, '+' + CLOCK_SEC + '초', 'good'); } sfx('linkClock'); }
    sfx('linkMatch', { n:m.combo - 1 }); fxBuzz(12);
    if(m.combo >= 3 && !m.duel) fxCombo(m.combo);   /* 대전은 콤보 글자를 얼음 공격 글자로 대신 보여 줌 */
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
    /* 대전: 섞기 결과 = 판 씨앗 + 섞기 번호(같은 상황이면 누구나 같은 섞기, 운 차이 줄이기) */
    const rr = m.duel ? mulberry(seedFrom(m.seed + ':mix:' + m.mixes)) : m.rng;
    if(m.sel != null){ setSel(m.sel, false); m.sel = null; }
    coachOff();
    for(let t = 0; t < 60; t++){
      const ord = shuffle(idx.map((_, n) => n), rr);
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
    const mv = findMove(m, true) || findMove(m); if(!mv) return;   /* 얼음 안 덮인 짝 먼저 */
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
    if(m.phase === 'deal'){ if(t >= .45){ m.phase = 'play'; if(!G.duel){ G.start = Date.now(); G.pausedMs = 0; } msg(playMsg()); sfx('linkGo'); coachOn(); } return; }   /* 대전은 모두 같은 시계(엔진 시작 시각)라 다시 맞추지 않음 */
    if(m.duel){ try{ duelLoop(); }catch(_){} }   /* 미니 화면·얼음 공격(오류가 나도 판은 계속) */
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

  /* ===== 처음 하는 사람 손가락 안내(1단계): 지울 수 있는 짝 하나를 반짝이고 손가락으로 가리킴 ===== */
  const FINGER = '<i class="lk-finger" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M11 3.5a2.5 2.5 0 0 1 5 0V14l7.5 1.6c2 .5 3.2 2.4 2.8 4.4l-1.6 7.2c-.3 1.3-1.4 2.3-2.8 2.3H13.6c-1 0-1.9-.5-2.4-1.3L5.2 20c-.9-1.4.5-3.1 2.1-2.4L11 19.5z" fill="#fff" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/></svg></i>';
  function coachOn(){
    const m = S(); if(!m || m.duel) return;
    try{ if(store.get('hp:lkCoach', 0)) return; }catch(_){ return; }
    const mv = findMove(m); if(!mv) return;
    m.coach = [mv[0], mv[1]];
    m.coach.forEach((j, n) => { const el = cellEl(j); if(el){ el.classList.add('coach'); if(!n) el.insertAdjacentHTML('beforeend', FINGER); } });
    msg('<span>반짝이는 <em class="lk-em">같은 그림 두 개</em>를 차례로 눌러요</span>');
  }
  function coachOff(){
    const m = S(); if(!m || !m.coach) return;
    m.coach = null; try{ store.set('hp:lkCoach', 1); }catch(_){}
    document.querySelectorAll('.ng-link .lk-cell.coach').forEach(e => e.classList.remove('coach'));
    document.querySelectorAll('.ng-link .lk-finger').forEach(e => e.remove());
  }

  /* ===== 대전(대전 v3 엔진, 2~5명): 상대 판 미니 화면 · 콤보 얼음 공격 =====
     - 미니 화면 = 엔진 duelMini(내 판 글자열 0 빈칸·1 타일·2 얼음 → 엔진이 0.7초마다 올리고, 다른 사람 카드에 draw로 그림).
     - 공격 = duelSend('ice', { to, n, s:섞기, c:콤보 }) → 모두가 받지만 to가 나인 사람만 얼음을 맞음(onDuelEvent).
       받는 사람: 2명이면 상대, 3명 이상이면 나를 뺀 1위(같으면 자리 순서). 내가 1위면 자연히 2위.
     - 얼음 칸 = 판 씨앗 + 보낸 사람 + 사건 번호(icePick) → 같은 판·같은 사건이면 어느 기기에서 계산해도 같은 칸.
     - 컴퓨터 상대: 같은 판을 미리 푼 순서로 미니 판을 보여 주고, 씨앗으로 정한 때에 얼음을 보냄.
       내가 보낸 얼음은 컴퓨터 미니 판에 덮이고 컴퓨터가 실제로 늦어짐(엔진 duelAiDelay).
     판 씨앗·시계·엔진 대전 값(pg·v·t·dn·sc)은 건드리지 않는다. 알림은 엔진 duelNotify. */
  const ICE_HTML = '<i class="lk-ice" aria-hidden="true"><svg viewBox="0 0 40 48" preserveAspectRatio="none"><path d="M5 9l9 8-3 9 8 6M35 7l-8 10 6 7-5 12M14 17h9M27 30l6 4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></i>';
  const AI_SLOW = 1.2, AI_SLOW_MIX = 2;   /* 컴퓨터가 얼음 한 장에 늦어지는 초 · 섞기 공격 */
  const mvStr = (b, ice) => b.map((k, i) => k == null || k === STONE ? '0' : ice && ice.has(i) ? '2' : '1').join('');
  const nb4 = (m, j) => { const x = j % m.cols, y = Math.floor(j / m.cols), r = []; if(x > 0) r.push(j - 1); if(x < m.cols - 1) r.push(j + 1); if(y > 0) r.push(j - m.cols); if(y < m.rows - 1) r.push(j + m.cols); return r; };
  const miniCard = pid => document.querySelector(`#duelBar .dmini[data-pid="${pid}"]`);
  const pubOf = pid => { try{ return duelPlayers().find(p => p.pid === pid) || null; }catch(_){ return null; } };
  /* 얼음을 고를 칸: 판 씨앗 + 열쇠로 정한 순서(같은 판·같은 사건 → 같은 칸) */
  function icePick(b, ice, n, key, seed){
    const cand = b.map((k, i) => k != null && k !== STONE && !(ice && ice.has(i)) ? i : -1).filter(i => i >= 0);
    shuffle(cand, mulberry(seedFrom(seed + ':ice:' + key)));
    return cand.slice(0, Math.max(0, Math.min(n, ICE_MAX - (ice ? ice.size : 0))));
  }
  /* 공격 받는 사람: 나를 뺀(나간 사람·끝낸 사람 빼고) 순위가 가장 높은 사람, 같으면 자리 순서 */
  function iceTarget(){
    let ps = []; try{ ps = duelPlayers(); }catch(_){ return null; }
    const c = ps.filter(p => !p.me && !p.left && !(p.st && p.st.dn));
    c.sort((a, b) => (a.rank || 9) - (b.rank || 9) || a.seat - b.seat);
    return c[0] || null;
  }
  function duelSetup(m){
    const D = G.duel;
    m.duel = true; m.seed = String(D.seed || 'duel'); m.ice = new Map(); m.frozenUntil = 0; m.chain = 0; m.lastClr = 0;
    m.evN = 0; m.inbox = []; m.iceGot = 0; m.iceSent = 0; m.sentTo = {};
    if(D.mode === 'ai'){
      /* 컴퓨터가 지우는 순서: 같은 판을 처음부터 풀어 본 순서(막히면 같은 그림 아무 짝) */
      const c = { b:m.b.slice(), cols:m.cols, rows:m.rows, turns:m.turns }, ord = [];
      for(let s = 0; s < m.pairs; s++){
        let mv = findMove(c);
        if(!mv){ const by = {}; c.b.forEach((k, i) => { if(k != null && k !== STONE) (by[k] = by[k] || []).push(i); }); const k = Object.keys(by).find(q => by[q].length >= 2); if(!k) break; mv = [by[k][0], by[k][1]]; }
        ord.push([mv[0], mv[1]]); c.b[mv[0]] = null; c.b[mv[1]] = null;
      }
      const r = mulberry(seedFrom(m.seed + ':ai-ice'));
      m.ai = { b0:m.b.slice(), ord, ice:new Map(), v:0,
        atk:[{ v:4 + Math.floor(r() * 3), n:2, shuf:0 }, { v:10 + Math.floor(r() * 4), n:3, shuf:0 }].concat(r() < .3 ? [{ v:15 + Math.floor(r() * 3), n:4, shuf:1 }] : []) };
    }
  }
  /* 짝을 지운 뒤: 옆 얼음 녹이기 · 콤보(3초 안에 연달아) → 2콤보 2장, 3콤보 3장, 4콤보 4장 + 섞기(모자란 만큼 더 보냄) */
  function duelAfterClear(a, b){
    const m = S(), now = Date.now();
    if(m.ice.size){ const melt = new Set(); [a, b].forEach(j => nb4(m, j).forEach(q => { if(m.ice.has(q)) melt.add(q); })); melt.forEach(q => iceMelt(q, true)); }
    m.chain = m.lastClr && now - m.lastClr <= COMBO_MS ? m.chain + 1 : 1; m.lastClr = now;
    const c = m.chain, add = c === 2 ? 2 : c === 3 || c === 4 ? 1 : 0;
    if(add) iceSend(add, c === 4 ? 1 : 0, c);
  }
  function iceSend(n, shuf, c){
    const m = S(), D = G.duel, to = iceTarget(); if(!to) return;
    m.evN++; m.iceSent += n; m.sentTo[to.pid] = (m.sentTo[to.pid] || 0) + n;
    try{ duelSend('ice', { to:to.pid, n, s:shuf, c }); }catch(_){}
    try{ duelNotify(`<b>${c}콤보!</b> ${esc(to.nick)}님에게 얼음 ${n}장${shuf ? ' + 섞기' : ''}`, { from:{ pid:D.myPid, me:true }, kind:'good', force:true }); }catch(_){}
    sfx('linkIceSend');
    flyIce($('#bd'), miniCard(to.pid));
    if(to.ai && m.ai){   /* 컴퓨터: 미니 판에 얼음이 덮이고 실제로 늦어짐 */
      const now = Date.now(); icePick(aiBoard(), m.ai.ice, n, 'me' + m.evN, m.seed).forEach(i => m.ai.ice.set(i, now + 600 + ICE_MS));
      try{ duelAiDelay(n * AI_SLOW + (shuf ? AI_SLOW_MIX : 0)); }catch(_){}
    }
  }
  /* 엔진이 넘겨주는 다른 사람의 사건(번호 순서대로, 나에게는 내 것이 안 옴) */
  function onEvent(ev, from){
    const m = G && G.m, d = ev && ev.data; if(!m || !m.duel || !d || ev.kind !== 'ice') return;
    const D = G.duel, n = Math.max(0, Math.min(4, +d.n || 0)), c = Math.max(0, Math.min(99, +d.c || 0));
    if(d.to === D.myPid){ if(m.phase === 'play' && !G.over) iceIncoming(n, +d.s ? 1 : 0, from.pid + ':' + ev.n, c, from); return; }
    flyIce(miniCard(from.pid), miniCard(d.to));   /* 다른 두 사람 사이 공격: 날아가는 모습만 */
  }
  /* 받은 공격: 알림 → 1초 뒤 내 판에 얼음 */
  function iceIncoming(n, shuf, key, c, from){
    const m = S(); if(!n) return;
    m.inbox.push({ at:Date.now() + 1000, n, shuf, key });
    try{ duelNotify(`${esc(from ? from.nick : '상대')}님이 얼음 ${n}장!${shuf ? ' + 섞기' : ''}${c ? ` <small>${c}콤보</small>` : ''}`, { from, kind:'bad', force:true }); }catch(_){}
    sfx('linkIceWarn');
    flyIce(from ? miniCard(from.pid) : null, $('#bd'));
  }
  function iceApply(it){
    const m = S(), now = Date.now();
    if(it.shuf){ msg('<b class="ice">섞기 공격!</b><span>판이 섞였어요</span>', 'lk-pop'); mixBoard(); }
    const pick = icePick(m.b, m.ice, it.n, it.key, m.seed);
    pick.forEach(i => { m.ice.set(i, now + ICE_MS); if(m.sel === i){ setSel(i, false); m.sel = null; } const el = cellEl(i); if(el) el.outerHTML = cellHtml(i); });
    m.iceGot += pick.length;
    try{ pick.forEach(i => { const el = cellEl(i); if(el){ const q = fxCenter(el); fxBurst(q.x, q.y, ['#BFE6FF', '#FFFFFF', '#7CCBFF'], 7, { speed:160, size:4, kinds:['spark','dot'], up:40, g:300, dur:.5 }); } }); }catch(_){}
    if(pick.length) sfx('linkIceHit');
    if(!findMove(m)) autoMix();
    T(() => { if(m.phase === 'play') msg(playMsg()); }, 1300);
  }
  function iceMelt(i, byClear){
    const m = S(); if(!m.ice.has(i)) return;
    m.ice.delete(i);
    const el = cellEl(i); if(el && !el.classList.contains('gone')) el.outerHTML = cellHtml(i);
    try{ const e2 = cellEl(i); if(e2){ const q = fxCenter(e2); fxBurst(q.x, q.y + 4, ['#7CCBFF', '#BFE6FF', '#FFFFFF'], 3, { speed:90, size:4.5, kinds:['dot'], up:-20, g:600, dur:.55 }); } }catch(_){}
    if(byClear) sfx('linkMelt');
  }
  /* 컴퓨터 판: 처음 판에서 지운 짝 수만큼 지운 모습 + 내가 보낸 얼음 */
  function aiBoard(){ const m = S(), a = m.ai, b = a.b0.slice(); for(let s = 0; s < Math.max(0, a.v) && s < a.ord.length; s++){ b[a.ord[s][0]] = null; b[a.ord[s][1]] = null; } return b; }
  function aiTick(now){
    const m = S(), D = G.duel, a = m.ai; if(!a || !D.go) return;
    const P = (D.P || {}).ai, st = (P && P.st) || {};
    a.v = Math.max(0, Math.min(m.pairs, Math.floor(st.v || 0)));
    const b = aiBoard(); a.ice.forEach((t, i) => { if(now >= t || b[i] == null) a.ice.delete(i); });
    if(!st.dn && m.phase === 'play') a.atk.forEach((k, n) => { if(!k.done && a.v >= k.v){ k.done = 1; iceIncoming(k.n, k.shuf, 'ai' + n, k.n, pubOf('ai')); } });
  }
  /* 미니 화면(엔진 카드 안 그림 칸 약 60×42): 남은 타일 · 얼음 · 방금 지운 두 칸 0.3초 반짝 */
  const miniGet = () => { const m = G && G.m; return m && m.duel ? mvStr(m.b, m.ice) : ''; };
  function miniDraw(el, s, p){
    const m = G && G.m; if(!el || !m) return;
    if(p && p.ai && m.ai) s = mvStr(aiBoard(), m.ai.ice);   /* 컴퓨터는 판 글자 대신 미리 푼 순서로 */
    s = String(s || '').replace(/[^012]/g, '0');
    if(el._lk === s) return;
    const prev = el._lk || ''; el._lk = s;
    const C = m.cols, R = m.rows, u = 6;
    let h = '';
    for(let i = 0; i < C * R; i++){
      const x = (i % C) * u + .5, y = Math.floor(i / C) * u + .5, c = s[i] || '0';
      if(c === '1') h += `<rect x="${x}" y="${y}" width="5" height="5" rx="1.2" class="t"/>`;
      else if(c === '2') h += `<rect x="${x}" y="${y}" width="5" height="5" rx="1.2" class="i"/>`;
      else if(prev.length === s.length && prev[i] && prev[i] !== '0') h += `<rect x="${x - .5}" y="${y - .5}" width="6" height="6" rx="1.4" class="f"/>`;
    }
    el.innerHTML = `<svg class="lk-mb" viewBox="0 0 ${C * u} ${R * u}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${h}</svg>`;
  }
  function duelLoop(){
    const m = S(), D = G.duel, now = Date.now(); if(!D) return;
    if(m.ice.size) m.ice.forEach((t, i) => { if(now >= t) iceMelt(i, false); });
    if(m.frozenUntil && now >= m.frozenUntil){ m.frozenUntil = 0; const bd = $('#bd'); if(bd) bd.classList.remove('frozen'); }
    if(D.mode === 'ai') aiTick(now);
    /* 받은 공격 적용: 판이 움직이는 중(지우기·섞기)이면 잠깐 기다림 */
    if(m.inbox.length && m.phase === 'play' && !m.lock && now >= m.inbox[0].at) iceApply(m.inbox.shift());
    if(m.phase !== 'play') m.inbox.length = 0;
  }
  /* 얼음 조각이 날아가는 모습(보이기만 함) */
  function flyIce(from, to){
    try{
      if(!from || !to || FXR.reduce) return;
      const a = fxCenter(from), b = fxCenter(to), d = document.createElement('div');
      d.className = 'lk-fly'; d.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1l2.6 6.4L19 10l-6.4 2.6L10 19l-2.6-6.4L1 10l6.4-2.6z" fill="#BFE6FF" stroke="#1A0F45" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      d.style.left = a.x + 'px'; d.style.top = a.y + 'px'; document.body.appendChild(d);
      const an = d.animate([{ transform:'translate(-50%,-50%) scale(.6)', opacity:0 }, { transform:`translate(calc(-50% + ${(b.x - a.x) * .5}px), calc(-50% + ${(b.y - a.y) * .5 - 40}px)) scale(1.3) rotate(180deg)`, opacity:1, offset:.5 }, { transform:`translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.8) rotate(360deg)`, opacity:.2 }], { duration:800, easing:'ease-in-out' });
      an.onfinish = () => d.remove(); setTimeout(() => d.remove(), 1200);
    }catch(_){}
  }

  function cellHtml(i){
    const m = S(), k = m.b[i], x = i % m.cols, y = Math.floor(i / m.cols);
    if(k == null) return `<span class="lk-cell empty" data-i="${i}" aria-hidden="true"></span>`;
    if(k === STONE) return `<span class="lk-cell stone" data-i="${i}" role="img" aria-label="돌 ${y + 1}행 ${x + 1}열"><span class="lk-face">${STONE_SVG}</span></span>`;
    const iced = m.ice && m.ice.has(i);
    return `<button class="lk-cell tile${k === CLOCK ? ' clk' : ''}${m.sel === i ? ' sel' : ''}${iced ? ' iced' : ''}" data-i="${i}" aria-label="${symName(k)} ${y + 1}행 ${x + 1}열${iced ? ', 얼음' : ''}"><span class="lk-face">${symSvg(k)}</span>${iced ? ICE_HTML : ''}</button>`;
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

  /* 도움말 그림(320×180, 움직임·글자 없음): 별 두 개를 차례로 누르면 두 번 꺾인 선이 그어지고 둘 다 사라짐 */
  function howPic(){
    const W = 40, H = 48, SX = 46, SY = 54, X0 = 48, Y0 = 52, dur = '3.6s', at = (c, r) => [X0 + c * SX, Y0 + r * SY];
    const tile = (c, r, k, extra) => { const [x, y] = at(c, r); return `<g>${extra || ''}<rect x="${x}" y="${y + 4}" width="${W}" height="${H - 4}" rx="8" fill="#7FC9A0" stroke="#1A0F45" stroke-width="2.4"/><rect x="${x}" y="${y}" width="${W}" height="${H - 4}" rx="8" fill="#FFFDF4" stroke="#1A0F45" stroke-width="2.4"/><g transform="translate(${x + 5} ${y + 4}) scale(${((W - 10) / 64).toFixed(4)})">${SYM[k][2]}</g></g>`; };   /* 안쪽 <svg>는 도움말 CSS(svg 100%)에 늘어나므로 g로 */
    const lift = kt => `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -5;0 -5;0 0" keyTimes="${kt}" dur="${dur}" repeatCount="indefinite"/>`;
    const gone = `<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.55;.66;.93;1" dur="${dur}" repeatCount="indefinite"/>`;
    const [ax, ay] = at(0, 1), [bx, by] = at(3, 0), cxA = ax + W / 2, cxB = bx + W / 2, top = Y0 - 18;
    const d = `M${cxA} ${ay + H / 2 - 2}V${top}H${cxB}V${by + H / 2 - 2}`;
    const rest = [[1, 0, 'leaf'], [2, 0, 'drop'], [4, 0, 'moon'], [1, 1, 'cherry'], [2, 1, 'gem'], [3, 1, 'leaf'], [4, 1, 'drop']].map(([c, r, k]) => tile(c, r, k)).join('');
    const line = w => `<path d="${d}" fill="none" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" ${w}><animate attributeName="stroke-dashoffset" values="100;100;0;0;100" keyTimes="0;.3;.48;.93;1" dur="${dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.29;.3;.6;.68;1" dur="${dur}" repeatCount="indefinite"/></path>`;
    const finger = `<g opacity="0"><animate attributeName="opacity" values="0;1;1;1;0;0" keyTimes="0;.04;.14;.26;.3;1" dur="${dur}" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="${cxA + 6} ${ay + 34};${cxA + 6} ${ay + 34};${cxB + 6} ${by + 34};${cxB + 6} ${by + 34}" keyTimes="0;.12;.2;1" dur="${dur}" repeatCount="indefinite"/><path d="M0 0c0-6 8-6 8 0v12c4-3 10-1 9 5l-3 11c-1 4-5 7-9 7h-6c-4 0-7-2-9-6l-5-11c-2-4 3-6 6-3l3 3z" fill="#fff" stroke="#1A0F45" stroke-width="2.6" stroke-linejoin="round"/></g>`;
    const ring = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#FFE27A" stroke-width="5" opacity="0"><animate attributeName="r" values="6;6;40;40" keyTimes="0;.55;.7;1" dur="${dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.55;.57;.7;1" dur="${dur}" repeatCount="indefinite"/></circle>`;
    return `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="같은 별 두 개를 누르면 두 번 꺾인 선으로 이어져 사라지는 그림">
      <rect width="320" height="180" fill="#DFF7E6"/><rect x="${X0 - 12}" y="${Y0 - 30}" width="${SX * 5 + 18}" height="${SY * 2 + 36}" rx="18" fill="#BFEBD0" stroke="#1A0F45" stroke-width="3"/>
      ${rest}
      <g>${gone}<g>${lift('0;.06;.1;.55;.6')}${tile(0, 1, 'star')}</g></g>
      <g>${gone}<g>${lift('0;.16;.2;.55;.6')}${tile(3, 0, 'star')}</g></g>
      ${line('stroke="#1A0F45" stroke-width="9"')}${line('stroke="#FFB020" stroke-width="5"')}
      ${ring(cxA, ay + H / 2)}${ring(cxB, by + H / 2)}${finger}
    </svg>`;
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
      ['같은 그림 두 개를 눌러요', '같은 그림 타일 두 개를 차례로 눌러요. 고른 타일을 다시 누르면 취소돼요.'],
      ['선이 두 번까지 꺾여 이어지면 사라져요', '선은 빈칸과 판 바깥 테두리로만 지나가요. 꺾이는 곳이 두 번까지면 OK!'],
      ['판을 다 비우면 성공', '시간 안에 모든 짝을 지우면 성공! 막히면 💡힌트·섞기(점수 조금 줄어요). 짝이 하나도 없으면 저절로 섞여요.'],
      ['틀리면 기회 ★ 하나', '다른 그림·막힌 짝을 고르면 기회를 잃고, 세 번 틀리면 끝나요. 대전은 끝나지 않고 −25점 + 1초 쉬기, 3초 안에 연달아 지우면 상대 판에 얼음을 보내요.']
    ],
    /* 도움말 v2: 그림 + 3줄(더 알아보기 = help) */
    howto:{ pic:howPic, lines:['같은 그림 두 개를 눌러요', '선이 두 번까지 꺾여 이어지면 사라져요', '판을 다 비우면 성공'] },
    helpExtra(){ const m = G && G.id === 'link' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['꽃밭 산책','과일 장터','별빛 정원','바닷가 마을','눈꽃 궁전'],
    starRule:'★ 클리어 · ★★ 힌트·섞기·실수 1번 이하 · ★★★ 힌트·섞기·실수 없이',
    get levels(){ return lvTable(); },   /* 2026-10-07부터 짧은 판(LV_NEW), 그 전 날짜는 LV_OLD */
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.cols}×${c.rows} · ${c.pairs}짝 · ${mmss(c.limit)}${c.lives === 1 ? ' · 기회 1번' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.cols}×${c.rows} · ${c.pairs}짝`; },
    init(cfg, rng){
      if(G.duel && !G.duel.fleet && !cfg.duelOwn) cfg = Object.assign({}, DUEL_CFG, G.duel.slow ? { limit:DUEL_CFG.limit * 2 } : {});   /* 대전 전용 판(6×8 · 20짝 · 2분) */
      const d = deal(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { cols:cfg.cols, rows:cfg.rows, pairs:cfg.pairs, b:d.b, id:d.b.map((k, i) => k != null && k !== STONE ? i : null), turns:cfg.turns || 2, slide:!!cfg.slide, tick:cfg.tick || 0,
        sel:null, lock:false, found:0, combo:0, best:0, misses:0, hints:0, mixes:0, manualMix:0, autoMix:0, pen:0, bonus:0,
        hintLeft:cfg.hints == null ? 3 : cfg.hints, mixLeft:cfg.mixes == null ? 2 : cfg.mixes, lives:G.duel ? 0 : cfg.lives || LIVES,   /* 대전은 기회 제한 없음(0) — 틀려도 끝나지 않고 점수만 깎인다 */
        phase:'deal', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, rng, lastSec:-1, sec:0, fail:null, timers:new Set(), geo:{ cw:40, ch:48, gap:3, pad:12 } };
      G.limit = cfg.limit; if(G.m.lives) G.paws = G.m.lives;
      const m = G.m;
      if(G.duel && !G.duel.fleet) duelSetup(m);
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
          const mv = findMove(m, true); if(!mv){ setTimeout(step, 60); return; }
          tap(mv[0]); tap(mv[1]); setTimeout(step, 40);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _stepForTest(){ const m = G && G.m; if(!m || m.lock || m.phase !== 'play') return false; const mv = findMove(m, true); if(!mv) return false; tap(mv[0]); tap(mv[1]); return true; },
    _missForTest(){ const m = G && G.m; if(!m || m.phase !== 'play') return false; const t = m.b.map((k, i) => k != null && k !== STONE && !(m.ice && m.ice.has(i)) ? i : -1).filter(i => i >= 0); const a = t[0], b = t.find(j => m.b[j] !== m.b[a]); if(b == null) return false; tap(a); tap(b); return true; },
    _deal:deal, _search:search, _stage:stageCfg,
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-link">
        <div class="hud-row">
          <div class="hchip" aria-label="지운 짝"><span class="hv">${ICO.pair}<b id="lkFound">0</b><small>/${m.pairs}</small></span><em>지운 짝</em></div>
          <div class="hchip time" id="lkTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="lkTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
          <button class="hchip item" id="lkHint" aria-label="힌트"><span class="hv">${ICO.hint}<b>${m.hintLeft}</b></span><em>힌트</em></button>
          <button class="hchip skip" id="lkMix" aria-label="섞기"><span class="hv">${ICO.mix}<b>${m.mixLeft}</b></span><em>섞기</em></button>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="lk-rules" aria-label="켜진 규칙">${m.boss ? '<span class="lk-chip boss">대장 판</span>' : ''}${m.mj.map(k => `<span class="lk-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="lk-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="hbar lk-tbar" id="lkBarWrap"><i id="lkBar"></i></div>
        <div class="lk-row">${m.duel ? '' : '<div class="hlives" id="lkLives" role="img"></div>'}<div class="lk-msg" id="lkMsg"><span>타일을 놓는 중…</span></div></div>
        <div class="lk-wrap"><div class="lk-board in" id="bd" role="grid" aria-label="타일 판"><svg class="lk-path" id="lkPath" aria-hidden="true"></svg></div></div>
      </div>`;
      build(); wire(); hud();
      T(() => { const b = $('#bd'); if(b) b.classList.remove('in'); }, 900);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    /* 대전 v3(2~5명 경주): 대전 판·느긋하게·미니 화면·얼음 사건 */
    duelKind:'race', duelMax:5, duelEnd:'first',
    duelMini:{ get:miniGet, draw:miniDraw },
    onDuelEvent:onEvent,
    duelCfg(){ return Object.assign({}, DUEL_CFG, { duelOwn:1 }); },
    duelSlow(cfg){ return Object.assign({}, cfg, { limit:(cfg.limit || DUEL_CFG.limit) * 2 }); },
    _duelState(){ const m = G && G.m, D = G && G.duel; if(!m || !m.duel) return null;
      const minis = {}; try{ D.pl.forEach(pid => { if(pid !== D.myPid) minis[pid] = (D.P[pid] || {}).mv || ''; }); }catch(_){}
      return { me:D.myPid, mv:mvStr(m.b, m.ice), ice:[...m.ice.keys()].sort((a, b) => a - b), minis, evN:m.evN, got:m.iceGot, sent:m.iceSent, sentTo:Object.assign({}, m.sentTo), frozen:m.frozenUntil > Date.now(), aiIce:m.ai ? m.ai.ice.size : null, aiT:D.ai ? D.ai.T : null }; },
    _iceTest(n, shuf){ const m = G && G.m; if(m && m.duel) iceIncoming(n, shuf ? 1 : 0, 'test' + (++m.evN), n, pubOf('ai')); },
    _icePick:icePick,
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
.ng-link .hud-row{margin:0}
.ng-link .hchip.time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-link .hchip.time.hurry b{text-shadow:0 2px 0 #8E0F2F}
.ng-link .hchip.time.hurry em{color:#fff}
.ng-link .hchip:is(button){-webkit-tap-highlight-color:transparent}
.ng-link .lk-tbar{margin:8px 0 0; height:10px}
.ng-link .lk-tbar > i{width:100%; transform-origin:left center; transition:none; background:linear-gradient(180deg,#9EF0B8,#27B86A)}
.ng-link .lk-tbar.hurry > i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-link .lk-row{display:flex; align-items:center; gap:8px; width:100%; height:38px}
.ng-link .hlives{flex:none}
.ng-link .hlives i.lost{animation:link-lost .5s ease-out}
.ng-link .hlives.last{background:#FFE3E3; animation:link-last 1s ease-in-out infinite alternate}
@keyframes link-lost{0%{transform:scale(1.6); color:#FFE27A} 100%{transform:none}}
.ng-link .hlives i{display:inline-block}
@keyframes link-last{to{box-shadow:0 0 10px 3px rgba(255,77,109,.6)}}
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
.ng-link .lk-wrap{position:relative}
.ng-link .lk-msg em.lk-em{font-style:normal; font-family:var(--heavy); color:#B8541A}
.ng-link .lk-msg b.ice{color:#BFE6FF}
/* 손가락 안내(처음 한 번) */
.ng-link .lk-cell.coach .lk-face{animation:link-hint .7s ease-in-out infinite alternate}
.ng-link .lk-finger{position:absolute; right:-10px; bottom:-14px; width:30px; height:30px; z-index:5; pointer-events:none; animation:link-finger .8s ease-in-out infinite alternate; filter:drop-shadow(0 2px 0 rgba(26,15,69,.35))}
.ng-link .lk-finger svg{width:100%; height:100%; display:block}
@keyframes link-finger{from{transform:translate(4px,6px)} to{transform:translate(-2px,-2px)}}
/* 대전: 상대 미니 판 카드(72×64) · 얼음 덮개 · 1초 쉬기 · 판 위 알림 */
/* 대전: 엔진 미니 카드(#duelBar .dmini) 안 판 그림 · 얼음 덮개 · 1초 쉬기 */
body[data-mode="link"] .dmini .lk-mb{display:block; width:100%; height:100%}
body[data-mode="link"] .dmini .lk-mb .t{fill:#7FD3A6; stroke:#1A0F45; stroke-width:.6}
body[data-mode="link"] .dmini .lk-mb .i{fill:#BFE6FF; stroke:#2F7BFF; stroke-width:.9}
body[data-mode="link"] .dmini .lk-mb .f{fill:#FFE27A; animation:link-mf .3s ease-out forwards}
@keyframes link-mf{to{opacity:0}}
.ng-link .lk-ice{position:absolute; left:0; right:0; top:0; bottom:4px; border-radius:calc(var(--cw) * .2); background:rgba(191,230,255,.72); border:2.2px solid #2F7BFF; box-shadow:inset 0 0 0 2px rgba(255,255,255,.7); pointer-events:none; animation:link-ice-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-link .lk-ice svg{position:absolute; inset:8%; width:84%; height:84%}
@keyframes link-ice-in{from{transform:scale(1.5); opacity:0}}
.ng-link .lk-cell.iced{cursor:not-allowed}
.ng-link .lk-board.frozen{filter:saturate(.45) brightness(.96)}
.ng-link .lk-board.frozen .lk-cell.tile{cursor:wait}
body[data-mode="link"] .lk-fly{position:fixed; width:26px; height:26px; z-index:60; pointer-events:none}
body[data-mode="link"] .lk-fly svg{width:100%; height:100%; display:block}
@media (max-width:370px){ .ng-link .lk-msg b{font-size:18px} .ng-link .lk-chip{font-size:13px; padding:4px 7px} }
@media (prefers-reduced-motion: reduce){ .ng-link .lk-line path{animation:link-fade .52s ease-in forwards; stroke-dasharray:none} .ng-link .lk-board.in .lk-cell.tile, .ng-link .lk-cell.mixin .lk-face, .ng-link .lk-cell.hint .lk-face{animation:none} }
`,
    sounds:{
      linkPick(o){ if(o.off){ aTone({ f:660, f2:520, type:'triangle', d:.06, v:.04 }); return; } aNoise({ ft:'bandpass', f:2800, q:2, d:.04, v:.06 }); aTone({ f:880, f2:1040, type:'triangle', d:.07, v:.05 }); },
      linkIceNo(){ aTone({ f:1500, f2:1200, type:'triangle', d:.06, v:.04 }); aNoise({ ft:'highpass', f:5000, d:.05, v:.04 }); },
      linkIceSend(){ aWhoosh({ f:600, f2:3600, a:.02, d:.3, v:.06 }); aSparkle({ root:88, n:4, t:.05, v:.035 }); },
      linkIceWarn(){ aTone({ f:1046, f2:880, type:'square', lp:2400, d:.09, v:.045, bus:'ui' }); aTone({ f:1046, f2:880, type:'square', lp:2400, t:.14, d:.09, v:.045, bus:'ui' }); },
      linkIceHit(){ aNoise({ ft:'highpass', f:3500, d:.18, v:.08 }); aBell({ f:m2f(91), d:.5, v:.05, idx:2, rev:.4 }); },
      linkMelt(){ aBell({ f:m2f(84), d:.3, v:.05, rev:.3 }); aTone({ f:700, f2:1300, type:'sine', t:.04, d:.1, v:.04 }); },
      linkMatch(o){ const n = Math.min(10, o.n || 0); aWhoosh({ f:900, f2:3600, a:.01, d:.18, v:.06 });   /* 선 그어질 때 '슝' */ aBell({ f:penta(n + 4, 72), t:.05, d:.6, v:.085, idx:1.4, rev:.35 }); aBell({ f:penta(n + 6, 72), t:.12, d:.7, v:.07, idx:1.2, rev:.4 }); if(n >= 2) aSparkle({ root:84 + Math.min(7, n), n:4, t:.16, v:.03 }); },
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
Object.assign(NG.link, { duelPace:[85,.72], duelStat:{ unit:"짝", get:() => ({ v:G.m.found, t:G.m.pairs, lf:G.m.lives ? Math.max(0, G.m.lives - G.m.misses) : null, mis:G.m.misses }) } });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.link.scene = { kind:'motes', colors:['#FFFFFF','#B8F0D0','#FFF3B0'], density:1 };
