import { MASTER_GAIN, NOISE_SECONDS, SUSTAIN_HOLD_SECONDS } from './const.js'
import type { NoiseKind, SynthVoiceOptions } from './types/index.js'
import assertVoiceOptions from './utils/assertVoiceOptions.js'
import isNoiseKind from './utils/isNoiseKind.js'

/**
 * Procedural Web Audio engine: FM synthesis voices plus white/pink/brown
 * noise, with automatic node teardown. Construct inside a user gesture —
 * most browsers start `AudioContext` suspended otherwise.
 *
 * @example
 * ```typescript
 * const engine = new SynthEngine(new AudioContext())
 * await engine.init()
 * engine.playVoice({ frequency: 880, envelope: { attackSeconds: 0.005, decaySeconds: 0.08, sustainLevel: 0.4, releaseSeconds: 0.15 } })
 * ```
 */
export class SynthEngine {
  readonly context: AudioContext

  private master: GainNode | null = null
  private initialized = false
  private pendingVolume: number | null = null

  /**
   * Accepts any object exposing the `AudioContext` creation surface, so
   * duck-typed contexts and test doubles work — and Node (where
   * `AudioContext` is undefined) throws `TypeError`, never `ReferenceError`.
   *
   * @param context Live `AudioContext` (or compatible surface).
   * @throws {TypeError} Without `createOscillator`/`createGain`/`createBuffer`.
   */
  constructor(context: AudioContext) {
    if (
      !context ||
      typeof (context as AudioContext).createOscillator !== 'function' ||
      typeof (context as AudioContext).createGain !== 'function' ||
      typeof (context as AudioContext).createBuffer !== 'function'
    ) {
      throw new TypeError('SynthEngine requires an AudioContext')
    }
    this.context = context
  }

  /** Whether `init()` has completed. */
  get isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Current master output level in `[0, 1]`: the live gain after `init()`,
   * otherwise the pending value (or the `0.8` default).
   */
  get masterVolume(): number {
    return this.master?.gain.value ?? this.pendingVolume ?? MASTER_GAIN
  }

  /**
   * Sets the master output level. Before `init()` the value is stored and
   * applied when the master gain is created.
   *
   * @param value Linear gain in `[0, 1]` (`0` = silent).
   * @throws {RangeError} On non-finite values outside `[0, 1]`.
   */
  setMasterVolume(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError('master volume must be within [0, 1]')
    }
    if (this.master) this.master.gain.value = value
    else this.pendingVolume = value
  }

  /**
   * Wires the master gain and registers the static `engineweb-noise`
   * worklet module shipped beside this file (`dist/processor.js`).
   * Idempotent; unresolvable modules (e.g. bundled apps that don't serve
   * the file) fall through to buffer-based `createNoise`.
   */
  async init(): Promise<void> {
    if (this.initialized) return
    this.master = this.context.createGain()
    this.master.gain.value = this.pendingVolume ?? MASTER_GAIN
    this.master.connect(this.context.destination)
    if (this.context.audioWorklet) {
      try {
        await this.context.audioWorklet.addModule(new URL('./processor.js', import.meta.url))
      } catch {
        // Buffer-based noise (createNoise) works without the worklet.
      }
    }
    this.initialized = true
  }

  private output(): AudioNode {
    return this.master ?? this.context.destination
  }

  /**
   * Plays a one-shot FM voice: carrier plus ratio-scaled modulator through
   * an ADSR gain envelope, auto-stopped and disconnected after release.
   * Schedules and returns immediately; validation runs before any node.
   *
   * @param options Frequency, FM depth and envelope; see {@link SynthVoiceOptions}.
   * @throws {TypeError} On non-object options or missing envelope.
   * @throws {RangeError} On invalid frequency, ratio, index or envelope parts.
   */
  playVoice(options: SynthVoiceOptions): void {
    const { frequency, ratio, index, attack, decay, sustain, release } = assertVoiceOptions(options)
    const context = this.context
    const now = context.currentTime

    const carrier = context.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = frequency

    let modulator: OscillatorNode | null = null
    let depth: GainNode | null = null
    if (index > 0) {
      modulator = context.createOscillator()
      modulator.type = 'sine'
      modulator.frequency.value = frequency * ratio
      depth = context.createGain()
      depth.gain.value = frequency * index
      modulator.connect(depth)
      depth.connect(carrier.frequency)
    }

    const amp = context.createGain()
    const attackEnd = now + attack
    const decayEnd = attackEnd + decay
    const holdEnd = decayEnd + SUSTAIN_HOLD_SECONDS
    const releaseEnd = holdEnd + release
    if (attack <= 0) {
      amp.gain.setValueAtTime(1, now)
    } else {
      amp.gain.setValueAtTime(0, now)
      amp.gain.linearRampToValueAtTime(1, attackEnd)
    }
    if (decay <= 0) {
      amp.gain.setValueAtTime(sustain, attackEnd)
    } else {
      amp.gain.linearRampToValueAtTime(sustain, decayEnd)
    }
    amp.gain.setValueAtTime(sustain, holdEnd)
    if (release <= 0) {
      amp.gain.setValueAtTime(0, holdEnd)
    } else {
      amp.gain.linearRampToValueAtTime(0, releaseEnd)
    }

    carrier.connect(amp)
    amp.connect(this.output())
    carrier.start(now)
    modulator?.start(now)
    const stopAt = releaseEnd + 0.05
    carrier.stop(stopAt)
    modulator?.stop(stopAt)
    carrier.onended = () => {
      try {
        carrier.disconnect()
        amp.disconnect()
        modulator?.disconnect()
        depth?.disconnect()
      } catch {
        // Nodes are already torn down.
      }
    }
  }

  /**
   * Creates a looping 2-second noise buffer source: uniform white, Paul
   * Kellet-filtered pink, or leaky-integrator brown. The caller connects
   * and starts the returned node.
   *
   * @param kind Noise color.
   * @returns Looping `AudioBufferSourceNode` (not yet started).
   * @throws {TypeError} On unknown kinds — checked before touching the context.
   */
  createNoise(kind: NoiseKind): AudioBufferSourceNode {
    if (!isNoiseKind(kind)) {
      throw new TypeError("createNoise: kind must be one of 'white', 'pink' or 'brown'")
    }
    const context = this.context
    const length = Math.max(1, Math.floor(context.sampleRate * NOISE_SECONDS))
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    if (kind === 'white') {
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    } else if (kind === 'pink') {
      let b0 = 0
      let b1 = 0
      let b2 = 0
      let b3 = 0
      let b4 = 0
      let b5 = 0
      let b6 = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.969 * b2 + white * 0.153852
        b3 = 0.8665 * b3 + white * 0.3104856
        b4 = 0.55 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.016898
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      }
    } else {
      let last = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    return source
  }

  /**
   * Creates a streaming `AudioWorkletNode` noise source connected to the
   * master output. Requires `init()` for module registration; falls back
   * to a connected `createNoise()` buffer when AudioWorklet is unavailable.
   *
   * @param kind Noise color.
   * @throws {TypeError} On unknown kinds.
   */
  createNoiseNode(kind: NoiseKind): AudioWorkletNode | AudioBufferSourceNode {
    if (!isNoiseKind(kind)) {
      throw new TypeError("createNoiseNode: kind must be one of 'white', 'pink' or 'brown'")
    }
    try {
      const node = new AudioWorkletNode(this.context, 'engineweb-noise', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        processorOptions: { kind },
      })
      node.connect(this.output())
      return node
    } catch {
      const fallback = this.createNoise(kind)
      fallback.connect(this.output())
      return fallback
    }
  }
}
