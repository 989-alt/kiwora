import type { Page } from '@playwright/test'

type PlantOver = Partial<{
  speciesId: string
  stageIndex: number
  heightCm: number
  growth: number
  health: number
  water: number
  nutrient: number
  lightExp: number
  place: string
  bugs: number
  day: number
  /** v2 fields: leave them out to get a v1 plant (daily, current stage care counted as done). */
  mode: 'daily' | 'quick'
  careDone: number
  weatherSeed: number
  weatherFrom: number
}>

export function saveWith(
  plant: PlantOver = {},
  opts: { tutorialSeen?: boolean; dayDone?: boolean; lastReport?: unknown; daysAgo?: number } = {},
) {
  return {
    v: 1,
    plant: {
      speciesId: 'balsam',
      stageIndex: 2,
      growth: 0,
      health: 90,
      water: 60,
      nutrient: 50,
      lightExp: 65,
      place: 'desk',
      bugs: 0,
      day: 4,
      heightCm: 6,
      leaves: 4,
      dead: false,
      history: [],
      ...plant,
    },
    pendingActions: null,
    lastDayKey: null as string | null,
    dayDone: opts.dayDone ?? false,
    journal: [],
    pastTries: [],
    dex: [],
    settings: { sound: false, tutorialSeen: opts.tutorialSeen ?? true },
    lastReport: opts.lastReport ?? null,
    /** lastDayKey is set to this many days before the browser's today. */
    daysAgo: opts.daysAgo ?? 0,
  }
}

/** Injects the save before the app loads (once per test, so reloads keep the app's own writes). */
export async function useSave(page: Page, save: ReturnType<typeof saveWith>) {
  await page.addInitScript((data) => {
    if (sessionStorage.getItem('fixture-loaded')) return
    sessionStorage.setItem('fixture-loaded', '1')
    const d = new Date()
    d.setDate(d.getDate() - data.daysAgo)
    const pad = (n: number) => String(n).padStart(2, '0')
    data.lastDayKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    localStorage.setItem('plantlife.v1', JSON.stringify(data))
  }, save)
}

/** Press and hold: a real touch on Chromium (CDP), a mouse press elsewhere. */
export async function hold(page: Page, x: number, y: number, ms: number, browserName: string) {
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await page.waitForTimeout(ms)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
    return
  }
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
}

export async function centerOf(page: Page, selector: string | ReturnType<Page['locator']>) {
  const loc = typeof selector === 'string' ? page.locator(selector) : selector
  const b = await loc.boundingBox()
  if (!b) throw new Error('no box')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps)
  }
  await page.mouse.up()
}

/** What to tap for each stage care, in task order (the targets' accessible names and how many taps). */
export const CARE_TAPS: [string, number][][] = [
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

/** Does today's stage care by taps (and brings a potted perennial in to the desk in winter); false = none due. */
export async function doCare(page: Page): Promise<boolean> {
  await page.locator('.gs-tools').waitFor() // the grow screen is up (right after a goto it may not be yet)
  const card = page.getByRole('status', { name: '오늘 할 일' })
  const todo = (await card.count()) > 0 ? ((await card.textContent()) ?? '') : ''
  if (/화분을 책상으로 옮겨/.test(todo)) {
    await page.getByRole('button', { name: /^책상/ }).first().click()
    return true
  }
  for (const taps of CARE_TAPS) {
    const label = (n: string) => new RegExp(`^${n}( \\d+)?$`)
    if ((await page.getByRole('button', { name: label(taps[0][0]) }).count()) === 0) continue
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

/** Picks choices in the observe panel until one is taken (after two misses only the right one is left). */
async function pickUntilRight(page: Page) {
  const panel = page.getByRole('region', { name: '관찰하기' })
  for (let i = 0; i < 3 && (await panel.locator('.obs-choice--right').count()) === 0; i++) {
    const open = panel.locator('.obs-choice:enabled')
    if ((await open.count()) === 0) break
    await open.first().click()
  }
}

/** Today's observing through the screen: the ruler (when it is out) and the magnifier; false = already done. */
export async function doObserve(page: Page): Promise<boolean> {
  await page.locator('.gs-tools').waitFor() // the grow screen is up (right after a goto it may not be yet)
  const open = page.getByRole('button', { name: '관찰하기', exact: true })
  if ((await open.count()) === 0 || !(await open.isEnabled())) return false
  await open.click()
  const ruler = page.getByRole('button', { name: '자', exact: true })
  const title = (t: string) => page.getByRole('region', { name: '관찰하기' }).getByRole('heading', { name: t })
  if ((await ruler.count()) > 0 && (await ruler.isEnabled())) {
    // dragged to the plant (as a student does; a plain click is not a tap on every engine)
    const from = await centerOf(page, ruler)
    const pot = await centerOf(page, '.pv-pot-hit')
    await drag(page, from, { x: pot.x + 90, y: pot.y - 60 })
    await title('자로 키 재기').waitFor()
    await pickUntilRight(page)
  }
  await page.getByRole('button', { name: '돋보기', exact: true }).click()
  await title('돋보기로 보기').waitFor()
  await pickUntilRight(page)
  await page.getByRole('button', { name: '관찰 마치기' }).click()
  return true
}

/**
 * Everything 하루 마치기 asks for first: the morning card closed, today's stage care and today's observing
 * (picking the lit choice after two misses where needed).
 */
export async function doTodaysActivities(page: Page) {
  await page.locator('.gs-tools').waitFor()
  const morning = page.getByRole('button', { name: /일째 아침이에요/ })
  if ((await morning.count()) > 0) await morning.click()
  await doCare(page)
  await doObserve(page)
}
