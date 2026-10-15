import type { Vec2 } from '../types/index.js'

/**
 * Validates a grid point: integer coordinates inside the grid.
 *
 * @param point Candidate `{ x, y }` cell.
 * @param name Human label used in error messages (`'start'`/`'goal'`).
 * @param width Grid width for the bounds check.
 * @param height Grid height for the bounds check.
 * @throws {RangeError} On non-integer coordinates or out-of-bounds points.
 */
export default function assertPoint(
  point: Vec2,
  name: string,
  width: number,
  height: number,
): void {
  if (!point || !Number.isInteger(point.x) || !Number.isInteger(point.y)) {
    throw new RangeError(`${name} position must hold integer x/y cell coordinates`)
  }
  if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
    throw new RangeError(`${name} position is out of bounds`)
  }
}
