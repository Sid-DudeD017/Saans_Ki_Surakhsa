from datetime import date

import pytest
from fastapi.testclient import TestClient

from agent_kisan import api
from agent_kisan.api import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch):
    monkeypatch.setattr(api, "today", lambda: date(2026, 10, 8))

GURPREET = {
    "paddy": {"value": 18, "unit": "killa"},
    "window_days": 20,
    "machines": [{"type": "super_seeder", "days": 2}],
}


def post(body):
    return client.post("/v1/farm/coverage", json=body)


def test_gurpreet():
    res = post(GURPREET)
    assert res.status_code == 200
    body = res.json()
    assert body["coverage_pct"] == 61
    assert body["gap_acres"] == 7
    assert body["straw_t"] == 17.5
    assert body["pm25_kg"] == 140
    assert body["tractor_days"] == {"available": 20, "used": 2}
    assert body["assumptions"]["capacity_acres_per_day"]["super_seeder"] == 5.5


def test_window_from_dates():
    body = {**GURPREET, "window_days": None, "harvest_date": "2026-10-20", "wheat_deadline": "2026-11-09"}
    res = post(body)
    assert res.status_code == 200
    assert res.json()["window_days"] == 20
    assert res.json()["coverage_pct"] == 61


def test_hectares():
    res = post({**GURPREET, "paddy": {"value": 4, "unit": "hectare"}})
    assert res.json()["paddy_acres"] == 9.88


def test_one_tractor_limit():
    body = {
        "paddy": {"value": 400},
        "window_days": 20,
        "machines": [{"type": "happy_seeder", "days": 15}, {"type": "baler", "days": 15}],
    }
    assert post(body).json()["covered_acres"] == 260


def test_needs_a_window():
    res = post({**GURPREET, "window_days": None})
    assert res.status_code == 422
    assert "window_days" in res.text


def test_deadline_before_harvest():
    body = {**GURPREET, "window_days": None, "harvest_date": "2026-11-09", "wheat_deadline": "2026-10-20"}
    assert post(body).status_code == 422


def test_unknown_machine():
    assert post({**GURPREET, "machines": [{"type": "combine", "days": 1}]}).status_code == 422


def test_duplicate_machine():
    machines = [{"type": "super_seeder", "days": 1}, {"type": "super_seeder", "days": 1}]
    res = post({**GURPREET, "machines": machines})
    assert res.status_code == 422
    assert "once" in res.text


def test_negative_acres():
    assert post({**GURPREET, "paddy": {"value": -1}}).status_code == 422


def test_bigha_without_state_explains_why():
    res = post({**GURPREET, "paddy": {"value": 10, "unit": "bigha"}})
    assert res.status_code == 422
    assert "state" in res.json()["error"]["message"]


def test_healthz():
    assert client.get("/healthz").json() == {"status": "ok"}


# ---- POST /v1/farm/plan ----

GURPREET_PLAN = {
    "paddy": {"value": 18, "unit": "killa"},
    "harvest_date": "2026-10-20",
    "wheat_deadline": "2026-11-09",
    "machines": [{"type": "super_seeder", "days": 2}],
    "village": "Bhawanigarh",
    "district": "Sangrur",
    "rain_dates": ["2026-10-27", "2026-10-28", "2026-12-25"],
}


def test_plan_gurpreet():
    res = client.post("/v1/farm/plan", json=GURPREET_PLAN)
    assert res.status_code == 200
    body = res.json()
    assert body["coverage"]["coverage_pct"] == 61
    assert body["coverage"]["work_days"] == 18  # the December rain date is outside the window
    assert [(b["date"], b["machine"], b["acres"]) for b in body["plan"]] == [("2026-11-02", "super_seeder", 5.5)]
    assert body["coverage_after_pct"] == 92
    assert body["unmet"] == [{"machine": "happy_seeder", "days": 1, "acres": 1.5, "latest_date": "2026-11-09"}]
    assert body["demo_data"] is True


def test_plan_needs_a_place():
    body = {**GURPREET_PLAN, "village": "Nowhere", "district": None}
    assert client.post("/v1/farm/plan", json=body).status_code == 422


def test_plan_needs_dates_not_window_days():
    body = {k: v for k, v in GURPREET_PLAN.items() if k not in ("harvest_date", "wheat_deadline")}
    assert client.post("/v1/farm/plan", json={**body, "window_days": 20}).status_code == 422
