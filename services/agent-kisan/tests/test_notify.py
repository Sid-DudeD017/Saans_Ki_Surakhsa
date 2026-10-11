"""Request status and SMS: filing texts the farmer, Command's updates text the farmer, the status page."""

import json
from datetime import date

import pytest
from fastapi.testclient import TestClient

from agent_kisan import api
from agent_kisan.notify import OutboxNotifier, RequestStatus, masked, sms_text, valid_phone
from agent_kisan.session import KisanSession

SAID = "Bhawanigarh, Sangrur. 18 killa. Harvest 20 October, wheat by 9 November. 1 tractor, Super Seeder 2 din."
PHONE = "+919876543210"


class Texts:
    def __init__(self):
        self.sent = []

    def send(self, phone, text):
        self.sent.append((phone, text))
        return {"via": "test"}


class FilingChat:
    """Records Gurpreet, reads back on turn 1, files on turn 2 (the farmer's yes)."""

    def __init__(self, language):
        self.session = KisanSession(filer=type("F", (), {"file": lambda self, r: {"via": "test"}})(),
                                    language=language, weather=None, today=lambda: date(2026, 10, 8),
                                    rain_dates={date(2026, 10, 27), date(2026, 10, 28)})

    def send(self, text, distrust=frozenset()):
        s = self.session
        s.begin_turn(text, distrust)
        if s.turn == 1:
            s.update(village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa",
                     harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2})
            s.prepare_readback()
            return "please confirm"
        s.file_report()
        return "filed"


@pytest.fixture
def setup(monkeypatch):
    texts = Texts()
    monkeypatch.setattr(api, "chat_factory", FilingChat)
    monkeypatch.setattr(api, "notifier_factory", lambda: texts)
    monkeypatch.setattr(api, "speaker_factory", lambda: (_ for _ in ()).throw(ImportError("no voice in tests")))
    monkeypatch.setenv("KISAN_SERVICE_TOKEN", "s3cret")
    client = TestClient(api.app)
    first = client.post("/v1/agent/kisan/messages", json={"text": SAID, "farmer_phone": PHONE}).json()
    client.post("/v1/agent/kisan/messages", json={"session_id": first["session_id"], "text": "ਹਾਂ ਜੀ"})
    return client, texts, first["session_id"]


def test_filing_texts_the_farmer(setup):
    client, texts, sid = setup
    assert texts.sent == [(PHONE, "ਸਾਂਸ: ਤੁਹਾਡੀ ਮਦਦ ਦੀ ਬੇਨਤੀ ਖੇਤੀਬਾੜੀ ਵਿਭਾਗ ਕੋਲ ਪਹੁੰਚ ਗਈ ਹੈ। ਬਾਕੀ 1.5 ਏਕੜ।")]
    page = client.get(f"/v1/agent/kisan/sessions/{sid}/status").json()
    assert page["current"] == "filed" and page["helpRequestId"] == f"kisan-{sid}"
    assert page["history"][0]["sms"]["to"] == "+91******3210"  # never the full number


def test_command_assigns_a_machine_and_the_farmer_gets_a_text(setup):
    client, texts, sid = setup
    headers = {"X-Saans-Service-Token": "s3cret"}
    seen = client.post(f"/v1/agent/kisan/help-requests/kisan-{sid}/status", json={"status": "seen"}, headers=headers)
    assert seen.status_code == 200 and len(texts.sent) == 1  # "seen" is page-only
    res = client.post(f"/v1/agent/kisan/help-requests/kisan-{sid}/status", headers=headers, json={
        "status": "machine_assigned", "machineType": "Happy Seeder", "chcName": "Bhaini CHC",
        "chcPhone": "+91 00000 00009", "date": "2026-11-03"})
    assert res.status_code == 200
    assert texts.sent[-1][1] == "ਸਾਂਸ: ਹੈਪੀ ਸੀਡਰ 3 ਨਵੰਬਰ ਨੂੰ Bhaini CHC ਤੋਂ ਆਵੇਗਾ। ਫ਼ੋਨ +91 00000 00009"
    page = client.get(f"/v1/agent/kisan/sessions/{sid}/status").json()
    assert [h["status"] for h in page["history"]] == ["filed", "seen", "machine_assigned"]


def test_status_updates_need_the_service_token(setup, monkeypatch):
    client, _, sid = setup
    url = f"/v1/agent/kisan/help-requests/kisan-{sid}/status"
    assert client.post(url, json={"status": "seen"}).status_code == 401
    assert client.post(url, json={"status": "seen"}, headers={"X-Saans-Service-Token": "guess"}).status_code == 401
    assert client.post("/v1/agent/kisan/help-requests/kisan-nope/status", json={"status": "seen"},
                       headers={"X-Saans-Service-Token": "s3cret"}).status_code == 404
    monkeypatch.delenv("KISAN_SERVICE_TOKEN")
    assert client.post(url, json={"status": "seen"}, headers={"X-Saans-Service-Token": "s3cret"}).status_code == 503


def test_bad_phone_is_rejected():
    client = TestClient(api.app)
    assert client.post("/v1/agent/kisan/messages", json={"text": "hi", "farmer_phone": "98765"}).status_code == 422


def test_a_failed_sms_keeps_the_status():
    class Broken:
        def send(self, phone, text):
            raise RuntimeError("SMS sandbox: number not verified")

    status = RequestStatus()
    entry = status.record("action_taken", "hi", PHONE, Broken())
    assert status.current == "action_taken" and "not verified" in entry["sms"]["error"]


def test_no_phone_no_text_and_templates():
    status, texts = RequestStatus(), Texts()
    status.record("filed", "pa", None, texts, acres="7")
    assert texts.sent == [] and status.current == "filed"
    assert sms_text("machine_assigned", "hi", machine="सुपर सीडर", chc="CHC A", date="2 नवंबर", chc_phone="+91 1") == \
        "साँस: सुपर सीडर 2 नवंबर को CHC A से आएगा। फ़ोन +91 1"
    with pytest.raises(ValueError):
        status.record("teleported", "pa", None, texts)


def test_outbox_and_phone_helpers(tmp_path):
    receipt = OutboxNotifier(tmp_path / "sms.jsonl").send(PHONE, "ਸਾਂਸ")
    assert receipt["via"] == "outbox" and json.loads((tmp_path / "sms.jsonl").read_text())["text"] == "ਸਾਂਸ"
    assert valid_phone(PHONE) and not valid_phone("+915876543210") and not valid_phone("9876543210")
    assert masked(PHONE) == "+91******3210"
