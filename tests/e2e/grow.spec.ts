import { expect, test } from '@playwright/test'
import { centerOf, drag, hold, saveWith, useSave } from './fixtures'

const waterRow = (page: import('@playwright/test').Page) => page.getByRole('group', { name: /^물 / })
const nutrientRow = (page: import('@playwright/test').Page) => page.getByRole('group', { name: /^영양 / })
const pot = (page: import('@playwright/test').Page) => page.getByRole('img', { name: '화분 끌기' })

test('hold watering can raises water', async ({ page, browserName }) => {
  await useSave(page, saveWith({ water: 20 }))
  await page.goto('/')
  await expect(waterRow(page)).toHaveAttribute('aria-label', /부족/)
  const c = await centerOf(page, page.getByRole('button', { name: /물 주기/ }))
  await hold(page, c.x, c.y, 2000, browserName)
  await expect(waterRow(page)).not.toHaveAttribute('aria-label', /부족/)
})

test('drag pot to window', async ({ page }) => {
  await useSave(page, saveWith({ place: 'desk' }))
  await page.goto('/')
  const windowSlot = page.getByRole('button', { name: '창가' })
  await expect(windowSlot).toHaveAttribute('aria-pressed', 'false')
  await drag(page, await centerOf(page, pot(page)), await centerOf(page, windowSlot))
  await expect(windowSlot).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '책상' })).toHaveAttribute('aria-pressed', 'false')
})

test('tap slot also moves', async ({ page }) => {
  await useSave(page, saveWith({ place: 'desk' }))
  await page.goto('/')
  const shade = page.getByRole('button', { name: '그늘' })
  await shade.tap()
  await expect(shade).toHaveAttribute('aria-pressed', 'true')
})

test('tap bug removes it', async ({ page }) => {
  await useSave(page, saveWith({ bugs: 2 }))
  await page.goto('/')
  const bugs = page.getByRole('button', { name: '벌레 잡기' })
  await expect(bugs).toHaveCount(2)
  await bugs.first().tap()
  await expect(bugs).toHaveCount(1)
  await expect(page.getByRole('group', { name: /^병충해 / })).toHaveAttribute('aria-label', /벌레 1마리/)
})

test('drag a pellet into the pot adds nutrient', async ({ page }) => {
  await useSave(page, saveWith({ nutrient: 10 }))
  await page.goto('/')
  await expect(nutrientRow(page)).toHaveAttribute('aria-label', /부족/)
  await drag(page, await centerOf(page, page.getByRole('button', { name: /영양분/ })), await centerOf(page, pot(page)))
  await expect(nutrientRow(page)).not.toHaveAttribute('aria-label', /부족/)
})

test('long press shows no context menu', async ({ page, browserName }) => {
  await useSave(page, saveWith())
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { menus: number }).menus = 0
    window.addEventListener('contextmenu', (e) => {
      if (!e.defaultPrevented) (window as unknown as { menus: number }).menus++
    })
  })
  const c = await centerOf(page, page.getByRole('button', { name: /물 주기/ }))
  await hold(page, c.x, c.y, 1500, browserName)
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('')
  expect(await page.evaluate(() => (window as unknown as { menus: number }).menus)).toBe(0)
})

test('end day locks tools', async ({ page }) => {
  await useSave(page, saveWith({ bugs: 1, place: 'desk' }))
  await page.goto('/')
  await page.getByRole('button', { name: '하루 마치기' }).click()
  await expect(page.getByText('내일 다시 만나요')).toBeVisible()
  await expect(page.getByRole('button', { name: /물 주기/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /영양분/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: '창가' })).toBeDisabled()
  const bugs = page.getByRole('button', { name: '벌레 잡기' })
  expect(await bugs.count()).toBeGreaterThan(0)
  for (const b of await bugs.all()) await expect(b).toBeDisabled()
  // dragging the pot does nothing
  const windowSlot = page.getByRole('button', { name: '창가' })
  await drag(page, await centerOf(page, pot(page)), await centerOf(page, windowSlot))
  await expect(page.locator('.pot-ghost')).toHaveCount(0)
  await expect(windowSlot).toHaveAttribute('aria-pressed', 'false')
  // the day's result card appears and closes on tap
  const card = page.getByRole('button', { name: /오늘 결과/ })
  await expect(card).toBeVisible()
  await card.tap()
  await expect(card).toHaveCount(0)
})

test('first visit shows three tip bubbles in order', async ({ page }) => {
  await useSave(page, saveWith({ bugs: 1 }, { tutorialSeen: false }))
  await page.goto('/')
  const tips = ['물뿌리개를 꾹 누르면 물이 나와요', '화분을 끌어서 자리를 옮겨요', '벌레를 톡 눌러 잡아요']
  for (const t of tips) {
    const bubble = page.getByRole('button', { name: t })
    await expect(bubble).toBeVisible()
    await bubble.tap()
  }
  await expect(page.getByRole('button', { name: tips[2] })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: tips[0] })).toHaveCount(0)
})

test('header shows species, day and stage', async ({ page }) => {
  await useSave(page, saveWith({ day: 4, stageIndex: 2 }))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('봉숭아 · 4일째 · 잎과 줄기가 자라요')
})

const storedWater = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('plantlife.v1') ?? '{}').plant.water as number)

test('watering stops after release', async ({ page, browserName }) => {
  await useSave(page, saveWith({ water: 20 }))
  await page.goto('/')
  const c = await centerOf(page, page.getByRole('button', { name: /물 주기/ }))
  await hold(page, c.x, c.y, 1000, browserName)
  await page.waitForTimeout(150)
  const after = await storedWater(page)
  expect(after).toBeGreaterThan(20)
  await page.waitForTimeout(1000)
  expect(await storedWater(page)).toBe(after)
  await expect(page.locator('.water-stream')).toHaveCount(0)
})

test('the morning card shows after opening the app the next day', async ({ page }) => {
  const lastReport = {
    statuses: {
      water: { level: 3, dir: null },
      light: { level: 3, dir: null },
      temp: { level: 3, dir: null },
      nutrient: { level: 3, dir: null },
      pest: { level: 4, dir: null },
    },
    healthDelta: 10,
    grew: true,
    stageChanged: false,
    died: false,
    newBugs: 0,
    heightDelta: 2,
  }
  await useSave(page, saveWith({ day: 4 }, { lastReport, daysAgo: 1, dayDone: true }))
  await page.goto('/')
  const card = page.getByRole('button', { name: '4일째 아침! 키가 2cm 자랐어요' })
  await expect(card).toBeVisible()
  await expect(page.getByRole('button', { name: '하루 마치기' })).toBeEnabled()
  await card.tap()
  await expect(card).toHaveCount(0)
})

for (const vp of [
  { width: 1366, height: 640 },
  { width: 1280, height: 700 },
]) {
  test(`end-day button stays on screen at ${vp.width}x${vp.height} with bad statuses`, async ({ page, browserName }) => {
    await page.setViewportSize(vp)
    await useSave(page, saveWith({ water: 5, nutrient: 5, lightExp: 20, place: 'shade', bugs: 3, health: 25 }))
    await page.goto('/')
    await expect(page.getByRole('group', { name: /^물 / })).toHaveAttribute('aria-label', /부족/)
    const box = await page.getByRole('button', { name: '하루 마치기' }).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height)
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width)
    if (browserName === 'chromium') {
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
      await page.screenshot({ path: `.superpowers/sdd/2026-10-21-plant-life/shots/grow-${vp.width}x${vp.height}.png` })
    }
  })
}

for (const [w, h] of [
  [820, 1180],
  [768, 1024],
] as const) {
  test(`portrait ${w}x${h}: 하루 마치기 is always on screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(page, saveWith({ stageIndex: 3, bugs: 2, place: 'window' }))
    await page.goto('/')
    const end = page.getByRole('button', { name: '하루 마치기' })
    const inView = async () => {
      const b = await end.boundingBox()
      if (!b) throw new Error('no end button')
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.y + b.height).toBeLessThanOrEqual(h)
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width).toBeLessThanOrEqual(w)
    }
    await expect(end).toBeVisible()
    await inView()
    // still there with the page scrolled to the status board at the bottom
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await inView()
    // and it is not covering the last status row
    const last = await page.getByRole('group', { name: /^병충해/ }).boundingBox()
    const bar = await end.boundingBox()
    expect(last!.y + last!.height).toBeLessThanOrEqual(bar!.y + 1)
    await end.click()
    await expect(page.getByRole('button', { name: '내일 다시 만나요' })).toBeVisible()
  })
}
