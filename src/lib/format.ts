/** Formats seconds as m:ss (e.g. 65 -> "1:05"). Caps at 999:59. */
export function formatClock(totalSeconds: number): string {
  const s = Math.min(999 * 60 + 59, Math.max(0, Math.floor(totalSeconds)))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/** Compact relative date for saved mixes: "just now", "12m ago", "3h ago", "Oct 24". */
export function formatRelative(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
