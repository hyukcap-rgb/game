/* 고스톱 화투 그림 (games/gostop)
   - 48장: gostop-cards.js의 그림판(GS_SPRITE, Wikimedia Commons 'SVG Hwatu' · CC BY-SA 4.0)에서 잘라 씀.
     그림판은 한 번만 Blob URL로 바꿔 둔다(카드마다 큰 data URL 문자열을 복사하지 않게).
   - 보너스패 3장 · 뒷면 · 폭탄 빈 패: 실물 화투 테두리(빨강)에 맞춰 직접 그린 SVG(176×287).
   크기: 카드 한 장 176×287(실물 화투 비율 103.2:168.2). */
const GSART = (() => {
  const W = 176, H = 287, COLS = 12;
  let url = null;
  function spriteUrl(){
    if(url) return url;
    try{
      const b64 = GS_SPRITE.slice(GS_SPRITE.indexOf(',') + 1), bin = atob(b64), u8 = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      url = URL.createObjectURL(new Blob([u8], { type:'image/webp' }));
    }catch(_){ url = GS_SPRITE; }
    return url;
  }
  /* 48장 중 i번(월 m의 k번째 = (m-1)*4+k) — 그림판에서 잘라 보이기 */
  const img = i => `<image href="${spriteUrl()}" x="${-(i % COLS) * W}" y="${-Math.floor(i / COLS) * H}" width="${W * COLS}" height="${H * 4}" preserveAspectRatio="none"/>`;
  const FRAME = (inner) => `<rect x="1" y="1" width="174" height="285" rx="11" fill="#E8251E"/><rect x="9" y="9" width="158" height="269" rx="8" fill="${inner}"/>`;
  const T = (x, y, s, c, t, w = 900) => `<text x="${x}" y="${y}" font-size="${s}" font-weight="${w}" text-anchor="middle" fill="${c}" font-family="'Noto Sans KR','Malgun Gothic',system-ui,sans-serif">${t}</text>`;
  function bonus(pv){
    let rays = ''; for(let i = 0; i < 16; i++) rays += `<path transform="rotate(${i * 22.5} 88 118)" d="M88 118L82 48h12z" fill="${i % 2 ? '#FFB020' : '#FFD84A'}"/>`;
    return FRAME('#FFF7D6') + rays + `<circle cx="88" cy="118" r="44" fill="#E8251E" stroke="#1A1212" stroke-width="3"/><circle cx="88" cy="118" r="34" fill="none" stroke="#FFD84A" stroke-width="3"/>` +
      T(88, 134, 46, '#FFE27A', '福', 900) + T(88, 205, 30, '#1A1212', '보너스') + T(88, 245, 26, '#E8251E', pv === 3 ? '쓰리피' : '쌍피');
  }
  function back(){
    let s = `<rect x="1" y="1" width="174" height="285" rx="11" fill="#C8141B"/><rect x="9" y="9" width="158" height="269" rx="8" fill="#B01017" stroke="#E0464A" stroke-width="2"/>`;
    for(let y = 18; y < 272; y += 12) for(let x = 18 + ((y / 12) % 2) * 6; x < 162; x += 12) s += `<circle cx="${x}" cy="${y}" r="2" fill="#951016"/>`;
    return s + `<rect x="1" y="1" width="174" height="285" rx="11" fill="none" stroke="#7A0A0F" stroke-width="2"/>`;
  }
  const dummy = FRAME('#ECE7F0') + `<circle cx="88" cy="128" r="40" fill="#2E2838" stroke="#1A1212" stroke-width="3"/><path d="M114 100l18-20" stroke="#1A1212" stroke-width="5"/><circle cx="136" cy="76" r="9" fill="#FF8A1F"/><circle cx="72" cy="112" r="9" fill="#fff" opacity=".35"/>` + T(88, 222, 28, '#5A4E6A', '넘기기');
  return {
    VB:`0 0 ${W} ${H}`, W, H,
    face:c => c.bonus ? bonus(c.pv) : img(c.id),
    back:back(), dummy,
    url:spriteUrl
  };
})();
