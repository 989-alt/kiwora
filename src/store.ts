import { useCallback, useEffect, useState } from 'react'
import { isNewDay, todayKey } from './sim/clock'
import { applyActions, endDay, newPlant } from './sim/day'
import { mulberry32, seedFor } from './sim/rng'
import { loadSave, SAVE_KEY, writeSave, type JournalEntry, type SaveData } from './sim/save'
import { SPECIES, type SpeciesId, type StageId } from './sim/species'
import type { DayActions, DayReport, Place, PlantState } from './sim/types'

export type Screen = 'pick' | 'grow' | 'transplant' | 'dead' | 'journal' | 'dex' | 'backup'

export type AppState = SaveData & { screen: Screen; morning: DayReport | null; warning?: string }

export type Action =
  | { type: 'pick'; id: SpeciesId }
  | { type: 'water'; amount: number }
  | { type: 'pellet' }
  | { type: 'removeBug' }
  | { type: 'move'; place: Place }
  | { type: 'endDay' }
  | { type: 'replant'; id: SpeciesId }
  | { type: 'chooseYard'; place: Place }
  | { type: 'open'; screen: Screen }
  | { type: 'restore'; data: SaveData }
  | { type: 'toggleSound' }
  | { type: 'tutorialDone' }

export const BACKUP_KEY = `${SAVE_KEY}.bak`

const ROOM_PLACES: readonly Place[] = ['window', 'desk', 'shade']
const YARD_PLACES: readonly Place[] = ['yardSunny', 'yardPartial', 'yardShade']
const isYard = (p: Place) => YARD_PLACES.includes(p)

const stageOf = (p: PlantState): StageId => SPECIES[p.speciesId].stages[p.stageIndex]
const zeroActions = (place: Place): DayActions => ({ waterAdded: 0, pellets: 0, bugsRemoved: 0, place })

/** Annual reached 'seedDone' or perennial reached 'newShoot'. */
function isComplete(p: PlantState): boolean {
  const stage = stageOf(p)
  return SPECIES[p.speciesId].life === 'annual' ? stage === 'seedDone' : stage === 'newShoot'
}

/** Transplant species at (or past) 'grownTree' that has not been put in the yard yet. */
function needsTransplant(p: PlantState): boolean {
  const sp = SPECIES[p.speciesId]
  return sp.transplant && p.stageIndex >= sp.stages.indexOf('grownTree') && !isYard(p.place)
}

/** A plant the student can still care for (actions, endDay). */
const growing = (p: PlantState | null): p is PlantState => p !== null && !p.dead && !isComplete(p)

function screenFor(p: PlantState | null): Screen {
  if (p === null) return 'pick'
  if (p.dead) return 'dead'
  if (isComplete(p)) return 'journal'
  if (needsTransplant(p)) return 'transplant'
  return 'grow'
}

function toSave(s: AppState): SaveData {
  const { screen: _screen, morning: _morning, warning: _warning, ...data } = s
  return data
}

/** Finalize the open day of a growing plant: simulate, write the journal, route to the next screen. */
function finalizeDay(s: AppState, dateKey: string): AppState {
  const plant = s.plant as PlantState
  const rng = mulberry32(seedFor(plant.day, plant.speciesId))
  // Actions were already applied to the plant as they happened; don't add them twice.
  const { state, report } = endDay(plant, zeroActions(plant.place), rng)
  const entry: JournalEntry = {
    day: plant.day,
    dateKey,
    stage: stageOf(state),
    heightCm: state.heightCm,
    leaves: state.leaves,
    actions: s.pendingActions ?? zeroActions(plant.place),
    statuses: report.statuses,
  }
  let next: AppState = {
    ...s,
    plant: state,
    pendingActions: null,
    journal: [...s.journal, entry],
    morning: report,
    screen: 'grow',
  }
  if (state.dead) {
    next = {
      ...next,
      pastTries: [
        ...s.pastTries,
        { speciesId: state.speciesId, days: plant.day, stage: stageOf(state), cause: state.deathCause ?? '' },
      ],
      screen: 'dead',
    }
  } else if (isComplete(state)) {
    next = { ...next, dex: s.dex.includes(state.speciesId) ? s.dex : [...s.dex, state.speciesId], screen: 'journal' }
  } else if (report.stageChanged && stageOf(state) === 'grownTree' && needsTransplant(state)) {
    next = { ...next, screen: 'transplant' }
  }
  return next
}

/** Called once when the app starts (and on restore). */
export function boot(data: SaveData, today: string): AppState {
  let s: AppState = { ...data, screen: screenFor(data.plant), morning: null }
  if (s.plant === null || !isNewDay(s.lastDayKey, today)) return s
  if (!s.dayDone && s.pendingActions !== null && growing(s.plant)) {
    s = finalizeDay(s, s.lastDayKey ?? today)
  }
  // A new date starts a new day; missed dates are not simulated.
  return { ...s, dayDone: false, lastDayKey: today }
}

function act(s: AppState, change: (p: PlantState, pending: DayActions) => [PlantState, DayActions] | null): AppState {
  if (s.dayDone || !growing(s.plant)) return s
  const pending = s.pendingActions ?? zeroActions(s.plant.place)
  const r = change(s.plant, pending)
  if (!r) return s
  return { ...s, plant: r[0], pendingActions: r[1] }
}

function startPlant(s: AppState, id: SpeciesId, today: string, dayDone: boolean): AppState {
  return {
    ...s,
    plant: newPlant(id),
    pendingActions: null,
    journal: [],
    dayDone,
    lastDayKey: today,
    morning: null,
    screen: 'grow',
  }
}

export function reducer(s: AppState, a: Action, today: string): AppState {
  switch (a.type) {
    case 'pick': {
      if (!(a.id in SPECIES) || growing(s.plant)) return s
      // First plant ever: day 1 is today. After a death/completion, keep today's dayDone.
      return startPlant(s, a.id, today, s.plant === null ? false : s.dayDone)
    }
    case 'replant': {
      if (!(a.id in SPECIES) || growing(s.plant)) return s
      // Planting the seed is the day's action; the new plant's day 1 starts on the next date.
      return startPlant(s, a.id, today, true)
    }
    case 'water':
      return act(s, (p, pend) => {
        if (!Number.isFinite(a.amount) || a.amount <= 0) return null
        const d: DayActions = { ...zeroActions(p.place), waterAdded: a.amount }
        return [applyActions(p, d), { ...pend, waterAdded: pend.waterAdded + a.amount }]
      })
    case 'pellet':
      return act(s, (p, pend) => [
        applyActions(p, { ...zeroActions(p.place), pellets: 1 }),
        { ...pend, pellets: pend.pellets + 1 },
      ])
    case 'removeBug':
      return act(s, (p, pend) => {
        if (p.bugs <= 0) return null
        return [applyActions(p, { ...zeroActions(p.place), bugsRemoved: 1 }), { ...pend, bugsRemoved: pend.bugsRemoved + 1 }]
      })
    case 'move':
      return act(s, (p, pend) => {
        if (isYard(p.place) || !ROOM_PLACES.includes(a.place)) return null
        return [applyActions(p, zeroActions(a.place)), { ...pend, place: a.place }]
      })
    case 'endDay': {
      if (s.dayDone || !growing(s.plant)) return s
      const dateKey = s.lastDayKey ?? today
      return { ...finalizeDay(s, dateKey), dayDone: true, lastDayKey: dateKey }
    }
    case 'chooseYard': {
      const p = s.plant
      if (!isYard(a.place) || p === null || p.dead || !needsTransplant(p)) return s
      return {
        ...s,
        plant: { ...p, place: a.place },
        pendingActions: s.pendingActions ? { ...s.pendingActions, place: a.place } : null,
        screen: 'grow',
      }
    }
    case 'open':
      return { ...s, screen: a.screen }
    case 'restore':
      return boot(a.data, today)
    case 'toggleSound':
      return { ...s, settings: { ...s.settings, sound: !s.settings.sound } }
    case 'tutorialDone':
      return { ...s, settings: { ...s.settings, tutorialSeen: true } }
  }
}

function backupCorrupt(): void {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY)
    if (raw !== null && raw !== undefined) globalThis.localStorage.setItem(BACKUP_KEY, raw)
  } catch {
    // storage unavailable: nothing to back up
  }
}

function initState(): AppState {
  const { data, warning } = loadSave()
  // Keep the unreadable save before the first writeSave replaces it.
  if (warning === 'corrupt') backupCorrupt()
  const s = boot(data, todayKey())
  return warning ? { ...s, warning } : s
}

export function useApp(): [AppState, (a: Action) => void] {
  const [state, setState] = useState(initState)
  useEffect(() => {
    writeSave(toSave(state))
  }, [state])
  const dispatch = useCallback((a: Action) => setState((s) => reducer(s, a, todayKey())), [])
  return [state, dispatch]
}
