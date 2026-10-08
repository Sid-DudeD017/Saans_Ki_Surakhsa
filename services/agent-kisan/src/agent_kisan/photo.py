"""Photo intake: where and when a farm photo was taken, a privacy-safe copy, and which machine it shows.

- Location and time come from the photo's EXIF (GPS and DateTimeOriginal), when the phone kept them.
- The stored copy has faces blurred (OpenCV's frontal-face detector; it misses side-on faces),
  all metadata removed, is turned upright and is at most 1600 px on its longest side.
- Machine recognition asks Claude on Bedrock to name the machine; until Bedrock works it is
  reported as unavailable and nothing else is affected.
"""

import io
import json
import os
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from PIL import ExifTags, Image, ImageFilter, ImageOps

MAX_SIDE = 1600
MACHINES = ("happy_seeder", "super_seeder", "mulcher_rmb", "baler")
_GPS_IFD, _EXIF_IFD = 0x8825, 0x8769


@dataclass(frozen=True)
class PhotoInfo:
    lat: float | None
    lon: float | None
    taken_at: datetime | None
    width: int
    height: int
    faces_blurred: int

    def to_json(self) -> dict:
        return {"lat": self.lat, "lon": self.lon, "taken_at": self.taken_at.isoformat() if self.taken_at else None,
                "width": self.width, "height": self.height, "faces_blurred": self.faces_blurred}


Box = tuple[int, int, int, int]  # x, y, width, height


def opencv_faces(image: Image.Image) -> list[Box]:
    import cv2
    import numpy as np

    gray = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    found = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(24, 24))
    return [tuple(int(v) for v in f) for f in found]


def intake(data: bytes, find_faces: Callable[[Image.Image], list[Box]] = opencv_faces) -> tuple[bytes, PhotoInfo]:
    """The cleaned JPEG and what the photo says about itself. Raises ValueError for a non-image."""
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as e:  # Pillow raises several kinds for bad files
        raise ValueError(f"not a photo we can read: {e}") from None
    exif = image.getexif()
    lat, lon = _gps(exif)
    taken = _taken_at(exif)

    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((MAX_SIDE, MAX_SIDE))
    faces = find_faces(image)
    for x, y, w, h in faces:
        pad_x, pad_y = int(w * 0.2), int(h * 0.2)
        box = (max(0, x - pad_x), max(0, y - pad_y), min(image.width, x + w + pad_x), min(image.height, y + h + pad_y))
        region = image.crop(box)
        image.paste(region.filter(ImageFilter.GaussianBlur(radius=max(8, w // 6))), box)

    out = io.BytesIO()
    image.save(out, format="JPEG", quality=85)  # a fresh JPEG: no EXIF, no GPS, no camera details
    return out.getvalue(), PhotoInfo(lat, lon, taken, image.width, image.height, len(faces))


def identify_machine(jpeg: bytes, client=None, model_id: str | None = None) -> dict:
    """{"machine": one of MACHINES or "none" / "other", "confidence": 0-1, "why": "..."} from Claude on Bedrock."""
    import boto3

    client = client or boto3.client("bedrock-runtime", region_name=os.environ.get("KISAN_BEDROCK_REGION", "ap-south-1"))
    prompt = (
        "This photo is from a paddy farmer in Punjab. Which stubble machine is the main subject? Answer with JSON "
        'only: {"machine": "happy_seeder" | "super_seeder" | "mulcher_rmb" | "baler" | "other" | "none", '
        '"confidence": a number from 0 to 1, "why": "one short sentence"}. Use "other" for a different machine, '
        '"none" when no farm machine is visible. A Happy Seeder has a row of tines and seed tubes; a Super Seeder '
        "has a rotor (rotavator) in front of the seed drill; a mulcher has a closed hood with flails; a baler "
        "makes rectangular or round bales."
    )
    res = client.converse(
        modelId=model_id or os.environ.get("KISAN_MODEL_ID", "in.anthropic.claude-opus-5"),
        messages=[{"role": "user", "content": [{"image": {"format": "jpeg", "source": {"bytes": jpeg}}},
                                               {"text": prompt}]}],
        inferenceConfig={"maxTokens": 300},
    )
    text = "".join(b.get("text", "") for b in res["output"]["message"]["content"])
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return {"machine": None, "confidence": 0.0, "why": "no answer we could read", "raw": text[:200]}
    answer = json.loads(match.group(0))
    machine = answer.get("machine")
    if machine not in (*MACHINES, "other", "none"):
        machine = "other"
    return {"machine": machine, "confidence": float(answer.get("confidence", 0)), "why": str(answer.get("why", ""))}


def _gps(exif) -> tuple[float | None, float | None]:
    gps = exif.get_ifd(_GPS_IFD) if exif else {}
    try:
        lat = _degrees(gps[2]) * (-1 if str(gps.get(1, "N")).upper().startswith("S") else 1)
        lon = _degrees(gps[4]) * (-1 if str(gps.get(3, "E")).upper().startswith("W") else 1)
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None, None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
        return None, None
    return round(lat, 6), round(lon, 6)


def _degrees(dms) -> float:
    d, m, s = (float(x) for x in dms)
    return d + m / 60 + s / 3600


def _taken_at(exif) -> datetime | None:
    if not exif:
        return None
    raw = exif.get_ifd(_EXIF_IFD).get(ExifTags.Base.DateTimeOriginal) or exif.get(ExifTags.Base.DateTime)
    try:
        return datetime.strptime(str(raw).strip("\x00 "), "%Y:%m:%d %H:%M:%S") if raw else None
    except ValueError:
        return None
