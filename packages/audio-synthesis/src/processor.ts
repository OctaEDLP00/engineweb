/**
 * Streaming noise generator running inside an AudioWorklet thread, shipped
 * as `dist/processor.js` and importable via
 * `@engineweb/audio-synthesis/processor`.
 *
 * `SynthEngine.init()` registers it with `audioWorklet.addModule()`; custom
 * hosts can load it directly (bundler `?url` suffix works). Kinds mirror
 * {@link NoiseKind}: uniform white, Paul Kellet-filtered pink and a leaky
 * brown integrator.
 */

import type { NoiseKind } from './types/index.js'

// TypeScript's DOM lib omits worklet-scope globals (they only exist inside
// an AudioWorkletGlobalScope), so the file declares the minimal surface.
declare class AudioWorkletProcessor {
  constructor(options?: AudioWorkletNodeOptions)
  process(
    inputs: Array<Array<Float32Array>>,
    outputs: Array<Array<Float32Array>>,
    parameters: Record<string, Float32Array>,
  ): boolean
}

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void

class EngineWebNoiseProcessor extends AudioWorkletProcessor {
  private kind: NoiseKind
  private readonly pink: Array<number>
  private brown: number

  constructor(options?: { processorOptions?: { kind?: unknown } }) {
    super()
    const kind = options?.processorOptions?.kind
    this.kind = kind === 'pink' || kind === 'brown' ? kind : 'white'
    this.pink = [0, 0, 0, 0, 0, 0, 0]
    this.brown = 0
  }

  process(_inputs: Array<Array<Float32Array>>, outputs: Array<Array<Float32Array>>): boolean {
    const out = outputs[0]
    for (let c = 0; c < out.length; c++) {
      const channel = out[c]
      for (let i = 0; i < channel.length; i++) {
        const white = Math.random() * 2 - 1
        if (this.kind === 'pink') {
          const b = this.pink
          b[0] = 0.99886 * b[0] + white * 0.0555179
          b[1] = 0.99332 * b[1] + white * 0.0750759
          b[2] = 0.969 * b[2] + white * 0.153852
          b[3] = 0.8665 * b[3] + white * 0.3104856
          b[4] = 0.55 * b[4] + white * 0.5329522
          b[5] = -0.7616 * b[5] - white * 0.016898
          channel[i] = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + white * 0.5362) * 0.11
          b[6] = white * 0.115926
        } else if (this.kind === 'brown') {
          this.brown = (this.brown + 0.02 * white) / 1.02
          channel[i] = this.brown * 3.5
        } else {
          channel[i] = white
        }
      }
    }
    return true
  }
}

registerProcessor('engineweb-noise', EngineWebNoiseProcessor)
