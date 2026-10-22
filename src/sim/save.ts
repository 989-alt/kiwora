import LZString from 'lz-string'
import { careTasks } from './care'
import { seedFor } from './rng'
import { SPECIES, STAGE_LABEL, type SpeciesId, type StageId } from './species'
import { decodeShort, encodeShort } from './shortCode'
import type { CareTaskId, ConditionKey, DayActions, DayReport, Mode, Place, PlantState, Status, WeatherId } from './types'

export type JournalEntry = {
  day: number
  dateKey: string
  stage: StageId
  heightCm: number
  leaves: number
  actions: DayActions
  statuses: Record<ConditionKey, Status>
  /** The height the student read off the ruler that day; measureHelped = after two misses, shown the mark. */
  measuredCm?: number
  measureHelped?: boolean
  /** What the student picked as the day's observation. */
  observed?: string
  weather?: { kind: WeatherId; prepared: boolean }
}

export type PastTry = { speciesId: SpeciesId; days: number; stage: StageId; cause: string; mode?: Mode }

/** Today's measurement and observation, written into the journal entry when the day ends. */
export type PendingObs = { measuredCm?: number; measureHelped?: boolean; observed?: string }

export type SaveData = {
  v: 1
  plant: PlantState | null
  pendingActions: DayActions | null
  lastDayKey: string | null
  dayDone: boolean
  journal: JournalEntry[]
  pastTries: PastTry[]
  dex: SpeciesId[]
  settings: { sound: boolean; tutorialSeen: boolean }
  /** Report of the last finalized day, shown as the morning card (also after a reload). */
  lastReport: DayReport | null
  /**
   * The journal of each species' last completed plant, kept after the next plant starts (added within v1:
   * older saves have none, normalize fills {}).
   */
  finished?: FinishedJournals
  /** The lastDayKey on which the student closed the morning card of lastReport (added within v1). */
  morningShownFor?: string | null
  /** Today's measurement and observation before the day ends (added within v1; normalize fills null). */
  pendingObs?: PendingObs | null
}

export type FinishedJournals = Partial<Record<SpeciesId, { journal: JournalEntry[]; mode?: Mode }>>

export const SAVE_KEY = 'plantlife.v1'
const CODE_PREFIX = 'PL1-'
const BAD_CODE = '기록 코드가 맞지 않아요. 다시 확인해 주세요.'
const MAX_BUGS = 12

export function emptySave(): SaveData {
  return {
    v: 1,
    plant: null,
    pendingActions: null,
    lastDayKey: null,
    dayDone: false,
    journal: [],
    pastTries: [],
    dex: [],
    settings: { sound: true, tutorialSeen: false },
    lastReport: null,
    finished: {},
    pendingObs: null,
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

const PLACES: readonly Place[] = ['window', 'desk', 'shade', 'yardSunny', 'yardPartial', 'yardShade']
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isDateKey = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)
const isPlace = (x: unknown): x is Place => PLACES.includes(x as Place)
const isSpecies = (x: unknown): x is SpeciesId => typeof x === 'string' && Object.prototype.hasOwnProperty.call(SPECIES, x)
const isStage = (x: unknown): x is StageId => typeof x === 'string' && Object.prototype.hasOwnProperty.call(STAGE_LABEL, x)
const isMode = (x: unknown): x is Mode => x === 'daily' || x === 'quick'
const isIntIn = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi
const CARE_IDS: readonly CareTaskId[] = [
  'sow', 'thin', 'stake', 'stakeTwine', 'hillUp', 'pinch', 'drainCheck', 'prune',
  'pollinate', 'shakePollen', 'harvestSeed', 'harvest', 'winterWrap', 'moveIn',
]
const WEATHER_IDS: readonly WeatherId[] = ['heat', 'rain', 'monsoon', 'typhoon', 'cold', 'frost']
const isCareList = (x: unknown): x is CareTaskId[] => Array.isArray(x) && x.every((c) => CARE_IDS.includes(c as CareTaskId))
const isBool = (x: unknown): x is boolean => typeof x === 'boolean'
const isStr = (x: unknown): x is string => typeof x === 'string'
const isWeather = (x: unknown): x is { kind: WeatherId; prepared: boolean } =>
  isObj(x) && WEATHER_IDS.includes(x.kind as WeatherId) && isBool(x.prepared)

/** The optional fields of `raw` that pass their check; a field that fails is left out, the rest is kept. */
function optional<T>(raw: Record<string, unknown>, checks: Record<string, (x: unknown) => boolean>): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, ok] of Object.entries(checks)) if (ok(raw[k])) out[k] = raw[k]
  return out as Partial<T>
}
const OBS_CHECKS = { measuredCm: isNum, measureHelped: isBool, observed: isStr }
const weatherOf = (w: { kind: WeatherId; prepared: boolean }) => ({ kind: w.kind, prepared: w.prepared })

function cleanPlant(raw: unknown): PlantState | null {
  if (!isObj(raw) || !isSpecies(raw.speciesId)) return null
  const numKeys = ['stageIndex', 'growth', 'health', 'water', 'nutrient', 'lightExp', 'bugs', 'day', 'heightCm', 'leaves'] as const
  if (!numKeys.every((k) => isNum(raw[k])) || !isPlace(raw.place) || typeof raw.dead !== 'boolean') return null
  const stageIndex = raw.stageIndex as number
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= SPECIES[raw.speciesId].stages.length) return null
  const speciesId = raw.speciesId
  const tasks = careTasks(speciesId, SPECIES[speciesId].stages[stageIndex]).length
  // No mode = a v1 plant: 'daily', its current stage's care counts as done (no student is blocked by the
  // update) and no weather before tomorrow; the seed depends on the species only, so reloads agree.
  const v1 = raw.mode === undefined
  return {
    ...(raw as unknown as PlantState),
    history: Array.isArray(raw.history) ? (raw.history as PlantState['history']) : [],
    bugs: Math.round(Math.min(MAX_BUGS, Math.max(0, raw.bugs as number))),
    mode: isMode(raw.mode) ? raw.mode : 'daily',
    careDone: v1 ? tasks : isIntIn(raw.careDone, 0, tasks) ? raw.careDone : 0,
    weatherSeed: v1 ? seedFor(0, speciesId) & 255 : isIntIn(raw.weatherSeed, 0, 255) ? raw.weatherSeed : 0,
    weatherFrom: v1 ? Math.floor(raw.day as number) + 1 : isIntIn(raw.weatherFrom, 2, Infinity) ? raw.weatherFrom : 2,
  }
}

function cleanActions(raw: unknown): DayActions | null {
  if (!isObj(raw)) return null
  if (!isNum(raw.waterAdded) || !isNum(raw.pellets) || !isNum(raw.bugsRemoved) || !isPlace(raw.place)) return null
  return {
    waterAdded: raw.waterAdded,
    pellets: raw.pellets,
    bugsRemoved: raw.bugsRemoved,
    place: raw.place,
    ...(isCareList(raw.care) ? { care: [...raw.care] } : {}),
    ...(isBool(raw.tied) ? { tied: raw.tied } : {}),
  }
}

function cleanJournal(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) return []
  const out: JournalEntry[] = []
  for (const e of raw) {
    if (!isObj(e) || !isNum(e.day) || !isStr(e.dateKey) || !isStage(e.stage) || !isNum(e.heightCm) || !isNum(e.leaves)) continue
    const actions = cleanActions(e.actions)
    if (!actions || !isObj(e.statuses)) continue
    out.push({
      day: e.day,
      dateKey: e.dateKey,
      stage: e.stage,
      heightCm: e.heightCm,
      leaves: e.leaves,
      actions,
      statuses: e.statuses as JournalEntry['statuses'],
      ...optional<JournalEntry>(e, OBS_CHECKS),
      ...(isWeather(e.weather) ? { weather: weatherOf(e.weather) } : {}),
    })
  }
  return out
}

function cleanPastTries(raw: unknown): PastTry[] {
  if (!Array.isArray(raw)) return []
  const out: PastTry[] = []
  for (const e of raw) {
    if (!isObj(e) || !isSpecies(e.speciesId) || !isNum(e.days) || !isStage(e.stage) || !isStr(e.cause)) continue
    out.push({ speciesId: e.speciesId, days: e.days, stage: e.stage, cause: e.cause, ...(isMode(e.mode) ? { mode: e.mode } : {}) })
  }
  return out
}

/** Junk (not an object) becomes null; inside, a field with the wrong type is left out. */
function cleanPendingObs(raw: unknown): PendingObs | null {
  return isObj(raw) ? optional<PendingObs>(raw, OBS_CHECKS) : null
}

const CONDITIONS: readonly ConditionKey[] = ['water', 'light', 'temp', 'nutrient', 'pest']

function cleanReport(raw: unknown): DayReport | null {
  if (!isObj(raw) || !isObj(raw.statuses)) return null
  const st = raw.statuses
  if (!CONDITIONS.every((k) => isObj(st[k]))) return null
  if (!isNum(raw.healthDelta) || !isNum(raw.newBugs) || !isNum(raw.heightDelta)) return null
  if (typeof raw.grew !== 'boolean' || typeof raw.stageChanged !== 'boolean' || typeof raw.died !== 'boolean') return null
  return {
    statuses: st as DayReport['statuses'],
    healthDelta: raw.healthDelta,
    grew: raw.grew,
    stageChanged: raw.stageChanged,
    died: raw.died,
    newBugs: raw.newBugs,
    heightDelta: raw.heightDelta,
    ...(isBool(raw.waiting) ? { waiting: raw.waiting } : {}),
    ...(isWeather(raw.weather) ? { weather: weatherOf(raw.weather) } : {}),
  }
}

/** Shared by loadSave and importCode: validate shape, drop junk, repair old plants. Null = unusable. */
function normalize(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.v !== 1) return null
  const base = emptySave()
  let plant: PlantState | null = null
  if (raw.plant !== null && raw.plant !== undefined) {
    plant = cleanPlant(raw.plant)
    if (!plant) return null
  }
  const st = isObj(raw.settings) ? raw.settings : {}
  return {
    v: 1,
    plant,
    pendingActions: cleanActions(raw.pendingActions),
    lastDayKey: isDateKey(raw.lastDayKey) ? raw.lastDayKey : null,
    dayDone: raw.dayDone === true,
    journal: cleanJournal(raw.journal),
    pastTries: cleanPastTries(raw.pastTries),
    dex: Array.isArray(raw.dex) ? [...new Set(raw.dex.filter(isSpecies))] : [],
    settings: {
      sound: typeof st.sound === 'boolean' ? st.sound : base.settings.sound,
      tutorialSeen: typeof st.tutorialSeen === 'boolean' ? st.tutorialSeen : base.settings.tutorialSeen,
    },
    lastReport: cleanReport(raw.lastReport),
    finished: cleanFinished(raw.finished),
    ...(isDateKey(raw.morningShownFor) ? { morningShownFor: raw.morningShownFor } : {}),
    pendingObs: cleanPendingObs(raw.pendingObs),
  }
}

function cleanFinished(raw: unknown): FinishedJournals {
  const out: FinishedJournals = {}
  if (!isObj(raw)) return out
  for (const [id, rec] of Object.entries(raw)) {
    if (!isSpecies(id) || !isObj(rec)) continue
    const journal = cleanJournal(rec.journal)
    if (journal.length > 0) out[id] = { journal, ...(isMode(rec.mode) ? { mode: rec.mode } : {}) }
  }
  return out
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadSave(storage?: Storage): { data: SaveData; warning?: 'corrupt' | 'unavailable' } {
  const st = storage ?? defaultStorage()
  if (!st) return { data: emptySave(), warning: 'unavailable' }
  let text: string | null
  try {
    text = st.getItem(SAVE_KEY)
  } catch {
    return { data: emptySave(), warning: 'unavailable' }
  }
  if (text === null) return { data: emptySave() }
  try {
    const data = normalize(JSON.parse(text))
    if (data) return { data }
  } catch {
    // fall through to corrupt
  }
  return { data: emptySave(), warning: 'corrupt' }
}

export function writeSave(data: SaveData, storage?: Storage): boolean {
  try {
    const st = storage ?? defaultStorage()
    if (!st) return false
    st.setItem(SAVE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/** The full code (everything, journals included): long, for copying. */
export function exportCode(data: SaveData): string {
  return CODE_PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(data))
}

/**
 * The short code for writing down: plant (with its mode, care and weather seed), dex, day and settings
 * only (see shortCode.ts). Measured heights and observations are kept by the long code only.
 */
export function shortCode(data: SaveData): string {
  return encodeShort(data)
}

/** True for text that is (meant to be) a short code rather than the long PL1- one. */
export function isShortCode(code: string): boolean {
  return !String(code).trim().startsWith(CODE_PREFIX)
}

/** Accepts the long PL1- code and the short code. */

export function importCode(code: string): { ok: true; data: SaveData } | { ok: false; message: string } {
  try {
    const text = String(code).trim()
    let raw: unknown
    if (text.startsWith(CODE_PREFIX)) {
      const json = LZString.decompressFromEncodedURIComponent(text.slice(CODE_PREFIX.length))
      if (!json) throw new Error('empty')
      raw = JSON.parse(json)
    } else {
      raw = decodeShort(text)
    }
    const data = normalize(raw)
    if (!data) throw new Error('shape')
    return { ok: true, data }
  } catch {
    return { ok: false, message: BAD_CODE }
  }
}

export async function requestPersist(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // ignored
  }
}
