import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
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

test('card shows the morning line and closes on tap', () => {
  render(<MorningCard report={{ ...base, heightDelta: 2 }} day={4} dayDone={false} />)
  const card = screen.getByRole('button', { name: '4일째 아침! 키가 2cm 자랐어요' })
  fireEvent.click(card)
  expect(screen.queryByRole('button')).toBeNull()
})
