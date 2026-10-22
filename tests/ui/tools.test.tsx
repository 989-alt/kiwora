import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Bugs } from '../../src/ui/tools/Bugs'
import { Fertilizer } from '../../src/ui/tools/Fertilizer'
import { PlaceSlots, usePotDrag, type RoomPlace } from '../../src/ui/tools/PlaceSlots'
import { WATER_PER_TICK, WateringCan } from '../../src/ui/tools/WateringCan'

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

test('bugs sit on the leaf spots of the current plant picture, as aphids or caterpillars', () => {
  const spots: [number, number][] = [
    [100, 200],
    [300, 400],
    [500, 600],
  ]
  render(<Bugs count={3} seed={7} scale={0.5} spots={spots} disabled={false} sound={false} onCatch={() => {}} />)
  const placed = screen
    .getAllByRole('button', { name: '벌레 잡기' })
    .map((b) => [parseFloat(b.style.left) + parseFloat(b.style.width) / 2, parseFloat(b.style.top) + parseFloat(b.style.height) / 2])
  expect(placed.map(([x, y]) => [x / 0.5, y / 0.5]).sort()).toEqual(spots)
  for (const img of document.querySelectorAll('.bug img')) {
    expect(img.getAttribute('src')).toMatch(/^\/bugs\/(aphid|caterpillar)\.webp$/)
  }
})

test('on a small plant the bugs are pushed apart: no bug button covers the middle of another', () => {
  // a plant drawn small: its leaf spots are a few px apart
  render(<Bugs count={5} seed={3} scale={0.05} disabled={false} sound={false} onCatch={() => {}} />)
  const mids = screen
    .getAllByRole('button', { name: '벌레 잡기' })
    .map((b) => [parseFloat(b.style.left) + parseFloat(b.style.width) / 2, parseFloat(b.style.top) + parseFloat(b.style.height) / 2])
  expect(mids).toHaveLength(5)
  for (let i = 0; i < mids.length; i++)
    for (let j = i + 1; j < mids.length; j++)
      expect(Math.max(Math.abs(mids[i][0] - mids[j][0]), Math.abs(mids[i][1] - mids[j][1]))).toBeGreaterThanOrEqual(58)
})

test('bug buttons stay at least 48 px under the low-light scaleX(0.85)', () => {
  render(<Bugs count={2} seed={1} scale={0.2} disabled={false} sound={false} onCatch={() => {}} />)
  for (const b of screen.getAllByRole('button', { name: '벌레 잡기' })) {
    expect(parseFloat(b.style.width) * 0.85).toBeGreaterThanOrEqual(48)
    expect(parseFloat(b.style.height)).toBeGreaterThanOrEqual(48)
  }
})

test('more bugs than measured spots: every counted bug is shown and can be tapped', () => {
  const spots: [number, number][] = [
    [100, 200],
    [300, 400],
  ]
  const onCatch = vi.fn()
  render(<Bugs count={12} seed={3} scale={0.5} spots={spots} disabled={false} sound={false} onCatch={onCatch} />)
  const buttons = screen.getAllByRole('button', { name: '벌레 잡기' })
  expect(buttons).toHaveLength(12)
  for (const b of buttons) fireEvent.click(b)
  expect(onCatch).toHaveBeenCalledTimes(12)
  expect(screen.queryAllByRole('button', { name: '벌레 잡기' })).toHaveLength(0)
})

test('the first bugs of the day sit on measured spots before any padded place', () => {
  const spots: [number, number][] = [
    [100, 200],
    [300, 400],
    [500, 600],
    [700, 800],
    [900, 1000],
    [1100, 1200],
    [1300, 1400],
    [1500, 1600],
    [1700, 1800],
    [1900, 2000],
    [2100, 2200],
    [2300, 2400],
  ]
  render(<Bugs count={2} seed={11} scale={1} spots={spots} measured={2} disabled={false} sound={false} onCatch={() => {}} />)
  const placed = screen
    .getAllByRole('button', { name: '벌레 잡기' })
    .map((b) => [parseFloat(b.style.left) + parseFloat(b.style.width) / 2, parseFloat(b.style.top) + parseFloat(b.style.height) / 2])
  expect(placed.sort()).toEqual(spots.slice(0, 2))
})

test('the watering can gives one dose on a plain click (keyboard, screen reader)', () => {
  const onWater = vi.fn()
  render(<WateringCan disabled={false} sound={false} onWater={onWater} onPourChange={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /물 주기/ }))
  expect(onWater).toHaveBeenCalledTimes(1)
  expect(onWater).toHaveBeenCalledWith(WATER_PER_TICK)
})

test('a press and its click do not dose twice', () => {
  const onWater = vi.fn()
  render(<WateringCan disabled={false} sound={false} onWater={onWater} onPourChange={() => {}} />)
  const can = screen.getByRole('button', { name: /물 주기/ })
  fireEvent.pointerDown(can, { pointerId: 1 })
  act(() => {
    vi.advanceTimersByTime(250)
  })
  fireEvent.pointerUp(can, { pointerId: 1 })
  const poured = onWater.mock.calls.length
  expect(poured).toBe(3) // at 0, 100 and 200 ms
  fireEvent.click(can)
  expect(onWater).toHaveBeenCalledTimes(poured)
  // much later, a plain click is a dose again
  act(() => {
    vi.advanceTimersByTime(5000)
  })
  fireEvent.click(can)
  expect(onWater).toHaveBeenCalledTimes(poured + 1)
})

test('a disabled can ignores clicks', () => {
  const onWater = vi.fn()
  render(<WateringCan disabled sound={false} onWater={onWater} onPourChange={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /물 주기/ }))
  expect(onWater).not.toHaveBeenCalled()
})

test('the fertilizer gives one pellet on a plain click, and a tap is still one pellet', () => {
  const onPellet = vi.fn()
  document.elementFromPoint = () => null
  render(<Fertilizer disabled={false} sound={false} onPellet={onPellet} onDragChange={() => {}} />)
  const btn = screen.getByRole('button', { name: /영양분/ })
  fireEvent.click(btn)
  expect(onPellet).toHaveBeenCalledTimes(1)
  fireEvent.pointerDown(btn, { pointerId: 3, clientX: 10, clientY: 10 })
  fireEvent.pointerUp(btn, { pointerId: 3, clientX: 11, clientY: 10 })
  fireEvent.click(btn)
  expect(onPellet).toHaveBeenCalledTimes(2)
})

function PotHarness({ place, onMove }: { place: RoomPlace; onMove: (p: RoomPlace) => void }) {
  const drag = usePotDrag(false, onMove, place)
  return (
    <>
      <div data-testid="pot" {...drag.potProps} />
      <PlaceSlots place={place} disabled={false} dragging={drag.ghost !== null} hover={drag.hover} onPick={onMove} />
    </>
  )
}

test('dropping the pot on the slot it already stands on does nothing', () => {
  const onMove = vi.fn()
  render(<PotHarness place="desk" onMove={onMove} />)
  const pot = screen.getByTestId('pot')
  const slot = (name: string) => screen.getByRole('button', { name })
  document.elementFromPoint = () => slot('책상')
  fireEvent.pointerDown(pot, { pointerId: 1, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(pot, { pointerId: 1, clientX: 60, clientY: 60 })
  fireEvent.pointerUp(pot, { pointerId: 1, clientX: 60, clientY: 60 })
  expect(onMove).not.toHaveBeenCalled()
  // another slot still moves it
  document.elementFromPoint = () => slot('창가')
  fireEvent.pointerDown(pot, { pointerId: 2, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(pot, { pointerId: 2, clientX: 60, clientY: 60 })
  fireEvent.pointerUp(pot, { pointerId: 2, clientX: 60, clientY: 60 })
  expect(onMove).toHaveBeenCalledWith('window')
})
