import { describe, expect, test } from 'vitest'
import data from '../../public/anchors.json'
import type { SpeciesId, StageId } from '../../src/sim/species'
import { BUG_SLOTS, bugSpots, plantArt, type PlantArt } from '../../src/ui/art'

const real = (a: Partial<PlantArt['a']>): PlantArt => ({
  src: '/plants/x/flower.webp',
  real: true,
  a: { w: 768, h: 1024, stemX: 380, stemY: 1000, top: 40, left: 100, right: 700, ...a },
})

const inside = (pts: [number, number][], left: number, right: number, top: number, bottom: number) => {
  for (const [x, y] of pts) {
    expect(x).toBeGreaterThan(left)
    expect(x).toBeLessThan(right)
    expect(y).toBeGreaterThan(top)
    expect(y).toBeLessThan(bottom)
  }
}

describe('bugSpots', () => {
  test('stand-in picture: undefined, so Bugs uses its own LEAF_SPOTS', () => {
    expect(bugSpots(plantArt('balsam', 'winter'))).toBeUndefined()
  })

  test('measured spots come first, then the list is padded to 12 places', () => {
    const spots: [number, number][] = [
      [200, 300],
      [400, 500],
      [600, 700],
    ]
    const r = bugSpots(real({ spots }))!
    expect(r.measured).toBe(3)
    expect(r.points).toHaveLength(BUG_SLOTS)
    expect(r.points.slice(0, 3)).toEqual(spots)
    inside(r.points, 100, 700, 40, 1000)
    // no two places exactly on top of each other
    expect(new Set(r.points.map((p) => p.join(','))).size).toBe(BUG_SLOTS)
  })

  test('a real picture without measured spots gets 12 points inside its own bbox', () => {
    for (const none of [undefined, []]) {
      const r = bugSpots(real({ spots: none }))!
      expect(r.points).toHaveLength(BUG_SLOTS)
      inside(r.points, 100, 700, 40, 1000)
    }
  })

  test('every shipped plant picture offers 12 bug places inside its picture', () => {
    const files = data.files as Record<string, { kind: string; w: number; h: number }>
    for (const [rel, f] of Object.entries(files)) {
      if (f.kind !== 'plant') continue
      const [, id, file] = rel.split('/')
      const r = bugSpots(plantArt(id as SpeciesId, file.replace('.webp', '') as StageId))!
      expect(r.points, rel).toHaveLength(BUG_SLOTS)
      inside(r.points, 0, f.w, 0, f.h)
    }
  })
})
