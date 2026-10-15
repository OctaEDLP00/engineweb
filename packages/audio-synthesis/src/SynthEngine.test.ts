import { describe, expect, it } from 'vitest'
import { SynthEngine } from './SynthEngine.js'
import type { SynthVoiceOptions } from './types/index.js'

// Browser-only paths (init, playback, buffers) need a real AudioContext;
// here we cover construction plus the pure validation layers.
function fakeContext(): AudioContext {
  return {
    createOscillator: () => undefined,
    createGain: () => undefined,
    createBuffer: () => undefined,
  } as unknown as AudioContext
}

function liveFakeContext(): { context: AudioContext; gain: { value: number } } {
  const gain = { value: 0 }
  const context = {
    createOscillator: () => undefined,
    createGain: () => ({ gain, connect: () => undefined }),
    createBuffer: () => undefined,
    destination: {},
    audioWorklet: undefined,
  } as unknown as AudioContext
  return { context, gain }
}

function voice(overrides: Partial<SynthVoiceOptions> = {}): SynthVoiceOptions {
  return {
    frequency: 440,
    envelope: { attackSeconds: 0.01, decaySeconds: 0.1, sustainLevel: 0.8, releaseSeconds: 0.2 },
    ...overrides,
  }
}

describe('SynthEngine construction', () => {
  it('requires an AudioContext-like object', () => {
    expect(() => new SynthEngine(null as never)).toThrow(TypeError)
    expect(() => new SynthEngine({} as never)).toThrow(TypeError)
    expect(() => new SynthEngine(fakeContext())).not.toThrow()
  })

  it('starts uninitialized', () => {
    expect(new SynthEngine(fakeContext()).isInitialized).toBe(false)
  })
})

describe('SynthEngine voice validation', () => {
  it('rejects bad frequencies and FM settings', () => {
    const engine = new SynthEngine(fakeContext())
    expect(() => engine.playVoice(voice({ frequency: 0 }))).toThrow(RangeError)
    expect(() => engine.playVoice(voice({ ratio: -1 }))).toThrow(RangeError)
    expect(() => engine.playVoice(voice({ index: -1 }))).toThrow(RangeError)
    expect(() => engine.playVoice(null as never)).toThrow(TypeError)
  })

  it('rejects bad ADSR envelopes', () => {
    const engine = new SynthEngine(fakeContext())
    const bad = (envelope: unknown): void => {
      engine.playVoice({ frequency: 440, envelope } as never)
    }
    expect(() => bad(undefined)).toThrow(TypeError)
    expect(() =>
      bad({ attackSeconds: -1, decaySeconds: 0, sustainLevel: 1, releaseSeconds: 0 }),
    ).toThrow(RangeError)
    expect(() =>
      bad({ attackSeconds: 0, decaySeconds: 0, sustainLevel: 2, releaseSeconds: 0 }),
    ).toThrow(RangeError)
    expect(() =>
      bad({ attackSeconds: 0, decaySeconds: 0, sustainLevel: 1, releaseSeconds: -1 }),
    ).toThrow(RangeError)
  })
})

describe('SynthEngine noise validation', () => {
  it('rejects unknown noise kinds before touching the context', () => {
    const engine = new SynthEngine(fakeContext())
    expect(() => engine.createNoise('ultraviolet' as never)).toThrow(TypeError)
    expect(() => engine.createNoiseNode('ultraviolet' as never)).toThrow(TypeError)
  })
})

describe('SynthEngine master volume', () => {
  it('defaults to the master gain constant', () => {
    expect(new SynthEngine(fakeContext()).masterVolume).toBe(0.8)
  })

  it('validates the range', () => {
    const engine = new SynthEngine(fakeContext())
    expect(() => engine.setMasterVolume(Number.NaN)).toThrow(RangeError)
    expect(() => engine.setMasterVolume(-0.1)).toThrow(RangeError)
    expect(() => engine.setMasterVolume(1.1)).toThrow(RangeError)
    expect(() => engine.setMasterVolume(0)).not.toThrow()
    expect(() => engine.setMasterVolume(1)).not.toThrow()
  })

  it('applies live gain after init', async () => {
    const { context, gain } = liveFakeContext()
    const engine = new SynthEngine(context)
    await engine.init()
    engine.setMasterVolume(0.5)
    expect(gain.value).toBe(0.5)
    expect(engine.masterVolume).toBe(0.5)
  })

  it('stores pre-init values and applies them on init', async () => {
    const { context, gain } = liveFakeContext()
    const engine = new SynthEngine(context)
    engine.setMasterVolume(0.3)
    expect(engine.masterVolume).toBe(0.3)
    await engine.init()
    expect(gain.value).toBe(0.3)
  })
})
