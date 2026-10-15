import { describe, expect, it } from 'vitest'
import { WasmPhysicsBinding } from './WasmPhysicsBinding.js'

const DEAD_URL = 'http://127.0.0.1:9/physics.wasm'

/** Smallest valid module: `\0asm` magic plus the version word, zero sections. */
function minimalModuleUrl(): string {
  const bytes = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
  return `data:application/wasm;base64,${bytes.toString('base64')}`
}

async function fallbackBinding(maxBodies = 8): Promise<WasmPhysicsBinding> {
  const physics = new WasmPhysicsBinding({ moduleUrl: DEAD_URL, maxBodies })
  await physics.init()
  return physics
}

describe('WasmPhysicsBinding construction', () => {
  it('requires a moduleUrl', () => {
    expect(() => new WasmPhysicsBinding({ moduleUrl: '' })).toThrow(TypeError)
    expect(() => new WasmPhysicsBinding({} as never)).toThrow(TypeError)
  })

  it('validates budgets', () => {
    expect(() => new WasmPhysicsBinding({ moduleUrl: 'x.wasm', maxBodies: 0 })).toThrow(RangeError)
    expect(() => new WasmPhysicsBinding({ moduleUrl: 'x.wasm', gravity: Number.NaN })).toThrow(
      RangeError,
    )
  })

  it('exposes options and defaults', () => {
    const physics = new WasmPhysicsBinding({ moduleUrl: 'x.wasm' })
    expect(physics.maxBodies).toBe(1024)
    expect(physics.sharedMemory).toBe(false)
    expect(physics.gravity).toBe(-9.81)
    expect(physics.bodyCount).toBe(0)
  })
})

describe('WasmPhysicsBinding lifecycle', () => {
  it('requires init before use', () => {
    const physics = new WasmPhysicsBinding({ moduleUrl: DEAD_URL })
    expect(() => physics.getTransformView()).toThrow('init()')
    expect(() => physics.step(0.016)).toThrow('init()')
    expect(() => physics.addBody([0, 0, 0])).toThrow('init()')
  })

  it('rejects non-WebAssembly responses with a clear reason', async () => {
    const physics = new WasmPhysicsBinding({ moduleUrl: 'data:text/html,<html>not wasm</html>' })
    await physics.init()
    expect(physics.usingWasm).toBe(false)
    expect(physics.fallback).toMatch('not a WebAssembly binary')
  })

  it('compiles a minimal module but still needs env.memory to drive', async () => {
    const physics = new WasmPhysicsBinding({ moduleUrl: minimalModuleUrl() })
    await physics.init()
    expect(physics.usingWasm).toBe(false)
    expect(physics.fallback).toMatch('env.memory')
  })

  it('falls back to JS integration when the module is unreachable', async () => {
    const physics = await fallbackBinding()
    expect(physics.usingWasm).toBe(false)
    expect(typeof physics.fallback).toBe('string')
  })

  it('rejects shared memory where unavailable', async () => {
    const physics = new WasmPhysicsBinding({ moduleUrl: DEAD_URL, sharedMemory: true })
    if (typeof SharedArrayBuffer === 'undefined') {
      await expect(physics.init()).rejects.toThrow('SharedArrayBuffer')
    } else {
      await physics.init()
      expect(physics.usingWasm).toBe(false)
    }
  })
})

describe('WasmPhysicsBinding simulation', () => {
  it('integrates gravity on fallback bodies', async () => {
    const physics = await fallbackBinding()
    const body = physics.addBody([0, 10, 0])
    expect(body).toBe(0)
    physics.step(1)
    const view = physics.getTransformView()
    expect(view.bodyCount).toBe(1)
    expect(view.matrices.length).toBe(16)
    expect(view.matrices[13]).toBeLessThan(10)
    expect(view.matrices[13]).toBeCloseTo(10 - 9.81, 5)
  })

  it('advects initial velocity', async () => {
    const physics = await fallbackBinding()
    physics.addBody([0, 0, 0], [2, 0, 0])
    physics.step(0.5)
    expect(physics.getTransformView().matrices[12]).toBeCloseTo(1, 5)
  })

  it('enforces body capacity', async () => {
    const physics = await fallbackBinding(1)
    physics.addBody([0, 0, 0])
    expect(() => physics.addBody([1, 1, 1])).toThrow('capacity exhausted')
  })

  it('validates step and body vectors', async () => {
    const physics = await fallbackBinding()
    expect(() => physics.step(0)).toThrow(RangeError)
    expect(() => physics.step(-1)).toThrow(RangeError)
    expect(() => physics.addBody([0, 0, 0, 9] as never)).toThrow(TypeError)
    expect(() => physics.addBody([0, Number.NaN, 0])).toThrow(RangeError)
  })
})
