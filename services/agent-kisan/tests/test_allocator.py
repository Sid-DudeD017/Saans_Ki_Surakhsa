"""District allocator on Command's HelpRequest / MachineAsset shapes."""

import random
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from agent_kisan import api
from agent_kisan.allocator import allocate

BASE = (30.3398, 76.3869)  # P4's Patiala demo point


def at(km_north):
    return {"lat": BASE[0] + km_north / 111.2, "lng": BASE[1]}


def request(id, acres, until, machine="Happy Seeder", start="2026-10-20", km=0.0, status="OPEN"):
    return {"id": id, "farmerId": f"f-{id}", "farmLocation": at(km), "district": "Patiala", "crop": "Paddy",
            "acreage": acres, "machineType": machine, "requiredFrom": f"{start}T00:00:00Z",
            "requiredUntil": f"{until}T00:00:00Z", "coveragePercent": 0, "uncoveredAcres": acres, "status": status}


def machine(id, kind="Happy Seeder", km=6.0, cap=8, start="2026-10-20", end="2026-11-30", status="AVAILABLE"):
    return {"id": id, "chcId": f"chc-{id}", "chcName": f"CHC {id}", "location": at(km), "machineType": kind,
            "availableFrom": f"{start}T00:00:00Z", "availableUntil": f"{end}T00:00:00Z", "status": status,
            "capacityAcresPerDay": cap}


def test_p4_demo_seed():
    """P4's seed: 15 acres, Happy Seeder by 5 Nov 2023; Bhaini CHC's Happy Seeder (8/day) from 1 Nov, 6 km away."""
    req = request("req-1", 15, "2023-11-05", start="2023-10-28")
    asset = machine("machine-1", start="2023-11-01", end="2023-11-30")
    out = allocate([req], [asset], today=date(2023, 10, 1))
    assert [(a["date"], a["acres"]) for a in out["assignments"]] == [("2023-11-01", 8), ("2023-11-02", 7)]
    assert out["assignments"][0]["distanceKm"] == 6.0 and out["unassigned"] == []
    assert out["fullyCovered"] == 1


def test_earliest_deadline_goes_first():
    early, late = request("early", 8, "2026-10-22"), request("late", 8, "2026-10-21", start="2026-10-20")
    late["requiredUntil"] = "2026-11-09T00:00:00Z"
    out = allocate([late, early], [machine("m1")], today=date(2026, 10, 20))
    assert out["order"] == ["early", "late"]
    assert [(a["helpRequestId"], a["date"]) for a in out["assignments"]] == [("early", "2026-10-20"), ("late", "2026-10-21")]


def test_on_a_tie_the_smaller_shortfall_first():
    out = allocate([request("big", 16, "2026-10-21"), request("small", 3, "2026-10-21")], [machine("m1")],
                   today=date(2026, 10, 20))
    assert out["order"] == ["small", "big"]
    assert out["assignments"][0]["helpRequestId"] == "small"
    assert out["unassigned"] == [{"helpRequestId": "big", "uncoveredAcres": 16,
                                  "reason": "no free machine in reach before the deadline"}]


def test_one_farm_per_machine_per_day():
    out = allocate([request("a", 2, "2026-10-21"), request("b", 2, "2026-10-21")], [machine("m1")],
                   today=date(2026, 10, 20))
    assert len(out["assignments"]) == 1 and out["fullyCovered"] == 1


def test_substitute_only_when_the_exact_machine_is_gone():
    out = allocate([request("r", 12, "2026-10-21")],
                   [machine("hs", cap=7), machine("ss", kind="Super Seeder", km=2, cap=5.5)], today=date(2026, 10, 20))
    first, second = out["assignments"][0], out["assignments"][1]
    assert (first["machineId"], first["substitute"]) == ("hs", False)  # exact type wins although farther
    assert (second["machineId"], second["substitute"]) == ("ss", True)
    assert "stands in for Happy Seeder" in second["reason"]


def test_rain_range_today_and_unavailable_machines():
    reqs = [request("r", 30, "2026-10-25")]
    assets = [machine("near", start="2026-10-20"), machine("far", km=40), machine("broken", status="MAINTENANCE")]
    out = allocate(reqs, assets, rain_dates=[date(2026, 10, 22)], today=date(2026, 10, 21))
    days = [a["date"] for a in out["assignments"]]
    assert days == ["2026-10-21", "2026-10-23", "2026-10-24"]  # not the 20th (past), 22nd (rain) or 25th (deadline)
    assert {a["machineId"] for a in out["assignments"]} == {"near"}


def test_closed_requests_are_ignored():
    assert allocate([request("done", 5, "2026-10-21", status="FULFILLED")], [machine("m1")])["order"] == []


def test_rules_hold_on_random_districts():
    rng = random.Random(11)
    kinds = ["Happy Seeder", "Super Seeder", "Baler"]
    for _ in range(100):
        reqs = [request(f"r{i}", rng.choice([2, 4.5, 8, 15]), (date(2026, 10, 20) + timedelta(rng.randrange(1, 15))).isoformat(),
                        machine=rng.choice(kinds + ["Any"]), km=rng.uniform(0, 30)) for i in range(rng.randrange(1, 12))]
        assets = [machine(f"m{i}", kind=rng.choice(kinds), km=rng.uniform(0, 30), cap=rng.choice([5.5, 7, 15]))
                  for i in range(rng.randrange(1, 6))]
        rain = {date(2026, 10, 20) + timedelta(rng.randrange(15)) for _ in range(2)}
        out = allocate(reqs, assets, rain_dates=rain, today=date(2026, 10, 20))
        by_req = {r["id"]: r for r in reqs}
        seen = set()
        for a in out["assignments"]:
            key = (a["machineId"], a["date"])
            assert key not in seen
            seen.add(key)
            r = by_req[a["helpRequestId"]]
            assert date.fromisoformat(a["date"]) < date.fromisoformat(r["requiredUntil"][:10])
            assert date.fromisoformat(a["date"]) not in rain and a["distanceKm"] <= 25
        for r in reqs:
            given = sum(a["acres"] for a in out["assignments"] if a["helpRequestId"] == r["id"])
            short = sum(u["uncoveredAcres"] for u in out["unassigned"] if u["helpRequestId"] == r["id"])
            assert given + short == pytest.approx(r["uncoveredAcres"])


def test_api():
    client = TestClient(api.app)
    body = {"helpRequests": [request("req-1", 15, "2023-11-05", start="2023-10-28")],
            "machineAssets": [machine("machine-1", start="2023-11-01")], "today": "2023-10-01"}
    res = client.post("/v1/allocations", json=body)
    assert res.status_code == 200 and res.json()["acresCovered"] == 15
    bad = client.post("/v1/allocations", json={"helpRequests": [{"id": "x", "status": "OPEN", "uncoveredAcres": 3}],
                                                "machineAssets": []})
    assert bad.status_code == 422
