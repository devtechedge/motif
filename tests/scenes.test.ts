import { describe, expect, it } from 'vitest'
import { SCENES } from '../src/scenes'
import { LAYERS, LAYER_IDS, type LayerId } from '../src/types'

const HEX = /^#[0-9a-fA-F]{6}$/

describe('scene library', () => {
  it('has at least five curated scenes with unique ids', () => {
    expect(SCENES.length).toBeGreaterThanOrEqual(5)
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length)
  })

  it('gives every scene a distinct field mode and name', () => {
    expect(new Set(SCENES.map((s) => s.fieldMode)).size).toBe(SCENES.length)
    expect(new Set(SCENES.map((s) => s.name)).size).toBe(SCENES.length)
  })

  it('has complete, in-range default mixes', () => {
    for (const scene of SCENES) {
      for (const id of LAYER_IDS) {
        const state = scene.defaultMix[id as LayerId]
        expect(state, `${scene.id}.${id}`).toBeDefined()
        expect(state.gain).toBeGreaterThanOrEqual(0)
        expect(state.gain).toBeLessThanOrEqual(1)
        expect(typeof state.enabled).toBe('boolean')
      }
      // every scene must be audible by default
      expect(LAYERS.some((l) => scene.defaultMix[l.id].enabled)).toBe(true)
    }
  })

  it('defines valid palettes', () => {
    for (const scene of SCENES) {
      for (const [key, value] of Object.entries(scene.palette)) {
        expect(value, `${scene.id}.${key}`).toMatch(HEX)
      }
    }
  })

  it('keeps audio parameters in musical, gentle ranges', () => {
    for (const scene of SCENES) {
      const a = scene.audio
      expect(a.air.tone).toBeGreaterThan(80)
      expect(a.air.tone).toBeLessThan(1600)
      expect(a.air.lfoRate).toBeGreaterThan(0)
      expect(a.air.lfoRate).toBeLessThan(1)
      expect(a.water.rate).toBeGreaterThan(0)
      expect(a.water.freqLo).toBeLessThan(a.water.freqHi)
      expect(a.drone.root).toBeGreaterThanOrEqual(40)
      expect(a.drone.root).toBeLessThanOrEqual(90)
      expect(a.drone.filter).toBeGreaterThan(100)
      expect(a.texture.density).toBeGreaterThan(0)
      expect(a.pulse.bpm).toBeGreaterThan(30)
      expect(a.pulse.bpm).toBeLessThan(120)
      for (const step of a.pulse.pattern) {
        expect(step.t).toBeGreaterThanOrEqual(0)
        expect(step.level).toBeGreaterThan(0)
        expect(step.level).toBeLessThanOrEqual(1)
      }
      // levels conservative — this is a quiet instrument
      for (const layer of [a.air, a.water, a.drone, a.texture, a.pulse]) {
        expect(layer.level).toBeGreaterThan(0)
        expect(layer.level).toBeLessThanOrEqual(0.7)
      }
    }
  })

  it('carries real copy for every scene', () => {
    for (const scene of SCENES) {
      expect(scene.name.length).toBeGreaterThan(2)
      expect(scene.tagline.length).toBeGreaterThan(4)
      expect(scene.description.length).toBeGreaterThan(20)
    }
  })
})
