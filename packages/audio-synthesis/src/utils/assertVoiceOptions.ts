import type { SynthVoiceOptions } from '../types/index.js'

/**
 * Validates a voice request and normalizes defaults (`ratio: 1`, `index: 5`).
 * Runs before any Web Audio node is touched, so it is safe to call without
 * a live context.
 *
 * @param options Candidate voice options.
 * @returns Normalized frequency, ratio, index and envelope parts.
 * @throws {TypeError} On non-object options or missing envelope.
 * @throws {RangeError} On non-positive frequency/ratio, negative index, or
 * out-of-range envelope parts.
 */
export default function assertVoiceOptions(options: SynthVoiceOptions) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('playVoice expects { frequency, envelope } options')
  }
  if (!Number.isFinite(options.frequency) || options.frequency <= 0) {
    throw new RangeError('frequency must be a positive number')
  }
  const ratio = options.ratio ?? 1
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError('ratio must be a positive number')
  }
  const index = options.index ?? 5
  if (!Number.isFinite(index) || index < 0) {
    throw new RangeError('index must be >= 0')
  }
  const envelope = options.envelope
  if (!envelope || typeof envelope !== 'object') {
    throw new TypeError('playVoice expects an ADSR envelope')
  }
  const { attackSeconds, decaySeconds, sustainLevel, releaseSeconds } = envelope
  if (!Number.isFinite(attackSeconds) || attackSeconds < 0) {
    throw new RangeError('envelope attackSeconds must be >= 0')
  }
  if (!Number.isFinite(decaySeconds) || decaySeconds < 0) {
    throw new RangeError('envelope decaySeconds must be >= 0')
  }
  if (!Number.isFinite(sustainLevel) || sustainLevel < 0 || sustainLevel > 1) {
    throw new RangeError('envelope sustainLevel must be within [0, 1]')
  }
  if (!Number.isFinite(releaseSeconds) || releaseSeconds < 0) {
    throw new RangeError('envelope releaseSeconds must be >= 0')
  }
  return {
    frequency: options.frequency,
    ratio,
    index,
    attack: attackSeconds,
    decay: decaySeconds,
    sustain: sustainLevel,
    release: releaseSeconds,
  }
}
