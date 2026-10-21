import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { newPlant } from '../../src/sim/day'
import { emptySave, type JournalEntry } from '../../src/sim/save'
import type { ConditionKey, Status } from '../../src/sim/types'
import { boot, type AppState } from '../../src/store'
import { actionsText, dayReached, feelingText, stageName, withGa } from '../../src/ui/journalText'
import { JournalScreen } from '../../src/ui/screens/JournalScreen'

const fine: Record<ConditionKey, Status> = {
  water: { level: 4, dir: null },
  light: { level: 3, dir: null },
  temp: { level: 4, dir: null },
  nutrient: { level: 3, dir: null },
  pest: { level: 4, dir: null },
}

function entry(day: number, over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    day,
    dateKey: `2026-10-${20 + day}`,
    stage: 'sprout',
    heightCm: day * 2,
    leaves: day,
    actions: { waterAdded: 30, pellets: 0, bugsRemoved: 0, place: 'desk' },
    statuses: fine,
    ...over,
  }
}

function stateWith(journal: JournalEntry[], over: Partial<AppState> = {}): AppState {
  const base = boot(emptySave(), '2026-10-25')
  return { ...base, plant: { ...newPlant('balsam'), stageIndex: 1, day: journal.length + 1 }, journal, screen: 'journal', ...over }
}

afterEach(() => vi.restoreAllMocks())

describe('JournalScreen', () => {
  test('journal lists every recorded day', () => {
    const journal = [1, 2, 3, 4, 5].map((d) => entry(d))
    render(<JournalScreen state={stateWith(journal)} dispatch={() => {}} />)
    const table = screen.getByRole('table')
    // header row + 5 day rows
    expect(within(table).getAllByRole('row')).toHaveLength(6)
    expect(within(table).getByText('5일')).toBeTruthy()
    expect(within(table).getAllByText('물 주기')).toHaveLength(5)
  })

  test('strip shows one picture per stage of the species with the day it was reached', () => {
    const journal = [entry(1, { stage: 'seed' }), entry(2, { stage: 'sprout' }), entry(3, { stage: 'sprout' })]
    render(<JournalScreen state={stateWith(journal)} dispatch={() => {}} />)
    const strip = screen.getByRole('list', { name: '한살이 단계' })
    expect(within(strip).getAllByRole('listitem')).toHaveLength(6) // annual: 6 stages
    expect(within(strip).getByText('싹').parentElement?.textContent).toContain('2일')
  })

  test('shows past tries', () => {
    const s = stateWith([entry(1)], {
      pastTries: [{ speciesId: 'bean', days: 6, stage: 'flower', cause: '물이 부족해서 말라 버렸어요.' }],
    })
    render(<JournalScreen state={s} dispatch={() => {}} />)
    expect(screen.getByText(/물이 부족해서 말라 버렸어요/)).toBeTruthy()
  })

  test('growing plant: back returns to grow; print calls window.print', () => {
    const dispatch = vi.fn()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<JournalScreen state={stateWith([entry(1)])} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: '돌아가기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'grow' })
    fireEvent.click(screen.getByRole('button', { name: '인쇄하기' }))
    expect(print).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '씨 도감에 넣기' })).toBeNull()
  })

  test('complete plant: go to the dex', () => {
    const dispatch = vi.fn()
    const done = { ...newPlant('balsam'), stageIndex: 5, day: 11 }
    render(<JournalScreen state={stateWith([entry(10, { stage: 'seedDone' })], { plant: done, dex: ['balsam'] })} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: '씨 도감에 넣기' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'open', screen: 'dex' })
    expect(screen.queryByRole('button', { name: '돌아가기' })).toBeNull()
  })
})

describe('journal text', () => {
  test('actionsText joins what was done, "살펴보기" when nothing', () => {
    const e = entry(2, { actions: { waterAdded: 20, pellets: 1, bugsRemoved: 2, place: 'window' } })
    expect(actionsText(e, 'desk')).toBe('물 주기, 창가로 옮김, 영양분 1알, 벌레 2마리 잡기')
    expect(actionsText(entry(3, { actions: { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' } }), 'desk')).toBe('살펴보기')
  })

  test('feelingText names the worst condition', () => {
    expect(feelingText(fine)).toBe('건강해요')
    expect(feelingText({ ...fine, water: { level: 2, dir: 'low' } })).toBe('물이 조금 부족했어요')
    expect(feelingText({ ...fine, water: { level: 2, dir: 'low' }, temp: { level: 0, dir: 'high' } })).toBe('많이 더웠어요')
    expect(feelingText({ ...fine, light: { level: null, notNeeded: true } })).toBe('건강해요')
  })

  test('stage names depend on the species: a dandelion is a 큰 포기, never a 어린나무', () => {
    expect(stageName('dandelion', 'grownTree')).toBe('큰 포기')
    expect(stageName('dandelion', 'grownTree', 'long')).toBe('큰 포기')
    expect(stageName('apple', 'grownTree')).toBe('어린나무')
    expect(stageName('apple', 'grownTree', 'long')).toBe('적당한 크기로 자라요')
    expect(stageName('dandelion', 'flower')).toBe('꽃')
    expect(stageName('balsam', 'seed', 'long')).toBe('씨')
  })

  test('dandelion journal: strip, table and past tries say 큰 포기', () => {
    const dandelion = { ...newPlant('dandelion'), stageIndex: 3, day: 8 }
    const s = stateWith([entry(7, { stage: 'grownTree' })], {
      plant: dandelion,
      pastTries: [{ speciesId: 'dandelion', days: 6, stage: 'grownTree', cause: '물이 부족해서 말라 버렸어요.' }],
    })
    render(<JournalScreen state={s} dispatch={() => {}} />)
    expect(screen.queryByText(/어린나무/)).toBeNull()
    const strip = screen.getByRole('list', { name: '한살이 단계' })
    expect(within(strip).getByText('큰 포기')).toBeTruthy()
    expect(within(screen.getByRole('table')).getByText('큰 포기')).toBeTruthy()
    expect(screen.getByText(/큰 포기 단계까지/)).toBeTruthy()
  })

  test('dayReached and 가/이', () => {
    expect(dayReached([entry(1, { stage: 'seed' }), entry(2, { stage: 'sprout' })], 'sprout')).toBe(2)
    expect(dayReached([], 'seed')).toBe(1)
    expect(dayReached([], 'flower')).toBeNull()
    expect(withGa('봉숭아')).toBe('봉숭아가')
    expect(withGa('벼')).toBe('벼가')
    expect(withGa('감나무')).toBe('감나무가')
    expect(withGa('옥수수')).toBe('옥수수가')
    expect(withGa('강낭콩')).toBe('강낭콩이')
    expect(withGa('개나리')).toBe('개나리가')
    expect(withGa('사과나무')).toBe('사과나무가')
    expect(withGa('민들레')).toBe('민들레가')
    expect(withGa('나팔꽃')).toBe('나팔꽃이')
  })
})
