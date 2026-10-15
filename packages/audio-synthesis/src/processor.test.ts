import { describe, expect, it } from 'vitest'

// The worklet module only needs its two globals; stubbing them lets the real
// DSP run in Node. See the browser check in game-example for live registration.
interface ProcessorInstance {
  process: (inputs: Array<Array<Float32Array>>, outputs: Array<Array<Float32Array>>) => boolean
}

type ProcessorCtor = new (options?: { processorOptions?: { kind?: unknown } }) => ProcessorInstance

let cachedCtor: ProcessorCtor | undefined

async function loadProcessor(): Promise<ProcessorCtor> {
  if (cachedCtor) return cachedCtor
  const scope = globalThis as Record<string, unknown>
  const previousProcessor = scope.AudioWorkletProcessor
  const previousRegister = scope.registerProcessor
  let registered: ProcessorCtor | undefined
  scope.AudioWorkletProcessor = class {}
  scope.registerProcessor = (name: string, ctor: unknown): void => {
    if (name === 'engineweb-noise') registered = ctor as ProcessorCtor
  }
  try {
    await import('./processor.js')
  } finally {
    scope.AudioWorkletProcessor = previousProcessor
    scope.registerProcessor = previousRegister
  }
  if (!registered) throw new Error('test setup: processor was not registered')
  cachedCtor = registered
  return registered
}

describe('noise processor module', () => {
  it('registers under engineweb-noise and fills white buffers in range', async () => {
    const Ctor = await loadProcessor()
    const white = new Ctor({ processorOptions: { kind: 'white' } })
    const out = [new Float32Array(256)]
    expect(white.process([[]], [out])).toBe(true)
    for (const value of out[0]) {
      expect(value).toBeGreaterThanOrEqual(-1)
      expect(value).toBeLessThanOrEqual(1)
    }
    expect(new Set(out[0]).size).toBeGreaterThan(1)
  })

  it('produces bounded pink noise', async () => {
    const Ctor = await loadProcessor()
    const pink = new Ctor({ processorOptions: { kind: 'pink' } })
    const out = [new Float32Array(512)]
    expect(pink.process([[]], [out])).toBe(true)
    for (const value of out[0]) {
      expect(Number.isFinite(value)).toBe(true)
      expect(Math.abs(value)).toBeLessThan(1)
    }
  })

  it('produces smooth brown noise', async () => {
    const Ctor = await loadProcessor()
    const brown = new Ctor({ processorOptions: { kind: 'brown' } })
    const out = [new Float32Array(512)]
    brown.process([[]], [out])
    let maxStep = 0
    for (let i = 1; i < out[0].length; i++) {
      maxStep = Math.max(maxStep, Math.abs(out[0][i] - out[0][i - 1]))
    }
    expect(maxStep).toBeLessThan(0.2)
  })

  it('defaults unknown kinds to white', async () => {
    const Ctor = await loadProcessor()
    const fallback = new Ctor({ processorOptions: { kind: 'ultraviolet' } })
    const plain = new Ctor()
    for (const node of [fallback, plain]) {
      const out = [new Float32Array(64)]
      node.process([[]], [out])
      for (const value of out[0]) {
        expect(value).toBeGreaterThanOrEqual(-1)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })
})
