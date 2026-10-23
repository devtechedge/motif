import type { TimerKind } from '../types'
import { formatClock } from '../lib/format'

export const TIMER_CHOICES = [15, 30, 45, 60] as const

interface SessionTimerProps {
  kind: TimerKind
  minutes: number | null
  remaining: number
  onSelect: (minutes: number | null) => void
}

export function SessionTimer({ kind, minutes, remaining, onSelect }: SessionTimerProps) {
  return (
    <section className="panel timer" aria-label="Session timer">
      <header className="panel-head">
        <h3>Session</h3>
        <p className="panel-sub">
          {kind === 'done'
            ? 'Complete. Select a length to begin another'
            : kind === 'fading'
              ? 'Fading out now, like a tide going out'
              : 'Fades out gently when the time is up'}
        </p>
      </header>
      <div className="timer-row" role="group" aria-label="Session length">
        <button
          type="button"
          className="timer-choice"
          aria-pressed={minutes === null}
          onClick={() => onSelect(null)}
        >
          Off
        </button>
        {TIMER_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            className="timer-choice"
            aria-pressed={minutes === m}
            onClick={() => onSelect(m)}
          >
            {m}
            <span className="timer-unit"> min</span>
          </button>
        ))}
      </div>
      {(kind === 'running' || kind === 'fading') && (
        <p className="timer-readout" aria-live="off">
          <span className="timer-clock">{formatClock(remaining)}</span> remaining
        </p>
      )}
    </section>
  )
}
