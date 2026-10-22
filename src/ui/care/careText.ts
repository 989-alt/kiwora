import type { CareTaskId } from '../../sim/types'

/**
 * Words of each stage care task: `todo` = the '오늘 할 일' line, `waiting` = the line once the plant has grown
 * enough and only waits for this care, `did` = the word for the journal's '한 일'.
 */
export const CARE_TEXT: Record<CareTaskId, { todo: string; waiting: string; did: string }> = {
  sow: { todo: '씨를 2~3알 심고 흙을 덮어 주세요', waiting: '씨를 심어야 싹이 터요', did: '씨 심기' },
  thin: { todo: '약한 싹을 뽑아 하나만 남겨요', waiting: '솎아 줘야 잎과 줄기가 잘 자라요', did: '솎아내기' },
  stake: { todo: '지지대를 세워 줘요', waiting: '지지대가 있어야 쓰러지지 않아요', did: '지지대 세우기' },
  stakeTwine: {
    todo: '지지대를 세우고 덩굴을 감아 줘요',
    waiting: '덩굴이 감고 올라갈 곳이 필요해요',
    did: '덩굴 감기',
  },
  hillUp: { todo: '포기 사이에 흙을 북돋아 줘요', waiting: '흙을 북돋아 줘야 쓰러지지 않아요', did: '흙 북돋우기' },
  pinch: { todo: '곁가지를 정리해 줘요', waiting: '곁가지를 정리해야 꽃이 잘 피어요', did: '곁가지 정리' },
  drainCheck: {
    todo: '화분 밑으로 물이 잘 빠지는지 살펴요',
    waiting: '물이 잘 빠져야 뿌리가 튼튼해요',
    did: '물 빠짐 살피기',
  },
  prune: { todo: '마른 가지를 잘라 줘요', waiting: '가지치기를 해야 튼튼하게 자라요', did: '가지치기' },
  pollinate: {
    todo: '붓으로 꽃가루를 다른 꽃에 옮겨요',
    waiting: '꽃가루를 옮겨 줘야 열매가 열려요',
    did: '꽃가루 옮기기',
  },
  shakePollen: { todo: '포기를 흔들어 꽃가루를 날려요', waiting: '꽃가루가 날려야 열매가 열려요', did: '꽃가루 날리기' },
  harvestSeed: { todo: '열매를 따서 씨를 받아요', waiting: '씨를 받으면 한살이를 마쳐요', did: '씨 받기' },
  harvest: { todo: '익은 열매를 따요', waiting: '열매를 따야 겨울을 준비해요', did: '열매 따기' },
  winterWrap: {
    todo: '줄기를 짚으로 감싸 겨울을 준비해요',
    waiting: '짚으로 감싸야 겨울을 잘 나요',
    did: '짚으로 감싸기',
  },
  moveIn: {
    todo: '화분을 책상으로 옮겨 겨울을 준비해요',
    waiting: '책상으로 옮겨야 겨울을 잘 나요',
    did: '책상으로 옮기기',
  },
}

/**
 * A potted perennial that already stands on the desk in winter: moving it is not possible, its winter care
 * is counted when the day ends there (store finalizeDay).
 */
export const MOVE_IN_ON_DESK = '책상에 둔 채로 하루를 마치면 겨울 준비가 끝나요'
