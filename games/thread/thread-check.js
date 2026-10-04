/* 색실 잇기 문제 목록 점검 (node 전용, game.json에 넣지 않음)
     node games/thread/thread-check.js
   - 모든 줄: 정답 길이 단추에서 짝 단추까지 이어지고, 칸을 빠짐없이(다리는 두 층) 덮고, 벽·헝겊을 지나지 않는지
   - 갈래별 개수·단추 쌍 수·점수 범위
   - 솔로 1~60판·오늘의 문제 세 난이도를 여러 씨앗으로 만들어 보고 시간 재기 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const ctx = { NG:{}, console, performance, Math, Set, Map };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core/util.js'), 'utf8').split('\n').filter(l => /^(function (shuffle|mulberry|seedFrom)|const (mulberry|seedFrom))/.test(l) || false).join('\n'), ctx);
const eng = fs.readFileSync(path.join(ROOT, 'core/engine.js'), 'utf8');
const grab = name => { const i = eng.indexOf('function ' + name + '('); let d = 0, j = eng.indexOf('{', i); for(let k = j; k < eng.length; k++){ if(eng[k] === '{') d++; else if(eng[k] === '}'){ d--; if(!d) return eng.slice(i, k + 1); } } };
const util = fs.readFileSync(path.join(ROOT, 'core/util.js'), 'utf8');
vm.runInContext(util.replace(/^const \$ =.*$/m, ''), ctx);
vm.runInContext('const TWISTS = {}; const CONCEPTS = {};\n' + grab('cyclePlan') + '\n' + grab('conceptsOf') + '\n' + grab('planOf') + '\nthis.planOf = planOf;', ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'thread-bank.js'), 'utf8') + '\nthis.THREAD_BANK = THREAD_BANK;', ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'thread.js'), 'utf8'), ctx);
const TH = ctx.NG.thread, B = ctx.THREAD_BANK;
let bad = 0, total = 0;
const rows = [];
for(const key of Object.keys(B)){
  const L = B[key]; let kmin = 99, kmax = 0;
  L.forEach((line, li) => {
    total++;
    const N = +key[0], fl = key.slice(1);
    /* 이 줄만 고르도록: lo/hi로 정확히 집어서 */
    const P = TH._make({ size:N, flags:fl, lo:li / L.length, hi:(li + 1) / L.length }, ctx.mulberry(li + 1));
    const seen = new Set(); let ok = true;
    P.sol.forEach((p, k) => {
      const a = p[0] >> 1, b = p[p.length - 1] >> 1;
      if(P.endc[a] !== k || P.endc[b] !== k || a === b || p.length < 3) ok = false;
      p.forEach(x => { if(seen.has(x)) ok = false; seen.add(x); });
    });
    let need = 0; P.type.forEach(t => { need += t === 'hole' ? 0 : t === 'bridge' ? 2 : 1; });
    if(seen.size !== need) ok = false;
    P.bead.forEach((k, i) => { if(k >= 0 && !P.sol[k].includes(i * 2)) ok = false; });
    if(!ok){ bad++; if(bad < 5) console.log('✗', key, li, line); }
    kmin = Math.min(kmin, P.K); kmax = Math.max(kmax, P.K);
  });
  const sc = L.map(l => +l.split('|')[4]);
  rows.push(`${key.padEnd(5)} ${String(L.length).padStart(3)}판  쌍 ${kmin}~${kmax}  점수 ${Math.min(...sc)}~${Math.max(...sc)}`);
}
console.log(rows.join('\n'));
console.log(`\n목록 ${total}판 점검: ${bad ? '✗ 실패 ' + bad : '✓ 모두 풀림'}`);
/* 솔로·오늘의 문제 만들기 */
let t0 = Date.now(), made = 0;
for(let n = 1; n <= 60; n++) for(let s = 0; s < 5; s++){ const P = TH._make(TH._stage(n), ctx.mulberry(n * 100 + s)); if(!P.sol.every(p => p.length >= 3)) { bad++; console.log('✗ 스테이지', n); } made++; }
for(const lv of ['easy', 'normal', 'hard']) for(let s = 0; s < 30; s++){ TH._make(TH.levels[lv], ctx.mulberry(s)); made++; }
console.log(`판 만들기 ${made}번: 평균 ${((Date.now() - t0) / made).toFixed(2)}ms`);
const st = n => { const c = TH._stage(n); return `${n}:${c.size}${c.flags || ''}${c.tw ? '/' + c.tw : ''}`; };
console.log('솔로 예: ' + [1, 5, 6, 10, 11, 15, 16, 21, 24, 26, 31, 36, 41, 44, 46, 50, 51, 55, 60].map(st).join(' '));
process.exit(bad ? 1 : 0);
