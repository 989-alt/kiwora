import { expect, test, type Page } from '@playwright/test'
import { newPlant } from '../../src/sim/day'
import { SPECIES, type SpeciesId } from '../../src/sim/species'
import { weatherOn } from '../../src/sim/weather'
import type { WeatherId } from '../../src/sim/types'
import { centerOf, drag, hold } from './fixtures'

/** Full v2 flows through the real screens: pick, morning card, care by taps, water, end the day, ... */
test.setTimeout(240_000)
test.use({ actionTimeout: 8000 })

/** What to tap for each stage care (the same targets the care e2e uses). */
const CARE_TAPS: [string, number][][] = [
  [['흙에 씨 놓기', 3], ['흙 덮기', 3]],
  [['약한 싹 뽑기', 2]],
  [['지지대 꽂을 자리', 1]],
  [['지지대 꽂을 자리', 1], ['줄기에 덩굴 감기', 3]],
  [['왼쪽 흙 북돋우기', 2], ['오른쪽 흙 북돋우기', 1]],
  [['곁가지 자르기', 2]],
  [['물받이 살펴보기', 1]],
  [['마른 가지 자르기', 3]],
  [['꽃가루 묻히기', 1], ['다른 꽃에 꽃가루 옮기기', 1]],
  [['포기 흔들기', 3]],
  [['열매 따기', 3]],
  [['짚 감쌀 밑동', 1]],
]

/**
 * A weather seed whose weather (over every stage of the plant, from day 2 to 45) holds only the given kinds, and
 * which has at least one of `want`. The flow then needs no preparing beyond "no water on a rain day".
 */
function seedWith(id: SpeciesId, place: (stageIndex: number) => 'desk' | 'yardSunny', allowed: WeatherId[], want: WeatherId): number {
  for (let seed = 0; seed < 256; seed++) {
    const seen = new Set<WeatherId>()
    for (let stageIndex = 0; stageIndex < SPECIES[id].stages.length; stageIndex++)
      for (let day = 2; day <= 45; day++) {
        const p = { ...newPlant(id), weatherSeed: seed, weatherFrom: 2, stageIndex, day, place: place(stageIndex) }
        const w = weatherOn(p, day)
        if (w) seen.add(w)
      }
    if ([...seen].every((k) => allowed.includes(k)) && seen.has(want)) return seed
  }
  throw new Error('no seed')
}

const todoText = async (page: Page) => (await page.getByRole('status', { name: '오늘 할 일' }).textContent().catch(() => '')) ?? ''
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('plantlife.v1') ?? '{}') as Record<string, any>)

async function pick(page: Page, species: RegExp, mode: RegExp, seed: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: species }).click()
  await page.waitForTimeout(450) // the mode dialog ignores taps for a moment
  await page.getByRole('button', { name: mode }).click()
  // a fixed weather seed, so the run is the same every time
  await page.evaluate((s) => {
    const d = JSON.parse(localStorage.getItem('plantlife.v1')!)
    d.plant.weatherSeed = s
    d.settings.tutorialSeen = true
    localStorage.setItem('plantlife.v1', JSON.stringify(d))
  }, seed)
  await page.reload()
}

async function doCare(page: Page): Promise<boolean> {
  for (const taps of CARE_TAPS) {
    const label = (n: string) => new RegExp(`^${n}( \\d+)?$`)
    const first = page.getByRole('button', { name: label(taps[0][0]) })
    if ((await first.count()) === 0) continue
    for (const [name, n] of taps)
      for (let i = 0; i < n; i++) {
        const t = page.getByRole('button', { name: label(name) }).first()
        if ((await t.count()) === 0) break
        await t.tap()
      }
    return true
  }
  return false
}

/** One day: close the morning card, do the care by taps, water unless it rains, end the day. */
async function playDay(page: Page, browserName: string) {
  const morning = page.getByRole('button', { name: /일째 아침이에요/ })
  if ((await morning.count()) > 0) await morning.click()
  const yard = page.getByRole('button', { name: /^해가 잘 드는 곳/ })
  if ((await yard.count()) > 0) {
    await yard.click()
    return
  }
  await doCare(page)
  // a typhoon day: the tree is tied with a tap
  const trunk = page.getByRole('button', { name: '묶을 나무 밑동' })
  if ((await trunk.count()) > 0 && /태풍이 와요/.test(await todoText(page))) await trunk.tap()
  // bugs are caught (a monsoon day is judged on them)
  for (let i = 0; i < 6 && (await page.getByRole('button', { name: /^벌레 잡기/ }).count()) > 0; i++)
    await page.getByRole('button', { name: /^벌레 잡기/ }).first().click()
  const text = await todoText(page)
  const rainy = /비가 와요|장마/.test(text)
  const s = await stored(page)
  if (!rainy) {
    const can = page.getByRole('button', { name: /물 주기/ })
    for (let i = 0; i < 4 && (await stored(page)).plant.water < 60 && (await can.isEnabled()); i++) {
      const c = await centerOf(page, can)
      await hold(page, c.x, c.y, 1200, browserName)
    }
  }
  if ((await stored(page)).plant.nutrient < 30) {
    const pellet = page.getByRole('button', { name: /영양분/ })
    if (await pellet.isEnabled()) await drag(page, await centerOf(page, pellet), await centerOf(page, '.pv-pot-hit'))
  }
  const end = page.getByRole('button', { name: '하루 마치기' })
  if (await end.isEnabled()) await end.click()
  await expect(page.locator('.nt')).toBeHidden({ timeout: 6000 })
}

test('balsam, 한 번에 키우기: care by taps, a measurement, the finished journal and the dex', async ({ page, browserName }) => {
  const seed = seedWith('balsam', () => 'desk', ['rain', 'cold', 'heat', 'monsoon'], 'monsoon')
  await pick(page, /봉숭아/, /^한 번에 키우기/, seed)
  // the pot goes to the desk (heat and cold days then do no harm)
  await page.getByRole('button', { name: /^책상/ }).first().click()

  let measured = false
  for (let day = 0; day < 90; day++) {
    if ((await stored(page)).finished?.balsam) break
    if (!measured && (await stored(page)).plant.heightCm >= 3 && (await page.getByRole('button', { name: '관찰하기' }).count()) > 0) {
      const morning = page.getByRole('button', { name: /일째 아침이에요/ })
      if ((await morning.count()) > 0) await morning.click()
      await page.getByRole('button', { name: '관찰하기' }).click()
      const ruler = page.getByRole('button', { name: '자' })
      if ((await ruler.count()) > 0) {
        const from = await centerOf(page, ruler)
        const pot = await centerOf(page, '.pv-pot-hit')
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move(pot.x + 90, pot.y - 60, { steps: 8 })
        await page.mouse.up()
        const panel = page.getByRole('region', { name: '관찰하기' })
        const picks = await panel.locator('.obs-choice').count()
        for (let i = 0; i < picks && !measured; i++) {
          await panel.locator('.obs-choice').nth(i).click()
          measured = (await panel.getByText(/내가 잰 키는/).count()) > 0
        }
        await page.getByRole('button', { name: '관찰 마치기' }).click()
      }
    }
    try {
      await playDay(page, browserName)
    } catch (e) {
      const st = await stored(page)
      console.log('DEBUG', day, JSON.stringify({ plant: st.plant, dead: st.plant?.dead, fin: Object.keys(st.finished ?? {}), dex: st.dex }), (await page.locator('body').innerText()).slice(0, 400))
      throw e
    }
  }
  expect(measured).toBe(true)
  const end = await stored(page)
  expect(end.finished?.balsam).toBeTruthy()
  // the dex: 1/9, the finished journal with the 한 번에 badge, N일째 in the date column, one measurement
  await page.goto('/')
  await page.getByRole('button', { name: /^씨 도감/ }).click()
  await expect(page.getByText('1/9')).toBeVisible()
  await expect(page.locator('.mode-badge--quick')).toBeVisible()
  await page.getByRole('button', { name: '봉숭아 관찰 일지 보기' }).click()
  const table = page.getByRole('table')
  await expect(page.locator('.mode-badge--quick')).toBeVisible()
  const rows = await table.getByRole('row').all()
  const firstCell = await rows[1].getByRole('cell').first().textContent()
  expect(firstCell).toMatch(/^\d+일째$/)
  const measuredCells = await table.locator('tbody tr td:nth-child(4)').allTextContents()
  expect(measuredCells.filter((t) => /cm/.test(t))).toHaveLength(1)
})

test('apple, 한 번에 키우기: transplant to the yard, pruning, pollinating, harvest and the winter straw', async ({ page, browserName }) => {
  const seed = seedWith('apple', (i) => (i >= 3 ? 'yardSunny' : 'desk'), ['rain', 'heat', 'monsoon', 'cold', 'frost', 'typhoon'], 'typhoon')
  await pick(page, /사과나무/, /^한 번에 키우기/, seed)
  await page.getByRole('button', { name: /^책상/ }).first().click()

  const done = async () => {
    const j = ((await stored(page)).journal ?? []) as { actions: { care?: string[]; place: string } }[]
    return j.some((e) => e.actions.care?.includes('winterWrap'))
  }
  for (let day = 0; day < 120 && !(await done()); day++) {
    try {
      await playDay(page, browserName)
    } catch (e) {
      const st = await stored(page)
      console.log('DEBUG', day, JSON.stringify({ plant: { ...st.plant, history: undefined }, care: st.pendingActions }), (await page.locator('body').innerText()).slice(0, 300))
      throw e
    }
  }
  expect(await done()).toBe(true)
  const st = await stored(page)
  const care = (st.journal as { actions: { care?: string[]; place: string } }[]).flatMap((e) => e.actions.care ?? [])
  for (const c of ['drainCheck', 'prune', 'pollinate', 'harvest', 'winterWrap']) expect(care, c).toContain(c)
  expect(st.plant.place).toBe('yardSunny')
  // the journal words the care and the dates read N일째
  await page.getByRole('button', { name: '관찰 일지' }).click()
  const table = page.getByRole('table')
  await expect(table).toContainText('가지치기')
  await expect(table).toContainText('짚으로 감싸기')
  expect(await table.getByRole('row').nth(1).getByRole('cell').first().textContent()).toMatch(/^\d+일째$/)
})
