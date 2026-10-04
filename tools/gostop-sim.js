// 고스톱 규칙 점검: AI끼리 여러 판을 두어 보며
//  1) 패가 사라지거나 두 번 생기지 않는지(51장 보존)
//  2) 같은 씨앗 + 같은 수 → 똑같은 판인지(실시간 대전은 수만 주고받으므로 꼭 필요)
//  3) 결과 분포(나가리·고·박·흔들기·뻑 등)가 그럴듯한지
//   node tools/gostop-sim.js [판 수=3000]
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { NG:{}, console, Math, JSON, Object, Array, Set, String, Number, Promise, setTimeout, clearTimeout };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'core/util.js'), 'utf8').replace(/^const \$ = .*$/m, '').replace(/^function toast[\s\S]*?\n/m, ''), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games/gostop/gostop-art.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games/gostop/gostop.js'), 'utf8'), ctx);
const R = vm.runInContext('NG.gostop._rules', ctx);
const mulberry = vm.runInContext('mulberry', ctx), seedFrom = vm.runInContext('seedFrom', ctx);
const N = +process.argv[2] || 3000, LV = ['easy', 'normal', 'hard'];

function check(S, tag){
  const all = [...S.P[0].hand, ...S.P[1].hand, ...S.floor, ...S.P[0].cap, ...S.P[1].cap, ...S.deck].filter(id => id < 60);
  const set = new Set(all);
  if(all.length !== 51 || set.size !== 51) throw new Error(`${tag}: 패 수 ${all.length} (중복 제외 ${set.size})`);
}
function play(seed, lv){
  const S = R.gsDeal(seed), acts = [], rnd = mulberry(seedFrom(seed + ':t'));
  if(!S) throw new Error('판 만들기 실패 ' + seed);
  check(S, seed + ' 시작');
  let guard = 0;
  while(!S.over){
    if(++guard > 200) throw new Error(seed + ': 끝나지 않음');
    const p = S.turn, act = R.aiPick(S, p, lv[p], rnd);
    R.gsApply(S, p, act);
    check(S, seed + ' 수 ' + guard);
    if(S.pendingGS === p){ act.g = R.aiGo(S, p, lv[p], rnd) ? 1 : 0; R.gsGoStop(S, p, !!act.g); }
    acts.push([p, act]);
  }
  /* 같은 수로 다시 두기 → 같은 결과 */
  const T = R.gsDeal(seed);
  for(const [p, a] of acts){ R.gsApply(T, p, a); if(T.pendingGS === p) R.gsGoStop(T, p, !!a.g); }
  if(JSON.stringify(T) !== JSON.stringify(S)) throw new Error(seed + ': 다시 두기 결과가 달라요');
  return S;
}
const st = { n:0, draw:0, win:[0, 0], chong:0, ppuk3:0, go:0, maxGo:0, mult:{}, finals:[], shake:0, bombLike:0, err:0, lvWin:{} };
for(let i = 0; i < N; i++){
  const lv = [LV[i % 3], LV[Math.floor(i / 3) % 3]];
  let S;
  try{ S = play('sim:' + i, lv); }catch(e){ st.err++; if(st.err < 6) console.error('✗', e.message); continue; }
  st.n++;
  const r = S.result;
  if(r.w < 0) st.draw++; else { st.win[r.w]++; st.finals.push(r.final); const k = lv[r.w] + '>' + lv[1 - r.w]; st.lvWin[k] = (st.lvWin[k] || 0) + 1; }
  if(r.why === '총통') st.chong++; if(r.why === '3뻑') st.ppuk3++;
  const g = Math.max(S.P[0].go, S.P[1].go); if(g) st.go++; st.maxGo = Math.max(st.maxGo, g);
  (r.mults || []).forEach(m => { const k = m[0].replace(/ \d+번/, '').replace(/^\d+고 배수/, '3고+ 배수'); st.mult[k] = (st.mult[k] || 0) + 1; });
  if(S.P[0].shake || S.P[1].shake) st.shake++;
}
st.finals.sort((a, b) => a - b);
const q = k => st.finals[Math.floor(st.finals.length * k)] || 0;
console.log(`판 ${st.n}/${N} · 오류 ${st.err}`);
console.log(`선 승 ${st.win[0]} · 후 승 ${st.win[1]} · 나가리 ${st.draw} (${(st.draw / st.n * 100).toFixed(1)}%) · 총통 ${st.chong} · 3뻑 ${st.ppuk3}`);
console.log(`고 부른 판 ${(st.go / st.n * 100).toFixed(1)}% (최대 ${st.maxGo}고) · 흔들기/폭탄 판 ${(st.shake / st.n * 100).toFixed(1)}%`);
console.log(`최종 점수: 중앙 ${q(.5)} · 75% ${q(.75)} · 95% ${q(.95)} · 최대 ${st.finals[st.finals.length - 1]}`);
console.log('배수:', Object.entries(st.mult).map(([k, v]) => `${k} ${(v / st.n * 100).toFixed(1)}%`).join(' · '));
const pair = (a, b) => { const w = st.lvWin[a + '>' + b] || 0, l = st.lvWin[b + '>' + a] || 0; return `${a} vs ${b}: ${w}승 ${l}패`; };
console.log('AI 세기:', [pair('hard', 'easy'), pair('hard', 'normal'), pair('normal', 'easy')].join(' · '));
/* 8초 자동(비풍초똥팔삼)만으로 두 사람이 끝까지: 늘 낼 수 있는 수이고, 같은 판이면 같은 수(대신 둬도 두 기기가 같음) */
let autoErr = 0, autoN = 0;
for(let i = 0; i < Math.min(N, 1500); i++){
  const S = R.gsDeal('auto:' + i); let guard = 0;
  try{
    while(!S.over){
      if(++guard > 200) throw new Error('끝나지 않음');
      const p = S.pendingGS >= 0 ? S.pendingGS : S.turn, a = R.autoAct(S, p), b = R.autoAct(R.cloneS(S), p);
      if(JSON.stringify(a) !== JSON.stringify(b)) throw new Error('같은 판인데 자동 수가 다름');
      if(a.gs != null) R.gsGoStop(S, p, !!a.gs);
      else { if(!S.P[p].hand.includes(a.c)) throw new Error('손에 없는 패 ' + a.c); R.gsApply(S, p, a); }
      check(S, 'auto:' + i);
    }
    autoN++;
  }catch(e){ autoErr++; if(autoErr < 4) console.error('✗ 자동', i, e.message); }
}
console.log(`8초 자동끼리 ${autoN}판 끝까지 · 오류 ${autoErr}`);
process.exit(st.err || autoErr ? 1 : 0);
