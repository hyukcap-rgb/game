// 틀린그림 내보내기용 꾸밈: 그림자·빛·바닥 질감을 더해 같은 장면을 더 입체적으로 보이게 한다.
// 위·아래 그림에 똑같이 들어가므로 정답(차이)에는 영향이 없다. 게임 본체(games/spot)는 건드리지 않는다.
const GROUND = { town:124, park:116, kitchen:140, beach:156, class:150, play:120, alley:130, space:0 };
const DARK = new Set(['space']);
export function deco(theme, objs, P, rng, W, H){
  const r = (a, b) => a + rng() * (b - a);
  let under = '', over = '';
  const defs = `<defs>
    <radialGradient id="lt" cx=".25" cy=".12" r=".9"><stop offset="0" stop-color="#fff" stop-opacity="${DARK.has(theme) ? .08 : .38}"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset=".62" stop-color="#1A0F45" stop-opacity="0"/><stop offset="1" stop-color="#1A0F45" stop-opacity="${DARK.has(theme) ? .35 : .16}"/></linearGradient>
    <filter id="sm" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>`;
  const g0 = GROUND[theme];
  if(g0){
    /* 바닥 질감: 아주 연한 점·풀잎 */
    const col = theme === 'beach' ? '#E9C77A' : theme === 'kitchen' || theme === 'class' ? '#B07A3C' : theme === 'alley' ? '#B9A27F' : '#4E9E3A';
    for(let i = 0; i < 46; i++){
      const x = r(4, W - 4), y = r(g0 + 8, H - 4);
      under += theme === 'beach' || theme === 'alley'
        ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r(.7, 1.5).toFixed(1)}" fill="${col}" opacity=".35"/>`
        : `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l-1.6-4.2M${x.toFixed(1)} ${y.toFixed(1)}l.2-5M${x.toFixed(1)} ${y.toFixed(1)}l1.8-4" stroke="${col}" stroke-width="1" stroke-linecap="round" opacity=".28"/>`;
    }
  } else {
    for(let i = 0; i < 14; i++){ const x = r(6, W - 6), y = r(6, H - 6); under += `<path d="M${x.toFixed(1)} ${(y - 3).toFixed(1)}v6M${(x - 3).toFixed(1)} ${y.toFixed(1)}h6" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".5"/>`; }
  }
  /* 땅에 닿는 조각 밑 그림자(떠 있는 조각 제외) */
  const floatTypes = new Set(['cloud', 'sun', 'bird', 'balloon', 'kite', 'star', 'moon', 'planet', 'rocket', 'ufo', 'satellite', 'comet', 'asteroid', 'clock', 'frame', 'board', 'fish', 'butterfly']);
  const shadows = objs.filter(o => !o.hide && !floatTypes.has(o.t) && g0 && o.y + P[o.t].h * o.s / 2 > g0).map(o => {
    const p = P[o.t], w = p.w * o.s;
    return `<ellipse cx="${o.x.toFixed(1)}" cy="${(o.y + p.h * o.s / 2 - 1).toFixed(1)}" rx="${(w * .46).toFixed(1)}" ry="${Math.max(3, w * .08).toFixed(1)}" fill="#1A0F45" opacity=".16" filter="url(#sm)"/>`;
  }).join('');
  over = `<rect width="${W}" height="${H}" fill="url(#lt)"/><rect width="${W}" height="${H}" fill="url(#vg)"/><rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="6" fill="none" stroke="#1A0F45" stroke-width="1.5" opacity=".35"/>`;
  return { defs, under, shadows, over };
}
