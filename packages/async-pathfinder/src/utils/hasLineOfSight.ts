import type { Passable } from '../types/index.js'

/**
 * Bresenham line-of-sight between two cells: every cell touched by the
 * segment must be passable. Both endpoints are in-bounds by construction.
 *
 * @param x0 Start column.
 * @param y0 Start row.
 * @param x1 End column.
 * @param y1 End row.
 * @param passable Grid predicate.
 * @returns `true` when the whole segment is walkable.
 */
export default function hasLineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  passable: Passable,
): boolean {
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  for (;;) {
    if (!passable(x, y)) return false
    if (x === x1 && y === y1) return true
    const double = 2 * err
    if (double > -dy) {
      err -= dy
      x += sx
    }
    if (double < dx) {
      err += dx
      y += sy
    }
  }
}
