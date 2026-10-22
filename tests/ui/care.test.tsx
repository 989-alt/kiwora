import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { careTasks } from '../../src/sim/care'
import { newPlant } from '../../src/sim/day'
import { SPECIES, STAGE_POINTS, type SpeciesId, type StageId } from '../../src/sim/species'
import type { CareTaskId, PlantState } from '../../src/sim/types'
import type { AppState } from '../../src/store'
import { bgArt, plantArt, potArt } from '../../src/ui/art'
import { CareLayer } from '../../src/ui/care/CareLayer'
import { CARE_TEXT } from '../../src/ui/care/careText'
import { careTargets } from '../../src/ui/care/targets'
import { sceneLayout, stageScale } from '../../src/ui/PlantView'
import { TodayCard } from '../../src/ui/TodayCard'
import { todoItems } from '../../src/ui/todo'

// jsdom has no PointerEvent, so fireEvent would drop clientX/pointerId; a MouseEvent-based stand-in keeps them.
class TestPointerEvent extends MouseEvent {
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
  }
}
if (!('PointerEvent' in window)) Object.assign(window, { PointerEvent: TestPointerEvent })

const ALL = Object.keys(SPECIES) as SpeciesId[]

/** The care tasks of this Task, the species that get them and the stage they come in. */
const CASES: [CareTaskId, SpeciesId[], StageId][] = [
  ['sow', ALL, 'seed'],
  ['thin', ALL, 'sprout'],
  ['stake', ['bean'], 'leafStem'],
  ['stakeTwine', ['morningGlory'], 'leafStem'],
  ['hillUp', ['rice', 'corn'], 'leafStem'],
  ['pinch', ['balsam'], 'leafStem'],
  ['drainCheck', ['apple', 'persimmon', 'forsythia', 'dandelion'], 'leafStem'],
]

// scene px sizes of the 6 viewports while a care is due (the '오늘 할 일' band takes room above the scene
// in landscape), measured at 1194×834, 1280×800, 1366×640, 1366×768, 820×1180 and 768×1024
const SCENES: [number, number][] = [
  [746, 516],
  [832, 484],
  [936, 358],
  [918, 452],
  [764, 632],
  [712, 565],
]

/** The morning card sits at the top left of the scene: targets keep out of this box. */
const MORNING = { right: 480, bottom: 100 }

function plantAt(id: SpeciesId, stage: StageId, over: Partial<PlantState> = {}): PlantState {
  return { ...newPlant(id, { mode: 'daily' }), stageIndex: SPECIES[id].stages.indexOf(stage), careDone: 0, ...over }
}

const layoutFor = (W: number, H: number, id: SpeciesId, stage: StageId, place: 'window' | 'desk' | 'shade' = 'desk') =>
  sceneLayout(W, H, stageScale(stage), { bg: bgArt(place).a, pot: potArt('happy').a, plant: plantArt(id, stage).a })

describe('every care target is reachable on every viewport', () => {
  for (const [task, ids, stage] of CASES)
    test(task, () => {
      for (const id of ids) {
        expect(careTasks(id, stage)[0]).toBe(task)
        for (const [W, H] of SCENES)
          for (const place of ['window', 'desk', 'shade'] as const) {
            const rects = careTargets(task, layoutFor(W, H, id, stage, place), plantArt(id, stage))
            expect(rects.length).toBeGreaterThan(0)
            for (const r of rects) {
              const at = `${id} ${W}x${H} ${place} ${JSON.stringify(r)}`
              expect(r.width, at).toBeGreaterThanOrEqual(48)
              expect(r.height, at).toBeGreaterThanOrEqual(48)
              expect(r.left, at).toBeGreaterThanOrEqual(0)
              expect(r.top, at).toBeGreaterThanOrEqual(0)
              expect(r.left + r.width, at).toBeLessThanOrEqual(W)
              expect(r.top + r.height, at).toBeLessThanOrEqual(H)
              expect(r.left >= MORNING.right || r.top >= MORNING.bottom, `${at} under the morning card`).toBe(true)
            }
          }
      }
    })
})

const tap = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { pointerId: 1 })
  fireEvent.pointerUp(el, { pointerId: 1 })
}
const tapName = (name: string, nth = 0) => tap(screen.getAllByRole('button', { name })[nth])

/** Each care's taps, in order; the last one finishes it. */
const SCRIPTS: [CareTaskId, SpeciesId, (() => void)[]][] = [
  [
    'sow',
    'bean',
    [
      () => tapName('흙에 씨 놓기'),
      () => tapName('흙에 씨 놓기'),
      () => tapName('흙에 씨 놓기'),
      () => tapName('흙 덮기'),
      () => tapName('흙 덮기'),
      () => tapName('흙 덮기'),
    ],
  ],
  ['thin', 'balsam', [() => tapName('약한 싹 뽑기', 0), () => tapName('약한 싹 뽑기', 0)]],
  ['stake', 'bean', [() => tapName('지지대 꽂을 자리')]],
  [
    'stakeTwine',
    'morningGlory',
    [
      () => tapName('지지대 꽂을 자리'),
      () => tapName('줄기에 덩굴 감기'),
      () => tapName('줄기에 덩굴 감기'),
      () => tapName('줄기에 덩굴 감기'),
    ],
  ],
  [
    'hillUp',
    'corn',
    [() => tapName('왼쪽 흙 북돋우기'), () => tapName('오른쪽 흙 북돋우기'), () => tapName('왼쪽 흙 북돋우기')],
  ],
  ['pinch', 'balsam', [() => tapName('곁가지 자르기', 0), () => tapName('곁가지 자르기', 0)]],
  ['drainCheck', 'apple', [() => tapName('물받이 살펴보기')]],
]

describe('each care finishes by taps alone', () => {
  for (const [task, id, steps] of SCRIPTS)
    test(task, () => {
      const stage = CASES.find(([t]) => t === task)![2]
      const onDone = vi.fn()
      render(
        <CareLayer plant={plantAt(id, stage)} layout={layoutFor(746, 584, id, stage)} disabled={false} sound={false} onDone={onDone} />,
      )
      steps.forEach((step, i) => {
        expect(onDone, `before step ${i + 1}`).not.toHaveBeenCalled()
        step()
      })
      expect(onDone).toHaveBeenCalledTimes(1)
      expect(onDone).toHaveBeenCalledWith(task)
    })
})

test('the click after a tap does not count on the target that took its place; a keyboard click does', () => {
  vi.useFakeTimers()
  try {
    const onDone = vi.fn()
    render(
      <CareLayer
        plant={plantAt('morningGlory', 'leafStem')}
        layout={layoutFor(746, 584, 'morningGlory', 'leafStem')}
        disabled={false}
        sound={false}
        onDone={onDone}
      />,
    )
    tapName('지지대 꽂을 자리')
    // the browser's click of that tap lands on the stem target now under the finger
    fireEvent.click(screen.getByRole('button', { name: '줄기에 덩굴 감기' }))
    expect(screen.getByText(/덩굴을 감아요 0\/3/)).toBeTruthy()
    vi.advanceTimersByTime(1500)
    fireEvent.click(screen.getByRole('button', { name: '줄기에 덩굴 감기' }))
    expect(screen.getByText(/덩굴을 감아요 1\/3/)).toBeTruthy()
  } finally {
    vi.useRealTimers()
  }
})

test('a disabled care layer ignores taps', () => {
  const onDone = vi.fn()
  render(
    <CareLayer
      plant={plantAt('apple', 'leafStem')}
      layout={layoutFor(746, 584, 'apple', 'leafStem')}
      disabled
      sound={false}
      onDone={onDone}
    />,
  )
  tapName('물받이 살펴보기')
  expect(onDone).not.toHaveBeenCalled()
})

const stateWith = (plant: PlantState | null) => ({ plant }) as unknown as AppState

test('the today card shows the pending care and switches to the waiting line at the threshold', () => {
  const early = todoItems(stateWith(plantAt('balsam', 'sprout', { growth: 1 })))
  expect(early).toEqual([{ key: 'care-thin', kind: 'care', text: CARE_TEXT.thin.todo }])
  const { unmount } = render(<TodayCard items={early} />)
  expect(screen.getByRole('status').textContent).toContain(CARE_TEXT.thin.todo)
  unmount()

  const due = todoItems(stateWith(plantAt('balsam', 'sprout', { growth: STAGE_POINTS })))
  expect(due.map((i) => i.text)).toEqual([CARE_TEXT.thin.waiting])
  render(<TodayCard items={due} />)
  expect(screen.getByRole('status').textContent).toContain('솎아 줘야 잎과 줄기가 잘 자라요')
})

test('a potted perennial already on the desk is told to end the day there', () => {
  const p = plantAt('dandelion', 'winter', { place: 'desk' })
  expect(todoItems(stateWith(p))[0].text).not.toBe(CARE_TEXT.moveIn.todo)
  expect(todoItems(stateWith(p))[0].text).toMatch(/하루를 마치/)
  expect(todoItems(stateWith({ ...p, place: 'window' }))[0].text).toBe(CARE_TEXT.moveIn.todo)
})

test('nothing to do shows no card', () => {
  expect(todoItems(stateWith(plantAt('balsam', 'sprout', { careDone: 1 })))).toEqual([])
  expect(todoItems(stateWith(null))).toEqual([])
  expect(todoItems(stateWith(plantAt('balsam', 'sprout', { dead: true })))).toEqual([])
  const { container } = render(<TodayCard items={[]} />)
  expect(container.innerHTML).toBe('')
})
