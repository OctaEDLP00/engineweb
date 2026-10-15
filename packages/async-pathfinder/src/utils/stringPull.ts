import type { Passable, Vec2 } from '../types/index.js'
import hasLineOfSight from './hasLineOfSight.js'

/**
 * Greedy string-pulling over a waypoint list: from each anchor, jump to the
 * furthest visible waypoint, dropping redundant corners while preserving
 * walkability.
 *
 * @param path Raw waypoints (e.g. Theta* output).
 * @param passable Grid predicate for visibility checks.
 * @returns A shortened waypoint list with identical endpoints.
 */
export default function stringPull(path: Array<Vec2>, passable: Passable): Array<Vec2> {
  if (path.length <= 2) return path.slice()
  const out: Array<Vec2> = [path[0]]
  let anchor = 0
  while (anchor < path.length - 1) {
    let furthest = anchor + 1
    for (let i = path.length - 1; i > anchor + 1; i--) {
      if (hasLineOfSight(path[anchor].x, path[anchor].y, path[i].x, path[i].y, passable)) {
        furthest = i
        break
      }
    }
    out.push(path[furthest])
    anchor = furthest
  }
  return out
}
