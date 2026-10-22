import { describe, expect, it } from 'vitest'
import { dirLabel, levelFor, LEVEL_LABEL } from '../../src/sim/levels'
import type { Band } from '../../src/sim/types'

const band: Band = { lo: 30, idealLo: 45, idealHi: 70, hi: 85, span: 15 }

describe('levelFor', () => {
  it.each([
    [50, { level: 4, dir: null }],
    [45, { level: 4, dir: null }],
    [70, { level: 4, dir: null }],
    [35, { level: 3, dir: null }],
    [85, { level: 3, dir: null }],
    [20, { level: 2, dir: 'low' }],
    [100, { level: 2, dir: 'high' }],
    [101, { level: 1, dir: 'high' }],
    [0, { level: 1, dir: 'low' }],
    [1, { level: 1, dir: 'low' }], // d=29 <= 2*span (brief listed 0; contradicts its own rule)
    [-1, { level: 0, dir: 'low' }],
    [116, { level: 0, dir: 'high' }],
  ])('value %s', (v, expected) => {
    expect(levelFor(v, band)).toEqual(expected)
  })
})

describe('labels', () => {
  it('level labels', () => {
    expect(LEVEL_LABEL).toEqual(['매우 위험', '위험', '주의', '적정', '매우 좋음'])
  })
  it('dirLabel', () => {
    expect(dirLabel('temp', 'high')).toBe('← 더워요')
    expect(dirLabel('temp', 'low')).toBe('← 추워요')
    expect(dirLabel('water', 'low')).toBe('← 부족해요')
    expect(dirLabel('light', 'high')).toBe('← 너무 많아요')
    expect(dirLabel('nutrient', null)).toBe('')
    expect(dirLabel('pest', 'low')).toBe('')
  })
})
