"""Spoken numbers in Punjabi, Hindi, romanised and English."""

import pytest

from agent_kisan.numbers import WORDS, numbers_in, normalize, says_none


def values(text):
    return [m.value for m in numbers_in(text)]


@pytest.mark.parametrize("text, expected", [
    ("ਮੇਰੇ ਕੋਲ ਅਠਾਰਾਂ ਕਿੱਲੇ ਝੋਨਾ ਹੈ", [18]),
    ("ਅਠਾਰਾ ਕਿਲੇ", [18]),                       # same word without bindi / addak
    ("ਮੇਰੇ ਕੋਲ ੧੮ ਕਿੱਲੇ", [18]),                 # Gurmukhi digits
    ("मेरे पास अठारह एकड़ है", [18]),
    ("१८ एकड़", [18]),                          # Devanagari digits
    ("mere kol athaaraan kille", [18]),
    ("eighteen acres", [18]),
    ("ਇੱਕ ਟਰੈਕਟਰ ਤੇ ਸੁਪਰ ਸੀਡਰ ਦੋ ਦਿਨ", [1, 2]),
    ("ਪੰਜਾਹ ਕਿੱਲੇ", [50]),
    ("ਚਾਲੀ", [40]),
    ("सैंतालीस", [47]),
    ("twenty five", [25]),
    ("2.5 din", [2.5]),
])
def test_whole_numbers(text, expected):
    assert values(text) == expected


@pytest.mark.parametrize("text, expected", [
    ("ਡੇਢ ਦਿਨ", [1.5]), ("ढाई दिन", [2.5]), ("dedh din", [1.5]),
    ("ਸਾਢੇ ਤਿੰਨ ਕਿੱਲੇ", [3.5]), ("साढ़े सात", [7.5]), ("saadhe 3", [3.5]),
    ("ਸਵਾ ਦੋ", [2.25]), ("सवा दो", [2.25]), ("paune chaar", [3.75]),
    ("ਅੱਧਾ ਕਿੱਲਾ", [0.5]),
])
def test_fractions(text, expected):
    assert values(text) == expected


@pytest.mark.parametrize("text, expected", [
    ("do sau acre", [200]), ("dedh sau", [150]), ("ਸੌ ਕਿੱਲੇ", [100]), ("डेढ़ सौ", [150]),
])
def test_hundreds(text, expected):
    assert values(text) == expected


def test_several_numbers_in_one_message():
    text = "ਵਾਢੀ 20 ਅਕਤੂਬਰ ਨੂੰ, ਕਣਕ 9 ਨਵੰਬਰ ਤੱਕ, ਇੱਕ ਟਰੈਕਟਰ, ਸੁਪਰ ਸੀਡਰ 2 ਦਿਨ"
    assert values(text) == [20, 9, 1, 2]


def test_ordinary_words_are_not_numbers():
    assert values("ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਮੈਂ ਗੁਰਪ੍ਰੀਤ ਹਾਂ") == []  # the greeting's ਸਤ is not 7
    assert values("sat sri akal ji") == []
    assert values("ਸੱਤ ਕਿੱਲੇ") == [7]
    assert values("mere saath chalo") == []  # saath = "with", not 60
    assert values("namaste ji, haan ji") == []


def test_no_word_means_two_numbers():
    assert len(WORDS) > 200  # the table loads; _table raises on any clash


def test_says_none():
    assert says_none("ਨਹੀਂ ਜੀ, ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ")
    assert says_none("koi tractor nahi")
    assert not says_none("haan ji")


def test_normalize_drops_inconsistent_marks():
    assert normalize("ਅਠਾਰਾਂ") == normalize("ਅਠਾਰਾ")
    assert normalize("पाँच") == normalize("पांच")


def test_numbers_are_tagged_by_the_word_next_to_them():
    kinds = [(m.value, m.kind) for m in numbers_in(
        "ਅਠਾਰਾਂ ਕਿੱਲੇ, ਵਾਢੀ ਵੀਹ ਅਕਤੂਬਰ, ਇੱਕ ਟਰੈਕਟਰ, ਸੁਪਰ ਸੀਡਰ ਦੋ ਦਿਨ, ਹਾਂ ਤਿੰਨ")]
    assert kinds == [(18, "area"), (20, "month"), (1, "tractors"), (2, "days"), (3, None)]


def test_tag_can_come_before_the_number():
    assert [(m.value, m.kind) for m in numbers_in("October 20 tak, tractor ik hai")] == [(20, "month"), (1, "tractors")]
