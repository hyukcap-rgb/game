// 게임 코드가 여러 파일로 나뉜 뒤에도 tools/ 아래 도구들이 예전처럼 "한 덩어리 소스"를 읽을 수 있게 해 주는 도우미.
// index.html의 <link rel="stylesheet" href="…">와 <script src="…"></script>를 그 파일 내용으로 바꿔 끼운 글자를 돌려준다.
//   const { readSource, fileWith } = require('./source');
//   readSource()            → 한 파일로 합친 index.html 글자
//   fileWith('const BK_T')  → 그 글자가 들어 있는 실제 파일 경로(값을 고쳐 쓸 때)
// 한 파일짜리 html을 넘기면(예전 사본) 그대로 읽는다.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const LINK = /<link rel="stylesheet" href="([^"]+)">/g, SCRIPT = /<script src="([^"]+)"><\/script>/g;
const isLocal = p => !/^(https?:)?\/\//.test(p);

function parts(html){
  const out = [];
  for(const re of [LINK, SCRIPT]){ re.lastIndex = 0; let m; while((m = re.exec(html))) if(isLocal(m[1])) out.push(m[1]); }
  return out;
}
function readSource(file){
  const html = path.resolve(file || path.join(ROOT, 'index.html')), dir = path.dirname(html);
  const src = fs.readFileSync(html, 'utf8');
  const rd = p => fs.readFileSync(path.join(dir, p), 'utf8').replace(/\n$/, '');
  return src
    .replace(LINK, (all, p) => isLocal(p) ? '<style>\n' + rd(p) + '\n</style>' : all)
    .replace(SCRIPT, (all, p) => isLocal(p) ? '<script>\n' + rd(p) + '\n</script>' : all);
}
function fileWith(text, file){
  const html = path.resolve(file || path.join(ROOT, 'index.html')), dir = path.dirname(html);
  for(const p of parts(fs.readFileSync(html, 'utf8'))){ const f = path.join(dir, p); if(fs.readFileSync(f, 'utf8').includes(text)) return f; }
  return html;
}
module.exports = { readSource, fileWith, parts };
