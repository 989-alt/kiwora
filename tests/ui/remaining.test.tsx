import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { OBSERVATIONS } from '../../src/data/observations'
import { careTasks } from '../../src/sim/care'
import { newPlant } from '../../src/sim/day'
import { fullHeightCm, measureAnswer } from '../../src/sim/measure'
import { emptySave } from '../../src/sim/save'
import { SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { Place, PlantState } from '../../src/sim/types'
import { boot, growing, reducer, type Action, type AppState } from '../../src/store'
import { remainingActivities } from '../../src/ui/remaining'
import { GrowScreen } from '../../src/ui/screens/GrowScreen'

const D1 = '2026-10-22'
const IDS = Object.keys(SPECIES) as SpeciesId[]

/** A growing plant at `stage` on day 3 (no weather), its stage care not done, nothing observed yet. */
function stateAt(id: SpeciesId, stage: StageId, over: Partial<PlantState> = {}, s: Partial<AppState> = {}): AppState {
  const sp = SPECIES[id]
  const i = sp.stages.indexOf(stage)
  const tree = sp.transplant && i >= sp.stages.indexOf('grownTree')
  const place: Place = tree ? 'yardSunny' : 'window'
  const heightCm = stage === 'seed' ? 0 : (fullHeightCm(id, tree) * (i + 0.5)) / sp.stages.length
  const base = boot(emptySave(), D1)
  const plant: PlantState = { ...newPlant(id), stageIndex: i, careDone: 0, heightCm, day: 3, place, weatherFrom: 999, ...over }
  return { ...base, plant, screen: 'grow', lastDayKey: D1, settings: { ...base.settings, tutorialSeen: true }, ...s }
}

const run = (s: AppState, ...as: Action[]) => as.reduce((x, a) => reducer(x, a, D1), s)
const keys = (s: AppState) => remainingActivities(s).map((r) => r.key)

describe('remainingActivities', () => {
  test('every species and stage: care and observing are listed, each can be done today, and then nothing is left', () => {
    for (const id of IDS)
      for (const stage of SPECIES[id].stages) {
        const label = `${id}/${stage}`
        let s = stateAt(id, stage)
        const p = s.plant!
        // a finished annual (seed taken) no longer grows: nothing is asked for, the screen is the record
        if (!growing(p)) {
          expect(keys(s), label).toEqual([])
          continue
        }
        const set = OBSERVATIONS[id][stage]
        const task = careTasks(id, stage)[0]
        const left = keys(s)
        // observing is asked for whenever the stage has magnifier sentences
        expect(left.includes('observe'), label).toBe(set !== undefined)
        if (task !== undefined) expect(left, label).toContain(`care-${task}`)
        expect(left.length, label).toBe((set ? 1 : 0) + (task !== undefined ? 1 : 0))
        // do what is listed, the way the screen does it
        if (task === 'moveIn') s = run(s, { type: 'move', place: 'desk' })
        else if (task !== undefined) s = run(s, { type: 'care', task })
        if (set) {
          s = run(s, { type: 'observe', text: set.yes[0] })
          if (stage !== 'seed' && p.heightCm >= 1) s = run(s, { type: 'measure', cm: measureAnswer(p.heightCm), helped: false })
        }
        expect(keys(s), label).toEqual([])
      }
  })

  test('the names in the bubble: 관찰하기 first, then the care word', () => {
    expect(remainingActivities(stateAt('bean', 'leafStem')).map((r) => r.label)).toEqual(['관찰하기', '지지대 세우기'])
    expect(remainingActivities(stateAt('balsam', 'seed')).map((r) => r.label)).toEqual(['관찰하기', '씨 심기'])
  })

  test('the ruler is asked for only when it is out (from 1 cm); the magnifier alone otherwise', () => {
    const sprout = stateAt('bean', 'sprout', { heightCm: 0.6, careDone: 1 })
    expect(keys(run(sprout, { type: 'observe', text: OBSERVATIONS.bean.sprout!.yes[0] }))).toEqual([])
    const tall = stateAt('bean', 'sprout', { heightCm: 2.4, careDone: 1 })
    expect(keys(run(tall, { type: 'observe', text: OBSERVATIONS.bean.sprout!.yes[0] }))).toEqual(['observe'])
  })

  test('not asked for: care that cannot be done today, weather, watering; nothing once the day is done or the plant is gone', () => {
    // a potted perennial already on the desk in winter: its care counts at the day's end
    expect(keys(stateAt('dandelion', 'winter', { place: 'desk' }))).not.toContain('care-moveIn')
    // a tree not yet in the yard is pruned only after the move
    expect(keys(stateAt('apple', 'grownTree', { place: 'window' }))).not.toContain('care-prune')
    // the observing done, a thirsty, hungry plant on a typhoon day is still free to end the day
    const done = stateAt('bean', 'leafStem', { careDone: 1, water: 5, nutrient: 5 }, {
      pendingObs: { observed: OBSERVATIONS.bean.leafStem!.yes[0], measuredCm: 1 },
    })
    expect(keys(done)).toEqual([])
    expect(keys({ ...stateAt('bean', 'leafStem'), dayDone: true })).toEqual([])
    expect(keys(stateAt('bean', 'leafStem', { dead: true }))).toEqual([])
  })
})

/** GrowScreen over the real reducer; every dispatched action is kept in `log`. */
function harness(init: AppState) {
  const log: Action[] = []
  let current = init
  function Harness() {
    const [s, setS] = useState(init)
    current = s
    return (
      <GrowScreen
        state={s}
        dispatch={(a) => {
          log.push(a)
          setS((x) => reducer(x, a, D1))
        }}
      />
    )
  }
  const r = render(<Harness />)
  return { ...r, log, now: () => current }
}

describe('하루 마치기 with activities left', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const bubble = () => screen.queryByText('남은 활동이 있어요!')

  test('observing left: the bubble names it, the day does not end, the 관찰하기 button pulses; it goes after a while', () => {
    for (const mode of ['quick', 'daily'] as const) {
      const { log, now, container, unmount } = harness(stateAt('bean', 'leafStem', { careDone: 1, mode }))
      fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
      expect(log.filter((a) => a.type === 'endDay'), mode).toEqual([])
      expect(now().plant!.day).toBe(3)
      expect(bubble(), mode).not.toBeNull()
      expect(screen.getByText('관찰하기', { selector: '.gs-nag-left' })).toBeTruthy()
      // the bubble is announced politely, its words at least 18px (CSS), no emoji
      expect(container.querySelector('.gs-nag')!.closest('[aria-live="polite"]')).not.toBeNull()
      expect(container.querySelector('.tool--obs')!.className).toMatch(/nag-pulse/)
      // the button stays a button (never disabled by this)
      expect((screen.getByRole('button', { name: '하루 마치기' }) as HTMLButtonElement).disabled).toBe(false)
      act(() => {
        vi.advanceTimersByTime(2600)
      })
      expect(bubble()).toBeNull()
      unmount()
    }
  })

  test('care left: the bubble names the care, the to-do card pulses', () => {
    const { log, container } = harness(
      stateAt('bean', 'leafStem', { careDone: 0 }, { pendingObs: { observed: OBSERVATIONS.bean.leafStem!.yes[0], measuredCm: 1 } }),
    )
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    expect(log.filter((a) => a.type === 'endDay')).toEqual([])
    expect(screen.getByText('지지대 세우기', { selector: '.gs-nag-left' })).toBeTruthy()
    expect(container.querySelector('.gs-todo')!.className).toMatch(/nag-pulse/)
  })

  test('both left: one line names both', () => {
    harness(stateAt('bean', 'leafStem'))
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    expect(screen.getByText('관찰하기 · 지지대 세우기')).toBeTruthy()
  })

  test('everything done: the day ends as before', () => {
    const { log, now } = harness(
      stateAt('bean', 'leafStem', { careDone: 1, mode: 'quick' }, { pendingObs: { observed: OBSERVATIONS.bean.leafStem!.yes[0], measuredCm: 1 } }),
    )
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    expect(log.filter((a) => a.type === 'endDay')).toHaveLength(1)
    expect(bubble()).toBeNull()
    expect(now().plant!.day).toBe(4)
  })
})
