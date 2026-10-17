/* 사이트 디자인 테마(2026-10-12 대표 지시: 내 정보 ⚙ 설정에서 바꾸기 · 2026-10-18 기본은 네온 아레나)
   - 화면 모양은 portal/theme.css가 html[data-theme=…]로 덮어쓴다. classic(밤하늘)은 덮어쓰기 없음(지금 그대로).
   - 게임 플레이 화면(core/play.css, games/*)은 바꾸지 않는다(theme.css가 body[data-mode]일 때는 건드리지 않음).
   - 첫 그림 깜빡임 방지: index.html <head>의 작은 스크립트가 같은 저장값('hp:theme')을 먼저 읽어 붙인다. */
const THEMES = [
  { id:'neon',    name:'네온 아레나', desc:'어두운 경기장 · 네온 빛', sw:['#0B0F2A', '#161B45', '#FF2E88', '#22D3EE', '#FFD43B'] },
  { id:'classic', name:'밤하늘',      desc:'지금까지의 보라 광장',   sw:['#1C1250', '#6C3CE0', '#FFC93C', '#F0368A', '#FFF8EA'] },
  { id:'ticket',  name:'티켓 부스',   desc:'종이 티켓 · 굵은 테두리', sw:['#FFF4E2', '#2B1B12', '#E8443A', '#1B9AAA', '#FFC21A'] },
  { id:'jelly',   name:'말랑 젤리',   desc:'밝은 파스텔 · 둥근 카드', sw:['#F3F0FF', '#FFFFFF', '#7C5CFF', '#FF7EA8', '#FFC83D'] },
];
const THEME_DEF = 'neon';   /* 2026-10-18 대표 지시: 기본 테마를 네온 아레나로(직접 고른 사람은 그대로) */
/* 테마마다 주소창 색(theme-color) */
const THEME_BAR = { ticket:'#FFF4E2', classic:'#1C1250', neon:'#0B0F2A', jelly:'#F3F0FF' };
function curTheme(){ const t = store.get('hp:theme', THEME_DEF); return THEMES.some(x => x.id === t) ? t : THEME_DEF; }
function themeApply(id){
  const h = document.documentElement;
  h.setAttribute('data-theme', id);
  h.classList.toggle('th', id !== 'classic');   /* classic 말고는 밤하늘 배경 장면을 끔 */
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content', THEME_BAR[id] || '#1C1250');
}
function setTheme(id){
  if(!THEMES.some(x => x.id === id)) id = THEME_DEF;
  store.set('hp:theme', id); themeApply(id); themeScene();
}
/* 홈 배경 장면(반짝이는 별·별똥별)은 밤하늘 테마에서만. 다른 테마는 CSS 바탕만(가볍고 글자 대비가 좋음) */
function themeScene(){ try{ sceneHome(curTheme() === 'classic' ? THEME_SCENE : null); }catch(_){} }
const THEME_SCENE = { kind:'stars', colors:['#FFFFFF','#FFE9A8','#CFC5FF'], density:.7 };   /* 밤하늘 테마의 반짝이는 별·별똥별 */
themeApply(curTheme());
