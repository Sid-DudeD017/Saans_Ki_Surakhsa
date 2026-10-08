"""Runs simulated farmers against the agent and writes transcripts, scores and a summary.

    AWS_PROFILE=saans uv run python -m agent_kisan.evals --n 20

Each case is a fresh conversation. Filed requests go to an in-memory filer, rain is off and
"today" is pinned, so results depend only on the two models.
"""

import json
import time
import traceback
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

from agent_kisan.evals.cases import Case
from agent_kisan.evals.score import score_case, summarize

MAX_TURNS = 16


class MemoryFiler:
    def file(self, request: dict) -> dict:
        return {"via": "eval"}


def default_chat(case: Case, today: date):
    from agent_kisan.agent import KisanChat

    language = case.persona.language if case.persona.language in ("pa", "hi", "en") else "pa"
    return KisanChat(filer=MemoryFiler(), language=language, weather=None, today=lambda: today)


def default_farmer(case: Case):
    from agent_kisan.evals.farmer import SimulatedFarmer

    return SimulatedFarmer(case)


def run_case(case: Case, make_chat: Callable = default_chat, make_farmer: Callable = default_farmer,
             today: date | None = None, max_turns: int = MAX_TURNS) -> dict:
    from agent_kisan.evals.farmer import END

    chat, farmer = make_chat(case, today or date.today()), make_farmer(case)
    transcript, replies, started = [], [], time.monotonic()
    try:
        said = farmer.opening()
        for turn in range(1, max_turns + 1):
            transcript.append({"farmer": said})
            t0 = time.monotonic()
            reply = chat.send(said)
            transcript.append({"agent": reply, "seconds": round(time.monotonic() - t0, 1),
                               "quick_replies": chat.session.unsure()})
            replies.append(reply)
            if chat.session.filed:
                break
            said = farmer.reply(reply, chat.session.unsure())
            if said.strip() == END:
                break
        result = score_case(case, chat.session, replies, turns=sum(1 for m in transcript if "farmer" in m))
    except Exception as e:  # one broken conversation shouldn't stop the run
        result = score_case(case, chat.session, replies, turns=len(replies))
        result["error"] = f"{type(e).__name__}: {e}"
        result["traceback"] = traceback.format_exc(limit=3)
    result.update(
        seconds=round(time.monotonic() - started, 1),
        usage={"agent": dict(chat.usage), "farmer": dict(getattr(farmer, "usage", {}))},
        transcript=transcript,
        final_profile=chat.session.profile.to_json(),
        case=case.to_json(),
    )
    return result


def run_all(cases: list[Case], out_dir: Path, workers: int = 4, **kwargs) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    with ThreadPoolExecutor(max_workers=workers) as pool, (out_dir / "results.jsonl").open("w") as f:
        futures = {pool.submit(run_case, c, **kwargs): c for c in cases}
        for done in as_completed(futures):
            r = done.result()
            results.append(r)
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            f.flush()
            mark = "ERR " if r.get("error") else ("OK  " if r["filed_correct"] else ("WRONG" if r["filed_wrong"] else "----"))
            print(f"{mark} {r['id']} slots {r['slot_accuracy']:.0%} turns {r['turns']} {r['seconds']}s {' '.join(r['tags'])}")
    summary = summarize(results)
    summary["usage"] = {
        who: {k: sum(r["usage"][who].get(k, 0) for r in results) for k in ("inputTokens", "outputTokens")}
        for who in ("agent", "farmer")
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    return summary
