import { deathCause } from './death'
import { levelFor } from './levels'
import { rollPests } from './pests'
import { phaseOf, SPECIES, STAGE_POINTS, type Phase, type SpeciesId } from './species'
import type { ConditionKey, DayActions, DayReport, Level, Place, PlantState, Status } from './types'

export const PLACE_ENV: Record<Place, { light: number; temp: number; evap: number }> = {
  window: { light: 90, temp: 27, evap: 25 },
  desk: { light: 65, temp: 22, evap: 18 },
  shade: { light: 30, temp: 18, evap: 12 },
  yardSunny: { light: 90, temp: 24, evap: 22 },
  yardPartial: { light: 65, temp: 21, evap: 16 },
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

/** Status board for the state as it is now (also used by the screen). */
export function currentStatuses(s: PlantState): Record<ConditionKey, Status> {
  const phase = phaseOfState(s)
  const b = SPECIES[s.speciesId].bands[phase]
  const seed = phase === 'seed'
  return {
    water: levelFor(s.water, b.water),
    light: seed ? NOT_NEEDED : levelFor(s.lightExp, b.light),
    temp: levelFor(placeEnv(s.place, phase).temp, b.temp),
    nutrient: seed ? NOT_NEEDED : levelFor(s.nutrient, b.nutrient),
    pest: seed ? NOT_NEEDED : pestStatus(s.bugs),
  }
}

export function newPlant(id: SpeciesId): PlantState {
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

export function endDay(
  s: PlantState,
  a: DayActions,
  rng: () => number,
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

  // 1. apply actions
  const applied = applyActions(s, a)
  let { water, nutrient } = applied
  const { bugs: bugsLeft, place } = applied

  // 2. light exposure moving average ("too long in the sun" accumulates here)
  const lightExp = Math.round(0.5 * s.lightExp + 0.5 * PLACE_ENV[place].light)

  let state: PlantState = { ...applied, lightExp }

  // 3. statuses
  const phase = phaseOfState(state)
  const statuses = currentStatuses(state)
  const history = [...s.history, statuses].slice(-HISTORY_DAYS)
  const active = Object.values(statuses).flatMap((st) => (st.level === null ? [] : [st.level]))

  // 4. health
  const allOk = active.every((l) => l >= 3)
  const delta = allOk ? RECOVER : active.reduce<number>((sum, l) => sum + PENALTY[l], 0)
  const health = clamp(s.health + delta, 0, 100)
  const healthDelta = health - s.health

  if (health === 0) {
    state = { ...state, health, history, dead: true, deathCause: deathCause(history) }
    const report: DayReport = {
      statuses, healthDelta, grew: false, stageChanged: false, died: true, newBugs: 0, heightDelta: 0,
    }
    return { state, report }
  }

  // 5. growth (capped at the final stage)
  let stageIndex = s.stageIndex
  let growth = s.growth
  let gained = 0
  let stageChanged = false
  if (stageIndex < lastStage) {
    const avg = active.reduce<number>((sum, l) => sum + l, 0) / active.length
    gained = growthAt(avg)
    growth += gained
    if (growth >= STAGE_POINTS) {
      stageIndex += 1
      growth -= STAGE_POINTS
      stageChanged = true
      if (stageIndex === lastStage) growth = 0
    }
  }
  const heightDelta = round1(gained * CM_PER_POINT)
  const heightCm = round1(s.heightCm + heightDelta)
  const totalPoints = stageIndex * STAGE_POINTS + growth
  const leaves = Math.max(s.leaves, Math.floor(totalPoints / POINTS_PER_LEAF))

  // 6. prepare the next morning
  water = Math.max(0, water - placeEnv(place, phase).evap)
  const nutrientUse = phase === 'grow' ? GROW_NUTRIENT_USE : phase === 'winter' ? WINTER_NUTRIENT_USE : 0
  nutrient = Math.max(0, nutrient - nutrientUse)
  const newBugs = rollPests(statuses, rng)
  const bugs = Math.min(MAX_BUGS, bugsLeft + bugsLeft + newBugs) // unremoved bugs multiply overnight

  state = {
    ...state, water, nutrient, bugs, health, history, stageIndex, growth, heightCm, leaves, day: s.day + 1,
  }
  const report: DayReport = {
    statuses, healthDelta, grew: gained > 0, stageChanged, died: false, newBugs, heightDelta,
  }
  return { state, report }
}
