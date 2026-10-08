"""One farmer's conversation: the farm details collected so far, and the rules for filing.

The agent's tools are thin wrappers over this class, so the rules hold whatever
the model does. A help request can only be filed after every detail has been
read back to the farmer, the farmer has answered in a later message, and
nothing changed since the read-back.

Every number the model records must also be one the farmer said (guard.py); unsure numbers
block the read-back until the farmer says them again or taps the quick reply.

The zero-burn plan is part of what gets read back and filed. If the planner
can't run (no CHC data, say), the whole gap is filed as unmet instead.
"""

import json
import math
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta

import httpx

from agent_kisan.coverage import CAPACITY_ACRES_PER_DAY, CoverageResult, estimate_coverage
from agent_kisan.filing import Filer, build_support_request
from agent_kisan.guard import unsure as unsure_numbers
from agent_kisan.planner import Chc, Plan, find_chcs, plan_zero_burn
from agent_kisan.seed import load_districts, load_seed
from agent_kisan.units import UnknownUnitError, is_known_unit, to_acres
from agent_kisan.weather import RainForecast, rain_forecast

REQUIRED = ("village", "district", "paddy_area", "harvest_date", "wheat_deadline", "tractors", "machines")


@dataclass
class FarmProfile:
    village: str | None = None
    district: str | None = None
    state: str = "Punjab"
    paddy_area: float | None = None
    paddy_unit: str = "acre"
    variety: str | None = None
    harvest_date: date | None = None
    wheat_deadline: date | None = None
    tractors: int | None = None
    machines: dict[str, float] | None = None  # None = not asked yet, {} = none
    decomposer_acres: float = 0.0
    lat: float | None = None  # from the phone's location, when the app sends it
    lon: float | None = None

    def missing(self) -> list[str]:
        return [name for name in REQUIRED if getattr(self, name) is None]

    def paddy_acres(self) -> float:
        return to_acres(self.paddy_area, self.paddy_unit, self.state)

    def window_days(self) -> int:
        return (self.wheat_deadline - self.harvest_date).days

    def to_json(self) -> dict:
        d = asdict(self)
        for k in ("harvest_date", "wheat_deadline"):
            d[k] = d[k].isoformat() if d[k] else None
        return d


@dataclass
class KisanSession:
    filer: Filer
    language: str = "pa"
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    profile: FarmProfile = field(default_factory=FarmProfile)
    turn: int = 0
    readback_turn: int | None = None
    readback_snapshot: str | None = None
    filed: dict | None = None
    rain_dates: set[date] = field(default_factory=set)
    # Called once per conversation with the farm's (lat, lon). None = don't fetch a forecast (tests, offline).
    weather: Callable[[float, float], RainForecast] | None = rain_forecast
    forecast: RainForecast | None = None
    forecast_error: str | None = None
    today: Callable[[], date] = date.today
    messages: list[str] = field(default_factory=list)  # what the farmer said, turn by turn
    distrusted: list[frozenset[float]] = field(default_factory=list)  # numbers speech recognition was unsure of
    explicitly_set: set[str] = field(default_factory=set)
    farmer_id: str | None = None  # from sign-in (P4's Cognito), when the app sends it
    districts: dict[str, tuple[float, float]] | None = None  # None = load data/seed
    chcs: tuple[Chc, ...] | None = None  # None = load data/seed
    villages: dict[str, tuple[float, float]] | None = None

    def begin_turn(self, text: str | None = None, distrust: frozenset[float] = frozenset()) -> None:
        """distrust: numbers in this message that speech recognition wasn't sure it heard right."""
        self.turn += 1
        if text:
            self.messages.append(text)
            self.distrusted.append(frozenset(distrust))

    def unsure(self) -> list[dict]:
        return unsure_numbers(self.profile, self.explicitly_set, self.messages, self.language, self.distrusted)

    # ---- tools call these ----

    def update(self, **fields) -> dict:
        errors = {}
        for name, value in fields.items():
            if value is None:
                continue
            try:
                setattr(self.profile, name, _clean(name, value))
                self.explicitly_set.add(name)
            except ValueError as e:
                errors[name] = str(e)
        out = {"profile": self.profile.to_json(), "missing": self.profile.missing(), "errors": errors}
        if unsure := self.unsure():
            out["unsure"] = unsure
            out["next"] = "The farmer never said these numbers. Ask them to say each again or tap it before moving on."
        return out

    def coverage(self) -> dict:
        result = self._coverage()
        if isinstance(result, dict):
            return result
        return _coverage_json(result)

    def rain(self) -> dict:
        """Fetch the rain forecast for the farm (once) and say which days in the window are lost to rain."""
        p = self.profile
        if p.harvest_date is None or p.wheat_deadline is None:
            return {"error": "need the harvest date and wheat deadline first"}
        self._fetch_rain()
        window = (p.harvest_date, p.wheat_deadline)
        if self.forecast is None:
            return {"error": self.forecast_error or "no forecast", "rain_dates": sorted(d.isoformat() for d in self._rain_in_window())}
        return self.forecast.to_json(window)

    def chcs_near(self, machine: str | None = None) -> dict:
        """CHCs near the farm, nearest first. Works before the profile is complete."""
        p = self.profile
        if machine is not None and machine not in CAPACITY_ACRES_PER_DAY:
            return {"error": f"unknown machine {machine!r}; known: {', '.join(CAPACITY_ACRES_PER_DAY)}"}
        where, source = self._located()
        if where is None and not p.district:
            return {"error": "need the village or district first"}
        try:
            chcs = self.chcs if self.chcs is not None else load_seed()[0]
        except (OSError, KeyError, ValueError) as e:
            return {"error": f"CHC list unavailable: {e}"}
        window = None
        if p.harvest_date and p.wheat_deadline and p.window_days() >= 0:
            self._fetch_rain()
            window = (p.harvest_date, p.wheat_deadline)
        found = find_chcs(chcs, farm_location=where, district=p.district, machine=machine, window=window,
                          rain_dates=self.rain_dates, today=self.today())
        note = "distances are from the district centre, so only rough" if source == "district" else None
        return {"chcs": found, "located_by": source, **({"note": note} if note else {})}

    def plan(self) -> dict:
        result = self._coverage()
        if isinstance(result, dict):
            return result
        return _plan_json(result, self._plan(result))

    def prepare_readback(self) -> dict:
        result = self._coverage()
        if isinstance(result, dict):
            return result
        if unsure := self.unsure():
            return {"error": "confirm these numbers with the farmer first", "unsure": unsure}
        self.readback_turn = self.turn
        self.readback_snapshot = self._snapshot()
        return {
            "read_this_back": self.profile.to_json(),
            "coverage": _coverage_json(result),
            "zero_burn_plan": _plan_json(result, self._plan(result)),
            "next": "Read every detail, the coverage and the bookings back to the farmer and ask them to confirm. "
                    "File only after they say yes in their next message.",
        }

    def file_report(self) -> dict:
        if self.filed:
            return {"error": "already filed", "report": self.filed}
        if self.readback_turn is None:
            return {"error": "read the details back first (prepare_readback), then wait for the farmer to confirm"}
        if self.readback_snapshot != self._snapshot():
            return {"error": "the details changed after the read-back; read them back again"}
        if self.turn <= self.readback_turn:
            return {"error": "wait for the farmer to confirm the read-back in their next message"}
        result = self._coverage()
        if isinstance(result, dict):
            return result
        plan = self._plan(result)
        where, source = self._located()
        request = build_support_request(
            self.session_id, self.profile, result, plan if isinstance(plan, Plan) else None, self.language,
            location=where, location_source=source, farmer_id=self.farmer_id,
        )
        receipt = self.filer.file(request)
        self.filed = {"request": request, "receipt": receipt}
        return {"filed": True, "receipt": receipt, "gap_acres": request["coverage"]["gap_acres"],
                "unmet": request["unmet"]}

    # ---- helpers ----

    def _coverage(self) -> CoverageResult | dict:
        p = self.profile
        if p.missing():
            return {"error": "missing details", "missing": p.missing()}
        self._fetch_rain()
        if p.window_days() < 0:
            return {"error": "the wheat deadline is before the harvest date; check both dates"}
        try:
            return estimate_coverage(
                p.paddy_acres(), p.window_days(), p.machines,
                tractors=p.tractors, rain_days=len(self._rain_in_window()), decomposer_acres=p.decomposer_acres,
            )
        except (UnknownUnitError, ValueError) as e:
            return {"error": str(e)}

    def _plan(self, cov: CoverageResult) -> Plan | dict:
        p = self.profile
        try:
            chcs, villages = self.chcs, self.villages
            if chcs is None:
                chcs, seed_villages, _ = load_seed()
                villages = seed_villages if villages is None else villages
            return plan_zero_burn(
                cov.gap_acres, p.harvest_date, p.wheat_deadline, chcs,
                rain_dates=self._rain_in_window(), farm_location=self._location(villages or {}), district=p.district,
                today=self.today(),
            )
        except (OSError, KeyError, ValueError) as e:
            return {"error": f"planner unavailable: {e}"}

    def _fetch_rain(self) -> None:
        """Once per conversation. On failure, plan with the rain dates already known and remember why."""
        if self.weather is None or self.forecast is not None or self.forecast_error is not None:
            return
        try:
            villages = self.villages if self.villages is not None else load_seed()[1]
        except (OSError, KeyError, ValueError):
            villages = {}
        where = self._location(villages)
        if where is None:
            self.forecast_error = "farm location unknown, so no rain forecast; days are assumed dry"
            return
        try:
            self.forecast = self.weather(*where)
        except (httpx.HTTPError, KeyError, ValueError) as e:
            self.forecast_error = f"rain forecast unavailable ({type(e).__name__}); days are assumed dry"
            return
        self.rain_dates |= set(self.forecast.rain_dates)

    def _located(self) -> tuple[tuple[float, float] | None, str | None]:
        """Where the farm is, best source first: the phone's GPS, the village, then the district's centre."""
        p = self.profile
        if p.lat is not None and p.lon is not None:
            return (p.lat, p.lon), "gps"
        try:
            _, seed_villages, _ = load_seed()
            seed_districts = load_districts()
        except (OSError, KeyError, ValueError):
            seed_villages, seed_districts = {}, {}
        villages = self.villages if self.villages is not None else seed_villages
        districts = self.districts if self.districts is not None else seed_districts
        if (v := villages.get((p.village or "").strip().lower())) is not None:
            return v, "village"
        if (d := districts.get((p.district or "").strip().lower())) is not None:
            return d, "district"
        return None, None

    def _location(self, villages: dict[str, tuple[float, float]]) -> tuple[float, float] | None:
        p = self.profile
        if p.lat is not None and p.lon is not None:
            return (p.lat, p.lon)
        return villages.get((p.village or "").strip().lower())

    def _rain_in_window(self) -> set[date]:
        p = self.profile
        window = {p.harvest_date + timedelta(d) for d in range(max(0, p.window_days()))}
        return self.rain_dates & window

    def _snapshot(self) -> str:
        return json.dumps(self.profile.to_json(), sort_keys=True)


def _clean(name: str, value):
    if name in ("harvest_date", "wheat_deadline"):
        try:
            return date.fromisoformat(str(value))
        except ValueError:
            raise ValueError(f"{value!r} is not a date; use YYYY-MM-DD") from None
    if name == "tractors":
        if int(value) != value or value < 0:
            raise ValueError("tractors must be a whole number, 0 or more")
        return int(value)
    if name == "machines":
        unknown = sorted(set(value) - set(CAPACITY_ACRES_PER_DAY))
        if unknown:
            known = ", ".join(CAPACITY_ACRES_PER_DAY)
            raise ValueError(f"unknown machines {', '.join(unknown)}; known: {known}")
        if any(d < 0 for d in value.values()):
            raise ValueError("machine days can't be negative")
        return {m: float(d) for m, d in value.items()}
    if name in ("paddy_area", "decomposer_acres") and value < 0:
        raise ValueError(f"{name} can't be negative")
    if name == "paddy_unit" and not is_known_unit(value):
        raise ValueError(f"unknown land unit {value!r}; use acre, killa, hectare or bigha")
    return value


def _coverage_json(r: CoverageResult) -> dict:
    return {
        "coverage_pct": r.coverage_pct,
        "paddy_acres": round(r.paddy_acres, 2),
        "covered_acres": round(r.covered_acres, 2),
        "gap_acres": round(r.gap_acres, 2),
        "straw_t": round(r.straw_t, 2),
        "pm25_kg": round(r.pm25_kg, 2),
        "tractor_days_used": round(r.tractor_days_used, 2),
        "tractor_days_available": r.tractor_days_available,
    }


def _plan_json(cov: CoverageResult, plan: Plan | dict) -> dict:
    if isinstance(plan, dict):
        return {**plan, "coverage_after_pct": cov.coverage_pct}
    after = (cov.covered_acres + plan.booked_acres) / cov.paddy_acres if cov.paddy_acres else 0.0
    return {**plan.to_json(), "coverage_after_pct": math.floor(after * 100 + 0.5)}
