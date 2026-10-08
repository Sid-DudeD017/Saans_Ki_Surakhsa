"""A model plays one farmer: it knows the true answers and the persona, and replies like a voice note."""

import os
import re

from strands import Agent
from strands.models import BedrockModel

from agent_kisan.evals.cases import Case

# The farmer only needs to talk naturally, so a smaller, cheaper model is enough.
DEFAULT_FARMER_MODEL_ID = "in.anthropic.claude-haiku-4-5-20251001-v1:0"
END = "<<END>>"
_TAP = re.compile(r"^\s*TAP\s+(\d+)\s*$")

_LANGUAGE = {
    "pa": "Punjabi, written in Gurmukhi script",
    "hi": "Hindi, written in Devanagari script",
    "en": "simple English, as an Indian farmer would type it",
    "mixed": "a mix of Punjabi and Hindi with some English words, in romanised Latin letters",
}
_NUMBERS = {
    "words": "Say numbers as words in your language (ਅਠਾਰਾਂ, अठारह, athaaraan), including ਡੇਢ / ढाई for 1.5 / 2.5.",
    "digits": "Write numbers as digits (18, 2.5).",
    "mixed": "Sometimes write numbers as digits, sometimes as words.",
}
_STYLE = {
    "one_at_a_time": "Answer only what you are asked, in one or two short sentences.",
    "all_at_once": "In your first message, tell most of your farm details at once.",
    "rambling": "Talk a little about other things (weather, prices, family) along with your answers.",
}


def farmer_prompt(case: Case) -> str:
    t, p = case.truth, case.persona
    machines = ", ".join(f"{m.replace('_', ' ')} for {d} days" for m, d in t.machines.items()) or "no machines at all"
    quirks = []
    if p.corrects_mid_way:
        quirks.append(f"The first time you are asked about tractors, say {t.tractors + 1}; in your next message "
                      f"correct yourself to {t.tractors}.")
    if p.vague_date_first:
        quirks.append("The first time you are asked about the harvest date, answer vaguely (\"after Diwali\", "
                      "\"in a couple of weeks\"). Give the exact day only when asked again.")
    quirks.append("If the message ends with buttons and one is exactly right, reply with only TAP and its number "
                  "(for example: TAP 1)." if p.taps_buttons else "Never use buttons; always type your answer.")
    return f"""You are a paddy farmer in Punjab talking to the Kisan Saathi app about clearing stubble without burning. Stay in character. Never say you are an AI or a simulation.

Your farm (the true answers; never change them):
- Village {t.village}, district {t.district}
- Paddy: {t.paddy_value} {t.paddy_unit}{f', variety {t.variety}' if t.variety else ', you are not sure of the variety'}
- Harvest on {t.harvest_date:%d %B}; you must sow wheat by {t.wheat_deadline:%d %B}
- Tractors you can use: {t.tractors}
- Machines you can get: {machines}
- Bio-decomposer already sprayed: {f'{t.decomposer_acres:g} {t.paddy_unit}' if t.decomposer_acres else 'none'}
- You have no other land information. Never share Aadhaar, bank or land-record numbers; refuse if asked.

How you talk:
- Language: {_LANGUAGE[p.language]}.
- {_NUMBERS[p.numbers]}
- {_STYLE[p.style]}
- Keep each message short, like a voice note.
{chr(10).join('- ' + q for q in quirks)}

When the app reads your details back, check every one against your farm. If all are right, say yes. If anything is wrong, say what is wrong and give the right value. If the app says your request has been filed, or the conversation is clearly over, reply with only {END}.

Reply with only your next message."""


class SimulatedFarmer:
    def __init__(self, case: Case, model: BedrockModel | None = None):
        self.case = case
        self.agent = Agent(model=model or farmer_model(), system_prompt=farmer_prompt(case), callback_handler=None)
        self.usage = {"inputTokens": 0, "outputTokens": 0}

    def opening(self) -> str:
        return self._say("(You open the Kisan Saathi app. Send your first message.)")

    def reply(self, agent_text: str, quick_replies: list[dict]) -> str:
        """The farmer's next message, or END. A TAP picks a quick reply and sends its text."""
        buttons = "".join(f"\n[{i}] {q['label']}" for i, q in enumerate(quick_replies, 1))
        said = self._say(agent_text + (f"\n\nButtons:{buttons}" if buttons else ""))
        if (m := _TAP.match(said)) and 1 <= int(m.group(1)) <= len(quick_replies):
            return quick_replies[int(m.group(1)) - 1]["send_text"]
        return said

    def _say(self, text: str) -> str:
        result = self.agent(text)
        used = getattr(getattr(result, "metrics", None), "accumulated_usage", None) or {}
        self.usage = {k: used.get(k, self.usage[k]) for k in self.usage}
        return str(result).strip()


def farmer_model() -> BedrockModel:
    return BedrockModel(
        model_id=os.environ.get("KISAN_FARMER_MODEL_ID", DEFAULT_FARMER_MODEL_ID),
        region_name=os.environ.get("KISAN_BEDROCK_REGION", "ap-south-1"),
        max_tokens=600,
    )
