import cloneState from './cloneState.js'
import isPlainObject from './isPlainObject.js'

/**
 * Dead-reckoning extrapolation past the newest snapshot: per-field velocity
 * `(newer - older) / dt` projected to `renderTime`. Non-numeric shapes clone
 * `newer`, as do non-positive spans.
 *
 * @param older Previous state.
 * @param olderTime Its timestamp.
 * @param newer Latest state.
 * @param newerTime Its timestamp.
 * @param renderTime Time to project to (usually beyond `newerTime`).
 * @returns A fresh extrapolated state.
 */
export default function extrapolateStates<T>(
  older: T,
  olderTime: number,
  newer: T,
  newerTime: number,
  renderTime: number,
): T {
  const dt = newerTime - olderTime
  if (!(dt > 0)) return cloneState(newer)
  const rate = (renderTime - newerTime) / dt
  if (typeof older === 'number' && typeof newer === 'number') {
    return (newer + (newer - older) * rate) as unknown as T
  }
  if (Array.isArray(older) && Array.isArray(newer) && older.length === newer.length) {
    const out = new Array<unknown>(newer.length)
    for (let i = 0; i < newer.length; i++) {
      const av = older[i] as unknown
      const bv = newer[i] as unknown
      out[i] = typeof av === 'number' && typeof bv === 'number' ? bv + (bv - av) * rate : bv
    }
    return out as unknown as T
  }
  if (isPlainObject(older) && isPlainObject(newer)) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(newer)) {
      const av = (older as Record<string, unknown>)[key]
      const bv = (newer as Record<string, unknown>)[key]
      out[key] = typeof av === 'number' && typeof bv === 'number' ? bv + (bv - av) * rate : bv
    }
    return out as unknown as T
  }
  return cloneState(newer)
}
