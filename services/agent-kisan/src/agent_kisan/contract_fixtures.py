"""Example help requests for the cross-language contract test with Saans Command.

    uv run python -m agent_kisan.contract_fixtures   # rewrites packages/contracts/fixtures/kisan-help-requests.json

src/__tests__/kisan-help-request.test.ts parses every example with Command's HelpRequestSchema,
and tests/test_contract_fixtures.py fails if this file falls out of date with help_request.py.
"""

import json
from datetime import date

from agent_kisan.seed import repo_root
from agent_kisan.session import KisanSession

FIXTURE = repo_root() / "packages" / "contracts" / "fixtures" / "kisan-help-requests.json"
_GURPREET = dict(
    village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa", variety="PR-126",
    harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2},
)
_SAID = "Bhawanigarh, Sangrur. 18 killa. Harvest 20 October, wheat by 9 November. 1 tractor, Super Seeder {d} din."


class _Keep:
    def file(self, request):
        return {"via": "fixture"}


def _example(name: str, days: int = 2, **profile) -> dict:
    s = KisanSession(filer=_Keep(), session_id=name, weather=None, today=lambda: date(2026, 10, 8),
                     rain_dates={date(2026, 10, 27), date(2026, 10, 28)})
    s.begin_turn(_SAID.format(d=days))
    s.update(**{**_GURPREET, "machines": {"super_seeder": days}, **profile})
    s.prepare_readback()
    s.begin_turn("haan")
    s.file_report()
    return s.filed["request"]["help_request"]


def examples() -> dict[str, dict]:
    return {
        "gurpreet_open": _example("gurpreet-open"),
        "fully_booked_matched": _example("fully-booked", days=3),
        "unknown_village_district_centre": _example("district-centre", village="Somewhere new"),
    }


def render() -> str:
    return json.dumps(examples(), indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(render(), encoding="utf-8")
    print(f"wrote {FIXTURE}")
