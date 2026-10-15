/**
 * Spherical linear interpolation between unit quaternions with hemisphere
 * correction (negates `b` on negative dot) and a normalized-lerp fast path
 * past `dot > 0.9995`. Output is always unit length.
 *
 * @param out Destination quaternion (4 floats).
 * @param ax First quaternion X.
 * @param ay First quaternion Y.
 * @param az First quaternion Z.
 * @param aw First quaternion W.
 * @param bx Second quaternion X.
 * @param by Second quaternion Y.
 * @param bz Second quaternion Z.
 * @param bw Second quaternion W.
 * @param t Blend factor in `[0, 1]`.
 */
export default function slerp(
  out: Float32Array,
  ax: number,
  ay: number,
  az: number,
  aw: number,
  bx: number,
  by: number,
  bz: number,
  bw: number,
  t: number,
): void {
  let dot = ax * bx + ay * by + az * bz + aw * bw
  let qx = bx
  let qy = by
  let qz = bz
  let qw = bw
  if (dot < 0) {
    dot = -dot
    qx = -qx
    qy = -qy
    qz = -qz
    qw = -qw
  }
  if (dot > 0.9995) {
    out[0] = ax + (qx - ax) * t
    out[1] = ay + (qy - ay) * t
    out[2] = az + (qz - az) * t
    out[3] = aw + (qw - aw) * t
  } else {
    const theta = Math.acos(dot)
    const sinTheta = Math.sin(theta)
    const wa = Math.sin((1 - t) * theta) / sinTheta
    const wb = Math.sin(t * theta) / sinTheta
    out[0] = ax * wa + qx * wb
    out[1] = ay * wa + qy * wb
    out[2] = az * wa + qz * wb
    out[3] = aw * wa + qw * wb
  }
  const len = Math.hypot(out[0], out[1], out[2], out[3]) || 1
  out[0] /= len
  out[1] /= len
  out[2] /= len
  out[3] /= len
}
