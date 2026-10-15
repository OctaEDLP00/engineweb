/** Per-bone keyframe floats: quaternion (4) + translation (3). */
export const KEYFRAME_STRIDE = 7
/** Quaternion lane count. */
export const QUAT_SIZE = 4
/** Module scratch for sampled/blended quaternions (single-threaded reuse). */
export const scratchQ = new Float32Array(QUAT_SIZE)
/** Module scratch for the hemisphere-flipped blend target. */
export const scratchQ2 = new Float32Array(QUAT_SIZE)
/** Module scratch for sampled translations. */
export const scratchT = new Float32Array(3)
/** Module scratch for one local bone matrix before hierarchy composition. */
export const scratchLocal = new Float32Array(16)
