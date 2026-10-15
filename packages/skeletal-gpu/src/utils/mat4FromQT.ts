/**
 * Column-major 4x4 matrix from a unit quaternion plus translation.
 *
 * @param out Destination buffer.
 * @param outOffset Float offset of the matrix start in `out`.
 * @param qx Quaternion X.
 * @param qy Quaternion Y.
 * @param qz Quaternion Z.
 * @param qw Quaternion W.
 * @param tx Translation X.
 * @param ty Translation Y.
 * @param tz Translation Z.
 */
export default function mat4FromQT(
  out: Float32Array,
  outOffset: number,
  qx: number,
  qy: number,
  qz: number,
  qw: number,
  tx: number,
  ty: number,
  tz: number,
): void {
  const x2 = qx + qx
  const y2 = qy + qy
  const z2 = qz + qz
  const xx = qx * x2
  const xy = qx * y2
  const xz = qx * z2
  const yy = qy * y2
  const yz = qy * z2
  const zz = qz * z2
  const wx = qw * x2
  const wy = qw * y2
  const wz = qw * z2
  out[outOffset] = 1 - (yy + zz)
  out[outOffset + 1] = xy + wz
  out[outOffset + 2] = xz - wy
  out[outOffset + 3] = 0
  out[outOffset + 4] = xy - wz
  out[outOffset + 5] = 1 - (xx + zz)
  out[outOffset + 6] = yz + wx
  out[outOffset + 7] = 0
  out[outOffset + 8] = xz + wy
  out[outOffset + 9] = yz - wx
  out[outOffset + 10] = 1 - (xx + yy)
  out[outOffset + 11] = 0
  out[outOffset + 12] = tx
  out[outOffset + 13] = ty
  out[outOffset + 14] = tz
  out[outOffset + 15] = 1
}
