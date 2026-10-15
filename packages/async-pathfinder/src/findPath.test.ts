import { describe, expect, it } from 'vitest'
import { findPath } from './findPath.js'
import type { PathRequest, Vec2 } from './types/index.js'

function openGrid(
  width: number,
  height: number,
  walls: ReadonlySet<string> = new Set(),
): PathRequest['passable'] {
  return (x, y) => x >= 0 && y >= 0 && x < width && y < height && !walls.has(`${x},${y}`)
}

async function collect(
  request: PathRequest,
  options?: Parameters<typeof findPath>[1],
): Promise<{ yields: Array<number>; result: Array<Vec2> }> {
  const yields: Array<number> = []
  const gen = findPath(request, options)
  for (;;) {
    const step = await gen.next()
    if (step.done) return { yields, result: step.value ?? [] }
    yields.push(step.value)
  }
}

function request(overrides: Partial<PathRequest> = {}): PathRequest {
  return {
    start: { x: 0, y: 0 },
    goal: { x: 2, y: 0 },
    width: 3,
    height: 1,
    passable: openGrid(3, 1),
    ...overrides,
  }
}

describe('findPath basics', () => {
  it('walks a straight open line', async () => {
    const { result, yields } = await collect(request())
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
    expect(yields.length).toBeGreaterThanOrEqual(0)
  })

  it('returns a single waypoint when start equals goal', async () => {
    const { result } = await collect(request({ goal: { x: 0, y: 0 } }))
    expect(result).toEqual([{ x: 0, y: 0 }])
  })

  it('routes around a wall through the gap', async () => {
    const walls = new Set(['2,0', '2,1', '2,2', '2,3'])
    const passable = openGrid(5, 5, walls)
    const { result } = await collect(
      { start: { x: 0, y: 0 }, goal: { x: 4, y: 4 }, width: 5, height: 5, passable },
      { thetaStar: true },
    )
    expect(result.length).toBeGreaterThan(0)
    expect(result[result.length - 1]).toEqual({ x: 4, y: 4 })
    for (const cell of result) expect(walls.has(`${cell.x},${cell.y}`)).toBe(false)
  })

  it('returns an empty path when the goal is unreachable', async () => {
    const walls = new Set(['0,1', '1,1', '2,1'])
    const { result } = await collect({
      start: { x: 0, y: 0 },
      goal: { x: 0, y: 2 },
      width: 3,
      height: 3,
      passable: openGrid(3, 3, walls),
    })
    expect(result).toEqual([])
  })

  it('applies corner smoothing without breaking endpoints', async () => {
    const walls = new Set(['2,0', '2,1', '2,2', '2,3'])
    const passable = openGrid(5, 5, walls)
    const base = { start: { x: 0, y: 0 }, goal: { x: 4, y: 4 }, width: 5, height: 5, passable }
    const { result } = await collect(base, { smoothPath: true })
    expect(result[0]).toEqual({ x: 0, y: 0 })
    expect(result[result.length - 1]).toEqual({ x: 4, y: 4 })
  })
})

describe('findPath slicing', () => {
  it('yields progress on small slices', async () => {
    const { yields, result } = await collect(
      request({ goal: { x: 9, y: 9 }, width: 10, height: 10, passable: openGrid(10, 10) }),
      {
        maxExpansionsPerSlice: 2,
      },
    )
    expect(yields.length).toBeGreaterThan(0)
    expect(yields[0]).toBeLessThanOrEqual(yields[yields.length - 1])
    expect(result[result.length - 1]).toEqual({ x: 9, y: 9 })
  })
})

describe('findPath validation', () => {
  it('rejects bad requests', async () => {
    await expect(collect(request({ width: 0 }))).rejects.toThrow(RangeError)
    await expect(collect(request({ start: { x: 9, y: 9 } }))).rejects.toThrow(RangeError)
    await expect(collect(request({ goal: { x: 9, y: 9 } }))).rejects.toThrow(RangeError)
    await expect(collect(request({ passable: () => false }))).rejects.toThrow(
      'start position is not passable',
    )
    await expect(collect(request({ passable: x => x === 0 }))).rejects.toThrow(
      'goal position is not passable',
    )
  })

  it('rejects bad options', async () => {
    await expect(collect(request(), { maxExpansionsPerSlice: 0 })).rejects.toThrow(RangeError)
    await expect(collect(request(), { heuristicWeight: -1 })).rejects.toThrow(RangeError)
    await expect(collect(request({ passable: 42 as never }))).rejects.toThrow(TypeError)
  })
})
