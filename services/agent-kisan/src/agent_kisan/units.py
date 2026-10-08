"""Land units farmers use, converted to acres.

A killa is one acre in Punjab. A bigha differs from state to state (and sometimes
district to district), so its size comes from a table filled in from KVK or
revenue department figures. An unknown state is an error, never a guess.
"""

from collections.abc import Mapping

ACRES_PER_HECTARE = 2.47105

# Acres per bigha, by state. Fill in from KVK / revenue department data before use.
BIGHA_ACRES: dict[str, float] = {}

_UNIT_ALIASES = {
    "acre": "acre", "acres": "acre",
    "killa": "acre", "kila": "acre", "kille": "acre",
    "ha": "hectare", "hectare": "hectare", "hectares": "hectare",
    "bigha": "bigha", "bighas": "bigha",
}


def is_known_unit(unit: str) -> bool:
    return unit.strip().lower() in _UNIT_ALIASES


class UnknownUnitError(ValueError):
    """The unit, or the bigha size for a state, isn't known."""


def to_acres(
    value: float,
    unit: str,
    state: str | None = None,
    bigha_table: Mapping[str, float] = BIGHA_ACRES,
) -> float:
    if value < 0:
        raise ValueError(f"land area can't be negative: {value}")
    canonical = _UNIT_ALIASES.get(unit.strip().lower())
    if canonical is None:
        raise UnknownUnitError(f"unknown land unit: {unit!r}")
    if canonical == "acre":
        return float(value)
    if canonical == "hectare":
        return value * ACRES_PER_HECTARE
    if not state:
        raise UnknownUnitError("a bigha's size depends on the state; ask which state the farm is in")
    key = state.strip().lower()
    if key not in bigha_table:
        raise UnknownUnitError(f"bigha size for {state!r} isn't set; add it from KVK or revenue data")
    return value * bigha_table[key]
