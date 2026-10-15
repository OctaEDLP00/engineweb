import type { ComponentType } from '../types/index.js'

/**
 * Validates a component descriptor: object shape, non-empty name, positive
 * integer arity, and function `read`/`write`.
 *
 * @param type Candidate descriptor.
 * @throws {TypeError} On any malformed field.
 */
export default function assertComponentShape(type: ComponentType<unknown>): void {
  if (!type || typeof type !== 'object') {
    throw new TypeError('World: component type must be an object')
  }
  if (typeof type.name !== 'string' || type.name.length === 0) {
    throw new TypeError('World: component name must be a non-empty string')
  }
  if (!Number.isInteger(type.arity) || type.arity <= 0) {
    throw new TypeError('World: component arity must be a positive integer')
  }
  if (typeof type.read !== 'function' || typeof type.write !== 'function') {
    throw new TypeError(
      'World: component must implement read(entity, out) and write(entity, value)',
    )
  }
}
