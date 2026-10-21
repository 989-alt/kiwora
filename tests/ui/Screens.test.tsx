import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { newPlant } from '../../src/sim/day'
import { SPECIES } from '../../src/sim/species'
import { emptySave, exportCode, shortCode, type JournalEntry } from '../../src/sim/save'
import { boot, toSave, type AppState } from '../../src/store'
import { BackupPanel } from '../../src/ui/screens/BackupPanel'
import { DeathScreen } from '../../src/ui/screens/DeathScreen'
import { DexScreen } from '../../src/ui/screens/DexScreen'
import { GrowScreen } from '../../src/ui/screens/GrowScreen'
import { JournalScreen } from '../../src/ui/screens/JournalScreen'
import { PickScreen } from '../../src/ui/screens/PickScreen'

// Lets one test pretend only some species are approved; undefined = the shipped assets/approved.json.
const approval = vi.hoisted(() => ({ table: undefined as Record<string, boolean> | undefined }))
vi.mock('../../src/sim/approved', async (orig) => {
  const real = await orig<typeof import('../../src/sim/approved')>()
  return { ...real, isApproved: (id: Parameters<typeof real.isApproved>[0]) => real.isApproved(id, approval.table) }
})

const base = () => boot(emptySave(), '2026-10-25')

describe('PickScreen', () => {
  test('pick shows nine species in two groups', () => {
    render(<PickScreen state={base()} dispatch={() => {}} />)
    const annual = screen.getByRole('region', { name: '한해살이식물' })
    const perennial = screen.getByRole('region', { name: '여러해살이식물' })
    expect(within(annual).getAllByRole('button')).toHaveLength(5)
    expect(within(perennial).getAllByRole('button')).toHaveLength(4)
    expect(within(annual).getByRole('button', { name: /봉숭아/ })).toBeTruthy()
    expect(within(perennial).getByRole('button', { name: /감나무/ })).toBeTruthy()
  })

  test('card dispatches pick; completed species carry a badge; links open dex and backup', () => {
    const dispatch = vi.fn()
    render(<PickScreen state={{ ...base(), dex: ['rice'] }} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: /강낭콩/ }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'pick', id: 'bean' })
    expect(within(screen.getByRole('button', { name: /벼/ })).getByText('완성')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /강낭콩/ })).queryByText('완성')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '씨 도감 1/9' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'dex' })
    fireEvent.click(screen.getByRole('button', { name: '기록 지키기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'backup' })
  })

  test('in the shipped build every species is approved, so all nine can be picked', () => {
    vi.stubEnv('PROD', true)
    try {
      render(<PickScreen state={base()} dispatch={() => {}} />)
      const cards = screen.getAllByRole('button').filter((b) => b.classList.contains('pk-card'))
      expect(cards).toHaveLength(9)
      for (const c of cards) expect((c as HTMLButtonElement).disabled).toBe(false)
      expect(screen.queryByText('준비 중')).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('in the shipped build, a species that is not approved is disabled and says 준비 중', () => {
    vi.stubEnv('PROD', true)
    approval.table = { balsam: true }
    try {
      const dispatch = vi.fn()
      render(<PickScreen state={base()} dispatch={dispatch} />)
      const cards = screen.getAllByRole('button').filter((b) => b.classList.contains('pk-card'))
      const ready = cards.filter((c) => !(c as HTMLButtonElement).disabled)
      expect(ready).toHaveLength(1)
      expect(within(ready[0]).queryByText('준비 중')).toBeNull()
      const waiting = cards.filter((c) => (c as HTMLButtonElement).disabled)
      expect(waiting).toHaveLength(8)
      for (const c of waiting) expect(within(c).getByText('준비 중')).toBeTruthy()
      fireEvent.click(waiting[0])
      expect(dispatch).not.toHaveBeenCalled()
    } finally {
      approval.table = undefined
      vi.unstubAllEnvs()
    }
  })

  test('in development every species can be picked', () => {
    render(<PickScreen state={base()} dispatch={() => {}} />)
    expect(screen.queryByText('준비 중')).toBeNull()
  })
})

describe('DeathScreen', () => {
  const dead = (): AppState => ({
    ...base(),
    plant: { ...newPlant('bean'), stageIndex: 3, day: 7, health: 0, dead: true, deathCause: '물이 부족해서 말라 버렸어요.' },
    pastTries: [{ speciesId: 'bean', days: 6, stage: 'flower', cause: '물이 부족해서 말라 버렸어요.' }],
    screen: 'dead',
  })

  test('death screen shows cause sentence', () => {
    render(<DeathScreen state={dead()} dispatch={() => {}} />)
    expect(screen.getByText('물이 부족해서 말라 버렸어요.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('강낭콩이 시들어 버렸어요')
    expect(screen.getByText('강낭콩 · 6일째 · 꽃 단계까지 자랐어요')).toBeTruthy()
  })

  test('buttons replant the same plant or go to pick', () => {
    const dispatch = vi.fn()
    render(<DeathScreen state={dead()} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: '강낭콩 다시 심기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'replant', id: 'bean' })
    fireEvent.click(screen.getByRole('button', { name: '다른 식물 고르기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'pick' })
  })

  test('a dandelion died as a 큰 포기, not a 어린나무', () => {
    const s: AppState = {
      ...base(),
      plant: { ...newPlant('dandelion'), stageIndex: 3, day: 7, health: 0, dead: true, deathCause: '물이 부족해서 말라 버렸어요.' },
      pastTries: [{ speciesId: 'dandelion', days: 6, stage: 'grownTree', cause: '물이 부족해서 말라 버렸어요.' }],
      screen: 'dead',
    }
    render(<DeathScreen state={s} dispatch={() => {}} />)
    expect(screen.getByText('민들레 · 6일째 · 큰 포기 단계까지 자랐어요')).toBeTruthy()
  })
})

describe('GrowScreen header', () => {
  const growing = (id: 'dandelion' | 'apple'): AppState => ({
    ...base(),
    plant: { ...newPlant(id), stageIndex: 3, day: 7 },
    settings: { sound: false, tutorialSeen: true },
    screen: 'grow',
  })

  test('a growing dandelion is a 큰 포기; a tree keeps 적당한 크기로 자라요', () => {
    const { unmount } = render(<GrowScreen state={growing('dandelion')} dispatch={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label')).toBe('민들레 · 7일째 · 큰 포기')
    expect(screen.queryByText('적당한 크기로 자라요')).toBeNull()
    unmount()
    render(<GrowScreen state={growing('apple')} dispatch={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label')).toBe('사과나무 · 7일째 · 적당한 크기로 자라요')
  })
})

describe('DexScreen', () => {
  test('nine slots, finished ones show a strip, button leads to pick', () => {
    const dispatch = vi.fn()
    render(<DexScreen state={{ ...base(), dex: ['balsam', 'apple'] }} dispatch={dispatch} />)
    expect(screen.getByRole('list', { name: '씨 도감' }).children).toHaveLength(9)
    expect(screen.getByText('2/9')).toBeTruthy()
    expect(screen.getAllByRole('list', { name: /한살이$/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '다른 식물 키우기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'pick' })
  })
})

describe('DexScreen journal link', () => {
  test('a completed current plant can reopen its journal; a growing one cannot', () => {
    const dispatch = vi.fn()
    const done = { ...newPlant('balsam'), stageIndex: SPECIES.balsam.stages.indexOf('seedDone') }
    const { unmount } = render(<DexScreen state={{ ...base(), plant: done, dex: ['balsam'] }} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: '일지 다시 보기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'journal' })
    unmount()
    render(<DexScreen state={{ ...base(), plant: newPlant('balsam') }} dispatch={dispatch} />)
    expect(screen.queryByRole('button', { name: '일지 다시 보기' })).toBeNull()
  })
})

describe('finished journals', () => {
  const entry = (day: number, stage: JournalEntry['stage']): JournalEntry => ({
    day,
    dateKey: `2026-10-${10 + day}`,
    stage,
    heightCm: day * 2,
    leaves: day,
    actions: { waterAdded: 20, pellets: 0, bugsRemoved: 0, place: 'desk' },
    statuses: {
      water: { level: 4, dir: null },
      light: { level: 4, dir: null },
      temp: { level: 4, dir: null },
      nutrient: { level: 4, dir: null },
      pest: { level: 4, dir: null },
    },
  })
  const record = [entry(1, 'seed'), entry(2, 'sprout'), entry(10, 'seedDone')]

  test('a completed dex card opens its kept journal', () => {
    const dispatch = vi.fn()
    render(<DexScreen state={{ ...base(), plant: newPlant('corn'), dex: ['balsam', 'apple'], finished: { balsam: { journal: record } } }} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: '봉숭아 일지 보기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'openRecord', id: 'balsam' })
    // a species completed before journals were kept has no button
    expect(screen.queryByRole('button', { name: '사과나무 일지 보기' })).toBeNull()
  })

  test('the kept journal is read-only and printable, even while another plant grows', () => {
    const dispatch = vi.fn()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const s: AppState = {
      ...base(),
      plant: { ...newPlant('corn'), day: 3 },
      journal: [entry(1, 'seed')],
      dex: ['balsam'],
      finished: { balsam: { journal: record } },
      pastTries: [
        { speciesId: 'balsam', days: 4, stage: 'sprout', cause: '물이 부족해서 말라 버렸어요.' },
        { speciesId: 'rice', days: 2, stage: 'seed', cause: '너무 추웠어요.' },
      ],
      screen: 'record',
      record: 'balsam',
    }
    render(<JournalScreen state={s} dispatch={dispatch} record="balsam" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('봉숭아 한살이 일지')
    expect(screen.getByText('10일 만에 씨를 얻었어요!')).toBeTruthy()
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4)
    expect(screen.getByText(/물이 부족해서 말라 버렸어요/)).toBeTruthy()
    expect(screen.queryByText(/너무 추웠어요/)).toBeNull()
    expect(screen.queryByRole('button', { name: '씨 도감에 넣기' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '인쇄하기' }))
    expect(print).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '씨 도감' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'dex' })
    print.mockRestore()
  })

  test('PickScreen asks first only when a finished journal would be lost', () => {
    const dispatch = vi.fn()
    const done = { ...newPlant('bean'), stageIndex: SPECIES.bean.stages.indexOf('seedDone'), day: 11 }
    const lost: AppState = { ...base(), plant: done, journal: record, dex: ['bean'] }
    const { unmount } = render(<PickScreen state={lost} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: /벼/ }))
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '그만두기' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /벼/ }))
    fireEvent.click(screen.getByRole('button', { name: '새로 키우기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'pick', id: 'rice' })
    unmount()
    dispatch.mockClear()
    render(<PickScreen state={{ ...lost, finished: { bean: { journal: record } } }} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: /벼/ }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'pick', id: 'rice' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('BackupPanel', () => {
  const withPlant = (): AppState => ({
    ...base(),
    plant: { ...newPlant('corn'), day: 4 },
    screen: 'backup',
  })

  test('shows the short code to write down and the full code to copy', () => {
    const s = withPlant()
    render(<BackupPanel state={s} dispatch={() => {}} back="grow" />)
    const short = screen.getByLabelText('짧은 기록 코드')
    expect(short.textContent).toBe(shortCode(toSave(s)).replace(/-/g, ''))
    expect(short.querySelectorAll('.bk-group')).toHaveLength(6)
    expect(screen.getByText(/이 짧은 코드를 실험관찰에 적어 두세요/)).toBeTruthy()
    expect(screen.getByText('짧은 코드는 식물과 도감만 되살려요.')).toBeTruthy()
    expect(screen.getByLabelText('전체 기록 코드').textContent).toBe(exportCode(toSave(s)))
    expect(screen.queryByRole('img')).toBeNull() // no QR
  })

  test('the written-down short code restores the plant', () => {
    const dispatch = vi.fn()
    const other = { ...base(), plant: { ...newPlant('rice'), day: 9 }, dex: ['bean' as const] }
    render(<BackupPanel state={withPlant()} dispatch={dispatch} back="grow" />)
    fireEvent.change(screen.getByLabelText('되살릴 코드'), { target: { value: shortCode(toSave(other)).toLowerCase() } })
    fireEvent.click(screen.getByRole('button', { name: '기록 되살리기' }))
    fireEvent.click(screen.getByRole('button', { name: '바꾸기' }))
    const a = dispatch.mock.calls[0][0]
    expect(a.type).toBe('restore')
    expect(a.data.plant).toMatchObject({ speciesId: 'rice', day: 9 })
    expect(a.data.dex).toEqual(['bean'])
  })

  test('no code card for an empty save or while the load warning shows', () => {
    const { unmount } = render(<BackupPanel state={{ ...base(), screen: 'backup' }} dispatch={() => {}} back="pick" />)
    expect(screen.queryByText('내 기록 코드')).toBeNull()
    expect(screen.getByRole('button', { name: '기록 되살리기' })).toBeTruthy()
    unmount()
    render(<BackupPanel state={{ ...withPlant(), warning: 'corrupt' }} dispatch={() => {}} back="pick" />)
    expect(screen.queryByText('내 기록 코드')).toBeNull()
    expect(screen.queryByLabelText('짧은 기록 코드')).toBeNull()
  })

  test('good code asks first, then restores', () => {
    const dispatch = vi.fn()
    const other = { ...base(), plant: { ...newPlant('rice'), day: 9 } }
    render(<BackupPanel state={withPlant()} dispatch={dispatch} back="grow" />)
    fireEvent.change(screen.getByLabelText('되살릴 코드'), { target: { value: `  ${exportCode(toSave(other))}\n` } })
    fireEvent.click(screen.getByRole('button', { name: '기록 되살리기' }))
    expect(screen.getByText('지금 기록이 바뀌어요. 계속할까요?')).toBeTruthy()
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '그만두기' }))
    expect(screen.queryByText('지금 기록이 바뀌어요. 계속할까요?')).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '기록 되살리기' }))
    fireEvent.click(screen.getByRole('button', { name: '바꾸기' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    const a = dispatch.mock.calls[0][0]
    expect(a.type).toBe('restore')
    expect(a.data.plant.day).toBe(9)
  })

  test('bad code shows message', () => {
    const dispatch = vi.fn()
    render(<BackupPanel state={withPlant()} dispatch={dispatch} back="grow" />)
    fireEvent.change(screen.getByLabelText('되살릴 코드'), { target: { value: 'PL1-엉터리' } })
    fireEvent.click(screen.getByRole('button', { name: '기록 되살리기' }))
    expect(screen.getByRole('alert').textContent).toBe('코드가 맞지 않아요. 다시 확인해 주세요.')
    expect(screen.queryByText('지금 기록이 바뀌어요. 계속할까요?')).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
  })

  test('warning shows a friendly line; back goes where it should', () => {
    const dispatch = vi.fn()
    render(<BackupPanel state={{ ...base(), warning: 'corrupt' }} dispatch={dispatch} back="pick" />)
    expect(screen.getByText('기록을 불러오지 못했어요. 적어 둔 코드가 있으면 넣어 주세요.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '돌아가기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'pick' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'clearWarning' })
  })
})
