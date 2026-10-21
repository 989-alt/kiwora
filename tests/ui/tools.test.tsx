import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Bugs } from '../../src/ui/tools/Bugs'
import { Fertilizer } from '../../src/ui/tools/Fertilizer'
import { WateringCan } from '../../src/ui/tools/WateringCan'

// jsdom has no PointerEvent, so fireEvent would drop clientX/pointerId; a MouseEvent-based stand-in keeps them.
class TestPointerEvent extends MouseEvent {
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
  }
}
if (!('PointerEvent' in window)) Object.assign(window, { PointerEvent: TestPointerEvent })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function pressCan() {
  const onWater = vi.fn()
  render(<WateringCan disabled={false} sound={false} onWater={onWater} onPourChange={() => {}} />)
  fireEvent.pointerDown(screen.getByRole('button', { name: /물 주기/ }), { pointerId: 1 })
  act(() => {
    vi.advanceTimersByTime(300)
  })
  return onWater
}

test('watering stops when the window loses focus', () => {
  const onWater = pressCan()
  const n = onWater.mock.calls.length
  expect(n).toBeGreaterThan(1)
  act(() => {
    window.dispatchEvent(new Event('blur'))
    vi.advanceTimersByTime(1000)
  })
  expect(onWater.mock.calls.length).toBe(n)
})

test('watering stops when the page is hidden', () => {
  const onWater = pressCan()
  const n = onWater.mock.calls.length
  const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(1000)
  })
  vis.mockRestore()
  expect(onWater.mock.calls.length).toBe(n)
})

test('a fast flick away from the fertilizer is not a tap', () => {
  const onPellet = vi.fn()
  const onDragChange = vi.fn()
  document.elementFromPoint = () => null
  render(<Fertilizer disabled={false} sound={false} onPellet={onPellet} onDragChange={onDragChange} />)
  const btn = screen.getByRole('button', { name: /영양분/ })
  fireEvent.pointerDown(btn, { pointerId: 1, clientX: 10, clientY: 10 })
  // released 200 px away with no move event in between
  fireEvent.pointerUp(btn, { pointerId: 1, clientX: 210, clientY: 10 })
  expect(onPellet).not.toHaveBeenCalled()
  expect(screen.queryByText('', { selector: '.pellet-ghost' })).toBeNull()
  // a real tap still gives one pellet
  fireEvent.pointerDown(btn, { pointerId: 2, clientX: 10, clientY: 10 })
  fireEvent.pointerUp(btn, { pointerId: 2, clientX: 12, clientY: 11 })
  expect(onPellet).toHaveBeenCalledTimes(1)
})

test('bug buttons stay at least 48 px under the low-light scaleX(0.85)', () => {
  render(<Bugs count={2} seed={1} scale={0.2} disabled={false} sound={false} onCatch={() => {}} />)
  for (const b of screen.getAllByRole('button', { name: '벌레 잡기' })) {
    expect(parseFloat(b.style.width) * 0.85).toBeGreaterThanOrEqual(48)
    expect(parseFloat(b.style.height)).toBeGreaterThanOrEqual(48)
  }
})
