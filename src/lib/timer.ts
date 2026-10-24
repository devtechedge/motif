export type ActiveTimerKind = 'running' | 'fading'

export interface TimerTick {
  /** Whole seconds remaining, floored at 0. */
  remaining: number
  /** True once, at the tick where the fade should begin. */
  enterFading: boolean
  /** True at the tick where the session is complete (remaining 0). */
  complete: boolean
}

/**
 * Pure decision for one timer tick, so completion is exactly-once and
 * testable without a real clock: the session measures *playing* time (the
 * engine's audio clock freezes while paused, so pausing pauses the countdown).
 */
export function timerTick(used: number, totalSec: number, fadeSec: number, kind: ActiveTimerKind): TimerTick {
  const remaining = Math.max(0, totalSec - used)
  const complete = remaining <= 0
  // epsilon guards the float edge (900 - 896.8 > 3.2 by ~5e-14)
  const enterFading = kind === 'running' && !complete && remaining <= fadeSec + 1e-9
  return { remaining, enterFading, complete }
}
