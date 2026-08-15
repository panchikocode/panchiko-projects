"""
style.py — learn the owner's writing voice from their own past messages.

Nothing here is clever. The model is far better at picking up a voice from
raw examples than from any description we could synthesise, so the job is to
choose a representative sample and measure the few habits that samples alone
convey badly — how long the messages run, whether sentences start lowercase,
how much punctuation survives.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

EMOJI_RANGES = re.compile(
    "["
    "\U0001f300-\U0001faff"
    "☀-➿"
    "]",
    flags=re.UNICODE,
)


@dataclass
class StyleProfile:
    samples: list[str]
    median_chars: int
    lowercase_start_ratio: float
    emoji_ratio: float
    question_ratio: float
    no_final_punct_ratio: float

    def describe(self) -> str:
        """A short prose brief to sit alongside the raw samples."""
        lines = [
            f"Typical message length: about {self.median_chars} characters.",
            f"Starts a message in lowercase {self.lowercase_start_ratio:.0%} of the time.",
            f"Uses an emoji in {self.emoji_ratio:.0%} of messages.",
            f"Asks a question in {self.question_ratio:.0%} of messages.",
            f"Leaves off the final full stop {self.no_final_punct_ratio:.0%} of the time.",
        ]
        return "\n".join(lines)


def build(messages: list[str], sample_size: int = 60) -> StyleProfile:
    """
    `messages` are the owner's own texts, newest first.

    Very short messages ("ok", "да") are kept in the statistics — they are a
    real part of how someone writes — but the verbatim sample skips them,
    because a sample made of one-word replies teaches the model nothing.
    """
    texts = [m.strip() for m in messages if m and m.strip()]
    if not texts:
        return StyleProfile([], 0, 0.0, 0.0, 0.0, 0.0)

    lengths = sorted(len(t) for t in texts)
    median = lengths[len(lengths) // 2]

    starts_lower = sum(1 for t in texts if t[:1].islower())
    with_emoji = sum(1 for t in texts if EMOJI_RANGES.search(t))
    questions = sum(1 for t in texts if t.rstrip().endswith("?"))
    no_final_punct = sum(1 for t in texts if t.rstrip()[-1:] not in ".!?…")

    n = len(texts)
    substantial = [t for t in texts if len(t) >= 12]
    samples = substantial[:sample_size] or texts[:sample_size]

    return StyleProfile(
        samples=samples,
        median_chars=median,
        lowercase_start_ratio=starts_lower / n,
        emoji_ratio=with_emoji / n,
        question_ratio=questions / n,
        no_final_punct_ratio=no_final_punct / n,
    )
