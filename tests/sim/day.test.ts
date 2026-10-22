import { describe, expect, it } from 'vitest'
import { careTasks, isOutdoor } from '../../src/sim/care'
import { currentStatuses, endDay, newPlant, PLACE_ENV } from '../../src/sim/day'
import { mulberry32, seedFor } from '../../src/sim/rng'
import { phaseOf, SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { Band, DayActions, DayReport, Place, PlantState, WeatherId } from '../../src/sim/types'
import { weatherEvents, weatherOn } from '../../src/sim/weather'

const noBugs = () => 0.99
const mid = (b: Band) => (b.idealLo + b.idealHi) / 2
const stageOf = (s: PlantState): StageId => SPECIES[s.speciesId].stages[s.stageIndex]

/** Weather off: the scenarios below test the v1 rules on their own. */
const calm = (p: PlantState): PlantState => ({ ...p, weatherFrom: 999 })
const plant = (id: SpeciesId) => calm(newPlant(id))

function at(id: SpeciesId, stage: StageId, over: Partial<PlantState> = {}): PlantState {
  return { ...plant(id), stageIndex: SPECIES[id].stages.indexOf(stage), ...over }
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

/** The student does all of the current stage's care tasks (the oracle for "care done on time"). */
const doCare = (s: PlantState): PlantState => ({ ...s, careDone: careTasks(s.speciesId, stageOf(s)).length })

function run(s: PlantState, days: number, place?: Place) {
  let state = s
  let report!: DayReport
  for (let i = 0; i < days; i++) {
    state = doCare(state)
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
    const nine = run(plant('balsam'), 9).state
    expect(stageOf(nine)).toBe('fruit')
    const { state } = run(plant('balsam'), 10)
    expect(stageOf(state)).toBe('seedDone')
    expect(state.dead).toBe(false)
    expect(state.day).toBe(11)
  })

  it.each(ANNUALS)('ideal care finishes annual %s in exactly 10 days', (id) => {
    expect(stageOf(run(plant(id), 9).state)).toBe('fruit')
    const { state } = run(plant(id), 10)
    expect(stageOf(state)).toBe('seedDone')
    expect(state.dead).toBe(false)
  })

  it.each(PERENNIALS)('ideal care finishes perennial %s within 15 days', (id) => {
    const { state } = run(plant(id), 15)
    expect(stageOf(state)).toBe('newShoot')
    expect(state.dead).toBe(false)
  })

  it('stops advancing at the final stage', () => {
    const { state, report } = run(plant('balsam'), 13)
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
    // on the desk (the shade is too cold for a seed, see below)
    const s = at('balsam', 'seed', { nutrient: 0, lightExp: 30 })
    const { report } = endDay(s, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }, noBugs)
    expect(report.statuses.light).toEqual({ level: null, notNeeded: true })
    expect(report.statuses.nutrient).toEqual({ level: null, notNeeded: true })
    expect(report.statuses.pest).toEqual({ level: null, notNeeded: true })
    expect(report.healthDelta).toBeGreaterThanOrEqual(0)
    expect(report.newBugs).toBe(0)
  })

  it('the shade is cool: a seed or plant left there shows 온도 주의 (추워요)', () => {
    expect(PLACE_ENV.shade.temp).toBe(13)
    expect(PLACE_ENV.yardShade.temp).toBe(18)
    for (const id of [...ANNUALS, ...PERENNIALS]) {
      const seed = currentStatuses(at(id, 'seed', { place: 'shade' })).temp
      expect(seed, id).toMatchObject({ dir: 'low' })
      expect(seed.level, id).toBeLessThanOrEqual(2)
      const grown = currentStatuses(at(id, 'leafStem', { place: 'shade' })).temp
      expect(grown, id).toMatchObject({ dir: 'low' })
      expect(grown.level, id).toBeLessThanOrEqual(2)
      // the desk and the window stay warm enough
      expect(currentStatuses(at(id, 'seed', { place: 'desk' })).temp.level, id).toBeGreaterThanOrEqual(3)
    }
    // a seed sown in the shade struggles there
    const { report } = endDay(at('bean', 'seed', { place: 'shade' }), { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'shade' }, noBugs)
    expect(report.statuses.temp.level).toBeLessThanOrEqual(2)
    expect(report.healthDelta).toBeLessThan(0)
  })

  it.each(PERENNIALS)('%s gets no new leaves during the winter phase', (id) => {
    const place = carePlace(id)
    let s = at(id, 'fruit', { growth: 3.9, water: 62.5, nutrient: 50, lightExp: PLACE_ENV[place].light, place, leaves: 7, careDone: 1 })
    s = endDay(s, idealCare(s), noBugs).state
    expect(stageOf(s)).toBe('winter')
    expect(s.leaves).toBe(7)
    while (stageOf(s) === 'winter') {
      s = doCare(s)
      const r = endDay(s, idealCare(s), noBugs)
      if (stageOf(r.state) === 'winter') expect(r.state.leaves, `${id} day ${s.day}`).toBe(7)
      s = r.state
    }
    expect(stageOf(s)).toBe('newShoot')
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
      const s = at(id, 'fruit', { growth: 3.9, water: 62.5, nutrient, lightExp: PLACE_ENV[place].light, place, careDone: 1 })
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
    let s = plant('balsam')
    let prevH = s.heightCm
    let prevL = s.leaves
    for (let i = 0; i < 10; i++) {
      const wasSeed = stageOf(s) === 'seed'
      s = doCare(s)
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
    let s = plant(id)
    while (stageOf(s) === 'seed') {
      s = doCare(s)
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

  it('growth stops at the stage threshold while the stage care is not done', () => {
    let s: PlantState = { ...plant('bean'), stageIndex: 3, growth: 3.5, careDone: 0 } // flower, pollinate pending
    const r = endDay(s, idealCare(s), mulberry32(1))
    expect(r.state.stageIndex).toBe(3)
    expect(r.state.growth).toBe(4)
    expect(r.report.waiting).toBe(true)
    expect(r.report.stageChanged).toBe(false)
    expect(r.state.day).toBe(s.day + 1) // the days still pass
    // another day of waiting keeps it at the threshold, and nothing more is grown
    const again = endDay(r.state, idealCare(r.state), mulberry32(3))
    expect(again.state.stageIndex).toBe(3)
    expect(again.state.growth).toBe(4)
    expect(again.report.waiting).toBe(true)
    expect(again.report.grew).toBe(false)
    s = { ...r.state, careDone: 1 }
    const r2 = endDay(s, idealCare(s), mulberry32(2))
    expect(r2.state.stageIndex).toBe(4)
    expect(r2.state.careDone).toBe(0)
    expect(r2.report.stageChanged).toBe(true)
    expect(r2.report.waiting).toBeFalsy()
  })

  it('a plant below the threshold is not waiting, and care done early keeps the stage on time', () => {
    const s: PlantState = { ...plant('bean'), stageIndex: 3, growth: 1, careDone: 0 }
    const r = endDay(s, idealCare(s), noBugs)
    expect(r.report.waiting).toBeFalsy()
    expect(r.state.growth).toBe(3)
    const done = endDay({ ...s, growth: 3, careDone: 1 }, idealCare(s), noBugs)
    expect(done.state.stageIndex).toBe(4)
    expect(done.state.growth).toBe(1)
    expect(done.state.careDone).toBe(0)
  })

  it('a waiting plant still takes damage from bad care as usual', () => {
    const bad: DayActions = { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' }
    const base = at('balsam', 'flower', { growth: 4, water: 0, nutrient: 50, health: 80 })
    const waiting = endDay({ ...base, careDone: 0 }, bad, noBugs)
    const ready = endDay({ ...base, growth: 0, careDone: 1 }, bad, noBugs)
    expect(waiting.report.waiting).toBe(true)
    expect(waiting.report.statuses.water.level).toBe(0)
    expect(waiting.report.healthDelta).toBeLessThan(0)
    // no extra penalty for the pending care itself
    expect(waiting.report.healthDelta).toBe(ready.report.healthDelta)
    expect(waiting.state.health).toBe(ready.state.health)
    // and good care while waiting heals as usual
    const good = at('balsam', 'flower', { growth: 4, water: 62.5, nutrient: 50, health: 80, careDone: 0 })
    const healed = endDay(good, idealCare(good), noBugs)
    expect(healed.report.waiting).toBe(true)
    expect(healed.report.healthDelta).toBe(10)
  })

  it('a waiting plant does not get taller than its kept growth', () => {
    // a seed waiting on sow: no height and no leaves, however many days pass
    let s = plant('bean')
    for (let i = 0; i < 4; i++) {
      const r = endDay(s, idealCare(s), noBugs)
      expect(stageOf(r.state)).toBe('seed')
      expect(r.state.heightCm).toBe(0)
      expect(r.state.leaves).toBe(0)
      expect(r.report.heightDelta).toBe(0)
      s = r.state
    }
    expect(s.growth).toBe(4)
    // a grown plant reaching the threshold only grows by the part it kept
    const grown = at('bean', 'flower', { growth: 3.5, water: 62.5, nutrient: 40, heightCm: 10, leaves: 5, careDone: 0 })
    const r = endDay(grown, idealCare(grown), noBugs)
    expect(r.state.growth).toBe(4)
    expect(r.report.heightDelta).toBe(0.8) // 0.5 points kept × 1.5 cm, rounded to 0.1
    expect(r.state.heightCm).toBe(10.8)
    const r2 = endDay(r.state, idealCare(r.state), noBugs)
    expect(r2.report.heightDelta).toBe(0)
    expect(r2.state.heightCm).toBe(10.8)
    expect(r2.state.leaves).toBe(r.state.leaves)
  })

  it('day 1 of a new plant under ideal care stays 0 cm with 0 leaves', () => {
    const { state, report } = endDay(plant('bean'), idealCare(plant('bean')), noBugs)
    expect(stageOf(state)).toBe('seed')
    expect(report.heightDelta).toBe(0)
    expect(state.heightCm).toBe(0)
    expect(state.leaves).toBe(0)
  })
})

/** A tree in the yard: light-loving species in the sun, others in partial shade (both in their light band). */
const yardPlace = (id: SpeciesId): Place => (carePlace(id) === 'window' ? 'yardSunny' : 'yardPartial')

/** The oracle also prepares for today's weather, as the forecast told it to. */
function prepared(s: PlantState, a: DayActions): DayActions {
  const w = weatherOn(s, s.day)
  const out = { ...a, bugsRemoved: s.bugs }
  if ((w === 'heat' || w === 'cold') && out.place === 'window') out.place = 'desk'
  if (w === 'rain' || w === 'monsoon') out.waterAdded = 0
  if (w === 'typhoon') out.tied = true
  return out
}

/** Ideal care that moves a transplanted tree to the yard and prepares for every forecast. */
function runWeather(s: PlantState, days: number) {
  let state = s
  let weatherDays = 0
  for (let i = 0; i < days && !state.dead; i++) {
    state = doCare(state)
    const place = isOutdoor(state) ? yardPlace(state.speciesId) : carePlace(state.speciesId)
    const r = endDay(state, prepared(state, idealCare(state, place)), noBugs)
    if (r.report.weather) {
      weatherDays++
      expect(r.report.weather.prepared, `${s.speciesId} seed ${s.weatherSeed} day ${state.day}`).toBe(true)
    }
    expect(r.report.healthDelta, `${s.speciesId} seed ${s.weatherSeed} day ${state.day}`).toBeGreaterThanOrEqual(0)
    state = r.state
  }
  return { state, weatherDays }
}

const SEEDS = Array.from({ length: 256 }, (_, i) => i)

/** A plant at `stage` on a day the given weather comes (single-day events unless it is a monsoon). */
function weatherDay(id: SpeciesId, stage: StageId, kind: WeatherId, over: Partial<PlantState> = {}): PlantState {
  for (const weatherSeed of SEEDS) {
    for (const e of weatherEvents(weatherSeed)) {
      const s = at(id, stage, { ...over, weatherSeed, weatherFrom: 2, day: e.start })
      if ((kind === 'monsoon' || e.len === 1) && weatherOn(s, e.start) === kind) return s
    }
  }
  throw new Error(`no ${kind} day for ${id} ${stage}`)
}

/** The same day with the weather turned off; reports compare without the weather line. */
function compareCalm(s: PlantState, a: DayActions, rng: () => () => number = () => noBugs) {
  const r = endDay(s, a, rng())
  const c = endDay(calm(s), a, rng())
  const { weather, ...report } = r.report
  return { r, c, weather, report, state: { ...r.state, weatherFrom: 0 }, calmState: { ...c.state, weatherFrom: 0 } }
}

const none = (place: Place, over: Partial<DayActions> = {}): DayActions => ({
  waterAdded: 0, pellets: 0, bugsRemoved: 0, place, ...over,
})

describe('endDay with weather', () => {
  it.each(ANNUALS)('ideal care that prepares for the weather still finishes annual %s in exactly 10 days', (id) => {
    let total = 0
    for (const weatherSeed of SEEDS) {
      const s = { ...newPlant(id), weatherSeed }
      expect(stageOf(runWeather(s, 9).state), `seed ${weatherSeed}`).toBe('fruit')
      const { state, weatherDays } = runWeather(s, 10)
      expect(stageOf(state), `seed ${weatherSeed}`).toBe('seedDone')
      expect(state.health).toBe(100)
      total += weatherDays
    }
    expect(total).toBeGreaterThan(256) // weather really came, about every 2~3 days
  })

  it.each(PERENNIALS)('ideal care that prepares for the weather still finishes perennial %s within 15 days', (id) => {
    for (const weatherSeed of SEEDS) {
      const { state } = runWeather({ ...newPlant(id), weatherSeed }, 15)
      expect(stageOf(state), `seed ${weatherSeed}`).toBe('newShoot')
      expect(state.health).toBe(100)
    }
  })

  it('every kind of weather comes to some plant', () => {
    const kinds = new Set<WeatherId>()
    for (const weatherSeed of SEEDS.slice(0, 64)) {
      for (const id of ['bean', 'apple', 'dandelion'] as SpeciesId[]) {
        let s: PlantState = { ...newPlant(id), weatherSeed }
        for (let i = 0; i < 15 && !s.dead; i++) {
          s = doCare(s)
          const place = isOutdoor(s) ? yardPlace(id) : carePlace(id)
          const r = endDay(s, prepared(s, idealCare(s, place)), noBugs)
          if (r.report.weather) kinds.add(r.report.weather.kind)
          s = r.state
        }
      }
    }
    expect([...kinds].sort()).toEqual(['cold', 'frost', 'heat', 'monsoon', 'rain', 'typhoon'])
  })

  it('unprepared heat at the window shows 온도 위험 and doubles evaporation', () => {
    const s = weatherDay('balsam', 'leafStem', 'heat', { water: 62.5, nutrient: 50, lightExp: 90, place: 'window' })
    const { r, c, weather } = compareCalm(s, none('window'))
    expect(weather).toEqual({ kind: 'heat', prepared: false })
    expect(r.report.statuses.temp).toEqual({ level: 1, dir: 'high' })
    expect(c.report.statuses.temp.level).toBeGreaterThanOrEqual(3)
    expect(r.state.water).toBe(62.5 - 2 * PLACE_ENV.window.evap)
    expect(c.state.water).toBe(62.5 - PLACE_ENV.window.evap)
    expect(r.report.healthDelta).toBeLessThan(0)
    // the board shows it during the day too
    expect(currentStatuses(s, { tempAt: 36 }).temp).toEqual({ level: 1, dir: 'high' })
  })

  it('prepared heat, cold, typhoon and frost change nothing; prepared rain only waters to the ideal', () => {
    const cases: [PlantState, DayActions][] = [
      [weatherDay('balsam', 'leafStem', 'heat', { water: 62.5, nutrient: 50, place: 'desk' }), none('desk')],
      [weatherDay('apple', 'grownTree', 'heat', { water: 62.5, nutrient: 50, place: 'yardSunny', lightExp: 90 }), none('yardSunny')],
      [weatherDay('bean', 'sprout', 'cold', { water: 62.5, nutrient: 50, place: 'window' }), none('desk')],
      [weatherDay('apple', 'flower', 'typhoon', { water: 62.5, nutrient: 50, place: 'yardSunny', lightExp: 90 }), none('yardSunny', { tied: true })],
      [weatherDay('apple', 'winter', 'frost', { water: 30, nutrient: 10, place: 'yardSunny', lightExp: 90, careDone: 1 }), none('yardSunny')],
    ]
    for (const [s, a] of cases) {
      const { weather, report, c, state, calmState } = compareCalm(s, a)
      expect(weather, stageOf(s)).toMatchObject({ prepared: true })
      expect(report).toEqual(c.report)
      expect(state).toEqual(calmState)
    }
    // rain: not watering is prepared; dry soil gets watered up to the ideal, moist soil is left as it is
    const dry = weatherDay('apple', 'grownTree', 'rain', { water: 40, nutrient: 50, place: 'yardSunny', lightExp: 90 })
    const wet = compareCalm(dry, none('yardSunny'))
    expect(wet.weather).toEqual({ kind: 'rain', prepared: true })
    expect(wet.c.report.statuses.water.level).toBe(3)
    expect(wet.report.statuses.water).toEqual({ level: 4, dir: null })
    const ideal = SPECIES.apple.bands.grow.water.idealLo + 5
    expect(wet.r.state.water).toBe(ideal - PLACE_ENV.yardSunny.evap)
    const moist = compareCalm({ ...dry, water: 70 }, none('yardSunny'))
    expect(moist.report).toEqual(moist.c.report)
    expect(moist.state).toEqual(moist.calmState)
  })

  it('watering on a rainy day overwaters', () => {
    const s = weatherDay('apple', 'grownTree', 'rain', { water: 40, nutrient: 50, place: 'yardSunny', lightExp: 90 })
    const { r, weather } = compareCalm(s, none('yardSunny', { waterAdded: 20 }))
    expect(weather).toEqual({ kind: 'rain', prepared: false })
    expect(r.report.statuses.water).toMatchObject({ dir: 'high' })
    expect(r.report.statuses.water.level).toBeLessThanOrEqual(2)
  })

  it('a monsoon with bugs left raises the chance of new bugs', () => {
    const s = weatherDay('bean', 'flower', 'monsoon', { water: 62.5, nutrient: 50, bugs: 2 })
    const rng = () => () => 0.2 // over the usual 0.03, under 0.03 + 0.3
    const { r, c, weather } = compareCalm(s, none('desk'), rng)
    expect(weather).toEqual({ kind: 'monsoon', prepared: false })
    expect(c.report.newBugs).toBe(0)
    expect(r.report.newBugs).toBeGreaterThan(0)
    // removing the bugs and not watering is prepared
    const ok = compareCalm(s, none('desk', { bugsRemoved: 2 }), rng)
    expect(ok.weather).toEqual({ kind: 'monsoon', prepared: true })
    expect(ok.r.report.newBugs).toBe(0)
  })

  it('a typhoon alone never kills', () => {
    const s = weatherDay('apple', 'flower', 'typhoon', { water: 62.5, nutrient: 50, place: 'yardSunny', lightExp: 90 })
    for (const health of [1, 5, 10, 15, 16, 50, 100]) {
      const { r, weather } = compareCalm({ ...s, health }, none('yardSunny'))
      expect(weather).toEqual({ kind: 'typhoon', prepared: false })
      expect(r.state.dead).toBe(false)
      expect(r.state.health, String(health)).toBeGreaterThanOrEqual(1)
      expect(r.state.health).toBe(Math.max(1, Math.min(100, health + 10) - 15))
      expect(r.report.healthDelta).toBe(r.state.health - health)
    }
    // with a slightly bad board on top, it still stops at 1
    const { r } = compareCalm({ ...s, health: 5, water: 30 }, none('yardSunny'))
    expect(r.report.statuses.water.level).toBe(2)
    expect(r.state.health).toBe(1)
    expect(r.state.dead).toBe(false)
  })

  it('a day without weather is the same as the v1 rules, rng order included', () => {
    const s = at('bean', 'flower', { weatherSeed: 5, weatherFrom: 2, water: 62.5, nutrient: 50, bugs: 1 })
    const first = weatherEvents(5)[0]
    const day = first.start + first.len // events are at least one calm day apart
    expect(weatherOn({ ...s, day }, day)).toBeNull()
    for (const k of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { report, c, state, calmState, weather } = compareCalm({ ...s, day }, none('desk'), () => mulberry32(k))
      expect(weather).toBeUndefined()
      expect(report).toEqual(c.report)
      expect(state).toEqual(calmState)
    }
  })

  it('a dead plant gets no weather', () => {
    const s = weatherDay('apple', 'flower', 'typhoon', { place: 'yardSunny' })
    const { report } = endDay({ ...s, dead: true }, none('yardSunny'), noBugs)
    expect(report.weather).toBeUndefined()
  })
})

describe('newPlant', () => {
  it('starting values', () => {
    expect(newPlant('bean')).toMatchObject({
      speciesId: 'bean', stageIndex: 0, growth: 0, health: 100, water: 55, nutrient: 40,
      place: 'desk', lightExp: 65, bugs: 0, day: 1, dead: false, history: [],
      mode: 'daily', careDone: 0, weatherSeed: 0, weatherFrom: 2,
    })
  })

  it('takes the mode and the weather seed', () => {
    expect(newPlant('corn', { mode: 'quick', weatherSeed: 201 })).toMatchObject({
      speciesId: 'corn', mode: 'quick', weatherSeed: 201, careDone: 0, weatherFrom: 2,
    })
    expect(newPlant('corn', { mode: 'quick' })).toMatchObject({ mode: 'quick', weatherSeed: 0 })
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
