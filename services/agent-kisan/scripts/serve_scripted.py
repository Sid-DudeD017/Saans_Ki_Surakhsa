"""Run the Kisan API with Gurpreet's scripted conversation in place of the language model.

For building the Kisan screens and the G6 golden path while Bedrock is blocked on the Saans account.
Only the model is replaced: speech recognition, the read-back card and audio, filing to Saans Command
(SAANS_API_URL) and the status history are the real ones. Whatever the farmer says first, the script
records Gurpreet's farm (18 killa, Bhawanigarh); the next message files the request.

    uv run python scripts/serve_scripted.py            # http://127.0.0.1:8001
    SAANS_API_URL=http://localhost:3000 uv run python scripts/serve_scripted.py

Never deploy this: it isn't an agent.
"""

import argparse
from datetime import date

import uvicorn

from agent_kisan import api
from agent_kisan.filing import default_filer
from agent_kisan.session import KisanSession

GURPREET = dict(village="Bhawanigarh", district="Sangrur", paddy_area=18, paddy_unit="killa",
                harvest_date="2026-10-20", wheat_deadline="2026-11-09", tractors=1, machines={"super_seeder": 2})
READBACK = {
    "pa": "ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਇਹ ਹੈ। ਕੀ ਇਹ ਸਭ ਠੀਕ ਹੈ?",
    "hi": "आपकी जानकारी यह है। क्या यह सब सही है?",
    "en": "Here are your details. Is all of this right?",
}
CONFIRM = {
    "pa": "ਕੁਝ ਨੰਬਰ ਤੁਸੀਂ ਨਹੀਂ ਦੱਸੇ। ਹਰ ਇੱਕ ਨੂੰ ਛੂਹ ਕੇ ਪੱਕਾ ਕਰੋ।",
    "hi": "कुछ नंबर आपने नहीं बताए। हर एक को छूकर पक्का कीजिए।",
    "en": "You didn't say some of these numbers. Tap each one to confirm it.",
}
CHANGE = {
    "pa": "ਦੱਸੋ ਕੀ ਬਦਲਣਾ ਹੈ। (ਇਹ ਡੈਮੋ ਵੇਰਵੇ ਨਹੀਂ ਬਦਲ ਸਕਦਾ।)",
    "hi": "बताइए क्या बदलना है। (यह डेमो जानकारी नहीं बदल सकता।)",
    "en": "Tell me what to change. (This scripted stand-in can't change the details.)",
}
NO = ("ਨਹੀਂ", "नहीं", "no")
FILED = {
    "pa": "ਤੁਹਾਡੀ ਮਦਦ ਦੀ ਬੇਨਤੀ ਖੇਤੀਬਾੜੀ ਵਿਭਾਗ ਕੋਲ ਭੇਜ ਦਿੱਤੀ ਹੈ।",
    "hi": "आपकी मदद की बिनती कृषि विभाग को भेज दी गई है।",
    "en": "Your request for help has gone to the agriculture department.",
}


class ScriptedChat:
    """Turn 1: Gurpreet's details, read back. Then a no reads them back again; anything else files."""

    def __init__(self, language: str):
        self.session = KisanSession(filer=default_filer(), language=language, weather=None,
                                    rain_dates={date(2026, 10, 27), date(2026, 10, 28)}, fire_source=None)

    def send(self, text, distrust=frozenset()):
        s = self.session
        s.begin_turn(text, distrust)
        if s.filed is None and s.readback_turn is None:
            s.update(**GURPREET)
            if s.unsure():  # the number guard: no read-back until the farmer confirms what they didn't say
                return CONFIRM[s.language]
            s.prepare_readback()
            return READBACK[s.language]
        if s.filed is None and any(w in (text or "").lower().split(",")[0] for w in NO):
            s.prepare_readback()  # read back again; the next yes files
            return CHANGE[s.language]
        if s.filed is None:
            s.file_report()
        return FILED[s.language]

    def send_voice(self, audio, transcriber):
        transcript = transcriber.transcribe(audio, self.session.language)
        return self.send(transcript.text, transcript.unsure_numbers), transcript


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    api.chat_factory = ScriptedChat
    print("Kisan API with the SCRIPTED conversation (no language model)")
    uvicorn.run(api.app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
