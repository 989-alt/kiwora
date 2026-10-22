import type { ConditionKey, Dir, Status } from './types'

const KEYS: ConditionKey[] = ['water', 'light', 'temp', 'nutrient', 'pest']

const SENTENCE: Record<Exclude<ConditionKey, 'pest'>, Record<'low' | 'high', string>> = {
  water: { high: '물을 너무 많이 줘서 뿌리가 썩었어요.', low: '물이 부족해서 말라 버렸어요.' },
  light: { low: '햇빛을 오래 못 받아서 약해졌어요.', high: '강한 햇빛을 너무 오래 받아서 잎이 탔어요.' },
  temp: { low: '너무 추워서 견디지 못했어요.', high: '너무 더워서 견디지 못했어요.' },
  nutrient: { low: '영양분이 부족해서 힘이 없었어요.', high: '영양분을 너무 많이 줘서 뿌리가 상했어요.' },
}
const PEST_SENTENCE = '벌레가 너무 많아져서 잎을 다 갉아 먹었어요.'

/** Every sentence deathCause can give, in a fixed order: the short backup code stores the index. Only append. */
export const DEATH_CAUSES: readonly string[] = [
  SENTENCE.water.low,
  SENTENCE.water.high,
  SENTENCE.light.low,
  SENTENCE.light.high,
  SENTENCE.temp.low,
  SENTENCE.temp.high,
  SENTENCE.nutrient.low,
  SENTENCE.nutrient.high,
  PEST_SENTENCE,
]

/**
 * One-sentence cause of death. Looks at the last 3 days (newest last), sums each condition's level
 * (notNeeded counts as 4) and picks the lowest sum; ties go to KEYS order. Direction comes from the
 * newest day that had one for that condition ('low' if none).
 */
export function deathCause(history: Record<ConditionKey, Status>[]): string {
  const recent = history.slice(-3)
  let worst: ConditionKey = 'water'
  let worstSum = Infinity
  for (const k of KEYS) {
    const sum = recent.reduce((acc, d) => acc + (d[k].level ?? 4), 0)
    if (sum < worstSum) {
      worstSum = sum
      worst = k
    }
  }
  if (worst === 'pest') return PEST_SENTENCE
  let dir: Dir = null
  for (let i = recent.length - 1; i >= 0 && dir === null; i--) {
    const s = recent[i][worst]
    if (s.level !== null) dir = s.dir
  }
  return SENTENCE[worst][dir ?? 'low']
}
