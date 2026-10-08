"""HTTP API for Kisan Saathi. The shape here is P1's proposal for packages/contracts."""

import logging
import math
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from collections.abc import Callable
from datetime import date, timedelta
from typing import Literal, Self

import httpx
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel, Field, model_validator

from agent_kisan.coverage import (
    CAPACITY_ACRES_PER_DAY,
    DECOMPOSER_MIN_WINDOW_DAYS,
    PM25_G_PER_KG_STRAW,
    STRAW_T_PER_ACRE,
    estimate_coverage,
)
from agent_kisan.agent import KisanChat
from agent_kisan.fires import DEFAULT_RADIUS_KM, MAX_RADIUS_KM, FireSource, FiresUnavailable, default_fires
from agent_kisan.planner import DEFAULT_MAX_KM, find_chcs, plan_zero_burn
from agent_kisan.schemas import (
    AllocationResponse,
    Booking,
    ChcsResponse,
    ErrorEnvelope,
    FiresNearResponse,
    HelpRequestStatusResponse,
    KisanStatusResponse,
    PhotoResponse,
    Unmet,
)
from agent_kisan.seed import load_seed
from agent_kisan.units import to_acres
from agent_kisan.weather import rain_forecast

MachineType = Literal["happy_seeder", "super_seeder", "mulcher_rmb", "baler"]

# Operation ids are the function names, so generated clients read kisan_message(), not kisan_message_v1_….
app = FastAPI(title="Kisan Saathi", version="1.0.0", generate_unique_id_function=lambda route: route.name)


# ---- errors: every reply that isn't a success is P4's ErrorEnvelope ----

ERROR_CODES = {400: "invalid_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict",
               413: "payload_too_large", 422: "invalid_request", 503: "unavailable"}


def _errors(*codes: int) -> dict:
    """OpenAPI entries for the HTTPExceptions a route raises."""
    return {code: {"model": ErrorEnvelope} for code in codes}


def error_body(status: int, message: str, details: list[dict] | None = None) -> dict:
    body = {"code": ERROR_CODES.get(status, "invalid_request" if status < 500 else "unavailable"), "message": message}
    return {"error": {**body, **({"details": details} if details else {})}}


@app.exception_handler(StarletteHTTPException)
async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(error_body(exc.status_code, str(exc.detail)), status_code=exc.status_code,
                        headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = [{"field": ".".join(str(part) for part in e["loc"]), "problem": e["msg"]} for e in exc.errors()]
    first = details[0] if details else {"field": "request", "problem": "doesn't match the contract"}
    message = first["problem"] if first["field"] == "body" else f"{first['field']}: {first['problem']}"
    return JSONResponse(error_body(422, message, details), status_code=422)


class Paddy(BaseModel):
    value: float = Field(ge=0, examples=[18])
    unit: Literal["acre", "killa", "hectare", "bigha"] = "acre"
    state: str | None = Field(default=None, description="Needed for bigha, whose size differs by state")


class Machine(BaseModel):
    type: MachineType
    days: float = Field(ge=0, description="Days the farmer can use it")


class CoverageRequest(BaseModel):
    paddy: Paddy
    window_days: float | None = Field(default=None, ge=0, description="Days from harvest to the wheat deadline")
    harvest_date: date | None = None
    wheat_deadline: date | None = None
    machines: list[Machine] = []
    tractors: int = Field(default=1, ge=0)
    rain_days: float = Field(default=0, ge=0)
    decomposer_acres: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _window_and_machines(self) -> Self:
        if self.window_days is None:
            if self.harvest_date is None or self.wheat_deadline is None:
                raise ValueError("give window_days, or both harvest_date and wheat_deadline")
            if self.wheat_deadline < self.harvest_date:
                raise ValueError("wheat_deadline is before harvest_date")
        types = [m.type for m in self.machines]
        if len(types) != len(set(types)):
            raise ValueError("list each machine type once")
        return self

    def window(self) -> float:
        if self.window_days is not None:
            return self.window_days
        return (self.wheat_deadline - self.harvest_date).days


class TractorDays(BaseModel):
    available: float
    used: float


class Assumptions(BaseModel):
    capacity_acres_per_day: dict[str, float]
    decomposer_min_window_days: int
    straw_t_per_acre: float
    pm25_g_per_kg_straw: float


class CoverageResponse(BaseModel):
    paddy_acres: float
    covered_acres: float
    gap_acres: float
    coverage: float = Field(description="0 to 1")
    coverage_pct: int
    straw_t: float
    pm25_kg: float
    window_days: float
    work_days: float
    tractor_days: TractorDays
    machine_days_used: dict[str, float]
    assumptions: Assumptions


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/healthz", include_in_schema=False)  # for the load balancer, not part of the contract
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/farm/coverage")
def farm_coverage(req: CoverageRequest) -> CoverageResponse:
    try:
        paddy_acres = to_acres(req.paddy.value, req.paddy.unit, req.paddy.state)
        window = req.window()
        r = estimate_coverage(
            paddy_acres,
            window,
            {m.type: m.days for m in req.machines},
            tractors=req.tractors,
            rain_days=req.rain_days,
            decomposer_acres=req.decomposer_acres,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    return CoverageResponse(
        paddy_acres=_r(r.paddy_acres),
        covered_acres=_r(r.covered_acres),
        gap_acres=_r(r.gap_acres),
        coverage=round(r.coverage, 4),
        coverage_pct=r.coverage_pct,
        straw_t=_r(r.straw_t),
        pm25_kg=_r(r.pm25_kg),
        window_days=window,
        work_days=r.work_days,
        tractor_days=TractorDays(available=r.tractor_days_available, used=_r(r.tractor_days_used)),
        machine_days_used={m: _r(d) for m, d in r.machine_days_used.items()},
        assumptions=Assumptions(
            capacity_acres_per_day=CAPACITY_ACRES_PER_DAY,
            decomposer_min_window_days=DECOMPOSER_MIN_WINDOW_DAYS,
            straw_t_per_acre=STRAW_T_PER_ACRE,
            pm25_g_per_kg_straw=PM25_G_PER_KG_STRAW,
        ),
    )


def _r(x: float) -> float:
    return round(x, 2)


# ---- zero-burn plan ----

today: Callable[[], date] = date.today  # tests pin this

class PlanRequest(CoverageRequest):
    harvest_date: date
    wheat_deadline: date
    village: str | None = None
    district: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    rain_dates: list[date] | None = Field(
        default=None, description="Rain days, when machines can't run. Omit to use the Open-Meteo forecast for the farm",
    )
    max_km: float = Field(default=DEFAULT_MAX_KM, gt=0, le=100)

    @model_validator(mode="after")
    def _dates_set_the_window(self) -> Self:
        if self.window_days is not None:
            raise ValueError("the plan uses harvest_date and wheat_deadline; leave window_days out")
        return self


class PlanResponse(BaseModel):
    coverage: CoverageResponse
    plan: list[Booking]
    booked_acres: float
    cost_inr: int
    coverage_after_pct: int
    unmet: list[Unmet]
    chcs_considered: list[str]
    rain_dates_used: list[date]
    rain_note: str | None = None
    demo_data: bool = Field(description="True while CHCs, rates and bookings are made-up demo data")


@app.post("/v1/farm/plan", responses=_errors(503))
def farm_plan(req: PlanRequest) -> PlanResponse:
    try:
        chcs, villages, demo = load_seed()
    except (OSError, KeyError, ValueError) as e:
        raise HTTPException(status_code=503, detail=f"CHC data unavailable: {e}") from e
    location = (req.lat, req.lon) if req.lat is not None and req.lon is not None else \
        villages.get((req.village or "").strip().lower())
    if location is None and not req.district:
        raise HTTPException(status_code=422, detail="give lat and lon, a known village, or a district")

    window = {req.harvest_date + timedelta(d) for d in range(req.window())}
    rain_note = None
    if req.rain_dates is not None:
        rain = set(req.rain_dates) & window
    elif location is None:
        rain, rain_note = set(), "farm location unknown, so no rain forecast; days are assumed dry"
    else:
        try:
            forecast = rain_forecast(*location)
            rain = set(forecast.rain_dates) & window
            rain_note = forecast.to_json((req.harvest_date, req.wheat_deadline)).get("note")
        except (httpx.HTTPError, KeyError, ValueError) as e:
            rain, rain_note = set(), f"rain forecast unavailable ({type(e).__name__}); days are assumed dry"

    coverage = farm_coverage(req.model_copy(update={"rain_days": len(rain)}))
    plan = plan_zero_burn(
        coverage.gap_acres, req.harvest_date, req.wheat_deadline, chcs,
        rain_dates=rain, farm_location=location, district=req.district, max_km=req.max_km, today=today(),
    ).to_json()
    paddy = coverage.paddy_acres
    after = (coverage.covered_acres + plan["booked_acres"]) / paddy if paddy else 0.0
    return PlanResponse(coverage=coverage, coverage_after_pct=math.floor(after * 100 + 0.5), demo_data=demo,
                        rain_dates_used=sorted(rain), rain_note=rain_note, **plan)


@app.get("/v1/chcs", response_model=ChcsResponse, responses=_errors(503))
def chcs_near(lat: float | None = None, lon: float | None = None, village: str | None = None,
              district: str | None = None, machine: str | None = None, max_km: float = DEFAULT_MAX_KM) -> dict:
    """CHCs within reach of a farm, nearest first (demo data until the KVK list comes in)."""
    if machine is not None and machine not in CAPACITY_ACRES_PER_DAY:
        raise HTTPException(status_code=422, detail=f"unknown machine; known: {', '.join(CAPACITY_ACRES_PER_DAY)}")
    try:
        chcs, villages, demo = load_seed()
    except (OSError, KeyError, ValueError) as e:
        raise HTTPException(status_code=503, detail=f"CHC data unavailable: {e}") from e
    location = (lat, lon) if lat is not None and lon is not None else villages.get((village or "").strip().lower())
    if location is None and not district:
        raise HTTPException(status_code=422, detail="give lat and lon, a known village, or a district")
    found = find_chcs(chcs, farm_location=location, district=district, machine=machine, max_km=max_km)
    return {"chcs": found, "demo_data": demo}


fire_source: FireSource | None = None  # tests swap in a fake; None = P3's /v1/fires at SAANS_AQI_URL


@app.get("/v1/farm/fires", response_model=FiresNearResponse, responses=_errors(503))
def farm_fires(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180),
               radius_km: float = Query(default=DEFAULT_RADIUS_KM, gt=0, le=MAX_RADIUS_KM)) -> dict:
    """Satellite fire points around a farm in the last day, nearest first (NASA FIRMS through P3's /v1/fires)."""
    try:
        return (fire_source or default_fires)(lat, lon, radius_km).to_json(limit=50)
    except FiresUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


# ---- request status and SMS (Command reports progress) ----

_Date = date  # a field below is called "date", which would hide the type inside the class


class StatusUpdate(BaseModel):
    status: Literal["seen", "machine_assigned", "in_field", "action_taken", "closed"]
    machineType: str | None = Field(default=None, description="Command's display name, e.g. Happy Seeder")
    chcName: str | None = None
    chcPhone: str | None = None
    date: _Date | None = None
    note: str | None = Field(default=None, max_length=300)


def _session_for_help_request(help_request_id: str) -> KisanChat:
    chat = _chats.get(help_request_id.removeprefix("kisan-"))
    if chat is None or chat.session.filed is None:
        raise HTTPException(status_code=404, detail="no filed Kisan request with that id")
    return chat


@app.post("/v1/agent/kisan/help-requests/{help_request_id}/status", response_model=HelpRequestStatusResponse,
          responses=_errors(401, 404, 503))
def help_request_status(help_request_id: str, update: StatusUpdate,
                        x_saans_service_token: str | None = Header(default=None)) -> dict:
    """For Saans Command: progress on a help request. Texts the farmer when a machine is assigned or the
    work is done. Needs the X-Saans-Service-Token header to match KISAN_SERVICE_TOKEN."""
    import hmac
    import os

    expected = os.environ.get("KISAN_SERVICE_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="status updates are off: KISAN_SERVICE_TOKEN is not set")
    if not x_saans_service_token or not hmac.compare_digest(x_saans_service_token, expected):
        raise HTTPException(status_code=401, detail="wrong or missing X-Saans-Service-Token")
    from agent_kisan.guard import _MACHINES, _MONTHS
    from agent_kisan.help_request import MACHINE_NAMES

    chat = _session_for_help_request(help_request_id)
    s = chat.session
    lang = s.language if s.language in _MACHINES else "en"
    machine_key = {v: k for k, v in MACHINE_NAMES.items()}.get(update.machineType or "")
    machine = _MACHINES[lang].get(machine_key, update.machineType) if update.machineType else None
    when = f"{update.date.day} {_MONTHS[lang][update.date.month - 1]}" if update.date else None
    entry = s.status.record(update.status, s.language, s.farmer_phone, _notifier(), machine=machine,
                            chc=update.chcName, chc_phone=update.chcPhone, date=when, note=update.note)
    return {"helpRequestId": help_request_id, "recorded": entry}


@app.get("/v1/agent/kisan/sessions/{session_id}/status", response_model=KisanStatusResponse, responses=_errors(404))
def kisan_status(session_id: str) -> dict:
    """The farmer's status page: filed, seen, machine assigned, done."""
    chat = _chats.get(session_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="unknown session_id")
    s = chat.session
    return {"helpRequestId": f"kisan-{session_id}" if s.filed else None, "current": s.status.current,
            "history": s.status.history}


# ---- district allocator (for Saans Command) ----

class AllocationRequest(BaseModel):
    helpRequests: list[dict] = Field(description="Command's HelpRequest objects; only OPEN ones are allocated")
    machineAssets: list[dict] = Field(description="Command's MachineAsset objects; only AVAILABLE ones are used")
    maxKm: float = Field(default=25, gt=0, le=100)
    rainDates: list[date] = []
    today: date | None = Field(default=None, description="Days before it aren't booked; defaults to today")


@app.post("/v1/allocations", response_model=AllocationResponse)
def allocations(req: AllocationRequest) -> dict:
    """Suggested machine for each open help request: earliest wheat deadline first, nearest machine first."""
    from agent_kisan.allocator import allocate

    try:
        return allocate(req.helpRequests, req.machineAssets, max_km=req.maxKm, rain_dates=req.rainDates,
                        today=req.today or today())
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"help requests or machine assets are missing a field: {e}") from e


# ---- the agent ----

class MessageRequest(BaseModel):
    session_id: str | None = Field(default=None, description="Omit to start a new conversation")
    text: str = Field(min_length=1, max_length=2000)
    language: Literal["pa", "hi", "en"] = "pa"
    farmer_phone: str | None = Field(default=None, description="+91 mobile from sign-in, for SMS updates",
                                     pattern=r"^\+91[6-9]\d{9}$")


class QuickReply(BaseModel):
    slot: str
    value: float | str
    label: str
    send_text: str = Field(description="Send this as the next message's text when the farmer taps the button")


class MessageResponse(BaseModel):
    session_id: str
    reply: str
    missing: list[str]
    quick_replies: list[QuickReply] = Field(description="Numbers the farmer hasn't said yet, to confirm by tapping")
    filed: bool
    transcript: dict | None = Field(default=None, description="For voice notes: what speech recognition heard")
    readback: dict | None = Field(default=None, description="When the agent reads the details back: a card for "
                                  "the screen, the spoken script, and audio_url to play it")


# In memory, so one App Runner instance holds every conversation. Move to DynamoDB before scaling out.
_chats: dict[str, KisanChat] = {}
_locks: dict[str, threading.Lock] = {}
chat_factory: Callable[[str], KisanChat] = lambda language: KisanChat(language=language)
transcriber_factory: Callable[[], object] | None = None  # tests swap in a fake; None = KISAN_ASR_BACKEND
MAX_AUDIO_BYTES = 10 * 1024 * 1024


def _chat_for(session_id: str | None, language: str) -> tuple[str, KisanChat]:
    if session_id is None:
        chat = chat_factory(language)
        sid = chat.session.session_id
        _chats[sid], _locks[sid] = chat, threading.Lock()
        return sid, chat
    if session_id in _chats:
        return session_id, _chats[session_id]
    raise HTTPException(status_code=404, detail="unknown session_id; omit it to start a new conversation")


def _one_at_a_time(sid: str, turn: Callable):
    if not _locks[sid].acquire(blocking=False):
        raise HTTPException(status_code=409, detail="still answering the previous message in this conversation")
    try:
        return turn()
    except (ClientError, BotoCoreError) as e:
        raise HTTPException(status_code=503, detail=f"the language model is unavailable: {e}") from e
    finally:
        _locks[sid].release()


# Read-backs are spoken in the background as soon as they exist, so the audio is usually ready
# (or nearly) by the time the farmer taps play. One worker: the voices run one at a time anyway.
_speaking = ThreadPoolExecutor(max_workers=1, thread_name_prefix="readback-voice")
_prewarmed: dict[str, Future] = {}
log = logging.getLogger("agent_kisan")


def _speaker():
    from agent_kisan.tts import default_speaker

    return speaker_factory() if speaker_factory else default_speaker()


def _prewarm(sid: str, sentences: list[str], language: str) -> None:
    def speak():
        try:
            _speaker().speak(sentences, language)
        except Exception as e:  # never break the conversation over audio; the GET reports the error
            log.warning("read-back audio for %s not prepared: %s", sid, e)

    _prewarmed[sid] = _speaking.submit(speak)


def _response(sid: str, chat: KisanChat, reply: str, transcript: dict | None = None) -> MessageResponse:
    s = chat.session
    rb = s.current_readback() if s.readback_turn == s.turn and s.filed is None else None
    if rb is not None and rb.sentences:
        _prewarm(sid, rb.sentences, s.language)
    return MessageResponse(
        session_id=sid, reply=reply, missing=s.profile.missing(),
        quick_replies=[QuickReply(**q) for q in s.unsure()], filed=s.filed is not None, transcript=transcript,
        readback=None if rb is None else {
            "card": rb.card, "text": rb.text,
            "audio_url": f"/v1/agent/kisan/sessions/{sid}/readback.wav" if rb.sentences else None},
    )


notifier_factory: Callable[[], object] | None = None  # tests swap in a fake; None = KISAN_SMS


def _notifier():
    from agent_kisan.notify import default_notifier

    return notifier_factory() if notifier_factory else default_notifier()


def _after_turn(chat: KisanChat) -> None:
    """Once a request is filed, start its status history and text the farmer that it arrived."""
    s = chat.session
    if s.filed is not None and s.status.current is None:
        short = sum(u["acres"] for u in s.filed["request"]["unmet"])
        s.status.record("filed", s.language, s.farmer_phone, _notifier(), acres=f"{short:g}")


@app.post("/v1/agent/kisan/messages", responses=_errors(404, 409, 503))
def kisan_message(req: MessageRequest) -> MessageResponse:
    sid, chat = _chat_for(req.session_id, req.language)
    if req.farmer_phone:
        chat.session.farmer_phone = req.farmer_phone
    reply = _one_at_a_time(sid, lambda: chat.send(req.text))
    _after_turn(chat)
    return _response(sid, chat, reply)


speaker_factory: Callable[[], object] | None = None  # tests swap in a fake; None = MMS voices


@app.get("/v1/agent/kisan/sessions/{session_id}/readback.wav", response_class=Response,
         responses={200: {"content": {"audio/wav": {"schema": {"type": "string", "format": "binary"}}},
                          "description": "The read-back, spoken"}, **_errors(404, 503)})
def kisan_readback_audio(session_id: str) -> Response:
    """The current read-back spoken aloud (Punjabi or Hindi). Cached, so replays are instant."""
    chat = _chats.get(session_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="unknown session_id")
    rb = chat.session.current_readback()
    if rb is None:
        raise HTTPException(status_code=404, detail="no current read-back; the details changed or none was made yet")
    if not rb.sentences:
        raise HTTPException(status_code=404, detail="read-backs are spoken in Punjabi and Hindi only")
    try:
        # If the background job is still speaking this read-back, speak() waits for it and then
        # finds the audio in the cache, so it is never made twice.
        audio = _speaker().speak(rb.sentences, chat.session.language)
    except ImportError as e:  # the voices need PyTorch, which only images built with them have
        raise HTTPException(status_code=503, detail=f"spoken read-backs aren't set up here: {e}") from e
    return Response(audio, media_type="audio/wav", headers={"Cache-Control": "private, max-age=600"})


MAX_PHOTO_BYTES = 15 * 1024 * 1024
machine_identifier: Callable[[bytes], dict] | None = None  # tests swap in a fake; None = Claude on Bedrock


@app.post("/v1/agent/kisan/photo", response_model=PhotoResponse, responses=_errors(404, 413))
def kisan_photo(
    photo: UploadFile,
    session_id: str | None = Form(default=None),
    identify: bool = Form(default=True),
) -> dict:
    """A farm photo: where and when it was taken, a stored copy with faces blurred and no metadata,
    and which machine it shows. If the farm has no location yet, the photo's GPS becomes it."""
    import os
    import uuid
    from pathlib import Path

    from agent_kisan.photo import identify_machine, intake

    data = photo.file.read(MAX_PHOTO_BYTES + 1)
    if not data:
        raise HTTPException(status_code=422, detail="the photo is empty")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="photos can be up to 15 MB")
    try:
        cleaned, info = intake(data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    folder = Path(os.environ.get("KISAN_PHOTOS", ".outbox/photos")) / (session_id or "no-session")
    folder.mkdir(parents=True, exist_ok=True)
    stored = folder / f"{uuid.uuid4().hex}.jpg"
    stored.write_bytes(cleaned)  # only the cleaned copy is ever kept

    location = None
    if session_id is not None:
        chat = _chats.get(session_id)
        if chat is None:
            raise HTTPException(status_code=404, detail="unknown session_id")
        p = chat.session.profile
        if info.lat is not None and p.lat is None:
            p.lat, p.lon = info.lat, info.lon
            location = "used the photo's GPS as the farm location; the farmer can correct it"

    machine = None
    if identify:
        try:
            machine = (machine_identifier or identify_machine)(cleaned)
        except (ClientError, BotoCoreError, ImportError, ValueError, KeyError) as e:
            machine = {"error": f"machine recognition unavailable: {e}"}
    return {"photo": info.to_json(), "stored_as": str(stored), "location": location, "machine": machine}


@app.post("/v1/agent/kisan/voice", responses=_errors(404, 409, 413, 422, 503))
def kisan_voice(
    audio: UploadFile,
    session_id: str | None = Form(default=None),
    language: Literal["pa", "hi", "en"] = Form(default="pa"),
) -> MessageResponse:
    """A voice note (m4a, wav, ogg, mp3...). The reply includes the transcript so the app can show what was heard."""
    data = audio.file.read(MAX_AUDIO_BYTES + 1)
    if not data:
        raise HTTPException(status_code=422, detail="the voice note is empty")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="voice notes can be up to 10 MB")
    try:
        from agent_kisan.transcribe import default_transcriber

        transcriber = transcriber_factory() if transcriber_factory else default_transcriber()
    except (ImportError, KeyError, ValueError) as e:
        raise HTTPException(status_code=503, detail=f"speech recognition isn't set up here: {e}") from e

    sid, chat = _chat_for(session_id, language)
    try:
        reply, transcript = _one_at_a_time(sid, lambda: chat.send_voice(data, transcriber))
    except ImportError as e:  # local Whisper is a dev-only dependency
        raise HTTPException(status_code=503, detail=f"speech recognition isn't set up here: {e}") from e
    _after_turn(chat)
    if not transcript.text:
        raise HTTPException(status_code=422, detail="no speech found in the voice note; please record it again")
    return _response(sid, chat, reply, transcript.to_json())
