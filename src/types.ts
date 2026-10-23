export type LayerId = 'air' | 'water' | 'drone' | 'texture' | 'pulse'

export interface LayerState {
  enabled: boolean
  /** User-facing level, 0..1. Mapped through a perceptual curve in the engine. */
  gain: number
}

export type LayerMix = Record<LayerId, LayerState>

export interface LayerInfo {
  id: LayerId
  name: string
  hint: string
}

export const LAYERS: readonly LayerInfo[] = [
  { id: 'air', name: 'Air', hint: 'Soft moving air and room tone' },
  { id: 'water', name: 'Water', hint: 'Rain, tide or distant drips' },
  { id: 'drone', name: 'Low Drone', hint: 'A slow harmonic floor' },
  { id: 'texture', name: 'Texture', hint: 'Crackle, shimmer or breath' },
  { id: 'pulse', name: 'Pulse', hint: 'A quiet rhythmic anchor' },
] as const

export const LAYER_IDS: readonly LayerId[] = LAYERS.map((l) => l.id)

/** Per-scene tuning for the Air layer: filtered pink noise, slowly modulated. */
export interface AirParams {
  /** Bandpass center frequency, Hz. */
  tone: number
  /** Bandpass Q. Lower is broader. */
  width: number
  /** Filter sweep rate, Hz (slow). */
  lfoRate: number
  /** Relative filter sweep depth, 0..1 of tone. */
  lfoDepth: number
  pan: number
  /** Voice output trim, 0..1. */
  level: number
}

/** Per-scene tuning for the Water layer. Field meaning depends on `mode`. */
export interface WaterParams {
  mode: 'rain' | 'tide' | 'drip'
  /**
   * rain/drip: steady bed level. tide: main swell level.
   * tide: `rate` is the swell LFO rate in Hz; freqLo..freqHi is the lowpass sweep range.
   */
  bedLevel: number
  bedFreq: number
  /** rain/drip: average events per second. tide: swell rate in Hz. */
  rate: number
  /** rain/drip: droplet frequency range. tide: lowpass sweep low bound. */
  freqLo: number
  freqHi: number
  /** Droplet decay, seconds. */
  decay: number
  /** Drip mode echo feedback, 0..1. */
  echo: number
  pan: number
  level: number
}

export interface DroneParams {
  /** Fundamental, Hz. */
  root: number
  /** Level of the perfect fifth partial, 0..1. */
  fifth: number
  /** Level of the sub-octave partial, 0..1. */
  octave: number
  /** Detune between the two main oscillators, cents. */
  detune: number
  /** Lowpass cutoff, Hz. */
  filter: number
  /** Slow amplitude breathing rate, Hz. */
  lfoRate: number
  pan: number
  level: number
}

export interface TextureParams {
  mode: 'crackle' | 'shimmer' | 'choir'
  /** crackle/shimmer: average events per second. choir: breath depth factor. */
  density: number
  /** crackle: filter brightness 0..1. shimmer: octave spread 0..1. */
  brightness: number
  /** shimmer/choir root note, Hz. */
  root: number
  /** shimmer: ratios over root. */
  scale: number[]
  pan: number
  level: number
}

export interface PulseStep {
  /** Position within one cycle, in beats. */
  t: number
  /** Frequency ratio over root. */
  ratio: number
  /** Velocity 0..1. */
  level: number
}

export interface PulseParams {
  bpm: number
  /** Root note, Hz. */
  root: number
  /** One cycle of steps, in beats. */
  pattern: PulseStep[]
  /** Pluck decay, seconds. */
  decay: number
  /** Lowpass cutoff, Hz. */
  filter: number
  pan: number
  level: number
}

export interface SceneAudio {
  air: AirParams
  water: WaterParams
  drone: DroneParams
  texture: TextureParams
  pulse: PulseParams
}

export interface Palette {
  /** UI accent for the active scene. */
  accent: string
  /** Core glow of the field. */
  glow: string
  /** Field gradient, top / deep. */
  fieldA: string
  fieldB: string
  /** Particles and fine light. */
  particle: string
}

export type FieldMode = 'rain' | 'tide' | 'moss' | 'dusk' | 'drift'

export interface Scene {
  id: string
  name: string
  tagline: string
  description: string
  fieldMode: FieldMode
  palette: Palette
  audio: SceneAudio
  defaultMix: LayerMix
}

export interface SavedMix {
  id: string
  name: string
  sceneId: string
  mix: LayerMix
  volume: number
  createdAt: number
}

export type PlayState = 'idle' | 'playing' | 'paused'

export type TimerKind = 'off' | 'running' | 'fading' | 'done'

export function cloneMix(mix: LayerMix): LayerMix {
  return {
    air: { ...mix.air },
    water: { ...mix.water },
    drone: { ...mix.drone },
    texture: { ...mix.texture },
    pulse: { ...mix.pulse },
  }
}
