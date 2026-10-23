import { expect, test } from '@playwright/test'

test.describe('MOTIF smokes', () => {
  test('loads with the sound field and layer mixer', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/MOTIF/)
    await expect(page.getByRole('heading', { name: 'Rain on Glass' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Layer mixer' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Transport' })).toBeVisible()
  })

  test('play toggles the playback status', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.chip-status')).toHaveText('Paused')
    await page.getByRole('region', { name: 'Transport' }).getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.chip-status')).toHaveText('Playing', { timeout: 10_000 })
    await page.getByRole('region', { name: 'Transport' }).getByRole('button', { name: 'Pause' }).click()
    await expect(page.locator('.chip-status')).toHaveText('Paused')
  })

  test('switching scenes swaps the title and mix', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Neon Drift/ }).click()
    await expect(page.getByRole('heading', { name: 'Neon Drift' })).toBeVisible()
    // Neon Drift ships with the Pulse layer on, Rain on Glass does not
    const pulseRow = page.locator('.mix-row', { hasText: 'Pulse' })
    await expect(pulseRow.locator('.switch')).toHaveAttribute('aria-checked', 'true')
  })

  test('layer toggle and level control update state', async ({ page }) => {
    await page.goto('/')
    const waterRow = page.locator('.mix-row', { hasText: 'Water' })
    await expect(waterRow.locator('.switch')).toHaveAttribute('aria-checked', 'true')
    await waterRow.locator('.switch').click()
    await expect(waterRow.locator('.switch')).toHaveAttribute('aria-checked', 'false')
    await waterRow.locator('input[type=range]').fill('40')
    await expect(waterRow.locator('.level-val')).toHaveText('40')
  })

  test('saved mixes: save, appear, and delete', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Save mix/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Load', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Delete/ }).click()
    await expect(page.locator('.saved-item')).toHaveCount(0)
    await expect(page.getByText('Nothing on the shelf yet')).toBeVisible()
  })
})
