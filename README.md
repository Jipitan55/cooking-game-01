# cooking-game-01
[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/Jipitan55/cooking-game-01/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/Jipitan55/cooking-game-01/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

**Sizzle & Serve** is a complete original cooking game: you run the Golden Ladle bistro for one 150-second shift. Orders land on the board with patience timers, and you fetch ingredients from the fridge, chop them on the board, boil pasta and rice on the stove, grill fish on the grill, bake dough in the oven, plate three-ingredient dishes and serve them at the window before patience runs out. Chained on-time serves build a combo multiplier, dishes served raise the level (a fourth order slot opens), and the last 40 seconds are Rush Hour with faster orders and 1.5x points. It plays with keyboard (WASD + E) and mouse (click a station to walk there and use it), with synthesized WebAudio sounds and no network requests — plain static files under `game/`.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes the hand-in (`game/`, `screenshots/`, `dossier.json`) into `out/`. To play locally instead, serve `game/` with any static server, e.g. `node serve.mjs` and open http://localhost:8080 — or `python3 -m http.server` from inside `game/`.
