import type { CSSProperties } from 'react'
import type { PlayState } from '../types'
import { formatClock } from '../lib/format'
import { MutedIcon, PauseIcon, PlayIcon, StopIcon, VolumeIcon } from './icons'

interface TransportProps {
  playing: PlayState
  muted: boolean
  volume: number
  elapsed: number
  onToggle: () => void
  onStop: () => void
  onMute: () => void
  onVolume: (v: number) => void
}

export function Transport({ playing, muted, volume, elapsed, onToggle, onStop, onMute, onVolume }: TransportProps) {
  const isPlaying = playing === 'playing'
  return (
    <section className="panel transport" aria-label="Transport">
      <div className="t-main">
        <button type="button" className="btn-primary" onClick={onToggle}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onStop}
          aria-label="Stop and reset"
          title="Stop and reset"
        >
          <StopIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          aria-pressed={muted}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MutedIcon /> : <VolumeIcon />}
        </button>
        <span className="t-elapsed" aria-label={`Elapsed ${formatClock(elapsed)}`}>
          {formatClock(elapsed)}
        </span>
      </div>
      <div className="t-master">
        <VolumeIcon />
        <label className="range master-range">
          <span className="sr-only">Master volume</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            onChange={(e) => onVolume(Number(e.target.value) / 100)}
            aria-valuetext={`${Math.round(volume * 100)} percent`}
            style={{ '--fill': `${Math.round(volume * 100)}%` } as CSSProperties}
          />
        </label>
        <span className="level-val" aria-hidden="true">
          {Math.round(volume * 100)}
        </span>
      </div>
    </section>
  )
}
