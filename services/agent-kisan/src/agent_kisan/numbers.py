"""Numbers in what a farmer says: digits in any script, and number words in Punjabi, Hindi,
romanised Punjabi/Hindi and English, including dedh (1.5), dhai (2.5), sava (+¼), saadhe (+½),
paune (−¼) and sau (×100).

Covered words: 0–50 in Gurmukhi and Devanagari, every ten up to 100, and the common romanised
spellings up to 30 plus tens. Digits always work. The word tables need a check by a native speaker.

Each number is tagged with what it counts, from the word next to it: area (ਕਿੱਲੇ, एकड़, acre…),
tractors, days, or a month (so a date). A number with none of these nearby is "bare", like a
one-word answer to a question.

Known false positive: Hindi "do / दो" also means "give" (भेज दो), so it can add a stray bare 2.
"""

import re
import unicodedata
from dataclasses import dataclass

# Marks that ASR and people spell inconsistently: nukta, bindi, tippi, addak, chandrabindu, anusvara.
_DROP = dict.fromkeys(map(ord, "਼ਂੰੱ़ँं"))
_DIGITS = {**{0x0A66 + i: str(i) for i in range(10)}, **{0x0966 + i: str(i) for i in range(10)}}

_GURMUKHI = """
0 ਸਿਫ਼ਰ | 1 ਇੱਕ ਇਕ | 2 ਦੋ | 3 ਤਿੰਨ | 4 ਚਾਰ | 5 ਪੰਜ | 6 ਛੇ | 7 ਸੱਤ | 8 ਅੱਠ | 9 ਨੌਂ ਨੌ | 10 ਦਸ
11 ਗਿਆਰਾਂ | 12 ਬਾਰਾਂ | 13 ਤੇਰਾਂ | 14 ਚੌਦਾਂ | 15 ਪੰਦਰਾਂ | 16 ਸੋਲਾਂ | 17 ਸਤਾਰਾਂ | 18 ਅਠਾਰਾਂ | 19 ਉੱਨੀ | 20 ਵੀਹ
21 ਇੱਕੀ | 22 ਬਾਈ | 23 ਤੇਈ | 24 ਚੌਵੀ | 25 ਪੱਚੀ | 26 ਛੱਬੀ | 27 ਸਤਾਈ | 28 ਅਠਾਈ | 29 ਉਣੱਤੀ | 30 ਤੀਹ
31 ਇਕੱਤੀ | 32 ਬੱਤੀ | 33 ਤੇਤੀ | 34 ਚੌਂਤੀ | 35 ਪੈਂਤੀ | 36 ਛੱਤੀ | 37 ਸੈਂਤੀ | 38 ਅਠੱਤੀ | 39 ਉਣਤਾਲੀ | 40 ਚਾਲੀ
41 ਇਕਤਾਲੀ | 42 ਬਤਾਲੀ | 43 ਤਰਤਾਲੀ | 44 ਚੁਤਾਲੀ | 45 ਪੰਤਾਲੀ | 46 ਛਿਆਲੀ | 47 ਸੰਤਾਲੀ | 48 ਅਠਤਾਲੀ | 49 ਉਣੰਜਾ | 50 ਪੰਜਾਹ
60 ਸੱਠ | 70 ਸੱਤਰ | 80 ਅੱਸੀ | 90 ਨੱਬੇ | 100 ਸੌ
"""
_DEVANAGARI = """
0 शून्य | 1 एक | 2 दो | 3 तीन | 4 चार | 5 पाँच पांच | 6 छह छः छे | 7 सात | 8 आठ | 9 नौ | 10 दस
11 ग्यारह | 12 बारह | 13 तेरह | 14 चौदह | 15 पंद्रह | 16 सोलह | 17 सत्रह | 18 अठारह | 19 उन्नीस | 20 बीस
21 इक्कीस | 22 बाईस | 23 तेईस | 24 चौबीस | 25 पच्चीस | 26 छब्बीस | 27 सत्ताईस | 28 अट्ठाईस | 29 उनतीस | 30 तीस
31 इकतीस | 32 बत्तीस | 33 तैंतीस | 34 चौंतीस | 35 पैंतीस | 36 छत्तीस | 37 सैंतीस | 38 अड़तीस | 39 उनतालीस | 40 चालीस
41 इकतालीस | 42 बयालीस | 43 तैंतालीस | 44 चवालीस | 45 पैंतालीस | 46 छियालीस | 47 सैंतालीस | 48 अड़तालीस | 49 उनचास | 50 पचास
60 साठ | 70 सत्तर | 80 अस्सी | 90 नब्बे | 100 सौ
"""
# "saath" (60) is left out: in Hindi it also means "with".
_ROMAN = """
0 zero shunya sifar | 1 one ek ik ikk | 2 two do | 3 three teen tin tinn | 4 four char chaar | 5 five panj paanch panch
6 six chhe chhah chheh che | 7 seven saat sat satt | 8 eight aath ath atth | 9 nine nau naun | 10 ten das dus
11 eleven gyarah gyara gyaran giaran | 12 twelve barah bara baran baaran | 13 thirteen terah tera teran
14 fourteen chaudah chauda chaudan | 15 fifteen pandrah pandra pandran | 16 sixteen solah sola solan
17 seventeen satrah satra sataran satara | 18 eighteen atharah athara atharan athaaraan athaaran athra
19 nineteen unnis unni | 20 twenty bees bis veeh vih | 21 ikkis ikki | 22 baais bais baai | 23 teis tei
24 chaubis chauvi | 25 pachchis pachis pachi pacchi | 26 chhabbis chhabbi | 27 sattais satai sattai
28 atthais athais athai atthai | 29 untis unatti | 30 thirty tees tih teeh | 40 forty chalis chaali
50 fifty pachas panjah | 60 sixty | 70 seventy sattar | 80 eighty assi | 90 ninety nabbe | 100 hundred sau
"""
_FRACTIONS = {"dedh": 1.5, "derh": 1.5, "ਡੇਢ": 1.5, "डेढ़": 1.5, "dhai": 2.5, "dhaai": 2.5, "ਢਾਈ": 2.5, "ढाई": 2.5,
              "half": 0.5, "aadha": 0.5, "adha": 0.5, "aadhi": 0.5, "adhi": 0.5, "ਅੱਧਾ": 0.5, "ਅੱਧੀ": 0.5,
              "आधा": 0.5, "आधी": 0.5}
_PREFIXES = {"sava": 0.25, "sawa": 0.25, "ਸਵਾ": 0.25, "सवा": 0.25, "saadhe": 0.5, "sadhe": 0.5, "ਸਾਢੇ": 0.5,
             "साढ़े": 0.5, "paune": -0.25, "pone": -0.25, "ਪੌਣੇ": -0.25, "पौने": -0.25}
_MULTIPLIERS = {"sau": 100, "hundred": 100, "ਸੌ": 100, "सौ": 100, "hazaar": 1000, "hazar": 1000, "thousand": 1000,
                "ਹਜ਼ਾਰ": 1000, "हज़ार": 1000}
_NEGATIONS = {"nahi", "nahin", "nai", "no", "none", "ਨਹੀਂ", "नहीं", "koi"}
_KINDS = {
    "area": "killa kila kille killa ਕਿੱਲੇ ਕਿੱਲਾ ਕਿੱਲਿਆਂ किल्ले किल्ला acre acres ekad ekar ਏਕੜ एकड़ hectare hectares ha "
            "ਹੈਕਟੇਅਰ हेक्टेयर bigha bighe ਬਿੱਘੇ ਬਿੱਘਾ बीघा बीघे",
    "tractors": "tractor tractors ਟਰੈਕਟਰ ਟ੍ਰੈਕਟਰ ट्रैक्टर ट्रेक्टर",
    "days": "din dino dinon day days ਦਿਨ ਦਿਨਾਂ दिन दिनों",
    "month": "january february march april may june july august september october november december jan feb mar "
             "apr jun jul aug sep sept oct nov dec ਜਨਵਰੀ ਫ਼ਰਵਰੀ ਮਾਰਚ ਅਪ੍ਰੈਲ ਮਈ ਜੂਨ ਜੁਲਾਈ ਅਗਸਤ ਸਤੰਬਰ ਅਕਤੂਬਰ ਨਵੰਬਰ "
             "ਦਸੰਬਰ जनवरी फ़रवरी मार्च अप्रैल मई जून जुलाई अगस्त सितंबर अक्टूबर अक्तूबर नवंबर दिसंबर",
}
# "Sat Sri Akal": the greeting's "sat" is not 7.
_GREETING_NEXT = {"ਸ੍ਰੀ", "ਸ਼੍ਰੀ", "sri", "shri"}
_EN_TENS = {"twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"}
_EN_ONES = {"one", "two", "three", "four", "five", "six", "seven", "eight", "nine"}


def normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower().translate(_DROP).translate(_DIGITS)


def _table(*blocks: str) -> dict[str, float]:
    words: dict[str, float] = {}
    for block in blocks:
        for entry in block.replace("\n", "|").split("|"):
            if not entry.strip():
                continue
            value, *spellings = entry.split()
            for w in spellings:
                key = normalize(w)
                if words.get(key, float(value)) != float(value):
                    raise ValueError(f"{w!r} would mean both {words[key]} and {value}")
                words[key] = float(value)
    return words


WORDS = _table(_GURMUKHI, _DEVANAGARI, _ROMAN)
FRACTIONS = {normalize(k): v for k, v in _FRACTIONS.items()}
PREFIXES = {normalize(k): v for k, v in _PREFIXES.items()}
MULTIPLIERS = {normalize(k): v for k, v in _MULTIPLIERS.items()}
NEGATIONS = {normalize(k) for k in _NEGATIONS}
KIND_OF = {normalize(w): kind for kind, words in _KINDS.items() for w in words.split()}
GREETING_NEXT = {normalize(w) for w in _GREETING_NEXT}
_NUMBER = re.compile(r"\d+(?:\.\d+)?$")


@dataclass(frozen=True)
class Mention:
    value: float
    text: str
    kind: str | None = None  # area, tractors, days, month, or None for a bare number


def tokens(text: str) -> list[str]:
    """Words (letters plus their vowel signs, so Gurmukhi and Devanagari stay whole) and numbers."""
    out, cur = [], []
    for ch in normalize(text):
        cat = unicodedata.category(ch)
        if cat[0] in "LM" or cat == "Nd" or (ch == "." and cur and cur[-1].isdigit()):
            cur.append(ch)
        elif cur:
            out.append("".join(cur).rstrip("."))
            cur = []
    if cur:
        out.append("".join(cur).rstrip("."))
    return [t for t in out if t]


def _base(tok: str) -> float | None:
    if _NUMBER.match(tok):
        return float(tok)
    return WORDS.get(tok, FRACTIONS.get(tok))


def numbers_in(text: str) -> list[Mention]:
    toks = tokens(text)
    found: list[tuple[float, int, int]] = []  # value, first token, last token
    i = 0
    while i < len(toks):
        start, delta = i, 0.0
        if toks[i] in PREFIXES and i + 1 < len(toks) and _base(toks[i + 1]) is not None:
            delta, i = PREFIXES[toks[i]], i + 1
        value = _base(toks[i])
        if value is None or (i + 1 < len(toks) and toks[i + 1] in GREETING_NEXT and value == 7):
            i += 1
            continue
        if toks[i] in _EN_TENS and i + 1 < len(toks) and toks[i + 1] in _EN_ONES:
            i += 1
            value += WORDS[toks[i]]
        value += delta
        if i + 1 < len(toks) and toks[i + 1] in MULTIPLIERS and value < 100:
            i += 1
            value *= MULTIPLIERS[toks[i]]
        found.append((value, start, i))
        i += 1
    kinds = _tag(toks, [(a, b) for _, a, b in found])
    return [Mention(v, " ".join(toks[a:b + 1]), k) for (v, a, b), k in zip(found, kinds)]


def _tag(toks: list[str], spans: list[tuple[int, int]]) -> list[str | None]:
    """Give each tagging word to its nearest number within two tokens (the number before it on a tie)."""
    best: list[tuple[int, str] | None] = [None] * len(spans)
    for k, tok in enumerate(toks):
        kind = KIND_OF.get(tok)
        if kind is None:
            continue
        choices = []
        for n, (a, b) in enumerate(spans):
            if b < k:
                choices.append((k - b, 0, n))
            elif a > k:
                choices.append((a - k, 1, n))
        if not choices:
            continue
        dist, _, n = min(choices)
        if dist <= 2 and (best[n] is None or dist < best[n][0]):
            best[n] = (dist, kind)
    return [b[1] if b else None for b in best]


def says_none(text: str) -> bool:
    """Does the farmer say no / none (so a recorded 0 was heard)?"""
    return any(t in NEGATIONS for t in tokens(text))
