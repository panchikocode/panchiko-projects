"""
logbook.py — an append-only record of everything the program saw and did.

Written for the moment you want to know what was said in your name. Every
inbound message, every generated candidate, every send and every refusal to
send lands here as one JSON object per line.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class Logbook:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, kind: str, **fields: Any) -> None:
        record = {
            "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "kind": kind,
            **fields,
        }
        # Opened per record rather than held open: the log survives a kill -9,
        # which is exactly how this program is most likely to be stopped.
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    # Convenience wrappers, so call sites read as prose.

    def inbound(self, sender: str, text: str) -> None:
        self.write("inbound", sender=sender, text=text)

    def generated(self, should_reply: bool, reply: str, reason: str) -> None:
        self.write("generated", should_reply=should_reply, reply=reply, reason=reason)

    def sent(self, text: str) -> None:
        self.write("sent", text=text)

    def blocked(self, text: str, reason: str) -> None:
        self.write("blocked", text=text, reason=reason)

    def error(self, message: str) -> None:
        self.write("error", message=message)
