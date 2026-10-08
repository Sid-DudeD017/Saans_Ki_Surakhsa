"""Converts Kisan's support_request into Saans Command's HelpRequest (P4's src/domain/schemas, zod).

    HelpRequest = { id, farmerId, farmLocation: {lat, lng}, district, crop, acreage, machineType,
                    requiredFrom, requiredUntil, coveragePercent, uncoveredAcres,
                    status: OPEN | MATCHED | FULFILLED | EXPIRED }

The help request is for what is still short after the zero-burn plan, so coveragePercent and
uncoveredAcres are after booking. The farmer's own coverage and the day-by-day bookings ride
along as extra fields, which zod's default object parsing strips without complaint.
"""

MACHINE_NAMES = {"happy_seeder": "Happy Seeder", "super_seeder": "Super Seeder",
                 "mulcher_rmb": "Mulcher + RMB Plough", "baler": "Baler"}


class NoLocation(ValueError):
    """HelpRequest needs farmLocation, and the farm has no GPS, known village or known district."""


def to_help_request(request: dict, farmer_id: str) -> dict:
    farm, cov, unmet, plan = request["farm"], request["coverage"], request["unmet"], request["plan"]
    if farm.get("lat") is None or farm.get("lon") is None:
        raise NoLocation("no farm location: send GPS from the app, or add the village or district to data/seed")
    booked = sum(b["acres"] for b in plan)
    uncovered = round(sum(u["acres"] for u in unmet), 2)
    paddy = farm["paddy_acres"]
    after = min(1.0, (cov["covered_acres"] + booked) / paddy) if paddy else 0.0
    machine = next((u["machine"] for u in unmet if u["machine"]), None)
    return {
        "id": f"kisan-{request['idempotency_key']}",
        "farmerId": farmer_id,
        "farmLocation": {"lat": farm["lat"], "lng": farm["lon"]},
        "district": farm["district"],
        "crop": "Paddy",
        "acreage": paddy,
        "machineType": MACHINE_NAMES.get(machine, "Any"),
        "requiredFrom": _datetime(farm["harvest_date"]),
        "requiredUntil": _datetime(farm["wheat_deadline"]),
        "coveragePercent": int(after * 100 + 0.5),
        "uncoveredAcres": uncovered,
        "status": "OPEN" if uncovered > 0 else "MATCHED",
        # extras for the officer's case view
        "ownCoveragePercent": cov["coverage_pct"],
        "locationSource": farm.get("location_source"),
        "plannedBookings": [{**b, "machine": MACHINE_NAMES.get(b["machine"], b["machine"])} for b in plan],
        "source": "kisan_saathi",
    }


def _datetime(day: str) -> str:
    return f"{day}T00:00:00Z"
