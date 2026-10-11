"""Bedrock by default; Anthropic's API when ANTHROPIC_API_KEY is set (accounts where Bedrock won't serve Claude)."""

import base64
from types import SimpleNamespace

import anthropic
from strands.models import BedrockModel
from strands.models.anthropic import AnthropicModel

from agent_kisan.agent import DEFAULT_ANTHROPIC_MODEL, DEFAULT_MODEL_ID, default_model
from agent_kisan.photo import identify_machine


def test_bedrock_without_a_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("KISAN_MODEL_ID", raising=False)
    model = default_model()
    assert isinstance(model, BedrockModel)
    assert model.config["model_id"] == DEFAULT_MODEL_ID


def test_anthropic_api_with_a_key(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.delenv("KISAN_ANTHROPIC_MODEL", raising=False)
    model = default_model()
    assert isinstance(model, AnthropicModel)
    assert model.config["model_id"] == DEFAULT_ANTHROPIC_MODEL
    assert model.client.api_key == "test-key"

    monkeypatch.setenv("KISAN_ANTHROPIC_MODEL", "claude-sonnet-5-5")
    assert default_model().config["model_id"] == "claude-sonnet-5-5"


def test_photo_check_uses_the_anthropic_api_with_a_key(monkeypatch):
    sent = {}

    class FakeAnthropic:
        def __init__(self, api_key):
            sent["api_key"] = api_key
            self.messages = SimpleNamespace(create=self.create)

        def create(self, **kwargs):
            sent.update(kwargs)
            return SimpleNamespace(content=[SimpleNamespace(type="text", text='{"machine": "baler", "confidence": 0.8, "why": "bales"}')])

    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.delenv("KISAN_ANTHROPIC_MODEL", raising=False)
    monkeypatch.setattr(anthropic, "Anthropic", FakeAnthropic)

    out = identify_machine(b"jpeg-bytes")
    assert out == {"machine": "baler", "confidence": 0.8, "why": "bales"}
    assert sent["api_key"] == "test-key"
    assert sent["model"] == DEFAULT_ANTHROPIC_MODEL
    image = sent["messages"][0]["content"][0]
    assert image["source"] == {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(b"jpeg-bytes").decode()}
