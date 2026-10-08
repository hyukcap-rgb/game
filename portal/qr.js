/* ===================== QR 코드 만들기 (2026-10-08, 방 QR로 초대) =====================
   바깥 라이브러리 없이 직접 만드는 QR(바이트 모드 · 오류 복구 M · 버전 1~40 자동 · 마스크 8개 중 벌점 가장 낮은 것).
   qrSvg(글, 칸 크기) → <svg> 문자열(흰 여백 4칸 포함). 게임 상태·씨앗과 무관(보이기만). */
const QR_ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const QR_BLK_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
function qrRawModules(v){
  let r = (16 * v + 128) * v + 64;
  if(v >= 2){ const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if(v >= 7) r -= 36; }
  return r;
}
const qrDataCw = v => Math.floor(qrRawModules(v) / 8) - QR_ECC_M[v] * QR_BLK_M[v];
function qrGfMul(x, y){ let z = 0; for(let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
function qrRsDivisor(deg){
  const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
  for(let i = 0; i < deg; i++){
    for(let j = 0; j < r.length; j++){ r[j] = qrGfMul(r[j], root); if(j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = qrGfMul(root, 2);
  }
  return r;
}
function qrRsRem(data, div){
  const r = div.map(() => 0);
  for(const b of data){ const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= qrGfMul(c, f); }); }
  return r;
}
function qrAlignPos(v, size){
  if(v === 1) return [];
  const na = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2, r = [6];
  for(let p = size - 7; r.length < na; p -= step) r.splice(1, 0, p);
  return r;
}
function qrMake(text){
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let v = 1;
  for(; v <= 40; v++){ const cc = v <= 9 ? 8 : 16; if(4 + cc + bytes.length * 8 <= qrDataCw(v) * 8) break; }
  if(v > 40) return null;
  /* 데이터 비트 */
  const bits = [], put = (val, n) => { for(let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
  const cap = qrDataCw(v) * 8;
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
  for(let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
  const data = []; for(let i = 0; i < bits.length; i += 8){ let b = 0; for(let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  /* 블록 나누고 오류 복구 붙여 섞기 */
  const nb = QR_BLK_M[v], ecl = QR_ECC_M[v], raw = Math.floor(qrRawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
  const div = qrRsDivisor(ecl), blocks = [];
  for(let i = 0, k = 0; i < nb; i++){
    const d = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += d.length;
    const e = qrRsRem(d, div); if(i < nShort) d.push(0); blocks.push(d.concat(e));
  }
  const cw = [];
  for(let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if(i !== shortLen - ecl || j >= nShort) cw.push(b[i]); });
  /* 칸 그리기 */
  const size = v * 4 + 17, M = [], F = [];
  for(let y = 0; y < size; y++){ M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
  const fn = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
  for(let i = 0; i < size; i++){ fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for(let dy = -4; dy <= 4; dy++) for(let dx = -4; dx <= 4; dx++){ const x = cx + dx, y = cy + dy; if(x < 0 || y < 0 || x >= size || y >= size) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); fn(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = qrAlignPos(v, size), na = ap.length;
  for(let i = 0; i < na; i++) for(let j = 0; j < na; j++){
    if((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
    for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++) fn(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = mask => {
    const dat = (0 << 3) | mask; let rem = dat;   /* M = 0 */
    for(let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((dat << 10) | rem) ^ 0x5412, g = i => ((b >>> i) & 1) !== 0;
    for(let i = 0; i <= 5; i++) fn(8, i, g(i));
    fn(8, 7, g(6)); fn(8, 8, g(7)); fn(7, 8, g(8));
    for(let i = 9; i < 15; i++) fn(14 - i, 8, g(i));
    for(let i = 0; i < 8; i++) fn(size - 1 - i, 8, g(i));
    for(let i = 8; i < 15; i++) fn(8, size - 15 + i, g(i));
    fn(8, size - 8, true);
  };
  drawFormat(0);
  if(v >= 7){
    let rem = v; for(let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const b = (v << 12) | rem;
    for(let i = 0; i < 18; i++){ const d = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); fn(a, c, d); fn(c, a, d); }
  }
  let k = 0;
  for(let right = size - 1; right >= 1; right -= 2){
    if(right === 6) right = 5;
    for(let vert = 0; vert < size; vert++) for(let j = 0; j < 2; j++){
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if(!F[y][x] && k < cw.length * 8){ M[y][x] = ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
    }
  }
  /* 마스크: 8개 다 해 보고 벌점 낮은 것 */
  const MF = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const apply = m => { for(let y = 0; y < size; y++) for(let x = 0; x < size; x++) if(!F[y][x] && MF[m](x, y)) M[y][x] = !M[y][x]; };
  const penalty = () => {
    let p = 0, dark = 0;
    for(let a = 0; a < 2; a++) for(let i = 0; i < size; i++){
      let run = 1;
      for(let j = 1; j < size; j++){
        const c = a ? M[j][i] : M[i][j], pc = a ? M[j - 1][i] : M[i][j - 1];
        if(c === pc){ run++; if(run === 5) p += 3; else if(run > 5) p++; } else run = 1;
      }
    }
    for(let y = 0; y < size - 1; y++) for(let x = 0; x < size - 1; x++){ const c = M[y][x]; if(c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
    for(let y = 0; y < size; y++) for(let x = 0; x < size; x++) if(M[y][x]) dark++;
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };
  let best = 0, bp = Infinity;
  for(let m = 0; m < 8; m++){ apply(m); drawFormat(m); const p = penalty(); if(p < bp){ bp = p; best = m; } apply(m); }
  apply(best); drawFormat(best);
  return { size, mods:M, ver:v };
}
function qrSvg(text, px = 6){
  const q = qrMake(text); if(!q) return '';
  const n = q.size + 8; let d = '';
  for(let y = 0; y < q.size; y++) for(let x = 0; x < q.size; x++) if(q.mods[y][x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="qrsvg" viewBox="0 0 ${n} ${n}" width="${n * px}" height="${n * px}" shape-rendering="crispEdges" role="img" aria-label="QR 코드"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#1A0F45"/></svg>`;
}
