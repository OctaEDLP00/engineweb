/**
 * Builds the rejection for an aborted wait: the signal's own reason when
 * set, otherwise a standard `AbortError` DOMException.
 *
 * @param signal Optional signal whose reason to reuse.
 * @returns The error to reject with.
 */
export default function abortError(signal?: AbortSignal): Error {
  return (signal?.reason as Error | undefined) ?? new DOMException('Aborted', 'AbortError')
}
