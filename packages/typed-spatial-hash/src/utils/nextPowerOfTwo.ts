/**
 * Smallest power of two greater than or equal to `value`.
 *
 * @param value Lower bound (expected `>= 1`).
 * @returns The bucket-table size derived from a capacity.
 */
export default function nextPowerOfTwo(value: number): number {
  let size = 1
  while (size < value) size *= 2
  return size
}
