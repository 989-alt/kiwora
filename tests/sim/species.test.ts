import { describe, expect, it } from 'vitest'
import { phaseOf, SPECIES, STAGE_LABEL, STAGE_POINTS } from '../../src/sim/species'

const all = Object.values(SPECIES)

describe('species data', () => {
  it('has 9 species: 5 annual, 4 perennial', () => {
    expect(all).toHaveLength(9)
    expect(all.filter((s) => s.life === 'annual')).toHaveLength(5)
    expect(all.filter((s) => s.life === 'perennial')).toHaveLength(4)
  })

  it('every species knows how big its real seed is (mm)', () => {
    const mm = Object.fromEntries(all.map((s) => [s.id, s.seedMm]))
    expect(mm).toEqual({
      balsam: 3, bean: 15, morningGlory: 5, rice: 7, corn: 10, apple: 7, dandelion: 3, forsythia: 5, persimmon: 15,
    })
  })

  it('stage lists', () => {
    for (const s of all) {
      if (s.life === 'annual') {
        expect(s.stages).toEqual(['seed', 'sprout', 'leafStem', 'flower', 'fruit', 'seedDone'])
      } else {
        expect(s.stages).toEqual([
          'seed', 'sprout', 'leafStem', 'grownTree', 'flower', 'fruit', 'winter', 'newShoot',
        ])
      }
    }
  })

  it('transplant species', () => {
    const ids = all.filter((s) => s.transplant).map((s) => s.id).sort()
    expect(ids).toEqual(['apple', 'forsythia', 'persimmon'])
  })

  it('every band is ordered lo <= idealLo <= idealHi <= hi', () => {
    for (const s of all) {
      for (const phase of ['seed', 'grow', 'winter'] as const) {
        for (const b of Object.values(s.bands[phase])) {
          expect(b.lo).toBeLessThanOrEqual(b.idealLo)
          expect(b.idealLo).toBeLessThanOrEqual(b.idealHi)
          expect(b.idealHi).toBeLessThanOrEqual(b.hi)
          expect(b.span).toBeGreaterThan(0)
        }
      }
    }
  })

  it('species differences', () => {
    expect(SPECIES.rice.bands.grow.water.idealLo).toBeGreaterThan(SPECIES.balsam.bands.grow.water.idealLo)
    expect(SPECIES.rice.bands.grow.water).toMatchObject({ idealLo: 75, idealHi: 110, hi: 125 })
    expect(SPECIES.corn.bands.grow.light.idealLo).toBe(70)
    expect(SPECIES.morningGlory.bands.grow.temp.idealLo).toBe(22)
    expect(SPECIES.bean.bands.grow.nutrient.idealHi).toBe(50)
    expect(SPECIES.apple.bands.grow.light.idealLo).toBe(70)
    expect(SPECIES.persimmon.bands.grow.light.idealLo).toBe(70)
    // light lovers: window (90) is ideal; tuned in Task 4 fix round 1
    for (const id of ['morningGlory', 'corn', 'apple', 'persimmon'] as const) {
      expect(SPECIES[id].bands.grow.light).toMatchObject({ idealLo: 70, idealHi: 95, hi: 100 })
    }
    expect(SPECIES.corn.bands.grow.temp).toMatchObject({ idealLo: 22, idealHi: 28, hi: 32 })
    expect(SPECIES.morningGlory.bands.grow.temp).toMatchObject({ idealLo: 22, idealHi: 28, hi: 32 })
    expect(SPECIES.apple.bands.grow.temp.idealHi).toBe(27)
    expect(SPECIES.persimmon.bands.grow.temp.idealHi).toBe(27)
    expect(SPECIES.dandelion.bands.grow.water.span).toBe(22.5)
    expect(SPECIES.dandelion.bands.winter.temp.span).toBe(7.5)
    expect(SPECIES.balsam.bands.seed.temp).toEqual({ lo: 15, idealLo: 20, idealHi: 27, hi: 31, span: 4 })
    expect(SPECIES.balsam.bands.winter.temp).toEqual({ lo: -5, idealLo: 0, idealHi: 10, hi: 15, span: 5 })
  })

  it('names and blurbs', () => {
    expect(SPECIES.apple.name).toBe('사과나무')
    expect(SPECIES.persimmon.blurb).toBe('가을에 주황색 열매를 맺어요')
  })

  it('phaseOf, labels, points', () => {
    expect(phaseOf('seed')).toBe('seed')
    expect(phaseOf('winter')).toBe('winter')
    expect(phaseOf('flower')).toBe('grow')
    expect(STAGE_LABEL.newShoot).toBe('새순이 나와요')
    expect(STAGE_LABEL.seedDone).toBe('씨를 얻었어요')
    expect(STAGE_POINTS).toBe(4)
  })
})
