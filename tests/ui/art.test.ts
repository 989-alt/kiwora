import { describe, expect, test } from 'vitest'
import { bugSpots, plantArt, type PlantArt } from '../../src/ui/art'

const real = (a: Partial<PlantArt['a']>): PlantArt => ({
  src: '/plants/x/flower.webp',
  real: true,
  a: { w: 768, h: 1024, stemX: 380, stemY: 1000, top: 40, left: 100, right: 700, ...a },
})

describe('bugSpots', () => {
  test('stand-in picture: undefined, so Bugs uses its own LEAF_SPOTS', () => {
    expect(bugSpots(plantArt('bean', 'flower'))).toBeUndefined()
  })

  test('measured spots are used as they are', () => {
    const spots: [number, number][] = [[200, 300]]
    expect(bugSpots(real({ spots }))).toBe(spots)
  })

  test('a real picture without measured spots gets points inside its own bbox', () => {
    for (const none of [undefined, []]) {
      const pts = bugSpots(real({ spots: none }))!
      expect(pts.length).toBeGreaterThanOrEqual(8)
      for (const [x, y] of pts) {
        expect(x).toBeGreaterThan(100)
        expect(x).toBeLessThan(700)
        expect(y).toBeGreaterThan(40)
        expect(y).toBeLessThan(1000)
      }
    }
  })
})
