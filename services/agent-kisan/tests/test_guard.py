"""The number guard in a conversation: unsure numbers block the read-back until the farmer says them."""

from datetime import date

from agent_kisan.session import KisanSession

GURPREET = dict(
    village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa",
    harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2},
)


class NoFiler:
    def file(self, request):
        return {"via": "test"}


def session(*messages, language="pa"):
    s = KisanSession(filer=NoFiler(), language=language, weather=None, today=lambda: date(2026, 10, 8))
    for m in messages:
        s.begin_turn(m)
    return s


SAID = "ਭਵਾਨੀਗੜ੍ਹ, ਸੰਗਰੂਰ। ਅਠਾਰਾਂ ਕਿੱਲੇ। ਵਾਢੀ ਵੀਹ ਅਕਤੂਬਰ, ਕਣਕ ਨੌਂ ਨਵੰਬਰ ਤੱਕ। ਇੱਕ ਟਰੈਕਟਰ, ਸੁਪਰ ਸੀਡਰ ਦੋ ਦਿਨ।"


def test_everything_said_in_words_is_heard():
    s = session(SAID)
    out = s.update(**GURPREET)
    assert "unsure" not in out
    assert "read_this_back" in s.prepare_readback()


def test_a_misread_number_is_flagged_and_blocks_readback():
    s = session(SAID)
    out = s.update(**{**GURPREET, "paddy_area": 80})  # the model turned ਅਠਾਰਾਂ into 80
    assert [u["slot"] for u in out["unsure"]] == ["paddy_area"]
    assert out["unsure"][0]["label"] == "80 ਕਿੱਲੇ"
    blocked = s.prepare_readback()
    assert blocked["error"] == "confirm these numbers with the farmer first"


def test_a_number_said_for_something_else_does_not_count():
    s = session(SAID)  # "ਸੁਪਰ ਸੀਡਰ ਦੋ ਦਿਨ": 2 is days, not tractors
    s.update(**{**GURPREET, "tractors": 2})
    assert [u["slot"] for u in s.unsure()] == ["tractors"]


def test_a_bare_answer_counts():
    s = session("ਕਿੰਨੇ ਟਰੈਕਟਰ? ", "ਦੋ")
    s.update(tractors=2)
    assert s.unsure() == []


def test_tapping_the_quick_reply_clears_it():
    s = session(SAID)
    s.update(**{**GURPREET, "tractors": 2})  # farmer said one tractor
    [u] = s.unsure()
    assert u["send_text"] == "2 ਟਰੈਕਟਰ"
    s.begin_turn(u["send_text"])  # the farmer taps it: they really meant 2
    assert s.unsure() == []


def test_saying_the_right_number_and_fixing_it_clears_it():
    s = session(SAID)
    s.update(**{**GURPREET, "tractors": 2})
    s.begin_turn("ਨਹੀਂ, ਇੱਕ ਟਰੈਕਟਰ")
    s.update(tractors=1)
    assert s.unsure() == []


def test_arithmetic_the_farmer_never_said_is_flagged():
    s = session("ਵੀਹ ਕਿੱਲੇ ਹਨ, ਦੋ ਕਿੱਲੇ ਬਾਸਮਤੀ")  # 20 acres, 2 of them basmati
    s.update(paddy_area=18)  # the model worked out 18 itself
    assert [u["slot"] for u in s.unsure()] == ["paddy_area"]


def test_dates_need_their_day_said():
    s = session("ਵਾਢੀ ਦੀਵਾਲੀ ਤੋਂ ਬਾਅਦ")  # "after Diwali": the model guessed a date
    s.update(harvest_date="2026-11-10")
    [u] = s.unsure()
    assert (u["slot"], u["label"]) == ("harvest_date", "10 ਨਵੰਬਰ")


def test_zero_is_heard_when_the_farmer_says_none():
    s = session("ਕੋਈ ਟਰੈਕਟਰ ਨਹੀਂ")
    s.update(tractors=0)
    assert s.unsure() == []


def test_machine_days_and_labels_in_hindi():
    s = session("सुपर सीडर मिल सकता है", language="hi")
    s.update(machines={"super_seeder": 2.5})
    [u] = s.unsure()
    assert (u["slot"], u["label"]) == ("machines.super_seeder", "सुपर सीडर 2.5 दिन")
    s.begin_turn("ढाई दिन")
    assert s.unsure() == []


def test_decomposer_only_checked_when_set():
    s = session(SAID)
    s.update(**GURPREET)
    assert s.unsure() == []
    s.update(decomposer_acres=4)
    assert [u["slot"] for u in s.unsure()] == ["decomposer_acres"]
