import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import { OBSERVATIONS, observeChoices } from '../../src/data/observations'
import { newPlant } from '../../src/sim/day'
import { fullHeightCm, measureAnswer, rulerChoices } from '../../src/sim/measure'
import { seedFor } from '../../src/sim/rng'
import { emptySave } from '../../src/sim/save'
import { SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { PlantState } from '../../src/sim/types'
import { boot, reducer, type Action, type AppState } from '../../src/store'
import { Ruler } from '../../src/ui/observe/Ruler'
import { plantLayout } from '../../src/ui/PlantView'
import { GrowScreen } from '../../src/ui/screens/GrowScreen'

const D1 = '2026-10-22'

// scene sizes of the 6 viewports, with and without the '오늘 할 일' band (landscape only)
const SCENES: [number, number][] = [
  [746, 584], [832, 550], [936, 416], [918, 518], [764, 632], [712, 565],
  [746, 516], [832, 482], [936, 358], [918, 450],
]

describe('Ruler', () => {
  test('ruler ticks line up with the plant top', () => {
    const cases: [SpeciesId, StageId, number][] = [
      ['bean', 'sprout', 1.2],
      ['bean', 'leafStem', 7.4],
      ['balsam', 'flower', 15.6],
      ['corn', 'fruit', 22.9],
      ['dandelion', 'flower', 20.4],
      ['apple', 'leafStem', 9.5],
    ]
    for (const [W, H] of SCENES) {
      for (const [id, stage, h] of cases) {
        const p = { speciesId: id, stage, heightCm: h, place: 'desk' as const, health: 90 }
        const L = plantLayout(W, H, p)
        // the spacing of a full-grown plant in the same scene: one cm is the same on every day
        const full = fullHeightCm(id, false)
        const F = plantLayout(W, H, { ...p, stage: 'leafStem', heightCm: full })
        const pxPerCm = (F.groundY - F.plantTopY) / full
        const { container, unmount } = render(<Ruler L={L} heightCm={h} x={null} hint={false} disabled={false} onMove={() => {}} onPickTick={() => {}} />)
        const label = `${W}x${H} ${id}/${stage} ${h} cm`
        const yOf = (cm: number) => Number(container.querySelector(`[data-cm="${cm}"]`)?.getAttribute('y1'))
        // 0 sits on the ground; the ruler's own cm (read off its 10 cm mark) is the plant's cm
        expect(yOf(0), label).toBeCloseTo(L.groundY, 6)
        const rulerCm = (yOf(0) - yOf(10)) / 10
        expect(rulerCm, label).toBeCloseTo(pxPerCm, 6)
        // the answer's place on the ruler is within half a cm of the drawn plant's top
        const answerY = yOf(0) - measureAnswer(h) * rulerCm
        expect(Math.abs(answerY - L.plantTopY), label).toBeLessThanOrEqual(0.5 * pxPerCm + 1e-6)
        // every drawn mark is a whole number of minor steps from 0
        for (const t of container.querySelectorAll('[data-cm]')) {
          const cm = Number(t.getAttribute('data-cm'))
          expect(Number(t.getAttribute('y1')), `${label} mark ${cm}`).toBeCloseTo(yOf(0) - cm * pxPerCm, 6)
        }
        unmount()
      }
    }
  })
})

/** A growing plant at `stage` (its care done) on day 3 of a daily game, the tutorial seen. */
function stateWith(id: SpeciesId, stage: StageId, heightCm: number, over: Partial<AppState> = {}): AppState {
  const base = boot(emptySave(), D1)
  const plant: PlantState = { ...newPlant(id), stageIndex: SPECIES[id].stages.indexOf(stage), careDone: 1, heightCm, day: 3 }
  return {
    ...base,
    plant,
    screen: 'grow',
    lastDayKey: D1,
    settings: { ...base.settings, tutorialSeen: true },
    ...over,
  }
}

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

const panel = () => screen.getByRole('region', { name: '관찰하기' })

describe('ObservePanel', () => {
  test('a right reading is recorded at once', () => {
    const h = 7.4
    const { log, now } = harness(stateWith('bean', 'leafStem', h))
    fireEvent.click(screen.getByRole('button', { name: '관찰하기' }))
    fireEvent.click(screen.getByRole('button', { name: '자' }))
    const choices = rulerChoices(h, seedFor(3, 'bean'))
    for (const c of choices) expect(within(panel()).getByRole('button', { name: `${c} cm` })).toBeTruthy()
    fireEvent.click(within(panel()).getByRole('button', { name: `${measureAnswer(h)} cm` }))
    expect(log).toContainEqual({ type: 'measure', cm: 7, helped: false })
    expect(now().pendingObs).toEqual({ measuredCm: 7, measureHelped: false })
  })

  test('two misses highlight the answer and record it as helped', () => {
    const h = 7.4
    const { log, now } = harness(stateWith('bean', 'leafStem', h))
    fireEvent.click(screen.getByRole('button', { name: '관찰하기' }))
    fireEvent.click(screen.getByRole('button', { name: '자' }))
    const wrong = rulerChoices(h, seedFor(3, 'bean')).filter((c) => c !== 7)
    fireEvent.click(within(panel()).getByRole('button', { name: `${wrong[0]} cm` }))
    expect(within(panel()).getByText('다시 보아요')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '7 cm 눈금' })).toBeNull()
    fireEvent.click(within(panel()).getByRole('button', { name: `${wrong[1]} cm` }))
    // the right tick and the right choice light up; the wrong ones can't be picked any more
    const right = within(panel()).getByRole('button', { name: '7 cm' })
    expect(right.className).toContain('obs-choice--hint')
    for (const w of wrong) expect((within(panel()).getByRole('button', { name: `${w} cm` }) as HTMLButtonElement).disabled).toBe(true)
    expect(log.filter((a) => a.type === 'measure')).toEqual([])
    // the student taps the lit tick on the ruler
    fireEvent.click(screen.getByRole('button', { name: '7 cm 눈금' }))
    expect(log).toContainEqual({ type: 'measure', cm: 7, helped: true })
    expect(now().pendingObs).toEqual({ measuredCm: 7, measureHelped: true })
  })

  test('two misses with the magnifier: the true sentence lights up, picking it records it', () => {
    const { log, now } = harness(stateWith('corn', 'leafStem', 9))
    fireEvent.click(screen.getByRole('button', { name: '관찰하기' }))
    fireEvent.click(screen.getByRole('button', { name: '돋보기' }))
    const { options, answer } = observeChoices('corn', 'leafStem', seedFor(3, 'corn') + 1)
    const wrong = options.filter((o) => o !== answer)
    fireEvent.click(within(panel()).getByRole('button', { name: wrong[0] }))
    expect(within(panel()).getByText('다시 보아요')).toBeTruthy()
    fireEvent.click(within(panel()).getByRole('button', { name: wrong[1] }))
    const right = within(panel()).getByRole('button', { name: answer })
    expect(right.className).toContain('obs-choice--hint')
    fireEvent.click(right)
    expect(log).toContainEqual({ type: 'observe', text: answer })
    expect(OBSERVATIONS.corn.leafStem!.yes).toContain(now().pendingObs?.observed)
  })

  test('once a day', () => {
    const h = 12.2
    const { now } = harness(stateWith('balsam', 'flower', h))
    fireEvent.click(screen.getByRole('button', { name: '관찰하기' }))
    fireEvent.click(screen.getByRole('button', { name: '자' }))
    fireEvent.click(within(panel()).getByRole('button', { name: '12 cm' }))
    fireEvent.click(screen.getByRole('button', { name: '돋보기' }))
    const { answer } = observeChoices('balsam', 'flower', seedFor(3, 'balsam') + 1)
    fireEvent.click(within(panel()).getByRole('button', { name: answer }))
    fireEvent.click(within(panel()).getByRole('button', { name: '닫기' }))
    const done = screen.getByRole('button', { name: '오늘 관찰 끝' }) as HTMLButtonElement
    expect(done.disabled).toBe(true)
    expect(now().pendingObs).toEqual({ measuredCm: 12, measureHelped: false, observed: answer })
    // the next day observes again
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /하루 마치기/ }))
    })
    expect(now().journal[0]).toMatchObject({ measuredCm: 12, observed: answer })
  })

  test('a day that is already observed shows the button as done, and a seed has no ruler', () => {
    const done = stateWith('bean', 'leafStem', 7.4, { pendingObs: { measuredCm: 7, measureHelped: false, observed: OBSERVATIONS.bean.leafStem!.yes[0] } })
    const r = harness(done)
    expect((screen.getByRole('button', { name: '오늘 관찰 끝' }) as HTMLButtonElement).disabled).toBe(true)
    r.unmount()
    // a seed under the soil: the magnifier shows the seed, there is no ruler; observing it ends the day's observing
    harness(stateWith('bean', 'seed', 0, { plant: { ...newPlant('bean'), careDone: 1, day: 3 } }))
    fireEvent.click(screen.getByRole('button', { name: '관찰하기' }))
    expect(screen.queryByRole('button', { name: '자' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '돋보기' }))
    const { answer } = observeChoices('bean', 'seed', seedFor(3, 'bean') + 1)
    fireEvent.click(within(panel()).getByRole('button', { name: answer }))
    fireEvent.click(within(panel()).getByRole('button', { name: '닫기' }))
    expect(screen.getByRole('button', { name: '오늘 관찰 끝' })).toBeTruthy()
  })

  test('a plant under 1 cm has no ruler', () => {
    harness(stateWith('bean', 'sprout', 0.6))
    fireEvent.click(screen.getByRole('button', { name: '관찰하기' }))
    expect(screen.queryByRole('button', { name: '자' })).toBeNull()
    expect(screen.getByRole('button', { name: '돋보기' })).toBeTruthy()
  })
})
