import type { BiomeSample } from '../../types/index.js'

/**
 * Multi-layer biome blending: moisture raises mountain mass, temperature
 * softens peaks into rolling hills. Returns a height multiplier.
 *
 * @param sample Elevation/moisture/temperature fields; clamped into range.
 * @returns Height multiplier combining all three layers.
 */
export function blendBiomes(sample: BiomeSample): number {
  const elevation = Math.max(-1, Math.min(1, sample.elevation))
  const moisture = Math.max(0, Math.min(1, sample.moisture))
  const temperature = Math.max(0, Math.min(1, sample.temperature))
  const mountains = 0.6 + 0.9 * moisture
  const hills = 1.15 - 0.45 * temperature
  return (0.5 + 0.5 * elevation) * mountains * hills
}
