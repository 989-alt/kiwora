import { careReady } from './care'
import { deathCause } from './death'
import { levelFor } from './levels'
import { rollPests } from './pests'
import { phaseOf, SPECIES, STAGE_POINTS, type Phase, type SpeciesId } from './species'
import type { ConditionKey, DayActions, DayReport, Level, Mode, Place, PlantState, Status, WeatherHit } from './types'
import { todayWeather } from './weather'

export const PLACE_ENV: Record<Place, { light: number; temp: number; evap: number }> = {
  window: { light: 90, temp: 27, evap: 25 },
  desk: { light: 65, temp: 22, evap: 18 },
  // The shade is cool (textbook: 싹 틀 때 알맞은 온도): a seed or plant left there shows 온도 주의.
  shade: { light: 30, temp: 13, evap: 12 },
  yardSunny: { light: 90, temp: 24, evap: 22 },
  yardPartial: { light: 65, temp: 21, evap: 16 },
  // Mild: a transplanted plant can never leave its yard spot, so cold plus dim must not double up.
  yardShade: { light: 35, temp: 18, evap: 12 },
}

const WINTER_TEMP_DROP = 15
const WINTER_EVAP_SCALE = 0.5
const MAX_STORE = 150
const PELLET_NUTRIENT = 15
const GROW_NUTRIENT_USE = 5
const WINTER_NUTRIENT_USE = 10
const MAX_BUGS = 12
const HISTORY_DAYS = 3

const PENALTY: Record<Level, number> = { 0: -25, 1: -12, 2: -4, 3: 0, 4: 0 }
const RECOVER = 10
const GROWTH_FOR: Record<Level, number> = { 0: 0, 1: 0, 2: 0.5, 3: 1.5, 4: 2 }

/** cm per growth point and growth points per leaf (heightCm/leaves are display values, never shrink). */
const CM_PER_POINT = 1.5
const POINTS_PER_LEAF = 2

const NOT_NEEDED: Status = { level: null, notNeeded: true }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10
/** Non-finite action numbers (NaN, undefined, Infinity) count as 0. */
const num = (v: number) => (Number.isFinite(v) ? v : 0)

function phaseOfState(s: PlantState): Phase {
  return phaseOf(SPECIES[s.speciesId].stages[s.stageIndex])
}

function placeEnv(place: Place, phase: Phase) {
  const env = PLACE_ENV[place]
  if (phase !== 'winter') return env
  return { ...env, temp: env.temp - WINTER_TEMP_DROP, evap: env.evap * WINTER_EVAP_SCALE }
}

function pestStatus(bugs: number): Status {
  if (bugs <= 0) return { level: 4, dir: null }
  if (bugs <= 2) return { level: 2, dir: 'high' }
  if (bugs <= 4) return { level: 1, dir: 'high' }
  return { level: 0, dir: 'high' }
}

/**
 * Status board for the state as it is now (also used by the screen). `hit` is today's weather: its
 * `tempAt` is the temperature at the plant's spot (unprepared heat or cold shows on the board at once).
 */
export function currentStatuses(s: PlantState, hit: WeatherHit = {}): Record<ConditionKey, Status> {
  const phase = phaseOfState(s)
  const b = SPECIES[s.speciesId].bands[phase]
  const seed = phase === 'seed'
  return {
    water: levelFor(s.water, b.water),
    light: seed ? NOT_NEEDED : levelFor(s.lightExp, b.light),
    temp: levelFor(hit.tempAt ?? placeEnv(s.place, phase).temp, b.temp),
    nutrient: seed ? NOT_NEEDED : levelFor(s.nutrient, b.nutrient),
    pest: seed ? NOT_NEEDED : pestStatus(s.bugs),
  }
}

export function newPlant(id: SpeciesId, opts: { mode?: Mode; weatherSeed?: number } = {}): PlantState {
  return {
    speciesId: id,
    stageIndex: 0,
    growth: 0,
    health: 100,
    water: 55,
    nutrient: 40,
    lightExp: 65,
    place: 'desk',
    bugs: 0,
    day: 1,
    heightCm: 0,
    leaves: 0,
    dead: false,
    history: [],
    mode: opts.mode ?? 'daily',
    careDone: 0,
    weatherSeed: opts.weatherSeed ?? 0,
    weatherFrom: 2,
  }
}

/** Linear interpolation of GROWTH_FOR at a (possibly fractional) average level. */
function growthAt(avg: number): number {
  const lo = Math.floor(avg) as Level
  if (lo >= 4) return GROWTH_FOR[4]
  const hi = (lo + 1) as Level
  return GROWTH_FOR[lo] + (GROWTH_FOR[hi] - GROWTH_FOR[lo]) * (avg - lo)
}

/**
 * Step 1 of endDay on its own: apply care actions to water/nutrient/bugs/place with the same
 * clamps (water/nutrient 0..150, bugs >= 0, non-finite numbers count as 0). The store uses it to
 * show actions on the status board immediately.
 */
export function applyActions(s: PlantState, a: DayActions): PlantState {
  return {
    ...s,
    water: clamp(s.water + num(a.waterAdded), 0, MAX_STORE),
    nutrient: clamp(s.nutrient + num(a.pellets) * PELLET_NUTRIENT, 0, MAX_STORE),
    bugs: Math.max(0, s.bugs - num(a.bugsRemoved)),
    place: a.place,
  }
}

/** Rain sets the soil water before the day is judged: 'over' = band hi + 15, 'ideal' = at least idealLo + 5. */
function rainedWater(s: PlantState, hit: WeatherHit): number {
  if (hit.water === undefined) return s.water
  const b = SPECIES[s.speciesId].bands[phaseOfState(s)].water
  const target = hit.water === 'over' ? b.hi + 15 : b.idealLo + 5
  return clamp(Math.max(s.water, target), 0, MAX_STORE)
}

/**
 * Ends the day. `opts.did` is what the student did that day, for the weather judgment (the store applies
 * actions as they happen and passes zero `a`); without it `a` is used.
 */
export function endDay(
  s: PlantState,
  a: DayActions,
  rng: () => number,
  opts: { did?: DayActions } = {},
): { state: PlantState; report: DayReport } {
  if (s.dead) {
    const report: DayReport = {
      statuses: currentStatuses(s), healthDelta: 0, grew: false, stageChanged: false,
      died: false, newBugs: 0, heightDelta: 0,
    }
    return { state: s, report }
  }
  const species = SPECIES[s.speciesId]
  const lastStage = species.stages.length - 1

  // 1. apply actions; today's weather is judged on the result (rain waters the soil before the statuses)
  const actioned = applyActions(s, a)
  const weather = todayWeather(actioned, opts.did ?? a)
  const hit: WeatherHit = weather?.hit ?? {}
  const applied = { ...actioned, water: rainedWater(actioned, hit) }
  let { water, nutrient } = applied
  const { bugs: bugsLeft, place } = applied

  // 2. light exposure moving average ("too long in the sun" accumulates here)
  const lightExp = Math.round(0.5 * s.lightExp + 0.5 * PLACE_ENV[place].light)

  let state: PlantState = { ...applied, lightExp }

  // 3. statuses
  const phase = phaseOfState(state)
  const statuses = currentStatuses(state, hit)
  const history = [...s.history, statuses].slice(-HISTORY_DAYS)
  const active = Object.values(statuses).flatMap((st) => (st.level === null ? [] : [st.level]))

  // 4. health
  const allOk = active.every((l) => l >= 3)
  const delta = allOk ? RECOVER : active.reduce<number>((sum, l) => sum + PENALTY[l], 0)
  const judged = clamp(s.health + delta, 0, 100)
  // The weather's own damage (typhoon) never takes a plant below 1: weather alone never kills.
  const health = hit.healthHit ? Math.max(Math.min(judged, 1), judged - hit.healthHit) : judged
  const healthDelta = health - s.health
  const weatherLine = weather ? { weather: { kind: weather.kind, prepared: weather.prepared } } : {}

  if (health === 0) {
    state = { ...state, health, history, dead: true, deathCause: deathCause(history) }
    const report: DayReport = {
      statuses, healthDelta, grew: false, stageChanged: false, died: true, newBugs: 0, heightDelta: 0, ...weatherLine,
    }
    return { state, report }
  }

  // 5. growth (capped at the final stage). The stage changes only once its care is done; until then
  // growth waits at the threshold and only the growth kept counts for height and leaves.
  let stageIndex = s.stageIndex
  let growth = s.growth
  let careDone = s.careDone
  let gained = 0
  let stageChanged = false
  let waiting = false
  if (stageIndex < lastStage) {
    const avg = active.reduce<number>((sum, l) => sum + l, 0) / active.length
    gained = growthAt(avg)
    growth += gained
    if (growth >= STAGE_POINTS && careReady(s)) {
      stageIndex += 1
      growth -= STAGE_POINTS
      careDone = 0
      stageChanged = true
      if (stageIndex === lastStage) growth = 0
    } else if (growth >= STAGE_POINTS) {
      gained = Math.max(0, gained - (growth - STAGE_POINTS))
      growth = STAGE_POINTS
      waiting = true
    }
  }
  // A seed under the soil has no stem or leaves yet: only growth earned past the seed stage shows.
  const seedPart = s.stageIndex === 0 ? Math.min(gained, STAGE_POINTS - s.growth) : 0
  const heightDelta = round1(Math.max(0, gained - seedPart) * CM_PER_POINT)
  const heightCm = round1(s.heightCm + heightDelta)
  const pastSeed = Math.max(0, (stageIndex - 1) * STAGE_POINTS + growth)
  // No leaves yet under the soil, and no new leaves while the plant winters.
  const noNewLeaves = stageIndex === 0 || phaseOf(species.stages[stageIndex]) === 'winter'
  const leaves = noNewLeaves ? s.leaves : Math.max(s.leaves, Math.floor(pastSeed / POINTS_PER_LEAF))

  // 6. prepare the next morning
  water = Math.max(0, water - placeEnv(place, phase).evap * (hit.evapScale ?? 1))
  const nutrientUse = phase === 'grow' ? GROW_NUTRIENT_USE : phase === 'winter' ? WINTER_NUTRIENT_USE : 0
  nutrient = Math.max(0, nutrient - nutrientUse)
  if (stageChanged && phaseOf(species.stages[stageIndex]) === 'winter') {
    // Entering winter overnight: the plant takes up less, so the board's fine summer amounts never
    // count against it on its first winter day (the student could not have prepared for the new band).
    const wb = species.bands.winter
    water = Math.min(water, wb.water.hi)
    nutrient = Math.min(nutrient, wb.nutrient.hi)
  }
  const newBugs = rollPests(statuses, rng, hit.pestBonus ?? 0)
  const bugs = Math.min(MAX_BUGS, bugsLeft + bugsLeft + newBugs) // unremoved bugs multiply overnight

  state = {
    ...state, water, nutrient, bugs, health, history, stageIndex, growth, careDone, heightCm, leaves, day: s.day + 1,
  }
  const report: DayReport = {
    statuses, healthDelta, grew: gained > 0, stageChanged, died: false, newBugs, heightDelta,
    ...(waiting ? { waiting } : {}),
    ...weatherLine,
  }
  return { state, report }
}
