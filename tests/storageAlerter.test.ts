import { describe, expect, it } from 'vitest'
import { createStorageAlerter } from '../src/lib/storageAlerter'

describe('createStorageAlerter', () => {
  it('fires exactly once on the first failed write', () => {
    let fires = 0
    const alerter = createStorageAlerter(() => fires++)
    alerter.onResult(true)
    alerter.onResult(true)
    expect(fires).toBe(0)
    alerter.onResult(false)
    alerter.onResult(false)
    alerter.onResult(false)
    expect(fires).toBe(1)
  })

  it('re-arms after reset', () => {
    let fires = 0
    const alerter = createStorageAlerter(() => fires++)
    alerter.onResult(false)
    expect(fires).toBe(1)
    alerter.reset()
    alerter.onResult(false)
    expect(fires).toBe(2)
  })

  it('does not fire when writes keep succeeding', () => {
    let fires = 0
    const alerter = createStorageAlerter(() => fires++)
    for (let i = 0; i < 50; i++) alerter.onResult(true)
    expect(fires).toBe(0)
  })
})
