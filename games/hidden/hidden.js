/* 숨은그림 찾기 */
/* ===== 숨은그림 찾기 (hidden) · 하루퍼즐 리그 게임 모듈 =====
   씨앗 난수(rng)로 장면(SVG)을 그린다: 배경(숲·바닷속·다락방·장터·꽃밭·눈 마을) 위에 꾸밈 도형·선·무늬를 잔뜩 깔고,
   그 사이에 찾을 물건(직접 그린 단순 SVG 26종)을 작게·기울여·배경과 같은 색과 선으로 섞어 숨긴다.
   아래 목록의 물건을 장면에서 찾아 누르면 동그라미. 빗나간 누르기는 실수(잠깐 못 누름 + 감점).
   그림은 모두 직접 그린 오리지널. 문제 내용은 rng로만 만든다. */
NG.hidden = (() => {
  const W = 360, H = 480;            /* 장면 좌표(세로 3:4) */
  const INK = '#1A0F45';
  const r1 = n => Math.round(n * 10) / 10;
  const R = (rng, a, b) => a + rng() * (b - a);
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];
  const st = (K, w) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const starPath = (cx, cy, Ro, Ri, n = 5) => { let d = ''; for(let i = 0; i < n * 2; i++){ const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? Ri : Ro; d += (i ? 'L' : 'M') + r1(cx + Math.cos(a) * rr) + ' ' + r1(cy + Math.sin(a) * rr); } return d + 'z'; };

  /* ----- 찾을 물건: [이름, (채움 F, 포인트 A, 선 K, 선 굵기 w) => SVG] — 중심 (0,0), 반지름 약 18 안 ----- */
  const ITEMS = {
    spoon:['숟가락', (F, A, K, w) => `<ellipse cx="0" cy="-9" rx="6.5" ry="8.5" fill="${F}" ${st(K, w)}/><path d="M-1.8 -.8L-2.2 16Q0 18.5 2.2 16L1.8 -.8z" fill="${F}" ${st(K, w)}/>`],
    key:['열쇠', (F, A, K, w) => `<path d="M-4 -2.4H17V2.4H14V7.5H10V2.4H7V5.5H3V2.4H-4z" fill="${F}" ${st(K, w)}/><circle cx="-10" cy="0" r="7.5" fill="${A}" ${st(K, w)}/><circle cx="-10" cy="0" r="2.6" fill="${K}"/>`],
    umbrella:['우산', (F, A, K, w) => `<path d="M0 0V13Q0 17.5-4 17.5Q-7.5 17.5-7.5 14" fill="none" ${st(K, w * 1.3)}/><path d="M-17 0A17 15 0 0 1 17 0Q11.3-4 5.7 0Q0-4-5.7 0Q-11.3-4-17 0z" fill="${F}" ${st(K, w)}/><path d="M0-15V-18.5M0-15Q-4-8-5.7 0M0-15Q4-8 5.7 0" fill="none" ${st(K, w * .8)}/>`],
    fish:['물고기', (F, A, K, w) => `<path d="M7 0L18-8.5V8.5z" fill="${A}" ${st(K, w)}/><path d="M-17 0Q-5-11.5 10 0Q-5 11.5-17 0z" fill="${F}" ${st(K, w)}/><circle cx="-10" cy="-1.5" r="1.9" fill="${K}"/><path d="M-3-5Q-.5 0-3 5" fill="none" ${st(K, w * .8)}/>`],
    star:['별', (F, A, K, w) => `<path d="${starPath(0, 1.5, 18, 7.6)}" fill="${F}" ${st(K, w)}/>`],
    glasses:['안경', (F, A, K, w) => `<path d="M-2.5 0Q0-3 2.5 0M-16 0L-19-7M16 0L19-7" fill="none" ${st(K, w * 1.2)}/><circle cx="-9" cy="2" r="7" fill="${F}" ${st(K, w * 1.2)}/><circle cx="9" cy="2" r="7" fill="${F}" ${st(K, w * 1.2)}/>`],
    pencil:['연필', (F, A, K, w) => `<path d="M-13-4.5H9L17.5 0L9 4.5H-13z" fill="${F}" ${st(K, w)}/><path d="M9-4.5L17.5 0L9 4.5z" fill="${A}" ${st(K, w)}/><path d="M14-1.6L17.5 0L14 1.6z" fill="${K}"/><rect x="-18.5" y="-4.5" width="5.5" height="9" rx="1.6" fill="${A}" ${st(K, w)}/><path d="M-13 0H8" ${st(K, w * .6)}/>`],
    sock:['양말', (F, A, K, w) => `<path d="M-7-17H6V1Q6 5 10 7.5L14 10Q18.5 13 15.5 17Q13 19.5 8.5 18L-2 14Q-8.5 11.5-7.5 4z" fill="${F}" ${st(K, w)}/><path d="M-7-17H6V-11H-7z" fill="${A}" ${st(K, w)}/>`],
    moon:['초승달', (F, A, K, w) => `<path d="M6-16A17 17 0 1 0 6 16A20 20 0 0 1 6-16z" fill="${F}" ${st(K, w)}/>`],
    cup:['머그컵', (F, A, K, w) => `<path d="M10-6H13.5Q18.5-6 18.5 1Q18.5 8 13.5 8H10" fill="none" ${st(K, w * 1.5)}/><path d="M-14-13H11V10Q11 16 5 16H-8Q-14 16-14 10z" fill="${F}" ${st(K, w)}/><path d="M-14-6H11" ${st(K, w * .8)}/>`],
    bell:['종', (F, A, K, w) => `<circle cx="0" cy="13" r="3.4" fill="${A}" ${st(K, w)}/><path d="M0-17.5Q-3-17.5-3-14.5Q-11-12.5-11 0V6L-15.5 11H15.5L11 6V0Q11-12.5 3-14.5Q3-17.5 0-17.5z" fill="${F}" ${st(K, w)}/>`],
    hammer:['망치', (F, A, K, w) => `<rect x="-3" y="-6" width="6" height="24" rx="2" fill="${A}" ${st(K, w)}/><path d="M-16-15H10Q16-15 16-10V-6H-16z" fill="${F}" ${st(K, w)}/>`],
    scissors:['가위', (F, A, K, w) => `<path d="M-2.5 1L9-18L4-1z" fill="${F}" ${st(K, w)}/><path d="M2.5 1L-9-18L-4-1z" fill="${F}" ${st(K, w)}/><circle cx="-6.5" cy="9" r="6" fill="none" ${st(K, w * 1.6)}/><circle cx="6.5" cy="9" r="6" fill="none" ${st(K, w * 1.6)}/><circle cx="0" cy="-1" r="1.6" fill="${K}"/>`],
    mitten:['장갑', (F, A, K, w) => `<path d="M-9 3Q-17 1-16-5Q-15-11-9-7z" fill="${F}" ${st(K, w)}/><path d="M-9 17V-4Q-9-16 1-16Q11-16 11-4V17z" fill="${F}" ${st(K, w)}/><path d="M-10 11H12V18H-10z" fill="${A}" ${st(K, w)}/>`],
    hat:['모자', (F, A, K, w) => `<ellipse cx="0" cy="8" rx="18.5" ry="5.5" fill="${F}" ${st(K, w)}/><path d="M-10 8V-6Q-10-13 0-13Q10-13 10-6V8z" fill="${F}" ${st(K, w)}/><path d="M-10 1H10V5.5H-10z" fill="${A}" ${st(K, w * .8)}/>`],
    feather:['깃털', (F, A, K, w) => `<path d="M-13 15Q-12-4 13-17.5Q9 3-13 15z" fill="${F}" ${st(K, w)}/><path d="M-17 18.5L9-10M-4 5L2-3M-8 8L-1 9" fill="none" ${st(K, w * .9)}/>`],
    banana:['바나나', (F, A, K, w) => `<path d="M-16-7Q-12 14 14 10Q18 9 16 5.5Q-6 8-12-9Q-14.5-12-16-7z" fill="${F}" ${st(K, w)}/><path d="M-16-7L-17.5-11" ${st(K, w * 1.6)}/>`],
    apple:['사과', (F, A, K, w) => `<path d="M0-8Q-6-12-12-8Q-18-2-14 8Q-10 17-4 16Q0 14 4 16Q10 17 14 8Q18-2 12-8Q6-12 0-8z" fill="${F}" ${st(K, w)}/><path d="M0-8Q0-14 3-17.5" fill="none" ${st(K, w)}/><path d="M2-13Q8-18.5 12.5-14Q7-10 2-13z" fill="${A}" ${st(K, w * .8)}/>`],
    candle:['양초', (F, A, K, w) => `<path d="M0-18.5Q5.5-12 0-7.5Q-5.5-12 0-18.5z" fill="${A}" ${st(K, w * .8)}/><path d="M0-7.5V-5" ${st(K, w)}/><rect x="-5.5" y="-5" width="11" height="21" rx="1.5" fill="${F}" ${st(K, w)}/><path d="M-9 16H9" ${st(K, w * 1.3)}/>`],
    kite:['연', (F, A, K, w) => `<path d="M0 10Q-5 13 0 15Q5 17 0 19.5" fill="none" ${st(K, w)}/><path d="M0-18L11.5-4L0 10L-11.5-4z" fill="${F}" ${st(K, w)}/><path d="M0-18V10M-11.5-4H11.5" fill="none" ${st(K, w * .8)}/><path d="M-3 15L3 15" ${st(A, w * 1.6)}/>`],
    bottle:['병', (F, A, K, w) => `<path d="M-3.5-15H3.5V-11Q8.5-8 8.5-2V15Q8.5 18.5 5 18.5H-5Q-8.5 18.5-8.5 15V-2Q-8.5-8-3.5-11z" fill="${F}" ${st(K, w)}/><rect x="-4.5" y="-19" width="9" height="4.5" rx="1.2" fill="${A}" ${st(K, w)}/><rect x="-8.5" y="2" width="17" height="8" fill="${A}" ${st(K, w * .8)}/>`],
    ring:['반지', (F, A, K, w) => `<path d="M0-6A11 11 0 1 1 0 16A11 11 0 1 1 0-6zM0-1.5A6.5 6.5 0 1 0 0 11.5A6.5 6.5 0 1 0 0-1.5z" fill="${F}" fill-rule="evenodd" ${st(K, w)}/><path d="M-5.5-10L0-17L5.5-10L0-4.5z" fill="${A}" ${st(K, w)}/>`],
    boot:['장화', (F, A, K, w) => `<path d="M-10-17H4V1L14 6Q18.5 8.5 18.5 12.5V17H-10z" fill="${F}" ${st(K, w)}/><path d="M-10 13H18.5V17H-10zM-10-17H4V-12H-10z" fill="${A}" ${st(K, w * .8)}/>`],
    hook:['낚싯바늘', (F, A, K, w) => `<path d="M4-14V8Q4 16-3.5 16Q-11 16-11 9L-6.5 12" fill="none" ${st(K, w * 2.8)}/><path d="M4-14V8Q4 16-3.5 16Q-11 16-11 9L-6.5 12" fill="none" ${st(F, w * 1.1)}/><circle cx="4" cy="-15.5" r="3" fill="${A}" ${st(K, w)}/>`],
    plane:['비행기', (F, A, K, w) => `<path d="M-18 2L17.5-13L4.5 14.5L-1 5.5z" fill="${F}" ${st(K, w)}/><path d="M17.5-13L-1 5.5L-2.5 13.5L4.5 14.5" fill="${A}" ${st(K, w)}/>`],
    flag:['깃발', (F, A, K, w) => `<path d="M-10-17V18.5" ${st(K, w * 1.5)}/><path d="M-10-16Q0-20 6-14Q11-9 17.5-12V4Q11 7 6 2Q0-4-10 0z" fill="${F}" ${st(K, w)}/><circle cx="-10" cy="-18" r="2.4" fill="${A}" ${st(K, w * .8)}/>`]
  };
  const POOL = Object.keys(ITEMS);
  const IR = 18;   /* 물건 기본 반지름(장면 단위) */
  const ZX = 62, ZY = 114;   /* 오른쪽 아래 확대 단추 자리(장면 단위) — 물건을 두지 않는다 */
  const itemSvg = (k, F, A, K, w) => ITEMS[k][1](F, A, K, w);
  const iconSvg = (k, shadow) => `<svg viewBox="-21 -21 42 42" aria-hidden="true">${shadow ? itemSvg(k, '#3B3160', '#3B3160', '#3B3160', 2.4) : itemSvg(k, '#FFF3D6', '#FFB84D', INK, 2.6)}</svg>`;

  /* ----- 꾸밈 조각(배경과 같은 선·색 → 물건이 섞여 숨는다). (rng, x, y, P) → SVG. 물건과 닮은 모양(별·달·물고기 등)은 쓰지 않는다 ----- */
  const blob = (rng, x, y, rx, ry, n = 7) => {
    const p = Array.from({ length:n }, (_, i) => { const a = i / n * Math.PI * 2, k = R(rng, .82, 1.14); return [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]; });
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = 'M' + mid(p[n - 1], p[0]).map(r1).join(' ');
    for(let i = 0; i < n; i++){ const m = mid(p[i], p[(i + 1) % n]); d += 'Q' + p[i].map(r1).join(' ') + ' ' + m.map(r1).join(' '); }
    return d + 'z';
  };
  const C = (rng, P) => pick(rng, P.c);
  const SM = {
    dots:(rng, x, y, P) => { const c = C(rng, P); return Array.from({ length:3 + Math.floor(rng() * 3) }, () => `<circle cx="${r1(x + R(rng, -9, 9))}" cy="${r1(y + R(rng, -9, 9))}" r="${r1(R(rng, 1.6, 3.6))}" fill="${c}" ${st(P.k, 1.4)}/>`).join(''); },
    squig:(rng, x, y, P) => { const L = R(rng, 18, 34), a = R(rng, 0, 180); return `<path d="M${-L / 2} 0q${L / 8} -6 ${L / 4} 0t${L / 4} 0t${L / 4} 0t${L / 4} 0" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(a)})" fill="none" ${st(rng() < .5 ? P.k : C(rng, P), 2.2)}/>`; },
    zig:(rng, x, y, P) => `<path d="M-12 0l4-5 4 5 4-5 4 5 4-5 4 5" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(R(rng, 0, 180))})" fill="none" ${st(P.k, 2)}/>`,
    pebble:(rng, x, y, P) => `<path d="${blob(rng, x, y, R(rng, 6, 12), R(rng, 4, 8), 6)}" fill="${C(rng, P)}" ${st(P.k, 2.2)}/>`,
    ring:(rng, x, y, P) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(R(rng, 4, 9))}" fill="none" ${st(rng() < .5 ? P.k : C(rng, P), 2.2)}/>`,
    tri:(rng, x, y, P) => `<path d="M0-8L7 5H-7z" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(R(rng, 0, 360))}) scale(${r1(R(rng, .7, 1.3))})" fill="${C(rng, P)}" ${st(P.k, 2)}/>`,
    block:(rng, x, y, P) => `<rect x="-6" y="-5" width="12" height="10" rx="2" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(R(rng, 0, 90))}) scale(${r1(R(rng, .7, 1.4))})" fill="${C(rng, P)}" ${st(P.k, 2)}/>`,
    grass:(rng, x, y, P) => `<path d="M${r1(x)} ${r1(y)}q-3-8-7-11M${r1(x)} ${r1(y)}q0-9 1-14M${r1(x)} ${r1(y)}q3-7 8-10" fill="none" ${st(rng() < .6 ? P.k : C(rng, P), 2)}/>`,
    arc:(rng, x, y, P) => `<path d="M-10 4Q0-10 10 4" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(R(rng, 0, 360))})" fill="none" ${st(C(rng, P), 3)}/>`,
    leaf:(rng, x, y, P) => `<path d="M0-10Q7-2 0 9Q-7-2 0-10zM0-6V7" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(R(rng, 0, 360))})" fill="${C(rng, P)}" ${st(P.k, 1.8)}/>`,
    bloom:(rng, x, y, P) => { const c = C(rng, P); return [0, 72, 144, 216, 288].map(a => `<circle cx="${r1(x + Math.cos(a * Math.PI / 180) * 5)}" cy="${r1(y + Math.sin(a * Math.PI / 180) * 5)}" r="3.6" fill="${c}" ${st(P.k, 1.4)}/>`).join('') + `<circle cx="${r1(x)}" cy="${r1(y)}" r="2.6" fill="${C(rng, P)}" ${st(P.k, 1.2)}/>`; },
    plus:(rng, x, y, P) => `<path d="M-6 0H6M0-6V6" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(R(rng, 0, 45))})" fill="none" ${st(C(rng, P), 2.6)}/>`,
    bubble:(rng, x, y, P) => { const r = R(rng, 3, 8); return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="#fff" fill-opacity=".35" ${st(P.k, 1.6)}/><circle cx="${r1(x - r * .35)}" cy="${r1(y - r * .35)}" r="${r1(r * .25)}" fill="#fff"/>`; },
    flake:(rng, x, y, P) => `<path d="M0-7V7M-6-3.5L6 3.5M-6 3.5L6-3.5" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(R(rng, 0, 60))})" fill="none" ${st(rng() < .5 ? '#FFFFFF' : P.k, 2)}/>`
  };
  /* 위에 얹는 가는 선(물건 위를 살짝 지나가 더 숨긴다 — 가늘어서 다 가리지는 못함) */
  const TOP = {
    hair:(rng, x, y, P) => `<path d="M${r1(x)} ${r1(y)}q${r1(R(rng, -14, 14))} ${r1(R(rng, -14, 14))} ${r1(R(rng, -26, 26))} ${r1(R(rng, -26, 26))}" fill="none" ${st(rng() < .5 ? P.k : C(rng, P), 1.4)} opacity=".85"/>`,
    blade:(rng, x, y, P) => `<path d="M${r1(x)} ${r1(y)}q${r1(R(rng, -4, 4))}-9 ${r1(R(rng, -6, 6))}-16" fill="none" ${st(P.k, 1.5)}/>`,
    speck:(rng, x, y, P) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(R(rng, 1.2, 2.4))}" fill="${C(rng, P)}" ${st(P.k, 1)}/>`
  };
  /* 큰 꾸밈(장면 테마마다) */
  const BIG = {
    tree:(rng, x, y, P) => { const h = R(rng, 34, 56), cr = R(rng, 24, 36); return `<rect x="${r1(x - 6)}" y="${r1(y - h)}" width="12" height="${r1(h)}" rx="3" fill="${P.wood}" ${st(P.k, 2.2)}/><path d="${blob(rng, x, y - h - cr * .6, cr, cr * .85, 8)}" fill="${C(rng, P)}" ${st(P.k, 2.2)}/>`; },
    pine:(rng, x, y, P) => { const s = R(rng, .8, 1.25), c = C(rng, P); return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s)})"><rect x="-5" y="-14" width="10" height="14" fill="${P.wood}" ${st(P.k, 2.2)}/>${[0, 1, 2].map(i => `<path d="M0 ${-74 + i * 18}L${22 + i * 6} ${-40 + i * 18}H${-22 - i * 6}z" fill="${c}" ${st(P.k, 2.2)}/>`).reverse().join('')}${P.snow ? '<path d="M0-74L9-60Q4-57 0-61Q-4-57-9-60z" fill="#fff" ' + st(P.k, 1.6) + '/>' : ''}</g>`; },
    bush:(rng, x, y, P) => { const c = C(rng, P), r = R(rng, 12, 20); return [-1, 0, 1].map(i => `<path d="${blob(rng, x + i * r * .9, y - r * (i ? .7 : 1.1), r, r * .85, 7)}" fill="${c}" ${st(P.k, 2.2)}/>`).join(''); },
    rock:(rng, x, y, P) => `<path d="${blob(rng, x, y - 10, R(rng, 16, 28), R(rng, 10, 16), 7)}" fill="${P.stone}" ${st(P.k, 2.2)}/><path d="M${r1(x - 6)} ${r1(y - 14)}q5-3 9 0" fill="none" ${st(P.k, 1.6)}/>`,
    log:(rng, x, y, P) => { const L = R(rng, 40, 64); return `<rect x="${r1(x - L / 2)}" y="${r1(y - 18)}" width="${r1(L)}" height="16" rx="7" fill="${P.wood}" ${st(P.k, 2.2)}/><ellipse cx="${r1(x + L / 2 - 4)}" cy="${r1(y - 10)}" rx="5" ry="8" fill="${C(rng, P)}" ${st(P.k, 2)}/>`; },
    toad:(rng, x, y, P) => `<rect x="${r1(x - 4)}" y="${r1(y - 14)}" width="8" height="14" rx="3" fill="#FFF3DA" ${st(P.k, 2)}/><path d="M${r1(x - 14)} ${r1(y - 12)}Q${r1(x)} ${r1(y - 34)} ${r1(x + 14)} ${r1(y - 12)}z" fill="${C(rng, P)}" ${st(P.k, 2.2)}/>`,
    weed:(rng, x, y, P) => { const h = R(rng, 50, 100), c = C(rng, P), d = `M${r1(x)} ${r1(y)}q-10 ${r1(-h / 4)} 0 ${r1(-h / 2)}t0 ${r1(-h / 2)}`; return `<path d="${d}" fill="none" ${st(P.k, 9)}/><path d="${d}" fill="none" ${st(c, 5)}/>`; },
    coral:(rng, x, y, P) => { const c = C(rng, P), b = `M${r1(x)} ${r1(y)}V${r1(y - 30)}M${r1(x)} ${r1(y - 14)}L${r1(x - 14)} ${r1(y - 30)}V${r1(y - 42)}M${r1(x)} ${r1(y - 20)}L${r1(x + 13)} ${r1(y - 34)}V${r1(y - 46)}M${r1(x)} ${r1(y - 30)}V${r1(y - 48)}`; return `<path d="${b}" fill="none" ${st(P.k, 10)}/><path d="${b}" fill="none" ${st(c, 6)}/>`; },
    fan:(rng, x, y, P) => `<g transform="translate(${r1(x)} ${r1(y - 8)}) rotate(${r1(R(rng, -30, 30))})"><path d="M0 8L-14-6Q0-18 14-6z" fill="${C(rng, P)}" ${st(P.k, 2.2)}/><path d="M0 8L-6-12M0 8V-14M0 8L6-12" fill="none" ${st(P.k, 1.5)}/></g>`,
    froth:(rng, x, y, P) => Array.from({ length:4 }, () => SM.bubble(rng, x + R(rng, -14, 14), y - R(rng, 0, 50), P)).join(''),
    frame:(rng, x, y, P) => { const w = R(rng, 34, 52), h = R(rng, 28, 42); return `<rect x="${r1(x - w / 2)}" y="${r1(y - h)}" width="${r1(w)}" height="${r1(h)}" rx="3" fill="${P.wood}" ${st(P.k, 2.2)}/><rect x="${r1(x - w / 2 + 6)}" y="${r1(y - h + 6)}" width="${r1(w - 12)}" height="${r1(h - 12)}" fill="${C(rng, P)}" ${st(P.k, 1.6)}/><path d="M${r1(x - w / 2 + 8)} ${r1(y - 8)}l${r1(w / 5)}-${r1(h / 3)} ${r1(w / 6)} ${r1(h / 5)} ${r1(w / 7)}-${r1(h / 6)} ${r1(w / 6)} ${r1(h / 5)}" fill="none" ${st(P.k, 1.6)}/>`; },
    shelf:(rng, x, y, P) => { let s = `<rect x="${r1(x - 40)}" y="${r1(y - 4)}" width="80" height="7" rx="2" fill="${P.wood}" ${st(P.k, 2.2)}/>`, bx = x - 36; while(bx < x + 30){ const bw = R(rng, 6, 11), bh = R(rng, 18, 30), tilt = rng() < .2 ? R(rng, -12, 12) : 0; s += `<rect x="${r1(bx)}" y="${r1(y - 4 - bh)}" width="${r1(bw)}" height="${r1(bh)}" rx="1.5" transform="rotate(${r1(tilt)} ${r1(bx + bw / 2)} ${r1(y - 4)})" fill="${C(rng, P)}" ${st(P.k, 1.8)}/>`; bx += bw + R(rng, 0, 3); } return s; },
    rug:(rng, x, y, P) => { const rx = R(rng, 40, 64), ry = rx * .32; return `<ellipse cx="${r1(x)}" cy="${r1(y - ry)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${C(rng, P)}" ${st(P.k, 2.2)}/><ellipse cx="${r1(x)}" cy="${r1(y - ry)}" rx="${r1(rx * .68)}" ry="${r1(ry * .6)}" fill="none" ${st(C(rng, P), 3.4)}/>`; },
    pot:(rng, x, y, P) => { const c = C(rng, P); return `${[-40, -10, 20, 50].map(a => `<path d="M0 0Q-8-14 0-30Q8-14 0 0z" transform="translate(${r1(x)} ${r1(y - 22)}) rotate(${a})" fill="${P.leaf}" ${st(P.k, 2)}/>`).join('')}<path d="M${r1(x - 12)} ${r1(y - 24)}H${r1(x + 12)}L${r1(x + 9)} ${r1(y)}H${r1(x - 9)}z" fill="${c}" ${st(P.k, 2.2)}/>`; },
    boxes:(rng, x, y, P) => [0, 1, 2].map(i => { const s = R(rng, 14, 20); return `<rect x="${r1(x - 18 + i * 12 + R(rng, -3, 3))}" y="${r1(y - s - (i === 1 ? 18 : 0))}" width="${r1(s)}" height="${r1(s)}" rx="2" fill="${C(rng, P)}" ${st(P.k, 2.2)}/>`; }).join(''),
    window:(rng, x, y, P) => `<rect x="${r1(x - 24)}" y="${r1(y - 46)}" width="48" height="42" rx="3" fill="#CFEAFF" ${st(P.k, 2.4)}/><path d="M${r1(x)} ${r1(y - 46)}V${r1(y - 4)}M${r1(x - 24)} ${r1(y - 25)}H${r1(x + 24)}" ${st(P.k, 2.4)}/><path d="M${r1(x - 28)} ${r1(y - 50)}Q${r1(x - 18)} ${r1(y - 20)} ${r1(x - 26)} ${r1(y)}" fill="none" ${st(C(rng, P), 5)}/>`,
    awning:(rng, x, y, P) => { const w = R(rng, 60, 90), c1 = C(rng, P); let s = `<rect x="${r1(x - w / 2 + 4)}" y="${r1(y - 40)}" width="${r1(w - 8)}" height="40" fill="${P.wood}" ${st(P.k, 2.2)}/>`; const n = 5, sw = w / n; for(let i = 0; i < n; i++) s += `<path d="M${r1(x - w / 2 + i * sw)} ${r1(y - 62)}H${r1(x - w / 2 + (i + 1) * sw)}V${r1(y - 46)}Q${r1(x - w / 2 + (i + .5) * sw)} ${r1(y - 38)} ${r1(x - w / 2 + i * sw)} ${r1(y - 46)}z" fill="${i % 2 ? '#FFF8EA' : c1}" ${st(P.k, 2)}/>`; return s; },
    crate:(rng, x, y, P) => { const w = R(rng, 30, 44), h = w * .7; return `<rect x="${r1(x - w / 2)}" y="${r1(y - h)}" width="${r1(w)}" height="${r1(h)}" rx="2" fill="${P.wood}" ${st(P.k, 2.2)}/><path d="M${r1(x - w / 2)} ${r1(y - h / 2)}H${r1(x + w / 2)}M${r1(x - w / 2 + 3)} ${r1(y - 3)}L${r1(x + w / 2 - 3)} ${r1(y - h + 3)}" fill="none" ${st(P.k, 1.6)}/>${Array.from({ length:4 }, () => `<circle cx="${r1(x + R(rng, -w / 3, w / 3))}" cy="${r1(y - h - R(rng, 2, 7))}" r="${r1(R(rng, 5, 8))}" fill="${C(rng, P)}" ${st(P.k, 1.8)}/>`).join('')}`; },
    pile:(rng, x, y, P) => { const c = C(rng, P); let s = ''; [[0, 3], [1, 2], [2, 1]].forEach(([row, n]) => { for(let i = 0; i < n; i++) s += `<circle cx="${r1(x + (i - (n - 1) / 2) * 13)}" cy="${r1(y - 7 - row * 11)}" r="7" fill="${c}" ${st(P.k, 2)}/>`; }); return s; },
    basket:(rng, x, y, P) => `<path d="M${r1(x - 20)} ${r1(y - 18)}H${r1(x + 20)}Q${r1(x + 18)} ${r1(y)} ${r1(x)} ${r1(y)}Q${r1(x - 18)} ${r1(y)} ${r1(x - 20)} ${r1(y - 18)}z" fill="${P.wood}" ${st(P.k, 2.2)}/><path d="M${r1(x - 12)} ${r1(y - 18)}L${r1(x - 4)} ${r1(y - 2)}M${r1(x)} ${r1(y - 18)}V${r1(y - 1)}M${r1(x + 12)} ${r1(y - 18)}L${r1(x + 4)} ${r1(y - 2)}M${r1(x - 18)} ${r1(y - 10)}H${r1(x + 18)}" fill="none" ${st(P.k, 1.5)}/><path d="M${r1(x - 16)} ${r1(y - 18)}Q${r1(x)} ${r1(y - 42)} ${r1(x + 16)} ${r1(y - 18)}" fill="none" ${st(P.k, 2.4)}/>`,
    bunting:(rng, x, y, P) => { const yy = y - R(rng, 10, 40); let s = `<path d="M${r1(x - 50)} ${r1(yy)}Q${r1(x)} ${r1(yy + 14)} ${r1(x + 50)} ${r1(yy)}" fill="none" ${st(P.k, 1.6)}/>`; for(let i = 0; i < 6; i++){ const px = x - 42 + i * 17, py = yy + 6 - Math.abs(i - 2.5) * 2; s += `<path d="M${r1(px - 5)} ${r1(py)}H${r1(px + 5)}L${r1(px)} ${r1(py + 10)}z" fill="${C(rng, P)}" ${st(P.k, 1.5)}/>`; } return s; },
    flower:(rng, x, y, P) => { const h = R(rng, 26, 48), c = C(rng, P), fy = y - h; return `<path d="M${r1(x)} ${r1(y)}V${r1(fy)}" ${st(P.k, 4.6)}/><path d="M${r1(x)} ${r1(y)}V${r1(fy)}" ${st(P.leaf, 2.4)}/><path d="M${r1(x)} ${r1(y - h / 3)}q10-6 14 2q-9 4-14-2z" fill="${P.leaf}" ${st(P.k, 1.6)}/>${[0, 60, 120, 180, 240, 300].map(a => `<circle cx="${r1(x + Math.cos(a * Math.PI / 180) * 8)}" cy="${r1(fy + Math.sin(a * Math.PI / 180) * 8)}" r="6" fill="${c}" ${st(P.k, 1.8)}/>`).join('')}<circle cx="${r1(x)}" cy="${r1(fy)}" r="5" fill="#FFD84D" ${st(P.k, 1.8)}/>`; },
    tulip:(rng, x, y, P) => { const h = R(rng, 24, 40), fy = y - h; return `<path d="M${r1(x)} ${r1(y)}V${r1(fy)}" ${st(P.k, 4.6)}/><path d="M${r1(x)} ${r1(y)}V${r1(fy)}" ${st(P.leaf, 2.4)}/><path d="M${r1(x - 9)} ${r1(fy - 12)}L${r1(x - 4)} ${r1(fy - 6)}L${r1(x)} ${r1(fy - 13)}L${r1(x + 4)} ${r1(fy - 6)}L${r1(x + 9)} ${r1(fy - 12)}V${r1(fy - 4)}Q${r1(x)} ${r1(fy + 6)} ${r1(x - 9)} ${r1(fy - 4)}z" fill="${C(rng, P)}" ${st(P.k, 2)}/>`; },
    fence:(rng, x, y, P) => { let s = `<path d="M${r1(x - 34)} ${r1(y - 12)}H${r1(x + 34)}M${r1(x - 34)} ${r1(y - 28)}H${r1(x + 34)}" ${st(P.k, 6)}/><path d="M${r1(x - 34)} ${r1(y - 12)}H${r1(x + 34)}M${r1(x - 34)} ${r1(y - 28)}H${r1(x + 34)}" ${st(P.fence, 3)}/>`; for(let i = 0; i < 4; i++){ const px = x - 30 + i * 20; s += `<path d="M${r1(px - 5)} ${r1(y)}V${r1(y - 34)}L${r1(px)} ${r1(y - 40)}L${r1(px + 5)} ${r1(y - 34)}V${r1(y)}z" fill="${P.fence}" ${st(P.k, 2)}/>`; } return s; },
    cloud:(rng, x, y, P) => `<path d="${blob(rng, x, y - R(rng, 0, 16), R(rng, 22, 34), R(rng, 10, 15), 8)}" fill="#FFFFFF" ${st(P.k, 2)}/>`,
    house:(rng, x, y, P) => { const w = R(rng, 40, 56), h = w * .7, c = C(rng, P); return `<rect x="${r1(x - w / 2)}" y="${r1(y - h)}" width="${r1(w)}" height="${r1(h)}" fill="${c}" ${st(P.k, 2.2)}/><path d="M${r1(x - w / 2 - 6)} ${r1(y - h)}L${r1(x)} ${r1(y - h - w * .45)}L${r1(x + w / 2 + 6)} ${r1(y - h)}z" fill="${P.roof}" ${st(P.k, 2.2)}/>${P.snow ? `<path d="M${r1(x - w / 2 - 6)} ${r1(y - h)}L${r1(x)} ${r1(y - h - w * .45)}L${r1(x + w / 2 + 6)} ${r1(y - h)}Q${r1(x + w / 4)} ${r1(y - h - 8)} ${r1(x)} ${r1(y - h - 4)}Q${r1(x - w / 4)} ${r1(y - h - 8)} ${r1(x - w / 2 - 6)} ${r1(y - h)}z" fill="#fff" ${st(P.k, 1.6)}/>` : ''}<rect x="${r1(x - w / 4 - 5)}" y="${r1(y - h + 8)}" width="11" height="11" fill="#FFE9A0" ${st(P.k, 1.8)}/><rect x="${r1(x + w / 8)}" y="${r1(y - h * .55)}" width="11" height="${r1(h * .55)}" fill="${P.wood}" ${st(P.k, 1.8)}/>`; },
    snowman:(rng, x, y, P) => `<circle cx="${r1(x)}" cy="${r1(y - 14)}" r="14" fill="#fff" ${st(P.k, 2.2)}/><circle cx="${r1(x)}" cy="${r1(y - 36)}" r="10" fill="#fff" ${st(P.k, 2.2)}/><path d="M${r1(x - 9)} ${r1(y - 28)}H${r1(x + 9)}L${r1(x + 10)} ${r1(y - 18)}" fill="none" ${st(C(rng, P), 4)}/><circle cx="${r1(x - 3.5)}" cy="${r1(y - 38)}" r="1.6" fill="${P.k}"/><circle cx="${r1(x + 3.5)}" cy="${r1(y - 38)}" r="1.6" fill="${P.k}"/>`,
    drift:(rng, x, y, P) => `<path d="${blob(rng, x, y - 6, R(rng, 22, 36), R(rng, 8, 12), 7)}" fill="#FFFFFF" ${st(P.k, 2)}/>`,
    birds:(rng, x, y, P) => Array.from({ length:2 + Math.floor(rng() * 3) }, () => { const bx = x + R(rng, -26, 26), by = y + R(rng, -20, 20), s = R(rng, 5, 9); return `<path d="M${r1(bx - s)} ${r1(by - s * .4)}Q${r1(bx - s / 2)} ${r1(by - s)} ${r1(bx)} ${r1(by)}Q${r1(bx + s / 2)} ${r1(by - s)} ${r1(bx + s)} ${r1(by - s * .4)}" fill="none" ${st(P.k, 2)}/>`; }).join(''),
    sun:(rng, x, y, P) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(R(rng, 13, 18))}" fill="#FFE27A" ${st(P.k, 2.2)}/>${Array.from({ length:8 }, (_, i) => { const a = i * Math.PI / 4; return `<path d="M${r1(x + Math.cos(a) * 22)} ${r1(y + Math.sin(a) * 22)}L${r1(x + Math.cos(a) * 29)} ${r1(y + Math.sin(a) * 29)}" ${st(P.k, 2.2)}/>`; }).join('')}`,
    balloons:(rng, x, y, P) => Array.from({ length:3 }, (_, i) => { const bx = x + (i - 1) * 13 + R(rng, -3, 3), by = y + R(rng, -8, 8); return `<path d="M${r1(bx)} ${r1(by + 11)}q-4 10 1 20" fill="none" ${st(P.k, 1.4)}/><ellipse cx="${r1(bx)}" cy="${r1(by)}" rx="8" ry="10.5" fill="${C(rng, P)}" ${st(P.k, 2)}/>`; }).join(''),
    sign:(rng, x, y, P) => `<path d="M${r1(x - 16)} ${r1(y - 16)}L${r1(x - 12)} ${r1(y - 32)}M${r1(x + 16)} ${r1(y - 16)}L${r1(x + 12)} ${r1(y - 32)}" ${st(P.k, 1.6)}/><rect x="${r1(x - 30)}" y="${r1(y - 16)}" width="60" height="22" rx="4" fill="${C(rng, P)}" ${st(P.k, 2.2)}/><path d="M${r1(x - 22)} ${r1(y - 8)}H${r1(x + 10)}M${r1(x - 22)} ${r1(y - 1)}H${r1(x + 20)}" ${st(P.k, 2)}/>`,
    lamp:(rng, x, y, P) => `<path d="M${r1(x)} ${r1(y)}V${r1(y - 64)}" ${st(P.k, 4)}/><rect x="${r1(x - 7)}" y="${r1(y - 78)}" width="14" height="16" rx="3" fill="#FFE9A0" ${st(P.k, 2.2)}/><path d="M${r1(x - 9)} ${r1(y - 78)}H${r1(x + 9)}L${r1(x)} ${r1(y - 86)}z" fill="${P.roof}" ${st(P.k, 2)}/>`
  };

  /* ----- 장면 테마: 배경색, 물건·꾸밈 색(c), 선 색(k), 큰 꾸밈 목록, 작은 꾸밈 목록 ----- */
  const THEMES = {
    forest:{ name:'숲속', sky:['#DDF4CF', '#BDE6A6'], ground:['#9ED487', '#6FB869'], gy:130, hills:['#B4E09A', '#8FCB7C'], k:'#2D4A2A',
      c:['#4E9F4A', '#7CC36E', '#A7D98C', '#C9A06A', '#E7D07A', '#5E8C3A', '#E8956B'], wood:'#9C6B3E', stone:'#B5AE98', leaf:'#5BAE4E',
      up:['cloud', 'birds', 'sun', 'cloud', 'birds'], big:['tree', 'tree', 'pine', 'bush', 'bush', 'rock', 'log', 'toad'], small:['leaf', 'leaf', 'grass', 'grass', 'pebble', 'dots', 'bloom', 'squig', 'arc', 'tri'], top:['blade', 'blade', 'hair', 'speck'] },
    sea:{ name:'바닷속', sky:['#8EDCF0', '#3C8FC0'], ground:['#F1D9A2', '#D9B878'], gy:395, hills:[], k:'#173F5C', rays:true,
      c:['#3BA6C8', '#68C3D9', '#F2B36B', '#E77F7F', '#9CDDB0', '#F5E3A8', '#7E8FE0'], wood:'#C9925A', stone:'#8FA3B5', leaf:'#4FB27E',
      big:['weed', 'weed', 'weed', 'coral', 'coral', 'rock', 'fan', 'froth'], small:['bubble', 'bubble', 'pebble', 'dots', 'squig', 'arc', 'ring', 'tri', 'leaf'], top:['hair', 'speck', 'speck'] },
    room:{ name:'다락방', sky:['#F8E6C8', '#F0D3A6'], ground:['#D9A876', '#C08A5A'], gy:300, hills:[], k:'#55372A', stripes:true,
      c:['#E9A15F', '#D9785F', '#8FB8D9', '#F2D27A', '#B79ADB', '#9CCB8A', '#F4B9C8'], wood:'#A86F45', stone:'#B9A58E', leaf:'#6FB45E',
      big:['frame', 'shelf', 'shelf', 'rug', 'pot', 'boxes', 'window', 'boxes'], small:['block', 'block', 'dots', 'ring', 'plus', 'tri', 'squig', 'zig', 'pebble'], top:['hair', 'speck'] },
    market:{ name:'장터', sky:['#FFF0C9', '#FFD891'], ground:['#E8C08A', '#D6A56B'], gy:210, hills:[], k:'#5A2E1E',
      c:['#E85D4A', '#F29E3D', '#F6D04D', '#7CC36E', '#5DA9E9', '#C98BD9', '#FFB3A1'], wood:'#B57A45', stone:'#C9B396', leaf:'#5FAE4E',
      up:['bunting', 'sign', 'cloud', 'birds', 'balloons'], big:['awning', 'crate', 'crate', 'pile', 'pile', 'basket', 'bunting', 'boxes'], small:['dots', 'dots', 'pebble', 'block', 'leaf', 'squig', 'zig', 'tri', 'ring'], top:['hair', 'speck', 'speck'] },
    garden:{ name:'꽃밭', sky:['#FFEFF6', '#DDF1FF'], ground:['#BDE7A6', '#8ED07A'], gy:150, hills:['#D2F0BF'], k:'#3E3A5A',
      c:['#F58AB5', '#FFC94D', '#B49CFF', '#7CC36E', '#5FB0E5', '#FF9E6B', '#FFFFFF'], wood:'#B88452', stone:'#C4BCD2', leaf:'#5DB653', fence:'#FFF6E6',
      up:['cloud', 'birds', 'balloons', 'sun'], big:['flower', 'flower', 'tulip', 'tulip', 'fence', 'bush', 'flower'], small:['bloom', 'bloom', 'grass', 'grass', 'leaf', 'dots', 'pebble', 'arc', 'squig'], top:['blade', 'blade', 'hair', 'speck'] },
    snow:{ name:'눈 마을', sky:['#D5E6FF', '#F2F7FF'], ground:['#F6FAFF', '#DCE8F7'], gy:180, hills:['#E9F1FC', '#DCE7F6'], k:'#2E3B5E', snow:true,
      c:['#A9C7F0', '#CFE0F7', '#E8846B', '#F2C66B', '#8FB98A', '#B6A6E8', '#FFFFFF'], wood:'#9A6B4A', stone:'#AEB8C8', leaf:'#6FA77E', roof:'#D9615A', fence:'#E7D3B8',
      up:['cloud', 'birds', 'cloud'], big:['house', 'house', 'pine', 'pine', 'snowman', 'drift', 'fence', 'lamp'], small:['flake', 'flake', 'pebble', 'dots', 'ring', 'block', 'squig', 'arc', 'tri'], top:['speck', 'hair', 'speck'] }
  };
  const TK = Object.keys(THEMES);
  Object.values(THEMES).forEach(T => { T.roof = T.roof || '#D9785F'; T.fence = T.fence || '#E9D2AE'; });

  function bgSvg(rng, T, u){
    let s = `<defs><linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.sky[0]}"/><stop offset="1" stop-color="${T.sky[1]}"/></linearGradient><linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.ground[0]}"/><stop offset="1" stop-color="${T.ground[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${u}s)"/>`;
    if(T.rays) for(let i = 0; i < 4; i++){ const x = R(rng, 0, W); s += `<path d="M${r1(x - 10)} 0H${r1(x + 18)}L${r1(x + 70)} ${H}H${r1(x + 20)}z" fill="#fff" opacity=".13"/>`; }
    if(T.stripes) for(let x = 12; x < W; x += 24) s += `<path d="M${x} 0V${T.gy}" stroke="#fff" stroke-width="6" opacity=".35"/>`;
    T.hills.forEach((c, i) => { const y0 = T.gy - 40 + i * 22; let d = `M0 ${y0}`; for(let x = 0; x < W; x += 90) d += `Q${r1(x + 45)} ${r1(y0 - R(rng, 10, 40))} ${x + 90} ${r1(y0 + R(rng, -8, 8))}`; s += `<path d="${d}V${H}H0z" fill="${c}" ${st(T.k, 2)}/>`; });
    let d = `M0 ${T.gy}`; for(let x = 0; x < W; x += 60) d += `Q${x + 30} ${r1(T.gy + R(rng, -12, 12))} ${x + 60} ${T.gy}`;
    s += `<path d="${d}V${H}H0z" fill="url(#${u}g)" ${st(T.k, 2.2)}/>`;
    if(T.stripes) for(let y = T.gy + 26; y < H; y += 30) s += `<path d="M0 ${y}H${W}" stroke="${T.k}" stroke-width="1.4" opacity=".35"/>`;
    return s;
  }

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const LIGHT_R = 66;   /* 손전등 반지름(장면 단위) */
  const CONC = {
    order:['shadow', 'many', 'swim', 'night'],
    info:{
      shadow:{ name:'그림자 목록', desc:'아래 목록에 물건 이름은 없고 까만 그림자만 보여요. 모양만 보고 찾아요!' },
      many:{ name:'여러 개 찾기', desc:'목록에 ×3이 붙은 물건은 장면에 3개가 숨어 있어요. 셋 다 찾아야 해요.' },
      swim:{ name:'움직이는 물건', desc:'물건 몇 개가 장면 속에서 천천히 왔다 갔다 움직여요. 잘 보고 눌러요.' },
      night:{ name:'밤 손전등', desc:'장면이 깜깜해요! 끌어서 손전등을 비추고, 불빛 안의 물건을 눌러요. 불빛 밖을 누르면 손전등만 옮겨 가요.' }
    },
    twists:['flash', 'tiny', 'bare', 'order', 'tight'],
    twInfo:{
      flash:{ name:'번개', desc:'제한 시간이 아주 짧아요. 빠르게 훑어보세요!' },
      tiny:{ name:'깨알', desc:'물건이 더 작고 꾸밈이 더 빽빽해요. 대신 시간은 넉넉해요. 확대해서 찾아요!' },
      bare:{ name:'맨손', desc:'힌트 없이 오직 눈으로 찾아요.' },
      order:{ name:'차례대로', desc:'목록 순서대로만 찾을 수 있어요. 반짝이는 물건부터!' },
      tight:{ name:'외줄 타기', desc:'빗나간 누르기는 두 번까지만! 두 번 빗나가면 끝나요.' }
    }
  };
  const RULE_TIP = { shadow:'그림자만 보고', many:'×3은 3개 모두', swim:'움직이는 물건', night:'끌어서 손전등', flash:'시간이 짧아요', tiny:'아주 작아요', bare:'힌트 없음', order:'목록 순서대로', tight:'두 번 빗나가면 끝' };

  /* ----- 솔로 난이도 표 -----
     물건 수 = 챕터 1은 LT.ch1[k−1], 챕터 2~는 LT.base[c] + LT.kOff[k]. 크기는 챕터마다 작아지고, 꾸밈은 빽빽해진다.
     제한 시간 = (물건 + 여분 개수×0.5) × LT.spp[c] × kTime[k] × 규칙·변주 배수 */
  const LT = {
    ch1:[5, 6, 6, 7, 8, 5, 6, 7, 6, 9],
    base:[0, 0, 7, 8, 9, 9, 10],
    kOff:[0, -2, -1, 0, 0, 1, -1, 0, 1, -2, 2],
    size:[0, 1.06, 1.0, .94, .88, .84, .8],
    dens:[0, 75, 95, 110, 122, 132, 140],
    spp:[0, 15, 14, 13, 12.5, 12, 11.5],
    kTime:[0, 1.15, 1.05, 1.0, 1.0, .9, 1.1, 1.0, 1.0, 1.1, .85],
    mjTime:{ shadow:1.15, many:1.0, swim:1.1, night:1.35 },
    twTime:{ flash:.65, tiny:1.2, bare:1.1, order:1.1, tight:1.05 }
  };
  const CH_THEME = ['forest', 'sea', 'room', 'market', 'snow'];
  function stageCfg(n){
    const p = planOf('hidden', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x), cc = Math.min(c, LT.spp.length - 1);
    let items = c === 1 ? LT.ch1[k - 1] : LT.base[cc] + LT.kOff[k];
    items = Math.max(5, Math.min(12, items));
    const many = has('many') ? (k === 5 || k === 10 ? 2 : 1) : 0;
    const swim = has('swim') ? (k === 5 || k === 10 ? 3 : 2) : 0;
    let size = LT.size[cc] - (p.hard || p.boss ? .05 : 0) + (p.easy ? .04 : 0), dens = LT.dens[cc] + (p.hard || p.boss ? 14 : 0) - (p.easy ? 10 : 0);
    if(tw === 'tiny'){ size *= .8; dens = Math.round(dens * 1.25); }
    let limit = (items + many * 2 * .5) * LT.spp[cc] * LT.kTime[k];
    mj.forEach(x => { limit *= LT.mjTime[x] || 1; });
    if(tw) limit *= LT.twTime[tw] || 1;
    limit = Math.max(45, Math.round(limit / 5) * 5);
    const theme = k === 9 ? 'garden' : CH_THEME[(c - 1) % CH_THEME.length];
    return { items, many, swim, size:Math.round(size * 100) / 100, dens, limit, theme, hints:tw === 'bare' ? 0 : p.boss ? 2 : 3,
      shadow:has('shadow'), night:has('night'), order:tw === 'order', lives:tw === 'tight' ? 2 : 0, boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 장면 만들기(rng만): 테마 → 물건 자리 → 큰 꾸밈 → 작은 꾸밈 → 위 가는 선 =====
     물건은 장면 안(가장자리 여백)에, 서로 겹치지 않게 놓는다 → 모든 물건이 보이고 누를 수 있다(풀 수 있음). */
  function gen(cfg, rng){
    const tk = cfg.theme && THEMES[cfg.theme] ? cfg.theme : TK[Math.floor(rng() * TK.length)], T = THEMES[tk];
    const n = Math.max(1, Math.min(POOL.length, cfg.items || 8)), many = Math.min(n, cfg.many || 0);
    const keys = shuffle(POOL.slice(), rng).slice(0, n);
    const list = keys.map((k, i) => ({ k, need:i < many ? 3 : 1, got:0 }));
    if(many) shuffle(list, rng);
    const items = [], s0 = cfg.size || .9;
    list.forEach((L, li) => {
      for(let c = 0; c < L.need; c++){
        let it = null;
        for(let t = 0; t < 400 && !it; t++){
          const s = s0 * R(rng, .88, 1.1), r = IR * s, pad = r + 6;
          const x = R(rng, pad, W - pad), y = R(rng, pad, H - pad), gap = t < 250 ? 1.12 : .98;
          if(x + r * .5 > W - ZX && y + r * .5 > H - ZY) continue;   /* 오른쪽 아래 확대 단추 밑은 피한다 */
          if(items.some(o => Math.hypot(o.x - x, o.y - y) < (o.r + r) * gap + 3)) continue;
          const F = pick(rng, T.c); let A = pick(rng, T.c); if(A === F) A = T.c[(T.c.indexOf(F) + 2) % T.c.length];
          it = { i:items.length, li, k:L.k, x, y, s, r, rot:Math.round(R(rng, -55, 55) + (rng() < .2 ? 180 : 0)), F, A };
        }
        if(!it){ const s = s0 * .8, r = IR * s; it = { i:items.length, li, k:L.k, x:R(rng, r + 6, W - ZX - r), y:R(rng, r + 6, H - r - 6), s, r, rot:0, F:T.c[0], A:T.c[1] }; }
        items.push(it);
      }
    });
    /* 움직이는 물건: 고른 물건이 장면 안에서 왔다 갔다(진폭이 장면을 벗어나지 않게) */
    const sw = Math.min(cfg.swim || 0, items.length);
    shuffle(items.map(o => o.i), rng).slice(0, sw).forEach(i => {
      const o = items[i], a = R(rng, 0, Math.PI), A = R(rng, 18, 30);
      const ax = Math.cos(a) * A, ay = Math.sin(a) * A;
      const kx = Math.min(1, Math.max(0, (Math.min(o.x, W - o.x) - o.r - 4) / Math.max(1, Math.abs(ax)))), ky = Math.min(1, Math.max(0, (Math.min(o.y, H - o.y) - o.r - 4) / Math.max(1, Math.abs(ay)))), kk = Math.min(kx, ky);
      o.mv = { ax:ax * kk, ay:ay * kk, per:R(rng, 5, 9), ph:R(rng, 0, 6.28) };
    });
    /* 꾸밈 */
    const u = 'hd' + Math.floor(rng() * 1e6);
    const bg = bgSvg(rng, T, u);
    const dens = cfg.dens || 90, nb = Math.round(dens * .16);
    const cells = shuffle(Array.from({ length:12 }, (_, i) => i), rng), bigs = [];
    for(let b = 0; b < nb; b++){
      const cI = cells[b % 12], gx = cI % 3, gy = Math.floor(cI / 3);
      const yMin = T.big.length && (tk === 'sea' || tk === 'room') ? 40 : T.gy - 10;
      const x = (gx + R(rng, .1, .9)) * W / 3, y = yMin + (gy + R(rng, .2, 1)) * (H - yMin) / 4;
      bigs.push([y, BIG[pick(rng, T.big)](rng, x, y, T)]);
    }
    /* 하늘(땅 위) 쪽에도 꾸밈을 둬서 빈 곳에 물건이 혼자 드러나지 않게 */
    if(T.up && T.gy > 90){ const ns = Math.max(2, Math.round(nb * T.gy / H * 1.1)); for(let b = 0; b < ns; b++){ const x = (b + R(rng, .1, .9)) * W / ns, y = R(rng, 30, T.gy - 25); bigs.push([y - 1000, BIG[pick(rng, T.up)](rng, x, y, T)]); } }
    bigs.sort((a, b) => a[0] - b[0]);   /* 아래(앞)에 있는 것이 나중에 그려지게 */
    let deco = bigs.map(b => b[1]).join('');
    /* 작은 꾸밈: 크기를 섞어 물건과 비슷한 크기의 조각이 많게(물건만 커서 눈에 띄지 않게) */
    for(let i = 0; i < dens; i++){ const s = r1(R(rng, .9, 1.75)); deco += `<g transform="translate(${r1(R(rng, 4, W - 4))} ${r1(R(rng, 4, H - 4))}) scale(${s})">${SM[pick(rng, T.small)](rng, 0, 0, T)}</g>`; }
    let top = '';
    const nt = Math.round(dens * .35);
    for(let i = 0; i < nt; i++) top += TOP[pick(rng, T.top)](rng, R(rng, 0, W), R(rng, 0, H), T);
    /* 물건 위에 살짝 걸치는 작은 조각(물건 중심은 피한다 → 모양은 알아볼 수 있음) */
    const no = Math.round(dens * .12);
    for(let i = 0; i < no; i++){
      const x = R(rng, 0, W), y = R(rng, 0, H);
      if(items.some(o => !o.mv && Math.hypot(o.x - x, o.y - y) < o.r * .7)) continue;
      top += SM[pick(rng, ['dots', 'leaf', 'plus'])](rng, x, y, T);
    }
    return { tk, T, bg:bg + deco, top, items, list, ok:check(items, list) };
  }
  /* 점검: 모든 물건이 장면 안에 있고 서로 겹치지 않으며 목록 개수와 맞는가 */
  function check(items, list){
    for(const o of items){
      const ex = o.mv ? Math.abs(o.mv.ax) : 0, ey = o.mv ? Math.abs(o.mv.ay) : 0;
      if(o.x - ex - o.r < 0 || o.x + ex + o.r > W || o.y - ey - o.r < 0 || o.y + ey + o.r > H) return false;
      if(!o.mv && o.x + o.r * .5 > W - ZX && o.y + o.r * .5 > H - ZY) return false;
    }
    for(let a = 0; a < items.length; a++) for(let b = a + 1; b < items.length; b++){
      const p = items[a], q = items[b]; if(!p.mv && !q.mv && Math.hypot(p.x - q.x, p.y - q.y) < (p.r + q.r) * .95) return false;
    }
    return list.every((L, li) => items.filter(o => o.li === li).length === L.need);
  }

  /* ===== 플레이 ===== */
  const S = () => G.h;
  const T_ = (fn, ms) => { const m = G.h, id = setTimeout(() => { m.timers.delete(id); if(G && G.h === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const posOf = (o, t) => o.mv ? [o.x + o.mv.ax * Math.sin(t * Math.PI * 2 / o.mv.per + o.mv.ph), o.y + o.mv.ay * Math.sin(t * Math.PI * 2 / o.mv.per + o.mv.ph)] : [o.x, o.y];
  const totalOf = m => m.items.length;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const curLi = m => m.list.findIndex(L => L.got < L.need);

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C6 17 2.5 13.6 2.5 9.2 2.5 6.3 4.7 4 7.4 4c1.9 0 3.5 1 4.6 2.6C13.1 5 14.7 4 16.6 4c2.7 0 4.9 2.3 4.9 5.2 0 4.4-3.5 7.8-9.5 11.8z" fill="currentColor" stroke="#1A0F45" stroke-width="2" stroke-linejoin="round"/></svg>';
  const ICO = {
    glass:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="#E6F6FF" stroke="#1A0F45" stroke-width="2.2"/><path d="M15 15l5.5 5.5" stroke="#1A0F45" stroke-width="3.4" stroke-linecap="round"/><path d="M7 8a3.5 3.5 0 0 1 3-2.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    zin:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="#fff" stroke="#1A0F45" stroke-width="2.2"/><path d="M15 15l5 5" stroke="#1A0F45" stroke-width="3" stroke-linecap="round"/><path d="M7 10h6M10 7v6" stroke="#1A0F45" stroke-width="2.2" stroke-linecap="round"/></svg>',
    zout:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="#fff" stroke="#1A0F45" stroke-width="2.2"/><path d="M15 15l5 5" stroke="#1A0F45" stroke-width="3" stroke-linecap="round"/><path d="M7 10h6" stroke="#1A0F45" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };

  function hud(){
    const m = S(); if(!m) return;
    const f = $('#hdFound'); if(f) f.textContent = m.found;
    const h = $('#hdHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0; }
    const lv = $('#hdLives');
    if(lv){ if(!m.lives) lv.hidden = true; else { const left = Math.max(0, m.lives - m.misses); lv.hidden = false; lv.innerHTML = Array.from({ length:m.lives }, (_, n) => `<i class="hd-heart${n >= left ? ' off' : ''}">${HEART}</i>`).join(''); lv.setAttribute('aria-label', '남은 기회 ' + left + '번'); } }
  }
  function msg(html, cls){ const e = $('#hdMsg'); if(!e) return; e.className = 'hd-msg ' + (cls || ''); e.innerHTML = html; }
  function playMsg(){
    const m = S();
    if(m.boss) return '<b class="boss">보스 판</b><span>' + (m.tips[0] || '끝까지 집중!') + '</span>';
    if(m.tips.length) return '<span>' + m.tips.slice(0, 2).join(' · ') + '</span>';
    return '<span>' + m.sc.T.name + '에서 아래 물건을 찾아 눌러요</span>';
  }
  function chipHtml(L, li){
    const m = S(), done = L.got >= L.need, cur = m.order && li === curLi(m);
    const nm = m.shadow && !done ? '???' : ITEMS[L.k][0];
    return `<div class="hd-chip${done ? ' done' : ''}${cur ? ' cur' : ''}${m.order && !done && !cur ? ' wait' : ''}" data-li="${li}" role="listitem" aria-label="${m.shadow && !done ? '그림자 물건' : ITEMS[L.k][0]}${L.need > 1 ? ' ' + L.got + '/' + L.need + '개' : ''}${done ? ' 찾음' : ''}"><span class="hd-ci">${iconSvg(L.k, m.shadow && !done)}</span><span class="hd-cn">${nm}</span>${L.need > 1 ? `<em>${done ? '✔' : '×' + (L.need - L.got)}</em>` : done ? '<em class="ok">✔</em>' : ''}</div>`;
  }
  function drawList(){ const m = S(), el = $('#hdList'); if(!el) return; el.innerHTML = m.list.map(chipHtml).join(''); el.style.setProperty('--cols', m.list.length <= 6 ? 3 : 4); }

  /* 확대/이동: viewBox로 보이는 부분만 바꾼다(물건 자리·판정은 장면 좌표 그대로) */
  function applyView(){
    const m = S(), v = m.view, svg = $('#hdSvg'); if(!svg) return;
    const vw = W / v.z, vh = H / v.z;
    v.cx = Math.max(vw / 2, Math.min(W - vw / 2, v.cx)); v.cy = Math.max(vh / 2, Math.min(H - vh / 2, v.cy));
    svg.setAttribute('viewBox', `${r1(v.cx - vw / 2)} ${r1(v.cy - vh / 2)} ${r1(vw)} ${r1(vh)}`);
    const zi = $('#hdZin'), zo = $('#hdZout'); if(zi) zi.disabled = v.z >= ZMAX - .01; if(zo) zo.disabled = v.z <= 1.01;
    const w = $('#hdWrap'); if(w) w.classList.toggle('zoomed', v.z > 1.01);
  }
  const ZMAX = 3;
  function zoomBy(f, cx, cy){
    const m = S(), v = m.view, z = Math.max(1, Math.min(ZMAX, v.z * f));
    if(cx != null){ /* 손가락 사이(또는 누른 곳)를 기준으로 확대 */ v.cx = cx + (v.cx - cx) * v.z / z; v.cy = cy + (v.cy - cy) * v.z / z; }
    v.z = z; applyView();
  }
  function scenePt(cx, cy){
    const svg = $('#hdSvg'); if(!svg || !svg.getScreenCTM) return null;
    const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y];
  }
  const pxPerUnit = () => { const m = S(), svg = $('#hdSvg'); return svg && svg.clientWidth ? svg.clientWidth / (W / m.view.z) : 1; };
  function screenOf(x, y){ const svg = $('#hdSvg'); if(!svg) return { x:0, y:0 }; const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(svg.getScreenCTM()); return { x:q.x, y:q.y }; }

  function setLight(x, y){ const m = S(); m.light = [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]; const c = $('#hdLight'), g = $('#hdGlow'); if(c){ c.setAttribute('cx', r1(m.light[0])); c.setAttribute('cy', r1(m.light[1])); } if(g){ g.setAttribute('cx', r1(m.light[0])); g.setAttribute('cy', r1(m.light[1])); } }

  /* 누르기 판정: 아직 못 찾은 물건 중 가까운 것. 판정 반지름 = 물건 반지름 + 화면 14px(작은 물건도 관대하게) */
  function hitAt(x, y){
    const m = S(), t = elapsed(), tol = Math.max(14 / pxPerUnit(), 5);
    let best = null, bd = 1e9;
    for(const o of m.items){
      if(m.got.has(o.i)) continue;
      const [px, py] = posOf(o, t), d = Math.hypot(px - x, py - y), lim = Math.max(o.r + tol, 22 / pxPerUnit());
      if(d < lim && d / lim < bd){ bd = d / lim; best = o; }
    }
    return best;
  }
  function tapAt(cx, cy){
    const m = S();
    if(!m || G.over || G.paused || m.phase !== 'play') return;
    const p = scenePt(cx, cy); if(!p) return;
    if(Date.now() < m.coolUntil){ const c = $('#hdCool'); if(c) fxShake(c, 3); return; }
    if(m.night && Math.hypot(p[0] - m.light[0], p[1] - m.light[1]) > LIGHT_R){ setLight(p[0], p[1]); sfx('hdLight'); return; }
    const o = hitAt(p[0], p[1]);
    if(o && m.order && o.li !== curLi(m)){ msg('<b class="boss">차례가 아니에요</b><span>반짝이는 물건부터 찾아요</span>', 'hd-pop'); T_(() => { if(m.phase === 'play') msg(playMsg()); }, 900); return; }
    if(o) found(o); else miss(p[0], p[1], cx, cy);
  }
  function found(o){
    const m = S(), L = m.list[o.li];
    m.got.add(o.i); L.got++; m.found++; m.streak = 0; m.combo++;
    const mk = document.createElementNS(SVGNS, 'g');
    mk.setAttribute('class', 'hd-mark'); mk.dataset.i = o.i;
    const [px, py] = posOf(o, elapsed());
    mk.setAttribute('transform', `translate(${r1(px)} ${r1(py)})`);
    mk.innerHTML = `<circle r="${r1(o.r + 5)}" class="o"/><circle r="${r1(o.r + 5)}" class="c"/>`;
    const ml = $('#hdMarks'); if(ml) ml.appendChild(mk);
    const ig = document.querySelector(`.ng-hidden .hd-it[data-i="${o.i}"]`); if(ig) ig.classList.add('got');
    drawList(); hud();
    try{ const q = screenOf(px, py); fxBurst(q.x, q.y, ['#FF3D7F', '#FFE27A', '#FFFFFF', o.F], 12, { speed:220, size:4.5, kinds:['star', 'dot', 'spark'], up:90, g:420, glow:true, dur:.6 }); fxRing(q.x, q.y, '#FFE27A', 40, .45, 6);
      const ch = document.querySelector(`.ng-hidden .hd-chip[data-li="${o.li}"]`); if(ch) fxPunch(ch, 1.12); }catch(_){}
    sfx('hdFind', { n:Math.min(8, m.combo - 1) }); fxBuzz(12);
    if(m.combo >= 3) try{ fxCombo(m.combo); }catch(_){}
    clearHint();
    if(m.found >= totalOf(m)){ win(); return; }
    if(m.phase === 'play') msg(L.got >= L.need ? `<b>${ITEMS[L.k][0]}</b><span>찾았어요! 남은 물건 ${totalOf(m) - m.found}개</span>` : `<b>${ITEMS[L.k][0]}</b><span>${L.need - L.got}개 더 있어요</span>`, 'hd-pop');
  }
  function miss(x, y){
    const m = S();
    m.misses++; m.streak++; m.combo = 0;
    const cool = 700 + 350 * Math.min(3, m.streak - 1);   /* 연속으로 빗나가면 더 오래 못 누름(마구 누르기 막기) */
    m.coolUntil = Date.now() + cool;
    const xg = document.createElementNS(SVGNS, 'g'); xg.setAttribute('class', 'hd-x');
    const sc = 1 / m.view.z; xg.setAttribute('transform', `translate(${r1(x)} ${r1(y)}) scale(${r1(sc * 100) / 100})`);
    xg.innerHTML = '<path d="M-9-9L9 9M9-9L-9 9" class="o"/><path d="M-9-9L9 9M9-9L-9 9" class="c"/>';
    const ml = $('#hdMarks'); if(ml){ ml.appendChild(xg); T_(() => xg.remove(), 650); }
    const w = $('#hdWrap'), c = $('#hdCool');
    if(w){ w.classList.add('cool'); T_(() => { if(Date.now() >= m.coolUntil - 20) w.classList.remove('cool'); }, cool); }
    if(c){ c.querySelector('b').textContent = '잠깐! ' + (cool / 1000).toFixed(1) + '초'; }
    sfx('hdMiss'); fxBuzz(25);
    const left = m.lives ? Math.max(0, m.lives - m.misses) : -1;
    msg('<b class="bad">빗나갔어요</b><span>' + (left < 0 ? '점수 −15' : left ? '기회 ' + left + '번 남음' : '기회를 다 썼어요') + '</span>', 'hd-pop');
    hud();
    T_(() => { if(m.phase === 'play') msg(playMsg()); }, 1100);
    if(left >= 0){ G.paws = left; if(!left) lose('기회를 다 썼어요', 'miss'); }
  }
  function clearHint(){ const h = $('#hdHintRing'); if(h) h.remove(); }
  function useHint(){
    const m = S(); if(!m || G.over || G.paused || m.phase !== 'play' || m.hintLeft <= 0) return;
    const left = m.items.filter(o => !m.got.has(o.i) && (!m.order || o.li === curLi(m)));
    if(!left.length) return;
    m.hintLeft--; m.hints++; hud(); clearHint();
    const o = left[Math.floor(m.hr() * left.length)], [px, py] = posOf(o, elapsed());
    /* 물건 바로 위가 아니라 "근처"를 밝힌다 */
    const a = m.hr() * Math.PI * 2, d = m.hr() * o.r * .9, hx = px + Math.cos(a) * d, hy = py + Math.sin(a) * d;
    const g = document.createElementNS(SVGNS, 'g'); g.id = 'hdHintRing'; g.setAttribute('class', 'hd-hint'); g.setAttribute('transform', `translate(${r1(hx)} ${r1(hy)})`);
    g.innerHTML = `<circle r="${r1(o.r * 2.6)}" class="f"/><circle r="${r1(o.r * 2.6)}" class="c"/>`;
    const ml = $('#hdMarks'); if(ml) ml.appendChild(g);
    T_(() => { if(g.parentNode) g.remove(); }, 2600);
    const v = m.view, vw = W / v.z, vh = H / v.z;
    if(Math.abs(hx - v.cx) > vw / 2 - 20 || Math.abs(hy - v.cy) > vh / 2 - 20){ v.cx = hx; v.cy = hy; applyView(); }
    if(m.night) setLight(hx, hy);
    sfx('hdHint');
  }

  /* 시계·움직이는 물건 */
  const remTime = t => Math.max(0, G.limit - t);
  function loop(){
    if(!G || !G.h || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(), t = elapsed();
    if(m.movers.length){
      m.movers.forEach(o => { const [px, py] = posOf(o, t), tr = `translate(${r1(px)} ${r1(py)})`; const e = m.itEl[o.i]; if(e) e.setAttribute('transform', tr); if(m.got.has(o.i)){ const mk = document.querySelector(`.ng-hidden .hd-mark[data-i="${o.i}"]`); if(mk) mk.setAttribute('transform', tr); } });
    }
    if(m.phase !== 'play') return;
    const rem = remTime(t), sec = Math.ceil(rem), bar = $('#hdBar');
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#hdTime'); if(e) e.textContent = mmss(sec);
      const p = $('#hdTimeP'); if(p) p.classList.toggle('hurry', sec <= 10);
      const b = $('#hdBarWrap'); if(b) b.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0){ sfx('hdTick', { hi:sec <= 5 }); try{ if(p && !FXR.reduce && p.animate) p.animate([{ transform:'scale(1)' }, { transform:'scale(1.12)' }, { transform:'scale(1)' }], { duration:300, easing:'ease-out' }); }catch(_){} }
    }
    if(rem <= 0){ const e = $('#hdTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요', 'time'); }
    const c = $('#hdWrap'); if(c && c.classList.contains('cool') && Date.now() >= m.coolUntil) c.classList.remove('cool');
  }
  function win(){
    const m = S(); m.phase = 'done'; m.sec = elapsed();
    msg('<b>모두 찾았어요!</b>', 'hd-win');
    sfx('win', { g:'hidden' }); fxBuzz([30, 50, 30]);
    try{ const w = $('#hdWrap'); if(w){ w.classList.add('cleared'); const p = fxCenter(w); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); fxBurst(p.x, p.y, ['#FFE27A', '#FF8FC8', '#7CCBFF', '#5BD08A'], 26, { speed:340, size:6, kinds:['star', 'dot', 'spark'], up:140, g:420, glow:true, dur:1 }); } }catch(_){}
    if(m.night){ const ov = $('#hdNight'); if(ov) ov.classList.add('off'); }
    T_(() => finish(true), 1000);
  }
  function lose(text, why){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.fail = why;
    msg('<b class="bad">' + text + '</b><span>남은 물건 ' + (totalOf(m) - m.found) + '개</span>', 'hd-pop');
    sfx('hdTimeUp'); fxBuzz([40, 40, 60]);
    try{ fxShake($('#hdWrap'), 6); }catch(_){}
    /* 못 찾은 물건 자리 보여 주기 */
    const ml = $('#hdMarks'), t = elapsed();
    if(ml) m.items.filter(o => !m.got.has(o.i)).forEach(o => { const [px, py] = posOf(o, t); const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'hd-mark miss'); g.setAttribute('transform', `translate(${r1(px)} ${r1(py)})`); g.innerHTML = `<circle r="${r1(o.r + 5)}" class="o"/><circle r="${r1(o.r + 5)}" class="c"/>`; ml.appendChild(g); });
    if(m.night){ const ov = $('#hdNight'); if(ov) ov.classList.add('off'); }
    T_(() => finish(false), 1500);
  }

  function layout(){
    const m = S(), wrap = $('#hdWrap'), root = document.querySelector('.ng-hidden'), list = $('#hdList'); if(!wrap || !root) return;
    const RW = Math.min(root.clientWidth || 360, 480);
    const top = wrap.getBoundingClientRect().top + (window.scrollY || 0);
    const lh = list ? list.offsetHeight : 90;
    const avail = Math.max(300, (innerHeight || 740) - top - lh - 22);
    const w = Math.floor(Math.max(240, Math.min(RW, avail * W / H)));
    wrap.style.width = w + 'px'; wrap.style.height = Math.round(w * H / W) + 'px';
    if(list) list.style.maxWidth = Math.max(w, Math.min(RW, 420)) + 'px';
  }
  function wire(){
    const m = S(), svg = $('#hdSvg'); if(!svg) return;
    const P = new Map(); let pinch = null, moved = false, multi = false, sv = null;
    svg.onpointerdown = e => {
      e.preventDefault(); try{ svg.setPointerCapture(e.pointerId); }catch(_){}
      P.set(e.pointerId, { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY });
      if(P.size === 1){ moved = false; multi = false; sv = { cx:m.view.cx, cy:m.view.cy }; }
      if(P.size === 2 && !m.night){ multi = true; const [a, b] = [...P.values()]; pinch = { d:Math.hypot(a.x - b.x, a.y - b.y) || 1, z:m.view.z }; }
    };
    svg.onpointermove = e => {
      const p = P.get(e.pointerId); if(!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if(P.size >= 2 && pinch){
        const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y), c = scenePt((a.x + b.x) / 2, (a.y + b.y) / 2);
        const f = (pinch.z * d / pinch.d) / m.view.z; if(c && Math.abs(f - 1) > .01) zoomBy(f, c[0], c[1]);
        return;
      }
      if(P.size !== 1 || multi) return;
      const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
      if(!moved && Math.hypot(dx, dy) > 8) moved = true;
      if(!moved || G.paused || G.over) return;
      if(m.night){ const q = scenePt(e.clientX, e.clientY); if(q) setLight(q[0], q[1]); return; }
      if(m.view.z > 1.01){ const upp = (W / m.view.z) / (svg.clientWidth || W); m.view.cx = sv.cx - dx * upp; m.view.cy = sv.cy - dy * upp; applyView(); }
    };
    const up = e => {
      const p = P.get(e.pointerId); if(!p) return;
      P.delete(e.pointerId);
      if(e.type === 'pointerup' && !moved && !multi && P.size === 0) tapAt(e.clientX, e.clientY);
      if(P.size < 2) pinch = null;
      if(P.size === 0){ multi = false; }
    };
    svg.onpointerup = up; svg.onpointercancel = up;
    svg.onwheel = e => { if(m.night) return; e.preventDefault(); const c = scenePt(e.clientX, e.clientY); zoomBy(e.deltaY < 0 ? 1.25 : 1 / 1.25, c && c[0], c && c[1]); };
    const zi = $('#hdZin'), zo = $('#hdZout');
    if(zi) zi.onclick = () => { zoomBy(1.6); sfx('hdZoom'); };
    if(zo) zo.onclick = () => { if(m.view.z < 1.7) { m.view.z = 1; applyView(); } else zoomBy(1 / 1.6); sfx('hdZoom', { out:1 }); };
    const h = $('#hdHint'); if(h) h.onclick = useHint;
  }

  return {
    name:'숨은그림 찾기', abil:'집중력', col:['#FFD6A5', '#F08A24', '#9A4A08'], time:'약 2분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 2.5a7.5 7.5 0 0 1 6.1 11.9l5 5a1.5 1.5 0 0 1-2.1 2.1l-5-5A7.5 7.5 0 1 1 10 2.5zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/><path d="M10 7.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L7.1 9.3l2-.3z"/></svg>',
    art(){
      const u = 'hdA' + Math.floor(performance.now() * 1000 % 1e6), T = THEMES.forest, K = T.k;
      const it = (k, x, y, rot, s, F, A) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${itemSvg(k, F, A, K, 2.2 / s)}</g>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4F7D6"/><stop offset="1" stop-color="#BDE6A6"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <path d="M0 52Q40 38 80 50T160 46V100H0z" fill="#8FCB7C" stroke="${K}" stroke-width="1.6"/>
        <rect x="18" y="30" width="7" height="26" rx="2" fill="#9C6B3E" stroke="${K}" stroke-width="1.6"/><circle cx="21.5" cy="24" r="15" fill="#5BAE4E" stroke="${K}" stroke-width="1.6"/>
        <rect x="128" y="26" width="7" height="28" rx="2" fill="#9C6B3E" stroke="${K}" stroke-width="1.6"/><circle cx="131.5" cy="20" r="16" fill="#7CC36E" stroke="${K}" stroke-width="1.6"/>
        ${it('key', 21, 22, -30, .45, '#7CC36E', '#E7D07A')}${it('spoon', 60, 76, 35, .55, '#A7D98C', '#E7D07A')}${it('sock', 132, 74, -15, .5, '#C9A06A', '#E8956B')}
        <g fill="#E7D07A" stroke="${K}" stroke-width="1.2"><circle cx="40" cy="66" r="3"/><circle cx="100" cy="84" r="2.6"/><circle cx="118" cy="60" r="2.2"/></g>
        <path d="M30 88q-2-6-5-8M30 88q0-7 1-10M150 92q-2-6-5-8M150 92q0-7 1-10" fill="none" stroke="${K}" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="60" cy="76" r="12" fill="none" stroke="#fff" stroke-width="5"/><circle cx="60" cy="76" r="12" fill="none" stroke="#FF3D7F" stroke-width="2.6"/>
        <g transform="translate(96 30)"><circle r="16" fill="#E6F6FF" fill-opacity=".55" stroke="#1A0F45" stroke-width="4"/><path d="M11 11l13 13" stroke="#1A0F45" stroke-width="7" stroke-linecap="round"/><path d="M11 11l13 13" stroke="#F08A24" stroke-width="3.4" stroke-linecap="round"/><path d="M-8-6a10 10 0 0 1 8-6" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>
        ${it('star', 0, 0, 10, .5, '#FFE27A', '#FFB84D')}</g></svg>`;
    },
    help:[
      ['아래 물건을 찾아요', '장면 아래 목록에 있는 물건이 그림 속 어딘가에 작게 숨어 있어요. 기울어져 있거나 배경과 색이 비슷할 수 있어요.'],
      ['찾으면 눌러요', '물건을 누르면 동그라미가 그려지고 목록에 ✔가 붙어요. 엉뚱한 곳을 누르면 실수 — 잠깐 못 누르고 점수가 줄어요. 마구 누르지 말고 잘 보고 눌러요!'],
      ['확대해서 봐요', '오른쪽 아래 돋보기 단추(또는 두 손가락)로 확대하고, 끌어서 옮겨 볼 수 있어요. 막히면 💡힌트가 물건 근처를 잠깐 밝혀 줘요(점수 조금 줄어요).'],
      ['시간 안에 모두 찾기', '제한 시간 안에 목록의 물건을 모두 찾으면 성공! 빨리 찾을수록 점수가 높아요.'],
      ['솔로: 5판마다 새 규칙', '솔로에서는 그림자 목록·여러 개 찾기·움직이는 물건·밤 손전등 같은 새 규칙과 번개·깨알·차례대로 같은 변주가 5판마다 하나씩 나와요.']
    ],
    helpExtra(){ const m = G && G.id === 'hidden' && G.h; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['숲속 소풍', '바닷속 탐험', '다락방 보물', '왁자지껄 장터', '눈꽃 마을'],
    starRule:'★ 클리어 · ★★ 힌트 1번·실수 4번 이하 · ★★★ 힌트 없이 실수 1번 이하',
    levels:{
      easy:{ items:7, size:1.02, dens:90, limit:120, hints:3 },
      normal:{ items:9, size:.9, dens:120, limit:150, hints:3 },
      hard:{ items:11, size:.8, dens:150, limit:180, hints:3 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${THEMES[c.theme].name} · 물건 ${c.items + c.many * 2}개 · ${mmss(c.limit)}${c.lives ? ' · 기회 ' + c.lives + '번' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `물건 ${c.items}개 · ${mmss(c.limit)}`; },
    init(cfg, rng){
      const sc = gen(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.h = { sc, items:sc.items, list:sc.list.map(L => Object.assign({}, L, { got:0 })), got:new Set(), found:0, misses:0, streak:0, combo:0, hints:0,
        hintLeft:cfg.hints == null ? 3 : cfg.hints, lives:G.duel ? 0 : cfg.lives || 0, coolUntil:0, shadow:!!cfg.shadow, night:!!cfg.night, order:!!cfg.order,
        movers:sc.items.filter(o => o.mv), itEl:{}, view:{ z:1, cx:W / 2, cy:H / 2 }, light:[W / 2, H * .55],
        phase:'play', boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, hr:mulberry(Math.floor(rng() * 1e9)), lastSec:-1, sec:0, fail:null, timers:new Set() };
      G.limit = cfg.limit;
      const m = G.h; if(m.lives) G.paws = m.lives;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear();
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(G && G.raf) cancelAnimationFrame(G.raf);
        document.querySelectorAll('.fxcombo').forEach(e => e.remove());
      };
      /* 테스트·도구용: 물건을 차례로 모두 누른다(장면 좌표로 바로 판정) */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.h !== m || m.phase === 'done'){ res(m.found); return; }
          if(G.paused){ setTimeout(step, 80); return; }
          m.coolUntil = 0;
          const left = m.items.filter(o => !m.got.has(o.i) && (!m.order || o.li === curLi(m)));
          if(!left.length){ setTimeout(step, 80); return; }
          const o = left[0], [px, py] = posOf(o, elapsed());
          if(m.night) setLight(px, py);
          const h = hitAt(px, py); if(h) found(h);
          setTimeout(step, 90);
        };
        step();
      });
    },
    _solveForTest(){ return G.h._solveForTest(); },
    _gen:gen, _stage:stageCfg, _items:ITEMS, _themes:THEMES,
    render(st){
      const m = S(), sc = m.sc;
      const items = m.items.map(o => `<g class="hd-it" data-i="${o.i}" transform="translate(${r1(o.x)} ${r1(o.y)})"><g transform="rotate(${o.rot}) scale(${r1(o.s * 100) / 100})">${itemSvg(o.k, o.F, o.A, sc.T.k, r1(2.2 / o.s * 100) / 100)}</g></g>`).join('');
      const night = m.night ? `<defs><radialGradient id="hdLg"><stop offset="0" stop-color="#000"/><stop offset=".72" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>
        <mask id="hdMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><circle id="hdLight" cx="${m.light[0]}" cy="${m.light[1]}" r="${LIGHT_R}" fill="url(#hdLg)"/></mask></defs>
        <g id="hdNight" class="hd-night"><rect width="${W}" height="${H}" fill="#0B0A2A" fill-opacity=".985" mask="url(#hdMask)"/><circle id="hdGlow" cx="${m.light[0]}" cy="${m.light[1]}" r="${LIGHT_R - 4}" fill="none" stroke="#FFE9A0" stroke-width="2" stroke-dasharray="5 6" opacity=".55"/></g>` : '';
      st.innerHTML = `<div class="ng-hidden">
        <div class="hd-hud">
          <div class="hd-pill" aria-label="찾은 물건"><span class="hd-ic">${ICO.glass}</span><b id="hdFound">0</b><small>/${totalOf(m)}개</small></div>
          <div class="hd-pill hd-time" id="hdTimeP" aria-label="남은 시간"><span class="hd-ic">${ICO.clock}</span><b id="hdTime">${mmss(G.limit)}</b></div>
          <button class="hd-pill hd-btn" id="hdHint" aria-label="힌트"><span class="hd-ic">${ICO.hint}</span><b>${m.hintLeft}</b></button>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="hd-rules" aria-label="켜진 규칙">${m.boss ? '<span class="hd-chipr boss">보스</span>' : ''}${m.mj.map(k => `<span class="hd-chipr mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="hd-chipr tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="hd-barw" id="hdBarWrap"><i id="hdBar"></i></div>
        <div class="hd-row"><div class="hd-lives" id="hdLives" role="img" hidden></div><div class="hd-msg" id="hdMsg">${playMsg()}</div></div>
        <div class="hd-wrap in" id="hdWrap">
          <svg id="hdSvg" class="hd-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${sc.T.name} 장면: 숨은 물건을 찾아 누르세요">
            <g class="hd-bg">${sc.bg}</g><g class="hd-items">${items}</g><g class="hd-top">${sc.top}</g>${night}<g id="hdMarks"></g>
          </svg>
          <div class="hd-zoom"${m.night ? ' hidden' : ''}><button id="hdZin" aria-label="확대">${ICO.zin}</button><button id="hdZout" aria-label="축소" disabled>${ICO.zout}</button></div>
          <div class="hd-cool" id="hdCool" aria-hidden="true"><b>잠깐!</b></div>
        </div>
        <div class="hd-list" id="hdList" role="list" aria-label="찾을 물건"></div>
      </div>`;
      m.items.forEach(o => { m.itEl[o.i] = document.querySelector(`.ng-hidden .hd-it[data-i="${o.i}"]`); });
      drawList(); wire(); hud(); layout(); applyView();
      T_(() => { const w = $('#hdWrap'); if(w) w.classList.remove('in'); }, 700);
      m.onResize = () => layout();
      addEventListener('resize', m.onResize);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.h; return m ? m.found / Math.max(1, totalOf(m)) : 0; },
    lossText(){ const m = G.h; return (m.fail === 'miss' ? '기회를 다 썼어요. ' : '') + `물건 ${m.found}/${totalOf(m)}개를 찾았어요.`; },
    score(){
      const m = G.h, sec = Math.max(0, Math.min(G.limit, m.sec || elapsed()));
      const time = Math.max(0, 350 - Math.floor(sec * 350 / G.limit));
      const extra = Math.max(0, 150 - 40 * m.hints - 15 * m.misses);
      return { base:500, time, extra, rows:['물건 모두 찾기', '시간 보너스 (' + mmss(sec) + ')', `힌트 ${m.hints} · 실수 ${m.misses}`] };
    },
    stars(){ const m = G.h; return m.hints === 0 && m.misses <= 1 ? 3 : m.hints <= 1 && m.misses <= 4 ? 2 : 1; },
    css:`
body[data-mode="hidden"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.28) 0 3px, transparent 3.5px) 0 0/44px 44px,
  linear-gradient(180deg,#FFF1DC 0%,#FFD9A8 55%,#F8BE7C 100%) fixed}
.ng-hidden{position:relative; display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none}
.ng-hidden .hd-hud{display:flex; gap:7px; width:100%; justify-content:space-between}
.ng-hidden .hd-pill{flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; gap:5px; height:44px; padding:0 8px; border-radius:999px; font:inherit;
  background:linear-gradient(180deg,#FFFFFF,#FFF4E6); border:2.5px solid #1A0F45; box-shadow:inset 0 -3px 0 rgba(160,90,20,.14), 0 3px 0 #1A0F45; color:#6A3A10; white-space:nowrap}
.ng-hidden .hd-pill b{font-family:var(--heavy); font-size:20px; font-weight:400; line-height:1; font-variant-numeric:tabular-nums}
.ng-hidden .hd-pill small{font-family:var(--disp); font-size:14px; color:#A06A3A}
.ng-hidden .hd-ic{width:22px; height:22px; flex:none; display:block}
.ng-hidden .hd-ic svg{width:100%; height:100%; display:block}
.ng-hidden .hd-time{flex:1.2 1 0}
.ng-hidden .hd-time b{font-size:23px}
.ng-hidden .hd-time.hurry{background:linear-gradient(180deg,#FF8A8F,#E5484D); color:#fff}
.ng-hidden .hd-time.hurry b{text-shadow:0 2px 0 #8E0F2F}
.ng-hidden .hd-btn{flex:.75 1 0; cursor:pointer; -webkit-tap-highlight-color:transparent; background:linear-gradient(180deg,#FFF6C8,#FFE07A)}
.ng-hidden .hd-btn:active{transform:translateY(2px); box-shadow:inset 0 -3px 0 rgba(160,90,20,.14), 0 1px 0 #1A0F45}
.ng-hidden .hd-btn:disabled{opacity:.45; background:#EDEDED; cursor:default}
.ng-hidden .hd-barw{position:relative; width:100%; height:10px; margin:9px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid #1A0F45; overflow:hidden}
.ng-hidden .hd-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#FFD08A,#F08A24); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-hidden .hd-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-hidden .hd-row{display:flex; align-items:center; gap:8px; width:100%; height:36px}
.ng-hidden .hd-lives{display:flex; gap:2px; flex:none; padding:4px 7px; border-radius:99px; background:#fff; border:2px solid #1A0F45; box-shadow:0 2px 0 #1A0F45}
.ng-hidden .hd-lives[hidden]{display:none}
.ng-hidden .hd-heart{display:block; width:19px; height:19px; color:#FF4D6D}
.ng-hidden .hd-heart svg{width:100%; height:100%; display:block}
.ng-hidden .hd-heart.off{color:#DCD6E6}
.ng-hidden .hd-msg{flex:1; min-width:0; overflow:hidden; height:36px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#7A4310; white-space:nowrap}
.ng-hidden .hd-msg span{overflow:hidden; text-overflow:ellipsis}
.ng-hidden .hd-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px; flex:none}
.ng-hidden .hd-msg b.boss{color:#FFE27A}
.ng-hidden .hd-msg b.bad{color:#FF8A8F}
.ng-hidden .hd-msg.hd-pop, .ng-hidden .hd-msg.hd-win{animation:hidden-in .35s cubic-bezier(.2,1.5,.4,1)}
.ng-hidden .hd-msg.hd-win b{font-size:24px; color:#FFE27A}
@keyframes hidden-in{from{transform:scale(.6); opacity:0}}
.ng-hidden .hd-wrap{position:relative; flex:none; border-radius:18px; overflow:hidden; border:3px solid #1A0F45; background:#fff;
  box-shadow:0 5px 0 #1A0F45, 0 14px 22px rgba(120,60,10,.22); transition:filter .2s}
.ng-hidden .hd-wrap.in{animation:hidden-pop .5s cubic-bezier(.2,1.4,.4,1)}
@keyframes hidden-pop{from{transform:scale(.9); opacity:0}}
.ng-hidden .hd-svg{display:block; width:100%; height:100%; touch-action:none; cursor:crosshair}
.ng-hidden .hd-wrap.zoomed .hd-svg{cursor:grab}
.ng-hidden .hd-it.got{opacity:1}
.ng-hidden .hd-mark circle{fill:none}
.ng-hidden .hd-mark .o{stroke:#fff; stroke-width:7}
.ng-hidden .hd-mark .c{stroke:#FF2E7E; stroke-width:3.6}
.ng-hidden .hd-mark circle{stroke-dasharray:200; stroke-dashoffset:200; animation:hidden-draw .35s ease-out forwards}
.ng-hidden .hd-mark.miss .c{stroke:#2F7BFF; stroke-dasharray:6 5; stroke-dashoffset:0; animation:none}
.ng-hidden .hd-mark.miss .o{stroke-dasharray:none; stroke-dashoffset:0; animation:none}
@keyframes hidden-draw{to{stroke-dashoffset:0}}
.ng-hidden .hd-x path{fill:none; stroke-linecap:round}
.ng-hidden .hd-x .o{stroke:#fff; stroke-width:7}
.ng-hidden .hd-x .c{stroke:#E5484D; stroke-width:4}
.ng-hidden .hd-x{animation:hidden-fade .65s ease-in forwards}
@keyframes hidden-fade{0%,60%{opacity:1} 100%{opacity:0}}
.ng-hidden .hd-hint .f{fill:#FFE27A; fill-opacity:.28}
.ng-hidden .hd-hint .c{fill:none; stroke:#FFD23F; stroke-width:4; stroke-dasharray:8 6}
.ng-hidden .hd-hint{animation:hidden-hint 2.6s ease-in-out forwards}
@keyframes hidden-hint{0%{opacity:0} 12%{opacity:1} 30%{opacity:.6} 45%{opacity:1} 80%{opacity:1} 100%{opacity:0}}
.ng-hidden .hd-night{transition:opacity .6s}
.ng-hidden .hd-night.off{opacity:0}
.ng-hidden .hd-zoom{position:absolute; right:8px; bottom:8px; display:flex; flex-direction:column; gap:7px}
.ng-hidden .hd-zoom[hidden]{display:none}
.ng-hidden .hd-zoom button{width:44px; height:44px; padding:7px; border-radius:50%; border:2.5px solid #1A0F45; background:rgba(255,255,255,.92); box-shadow:0 3px 0 #1A0F45; cursor:pointer; -webkit-tap-highlight-color:transparent}
.ng-hidden .hd-zoom button svg{width:100%; height:100%; display:block}
.ng-hidden .hd-zoom button:active{transform:translateY(2px); box-shadow:0 1px 0 #1A0F45}
.ng-hidden .hd-zoom button:disabled{opacity:.4; cursor:default}
.ng-hidden .hd-cool{position:absolute; left:50%; top:10px; transform:translateX(-50%) scale(.6); opacity:0; pointer-events:none; transition:opacity .15s, transform .2s cubic-bezier(.2,1.5,.4,1)}
.ng-hidden .hd-cool b{display:block; font-family:var(--heavy); font-weight:400; font-size:17px; color:#fff; background:#E5484D; border:2.5px solid #1A0F45; border-radius:99px; padding:5px 13px; box-shadow:0 3px 0 #1A0F45; white-space:nowrap}
.ng-hidden .hd-wrap.cool .hd-cool{opacity:1; transform:translateX(-50%) scale(1)}
.ng-hidden .hd-wrap.cool .hd-svg{filter:saturate(.55) brightness(.92)}
.ng-hidden .hd-wrap.cleared{animation:hidden-cheer .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes hidden-cheer{40%{transform:scale(1.03)}}
.ng-hidden .hd-list{--cols:4; display:grid; grid-template-columns:repeat(var(--cols), minmax(0, 1fr)); gap:5px; width:100%; margin:12px 0 0}
.ng-hidden .hd-chip{position:relative; display:flex; align-items:center; gap:3px; height:36px; padding:0 5px 0 3px; border-radius:11px; background:#fff; border:2px solid #1A0F45; box-shadow:0 2px 0 #1A0F45; min-width:0}
.ng-hidden .hd-ci{width:28px; height:28px; flex:none; display:block}
.ng-hidden .hd-ci svg{width:100%; height:100%; display:block; overflow:visible}
.ng-hidden .hd-cn{flex:1; min-width:0; font-family:var(--disp); font-size:12.5px; line-height:1.05; color:#4A2A10; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:-.3px}
.ng-hidden .hd-chip em{position:absolute; top:-7px; right:-5px; font-style:normal; font-family:var(--heavy); font-size:12px; line-height:1; padding:3px 5px; border-radius:99px; background:#F08A24; color:#fff; border:2px solid #1A0F45}
.ng-hidden .hd-chip em.ok{background:#2BB673}
.ng-hidden .hd-chip.done{background:#E3FAEC}
.ng-hidden .hd-chip.done em{background:#2BB673}
.ng-hidden .hd-chip.done .hd-cn{color:#2B8A55; text-decoration:line-through; text-decoration-thickness:2px}
.ng-hidden .hd-chip.done .hd-ci{opacity:.55}
.ng-hidden .hd-chip.cur{background:#FFF6C8; animation:hidden-cur 1s ease-in-out infinite alternate}
.ng-hidden .hd-chip.wait{opacity:.55}
@keyframes hidden-cur{to{box-shadow:0 2px 0 #1A0F45, 0 0 10px 3px rgba(255,200,60,.85)}}
.ng-hidden .hd-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-hidden .hd-chipr{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#6A3A10; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-hidden .hd-chipr.mj{background:#FFF0DC; color:#9A4A08}
.ng-hidden .hd-chipr.tw{background:#EFE7FF; color:#5B3FB5}
.ng-hidden .hd-chipr.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
@media (max-width:370px){ .ng-hidden .hd-pill b{font-size:18px} .ng-hidden .hd-time b{font-size:20px} .ng-hidden .hd-pill small{font-size:12px} .ng-hidden .hd-hud{gap:5px} .ng-hidden .hd-msg b{font-size:18px} .ng-hidden .hd-cn{font-size:11.5px} .ng-hidden .hd-chipr{font-size:12px; padding:4px 7px} }
@media (prefers-reduced-motion: reduce){ .ng-hidden .hd-mark circle{animation:none; stroke-dashoffset:0} .ng-hidden .hd-wrap.in, .ng-hidden .hd-chip.cur{animation:none} }
`,
    sounds:{
      hdFind(o){ const n = Math.min(8, o.n || 0); aBell({ f:penta(n + 4, 72), t:0, d:.6, v:.09, idx:1.4, rev:.35 }); aBell({ f:penta(n + 6, 72), t:.08, d:.7, v:.07, idx:1.2, rev:.4 }); if(n >= 2) aSparkle({ root:84 + Math.min(7, n), n:4, t:.12, v:.03 }); },
      hdMiss(){ aTone({ f:330, f2:200, type:'triangle', d:.22, v:.1 }); aThump({ f:140, f2:70, d:.14, v:.12 }); },
      hdHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      hdLight(){ aWhoosh({ f:900, f2:2400, a:.02, d:.12, v:.03 }); },
      hdZoom(o){ aTone({ f:o.out ? 760 : 620, f2:o.out ? 560 : 900, type:'triangle', d:.08, v:.04 }); },
      hdTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      hdTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ hdTick:250, hdFind:60, hdLight:80, hdZoom:60 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); [79, 84, 88, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();

/* 대전: 같은 장면(같은 씨앗)에서 누가 먼저 다 찾나. AI 상대의 평균 시간·성공률(duelPace), 상대에게 보내는 진행 수치(duelStat) */
Object.assign(NG.hidden, { duelPace:[105, .75], duelHow:'같은 장면에서 누가 먼저 다 찾나', duelStat:{ unit:'개', get:() => ({ v:G.h.found, t:G.h.items.length }) } });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.hidden.scene = { kind:'motes', colors:['#FFFFFF', '#FFE2B8', '#FFF3B0'], density:1 };
