import { describe, expect, test } from 'vitest'
import data from '../../public/anchors.json'
import type { SpeciesId, StageId } from '../../src/sim/species'
import { BUG_SLOTS, bugSpots, plantArt, propArt, weatherArt, type PlantArt, type PropName } from '../../src/ui/art'

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

describe('propArt / weatherArt', () => {
  test('a prop with a measured anchor is real and points at props/<name>.webp', () => {
    const files = data.files as Record<string, { kind: string }>
    const names: PropName[] = ['moon', 'seedPacket', 'brush', 'stake', 'twine', 'straw', 'shears', 'dryBranch', 'soilScoop', 'magnifier', 'drainDish']
    for (const n of names) {
      const art = propArt(n)
      expect(art.src.endsWith(`props/${n}.webp`)).toBe(true)
      const measured = `props/${n}.webp` in files
      expect(art.real).toBe(measured)
      if (measured) {
        const [l, t, r, b] = art.bbox
        expect(r).toBeGreaterThan(l)
        expect(b).toBeGreaterThan(t)
        expect(art.w).toBeGreaterThan(0)
      }
    }
    expect(propArt('moon').real).toBe(true)
  })

  test('a prop without an anchor is not real and gets the full 512 box', () => {
    const art = propArt('nope' as PropName)
    expect(art.real).toBe(false)
    expect(art.bbox).toEqual([0, 0, 511, 511])
    expect([art.w, art.h]).toEqual([512, 512])
  })

  test('weather icons point at weather/<kind>.webp', () => {
    const files = data.files as Record<string, { kind: string }>
    for (const k of ['heat', 'rain', 'monsoon', 'typhoon', 'cold', 'frost'] as const) {
      const art = weatherArt(k)
      expect(art.src.endsWith(`weather/${k}.webp`)).toBe(true)
      expect(art.real).toBe(`weather/${k}.webp` in files)
    }
  })
})
