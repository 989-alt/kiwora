import type { SpeciesId } from './species'

/** 0 매우 위험 … 4 매우 좋음 */
export type Level = 0 | 1 | 2 | 3 | 4
export type Dir = 'low' | 'high' | null
export type Band = { lo: number; idealLo: number; idealHi: number; hi: number; span: number }
export type ConditionKey = 'water' | 'light' | 'temp' | 'nutrient' | 'pest'
export type Status = { level: Level; dir: Dir } | { level: null; notNeeded: true }

export type Place = 'window' | 'desk' | 'shade' | 'yardSunny' | 'yardPartial' | 'yardShade'

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
}

export type DayActions = { waterAdded: number; pellets: number; bugsRemoved: number; place: Place }

export type DayReport = {
  statuses: Record<ConditionKey, Status>
  healthDelta: number
  grew: boolean
  stageChanged: boolean
  died: boolean
  newBugs: number
  heightDelta: number
}
