import { DEATH_CAUSES } from './death'
import type { SaveData } from './save'
import type { SpeciesId } from './species'
import type { Place } from './types'

/**
 * The short backup code a student writes down: the plant, the dex, the day gating and the settings packed
 * into bits + a 10-bit CRC, written as Crockford base32 letters. It leaves out the journals, past tries,
 * the plant's 3-day history and the last morning report.
 *
 * - Format 2 (written now): 114 bits + 1 spare + CRC = 25 letters in 5 groups of 5 (29 characters).
 *   The day's pending water is kept in steps of 5 (0..150).
 * - Format 1 (older codes, still read): 110 bits + CRC = 24 letters in 6 groups of 4; it only knew
 *   whether the plant had been watered that day.
 *
 * The orders below are part of the format: only append, never reorder.
 */
const SPECIES_ORDER: readonly SpeciesId[] = [
  'balsam', 'bean', 'morningGlory', 'rice', 'corn', 'apple', 'dandelion', 'forsythia', 'persimmon',
]
const PLACE_ORDER: readonly Place[] = ['window', 'desk', 'shade', 'yardSunny', 'yardPartial', 'yardShade']

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const FORMAT_V1 = 1
const FORMAT_V2 = 2
const NO_PLANT = 15
const DEAD_UNKNOWN = 15
const CRC_BITS = 10
const CRC_POLY = 0x233 // CRC-10: catches every error within 10 bits in a row (a wrong or swapped pair of letters)
/** Letters of a code by format. */
const CODE_CHARS: Record<number, number> = { [FORMAT_V1]: 24, [FORMAT_V2]: 25 }
const GROUP: Record<number, number> = { [FORMAT_V1]: 4, [FORMAT_V2]: 5 }
const WATER_STEP = 5
const WATER_STEPS_MAX = 30 // 150
const EPOCH = Date.UTC(2026, 0, 1)
const DAY_MS = 86_400_000

type Field = [value: number, bits: number]

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)))

function dayNumber(key: string | null): number {
  const m = key ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null
  if (!m) return 0
  const n = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - EPOCH) / DAY_MS) + 1
  return clampInt(n, 1, 4095)
}

function dayKey(n: number): string | null {
  if (n === 0) return null
  const d = new Date(EPOCH + (n - 1) * DAY_MS)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function crc(bits: number[]): number {
  let r = 0
  for (const b of bits) {
    const top = ((r >> (CRC_BITS - 1)) & 1) ^ b
    r = (r << 1) & ((1 << CRC_BITS) - 1)
    if (top) r ^= CRC_POLY
  }
  return r
}

/** Pending water in steps of 5; any watering keeps at least one step so the journal still shows it. */
function waterSteps(w: number): number {
  if (!Number.isFinite(w) || w <= 0) return 0
  return clampInt(w / WATER_STEP, 1, WATER_STEPS_MAX)
}

function fields(d: SaveData): Field[] {
  const p = d.plant
  const pend = d.pendingActions
  let death = 0
  if (p?.dead) {
    const i = DEATH_CAUSES.indexOf(p.deathCause ?? '')
    death = i >= 0 ? i + 1 : DEAD_UNKNOWN
  }
  return [
    [FORMAT_V2, 2],
    [p ? SPECIES_ORDER.indexOf(p.speciesId) : NO_PLANT, 4],
    [p ? clampInt(p.stageIndex, 0, 7) : 0, 3],
    [p ? clampInt(Math.floor(p.growth * 16), 0, 63) : 0, 6], // growth in 1/16 points (< 4)
    [p ? clampInt(p.health, 0, 100) : 0, 7],
    [p ? clampInt(p.water, 0, 150) : 0, 8],
    [p ? clampInt(p.nutrient, 0, 150) : 0, 8],
    [p ? clampInt(p.lightExp, 0, 127) : 0, 7],
    [p ? PLACE_ORDER.indexOf(p.place) : 0, 3],
    [p ? clampInt(p.bugs, 0, 12) : 0, 4],
    [p ? clampInt(p.day, 1, 255) : 0, 8],
    [p ? clampInt(p.heightCm * 10, 0, 511) : 0, 9], // tenths of a cm
    [p ? clampInt(p.leaves, 0, 31) : 0, 5],
    [death, 4],
    [pend ? 1 : 0, 1],
    [pend ? waterSteps(pend.waterAdded) : 0, 5], // format 1: one bit (watered or not)
    [pend ? clampInt(pend.pellets, 0, 7) : 0, 3],
    [pend ? clampInt(pend.bugsRemoved, 0, 7) : 0, 3],
    [dayNumber(d.lastDayKey), 12],
    [d.dayDone ? 1 : 0, 1],
    [SPECIES_ORDER.reduce((m, id, i) => (d.dex.includes(id) ? m | (1 << i) : m), 0), 9],
    [d.settings.sound ? 1 : 0, 1],
    [d.settings.tutorialSeen ? 1 : 0, 1],
  ]
}

/** The short code of a save, e.g. "8F3K0-Q2M7A-…" (25 letters in 5 groups). */
export function encodeShort(d: SaveData): string {
  const bits: number[] = []
  for (const [v, n] of fields(d)) for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1)
  while (bits.length < CODE_CHARS[FORMAT_V2] * 5 - CRC_BITS) bits.push(0) // the spare bit
  const c = crc(bits)
  for (let i = CRC_BITS - 1; i >= 0; i--) bits.push((c >> i) & 1)
  let out = ''
  for (let i = 0; i < bits.length; i += 5) {
    out += ALPHABET[bits.slice(i, i + 5).reduce((a, b) => (a << 1) | b, 0)]
  }
  return out.match(new RegExp(`.{1,${GROUP[FORMAT_V2]}}`, 'g'))!.join('-')
}

/** Letters a student may write instead of the code's own (Crockford base32). */
const ALIAS: Record<string, string> = { O: '0', I: '1', L: '1' }

/** Unpacks a short code to a raw save for normalize(); null when it is not a valid short code. */
export function decodeShort(text: string): unknown | null {
  const clean = text.toUpperCase().replace(/[\s-]/g, '')
  const format = clean.length === CODE_CHARS[FORMAT_V2] ? FORMAT_V2 : clean.length === CODE_CHARS[FORMAT_V1] ? FORMAT_V1 : 0
  if (format === 0) return null
  const bits: number[] = []
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ALIAS[ch] ?? ch)
    if (v < 0) return null
    for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1)
  }
  const payload = bits.slice(0, bits.length - CRC_BITS)
  const sum = bits.slice(bits.length - CRC_BITS).reduce((a, b) => (a << 1) | b, 0)
  if (crc(payload) !== sum) return null

  let at = 0
  const read = (n: number) => {
    let v = 0
    for (let i = 0; i < n; i++) v = (v << 1) | payload[at++]
    return v
  }
  if (read(2) !== format) return null
  const species = read(4)
  const stageIndex = read(3)
  const growth = read(6) / 16
  const health = read(7)
  const water = read(8)
  const nutrient = read(8)
  const lightExp = read(7)
  const place = PLACE_ORDER[read(3)]
  const bugs = read(4)
  const day = read(8)
  const heightCm = read(9) / 10
  const leaves = read(5)
  const death = read(4)
  const hasPending = read(1) === 1
  const waterAdded = format === FORMAT_V1 ? read(1) : read(5) * WATER_STEP
  const pellets = read(3)
  const bugsRemoved = read(3)
  const lastDayKey = dayKey(read(12))
  const dayDone = read(1) === 1
  const dexMask = read(9)
  const sound = read(1) === 1
  const tutorialSeen = read(1) === 1

  let plant: Record<string, unknown> | null = null
  if (species !== NO_PLANT) {
    const speciesId = SPECIES_ORDER[species]
    if (!speciesId || !place) return null
    plant = {
      speciesId, stageIndex, growth, health, water, nutrient, lightExp, place, bugs, day, heightCm, leaves,
      dead: death > 0,
      history: [],
    }
    if (death > 0 && death !== DEAD_UNKNOWN) {
      const cause = DEATH_CAUSES[death - 1]
      if (cause === undefined) return null
      plant.deathCause = cause
    }
  }
  return {
    v: 1,
    plant,
    pendingActions: plant && hasPending ? { waterAdded, pellets, bugsRemoved, place: plant.place } : null,
    lastDayKey,
    dayDone,
    journal: [],
    pastTries: [],
    dex: SPECIES_ORDER.filter((_, i) => dexMask & (1 << i)),
    settings: { sound, tutorialSeen },
    lastReport: null,
    finished: {},
  }
}
