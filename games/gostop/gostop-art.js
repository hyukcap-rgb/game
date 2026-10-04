/* 고스톱 화투 그림 (games/gostop)
   - 48장: gostop-cards.js의 그림판(GS_SPRITE, Wikimedia Commons 'SVG Hwatu' · CC BY-SA 4.0)에서 잘라 씀.
     그림판은 한 번만 Blob URL로 바꿔 둔다(카드마다 큰 data URL 문자열을 복사하지 않게).
   - 보너스패 3장 · 뒷면 · 폭탄 빈 패: 실물 화투 테두리(빨강)에 맞춰 직접 그린 SVG(176×287).
   크기: 카드 한 장 176×287(실물 화투 비율 103.2:168.2). 그림판 실제 칸 크기와 상관없이 이 좌표로 잘라 씀. */
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
  /* 그림판 칸은 둥근 모서리까지 구워져 있음(v1.4: 256×417, 그림이 패에 꽉 차게). 위에 얇은 윤곽선 두 겹(바깥 어둡게·안쪽 밝게)으로 매끈한 종이 느낌 */
  const img = i => `<image href="${spriteUrl()}" x="${-(i % COLS) * W}" y="${-Math.floor(i / COLS) * H}" width="${W * COLS}" height="${H * 4}" preserveAspectRatio="none"/>` +
    `<rect x=".6" y=".6" width="174.8" height="285.8" rx="13" fill="none" stroke="rgba(70,0,0,.45)" stroke-width="1.2"/><rect x="2.4" y="2.4" width="171.2" height="282.2" rx="11.5" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.4"/>`;
  const FRAME = (inner) => `<rect x="1" y="1" width="174" height="285" rx="11" fill="#E8251E"/><rect x="9" y="9" width="158" height="269" rx="8" fill="${inner}"/>`;
  const T = (x, y, s, c, t, w = 900) => `<text x="${x}" y="${y}" font-size="${s}" font-weight="${w}" text-anchor="middle" fill="${c}" font-family="'Noto Sans KR','Malgun Gothic',system-ui,sans-serif">${t}</text>`;
  function bonus(pv){
    let rays = ''; for(let i = 0; i < 16; i++) rays += `<path transform="rotate(${i * 22.5} 88 118)" d="M88 118L82 48h12z" fill="${i % 2 ? '#FFB020' : '#FFD84A'}"/>`;
    return FRAME('#FFF7D6') + rays + `<circle cx="88" cy="118" r="44" fill="#E8251E" stroke="#1A1212" stroke-width="3"/><circle cx="88" cy="118" r="34" fill="none" stroke="#FFD84A" stroke-width="3"/>` +
      T(88, 134, 46, '#FFE27A', '福', 900) + T(88, 205, 30, '#1A1212', '보너스') + T(88, 245, 26, '#E8251E', pv === 3 ? '쓰리피' : '쌍피');
  }
  /* 뒷면: 하루퍼즐 남보라 + 금색 마름모 무늬(실물 빨강 뒷면과 다르게) */
  function back(){
    let s = `<rect x="1" y="1" width="174" height="285" rx="11" fill="#2E1A6B"/><rect x="9" y="9" width="158" height="269" rx="8" fill="#3A2384" stroke="#FFD34D" stroke-width="2.5"/>`;
    for(let y = 24; y < 272; y += 22) for(let x = 22 + ((y - 24) / 22 % 2) * 11; x < 160; x += 22) s += `<path d="M${x} ${y - 6}l6 6-6 6-6-6z" fill="#5A3DB0"/>`;
    s += `<circle cx="88" cy="143" r="30" fill="#2E1A6B" stroke="#FFD34D" stroke-width="3"/><path d="M88 123l5 13h14l-11 9 4 14-12-8-12 8 4-14-11-9h14z" fill="#FFD34D"/>`;
    return s + `<rect x="1" y="1" width="174" height="285" rx="11" fill="none" stroke="#1A0F45" stroke-width="2"/>`;
  }
  const dummy = FRAME('#ECE7F0') + `<circle cx="88" cy="128" r="40" fill="#2E2838" stroke="#1A1212" stroke-width="3"/><path d="M114 100l18-20" stroke="#1A1212" stroke-width="5"/><circle cx="136" cy="76" r="9" fill="#FF8A1F"/><circle cx="72" cy="112" r="9" fill="#fff" opacity=".35"/>` + T(88, 222, 28, '#5A4E6A', '넘기기');
  return {
    VB:`0 0 ${W} ${H}`, W, H,
    face:c => c.bonus ? bonus(c.pv) : img(c.id),
    back:back(), dummy,
    url:spriteUrl
  };
})();
