/**
 * Narrowing guard for plain data objects (literal or `null`-prototype),
 * excluding arrays, class instances and `null`.
 *
 * @param value Candidate value.
 * @returns `true` when `value` is a plain object.
 */
export default function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
