import type { Page } from '@playwright/test'

type PlantOver = Partial<{
  speciesId: string
  stageIndex: number
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
