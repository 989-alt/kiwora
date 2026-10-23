import { OBSERVATIONS } from '../../src/data/observations'
import { measureAnswer } from '../../src/sim/measure'
import type { PendingObs } from '../../src/sim/save'
import { SPECIES } from '../../src/sim/species'
import type { PlantState } from '../../src/sim/types'
import { rulerFits } from '../../src/ui/remaining'

/**
 * Today's observing already done for this plant (a true magnifier sentence, the ruler read when it is out),
 * so a test can end the day without the '남은 활동' bubble stopping it.
 */
export function doneObs(p: PlantState): PendingObs {
  const set = OBSERVATIONS[p.speciesId][SPECIES[p.speciesId].stages[p.stageIndex]]
  return {
    ...(set ? { observed: set.yes[0] } : {}),
    ...(rulerFits(p) ? { measuredCm: measureAnswer(p.heightCm), measureHelped: false } : {}),
  }
}
