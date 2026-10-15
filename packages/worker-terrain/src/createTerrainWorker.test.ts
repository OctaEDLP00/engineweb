import { afterEach, describe, expect, it } from 'vitest'
import { createTerrainWorker } from './createTerrainWorker.js'
import { createHeightmapChunk } from './libs/heightmap.js'
import type { TerrainChunk, TerrainChunkOptions, TerrainWorkerHandle } from './types/index.js'

// The static worker runtime needs a real Web Worker (browser only); here we
// cover the guard rails plus the full host protocol against a fake.
class FakeWorker extends EventTarget {
  static last: FakeWorker | undefined
  readonly url: URL
  readonly posted: Array<unknown> = []
  terminated = false

  constructor(url: string | URL) {
    super()
    this.url = new URL(url)
    FakeWorker.last = this
  }

  postMessage(message: unknown): void {
    this.posted.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }
}

function installFakeWorker(): () => void {
  const previous = (globalThis as Record<string, unknown>).Worker
  ;(globalThis as Record<string, unknown>).Worker = FakeWorker
  FakeWorker.last = undefined
  return () => {
    ;(globalThis as Record<string, unknown>).Worker = previous
  }
}

function host(): { worker: TerrainWorkerHandle; fake: FakeWorker } {
  const worker = createTerrainWorker(createHeightmapChunk) as unknown as TerrainWorkerHandle
  const fake = FakeWorker.last
  if (!fake) throw new Error('test setup: fake worker was not constructed')
  return { worker, fake }
}

describe('createTerrainWorker guards', () => {
  it('rejects non-function generators', () => {
    expect(() => createTerrainWorker(null as never)).toThrow(TypeError)
    expect(() => createTerrainWorker('nope' as never)).toThrow(TypeError)
  })

  it('reports missing Web Workers outside browsers', () => {
    if (typeof Worker === 'undefined') {
      expect(() => createTerrainWorker(createHeightmapChunk)).toThrow(
        'Web Workers are not available',
      )
    } else {
      const worker = createTerrainWorker(createHeightmapChunk)
      expect(typeof worker.postMessage).toBe('function')
      worker.terminate()
    }
  })
})

describe('createTerrainWorker protocol', () => {
  afterEach(() => {
    FakeWorker.last = undefined
  })

  it('loads the static worker file and boots it with init source', () => {
    const restore = installFakeWorker()
    try {
      const { worker, fake } = host()
      expect(fake.url.pathname.endsWith('/worker.js')).toBe(true)
      expect(fake.posted[0]).toEqual({ type: 'init', source: createHeightmapChunk.toString() })
      worker.terminate()
      expect(fake.terminated).toBe(true)
    } finally {
      restore()
    }
  })

  it('resolves requestChunk from transferable responses', async () => {
    const restore = installFakeWorker()
    try {
      const { worker, fake } = host()
      const pending = worker.requestChunk({ size: 8, lod: 0, seed: 1 })
      const sent = fake.posted[1] as { id: number; options: TerrainChunkOptions }
      expect(typeof sent.id).toBe('number')
      expect(sent.options).toEqual({ size: 8, lod: 0, seed: 1 })
      const positions = new Float32Array([10, 20, 30])
      const indices = new Uint32Array([0])
      fake.emit({
        id: sent.id,
        ok: true,
        positions: positions.buffer,
        positionsByteOffset: 0,
        positionsLength: 3,
        indices: indices.buffer,
        indicesByteOffset: 0,
        indicesLength: 1,
        lod: 0,
      })
      const chunk: TerrainChunk = await pending
      expect(chunk.positions).toEqual(positions)
      expect(chunk.indices).toEqual(indices)
      expect(chunk.lod).toBe(0)
    } finally {
      restore()
    }
  })

  it('rejects on worker failures and ignores unknown messages', async () => {
    const restore = installFakeWorker()
    try {
      const { worker, fake } = host()
      const pending = worker.requestChunk({ size: 8, lod: 0, seed: 1 })
      fake.emit({ hello: 'not-a-response' })
      const sent = fake.posted[1] as { id: number }
      fake.emit({ id: sent.id, ok: false, error: 'boom' })
      await expect(pending).rejects.toThrow('boom')
    } finally {
      restore()
    }
  })

  it('rejects pending requests on terminate', async () => {
    const restore = installFakeWorker()
    try {
      const { worker } = host()
      const pending = worker.requestChunk({ size: 8, lod: 0, seed: 1 })
      worker.terminate()
      await expect(pending).rejects.toThrow('terminated')
    } finally {
      restore()
    }
  })

  it('validates requestChunk options before posting', () => {
    const restore = installFakeWorker()
    try {
      const { worker, fake } = host()
      expect(() => worker.requestChunk({ size: 0, lod: 0, seed: 1 })).toThrow(RangeError)
      expect(fake.posted.length).toBe(1)
    } finally {
      restore()
    }
  })
})
