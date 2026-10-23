/** Shared noise buffers for the whole graph. Generated once per AudioContext. */
export class NoiseBank {
  readonly white: AudioBuffer
  readonly pink: AudioBuffer

  constructor(private ctx: BaseAudioContext) {
    this.white = this.build(2, (data) => {
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    })
    this.pink = this.build(4, (data) => {
      // Paul Kellet's pink noise approximation
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.969 * b2 + w * 0.153852
        b3 = 0.8665 * b3 + w * 0.3104856
        b4 = 0.55 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.016898
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
      }
    })
  }

  private build(seconds: number, fill: (data: Float32Array) => void): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    fill(buf.getChannelData(0))
    return buf
  }

  /** A looping buffer source started at `when` with a randomised offset, so
   *  multiple consumers of the same buffer never correlate. */
  source(kind: 'white' | 'pink', when: number, duration?: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource()
    src.buffer = kind === 'white' ? this.white : this.pink
    src.loop = true
    const offset = Math.random() * (src.buffer.duration - 0.25)
    src.start(when, offset)
    if (duration !== undefined) src.stop(when + duration + 0.08)
    return src
  }
}
