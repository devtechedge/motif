import type { Scene, TimerKind } from '../types'
import { formatClock } from '../lib/format'
import { MutedIcon, PauseIcon, PlayIcon, VolumeIcon } from './icons'

interface NowPlayingProps {
  scene: Scene
  playing: boolean
  muted: boolean
  elapsed: number
  timerKind: TimerKind
  remaining: number
  visible: boolean
  onToggle: () => void
  onMute: () => void
}

export function NowPlaying({ scene, playing, muted, elapsed, timerKind, remaining, visible, onToggle, onMute }: NowPlayingProps) {
  return (
    <div className="nowbar" data-visible={visible} role="region" aria-label="Now playing">
      <span className="nowbar-dot" aria-hidden="true" style={{ background: scene.palette.accent }} />
      <span className="nowbar-meta">
        <span className="nowbar-name">{scene.name}</span>
        <span className="nowbar-time">
          {formatClock(elapsed)}
          {(timerKind === 'running' || timerKind === 'fading') && ` · ${formatClock(remaining)} left`}
        </span>
      </span>
      <button
        type="button"
        className="icon-btn nowbar-play"
        onClick={onToggle}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={muted}
      >
        {muted ? <MutedIcon /> : <VolumeIcon />}
      </button>
    </div>
  )
}
