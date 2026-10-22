import { SPECIES, type SpeciesId, type StageId } from './species'
import type { CareTaskId, Place, PlantState } from './types'

/** leafStem care differs by species (spec §5): how the stem grows decides what the plant needs. */
const LEAF_STEM: Record<SpeciesId, CareTaskId> = {
  morningGlory: 'stakeTwine',
  bean: 'stake',
  rice: 'hillUp',
  corn: 'hillUp',
  balsam: 'pinch',
  apple: 'drainCheck',
  persimmon: 'drainCheck',
  forsythia: 'drainCheck',
  dandelion: 'drainCheck',
}

/**
 * The care tasks of a stage, in the order they must be done (spec §5 table). Moving a tree to the yard is
 * the v1 transplant screen, not a care task; the tree's 'prune' comes after it.
 */
export function careTasks(id: SpeciesId, stage: StageId): CareTaskId[] {
  const sp = SPECIES[id]
  switch (stage) {
    case 'seed':
      return ['sow']
    case 'sprout':
      return ['thin']
    case 'leafStem':
      return [LEAF_STEM[id]]
    case 'grownTree':
      return sp.transplant ? ['prune'] : []
    case 'flower':
      return id === 'rice' || id === 'corn' ? ['shakePollen'] : ['pollinate']
    case 'fruit':
      return sp.life === 'annual' ? ['harvestSeed'] : ['harvest']
    case 'winter':
      return sp.transplant ? ['winterWrap'] : ['moveIn']
    case 'newShoot':
    case 'seedDone':
      return []
  }
}

const stageOf = (p: PlantState): StageId => SPECIES[p.speciesId].stages[p.stageIndex]
const isYard = (place: Place) => place === 'yardSunny' || place === 'yardPartial' || place === 'yardShade'

/** All of the current stage's care is done, so the stage may change once growth reaches the threshold. */
export function careReady(p: PlantState): boolean {
  return p.careDone >= careTasks(p.speciesId, stageOf(p)).length
}

/** The care task to do next, or null. A tree is pruned only after it has been moved to the yard. */
export function pendingCare(p: PlantState): CareTaskId | null {
  const next = careTasks(p.speciesId, stageOf(p))[p.careDone]
  if (next === undefined) return null
  if (next === 'prune' && !isYard(p.place)) return null
  return next
}

/** A transplanted species from 'grownTree' on: it lives in the yard (also on the night it waits to move). */
export function isOutdoor(p: PlantState): boolean {
  const sp = SPECIES[p.speciesId]
  return sp.transplant && p.stageIndex >= sp.stages.indexOf('grownTree')
}
