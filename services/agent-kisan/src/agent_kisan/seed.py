"""Loads CHCs and village locations from data/seed (demo data until KVK figures come in)."""

import json
import os
from collections import Counter
from datetime import date, timedelta
from functools import cache
from pathlib import Path

from agent_kisan.planner import Chc, ChcMachine

def repo_root() -> Path:
    """The nearest folder above this file that has data/seed (the repo, when run from a checkout)."""
    here = Path(__file__).resolve()
    return next((p for p in here.parents if (p / "data" / "seed").is_dir()), here.parent)


def seed_path() -> Path:
    if env := os.environ.get("KISAN_CHC_SEED"):
        return Path(env)
    return repo_root() / "data" / "seed" / "chc_demo.json"


def load_seed(path: Path | None = None) -> tuple[tuple[Chc, ...], dict[str, tuple[float, float]], bool]:
    """CHCs, village name → (lat, lon), and whether the data is demo data."""
    return _load(path or seed_path())


@cache
def _load(path: Path) -> tuple[tuple[Chc, ...], dict[str, tuple[float, float]], bool]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    chcs = tuple(_chc(c) for c in raw["chcs"])
    villages = {v["name"].strip().lower(): (v["lat"], v["lon"]) for v in raw.get("villages", [])}
    return chcs, villages, bool(raw.get("demo"))


def load_districts(path: Path | None = None) -> dict[str, tuple[float, float]]:
    """District name → (lat, lon) of its centre, the last-resort farm location."""
    raw = json.loads((path or seed_path()).read_text(encoding="utf-8"))
    return {d["name"].strip().lower(): (d["lat"], d["lon"]) for d in raw.get("districts", [])}


def _chc(c: dict) -> Chc:
    return Chc(
        id=c["id"], name=c["name"], village=c["village"], district=c["district"],
        lat=c["lat"], lon=c["lon"], phone=c["phone"], subsidy_fraction=c.get("subsidy_fraction", 0.0),
        machines=tuple(
            ChcMachine(type=m["type"], units=m["units"], rate_per_acre_inr=m["rate_per_acre_inr"],
                       booked=_booked(m.get("booked", [])))
            for m in c["machines"]
        ),
    )


def _booked(entries: list[str]) -> dict[date, int]:
    """Each entry books one unit: "YYYY-MM-DD" for a day, "YYYY-MM-DD/YYYY-MM-DD" for a range (inclusive)."""
    counts: Counter[date] = Counter()
    for entry in entries:
        start, _, end = entry.partition("/")
        first, last = date.fromisoformat(start), date.fromisoformat(end or start)
        for d in range((last - first).days + 1):
            counts[first + timedelta(d)] += 1
    return dict(counts)
