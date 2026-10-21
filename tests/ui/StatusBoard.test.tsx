import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { StatusBoard } from '../../src/ui/StatusBoard'
import type { ConditionKey, Status } from '../../src/sim/types'

const base: Record<ConditionKey, Status> = {
  water: { level: 3, dir: null },
  light: { level: 3, dir: null },
  temp: { level: 3, dir: null },
  nutrient: { level: 3, dir: null },
  pest: { level: 4, dir: null },
}

function filled(el: HTMLElement) {
  return el.querySelectorAll('[data-filled="true"]').length
}

test('water low shows level, direction and 2 filled cells', () => {
  render(<StatusBoard statuses={{ ...base, water: { level: 1, dir: 'low' } }} health={80} bugs={0} layout="side" />)
  const row = screen.getByRole('group', { name: '물 위험 부족' })
  expect(row.textContent).toContain('위험')
  expect(row.textContent).toContain('← 부족')
  expect(filled(row)).toBe(2)
})

test('notNeeded row is grey with a note and no filled cells', () => {
  render(<StatusBoard statuses={{ ...base, light: { level: null, notNeeded: true } }} health={80} bugs={0} layout="side" />)
  const row = screen.getByRole('group', { name: /^햇빛/ })
  expect(row.textContent).toContain('지금은 필요 없어요')
  expect(filled(row)).toBe(0)
})

test('temp high shows 더워요', () => {
  render(<StatusBoard statuses={{ ...base, temp: { level: 2, dir: 'high' } }} health={80} bugs={0} layout="side" />)
  expect(screen.getByRole('group', { name: '온도 주의 더워요' }).textContent).toContain('← 더워요')
})

test('health under 30 warns', () => {
  render(<StatusBoard statuses={base} health={25} bugs={0} layout="side" />)
  expect(screen.getByText('위험해요!')).toBeTruthy()
})

test('healthy plant has no warning', () => {
  render(<StatusBoard statuses={base} health={72} bugs={0} layout="bottom" />)
  expect(screen.queryByText('위험해요!')).toBeNull()
})

test('pest row shows bug count, and calm copy when not needed', () => {
  const { rerender } = render(
    <StatusBoard statuses={{ ...base, pest: { level: 1, dir: null } }} health={80} bugs={3} layout="side" />,
  )
  expect(screen.getByRole('group', { name: /^병충해/ }).textContent).toContain('벌레 3마리')
  rerender(
    <StatusBoard statuses={{ ...base, pest: { level: null, notNeeded: true } }} health={80} bugs={0} layout="side" />,
  )
  expect(screen.getByRole('group', { name: /^병충해/ }).textContent).toContain('아직 걱정 없어요')
})
