"""명화 틀린그림 만들기: 저작권이 끝난(공공 영역) 명화 원본을 받아 같은 그림 두 장(원본·차이 있는 그림)과 정답·작품 설명을 만든다.
사용: python3 -I tools/masterpiece/export.py [--out out/masterpiece] [--diffs 7] [--width 1600] [--only 1,2] [--src 폴더]
 게임용: --game --diffs 12 --out games/spot  (→ games/spot/art/*.webp + games/spot/spot-masters.js)
 - --src 폴더에 NN.jpg(작품 번호)가 있으면 내려받지 않고 그 파일을 쓴다(이 경우 라이선스는 사람이 직접 확인해야 한다).
 - 내려받을 때는 위키미디어 공용(Commons)에서 찾고, '공공 영역/CC0'가 아닌 파일은 쓰지 않는다. 출처·라이선스는 answers.json에 남긴다.
 - 게임 본체(games/)는 건드리지 않는다. 같은 번호는 늘 같은 차이(씨앗)가 나온다.
"""
import argparse, colorsys, json, math, os, random, re, ssl, sys, urllib.parse, urllib.request
import numpy as np
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

# ---------- 차이 만들기 ----------
def soft_mask(h, w, cx, cy, r, feather=.28):
    yy, xx = np.mgrid[0:h, 0:w]; d = np.hypot(xx - cx, yy - cy) / r
    m = np.clip((1 - d) / feather, 0, 1); return m * m * (3 - 2 * m)

def hue_shift(rgb, deg):
    out = np.empty_like(rgb); flat = rgb.reshape(-1, 3) / 255.0
    r, g, b = flat[:, 0], flat[:, 1], flat[:, 2]; mx = flat.max(1); mn = flat.min(1); d = mx - mn + 1e-9
    hh = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
    s = np.where(mx > 0, d / (mx + 1e-9), 0); v = mx
    hh = (hh + deg / 360.0) % 1.0; i = np.floor(hh * 6).astype(int) % 6; f = hh * 6 - np.floor(hh * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    ch = [np.choose(i, [v, q, p, p, t, v]), np.choose(i, [t, v, v, q, p, p]), np.choose(i, [p, p, t, v, v, q])]
    return (np.stack(ch, 1).reshape(rgb.shape) * 255).astype(np.float32)

def op_hue(img, cx, cy, r, rng):
    return hue_shift(img, rng.choice([-1, 1]) * rng.uniform(70, 140))
def op_bright(img, cx, cy, r, rng):
    k = rng.choice([.55, 1.55]); return np.clip(img * k + (18 if k > 1 else 0), 0, 255)
def op_swap(img, cx, cy, r, rng):
    return img[..., [2, 1, 0]] if rng.random() < .5 else img[..., [1, 2, 0]]
def op_flip(img, cx, cy, r, rng):
    h, w = img.shape[:2]; x0, y0 = int(cx - r), int(cy - r); x1, y1 = int(cx + r), int(cy + r); out = img.copy()
    out[y0:y1, x0:x1] = img[y0:y1, x0:x1][:, ::-1]; return out
def op_rot(img, cx, cy, r, rng):
    x0, y0 = int(cx - r), int(cy - r); x1, y1 = int(cx + r), int(cy + r); out = img.copy()
    out[y0:y1, x0:x1] = np.rot90(img[y0:y1, x0:x1], 2); return out
def op_clone(img, cx, cy, r, rng):
    """다른 자리의 조각으로 덮어 '없어지거나 바뀐' 것처럼 보이게(비슷한 밝기 자리에서 가져온다)"""
    h, w = img.shape[:2]; x0, y0, x1, y1 = int(cx - r), int(cy - r), int(cx + r), int(cy + r); here = img[y0:y1, x0:x1]
    best = None
    for _ in range(40):
        sx = rng.randint(int(r) + 2, w - int(r) - 3); sy = rng.randint(int(r) + 2, h - int(r) - 3)
        if math.hypot(sx - cx, sy - cy) < r * 3: continue
        src = img[sy - (y1 - y0) // 2: sy - (y1 - y0) // 2 + (y1 - y0), sx - (x1 - x0) // 2: sx - (x1 - x0) // 2 + (x1 - x0)]
        if src.shape != here.shape: continue
        dist = abs(src.mean() - here.mean())
        if best is None or dist < best[0]: best = (dist, src)
    if best is None: return img
    out = img.copy(); out[y0:y1, x0:x1] = best[1]; return out
OPS = [('색 바꾸기', op_hue, 3), ('밝기 바꾸기', op_bright, 2), ('색 섞기', op_swap, 1.4), ('뒤집기', op_flip, 1.6), ('돌리기', op_rot, 1.2), ('바꿔치기', op_clone, 2.6)]

def make_diffs(base, n, rng, min_delta=15.0, rfac=(.032, .052)):
    """base(float32 HxWx3)에서 n곳을 고쳐 (바뀐 그림, 차이 목록)을 돌려준다. 눈에 띄게 달라졌는지(평균 차이)를 확인한다."""
    h, w = base.shape[:2]; L = max(w, h); gray = base.mean(2)
    gy, gx = np.gradient(gray); edge = np.hypot(gx, gy)
    k = max(8, w // 80); sal = np.asarray(Image.fromarray(edge.astype(np.float32), mode='F').resize((w // k, h // k), Image.BOX))
    cand = [(sal[j, i], (i + .5) * k, (j + .5) * k) for j in range(sal.shape[0]) for i in range(sal.shape[1])]
    cand.sort(reverse=True); top = cand[:max(40, len(cand) // 3)]
    out = base.copy(); diffs = []; used = {}
    margin = L * .07
    for tries in range(4000):
        if len(diffs) >= n: break
        _, cx, cy = rng.choice(top); r = L * rng.uniform(*rfac)
        if cx < margin + r or cx > w - margin - r or cy < margin + r or cy > h - margin - r: continue
        if any(math.hypot(cx - d['cx'], cy - d['cy']) < (r + d['r']) * 1.25 + L * .03 for d in diffs): continue
        name, fn, _wt = rng.choices(OPS, weights=[o[2] for o in OPS])[0]
        if used.get(name, 0) >= math.ceil(n * .35): continue
        mod = fn(out, cx, cy, r, rng); m = soft_mask(h, w, cx, cy, r)[..., None]
        trial = out * (1 - m) + mod * m
        core = soft_mask(h, w, cx, cy, r, .01) > .5
        delta = float(np.abs(trial - out)[core].mean())
        if delta < min_delta: continue
        out = trial; used[name] = used.get(name, 0) + 1
        diffs.append({'cx': float(cx), 'cy': float(cy), 'r': float(r), 'kind': name, 'delta': round(delta, 1)})
    if len(diffs) < n: raise RuntimeError(f'차이 {len(diffs)}곳만 만들었어요(목표 {n})')
    return out, diffs

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default='out/masterpiece'); ap.add_argument('--diffs', type=int, default=7)
    ap.add_argument('--width', type=int, default=1600); ap.add_argument('--only', default=''); ap.add_argument('--src', default='')
    ap.add_argument('--game', action='store_true', help='게임용: games/spot/art/ 에 WebP 그림·조각과 games/spot/spot-masters.js를 만든다')
    ap.add_argument('--long', type=int, default=1100, help='게임용 그림 긴 변(px)')
    ap.add_argument('--catalog', default=os.path.join(HERE, 'catalog.json')); a = ap.parse_args()
    cat = json.load(open(a.catalog, encoding='utf8')); only = {int(x) for x in a.only.split(',') if x}
    os.makedirs(a.out, exist_ok=True); answers = []; failed = []; masters = []
    if not a.src: prefetch([w for w in cat if not only or w['no'] in only])
    for wk in cat:
        if only and wk['no'] not in only: continue
        no = wk['no']; src = os.path.join(a.src, f'{no:02d}.jpg') if a.src else ''
        try:
            if src and os.path.exists(src): img = Image.open(src); info = {'file': os.path.basename(src), 'license': '직접 제공(확인 필요)'}
            else:
                cache = os.path.join(a.out, '_cache'); os.makedirs(cache, exist_ok=True); cp = os.path.join(cache, f'{no:02d}.jpg'); ci = cp + '.json'
                if os.path.exists(cp) and os.path.getsize(cp) > 20000 and os.path.exists(ci): info = json.load(open(ci, encoding='utf8'))   # 이미 받은 것은 다시 받지 않는다
                else:
                    url, info = find_on_commons(wk); data = http_get(url)
                    if len(data) < 20000: raise RuntimeError('내려받은 파일이 너무 작아요')
                    open(cp, 'wb').write(data); json.dump(info, open(ci, 'w', encoding='utf8'), ensure_ascii=False)
                img = Image.open(cp)
            img = img.convert('RGB')
            if a.game: s = a.long / max(img.size); img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
            else: s = a.width / img.width; img = img.resize((a.width, round(img.height * s)), Image.LANCZOS)
            rng = random.Random(f'masterpiece:{no}'); base = np.asarray(img, dtype=np.float32)
            for md in (15.0, 12.0, 10.0):   # 차이를 다 못 만들면 눈에 띄는 기준을 조금씩 낮춰 다시
                try: mod, diffs = make_diffs(base, a.diffs, random.Random(f'masterpiece:{no}:{md}'), md, (.042, .060) if a.game else (.032, .052)); break
                except RuntimeError as e: err = e
            else: raise err
        except Exception as e:
            failed.append((no, wk['title'], str(e)[:300])); print(f'[실패] {no:02d} {wk["title"]}: {str(e)[:200]}', file=sys.stderr); continue
        h, w = base.shape[:2]
        if a.game:
            art = os.path.join(a.out, 'art'); os.makedirs(art, exist_ok=True); tag = f'{no:02d}'
            img.save(os.path.join(art, tag + '.webp'), quality=80, method=6)
            M = np.clip(mod, 0, 255).astype(np.uint8); pat = []
            for k, d in enumerate(diffs):
                R = int(math.ceil(d['r'])) + 1; x0, y0 = int(round(d['cx'])) - R, int(round(d['cy'])) - R; side = 2 * R
                crop = np.zeros((side, side, 3), np.uint8); alpha = np.zeros((side, side), np.float32)
                xa, ya, xb, yb = max(x0, 0), max(y0, 0), min(x0 + side, w), min(y0 + side, h)
                crop[ya - y0:yb - y0, xa - x0:xb - x0] = M[ya:yb, xa:xb]
                alpha[ya - y0:yb - y0, xa - x0:xb - x0] = soft_mask(h, w, d['cx'], d['cy'], d['r'])[ya:yb, xa:xb]
                Image.fromarray(np.dstack([crop, (alpha * 255).astype(np.uint8)]), 'RGBA').save(os.path.join(art, f'{tag}_d{k + 1}.webp'), quality=88, method=6, exact=True)
                pat.append({'x': round(d['cx'] / w, 4), 'y': round(d['cy'] / h, 4), 'r': round(d['r'] / max(w, h), 4), 'side': round(side / max(w, h), 4), 'kind': d['kind']})
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
