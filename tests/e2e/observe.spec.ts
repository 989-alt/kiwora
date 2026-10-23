import type { Page } from '@playwright/test'
import { centerOf, doObserve, drag, expect, saveWith, test, useSave } from './fixtures'
import { OBSERVATIONS } from '../../src/data/observations'

const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'

/** A quick bean in the leaf stage, 7.4 cm tall (the reading is 7 cm), its care done, no weather. */
const bean = (extra = {}) =>
  saveWith({ speciesId: 'bean', stageIndex: 2, heightCm: 7.4, mode: 'quick', careDone: 1, weatherFrom: 99, day: 4, ...extra })

const panel = (page: Page) => page.getByRole('region', { name: '관찰하기' })

async function ready(page: Page) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await page.evaluate(() => document.fonts.ready)
}

/** Ends the quick day and opens the journal; returns the cells of the journal's first day row. */
async function journalRow(page: Page) {
  // the rest of today's observing (the other tool), so 하루 마치기 ends the day
  if ((await page.getByRole('button', { name: '관찰 마치기' }).count()) > 0) await page.getByRole('button', { name: '관찰 마치기' }).click()
  await doObserve(page)
  await page.getByRole('button', { name: '하루 마치기' }).click()
  await expect(page.locator('.nt')).toBeHidden({ timeout: 3200 })
  await page.getByRole('button', { name: '관찰 일지' }).click()
  const row = page.getByRole('table').getByRole('row').nth(1)
  await expect(row).toBeVisible()
  return row.getByRole('cell').allTextContents()
}

/** Drags the ruler from the tool row onto the scene, right of the pot. */
async function dragRuler(page: Page) {
  await page.getByRole('button', { name: '관찰하기' }).click()
  const from = await centerOf(page, page.getByRole('button', { name: '자' }))
  const pot = await centerOf(page, '.pv-pot-hit')
  await drag(page, from, { x: pot.x + 90, y: pot.y - 60 })
  await expect(page.locator('.obs-ruler-body')).toBeVisible()
}

test.describe('observe at 1194x834', () => {
  test.use({ viewport: { width: 1194, height: 834 } })

  test('drag the ruler, read it: the journal has 내가 잰 키', async ({ page, browserName }) => {
    await useSave(page, bean())
    await page.goto('/')
    await dragRuler(page)
    // the ruler stands where it was let go: right of the pot, its 0 mark on the soil line
    const scene = (await page.locator('.pv').boundingBox())!
    const body = (await page.locator('.obs-ruler-body').boundingBox())!
    const pot = await centerOf(page, '.pv-pot-hit')
    expect(Math.abs(body.x + body.width / 2 - (pot.x + 90))).toBeLessThan(3)
    expect(body.y).toBeGreaterThanOrEqual(scene.y)
    if (browserName === 'chromium') {
      await ready(page)
      await page.screenshot({ path: `${SHOTS}/observe-ruler-1194x834.png` })
    }
    await panel(page).getByRole('button', { name: '7 cm' }).click()
    await expect(panel(page).getByText('내가 잰 키는 7 cm예요. 일지에 적었어요.')).toBeVisible()
    const cells = await journalRow(page)
    expect(cells[3]).toBe('7 cm')
  })

  test('two misses light the right mark; tapping it records 7 cm (도움)', async ({ page, browserName }) => {
    await useSave(page, bean())
    await page.goto('/')
    await dragRuler(page)
    const wrong = (await panel(page).locator('.obs-choice').allTextContents()).filter((t) => t !== '7 cm')
    expect(wrong).toHaveLength(2)
    await panel(page).getByRole('button', { name: wrong[0] }).click()
    await expect(panel(page).getByText('다시 보아요')).toBeVisible()
    await panel(page).getByRole('button', { name: wrong[1] }).click()
    const tick = page.getByRole('button', { name: '7 cm 눈금' })
    await expect(tick).toBeVisible()
    await expect(panel(page).getByRole('button', { name: '7 cm' })).toHaveClass(/obs-choice--hint/)
    if (browserName === 'chromium') {
      await ready(page)
      await page.screenshot({ path: `${SHOTS}/observe-ruler-hint-1194x834.png` })
    }
    await tick.click()
    const cells = await journalRow(page)
    expect(cells[3]).toBe('7 cm (도움)')
  })

  test('the magnifier: the picked sentence is in the journal (관찰한 것)', async ({ page, browserName }) => {
    await useSave(page, bean())
    await page.goto('/')
    await page.getByRole('button', { name: '관찰하기' }).click()
    await page.getByRole('button', { name: '돋보기' }).click()
    await expect(page.locator('.obs-lens')).toBeVisible()
    const options = await panel(page).locator('.obs-choice').allTextContents()
    const yes = options.filter((o) => OBSERVATIONS.bean.leafStem!.yes.includes(o))
    expect(yes).toHaveLength(1)
    if (browserName === 'chromium') {
      await ready(page)
      await page.screenshot({ path: `${SHOTS}/observe-magnifier-1194x834.png` })
    }
    await panel(page).getByRole('button', { name: yes[0] }).click()
    await expect(panel(page).getByText('일지에 적었어요.')).toBeVisible()
    const cells = await journalRow(page)
    expect(cells[6]).toBe(yes[0])
  })

  test('the dandelion flower head is inside the room scene', async ({ page, browserName }) => {
    await useSave(page, saveWith({ speciesId: 'dandelion', stageIndex: 4, heightCm: 23.5, mode: 'quick', careDone: 1, weatherFrom: 99, place: 'window' }))
    await page.goto('/')
    await ready(page)
    const scene = (await page.locator('.pv').boundingBox())!
    const top = await page.evaluate(() => {
      const img = document.querySelector('[data-layer="plant"]') as HTMLImageElement
      return img.getBoundingClientRect().top
    })
    // the picture box starts at or below the scene top (its own top margin is transparent)
    expect(top).toBeGreaterThanOrEqual(scene.y - 1)
    if (browserName === 'chromium') await page.screenshot({ path: `${SHOTS}/observe-dandelion-flower-1194x834.png` })
  })
})

for (const [w, h] of [[1194, 834], [1180, 820], [1366, 640], [820, 1180]])
  test(`the tool row holds [관찰하기] without squeezing the other tools (${w}x${h})`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(page, bean())
    await page.goto('/')
    await ready(page)
    const over = await page.locator('.gs-tools').evaluate((row) =>
      [...row.querySelectorAll<HTMLElement>('.tool, .slot')]
        .filter((t) => t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1)
        .map((t) => t.textContent),
    )
    expect(over).toEqual([])
    const names = await page.locator('.gs-tools .tool-name').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
    // every tool name is on one line
    for (const n of names) expect(n).toBeLessThan(34)
    if (browserName === 'chromium') await page.screenshot({ path: `${SHOTS}/observe-tools-${w}x${h}.png` })
  })

test('portrait 820x1180: ruler and magnifier, the choices under the tools', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await useSave(page, bean())
  await page.goto('/')
  await dragRuler(page)
  await expect(panel(page)).toBeVisible()
  if (browserName === 'chromium') {
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/observe-ruler-820x1180.png`, fullPage: true })
  }
  await panel(page).getByRole('button', { name: '7 cm' }).click()
  await page.getByRole('button', { name: '돋보기' }).click()
  await expect(page.locator('.obs-lens')).toBeVisible()
  if (browserName === 'chromium') {
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/observe-magnifier-820x1180.png`, fullPage: true })
  }
})

test('print: the 8 journal columns fit the A4 page width', async ({ page }) => {
  const long = '꼬투리 안에 씨가 들어 있어요'
  const day = (n: number) => ({
    day: n,
    dateKey: '2026-10-20',
    stage: 'leafStem',
    heightCm: 7 + n,
    leaves: 6,
    actions: { waterAdded: 30, pellets: 1, bugsRemoved: 2, place: 'window', care: ['stake'], tied: true },
    statuses: {
      water: { level: 2, dir: 'low' },
      light: { level: 4, dir: null },
      temp: { level: 4, dir: null },
      nutrient: { level: 4, dir: null },
      pest: { level: 4, dir: null },
    },
    measuredCm: 7 + n,
    measureHelped: n % 2 === 0,
    observed: long,
  })
  await useSave(page, { ...bean(), journal: [1, 2, 3, 4].map(day) } as unknown as ReturnType<typeof bean>)
  // A4 portrait minus 12 mm margins on each side: 186 mm = about 703 CSS px
  await page.setViewportSize({ width: 703, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: '관찰 일지' }).click()
  await page.emulateMedia({ media: 'print' })
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveCount(8)
  const fit = await table.evaluate((t) => {
    const r = t.getBoundingClientRect()
    const cells = [...t.querySelectorAll('th, td')].map((c) => c.getBoundingClientRect().right)
    return { right: r.right, widest: Math.max(...cells), scroll: document.documentElement.scrollWidth, font: getComputedStyle(t).fontSize }
  })
  expect(fit.right).toBeLessThanOrEqual(703)
  expect(fit.widest).toBeLessThanOrEqual(703)
  expect(fit.scroll).toBeLessThanOrEqual(703)
  expect(fit.font).toBe('12px')
})

// The scene sizes tests/ui/PlantView.test.tsx and tests/ui/observe.test.tsx check the plant top in:
// without and with the '오늘 할 일' band (a care due), at the 6 viewports.
const SCENE_SIZES: { vw: number; vh: number; plain: [number, number]; band: [number, number] }[] = [
  { vw: 1194, vh: 834, plain: [746, 584], band: [746, 516] },
  { vw: 1280, vh: 800, plain: [832, 550], band: [832, 482] },
  { vw: 1366, vh: 640, plain: [936, 416], band: [936, 358] },
  { vw: 1366, vh: 768, plain: [918, 518], band: [918, 450] },
  { vw: 820, vh: 1180, plain: [764, 632], band: [764, 632] },
  { vw: 768, vh: 1024, plain: [712, 565], band: [712, 565] },
]
for (const s of SCENE_SIZES)
  for (const band of [false, true])
    test(`scene size ${s.vw}x${s.vh} ${band ? 'with' : 'without'} the today band`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'sizes are measured once')
      await page.setViewportSize({ width: s.vw, height: s.vh })
      // a bean in the leaf stage: its stake is due (band) or done (no band)
      await useSave(page, bean({ careDone: band ? 0 : 1 }))
      await page.goto('/')
      await expect(page.getByRole('status', { name: '오늘 할 일' })).toHaveCount(band ? 1 : 0)
      await ready(page)
      const box = await page.locator('.pv').evaluate((el) => [el.clientWidth, el.clientHeight])
      expect(box).toEqual(band ? s.band : s.plain)
    })

/** Opens the magnifier and returns the boxes of the scene, the frame, the round picture and the choices. */
async function openMagnifier(page: Page) {
  await page.getByRole('button', { name: '관찰하기' }).click()
  await page.getByRole('button', { name: '돋보기' }).click()
  await expect(page.locator('.obs-lens-frame')).toBeVisible()
  await ready(page)
  const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!
  const choices = await Promise.all((await page.locator('.obs-choice').all()).map(async (c) => (await c.boundingBox())!))
  return { scene: await box('.pv'), frame: await box('.obs-lens-frame'), glass: await box('.obs-lens'), choices }
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

for (const [w, h] of [[1194, 834], [820, 1180], [1280, 800], [1366, 768], [1366, 640], [1180, 820]])
  for (const band of [false, true])
    test(`the clay magnifier is held in the scene, clear of the choices (${w}x${h}, ${band ? 'with' : 'without'} the today band)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await useSave(page, bean({ careDone: band ? 0 : 1 }))
      await page.goto('/')
      await expect(page.getByRole('status', { name: '오늘 할 일' })).toHaveCount(band ? 1 : 0)
      const b = await openMagnifier(page)
      // the whole frame, handle too, inside the scene
      expect(b.frame.x).toBeGreaterThanOrEqual(b.scene.x - 1)
      expect(b.frame.y).toBeGreaterThanOrEqual(b.scene.y - 1)
      expect(b.frame.x + b.frame.width).toBeLessThanOrEqual(b.scene.x + b.scene.width + 1)
      expect(b.frame.y + b.frame.height).toBeLessThanOrEqual(b.scene.y + b.scene.height + 1)
      // the round picture sits in the frame's lens
      expect(b.glass.x).toBeGreaterThan(b.frame.x)
      expect(b.glass.y).toBeGreaterThan(b.frame.y)
      expect(b.choices).toHaveLength(3)
      for (const c of b.choices) expect(overlaps(b.frame, c)).toBe(false)
    })

test('magnifier shots: a sown seed, a tall corn, an apple tree in the yard', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'shots once')
  await page.setViewportSize({ width: 1194, height: 834 })
  const cases = [
    { name: 'seed', save: saveWith({ speciesId: 'bean', stageIndex: 0, heightCm: 0, mode: 'quick', careDone: 1, weatherFrom: 99, day: 2 }) },
    { name: 'corn-fruit', save: saveWith({ speciesId: 'corn', stageIndex: 4, heightCm: 150, mode: 'quick', careDone: 0, weatherFrom: 99, day: 30 }) },
    { name: 'apple-tree', save: saveWith({ speciesId: 'apple', stageIndex: 3, heightCm: 180, mode: 'quick', careDone: 1, weatherFrom: 99, day: 30, place: 'yardSunny' }) },
  ]
  for (const c of cases) {
    await page.goto('/')
    await page.evaluate((s) => {
      localStorage.setItem('plantlife.v1', JSON.stringify({ ...s, lastDayKey: null }))
      sessionStorage.setItem('fixture-loaded', '1')
    }, c.save)
    await page.reload()
    const b = await openMagnifier(page)
    expect(b.frame.y + b.frame.height).toBeLessThanOrEqual(b.scene.y + b.scene.height + 1)
    await page.screenshot({ path: `${SHOTS}/observe-magnifier-${c.name}-1194x834.png` })
  }
})
