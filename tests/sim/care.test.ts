import { describe, expect, it } from 'vitest'
import { careReady, careTasks, isOutdoor, pendingCare } from '../../src/sim/care'
import { newPlant } from '../../src/sim/day'
import { SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { CareTaskId } from '../../src/sim/types'

const at = (id: SpeciesId, stage: StageId, over: Partial<ReturnType<typeof newPlant>> = {}) => ({
  ...newPlant(id),
  stageIndex: SPECIES[id].stages.indexOf(stage),
  ...over,
})

/** Spec §5 table: one care task per stage (transplanting is the v1 transplant screen, not a care task). */
const TABLE: Record<SpeciesId, Partial<Record<StageId, CareTaskId[]>>> = {
  balsam: { seed: ['sow'], sprout: ['thin'], leafStem: ['pinch'], flower: ['pollinate'], fruit: ['harvestSeed'], seedDone: [] },
  bean: { seed: ['sow'], sprout: ['thin'], leafStem: ['stake'], flower: ['pollinate'], fruit: ['harvestSeed'], seedDone: [] },
  morningGlory: { seed: ['sow'], sprout: ['thin'], leafStem: ['stakeTwine'], flower: ['pollinate'], fruit: ['harvestSeed'], seedDone: [] },
  rice: { seed: ['sow'], sprout: ['thin'], leafStem: ['hillUp'], flower: ['shakePollen'], fruit: ['harvestSeed'], seedDone: [] },
  corn: { seed: ['sow'], sprout: ['thin'], leafStem: ['hillUp'], flower: ['shakePollen'], fruit: ['harvestSeed'], seedDone: [] },
  apple: {
    seed: ['sow'], sprout: ['thin'], leafStem: ['drainCheck'], grownTree: ['prune'], flower: ['pollinate'],
    fruit: ['harvest'], winter: ['winterWrap'], newShoot: [],
  },
  persimmon: {
    seed: ['sow'], sprout: ['thin'], leafStem: ['drainCheck'], grownTree: ['prune'], flower: ['pollinate'],
    fruit: ['harvest'], winter: ['winterWrap'], newShoot: [],
  },
  forsythia: {
    seed: ['sow'], sprout: ['thin'], leafStem: ['drainCheck'], grownTree: ['prune'], flower: ['pollinate'],
    fruit: ['harvest'], winter: ['winterWrap'], newShoot: [],
  },
  dandelion: {
    seed: ['sow'], sprout: ['thin'], leafStem: ['drainCheck'], grownTree: [], flower: ['pollinate'],
    fruit: ['harvest'], winter: ['moveIn'], newShoot: [],
  },
}

const ALL = Object.keys(SPECIES) as SpeciesId[]

describe('care tasks', () => {
  it('every non-final stage of every species has the table\'s task', () => {
    const got = Object.fromEntries(
      ALL.map((id) => [id, Object.fromEntries(SPECIES[id].stages.map((st) => [st, careTasks(id, st)]))]),
    )
    expect(got).toEqual(TABLE)
    // each non-final stage has exactly one task, except the dandelion's grownTree
    for (const id of ALL) {
      const stages = SPECIES[id].stages
      for (const st of stages.slice(0, -1)) {
        expect(careTasks(id, st).length, `${id} ${st}`).toBe(id === 'dandelion' && st === 'grownTree' ? 0 : 1)
      }
      expect(careTasks(id, stages[stages.length - 1])).toEqual([])
    }
  })

  it('careReady and pendingCare follow careDone', () => {
    const s = at('bean', 'flower')
    expect(careReady(s)).toBe(false)
    expect(pendingCare(s)).toBe('pollinate')
    expect(careReady({ ...s, careDone: 1 })).toBe(true)
    expect(pendingCare({ ...s, careDone: 1 })).toBeNull()
    // nothing to do at the final stage or at the dandelion's grownTree
    expect(careReady(at('bean', 'seedDone'))).toBe(true)
    expect(pendingCare(at('bean', 'seedDone'))).toBeNull()
    expect(careReady(at('dandelion', 'grownTree'))).toBe(true)
    expect(pendingCare(at('dandelion', 'grownTree'))).toBeNull()
  })

  it('prune waits for the yard', () => {
    for (const id of ['apple', 'persimmon', 'forsythia'] as const) {
      const indoors = at(id, 'grownTree', { place: 'window' })
      expect(pendingCare(indoors), id).toBeNull()
      expect(careReady(indoors), id).toBe(false) // still needed before the stage can change
      for (const place of ['yardSunny', 'yardPartial', 'yardShade'] as const) {
        expect(pendingCare({ ...indoors, place }), `${id} ${place}`).toBe('prune')
        expect(pendingCare({ ...indoors, place, careDone: 1 }), `${id} ${place}`).toBeNull()
      }
    }
  })

  it('isOutdoor: transplant species from grownTree on', () => {
    for (const id of ALL) {
      const sp = SPECIES[id]
      sp.stages.forEach((st, i) => {
        const want = sp.transplant && i >= sp.stages.indexOf('grownTree')
        expect(isOutdoor(at(id, st)), `${id} ${st}`).toBe(want)
      })
    }
    expect(isOutdoor(at('apple', 'leafStem'))).toBe(false)
    expect(isOutdoor(at('apple', 'grownTree'))).toBe(true)
    expect(isOutdoor(at('apple', 'winter'))).toBe(true)
    expect(isOutdoor(at('dandelion', 'winter'))).toBe(false)
    expect(isOutdoor(at('bean', 'flower'))).toBe(false)
  })
})
