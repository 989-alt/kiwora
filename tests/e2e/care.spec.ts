import { expect, test, type Page } from '@playwright/test'
import { centerOf, saveWith, useSave } from './fixtures'

const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'

type Case = { task: string; species: string; stageIndex: number; todo: string; taps: [string, number][] }
const CASES: Case[] = [
  { task: 'sow', species: 'bean', stageIndex: 0, todo: '씨를 2~3알 심고 흙을 덮어 주세요', taps: [['흙에 씨 놓기', 3], ['흙 덮기', 3]] },
  { task: 'thin', species: 'balsam', stageIndex: 1, todo: '약한 싹을 뽑아 하나만 남겨요', taps: [['약한 싹 뽑기', 2]] },
  { task: 'stake', species: 'bean', stageIndex: 2, todo: '지지대를 세워 줘요', taps: [['지지대 꽂을 자리', 1]] },
  {
    task: 'stakeTwine',
    species: 'morningGlory',
    stageIndex: 2,
    todo: '지지대를 세우고 덩굴을 감아 줘요',
    taps: [['지지대 꽂을 자리', 1], ['줄기에 덩굴 감기', 3]],
  },
  {
    task: 'hillUp',
    species: 'corn',
    stageIndex: 2,
    todo: '포기 사이에 흙을 북돋아 줘요',
    taps: [['왼쪽 흙 북돋우기', 2], ['오른쪽 흙 북돋우기', 1]],
  },
  { task: 'pinch', species: 'balsam', stageIndex: 2, todo: '곁가지를 정리해 줘요', taps: [['곁가지 자르기', 2]] },
  { task: 'drainCheck', species: 'apple', stageIndex: 2, todo: '화분 밑으로 물이 잘 빠지는지 살펴요', taps: [['물받이 살펴보기', 1]] },
]

const todo = (page: Page) => page.getByRole('status', { name: '오늘 할 일' })
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('plantlife.v1') ?? '{}') as { plant: { careDone: number }; pendingActions: { care?: string[] } | null })
const openWith = async (page: Page, c: Case, over: Record<string, unknown> = {}) => {
  await useSave(page, saveWith({ speciesId: c.species, stageIndex: c.stageIndex, mode: 'daily', careDone: 0, growth: 1, ...over }))
  await page.goto('/')
}
const imagesLoaded = (page: Page) => page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))

for (const vp of [
  { width: 1366, height: 640 },
  { width: 768, height: 1024 },
])
  for (const c of CASES)
    test(`care can be finished by taps alone: ${c.task} at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp)
      await openWith(page, c)
      await expect(todo(page)).toContainText(c.todo)
      for (const [name, n] of c.taps)
        for (let i = 0; i < n; i++) {
          const target = page.getByRole('button', { name }).first()
          // every target is on screen (portrait: the scene is at the top of the page)
          const b = await target.boundingBox()
          expect(b, name).not.toBeNull()
          expect(b!.width).toBeGreaterThanOrEqual(48)
          expect(b!.height).toBeGreaterThanOrEqual(48)
          await target.tap()
        }
      await expect(todo(page)).toHaveCount(0)
      const s = await stored(page)
      expect(s.plant.careDone).toBe(1)
      expect(s.pendingActions?.care).toEqual([c.task])
    })

test('the watering can waits until the seed is sown', async ({ page }) => {
  await openWith(page, CASES[0])
  const can = page.getByRole('button', { name: '씨를 먼저 심어요' })
  await expect(can).toBeDisabled()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '흙에 씨 놓기' }).tap()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '흙 덮기' }).tap()
  await expect(page.getByRole('button', { name: /물 주기/ })).toBeEnabled()
})

test('seeds can be dragged from the packet and covered by rubbing the soil', async ({ page }) => {
  await openWith(page, CASES[0])
  const soil = () => centerOf(page, page.getByRole('button', { name: /흙에 씨 놓기|흙 덮기/ }))
  for (let i = 0; i < 3; i++) {
    const from = await centerOf(page, page.getByRole('button', { name: '씨 봉투' }))
    const to = await soil()
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let k = 1; k <= 10; k++) await page.mouse.move(from.x + ((to.x - from.x) * k) / 10, from.y + ((to.y - from.y) * k) / 10)
    await page.mouse.up()
  }
  await expect(page.getByRole('button', { name: '씨 봉투' })).toHaveCount(0)
  const c = await soil()
  await page.mouse.move(c.x - 30, c.y)
  await page.mouse.down()
  for (let k = 0; k < 8; k++) {
    await page.mouse.move(c.x + 30, c.y, { steps: 4 })
    await page.mouse.move(c.x - 30, c.y, { steps: 4 })
  }
  await page.mouse.up()
  await expect(todo(page)).toHaveCount(0)
})

test('the stake can be dragged to the stem', async ({ page }) => {
  await openWith(page, CASES[2])
  const from = await centerOf(page, page.getByRole('button', { name: '지지대', exact: true }))
  const to = await centerOf(page, page.getByRole('button', { name: '지지대 꽂을 자리' }))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
  await expect(todo(page)).toHaveCount(0)
})

test('the to-do card switches to the waiting line and stays at night', async ({ page }) => {
  await openWith(page, CASES[1], { growth: 4 })
  await expect(todo(page)).toContainText('솎아 줘야 잎과 줄기가 잘 자라요')
  await page.getByRole('button', { name: '하루 마치기' }).click()
  await expect(page.getByRole('button', { name: '내일 다시 만나요' })).toBeVisible()
  await expect(todo(page)).toBeVisible()
})

for (const vp of [
  { width: 1194, height: 834 },
  { width: 1280, height: 800 },
  { width: 1366, height: 640 },
  { width: 1366, height: 768 },
  { width: 820, height: 1180 },
  { width: 768, height: 1024 },
])
  test(`with a care due, 하루 마치기 and the to-do card stay on screen at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp)
    await openWith(page, CASES[4], { water: 5, nutrient: 5, bugs: 3, health: 25, place: 'shade' })
    for (const loc of [page.getByRole('button', { name: '하루 마치기' }), todo(page)]) {
      const b = await loc.boundingBox()
      expect(b).not.toBeNull()
      expect(b!.y).toBeGreaterThanOrEqual(0)
      expect(b!.x).toBeGreaterThanOrEqual(0)
      expect(b!.y + b!.height).toBeLessThanOrEqual(vp.height)
      expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width)
    }
  })

/** Screenshots of each care mid-action (1194×834) and of the to-do card in portrait (820×1180), to look at. */
test('care screenshots', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'screenshots once')
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1194, height: 834 })
  const partial: Record<string, [string, number][]> = {
    sow: [['흙에 씨 놓기', 3], ['흙 덮기', 1]],
    thin: [['약한 싹 뽑기', 1]],
    stake: [],
    stakeTwine: [['지지대 꽂을 자리', 1], ['줄기에 덩굴 감기', 2]],
    hillUp: [['왼쪽 흙 북돋우기', 1], ['오른쪽 흙 북돋우기', 1]],
    pinch: [['곁가지 자르기', 1]],
    drainCheck: [],
  }
  const browser = page.context().browser()!
  const open = async (c: Case, hasTouch: boolean) => {
    const ctx = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: 1194, height: 834 }, hasTouch })
    const p = await ctx.newPage()
    await useSave(p, saveWith({ speciesId: c.species, stageIndex: c.stageIndex, mode: 'daily', careDone: 0, growth: 1 }))
    await p.goto('/')
    await imagesLoaded(p)
    return { ctx, p }
  }
  for (const c of CASES) {
    const { ctx, p } = await open(c, true)
    for (const [name, n] of partial[c.task]) for (let i = 0; i < n; i++) await p.getByRole('button', { name }).first().tap()
    await p.waitForTimeout(900)
    await p.screenshot({ path: `${SHOTS}/care-${c.task}-1194x834.png` })
    await ctx.close()
    if (c.task !== 'sow' && c.task !== 'stake') continue
    // mid-drag: the seed / stake under the pointer
    const d = await open(c, false)
    const q = d.p
    const src = await centerOf(q, q.getByRole('button', { name: c.task === 'sow' ? '씨 봉투' : '지지대', exact: true }))
    const dst = await centerOf(q, q.getByRole('button', { name: c.task === 'sow' ? '흙에 씨 놓기' : '지지대 꽂을 자리' }))
    await q.mouse.move(src.x, src.y)
    await q.mouse.down()
    await q.mouse.move((src.x + dst.x) / 2, (src.y + dst.y) / 2 - 20, { steps: 8 })
    await q.screenshot({ path: `${SHOTS}/care-${c.task}-drag-1194x834.png` })
    await q.mouse.up()
    await d.ctx.close()
  }
  // the smallest scene (1366×640): props still sit on the pot, the step line clear of it
  for (const c of [CASES[0], CASES[2], CASES[4], CASES[6]]) {
    const { ctx, p } = await open(c, true)
    await p.setViewportSize({ width: 1366, height: 640 })
    await p.waitForTimeout(300)
    await p.screenshot({ path: `${SHOTS}/care-${c.task}-1366x640.png` })
    await ctx.close()
  }
  await page.setViewportSize({ width: 820, height: 1180 })
  await useSave(page, saveWith({ speciesId: 'morningGlory', stageIndex: 2, mode: 'daily', careDone: 0, growth: 4 }))
  await page.goto('/')
  await imagesLoaded(page)
  await page.screenshot({ path: `${SHOTS}/todo-820x1180.png` })
})
