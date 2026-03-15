"""Image pre-processing: face detection, alignment, CLAHE enhancement."""
from __future__ import annotations

import io
import logging
import math
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np
from PIL import Image, ImageOps

# Register HEIF/HEIC support (iPhone photos)
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

logger = logging.getLogger(__name__)

mp_face_mesh = mp.solutions.face_mesh
mp_face_detection = mp.solutions.face_detection

# Key landmark indices for alignment
LEFT_EYE_IDX = 33
RIGHT_EYE_IDX = 263
NOSE_TIP_IDX = 1


class FaceProcessingError(Exception):
    pass


def load_image(data: bytes) -> np.ndarray:
    """Load image bytes → BGR numpy array."""
    pil_img = Image.open(io.BytesIO(data))
    pil_img = ImageOps.exif_transpose(pil_img)  # fix EXIF rotation
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)


def detect_face(img_bgr: np.ndarray) -> dict:
    """
    Detect a single face and return landmark coordinates.
    Raises FaceProcessingError if no face found or multiple faces.
    """
    with mp_face_detection.FaceDetection(
        model_selection=1, min_detection_confidence=0.5
    ) as det:
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        results = det.process(rgb)

    if not results.detections:
        raise FaceProcessingError("No face detected. Please upload a clear, front-facing photo.")
    if len(results.detections) > 1:
        raise FaceProcessingError("Multiple faces detected. Please upload a photo with only one person.")

    detection = results.detections[0]
    h, w = img_bgr.shape[:2]
    bbox = detection.location_data.relative_bounding_box
    return {
        "x": int(bbox.xmin * w),
        "y": int(bbox.ymin * h),
        "w": int(bbox.width * w),
        "h": int(bbox.height * h),
        "score": detection.score[0],
    }


def align_face(img_bgr: np.ndarray) -> np.ndarray:
    """
    Use FaceMesh to detect eye landmarks and rotate the image so eyes are level.
    Returns aligned BGR image.
    """
    with mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    ) as mesh:
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        results = mesh.process(rgb)

    if not results.multi_face_landmarks:
        raise FaceProcessingError("Could not detect facial landmarks for alignment.")

    landmarks = results.multi_face_landmarks[0].landmark
    h, w = img_bgr.shape[:2]

    lx = landmarks[LEFT_EYE_IDX].x * w
    ly = landmarks[LEFT_EYE_IDX].y * h
    rx = landmarks[RIGHT_EYE_IDX].x * w
    ry = landmarks[RIGHT_EYE_IDX].y * h

    angle = math.degrees(math.atan2(ry - ly, rx - lx))

    cx, cy = w / 2, h / 2
    M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
    aligned = cv2.warpAffine(img_bgr, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

    return aligned


def apply_clahe(img_bgr: np.ndarray, clip_limit: float = 2.0, tile_size: int = 8) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to the L channel in LAB space.
    Enhances local contrast without over-brightening.
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_size, tile_size))
    l_enhanced = clahe.apply(l)

    enhanced_lab = cv2.merge([l_enhanced, a, b])
    return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)


def crop_face(img_bgr: np.ndarray, face: dict, padding: float = 0.4) -> np.ndarray:
    """Crop and pad around detected face bounding box."""
    h, w = img_bgr.shape[:2]
    pad_x = int(face["w"] * padding)
    pad_y = int(face["h"] * padding)

    x1 = max(0, face["x"] - pad_x)
    y1 = max(0, face["y"] - pad_y)
    x2 = min(w, face["x"] + face["w"] + pad_x)
    y2 = min(h, face["y"] + face["h"] + pad_y)

    return img_bgr[y1:y2, x1:x2]


def resize_for_model(img_bgr: np.ndarray, target: int = 512) -> np.ndarray:
    """Resize while preserving aspect ratio, longest side = target."""
    h, w = img_bgr.shape[:2]
    if max(h, w) <= target:
        return img_bgr
    scale = target / max(h, w)
    return cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LANCZOS4)


def to_bytes(img_bgr: np.ndarray, quality: int = 90) -> bytes:
    """Encode BGR image to JPEG bytes."""
    _, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes()


def preprocess_image(raw_bytes: bytes) -> tuple[np.ndarray, dict]:
    """
    Full pipeline: load → detect → align → CLAHE → crop → resize.
    Returns (processed_bgr, face_meta).
    """
    img = load_image(raw_bytes)
    face = detect_face(img)
    aligned = align_face(img)
    enhanced = apply_clahe(aligned)
    cropped = crop_face(enhanced, face)
    resized = resize_for_model(cropped)
    return resized, face
