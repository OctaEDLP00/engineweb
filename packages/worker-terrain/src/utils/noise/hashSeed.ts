/**
 * Folds any finite seed number into a `uint32` via its IEEE-754 bits, so
 * fractional seeds shuffle as well as integers. Non-finite seeds map to `0`.
 *
 * @param seed Noise seed.
 * @returns Unsigned 32-bit hash for the PRNG state.
 */
export default function hashSeed(seed: number): number {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, Number.isFinite(seed) ? seed : 0)
  return (view.getUint32(0) ^ view.getUint32(4)) >>> 0
}
