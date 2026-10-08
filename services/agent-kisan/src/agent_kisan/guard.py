"""Number guard: every number the model records must be one the farmer actually said.

A recorded number is "heard" if the farmer said it for that kind of thing (see numbers.py):
"ਦੋ ਦਿਨ" counts for machine days, not tractors; a bare "ਦੋ" answering a question counts for
anything. 0 is heard if the farmer said no / none, and a date if its day of the month was said. Anything else is "unsure": the model may have misread a word, done its own
arithmetic or guessed. Unsure numbers block the read-back until the farmer says them again
or taps the quick reply, whose text carries the number.

This catches the model's mistakes, not the speech recogniser's: if the transcript itself
says 80 when the farmer said 18, only the read-back can catch it.
"""

from datetime import date

from agent_kisan.numbers import numbers_in, says_none

_UNITS = {
    "pa": {"acre": "ਏਕੜ", "killa": "ਕਿੱਲੇ", "hectare": "ਹੈਕਟੇਅਰ", "bigha": "ਬਿੱਘੇ", "tractors": "ਟਰੈਕਟਰ", "days": "ਦਿਨ",
           "decomposer": "ਡੀਕੰਪੋਜ਼ਰ"},
    "hi": {"acre": "एकड़", "killa": "किल्ले", "hectare": "हेक्टेयर", "bigha": "बीघा", "tractors": "ट्रैक्टर", "days": "दिन",
           "decomposer": "डीकंपोज़र"},
    "en": {"acre": "acres", "killa": "killa", "hectare": "hectares", "bigha": "bigha", "tractors": "tractors",
           "days": "days", "decomposer": "decomposer"},
}
_MACHINES = {
    "pa": {"happy_seeder": "ਹੈਪੀ ਸੀਡਰ", "super_seeder": "ਸੁਪਰ ਸੀਡਰ", "mulcher_rmb": "ਮਲਚਰ", "baler": "ਬੇਲਰ"},
    "hi": {"happy_seeder": "हैप्पी सीडर", "super_seeder": "सुपर सीडर", "mulcher_rmb": "मल्चर", "baler": "बेलर"},
    "en": {"happy_seeder": "Happy Seeder", "super_seeder": "Super Seeder", "mulcher_rmb": "Mulcher", "baler": "Baler"},
}
_MONTHS = {
    "pa": "ਜਨਵਰੀ ਫ਼ਰਵਰੀ ਮਾਰਚ ਅਪ੍ਰੈਲ ਮਈ ਜੂਨ ਜੁਲਾਈ ਅਗਸਤ ਸਤੰਬਰ ਅਕਤੂਬਰ ਨਵੰਬਰ ਦਸੰਬਰ".split(),
    "hi": "जनवरी फ़रवरी मार्च अप्रैल मई जून जुलाई अगस्त सितंबर अक्टूबर नवंबर दिसंबर".split(),
    "en": "January February March April May June July August September October November December".split(),
}


_SLOT_KIND = {"paddy_area": "area", "decomposer_acres": "area", "tractors": "tractors", "machines": "days",
              "harvest_date": "month", "wheat_deadline": "month"}


def numeric_slots(profile, explicitly_set: set[str]) -> list[tuple[str, float | date]]:
    """(slot, value) for every number in the profile that came from the conversation."""
    slots: list[tuple[str, float | date]] = []
    if profile.paddy_area is not None:
        slots.append(("paddy_area", profile.paddy_area))
    if profile.tractors is not None:
        slots.append(("tractors", profile.tractors))
    if "decomposer_acres" in explicitly_set:
        slots.append(("decomposer_acres", profile.decomposer_acres))
    for machine, days in sorted((profile.machines or {}).items()):
        slots.append((f"machines.{machine}", days))
    for name in ("harvest_date", "wheat_deadline"):
        if getattr(profile, name) is not None:
            slots.append((name, getattr(profile, name)))
    return slots


def unsure(profile, explicitly_set: set[str], messages: list[str], language: str) -> list[dict]:
    mentions = [m for text in messages for m in numbers_in(text)]
    said_none = any(says_none(text) for text in messages)
    out = []
    for slot, value in numeric_slots(profile, explicitly_set):
        number = value.day if isinstance(value, date) else value
        kind = _SLOT_KIND.get(slot.split(".")[0])
        heard = {round(m.value, 2) for m in mentions if m.kind in (kind, None)}
        if round(float(number), 2) in heard or (number == 0 and said_none):
            continue
        label = _label(slot, value, profile, language)
        out.append({"slot": slot, "value": value.isoformat() if isinstance(value, date) else value,
                    "label": label, "send_text": label})
    return out


def _label(slot: str, value, profile, language: str) -> str:
    lang = language if language in _UNITS else "en"
    units = _UNITS[lang]
    if isinstance(value, date):
        return f"{value.day} {_MONTHS[lang][value.month - 1]}"
    n = _num(value)
    if slot == "paddy_area":
        return f"{n} {units.get(profile.paddy_unit, profile.paddy_unit)}"
    if slot == "tractors":
        return f"{n} {units['tractors']}"
    if slot == "decomposer_acres":
        return f"{units['decomposer']} {n} {units[profile.paddy_unit] if profile.paddy_unit in units else units['acre']}"
    machine = slot.removeprefix("machines.")
    return f"{_MACHINES[lang].get(machine, machine)} {n} {units['days']}"


def _num(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else str(x)
