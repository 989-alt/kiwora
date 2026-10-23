import type { Page } from '@playwright/test'
import { expect, saveWith, test, useSave } from './fixtures'

// The pot must stand ON the sill / desk / shelf: its bottom between the back and front edge of the top face
// (hand-measured in assets/bg_stand.json), at every screen size the app is used on.
const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'
const VIEWPORTS: [number, number][] = [
  [1194, 834],
  [1280, 800],
  [1366, 640],
  [1366, 768],
  [820, 1180],
  [768, 1024],
]
const PLACES = ['window', 'desk', 'shade'] as const

test.skip(({ browserName }) => browserName !== 'chromium', 'screenshots once, on Chromium')

async function ready(page: Page) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await page.evaluate(() => document.fonts.ready)
}

type Anchors = { files: Record<string, { w: number; h: number; bottom?: number; standTop?: number; standBottom?: number; x0?: number; x1?: number; bbox?: number[] }> }

for (const [w, h] of VIEWPORTS) {
  for (const place of PLACES) {
    test(`pot stands on the ${place} surface at ${w}x${h}`, async ({ page, request }) => {
      const anchors = (await (await request.get('/anchors.json')).json()) as Anchors
      const bgA = anchors.files[`bg/${place}.webp`]
      const potA = anchors.files['pots/happy.webp']

      await page.setViewportSize({ width: w, height: h })
      await useSave(page, saveWith({ stageIndex: 2, place, health: 90 }))
      await page.goto('/')
      await ready(page)
      const pot = page.locator('[data-layer="pot-front"]')
      await expect(pot).toBeVisible()

      const bg = (await page.locator('[data-layer="bg"]').boundingBox())!
      const pb = (await pot.boundingBox())!
      const scene = (await page.locator('.pv').boundingBox())!
      console.log(`scene ${place} ${w}x${h}: ${Math.round(scene.width)}x${Math.round(scene.height)}`)

      const s = bg.width / bgA.w
      const bottom = pb.y + potA.bottom! * (pb.height / potA.h)
      expect(bottom).toBeGreaterThanOrEqual(bg.y + bgA.standTop! * s - 0.5)
      expect(bottom).toBeLessThanOrEqual(bg.y + bgA.standBottom! * s + 0.5)
      // the visible pot sits inside the x range of the surface
      const ps = pb.width / potA.w
      expect(pb.x + potA.bbox![0] * ps).toBeGreaterThanOrEqual(bg.x + bgA.x0! * s - 0.5)
      expect(pb.x + potA.bbox![2] * ps).toBeLessThanOrEqual(bg.x + bgA.x1! * s + 0.5)

      await page.screenshot({ path: `${SHOTS}/placement-${place}-${w}x${h}.png` })
    })
  }
}
