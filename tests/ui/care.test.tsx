import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { careTasks, isOutdoor, pendingCare } from '../../src/sim/care'
import { newPlant } from '../../src/sim/day'
import { SPECIES, STAGE_POINTS, type SpeciesId, type StageId } from '../../src/sim/species'
import type { CareTaskId, Place, PlantState } from '../../src/sim/types'
import type { AppState } from '../../src/store'
import { bgArt, plantArt, potArt } from '../../src/ui/art'
import { CareLayer } from '../../src/ui/care/CareLayer'
import { CARE_TEXT } from '../../src/ui/care/careText'
import { carePoints, careTargets } from '../../src/ui/care/targets'
import { sceneLayout, stageScale, yardLayout } from '../../src/ui/PlantView'
import { TodayCard } from '../../src/ui/TodayCard'
import { PlaceSlots } from '../../src/ui/tools/PlaceSlots'
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
/** The trees: planted in the yard at 'grownTree', cared for there from then on. */
const TREES: SpeciesId[] = ['apple', 'persimmon', 'forsythia']
const ROOM: Place[] = ['window', 'desk', 'shade']
const YARD: Place[] = ['yardSunny', 'yardPartial', 'yardShade']

/** The care tasks of this Task, the species that get them and the stage they come in. */
const CASES: [CareTaskId, SpeciesId[], StageId][] = [
  ['sow', ALL, 'seed'],
  ['thin', ALL, 'sprout'],
  ['stake', ['bean'], 'leafStem'],
  ['stakeTwine', ['morningGlory'], 'leafStem'],
  ['hillUp', ['rice', 'corn'], 'leafStem'],
  ['pinch', ['balsam'], 'leafStem'],
  ['drainCheck', ['apple', 'persimmon', 'forsythia', 'dandelion'], 'leafStem'],
  ['prune', TREES, 'grownTree'],
  ['pollinate', ['morningGlory', 'bean', 'balsam', 'apple', 'persimmon', 'forsythia', 'dandelion'], 'flower'],
  ['shakePollen', ['rice', 'corn'], 'flower'],
  ['harvestSeed', ['morningGlory', 'bean', 'rice', 'corn', 'balsam'], 'fruit'],
  ['harvest', [...TREES, 'dandelion'], 'fruit'],
  ['winterWrap', TREES, 'winter'],
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

/** Tasks whose marks are all on screen at once. */
const TOGETHER: CareTaskId[] = ['prune', 'pollinate', 'harvestSeed', 'harvest']

/** The morning card sits at the top left of the scene: targets keep out of this box. */
const MORNING = { right: 480, bottom: 100 }

/** A plant at the stage with none of its care done; a tree from 'grownTree' on stands in the yard. */
function plantAt(id: SpeciesId, stage: StageId, over: Partial<PlantState> = {}): PlantState {
  const p = { ...newPlant(id, { mode: 'daily' }), stageIndex: SPECIES[id].stages.indexOf(stage), careDone: 0 }
  return { ...p, place: isOutdoor(p) ? 'yardSunny' : 'desk', ...over }
}

/** The scene layout PlantView draws for that place: the yard has no pot. */
const layoutFor = (W: number, H: number, id: SpeciesId, stage: StageId, place: Place = 'desk') =>
  YARD.includes(place)
    ? yardLayout(W, H, stageScale(stage), { bg: bgArt(place).a, plant: plantArt(id, stage).a })
    : sceneLayout(W, H, stageScale(stage), { bg: bgArt(place).a, pot: potArt('happy').a, plant: plantArt(id, stage).a })

describe('every care target is reachable on every viewport', () => {
  for (const [task, ids, stage] of CASES)
    test(task, () => {
      for (const id of ids) {
        expect(careTasks(id, stage)[0]).toBe(task)
        expect(pendingCare(plantAt(id, stage)), `${id} ${stage}`).toBe(task)
        const outdoor = isOutdoor(plantAt(id, stage))
        // every scene size and place, with the morning card up and after it is closed
        const views = SCENES.flatMap(([W, H]) => [true, false].map((card) => ({ W, H, card })))
        for (const { W, H, card } of views)
          for (const place of outdoor ? YARD : ROOM) {
            const rects = careTargets(task, layoutFor(W, H, id, stage, place), plantArt(id, stage), id, card)
            expect(rects.length).toBeGreaterThan(0)
            for (const r of rects) {
              const at = `${id} ${W}x${H} ${place} card ${card} ${JSON.stringify(r)}`
              expect(r.width, at).toBeGreaterThanOrEqual(48)
              expect(r.height, at).toBeGreaterThanOrEqual(48)
              expect(r.left, at).toBeGreaterThanOrEqual(0)
              expect(r.top, at).toBeGreaterThanOrEqual(0)
              expect(r.left + r.width, at).toBeLessThanOrEqual(W)
              expect(r.top + r.height, at).toBeLessThanOrEqual(H)
              if (card) expect(r.left >= MORNING.right || r.top >= MORNING.bottom, `${at} under the morning card`).toBe(true)
            }
            // marks shown together (twigs, flowers, fruits): none covers the middle of another
            if (TOGETHER.includes(task))
              for (const r of rects)
                for (const o of rects) {
                  if (o === r) continue
                  const c = { x: o.left + o.width / 2, y: o.top + o.height / 2 }
                  const inside = c.x > r.left && c.x < r.left + r.width && c.y > r.top && c.y < r.top + r.height
                  expect(inside, `${id} ${W}x${H} ${place}: ${JSON.stringify(r)} covers ${JSON.stringify(o)}`).toBe(false)
                }
          }
      }
    })
})

test('once the morning card is closed, a mark sits on what it marks: the dandelion flower head at the top', () => {
  const L = layoutFor(746, 516, 'dandelion', 'flower', 'window')
  const pic = plantArt('dandelion', 'flower')
  const [a] = carePoints('flower', L, pic, 'dandelion')
  const mid = (r: { left: number; top: number; width: number; height: number }) => [r.left + r.width / 2, r.top + r.height / 2]
  const [closed] = careTargets('pollinate', L, pic, 'dandelion', false)
  const [up] = careTargets('pollinate', L, pic, 'dandelion', true)
  expect(a[1]).toBeLessThan(MORNING.bottom)
  expect(Math.hypot(mid(closed)[0] - a[0], mid(closed)[1] - a[1])).toBeLessThan(26)
  expect(up.top).toBeGreaterThanOrEqual(MORNING.bottom)
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
  ['prune', 'apple', [() => tapName('마른 가지 자르기', 0), () => tapName('마른 가지 자르기', 0), () => tapName('마른 가지 자르기', 0)]],
  ['pollinate', 'bean', [() => tapName('꽃가루 묻히기'), () => tapName('다른 꽃에 꽃가루 옮기기')]],
  ['pollinate', 'apple', [() => tapName('꽃가루 묻히기'), () => tapName('다른 꽃에 꽃가루 옮기기')]],
  ['shakePollen', 'corn', [() => tapName('포기 흔들기'), () => tapName('포기 흔들기'), () => tapName('포기 흔들기')]],
  ['harvestSeed', 'bean', [() => tapName('열매 따기', 0), () => tapName('열매 따기', 0), () => tapName('열매 따기', 0)]],
  ['harvest', 'persimmon', [() => tapName('열매 따기', 0), () => tapName('열매 따기', 0), () => tapName('열매 따기', 0)]],
  ['harvest', 'dandelion', [() => tapName('열매 따기', 0), () => tapName('열매 따기', 0), () => tapName('열매 따기', 0)]],
  ['winterWrap', 'forsythia', [() => tapName('짚 감쌀 밑동')]],
]

describe('each care finishes by taps alone', () => {
  for (const [task, id, steps] of SCRIPTS)
    test(`${task} (${id})`, () => {
      const stage = CASES.find(([t]) => t === task)![2]
      const onDone = vi.fn()
      const plant = plantAt(id, stage)
      render(
        <CareLayer plant={plant} layout={layoutFor(746, 584, id, stage, plant.place)} disabled={false} sound={false} onDone={onDone} />,
      )
      steps.forEach((step, i) => {
        expect(onDone, `before step ${i + 1}`).not.toHaveBeenCalled()
        step()
      })
      expect(onDone).toHaveBeenCalledTimes(1)
      expect(onDone).toHaveBeenCalledWith(task)
    })
})

/** Renders the care of `id` at `stage` in a 746×584 scene; returns onDone and the task's target rects. */
function renderCare(id: SpeciesId, stage: StageId) {
  const onDone = vi.fn()
  const plant = plantAt(id, stage)
  const L = layoutFor(746, 584, id, stage, plant.place)
  render(<CareLayer plant={plant} layout={L} disabled={false} sound={false} onDone={onDone} />)
  return { onDone, rects: careTargets(pendingCare(plant)!, L, plantArt(id, stage), id) }
}
const mid = (r: { left: number; top: number; width: number; height: number }) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
/** A drag through the points (jsdom: the scene's client rect is at 0,0, so client px = scene px). */
function drag(el: HTMLElement, pts: { x: number; y: number }[]) {
  fireEvent.pointerDown(el, { pointerId: 2, clientX: pts[0].x, clientY: pts[0].y })
  for (const p of pts.slice(1)) fireEvent.pointerMove(el, { pointerId: 2, clientX: p.x, clientY: p.y })
  const last = pts[pts.length - 1]
  fireEvent.pointerUp(el, { pointerId: 2, clientX: last.x, clientY: last.y })
}

describe('the drags', () => {
  test('pollinate: the brush is dragged from one flower to the other, the pollen follows it', () => {
    const { onDone, rects } = renderCare('bean', 'flower')
    const [a, b] = [mid(rects[0]), mid(rects[1])]
    const el = screen.getByRole('button', { name: '꽃가루 묻히기' })
    fireEvent.pointerDown(el, { pointerId: 2, clientX: a.x, clientY: a.y })
    fireEvent.pointerMove(el, { pointerId: 2, clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 })
    expect(document.querySelectorAll('.care-pollen').length).toBeGreaterThan(0)
    fireEvent.pointerMove(el, { pointerId: 2, clientX: b.x, clientY: b.y })
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.pointerUp(el, { pointerId: 2, clientX: b.x, clientY: b.y })
    expect(onDone).toHaveBeenCalledWith('pollinate')
  })

  test('pollinate: the other flower alone does nothing, and a drop off the flower does not count', () => {
    const { onDone, rects } = renderCare('balsam', 'flower')
    tapName('다른 꽃에 꽃가루 옮기기')
    const a = mid(rects[0])
    drag(screen.getByRole('button', { name: '꽃가루 묻히기' }), [a, { x: a.x, y: a.y + 200 }, { x: 5, y: 580 }])
    expect(onDone).not.toHaveBeenCalled()
  })

  test('shakePollen: swinging the plant across its stem 3 times', () => {
    const { onDone, rects } = renderCare('rice', 'flower')
    const c = mid(rects[0])
    const el = screen.getByRole('button', { name: '포기 흔들기' })
    const swing = (n: number) => Array.from({ length: n }, (_, i) => ({ x: c.x + (i % 2 === 0 ? 40 : -40), y: c.y }))
    drag(el, [c, ...swing(2)])
    expect(onDone).not.toHaveBeenCalled()
    drag(el, [c, ...swing(4)])
    expect(onDone).toHaveBeenCalledWith('shakePollen')
  })

  test('winterWrap: the straw is dragged to the trunk', () => {
    const { onDone, rects } = renderCare('apple', 'winter')
    const [trunk, straw] = [mid(rects[0]), mid(rects[1])]
    drag(screen.getByRole('button', { name: '짚' }), [straw, { x: (straw.x + trunk.x) / 2, y: straw.y }, trunk])
    expect(onDone).toHaveBeenCalledWith('winterWrap')
  })

  test('harvestSeed: the seeds come out of the last fruit', () => {
    renderCare('corn', 'fruit')
    const seeds = () => document.querySelectorAll('.care-seeds')
    tapName('열매 따기', 0)
    tapName('열매 따기', 0)
    expect(seeds()).toHaveLength(0)
    tapName('열매 따기', 0)
    expect(seeds()).toHaveLength(1)
    expect((seeds()[0] as HTMLImageElement).src).toContain(plantArt('corn', 'seed').src)
  })
})

test('done care stays in the scene: straw on the trunk, seeds beside the pot', () => {
  const tree = plantAt('apple', 'winter', { careDone: 1 })
  const { unmount } = render(
    <CareLayer plant={tree} layout={layoutFor(746, 584, 'apple', 'winter', tree.place)} disabled={false} sound={false} onDone={() => {}} />,
  )
  expect(document.querySelector('.care-straw')).not.toBeNull()
  unmount()
  const bean = plantAt('bean', 'fruit', { careDone: 1 })
  render(<CareLayer plant={bean} layout={layoutFor(746, 584, 'bean', 'fruit')} disabled={false} sound={false} onDone={() => {}} />)
  expect(document.querySelector('.care-seeds')).not.toBeNull()
})

test('winter moveIn has nothing to do in the scene; the desk slot shines instead', () => {
  const p = plantAt('dandelion', 'winter', { place: 'window' })
  expect(pendingCare(p)).toBe('moveIn')
  const { container } = render(
    <CareLayer plant={p} layout={layoutFor(746, 584, 'dandelion', 'winter', 'window')} disabled={false} sound={false} onDone={() => {}} />,
  )
  expect(container.querySelectorAll('button')).toHaveLength(0)
  render(<PlaceSlots place="window" disabled={false} dragging={false} hover={null} glow="desk" onPick={() => {}} />)
  expect(screen.getByRole('button', { name: /책상/ }).className).toContain('slot--glow')
  expect(screen.getByRole('button', { name: /그늘/ }).className).not.toContain('slot--glow')
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
