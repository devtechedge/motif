import { expect, test, type Page } from '@playwright/test'

function watchDiagnostics(page: Page): () => string[] {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e)}`))
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`))
  return () => problems
}

const SCENES_REGION = { name: 'Scene library' }

function scenePlate(page: Page, name: string) {
  return page.getByRole('region', SCENES_REGION).getByRole('button', { name: new RegExp(name) })
}

test.describe('MOTIF journey QA', () => {
  test('full journey produces zero console errors and honest state', async ({ page }) => {
    const problems = watchDiagnostics(page)
    await page.goto('/')

    // semantic structure
    await expect(page.getByRole('heading', { level: 1, name: /MOTIF/ })).toBeAttached()

    // play via the transport, shape layers, watch the clock advance
    await page.getByRole('region', { name: 'Transport' }).getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.chip-status')).toHaveText('Playing', { timeout: 10_000 })
    await expect(page.locator('.t-elapsed')).not.toHaveText('0:00', { timeout: 10_000 })

    // turn every layer off: the honest silence note must appear
    for (const name of ['Air', 'Water', 'Low Drone', 'Texture', 'Pulse']) {
      const row = page.locator('.mix-row', { hasText: name })
      if ((await row.locator('.switch').getAttribute('aria-checked')) === 'true') {
        await row.locator('.switch').click()
      }
    }
    await expect(page.locator('.mix-note')).toContainText('Every layer is off')

    // restore and switch scenes rapidly
    for (const name of ['Air', 'Water']) {
      const row = page.locator('.mix-row', { hasText: name })
      await row.locator('.switch').click()
    }
    for (const name of ['Lunar Tide', 'Moss Cathedral', 'Blue Hour', 'Neon Drift', 'Rain on Glass']) {
      await scenePlate(page, name).click()
    }
    await expect(page.getByRole('heading', { name: 'Rain on Glass' })).toBeVisible()

    // mute, zero volume, stop
    await page.locator(".transport .icon-btn[aria-label='Mute']").click()
    await expect(page.locator(".transport .icon-btn[aria-label='Unmute']")).toBeVisible()
    await page.getByRole('slider', { name: 'Master volume' }).fill('0')
    await expect(page.locator('.transport .level-val')).toHaveText('0')
    await page.getByRole('button', { name: 'Stop and reset' }).click()
    await expect(page.locator('.chip-status')).toHaveText('Paused')
    await expect(page.locator('.t-elapsed')).toHaveText('0:00')

    // save, load, delete a mix
    await page.getByRole('button', { name: /Save mix/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(1)
    await scenePlate(page, 'Moss Cathedral').click()
    await page.getByRole('button', { name: 'Load', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Rain on Glass' })).toBeVisible()
    await page.getByRole('button', { name: /Delete/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(0)

    // timer selection is honest in the UI
    await page.getByRole('button', { name: '15 min' }).click()
    await expect(page.locator('.timer-readout')).toContainText('15:00')
    await page.getByRole('button', { name: 'Off', exact: true }).click()
    await expect(page.locator('.timer-readout')).toHaveCount(0)

    expect(problems()).toEqual([])
  })

  test('keyboard-only operation reaches transport, mixer, scenes and theme', async ({ page }) => {
    const problems = watchDiagnostics(page)
    await page.goto('/')

    // focus the play button directly and press Space (button semantics, not the global shortcut)
    const playButton = page.getByRole('region', { name: 'Transport' }).getByRole('button', { name: 'Play' })
    await playButton.focus()
    await page.keyboard.press('Space')
    await expect(page.locator('.chip-status')).toHaveText('Playing', { timeout: 10_000 })

    // a layer switch is keyboard operable
    const droneSwitch = page.locator('.mix-row', { hasText: 'Low Drone' }).locator('.switch')
    await droneSwitch.focus()
    await page.keyboard.press('Space')
    await expect(droneSwitch).toHaveAttribute('aria-checked', 'true')

    // a scene plate is keyboard operable
    await scenePlate(page, 'Neon Drift').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Neon Drift' })).toBeVisible()

    // theme toggle works and persists across reload
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: 'Switch to dark mode' }).click()

    expect(problems()).toEqual([])
  })

  test('saved mixes survive a reload and deletion persists', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Save mix/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(1)
    const name = await page.locator('.saved-item .saved-name').textContent()
    expect(name).toBeTruthy()
    await page.reload()
    await expect(page.locator('.saved-item')).toHaveCount(1)
    await expect(page.locator('.saved-item .saved-name')).toHaveText(name!)
    await page.getByRole('button', { name: /Delete/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.saved-item')).toHaveCount(0)
  })

  test('blocked storage degrades to session-only with an honest note', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('storage blocked')
        },
      })
    })
    await page.goto('/')
    // the app must render and work
    await expect(page.getByRole('heading', { name: 'Rain on Glass' })).toBeVisible()
    await expect(page.getByText(/Storage is unavailable/)).toBeVisible()
    // saving still works for the session
    await page.getByRole('button', { name: /Save mix/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(1)
  })

  test('corrupted persisted data does not crash the app', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('motif:session:v1', '{"sceneId":"hacker","mix":{"air":1},"volume":99}')
      window.localStorage.setItem('motif:saved-mixes:v1', '[{"id":1},{"evil":true},"nope"]')
    })
    await page.goto('/')
    // falls back to the default scene and a working instrument
    await expect(page.getByRole('heading', { name: 'Rain on Glass' })).toBeVisible()
    await expect(page.locator('.saved-item')).toHaveCount(0)
    await page.getByRole('region', { name: 'Transport' }).getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.chip-status')).toHaveText('Playing', { timeout: 10_000 })
  })

  test('rapid scene switching stays coherent while playing', async ({ page }) => {
    const problems = watchDiagnostics(page)
    await page.goto('/')
    await page.getByRole('region', { name: 'Transport' }).getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.chip-status')).toHaveText('Playing', { timeout: 10_000 })
    for (let round = 0; round < 2; round++) {
      for (const name of ['Lunar Tide', 'Moss Cathedral', 'Blue Hour', 'Neon Drift', 'Rain on Glass']) {
        await scenePlate(page, name).click()
      }
    }
    await expect(page.getByRole('heading', { name: 'Rain on Glass' })).toBeVisible()
    await expect(page.locator('.chip-status')).toHaveText('Playing')
    expect(problems()).toEqual([])
  })

  test.describe('responsive sweep', () => {
    for (const [w, h, label] of [
      [1440, 900, 'desktop-large'],
      [1280, 800, 'desktop'],
      [1024, 768, 'tablet-landscape'],
      [768, 1024, 'tablet-portrait'],
      [390, 844, 'mobile'],
      [375, 812, 'mobile-2'],
      [320, 568, 'narrow'],
      [844, 390, 'mobile-landscape'],
    ] as const) {
      test(`no horizontal overflow at ${label} (${w}x${h})`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h })
        await page.goto('/')
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(1)
        // essential controls exist and render at every size (reachable by scroll on short screens)
        await expect(page.getByRole('region', { name: 'Transport' })).toBeVisible()
      })
    }
  })

  test('reduced motion keeps the app composed and functional', async ({ page }) => {
    const problems = watchDiagnostics(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Rain on Glass' })).toBeVisible()
    await page.getByRole('region', { name: 'Transport' }).getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.chip-status')).toHaveText('Playing', { timeout: 10_000 })
    expect(problems()).toEqual([])
  })
})
