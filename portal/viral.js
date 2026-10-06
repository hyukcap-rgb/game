/* 공용: 공유 카드·도전장·초대 링크 */
/* ===== 바이럴 v1 (마케팅팀 점검 → 기획팀 개발, 2026-09-28) =====
   ① 링크 미리보기(OG)  ② 이미지 공유 카드 + 기기 공유 시트(카카오톡 등)  ③ 같은 문제 도전장 링크
   ④ 초대 링크(들어온 친구 = 친구 리그 추가 + 하트 2 선물)  ⑤ 자랑 순간(연속 기념일·레벨 업·승급)  ⑥ 공유 보상 하루 1번 하트 +1
   서버가 붙기 전까지 초대한 사람 쪽 보상·친구 점수는 기기 안에서만 처리(친구 점수는 가상). */
const SITE_URL = 'https://hyukcap-rgb.github.io/game/';
const STREAK_MS = [3, 7, 14, 30, 50, 100, 200, 365];
function siteUrl(){ return /github\.io$|^localhost$|^127\./.test(location.hostname) ? location.origin + location.pathname : SITE_URL; }
const NICK_A = ['꾸준한','성실한','느긋한','번뜩이는','차분한','용감한','부지런한','슬기로운'], NICK_B = ['여우','고래','부엉이','수달','판다','토끼','거북이','다람쥐'];
const cleanNick = v => String(v || '').replace(/[<>&"'`\\\n\r\t]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
function myNick(){ let n = cleanNick(store.get('hp:nick', '')); if(!n){ n = NICK_A[Math.random() * 8 | 0] + ' ' + NICK_B[Math.random() * 8 | 0]; store.set('hp:nick', n); } return n; }
const escH = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function linkOf(q){ const u = new URL(siteUrl()); u.searchParams.set('n', myNick()); if(typeof frCode === 'function' && frCode()) u.searchParams.set('f', frCode()); for(const k in q) u.searchParams.set(k, q[k]); return u.toString(); }
const mdTxt = k => { const [, m, d] = k.split('-').map(Number); return m + '/' + d; };
function canChal(){ return !!G && !G.adv && !G.duel && G.over; }   /* v9: 시험지는 누구나 같은 문제 */

/* 공유 카드 내용 */
function sqOf(d){ return d.set.map(g => ({ g, v:d.best[g] || 0, grade:gradeOf(examTop(g, d.best[g])), label:subjOf(g) })); }
function cardToday(){
  const d = dayState(), tl = myTL();
  return { kind:'today', title:'성적표 공유', head:'오늘의 성적표', big:tl.score, unit:'점', sub: examLabel() + ' 시험지' + (tl.streak ? ' · 연속 ' + tl.streak + '일' : ''), sq:sqOf(d), text:shareText(), q:{} };
}
function cardChal(g, score, lv){
  const vs = G && G.chal && G.chal.n ? G.chal : null;
  const text = vs && vs.s ? (score > vs.s ? `${vs.n}님, 도전장 받았어요! ${GAMES[g].name} ${fmt(score)}점으로 제가 이겼어요 😎\n억울하면 다시 붙어요!` : `${vs.n}님께 졌지만… ${GAMES[g].name} ${fmt(score)}점! 이번엔 제 도전장이에요.`)
    : `🦊 하루퍼즐 도전장!\n오늘 ${GAMES[g].name} ${fmt(score)}점 받았어요.\n같은 문제로 나를 이길 수 있을까요?`;
  return { kind:'chal', title:'도전장 보내기', head:GAMES[g].name + ' 도전장', big:score, unit:'점', sub:'같은 문제로 나를 이겨 봐!', g, text, q:{ c:g, d:dayKey(), s:score, lv } };
}
function cardInvite(){
  const tl = myTL();
  return { kind:'invite', title:'친구 초대', head:'같이 퍼즐 리그 해요', big:tl.streak || DAILY_N, unit:tl.streak ? '일째' : '게임', sub:tl.streak ? '나는 연속 출석 중 · 너도 한 판!' : '매일 전 세계가 같은 문제', text:`하루퍼즐 리그 같이 해요!\n매일 전 세계가 같은 문제를 풀고 친구랑 점수로 겨뤄요. 한 판이면 출석, 다섯 판이면 리그.\n이 링크로 들어오면 하트 2개 선물 🎁`, q:{ i:1 } };
}
function cardBrag(k, e){
  if(k === 'level') return { kind:'level', title:'레벨 업 자랑', head:'레벨 업!', big:e.L, unit:'레벨', pre:'Lv.', sub:`칭호 '${titleOf(e.L)}'`, text:`하루퍼즐 솔로 Lv.${e.L} 달성! 칭호 '${titleOf(e.L)}' 🏅\n너도 할 수 있어?`, q:{} };
  const t = TIERS[e.to][0], up = e.to > e.from;
  return { kind:'league', title:'리그 결과 자랑', head: up ? t + ' 리그 승급!' : t + ' 리그 ' + e.pos + '위', big:e.score, unit:'점', sub:`지난주 ${TIERS[e.from][0]} 리그 ${e.pos}위`, text: up ? `하루퍼즐 주간 리그 ${t}(으)로 승급했어요! 🏆 지난주 ${e.pos}위 · ${fmt(e.score)}점` : `하루퍼즐 주간 리그 ${TIERS[e.from][0]} ${e.pos}위! 🏆 ${fmt(e.score)}점`, q:{} };
}

/* 이미지 카드(1080×1350, 인스타·카톡에 그대로) */
async function cardCanvas(o){
  try{ await Promise.all(['900 80px "Black Han Sans"', '60px Jua', '700 40px "Noto Sans KR"'].map(f => document.fonts.load(f))); }catch(_){}
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), HV = '"Black Han Sans", Jua, sans-serif', JU = 'Jua, "Noto Sans KR", sans-serif', NO = '"Noto Sans KR", sans-serif';
  const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3A2590'); g.addColorStop(.55, '#22166A'); g.addColorStop(1, '#140C40'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, 330); for(let i = 0; i < 16; i++){ c.rotate(Math.PI / 8); c.fillStyle = i % 2 ? 'rgba(255,255,255,.045)' : 'rgba(255,210,90,.05)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-90, -1100); c.lineTo(90, -1100); c.closePath(); c.fill(); } c.restore();
  const rs = mulberry(seedFrom('card')); for(let i = 0; i < 70; i++){ c.fillStyle = `rgba(255,255,255,${.25 + rs() * .5})`; c.beginPath(); c.arc(rs() * W, rs() * H, 1 + rs() * 3, 0, 7); c.fill(); }
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  const outl = (t, x, y, font, fill, st, lw) => { c.font = font; c.lineWidth = lw; c.strokeStyle = st; c.strokeText(t, x, y); c.fillStyle = fill; c.fillText(t, x, y); };
  const lg = c.createLinearGradient(0, 70, 0, 170); lg.addColorStop(0, '#FFF0A0'); lg.addColorStop(1, '#FFB020');
  outl('하루퍼즐', W / 2 - 80, 165, `100px ${HV}`, lg, '#1A0F45', 16);
  c.save(); c.translate(W / 2 + 205, 128); c.rotate(-.06); c.fillStyle = '#F0368A'; rr(-72, -44, 144, 80, 18); c.fill(); c.lineWidth = 7; c.strokeStyle = '#1A0F45'; c.stroke(); c.fillStyle = '#fff'; c.font = `58px ${JU}`; c.fillText('리그', 0, 16); c.restore();
  const dt = new Date(); c.fillStyle = 'rgba(255,255,255,.75)'; c.font = `500 36px ${NO}`; c.fillText(`${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()} · ${escNick(myNick())}`, W / 2, 238);
  /* 패널 */
  const px = 80, py = 290, pw = W - 160, ph = 800;
  c.fillStyle = '#0E0830'; rr(px, py + 14, pw, ph, 48); c.fill();
  const pg = c.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, '#FFF8EA'); pg.addColorStop(1, '#FBE7C0'); c.fillStyle = pg; rr(px, py, pw, ph, 48); c.fill(); c.lineWidth = 9; c.strokeStyle = '#1A0F45'; c.stroke();
  c.fillStyle = '#6C3CE0'; rr(W / 2 - 300, py - 40, 600, 92, 46); c.fill(); c.lineWidth = 7; c.strokeStyle = '#1A0F45'; c.stroke();
  c.fillStyle = '#fff'; c.font = `50px ${JU}`; c.fillText(o.head, W / 2, py + 22);
  const ng = c.createLinearGradient(0, py + 140, 0, py + 360); ng.addColorStop(0, '#FFE066'); ng.addColorStop(1, '#FF9A1F');
  const bigT = (o.pre || '') + fmt(o.big); let fs = 230; c.font = `${fs}px ${HV}`; while(c.measureText(bigT).width > pw - 260 && fs > 120){ fs -= 10; c.font = `${fs}px ${HV}`; }
  const bw = c.measureText(bigT).width; c.font = `60px ${JU}`; const uw = c.measureText(o.unit).width;
  const bx = W / 2 - (bw + 16 + uw) / 2 + bw / 2;
  outl(bigT, bx, py + 350, `${fs}px ${HV}`, ng, '#1A0F45', 18);
  c.fillStyle = '#3A2261'; c.font = `60px ${JU}`; c.textAlign = 'left'; c.fillText(o.unit, bx + bw / 2 + 16, py + 345); c.textAlign = 'center';
  c.fillStyle = '#FF7A1F'; rr(W / 2 - 330, py + 400, 660, 84, 42); c.fill(); c.fillStyle = '#fff'; c.font = `700 40px ${NO}`; c.fillText(o.sub, W / 2, py + 456);
  if(o.sq && o.sq.length){
    const n = o.sq.length, sz = 132, gap = 26, sx = W / 2 - (n * sz + (n - 1) * gap) / 2;
    o.sq.forEach((q, k) => { const x = sx + k * (sz + gap), y = py + 540, col = q.grade ? GRADE_COL[q.grade] : !q.v ? '#DDD3C0' : q.v >= 800 ? '#27B86A' : q.v >= 400 ? '#FFC93C' : '#FF8A3D';
      c.fillStyle = 'rgba(26,15,69,.25)'; rr(x, y + 8, sz, sz, 28); c.fill(); c.fillStyle = col; rr(x, y, sz, sz, 28); c.fill(); c.lineWidth = 6; c.strokeStyle = '#1A0F45'; c.stroke();
      c.fillStyle = q.grade && q.grade !== '–' ? '#fff' : '#9C8F78'; c.font = `${q.grade ? 64 : 46}px ${HV}`; c.fillText(q.grade || (q.v ? String(Math.round(q.v / 100)) : '–'), x + sz / 2, y + (q.grade ? 92 : 88));
      c.fillStyle = '#5E4B7E'; c.font = `700 28px ${NO}`; const nm = q.label || GAMES[q.g].name.split(' ')[0]; c.fillText(nm.length > 5 ? nm.slice(0, 5) : nm, x + sz / 2, y + sz + 42); });
    c.fillStyle = '#7B6A93'; c.font = `500 28px ${NO}`; c.fillText('과목별 성적 · 같은 문제 푼 사람 중 등수로 수·우·미·양·가', W / 2, py + 770);
  } else {
    c.fillStyle = '#3A2261'; c.font = `56px ${JU}`; c.fillText(o.kind === 'chal' ? '같은 문제, 누가 더 잘할까?' : o.kind === 'invite' ? '매일 전 세계가 같은 문제' : '꾸준함이 실력이 된다', W / 2, py + 620);
    c.fillStyle = '#7B6A93'; c.font = `500 34px ${NO}`; c.fillText(o.kind === 'chal' ? '링크를 누르면 바로 같은 문제로 시작해요' : '설치 없이 링크로 바로 한 판', W / 2, py + 690);
  }
  c.fillStyle = '#FFE8A8'; c.font = `50px ${JU}`; c.fillText('같은 문제, 다른 점수.', W / 2, 1180);
  c.fillStyle = 'rgba(255,255,255,.6)'; c.font = `500 32px ${NO}`; c.fillText(siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1250);
  return cv;
}
const escNick = v => cleanNick(v) || '나';

/* 공유 시트: 카드 미리보기 + 기기 공유(카카오톡·메시지 등) / 이미지 저장 / 글·링크 복사 */
function viralShare(o, back){
  const build = () => { const url = linkOf(o.q || {}); return { url, text:o.text + '\n' + url }; };
  let cur = build(), cv = null, gen = 0;
  const giftOk = !dayState().shareGift;
  openModal(`<h3>${o.title}</h3><div class="shimg"><img id="shImg" alt="공유 카드 미리보기"></div>
    <label class="nickrow"><span>보이는 이름</span><input id="shNick" maxlength="12" value="${escH(myNick())}" autocomplete="nickname"></label>
    <div class="shrow"><button class="btn gold" id="shSend">${ic('share')} 공유하기</button></div>
    <div class="shrow"><button class="btn small secondary" id="shSave">이미지 저장</button><button class="btn small secondary" id="shCopy">글·링크 복사</button></div>
    ${giftOk ? '<p class="shgift">오늘 첫 공유 선물: 하트 +1</p>' : ''}
    <details class="brk"><summary>보내질 글 보기</summary><div class="sharebox" id="shareTxt"></div></details>
    <div class="mbtns one"><button class="b2" id="mBack">뒤로</button></div>`);
  const paint = async () => { const my = ++gen; $('#shareTxt').textContent = cur.text; const c2 = await cardCanvas(o); if(my !== gen || !$('#shImg')) return; cv = c2; $('#shImg').src = cv.toDataURL('image/png'); };
  paint();
  let nt = 0;
  $('#shNick').oninput = e => { clearTimeout(nt); nt = setTimeout(() => { const v = cleanNick(e.target.value); if(v){ store.set('hp:nick', v); cur = build(); paint(); } }, 350); };
  $('#mBack').onclick = typeof back === 'function' ? back : closeModal;
  const blobOf = () => new Promise(res => { if(!cv) return res(null); cv.toBlob(b => res(b), 'image/png'); });
  const fname = 'harupuzzle-' + dayKey() + '.png';
  const done = how => {
    const d = dayState(); d.shares = (d.shares || 0) + 1;
    if(!d.shareGift){ d.shareGift = true; saveDay(d); addHearts(1); sfx('heartGet'); toast(how + ' · 오늘 첫 공유 선물 하트 +1'); const g2 = $('.shgift'); if(g2) g2.remove(); }
    else { saveDay(d); toast(how); }
    store.set('hp:shareN', store.get('hp:shareN', 0) + 1);
  };
  const copy = async () => {
    let ok = false; try{ await navigator.clipboard.writeText(cur.text); ok = true; }catch(_){}
    if(!ok){ try{ const ta = document.createElement('textarea'); ta.value = cur.text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); }catch(_){} }
    return ok;
  };
  $('#shCopy').onclick = async () => { if(await copy()) done('글과 링크를 복사했어요'); else toast('아래 \'보내질 글 보기\'를 길게 눌러 복사해 주세요'); };
  $('#shSave').onclick = async () => { const b = await blobOf(); if(!b){ toast('카드를 만드는 중이에요'); return; } const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); done('이미지를 저장했어요'); };
  $('#shSend').onclick = async () => {
    try{
      const b = await blobOf(), f = b && typeof File === 'function' ? new File([b], fname, { type:'image/png' }) : null;
      if(f && navigator.canShare && navigator.canShare({ files:[f] })){ await navigator.share({ files:[f], text:cur.text }); done('공유했어요'); return; }
      if(navigator.share){ await navigator.share({ title:'하루퍼즐 리그', text:o.text, url:cur.url }); done('공유했어요'); return; }
    }catch(e){ if(e && e.name === 'AbortError') return; }
    if(await copy()) done('글과 링크를 복사했어요 · 카톡에 붙여 넣어 보내 주세요'); else toast('아래 글을 길게 눌러 복사해 주세요');
  };
}

/* 링크로 들어온 사람: 초대한 친구를 친구 리그에 추가 + 하트 선물, 도전장이면 도전 창 */
function linkFriendsLoad(){ for(const n of store.get('hp:linkFriends', [])) if(!FRIENDS.some(f => f.name === n)) FRIENDS.push({ name:n, av:'', link:true }); }
function linkFriendAdd(n){
  if(!n || n === myNick() || FRIENDS.some(f => f.name === n)) return false;
  const L = store.get('hp:linkFriends', []); L.push(n); store.set('hp:linkFriends', L.slice(-20));
  FRIENDS.push({ name:n, av:'', link:true }); return true;
}
function readLink(){
  let p; try{ p = new URLSearchParams(location.search); }catch(_){ return null; }
  const n = cleanNick(p.get('n')), c = p.get('c'), f = String(p.get('f') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if(!n && !c && !f) return null;
  const o = { n, g: GAME_IDS.includes(c) ? c : null, d: /^\d{4}-\d{2}-\d{2}$/.test(p.get('d') || '') ? p.get('d') : '', s: Math.max(0, Math.min(99999, parseInt(p.get('s'), 10) || 0)), lv: ['easy','normal','hard'].includes(p.get('lv')) ? p.get('lv') : 'normal', inv: p.get('i') === '1' };
  o.f = f.length === 6 ? f : '';
  try{ history.replaceState(null, '', location.pathname + location.hash); }catch(_){}
  return o;
}
function chalBox(score){
  const ch = G && G.chal; if(!ch || !ch.n) return '';
  if(!ch.same || !ch.s) return `<div class="chal"><b>${escH(ch.n)}님</b>에게 ${score ? fmt(score) + '점' : '이번 판'} 결과로 도전장을 보내 보세요</div>`;
  const win = score > ch.s, tie = score === ch.s;
  return `<div class="chal"><div class="vs"><div class="${win ? 'w' : ''}">나<b>${score ? fmt(score) : '실패'}</b></div><em>VS</em><div class="${!win && !tie ? 'w' : ''}">${escH(ch.n)}<b>${fmt(ch.s)}</b></div></div>
    <p class="note" style="margin:8px 0 0">${win ? `도전 성공! ${fmt(score - ch.s)}점 차로 이겼어요 🎉` : tie ? '완벽한 무승부!' : score ? `${fmt(ch.s - score)}점 차 · 아깝다!` : `이번엔 ${escH(ch.n)}님 승리`}</p></div>`;
}
function showChallenge(o){
  const g = o.g, same = o.d === dayKey(), d = dayState(), n = escH(o.n || '친구');
  const tried = d.tries[g] > 0;
  openModal(`<div class="burst" aria-hidden="true"></div><p class="kick">CHALLENGE</p><div class="ttl">${n}님의 도전장</div>
    <span class="chal-art">${ART[g] ? ART[g]() : ''}</span>
    <p class="note">${same ? `오늘 <b>${GAMES[g].name}</b>에서 <b>${fmt(o.s)}점</b>을 받았어요.<br>같은 문제로 이길 수 있을까요?` : `${o.d ? mdTxt(o.d) + ' ' : ''}도전장이에요. 문제는 매일 바뀌니까<br>오늘의 <b>${GAMES[g].name}</b>로 새로 붙어 봐요!`}</p>
    ${same ? `<p class="note" style="font-size:13px">${tried ? '이미 공식 답안을 냈어요. 같은 문제로 연습 대결을 해요.' : '지금 푸는 판이 내 공식 답안이 돼요(무료).'}</p>` : ''}
    <div class="mbtns"><button class="b2" id="chLater">나중에</button><button class="b1" id="chGo">${tried ? '도전하기(연습) ' + costTag() : '도전하기 · 무료'}</button></div>`);
  $('#modal').classList.add('celebrate'); sfx('fanfare');
  $('#chLater').onclick = () => { closeModal(); renderHome(); };
  $('#chGo').onclick = () => { closeModal(); startGame(g, examLv(), examOpt(g, { chal:{ n:o.n, s: same ? o.s : 0, same } })); };
}
function onArrive(o){
  if(!o) return false;
  const added = o.f && typeof frApi === 'function' && frApi() ? true : linkFriendAdd(o.n);   /* 친구 코드가 있으면 진짜 친구로(frStart가 맺음) */
  let gift = false;
  if(o.n && !store.get('hp:invGift', 0)){ store.set('hp:invGift', 1); addHearts(2); gift = true; }
  store.set('hp:welcome', Math.max(3, store.get('hp:welcome', 0)));
  renderHome();
  if(o.g){ showChallenge(o); if(gift) setTimeout(() => toast(`${o.n}님의 초대 선물 · 하트 +2`), 600); return true; }
  const n = escH(o.n);
  openModal(`<div class="burst" aria-hidden="true"></div><p class="kick">WELCOME</p><div class="ttl">${n}님이 초대했어요</div>
    <p class="note">매일 전 세계가 같은 문제를 풀고, 친구와 점수로 겨루는 퍼즐 리그예요.<br><b>같은 문제, 다른 점수!</b></p>
    <div class="rewards">${gift ? `<div class="reward"><span class="ri">${HEART_G}</span><b>+2</b>하트 선물</div>` : ''}${added ? `<div class="reward"><span class="ri">${avatar({ name:o.n })}</span><b>친구</b>리그 추가</div>` : ''}</div>
    <div class="mbtns one"><button class="b1" id="wGo">${n}님 점수 넘으러 가기</button></div>`);
  $('#modal').classList.add('celebrate'); fxConfetti(); sfx('fanfare');
  $('#wGo').onclick = () => { closeModal(); quickStart(pickNext()); };
  return true;
}
