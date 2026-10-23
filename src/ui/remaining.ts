import { OBSERVATIONS } from '../data/observations'
import { pendingCare } from '../sim/care'
import type { PendingObs } from '../sim/save'
import { SPECIES } from '../sim/species'
import type { CareTaskId, PlantState } from '../sim/types'
import { growing, type AppState } from '../store'
import { CARE_TEXT } from './care/careText'

/** One activity still to do before 하루 마치기: its name for the reminder bubble. */
export type Remaining = { key: 'observe' | `care-${CareTaskId}`; label: string }

/** The ruler is out from the sprout on, once the plant is at least 1 cm tall. */
export function rulerFits(p: PlantState): boolean {
  return SPECIES[p.speciesId].stages[p.stageIndex] !== 'seed' && p.heightCm >= 1
}

/**
 * Today's observing is still to do: a magnifier sentence to pick, and a reading of the ruler when the ruler
 * is out. A stage without magnifier sentences has nothing to observe.
 */
export function observeLeft(p: PlantState, pendingObs: PendingObs | null | undefined): boolean {
  const stage = SPECIES[p.speciesId].stages[p.stageIndex]
  if (!OBSERVATIONS[p.speciesId][stage]) return false
  const observed = pendingObs?.observed !== undefined
  const measured = pendingObs?.measuredCm !== undefined || !rulerFits(p)
  return !(observed && measured)
}

/**
 * The stage care that can still be done today (the care line of the '오늘 할 일' card). A potted perennial
 * that already stands on the desk in winter cannot be moved there: its care is counted when the day ends.
 */
export function careLeft(p: PlantState): CareTaskId | null {
  const task = pendingCare(p)
  if (task === 'moveIn' && p.place === 'desk') return null
  return task
}

/**
 * What must be done before the day can end (both modes): today's stage care and today's observing.
 * Watering, light, nutrients and weather preparing stay the student's own judgment and are never listed.
 * Nothing is listed once the day is done or the plant no longer grows.
 */
export function remainingActivities(s: AppState): Remaining[] {
  const p = s.plant
  if (s.dayDone || !growing(p)) return []
  const out: Remaining[] = []
  if (observeLeft(p, s.pendingObs)) out.push({ key: 'observe', label: '관찰하기' })
  const task = careLeft(p)
  if (task !== null) out.push({ key: `care-${task}`, label: CARE_TEXT[task].did })
  return out
}
