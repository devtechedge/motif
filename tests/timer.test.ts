import { describe, expect, it } from 'vitest'
import { timerTick } from '../src/lib/timer'

const FADE = 3.2

describe('timerTick', () => {
  it('counts down from a full session', () => {
    const t = timerTick(0, 900, FADE, 'running')
    expect(t.remaining).toBe(900)
    expect(t.enterFading).toBe(false)
    expect(t.complete).toBe(false)
  })

  it('enters fading exactly once, at the fade boundary', () => {
    const before = timerTick(900 - FADE - 0.1, 900, FADE, 'running')
    expect(before.enterFading).toBe(false)
    const at = timerTick(900 - FADE, 900, FADE, 'running')
    expect(at.enterFading).toBe(true)
    const during = timerTick(900 - FADE + 1, 900, FADE, 'fading')
    expect(during.enterFading).toBe(false) // never re-enters from fading
    expect(during.complete).toBe(false)
  })

  it('completes exactly at zero remaining', () => {
    const last = timerTick(900 - 0.01, 900, FADE, 'fading')
    expect(last.complete).toBe(false)
    const done = timerTick(900, 900, FADE, 'fading')
    expect(done.complete).toBe(true)
    expect(done.remaining).toBe(0)
  })

  it('stays complete if ticks continue past the end', () => {
    const over = timerTick(950, 900, FADE, 'fading')
    expect(over.complete).toBe(true)
    expect(over.remaining).toBe(0)
  })

  it('never enters fading from the fading state', () => {
    const t = timerTick(900 - FADE, 900, FADE, 'fading')
    expect(t.enterFading).toBe(false)
  })

  it('does not complete early when paused time froze the clock', () => {
    // used time frozen below the boundary: no fade, no completion
    const t = timerTick(100, 900, FADE, 'fading')
    expect(t.complete).toBe(false)
    expect(t.remaining).toBe(800)
  })
})
