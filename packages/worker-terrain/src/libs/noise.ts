/** Deterministic 2D and 3D noise primitives for procedural terrain. */
import { GRAD_3, GRAD_X, GRAD_Y } from '../const.js'
import type { Noise2D, Noise3D } from '../types/index.js'
import { createPermutation } from '../utils/noise/createPermutation.js'
import fade from '../utils/noise/fade.js'
import lerp from '../utils/noise/lerp.js'

/**
 * Improved Perlin noise over a seed-shuffled permutation table.
 * Output range is approximately `[-√2, √2]` due to the output scaling.
 */
export function createPerlin2D(seed: number): Noise2D {
  const permutation = createPermutation(seed)

  return (x: number, y: number): number => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const X = xi & 255
    const Y = yi & 255
    const aa = permutation[(permutation[X] + Y) & 255] & 7
    const ab = permutation[(permutation[X] + Y + 1) & 255] & 7
    const ba = permutation[(permutation[X + 1] + Y) & 255] & 7
    const bb = permutation[(permutation[X + 1] + Y + 1) & 255] & 7
    const u = fade(xf)
    const v = fade(yf)
    const x1 = lerp(GRAD_X[aa] * xf + GRAD_Y[aa] * yf, GRAD_X[ba] * (xf - 1) + GRAD_Y[ba] * yf, u)
    const x2 = lerp(
      GRAD_X[ab] * xf + GRAD_Y[ab] * (yf - 1),
      GRAD_X[bb] * (xf - 1) + GRAD_Y[bb] * (yf - 1),
      u,
    )
    return (lerp(x1, x2, v) / Math.SQRT2) * 2
  }
}

/**
 * Classic improved Perlin noise in 3D over the same seed-shuffled table as
 * the 2D field, so one seed drives heightmaps and voxel density together.
 * Output range is approximately `[-1, 1]`.
 *
 * @param seed Noise seed.
 * @returns Field function `(x, y, z) => value`.
 *
 * @example
 * ```typescript
 * const density = createPerlin3D(7)
 * const solid = fbm3D(density, x, y, z, 4) > 0
 * ```
 */
export function createPerlin3D(seed: number): Noise3D {
  const permutation = createPermutation(seed)

  const grad = (hash: number, dx: number, dy: number, dz: number): number => {
    const o = (hash % 12) * 3
    return GRAD_3[o] * dx + GRAD_3[o + 1] * dy + GRAD_3[o + 2] * dz
  }

  return (x: number, y: number, z: number): number => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const xf = x - xi
    const yf = y - yi
    const zf = z - zi
    const X = xi & 255
    const Y = yi & 255
    const Z = zi & 255
    const u = fade(xf)
    const v = fade(yf)
    const w = fade(zf)
    const A = (permutation[X] + Y) & 255
    const B = (permutation[X + 1] + Y) & 255
    const AA = (permutation[A] + Z) & 255
    const AB = (permutation[A + 1] + Z) & 255
    const BA = (permutation[B] + Z) & 255
    const BB = (permutation[B + 1] + Z) & 255
    const x1 = lerp(
      lerp(grad(permutation[AA], xf, yf, zf), grad(permutation[BA], xf - 1, yf, zf), u),
      lerp(grad(permutation[AB], xf, yf - 1, zf), grad(permutation[BB], xf - 1, yf - 1, zf), u),
      v,
    )
    const x2 = lerp(
      lerp(
        grad(permutation[AA + 1], xf, yf, zf - 1),
        grad(permutation[BA + 1], xf - 1, yf, zf - 1),
        u,
      ),
      lerp(
        grad(permutation[AB + 1], xf, yf - 1, zf - 1),
        grad(permutation[BB + 1], xf - 1, yf - 1, zf - 1),
        u,
      ),
      v,
    )
    return lerp(x1, x2, w)
  }
}

/**
 * Fractal Brownian motion over `octaves` of the base noise field,
 * normalized by the amplitude sum.
 *
 * @param noise Base 2D field.
 * @param x Sample X (scaled by `frequency` per octave internally).
 * @param y Sample Y.
 * @param octaves Positive integer octave count, defaults to `4`.
 * @param lacunarity Frequency multiplier per octave, defaults to `2`.
 * @param gain Amplitude multiplier per octave, defaults to `0.5`.
 * @returns Normalized fractal value.
 * @throws {RangeError} On non-positive integer `octaves`.
 */
export function fbm(
  noise: Noise2D,
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  if (!Number.isInteger(octaves) || octaves <= 0) {
    throw new RangeError('fbm octaves must be a positive integer')
  }
  let amplitude = 1
  let frequency = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency, y * frequency)
    norm += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }
  return norm === 0 ? 0 : sum / norm
}

/**
 * Fractal Brownian motion over `octaves` of a 3D base field — the voxel
 * counterpart of {@link fbm}. Kept as a separate function because a fourth
 * numeric argument would be ambiguous with 2D `octaves`.
 *
 * @param noise Base 3D field.
 * @param x Sample X.
 * @param y Sample Y.
 * @param z Sample Z.
 * @param octaves Positive integer octave count, defaults to `4`.
 * @param lacunarity Frequency multiplier per octave, defaults to `2`.
 * @param gain Amplitude multiplier per octave, defaults to `0.5`.
 * @returns Normalized fractal value.
 * @throws {RangeError} On non-positive integer `octaves`.
 */
export function fbm3D(
  noise: Noise3D,
  x: number,
  y: number,
  z: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  if (!Number.isInteger(octaves) || octaves <= 0) {
    throw new RangeError('fbm3D octaves must be a positive integer')
  }
  let amplitude = 1
  let frequency = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency, y * frequency, z * frequency)
    norm += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }
  return norm === 0 ? 0 : sum / norm
}
