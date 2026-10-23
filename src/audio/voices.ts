import type { AirParams, DroneParams, PulseParams, TextureParams, WaterParams } from '../types'
import type { NoiseBank } from './noise'

export interface Voice {
  /** Soft dispose crossfades out over ~0.5s; hard dispose stops immediately. */
  dispose(hard?: boolean): void
}

export interface VoiceOptions<P> {
  ctx: AudioContext
  dest: AudioNode
  noise: NoiseBank
  params: P
  now: number
}

// ---------------------------------------------------------------- utilities

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
/** Average gap 1/rate, memoryless — natural for rain, crackle, drips. */
const expovariate = (rate: number) => -Math.log(1 - Math.random()) / rate

/** Background tabs throttle timers to ~1Hz; look further ahead there. */
function lookahead(): number {
  return typeof document !== 'undefined' && document.hidden ? 1.15 : 0.3
}

interface VoiceBase {
  /** Post-everything gain node, already connected to dest. Ramps 0 → level. */
  out: GainNode
  /** Register a persistent node for disconnection. */
  track<T extends AudioNode>(node: T): T
  /** Register a started source so dispose can stop it. */
  source<T extends AudioScheduledSourceNode>(node: T): T
  /** A started sine LFO summed into an AudioParam. */
  lfoTo(param: AudioParam, rate: number, depth: number, phase?: OscillatorType): void
  /** An interval owned by the voice, cleared on dispose. */
  every(ms: number, fn: () => void): void
  dispose(hard?: boolean): void
}

function createVoiceBase(ctx: AudioContext, dest: AudioNode, fadeIn: number, level: number): VoiceBase {
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, ctx.currentTime)
  out.gain.linearRampToValueAtTime(level, ctx.currentTime + fadeIn)
  out.connect(dest)
  const nodes: AudioNode[] = [out]
  const sources: AudioScheduledSourceNode[] = []
  const timers: number[] = []

  return {
    out,
    track<T extends AudioNode>(node: T): T {
      nodes.push(node)
      return node
    },
    source<T extends AudioScheduledSourceNode>(node: T): T {
      sources.push(node)
      return node
    },
    lfoTo(param: AudioParam, rate: number, depth: number, type: OscillatorType = 'sine') {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = rate
      const amt = ctx.createGain()
      amt.gain.value = depth
      osc.connect(amt)
      amt.connect(param)
      osc.start(ctx.currentTime)
      nodes.push(osc, amt)
      sources.push(osc)
    },
    every(ms: number, fn: () => void) {
      timers.push(window.setInterval(fn, ms))
    },
    dispose(hard = false) {
      const t = ctx.currentTime
      for (const id of timers) window.clearInterval(id)
      out.gain.cancelScheduledValues(t)
      out.gain.setTargetAtTime(0, t, hard ? 0.005 : 0.1)
      const stopAt = hard ? t : t + 0.55
      for (const s of sources) {
        try {
          s.stop(stopAt)
        } catch {
          // already stopped
        }
      }
      const disconnectAt = hard ? 0 : 750
      window.setTimeout(() => {
        for (const n of nodes) {
          try {
            n.disconnect()
          } catch {
            // already disconnected
          }
        }
      }, disconnectAt)
    },
  }
}

/** Runs `tick` on an interval; tick must schedule everything up to
 *  ctx.currentTime + lookahead() and advance its own cursor. */
function runScheduler(base: VoiceBase, tick: () => void): void {
  tick()
  base.every(80, tick)
}

// ------------------------------------------------------------------- voices

export function createAirVoice({ ctx, dest, noise, params: p, now }: VoiceOptions<AirParams>): Voice {
  const base = createVoiceBase(ctx, dest, 2.4, p.level)
  const src = base.source(noise.source('pink', now))
  const bp = base.track(ctx.createBiquadFilter())
  bp.type = 'bandpass'
  bp.frequency.value = p.tone
  bp.Q.value = p.width
  const amp = base.track(ctx.createGain())
  amp.gain.value = 0.8
  const pan = base.track(ctx.createStereoPanner())
  pan.pan.value = p.pan
  src.connect(bp)
  bp.connect(amp)
  amp.connect(pan)
  pan.connect(base.out)
  base.lfoTo(bp.frequency, p.lfoRate, p.tone * p.lfoDepth)
  base.lfoTo(amp.gain, p.lfoRate * 0.73, 0.12)
  return base
}

export function createWaterVoice({ ctx, dest, noise, params: p, now }: VoiceOptions<WaterParams>): Voice {
  const base = createVoiceBase(ctx, dest, 2.2, p.level)

  if (p.mode === 'rain') {
    const bed = base.source(noise.source('white', now))
    const hp = base.track(ctx.createBiquadFilter())
    hp.type = 'highpass'
    hp.frequency.value = p.bedFreq
    hp.Q.value = 0.7
    const bg = base.track(ctx.createGain())
    bg.gain.value = p.bedLevel * 0.12
    bed.connect(hp)
    hp.connect(bg)
    bg.connect(base.out)
    base.lfoTo(hp.frequency, 0.11, p.bedFreq * 0.2)

    let nextAt = now + 0.12
    runScheduler(base, () => {
      const until = ctx.currentTime + lookahead()
      while (nextAt < until) {
        const t = Math.max(nextAt, ctx.currentTime + 0.02)
        const f = rand(p.freqLo, p.freqHi)
        const peak = rand(0.03, 0.1)
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.setValueAtTime(f, t)
        o.frequency.exponentialRampToValueAtTime(f * rand(0.82, 0.95), t + p.decay)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(peak, t + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0004, t + p.decay)
        const dp = ctx.createStereoPanner()
        dp.pan.value = rand(-0.75, 0.75)
        o.connect(g)
        g.connect(dp)
        dp.connect(base.out)
        o.start(t)
        o.stop(t + p.decay + 0.08)
        nextAt += Math.max(0.04, expovariate(p.rate))
      }
    })
    return base
  }

  if (p.mode === 'tide') {
    const bed = base.source(noise.source('pink', now))
    const lp = base.track(ctx.createBiquadFilter())
    lp.type = 'lowpass'
    lp.frequency.value = (p.freqLo + p.freqHi) / 2
    lp.Q.value = 0.9
    const amp = base.track(ctx.createGain())
    amp.gain.value = p.bedLevel * 0.3
    const pan = base.track(ctx.createStereoPanner())
    pan.pan.value = p.pan
    bed.connect(lp)
    lp.connect(amp)
    amp.connect(pan)
    pan.connect(base.out)
    base.lfoTo(lp.frequency, p.rate, (p.freqHi - p.freqLo) / 2)
    base.lfoTo(amp.gain, p.rate * 0.93, p.bedLevel * 0.17)
    // foam hiss riding slightly ahead of each swell
    const foam = base.source(noise.source('white', now))
    const fhp = base.track(ctx.createBiquadFilter())
    fhp.type = 'highpass'
    fhp.frequency.value = 2600
    const fg = base.track(ctx.createGain())
    fg.gain.value = p.bedLevel * 0.035
    foam.connect(fhp)
    fhp.connect(fg)
    fg.connect(pan)
    base.lfoTo(fg.gain, p.rate * 1.32, p.bedLevel * 0.028)
    return base
  }

  // drip — sparse drops into a damped echo, cathedral distance
  const bed = base.source(noise.source('pink', now))
  const blp = base.track(ctx.createBiquadFilter())
  blp.type = 'lowpass'
  blp.frequency.value = 900
  const bg = base.track(ctx.createGain())
  bg.gain.value = 0.035 * p.bedLevel + 0.012
  bed.connect(blp)
  blp.connect(bg)
  bg.connect(base.out)

  const delay = base.track(ctx.createDelay(1))
  delay.delayTime.value = 0.31
  const damp = base.track(ctx.createBiquadFilter())
  damp.type = 'lowpass'
  damp.frequency.value = 1900
  const fb = base.track(ctx.createGain())
  fb.gain.value = p.echo
  const wet = base.track(ctx.createGain())
  wet.gain.value = 0.45
  delay.connect(damp)
  damp.connect(fb)
  fb.connect(delay)
  delay.connect(wet)
  wet.connect(base.out)

  let nextAt = now + 0.3
  runScheduler(base, () => {
    const until = ctx.currentTime + lookahead()
    while (nextAt < until) {
      const t = Math.max(nextAt, ctx.currentTime + 0.02)
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = rand(p.freqLo, p.freqHi)
      const g = ctx.createGain()
      const peak = rand(0.05, 0.1)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.007)
      g.gain.exponentialRampToValueAtTime(0.0004, t + p.decay)
      const dp = ctx.createStereoPanner()
      dp.pan.value = p.pan + rand(-0.18, 0.18)
      o.connect(g)
      g.connect(dp)
      dp.connect(base.out)
      dp.connect(delay)
      o.start(t)
      o.stop(t + p.decay + 0.1)
      nextAt += Math.max(0.5, expovariate(p.rate))
    }
  })
  return base
}

export function createDroneVoice({ ctx, dest, params: p, now }: VoiceOptions<DroneParams>): Voice {
  const base = createVoiceBase(ctx, dest, 3.2, p.level)
  const mix = base.track(ctx.createGain())
  mix.gain.value = 1
  const lp = base.track(ctx.createBiquadFilter())
  lp.type = 'lowpass'
  lp.frequency.value = p.filter
  lp.Q.value = 0.7
  const amp = base.track(ctx.createGain())
  amp.gain.value = 0.9
  const pan = base.track(ctx.createStereoPanner())
  pan.pan.value = p.pan
  mix.connect(lp)
  lp.connect(amp)
  amp.connect(pan)
  pan.connect(base.out)

  const spec: Array<{ freq: number; level: number; type: OscillatorType; detune: number }> = [
    { freq: p.root, level: 1, type: 'sine', detune: 0 },
    { freq: p.root, level: 0.8, type: 'sine', detune: p.detune },
    { freq: p.root * 2, level: 0.22, type: 'sine', detune: 0 },
    { freq: p.root / 2, level: p.octave * 0.55, type: 'triangle', detune: 0 },
    { freq: p.root * 1.5, level: p.fifth * 0.45, type: 'sine', detune: 0 },
  ]
  const oscs: OscillatorNode[] = []
  for (const part of spec) {
    const o = base.source(ctx.createOscillator())
    o.type = part.type
    o.frequency.value = part.freq
    if (part.detune) o.detune.value = part.detune
    const g = base.track(ctx.createGain())
    g.gain.value = part.level * 0.15
    o.connect(g)
    g.connect(mix)
    o.start(now)
    oscs.push(o)
  }
  // slow harmonic drift so the chord never sits perfectly still
  base.lfoTo(mix.gain, p.lfoRate, 0.12)
  base.lfoTo(oscs[1].detune, 0.021, p.detune * 0.9)
  base.lfoTo(oscs[2].detune, 0.017, 3)
  return base
}

export function createTextureVoice({ ctx, dest, noise, params: p, now }: VoiceOptions<TextureParams>): Voice {
  const base = createVoiceBase(ctx, dest, 3, p.level)

  if (p.mode === 'crackle') {
    let nextAt = now + 0.2
    runScheduler(base, () => {
      const until = ctx.currentTime + lookahead()
      while (nextAt < until) {
        const t = Math.max(nextAt, ctx.currentTime + 0.02)
        const pop = Math.random() < 0.05
        const dur = pop ? 0.03 : rand(0.003, 0.018)
        const src = noise.source('white', t, dur)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = pop ? rand(700, 1400) : rand(1000, 1200 + p.brightness * 2600)
        bp.Q.value = rand(0.8, 3)
        const g = ctx.createGain()
        const peak = (pop ? rand(0.03, 0.06) : rand(0.008, 0.035)) * 1
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(peak, t + 0.002)
        g.gain.exponentialRampToValueAtTime(0.0003, t + dur + 0.012)
        const dp = ctx.createStereoPanner()
        dp.pan.value = p.pan + rand(-0.4, 0.4)
        src.connect(bp)
        bp.connect(g)
        g.connect(dp)
        dp.connect(base.out)
        nextAt += Math.max(0.02, expovariate(p.density))
      }
    })
    return base
  }

  if (p.mode === 'shimmer') {
    let nextAt = now + 0.5
    runScheduler(base, () => {
      const until = ctx.currentTime + lookahead()
      while (nextAt < until) {
        const t = Math.max(nextAt, ctx.currentTime + 0.02)
        const f = p.root * pick(p.scale) * (Math.random() < p.brightness * 0.4 ? 2 : 1)
        const peak = rand(0.012, 0.032)
        for (const cents of [-2.5, 2.2]) {
          const o = ctx.createOscillator()
          o.type = 'sine'
          o.frequency.value = f
          o.detune.value = cents
          const g = ctx.createGain()
          g.gain.setValueAtTime(0, t)
          g.gain.linearRampToValueAtTime(peak / 2, t + 0.9)
          g.gain.setTargetAtTime(0, t + 1.1, 0.9)
          const dp = ctx.createStereoPanner()
          dp.pan.value = p.pan + rand(-0.6, 0.6)
          o.connect(g)
          g.connect(dp)
          dp.connect(base.out)
          o.start(t)
          o.stop(t + 4.6)
        }
        nextAt += rand(0.8, 12) * (1 / Math.max(0.05, p.density)) * 0.35
      }
    })
    return base
  }

  // choir — two detuned saws through formant bandpasses, breath modulated
  const mix = base.track(ctx.createGain())
  mix.gain.value = 1
  const saws: OscillatorNode[] = []
  for (const mult of [1, 1.006]) {
    const o = base.source(ctx.createOscillator())
    o.type = 'sawtooth'
    o.frequency.value = p.root * mult
    const g = base.track(ctx.createGain())
    g.gain.value = 0.028
    o.connect(g)
    g.connect(mix)
    o.start(now)
    saws.push(o)
  }
  const amp = base.track(ctx.createGain())
  amp.gain.value = 0.85
  for (const [freq, q, level] of [
    [480, 5, 1],
    [1080, 7, 0.45],
  ] as const) {
    const f = base.track(ctx.createBiquadFilter())
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = base.track(ctx.createGain())
    g.gain.value = level
    mix.connect(f)
    f.connect(g)
    g.connect(amp)
  }
  const lp = base.track(ctx.createBiquadFilter())
  lp.type = 'lowpass'
  lp.frequency.value = 1500
  const pan = base.track(ctx.createStereoPanner())
  pan.pan.value = p.pan
  amp.connect(lp)
  lp.connect(pan)
  pan.connect(base.out)
  base.lfoTo(amp.gain, 0.04 + p.density * 0.05, 0.3)
  base.lfoTo(saws[0].detune, 4.3, 3.5)
  base.lfoTo(saws[1].detune, 4.1, 2.8)
  return base
}

export function createPulseVoice({ ctx, dest, params: p, now }: VoiceOptions<PulseParams>): Voice {
  const base = createVoiceBase(ctx, dest, 1.8, p.level)
  const beat = 60 / p.bpm
  const cycleBeats = Math.max(...p.pattern.map((s) => s.t)) + 1
  const cycle = cycleBeats * beat
  let nextCycle = now + 0.2

  runScheduler(base, () => {
    const until = ctx.currentTime + lookahead()
    while (nextCycle < until) {
      for (const step of p.pattern) {
        const t = nextCycle + step.t * beat
        if (t < ctx.currentTime - 0.05) continue
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = p.root * step.ratio
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = p.filter
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.14 * step.level, t + 0.012)
        g.gain.setTargetAtTime(0, t + 0.03, p.decay / 3)
        const dp = ctx.createStereoPanner()
        dp.pan.value = p.pan + rand(-0.08, 0.08)
        o.connect(lp)
        lp.connect(g)
        g.connect(dp)
        dp.connect(base.out)
        o.start(t)
        o.stop(t + p.decay + 1)
      }
      nextCycle += cycle
    }
  })
  return base
}
