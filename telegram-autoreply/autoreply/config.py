"""
config.py — loading and validating the run configuration.

Every safety rail in this program is a config value, and the loader refuses to
start when one is missing. A misconfigured auto-responder does not fail
quietly: it talks to the wrong person.
"""
from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path


class ConfigError(RuntimeError):
    """Raised when the config is missing, malformed, or unsafe to run with."""


@dataclass
class TelegramConfig:
    api_id: int
    api_hash: str
    session_name: str = "autoreply"

    # The single chat this program is allowed to speak in. Required, and
    # checked again on every inbound message — see guard.py. A bot that can
    # reply "anywhere" is one typo away from answering your employer.
    target_chat: int | str = 0


@dataclass
class ClaudeConfig:
    model: str = "claude-opus-5"
    effort: str = "low"
    max_tokens: int = 1024

    # How many past messages of the conversation to send as context.
    context_messages: int = 40

    # How many of the owner's own past messages to learn the writing voice from.
    style_messages: int = 300


@dataclass
class BehaviourConfig:
    # Who the model is imitating, and any standing instructions.
    persona: str = ""

    # Seconds of "reading" before the typing indicator appears.
    read_delay_min: float = 1.5
    read_delay_max: float = 6.0

    # Characters typed per second, used to size the typing indicator.
    typing_cps: float = 12.0

    # Hard ceiling on replies per rolling hour.
    max_replies_per_hour: int = 30

    # Minimum gap between two outgoing replies.
    min_seconds_between_replies: float = 4.0

    # Never send a message longer than this.
    max_reply_chars: int = 600

    # Substrings that veto a reply outright, case-insensitive.
    blocked_substrings: list[str] = field(default_factory=list)


@dataclass
class Config:
    telegram: TelegramConfig
    claude: ClaudeConfig
    behaviour: BehaviourConfig
    log_path: Path

    @property
    def target(self) -> int | str:
        return self.telegram.target_chat


def load(path: str | Path) -> Config:
    path = Path(path)
    if not path.exists():
        raise ConfigError(
            f"{path} not found. Copy config.example.toml to {path.name} and fill it in."
        )

    with path.open("rb") as fh:
        raw = tomllib.load(fh)

    tg = raw.get("telegram", {})
    for key in ("api_id", "api_hash", "target_chat"):
        if not tg.get(key):
            raise ConfigError(f"telegram.{key} is required in {path.name}")

    telegram = TelegramConfig(
        api_id=int(tg["api_id"]),
        api_hash=str(tg["api_hash"]),
        session_name=str(tg.get("session_name", "autoreply")),
        target_chat=tg["target_chat"],
    )

    cl = raw.get("claude", {})
    claude = ClaudeConfig(
        model=str(cl.get("model", "claude-opus-5")),
        effort=str(cl.get("effort", "low")),
        max_tokens=int(cl.get("max_tokens", 1024)),
        context_messages=int(cl.get("context_messages", 40)),
        style_messages=int(cl.get("style_messages", 300)),
    )

    bh = raw.get("behaviour", {})
    behaviour = BehaviourConfig(
        persona=str(bh.get("persona", "")).strip(),
        read_delay_min=float(bh.get("read_delay_min", 1.5)),
        read_delay_max=float(bh.get("read_delay_max", 6.0)),
        typing_cps=float(bh.get("typing_cps", 12.0)),
        max_replies_per_hour=int(bh.get("max_replies_per_hour", 30)),
        min_seconds_between_replies=float(bh.get("min_seconds_between_replies", 4.0)),
        max_reply_chars=int(bh.get("max_reply_chars", 600)),
        blocked_substrings=[str(s) for s in bh.get("blocked_substrings", [])],
    )

    if behaviour.read_delay_min > behaviour.read_delay_max:
        raise ConfigError("behaviour.read_delay_min must not exceed read_delay_max")

    return Config(
        telegram=telegram,
        claude=claude,
        behaviour=behaviour,
        log_path=Path(raw.get("log_path", "transcript.jsonl")),
    )
