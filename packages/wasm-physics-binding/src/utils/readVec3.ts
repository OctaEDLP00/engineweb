import type { Tuple, Vec3Like } from '../types/index.js'

/**
 * Reads a validated `[x, y, z]` triple from a tuple or record. Arrays must
 * hold exactly 3 finite numbers — anything else is a caller bug, not a
 * default.
 *
 * @param value Candidate triple.
 * @param name Human label used in error messages (`'position'`/`'velocity'`).
 * @returns The validated components.
 * @throws {TypeError} On wrong shapes, lengths or non-numeric components.
 * @throws {RangeError} On non-finite components.
 */
export default function readVec3(value: Vec3Like, name: string): Tuple<number, 3> {
  let x: unknown
  let y: unknown
  let z: unknown
  if (Array.isArray(value)) {
    if (value.length !== 3) {
      throw new TypeError(`WasmPhysicsBinding: ${name} must be a [x, y, z] tuple or { x, y, z }`)
    }
    ;[x, y, z] = value
  } else if (value && typeof value === 'object') ({ x, y, z } = value as Record<string, unknown>)
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
    throw new TypeError(`WasmPhysicsBinding: ${name} must be a [x, y, z] tuple or { x, y, z }`)
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new RangeError(`WasmPhysicsBinding: ${name} components must be finite numbers`)
  }
  return [x, y, z]
}
