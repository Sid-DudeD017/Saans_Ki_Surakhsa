"""Speech to text for farmers' voice notes, behind one interface so the backend is a setting.

    KISAN_ASR_BACKEND=local      faster-whisper on this machine (development; `asr` dependency group)
    KISAN_ASR_BACKEND=sagemaker  a Whisper endpoint on SageMaker (deployed; KISAN_ASR_ENDPOINT)
    KISAN_ASR_MODEL              local model, default large-v3-turbo (about 1.6 GB, downloaded once)

Besides the text, a transcript lists the numbers Whisper was unsure of (word probability below
UNSURE_BELOW). The number guard won't count those as heard, so the farmer is asked to confirm
them: this is how speech-recognition mistakes in numbers get caught, not only the model's.
"""

import io
import json
import os
import time
from dataclasses import dataclass, field
from functools import cache
from typing import Protocol

from agent_kisan.numbers import numbers_in

UNSURE_BELOW = 0.6
WHISPER_LANGUAGE = {"pa": "pa", "hi": "hi", "en": "en"}  # anything else: let Whisper detect it


@dataclass(frozen=True)
class Transcript:
    text: str
    language: str | None
    seconds: float
    unsure_numbers: frozenset[float] = field(default_factory=frozenset)
    backend: str = "local"

    def to_json(self) -> dict:
        return {"text": self.text, "language": self.language, "seconds": round(self.seconds, 2),
                "unsure_numbers": sorted(self.unsure_numbers), "backend": self.backend}


class Transcriber(Protocol):
    def transcribe(self, audio: bytes, language: str | None = None) -> Transcript: ...


class LocalWhisper:
    def __init__(self, model: str | None = None, device: str = "cpu", compute_type: str = "int8"):
        self.model_name = model or os.environ.get("KISAN_ASR_MODEL", "large-v3-turbo")
        self.device, self.compute_type = device, compute_type
        self._model = None

    def _load(self):
        if self._model is None:
            from faster_whisper import WhisperModel  # only in the asr group

            self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        return self._model

    def transcribe(self, audio: bytes, language: str | None = None) -> Transcript:
        started = time.monotonic()
        segments, info = self._load().transcribe(
            io.BytesIO(audio), language=WHISPER_LANGUAGE.get(language or ""), word_timestamps=True,
            vad_filter=True, beam_size=5, condition_on_previous_text=False,
        )
        words = [w for s in segments for w in (s.words or [])]
        text = "".join(w.word for w in words).strip()
        return Transcript(text, info.language, time.monotonic() - started, _unsure_numbers(words), "local")


class SageMakerWhisper:
    """A Whisper model behind a SageMaker endpoint (Hugging Face inference container: audio in, {"text"} out).

    Not yet tested against a live endpoint. That endpoint returns no word probabilities, so
    unsure_numbers stays empty and only the read-back guards speech mistakes.
    """

    def __init__(self, endpoint: str | None = None, region: str | None = None):
        import boto3

        self.endpoint = endpoint or os.environ["KISAN_ASR_ENDPOINT"]
        self.client = boto3.client("sagemaker-runtime",
                                   region_name=region or os.environ.get("KISAN_BEDROCK_REGION", "ap-south-1"))

    def transcribe(self, audio: bytes, language: str | None = None) -> Transcript:
        started = time.monotonic()
        res = self.client.invoke_endpoint(EndpointName=self.endpoint, ContentType="audio/x-audio", Body=audio)
        body = json.loads(res["Body"].read())
        text = (body[0] if isinstance(body, list) else body).get("text", "").strip()
        return Transcript(text, language, time.monotonic() - started, frozenset(), "sagemaker")


def _unsure_numbers(words) -> frozenset[float]:
    """Numbers written with any word Whisper heard with low probability."""
    unsure = set()
    for w in words:
        if w.probability < UNSURE_BELOW:
            unsure |= {round(m.value, 2) for m in numbers_in(w.word)}
    return frozenset(unsure)


@cache
def default_transcriber() -> Transcriber:
    backend = os.environ.get("KISAN_ASR_BACKEND", "local")
    if backend == "sagemaker":
        return SageMakerWhisper()
    if backend == "local":
        return LocalWhisper()
    raise ValueError(f"KISAN_ASR_BACKEND must be local or sagemaker, not {backend!r}")
