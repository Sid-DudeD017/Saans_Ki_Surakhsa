"""The read-back card and spoken script, the speaker, and the audio endpoint (fake voice: no PyTorch)."""

import io
import wave
from datetime import date

import numpy as np
import pytest
from fastapi.testclient import TestClient

from agent_kisan import api
from agent_kisan.readback import build
from agent_kisan.session import KisanSession
from agent_kisan.tts import Speaker

PROFILE = {"paddy_area": 18, "paddy_unit": "killa", "harvest_date": "2026-10-20", "wheat_deadline": "2026-11-09",
           "tractors": 1, "machines": {"super_seeder": 2}, "decomposer_acres": 0}
PLAN = {"plan": [{"date": "2026-11-02", "machine": "super_seeder", "chc_name": "Demo CHC A", "acres": 5.5,
                  "cost_inr": 5500}], "coverage_after_pct": 92, "unmet": [{"acres": 1.5}]}


def test_gurpreet_in_punjabi():
    rb = build(PROFILE, {"coverage_pct": 61}, PLAN, "pa")
    assert "ਝੋਨਾ ਅਠਾਰਾਂ ਕਿੱਲੇ।" in rb.sentences
    assert "ਵਾਢੀ ਵੀਹ ਅਕਤੂਬਰ, ਕਣਕ ਦੀ ਬਿਜਾਈ ਨੌਂ ਨਵੰਬਰ ਤੱਕ।" in rb.sentences
    assert "ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ ਨਾਲ ਲਗਭਗ ਸੱਠ ਪ੍ਰਤੀਸ਼ਤ।" in rb.sentences  # 61 has no words yet: "about 60"
    assert rb.sentences[-2].startswith("ਹਾਲੇ ਵੀ ਬਾਕੀ ਡੇਢ ਕਿੱਲੇ।")
    kinds = [i["kind"] for i in rb.card["items"]]
    assert kinds == ["paddy", "harvest", "wheat_by", "tractors", "machine", "coverage", "booking", "coverage_after", "short"]
    assert rb.card["items"][5]["value"] == "61%"  # the card is always exact


def test_hindi_and_exact_numbers_where_we_have_words():
    rb = build(PROFILE, {"coverage_pct": 50}, {"plan": [], "unmet": [{"acres": 9}]}, "hi")
    assert "आपकी मशीनों से पचास प्रतिशत।" in rb.sentences  # 50 is exact, no "about"
    assert "धान अठारह किल्ले।" in rb.sentences


def test_a_farmer_number_without_words_points_to_the_card():
    rb = build({**PROFILE, "paddy_area": 67}, {"coverage_pct": 16}, {"plan": [], "unmet": [{"acres": 56.5}]}, "pa")
    assert "ਝੋਨਾ ਕਾਰਡ ਉੱਤੇ ਵੇਖੋ ਕਿੱਲੇ।" in rb.sentences
    assert rb.card["items"][0]["value"] == "67"


def test_no_machines_no_tractor_all_covered():
    rb = build({**PROFILE, "tractors": 0, "machines": {}, "decomposer_acres": 18}, {"coverage_pct": 100},
               {"plan": [], "unmet": []}, "hi")
    assert "कोई ट्रैक्टर नहीं।" in rb.sentences and "कोई मशीन नहीं।" in rb.sentences
    assert "सारा धान बिना आग के संभाला जाएगा।" in rb.sentences


def test_english_gets_a_card_but_no_voice():
    rb = build(PROFILE, {"coverage_pct": 61}, PLAN, "en")
    assert rb.sentences == [] and rb.card["spoken"] is False
    assert rb.card["items"][4]["label"] == "Super Seeder"


class FakeVoice:
    made = []

    def __init__(self, language):
        FakeVoice.made.append(language)

    def synthesize(self, text):
        return np.concatenate([np.zeros(800), np.sin(np.arange(1600) / 5.0), np.zeros(800)]), 16000


def test_speaker_trims_pauses_and_caches():
    FakeVoice.made = []
    sp = Speaker(voice_factory=FakeVoice)
    a = sp.speak(["one.", "two."], "pa")
    with wave.open(io.BytesIO(a)) as w:
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (16000, 1, 2)
        seconds = w.getnframes() / 16000
    assert 0.5 < seconds < 0.75  # two trimmed 0.1 s tones + padding + one 0.3 s pause
    assert sp.speak(["one.", "two."], "pa") is a  # cached
    assert FakeVoice.made == ["pa"]
    with pytest.raises(ValueError):
        sp.speak(["hello"], "en")
    with wave.open(io.BytesIO(sp.speak(["one.", "।", "..."], "pa"))) as w:  # punctuation-only sentences skipped
        assert w.getnframes() / 16000 < 0.3


SAID = "Bhawanigarh, Sangrur. 18 killa. Harvest 20 October, wheat by 9 November. 1 tractor, Super Seeder 2 din."


class ReadbackChat:
    def __init__(self, language):
        self.session = KisanSession(filer=None, language=language, weather=None, today=lambda: date(2026, 10, 8))

    def send(self, text, distrust=frozenset()):
        s = self.session
        s.begin_turn(text, distrust)
        if s.turn == 1:
            s.update(village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa",
                     harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2})
            s.prepare_readback()
        return "please confirm"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api, "chat_factory", ReadbackChat)
    monkeypatch.setattr(api, "speaker_factory", lambda: Speaker(voice_factory=FakeVoice))
    return TestClient(api.app)


def test_readback_card_and_audio_through_the_api(client):
    res = client.post("/v1/agent/kisan/messages", json={"text": SAID}).json()
    rb = res["readback"]
    assert rb["card"]["items"][0] == {"kind": "paddy", "icon": "field", "value": "18", "unit": "ਕਿੱਲੇ"}
    assert rb["text"].startswith("ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਇਹ ਹੈ।")
    audio = client.get(rb["audio_url"])
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/wav"
    assert audio.content[:4] == b"RIFF"
    # the next message isn't a read-back, and once details change the old audio is gone
    later = client.post("/v1/agent/kisan/messages", json={"session_id": res["session_id"], "text": "ok"}).json()
    assert later["readback"] is None
    api._chats[res["session_id"]].session.update(tractors=2)
    assert client.get(rb["audio_url"]).status_code == 404


def test_audio_errors(client, monkeypatch):
    assert client.get("/v1/agent/kisan/sessions/nope/readback.wav").status_code == 404
    sid = client.post("/v1/agent/kisan/messages", json={"text": SAID}).json()["session_id"]

    def no_torch():
        raise ImportError("No module named 'torch'")

    monkeypatch.setattr(api, "speaker_factory", no_torch)
    res = client.get(f"/v1/agent/kisan/sessions/{sid}/readback.wav")
    assert res.status_code == 503 and "aren't set up" in res.json()["error"]["message"]


def test_readback_audio_is_prepared_in_the_background(client, monkeypatch):
    speaker = Speaker(voice_factory=FakeVoice)
    monkeypatch.setattr(api, "speaker_factory", lambda: speaker)
    res = client.post("/v1/agent/kisan/messages", json={"text": SAID}).json()
    api._prewarmed[res["session_id"]].result(timeout=5)
    assert len(speaker._cache) == 1  # spoken before anyone asked for it
    assert client.get(res["readback"]["audio_url"]).status_code == 200
    assert len(speaker._cache) == 1  # and not spoken again


def test_background_audio_failure_does_not_break_the_reply(client, monkeypatch):
    def no_torch():
        raise ImportError("No module named 'torch'")

    monkeypatch.setattr(api, "speaker_factory", no_torch)
    res = client.post("/v1/agent/kisan/messages", json={"text": SAID})
    assert res.status_code == 200
    api._prewarmed[res.json()["session_id"]].result(timeout=5)
