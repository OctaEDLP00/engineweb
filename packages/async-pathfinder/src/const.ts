/** Square root of two: cost of a diagonal step. */
export const SQRT2 = Math.SQRT2
/** X offsets of the 8 neighbors (4 orthogonal, then 4 diagonal). */
export const DIRS_X = [1, -1, 0, 0, 1, 1, -1, -1]
/** Y offsets of the 8 neighbors (4 orthogonal, then 4 diagonal). */
export const DIRS_Y = [0, 0, 1, -1, 1, -1, 1, -1]
/** Step costs parallel to the direction tables: `1` orthogonal, `√2` diagonal. */
export const DIR_COST = [1, 1, 1, 1, SQRT2, SQRT2, SQRT2, SQRT2]
