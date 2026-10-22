import { useCallback, useEffect, useRef, useState } from 'react'
import { pendingCare } from './sim/care'
import { isNewDay, todayKey } from './sim/clock'
import { applyActions, endDay, newPlant } from './sim/day'
import { measureAnswer } from './sim/measure'
import { mulberry32, seedFor } from './sim/rng'
import { loadSave, SAVE_KEY, writeSave, type JournalEntry, type PendingObs, type SaveData } from './sim/save'
import { SPECIES, type SpeciesId, type StageId } from './sim/species'
import type { CareTaskId, DayActions, DayReport, Mode, Place, PlantState, WeatherId } from './sim/types'
import { newWeatherSeed, todayWeather, weatherOn } from './sim/weather'

/** 'record' = a kept finished journal (AppState.record), read-only. */
export type Screen = 'pick' | 'grow' | 'transplant' | 'dead' | 'journal' | 'dex' | 'backup' | 'record'

/**
 * The signal that starts the day-transition scene after [하루 마치기] (not saved). ending: 'sunrise' = a quick
 * plant's next morning comes at once, 'night' = a daily plant waits for the next date, 'fade' = the plant died,
 * finished or must be transplanted. forecast = the weather of the new day. n counts the signals.
 */
export type NightFx = { ending: 'sunrise' | 'night' | 'fade'; forecast: WeatherId | null; n: number }

export type AppState = SaveData & {
  screen: Screen
  morning: DayReport | null
  warning?: string
  /** The species whose kept finished journal the 'record' screen shows (not saved). */
  record?: SpeciesId
  /** A one-time note over the screen (not saved): 'saveFailed' = this device could not save. */
  notice?: 'saveFailed'
  nightFx?: NightFx
}

export type Action =
  /** mode defaults to daily; weatherSeed (0..255) is drawn by useApp's dispatch when left out. */
  | { type: 'pick'; id: SpeciesId; mode?: Mode; weatherSeed?: number }
  | { type: 'water'; amount: number }
  | { type: 'pellet' }
  | { type: 'removeBug' }
  | { type: 'move'; place: Place }
  | { type: 'endDay' }
  /** The new plant keeps the dead (or finished) plant's mode. */
  | { type: 'replant'; id: SpeciesId; weatherSeed?: number }
  /** A stage care task; only the one due now (pendingCare) counts. */
  | { type: 'care'; task: CareTaskId }
  /** Tie the tree to its stake on a typhoon day. */
  | { type: 'tie' }
  /** The ruler reading the student picked; helped = after two misses, the mark was shown. */
  | { type: 'measure'; cm: number; helped: boolean }
  /** The observation sentence the student picked. */
  | { type: 'observe'; text: string }
  /** The day-transition scene ended (or was skipped). */
  | { type: 'nightFxDone' }
  | { type: 'chooseYard'; place: Place }
  | { type: 'open'; screen: Screen }
  /** Show the kept finished journal of a completed species. */
  | { type: 'openRecord'; id: SpeciesId }
  /** keep: a short code (plant only): keep this device's finished journals, past tries and dex. */
  | { type: 'restore'; data: SaveData; keep?: boolean }
  /** The morning card was closed: don't show it again today. */
  | { type: 'morningSeen' }
  /** This tab could not write the save (storage full or blocked). */
  | { type: 'saveFailed' }
  | { type: 'clearNotice' }
  | { type: 'toggleSound' }
  /** The backup panel was shown for the load warning; stop showing it. */
  | { type: 'clearWarning' }
  | { type: 'tutorialDone' }
  /** Only checks for a new date (app left open past midnight). */
  | { type: 'tick' }

export const BACKUP_KEY = `${SAVE_KEY}.bak`
const TICK_MS = 60_000

const ROOM_PLACES: readonly Place[] = ['window', 'desk', 'shade']
const YARD_PLACES: readonly Place[] = ['yardSunny', 'yardPartial', 'yardShade']
const isYard = (p: Place) => YARD_PLACES.includes(p)

const stageOf = (p: PlantState): StageId => SPECIES[p.speciesId].stages[p.stageIndex]
const zeroActions = (place: Place): DayActions => ({ waterAdded: 0, pellets: 0, bugsRemoved: 0, place })

/** Annual reached 'seedDone' or perennial reached 'newShoot'. */
export function isComplete(p: PlantState): boolean {
  const stage = stageOf(p)
  return SPECIES[p.speciesId].life === 'annual' ? stage === 'seedDone' : stage === 'newShoot'
}

/** Transplant species at (or past) 'grownTree' that has not been put in the yard yet. */
export function needsTransplant(p: PlantState): boolean {
  const sp = SPECIES[p.speciesId]
  return sp.transplant && p.stageIndex >= sp.stages.indexOf('grownTree') && !isYard(p.place)
}

/** A plant the student can still care for (actions, endDay). */
export const growing = (p: PlantState | null): p is PlantState => p !== null && !p.dead && !isComplete(p)

export function screenFor(p: PlantState | null): Screen {
  if (p === null) return 'pick'
  if (p.dead) return 'dead'
  if (isComplete(p)) return 'journal'
  if (needsTransplant(p)) return 'transplant'
  return 'grow'
}

export function toSave(s: AppState): SaveData {
  const {
    screen: _screen, morning: _morning, warning: _warning, record: _record, notice: _notice, nightFx: _nightFx, ...data
  } = s
  return data
}

/** A plant grown in '한 번에 키우기' (no real dates). */
export function isQuick(p: PlantState | null): boolean {
  return p !== null && p.mode === 'quick'
}

/**
 * The weather of the growing plant's open day and how it is judged so far, or null (calm, no plant, dead or
 * finished). After a daily day is done this is the next day's weather (the plant's day has moved on). The
 * morning card and the board tell today's weather from it, also when the day before was finalized on load.
 */
export function weatherToday(s: AppState): ReturnType<typeof todayWeather> {
  if (!growing(s.plant)) return null
  return todayWeather(s.plant, s.pendingActions ?? zeroActions(s.plant.place))
}

/** One more care task done: counted on the plant at once (so a save made mid-day keeps it) and recorded. */
function withCare(p: PlantState, pend: DayActions, task: CareTaskId): [PlantState, DayActions] {
  return [{ ...p, careDone: p.careDone + 1 }, { ...pend, care: [...(pend.care ?? []), task] }]
}

/** True when the morning card of the current report was already closed today (so it stays closed). */
export function morningShown(s: AppState): boolean {
  return s.morningShownFor != null && s.morningShownFor === s.lastDayKey
}

/**
 * A short code holds only the plant, the dex, the day and the settings: restoring one keeps what this
 * device already has beyond that (finished journals, past tries, dex). Only the growing plant is replaced.
 */
export function keepRecords(current: SaveData, restored: SaveData): SaveData {
  return {
    ...restored,
    finished: { ...(current.finished ?? {}), ...(restored.finished ?? {}) },
    pastTries: [...current.pastTries, ...restored.pastTries],
    dex: [...new Set([...restored.dex, ...current.dex])],
  }
}

/** Screens a student only looks at; they stay open when another tab saves, while they still make sense. */
const VIEW_SCREENS: readonly Screen[] = ['dex', 'journal', 'record', 'backup']

/** Keeps the viewer on `prev`'s look-only screen when `next` (newer progress from another tab) still allows it. */
export function keepView(prev: AppState, next: AppState): AppState {
  if (!VIEW_SCREENS.includes(prev.screen)) return next
  if (prev.screen === 'record' && !(prev.record && next.finished?.[prev.record])) return next
  return { ...next, screen: prev.screen, ...(prev.screen === 'record' ? { record: prev.record } : {}) }
}

/** Finalize the open day of a growing plant: simulate, write the journal, route to the next screen. */
function finalizeDay(s: AppState, dateKey: string): AppState {
  let plant = s.plant as PlantState
  let did = s.pendingActions ?? zeroActions(plant.place)
  // Winter asks to bring the pot in to the desk: a plant that is already there is in.
  if (pendingCare(plant) === 'moveIn' && plant.place === 'desk') [plant, did] = withCare(plant, did, 'moveIn')
  const rng = mulberry32(seedFor(plant.day, plant.speciesId))
  // Actions were already applied to the plant as they happened; don't add them twice. The day's weather
  // is judged on what the student did.
  const { state, report } = endDay(plant, zeroActions(plant.place), rng, { did })
  const entry: JournalEntry = {
    day: plant.day,
    dateKey,
    stage: stageOf(state),
    heightCm: state.heightCm,
    leaves: state.leaves,
    actions: did,
    statuses: report.statuses,
    ...(s.pendingObs ?? {}),
    ...(report.weather ? { weather: { ...report.weather } } : {}),
  }
  let next: AppState = {
    ...s,
    plant: state,
    pendingActions: null,
    pendingObs: null,
    journal: [...s.journal, entry],
    lastReport: report,
    morning: report,
    // a new report: its card shows (again) until it is closed
    morningShownFor: null,
    screen: s.screen === 'transplant' ? 'grow' : s.screen,
  }
  if (state.dead) {
    next = {
      ...next,
      pastTries: [
        ...s.pastTries,
        {
          speciesId: state.speciesId, days: plant.day, stage: stageOf(state), cause: state.deathCause ?? '', mode: state.mode,
        },
      ],
      screen: 'dead',
    }
  } else if (isComplete(state)) {
    next = {
      ...next,
      dex: s.dex.includes(state.speciesId) ? s.dex : [...s.dex, state.speciesId],
      // Kept per species, so the next plant (which starts a new journal) never erases it.
      finished: { ...s.finished, [state.speciesId]: { journal: next.journal, mode: state.mode } },
      screen: 'journal',
    }
  } else if (needsTransplant(state)) {
    next = { ...next, screen: 'transplant' }
  }
  return next
}

/** Called once when the app starts (and on restore). */
export function boot(data: SaveData, today: string): AppState {
  // A quick plant's day is never done (only a daily plant waits for the next date).
  const open = isQuick(data.plant) && data.dayDone ? { ...data, dayDone: false } : data
  // The last finalized day's report is the morning card, also after a reload.
  return rollover({ ...keepFinished(open), screen: screenFor(data.plant), morning: data.lastReport }, today)
}

/** True when starting a new plant would erase the current plant's finished journal (not kept yet). */
export function journalWouldBeLost(s: SaveData): boolean {
  const p = s.plant
  return p !== null && !p.dead && isComplete(p) && s.journal.length > 0 && !s.finished?.[p.speciesId]
}

/** A save from before finished journals were kept: keep the journal of its completed current plant. */
function keepFinished(data: SaveData): SaveData {
  const finished = data.finished ?? {}
  if (!journalWouldBeLost({ ...data, finished })) return { ...data, finished }
  const id = (data.plant as PlantState).speciesId
  return { ...data, finished: { ...finished, [id]: { journal: data.journal } } }
}

/**
 * Start a new date if today is after lastDayKey: finalize the unfinished day (under its own date)
 * when it has actions, then reopen. Missed dates are not simulated. A quick plant has no dates: nothing
 * happens. Returns `s` itself when nothing changes.
 */
function rollover(s: AppState, today: string): AppState {
  if (s.plant === null || isQuick(s.plant) || !isNewDay(s.lastDayKey, today)) return s
  let next = s
  if (!s.dayDone && s.pendingActions !== null && growing(s.plant)) {
    next = finalizeDay(s, s.lastDayKey ?? today)
  }
  return { ...next, dayDone: false, lastDayKey: today, pendingObs: null }
}

function act(s: AppState, change: (p: PlantState, pending: DayActions) => [PlantState, DayActions] | null): AppState {
  if (s.dayDone || !growing(s.plant)) return s
  const pending = s.pendingActions ?? zeroActions(s.plant.place)
  const r = change(s.plant, pending)
  if (!r) return s
  return { ...s, plant: r[0], pendingActions: r[1] }
}

/**
 * Today's measurement or observation (once a day each), under the same rules as act(). A day with one counts
 * as played: it is finalized under its own date like a day with actions.
 */
function record(s: AppState, change: (p: PlantState, obs: PendingObs) => PendingObs | null): AppState {
  if (s.dayDone || !growing(s.plant)) return s
  const obs = change(s.plant, s.pendingObs ?? {})
  if (!obs) return s
  return { ...s, pendingObs: obs, pendingActions: s.pendingActions ?? zeroActions(s.plant.place) }
}

const seedOf = (x: number | undefined): number => (Number.isInteger(x) && x! >= 0 && x! <= 255 ? x! : 0)

/** The day-transition signal for the state `next` that endDay just made from `prev`. */
function nightFxFor(prev: AppState, next: AppState): NightFx {
  const p = next.plant as PlantState
  const goesOn = growing(p) && !needsTransplant(p)
  return {
    ending: goesOn ? (isQuick(p) ? 'sunrise' : 'night') : 'fade',
    // A tree that must move to the yard still hears tomorrow's (yard) weather.
    forecast: growing(p) ? weatherOn(p, p.day) : null,
    n: (prev.nightFx?.n ?? 0) + 1,
  }
}

function startPlant(
  s: AppState,
  id: SpeciesId,
  today: string,
  opts: { mode: Mode; weatherSeed?: number },
  dayDone: boolean,
): AppState {
  return {
    ...s,
    plant: newPlant(id, { mode: opts.mode, weatherSeed: seedOf(opts.weatherSeed) }),
    pendingActions: null,
    pendingObs: null,
    journal: [],
    dayDone,
    lastDayKey: today,
    lastReport: null,
    morning: null,
    screen: 'grow',
  }
}

export function reducer(prev: AppState, a: Action, today: string): AppState {
  if (a.type === 'restore') return boot(a.keep ? keepRecords(toSave(prev), a.data) : a.data, today)
  const s = rollover(prev, today)
  switch (a.type) {
    case 'tick':
      return s
    case 'pick': {
      const prior = s.plant
      if (!(a.id in SPECIES) || growing(prior)) return s
      const mode: Mode = a.mode === 'quick' ? 'quick' : 'daily'
      // A quick plant has no dates. First plant ever, or after a quick plant (which never used up the date):
      // day 1 is today. After a daily death, planting is the day's action (as replant). After a daily
      // completion, keep today's dayDone.
      const fresh = mode === 'quick' || prior === null || isQuick(prior)
      const dayDone = fresh ? false : (prior as PlantState).dead || s.dayDone
      return startPlant(s, a.id, today, { mode, weatherSeed: a.weatherSeed }, dayDone)
    }
    case 'replant': {
      if (!(a.id in SPECIES) || growing(s.plant)) return s
      // (growing() narrows s.plant to null here, but a dead or finished plant is still there)
      const mode: Mode = (s.plant as PlantState | null)?.mode ?? 'daily'
      // Daily: planting the seed is the day's action; the new plant's day 1 starts on the next date.
      return startPlant(s, a.id, today, { mode, weatherSeed: a.weatherSeed }, mode === 'daily')
    }
    case 'care':
      return act(s, (p, pend) => (a.task === pendingCare(p) ? withCare(p, pend, a.task) : null))
    case 'tie':
      return act(s, (p, pend) => (weatherOn(p, p.day) === 'typhoon' ? [p, { ...pend, tied: true }] : null))
    case 'measure':
      return record(s, (p, obs) =>
        stageOf(p) !== 'seed' && obs.measuredCm === undefined && a.cm === measureAnswer(p.heightCm)
          ? { ...obs, measuredCm: a.cm, measureHelped: a.helped === true }
          : null,
      )
    case 'observe':
      // Task 11 adds the check against the stage's observation sentences.
      return record(s, (_p, obs) =>
        obs.observed === undefined && typeof a.text === 'string' && a.text.trim() !== '' ? { ...obs, observed: a.text } : null,
      )
    case 'nightFxDone': {
      if (!s.nightFx) return s
      const { nightFx: _nightFx, ...rest } = s
      return rest
    }
    case 'water':
      return act(s, (p, pend) => {
        // The seed is sown (and covered) before it is watered.
        if (pendingCare(p) === 'sow') return null
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
        const moved = applyActions(p, zeroActions(a.place))
        const pend2: DayActions = { ...pend, place: a.place }
        // Winter's care for a potted perennial: bring it in to the desk.
        return a.place === 'desk' && pendingCare(p) === 'moveIn' ? withCare(moved, pend2, 'moveIn') : [moved, pend2]
      })
    case 'endDay': {
      if (s.dayDone || !growing(s.plant)) return s
      // Daily: one day per date. Quick: no date check, the next morning comes at once.
      const quick = isQuick(s.plant)
      const dateKey = quick ? today : s.lastDayKey ?? today
      const next = finalizeDay(s, dateKey)
      return { ...next, dayDone: !quick, lastDayKey: dateKey, nightFx: nightFxFor(s, next) }
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
    case 'openRecord':
      return s.finished?.[a.id] ? { ...s, screen: 'record', record: a.id } : s
    case 'clearWarning': {
      const { warning: _warning, ...rest } = s
      return rest
    }
    case 'morningSeen':
      return s.morning && !morningShown(s) ? { ...s, morningShownFor: s.lastDayKey } : s
    case 'saveFailed':
      return s.notice === 'saveFailed' ? s : { ...s, notice: 'saveFailed' }
    case 'clearNotice': {
      const { notice: _notice, ...rest } = s
      return rest
    }
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
  // A save that could not be read: show the backup panel first so a written-down code can be entered.
  return warning ? { ...s, warning, screen: 'backup' } : s
}

function storedText(): string | null {
  try {
    return globalThis.localStorage?.getItem(SAVE_KEY) ?? null
  } catch {
    return null
  }
}

export function useApp(): [AppState, (a: Action) => void] {
  // The raw text stored at boot: it counts as "ours", so a failed first write is not mistaken for another tab's save.
  const [bootText] = useState(storedText)
  const [state, setState] = useState(initState)
  // The save text this tab wrote last: a different text in storage was written by another tab.
  // Only a write that went through counts (a failed one leaves our older text in storage).
  const written = useRef<string | null>(bootText)
  // The student is told once per visit that this device cannot save.
  const failTold = useRef(false)
  const dispatch = useCallback((a: Action) => {
    // Read the date (and draw a new plant's weather seed) once, outside the updater: StrictMode may call
    // the updater twice.
    const today = todayKey()
    const action: Action =
      (a.type === 'pick' || a.type === 'replant') && a.weatherSeed === undefined ? { ...a, weatherSeed: newWeatherSeed() } : a
    setState((s) => reducer(s, action, today))
  }, [])
  useEffect(() => {
    const data = toSave(state)
    const text = JSON.stringify(data)
    if (text === written.current) return
    if (writeSave(data)) {
      written.current = text
    } else if (!failTold.current) {
      failTold.current = true
      // A save that could not be loaded at all already says so on the backup panel.
      if (state.warning !== 'unavailable') dispatch({ type: 'saveFailed' })
    }
  }, [state, dispatch])
  /** Another tab (or window) of the app saved newer progress: take it over instead of writing ours back. */
  const resync = useCallback(() => {
    const text = storedText()
    if (text === null || text === written.current) return
    const { data, warning } = loadSave()
    if (warning) return
    written.current = text
    const today = todayKey()
    setState((prev) => keepView(prev, boot(data, today)))
  }, [])

  useEffect(() => {
    // Tools are disabled once the day is done, so check for a new date without user input.
    const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
    const tick = () => {
      if (!visible()) return
      resync()
      dispatch({ type: 'tick' })
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === SAVE_KEY) resync()
    }
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    window.addEventListener('storage', onStorage)
    const id = setInterval(tick, TICK_MS)
    return () => {
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
      window.removeEventListener('storage', onStorage)
      clearInterval(id)
    }
  }, [dispatch, resync])
  return [state, dispatch]
}
