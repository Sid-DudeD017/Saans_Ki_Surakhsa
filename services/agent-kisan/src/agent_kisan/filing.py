"""Filing a farmer's help request with Saans Command (P4's POST /v1/complaints).

The body is P4's ComplaintInput with type farmer_support: the farm's location, no evidence,
the support_request (plan and unmet) and the same request as Command's HelpRequest
(schemas.FarmerSupportComplaint). Until Command's API is reachable, requests go to a local
outbox file instead.
"""

import json
import os
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

import httpx

from agent_kisan.help_request import NoLocation, to_help_request
from agent_kisan.schemas import india_now

if TYPE_CHECKING:
    from agent_kisan.coverage import CoverageResult
    from agent_kisan.planner import Plan
    from agent_kisan.session import FarmProfile


class Filer(Protocol):
    def file(self, request: dict) -> dict: ...


def build_support_request(
    session_id: str, profile: "FarmProfile", cov: "CoverageResult", plan: "Plan | None", language: str,
    location: tuple[float, float] | None = None, location_source: str | None = None, farmer_id: str | None = None,
    nearby_fires: dict | None = None,
) -> dict:
    """plan=None means the planner couldn't run, so the whole gap is unmet.

    help_request is the same request in Saans Command's HelpRequest shape (help_request.py).
    """
    farm = profile.to_json()
    if plan is not None:
        bookings = [b.to_json() for b in plan.bookings]
        unmet = [u.to_json() for u in plan.unmet]
    else:
        bookings = []
        unmet = [] if cov.gap_acres == 0 else [
            {"machine": None, "days": None, "acres": round(cov.gap_acres, 2), "latest_date": farm["wheat_deadline"]}
        ]
    request = {
        "type": "support_request",
        "source": "kisan_saathi",
        "idempotency_key": session_id,
        "created_at": india_now(),
        "language": language,
        "farm": {
            "village": farm["village"],
            "district": farm["district"],
            "state": farm["state"],
            "lat": location[0] if location else None,
            "lon": location[1] if location else None,
            "location_source": location_source,  # gps, village or district
            "paddy_acres": round(cov.paddy_acres, 2),
            "variety": farm["variety"],
            "harvest_date": farm["harvest_date"],
            "wheat_deadline": farm["wheat_deadline"],
            "tractors": farm["tractors"],
            "machines": [{"type": m, "days": d} for m, d in sorted(farm["machines"].items())],
        },
        "coverage": {
            "coverage_pct": cov.coverage_pct,
            "covered_acres": round(cov.covered_acres, 2),
            "gap_acres": round(cov.gap_acres, 2),
            "straw_t": round(cov.straw_t, 2),
            "pm25_kg": round(cov.pm25_kg, 2),
        },
        "plan": bookings,  # suggested CHC bookings; the CHC or officer confirms them
        "unmet": unmet,  # what the department is asked to provide
        "nearby_fires": nearby_fires,  # the last satellite check around the farm; None if never checked
    }
    try:
        request["help_request"] = to_help_request(request, farmer_id or f"kisan-farmer-{session_id[:12]}")
    except NoLocation as e:
        request["help_request"], request["help_request_error"] = None, str(e)
    return request


def to_complaint(request: dict) -> dict:
    """The body for Command's POST /v1/complaints. Raises NoLocation: Command needs a place."""
    if request.get("help_request") is None:
        raise NoLocation(request.get("help_request_error") or "no farm location")
    farm = request["farm"]
    support = {k: v for k, v in request.items() if k not in ("help_request", "help_request_error")}
    return {"type": "farmer_support", "location": {"lat": farm["lat"], "lon": farm["lon"]}, "evidence": [],
            "support_request": support, "help_request": request["help_request"]}


class HttpFiler:
    def __init__(self, base_url: str, timeout: float = 5.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def file(self, request: dict) -> dict:
        res = httpx.post(
            f"{self.base_url}/v1/complaints",
            json=to_complaint(request),
            headers={"Idempotency-Key": request["idempotency_key"]},
            timeout=self.timeout,
        )
        res.raise_for_status()
        return {"via": "api", "status": res.status_code, "body": res.json() if res.content else None}


class OutboxFiler:
    def __init__(self, path: Path):
        self.path = path

    def file(self, request: dict) -> dict:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(request, ensure_ascii=False) + "\n")
        return {"via": "outbox", "path": str(self.path)}


def default_filer() -> Filer:
    url = os.environ.get("SAANS_API_URL")
    if url:
        return HttpFiler(url)
    return OutboxFiler(Path(os.environ.get("KISAN_OUTBOX", ".outbox/support_requests.jsonl")))
