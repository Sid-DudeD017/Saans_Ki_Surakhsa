"""P1's contract proposal and what Kisan files with Saans Command."""

import json

import httpx
import pytest

from agent_kisan import contract, filing
from agent_kisan.filing import HttpFiler, to_complaint
from agent_kisan.help_request import NoLocation
from agent_kisan.schemas import FarmerSupportComplaint


@pytest.fixture(scope="module")
def spec():
    return contract.build()


def test_proposal_is_up_to_date():
    assert contract.PROPOSAL.read_text(encoding="utf-8") == contract.render(), (
        "run: uv run python -m agent_kisan.contract")


def test_every_json_response_has_an_example(spec):
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            for code, response in op["responses"].items():
                media = response.get("content", {}).get("application/json")
                if media is not None:
                    assert "example" in media, f"{method.upper()} {path} {code}"


def test_follows_the_conventions(spec):
    text = json.dumps(spec)
    assert '"lng"' not in text and "longitude" not in text
    for times in ('"2026-10-20T18:02:00+05:30"', '"requiredFrom": "2026-10-20T00:00:00+05:30"'):
        assert times in text
    ops = [op["operationId"] for methods in spec["paths"].values() for op in methods.values()]
    assert len(ops) == len(set(ops)) and all("_v1_" not in o for o in ops)
    assert "/healthz" not in spec["paths"]


def test_complaint_example_is_p4s_complaint_input(spec):
    example = spec["components"]["schemas"]["FarmerSupportComplaint"]["examples"][0]
    FarmerSupportComplaint.model_validate(example)
    # P4's ComplaintInput: type from its enum, location in range, an evidence list
    assert example["type"] == "farmer_support" and example["evidence"] == []
    assert set(example["location"]) == {"lat", "lon"}
    assert example["help_request"]["uncoveredAcres"] == 1.5 and example["help_request"]["status"] == "OPEN"
    assert [u["machine"] for u in example["support_request"]["unmet"]] == ["happy_seeder"]
    assert example["support_request"]["nearby_fires"]["count"] == 2


def test_http_filer_posts_the_complaint(monkeypatch, spec):
    example = spec["components"]["schemas"]["FarmerSupportComplaint"]["examples"][0]
    request = {**example["support_request"], "help_request": example["help_request"]}
    sent = {}

    def post(url, json, headers, timeout):
        sent.update(url=url, json=json, headers=headers)
        return httpx.Response(201, json={"id": "c-1", "status": "received"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(filing.httpx, "post", post)
    receipt = HttpFiler("http://command.test/").file(request)
    assert sent["url"] == "http://command.test/v1/complaints"
    assert sent["headers"] == {"Idempotency-Key": request["idempotency_key"]}
    assert sent["json"] == to_complaint(request) and sent["json"]["type"] == "farmer_support"
    FarmerSupportComplaint.model_validate(sent["json"])
    assert receipt == {"via": "api", "status": 201, "body": {"id": "c-1", "status": "received"}}


def test_no_location_cannot_go_to_command():
    with pytest.raises(NoLocation, match="GPS"):
        to_complaint({"farm": {}, "help_request": None,
                      "help_request_error": "no farm location: send GPS from the app"})
