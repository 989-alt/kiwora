import { expect, test, type Page } from '@playwright/test'
import { doTodaysActivities, saveWith, useSave } from './fixtures'

const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'
const VIEWPORTS = [
  { w: 1194, h: 834 },
  { w: 820, h: 1180 },
]

// weatherFrom far away: no forecast, so the night is not held longer.
const quick = (extra = {}) => saveWith({ mode: 'quick', careDone: 0, weatherFrom: 99, day: 4, ...extra })
const daily = (extra = {}) => saveWith({ mode: 'daily', careDone: 0, weatherFrom: 99, day: 4, ...extra })

const endDay = (page: Page) => page.getByRole('button', { name: '하루 마치기' })
const title = (page: Page) => page.getByRole('heading', { level: 1 })

for (const { w, h } of VIEWPORTS) {
  test(`quick: the cover shows, goes within 3s and the header is the next day (${w}x${h})`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(page, quick())
    await page.goto('/')
    await expect(title(page)).toHaveAttribute('aria-label', /4일째/)
    await doTodaysActivities(page)
    await endDay(page).click()
    const cover = page.locator('.nt')
    await expect(cover).toBeVisible()
    await expect(cover).toHaveAttribute('role', 'presentation')
    // mid-night
    await expect(cover).toHaveAttribute('data-phase', 'night')
    await page.waitForTimeout(500)
    if (browserName === 'chromium') {
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
      await page.screenshot({ path: `${SHOTS}/night-quick-${w}x${h}.png` })
    }
    await expect(cover).toBeHidden({ timeout: 3200 })
    await expect(title(page)).toHaveAttribute('aria-label', /5일째/)
    // a quick plant has no night scene afterwards: the next day is open
    await expect(page.locator('.gs-night')).toHaveCount(0)
    await expect(endDay(page)).toBeEnabled()
  })

  test(`daily: the night scene stays, also after a reload (${w}x${h})`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(page, daily())
    await page.goto('/')
    await doTodaysActivities(page)
    await endDay(page).click()
    const cover = page.locator('.nt')
    await expect(cover).toBeVisible()
    await expect(cover).toBeHidden({ timeout: 3200 })
    const scene = page.locator('.gs-scene .gs-night')
    await expect(scene).toBeVisible()
    await expect(scene.getByText('내일 다시 만나요')).toBeVisible()
    await expect(scene.locator('img')).toHaveAttribute('src', /props\/moon\.webp/)
    if (browserName === 'chromium') {
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
      await page.screenshot({ path: `${SHOTS}/night-daily-${w}x${h}.png` })
    }
    await page.reload()
    await expect(scene).toBeVisible()
    await expect(scene.getByText('내일 다시 만나요')).toBeVisible()
    await expect(page.locator('.nt')).toHaveCount(0)
    // the menu is not covered
    await page.getByRole('button', { name: '씨 도감' }).click()
    await expect(page.getByRole('list', { name: '씨 도감' })).toBeVisible()
  })
}

test('a tap skips the cover at once', async ({ page }) => {
  await useSave(page, quick())
  await page.goto('/')
  await doTodaysActivities(page)
  await endDay(page).click()
  const cover = page.locator('.nt')
  await expect(cover).toBeVisible()
  await page.waitForTimeout(650) // taps in the first moments are ignored
  await cover.click({ position: { x: 100, y: 100 } })
  await expect(cover).toBeHidden({ timeout: 500 })
  await expect(title(page)).toHaveAttribute('aria-label', /5일째/)
})

test('a fast triple tap on 하루 마치기 in quick mode advances one day only', async ({ page }) => {
  await useSave(page, quick())
  await page.goto('/')
  await expect(title(page)).toHaveAttribute('aria-label', /4일째/)
  await doTodaysActivities(page)
  const b = (await endDay(page).boundingBox())!
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  // taps 60 and 120 ms apart (200 ms from the first tap): the 2nd lands on the cover, the 3rd where the button was
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(60)
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(120)
  await page.touchscreen.tap(x, y)
  await expect(page.locator('.nt')).toBeHidden({ timeout: 3500 })
  await expect(title(page)).toHaveAttribute('aria-label', /5일째/)
  // and the button is back after a moment
  await expect(endDay(page)).toBeEnabled()
})

test('reduced motion: a short fade, no sunrise', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await useSave(page, quick())
  await page.goto('/')
  await doTodaysActivities(page)
  await endDay(page).click()
  const cover = page.locator('.nt')
  await expect(cover).toHaveAttribute('data-motion', 'reduced')
  await expect(cover).toBeHidden({ timeout: 1500 })
  await expect(title(page)).toHaveAttribute('aria-label', /5일째/)
})
