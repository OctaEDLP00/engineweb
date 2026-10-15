import isPlainObject from './isPlainObject.js'

/**
 * Deep-copies a snapshot state so callers can mutate results freely:
 * `structuredClone` when available, shallow array/object copy otherwise,
 * primitives passed through.
 *
 * @param state State to copy.
 * @returns An independent copy of `state`.
 */
export default function cloneState<T>(state: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(state)
    } catch {
      // structuredClone rejects functions/symbols — fall through to shallow copy.
    }
  }
  if (Array.isArray(state)) return state.slice() as unknown as T
  if (isPlainObject(state)) return { ...state } as unknown as T
  return state
}
