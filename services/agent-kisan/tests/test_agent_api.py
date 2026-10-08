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
    assert "being verified" in res.json()["detail"]
    api._chats[sid].raise_error = False
    assert client.post("/v1/agent/kisan/messages", json={"session_id": sid, "text": "ok"}).status_code == 200
