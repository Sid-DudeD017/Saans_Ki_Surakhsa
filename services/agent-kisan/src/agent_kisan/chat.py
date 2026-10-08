"""Type to Kisan Saathi in the terminal: uv run python -m agent_kisan.chat"""

from agent_kisan.agent import KisanChat


def main() -> None:
    chat = KisanChat()
    print("Kisan Saathi. Type in Punjabi, Hindi or English. Ctrl-D to quit.\n")
    while True:
        try:
            text = input("farmer> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if text:
            print(f"\nsaathi> {chat.send(text)}\n")
    s = chat.session
    print("profile:", s.profile.to_json())
    if s.filed:
        print("filed:", s.filed["receipt"])


if __name__ == "__main__":
    main()
