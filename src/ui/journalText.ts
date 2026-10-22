import type { JournalEntry } from '../sim/save'
import { newPlant } from '../sim/day'
import { SPECIES, STAGE_LABEL, type SpeciesId, type StageId } from '../sim/species'
import type { ConditionKey, Place, Status } from '../sim/types'

/** Short stage names for strips and sentences ("꽃 단계까지 자랐어요"). Use stageName() to show one. */
export const STAGE_SHORT: Record<StageId, string> = {
  seed: '씨',
  sprout: '싹',
  leafStem: '잎과 줄기',
  grownTree: '어린나무',
  flower: '꽃',
  fruit: '열매',
  winter: '겨울나기',
  newShoot: '새순',
  seedDone: '씨 얻기',
}

/** Species whose stage reads differently: a dandelion is not a tree, its 'grownTree' is a big rosette. */
const SPECIES_STAGE: Partial<Record<SpeciesId, Partial<Record<StageId, string>>>> = {
  dandelion: { grownTree: '큰 포기' },
}

/**
 * The name of a stage as shown to the student: 'short' for strips, tables and sentences,
 * 'long' for the grow screen header (STAGE_LABEL). Species-aware.
 */
export function stageName(id: SpeciesId, stage: StageId, form: 'short' | 'long' = 'short'): string {
  return SPECIES_STAGE[id]?.[stage] ?? (form === 'long' ? STAGE_LABEL[stage] : STAGE_SHORT[stage])
}

/** The caption under a seed picture: how big the real seed is. */
export const seedSizeText = (id: SpeciesId): string => `실제 크기 약 ${SPECIES[id].seedMm} mm`

const hasFinalConsonant = (word: string): boolean => {
  const code = word.charCodeAt(word.length - 1)
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
}

/** Subject particle: 봉숭아가, 벼가 / 옥수수가 / 감나무가 ... 가 after a vowel, 이 after a final consonant. */
export const withGa = (word: string): string => `${word}${hasFinalConsonant(word) ? '이' : '가'}`

const MOVED_TO: Record<Place, string> = {
  window: '창가로 옮기기',
  desk: '책상으로 옮기기',
  shade: '그늘로 옮기기',
  yardSunny: '해가 잘 드는 땅에 옮겨 심기',
  yardPartial: '반그늘 땅에 옮겨 심기',
  yardShade: '그늘진 땅에 옮겨 심기',
}

const isYard = (p: Place) => p === 'yardSunny' || p === 'yardPartial' || p === 'yardShade'

/**
 * What the student did that day. A move shows when the place differs from the previous day's
 * (the first day compares with the place a new plant starts in).
 */
export function actionsText(entry: JournalEntry, prevPlace: Place): string {
  const a = entry.actions
  const parts: string[] = []
  if (a.waterAdded > 0) parts.push('물 주기')
  if (a.place !== prevPlace && !(isYard(a.place) && isYard(prevPlace))) parts.push(MOVED_TO[a.place])
  if (a.pellets > 0) parts.push(`영양분 ${a.pellets}알 주기`)
  if (a.bugsRemoved > 0) parts.push(`벌레 ${a.bugsRemoved}마리 잡기`)
  return parts.length > 0 ? parts.join(', ') : '살펴보기'
}

/** Rows of the table: each entry with the text of what was done. */
export function journalRows(journal: JournalEntry[], speciesId: SpeciesId): { entry: JournalEntry; did: string }[] {
  let prev: Place = newPlant(speciesId).place
  return journal.map((entry) => {
    const did = actionsText(entry, prev)
    prev = entry.actions.place
    return { entry, did }
  })
}

const ORDER: ConditionKey[] = ['water', 'light', 'temp', 'nutrient', 'pest']

// [mild (주의), strong (위험 이하)]
const PHRASE: Record<ConditionKey, Record<'low' | 'high', [string, string]>> = {
  water: { low: ['물이 조금 부족했어요', '물이 많이 부족했어요'], high: ['물이 조금 많았어요', '물이 너무 많았어요'] },
  light: { low: ['햇빛이 조금 부족했어요', '햇빛이 많이 부족했어요'], high: ['햇빛이 조금 강했어요', '햇빛이 너무 강했어요'] },
  temp: { low: ['조금 추웠어요', '많이 추웠어요'], high: ['조금 더웠어요', '많이 더웠어요'] },
  nutrient: { low: ['영양분이 조금 부족했어요', '영양분이 많이 부족했어요'], high: ['영양분이 조금 많았어요', '영양분이 너무 많았어요'] },
  pest: { low: ['벌레가 생겼어요', '벌레가 많이 생겼어요'], high: ['벌레가 생겼어요', '벌레가 많이 생겼어요'] },
}

/** One short phrase for the worst condition of the day; "건강했어요" when nothing is below 적정. */
export function feelingText(statuses: Record<ConditionKey, Status> | undefined): string {
  let worst: { key: ConditionKey; level: number; dir: 'low' | 'high' } | null = null
  for (const key of ORDER) {
    const s = statuses?.[key]
    if (!s || s.level === null || s.level === undefined) continue
    if (s.level <= 2 && (worst === null || s.level < worst.level)) {
      worst = { key, level: s.level, dir: s.dir === 'high' ? 'high' : 'low' }
    }
  }
  if (worst === null) return '건강했어요'
  return PHRASE[worst.key][worst.dir][worst.level === 2 ? 0 : 1]
}

/** First journal day on which the plant was in `stage` (a new plant starts as a seed on day 1). */
export function dayReached(journal: JournalEntry[], stage: StageId): number | null {
  const hit = journal.find((e) => e.stage === stage)
  if (hit) return hit.day
  return stage === 'seed' ? 1 : null
}
