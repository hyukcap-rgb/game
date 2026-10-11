"""EfficientSAM-Ti(ONNX, OpenCV dnn)로 '점 하나 → 그 사물의 마스크' 얻기.
모델 파일(48MB, 저장소에는 넣지 않음, tools/masterpiece/models/efficientsam_ti.onnx):
  https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/image_segmentation_efficientsam/image_segmentation_efficientsam_ti_2025april.onnx
  SHA-256 4eb496e0a7259d435b49b66faf1754aa45a5c382a34558ddda9a8c6fe5915d77 (opencv_zoo, Apache-2.0)
"""
import os, numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get('MASTERPIECE_SAM', os.path.join(HERE, 'models', 'efficientsam_ti.onnx'))

class Sam:
    def __init__(self, path=MODEL):
        self.net = cv2.dnn.readNet(path); self.S = 1024; self.size = None; self.blob = None
    def set_image(self, rgb):
        self.size = (rgb.shape[1], rgb.shape[0])
        im = cv2.resize(rgb, (self.S, self.S)).astype(np.float32) / 255.0
        self.blob = cv2.dnn.blobFromImage(im)
    def masks_at(self, x, y):
        """(x,y) 점 하나 → [(마스크 uint8 0/1, 예측 IoU)] 3개(작은 것부터 큰 것까지 섞여 나옴)"""
        W, H = self.size; pts = np.zeros((1, 1, 6, 2), np.float32); lab = np.full((1, 1, 6, 1), -1, np.float32)
        pts[0, 0, 0] = (x * self.S / W, y * self.S / H); lab[0, 0, 0] = 1
        self.net.setInput(self.blob, 'batched_images'); self.net.setInput(pts, 'batched_point_coords'); self.net.setInput(lab, 'batched_point_labels')
        out, iou = self.net.forward(['output_masks', 'iou_predictions'])
        res = []
        for k in range(out.shape[2]):
            lg = cv2.resize(out[0, 0, k].astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)
            res.append(((lg >= 0).astype(np.uint8), float(iou[0, 0, k])))
        return res
