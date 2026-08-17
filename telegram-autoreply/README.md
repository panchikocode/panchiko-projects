# telegram-autoreply

Answers **one** Telegram chat in your own writing voice, using Claude.

It logs into your account with Telethon, learns how you write from your own
past messages in that chat, and composes replies that match. It is scoped to a
single conversation, rate-limited, fully logged, and does not send anything at
all until you explicitly arm it.

## Consent

Both people in the conversation should know it is running. Nothing in the code
enforces that — it can't — so it is on you. The design assumes an agreed
experiment between two people, which is the only thing it's for.

## Setup

```
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

1. Get `api_id` and `api_hash` from [my.telegram.org](https://my.telegram.org)
   → *API development tools*. Free, takes a minute.
2. `copy config.example.toml config.toml` and fill it in — credentials, and the
   one chat it is allowed to speak in.
3. Set your Anthropic key: `$env:ANTHROPIC_API_KEY = "sk-ant-..."`

## Tuning the voice first — no Telegram needed

Getting Telegram credentials is the slow part, and none of it is needed to
work on the thing that actually matters: whether the replies sound like you.

Put your own past messages in `tune/my_messages.txt` and a made-up
conversation in `tune/conversation.txt`, then:

```
.venv\Scripts\python -m tools.tune --owner "Your name" --partner "Their name"
```

It runs the same generator and the same guard the live program uses and prints
what it would have said. `config.toml` needs no Telegram credentials for this —
only `ANTHROPIC_API_KEY`. See `tune/README.md`.

## Running

**Dry run first.** Without `--arm` it prints what it would have said and sends
nothing:

```
.venv\Scripts\python -m autoreply.main --config config.toml
```

Watch a real conversation go past for a while. When the replies look like you:

```
.venv\Scripts\python -m autoreply.main --config config.toml --arm
```

First launch asks for your phone number and a login code. That creates a
`.session` file so later runs start silently — **that file is a logged-in
session for your account**, so it is gitignored and should stay off shared
machines.

## Stopping it

Three ways, in order of how fast you need it gone:

| | |
|---|---|
| `Ctrl+C` | Normal stop |
| Create a file named `STOP` in the working directory | Sending halts immediately, no terminal needed |
| Close the terminal | It only runs while the process does |

The `STOP` file is checked before every single send, so dropping it in place
takes effect on the next message rather than the next restart.

## What it will not do

These are enforced in `guard.py`, not left to the model's judgement:

- **One chat, checked twice.** Telethon filters by chat, and the guard verifies
  the chat id again on every message. A bot that could reply "anywhere" is one
  typo away from answering your employer.
- **Rate limits.** A cap per rolling hour and a minimum gap between messages.
- **Length ceiling.** Nothing over `max_reply_chars` goes out.
- **Blocked substrings.** Anything matching your list — money, credentials,
  addresses — is dropped and logged instead of sent.
- **Consequences stay yours.** The prompt refuses to commit to meetings,
  payments, or promises on your behalf; those get deflected for you to answer.

## The log

Every inbound message, every generated candidate, every send, every refusal to
send, one JSON object per line in `transcript.jsonl`:

```json
{"at":"2026-08-15T21:04:11+00:00","kind":"inbound","sender":"…","text":"…"}
{"at":"2026-08-15T21:04:14+00:00","kind":"generated","should_reply":true,"reply":"…","reason":"…"}
{"at":"2026-08-15T21:04:21+00:00","kind":"sent","text":"…"}
```

It is written open-and-close per record, so it survives the program being
killed rather than closed.

## How the voice is learned

`style.py` pulls your own messages from that chat and measures the handful of
habits raw samples convey badly — median length, how often you start
lowercase, emoji rate, whether you bother with a final full stop — then hands
the model those numbers plus up to 60 verbatim messages. Model instructions
describe a voice poorly; examples carry it.

That profile is identical on every request, so it sits behind a prompt-cache
breakpoint and is read back at roughly a tenth of the price after the first
message.

## Layout

| File | Role |
|---|---|
| `autoreply/main.py` | The loop: watch, compose, delay, send |
| `autoreply/guard.py` | Chat whitelist, rate limits, content vetoes, kill switch |
| `autoreply/responder.py` | The Claude call and the reply schema |
| `autoreply/style.py` | Learning the writing voice |
| `autoreply/logbook.py` | Append-only record |
| `autoreply/config.py` | Config loading and validation |
| `tools/tune.py` | Try the generator offline, against text files |

## Notes

- Automating a user account is against Telegram's terms of service. Accounts do
  get limited for it. The rate limits here are conservative for that reason as
  much as for realism.
- It answers text. Stickers, photos, and voice messages are skipped rather than
  guessed at.
- `should_reply: false` is a normal outcome — a sticker or a "хаха" gets
  silence, which is what you would have done.

## Status

Written and syntax-checked; **not run against a live account**. Treat the first
dry-run session as the real test.
