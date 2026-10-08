"""Photo intake: EXIF location and time, face blur, stripped metadata, machine recognition (faked)."""

import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from agent_kisan import api
from agent_kisan.photo import intake, identify_machine
from agent_kisan.session import KisanSession


def jpeg(gps=True, size=(800, 600), orientation=None):
    img = Image.new("RGB", size)
    img.paste((40, 160, 60), (0, 0, size[0], size[1]))
    noise = (np.random.default_rng(0).random((120, 120, 3)) * 255).astype("uint8")
    img.paste(Image.fromarray(noise), (100, 100))  # a busy patch where the "face" is
    exif = img.getexif()
    if gps:
        exif.get_ifd(0x8825).update({1: "N", 2: (30.0, 15.0, 57.6), 3: "E", 4: (76.0, 2.0, 24.0)})
    exif.get_ifd(0x8769)[0x9003] = "2026:10:21 09:15:30"
    if orientation:
        exif[0x0112] = orientation
    out = io.BytesIO()
    img.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def face_at(box):
    return lambda image: [box]


def test_reads_gps_and_time():
    cleaned, info = intake(jpeg(), find_faces=lambda i: [])
    assert (info.lat, info.lon) == (30.266, 76.04)
    assert info.taken_at.isoformat() == "2026-10-21T09:15:30"


def test_the_stored_copy_has_no_metadata():
    cleaned, _ = intake(jpeg(), find_faces=lambda i: [])
    out = Image.open(io.BytesIO(cleaned))
    assert dict(out.getexif()) == {} and not out.getexif().get_ifd(0x8825)


def test_faces_are_blurred():
    original = np.asarray(Image.open(io.BytesIO(jpeg())).convert("RGB")).astype(float)
    cleaned, info = intake(jpeg(), find_faces=face_at((110, 110, 100, 100)))
    after = np.asarray(Image.open(io.BytesIO(cleaned)).convert("RGB")).astype(float)
    assert info.faces_blurred == 1
    assert after[120:200, 120:200].std() < original[120:200, 120:200].std() / 3  # the busy patch is smoothed
    assert np.abs(after[400:500, 500:700] - original[400:500, 500:700]).mean() < 3  # the rest is untouched


def test_turned_upright_and_downsized():
    cleaned, info = intake(jpeg(size=(4000, 3000), orientation=6), find_faces=lambda i: [])
    assert (info.width, info.height) == (1200, 1600)  # rotated 90 degrees and scaled to 1600 px


def test_no_gps_and_not_a_photo():
    _, info = intake(jpeg(gps=False), find_faces=lambda i: [])
    assert (info.lat, info.lon) == (None, None)
    with pytest.raises(ValueError, match="not a photo"):
        intake(b"%PDF-1.7 not an image")


def test_real_face_detector_runs_on_a_photo_without_faces():
    _, info = intake(jpeg())
    assert info.faces_blurred == 0


class FakeBedrock:
    def __init__(self, text):
        self.text, self.calls = text, []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        return {"output": {"message": {"content": [{"text": self.text}]}}}


def test_identify_machine_parses_the_answer():
    fake = FakeBedrock('Here: {"machine": "super_seeder", "confidence": 0.86, "why": "rotor ahead of the drill"}')
    out = identify_machine(b"jpeg", client=fake, model_id="m")
    assert out == {"machine": "super_seeder", "confidence": 0.86, "why": "rotor ahead of the drill"}
    content = fake.calls[0]["messages"][0]["content"]
    assert content[0]["image"]["source"]["bytes"] == b"jpeg"
    assert identify_machine(b"j", client=FakeBedrock('{"machine": "combine", "confidence": 1}'))["machine"] == "other"
    assert identify_machine(b"j", client=FakeBedrock("no idea"))["machine"] is None


def test_photo_endpoint(monkeypatch, tmp_path):
    monkeypatch.setenv("KISAN_PHOTOS", str(tmp_path))
    monkeypatch.setattr(api, "machine_identifier", lambda jpeg: {"machine": "happy_seeder", "confidence": 0.9, "why": "tines"})
    session = KisanSession(filer=None, weather=None)
    api._chats["photo-test"] = type("Chat", (), {"session": session})()
    client = TestClient(api.app)
    res = client.post("/v1/agent/kisan/photo", data={"session_id": "photo-test"},
                      files={"photo": ("field.jpg", jpeg(), "image/jpeg")}).json()
    assert res["photo"]["lat"] == 30.266 and "farm location" in res["location"]
    assert (session.profile.lat, session.profile.lon) == (30.266, 76.04)
    assert res["machine"]["machine"] == "happy_seeder"
    stored = list(tmp_path.rglob("*.jpg"))
    assert len(stored) == 1 and not Image.open(stored[0]).getexif().get_ifd(0x8825)


def test_photo_endpoint_errors(monkeypatch, tmp_path):
    monkeypatch.setenv("KISAN_PHOTOS", str(tmp_path))

    def blocked(jpeg):
        raise ValueError("Operation not allowed")

    monkeypatch.setattr(api, "machine_identifier", blocked)
    client = TestClient(api.app)
    ok = client.post("/v1/agent/kisan/photo", files={"photo": ("f.jpg", jpeg(), "image/jpeg")}).json()
    assert "unavailable" in ok["machine"]["error"] and ok["location"] is None
    assert client.post("/v1/agent/kisan/photo", files={"photo": ("f.txt", b"hello", "text/plain")}).status_code == 422
    assert client.post("/v1/agent/kisan/photo", files={"photo": ("f.jpg", b"", "image/jpeg")}).status_code == 422
    assert client.post("/v1/agent/kisan/photo", data={"session_id": "nope"},
                       files={"photo": ("f.jpg", jpeg(), "image/jpeg")}).status_code == 404
