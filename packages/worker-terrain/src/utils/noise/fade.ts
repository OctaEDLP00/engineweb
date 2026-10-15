/**
 * Perlin fade curve `6t⁵−15t⁴+10t³`: zero first and second derivatives at
 * the lattice ends, so interpolated cells join seamlessly.
 *
 * @param t Fractional position in `[0, 1]`.
 * @returns Smoothed weight in `[0, 1]`.
 */
export default function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}
