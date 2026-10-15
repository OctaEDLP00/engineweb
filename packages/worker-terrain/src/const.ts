/** 2D gradient X lanes for the 8 corner gradients. */
export const GRAD_X = [1, -1, 1, -1, 1, -1, 0, 0]
/** 2D gradient Y lanes for the 8 corner gradients. */
export const GRAD_Y = [1, 1, -1, -1, 0, 0, 1, -1]
/**
 * Classic Perlin 3D gradient set: 12 edge vectors, flattened row-major
 * (`[gx0, gy0, gz0, gx1, gy1, gz1, …]`).
 */
export const GRAD_3 = [
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1,
  0, 1, -1, 0, -1, -1,
]
/** Grid resolution (segments per edge) at LOD 0. Each LOD halves it. */
export const BASE_RESOLUTION = 64
/** Maximum world-space height of the generated relief. */
export const HEIGHT_AMPLITUDE = 24
