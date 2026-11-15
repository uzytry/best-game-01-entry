# LUMEN DRIFT — best-game-01 entry

**Keep the last light alive.** A neon arena-survival twin-stick shooter (2D canvas, vanilla JS, zero libraries, zero network requests): the Keeper defends the last lantern against the Gloom.

WASD/arrows to drift, mouse to aim, hold click to fire bolts of light, Shift/Space to dash through danger (i-frames), Esc to pause, M to mute, R to restart. 10 waves, 5 enemy kinds (wisp, darter, spitter, brute, splitter) plus elites from wave 4, and a two-phase boss on wave 10, "The Gloom Herald". Fallen starlight becomes XP; each level-up offers a draft of 1 of 3 boons from a pool of 12 (stackable). Combo multiplier, synthesized WebAudio SFX and generative ambient music, seeded RNG (fully deterministic), 6 screens (title / play / draft / pause / game over / victory), localStorage bests and mute, and a screen-reader status line.

## Play it

```
node serve.ts
```

then open http://localhost:8080.

## Hand it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library. The dossier is byte-identical across runs (sha256 `ec8a0a605807cec39b142815d3e27803cfc4c6ba6ed2a70356289ed1171cfb61`).

## Layout

- `main.ts` — the hand-in program
- `serve.ts` — local static server
- `shots.json` — the 4 staged screenshot scenes (seed 7)
- `game/` — the game: `index.html`, `style.css`, `src/` (17 modules)
- `screenshots/` — 4 JPEGs (1280×720): play, title, draft, victory
- `vendor/makefun-game.ts` — the kit's dossier library, byte-identical

## License

MIT — see `LICENSE`.
