import { layerGainCurve, masterCurve } from '../lib/gain'
import type { LayerId, LayerMix, Scene } from '../types'
import { LAYER_IDS } from '../types'
import { NoiseBank } from './noise'
import {
  createAirVoice,
  createDroneVoice,
  createPulseVoice,
  createTextureVoice,
  createWaterVoice,
  type Voice,
} from './voices'

/**
 * Owns the entire Web Audio graph. Created lazily on the first user gesture —
 * never at module load — so browsers never see an autoplay attempt.
 *
 * Graph: [voices] -> layer bus (user mix) -> master (volume/mute) -> compressor -> destination
 *                                                                  -> analyser (visuals)
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private noise: NoiseBank | null = null
  private master: GainNode | null = null
  private analyser: AnalyserNode | null = null
  /** Completion chime path: respects volume and mute, but not the session fade. */
  private chimeBus: GainNode | null = null
  private levelBuf = new Float32Array(512)
  private buses = new Map<LayerId, GainNode>()
  private voices: Voice[] = []
  private scene: Scene | null = null
  private mix: LayerMix | null = null
  private volume = 0.75
  private muted = false
  private _playing = false
  private startedAt = 0
  private elapsedBase = 0
  private needsBuild = true
  private timers: number[] = []
  /** Monotonic sequence guarding async play(): a stale resume must not build. */
  private playSeq = 0
  /** Called when the system suspends the context out from under us (calls, interruptions). */
  onExternalSuspend: (() => void) | null = null

  /**
   * `ctxFactory` exists for tests: production passes nothing and the context
   * is created lazily on the first play, from a user gesture.
   */
  constructor(private readonly ctxFactory?: () => AudioContext) {}

  get supported(): boolean {
    return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined'
  }

  get playing(): boolean {
    return this._playing
  }

  /** Number of live voice instances; should stay constant across scene changes. */
  get voiceCount(): number {
    return this.voices.length
  }

  /** Observability for tests: a layer bus gain parameter. */
  layerBusParam(id: LayerId): AudioParam | null {
    return this.buses.get(id)?.gain ?? null
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = this.ctxFactory ? this.ctxFactory() : new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -21
    comp.knee.value = 18
    comp.ratio.value = 2.6
    comp.attack.value = 0.012
    comp.release.value = 0.3
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.8
    master.connect(comp)
    comp.connect(ctx.destination)
    master.connect(analyser)
    const chimeBus = ctx.createGain()
    chimeBus.gain.value = 0
    chimeBus.connect(comp)
    for (const id of LAYER_IDS) {
      const bus = ctx.createGain()
      bus.gain.value = 0
      bus.connect(master)
      this.buses.set(id, bus)
    }
    this.noise = new NoiseBank(ctx)
    this.master = master
    this.analyser = analyser
    this.chimeBus = chimeBus
    this.levelBuf = new Float32Array(analyser.fftSize)
    this.ctx = ctx
    ctx.onstatechange = () => {
      if (ctx.state === 'suspended' && this._playing) {
        this.elapsedBase += ctx.currentTime - this.startedAt
        this._playing = false
        this.onExternalSuspend?.()
      }
    }
    return ctx
  }

  // ------------------------------------------------------------- transport

  async play(): Promise<void> {
    if (!this.supported) throw new Error('Web Audio is not supported in this browser')
    const ctx = this.ensureContext()
    const seq = ++this.playSeq
    if (ctx.state !== 'running') await ctx.resume()
    if (seq !== this.playSeq) return // superseded by a later play, pause, stop, or completion
    if (this.needsBuild || this.voices.length === 0) this.build()
    this._playing = true
    this.startedAt = ctx.currentTime
    this.rampMaster(0.9)
  }

  pause(): void {
    this.playSeq++
    if (!this.ctx || !this._playing) return
    this.elapsedBase += this.ctx.currentTime - this.startedAt
    this._playing = false
    this.rampMaster(0.14)
    this.later(480, () => {
      if (!this._playing && this.ctx?.state === 'running') void this.ctx.suspend()
    })
  }

  stop(): void {
    this.playSeq++
    this.elapsedBase = 0
    this._playing = false
    if (this.ctx) {
      this.rampMaster(0.12)
      this.disposeVoices(false)
      this.needsBuild = true
      this.later(500, () => {
        if (!this._playing && this.ctx?.state === 'running') void this.ctx.suspend()
      })
    }
  }

  /**
   * Reliable session completion, owned by the engine so React state can never
   * diverge from the audio lifecycle: cancel the fade, ramp to exact silence,
   * freeze elapsed at the final value, retire voices (a later play rebuilds),
   * and ring the completion chime through a path that respects volume + mute
   * but not the just-faded master.
   */
  completeSession(finalElapsed: number): void {
    this.playSeq++
    if (!this.ctx) return
    const t = this.ctx.currentTime
    if (this.master) {
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(0, t, 0.04)
    }
    this.elapsedBase = finalElapsed
    this._playing = false
    this.disposeVoices(false)
    this.needsBuild = true
    this.chime()
  }

  /** Called after the chime has rung: full teardown unless playback restarted. */
  finalizeAfterChime(): void {
    if (this._playing) return
    this.stop()
  }

  /** Cancels a session fade and restores the normal master target. */
  restoreMaster(): void {
    if (!this.ctx || !this.master) return
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.rampMaster(0.12)
  }

  /**
   * Long fade used by the session timer. Time constant is fade/6 so the
   * output is about 52 dB down (e^-6) at the nominal end of the interval,
   * rather than merely 26 dB down with the more common fade/3 choice.
   * The caller decides what happens at the end.
   */
  beginFade(seconds: number): void {
    if (!this.ctx || !this.master) return
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, Math.max(0.05, seconds / 6))
  }

  /** Quiet two-note completion bell. Respects mute and master volume. */
  chime(): void {
    if (!this.ctx || !this.chimeBus || this.muted) return
    const t = this.ctx.currentTime + 0.05
    this.chimeBus.gain.setTargetAtTime(masterCurve(this.volume), t, 0.01)
    for (const [freq, at] of [
      [523.25, 0],
      [659.25, 0.42],
    ] as const) {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0, t + at)
      g.gain.linearRampToValueAtTime(0.055, t + at + 0.06)
      g.gain.setTargetAtTime(0, t + at + 0.35, 0.55)
      o.connect(g)
      g.connect(this.chimeBus)
      o.start(t + at)
      o.stop(t + at + 2.5)
    }
  }

  // -------------------------------------------------------------- settings

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v))
    this.rampMaster(0.1)
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.rampMaster(m ? 0.03 : 0.1)
  }

  get isMuted(): boolean {
    return this.muted
  }

  setScene(scene: Scene, mix: LayerMix): void {
    this.scene = scene
    this.mix = mix
    if (this.ctx && this._playing) {
      // crossfade: old voices fade out on their own, new voices fade in
      this.disposeVoices(false)
      this.build()
    } else {
      this.disposeVoices(true)
      this.needsBuild = true
    }
    this.applyMix()
  }

  setLayer(id: LayerId, state: { enabled: boolean; gain: number }): void {
    if (!this.mix) return
    this.mix[id] = { ...state }
    this.applyMix()
  }

  applyMix(): void {
    if (!this.ctx || !this.mix) return
    const t = this.ctx.currentTime
    for (const id of LAYER_IDS) {
      const bus = this.buses.get(id)
      const s = this.mix[id]
      if (!bus || !s) continue
      const target = s.enabled ? layerGainCurve(s.gain) : 0
      bus.gain.setTargetAtTime(target, t, 0.09)
    }
  }

  // ------------------------------------------------------------ inspection

  /** Smoothed RMS of the master bus, 0..1 — feeds the visual field. */
  getLevel(): number {
    if (!this.analyser) return 0
    this.analyser.getFloatTimeDomainData(this.levelBuf)
    let sum = 0
    for (let i = 0; i < this.levelBuf.length; i++) sum += this.levelBuf[i] * this.levelBuf[i]
    return Math.min(1, Math.sqrt(sum / this.levelBuf.length) * 3.2)
  }

  getNow(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  getElapsed(): number {
    if (!this.ctx) return 0
    return this._playing ? this.elapsedBase + this.ctx.currentTime - this.startedAt : this.elapsedBase
  }

  // -------------------------------------------------------------- internal

  private build(): void {
    if (!this.ctx || !this.scene || !this.mix || !this.noise) return
    const now = this.ctx.currentTime
    const opts = (id: LayerId) => ({
      ctx: this.ctx!,
      dest: this.buses.get(id)!,
      noise: this.noise!,
      now,
    })
    const a = this.scene.audio
    this.voices.push(
      createAirVoice({ ...opts('air'), params: a.air }),
      createWaterVoice({ ...opts('water'), params: a.water }),
      createDroneVoice({ ...opts('drone'), params: a.drone }),
      createTextureVoice({ ...opts('texture'), params: a.texture }),
      createPulseVoice({ ...opts('pulse'), params: a.pulse }),
    )
    this.applyMix()
    this.needsBuild = false
  }

  private disposeVoices(hard: boolean): void {
    for (const v of this.voices) v.dispose(hard)
    this.voices = []
  }

  private rampMaster(timeConstant: number): void {
    if (!this.ctx || !this.master) return
    const target = this._playing && !this.muted ? masterCurve(this.volume) : 0
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, timeConstant)
  }

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id)
      fn()
    }, ms)
    this.timers.push(id)
  }

  dispose(): void {
    this._playing = false
    this.playSeq++
    for (const id of this.timers) window.clearTimeout(id)
    this.timers = []
    this.disposeVoices(true)
    this.buses.clear()
    if (this.ctx) {
      const ctx = this.ctx
      this.ctx = null
      this.master = null
      this.analyser = null
      this.chimeBus = null
      void ctx.close().catch(() => {})
    }
  }
}
