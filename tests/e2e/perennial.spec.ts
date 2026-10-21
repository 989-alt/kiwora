import { expect, test, type Page } from '@playwright/test'
import { centerOf, drag, saveWith, useSave } from './fixtures'

const SHOTS = '.superpowers/sdd/2026-10-21-plant-life/shots'

const slots = (page: Page) => page.getByRole('group', { name: '화분 자리' })
const sign = (page: Page) => page.getByRole('img', { name: '건강 표지판' })
const pot = (page: Page) => page.getByRole('img', { name: '화분 끌기' })
const COPY = '나무가 커서 화분이 좁아요. 마당에 옮겨 심어요!'

/** An apple one good day short of 'grownTree': ideal water, light and nutrient. */
const appleAlmostGrown = () =>
  saveWith({ speciesId: 'apple', stageIndex: 2, growth: 3.9, water: 62, nutrient: 50, lightExp: 85, place: 'window', health: 100, day: 9 })

async function ready(page: Page) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await page.evaluate(() => document.fonts.ready)
}

test('apple transplant flow', async ({ page }) => {
  await useSave(page, appleAlmostGrown())
  await page.goto('/')
  await expect(slots(page)).toBeVisible()
  await page.getByRole('button', { name: '하루 마치기' }).click()

  await expect(page.getByText(COPY)).toBeVisible()
  for (const [name, line] of [
    ['양지', '햇빛이 하루 종일'],
    ['반그늘', '햇빛이 반나절'],
    ['그늘', '햇빛이 조금'],
  ] as const) {
    const card = page.getByRole('button', { name: new RegExp(`^${name}`) })
    await expect(card).toBeVisible()
    await expect(card).toContainText(line)
    expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  }
  // no way off this screen but a card: it survives a reload
  await page.reload()
  await expect(page.getByText(COPY)).toBeVisible()

  await page.getByRole('button', { name: /^양지/ }).click()
  await expect(page.getByText(COPY)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/사과나무/)
  await expect(slots(page)).toHaveCount(0)
  await expect(pot(page)).toHaveCount(0)
  await expect(page.locator('[data-layer="pot-back"]')).toHaveCount(0)
  await expect(sign(page)).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plantlife.v1') ?? '{}').plant.place)).toBe('yardSunny')

  // stays in the yard after a reload
  await page.reload()
  await expect(slots(page)).toHaveCount(0)
  await expect(sign(page)).toBeVisible()
})

test('in the yard a pellet is dropped on the ground at the trunk', async ({ page }) => {
  await useSave(page, saveWith({ speciesId: 'apple', stageIndex: 3, place: 'yardSunny', nutrient: 10, lightExp: 85 }))
  await page.goto('/')
  const nutrient = page.getByRole('group', { name: /^영양 / })
  await expect(nutrient).toHaveAttribute('aria-label', /부족/)
  await expect(page.getByRole('button', { name: /영양분/ })).toContainText('땅으로 끌어요')
  await drag(page, await centerOf(page, page.getByRole('button', { name: /영양분/ })), await centerOf(page, page.getByRole('img', { name: '나무 밑동' })))
  await expect(nutrient).not.toHaveAttribute('aria-label', /부족/)
})

test('dandelion stays in pot', async ({ page }) => {
  await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 3, growth: 0, place: 'desk' }))
  await page.goto('/')
  await expect(slots(page)).toBeVisible()
  await expect(pot(page)).toBeVisible()
  await expect(page.getByText(COPY)).toHaveCount(0)
  await expect(sign(page)).toHaveCount(0)
})

test('grownTree shows how many years later by growth', async ({ page }) => {
  await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 3, growth: 1.5 }))
  await page.goto('/')
  await expect(page.getByText('1년 뒤')).toBeVisible()
  await expect(page.getByText('2년 뒤')).toHaveCount(0)
})

test('grownTree second half shows 2년 뒤', async ({ page }) => {
  await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 3, growth: 2.5 }))
  await page.goto('/')
  await expect(page.getByText('2년 뒤')).toBeVisible()
  await expect(page.getByText('1년 뒤')).toHaveCount(0)
})

test('other stages show no years badge', async ({ page }) => {
  await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 2, growth: 1 }))
  await page.goto('/')
  await expect(page.getByText(/년 뒤/)).toHaveCount(0)
})

test('winter: snow, leafless look and the winter water band', async ({ page }) => {
  await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 6, water: 30, nutrient: 10, place: 'desk' }))
  await page.goto('/')
  await expect(page.locator('[data-layer="winter"]')).toBeVisible()
  await expect(page.locator('[data-layer="snow"]')).toBeVisible()
  expect(await page.locator('.pv-flake').count()).toBeGreaterThan(10)
  // water 30 is ideal in winter (20..40) but only just-ok in the growing season
  await expect(page.getByRole('group', { name: /^물 / })).toHaveAttribute('aria-label', /매우 좋음/)
  await expect(page.locator('[data-layer="plant"]')).toHaveCSS('opacity', '0.85')
  // snow stays out of the way of the tools
  await expect(page.locator('[data-layer="snow"]')).toHaveCSS('pointer-events', 'none')
})

test('summer has no snow', async ({ page }) => {
  await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 4 }))
  await page.goto('/')
  await expect(page.locator('[data-layer="snow"]')).toHaveCount(0)
  await expect(page.locator('[data-layer="winter"]')).toHaveCount(0)
})

test('snow stands still with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 6 }))
  await page.goto('/')
  await expect(page.locator('.pv-flake').first()).toHaveCSS('animation-name', 'none')
})

test.describe('screenshots', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'screenshots once, on Chromium')

  test('transplant, yard and winter at 1194x834', async ({ page }) => {
    await page.setViewportSize({ width: 1194, height: 834 })
    await useSave(page, appleAlmostGrown())
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: '하루 마치기' }).click()
    await expect(page.getByText(COPY)).toBeVisible()
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/transplant-1194.png`, fullPage: true })
    await page.getByRole('button', { name: /^양지/ }).click()
    await expect(sign(page)).toBeVisible()
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/yard-1194.png`, fullPage: true })
  })

  for (const place of ['yardPartial', 'yardShade'] as const) {
    test(`yard scene ${place}`, async ({ page }) => {
      await page.setViewportSize({ width: 1194, height: 834 })
      await useSave(page, saveWith({ speciesId: 'apple', stageIndex: 3, place, health: 40 }))
      await page.goto('/')
      await ready(page)
      await expect(sign(page)).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/yard-${place}-1194.png` })
    })
  }

  test('winter in the yard', async ({ page }) => {
    await page.setViewportSize({ width: 1194, height: 834 })
    await useSave(page, saveWith({ speciesId: 'apple', stageIndex: 6, place: 'yardSunny', water: 30, nutrient: 10 }))
    await page.goto('/')
    await ready(page)
    await expect(page.locator('[data-layer="snow"]')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/winter-1194.png` })
  })

  test('winter in the room', async ({ page }) => {
    await page.setViewportSize({ width: 1194, height: 834 })
    await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 6, place: 'desk', water: 30, nutrient: 10 }))
    await page.goto('/')
    await ready(page)
    await expect(page.locator('[data-layer="snow"]')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/winter-room-1194.png` })
  })
})
