// 고스톱 화투 그림판 만들기: Wikimedia Commons "Category:SVG Hwatu"의 SVG 48장(JSON: {파일이름: SVG 글자})을 한 칸 W×(W×168.2/103.2) × 12열 4줄 WebP로 굽는다.
//   node tools/gostop-sprite.mjs 256 hwatu-commons.json  → _sprite.webp(→ games/gostop/gostop-cards.js에 base64로)
//   v1.4: 그림이 패에 꽉 차게 — 바깥 빨간 테두리를 얇게 잘라 내고(가운데 그림 둘레 2단위만 남김, 비율 그대로),
//         10배로 그린 뒤 줄여 굽고(부드러운 선), 모서리를 둥글게 투명 처리.
// 출처·라이선스: Marcus Richert(Louie Mantia, Jr. Hanafuda 기반), CC BY-SA 4.0
import { chromium } from 'playwright'; import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(process.argv[3] || 'hwatu-commons.json', 'utf8'));
/* v1.6: 새로 그린 화투(games/gostop/art/<같은 파일이름>.svg — 새 패·11월 똥, 오리지널)가 있으면 원본 대신 씀 */
const ART = 'games/gostop/art';
if(fs.existsSync(ART)) for(const f of fs.readdirSync(ART)) if(f.endsWith('.svg') && d[f]){ d[f] = fs.readFileSync(ART + '/' + f, 'utf8'); console.log('새 그림:', f); }
const M = ['January','February','March','April','May','June','July','August','September','October','November','December'];
/* 게임 패 번호 순서(월마다 k0..k3) */
const pick = m => { const n = M[m - 1], f = x => `Hwatu ${n} ${x}.svg`;
  if(m === 11) return ['Hikari', 'Kasu 2', 'Kasu 1', 'Kasu 3'].map(f);       /* 오동: 광 · 쌍피(붉은 바닥) · 피 · 피 */
  if(m === 12) return ['Hikari', 'Tane', 'Tanzaku', 'Kasu'].map(f);          /* 비: 광 · 제비 · 띠 · 쌍피(뇌고) */
  return [d[f('Hikari')] ? 'Hikari' : 'Tane', m === 8 ? 'Tane' : 'Tanzaku', 'Kasu 1', 'Kasu 2'].map(f); };
const order = []; for(let m = 1; m <= 12; m++) order.push(...pick(m));
fs.writeFileSync('games/gostop/sprite-order.json', JSON.stringify(order, null, 1));
/* 자를 곳(원본 103.2×168.2 단위): 흰 그림 칸(6.3~96.9, 7.2~161) 둘레에 빨강 2단위만 남기고, 패 비율(103.2:168.2)에 맞춤 */
const CH = 153.8 + 4, CW0 = CH * 103.2 / 168.2, CX = 51.6 - CW0 / 2, CY = 84.1 - CH / 2;
const W = +process.argv[2] || 256, H = Math.round(W * 168.2 / 103.2), COLS = 12, ROWS = 4;
const b = await chromium.launch(); const p = await b.newPage();
const url = await p.evaluate(async ({ svgs, W, H, COLS, ROWS, CX, CY, CW0, CH, QUAL }) => {
  const c = document.createElement('canvas'); c.width = W * COLS; c.height = H * ROWS; const x = c.getContext('2d');
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  const K = 10, R = W * .075;
  for(let i = 0; i < svgs.length; i++){
    const big = svgs[i].replace(/width="103\.2"/, `width="${103.2 * K}"`).replace(/height="168\.2"/, `height="${168.2 * K}"`);
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(big);
    await img.decode();
    const dx = (i % COLS) * W, dy = Math.floor(i / COLS) * H;
    /* 10배 그림 → 반씩 줄여 가며(계단 줄이기) 칸에 맞추기 = 부드러운 선 */
    let src = img, sx = CX * K, sy = CY * K, sw = CW0 * K, sh = CH * K;
    while(sw / 2 > W){
      const t = document.createElement('canvas'); t.width = Math.round(sw / 2); t.height = Math.round(sh / 2);
      const tx = t.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(src, sx, sy, sw, sh, 0, 0, t.width, t.height);
      src = t; sx = 0; sy = 0; sw = t.width; sh = t.height;
    }
    x.save(); x.beginPath(); x.roundRect(dx + .5, dy + .5, W - 1, H - 1, R); x.clip();
    x.drawImage(src, sx, sy, sw, sh, dx, dy, W, H);
    x.restore();
  }
  return [c.toDataURL('image/webp', +QUAL), c.toDataURL('image/png')];
}, { svgs:order.map(k => d[k]), W, H, COLS, ROWS, CX, CY, CW0, CH, QUAL:process.env.Q || '.84' });
fs.writeFileSync('_sprite.webp', Buffer.from(url[0].split(',')[1], 'base64'));
fs.writeFileSync('_sprite.png', Buffer.from(url[1].split(',')[1], 'base64'));
console.log(order.length, W, H, fs.statSync('_sprite.webp').size);
await b.close();
