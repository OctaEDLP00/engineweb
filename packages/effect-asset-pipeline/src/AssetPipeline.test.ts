import { describe, expect, it } from 'vitest'
import { AssetPipeline } from './AssetPipeline.js'
import type { AssetRequest } from './types/index.js'

function dataUrl(payload: string, tag = ''): string {
  return `data:application/octet-stream;base64,${Buffer.from(payload).toString('base64')}#${tag}`
}

function request(url: string, signal?: AbortSignal): AssetRequest {
  return signal === undefined ? { url, kind: 'binary' } : { url, kind: 'binary', signal }
}

describe('AssetPipeline construction', () => {
  it('rejects bad options', () => {
    expect(() => new AssetPipeline({ concurrency: 0 })).toThrow(RangeError)
    expect(() => new AssetPipeline({ maxRetries: -1 })).toThrow(RangeError)
    expect(() => new AssetPipeline({ cacheBudgetBytes: -1 })).toThrow(RangeError)
  })

  it('starts with an empty cache', () => {
    const pipe = new AssetPipeline()
    expect(pipe.cachedByteCount).toBe(0)
    expect(pipe.cachedEntryCount).toBe(0)
  })
})

describe('AssetPipeline loading', () => {
  it('loads bytes and serves cache hits by identity', async () => {
    const pipe = new AssetPipeline()
    const url = dataUrl('hello-engineweb')
    const first = await pipe.load(request(url))
    expect(new TextDecoder().decode(first)).toBe('hello-engineweb')
    const second = await pipe.load(request(url))
    expect(second).toBe(first)
    expect(pipe.cachedEntryCount).toBe(1)
    expect(pipe.cachedByteCount).toBe(first.byteLength)
  })

  it('dedupes concurrent loads of one URL', async () => {
    const pipe = new AssetPipeline()
    const url = dataUrl('shared', 'dedupe')
    const [a, b] = await Promise.all([pipe.load(request(url)), pipe.load(request(url))])
    expect(a).toBe(b)
    expect(pipe.cachedEntryCount).toBe(1)
  })

  it('evicts least-recently-used entries over budget', async () => {
    const pipe = new AssetPipeline({ cacheBudgetBytes: 8 })
    await pipe.load(request(dataUrl('aaaaa', 'a')))
    await pipe.load(request(dataUrl('bbbbb', 'b')))
    expect(pipe.cachedByteCount).toBeLessThanOrEqual(8)
    expect(pipe.cachedEntryCount).toBe(1)
    pipe.purge()
    expect(pipe.cachedByteCount).toBeLessThanOrEqual(8)
  })

  it('clears the cache', async () => {
    const pipe = new AssetPipeline()
    await pipe.load(request(dataUrl('x', 'clear')))
    pipe.clear()
    expect(pipe.cachedEntryCount).toBe(0)
    expect(pipe.cachedByteCount).toBe(0)
  })

  it('throws synchronously without a URL', () => {
    const pipe = new AssetPipeline()
    expect(() => pipe.load({ kind: 'binary' } as never)).toThrow(TypeError)
    expect(() => pipe.load(null as never)).toThrow(TypeError)
  })

  it('surfaces fetch failures after retries', async () => {
    const pipe = new AssetPipeline({ maxRetries: 0 })
    await expect(pipe.load(request('http://127.0.0.1:9/nope.bin'))).rejects.toThrow()
  })

  it('aborts queue waits', async () => {
    const pipe = new AssetPipeline()
    const controller = new AbortController()
    controller.abort()
    await expect(pipe.load(request(dataUrl('x', 'abort'), controller.signal))).rejects.toThrow()
  })
})
