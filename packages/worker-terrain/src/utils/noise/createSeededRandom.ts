import hashSeed from './hashSeed.js'

/**
 * Mulberry32 PRNG — small, fast and fully deterministic per seed.
 *
 * @param seed Any finite number; folded to `uint32` via IEEE-754 bits.
 * @returns Zero-argument generator emitting values in `[0, 1)`.
 */
export function createSeededRandom(seed: number): () => number {
  let state = hashSeed(seed) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
