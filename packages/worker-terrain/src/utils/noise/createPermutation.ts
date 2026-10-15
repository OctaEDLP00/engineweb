import { createSeededRandom } from './createSeededRandom.js'

/**
 * Builds the doubled (512-entry) permutation table behind the seeded Perlin
 * fields. Shared by the 2D and 3D generators so one seed shuffles both.
 *
 * @param seed Noise seed feeding the Fisher-Yates shuffle.
 * @returns 512-entry table (256 shuffled values, doubled for overflow-free indexing).
 */
export function createPermutation(seed: number): Uint8Array {
  const random = createSeededRandom(seed)
  const permutation = new Uint8Array(512)
  const base = new Uint8Array(256)
  for (let i = 0; i < 256; i++) base[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = base[i]
    base[i] = base[j]
    base[j] = tmp
  }
  for (let i = 0; i < 512; i++) permutation[i] = base[i & 255]
  return permutation
}
