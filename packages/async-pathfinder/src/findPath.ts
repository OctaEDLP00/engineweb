import type { PathRequest, PathfinderOptions, Vec2 } from './types/index.js'
import { DIRS_X, DIRS_Y, DIR_COST, SQRT2 } from './const.js'
import assertPoint from './utils/assertPoint.js'
import hasLineOfSight from './utils/hasLineOfSight.js'
import stringPull from './utils/stringPull.js'
import chaikinSmooth from './utils/chaikinSmooth.js'

/**
 * Runs an incremental A* search, yielding after every slice of work and
 * returning the final waypoint list. Drive it from the game loop so heavy
 * recalculations never block a frame; diagonal moves cost `√2` and never cut
 * corners.
 *
 * @param request Grid, endpoints and `passable` predicate; see {@link PathRequest}.
 * @param options Slicing, weighting and smoothing; see {@link PathfinderOptions}.
 * @yields Running node-expansion count after each `maxExpansionsPerSlice` slice.
 * @returns Waypoint list from `start` to `goal`, or `[]` when unreachable.
 * @throws {TypeError} When `passable` is not a function.
 * @throws {RangeError} On bad dimensions, out-of-bounds or impassable
 * endpoints, or invalid options.
 *
 * @example
 * ```typescript
 * const search = findPath({ start, goal, width, height, passable }, { thetaStar: true })
 * for (;;) {
 *   const step = await search.next()
 *   if (step.done) {
 *     npc.waypoints = step.value
 *     break
 *   }
 *   await nextFrame()
 * }
 * ```
 */
export async function* findPath(
  request: PathRequest,
  options: PathfinderOptions = {},
): AsyncGenerator<number, Array<Vec2>> {
  if (!request || typeof request.passable !== 'function') {
    throw new TypeError('findPath expects a request with a passable(x, y) function')
  }
  const { start, goal, width, height, passable } = request
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError('width and height must be positive integers')
  }
  assertPoint(start, 'start', width, height)
  assertPoint(goal, 'goal', width, height)
  if (!passable(start.x, start.y)) {
    throw new RangeError('start position is not passable')
  }
  if (!passable(goal.x, goal.y)) {
    throw new RangeError('goal position is not passable')
  }
  const maxExpansionsPerSlice = options.maxExpansionsPerSlice ?? 512
  if (!Number.isInteger(maxExpansionsPerSlice) || maxExpansionsPerSlice <= 0) {
    throw new RangeError('maxExpansionsPerSlice must be a positive integer')
  }
  const heuristicWeight = options.heuristicWeight ?? 1
  if (!Number.isFinite(heuristicWeight) || heuristicWeight <= 0) {
    throw new RangeError('heuristicWeight must be a positive number')
  }
  const thetaStar = options.thetaStar ?? false
  const smoothPath = options.smoothPath ?? false

  const startIdx = start.y * width + start.x
  const goalIdx = goal.y * width + goal.x
  if (startIdx === goalIdx) return [{ x: start.x, y: start.y }]

  const size = width * height
  const gScore = new Float64Array(size).fill(Infinity)
  const cameFrom = new Int32Array(size).fill(-1)
  const closed = new Uint8Array(size)
  const heap = new Int32Array(size)
  const heapPos = new Int32Array(size).fill(-1)
  let heapSize = 0

  const priority = (node: number): number =>
    gScore[node] + heuristicWeight * octile(node % width, (node / width) | 0)

  function octile(x: number, y: number): number {
    const dx = Math.abs(x - goal.x)
    const dy = Math.abs(y - goal.y)
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy)
  }

  function siftUp(i: number): void {
    const node = heap[i]
    const score = priority(node)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (priority(heap[parent]) <= score) break
      heap[i] = heap[parent]
      heapPos[heap[i]] = i
      i = parent
    }
    heap[i] = node
    heapPos[node] = i
  }

  function siftDown(i: number): void {
    const node = heap[i]
    for (;;) {
      const left = i * 2 + 1
      const right = left + 1
      let smallest = i
      if (left < heapSize && priority(heap[left]) < priority(heap[smallest])) smallest = left
      if (right < heapSize && priority(heap[right]) < priority(heap[smallest])) smallest = right
      if (smallest === i) break
      heap[i] = heap[smallest]
      heapPos[heap[i]] = i
      i = smallest
    }
    heap[i] = node
    heapPos[node] = i
  }

  function push(node: number): void {
    heap[heapSize] = node
    heapPos[node] = heapSize
    heapSize++
    siftUp(heapSize - 1)
  }

  function pop(): number {
    const top = heap[0]
    heapSize--
    if (heapSize > 0) {
      heap[0] = heap[heapSize]
      heapPos[heap[0]] = 0
      siftDown(0)
    }
    heapPos[top] = -1
    return top
  }

  gScore[startIdx] = 0
  push(startIdx)

  let expansions = 0
  let found = false
  while (heapSize > 0) {
    const current = pop()
    if (closed[current] === 1) continue
    closed[current] = 1
    if (current === goalIdx) {
      found = true
      break
    }
    const cx = current % width
    const cy = (current / width) | 0
    for (let d = 0; d < 8; d++) {
      const nx = cx + DIRS_X[d]
      const ny = cy + DIRS_Y[d]
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (!passable(nx, ny)) continue
      if (d >= 4 && (!passable(cx + DIRS_X[d], cy) || !passable(cx, cy + DIRS_Y[d]))) continue
      const neighbor = ny * width + nx
      if (closed[neighbor] === 1) continue
      let tentative: number
      let from: number
      if (thetaStar) {
        const parent = cameFrom[current]
        if (parent !== -1) {
          const px = parent % width
          const py = (parent / width) | 0
          if (hasLineOfSight(px, py, nx, ny, passable)) {
            tentative = gScore[parent] + Math.hypot(nx - px, ny - py)
            from = parent
          } else {
            tentative = gScore[current] + DIR_COST[d]
            from = current
          }
        } else {
          tentative = gScore[current] + DIR_COST[d]
          from = current
        }
      } else {
        tentative = gScore[current] + DIR_COST[d]
        from = current
      }
      if (tentative < gScore[neighbor]) {
        cameFrom[neighbor] = from
        gScore[neighbor] = tentative
        if (heapPos[neighbor] === -1) push(neighbor)
        else siftUp(heapPos[neighbor])
      }
    }
    expansions++
    if (expansions % maxExpansionsPerSlice === 0) {
      await new Promise<void>(resolve => {
        setTimeout(resolve, 0)
      })
      yield expansions
    }
  }

  if (!found) return []

  const reversed: Array<Vec2> = []
  let cursor = goalIdx
  for (;;) {
    reversed.push({ x: cursor % width, y: (cursor / width) | 0 })
    if (cursor === startIdx) break
    cursor = cameFrom[cursor]
  }
  reversed.reverse()

  const pulled = thetaStar ? stringPull(reversed, passable) : reversed
  return smoothPath ? chaikinSmooth(pulled) : pulled
}
