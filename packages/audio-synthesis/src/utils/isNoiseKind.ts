import type { NoiseKind } from '../types/index.js'

/**
 * Narrowing guard for the three supported noise colors.
 *
 * @param value Candidate kind.
 * @returns `true` for `'white'`, `'pink'` or `'brown'`.
 */
export default function isNoiseKind(value: unknown): value is NoiseKind {
  return value === 'white' || value === 'pink' || value === 'brown'
}
