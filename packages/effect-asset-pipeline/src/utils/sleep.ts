/**
 * Timer promise that rejects early when the signal aborts. Already-aborted
 * signals reject immediately without arming a timer.
 *
 * @param ms Milliseconds to wait.
 * @param signal Optional signal cancelling the wait.
 * @returns Promise resolving after `ms` or rejecting on abort.
 */
export default function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
