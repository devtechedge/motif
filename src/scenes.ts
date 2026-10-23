import type { LayerMix, Scene } from './types'

function mixOf(entries: Partial<Record<keyof LayerMix, number>>): LayerMix {
  return {
    air: { enabled: 'air' in entries, gain: entries.air ?? 0 },
    water: { enabled: 'water' in entries, gain: entries.water ?? 0 },
    drone: { enabled: 'drone' in entries, gain: entries.drone ?? 0 },
    texture: { enabled: 'texture' in entries, gain: entries.texture ?? 0 },
    pulse: { enabled: 'pulse' in entries, gain: entries.pulse ?? 0 },
  }
}

// Shared shimmer scale: a soft pentatonic spread.
const SHIMMER_SCALE = [1, 1.125, 1.25, 1.5, 1.667, 2]

export const SCENES: readonly Scene[] = [
  {
    id: 'rain-on-glass',
    name: 'Rain on Glass',
    tagline: 'A warm room, a cold sky',
    description:
      'Droplets trace the window while the city hums somewhere below. Close, dry, and quietly busy.',
    fieldMode: 'rain',
    palette: {
      accent: '#8FC3E8',
      glow: '#6FA8D4',
      fieldA: '#0C1421',
      fieldB: '#131E2B',
      particle: '#C4E1F4',
    },
    audio: {
      air: { tone: 520, width: 0.65, lfoRate: 0.045, lfoDepth: 0.28, pan: -0.35, level: 0.34 },
      water: {
        mode: 'rain',
        bedLevel: 0.5,
        bedFreq: 2400,
        rate: 7,
        freqLo: 1250,
        freqHi: 3100,
        decay: 0.09,
        echo: 0,
        pan: 0.1,
        level: 0.62,
      },
      drone: { root: 55, fifth: 0.3, octave: 0.5, detune: 5, filter: 200, lfoRate: 0.05, pan: 0, level: 0.4 },
      texture: { mode: 'crackle', density: 2.6, brightness: 0.55, root: 440, scale: SHIMMER_SCALE, pan: 0.4, level: 0.24 },
      pulse: { bpm: 60, root: 220, pattern: [{ t: 0, ratio: 1, level: 1 }], decay: 0.5, filter: 700, pan: 0, level: 0.5 },
    },
    defaultMix: mixOf({ air: 0.45, water: 0.75, texture: 0.3 }),
  },
  {
    id: 'lunar-tide',
    name: 'Lunar Tide',
    tagline: 'Breathing with the moon',
    description:
      'A slow sea under a low moon. The water rises and falls while a deep chord holds the dark in place.',
    fieldMode: 'tide',
    palette: {
      accent: '#66D1C7',
      glow: '#54B8AF',
      fieldA: '#071316',
      fieldB: '#0D2226',
      particle: '#A9E8E0',
    },
    audio: {
      air: { tone: 380, width: 0.5, lfoRate: 0.06, lfoDepth: 0.35, pan: 0.3, level: 0.3 },
      water: {
        mode: 'tide',
        bedLevel: 0.55,
        bedFreq: 600,
        rate: 0.07,
        freqLo: 320,
        freqHi: 900,
        decay: 0.2,
        echo: 0,
        pan: 0,
        level: 0.6,
      },
      drone: { root: 55, fifth: 0.55, octave: 0.65, detune: 6, filter: 230, lfoRate: 0.04, pan: -0.1, level: 0.5 },
      texture: { mode: 'shimmer', density: 0.2, brightness: 0.8, root: 440, scale: SHIMMER_SCALE, pan: 0.15, level: 0.5 },
      pulse: { bpm: 50, root: 110, pattern: [{ t: 0, ratio: 1, level: 1 }], decay: 0.8, filter: 500, pan: 0, level: 0.4 },
    },
    defaultMix: mixOf({ air: 0.35, water: 0.65, drone: 0.6, texture: 0.35 }),
  },
  {
    id: 'moss-cathedral',
    name: 'Moss Cathedral',
    tagline: 'Light through old stone',
    description:
      'A nave of ferns and shadow. Distant water drops echo while a breath of voices keeps the silence company.',
    fieldMode: 'moss',
    palette: {
      accent: '#A9C88B',
      glow: '#8FB573',
      fieldA: '#0B110B',
      fieldB: '#131F16',
      particle: '#D9EBBC',
    },
    audio: {
      air: { tone: 300, width: 0.45, lfoRate: 0.05, lfoDepth: 0.4, pan: -0.2, level: 0.36 },
      water: {
        mode: 'drip',
        bedLevel: 0.25,
        bedFreq: 800,
        rate: 0.4,
        freqLo: 520,
        freqHi: 980,
        decay: 0.34,
        echo: 0.36,
        pan: 0.25,
        level: 0.55,
      },
      drone: { root: 65.41, fifth: 0.4, octave: 0.55, detune: 4, filter: 210, lfoRate: 0.035, pan: 0.05, level: 0.52 },
      texture: { mode: 'choir', density: 0.5, brightness: 0.5, root: 130.81, scale: SHIMMER_SCALE, pan: -0.1, level: 0.6 },
      pulse: { bpm: 40, root: 130.81, pattern: [{ t: 0, ratio: 1, level: 1 }], decay: 1, filter: 400, pan: 0, level: 0.3 },
    },
    defaultMix: mixOf({ air: 0.5, water: 0.4, drone: 0.55, texture: 0.5 }),
  },
  {
    id: 'blue-hour',
    name: 'Blue Hour',
    tagline: 'The last light of the day',
    description:
      'Neither day nor night. Stars arrive one at a time while a slow heartbeat keeps the reading lamp company.',
    fieldMode: 'dusk',
    palette: {
      accent: '#93B3DD',
      glow: '#7C9CC8',
      fieldA: '#090E19',
      fieldB: '#152238',
      particle: '#CBD9F1',
    },
    audio: {
      air: { tone: 880, width: 0.8, lfoRate: 0.04, lfoDepth: 0.25, pan: 0.15, level: 0.28 },
      water: {
        mode: 'tide',
        bedLevel: 0.3,
        bedFreq: 500,
        rate: 0.05,
        freqLo: 260,
        freqHi: 700,
        decay: 0.2,
        echo: 0,
        pan: 0,
        level: 0.45,
      },
      drone: { root: 65.41, fifth: 0.35, octave: 0.6, detune: 5, filter: 240, lfoRate: 0.03, pan: 0, level: 0.5 },
      texture: { mode: 'shimmer', density: 0.16, brightness: 1, root: 587.33, scale: SHIMMER_SCALE, pan: 0, level: 0.45 },
      pulse: {
        bpm: 44,
        root: 87.31,
        pattern: [
          { t: 0, ratio: 1, level: 1 },
          { t: 0.24, ratio: 1.5, level: 0.55 },
        ],
        decay: 0.5,
        filter: 480,
        pan: 0.1,
        level: 0.5,
      },
    },
    defaultMix: mixOf({ air: 0.4, drone: 0.5, texture: 0.45, pulse: 0.28 }),
  },
  {
    id: 'neon-drift',
    name: 'Neon Drift',
    tagline: 'Late streets, warm windows',
    description:
      'A slow cruise through a sleeping city. An arpeggio of streetlights, a whisper of vinyl, a bassline under the road.',
    fieldMode: 'drift',
    palette: {
      accent: '#F0975A',
      glow: '#E8905C',
      fieldA: '#140D0B',
      fieldB: '#221310',
      particle: '#FFD9A8',
    },
    audio: {
      air: { tone: 160, width: 0.55, lfoRate: 0.05, lfoDepth: 0.3, pan: 0, level: 0.32 },
      water: {
        mode: 'rain',
        bedLevel: 0.2,
        bedFreq: 3000,
        rate: 3,
        freqLo: 1800,
        freqHi: 3600,
        decay: 0.06,
        echo: 0,
        pan: 0,
        level: 0.4,
      },
      drone: { root: 49, fifth: 0.45, octave: 0.7, detune: 7, filter: 190, lfoRate: 0.045, pan: -0.05, level: 0.5 },
      texture: { mode: 'crackle', density: 4, brightness: 0.75, root: 440, scale: SHIMMER_SCALE, pan: 0.3, level: 0.3 },
      pulse: {
        bpm: 76,
        root: 196,
        pattern: [
          { t: 0, ratio: 2, level: 1 },
          { t: 0.5, ratio: 1.5, level: 0.7 },
          { t: 1, ratio: 1, level: 0.85 },
          { t: 2, ratio: 2.522, level: 0.55 },
          { t: 2.5, ratio: 1.5, level: 0.5 },
        ],
        decay: 0.6,
        filter: 950,
        pan: 0.15,
        level: 0.62,
      },
    },
    defaultMix: mixOf({ air: 0.3, drone: 0.45, texture: 0.35, pulse: 0.6 }),
  },
]

export function getScene(id: string): Scene {
  return SCENES.find((s) => s.id === id) ?? SCENES[0]
}
