"""LaMa(big-lama, TorchScript)로 지운 자리를 주변 그림 질감으로 자연스럽게 메운다.
모델 파일(205MB, 저장소에는 넣지 않음, tools/masterpiece/models/big-lama.pt):
  https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt
  SHA-256 344c77bbcb158f17dd143070d1e789f38a66c04202311ae3a258ef66667a9ea9 (LaMa, Apache-2.0)
"""
import os, numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get('MASTERPIECE_LAMA', os.path.join(HERE, 'models', 'big-lama.pt'))

class Lama:
    def __init__(self, path=MODEL, threads=2):
        import torch
        torch.set_num_threads(threads); self.torch = torch; self.m = torch.jit.load(path, map_location='cpu').eval()
    def crop_fill(self, img, mask):
        """img(uint8 RGB), mask(0/1) → 마스크 자리를 메운 같은 크기의 그림(마스크 둘레 일부만 계산해서 빠르게)"""
        torch = self.torch; h, w = mask.shape; ys, xs = np.nonzero(mask)
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1; pad = int(max(56, 1.1 * max(bw, bh)))
        x0, y0, x1, y1 = max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + 1 + pad), min(h, ys.max() + 1 + pad)
        im = img[y0:y1, x0:x1]; mk = (mask[y0:y1, x0:x1] > 0).astype(np.uint8)
        ph, pw = (-im.shape[0]) % 8, (-im.shape[1]) % 8
        im_p = np.pad(im, ((0, ph), (0, pw), (0, 0)), mode='reflect'); mk_p = np.pad(mk, ((0, ph), (0, pw)), mode='constant')
        t_im = torch.from_numpy(im_p.astype(np.float32) / 255).permute(2, 0, 1)[None]; t_mk = torch.from_numpy(mk_p.astype(np.float32))[None, None]
        with torch.no_grad(): out = self.m(t_im, t_mk)[0].permute(1, 2, 0).numpy()
        out = np.clip(out * 255, 0, 255).astype(np.uint8)[:im.shape[0], :im.shape[1]]
        res = img.copy(); res[y0:y1, x0:x1] = out
        return res
