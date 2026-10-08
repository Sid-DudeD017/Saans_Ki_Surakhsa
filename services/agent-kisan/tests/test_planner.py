"""The zero-burn planner. Gurpreet's case uses the demo seed; the rest use small hand-built CHCs."""

import random
from datetime import date, timedelta

import pytest

from agent_kisan.planner import Chc, ChcMachine, plan_zero_burn
from agent_kisan.seed import load_seed

HARVEST, DEADLINE = date(2026, 10, 20), date(2026, 11, 9)
FARM = (30.266, 76.040)
RAIN = {date(2026, 10, 27), date(2026, 10, 28)}


def chc(id, km_north=0.0, machines=(), district="Sangrur", subsidy=0.0):
    return Chc(id=id, name=id, village=id, district=district, lat=FARM[0] + km_north / 111.2, lon=FARM[1],
               phone="+91 00000 00000", subsidy_fraction=subsidy, machines=tuple(machines))


def machine(type="happy_seeder", units=1, rate=1000, booked=None):
    return ChcMachine(type=type, units=units, rate_per_acre_inr=rate, booked=booked or {})


def every_day(units=1):
    return {HARVEST + timedelta(d): units for d in range((DEADLINE - HARVEST).days)}


def test_gurpreet_on_the_demo_seed():
    chcs, villages, demo = load_seed()
    assert demo
    p = plan_zero_burn(7, HARVEST, DEADLINE, chcs, rain_dates=RAIN, farm_location=villages["bhawanigarh"])
    [b] = p.bookings
    assert (b.date, b.machine, b.chc_id, b.acres, b.cost_inr) == (date(2026, 11, 2), "super_seeder", "demo-chc-a", 5.5, 5500)
    [u] = p.unmet
    assert (u.machine, u.days, u.acres, u.latest_date) == ("happy_seeder", 1, 1.5, DEADLINE)


def test_never_books_a_rain_day():
    only_rain_free = {d: 1 for d in every_day() if d not in RAIN}
    p = plan_zero_burn(7, HARVEST, DEADLINE, [chc("a", 1, [machine(booked=only_rain_free)])],
                       rain_dates=RAIN, farm_location=FARM)
    assert p.bookings == ()
    assert p.unmet[0].acres == 7


def test_never_books_a_booked_day():
    booked = every_day()
    booked.pop(date(2026, 11, 5))
    p = plan_zero_burn(20, HARVEST, DEADLINE, [chc("a", 1, [machine(booked=booked)])], farm_location=FARM)
    assert [b.date for b in p.bookings] == [date(2026, 11, 5)]


def test_books_only_between_harvest_and_deadline():
    p = plan_zero_burn(10_000, HARVEST, DEADLINE, [chc("a", 1, [machine()])], farm_location=FARM)
    dates = [b.date for b in p.bookings]
    assert min(dates) == HARVEST and max(dates) == DEADLINE - timedelta(1)
    assert len(dates) == 20


def test_out_of_range_chc_is_skipped_unless_range_grows():
    far = [chc("far", 25, [machine()])]
    assert plan_zero_burn(7, HARVEST, DEADLINE, far, farm_location=FARM).bookings == ()
    assert plan_zero_burn(7, HARVEST, DEADLINE, far, farm_location=FARM, max_km=30).booked_acres == 7


def test_cheapest_after_subsidy_wins_over_nearer():
    near = chc("near", 1, [machine(rate=1000)])
    far_subsidised = chc("far", 10, [machine(rate=1500)], subsidy=0.5)  # 750 per acre
    p = plan_zero_burn(7, HARVEST, DEADLINE, [near, far_subsidised], farm_location=FARM)
    assert [b.chc_id for b in p.bookings] == ["far"]
    assert p.cost_inr == 7 * 750


def test_same_cost_nearer_wins_then_earlier():
    p = plan_zero_burn(7, HARVEST, DEADLINE, [chc("far", 10, [machine()]), chc("near", 1, [machine()])],
                       farm_location=FARM)
    assert [(b.chc_id, b.date) for b in p.bookings] == [("near", HARVEST)]


def test_no_gap_no_bookings():
    p = plan_zero_burn(0, HARVEST, DEADLINE, [chc("a", 1, [machine()])], farm_location=FARM)
    assert p.bookings == () and p.unmet == ()


def test_two_free_units_on_one_day_both_get_used():
    m = machine(units=2, booked={d: 2 for d in every_day() if d != HARVEST})
    p = plan_zero_burn(14, HARVEST, DEADLINE, [chc("a", 1, [m])], farm_location=FARM)
    assert [(b.date, b.acres) for b in p.bookings] == [(HARVEST, 7), (HARVEST, 7)]


def test_last_booking_takes_only_what_is_left():
    p = plan_zero_burn(10, HARVEST, DEADLINE, [chc("a", 1, [machine()])], farm_location=FARM)
    assert [b.acres for b in p.bookings] == [7, 3]


def test_without_a_location_uses_the_district():
    chcs = [chc("same", 1, [machine()]), chc("other", 1, [machine()], district="Patiala")]
    p = plan_zero_burn(7, HARVEST, DEADLINE, chcs, district="sangrur")
    assert p.chcs_considered == ("same",)
    assert p.bookings[0].distance_km is None


def test_unmet_suggests_the_fastest_machine_chcs_own():
    booked = machine(type="baler", rate=500, booked=every_day())
    p = plan_zero_burn(40, HARVEST, DEADLINE, [chc("a", 1, [booked])], farm_location=FARM)
    assert (p.unmet[0].machine, p.unmet[0].days) == ("baler", 3)


def test_bad_inputs():
    with pytest.raises(ValueError):
        plan_zero_burn(-1, HARVEST, DEADLINE, [])
    with pytest.raises(ValueError):
        plan_zero_burn(1, DEADLINE, HARVEST, [])


def test_rules_hold_on_200_random_farms():
    """Acceptance test: never a rain day, a booked day, or a day outside harvest..deadline; never over-books."""
    rng = random.Random(7)
    types = ["happy_seeder", "super_seeder", "mulcher_rmb", "baler"]
    for _ in range(200):
        harvest = date(2026, 10, 1) + timedelta(rng.randrange(30))
        deadline = harvest + timedelta(rng.randrange(0, 30))
        span = [harvest + timedelta(d) for d in range(-3, 33)]
        rain = {d for d in span if rng.random() < 0.15}
        chcs = []
        for i in range(rng.randrange(1, 5)):
            ms = []
            for t in rng.sample(types, rng.randrange(1, 4)):
                units = rng.randrange(1, 3)
                ms.append(machine(t, units, rng.randrange(500, 2500),
                                  {d: rng.randrange(0, units + 1) for d in span if rng.random() < 0.6}))
            chcs.append(chc(f"c{i}", rng.uniform(0, 20), ms, subsidy=rng.choice([0, 0.5])))
        gap = rng.uniform(0, 80)
        p = plan_zero_burn(gap, harvest, deadline, chcs, rain_dates=rain, farm_location=FARM)

        by_id = {c.id: c for c in chcs}
        used = {}
        for b in p.bookings:
            assert harvest <= b.date < deadline
            assert b.date not in rain
            assert b.distance_km <= 15
            key = (b.chc_id, b.machine, b.date)
            used[key] = used.get(key, 0) + 1
            m = next(m for m in by_id[b.chc_id].machines if m.type == b.machine)
            assert used[key] <= m.free_units(b.date)
        assert p.booked_acres == pytest.approx(sum(b.acres for b in p.bookings))
        assert p.booked_acres + sum(u.acres for u in p.unmet) == pytest.approx(gap)
