"""Scoring real voice notes against their answers (no audio needed: transcripts are given)."""

from agent_kisan.evals.voice_notes import read_answers, score_transcript, summarize

ROW = {"file": "note01.opus", "village": "Bhawanigarh", "district": "Sangrur", "paddy_area": "18",
       "paddy_unit": "killa", "variety": "PR-126", "harvest_date": "2026-10-20", "wheat_deadline": "2026-11-09",
       "tractors": "1", "machines": {"super_seeder": 2.0}, "decomposer_acres": ""}
GOOD = ("ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਮੈਂ ਭਵਾਨੀਗੜ੍ਹ ਤੋਂ, ਜ਼ਿਲ੍ਹਾ ਸੰਗਰੂਰ। ਅਠਾਰਾਂ ਕਿੱਲੇ ਝੋਨਾ, ਪੀ ਆਰ 126। ਵਾਢੀ ਵੀਹ ਅਕਤੂਬਰ ਨੂੰ, "
        "ਕਣਕ ਨੌਂ ਨਵੰਬਰ ਤੱਕ। ਇੱਕ ਟਰੈਕਟਰ, ਸੁਪਰ ਸੀਡਰ ਦੋ ਦਿਨ।")


def test_a_clean_transcript_gets_everything():
    d = score_transcript(GOOD, ROW)
    assert all(d[k] is True for k in ("village", "district", "paddy_area", "variety", "harvest_date",
                                       "wheat_deadline", "tractors", "machines"))
    assert d["decomposer_acres"] is None and d["doubtful_numbers"] == []


def test_misheard_numbers_and_wrong_kinds_are_missed():
    bad = GOOD.replace("ਅਠਾਰਾਂ ਕਿੱਲੇ", "ਅੱਸੀ ਕਿੱਲੇ").replace("ਇੱਕ ਟਰੈਕਟਰ", "ਟਰੈਕਟਰ ਹੈ")
    d = score_transcript(bad, ROW)
    assert d["paddy_area"] is False and d["tractors"] is False and d["machines"] is True


def test_month_must_be_right_too():
    d = score_transcript(GOOD.replace("ਵੀਹ ਅਕਤੂਬਰ", "ਵੀਹ ਨਵੰਬਰ"), ROW)
    assert d["harvest_date"] is False


def test_unknown_latin_place_needs_a_human():
    d = score_transcript(GOOD, {**ROW, "village": "Ghanaur Kalan"})
    assert d["village"] == "check by hand"


def test_doubtful_true_numbers_are_reported():
    assert score_transcript(GOOD, ROW, frozenset({18.0, 99.0}))["doubtful_numbers"] == [18.0]


def test_no_machines_and_no_tractor():
    d = score_transcript("ਕੋਈ ਟਰੈਕਟਰ ਨਹੀਂ, ਮਸ਼ੀਨ ਵੀ ਨਹੀਂ", {**ROW, "tractors": "0", "machines": {}})
    assert d["tractors"] is True and d["machines"] is True


def test_read_answers_and_summary(tmp_path):
    csv_path = tmp_path / "answers.csv"
    csv_path.write_text("file,village,paddy_area,machines\nnote01.opus,Sunam,4.5,super_seeder:2; baler:1\n,,,\n",
                        encoding="utf-8")
    [row] = read_answers(csv_path)
    assert row["machines"] == {"super_seeder": 2.0, "baler": 1.0}
    s = summarize([{"file": "a", "seconds": 4.0, "details": score_transcript(GOOD, ROW)},
                   {"file": "b", "error": "audio file not found", "details": {}}])
    assert s["notes"] == 2 and s["details_right"] == 1.0 and s["missing_audio"] == 1


def test_whispers_real_hindi_output():
    """large-v3-turbo on the Mac's Hindi voice: एकर, अक्तोबर, ट्रक्तर, सीधर, धाई."""
    from tests.test_voice import WHISPER_HINDI

    row = {**ROW, "village": "", "district": "", "variety": "", "paddy_unit": "acre", "wheat_deadline": "",
           "machines": {"super_seeder": 2.5}}
    d = score_transcript(WHISPER_HINDI, row)
    assert (d["paddy_area"], d["harvest_date"], d["tractors"], d["machines"]) == (True, True, True, True)
