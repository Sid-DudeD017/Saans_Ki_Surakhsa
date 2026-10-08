"""Writes the latest simulated-farmer results into the README (Sunday task).

    uv run python scripts/eval_to_readme.py                 # newest evals/results/*/summary.json
    uv run python scripts/eval_to_readme.py path/to/summary.json

Replaces only the text between the EVAL RESULTS markers in README.md.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
README = HERE / "README.md"
START, END = "<!-- EVAL RESULTS START -->", "<!-- EVAL RESULTS END -->"
SLOT_NAMES = {"village": "Village", "district": "District", "paddy_acres": "Paddy area", "harvest_date": "Harvest date",
              "wheat_deadline": "Wheat deadline", "tractors": "Tractors", "machines": "Machines and days",
              "decomposer_acres": "Decomposer acres"}
LANGUAGES = {"pa": "Punjabi", "hi": "Hindi", "en": "English", "mixed": "Mixed"}


def render(summary: dict, source: str) -> str:
    pct = lambda x: f"{x * 100:.0f}%"  # noqa: E731
    lines = [
        f"Simulated farmers: **{summary['cases']}** (`{source}`).",
        "",
        "| Measure | Result |",
        "|---|---|",
        f"| Details recorded correctly | {pct(summary['slot_accuracy'])} |",
        f"| Filed with every detail right | {pct(summary['filed_correct_rate'])} |",
        f"| Filed with a wrong detail | {summary['filed_wrong']} of {summary['cases']} |",
        f"| Coverage error when filed | {summary['coverage_error_mean']} points |",
        f"| Turns to file (median) | {summary['turns_median']} |",
        f"| Asked for Aadhaar, bank or land records | {summary['asked_forbidden']} |",
        f"| Conversations that crashed | {summary['errors']} |",
        "",
        "| Detail | Right |",
        "|---|---|",
        *[f"| {SLOT_NAMES.get(k, k)} | {pct(v)} |" for k, v in summary["per_slot"].items()],
        "",
        "| Farmers speaking | Cases | Details right | Filed right |",
        "|---|---|---|---|",
        *[f"| {LANGUAGES[t]} | {v['cases']} | {pct(v['slot_accuracy'])} | {pct(v['filed_correct_rate'])} |"
          for t, v in summary.get("by_tag", {}).items() if t in LANGUAGES],
    ]
    if usage := summary.get("usage"):
        lines += ["", "Tokens: agent " + ", ".join(f"{k} {v:,}" for k, v in usage["agent"].items())
                  + "; farmer " + ", ".join(f"{k} {v:,}" for k, v in usage["farmer"].items()) + "."]
    return "\n".join(lines)


def update(readme: str, block: str) -> str:
    if START not in readme or END not in readme:
        raise SystemExit(f"README.md needs the {START} and {END} markers")
    head, rest = readme.split(START, 1)
    _, tail = rest.split(END, 1)
    return f"{head}{START}\n{block}\n{END}{tail}"


def main(argv: list[str]) -> None:
    if argv:
        path = Path(argv[0])
    else:
        runs = sorted((HERE / "evals" / "results").glob("*/summary.json"))
        if not runs:
            raise SystemExit("no results yet: run `python -m agent_kisan.evals --n 20` first")
        path = runs[-1]
    summary = json.loads(path.read_text(encoding="utf-8"))
    source = str(path.relative_to(HERE)) if path.is_relative_to(HERE) else str(path)
    README.write_text(update(README.read_text(encoding="utf-8"), render(summary, source)), encoding="utf-8")
    print(f"README.md updated from {source}")


if __name__ == "__main__":
    main(sys.argv[1:])
