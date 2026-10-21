import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { newPlant } from '../../src/sim/day'
import { SPECIES } from '../../src/sim/species'
import { emptySave, exportCode } from '../../src/sim/save'
import { boot, toSave, type AppState } from '../../src/store'
import { BackupPanel } from '../../src/ui/screens/BackupPanel'
import { DeathScreen } from '../../src/ui/screens/DeathScreen'
import { DexScreen } from '../../src/ui/screens/DexScreen'
import { PickScreen } from '../../src/ui/screens/PickScreen'

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

  test('in the shipped build, species without teacher-approved pictures are disabled and say 준비 중', () => {
    vi.stubEnv('PROD', true)
    try {
      const dispatch = vi.fn()
      render(<PickScreen state={base()} dispatch={dispatch} />)
      const cards = screen.getAllByRole('button').filter((b) => b.classList.contains('pk-card'))
      expect(cards).toHaveLength(9) // nothing is approved yet
      for (const c of cards) {
        expect((c as HTMLButtonElement).disabled).toBe(true)
        expect(within(c).getByText('준비 중')).toBeTruthy()
      }
      fireEvent.click(cards[0])
      expect(dispatch).not.toHaveBeenCalled()
    } finally {
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

describe('BackupPanel', () => {
  const withPlant = (): AppState => ({
    ...base(),
    plant: { ...newPlant('corn'), day: 4 },
    screen: 'backup',
  })

  test('shows the code of the current record', () => {
    const s = withPlant()
    render(<BackupPanel state={s} dispatch={() => {}} back="grow" />)
    expect(screen.getByLabelText('복원 코드').textContent).toBe(exportCode(toSave(s)))
    expect(screen.getByText(/실험관찰에 적어 두세요/)).toBeTruthy()
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
