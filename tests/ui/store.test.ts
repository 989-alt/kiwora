import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newPlant } from '../../src/sim/day'
import { emptySave, SAVE_KEY, type SaveData } from '../../src/sim/save'
import { SPECIES } from '../../src/sim/species'
import type { PlantState } from '../../src/sim/types'
import { boot, reducer, useApp, type Action, type AppState } from '../../src/store'

const D1 = '2026-10-21'
const D2 = '2026-10-22'

function play(s: AppState, actions: Action[], today: string): AppState {
  return actions.reduce((st, a) => reducer(st, a, today), s)
}

function started(id: Parameters<typeof newPlant>[0] = 'bean', today = D1): AppState {
  return reducer(boot(emptySave(), today), { type: 'pick', id }, today)
}

/** Round-trip through JSON like localStorage, dropping the non-persisted fields. */
function persist(s: AppState): SaveData {
  const { screen: _s, morning: _m, warning: _w, ...data } = s
  return JSON.parse(JSON.stringify(data)) as SaveData
}

describe('boot and pick', () => {
  it('empty save starts on the pick screen', () => {
    const s = boot(emptySave(), D1)
    expect(s.screen).toBe('pick')
    expect(s.morning).toBeNull()
  })

  it('pick plants a seed and starts day 1 today', () => {
    const s = started('bean')
    expect(s.plant?.speciesId).toBe('bean')
    expect(s.plant?.day).toBe(1)
    expect(s.screen).toBe('grow')
    expect(s.dayDone).toBe(false)
    expect(s.lastDayKey).toBe(D1)
  })

  it('pick is ignored while a living plant grows', () => {
    const s = started('bean')
    const t = reducer(s, { type: 'pick', id: 'corn' }, D1)
    expect(t.plant?.speciesId).toBe('bean')
  })
})

describe('actions', () => {
  it('water shows immediately and is recorded once', () => {
    const s = started()
    const before = s.plant!.water
    const t = play(s, [{ type: 'water', amount: 10 }, { type: 'water', amount: 5 }], D1)
    expect(t.plant!.water).toBe(before + 15)
    expect(t.pendingActions).toEqual({ waterAdded: 15, pellets: 0, bugsRemoved: 0, place: 'desk' })
  })

  it('water uses the endDay clamps (max 150, non-finite ignored)', () => {
    const s = started()
    const t = play(s, [{ type: 'water', amount: 500 }, { type: 'water', amount: Number.NaN }], D1)
    expect(t.plant!.water).toBe(150)
    expect(Number.isFinite(t.pendingActions!.waterAdded)).toBe(true)
  })

  it('pellet, removeBug and move change the plant and pending actions', () => {
    const base = started()
    const s: AppState = { ...base, plant: { ...base.plant!, bugs: 2 } }
    const t = play(s, [{ type: 'pellet' }, { type: 'removeBug' }, { type: 'move', place: 'window' }], D1)
    expect(t.plant!.nutrient).toBe(base.plant!.nutrient + 15)
    expect(t.plant!.bugs).toBe(1)
    expect(t.plant!.place).toBe('window')
    expect(t.pendingActions).toEqual({ waterAdded: 0, pellets: 1, bugsRemoved: 1, place: 'window' })
  })

  it('actions ignored after dayDone', () => {
    const s = play(started(), [{ type: 'endDay' }], D1)
    expect(s.dayDone).toBe(true)
    const t = play(s, [{ type: 'water', amount: 10 }, { type: 'pellet' }, { type: 'move', place: 'shade' }], D1)
    expect(t.plant).toEqual(s.plant)
    expect(t.pendingActions).toBeNull()
  })
})

describe('day flow', () => {
  it('one endDay per date', () => {
    const s = started()
    const t = play(s, [{ type: 'endDay' }, { type: 'endDay' }], D1)
    expect(t.plant!.day).toBe(2)
    expect(t.journal).toHaveLength(1)
  })

  it('endDay writes a journal entry, does not double-apply actions, and sets morning', () => {
    const s = play(started(), [{ type: 'water', amount: 10 }], D1)
    const t = reducer(s, { type: 'endDay' }, D1)
    expect(t.journal[0]).toMatchObject({ day: 1, dateKey: D1, actions: { waterAdded: 10 } })
    expect(t.pendingActions).toBeNull()
    expect(t.morning).not.toBeNull()
    // seed on the desk: water 55 + 10 = 65 before evaporation (18), applied only once
    expect(t.plant!.water).toBe(65 - 18)
  })

  it('same day after dayDone stays view-only on reload', () => {
    const s = play(started(), [{ type: 'endDay' }], D1)
    const r = boot(persist(s), D1)
    expect(r.dayDone).toBe(true)
    expect(r.screen).toBe('grow')
    expect(r.plant!.day).toBe(2)
  })

  it('new date after a finished day reopens the day without simulating', () => {
    const s = play(started(), [{ type: 'endDay' }], D1)
    const r = boot(persist(s), D2)
    expect(r.dayDone).toBe(false)
    expect(r.lastDayKey).toBe(D2)
    expect(r.plant).toEqual(persist(s).plant)
  })

  it('unfinished day auto-finalizes on next date', () => {
    const s = play(started(), [{ type: 'water', amount: 10 }], D1)
    const r = boot(persist(s), D2)
    expect(r.plant!.day).toBe(2)
    expect(r.morning).not.toBeNull()
    expect(r.journal).toHaveLength(1)
    expect(r.journal[0]).toMatchObject({ day: 1, dateKey: D1, actions: { waterAdded: 10 } })
    expect(r.dayDone).toBe(false)
    expect(r.lastDayKey).toBe(D2)
    expect(r.pendingActions).toBeNull()
  })

  it('auto-finalize is deterministic', () => {
    const s = persist(play(started(), [{ type: 'water', amount: 10 }], D1))
    expect(boot(s, D2).plant).toEqual(boot(s, D2).plant)
  })

  it('missing days do not decay', () => {
    const s = play(started(), [{ type: 'water', amount: 10 }, { type: 'endDay' }], D1)
    const r = boot(persist(s), '2026-10-28')
    expect(r.plant!.water).toBe(s.plant!.water)
    expect(r.plant!.day).toBe(s.plant!.day)
    expect(r.journal).toHaveLength(1)
  })

  it('clock rewind does not reopen the day', () => {
    const s = play(started(), [{ type: 'endDay' }], D2)
    expect(boot(persist(s), D1).dayDone).toBe(true)
  })
})

describe('endings', () => {
  function withPlant(p: PlantState, extra: Partial<AppState> = {}): AppState {
    return { ...started(p.speciesId), plant: p, ...extra }
  }

  it('death adds a past try and shows the dead screen', () => {
    const p: PlantState = { ...newPlant('bean'), health: 1, water: 0 }
    const t = reducer(withPlant(p), { type: 'endDay' }, D1)
    expect(t.plant!.dead).toBe(true)
    expect(t.screen).toBe('dead')
    expect(t.pastTries).toHaveLength(1)
    expect(t.pastTries[0]).toMatchObject({ speciesId: 'bean', days: 1, stage: 'seed' })
    expect(t.pastTries[0].cause.length).toBeGreaterThan(0)
  })

  it('annual reaching seedDone goes to the dex and the journal', () => {
    const st = SPECIES.bean.stages
    const p: PlantState = {
      ...newPlant('bean'), stageIndex: st.indexOf('fruit'), growth: 3.9, water: 60, nutrient: 50,
    }
    const t = reducer(withPlant(p), { type: 'endDay' }, D1)
    expect(st[t.plant!.stageIndex]).toBe('seedDone')
    expect(t.dex).toEqual(['bean'])
    expect(t.screen).toBe('journal')
  })

  it('dex is deduped', () => {
    const st = SPECIES.bean.stages
    const p: PlantState = {
      ...newPlant('bean'), stageIndex: st.indexOf('fruit'), growth: 3.9, water: 60, nutrient: 50,
    }
    const t = reducer(withPlant(p, { dex: ['bean'] }), { type: 'endDay' }, D1)
    expect(t.dex).toEqual(['bean'])
  })

  it('perennial reaching newShoot completes', () => {
    const st = SPECIES.dandelion.stages
    const p: PlantState = {
      ...newPlant('dandelion'), stageIndex: st.indexOf('winter'), growth: 3.9, water: 40, nutrient: 30,
    }
    const t = reducer(withPlant(p), { type: 'endDay' }, D1)
    expect(st[t.plant!.stageIndex]).toBe('newShoot')
    expect(t.dex).toContain('dandelion')
    expect(t.screen).toBe('journal')
  })

  it('transplant species routes to transplant screen', () => {
    const st = SPECIES.apple.stages
    const p: PlantState = {
      ...newPlant('apple'), stageIndex: st.indexOf('leafStem'), growth: 3.9,
      water: 60, nutrient: 50, lightExp: 90, place: 'window',
    }
    const t = reducer(withPlant(p), { type: 'endDay' }, D1)
    expect(st[t.plant!.stageIndex]).toBe('grownTree')
    expect(t.screen).toBe('transplant')
  })

  it('dandelion does not transplant', () => {
    const st = SPECIES.dandelion.stages
    const p: PlantState = {
      ...newPlant('dandelion'), stageIndex: st.indexOf('leafStem'), growth: 3.9, water: 60, nutrient: 50,
    }
    const t = reducer(withPlant(p), { type: 'endDay' }, D1)
    expect(st[t.plant!.stageIndex]).toBe('grownTree')
    expect(t.screen).toBe('grow')
  })

  it('chooseYard fixes the place and later moves are ignored', () => {
    const st = SPECIES.apple.stages
    const p: PlantState = { ...newPlant('apple'), stageIndex: st.indexOf('grownTree') }
    const s = withPlant(p, { screen: 'transplant' })
    expect(reducer(s, { type: 'chooseYard', place: 'window' }, D1).plant!.place).toBe('desk')
    const t = reducer(s, { type: 'chooseYard', place: 'yardPartial' }, D1)
    expect(t.plant!.place).toBe('yardPartial')
    expect(t.screen).toBe('grow')
    expect(reducer(t, { type: 'move', place: 'window' }, D1).plant!.place).toBe('yardPartial')
    expect(reducer(t, { type: 'chooseYard', place: 'yardShade' }, D1).plant!.place).toBe('yardPartial')
  })

  it('reload with a pending transplant returns to the transplant screen', () => {
    const st = SPECIES.apple.stages
    const p: PlantState = { ...newPlant('apple'), stageIndex: st.indexOf('grownTree') }
    expect(boot(persist(withPlant(p)), D1).screen).toBe('transplant')
  })
})

describe('replant and pick after an ending', () => {
  function dead(): AppState {
    const s = started('bean')
    return reducer({ ...s, plant: { ...s.plant!, health: 1, water: 0 } }, { type: 'endDay' }, D1)
  }

  it('replant consumes the day', () => {
    const s = dead()
    const t = reducer(s, { type: 'replant', id: 'corn' }, D1)
    expect(t.plant).toEqual(newPlant('corn'))
    expect(t.dayDone).toBe(true)
    expect(t.lastDayKey).toBe(D1)
    expect(t.journal).toEqual([])
    expect(t.pastTries).toHaveLength(1)
    expect(t.screen).toBe('grow')
    // the new plant's day 1 starts on the next date
    const r = boot(persist(t), D2)
    expect(r.dayDone).toBe(false)
    expect(r.plant!.day).toBe(1)
  })

  it('replant consumes the day even on the morning after a death', () => {
    const r = boot(persist(dead()), D2)
    expect(r.screen).toBe('dead')
    const t = reducer(r, { type: 'replant', id: 'bean' }, D2)
    expect(t.dayDone).toBe(true)
    expect(t.lastDayKey).toBe(D2)
  })

  it('pick is allowed after death', () => {
    const t = reducer(dead(), { type: 'pick', id: 'rice' }, D1)
    expect(t.plant!.speciesId).toBe('rice')
    expect(t.journal).toEqual([])
    expect(t.pastTries).toHaveLength(1)
  })
})

describe('misc actions', () => {
  it('open, toggleSound, tutorialDone', () => {
    let s = started()
    s = reducer(s, { type: 'open', screen: 'dex' }, D1)
    expect(s.screen).toBe('dex')
    s = reducer(s, { type: 'toggleSound' }, D1)
    expect(s.settings.sound).toBe(false)
    s = reducer(s, { type: 'tutorialDone' }, D1)
    expect(s.settings.tutorialSeen).toBe(true)
  })

  it('restore replaces the save and boots it', () => {
    const other = persist(play(started('corn'), [{ type: 'endDay' }], D1))
    const t = reducer(started('bean'), { type: 'restore', data: other }, D1)
    expect(t.plant!.speciesId).toBe('corn')
    expect(t.dayDone).toBe(true)
  })
})

describe('morning report survives a reload', () => {
  it('a day finalized on D1 shows as morning after booting on D2', () => {
    const s = play(started(), [{ type: 'water', amount: 10 }, { type: 'endDay' }], D1)
    expect(s.lastReport).toEqual(s.morning)
    const t = boot(persist(s), D2)
    expect(t.morning).not.toBeNull()
    expect(t.morning).toEqual(s.morning)
  })

  it('a day finalized by rollover on boot is the morning too', () => {
    const s = play(started(), [{ type: 'water', amount: 10 }], D1)
    const t = boot(persist(s), D2)
    expect(t.morning).not.toBeNull()
    expect(persist(t).lastReport).toEqual(t.morning)
  })

  it('a new plant clears the old report', () => {
    const s = play(started(), [{ type: 'endDay' }], D1)
    const dead: AppState = { ...s, plant: { ...s.plant!, dead: true }, screen: 'dead' }
    const t = reducer(dead, { type: 'replant', id: 'corn' }, D1)
    expect(t.lastReport).toBeNull()
    expect(t.morning).toBeNull()
  })
})

describe('rollover while the app stays open', () => {
  it('a dispatch on the next date reopens a finished day', () => {
    const s = play(started(), [{ type: 'endDay' }], D1)
    const morning = s.morning
    const t = reducer(s, { type: 'tick' }, D2)
    expect(t.dayDone).toBe(false)
    expect(t.lastDayKey).toBe(D2)
    expect(t.plant).toEqual(s.plant)
    expect(t.morning).toBe(morning)
    expect(t.journal).toHaveLength(1)
    // and the student can act on the new day
    const u = reducer(t, { type: 'water', amount: 5 }, D2)
    expect(u.pendingActions?.waterAdded).toBe(5)
  })

  it('pending actions of the old date are finalized under that date before the new action', () => {
    const s = play(started(), [{ type: 'water', amount: 10 }], D1)
    const t = reducer(s, { type: 'water', amount: 5 }, D2)
    expect(t.journal).toHaveLength(1)
    expect(t.journal[0]).toMatchObject({ day: 1, dateKey: D1, actions: { waterAdded: 10 } })
    expect(t.plant!.day).toBe(2)
    expect(t.morning).not.toBeNull()
    expect(t.dayDone).toBe(false)
    expect(t.lastDayKey).toBe(D2)
    expect(t.pendingActions).toEqual({ waterAdded: 5, pellets: 0, bugsRemoved: 0, place: 'desk' })
  })

  it('keeps the current screen when nothing routes elsewhere', () => {
    const s = play(started(), [{ type: 'water', amount: 10 }, { type: 'open', screen: 'dex' }], D1)
    expect(reducer(s, { type: 'tick' }, D2).screen).toBe('dex')
  })

  it('tick on the same date changes nothing', () => {
    const s = play(started(), [{ type: 'endDay' }], D1)
    expect(reducer(s, { type: 'tick' }, D1)).toBe(s)
  })

  it('stays on the transplant screen after every finalize while not in the yard', () => {
    const st = SPECIES.apple.stages
    const base = started('apple')
    const s: AppState = { ...base, plant: { ...newPlant('apple'), stageIndex: st.indexOf('grownTree') }, screen: 'grow' }
    const t = reducer(s, { type: 'endDay' }, D1)
    expect(t.plant!.dead).toBe(false)
    expect(t.screen).toBe('transplant')
  })
})

describe('useApp', () => {
  function fakeStorage(init: Record<string, string> = {}): Storage {
    const m = new Map(Object.entries(init))
    return {
      get length() {
        return m.size
      },
      clear: () => m.clear(),
      getItem: (k) => (m.has(k) ? m.get(k)! : null),
      key: (i) => [...m.keys()][i] ?? null,
      removeItem: (k) => void m.delete(k),
      setItem: (k, v) => void m.set(k, String(v)),
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('backs up a corrupt save before overwriting it and exposes the warning', () => {
    const ls = fakeStorage({ [SAVE_KEY]: '{not json' })
    vi.stubGlobal('localStorage', ls)
    const { result } = renderHook(() => useApp())
    expect(ls.getItem('plantlife.v1.bak')).toBe('{not json')
    expect(result.current[0].warning).toBe('corrupt')
    // the backup panel opens first so a written-down code can be entered
    expect(result.current[0].screen).toBe('backup')
    act(() => result.current[1]({ type: 'clearWarning' }))
    expect(result.current[0].warning).toBeUndefined()
    act(() => result.current[1]({ type: 'pick', id: 'bean' }))
    expect(JSON.parse(ls.getItem(SAVE_KEY)!).plant.speciesId).toBe('bean')
    expect(ls.getItem('plantlife.v1.bak')).toBe('{not json')
  })

  it('reopens the day on focus, visibility and the interval after midnight', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    try {
      vi.setSystemTime(new Date(2026, 9, 21, 23, 59))
      vi.stubGlobal('localStorage', fakeStorage())
      const { result } = renderHook(() => useApp())
      act(() => result.current[1]({ type: 'pick', id: 'bean' }))
      act(() => result.current[1]({ type: 'endDay' }))
      expect(result.current[0].dayDone).toBe(true)

      vi.setSystemTime(new Date(2026, 9, 22, 8, 0))
      act(() => void window.dispatchEvent(new Event('focus')))
      expect(result.current[0].dayDone).toBe(false)
      expect(result.current[0].lastDayKey).toBe('2026-10-22')

      act(() => result.current[1]({ type: 'endDay' }))
      vi.setSystemTime(new Date(2026, 9, 23, 8, 0))
      act(() => void document.dispatchEvent(new Event('visibilitychange')))
      expect(result.current[0].lastDayKey).toBe('2026-10-23')

      act(() => result.current[1]({ type: 'endDay' }))
      vi.setSystemTime(new Date(2026, 9, 24, 8, 0))
      act(() => void vi.advanceTimersByTime(60_000))
      expect(result.current[0].lastDayKey).toBe('2026-10-24')
      expect(result.current[0].dayDone).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves after each dispatch', () => {
    const ls = fakeStorage()
    vi.stubGlobal('localStorage', ls)
    const { result } = renderHook(() => useApp())
    expect(result.current[0].warning).toBeUndefined()
    act(() => result.current[1]({ type: 'pick', id: 'corn' }))
    act(() => result.current[1]({ type: 'water', amount: 10 }))
    const saved = JSON.parse(ls.getItem(SAVE_KEY)!)
    expect(saved.pendingActions.waterAdded).toBe(10)
    expect(saved.screen).toBeUndefined()
    expect(ls.getItem('plantlife.v1.bak')).toBeNull()
  })
})
