# `@engineweb/net-interpolator`

Multiplayer snapshot synchronization: a sorted jitter buffer with linear interpolation and velocity extrapolation for real-time play over WebSockets or WebRTC.

The core is dependency-free and composes naturally with [Effect](https://effect.website/) — feed it snapshots from an Effect `Stream`/`PubSub` jitter buffer and validate packets with `@effect/schema` before pushing them in.

## Features

- Sorted jitter buffer with out-of-order insertion, duplicate-timestamp replacement and oldest-eviction past `bufferSize`.
- Linear interpolation for numbers, numeric arrays and plain objects with numeric fields (non-numeric fields track the newer snapshot).
- Velocity extrapolation past the newest snapshot; oldest-hold before the buffer.
- Render-delay model: samples are taken at `now - delayMs`.

## Installation

```bash
pnpm add @engineweb/net-interpolator
```

```bash
pnpm add effect # optional — for Stream/PubSub pipelines and schema validation
```

## Usage

```typescript
import { NetInterpolator } from '@engineweb/net-interpolator'

interface PlayerState { x: number; y: number; hp: number }

const interp = new NetInterpolator<PlayerState>({ delayMs: 100, bufferSize: 32 })

// On every validated network packet:
socket.onmessage = (packet) => interp.push({ state: packet, timestamp: packet.serverTime })

// In the render loop:
function frame(now: number): void {
  const state = interp.sample(now) // interpolated (or extrapolated) snapshot
  renderer.drawPlayer(state.x, state.y)
}
```

With Effect streams:

```typescript
import { Effect, Stream } from 'effect'
import { NetInterpolator } from '@engineweb/net-interpolator'

const interp = new NetInterpolator<PlayerState>({ delayMs: 100 })

const program = Stream.runForEach(networkStream, (snapshot) =>
  Effect.sync(() => interp.push(snapshot)),
)
Effect.runPromise(program)
```

## API

### `new NetInterpolator<T>(options: InterpolatorOptions)`

| Option | Default | Description |
|---|---|---|
| `delayMs` | — | Render delay in ms subtracted from local time. Must be `>= 0`. |
| `bufferSize` | `32` | Max snapshots retained; oldest evicted first. Positive integer. |

### Methods

| Method | Description |
|---|---|
| `push(snapshot: { state, timestamp })` | Inserts a snapshot, keeping timestamp order. Throws `RangeError` on negative/non-finite timestamps, `TypeError` on `undefined` state. |
| `sample(now): T` | Interpolated state at `now - delayMs`. Extrapolates past the newest snapshot, holds the oldest before the buffer. Throws when empty or `now < 0`. Returns a copy — safe to mutate. |
| `get size()` | Snapshots currently buffered. |
| `clear()` | Drops the whole buffer. |

## License

MIT
