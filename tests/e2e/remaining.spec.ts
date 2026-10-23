import type { Page } from '@playwright/test'
import { doObserve, doTodaysActivities, expect, saveWith, test, useSave } from './fixtures'

const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'

/** A bean in the leaf stage, 7.4 cm tall, no weather; its stake done unless careDone: 0. */
const bean = (extra = {}) => saveWith({ speciesId: 'bean', stageIndex: 2, heightCm: 7.4, careDone: 1, weatherFrom: 99, day: 4, ...extra })

const endDay = (page: Page) => page.getByRole('button', { name: '하루 마치기' })
const title = (page: Page) => page.getByRole('heading', { level: 1 })
const bubble = (page: Page) => page.locator('.gs-nag')

/** The bubble is over the 하루 마치기 button: above it, its middle over the button. */
async function expectOverButton(page: Page) {
  const b = (await bubble(page).boundingBox())!
  const e = (await endDay(page).boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(e.y)
  const mid = b.x + b.width / 2
  expect(mid).toBeGreaterThan(e.x)
  expect(mid).toBeLessThan(e.x + e.width)
  const vw = page.viewportSize()!
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width).toBeLessThanOrEqual(vw.width)
  expect(b.y).toBeGreaterThanOrEqual(0)
}

for (const mode of ['quick', 'daily'] as const) {
  test(`${mode}: observing left — the bubble says so, the day does not end, 관찰하기 pulses`, async ({ page }) => {
    await useSave(page, bean({ mode }))
    await page.goto('/')
    await endDay(page).click()
    await expect(bubble(page)).toBeVisible()
    await expect(bubble(page)).toContainText('남은 활동이 있어요!')
    await expect(bubble(page).locator('.gs-nag-left')).toHaveText('관찰하기')
    await expect(page.locator('.nt')).toHaveCount(0)
    await expect(title(page)).toHaveAttribute('aria-label', /4일째/)
    await expect(endDay(page)).toBeEnabled()
    await expect(page.getByRole('button', { name: '관찰하기', exact: true })).toHaveClass(/nag-pulse/)
    await expectOverButton(page)
    // the words are big enough
    const size = await bubble(page).locator('.gs-nag-left').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(18)
    // it goes by itself
    await expect(bubble(page)).toHaveCount(0, { timeout: 3500 })
  })

  test(`${mode}: care left — the bubble names it, the to-do card pulses; all done, the day ends`, async ({ page }) => {
    await useSave(page, bean({ mode, careDone: 0 }))
    await page.goto('/')
    await doObserve(page)
    await endDay(page).click()
    await expect(bubble(page).locator('.gs-nag-left')).toHaveText('지지대 세우기')
    await expect(page.getByRole('status', { name: '오늘 할 일' })).toHaveClass(/nag-pulse/)
    await expect(title(page)).toHaveAttribute('aria-label', /4일째/)
    await doTodaysActivities(page)
    await endDay(page).click()
    await expect(page.locator('.nt')).toBeVisible()
    await expect(bubble(page)).toHaveCount(0)
    await expect(page.locator('.nt')).toBeHidden({ timeout: 6000 })
    if (mode === 'quick') await expect(title(page)).toHaveAttribute('aria-label', /5일째/)
    else await expect(page.getByRole('button', { name: '내일 다시 만나요' })).toBeVisible()
  })
}

for (const [w, h] of [[1194, 834], [820, 1180], [1366, 640]])
  test(`the bubble sits over 하루 마치기 and names both (${w}x${h})`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(page, bean({ mode: 'quick', careDone: 0 }))
    await page.goto('/')
    await endDay(page).click()
    await expect(bubble(page).locator('.gs-nag-left')).toHaveText('관찰하기 · 지지대 세우기')
    await expectOverButton(page)
    if (browserName === 'chromium') {
      await page.emulateMedia({ reducedMotion: 'reduce' }) // the shot without the pulse mid-way
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
      await page.screenshot({ path: `${SHOTS}/remaining-toast-${w}x${h}.png` })
    }
  })

test('a done daily day is unchanged: 내일 다시 만나요 stays held, no bubble', async ({ page }) => {
  await useSave(page, bean({ mode: 'daily' }))
  await page.goto('/')
  await doTodaysActivities(page)
  await endDay(page).click()
  await expect(page.locator('.nt')).toBeHidden({ timeout: 6000 })
  const held = page.getByRole('button', { name: '내일 다시 만나요' })
  await expect(held).toBeDisabled()
  await expect(bubble(page)).toHaveCount(0)
})
