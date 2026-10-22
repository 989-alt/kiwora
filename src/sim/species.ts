import type { Band } from './types'

export type SpeciesId =
  | 'balsam' | 'bean' | 'morningGlory' | 'rice' | 'corn'
  | 'apple' | 'dandelion' | 'forsythia' | 'persimmon'
export type StageId =
  | 'seed' | 'sprout' | 'leafStem' | 'grownTree' | 'flower'
  | 'fruit' | 'winter' | 'newShoot' | 'seedDone'
export type Phase = 'seed' | 'grow' | 'winter'
export type PhaseBands = { water: Band; light: Band; temp: Band; nutrient: Band }

export type Species = {
  id: SpeciesId
  name: string
  life: 'annual' | 'perennial'
  blurb: string
  stages: StageId[]
  transplant: boolean
  bands: Record<Phase, PhaseBands>
  /** About how long the real seed is, in mm (shown under the seed pictures). */
  seedMm: number
}

export const STAGE_POINTS = 4

export const STAGE_LABEL: Record<StageId, string> = {
  seed: '씨',
  sprout: '싹이 텄어요',
  leafStem: '잎과 줄기가 자라요',
  grownTree: '적당한 크기로 자라요',
  flower: '꽃이 피어요',
  fruit: '열매를 맺어요',
  winter: '겨울을 지내요',
  newShoot: '새순이 나와요',
  seedDone: '씨를 얻었어요',
}

export function phaseOf(stage: StageId): Phase {
  if (stage === 'seed') return 'seed'
  if (stage === 'winter') return 'winter'
  return 'grow'
}

const ANNUAL_STAGES: StageId[] = ['seed', 'sprout', 'leafStem', 'flower', 'fruit', 'seedDone']
const PERENNIAL_STAGES: StageId[] = [
  'seed', 'sprout', 'leafStem', 'grownTree', 'flower', 'fruit', 'winter', 'newShoot',
]

const GROW: PhaseBands = {
  water: { lo: 35, idealLo: 50, idealHi: 75, hi: 90, span: 15 },
  light: { lo: 45, idealLo: 60, idealHi: 85, hi: 95, span: 15 },
  temp: { lo: 16, idealLo: 20, idealHi: 26, hi: 30, span: 4 },
  nutrient: { lo: 20, idealLo: 35, idealHi: 65, hi: 85, span: 15 },
}

type BandOverride = Partial<Band>
type Override = Partial<Record<keyof PhaseBands, BandOverride>>

function copyBands(b: PhaseBands): PhaseBands {
  return {
    water: { ...b.water },
    light: { ...b.light },
    temp: { ...b.temp },
    nutrient: { ...b.nutrient },
  }
}

/** Builds the three phases from the defaults; `over` overrides grow values (seed copies them except its own temp base). */
function makeBands(over: Override = {}, spanScale = 1): Record<Phase, PhaseBands> {
  const apply = (base: PhaseBands): PhaseBands => {
    const out = copyBands(base)
    for (const k of Object.keys(over) as (keyof PhaseBands)[]) {
      out[k] = { ...out[k], ...over[k] }
    }
    return out
  }
  const grow = apply(GROW)

  // seed: water same as grow, temp has its own base; light/nutrient copied from grow (unused).
  const seed = copyBands(grow)
  seed.temp = { lo: 15, idealLo: 20, idealHi: 27, hi: 31, span: 4 }

  // winter: own water/nutrient/temp; light same as grow.
  const winter = copyBands(grow)
  winter.water = { lo: 15, idealLo: 20, idealHi: 40, hi: 55, span: 15 }
  winter.nutrient = { lo: 0, idealLo: 0, idealHi: 20, hi: 35, span: 15 }
  winter.temp = { lo: -5, idealLo: 0, idealHi: 10, hi: 15, span: 5 }

  const scale = (p: PhaseBands): PhaseBands => {
    if (spanScale === 1) return p
    for (const k of Object.keys(p) as (keyof PhaseBands)[]) p[k].span *= spanScale
    return p
  }
  return { seed: scale(seed), grow: scale(grow), winter: scale(winter) }
}

const SEED_MM: Record<SpeciesId, number> = {
  balsam: 3,
  bean: 15,
  morningGlory: 5,
  rice: 7,
  corn: 10,
  apple: 7,
  dandelion: 3,
  forsythia: 5,
  persimmon: 15,
}

function make(
  id: SpeciesId,
  name: string,
  life: Species['life'],
  blurb: string,
  transplant: boolean,
  over: Override = {},
  spanScale = 1,
): Species {
  return {
    id,
    name,
    life,
    blurb,
    transplant,
    stages: [...(life === 'annual' ? ANNUAL_STAGES : PERENNIAL_STAGES)],
    bands: makeBands(over, spanScale),
    seedMm: SEED_MM[id],
  }
}

export const SPECIES: Record<SpeciesId, Species> = {
  balsam: make('balsam', '봉숭아', 'annual', '여름에 예쁜 꽃이 피어요', false),
  bean: make('bean', '강낭콩', 'annual', '떡잎이 크고 빨리 자라요', false, {
    nutrient: { idealHi: 50 },
  }),
  morningGlory: make('morningGlory', '나팔꽃', 'annual', '햇빛을 아주 좋아해요', false, {
    light: { idealLo: 70, idealHi: 95, hi: 100 },
    temp: { idealLo: 22, idealHi: 28, hi: 32 },
  }),
  rice: make('rice', '벼', 'annual', '물을 아주 좋아해요', false, {
    water: { idealLo: 75, idealHi: 110, hi: 125 },
  }),
  corn: make('corn', '옥수수', 'annual', '따뜻하고 밝은 곳을 좋아해요', false, {
    light: { idealLo: 70, idealHi: 95, hi: 100 },
    temp: { idealLo: 22, idealHi: 28, hi: 32 },
  }),
  apple: make('apple', '사과나무', 'perennial', '여러 해 동안 열매를 맺어요', true, {
    light: { idealLo: 70, idealHi: 95, hi: 100 },
    temp: { idealHi: 27 },
  }),
  dandelion: make('dandelion', '민들레', 'perennial', '어디서나 잘 자라요', false, {}, 1.5),
  forsythia: make('forsythia', '개나리', 'perennial', '봄에 노란 꽃이 피어요', true),
  persimmon: make('persimmon', '감나무', 'perennial', '가을에 주황색 열매가 열려요', true, {
    light: { idealLo: 70, idealHi: 95, hi: 100 },
    temp: { idealHi: 27 },
  }),
}
