/**
 * Element-wise float comparison using `Object.is`, so `NaN` equals `NaN`
 * (a rewrite with identical bits is not a mutation) while `-0` and `+0`
 * differ.
 *
 * @param a First buffer.
 * @param b Second buffer of equal length.
 * @returns `true` when every lane is identical.
 */
export default function floatsEqual(a: Float32Array, b: Float32Array): boolean {
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}
