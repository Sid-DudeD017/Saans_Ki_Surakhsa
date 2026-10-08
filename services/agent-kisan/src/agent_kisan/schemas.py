"""Kisan Saathi's side of the shared contract, as Pydantic models.

The response models are attached to the API's routes, so every reply is checked against the
contract. FarmerSupportComplaint is what Kisan sends to Saans Command's POST /v1/complaints:
P4's ComplaintInput (type, location, evidence) with the farm's plan and what is still unmet.

Conventions (packages/contracts/CONVENTIONS.md): lat and lon, codes in lowercase except Command's
own status values, timestamps in ISO 8601 with +05:30.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MachineCode = Literal["happy_seeder", "super_seeder", "mulcher_rmb", "baler"]
MachineName = Literal["Happy Seeder", "Super Seeder", "Mulcher + RMB Plough", "Baler", "Any"]
IndiaTime = str  # "2026-10-20T10:42:00+05:30"
IST = timezone(timedelta(hours=5, minutes=30))


def india_now() -> IndiaTime:
    return datetime.now(IST).isoformat(timespec="seconds")


# ---- errors: the one shape every Saans service uses (P4's ErrorEnvelope) ----

ErrorCode = Literal["invalid_request", "unauthorized", "forbidden", "not_found", "no_coverage", "conflict",
                    "idempotency_conflict", "version_conflict", "payload_too_large", "unavailable",
                    "sources_unavailable"]


class ErrorDetail(BaseModel):
    field: str = Field(description="Where, as a dotted path (body.paddy.value, query.lat)")
    problem: str


class ErrorBody(BaseModel):
    code: ErrorCode
    message: str = Field(description="A sentence the app can show")
    details: list[ErrorDetail] | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorBody


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


# ---- the zero-burn plan ----

class Booking(BaseModel):
    """A suggested CHC booking for one day; the CHC or the officer confirms it."""
    date: date
    machine: MachineCode
    chc_id: str
    chc_name: str
    distance_km: float | None
    acres: float
    cost_inr: int = Field(description="After subsidy")


class Unmet(BaseModel):
    """What the plan couldn't book: this is what the department is asked for."""
    machine: MachineCode | None = Field(description="None when the planner couldn't run and the whole gap is unmet")
    days: float | None
    acres: float
    latest_date: date = Field(description="The wheat deadline: the work must be done before it")


# ---- CHCs and fires ----

class ChcMachine(BaseModel):
    machine: MachineCode
    units: int
    cost_per_acre_inr: int = Field(description="After subsidy")
    free_days: int | None = Field(default=None, description="Dry, unbooked days in the window, when it is known")
    first_free: date | None = None


class Chc(BaseModel):
    chc_id: str
    name: str
    village: str
    phone: str
    distance_km: float | None = Field(description="None when matched by district only")
    machines: list[ChcMachine]


class ChcsResponse(BaseModel):
    chcs: list[Chc] = Field(description="Nearest first")
    demo_data: bool = Field(description="True while CHCs, rates and bookings are made-up demo data")


class Fire(BaseModel):
    lat: float
    lon: float
    distance_km: float
    acquired_at: IndiaTime
    satellite: str
    confidence: Literal["low", "nominal", "high"] | None
    frp_mw: float | None = Field(description="Fire radiative power")


class FiresNearResponse(BaseModel):
    source: str
    as_of: IndiaTime | None
    radius_km: float
    count: int
    count_nominal_or_high: int
    nearest_km: float | None
    fires: list[Fire] = Field(description="Nearest first, at most 50")


# ---- request status (Command reports progress; the farmer's status page) ----

RequestStatusCode = Literal["filed", "seen", "machine_assigned", "in_field", "action_taken", "closed"]


class SmsReceipt(BaseModel):
    model_config = ConfigDict(extra="allow")  # via sns: message_id; via outbox: path
    to: str = Field(description="Masked: +91******3210")
    via: str | None = Field(default=None, description="sns or outbox")
    error: str | None = None


class StatusEntry(BaseModel):
    status: RequestStatusCode
    at: IndiaTime
    machine: str | None = None
    chc: str | None = None
    chc_phone: str | None = None
    date: str | None = Field(default=None, description="As written in the farmer's language, e.g. 2 ਨਵੰਬਰ")
    note: str | None = None
    sms: SmsReceipt | None = None


class HelpRequestStatusResponse(BaseModel):
    helpRequestId: str
    recorded: StatusEntry


class KisanStatusResponse(BaseModel):
    helpRequestId: str | None = Field(description="None until the request is filed")
    current: RequestStatusCode | None
    history: list[StatusEntry]


# ---- the district allocator (for Command) ----

class Allocation(BaseModel):
    helpRequestId: str
    machineId: str
    chcId: str
    chcName: str
    machineType: str
    date: date
    acres: float
    distanceKm: float
    substitute: bool = Field(description="True when another machine type stands in for the one asked for")
    reason: str = Field(description="Why, in words an officer can check")


class Unassigned(BaseModel):
    helpRequestId: str
    uncoveredAcres: float
    reason: str


class AllocationResponse(BaseModel):
    assignments: list[Allocation]
    unassigned: list[Unassigned]
    order: list[str] = Field(description="Help request ids in the order they were served")
    acresCovered: float
    acresRequested: float
    fullyCovered: int


# ---- photos ----

class PhotoInfo(BaseModel):
    lat: float | None
    lon: float | None
    taken_at: str | None = Field(description="From the photo's EXIF, which has no time zone")
    width: int
    height: int
    faces_blurred: int


class MachineGuess(BaseModel):
    machine: Literal["happy_seeder", "super_seeder", "mulcher_rmb", "baler", "other", "none"] | None = None
    confidence: float | None = None
    why: str | None = None
    error: str | None = None


class PhotoResponse(BaseModel):
    photo: PhotoInfo
    stored_as: str
    location: str | None = Field(description="Set when the photo's GPS became the farm's location")
    machine: MachineGuess | None


# ---- what Kisan files with Command: POST /v1/complaints ----

class FarmMachine(BaseModel):
    type: MachineCode
    days: float


class Farm(BaseModel):
    village: str | None
    district: str | None
    state: str | None
    lat: float | None
    lon: float | None
    location_source: Literal["gps", "village", "district"] | None
    paddy_acres: float
    variety: str | None
    harvest_date: date
    wheat_deadline: date
    tractors: int
    machines: list[FarmMachine]


class Coverage(BaseModel):
    coverage_pct: int = Field(description="With the farmer's own machines only")
    covered_acres: float
    gap_acres: float
    straw_t: float
    pm25_kg: float = Field(description="If the gap is burnt")


class NearbyFires(BaseModel):
    source: str
    as_of: IndiaTime | None
    radius_km: float
    count: int
    count_nominal_or_high: int
    nearest_km: float | None
    located_by: Literal["gps", "village"]


class SupportRequest(BaseModel):
    """Everything Kisan worked out for one farm."""
    type: Literal["support_request"] = "support_request"
    source: Literal["kisan_saathi"] = "kisan_saathi"
    idempotency_key: str
    created_at: IndiaTime
    language: Literal["pa", "hi", "en"]
    farm: Farm
    coverage: Coverage
    plan: list[Booking] = Field(description="Suggested CHC bookings; the CHC or officer confirms them")
    unmet: list[Unmet] = Field(description="What the department is asked to provide")
    nearby_fires: NearbyFires | None = Field(description="The last satellite check around the farm, if any")


class KisanHelpRequest(BaseModel):
    """Saans Command's HelpRequestSchema (src/domain/schemas), plus extras for the officer's case view."""
    id: str
    farmerId: str
    farmLocation: Location
    district: str
    crop: str
    acreage: float
    machineType: MachineName
    requiredFrom: IndiaTime
    requiredUntil: IndiaTime
    coveragePercent: int = Field(description="After the planned bookings")
    uncoveredAcres: float
    status: Literal["OPEN", "MATCHED", "FULFILLED", "EXPIRED"]
    ownCoveragePercent: int
    locationSource: Literal["gps", "village", "district"] | None
    plannedBookings: list[dict] = Field(description="The plan, with Command's machine names")
    nearbyFires: dict | None
    source: Literal["kisan_saathi"]


class FarmerSupportComplaint(BaseModel):
    """Kisan's body for POST /v1/complaints: ComplaintInput with type farmer_support."""
    type: Literal["farmer_support"] = "farmer_support"
    location: Location
    evidence: list[dict] = Field(default_factory=list, description="Kisan sends no evidence: a farmer asks for help")
    support_request: SupportRequest
    help_request: KisanHelpRequest
