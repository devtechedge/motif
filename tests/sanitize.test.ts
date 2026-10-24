import { describe, expect, it } from 'vitest'
import {
  sanitizeMix,
  sanitizeSavedMixes,
  sanitizeSession,
  sanitizeVolume,
} from '../src/lib/sanitize'

const validMix = {
  air: { enabled: true, gain: 0.5 },
  water: { enabled: false, gain: 0.2 },
  drone: { enabled: true, gain: 0.9 },
  texture: { enabled: false, gain: 0 },
  pulse: { enabled: true, gain: 1 },
}

describe('sanitizeMix', () => {
  it('accepts a complete valid mix', () => {
    expect(sanitizeMix(validMix)).toEqual(validMix)
  })

  it('rejects non-objects and arrays', () => {
    expect(sanitizeMix(null)).toBeNull()
    expect(sanitizeMix('mix')).toBeNull()
    expect(sanitizeMix([validMix])).toBeNull()
  })

  it('rejects missing layers or wrong field types', () => {
    expect(sanitizeMix({ ...validMix, pulse: undefined })).toBeNull()
    expect(sanitizeMix({ ...validMix, air: { enabled: 'yes', gain: 0.5 } })).toBeNull()
    expect(sanitizeMix({ ...validMix, water: { enabled: true, gain: 'loud' } })).toBeNull()
  })

  it('clamps out-of-range gains instead of passing them through', () => {
    const out = sanitizeMix({ ...validMix, drone: { enabled: true, gain: 5 } })
    expect(out?.drone.gain).toBe(1)
    const low = sanitizeMix({ ...validMix, drone: { enabled: true, gain: -3 } })
    expect(low?.drone.gain).toBe(0)
  })

  it('rejects NaN and Infinity gains', () => {
    expect(sanitizeMix({ ...validMix, air: { enabled: true, gain: Number.NaN } })).toBeNull()
    expect(sanitizeMix({ ...validMix, air: { enabled: true, gain: Number.POSITIVE_INFINITY } })).toBeNull()
  })
})

describe('sanitizeVolume', () => {
  it('clamps and falls back to 0.75 for junk', () => {
    expect(sanitizeVolume(0.3)).toBe(0.3)
    expect(sanitizeVolume(2)).toBe(1)
    expect(sanitizeVolume(-1)).toBe(0)
    expect(sanitizeVolume('loud')).toBe(0.75)
    expect(sanitizeVolume(null)).toBe(0.75)
  })
})

describe('sanitizeSession', () => {
  it('accepts a valid session', () => {
    const out = sanitizeSession({ sceneId: 'rain-on-glass', mix: validMix, volume: 0.5 })
    expect(out?.sceneId).toBe('rain-on-glass')
    expect(out?.volume).toBe(0.5)
  })

  it('rejects unknown scene ids and malformed mixes', () => {
    expect(sanitizeSession({ sceneId: 'hacker-scene', mix: validMix, volume: 0.5 })).toBeNull()
    expect(sanitizeSession({ sceneId: 7, mix: validMix, volume: 0.5 })).toBeNull()
    expect(sanitizeSession({ sceneId: 'rain-on-glass', mix: { air: 1 }, volume: 0.5 })).toBeNull()
    expect(sanitizeSession('garbage')).toBeNull()
    expect(sanitizeSession(null)).toBeNull()
  })
})

describe('sanitizeSavedMixes', () => {
  const entry = {
    id: 'abc',
    name: 'Night Rain',
    sceneId: 'rain-on-glass',
    mix: validMix,
    volume: 0.6,
    createdAt: 1700000000000,
  }

  it('keeps well-formed entries', () => {
    expect(sanitizeSavedMixes([entry])).toHaveLength(1)
  })

  it('filters junk entries instead of crashing', () => {
    const out = sanitizeSavedMixes([
      null,
      42,
      { ...entry, id: 5 },
      { ...entry, sceneId: 'nope' },
      { ...entry, mix: 'nope' },
      { id: 'ok', name: 'No Scene', sceneId: 'rain-on-glass', mix: validMix },
      entry,
    ])
    expect(out).toHaveLength(2)
  })

  it('defaults a missing createdAt and truncates long names', () => {
    const out = sanitizeSavedMixes([{ ...entry, createdAt: 'x', name: 'x'.repeat(200) }])
    expect(out[0].createdAt).toBeGreaterThan(0)
    expect(out[0].name.length).toBe(64)
  })

  it('returns an empty array for non-arrays', () => {
    expect(sanitizeSavedMixes('nope')).toEqual([])
    expect(sanitizeSavedMixes(null)).toEqual([])
  })
})
