# Tuning the voice, without Telegram

Telegram credentials are the slowest part of setup and the least interesting.
The part worth iterating on — whether the replies sound like you — needs
nothing from Telegram at all.

`tools/tune.py` runs the same generator the live program uses, against two
text files instead of a chat.

## Two files

**`my_messages.txt`** — your own past messages, one per line. This is what the
voice is learned from, so paste real ones; 50+ is a good start. Lines starting
with `#` are ignored.

**`conversation.txt`** — a made-up conversation to answer, one message per
line in `speaker: text` form. Use `me` (or `я`) for your side; anything else
is the other person. The last line is the message that needs answering.

## Running it

```powershell
cd "C:\Users\Artem Zavernyaev\repo gid\telegram-autoreply"
$env:ANTHROPIC_API_KEY = "sk-ant-..."
.venv\Scripts\python -m tools.tune --owner "Артём" --partner "Ангелина"
```

Output:

```
voice learned from 214 messages
Typical message length: about 41 characters.
Starts a message in lowercase 96% of the time.
...

--- conversation ---
Ангелина: слушай а ты завтра свободен вечером?

--- generated ---
Артём: смотря во сколько, а что задумала

reason: casual question, keeping it short like his other replies
guard : would send
```

The `guard` line runs the reply past the same rails the live program uses, so
anything that would be held back shows up here rather than as a surprise
later.

## What to change when it sounds wrong

| Symptom | Fix |
|---|---|
| Too formal, too long, too polished | Add more real samples — this is almost always thin `my_messages.txt` |
| Right length, wrong attitude | `persona` in `config.toml` |
| Answers things it should dodge | `persona`, and `blocked_substrings` for the hard cases |
| Replies when silence was right | Nothing to fix in config — check `reason`; silence is a real outcome |

`config.toml` does **not** need Telegram credentials filled in for this tool.
Only `ANTHROPIC_API_KEY` matters.
