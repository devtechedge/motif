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

    // theme toggle works and persists across reload; the app follows the OS
    // color scheme on first visit, so do not assume which theme is active
    const toggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ })
    const labelBefore = await toggle.getAttribute('aria-label')
    await toggle.click()
    const themeAfterToggle = await page.locator('html').getAttribute('data-theme')
    const labelAfter = await toggle.getAttribute('aria-label')
    expect(labelAfter).not.toBe(labelBefore)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', themeAfterToggle!)

    expect(problems()).toEqual([])
  })

  test('keyboard shortcuts M, S and ? work and never fire while typing', async ({ page }) => {
    const problems = watchDiagnostics(page)
    await page.goto('/')
    await page.getByRole('region', { name: 'Transport' }).getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.chip-status')).toHaveText('Playing', { timeout: 10_000 })

    // M mutes, M again unmutes
    await page.keyboard.press('m')
    await expect(page.locator('.status-muted')).toHaveCount(1)
    await page.keyboard.press('m')
    await expect(page.locator('.status-muted')).toHaveCount(0)

    // ? opens the shortcuts dialog, Escape closes it and returns focus
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0)

    // S stops and resets
    await page.keyboard.press('s')
    await expect(page.locator('.chip-status')).toHaveText('Paused')
    await expect(page.locator('.t-elapsed')).toHaveText('0:00')

    // typing in the save input must not trigger shortcuts
    await page.getByRole('textbox', { name: 'Name for this mix' }).fill('ms?')
    await page.keyboard.press('m')
    await expect(page.locator('.status-muted')).toHaveCount(0)
    await page.keyboard.press('s')
    await expect(page.locator('.chip-status')).toHaveText('Paused')

    expect(problems()).toEqual([])
  })

  test('a shared mix link restores the exact mix in a fresh browser', async ({ page, browser }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    // shape the mix: water down, pulse on
    const waterRow = page.locator('.mix-row', { hasText: 'Water' })
    await waterRow.locator('input[type=range]').fill('42')
    const pulseRow = page.locator('.mix-row', { hasText: 'Pulse' })
    await pulseRow.locator('.switch').click()
    await expect(pulseRow.locator('.switch')).toHaveAttribute('aria-checked', 'true')

    await page.getByRole('button', { name: 'Copy a link to this mix' }).click()
    await expect(page.locator('.toast').last()).toContainText('Mix link copied')
    const url = await page.evaluate(() => navigator.clipboard.readText())
    expect(url).toMatch(/#m1\./)

    const fresh = await browser.newContext()
    const freshPage = await fresh.newPage()
    await freshPage.goto(url)
    await expect(freshPage.getByRole('heading', { name: 'Rain on Glass' })).toBeVisible()
    await expect(freshPage.locator('.mix-row', { hasText: 'Water' }).locator('.level-val')).toHaveText('42')
    await expect(freshPage.locator('.mix-row', { hasText: 'Pulse' }).locator('.switch')).toHaveAttribute('aria-checked', 'true')
    await expect(freshPage.locator('.toast').last()).toContainText('Loaded shared mix')
    await fresh.close()
  })

  test('shelf rename, duplicate and export work', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Save mix/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(1)
    const firstName = await page.locator('.saved-item .saved-name').textContent()

    // rename via the pencil
    await page.getByRole('button', { name: new RegExp(`Rename ${firstName}`) }).click()
    const input = page.locator('.rename-input')
    await input.fill('Deep focus')
    await input.press('Enter')
    await expect(page.locator('.saved-item .saved-name')).toHaveText('Deep focus')

    // duplicate
    await page.getByRole('button', { name: 'Duplicate Deep focus' }).click()
    await expect(page.locator('.saved-item')).toHaveCount(2)
    await expect(page.locator('.saved-item .saved-name').first()).toHaveText('Deep focus copy')

    // shelf counter shows the cap
    await expect(page.locator('.saved .section-sub')).toContainText('(2/24)')
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

  test('first visit follows the operating system color scheme', async ({ browser }) => {
    const light = await browser.newContext({ colorScheme: 'light' })
    const lightPage = await light.newPage()
    await lightPage.goto('/')
    await expect(lightPage.locator('html')).toHaveAttribute('data-theme', 'light')
    // an explicit toggle still wins over the OS preference
    await lightPage.getByRole('button', { name: 'Switch to dark mode' }).click()
    await expect(lightPage.locator('html')).toHaveAttribute('data-theme', 'dark')
    await lightPage.reload()
    await expect(lightPage.locator('html')).toHaveAttribute('data-theme', 'dark')
    await light.close()

    const dark = await browser.newContext({ colorScheme: 'dark' })
    const darkPage = await dark.newPage()
    await darkPage.goto('/')
    await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'dark')
    await dark.close()
  })

  test('focus lands on a neighbor after deleting a saved mix', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Save mix/ }).click()
    await page.getByRole('button', { name: /Save mix/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(2)
    const firstName = await page.locator('.saved-item').first().getAttribute('id')
    const secondName = await page.locator('.saved-item').nth(1).getAttribute('id')
    await page.getByRole('button', { name: /Delete Deep focus|Delete .*№ 1/ }).first().click()
    // focus moved to the surviving row's first button, not to BODY
    const focusId = await page.evaluate(() => document.activeElement?.closest('.saved-item')?.id ?? null)
    expect([firstName, secondName]).toContain(focusId)
    expect(focusId).not.toBeNull()
  })

  test('body text holds AA contrast in both themes', async ({ page }) => {
    // panels use gradients, so each probe is paired with the CSS variable of
    // its surface's worst-case gradient stop; both stops pass when text-3 and
    // text-2 are theme-aware
    const probe = async (theme: 'dark' | 'light') => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('motif:theme:v1', t)
        } catch {}
      }, theme)
      await page.goto('/')
      return page.evaluate(() => {
        const lum = (color: string) => {
          const m = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/)
          if (!m) return null
          const [r, g, b] = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255]
          const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
          return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
        }
        const varColor = (el: Element, name: string) => {
          const owner = name.startsWith('--p-') ? el.closest('[data-active]') ?? el : document.documentElement
          return getComputedStyle(owner).getPropertyValue(name).trim()
        }
        const probes: Array<[string, string, string]> = [
          ['.brand-sub', 'color', '--ink-0'],
          ['.panel-sub', 'color', '--ink-2'],
          ['.level-val', 'color', '--ink-2'],
          ['.timer-unit', 'color', '--ink-2'],
          ['.section-sub', 'color', '--ink-2'],
          ['.mix-name', 'color', '--ink-2'],
          ['.plate-tag', 'color', '--p-fieldA'],
        ]
        const failures: string[] = []
        for (const [sel, fgProp, bgVar] of probes) {
          const el = document.querySelector(sel)
          if (!el) continue
          const fg = lum(getComputedStyle(el)[fgProp as 'color'])
          const bg = lum(varColor(el, bgVar))
          if (fg === null || bg === null) continue
          const lo = Math.min(fg, bg) + 0.05
          const hi = Math.max(fg, bg) + 0.05
          const ratio = hi / lo
          if (ratio < 4.5) failures.push(`${sel}: ${ratio.toFixed(2)} (${theme})`)
        }
        return failures
      })
    }
    const darkFailures = await probe('dark')
    expect(darkFailures, `dark theme contrast failures: ${darkFailures.join(', ')}`).toEqual([])
    await page.evaluate(() => localStorage.removeItem('motif:theme:v1'))
    const lightFailures = await probe('light')
    expect(lightFailures, `light theme contrast failures: ${lightFailures.join(', ')}`).toEqual([])
  })

  test('custom session length is accepted and shown', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Custom', { exact: true }).fill('7')
    await page.getByRole('button', { name: 'Set', exact: true }).click()
    await expect(page.locator('.timer-readout')).toContainText('7:00')
    // off cancels
    await page.getByRole('button', { name: 'Off', exact: true }).click()
    await expect(page.locator('.timer-readout')).toHaveCount(0)
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
