import { expect, test, type Page } from '@playwright/test'
import { saveWith, useSave } from './fixtures'

/** The fixture type only covers a plain growing plant; these saves also carry a journal, past tries, a dex. */
type Save = Parameters<typeof useSave>[1]
const asSave = (x: unknown) => x as Save

const SHOTS = '.superpowers/sdd/2026-10-21-plant-life/shots'

async function ready(page: Page) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await page.evaluate(() => document.fonts.ready)
}

const FINE = {
  water: { level: 4, dir: null },
  light: { level: 3, dir: null },
  temp: { level: 4, dir: null },
  nutrient: { level: 3, dir: null },
  pest: { level: 4, dir: null },
}

/** A finished balsam: ten recorded days with a few things done and a few troubles. */
function finishedBalsam() {
  const stages = ['seed', 'seed', 'sprout', 'sprout', 'leafStem', 'leafStem', 'flower', 'flower', 'fruit', 'seedDone']
  const journal = stages.map((stage, i) => ({
    day: i + 1,
    dateKey: `2026-10-${String(10 + i).padStart(2, '0')}`,
    stage,
    // a seed under the soil has no height or leaves yet (days 1-2)
    heightCm: Math.max(0, i - 1) * 2,
    leaves: Math.max(0, i - 1),
    actions: {
      waterAdded: i % 3 === 2 ? 0 : 30,
      pellets: i === 3 || i === 6 ? 1 : 0,
      bugsRemoved: i === 4 ? 2 : 0,
      place: i < 2 ? 'desk' : 'window',
    },
    statuses: i === 5 ? { ...FINE, water: { level: 2, dir: 'low' } } : FINE,
  }))
  return asSave({
    ...saveWith({ speciesId: 'balsam', stageIndex: 5, day: 11 }, { dayDone: true }),
    journal,
    pastTries: [{ speciesId: 'bean', days: 6, stage: 'flower', cause: '물이 부족해서 말라 버렸어요.' }],
    dex: ['balsam'],
  })
}

function deadBean() {
  const s = saveWith({ speciesId: 'bean', stageIndex: 3, day: 7, health: 0 }, { dayDone: true })
  return asSave({
    ...s,
    plant: { ...s.plant, dead: true, deathCause: '물이 부족해서 말라 버렸어요.' },
    pastTries: [{ speciesId: 'bean', days: 6, stage: 'flower', cause: '물이 부족해서 말라 버렸어요.' }],
  })
}

test('pick: nine species in two groups; choosing one starts the grow screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeVisible()
  await expect(page.getByRole('region', { name: '한해살이식물' }).getByRole('button')).toHaveCount(5)
  await expect(page.getByRole('region', { name: '여러해살이식물' }).getByRole('button')).toHaveCount(4)
  await expect(page.getByRole('button', { name: '씨 도감 0/9' })).toBeVisible()
  await page.getByRole('button', { name: /강낭콩/ }).tap()
  await expect(page.getByRole('heading', { name: /강낭콩 · 1일째/ })).toBeVisible()
})

test('pick: dex and backup links lead on and back', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /씨 도감/ }).tap()
  await expect(page.getByRole('heading', { name: '씨 도감' })).toBeVisible()
  await page.getByRole('button', { name: '다른 식물 고르기' }).tap()
  await page.getByRole('button', { name: '기록 지키기' }).tap()
  await expect(page.getByRole('heading', { name: '기록 지키기' })).toBeVisible()
  await page.getByRole('button', { name: '돌아가기' }).tap()
  await expect(page.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeVisible()
})

test('death: cause sentence; replant starts the same plant, other goes to pick', async ({ page }) => {
  await useSave(page, deadBean())
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '강낭콩이 시들어 버렸어요' })).toBeVisible()
  await expect(page.getByText('물이 부족해서 말라 버렸어요.')).toBeVisible()
  await expect(page.getByText('강낭콩 · 6일째 · 꽃 단계까지 자랐어요')).toBeVisible()
  await page.getByRole('button', { name: '다른 식물 고르기' }).tap()
  await expect(page.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeVisible()
})

test('death: replant', async ({ page }) => {
  await useSave(page, deadBean())
  await page.goto('/')
  await page.getByRole('button', { name: '강낭콩 다시 심기' }).tap()
  await expect(page.getByRole('heading', { name: /강낭콩 · 1일째/ })).toBeVisible()
})

test('journal: finished plant lists every day, prints without buttons, leads to the dex', async ({ page }) => {
  await useSave(page, finishedBalsam())
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '봉숭아 한살이 관찰 일지' })).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(11)
  await expect(page.getByText('창가로 옮기기').first()).toBeVisible()
  await expect(page.getByText('물이 조금 부족했어요')).toBeVisible()
  await expect(page.getByRole('list', { name: '한살이 단계' }).getByRole('listitem')).toHaveCount(6)

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: '인쇄하기' })).toBeHidden()
  await expect(page.getByRole('table')).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)')
  await page.emulateMedia({ media: 'screen' })

  await page.getByRole('button', { name: '씨 도감에 넣기' }).tap()
  await expect(page.getByRole('heading', { name: '씨 도감' })).toBeVisible()
  await expect(page.getByText('1/9')).toBeVisible()
  await page.getByRole('button', { name: '다른 식물 고르기' }).tap()
  await expect(page.getByRole('region', { name: '한해살이식물' }).getByText('완성')).toHaveCount(1)
})

test('journal: the finished journal is still there after the next plant starts', async ({ page }) => {
  await useSave(page, finishedBalsam())
  await page.goto('/')
  await page.getByRole('button', { name: '씨 도감에 넣기' }).tap()
  await page.getByRole('button', { name: '다른 식물 고르기' }).tap()
  await page.getByRole('button', { name: /강낭콩/ }).tap()
  await expect(page.getByRole('heading', { name: /강낭콩 · 1일째/ })).toBeVisible()
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('plantlife.v1') ?? '{}').finished?.balsam?.journal?.length)
  expect(kept).toBe(10)
})

test('dex: a completed card opens its kept journal, read-only and printable', async ({ page }) => {
  const done = finishedBalsam() as unknown as { journal: unknown[] }
  await useSave(page, asSave({ ...done, plant: null, journal: [], finished: { balsam: { journal: done.journal } } }))
  await page.goto('/')
  await page.getByRole('button', { name: /씨 도감/ }).tap()
  await page.getByRole('button', { name: '봉숭아 관찰 일지 보기' }).tap()
  await expect(page.getByRole('heading', { name: '봉숭아 한살이 관찰 일지' })).toBeVisible()
  await expect(page.getByText('10일 만에 씨를 얻었어요!')).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(11)
  await expect(page.getByRole('button', { name: '인쇄하기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '씨 도감에 넣기' })).toBeHidden()
  await page.getByRole('button', { name: '씨 도감', exact: true }).tap()
  await expect(page.getByRole('heading', { name: '씨 도감' })).toBeVisible()
})

test('journal: while growing, the back button returns to the grow screen', async ({ page }) => {
  await useSave(page, saveWith({ day: 3 }))
  await page.goto('/')
  await page.getByRole('button', { name: '관찰 일지' }).tap()
  await expect(page.getByRole('heading', { name: '봉숭아 한살이 관찰 일지' })).toBeVisible()
  await expect(page.getByText('3일째 키우는 중이에요')).toBeVisible()
  await page.getByRole('button', { name: '돌아가기' }).tap()
  await expect(page.getByRole('heading', { name: /봉숭아 · 3일째/ })).toBeVisible()
})

test('backup roundtrip: copy the code, empty the storage, paste, restore the same day', async ({ page }) => {
  await useSave(page, saveWith({ day: 4 }))
  await page.goto('/')
  await page.getByRole('button', { name: '기록 지키기' }).tap()
  const code = (await page.getByLabel('전체 기록 코드').textContent()) ?? ''
  expect(code.startsWith('PL1-')).toBe(true)
  await page.getByRole('button', { name: '복사하기' }).tap()
  await expect(page.getByRole('status')).toContainText(/복사했어요|골랐어요/)

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeVisible()
  await page.getByRole('button', { name: '기록 지키기' }).tap()
  await page.getByLabel('되살릴 기록 코드').fill(code)
  await page.getByRole('button', { name: '기록 되살리기' }).tap()
  await expect(page.getByText('지금 기록이 바뀌어요. 계속할까요?')).toBeVisible()
  await page.getByRole('button', { name: '그만두기' }).tap()
  await expect(page.getByText('지금 기록이 바뀌어요. 계속할까요?')).toBeHidden()
  await page.getByRole('button', { name: '기록 되살리기' }).tap()
  await page.getByRole('button', { name: '바꾸기' }).tap()
  await expect(page.getByRole('heading', { name: /봉숭아 · 4일째/ })).toBeVisible()
})

test('backup: the short code written down by hand brings the plant back', async ({ page }) => {
  await useSave(page, saveWith({ day: 4 }))
  await page.goto('/')
  await page.getByRole('button', { name: '기록 지키기' }).tap()
  const groups = await page.getByLabel('짧은 기록 코드').locator('.bk-group').allTextContents()
  expect(groups).toHaveLength(5)
  expect(groups.join('').length).toBe(25)

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: '기록 지키기' }).tap()
  // no code to write down for an empty record
  await expect(page.getByText('내 기록 코드')).toBeHidden()
  // as a student copies it from the notebook: lower case, spaces between the groups
  await page.getByLabel('되살릴 기록 코드').fill(groups.join(' ').toLowerCase())
  await page.getByRole('button', { name: '기록 되살리기' }).tap()
  await page.getByRole('button', { name: '바꾸기' }).tap()
  await expect(page.getByRole('heading', { name: /봉숭아 · 4일째/ })).toBeVisible()
})

test('backup: a bad code shows a message under the box', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '기록 지키기' }).tap()
  await page.getByLabel('되살릴 기록 코드').fill('PL1-엉터리')
  await page.getByRole('button', { name: '기록 되살리기' }).tap()
  await expect(page.getByRole('alert')).toHaveText('기록 코드가 맞지 않아요. 다시 확인해 주세요.')
  await expect(page.getByText('지금 기록이 바뀌어요. 계속할까요?')).toBeHidden()
})

test('an unreadable save opens the backup panel first', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('fixture-loaded')) return
    sessionStorage.setItem('fixture-loaded', '1')
    localStorage.setItem('plantlife.v1', '{not json')
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '기록 지키기' })).toBeVisible()
  await expect(page.getByText('기록을 불러오지 못했어요. 적어 둔 기록 코드가 있으면 넣어 주세요.')).toBeVisible()
  await page.getByRole('button', { name: '돌아가기' }).tap()
  await expect(page.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeVisible()
  await page.getByRole('button', { name: '기록 지키기' }).tap()
  await expect(page.getByText('기록을 불러오지 못했어요.')).toBeHidden()
})

test.describe('screenshots', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'screenshots once, on Chromium')

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1194, height: 834 })
  })

  test('pick', async ({ page }) => {
    await useSave(page, asSave({ ...saveWith(), plant: null, dex: ['balsam'] }))
    await page.goto('/')
    await ready(page)
    await expect(page.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/pick-1194.png`, fullPage: true })
  })

  test('dead', async ({ page }) => {
    await useSave(page, deadBean())
    await page.goto('/')
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/dead-1194.png`, fullPage: true })
  })

  test('journal', async ({ page }) => {
    await useSave(page, finishedBalsam())
    await page.goto('/')
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/journal-1194.png`, fullPage: true })
    // what the printed page looks like: A4 width at 96 dpi, print media
    await page.setViewportSize({ width: 794, height: 1123 })
    await page.emulateMedia({ media: 'print' })
    await page.screenshot({ path: `${SHOTS}/journal-print.png`, fullPage: true })
  })

  test('dex', async ({ page }) => {
    await useSave(page, asSave({ ...finishedBalsam(), dex: ['balsam', 'bean', 'apple'] }))
    await page.goto('/')
    await page.getByRole('button', { name: '씨 도감에 넣기' }).click()
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/dex-1194.png`, fullPage: true })
  })

  test('backup', async ({ page }) => {
    await useSave(page, saveWith({ day: 4 }))
    await page.goto('/')
    await page.getByRole('button', { name: '기록 지키기' }).click()
    await expect(page.getByLabel('짧은 기록 코드')).toBeVisible()
    await ready(page)
    await page.screenshot({ path: `${SHOTS}/backup-1194.png`, fullPage: true })
  })
})
