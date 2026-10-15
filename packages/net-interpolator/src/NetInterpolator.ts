import type { InterpolatorOptions, Snapshot } from './types/index.js'
import cloneState from './utils/cloneState.js'
import extrapolateStates from './utils/extrapolateStates.js'
import lerpStates from './utils/lerpState.js'

/**
 * Sorted jitter buffer with linear interpolation and velocity
 * extrapolation for real-time multiplayer snapshots.
 *
 * Push validated `{ state, timestamp }` packets as they arrive; {@link sample}
 * renders the state at `now - delayMs`, interpolating inside the buffer,
 * holding the oldest snapshot before it and extrapolating past the newest.
 *
 * @typeParam T Snapshot payload: number, numeric array, or plain object
 * with numeric fields.
 *
 * @example
 * ```typescript
 * const interp = new NetInterpolator<{ x: number; y: number }>({ delayMs: 100 })
 * socket.onmessage = (packet) => interp.push({ state: packet, timestamp: packet.serverTime })
 * renderer.draw(interp.sample(performance.now()))
 * ```
 */
export class NetInterpolator<T> {
  readonly delayMs: number
  readonly bufferSize: number

  private readonly buffer: Array<Snapshot<T>> = []

  /**
   * Creates an interpolator over an empty jitter buffer.
   *
   * @param options Render delay and buffer budget; see {@link InterpolatorOptions}.
   * @throws {TypeError} When `delayMs` is not a number.
   * @throws {RangeError} On negative/non-finite `delayMs` or non-positive
   * integer `bufferSize`.
   */
  constructor(options: InterpolatorOptions) {
    if (!options || typeof options.delayMs !== 'number') {
      throw new TypeError('NetInterpolator expects { delayMs } in milliseconds')
    }
    if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
      throw new RangeError('delayMs must be >= 0')
    }
    const bufferSize = options.bufferSize ?? 32
    if (!Number.isInteger(bufferSize) || bufferSize <= 0) {
      throw new RangeError('bufferSize must be a positive integer')
    }
    this.delayMs = options.delayMs
    this.bufferSize = bufferSize
  }

  /** Number of snapshots currently held in the jitter buffer. */
  get size(): number {
    return this.buffer.length
  }

  /** Drops every buffered snapshot. */
  clear(): void {
    this.buffer.length = 0
  }

  /**
   * Pushes a received snapshot, keeping timestamp order: out-of-order
   * packets insert at the right slot, duplicate timestamps replace the
   * stored state, and the oldest entry is evicted past `bufferSize`.
   *
   * @param snapshot Packet with a defined state and finite `timestamp >= 0`.
   * @throws {TypeError} On non-object snapshots or `undefined` state.
   * @throws {RangeError} On negative or non-finite timestamps.
   */
  push(snapshot: Snapshot<T>): void {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new TypeError('push expects a { state, timestamp } snapshot')
    }
    if (!Number.isFinite(snapshot.timestamp) || snapshot.timestamp < 0) {
      throw new RangeError('snapshot timestamp must be >= 0')
    }
    if (snapshot.state === undefined) {
      throw new TypeError('snapshot state must not be undefined')
    }
    const buffer = this.buffer
    let index = buffer.length
    while (index > 0 && buffer[index - 1].timestamp >= snapshot.timestamp) index--
    if (index < buffer.length && buffer[index].timestamp === snapshot.timestamp) {
      buffer[index] = { state: snapshot.state, timestamp: snapshot.timestamp }
      return
    }
    buffer.splice(index, 0, { state: snapshot.state, timestamp: snapshot.timestamp })
    while (buffer.length > this.bufferSize) buffer.shift()
  }

  /**
   * Samples the state at `now - delayMs`: binary-searches the bracketing
   * snapshots and lerps between them, holds the oldest snapshot before the
   * buffer, and velocity-extrapolates past the newest one.
   *
   * @param now Local time in milliseconds, `>= 0`.
   * @returns A fresh state copy, safe to mutate.
   * @throws {RangeError} On negative or non-finite `now`.
   * @throws {Error} When no snapshot has been pushed yet.
   */
  sample(now: number): T {
    if (!Number.isFinite(now) || now < 0) {
      throw new RangeError('now must be >= 0')
    }
    const buffer = this.buffer
    if (buffer.length === 0) {
      throw new Error('NetInterpolator: no snapshots pushed yet')
    }
    const renderTime = now - this.delayMs
    const last = buffer.length - 1
    if (renderTime <= buffer[0].timestamp) return cloneState(buffer[0].state)
    if (renderTime >= buffer[last].timestamp) {
      if (last === 0) return cloneState(buffer[0].state)
      const prev = buffer[last - 1]
      const newest = buffer[last]
      return extrapolateStates(
        prev.state,
        prev.timestamp,
        newest.state,
        newest.timestamp,
        renderTime,
      )
    }
    let lo = 0
    let hi = last
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1
      if (buffer[mid].timestamp <= renderTime) lo = mid
      else hi = mid
    }
    const a = buffer[lo]
    const b = buffer[hi]
    const span = b.timestamp - a.timestamp
    if (!(span > 0)) return cloneState(b.state)
    return lerpStates(a.state, b.state, (renderTime - a.timestamp) / span)
  }
}
