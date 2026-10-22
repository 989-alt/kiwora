import type { ConditionKey, Status } from './types'

function isBad(s: Status, dir: 'low' | 'high'): boolean {
  return s.level !== null && s.level <= 2 && s.dir === dir
}

/**
 * Chance that new bugs appear tonight. Care decides it: overwatering, low nutrient, low light; `bonus` is
 * the weather's extra chance (a monsoon with bugs left). 0 in the seed phase.
 */
export function pestChance(st: Record<ConditionKey, Status>, bonus = 0): number {
  if (st.pest.level === null) return 0 // seed phase: pest is notNeeded
  const c =
    0.03 +
    (isBad(st.water, 'high') ? 0.3 : 0) +
    (isBad(st.nutrient, 'low') ? 0.2 : 0) +
    (isBad(st.light, 'low') ? 0.15 : 0) +
    bonus
  return Math.min(0.8, Math.round(c * 100) / 100) // round away float noise (0.03+0.3 → 0.33)
}

/** Number of new bugs (0, or 1..3). */
export function rollPests(st: Record<ConditionKey, Status>, rng: () => number, bonus = 0): number {
  if (rng() < pestChance(st, bonus)) return 1 + Math.floor(rng() * 3)
  return 0
}
