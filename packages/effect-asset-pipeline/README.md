# `@engineweb/effect-asset-pipeline`

A resilient asset loader and GPU-memory cache (textures, 3D models, audio, sprite sheets) with concurrency limits, exponential-backoff retries and LRU purging.

The design mirrors [Effect](https://effect.website/) resource patterns — bounded concurrency like a semaphore, retry schedules with backoff, and abortable scopes via `AbortSignal` — and drops cleanly into Effect `Stream`/`Effect` download pipelines.

## Features

- Bounded-concurrency download queue (`concurrency`), so 200 `<img>`-worth of assets never open 200 sockets.
- Exponential backoff with jitter (`150ms * 2^attempt`, capped at 5 s) up to `maxRetries`; HTTP errors and network failures both retry.
- LRU byte-budget cache (`cacheBudgetBytes`): repeat loads resolve from memory, `purge()` evicts least-recently-used entries back under budget.
- In-flight dedup: concurrent `load()` calls for one URL share a single fetch.
- Full abort support: an `AbortSignal` cancels queue waits, fetches and retry sleeps.

## Installation

```bash
pnpm add @engineweb/effect-asset-pipeline
```

```bash
pnpm add effect # optional — to orchestrate loads inside Effect pipelines
```

## Usage

```typescript
import { AssetPipeline } from '@engineweb/effect-asset-pipeline'

const assets = new AssetPipeline({ concurrency: 6, maxRetries: 3, cacheBudgetBytes: 256 * 1024 * 1024 })

// Level load with a global timeout
const controller = new AbortController()
setTimeout(() => controller.abort(), 30_000)

const [diffuse, level, theme] = await Promise.all([
  assets.load({ url: '/tex/arena.ktx2', kind: 'texture', signal: controller.signal }),
  assets.load({ url: '/models/arena.glb', kind: 'model', signal: controller.signal }),
  assets.load({ url: '/audio/theme.ogg', kind: 'audio', signal: controller.signal }),
])

uploadToGpu(diffuse) // ArrayBuffer, cached — the next load() for this URL is free
assets.purge() // evict LRU entries back under budget after level transitions
```

Inside Effect:

```typescript
import { Effect } from 'effect'
import { AssetPipeline } from '@engineweb/effect-asset-pipeline'

const loadAsset = (url: string) =>
  Effect.tryPromise({
    try: () => assets.load({ url, kind: 'texture' }),
    catch: (cause) => new AssetError({ url, cause }),
  }).pipe(Effect.withSpan('asset.load'))
```

## API

### `new AssetPipeline(options?: AssetPipelineOptions)`

| Option | Default | Description |
|---|---|---|
| `concurrency` | `6` | Max simultaneous fetches. Positive integer. |
| `maxRetries` | `3` | Retries after the first attempt. Non-negative integer. |
| `cacheBudgetBytes` | `256 MiB` | Soft byte budget. Non-negative. |

All options validate with `RangeError` on bad values.

### Methods

| Method | Description |
|---|---|
| `load(request): Promise<ArrayBuffer>` | Fetches (or cache-hits) one asset. Concurrent duplicate loads share one fetch. Rejects with the last error after retries, or immediately on abort. Throws `TypeError` synchronously when `request.url` is missing. |
| `purge()` | Evicts least-recently-used entries until within budget. |
| `clear()` | Empties the cache unconditionally. |
| `get cachedByteCount()` / `get cachedEntryCount()` | Cache telemetry. |

**`AssetRequest`**

| Field | Description |
|---|---|
| `url` | `string` or `URL`. Cache key is `String(url)`. |
| `kind` | `'texture'` \| `'model'` \| `'audio'` \| `'sprite-sheet'` \| `'binary'`. Informational today; reserved for kind-aware decoding budgets. |
| `priority?` | Reserved for priority scheduling (higher first). Accepted, currently advisory. |
| `signal?` | `AbortSignal` cancelling queue wait, fetch and retry sleeps. |

Cached buffers are shared, not copied — treat them as read-only after `load()` resolves.

## License

MIT
