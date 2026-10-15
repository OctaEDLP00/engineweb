/**
 * In-place quickselect over parallel id/distance arrays: after the call, the
 * first `k + 1` slots hold the smallest distances (unordered). Runs without
 * allocating.
 *
 * @param ids Entity ids parallel to `dist`; permuted in place.
 * @param dist Squared distances parallel to `ids`; partitioned in place.
 * @param left Left bound of the range to partition (inclusive).
 * @param right Right bound of the range to partition (inclusive).
 * @param k Rank to select: afterwards `dist[k]` is the k-th smallest value.
 */
export default function quickSelect(
  ids: Uint32Array,
  dist: Float64Array,
  left: number,
  right: number,
  k: number,
): void {
  while (left < right) {
    let i = left
    let j = right
    const pivot = dist[(left + right) >> 1]
    while (i <= j) {
      while (dist[i] < pivot) i++
      while (dist[j] > pivot) j--
      if (i <= j) {
        const tmpD = dist[i]
        dist[i] = dist[j]
        dist[j] = tmpD
        const tmpI = ids[i]
        ids[i] = ids[j]
        ids[j] = tmpI
        i++
        j--
      }
    }
    if (j < k) left = i
    if (k < i) right = j
  }
}
