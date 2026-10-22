import type { SpeciesId } from './species'

/** 0 매우 위험 … 4 매우 좋음 */
export type Level = 0 | 1 | 2 | 3 | 4
export type Dir = 'low' | 'high' | null
export type Band = { lo: number; idealLo: number; idealHi: number; hi: number; span: number }
export type ConditionKey = 'water' | 'light' | 'temp' | 'nutrient' | 'pest'
export type Status = { level: Level; dir: Dir } | { level: null; notNeeded: true }

export type Place = 'window' | 'desk' | 'shade' | 'yardSunny' | 'yardPartial' | 'yardShade'

/** 'daily' = one day per real date (v1); 'quick' = the next morning comes right after the day ends. */
export type Mode = 'daily' | 'quick'
export type CareTaskId =
  | 'sow' | 'thin' | 'stake' | 'stakeTwine' | 'hillUp' | 'pinch' | 'drainCheck' | 'prune'
  | 'pollinate' | 'shakePollen' | 'harvestSeed' | 'harvest' | 'winterWrap' | 'moveIn'
export type WeatherId = 'heat' | 'rain' | 'monsoon' | 'typhoon' | 'cold' | 'frost'

export type PlantState = {
  speciesId: SpeciesId
  stageIndex: number
  growth: number
  health: number
  water: number
  nutrient: number
  lightExp: number
  place: Place
  bugs: number
  day: number
  heightCm: number
  leaves: number
  dead: boolean
  deathCause?: string
  /** Statuses of the last 3 finished days, newest last (used for the death cause). */
  history: Record<ConditionKey, Status>[]
  mode: Mode
  /** How many of the current stage's care tasks (care.ts) are done; reset to 0 when the stage changes. */
  careDone: number
  /** Seed (0..255) of this plant's weather schedule. */
  weatherSeed: number
  /** First day on which weather may come (2 for a new plant: day 1 has no forecast before it). */
  weatherFrom: number
}

export type DayActions = {
  waterAdded: number
  pellets: number
  bugsRemoved: number
  place: Place
  care?: CareTaskId[]
  tied?: boolean
}

export type DayReport = {
  statuses: Record<ConditionKey, Status>
  healthDelta: number
  grew: boolean
  stageChanged: boolean
  died: boolean
  newBugs: number
  heightDelta: number
  /** Growth reached the next stage's threshold but the stage care is not done yet. */
  waiting?: boolean
  weather?: { kind: WeatherId; prepared: boolean }
}
