"""
sound.py — a small synthesized "unlock" chime, generated as PCM samples
at import time (no bundled audio asset, nothing to license).
"""
from __future__ import annotations

import io
import math
import struct
import wave
from functools import lru_cache

SAMPLE_RATE = 44100


def _tone(freq: float, dur: float, t0: float, vol: float, buf: bytearray, n_samples: int):
    start = int(t0 * SAMPLE_RATE)
    n = int(dur * SAMPLE_RATE)
    for i in range(n):
        idx = start + i
        if idx >= n_samples:
            break
        # quick attack, exponential decay envelope
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.006) * math.exp(-t * 7.0)
        sample = math.sin(2 * math.pi * freq * t) * vol * env
        pos = idx * 2
        existing = struct.unpack_from("<h", buf, pos)[0] if pos + 2 <= len(buf) else 0
        mixed = max(-32768, min(32767, existing + int(sample * 32767)))
        struct.pack_into("<h", buf, pos, mixed)


@lru_cache(maxsize=1)
def unlock_chime_wav_bytes() -> bytes:
    """A bright two-note major-third chime, ~0.5s."""
    total_dur = 0.55
    n_samples = int(SAMPLE_RATE * total_dur)
    buf = bytearray(n_samples * 2)

    # a rising arpeggio: root, major third, fifth, octave — classic "reward" shape
    notes = [523.25, 659.25, 783.99, 1046.50]  # C5 E5 G5 C6
    for i, f in enumerate(notes):
        _tone(f, 0.28, i * 0.045, 0.22, buf, n_samples)
    _tone(1046.50 * 2, 0.15, 0.20, 0.10, buf, n_samples)  # a little sparkle on top

    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(bytes(buf))
    return out.getvalue()


def write_unlock_chime(path) -> None:
    with open(path, "wb") as f:
        f.write(unlock_chime_wav_bytes())
