# EngineWeb Arena — game example

A playable 2D arena demo (Vite + TypeScript) integrating the `@engineweb/*` packages:

| System            | Package                       | How it shows up                                          |
| ----------------- | ----------------------------- | -------------------------------------------------------- |
| Level loading     | `effect-asset-pipeline`       | `level.json` arrives through the resilient loader        |
| Backdrop          | `worker-terrain`              | Heightmap chunk tinted once onto an offscreen canvas     |
| Entities + score  | `signal-ecs`                  | SoA `Position`/`Score` stores; score syncs to the DOM via `watch` |
| Pickups and hits  | `typed-spatial-hash`          | Grid rebuilt per frame, radius query around the player   |
| Chaser AI         | `async-pathfinder`            | One A\* slice per chaser per frame, staggered repaths    |
| Player ghost      | `net-interpolator`            | 250 ms of recorded positions sampled with render delay   |
| Sound effects     | `audio-synthesis`             | FM blips for pickups (880 Hz) and hits (140 Hz)          |
| Meteors           | `wasm-physics-binding`        | JS-fallback gravity integration over shared memory (no `.wasm` ships with the demo) |

`skeletal-gpu` is intentionally left out: it targets WebGPU-skinned 3D characters, out of scope for a 2D canvas demo.

## Run it

```bash
pnpm install
pnpm example:dev     # Vite dev server with HMR
pnpm example:build   # production build into game-example/dist
```

## Controls

Move with <kbd>WASD</kbd> or <kbd>arrow keys</kbd>. Collect every orb to win; chaser touches cost a life (3 lives, brief invulnerability). Click **Enable sound & play** first — browsers require a gesture for `AudioContext`.

## Customization (⚙ panel, persisted to `localStorage`)

| Setting      | What it drives                                                              |
| ------------ | --------------------------------------------------------------------------- |
| Volume + mute| `SynthEngine.setMasterVolume` (`0`–`1`); mute restores the previous level   |
| Difficulty   | Chaser speed: Easy 70 · Normal 95 · Hard 130 px/s                           |
| Ghost trail  | `NetInterpolator` history recording and rendering on/off                    |
| Meteors      | `WasmPhysicsBinding` integration and rendering on/off                        |
| Terrain seed | Repaints the `worker-terrain` heightmap backdrop live                       |
