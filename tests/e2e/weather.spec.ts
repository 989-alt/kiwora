import { expect, test, type Page } from '@playwright/test'
import { newPlant } from '../../src/sim/day'
import { SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { WeatherId } from '../../src/sim/types'
import { weatherOn } from '../../src/sim/weather'
import { doTodaysActivities, saveWith, useSave } from './fixtures'

const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'
const VIEWPORTS = [
  { w: 1194, h: 834 },
  { w: 820, h: 1180 },
]

/** A weather seed whose schedule gives `want` on the days listed (null = calm). */
function seedWith(species: SpeciesId, stage: StageId, want: Record<number, WeatherId | null>): number {
  const base = { ...newPlant(species), stageIndex: SPECIES[species].stages.indexOf(stage) }
  for (let seed = 0; seed < 256; seed++) {
    if (Object.entries(want).every(([d, k]) => weatherOn({ ...base, weatherSeed: seed }, Number(d)) === k)) return seed
  }
  throw new Error('no seed')
}

const endDay = (page: Page) => page.getByRole('button', { name: '하루 마치기' })
const title = (page: Page) => page.getByRole('heading', { level: 1 })
const boardRow = (page: Page) => page.getByRole('group', { name: /^오늘의 날씨/ })
const morning = (page: Page) => page.locator('.morning')
const loaded = (page: Page) => page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))

/** Balsam at the leaf-and-stem stage on the window: calm on day 4, heat on day 5, any weather after. */
const heatSave = (extra = {}) =>
  saveWith({
    speciesId: 'balsam',
    stageIndex: SPECIES.balsam.stages.indexOf('leafStem'),
    mode: 'quick',
    careDone: 1,
    day: 4,
    place: 'window',
    weatherFrom: 2,
    weatherSeed: seedWith('balsam', 'leafStem', { 4: null, 5: 'heat' }),
    ...extra,
  })

for (const { w, h } of VIEWPORTS) {
  test(`quick: forecast at night, weather on the morning card, prep on the board, handled next morning (${w}x${h})`, async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(page, heatSave())
    await page.goto('/')
    await expect(title(page)).toHaveAttribute('aria-label', /4일째/)
    await expect(boardRow(page)).toContainText('맑아요')

    await doTodaysActivities(page)

    await endDay(page).click()
    const forecast = page.locator('.nt-forecast')
    await expect(forecast).toHaveAttribute('data-forecast', 'heat')
    await expect(forecast).toContainText('내일은 아주 더워요! 창가는 뜨거울 거예요.')
    await expect(page.locator('.nt')).toHaveAttribute('data-phase', 'night')
    await page.waitForTimeout(700)
    if (browserName === 'chromium') {
      await loaded(page)
      await page.screenshot({ path: `${SHOTS}/weather-night-quick-${w}x${h}.png` })
    }
    // the forecast keeps the night 2 s longer than a calm night, then the next morning comes
    await expect(page.locator('.nt')).toBeHidden({ timeout: 6000 })
    await expect(title(page)).toHaveAttribute('aria-label', /5일째/)

    // the morning card leads with today's weather; the board says what is still to do
    await expect(morning(page)).toContainText('오늘은 아주 더워요! 창가에서 옮겨요.')
    await expect(boardRow(page)).toContainText('폭염')
    await expect(boardRow(page)).toContainText('대비가 필요해요')
    await expect(page.getByRole('status', { name: '오늘 할 일' })).toContainText('창가에서 옮겨요')
    await expect(page.getByRole('group', { name: /^온도/ })).toHaveAttribute('aria-label', /위험/)
    if (browserName === 'chromium') {
      await loaded(page)
      await page.screenshot({ path: `${SHOTS}/weather-morning-${w}x${h}.png`, fullPage: true })
    }

    // off the window: prepared
    await page.locator('[data-slot="desk"]').click()
    await expect(boardRow(page)).toContainText('대비했어요')
    await expect(page.getByRole('status', { name: '오늘 할 일' })).toHaveCount(0)
    if (browserName === 'chromium') await page.screenshot({ path: `${SHOTS}/weather-board-${w}x${h}.png`, fullPage: true })

    // end the day: the next morning says it was handled
    await doTodaysActivities(page)
    await endDay(page).click()
    await expect(page.locator('.nt')).toBeHidden({ timeout: 6000 })
    await expect(title(page)).toHaveAttribute('aria-label', /6일째/)
    await expect(morning(page)).toContainText('어제 폭염에 잘 대비했어요')
  })

  test(`daily: the night scene shows tomorrow's forecast and keeps it after a reload (${w}x${h})`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(page, heatSave({ mode: 'daily' }))
    await page.goto('/')
    await doTodaysActivities(page)
    await endDay(page).click()
    await expect(page.locator('.nt')).toBeHidden({ timeout: 6000 })
    const slot = page.locator('.gs-scene .gs-night-forecast')
    await expect(slot).toBeVisible()
    await expect(slot).toContainText('내일은 아주 더워요! 창가는 뜨거울 거예요.')
    await expect(slot.locator('img')).toHaveAttribute('src', /weather\/heat\.webp/)
    // tomorrow's weather is not today's: the board still tells the day that ended (calm), and no card
    await expect(boardRow(page)).toContainText('맑아요')
    await expect(morning(page)).toHaveCount(0)
    if (browserName === 'chromium') {
      await loaded(page)
      await page.screenshot({ path: `${SHOTS}/weather-night-daily-${w}x${h}.png` })
    }
    await page.reload()
    await expect(slot).toBeVisible()
  })

  test(`typhoon: the apple in the yard is tied with a tap (${w}x${h})`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: w, height: h })
    await useSave(
      page,
      saveWith({
        speciesId: 'apple',
        stageIndex: SPECIES.apple.stages.indexOf('fruit'),
        mode: 'quick',
        careDone: 1,
        day: 6,
        place: 'yardSunny',
        weatherFrom: 2,
        weatherSeed: seedWith('apple', 'fruit', { 6: 'typhoon' }),
      }),
    )
    await page.goto('/')
    await expect(boardRow(page)).toContainText('태풍')
    await expect(boardRow(page)).toContainText('대비가 필요해요')
    await expect(page.getByRole('status', { name: '오늘 할 일' })).toContainText('태풍이 와요! 나무를 지지대에 묶어요.')
    const trunk = page.getByRole('button', { name: '묶을 나무 밑동' })
    await expect(trunk).toBeVisible()
    if (browserName === 'chromium') {
      await loaded(page)
      await page.screenshot({ path: `${SHOTS}/weather-typhoon-tie-${w}x${h}.png`, fullPage: true })
    }
    await trunk.tap()
    await expect(boardRow(page)).toContainText('대비했어요')
    await expect(trunk).toHaveCount(0)
    await expect(page.getByText('나무를 지지대에 묶었어요')).toBeVisible()
    await page.waitForTimeout(700) // the string rings finish their little pop
    if (browserName === 'chromium') await page.screenshot({ path: `${SHOTS}/weather-typhoon-tied-${w}x${h}.png`, fullPage: true })
    // the tie survives a reload
    await page.reload()
    await expect(boardRow(page)).toContainText('대비했어요')
    // and the morning after says so
    await doTodaysActivities(page)
    await endDay(page).click()
    await expect(page.locator('.nt')).toBeHidden({ timeout: 6000 })
    await expect(morning(page)).toContainText('어제 태풍에 잘 대비했어요')
  })
}

test('1366x640: the 오늘의 날씨 row and 하루 마치기 are on screen together (typhoon and frost days)', async ({ browser }) => {
  const cases: { stage: StageId; careDone: number; day: number; kind: WeatherId }[] = [
    { stage: 'fruit', careDone: 1, day: 6, kind: 'typhoon' },
    { stage: 'winter', careDone: 0, day: 8, kind: 'frost' },
  ]
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 640 }, hasTouch: true })
    const p = await ctx.newPage()
    await useSave(
      p,
      saveWith({
        speciesId: 'apple',
        stageIndex: SPECIES.apple.stages.indexOf(c.stage),
        mode: 'quick',
        careDone: c.careDone,
        day: c.day,
        place: 'yardSunny',
        weatherFrom: 2,
        weatherSeed: seedWith('apple', c.stage, { [c.day]: c.kind }),
      }),
    )
    await p.goto('/')
    const row = boardRow(p)
    await expect(row).toBeVisible()
    await expect(row).toContainText(c.kind === 'typhoon' ? '태풍' : '서리')
    const rb = (await row.boundingBox())!
    const eb = (await endDay(p).boundingBox())!
    expect(rb.y).toBeGreaterThanOrEqual(0)
    expect(rb.y + rb.height).toBeLessThanOrEqual(640)
    expect(eb.y + eb.height).toBeLessThanOrEqual(640)
    // the whole board fits beside 하루 마치기 (it does not scroll inside)
    const fits = await p.locator('.gs-aside .sb').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)
    expect(fits).toBe(true)
    // the to-do band names what to do (on a frost day the winter care line says the straw wrap)
    await expect(p.getByRole('status', { name: '오늘 할 일' })).toContainText(c.kind === 'typhoon' ? '태풍이 와요' : '짚으로 감싸')
    await loaded(p)
    await p.screenshot({ path: `${SHOTS}/weather-${c.kind}-1366x640.png` })
    await ctx.close()
  }
})
