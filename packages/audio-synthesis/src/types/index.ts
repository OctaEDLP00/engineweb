/** Noise color: flat spectrum, `1/f` filtered, or integrated random walk. */
export type NoiseKind = 'white' | 'pink' | 'brown'

export interface AdsrEnvelope {
  /** Ramp 0→peak in seconds, `>= 0` (`0` starts at peak). */
  attackSeconds: number
  /** Ramp peak→sustain in seconds, `>= 0`. */
  decaySeconds: number
  /** Held level in `[0, 1]` between decay and release. */
  sustainLevel: number
  /** Ramp sustain→silence in seconds, `>= 0`. */
  releaseSeconds: number
}

export interface SynthVoiceOptions {
  /** Carrier frequency in Hz. Must be positive. */
  frequency: number
  /** FM modulation ratio (e.g. 2 = bell-like tones). Positive, defaults to `1`. */
  ratio?: number
  /** FM modulation index (deeper overtones with higher values). `>= 0`, defaults to `5`. */
  index?: number
  /** ADSR envelope; see {@link AdsrEnvelope}. */
  envelope: AdsrEnvelope
}
