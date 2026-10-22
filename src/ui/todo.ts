import { isOutdoor, pendingCare } from '../sim/care'
import { STAGE_POINTS } from '../sim/species'
import { growing, weatherToday, type AppState } from '../store'
import { CARE_TEXT, DANDELION_POLLINATE, MOVE_IN_ON_DESK } from './care/careText'
import { todayText } from './weatherText'

/** One line of the '오늘 할 일' card. */
export type TodoItem = { key: string; kind: 'care' | 'weather'; text: string; done?: boolean }

/**
 * Today's weather as a to-do line, while the day is open: gone once the student has prepared for it. Rain and
 * monsoon ask for not doing something (no water), so they stay until the day ends. A done daily day lists
 * none (the night scene tells tomorrow's weather).
 */
function weatherItem(s: AppState): TodoItem[] {
  if (s.dayDone) return []
  const w = weatherToday(s)
  if (w === null) return []
  const stays = w.kind === 'rain' || w.kind === 'monsoon'
  if (w.prepared && !stays) return []
  // The winter care already says "wrap the stem in straw": the frost line would only say it twice.
  if (w.kind === 'frost' && pendingCare(s.plant!) === 'winterWrap') return []
  return [{ key: `weather-${w.kind}`, kind: 'weather', text: todayText(w.kind, isOutdoor(s.plant!)) }]
}

/**
 * Today's to-do lines: today's weather first, then the stage care that is due (its waiting line once growth
 * has reached the next stage and only waits for it). The care shows at any time of the day, the night
 * scene included.
 */
export function todoItems(s: AppState): TodoItem[] {
  const p = s.plant
  if (!growing(p)) return []
  const weather = weatherItem(s)
  const task = pendingCare(p)
  if (task === null) return weather
  const text =
    task === 'moveIn' && p.place === 'desk'
      ? MOVE_IN_ON_DESK
      : task === 'pollinate' && p.speciesId === 'dandelion' && p.growth < STAGE_POINTS
        ? DANDELION_POLLINATE
        : p.growth >= STAGE_POINTS
        ? CARE_TEXT[task].waiting
        : CARE_TEXT[task].todo
  return [...weather, { key: `care-${task}`, kind: 'care', text }]
}
