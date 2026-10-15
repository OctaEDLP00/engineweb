import { describe, expect, it } from 'vitest'
import { NetInterpolator } from './NetInterpolator.js'

interface Point {
  x: number
  y: number
}

function twoSnapshots(): NetInterpolator<Point> {
  const interp = new NetInterpolator<Point>({ delayMs: 100 })
  interp.push({ state: { x: 0, y: 0 }, timestamp: 0 })
  interp.push({ state: { x: 10, y: 20 }, timestamp: 200 })
  return interp
}

describe('NetInterpolator construction', () => {
  it('rejects bad options', () => {
    expect(() => new NetInterpolator({ delayMs: -1 })).toThrow(RangeError)
    expect(() => new NetInterpolator({ delayMs: 10, bufferSize: 0 })).toThrow(RangeError)
    expect(() => new NetInterpolator({} as never)).toThrow(TypeError)
  })

  it('starts empty', () => {
    expect(new NetInterpolator({ delayMs: 0 }).size).toBe(0)
  })
})

describe('NetInterpolator sampling', () => {
  it('interpolates linearly between snapshots', () => {
    expect(twoSnapshots().sample(200)).toEqual({ x: 5, y: 10 })
  })

  it('holds the oldest snapshot before the buffer', () => {
    expect(twoSnapshots().sample(50)).toEqual({ x: 0, y: 0 })
  })

  it('extrapolates past the newest snapshot', () => {
    expect(twoSnapshots().sample(400)).toEqual({ x: 15, y: 30 })
  })

  it('interpolates plain numbers', () => {
    const interp = new NetInterpolator<number>({ delayMs: 0 })
    interp.push({ state: 0, timestamp: 0 })
    interp.push({ state: 100, timestamp: 100 })
    expect(interp.sample(25)).toBe(25)
  })

  it('throws when empty or time-travelling', () => {
    expect(() => new NetInterpolator({ delayMs: 0 }).sample(0)).toThrow('no snapshots')
    expect(() => twoSnapshots().sample(-5)).toThrow(RangeError)
  })

  it('returns copies, not buffer internals', () => {
    const interp = twoSnapshots()
    const first = interp.sample(200)
    first.x = 999
    expect(interp.sample(200).x).toBe(5)
  })
})

describe('NetInterpolator buffer', () => {
  it('keeps out-of-order pushes sorted', () => {
    const interp = twoSnapshots()
    interp.push({ state: { x: 20, y: 40 }, timestamp: 100 })
    expect(interp.size).toBe(3)
    expect(interp.sample(200)).toEqual({ x: 20, y: 40 })
    expect(interp.sample(250)).toEqual({ x: 15, y: 30 })
  })

  it('replaces duplicate timestamps', () => {
    const interp = twoSnapshots()
    interp.push({ state: { x: 99, y: 99 }, timestamp: 200 })
    expect(interp.size).toBe(2)
    expect(interp.sample(300)).toEqual({ x: 99, y: 99 })
  })

  it('evicts the oldest snapshot past bufferSize', () => {
    const interp = new NetInterpolator<Point>({ delayMs: 0, bufferSize: 2 })
    interp.push({ state: { x: 0, y: 0 }, timestamp: 0 })
    interp.push({ state: { x: 10, y: 10 }, timestamp: 10 })
    interp.push({ state: { x: 20, y: 20 }, timestamp: 20 })
    expect(interp.size).toBe(2)
    expect(interp.sample(0)).toEqual({ x: 10, y: 10 })
  })

  it('clears the buffer', () => {
    const interp = twoSnapshots()
    interp.clear()
    expect(interp.size).toBe(0)
    expect(() => interp.sample(0)).toThrow()
  })

  it('rejects bad snapshots', () => {
    const interp = new NetInterpolator({ delayMs: 0 })
    expect(() => interp.push({ state: 1, timestamp: -1 })).toThrow(RangeError)
    expect(() => interp.push({ state: undefined, timestamp: 0 } as never)).toThrow(TypeError)
  })
})
