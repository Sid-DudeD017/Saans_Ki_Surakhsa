"""The evaluation harness, offline: a scripted farmer and a scripted agent stand in for the two models."""

from datetime import date

from agent_kisan.evals.cases import make_cases
from agent_kisan.evals.farmer import END, farmer_prompt
from agent_kisan.evals.runner import MemoryFiler, run_all, run_case
from agent_kisan.evals.score import summarize
from agent_kisan.session import KisanSession

TODAY = date(2026, 10, 8)


class ScriptedFarmer:
    """Says every fact in digits with its unit word, then confirms."""

    def __init__(self, case):
        self.t = case.truth
        self.usage = {"inputTokens": 10, "outputTokens": 5}

    def opening(self):
        t = self.t
        machines = ", ".join(f"{m} {d} din" for m, d in t.machines.items()) or "koi machine nahi"
        tractors = f"{t.tractors} tractor" if t.tractors else "koi tractor nahi"
        decomposer = f", decomposer {t.decomposer_acres:g} {t.paddy_unit}" if t.decomposer_acres else ""
        return (f"{t.village}, {t.district}. {t.paddy_value:g} {t.paddy_unit}. Harvest {t.harvest_date.day} "
                f"{t.harvest_date:%B}, wheat by {t.wheat_deadline.day} {t.wheat_deadline:%B}. {tractors}. {machines}{decomposer}")

    def reply(self, agent_text, quick_replies):
        return END if "filed" in agent_text else "haan ji"


class ScriptedChat:
    """Records the truth, plus an optional mistake, reads back, then files on the next turn."""

    def __init__(self, case, today, mistake=None):
        self.case, self.mistake = case, mistake or {}
        self.session = KisanSession(filer=MemoryFiler(), weather=None, today=lambda: today)
        self.usage = {"inputTokens": 100, "outputTokens": 20}

    def send(self, text):
        s, t = self.session, self.case.truth
        s.begin_turn(text)
        if s.turn == 1:
            s.update(**{"village": t.village, "district": t.district, "paddy_area": t.paddy_value,
                        "paddy_unit": t.paddy_unit, "harvest_date": t.harvest_date.isoformat(),
                        "wheat_deadline": t.wheat_deadline.isoformat(), "tractors": t.tractors,
                        "machines": t.machines, **({"decomposer_acres": t.decomposer_acres} if t.decomposer_acres else {}),
                        **self.mistake})
            out = s.prepare_readback()
            return "please confirm" if "read_this_back" in out else f"unsure: {out.get('unsure')}"
        out = s.file_report()
        return "filed" if out.get("filed") else f"not filed: {out}"


def test_cases_are_repeatable_and_varied():
    a, b = make_cases(50, seed=3, today=TODAY), make_cases(50, seed=3, today=TODAY)
    assert [c.to_json() for c in a] == [c.to_json() for c in b]
    assert {c.persona.language for c in a} == {"pa", "hi", "en", "mixed"}
    assert all(c.truth.harvest_date > TODAY and c.truth.wheat_deadline > c.truth.harvest_date for c in a)
    assert all(c.truth.tractors > 0 for c in a if c.truth.machines)


def test_farmer_prompt_hides_nothing_it_needs_and_asks_for_quirks():
    case = next(c for c in make_cases(100, today=TODAY) if c.persona.corrects_mid_way)
    prompt = farmer_prompt(case)
    assert case.truth.village in prompt and str(case.truth.tractors + 1) in prompt
    assert "Aadhaar" in prompt and "<<END>>" in prompt


def test_a_correct_agent_scores_full_marks():
    case = make_cases(1, today=TODAY)[0]
    r = run_case(case, make_chat=lambda c, d: ScriptedChat(c, d), make_farmer=ScriptedFarmer, today=TODAY)
    assert r["filed_correct"] and r["slot_accuracy"] == 1 and r["coverage_error"] == 0
    assert r["turns"] == 2 and not r["asked_forbidden"]


def test_the_guard_stops_a_wrong_number_from_being_filed():
    case = make_cases(1, today=TODAY)[0]
    wrong = {"tractors": case.truth.tractors + 7}
    r = run_case(case, make_chat=lambda c, d: ScriptedChat(c, d, wrong), make_farmer=ScriptedFarmer, today=TODAY)
    assert not r["filed"] and r["slots"]["tractors"] is False
    assert r["transcript"][1]["quick_replies"][0]["slot"] == "tractors"


def test_a_crashing_conversation_is_recorded_not_raised():
    class Broken(ScriptedChat):
        def send(self, text):
            raise RuntimeError("model unavailable")

    r = run_case(make_cases(1, today=TODAY)[0], make_chat=lambda c, d: Broken(c, d), make_farmer=ScriptedFarmer)
    assert r["error"] == "RuntimeError: model unavailable" and not r["filed"]


def test_run_all_writes_results_and_a_summary(tmp_path):
    cases = make_cases(6, today=TODAY)
    summary = run_all(cases, tmp_path, workers=2, make_chat=lambda c, d: ScriptedChat(c, d),
                      make_farmer=ScriptedFarmer, today=TODAY)
    assert summary["cases"] == 6 and summary["filed_correct_rate"] == 1.0 and summary["filed_wrong"] == 0
    assert summary["usage"]["agent"]["inputTokens"] == 600
    assert len((tmp_path / "results.jsonl").read_text().splitlines()) == 6
    assert (tmp_path / "summary.json").exists()


def test_summary_of_nothing():
    assert summarize([]) == {"cases": 0}
