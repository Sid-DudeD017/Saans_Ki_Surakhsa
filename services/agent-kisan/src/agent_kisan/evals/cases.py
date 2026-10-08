"""Farm cases with hidden true answers, and how each simulated farmer talks.

Generated from a seed, so a run can be repeated exactly. Dates start a few days after the
day the run is made, so the cases stay in the future whenever you run them.
"""

import random
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta

from agent_kisan.coverage import estimate_coverage
from agent_kisan.units import ACRES_PER_HECTARE

# Real towns, so the agent sees familiar names. Spellings in Latin, Gurmukhi and Devanagari for scoring.
PLACES = [
    ("Sangrur", ["Sangrur", "ਸੰਗਰੂਰ", "संगरूर"], [
        ["Bhawanigarh", "ਭਵਾਨੀਗੜ੍ਹ", "भवानीगढ़"], ["Sunam", "ਸੁਨਾਮ", "सुनाम"], ["Dhuri", "ਧੂਰੀ", "धूरी"],
        ["Lehragaga", "ਲਹਿਰਾਗਾਗਾ", "लहरागागा"], ["Dirba", "ਦਿੜ੍ਹਬਾ", "दिड़बा"]]),
    ("Patiala", ["Patiala", "ਪਟਿਆਲਾ", "पटियाला"], [
        ["Samana", "ਸਮਾਣਾ", "समाना"], ["Rajpura", "ਰਾਜਪੁਰਾ", "राजपुरा"], ["Nabha", "ਨਾਭਾ", "नाभा"]]),
]
MACHINES = ["happy_seeder", "super_seeder", "mulcher_rmb", "baler"]
LANGUAGES = [("pa", 0.45), ("hi", 0.30), ("en", 0.10), ("mixed", 0.15)]


@dataclass(frozen=True)
class Truth:
    village: str
    village_aliases: tuple[str, ...]
    district: str
    district_aliases: tuple[str, ...]
    paddy_value: float  # in the farmer's own unit
    paddy_unit: str
    paddy_acres: float
    variety: str | None
    harvest_date: date
    wheat_deadline: date
    tractors: int
    machines: dict[str, float]
    decomposer_acres: float

    def coverage_pct(self) -> int:
        return estimate_coverage(self.paddy_acres, (self.wheat_deadline - self.harvest_date).days, self.machines,
                                 tractors=self.tractors, decomposer_acres=self.decomposer_acres).coverage_pct


@dataclass(frozen=True)
class Persona:
    language: str  # pa, hi, en, mixed
    numbers: str  # words, digits, mixed
    style: str  # one_at_a_time, all_at_once, rambling
    corrects_mid_way: bool  # first gives a wrong tractor count, then corrects it
    vague_date_first: bool  # "after Diwali" before giving a day
    taps_buttons: bool


@dataclass(frozen=True)
class Case:
    id: str
    truth: Truth
    persona: Persona
    tags: tuple[str, ...] = field(default=())

    def to_json(self) -> dict:
        d = asdict(self)
        for k in ("harvest_date", "wheat_deadline"):
            d["truth"][k] = d["truth"][k].isoformat()
        return d


def make_cases(n: int, seed: int = 7, today: date | None = None) -> list[Case]:
    rng = random.Random(seed)
    start = (today or date.today()) + timedelta(days=3)
    return [_case(rng, i, start) for i in range(n)]


def _case(rng: random.Random, i: int, start: date) -> Case:
    district, district_aliases, villages = rng.choice(PLACES)
    village_aliases = rng.choice(villages)

    unit = rng.choices(["killa", "acre", "hectare"], [0.6, 0.25, 0.15])[0]
    if unit == "hectare":
        value = rng.choice([1, 1.5, 2, 3, 4, 5, 6, 8, 10])
        acres = value * ACRES_PER_HECTARE
    else:
        value = rng.choice([rng.randint(2, 40), rng.randint(2, 20) + 0.5])
        acres = float(value)

    variety = rng.choices(["PR-126", "Pusa-44", None], [0.5, 0.3, 0.2])[0]
    harvest = start + timedelta(days=rng.randint(0, 25))
    deadline = harvest + timedelta(days=rng.randint(15, 30))
    tractors = rng.choices([0, 1, 2, 3], [0.1, 0.55, 0.25, 0.1])[0]
    machines = {} if rng.random() < 0.2 else {
        m: rng.choice([1, 2, 2, 3, 4, 5, 6, 2.5, 1.5]) for m in rng.sample(MACHINES, rng.randint(1, 2))
    }
    if machines and tractors == 0:
        tractors = 1  # machines need a tractor to pull them
    decomposer = float(rng.randint(1, 5)) if rng.random() < 0.15 else 0.0

    persona = Persona(
        language=rng.choices([l for l, _ in LANGUAGES], [w for _, w in LANGUAGES])[0],
        numbers=rng.choices(["words", "digits", "mixed"], [0.5, 0.3, 0.2])[0],
        style=rng.choices(["one_at_a_time", "all_at_once", "rambling"], [0.6, 0.2, 0.2])[0],
        corrects_mid_way=rng.random() < 0.2,
        vague_date_first=rng.random() < 0.25,
        taps_buttons=rng.random() < 0.7,
    )
    truth = Truth(village_aliases[0], tuple(village_aliases), district, tuple(district_aliases), value, unit,
                  round(acres, 4), variety, harvest, deadline, tractors, machines, decomposer)
    tags = tuple(t for t, on in [
        (persona.language, True), (f"numbers:{persona.numbers}", True), (persona.style, True),
        ("corrects", persona.corrects_mid_way), ("vague_date", persona.vague_date_first),
        (f"unit:{unit}", True), ("no_machines", not machines), ("fraction", value % 1 != 0),
    ] if on)
    return Case(f"case-{i:03d}", truth, persona, tags)
