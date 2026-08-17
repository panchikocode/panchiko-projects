"""
tune.py — try the reply generator without Telegram.

Telegram credentials are the slowest part of setup and the least interesting;
the part worth iterating on is whether the replies sound like you. This runs
the same Responder the live program uses, against text files instead of a
chat, so persona and voice can be tuned before the account is ever wired up.

    python -m tools.tune                     # uses the files under tune/
    python -m tools.tune --config config.toml

Needs ANTHROPIC_API_KEY. Needs nothing from Telegram.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from autoreply import config as config_module  # noqa: E402
from autoreply.guard import Guard  # noqa: E402
from autoreply.responder import MissingCredentials, Responder  # noqa: E402
from autoreply.style import build as build_style  # noqa: E402

DEFAULT_DIR = Path("tune")


def read_lines(path: Path) -> list[str]:
    if not path.exists():
        raise SystemExit(f"missing {path} — see tune/README.md")
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def parse_transcript(lines: list[str], owner: str, partner: str) -> list[tuple[str, str]]:
    """
    Each line is `speaker: text`. A speaker of `me` (or the owner's name) is
    you; anything else is the other person.
    """
    out: list[tuple[str, str]] = []
    for line in lines:
        speaker, _, text = line.partition(":")
        if not text.strip():
            raise SystemExit(f"line is not in `speaker: text` form: {line!r}")
        who = speaker.strip().lower()
        out.append((owner if who in {"me", "я", owner.lower()} else partner, text.strip()))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Tune the reply voice offline.")
    parser.add_argument("--config", default="config.toml")
    parser.add_argument("--dir", default=str(DEFAULT_DIR), help="folder with the sample files")
    parser.add_argument("--owner", default="Me")
    parser.add_argument("--partner", default="Her")
    args = parser.parse_args()

    # Telegram credentials are not read here — tuning works before they exist.
    try:
        cfg = config_module.load(args.config, require_telegram=False)
    except config_module.ConfigError as exc:
        raise SystemExit(str(exc))

    folder = Path(args.dir)
    own = read_lines(folder / "my_messages.txt")
    convo = read_lines(folder / "conversation.txt")

    profile = build_style(own)
    print(f"voice learned from {len(own)} messages")
    print(profile.describe())
    print(f"verbatim samples used: {len(profile.samples)}\n")

    transcript = parse_transcript(convo, args.owner, args.partner)
    print("--- conversation ---")
    for speaker, text in transcript:
        print(f"{speaker}: {text}")

    try:
        responder = Responder(
            cfg.claude, profile, cfg.behaviour.persona, args.owner, args.partner
        )
        reply = responder.compose(transcript)
    except MissingCredentials as exc:
        raise SystemExit(f"\n{exc}")

    print("\n--- generated ---")
    if not reply.should_reply:
        print(f"(stays silent: {reply.reason})")
        return 0

    print(f"{args.owner}: {reply.text}")
    print(f"\nreason: {reply.reason}")

    # Run it past the same rails the live program uses, so a reply that would
    # be held back shows up here rather than as a surprise later.
    guard = Guard(cfg.behaviour, target_id=0)
    verdict = guard.may_send(reply.text)
    print(f"guard : {'would send' if verdict.ok else 'HELD BACK — ' + verdict.reason}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
