"""Image decoding and geometric helpers (OpenCV + numpy).

Kept free of heavy model imports so it can be used/tested independently.
"""
from __future__ import annotations

import base64
import binascii
from typing import Tuple

import cv2
import numpy as np

MAX_IMAGE_BYTES = 8 * 1024 * 1024   # 8 MB per image
MAX_DIMENSION = 4096


class FaceError(Exception):
    """Raised for any recoverable face-processing problem (bad image, no face...)."""

    def __init__(self, message: str, code: str = "FACE_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


def decode_base64_image(data: str) -> np.ndarray:
    """Decode a base64 / data-URL image string into a BGR numpy array."""
    if not data or not isinstance(data, str):
        raise FaceError("No image data provided", "NO_IMAGE")

    if data.startswith("data:"):
        try:
            data = data.split(",", 1)[1]
        except IndexError:
            raise FaceError("Malformed data URL", "BAD_IMAGE")

    try:
        raw = base64.b64decode(data, validate=False)
    except (binascii.Error, ValueError):
        raise FaceError("Image is not valid base64", "BAD_IMAGE")

    if len(raw) == 0:
        raise FaceError("Empty image", "BAD_IMAGE")
    if len(raw) > MAX_IMAGE_BYTES:
        raise FaceError("Image is too large", "IMAGE_TOO_LARGE")

    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise FaceError("Could not decode image", "BAD_IMAGE")

    h, w = image.shape[:2]
    if h > MAX_DIMENSION or w > MAX_DIMENSION:
        raise FaceError("Image dimensions too large", "IMAGE_TOO_LARGE")
    return image


def box_area_ratio(bbox: np.ndarray, image_shape: Tuple[int, int]) -> float:
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    box = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    h, w = image_shape[:2]
    frame = float(h * w) or 1.0
    return box / frame
