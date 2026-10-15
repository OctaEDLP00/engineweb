import { describe, expect, it } from 'vitest'
import { TypedSpatialHash } from './TypedSpatialHash.js'

function makeGrid(): TypedSpatialHash {
  return new TypedSpatialHash({ cellSize: 10, capacity: 64 })
}

describe('TypedSpatialHash construction', () => {
  it('rejects non-positive cellSize and capacity', () => {
    expect(() => new TypedSpatialHash({ cellSize: 0, capacity: 8 })).toThrow(RangeError)
    expect(() => new TypedSpatialHash({ cellSize: 10, capacity: 0 })).toThrow(RangeError)
    expect(() => new TypedSpatialHash({ cellSize: 10, capacity: 1.5 })).toThrow(RangeError)
  })

  it('rejects non-numeric options', () => {
    expect(() => new TypedSpatialHash({ cellSize: 'x', capacity: 8 } as never)).toThrow(TypeError)
  })

  it('starts empty', () => {
    expect(makeGrid().size).toBe(0)
  })
})

describe('TypedSpatialHash insert / remove', () => {
  it('stores and finds entities by radius', () => {
    const grid = makeGrid()
    grid.insert(0, 5, 5)
    grid.insert(1, 25, 5)
    const near = grid.queryRadius(5, 5, 10)
    expect(near.count).toBe(1)
    expect(near.ids[0]).toBe(0)
  })

  it('updates an entity position in place', () => {
    const grid = makeGrid()
    grid.insert(0, 5, 5)
    grid.insert(0, 500, 500)
    expect(grid.size).toBe(1)
    expect(grid.queryRadius(5, 5, 10).count).toBe(0)
    expect(grid.queryRadius(500, 500, 10).count).toBe(1)
  })

  it('removes entities and reports liveness', () => {
    const grid = makeGrid()
    grid.insert(3, 1, 1)
    expect(grid.has(3)).toBe(true)
    grid.remove(3)
    expect(grid.has(3)).toBe(false)
    expect(grid.size).toBe(0)
    expect(grid.queryRadius(1, 1, 100).count).toBe(0)
    expect(() => grid.remove(3)).not.toThrow()
  })

  it('clears everything', () => {
    const grid = makeGrid()
    grid.insert(0, 1, 1)
    grid.insert(1, 2, 2)
    grid.clear()
    expect(grid.size).toBe(0)
    expect(grid.has(0)).toBe(false)
  })

  it('rejects bad ids and positions', () => {
    const grid = makeGrid()
    expect(() => grid.insert(-1, 0, 0)).toThrow(RangeError)
    expect(() => grid.insert(64, 0, 0)).toThrow(RangeError)
    expect(() => grid.insert(0, Number.NaN, 0)).toThrow(RangeError)
    expect(() => grid.insert(0, 0, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

describe('TypedSpatialHash queries', () => {
  it('finds a radius-0 exact hit', () => {
    const grid = makeGrid()
    grid.insert(7, 30, 40)
    const hit = grid.queryRadius(30, 40, 0)
    expect(hit.count).toBe(1)
    expect(hit.ids[0]).toBe(7)
  })

  it('rejects negative radius', () => {
    expect(() => makeGrid().queryRadius(0, 0, -1)).toThrow(RangeError)
  })

  it('returns nearest-first kNN results', () => {
    const grid = makeGrid()
    grid.insert(0, 30, 0)
    grid.insert(1, 10, 0)
    grid.insert(2, 20, 0)
    const nearest = grid.queryKNearest(0, 0, 3)
    expect(nearest.count).toBe(3)
    expect(Array.from(nearest.ids.slice(0, 3))).toEqual([1, 2, 0])
  })

  it('clamps k to the stored count', () => {
    const grid = makeGrid()
    grid.insert(0, 1, 1)
    expect(grid.queryKNearest(0, 0, 99).count).toBe(1)
    expect(grid.queryKNearest(50, 50, 5).count).toBe(1)
  })

  it('returns empty results when nothing is stored', () => {
    expect(makeGrid().queryKNearest(0, 0, 3).count).toBe(0)
  })

  it('rejects non-positive k', () => {
    expect(() => makeGrid().queryKNearest(0, 0, 0)).toThrow(RangeError)
  })

  it('reuses the result buffer across queries', () => {
    const grid = makeGrid()
    grid.insert(0, 1, 1)
    expect(grid.queryRadius(0, 0, 50)).toBe(grid.queryKNearest(0, 0, 5))
  })

  it('never double-counts entities across hashed cells', () => {
    const grid = new TypedSpatialHash({ cellSize: 4, capacity: 16 })
    for (let id = 0; id < 8; id++) grid.insert(id, id, id)
    const found = grid.queryRadius(3.5, 3.5, 100)
    expect(found.count).toBe(8)
    expect(new Set(Array.from(found.ids.slice(0, found.count))).size).toBe(8)
  })
})
