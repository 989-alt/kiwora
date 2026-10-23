import { expect, test, type Page } from '@playwright/test'
import { saveWith, useSave } from './fixtures'

// The title (main) screen itself: this spec uses the plain Playwright test (no automatic pass of the title screen).

const SHOTS = '.superpowers/sdd/2026-10-22-kiwora-v2/shots'

const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const pastGuard = (page: Page) => page.waitForTimeout(450)

async function ready(page: Page) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await page.evaluate(() => document.fonts.ready)
}

async function growTitle(page: Page) {
  return page.getByRole('heading', { level: 1 }).getAttribute('aria-label')
}

test('first visit: 이어하기 off; start, pick, 메인화면으로 keeps the plant; reload and 이어하기 come back to it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /식물 한살이/ })).toBeVisible()
  await expect(btn(page, '이어하기')).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText('아직 저장된 기록이 없어요')).toBeVisible()

  await btn(page, '새로 시작하기').click()
  await expect(page.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeVisible()
  await page.getByRole('button', { name: /봉숭아/ }).click()
  await pastGuard(page)
  await page.getByRole('button', { name: /매일 키우기/ }).click()
  await expect(page.locator('.gs-tools')).toBeVisible()
  const where = await growTitle(page)
  expect(where).toContain('봉숭아')
  // saved at once: the save already has the plant
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plantlife.v1')!).plant.speciesId)).toBe('balsam')

  await btn(page, '메인화면으로').click()
  await expect(page.getByRole('dialog', { name: '메인화면으로 갈까요?' })).toBeVisible()
  await pastGuard(page)
  await btn(page, '기록 유지하고 메인 화면으로').click()
  await expect(btn(page, '이어하기')).toHaveAttribute('aria-disabled', 'false')
  await expect(page.getByText('아직 저장된 기록이 없어요')).toHaveCount(0)
  await btn(page, '이어하기').click()
  await expect(page.locator('.gs-tools')).toBeVisible()
  expect(await growTitle(page)).toBe(where)

  await page.reload()
  await expect(page.getByRole('heading', { name: /식물 한살이/ })).toBeVisible()
  await btn(page, '이어하기').click()
  await expect(page.locator('.gs-tools')).toBeVisible()
  expect(await growTitle(page)).toBe(where)
})

test('새로 시작하기 with a save asks, then starts over on an empty pick screen', async ({ page }) => {
  await useSave(page, { ...saveWith({ speciesId: 'bean' }), dex: ['balsam', 'corn'] } as ReturnType<typeof saveWith>)
  await page.goto('/')
  await btn(page, '새로 시작하기').click()
  const ask = page.getByRole('alertdialog')
  await expect(ask).toContainText('지금까지의 기록이 모두 지워져요. 새로 시작할까요?')
  await pastGuard(page)
  await ask.getByRole('button', { name: '취소' }).click()
  await expect(ask).toHaveCount(0)
  await btn(page, '새로 시작하기').click()
  await pastGuard(page)
  await page.getByRole('alertdialog').getByRole('button', { name: '새로 시작하기' }).click()
  await expect(page.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeVisible()
  await expect(page.getByRole('button', { name: /씨 도감/ })).toContainText('0/9')
  const keys = await page.evaluate(() => Object.keys(localStorage))
  expect(keys.filter((k) => k.startsWith('plantlife'))).toEqual(['plantlife.v1'])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plantlife.v1')!).plant)).toBeNull()
})

test('header 기록 초기화하기 asks twice, then wipes and shows the title screen', async ({ page }) => {
  await useSave(page, saveWith({ speciesId: 'bean' }))
  await page.goto('/')
  await btn(page, '이어하기').click()
  await btn(page, '메인화면으로').click()
  await pastGuard(page)
  await btn(page, '기록 초기화하기').click()
  const sure = page.getByRole('alertdialog')
  await expect(sure).toContainText('기록이 모두 지워져요. 정말 초기화할까요?')
  await pastGuard(page)
  await sure.getByRole('button', { name: '초기화하기' }).click()
  await expect(page.getByRole('heading', { name: /식물 한살이/ })).toBeVisible()
  await expect(btn(page, '이어하기')).toHaveAttribute('aria-disabled', 'true')
  await page.reload()
  await expect(btn(page, '이어하기')).toHaveAttribute('aria-disabled', 'true')
})

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 1194, height: 834 },
  { width: 1280, height: 800 },
  { width: 1366, height: 640 },
  { width: 820, height: 1180 },
]

/** The header holds all its parts inside the page width, without overlaps, and the page never scrolls sideways. */
async function headerFits(page: Page, header: string, label: string) {
  const r = await page.evaluate((sel) => {
    const head = document.querySelector(sel)!
    const kids = [...head.querySelectorAll('h1, button')].map((e) => e.getBoundingClientRect())
    const overlaps = kids.some((a, i) =>
      kids.some((b, j) => j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1),
    )
    const home = [...head.querySelectorAll('button')].find((b) => b.textContent?.includes('메인화면으로'))!
    const st = getComputedStyle(home)
    return {
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      right: Math.max(...kids.map((k) => k.right)),
      vw: window.innerWidth,
      overlaps,
      fontPx: parseFloat(st.fontSize),
      bg: st.backgroundColor,
      color: st.color,
      height: home.getBoundingClientRect().height,
    }
  }, header)
  expect(r.scroll, label).toBeLessThanOrEqual(0)
  expect(r.right, label).toBeLessThanOrEqual(r.vw)
  expect(r.overlaps, label).toBe(false)
  expect(r.fontPx, label).toBeGreaterThanOrEqual(18)
  expect(r.bg, label).toBe('rgb(220, 38, 38)')
  expect(r.color, label).toBe('rgb(255, 255, 255)')
  expect(r.height, label).toBeGreaterThanOrEqual(48)
}

for (const vp of VIEWPORTS) {
  test(`the header with 메인화면으로 fits at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp)
    // the widest grow header: a long name, the longest stage words and '2년 뒤'
    await useSave(page, saveWith({ speciesId: 'apple', stageIndex: 3, growth: 3, place: 'yardSunny', heightCm: 120 }))
    await page.goto('/')
    await btn(page, '이어하기').click()
    await expect(page.locator('.gs-tools')).toBeVisible()
    await headerFits(page, '.gs-header', `grow ${vp.width}`)
    // and the header stays one row in landscape (the scene keeps its height)
    if (vp.width >= 900) {
      const rows = await page.evaluate(() => {
        const items = [...document.querySelectorAll('.gs-header h1, .gs-header button')].map((e) => Math.round(e.getBoundingClientRect().top / 20))
        return new Set(items).size
      })
      expect(rows, `grow ${vp.width}`).toBe(1)
    }
    await page.getByRole('button', { name: /^씨 도감/ }).click()
    await headerFits(page, '.sc-head', `dex ${vp.width}`)
    await page.getByRole('button', { name: '돌아가기' }).click()
    await page.getByRole('button', { name: /^기록 지키기/ }).click()
    await headerFits(page, '.sc-head', `backup ${vp.width}`)
  })
}

test('screenshots: title screen (empty and with a save) and the header dialog', async ({ page }) => {
  test.setTimeout(120_000)
  for (const vp of [
    { width: 1194, height: 834 },
    { width: 820, height: 1180 },
  ]) {
    const tag = `${vp.width}x${vp.height}`
    await page.setViewportSize(vp)
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/title-empty-${tag}.png` })
    await btn(page, '새로 시작하기').click()
    await page.getByRole('button', { name: /봉숭아/ }).click()
    await pastGuard(page)
    await page.getByRole('button', { name: /매일 키우기/ }).click()
    await expect(page.locator('.gs-tools')).toBeVisible()
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('plantlife.v1')!)
      s.settings.tutorialSeen = true
      localStorage.setItem('plantlife.v1', JSON.stringify(s))
    })
    await page.reload()
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/title-saved-${tag}.png` })
    await btn(page, '이어하기').click()
    await expect(page.locator('.gs-tools')).toBeVisible()
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/header-home-${tag}.png` })
    await btn(page, '메인화면으로').click()
    await pastGuard(page)
    await page.screenshot({ path: `${SHOTS}/home-dialog-${tag}.png` })
    await btn(page, '기록 초기화하기').click()
    await pastGuard(page)
    await page.screenshot({ path: `${SHOTS}/home-confirm-${tag}.png` })
    // the dialog sits in the middle of the screen
    const box = (await page.locator('.bk-dialog').boundingBox())!
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(4)
    expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(4)
    await page.getByRole('alertdialog').getByRole('button', { name: '취소' }).click()
  }
})
