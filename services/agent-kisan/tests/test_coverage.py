"""The 14 hand-worked coverage cases from the plan, plus input checks.

Capacities (acres/day): Happy Seeder 7, Super Seeder 5.5, Mulcher + RMB 4.5, Baler 15.
"""

import pytest

from agent_kisan.coverage import estimate_coverage
from agent_kisan.units import to_acres


def test_01_gurpreet():
    r = estimate_coverage(18, 20, {"super_seeder": 2})
    assert r.coverage_pct == 61
    assert r.covered_acres == 11
    assert r.gap_acres == 7
    assert r.straw_t == 17.5
    assert r.pm25_kg == 140
    assert (r.tractor_days_used, r.tractor_days_available) == (2, 20)


def test_02_machine_days_capped_at_window():
    # 3 tractors, so only the window limits the Happy Seeder: 30 days → 20.
    r = estimate_coverage(500, 20, {"happy_seeder": 30}, tractors=3)
    assert r.machine_days_used["happy_seeder"] == 20
    assert r.covered_acres == 140


def test_03_decomposer_ignored_in_short_window():
    r = estimate_coverage(18, 20, decomposer_acres=10)
    assert r.covered_acres == 0


def test_04_decomposer_counted_in_25_day_window():
    r = estimate_coverage(18, 25, decomposer_acres=10)
    assert r.covered_acres == 10
    assert r.coverage_pct == 56


def test_05_over_covered_caps_at_100_and_stops_early():
    r = estimate_coverage(10, 20, {"happy_seeder": 5})
    assert r.coverage_pct == 100
    assert r.gap_acres == 0
    assert r.tractor_days_used == pytest.approx(10 / 7)


def test_06_zero_paddy():
    r = estimate_coverage(0, 20, {"super_seeder": 2})
    assert r.coverage == 0
    assert r.gap_acres == 0


def test_07_no_machines():
    r = estimate_coverage(18, 20)
    assert r.gap_acres == 18
    assert r.straw_t == 45
    assert r.pm25_kg == 360


def test_08_hectares_converted():
    paddy = to_acres(4, "hectare")
    assert paddy == pytest.approx(9.8842)
    r = estimate_coverage(paddy, 20, {"super_seeder": 1})
    assert r.gap_acres == pytest.approx(9.8842 - 5.5)


def test_09_two_machines_two_tractors_add_up():
    r = estimate_coverage(100, 20, {"happy_seeder": 2, "super_seeder": 2}, tractors=2)
    assert r.covered_acres == 14 + 11


def test_10_negative_acres_rejected():
    with pytest.raises(ValueError):
        estimate_coverage(-5, 20)


def test_11_one_tractor_shares_its_days():
    # The old formula said 7×15 + 15×15 = 330. One tractor has 20 days:
    # 15 go to the baler (fastest), the last 5 to the Happy Seeder.
    r = estimate_coverage(400, 20, {"happy_seeder": 15, "baler": 15}, tractors=1)
    assert r.machine_days_used == {"baler": 15, "happy_seeder": 5}
    assert r.covered_acres == 260
    assert r.tractor_days_used == 20


def test_12_second_tractor_lifts_the_limit():
    r = estimate_coverage(400, 20, {"happy_seeder": 15, "baler": 15}, tractors=2)
    assert r.covered_acres == 330


def test_13_rain_days_shrink_the_window():
    r = estimate_coverage(500, 20, {"happy_seeder": 20}, rain_days=5)
    assert r.work_days == 15
    assert r.covered_acres == 105


def test_14_no_tractor_only_the_decomposer_counts():
    r = estimate_coverage(18, 25, {"happy_seeder": 3}, tractors=0, decomposer_acres=5)
    assert r.covered_acres == 5
    assert r.tractor_days_used == 0


# ---- input checks ----

def test_unknown_machine_rejected():
    with pytest.raises(ValueError, match="combine"):
        estimate_coverage(18, 20, {"combine": 2})


def test_fractional_tractors_rejected():
    with pytest.raises(ValueError):
        estimate_coverage(18, 20, {"super_seeder": 2}, tractors=1.5)


def test_rain_longer_than_window_leaves_no_work_days():
    r = estimate_coverage(18, 10, {"super_seeder": 2}, rain_days=12)
    assert r.work_days == 0
    assert r.covered_acres == 0
