"""Zero-burn planner: turn a farm's stubble gap into CHC machine bookings, day by day.

A slot is one unit of one machine at one Custom Hiring Centre (CHC) on one day.
Free slots are dry days between harvest and the wheat deadline that the CHC has
not already booked, at CHCs within reach of the farm. Slots are taken cheapest
per acre first (after subsidy), then nearest, then earliest, until the gap
closes. Whatever is still short becomes `unmet`: the help request.

Greedy is optimal here: every slot is priced per acre and can be part-used, so
filling the cheapest acres first gives the lowest total cost.

Demo assumption: a CHC rental comes with its own tractor and operator, so it
does not use the farmer's tractor-days. Confirm with the KVK.
"""

import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import date, timedelta

from agent_kisan.coverage import CAPACITY_ACRES_PER_DAY

DEFAULT_MAX_KM = 15.0


@dataclass(frozen=True)
class ChcMachine:
    type: str
    units: int
    rate_per_acre_inr: float
    booked: Mapping[date, int] = field(default_factory=dict)  # units already booked on each date

    def free_units(self, day: date) -> int:
        return max(0, self.units - self.booked.get(day, 0))


@dataclass(frozen=True)
class Chc:
    id: str
    name: str
    village: str
    district: str
    lat: float
    lon: float
    phone: str
    subsidy_fraction: float
    machines: tuple[ChcMachine, ...]


@dataclass(frozen=True)
class Booking:
    date: date
    machine: str
    chc_id: str
    chc_name: str
    distance_km: float | None
    acres: float
    cost_inr: float  # after subsidy

    def to_json(self) -> dict:
        return {
            "date": self.date.isoformat(), "machine": self.machine, "chc_id": self.chc_id, "chc_name": self.chc_name,
            "distance_km": None if self.distance_km is None else round(self.distance_km, 1),
            "acres": round(self.acres, 2), "cost_inr": round(self.cost_inr),
        }


@dataclass(frozen=True)
class Unmet:
    machine: str | None
    days: int | None
    acres: float
    latest_date: date

    def to_json(self) -> dict:
        return {"machine": self.machine, "days": self.days, "acres": round(self.acres, 2),
                "latest_date": self.latest_date.isoformat()}


@dataclass(frozen=True)
class Plan:
    bookings: tuple[Booking, ...]
    booked_acres: float
    cost_inr: float
    unmet: tuple[Unmet, ...]
    chcs_considered: tuple[str, ...]

    def to_json(self) -> dict:
        return {
            "plan": [b.to_json() for b in self.bookings],
            "booked_acres": round(self.booked_acres, 2),
            "cost_inr": round(self.cost_inr),
            "unmet": [u.to_json() for u in self.unmet],
            "chcs_considered": list(self.chcs_considered),
        }


def plan_zero_burn(
    gap_acres: float,
    harvest_date: date,
    wheat_deadline: date,
    chcs: Iterable[Chc],
    *,
    rain_dates: Iterable[date] = (),
    farm_location: tuple[float, float] | None = None,
    district: str | None = None,
    max_km: float = DEFAULT_MAX_KM,
    capacities: Mapping[str, float] = CAPACITY_ACRES_PER_DAY,
    today: date | None = None,
) -> Plan:
    """today: days before it can't be booked (None = no limit, for tests and what-ifs)."""
    if gap_acres < 0:
        raise ValueError(f"gap can't be negative: {gap_acres}")
    if wheat_deadline < harvest_date:
        raise ValueError("the wheat deadline is before the harvest date")

    rain = set(rain_dates)
    days = [harvest_date + timedelta(d) for d in range((wheat_deadline - harvest_date).days)]
    dry_days = [d for d in days if d not in rain and (today is None or d >= today)]
    reachable = [(c, dist) for c in chcs if (dist := _reach(c, farm_location, district, max_km)) is not False]

    slots = []  # (cost per acre, distance, date, chc, machine, capacity)
    for chc, dist in reachable:
        for m in chc.machines:
            capacity = capacities.get(m.type)
            if not capacity:
                continue
            cost_per_acre = m.rate_per_acre_inr * (1 - chc.subsidy_fraction)
            for day in dry_days:
                for _ in range(m.free_units(day)):
                    slots.append((cost_per_acre, math.inf if dist is None else dist, day, chc, m, capacity))
    slots.sort(key=lambda s: (s[0], s[1], s[2], s[3].id, s[4].type))

    remaining = gap_acres
    bookings = []
    for cost_per_acre, dist, day, chc, m, capacity in slots:
        if remaining <= 1e-9:
            break
        acres = min(capacity, remaining)
        remaining -= acres
        bookings.append(Booking(day, m.type, chc.id, chc.name, None if dist == math.inf else dist,
                                acres, acres * cost_per_acre))

    unmet = ()
    if remaining > 1e-9:
        machine = _suggest_machine(reachable, capacities)
        days_needed = math.ceil(remaining / capacities[machine]) if machine else None
        unmet = (Unmet(machine, days_needed, remaining, wheat_deadline),)

    bookings.sort(key=lambda b: (b.date, b.chc_id, b.machine))
    return Plan(
        bookings=tuple(bookings),
        booked_acres=gap_acres - max(0.0, remaining),
        cost_inr=sum(b.cost_inr for b in bookings),
        unmet=unmet,
        chcs_considered=tuple(c.id for c, _ in reachable),
    )


def find_chcs(
    chcs: Iterable[Chc],
    *,
    farm_location: tuple[float, float] | None = None,
    district: str | None = None,
    machine: str | None = None,
    window: tuple[date, date] | None = None,
    rain_dates: Iterable[date] = (),
    today: date | None = None,
    max_km: float = DEFAULT_MAX_KM,
) -> list[dict]:
    """CHCs within reach, nearest first, with each machine's price after subsidy and, given a
    window, how many dry days it is free and the first one."""
    rain = set(rain_dates)
    out = []
    for chc in chcs:
        dist = _reach(chc, farm_location, district, max_km)
        if dist is False:
            continue
        machines = []
        for m in chc.machines:
            if machine and m.type != machine:
                continue
            entry = {"machine": m.type, "units": m.units,
                     "cost_per_acre_inr": round(m.rate_per_acre_inr * (1 - chc.subsidy_fraction))}
            if window:
                start, end = window
                free = [start + timedelta(d) for d in range((end - start).days)]
                free = [d for d in free if d not in rain and (today is None or d >= today) and m.free_units(d) > 0]
                entry.update(free_days=len(free), first_free=free[0].isoformat() if free else None)
            machines.append(entry)
        if machines:
            out.append({"chc_id": chc.id, "name": chc.name, "village": chc.village, "phone": chc.phone,
                        "distance_km": None if dist is None else round(dist, 1), "machines": machines})
    return sorted(out, key=lambda c: (c["distance_km"] is None, c["distance_km"] or 0, c["chc_id"]))


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def _reach(chc: Chc, farm: tuple[float, float] | None, district: str | None, max_km: float) -> float | None | bool:
    """Distance in km if reachable, None if reachable but distance unknown, False if out of reach."""
    if farm is not None:
        dist = haversine_km(farm, (chc.lat, chc.lon))
        return dist if dist <= max_km else False
    if district and chc.district.strip().lower() == district.strip().lower():
        return None
    return False


def _suggest_machine(reachable, capacities) -> str | None:
    """The machine to ask the department for: the fastest one that CHCs in reach own, else the fastest sowing machine."""
    owned = {m.type for chc, _ in reachable for m in chc.machines if m.type in capacities}
    if owned:
        return max(owned, key=lambda t: capacities[t])
    return "happy_seeder" if "happy_seeder" in capacities else None
