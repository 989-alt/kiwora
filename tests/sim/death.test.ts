import { describe, expect, it } from 'vitest'
import { deathCause } from '../../src/sim/death'
import type { ConditionKey, Status } from '../../src/sim/types'

const good: Status = { level: 4, dir: null }
const NN: Status = { level: null, notNeeded: true }

function day(over: Partial<Record<ConditionKey, Status>> = {}): Record<ConditionKey, Status> {
  return { water: good, light: good, temp: good, nutrient: good, pest: good, ...over }
}

describe('deathCause', () => {
  it('death cause picks worst recent condition', () => {
    const w: Status = { level: 0, dir: 'high' }
    const h = [day({ water: w, light: { level: 2, dir: 'low' } }), day({ water: w }), day({ water: w })]
    expect(deathCause(h)).toBe('물을 너무 많이 줘서 뿌리가 썩었어요.')
  })

  it('uses the summed levels over the last 3 days', () => {
    // light: 1+1+1 = 3, temp: 0+4+4 = 8 → light wins
    const h = [
      day({ light: { level: 1, dir: 'high' }, temp: { level: 0, dir: 'low' } }),
      day({ light: { level: 1, dir: 'high' } }),
      day({ light: { level: 1, dir: 'high' } }),
    ]
    expect(deathCause(h)).toBe('강한 햇빛을 너무 오래 받아서 잎이 탔어요.')
  })

  it('ignores days older than the last 3', () => {
    const h = [
      day({ water: { level: 0, dir: 'low' } }),
      day({ water: { level: 0, dir: 'low' } }),
      day({ nutrient: { level: 1, dir: 'low' } }),
      day({ nutrient: { level: 1, dir: 'low' } }),
      day({ nutrient: { level: 1, dir: 'low' } }),
    ]
    expect(deathCause(h)).toBe('영양분이 부족해서 힘이 없었어요.')
  })

  it('works with a shorter history and maps each sentence', () => {
    expect(deathCause([day({ water: { level: 0, dir: 'low' } })])).toBe('물이 부족해서 말라 버렸어요.')
    expect(deathCause([day({ light: { level: 0, dir: 'low' } })])).toBe('햇빛을 오래 못 받아서 약해졌어요.')
    expect(deathCause([day({ temp: { level: 0, dir: 'low' } })])).toBe('너무 추워서 견디지 못했어요.')
    expect(deathCause([day({ temp: { level: 0, dir: 'high' } })])).toBe('너무 더워서 견디지 못했어요.')
    expect(deathCause([day({ nutrient: { level: 0, dir: 'high' } })])).toBe(
      '비료를 너무 많이 줘서 뿌리가 상했어요.',
    )
    expect(deathCause([day({ pest: { level: 0, dir: 'high' } })])).toBe(
      '벌레가 너무 많아져서 잎을 다 갉아 먹었어요.',
    )
  })

  it('treats notNeeded as fine (seed stage)', () => {
    const h = [day({ light: NN, nutrient: NN, pest: NN, temp: { level: 1, dir: 'low' } })]
    expect(deathCause(h)).toBe('너무 추워서 견디지 못했어요.')
  })
})
