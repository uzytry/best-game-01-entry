# EMBERFALL — Last Spark of the Forge (best-game-01 entry, v2)

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/uzytry/best-game-01-entry/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/uzytry/best-game-01-entry/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Hold the Heart. Survive 12 waves. Slay the Hollow King.** A twin-stick arena-survival game (2D canvas, vanilla JS, zero libraries, zero network requests): the Ember Warden defends the Forge Heart at the arena centre — the run ends if the Warden dies **or** the Heart dies.

WASD/arrows to move, mouse to aim, weapons fire on their own, Shift to dash (i-frames), E/Space for a Nova blast when the meter is full, 1/2/3 or Q to switch between 3 weapons (Scatter spray, piercing Lance, bursting Mortar), Esc/P to pause, M to mute, R to restart. 12 waves, 9 enemy kinds (emberling, mini, wisp, spitter, charger, splitter, bulwark, spawner, leech) plus elites, 2 bosses (Ash Tyrant on wave 6; the Hollow King on wave 12 in 3 phases), 2 objective waves (wave 4 "Kill the Spawners", wave 8 "Storm Surge" geyser hazards), and a level-up draft of 1 of 3 boons from a pool of 20 in 3 rarities. The Heart rekindles +25 HP between waves. Combo multiplier, hit-stop, deterministic screen shake, floating damage numbers, synthesized WebAudio SFX and a procedural minor-key soundtrack that follows the wave, seeded RNG (fully deterministic), 6 screens (title with live attract-mode world / play / draft / pause / game over with two causes / victory), localStorage bests and mute.

An autopilot wins 6/6 fresh-process seeds (1, 3, 7, 11, 42, 99); a reckless pilot that stands still dies on wave 1 in 17s.

## Play it

```
node serve.ts
```

then open http://localhost:8080.

## Hand it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library. The dossier is byte-identical across runs (sha256 `155b815265bac1db91d02a719bceab48c78ad3e452f7e0fd024113ccee9213aa`, 479,854 bytes; dossier text 118,596 of the 163,840 cap — all 25 source files included in full).

## Layout

- `main.ts` — the hand-in program (revised twice)
- `serve.ts` — local static server
- `shots.json` — the 4 staged screenshot scenes (seed 7)
- `game/` — the game: `index.html`, `style.css`, `src/` (22 modules)
- `screenshots/` — 4 JPEGs (1280×720): play (wave 11 cover), title, draft, victory
- `vendor/makefun-game.ts` — the kit's dossier library, byte-identical

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=5yjq621h&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards · Bounty: [Make the best game](https://make.fun/bounty/best-game-01)</sub>
