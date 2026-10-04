// 고스톱: 직접 새로 그린 11월(오동·똥) 화투 4장 SVG 만들기 → games/gostop/art/*.svg
//   node tools/gostop-art-cards.mjs [--preview 폴더]   (preview: 크게 4장을 나란히 PNG로 그려 봄)
// 화풍은 그림판의 Commons 'SVG Hwatu'(빨간 테두리 · 흰 판 · 먹선 1.2 · 평면 색 · 그라데이션 없음)에 맞추되,
// 그림은 전통 소재(봉황 · 오동잎 · 오동꽃)를 직접 새로 그린 오리지널.
// 좌표: 원본과 같은 103.2×168.2, 흰 판은 (6.3,7.2)~(96.9,161) 둥근 사각형. tools/gostop-sprite.mjs가 이 폴더에 같은 이름 파일이 있으면 원본 대신 씀.
// (8월 기러기 · 12월 제비 등 다른 새 패는 이 파일이 만들지 않음 — 그 SVG는 손대지 않음)
import fs from 'node:fs'; import path from 'node:path';
const OUT = 'games/gostop/art';
const R = '#ef1d1e', Y = '#faea01', O = '#f79e33', K = '#16121a', W = '#fff', V = '#b48bd8';
const PANEL = 'M13.3 7.2h76.6q7 0 7 7v139.8q0 7-7 7H13.3q-7 0-7-7V14.2q0-7 7-7z';
const card = (art) => `<svg width="103.2" height="168.2" viewBox="0 0 103.2 168.2" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round">
<defs><clipPath id="p"><path d="${PANEL}"/></clipPath></defs>
<rect width="103.2" height="168.2" fill="${R}"/><path d="${PANEL}" fill="${W}"/>
<g clip-path="url(#p)">${art}</g>
<path d="${PANEL}" fill="none" stroke="${K}" stroke-width="1.2"/></svg>`;
const f1 = (n) => (Math.round(n * 100) / 100).toString();
const ln = (d, c = K, w = 1.2, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" ${extra}/>`;
const sh = (d, f, s = K, w = 1.2, extra = '') => `<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}" ${extra}/>`;
const T = (x, y, r = 0, s = 1) => `transform="translate(${x} ${y}) rotate(${r}) scale(${s})"`;
/* 점 목록 → 부드러운 닫힌 곡선(캣멀롬 → 3차 베지어) */
function smooth(pts, closed = true){
  const n = pts.length, P = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for(let i = 0; i < (closed ? n : n - 1); i++){
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
/* 光 표시(원본 세트와 같은 빨간 원 + 흰 글자) */
const KWANG = (x, y) => `<g ${T(x, y)}><circle r="9.6" fill="${R}" stroke="${K}" stroke-width="1.2"/><text y="5.3" font-size="14.5" font-weight="900" text-anchor="middle" fill="${W}" font-family="'Noto Serif KR','Noto Serif CJK KR','Noto Sans KR',serif">光</text></g>`;

/* ---------- 오동잎: 넓은 하트꼴 · 얕은 다섯 갈래 · 물결 가장자리 · 흰 잎맥 · 잎자루 ----------
   (x,y) = 잎자루가 붙는 오목한 밑(잎 기부), rot = 잎끝 방향(0 = 위, 시계 방향 +), L = 잎 길이 */
function leaf(x, y, rot, L, o = {}){
  const a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const tf = (u, v) => [x + (u * ca - v * sa) * L, y + (u * sa + v * ca) * L];  /* 잎 좌표(u 오른쪽, v 아래) → 카드 */
  const wv = o.wave ?? 1, cy = -.5, k5 = o.lobes === 5;
  const rad = (ph) => {
    const lobe = k5 ? Math.pow(Math.abs(Math.cos(2.5 * ph)), 3) : Math.pow(Math.abs(Math.cos(1.8 * ph)), 3);
    const side = k5 ? 1.26 : 1.75;
    const tip = Math.exp(-Math.pow(ph / .1, 2)) * .09 + Math.exp(-Math.pow((Math.abs(ph) - side) / .09, 2)) * .05;
    const sinus = 1 - .6 * Math.exp(-Math.pow((Math.PI - Math.abs(ph)) / .32, 2));
    return .5 * (.87 + .14 * lobe + tip) * sinus * (1 + .022 * wv * Math.sin(ph * 11 + (o.ph || 0)));
  };
  const pt = (ph, k = 1) => { const r = rad(ph) * k; return [Math.sin(ph) * r * (o.wide || 1.12), cy - Math.cos(ph) * r]; };
  const N = 72, outline = [];
  for(let i = 0; i < N; i++){ const ph = -Math.PI + (i + .5) * 2 * Math.PI / N; outline.push(tf(...pt(ph))); }
  const base = [0, cy + rad(Math.PI) * .9];   /* 오목한 밑 */
  const B = tf(...base);
  const Q = (p0, c, p1) => { const A = tf(...p0), C = tf(...c), E = tf(...p1); return `M${f1(A[0])} ${f1(A[1])}Q${f1(C[0])} ${f1(C[1])} ${f1(E[0])} ${f1(E[1])}`; };
  const at = (ph, k) => pt(ph, k);
  let vein = '';
  /* 가운데 맥 */
  vein += ln(Q(base, [.02, -.45], at(0, .9)), W, .95);
  /* 큰 곁맥(밑에서 부채꼴로) — 갈래 끝으로 */
  const side = k5 ? 1.26 : 1.75;
  for(const s of [-1, 1]){
    vein += ln(Q(base, [s * .16, -.36], at(s * side, .86)), W, .8);
    vein += ln(Q(base, [s * .24, -.16], at(s * 2.45, .8)), W, .65);
    /* 가운데 맥에서 갈라지는 잔맥 */
    for(const [t, ph] of [[.4, .62], [.64, .34]]){ const m = [0, base[1] + (cy - .42 - base[1]) * t]; vein += ln(Q(m, [s * .1, m[1] - .12], at(s * ph, .85)), W, .55); }
    /* 큰 곁맥에서 갈라지는 잔맥(위 · 아래) */
    const m1 = [s * .2, -.36]; vein += ln(Q(m1, [s * .34, -.3], at(s * (side + .42), .85)), W, .5);
    const m2 = [s * .13, -.44]; vein += ln(Q(m2, [s * .2, -.62], at(s * (side - .6), .86)), W, .5);
  }
  /* 잎자루 */
  const pl = o.stem ?? .34, P0 = tf(base[0], base[1] - .02), P1 = tf(.03 * (o.bend || 1), base[1] + pl * .5), P2 = tf(.09 * (o.bend || 1), base[1] + pl);
  const stem = o.stem === 0 ? '' : ln(`M${f1(P0[0])} ${f1(P0[1])}Q${f1(P1[0])} ${f1(P1[1])} ${f1(P2[0])} ${f1(P2[1])}`, W, 3.6) + ln(`M${f1(P0[0])} ${f1(P0[1])}Q${f1(P1[0])} ${f1(P1[1])} ${f1(P2[0])} ${f1(P2[1])}`, K, 2);
  return stem + `<path d="${smooth(outline)}" fill="${K}" stroke="${W}" stroke-width="1.5" paint-order="stroke"/>` + vein;
}

/* ---------- 오동꽃: 위로 선 원뿔 꽃차례에 연보라 나팔꽃 모양 꽃(갈색 꽃받침) ----------
   (x,y) = 꽃대 밑, rot = 기울기, H = 높이 */
function bloom(x, y, rot, H, flip = 1){
  /* 꽃 하나: 위를 보는 나팔(통 → 벌어진 입 · 다섯 갈래 끝), 밑에 검은 꽃받침 */
  const bell = (bx, by, ang, s) => `<g ${T(f1(bx), f1(by), f1(ang), f1(s))}>
      ${sh('M-1.3 .2C-1.6 -1.6 -1.1 -2.6 0 -2.8C1.1 -2.6 1.6 -1.6 1.3 .2C.6 .9 -.6 .9 -1.3 .2Z', K, K, .4)}
      ${sh('M-1.1 -2.2C-1.4 -4.6 -2.4 -6.6 -4.2 -8.2C-2.6 -9.6 2.6 -9.6 4.2 -8.2C2.4 -6.6 1.4 -4.6 1.1 -2.2Z', V, K, .6)}
      ${sh('M-4.2 -8.2C-5 -9.4 -4.4 -10.8 -3 -10.8C-2.2 -11.8 -.8 -12 0 -11.2C.8 -12 2.2 -11.8 3 -10.8C4.4 -10.8 5 -9.4 4.2 -8.2C2.6 -9.6 -2.6 -9.6 -4.2 -8.2Z', '#dcc8f0', K, .6)}
      ${ln('M-1.6 -9.8C-.6 -10.4 .6 -10.4 1.6 -9.8', K, .45)}<circle cx="0" cy="-9.9" r=".5" fill="${Y}"/></g>`;
  const stalk = (t) => [Math.sin(t * 2.6) * 1.2 * flip, -H * t];
  let s = ln(`M0 0C${f1(1.2 * flip)} ${f1(-H * .35)} ${f1(-.6 * flip)} ${f1(-H * .7)} ${f1(.8 * flip)} ${f1(-H)}`, K, 1.3);
  let flw = '', buds = '';
  /* 아래 줄일수록 넓고 크게: 줄마다 좌우 + 가운데 */
  const rows = [[.3, 3, 1.0, 9.5], [.44, 3, .92, 8], [.57, 3, .82, 6.4], [.69, 2, .72, 4.8], [.8, 2, .6, 3.4]];
  const items = [];
  rows.forEach(([t, n, sz, sp], i) => {
    const [cx, cy] = stalk(t);
    const offs = n === 3 ? [-1, 1, 0] : [-1, 1];
    for(const k of offs){
      const ex = cx + k * sp, ey = cy - (k === 0 ? 3.2 : 0) + Math.abs(k) * 1.2, ang = k * (30 + i * 4);
      items.push(ln(`M${f1(cx)} ${f1(cy + 2)}Q${f1(cx + k * sp * .3)} ${f1(cy)} ${f1(ex)} ${f1(ey)}`, K, .6) + bell(ex, ey, ang, sz));
    }
  });
  flw = items.reverse().join('');
  for(let i = 0; i < 5; i++){ const t = .86 + i * .035, [cx, cy] = stalk(t); buds += `<ellipse cx="${f1(cx + (i % 2 ? 1.9 : -1.9) * (1 - i * .15))}" cy="${f1(cy)}" rx="${f1(1.7 - i * .22)}" ry="${f1(2.1 - i * .25)}" fill="${i % 2 ? K : V}" stroke="${K}" stroke-width=".5"/>`; }
  return `<g ${T(x, y, rot)}>${s}${buds}${flw}</g>`;
}

/* ---------- 땅 ---------- */
const ground = (c, y0, amp = 4) => `<path d="M0 ${y0 + amp}C18 ${y0 - amp} 34 ${y0 + amp * .5} 52 ${y0}S84 ${y0 - amp} 104 ${y0 + amp * .4}V170H0Z" fill="${c}" stroke="${K}" stroke-width="1.2"/>`;

/* ---------- 피 · 쌍피 ---------- */
function kasu(kind){
  if(kind === 'ss') return ground(R, 120, 5)
    + bloom(28, 86, -14, 62) + bloom(76, 82, 14, 66, -1)
    + leaf(22, 118, -42, 54, { ph: 1 }) + leaf(82, 116, 42, 54, { ph: 2, lobes: 5 })
    + leaf(52, 124, 0, 58, { ph: 3 }) + leaf(24, 166, -24, 46, { ph: 4, stem: .15, lobes: 5 }) + leaf(80, 168, 26, 46, { ph: 5, stem: .15 });
  /* 피 두 장: 같은 짜임을 좌우로 바꾸고 잎 크기 · 갈래를 조금씩 다르게 */
  const p = (m, flowerX, Ls) => ground(Y, 136, 4) + bloom(m(flowerX), 88, m === id ? 6 : -7, 70, m === id ? -1 : 1)
    + Ls.map(([x, y, r, L, o]) => leaf(m(x), y, m === id ? r : -r, L, o)).join('');
  const id = (x) => x, mir = (x) => 103.2 - x;
  if(kind === 'p1') return p(id, 64, [[28, 106, -36, 60, { ph: 1 }], [76, 114, 30, 54, { ph: 2, lobes: 5 }], [50, 148, -6, 58, { ph: 3, stem: .2, lobes: 5 }], [12, 168, -50, 42, { ph: 4, stem: .15 }], [92, 170, 46, 40, { ph: 5, stem: .15 }]]);
  return p(mir, 62, [[30, 104, -32, 58, { ph: 5, lobes: 5 }], [76, 116, 36, 54, { ph: 2 }], [54, 150, -2, 60, { ph: 1, stem: .2 }], [14, 170, -44, 40, { ph: 3, stem: .15, lobes: 5 }], [90, 168, 52, 40, { ph: 4, stem: .15 }]]);
}

/* ---------- 봉황(광) ---------- */
/* 등뼈 곡선(3차 베지어) 둘레로 끝이 뾰족한 불꽃 깃 하나 */
function plume(p0, p1, p2, p3, w, fill, o = {}){
  const bz = (t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); };
  const N = 26, L = [], Rr = [], mid = [];
  for(let i = 0; i <= N; i++){
    const t = i / N, a = bz(Math.max(0, t - .01)), b = bz(Math.min(1, t + .01)), c = bz(t);
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const ww = w * Math.pow(Math.sin(Math.PI * Math.min(1, t * (o.fat || 1.25))), .8) * (1 - t * .55) * (1 + (o.wv ?? .12) * Math.sin(t * Math.PI * (o.waves || 4)));
    L.push([c[0] + nx * ww, c[1] + ny * ww]); Rr.unshift([c[0] - nx * ww * (o.asym || 1), c[1] - ny * ww * (o.asym || 1)]); mid.push(c);
  }
  const out = `<path d="${smooth([...L, ...Rr])}" fill="${fill}" stroke="${K}" stroke-width="${o.sw || 1}"/>`;
  const spine = o.spine === false ? '' : ln(smooth(mid.slice(2, N - 3), false), o.spineC || (fill === K ? W : K), o.spineW || .6);
  const band = o.band ? `<path d="${smooth([...L.slice(N * .55 | 0), ...Rr.slice(0, N - (N * .55 | 0) + 1)])}" fill="${o.band}" stroke="${K}" stroke-width=".7"/>` : '';
  return out + band + spine;
}
/* 불꽃 깃: 등뼈를 따라 바깥쪽(L)에 뒤로 젖힌 톱니 */
function flame(p0, p1, p2, p3, w, fill, o = {}){
  const bz = (t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); };
  const N = o.n || 30, L = [], Rr = [], mid = [];
  for(let i = 0; i <= N; i++){
    const t = i / N, a = bz(Math.max(0, t - .01)), b = bz(Math.min(1, t + .01)), c = bz(t);
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const ww = w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + .04)), .7) * (1 - t * .5);
    const tooth = o.teeth && i > 2 && i < N - 2 && i % (o.teeth) === 0;
    const k = tooth ? 1.5 : 1, back = tooth ? w * .9 : 0, tx = (b[0] - a[0]) / m, ty = (b[1] - a[1]) / m;
    const pL = [c[0] + nx * ww * k + tx * back, c[1] + ny * ww * k + ty * back];
    L.push(pL); if(tooth) L.push(pL);
    const ws = o.teeth2 && i > 2 && i < N - 2 && (i + 2) % o.teeth2 === 0, k2 = ws ? 1.4 : 1, back2 = ws ? w * .8 : 0;
    const pR = [c[0] - nx * ww * k2 * (o.asym || 1) + tx * back2, c[1] - ny * ww * k2 * (o.asym || 1) + ty * back2];
    Rr.unshift(pR); if(ws) Rr.unshift(pR);
    mid.push(c);
  }
  const out = `<path d="${smooth([...L, ...Rr])}" fill="${fill}" stroke="${K}" stroke-width="${o.sw || 1}"/>`;
  const spine = o.spine === false ? '' : ln(smooth(mid.slice(3, N - 4), false), o.spineC || (fill === K ? W : K), o.spineW || .55);
  return out + spine;
}
function phoenix(){
  /* 목: 머리 뒤 밑에서 오른쪽 아래로 크게 휘어 판 밖으로. 비늘 깃 */
  const neckL = [[38, 58], [42, 74], [54, 94], [72, 108], [94, 116], [110, 119]];
  const neckR = [[110, 80], [94, 78], [80, 70], [70, 56], [62, 44]];
  const neck = smooth([...neckL, ...neckR]);
  let sc = '';
  const sp = [[50, 50], [56, 72], [70, 90], [90, 99], [112, 101]];
  const spt = (t) => { const s = t * (sp.length - 1), i = Math.min(sp.length - 2, Math.floor(s)), f = s - i; const a = sp[Math.max(0, i - 1)], b = sp[i], c = sp[i + 1], d = sp[Math.min(sp.length - 1, i + 2)];
    const h = (k) => .5 * ((2 * b[k]) + (-a[k] + c[k]) * f + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * f * f + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * f * f * f); return [h(0), h(1)]; };
  const rowC = [R, Y, R, W];
  for(let r = 0; r < 16; r++){
    const t = r * .066, c = spt(t), c2 = spt(t + .01); let tx = c2[0] - c[0], ty = c2[1] - c[1]; const m = Math.hypot(tx, ty); tx /= m; ty /= m;
    const nx = -ty, ny = tx, ang = Math.atan2(ty, tx) * 180 / Math.PI, col = rowC[r % 4];
    for(let k = -4; k <= 4; k++){
      const off = k * 5.4 + (r % 2) * 2.7, x = c[0] + nx * off, y = c[1] + ny * off;
      sc += `<g ${T(f1(x), f1(y), f1(ang - 90))}>${sh('M-3 -1.2C-3 3.8 3 3.8 3 -1.2', col, K, .7)}${col === R ? ln('M-1.5 .5C-.6 1.7 .6 1.7 1.5 .5', W, .45) : col === W ? `<circle cy=".8" r=".9" fill="${R}"/>` : ''}</g>`;
    }
  }
  /* 머리 뒤에서 목 위로 흘러내리는 목깃(불꽃 · 검정 · 빨강 · 노랑) */
  const hackle = flame([58, 40], [72, 38], [86, 46], [106, 44], 4.6, K, { teeth: 6 })
    + flame([60, 48], [74, 50], [88, 58], [106, 58], 4.4, R, { teeth: 6 })
    + flame([60, 56], [72, 62], [86, 70], [104, 72], 4, Y, { teeth: 6 })
    + flame([56, 60], [64, 70], [76, 78], [92, 82], 3.4, K, { teeth: 6 });
  /* 볏: 정수리에서 뒤(오른쪽 위)로 휘날리는 긴 불꽃 깃 */
  const crestBack = flame([50, 38], [60, 18], [80, 12], [104, 6], 5.8, K, { teeth: 5, n: 34 })
    + flame([54, 39], [68, 26], [86, 26], [106, 18], 5.2, R, { teeth: 5, n: 34 })
    + flame([57, 41], [72, 35], [88, 38], [106, 31], 4.4, Y, { teeth: 5, n: 34 });
  const crestFront = flame([38, 40], [46, 31], [60, 27], [80, 21], 3.8, R, { teeth: 5, n: 30 })
    + flame([44, 38], [56, 32], [72, 31], [94, 26], 3, K, { teeth: 5, n: 30 });
  /* 머리(왼쪽을 보는 옆얼굴): 길쭉한 붉은 얼굴 */
  const head = sh('M31 44C36 38.4 44 35.4 53 35.6C61 35.8 67 39.4 68.4 45.4C69.2 51 65 56 58 58.4C50 61 40 60.6 31.4 55.6Z', R, K, 1.2);
  let hs = '';
  for(let r = 0; r < 6; r++) for(let c = 0; c < 4; c++){
    const x = 58 + c * 4.4 + (r % 2) * 2.2 - r * .6, y = 46 + r * 3.4, col = r % 2 ? Y : R;
    hs += sh(`M${f1(x - 2.2)} ${f1(y)}C${f1(x - 2.2)} ${f1(y + 3.2)} ${f1(x + 2.2)} ${f1(y + 3.2)} ${f1(x + 2.2)} ${f1(y)}`, col, K, .6);
  }
  const headScale = `<clipPath id="hd"><path d="M31 44C36 38.4 44 35.4 53 35.6C61 35.8 67 39.4 68.4 45.4C69.2 51 65 56 58 58.4C50 61 40 60.6 31.4 55.6Z"/></clipPath><g clip-path="url(#hd)">${hs}</g>`;
  /* 매 부리처럼 날카롭게 굽은 노란 부리(윗부리 갈고리 · 작은 아랫부리) */
  const beakU = sh('M31.4 43.4C25.4 43.2 19.8 45 16.4 48.4C14 50.8 13 53.8 13.6 57C14.6 55.2 16.2 54.2 18.4 53.8C22.4 53.2 27 52.4 31.4 51.2Z', Y, K, 1.2);
  const beakL = sh('M31.4 53C27.4 53.4 23 54.6 20 56.4C23.4 57.8 27.8 57.8 32 56.6Z', Y, K, 1);
  const mouth = sh('M31.4 51.2C27 52.4 22.4 53.2 18.4 53.8C19 54.8 19.6 55.6 20 56.4C23 54.6 27.4 53.4 31.4 53Z', O, K, .6);
  const beakMark = ln('M17.6 50.4C20.6 48 24.6 46.8 28.8 46.6', K, .6) + `<ellipse cx="27.4" cy="45.6" rx="1.1" ry=".55" fill="${K}"/>`;
  /* 턱 밑으로 흘러내리는 붉은 수염 깃 */
  const beard = flame([40, 58], [44, 68], [52, 72], [62, 74], 3, K, { teeth2: 5, spine: false }) + flame([33, 55], [31, 65], [37, 74], [50, 79], 4, R, { teeth2: 4, spineC: K });
  /* 눈: 앞이 낮고 뒤가 치켜 올라간 매서운 눈 · 굵은 눈썹 · 뒤로 뻗은 눈꼬리 장식 */
  const eye = sh('M36.6 45.8C39.4 43 44 42 49 42.2C52 42.4 54.8 43.4 56.8 44.6C52 47.2 43.6 48.2 36.6 45.8Z', W, K, .9)
    + `<circle cx="45.6" cy="44.9" r="2.7" fill="${Y}" stroke="${K}" stroke-width=".7"/><circle cx="45.9" cy="44.9" r="1.4" fill="${K}"/><circle cx="45.2" cy="44.4" r=".45" fill="${W}"/>`
    + sh('M33.6 45C37.4 38.6 46 36 56 36.6C60.4 36.8 64.6 37.8 68 39.8C62.6 39.8 57 40.6 51.6 41.8C45.6 42.8 39.6 43.8 33.6 45Z', K, K, .6)
    + flame([56, 44.4], [60, 45], [64, 47], [69, 50.4], 1.7, K, { spine: false })
;
  /* 정수리에서 뒤로 활처럼 휘어 흐르는 긴 장식 깃 두 가닥 */
  const ribbons = flame([45, 38], [42, 20], [62, 10], [90, 12], 2.6, R, { spineC: K, n: 30 }) + flame([49, 37], [50, 25], [66, 19], [92, 22], 2.2, R, { spineC: K, n: 30 });
  return `<clipPath id="nk"><path d="${neck}"/></clipPath>
    ${crestBack}${ribbons}
    <path d="${neck}" fill="${R}" stroke="${K}" stroke-width="1.2"/><g clip-path="url(#nk)">${sc}</g><path d="${neck}" fill="none" stroke="${K}" stroke-width="1.2"/>
    ${hackle}${beard}${head}${headScale}${crestFront}${beakU}${mouth}${beakL}${beakMark}${eye}`;
}
function kwangCard(){
  return `${ground(Y, 134, 4)}
    ${leaf(26, 122, -26, 62, { ph: 1 })}${leaf(72, 144, 22, 56, { ph: 2, stem: .2, lobes: 5 })}${leaf(50, 162, -4, 48, { ph: 5, stem: .1 })}
    ${phoenix()}
    ${leaf(30, 168, -14, 50, { ph: 3, stem: .15, lobes: 5 })}${leaf(96, 170, 40, 42, { ph: 4, stem: .15 })}
    ${KWANG(20, 21)}`;
}

const CARDS = {
  'Hwatu November Hikari.svg':kwangCard(),
  'Hwatu November Kasu 2.svg':kasu('ss'),
  'Hwatu November Kasu 1.svg':kasu('p1'),
  'Hwatu November Kasu 3.svg':kasu('p2')
};
fs.mkdirSync(OUT, { recursive:true });
for(const [k, v] of Object.entries(CARDS)) fs.writeFileSync(path.join(OUT, k), card(v));
console.log('그림', Object.keys(CARDS).length, '장 →', OUT);
const pv = process.argv.indexOf('--preview');
if(pv > 0){
  const dir = process.argv[pv + 1];
  const { chromium } = await import('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport:{ width:1840, height:740 } });
  const html = Object.keys(CARDS).map(k => `<img style="width:440px;margin:8px" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(fs.readFileSync(path.join(OUT, k), 'utf8'))}">`).join('');
  await p.setContent(`<body style="margin:0;background:#3f8f2f">${html}</body>`); await p.waitForTimeout(300);
  await p.screenshot({ path:path.join(dir, 'nov-big.png') });
  await b.close();
}
