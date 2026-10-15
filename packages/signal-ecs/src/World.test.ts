import { describe, expect, it, vi } from 'vitest'
import { World } from './World.js'
import type { ComponentType, Entity } from './types/index.js'

interface XY {
  x: number
  y: number
}

function makePosition(capacity: number): { type: ComponentType<XY>; store: Float32Array } {
  const store = new Float32Array(capacity * 2)
  const type: ComponentType<XY> = {
    name: 'position',
    arity: 2,
    read(entity: Entity, out: Float32Array): XY {
      out[0] = store[entity * 2]
      out[1] = store[entity * 2 + 1]
      return { x: out[0], y: out[1] }
    },
    write(entity: Entity, value: XY): void {
      store[entity * 2] = value.x
      store[entity * 2 + 1] = value.y
    },
  }
  return { type, store }
}

describe('World entities', () => {
  it('rejects non-positive capacity', () => {
    expect(() => new World(0)).toThrow(RangeError)
    expect(() => new World(2.5)).toThrow(RangeError)
  })

  it('hands out ids and tracks liveness', () => {
    const world = new World(4)
    const a = world.createEntity()
    const b = world.createEntity()
    expect(a).not.toBe(b)
    expect(world.entityCount).toBe(2)
    expect(world.hasEntity(a)).toBe(true)
    expect(() => world.hasEntity(99)).toThrow(RangeError)
  })

  it('throws when capacity is exhausted', () => {
    const world = new World(1)
    world.createEntity()
    expect(() => world.createEntity()).toThrow('capacity exhausted')
  })

  it('recycles destroyed ids', () => {
    const world = new World(2)
    const a = world.createEntity()
    world.createEntity()
    world.destroyEntity(a)
    expect(world.hasEntity(a)).toBe(false)
    expect(world.createEntity()).toBe(a)
    expect(world.entityCount).toBe(2)
    expect(() => world.destroyEntity(a)).not.toThrow()
    expect(() => world.destroyEntity(a)).toThrow('not alive')
  })
})

describe('World components', () => {
  it('validates component descriptors', () => {
    const world = new World(4)
    const { type } = makePosition(4)
    expect(() => world.registerComponent({ ...type, name: '' })).toThrow(TypeError)
    expect(() => world.registerComponent({ ...type, arity: 0 })).toThrow(TypeError)
    expect(() => world.registerComponent({ ...type, write: undefined } as never)).toThrow(TypeError)
    world.registerComponent(type)
    expect(() => world.registerComponent(type)).toThrow('already registered')
  })

  it('notifies only on real mutations', () => {
    const world = new World(4)
    const { type } = makePosition(4)
    world.registerComponent(type)
    const entity = world.createEntity()
    const listener = vi.fn()
    world.watch(type, listener)
    type.write(entity, { x: 1, y: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(entity, { x: 1, y: 2 })
    type.write(entity, { x: 1, y: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('supports unsubscribe', () => {
    const world = new World(4)
    const { type } = makePosition(4)
    world.registerComponent(type)
    const entity = world.createEntity()
    const listener = vi.fn()
    const unsub = world.watch(type, listener)
    unsub()
    type.write(entity, { x: 5, y: 5 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('rejects watches on unknown components and bad callbacks', () => {
    const world = new World(4)
    const { type } = makePosition(4)
    expect(() => world.watch(type, () => {})).toThrow('not registered')
    expect(() => world.watch({ name: 'x', arity: 1 } as never, () => {})).toThrow()
  })

  it('rejects writes to dead entities', () => {
    const world = new World(4)
    const { type } = makePosition(4)
    world.registerComponent(type)
    const entity = world.createEntity()
    world.destroyEntity(entity)
    expect(() => type.write(entity, { x: 0, y: 0 })).toThrow('not alive')
  })

  it('tracks and clears dirty flags', () => {
    const world = new World(4)
    const { type } = makePosition(4)
    world.registerComponent(type)
    const entity = world.createEntity()
    expect(world.isDirty(type, entity)).toBe(false)
    type.write(entity, { x: 3, y: 4 })
    expect(world.isDirty(type, entity)).toBe(true)
    world.clearDirty(type, entity)
    expect(world.isDirty(type, entity)).toBe(false)
  })
})
