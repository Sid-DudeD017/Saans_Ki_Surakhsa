"""P1's proposal for packages/contracts, generated from the API itself.

    uv run python -m agent_kisan.contract   # rewrites packages/contracts/proposals/p1-kisan.openapi.json

Every JSON response has an example, made by calling the route on the demo story (Gurpreet in
Bhawanigarh, today pinned to 8 Oct 2026). Where a route needs Bedrock, speech or SMS, a scripted
conversation, transcriber and SMS sender stand in, so the examples are the service's real shapes. The proposal also carries FarmerSupportComplaint: what Kisan sends to Saans
Command's POST /v1/complaints, for P4 to merge into ComplaintInput.
"""

import copy
import json
from datetime import date

from fastapi.testclient import TestClient
from pydantic.json_schema import models_json_schema

from agent_kisan import api
from agent_kisan.fires import Fire, FiresNear
from agent_kisan.seed import repo_root

PROPOSAL = repo_root() / "packages" / "contracts" / "proposals" / "p1-kisan.openapi.json"
TODAY = date(2026, 10, 8)

# Line 1 of video/scene-0020-gurpreet.md
GURPREET_SAYS = "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ। ਮੈਂ ਗੁਰਪ੍ਰੀਤ, ਪਿੰਡ ਭਵਾਨੀਗੜ੍ਹ, ਜ਼ਿਲ੍ਹਾ ਸੰਗਰੂਰ। ਅਠਾਰਾਂ ਕਿੱਲੇ ਝੋਨਾ ਹੈ। ਵਾਢੀ ਵੀਹ ਅਕਤੂਬਰ ਨੂੰ, ਕਣਕ ਨੌਂ ਨਵੰਬਰ ਤੱਕ ਬੀਜਣੀ ਹੈ। ਇੱਕ ਟਰੈਕਟਰ ਹੈ, ਸੁਪਰ ਸੀਡਰ ਦੋ ਦਿਨ ਲਈ ਮਿਲੂਗਾ।"
GURPREET_COVERAGE = {
    "paddy": {"value": 18, "unit": "killa"},
    "window_days": 20,
    "tractors": 1,
    "machines": [{"type": "super_seeder", "days": 2}],
}
GURPREET_PLAN = {
    "paddy": {"value": 18, "unit": "killa"},
    "harvest_date": "2026-10-20",
    "wheat_deadline": "2026-11-09",
    "tractors": 1,
    "machines": [{"type": "super_seeder", "days": 2}],
    "village": "Bhawanigarh",
    "district": "Sangrur",
    "rain_dates": ["2026-10-27", "2026-10-28"],
}
GURPREET_HELP_REQUEST = {
    "id": "kisan-3f9c2a", "farmerId": "kisan-farmer-3f9c2a", "farmLocation": {"lat": 30.266, "lon": 76.04},
    "district": "Sangrur", "crop": "Paddy", "acreage": 18.0, "machineType": "Happy Seeder",
    "requiredFrom": "2026-10-20T00:00:00+05:30", "requiredUntil": "2026-11-09T00:00:00+05:30",
    "coveragePercent": 92, "uncoveredAcres": 1.5, "status": "OPEN",
}
MACHINE_ASSET = {
    "id": "machine-1", "chcId": "demo-chc-b", "chcName": "Demo CHC B, Bhawanigarh", "location": {"lat": 30.32, "lon": 76.04},
    "machineType": "Happy Seeder", "availableFrom": "2026-11-01T00:00:00+05:30",
    "availableUntil": "2026-11-30T00:00:00+05:30", "status": "AVAILABLE", "capacityAcresPerDay": 7,
}
REQUEST_EXAMPLES = {
    ("/v1/farm/coverage", "post"): GURPREET_COVERAGE,
    ("/v1/farm/plan", "post"): GURPREET_PLAN,
    ("/v1/allocations", "post"): {"helpRequests": [GURPREET_HELP_REQUEST], "machineAssets": [MACHINE_ASSET],
                                  "today": "2026-10-08"},
    ("/v1/agent/kisan/messages", "post"): {"text": GURPREET_SAYS, "language": "pa",
                                           "farmer_phone": "+919876543210"},
    ("/v1/agent/kisan/help-requests/{help_request_id}/status", "post"): {
        "status": "machine_assigned", "machineType": "Happy Seeder", "chcName": "Demo CHC B",
        "chcPhone": "+91 00000 00002", "date": "2026-11-02"},
}
P4_ERROR = "./p4-command.openapi.yaml#/components/schemas/ErrorEnvelope"  # one error shape for every service
# Errors a call on the demo story can't trigger (no Bedrock, a full seed): each route's real message,
# written with the same error_body() the API uses. The rest come from real bad requests below.
KISAN = "/v1/agent/kisan"
# FastAPI lists a 422 on every route with a parameter, but a string session id can't fail validation.
NO_422 = {(f"{KISAN}/sessions/{{session_id}}/status", "get"), (f"{KISAN}/sessions/{{session_id}}/readback.wav", "get")}
HAND_ERRORS = {
    ("/v1/farm/plan", "post", "503"): "CHC data unavailable: data/seed/chc_demo.json not found",
    ("/v1/chcs", "get", "503"): "CHC data unavailable: data/seed/chc_demo.json not found",
    (f"{KISAN}/messages", "post", "409"): "still answering the previous message in this conversation",
    (f"{KISAN}/messages", "post", "503"): "the language model is unavailable: AccessDeniedException",
    (f"{KISAN}/voice", "post", "409"): "still answering the previous message in this conversation",
    (f"{KISAN}/voice", "post", "413"): "voice notes can be up to 10 MB",
    (f"{KISAN}/voice", "post", "503"): "speech recognition isn't set up here: No module named 'faster_whisper'",
    (f"{KISAN}/photo", "post", "413"): "photos can be up to 15 MB",
    (f"{KISAN}/sessions/{{session_id}}/readback.wav", "get", "503"):
        "spoken read-backs aren't set up here: No module named 'torch'",
}


def _demo_fires(lat: float, lon: float, radius_km: float) -> FiresNear:
    return FiresNear((Fire(30.2696, 76.04, 0.4, "2026-10-23T13:42:00+05:30", "N", "nominal", 6.1),
                      Fire(30.293, 76.04, 3.0, "2026-10-23T13:42:00+05:30", "N", "high", 11.4)),
                     radius_km, "2026-10-23T14:00:00+05:30")


class _ScriptedChat:
    """Gurpreet's conversation without Bedrock: everything on turn 1, read back, filed on his yes."""

    ids = iter(["3f9c2a", "7d41b0", "c09e55"])

    def __init__(self, language):
        from agent_kisan.session import KisanSession

        self.session = KisanSession(filer=_Keep(), session_id=next(self.ids), language=language, weather=None,
                                    today=lambda: TODAY, rain_dates={date(2026, 10, 27), date(2026, 10, 28)},
                                    fire_source=None)

    def send(self, text, distrust=frozenset()):
        s = self.session
        s.begin_turn(text, distrust)
        if s.turn == 1:
            s.update(village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa",
                     harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2})
            s.prepare_readback()
            return "ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਇਹ ਹੈ: ਝੋਨਾ ਅਠਾਰਾਂ ਕਿੱਲੇ … ਕੀ ਇਹ ਸਭ ਠੀਕ ਹੈ?"
        s.file_report()
        return "ਤੁਹਾਡੀ ਮਦਦ ਦੀ ਬੇਨਤੀ ਖੇਤੀਬਾੜੀ ਵਿਭਾਗ ਕੋਲ ਭੇਜ ਦਿੱਤੀ ਹੈ। ਹਾਲੇ ਬਾਕੀ ਡੇਢ ਕਿੱਲੇ।"

    def send_voice(self, audio, transcriber=None):
        transcript = transcriber.transcribe(audio, self.session.language)
        return self.send(transcript.text, transcript.unsure_numbers), transcript


class _Keep:
    def file(self, request):
        return {"via": "outbox"}


class _Transcriber:
    def transcribe(self, audio, language=None):
        from agent_kisan.transcribe import Transcript

        return Transcript(text=GURPREET_SAYS, language="pa", seconds=11.4)


class _Sms:
    def send(self, phone, text):
        return {"via": "sns", "message_id": "0f1e2d3c"}


def _photo() -> bytes:
    import io

    from PIL import Image

    out = io.BytesIO()
    Image.new("RGB", (64, 48), (120, 140, 90)).save(out, format="JPEG")
    return out.getvalue()


def _no_voice():
    raise ImportError("no voice while generating the contract")


def _stable(value):
    """Times and file names that change on every run, made fixed for the file."""
    if isinstance(value, dict):
        out = {k: _stable(v) for k, v in value.items()}
        if "at" in out:
            out["at"] = "2026-10-20T18:02:00+05:30"
        if "stored_as" in out:
            out["stored_as"] = ".outbox/photos/3f9c2a/5b2e.jpg"
        return out
    if isinstance(value, list):
        return [_stable(v) for v in value]
    return value


def _fires_down(lat: float, lon: float, radius_km: float) -> FiresNear:
    from agent_kisan.fires import FiresUnavailable

    raise FiresUnavailable("fire data unavailable (ConnectError)")


def _live_examples() -> tuple[dict, dict]:
    """Call every JSON route on the demo story, and each route's errors with real bad requests.

    Returns (200 examples by (path, method), error examples by (path, method, status)).
    """
    import os
    import tempfile

    hooks = ("today", "fire_source", "chat_factory", "transcriber_factory", "notifier_factory", "speaker_factory",
             "machine_identifier")
    saved = {h: getattr(api, h) for h in hooks}
    saved_env = {k: os.environ.get(k) for k in ("KISAN_SERVICE_TOKEN", "KISAN_PHOTOS")}
    api.today, api.fire_source = (lambda: TODAY), _demo_fires
    api.chat_factory, api.transcriber_factory, api.notifier_factory = _ScriptedChat, _Transcriber, _Sms
    api.speaker_factory = _no_voice
    api.machine_identifier = lambda jpeg: {"machine": "super_seeder", "confidence": 0.86,
                                           "why": "A rotor in front of the seed drill, behind a tractor."}
    _ScriptedChat.ids = iter(["3f9c2a", "7d41b0", "c09e55"])
    token, k = "contract-example", KISAN
    photos = tempfile.TemporaryDirectory()
    os.environ.update(KISAN_SERVICE_TOKEN=token, KISAN_PHOTOS=photos.name)
    try:
        client = TestClient(api.app)
        said = REQUEST_EXAMPLES[(f"{k}/messages", "post")]
        first = client.post(f"{k}/messages", json=said)
        sid = first.json()["session_id"]
        client.post(f"{k}/messages", json={"session_id": sid, "text": "ਹਾਂ ਜੀ"})
        calls = {
            ("/v1/farm/coverage", "post"): client.post("/v1/farm/coverage", json=GURPREET_COVERAGE),
            ("/v1/farm/plan", "post"): client.post("/v1/farm/plan", json=GURPREET_PLAN),
            ("/v1/chcs", "get"): client.get("/v1/chcs", params={"village": "Bhawanigarh"}),
            ("/v1/farm/fires", "get"): client.get("/v1/farm/fires", params={"lat": 30.266, "lon": 76.04}),
            ("/v1/allocations", "post"): client.post("/v1/allocations",
                                                     json=REQUEST_EXAMPLES[("/v1/allocations", "post")]),
            (f"{k}/messages", "post"): first,
            (f"{k}/help-requests/{{help_request_id}}/status", "post"): client.post(
                f"{k}/help-requests/kisan-{sid}/status", headers={"X-Saans-Service-Token": token},
                json=REQUEST_EXAMPLES[(f"{k}/help-requests/{{help_request_id}}/status", "post")]),
            (f"{k}/sessions/{{session_id}}/status", "get"): client.get(f"{k}/sessions/{sid}/status"),
            (f"{k}/voice", "post"): client.post(f"{k}/voice", data={"language": "pa"},
                                                files={"audio": ("note.m4a", b"audio", "audio/mp4")}),
            (f"{k}/photo", "post"): client.post(f"{k}/photo", data={"session_id": sid},
                                                files={"photo": ("farm.jpg", _photo(), "image/jpeg")}),
        }
        status_url = f"{k}/help-requests/{{help_request_id}}/status"
        bad = {
            ("/v1/farm/coverage", "post", "422"): client.post(
                "/v1/farm/coverage", json={**GURPREET_COVERAGE, "paddy": {"value": -1, "unit": "killa"}}),
            ("/v1/farm/plan", "post", "422"): client.post(
                "/v1/farm/plan", json={key: v for key, v in GURPREET_PLAN.items() if key != "harvest_date"}),
            ("/v1/chcs", "get", "422"): client.get("/v1/chcs", params={"village": "Nowhere"}),
            ("/v1/farm/fires", "get", "422"): client.get("/v1/farm/fires",
                                                         params={"lat": 30.266, "lon": 76.04, "radius_km": 40}),
            ("/v1/allocations", "post", "422"): client.post("/v1/allocations", json={"machineAssets": []}),
            (status_url, "post", "401"): client.post(f"{k}/help-requests/kisan-{sid}/status", json={"status": "seen"}),
            (status_url, "post", "404"): client.post(f"{k}/help-requests/kisan-nope/status", json={"status": "seen"},
                                                     headers={"X-Saans-Service-Token": token}),
            (status_url, "post", "422"): client.post(f"{k}/help-requests/kisan-{sid}/status", json={"status": "lost"},
                                                     headers={"X-Saans-Service-Token": token}),
            (f"{k}/sessions/{{session_id}}/status", "get", "404"): client.get(f"{k}/sessions/nope/status"),
            (f"{k}/messages", "post", "404"): client.post(f"{k}/messages", json={"session_id": "nope", "text": "ਹਾਂ"}),
            (f"{k}/messages", "post", "422"): client.post(f"{k}/messages", json={"text": ""}),
            (f"{k}/sessions/{{session_id}}/readback.wav", "get", "404"): client.get(f"{k}/sessions/nope/readback.wav"),
            (f"{k}/photo", "post", "404"): client.post(f"{k}/photo", data={"session_id": "nope"},
                                                     files={"photo": ("farm.jpg", _photo(), "image/jpeg")}),
            (f"{k}/photo", "post", "422"): client.post(f"{k}/photo", files={"photo": ("farm.jpg", b"", "image/jpeg")}),
            (f"{k}/voice", "post", "404"): client.post(f"{k}/voice", data={"session_id": "nope"},
                                                     files={"audio": ("note.m4a", b"audio", "audio/mp4")}),
            (f"{k}/voice", "post", "422"): client.post(f"{k}/voice", files={"audio": ("note.m4a", b"", "audio/mp4")}),
        }
        del os.environ["KISAN_SERVICE_TOKEN"]  # status updates switched off
        bad[(status_url, "post", "503")] = client.post(f"{k}/help-requests/kisan-{sid}/status",
                                                       json={"status": "seen"}, headers={"X-Saans-Service-Token": token})
        api.fire_source = _fires_down  # P3's /v1/fires not answering
        bad[("/v1/farm/fires", "get", "503")] = client.get("/v1/farm/fires", params={"lat": 30.266, "lon": 76.04})
    finally:
        for h, v in saved.items():
            setattr(api, h, v)
        for name, v in saved_env.items():
            os.environ.pop(name, None) if v is None else os.environ.__setitem__(name, v)
        for s in ("3f9c2a", "7d41b0", "c09e55"):
            api._chats.pop(s, None)
            api._locks.pop(s, None)
        photos.cleanup()
    for key, res in bad.items():
        if res.status_code != int(key[2]):
            raise RuntimeError(f"{key[1].upper()} {key[0]}: expected {key[2]}, got {res.status_code}: {res.text}")
    for (path, method), res in calls.items():
        if res.status_code != 200:
            raise RuntimeError(f"{method.upper()} {path} answered {res.status_code}: {res.text}")
    errors = {key: res.json() for key, res in bad.items()}
    errors.update({key: api.error_body(int(key[2]), message) for key, message in HAND_ERRORS.items()})
    return {key: _stable(res.json()) for key, res in calls.items()}, errors


def _complaint_example() -> dict:
    from agent_kisan.contract_fixtures import _FIRES, _GURPREET, _SAID
    from agent_kisan.filing import to_complaint
    from agent_kisan.session import KisanSession

    class Keep:
        def file(self, request):
            return {}

    s = KisanSession(filer=Keep(), session_id="3f9c2a", weather=None, today=lambda: TODAY,
                     rain_dates={date(2026, 10, 27), date(2026, 10, 28)}, fire_source=lambda *a: _FIRES)
    s.begin_turn(_SAID.format(d=2))
    s.update(**_GURPREET)
    s.fires_near()
    s.prepare_readback()
    s.begin_turn("haan")
    s.file_report()
    complaint = to_complaint(s.filed["request"])
    complaint["support_request"]["created_at"] = "2026-10-20T18:02:00+05:30"  # stable in the file
    return complaint


def build() -> dict:
    from agent_kisan.schemas import FarmerSupportComplaint

    spec = copy.deepcopy(api.app.openapi())
    spec["info"].update(
        license={"name": "MIT", "identifier": "MIT"},
        description="Kisan Saathi (P1). Proposal for packages/contracts/openapi.yaml, generated by "
                    "`uv run python -m agent_kisan.contract` in services/agent-kisan.",
    )
    spec["servers"] = [{"url": "http://localhost:8010", "description": "Kisan Saathi on a laptop"}]
    spec["security"] = []

    examples, errors = _live_examples()
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            if (path, method) in REQUEST_EXAMPLES:
                media = op["requestBody"]["content"]["application/json"]
                media["example"] = REQUEST_EXAMPLES[(path, method)]
            if (path, method) in NO_422:
                del op["responses"]["422"]
            for code, response in op["responses"].items():
                media = response.get("content", {}).get("application/json")
                if media is None:
                    continue
                if code == "200":
                    if (path, method) not in examples:
                        raise RuntimeError(f"no example for {method.upper()} {path}")
                    media["example"] = examples[(path, method)]
                else:
                    media["schema"] = {"$ref": P4_ERROR}
                    if (path, method, code) not in errors:
                        raise RuntimeError(f"no example for {method.upper()} {path} {code}")
                    media["example"] = errors[(path, method, code)]
    for name in ("ErrorEnvelope", "ErrorBody", "ErrorDetail", "HTTPValidationError", "ValidationError"):
        spec["components"]["schemas"].pop(name, None)  # P4's ErrorEnvelope replaces them

    _, defs = models_json_schema([(FarmerSupportComplaint, "validation")], ref_template="#/components/schemas/{model}")
    schemas = spec["components"]["schemas"]
    for name, schema in defs["$defs"].items():
        schemas.setdefault(name, schema)
    schemas["FarmerSupportComplaint"]["examples"] = [_complaint_example()]
    schemas["FarmerSupportComplaint"]["description"] = (
        "What Kisan sends to Saans Command's POST /v1/complaints (with an Idempotency-Key header equal to "
        "support_request.idempotency_key): ComplaintInput with type farmer_support, plus the plan.")
    return spec


def render() -> str:
    return json.dumps(build(), indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    PROPOSAL.write_text(render(), encoding="utf-8")
    print(f"wrote {PROPOSAL}")
