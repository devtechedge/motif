import { describe, expect, it } from 'vitest'
import { formatClock, formatRelative } from '../src/lib/format'

describe('formatClock', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(600)).toBe('10:00')
    expect(formatClock(3725)).toBe('62:05')
  })

  it('clamps negatives and caps absurd values', () => {
    expect(formatClock(-3)).toBe('0:00')
    expect(formatClock(999 * 60 + 59)).toBe('999:59')
    expect(formatClock(999 * 60 + 500)).toBe('999:59')
  })
})

describe('formatRelative', () => {
  const now = Date.parse('2026-10-24T12:00:00Z')

  it('describes recent times naturally', () => {
    expect(formatRelative(now - 10_000, now)).toBe('just now')
    expect(formatRelative(now - 12 * 60_000, now)).toBe('12m ago')
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('3h ago')
  })

  it('falls back to a calendar date beyond a day (locale-agnostic)', () => {
    const out = formatRelative(now - 30 * 86_400_000, now)
    expect(out).not.toMatch(/ago|just now/)
    expect(out).toMatch(/\d/)
  })
})
