import { expect, test, type Page } from '@playwright/test'
import { centerOf, saveWith, useSave } from './fixtures'

const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'

/** `place`: where the plant stands (trees are in the yard from the young-tree stage on); default the desk. */
type Case = { task: string; species: string; stageIndex: number; todo: string; taps: [string, number][]; place?: string }
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
  // young tree → winter (perennial stages: grownTree 3, flower 4, fruit 5, winter 6; annual: flower 3, fruit 4)
  { task: 'prune', species: 'apple', stageIndex: 3, place: 'yardSunny', todo: '마른 가지를 잘라 줘요', taps: [['마른 가지 자르기', 3]] },
  {
    task: 'pollinate',
    species: 'bean',
    stageIndex: 3,
    todo: '붓으로 꽃가루를 다른 꽃에 옮겨요',
    taps: [['꽃가루 묻히기', 1], ['다른 꽃에 꽃가루 옮기기', 1]],
  },
  { task: 'shakePollen', species: 'corn', stageIndex: 3, todo: '포기를 흔들어 꽃가루를 날려요', taps: [['포기 흔들기', 3]] },
  { task: 'harvestSeed', species: 'bean', stageIndex: 4, todo: '열매를 따서 씨를 받아요', taps: [['열매 따기', 3]] },
  { task: 'harvest', species: 'persimmon', stageIndex: 5, place: 'yardSunny', todo: '익은 열매를 따요', taps: [['열매 따기', 3]] },
  {
    task: 'winterWrap',
    species: 'apple',
    stageIndex: 6,
    place: 'yardSunny',
    todo: '줄기를 짚으로 감싸 겨울을 준비해요',
    taps: [['짚 감쌀 밑동', 1]],
  },
  // a potted perennial is brought in: the desk slot under the scene
  { task: 'moveIn', species: 'dandelion', stageIndex: 6, place: 'window', todo: '화분을 책상으로 옮겨 겨울을 준비해요', taps: [['책상', 1]] },
]

const todo = (page: Page) => page.getByRole('status', { name: '오늘 할 일' })
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('plantlife.v1') ?? '{}') as { plant: { careDone: number }; pendingActions: { care?: string[] } | null })
const openWith = async (page: Page, c: Case, over: Record<string, unknown> = {}) => {
  await useSave(
    page,
    saveWith({ speciesId: c.species, stageIndex: c.stageIndex, mode: 'daily', careDone: 0, growth: 1, place: c.place ?? 'desk', ...over }),
  )
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
          const target = page.getByRole('button', { name, exact: true }).first()
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
  for (const c of CASES.filter((k) => k.task in partial)) {
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

const caseOf = (task: string) => CASES.find((c) => c.task === task)!

/** Mouse drag through the points, a few steps between each. */
async function dragThrough(page: Page, pts: { x: number; y: number }[], steps = 6) {
  await page.mouse.move(pts[0].x, pts[0].y)
  await page.mouse.down()
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps })
  await page.mouse.up()
}

test('winter: the desk slot shines for a potted perennial, and moving the pot there finishes the care', async ({ page }) => {
  await openWith(page, caseOf('moveIn'))
  const desk = page.getByRole('button', { name: '책상', exact: true })
  await expect(desk).toHaveClass(/slot--glow/)
  await expect(page.getByRole('button', { name: '그늘', exact: true })).not.toHaveClass(/slot--glow/)
  await desk.click()
  await expect(todo(page)).toHaveCount(0)
  await expect(desk).not.toHaveClass(/slot--glow/)
  expect((await stored(page)).pendingActions?.care).toEqual(['moveIn'])
})

test('picking the fruit gives the seeds; ending the day completes the plant and the journal says 씨 받기', async ({ page }) => {
  await openWith(page, caseOf('harvestSeed'), { growth: 4, health: 95 })
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '열매 따기' }).first().click()
  await expect(todo(page)).toHaveCount(0)
  // the seeds lie beside the pot
  await expect(page.locator('.care-seeds')).toHaveCount(1)
  await page.getByRole('button', { name: '하루 마치기' }).click()
  await expect(page.getByRole('button', { name: '씨 도감에 넣기' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('table')).toContainText('씨 받기')
})

test('the brush can be dragged from flower to flower, the pollen following it', async ({ page }) => {
  await openWith(page, caseOf('pollinate'))
  const a = await centerOf(page, page.getByRole('button', { name: '꽃가루 묻히기' }))
  const b = await centerOf(page, page.getByRole('button', { name: '다른 꽃에 꽃가루 옮기기' }))
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  // round about, so the brush travels a while before it reaches the other flower
  await page.mouse.move(a.x - 60, a.y + 40, { steps: 8 })
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 8 })
  expect(await page.locator('.care-pollen--trail').count()).toBeGreaterThan(1)
  await page.mouse.move(b.x, b.y, { steps: 6 })
  await page.mouse.up()
  await expect(todo(page)).toHaveCount(0)
})

test('the corn is swung left and right across its stem', async ({ page }) => {
  await openWith(page, caseOf('shakePollen'))
  const c = await centerOf(page, page.getByRole('button', { name: '포기 흔들기' }))
  await dragThrough(page, [c, { x: c.x + 60, y: c.y }, { x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }, { x: c.x - 60, y: c.y }], 4)
  await expect(todo(page)).toHaveCount(0)
})

test('the straw is dragged to the tree trunk', async ({ page }) => {
  await openWith(page, caseOf('winterWrap'))
  const from = await centerOf(page, page.getByRole('button', { name: '짚', exact: true }))
  const to = await centerOf(page, page.getByRole('button', { name: '짚 감쌀 밑동' }))
  await dragThrough(page, [from, to], 12)
  await expect(todo(page)).toHaveCount(0)
  await expect(page.locator('.care-straw')).toHaveCount(1)
})

/** Screenshots of the young-tree → winter care mid-action (1194×834; yard for trees, room for pots), to look at. */
test('care screenshots, young tree to winter', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'screenshots once')
  test.setTimeout(180_000)
  const browser = page.context().browser()!
  type Shot = { c: Case; over?: Record<string, unknown>; taps?: [string, number][]; name: string; wait?: number; vp?: { width: number; height: number } }
  const shoot = async ({ c, over = {}, taps = [], name, wait = 900, vp = { width: 1194, height: 834 } }: Shot) => {
    const ctx = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: vp, hasTouch: true })
    const p = await ctx.newPage()
    await useSave(p, saveWith({ speciesId: c.species, stageIndex: c.stageIndex, mode: 'daily', careDone: 0, growth: 1, place: c.place ?? 'desk', ...over }))
    await p.goto('/')
    await imagesLoaded(p)
    for (const [label, n] of taps) for (let i = 0; i < n; i++) await p.getByRole('button', { name: label, exact: true }).first().tap()
    await p.waitForTimeout(wait)
    await p.screenshot({ path: `${SHOTS}/care-${name}.png` })
    return { ctx, p }
  }
  const once = async (s: Shot) => (await shoot(s)).ctx.close()
  const flower = (species: string, stageIndex: number, place = 'desk'): Case => ({ ...caseOf('pollinate'), species, stageIndex, place })
  const fruit = (species: string): Case => ({ ...caseOf('harvest'), species })

  await once({ c: caseOf('prune'), taps: [['마른 가지 자르기', 1]], name: 'prune-1194x834' })
  await once({ c: caseOf('pollinate'), taps: [['꽃가루 묻히기', 1]], name: 'pollinate-1194x834' })
  await once({ c: flower('apple', 4, 'yardSunny'), taps: [['꽃가루 묻히기', 1]], name: 'pollinate-apple-1194x834' })
  await once({ c: flower('dandelion', 4), taps: [['꽃가루 묻히기', 1]], name: 'pollinate-dandelion-1194x834' })
  await once({ c: caseOf('shakePollen'), taps: [['포기 흔들기', 1]], name: 'shakePollen-1194x834', wait: 260 })
  await once({ c: { ...caseOf('shakePollen'), species: 'rice' }, taps: [['포기 흔들기', 1]], name: 'shakePollen-rice-1194x834', wait: 260 })
  await once({ c: caseOf('harvestSeed'), taps: [['열매 따기', 1]], name: 'harvestSeed-1194x834', wait: 350 })
  await once({ c: caseOf('harvestSeed'), taps: [['열매 따기', 3]], name: 'harvestSeed-seeds-1194x834', wait: 1200 })
  await once({ c: caseOf('harvest'), taps: [['열매 따기', 1]], name: 'harvest-1194x834', wait: 350 })
  await once({ c: fruit('dandelion'), over: { place: 'desk' }, taps: [['열매 따기', 1]], name: 'harvest-dandelion-1194x834', wait: 350 })
  await once({ c: caseOf('winterWrap'), name: 'winterWrap-1194x834' })
  await once({ c: caseOf('winterWrap'), taps: [['짚 감쌀 밑동', 1]], name: 'winterWrap-done-1194x834' })
  await once({ c: caseOf('moveIn'), name: 'moveIn-1194x834', wait: 400 })
  // the smallest scene: the yard tree's twigs, the straw and the step line
  await once({ c: caseOf('prune'), name: 'prune-1366x640', vp: { width: 1366, height: 640 } })
  await once({ c: caseOf('winterWrap'), name: 'winterWrap-1366x640', vp: { width: 1366, height: 640 } })

  // mid-drag: the brush with its pollen trail, the straw under the pointer
  for (const [c, src, dst, name] of [
    [caseOf('pollinate'), '꽃가루 묻히기', '다른 꽃에 꽃가루 옮기기', 'pollinate-drag-1194x834'],
    [caseOf('winterWrap'), '짚', '짚 감쌀 밑동', 'winterWrap-drag-1194x834'],
  ] as const) {
    const ctx = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: 1194, height: 834 } })
    const q = await ctx.newPage()
    await useSave(q, saveWith({ speciesId: c.species, stageIndex: c.stageIndex, mode: 'daily', careDone: 0, growth: 1, place: c.place ?? 'desk' }))
    await q.goto('/')
    await imagesLoaded(q)
    const a = await centerOf(q, q.getByRole('button', { name: src, exact: true }))
    const b = await centerOf(q, q.getByRole('button', { name: dst, exact: true }))
    await q.mouse.move(a.x, a.y)
    await q.mouse.down()
    await q.mouse.move(a.x + (b.x - a.x) * 0.6, a.y + (b.y - a.y) * 0.6 - 10, { steps: 12 })
    await q.screenshot({ path: `${SHOTS}/care-${name}.png` })
    await q.mouse.up()
    await ctx.close()
  }
})
