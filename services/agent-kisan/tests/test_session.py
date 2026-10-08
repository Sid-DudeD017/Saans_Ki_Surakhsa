"""The filing rules and slot handling, without calling the model."""

import json
from datetime import date

import pytest

from agent_kisan.filing import OutboxFiler
from agent_kisan.session import KisanSession

GURPREET = dict(
    village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa", variety="PR-126",
    harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2},
)


GURPREET_SAYS = ("Bhawanigarh, Sangrur. 18 killa PR-126. Harvest 20 October, wheat by 9 November. "
                 "1 tractor, Super Seeder 2 din.")


class ListFiler:
    def __init__(self):
        self.filed = []

    def file(self, request):
        self.filed.append(request)
        return {"via": "test", "n": len(self.filed)}


@pytest.fixture
def s():
    session = KisanSession(filer=ListFiler(), rain_dates={date(2026, 10, 27), date(2026, 10, 28)}, weather=None,
                           today=lambda: date(2026, 10, 8))
    session.begin_turn(GURPREET_SAYS)
    return session


def test_missing_until_everything_is_in(s):
    out = s.update(village="Bhawanigarh", paddy_area=18)
    assert out["missing"] == ["district", "harvest_date", "wheat_deadline", "tractors", "machines"]
    assert s.coverage()["error"] == "missing details"


def test_no_machines_is_an_answer(s):
    s.update(**{**GURPREET, "machines": {}})
    assert s.profile.missing() == []
    assert s.coverage()["gap_acres"] == 18


def test_gurpreet_coverage(s):
    s.update(**GURPREET)
    c = s.coverage()
    assert (c["coverage_pct"], c["gap_acres"], c["straw_t"], c["pm25_kg"]) == (61, 7, 17.5, 140)


def test_bad_values_come_back_as_errors(s):
    out = s.update(harvest_date="after Diwali", machines={"combine": 2}, tractors=1.5, paddy_unit="marla")
    assert set(out["errors"]) == {"harvest_date", "machines", "tractors", "paddy_unit"}
    assert s.profile.harvest_date is None


def test_deadline_before_harvest(s):
    s.update(**{**GURPREET, "wheat_deadline": "2026-10-01"})
    assert "before the harvest" in s.coverage()["error"]


def test_cannot_file_without_readback(s):
    s.update(**GURPREET)
    assert "read the details back" in s.file_report()["error"]
    assert s.filer.filed == []


def test_cannot_file_in_the_same_turn_as_the_readback(s):
    s.update(**GURPREET)
    s.prepare_readback()
    assert "next message" in s.file_report()["error"]


def test_cannot_file_if_details_changed_after_readback(s):
    s.update(**GURPREET)
    s.prepare_readback()
    s.begin_turn()
    s.update(tractors=2)
    assert "changed" in s.file_report()["error"]


def test_files_after_confirmation_once(s):
    s.update(**GURPREET)
    s.prepare_readback()
    s.begin_turn()  # the farmer says "haan"
    out = s.file_report()
    assert out["filed"] and out["gap_acres"] == 7
    req = s.filer.filed[0]
    assert req["type"] == "support_request"
    assert req["idempotency_key"] == s.session_id
    assert req["farm"]["machines"] == [{"type": "super_seeder", "days": 2.0}]
    assert [(b["date"], b["machine"], b["chc_id"], b["acres"]) for b in req["plan"]] == [
        ("2026-11-02", "super_seeder", "demo-chc-a", 5.5)
    ]
    assert req["unmet"] == [{"machine": "happy_seeder", "days": 1, "acres": 1.5, "latest_date": "2026-11-09"}]
    assert s.file_report()["error"] == "already filed"
    assert len(s.filer.filed) == 1


def test_outbox_filer(tmp_path):
    path = tmp_path / "outbox.jsonl"
    receipt = OutboxFiler(path).file({"type": "support_request", "farm": {"village": "ਭਵਾਨੀਗੜ੍ਹ"}})
    assert receipt["via"] == "outbox"
    assert json.loads(path.read_text())["farm"]["village"] == "ਭਵਾਨੀਗੜ੍ਹ"


def test_agent_builds_with_its_tools(s):
    from agent_kisan.agent import build_agent

    agent = build_agent(s)
    assert set(agent.tool_names) == {
        "update_farm_profile", "get_farm_profile", "estimate_coverage", "get_rain_days", "find_chc",
        "plan_zero_burn", "prepare_readback", "file_resource_gap_report",
    }


def test_plan_takes_gurpreet_from_61_to_92(s):
    s.update(**GURPREET)
    plan = s.plan()
    assert plan["coverage_after_pct"] == 92
    assert plan["cost_inr"] == 5500
    assert plan["chcs_considered"] == ["demo-chc-a", "demo-chc-b"]


def test_readback_includes_the_plan(s):
    s.update(**GURPREET)
    assert s.prepare_readback()["zero_burn_plan"]["plan"][0]["date"] == "2026-11-02"


def test_rain_counts_against_own_machines(s):
    s.update(**{**GURPREET, "machines": {"super_seeder": 20}})
    assert s.coverage()["tractor_days_available"] == 18  # 20-day window, 2 rain days


def test_gps_location_beats_village_lookup(s):
    s.update(**GURPREET)
    s.profile.lat, s.profile.lon = 30.041, 76.040  # standing next to demo CHC C
    assert s.plan()["chcs_considered"] == ["demo-chc-c"]  # A and B are ~25 km from here


def test_without_chc_data_the_whole_gap_is_filed(s, monkeypatch, tmp_path):
    monkeypatch.setenv("KISAN_CHC_SEED", str(tmp_path / "missing.json"))
    s.update(**GURPREET)
    assert "planner unavailable" in s.plan()["error"]
    s.prepare_readback()
    s.begin_turn()
    s.file_report()
    req = s.filer.filed[0]
    assert req["plan"] == []
    assert req["unmet"] == [{"machine": None, "days": None, "acres": 7.0, "latest_date": "2026-11-09"}]
