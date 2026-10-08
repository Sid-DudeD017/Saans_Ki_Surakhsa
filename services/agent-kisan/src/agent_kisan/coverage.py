"""How much of a farm's paddy stubble can be cleared without fire.

Each tractor pulls one machine per day, and rain days are lost, so machine days
are limited twice: by the dry days in the sowing window, and by the tractor-days
the farm has. Tractor-days go to the fastest machine first, and stop once the
paddy is covered. Capacities are typical figures; replace them with KVK numbers
before quoting.
"""

import math
from collections.abc import Mapping
from dataclasses import dataclass

# Acres per machine per working day.
CAPACITY_ACRES_PER_DAY: dict[str, float] = {
    "happy_seeder": 7.0,
    "super_seeder": 5.5,
    "mulcher_rmb": 4.5,  # mulcher + reversible mould-board plough
    "baler": 15.0,  # baler + rake
}

DECOMPOSER_MIN_WINDOW_DAYS = 25
STRAW_T_PER_ACRE = 2.5
PM25_G_PER_KG_STRAW = 8.0


@dataclass(frozen=True)
class CoverageResult:
    paddy_acres: float
    covered_acres: float
    gap_acres: float
    coverage: float  # 0..1
    straw_t: float  # straw left on the gap
    pm25_kg: float  # PM2.5 if the gap is burnt
    work_days: float
    tractor_days_available: float
    tractor_days_used: float
    machine_days_used: dict[str, float]

    @property
    def coverage_pct(self) -> int:
        return math.floor(self.coverage * 100 + 0.5)


def estimate_coverage(
    paddy_acres: float,
    window_days: float,
    machine_days: Mapping[str, float] | None = None,
    *,
    tractors: int = 1,
    rain_days: float = 0,
    decomposer_acres: float = 0,
    capacities: Mapping[str, float] = CAPACITY_ACRES_PER_DAY,
) -> CoverageResult:
    machine_days = dict(machine_days or {})
    _require_non_negative(
        paddy_acres=paddy_acres, window_days=window_days, tractors=tractors,
        rain_days=rain_days, decomposer_acres=decomposer_acres, **machine_days,
    )
    if tractors != int(tractors):
        raise ValueError(f"tractors must be a whole number: {tractors}")
    unknown = sorted(set(machine_days) - set(capacities))
    if unknown:
        raise ValueError(f"unknown machines: {', '.join(unknown)}")

    work_days = max(0.0, window_days - rain_days)
    tractor_days = tractors * work_days

    # The decomposer needs ~25 days to work, so a shorter window can't count on it.
    covered = decomposer_acres if window_days >= DECOMPOSER_MIN_WINDOW_DAYS else 0.0
    covered = min(covered, paddy_acres)

    used_total = 0.0
    used: dict[str, float] = {}
    for machine in sorted(machine_days, key=lambda m: capacities[m], reverse=True):
        capacity = capacities[machine]
        days = min(
            machine_days[machine],
            work_days,
            tractor_days - used_total,
            (paddy_acres - covered) / capacity if capacity else 0.0,
        )
        days = max(0.0, days)
        used[machine] = days
        used_total += days
        covered += capacity * days

    covered = min(covered, paddy_acres)
    gap = paddy_acres - covered
    straw_t = gap * STRAW_T_PER_ACRE
    return CoverageResult(
        paddy_acres=paddy_acres,
        covered_acres=covered,
        gap_acres=gap,
        coverage=covered / paddy_acres if paddy_acres else 0.0,
        straw_t=straw_t,
        pm25_kg=straw_t * PM25_G_PER_KG_STRAW,  # t × g/kg = kg
        work_days=work_days,
        tractor_days_available=tractor_days,
        tractor_days_used=used_total,
        machine_days_used=used,
    )


def _require_non_negative(**values: float) -> None:
    negative = [f"{name}={v}" for name, v in values.items() if v < 0]
    if negative:
        raise ValueError(f"values can't be negative: {', '.join(negative)}")
