import pytest

from agent_kisan.units import UnknownUnitError, to_acres


@pytest.mark.parametrize("unit", ["acre", "acres", "killa", "Kille", " kila "])
def test_killa_is_an_acre(unit):
    assert to_acres(18, unit) == 18


def test_hectare():
    assert to_acres(1, "ha") == pytest.approx(2.47, abs=0.01)


def test_bigha_needs_a_state():
    with pytest.raises(UnknownUnitError, match="state"):
        to_acres(10, "bigha")


def test_bigha_for_unset_state_is_an_error_not_a_guess():
    with pytest.raises(UnknownUnitError, match="isn't set"):
        to_acres(10, "bigha", state="Punjab")


def test_bigha_uses_the_state_table():
    made_up = {"punjab": 0.25}  # not a real figure; just exercises the lookup
    assert to_acres(10, "bigha", state="Punjab", bigha_table=made_up) == 2.5


def test_unknown_unit():
    with pytest.raises(UnknownUnitError):
        to_acres(1, "marla-ish")


def test_negative_area():
    with pytest.raises(ValueError):
        to_acres(-1, "acre")
