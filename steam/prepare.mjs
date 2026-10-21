/* 스팀 앱 준비: embed/tgostop.html(빌드 결과물)을 app/index.html로 복사하고,
   구글 글꼴 대신 앱 안에 넣은 글꼴(fonts/)을 쓰게 바꾼다 — 인터넷 없이도 글꼴이 같게 보이도록.
   게임 코드는 바꾸지 않는다. embed/tgostop.html이 낡았으면 먼저 저장소 루트에서 `node tools/build.js`. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SRC = path.join(root, 'embed', 'tgostop.html');
const OUT = path.join(here, 'app');
if(!fs.existsSync(SRC)){ console.error('embed/tgostop.html이 없어요. 저장소 루트에서 node tools/build.js 먼저.'); process.exit(1); }

fs.rmSync(OUT, { recursive:true, force:true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive:true });

/* 글꼴: 게임이 쓰는 굵기만 */
const FONTS = [
  ['noto-sans-kr', [400, 500, 700, 800]],
  ['jua', [400]],
  ['black-han-sans', [400]]
];
let css = '/* 앱에 넣은 글꼴(@fontsource, SIL Open Font License 1.1) */\n';
let files = 0;
for(const [pkg, weights] of FONTS){
  const dir = path.join(here, 'node_modules', '@fontsource', pkg);
  if(!fs.existsSync(dir)){ console.error(`글꼴 패키지 없음: @fontsource/${pkg} — steam 폴더에서 npm install`); process.exit(1); }
  fs.mkdirSync(path.join(OUT, 'fonts', pkg), { recursive:true });
  for(const w of weights){
    let c = fs.readFileSync(path.join(dir, `${w}.css`), 'utf8');
    c = c.replace(/,\s*url\(\.\/files\/[^)]+\.woff\)\s*format\('woff'\)/g, '');            /* woff2만 */
    c = c.replace(/url\(\.\/files\/([^)]+)\)/g, (_, f) => {
      fs.copyFileSync(path.join(dir, 'files', f), path.join(OUT, 'fonts', pkg, f)); files++;
      return `url(${pkg}/${f})`;
    });
    css += c + '\n';
  }
  for(const lic of ['LICENSE']) if(fs.existsSync(path.join(dir, lic))) fs.copyFileSync(path.join(dir, lic), path.join(OUT, 'fonts', pkg, 'LICENSE.txt'));
}
fs.writeFileSync(path.join(OUT, 'fonts', 'fonts.css'), css);

let html = fs.readFileSync(SRC, 'utf8');
const before = html.length;
html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
html = html.replace('</head>', '<link rel="stylesheet" href="fonts/fonts.css">\n</head>');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

/* 아이콘(없으면 저장소 icon.png) */
fs.mkdirSync(path.join(here, 'build'), { recursive:true });
if(!fs.existsSync(path.join(here, 'build', 'icon.png'))) fs.copyFileSync(path.join(root, 'icon.png'), path.join(here, 'build', 'icon.png'));

console.log(`app/index.html 준비 완료 (${(before / 1024 | 0)}KB → ${(html.length / 1024 | 0)}KB), 글꼴 파일 ${files}개`);
