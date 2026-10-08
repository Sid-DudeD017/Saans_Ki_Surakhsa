"""Scores the private voice notes (~/Desktop/saans-voice-notes) with local Whisper.

    uv run python scripts/score_voice_notes.py ~/Desktop/saans-voice-notes [--model large-v3] [--language pa]
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from agent_kisan.evals.voice_notes import DETAILS, read_answers, score_transcript, summarize
from agent_kisan.transcribe import LocalWhisper

MARK = {True: "✓", False: "✗", None: "·", "check by hand": "?"}


def main() -> None:
    ap = argparse.ArgumentParser(description="Score real voice notes against their true answers")
    ap.add_argument("folder", type=Path)
    ap.add_argument("--model", default=None, help="Whisper model (default large-v3-turbo)")
    ap.add_argument("--language", default="pa", help="pa, hi, en, or auto")
    args = ap.parse_args()

    answers = args.folder / "answers.csv"
    if not answers.exists():
        sys.exit(f"no answers.csv in {args.folder}")
    rows = read_answers(answers)
    if not rows:
        sys.exit("answers.csv has no rows yet: add one line per recording")
    whisper = LocalWhisper(model=args.model)
    language = None if args.language == "auto" else args.language
    results = []
    print("note".ljust(14) + " ".join(d[:7].ljust(7) for d in DETAILS) + "  heard")
    for row in rows:
        audio = args.folder / "audio" / row["file"].strip()
        if not audio.exists():
            results.append({"file": row["file"], "error": "audio file not found", "details": {}})
            print(f"{row['file']:<14}missing in audio/")
            continue
        t = whisper.transcribe(audio.read_bytes(), language)
        details = score_transcript(t.text, row, t.unsure_numbers)
        results.append({"file": row["file"], "speaker": row.get("speaker"), "region": row.get("region"),
                        "transcript": t.text, "language_detected": t.language, "seconds": round(t.seconds, 1),
                        "details": details})
        print(f"{row['file']:<14}" + " ".join(MARK[details[d]].ljust(7) for d in DETAILS) + f"  {t.text[:70]}")

    summary = summarize(results)
    out = args.folder / f"results-{datetime.now():%Y%m%d-%H%M%S}.json"
    out.write_text(json.dumps({"model": whisper.model_name, "language": args.language, "summary": summary,
                               "notes": results}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ heard right  ✗ missed  ? check by hand  · not in this note")
    print(json.dumps(summary, indent=2))
    print(f"saved {out}")


if __name__ == "__main__":
    main()
