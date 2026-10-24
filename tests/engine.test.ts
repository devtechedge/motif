import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AudioEngine } from '../src/audio/engine'
import { layerGainCurve, masterCurve } from '../src/lib/gain'
import { cloneMix, type LayerId } from '../src/types'
import { getScene } from '../src/scenes'
import { FakeAudioContext, FakeAudioParam } from './fake-audio'

interface TimerRec {
  id: number
  kind: 'interval' | 'timeout'
  ms: number
  fn: () => void
  cleared: boolean
}

describe('AudioEngine lifecycle', () => {
  let ctx: FakeAudioContext
  let timers: TimerRec[]
  let nextTimerId: number
  let engine: AudioEngine
  const rain = getScene('rain-on-glass')
  const tide = getScene('lunar-tide')

  beforeEach(() => {
    ctx = new FakeAudioContext()
    timers = []
    nextTimerId = 1
    const win = {
      setInterval: (fn: () => void, ms: number) => {
        const id = nextTimerId++
        timers.push({ id, kind: 'interval', ms, fn, cleared: false })
        return id
      },
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextTimerId++
        timers.push({ id, kind: 'timeout', ms, fn, cleared: false })
        return id
      },
      clearInterval: (id: number) => {
        const t = timers.find((x) => x.id === id)
        if (t) t.cleared = true
      },
      clearTimeout: (id: number) => {
        const t = timers.find((x) => x.id === id)
        if (t) t.cleared = true
      },
      AudioContext: function () {
        return ctx
      },
    }
    ;(globalThis as Record<string, unknown>).window = win
    ;(globalThis as Record<string, unknown>).document = { hidden: false }
    engine = new AudioEngine(() => ctx as unknown as AudioContext)
  })

  afterEach(() => {
    engine.dispose()
    delete (globalThis as Record<string, unknown>).document
    delete (globalThis as Record<string, unknown>).window
  })

  /** ensureContext creates, in order: master, [comp, analyser], chimeBus, then the 5 buses. */
  function masterGain(): FakeAudioParam {
    return ctx.gains[0].gain
  }
  function chimeBusGain(): FakeAudioParam {
    return ctx.gains[1].gain
  }
  function busGain(id: LayerId): FakeAudioParam {
    const p = engine.layerBusParam(id)
    if (!p) throw new Error(`no bus for ${id}`)
    return p as unknown as FakeAudioParam
  }

  const startPlaying = async () => {
    engine.setScene(rain, cloneMix(rain.defaultMix))
    await engine.play()
  }

  it('play starts exactly one graph after a gesture', async () => {
    await startPlaying()
    expect(engine.playing).toBe(true)
    expect(engine.voiceCount).toBe(5)
    expect(ctx.state).toBe('running')
    const oscAfterFirstBuild = ctx.counters.oscillator
    await engine.play() // a second play while playing must not rebuild
    expect(ctx.counters.oscillator).toBe(oscAfterFirstBuild)
    expect(engine.voiceCount).toBe(5)
  })

  it('concurrent play() calls during resume build one graph (single flight)', async () => {
    engine.setScene(rain, cloneMix(rain.defaultMix))
    const resolvers: Array<() => void> = []
    ctx.resume = () => new Promise<void>((res) => resolvers.push(res))
    const p1 = engine.play()
    const p2 = engine.play()
    for (const r of resolvers) r()
    await Promise.all([p1, p2])
    expect(engine.voiceCount).toBe(5)
    expect(engine.playing).toBe(true)
  })

  it('pause freezes elapsed, resume continues, no duplicate voices', async () => {
    await startPlaying()
    ctx.tick(2)
    engine.pause()
    expect(engine.playing).toBe(false)
    expect(engine.getElapsed()).toBeCloseTo(2, 5)
    ctx.tick(5) // suspended clock does not advance
    expect(engine.getElapsed()).toBeCloseTo(2, 5)
    await engine.play()
    ctx.tick(1)
    expect(engine.getElapsed()).toBeCloseTo(3, 5)
    expect(engine.voiceCount).toBe(5)
  })

  it('stop resets elapsed and allows a clean restart', async () => {
    await startPlaying()
    ctx.tick(3)
    engine.stop()
    expect(engine.getElapsed()).toBe(0)
    expect(engine.playing).toBe(false)
    await engine.play()
    ctx.tick(1)
    expect(engine.getElapsed()).toBeCloseTo(1, 5)
    expect(engine.voiceCount).toBe(5)
  })

  it('completeSession stops the engine, freezes elapsed, retires voices, rings chime once', async () => {
    await startPlaying()
    ctx.tick(2)
    const oscBefore = ctx.counters.oscillator
    engine.completeSession(120)
    expect(engine.playing).toBe(false)
    expect(engine.getElapsed()).toBe(120)
    ctx.tick(5)
    expect(engine.getElapsed()).toBe(120) // frozen, not advancing
    // the chime contributed exactly two oscillators, once
    expect(ctx.counters.oscillator).toBe(oscBefore + 2)
    // playing again via the completion path (finalize, then play) works
    engine.finalizeAfterChime()
    expect(engine.getElapsed()).toBe(0)
    await engine.play()
    expect(engine.playing).toBe(true)
    ctx.tick(1)
    expect(engine.getElapsed()).toBeCloseTo(1, 5)
    expect(engine.voiceCount).toBe(5)
  })

  it('finalizeAfterChime does not stop a restarted session', async () => {
    await startPlaying()
    engine.completeSession(60)
    await engine.play()
    engine.finalizeAfterChime()
    expect(engine.playing).toBe(true)
  })

  it('completion drives the master to exact silence within half a second', async () => {
    await startPlaying()
    ctx.tick(1)
    expect(masterGain().getValueAt(ctx.currentTime)).toBeGreaterThan(0.1)
    engine.completeSession(30)
    ctx.tick(0.5)
    expect(masterGain().getValueAt(ctx.currentTime)).toBeLessThan(0.001)
  })

  it('zero master volume keeps the chime inaudible; mute skips the chime entirely', async () => {
    await startPlaying()
    engine.setVolume(0)
    engine.completeSession(60)
    expect(chimeBusGain().getValueAt(ctx.currentTime)).toBeCloseTo(0, 6)

    // fresh engine state: mute suppresses the chime structurally
    engine.setVolume(0.75)
    engine.setMuted(true)
    const oscBefore = ctx.counters.oscillator
    engine.chime()
    expect(ctx.counters.oscillator).toBe(oscBefore)
    engine.setMuted(false)
    engine.chime()
    expect(ctx.counters.oscillator).toBe(oscBefore + 2)
    expect(chimeBusGain().getValueAt(ctx.currentTime + 0.2)).toBeCloseTo(masterCurve(0.75), 2)
  })

  it('layer toggle and gain change the real bus automation', async () => {
    await startPlaying()
    ctx.tick(1)
    const water = busGain('water')
    expect(water.getValueAt(ctx.currentTime)).toBeCloseTo(layerGainCurve(rain.defaultMix.water.gain), 2)
    engine.setLayer('water', { enabled: false, gain: 0.5 })
    ctx.tick(1.5)
    expect(water.getValueAt(ctx.currentTime)).toBeLessThan(0.001)
    engine.setLayer('drone', { enabled: true, gain: 0.5 })
    ctx.tick(1)
    expect(busGain('drone').getValueAt(ctx.currentTime)).toBeCloseTo(layerGainCurve(0.5), 2)
  })

  it('rapid scene changes keep exactly one voice set and do not reset volume or mute', async () => {
    await startPlaying()
    engine.setVolume(0.4)
    for (const scene of [tide, rain, tide, rain, tide]) {
      engine.setScene(scene, cloneMix(scene.defaultMix))
      ctx.tick(0.05)
    }
    expect(engine.voiceCount).toBe(5)
    expect(engine.playing).toBe(true)
    // mute state untouched by scene changes
    engine.setMuted(true)
    engine.setScene(rain, cloneMix(rain.defaultMix))
    ctx.tick(0.3)
    expect(masterGain().getValueAt(ctx.currentTime)).toBeLessThan(0.001)
  })

  it('restoreMaster cancels a fade and restores the audible target', async () => {
    await startPlaying()
    ctx.tick(1)
    engine.beginFade(3.2)
    ctx.tick(0.5)
    expect(masterGain().getValueAt(ctx.currentTime)).toBeLessThan(masterCurve(0.75))
    engine.restoreMaster()
    ctx.tick(1)
    expect(masterGain().getValueAt(ctx.currentTime)).toBeCloseTo(masterCurve(0.75), 2)
    expect(engine.playing).toBe(true)
  })

  it('the fade envelope is meaningfully silent at its nominal end (tau = fade/6)', async () => {
    await startPlaying()
    ctx.tick(2)
    const pre = masterGain().getValueAt(ctx.currentTime)
    engine.beginFade(3.2)
    ctx.tick(3.2)
    const post = masterGain().getValueAt(ctx.currentTime)
    expect(post / pre).toBeLessThan(0.01) // about e^-6, not the old e^-3 (~5%)
  })

  it('dispose clears every engine and voice timer and closes the context', async () => {
    await startPlaying()
    ctx.tick(1)
    expect(timers.length).toBeGreaterThan(0)
    engine.dispose()
    expect(timers.every((t) => t.cleared)).toBe(true)
    expect(ctx.state).toBe('closed')
    expect(engine.voiceCount).toBe(0)
  })
})
