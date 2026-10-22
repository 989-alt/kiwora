import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OBSERVATIONS } from '../../src/data/observations'
import { pendingCare } from '../../src/sim/care'
import { newPlant } from '../../src/sim/day'
import { measureAnswer } from '../../src/sim/measure'
import { emptySave, importCode, loadSave, SAVE_KEY, shortCode, type JournalEntry, type SaveData } from '../../src/sim/save'
import { SPECIES, STAGE_POINTS } from '../../src/sim/species'
import type { PlantState, WeatherId } from '../../src/sim/types'
import { weatherOn } from '../../src/sim/weather'
import {
  boot, isQuick, morningShown, reducer, toSave, useApp, weatherToday, type Action, type AppState,
} from '../../src/store'

const D1 = '2026-10-21'
const D2 = '2026-10-22'

const oneEntry = (day: number): JournalEntry => ({
  day,
  dateKey: D1,
  stage: 'seedDone',
  heightCm: 20,
  leaves: 9,
  actions: { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' },
  statuses: {
    water: { level: 4, dir: null },
    light: { level: 4, dir: null },
    temp: { level: 4, dir: null },
    nutrient: { level: 4, dir: null },
    pest: { level: 4, dir: null },
  },
})

function play(s: AppState, actions: Action[], today: string): AppState {
  return actions.reduce((st, a) => reducer(st, a, today), s)
}

/** A new plant with its seed sown (the seed stage's care), so it can be watered. */
function started(id: Parameters<typeof newPlant>[0] = 'bean', today = D1): AppState {
  return play(boot(emptySave(), today), [{ type: 'pick', id }, { type: 'care', task: 'sow' }], today)
}

/** Round-trip through JSON like localStorage, dropping the non-persisted fields. */
function persist(s: AppState): SaveData {
  return JSON.parse(JSON.stringify(toSave(s))) as SaveData
}

/** A weather seed that gives `p` weather on `day` (of `kind` when given). */
function seedWith(p: PlantState, day: number, kind?: WeatherId): number {
  for (let seed = 0; seed < 256; seed++) {
    const w = weatherOn({ ...p, weatherSeed: seed }, day)
    if (kind ? w === kind : w !== null) return seed
  }
  throw new Error(`no seed gives ${kind ?? 'weather'} on day ${day}`)
}

/** A weather seed with a calm `day` for `p`. */
function calmSeed(p: PlantState, day: number): number {
  for (let seed = 0; seed < 256; seed++) if (weatherOn({ ...p, weatherSeed: seed }, day) === null) return seed
  throw new Error('no calm seed')
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
    expect(t.pendingActions).toEqual({ waterAdded: 15, pellets: 0, bugsRemoved: 0, place: 'desk', care: ['sow'] })
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
    expect(t.pendingActions).toEqual({ waterAdded: 0, pellets: 1, bugsRemoved: 1, place: 'window', care: ['sow'] })
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

  it('the day-1 journal row of a seed is 0 cm and 0 leaves', () => {
    const t = reducer(play(started(), [{ type: 'water', amount: 5 }], D1), { type: 'endDay' }, D1)
    expect(t.journal[0]).toMatchObject({ day: 1, stage: 'seed', heightCm: 0, leaves: 0 })
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
      ...newPlant('bean'), stageIndex: st.indexOf('fruit'), growth: 3.9, careDone: 1, water: 60, nutrient: 50,
    }
    const t = reducer(withPlant(p), { type: 'endDay' }, D1)
    expect(st[t.plant!.stageIndex]).toBe('seedDone')
    expect(t.dex).toEqual(['bean'])
    expect(t.screen).toBe('journal')
  })

  it('dex is deduped', () => {
    const st = SPECIES.bean.stages
    const p: PlantState = {
      ...newPlant('bean'), stageIndex: st.indexOf('fruit'), growth: 3.9, careDone: 1, water: 60, nutrient: 50,
    }
    const t = reducer(withPlant(p, { dex: ['bean'] }), { type: 'endDay' }, D1)
    expect(t.dex).toEqual(['bean'])
  })

  it('perennial reaching newShoot completes', () => {
    const st = SPECIES.dandelion.stages
    const p: PlantState = {
      ...newPlant('dandelion'), stageIndex: st.indexOf('winter'), growth: 3.9, careDone: 1, water: 40, nutrient: 30,
    }
    const t = reducer(withPlant(p), { type: 'endDay' }, D1)
    expect(st[t.plant!.stageIndex]).toBe('newShoot')
    expect(t.dex).toContain('dandelion')
    expect(t.screen).toBe('journal')
  })

  it('a finished journal is kept per species after the next plant starts', () => {
    const st = SPECIES.bean.stages
    const p: PlantState = {
      ...newPlant('bean'), stageIndex: st.indexOf('fruit'), growth: 3.9, careDone: 1, water: 60, nutrient: 50, day: 9,
    }
    const before = withPlant(p, { journal: [] })
    const done = reducer(before, { type: 'endDay' }, D1)
    expect(done.finished?.bean?.journal).toEqual(done.journal)
    expect(done.journal).toHaveLength(1)
    // the next plant starts with an empty journal, the finished one stays
    const next = reducer(done, { type: 'pick', id: 'corn' }, D1)
    expect(next.journal).toEqual([])
    expect(next.finished?.bean?.journal).toEqual(done.journal)
    // and survives a reload
    expect(boot(persist(next), D2).finished?.bean?.journal).toEqual(done.journal)
  })

  it('an old save whose current plant finished before this was kept gets its journal kept on boot', () => {
    const st = SPECIES.bean.stages
    const p: PlantState = { ...newPlant('bean'), stageIndex: st.indexOf('seedDone'), day: 11 }
    const journal = [oneEntry(10)]
    const old: SaveData = { ...emptySave(), plant: p, journal, dex: ['bean'], lastDayKey: D1 }
    delete old.finished
    expect(boot(old, D2).finished?.bean?.journal).toEqual(journal)
  })

  it('openRecord shows a finished journal; unknown species are ignored', () => {
    const s = { ...started(), finished: { balsam: { journal: [oneEntry(10)] } } }
    expect(reducer(s, { type: 'openRecord', id: 'balsam' }, D1)).toMatchObject({ screen: 'record', record: 'balsam' })
    expect(reducer(s, { type: 'openRecord', id: 'corn' }, D1).screen).toBe('grow')
    // the record being viewed is not part of the save
    expect('record' in toSave(reducer(s, { type: 'openRecord', id: 'balsam' }, D1))).toBe(false)
  })

  it('transplant species routes to transplant screen', () => {
    const st = SPECIES.apple.stages
    const p: PlantState = {
      ...newPlant('apple'), stageIndex: st.indexOf('leafStem'), growth: 3.9, careDone: 1,
      water: 60, nutrient: 50, lightExp: 90, place: 'window',
    }
    const t = reducer(withPlant(p), { type: 'endDay' }, D1)
    expect(st[t.plant!.stageIndex]).toBe('grownTree')
    expect(t.screen).toBe('transplant')
  })

  it('dandelion does not transplant', () => {
    const st = SPECIES.dandelion.stages
    const p: PlantState = {
      ...newPlant('dandelion'), stageIndex: st.indexOf('leafStem'), growth: 3.9, careDone: 1, water: 60, nutrient: 50,
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

  it('다른 식물 고르기 on the morning after a death consumes the day like replant does', () => {
    const r = boot(persist(dead()), D2)
    expect(r.dayDone).toBe(false)
    const picked = reducer(r, { type: 'pick', id: 'rice' }, D2)
    const replanted = reducer(r, { type: 'replant', id: 'rice' }, D2)
    expect(picked.dayDone).toBe(true)
    expect(picked.lastDayKey).toBe(D2)
    expect({ ...picked, screen: null }).toEqual({ ...replanted, screen: null })
    // and the new plant's day 1 is the next date
    expect(boot(persist(picked), '2026-10-23').dayDone).toBe(false)
  })
})

describe('restoring a short code over an existing save', () => {
  const kept = { balsam: { journal: [oneEntry(10)] } }
  const tries = [{ speciesId: 'corn' as const, days: 3, stage: 'sprout' as const, cause: '물이 부족해서 말라 버렸어요.' }]

  it('keeps the finished journals, past tries and dex; only the plant comes from the code', () => {
    const here: AppState = { ...started('bean'), finished: kept, pastTries: tries, dex: ['balsam'] }
    const code: SaveData = { ...emptySave(), plant: { ...newPlant('rice'), day: 4 }, lastDayKey: D1, dex: ['rice'] }
    const t = reducer(here, { type: 'restore', data: code, keep: true }, D1)
    expect(t.plant!.speciesId).toBe('rice')
    expect(t.finished).toEqual(kept)
    expect(t.pastTries).toEqual(tries)
    expect(t.dex).toEqual(['rice', 'balsam'])
    expect(t.journal).toEqual([])
  })

  it('a full code still replaces everything', () => {
    const here: AppState = { ...started('bean'), finished: kept, pastTries: tries }
    const t = reducer(here, { type: 'restore', data: { ...emptySave(), plant: newPlant('rice'), lastDayKey: D1 } }, D1)
    expect(t.finished).toEqual({})
    expect(t.pastTries).toEqual([])
  })
})

describe('the morning card shows once per day', () => {
  it('a dismissed card stays closed after a reload the same day, and the next report shows again', () => {
    const s = play(started(), [{ type: 'water', amount: 10 }], D1)
    const morning = boot(persist(s), D2)
    expect(morning.morning).not.toBeNull()
    expect(morningShown(morning)).toBe(false)
    const seen = reducer(morning, { type: 'morningSeen' }, D2)
    expect(seen.morningShownFor).toBe(D2)
    expect(morningShown(boot(persist(seen), D2))).toBe(true)
    // the day's own result after 하루 마치기 is a new card
    const done = reducer(seen, { type: 'endDay' }, D2)
    expect(morningShown(done)).toBe(false)
    expect(morningShown(reducer(done, { type: 'morningSeen' }, D2))).toBe(true)
    // the next date brings the card back
    expect(morningShown(boot(persist(reducer(done, { type: 'morningSeen' }, D2)), '2026-10-23'))).toBe(false)
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

  describe('two tabs on one device', () => {
    const storageEvent = (ls: Storage) =>
      act(() => void window.dispatchEvent(new StorageEvent('storage', { key: SAVE_KEY, newValue: ls.getItem(SAVE_KEY) })))

    it('an old tab picks up the newer progress of another tab and never writes its stale state back', () => {
      const ls = fakeStorage()
      vi.stubGlobal('localStorage', ls)
      const old = renderHook(() => useApp())
      act(() => old.result.current[1]({ type: 'pick', id: 'bean' }))
      act(() => old.result.current[1]({ type: 'care', task: 'sow' }))
      // the second tab opens the same save and finishes the day
      const fresh = renderHook(() => useApp())
      act(() => fresh.result.current[1]({ type: 'water', amount: 10 }))
      act(() => fresh.result.current[1]({ type: 'endDay' }))
      expect(JSON.parse(ls.getItem(SAVE_KEY)!).plant.day).toBe(2)
      // the browser tells the old tab that the save changed
      storageEvent(ls)
      expect(old.result.current[0].plant!.day).toBe(2)
      expect(old.result.current[0].dayDone).toBe(true)
      expect(old.result.current[0].journal).toHaveLength(1)
      // the old tab can no longer act on the day the other tab finished
      act(() => old.result.current[1]({ type: 'water', amount: 30 }))
      const saved = JSON.parse(ls.getItem(SAVE_KEY)!)
      expect(saved.plant.day).toBe(2)
      expect(saved.journal).toHaveLength(1)
      expect(saved.dayDone).toBe(true)
    })

    it('without a storage event, focus re-reads the save before anything else happens', () => {
      const ls = fakeStorage()
      vi.stubGlobal('localStorage', ls)
      const old = renderHook(() => useApp())
      act(() => old.result.current[1]({ type: 'pick', id: 'bean' }))
      const fresh = renderHook(() => useApp())
      act(() => fresh.result.current[1]({ type: 'endDay' }))
      act(() => void window.dispatchEvent(new Event('focus')))
      expect(old.result.current[0].plant!.day).toBe(2)
      act(() => old.result.current[1]({ type: 'endDay' }))
      // still the other tab's day 2, not a second day finished from the stale day 1
      expect(JSON.parse(ls.getItem(SAVE_KEY)!).plant.day).toBe(2)
      expect(JSON.parse(ls.getItem(SAVE_KEY)!).journal).toHaveLength(1)
    })

    it("another tab's write keeps a viewer on the dex, journal, kept record or backup screen", () => {
      for (const screen of ['dex', 'journal', 'backup', 'record'] as const) {
        const ls = fakeStorage()
        vi.stubGlobal('localStorage', ls)
        const old = renderHook(() => useApp())
        act(() => old.result.current[1]({ type: 'pick', id: 'bean' }))
        if (screen === 'record') {
          // a kept finished journal to look at (as if written earlier)
          ls.setItem(SAVE_KEY, JSON.stringify({ ...JSON.parse(ls.getItem(SAVE_KEY)!), finished: { balsam: { journal: [oneEntry(10)] } } }))
          storageEvent(ls)
          act(() => old.result.current[1]({ type: 'openRecord', id: 'balsam' }))
        } else {
          act(() => old.result.current[1]({ type: 'open', screen }))
        }
        expect(old.result.current[0].screen).toBe(screen)
        const fresh = renderHook(() => useApp())
        act(() => fresh.result.current[1]({ type: 'endDay' }))
        storageEvent(ls)
        expect(old.result.current[0].plant!.day, screen).toBe(2)
        expect(old.result.current[0].screen, screen).toBe(screen)
        if (screen === 'record') expect(old.result.current[0].record).toBe('balsam')
        old.unmount()
        fresh.unmount()
      }
    })

    it('its own writes do not reset the screen on focus', () => {
      const ls = fakeStorage()
      vi.stubGlobal('localStorage', ls)
      const { result } = renderHook(() => useApp())
      act(() => result.current[1]({ type: 'pick', id: 'bean' }))
      act(() => result.current[1]({ type: 'open', screen: 'journal' }))
      act(() => void window.dispatchEvent(new Event('focus')))
      storageEvent(ls)
      expect(result.current[0].screen).toBe('journal')
    })
  })

  it('a failed write (storage full) never re-boots from the older save, and says so once', () => {
    const ls = fakeStorage()
    vi.stubGlobal('localStorage', ls)
    const { result } = renderHook(() => useApp())
    act(() => result.current[1]({ type: 'pick', id: 'bean' }))
    act(() => result.current[1]({ type: 'care', task: 'sow' }))
    expect(JSON.parse(ls.getItem(SAVE_KEY)!).plant.speciesId).toBe('bean')
    // the storage fills up: every write from now on throws
    const setItem = vi.spyOn(ls, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    act(() => result.current[1]({ type: 'water', amount: 10 }))
    expect(result.current[0].notice).toBe('saveFailed')
    act(() => result.current[1]({ type: 'clearNotice' }))
    act(() => result.current[1]({ type: 'water', amount: 10 }))
    // focus re-reads storage: the save there is older, but it is our own last good write
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(result.current[0].pendingActions?.waterAdded).toBe(20)
    expect(result.current[0].notice).toBeUndefined()
    expect('notice' in toSave(result.current[0])).toBe(false)
    setItem.mockRestore()
  })

  it('a first write that fails right after boot never rewinds to the older stored save', () => {
    const ls = fakeStorage()
    vi.stubGlobal('localStorage', ls)
    const first = renderHook(() => useApp())
    act(() => first.result.current[1]({ type: 'pick', id: 'bean' }))
    act(() => first.result.current[1]({ type: 'care', task: 'sow' }))
    first.unmount()
    const setItem = vi.spyOn(ls, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const { result } = renderHook(() => useApp())
    act(() => result.current[1]({ type: 'water', amount: 10 }))
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(result.current[0].pendingActions?.waterAdded).toBe(10)
    setItem.mockRestore()
  })

  it("draws a new plant's weather seed outside the reducer, unless the action brings one", () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      const { result } = renderHook(() => useApp())
      act(() => result.current[1]({ type: 'pick', id: 'bean', mode: 'quick' }))
      expect(result.current[0].plant).toMatchObject({ mode: 'quick', weatherSeed: 128 })
      // a seed the action brings is kept
      vi.stubGlobal('localStorage', fakeStorage())
      const other = renderHook(() => useApp())
      act(() => other.result.current[1]({ type: 'pick', id: 'corn', weatherSeed: 9 }))
      expect(other.result.current[0].plant).toMatchObject({ mode: 'daily', weatherSeed: 9 })
    } finally {
      random.mockRestore()
    }
  })

  it('saves after each dispatch', () => {
    const ls = fakeStorage()
    vi.stubGlobal('localStorage', ls)
    const { result } = renderHook(() => useApp())
    expect(result.current[0].warning).toBeUndefined()
    act(() => result.current[1]({ type: 'pick', id: 'corn' }))
    act(() => result.current[1]({ type: 'care', task: 'sow' }))
    act(() => result.current[1]({ type: 'water', amount: 10 }))
    const saved = JSON.parse(ls.getItem(SAVE_KEY)!)
    expect(saved.pendingActions.waterAdded).toBe(10)
    expect(saved.screen).toBeUndefined()
    expect(ls.getItem('plantlife.v1.bak')).toBeNull()
  })
})

/** An open day on D1 growing `p`, nothing done yet. */
function holding(p: PlantState, extra: Partial<AppState> = {}): AppState {
  return { ...started(p.speciesId), plant: p, pendingActions: null, ...extra }
}

/** Bean one growth step before completing (fruit stage, its care done). */
const beanNearDone = (mode: 'daily' | 'quick' = 'daily'): PlantState => ({
  ...newPlant('bean', { mode }), stageIndex: SPECIES.bean.stages.indexOf('fruit'), growth: 3.9, careDone: 1,
  water: 60, nutrient: 50, day: 9,
})

describe('two modes', () => {
  it('quick mode: end day starts the next morning at once, no date needed', () => {
    const s = play(
      boot(emptySave(), D1),
      [{ type: 'pick', id: 'bean', mode: 'quick', weatherSeed: 7 }, { type: 'care', task: 'sow' }],
      D1,
    )
    expect(s.plant).toMatchObject({ mode: 'quick', weatherSeed: 7, day: 1 })
    expect(isQuick(s.plant)).toBe(true)
    expect(s.dayDone).toBe(false)
    const t = play(s, [{ type: 'water', amount: 10 }, { type: 'endDay' }], D1)
    expect(t.plant!.day).toBe(2)
    expect(t.dayDone).toBe(false)
    expect(t.journal).toHaveLength(1)
    // the next day is played and ended on the same date
    const u = play(t, [{ type: 'water', amount: 5 }, { type: 'endDay' }, { type: 'endDay' }], D1)
    expect(u.plant!.day).toBe(4)
    expect(u.journal.map((e) => e.day)).toEqual([1, 2, 3])
    expect(u.journal[1].actions.waterAdded).toBe(5)
    expect(u.dayDone).toBe(false)
  })

  it('a plant picked without a mode is a daily plant', () => {
    const s = started('bean')
    expect(s.plant!.mode).toBe('daily')
    expect(isQuick(s.plant)).toBe(false)
    expect(isQuick(null)).toBe(false)
  })

  it('a quick plant is never finalized by a new date', () => {
    const s = play(
      boot(emptySave(), D1),
      [{ type: 'pick', id: 'bean', mode: 'quick' }, { type: 'care', task: 'sow' }, { type: 'water', amount: 10 }],
      D1,
    )
    const r = boot(persist(s), D2)
    expect(r.plant).toEqual(s.plant)
    expect(r.journal).toEqual([])
    expect(r.pendingActions).toEqual(s.pendingActions)
    expect(reducer(s, { type: 'tick' }, D2)).toBe(s)
    // it keeps playing on the new date
    expect(reducer(s, { type: 'water', amount: 5 }, D2).pendingActions?.waterAdded).toBe(15)
    // a quick save marked done (never written by the app) still opens to play
    expect(boot({ ...persist(s), dayDone: true }, D2).dayDone).toBe(false)
  })

  it('modes share the dex and the kept journal', () => {
    const daily = reducer(holding(beanNearDone('daily')), { type: 'endDay' }, D1)
    expect(daily.dex).toEqual(['bean'])
    expect(daily.finished?.bean?.mode).toBe('daily')
    const picked = reducer(daily, { type: 'pick', id: 'bean', mode: 'quick' }, D1)
    expect(picked.plant!.mode).toBe('quick')
    const quickDone = reducer({ ...picked, plant: beanNearDone('quick') }, { type: 'endDay' }, D1)
    expect(quickDone.screen).toBe('journal')
    expect(quickDone.dex).toEqual(['bean'])
    expect(quickDone.finished?.bean).toEqual({ journal: quickDone.journal, mode: 'quick' })
  })

  it('a new daily plant after a finished quick plant plays day 1 today', () => {
    const done = reducer(holding(beanNearDone('quick')), { type: 'endDay' }, D1)
    expect(done.screen).toBe('journal')
    const t = play(done, [{ type: 'pick', id: 'corn' }, { type: 'care', task: 'sow' }, { type: 'water', amount: 10 }], D1)
    expect(t.plant).toMatchObject({ speciesId: 'corn', mode: 'daily', day: 1 })
    expect(t.dayDone).toBe(false)
    expect(t.lastDayKey).toBe(D1)
    expect(t.pendingActions?.waterAdded).toBe(10)
    // also after a quick plant died: it never used up the date
    const dead = reducer(holding({ ...newPlant('bean', { mode: 'quick' }), health: 1, water: 0 }), { type: 'endDay' }, D1)
    expect(dead.screen).toBe('dead')
    expect(reducer(dead, { type: 'pick', id: 'corn' }, D1).dayDone).toBe(false)
  })

  it("replant keeps the dead plant's mode and takes the new weather seed", () => {
    const dead = reducer(holding({ ...newPlant('bean', { mode: 'quick' }), health: 1, water: 0 }), { type: 'endDay' }, D1)
    const t = reducer(dead, { type: 'replant', id: 'bean', weatherSeed: 42 }, D1)
    expect(t.plant).toEqual(newPlant('bean', { mode: 'quick', weatherSeed: 42 }))
    expect(t.dayDone).toBe(false)
    expect(t.pastTries.at(-1)).toMatchObject({ speciesId: 'bean', mode: 'quick' })
  })
})

describe('stage care', () => {
  it('care only accepts the pending task', () => {
    const s = reducer(boot(emptySave(), D1), { type: 'pick', id: 'bean' }, D1)
    expect(pendingCare(s.plant!)).toBe('sow')
    const wrong = reducer(s, { type: 'care', task: 'thin' }, D1)
    expect(wrong.plant!.careDone).toBe(0)
    expect(wrong.pendingActions).toBeNull()
    const sown = reducer(s, { type: 'care', task: 'sow' }, D1)
    // counted on the plant at once, so a save or a short code made mid-day keeps it
    expect(sown.plant!.careDone).toBe(1)
    expect(sown.pendingActions?.care).toEqual(['sow'])
    expect(toSave(sown).plant!.careDone).toBe(1)
    const again = reducer(sown, { type: 'care', task: 'sow' }, D1)
    expect(again.plant!.careDone).toBe(1)
    expect(again.pendingActions?.care).toEqual(['sow'])
    // not once the day is done
    const sprout: PlantState = { ...newPlant('bean'), stageIndex: SPECIES.bean.stages.indexOf('sprout') }
    expect(reducer(holding(sprout, { dayDone: true }), { type: 'care', task: 'thin' }, D1).plant!.careDone).toBe(0)
  })

  it('a short code made mid-day keeps the care done that day', () => {
    const r = importCode(shortCode(toSave(started('bean'))))
    if (!r.ok) throw new Error(r.message)
    expect(r.data.plant!.careDone).toBe(1)
  })

  it('a tree is pruned only after it moves to the yard (transplant, then prune)', () => {
    const st = SPECIES.apple.stages
    const tree: PlantState = {
      ...newPlant('apple'), stageIndex: st.indexOf('grownTree'), growth: 3.9, water: 60, nutrient: 50, lightExp: 90,
    }
    const s = holding(tree, { screen: 'transplant' })
    expect(reducer(s, { type: 'care', task: 'prune' }, D1).plant!.careDone).toBe(0)
    const yard = reducer(s, { type: 'chooseYard', place: 'yardSunny' }, D1)
    const pruned = reducer(yard, { type: 'care', task: 'prune' }, D1)
    expect(pruned.plant!.careDone).toBe(1)
    expect(pruned.pendingActions?.care).toEqual(['prune'])
    expect(st[reducer(pruned, { type: 'endDay' }, D1).plant!.stageIndex]).toBe('flower')
  })

  it('watering waits for sowing', () => {
    const s = reducer(boot(emptySave(), D1), { type: 'pick', id: 'bean' }, D1)
    const t = reducer(s, { type: 'water', amount: 10 }, D1)
    expect(t.plant!.water).toBe(s.plant!.water)
    expect(t.pendingActions).toBeNull()
    const u = play(s, [{ type: 'care', task: 'sow' }, { type: 'water', amount: 10 }], D1)
    expect(u.plant!.water).toBe(s.plant!.water + 10)
  })

  it('moveIn completes by moving to the desk in winter', () => {
    const st = SPECIES.dandelion.stages
    const winter: PlantState = { ...newPlant('dandelion'), stageIndex: st.indexOf('winter'), place: 'window' }
    expect(pendingCare(winter)).toBe('moveIn')
    const s = holding(winter)
    expect(reducer(s, { type: 'move', place: 'shade' }, D1).plant!.careDone).toBe(0)
    const t = reducer(s, { type: 'move', place: 'desk' }, D1)
    expect(t.plant!.careDone).toBe(1)
    expect(t.pendingActions).toMatchObject({ place: 'desk', care: ['moveIn'] })
    // a plant already on the desk is counted as moved in when the day ends
    const onDesk = holding({ ...winter, place: 'desk', growth: 3.9, water: 40, nutrient: 30 })
    const e = reducer(onDesk, { type: 'endDay' }, D1)
    expect(e.journal[0].actions.care).toEqual(['moveIn'])
    expect(st[e.plant!.stageIndex]).toBe('newShoot')
    // outside winter the desk is only a place
    const leaf: PlantState = { ...newPlant('dandelion'), stageIndex: st.indexOf('leafStem'), place: 'window' }
    expect(reducer(holding(leaf), { type: 'move', place: 'desk' }, D1).plant!.careDone).toBe(0)
  })

  it('v1 save mid-stage keeps playing after the update', () => {
    const raw = {
      v: 1,
      plant: {
        speciesId: 'bean', stageIndex: 1, growth: 3.9, health: 90, water: 60, nutrient: 50, lightExp: 65, place: 'desk',
        bugs: 0, day: 5, heightCm: 2, leaves: 1, dead: false, history: [],
      },
      pendingActions: { waterAdded: 10, pellets: 0, bugsRemoved: 0, place: 'desk' },
      lastDayKey: D1,
      dayDone: false,
      journal: [],
      pastTries: [],
      dex: [],
      settings: { sound: true, tutorialSeen: true },
      lastReport: null,
    }
    const { data, warning } = loadSave({ getItem: () => JSON.stringify(raw) } as unknown as Storage)
    expect(warning).toBeUndefined()
    const s = boot(data, D1)
    expect(s.plant).toMatchObject({ mode: 'daily', careDone: 1, weatherFrom: 6 })
    expect(pendingCare(s.plant!)).toBeNull()
    expect(weatherToday(s)).toBeNull()
    const e = reducer(s, { type: 'endDay' }, D1)
    expect(e.plant!.stageIndex).toBe(2)
    expect(e.lastReport?.weather).toBeUndefined()
    expect(e.dayDone).toBe(true)
    expect(e.nightFx?.ending).toBe('night')
  })

  it('restored waiting plant advances after its care', () => {
    const st = SPECIES.bean.stages
    const waiting: PlantState = {
      ...newPlant('bean', { weatherSeed: 9 }), stageIndex: st.indexOf('sprout'), growth: STAGE_POINTS, careDone: 0,
      water: 60, nutrient: 50, day: 6, heightCm: 6,
    }
    const r = importCode(shortCode({ ...emptySave(), plant: waiting, lastDayKey: D1 }))
    if (!r.ok) throw new Error(r.message)
    const s = reducer(started('corn'), { type: 'restore', data: r.data, keep: true }, D1)
    expect(s.plant).toMatchObject({ speciesId: 'bean', growth: STAGE_POINTS, careDone: 0 })
    expect(pendingCare(s.plant!)).toBe('thin')
    // without the care it keeps waiting
    const idle = reducer(s, { type: 'endDay' }, D1)
    expect(st[idle.plant!.stageIndex]).toBe('sprout')
    expect(idle.lastReport?.waiting).toBe(true)
    const e = play(s, [{ type: 'care', task: 'thin' }, { type: 'endDay' }], D1)
    expect(st[e.plant!.stageIndex]).toBe('leafStem')
  })
})

describe('weather in the store', () => {
  const at = SPECIES.apple.stages

  it('tie only on a typhoon day', () => {
    const base: PlantState = { ...newPlant('apple'), stageIndex: at.indexOf('flower'), place: 'yardSunny', day: 5, careDone: 1 }
    const stormy = holding({ ...base, weatherSeed: seedWith(base, 5, 'typhoon') })
    const t = reducer(stormy, { type: 'tie' }, D1)
    expect(t.pendingActions?.tied).toBe(true)
    const e = reducer(t, { type: 'endDay' }, D1)
    expect(e.lastReport?.weather).toEqual({ kind: 'typhoon', prepared: true })
    expect(e.journal[0].weather).toEqual({ kind: 'typhoon', prepared: true })
    expect(reducer(stormy, { type: 'endDay' }, D1).lastReport?.weather).toEqual({ kind: 'typhoon', prepared: false })
    const calm = holding({ ...base, weatherSeed: calmSeed(base, 5) })
    expect(reducer(calm, { type: 'tie' }, D1).pendingActions).toBeNull()
  })

  it("the day's weather is judged on what the student did", () => {
    const base: PlantState = { ...newPlant('apple'), stageIndex: at.indexOf('grownTree'), place: 'yardSunny', day: 5, careDone: 1 }
    const rainy = holding({ ...base, weatherSeed: seedWith(base, 5, 'rain') })
    // watering on a rainy day is not prepared; leaving it to the rain is
    expect(play(rainy, [{ type: 'water', amount: 10 }, { type: 'endDay' }], D1).lastReport?.weather).toEqual({
      kind: 'rain',
      prepared: false,
    })
    expect(reducer(rainy, { type: 'endDay' }, D1).lastReport?.weather).toEqual({ kind: 'rain', prepared: true })
    // the same when the day is finalized by the next date
    const rolled = boot(persist(reducer(rainy, { type: 'water', amount: 10 }, D1)), D2)
    expect(rolled.journal[0].weather).toEqual({ kind: 'rain', prepared: false })
  })

  it("a day finalized on load still tells today's weather", () => {
    const sprout: PlantState = { ...newPlant('bean'), stageIndex: SPECIES.bean.stages.indexOf('sprout') }
    const s = reducer(holding({ ...sprout, weatherSeed: seedWith(sprout, 2) }), { type: 'water', amount: 10 }, D1)
    const r = boot(persist(s), D2)
    expect(r.plant!.day).toBe(2)
    expect(r.nightFx).toBeUndefined()
    expect(weatherToday(r)).not.toBeNull()
    expect(weatherToday(r)?.kind).toBe(weatherOn(r.plant!, 2))
    expect(weatherToday(boot(emptySave(), D1))).toBeNull()
  })
})

describe('measure and observe', () => {
  const sprout: PlantState = { ...newPlant('bean'), stageIndex: SPECIES.bean.stages.indexOf('sprout'), heightCm: 3.4 }

  it('measure records once a day, only the right answer', () => {
    expect(measureAnswer(3.4)).toBe(3)
    expect(measureAnswer(0.3)).toBe(1)
    const s = holding(sprout)
    const wrong = reducer(s, { type: 'measure', cm: 4, helped: false }, D1)
    expect(wrong.pendingObs ?? null).toBeNull()
    const right = reducer(wrong, { type: 'measure', cm: 3, helped: true }, D1)
    expect(right.pendingObs).toEqual({ measuredCm: 3, measureHelped: true })
    expect(reducer(right, { type: 'measure', cm: 3, helped: false }, D1).pendingObs).toEqual({ measuredCm: 3, measureHelped: true })
    const e = reducer(right, { type: 'endDay' }, D1)
    expect(e.journal[0]).toMatchObject({ measuredCm: 3, measureHelped: true })
    expect(e.pendingObs).toBeNull()
    // the next date measures again
    const cm = measureAnswer(e.plant!.heightCm)
    expect(reducer(e, { type: 'measure', cm, helped: false }, D2).pendingObs).toEqual({ measuredCm: cm, measureHelped: false })
    // no ruler for a seed under the soil
    expect(reducer(started(), { type: 'measure', cm: 1, helped: false }, D1).pendingObs ?? null).toBeNull()
  })

  it('observe records once a day and goes into the journal with the measurement', () => {
    const [said, other] = OBSERVATIONS.bean.sprout!.yes
    const t = reducer(holding(sprout), { type: 'observe', text: said }, D1)
    expect(t.pendingObs).toEqual({ observed: said })
    expect(reducer(t, { type: 'observe', text: other }, D1).pendingObs?.observed).toBe(said)
    const both = reducer(t, { type: 'measure', cm: 3, helped: false }, D1)
    expect(both.pendingObs).toEqual({ observed: said, measuredCm: 3, measureHelped: false })
    expect(reducer(both, { type: 'endDay' }, D1).journal[0]).toMatchObject({ observed: said, measuredCm: 3 })
    // a day with only an observation is still finalized by the next date
    const r = boot(persist(t), D2)
    expect(r.journal[0].observed).toBe(said)
    expect(r.pendingObs).toBeNull()
  })

  it("observe accepts only a true sentence of today's stage", () => {
    const s = holding(sprout)
    const set = OBSERVATIONS.bean.sprout!
    // a false sentence, a true sentence of another stage or species, free text: nothing is recorded
    for (const text of [set.no[0], OBSERVATIONS.bean.flower!.yes[0], OBSERVATIONS.corn.sprout!.yes[1], '아무 말', ''])
      expect(reducer(s, { type: 'observe', text }, D1).pendingObs ?? null, text).toBeNull()
    for (const text of set.yes) expect(reducer(s, { type: 'observe', text }, D1).pendingObs, text).toEqual({ observed: text })
  })
})

describe('night transition signal', () => {
  const sprout: PlantState = { ...newPlant('bean'), stageIndex: SPECIES.bean.stages.indexOf('sprout') }

  it('nightFx: sunrise for quick, night for daily, fade on death or transplant; forecast from the new day', () => {
    const seed = seedWith(sprout, 2)
    const q = reducer(holding({ ...sprout, mode: 'quick', weatherSeed: seed }), { type: 'endDay' }, D1)
    expect(q.nightFx).toEqual({ ending: 'sunrise', forecast: weatherOn(q.plant!, 2), n: 1 })
    expect(q.nightFx!.forecast).not.toBeNull()
    expect(reducer(q, { type: 'endDay' }, D1).nightFx).toMatchObject({ ending: 'sunrise', n: 2 })
    const d = reducer(holding({ ...sprout, weatherSeed: seed }), { type: 'endDay' }, D1)
    expect(d.nightFx).toEqual({ ending: 'night', forecast: weatherOn(d.plant!, 2), n: 1 })
    const calm = reducer(holding({ ...sprout, weatherSeed: calmSeed(sprout, 2) }), { type: 'endDay' }, D1)
    expect(calm.nightFx).toEqual({ ending: 'night', forecast: null, n: 1 })
    const dead = reducer(holding({ ...sprout, mode: 'quick', weatherSeed: seed, health: 1, water: 0 }), { type: 'endDay' }, D1)
    expect(dead.nightFx).toEqual({ ending: 'fade', forecast: null, n: 1 })
    const done = reducer(holding(beanNearDone('quick')), { type: 'endDay' }, D1)
    expect(done.nightFx).toEqual({ ending: 'fade', forecast: null, n: 1 })
    const at = SPECIES.apple.stages
    const tree: PlantState = {
      ...newPlant('apple'), stageIndex: at.indexOf('leafStem'), growth: 3.9, careDone: 1,
      water: 60, nutrient: 50, lightExp: 90, place: 'window',
    }
    const moving = reducer(holding(tree), { type: 'endDay' }, D1)
    expect(moving.screen).toBe('transplant')
    expect(moving.nightFx).toMatchObject({ ending: 'fade', n: 1 })
    // the tree that waits to move still hears tomorrow's (yard) weather
    expect(moving.nightFx!.forecast).toBe(weatherOn(moving.plant!, moving.plant!.day))
  })

  it('nightFxDone clears the signal, and it is never saved', () => {
    const q = reducer(holding({ ...sprout, mode: 'quick' }), { type: 'endDay' }, D1)
    expect(q.nightFx).toBeDefined()
    expect('nightFx' in toSave(q)).toBe(false)
    expect(reducer(q, { type: 'nightFxDone' }, D1).nightFx).toBeUndefined()
    expect(boot(persist(q), D1).nightFx).toBeUndefined()
  })
})
