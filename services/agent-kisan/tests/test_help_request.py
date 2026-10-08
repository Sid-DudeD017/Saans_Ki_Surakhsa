"""Kisan's filing in Saans Command's HelpRequest shape (P4's src/domain/schemas/index.ts)."""

import re
from datetime import date

from agent_kisan.session import KisanSession

GURPREET = dict(
    village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa", variety="PR-126",
    harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2},
)
SAID = "Bhawanigarh, Sangrur. 18 killa. Harvest 20 October, wheat by 9 November. 1 tractor, Super Seeder 2 din."
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+05:30$")  # what zod's .datetime() accepts by default


class ListFiler:
    def __init__(self):
        self.filed = []

    def file(self, request):
        self.filed.append(request)
        return {"via": "test"}


def file_for(said=SAID, **changes):
    s = KisanSession(filer=ListFiler(), weather=None, today=lambda: date(2026, 10, 8),
                     rain_dates={date(2026, 10, 27), date(2026, 10, 28)})
    s.begin_turn(said)
    s.update(**{**GURPREET, **changes.pop("profile", {})})
    for k, v in changes.items():
        setattr(s, k, v)
    s.prepare_readback()
    s.begin_turn("haan")
    s.file_report()
    return s.filer.filed[0]


def assert_matches_p4_schema(h):
    """Mirrors HelpRequestSchema field by field."""
    assert isinstance(h["id"], str) and isinstance(h["farmerId"], str)
    assert set(h["farmLocation"]) == {"lat", "lon"} and all(isinstance(v, float) for v in h["farmLocation"].values())
    assert isinstance(h["district"], str) and isinstance(h["crop"], str) and isinstance(h["machineType"], str)
    for k in ("acreage", "coveragePercent", "uncoveredAcres"):
        assert isinstance(h[k], (int, float)) and not isinstance(h[k], bool)
    assert ISO.match(h["requiredFrom"]) and ISO.match(h["requiredUntil"])
    assert h["status"] in {"OPEN", "MATCHED", "FULFILLED", "EXPIRED"}


def test_gurpreet_as_a_help_request():
    h = file_for()["help_request"]
    assert_matches_p4_schema(h)
    assert h["farmLocation"] == {"lat": 30.266, "lon": 76.04} and h["locationSource"] == "village"
    assert (h["district"], h["crop"], h["acreage"]) == ("Sangrur", "Paddy", 18)
    assert h["machineType"] == "Happy Seeder"
    assert (h["requiredFrom"], h["requiredUntil"]) == ("2026-10-20T00:00:00+05:30", "2026-11-09T00:00:00+05:30")
    assert (h["coveragePercent"], h["uncoveredAcres"], h["ownCoveragePercent"]) == (92, 1.5, 61)
    assert h["status"] == "OPEN"
    assert h["plannedBookings"][0]["machine"] == "Super Seeder"


def test_farmer_id_comes_from_sign_in_when_there_is_one():
    assert file_for(farmer_id="cognito-sub-123")["help_request"]["farmerId"] == "cognito-sub-123"


def test_gps_beats_village():
    req = file_for(profile={"lat": 30.27, "lon": 76.05})
    assert req["help_request"]["locationSource"] == "gps"
    assert req["help_request"]["farmLocation"] == {"lat": 30.27, "lon": 76.05}


def test_unknown_village_falls_back_to_the_district_centre():
    h = file_for(profile={"village": "Somewhere new"})["help_request"]
    assert h["locationSource"] == "district" and h["farmLocation"] == {"lat": 30.2458, "lon": 75.8421}


def test_fully_booked_plan_is_matched():
    said = SAID.replace("Super Seeder 2 din", "Super Seeder 3 din")
    h = file_for(said, profile={"machines": {"super_seeder": 3}})["help_request"]  # 16.5 own + 1.5 from CHC A
    assert h["uncoveredAcres"] == 0 and h["status"] == "MATCHED" and h["coveragePercent"] == 100


def test_no_location_at_all_still_files_with_a_reason():
    req = file_for(profile={"village": "Somewhere new", "district": "Nowhere"})
    assert req["help_request"] is None
    assert "no farm location" in req["help_request_error"]
