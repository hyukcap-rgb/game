/* 오목 오늘의 묘수풀이 점검 도구 (사이트·모듈에는 들어가지 않는 개발용 스크립트)
   사용: node games/omok/puzzle-check.mjs [시작 날짜 YYYY-MM-DD] [날 수]   (기본: 오늘부터 60일)
   - 엔진과 같은 씨앗('exam:' + 날짜 + ':omok')으로 쉬움·보통·어려움 묘수를 만들고
   - ① 정답 길이가 화면에 보이는 N수와 같은지(N−1수로는 못 이김 = 가장 짧은 길),
   - ② 실제 게임처럼 상대(어려움 컴퓨터, 같은 씨앗 응답)가 막아도 N수 안에 이기는지,
   - ③ 정답의 모든 수가 둘 수 있는 자리인지(흑 3·3 금지 아님)를 확인한다.
   하나라도 틀리면 종료 코드 1. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const ctx = vm.createContext({ NG:{}, console, performance, Math, Int8Array, Set, Map });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core/util.js'), 'utf8'), ctx, { filename:'util.js' });
vm.runInContext(fs.readFileSync(path.join(HERE, 'omok.js'), 'utf8'), ctx, { filename:'omok.js' });
const { mulberry, seedFrom } = vm.runInContext('({ mulberry, seedFrom })', ctx);
const OM = vm.runInContext('NG.omok', ctx), R = OM._rules, LV = OM.levels;

const day0 = process.argv[2] ? new Date(process.argv[2] + 'T00:00:00') : new Date();
const days = +(process.argv[3] || 60);
const dk = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

let bad = 0, n = 0, maxMs = 0, sumMs = 0;
for(let k = 0; k < days; k++){
  const d = new Date(day0); d.setDate(d.getDate() + k);
  for(const lv of ['easy', 'normal', 'hard']){
    const cfg = LV[lv], rng = mulberry(seedFrom('exam:' + dk(d) + ':omok'));
    const t0 = performance.now();
    const pz = R.makePuzzle(rng, { n:cfg.n, N:cfg.N, side:cfg.side, rocks:0 });
    const ms = performance.now() - t0; maxMs = Math.max(maxMs, ms); sumMs += ms; n++;
    const seedStr = 'om' + Math.floor(rng() * 1e9);   /* init()과 같은 순서로 응답 씨앗 */
    const side = pz.side, opp = 3 - side, B = { n:pz.n, b:Int8Array.from(pz.b) }, errs = [];
    if(pz.N !== cfg.N) errs.push(`N ${pz.N}≠${cfg.N}`);
    if(R.vcfSolve({ n:B.n, b:B.b.slice() }, side, pz.N - 1, 200000)) errs.push('더 짧은 길이 있음');
    /* 실제 대국처럼: 내가 정답 길의 첫 수 → 어려움 컴퓨터 응답 → 반복 */
    const hist = []; let won = false;
    for(let mv = 0; mv < pz.N && !won; mv++){
      const v = R.vcfSolve({ n:B.n, b:B.b.slice() }, side, pz.N - mv, 200000);
      if(!v){ errs.push(`${mv + 1}번째 수에서 길이 끊김`); break; }
      const i = v[0];
      if(!R.legal(B, i, side)){ errs.push(`${mv + 1}번째 수가 둘 수 없는 자리`); break; }
      if(R.winLine(B, i, side)){ won = true; break; }
      B.b[i] = side; hist.push(i);
      const a = R.aiPick(B, opp, 2, mulberry(seedFrom(seedStr + ':' + hist.join(','))));
      if(a < 0){ errs.push('컴퓨터가 둘 곳이 없음'); break; }
      if(R.winLine(B, a, opp)){ errs.push('컴퓨터가 먼저 5목'); break; }
      B.b[a] = opp; hist.push(a);
    }
    if(!won && !errs.length) errs.push(`${pz.N}수 안에 못 이김`);
    const stones = pz.b.reduce((s, x) => s + (x ? 1 : 0), 0);
    if(errs.length){ bad++; console.log(`✗ ${dk(d)} ${lv} N${pz.N} 돌 ${stones}: ${errs.join(', ')}`); }
  }
}
console.log(`오목 묘수 점검: ${n}개 중 실패 ${bad}개 · 만들기 평균 ${(sumMs / n).toFixed(0)}ms · 최대 ${maxMs.toFixed(0)}ms`);
process.exit(bad ? 1 : 0);
