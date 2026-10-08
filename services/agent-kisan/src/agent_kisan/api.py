"""HTTP API for Kisan Saathi. The shape here is P1's proposal for packages/contracts."""

import math
import threading
from collections.abc import Callable
from datetime import date, timedelta
from typing import Literal, Self

import httpx
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, model_validator

from agent_kisan.coverage import (
    CAPACITY_ACRES_PER_DAY,
    DECOMPOSER_MIN_WINDOW_DAYS,
    PM25_G_PER_KG_STRAW,
    STRAW_T_PER_ACRE,
    estimate_coverage,
)
from agent_kisan.agent import KisanChat
from agent_kisan.planner import DEFAULT_MAX_KM, find_chcs, plan_zero_burn
from agent_kisan.seed import load_seed
from agent_kisan.units import to_acres
from agent_kisan.weather import rain_forecast

MachineType = Literal["happy_seeder", "super_seeder", "mulcher_rmb", "baler"]

app = FastAPI(title="Kisan Saathi", version="0.1.0")


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


@app.get("/healthz")
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
    plan: list[dict]
    booked_acres: float
    cost_inr: int
    coverage_after_pct: int
    unmet: list[dict]
    chcs_considered: list[str]
    rain_dates_used: list[date]
    rain_note: str | None = None
    demo_data: bool = Field(description="True while CHCs, rates and bookings are made-up demo data")


@app.post("/v1/farm/plan")
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


@app.get("/v1/chcs")
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


# ---- the agent ----

class MessageRequest(BaseModel):
    session_id: str | None = Field(default=None, description="Omit to start a new conversation")
    text: str = Field(min_length=1, max_length=2000)
    language: Literal["pa", "hi", "en"] = "pa"


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


def _response(sid: str, chat: KisanChat, reply: str, transcript: dict | None = None) -> MessageResponse:
    return MessageResponse(
        session_id=sid, reply=reply, missing=chat.session.profile.missing(),
        quick_replies=[QuickReply(**q) for q in chat.session.unsure()], filed=chat.session.filed is not None,
        transcript=transcript,
    )


@app.post("/v1/agent/kisan/messages")
def kisan_message(req: MessageRequest) -> MessageResponse:
    sid, chat = _chat_for(req.session_id, req.language)
    return _response(sid, chat, _one_at_a_time(sid, lambda: chat.send(req.text)))


@app.post("/v1/agent/kisan/voice")
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
    if not transcript.text:
        raise HTTPException(status_code=422, detail="no speech found in the voice note; please record it again")
    return _response(sid, chat, reply, transcript.to_json())
