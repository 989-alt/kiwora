import { pendingCare } from '../sim/care'
import { STAGE_POINTS } from '../sim/species'
import { growing, type AppState } from '../store'
import { CARE_TEXT, MOVE_IN_ON_DESK } from './care/careText'

/** One line of the '오늘 할 일' card. Weather lines are added by the weather UI. */
export type TodoItem = { key: string; kind: 'care' | 'weather'; text: string; done?: boolean }

/**
 * Today's to-do lines: the stage care that is due (its waiting line once growth has reached the next stage
 * and only waits for it). Shown at any time of the day, the night scene included.
 */
export function todoItems(s: AppState): TodoItem[] {
  const p = s.plant
  if (!growing(p)) return []
  const task = pendingCare(p)
  if (task === null) return []
  const text =
    task === 'moveIn' && p.place === 'desk'
      ? MOVE_IN_ON_DESK
      : p.growth >= STAGE_POINTS
        ? CARE_TEXT[task].waiting
        : CARE_TEXT[task].todo
  return [{ key: `care-${task}`, kind: 'care', text }]
}
