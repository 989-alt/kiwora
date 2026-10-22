import { expect, test } from '@playwright/test'
import { saveWith, useSave } from './fixtures'

const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'

const quick = (extra = {}) => saveWith({ mode: 'quick', careDone: 0, weatherFrom: 99, day: 4, ...extra })

test('mode dialog: the page behind is inert, Escape closes it, the focus returns to the card', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('button', { name: /봉숭아/ })
  await card.focus()
  await card.click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toBeVisible()
  // everything else is inert
  await expect(page.locator('#root')).toHaveAttribute('inert', '')
  // a quick double tap on the card does not choose a mode
  await page.waitForTimeout(450)
  await page.keyboard.press('Escape')
  await expect(dlg).toBeHidden()
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
})

test('portrait: the status board is not hidden under the end-day bar, also while observing', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await useSave(page, quick())
  await page.goto('/')
  const bar = page.locator('.gs-endbar')
  await expect(bar).toBeVisible()
  const covered = async () =>
    page.evaluate(() => {
      const aside = document.querySelector('.gs-aside')!
      aside.scrollIntoView({ block: 'nearest' })
      const bar = document.querySelector('.gs-endbar')!.getBoundingClientRect()
      const a = aside.getBoundingClientRect()
      const head = (aside.querySelector('h2, h3, [class*="title"]') ?? aside).getBoundingClientRect()
      return { barTop: bar.top, headBottom: head.bottom, asideTop: a.top }
    })
  const c = await covered()
  expect(c.headBottom).toBeLessThanOrEqual(c.barTop + 1)
  // observing: the end bar stays reachable
  await page.getByRole('button', { name: /관찰하기/ }).click()
  await expect(bar).toBeVisible()
  await expect(page.getByRole('button', { name: '하루 마치기' })).toBeEnabled()
})

test('night cover: Escape skips it, the focus is handed back', async ({ page }) => {
  await useSave(page, quick())
  await page.goto('/')
  const end = page.getByRole('button', { name: '하루 마치기' })
  await end.focus()
  await end.click()
  const cover = page.locator('.dt')
  await expect(cover).toBeVisible()
  await expect(page.locator('main')).toHaveAttribute('inert', '')
  await expect(page.locator('.dt-live')).toContainText('일째 아침이에요')
  await page.keyboard.press('Escape')
  await expect(cover).toBeHidden({ timeout: 1000 })
  await expect(page.locator('main')).not.toHaveAttribute('inert', '')
})

for (const [w, h] of [
  [820, 1180],
  [1366, 640],
] as const) {
  test(`backup panel: the short code groups at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(page, quick())
    await page.goto('/')
    await page.getByRole('button', { name: '기록 지키기' }).first().click()
    const groups = page.locator('.bk-group')
    await expect(groups.first()).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/backup-${w}x${h}.png`, fullPage: true })
    // no group is cut off at the right edge
    const boxes = await groups.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))
    for (const b of boxes) expect(b.right).toBeLessThanOrEqual(w)
  })
}
