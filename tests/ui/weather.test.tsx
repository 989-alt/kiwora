import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../src/App'
import { newPlant } from '../../src/sim/day'
import { todayKey } from '../../src/sim/clock'
import { emptySave, SAVE_KEY } from '../../src/sim/save'
import { SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { DayReport, PlantState, WeatherId } from '../../src/sim/types'
import { weatherOn } from '../../src/sim/weather'
import type { AppState } from '../../src/store'
import { NightScene } from '../../src/ui/NightScene'
import { MorningCard, morningSummary } from '../../src/ui/screens/MorningCard'
import { StatusBoard } from '../../src/ui/StatusBoard'
import { feelingText } from '../../src/ui/journalText'
import { todoItems } from '../../src/ui/todo'
import { WEATHER_NAME, forecastText, handledText, todayText } from '../../src/ui/weatherText'

const KINDS: WeatherId[] = ['heat', 'rain', 'monsoon', 'typhoon', 'cold', 'frost']

/** A plant at `stage` with that stage's care counted as done (nothing else to do but the weather). */
function plantAt(id: SpeciesId, stage: StageId, over: Partial<PlantState> = {}): PlantState {
  const stages = SPECIES[id].stages
  const p = { ...newPlant(id, { mode: 'quick' }), stageIndex: stages.indexOf(stage), careDone: 1, ...over }
  return p
}

/** A weather seed for which `p` has `kind` on `day`. */
function seedFor(p: PlantState, kind: WeatherId, day: number): number {
  for (let s = 0; s < 256; s++) if (weatherOn({ ...p, weatherSeed: s }, day) === kind) return s
  throw new Error(`no seed with ${kind} on day ${day}`)
}

const report = (over: Partial<DayReport> = {}): DayReport => ({
  statuses: {
    water: { level: 3, dir: null },
    light: { level: 3, dir: null },
    temp: { level: 3, dir: null },
    nutrient: { level: 3, dir: null },
    pest: { level: 4, dir: null },
  },
  healthDelta: 0,
  grew: false,
  stageChanged: false,
  died: false,
  newBugs: 0,
  heightDelta: 0,
  ...over,
})

function putSave(plant: PlantState, over: Record<string, unknown> = {}) {
  const save = { ...emptySave(), plant, lastDayKey: todayKey(), settings: { sound: false, tutorialSeen: true }, ...over }
  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}

const stateWith = (plant: PlantState | null, over: Partial<AppState> = {}) => ({ plant, ...over }) as unknown as AppState
const day = () => /(\d+)일째/.exec(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label') ?? '')![1]
const boardRow = () => screen.getByRole('group', { name: /^오늘의 날씨/ })

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe('weather words', () => {
  test('every kind has a name, a forecast and a today line, indoors and in the yard', () => {
    expect(WEATHER_NAME).toEqual({
      heat: '폭염',
      rain: '비 오는 날',
      monsoon: '장마',
      typhoon: '태풍',
      cold: '쌀쌀한 날',
      frost: '서리',
    })
    expect(forecastText('heat', false)).toBe('내일은 아주 더워요! 창가는 뜨거울 거예요.')
    expect(forecastText('rain', true)).toBe('내일은 비가 와요.')
    expect(forecastText('monsoon', false)).toBe('내일은 장마 비가 와요.')
    expect(forecastText('typhoon', true)).toBe('내일은 태풍이 와요!')
    expect(forecastText('cold', false)).toBe('내일은 쌀쌀해요. 창가는 추울 거예요.')
    expect(forecastText('frost', true)).toBe('내일은 서리가 내려요.')
    expect(todayText('heat', false)).toBe('오늘은 아주 더워요! 창가에서 옮겨요.')
    expect(todayText('heat', true)).toBe('오늘은 아주 더워요! 물을 넉넉히 줘요.')
    expect(todayText('rain', true)).toBe('오늘은 비가 와요! 물을 주지 않아요.')
    expect(todayText('monsoon', false)).toBe('장마예요! 물을 주지 말고 벌레를 살펴요.')
    expect(todayText('typhoon', true)).toBe('태풍이 와요! 나무를 지지대에 묶어요.')
    expect(todayText('cold', false)).toBe('오늘은 쌀쌀해요! 창가에서 안쪽으로 옮겨요.')
    expect(todayText('frost', true)).toBe('서리가 내려요! 줄기를 짚으로 감싸요.')
    for (const k of KINDS) {
      expect(forecastText(k, false).startsWith('내일은')).toBe(true)
      // cold only comes indoors; nothing that comes to the yard talks about a window
      if (k !== 'cold') expect(forecastText(k, true) + todayText(k, true)).not.toContain('창가')
    }
  })

  test('the yard heat forecast does not mention a window', () => {
    expect(forecastText('heat', true)).not.toContain('창가')
  })
})

describe('the night scene and the quick transition show tomorrow\'s forecast', () => {
  const heatTomorrow = () => {
    const p = plantAt('balsam', 'leafStem', { day: 4, place: 'desk' })
    return { ...p, weatherSeed: seedFor(p, 'heat', 5) }
  }

  test('quick: the cover holds the forecast words and picture', () => {
    putSave(heatTomorrow())
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    const slot = container.ownerDocument.querySelector('.nt-forecast')!
    expect(slot.getAttribute('data-forecast')).toBe('heat')
    expect(slot.textContent).toContain('내일은 아주 더워요! 창가는 뜨거울 거예요.')
    expect(slot.querySelector('img')?.getAttribute('src')).toMatch(/weather\/heat\.webp/)
    act(() => void vi.advanceTimersByTime(6000))
    expect(container.ownerDocument.querySelector('.nt')).toBeNull()
    expect(day()).toBe('5')
  })

  test('daily: the night scene keeps the forecast, also after a reload', () => {
    putSave({ ...heatTomorrow(), mode: 'daily' })
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    act(() => void vi.advanceTimersByTime(6000))
    const night = document.querySelector('.gs-night')!
    expect(night.querySelector('.gs-night-forecast')?.textContent).toContain('내일은 아주 더워요! 창가는 뜨거울 거예요.')
    expect(night.querySelector('.gs-night-forecast img')?.getAttribute('src')).toMatch(/weather\/heat\.webp/)
    unmount()
    render(<App />)
    expect(document.querySelector('.gs-night-forecast')?.textContent).toContain('내일은 아주 더워요!')
  })

  test('no forecast on a calm day, for a dead plant or for a finished one', () => {
    const calm = plantAt('balsam', 'leafStem', { day: 4, weatherFrom: 99 })
    putSave(calm)
    const { container, unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    expect(container.ownerDocument.querySelector('.nt')).not.toBeNull()
    expect(container.ownerDocument.querySelector('.nt-forecast')).toBeNull()
    unmount()
    // the night scene of a plant that cannot go on shows no line either
    const night = render(<NightScene forecast={null} outdoor={false} summary="" />)
    expect(night.container.querySelector('.gs-night-forecast')).toBeNull()
    // dead or finished: the sim has no weather, so the store signals none
    expect(weatherOn({ ...heatTomorrow(), dead: true }, 5)).toBeNull()
    const done = plantAt('balsam', 'seedDone', { day: 30 })
    expect(todoItems(stateWith(done))).toEqual([])
  })
})

describe('the morning card leads with today\'s weather', () => {
  test('MorningCard puts the today line first, when there is weather', () => {
    const { rerender } = render(<MorningCard report={report()} day={5} dayDone={false} weatherToday="rain" outdoor />)
    const lines = screen.getByRole('button').querySelectorAll('.morning-text > span')
    expect(lines[0].textContent).toBe('오늘은 비가 와요! 물을 주지 않아요.')
    expect(lines[1].textContent).toContain('5일째 아침이에요!')
    rerender(<MorningCard report={report()} day={5} dayDone={false} weatherToday={null} outdoor />)
    expect(screen.getByRole('button').textContent).not.toContain('오늘은 비가')
  })

  test('a day finalized on load (no night scene) still announces today\'s weather', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const p = plantAt('balsam', 'leafStem', { day: 4, place: 'window', mode: 'daily' })
    // after the load finalizes day 4 the plant is on day 5: that day has heat
    const plant = { ...p, weatherSeed: seedFor(p, 'heat', 5) }
    putSave(plant, {
      lastDayKey: todayKey(yesterday),
      pendingActions: { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'window' },
    })
    render(<App />)
    expect(day()).toBe('5')
    expect(document.querySelector('.gs-night')).toBeNull()
    const card = document.querySelector('.morning')!
    expect(card.textContent).toContain('오늘은 아주 더워요! 창가에서 옮겨요.')
    expect(within(boardRow()).getByText('폭염')).toBeTruthy()
  })

  test('a done daily day shows the forecast as tomorrow\'s, never as today\'s', () => {
    const p = plantAt('balsam', 'leafStem', { day: 4, place: 'desk', mode: 'daily' })
    putSave({ ...p, weatherSeed: seedFor(p, 'heat', 5) })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    act(() => void vi.advanceTimersByTime(6000))
    // night: the forecast is there, but no morning card and no "오늘은" line for the new day
    expect(document.querySelector('.morning')).toBeNull()
    expect(document.querySelector('.gs-night-forecast')?.textContent).toContain('내일은')
    expect(todoItems(stateWith(p, { dayDone: true }))).toEqual([])
  })
})

describe('the status board shows 오늘의 날씨', () => {
  const heatToday = () => {
    const p = plantAt('balsam', 'leafStem', { day: 4, place: 'window' })
    return { ...p, weatherSeed: seedFor(p, 'heat', 4) }
  }

  test('rows: a calm day says 맑아요, the weather row names the day and what it needs', () => {
    const statuses = report().statuses
    const { rerender } = render(<StatusBoard statuses={statuses} health={80} bugs={0} layout="side" weather={null} />)
    expect(boardRow().textContent).toContain('맑아요')
    rerender(<StatusBoard statuses={statuses} health={80} bugs={0} layout="side" weather={{ kind: 'typhoon', prepared: false }} />)
    expect(boardRow().textContent).toContain('태풍')
    expect(boardRow().textContent).toContain('대비가 필요해요')
    expect(boardRow().querySelector('img')?.getAttribute('src')).toMatch(/weather\/typhoon\.webp/)
    rerender(<StatusBoard statuses={statuses} health={80} bugs={0} layout="side" weather={{ kind: 'typhoon', prepared: true }} />)
    expect(boardRow().textContent).toContain('대비했어요')
    // old callers without the prop get no weather row
    rerender(<StatusBoard statuses={statuses} health={80} bugs={0} layout="side" />)
    expect(screen.queryByRole('group', { name: /^오늘의 날씨/ })).toBeNull()
  })

  test('on the grow screen it flips to 대비했어요 after moving off the window, and the temperature row follows', () => {
    putSave(heatToday())
    const { container } = render(<App />)
    expect(boardRow().textContent).toContain('폭염')
    expect(boardRow().textContent).toContain('대비가 필요해요')
    const hot = screen.getByRole('group', { name: /^온도/ }).getAttribute('aria-label')
    expect(hot).toMatch(/매우 위험|위험/)
    fireEvent.click(container.querySelector('[data-slot="desk"]')!)
    expect(boardRow().textContent).toContain('대비했어요')
    expect(screen.getByRole('group', { name: /^온도/ }).getAttribute('aria-label')).not.toBe(hot)
  })

  test('a calm day shows 맑아요 on the grow screen', () => {
    putSave(plantAt('balsam', 'leafStem', { day: 4, weatherFrom: 99 }))
    render(<App />)
    expect(boardRow().textContent).toContain('맑아요')
  })

  test('at night the row reports the day that just ended', () => {
    const p = plantAt('balsam', 'leafStem', { day: 4, place: 'window', mode: 'daily' })
    putSave({ ...p, weatherSeed: seedFor(p, 'heat', 4) })
    const { container } = render(<App />)
    fireEvent.click(container.querySelector('[data-slot="desk"]')!)
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    act(() => void vi.advanceTimersByTime(6000))
    expect(boardRow().textContent).toContain('폭염')
    expect(boardRow().textContent).toContain('대비했어요')
  })
})

describe('the today card lists the weather prep until prepared', () => {
  const heat = () => {
    const p = plantAt('balsam', 'leafStem', { day: 4, place: 'window' })
    return { ...p, weatherSeed: seedFor(p, 'heat', 4) }
  }

  test('heat on the window: listed, gone once the pot is off the window', () => {
    const p = heat()
    const before = todoItems(stateWith(p))
    expect(before).toEqual([{ key: 'weather-heat', kind: 'weather', text: '오늘은 아주 더워요! 창가에서 옮겨요.' }])
    expect(todoItems(stateWith({ ...p, place: 'desk' }, { pendingActions: { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' } }))).toEqual([])
  })

  test('rain and monsoon stay listed while the day is open (they ask for not doing something)', () => {
    const p = plantAt('apple', 'flower', { day: 6, place: 'yardSunny' })
    const rain = { ...p, weatherSeed: seedFor(p, 'rain', 6) }
    expect(todoItems(stateWith(rain)).map((i) => i.text)).toEqual(['오늘은 비가 와요! 물을 주지 않아요.'])
  })

  test('the weather line comes before the stage care line, and a done day lists none', () => {
    const p = { ...heat(), careDone: 0 }
    const items = todoItems(stateWith(p))
    expect(items.map((i) => i.kind)).toEqual(['weather', 'care'])
    expect(todoItems(stateWith(p, { dayDone: true })).map((i) => i.kind)).toEqual(['care'])
  })

  test('a frost day with the straw wrap still to do lists the wrap once', () => {
    const p = plantAt('apple', 'winter', { day: 8, place: 'yardSunny', careDone: 0 })
    const frost = { ...p, weatherSeed: seedFor(p, 'frost', 8) }
    const items = todoItems(stateWith(frost))
    expect(items.map((i) => i.kind)).toEqual(['care'])
    expect(items[0].text).toContain('짚')
  })

  test('a young tree still in a pot uses the yard wording', () => {
    const p = plantAt('apple', 'grownTree', { day: 9, place: 'desk', careDone: 1, water: 0 })
    const hot = { ...p, weatherSeed: seedFor(p, 'heat', 9) }
    expect(todoItems(stateWith(hot))[0].text).toBe('오늘은 아주 더워요! 물을 넉넉히 줘요.')
  })
})

describe('typhoon tie', () => {
  const typhoon = () => {
    const p = plantAt('apple', 'fruit', { day: 6, place: 'yardSunny' })
    return { ...p, weatherSeed: seedFor(p, 'typhoon', 6) }
  }

  test('finishes by taps alone', () => {
    putSave(typhoon())
    render(<App />)
    expect(boardRow().textContent).toContain('태풍')
    expect(boardRow().textContent).toContain('대비가 필요해요')
    expect(screen.getByRole('status', { name: '오늘 할 일' }).textContent).toContain('태풍이 와요! 나무를 지지대에 묶어요.')
    fireEvent.click(screen.getByRole('button', { name: '묶을 나무 밑동' }))
    expect(boardRow().textContent).toContain('대비했어요')
    expect(screen.queryByRole('button', { name: '묶을 나무 밑동' })).toBeNull()
    expect(screen.getByText('나무를 지지대에 묶었어요')).toBeTruthy()
    // nothing else to do today: the card is gone
    expect(screen.queryByRole('status', { name: '오늘 할 일' })).toBeNull()
    // the tie is kept in the pending actions (so a reload keeps it)
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).pendingActions.tied).toBe(true)
  })

  test('a tie on a day without a typhoon does nothing', () => {
    const p = plantAt('apple', 'fruit', { day: 6, place: 'yardSunny', weatherFrom: 99 })
    putSave(p)
    render(<App />)
    expect(screen.queryByRole('button', { name: '묶을 나무 밑동' })).toBeNull()
  })

  test('the morning after: tied = "잘 대비했어요", not tied = "힘들었어요"', () => {
    putSave(typhoon())
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '묶을 나무 밑동' }))
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    act(() => void vi.advanceTimersByTime(6000))
    expect(document.querySelector('.morning')?.textContent).toContain('어제 태풍에 잘 대비했어요')
  })

  test('not tied: the next morning says it was hard', () => {
    putSave(typhoon())
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    act(() => void vi.advanceTimersByTime(6000))
    expect(document.querySelector('.morning')?.textContent).toContain('태풍 때문에 힘들었어요')
  })
})

describe('morning summary tells whether yesterday\'s weather was handled', () => {
  test('handled and not handled', () => {
    expect(handledText({ kind: 'heat', prepared: true })).toBe('어제 폭염에 잘 대비했어요')
    expect(handledText({ kind: 'rain', prepared: true })).toBe('어제 비 오는 날에 잘 대비했어요')
    expect(handledText({ kind: 'typhoon', prepared: false })).toBe('태풍 때문에 힘들었어요')
    expect(morningSummary(report({ weather: { kind: 'frost', prepared: true } }))).toBe('어제 서리에 잘 대비했어요')
    expect(morningSummary(report({ weather: { kind: 'cold', prepared: false } }))).toBe('쌀쌀한 날 때문에 힘들었어요')
  })

  test('the weather goes first and at most two parts show', () => {
    const r = report({ weather: { kind: 'heat', prepared: true }, heightDelta: 3, newBugs: 2, stageChanged: true })
    expect(morningSummary(r)).toBe('어제 폭염에 잘 대비했어요, 단계가 바뀌었어요')
  })

  test('waiting for the stage care leads, then the weather', () => {
    const waiting = report({ waiting: true })
    expect(morningSummary(waiting)).toBe('돌보기를 마치면 다음 단계로 자라요')
    const both = report({ waiting: true, weather: { kind: 'monsoon', prepared: false }, heightDelta: 2 })
    expect(morningSummary(both)).toBe('돌보기를 마치면 다음 단계로 자라요, 장마 때문에 힘들었어요')
  })

  test('a seed under the soil keeps its own line', () => {
    expect(morningSummary(report({ weather: { kind: 'heat', prepared: true } }), 'seed')).toContain('씨')
  })
})

test('the journal row tells how the weather went before the feeling', () => {
  const st = report().statuses
  expect(feelingText(st)).toBe('건강했어요')
  expect(feelingText(st, { kind: 'heat', prepared: true })).toBe('폭염에 잘 대비했어요, 건강했어요')
  expect(feelingText({ ...st, temp: { level: 0, dir: 'high' } }, { kind: 'heat', prepared: false })).toBe('폭염 때문에 힘들었어요, 많이 더웠어요')
})
