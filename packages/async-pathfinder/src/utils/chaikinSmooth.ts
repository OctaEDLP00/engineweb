import type { Vec2 } from '../types/index.js'

/**
 * One Chaikin corner-cutting iteration (endpoint-preserving): every segment
 * contributes a 75/25 and a 25/75 point, rounding grid staircases.
 *
 * @param path Waypoints to smooth; shorter than 3 points returns a copy.
 * @returns A new waypoint list with roughly twice the points.
 */
export default function chaikinSmooth(path: Array<Vec2>): Array<Vec2> {
  if (path.length <= 2) return path.slice()
  const out: Array<Vec2> = [path[0]]
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
    out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
  }
  out.push(path[path.length - 1])
  return out
}
