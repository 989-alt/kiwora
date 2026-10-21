/** 0 매우 위험 … 4 매우 좋음 */
export type Level = 0 | 1 | 2 | 3 | 4
export type Dir = 'low' | 'high' | null
export type Band = { lo: number; idealLo: number; idealHi: number; hi: number; span: number }
export type ConditionKey = 'water' | 'light' | 'temp' | 'nutrient' | 'pest'
export type Status = { level: Level; dir: Dir } | { level: null; notNeeded: true }
