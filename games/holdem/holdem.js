/* 로열 홀덤 (성인 19) — 하루퍼즐 사이트 안에서 여는 입구
 * 게임 본체는 독립 서비스(holdem/ 폴더, Railway)이고, 여기서는 그 화면을 꽉 찬 창(iframe)으로 띄운다.
 * - 솔로 → AI 대결로 바로 시작, 대전 → 친구 대전(방 만들기)으로 바로 시작
 * - 홀덤 첫 화면의 [‹ 하루퍼즐]을 누르면 사이트로 돌아온다(postMessage { holdem:'exit' })
 * - 점수·별·하트·대전 포인트와는 연결하지 않는다(홀덤 칩은 홀덤 안에서만)
 */
NG.holdem = (() => {
  const ID = 'holdem';
  const BASE = 'https://holdem-production-ada3.up.railway.app/';
  const ORIGIN = new URL(BASE).origin;
  const AGE_KEY = 'hp:age19';   /* 고스톱과 같은 19세 확인 기록(한 번 확인하면 성인 게임 모두 통과) */
  const ageOk = () => !!store.get(AGE_KEY, 0);

  function ageGate(go){
    if(ageOk()){ go(); return; }
    openModal(`<div class="hd-mgate"><span class="hd19">19</span><h3>19세 이상 이용 게임</h3><p class="note">홀덤은 만 19세 이상만 할 수 있어요. 돈이나 상품을 걸 수 없고, 칩은 게임 안에서만 써요.</p></div>
      <div class="mbtns"><button class="b2" id="mClose">아니요</button><button class="b1" id="mGo">네, 만 19세 이상이에요</button></div>`);
    $('#mClose').onclick = closeModal;
    $('#mGo').onclick = () => { store.set(AGE_KEY, 1); closeModal(); go(); };
  }

  function nick(){
    try{ if(typeof myNick === 'function') return myNick(); }catch(_){}
    return store.get('hp:nick', '') || '';
  }

  function render(st){
    if(!G || G.over) return;
    const start = G.hold && G.hold.start || 'solo';
    const src = BASE + '?embed=1&start=' + start + '&name=' + encodeURIComponent(String(nick()).slice(0, 10));
    st.innerHTML = `<div class="hd-wrap" id="hdWrap">
      <div class="hd-load" id="hdLoad"><span class="hd19">19</span><b>로열 홀덤 여는 중…</b><button class="b2" id="hdBack">돌아가기</button></div>
      <iframe id="hdFrame" title="로열 홀덤" src="${src}" allow="clipboard-write; web-share; autoplay"></iframe></div>`;
    document.body.classList.add('hd-full');
    const back = () => { if(G && !G.over){ G.over = true; HOST.exit(); } };
    $('#hdBack').onclick = back;
    const onMsg = e => {
      if(e.origin !== ORIGIN || !e.data || typeof e.data !== 'object') return;
      if(e.data.holdem === 'ready'){ const l = $('#hdLoad'); if(l) l.classList.add('done'); }
      if(e.data.holdem === 'exit') back();
    };
    const fr = $('#hdFrame');
    fr.onload = () => { const l = $('#hdLoad'); if(l) l.classList.add('done'); };
    addEventListener('message', onMsg);
    G.cleanup = () => { removeEventListener('message', onMsg); document.body.classList.remove('hd-full'); };
  }

  return {
    name:'로열 홀덤', col:['#7FE0A8', '#1E7A4C', '#0B3A22'], time:'자유', abil:'전략력',
    modes:['solo', 'duel'],
    age:19,
    noSend:true,
    cardNote:() => '칩은 홀덤 안에서만 써요',
    /* 입구형 게임(사이트 공용 목록): 챕터·별·판 고르기 없이 버튼 하나, 하트 없음 */
    entry:{ tag:'AI · 친구 · 토너먼트', solo:'AI 대결 열기', duel:'친구 대전 열기', free:true },
    icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-2.6 3.2-6 5.4-6 8.6A3.4 3.4 0 0 0 11 14.5l-1.2 4.5h4.4L13 14.5a3.4 3.4 0 0 0 5-2.9C18 8.4 14.6 6.2 12 3z"/></svg>',
    art(){
      const u = 'hdA' + (++SVG_UID);
      const card = (x, y, a, r, s, red) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-17" y="-24" width="34" height="48" rx="4" fill="#fff" stroke="rgba(0,0,0,.25)"/><text x="-12" y="-9" font-size="13" font-weight="900" fill="${red ? '#D42A3C' : '#16181D'}" font-family="system-ui,sans-serif">${r}</text><text x="3" y="18" font-size="20" fill="${red ? '#D42A3C' : '#16181D'}" font-family="system-ui,sans-serif">${s}</text></g>`;
      const chip = (x, y, c) => `<g transform="translate(${x} ${y})"><circle r="9" fill="${c}"/><circle r="9" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="3.5 3.5"/><circle r="4" fill="#fff" fill-opacity=".85"/></g>`;
      return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="${u}" cx=".5" cy=".4" r=".85"><stop offset="0" stop-color="#2A8A57"/><stop offset="1" stop-color="#0B3A22"/></radialGradient></defs>
        <rect width="160" height="100" fill="url(#${u})"/><ellipse cx="80" cy="58" rx="70" ry="40" fill="none" stroke="#C8A15A" stroke-opacity=".35" stroke-width="3"/>
        ${card(62, 52, -12, 'A', '♠', false)}${card(86, 50, 9, 'A', '♥', true)}
        ${chip(30, 74, '#E0384D')}${chip(40, 66, '#2563EB')}${chip(124, 72, '#111827')}${chip(132, 63, '#D4A017')}
        <g transform="translate(136 20)"><circle r="14" fill="#fff" stroke="#D7263D" stroke-width="4"/><text y="5.5" font-size="15" font-weight="900" text-anchor="middle" fill="#1A0F45" font-family="system-ui,sans-serif">19</text></g></svg>`;
    },
    help:[
      ['좋은 5장을 만들어요', '내 카드 2장 + 바닥 카드 5장 중 가장 좋은 5장으로 겨뤄요. 로열 스트레이트 플러시가 가장 세고, 하이카드가 가장 약해요.'],
      ['베팅 네 번', '프리플롭(카드 2장) → 플랍(바닥 3장) → 턴(1장) → 리버(1장)마다 체크·콜·레이즈·폴드·올인 중에서 골라요.'],
      ['세 가지 모드', 'AI 대결(성격 다른 AI 5명) · 친구 대전(방 코드로 최대 6명) · 오늘의 토너먼트(모두 같은 카드, 30핸드 남은 칩으로 순위).'],
      ['19세 이상', '돈이나 상품을 걸 수 없어요. 칩은 홀덤 안에서만 쓰고, 하루퍼즐 점수·하트와는 따로예요. 홀덤 첫 화면의 [‹ 하루퍼즐]로 돌아와요.']
    ],
    howto:{ lines:['내 2장 + 바닥 5장으로 승부', '체크·콜·레이즈·폴드 중 골라요', '칩을 가장 많이 모으면 우승'], more:null },
    chapters:['동네 테이블', '카지노 입구', 'VIP 룸', '하이롤러', '챔피언 테이블'],
    starRule:'★ 홀덤 안에서 기록돼요',
    levels:{ easy:{ limit:0 }, normal:{ limit:0 }, hard:{ limit:0 } },
    levelDesc:() => 'AI 5명과 한 테이블',
    stage:() => ({ limit:0 }),
    stageDesc:() => 'AI 대결 · 친구 대전 · 오늘의 토너먼트',
    init(cfg, rng, lv){ G.hold = { start:G.duel ? 'friends' : 'solo' }; store.set('hp:help:' + ID, 1); },   /* 사이트 도움말 창은 안 띄움(홀덤 안에 족보·규칙이 있고, 창이 홀덤 뒤에 가려짐) */
    render,
    titleExtra:() => ' <span class="hd19 sm">19</span>',
    progress:() => 0,
    lossText:() => '홀덤을 닫았어요.',
    score:() => ({ base:0, time:0, extra:0, rows:['홀덤 칩은 홀덤 안에서만 기록돼요', '', ''] }),
    stars:() => 1,
    noConfetti:true,
    bodyClass:'hdmode',
    duelHow:'친구 대전 · 방 코드로 최대 6명 · 19세 이상',
    duelNoPts:true,
    duelNoPtsNote:() => '홀덤은 대전 포인트가 없어요 · 칩은 홀덤 안에서만 써요',
    duelLaunch(){ ageGate(() => startGame(ID, 'normal', { duel:{ fleet:true, mode:'ai', opp:{ nick:'친구 대전' } } })); },
    startGate(go){ ageGate(go); }
  };
})();
