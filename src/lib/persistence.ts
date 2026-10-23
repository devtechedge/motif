/**
 * Storage adapter with graceful degradation: if localStorage is missing,
 * blocked (privacy mode) or throws, we fall back to an in-memory store and
 * report `ok: false` so the UI can tell the user saves are session-only.
 */
export interface StorageAdapter {
  readonly ok: boolean
  get<T>(key: string): T | null
  set(key: string, value: unknown): boolean
  remove(key: string): void
}

export function createMemoryStorage(): StorageAdapter {
  const map = new Map<string, unknown>()
  return {
    ok: false,
    get<T>(key: string): T | null {
      return (map.get(key) as T | undefined) ?? null
    },
    set(key: string, value: unknown): boolean {
      map.set(key, value)
      return true
    },
    remove(key: string): void {
      map.delete(key)
    },
  }
}

export function createLocalStorage(backing: Storage): StorageAdapter {
  let healthy = probe(backing)
  return {
    get ok() {
      return healthy
    },
    get<T>(key: string): T | null {
      if (!healthy) return null
      try {
        const raw = backing.getItem(key)
        return raw === null ? null : (JSON.parse(raw) as T)
      } catch {
        healthy = false
        return null
      }
    },
    set(key: string, value: unknown): boolean {
      if (!healthy) return false
      try {
        backing.setItem(key, JSON.stringify(value))
        return true
      } catch {
        healthy = false
        return false
      }
    },
    remove(key: string): void {
      if (!healthy) return
      try {
        backing.removeItem(key)
      } catch {
        healthy = false
      }
    },
  }
}

function probe(backing: Storage): boolean {
  try {
    const k = '__motif_probe__'
    backing.setItem(k, '1')
    backing.removeItem(k)
    return true
  } catch {
    return false
  }
}

/** Best available storage; memory fallback keeps the app fully usable. */
export function detectStorage(): StorageAdapter {
  try {
    if (typeof localStorage !== 'undefined') return createLocalStorage(localStorage)
  } catch {
    // access itself can throw in some sandboxed frames
  }
  return createMemoryStorage()
}

export const SAVED_MIXES_KEY = 'motif:saved-mixes:v1'
export const SESSION_KEY = 'motif:session:v1'
export const PLAYED_KEY = 'motif:has-played:v1'
