"""The Kisan Saathi agent: Strands on Amazon Bedrock, with tools bound to one KisanSession.

The model talks and decides which tool to call. Every number comes from the
coverage engine, and the filing rules live in KisanSession, not in the prompt.
"""

import json
import os
from datetime import date
from typing import TYPE_CHECKING

from strands import Agent, tool
from strands.models import BedrockModel
from strands.models.model import CacheConfig

from agent_kisan.filing import Filer, default_filer
from agent_kisan.session import KisanSession

if TYPE_CHECKING:
    from agent_kisan.transcribe import Transcript

# The best Claude model served from India-only inference (ap-south-1 "in." profile).
# global.anthropic.claude-opus-5-5 is newer, but global routing can send data outside India.
DEFAULT_MODEL_ID = "in.anthropic.claude-opus-5"
DEFAULT_REGION = "ap-south-1"

SYSTEM_PROMPT = """You are Kisan Saathi, part of the Saans app. You help farmers in Punjab and Haryana clear paddy stubble without burning it, and you get them help when they don't have enough machines. Saans exists to offer help before any penalty; you never threaten, judge or mention fines.

Language: reply in the language and script the farmer uses (Punjabi in Gurmukhi, Hindi in Devanagari, English, or a mix). Keep replies short and plain: many farmers will hear them read aloud. Ask for one or two details at a time.

What you need for each farm:
- village and district (the state is Punjab unless they say otherwise)
- paddy area and its unit: killa (= acre), acre, hectare or bigha
- paddy variety if they know it (PR-126 is short-duration, Pusa-44 long)
- harvest date, and the date by which they want to sow wheat
- how many tractors they can use
- which machines they can get and for how many days: Happy Seeder, Super Seeder, Mulcher with RMB plough, Baler with rake. No machines is a valid answer.
- acres already sprayed with decomposer, if any

How to work:
- Record details with update_farm_profile as soon as the farmer states them. Record only what they said or confirmed; never fill in a guess. If something is unclear, ask.
- Record numbers exactly as the farmer said them, in their unit. Don't add, convert or round. If a tool reports "unsure" numbers, ask the farmer to say each one again; the app also shows them as buttons to tap.
- Convert spoken dates to YYYY-MM-DD using today's date. If a date is vague ("Diwali ke baad"), ask for a day.
- Never work out coverage, acres, straw, pollution, dates or costs yourself. Call estimate_coverage and use its numbers exactly.
- Coverage and the plan leave out forecast rain days. If rain takes days away, say how many (get_rain_days).
- If there is a gap, call plan_zero_burn and tell the farmer which CHC machine it found, on which day, and the cost. These are suggested bookings that the CHC confirms; say so. Whatever is still unmet goes in the help request.
- When every detail is in, call prepare_readback, read all the details and the coverage back, and ask the farmer to confirm. File with file_resource_gap_report only after the farmer says yes in their next message. If they correct anything, update it and read back again.
- After filing, tell them their request has gone to the agriculture department, and what is still short.
- Never ask for Aadhaar, land records, bank details or passwords. Their phone is already verified.
- If they ask about something outside farm stubble and machines, answer briefly and kindly, then return to their farm.
"""


def build_agent(session: KisanSession, model: BedrockModel | None = None, callback_handler=None) -> Agent:
    """A Strands agent whose tools read and write this session."""

    @tool
    def update_farm_profile(
        village: str | None = None,
        district: str | None = None,
        state: str | None = None,
        paddy_area: float | None = None,
        paddy_unit: str | None = None,
        variety: str | None = None,
        harvest_date: str | None = None,
        wheat_deadline: str | None = None,
        tractors: int | None = None,
        machines: dict[str, float] | None = None,
        decomposer_acres: float | None = None,
    ) -> str:
        """Record farm details the farmer has stated or confirmed. Pass only the fields you are setting.

        Args:
            village: Village name as the farmer says it.
            district: District name.
            state: State, if not Punjab.
            paddy_area: Paddy area as a number, in paddy_unit.
            paddy_unit: One of acre, killa, hectare, bigha.
            variety: Paddy variety, e.g. PR-126 or Pusa-44.
            harvest_date: Paddy harvest date, YYYY-MM-DD.
            wheat_deadline: Date by which wheat must be sown, YYYY-MM-DD.
            tractors: Number of tractors the farmer can use.
            machines: Every machine the farmer can get, mapped to days available. Keys: happy_seeder,
                super_seeder, mulcher_rmb, baler. Replaces the earlier list; pass {} for no machines.
            decomposer_acres: Acres already sprayed with bio-decomposer.
        """
        return _json(session.update(
            village=village, district=district, state=state, paddy_area=paddy_area, paddy_unit=paddy_unit,
            variety=variety, harvest_date=harvest_date, wheat_deadline=wheat_deadline, tractors=tractors,
            machines=machines, decomposer_acres=decomposer_acres,
        ))

    @tool
    def get_farm_profile() -> str:
        """The farm details recorded so far, and which ones are still missing."""
        return _json({"profile": session.profile.to_json(), "missing": session.profile.missing()})

    @tool
    def estimate_coverage() -> str:
        """Coverage without fire for the recorded farm: covered acres, gap, straw left and PM2.5 if the gap is burnt."""
        return _json(session.coverage())

    @tool
    def get_rain_days() -> str:
        """Rain days in the sowing window from the weather forecast near the farm. Machines can't work wet fields,
        so coverage and the plan already leave these days out; use this to tell the farmer which days are lost."""
        return _json(session.rain())

    @tool
    def find_chc(machine: str | None = None) -> str:
        """Custom Hiring Centres near the farm, nearest first, with machines, price per acre after subsidy,
        phone, and (once dates are known) free dry days. Use when the farmer asks where to get a machine.

        Args:
            machine: Only this machine: happy_seeder, super_seeder, mulcher_rmb or baler. Omit for all.
        """
        return _json(session.chcs_near(machine))

    @tool
    def plan_zero_burn() -> str:
        """Book CHC machines on free, dry days for the farm's gap, cheapest first. Returns the bookings, the cost
        after subsidy, coverage after booking, and what is still unmet (that becomes the help request)."""
        return _json(session.plan())

    @tool
    def prepare_readback() -> str:
        """Lock in the details for filing. Returns everything to read back to the farmer before filing."""
        return _json(session.prepare_readback())

    @tool
    def file_resource_gap_report() -> str:
        """File the farmer's help request with the agriculture department. Only after the farmer confirmed the read-back."""
        return _json(session.file_report())

    return Agent(
        model=model or default_model(),
        system_prompt=SYSTEM_PROMPT + f"\nToday is {date.today().isoformat()}.",
        tools=[update_farm_profile, get_farm_profile, estimate_coverage, get_rain_days, find_chc, plan_zero_burn,
               prepare_readback, file_resource_gap_report],
        callback_handler=callback_handler,
    )


def default_model() -> BedrockModel:
    return BedrockModel(
        model_id=os.environ.get("KISAN_MODEL_ID", DEFAULT_MODEL_ID),
        region_name=os.environ.get("KISAN_BEDROCK_REGION", DEFAULT_REGION),
        max_tokens=4096,
        cache_config=CacheConfig(strategy="auto"),
    )


class KisanChat:
    """One farmer's conversation: a session and the agent bound to it."""

    def __init__(self, filer: Filer | None = None, language: str = "pa", model: BedrockModel | None = None,
                 callback_handler=None, **session_options):
        self.session = KisanSession(filer=filer or default_filer(), language=language, **session_options)
        self.agent = build_agent(self.session, model=model, callback_handler=callback_handler)
        self.usage = {"inputTokens": 0, "outputTokens": 0}

    def send(self, text: str, distrust: frozenset[float] = frozenset()) -> str:
        self.session.begin_turn(text, distrust)
        result = self.agent(text)
        used = getattr(getattr(result, "metrics", None), "accumulated_usage", None) or {}
        # accumulated_usage is the agent's running total, so keep the latest rather than adding.
        self.usage = {k: used.get(k, self.usage[k]) for k in self.usage}
        return str(result).strip()


    def send_voice(self, audio: bytes, transcriber=None) -> tuple[str, "Transcript"]:
        """Transcribe a voice note and send it. Numbers Whisper was unsure of must be confirmed."""
        from agent_kisan.transcribe import default_transcriber

        transcript = (transcriber or default_transcriber()).transcribe(audio, self.session.language)
        if not transcript.text:
            return "", transcript
        return self.send(transcript.text, transcript.unsure_numbers), transcript


def _json(d: dict) -> str:
    return json.dumps(d, ensure_ascii=False)
