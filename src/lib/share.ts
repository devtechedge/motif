import { sanitizeSession, type SessionSnapshot } from './sanitize'

const PREFIX = '#m1.'

/**
 * Shareable mix links: the snapshot rides in the URL hash, so nothing is
 * ever sent to a server. Encoding is versioned; decode validates through
 * the same sanitizers as persisted data, so a tampered link is a no-op.
 */
export function encodeMix(snapshot: SessionSnapshot): string {
  const payload = {
    v: 1,
    sceneId: snapshot.sceneId,
    volume: Math.round(snapshot.volume * 100) / 100,
    mix: Object.fromEntries(
      Object.entries(snapshot.mix).map(([id, s]) => [id, { e: s.enabled ? 1 : 0, g: Math.round(s.gain * 100) / 100 }]),
    ),
  }
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${PREFIX}${b64}`
}

export function decodeMix(hash: string): SessionSnapshot | null {
  if (!hash.startsWith(PREFIX)) return null
  try {
    const b64 = hash.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const raw = JSON.parse(atob(padded)) as { v?: unknown; sceneId?: unknown; volume?: unknown; mix?: unknown }
    if (!raw || raw.v !== 1) return null
    const mix: Record<string, unknown> = {}
    for (const [id, state] of Object.entries((raw.mix as Record<string, unknown>) ?? {})) {
      const s = state as { e?: unknown; g?: unknown }
      mix[id] = { enabled: s.e === 1, gain: typeof s.g === 'number' ? s.g : Number.NaN }
  }
    return sanitizeSession({ sceneId: raw.sceneId, mix, volume: raw.volume })
  } catch {
    return null
  }
}

/** Clipboard write with a textarea fallback for non-secure contexts. */
export function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text))
  }
  return Promise.resolve(fallbackCopy(text))
}

function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
