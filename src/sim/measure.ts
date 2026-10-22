import { CM_PER_POINT } from './day'
import { mulberry32 } from './rng'
import { SPECIES, STAGE_POINTS, type SpeciesId } from './species'

/** The ruler reading the student must pick: the plant's height to the nearest cm, at least 1. */
export function measureAnswer(heightCm: number): number {
  return Math.max(1, Math.round(heightCm))
}

/**
 * The three ruler readings offered (ascending, distinct, all at least 1), one of them measureAnswer:
 * 2 cm apart for a plant under 10 cm, else 5 cm. The seed picks where the answer sits among them.
 */
export function rulerChoices(heightCm: number, seed: number): number[] {
  const a = measureAnswer(heightCm)
  const gap = heightCm < 10 ? 2 : 5
  const sets = [0, 1, 2].map((k) => [0, 1, 2].map((i) => a + (i - k) * gap)).filter((s) => s[0] >= 1)
  return sets[Math.floor(mulberry32(seed)() * sets.length)]
}

/** Ruler marks for the drawn cm size: a small mark every `minor` cm, a number every `label` cm. */
export function rulerTicks(pxPerCm: number): { minor: 1 | 2 | 5; label: 5 | 10 } {
  if (pxPerCm >= 8) return { minor: 1, label: 5 }
  if (pxPerCm >= 4) return { minor: 2, label: 5 }
  return { minor: 5, label: 10 }
}

/**
 * The height (cm) a plant reaches at the start of the last stage it can have in that place: the final stage,
 * or, for a tree still in its pot, the young-tree stage (it moves to the yard then). The picture of a plant at
 * this height fills the room the scene has for it, so one cm keeps the same size there on every day.
 */
export function fullHeightCm(id: SpeciesId, yard: boolean): number {
  const sp = SPECIES[id]
  const last = sp.transplant && !yard ? sp.stages.indexOf('grownTree') + 1 : sp.stages.length - 1
  // no height is gained in the seed stage
  return (last - 1) * STAGE_POINTS * CM_PER_POINT
}
