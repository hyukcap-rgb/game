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
//  4) embed/games.json: 붙일 수 있는 게임 목록(이름·버전·크기).
// 압축 도구가 없으면(npm install 전) 압축 없이 합치기만 한다.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const wr = (p, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive:true }); fs.writeFileSync(path.join(ROOT, p), s); };
let esbuild = null; try{ esbuild = require('esbuild'); }catch(_){ console.warn('※ esbuild가 없어 압축 없이 만듭니다(npm install 하면 압축).'); }

/* 엔진·사이트 파일(순서 중요) */
const CORE_CSS = ['core/base.css', 'core/effects.css'];
const PLAY_CSS = ['core/play.css'];
const CORE_JS = ['core/util.js', 'core/engine.js', 'core/effects-sound.js', 'core/scene.js', 'core/net.js', 'core/duel.js'];
const PORTAL_CSS = ['portal/portal.css'];
const PORTAL_JS = ['portal/portal.js', 'portal/viral.js', 'portal/friends.js', 'portal/start.js'];
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
  wr('embed/games.json', JSON.stringify({ version:pkg.version, games:info }, null, 2) + '\n');
  console.log(`사이트 index.html 목록: CSS ${css.length}개 · JS ${js.length}개`);
})().catch(e => { console.error(e); process.exit(1); });
