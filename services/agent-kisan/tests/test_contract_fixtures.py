from agent_kisan.contract_fixtures import FIXTURE, render


def test_contract_fixture_is_up_to_date():
    assert FIXTURE.exists(), "run: uv run python -m agent_kisan.contract_fixtures"
    assert FIXTURE.read_text(encoding="utf-8") == render(), \
        "help_request.py changed; run: uv run python -m agent_kisan.contract_fixtures"
