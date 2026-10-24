import { SCENES } from '../scenes'
import { LAYER_IDS, cloneMix, type LayerMix, type SavedMix } from '../types'

export interface SessionSnapshot {
  sceneId: string
  mix: LayerMix
  volume: number
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const clamp01 = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null

const isKnownScene = (id: unknown): id is string =>
  typeof id === 'string' && SCENES.some((s) => s.id === id)

/** A mix is valid only if every layer has a boolean enabled flag and a finite 0..1 gain. */
export function sanitizeMix(raw: unknown): LayerMix | null {
  if (!isRecord(raw)) return null
  const mix = {} as LayerMix
  for (const id of LAYER_IDS) {
    const layer = raw[id]
    if (!isRecord(layer)) return null
    if (typeof layer.enabled !== 'boolean') return null
    const gain = clamp01(layer.gain)
    if (gain === null) return null
    mix[id] = { enabled: layer.enabled, gain }
  }
  return mix
}

export function sanitizeVolume(raw: unknown): number {
  const v = clamp01(raw)
  return v === null ? 0.75 : v
}

/** Restored session: known scene, valid mix, clamped volume. Anything else is dropped. */
export function sanitizeSession(raw: unknown): SessionSnapshot | null {
  if (!isRecord(raw)) return null
  if (!isKnownScene(raw.sceneId)) return null
  const mix = sanitizeMix(raw.mix)
  if (!mix) return null
  return { sceneId: raw.sceneId, mix, volume: sanitizeVolume(raw.volume) }
}

/** Restored shelf: array of well-formed entries pointing at known scenes. */
export function sanitizeSavedMixes(raw: unknown): SavedMix[] {
  if (!Array.isArray(raw)) return []
  const out: SavedMix[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    if (typeof entry.id !== 'string' || typeof entry.name !== 'string') continue
    if (!isKnownScene(entry.sceneId)) continue
    const mix = sanitizeMix(entry.mix)
    if (!mix) continue
    const createdAt = typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now()
    out.push({
      id: entry.id,
      name: entry.name.slice(0, 64),
      sceneId: entry.sceneId,
      mix: cloneMix(mix),
      volume: sanitizeVolume(entry.volume),
      createdAt,
    })
  }
  return out
}
