"""find_chc: CHCs near a farm, nearest first, on the demo seed."""

from datetime import date

from fastapi.testclient import TestClient

from agent_kisan.api import app
from agent_kisan.session import KisanSession

SAID = "Bhawanigarh, Sangrur. 18 killa. Harvest 20 October, wheat by 9 November. 1 tractor, Super Seeder 2 din."


class NoFiler:
    def file(self, request):
        return {}


def session(**profile):
    s = KisanSession(filer=NoFiler(), weather=None, today=lambda: date(2026, 10, 8))
    s.begin_turn(SAID)
    s.update(**profile)
    return s


def test_nearest_first_within_15_km():
    out = session(village="Bhawanigarh", district="Sangrur").chcs_near()
    assert [(c["chc_id"], c["distance_km"]) for c in out["chcs"]] == [("demo-chc-a", 2.0), ("demo-chc-b", 6.0)]
    assert out["located_by"] == "village"
    a = out["chcs"][0]
    assert a["phone"] == "+91 00000 00001"
    assert {m["machine"]: m["cost_per_acre_inr"] for m in a["machines"]} == {"super_seeder": 1000, "happy_seeder": 750}


def test_one_machine_only():
    out = session(village="Bhawanigarh", district="Sangrur").chcs_near("happy_seeder")
    assert all(m["machine"] == "happy_seeder" for c in out["chcs"] for m in c["machines"])


def test_free_days_once_dates_are_known():
    s = session(village="Bhawanigarh", district="Sangrur", harvest_date="2026-10-20", wheat_deadline="2026-11-09")
    a = s.chcs_near("super_seeder")["chcs"][0]["machines"][0]
    assert (a["free_days"], a["first_free"]) == (1, "2026-11-02")


def test_district_centre_is_flagged_as_rough():
    out = session(village="Somewhere new", district="Sangrur").chcs_near()
    assert out["located_by"] == "district" and "rough" in out["note"]


def test_needs_a_place_and_a_known_machine():
    assert "village or district" in session().chcs_near()["error"]
    assert "unknown machine" in session(district="Sangrur").chcs_near("combine")["error"]


def test_api():
    client = TestClient(app)
    res = client.get("/v1/chcs", params={"village": "Bhawanigarh", "machine": "happy_seeder"}).json()
    assert [c["chc_id"] for c in res["chcs"]] == ["demo-chc-a", "demo-chc-b"] and res["demo_data"] is True
    assert client.get("/v1/chcs", params={"machine": "combine", "district": "Sangrur"}).status_code == 422
    assert client.get("/v1/chcs").status_code == 422


def test_api_counts_free_days_in_the_farmers_season():
    client = TestClient(app)
    season = {"harvest_date": "2026-10-20", "wheat_deadline": "2026-11-09"}
    res = client.get("/v1/chcs", params={"village": "Bhawanigarh", "machine": "super_seeder", **season}).json()
    seeder = res["chcs"][0]["machines"][0]
    assert seeder["free_days"] == 1 and seeder["first_free"] == "2026-11-02"  # booked either side of 2 Nov
    happy = client.get("/v1/chcs", params={"village": "Bhawanigarh", "machine": "happy_seeder", **season}).json()
    assert [m["free_days"] for c in happy["chcs"] for m in c["machines"]] == [0, 0]
    assert client.get("/v1/chcs", params={"village": "Bhawanigarh", "harvest_date": "2026-10-20"}).status_code == 422
    assert client.get("/v1/chcs", params={"village": "Bhawanigarh", "harvest_date": "2026-11-09",
                                          "wheat_deadline": "2026-10-20"}).status_code == 422
