"""
responder.py — turns a conversation into a candidate reply, via Claude.

The system prompt (persona + learned voice + samples) is stable for the whole
run and carries a cache breakpoint; only the rolling conversation changes per
request. That keeps repeat cost near the cache-read rate rather than
re-billing the whole voice profile on every message.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import anthropic

from .config import ClaudeConfig
from .style import StyleProfile

REPLY_SCHEMA = {
    "type": "object",
    "properties": {
        "should_reply": {
            "type": "boolean",
            "description": "False when the last message needs no answer at all.",
        },
        "reply": {
            "type": "string",
            "description": "The message to send. Empty string when should_reply is false.",
        },
        "reason": {
            "type": "string",
            "description": "One short line, for the log. Never sent to the chat.",
        },
    },
    "required": ["should_reply", "reply", "reason"],
    "additionalProperties": False,
}

SYSTEM_TEMPLATE = """\
You are writing messages in a Telegram conversation as {owner}, in a chat with \
{partner}. Both people know an automated system is composing {owner}'s side; \
this is an experiment they agreed to. You are not pretending to be human and \
you are not announcing yourself either — you are simply writing {owner}'s side \
of the conversation.

{persona_block}
# The voice you are writing in

{style_brief}

Below are real messages {owner} has sent in this chat. Match their rhythm, \
vocabulary, punctuation habits, and level of effort. Do not imitate them \
sentence by sentence — write new messages that sound like they came from the \
same person.

{samples_block}
# How to reply

- Write one message. Not a paragraph of several, not a list — one message, the \
length {owner} would actually send.
- Reply in the language the other person is using.
- Silence is a valid answer. If the last message is a sticker, a reaction, a \
"хаха", or anything else that needs nothing back, set should_reply to false.
- Never mention being a model, an assistant, or a program. Never explain your \
reasoning in the message itself — that goes in the reason field.
- Never agree to anything with real-world consequences on {owner}'s behalf: \
money, meeting times, promises, plans, passwords, addresses. If the \
conversation turns that way, deflect lightly and leave it for {owner} to \
answer personally.
"""


@dataclass
class Reply:
    should_reply: bool
    text: str
    reason: str


class Responder:
    def __init__(
        self,
        cfg: ClaudeConfig,
        profile: StyleProfile,
        persona: str,
        owner: str,
        partner: str,
    ):
        self._client = anthropic.Anthropic()
        self._cfg = cfg
        self._system = self._build_system(profile, persona, owner, partner)

    @staticmethod
    def _build_system(
        profile: StyleProfile, persona: str, owner: str, partner: str
    ) -> str:
        samples_block = (
            "\n".join(f"- {s}" for s in profile.samples)
            if profile.samples
            else "(no samples available — write plainly and briefly)"
        )
        persona_block = f"# Standing instructions\n\n{persona}\n" if persona else ""

        return SYSTEM_TEMPLATE.format(
            owner=owner,
            partner=partner,
            persona_block=persona_block,
            style_brief=profile.describe(),
            samples_block=samples_block + "\n",
        )

    def compose(self, transcript: list[tuple[str, str]]) -> Reply:
        """
        `transcript` is (speaker, text), oldest first, ending on the message
        that needs answering.
        """
        rendered = "\n".join(f"{speaker}: {text}" for speaker, text in transcript)

        response = self._client.messages.create(
            model=self._cfg.model,
            max_tokens=self._cfg.max_tokens,
            system=[
                {
                    "type": "text",
                    "text": self._system,
                    # The voice profile is identical on every request; pay for
                    # it once and read it back at a tenth the price after.
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            output_config={
                "effort": self._cfg.effort,
                "format": {"type": "json_schema", "schema": REPLY_SCHEMA},
            },
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Here is the recent conversation. Write the next message "
                        "in it, or decide that none is needed.\n\n" + rendered
                    ),
                }
            ],
        )

        if response.stop_reason == "refusal":
            return Reply(False, "", "model declined to answer this one")

        text = next((b.text for b in response.content if b.type == "text"), "")
        if not text:
            return Reply(False, "", "empty response from the model")

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            return Reply(False, "", f"unparseable response: {exc}")

        return Reply(
            should_reply=bool(data.get("should_reply")),
            text=str(data.get("reply", "")).strip(),
            reason=str(data.get("reason", "")).strip(),
        )
