import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { DayReport } from '../../src/sim/types'
import { MorningCard, morningSummary } from '../../src/ui/screens/MorningCard'

const base: DayReport = {
  statuses: {
    water: { level: 3, dir: null },
    light: { level: 3, dir: null },
    temp: { level: 3, dir: null },
    nutrient: { level: 3, dir: null },
    pest: { level: 4, dir: null },
  },
  healthDelta: 0,
  grew: false,
  stageChanged: false,
  died: false,
  newBugs: 0,
  heightDelta: 0,
}

test('summary lines', () => {
  expect(morningSummary({ ...base, grew: true, heightDelta: 2 })).toBe('키가 2cm 자랐어요')
  expect(morningSummary({ ...base, healthDelta: -12 })).toBe('잎이 처졌어요')
  expect(morningSummary({ ...base, newBugs: 3 })).toBe('벌레가 3마리 생겼어요')
  expect(morningSummary({ ...base, stageChanged: true, heightDelta: 3, newBugs: 1 })).toBe('단계가 바뀌었어요, 키가 3cm 자랐어요')
  expect(morningSummary(base)).toBe('오늘도 잘 돌봐 주세요')
})

test('a seed gets its own line and never "잎이 처졌어요"', () => {
  expect(morningSummary({ ...base, grew: true }, 'seed')).toBe('흙 속에서 씨가 싹 틀 준비를 하고 있어요')
  const hurt = morningSummary({ ...base, grew: true, healthDelta: -4 }, 'seed')
  expect(hurt).not.toContain('잎')
  expect(hurt).toContain('씨')
  // the day it sprouts: the stage change, but no drooping leaves it never had during that day
  const sprouted = morningSummary({ ...base, grew: true, stageChanged: true, healthDelta: -4 }, 'sprout')
  expect(sprouted).toContain('단계가 바뀌었어요')
  expect(sprouted).not.toContain('잎이 처졌어요')
  // a grown plant still droops
  expect(morningSummary({ ...base, healthDelta: -4 }, 'leafStem')).toBe('잎이 처졌어요')
})

test('seed card on the grow screen', () => {
  render(<MorningCard report={{ ...base, grew: true }} day={2} dayDone={false} stage="seed" />)
  expect(screen.getByRole('button', { name: '2일째 아침! 흙 속에서 씨가 싹 틀 준비를 하고 있어요' })).toBeTruthy()
})

test('card shows the morning line and closes on tap', () => {
  const onClose = vi.fn()
  render(<MorningCard report={{ ...base, heightDelta: 2 }} day={4} dayDone={false} onClose={onClose} />)
  const card = screen.getByRole('button', { name: '4일째 아침! 키가 2cm 자랐어요' })
  fireEvent.click(card)
  expect(screen.queryByRole('button')).toBeNull()
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('height is told in whole cm, never with decimals', () => {
  expect(morningSummary({ ...base, grew: true, heightDelta: 2.3 })).toBe('키가 2cm 자랐어요')
  expect(morningSummary({ ...base, grew: true, heightDelta: 1.5 })).toBe('키가 2cm 자랐어요')
  expect(morningSummary({ ...base, grew: true, heightDelta: 0.3 })).toBe('키가 조금 자랐어요')
})

test('a very sick plant gets a clear danger line (health < 30)', () => {
  const { unmount } = render(<MorningCard report={{ ...base, healthDelta: -12 }} day={5} dayDone={false} health={20} />)
  expect(screen.getByText('식물이 많이 아파요! 상태판을 살펴봐요.')).toBeTruthy()
  unmount()
  render(<MorningCard report={{ ...base, healthDelta: -12 }} day={5} dayDone={false} health={30} />)
  expect(screen.queryByText(/많이 아파요/)).toBeNull()
})
