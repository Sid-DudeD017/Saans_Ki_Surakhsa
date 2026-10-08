"""Scores real voice notes: did speech recognition plus the number parser catch each true detail?

This tests the ears, not the agent: it needs no Bedrock. A number counts only if it was heard as
the right kind of thing (18 next to ਕਿੱਲੇ for the area, 2 next to ਦਿਨ for machine days, or said
on its own). Numbers Whisper itself was unsure of are reported, because the number guard would
make the farmer confirm them.
"""

import csv
import statistics
from datetime import date
from pathlib import Path

from agent_kisan.evals.cases import PLACES
from agent_kisan.guard import _MONTHS
from agent_kisan.numbers import normalize, numbers_in, says_none

# The distinctive part of each machine's name: Whisper spells "seeder" many ways (सीधर, ਸੀਦਰ…).
MACHINE_WORDS = {
    "happy_seeder": {"happy", "ਹੈਪੀ", "हैप्पी", "हैपी"},
    "super_seeder": {"super", "ਸੁਪਰ", "ਸੁਬਰ", "सुपर"},
    "mulcher_rmb": {"mulch", "ਮਲਚਰ", "मल्चर"},
    "baler": {"baler", "bailer", "ਬੇਲਰ", "बेलर"},
}
# Month names, including how Whisper spells them in Hindi.
MONTH_WORDS = {i: {m[i - 1] for m in _MONTHS.values()} for i in range(1, 13)}
MONTH_WORDS[10] |= {"अक्तूबर", "अक्तोबर", "अक्टोबर", "oct", "ਅਕਤੁਬਰ"}
MONTH_WORDS[11] |= {"नवम्बर", "नवेंबर", "nov", "ਨਵਂਬਰ"}
MONTH_WORDS[12] |= {"दिसम्बर", "dec"}
MONTH_WORDS[9] |= {"सितम्बर", "sep", "sept"}
DETAILS = ("village", "district", "paddy_area", "variety", "harvest_date", "wheat_deadline", "tractors",
           "machines", "decomposer_acres")


def read_answers(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("file") or "").strip()]
    for r in rows:
        r["machines"] = _machines(r.get("machines", ""))
    return rows


def score_transcript(text: str, truth: dict, unsure: frozenset[float] = frozenset()) -> dict:
    """{detail: True / False / "check by hand" / None (not in this note)} plus the doubtful numbers."""
    mentions = numbers_in(text)
    flat = normalize(text).replace(" ", "")

    def heard(value, kind):
        return any(abs(m.value - value) < 0.01 and m.kind in (kind, None) for m in mentions)

    def said(*names):
        return any(normalize(n).replace(" ", "") in flat for n in names if n)

    out = {}
    for name in ("village", "district"):
        value = (truth.get(name) or "").strip()
        aliases = _aliases(value)
        if not value:
            out[name] = None
        elif said(*aliases):
            out[name] = True
        else:  # a Latin spelling can't be found in a Gurmukhi transcript unless we know the place
            out[name] = False if any(_non_latin(a) for a in aliases) else "check by hand"
    area = _num(truth.get("paddy_area"))
    out["paddy_area"] = None if area is None else heard(area, "area")
    variety = (truth.get("variety") or "").strip()
    digits = "".join(c for c in variety if c.isdigit())
    out["variety"] = None if not variety else (heard(float(digits), None) or said(digits) if digits else said(variety))
    for name in ("harvest_date", "wheat_deadline"):
        day = _date(truth.get(name))
        out[name] = None if day is None else heard(day.day, "month") and said(*MONTH_WORDS[day.month])
    tractors = _num(truth.get("tractors"))
    out["tractors"] = None if tractors is None else (says_none(text) if tractors == 0 else heard(tractors, "tractors"))
    machines = truth.get("machines") or {}
    out["machines"] = (says_none(text) if not machines else
                       all(said(*MACHINE_WORDS.get(m, {m})) and heard(d, "days") for m, d in machines.items()))
    decomposer = _num(truth.get("decomposer_acres"))
    out["decomposer_acres"] = None if not decomposer else heard(decomposer, "area")

    true_numbers = [v for v in [area, tractors, decomposer, *machines.values()] if v]
    out["doubtful_numbers"] = sorted(v for v in unsure if any(abs(v - t) < 0.01 for t in true_numbers))
    return out


def summarize(results: list[dict]) -> dict:
    per_detail = {}
    for d in DETAILS:
        scored = [r["details"][d] for r in results if isinstance(r["details"].get(d), bool)]
        per_detail[d] = {"right": sum(scored), "of": len(scored)}
    scored = [v for r in results for d in DETAILS if isinstance(v := r["details"].get(d), bool)]
    seconds = [r["seconds"] for r in results if r.get("seconds") is not None]
    return {
        "notes": len(results),
        "details_right": round(sum(scored) / len(scored), 3) if scored else None,
        "per_detail": per_detail,
        "check_by_hand": sum(1 for r in results for d in DETAILS if r["details"].get(d) == "check by hand"),
        "notes_with_doubtful_true_numbers": sum(1 for r in results if r["details"].get("doubtful_numbers")),
        "seconds_mean": round(statistics.mean(seconds), 1) if seconds else None,
        "missing_audio": sum(1 for r in results if r.get("error")),
    }


def _aliases(value: str) -> list[str]:
    for _, district_aliases, villages in PLACES:
        if normalize(value) in {normalize(a) for a in district_aliases}:
            return list(district_aliases)
        for v in villages:
            if normalize(value) in {normalize(a) for a in v}:
                return list(v)
    return [value]


def _non_latin(text: str) -> bool:
    return any(ord(c) > 0x2FF for c in text)


def _machines(cell: str) -> dict[str, float]:
    out = {}
    for part in (cell or "").replace(",", ";").split(";"):
        if ":" in part:
            name, days = part.split(":", 1)
            out[name.strip().lower().replace(" ", "_")] = float(days)
    return out


def _num(cell) -> float | None:
    try:
        return float(cell) if str(cell).strip() != "" else None
    except ValueError:
        return None


def _date(cell) -> date | None:
    try:
        return date.fromisoformat(str(cell).strip()) if cell and str(cell).strip() else None
    except ValueError:
        return None
