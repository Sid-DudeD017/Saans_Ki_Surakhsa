"""get_fires_near_farm: satellite fire points near a farm, from P3's GET /v1/fires. No network: P3's
service is a local stand-in that answers in the shape of packages/contracts/proposals/p3-aqi.openapi.json."""

import json
import math
from datetime import date

import httpx
import pytest
from fastapi.testclient import TestClient

from agent_kisan import api, fires
from agent_kisan.fires import FiresNear, FiresUnavailable, bbox, confidence, default_fires, fires_near
from agent_kisan.planner import haversine_km
from agent_kisan.seed import repo_root
from agent_kisan.session import KisanSession

FARM = (30.266, 76.040)  # Bhawanigarh in the demo seed
KM_LAT = 1 / 111.32  # degrees of latitude per km


def north(km, east=0.0):
    return (FARM[0] + km * KM_LAT, FARM[1] + east * KM_LAT / math.cos(math.radians(FARM[0])))


def point(at, conf="n", when="2026-10-23T13:42:00.000+05:30", frp=6.1):
    return {"lat": at[0], "lon": at[1], "acquisition_time": when, "satellite": "N", "confidence": conf, "frp": frp}


# 0.4 km, 3 km (high), 4 km (low), and 4.5 km north + 4.5 km east: inside the box, outside the 5 km circle.
POINTS = [point(north(3), "h"), point(north(0.4)), point(north(4), "l"), point(north(4.5, 4.5))]


def stand_in(points=POINTS, status=200, body=None):
    """P3's service as the contract describes it; records the requests it gets."""
    seen = []

    def handler(request):
        seen.append(request)
        if body is not None:
            return httpx.Response(status, content=body)
        return httpx.Response(status, json={"fires": points, "count": len(points),
                                            "as_of": "2026-10-23T14:00:00.000+05:30"})
    return httpx.Client(transport=httpx.MockTransport(handler)), seen


def test_bbox_is_the_square_around_the_circle():
    min_lon, min_lat, max_lon, max_lat = map(float, bbox(*FARM, 5).split(","))
    assert haversine_km(FARM, (max_lat, FARM[1])) == pytest.approx(5, abs=0.01)
    assert haversine_km(FARM, (FARM[0], max_lon)) == pytest.approx(5, abs=0.01)
    assert (min_lat + max_lat) / 2 == pytest.approx(FARM[0], abs=1e-4)
    assert (min_lon + max_lon) / 2 == pytest.approx(FARM[1], abs=1e-4)


@pytest.mark.parametrize("raw, want", [("l", "low"), ("n", "nominal"), ("h", "high"), ("High", "high"),
                                       ("nominal", "nominal"), (25, "low"), ("50", "nominal"), (90, "high"),
                                       ("", None), (None, None), ("?", None)])
def test_confidence_from_viirs_letters_or_modis_percent(raw, want):
    assert confidence(raw) == want


def test_keeps_points_inside_the_circle_nearest_first():
    client, seen = stand_in()
    found = fires_near(*FARM, 5, base_url="http://p3.test/", client=client)
    assert [round(f.distance_km, 1) for f in found.fires] == [0.4, 3.0, 4.0]
    assert [f.confidence for f in found.fires] == ["nominal", "high", "low"]
    assert seen[0].url.path == "/v1/fires" and seen[0].url.params["bbox"] == bbox(*FARM, 5)
    out = found.to_json()
    assert out["count"] == 3 and out["count_nominal_or_high"] == 2 and out["nearest_km"] == 0.4
    assert out["as_of"] == "2026-10-23T14:00:00.000+05:30" and out["radius_km"] == 5
    assert out["fires"][0]["acquired_at"] == "2026-10-23T13:42:00.000+05:30" and out["fires"][0]["frp_mw"] == 6.1


def test_bad_points_are_skipped_not_fatal():
    client, _ = stand_in([{"lat": "x", "lon": 76.0}, {"lon": 76.0}, point(north(1), frp=None)])
    found = fires_near(*FARM, 5, base_url="http://p3.test", client=client)
    assert len(found.fires) == 1 and found.fires[0].frp_mw is None


def test_no_fires_is_an_answer():
    client, _ = stand_in([])
    out = fires_near(*FARM, 5, base_url="http://p3.test", client=client).to_json()
    assert out["count"] == 0 and out["nearest_km"] is None and out["fires"] == []


@pytest.mark.parametrize("status, body", [(503, b'{"error": "sources_unavailable"}'), (200, b"not json"),
                                          (200, b'{"count": 0}')])
def test_p3_down_or_off_contract_is_unavailable(status, body):
    client, _ = stand_in(status=status, body=body)
    with pytest.raises(FiresUnavailable):
        fires_near(*FARM, 5, base_url="http://p3.test", client=client)


@pytest.mark.parametrize("radius", [0, -1, 25.5])
def test_radius_limits(radius):
    with pytest.raises(ValueError):
        fires_near(*FARM, radius, base_url="http://p3.test")


def test_stand_in_answers_in_p3s_contract_shape():
    spec = json.loads((repo_root() / "packages/contracts/proposals/p3-aqi.openapi.json").read_text())
    params = {p["name"]: p for p in spec["paths"]["/v1/fires"]["get"]["parameters"]}
    assert "bbox" in params  # what Kisan sends; P3 also takes lat, lon and radius_km instead
    schemas = spec["components"]["schemas"]
    client, _ = stand_in()
    body = client.get("http://p3.test/v1/fires", params={"bbox": bbox(*FARM, 5)}).json()
    assert set(schemas["FiresResponse"]["required"]) <= set(body)
    for p in body["fires"]:
        assert set(schemas["FirePoint"]["required"]) <= set(p)


def test_default_needs_saans_aqi_url(monkeypatch):
    monkeypatch.delenv("SAANS_AQI_URL", raising=False)
    with pytest.raises(FiresUnavailable, match="SAANS_AQI_URL"):
        default_fires(*FARM)


def test_default_is_cached_per_cell(monkeypatch):
    monkeypatch.setenv("SAANS_AQI_URL", "http://p3.test")
    monkeypatch.setattr(fires, "_cache", {})
    calls = []
    monkeypatch.setattr(fires, "fires_near", lambda lat, lon, r, base_url: calls.append(base_url) or
                        FiresNear((), r, None))
    default_fires(*FARM)
    default_fires(FARM[0] + 0.001, FARM[1])
    assert calls == ["http://p3.test"]


# ---- in the conversation ----

class ListFiler:
    def __init__(self):
        self.filed = []

    def file(self, request):
        self.filed.append(request)
        return {"via": "test"}


def session(source, **profile):
    s = KisanSession(filer=ListFiler(), weather=None, today=lambda: date(2026, 10, 8), fire_source=source)
    s.begin_turn("Bhawanigarh, Sangrur. 18 killa. Harvest 20 October, wheat by 9 November. 1 tractor, Super Seeder 2 din.")
    s.update(**profile)
    return s


def recorded(points=POINTS):
    asked = []

    def source(lat, lon, radius_km):
        asked.append((lat, lon, radius_km))
        client, _ = stand_in(points)
        return fires_near(lat, lon, radius_km, base_url="http://p3.test", client=client)
    return source, asked


def test_session_looks_around_the_village():
    source, asked = recorded()
    out = session(source, village="Bhawanigarh", district="Sangrur").fires_near()
    assert asked == [(30.266, 76.04, 5.0)]
    assert out["count"] == 3 and out["located_by"] == "village" and "neighbour" in out["note"]


def test_session_prefers_the_phones_location():
    source, asked = recorded()
    s = session(source, village="Bhawanigarh", district="Sangrur")
    s.profile.lat, s.profile.lon = 30.3, 76.1
    assert s.fires_near(10)["located_by"] == "gps" and asked == [(30.3, 76.1, 10)]


def test_district_centre_is_too_rough():
    source, asked = recorded()
    out = session(source, village="Nowhere", district="Sangrur").fires_near()
    assert "village" in out["error"] and asked == []


def test_unavailable_is_reported_to_the_agent():
    def down(lat, lon, radius_km):
        raise FiresUnavailable("fire data unavailable (ConnectError)")
    s = session(down, village="Bhawanigarh", district="Sangrur")
    assert s.fires_near() == {"error": "fire data unavailable (ConnectError)"}
    assert session(None, village="Bhawanigarh", district="Sangrur").fires_near()["error"]
    assert "25" in session(recorded()[0], village="Bhawanigarh").fires_near(40)["error"]


def test_fire_check_goes_with_the_help_request():
    source, _ = recorded()
    s = session(source, village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa",
                harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2})
    s.fires_near()
    s.prepare_readback()
    s.begin_turn("haan ji")
    s.file_report()
    request = s.filer.filed[0]
    assert request["nearby_fires"] == {"source": "nasa-firms via /v1/fires", "as_of": "2026-10-23T14:00:00.000+05:30",
                                       "radius_km": 5.0, "count": 3, "count_nominal_or_high": 2, "nearest_km": 0.4,
                                       "located_by": "village"}
    assert request["help_request"]["nearbyFires"] == {"count": 3, "countNominalOrHigh": 2, "nearestKm": 0.4,
                                                      "radiusKm": 5.0, "asOf": "2026-10-23T14:00:00.000+05:30"}


def test_never_checked_is_filed_as_none():
    s = session(None, village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa",
                harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2})
    s.prepare_readback()
    s.begin_turn("haan ji")
    s.file_report()
    assert s.filer.filed[0]["nearby_fires"] is None and s.filer.filed[0]["help_request"]["nearbyFires"] is None


# ---- GET /v1/farm/fires ----

def test_endpoint(monkeypatch):
    monkeypatch.setattr(api, "fire_source", recorded()[0])
    res = TestClient(api.app).get("/v1/farm/fires", params={"lat": FARM[0], "lon": FARM[1]})
    assert res.status_code == 200 and res.json()["count"] == 3


def test_endpoint_when_p3_is_down(monkeypatch):
    def down(lat, lon, radius_km):
        raise FiresUnavailable("fire data unavailable (ConnectError)")
    monkeypatch.setattr(api, "fire_source", down)
    res = TestClient(api.app).get("/v1/farm/fires", params={"lat": FARM[0], "lon": FARM[1]})
    assert res.status_code == 503 and "unavailable" in res.json()["detail"]


@pytest.mark.parametrize("params", [{"lat": 30.2}, {"lat": 95, "lon": 76}, {"lat": 30.2, "lon": 76, "radius_km": 30}])
def test_endpoint_checks_its_inputs(params):
    assert TestClient(api.app).get("/v1/farm/fires", params=params).status_code == 422
