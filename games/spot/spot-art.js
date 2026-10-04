/* 틀린그림 찾기 — 그림 조각(직접 그린 오리지널 SVG)·장면 테마. spot.js보다 먼저 불러온다.
   조각 하나 = { w, h, flip(좌우가 달라 보이는지), pal:[[색 칸 0 후보…], [색 칸 1 후보…]], det:[작은 부분 키…], draw(o) }
   draw는 0..w × 0..h 좌표에 그린다. o.c = 고른 색들, o.d = 작은 부분 켜짐/꺼짐.
   ※ 조각·테마 순서와 rng 쓰는 순서를 바꾸면 같은 씨앗의 그림이 달라진다(추가는 끝에). */
const SPOT_ART = (() => {
  const OL = '#1A0F45';
  const K = w => `stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const K2 = K(2), K15 = K(1.5);
  const HL = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''} fill="#fff" opacity=".6"/>`;
  const starPath = (cx, cy, R, r, n = 5) => { let d = ''; for(let i = 0; i < n * 2; i++){ const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); } return d + 'z'; };
  /* 겹친 동그라미 덩어리: 테두리 먼저, 그 위에 채움만(안쪽 선이 안 보이게) */
  const blob = (cs, fill, extra = '') => cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${K2}/>`).join('') + cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r - 1.1}" fill="${fill}"/>`).join('') + extra;
  const heart = (cx, cy, s, fill) => `<path d="M${cx} ${cy + 4 * s}c${-3.5 * s} ${-2.4 * s} ${-5.5 * s} ${-4.4 * s} ${-5.5 * s} ${-6.6 * s} 0 ${-1.8 * s} ${1.3 * s} ${-3 * s} ${2.8 * s} ${-3 * s} ${1.2 * s} 0 ${2.1 * s} ${.7 * s} ${2.7 * s} ${1.6 * s} ${.6 * s} ${-.9 * s} ${1.5 * s} ${-1.6 * s} ${2.7 * s} ${-1.6 * s} ${1.5 * s} 0 ${2.8 * s} ${1.2 * s} ${2.8 * s} ${3 * s} 0 ${2.2 * s} ${-2 * s} ${4.2 * s} ${-5.5 * s} ${6.6 * s}z" fill="${fill}" ${K(1.2)}/>`;

  /* 색 후보: 같은 칸 안에서는 색상(빛깔)이 확실히 달라 한눈에 구분되게 */
  const BR = ['#FF5A5F', '#FFC93C', '#3DBE5A', '#4B8BFF', '#B266FF', '#FF8A3D', '#FF6FB5'];

  const P = {
    house:{ w:64, h:62, flip:true, pal:[['#FFE3B3', '#FFB3C7', '#BDE6FF', '#C9F2C2'], ['#E8503A', '#4B6CD9', '#8E5CE0', '#2EAA6A']], det:['win', 'chim'],
      draw:o => `${o.d.chim ? `<rect x="42" y="6" width="9" height="16" fill="#C46A3A" ${K2}/>` : ''}<rect x="8" y="26" width="48" height="34" fill="${o.c[0]}" ${K2}/><path d="M2 29L32 4 62 29z" fill="${o.c[1]}" ${K2}/>${o.d.win ? `<circle cx="32" cy="19" r="5.2" fill="#FFF3B0" ${K15}/>` : ''}<rect x="14" y="38" width="13" height="22" rx="3" fill="#9A5B2E" ${K2}/><circle cx="24" cy="49" r="1.3" fill="${OL}"/><rect x="34" y="35" width="15" height="13" rx="1.5" fill="#BDEBFF" ${K2}/><path d="M41.5 35v13M34 41.5h15" stroke="${OL}" stroke-width="1.4"/>` },
    tree:{ w:52, h:70, pal:[['#3DBE5A', '#FF9A3D', '#FF8FC8']], det:['fruit'],
      draw:o => `<path d="M22 70V42h8v28z" fill="#9A5B2E" ${K2}/>${blob([[15, 33, 13], [37, 33, 13], [26, 19, 16], [26, 37, 12]], o.c[0])}${HL(19, 14, 4, 6, 30)}${o.d.fruit ? [[14, 32], [35, 25], [29, 41]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.4" fill="#E8203F" ${K(1.4)}/>`).join('') : ''}` },
    pine:{ w:40, h:72, pal:[['#2B9348', '#5FC3E4', '#9B7BFF']], det:['snow', 'star'],
      draw:o => `<rect x="17" y="60" width="6" height="12" fill="#9A5B2E" ${K2}/><path d="M20 32L2 62h36z" fill="${o.c[0]}" ${K2}/><path d="M20 20L5 46h30z" fill="${o.c[0]}" ${K2}/><path d="M20 8L8 32h24z" fill="${o.c[0]}" ${K2}/>${o.d.snow ? `<path d="M20 8l-6.4 13 3.6-1.6 2.8 2.6 2.8-2.6 3.6 1.6z" fill="#fff" ${K(1.3)}/>` : ''}${o.d.star ? `<path d="${starPath(20, 8, 7.5, 3.3)}" fill="#FFE27A" ${K15}/>` : ''}` },
    cloud:{ w:60, h:30, pal:[['#FFFFFF', '#FFC2DD', '#FFE58A']],
      draw:o => `${blob([[15, 18, 10], [30, 13, 12], [45, 18, 10]], o.c[0])}<rect x="15" y="17" width="30" height="11" fill="${o.c[0]}"/><path d="M15 28h30" stroke="${OL}" stroke-width="2"/>` },
    sun:{ w:40, h:40, pal:[['#FFC93C', '#FF7A3D', '#FF6FB5']], det:['face'],
      draw:o => `${Array.from({ length:8 }, (_, i) => `<path d="M17.6 1.5h4.8L20 9z" transform="rotate(${i * 45} 20 20)" fill="#FFE27A" ${K15}/>`).join('')}<circle cx="20" cy="20" r="11" fill="${o.c[0]}" ${K2}/>${o.d.face ? `<circle cx="16.2" cy="18.5" r="1.6" fill="${OL}"/><circle cx="23.8" cy="18.5" r="1.6" fill="${OL}"/><path d="M15.5 22.5q4.5 4 9 0" fill="none" ${K15}/>` : HL(16, 15, 2.6, 4, 30)}` },
    bird:{ w:30, h:22, flip:true, pal:[['#4B8BFF', '#FF5A5F', '#FFC93C', '#B266FF']],
      draw:o => `<path d="M3 13c0-5 5-8 11-7 3-4 9-4 11 1l4 1.5-4 1.8c0 6-6 10.7-13 10.7-6 0-9-3-9-8z" fill="${o.c[0]}" ${K2}/><path d="M7 12c4-1 8 1 9 5-5 1-8-1-9-5z" fill="#fff" opacity=".7" ${K(1.2)}/><circle cx="21" cy="8" r="1.5" fill="${OL}"/><path d="M25.5 7.4l4 1.6-4 1.6z" fill="#FFB020" ${K(1.2)}/>` },
    balloon:{ w:24, h:46, pal:[BR], det:['stripe'],
      draw:o => `<path d="M12 28c-2 6 3 10-1 18" fill="none" stroke="${OL}" stroke-width="1.4"/><ellipse cx="12" cy="14.5" rx="10.5" ry="13" fill="${o.c[0]}" ${K2}/>${o.d.stripe ? `<path d="M2.4 17c6 3.4 13 3.4 19.2 0" fill="none" stroke="#fff" stroke-width="3.4"/>` : ''}<path d="M9.5 29.5h5l-2.5-2.5z" fill="${o.c[0]}" ${K(1.3)}/>${HL(8, 9, 2.4, 4, 25)}` },
    kite:{ w:34, h:48, pal:[BR], det:['bow'],
      draw:o => `<path d="M17 33c-5 4 5 7 0 14" fill="none" stroke="${OL}" stroke-width="1.5"/><path d="M17 1L32 16 17 33 2 16z" fill="${o.c[0]}" ${K2}/><path d="M17 1V33M2 16h30" stroke="${OL}" stroke-width="1.3"/><path d="M17 1L2 16h15z" fill="#fff" opacity=".45"/>${o.d.bow ? [[14, 38], [20, 44]].map(([x, y]) => `<path d="M${x - 5} ${y - 3}l10 6v-6l-10 6z" fill="#FFC93C" ${K(1.3)}/>`).join('') : ''}` },
    fence:{ w:56, h:28, pal:[['#FFFFFF', '#FFC93C', '#C9824A', '#B266FF']], det:['gap'],
      draw:o => `<rect x="1" y="10" width="54" height="5" rx="1.5" fill="${o.c[0]}" ${K15}/><rect x="1" y="19" width="54" height="5" rx="1.5" fill="${o.c[0]}" ${K15}/>${[3, 17, 31, 45].filter((x, i) => !(o.d.gap && i === 2)).map(x => `<path d="M${x} 27V8l4-5 4 5v19z" fill="${o.c[0]}" ${K2}/>`).join('')}` },
    flower:{ w:24, h:38, pal:[['#FF5A5F', '#FF8A3D', '#B266FF', '#4B8BFF', '#FF6FB5']], det:['leaf'],
      draw:o => `<path d="M12 18V38" stroke="#2EAA4A" stroke-width="3" stroke-linecap="round"/><path d="M12 31c-6 0-9-4-9-7 5 0 9 3 9 7z" fill="#3DBE5A" ${K(1.3)}/>${o.d.leaf ? `<path d="M12 27c6 0 9-4 9-7-5 0-9 3-9 7z" fill="#3DBE5A" ${K(1.3)}/>` : ''}${[0, 72, 144, 216, 288].map(a => `<ellipse cx="12" cy="6.2" rx="4.6" ry="6" transform="rotate(${a} 12 12)" fill="${o.c[0]}" ${K(1.4)}/>`).join('')}<circle cx="12" cy="12" r="3.6" fill="#FFE27A" ${K(1.3)}/>` },
    mushroom:{ w:34, h:34, pal:[['#FF4D3D', '#B266FF', '#FFB020', '#4B8BFF']], det:['dots'],
      draw:o => `<path d="M12 19h10c1 6 1 10-1 14h-8c-2-4-2-8-1-14z" fill="#FFF1D6" ${K2}/><path d="M2 20C2 10 9 3 17 3s15 7 15 17c0 2-2 3-4 3H6c-2 0-4-1-4-3z" fill="${o.c[0]}" ${K2}/>${o.d.dots ? `<circle cx="10.5" cy="13" r="3.2" fill="#fff"/><circle cx="22" cy="10" r="3.6" fill="#fff"/><circle cx="18" cy="18.5" r="2.4" fill="#fff"/>` : HL(10, 10, 2.6, 4, 40)}` },
    cat:{ w:44, h:36, flip:true, pal:[['#FFB45C', '#B7B2C8', '#FFFFFF', '#7E7896']], det:['stripe', 'bow'],
      draw:o => `<path d="M9 30c-7-2-8-12-2-15" fill="none" stroke="${OL}" stroke-width="6.4" stroke-linecap="round"/><path d="M9 30c-7-2-8-12-2-15" fill="none" stroke="${o.c[0]}" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="18" cy="26" rx="13" ry="8.6" fill="${o.c[0]}" ${K2}/>${o.d.stripe ? `<path d="M13 19l2 5.4M18 18l.8 5.6M23 18.4l-.4 5.4" stroke="${OL}" stroke-width="2" stroke-linecap="round" opacity=".7"/>` : ''}<ellipse cx="12" cy="34" rx="3.6" ry="2" fill="${o.c[0]}" ${K(1.4)}/><ellipse cx="23" cy="34" rx="3.6" ry="2" fill="${o.c[0]}" ${K(1.4)}/><path d="M24 9l1-8 7 5zM34 6l6-5 1 9z" fill="${o.c[0]}" ${K2}/><circle cx="32" cy="15" r="10" fill="${o.c[0]}" ${K2}/><circle cx="28.6" cy="14" r="1.5" fill="${OL}"/><circle cx="36" cy="14" r="1.5" fill="${OL}"/><path d="M31.4 18l1 1 1-1" fill="none" ${K(1.2)}/><circle cx="27" cy="18" r="1.8" fill="#FF8FB0" opacity=".7"/>${o.d.bow ? `<path d="M26.5 24.5l-5-3.2v6.4zM26.5 24.5l5-3.2v6.4z" fill="#FF3D7F" ${K(1.3)}/>` : ''}` },
    dog:{ w:46, h:36, flip:true, pal:[['#F2C48A', '#FFFFFF', '#C9824A']], det:['spot', 'collar'],
      draw:o => `<path d="M8 17c-4-4-4-9 0-11" fill="none" stroke="${OL}" stroke-width="5.6" stroke-linecap="round"/><path d="M8 17c-4-4-4-9 0-11" fill="none" stroke="${o.c[0]}" stroke-width="2.6" stroke-linecap="round"/><rect x="9" y="23" width="5.4" height="12" rx="2" fill="${o.c[0]}" ${K15}/><rect x="25" y="23" width="5.4" height="12" rx="2" fill="${o.c[0]}" ${K15}/><rect x="6" y="13" width="28" height="15" rx="7.5" fill="${o.c[0]}" ${K2}/>${o.d.spot ? `<ellipse cx="16" cy="19" rx="5.6" ry="4" fill="#4A2F1A"/>` : ''}${o.d.collar ? `<path d="M29 15.5l5 6" stroke="#FF3D7F" stroke-width="3.6" stroke-linecap="round"/>` : ''}<circle cx="35" cy="12.5" r="8.6" fill="${o.c[0]}" ${K2}/><ellipse cx="41" cy="15" rx="4.6" ry="3.6" fill="${o.c[0]}" ${K2}/><circle cx="44.2" cy="13.8" r="1.8" fill="${OL}"/><path d="M30 6c-4 1-5 8-2 11 3-2 4-8 2-11z" fill="#6B4423" ${K15}/><circle cx="36.4" cy="10.5" r="1.5" fill="${OL}"/>` },
    duck:{ w:36, h:32, flip:true, pal:[['#FFD93D', '#FFFFFF', '#9EE06A']], det:['bow'],
      draw:o => `<ellipse cx="15" cy="22" rx="13" ry="8.6" fill="${o.c[0]}" ${K2}/><path d="M7 20c4-3 10-2 12 3-5 2-9 1-12-3z" fill="#fff" opacity=".6" ${K(1.3)}/><circle cx="25" cy="11.5" r="7.4" fill="${o.c[0]}" ${K2}/><path d="M31 10l5 2.4-5 2.4z" fill="#FF9A1F" ${K(1.3)}/><circle cx="26.4" cy="9.6" r="1.4" fill="${OL}"/>${o.d.bow ? `<path d="M25 4l-4.4-3v6zM25 4l4.4-3v6z" fill="#4B8BFF" ${K(1.3)}/>` : ''}` },
    bench:{ w:60, h:30, pal:[['#C9824A', '#4B8BFF', '#FF5A5F', '#3DBE5A']],
      draw:o => `<rect x="8" y="21" width="4.4" height="9" fill="#5A5470" ${K(1.3)}/><rect x="47.6" y="21" width="4.4" height="9" fill="#5A5470" ${K(1.3)}/><rect x="4" y="2" width="52" height="6" rx="2" fill="${o.c[0]}" ${K2}/><rect x="4" y="10" width="52" height="6" rx="2" fill="${o.c[0]}" ${K2}/><rect x="2" y="18" width="56" height="6" rx="2" fill="${o.c[0]}" ${K2}/>` },
    mailbox:{ w:30, h:44, flip:true, pal:[['#FF5A5F', '#4B8BFF', '#3DBE5A']], det:['flag'],
      draw:o => `<rect x="12.5" y="22" width="5" height="22" fill="#9A5B2E" ${K15}/>${o.d.flag ? `<path d="M25 18V2" stroke="${OL}" stroke-width="2"/><path d="M25 2h-8v6.4h8z" fill="#FFC93C" ${K15}/>` : ''}<path d="M3 26V13a9 9 0 0 1 9-9h6a9 9 0 0 1 9 9v13z" fill="${o.c[0]}" ${K2}/><path d="M8 13h14" stroke="${OL}" stroke-width="2" stroke-linecap="round"/>` },
    car:{ w:62, h:34, flip:true, pal:[BR], det:['rack'],
      draw:o => `${o.d.rack ? `<rect x="22" y="1" width="20" height="5" rx="1.5" fill="#FFC93C" ${K15}/>` : ''}<path d="M3 26v-8c0-3 2-5 5-5h8l7-8h18l9 8h6c3 0 4 2 4 5v8z" fill="${o.c[0]}" ${K2}/><path d="M19 13l5.4-5.6H31V13zM34 13V7.4h6l6 5.6z" fill="#BDEBFF" ${K15}/><circle cx="15" cy="27" r="5.6" fill="${OL}"/><circle cx="15" cy="27" r="2.4" fill="#C9C4DA"/><circle cx="47" cy="27" r="5.6" fill="${OL}"/><circle cx="47" cy="27" r="2.4" fill="#C9C4DA"/><circle cx="57" cy="18" r="2" fill="#FFE27A" ${K(1.2)}/>` },
    /* ----- 부엌 ----- */
    pot:{ w:54, h:40, pal:[['#FF5A5F', '#4B8BFF', '#3DBE5A', '#FFC93C']], det:['lid'],
      draw:o => `<rect x="1" y="16" width="9" height="5" rx="2.5" fill="#5A5470" ${K15}/><rect x="44" y="16" width="9" height="5" rx="2.5" fill="#5A5470" ${K15}/><rect x="7" y="12" width="40" height="27" rx="6" fill="${o.c[0]}" ${K2}/><path d="M11 18v14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>${o.d.lid ? `<path d="M5 13.5c2-8 42-8 44 0z" fill="${o.c[0]}" ${K2}/><rect x="23" y="1.5" width="8" height="5" rx="2" fill="${OL}"/>` : `<ellipse cx="27" cy="12" rx="20" ry="3.6" fill="#7A4A32" ${K2}/>`}` },
    cup:{ w:36, h:34, flip:true, pal:[['#FF6FB5', '#4B8BFF', '#FFC93C', '#3DBE5A']], det:['steam', 'heart'],
      draw:o => `${o.d.steam ? `<path d="M12 9c-3-3 3-5 0-8M19 9c-3-3 3-5 0-8" fill="none" stroke="#9C88C9" stroke-width="2.2" stroke-linecap="round"/>` : ''}<ellipse cx="16" cy="31.5" rx="14" ry="2.5" fill="#fff" ${K15}/><path d="M25 15h3a5.4 5.4 0 0 1 0 10.8h-3" fill="none" stroke="${OL}" stroke-width="5.6"/><path d="M25 15h3a5.4 5.4 0 0 1 0 10.8h-3" fill="none" stroke="${o.c[0]}" stroke-width="2.4"/><path d="M5 12h22l-2 16c-.4 2.6-2.6 4.4-5.4 4.4h-7.2C9.6 32.4 7.4 30.6 7 28z" fill="${o.c[0]}" ${K2}/>${o.d.heart ? heart(16, 19.5, 1, '#fff') : ''}` },
    teapot:{ w:54, h:42, flip:true, pal:[['#4B8BFF', '#FF5A5F', '#B266FF', '#3DBE5A']], det:['dots'],
      draw:o => `<path d="M14 26L2 14l3.4-2.6L17 20z" fill="${o.c[0]}" ${K2}/><path d="M41 17c10 0 11 15 0 15" fill="none" stroke="${OL}" stroke-width="6"/><path d="M41 17c10 0 11 15 0 15" fill="none" stroke="${o.c[0]}" stroke-width="2.6"/><ellipse cx="26" cy="27" rx="17" ry="14" fill="${o.c[0]}" ${K2}/><path d="M14.5 15c3-6.4 20-6.4 23 0z" fill="${o.c[0]}" ${K2}/><circle cx="26" cy="6.4" r="3" fill="${o.c[0]}" ${K2}/>${o.d.dots ? `<circle cx="19" cy="26" r="2.8" fill="#fff"/><circle cx="30" cy="22.5" r="2.8" fill="#fff"/><circle cx="29" cy="33" r="2.8" fill="#fff"/>` : HL(18, 23, 2.6, 5, 25)}` },
    fruit:{ w:26, h:28, pal:[['#E8203F', '#7BC74D', '#FFC93C', '#FF8A3D']], det:['leaf'],
      draw:o => `<path d="M13 9c0-3 1-5 2.4-7" fill="none" ${K2}/>${o.d.leaf ? `<path d="M15 5.4c3-4 8-4 10-2-2 3-7 4-10 2z" fill="#3DBE5A" ${K(1.3)}/>` : ''}<path d="M13 9.4c-3-2-8-3-11 1-4 4-2 12 1 15 3 3.6 6 3.6 8 2.6 1-.5 3-.5 4 0 2 1 5 1 8-2.6 3-3 5-11 1-15-3-4-8-3-11-1z" fill="${o.c[0]}" ${K2}/>${HL(7, 15, 2, 4, 20)}` },
    bowl:{ w:50, h:26, pal:[['#4B8BFF', '#FF6FB5', '#3DBE5A', '#FFC93C']], det:['food', 'stripe'],
      draw:o => `${o.d.food ? `<circle cx="16" cy="10" r="6" fill="#FF9A3D" ${K15}/><circle cx="34" cy="10.4" r="5.6" fill="#E8203F" ${K15}/><circle cx="25" cy="7.4" r="6.4" fill="#FFC93C" ${K15}/>` : ''}<path d="M2 12h46c0 8.4-9 13-23 13S2 20.4 2 12z" fill="${o.c[0]}" ${K2}/>${o.d.stripe ? `<path d="M7.4 17.4h35.2" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>` : ''}` },
    jar:{ w:32, h:42, pal:[['#FF6FB5', '#FFB020', '#B266FF', '#3DBE5A']], det:['label'],
      draw:o => `<rect x="3" y="7" width="26" height="33.5" rx="7" fill="#E6F6FF" ${K2}/><path d="M4.4 19h23.2v14.4c0 3-2.4 5.6-5.6 5.6H10c-3.2 0-5.6-2.6-5.6-5.6z" fill="${o.c[0]}"/><rect x="3" y="7" width="26" height="33.5" rx="7" fill="none" ${K2}/><rect x="6" y="1" width="20" height="7" rx="2" fill="#E8503A" ${K2}/><path d="M7 12v8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>${o.d.label ? `<rect x="8" y="21" width="16" height="11" rx="2" fill="#fff" ${K(1.3)}/>${heart(16, 25, .62, '#FF3D7F')}` : ''}` },
    clock:{ w:40, h:40, pal:[['#FF5A5F', '#4B8BFF', '#3DBE5A', '#B266FF']], det:['bell', 'hands'],
      draw:o => `${o.d.bell ? `<circle cx="7.4" cy="8" r="5.6" fill="#FFC93C" ${K2}/><circle cx="32.6" cy="8" r="5.6" fill="#FFC93C" ${K2}/>` : ''}<circle cx="20" cy="22" r="17" fill="${o.c[0]}" ${K2}/><circle cx="20" cy="22" r="12.4" fill="#fff" ${K15}/><path d="${o.d.hands ? 'M20 22h7.4M20 22V12' : 'M20 22l-5.6 5.6M20 22h10'}" stroke="${OL}" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="22" r="1.8" fill="${OL}"/>` },
    plant:{ w:36, h:48, pal:[['#E07A4A', '#4B8BFF', '#FFC93C', '#B266FF']], det:['bloom'],
      draw:o => `<path d="M18 30C10 26 5 18 7 10c7 3 11 10 11 20z" fill="#3DBE5A" ${K15}/><path d="M18 30c8-4 13-12 11-20-7 3-11 10-11 20z" fill="#2EAA4A" ${K15}/><path d="M18 30c-3-7-2-14 0-20 2 6 3 13 0 20z" fill="#5BD06A" ${K15}/>${o.d.bloom ? `${[0, 72, 144, 216, 288].map(a => `<circle cx="18" cy="4.4" r="3.4" transform="rotate(${a} 18 8)" fill="#FF6FB5" ${K(1.2)}/>`).join('')}<circle cx="18" cy="8" r="2.6" fill="#FFE27A" ${K(1.2)}/>` : ''}<path d="M7 31h22l-3 16H10z" fill="${o.c[0]}" ${K2}/><rect x="5" y="28" width="26" height="5.4" rx="2" fill="${o.c[0]}" ${K2}/>` },
    pan:{ w:66, h:24, flip:true, pal:[['#5A5470', '#FF5A5F', '#4B8BFF']], det:['egg'],
      draw:o => `<path d="M37 12h27" stroke="${OL}" stroke-width="7.4" stroke-linecap="round"/><path d="M37 12h27" stroke="#8A5A2B" stroke-width="4" stroke-linecap="round"/><ellipse cx="20" cy="12" rx="18.6" ry="10.6" fill="${o.c[0]}" ${K2}/><ellipse cx="20" cy="11.4" rx="13.6" ry="7" fill="#2A2440" opacity=".35"/>${o.d.egg ? `<path d="M11 11c0-5 6-6 9-4 3-2 9-1 9 3s-4 6-9 5c-5 1-9-1-9-4z" fill="#fff" ${K(1.3)}/><circle cx="20" cy="10.6" r="3.4" fill="#FFB020" ${K(1.2)}/>` : ''}` },
    frame:{ w:50, h:40, pal:[['#C9824A', '#FFC93C', '#FF6FB5', '#4B8BFF']], det:['heart'],
      draw:o => `<rect x="2" y="2" width="46" height="36" rx="3" fill="${o.c[0]}" ${K2}/><rect x="8" y="8" width="34" height="24" fill="#BDEBFF" ${K15}/>${o.d.heart ? heart(25, 18, 1.35, '#FF3D7F') : `<path d="M8.8 31.2l9.6-13.6 7 8 5-5 11 10.6z" fill="#3DBE5A" ${K(1.3)}/><circle cx="35" cy="14" r="3.4" fill="#FFC93C" ${K(1.2)}/>`}` },
    /* ----- 바닷가 ----- */
    umbrella:{ w:56, h:56, flip:true, pal:[BR], det:['frill'],
      draw:o => `<path d="M28 22L35 55" stroke="${OL}" stroke-width="4.4" stroke-linecap="round"/><path d="M28 22L35 55" stroke="#F4F0FF" stroke-width="2" stroke-linecap="round"/><path d="M2 24C4 10 15 2 28 2s24 8 26 22z" fill="${o.c[0]}" ${K2}/><path d="M28 2c-4 6-6.4 14-7 22h14c-.6-8-3-16-7-22z" fill="#fff" ${K15}/>${o.d.frill ? `<path d="M2 24q4.4 5 8.6 0 4.4 5 8.6 0 4.4 5 8.8 0 4.4 5 8.6 0 4.4 5 8.6 0 4.4 5 8.8 0" fill="#FFE27A" ${K(1.3)}/>` : ''}<circle cx="28" cy="2.4" r="2" fill="${OL}"/>` },
    crab:{ w:40, h:28, pal:[['#FF5A5F', '#FF8A3D', '#B266FF']], det:['claw'],
      draw:o => `<path d="M9 20l-6 5M10 23l-5 5M31 20l6 5M30 23l5 5" stroke="${OL}" stroke-width="2" stroke-linecap="round"/><path d="M12 13L7 8M28 13l5-5" stroke="${OL}" stroke-width="2.4"/><path d="M2 7a5 5 0 1 1 9 2l-4-1z" fill="${o.c[0]}" ${K15}/>${o.d.claw ? `<path d="M27 9a7 7 0 1 1 12 3.6l-6-2z" fill="${o.c[0]}" ${K15}/>` : `<path d="M29 9a5 5 0 1 1 9-2l-5 1z" fill="${o.c[0]}" ${K15}/>`}<ellipse cx="20" cy="18.6" rx="13" ry="8.4" fill="${o.c[0]}" ${K2}/><path d="M16 11V7M24 11V7" stroke="${OL}" stroke-width="1.6"/><circle cx="16" cy="6.4" r="2.4" fill="#fff" ${K(1.2)}/><circle cx="24" cy="6.4" r="2.4" fill="#fff" ${K(1.2)}/><circle cx="16" cy="6.6" r="1" fill="${OL}"/><circle cx="24" cy="6.6" r="1" fill="${OL}"/><path d="M17 21q3 2 6 0" fill="none" ${K(1.3)}/>` },
    shell:{ w:30, h:26, pal:[['#FF8FB0', '#FFC93C', '#9B7BFF', '#7CCBFF']],
      draw:o => `<path d="M15 25L2 12C2 6 8 2 15 2s13 4 13 10z" fill="${o.c[0]}" ${K2}/><path d="M15 25L7 5M15 25V2M15 25l8-20M15 25L3 10M15 25l12-15" fill="none" stroke="${OL}" stroke-width="1.2" opacity=".6"/>` },
    starfish:{ w:32, h:32, pal:[['#FF8A3D', '#FF6FB5', '#B266FF']], det:['dots'],
      draw:o => `<path d="${starPath(16, 17.4, 15.4, 6.6)}" fill="${o.c[0]}" ${K2}/>${o.d.dots ? [[16, 8], [8, 15], [24, 15], [11, 25], [21, 25], [16, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff"/>`).join('') : ''}` },
    boat:{ w:56, h:46, flip:true, pal:[['#FF5A5F', '#FFC93C', '#4B8BFF', '#B266FF'], ['#C9824A', '#4B6CD9', '#E8503A']], det:['flag'],
      draw:o => `<path d="M26 4V35" stroke="${OL}" stroke-width="2.4"/>${o.d.flag ? `<path d="M26 4l-9 3.4 9 3.4z" fill="#FF3D7F" ${K(1.3)}/>` : ''}<path d="M28 6L50 33H28z" fill="${o.c[0]}" ${K2}/><path d="M24 13L9 33h15z" fill="#fff" ${K2}/><path d="M3 34h50l-7 10.6H10z" fill="${o.c[1]}" ${K2}/>` },
    bucket:{ w:30, h:32, pal:[BR], det:['shovel'],
      draw:o => `${o.d.shovel ? `<path d="M24 1l-3.6 14" stroke="${OL}" stroke-width="4.6" stroke-linecap="round"/><path d="M24 1l-3.6 14" stroke="#FFC93C" stroke-width="2" stroke-linecap="round"/>` : ''}<path d="M5 13C5 3 25 3 25 13" fill="none" stroke="${OL}" stroke-width="2"/><path d="M3 12h24l-3 19H6z" fill="${o.c[0]}" ${K2}/><rect x="2" y="10" width="26" height="4.6" rx="2" fill="${o.c[0]}" ${K2}/>` },
    ball:{ w:30, h:30, pal:[['#FF5A5F', '#3DBE5A', '#B266FF'], ['#4B8BFF', '#FF8A3D', '#FF6FB5']],
      draw:o => `<circle cx="15" cy="15" r="13.4" fill="#fff" ${K2}/>${[[o.c[0], 0], [o.c[1], 120], ['#FFC93C', 240]].map(([c, a]) => `<path d="M15 15V1.6A13.4 13.4 0 0 1 26.6 8.3z" transform="rotate(${a} 15 15)" fill="${c}"/>`).join('')}<circle cx="15" cy="15" r="13.4" fill="none" ${K2}/><circle cx="15" cy="15" r="3" fill="#fff" ${K(1.3)}/>` },
    palm:{ w:56, h:80, flip:true, pal:[['#3DBE5A', '#2B9348', '#9EE06A']], det:['nut'],
      draw:o => `<path d="M26 80c-2-20 0-40 6-56" fill="none" stroke="${OL}" stroke-width="9" stroke-linecap="round"/><path d="M26 80c-2-20 0-40 6-56" fill="none" stroke="#C9824A" stroke-width="5.4" stroke-linecap="round"/>${['M32 24C24 12 12 12 3 18c10-1 19 0 29 6z', 'M32 24C30 12 22 4 12 3c8 5 14 11 20 21z', 'M32 24c4-11 12-18 22-17-8 4-14 9-22 17z', 'M32 24c10-5 20-3 23 6-9-4-15-5-23-6z', 'M32 24c-9-2-17 2-21 10 7-5 13-8 21-10z'].map(d => `<path d="${d}" fill="${o.c[0]}" ${K2}/>`).join('')}${o.d.nut ? `<circle cx="29" cy="28" r="3.8" fill="#8A5A2B" ${K(1.3)}/><circle cx="35.6" cy="28.6" r="3.8" fill="#8A5A2B" ${K(1.3)}/>` : ''}` },
    castle:{ w:50, h:50, pal:[['#F2C46B', '#FFA8C5', '#BFE3FF']], det:['flag', 'win'],
      draw:o => `${o.d.flag ? `<path d="M25 12V1" stroke="${OL}" stroke-width="1.8"/><path d="M25 1l9 3.4-9 3.4z" fill="#FF3D7F" ${K(1.3)}/>` : ''}<rect x="4" y="28" width="42" height="21" fill="${o.c[0]}" ${K2}/><path d="M2 30V16h3v3h3v-3h3v3h3v-3h0V30z" fill="${o.c[0]}" ${K2}/><path d="M36 30V16h3v3h3v-3h3v3h3v-3V30z" fill="${o.c[0]}" ${K2}/><path d="M17 30V12h3v3h3v-3h4v3h3v-3h3V30z" fill="${o.c[0]}" ${K2}/><path d="M20 49v-8a5 5 0 0 1 10 0v8z" fill="#B07A3A" ${K15}/>${o.d.win ? `<rect x="6.4" y="21" width="4" height="5" rx="1" fill="${OL}"/><rect x="40.4" y="21" width="4" height="5" rx="1" fill="${OL}"/><rect x="23" y="18" width="4" height="5" rx="1" fill="${OL}"/>` : ''}` },
    fish:{ w:36, h:24, flip:true, pal:[BR], det:['stripe'],
      draw:o => `<path d="M26 12l9-8v16z" fill="${o.c[0]}" ${K2}/><ellipse cx="15" cy="12" rx="13" ry="9" fill="${o.c[0]}" ${K2}/>${o.d.stripe ? `<path d="M16 3.6c-2 5-2 11.8 0 16.8M21.4 5c-1.4 4.6-1.4 9.4 0 14" fill="none" stroke="#fff" stroke-width="2.8"/>` : ''}<circle cx="8" cy="10" r="1.9" fill="${OL}"/>` },
    /* ----- 우주 ----- */
    planet:{ w:50, h:50, pal:[['#FF8A3D', '#4B8BFF', '#FF6FB5', '#3DBE5A', '#FFC93C']], det:['ring'],
      draw:o => `${o.d.ring ? `<ellipse cx="25" cy="25" rx="24" ry="6.4" transform="rotate(-16 25 25)" fill="none" stroke="${OL}" stroke-width="5.6"/><ellipse cx="25" cy="25" rx="24" ry="6.4" transform="rotate(-16 25 25)" fill="none" stroke="#FFE27A" stroke-width="2.6"/>` : ''}<circle cx="25" cy="25" r="15" fill="${o.c[0]}" ${K2}/><path d="M12 21c8 3 18 3 26-1" fill="none" stroke="#fff" stroke-width="2.6" opacity=".55"/>${HL(19, 17, 3, 4.6, 35)}${o.d.ring ? `<path d="M48.1 18.4A24 6.4 -16 0 1 1.9 31.6" fill="none" stroke="${OL}" stroke-width="5.6"/><path d="M48.1 18.4A24 6.4 -16 0 1 1.9 31.6" fill="none" stroke="#FFE27A" stroke-width="2.6"/>` : ''}` },
    rocket:{ w:30, h:58, pal:[['#FF5A5F', '#4B8BFF', '#3DBE5A', '#B266FF']], det:['fire', 'win2'],
      draw:o => `${o.d.fire ? `<path d="M9.6 45c0 6 3 10.6 5.4 12.4 2.4-1.8 5.4-6.4 5.4-12.4z" fill="#FFB020" ${K15}/><path d="M12.4 46c0 4 1.4 6.6 2.6 7.6 1.2-1 2.6-3.6 2.6-7.6z" fill="#FFF3B0"/>` : ''}<path d="M7.4 30L1 42v5l8.4-4zM22.6 30L29 42v5l-8.4-4z" fill="${o.c[0]}" ${K2}/><path d="M15 2c8 6 10 18 9 34l-1 9.4H7l-1-9.4C5 20 7 8 15 2z" fill="#F4F4F8" ${K2}/><path d="M15 2c4 3 6.4 7 7.6 11H7.4C8.6 9 11 5 15 2z" fill="${o.c[0]}" ${K15}/><circle cx="15" cy="21" r="4.6" fill="#5BC0EB" ${K15}/>${o.d.win2 ? `<circle cx="15" cy="33" r="3.4" fill="#5BC0EB" ${K15}/>` : ''}` },
    star:{ w:28, h:28, pal:[['#FFE27A', '#FF8FC8', '#7CCBFF', '#9EF0B8']],
      draw:o => `<path d="${starPath(14, 15, 13.2, 5.8)}" fill="${o.c[0]}" ${K2}/><path d="${starPath(14, 15, 6, 2.6)}" fill="#fff" opacity=".6"/>` },
    moon:{ w:40, h:40, flip:true, pal:[['#FFE27A', '#FFB3D9', '#9BE2FF']], det:['crater'],
      draw:o => `<path d="M26 3A18 18 0 1 0 37.6 31 14 14 0 1 1 26 3z" fill="${o.c[0]}" ${K2}/>${o.d.crater ? `<circle cx="10.6" cy="18" r="3.2" fill="#1A0F45" opacity=".2"/><circle cx="15" cy="29" r="2.6" fill="#1A0F45" opacity=".2"/><circle cx="20" cy="9.6" r="2" fill="#1A0F45" opacity=".2"/>` : ''}` },
    ufo:{ w:56, h:32, pal:[['#B266FF', '#3DBE5A', '#FF5A5F', '#FFC93C']], det:['lights'],
      draw:o => `<path d="M16 15a12 11 0 0 1 24 0z" fill="#BDEBFF" ${K2}/>${HL(23, 9, 2.4, 3.6, 30)}<ellipse cx="28" cy="18" rx="26" ry="7.6" fill="${o.c[0]}" ${K2}/>${o.d.lights ? [12, 22, 34, 44].map((x, i) => `<circle cx="${x}" cy="${i === 0 || i === 3 ? 19 : 21}" r="2.6" fill="#FFE27A" ${K(1.2)}/>`).join('') : `<path d="M10 20c10 4 26 4 36 0" fill="none" stroke="${OL}" stroke-width="1.3" opacity=".6"/>`}<path d="M22 25l-3 5M34 25l3 5" stroke="${OL}" stroke-width="2" stroke-linecap="round"/>` },
    comet:{ w:54, h:26, flip:true, pal:[['#FFE27A', '#7CCBFF', '#FF8FC8']],
      draw:o => `<path d="M13 5L53 1 36 13 53 25 13 21z" fill="${o.c[0]}" opacity=".55" ${K15}/><circle cx="13" cy="13" r="10" fill="${o.c[0]}" ${K2}/>${HL(9.6, 9.6, 2.6, 3.6, 40)}` },
    satellite:{ w:50, h:30, pal:[['#4B8BFF', '#FFC93C', '#FF6FB5']], det:['dish'],
      draw:o => `<path d="M14 15h22" stroke="${OL}" stroke-width="2.4"/>${[1, 35].map(x => `<rect x="${x}" y="8" width="14" height="15" fill="${o.c[0]}" ${K2}/><path d="M${x + 7} 8v15M${x} 15.5h14" stroke="${OL}" stroke-width="1.2"/>`).join('')}${o.d.dish ? `<path d="M25 7V2" stroke="${OL}" stroke-width="1.8"/><path d="M18 4a7 3.6 0 0 0 14 0z" fill="#fff" ${K15}/>` : ''}<rect x="17.6" y="6.4" width="14.8" height="18" rx="3" fill="#E6E3F0" ${K2}/><circle cx="25" cy="15.4" r="3" fill="#5BC0EB" ${K(1.3)}/>` },
    asteroid:{ w:34, h:28, pal:[['#A7A2B8', '#C9824A', '#7BC74D']], det:['crater'],
      draw:o => `<path d="M5 14C3 7 10 2 17 3c7-2 14 2 14 9 2 7-4 13-12 13C10 26 4 21 5 14z" fill="${o.c[0]}" ${K2}/>${o.d.crater ? `<circle cx="13" cy="12" r="3.6" fill="#1A0F45" opacity=".22"/><circle cx="22.6" cy="17" r="2.8" fill="#1A0F45" opacity=".22"/><circle cx="21" cy="8" r="2" fill="#1A0F45" opacity=".22"/>` : HL(11, 9, 2, 3, 30)}` }
  };

  /* ===== 장면 테마: 배경(rng로 조금씩 다르게) + 놓을 조각 [종류, 구역, 최대 수] =====
     구역: box = 조각 전체가 [y0, y1] 안 / foot = 조각 바닥이 [y0, y1] 안 */
  const W = 320, H = 240;
  const r1 = (rng, a, b) => a + rng() * (b - a);
  const TH = {
    town:{ name:'알록달록 마을',
      zones:{ sky:['box', 6, 100], ground:['foot', 124, 236] },
      items:[['house', 'ground', 3], ['tree', 'ground', 2], ['pine', 'ground', 2], ['fence', 'ground', 2], ['flower', 'ground', 4], ['cat', 'ground', 1], ['dog', 'ground', 1], ['mailbox', 'ground', 1], ['car', 'ground', 1], ['cloud', 'sky', 3], ['sun', 'sky', 1], ['bird', 'sky', 2], ['balloon', 'sky', 1]],
      bg(rng){
        const hills = Array.from({ length:3 }, () => `<ellipse cx="${r1(rng, 20, 300).toFixed(0)}" cy="114" rx="${r1(rng, 60, 100).toFixed(0)}" ry="${r1(rng, 18, 30).toFixed(0)}" fill="#B9E8A0"/>`).join('');
        const ry = r1(rng, 186, 206).toFixed(0);
        return { svg:`<rect width="${W}" height="${H}" fill="#BFE8FF"/><rect y="70" width="${W}" height="50" fill="#D6F1FF"/>${hills}<rect y="112" width="${W}" height="128" fill="#94DB72"/><path d="M0 ${ry}c60-14 120 14 180 0s100-12 140 2v18c-40-12-80-10-140 0S60 ${+ry + 4} 0 ${+ry + 16}z" fill="#F3E3B5" opacity=".9"/><path d="M0 112h${W}" stroke="#7CC35E" stroke-width="2"/>`, block:[] };
      } },
    park:{ name:'소풍 공원',
      zones:{ sky:['box', 6, 92], ground:['foot', 116, 236] },
      items:[['tree', 'ground', 3], ['pine', 'ground', 1], ['bench', 'ground', 2], ['flower', 'ground', 5], ['mushroom', 'ground', 2], ['duck', 'ground', 2], ['dog', 'ground', 1], ['cat', 'ground', 1], ['fence', 'ground', 1], ['kite', 'sky', 1], ['balloon', 'sky', 2], ['cloud', 'sky', 3], ['sun', 'sky', 1], ['bird', 'sky', 2]],
      bg(rng){
        const bumps = Array.from({ length:7 }, (_, i) => `<circle cx="${(i * 52 + r1(rng, -10, 10)).toFixed(0)}" cy="${r1(rng, 98, 104).toFixed(0)}" r="${r1(rng, 18, 28).toFixed(0)}" fill="#A8DD8E"/>`).join('');
        const px = r1(rng, 60, 260).toFixed(0);
        return { svg:`<rect width="${W}" height="${H}" fill="#CDEBFF"/>${bumps}<rect y="104" width="${W}" height="136" fill="#A2E07E"/><path d="M${+px - 30} 240C${+px - 10} 190 ${+px + 40} 150 ${+px + 10} 104h14C${+px + 60} 150 ${+px + 30} 190 ${+px + 40} 240z" fill="#F5E6C0" opacity=".85"/><path d="M0 104h${W}" stroke="#86C96A" stroke-width="2"/>`, block:[] };
      } },
    kitchen:{ name:'달콤한 부엌',
      zones:{ wall:['box', 8, 110], table:['foot', 140, 236] },
      items:[['clock', 'wall', 1], ['frame', 'wall', 2], ['pot', 'table', 1], ['cup', 'table', 2], ['teapot', 'table', 1], ['fruit', 'table', 4], ['bowl', 'table', 2], ['jar', 'table', 2], ['plant', 'table', 1], ['pan', 'table', 1], ['cat', 'table', 1]],
      bg(rng){
        const wx = Math.round(r1(rng, 16, 230)), tiles = [];
        for(let x = 20; x < W; x += 40) tiles.push(`M${x} 0V116`);
        for(let y = 20; y < 116; y += 40) tiles.push(`M0 ${y}H${W}`);
        const checks = []; for(let y = 0; y < 6; y++) for(let x = 0; x < 16; x++) if((x + y) % 2) checks.push(`M${x * 20} ${118 + y * 20}h20v20h-20z`);
        return { svg:`<rect width="${W}" height="${H}" fill="#FFF1D6"/><path d="${tiles.join('')}" stroke="#F1D9AE" stroke-width="1.4"/><rect x="${wx}" y="14" width="72" height="58" rx="4" fill="#BDEBFF" stroke="#fff" stroke-width="5"/><rect x="${wx}" y="14" width="72" height="58" rx="4" fill="none" stroke="#1A0F45" stroke-width="1.6"/><path d="M${wx + 36} 14v58M${wx} 43h72" stroke="#fff" stroke-width="4"/><circle cx="${wx + 54}" cy="28" r="6" fill="#FFF3B0"/><rect y="116" width="${W}" height="124" fill="#FFE0E8"/><path d="${checks.join('')}" fill="#FFC7D6" opacity=".7"/><path d="M0 116h${W}" stroke="#1A0F45" stroke-width="2"/>`, block:[[wx - 4, 10, wx + 76, 76]] };
      } },
    beach:{ name:'반짝 바닷가',
      zones:{ sky:['box', 6, 88], sea:['box', 96, 140], boat:['foot', 112, 138], sand:['foot', 156, 236] },
      items:[['umbrella', 'sand', 2], ['palm', 'sand', 1], ['castle', 'sand', 1], ['crab', 'sand', 2], ['shell', 'sand', 3], ['starfish', 'sand', 2], ['bucket', 'sand', 1], ['ball', 'sand', 1], ['boat', 'boat', 2], ['fish', 'sea', 2], ['cloud', 'sky', 3], ['sun', 'sky', 1], ['bird', 'sky', 3]],
      bg(rng){
        const waves = Array.from({ length:5 }, (_, i) => { const x = r1(rng, 10, 280).toFixed(0), y = 100 + i * 8; return `<path d="M${x} ${y}q6-4 12 0 6-4 12 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`; }).join('');
        return { svg:`<rect width="${W}" height="${H}" fill="#BFE8FF"/><rect y="90" width="${W}" height="54" fill="#4FC3F7"/><rect y="90" width="${W}" height="8" fill="#2FA8E8"/>${waves}<path d="M0 146c40-6 80 4 120-2s80-8 120-2 60 4 80 0V240H0z" fill="#FFE3A3"/><path d="M0 146c40-6 80 4 120-2s80-8 120-2 60 4 80 0" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>`, block:[] };
      } },
    space:{ name:'별빛 우주',
      zones:{ all:['box', 6, 234] },
      items:[['planet', 'all', 3], ['rocket', 'all', 2], ['ufo', 'all', 2], ['moon', 'all', 1], ['satellite', 'all', 1], ['comet', 'all', 2], ['asteroid', 'all', 3], ['star', 'all', 6]],
      bg(rng){
        const neb = Array.from({ length:3 }, () => `<ellipse cx="${r1(rng, 20, 300).toFixed(0)}" cy="${r1(rng, 20, 220).toFixed(0)}" rx="${r1(rng, 50, 90).toFixed(0)}" ry="${r1(rng, 30, 50).toFixed(0)}" fill="#3B2C85" opacity=".55"/>`).join('');
        const dots = Array.from({ length:36 }, () => `<circle cx="${r1(rng, 2, 318).toFixed(1)}" cy="${r1(rng, 2, 238).toFixed(1)}" r="${r1(rng, .6, 1.3).toFixed(1)}" fill="#fff" opacity="${r1(rng, .4, .85).toFixed(2)}"/>`).join('');
        return { svg:`<rect width="${W}" height="${H}" fill="#211A52"/>${neb}${dots}`, block:[] };
      } }
  };
  return { P, TH, W, H, OL, starPath };
})();
