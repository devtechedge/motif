import { useState } from 'react'
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
  const [custom, setCustom] = useState('')
  const customValue = Number.parseInt(custom, 10)
  const customValid = Number.isInteger(customValue) && customValue >= 1 && customValue <= 180

  const applyCustom = () => {
    if (!customValid) return
    onSelect(customValue)
    setCustom('')
  }

  return (
    <section className="panel timer" aria-label="Session timer">
      <header className="panel-head">
        <h3>Session</h3>
        <p className="panel-sub">
          {kind === 'done'
            ? 'Complete. Select a length to begin another'
            : kind === 'fading'
              ? 'Fading out now, like a tide going out'
              : 'Fades out gently at the end. Pausing the sound pauses the clock'}
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
      <div className="timer-custom">
        <label className="timer-custom-label" htmlFor="timer-custom-min">
          Custom
        </label>
        <input
          id="timer-custom-min"
          type="number"
          className="text-input timer-custom-input"
          min={1}
          max={180}
          step={1}
          placeholder="1-180"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyCustom()
          }}
        />
        <span className="timer-unit">min</span>
        <button type="button" className="btn-ghost" onClick={applyCustom} disabled={!customValid}>
          Set
        </button>
      </div>
      {(kind === 'running' || kind === 'fading') && (
        <p className="timer-readout" aria-live="off">
          <span className="timer-clock">{formatClock(remaining)}</span> remaining
        </p>
      )}
    </section>
  )
}
