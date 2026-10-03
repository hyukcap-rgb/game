// 고스톱 화투 그림판 만들기: Wikimedia Commons "Category:SVG Hwatu"의 SVG 48장(JSON: {파일이름: SVG 글자})을 176×287 × 12열 4줄 WebP로 굽는다.
//   node tools/gostop-sprite.mjs 176 hwatu-commons.json  → _sprite.webp(→ games/gostop/gostop-cards.js에 base64로)
// 출처·라이선스: Marcus Richert(Louie Mantia, Jr. Hanafuda 기반), CC BY-SA 4.0
import { chromium } from 'playwright'; import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(process.argv[3] || 'hwatu-commons.json', 'utf8'));
const M = ['January','February','March','April','May','June','July','August','September','October','November','December'];
/* 게임 패 번호 순서(월마다 k0..k3) */
const pick = m => { const n = M[m - 1], f = x => `Hwatu ${n} ${x}.svg`;
  if(m === 11) return ['Hikari', 'Kasu 2', 'Kasu 1', 'Kasu 3'].map(f);       /* 오동: 광 · 쌍피(붉은 바닥) · 피 · 피 */
  if(m === 12) return ['Hikari', 'Tane', 'Tanzaku', 'Kasu'].map(f);          /* 비: 광 · 제비 · 띠 · 쌍피(뇌고) */
  return [d[f('Hikari')] ? 'Hikari' : 'Tane', m === 8 ? 'Tane' : 'Tanzaku', 'Kasu 1', 'Kasu 2'].map(f); };
const order = []; for(let m = 1; m <= 12; m++) order.push(...pick(m));
fs.writeFileSync('games/gostop/sprite-order.json', JSON.stringify(order, null, 1));
const W = +process.argv[2] || 176, H = Math.round(W * 168.2 / 103.2), COLS = 12, ROWS = 4;
const b = await chromium.launch(); const p = await b.newPage();
const url = await p.evaluate(async ({ svgs, W, H, COLS, ROWS }) => {
  const c = document.createElement('canvas'); c.width = W * COLS; c.height = H * ROWS; const x = c.getContext('2d');
  for(let i = 0; i < svgs.length; i++){
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgs[i]);
    await img.decode(); x.drawImage(img, (i % COLS) * W, Math.floor(i / COLS) * H, W, H);
  }
  return [c.toDataURL('image/webp', .86), c.toDataURL('image/png')];
}, { svgs:order.map(k => d[k]), W, H, COLS, ROWS });
fs.writeFileSync('_sprite.webp', Buffer.from(url[0].split(',')[1], 'base64'));
fs.writeFileSync('_sprite.png', Buffer.from(url[1].split(',')[1], 'base64'));
console.log(order.length, W, H, fs.statSync('_sprite.webp').size);
await b.close();
