import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("eval_to_readme", Path(__file__).parent.parent / "scripts" / "eval_to_readme.py")
etr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(etr)

SUMMARY = {"cases": 20, "slot_accuracy": 0.9375, "filed_correct_rate": 0.75, "filed_wrong": 0,
           "coverage_error_mean": 0.0, "turns_median": 6, "asked_forbidden": 0, "errors": 1,
           "per_slot": {"village": 1.0, "tractors": 0.85},
           "by_tag": {"pa": {"cases": 9, "slot_accuracy": 0.9, "filed_correct_rate": 0.67}, "unit:killa": {}},
           "usage": {"agent": {"inputTokens": 120000, "outputTokens": 9000}, "farmer": {"inputTokens": 40000, "outputTokens": 3000}}}


def test_render_and_replace_only_between_markers():
    block = etr.render(SUMMARY, "evals/results/x/summary.json")
    assert "| Details recorded correctly | 94% |" in block and "| Punjabi | 9 | 90% | 67% |" in block
    assert "unit:killa" not in block and "inputTokens 120,000" in block
    readme = f"intro\n{etr.START}\nold\n{etr.END}\noutro\n"
    out = etr.update(readme, block)
    assert out.startswith("intro\n") and out.endswith("\noutro\n") and "old" not in out
    assert etr.update(out, "again").count(etr.START) == 1


def test_markers_are_required():
    with pytest.raises(SystemExit):
        etr.update("no markers here", "x")


def test_the_real_readme_has_the_markers():
    text = etr.README.read_text(encoding="utf-8")
    assert etr.START in text and etr.END in text
