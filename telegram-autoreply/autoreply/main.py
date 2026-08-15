"""
main.py — the loop: watch one chat, compose, and send.

Run with `python -m autoreply.main --config config.toml`. Nothing is sent
until `--arm` is passed; without it the program prints what it would have
said and sends nothing, which is how you should spend your first session
with it.
"""
from __future__ import annotations

import argparse
import asyncio
import random
import sys
from pathlib import Path

from telethon import TelegramClient, events

from . import config as config_module
from .guard import Guard
from .logbook import Logbook
from .responder import Responder
from .style import build as build_style


async def collect_history(client: TelegramClient, peer, limit: int):
    """Newest-first list of (sender_is_me, text) for a chat."""
    out: list[tuple[bool, str]] = []
    async for message in client.iter_messages(peer, limit=limit):
        if not message.text:
            continue  # stickers, media without captions, service messages
        out.append((bool(message.out), message.text))
    return out


async def run(cfg: config_module.Config, armed: bool) -> int:
    log = Logbook(cfg.log_path)

    client = TelegramClient(
        cfg.telegram.session_name, cfg.telegram.api_id, cfg.telegram.api_hash
    )
    await client.start()

    me = await client.get_me()
    owner = me.first_name or "me"

    try:
        peer = await client.get_entity(cfg.target)
    except Exception as exc:
        print(f"could not resolve target_chat {cfg.target!r}: {exc}", file=sys.stderr)
        return 2

    partner = getattr(peer, "first_name", None) or getattr(peer, "title", "them")
    target_id = peer.id

    print(f"owner   : {owner}")
    print(f"chat    : {partner} (id {target_id})")
    print(f"mode    : {'ARMED — messages will be sent' if armed else 'dry run — nothing is sent'}")
    print(f"log     : {cfg.log_path}")
    print(f"stop    : create a file named {Guard.KILL_FILE} here, or press Ctrl+C")

    # Learn the voice from the owner's own side of this conversation.
    history = await collect_history(client, peer, cfg.claude.style_messages)
    own = [text for is_me, text in history if is_me]
    profile = build_style(own)
    print(f"voice   : learned from {len(own)} of your messages\n")

    guard = Guard(cfg.behaviour, target_id)
    responder = Responder(cfg.claude, profile, cfg.behaviour.persona, owner, partner)

    lock = asyncio.Lock()

    @client.on(events.NewMessage(chats=peer, incoming=True))
    async def handler(event):
        verdict = guard.accepts_chat(event.chat_id)
        if not verdict.ok:
            log.blocked("", verdict.reason)
            return

        text = (event.message.text or "").strip()
        if not text:
            return  # nothing to answer

        log.inbound(partner, text)
        print(f"< {text}")

        # One message at a time: two overlapping replies read as a bot faster
        # than any wording mistake.
        async with lock:
            recent = await collect_history(client, peer, cfg.claude.context_messages)
            transcript = [
                (owner if is_me else partner, body) for is_me, body in reversed(recent)
            ]

            try:
                reply = await asyncio.to_thread(responder.compose, transcript)
            except Exception as exc:
                log.error(f"compose failed: {exc}")
                print(f"! compose failed: {exc}", file=sys.stderr)
                return

            log.generated(reply.should_reply, reply.text, reply.reason)

            if not reply.should_reply:
                print(f"- (no reply: {reply.reason})")
                return

            allowed = guard.may_send(reply.text)
            if not allowed.ok:
                log.blocked(reply.text, allowed.reason)
                print(f"! held back: {allowed.reason}")
                return

            if not armed:
                print(f"~ would send: {reply.text}")
                return

            # Read, then type. Sending instantly is the single clearest tell.
            await asyncio.sleep(
                random.uniform(cfg.behaviour.read_delay_min, cfg.behaviour.read_delay_max)
            )
            typing_seconds = min(len(reply.text) / cfg.behaviour.typing_cps, 25.0)
            async with client.action(peer, "typing"):
                await asyncio.sleep(typing_seconds)

            await client.send_message(peer, reply.text)
            guard.record_sent()
            log.sent(reply.text)
            print(f"> {reply.text}")

    await client.run_until_disconnected()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Reply in one Telegram chat, as you.")
    parser.add_argument("--config", default="config.toml", help="path to the TOML config")
    parser.add_argument(
        "--arm",
        action="store_true",
        help="actually send messages. Without it, replies are only printed.",
    )
    args = parser.parse_args()

    try:
        cfg = config_module.load(args.config)
    except config_module.ConfigError as exc:
        print(f"config error: {exc}", file=sys.stderr)
        return 2

    if Guard.KILL_FILE.exists():
        print(
            f"{Guard.KILL_FILE} exists — delete it to allow sending.", file=sys.stderr
        )
        return 3

    try:
        return asyncio.run(run(cfg, armed=args.arm))
    except KeyboardInterrupt:
        print("\nstopped")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
