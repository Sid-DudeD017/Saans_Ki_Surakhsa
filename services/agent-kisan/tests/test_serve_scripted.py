"""scripts/serve_scripted.py: the stand-in for the language model while Bedrock is blocked."""

import importlib.util

from agent_kisan.contract import GURPREET_SAYS
from agent_kisan.seed import repo_root

spec = importlib.util.spec_from_file_location(
    "serve_scripted", repo_root() / "services/agent-kisan/scripts/serve_scripted.py")
serve_scripted = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve_scripted)


class ListFiler:
    def __init__(self):
        self.filed = []

    def file(self, request):
        self.filed.append(request)
        return {"via": "test"}


def chat(language="pa"):
    c = serve_scripted.ScriptedChat(language)
    c.session.filer = ListFiler()
    return c


def test_gurpreets_words_are_read_back_then_filed_on_yes():
    c = chat()
    assert c.send(GURPREET_SAYS) == serve_scripted.READBACK["pa"]
    assert c.session.current_readback() is not None
    assert c.send("ਹਾਂ ਜੀ") == serve_scripted.FILED["pa"]
    assert len(c.session.filer.filed) == 1


def test_numbers_the_farmer_never_said_are_confirmed_first():
    c = chat("hi")
    assert c.send("मेरा गाँव भवानीगढ़ है") == serve_scripted.CONFIRM["hi"]
    assert c.session.readback_turn is None and c.session.unsure()


def test_no_reads_it_back_again_and_files_nothing():
    c = chat("en")
    c.send(GURPREET_SAYS)
    assert c.send("No, something needs changing") == serve_scripted.CHANGE["en"]
    assert c.session.filer.filed == []
    c.send("Yes")
    assert len(c.session.filer.filed) == 1
