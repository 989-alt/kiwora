import { mulberry32 } from '../sim/rng'
import type { SpeciesId, StageId } from '../sim/species'

/**
 * Observation sentences for the magnifier, per species and stage: `part` is the part of the picture the
 * magnifier shows ('seed' = the seed picture), `yes` are true for that species and stage (textbook level,
 * 3rd-grade science), `no` are clearly wrong for it (colour, shape or number changed). Short 해요체, no species
 * names (the student picks what they see, not what the plant is called), at most 28 letters.
 */
export type ObsPart = 'seed' | 'leaf' | 'stem' | 'flower' | 'fruit'
export type ObsSet = { part: ObsPart; yes: string[]; no: string[] }

const set = (part: ObsPart, yes: string[], no: string[]): ObsSet => ({ part, yes, no })

// Shared by the trees and the dandelion where the facts are the same.
const DICOT_SPROUT_NO = ['떡잎이 한 장만 나와요', '떡잎이 바늘처럼 가늘어요']
const TREE_GROWN = set('stem', ['줄기가 굵고 단단해요', '가지가 여러 개로 나뉘어요'], ['줄기가 풀처럼 물렁해요', '가지 없이 줄기 하나뿐이에요'])
const TREE_WINTER = set('stem', ['잎이 모두 떨어졌어요', '가지에 겨울눈이 있어요'], ['잎이 초록색 그대로 있어요', '가지마다 꽃이 활짝 폈어요'])

export const OBSERVATIONS: Record<SpeciesId, Partial<Record<StageId, ObsSet>>> = {
  balsam: {
    seed: set('seed', ['씨가 작고 둥글어요', '씨가 짙은 갈색이에요'], ['씨가 길쭉한 세모 모양이에요', '씨가 하얀색이에요']),
    sprout: set('leaf', ['떡잎 두 장이 나와요', '떡잎이 둥글어요'], ['떡잎이 한 장만 나와요', '떡잎이 바늘처럼 가늘어요']),
    leafStem: set(
      'leaf',
      ['잎 가장자리가 톱니 모양이에요', '잎이 길쭉하고 끝이 뾰족해요'],
      ['잎 가장자리가 매끈해요', '잎이 둥글고 잎맥이 나란해요'],
    ),
    flower: set(
      'flower',
      ['잎겨드랑이에 꽃이 매달려 펴요', '꽃 색깔이 분홍색이나 빨간색이에요'],
      ['꽃이 줄기 끝에 한 송이만 펴요', '꽃이 파란 나팔 모양이에요'],
    ),
    fruit: set(
      'fruit',
      ['열매에 잔털이 나 있어요', '꽃이 진 자리에 열매가 생겨요'],
      ['열매가 크고 빨간 공 모양이에요', '열매가 땅속에서 자라요'],
    ),
    seedDone: set(
      'seed',
      ['익은 열매가 터지면 씨가 튀어요', '작고 둥근 씨를 얻어요'],
      ['씨가 열매 밖에 붙어 있어요', '씨가 길고 납작해요'],
    ),
  },
  bean: {
    seed: set('seed', ['씨가 길쭉하고 둥근 모양이에요', '씨에 얼룩무늬가 있어요'], ['씨가 세모 모양이에요', '씨 껍질에 털이 많아요']),
    sprout: set('leaf', ['떡잎 두 장이 먼저 나와요', '떡잎이 두껍고 통통해요'], ['떡잎이 한 장만 나와요', '떡잎이 가늘고 길어요']),
    leafStem: set(
      'leaf',
      ['잎이 넓고 끝이 뾰족해요', '본잎이 나고 줄기가 길어져요'],
      ['잎이 바늘처럼 가늘어요', '잎맥이 나란히 뻗어 있어요'],
    ),
    flower: set('flower', ['작은 꽃이 여러 송이 펴요', '꽃이 나비 모양이에요'], ['꽃이 나팔 모양으로 커요', '꽃잎이 노랗고 아주 커요']),
    fruit: set('fruit', ['꼬투리 안에 씨가 들어 있어요', '열매가 길쭉한 꼬투리예요'], ['열매가 둥근 공 모양이에요', '꼬투리 안이 텅 비어 있어요']),
    seedDone: set(
      'seed',
      ['꼬투리가 마르면 씨를 얻어요', '심었던 씨와 닮은 씨예요'],
      ['씨가 꼬투리 밖에 붙어 있어요', '얻은 씨가 세모 모양이에요'],
    ),
  },
  morningGlory: {
    seed: set('seed', ['씨가 검은색이에요', '씨가 귤 조각 모양이에요'], ['씨가 하얗고 납작해요', '씨가 동그란 공 모양이에요']),
    sprout: set('leaf', ['떡잎 두 장이 나와요', '떡잎이 나비 모양이에요'], ['떡잎이 한 장만 나와요', '떡잎이 바늘처럼 가늘어요']),
    leafStem: set(
      'stem',
      ['줄기가 다른 것을 감으며 올라가요', '잎이 하트 모양이에요'],
      ['줄기가 혼자 곧게 서 있어요', '잎맥이 나란해요'],
    ),
    flower: set('flower', ['꽃이 나팔 모양이에요', '꽃이 아침에 피고 낮에 오므라들어요'], ['꽃이 노란 별 모양이에요', '꽃잎이 따로따로 떨어져 있어요']),
    fruit: set(
      'fruit',
      ['꽃이 진 자리에 둥근 열매가 생겨요', '열매 속에 씨가 여러 개 있어요'],
      ['열매가 길쭉한 꼬투리예요', '열매 속에 씨가 하나도 없어요'],
    ),
    seedDone: set('seed', ['열매가 마르면 검은 씨가 나와요', '열매가 갈색으로 말라요'], ['씨가 하얀색으로 바뀌어요', '씨가 동그란 공 모양이에요']),
  },
  rice: {
    seed: set('seed', ['씨가 길쭉한 타원 모양이에요', '씨가 껍질에 싸여 있어요'], ['씨가 동그랗고 검은색이에요', '씨가 납작한 하트 모양이에요']),
    sprout: set('leaf', ['싹이 가늘고 뾰족하게 나와요', '잎이 가늘고 길게 자라요'], ['둥근 떡잎 두 장이 나와요', '떡잎이 하트 모양이에요']),
    leafStem: set('leaf', ['잎이 가늘고 길어요', '잎맥이 나란해요'], ['잎맥이 그물 모양이에요', '잎이 둥글고 넓적해요']),
    flower: set('flower', ['이삭에 작은 꽃이 많이 달려요', '꽃이 작고 꽃잎이 없어요'], ['크고 화려한 꽃잎이 있어요', '꽃이 한 송이만 크게 펴요']),
    fruit: set('fruit', ['이삭에 낟알이 많이 달려요', '익으면 이삭이 고개를 숙여요'], ['열매가 땅속에서 자라요', '익으면 이삭이 꼿꼿이 서요']),
    seedDone: set('seed', ['낟알이 누렇게 익어요', '익은 낟알이 씨가 돼요'], ['낟알이 파랗게 변해요', '낟알 속이 텅 비어 있어요']),
  },
  corn: {
    seed: set('seed', ['씨가 노란색이에요', '씨가 납작하고 한쪽이 뾰족해요'], ['씨가 까맣고 길쭉해요', '씨에 털이 덮여 있어요']),
    sprout: set('leaf', ['싹이 뾰족하고 길쭉해요', '잎이 돌돌 말려 나와요'], ['둥근 떡잎 두 장이 나와요', '잎이 하트 모양이에요']),
    leafStem: set('leaf', ['잎이 길고 잎맥이 나란해요', '줄기가 굵고 곧게 자라요'], ['잎맥이 그물 모양이에요', '줄기가 다른 것을 감고 올라가요']),
    flower: set('flower', ['줄기 끝에 수꽃이 펴요', '암꽃에 수염이 길게 나요'], ['꽃이 나팔 모양이에요', '꽃잎이 크고 빨간색이에요']),
    fruit: set('fruit', ['껍질 속에 알갱이가 줄지어 있어요', '열매 끝에 수염이 나 있어요'], ['열매가 땅속에서 자라요', '알갱이가 껍질 밖에 흩어져 있어요']),
    seedDone: set('seed', ['익은 알갱이가 단단해져요', '알갱이 하나하나가 씨예요'], ['알갱이가 물렁하게 녹아요', '알갱이가 파랗게 변해요']),
  },
  apple: {
    seed: set('seed', ['씨가 갈색이에요', '씨가 물방울 모양이에요'], ['씨가 하얗고 동그래요', '씨에 솜털이 달려 있어요']),
    sprout: set('leaf', ['떡잎 두 장이 나와요', '떡잎이 타원 모양이에요'], DICOT_SPROUT_NO),
    leafStem: set('leaf', ['잎 가장자리에 톱니가 있어요', '잎이 달걀 모양이에요'], ['잎맥이 나란해요', '잎이 바늘처럼 가늘어요']),
    grownTree: TREE_GROWN,
    flower: set('flower', ['흰색이나 연분홍색 꽃이 펴요', '꽃잎이 다섯 장이에요'], ['꽃잎이 노랗고 네 장이에요', '꽃이 나팔 모양이에요']),
    fruit: set('fruit', ['열매가 둥글어요', '열매가 빨갛게 익어요'], ['열매가 길쭉한 꼬투리예요', '열매가 땅속에서 자라요']),
    winter: TREE_WINTER,
    newShoot: set('stem', ['겨울눈에서 새순이 나와요', '가지에 연두색 새잎이 나요'], ['새잎이 갈색으로 말라 있어요', '가지가 모두 없어졌어요']),
  },
  dandelion: {
    seed: set('seed', ['씨에 하얀 솜털이 달려 있어요', '씨가 작고 길쭉해요'], ['씨가 크고 둥글어요', '씨에 털이 하나도 없어요']),
    sprout: set('leaf', ['떡잎 두 장이 나와요', '떡잎이 작고 둥글어요'], DICOT_SPROUT_NO),
    leafStem: set('leaf', ['잎 가장자리가 깊게 갈라져요', '잎이 땅 가까이 둥글게 퍼져요'], ['잎 가장자리가 매끈해요', '잎이 줄기를 감고 올라가요']),
    grownTree: set('leaf', ['잎이 많아지고 길어져요', '잎이 땅 가까이 둥글게 퍼져요'], ['잎이 하나도 없어요', '잎이 바늘처럼 가늘어요']),
    flower: set('flower', ['노란색 꽃이 펴요', '작은 꽃이 모여 한 송이 같아요'], ['꽃이 파란색이에요', '꽃이 나팔 모양이에요']),
    fruit: set('fruit', ['솜털 달린 씨가 둥글게 모여요', '바람이 불면 씨가 날아가요'], ['열매가 빨갛고 둥글어요', '씨가 무거워서 날지 못해요']),
    winter: set('leaf', ['잎이 땅에 납작 붙어 있어요', '추워도 뿌리는 살아 있어요'], ['잎이 하늘로 높이 자라요', '꽃이 활짝 피어 있어요']),
    newShoot: set('leaf', ['가운데에서 새잎이 돋아요', '봄이 되어 새잎이 나요'], ['새잎이 하나도 나지 않아요', '새잎이 갈색이에요']),
  },
  forsythia: {
    seed: set('seed', ['씨가 납작하고 얇아요', '씨에 얇은 날개가 있어요'], ['씨가 크고 동그래요', '씨에 솜털이 달려 있어요']),
    sprout: set('leaf', ['떡잎 두 장이 나와요', '떡잎이 둥근 타원 모양이에요'], DICOT_SPROUT_NO),
    leafStem: set('leaf', ['잎이 두 장씩 마주 나요', '잎 가장자리에 톱니가 있어요'], ['잎맥이 나란해요', '잎이 바늘처럼 가늘어요']),
    grownTree: set('stem', ['가지가 길게 늘어져요', '가지가 여러 개로 나뉘어요'], ['줄기 하나만 곧게 서 있어요', '가지가 풀처럼 물렁해요']),
    flower: set('flower', ['노란색 꽃이 펴요', '잎보다 꽃이 먼저 펴요'], ['꽃이 빨간색이에요', '꽃이 하얀 공 모양이에요']),
    fruit: set('fruit', ['꽃이 진 자리에 열매가 생겨요', '열매 끝이 뾰족해요'], ['열매가 빨갛고 둥글어요', '열매가 땅속에서 자라요']),
    winter: TREE_WINTER,
    newShoot: set('stem', ['봄에 노란 꽃이 다시 펴요', '가지에서 새순이 돋아요'], ['가지가 모두 말라 없어졌어요', '꽃이 파란색이에요']),
  },
  persimmon: {
    seed: set('seed', ['씨가 갈색이에요', '씨가 납작한 타원 모양이에요'], ['씨가 하얗고 동그래요', '씨에 솜털이 달려 있어요']),
    sprout: set('leaf', ['떡잎 두 장이 나와요', '떡잎이 타원 모양이에요'], DICOT_SPROUT_NO),
    leafStem: set('leaf', ['잎이 넓고 반질반질해요', '잎 가장자리가 매끈해요'], ['잎맥이 나란해요', '잎 가장자리가 깊게 갈라져요']),
    grownTree: TREE_GROWN,
    flower: set('flower', ['연한 노란색 꽃이 펴요', '꽃이 작고 꽃받침이 커요'], ['꽃이 파란색이에요', '꽃이 나팔 모양으로 아주 커요']),
    fruit: set('fruit', ['열매가 주황색으로 익어요', '열매 꼭지에 꽃받침이 있어요'], ['열매가 길쭉한 꼬투리예요', '열매가 파랗게 익어요']),
    winter: TREE_WINTER,
    newShoot: set('stem', ['겨울눈에서 새순이 나와요', '가지에 연두색 새잎이 나요'], ['새잎이 갈색으로 말라 있어요', '가지가 모두 없어졌어요']),
  },
}

/** True when `text` is one of the true sentences of that species and stage. */
export function isTrueObservation(id: SpeciesId, stage: StageId, text: string): boolean {
  return OBSERVATIONS[id]?.[stage]?.yes.includes(text) ?? false
}

/** Three sentences to pick from (one true, two false), picked and shuffled by the seed. */
export function observeChoices(id: SpeciesId, stage: StageId, seed: number): { options: string[]; answer: string } {
  const s = OBSERVATIONS[id][stage]
  if (!s) return { options: [], answer: '' }
  const rnd = mulberry32(seed)
  const shuffle = <T,>(xs: T[]): T[] => {
    const out = [...xs]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  const answer = s.yes[Math.floor(rnd() * s.yes.length)]
  return { options: shuffle([answer, ...shuffle(s.no).slice(0, 2)]), answer }
}
