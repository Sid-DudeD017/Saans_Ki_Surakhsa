"""The farmer's request status, and the SMS sent when it changes.

Command reports progress on a help request (seen, machine assigned, in the field, done);
Kisan keeps the history for the farmer's status page and texts the farmer at the steps that
matter. A farmer who files a complaint (a kisan_grievance) can also ask for its ticket number
by SMS ("ticket", K22); Command never sees the farmer's number. The messages are fixed templates with a few blanks: India's DLT rules need SMS templates
registered in advance, and these are the ones to register.

KISAN_SMS=sns sends through Amazon SNS (transactional SMS); anything else writes to a local
outbox, which is also the fallback the plan names if SMS to Indian numbers is blocked.
"""

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

from agent_kisan.schemas import india_now

STATUSES = ("filed", "seen", "machine_assigned", "in_field", "action_taken", "closed")
TEXTED = {"filed", "machine_assigned", "action_taken"}  # the rest only update the status page
_PHONE = re.compile(r"^\+91[6-9]\d{9}$")

TEMPLATES = {
    "pa": {
        "filed": "ਸਾਂਸ: ਤੁਹਾਡੀ ਮਦਦ ਦੀ ਬੇਨਤੀ ਖੇਤੀਬਾੜੀ ਵਿਭਾਗ ਕੋਲ ਪਹੁੰਚ ਗਈ ਹੈ। ਬਾਕੀ {acres} ਏਕੜ।",
        "machine_assigned": "ਸਾਂਸ: {machine} {date} ਨੂੰ {chc} ਤੋਂ ਆਵੇਗਾ। ਫ਼ੋਨ {chc_phone}",
        "action_taken": "ਸਾਂਸ: ਤੁਹਾਡੇ ਖੇਤ ਦਾ ਕੰਮ ਹੋ ਗਿਆ ਹੈ। ਪਰਾਲੀ ਨਾ ਸਾੜਨ ਲਈ ਧੰਨਵਾਦ।",
        "ticket": "ਸਾਂਸ: ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਮਿਲ ਗਈ ਹੈ। ਟਿਕਟ ਨੰਬਰ {ticket}। ਇਹ ਨੰਬਰ ਸੰਭਾਲ ਕੇ ਰੱਖੋ।",
    },
    "hi": {
        "filed": "साँस: आपका मदद अनुरोध कृषि विभाग को मिल गया है। बाकी {acres} एकड़।",
        "machine_assigned": "साँस: {machine} {date} को {chc} से आएगा। फ़ोन {chc_phone}",
        "action_taken": "साँस: आपके खेत का काम हो गया है। पराली न जलाने के लिए धन्यवाद।",
        "ticket": "साँस: आपकी शिकायत मिल गई है। टिकट नंबर {ticket}। यह नंबर सँभालकर रखें।",
    },
    "en": {
        "filed": "Saans: your help request has reached the agriculture department. {acres} acres still short.",
        "machine_assigned": "Saans: a {machine} from {chc} will come on {date}. Phone {chc_phone}",
        "action_taken": "Saans: the work on your field is done. Thank you for not burning the stubble.",
        "ticket": "Saans: we have your complaint. Ticket number {ticket}. Keep this number.",
    },
}


class Notifier(Protocol):
    def send(self, phone: str, text: str) -> dict: ...


class SnsSms:
    def __init__(self, region: str | None = None, sender_id: str | None = None):
        import boto3

        self.client = boto3.client("sns", region_name=region or os.environ.get("KISAN_BEDROCK_REGION", "ap-south-1"))
        self.sender_id = sender_id or os.environ.get("KISAN_SMS_SENDER_ID")

    def send(self, phone: str, text: str) -> dict:
        attrs = {"AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"}}
        if self.sender_id:  # India: the DLT-registered sender ID
            attrs["AWS.SNS.SMS.SenderID"] = {"DataType": "String", "StringValue": self.sender_id}
        res = self.client.publish(PhoneNumber=phone, Message=text, MessageAttributes=attrs)
        return {"via": "sns", "message_id": res.get("MessageId")}


class OutboxNotifier:
    def __init__(self, path: Path | None = None):
        self.path = path or Path(os.environ.get("KISAN_SMS_OUTBOX", ".outbox/sms.jsonl"))

    def send(self, phone: str, text: str) -> dict:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"to": phone, "text": text, "at": _now()}, ensure_ascii=False) + "\n")
        return {"via": "outbox", "path": str(self.path)}


def default_notifier() -> Notifier:
    return SnsSms() if os.environ.get("KISAN_SMS") == "sns" else OutboxNotifier()


def valid_phone(phone: str) -> bool:
    """An Indian mobile number in +91 form."""
    return bool(_PHONE.match(phone))


def masked(phone: str | None) -> str | None:
    return None if not phone else phone[:3] + "*" * (len(phone) - 7) + phone[-4:]


@dataclass
class RequestStatus:
    history: list[dict] = field(default_factory=list)

    @property
    def current(self) -> str | None:
        return self.history[-1]["status"] if self.history else None

    def record(self, status: str, language: str, phone: str | None, notifier: Notifier, **detail) -> dict:
        if status not in STATUSES:
            raise ValueError(f"unknown status {status!r}; one of {', '.join(STATUSES)}")
        entry = {"status": status, "at": _now(), **{k: v for k, v in detail.items() if v is not None}}
        if status in TEXTED and phone:
            text = sms_text(status, language, **detail)
            try:
                entry["sms"] = {"to": masked(phone), **notifier.send(phone, text)}
            except Exception as e:  # a failed SMS must not lose the status change
                entry["sms"] = {"to": masked(phone), "error": f"{type(e).__name__}: {e}"}
        self.history.append(entry)
        return entry


def sms_text(status: str, language: str, **detail) -> str:
    template = TEMPLATES.get(language, TEMPLATES["en"])[status]
    blanks = {"acres": "", "machine": "", "chc": "", "date": "", "chc_phone": "", "ticket": ""}
    return template.format(**{**blanks, **{k: v for k, v in detail.items() if v is not None}}).strip()


def _now() -> str:
    return india_now()
