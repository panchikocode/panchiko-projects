"""
guard.py — the rails between a language model and someone's real inbox.

Every check here answers the same question: is it safe to send this, right
now, to this chat? The guard is deliberately paranoid and deliberately dumb —
it makes no judgement calls the model could argue its way around.
"""
from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from .config import BehaviourConfig


@dataclass
class Verdict:
    ok: bool
    reason: str = ""


class Guard:
    """Rate limits, content vetoes, and the kill switch."""

    #: Touching this file stops the program sending anything, immediately,
    #: without needing the terminal it was launched from.
    KILL_FILE = Path("STOP")

    def __init__(self, behaviour: BehaviourConfig, target_id: int):
        self.behaviour = behaviour
        self.target_id = target_id
        self._sent_times: deque[float] = deque()
        self._last_sent: float = 0.0

    # -- inbound -----------------------------------------------------------

    def accepts_chat(self, chat_id: int) -> Verdict:
        """
        The single most important check in the program. Telethon filters by
        chat too, but this is verified independently: a filter that silently
        stops matching sends messages to strangers, and there is no undo.
        """
        if chat_id != self.target_id:
            return Verdict(False, f"chat {chat_id} is not the configured target")
        return Verdict(True)

    # -- outbound ----------------------------------------------------------

    def may_send(self, text: str) -> Verdict:
        if self.KILL_FILE.exists():
            return Verdict(False, f"kill switch: {self.KILL_FILE} exists")

        stripped = text.strip()
        if not stripped:
            return Verdict(False, "empty reply")

        if len(stripped) > self.behaviour.max_reply_chars:
            return Verdict(
                False,
                f"reply is {len(stripped)} chars, limit is {self.behaviour.max_reply_chars}",
            )

        lowered = stripped.lower()
        for needle in self.behaviour.blocked_substrings:
            if needle.lower() in lowered:
                return Verdict(False, f"blocked substring: {needle!r}")

        now = time.monotonic()

        if self._last_sent and now - self._last_sent < self.behaviour.min_seconds_between_replies:
            return Verdict(False, "sending too fast")

        self._prune(now)
        if len(self._sent_times) >= self.behaviour.max_replies_per_hour:
            return Verdict(
                False,
                f"hourly cap of {self.behaviour.max_replies_per_hour} replies reached",
            )

        return Verdict(True)

    def record_sent(self) -> None:
        now = time.monotonic()
        self._last_sent = now
        self._sent_times.append(now)
        self._prune(now)

    def _prune(self, now: float) -> None:
        cutoff = now - 3600.0
        while self._sent_times and self._sent_times[0] < cutoff:
            self._sent_times.popleft()

    # -- introspection -----------------------------------------------------

    def replies_this_hour(self) -> int:
        self._prune(time.monotonic())
        return len(self._sent_times)
