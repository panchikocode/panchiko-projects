# 紅龍傳說 — LEGEND OF THE RED DRAGON

Red Dragon Software, Shanghai, 1994. FC-8M, cart no. RD-001, 5000 units pressed.
Recovered and remastered as an HTML5 prototype on Phaser 3.

## Run

Open `index.html` in a browser. No build step, no server needed — all scripts are
plain `<script>` tags, so `file://` works. Phaser 3.80 is vendored in `vendor/`,
so no internet connection is needed either.

If you prefer a server:

```
python -m http.server 8777 --bind 127.0.0.1
```
then http://127.0.0.1:8777/

## Desktop build

A standalone Windows executable — same game, same files, wrapped in Electron:

```
npm install
npm run dist
```

That writes a single portable `dist/LegendOfTheRedDragon.exe` (~71 MB, no
installer, no dependencies). `npm start` runs it from source without packaging.

`F11` fullscreen · `F12` devtools · `Ctrl+R` reload.

Two notes on Windows:

- The build is unsigned, so SmartScreen will warn on first run.
- Don't launch it from a VS Code integrated terminal. VS Code exports
  `ELECTRON_RUN_AS_NODE=1` to child processes, which makes Electron boot as
  plain Node and fail immediately; `electron-main.cjs` detects that and prints
  why. Explorer, cmd and PowerShell outside VS Code are all fine.

## Controls

| Key | Action |
| --- | --- |
| ← → / A D | Move |
| Z / Space / ↑ | Jump (press again in the air for the second jump) |
| X | Staff — tap for a 3-hit combo, **hold ~0.5 s and release** for the spirit blast |
| C / Shift | Dash (brief invulnerability) |
| ↓ | Drop through wooden platforms |
| P | Pause · **V** CRT filter · **M** sound · **Esc** back to title |

## Everything is procedural

No image files, no audio files, no font files. At boot the game paints every
texture pixel by pixel into canvases (`src/pixel.js` is the pixel foundry,
`src/art_sprites.js` and `src/art_world.js` are the artists), builds a 5×7 bitmap
font from packed bit rows, rasterises the Chinese title from a system font and
hard-thresholds it onto the pixel grid, and synthesises all music and SFX from
oscillators and a 15-bit LFSR noise generator (`src/audio.js`) — the same channel
layout as a 2A03.

## Contents

Four acts along the Wall — dawn, dusk, night, and the dragon's tower — with a
continuous cross-fading sky, eight parallax layers, eight enemy types
(sine-wave demons, charging hellhounds, hopping imps, fireball turret statues,
shield-carrying brutes, bat swarms, the Jade General mini-boss and the Red Dragon),
five hazard types (spikes, collapsing battlements, swinging lanterns, fireball
traps, wind gusts), wisdom scrolls, eleven hidden dragon coins behind talisman-sealed
alcoves, chi pickups, the Dragon Spirit power-up, a combo multiplier, eight shrine
checkpoints, and boss intro cards.

## Files

| File | Role |
| --- | --- |
| `src/palette.js` | The colour ROM |
| `src/pixel.js` | `Pix` pixel canvas (outline / rim-light / ramp), texture helpers, bitmap font |
| `src/art_sprites.js` | Monk, enemies, bosses, projectiles, pickups, particles, HUD icons |
| `src/art_world.js` | Tiles, level painter, parallax layers, decor, hanzi, cartridge frame |
| `src/audio.js` | The sound chip and three tunes |
| `src/level.js` | The Wall, tile by tile |
| `src/entities.js` | Player and enemy behaviour |
| `src/scenes.js` | Boot, title, game, HUD, end cards |
| `src/main.js` | Boot vector |
