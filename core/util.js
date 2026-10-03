/* 공용 도구: $, 저장소, 날짜, 씨앗 난수 */
const $ = s => document.querySelector(s);
/* 저장소(이 브라우저). 붙여 쓰는 모듈은 window.HP_NS로 이름 앞에 구분자를 붙여 사이트·사용자별로 기록을 나눈다 */
const STORE_NS = (typeof window !== 'undefined' && window.HP_NS) || '';
const store = {
  get(k, d){ try{ const v = localStorage.getItem(STORE_NS + k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(STORE_NS + k, JSON.stringify(v)); }catch(e){} }
};
/* 글자를 HTML에 안전하게 넣기 */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function dayKey(d = new Date()){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmt(n){ return n.toLocaleString('ko-KR'); }
function mmss(s){ s = Math.max(0, Math.floor(s)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); }
let toastT;
function toast(msg, kind){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); if(typeof sfx === 'function') sfx(kind === 'err' ? 'error' : 'toast'); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('on'), 2600); }

function seedFrom(str){ let h = 2166136261; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, rng){ for(let i=arr.length-1;i>0;i--){ const j = Math.floor(rng()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; } return arr; }
