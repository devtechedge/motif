import { describe, expect, it } from 'vitest'
import { decodeMix, encodeMix } from '../src/lib/share'
import { cloneMix } from '../src/types'
import { getScene } from '../src/scenes'

function snapshot() {
  const scene = getScene('rain-on-glass')
  const mix = cloneMix(scene.defaultMix)
  mix.water.gain = 0.42
  mix.pulse.enabled = true
  return { sceneId: scene.id, mix, volume: 0.66 }
}

describe('encodeMix / decodeMix', () => {
  it('round-trips a mix through a versioned hash', () => {
    const hash = encodeMix(snapshot())
    expect(hash.startsWith('#m1.')).toBe(true)
    const back = decodeMix(hash)
    expect(back?.sceneId).toBe('rain-on-glass')
    expect(back?.volume).toBeCloseTo(0.66, 5)
    expect(back?.mix.water.gain).toBeCloseTo(0.42, 5)
    expect(back?.mix.pulse.enabled).toBe(true)
    expect(back?.mix.air.enabled).toBe(true)
  })

  it('rejects junk, wrong versions, and tampered payloads', () => {
    expect(decodeMix('')).toBeNull()
    expect(decodeMix('#other.abc')).toBeNull()
    expect(decodeMix('#m1.not-base64!')).toBeNull()
    const tampered = btoa(JSON.stringify({ v: 2, sceneId: 'rain-on-glass' }))
    expect(decodeMix(`#m1.${tampered}`)).toBeNull()
    const unknownScene = btoa(JSON.stringify({ v: 1, sceneId: 'nope', volume: 1, mix: {} }))
    expect(decodeMix(`#m1.${unknownScene}`)).toBeNull()
  })

  it('decodes values that need clamping but rejects NaN gains', () => {
    const clamped = btoa(
      JSON.stringify({
        v: 1,
        sceneId: 'blue-hour',
        volume: 5,
        mix: { air: { e: 1, g: 9 }, water: { e: 0, g: 0.2 }, drone: { e: 1, g: 0.5 }, texture: { e: 0, g: 0 }, pulse: { e: 1, g: 1 } },
      }),
    )
    const out = decodeMix(`#m1.${clamped}`)
    expect(out?.volume).toBe(1)
    expect(out?.mix.air.gain).toBe(1)
    const nanGain = btoa(
      JSON.stringify({
        v: 1,
        sceneId: 'blue-hour',
        volume: 1,
        mix: { air: { e: 1, g: Number.NaN }, water: { e: 0, g: 0.2 }, drone: { e: 1, g: 0.5 }, texture: { e: 0, g: 0 }, pulse: { e: 1, g: 1 } },
      }),
    )
    expect(decodeMix(`#m1.${nanGain}`)).toBeNull()
  })
})
