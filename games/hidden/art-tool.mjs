// 숨은그림 장면 도구: 장면 그림(hidden-art.js)을 진짜 브라우저로 그려서 "숨길 자리"를 뽑아 hidden-art.js의 @spots 구역에 적는다.
//   node games/hidden/art-tool.mjs            (모든 장면)
//   node games/hidden/art-tool.mjs park beach (몇 장면만)
// 자리 고르는 법: 장면을 360×480으로 그린 뒤 반지름 19 원마다
//   - 선 밀도(ed): 원 안에서 색이 크게 바뀌는 픽셀 비율. 너무 비면(하늘 한복판) 물건이 혼자 드러나고, 너무 빽빽하면(얼굴·글자) 알아보기 어렵다 → 0.05~0.32만.
//   - 바탕색: 원 안에서 가장 많은 색(선 픽셀 빼고). 물건 색은 게임에서 이 색의 밝기만 바꿔 만든다(섞여 보이게).
//   - 자리끼리 44 이상 떨어지게(반지름 19 물건 둘이 어느 자리에 놓여도 겹치지 않음) → 어떤 조합을 골라도 판이 풀린다.
//   - 장면의 noSpot 사각형(사람 얼굴·글자 등)과 오른쪽 아래 확대 단추 자리는 뺀다.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ART = path.join(ROOT, 'games/hidden/hidden-art.js');
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if(!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type':p.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath:process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
await page.setContent(`<script src="${BASE}core/util.js"></script><script src="${BASE}games/hidden/hidden-art.js"></script>`);
await page.waitForFunction(() => window.HIDDEN_ART);
const only = process.argv.slice(2);
const out = await page.evaluate(async only => {
  const A = window.HIDDEN_ART, res = {};
  for(const sc of A.SC){
    if(only.length && !only.includes(sc.key)) continue;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${A.W}" height="${A.H}" viewBox="0 0 ${A.W} ${A.H}">${A.svgOf(sc, 'at')}</svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const cv = document.createElement('canvas'); cv.width = A.W; cv.height = A.H;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, A.W, A.H).data, Wd = A.W;
    const px = (x, y) => (y * Wd + x) * 4;
    const edge = new Uint8Array(A.W * A.H);
    for(let y = 0; y < A.H - 1; y++) for(let x = 0; x < A.W - 1; x++){
      const a = px(x, y), b = px(x + 1, y), c = px(x, y + 1);
      const e = Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]) + Math.abs(d[a] - d[c]) + Math.abs(d[a + 1] - d[c + 1]) + Math.abs(d[a + 2] - d[c + 2]);
      const dark = d[a] + d[a + 1] + d[a + 2] < 200;
      edge[y * Wd + x] = e > 90 || dark ? 1 : 0;
    }
    const R0 = 19, cand = [];
    const no = (sc.noSpot || []).concat(sc.faces || [], [[A.W - A.ZX, A.H - A.ZY, A.ZX, A.ZY]]);
    for(let y = R0 + 4; y <= A.H - R0 - 4; y += 4) for(let x = R0 + 4; x <= A.W - R0 - 4; x += 4){
      if(no.some(([rx, ry, rw, rh]) => x + R0 * .6 > rx && x - R0 * .6 < rx + rw && y + R0 * .6 > ry && y - R0 * .6 < ry + rh)) continue;
      let N = 0, E = 0; const hist = new Map();
      for(let dy = -R0; dy <= R0; dy++) for(let dx = -R0; dx <= R0; dx++){
        if(dx * dx + dy * dy > R0 * R0) continue;
        N++; const i = (y + dy) * Wd + x + dx;
        if(edge[i]){ E++; continue; }
        const a = i * 4, q = (d[a] >> 4) << 8 | (d[a + 1] >> 4) << 4 | d[a + 2] >> 4;
        const h = hist.get(q) || [0, 0, 0, 0]; h[0]++; h[1] += d[a]; h[2] += d[a + 1]; h[3] += d[a + 2]; hist.set(q, h);
      }
      let best = null; for(const h of hist.values()) if(!best || h[0] > best[0]) best = h;
      const ed = E / N, dom = best ? best[0] / N : 0;
      if(ed < .05 || ed > .32 || dom < .3) continue;
      const col = '#' + [best[1], best[2], best[3]].map(v => Math.round(v / best[0]).toString(16).padStart(2, '0')).join('');
      cand.push({ x, y, ed, dom, col, sc:1 - Math.abs(ed - .16) / .16 + .4 * dom });
    }
    cand.sort((a, b) => b.sc - a.sc);
    const pick = [], far = (c, m) => pick.every(p => Math.hypot(p.x - c.x, p.y - c.y) >= m);
    for(const m of [70, 56, 44]) for(const c of cand){ if(pick.length >= (sc.nSpots || 36)) break; if(far(c, m)) pick.push(c); }
    pick.sort((a, b) => a.y - b.y || a.x - b.x);
    res[sc.key] = pick.map(p => `${p.x} ${p.y} ${Math.round(p.ed * 100)} ${p.col.slice(1)}`).join(',');
  }
  return res;
}, only);
await browser.close(); srv.close();
let src = fs.readFileSync(ART, 'utf8');
const m = src.match(/\/\* @spots \*\/([\s\S]*?)\/\* @spots-end \*\//);
const cur = {};
if(m) for(const line of m[1].split('\n')){ const k = line.match(/^\s*(\w+):'([^']*)'/); if(k) cur[k[1]] = k[2]; }
Object.assign(cur, out);
const body = '\n' + Object.entries(cur).map(([k, v]) => `    ${k}:'${v}',`).join('\n') + '\n  ';
src = m ? src.replace(m[0], '/* @spots */' + body + '/* @spots-end */') : src;
fs.writeFileSync(ART, src);
for(const [k, v] of Object.entries(out)) console.log(`${k}: 자리 ${v.split(',').length}곳`);
