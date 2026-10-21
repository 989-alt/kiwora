import { describe, expect, it } from 'vitest'
import { pestChance, rollPests } from '../../src/sim/pests'
import type { ConditionKey, Status } from '../../src/sim/types'

const NN: Status = { level: null, notNeeded: true }
const good: Status = { level: 4, dir: null }

function st(over: Partial<Record<ConditionKey, Status>> = {}): Record<ConditionKey, Status> {
  return { water: good, light: good, temp: good, nutrient: good, pest: good, ...over }
}

describe('pestChance', () => {
  it('perfect care almost never gets bugs', () => {
    expect(pestChance(st())).toBe(0.03)
  })

  it('overwatering raises bug chance', () => {
    expect(pestChance(st({ water: { level: 2, dir: 'high' } }))).toBeGreaterThanOrEqual(0.33)
  })

  it('underwatering does not count as overwatering', () => {
    expect(pestChance(st({ water: { level: 0, dir: 'low' } }))).toBe(0.03)
  })

  it('adds nutrient-low and light-low terms', () => {
    const c = pestChance(
      st({
        water: { level: 1, dir: 'high' },
        nutrient: { level: 2, dir: 'low' },
        light: { level: 0, dir: 'low' },
      }),
    )
    expect(c).toBeCloseTo(0.68, 10)
    expect(c).toBeLessThanOrEqual(0.8)
  })

  it('seed stage has no bugs', () => {
    const seed = st({ light: NN, nutrient: NN, pest: NN, water: { level: 0, dir: 'high' } })
    expect(pestChance(seed)).toBe(0)
    expect(rollPests(seed, () => 0)).toBe(0)
  })
})

describe('rollPests', () => {
  it('spawns 1..3 bugs when the roll is under the chance', () => {
    const seq = [0.01, 0.99]
    let i = 0
    expect(rollPests(st(), () => seq[i++])).toBe(3)
    expect(rollPests(st(), () => 0)).toBe(1)
  })

  it('spawns nothing when the roll is over the chance', () => {
    expect(rollPests(st(), () => 0.5)).toBe(0)
  })
})
