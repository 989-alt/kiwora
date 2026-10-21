import { describe, expect, it } from 'vitest'
import { isNewDay, todayKey } from '../../src/sim/clock'

describe('clock', () => {
  it('rejects past date', () => {
    expect(isNewDay('2026-10-21', '2026-10-20')).toBe(false)
    expect(isNewDay('2026-10-21', '2026-10-21')).toBe(false)
    expect(isNewDay('2026-10-21', '2026-10-22')).toBe(true)
    expect(isNewDay(null, '2026-10-21')).toBe(true)
  })

  it('todayKey uses the local date, not UTC', () => {
    expect(todayKey(new Date(2026, 9, 21, 23, 30))).toBe('2026-10-21')
    expect(todayKey(new Date(2026, 0, 5, 0, 10))).toBe('2026-01-05')
  })

  it('todayKey defaults to now', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
