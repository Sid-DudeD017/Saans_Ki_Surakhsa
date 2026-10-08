"""The read-back, as a card for the screen and a script spoken aloud for farmers who don't read.

Numbers the farmer gave are read exactly in words or, if the tables can't say them, the script
says "see the card". Numbers the service worked out (coverage %, acres still short) may be
rounded and are then introduced with "about". tts.py speaks the script, sentence by sentence.
The phrasing needs a native speaker's check.
"""

from dataclasses import dataclass
from datetime import date

from agent_kisan.guard import _MACHINES, _MONTHS, _UNITS
from agent_kisan.numbers import spoken

SPOKEN_LANGUAGES = ("pa", "hi")

PHRASES = {
    "pa": {
        "intro": "ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਇਹ ਹੈ।", "paddy": "ਝੋਨਾ", "harvest": "ਵਾਢੀ", "sowing_by": "ਕਣਕ ਦੀ ਬਿਜਾਈ",
        "until": "ਤੱਕ", "tractors": "ਟਰੈਕਟਰ", "no_tractors": "ਕੋਈ ਟਰੈਕਟਰ ਨਹੀਂ", "days": "ਦਿਨ",
        "no_machines": "ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ", "decomposer": "ਡੀਕੰਪੋਜ਼ਰ ਛਿੜਕਾਅ", "own_cover": "ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ ਨਾਲ",
        "about": "ਲਗਭਗ", "percent": "ਪ੍ਰਤੀਸ਼ਤ", "chc_booking": "ਸੀ ਐਚ ਸੀ ਤੋਂ ਬੁਕਿੰਗ", "after_booking": "ਬੁਕਿੰਗ ਨਾਲ",
        "still_short": "ਹਾਲੇ ਵੀ ਬਾਕੀ", "help_request": "ਇਸ ਲਈ ਮਦਦ ਦੀ ਬੇਨਤੀ ਭੇਜੀ ਜਾਵੇਗੀ।",
        "all_covered": "ਸਾਰਾ ਝੋਨਾ ਬਿਨਾਂ ਅੱਗ ਦੇ ਸਾਂਭਿਆ ਜਾਵੇਗਾ।", "see_card": "ਕਾਰਡ ਉੱਤੇ ਵੇਖੋ",
        "confirm": "ਕੀ ਇਹ ਸਭ ਠੀਕ ਹੈ? ਹਾਂ ਜਾਂ ਨਹੀਂ ਦੱਸੋ।",
    },
    "hi": {
        "intro": "आपकी जानकारी यह है।", "paddy": "धान", "harvest": "कटाई", "sowing_by": "गेहूँ की बुवाई",
        "until": "तक", "tractors": "ट्रैक्टर", "no_tractors": "कोई ट्रैक्टर नहीं", "days": "दिन",
        "no_machines": "कोई मशीन नहीं", "decomposer": "डीकंपोज़र छिड़काव", "own_cover": "आपकी मशीनों से",
        "about": "लगभग", "percent": "प्रतिशत", "chc_booking": "सी एच सी से बुकिंग", "after_booking": "बुकिंग के साथ",
        "still_short": "अभी भी बाकी", "help_request": "इसके लिए मदद का अनुरोध भेजा जाएगा।",
        "all_covered": "सारा धान बिना आग के संभाला जाएगा।", "see_card": "कार्ड पर देखें",
        "confirm": "क्या यह सब सही है? हाँ या नहीं बताइए।",
    },
}
_UNIT_KEYS = ("killa", "acre", "hectare", "bigha")


@dataclass(frozen=True)
class Readback:
    sentences: list[str]  # empty when the language has no voice (English: card only)
    card: dict

    @property
    def text(self) -> str:
        return " ".join(self.sentences)


def build(profile: dict, coverage: dict, plan: dict, language: str) -> Readback:
    """profile: FarmProfile.to_json(); coverage: the coverage json; plan: the zero-burn plan json."""
    voiced = language in SPOKEN_LANGUAGES
    lang = language if voiced else "pa"
    ph, months_v, machines_v, units_v = PHRASES[lang], _MONTHS[lang], _MACHINES[lang], _UNITS[lang]
    units, months, machines = (_UNITS.get(language, _UNITS["en"]), _MONTHS.get(language, _MONTHS["en"]),
                               _MACHINES.get(language, _MACHINES["en"]))
    unit = profile["paddy_unit"] if profile["paddy_unit"] in _UNIT_KEYS else "acre"
    say, items = [ph["intro"]], []

    def exact(value):  # the farmer's own number: in words, or point at the card
        return spoken(value, lang) or ph["see_card"]

    def about(value, step):  # a number we worked out: exact if we can say it, else "about" the nearest step
        if (words := spoken(value, lang)) is not None:
            return words
        near = round(value / step) * step
        return f"{ph['about']} {spoken(near, lang)}" if spoken(near, lang) else ph["see_card"]

    def day_month(iso):
        d = date.fromisoformat(iso)
        return f"{spoken(d.day, lang)} {months_v[d.month - 1]}", f"{d.day} {months[d.month - 1]}"

    say.append(f"{ph['paddy']} {exact(profile['paddy_area'])} {units_v[unit]}।")
    items.append({"kind": "paddy", "icon": "field", "value": _n(profile["paddy_area"]), "unit": units.get(unit, unit)})
    harvest_v, harvest = day_month(profile["harvest_date"])
    deadline_v, deadline = day_month(profile["wheat_deadline"])
    say.append(f"{ph['harvest']} {harvest_v}, {ph['sowing_by']} {deadline_v} {ph['until']}।")
    items += [{"kind": "harvest", "icon": "calendar", "value": harvest},
              {"kind": "wheat_by", "icon": "calendar", "value": deadline}]
    say.append(f"{exact(profile['tractors'])} {ph['tractors']}।" if profile["tractors"] else f"{ph['no_tractors']}।")
    items.append({"kind": "tractors", "icon": "tractor", "value": _n(profile["tractors"])})
    owned = sorted((profile["machines"] or {}).items())
    say.append(", ".join(f"{machines_v[m]} {exact(d)} {ph['days']}" for m, d in owned) + "।" if owned
               else f"{ph['no_machines']}।")
    items += [{"kind": "machine", "icon": m, "label": machines.get(m, m), "value": _n(d), "unit": units["days"]}
              for m, d in owned]
    if profile.get("decomposer_acres"):
        say.append(f"{ph['decomposer']} {exact(profile['decomposer_acres'])} {units_v[unit]}।")
        items.append({"kind": "decomposer", "icon": "spray", "value": _n(profile["decomposer_acres"]),
                      "unit": units.get(unit, unit)})

    say.append(f"{ph['own_cover']} {about(coverage['coverage_pct'], 10)} {ph['percent']}।")
    items.append({"kind": "coverage", "icon": "check", "value": f"{coverage['coverage_pct']}%"})
    for b in plan.get("plan", []):
        when_v, when = day_month(b["date"])
        say.append(f"{ph['chc_booking']}: {machines_v[b['machine']]}, {when_v}।")
        items.append({"kind": "booking", "icon": b["machine"], "label": machines.get(b["machine"], b["machine"]),
                      "value": when, "chc": b["chc_name"], "acres": b["acres"], "cost_inr": b["cost_inr"]})
    if plan.get("plan"):
        after = plan.get("coverage_after_pct", coverage["coverage_pct"])
        say.append(f"{ph['after_booking']} {about(after, 10)} {ph['percent']}।")
        items.append({"kind": "coverage_after", "icon": "check", "value": f"{after}%"})
    short = round(sum(u["acres"] for u in plan.get("unmet", [])), 2)
    if short > 0:
        short_unit = "killa" if unit == "killa" else "acre"
        say.append(f"{ph['still_short']} {about(short, 0.5)} {units_v[short_unit]}। {ph['help_request']}")
        items.append({"kind": "short", "icon": "help", "value": _n(short), "unit": units[short_unit]})
    else:
        say.append(ph["all_covered"])
    say.append(ph["confirm"])
    return Readback(say if voiced else [], {"language": language, "items": items, "spoken": voiced})


def _n(x) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:g}"
