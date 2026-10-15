# `@engineweb/audio-synthesis`

Procedural sound effects and adaptive music with the Web Audio API and `AudioWorklet` — FM synthesis voices, white/pink/brown noise, and ADSR envelopes, all synthesized on the fly.

No MP3/WAV downloads, minimal bundle impact: footsteps, laser shots and explosions become a few lines of code.

## Features

- One-shot FM voices: carrier + modulator oscillators with frequency ratio/index control.
- Full ADSR envelope scheduling (attack → decay → sustain hold → release) with automatic node teardown.
- Looping noise sources in **white**, **pink** (Paul Kellet filter) and **brown** (leaky integrator) — buffer-based, plus a streaming `AudioWorklet` variant.
- Lazy `AudioWorklet` registration in `init()`; buffer noise works even where worklets are unavailable.

## Installation

```bash
pnpm add @engineweb/audio-synthesis
```

## Usage

```typescript
import { SynthEngine } from '@engineweb/audio-synthesis'

const engine = new SynthEngine(new AudioContext())
await engine.init() // master gain + worklet registration (idempotent)

// Laser shot: bright FM blip with a snappy envelope
engine.playVoice({
  frequency: 880,
  ratio: 2,
  index: 6,
  envelope: { attackSeconds: 0.005, decaySeconds: 0.08, sustainLevel: 0.4, releaseSeconds: 0.15 },
})

// Explosion bed: looping brown noise through a lowpass
const rumble = engine.createNoise('brown')
const filter = engine.context.createBiquadFilter()
filter.type = 'lowpass'
filter.frequency.value = 220
rumble.connect(filter).connect(engine.context.destination)
rumble.start()

// Footsteps: short filtered noise bursts via the streaming worklet node
const steps = engine.createNoiseNode('white')
```

An adaptive-music loop can schedule `playVoice` on a lookahead timer, varying `ratio`/`index` per bar for evolving timbres without any audio assets.

## API

### `new SynthEngine(context: AudioContext)`

Accepts any object exposing the `AudioContext` creation surface (`createOscillator`, `createGain`, `createBuffer`). Throws `TypeError` otherwise — and never a bare `ReferenceError` outside browsers.

### Methods

| Method | Description |
|---|---|
| `init(): Promise<void>` | Creates the master gain (`0.8`) and registers the `engineweb-noise` worklet. Safe to call twice. Worklet failure is swallowed — buffer noise keeps working. |
| `get isInitialized()` | Whether `init()` completed. |
| `get masterVolume()` | Current master level in `[0, 1]`. |
| `setMasterVolume(value)` | Sets the master level (`0` = silent); stored when called before `init()`. Throws `RangeError` outside `[0, 1]`. |
| `playVoice(options: SynthVoiceOptions)` | Schedules a one-shot FM voice, returns immediately. Nodes auto-stop and disconnect after the envelope. |
| `createNoise(kind): AudioBufferSourceNode` | 2 s looping buffer source. `kind` is `'white'` \| `'pink'` \| `'brown'`; anything else throws `TypeError`. Caller connects/starts it. |
| `createNoiseNode(kind)` | Streaming `AudioWorkletNode` (connected to master output), falling back to a connected `createNoise()` buffer where worklets are unavailable. |

**`SynthVoiceOptions`**

| Field | Default | Description |
|---|---|---|
| `frequency` | — | Carrier Hz. Must be positive. |
| `ratio` | `1` | Modulator frequency ratio (e.g. `2` ≈ bell-like). Must be positive. |
| `index` | `5` | FM depth as a multiple of the carrier (`0` = pure sine). Must be `>= 0`. |
| `envelope` | — | `{ attackSeconds, decaySeconds, sustainLevel, releaseSeconds }`: times `>= 0`, sustain in `[0, 1]`. After decay the voice holds sustain for 0.4 s, then releases. |

## Browser notes

- `AudioContext` requires a user gesture in most browsers — construct/resume inside a click or key handler.
- `createNoiseNode` needs `init()` first so the worklet module is registered; otherwise it transparently returns the buffer fallback.

### Static processor file

The worklet above ships as a real file — `@engineweb/audio-synthesis/processor` (`dist/processor.js`) — instead of a template string, so it is typechecked, linted, tested and bundled like any other module. `init()` loads it via `new URL('./processor.js', import.meta.url)`; for custom hosts, load the file directly:

```typescript
import processorUrl from '@engineweb/audio-synthesis/processor?url' // Vite asset URL

await context.audioWorklet.addModule(processorUrl)
```

## License

MIT
