/**
 * A compact Web Audio fake precise enough to test AudioEngine lifecycle:
 * schedulable AudioParams with real envelope evaluation, a manually advanced
 * clock, transition-fired onstatechange, and interval accounting through a
 * stubbed window so scheduler leaks are detectable.
 */

export class FakeAudioParam {
  private events: Array<{
    t: number
    type: 'set' | 'linear' | 'exp' | 'target'
    value: number
    timeConstant?: number
  }> = []

  constructor(public intrinsicValue: number = 0) {}

  get value(): number {
    return this.events.length === 0 ? this.intrinsicValue : this.getValueAt(0)
  }

  set value(v: number) {
    this.intrinsicValue = v
  }

  setValueAtTime(value: number, time: number): this {
    this.events.push({ t: time, type: 'set', value })
    return this
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ t: time, type: 'linear', value })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.events.push({ t: time, type: 'exp', value })
    return this
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.events.push({ t: time, type: 'target', value, timeConstant })
    return this
  }

  cancelScheduledValues(time: number): this {
    this.events = this.events.filter((e) => e.t < time)
    return this
  }

  /**
   * Replays the automation timeline and evaluates the value at `t`.
   * setTargetAtTime decays from the value it inherited toward its target,
   * and keeps decaying until the next event's start time.
   */
  getValueAt(t: number): number {
    const sorted = [...this.events].sort((a, b) => a.t - b.t)
    let value = this.intrinsicValue
    let lastT = 0
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i]
      if (e.t > t) {
        // the query falls inside this event's span
        if (e.type === 'linear') {
          const span = e.t - lastT
          return span > 0 ? value + (e.value - value) * ((t - lastT) / span) : e.value
        }
        return value
      }
      if (e.type === 'target') {
        const nextT = i + 1 < sorted.length ? sorted[i + 1].t : t
        const until = Math.min(nextT, t)
        if (until > e.t) {
          value = e.value + (value - e.value) * Math.exp(-(until - e.t) / (e.timeConstant ?? 1))
        }
        lastT = until
      } else {
        value = e.value
        lastT = e.t
      }
    }
    return value
  }
}

export class FakeNode {
  connections: FakeNode[] = []
  connect(node: FakeNode): FakeNode {
    this.connections.push(node)
    return node
  }
  disconnect(): void {
    this.connections = []
  }
}

export class FakeGainNode extends FakeNode {
  gain = new FakeAudioParam(1)
}

export class FakeBiquadFilterNode extends FakeNode {
  frequency = new FakeAudioParam(350)
  Q = new FakeAudioParam(1)
  detune = new FakeAudioParam(0)
  constructor(public type: BiquadFilterType = 'lowpass') {
    super()
  }
}

export class FakeOscillatorNode extends FakeNode {
  frequency = new FakeAudioParam(440)
  detune = new FakeAudioParam(0)
  started = false
  startAt: number | null = null
  stopAt: number | null = null
  constructor(public type: OscillatorType = 'sine') {
    super()
  }
  start(when = 0): void {
    this.started = true
    this.startAt = when
  }
  stop(when = 0): void {
    this.stopAt = when
  }
}

export class FakeBufferSourceNode extends FakeNode {
  buffer: FakeAudioBuffer | null = null
  loop = false
  started = false
  startAt: number | null = null
  stopAt: number | null = null
  startOffset: number | null = null
  start(when = 0, offset?: number): void {
    this.started = true
    this.startAt = when
    this.startOffset = offset ?? null
  }
  stop(when = 0): void {
    this.stopAt = when
  }
}

export class FakeStereoPannerNode extends FakeNode {
  pan = new FakeAudioParam(0)
}

export class FakeDelayNode extends FakeNode {
  delayTime = new FakeAudioParam(0)
}

export class FakeDynamicsCompressorNode extends FakeNode {
  threshold = { value: -24 }
  knee = { value: 30 }
  ratio = { value: 12 }
  attack = { value: 0.003 }
  release = { value: 0.25 }
}

export class FakeAnalyserNode extends FakeNode {
  fftSize = 2048
  smoothingTimeConstant = 0.8
  getFloatTimeDomainData(array: Float32Array): void {
    array.fill(0)
  }
}

export class FakeAudioBuffer {
  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number,
  ) {}
  getChannelData(): Float32Array {
    return new Float32Array(this.length)
  }
}

export class FakeAudioContext {
  currentTime = 0
  state: AudioContextState = 'suspended'
  onstatechange: (() => void) | null = null
  readonly destination = new FakeNode()
  /** Every gain node in creation order; ensureContext makes [master, chime, ...buses]. */
  readonly gains: FakeGainNode[] = []
  readonly counters = {
    gain: 0,
    oscillator: 0,
    bufferSource: 0,
    filter: 0,
    panner: 0,
    delay: 0,
    compressor: 0,
    analyser: 0,
    buffer: 0,
  }

  private transition(next: AudioContextState): void {
    this.state = next
    this.onstatechange?.()
  }

  async resume(): Promise<void> {
    this.transition('running')
  }

  async suspend(): Promise<void> {
    this.transition('suspended')
  }

  async close(): Promise<void> {
    this.state = 'closed'
  }

  /** Manual clock advance; a suspended context's clock is frozen, like the real one. */
  tick(seconds: number): void {
    if (this.state !== 'running') return
    this.currentTime += seconds
  }

  createGain(): FakeGainNode {
    this.counters.gain++
    const g = new FakeGainNode()
    this.gains.push(g)
    return g
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    this.counters.filter++
    return new FakeBiquadFilterNode()
  }

  createOscillator(): FakeOscillatorNode {
    this.counters.oscillator++
    return new FakeOscillatorNode()
  }

  createBufferSource(): FakeBufferSourceNode {
    this.counters.bufferSource++
    return new FakeBufferSourceNode()
  }

  createStereoPanner(): FakeStereoPannerNode {
    this.counters.panner++
    return new FakeStereoPannerNode()
  }

  createDelay(): FakeDelayNode {
    this.counters.delay++
    return new FakeDelayNode()
  }

  createDynamicsCompressor(): FakeDynamicsCompressorNode {
    this.counters.compressor++
    return new FakeDynamicsCompressorNode()
  }

  createAnalyser(): FakeAnalyserNode {
    this.counters.analyser++
    return new FakeAnalyserNode()
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeAudioBuffer {
    this.counters.buffer++
    return new FakeAudioBuffer(channels, length, sampleRate)
  }
}
