import type { Band, ConditionKey, Dir, Level } from './types'

export const LEVEL_LABEL: Record<Level, string> = ['매우 위험', '위험', '주의', '적정', '매우 좋음']

export function levelFor(value: number, band: Band): { level: Level; dir: Dir } {
  if (value >= band.idealLo && value <= band.idealHi) return { level: 4, dir: null }
  if (value >= band.lo && value <= band.hi) return { level: 3, dir: null }
  const below = value < band.lo
  const d = below ? band.lo - value : value - band.hi
  const level: Level = d <= band.span ? 2 : d <= 2 * band.span ? 1 : 0
  return { level, dir: below ? 'low' : 'high' }
}

export function dirLabel(key: ConditionKey, dir: Dir): string {
  if (dir === null || key === 'pest') return ''
  if (key === 'temp') return dir === 'low' ? '← 추워요' : '← 더워요'
  return dir === 'low' ? '← 부족' : '← 너무 많음'
}
