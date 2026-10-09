"""POST /v1/agent/kisan/messages, with a stand-in for the model."""

import pytest
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient

from agent_kisan import api
from agent_kisan.session import KisanSession


class FakeChat:
    """Records Gurpreet's details on the first message, like the agent's tool call would."""

    def __init__(self, language):
        self.session = KisanSession(filer=None, language=language)
        self.raise_error = False

    def send(self, text):
        if self.raise_error:
            raise ClientError({"Error": {"Code": "AccessDeniedException", "Message": "being verified"}}, "Converse")
        self.session.begin_turn(text)
        if self.session.turn == 1:
            self.session.update(village="Bhawanigarh", district="Sangrur", paddy_area=18)
        return f"reply {self.session.turn} to {text}"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api, "chat_factory", FakeChat)
    return TestClient(api.app)


def test_new_conversation_then_continue(client):
    first = client.post("/v1/agent/kisan/messages", json={"text": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ"}).json()
    assert first["reply"] == "reply 1 to ਸਤ ਸ੍ਰੀ ਅਕਾਲ"
    assert first["missing"] == ["harvest_date", "wheat_deadline", "tractors", "machines"]
    assert first["filed"] is False
    # 18 was recorded but never said, so the app gets a button for it
    assert first["quick_replies"] == [
        {"slot": "paddy_area", "value": 18, "label": "18 ਏਕੜ", "send_text": "18 ਏਕੜ"}
    ]

    second = client.post("/v1/agent/kisan/messages", json={"session_id": first["session_id"], "text": "hor"}).json()
    assert second["session_id"] == first["session_id"]
    assert second["reply"] == "reply 2 to hor"

    tapped = client.post("/v1/agent/kisan/messages",
                         json={"session_id": first["session_id"], "text": first["quick_replies"][0]["send_text"]})
    assert tapped.json()["quick_replies"] == []


def test_language_is_passed_on(client):
    sid = client.post("/v1/agent/kisan/messages", json={"text": "namaste", "language": "hi"}).json()["session_id"]
    assert api._chats[sid].session.language == "hi"


def test_unknown_session(client):
    res = client.post("/v1/agent/kisan/messages", json={"session_id": "nope", "text": "hi"})
    assert res.status_code == 404


def test_empty_text(client):
    assert client.post("/v1/agent/kisan/messages", json={"text": ""}).status_code == 422


def test_model_unavailable_is_a_503(client):
    sid = client.post("/v1/agent/kisan/messages", json={"text": "hi"}).json()["session_id"]
    api._chats[sid].raise_error = True
    res = client.post("/v1/agent/kisan/messages", json={"session_id": sid, "text": "again"})
    assert res.status_code == 503
    assert "being verified" in res.json()["error"]["message"]
    api._chats[sid].raise_error = False
    assert client.post("/v1/agent/kisan/messages", json={"session_id": sid, "text": "ok"}).status_code == 200


GURPREET_FARM = {"lat": 30.27, "lon": 76.04, "paddy_acres": 18, "tractors": 1, "harvest_date": "2026-10-20",
                 "wheat_deadline": "2026-11-09", "machines": {"super_seeder": 2}}


def test_farm_from_the_app_fills_a_new_conversation(client):
    res = client.post("/v1/agent/kisan/messages", json={"text": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", "farm": GURPREET_FARM}).json()
    p = api._chats[res["session_id"]].session.profile
    assert (p.lat, p.lon, p.tractors, p.machines) == (30.27, 76.04, 1, {"super_seeder": 2.0})
    assert str(p.harvest_date) == "2026-10-20" and str(p.wheat_deadline) == "2026-11-09"
    # The fake agent records 18 acres, the same as the farm card, so nothing needs a tap.
    assert res["missing"] == []
    assert res["quick_replies"] == []


def test_farm_hint_fills_only_empty_slots_and_trust_ends_when_a_number_changes(client):
    res = client.post("/v1/agent/kisan/messages", json={"text": "hi", "farm": {**GURPREET_FARM, "paddy_acres": 20}}).json()
    session = api._chats[res["session_id"]].session
    # The agent's own update (18, never said) wins over the app's 20, so the guard asks about it.
    assert session.profile.paddy_area == 18
    assert [q["slot"] for q in res["quick_replies"]] == ["paddy_area"]
    session.update(tractors=2)  # changed in the conversation: no longer the app's number
    assert "tractors" in [u["slot"] for u in session.unsure()]


def test_farm_hint_ignored_on_later_messages_and_checked(client):
    sid = client.post("/v1/agent/kisan/messages", json={"text": "hi"}).json()["session_id"]
    client.post("/v1/agent/kisan/messages", json={"session_id": sid, "text": "hor", "farm": GURPREET_FARM})
    assert api._chats[sid].session.profile.tractors is None
    bad = client.post("/v1/agent/kisan/messages", json={"text": "hi", "farm": {"machines": {"combine": 2}}})
    assert bad.status_code == 422
