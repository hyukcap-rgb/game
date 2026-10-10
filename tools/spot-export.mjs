// 틀린그림 그림 내보내기: 틀린그림 게임(games/spot)의 장면을 PNG 짝(원본·틀린 그림)과 정답 파일로 뽑는다.
// 위·아래 그림은 PNG와 SVG(벡터)로 내보낸다. 꾸밈(그림자·빛·질감)은 tools/spot-deco.mjs.
// 사용: node tools/spot-export.mjs [개수=40] [차이=7] [가로픽셀=1600] [내보낼폴더=out/spot-diff]
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { chromium } from 'playwright';
import { deco } from './spot-deco.mjs';
const [N = 40, DIFFS = 7, PX = 1600, OUT = 'out/spot-diff'] = process.argv.slice(2);
const read = f => fs.readFileSync(f, 'utf8');
const ctx = { console, NG: {}, document: {}, window: {}, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(read('core/util.js') + '\n' + read('games/spot/spot-art.js') + '\n' + read('games/spot/spot.js') +
  '\n;globalThis.__spot = NG.spot; globalThis.__art = SPOT_ART; globalThis.__mul = mulberry; globalThis.__seed = seedFrom;', ctx);
const S = ctx.__spot, W = 320, H = 240;
const THEMES = S._themes, names = { town:'마을', park:'공원', kitchen:'부엌', beach:'바닷가', space:'우주', class:'교실', play:'놀이터', alley:'옛골목' };
fs.mkdirSync(OUT, { recursive: true });
const svgWrap = (inner, marks = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${PX}" height="${Math.round(PX * H / W)}"><defs><clipPath id="c"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#c)">${inner}</g>${marks}</svg>`;
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: +PX, height: Math.round(PX * H / W) } });
const shot = async (svg, file) => { await page.setContent(`<body style="margin:0">${svg}</body>`); await page.screenshot({ path: file, clip: { x: 0, y: 0, width: +PX, height: Math.round(PX * H / W) } }); };
const answers = [];
for (let i = 0; i < +N; i++) {
  const theme = THEMES[i % THEMES.length];
  const rng = ctx.__mul(ctx.__seed(`spot-export:${i + 1}`));
  const g = S._gen({ diffs: +DIFFS, theme }, rng, THEMES);
  if (!g.ok) throw new Error(`장면 ${i + 1} 실패`);
  const id = String(i + 1).padStart(2, '0'), base = `${OUT}/${id}_${names[theme]}`;
  const P = ctx.__art.P, dr = ctx.__mul(ctx.__seed(`deco:${i + 1}`)), dc = deco(theme, [], P, dr, W, H);
  /* 꾸밈은 위·아래 그림에 똑같이(그림자는 각 그림의 조각 위치대로) */
  const objSvgs = objs => objs.map((o, k) => `<g id="o${k}">${deco(theme, [o], P, ctx.__mul(1), W, H).shadows}${S._svg('', [o]) || '<rect width=".1" height=".1" opacity="0"/>'}</g>`);
  const scene = objs => dc.defs + String(g.bg) + dc.under + objSvgs(objs).join('') + dc.over;
  const A = svgWrap(scene(g.A)), B = svgWrap(scene(g.B)), Bsvg = scene(g.B);
  const marks = g.diffs.map(d => `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r + 2}" fill="none" stroke="#fff" stroke-width="5"/><circle cx="${d.cx}" cy="${d.cy}" r="${d.r + 2}" fill="none" stroke="#E11D74" stroke-width="2.6"/>`).join('');
  fs.writeFileSync(`${base}_원본.svg`, A); fs.writeFileSync(`${base}_틀린그림.svg`, B);
  await shot(A, `${base}_원본.png`); await shot(B, `${base}_틀린그림.png`); await shot(svgWrap(Bsvg, marks), `${base}_정답.png`);
  answers.push({ no: i + 1, theme: names[theme], width: W, height: H, diffs: g.diffs.map(d => ({ x: +(d.cx / W).toFixed(4), y: +(d.cy / H).toFixed(4), r: +(d.r / W).toFixed(4), kind: d.kind })) });
}
fs.writeFileSync(`${OUT}/answers.json`, JSON.stringify(answers, null, 1));
await browser.close(); console.log(`${N}쌍 완료 → ${OUT}`);
