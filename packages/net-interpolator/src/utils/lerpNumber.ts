/**
 * Linear interpolation between two numbers.
 *
 * @param a Start value.
 * @param b End value.
 * @param t Blend factor in `[0, 1]` (`0` → `a`, `1` → `b`).
 * @returns `a + (b - a) * t`.
 */
export default function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
