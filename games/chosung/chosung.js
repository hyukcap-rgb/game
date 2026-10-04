/* 초성게임 */
/* ===== 초성게임 (chosung) · 하루퍼즐 리그 게임 모듈 =====
   초성(예: ㅅㄱ)과 분류(과일·동물·나라…)를 보고 낱말을 떠올려 입력한다. 한 판 = 문제 여러 개.
   같은 분류·같은 초성인 사전 낱말은 모두 정답(사전 = chosung-words.js). 문제는 rng로만 뽑는다.
   그림은 전부 직접 그린 오리지널 SVG(굵은 외곽선 #1A0F45 + 밝은 색). */
NG.chosung = (() => {
  const OL = '#1A0F45';
  /* ----- 한글 자모: 글자 → 초성 ----- */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const choCh = c => { const x = c.charCodeAt(0) - 0xAC00; return x >= 0 && x < 11172 ? CHO[Math.floor(x / 588)] : c; };
  const choOf = s => Array.from(s, choCh).join('');
  const norm = s => String(s || '').replace(/[^가-힣ㄱ-ㅎ]/g, '');   /* 띄어쓰기·문장부호 빼고 비교 */

  /* ----- 사전 준비(처음 한 번): 분류별 낱말, 분류·초성 색인, 전체 초성 색인(비밀 분류용) ----- */
  let D = null;
  function dict(){
    if(D) return D;
    const cats = [], byKey = {}, byCC = {}, allCho = {};
    for(const [key, name, col, easy] of CHOSUNG_CATS){
      const special = key === 'saying' || key === 'idiom';
      const raw = (CHOSUNG_WORDS[key] || '').split(special ? '/' : ' ').map(x => x.trim()).filter(Boolean);
      const seen = new Set(), words = [];
      for(const w of raw){
        const n = norm(w); if(n.length < 2 || seen.has(n)) continue; seen.add(n);   /* 한 글자 낱말·겹친 낱말은 뺀다 */
        const o = { w, n, cho:choOf(n), len:n.length, cat:key };
        words.push(o);
        (byCC[key + ':' + o.cho] = byCC[key + ':' + o.cho] || []).push(o);
        if(!special) (allCho[o.cho] = allCho[o.cho] || []).push(o);
      }
      const c = { key, name, col, easy:!!easy, special, words };
      cats.push(c); byKey[key] = c;
    }
    D = { cats, byKey, byCC, allCho };
    return D;
  }
  const uniqN = list => list.map(o => o.n).filter((x, i, a) => a.indexOf(x) === i);

  /* ----- 개념 사이클(난이도 v2): 새 규칙 11·21·31·41, 변주 6·16·26·36·46 ----- */
  const CONC = {
    order:['long', 'hidecat', 'blank', 'saying'],
    info:{
      long:{ name:'긴 낱말', desc:'세 글자·네 글자 낱말만 나와요. 초성이 길수록 떠올릴 실마리도 많아요.' },
      hidecat:{ name:'비밀 분류', desc:'분류가 가려져요! 초성만 보고 떠오르는 낱말을 써요. 어느 분류의 낱말이든 맞으면 정답이에요.' },
      blank:{ name:'빈 초성', desc:'초성 하나가 ?로 가려져요. 남은 초성과 분류로 낱말을 떠올려요.' },
      saying:{ name:'속담·사자성어', desc:'속담과 사자성어가 섞여 나와요. 띄어쓰기는 안 해도 돼요.' }
    },
    twists:['flash', 'bare', 'tight', 'first', 'tick'],
    twInfo:{
      flash:{ name:'번개', desc:'제한 시간이 아주 짧아요. 떠오르면 바로 쓰세요!' },
      bare:{ name:'맨손', desc:'힌트 없이, 건너뛰기는 딱 한 번! 오직 머릿속 사전으로 풀어요.' },
      tight:{ name:'외줄 타기', desc:'초성이나 분류가 틀린 답을 두 번 내면 끝나요. 신중하게!' },
      first:{ name:'첫 글자 선물', desc:'모든 문제의 첫 글자가 열려 있어요. 대신 시간이 아주 짧아요.' },
      tick:{ name:'째깍 벌칙', desc:'틀린 답을 낼 때마다 남은 시간이 3초씩 줄어요.' }
    }
  };
  const RULE_TIP = { long:'세·네 글자', hidecat:'분류 비밀', blank:'? = 가린 초성', saying:'속담·사자성어', flash:'시간이 짧아요', bare:'힌트 없음', tight:'두 번 틀리면 끝', first:'첫 글자 열림', tick:'틀리면 −3초' };
  const TICK_SEC = 3, LIVES_TIGHT = 2;

  /* ----- 솔로 난이도 표 -----
     문제 수 = 챕터 1은 LT.ch1[k−1], 챕터 2~는 LT.base[c] + LT.kOff[k].
     제한 시간 = 문제 × LT.spq[c] × kTime[k] × 규칙·변주 배수 (사람 기준 한 문제 약 8~12초 + 여유) */
  const LT = {
    ch1:[6, 6, 7, 7, 8, 6, 7, 8, 6, 9],
    base:[0, 0, 8, 9, 10, 10, 11],
    kOff:[0, -2, -1, 0, 0, 2, -1, 0, 1, -2, 2],
    spq:[0, 17, 16, 15, 14.5, 14, 13.5],
    kTime:[0, 1.15, 1.05, 1.0, 1.0, 0.9, 1.1, 1.0, 1.0, 1.1, 0.85],
    mjTime:{ long:1.05, hidecat:1.1, blank:1.15, saying:1.3 },
    twTime:{ flash:0.7, bare:1.1, tight:1.0, first:0.55, tick:1.05 }
  };
  function stageCfg(n){
    const p = planOf('chosung', n), c = p.c, k = p.k, mj = p.mj || [], tw = p.tw, has = x => mj.includes(x);
    let q = c === 1 ? LT.ch1[k - 1] : LT.base[Math.min(c, LT.base.length - 1)] + LT.kOff[k];
    q = Math.max(5, Math.min(14, q));
    const easyCats = c === 1;
    let minLen = 2, maxLen = c === 1 && k <= 4 ? 3 : 4;
    if(has('long') || has('blank')) minLen = 3;
    const maxCand = p.boss ? 2 : p.hard ? 3 : p.easy ? 6 : 4;
    const say = has('saying') ? Math.max(2, Math.round(q * (k === 1 ? .3 : .4))) : 0;
    const hide = has('hidecat') ? (has('blank') ? Math.floor((q - say) / 2) : q) : 0;   /* 빈 초성과 함께면 절반만 비밀 분류 */
    const blank = has('blank') ? Math.ceil((q - say) * .7) : 0;
    let limit = q * LT.spq[Math.min(c, LT.spq.length - 1)] * LT.kTime[k];
    mj.forEach(x => { limit *= LT.mjTime[x] || 1; });
    if(tw) limit *= LT.twTime[tw] || 1;
    limit = Math.max(40, Math.round(limit / 5) * 5);
    const hints = tw === 'bare' ? 0 : p.boss ? 3 : 4, skips = tw === 'bare' ? 1 : c === 1 ? 3 : 2;
    return { q, minLen, maxLen, easy:easyCats ? 1 : 0, maxCand, say, hide, blank, first:tw === 'first', limit, hints, skips,
      lives:tw === 'tight' ? LIVES_TIGHT : 0, tick:tw === 'tick' ? TICK_SEC : 0, boss:p.boss, hard:p.hard, mj:mj.slice(), tw, n };
  }

  /* ===== 문제 세트 만들기(rng만): 같은 판에 같은 낱말·같은 (분류, 초성) 금지, 정답 후보가 너무 많은 초성은 피한다 ===== */
  function makeSet(cfg, rng){
    const d = dict(), q = cfg.q, say = Math.min(cfg.say || 0, q - 1), reg = q - say;
    const usedW = new Set(), usedCC = new Set(), perCat = {}, cap = Math.max(2, Math.ceil(reg / 4));
    const pool = shuffle(d.cats.filter(c => !c.special && (!cfg.easy || c.easy)).flatMap(c => c.words).filter(o => o.len >= (cfg.minLen || 2) && o.len <= (cfg.maxLen || 4)), rng);
    const out = [];
    const cands = (o, hide) => hide ? d.allCho[o.cho] : d.byCC[o.cat + ':' + o.cho];
    /* 두 번 훑는다: 처음엔 엄격하게(후보 수·분류 고르게·같은 분류 연달아 금지), 모자라면 너그럽게 */
    for(let pass = 0; pass < 3 && out.length < reg; pass++){
      const maxC = pass === 0 ? cfg.maxCand || 4 : pass === 1 ? (cfg.maxCand || 4) + 3 : 99;
      for(const o of pool){
        if(out.length >= reg) break;
        const cc = o.cat + ':' + o.cho;
        if(usedW.has(o.n) || usedCC.has(cc)) continue;
        const hide = out.length < (cfg.hide || 0);
        if(hide && out.some(x => x.cho === o.cho)) continue;
        const cs = cands(o, hide);
        if(cs.length > maxC || cs.some(x => usedW.has(x.n))) continue;   /* 한 낱말이 두 문제의 정답이 되지 않게 */
        if(pass === 0 && ((perCat[o.cat] || 0) >= cap || (out.length && out[out.length - 1].cat === o.cat))) continue;
        out.push(o); cs.forEach(x => usedW.add(x.n)); usedCC.add(cc); perCat[o.cat] = (perCat[o.cat] || 0) + 1;
      }
    }
    /* 문제 모양: 분류 숨김(hide) · 빈 초성(blank) · 정답 목록(ans) */
    const qs = out.map((o, i) => {
      const hide = i < (cfg.hide || 0);
      return { cat:o.cat, w:o.w, n:o.n, cho:o.cho, hide, blank:-1, ans:uniqN(cands(o, hide)) };
    });
    shuffle(qs, rng);
    /* 빈 초성: 3글자 이상 문제 중 앞에서부터 blank개, 가린 자리로도 후보가 너무 많아지지 않는 곳 */
    let nb = cfg.blank || 0;
    for(const p of qs){
      if(nb <= 0) break;
      if(p.hide || p.n.length < 3) continue;
      const list = d.byKey[p.cat].words.filter(o => o.len === p.n.length);
      const opts = shuffle(Array.from({ length:p.n.length }, (_, i) => i), rng);
      for(const b of opts){
        const m = list.filter(o => [...o.cho].every((ch, i) => i === b || ch === p.cho[i]));
        if(m.some(o => !p.ans.includes(o.n) && usedW.has(o.n))) continue;   /* 다른 문제의 정답과 겹치면 다른 자리 */
        if(m.length <= (cfg.maxCand || 4) + 2){ m.forEach(o => usedW.add(o.n)); p.blank = b; p.ans = uniqN(m); nb--; break; }
      }
    }
    /* 속담·사자성어: 사자성어와 속담을 번갈아, 너무 긴 속담(12글자 이상)은 빼고 고르게 끼워 넣는다 */
    if(say > 0){
      const id = shuffle(d.byKey.idiom.words.slice(), rng), sy = shuffle(d.byKey.saying.words.filter(o => o.len <= 11), rng);
      for(let s = 0; s < say; s++){
        const src = s % 2 === 0 ? id : sy, o = src[Math.floor(s / 2)] || id[s];
        const pq = { cat:o.cat, w:o.w, n:o.n, cho:o.cho, hide:false, blank:-1, ans:[o.n], say:true };
        const at = Math.min(qs.length, Math.round((s + 1) * q / (say + 1)));
        qs.splice(at, 0, pq);
      }
    }
    /* 첫 글자 선물: 첫 글자를 열어 둔다 */
    qs.forEach(p => { p.open = new Set(cfg.first ? [0] : []); });
    return qs;
  }

  /* ===== 화면·상태 ===== */
  const S = () => G.m;
  const T = (fn, ms) => { const m = G.m, id = setTimeout(() => { m.timers.delete(id); if(G && G.m === m && !G.over) fn(); }, ms); m.timers.add(id); return id; };
  const ICO = {
    q:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="#FFF8EA" stroke="#1A0F45" stroke-width="1.8"/><path d="M7.5 8.5h5v6M14.5 8.5v7" fill="none" stroke="#6C5CE7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="#1A0F45" stroke-width="1.8"/><circle cx="12" cy="13.5" r="6" fill="#FFF8EA"/><rect x="10" y="1.8" width="4" height="3" rx="1" fill="#1A0F45"/><path d="M12 9.8v3.9l2.6 1.6" stroke="#1A0F45" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-4 12.8V18h8v-2.7A7 7 0 0 0 12 2.5z" fill="#FFE27A" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21h6" stroke="#1A0F45" stroke-width="2" stroke-linecap="round"/><path d="M9.5 8a3 3 0 0 1 2.5-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    skip:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5v13l8-6.5zM12 5.5v13l8-6.5z" fill="#7CCBFF" stroke="#1A0F45" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };

  function hud(){
    const m = S(); if(!m) return;
    const f = $('#csNo'); if(f) f.textContent = Math.min(m.i + 1, m.q);
    const h = $('#csHint'); if(h){ h.querySelector('b').textContent = m.hintLeft; h.disabled = m.hintLeft <= 0 || !canHint(); }
    const k = $('#csSkip'); if(k){ k.querySelector('b').textContent = m.skipLeft; k.disabled = m.skipLeft <= 0; }
    const lv = $('#csLives');
    if(lv){ if(!m.lives) lv.hidden = true; else { const left = Math.max(0, m.lives - m.wrongs); lv.hidden = false; lv.innerHTML = '기회 ' + Array.from({ length:m.lives }, (_, n) => `<i${n >= left ? ' class="off"' : ''}>★</i>`).join(''); lv.setAttribute('aria-label', '남은 기회 ' + left + '번'); } }
    const dots = $('#csDots');
    if(dots) dots.innerHTML = m.qs.map((p, n) => `<i class="${p.res === 'ok' ? 'ok' : p.res === 'skip' ? 'sk' : n === m.i ? 'now' : ''}"></i>`).join('');
  }
  function msg(html, cls){ const e = $('#csMsg'); if(!e) return; e.className = 'cs-msg ' + (cls || ''); e.innerHTML = html; }
  function baseMsg(){
    const m = S(), p = m.qs[m.i]; if(!p) return '';
    if(p.say) return '<span>띄어쓰기는 안 해도 돼요</span>';
    if(p.hide) return '<span>어느 분류든 이 초성이면 정답!</span>';
    const n = valid(p).length;
    return n > 1 ? `<span>정답 ${n}개 중 <b class="k">하나만</b> 맞히면 돼요</span>` : '<span>낱말을 떠올려 써 보세요</span>';
  }
  /* 지금 열린 글자와 맞는 정답만 */
  const valid = p => p.ans.filter(a => [...p.open].every(i => a[i] === p.n[i]));
  const canHint = () => { const m = S(), p = m && m.qs[m.i]; return !!p && p.open.size < p.n.length - 1; };

  /* 글자 칸 그리기: 띄어쓰기 단위로 묶어 줄바꿈(속담) */
  function tilesHtml(p, show, cls){
    const words = p.w.split(' ');
    /* 칸 크기: 한 줄(약 330px)에 들어가게, 너무 작아지면(34px 미만) 띄어쓰기 단위로 줄바꿈 */
    const n = p.n.length, gaps = (n - words.length) * 5 + (words.length - 1) * 14;
    const sz = Math.max(34, Math.min(70, Math.floor((330 - gaps) / n)));
    let idx = 0;
    return `<div class="cs-tiles ${cls || ''}" style="--ts:${sz}px">${words.map(wd => `<span class="cs-wd">${Array.from(wd).map(() => {
      const i = idx++, open = show != null || p.open.has(i), ch = show != null ? show[i] : p.n[i];
      const face = open ? ch : i === p.blank ? '?' : p.cho[i];
      return `<span class="cs-t${open ? ' open' : ''}${!open && i === p.blank ? ' blank' : ''}" style="--d:${i * 40}ms">${face}</span>`;
    }).join('')}</span>`).join('')}</div>`;
  }
  function cardHtml(){
    const m = S(), p = m.qs[m.i], c = dict().byKey[p.cat];
    const chip = p.hide ? '<span class="cs-cat hide">분류 ?</span>' : `<span class="cs-cat" style="--cc:${c.col}">${c.name}</span>`;
    return `<div class="cs-top">${chip}<span class="cs-len">${p.n.length}글자</span></div>${tilesHtml(p)}`;
  }
  function showQ(){
    const m = S(), card = $('#csCard'); if(!card) return;
    card.innerHTML = cardHtml(); card.classList.remove('ok', 'skip'); card.classList.add('in');
    T(() => card.classList.remove('in'), 450);
    m.lock = false; hud(); msg(baseMsg());
    const inp = $('#csIn'); if(inp){ inp.value = ''; inp.disabled = false; }
  }

  /* ===== 답 내기 ===== */
  function submit(){
    const m = S(), inp = $('#csIn');
    if(!m || G.over || G.paused || m.lock || m.phase !== 'play' || !inp) return;
    if(G.duel && !G.duel.go) return;
    const v = norm(inp.value); if(!v) return;
    const p = m.qs[m.i], ok = valid(p);
    if(ok.includes(v)){ correct(v); return; }
    /* 틀림: 초성이 같으면 "사전에 없음"(벌칙 없음), 다르면 진짜 실수 */
    const vc = choOf(v), same = vc.length === p.cho.length && [...vc].every((ch, i) => i === p.blank || ch === p.cho[i]);
    const card = $('#csCard');
    if(card){ try{ fxShake(card, 5); }catch(_){} card.classList.remove('bad'); void card.offsetWidth; card.classList.add('bad'); }
    sfx('chosungBad'); try{ fxBuzz(20); }catch(_){}
    let hard = !same, why;
    if(same){
      const other = !p.hide && !p.say && (dict().allCho[p.cho] || []).find(o => o.n === v);
      if(other){ why = `${dict().byKey[other.cat].name} 분류의 낱말이에요`; hard = true; }
      else if(p.ans.includes(v)) why = '열린 글자와 달라요';
      else why = '이 사전에는 없는 낱말이에요';
    } else why = vc.length !== p.cho.length ? `${p.n.length}글자 낱말이에요` : '초성이 달라요';
    if(hard){
      m.wrongs++;
      if(m.tick){ m.pen += m.tick; const tp = $('#csTimeP'); if(tp){ try{ const q = fxCenter(tp); fxFloat(q.x, q.y + 30, '−' + m.tick + '초', 'bad'); }catch(_){} } }
    }
    msg(`<b class="bad">${hard ? '땡!' : '음…'}</b><span>${esc(why)}</span>`, 'cs-pop');
    inp.select && inp.select();
    hud();
    T(() => { if(card) card.classList.remove('bad'); }, 500);
    if(hard && m.lives && m.wrongs >= m.lives){ lose('기회를 다 썼어요', 'miss'); return; }
  }
  function clearInput(){
    const inp = $('#csIn'); if(!inp) return;
    inp.value = ''; S().clearUntil = Date.now() + 350;   /* 한글 조합 중이던 글자가 늦게 들어오면 한 번 더 지운다 */
  }
  function correct(v){
    const m = S(), p = m.qs[m.i];
    m.lock = true; p.res = 'ok'; p.got = v; m.solved++; m.combo++; m.best = Math.max(m.best, m.combo);
    const card = $('#csCard');
    if(card){ card.innerHTML = `<div class="cs-top"><span class="cs-cat ok">정답!</span><span class="cs-len">${m.combo >= 2 ? m.combo + '연속' : ''}</span></div>` + tilesHtml(p, v, 'flip'); card.classList.add('ok'); }
    clearInput();
    sfx('chosungOk', { n:m.combo - 1 }); try{ fxBuzz(12); }catch(_){}
    try{ if(card){ const q = fxCenter(card); fxBurst(q.x, q.y, ['#FFE27A', '#B9A6FF', '#FFFFFF', '#7CE0B0'], 16, { speed:260, size:5, kinds:['star','dot','spark'], up:120, g:440, glow:true, dur:.7 }); } if(m.combo >= 3) fxCombo(m.combo); }catch(_){}
    msg(`<b>딩동댕!</b><span>${esc(p.say ? p.w : v)}</span>`, 'cs-pop');
    hud();
    T(next, 700);
  }
  function useSkip(){
    const m = S(); if(!m || G.over || G.paused || m.lock || m.phase !== 'play' || m.skipLeft <= 0) return;
    if(G.duel && !G.duel.go) return;
    const p = m.qs[m.i];
    m.lock = true; m.skipLeft--; m.skipped++; m.combo = 0; p.res = 'skip';
    const card = $('#csCard');
    if(card){ card.innerHTML = `<div class="cs-top"><span class="cs-cat sk">건너뜀</span><span class="cs-len">정답</span></div>` + tilesHtml(p, p.n, 'flip'); card.classList.add('skip'); }
    clearInput(); sfx('chosungSkip');
    msg(`<b class="sk">정답은</b><span>${esc(p.w)}</span>`, 'cs-pop');
    hud();
    T(next, 1200);
  }
  function useHint(){
    const m = S(); if(!m || G.over || G.paused || m.lock || m.phase !== 'play' || m.hintLeft <= 0 || !canHint()) return;
    if(G.duel && !G.duel.go) return;
    const p = m.qs[m.i];
    let i = 0; while(p.open.has(i)) i++;   /* 앞에서부터 한 글자 */
    p.open.add(i); m.hintLeft--; m.hints++;
    const card = $('#csCard'); if(card) card.innerHTML = cardHtml();
    const t = card && card.querySelectorAll('.cs-t')[i];
    if(t){ t.classList.add('pop'); try{ const q = fxCenter(t); fxBurst(q.x, q.y, ['#FFE27A', '#FFFFFF'], 8, { speed:160, size:4, kinds:['star','dot'], up:60, g:300, dur:.5 }); }catch(_){} }
    sfx('chosungHint'); hud(); msg(baseMsg());
    const inp = $('#csIn'); if(inp) inp.focus();
  }
  function next(){
    const m = S(); m.i++;
    if(m.i >= m.q){ win(); return; }
    showQ();
    const inp = $('#csIn'); if(inp && document.activeElement !== inp && !matchMedia('(pointer:coarse)').matches) inp.focus();
  }

  /* ===== 시계 ===== */
  const remTime = t => Math.max(0, G.limit - S().pen - t);
  function loop(){
    if(!G || !G.m || G.over) return;
    G.raf = requestAnimationFrame(loop);
    if(G.paused) return;
    const m = S(); if(m.phase !== 'play') return;
    const t = elapsed(), rem = remTime(t), sec = Math.ceil(rem), bar = $('#csBar');
    if(bar) bar.style.transform = `scaleX(${Math.min(1, rem / G.limit)})`;
    if(sec !== m.lastSec){
      m.lastSec = sec;
      const e = $('#csTime'); if(e) e.textContent = mmss(sec);
      const tp = $('#csTimeP'); if(tp) tp.classList.toggle('warn', sec <= 10);
      const bw = $('#csBarW'); if(bw) bw.classList.toggle('hurry', sec <= 10);
      if(sec <= 10 && sec > 0) sfx('chosungTick', { hi:sec <= 5 });
    }
    if(rem <= 0){ const e = $('#csTime'); if(e) e.textContent = '0:00'; lose('시간이 다 됐어요', 'time'); }
  }
  function win(){
    const m = S(); m.phase = 'done'; m.lock = true; m.sec = elapsed();
    const inp = $('#csIn'); if(inp){ inp.disabled = true; inp.blur(); }
    msg('<b>모두 풀었어요!</b>', 'cs-win');
    try{ const c = $('#csCard'); if(c){ const p = fxCenter(c); fxRing(p.x, p.y, '#FFE27A', p.w * .7, .7, 12); } }catch(_){}
    T(() => finish(true), 900);
  }
  function lose(text, why){
    const m = S(); if(m.phase !== 'play') return;
    m.phase = 'done'; m.lock = true; m.fail = why;
    const inp = $('#csIn'); if(inp){ inp.disabled = true; inp.blur(); }
    const p = m.qs[m.i];
    const card = $('#csCard'); if(card && p && !p.res){ card.innerHTML = `<div class="cs-top"><span class="cs-cat sk">정답</span></div>` + tilesHtml(p, p.n, 'flip'); card.classList.add('skip'); }
    msg(`<b class="bad">${text}</b><span>${m.solved}/${m.q}문제</span>`, 'cs-pop');
    sfx('chosungTimeUp'); try{ fxBuzz([40, 40, 60]); }catch(_){}
    T(() => finish(false), 1400);
  }

  /* 화면 맞춤(보이기만): 카드·입력 묶음을 남은 높이의 가운데~아래에 둔다. 화면 키보드가 올라오면(보이는 높이가 줄면) 빈칸을 없애 입력칸·카드가 보이게 */
  function fit(){
    try{
      const root = document.querySelector('.ng-chosung'); if(!root) return;
      const vv = window.visualViewport, vh = vv ? vv.height : innerHeight;
      const kb = vv && innerHeight - vv.height > 140;
      root.classList.toggle('kb', !!kb);
      const top = root.getBoundingClientRect().top + (window.scrollY || 0);
      root.style.minHeight = kb ? '' : Math.max(0, Math.floor(innerHeight - top - 20)) + 'px';
    }catch(_){}
  }
  function wire(){
    const m = S(), inp = $('#csIn');
    try{
      const on = () => { if(G && G.m === m) fit(); };
      const vv = window.visualViewport; if(vv) vv.addEventListener('resize', on); addEventListener('resize', on);
      const prev = G.cleanup; G.cleanup = () => { try{ if(vv) vv.removeEventListener('resize', on); removeEventListener('resize', on); }catch(_){} if(prev) prev(); };
    }catch(_){}
    if(inp){
      /* 한글 조합 중 Enter는 조합을 끝내는 키 → 바로 내지 않고, 조합이 끝난 뒤에 낸다 */
      inp.addEventListener('compositionstart', () => { m.composing = true; });
      inp.addEventListener('compositionend', () => {
        m.composing = false;
        if(m.clearUntil && Date.now() < m.clearUntil){ setTimeout(() => { inp.value = ''; }, 0); return; }
        if(m.enterWait){ m.enterWait = false; setTimeout(submit, 0); }
      });
      inp.addEventListener('keydown', e => {
        if(e.key !== 'Enter') return;
        e.preventDefault();
        if(e.isComposing || e.keyCode === 229){ m.enterWait = true; return; }
        submit();
      });
      inp.addEventListener('input', e => {
        if(m.clearUntil && Date.now() < m.clearUntil){ inp.value = ''; return; }
        /* 조합이 끝난 상태에서 정답과 똑같으면 바로 정답 처리(확인을 안 눌러도) */
        if(!e.isComposing && !m.composing && !m.lock){ const p = m.qs[m.i], v = norm(inp.value); if(p && v && valid(p).includes(v)) submit(); }
      });
      inp.addEventListener('focus', () => { setTimeout(() => { try{ if(G && G.m === m && matchMedia('(pointer:coarse)').matches) $('#csCard').scrollIntoView({ block:'start', behavior:'smooth' }); }catch(_){} }, 320); });
    }
    const go = $('#csGo'); if(go){ go.onpointerdown = e => e.preventDefault(); go.onclick = () => { submit(); const i = $('#csIn'); if(i) i.focus(); }; }   /* 누를 때 입력칸 포커스(화면 키보드)를 유지 */
    const h = $('#csHint'); if(h) h.onclick = useHint;
    const k = $('#csSkip'); if(k) k.onclick = useSkip;
    const c = $('#csCard'); if(c) c.onclick = () => { const i = $('#csIn'); if(i && !i.disabled) i.focus(); };
  }

  return {
    name:'초성게임', abil:'추리력', col:['#C9B8FF','#7B5CE6','#3E2A9A'], time:'약 3분',
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M6 7h4.5v6M13.5 7v6.5M13.5 10.5h4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    art(){
      const u = 'chosA' + Math.floor(performance.now() * 1000 % 1e6);
      const tile = (x, y, ch, col, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-17" y="-15" width="34" height="36" rx="8" fill="${col}" stroke="${OL}" stroke-width="2.4"/><rect x="-17" y="-18" width="34" height="34" rx="8" fill="#FFFDF4" stroke="${OL}" stroke-width="2.4"/><text x="0" y="8" font-size="24" font-weight="900" text-anchor="middle" fill="${OL}" font-family="sans-serif">${ch}</text></g>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${u}1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE6FF"/><stop offset="1" stop-color="#B9A6FF"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u}1)"/>
        <g fill="#fff" opacity=".5"><circle cx="12" cy="14" r="3"/><circle cx="148" cy="86" r="4"/><circle cx="144" cy="12" r="2.4"/><circle cx="20" cy="84" r="2"/></g>
        <rect x="44" y="10" width="72" height="16" rx="8" fill="#FF8FC8" stroke="${OL}" stroke-width="2.2"/><text x="80" y="22.5" font-size="11" font-weight="900" text-anchor="middle" fill="#fff" stroke="${OL}" stroke-width="2.6" paint-order="stroke" font-family="sans-serif">과일</text>
        ${tile(62, 56, 'ㅅ', '#9B7BFF', -6)}${tile(100, 56, 'ㄱ', '#9B7BFF', 5)}
        <g transform="translate(128 70) rotate(-20)"><circle r="11" fill="#E8F6FF" stroke="${OL}" stroke-width="3"/><path d="M8 8l9 9" stroke="${OL}" stroke-width="5" stroke-linecap="round"/><path d="M-5-3a6 6 0 0 1 5-5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/></g>
        <path d="M24 48l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#FFE27A" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    },
    help:[
      ['초성과 분류를 봐요', '예를 들어 분류가 「과일」, 초성이 ㅅㄱ이면 "사과"를 떠올릴 수 있어요. 같은 분류·같은 초성인 낱말은 무엇이든 정답이에요.'],
      ['써서 확인해요', '아래 칸에 낱말을 쓰고 [확인]이나 Enter를 눌러요. 틀려도 점수는 거의 깎이지 않아요(초성이 다르면 −5점).'],
      ['막히면 힌트·건너뛰기', '💡힌트는 앞에서부터 한 글자를 열어 줘요(−15점). 건너뛰면 그 문제는 0점이고 정답을 보여 줘요(판마다 횟수 제한).'],
      ['시간 안에 모두 풀어요', '제한 시간 안에 모든 문제를 풀면 성공! 빨리 풀수록 시간 보너스가 커요.'],
      ['솔로: 5판마다 새 규칙', '솔로에서는 긴 낱말·비밀 분류·빈 초성·속담 같은 새 규칙과 번개·첫 글자 선물 같은 변주가 5판마다 하나씩 나와요.']
    ],
    helpExtra(){ const m = G && G.id === 'chosung' && G.m; if(!m || !m.tips.length) return []; return [['이번 판 규칙', m.tips.join(' · ')]]; },
    chapters:['첫소리 마을','낱말 숲','수수께끼 다리','이야기 장터','말씨 궁전'],
    starRule:'★ 클리어 · ★★ 힌트·건너뛰기 2번 이하 · ★★★ 힌트·건너뛰기 없이',
    levels:{
      easy:{ q:8, minLen:2, maxLen:3, easy:1, maxCand:6, limit:150, hints:4, skips:3 },
      normal:{ q:10, minLen:2, maxLen:4, easy:0, maxCand:4, limit:180, hints:4, skips:3 },
      hard:{ q:12, minLen:3, maxLen:4, easy:0, maxCand:2, say:2, limit:240, hints:4, skips:3 }
    },
    concepts:CONC,
    stage(n){ return stageCfg(n); },
    stageDesc(n){ const c = stageCfg(n); return `${c.q}문제 · ${mmss(c.limit)}${c.lives ? ' · 기회 ' + c.lives + '번' : ''}`; },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${c.q}문제 · ${c.minLen}~${c.maxLen}글자${c.say ? ' · 사자성어·속담' : ''}`; },
    init(cfg, rng){
      const qs = makeSet(cfg, rng);
      const tips = [].concat(cfg.mj || [], cfg.tw ? [cfg.tw] : []).map(k => RULE_TIP[k]).filter(Boolean);
      G.m = { qs, q:qs.length, i:0, solved:0, skipped:0, hints:0, wrongs:0, combo:0, best:0, pen:0,
        hintLeft:cfg.hints == null ? 4 : cfg.hints, skipLeft:cfg.skips == null ? 3 : cfg.skips,
        lives:G.duel ? 0 : cfg.lives || 0, tick:cfg.tick || 0,   /* 대전은 기회 제한 없음 */
        phase:'play', lock:false, boss:!!cfg.boss, mj:cfg.mj || [], tw:cfg.tw || null, tips, lastSec:-1, sec:0, fail:null, timers:new Set() };
      G.limit = cfg.limit; if(G.m.lives) G.paws = G.m.lives;
      const m = G.m;
      G.cleanup = () => { m.timers.forEach(clearTimeout); m.timers.clear(); if(G && G.raf) cancelAnimationFrame(G.raf); document.querySelectorAll('.fxcombo').forEach(e => e.remove()); };
      /* 테스트·도구용: 남은 문제를 차례로 모두 맞힌다 */
      m._solveForTest = () => new Promise(res => {
        const step = () => {
          if(G.over || G.m !== m || m.phase === 'done'){ res(m.solved); return; }
          if(m.lock || (G.duel && !G.duel.go)){ setTimeout(step, 80); return; }
          const inp = $('#csIn'); inp.value = valid(m.qs[m.i])[0]; submit(); setTimeout(step, 80);
        };
        step();
      });
    },
    _solveForTest(){ return G.m._solveForTest(); },
    _make:makeSet, _stage:stageCfg, _dict:dict, _cho:choOf,
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-chosung">
        <div class="hud-row">
          <div class="hchip" aria-label="문제"><span class="hv">${ICO.q}<b id="csNo">1</b><small>/${m.q}</small></span><em>문제</em></div>
          <div class="hchip time" id="csTimeP" aria-label="남은 시간"><span class="hv">${ICO.clock}<b id="csTime">${mmss(G.limit)}</b></span><em>남은 시간</em></div>
          <button class="hchip item" id="csHint" aria-label="힌트: 한 글자 열기"><span class="hv">${ICO.hint}<b>${m.hintLeft}</b></span><em>힌트</em></button>
          <button class="hchip skip" id="csSkip" aria-label="건너뛰기"><span class="hv">${ICO.skip}<b>${m.skipLeft}</b></span><em>넘기기</em></button>
        </div>
        ${G.adv && (m.mj.length || m.tw || m.boss) ? `<div class="cs-rules" aria-label="켜진 규칙">${m.boss ? '<span class="cs-chip boss">보스</span>' : ''}${m.mj.map(k => `<span class="cs-chip mj">${CONC.info[k].name}</span>`).join('')}${m.tw ? `<span class="cs-chip tw">${CONC.twInfo[m.tw].name}</span>` : ''}</div>` : ''}
        <div class="cs-barw" id="csBarW"><i id="csBar"></i></div>
        <div class="cs-dots" id="csDots" aria-hidden="true"></div>
        <div class="cs-play" id="csPlay">
        <div class="cs-card" id="csCard" aria-live="polite"></div>
        <div class="cs-row"><div class="hlives" id="csLives" role="img" hidden></div><div class="cs-msg" id="csMsg"></div></div>
        <form class="cs-form" id="csForm" autocomplete="off" onsubmit="return false">
          <input class="cs-in" id="csIn" type="text" inputmode="text" lang="ko" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="24" placeholder="낱말을 써요" aria-label="답 쓰기">
          <button type="button" class="cs-go" id="csGo">확인</button>
        </form>
        </div>
      </div>`;
      fit();
      showQ(); wire(); hud();
      if(!matchMedia('(pointer:coarse)').matches){ const i = $('#csIn'); if(i) setTimeout(() => { if(G && G.m === m && !$('#veil').classList.contains('on')) i.focus(); }, 120); }
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m ? m.i / m.q : 0; },
    lossText(){ const m = G.m; return (m.fail === 'miss' ? '기회를 다 썼어요. ' : '') + `${m.q}문제 중 ${m.solved}문제를 맞혔어요.`; },
    score(){
      const m = G.m, sec = Math.max(0, Math.min(G.limit, (m.sec || elapsed()) + (m.pen || 0)));
      const base = Math.round(600 * m.solved / m.q);
      const time = Math.max(0, 250 - Math.floor(sec * 250 / G.limit));
      const extra = Math.max(0, 150 - 15 * m.hints - 5 * m.wrongs);
      return { base, time, extra, rows:[`맞힌 문제 ${m.solved}/${m.q}` + (m.skipped ? ` (건너뛰기 ${m.skipped})` : ''), '시간 보너스 (' + mmss(sec) + ')', `힌트 ${m.hints} · 틀림 ${m.wrongs}`] };
    },
    stars(){ const m = G.m, help = m.hints + m.skipped; return help === 0 ? 3 : help <= 2 ? 2 : 1; },
    css:`
body[data-mode="chosung"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),
  radial-gradient(circle at 20% 30%, rgba(255,255,255,.25) 0 3px, transparent 3.5px) 0 0/44px 44px,
  linear-gradient(180deg,#F1ECFF 0%,#D6CBFF 55%,#B9A6FF 100%) fixed}
.ng-chosung{position:relative; display:flex; flex-direction:column; align-items:center; width:100%}
.ng-chosung .cs-play{flex:1 0 auto; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px 0 5%}
.ng-chosung.kb .cs-play{justify-content:flex-start; padding:0}
.ng-chosung .hud-row{margin:0}
.ng-chosung .hchip.time.warn{background:linear-gradient(180deg,#FFE3E4,#FFB3B6)}
.ng-chosung .cs-rules{display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:9px 0 0; max-width:100%}
.ng-chosung .cs-chip{font-family:var(--disp); font-size:13.5px; line-height:1; padding:5px 10px; border-radius:99px; border:2px solid #1A0F45; background:#fff; color:#33256E; box-shadow:0 2px 0 #1A0F45; white-space:nowrap}
.ng-chosung .cs-chip.mj{background:#EEE8FF; color:#4B2FB0}
.ng-chosung .cs-chip.tw{background:#E3F4FF; color:#1F5FA8}
.ng-chosung .cs-chip.boss{background:linear-gradient(180deg,#FFE27A,#FFB020); color:#5A2E00}
.ng-chosung .cs-barw{position:relative; width:100%; height:10px; margin:10px 0 0; border-radius:99px; background:rgba(26,15,69,.18); border:2px solid #1A0F45; overflow:hidden}
.ng-chosung .cs-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#C9B8FF,#7B5CE6); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-chosung .cs-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-chosung .cs-dots{display:flex; flex-wrap:wrap; justify-content:center; gap:5px; margin:9px 0 0; min-height:10px}
.ng-chosung .cs-dots i{width:10px; height:10px; border-radius:50%; background:rgba(26,15,69,.16); border:1.5px solid rgba(26,15,69,.35)}
.ng-chosung .cs-dots i.now{background:#FFE27A; border-color:#1A0F45; transform:scale(1.25)}
.ng-chosung .cs-dots i.ok{background:#5BD08A; border-color:#1A0F45}
.ng-chosung .cs-dots i.sk{background:#B5B0CC; border-color:#1A0F45}
.ng-chosung .cs-card{position:relative; width:100%; margin:10px 0 0; padding:16px 10px 20px; border-radius:22px; cursor:text;
  background:radial-gradient(circle at 50% 30%, #FFFFFF 0%, #EFEAFF 100%); border:3px solid #1A0F45;
  box-shadow:inset 0 0 0 3px rgba(255,255,255,.85), 0 5px 0 #1A0F45, 0 14px 22px rgba(60,30,140,.2); display:flex; flex-direction:column; align-items:center; gap:12px; min-height:180px; justify-content:center}
.ng-chosung .cs-card.in{animation:chosung-in .4s cubic-bezier(.2,1.5,.4,1)}
.ng-chosung .cs-card.bad{background:radial-gradient(circle at 50% 30%, #FFF6F6 0%, #FFE0E2 100%)}
.ng-chosung .cs-card.ok{background:radial-gradient(circle at 50% 30%, #F4FFF7 0%, #D3F5DF 100%)}
.ng-chosung .cs-card.skip{background:radial-gradient(circle at 50% 30%, #FAFAFC 0%, #E4E2EE 100%)}
@keyframes chosung-in{from{transform:translateX(26px) scale(.96); opacity:0}}
.ng-chosung .cs-top{display:flex; align-items:center; justify-content:center; gap:8px; width:100%; position:relative}
.ng-chosung .cs-cat{font-family:var(--heavy); font-weight:400; font-size:19px; line-height:1; padding:7px 14px 6px; border-radius:99px; border:2.5px solid #1A0F45; color:#fff; background:var(--cc,#7B5CE6); box-shadow:0 3px 0 #1A0F45; -webkit-text-stroke:4px #1A0F45; paint-order:stroke fill; letter-spacing:.5px; white-space:nowrap}
.ng-chosung .cs-cat.hide{background:repeating-linear-gradient(135deg,#3E2A9A 0 8px,#5B44C4 8px 16px)}
.ng-chosung .cs-cat.ok{background:#2BB673}
.ng-chosung .cs-cat.sk{background:#8E8AA6}
.ng-chosung .cs-len{position:absolute; right:2px; font-family:var(--disp); font-size:13px; color:#7A6CB0}
.ng-chosung .cs-tiles{display:flex; flex-wrap:wrap; justify-content:center; gap:8px 14px; max-width:100%}
.ng-chosung .cs-wd{display:flex; gap:5px; flex-wrap:nowrap}
.ng-chosung .cs-t{width:var(--ts); height:calc(var(--ts) * 1.08); display:grid; place-items:center; border-radius:calc(var(--ts) * .24); border:2.5px solid #1A0F45;
  background:linear-gradient(180deg,#FFFFFB 0%,#FFF3D6 100%); box-shadow:inset 0 2px 0 rgba(255,255,255,.8), 0 3px 0 #B9A6FF, 0 5px 0 #1A0F45;
  font-family:var(--disp); font-weight:400; font-size:calc(var(--ts) * .6); line-height:1; color:#2E1F7A; margin-bottom:5px}   /* 초성은 Jua(둥근 글꼴): 굵은 제목 글꼴은 ㅌ이 E, ㄴ이 L처럼 보임 */
.ng-chosung .cs-t.open{background:linear-gradient(180deg,#FFFBE0,#FFE38A); color:#1A0F45}
.ng-chosung .cs-t.blank{background:repeating-linear-gradient(135deg,#EEE8FF 0 6px,#DCD2FF 6px 12px); color:#A08AE8}
.ng-chosung .cs-t.pop{animation:chosung-pop .45s cubic-bezier(.2,1.6,.4,1)}
.ng-chosung .cs-tiles.flip .cs-t{animation:chosung-flip .42s cubic-bezier(.3,1.4,.5,1) var(--d) both}
.ng-chosung .cs-card.ok .cs-t{background:linear-gradient(180deg,#F2FFF5,#BFF0D0); color:#13703F}
.ng-chosung .cs-card.skip .cs-t{background:linear-gradient(180deg,#FFFFFF,#E4E2EE); color:#4A4566}
@keyframes chosung-pop{0%{transform:scale(.5) rotate(-8deg)} 100%{transform:none}}
@keyframes chosung-flip{0%{transform:rotateX(90deg) scale(.8)} 100%{transform:none}}
.ng-chosung .cs-row{display:flex; align-items:center; gap:8px; width:100%; height:40px; margin-top:4px}
.ng-chosung .hlives[hidden]{display:none}
.ng-chosung .hlives{flex:none}
.ng-chosung .cs-msg{flex:1; min-width:0; overflow:hidden; height:40px; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--disp); font-size:15px; color:#3E2A9A; white-space:nowrap}
.ng-chosung .cs-msg span{overflow:hidden; text-overflow:ellipsis}
.ng-chosung .cs-msg b{font-family:var(--heavy); font-weight:400; font-size:20px; color:#fff; -webkit-text-stroke:5px #1A0F45; paint-order:stroke fill; letter-spacing:.5px; flex:none}
.ng-chosung .cs-msg b.k{font-size:16px; -webkit-text-stroke:4px #1A0F45; color:#FFE27A}
.ng-chosung .cs-msg b.bad{color:#FF8A8F}
.ng-chosung .cs-msg b.sk{color:#C9C4E0}
.ng-chosung .cs-msg.cs-pop, .ng-chosung .cs-msg.cs-win{animation:chosung-msg .35s cubic-bezier(.2,1.5,.4,1)}
.ng-chosung .cs-msg.cs-win b{font-size:24px; color:#FFE27A}
@keyframes chosung-msg{from{transform:scale(.6); opacity:0}}
.ng-chosung .cs-form{display:flex; gap:8px; width:100%; margin:2px 0 0}
.ng-chosung .cs-in{flex:1; min-width:0; height:54px; padding:0 16px; border-radius:16px; border:3px solid #1A0F45; background:#fff; box-shadow:inset 0 3px 0 rgba(26,15,69,.08), 0 3px 0 #1A0F45;
  font-family:var(--heavy); font-weight:400; font-size:22px; color:#1A0F45; outline:none; -webkit-appearance:none; appearance:none}
.ng-chosung .cs-in::placeholder{color:#B4AAD8; font-family:var(--disp); font-size:17px}
.ng-chosung .cs-in:focus{box-shadow:0 0 0 3px #FFE27A, 0 3px 0 #1A0F45}
.ng-chosung .cs-in:disabled{background:#EEEAF8}
.ng-chosung .cs-go{flex:none; width:86px; height:54px; border-radius:16px; border:3px solid #1A0F45; cursor:pointer; -webkit-tap-highlight-color:transparent;
  background:linear-gradient(180deg,#B9A6FF,#7B5CE6); color:#fff; font-family:var(--heavy); font-weight:400; font-size:20px; -webkit-text-stroke:4px #1A0F45; paint-order:stroke fill;
  box-shadow:inset 0 3px 0 rgba(255,255,255,.45), 0 4px 0 #1A0F45}
.ng-chosung .cs-go:active{transform:translateY(3px); box-shadow:inset 0 3px 0 rgba(255,255,255,.45), 0 1px 0 #1A0F45}
@media (max-width:370px){ .ng-chosung .cs-msg b{font-size:18px} .ng-chosung .cs-go{width:74px} }
@media (prefers-reduced-motion: reduce){ .ng-chosung .cs-card.in, .ng-chosung .cs-tiles.flip .cs-t, .ng-chosung .cs-t.pop{animation:none} }
`,
    sounds:{
      chosungOk(o){ const n = Math.min(10, o.n || 0); aBell({ f:penta(n + 4, 72), d:.6, v:.09, idx:1.4, rev:.35 }); aBell({ f:penta(n + 6, 72), t:.09, d:.7, v:.075, idx:1.2, rev:.4 }); aBell({ f:penta(n + 8, 72), t:.18, d:.8, v:.06, idx:1.2, rev:.45 }); if(n >= 2) aSparkle({ root:84 + Math.min(7, n), n:4, t:.2, v:.03 }); },
      chosungBad(){ aTone({ f:330, f2:220, type:'triangle', d:.2, v:.09 }); aThump({ f:140, f2:70, d:.12, v:.1 }); },
      chosungSkip(){ aWhoosh({ f:2400, f2:600, a:.02, d:.25, v:.05 }); aTone({ f:520, f2:390, type:'triangle', t:.05, d:.18, v:.06 }); },
      chosungHint(){ aSparkle({ root:79, n:5, v:.04 }); },
      chosungTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      chosungTimeUp(){ aTone({ f:392, f2:196, type:'sawtooth', lp:1400, d:.6, v:.07 }); aThump({ f:120, f2:45, d:.4, v:.25 }); }
    },
    gate:{ chosungTick:250, chosungBad:80 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 3, 72), { t:i * .08, v:.16 })); [79, 84, 88, 91].forEach((mm, i) => aBell({ f:m2f(mm), t:.45 + i * .03, d:1.2, v:.06, idx:1.3, rev:.45 })); aSparkle({ t:.55, n:6 }); }
  };
})();

/* 대전: 같은 문제 세트를 누가 더 빨리·많이 맞히나(기본 대전 = 같은 씨앗, 점수 비교) */
Object.assign(NG.chosung, { duelPace:[150, .78], duelHow:'같은 초성 문제 · 빨리 많이 맞히면 승리', duelStat:{ unit:'문제', get:() => ({ v:G.m.i, t:G.m.q }) } });
/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.chosung.scene = { kind:'shapes', colors:['#FFFFFF','#E3DAFF','#FFF3B0'], density:.8, alpha:.5 };
