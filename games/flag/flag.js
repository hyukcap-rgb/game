/* ===== 청기 백기 (flag) · 하루퍼즐 리그 순발력 게임 =====
   진행자가 "청기 올려", "백기 내려"처럼 명령하면 엄지 자리 큰 버튼으로 내 깃발을 올리고 내린다.
   순발력 = 판단이 빠른 것: 이미 그 상태인 명령, "~하지 마", 흉내쟁이 명령은 가만히 있는 게 정답(막 누르면 손해).
   모든 명령은 말풍선 글자 + 그림(깃발·화살표·✕ 도장)으로 나온다. 목소리(speechSynthesis)는 덤.
   명령 순서는 init에서 rng로만 미리 다 만든다(같은 씨앗 = 같은 명령). 판단 창은 글자가 화면에 뜬 순간부터 엔진 시계(elapsed)로 잰다. */
NG.flag = (() => {
  const OL = '#1A0F45';
  const FN = { b:'청기', w:'백기', y:'황기' };                 /* 깃발 이름 */
  const FC = { b:'#2F7BEA', w:'#FDFDFF', y:'#FFC21A' };         /* 깃발 천 색 */
  const FLAGS2 = ['b', 'w'], FLAGS3 = ['b', 'w', 'y'];
  const WRONG_GAP = .4;   /* 오답 뒤 다음 명령까지(초): 짧게 보여 주고 바로 넘어간다(2026-10-06 사용자 지시) */
  const HOSTS = ['fox', 'rabbit', 'bear', 'panda', 'tiger'];    /* 챕터 진행자(솔로) */
  const HOST_NAME = { fox:'여우 대장', rabbit:'토끼 반장', bear:'곰 선생님', panda:'판다 코치', tiger:'호랑이 단장', mimic:'흉내쟁이 너구리' };
  const HOST_COL = { fox:'#FF7A12', rabbit:'#FF9EC2', bear:'#B06A30', panda:'#2C2838', tiger:'#FF9420' };
  /* 진행자 말투(챕터마다 다르게). 보이기만 하는 글이라 Math.random으로 골라도 된다 */
  const TALK = {
    fox:{ ready:'자, 깃발 들어!', ok:['좋아!', '그렇지!', '딱 맞아!'], stay:['잘 참았어!', '속지 않았네!'], bad:['아깝다!', '다시 집중!'] },
    rabbit:{ ready:'깡총! 시작할게요', ok:['깡총, 잘했어요!', '폴짝 정답!', '빠르다!'], stay:['꾹 참았어요!', '안 속았네요!'], bad:['앗, 아까워요', '귀 쫑긋!'] },
    bear:{ ready:'자, 준비됐나요?', ok:['음, 훌륭해요', '좋아요!', '정확해요'], stay:['잘 참았어요', '침착하네요'], bad:['괜찮아요, 다음!', '천천히 봐요'] },
    panda:{ ready:'느긋하게, 정확하게!', ok:['대나무처럼 쭉!', '굿!', '깔끔해!'], stay:['흔들리지 않네!', '참기 성공!'], bad:['어이쿠!', '숨 한 번 쉬고!'] },
    tiger:{ ready:'어흥! 시작한다!', ok:['어흥, 멋져!', '번개 같아!', '정답이다!'], stay:['안 속았군!', '대단한 인내!'], bad:['어흥, 틀렸다!', '눈 크게 떠!'] }
  };
  /* 챕터 배경(운동회 마당·깃발 학교·바람 언덕·반대 나라·깃발 왕국): 하늘 위·아래, 땅, 땅 그늘 */
  const THEME = [
    { sky:['#9ED6FF', '#E3F4FF'], field:['#9BDC78', '#6CBF52'], pen:['#FF8A8A', '#FFD25A', '#7CCBFF', '#8EE07A', '#C59BFF'] },
    { sky:['#FFD9A8', '#FFF4E2'], field:['#A9DB86', '#79B95E'], pen:['#FF9F6B', '#FFE07A', '#86C8FF', '#FF8FB8', '#9BE38A'] },
    { sky:['#B4E2FF', '#F2FBFF'], field:['#B6E38C', '#82C060'], pen:['#7CCBFF', '#FFFFFF', '#9BE38A', '#FFE07A', '#7CCBFF'] },
    { sky:['#D9C8FF', '#F5F0FF'], field:['#B9E39A', '#86C06A'], pen:['#B48BFF', '#FF9CC4', '#FFE07A', '#86C8FF', '#B48BFF'] },
    { sky:['#FFE7A0', '#FFF8DE'], field:['#A3D97F', '#6FB556'], pen:['#FFC93C', '#FF8A8A', '#7CCBFF', '#FFC93C', '#9BE38A'] }
  ];

  /* ===== 개념(솔로) ===== */
  const CONC = {
    order:['neg', 'both', 'third', 'flip'],
    info:{
      neg:{ name:'하지 마', desc:'"청기 올리지 마"처럼 "~하지 마"가 붙으면 아무것도 누르지 말고 가만히 있어요. 빨간 ✕ 도장이 찍힌 명령이에요.' },
      both:{ name:'두 개 한꺼번에', desc:'"청기 올리고 백기 내려"처럼 두 깃발을 한 번에 시켜요. 두 깃발이 모두 맞아야 정답이에요. 누르는 순서는 상관없어요.' },
      third:{ name:'노란 깃발', desc:'진행자 머리에 노란 깃발(황기)이 생겨요. 가운데 노란 버튼으로 올리고 내려요. 버튼이 3×2로 바뀌어요.' },
      flip:{ name:'반대로!', desc:'진행자가 "반대로!" 카드를 들면 "그대로!"가 나올 때까지 올려는 내리고, 내려는 올려요. 그동안 화면 테두리가 보라색이에요.' }
    },
    twists:['flash', 'mimic', 'tight'],
    twInfo:{
      flash:{ name:'번개', desc:'판단 시간이 평소보다 짧아요. 침착하게, 하지만 빠르게!' },
      mimic:{ name:'흉내쟁이', desc:'가끔 진행자 대신 흉내쟁이 너구리가 옆에서 명령해요. 진행자 명령만 따르고, 너구리 명령은 가만히!' },
      tight:{ name:'외줄 타기', desc:'기회가 2번뿐이에요. 두 번 틀리면 끝나요.' }
    }
  };
  const RULE_TIP = { neg:'"~하지 마"는 가만히', both:'두 깃발 한꺼번에', third:'노란 깃발 추가', flip:'반대로 카드 조심', flash:'판단 시간이 짧아요', mimic:'너구리 명령은 가만히', tight:'기회 2번' };

  /* ----- 솔로 난이도 표 -----
     명령 수 = 12 + 2×(챕터−1) + KADD[k] (최대 32, 보스 +6)
     판단 창 = 챕터 1은 2.8→2.2초, 챕터마다 ×0.94, k=5 ×0.9 · 보스 ×0.85 · 쉬어가기 ×1.15 · 소개 판 ×1.08, 번개 ×0.8 (바닥 1.15→0.9초)
     함정 비율 = 10% + 7.5%p×(챕터−1) (최대 45%), 보스 +10%p, 쉬운 판 −4%p */
  const KADD = [0, 0, 1, 2, 3, 5, 1, 4, 5, 2, 6];
  function stageCfg(n){
    const p = planOf('flag', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    const cnt = Math.min(32, 12 + 2 * (c - 1) + KADD[k]);
    const dec = Math.pow(.94, c - 1), km = p.boss ? .85 : k === 5 ? .9 : k === 9 ? 1.15 : (k === 1 || k === 6) ? 1.08 : 1, fl = tw === 'flash' ? .8 : 1;
    const w0 = Math.max(1.15, 2.8 * dec * km * fl), w1 = Math.max(.9, Math.min(w0, 2.2 * dec * km * fl));
    const trap = Math.min(.45, .1 + .075 * (c - 1)) + (p.boss ? .1 : 0) - (p.easy ? .04 : 0);
    return { cnt, w0:+w0.toFixed(2), w1:+w1.toFixed(2), trap:+trap.toFixed(3), limit:0,
      neg:has('neg') || c >= 3, negBoost:has('neg'), both:has('both'), bothP:has('both') ? .4 : 0, third:has('third'),
      flip:has('flip'), flipEp:has('flip') ? (p.boss || k === 5 ? 2 : 1) : 0, mimic:tw === 'mimic', lives:tw === 'tight' ? 2 : 3,
      boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n, host:HOSTS[(c - 1) % HOSTS.length], theme:(c - 1) % THEME.length };
  }

  /* ===== 명령 만들기(rng만) =====
     깃발 상태(0 내림 · 1 올림)를 따라가며 명령을 만든다. 정답 상태(tgt)는 플레이어가 무엇을 누르든 이 순서대로 간다
     (틀리면 내 깃발을 정답 상태로 맞춰 준다) → 같은 씨앗이면 모든 사람이 같은 명령을 같은 순서로 받는다.
     함정: already(이미 그 상태) · neg(~하지 마) · mimic(흉내쟁이) · both0(두 개 모두 이미 그 상태). 함정 = 가만히가 정답. */
  function gen(cfg, rng){
    const F = cfg.third ? FLAGS3 : FLAGS2, N = cfg.cnt, seq = [], st = { b:0, w:0, y:0 };
    const pick = a => a[Math.floor(rng() * a.length)];
    const pair = () => { const a = pick(F); let b = pick(F); if(b === a) b = F[(F.indexOf(a) + 1 + Math.floor(rng() * (F.length - 1))) % F.length]; return F.indexOf(a) < F.indexOf(b) ? [a, b] : [b, a]; };
    /* 반대로 구간: [시작, 끝) 명령 번호 */
    const flips = [];
    if(cfg.flip){
      const ep = Math.max(1, cfg.flipEp || 1); let from = 3;
      for(let e = 0; e < ep; e++){
        const room = N - from - 2; if(room < 3) break;
        const span = Math.floor(room / (ep - e)), a = from + Math.floor(rng() * Math.max(1, span - 4)), len = 3 + Math.floor(rng() * 3);
        flips.push([a, Math.min(N, a + len)]); from = a + len + 2;
      }
    }
    /* 함정 자리: 개수는 명령 수 × 함정 비율(반올림, 최소 1)로 정하고, 뒤쪽일수록 뽑힐 무게가 크다(긴장 곡선).
       처음 두 명령은 함정 없음, 함정이 셋 연달아 나오지 않음(가만히만 있어도 버티는 판이 되지 않게) */
    const traps = new Set();
    if(cfg.trap > 0 && N > 3){
      const K = Math.min(Math.floor((N - 2) * .6), Math.max(1, Math.round(N * cfg.trap)));
      for(let tries = 0; traps.size < K && tries < 400; tries++){
        let tot = 0; const cand = [];
        for(let i = 2; i < N; i++){ if(traps.has(i) || (traps.has(i - 1) && traps.has(i - 2)) || (traps.has(i + 1) && traps.has(i + 2)) || (traps.has(i - 1) && traps.has(i + 1))) continue; const w = .55 + .9 * i / (N - 1); cand.push([i, w]); tot += w; }
        if(!cand.length) break;
        let r = rng() * tot, pickI = cand[cand.length - 1][0];
        for(const [i, w] of cand){ if(r < w){ pickI = i; break; } r -= w; }
        traps.add(pickI);
      }
    }
    let flip = false;
    for(let i = 0; i < N; i++){
      for(const [a, b] of flips){ if(i === b && flip){ seq.push({ card:'keep' }); flip = false; } if(i === a){ seq.push({ card:'flip' }); flip = true; } }
      const p = N > 1 ? i / (N - 1) : 0;
      const trap = traps.has(i);
      const tgt = { b:st.b, w:st.w, y:st.y };
      let kind, parts, from = 'host';
      const shown = v => flip ? !v : !!v;   /* 반대로 구간: 화면 글자는 실제로 할 일의 반대 */
      if(trap){
        const ks = [['already', 3]];
        if(cfg.neg) ks.push(['neg', cfg.negBoost ? 6 : 3]);
        if(cfg.mimic) ks.push(['mimic', 5]);
        if(cfg.both) ks.push(['both0', 1.5]);
        let r = rng() * ks.reduce((s, x) => s + x[1], 0); kind = ks[ks.length - 1][0];
        for(const [k, w] of ks){ if(r < w){ kind = k; break; } r -= w; }
        if(kind === 'already'){ const f = pick(F); parts = [{ f, up:shown(st[f]) }]; }
        else if(kind === 'neg'){ const f = pick(F); parts = [{ f, up:rng() < .5, neg:true }]; }
        else if(kind === 'mimic'){ const f = pick(F); parts = [{ f, up:shown(1 - st[f]) }]; from = 'mimic'; }
        else { const [a, b] = pair(); parts = [{ f:a, up:shown(st[a]) }, { f:b, up:shown(st[b]) }]; }
      } else {
        if(cfg.both && rng() < (cfg.bothP || 0)){
          kind = 'both';
          const [a, b] = pair(); let va = rng() < .5 ? 1 : 0, vb = rng() < .5 ? 1 : 0;
          if(va === st[a] && vb === st[b]){ if(rng() < .5) va = 1 - va; else vb = 1 - vb; }
          tgt[a] = va; tgt[b] = vb; parts = [{ f:a, up:shown(va) }, { f:b, up:shown(vb) }];
        } else {
          kind = 'single';
          const f = pick(F), v = 1 - st[f]; tgt[f] = v; parts = [{ f, up:shown(v) }];
        }
      }
      let win = cfg.w0 + (cfg.w1 - cfg.w0) * p;   /* 한 판 안에서 창이 선형으로 짧아진다 */
      if(parts.length === 2) win *= 1.3;
      if(cfg.third) win *= 1.08;
      if(flip) win *= 1.12;
      seq.push({ i, kind, from, parts, tgt, stay:kind !== 'single' && kind !== 'both', flip, win:Math.round(win * 100) / 100 });
      st.b = tgt.b; st.w = tgt.w; st.y = tgt.y;
    }
    return seq;
  }
  const verbOf = (p, last) => p.neg ? (p.up ? '올리지 마' : '내리지 마') : last ? (p.up ? '올려' : '내려') : (p.up ? '올리고' : '내리고');
  const sayOf = q => q.parts.map((p, j) => FN[p.f] + ' ' + verbOf(p, j === q.parts.length - 1)).join(', ');

  /* ===== 그림(3D 비닐 장난감 질감: 외곽선 없음, 색 하나 + 위 하이라이트·아래 그늘) ===== */
  const FX_ID = { pb:'flgPB', pm:'flgPM', ps:'flgPS' };
  const DEFS_SVG = `<svg class="fl-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${TOY.PUFF(FX_ID.pb, 5, 4, .8, 1.8)}${TOY.PUFF(FX_ID.pm, 2.6, 3, .75, 1)}${TOY.PUFF(FX_ID.ps, 1.3, 2.6, .9)}
    <radialGradient id="flgGL" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs></svg>`;
  /* 팔 + 손 + 깃대 + 깃발 천(오른팔 기준, 왼팔은 좌우 뒤집기). 어깨 = (30, 96) */
  function armSvg(f, col){
    const c = FC[f], wave = f === 'w' ? '#E4E9F5' : f === 'y' ? '#FFE48A' : '#6FB0FF';
    return `<svg class="fl-armi" viewBox="0 0 60 110" aria-hidden="true">
      <g filter="url(#${FX_ID.ps})"><rect x="27.4" y="6" width="5.2" height="80" rx="2.6" fill="#E6BE84"/><circle cx="30" cy="6" r="5" fill="#FFC93C"/></g>
      <g class="fl-cloth u"><g filter="url(#${FX_ID.pm})"><path d="M32 8.5C40 5 48 12 58.5 8v29.5c-10.5 4-18.5-3-26.5.5z" fill="${c}"/></g>
        <path d="M36 14c5-1.6 9 1.4 14 0" stroke="${wave}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".8"/>
        <ellipse cx="41" cy="15" rx="6" ry="3" fill="url(#flgGL)"/></g>
      <g class="fl-cloth d"><g filter="url(#${FX_ID.pm})"><path d="M28 8.5C20 5 12 12 1.5 8v29.5c10.5 4 18.5-3 26.5.5z" fill="${c}"/></g>
        <path d="M24 31c-5 1.6-9-1.4-14 0" stroke="${wave}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".8"/>
        <ellipse cx="19" cy="30" rx="6" ry="3" fill="url(#flgGL)"/></g>
      <g filter="url(#${FX_ID.pm})"><path d="M30 97V66" stroke="${col}" stroke-width="13" stroke-linecap="round"/><circle cx="30" cy="61" r="9.2" fill="${col}"/></g>
      <ellipse cx="27" cy="57.5" rx="3.6" ry="2.4" fill="url(#flgGL)"/></svg>`;
  }
  /* 머리 위 노란 깃발(황기) */
  const topSvg = () => `<svg class="fl-topi" viewBox="0 0 40 70" aria-hidden="true"><g filter="url(#${FX_ID.ps})"><rect x="17.6" y="5" width="4.8" height="62" rx="2.4" fill="#E6BE84"/><circle cx="20" cy="5" r="4.4" fill="#FFC93C"/></g>
    <g filter="url(#${FX_ID.pm})"><path d="M22 7.5c6-2.6 10.5 2.5 16-.5v20c-5.5 3-10-2-16 .5z" fill="${FC.y}"/></g><ellipse cx="29" cy="13" rx="4.5" ry="2.4" fill="url(#flgGL)"/></svg>`;
  /* 흉내쟁이 너구리(오리지널, 공용 캐릭터와 같은 질감) */
  let RAC = null;
  const raccoonSrc = () => RAC || (RAC = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${TOY.DEFS}</defs>${TOY.SH}
    <g filter="url(#pb)"><circle cx="25" cy="31" r="11" fill="#7D6E64"/><circle cx="75" cy="31" r="11" fill="#7D6E64"/></g>
    <g filter="url(#pm)"><circle cx="25" cy="31" r="5.5" fill="#3E3540"/><circle cx="75" cy="31" r="5.5" fill="#3E3540"/></g>
    <g filter="url(#pb)"><ellipse cx="50" cy="58" rx="37" ry="31" fill="#A39385"/></g>${TOY.GL(36, 40, 14, 7)}
    <g filter="url(#pm)"><path d="M19 52c6-9 20-9 27-1-2 9-8 12-15 12s-12-4-12-11zM81 52c-6-9-20-9-27-1 2 9 8 12 15 12s12-4 12-11z" fill="#3E3540"/><ellipse cx="50" cy="70" rx="15" ry="10.5" fill="#F4EEE6"/><path d="M50 30v9M43 32l2 6M57 32l-2 6" stroke="#6A5D55" stroke-width="3" stroke-linecap="round"/></g>
    <circle cx="35" cy="54" r="7" fill="#fff"/><circle cx="65" cy="54" r="7" fill="#fff"/>${TOY.EYE(35, 54, 4.4)}${TOY.EYE(65, 54, 4.4)}
    <g filter="url(#ps)"><ellipse cx="50" cy="64" rx="4.8" ry="3.4" fill="#2A1B14"/></g><path d="M45 70q5 4 10 0" fill="none" stroke="#4A2A14" stroke-width="2.2" stroke-linecap="round"/></svg>`).replace(/'/g, '%27'));
  /* 깃발·화살표 작은 아이콘(말풍선·버튼) */
  const flagIco = f => `<svg class="fl-fi" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="2.6" height="20" rx="1.3" fill="#C99A5B"/><path d="M6.6 3.2c4-1.6 7.5 1.6 13.4-.4v10.4c-5.9 2-9.4-1.2-13.4.4z" fill="${FC[f]}" stroke="${f === 'w' ? '#9AA6C4' : 'none'}" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 5.6c2.2-.6 3.8.4 5.6.2" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7" fill="none"/></svg>`;
  /* 올려·내려 배지(명령 말풍선과 버튼에 같은 모양: ▲ 주황 동그라미 · ▼ 보라 동그라미 · 하지 마 ✕ 빨강) */
  const badge = up => `<i class="fl-badge ${up ? 'up' : 'dn'}" aria-hidden="true">${arrIco(up)}</i>`;
  const xBadge = () => '<i class="fl-badge neg" aria-hidden="true"><svg class="fl-ai" viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/></svg></i>';
  const arrIco = up => `<svg class="fl-ai" viewBox="0 0 24 24" aria-hidden="true"><path d="${up ? 'M12 4l8 9h-5v7H9v-7H4z' : 'M12 20l8-9h-5V4H9v7H4z'}" fill="currentColor"/></svg>`;
  const ICO = {
    flag:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="2.4" height="19" rx="1.2" fill="#1A0F45"/><path d="M6.4 3.6c4-1.6 7.5 1.6 13.4-.4v10c-5.9 2-9.4-1.2-13.4.4z" fill="#2F7BEA"/><path d="M8.6 6c2.2-.6 3.8.4 5.6.2" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7" fill="none"/></svg>',
    fire:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.3 2c.6 3.4 2.6 5.2 4.3 7 1.6 1.7 3.1 3.6 3.1 6.4A7.6 7.6 0 0 1 12 22.6a7.6 7.6 0 0 1-7.7-7.4c0-2.6 1.3-4.7 3-6.3.2 1.8 1 3.1 2.4 3.9-.3-3.9.6-7.9 2.6-10.8z" fill="#FF8A3D"/><path d="M12 22.6a3.6 3.6 0 0 1-3.6-3.6c0-2.1 1.8-3.3 2.6-5.3.9 1.4 4.6 2.8 4.6 5.3a3.6 3.6 0 0 1-3.6 3.6z" fill="#FFD27A"/></svg>'
  };
  /* 깃발을 든 캐릭터(진행자·나). 몸은 공용 캐릭터 그림, 팔·깃발은 이 게임 그림 */
  function rigHtml(kind, cls, third, id){
    const col = HOST_COL[kind] || HOST_COL.fox;
    return `<div class="fl-rig ${cls}" id="${id}" aria-hidden="true">
      <div class="fl-arm L down" data-f="b"><div class="fl-armw">${armSvg('b', col)}</div></div>
      <div class="fl-arm R down" data-f="w"><div class="fl-armw">${armSvg('w', col)}</div></div>
      ${third ? `<div class="fl-top down" data-f="y">${topSvg()}</div>` : ''}
      <img class="toy fl-body" src="${toySrc(kind)}" alt="" draggable="false">
    </div>`;
  }
  /* 배경 장식: 만국기 대신 오리지널 삼각 깃발 줄, 구름 */
  function decoSvg(th){
    const pen = THEME[th].pen, n = 12, tri = [];
    for(let i = 0; i < n; i++){
      const x = 10 + i * 30, y = 10 + Math.sin((i + .5) / n * Math.PI) * 14;
      tri.push(`<path d="M${x} ${y}h20l-10 ${17}z" fill="${pen[i % pen.length]}"/>`);
    }
    return `<svg class="fl-bunt" viewBox="0 0 370 44" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <path d="M0 6Q185 40 370 6" fill="none" stroke="#fff" stroke-width="2" opacity=".9"/><g filter="url(#${FX_ID.ps})">${tri.join('')}</g></svg>`;
  }

  /* ===== 화면·조작 ===== */
  const S = () => G && G.fl;
  const T = (fn, ms) => { const m = G.fl, id = setTimeout(() => { m.timers.delete(id); if(G && G.fl === m && !G.over) try{ fn(); }catch(_){} }, ms); m.timers.add(id); return id; };
  const safe = fn => { try{ fn(); }catch(_){} };
  const flagsOf = m => m.third ? FLAGS3 : FLAGS2;

  function cmdHtml(q){
    return q.parts.map((p, j) => `<span class="fl-pt"><span class="fl-fn ${p.f}">${flagIco(p.f)}${FN[p.f]}</span><span class="fl-vb ${p.neg ? 'neg' : p.up ? 'up' : 'dn'}">${p.neg ? xBadge() : badge(p.up)}${verbOf(p, j === q.parts.length - 1)}</span></span>`).join('<span class="fl-and" aria-hidden="true">+</span>');
  }
  function answerText(q){
    if(q.stay) return '정답은 가만히!';
    const m = S(), prev = m.prevTgt;
    return '정답: ' + flagsOf(m).filter(f => q.tgt[f] !== prev[f]).map(f => FN[f] + (q.tgt[f] ? ' 올리기' : ' 내리기')).join(' + ');
  }
  /* 깃발 자세 반영 */
  function poseRig(id, st){
    const r = document.getElementById(id); if(!r) return;
    r.querySelectorAll('[data-f]').forEach(a => { const up = !!st[a.dataset.f]; a.classList.toggle('up', up); a.classList.toggle('down', !up); });
  }
  function lamps(){
    const m = S(); if(!m) return;
    document.querySelectorAll('.ng-flag .fl-btn').forEach(b => b.classList.toggle('on', m.my[b.dataset.f] === +b.dataset.d));
  }
  function moodOf(id, kind, mood, ms){
    const im = document.querySelector('#' + id + ' .fl-body'); if(!im) return;
    im.src = toySrc(kind, mood || '');
    const m = S(); if(!m) return;
    clearTimeout(m.moodT[id]);
    if(ms) m.moodT[id] = setTimeout(() => { if(im.isConnected && !(G && G.over)) im.src = toySrc(kind); }, ms);
  }
  function hud(){
    const m = S(); if(!m) return;
    const p = $('#flProg'); if(p) p.textContent = m.res.length;
    const c = $('#flCombo'); if(c) c.textContent = m.combo;
    const lv = $('#flLives');
    if(lv){ lv.innerHTML = Array.from({ length:m.livesMax }, (_, n) => `<i${n >= m.lives ? ' class="off"' : ''}>★</i>`).join(''); lv.setAttribute('aria-label', '남은 기회 ' + m.lives + '번'); }
    const lc = $('#flLifeP'); if(lc) lc.classList.toggle('warn', m.lives === 1);
  }
  function setBub(o){
    const b = $('#flBub'); if(!b) return;
    if(o.cls != null) b.className = 'fl-bub' + (o.cls ? ' ' + o.cls : '');
    if(o.state !== undefined){ b.classList.toggle('is-ok', o.state === 'ok'); b.classList.toggle('is-bad', o.state === 'bad'); }
    if(o.who != null){ const w = $('#flWho'); if(w) w.innerHTML = o.who; }
    if(o.cmd != null){ const c = $('#flCmd'); if(c){ c.innerHTML = o.cmd; fitCmd(c); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); } }
    if(o.res != null){ const r = $('#flRes'); if(r){ r.innerHTML = o.res; r.className = 'fl-res' + (o.resCls ? ' ' + o.resCls : ''); } }
  }
  /* 명령 글자가 말풍선 폭을 넘으면 글자만 조금 줄인다(좁은 화면 · "올리지 마" 같은 긴 명령) */
  function fitCmd(c){
    c.style.fontSize = '';
    const w = c.clientWidth; if(!w) return;
    let fs = parseFloat(getComputedStyle(c).fontSize) || 32;
    for(let k = 0; k < 8 && c.scrollWidth > w + 1 && fs > 24; k++){ fs -= 2; c.style.fontSize = fs + 'px'; }
  }
  const whoHtml = (kind, mimic) => `<img src="${mimic ? raccoonSrc() : toySrc(kind)}" alt="" aria-hidden="true"><b>${mimic ? HOST_NAME.mimic : HOST_NAME[kind]}</b>`;
  function stamp(ok, label){
    const s = $('#flStamp'); if(!s) return;
    s.className = 'fl-stamp ' + (ok ? 'ok' : 'bad'); s.innerHTML = `<b>${ok ? '✓' : '✕'}</b><span>${label}</span>`;
    void s.offsetWidth; s.classList.add('on');
  }
  function clearStamp(){ const s = $('#flStamp'); if(s) s.className = 'fl-stamp'; }
  function note(text){
    const n = $('#flNote'); if(!n) return;
    n.textContent = text; n.classList.remove('on'); void n.offsetWidth; n.classList.add('on');
  }
  function talk(kind, what){ const a = (TALK[kind] || TALK.bear)[what]; return Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a; }

  /* 목소리(덤): 소리가 켜져 있고 한국어 목소리가 있을 때만 */
  function say(text, hi){
    try{
      if(typeof SND === 'undefined' || !SND.on || !(AUD.set.sfx > 0) || !('speechSynthesis' in window)) return;
      const ss = window.speechSynthesis, v = ss.getVoices().find(x => /^ko/i.test(x.lang)); if(!v) return;
      ss.cancel(); const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = 'ko-KR'; u.rate = 1.35; u.pitch = hi ? 1.6 : 1.05; u.volume = Math.min(1, AUD.set.sfx);
      ss.speak(u);
    }catch(_){}
  }
  const hush = () => { try{ if('speechSynthesis' in window) window.speechSynthesis.cancel(); }catch(_){} };

  /* ----- 진행 ----- */
  function next(t){
    const m = S(); if(!m || m.phase === 'done') return;
    m.pos++;
    const it = m.seq[m.pos];
    if(!it){ win(); return; }
    clearStamp();
    if(it.card){
      m.flipOn = it.card === 'flip';
      m.phase = 'card'; m.until = t + 1.15;
      const root = document.querySelector('.ng-flag'); if(root) root.classList.toggle('flipped', m.flipOn);
      const cd = $('#flCard'); if(cd){ cd.className = 'fl-card ' + (m.flipOn ? 'flip' : 'keep'); cd.innerHTML = `<b>${m.flipOn ? '반대로!' : '그대로!'}</b><small>${m.flipOn ? '올려 ↔ 내려' : '원래대로'}</small>`; void cd.offsetWidth; cd.classList.add('on'); }
      setBub({ cls:'card ' + (m.flipOn ? 'flip' : 'keep'), who:whoHtml(m.host), cmd:`<span class="fl-cardt">${m.flipOn ? '지금부터 반대로!' : '다시 그대로!'}</span>`, res:m.flipOn ? '올려는 내리고, 내려는 올려요' : '말한 대로 해요', resCls:'info' });
      safe(() => { sfx('flagCard', { flip:m.flipOn }); say(m.flipOn ? '반대로!' : '그대로!'); });
      return;
    }
    const cd = $('#flCard'); if(cd) cd.classList.remove('on');
    m.cur = it; m.prevTgt = m.tgtNow; m.phase = 'cmd'; m.t0 = t; m.hurry = false;
    const mim = it.from === 'mimic';
    setBub({ cls:(mim ? 'mimic' : '') + (it.parts.length > 1 ? ' two' : '') + (it.flip ? ' flipq' : ''), who:whoHtml(m.host, mim), cmd:cmdHtml(it), res:'', resCls:'', state:null });
    const rc = $('#flRac'); if(rc) rc.classList.toggle('on', mim);
    const wb = $('#flWinW'); if(wb){ wb.className = 'fl-win'; }
    const bar = $('#flWin'); if(bar) bar.style.transform = 'scaleX(1)';
    safe(() => { sfx(mim ? 'flagMimic' : 'flagCmd'); say(sayOf(it), mim); });
  }
  function judgeNow(){ return elapsed(); }
  function finishQ(ok, info){
    const m = S(), q = m.cur, t = judgeNow();
    m.phase = 'gap';
    m.tgtNow = q.tgt;
    const rc = $('#flRac'), at = m.pos; if(rc) T(() => { if(m.pos === at) rc.classList.remove('on'); }, 360);   /* 다음 명령이 이미 떴으면(흉내쟁이 연속) 건드리지 않음 */
    poseRig('flHost', q.tgt);
    if(ok){
      m.ok++; m.combo++; m.best = Math.max(m.best, m.combo);
      m.res.push({ ok:1, stay:q.stay ? 1 : 0, frac:info.frac, rt:info.rt });
      m.until = t + (q.stay ? .38 : .45);
      stamp(true, q.stay ? '참기 성공' : '정답');
      setBub({ res:(q.stay ? talk(m.host, 'stay') : talk(m.host, 'ok') + ` <small>${info.rt.toFixed(2)}초</small>`), resCls:'ok', state:'ok' });
      moodOf('flMe', 'fox', 'joy', 520);
      safe(() => {
        sfx(q.stay ? 'flagStay' : 'flagOk', { n:m.combo });
        const s = $('#flStamp'); if(s && !FXR.reduce){ const c = fxCenter(s); fxEmit(c.x, c.y, { quantity:10, speed:{ min:40, max:150 }, lifespan:{ min:380, max:620 }, kind:'twinkle', tint:['#FFFFFF', '#FFF2A8', '#A8F0C8'], scale:{ start:4, end:0, ease:'quad.in' }, gravityY:40, glow:true }); }
        if([5, 10, 20].includes(m.combo)) combo(m.combo);
      });
    } else {
      m.res.push({ ok:0, stay:q.stay ? 1 : 0, frac:0, rt:0 });
      m.combo = 0; m.miss++;
      m.lives = Math.max(0, m.lives - 1); G.paws = m.lives;
      m.my = { b:q.tgt.b, w:q.tgt.w, y:q.tgt.y };   /* 틀리면 내 깃발을 정답 상태로 맞춰 준다(다음 명령이 이어지게) */
      m.until = t + WRONG_GAP;   /* 오답은 짧게 보여 주고 바로 다음 명령(0.4초) */
      stamp(false, info.why === 'late' ? '늦었어요' : '땡!');
      setBub({ res:answerText(q), resCls:'bad', state:'bad' });
      moodOf('flMe', 'fox', 'sad', 900);
      T(() => { poseRig('flMe', m.my); lamps(); }, 260);
      /* 어느 버튼이 맞았는지 버튼에 잠깐 표시(누른 버튼 빨간 테두리 · 정답 버튼 초록 테두리) */
      safe(() => {
        const mark = (f, d, c) => { const b = document.querySelector(`.ng-flag .fl-btn[data-f="${f}"][data-d="${d}"]`); if(b){ b.classList.add(c); T(() => b.classList.remove(c), Math.round(WRONG_GAP * 1000) - 20); } };
        if(info.f) mark(info.f, info.d, 'miss');
        if(!q.stay) flagsOf(m).forEach(f => { if(q.tgt[f] !== m.prevTgt[f]) mark(f, q.tgt[f], 'ans'); });
      });
      safe(() => {
        sfx('flagBad'); fxBuzz(40);
        const e = $('#flEdge'); if(e){ e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
        if(!FXR.reduce) fxShake($('#flScene'), 3);   /* 화면 번쩍임 없이(눈 피로) 가장자리 붉은 빛 + 작은 흔들림 */
        const lost = document.querySelectorAll('#flLives i')[m.lives]; if(lost && lost.animate) lost.animate([{ transform:'scale(1.6)', color:'#FFE27A' }, { transform:'none' }], { duration:450, easing:'ease-out' });
      });
      if(!m.lives){ hud(); lose(); return; }
    }
    hud();
    const bar = $('#flWin'); if(bar) bar.style.transform = 'scaleX(0)';
  }
  function combo(n){
    const w = n >= 20 ? '완벽해요!' : n >= 10 ? '대단해요!' : '좋아요!';
    note(`연속 ${n} · ${w}`);
    sfx('flagCombo', { n });
    const c = $('#flComboP'); if(c) fxPunch(c, 1.12);
    const s = $('#flNote'); if(s && !FXR.reduce){ const q = fxCenter(s); fxBurst(q.x, q.y, ['#FFE27A', '#FF8FC8', '#7CCBFF', '#8EE07A', '#FFFFFF'], 18, { speed:260, size:5, kinds:['rect', 'star', 'dot'], up:120, g:520, dur:.85 }); }
  }
  function expire(){
    const m = S(), q = m.cur;
    if(q.stay) finishQ(true, { frac:1, rt:0 });
    else finishQ(false, { why:'late' });
  }
  /* 버튼·키·밀기 → 깃발 하나 올리기/내리기 (세 길 모두 여기 하나로 판정)
     판정 규칙(2026-10-06): 이번 명령이 요구하는 동작 = "목표 상태와 지금 내 깃발이 다른 깃발을 목표 쪽으로" 뿐.
     그 밖의 누르기는 모두 바로 오답 → 곧바로 다음 명령(이미 그 상태인 깃발 누르기, 같은 버튼 두 번, 가만히 명령에 누르기 포함).
     두 개 한꺼번에는 요구된 두 동작을 어떤 순서로 해도 정답, 그 사이에 다른 누르기가 끼면 오답. */
  function press(f, d, src){
    const m = S(); if(!m || !G || G.over || G.paused) return;
    if(!flagsOf(m).includes(f)) return;
    bump(f, d);
    if(m.phase === 'cmd'){
      const q = m.cur, t = judgeNow();
      /* 창이 이미 끝났는데 화면 한 칸(loop)이 아직 안 돈 사이에 온 누르기: 먼저 창을 판정하고, 이 누르기는 간격에 온 것으로 본다 */
      if(t - m.t0 >= q.win){ expire(); return; }
      const need = !q.stay && q.tgt[f] === d && m.my[f] !== d;
      m.my[f] = d; poseRig('flMe', m.my); lamps();
      safe(() => sfx('flagSwish', { pan:f === 'b' ? -.4 : f === 'w' ? .4 : 0 }));
      if(!need){ finishQ(false, { why:'press', f, d }); return; }
      if(flagsOf(m).every(k => m.my[k] === q.tgt[k])){ const rt = Math.max(0, t - m.t0); finishQ(true, { rt, frac:Math.max(0, Math.min(1, 1 - rt / q.win)) }); }
      return;
    }
    /* 명령이 없는 순간(준비·판정 뒤 간격·카드)의 누르기는 무시. 마구 누르면(0.25초 안에 3번 넘게) "천천히!"만 보여 준다(벌점 없음) */
    const now = performance.now();
    m.taps = m.taps.filter(x => now - x < 250); m.taps.push(now);
    if(m.taps.length > 3 && now >= m.lockUntil){ m.lockUntil = now + 500; m.taps = []; note('천천히!'); safe(() => sfx('flagSlow')); }
  }
  function bump(f, d){
    const b = document.querySelector(`.ng-flag .fl-btn[data-f="${f}"][data-d="${d}"]`); if(!b) return;
    b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
  }

  function loop(){
    const m = S(); if(!m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    tick();
  }
  /* 한 화면 칸: 진행·창 막대·시간 초과 (도구용 _tick으로도 부름) */
  function tick(){
    const m = S(); if(!m || G.over) return;
    const t = elapsed();
    if(m.phase === 'ready'){ if(t >= m.until){ setBub({ cls:'' }); next(t); } return; }
    if(m.phase === 'gap' || m.phase === 'card'){ if(t >= m.until) next(t); return; }
    if(m.phase !== 'cmd') return;
    const q = m.cur, left = q.win - (t - m.t0), k = Math.max(0, Math.min(1, left / q.win));
    const bar = $('#flWin'); if(bar) bar.style.transform = `scaleX(${k.toFixed(4)})`;
    const lvl = k > .5 ? '' : k > .25 ? 'mid' : 'low', hurry = left <= .4;
    if(lvl !== m.lvl || hurry !== m.hurry){ m.lvl = lvl; m.hurry = hurry; const w = $('#flWinW'); if(w) w.className = 'fl-win ' + lvl + (hurry ? ' hurry' : ''); }
    if(left <= 0) expire();
  }
  function win(){
    const m = S(); m.phase = 'done'; m.sec = elapsed();
    const rts = m.res.filter(r => r.ok && !r.stay).map(r => r.rt), avg = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
    m.avg = avg;
    const key = 'hp:flag:best', prev = store.get(key, 0);
    m.bestPrev = prev || 0;
    if(avg && !G.duel && (!prev || avg < prev)) store.set(key, Math.round(avg * 1000) / 1000);
    setBub({ cls:'end', who:whoHtml(m.host), cmd:'<span class="fl-cardt">끝까지 버텼어요!</span>', res:avg ? `평균 판단 ${avg.toFixed(2)}초${prev ? ' · 내 최고 ' + Math.min(prev, avg).toFixed(2) + '초' : ''}` : '', resCls:'info' });
    clearStamp(); hush();
    moodOf('flHost', m.host, 'joy'); moodOf('flMe', 'fox', 'joy');
    poseRig('flHost', { b:1, w:1, y:1 }); poseRig('flMe', { b:1, w:1, y:1 });   /* 만세! */
    document.querySelectorAll('.ng-flag .fl-btn').forEach(b => b.classList.remove('on'));
    safe(() => { const s = $('#flScene'); if(s && !FXR.reduce){ const q = fxCenter(s); fxBurst(q.x, q.y - q.h * .1, ['#FFE27A', '#7CCBFF', '#FFFFFF', '#FF8FC8'], 24, { speed:320, size:6, kinds:['star', 'dot', 'rect'], up:140, g:420, glow:true, dur:1 }); } });
    T(() => finish(true), 900);
  }
  function lose(){
    const m = S(); m.phase = 'done'; m.sec = elapsed(); hush();
    const rc = $('#flRac'); if(rc) rc.classList.remove('on');
    setBub({ cls:'end lose', who:whoHtml(m.host), cmd:'<span class="fl-cardt">여기까지!</span>' });
    moodOf('flHost', m.host, 'sad'); moodOf('flMe', 'fox', 'sad');
    safe(() => sfx('flagLose'));
    T(() => finish(false), 1100);
  }

  /* 화면 높이에 맞추기(390×844 · 360×740에서 스크롤 없이) */
  function layout(){
    const root = document.querySelector('.ng-flag'), m = S(); if(!root || !m) return;
    const top = root.getBoundingClientRect().top + (window.scrollY || 0);
    const H = Math.max(470, Math.floor((innerHeight || 740) - top - 12)), W = root.clientWidth || 358;
    root.style.height = H + 'px';
    const cl = (a, v, b) => Math.round(Math.max(a, Math.min(b, v)));
    const bh = cl(64, H * .11, 84);                                  /* 버튼 높이(엄지 자리, 64px 이상) */
    const strip = m.third ? cl(70, H * .1, 86) : 0;                  /* 노란 깃발 판: 버튼 위 내 캐릭터 줄(빈 띠 없이 꼭 맞게) */
    const deck = bh * 2 + 12 + (strip ? strip + 8 : 0);
    const scene = H - 56 - deck - 14;
    const bub = m.both ? cl(128, scene * .3, 140) : cl(108, scene * .26, 124);   /* 명령 말풍선(주인공). 두 개 한꺼번에 판은 두 줄 자리 */
    const free = scene - (30 + bub + 22);                             /* 말풍선 꼬리 아래 남는 높이 */
    const hs = cl(66, Math.min(W * .46, (free - 8) / (m.third ? 1.72 : 1.45)), 176);   /* 진행자 크기: 말풍선 아래 빈 곳을 채움 */
    const feet = cl(Math.round(hs * .38 + 8), free - hs * (m.third ? 1.3 : 1.08), Math.round(hs * .78 + 8));   /* 남는 높이는 구령대를 높여 진행자를 가운데로 */
    const center = m.third ? 0 : cl(108, W * .33, 132);
    const fs = m.third ? cl(50, strip * .8, 70) : cl(50, Math.min(center / 1.6, (bh * 2 + 2) / 1.86), 84);
    Object.entries({ '--bh':bh + 'px', '--strip':strip + 'px', '--deck':deck + 'px', '--bub':bub + 'px', '--hs':hs + 'px', '--feet':feet + 'px', '--fs':fs + 'px', '--mid':center + 'px' }).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  /* 키보드: Q/A 청기, P/L 백기, T/G 황기 (올리기/내리기) */
  const KEYS = { q:['b', 1], a:['b', 0], p:['w', 1], l:['w', 0], t:['y', 1], g:['y', 0] };
  function onKey(e){
    if(!S() || !G || G.over || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if(document.body.classList.contains('modal-open')) return;
    const k = KEYS[(e.key || '').toLowerCase()]; if(!k) return;
    e.preventDefault(); press(k[0], k[1], 'key');
  }
  /* 밀기: 판(장면) 왼쪽 위로 밀기 = 청기 올려 … (노란 깃발이 있으면 가운데 = 황기) */
  function swipeBind(el){
    let s = null;
    el.addEventListener('pointerdown', e => { s = { x:e.clientX, y:e.clientY, id:e.pointerId }; }, { passive:true });
    el.addEventListener('pointerup', e => {
      if(!s || e.pointerId !== s.id) return; const dy = e.clientY - s.y, dx = e.clientX - s.x; const st = s; s = null;
      if(Math.abs(dy) < 30 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
      const m = S(), r = el.getBoundingClientRect(), fx = (st.x - r.left) / r.width;
      const f = m.third ? (fx < 1 / 3 ? 'b' : fx < 2 / 3 ? 'y' : 'w') : (fx < .5 ? 'b' : 'w');
      press(f, dy < 0 ? 1 : 0, 'swipe');
    });
    el.addEventListener('pointercancel', () => { s = null; });
  }
  let UID = 0;

  return {
    name:'청기 백기', abil:'순발력', col:['#A8D4FF', '#2F7BEA', '#174A9E'], time:'약 1분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3.5" y="2.5" width="2.4" height="19" rx="1.2"/><path d="M5.9 3.6c3.6-1.5 6.6 1.5 11.6-.3v8.8c-5 1.8-8-1.2-11.6.3z"/><rect x="15.4" y="12" width="2.2" height="9.5" rx="1.1" opacity=".55"/><path d="M17.6 12.8c1.6-.6 2.6.6 4.4 0v4.4c-1.8.6-2.8-.6-4.4 0z" opacity=".55"/></svg>',
    art(){
      const u = 'flA' + (++UID) + '_';
      const arm = (x, y, up, c, mir) => `<g transform="translate(${x} ${y}) scale(${mir ? -1 : 1} 1) rotate(${up ? 14 : 160})"><rect x="-1.6" y="-38" width="3.2" height="40" rx="1.6" fill="#E6BE84"/><path d="M1.5-37c5-2 9 2 15-.5v15c-6 2.5-10-1.5-15 .5z" fill="${c}"/><circle cx="0" cy="-38" r="2.6" fill="#FFC93C"/><circle cx="0" cy="-17" r="5" fill="#B06A30"/></g>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD0FF"/><stop offset="1" stop-color="#E3F4FF"/></linearGradient>
        <linearGradient id="${u}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9BDC78"/><stop offset="1" stop-color="#6CBF52"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}s)"/>
        <path d="M0 4Q80 26 160 4" fill="none" stroke="#fff" stroke-width="1.4"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const x = 6 + i * 19, y = 5 + Math.sin((i + .5) / 8 * Math.PI) * 9; return `<path d="M${x} ${y}h12l-6 10z" fill="${['#FF8A8A', '#FFD25A', '#7CCBFF', '#8EE07A', '#C59BFF'][i % 5]}"/>`; }).join('')}
        <path d="M0 76Q80 68 160 76V100H0z" fill="url(#${u}f)"/><path d="M8 90Q80 82 152 90" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/>
        <rect x="50" y="72" width="60" height="16" rx="5" fill="#E9D7B2"/><rect x="50" y="72" width="60" height="5" rx="2.5" fill="#F7EBD3"/>
        ${arm(60, 58, true, '#2F7BEA', true)}${arm(100, 58, false, '#FDFDFF', false)}
        ${toyImage('bear', 52, 22, 56, 56)}
        <g transform="translate(116 18)"><rect width="38" height="20" rx="9" fill="#fff"/><path d="M8 18l-4 8 10-7z" fill="#fff"/><text x="19" y="14" font-size="10" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#2F7BEA">청기↑</text></g></svg>`;
    },
    help:[
      ['명령을 봐요', '진행자가 "청기 올려", "백기 내려"처럼 명령해요. 말풍선의 글자와 그림(깃발·화살표)을 보고 판단해요. 소리가 없어도 똑같이 할 수 있어요.'],
      ['버튼으로 깃발을', '왼쪽 파란 버튼은 청기, 오른쪽 흰 버튼은 백기예요. ▲는 올리기, ▼는 내리기. 말풍선 아래 막대가 다 줄어들기 전에 눌러요.'],
      ['가만히도 정답', '이미 올라간 깃발을 또 "올려"라고 하거나 "~하지 마"라고 하면 아무것도 누르지 않는 게 정답이에요. 시키지 않은 버튼을 누르면 바로 오답!'],
      ['기회 3번', '틀리거나 늦으면 기회 별이 하나 줄어요. 끝까지 버티면 성공, 정확하고 빠를수록 점수가 높아요.']
    ],
    helpExtra(){ const m = G && G.id === 'flag' && G.fl; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['운동회 마당', '깃발 학교', '바람 언덕', '반대 나라', '깃발 왕국'],
    starRule:'★ 끝까지 버티기 · ★★ 한 번만 틀리기 · ★★★ 하나도 안 틀리기',
    levels:{
      easy:{ cnt:20, w0:2.6, w1:2.0, trap:.15, neg:true, both:false, bothP:0, limit:0 },
      normal:{ cnt:25, w0:2.2, w1:1.5, trap:.25, neg:true, both:true, bothP:.15, limit:0 },
      hard:{ cnt:30, w0:1.9, w1:1.2, trap:.35, neg:true, both:true, bothP:.22, flip:true, flipEp:1, limit:0 }
    },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `명령 ${c.cnt}개 · 판단 ${c.w0}→${c.w1}초`; },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `명령 ${c.cnt}개 · 판단 ${c.w0}→${c.w1}초 · 함정 ${Math.round(c.trap * 100)}%${c.lives < 3 ? ' · 기회 ' + c.lives + '번' : ''}`; },
    init(cfg, rng){
      const seq = gen(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      const lives = G.duel ? 3 : cfg.lives || 3;
      G.fl = { seq, N:cfg.cnt, third:!!cfg.third, both:!!cfg.both, mimic:!!cfg.mimic, host:cfg.host || 'bear', theme:cfg.theme || 0, boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips,
        pos:-1, cur:null, phase:'ready', until:cfg.boss ? 1.6 : 1.1, t0:0, my:{ b:0, w:0, y:0 }, tgtNow:{ b:0, w:0, y:0 }, prevTgt:{ b:0, w:0, y:0 }, flipOn:false,
        res:[], ok:0, miss:0, combo:0, best:0, lives, livesMax:lives, taps:[], lockUntil:0, lvl:'', hurry:false, sec:0, avg:0, bestPrev:0, timers:new Set(), moodT:{} };
      G.limit = 0; G.paws = lives;
      const m = G.fl;
      G.cleanup = () => {
        m.timers.forEach(clearTimeout); m.timers.clear(); Object.values(m.moodT).forEach(clearTimeout);
        if(m.onResize) removeEventListener('resize', m.onResize);
        if(m.onKey) removeEventListener('keydown', m.onKey);
        if(G && G.raf) cancelAnimationFrame(G.raf);
        hush();
      };
    },
    /* 테스트·도구용 */
    _gen:gen, _stage:stageCfg,
    _state(){ const m = G && G.fl; if(!m) return null; return { phase:m.phase, pos:m.pos, cur:m.cur, my:Object.assign({}, m.my), lives:m.lives, ok:m.ok, res:m.res.length, last:m.res[m.res.length - 1] || null, until:m.until, t0:m.t0, N:m.N, third:m.third, flipOn:m.flipOn }; },
    _press(f, d){ press(f, d, 'test'); },
    _tick(){ tick(); }, _wrongGap:WRONG_GAP,
    render(st){
      const m = S(), th = THEME[m.theme] || THEME[0];
      st.innerHTML = `<div class="ng-flag${m.third ? ' third' : ''}${m.flipOn ? ' flipped' : ''}${m.boss ? ' boss' : ''}" style="--sky1:${th.sky[0]};--sky2:${th.sky[1]};--fd1:${th.field[0]};--fd2:${th.field[1]}">${DEFS_SVG}
        <div class="hud-row">
          <div class="hchip" id="flProgP" aria-label="한 명령 수"><span class="hv">${ICO.flag}<b id="flProg">0</b><small>/${m.N}</small></span><em>명령</em></div>
          <div class="hchip" id="flComboP" aria-label="연속 정답"><span class="hv">${ICO.fire}<b id="flCombo">0</b></span><em>연속 정답</em></div>
          <div class="hchip fl-lifechip" id="flLifeP"><span class="hv hlives" id="flLives" role="img"></span><em>기회</em></div>
        </div>
        <div class="fl-scene" id="flScene">
          ${decoSvg(m.theme)}
          <div class="fl-cloud c1"></div><div class="fl-cloud c2"></div>
          <div class="fl-field"></div>
          <div class="fl-podium"><svg class="fl-skirt" viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M${i * 15} 0h15l-7.5 13z" fill="${th.pen[i % th.pen.length]}"/>`).join('')}</svg><i class="fl-emb" aria-hidden="true">${flagIco('b')}${flagIco('w')}</i></div>
          ${rigHtml(m.host, 'host', m.third, 'flHost')}
          <img class="fl-rac" id="flRac" src="${raccoonSrc()}" alt="" aria-hidden="true" draggable="false">
          <div class="fl-card" id="flCard" aria-hidden="true"></div>
          <div class="fl-bub" id="flBub" role="status" aria-live="assertive">
            <div class="fl-who" id="flWho">${whoHtml(m.host)}</div>
            ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="fl-rules" aria-label="켜진 규칙">${m.boss ? '<span class="fl-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="fl-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="fl-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
            <div class="fl-cmd" id="flCmd"><span class="fl-cardt">${m.boss ? '보스 판!' : '준비~'}</span></div>
            <div class="fl-foot"><div class="fl-win" id="flWinW"><i id="flWin"></i></div><div class="fl-res info" id="flRes">${m.boss ? '끝까지 집중!' : talk(m.host, 'ready')}</div></div>
            <div class="fl-stamp" id="flStamp" aria-hidden="true"></div>
            <span class="fl-flipb" aria-hidden="true">반대로!</span>
          </div>
          ${m.boss ? '<div class="fl-bossband" aria-hidden="true"><b>보스!</b></div>' : ''}
          <div class="fl-note" id="flNote" aria-hidden="true"></div>
        </div>
        <div class="fl-deck${m.third ? ' third' : ''}">
          <div class="fl-me">${rigHtml('fox', 'me', m.third, 'flMe')}<span class="fl-metag">나</span></div>
          ${flagsOf(m).map(f => [1, 0].map(d => `<button class="fl-btn ${f} ${d ? 'up' : 'dn'}" data-f="${f}" data-d="${d}" style="grid-area:${f}${d ? 'u' : 'd'}" aria-label="${FN[f]} ${d ? '올리기' : '내리기'}"><span class="fl-bi">${flagIco(f)}${badge(!!d)}</span><span class="fl-bl">${FN[f]} ${d ? '올려' : '내려'}</span><i class="fl-lamp" aria-hidden="true"></i></button>`).join('')).join('')}
        </div>
        <div class="fl-edge" id="flEdge" aria-hidden="true"></div>
        <div class="fl-frame" aria-hidden="true"></div>
      </div>`;
      document.querySelectorAll('.ng-flag .fl-btn').forEach(b => {   /* 누르고 있는 동안 .down(눌린 모양), 키보드·밀기는 .hit 잠깐 */
        const up = () => b.classList.remove('down');
        let lp = -1, lt = -1e9;   /* 같은 손가락(pointerId)의 겹친 pointerdown(일부 기기)이 두 번 누르기로 세지 않게 */
        b.onpointerdown = e => { e.preventDefault(); b.classList.add('down'); const now = performance.now(); if(e.pointerId === lp && now - lt < 60) return; lp = e.pointerId; lt = now; press(b.dataset.f, +b.dataset.d, 'btn'); };
        b.onpointerup = up; b.onpointercancel = up; b.onpointerleave = up;
        b.onclick = e => { if(e.detail === 0) press(b.dataset.f, +b.dataset.d, 'btn'); };
      });
      swipeBind($('#flScene'));
      poseRig('flHost', m.tgtNow); poseRig('flMe', m.my); lamps(); hud(); layout();
      if(m.boss && m.phase === 'ready') moodOf('flHost', m.host, 'wow', 1500);
      if(m.boss && m.phase === 'ready') safe(() => sfx('flagBoss'));
      if(m.onResize) removeEventListener('resize', m.onResize);
      m.onResize = () => layout(); addEventListener('resize', m.onResize);
      if(m.onKey) removeEventListener('keydown', m.onKey);
      m.onKey = onKey; addEventListener('keydown', m.onKey);
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.fl; return m && m.N ? m.res.length / m.N : 0; },
    lossText(){ const m = G.fl; return `명령 ${m.N}개 중 ${m.res.length}개까지 했어요 · 정답 ${m.ok}개.`; },
    score(){
      const m = G.fl, n = m.res.length;
      const base = Math.round(500 * m.ok / m.N);
      const time = n ? Math.round(350 * m.res.reduce((s, r) => s + (r.ok ? (r.stay ? 1 : r.frac) : 0), 0) / n) : 0;
      const rts = m.res.filter(r => r.ok && !r.stay).map(r => r.rt), avg = m.avg || (rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0);
      const best = m.bestPrev ? Math.min(m.bestPrev, avg || m.bestPrev) : 0;
      return { base, time, extra:50 * m.lives, rows:[`정답 ${m.ok}/${m.N}`, `판단 속도 보너스 (평균 ${avg.toFixed(2)}초${best ? ' · 내 최고 ' + best.toFixed(2) + '초' : ''})`, `남은 기회 ${m.lives}개`] };
    },
    stars(){ const k = G.fl.miss; return k === 0 ? 3 : k === 1 ? 2 : 1; },
    sounds:{
      flagCmd(){ aBell({ f:m2f(88), d:.35, v:.06, idx:1.1, rev:.25 }); aTone({ f:m2f(76), type:'triangle', d:.08, v:.05, bus:'ui' }); },
      flagMimic(){ aTone({ f:700, f2:1100, type:'triangle', d:.12, v:.05 }); aTone({ f:1100, f2:760, type:'triangle', t:.1, d:.14, v:.045 }); },
      flagSwish(o){ aWhoosh({ f:600, f2:2600, a:.01, d:.13, v:.045, pan:o.pan }); },
      flagOk(o){ const n = Math.min(14, o.n || 0); aBell({ f:penta(n + 2, 72), d:.5, v:.09, idx:1.3, rev:.3 }); aMarimba(penta(n + 4, 72), { t:.05, v:.08 }); },
      flagStay(){ aMarimba(penta(4, 72), { v:.1 }); aMarimba(penta(7, 72), { t:.09, v:.1 }); aSparkle({ root:86, n:2, t:.12, v:.025 }); },
      flagBad(){ aTone({ f:233, f2:150, type:'square', lp:900, d:.24, v:.07 }); aThump({ f:130, f2:60, d:.18, v:.14 }); },
      flagSlow(){ aTone({ f:330, type:'triangle', d:.1, v:.05, bus:'ui' }); aTone({ f:262, type:'triangle', t:.1, d:.14, v:.05, bus:'ui' }); },
      flagCard(o){ aWhoosh({ f:400, f2:2200, a:.04, d:.3, v:.05 }); const s = o.flip ? [79, 74, 67] : [67, 74, 79]; s.forEach((mm, i) => aBrass(m2f(mm), { t:.06 + i * .08, d:.22, v:.05 })); },
      flagCombo(o){ const r = o.n >= 20 ? 79 : o.n >= 10 ? 76 : 72; [0, 4, 7, 12].forEach((d, i) => aBrass(m2f(r + d), { t:i * .07, d:.2, v:.045 })); aSparkle({ root:r + 12, n:4, t:.3, v:.03 }); },
      flagBoss(){ aThump({ f:90, f2:45, d:.5, v:.2 }); [55, 58, 62].forEach((mm, i) => aBrass(m2f(mm + 12), { t:.1 + i * .12, d:.3, v:.06 })); },
      flagLose(){ aTone({ f:392, f2:196, type:'triangle', d:.55, v:.08 }); aThump({ f:110, f2:45, t:.1, d:.35, v:.18 }); }
    },
    gate:{ flagSwish:40, flagCmd:100, flagSlow:300, flagBad:80 },
    jingle(){ [0, 2, 4, 7, 9, 12].forEach((d, i) => aMarimba(penta(d + 2, 72), { t:i * .07, v:.15 })); [84, 88, 91, 96].forEach((mm, i) => aBell({ f:m2f(mm), t:.5 + i * .04, d:1.1, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.6, n:6 }); }
  };
})();

/* 대전: 같은 명령을 동시에 · 끝났을 때 점수가 높은 쪽 승. AI 상대 평균 시간·성공률(duelPace), 상대에게 보내는 수치(duelStat) */
Object.assign(NG.flag, {
  duelPace:[55, .75],
  duelKind:'score', duelEnd:'all',
  /* 대전은 점수전(모두 끝까지, 점수 순): 막대 값 = 지금까지 점수(결과 창과 같은 식, 남은 기회 점수는 진행만큼) */
  duelStat:{ unit:'점', score:true, lfMax:3, get:() => {
    let v = 0; try{ const q = NG.flag.score(), pr = Math.max(0, Math.min(1, NG.flag.progress() || 0)); v = Math.round((q.base + q.time + q.extra * pr) * ((G.L && G.L.mult) || 1)); }catch(_){}
    return { v, t:100, lf:G.fl.lives, mis:(G.fl.res || []).filter(r => !r.ok).length };
  } },
  duelHow:'같은 명령 · 끝났을 때 점수가 높은 쪽이 이겨요'
});
/* 움직이는 배경(core/scene.js): 보이기만 하고 게임·대전에는 영향 없음. 눈이 편하게 적고 느리게 */
NG.flag.scene = { kind:'motes', colors:['#FFFFFF', '#FFF3B0', '#CFE9FF'], density:.45, alpha:.7 };
