import cloneState from './cloneState.js'
import isPlainObject from './isPlainObject.js'
import lerpNumber from './lerpNumber.js'

/**
 * Linearly interpolates two states: numbers directly, arrays element-wise
 * (numeric pairs only, equal lengths required), plain objects per numeric
 * field with other fields taken from `b`. Anything else clones `b`.
 *
 * @param a Earlier state.
 * @param b Later state.
 * @param t Blend factor in `[0, 1]`.
 * @returns A fresh interpolated state (never an input reference).
 */
export default function lerpStates<T>(a: T, b: T, t: number): T {
  if (typeof a === 'number' && typeof b === 'number') return lerpNumber(a, b, t) as unknown as T
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    const out = new Array<unknown>(a.length)
    for (let i = 0; i < a.length; i++) {
      const av = a[i] as unknown
      const bv = b[i] as unknown
      out[i] = typeof av === 'number' && typeof bv === 'number' ? lerpNumber(av, bv, t) : bv
    }
    return out as unknown as T
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(b)) {
      const av = (a as Record<string, unknown>)[key]
      const bv = (b as Record<string, unknown>)[key]
      out[key] = typeof av === 'number' && typeof bv === 'number' ? lerpNumber(av, bv, t) : bv
    }
    return out as unknown as T
  }
  return cloneState(b)
}
