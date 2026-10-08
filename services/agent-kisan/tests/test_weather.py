"""Rain days from Open-Meteo, and how coverage and the plan use them. No network: HTTP is mocked."""

from datetime import date

import httpx
import pytest

from agent_kisan import api, weather
from agent_kisan.planner import Chc, ChcMachine, plan_zero_burn
from agent_kisan.session import KisanSession
from agent_kisan.weather import RainForecast, fetch_daily_mm, rain_days, rain_forecast

D = date


def open_meteo(daily_mm):
    """A mocked Open-Meteo that returns these daily totals and records the query."""
    seen = {}

    def handler(request):
        seen.update(request.url.params)
        return httpx.Response(200, json={"daily": {"time": [d.isoformat() for d in daily_mm],
                                                   "precipitation_sum": list(daily_mm.values())}})
    return httpx.Client(transport=httpx.MockTransport(handler)), seen


def test_rain_threshold_and_wet_day_after_heavy_rain():
    daily = {D(2026, 10, 20): 4.9, D(2026, 10, 21): 5.0, D(2026, 10, 25): 22.0, D(2026, 10, 26): 0.0}
    assert rain_days(daily) == {D(2026, 10, 21), D(2026, 10, 25), D(2026, 10, 26)}


def test_fetch_parses_and_treats_missing_as_zero():
    client, seen = open_meteo({D(2026, 10, 8): 1.5, D(2026, 10, 9): None})
    assert fetch_daily_mm(30.2664, 76.0401, client) == {D(2026, 10, 8): 1.5, D(2026, 10, 9): 0.0}
    assert seen["daily"] == "precipitation_sum" and seen["timezone"] == "Asia/Kolkata"
    assert seen["forecast_days"] == "16" and seen["latitude"] == "30.266"


def test_forecast_is_cached_per_cell(monkeypatch):
    monkeypatch.setattr(weather, "_cache", {})
    calls = []
    client = httpx.Client(transport=httpx.MockTransport(lambda r: calls.append(r) or httpx.Response(
        200, json={"daily": {"time": ["2026-10-08"], "precipitation_sum": [9.0]}})))
    first = rain_forecast(30.266, 76.040, client)
    second = rain_forecast(30.270, 76.041, client)  # same ~10 km cell
    assert first is second and len(calls) == 1
    assert first.rain_dates == {D(2026, 10, 8)} and first.forecast_until == D(2026, 10, 8)


def test_window_past_the_forecast_says_so():
    f = RainForecast(frozenset({D(2026, 10, 21), D(2026, 11, 30)}), D(2026, 10, 23), {})
    out = f.to_json((D(2026, 10, 20), D(2026, 11, 9)))
    assert out["rain_dates"] == ["2026-10-21"]
    assert "2026-10-23" in out["note"]


def test_planner_never_books_a_day_that_has_passed():
    chc = Chc("a", "a", "a", "Sangrur", 30.27, 76.04, "+91 00000 00000", 0.0,
              (ChcMachine("happy_seeder", 1, 1000, {}),))
    p = plan_zero_burn(7, D(2026, 10, 1), D(2026, 10, 20), [chc], farm_location=(30.27, 76.04),
                       today=D(2026, 10, 8))
    assert [b.date for b in p.bookings] == [D(2026, 10, 8)]


# ---- in the conversation ----

GURPREET = dict(
    village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa",
    harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2},
)


class NoFiler:
    def file(self, request):
        return {}


def session_with(weather_fn):
    return KisanSession(filer=NoFiler(), weather=weather_fn, today=lambda: D(2026, 10, 8))


def test_forecast_rain_reaches_coverage_and_plan():
    asked = []

    def fake(lat, lon):
        asked.append((lat, lon))
        return RainForecast(frozenset({D(2026, 10, 27), D(2026, 10, 28), D(2026, 11, 2)}), D(2026, 10, 23), {})

    s = session_with(fake)
    s.update(**GURPREET)
    assert s.coverage()["tractor_days_available"] == 17  # 20 days minus 3 rain days
    plan = s.plan()
    assert plan["plan"] == []  # 2 Nov was CHC A's only free day, and now it rains
    assert plan["unmet"][0]["acres"] == 7
    assert asked == [(30.266, 76.040)]  # Bhawanigarh from the seed, fetched once
    assert s.rain()["rain_dates"] == ["2026-10-27", "2026-10-28", "2026-11-02"]


def test_forecast_failure_plans_as_if_dry():
    def broken(lat, lon):
        raise httpx.ConnectError("no network")

    s = session_with(broken)
    s.update(**GURPREET)
    assert s.plan()["coverage_after_pct"] == 92
    assert "assumed dry" in s.rain()["error"]


def test_unknown_location_means_no_forecast():
    s = session_with(lambda lat, lon: pytest.fail("should not fetch"))
    s.update(**{**GURPREET, "village": "Somewhere new"})
    s.coverage()
    assert "location unknown" in s.forecast_error


# ---- POST /v1/farm/plan without rain_dates ----

def test_plan_endpoint_uses_the_forecast(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setattr(api, "today", lambda: D(2026, 10, 8))
    monkeypatch.setattr(api, "rain_forecast",
                        lambda lat, lon: RainForecast(frozenset({D(2026, 10, 27)}), D(2026, 10, 23), {}))
    body = {"paddy": {"value": 18, "unit": "killa"}, "harvest_date": "2026-10-20", "wheat_deadline": "2026-11-09",
            "machines": [{"type": "super_seeder", "days": 2}], "village": "Bhawanigarh", "district": "Sangrur"}
    res = TestClient(api.app).post("/v1/farm/plan", json=body).json()
    assert res["rain_dates_used"] == ["2026-10-27"]
    assert res["coverage"]["work_days"] == 19
    assert "2026-10-23" in res["rain_note"]
