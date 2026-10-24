/**
 * Fires a callback once, on the first failed storage write of a session.
 * Later failures are already known to the user, so repeated warnings
 * would be spam.
 */
export interface StorageAlerter {
  onResult(ok: boolean): void
  reset(): void
}

export function createStorageAlerter(alarms: () => void): StorageAlerter {
  let warned = false
  return {
    onResult(ok: boolean) {
      if (!ok && !warned) {
        warned = true
        alarms()
      }
    },
    reset() {
      warned = false
    },
  }
}
