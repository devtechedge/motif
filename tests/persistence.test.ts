import { describe, expect, it } from 'vitest'
import { createLocalStorage, createMemoryStorage, detectStorage } from '../src/lib/persistence'

function memoryBacking(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  }
}

function brokenBacking(): Storage {
  return {
    ...memoryBacking(),
    setItem: () => {
      throw new Error('quota exceeded')
    },
  }
}

describe('localStorage adapter', () => {
  it('round-trips JSON values', () => {
    const s = createLocalStorage(memoryBacking())
    expect(s.ok).toBe(true)
    s.set('k', { a: 1 })
    expect(s.get<{ a: number }>('k')).toEqual({ a: 1 })
    s.remove('k')
    expect(s.get('k')).toBeNull()
  })

  it('degrades to not-ok when writes throw, even during the probe', () => {
    const s = createLocalStorage(brokenBacking())
    expect(s.ok).toBe(false) // the probe itself fails
    expect(s.set('k', 1)).toBe(false)
    // after degrading, further writes report failure instead of throwing
    expect(s.set('k2', 2)).toBe(false)
  })
})

describe('memory fallback', () => {
  it('stores for the lifetime of the adapter but reports not persistent', () => {
    const s = createMemoryStorage()
    expect(s.ok).toBe(false)
    expect(s.set('k', 'v')).toBe(true)
    expect(s.get('k')).toBe('v')
  })
})

describe('detectStorage', () => {
  it('returns a working adapter even when localStorage is missing', () => {
    const s = detectStorage()
    expect(typeof s.get).toBe('function')
    s.set('probe', 42)
    expect(s.get('probe')).toBe(42)
  })
})
