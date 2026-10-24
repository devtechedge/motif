/**
 * Captures the README screenshots and the 1280x640 social preview from the
 * production build. Run a preview server first, then this script:
 *
 *   npm run build
 *   npx vite preview --port 4173 --strictPort &
 *   node scripts/capture-screenshots.mjs
 *
 * Output lands in docs/screenshots/.
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.CAPTURE_URL ?? 'http://localhost:4317'
const OUT = 'docs/screenshots'
const LAUNCH_ARGS = ['--autoplay-policy=no-user-gesture-required']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function startPlayback(page) {
  await page.locator('.transport .btn-primary').click()
  await sleep(3200)
}

async function clip(page, selector) {
  const el = page.locator(selector)
  await el.scrollIntoViewIfNeeded()
  await sleep(400)
  const box = await el.boundingBox()
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}

const browser = await chromium.launch({ args: LAUNCH_ARGS })

try {
  await mkdir(OUT, { recursive: true })

  // desktop, dark, playing
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await startPlayback(page)
  await page.screenshot({ path: `${OUT}/01-sound-field.png`, clip: await clip(page, '.field') })
  await page.screenshot({ path: `${OUT}/02-mixer-rail.png`, clip: await clip(page, '.rail') })
  await page.screenshot({ path: `${OUT}/03-scene-library.png`, clip: await clip(page, '.scenes') })

  // desktop, light theme (the field canvas stays ink-dark by design)
  await page.evaluate(() => {
    try {
      localStorage.setItem('motif:theme:v1', 'light')
    } catch {}
  })
  await page.reload({ waitUntil: 'networkidle' })
  await startPlayback(page)
  await page.screenshot({ path: `${OUT}/04-light-theme.png`, clip: await clip(page, '.studio-grid') })
  await page.evaluate(() => {
    try {
      localStorage.setItem('motif:theme:v1', 'dark')
    } catch {}
  })

  // mobile
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  await mobile.goto(BASE, { waitUntil: 'networkidle' })
  await sleep(1600)
  await mobile.screenshot({ path: `${OUT}/05-mobile.png` })
  await mobile.close()

  // social preview: exactly 1280x640, dark product crop, playing
  const social = await browser.newPage({ viewport: { width: 1280, height: 640 } })
  await social.goto(BASE, { waitUntil: 'networkidle' })
  await social.evaluate(() => {
    try {
      localStorage.setItem('motif:theme:v1', 'dark')
    } catch {}
  })
  await startPlayback(social)
  await social.screenshot({ path: `${OUT}/social-preview.png` })
  await social.close()

  await page.close()
  console.log('screenshots captured to', OUT)
} finally {
  await browser.close()
}
void sleep
