/* 쌍둥이 찾기 그림 */
/* ===== 쌍둥이 찾기(twin) 그림 · 디자인팀 =====
   카드에 들어가는 그림 39종 = 공용 캐릭터 12종(core TOY) + 이 게임용 사물 27종(직접 그린 오리지널).
   모두 공용 3D 비닐 장난감 질감: 외곽선 없음, 색 하나 + 큰 실루엣, TOY 조명 필터(pb·pm·ps)로 광택·그늘, 바닥 그림자.
   그림마다 색만 다른 짝(변형 1)이 있다 → 닮은꼴 규칙의 가짜 쌍둥이.
   순서(S의 번호)를 바꾸면 같은 씨앗의 카드가 달라진다. 새 그림은 끝에만 더한다. */
const TWIN_ART = (() => {
  const { DEFS, GL } = TOY;
  let NOSH = false;
  const SHD = (rx = 26, cy = 91) => NOSH ? '' : `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="5" fill="url(#gs)"/>`;
  const B = (body, f = 'pb') => `<g filter="url(#${f})">${body}</g>`;
  const star5 = (cx, cy, R, r) => [...Array(10)].map((_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r : R; return (cx + Math.cos(a) * q).toFixed(1) + ' ' + (cy + Math.sin(a) * q).toFixed(1); }).join(' ');

  /* 사물: [이름, [색 묶음(변형 0), 색 묶음(변형 1)], 그리기(c)] */
  const OBJ = [
    ['사과', [['#EE3B3B', '#58B83A'], ['#86CC2E', '#2E8F3A']], c => SHD(28) +
      B(`<path d="M50 32C40 21 15 24 15 52c0 23 16 38 28 36 3-.5 4.5-2 7-2s4 1.5 7 2c12 2 28-13 28-36 0-28-25-31-35-20z" fill="${c[0]}"/>`) + GL(32, 44, 8, 13, -15) +
      B(`<path d="M50 35c0-8 2-15 6-20" stroke="#7A4A2A" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M57 23c8-11 22-11 27-5-6 9-19 11-27 5z" fill="${c[1]}"/>`, 'pm')],
    ['별', [['#FFC21A'], ['#3D8BFF']], c => SHD(28) +
      B(`<polygon points="${star5(50, 53, 40, 18)}" fill="${c[0]}" stroke="${c[0]}" stroke-width="9" stroke-linejoin="round"/>`) + GL(40, 40, 8, 5, -30)],
    ['달', [['#FFD23F'], ['#FF7EB6']], c => SHD(24) +
      `<defs><mask id="tmm"><rect width="100" height="100" fill="#fff"/><circle cx="68" cy="36" r="29" fill="#000"/></mask></defs>` +
      B(`<circle cx="47" cy="52" r="37" fill="${c[0]}" mask="url(#tmm)"/>`) + GL(26, 50, 6, 13, 10)],
    ['우산', [['#FF5C9A', '#FFC0DA'], ['#16B3A4', '#A6EEE6']], c => SHD(30) +
      B(`<path d="M50 52v28a7.5 7.5 0 0 1-15 0" stroke="#6B4A8A" stroke-width="6" stroke-linecap="round" fill="none"/>`, 'pm') +
      B(`<path d="M11 52A39 39 0 0 1 89 52q-6.5-7-13 0q-6.5-7-13 0q-6.5-7-13 0q-6.5-7-13 0q-6.5-7-13 0q-6.5-7-13 0z" fill="${c[0]}"/>`) +
      `<path d="M50 14Q35 30 37 51M50 14Q65 30 63 51" stroke="${c[1]}" stroke-width="3.4" fill="none" opacity=".75"/>` +
      B(`<circle cx="50" cy="12" r="4" fill="#6B4A8A"/>`, 'ps') + GL(30, 34, 8, 5, -35)],
    ['열쇠', [['#F2B21B'], ['#5C7CFF']], c => SHD(30) +
      `<g transform="rotate(32 50 52)">` + B(`<path fill-rule="evenodd" d="M28 31a20 20 0 1 1 0 40a20 20 0 1 1 0-40zm0 11a9 9 0 1 0 0 18a9 9 0 1 0 0-18z" fill="${c[0]}"/><rect x="42" y="46" width="48" height="10" rx="5" fill="${c[0]}"/><rect x="70" y="52" width="9" height="17" rx="3.5" fill="${c[0]}"/><rect x="81" y="52" width="8" height="12" rx="3.5" fill="${c[0]}"/>`) + GL(20, 40, 6, 4, -40) + `</g>`],
    ['컵', [['#2F80ED'], ['#E9483B']], c => SHD(30) +
      `<path d="M38 20q-4-6 0-12M50 20q-4-6 0-12" stroke="#B9A8D6" stroke-width="3.4" stroke-linecap="round" fill="none" opacity=".7"/>` +
      B(`<path d="M66 40h5a13 13 0 0 1 0 26h-5" stroke="${c[0]}" stroke-width="9" fill="none"/><rect x="18" y="27" width="52" height="58" rx="13" fill="${c[0]}"/>`) +
      B(`<ellipse cx="44" cy="31" rx="22" ry="6" fill="#5A2E1A"/>`, 'ps') +
      B(`<circle cx="35" cy="60" r="5" fill="#fff"/><circle cx="50" cy="66" r="4" fill="#fff"/><circle cx="46" cy="52" r="3" fill="#fff"/>`, 'ps') + GL(28, 44, 5, 12, 0)],
    ['풍선', [['#F0364A'], ['#9B5CF6']], c => SHD(18, 93) +
      `<path d="M50 76q-9 7 0 15" stroke="#8A7A9A" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
      B(`<ellipse cx="50" cy="41" rx="28" ry="32" fill="${c[0]}"/><path d="M45 72h10l-5 7z" fill="${c[0]}"/>`) + GL(38, 28, 8, 12, -25)],
    ['종', [['#FFB81F', '#B86A00'], ['#2DBE6C', '#14703A']], c => SHD(30) +
      B(`<circle cx="50" cy="15" r="6" fill="none" stroke="${c[1]}" stroke-width="4"/>`, 'ps') +
      B(`<path d="M50 18c-17 0-25 14-25 31v15l-9 10h68l-9-10V49c0-17-8-31-25-31z" fill="${c[0]}"/>`) +
      B(`<circle cx="50" cy="80" r="8" fill="${c[1]}"/>`, 'pm') + GL(38, 36, 6, 12, 15)],
    ['왕관', [['#FFC530', '#FF4D6D'], ['#FF6FB1', '#38C6FF']], c => SHD(32) +
      B(`<path d="M17 76L20 36l16 15 14-27 14 27 16-15 3 40z" fill="${c[0]}" stroke="${c[0]}" stroke-width="6" stroke-linejoin="round"/>`) +
      B(`<circle cx="20" cy="33" r="6" fill="${c[1]}"/><circle cx="50" cy="22" r="7" fill="${c[1]}"/><circle cx="80" cy="33" r="6" fill="${c[1]}"/><circle cx="50" cy="63" r="6" fill="${c[1]}"/>`, 'ps') + GL(34, 58, 8, 4, -10)],
    ['버섯', [['#E8413C'], ['#3A7BEA']], c => SHD(26) +
      B(`<path d="M37 56h26l3 24c0 6-7 10-16 10s-16-4-16-10z" fill="#FFF0D6"/>`, 'pm') +
      B(`<path d="M12 56c0-23 17-40 38-40s38 17 38 40c0 4-3 6-7 6H19c-4 0-7-2-7-6z" fill="${c[0]}"/>`) +
      B(`<circle cx="34" cy="38" r="7" fill="#fff"/><circle cx="58" cy="30" r="5.5" fill="#fff"/><circle cx="70" cy="48" r="5" fill="#fff"/><circle cx="48" cy="51" r="4" fill="#fff"/>`, 'ps')],
    ['나뭇잎', [['#3DBB4A', '#1F7A2C'], ['#FF8A1F', '#B8530A']], c => SHD(26) +
      B(`<path d="M18 84C12 50 34 16 86 13c4 52-28 74-68 71z" fill="${c[0]}"/>`) +
      `<path d="M22 80Q46 54 74 25M44 58l-4-14M56 46l12 3M38 66l-12-2" stroke="${c[1]}" stroke-width="3.4" stroke-linecap="round" fill="none" opacity=".8"/>` + GL(54, 30, 10, 5, -40)],
    ['꽃', [['#FF6FA8', '#FFD23F'], ['#FFC21A', '#FF6A1A']], c => SHD(22) +
      B(`<path d="M50 64v24" stroke="#3DBB4A" stroke-width="6" stroke-linecap="round"/><path d="M51 80c8-10 20-10 24-4-6 8-17 9-24 4z" fill="#3DBB4A"/>`, 'pm') +
      B([0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; return `<circle cx="${(50 + Math.cos(a) * 20).toFixed(1)}" cy="${(42 + Math.sin(a) * 20).toFixed(1)}" r="16" fill="${c[0]}"/>`; }).join('')) +
      B(`<circle cx="50" cy="42" r="12" fill="${c[1]}"/>`, 'pm') + GL(36, 26, 6, 4, -30)],
    ['사탕', [['#A35CF0'], ['#FF8A1F']], c => SHD(30) +
      B(`<path d="M34 52L11 37q-3 15 0 30z M66 52l23-15q3 15 0 30z" fill="${c[0]}" stroke="${c[0]}" stroke-width="5" stroke-linejoin="round"/>`, 'pm') +
      B(`<ellipse cx="50" cy="52" rx="21" ry="19" fill="${c[0]}"/>`) +
      `<path d="M38 40l14 24M50 35l14 24" stroke="#fff" stroke-width="4.4" stroke-linecap="round" opacity=".6"/>` + GL(42, 42, 6, 4, -30)],
    ['당근', [['#FF7A1A'], ['#8B4FD8']], c => SHD(24) +
      `<g transform="rotate(-28 50 55)">` + B(`<path d="M44 26c-5-10-14-14-20-10 4 6 12 10 20 10zM50 24c0-11 5-18 12-18 0 8-5 15-12 18zM47 26c-2-12 2-20 2-20s5 9 2 20z" fill="#3DBB4A"/>`, 'pm') +
      B(`<path d="M34 30c10-6 22-6 32 0 2 3 1 6 0 9L53 88c-1.6 4-4.4 4-6 0L34 39c-1-3-2-6 0-9z" fill="${c[0]}"/>`) +
      `<path d="M40 44h9M43 58h8M46 72h6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>` + GL(42, 38, 4, 9, 0) + `</g>`],
    ['체리', [['#E8283C'], ['#FFC21A']], c => SHD(30) +
      B(`<path d="M33 60Q40 30 58 14M66 56Q64 32 58 14" stroke="#5A8A2A" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M59 15c10-6 22-2 24 4-8 5-18 4-24-4z" fill="#4CB84A"/>`, 'pm') +
      B(`<circle cx="32" cy="68" r="17" fill="${c[0]}"/><circle cx="67" cy="64" r="17" fill="${c[0]}"/>`) + GL(26, 62, 5, 4, -30) + GL(61, 58, 5, 4, -30)],
    ['물고기', [['#FF8A1F', '#FFD9A8'], ['#2F8CFF', '#BEE0FF']], c => SHD(30) +
      B(`<path d="M68 52l22-18q3 18 0 36z" fill="${c[0]}" stroke="${c[0]}" stroke-width="4" stroke-linejoin="round"/><path d="M34 34q12-14 26 2z" fill="${c[0]}"/>`, 'pm') +
      B(`<ellipse cx="44" cy="53" rx="32" ry="22" fill="${c[0]}"/>`) +
      `<path d="M44 33q6 20 0 40M56 36q5 17 0 34" stroke="${c[1]}" stroke-width="4" fill="none" opacity=".75"/>` +
      `<circle cx="27" cy="48" r="5.5" fill="#fff"/><circle cx="26" cy="49" r="3" fill="#231A2E"/>` + GL(34, 40, 8, 4, -15)],
    ['구름', [['#5DBDF8'], ['#FF8CC4']], c => SHD(30, 86) +
      B(`<circle cx="31" cy="58" r="17" fill="${c[0]}"/><circle cx="52" cy="44" r="22" fill="${c[0]}"/><circle cx="71" cy="57" r="16" fill="${c[0]}"/><rect x="20" y="56" width="62" height="20" rx="10" fill="${c[0]}"/>`) + GL(44, 34, 9, 5, -20)],
    ['물방울', [['#20B8E8'], ['#3CC46A']], c => SHD(22) +
      B(`<path d="M50 10C50 10 22 45 22 62a28 28 0 0 0 56 0C78 45 50 10 50 10z" fill="${c[0]}"/>`) + GL(38, 58, 5, 11, 10)],
    ['집', [['#E8483B', '#FFE2A8'], ['#3B7BE8', '#C8F0FF']], c => SHD(32) +
      B(`<rect x="24" y="46" width="52" height="40" rx="5" fill="${c[1]}"/>`) +
      B(`<path d="M15 52L50 20l35 32z" fill="${c[0]}" stroke="${c[0]}" stroke-width="7" stroke-linejoin="round"/>`) +
      B(`<rect x="43" y="62" width="15" height="24" rx="4" fill="${c[0]}"/><rect x="29" y="56" width="10" height="10" rx="2" fill="#7FD0FF"/>`, 'ps') + GL(38, 36, 8, 3, -40)],
    ['돛단배', [['#E8483B', '#FFF1C2'], ['#2F80ED', '#FFD6E6']], c => SHD(32) +
      B(`<path d="M50 14v50" stroke="#7A4A2A" stroke-width="4"/><path d="M47 18v40H22z" fill="${c[1]}" stroke="${c[1]}" stroke-width="3" stroke-linejoin="round"/><path d="M54 26v32h22z" fill="${c[1]}" stroke="${c[1]}" stroke-width="3" stroke-linejoin="round"/>`, 'pm') +
      B(`<path d="M12 64h76l-11 20H23z" fill="${c[0]}" stroke="${c[0]}" stroke-width="4" stroke-linejoin="round"/>`) + GL(30, 69, 9, 3, 0)],
    ['로켓', [['#F0364A', '#FFE6EA'], ['#2DBE6C', '#E2F8EA']], c => SHD(22) +
      `<g transform="rotate(22 50 52)">` + B(`<path d="M42 78q8 16 16 0z" fill="#FFB020"/>`, 'ps') +
      B(`<path d="M36 58l-12 16 14-2zM64 58l12 16-14-2z" fill="${c[0]}"/>`, 'pm') +
      B(`<path d="M50 8c14 10 18 30 16 64H34c-2-34 2-54 16-64z" fill="${c[1]}"/>`) +
      B(`<path d="M50 8c7 5 11 11 13 18H37c2-7 6-13 13-18z" fill="${c[0]}"/><circle cx="50" cy="44" r="8" fill="#4FB6FF"/>`, 'ps') + GL(42, 40, 3, 12, 0) + `</g>`],
    ['아이스크림', [['#FF8FC0'], ['#5FD8B0']], c => SHD(16) +
      B(`<path d="M31 50h38L52 91h-4z" fill="#E9A55A" stroke="#E9A55A" stroke-width="3" stroke-linejoin="round"/>`, 'pm') +
      `<path d="M37 58l20 22M48 54l15 16M63 58L45 80M52 54L39 68" stroke="#B9732E" stroke-width="2.2" opacity=".7"/>` +
      B(`<path d="M27 46a23 23 0 0 1 46 0c0 5-3 7-6 6-3 5-7 5-9 1-3 4-8 4-10 0-3 4-8 4-10-1-4 1-11 1-11-6z" fill="${c[0]}"/>`) +
      B(`<circle cx="52" cy="20" r="5.5" fill="#E8283C"/>`, 'ps') + GL(40, 34, 7, 4, -25)],
    ['도넛', [['#FF6FA8'], ['#8A5230']], c => SHD(32) +
      B(`<path fill-rule="evenodd" d="M50 18a34 32 0 1 1 0 64a34 32 0 1 1 0-64zm0 21a12 11 0 1 0 0 22a12 11 0 1 0 0-22z" fill="#E7B06A"/>`) +
      B(`<path fill-rule="evenodd" d="M50 21c17 0 30 11 30 26 0 6-4 9-7 7-3 6-8 7-11 3-4 3-10 3-13-1-4 3-10 2-12-3-4 2-10 1-12-4-4-1-7-4-5-9 3-11 14-19 30-19zm0 18a12 10 0 1 0 0 20a12 10 0 1 0 0-20z" fill="${c[0]}"/>`, 'pm') +
      `<g stroke-width="3" stroke-linecap="round"><path d="M34 32l4 3" stroke="#FFE45C"/><path d="M62 28l-3 4" stroke="#7FD6FF"/><path d="M71 44l4 1" stroke="#fff"/><path d="M28 48l1 4" stroke="#9BF07A"/><path d="M48 27l4-1" stroke="#fff"/></g>`],
    ['선물', [['#3D8BFF', '#FFD23F'], ['#F0364A', '#7CDB5A']], c => SHD(32) +
      B(`<rect x="20" y="46" width="60" height="40" rx="6" fill="${c[0]}"/><rect x="15" y="34" width="70" height="16" rx="6" fill="${c[0]}"/>`) +
      B(`<rect x="45" y="34" width="10" height="52" fill="${c[1]}"/><path d="M50 34c-6-12-22-14-22-4 0 6 12 6 22 4zM50 34c6-12 22-14 22-4 0 6-12 6-22 4z" fill="${c[1]}"/>`, 'pm') + GL(30, 58, 5, 9, 0)],
    ['막대사탕', [['#FF5C9A', '#FFE0EE'], ['#3DBB4A', '#E6FFD9']], c => SHD(16) +
      B(`<path d="M50 60v32" stroke="#F3E3C8" stroke-width="6" stroke-linecap="round"/>`, 'pm') +
      B(`<circle cx="50" cy="36" r="27" fill="${c[0]}"/>`) +
      `<path d="M50 36m-4 0a4 4 0 1 1 8 0a8 8 0 1 1-16 0a12 12 0 1 1 24 0a16 16 0 1 1-32 0a20 20 0 1 1 40 0" stroke="${c[1]}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>` + GL(38, 24, 6, 4, -30)],
    ['연필', [['#FFC21A'], ['#3D8BFF']], c => SHD(30) +
      `<g transform="rotate(-42 50 52)">` + B(`<path d="M36 22h28v50H36z" fill="${c[0]}"/>`) +
      B(`<path d="M36 72h28L50 94z" fill="#F5D6A8"/><path d="M45.5 87h9L50 94z" fill="#3A2A4A"/><rect x="36" y="10" width="28" height="9" rx="2" fill="#B8BCCB"/><path d="M36 10h28V8a6 6 0 0 0-6-6H42a6 6 0 0 0-6 6z" fill="#FF8AA8"/>`, 'ps') +
      `<path d="M45 24v46M55 24v46" stroke="#fff" stroke-width="2" opacity=".35"/>` + GL(40, 40, 2.5, 12, 0) + `</g>`],
    ['자동차', [['#F0364A'], ['#FFC21A']], c => SHD(36, 88) +
      B(`<path d="M12 66c0-8 4-12 12-13l11-15c2-3 5-4 9-4h15c4 0 7 2 9 5l9 14c8 1 11 5 11 13v8H12z" fill="${c[0]}"/>`) +
      B(`<path d="M37 40h9v13H29zM52 40h7c2 0 4 1 5 3l6 10H52z" fill="#BFE6FF"/>`, 'ps') +
      B(`<circle cx="30" cy="76" r="10" fill="#3A3550"/><circle cx="71" cy="76" r="10" fill="#3A3550"/>`, 'pm') +
      `<circle cx="30" cy="76" r="3.6" fill="#C9C4DE"/><circle cx="71" cy="76" r="3.6" fill="#C9C4DE"/>` + GL(26, 60, 7, 3, -10)]
  ];
  /* 공용 캐릭터 12종 + 색만 다른 짝(색 바꾸기 표) */
  const TOYS = [
    ['fox', '여우', { '#FF7A12':'#3D8BFF', '#FFD2A6':'#C2E0FF' }],
    ['octopus', '문어', { '#F0364A':'#9B5CF6', '#FF8C98':'#D2B8FF', '#FF9AA8':'#D8C2FF' }],
    ['whale', '고래', { '#1F74E0':'#1FA35A', '#6CC3FF':'#7FE0A0', '#8FC8FF':'#B4F0C8', '#7FB6FF':'#8FE0A8', '#0B3F86':'#0B5A2E' }],
    ['chick', '병아리', { '#FFC40D':'#FF8FB8', '#FFB300':'#FF6FA0' }],
    ['frog', '개구리', { '#27AE3B':'#2E86E8', '#C6F09A':'#C2E2FF', '#8BE06A':'#8FC4FF', '#0E5A17':'#0E3A7A' }],
    ['owl', '부엉이', { '#8A3FEA':'#E8542E', '#EBDDFF':'#FFE2D4', '#B58CFF':'#FFA488' }],
    ['panda', '판다', { '#2C2838':'#B5562A' }],
    ['rabbit', '토끼', { '#FF9EC2':'#7FC8FF', '#FFE0EC':'#D6EEFF', '#FF6FA0':'#4FA8F0', '#E0457F':'#2F7FD0' }],
    ['bear', '곰', { '#B06A30':'#3FAE6E', '#E9B27A':'#A6E6BE', '#F0C995':'#D8F5E2' }],
    ['cat', '고양이', { '#8E98B5':'#FF9A3C', '#6C7593':'#D9701E', '#FFC6D6':'#FFE0C0' }],
    ['dog', '강아지', { '#E9B46E':'#9AA3BC', '#8A5226':'#4A5068', '#C98A48':'#6A7290' }],
    ['tiger', '호랑이', { '#FF9420':'#E4E2EE', '#FFE4C4':'#FFFFFF' }]
  ];
  const doc = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${DEFS}</defs>${body}</svg>`;
  const recolor = (s, map) => s.replace(/#[0-9A-Fa-f]{6}/g, h => map[h.toUpperCase()] || map[h] || h);
  /* S[i] = { name, key, toy? }  ·  같은 그림 = 같은 번호 + 같은 변형 */
  const S = TOYS.map(([k, name]) => ({ name, key:k, toy:true })).concat(OBJ.map(([name], i) => ({ name, key:'o' + i })));
  /* bare = 바닥 그림자 없이(카드 위에서는 그림을 돌리므로 그림자는 화면에서 따로 그린다) */
  const body = (i, v, bare) => {
    if(i < TOYS.length){ const [k, , map] = TOYS[i]; let b = TOY.A[k](); if(bare) b = b.replace(TOY.SH, ''); return v ? recolor(b, map) : b; }
    const o = OBJ[i - TOYS.length]; NOSH = !!bare; try{ return o[2](o[1][v ? 1 : 0]); } finally { NOSH = false; }
  };
  const cache = {};
  const src = (i, v, bare) => { const key = i + ':' + (v ? 1 : 0) + (bare ? 'b' : ''); return cache[key] || (cache[key] = 'data:image/svg+xml,' + encodeURIComponent(doc(body(i, v, bare))).replace(/'/g, '%27')); };
  return { S, N:S.length, src, body, doc };
})();
