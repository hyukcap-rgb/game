/* ===== 산넘어산 (mountain) · 하루퍼즐 리그 게임 모듈 =====
   앞사람들이 한 행동(30가지 중)을 처음부터 순서대로 따라 하고, 다 맞히면 새 행동 하나를 얹어 다음 사람에게 넘기는 기억력 대전.
   - 대전 전용(modes:['duel']): 2~5명 돌아가며(공용 대전 v3 차례 엔진 duelTurn). 틀리거나 차례 시간이 다 되면 탈락, 끝까지 남은 사람이 1등.
   - 남의 차례에 누르는 행동이 무대에 크게 나온다 → 보고 외워 두었다가 내 차례에 따라 한다(행동 순서는 사람이 만든다. 문제 씨앗 없음).
   - 사람이 없으면 컴퓨터 1:1(이 게임이 직접 둠, 씨앗 rng). 대전이 아닌 길(점검·예비)은 나 vs 컴퓨터로 같은 규칙. */
NG.mountain = (() => {
  const ID = 'mountain';
  const OL = '#1A0F45';

  /* ===== 행동 30가지(그림 = 기기 글꼴의 그림 글자, 이름은 직접 지음) ===== */
  const ACT = [
    ['👏', '박수치기', 'shake'], ['👋', '손 흔들기', 'sway'], ['👍', '엄지척', 'pop'], ['🙌', '만세', 'bounce'], ['✌️', '브이', 'pop'],
    ['💖', '손하트', 'pop'], ['😉', '윙크', 'shake'], ['🥱', '하품', 'sway'], ['🤧', '재채기', 'shake'], ['😴', '잠자기', 'sway'],
    ['😭', '엉엉 울기', 'shake'], ['😂', '깔깔 웃기', 'bounce'], ['😠', '화내기', 'shake'], ['😲', '깜짝 놀라기', 'bounce'], ['🤔', '고민하기', 'sway'],
    ['🤫', '쉿!', 'pop'], ['🎸', '기타 치기', 'shake'], ['🥁', '북 치기', 'bounce'], ['🎤', '노래하기', 'sway'], ['💃', '춤추기', 'spin'],
    ['🏃', '달리기', 'run'], ['🏊', '수영하기', 'sway'], ['⚽', '공 차기', 'spin'], ['🏀', '농구 슛', 'bounce'], ['🍜', '라면 먹기', 'shake'],
    ['🥤', '음료 마시기', 'pop'], ['📸', '사진 찍기', 'pop'], ['📞', '전화 받기', 'shake'], ['📖', '책 읽기', 'sway'], ['☂️', '우산 쓰기', 'spin']
  ].map(([e, n, a], i) => ({ e, n, a, i }));
  const NA = ACT.length;
  const DISC = ['#FFE08A', '#FFC2AE', '#BFEBCB', '#B5DCF5', '#DCCBFA', '#FFCDE2'];
  const CAP = 30;                                         /* 산 30개를 쌓으면 끝(남은 사람끼리 쌓은 수로 순위) */
  const limFor = len => len ? Math.round(6 + len * 1.6) : 10;   /* 한 차례 시간: 처음(얹기만) 10초 · 그 뒤 6초 + 산 하나에 1.6초(느긋하게는 엔진이 ×2) */
  const aiFailP = (len, cap) => .9 / (1 + Math.exp(-(len - cap) / 1.6));   /* 컴퓨터가 이번 차례에 틀릴 확률(산이 기억력 cap을 넘을수록 커짐) */
  const AI_NAME = { 6:'순한 컴퓨터', 9:'보통 컴퓨터', 13:'기억왕 컴퓨터' };
  const isAct = x => Number.isInteger(x) && x >= 0 && x < NA;

  const S = () => (G && G.id === ID ? G.m : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const $q = s => document.querySelector(s);
  function T(fn, ms){ const m = S(); if(!m) return; const id = setTimeout(() => { m.timers.delete(id); if(S() !== m) return; try{ fn(); }catch(e){ console.warn('mountain', e); } }, ms); m.timers.add(id); }

  /* ===== 차례: 대전은 엔진 duelTurn, 그 밖은 같은 모양의 작은 차례 시계(나 → 컴퓨터) ===== */
  const TT = {
    cur(){ const m = S(); return m.dw ? duelTurn.cur() : m.lt.pl[m.lt.i]; },
    n(){ const m = S(); return m.dw ? duelTurn.n() : m.lt.n; },
    act(kind, data, o = {}){
      const m = S(); if(m.dw) return duelTurn.act(kind, data, o);
      const lt = m.lt, as = o.as || m.me; if(lt.pl[lt.i] !== as || G.over) return false;
      if(o.next !== false){ lt.i = (lt.i + 1) % lt.pl.length; lt.n++; lt.since = elapsed(); }
      return true;
    },
    timeout(sec){ const m = S(); m.lim = sec * (m.dw && G.duel.pace === 's' ? 2 : 1); if(m.dw){ try{ duelTurn.timeout(sec); }catch(_){} } else m.lt.lim = sec; },
    left(){ const m = S(); if(m.dw){ const l = duelTurn.left(); return l == null ? m.lim : l; } return Math.max(0, m.lt.lim - (elapsed() - m.lt.since)); }
  };

  /* ===== 참가자 ===== */
  function ppl(){
    const m = S(); if(!m.dw) return {};
    if(!m.ppl || Date.now() - m.pplAt > 800){ m.ppl = {}; try{ duelPlayers().forEach(p => { m.ppl[p.pid] = p; }); }catch(_){} m.pplAt = Date.now(); }
    return m.ppl;
  }
  function who(pid){
    const m = S();
    if(!m.dw) return pid === m.me ? { pid, nick:'나', me:true, col:'#FF5FA2' } : { pid, nick:AI_NAME[m.cfg.ai] || '컴퓨터', ai:true, col:'#2F7BFF' };
    return ppl()[pid] || { pid, nick:'상대', col:'#2F7BFF' };
  }
  const nm = pid => { const m = S(); return pid === m.me ? '나' : m.dw ? esc(duelShortNick(who(pid).nick)) : '컴퓨터'; };
  const face = pid => { const m = S(); try{ return pid === m.me ? avatar({ me:true }) : oppAv(m.dw ? who(pid).nick : '곰'); }catch(_){ return ''; } };
  const gone = pid => { const p = ppl()[pid]; return !!(p && p.left); };
  const alive = () => { const m = S(); return m.pl.filter(p => !m.P[p].out && !gone(p)); };
  const rankKey = pid => { const q = S().P[pid]; return q.out ? q.outN : 1000; };   /* 순위 열쇠 lf: 남은 사람 1000 · 탈락 = 몇 번째 탈락 */
  function syncAi(){
    try{ const m = S(); if(!m.dw) return; const A = G.duel.P.ai, q = m.P.ai; if(!A || !q) return;
      if(q.adds > (A.st.v || 0)) A.st.la = Math.round(duelSrv());
      Object.assign(A.st, { v:q.adds, lf:rankKey('ai'), mis:q.mis, pg:Math.min(1, m.seq.length / CAP) }); }catch(_){}
  }

  /* ===== 화면 조각 ===== */
  function perform(i, mark, by){
    const m = S(), a = ACT[i], d = $q('#mtDisc'); if(!a || !d) return;
    $q('#mtE').textContent = a.e; $q('#mtName').textContent = a.n;
    d.style.setProperty('--dc', DISC[i % DISC.length]);
    d.className = 'mt-disc'; void d.offsetWidth; d.classList.add('mt-' + a.a); if(mark) d.classList.add(mark);
    if(by != null){ const w = $q('#mtWho'); if(w) w.innerHTML = `${face(by)}<b>${nm(by)}</b>`; }
    if(mark === 'no') sfx('mtBad'); else if(mark === 'new') sfx('mtAdd'); else sfx('mtTap', { i, k:m.prog });
  }
  function idle(by, text){
    const d = $q('#mtDisc'); if(!d) return;
    d.className = 'mt-disc idle'; d.style.removeProperty('--dc'); $q('#mtE').textContent = '⛰️'; $q('#mtName').textContent = text || '';
    const w = $q('#mtWho'); if(w) w.innerHTML = by != null ? `${face(by)}<b>${nm(by)}</b>` : '';
  }
  /* 차례가 바뀌어도 방금 얹은 행동은 무대에 남겨 둔다(다음 사람이 보고 외울 수 있게). 이름표만 바꾼다 */
  function stageWho(by){ const w = $q('#mtWho'); if(w) w.innerHTML = by != null ? `${face(by)}<b>${nm(by)}</b>` : ''; if(!S().seq.length) idle(by, ''); }
  function msg(h, cls){ const e = $q('#mtMsg'); if(e){ e.className = 'mt-msg' + (cls ? ' ' + cls : ''); e.innerHTML = h; } }
  function lock(on, adding){ const g = $q('#mtGrid'); if(!g) return; g.classList.toggle('locked', !!on); g.classList.toggle('adding', !!adding); }
  function trail(st = {}){
    const m = S(), t = $q('#mtTrail'); if(!t) return;
    const c = $q('#mtCnt'); if(c) c.textContent = m.seq.length;
    if(!m.seq.length){ t.innerHTML = '<span class="mt-empty">첫 번째 산을 기다리는 중</span>'; return; }
    t.innerHTML = m.seq.map((_, i) => {
      const k = st.bad === i ? 'bad' : st.newAt === i ? 'new' : i < (st.done || 0) ? 'done' : st.cur === i ? 'cur' : '';
      return `<span class="mt-pk ${k}"><i></i><small>${i + 1}</small></span>`;
    }).join('');
    const f = st.bad ?? st.newAt ?? st.cur ?? Math.max(0, (st.done || m.seq.length) - 1);
    const el = t.children[Math.min(f, m.seq.length - 1)];
    if(el) try{ t.scrollLeft = el.offsetLeft - t.clientWidth / 2 + 17; }catch(_){}
  }
  function order(){
    try{
      const m = S(), e = $q('#mtOrder'); if(!e) return;
      const cur = m.phase === 'play' ? TT.cur() : null;
      e.innerHTML = m.pl.map(pid => { const q = m.P[pid], out = q.out || (gone(pid) ? 'left' : null), w = who(pid);
        return `<span class="mt-op${pid === cur && !out && !m.ended ? ' cur' : ''}${out ? ' out' : ''}${pid === m.me ? ' me' : ''}" style="--sc:${w.col || '#2F7BFF'}">${face(pid)}<b>${nm(pid)}</b><i>${out ? '탈락' : '산 ' + q.adds}</i></span>`; }).join('');
    }catch(_){}
  }
  function hud(){
    const m = S(); if(!m) return;
    const a = $q('#mtAlive'); if(a) a.textContent = alive().length;
    const c = $q('#mtCnt'); if(c) c.textContent = m.seq.length;
  }

  /* ===== 흐름 ===== */
  function begin(){
    const m = S(); if(m.phase !== 'intro') return;
    m.phase = 'play'; sfx('mtStart'); order(); hud(); poll();
  }
  /* 차례가 바뀌었는지 살핌(0.2초마다 + 그림 틀마다). 대전이 아닌 길은 여기서 시간 초과도 냄 */
  function poll(){
    const m = S(); if(!m || G.over || m.ended || m.phase !== 'play') return;
    checkEnd(); if(m.ended) return;
    if(!m.dw && TT.left() <= 0){ const pid = TT.cur(); onAct({ kind:'timeout', pid, auto:true }); if(!m.ended){ const lt = m.lt; lt.i = (lt.i + 1) % lt.pl.length; lt.n++; lt.since = elapsed(); } }
    const cur = TT.cur(), key = cur + ':' + TT.n();
    if(key === m.lastKey) return;
    m.lastKey = key; turnStart(cur);
  }
  function turnStart(cur){
    const m = S(), q = m.P[cur]; if(!q) return;
    m.prog = 0; m.turn = null; m.timeShown = false; m.lastSec = -1;
    TT.timeout(limFor(m.seq.length));
    order(); hud(); trail({ cur:0 });
    if(cur === m.me){
      if(q.out){ TT.act('p', null); lock(true); return; }   /* 이미 탈락: 바로 넘김 */
      m.turn = 'me'; m.stage = m.seq.length ? 'rep' : 'add';
      stageWho(m.me); if(!m.seq.length) $q('#mtName').textContent = '첫 행동을 골라요';
      lock(false, m.stage === 'add');
      msg(m.seq.length ? `<b>내 차례!</b><span>산 ${m.seq.length}개를 처음부터 순서대로 눌러요</span>` : '<b>내 차례!</b><span>첫 행동을 하나 골라 산을 쌓아요</span>', 'go');
      sfx('mtTurn'); fxBuzz(15);
      return;
    }
    lock(true);
    if(cur === 'ai' && (!m.dw || G.duel.mode === 'ai')){
      if(q.out){ TT.act('p', null, { as:'ai' }); return; }
      aiTurn(); return;
    }
    if(q.out){ msg('<span>넘어가는 중…</span>', 'soft'); return; }
    stageWho(cur); if(!m.seq.length) $q('#mtName').textContent = '첫 행동을 고르는 중';
    msg(`<span><b>${nm(cur)}</b>님 차례 · ${m.seq.length ? '누르는 행동을 잘 봐 두세요!' : '첫 행동을 기다려요'}</span>`, 'soft');
  }

  /* 내가 누르기 */
  function tap(i){
    const m = S(); if(!m || G.over || m.ended || m.turn !== 'me' || !isAct(i)) return;
    if(m.stage === 'rep'){
      const exp = m.seq[m.prog];
      if(i === exp){
        if(!TT.act('t', i, { next:false })) return;
        m.prog++; m.P[m.me].reps++;
        perform(i, 'ok', m.me); trail({ done:m.prog, cur:m.prog });
        if(m.prog >= m.seq.length){ m.stage = 'add'; lock(false, true); msg('<b class="win">다 넘었어요!</b><span>이제 새 행동 하나를 얹어요</span>', 'pop'); sfx('mtClear'); }
        else msg(`<b>${m.prog} / ${m.seq.length}</b><span>다음 행동은?</span>`, 'go');
        return;
      }
      m.turn = null; lock(true);
      const at = m.prog;
      perform(i, 'no', m.me); trail({ done:at, bad:at });
      if(TT.act('out', { k:'miss', a:i, at })) out(m.me, 'miss', { a:i, at });
      return;
    }
    if(m.stage === 'add'){
      m.turn = null; lock(true);
      if(TT.act('add', i)) addAct(m.me, i);
    }
  }
  function addAct(pid, i){
    const m = S(); if(!isAct(i) || m.ended) return;
    m.seq.push(i); m.P[pid].adds++;
    perform(i, 'new', pid); trail({ newAt:m.seq.length - 1 });
    msg(`<span>${pid === m.me ? '내가' : `<b>${nm(pid)}</b>님이`} 산을 하나 쌓았어요</span><b class="new">${ACT[i].e} ${ACT[i].n}</b>`, 'pop');
    TT.timeout(limFor(m.seq.length));   /* 다음 사람의 차례 시간(모든 기기가 같은 길이로 정함) */
    try{ const p = fxCenter($q('#mtDisc')); fxRing(p.x, p.y, '#7CDB9A', p.w * .7, .55, 8); }catch(_){}
    syncAi(); order(); hud(); checkEnd();
  }
  /* 다른 사람의 수 · 엔진의 대신 하기(시간 초과) · 나간 사람 건너뛰기 */
  function onAct(a){
    const m = S(); if(!m || m.ended || G.over || !a) return;
    const q = m.P[a.pid]; if(!q) return;
    if(a.kind === 't'){ if(isAct(a.data)){ m.prog++; perform(a.data, 'ok', a.pid); trail({ done:m.prog, cur:m.prog }); msg(`<span><b>${nm(a.pid)}</b> · ${m.prog} / ${m.seq.length}</span>`, 'soft'); } return; }
    if(a.kind === 'add'){ addAct(a.pid, a.data); return; }
    if(a.kind === 'out'){ const d = a.data || {}; if(isAct(d.a)) perform(d.a, 'no', a.pid); out(a.pid, d.k === 'miss' ? 'miss' : 'give', d); return; }
    if(a.kind === 'timeout' && !q.out){ out(a.pid, 'time', { at:m.prog }); return; }
    if(a.kind === 'skip' && !q.out) out(a.pid, 'left', {});
  }
  const OUT_TXT = { miss:'순서가 틀렸어요', time:'시간 안에 못 했어요', left:'나갔어요', give:'포기했어요' };
  function out(pid, why, info){
    const m = S(), q = m.P[pid]; if(!q || q.out) return;
    q.out = why; q.outN = ++m.outN; if(why === 'miss') q.mis++;
    const at = info && Number.isInteger(info.at) ? info.at : null, ans = at != null && m.seq[at] != null ? ACT[m.seq[at]] : null;
    if(at != null && at < m.seq.length) trail({ done:at, bad:at });
    const tip = ans && why !== 'left' ? ` · ${at + 1}번째는 ${ans.e} ${ans.n}` : '';
    if(pid === m.me){
      m.turn = null; lock(true);
      msg(`<b class="bad">탈락했어요</b><span>${OUT_TXT[why] || ''}${tip}${m.dw && alive().length > 1 ? ' · 끝날 때까지 함께 봐요' : ''}</span>`, 'pop');
      sfx('mtOut'); fxBuzz([40, 40, 60]); try{ fxShake($q('#mtStageBox'), 6); }catch(_){}
    } else {
      msg(`<span><b>${nm(pid)}</b>님 탈락 · ${OUT_TXT[why] || ''}${tip}</span>`, 'pop');
      if(m.dw) try{ duelNotify(`${nm(pid)}님 탈락 · ${OUT_TXT[why] || ''}`, { from:who(pid), kind:'good', force:true }); }catch(_){}
      sfx('mtOther');
    }
    syncAi(); order(); hud(); checkEnd();
  }
  function checkEnd(){
    const m = S(); if(!m || m.ended || m.phase !== 'play') return;
    const al = alive();
    let why = null;
    if(al.length <= 1) why = al.length ? (al[0] === m.me ? '내가 끝까지 남았어요!' : `${nm(al[0])}님이 끝까지 남았어요`) : '모두 탈락했어요';
    else if(m.seq.length >= CAP) why = `산 ${CAP}개를 모두 쌓았어요 · 많이 쌓은 순서로 순위`;
    if(!why) return;
    m.ended = true; m.phase = 'done'; m.turn = null; lock(true); order();
    const rk = p => rankKey(p) * 100 + m.P[p].adds, best = Math.max(...m.pl.map(rk)), meTop = rk(m.me) === best, tie = m.pl.filter(p => rk(p) === best).length > 1;
    msg(`<b class="${meTop ? 'win' : 'bad'}">${meTop ? (tie ? '공동 1위!' : '1위!') : '끝났어요'}</b><span>${why} · 산 ${m.seq.length}개</span>`, meTop ? 'win' : 'pop');
    sfx(meTop ? 'mtWin' : 'mtOut');
    if(meTop) try{ const p = fxCenter($q('#mtDisc')); fxRing(p.x, p.y, '#FFE27A', p.w, .8, 12); }catch(_){}
    syncAi();
    T(() => { if(m.dw){ try{ duelEndNow(why); }catch(_){} } else finish(meTop); }, 1600);
  }

  /* ===== 컴퓨터(사람이 없을 때): 씨앗 rng로 외운 만큼 따라 하고, 산이 높아질수록 가끔 틀림 ===== */
  function aiTurn(){
    const m = S(), n0 = TT.n(), len = m.seq.length, r = mulberry(seedFrom(m.seed + ':ai:' + n0));
    const failAt = len && r() < aiFailP(len, m.cfg.ai || 9) ? Math.floor(len * (.35 + r() * .65)) : -1;
    const step = Math.max(480, 780 - len * 12);
    m.turn = 'ai'; lock(true); stageWho('ai'); if(!len) $q('#mtName').textContent = '첫 행동을 고르는 중';
    msg(`<span><b>${nm('ai')}</b> 차례 · ${len ? '누르는 행동을 잘 봐 두세요!' : '첫 행동을 기다려요'}</span>`, 'soft');
    let k = 0;
    const still = () => !m.ended && !G.over && TT.cur() === 'ai' && TT.n() === n0;
    const go = () => {
      if(!still()) return;
      if(k === failAt){
        let w; do{ w = Math.floor(r() * NA); }while(w === m.seq[k]);
        if(r() < .5){ const near = m.seq[k + 1] ?? m.seq[k - 1]; if(near != null && near !== m.seq[k]) w = near; }   /* 실수는 보통 앞뒤 행동과 헷갈림 */
        perform(w, 'no', 'ai');
        if(TT.act('out', { k:'miss', a:w, at:k }, { as:'ai' })) out('ai', 'miss', { a:w, at:k });
        return;
      }
      if(k < len){ const a = m.seq[k]; if(TT.act('t', a, { as:'ai', next:false })){ k++; m.prog = k; perform(a, 'ok', 'ai'); trail({ done:k, cur:k }); msg(`<span><b>${nm('ai')}</b> · ${k} / ${len}</span>`, 'soft'); } T(go, step); return; }
      let nx; do{ nx = Math.floor(r() * NA); }while(len && nx === m.seq[len - 1]);
      if(TT.act('add', nx, { as:'ai' })) addAct('ai', nx);
    };
    T(go, 900 + Math.floor(r() * 500));
  }

  /* ===== 시계 · 그림 틀 ===== */
  function loop(){
    if(!G || G.id !== ID || G.over) return;
    G.raf = requestAnimationFrame(loop);
    const m = S();
    if(m.phase === 'intro' && (!m.dw || G.duel.go) && (m.dw || elapsed() > .6)) begin();
    poll();
    if(m.phase !== 'play') return;
    const rem = TT.left(), lim = m.lim || 10, sec = Math.ceil(rem), bar = $q('#mtBar'), tp = $q('#mtTimeP'), te = $q('#mtTime');
    if(bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, rem / lim))})`;
    const mine = m.turn === 'me';
    if(sec !== m.lastSec){
      m.lastSec = sec; if(te) te.textContent = sec;
      const hurry = mine && sec <= 5; if(tp) tp.classList.toggle('warn', hurry); const bw = $q('#mtBarW'); if(bw){ bw.classList.toggle('hurry', hurry); bw.classList.toggle('other', !mine); }
      if(hurry && sec > 0) sfx('mtTick', { hi:sec <= 3 });
    }
    if(mine && rem <= 0 && m.dw && !m.timeShown){ m.timeShown = true; lock(true); msg('<b class="bad">시간이 다 됐어요</b><span>잠깐만요…</span>', 'pop'); }   /* 탈락은 엔진의 시간 초과 사건으로(모든 기기 같게) */
  }

  function wire(){
    const g = $q('#mtGrid'); if(!g) return;
    g.onclick = e => { const b = e.target.closest('.mt-act'); if(b) tap(+b.dataset.i); };
  }

  const helpRows = [
    ['처음부터 순서대로', '내 차례가 오면 지금까지 쌓인 행동을 첫 번째부터 순서대로 눌러요. 위쪽 산길에는 몇 개가 쌓였는지만 보이고, 무슨 행동인지는 안 보여요.'],
    ['하나를 얹어요', '다 맞히면 30가지 행동 중 하나를 골라 산을 하나 더 쌓고 다음 사람에게 넘겨요.'],
    ['남의 차례엔 잘 보기', '다른 사람이 누르는 행동이 가운데 무대에 크게 나와요. 그걸 보고 외워 두세요.'],
    ['틀리면 탈락', '순서가 틀리거나 차례 시간이 다 되면 탈락. 남은 사람이 같은 산길을 이어 가고, 끝까지 남은 사람이 1등이에요(산 30개를 다 쌓으면 많이 쌓은 순서).']
  ];

  return {
    name:'산넘어산', abil:'집중력', col:['#C4EBC9', '#3E9B63', '#1F5B3A'], time:'약 4분',
    modes:['duel'],   /* 2026-10-08 사용자 지시: 대전에만 추가 */
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 20 8 8.5l3.2 5.3L14.5 7 22.5 20z"/><path d="M14.5 7l2.2 4-1.4-.6-1 1.4-1-1.1z" fill="#fff" fill-opacity=".85"/></svg>',
    art(){
      const u = 'mtA' + (++SVG_UID);
      const disc = (x, y, c, e) => `<g transform="translate(${x} ${y})"><circle r="15" fill="${c}" stroke="${OL}" stroke-width="2.2"/><text y="6" font-size="17" text-anchor="middle">${e}</text></g>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9F1FB"/><stop offset="1" stop-color="#FFF1DA"/></linearGradient></defs>
        <rect width="160" height="100" fill="url(#${u})"/>
        <path d="M0 78 32 42l22 24 30-40 34 44 18-18 24 26v22H0z" fill="#8FCB9B" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M0 92 40 70l30 16 34-22 56 28v8H0z" fill="#3E9B63" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M84 26l-8 10 5-1 3 4 3-4 5 1z" fill="#fff"/>
        ${disc(28, 24, '#FFE08A', '👏')}${disc(66, 16, '#B5DCF5', '🎸')}${disc(126, 22, '#FFCDE2', '🙌')}
        <path d="M44 22c6-4 9-5 14-4M84 16c12-1 20 1 26 4" fill="none" stroke="#FF8A3D" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="3 4"/></svg>`;
    },
    help:helpRows,
    howto:{
      pic(){
        const disc = (x, y, c, e, k) => `<g transform="translate(${x} ${y})"><circle r="30" fill="${c}" stroke="${OL}" stroke-width="3"/><text y="12" font-size="32" text-anchor="middle">${e}</text>${k ? `<circle cx="22" cy="-22" r="10" fill="#3E9B63" stroke="${OL}" stroke-width="2"/><text x="22" y="-17.5" font-size="13" font-weight="900" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${k}</text>` : ''}</g>`;
        return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="16" fill="#E3F4FB"/>
          <path d="M0 150 60 96l40 32 54-64 60 72 36-30 70 60v14H0z" fill="#BFE6C6"/>
          ${disc(58, 62, '#FFE08A', '👏', '1')}${disc(138, 48, '#B5DCF5', '🎸', '2')}${disc(218, 62, '#FFCDE2', '🙌', '3')}
          <g transform="translate(276 118)"><circle r="24" fill="#fff" stroke="${OL}" stroke-width="3" stroke-dasharray="6 5"/><text y="9" font-size="26" font-weight="900" text-anchor="middle" fill="#3E9B63" font-family="system-ui,sans-serif">+</text></g>
          <path d="M90 58q22-14 44-10M170 46q22-2 44 10M240 86q22 6 28 14" fill="none" stroke="#FF8A3D" stroke-width="4" stroke-linecap="round"/></svg>`;
      },
      lines:['앞사람 행동을 순서대로 눌러요', '다 맞히면 새 행동 하나를 얹어요', '틀리거나 시간이 지나면 탈락!'],
      more:helpRows
    },
    duelHelp:helpRows,
    chapters:['동네 뒷산', '구름 언덕', '바람 고개', '눈꽃 봉우리', '하늘 정상'],
    starRule:'★ 산 6개 · ★★ 산 10개 · ★★★ 산 15개',
    levels:{ easy:{ limit:0, ai:6 }, normal:{ limit:0, ai:9 }, hard:{ limit:0, ai:13 } },
    levelDesc(lv){ const c = this.levels[lv] || this.levels.normal; return `${AI_NAME[c.ai]}와 번갈아 산 쌓기`; },
    stage(n){ return { limit:0, ai:[6, 9, 13][Math.min(2, Math.floor((n - 1) / 10))] }; },
    stageDesc(n){ return `${AI_NAME[this.stage(n).ai]}와 번갈아 산 쌓기`; },
    init(cfg, rng, lv){
      const dwOn = !!(G.duel && !G.duel.fleet && !G.duel.replay && Array.isArray(G.duel.pl) && G.duel.pl.length);
      const pl = dwOn ? G.duel.pl.slice() : ['me', 'ai'], me = dwOn ? G.duel.myPid : 'me';
      G.m = { cfg:Object.assign({ ai:9 }, cfg), dw:dwOn, pl, me, P:{}, seq:[], outN:0, phase:'intro', ended:false, turn:null, stage:null, prog:0,
        lastKey:'', lim:10, lastSec:-1, timeShown:false, seed:Math.floor(rng() * 1e9), timers:new Set(), ppl:null, pplAt:0,
        lt:{ pl, i:0, n:0, since:0, lim:10 } };
      pl.forEach(p => { G.m.P[p] = { out:null, outN:0, adds:0, reps:0, mis:0 }; });
      G.limit = 0;   /* 판 전체 시간 제한 없음(차례 시간만) */
      const m = G.m;
      if(dwOn){ try{ duelTurn.onAct(onAct); }catch(_){} }
      m.iv = setInterval(poll, 200);   /* 화면이 가려져 그림이 멈춰도 차례 넘김은 돌게 */
      G.cleanup = () => { m.timers.forEach(clearTimeout); m.timers.clear(); clearInterval(m.iv); if(G && G.raf) cancelAnimationFrame(G.raf); };
    },
    render(st){
      const m = S();
      st.innerHTML = `<div class="ng-mt">
        <div class="hud-row">
          <div class="hchip" aria-label="쌓은 산"><span class="hv"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 20 8 8.5l3.2 5.3L14.5 7 22.5 20z" fill="#3E9B63" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/></svg><b id="mtCnt">0</b><small>/${CAP}</small></span><em>쌓은 산</em></div>
          <div class="hchip time" id="mtTimeP" aria-label="차례 남은 시간"><span class="hv"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.5" fill="#FFC93C" stroke="${OL}" stroke-width="1.8"/><path d="M12 9.8v3.9l2.6 1.6" stroke="${OL}" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg><b id="mtTime">${limFor(0)}</b><small>초</small></span><em>차례 시간</em></div>
          <div class="hchip" aria-label="남은 사람"><span class="hv"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="6" fill="#FFB36B" stroke="${OL}" stroke-width="1.8"/><circle cx="16" cy="12" r="6" fill="#8FE3DA" stroke="${OL}" stroke-width="1.8" fill-opacity=".9"/></svg><b id="mtAlive">${m.pl.length}</b><small>명</small></span><em>남은 사람</em></div>
        </div>
        <div class="mt-barw" id="mtBarW"><i id="mtBar"></i></div>
        <div class="mt-order" id="mtOrder" aria-label="차례 순서"></div>
        <div class="mt-stage" id="mtStageBox">
          <div class="mt-who" id="mtWho"></div>
          <div class="mt-disc idle" id="mtDisc"><span id="mtE">⛰️</span></div>
          <div class="mt-name" id="mtName"></div>
          <div class="mt-msg" id="mtMsg" role="status" aria-live="polite"><span>${m.dw ? '모두 모이면 시작해요' : '곧 시작해요'}</span></div>
        </div>
        <div class="mt-trailw"><div class="mt-trh"><span>산길</span><span>무슨 행동인지는 안 보여요</span></div><div class="mt-trail" id="mtTrail"></div></div>
        <div class="mt-grid locked" id="mtGrid">${ACT.map(a => `<button class="mt-act" data-i="${a.i}" aria-label="${a.n}"><span class="e">${a.e}</span><span class="n">${a.n}</span></button>`).join('')}</div>
      </div>`;
      wire(); trail(); order(); hud();
      if(G.raf) cancelAnimationFrame(G.raf);
      G.raf = requestAnimationFrame(loop);
    },
    progress(){ const m = G && G.m; return m ? Math.min(1, m.seq.length / 15) : 0; },
    /* 대전 순위: 순위 열쇠 lf(남은 사람 1000 · 탈락 = 탈락 번째) 큰 순 → 쌓은 산 → 실수 적은 순 */
    duelRank(a, b){ return ((b.lf || 0) - (a.lf || 0)) || ((b.v || 0) - (a.v || 0)) || ((a.mis || 0) - (b.mis || 0)); },
    lossText(){ const m = G.m; return `${m.P[m.me].out ? (OUT_TXT[m.P[m.me].out] || '') + '. ' : ''}산 ${m.seq.length}개에서 멈췄어요.`; },
    score(){
      const m = G.m, len = m.seq.length, q = m.P[m.me];
      const base = 400 + Math.min(100, len * 8), time = Math.min(250, q.reps * 6), extra = Math.min(250, q.adds * 20);
      return { base, time, extra, rows:[`쌓은 산 ${len}개`, `따라 한 행동 ${q.reps}번`, `내가 얹은 산 ${q.adds}개`] };
    },
    stars(){ const n = G.m.seq.length; return n >= 15 ? 3 : n >= 10 ? 2 : 1; },
    winTitle:'정상 도착!',
    duelHow:'2~5명이 돌아가며 행동 잇기 · 틀리면 탈락 · 끝까지 남으면 1등',
    duelKind:'turn', duelMax:5, duelEnd:'game', duelReplay:false, noSend:true,
    duelCfg:() => ({ limit:0, ai:9, duel:1 }),
    duelAi:() => null,   /* 컴퓨터 상대는 이 게임이 직접 둔다(aiTurn) */
    duelPace:[120, .6],
    duelStat:{ unit:'산', get:() => { const m = G.m; if(!m) return { v:0 }; const q = m.P[m.me]; return m.dw ? { v:q.adds, mis:q.mis, lf:rankKey(m.me) } : { v:m.seq.length, t:15 }; } },
    css:`
body[data-mode="mountain"]{background:
  radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,.7), rgba(255,255,255,0) 70%),
  linear-gradient(180deg,#D9F1FB 0%,#EAF6EC 55%,#FFF1DA 100%) fixed}
.ng-mt{position:relative; display:flex; flex-direction:column; align-items:stretch; gap:8px; width:100%; max-width:520px; margin:0 auto}
.ng-mt .hud-row{margin:0}
.ng-mt .hchip.time.warn{background:linear-gradient(180deg,#FFE3E4,#FFB3B6)}
.ng-mt .mt-barw{position:relative; height:10px; border-radius:99px; background:rgba(26,15,69,.16); border:2px solid ${OL}; overflow:hidden}
.ng-mt .mt-barw i{position:absolute; inset:0; transform-origin:left center; background:linear-gradient(180deg,#A6EDB9,#3E9B63); box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.ng-mt .mt-barw.other i{background:linear-gradient(180deg,#D8D2EA,#A79FC4)}
.ng-mt .mt-barw.hurry i{background:linear-gradient(180deg,#FF9A9E,#E5484D)}
.ng-mt .mt-order{display:flex; gap:6px; flex-wrap:wrap; justify-content:center; padding-top:6px}
.ng-mt .mt-op{position:relative; display:flex; align-items:center; gap:5px; padding:3px 10px 3px 4px; border-radius:99px; background:#fff; border:2px solid ${OL}; box-shadow:0 2px 0 ${OL}; font-family:var(--disp); font-size:14px; color:${OL}; transition:transform .2s}
.ng-mt .mt-op .av{width:26px; height:26px; border-width:2px; box-shadow:none}
.ng-mt .mt-op i{font-style:normal; font-size:12.5px; color:#3E7A55}
.ng-mt .mt-op.cur{border-color:var(--sc); box-shadow:0 0 0 3px var(--sc), 0 2px 0 ${OL}; transform:translateY(-2px)}
.ng-mt .mt-op.cur::before{content:'차례'; position:absolute; top:-12px; left:50%; transform:translateX(-50%); padding:0 6px; border-radius:99px; background:var(--sc); color:#fff; font-size:12.5px; line-height:1.4; border:1.5px solid ${OL}; white-space:nowrap}
.ng-mt .mt-op.out{opacity:.45; filter:grayscale(1)}
.ng-mt .mt-op.out i{color:#B3122E}
.ng-mt .mt-stage{position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 12px 8px; border-radius:22px; border:3px solid ${OL}; box-shadow:0 5px 0 ${OL}; overflow:hidden;
  background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.75)), linear-gradient(180deg,#D9F1FB,#FFF1DA)}
.ng-mt .mt-stage::after{content:''; position:absolute; left:0; right:0; bottom:0; height:38px; pointer-events:none; opacity:.35;
  background:linear-gradient(135deg,transparent 48%,#8FCB9B 49%) 0 0/48px 38px repeat-x, linear-gradient(225deg,transparent 48%,#8FCB9B 49%) 24px 0/48px 38px repeat-x}
.ng-mt .mt-who{position:absolute; left:10px; top:8px; z-index:2; display:flex; align-items:center; gap:6px; min-height:30px; font-family:var(--disp); font-size:16px; color:${OL}}
.ng-mt .mt-who .av{width:30px; height:30px; border-width:2px; box-shadow:none}
.ng-mt .mt-disc{--dc:#E9E2D0; position:relative; z-index:1; margin-top:22px; width:100px; height:100px; border-radius:50%; display:grid; place-items:center; background:var(--dc); border:3px solid ${OL}; box-shadow:inset 0 -8px 0 rgba(0,0,0,.08), 0 4px 0 ${OL}}
.ng-mt .mt-disc span{font-size:52px; line-height:1}
.ng-mt .mt-disc.idle span{opacity:.8}
.ng-mt .mt-disc.ok::after, .ng-mt .mt-disc.no::after, .ng-mt .mt-disc.new::after{position:absolute; right:-6px; top:-6px; width:36px; height:36px; border-radius:50%; display:grid; place-items:center; font-family:var(--heavy); font-size:19px; color:#fff; border:2px solid ${OL}}
.ng-mt .mt-disc.ok::after{content:'✓'; background:#2B9660}
.ng-mt .mt-disc.no::after{content:'✕'; background:#E5484D}
.ng-mt .mt-disc.new::after{content:'+'; background:#FF8A3D}
.ng-mt .mt-name{position:relative; z-index:1; min-height:1.3em; font-family:var(--heavy); font-size:22px; color:${OL}}
.ng-mt .mt-msg{position:relative; z-index:1; min-height:40px; display:flex; flex-wrap:wrap; gap:2px 8px; align-items:center; justify-content:center; text-align:center; font-family:var(--disp); font-size:15px; color:#3B4A44}
.ng-mt .mt-msg b{font-family:var(--heavy); font-weight:400; font-size:17px; color:${OL}}
.ng-mt .mt-msg b.win{color:#1F7A45} .ng-mt .mt-msg b.bad{color:#C2263D} .ng-mt .mt-msg b.new{color:#C25A10}
.ng-mt .mt-msg.go b{color:#1F7A45}
.ng-mt .mt-msg.pop{animation:mt-pop .35s ease}
.ng-mt .mt-trailw{padding:6px 10px 2px; border-radius:16px; background:rgba(255,255,255,.75); border:2px solid ${OL}}
.ng-mt .mt-trh{display:flex; justify-content:space-between; font-family:var(--disp); font-size:13px; color:#55665F; margin-bottom:4px}
.ng-mt .mt-trail{display:flex; gap:4px; align-items:flex-end; min-height:44px; overflow-x:auto; padding-bottom:4px; scroll-behavior:smooth}
.ng-mt .mt-pk{flex:0 0 auto; width:30px; display:flex; flex-direction:column; align-items:center; gap:1px}
.ng-mt .mt-pk i{display:block; width:30px; height:26px; background:#5F9A78; clip-path:polygon(50% 0,100% 100%,0 100%); transition:background .2s, transform .2s}
.ng-mt .mt-pk small{font-size:11px; color:#55665F; font-variant-numeric:tabular-nums}
.ng-mt .mt-pk.cur i{background:#FF8A3D; transform:translateY(-4px)}
.ng-mt .mt-pk.done i{background:#2B9660}
.ng-mt .mt-pk.bad i{background:#E5484D; transform:translateY(-4px)}
.ng-mt .mt-pk.new i{background:#FF8A3D}
.ng-mt .mt-empty{margin:auto; font-family:var(--disp); font-size:13.5px; color:#55665F}
.ng-mt .mt-grid{display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:5px}
.ng-mt .mt-act{min-width:0; min-height:52px; padding:5px 1px 4px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border-radius:12px; background:#fff; border:2px solid ${OL}; box-shadow:0 3px 0 ${OL}; color:${OL}; cursor:pointer; transition:transform .08s}
.ng-mt .mt-act .e{font-size:25px; line-height:1.1}
.ng-mt .mt-act .n{max-width:100%; font-family:var(--disp); font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.ng-mt .mt-act:active{transform:translateY(2px); box-shadow:0 1px 0 ${OL}}
.ng-mt .mt-grid.locked .mt-act{opacity:.45; pointer-events:none; box-shadow:0 1px 0 ${OL}}
.ng-mt .mt-grid.adding .mt-act{background:#FFF4E6; border-color:#C25A10}
body.big .ng-mt .mt-act .n{font-size:12.5px}
.ng-mt .mt-bounce{animation:mt-bounce .55s ease} .ng-mt .mt-shake{animation:mt-shake .5s ease} .ng-mt .mt-spin{animation:mt-spin .6s ease}
.ng-mt .mt-pop{animation:mt-popd .5s ease} .ng-mt .mt-sway{animation:mt-sway .6s ease} .ng-mt .mt-run{animation:mt-run .55s ease}
@keyframes mt-bounce{0%,100%{transform:translateY(0)}35%{transform:translateY(-22px) scale(1.04,.96)}60%{transform:translateY(0) scale(1.06,.92)}}
@keyframes mt-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-12deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(6deg)}}
@keyframes mt-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes mt-popd{0%{transform:scale(.6)}55%{transform:scale(1.14)}100%{transform:scale(1)}}
@keyframes mt-sway{0%,100%{transform:translateX(0) rotate(0)}30%{transform:translateX(-12px) rotate(-8deg)}70%{transform:translateX(12px) rotate(8deg)}}
@keyframes mt-run{0%{transform:translateX(-36px); opacity:.3}100%{transform:translateX(0); opacity:1}}
@keyframes mt-pop{0%{transform:scale(.92)}60%{transform:scale(1.04)}100%{transform:scale(1)}}
@media (max-width:370px){ .ng-mt .mt-act .e{font-size:21px} .ng-mt .mt-act .n{font-size:10.5px} .ng-mt .mt-disc{width:92px; height:92px} .ng-mt .mt-disc span{font-size:46px} }
@media (prefers-reduced-motion: reduce){ .ng-mt .mt-disc, .ng-mt .mt-msg.pop{animation:none!important} .ng-mt .mt-trail{scroll-behavior:auto} }
`,
    sounds:{
      mtTap(o){ aMarimba(penta((o.i || 0) % 10 + 3, 72), { v:.12 }); },
      mtAdd(){ aMarimba(m2f(79), { v:.12 }); aBell({ f:m2f(86), t:.08, d:.6, v:.06, idx:1.3, rev:.35 }); },
      mtBad(){ aTone({ f:330, f2:200, type:'triangle', d:.2, v:.1 }); aThump({ f:140, f2:70, d:.14, v:.12 }); },
      mtTurn(){ aTone({ f:880, f2:1180, type:'triangle', d:.08, v:.05, bus:'ui' }); },
      mtTick(o){ aTone({ f:o.hi ? 1320 : 990, type:'square', lp:3000, d:.05, v:.05, bus:'ui' }); },
      mtClear(){ aSparkle({ root:79, n:5, v:.045 }); },
      mtStart(){ aWhoosh({ f:2600, f2:600, a:.03, d:.25, v:.05 }); aBell({ f:m2f(84), t:.15, d:.5, v:.06, rev:.3 }); },
      mtOther(){ aMarimba(m2f(67), { v:.09 }); aMarimba(m2f(64), { t:.08, v:.08 }); },
      mtOut(){ aTone({ f:392, f2:196, type:'triangle', d:.55, v:.08 }); aThump({ f:120, f2:45, d:.35, v:.2 }); },
      mtWin(){ [0, 4, 7, 12].forEach((d, i) => aMarimba(m2f(72 + d), { t:i * .07, v:.13 })); aSparkle({ t:.3, n:6 }); }
    },
    gate:{ mtTick:250, mtTap:40 },
    jingle(){ [0, 2, 4, 7, 9].forEach((d, i) => aMarimba(penta(d + 1, 72), { t:i * .08, v:.16 })); aSparkle({ t:.5, n:6 }); }
  };
})();

/* 움직이는 배경(core/scene.js) — 보이기만 하고 게임·대전에는 영향 없음 */
NG.mountain.scene = { kind:'motes', colors:['#FFFFFF', '#C4EBC9', '#FFE9A8'], density:.6 };
