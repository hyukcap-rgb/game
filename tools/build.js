// 하루퍼즐 빌드: 게임마다 "붙여 쓰는 모듈" 한 파일(embed/<게임>.html)을 만들고, 사이트(index.html)의 파일 목록을 맞춘다.
//
//   npm install          (처음 한 번: 압축 도구 esbuild)
//   node tools/build.js  (게임·엔진을 고친 뒤 매번)
//
// 하는 일
//  1) games/*/game.json을 읽어 게임 목록·파일 순서를 정한다(order 순).
//  2) index.html의 <!-- @build:css --> · <!-- @build:js --> 사이를 다시 쓴다(손으로 고치지 않기).
//  3) embed/<게임>.html: 공용 엔진(core) + 그 게임 파일만 + 모듈 셸(embed/shell.*)을 합쳐 압축한 한 파일.
//     다른 게임 코드는 들어가지 않는다 → 작고 빠름, 다른 사이트 CSS·JS와 섞이지 않음(iframe).
//  4) embed/games.json: 붙일 수 있는 게임 목록(이름·버전·크기). 은퇴한 게임은 retired 목록(주소는 안내 화면으로 남음).
// 압축 도구가 없으면(npm install 전) 압축 없이 합치기만 한다.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const wr = (p, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive:true }); fs.writeFileSync(path.join(ROOT, p), s); };
let esbuild = null; try{ esbuild = require('esbuild'); }catch(_){ console.warn('※ esbuild가 없어 압축 없이 만듭니다(npm install 하면 압축).'); }

/* 엔진·사이트 파일(순서 중요) */
const CORE_CSS = ['core/base.css', 'core/effects.css'];
const PLAY_CSS = ['core/play.css', 'core/duel.css'];   /* duel.css: 대전 v3 화면(칩 줄·알림·찾기 창) */
const CORE_JS = ['core/util.js', 'core/engine.js', 'core/effects-sound.js', 'core/scene.js', 'core/net.js', 'core/duel.js'];
const PORTAL_CSS = ['portal/portal.css'];
const PORTAL_JS = ['portal/portal.js', 'portal/viral.js', 'portal/friends.js', 'portal/events.js', 'portal/duel-ui.js', 'portal/qr.js', 'portal/rooms.js', 'portal/replay.js', 'portal/start.js'];
const EMBED_CSS = ['embed/shell.css'], EMBED_JS = ['embed/shell.js'];

function games(){
  const dirs = fs.readdirSync(path.join(ROOT, 'games')).filter(d => fs.existsSync(path.join(ROOT, 'games', d, 'game.json')));
  const list = dirs.map(d => Object.assign({ dir:'games/' + d }, JSON.parse(rd('games/' + d + '/game.json'))));
  const bad = [];
  for(const g of list){
    if(g.id !== path.basename(g.dir)) bad.push(`${g.dir}/game.json: id(${g.id})가 폴더 이름과 달라요`);
    for(const f of [...(g.js || []), ...(g.css || [])]) if(!fs.existsSync(path.join(ROOT, g.dir, f))) bad.push(`${g.dir}/${f} 파일이 없어요`);
    const src = (g.js || []).map(f => rd(g.dir + '/' + f)).join('\n');
    if(!new RegExp('NG\\.' + g.id + '\\s*=').test(src)) bad.push(`${g.dir}: 게임 정의 NG.${g.id} = {...} 가 없어요(games/CLAUDE.md 참고)`);
  }
  if(bad.length){ console.error('게임 목록 오류:\n - ' + bad.join('\n - ')); process.exit(1); }
  return list.sort((a, b) => (a.order || 99) - (b.order || 99) || a.id.localeCompare(b.id));
}
const G = games();
const gameCss = g => (g.css || []).map(f => g.dir + '/' + f);
const gameJs = g => (g.js || []).map(f => g.dir + '/' + f);

/* ---- 1) 사이트 index.html 목록 ---- */
function between(html, tag, body){
  const a = `<!-- @build:${tag}`, b = '<!-- @end -->';
  const i = html.indexOf(a); if(i < 0) throw new Error('index.html에 ' + a + ' 표시가 없어요');
  const j = html.indexOf(b, i); const head = html.slice(i, html.indexOf('-->', i) + 3);
  return html.slice(0, i) + head + '\n' + body + '\n' + html.slice(j);
}
let index = rd('index.html');
const css = [...CORE_CSS, ...G.flatMap(gameCss), ...PLAY_CSS, ...PORTAL_CSS];
const js = [...CORE_JS, ...G.flatMap(gameJs), ...PORTAL_JS];
index = between(index, 'css', css.map(f => `<link rel="stylesheet" href="${f}">`).join('\n'));
index = between(index, 'js', js.map(f => `<script src="${f}"></script>`).join('\n'));
wr('index.html', index);

/* ---- 은퇴한 게임(결정 220): games/에서 지운 게임의 모듈 주소는 90일 동안 "이 게임은 종료됐어요" 안내 화면으로 남긴다.
   안내 화면도 모듈처럼 ready 이벤트를 보내고, 거기에 retired:true를 더한다(이벤트는 더하기만). until이 지나면 목록에서 지워도 된다. ---- */
const RETIRED = [
  { id:'tower', name:'숲 지킴이', until:'2027-01-04' }
];
const escH = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function retiredPage(r, games, ver){
  const list = games.map(g => ({ id:g.id, name:g.name }));
  return `<!doctype html>
<html lang="ko" data-game="${r.id}" data-ver="retired+${ver}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escH(r.name)} · 종료된 게임 · 하루퍼즐</title>
<meta name="theme-color" content="#1C1250">
<meta name="robots" content="noindex">
<style>
:root{ --bg:#1C1250; --card:#FFFDF6; --ink:#2A1F5C; --sub:#6B6290; --pri:#FF7A1F; --line:#E7DFC8; }
*{ box-sizing:border-box; }
html,body{ margin:0; min-height:100%; background:var(--bg); color:var(--ink); font-family:'Noto Sans KR', system-ui, -apple-system, sans-serif; }
.wrap{ max-width:480px; margin:0 auto; padding:24px 16px 32px; }
.card{ background:var(--card); border-radius:20px; padding:22px 18px; box-shadow:0 6px 0 rgba(0,0,0,.25); }
h1{ margin:0 0 6px; font-size:22px; line-height:1.3; }
p{ margin:0 0 10px; font-size:16px; line-height:1.55; color:var(--sub); }
.k{ display:inline-block; margin-bottom:10px; padding:3px 10px; border-radius:99px; background:#FFE7D3; color:#B4470A; font-size:13px; font-weight:700; }
h2{ margin:18px 0 8px; font-size:16px; }
ul{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:1fr 1fr; gap:8px; }
a.g{ display:flex; align-items:center; min-height:48px; padding:10px 12px; border:2px solid var(--line); border-radius:14px; color:var(--ink); text-decoration:none; font-size:15px; font-weight:700; background:#fff; }
a.g:active{ transform:translateY(1px); }
.site{ display:block; margin-top:16px; min-height:52px; line-height:52px; text-align:center; border-radius:16px; background:var(--pri); color:#fff; font-weight:800; font-size:17px; text-decoration:none; }
button.x{ display:none; width:100%; margin-top:10px; min-height:48px; border:0; border-radius:14px; background:#ECE6F7; color:var(--ink); font-size:16px; font-weight:700; }
</style>
</head>
<body>
<div class="wrap"><div class="card" role="main">
  <span class="k">종료된 게임</span>
  <h1>‘${escH(r.name)}’ 게임은 종료됐어요</h1>
  <p>그동안 즐겨 주셔서 고마워요. 모은 별과 기록은 하루퍼즐 리그에 그대로 남아 있어요.</p>
  <p>아래 다른 게임을 골라 계속 즐겨 보세요.</p>
  <h2>다른 게임</h2>
  <ul id="list">${list.map(g => `<li><a class="g" data-id="${g.id}" href="${g.id}.html">${escH(g.name)}</a></li>`).join('')}</ul>
  <a class="site" href="../index.html" target="_top">하루퍼즐 리그 사이트로</a>
  <button class="x" id="closeBtn" type="button">나가기</button>
</div></div>
<script>
(function(){
  var q = new URLSearchParams(location.search), origin = q.get('origin') || '*', ver = document.documentElement.dataset.ver;
  /* 다른 게임 링크에 같은 주소 옵션(ns·user·origin·mode 등)을 그대로 넘김 */
  var qs = location.search;
  Array.prototype.forEach.call(document.querySelectorAll('a.g'), function(a){ a.href = a.dataset.id + '.html' + qs; });
  function emit(type, data){
    var msg = { source:'haru-puzzle', type:type, game:${JSON.stringify(r.id)}, ver:ver };
    for(var k in (data || {})) msg[k] = data[k];
    try{ if(window.parent && window.parent !== window) window.parent.postMessage(msg, origin); }catch(_){}
    var json = JSON.stringify(msg);
    try{ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(json); }catch(_){}
    try{ if(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haruPuzzle) window.webkit.messageHandlers.haruPuzzle.postMessage(msg); }catch(_){}
    try{ if(window.HaruPuzzle && typeof window.HaruPuzzle.postMessage === 'function') window.HaruPuzzle.postMessage(json); }catch(_){}
    try{ window.dispatchEvent(new CustomEvent('haru-puzzle', { detail:msg })); }catch(_){}
  }
  if(q.get('close') === '1'){ var b = document.getElementById('closeBtn'); b.style.display = 'block'; b.onclick = function(){ emit('close', {}); }; }
  /* 은퇴 안내: ready에 retired:true를 더함(이름·modes는 예전과 같은 자리, modes는 빈 목록) */
  emit('ready', { name:${JSON.stringify(r.name)}, modes:[], retired:true, until:${JSON.stringify(r.until)}, games:${JSON.stringify(list.map(g => g.id))} });
  emit('resize', { height:document.documentElement.scrollHeight });
})();
</script>
</body>
</html>
`;
}

/* ---- 2) 게임마다 모듈 한 파일 ---- */
const frame = rd('embed/frame.html');
const pkg = (() => { try{ return JSON.parse(rd('package.json')); }catch(_){ return { version:'1.0.0' }; } })();
const kb = n => (n / 1024).toFixed(1) + 'KB';
async function minJs(code){ return esbuild ? (await esbuild.transform(code, { loader:'js', minify:true, target:'es2020', charset:'utf8', legalComments:'none' })).code : code; }
async function minCss(code){ return esbuild ? (await esbuild.transform(code, { loader:'css', minify:true, charset:'utf8', legalComments:'none' })).code : code; }
(async () => {
  const info = [];
  for(const g of G){
    const cssSrc = [...CORE_CSS, ...gameCss(g), ...PLAY_CSS, ...EMBED_CSS].map(rd).join('\n');
    /* 파일을 한 스크립트로 이어 붙임(각 파일 끝에 줄바꿈·세미콜론) */
    const jsSrc = [...CORE_JS, ...gameJs(g), ...EMBED_JS].map(f => `/* ${f} */\n` + rd(f)).join('\n;\n');
    const [c, j] = await Promise.all([minCss(cssSrc), minJs(jsSrc)]);
    if(/<\/script/i.test(j) || /<\/style/i.test(c)) throw new Error(g.id + ': 코드 안에 </script> 또는 </style> 글자가 있어요');
    const ver = (g.version || '1.0.0') + '+' + pkg.version;
    const html = frame.replace(/\{\{ID\}\}/g, g.id).replace(/\{\{NAME\}\}/g, g.name).replace(/\{\{VER\}\}/g, ver)
      .replace('{{CSS}}', () => c).replace('{{JS}}', () => j);
    wr(`embed/${g.id}.html`, html);
    const gz = zlib.gzipSync(html).length;
    info.push({ id:g.id, name:g.name, version:g.version, summary:g.summary, duel:g.duel !== false, file:`${g.id}.html`, bytes:html.length, gzip:gz });
    console.log(`embed/${g.id}.html  ${kb(html.length)} (전송 시 약 ${kb(gz)})`);
  }
  /* 은퇴한 게임: 이미 붙여 쓰는 곳이 깨지지 않게 주소(embed/<id>.html)를 안내 화면으로 남긴다 */
  for(const r of RETIRED){
    if(G.some(g => g.id === r.id)) throw new Error(r.id + ': 은퇴 목록(RETIRED)과 games/ 폴더에 함께 있어요');
    const html = retiredPage(r, G, pkg.version);
    wr(`embed/${r.id}.html`, html);
    console.log(`embed/${r.id}.html  은퇴 안내(${r.until}까지) ${kb(html.length)}`);
  }
  wr('embed/games.json', JSON.stringify({ version:pkg.version, games:info, retired:RETIRED.map(r => ({ id:r.id, name:r.name, file:`${r.id}.html`, until:r.until })) }, null, 2) + '\n');
  console.log(`사이트 index.html 목록: CSS ${css.length}개 · JS ${js.length}개`);
})().catch(e => { console.error(e); process.exit(1); });
