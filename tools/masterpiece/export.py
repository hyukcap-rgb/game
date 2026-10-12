"""명화 틀린그림 만들기: 저작권이 끝난(공공 영역) 명화 원본을 받아 같은 그림 두 장(원본·차이 있는 그림)과 정답·작품 설명을 만든다.
사용: python3 tools/masterpiece/export.py [--out out/masterpiece] [--diffs 7] [--width 1600] [--only 1,2] [--src 폴더]
 게임용: --game --out games/spot
 필요한 것: pip install opencv-python-headless scikit-image scipy torch numpy pillow, 그리고 models/ 안의 두 모델(sam.py·inpaint.py 설명의 주소). 편집은 사람이 그림을 보고 edits.json에 적는다(어디를 어떻게). 검수: --sheet → <out>/review/NN.png.  (→ games/spot/art/*.webp + games/spot/spot-masters.js)
 - --src 폴더에 NN.jpg(작품 번호)가 있으면 내려받지 않고 그 파일을 쓴다(이 경우 라이선스는 사람이 직접 확인해야 한다).
 - 내려받을 때는 위키미디어 공용(Commons)에서 찾고, '공공 영역/CC0'가 아닌 파일은 쓰지 않는다. 출처·라이선스는 answers.json에 남긴다.
 - 게임 본체(games/)는 건드리지 않는다. 같은 번호는 늘 같은 차이(씨앗)가 나온다.
"""
import argparse, colorsys, json, math, os, random, re, ssl, sys, urllib.parse, urllib.request
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'haru-puzzle-masterpiece/1.0 (educational spot-the-difference game; contact: hyukcap@gmail.com)'
OK_LICENSE = re.compile(r'public domain|^pd\b|^pd-|cc0|cc ?zero', re.I)

_last = [0.0]
def http_get(url):
    """위키미디어 이용 예절: 한 번에 하나씩, 3초 간격, 429(너무 빠름)면 기다렸다 다시."""
    import time
    ctx = ssl.create_default_context()
    ca = os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt'
    if os.path.exists(ca): ctx.load_verify_locations(ca)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for k in range(7):
        time.sleep(max(0, 3.0 - (time.time() - _last[0])))
        try:
            data = urllib.request.urlopen(req, context=ctx, timeout=90).read(); _last[0] = time.time(); return data
        except urllib.error.HTTPError as e:
            _last[0] = time.time()
            if e.code in (429, 503) and k < 6: time.sleep(min(120.0, float(e.headers.get('Retry-After') or 15 * (k + 1)))); continue
            raise
        except urllib.error.URLError:   # 터널 연결 일시 실패 등
            _last[0] = time.time()
            if k < 6: time.sleep(10 * (k + 1)); continue
            raise

def strip(s): return re.sub(r'<[^>]+>', '', s or '').strip()

BAD_WORDS = re.compile(r'detail|crop|frame|earth|copy|after |replica|reproduction|poster|stamp|sketch|study|lithograph|cartoon|parody|in situ|wall|museum interior', re.I)
def rank(p, work):
    t = p['title']; sc = 0
    if 'Google Art Project' in t: sc += 5
    if BAD_WORDS.search(t): sc -= 6
    ii = (p.get('imageinfo') or [{}])[0]; sc += min(ii.get('width', 0) * ii.get('height', 0), 4e7) / 4e7 * 2
    if abs(-p.get('index', 99)) < 3: sc += 1.5 - 0.5 * p.get('index', 0)
    return sc

_META = {}
def prefetch(cat):
    """카탈로그의 file들을 20개씩 한 번에 물어 요청 수를 줄인다(위키미디어 속도 제한 때문)."""
    names = [w['file'] for w in cat if w.get('file')]
    for i in range(0, len(names), 20):
        q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 1920,
            'titles': '|'.join('File:' + n for n in names[i:i + 20])})
        d = json.loads(http_get('https://commons.wikimedia.org/w/api.php?' + q))
        norm = {x['to']: x['from'] for x in (d.get('query') or {}).get('normalized', [])}
        for p in (d.get('query') or {}).get('pages', {}).values(): _META[p['title']] = p
        for t, f in norm.items():
            if t in _META: _META[f] = _META[t]

def find_on_commons(work):
    """Commons에서 작품 파일을 찾아 (이미지 주소, 출처 정보)를 돌려준다. 공공 영역이 아닌 후보는 거른다. 카탈로그에 file이 있으면 그 파일을 쓴다."""
    base = {'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 1920}   # 위키미디어는 정해진 크기(1280·1920·3840 등)의 축소본만 만들어 준다
    if work.get('file') and ('File:' + work['file']) in _META: data = {'query': {'pages': {'0': _META['File:' + work['file']]}}}
    elif work.get('file'): data = None; q = urllib.parse.urlencode(dict(base, titles='File:' + work['file']))
    else: data = None; q = urllib.parse.urlencode(dict(base, generator='search', gsrnamespace=6, gsrlimit=12, gsrsearch=work['search'] + ' filetype:bitmap'))
    if data is None or not work.get('file') or ('File:' + work['file']) not in _META:
        data = json.loads(http_get('https://commons.wikimedia.org/w/api.php?' + q))
    pages = (data.get('query') or {}).get('pages', {}).values()
    pages = sorted(pages, key=lambda p: -rank(p, work)) if not work.get('file') else list(pages)
    rejected = []
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {})
        lic = strip(m.get('LicenseShortName', {}).get('value')); restr = strip(m.get('Restrictions', {}).get('value'))
        if not OK_LICENSE.search(lic): rejected.append((p['title'], lic or '라이선스 없음')); continue
        if restr: rejected.append((p['title'], '이용 제한: ' + restr)); continue
        if min(ii.get('width', 0), ii.get('height', 0)) < 900: rejected.append((p['title'], '해상도 낮음')); continue
        return ii.get('thumburl') or ii['url'], {'file': p['title'], 'page': ii.get('descriptionurl'), 'license': lic,
            'credit': strip(m.get('Credit', {}).get('value')), 'artistField': strip(m.get('Artist', {}).get('value'))[:200]}
    raise RuntimeError('공공 영역 후보 없음: ' + json.dumps(rejected, ensure_ascii=False))

# ---------- 차이 만들기(그림을 보고 정한 편집을 실행: natural.py, edits.json) ----------
_ready = [False]; _sam = [None]
def ensure_models():
    """사물 분할(EfficientSAM)·지운 자리 메우기(LaMa) 모델을 한 번만 올린다(파일 위치는 sam.py·inpaint.py 설명 참고)"""
    if _ready[0]: return
    import natural, inpaint, sam
    natural.set_inpainter(inpaint.Lama()); _sam[0] = sam.Sam(); _ready[0] = True

def build_diffs(base, no, edits, minimum):
    """base(uint8 RGB) → (바뀐 그림, 차이 목록). edits.json에 이 작품의 편집이 minimum개 이상 있어야 한다."""
    import natural
    specs = edits.get(str(no)) or []
    if len(specs) < minimum: raise RuntimeError(f'edits.json에 이 작품 편집이 {len(specs)}개뿐이에요(최소 {minimum})')
    ensure_models(); out, diffs, problems = natural.run_edits(base, specs, _sam[0], strict=False)
    for p in problems: print(f'  [뺌] {no:02d} {p[:120]}', file=sys.stderr)   # 안 되는 편집은 빼고, 남은 게 최소 개수 이상이면 쓴다
    if len(diffs) < minimum: raise RuntimeError(f'성공한 편집이 {len(diffs)}개뿐이에요(최소 {minimum})')
    return out, diffs

def sheet(base, no, a, edits):
    """검수용: 편집마다 '전(SAM 마스크 후보 3개 윤곽: 초록=0·노랑=1·하늘=2번, 빨강=쓴 것) | 후'를 번호·메모와 함께 한 장에 그린다. 실패한 편집은 이유를 적는다."""
    import natural
    specs = edits.get(str(no)) or []; ensure_models(); H, W = base.shape[:2]
    out, diffs, problems = natural.run_edits(base, specs, _sam[0], strict=False); byidx = {d['idx']: d for d in diffs}; why = {int(p[1:p.index(' ')]): p for p in problems}
    tiles = []
    for i, spec in enumerate(specs):
        d = byidx.get(i); opts, alls = natural.mask_options(_sam[0], spec, base.shape); m = d['mask'] if d else opts[0]
        ys, xs = np.nonzero(m); cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2; ext = max(np.ptp(xs), np.ptp(ys), 100)
        sz = int(ext * 2.0 + 40); sz = min(sz, min(H, W)); x0 = max(0, min(int(cx - sz / 2), W - sz)); y0 = max(0, min(int(cy - sz / 2), H - sz))
        va = base.copy()
        for k, col in ((2, (0, 255, 255)), (1, (255, 255, 0)), (0, (60, 255, 60))):
            for cands in alls:
                cs, _ = cv2.findContours(cands[k][0], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); cv2.drawContours(va, cs, -1, col, 1)
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); cv2.drawContours(va, cs, -1, (255, 0, 0), 2)
        pa = Image.fromarray(va[y0:y0 + sz, x0:x0 + sz]).resize((300, 300)); pb = Image.fromarray(out[y0:y0 + sz, x0:x0 + sz]).resize((300, 300))
        t = Image.new('RGB', (610, 322), 'white'); t.paste(pa, (0, 20)); t.paste(pb, (310, 20))
        ImageDraw.Draw(t).text((4, 4), (f'#{i} {d["kind"]} {d["note"]}  d{d["delta"]} r{d["r"]:.0f}' if d else '실패 ' + why.get(i, '')[:90]), fill='black' if d else 'red'); tiles.append(t)
    cols = 2; rows = (len(tiles) + cols - 1) // cols; S = Image.new('RGB', (cols * 616, rows * 328), 'white')
    for i, t in enumerate(tiles): S.paste(t, ((i % cols) * 616, (i // cols) * 328))
    os.makedirs(os.path.join(a.out, 'review'), exist_ok=True); S.save(os.path.join(a.out, 'review', f'{no:02d}.png'))
    Image.fromarray(out).save(os.path.join(a.out, 'review', f'{no:02d}_full.png')); print(f'{no:02d} 편집 {len(diffs)}/{len(specs)}곳 성공 → review/{no:02d}.png')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default='out/masterpiece')
    ap.add_argument('--width', type=int, default=1600); ap.add_argument('--only', default=''); ap.add_argument('--src', default='')
    ap.add_argument('--game', action='store_true', help='게임용: games/spot/art/ 에 WebP 그림·조각과 games/spot/spot-masters.js를 만든다')
    ap.add_argument('--long', type=int, default=1100, help='게임용 그림 긴 변(px)')
    ap.add_argument('--edits', default=os.path.join(HERE, 'edits.json'), help='작품별 편집 목록(natural.py 설명 참고)')
    ap.add_argument('--min', type=int, default=9, help='작품마다 있어야 하는 차이 수')
    ap.add_argument('--sheet', action='store_true', help='검수용 전후 비교 이미지(<out>/review/NN.png)만 만든다')
    ap.add_argument('--catalog', default=os.path.join(HERE, 'catalog.json')); a = ap.parse_args()
    edits = json.load(open(a.edits, encoding='utf8')) if os.path.exists(a.edits) else {}
    cat = json.load(open(a.catalog, encoding='utf8')); only = {int(x) for x in a.only.split(',') if x}
    os.makedirs(a.out, exist_ok=True); answers = []; failed = []; masters = []
    if not a.src: prefetch([w for w in cat if not only or w['no'] in only])
    for wk in cat:
        if only and wk['no'] not in only: continue
        no = wk['no']; src = os.path.join(a.src, f'{no:02d}.jpg') if a.src else ''
        try:
            if src and os.path.exists(src): img = Image.open(src); info = {'file': os.path.basename(src), 'license': wk.get('license', '직접 제공(확인 필요)'), 'page': wk.get('source', '')}
            else:
                cache = os.path.join(a.out, '_cache'); os.makedirs(cache, exist_ok=True); cp = os.path.join(cache, f'{no:02d}.jpg'); ci = cp + '.json'
                if os.path.exists(cp) and os.path.getsize(cp) > 20000 and os.path.exists(ci): info = json.load(open(ci, encoding='utf8'))   # 이미 받은 것은 다시 받지 않는다
                else:
                    url, info = find_on_commons(wk); data = http_get(url)
                    if len(data) < 20000: raise RuntimeError('내려받은 파일이 너무 작아요')
                    open(cp, 'wb').write(data); json.dump(info, open(ci, 'w', encoding='utf8'), ensure_ascii=False)
                img = Image.open(cp)
            img = img.convert('RGB')
            if a.game or a.sheet: s = a.long / max(img.size); img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
            else: s = a.width / img.width; img = img.resize((a.width, round(img.height * s)), Image.LANCZOS)
            base = np.asarray(img, dtype=np.uint8)
            if a.sheet: sheet(base, no, a, edits); continue
            mod, diffs = build_diffs(base, no, edits, a.min)
        except Exception as e:
            failed.append((no, wk['title'], str(e)[:300])); print(f'[실패] {no:02d} {wk["title"]}: {str(e)[:200]}', file=sys.stderr); continue
        h, w = base.shape[:2]
        if a.game:
            art = os.path.join(a.out, 'art'); os.makedirs(art, exist_ok=True); tag = f'{no:02d}'
            img.save(os.path.join(art, tag + '.webp'), quality=80, method=6)
            pat = []
            for k, d in enumerate(diffs):
                Image.fromarray(d['patch'], 'RGBA').save(os.path.join(art, f'{tag}_d{k + 1}.webp'), quality=90, method=6, exact=True)
                pat.append({'x': round(d['cx'] / w, 4), 'y': round(d['cy'] / h, 4), 'r': round(d['r'] / max(w, h), 4), 'side': round(d['side'] / max(w, h), 4), 'kind': d['kind']})
            masters.append({'id': f'm{no:02d}', 'no': no, 'file': tag + '.webp', 'w': w, 'h': h, 'title': wk['title'], 'artist': wk['artist'], 'made': wk['made'], 'place': wk['place'], 'desc': wk['desc'], 'diffs': pat})
        stem = os.path.join(a.out, f'{no:02d}_{wk["title"].replace(" ", "")}')
        img.save(stem + '_원본.jpg', quality=93); Image.fromarray(np.clip(mod, 0, 255).astype(np.uint8)).save(stem + '_틀린그림.jpg', quality=93)
        ans = Image.fromarray(np.clip(mod, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(ans)
        for d in diffs:
            for wd, col in ((9, 'white'), (5, '#E11D74')): dr.ellipse([d['cx'] - d['r'] - 4, d['cy'] - d['r'] - 4, d['cx'] + d['r'] + 4, d['cy'] + d['r'] + 4], outline=col, width=wd)
        ans.save(stem + '_정답.jpg', quality=90)
        answers.append({'no': no, 'title': wk['title'], 'artist': wk['artist'], 'made': wk['made'], 'place': wk['place'], 'desc': wk['desc'],
            'source': info, 'width': w, 'height': h, 'diffs': [{'x': round(d['cx'] / w, 4), 'y': round(d['cy'] / h, 4), 'r': round(d['r'] / w, 4), 'kind': d['kind']} for d in diffs]})
        print(f'{no:02d} {wk["title"]} 완료({info.get("license")})')
    if a.game:
        with open(os.path.join(a.out, 'spot-masters.js'), 'w', encoding='utf8') as f:
            f.write('/* 명화 틀린그림 그림 목록(tools/masterpiece/export.py --game 가 만든다 — 손으로 고치지 않기). 그림 파일은 games/spot/art/ */\n')
            f.write('const SPOT_MASTERS = ' + json.dumps({'base': 'art/', 'list': masters}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    json.dump(answers, open(os.path.join(a.out, 'answers.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, 'CREDITS.md'), 'w', encoding='utf8') as f:
        f.write('# 명화 출처\n\n작품은 모두 저작권이 끝난 공공 영역입니다. 원본 파일은 위키미디어 공용에서 받았고, 차이 그림은 이 프로젝트에서 직접 편집했습니다.\n\n')
        for x in answers: f.write(f"- {x['no']:02d}. {x['artist']}, 「{x['title']}」 ({x['made']}, {x['place']}) — 파일: {x['source'].get('file')} / {x['source'].get('page', '')} / {x['source'].get('license')}\n")
    print(f'완료 {len(answers)}개, 실패 {len(failed)}개'); sys.exit(1 if failed else 0)

if __name__ == '__main__': main()
