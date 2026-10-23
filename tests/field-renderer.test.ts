import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { FieldInput } from '../src/field/renderer'

/**
 * The renderer targets a real 2D context in the browser; here we drive it
 * against a recording stub to prove the loop draws, reacts to the mix,
 * and never throws — independent of any browser window being visible.
 */

interface DrawCall {
  op: string
  style?: string
  alpha?: number
  x?: number
  y?: number
  w?: number
  h?: number
}

class GradientStub {
  stops: Array<[number, string]> = []
  addColorStop(offset: number, color: string) {
    this.stops.push([offset, color])
  }
}

class ContextStub {
  fillStyle = ''
  strokeStyle = ''
  lineWidth = 1
  lineCap = ''
  globalCompositeOperation = 'source-over'
  calls: DrawCall[] = []

  setTransform() {
    this.calls.push({ op: 'setTransform' })
  }
  createLinearGradient() {
    return new GradientStub()
  }
  createRadialGradient() {
    return new GradientStub()
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.calls.push({ op: 'fillRect', style: String(this.fillStyle), x, y, w, h })
  }
  beginPath() {
    this.calls.push({ op: 'beginPath' })
  }
  moveTo(x: number, y: number) {
    this.calls.push({ op: 'moveTo', x, y })
  }
  lineTo(x: number, y: number) {
    this.calls.push({ op: 'lineTo', x, y })
  }
  closePath() {
    this.calls.push({ op: 'closePath' })
  }
  stroke() {
    this.calls.push({ op: 'stroke', style: String(this.strokeStyle) })
  }
  fill() {
    this.calls.push({ op: 'fill', style: String(this.fillStyle) })
  }
  arc() {
    this.calls.push({ op: 'arc', style: String(this.fillStyle) })
  }
  ellipse() {
    this.calls.push({ op: 'ellipse', style: String(this.strokeStyle) })
  }
  getImageData() {
    throw new Error('not needed')
  }
}

function alphaOf(style: string): number {
  const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(style)
  return m ? Number(m[1]) : 1
}

const WIDTH = 800
const HEIGHT = 500

function stubPage() {
  const ctx = new ContextStub()
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: WIDTH, height: HEIGHT, x: 0, y: 0, top: 0, left: 0, right: WIDTH, bottom: HEIGHT }),
  }
  const rafQueue: Array<(now: number) => void> = []
  const observers: Array<{ observe: () => void; disconnect: () => void }> = []
  const g = globalThis as Record<string, unknown>
  const originals = {
    document: g.document,
    window: g.window,
    requestAnimationFrame: g.requestAnimationFrame,
    cancelAnimationFrame: g.cancelAnimationFrame,
    ResizeObserver: g.ResizeObserver,
  }
  const fakeDocument = { hidden: false }
  const fakeWindow = { devicePixelRatio: 2, setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) }
  g.document = fakeDocument
  g.window = fakeWindow
  g.requestAnimationFrame = (cb: (now: number) => void) => {
    rafQueue.push(cb)
    return rafQueue.length
  }
  g.cancelAnimationFrame = () => {}
  g.ResizeObserver = class {
    constructor(private cb: () => void) {}
    observe() {
      observers.push(this as unknown as { observe: () => void; disconnect: () => void })
      this.cb()
    }
    disconnect() {}
  }
  return {
    ctx,
    canvas,
    rafQueue,
    restore() {
      g.document = originals.document
      g.window = originals.window
      g.requestAnimationFrame = originals.requestAnimationFrame
      g.cancelAnimationFrame = originals.cancelAnimationFrame
      g.ResizeObserver = originals.ResizeObserver
    },
  }
}

function input(over: Partial<FieldInput> = {}): FieldInput {
  return {
    mode: 'rain',
    palette: {
      accent: '#8FC3E8',
      glow: '#6FA8D4',
      fieldA: '#0C1421',
      fieldB: '#131E2B',
      particle: '#C4E1F4',
    },
    layers: { air: 0.3, water: 0.6, drone: 0, texture: 0.2, pulse: 0 },
    intensity: 0.25,
    bpm: 60,
    reduced: false,
    ...over,
  }
}

async function loadRenderer() {
  const mod = await import('../src/field/renderer')
  return mod.createField
}

describe('field renderer', () => {
  let page: ReturnType<typeof stubPage>

  beforeEach(() => {
    page = stubPage()
  })

  afterEach(() => {
    page.restore()
  })

  it('draws a background and visible rain every frame', async () => {
    const createField = await loadRenderer()
    const field = createField(page.canvas as unknown as HTMLCanvasElement, () => 0.4)
    field.setInput(input())
    for (let i = 0; i < 8; i++) {
      const cb = page.rafQueue.shift()!
      cb(1000 + i * 16)
    }
    const fills = page.ctx.calls.filter((c) => c.op === 'fillRect')
    expect(fills.length).toBeGreaterThan(4)
    const strokes = page.ctx.calls.filter((c) => c.op === 'stroke')
    const rainStrokes = strokes.filter((s) => alphaOf(s.style!) > 0.2)
    expect(rainStrokes.length).toBeGreaterThan(0)
    field.destroy()
  })

  it('scales rain density with the water layer level', async () => {
    const createField = await loadRenderer()
    const field = createField(page.canvas as unknown as HTMLCanvasElement, () => 0)
    const countSegments = () => page.ctx.calls.filter((c) => c.op === 'moveTo').length
    const measure = (layers: FieldInput['layers']) => {
      page.ctx.calls.length = 0
      field.setInput(input({ layers }))
      for (let i = 0; i < 6; i++) page.rafQueue.shift()!(2000 + i * 16)
      return countSegments()
    }
    const quiet = measure({ air: 0.3, water: 0.05, drone: 0, texture: 0, pulse: 0 })
    const heavy = measure({ air: 0.3, water: 0.95, drone: 0, texture: 0, pulse: 0 })
    expect(heavy).toBeGreaterThan(quiet)
    field.destroy()
  })

  it('runs every mode without throwing', async () => {
    const createField = await loadRenderer()
    const field = createField(page.canvas as unknown as HTMLCanvasElement, () => 0.2)
    for (const mode of ['rain', 'tide', 'moss', 'dusk', 'drift'] as const) {
      expect(() => field.setInput(input({ mode }))).not.toThrow()
      for (let i = 0; i < 6; i++) page.rafQueue.shift()!(3000 + i * 16)
    }
    expect(page.ctx.calls.length).toBeGreaterThan(0)
    field.destroy()
  })

  it('transitions palettes toward the scene target over frames', async () => {
    const createField = await loadRenderer()
    const field = createField(page.canvas as unknown as HTMLCanvasElement, () => 0.1)
    field.setInput(
      input({
        palette: {
          accent: '#F0975A',
          glow: '#E8905C',
          fieldA: '#140D0B',
          fieldB: '#221310',
          particle: '#FFD9A8',
        },
      }),
    )
    const bgAt = (frame: number) => {
      for (let i = 0; i < frame; i++) page.rafQueue.shift()!(4000 + i * 16)
      const bg = [...page.ctx.calls].reverse().find((c) => c.op === 'fillRect' && c.style?.startsWith('rgba('))
      return bg?.style ?? ''
    }
    const early = bgAt(2)
    // pump many frames so the lerp converges toward the warm palette
    for (let i = 0; i < 300; i++) {
      const cb = page.rafQueue.shift()
      if (!cb) break
      cb(10_000 + i * 16)
    }
    const late = [...page.ctx.calls].reverse().find((c) => c.op === 'fillRect' && c.style?.startsWith('rgba('))?.style ?? ''
    expect(early).not.toBe(late)
    const redChannel = (s: string) => Number(/rgba\((\d+)/.exec(s)?.[1] ?? 0)
    expect(redChannel(late)).toBeGreaterThan(redChannel(early))
    field.destroy()
  })

  it('skips work while the document is hidden', async () => {
    const createField = await loadRenderer()
    ;(globalThis.document as { hidden: boolean }).hidden = true
    const field = createField(page.canvas as unknown as HTMLCanvasElement, () => 0.3)
    field.setInput(input())
    page.ctx.calls.length = 0
    for (let i = 0; i < 4; i++) page.rafQueue.shift()!(5000 + i * 16)
    expect(page.ctx.calls.length).toBe(0)
    field.destroy()
  })
})
