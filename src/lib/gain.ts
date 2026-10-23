import { LAYERS, type LayerId, type LayerMix } from '../types'

/**
 * Perceptual curve for layer levels: keeps the useful range wide without
 * letting a single layer dominate the master bus. 0 -> 0, 1 -> 1, monotonic.
 */
export function layerGainCurve(g: number): number {
  const c = Math.min(1, Math.max(0, g))
  return Math.pow(c, 1.75)
}

/** Master volume curve, slightly gentler than the layer curve. */
export function masterCurve(v: number): number {
  const c = Math.min(1, Math.max(0, v))
  return Math.pow(c, 1.6)
}

/** Overall intensity of the mix, 0..1 — feeds the visual field. */
export function mixIntensity(mix: LayerMix): number {
  let sum = 0
  for (const layer of LAYERS) {
    const s = mix[layer.id]
    if (s.enabled) sum += layerGainCurve(s.gain)
  }
  return Math.min(1, sum / LAYERS.length)
}

/** Effective per-layer level (0 when disabled) — drives per-layer visuals. */
export function effectiveLayerLevel(mix: LayerMix, id: LayerId): number {
  const s = mix[id]
  return s.enabled ? layerGainCurve(s.gain) : 0
}

/** Human summary of a mix, e.g. "Water · Drone · Texture". */
export function describeMix(mix: LayerMix): string {
  const names = LAYERS.filter((l) => mix[l.id].enabled).map((l) => l.name)
  if (names.length === 0) return 'all layers off'
  if (names.length === LAYERS.length) return 'full mix'
  return names.join(' · ')
}

/** Suggested name for a saved mix, e.g. "Rain on Glass № 3". */
export function suggestMixName(sceneName: string, existingCount: number): string {
  return `${sceneName} № ${existingCount + 1}`
}
