import { useEffect, useRef, useState } from 'react'
import type { LayerMix, Scene, TimerKind } from '../types'
import { effectiveLayerLevel, mixIntensity } from '../lib/gain'
import { createField, type FieldHandle } from '../field/renderer'
import { PauseIcon, PlayIcon, TimerIcon } from './icons'
import { formatClock } from '../lib/format'

interface SoundFieldProps {
  scene: Scene
  playing: boolean
  muted: boolean
  mix: LayerMix
  timerKind: TimerKind
  remaining: number
  hasEverPlayed: boolean
  audioError: string | null
  onTogglePlay: () => void
  getLevel: () => number
  fieldRef?: (el: HTMLDivElement | null) => void
}

export function SoundField({
  scene,
  playing,
  muted,
  mix,
  timerKind,
  remaining,
  hasEverPlayed,
  audioError,
  onTogglePlay,
  getLevel,
  fieldRef,
}: SoundFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const handleRef = useRef<FieldHandle | null>(null)
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const getLevelRef = useRef(getLevel)
  useEffect(() => {
    getLevelRef.current = getLevel
  }, [getLevel])

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return
    handleRef.current = createField(canvasRef.current, () => getLevelRef.current())
    return () => {
      handleRef.current?.destroy()
      handleRef.current = null
    }
    // engine created once; StrictMode remount just rebuilds the (cheap) canvas loop
  }, [])

  useEffect(() => {
    handleRef.current?.setInput({
      mode: scene.fieldMode,
      palette: scene.palette,
      layers: {
        air: effectiveLayerLevel(mix, 'air'),
        water: effectiveLayerLevel(mix, 'water'),
        drone: effectiveLayerLevel(mix, 'drone'),
        texture: effectiveLayerLevel(mix, 'texture'),
        pulse: effectiveLayerLevel(mix, 'pulse'),
      },
      intensity: mixIntensity(mix),
      bpm: scene.audio.pulse.bpm,
      reduced,
    })
  }, [scene, mix, reduced])

  const status = playing ? 'playing' : 'idle'
  const statusLabel = playing ? 'Playing' : 'Paused'

  return (
    <div className="field" ref={fieldRef} data-scene={scene.id}>
      <canvas ref={canvasRef} className="field-canvas" aria-hidden="true" />
      <div className="field-top">
        <span className="chip chip-status" data-state={status}>
          <span className="status-dot" aria-hidden="true" />
          {muted && playing ? 'Muted' : statusLabel}
        </span>
        {(timerKind === 'running' || timerKind === 'fading' || timerKind === 'done') && (
          <span className="chip chip-timer">
            <TimerIcon />
            {timerKind === 'fading'
              ? `Fading out · ${formatClock(remaining)}`
              : timerKind === 'done'
                ? 'Session complete'
                : `${formatClock(remaining)} left`}
          </span>
        )}
      </div>

      <div className="field-info">
        <p className="scene-eyebrow">{scene.tagline}</p>
        <h2 className="scene-title">{scene.name}</h2>
        <p className="scene-desc">{scene.description}</p>
        {audioError && <p className="field-error" role="alert">{audioError}</p>}
      </div>

      {!hasEverPlayed && !playing && (
        <p className="field-hint">Everything you hear is synthesized live. Press play and shape the five layers while it breathes.</p>
      )}

      <button
        type="button"
        className="play-fab"
        onClick={onTogglePlay}
        aria-label={playing ? `Pause ${scene.name}` : `Play ${scene.name}`}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
    </div>
  )
}
