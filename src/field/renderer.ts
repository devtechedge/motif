import type { FieldMode, LayerId, Palette } from '../types'

export interface FieldInput {
  mode: FieldMode
  palette: Palette
  /** Effective level per layer, 0 when disabled. */
  layers: Record<LayerId, number>
  /** Overall mix intensity, 0..1. */
  intensity: number
  /** Tempo for pulse visuals. */
  bpm: number
  reduced: boolean
}

export interface FieldHandle {
  setInput(input: FieldInput): void
  destroy(): void
}

interface RGB {
  r: number
  g: number
  b: number
}

type PaletteRGB = Record<keyof Palette, RGB>

function hexRGB(hex: string): RGB {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

const rgba = (c: RGB, a: number) => `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => ({
  r: lerp(a.r, b.r, t),
  g: lerp(a.g, b.g, t),
  b: lerp(a.b, b.b, t),
})
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

interface Drop {
  x: number
  y: number
  landY: number
  len: number
  speed: number
  alpha: number
}

interface Ripple {
  x: number
  y: number
  r: number
  alpha: number
}

/**
 * The living center of the instrument. One canvas, five scene-specific
 * renderers sharing a breathing core glow, all modulated by the actual mix
 * and the master bus level coming back from the engine.
 */
export function createField(canvas: HTMLCanvasElement, sampleLevel: () => number): FieldHandle {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { setInput: () => {}, destroy: () => {} }

  let input: FieldInput | null = null
  let veil = 1 // scene-transition curtain, also the opening fade
  let mode: FieldMode = 'rain'
  let w = 0
  let h = 0
  let raf = 0
  let lastFrame = performance.now()
  let t = 0
  let level = 0
  let lastFullRender = 0
  let drops: Drop[] = []
  let ripples: Ripple[] = []
  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)

  function currentPalette(target: Palette): PaletteRGB {
    const out = {} as PaletteRGB
    const keys = Object.keys(target) as Array<keyof Palette>
    for (const k of keys) out[k] = hexRGB(target[k])
    return out
  }

  const palette: PaletteRGB = currentPalette({
    accent: '#8FC3E8',
    glow: '#6FA8D4',
    fieldA: '#0C1421',
    fieldB: '#131E2B',
    particle: '#C4E1F4',
  })

  function resize(): void {
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    w = rect.width
    h = rect.height
    seedDrops()
  }

  function seedDrops(): void {
    const count = 96
    drops = Array.from({ length: count }, () => spawnDrop(true))
    ripples = []
  }

  function spawnDrop(anywhere: boolean): Drop {
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -20 - Math.random() * h * 0.25,
      landY: h * (0.62 + Math.random() * 0.3),
      len: 10 + Math.random() * 18,
      speed: 220 + Math.random() * 200,
      alpha: 0.35 + Math.random() * 0.65,
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame)
    const rawDt = Math.min(0.05, (now - lastFrame) / 1000)
    lastFrame = now
    if (document.hidden || !input || w === 0) return
    if (input.reduced && now - lastFullRender < 120) return
    lastFullRender = now

    // ease the palette toward the scene's target
    const target = currentPalette(input.palette)
    for (const k of Object.keys(target) as Array<keyof Palette>) {
      palette[k] = lerpRGB(palette[k], target[k], 0.05)
    }

    level += (sampleLevel() - level) * 0.055
    const activity = clamp01(Math.max(level, input.intensity * 0.45))
    const motion = input.reduced ? 0.055 : 0.28 + 0.72 * activity
    const dim = 0.62 + 0.38 * activity
    const dt = rawDt * motion
    t += dt
    if (veil > 0) veil = Math.max(0, veil - rawDt / 0.85)

    const beatPhase = input.bpm > 0 ? (t * input.bpm) / 60 : 0

    // background
    const bg = ctx!.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, rgba(palette.fieldA, 1))
    bg.addColorStop(1, rgba(palette.fieldB, 1))
    ctx!.fillStyle = bg
    ctx!.fillRect(0, 0, w, h)

    switch (mode) {
      case 'rain':
        drawRain(dt, motion, dim, activity)
        break
      case 'tide':
        drawTide(dim, activity)
        break
      case 'moss':
        drawMoss(dim)
        break
      case 'dusk':
        drawDusk(dim)
        break
      case 'drift':
        drawDrift(dim, activity, beatPhase % 1)
        break
    }

    drawCoreGlow(dim, activity, beatPhase % 1)
    drawVignette()
    if (veil > 0.01) {
      ctx!.fillStyle = rgba(palette.fieldA, veil * 0.85)
      ctx!.fillRect(0, 0, w, h)
    }
  }

  // ------------------------------------------------------------ renderers

  function drawRain(dt: number, motion: number, dim: number, activity: number): void {
    const water = input!.layers.water
    const count = Math.floor(lerp(22, 92, clamp01(water * 1.2)))
    const slant = 0.14
    ctx!.lineCap = 'round'
    ctx!.strokeStyle = rgba(palette.particle, (0.3 + 0.42 * water) * dim)
    ctx!.lineWidth = 1.1
    ctx!.beginPath()
    for (let i = 0; i < count; i++) {
      const d = drops[i] ?? (drops[i] = spawnDrop(true))
      d.y += d.speed * dt
      if (d.y > d.landY) {
        if (!input!.reduced && ripples.length < 26 && Math.random() < 0.5) {
          ripples.push({ x: d.x, y: d.landY, r: 2, alpha: 0.6 })
        }
        Object.assign(d, spawnDrop(false))
        continue
      }
      ctx!.moveTo(d.x, d.y)
      ctx!.lineTo(d.x + d.len * slant, d.y + d.len)
    }
    ctx!.stroke()

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]
      rp.r += 30 * dt
      rp.alpha -= 0.45 * dt
      if (rp.alpha <= 0) {
        ripples.splice(i, 1)
        continue
      }
      ctx!.strokeStyle = rgba(palette.glow, rp.alpha * dim)
      ctx!.lineWidth = 1.2
      ctx!.beginPath()
      ctx!.ellipse(rp.x, rp.y, rp.r, rp.r * 0.26, 0, 0, Math.PI * 2)
      ctx!.stroke()
    }

    const fog = ctx!.createLinearGradient(0, h * 0.62, 0, h)
    fog.addColorStop(0, rgba(palette.particle, 0))
    fog.addColorStop(1, rgba(palette.particle, (0.06 + 0.12 * activity) * dim))
    ctx!.fillStyle = fog
    ctx!.fillRect(0, h * 0.62, w, h * 0.38)
    void motion
  }

  function drawTide(dim: number, activity: number): void {
    const water = input!.layers.water
    ctx!.lineWidth = 1.2
    for (let i = 0; i < 7; i++) {
      const y0 = h * (0.44 + i * 0.082)
      const amp = (3 + i * 2.4) * (0.45 + water * 0.9)
      const phase = t * (0.22 + i * 0.055) + i * 1.7
      ctx!.beginPath()
      for (let x = 0; x <= w; x += 14) {
        const y = y0 + Math.sin(x * 0.011 + phase) * amp + Math.sin(x * 0.004 - phase * 0.6) * amp * 0.5
        if (x === 0) ctx!.moveTo(x, y)
        else ctx!.lineTo(x, y)
      }
      ctx!.strokeStyle = rgba(palette.glow, (0.1 + 0.16 * water) * (1 - i * 0.1) * dim)
      ctx!.stroke()
    }
    // the moon and its companion
    const cx = w * 0.72 + Math.sin(t * 0.05) * w * 0.018
    const cy = h * 0.27 + Math.cos(t * 0.04) * 5
    const halo = ctx!.createRadialGradient(cx, cy, 4, cx, cy, 70)
    halo.addColorStop(0, rgba(palette.glow, 0.4 * dim))
    halo.addColorStop(1, rgba(palette.glow, 0))
    ctx!.fillStyle = halo
    ctx!.fillRect(cx - 64, cy - 64, 128, 128)
    ctx!.fillStyle = rgba(palette.particle, 0.85 * dim)
    ctx!.beginPath()
    ctx!.arc(cx, cy, 20, 0, Math.PI * 2)
    ctx!.fill()
    const ang = t * 0.22
    ctx!.fillStyle = rgba(palette.particle, 0.45 * dim)
    ctx!.beginPath()
    ctx!.arc(cx + Math.cos(ang) * 44, cy + Math.sin(ang) * 44 * 0.5, 2.2, 0, Math.PI * 2)
    ctx!.fill()
    // starfield shimmer on the water
    for (let i = 0; i < 26; i++) {
      const sx = ((i * 137.5) % 100) / 100 * w
      const sy = ((i * 73.7) % 100) / 100 * h
      const tw = Math.sin(t * 1.8 + i * 2.4)
      if (tw <= 0) continue
      ctx!.fillStyle = rgba(palette.particle, tw * tw * 0.34 * dim * (0.5 + activity * 0.5))
      ctx!.fillRect(sx, sy, 1.4, 1.4)
    }
  }

  function drawMoss(dim: number): void {
    const air = input!.layers.air
    const texture = input!.layers.texture
    // light shafts through a canopy
    for (let i = 0; i < 4; i++) {
      const bx = w * (0.14 + i * 0.24) + Math.sin(t * 0.05 + i * 2) * 10
      const topW = w * 0.012
      const botW = w * 0.085
      const breath = 0.6 + 0.4 * Math.sin(t * 0.08 + i * 1.7)
      const g = ctx!.createLinearGradient(0, 0, 0, h * 0.85)
      g.addColorStop(0, rgba(palette.glow, (0.14 + 0.12 * air) * breath * dim))
      g.addColorStop(1, rgba(palette.glow, 0))
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.moveTo(bx - topW, 0)
      ctx!.lineTo(bx + topW, 0)
      ctx!.lineTo(bx + botW, h * 0.85)
      ctx!.lineTo(bx - botW, h * 0.85)
      ctx!.closePath()
      ctx!.fill()
    }
    // rising spores
    const count = Math.floor(lerp(18, 64, texture))
    for (let i = 0; i < count; i++) {
      const seed = (i * 127.1) % 1000
      const speed = 7 + (seed % 13)
      const px = ((seed * 7.3) % w) + Math.sin(t * 0.4 + seed) * 14
      const py = h - (((seed * 3.1 + t * speed) % (h + 30)) - 15)
      const tw = 0.5 + 0.5 * Math.sin(t * 0.9 + seed)
      ctx!.fillStyle = rgba(palette.particle, (0.14 + 0.4 * texture) * tw * dim)
      ctx!.beginPath()
      ctx!.arc(px, py, 0.9 + (seed % 10) / 9, 0, Math.PI * 2)
      ctx!.fill()
    }
    // ground mist
    const mist = ctx!.createLinearGradient(0, h * 0.7, 0, h)
    mist.addColorStop(0, rgba(palette.particle, 0))
    mist.addColorStop(1, rgba(palette.particle, 0.1 * dim))
    ctx!.fillStyle = mist
    ctx!.fillRect(0, h * 0.7, w, h * 0.3)
  }

  function drawDusk(dim: number): void {
    // sky bands slowly trading places
    for (let i = 0; i < 5; i++) {
      const y = (h * 0.72 * i) / 5
      const bh = (h * 0.72) / 5 + 1
      const mix = i / 4 + 0.03 * Math.sin(t * 0.05 + i)
      const c = lerpRGB(palette.fieldA, palette.fieldB, clamp01(mix))
      ctx!.fillStyle = rgba(c, 0.85)
      ctx!.fillRect(0, y, w, bh)
    }
    // arriving stars
    const texture = input!.layers.texture
    for (let i = 0; i < 44; i++) {
      const seed = (i * 91.7) % 1000
      const sx = ((seed * 11.3) % w + t * 2.2 * (0.3 + (seed % 7) / 14)) % w
      const sy = ((seed * 5.1) % (h * 0.55))
      const tw = Math.sin(t * (0.8 + (seed % 5) * 0.22) + seed)
      if (tw <= 0.1) continue
      ctx!.fillStyle = rgba(palette.particle, tw * tw * (0.18 + 0.45 * texture) * dim)
      ctx!.beginPath()
      ctx!.arc(sx, sy, 0.8 + (seed % 6) * 0.22, 0, Math.PI * 2)
      ctx!.fill()
    }
    // a thin crescent
    const cx = w * 0.3
    const cy = h * 0.32
    ctx!.strokeStyle = rgba(palette.particle, 0.5 * dim)
    ctx!.lineWidth = 1.4
    ctx!.beginPath()
    ctx!.arc(cx, cy, 13, Math.PI * 0.25, Math.PI * 1.45)
    ctx!.stroke()
    // last light on the horizon
    const glow = ctx!.createRadialGradient(w * 0.5, h * 0.82, 8, w * 0.5, h * 0.82, w * 0.5)
    glow.addColorStop(0, rgba(palette.glow, 0.3 * dim))
    glow.addColorStop(1, rgba(palette.glow, 0))
    ctx!.fillStyle = glow
    ctx!.fillRect(0, h * 0.5, w, h * 0.5)
  }

  function drawDrift(dim: number, activity: number, beat: number): void {
    const pulse = input!.layers.pulse
    const horizon = h * 0.62
    // road grid
    ctx!.strokeStyle = rgba(palette.accent, 0.05 * dim)
    ctx!.lineWidth = 1
    for (let i = -4; i <= 4; i++) {
      ctx!.beginPath()
      ctx!.moveTo(w * 0.5 + i * 14, horizon)
      ctx!.lineTo(w * 0.5 + i * (w * 0.13), h)
      ctx!.stroke()
    }
    for (let i = 0; i < 5; i++) {
      const p = ((i + (t * 0.14) % 1) / 5) ** 2.2
      ctx!.beginPath()
      ctx!.moveTo(0, horizon + p * (h - horizon))
      ctx!.lineTo(w, horizon + p * (h - horizon))
      ctx!.stroke()
    }
    ctx!.strokeStyle = rgba(palette.accent, 0.09 * dim)
    ctx!.beginPath()
    ctx!.moveTo(0, horizon)
    ctx!.lineTo(w, horizon)
    ctx!.stroke()
    // glowing orbs drifting past
    for (let i = 0; i < 8; i++) {
      const seed = (i * 83.3) % 1000
      const r = 12 + (seed % 30) + (seed % 7)
      const speed = 6 + (seed % 16)
      const span = w + r * 4
      const ox = ((seed * 13.7) % span + t * speed) % span - r * 2
      const oy = h * (0.12 + ((seed * 3.7) % 45) / 100) + Math.sin(t * 0.3 + seed) * 8
      const beatAmp = pulse > 0 ? 1 + pulse * 0.25 * (1 - beat) : 1
      const g = ctx!.createRadialGradient(ox, oy, 1, ox, oy, r * beatAmp)
      g.addColorStop(0, rgba(palette.particle, (0.22 + 0.2 * activity) * dim))
      g.addColorStop(0.35, rgba(palette.glow, (0.14 + 0.18 * activity) * dim))
      g.addColorStop(1, rgba(palette.glow, 0))
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(ox, oy, r * beatAmp, 0, Math.PI * 2)
      ctx!.fill()
    }
    // pulse rings rising from the road
    if (pulse > 0.02) {
      const maxR = Math.min(w, h) * 0.55
      const rr = beat * maxR
      ctx!.strokeStyle = rgba(palette.accent, (1 - beat) * 0.22 * pulse * dim)
      ctx!.lineWidth = 1.4
      ctx!.beginPath()
      ctx!.ellipse(w * 0.5, horizon + 14, rr, rr * 0.3, 0, 0, Math.PI * 2)
      ctx!.stroke()
    }
    // warm city wash
    const wash = ctx!.createLinearGradient(0, horizon, 0, h)
    wash.addColorStop(0, rgba(palette.glow, 0.02 * dim))
    wash.addColorStop(1, rgba(palette.glow, 0.08 * dim))
    ctx!.fillStyle = wash
    ctx!.fillRect(0, horizon, w, h - horizon)
  }

  function drawCoreGlow(dim: number, activity: number, beat: number): void {
    const drone = input!.layers.drone
    const pulse = input!.layers.pulse
    const beatAmp = pulse > 0 ? pulse * 0.08 * (1 - beat) : 0
    const r = Math.min(w, h) * (0.34 + drone * 0.14 + activity * 0.08 + beatAmp) * (1 + 0.04 * Math.sin(t * 0.32))
    const cx = w * 0.5
    const cy = h * 0.44
    ctx!.globalCompositeOperation = 'lighter'
    const g = ctx!.createRadialGradient(cx, cy, 2, cx, cy, r)
    g.addColorStop(0, rgba(palette.glow, (0.2 + drone * 0.3 + activity * 0.18) * dim))
    g.addColorStop(0.5, rgba(palette.glow, (0.06 + drone * 0.1) * dim))
    g.addColorStop(1, rgba(palette.glow, 0))
    ctx!.fillStyle = g
    ctx!.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx!.globalCompositeOperation = 'source-over'
  }

  function drawVignette(): void {
    const g = ctx!.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.46, w * 0.5, h * 0.5, Math.max(w, h) * 0.78)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.3)')
    ctx!.fillStyle = g
    ctx!.fillRect(0, 0, w, h)
  }

  raf = requestAnimationFrame(frame)

  return {
    setInput(next: FieldInput) {
      const modeChanged = input !== null && next.mode !== input.mode
      input = next
      if (modeChanged) veil = 1
      mode = next.mode
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
    },
  }
}
