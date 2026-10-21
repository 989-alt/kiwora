import { describe, expect, it } from 'vitest'
import { currentStatuses, endDay, newPlant, PLACE_ENV } from '../../src/sim/day'
import { mulberry32, seedFor } from '../../src/sim/rng'
import { phaseOf, SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { Band, DayActions, DayReport, Place, PlantState } from '../../src/sim/types'

const noBugs = () => 0.99
const mid = (b: Band) => (b.idealLo + b.idealHi) / 2
const stageOf = (s: PlantState): StageId => SPECIES[s.speciesId].stages[s.stageIndex]

function at(id: SpeciesId, stage: StageId, over: Partial<PlantState> = {}): PlantState {
  return { ...newPlant(id), stageIndex: SPECIES[id].stages.indexOf(stage), ...over }
}

/** Light-loving species (light idealLo above the desk) go to the window, others stay on the desk. */
const carePlace = (id: SpeciesId): Place =>
  SPECIES[id].bands.grow.light.idealLo > PLACE_ENV.desk.light ? 'window' : 'desk'

/**
 * Realistic ideal care: only what the UI can do. Tops water/nutrient up toward the current phase
 * band's ideal midpoint (never removes any, whole pellets only) and removes all bugs.
 */
function idealCare(s: PlantState, place: Place = carePlace(s.speciesId)): DayActions {
  const b = SPECIES[s.speciesId].bands[phaseOf(stageOf(s))]
  return {
    waterAdded: Math.max(0, mid(b.water) - s.water),
    pellets: Math.max(0, Math.round((mid(b.nutrient) - s.nutrient) / 15)),
    bugsRemoved: s.bugs,
    place,
  }
}

function run(s: PlantState, days: number, place?: Place) {
  let state = s
  let report!: DayReport
  for (let i = 0; i < days; i++) {
    const r = endDay(state, idealCare(state, place), noBugs)
    state = r.state
    report = r.report
  }
  return { state, report }
}

const ANNUALS = (Object.keys(SPECIES) as SpeciesId[]).filter((id) => SPECIES[id].life === 'annual')
const PERENNIALS = (Object.keys(SPECIES) as SpeciesId[]).filter((id) => SPECIES[id].life === 'perennial')

describe('endDay', () => {
  it('ideal care finishes annual in 10 days', () => {
    const nine = run(newPlant('balsam'), 9).state
    expect(stageOf(nine)).toBe('fruit')
    const { state } = run(newPlant('balsam'), 10)
    expect(stageOf(state)).toBe('seedDone')
    expect(state.dead).toBe(false)
    expect(state.day).toBe(11)
  })

  it.each(ANNUALS)('ideal care finishes annual %s in exactly 10 days', (id) => {
    expect(stageOf(run(newPlant(id), 9).state)).toBe('fruit')
    const { state } = run(newPlant(id), 10)
    expect(stageOf(state)).toBe('seedDone')
    expect(state.dead).toBe(false)
  })

  it.each(PERENNIALS)('ideal care finishes perennial %s within 15 days', (id) => {
    const { state } = run(newPlant(id), 15)
    expect(stageOf(state)).toBe('newShoot')
    expect(state.dead).toBe(false)
  })

  it('stops advancing at the final stage', () => {
    const { state, report } = run(newPlant('balsam'), 13)
    expect(stageOf(state)).toBe('seedDone')
    expect(state.stageIndex).toBe(SPECIES.balsam.stages.length - 1)
    expect(report.stageChanged).toBe(false)
    expect(report.grew).toBe(false)
  })

  it('single very-dangerous day never kills from half health', () => {
    const s = at('balsam', 'leafStem', { health: 50, water: 0, nutrient: 50 })
    const { state, report } = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }, noBugs)
    expect(report.statuses.water).toEqual({ level: 0, dir: 'low' })
    expect(state.health).toBe(25)
    expect(report.healthDelta).toBe(-25)
    expect(state.dead).toBe(false)
  })

  it('seed stage ignores light and nutrient', () => {
    const s = at('balsam', 'seed', { nutrient: 0, lightExp: 30 })
    const { report } = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'shade' }, noBugs)
    expect(report.statuses.light).toEqual({ level: null, notNeeded: true })
    expect(report.statuses.nutrient).toEqual({ level: null, notNeeded: true })
    expect(report.statuses.pest).toEqual({ level: null, notNeeded: true })
    expect(report.healthDelta).toBeGreaterThanOrEqual(0)
    expect(report.newBugs).toBe(0)
  })

  it('shade after sprout weakens plant', () => {
    const { state, report } = run(at('balsam', 'leafStem'), 3, 'shade')
    expect(state.lightExp).toBe(35)
    expect(report.statuses.light.level).toBeLessThanOrEqual(2)
    expect(report.statuses.light).toMatchObject({ dir: 'low' })
  })

  it('window for many days over light-limit', () => {
    const r = run(at('balsam', 'leafStem'), 5, 'window')
    expect(r.state.lightExp).toBe(90)
    // default band idealHi 85, hi 95 → 90 is level 3 (levelFor rule)
    expect(r.report.statuses.light).toEqual({ level: 3, dir: null })

    const bands = SPECIES.balsam.bands.grow
    const saved = bands.light
    try {
      bands.light = { lo: 45, idealLo: 60, idealHi: 70, hi: 80, span: 15 }
      const r2 = run(at('balsam', 'leafStem'), 5, 'window')
      expect(r2.report.statuses.light.level).toBeLessThanOrEqual(2)
      expect(r2.report.statuses.light).toMatchObject({ dir: 'high' })
    } finally {
      bands.light = saved
    }
  })

  it('water and nutrient clamp', () => {
    const s = at('balsam', 'leafStem')
    const { state } = endDay(s, { waterAdded: 1e9, pellets: 1e6, bugsRemoved: 0, place: 'desk' }, noBugs)
    expect(state.water).toBeLessThanOrEqual(150)
    expect(state.nutrient).toBeLessThanOrEqual(150)
    for (const v of Object.values(state)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('dead plant does not grow', () => {
    const s = at('balsam', 'leafStem', { health: 10, water: 0, nutrient: 150 })
    const { state, report } = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }, noBugs)
    expect(report.statuses.water.level).toBe(0)
    expect(report.statuses.nutrient.level).toBe(0)
    expect(state.dead).toBe(true)
    expect(report.died).toBe(true)
    expect(state.health).toBe(0)
    expect(state.stageIndex).toBe(s.stageIndex)
    expect(state.growth).toBe(s.growth)
    expect(report.grew).toBe(false)
    expect(state.deathCause).toBe('물이 부족해서 말라 버렸어요.')
  })

  it('records the last 3 days of statuses for the death cause', () => {
    let s = at('balsam', 'leafStem', { nutrient: 150 })
    for (let i = 0; i < 4; i++) s = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }, noBugs).state
    expect(s.history).toHaveLength(3)
    expect(s.history[2].nutrient).toMatchObject({ dir: 'high' })
  })

  it('unremoved bugs multiply and new ones are added', () => {
    const s = at('balsam', 'leafStem', { bugs: 3, water: 62.5, nutrient: 50 })
    const { state, report } = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 1, place: 'desk' }, () => 0)
    expect(report.statuses.pest).toEqual({ level: 2, dir: 'high' })
    expect(report.newBugs).toBe(1)
    expect(state.bugs).toBe(2 * 2 + 1)
  })

  it('evaporates water and uses nutrient in grow phase', () => {
    const s = at('balsam', 'leafStem', { water: 62.5, nutrient: 50 })
    const { state } = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'window' }, noBugs)
    expect(state.water).toBe(62.5 - PLACE_ENV.window.evap)
    expect(state.nutrient).toBe(45)
  })

  it('winter is colder and evaporates half', () => {
    const s = at('dandelion', 'winter', { water: 30, nutrient: 10 })
    const { state } = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }, noBugs)
    expect(state.water).toBe(30 - PLACE_ENV.desk.evap * 0.5)
    expect(state.nutrient).toBe(0) // winter uses 10 per day
    expect(currentStatuses(s).temp).toEqual({ level: 4, dir: null }) // desk 22 − 15 = 7, winter band 0..10
  })

  it('winter prefers little water', () => {
    for (const id of PERENNIALS) {
      const winter = currentStatuses(at(id, 'winter', { water: 70 })).water
      expect(winter).toMatchObject({ dir: 'high' })
      expect(winter.level).toBeLessThanOrEqual(2)
      // the same water is fine while growing
      expect(currentStatuses(at(id, 'leafStem', { water: 70 })).water.level).toBeGreaterThanOrEqual(3)
    }
    expect(currentStatuses(at('apple', 'winter', { water: 30 })).water).toEqual({ level: 4, dir: null })
  })

  it.each(PERENNIALS)('entering winter never hurts %s whose board was fine on the last fruit day', (id) => {
    for (const nutrient of [75, 85]) {
      const place = carePlace(id)
      // last fruit day, fully grown: board all 적정 or better, nutrient high in the summer band
      const s = at(id, 'fruit', { growth: 3.9, water: 62.5, nutrient, lightExp: PLACE_ENV[place].light, place })
      const last = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place }, noBugs)
      expect(last.report.healthDelta).toBeGreaterThanOrEqual(0)
      expect(stageOf(last.state)).toBe('winter')
      // the first winter day: the student follows the board (it shows nothing to fix), so no damage
      const first = endDay(last.state, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place }, noBugs)
      expect(first.report.healthDelta, `${id} nutrient ${nutrient}`).toBeGreaterThanOrEqual(0)
      expect(first.state.health).toBe(100)
      for (const st of Object.values(currentStatuses(last.state))) if (st.level !== null) expect(st.level).toBeGreaterThanOrEqual(3)
      const wb = SPECIES[id].bands.winter
      expect(last.state.nutrient).toBeLessThanOrEqual(wb.nutrient.hi)
      expect(last.state.water).toBeLessThanOrEqual(wb.water.hi)
    }
  })

  it('seed phase uses no nutrient', () => {
    const s = at('balsam', 'seed', { nutrient: 40 })
    const { state } = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }, noBugs)
    expect(state.nutrient).toBe(40)
  })

  it('bugs never exceed 12', () => {
    let s = at('balsam', 'leafStem', { bugs: 12, health: 100 })
    for (let i = 0; i < 6 && !s.dead; i++) {
      s = endDay(s, { ...idealCare(s), bugsRemoved: 0 }, () => 0).state
      expect(s.bugs).toBeLessThanOrEqual(12)
    }
    const one = endDay(at('balsam', 'leafStem', { bugs: 7 }), { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }, () => 0)
    expect(one.state.bugs).toBe(12)
  })

  it('non-finite action numbers count as 0', () => {
    const s = at('balsam', 'leafStem', { bugs: 2, water: 60, nutrient: 50 })
    const zero = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }, noBugs).state
    const bad = { waterAdded: NaN, pellets: undefined as unknown as number, bugsRemoved: Infinity, place: 'desk' as const }
    const { state } = endDay(s, bad, noBugs)
    expect(Number.isFinite(state.water)).toBe(true)
    expect(Number.isFinite(state.nutrient)).toBe(true)
    expect(Number.isFinite(state.bugs)).toBe(true)
    expect(state).toEqual(zero)
  })

  it('height and leaves grow with growth after the seed stage and never shrink', () => {
    let s = newPlant('balsam')
    let prevH = s.heightCm
    let prevL = s.leaves
    for (let i = 0; i < 10; i++) {
      const wasSeed = stageOf(s) === 'seed'
      const r = endDay(s, idealCare(s), noBugs)
      s = r.state
      if (!wasSeed) {
        expect(r.report.heightDelta).toBeGreaterThan(0)
        expect(s.heightCm).toBeGreaterThan(prevH)
      }
      expect(s.leaves).toBeGreaterThanOrEqual(prevL)
      prevH = s.heightCm
      prevL = s.leaves
    }
    expect(s.leaves).toBeGreaterThan(0)
  })

  it.each([...ANNUALS, ...PERENNIALS])('a seed of %s does not grow taller or get leaves while it is still a seed', (id) => {
    let s = newPlant(id)
    while (stageOf(s) === 'seed') {
      const r = endDay(s, idealCare(s), noBugs)
      // the day the seed sprouts, only the growth earned past the seed stage counts
      const expected = r.report.stageChanged ? Math.round(r.state.growth * 1.5 * 10) / 10 : 0
      expect(r.report.heightDelta).toBe(expected)
      if (!r.report.stageChanged) {
        expect(r.state.heightCm).toBe(0)
        expect(r.state.leaves).toBe(0)
      }
      s = r.state
    }
    expect(stageOf(s)).toBe('sprout')
    expect(s.heightCm).toBe(Math.round(s.growth * 1.5 * 10) / 10)
    expect(s.leaves).toBe(Math.floor(s.growth / 2))
  })

  it('day 1 of a new plant under ideal care stays 0 cm with 0 leaves', () => {
    const { state, report } = endDay(newPlant('bean'), idealCare(newPlant('bean')), noBugs)
    expect(stageOf(state)).toBe('seed')
    expect(report.heightDelta).toBe(0)
    expect(state.heightCm).toBe(0)
    expect(state.leaves).toBe(0)
  })
})

describe('newPlant', () => {
  it('starting values', () => {
    expect(newPlant('bean')).toMatchObject({
      speciesId: 'bean', stageIndex: 0, growth: 0, health: 100, water: 55, nutrient: 40,
      place: 'desk', lightExp: 65, bugs: 0, day: 1, dead: false, history: [],
    })
  })
})

describe('rng', () => {
  it('mulberry32 is deterministic in [0,1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('seedFor depends on day and species', () => {
    expect(seedFor(3, 'balsam')).toBe(seedFor(3, 'balsam'))
    expect(seedFor(3, 'balsam')).not.toBe(seedFor(4, 'balsam'))
    expect(seedFor(3, 'balsam')).not.toBe(seedFor(3, 'bean'))
  })
})
