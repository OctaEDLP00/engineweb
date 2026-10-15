/**
 * Column-major 4x4 multiply `out = a * b`, safe for in-place use (reads all
 * of `a` before writing `out`, so `out` may alias `a` but not `b` mid-pass).
 *
 * @param out Destination buffer.
 * @param outOffset Float offset of the result matrix in `out`.
 * @param a Left operand (16 floats).
 * @param b Right operand (16 floats).
 */
export default function mat4Mul(
  out: Float32Array,
  outOffset: number,
  a: Float32Array,
  b: Float32Array,
): void {
  const a00 = a[0]
  const a01 = a[1]
  const a02 = a[2]
  const a03 = a[3]
  const a10 = a[4]
  const a11 = a[5]
  const a12 = a[6]
  const a13 = a[7]
  const a20 = a[8]
  const a21 = a[9]
  const a22 = a[10]
  const a23 = a[11]
  const a30 = a[12]
  const a31 = a[13]
  const a32 = a[14]
  const a33 = a[15]
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4]
    const b1 = b[c * 4 + 1]
    const b2 = b[c * 4 + 2]
    const b3 = b[c * 4 + 3]
    out[outOffset + c * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3
    out[outOffset + c * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3
    out[outOffset + c * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3
    out[outOffset + c * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3
  }
}
