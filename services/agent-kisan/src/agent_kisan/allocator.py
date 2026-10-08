"""District allocator: share a district's scarce CHC machines across open help requests.

Works on Saans Command's own shapes (HelpRequest and MachineAsset in src/domain/schemas), so
Command can send its queue as it is and show the result as the officer's suggested actions.

Rules, in order, so an officer can follow every decision:
1. Requests with the earliest wheat deadline go first; on a tie, the smaller shortfall first,
   so more farmers are helped before their deadline.
2. A machine does one farm per day (moving it takes the rest of the day), only on days it is
   available, within the request's dates, not on rain days, and not before today.
3. For each request, take the exact machine type first, then a machine that does the same
   job (a Super Seeder for a Happy Seeder), nearest first, then earliest.
These are suggestions; the officer confirms or changes each one.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from agent_kisan.planner import haversine_km

DEFAULT_MAX_KM = 25.0
# What can stand in for what: both seeders sow wheat straight into the stubble.
SUBSTITUTES = {"Happy Seeder": ["Super Seeder"], "Super Seeder": ["Happy Seeder"]}
CAPACITY_FALLBACK = {"Happy Seeder": 7.0, "Super Seeder": 5.5, "Mulcher + RMB Plough": 4.5, "Baler": 15.0}


@dataclass(frozen=True)
class Assignment:
    help_request_id: str
    machine_id: str
    chc_id: str
    chc_name: str
    machine_type: str
    date: date
    acres: float
    distance_km: float
    substitute: bool
    reason: str

    def to_json(self) -> dict:
        return {"helpRequestId": self.help_request_id, "machineId": self.machine_id, "chcId": self.chc_id,
                "chcName": self.chc_name, "machineType": self.machine_type, "date": self.date.isoformat(),
                "acres": round(self.acres, 2), "distanceKm": round(self.distance_km, 1),
                "substitute": self.substitute, "reason": self.reason}


def allocate(help_requests: Iterable[dict], machine_assets: Iterable[dict], *, max_km: float = DEFAULT_MAX_KM,
             rain_dates: Iterable[date] = (), today: date | None = None) -> dict:
    rain = set(rain_dates)
    requests = [r for r in help_requests if r.get("status") == "OPEN" and r.get("uncoveredAcres", 0) > 0]
    assets = [m for m in machine_assets if m.get("status") == "AVAILABLE"]
    requests.sort(key=lambda r: (_day(r["requiredUntil"]), r["uncoveredAcres"], r["id"]))
    booked: set[tuple[str, date]] = set()  # (machine id, day)
    assignments, unassigned = [], []

    for rank, r in enumerate(requests, 1):
        start = max(_day(r["requiredFrom"]), today) if today else _day(r["requiredFrom"])
        end = _day(r["requiredUntil"])  # the deadline itself: wheat must be sown by then
        wanted = r["machineType"]
        allowed = None if wanted == "Any" else [wanted, *SUBSTITUTES.get(wanted, [])]
        farm = (r["farmLocation"]["lat"], r["farmLocation"]["lng"])
        slots = []
        for m in assets:
            if allowed is not None and m["machineType"] not in allowed:
                continue
            dist = haversine_km(farm, (m["location"]["lat"], m["location"]["lng"]))
            if dist > max_km:
                continue
            first, last = max(start, _day(m["availableFrom"])), min(end, _day(m["availableUntil"]))
            type_rank = 0 if allowed is None or m["machineType"] == wanted else 1
            for d in range((last - first).days):
                day = first + timedelta(d)
                if day not in rain and (m["id"], day) not in booked:
                    slots.append((type_rank, dist, day, m))
        slots.sort(key=lambda s: (s[0], s[1], s[2], s[3]["id"]))

        need = r["uncoveredAcres"]
        for type_rank, dist, day, m in slots:
            if need <= 1e-9:
                break
            if (m["id"], day) in booked:
                continue
            capacity = m.get("capacityAcresPerDay") or CAPACITY_FALLBACK.get(m["machineType"], 5.0)
            acres = min(capacity, need)
            need -= acres
            booked.add((m["id"], day))
            reason = (f"priority {rank} of {len(requests)}: wheat deadline {end.isoformat()}"
                      + (f"; {m['machineType']} stands in for {wanted}" if type_rank else "")
                      + f"; {dist:.1f} km away")
            assignments.append(Assignment(r["id"], m["id"], m["chcId"], m["chcName"], m["machineType"], day,
                                          acres, dist, bool(type_rank), reason))
        if need > 1e-9:
            unassigned.append({"helpRequestId": r["id"], "uncoveredAcres": round(need, 2),
                               "reason": "no free machine in reach before the deadline"})

    covered = {r["id"]: round(r["uncoveredAcres"] - next((u["uncoveredAcres"] for u in unassigned
                                                           if u["helpRequestId"] == r["id"]), 0), 2)
               for r in requests}
    return {
        "assignments": [a.to_json() for a in sorted(assignments, key=lambda a: (a.date, a.machine_id))],
        "unassigned": unassigned,
        "order": [r["id"] for r in requests],
        "acresCovered": round(sum(covered.values()), 2),
        "acresRequested": round(sum(r["uncoveredAcres"] for r in requests), 2),
        "fullyCovered": sum(1 for r in requests if covered[r["id"]] >= r["uncoveredAcres"] - 1e-9),
    }


def _day(value: str) -> date:
    """HelpRequest and MachineAsset dates are ISO datetimes ("2026-10-20T00:00:00Z")."""
    return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
