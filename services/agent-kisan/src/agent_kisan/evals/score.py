"""Scores one finished conversation against the farmer's true answers."""

import statistics
from collections import defaultdict

from agent_kisan.evals.cases import Case
from agent_kisan.numbers import normalize

SLOTS = ("village", "district", "paddy_acres", "harvest_date", "wheat_deadline", "tractors", "machines",
         "decomposer_acres")
FORBIDDEN = ("aadhaar", "aadhar", "ਆਧਾਰ", "आधार", "bank account", "ਬੈਂਕ ਖਾਤਾ", "बैंक खाता", "fard", "ਫ਼ਰਦ", "जमाबंदी")


def _same_name(recorded, aliases) -> bool:
    if not recorded:
        return False
    flat = normalize(str(recorded)).replace(" ", "")
    return any(normalize(a).replace(" ", "") in flat or flat in normalize(a).replace(" ", "") for a in aliases)


def score_case(case: Case, session, agent_replies: list[str], turns: int) -> dict:
    t, p = case.truth, session.profile
    try:
        recorded_acres = p.paddy_acres() if p.paddy_area is not None else None
    except ValueError:
        recorded_acres = None
    checks = {
        "village": _same_name(p.village, t.village_aliases),
        "district": _same_name(p.district, t.district_aliases),
        "paddy_acres": recorded_acres is not None and abs(recorded_acres - t.paddy_acres) < 0.05,
        "harvest_date": p.harvest_date == t.harvest_date,
        "wheat_deadline": p.wheat_deadline == t.wheat_deadline,
        "tractors": p.tractors == t.tractors,
        "machines": p.machines is not None and {m: float(d) for m, d in p.machines.items()} ==
                    {m: float(d) for m, d in t.machines.items()},
        "decomposer_acres": abs((p.decomposer_acres or 0) - t.decomposer_acres) < 0.05,
    }
    filed = session.filed is not None
    filed_pct = session.filed["request"]["coverage"]["coverage_pct"] if filed else None
    return {
        "id": case.id,
        "tags": list(case.tags),
        "slots": checks,
        "slot_accuracy": sum(checks.values()) / len(checks),
        "filed": filed,
        "filed_correct": filed and all(checks.values()),
        "filed_wrong": filed and not all(checks.values()),
        "coverage_error": abs(filed_pct - t.coverage_pct()) if filed else None,
        "turns": turns,
        "asked_forbidden": any(w in r.lower() for r in agent_replies for w in FORBIDDEN),
    }


def summarize(scores: list[dict]) -> dict:
    n = len(scores)
    if not n:
        return {"cases": 0}
    filed = [s for s in scores if s["filed"]]
    out = {
        "cases": n,
        "slot_accuracy": round(statistics.mean(s["slot_accuracy"] for s in scores), 3),
        "per_slot": {k: round(sum(s["slots"][k] for s in scores) / n, 3) for k in SLOTS},
        "filed_rate": round(len(filed) / n, 3),
        "filed_correct_rate": round(sum(s["filed_correct"] for s in scores) / n, 3),
        "filed_wrong": sum(s["filed_wrong"] for s in scores),
        "coverage_error_mean": round(statistics.mean(s["coverage_error"] for s in filed), 2) if filed else None,
        "turns_median": statistics.median(s["turns"] for s in filed) if filed else None,
        "asked_forbidden": sum(s["asked_forbidden"] for s in scores),
        "errors": sum(1 for s in scores if s.get("error")),
    }
    by_tag = defaultdict(list)
    for s in scores:
        for tag in s["tags"]:
            by_tag[tag].append(s)
    out["by_tag"] = {tag: {"cases": len(ss), "slot_accuracy": round(statistics.mean(x["slot_accuracy"] for x in ss), 3),
                           "filed_correct_rate": round(sum(x["filed_correct"] for x in ss) / len(ss), 3)}
                     for tag, ss in sorted(by_tag.items())}
    return out
