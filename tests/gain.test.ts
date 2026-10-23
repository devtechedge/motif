import { describe, expect, it } from 'vitest'
import {
  describeMix,
  effectiveLayerLevel,
  layerGainCurve,
  masterCurve,
  mixIntensity,
  suggestMixName,
} from '../src/lib/gain'
import { cloneMix, LAYERS, type LayerMix } from '../src/types'
import { getScene } from '../src/scenes'

function allOff(): LayerMix {
  const mix = {} as LayerMix
  for (const l of LAYERS) mix[l.id] = { enabled: false, gain: 0 }
  return mix
}

describe('layerGainCurve', () => {
  it('maps 0 to 0 and 1 to 1', () => {
    expect(layerGainCurve(0)).toBe(0)
    expect(layerGainCurve(1)).toBe(1)
  })

  it('is monotonic', () => {
    let prev = -1
    for (let v = 0; v <= 1.001; v += 0.05) {
      const out = layerGainCurve(Math.min(1, v))
      expect(out).toBeGreaterThanOrEqual(prev)
      prev = out
    }
  })

  it('clamps out-of-range input', () => {
    expect(layerGainCurve(1.5)).toBe(1)
    expect(layerGainCurve(-0.3)).toBe(0)
  })
})

describe('masterCurve', () => {
  it('is monotonic and clamped', () => {
    expect(masterCurve(0)).toBe(0)
    expect(masterCurve(1)).toBe(1)
    expect(masterCurve(2)).toBe(1)
    expect(masterCurve(0.5)).toBeGreaterThan(masterCurve(0.4))
  })
})

describe('mixIntensity', () => {
  it('is 0 when everything is off', () => {
    expect(mixIntensity(allOff())).toBe(0)
  })

  it('grows with enabled layers', () => {
    const quiet = allOff()
    quiet.water = { enabled: true, gain: 0.5 }
    const loud = allOff()
    loud.water = { enabled: true, gain: 1 }
    loud.drone = { enabled: true, gain: 1 }
    expect(mixIntensity(loud)).toBeGreaterThan(mixIntensity(quiet))
    expect(mixIntensity(loud)).toBeLessThanOrEqual(1)
  })
})

describe('effectiveLayerLevel', () => {
  it('returns 0 for disabled layers regardless of gain', () => {
    expect(effectiveLayerLevel({ water: { enabled: false, gain: 0.9 } } as LayerMix, 'water')).toBe(0)
    expect(effectiveLayerLevel({ water: { enabled: true, gain: 0.9 } } as LayerMix, 'water')).toBeGreaterThan(0)
  })
})

describe('describeMix', () => {
  it('names the enabled layers', () => {
    const mix = allOff()
    mix.water = { enabled: true, gain: 0.5 }
    mix.drone = { enabled: true, gain: 0.5 }
    expect(describeMix(mix)).toBe('Water · Low Drone')
  })

  it('handles the empty and full cases', () => {
    expect(describeMix(allOff())).toBe('all layers off')
    const full = cloneMix(getScene('rain-on-glass').defaultMix)
    for (const l of LAYERS) full[l.id] = { enabled: true, gain: 0.5 }
    expect(describeMix(full)).toBe('full mix')
  })
})

describe('suggestMixName', () => {
  it('numbers suggestions sequentially', () => {
    expect(suggestMixName('Rain on Glass', 0)).toBe('Rain on Glass № 1')
    expect(suggestMixName('Blue Hour', 4)).toBe('Blue Hour № 5')
  })
})
