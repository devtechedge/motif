/**
 * Renders the brand SVG to the PNG icon set from the committed design.
 * Run: node scripts/generate-icons.mjs
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
  <rect width="32" height="32" rx="7" fill="#08090d"/>
  <circle cx="16" cy="15" r="6.5" fill="none" stroke="#c9b68c" stroke-width="1.6"/>
  <path d="M6 16c2.6 0 2.6-6 5.2-6s3.4 12 6 12 3.4-12 6-12 2.6 6 4.8 6" fill="none" stroke="#c9b68c" stroke-width="1.4" stroke-linecap="round"/>
</svg>`

const targets = [
  [32, 'favicon.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'icons/icon-192.png'],
  [512, 'icons/icon-512.png'],
]

await mkdir('public/icons', { recursive: true })
const browser = await chromium.launch()
for (const [size, out] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><body style="margin:0;width:${size}px;height:${size}px">${SVG}</body>`,
  )
  await page.screenshot({ path: `public/${out}` })
  await page.close()
  console.log('wrote public/' + out)
}
await browser.close()
