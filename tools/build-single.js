// 여러 파일로 나뉜 게임을 html 파일 하나로 합친다(Claude 공유 링크·프로젝트 문서용 사본).
// 사용: node tools/build-single.js [나올 파일=하루퍼즐_한파일.html]
// 그림(icon.png·og.png)은 합치지 않으므로 같은 폴더에 두면 된다. 평소 GitHub Pages는 나뉜 그대로 쓰면 된다.
const fs = require('fs'), path = require('path');
const { readSource } = require('./source');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', '하루퍼즐_한파일.html'));
const html = readSource();
fs.writeFileSync(out, html);
console.log('만듦:', out, Math.round(html.length / 1024) + 'KB');
