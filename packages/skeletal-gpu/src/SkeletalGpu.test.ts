import { describe, expect, it } from 'vitest'
import { SkeletalGpu } from './SkeletalGpu.js'
import type { AnimationTrack, Bone } from './types/index.js'

const BONES: Array<Bone> = [
  { name: 'root', parent: -1 },
  { name: 'child', parent: 0 },
]

function frames(
  quats0: Array<number>,
  trans0: Array<number>,
  quats1: Array<number>,
  trans1: Array<number>,
): Float32Array {
  return new Float32Array([
    ...quats0,
    ...trans0,
    ...quats0,
    ...trans0,
    ...quats1,
    ...trans1,
    ...quats1,
    ...trans1,
  ])
}

function track(name: string, data: Float32Array): AnimationTrack {
  return { name, durationSeconds: 1, keyframes: data }
}

const IDLE = track('idle', frames([0, 0, 0, 1], [0, 0, 0], [0, 0, 0, 1], [0, 2, 0]))
const WAVE = track('wave', frames([0, 0, 0, 1], [5, 0, 0], [0, 0, 0, 1], [5, 2, 0]))

describe('SkeletalGpu construction', () => {
  it('validates the backend and pool size', () => {
    expect(() => new SkeletalGpu({ backend: 'webgpu', maxInstances: 4 })).not.toThrow()
    expect(() => new SkeletalGpu({ backend: 'directx' } as never)).toThrow(TypeError)
    expect(() => new SkeletalGpu({ backend: 'webgl2', maxInstances: 0 })).toThrow(RangeError)
  })
})

describe('SkeletalGpu skeletons', () => {
  it('registers skeletons and hands out ids', () => {
    const anim = new SkeletalGpu({ backend: 'webgpu', maxInstances: 2 })
    expect(anim.registerSkeleton(BONES, [IDLE])).toBe(0)
    expect(anim.registerSkeleton(BONES, [WAVE])).toBe(1)
  })

  it('validates bones and tracks', () => {
    const anim = new SkeletalGpu({ backend: 'webgl2', maxInstances: 2 })
    expect(() => anim.registerSkeleton([], [IDLE])).toThrow(TypeError)
    expect(() => anim.registerSkeleton([{ name: '', parent: -1 }], [IDLE])).toThrow(TypeError)
    expect(() => anim.registerSkeleton([{ name: 'a', parent: 0 }], [IDLE])).toThrow(RangeError)
    expect(() => anim.registerSkeleton(BONES, [])).toThrow(TypeError)
    expect(() => anim.registerSkeleton(BONES, [IDLE, IDLE])).toThrow('duplicate track')
    expect(() => anim.registerSkeleton(BONES, [{ ...IDLE, durationSeconds: 0 }])).toThrow(
      RangeError,
    )
    expect(() =>
      anim.registerSkeleton(BONES, [{ ...IDLE, keyframes: new Float32Array(3) }]),
    ).toThrow(RangeError)
  })
})

describe('SkeletalGpu instances', () => {
  function rigged(): { anim: SkeletalGpu; instance: number } {
    const anim = new SkeletalGpu({ backend: 'webgpu', maxInstances: 2 })
    const skeleton = anim.registerSkeleton(BONES, [IDLE, WAVE])
    return { anim, instance: anim.createInstance(skeleton) }
  }

  it('allocates, exhausts and recycles slots', () => {
    const anim = new SkeletalGpu({ backend: 'webgpu', maxInstances: 1 })
    const skeleton = anim.registerSkeleton(BONES, [IDLE])
    const first = anim.createInstance(skeleton)
    expect(() => anim.createInstance(skeleton)).toThrow('exhausted')
    anim.destroyInstance(first)
    expect(anim.createInstance(skeleton)).toBe(first)
    expect(() => anim.registerSkeleton(BONES, [IDLE]) && anim.createInstance(99)).toThrow(
      RangeError,
    )
  })

  it('validates blend weights and tracks', () => {
    const { anim, instance } = rigged()
    expect(() => anim.setBlend(instance, 'nope', 1)).toThrow('unknown track')
    expect(() => anim.setBlend(instance, 'idle', 2)).toThrow(RangeError)
    expect(() => anim.setBlend(instance, 'idle', Number.NaN)).toThrow(RangeError)
    expect(() => anim.setBlend(99, 'idle', 1)).toThrow()
    expect(() => anim.getInstanceMatrices(99)).toThrow()
  })

  it('samples and blends translations over time', () => {
    const { anim, instance } = rigged()
    anim.setBlend(instance, 'idle', 1)
    anim.update(0.25)
    const mid = anim.getInstanceMatrices(instance)
    expect(mid.length).toBe(32)
    expect(mid[12]).toBeCloseTo(0, 5)
    expect(mid[13]).toBeCloseTo(1, 5)
    anim.setBlend(instance, 'idle', 0)
    anim.setBlend(instance, 'wave', 1)
    anim.update(0.25)
    expect(anim.getInstanceMatrices(instance)[12]).toBeCloseTo(5, 5)
  })

  it('ignores zero deltas and rejects negative ones', () => {
    const { anim, instance } = rigged()
    anim.setBlend(instance, 'idle', 1)
    anim.update(0.25)
    const before = Array.from(anim.getInstanceMatrices(instance))
    anim.update(0)
    expect(Array.from(anim.getInstanceMatrices(instance))).toEqual(before)
    expect(() => anim.update(-1)).toThrow(RangeError)
  })
})
