import { careReady, isOutdoor } from './care'
import { mulberry32 } from './rng'
import { phaseOf, SPECIES } from './species'
import type { DayActions, PlantState, WeatherHit, WeatherId } from './types'

/** A weather event: `len` days from day `start`; `roll` picks the kind of a one-day event. */
export type WeatherEvent = { start: number; len: number; roll: number }

const LAST_START = 255
const HEAT_TEMP = 36
const COLD_TEMP = 8
const COLD_WINTER_TEMP = -12
const FROST_TEMP = -15
const MONSOON_PEST_BONUS = 0.3
const TYPHOON_HEALTH = 15

/**
 * The weather schedule of a seed (0..255). It depends on the seed only, so a plant gets the same weather
 * after a restore, and the days stay put whatever stage the plant is in. The first event is on day 2 or 3;
 * events come every 2~3 days with one or two calm days between; 3 in 10 last 2~3 days.
 */
export function weatherEvents(seed: number): WeatherEvent[] {
  const rng = mulberry32(seed * 7919 + 13)
  const out: WeatherEvent[] = []
  let start = 2 + Math.floor(rng() * 2)
  while (start <= LAST_START) {
    const long = rng() < 0.3
    const len = long ? 2 + Math.floor(rng() * 2) : 1
    const roll = rng()
    out.push({ start, len, roll })
    start += len + 1 + Math.floor(rng() * 2)
  }
  return out
}

/**
 * The weather that may come at the plant's stage. A transplanted tree uses the yard list from 'grownTree'
 * on, also on the night it still waits to be moved (its forecast is for the yard it will be in).
 */
export function weatherCandidates(p: PlantState): WeatherId[] {
  const stages = SPECIES[p.speciesId].stages
  const stage = stages[p.stageIndex]
  if (stage === 'seed' || p.stageIndex >= stages.length - 1) return []
  if (isOutdoor(p)) {
    if (stage === 'winter') return ['frost']
    if (stage === 'grownTree') return ['heat', 'rain']
    if (stage === 'flower' || stage === 'fruit') return ['rain', 'typhoon', 'monsoon']
    return []
  }
  if (stage === 'winter') return ['cold']
  if (stage === 'flower' || stage === 'fruit') return ['heat', 'monsoon']
  return ['heat', 'cold'] // sprout, leafStem, grownTree
}

/**
 * The weather on `day` for this plant, or null. None for a dead or finished plant, or before
 * `weatherFrom`. A long event is a monsoon when the stage has one; otherwise only its first day has
 * weather, picked like a one-day event (never a monsoon).
 */
export function weatherOn(p: PlantState, day: number): WeatherId | null {
  if (p.dead || day < p.weatherFrom) return null
  const e = weatherEvents(p.weatherSeed).find((ev) => day >= ev.start && day < ev.start + ev.len)
  if (!e) return null
  const cands = weatherCandidates(p)
  if (e.len > 1) {
    if (cands.includes('monsoon')) return 'monsoon'
    if (day !== e.start) return null
  }
  const single = cands.filter((c) => c !== 'monsoon')
  if (single.length === 0) return null
  return single[Math.floor(e.roll * single.length)]
}

/**
 * Judges the day's weather on the state after the day's actions (`did` = what the student did that day).
 * Prepared means no damage; rain that the student left alone still waters the soil up to the ideal.
 */
export function weatherHit(kind: WeatherId, s: PlantState, did: DayActions): { prepared: boolean; hit: WeatherHit } {
  const phase = phaseOf(SPECIES[s.speciesId].stages[s.stageIndex])
  const band = SPECIES[s.speciesId].bands[phase]
  const watered = did.waterAdded > 0 // NaN or missing counts as no water, like endDay
  const offWindow = s.place !== 'window'
  switch (kind) {
    case 'heat': {
      const prepared = isOutdoor(s) ? s.water >= band.water.idealLo : offWindow
      return { prepared, hit: prepared ? {} : { tempAt: HEAT_TEMP, evapScale: 2 } }
    }
    case 'rain':
      return watered ? { prepared: false, hit: { water: 'over' } } : { prepared: true, hit: { water: 'ideal' } }
    case 'monsoon': {
      // Not watering is enough for the water: the long rain (and the damp air indoors) keeps the soil moist.
      const hit: WeatherHit = watered ? (isOutdoor(s) ? { water: 'over' } : { evapScale: 0 }) : { water: 'ideal' }
      if (s.bugs > 0) hit.pestBonus = MONSOON_PEST_BONUS
      return { prepared: !watered && s.bugs === 0, hit }
    }
    case 'typhoon':
      return did.tied === true ? { prepared: true, hit: {} } : { prepared: false, hit: { healthHit: TYPHOON_HEALTH } }
    case 'cold':
      return offWindow
        ? { prepared: true, hit: {} }
        : { prepared: false, hit: { tempAt: phase === 'winter' ? COLD_WINTER_TEMP : COLD_TEMP } }
    case 'frost':
      // the straw wrap is the winter stage's care
      return careReady(s) ? { prepared: true, hit: {} } : { prepared: false, hit: { tempAt: FROST_TEMP } }
  }
}

/** Today's weather for the plant (on its own `day`) and how it is judged, or null on a calm day. */
export function todayWeather(
  p: PlantState,
  did: DayActions,
): { kind: WeatherId; prepared: boolean; hit: WeatherHit } | null {
  const kind = weatherOn(p, p.day)
  if (kind === null) return null
  return { kind, ...weatherHit(kind, p, did) }
}

/** A new plant's weather seed. */
export function newWeatherSeed(): number {
  return Math.floor(Math.random() * 256)
}
