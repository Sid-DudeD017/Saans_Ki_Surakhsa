"""uv run python -m agent_kisan.evals --n 20 [--seed 7] [--workers 4] [--out evals/results/<time>]"""

import argparse
import json
from datetime import datetime
from pathlib import Path

from agent_kisan.evals.cases import make_cases
from agent_kisan.evals.runner import run_all


def main() -> None:
    ap = argparse.ArgumentParser(description="Run simulated farmers against Kisan Saathi")
    ap.add_argument("--n", type=int, default=20, help="number of farmers (start with 20 and check the cost)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    out = args.out or Path("evals/results") / datetime.now().strftime("%Y%m%d-%H%M%S")
    summary = run_all(make_cases(args.n, args.seed), out, workers=args.workers)
    print(json.dumps({k: v for k, v in summary.items() if k != "by_tag"}, indent=2, ensure_ascii=False))
    print(f"\nTranscripts and scores: {out}/results.jsonl")
    print("Tokens are in summary.json under usage; multiply by your Bedrock prices for the cost of this run.")


if __name__ == "__main__":
    main()
