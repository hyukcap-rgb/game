"""명화 틀린그림: 그림 속 사물 하나를 '그 모양 그대로' 자연스럽게 바꾸는 편집 도구.
무엇을 바꿀지는 사람(개발팀)이 그림을 보고 edits.json에 적는다 — 어디(점)를 어떻게(없애기·색 바꾸기·옮기기·크기·뒤집기·하나 더).
이 파일은 적힌 편집을 실행한다: 점 → 사물 마스크(EfficientSAM, sam.py) → 편집(색은 Lab에서 돌리고, 지운 자리는 LaMa로 메움, inpaint.py).
차이마다 '바뀐 곳'만 담은 조각(RGBA, 가장자리 투명)을 돌려준다. 위 그림 위에 얹으면 아래 그림이 된다.
edits.json 한 항목: { "at":[x,y] 또는 [[x,y],…], "m":0|1|2(SAM이 주는 세 마스크 중, 기본 자동), "op":"remove|recolor|lighten|darken|dup|move|resize|flip",
  "to":"blue"(recolor), "amt":30(lighten·darken), "dx":..,"dy":..(dup·move), "scale":1.4,"anchor":"bottom"(resize), "grow":9(remove), "note":"메모" }
좌표는 긴 변 1100px로 줄인 그림 기준.
"""
import math
import numpy as np, cv2
from skimage import color

LAMA = None   # export.py가 inpaint.Lama()를 넣어 준다
def set_inpainter(obj):
    global LAMA; LAMA = obj

HUES = {'red': 35, 'orange': 62, 'yellow': 95, 'green': 135, 'teal': 190, 'blue': 265, 'purple': 310, 'pink': 350}

def _k(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def _ring(mask, inner, outer): return (cv2.dilate(mask, _k(outer)) > 0) & (cv2.dilate(mask, _k(inner)) == 0)
def _feather(mask, grow=1, sigma=1.4):
    m = cv2.dilate(mask, np.ones((2 * grow + 1, 2 * grow + 1), np.uint8)) if grow else mask
    return np.clip(cv2.GaussianBlur(m.astype(np.float32), (0, 0), sigma), 0, 1)
def _blend(dst, src, alpha): a = alpha[..., None]; return dst.astype(np.float32) * (1 - a) + src.astype(np.float32) * a

def clean_mask(m):
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, _k(2)); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, _k(3))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n <= 1: return None
    m = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); out = np.zeros_like(m); cv2.drawContours(out, cs, -1, 1, -1); return out

def mask_options(sam, spec, img_shape):
    """spec['at'] 점(들) → 사물 마스크 후보를 '쓸 만한 순서'로. m이 있으면 그것 하나만.
    순서: 예측 IoU가 높은(최고−0.22 이상) 것 중 큰 마스크(사물 전체)부터, 그다음 나머지 IoU순. 반환: (후보 목록, SAM이 준 전체 후보)"""
    pts = spec['at'] if isinstance(spec['at'][0], (list, tuple)) else [spec['at']]
    A = img_shape[0] * img_shape[1]; per = [sam.masks_at(x, y) for (x, y) in pts]
    def order(cands):
        if spec.get('m') is not None: return [cands[int(spec['m'])][0]]
        best = max(c[1] for c in cands); idx = [k for k, c in enumerate(cands) if c[0].sum() <= A * .06]
        good = sorted([k for k in idx if cands[k][1] >= max(.5, best - .22)], key=lambda k: -cands[k][0].sum())
        rest = sorted([k for k in idx if k not in good], key=lambda k: -cands[k][1]); return [cands[k][0] for k in good + rest] or [cands[0][0]]
    orders = [order(c) for c in per]; n = max(len(o) for o in orders); opts = []
    for k in range(n):
        tot = np.zeros(img_shape[:2], np.uint8)
        for o in orders: tot |= o[min(k, len(o) - 1)]
        m = clean_mask(tot)
        if m is not None: opts.append(m)
    return opts, per

# ---------------- 편집 ----------------
def _remove(img, m, grow=9):
    """사물 영역 m을 LaMa로 메운다. 둘레와 어긋나면 None."""
    mask_d = cv2.dilate(m, _k(max(1, grow // 2)))
    if LAMA is None: raise RuntimeError('지운 자리를 메우는 모델(LaMa)이 필요해요 — export.ensure_models')
    res = LAMA.crop_fill(img, mask_d)
    al = np.clip(cv2.GaussianBlur(cv2.dilate(mask_d, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1.6), 0, 1)
    return np.clip(_blend(img, res, al), 0, 255).astype(np.uint8)

def _paste(base, srcimg, mask, dx, dy, scale=1.0, flip=False, anchor='center'):
    """srcimg의 마스크 영역(사물)을 (dx,dy) 옮기고 scale배, flip이면 좌우를 뒤집어 base 위에 붙인다."""
    h, w = mask.shape; ys, xs = np.nonzero(mask)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.max() if anchor == 'bottom' else (ys.min() + ys.max()) / 2)
    M = cv2.getRotationMatrix2D((float(cx), float(cy)), 0, scale); M[0, 2] += dx; M[1, 2] += dy
    obj, mk = srcimg, mask
    if flip:
        x0, x1 = xs.min(), xs.max() + 1; obj = srcimg.copy(); mk = mask.copy()
        obj[:, x0:x1] = srcimg[:, x0:x1][:, ::-1]; mk[:, x0:x1] = mask[:, x0:x1][:, ::-1]
    obj = cv2.warpAffine(obj, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    mk = cv2.warpAffine(cv2.erode(mk, np.ones((3, 3), np.uint8)), M, (w, h), flags=cv2.INTER_LINEAR)
    al = np.clip(cv2.GaussianBlur((mk > .5).astype(np.float32), (0, 0), 1.0), 0, 1)
    return np.clip(_blend(base, obj, al), 0, 255).astype(np.uint8)

def _recolor(img, m, to=None, lighten=0.0):
    ys, xs = np.nonzero(m); p = 6; X0, Y0, X1, Y1 = max(0, xs.min() - p), max(0, ys.min() - p), min(img.shape[1], xs.max() + 1 + p), min(img.shape[0], ys.max() + 1 + p)
    crop = img[Y0:Y1, X0:X1]; mm = m[Y0:Y1, X0:X1] > 0
    lab = cv2.cvtColor(crop, cv2.COLOR_RGB2LAB).astype(np.float32); a, b = lab[..., 1] - 128, lab[..., 2] - 128
    lab2 = lab.copy()
    if to:
        t = math.radians(HUES[to]); ma, mb = float(a[mm].mean()), float(b[mm].mean()); c0 = math.hypot(ma, mb); th0 = math.atan2(mb, ma); d = t - th0
        ca, sa = math.cos(d), math.sin(d); a2, b2 = a * ca - b * sa, a * sa + b * ca
        if c0 < 10:   # 거의 무채색: 색을 얹는다
            a2, b2 = a + 22 * math.cos(t), b + 22 * math.sin(t)
        else:
            k = float(np.clip(27.0 / c0, .8, 1.5)); a2, b2 = a2 * k, b2 * k
        lab2[..., 1] = np.clip(a2 + 128, 0, 255); lab2[..., 2] = np.clip(b2 + 128, 0, 255)
    if lighten: lab2[..., 0] = np.clip(lab[..., 0] + lighten * 255 / 100, 0, 255)
    rec = cv2.cvtColor(lab2.astype(np.uint8), cv2.COLOR_LAB2RGB)
    out = img.copy(); out[Y0:Y1, X0:X1] = np.clip(_blend(crop, rec, _feather(m, 0, 1.1)[Y0:Y1, X0:X1]), 0, 255).astype(np.uint8); return out

def apply_edit(img, spec, m):
    op = spec['op']
    if op == 'recolor': return _recolor(img, m, to=spec['to']), '색 바꾸기'
    if op in ('lighten', 'darken'): return _recolor(img, m, lighten=(1 if op == 'lighten' else -1) * spec.get('amt', 30)), '색 바꾸기'
    if op == 'remove': r = _remove(img, m, spec.get('grow', 9)); return r, '없애기'
    if op == 'dup': return _paste(img, img, m, spec['dx'], spec['dy'], spec.get('scale', 1.0), spec.get('flip', False)), '하나 더'
    if op == 'move':
        base = _remove(img, m, spec.get('grow', 9)); return _paste(base, img, m, spec['dx'], spec['dy'], spec.get('scale', 1.0), spec.get('flip', False)), '옮기기'
    if op == 'resize':
        base = _remove(img, m, spec.get('grow', 9)); return _paste(base, img, m, 0, 0, spec['scale'], False, spec.get('anchor', 'center')), '크기 바꾸기'
    if op == 'flip':
        base = _remove(img, m, spec.get('grow', 9)); return _paste(base, img, m, 0, 0, 1.0, True), '뒤집기'
    raise ValueError('모르는 편집: ' + op)

def _changed(before, after, thr=7):
    d = np.abs(before.astype(np.int16) - after.astype(np.int16)).max(2) > thr
    d = cv2.morphologyEx(d.astype(np.uint8), cv2.MORPH_CLOSE, _k(4))
    n, lab, st, _ = cv2.connectedComponentsWithStats(d, 8); keep = np.zeros_like(d)
    if n <= 1: return keep
    big = max(range(1, n), key=lambda i: st[i, cv2.CC_STAT_AREA]); cx0, cy0 = st[big, 0] + st[big, 2] / 2, st[big, 1] + st[big, 3] / 2
    for i in range(1, n):   # 옮기기처럼 두 자리가 바뀌면 가까운 조각을 한 차이로
        if st[i, cv2.CC_STAT_AREA] > 30 and math.hypot(st[i, 0] + st[i, 2] / 2 - cx0, st[i, 1] + st[i, 3] / 2 - cy0) < 3.5 * max(st[big, 2], st[big, 3]) + 80: keep[lab == i] = 1
    return keep

def run_edits(base, specs, sam, strict=True):
    """base uint8 RGB, specs(edits.json 항목들) → (바뀐 그림, 차이 목록[dict(cx,cy,r,side,kind,patch,delta,note,mask,idx)], 문제 목록[str]).
    편집은 차례로 같은 그림에 쌓이고, 차이마다 '바뀐 곳' 조각을 따로 만든다. strict면 문제가 하나라도 있으면 RuntimeError."""
    h, w = base.shape[:2]; L = max(h, w); sam.set_image(base); out = base.copy(); diffs = []; problems = []
    for i, spec in enumerate(specs):
        note = spec.get('note', spec['op'])
        try:
            opts, _ = mask_options(sam, spec, base.shape); last = None; done = False
            for m in opts:
                try:
                    res, kind = apply_edit(out, spec, m)
                    ch = _changed(out, res)
                    if ch.sum() < 120: raise RuntimeError('바뀐 곳이 거의 없어요')
                    ys, xs = np.nonzero(ch); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
                    bw, bh = int(x1 - x0), int(y1 - y0); r = math.hypot(bw, bh) / 2 + 4; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                    if r > L * .13: raise RuntimeError(f'바뀐 곳이 너무 커요(반지름 {r:.0f}px > {L * .13:.0f}) — 더 작은 사물로')
                    if r < L * .016: raise RuntimeError(f'바뀐 곳이 너무 작아요(반지름 {r:.0f}px)')
                    for d in diffs:
                        if math.hypot(cx - d['cx'], cy - d['cy']) < r + d['r'] + L * .02: raise RuntimeError(f'다른 차이와 너무 가까워요({d["note"]})')
                    delta = float(np.abs(res.astype(np.float32) - out.astype(np.float32)).mean(2)[ch > 0].mean())
                if delta < 12: raise RuntimeError(f'바뀐 정도가 약해요(d{delta:.1f}) — 눈에 잘 안 띄어요')
                    side = int(max(bw, bh) + 20); side += side % 2; Xa, Ya = int(round(cx)) - side // 2, int(round(cy)) - side // 2
                    al = _feather(ch, 2, 1.5); patch = np.zeros((side, side, 4), np.uint8)
                    xa, ya, xb, yb = max(Xa, 0), max(Ya, 0), min(Xa + side, w), min(Ya + side, h)
                    patch[ya - Ya:yb - Ya, xa - Xa:xb - Xa, :3] = res[ya:yb, xa:xb]; patch[ya - Ya:yb - Ya, xa - Xa:xb - Xa, 3] = (al[ya:yb, xa:xb] * 255).astype(np.uint8)
                    out = res; diffs.append(dict(cx=float(cx), cy=float(cy), r=float(r), side=side, kind=kind, patch=patch, delta=round(delta, 1), note=note, mask=m, idx=i)); done = True; break
                except RuntimeError as e:
                    last = e
            if not done: raise RuntimeError(str(last) if last else '마스크를 못 땄어요')
        except RuntimeError as e:
            problems.append(f'#{i} {note}: {e}')
    if strict and problems: raise RuntimeError('; '.join(problems))
    return out, diffs, problems
