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


# ---- every error is P4's ErrorEnvelope ----

def test_errors_have_one_shape():
    from fastapi.testclient import TestClient

    from agent_kisan import api

    client = TestClient(api.app)
    bad = client.post("/v1/farm/coverage", json={"paddy": {"value": -1, "unit": "killa"}, "window_days": 20,
                                                 "machines": []})
    assert bad.status_code == 422
    error = bad.json()["error"]
    assert error["code"] == "invalid_request" and error["message"].startswith("body.paddy.value")
    assert error["details"] == [{"field": "body.paddy.value", "problem": "Input should be greater than or equal to 0"}]

    missing = client.get("/v1/agent/kisan/sessions/nope/status")
    assert missing.status_code == 404 and missing.json() == {"error": {"code": "not_found", "message": "unknown session_id"}}

    nothing = client.get("/v1/nothing-here")
    assert nothing.status_code == 404 and nothing.json()["error"]["code"] == "not_found"

    wrong_method = client.delete("/v1/farm/coverage")
    assert wrong_method.status_code == 405 and wrong_method.json()["error"]["code"] == "invalid_request"


def test_error_codes_are_p4s(spec):
    """Kisan's ErrorCode list matches P4's, and every error response points at P4's ErrorEnvelope."""
    import re
    import typing

    from agent_kisan.api import ERROR_CODES
    from agent_kisan.schemas import ErrorCode

    p4 = (contract.PROPOSAL.parent / "p4-command.openapi.yaml").read_text(encoding="utf-8")
    block = p4.split("    ErrorCode:")[1].split("    ErrorDetail:")[0]
    p4_codes = re.findall(r"^\s+- (\w+)$", block, re.M)
    assert sorted(typing.get_args(ErrorCode)) == sorted(p4_codes)
    assert set(ERROR_CODES.values()) <= set(p4_codes)
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            for code, response in op["responses"].items():
                media = response.get("content", {}).get("application/json")
                if media and not code.startswith("2"):
                    assert media["schema"] == {"$ref": contract.P4_ERROR}, f"{method.upper()} {path} {code}"
                    assert set(media["example"]) == {"error"}
