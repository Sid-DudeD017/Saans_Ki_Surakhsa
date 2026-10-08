"""Speaks the read-back aloud with Meta's MMS voices (facebook/mms-tts-pan, facebook/mms-tts-hin;
CC-BY-NC 4.0), sentence by sentence, about a second per read-back on a laptop CPU.

Whole sentences: one-word clips stitched together were unintelligible (speech recognition missed
every number), while the same words spoken as sentences came through. Results are cached, so
replaying a read-back is instant. Swap in AI4Bharat's Indic Parler-TTS (gated on Hugging Face)
by adding a voice with the same synthesize(text) -> (samples, rate) shape.
"""

import io
import math
import os
import threading
import unicodedata
import wave
from collections import OrderedDict

MODELS = {"pa": "facebook/mms-tts-pan", "hi": "facebook/mms-tts-hin"}
PAUSE_SECONDS = 0.3
CACHE_SIZE = 256


class MmsVoice:
    def __init__(self, language: str):
        import torch
        from transformers import AutoTokenizer, VitsModel

        self.torch = torch
        torch.set_num_threads(usable_cpus())  # PyTorch otherwise starts a thread per host core
        self.tokenizer = AutoTokenizer.from_pretrained(MODELS[language])
        self.model = VitsModel.from_pretrained(MODELS[language]).eval()
        self.rate = self.model.config.sampling_rate

    def synthesize(self, text: str):
        self.torch.manual_seed(0)  # VITS samples its timing; a fixed seed gives the same audio for the same text
        inputs = self.tokenizer(text, return_tensors="pt")
        with self.torch.no_grad():
            return self.model(**inputs).waveform[0].numpy(), self.rate


class Speaker:
    def __init__(self, voice_factory=MmsVoice):
        self.voice_factory = voice_factory
        self._voices: dict[str, object] = {}
        self._cache: OrderedDict[tuple[str, str], bytes] = OrderedDict()
        self._lock = threading.Lock()  # the models aren't safe to share between threads

    def speak(self, sentences: list[str], language: str) -> bytes:
        """One WAV for the sentences, with a short pause between them."""
        if language not in MODELS:
            raise ValueError(f"no voice for {language!r}; spoken read-backs are {', '.join(MODELS)}")
        key = (language, "\n".join(sentences))
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            voice = self._voices.get(language) or self._voices.setdefault(language, self.voice_factory(language))
            import numpy as np

            parts, rate = [], None
            for s in sentences:
                if not any(unicodedata.category(c)[0] == "L" for c in s):
                    continue  # nothing to say (punctuation only); the voice can't take an empty input
                samples, rate = voice.synthesize(s)
                parts += [_tidy(np.asarray(samples, dtype="float32"), rate), np.zeros(int(rate * PAUSE_SECONDS), "float32")]
            audio = _wav(np.concatenate(parts[:-1]) if parts else np.zeros(1, "float32"), rate or 16000)
            self._cache[key] = audio
            if len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
            return audio


def usable_cpus() -> int:
    """CPUs this process may really use: a container's CPU quota (cgroup v2), else the visible cores."""
    if env := os.environ.get("KISAN_TTS_THREADS"):
        return max(1, int(env))
    try:
        quota, period = open("/sys/fs/cgroup/cpu.max").read().split()
        if quota != "max":
            return max(1, math.floor(int(quota) / int(period)))
    except (OSError, ValueError):
        pass
    return max(1, len(os.sched_getaffinity(0)) if hasattr(os, "sched_getaffinity") else os.cpu_count() or 1)


def _tidy(samples, rate: int, threshold: float = 0.02, pad_seconds: float = 0.05):
    """Trim silence at both ends and scale to a common peak."""
    import numpy as np

    peak = float(np.abs(samples).max()) if samples.size else 0.0
    if peak == 0.0:
        return samples
    loud = np.flatnonzero(np.abs(samples) > threshold * peak)
    pad = int(rate * pad_seconds)
    samples = samples[max(0, loud[0] - pad): loud[-1] + pad]
    return samples / peak * 0.9


def _wav(samples, rate: int) -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((samples.clip(-1, 1) * 32767).astype("<i2").tobytes())
    return out.getvalue()


_default: Speaker | None = None


def default_speaker() -> Speaker:
    global _default
    if _default is None:
        _default = Speaker()
    return _default
