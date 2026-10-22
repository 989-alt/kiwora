import type { WeatherId } from '../sim/types'

/** What the student calls each weather (the board, the journal and the sentences use these). */
export const WEATHER_NAME: Record<WeatherId, string> = {
  heat: '폭염',
  rain: '비 오는 날',
  monsoon: '장마',
  typhoon: '태풍',
  cold: '쌀쌀한 날',
  frost: '서리',
}

/**
 * The night's words about tomorrow. `outdoor` = the plant lives in the yard (a tree from the young-tree stage
 * on, also on the night before it is moved there): the yard has no window.
 */
export function forecastText(kind: WeatherId, outdoor: boolean): string {
  switch (kind) {
    case 'heat':
      return outdoor ? '내일은 아주 더워요! 물이 빨리 말라요.' : '내일은 아주 더워요! 창가는 뜨거울 거예요.'
    case 'rain':
      return '내일은 비가 와요.'
    case 'monsoon':
      return '내일은 장마 비가 와요.'
    case 'typhoon':
      return '내일은 태풍이 와요!'
    case 'cold':
      return '내일은 쌀쌀해요. 창가는 추울 거예요.'
    case 'frost':
      return '내일은 서리가 내려요.'
  }
}

/** The morning card's and the '오늘 할 일' card's words: what the weather is today and what to do. */
export function todayText(kind: WeatherId, outdoor: boolean): string {
  switch (kind) {
    case 'heat':
      return outdoor ? '오늘은 아주 더워요! 물을 넉넉히 줘요.' : '오늘은 아주 더워요! 창가에서 옮겨요.'
    case 'rain':
      return '오늘은 비가 와요! 물을 주지 않아요.'
    case 'monsoon':
      return '장마예요! 물을 주지 말고 벌레를 살펴요.'
    case 'typhoon':
      return '태풍이 와요! 나무를 지지대에 묶어요.'
    case 'cold':
      return '오늘은 쌀쌀해요! 창가에서 안쪽으로 옮겨요.'
    case 'frost':
      return '서리가 내려요! 줄기를 짚으로 감싸요.'
  }
}

/** How the day's weather went, for the journal row of that day. */
export function weatherNote(w: { kind: WeatherId; prepared: boolean }): string {
  return w.prepared ? `${WEATHER_NAME[w.kind]}에 잘 대비했어요` : `${WEATHER_NAME[w.kind]} 때문에 힘들었어요`
}

/** The same for the morning summary: "yesterday" is added to the good news (the hard one stands alone). */
export function handledText(w: { kind: WeatherId; prepared: boolean }): string {
  return w.prepared ? `어제 ${weatherNote(w)}` : weatherNote(w)
}
