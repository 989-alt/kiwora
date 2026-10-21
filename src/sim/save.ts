import LZString from 'lz-string'
import type { SpeciesId, StageId } from './species'
import type { ConditionKey, DayActions, PlantState, Status } from './types'

export type JournalEntry = {
  day: number
  dateKey: string
  stage: StageId
  heightCm: number
  leaves: number
  actions: DayActions
  statuses: Record<ConditionKey, Status>
}

export type PastTry = { speciesId: SpeciesId; days: number; stage: StageId; cause: string }

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
}

export const SAVE_KEY = 'plantlife.v1'
const CODE_PREFIX = 'PL1-'
const BAD_CODE = '코드가 맞지 않아요. 다시 확인해 주세요.'
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
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Shared by loadSave and importCode: validate version, fill gaps, repair old plants. */
function normalize(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.v !== 1) return null
  const base = emptySave()
  const data = { ...base, ...(raw as Partial<SaveData>), v: 1 as const }
  data.settings = { ...base.settings, ...(isObj(raw.settings) ? (raw.settings as Partial<SaveData['settings']>) : {}) }
  if (!Array.isArray(data.journal)) data.journal = []
  if (!Array.isArray(data.pastTries)) data.pastTries = []
  if (!Array.isArray(data.dex)) data.dex = []
  if (data.plant !== null && !isObj(data.plant)) data.plant = null
  if (data.plant) {
    const p = { ...data.plant }
    if (!Array.isArray(p.history)) p.history = []
    p.bugs = Math.min(MAX_BUGS, Number.isFinite(p.bugs) ? p.bugs : 0)
    data.plant = p
  }
  return data
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

export function exportCode(data: SaveData): string {
  return CODE_PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(data))
}

export function importCode(code: string): { ok: true; data: SaveData } | { ok: false; message: string } {
  try {
    const text = String(code).trim()
    if (!text.startsWith(CODE_PREFIX)) throw new Error('prefix')
    const json = LZString.decompressFromEncodedURIComponent(text.slice(CODE_PREFIX.length))
    if (!json) throw new Error('empty')
    const data = normalize(JSON.parse(json))
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
