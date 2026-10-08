"""Voice notes: speech recognition doubts reach the number guard, and the voice endpoint."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from agent_kisan import api
from agent_kisan.numbers import numbers_in
from agent_kisan.session import KisanSession
from agent_kisan.transcribe import Transcript, _unsure_numbers

WHISPER_HINDI = "मेरे पास 18 एकर धान है, कताई 20 अक्तोबर को होगी, एक ट्रक्तर है और सुपर सीधर धाई दिन के लिए मिलेगा."


def test_whispers_hindi_spellings_are_understood():
    """The real output of large-v3-turbo on a Hindi test clip."""
    assert [(m.value, m.kind) for m in numbers_in(WHISPER_HINDI)] == [
        (18, "area"), (20, "month"), (1, "tractors"), (2.5, "days")]


def test_low_probability_number_words_are_distrusted():
    class W:
        def __init__(self, word, probability):
            self.word, self.probability = word, probability

    assert _unsure_numbers([W(" मेरे", 0.2), W(" अठारह", 0.4), W(" एकड़", 0.9), W(" दो", 0.95)]) == {18.0}


def test_a_distrusted_number_is_not_heard():
    s = KisanSession(filer=None, weather=None, today=lambda: date(2026, 10, 8), language="hi")
    s.begin_turn("मेरे पास अठारह एकड़ धान है", distrust=frozenset({18.0}))
    s.update(paddy_area=18, paddy_unit="acre")
    [u] = s.unsure()
    assert u["label"] == "18 एकड़"
    s.begin_turn(u["send_text"])  # typed or tapped: no speech recognition involved
    assert s.unsure() == []


class FakeTranscriber:
    def __init__(self, text, unsure=frozenset()):
        self.text, self.unsure_numbers = text, unsure
        self.calls = []

    def transcribe(self, audio, language=None):
        self.calls.append((audio, language))
        return Transcript(self.text, language, 0.5, self.unsure_numbers, "fake")


class EchoChat:
    def __init__(self, language):
        self.session = KisanSession(filer=None, language=language, weather=None)

    def send(self, text, distrust=frozenset()):
        self.session.begin_turn(text, distrust)
        self.session.update(paddy_area=18)
        return f"heard: {text}"

    def send_voice(self, audio, transcriber):
        from agent_kisan.agent import KisanChat

        return KisanChat.send_voice(self, audio, transcriber)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api, "chat_factory", EchoChat)
    return TestClient(api.app)


def test_voice_note_is_transcribed_and_answered(client, monkeypatch):
    fake = FakeTranscriber("मेरे पास अठारह एकड़ धान है", frozenset({18.0}))
    monkeypatch.setattr(api, "transcriber_factory", lambda: fake)
    res = client.post("/v1/agent/kisan/voice", data={"language": "hi"},
                      files={"audio": ("note.m4a", b"fake-audio", "audio/mp4")}).json()
    assert res["transcript"]["text"] == "मेरे पास अठारह एकड़ धान है"
    assert res["reply"].startswith("heard:")
    assert fake.calls == [(b"fake-audio", "hi")]
    assert [q["slot"] for q in res["quick_replies"]] == ["paddy_area"]  # 18 was a doubtful word


def test_silence_and_oversize_are_rejected(client, monkeypatch):
    monkeypatch.setattr(api, "transcriber_factory", lambda: FakeTranscriber(""))
    assert client.post("/v1/agent/kisan/voice", files={"audio": ("a.wav", b"x", "audio/wav")}).status_code == 422
    assert client.post("/v1/agent/kisan/voice", files={"audio": ("a.wav", b"", "audio/wav")}).status_code == 422
    monkeypatch.setattr(api, "MAX_AUDIO_BYTES", 4)
    assert client.post("/v1/agent/kisan/voice", files={"audio": ("a.wav", b"12345", "audio/wav")}).status_code == 413


def test_no_speech_backend_is_a_503(client, monkeypatch):
    def missing():
        raise ImportError("No module named 'faster_whisper'")

    monkeypatch.setattr(api, "transcriber_factory", missing)
    res = client.post("/v1/agent/kisan/voice", files={"audio": ("a.wav", b"x", "audio/wav")})
    assert res.status_code == 503 and "isn't set up" in res.json()["error"]["message"]


def test_whisper_missing_at_first_use_is_a_503(client, monkeypatch):
    class LazyMissing:
        def transcribe(self, audio, language=None):
            raise ImportError("No module named 'faster_whisper'")

    monkeypatch.setattr(api, "transcriber_factory", LazyMissing)
    res = client.post("/v1/agent/kisan/voice", files={"audio": ("a.wav", b"x", "audio/wav")})
    assert res.status_code == 503
