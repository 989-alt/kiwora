import { expect, test, type Page } from '@playwright/test'
import { saveWith, useSave } from './fixtures'

// Screenshots for the visual check of the scene layering (compare with docs/mockup/img/scene_grow.png).
const SHOTS = '.superpowers/sdd/2026-10-21-plant-life/shots'

test.skip(({ browserName }) => browserName !== 'chromium', 'screenshots once, on Chromium')

async function ready(page: Page) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await page.evaluate(() => document.fonts.ready)
}

const shots: { name: string; w: number; h: number; plant: Parameters<typeof saveWith>[0] }[] = [
  { name: 'grow-1194', w: 1194, h: 834, plant: { stageIndex: 3, bugs: 2, place: 'window' } },
  { name: 'seed-1194', w: 1194, h: 834, plant: { stageIndex: 0, place: 'shade', day: 1 } },
  { name: 'grow-820x1180', w: 820, h: 1180, plant: { stageIndex: 3, bugs: 2, place: 'window' } },
  { name: 'sprout-sick-1194', w: 1194, h: 834, plant: { stageIndex: 1, health: 20, place: 'desk' } },
  { name: 'chromebook-1366x768', w: 1366, h: 768, plant: { stageIndex: 2, bugs: 1, place: 'desk' } },
]

for (const s of shots) {
  test(`scene screenshot ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: s.w, height: s.h })
    await useSave(page, saveWith(s.plant))
    await page.goto('/')
    await ready(page)
    await expect(page.locator('[data-layer="pot-front"]')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/${s.name}.png`, fullPage: true })
  })
}

test('scene screenshot while pouring water', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 })
  await useSave(page, saveWith({ stageIndex: 3, place: 'window', water: 20 }))
  await page.goto('/')
  await ready(page)
  const b = await page.getByRole('button', { name: /물 주기/ }).boundingBox()
  if (!b) throw new Error('no can')
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await expect(page.locator('.water-stream')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/pour-1194.png` })
  await page.mouse.up()
  await expect(page.locator('.water-stream')).toHaveCount(0)
})

test('scene screenshot while dragging the pot', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 })
  await useSave(page, saveWith({ stageIndex: 3, place: 'desk' }))
  await page.goto('/')
  await ready(page)
  const pot = await page.getByRole('img', { name: '화분 끌기' }).boundingBox()
  const slot = await page.getByRole('button', { name: '창가' }).boundingBox()
  if (!pot || !slot) throw new Error('no box')
  await page.mouse.move(pot.x + pot.width / 2, pot.y + pot.height / 2)
  await page.mouse.down()
  await page.mouse.move(slot.x + slot.width / 2, slot.y + 10, { steps: 10 })
  await expect(page.locator('.pot-ghost')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/drag-1194.png` })
  await page.mouse.up()
})
