"""Gurpreet's conversation against the real model. Costs a few cents.

    uv run python scripts/smoke_gurpreet.py

Run with AWS_PROFILE=saans. Filed requests go to .outbox/ unless SAANS_API_URL points at P4's mock.
"""

import json
import time

from agent_kisan.agent import KisanChat

TURNS = [
    "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ। ਮੈਂ ਗੁਰਪ੍ਰੀਤ, ਪਿੰਡ ਭਵਾਨੀਗੜ੍ਹ, ਜ਼ਿਲ੍ਹਾ ਸੰਗਰੂਰ। ਮੇਰੇ ਕੋਲ 18 ਕਿੱਲੇ ਝੋਨਾ ਹੈ, PR-126।",
    "ਵਾਢੀ 20 ਅਕਤੂਬਰ ਨੂੰ ਹੋਵੇਗੀ, ਕਣਕ 9 ਨਵੰਬਰ ਤੱਕ ਬੀਜਣੀ ਹੈ। ਇੱਕ ਟਰੈਕਟਰ ਹੈ, ਸੁਪਰ ਸੀਡਰ 2 ਦਿਨ ਲਈ ਮਿਲ ਸਕਦਾ ਹੈ।",
    "ਨਹੀਂ ਜੀ, ਡੀਕੰਪੋਜ਼ਰ ਨਹੀਂ ਛਿੜਕਿਆ। ਹੋਰ ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ।",
    "ਹਾਂ ਜੀ, ਸਭ ਠੀਕ ਹੈ। ਭੇਜ ਦਿਓ।",
    "ਹਾਂ ਜੀ।",
]

chat = KisanChat()
for text in TURNS:
    if chat.session.filed:
        break
    start = time.time()
    reply = chat.send(text)
    print(f"farmer: {text}\nsaathi ({time.time() - start:.1f}s): {reply}\n")

s = chat.session
print("profile:", json.dumps(s.profile.to_json(), ensure_ascii=False))
print("missing:", s.profile.missing())
if s.filed:
    request = s.filed["request"]
    print("filed:", s.filed["receipt"])
    print("coverage:", request["coverage"])
    print("plan:", request["plan"])
    print("unmet:", request["unmet"])
    assert request["coverage"]["coverage_pct"] == 61 and request["coverage"]["gap_acres"] == 7
    assert [b["date"] for b in request["plan"]] == ["2026-11-02"]
    assert request["unmet"][0]["acres"] == 1.5
    print("PASS: 61%, one CHC Super Seeder day, 1.5 acres filed after read-back")
else:
    print("NOT FILED: read the transcript above to see where it stopped")
